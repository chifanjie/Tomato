import { createHash, generateKeyPairSync } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  ProviderRuntimeIpcStrongMutationRequestClaimsV1Schema,
  canonicalizeProviderRuntimeIpcStrongMutationRequestV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import {
  CanonicalByteStringV1Schema,
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  ProviderAcceptanceStateGenerationIdV1Schema,
  ProviderRegistryManifestGenerationIdV1Schema,
  ProviderTargetProfileIdV1Schema,
  StoreProviderVerificationKeyIdV1Schema,
} from "@understand-code/durable-object-provider-contracts/primitives";

import * as publicClientApi from "../src/index.js";
import {
  bindProviderProductionStrongObjectOperationPlanObserverInternalV1,
  captureProviderProductionStrongObjectOperationPlanObserverStateInternalV1,
  openProviderProductionStrongObjectHostCoreInternalV1,
  type OpenProviderProductionStrongObjectClientV1Input,
} from "../src/provider-production-strong-object-client.js";
import {
  ProviderProductionStrongObjectUnavailableErrorV1,
  providerProductionStrongObjectGatewayHostCoreInputInternalV1,
  providerProductionStrongObjectGatewayPublicCoreInputInternalV1,
} from "../src/provider-production-strong-object-gateway.js";
import {
  exchangeProviderRuntimeStrongMutationSameSocketInternalV1,
  type ExchangeProviderRuntimeStrongMutationSameSocketInternalV1Input,
  type ProviderRuntimeStrongMutationOperationPlanInternalV1,
} from "../src/provider-runtime-strong-mutation-transport-internal.js";

const PROVIDER_ID_V1 = DurableObjectIdentityProviderIdV1Schema.parse(
  "durable-object-provider:production-plan-observer-test",
);
const OPERATION_NONCE_V1 = "9".repeat(32);
const PRIVATE_BYTES_V1 = CanonicalByteStringV1Schema.parse(
  `base64url:${Buffer.from("private object bytes").toString("base64url")}`,
);

function digestV1(octet: string) {
  return ContentDigestV1Schema.parse(`sha256:${octet.repeat(64)}`);
}

function requestV1() {
  return ProviderRuntimeIpcStrongMutationRequestClaimsV1Schema.parse({
    operation: "write_object",
    operationNonce: OPERATION_NONCE_V1,
    payload: {
      locator: {
        providerId: PROVIDER_ID_V1,
        contentDigest: digestV1("a"),
      },
      logicalBytes: 20,
      bytes: PRIVATE_BYTES_V1,
    },
  });
}

function expectedPlanV1(): ProviderRuntimeStrongMutationOperationPlanInternalV1 {
  const request = requestV1();
  return {
    operation: request.operation,
    operationNonce: request.operationNonce,
    requestDigest: ContentDigestV1Schema.parse(
      `sha256:${createHash("sha256")
        .update(canonicalizeProviderRuntimeIpcStrongMutationRequestV1(request))
        .digest("hex")}`,
    ),
  };
}

interface ListeningServerV1 {
  readonly socketPath: string;
  readonly connections: () => number;
  close(): Promise<void>;
}

async function listeningServerV1(): Promise<ListeningServerV1> {
  const root = await mkdtemp(join(tmpdir(), "uc-production-plan-"));
  const socketPath = join(root, "s");
  const sockets = new Set<Socket>();
  let connectionCount = 0;
  const server: Server = createServer((socket) => {
    connectionCount += 1;
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    socket.on("error", () => undefined);
    socket.destroy();
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, resolve);
  });
  return {
    socketPath,
    connections: () => connectionCount,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(root, { recursive: true, force: true });
    },
  };
}

function transportInputV1(
  socketPath: string,
  counters: { signerCalls: number },
): ExchangeProviderRuntimeStrongMutationSameSocketInternalV1Input {
  const { publicKey } = generateKeyPairSync("ed25519");
  const servicePublicKey = CanonicalByteStringV1Schema.parse(
    `base64url:${Buffer.from(publicKey.export({
      format: "der",
      type: "spki",
    })).toString("base64url")}`,
  );
  return {
    socketPath,
    timeoutMs: 1_000,
    expectedPrincipal: {
      providerId: PROVIDER_ID_V1,
      capabilityDigest: digestV1("b"),
      handoffPayloadDigest: digestV1("c"),
      servicePublicKey,
      journalHead: {
        revision: 7,
        phase: "final_strong_ready",
        mutationDigest: digestV1("d"),
      },
      acceptanceIdentity: {
        generationId: ProviderAcceptanceStateGenerationIdV1Schema.parse(
          `provider-acceptance-state:${"e".repeat(22)}`,
        ),
        contentDigest: digestV1("f"),
        acceptanceOrdinal: 3,
        installationIdentityGenerationId:
          InstallationIdentityGenerationIdV1Schema.parse(
            `installation-identity-generation:${"1".repeat(22)}`,
          ),
      },
    },
    grantStaticFields: {
      signerKeyId: StoreProviderVerificationKeyIdV1Schema.parse(
        "2".repeat(22),
      ),
      targetProfileId: ProviderTargetProfileIdV1Schema.parse(
        `provider-target-profile:${"3".repeat(64)}`,
      ),
      targetFingerprintDigest: digestV1("4"),
      registryManifest: {
        locatorProfile: "installation_provider_registry_manifest_v1",
        manifestGeneration: 5,
        generationId: ProviderRegistryManifestGenerationIdV1Schema.parse(
          `provider-registry-manifest:${"5".repeat(22)}`,
        ),
        contentDigest: digestV1("6"),
      },
    },
    request: requestV1(),
    mintSigner() {
      counters.signerCalls += 1;
      throw new Error("signer must not run after observer rejection");
    },
  };
}

describe("production strong object private operation-plan composition", () => {
  it("keeps the public entrypoints unchanged and the private hook unexported", () => {
    expect(publicClientApi.openProviderProductionStrongObjectClientV1)
      .toBeTypeOf("function");
    expect(publicClientApi.startProviderProductionStrongObjectGatewayServiceV1)
      .toBeTypeOf("function");
    expect(publicClientApi)
      .not.toHaveProperty("openProviderProductionStrongObjectHostCoreInternalV1");
    expect(publicClientApi)
      .not.toHaveProperty("startProviderProductionStrongObjectGatewayServiceCoreInternalV1");
  });

  it("defaults to no hook and never accepts one from the public DTO", async () => {
    const callerHook = vi.fn();
    const publicInput = {
      canonicalInstallationRoot: "/var/lib/understand-code/provider-test",
      observeProviderOperationPlan: callerHook,
    } as unknown as OpenProviderProductionStrongObjectClientV1Input;

    const gatewayCoreInput =
      providerProductionStrongObjectGatewayPublicCoreInputInternalV1(
        publicInput,
      );
    expect(Object.getPrototypeOf(gatewayCoreInput)).toBeNull();
    expect(Object.hasOwn(gatewayCoreInput, "observeProviderOperationPlan"))
      .toBe(false);
    const projected =
      providerProductionStrongObjectGatewayHostCoreInputInternalV1(
        gatewayCoreInput,
      );
    expect(projected).toEqual({
      publicInput: {
        canonicalInstallationRoot: publicInput.canonicalInstallationRoot,
      },
      observeProviderOperationPlan: undefined,
    });
    expect(Object.hasOwn(projected, "observeProviderOperationPlan")).toBe(true);
    expect(projected.observeProviderOperationPlan).toBeUndefined();
    expect(projected.publicInput).not.toBe(publicInput);
    expect(Object.getPrototypeOf(projected)).toBeNull();
    expect(Object.getPrototypeOf(projected.publicInput)).toBeNull();
    expect(Object.isFrozen(projected)).toBe(true);
    expect(Object.isFrozen(projected.publicInput)).toBe(true);
    const observerState =
      captureProviderProductionStrongObjectOperationPlanObserverStateInternalV1(
        projected,
      );
    expect(Object.hasOwn(observerState, "observeProviderOperationPlan"))
      .toBe(true);
    expect(observerState.observeProviderOperationPlan).toBeUndefined();

    const server = await listeningServerV1();
    const counters = { signerCalls: 0 };
    const transportInput = transportInputV1(server.socketPath, counters);
    const bound =
      bindProviderProductionStrongObjectOperationPlanObserverInternalV1(
        observerState,
        transportInput,
      );
    expect(bound).not.toBe(transportInput);
    expect(Object.hasOwn(bound, "observeProviderOperationPlan")).toBe(true);
    expect(bound.observeProviderOperationPlan).toBeUndefined();
    expect(Object.isFrozen(bound)).toBe(true);
    try {
      await expect(
        exchangeProviderRuntimeStrongMutationSameSocketInternalV1(bound),
      ).rejects.toMatchObject({ code: "transport_unavailable" });
      expect(server.connections()).toBe(1);
      expect(callerHook).not.toHaveBeenCalled();
      expect(counters.signerCalls).toBe(0);
    } finally {
      await server.close();
    }
  });

  it("ignores public and core prototype pollution without invoking accessors", () => {
    const inheritedHook = vi.fn();
    const inheritedPublicInput = Object.assign(
      Object.create({ observeProviderOperationPlan: inheritedHook }) as
        OpenProviderProductionStrongObjectClientV1Input,
      { canonicalInstallationRoot: "/var/lib/understand-code/provider-test" },
    );
    const inheritedCoreInput = Object.assign(
      Object.create({ observeProviderOperationPlan: inheritedHook }) as
        Parameters<
          typeof providerProductionStrongObjectGatewayHostCoreInputInternalV1
        >[0],
      { publicInput: inheritedPublicInput },
    );
    const inheritedProjection =
      providerProductionStrongObjectGatewayHostCoreInputInternalV1(
        inheritedCoreInput,
      );
    expect(inheritedProjection.observeProviderOperationPlan).toBeUndefined();
    const counters = { signerCalls: 0 };
    const transportInput = transportInputV1("/tmp/not-used.sock", counters);
    const inheritedState = Object.create({
      observeProviderOperationPlan: inheritedHook,
    }) as Parameters<
      typeof bindProviderProductionStrongObjectOperationPlanObserverInternalV1
    >[0];
    const inheritedBound =
      bindProviderProductionStrongObjectOperationPlanObserverInternalV1(
        inheritedState,
        transportInput,
      );
    expect(inheritedBound).not.toBe(transportInput);
    expect(inheritedBound.observeProviderOperationPlan).toBeUndefined();
    expect(Object.hasOwn(inheritedBound, "observeProviderOperationPlan"))
      .toBe(true);

    let publicGetterReads = 0;
    const accessorPublicInput = {
      canonicalInstallationRoot: "/var/lib/understand-code/provider-test",
    } as OpenProviderProductionStrongObjectClientV1Input;
    Object.defineProperty(accessorPublicInput, "observeProviderOperationPlan", {
      configurable: true,
      get() {
        publicGetterReads += 1;
        return publicGetterReads === 1 ? undefined : inheritedHook;
      },
    });
    const accessorProjection =
      providerProductionStrongObjectGatewayHostCoreInputInternalV1({
        publicInput: accessorPublicInput,
      });
    expect(accessorProjection.observeProviderOperationPlan).toBeUndefined();
    expect(publicGetterReads).toBe(0);

    let installationRootGetterReads = 0;
    const accessorInstallationRoot = Object.create(null) as
      OpenProviderProductionStrongObjectClientV1Input;
    Object.defineProperty(
      accessorInstallationRoot,
      "canonicalInstallationRoot",
      {
        configurable: true,
        get() {
          installationRootGetterReads += 1;
          return "/var/lib/understand-code/provider-test";
        },
      },
    );
    expect(() =>
      providerProductionStrongObjectGatewayHostCoreInputInternalV1({
        publicInput: accessorInstallationRoot,
      })
    ).toThrowError(ProviderProductionStrongObjectUnavailableErrorV1);
    expect(installationRootGetterReads).toBe(0);
    expect(inheritedHook).not.toHaveBeenCalled();
  });

  it("rejects core and state accessors without reading them", async () => {
    const hook = vi.fn();
    let gatewayGetterReads = 0;
    const gatewayCoreInput = Object.assign(
      Object.create(null) as Parameters<
        typeof providerProductionStrongObjectGatewayHostCoreInputInternalV1
      >[0],
      {
        publicInput: {
          canonicalInstallationRoot: "/var/lib/understand-code/provider-test",
        },
      },
    );
    Object.defineProperty(gatewayCoreInput, "observeProviderOperationPlan", {
      configurable: true,
      get() {
        gatewayGetterReads += 1;
        return gatewayGetterReads === 1 ? undefined : hook;
      },
    });
    expect(() =>
      providerProductionStrongObjectGatewayHostCoreInputInternalV1(
        gatewayCoreInput,
      )
    ).toThrowError(ProviderProductionStrongObjectUnavailableErrorV1);
    expect(gatewayGetterReads).toBe(0);

    let hostGetterReads = 0;
    const hostCoreInput = Object.assign(
      Object.create(null) as Parameters<
        typeof openProviderProductionStrongObjectHostCoreInternalV1
      >[0],
      {
        publicInput: {
          canonicalInstallationRoot: "/var/lib/understand-code/provider-test",
        },
      },
    );
    Object.defineProperty(hostCoreInput, "observeProviderOperationPlan", {
      configurable: true,
      get() {
        hostGetterReads += 1;
        return hostGetterReads === 1 ? undefined : hook;
      },
    });
    await expect(
      openProviderProductionStrongObjectHostCoreInternalV1(hostCoreInput),
    ).rejects.toMatchObject({
      code: "invalid_input",
      message: "strong object operation plan observer is invalid",
    });
    expect(hostGetterReads).toBe(0);

    let stateGetterReads = 0;
    const state = Object.create(null) as Parameters<
      typeof bindProviderProductionStrongObjectOperationPlanObserverInternalV1
    >[0];
    Object.defineProperty(state, "observeProviderOperationPlan", {
      configurable: true,
      get() {
        stateGetterReads += 1;
        return stateGetterReads === 1 ? undefined : hook;
      },
    });
    const counters = { signerCalls: 0 };
    expect(() =>
      bindProviderProductionStrongObjectOperationPlanObserverInternalV1(
        state,
        transportInputV1("/tmp/not-used.sock", counters),
      )
    ).toThrowError("strong object operation plan observer is invalid");
    expect(stateGetterReads).toBe(0);
    expect(hook).not.toHaveBeenCalled();
  });

  it("passes the exact root-injected hook through state to the transport", () => {
    const hook = vi.fn();
    const replacementHook = vi.fn();
    const gatewayCoreInput = {
      publicInput: {
        canonicalInstallationRoot: "/var/lib/understand-code/provider-test",
      },
      observeProviderOperationPlan: hook,
    };
    const hostCoreInput =
      providerProductionStrongObjectGatewayHostCoreInputInternalV1(
        gatewayCoreInput,
      );
    gatewayCoreInput.observeProviderOperationPlan = replacementHook;
    const observerState =
      captureProviderProductionStrongObjectOperationPlanObserverStateInternalV1(
        hostCoreInput,
      );
    const counters = { signerCalls: 0 };
    const transportInput = transportInputV1("/tmp/not-used.sock", counters);
    const bound =
      bindProviderProductionStrongObjectOperationPlanObserverInternalV1(
        observerState,
        transportInput,
      );

    expect(hostCoreInput.observeProviderOperationPlan).toBe(hook);
    expect(observerState.observeProviderOperationPlan).toBe(hook);
    expect(bound.observeProviderOperationPlan).toBe(hook);
    expect(bound).not.toBe(transportInput);
    expect(Object.isFrozen(bound)).toBe(true);
  });

  it("fails closed before connection or signing when the root hook rejects", async () => {
    const server = await listeningServerV1();
    const counters = { signerCalls: 0 };
    let observed: ProviderRuntimeStrongMutationOperationPlanInternalV1 | undefined;
    const rootHook = async (
      plan: ProviderRuntimeStrongMutationOperationPlanInternalV1,
    ) => {
      observed = plan;
      throw new Error("root supervisor rejected operation plan");
    };
    const hostCoreInput =
      providerProductionStrongObjectGatewayHostCoreInputInternalV1({
        publicInput: {
          canonicalInstallationRoot: "/var/lib/understand-code/provider-test",
        },
        observeProviderOperationPlan: rootHook,
      });
    const observerState =
      captureProviderProductionStrongObjectOperationPlanObserverStateInternalV1(
        hostCoreInput,
      );
    const input =
      bindProviderProductionStrongObjectOperationPlanObserverInternalV1(
        observerState,
        transportInputV1(server.socketPath, counters),
      );

    try {
      await expect(
        exchangeProviderRuntimeStrongMutationSameSocketInternalV1(input),
      ).rejects.toMatchObject({
        code: "operation_plan_rejected",
        message: "strong mutation operation plan was rejected",
      });
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(observed).toEqual(expectedPlanV1());
      expect(server.connections()).toBe(0);
      expect(counters.signerCalls).toBe(0);
    } finally {
      await server.close();
    }
  });
});
