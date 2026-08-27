import { describe, expect, it } from "vitest";

import { providerProductionStrongClientTrustLifecycleLimitsInternalV1 as limits } from "../src/provider-production-strong-client-trust-lifecycle.js";

describe("production strong client trust lifecycle physical limits", () => {
  it("accepts the frozen 300 MiB snapshot boundary and rejects oversize inputs", () => {
    expect(limits.maximumSnapshotPhysicalBytes).toBe(300 * 1024 * 1024);
    expect(limits.maximumDescriptorPhysicalBytes).toBe(1024 * 1024);
    expect(limits.acceptsSnapshotByteLength(17 * 1024 * 1024)).toBe(true);
    expect(limits.acceptsSnapshotByteLength(300 * 1024 * 1024)).toBe(true);
    expect(limits.acceptsSnapshotByteLength(300 * 1024 * 1024 + 1)).toBe(false);
    expect(limits.acceptsSnapshotByteLength(Number.MAX_SAFE_INTEGER)).toBe(false);
  });
});
