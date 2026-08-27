import { describe, expect, it } from "vitest";

import {
  providerProductionStrongClientDescriptorPathV1,
  providerProductionStrongClientGatewayDirectoryPathV1,
  providerProductionStrongClientGatewaySocketPathV1,
} from "@understand-code/durable-object-provider-runtime/provider-production-strong-client-trust-lifecycle";

import {
  closeProviderProductionStrongObjectGatewayResourcesInternalV1,
  providerProductionStrongObjectRevisionProjectionInternalV1,
  providerProductionStrongObjectPrivilegeDropIsExactInternalV1,
} from "../src/provider-production-strong-object-gateway.js";

describe("production strong object gateway", () => {
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
