import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

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
import {
  openOrInitializeProviderAcceptanceInstallationIdentityInternalV1,
  provisionProviderAcceptanceInstallationIdentityForTestInternalV1,
  type ProviderAcceptanceInstallationIdentityInitializationOptionsInternalV1,
} from "./key-custody-internal.js";
import {
  createProviderAcceptanceAuthorityTestLayoutInternalV1,
  type ProviderAcceptanceAuthorityLayoutInternalV1,
} from "./platform-layout.js";
import {
  classifyProviderStrongMutationBrokerAdmissionInternalV1,
  inspectProviderStrongMutationBrokerSnapshotWithLayoutCoreInternalV1,
  openProviderStrongMutationBrokerStoreWithLayoutCoreInternalV1,
  type ProviderStrongMutationBrokerAdmissionInputInternalV1,
  type ProviderStrongMutationBrokerAdmissionResultInternalV1,
  type ProviderStrongMutationBrokerStoreInternalV1,
} from "./strong-mutation-broker-core-internal.js";
import {
  PROVIDER_STRONG_MUTATION_TRUST_EVIDENCE_SNAPSHOT_LIMITS_INTERNAL_V1,
  classifyProviderStrongMutationTrustEvidenceSnapshotAdmissionInternalV1,
  mintProviderStrongMutationTrustVerifierCapabilityInternalV1,
  type MintProviderStrongMutationTrustVerifierCapabilityInternalV1Input,
  type ProviderStrongMutationTrustEvidenceSnapshotAdmissionInputInternalV1,
  type ProviderStrongMutationTrustEvidenceSnapshotAdmissionResultInternalV1,
  type ProviderStrongMutationTrustVerifierCapabilityInternalV1,
} from "./strong-mutation-trust-verifier-core-internal.js";
import {
  assertNativeInstallationStateAuthoritySeparatedFromSafeGitV1,
  deriveNativeSafeGitPathIdentityV1,
  type NativeSafeGitDescriptorBindingV1,
  type NativeSafeGitPathIdentityV1,
} from "@understand-code/native-kernel-bridge";

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
    const resolved = resolve(root);
    try {
      const parent = realpathSync(dirname(resolved));
      const leaf = basename(resolved);
      if (leaf === "" || leaf === "." || leaf === "..") {
        throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
      }
      candidate = join(parent, leaf);
    } catch {
      throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
    }
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

export async function openOrInitializeProviderAcceptanceAuthorityForTestInternalV1(
  capability: ProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  options: ProviderAcceptanceInstallationIdentityInitializationOptionsInternalV1 = {},
): Promise<Readonly<{ installationIdentityGenerationId: string }>> {
  const identity =
    await openOrInitializeProviderAcceptanceInstallationIdentityInternalV1(
      requireCapabilityV1(capability),
      options,
    );
  return Object.freeze({
    installationIdentityGenerationId:
      identity.installationIdentityGenerationId,
  });
}

export async function deriveProviderAcceptanceSafeGitPathIdentityForTestInternalV1(
  capability: ProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  binding: NativeSafeGitDescriptorBindingV1,
): Promise<NativeSafeGitPathIdentityV1> {
  const identity =
    await openOrInitializeProviderAcceptanceInstallationIdentityInternalV1(
      requireCapabilityV1(capability),
      {
        authorizeNativeAuthority(opened) {
          assertNativeInstallationStateAuthoritySeparatedFromSafeGitV1(
            opened.authority,
            binding,
          );
        },
      },
    );
  return identity.withKey(async (key) =>
    deriveNativeSafeGitPathIdentityV1(binding, key)
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

export function openProviderStrongMutationBrokerStoreForTestInternalV1(
  capability: ProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  verifierCapability:
    ProviderStrongMutationTrustVerifierCapabilityInternalV1,
  options: ProviderAcceptanceAuthorityStoreOpenOptionsInternalV1 = {},
): Promise<ProviderStrongMutationBrokerStoreInternalV1> {
  return openProviderStrongMutationBrokerStoreWithLayoutCoreInternalV1(
    requireCapabilityV1(capability),
    verifierCapability,
    options,
  );
}

export function mintProviderStrongMutationTrustVerifierForTestInternalV1(
  input: MintProviderStrongMutationTrustVerifierCapabilityInternalV1Input,
): ProviderStrongMutationTrustVerifierCapabilityInternalV1 {
  requireTestProcessV1();
  return mintProviderStrongMutationTrustVerifierCapabilityInternalV1(input);
}

export function classifyProviderStrongMutationTrustEvidenceSnapshotAdmissionForTestInternalV1(
  input: ProviderStrongMutationTrustEvidenceSnapshotAdmissionInputInternalV1,
): ProviderStrongMutationTrustEvidenceSnapshotAdmissionResultInternalV1 {
  requireTestProcessV1();
  return classifyProviderStrongMutationTrustEvidenceSnapshotAdmissionInternalV1(
    input,
  );
}

export function providerStrongMutationTrustEvidenceSnapshotLimitsForTestInternalV1() {
  requireTestProcessV1();
  return PROVIDER_STRONG_MUTATION_TRUST_EVIDENCE_SNAPSHOT_LIMITS_INTERNAL_V1;
}

export function inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(
  capability: ProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  verifierCapability:
    ProviderStrongMutationTrustVerifierCapabilityInternalV1,
) {
  return inspectProviderStrongMutationBrokerSnapshotWithLayoutCoreInternalV1(
    requireCapabilityV1(capability),
    verifierCapability,
  );
}

export function classifyProviderStrongMutationBrokerAdmissionForTestInternalV1(
  input: ProviderStrongMutationBrokerAdmissionInputInternalV1,
): ProviderStrongMutationBrokerAdmissionResultInternalV1 {
  requireTestProcessV1();
  return classifyProviderStrongMutationBrokerAdmissionInternalV1(input);
}

export type {
  ProviderAcceptanceAuthorityAdmissionInputInternalV1,
  ProviderAcceptanceAuthorityAdmissionResultInternalV1,
  ProviderAcceptanceAuthorityStoreOpenOptionsInternalV1,
  MintProviderStrongMutationTrustVerifierCapabilityInternalV1Input,
  ProviderStrongMutationTrustEvidenceSnapshotAdmissionInputInternalV1,
  ProviderStrongMutationTrustEvidenceSnapshotAdmissionResultInternalV1,
  ProviderStrongMutationTrustVerifierCapabilityInternalV1,
  ProviderStrongMutationBrokerAdmissionInputInternalV1,
  ProviderStrongMutationBrokerAdmissionResultInternalV1,
};
