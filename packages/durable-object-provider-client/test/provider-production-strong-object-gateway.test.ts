import { describe, expect, it } from "vitest";

import {
  providerProductionStrongClientDescriptorPathV1,
  providerProductionStrongClientGatewayDirectoryPathV1,
  providerProductionStrongClientGatewaySocketPathV1,
} from "@understand-code/durable-object-provider-runtime/provider-production-strong-client-trust-lifecycle";

import {
  closeProviderProductionStrongObjectGatewayResourcesInternalV1,
  isProviderProductionStrongObjectUnavailableErrorV1,
  PROVIDER_PRODUCTION_STRONG_OBJECT_UNAVAILABLE_CODE_V1,
  ProviderProductionStrongObjectUnavailableErrorV1,
  providerProductionStrongIndexPublicationGatewayRequestInternalV1,
  providerProductionStrongIndexPublicationGatewayResponseInternalV1,
  providerProductionStrongObjectUnavailableBoundaryInternalV1,
  providerProductionStrongObjectRevisionProjectionInternalV1,
  providerProductionStrongObjectPrivilegeDropIsExactInternalV1,
} from "../src/provider-production-strong-object-gateway.js";

describe("production strong object gateway", () => {
  it("normalizes later gateway loss with one stable cross-module brand", async () => {
    const transportFailure = new Error("gateway disconnected");
    await expect(
      providerProductionStrongObjectUnavailableBoundaryInternalV1(
        async () => { throw transportFailure; },
      ),
    ).rejects.toMatchObject({
      name: "ProviderProductionStrongObjectUnavailableErrorV1",
      code: PROVIDER_PRODUCTION_STRONG_OBJECT_UNAVAILABLE_CODE_V1,
      cause: transportFailure,
    });

    const duplicateModuleError = {
      name: "ProviderProductionStrongObjectUnavailableErrorV1",
      code: PROVIDER_PRODUCTION_STRONG_OBJECT_UNAVAILABLE_CODE_V1,
    };
    expect(
      isProviderProductionStrongObjectUnavailableErrorV1(
        duplicateModuleError,
      ),
    ).toBe(true);
    expect(
      isProviderProductionStrongObjectUnavailableErrorV1({
        ...duplicateModuleError,
        code: "different_error",
      }),
    ).toBe(false);
    await expect(
      providerProductionStrongObjectUnavailableBoundaryInternalV1(
        () => { throw duplicateModuleError; },
      ),
    ).rejects.toBe(duplicateModuleError);
    expect(
      isProviderProductionStrongObjectUnavailableErrorV1(
        new ProviderProductionStrongObjectUnavailableErrorV1(),
      ),
    ).toBe(true);
  });

  it("derives one installation-bound public descriptor and private socket namespace", () => {
    const root = "/var/lib/understand-code/provider-installation";
    expect(providerProductionStrongClientDescriptorPathV1(root)).toBe(
      `${root}.provider-production-strong-client-v1.json`,
    );
    const directory = providerProductionStrongClientGatewayDirectoryPathV1(root);
    expect(directory).toMatch(/^\/run\/understand-code-provider-strong-client-[0-9a-f]{32}$/u);
    expect(providerProductionStrongClientGatewaySocketPathV1(root)).toBe(
      `${directory}/provider-gateway-v1.sock`,
    );
    expect(Buffer.byteLength(providerProductionStrongClientGatewaySocketPathV1(root)) + 1)
      .toBeLessThanOrEqual(104);
  });

  it("rejects retained root and foreign supplementary groups after uid drop", () => {
    const exact = {
      actualUid: 41001,
      actualGid: 41002,
      supplementaryGroups: [41002],
      expectedUid: 41001,
      expectedGid: 41002,
    } as const;
    expect(providerProductionStrongObjectPrivilegeDropIsExactInternalV1(exact)).toBe(true);
    expect(providerProductionStrongObjectPrivilegeDropIsExactInternalV1({
      ...exact,
      supplementaryGroups: [0, 41002],
    })).toBe(false);
    expect(providerProductionStrongObjectPrivilegeDropIsExactInternalV1({
      ...exact,
      supplementaryGroups: [41002, 49999],
    })).toBe(false);
    expect(providerProductionStrongObjectPrivilegeDropIsExactInternalV1({
      ...exact,
      actualUid: 0,
    })).toBe(false);
  });

  it("projects only the Provider revision and rejects journal artifact exposure", () => {
    expect(providerProductionStrongObjectRevisionProjectionInternalV1({
      revision: 17,
    })).toEqual({ revision: 17 });
    expect(() => providerProductionStrongObjectRevisionProjectionInternalV1({
      revision: 17,
      artifacts: { ownerSecret: "must-not-cross-gateway" },
    })).toThrow(/unavailable/u);
    expect(() => providerProductionStrongObjectRevisionProjectionInternalV1({
      revision: -1,
    })).toThrow(/unavailable/u);
  });

  it("round-trips the strict reserved index-publication gateway DTO", () => {
    const request = {
      expectedRevision: 12,
      operationNonce: "a".repeat(32),
      phase: "strong_refresh_index_v1",
      artifacts: { operation: "refresh_index", status: "published" },
      authority: {
        profile: "provider_production_strong_index_publication_authority_v1",
        generationId: `generation-${"b".repeat(64)}`,
        generationManifestDigest: `sha256:${"c".repeat(64)}`,
        sourceInventoryDigest: `sha256:${"d".repeat(64)}`,
        sourceSnapshotId: "snapshot:gateway-index-publication",
      },
    } as const;
    expect(
      providerProductionStrongIndexPublicationGatewayRequestInternalV1(
        request,
      ),
    ).toEqual(request);
    expect(
      providerProductionStrongIndexPublicationGatewayResponseInternalV1({
        ...request.authority,
        finalizedProviderRevision: 13,
      }),
    ).toEqual({
      ...request.authority,
      finalizedProviderRevision: 13,
    });
    expect(
      providerProductionStrongIndexPublicationGatewayResponseInternalV1(null),
    ).toBeUndefined();

    expect(() =>
      providerProductionStrongIndexPublicationGatewayRequestInternalV1({
        ...request,
        unexpected: true,
      })
    ).toThrow(/index publication compare input is invalid/u);
    expect(() =>
      providerProductionStrongIndexPublicationGatewayRequestInternalV1({
        ...request,
        authority: { ...request.authority, unexpected: true },
      })
    ).toThrow(/index publication authority input is invalid/u);
    expect(() =>
      providerProductionStrongIndexPublicationGatewayResponseInternalV1({
        ...request.authority,
        finalizedProviderRevision: 13,
        unexpected: true,
      })
    ).toThrow(/index publication authority is invalid/u);
  });

  it("releases host and lifecycle lease after listener cleanup fails", async () => {
    const events: string[] = [];
    const listenerFailure = new Error("listener cleanup failed");
    await expect(
      closeProviderProductionStrongObjectGatewayResourcesInternalV1({
        async closeServer() {
          events.push("server");
          throw listenerFailure;
        },
        closeHost() {
          events.push("host");
        },
        async closeLifecycleLease() {
          events.push("lease");
        },
      }),
    ).rejects.toBe(listenerFailure);
    expect(events).toEqual(["server", "host", "lease"]);
  });

  it("retains every independent resource-close failure", async () => {
    const serverFailure = new Error("server failed");
    const hostFailure = new Error("host failed");
    const leaseFailure = new Error("lease failed");
    const result = closeProviderProductionStrongObjectGatewayResourcesInternalV1({
      async closeServer() {
        throw serverFailure;
      },
      closeHost() {
        throw hostFailure;
      },
      async closeLifecycleLease() {
        throw leaseFailure;
      },
    });
    await expect(result).rejects.toEqual(expect.objectContaining({
      errors: [serverFailure, hostFailure, leaseFailure],
    }));
  });
});
