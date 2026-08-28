import { createHash, generateKeyPairSync } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

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

import {
  exchangeProviderRuntimeStrongMutationSameSocketInternalV1,
  type ExchangeProviderRuntimeStrongMutationSameSocketInternalV1Input,
  type ProviderRuntimeStrongMutationOperationPlanInternalV1,
} from "../src/provider-runtime-strong-mutation-transport-internal.js";

const PROVIDER_ID_V1 = DurableObjectIdentityProviderIdV1Schema.parse(
  "durable-object-provider:plan-observer-test",
);
const OPERATION_NONCE_V1 = "9".repeat(32);
const PRIVATE_BYTES_V1 = CanonicalByteStringV1Schema.parse(
  `base64url:${Buffer.from("/private/provider/object:secret-bytes").toString("base64url")}`,
);

function digestV1(octet: string) {
  return ContentDigestV1Schema.parse(`sha256:${octet.repeat(64)}`);
}

interface ListeningServerV1 {
  readonly socketPath: string;
  readonly connections: () => number;
  close(): Promise<void>;
}

async function listeningServerV1(order?: string[]): Promise<ListeningServerV1> {
  const root = await mkdtemp(join(tmpdir(), "uc-plan-"));
  const socketPath = join(root, "s");
  const sockets = new Set<Socket>();
  let connectionCount = 0;
  const server: Server = createServer((socket) => {
    connectionCount += 1;
    order?.push("connect");
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

function validRequestV1() {
  return ProviderRuntimeIpcStrongMutationRequestClaimsV1Schema.parse({
    operation: "write_object",
    operationNonce: OPERATION_NONCE_V1,
    payload: {
      locator: {
        providerId: PROVIDER_ID_V1,
        contentDigest: digestV1("a"),
      },
      logicalBytes: 36,
      bytes: PRIVATE_BYTES_V1,
    },
  });
}

function inputV1(
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
    request: validRequestV1(),
    mintSigner() {
      counters.signerCalls += 1;
      throw new Error("signer must not run in plan observer tests");
    },
  };
}

function expectedPlanV1(): ProviderRuntimeStrongMutationOperationPlanInternalV1 {
  const request = validRequestV1();
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

describe("client-private pre-side-effect Provider operation plan observer", () => {
  it("publishes one exact redacted plan before connecting", async () => {
    const order: string[] = [];
    const server = await listeningServerV1(order);
    const counters = { signerCalls: 0 };
    let observed: ProviderRuntimeStrongMutationOperationPlanInternalV1 | undefined;
    const input = {
      ...inputV1(server.socketPath, counters),
      observeProviderOperationPlan: async (
        plan: ProviderRuntimeStrongMutationOperationPlanInternalV1,
      ) => {
        order.push("observer:start");
        observed = plan;
        expect(server.connections()).toBe(0);
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(server.connections()).toBe(0);
        order.push("observer:end");
      },
    };
    try {
      await expect(
        exchangeProviderRuntimeStrongMutationSameSocketInternalV1(input),
      ).rejects.toMatchObject({ code: "transport_unavailable" });
      expect(observed).toEqual(expectedPlanV1());
      expect(Object.keys(observed ?? {})).toEqual([
        "operation",
        "operationNonce",
        "requestDigest",
      ]);
      expect(Object.isFrozen(observed)).toBe(true);
      expect(JSON.stringify(observed)).not.toContain("payload");
      expect(JSON.stringify(observed)).not.toContain(PRIVATE_BYTES_V1);
      expect(order).toEqual(["observer:start", "observer:end", "connect"]);
      expect(counters.signerCalls).toBe(0);
    } finally {
      await server.close();
    }
  });

  it("keeps the observer optional and continues to the transport", async () => {
    const server = await listeningServerV1();
    const counters = { signerCalls: 0 };
    try {
      await expect(
        exchangeProviderRuntimeStrongMutationSameSocketInternalV1(
          inputV1(server.socketPath, counters),
        ),
      ).rejects.toMatchObject({ code: "transport_unavailable" });
      expect(server.connections()).toBe(1);
      expect(counters.signerCalls).toBe(0);
    } finally {
      await server.close();
    }
  });

  it("accepts an own undefined observer and continues to the transport", async () => {
    const server = await listeningServerV1();
    const counters = { signerCalls: 0 };
    const input = {
      ...inputV1(server.socketPath, counters),
      observeProviderOperationPlan: undefined,
    };
    try {
      await expect(
        exchangeProviderRuntimeStrongMutationSameSocketInternalV1(input),
      ).rejects.toMatchObject({ code: "transport_unavailable" });
      expect(server.connections()).toBe(1);
      expect(counters.signerCalls).toBe(0);
    } finally {
      await server.close();
    }
  });

  it("ignores an inherited observer and continues to the transport", async () => {
    const server = await listeningServerV1();
    const counters = { signerCalls: 0 };
    let observerCalls = 0;
    const input = Object.assign(
      Object.create({
        observeProviderOperationPlan: () => {
          observerCalls += 1;
        },
      }) as ExchangeProviderRuntimeStrongMutationSameSocketInternalV1Input,
      inputV1(server.socketPath, counters),
    );
    try {
      await expect(
        exchangeProviderRuntimeStrongMutationSameSocketInternalV1(input),
      ).rejects.toMatchObject({ code: "transport_unavailable" });
      expect(server.connections()).toBe(1);
      expect(observerCalls).toBe(0);
      expect(counters.signerCalls).toBe(0);
    } finally {
      await server.close();
    }
  });

  it("ignores Object.prototype observer pollution and restores it", async () => {
    const server = await listeningServerV1();
    const counters = { signerCalls: 0 };
    let observerCalls = 0;
    const property = "observeProviderOperationPlan";
    const previous = Object.getOwnPropertyDescriptor(Object.prototype, property);
    try {
      Object.defineProperty(Object.prototype, property, {
        configurable: true,
        value: () => {
          observerCalls += 1;
        },
      });
      await expect(
        exchangeProviderRuntimeStrongMutationSameSocketInternalV1(
          inputV1(server.socketPath, counters),
        ),
      ).rejects.toMatchObject({ code: "transport_unavailable" });
      expect(server.connections()).toBe(1);
      expect(observerCalls).toBe(0);
      expect(counters.signerCalls).toBe(0);
    } finally {
      if (previous === undefined) {
        Reflect.deleteProperty(Object.prototype, property);
      } else {
        Object.defineProperty(Object.prototype, property, previous);
      }
      await server.close();
    }
  });

  it("rejects an observer accessor without invoking it or side effects", async () => {
    const server = await listeningServerV1();
    const counters = { signerCalls: 0 };
    let getterReads = 0;
    const input = inputV1(server.socketPath, counters);
    Object.defineProperty(input, "observeProviderOperationPlan", {
      configurable: true,
      get() {
        getterReads += 1;
        return getterReads === 1 ? undefined : () => undefined;
      },
    });
    try {
      await expect(
        exchangeProviderRuntimeStrongMutationSameSocketInternalV1(input),
      ).rejects.toMatchObject({
        code: "invalid_input",
        message: "strong mutation exchange input is invalid",
      });
      expect(getterReads).toBe(0);
      expect(server.connections()).toBe(0);
      expect(counters.signerCalls).toBe(0);
    } finally {
      await server.close();
    }
  });

  it("rejects an invalid own observer without transport side effects", async () => {
    const server = await listeningServerV1();
    const counters = { signerCalls: 0 };
    const input = {
      ...inputV1(server.socketPath, counters),
      observeProviderOperationPlan: "not-a-function",
    } as unknown as ExchangeProviderRuntimeStrongMutationSameSocketInternalV1Input;
    try {
      await expect(
        exchangeProviderRuntimeStrongMutationSameSocketInternalV1(input),
      ).rejects.toMatchObject({
        code: "invalid_input",
        message: "strong mutation exchange input is invalid",
      });
      expect(server.connections()).toBe(0);
      expect(counters.signerCalls).toBe(0);
    } finally {
      await server.close();
    }
  });

  it("maps an observer descriptor trap to stable invalid input", async () => {
    const server = await listeningServerV1();
    const counters = { signerCalls: 0 };
    const input = new Proxy(inputV1(server.socketPath, counters), {
      getOwnPropertyDescriptor(target, property) {
        if (property === "observeProviderOperationPlan") {
          throw new Error("descriptor unavailable");
        }
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
    });
    try {
      await expect(
        exchangeProviderRuntimeStrongMutationSameSocketInternalV1(input),
      ).rejects.toMatchObject({
        code: "invalid_input",
        message: "strong mutation exchange input is invalid",
      });
      expect(server.connections()).toBe(0);
      expect(counters.signerCalls).toBe(0);
    } finally {
      await server.close();
    }
  });

  it("does not notify, connect, or sign for invalid request claims", async () => {
    const server = await listeningServerV1();
    const counters = { signerCalls: 0 };
    let observerCalls = 0;
    const baseInput = inputV1(server.socketPath, counters);
    const input = {
      ...baseInput,
      observeProviderOperationPlan: () => {
        observerCalls += 1;
      },
      request: {
        ...baseInput.request,
        operationNonce: "not-a-valid-operation-nonce",
      } as typeof baseInput.request,
    };
    try {
      await expect(
        exchangeProviderRuntimeStrongMutationSameSocketInternalV1(input),
      ).rejects.toMatchObject({ code: "invalid_input" });
      expect(observerCalls).toBe(0);
      expect(server.connections()).toBe(0);
      expect(counters.signerCalls).toBe(0);
    } finally {
      await server.close();
    }
  });

  it.each([
    ["throws", () => {
      throw new Error("plan rejected");
    }],
    ["rejects", async () => {
      throw new Error("plan rejected asynchronously");
    }],
  ])("fails closed when the observer %s", async (_label, observer) => {
    const server = await listeningServerV1();
    const counters = { signerCalls: 0 };
    const input = {
      ...inputV1(server.socketPath, counters),
      observeProviderOperationPlan: observer,
    };
    try {
      await expect(
        exchangeProviderRuntimeStrongMutationSameSocketInternalV1(input),
      ).rejects.toMatchObject({
        code: "operation_plan_rejected",
        message: "strong mutation operation plan was rejected",
      });
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(server.connections()).toBe(0);
      expect(counters.signerCalls).toBe(0);
    } finally {
      await server.close();
    }
  });
});
