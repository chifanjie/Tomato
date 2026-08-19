import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, relative, resolve } from "node:path";

import {
  classifyProviderAcceptanceAuthorityAdmissionInternalV1,
  inspectProviderAcceptanceAuthorityCandidateWithLayoutCoreInternalV1,
  inspectProviderAcceptanceAuthoritySnapshotCoreInternalV1,
  openProviderAcceptanceAuthorityStoreWithLayoutCoreInternalV1,
  type ProviderAcceptanceAuthorityAdmissionInputInternalV1,
  type ProviderAcceptanceAuthorityAdmissionResultInternalV1,
  type ProviderAcceptanceAuthorityStoreInternalV1,
  type ProviderAcceptanceAuthorityStoreOpenOptionsInternalV1,
} from "./acceptance-store-core-internal.js";
import { ProviderAcceptanceAuthorityErrorV1 } from "./errors.js";
import { provisionProviderAcceptanceInstallationIdentityForTestInternalV1 } from "./key-custody-internal.js";
import {
  createProviderAcceptanceAuthorityTestLayoutInternalV1,
  type ProviderAcceptanceAuthorityLayoutInternalV1,
} from "./platform-layout.js";

declare const providerAcceptanceAuthorityTestLayoutCapabilityBrandInternalV1:
  unique symbol;
export interface ProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1 {
  readonly [providerAcceptanceAuthorityTestLayoutCapabilityBrandInternalV1]: true;
}

const TEST_LAYOUTS_V1 = new WeakMap<
  object,
  ProviderAcceptanceAuthorityLayoutInternalV1
>();

function requireTestProcessV1(): void {
  if (process.env.NODE_ENV !== "test") {
    throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
  }
}

function requireCapabilityV1(
  capability: ProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
): ProviderAcceptanceAuthorityLayoutInternalV1 {
  requireTestProcessV1();
  const layout = TEST_LAYOUTS_V1.get(capability);
  if (layout === undefined) {
    throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
  }
  return layout;
}

/** Deep-import-only, NODE_ENV=test-only opaque temp-root capability mint. */
export function createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1(
  root: string,
): ProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1 {
  requireTestProcessV1();
  const temporaryRoot = realpathSync(tmpdir());
  if (!isAbsolute(root)) {
    throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
  }
  let candidate: string;
  try {
    // macOS commonly exposes /var as a symlink to /private/var. Compare the
    // real existing fixture root to the real tmp root, not their spellings.
    candidate = realpathSync(resolve(root));
  } catch {
    throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
  }
  const child = relative(temporaryRoot, candidate);
  if (
    child === "" ||
    child.startsWith("..") ||
    isAbsolute(child) ||
    Buffer.byteLength(candidate, "utf8") > 4096
  ) {
    throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
  }
  const capability = Object.freeze(Object.create(null)) as
    ProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1;
  TEST_LAYOUTS_V1.set(
    capability,
    createProviderAcceptanceAuthorityTestLayoutInternalV1(candidate),
  );
  return capability;
}

export function provisionProviderAcceptanceAuthorityForTestInternalV1(
  capability: ProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  input: Readonly<{
    installationIdentityGenerationId: unknown;
    installationIdentityKey: Uint8Array;
  }>,
): Promise<void> {
  return provisionProviderAcceptanceInstallationIdentityForTestInternalV1(
    requireCapabilityV1(capability),
    input,
  );
}

export function openProviderAcceptanceAuthorityStoreForTestInternalV1(
  capability: ProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  options: ProviderAcceptanceAuthorityStoreOpenOptionsInternalV1 = {},
): Promise<ProviderAcceptanceAuthorityStoreInternalV1> {
  return openProviderAcceptanceAuthorityStoreWithLayoutCoreInternalV1(
    requireCapabilityV1(capability),
    options,
  );
}

export function inspectProviderAcceptanceAuthoritySnapshotForTestInternalV1(
  capability: ProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
): Promise<Readonly<{
  snapshotRevision: number;
  generationCount: number;
  receiptCount: number;
  receiptLogicalBytes: number;
  transactionCount: number;
}>> {
  return inspectProviderAcceptanceAuthoritySnapshotCoreInternalV1(
    requireCapabilityV1(capability),
  );
}

export function inspectProviderAcceptanceAuthorityCandidateForTestInternalV1(
  capability: ProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
) {
  return inspectProviderAcceptanceAuthorityCandidateWithLayoutCoreInternalV1(
    requireCapabilityV1(capability),
  );
}

export function classifyProviderAcceptanceAuthorityAdmissionForTestInternalV1(
  input: ProviderAcceptanceAuthorityAdmissionInputInternalV1,
): ProviderAcceptanceAuthorityAdmissionResultInternalV1 {
  // Pure Acceptance-local policy probe only; it is not a global D-40
  // admission authority and cannot observe retained Root/Registry/Catalog.
  requireTestProcessV1();
  return classifyProviderAcceptanceAuthorityAdmissionInternalV1(input);
}

export type {
  ProviderAcceptanceAuthorityAdmissionInputInternalV1,
  ProviderAcceptanceAuthorityAdmissionResultInternalV1,
  ProviderAcceptanceAuthorityStoreOpenOptionsInternalV1,
};
