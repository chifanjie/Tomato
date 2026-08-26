import { describe, expect, it } from "vitest";

import {
  providerProductionStrongClientDescriptorPathV1,
  providerProductionStrongClientGatewayDirectoryPathV1,
  providerProductionStrongClientGatewaySocketPathV1,
} from "@understand-code/durable-object-provider-runtime/provider-production-strong-client-trust-lifecycle";

import {
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
});
