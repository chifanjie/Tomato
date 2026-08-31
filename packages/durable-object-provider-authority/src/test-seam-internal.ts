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
  observeProviderAcceptanceAuthorityLockTurnoverForTestInternalV1,
  waitForProviderAcceptanceAuthorityLockReleasePollForTestInternalV1,
} from "./cross-process-lock-internal.js";
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
  abortStep16ReceiptBindingDurableJournalInternalV1,
  appendStep16ReceiptBindingExpectedOperationDurableInternalV1,
  armStep16ReceiptBindingDurableJournalInternalV1,
  completeStep16ReceiptBindingDurableJournalInternalV1,
  deriveStep16ReceiptBindingOrderedPrefixDigestInternalV1,
  finalizeStep16ReceiptBindingDurableJournalInternalV1,
  inspectStep16ReceiptBindingDurableJournalInternalV1,
  openStep16ReceiptBindingDurableJournalWithLayoutCoreInternalV1,
  verifyStep16ReceiptBindingDurableJournalAgainstBrokerLedgerInternalV1,
  type Step16ReceiptBindingBrokerLedgerEntryInternalV1,
  type Step16ReceiptBindingBrokerLedgerViewInternalV1,
  type Step16ReceiptBindingJournalArmInternalV1,
  type Step16ReceiptBindingJournalBaselineInternalV1,
  type Step16ReceiptBindingJournalCapabilityInternalV1,
  type Step16ReceiptBindingJournalCompletionInternalV1,
  type Step16ReceiptBindingJournalDurabilityHooksInternalV1,
  type Step16ReceiptBindingJournalExpectedOperationInternalV1,
  type Step16ReceiptBindingJournalStateInternalV1,
} from "./step16-receipt-binding-journal-internal.js";
import {
  abortProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1,
  appendExpectedOperationProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1,
  beginCollectingProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1,
  beginProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1,
  completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1,
  createProviderProductionStrongAuthorityServiceCoreInternalV1,
  exportProviderProductionStrongAuthorityResolvedReceiptBundlesInternalV1,
  type BeginCollectingProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1Input,
  type BeginProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1Input,
  type OpenedProviderProductionStrongAuthorityServiceInternalV1,
  type ProviderProductionStrongAuthorityReceiptExportCapabilityInternalV1,
  type ProviderProductionStrongAuthorityStep16ProviderReceiptBindingInternalV1,
  type ProviderProductionStrongAuthorityStep16ExpectedOperationInternalV1,
  type ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1,
  type ProviderProductionStrongAuthorityStep16TrustedProviderIdentityInternalV1,
  type ProviderProductionStrongAuthorityTrustedHostCallWitnessCapabilityInternalV1,
  type ProviderProductionStrongAuthorityTrustedHostCallWitnessInternalV1,
} from "./provider-production-strong-authority-service.js";
import {
  classifyProviderStrongMutationBrokerAdmissionInternalV1,
  exportProviderStrongMutationBrokerResolvedReceiptBundlesInternalV1,
  inspectProviderStrongMutationBrokerSnapshotWithLayoutCoreInternalV1,
  openProviderStrongMutationBrokerStoreWithExecutionFenceAndLayoutCoreInternalV1,
  openProviderStrongMutationBrokerStoreWithLayoutCoreInternalV1,
  type ProviderStrongMutationBrokerAdmissionInputInternalV1,
  type ProviderStrongMutationBrokerAdmissionResultInternalV1,
  type ProviderStrongMutationBrokerResolvedReceiptBundleInternalV1,
  type ProviderStrongMutationBrokerStoreInternalV1,
} from "./strong-mutation-broker-core-internal.js";
import {
  registerProviderStrongMutationLinuxExt4ExecutionFenceForTestInternalV1,
  type ProviderStrongMutationExecutionFenceCapabilityInternalV1,
  type RegisterProviderStrongMutationLinuxExt4ExecutionFenceInputInternalV1,
} from "./strong-mutation-execution-fence-internal.js";
import {
  createProviderStrongMutationProductionSessionCallbacksInternalV1,
  type ProviderStrongMutationProductionSessionCallbacksInternalV1,
} from "./strong-mutation-production-session-internal.js";
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
  bindNativeSafeGitEmptyHooksDirectoryV1,
  bindNativeSafeGitExecutableV1,
  closeNativeSafeGitDescriptorBootstrapV1,
  deriveNativeSafeGitPathIdentityV1,
  type NativeSafeGitDescriptorBindingV1,
  type NativeSafeGitEmptyHooksDirectoryBindingV1,
  type NativeSafeGitExecutableBindingInspectionV1,
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
const TEST_TRUSTED_HOST_CALL_WITNESSES_V1 = new WeakMap<
  object,
  ProviderProductionStrongAuthorityTrustedHostCallWitnessInternalV1
>();

function openTrustedHostCallWitnessForTestInternalV1(
  witness:
    ProviderProductionStrongAuthorityTrustedHostCallWitnessCapabilityInternalV1,
): ProviderProductionStrongAuthorityTrustedHostCallWitnessInternalV1 | undefined {
  const opened = TEST_TRUSTED_HOST_CALL_WITNESSES_V1.get(witness as object);
  if (opened !== undefined) {
    TEST_TRUSTED_HOST_CALL_WITNESSES_V1.delete(witness as object);
  }
  return opened;
}

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
    legacyWithoutEmptyHooksDirectoryBinding?: boolean;
  }>,
): Promise<void> {
  return provisionProviderAcceptanceInstallationIdentityForTestInternalV1(
    requireCapabilityV1(capability),
    input,
  );
}

export async function bindProviderAcceptanceSafeGitEmptyHooksDirectoryForTestInternalV1(
  capability: ProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  binding: NativeSafeGitDescriptorBindingV1,
): Promise<NativeSafeGitEmptyHooksDirectoryBindingV1> {
  try {
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
    return await identity.withKey(async (key, authority, expected) => {
      if (expected === undefined) {
        throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
      }
      const actual = bindNativeSafeGitEmptyHooksDirectoryV1(
        binding,
        authority,
        key,
      );
      if (
        actual.profile !== "native_safe_git_empty_hooks_binding_v1" ||
        actual.directoryIdentity.platform !==
          expected.directoryIdentity.platform ||
        actual.directoryIdentity.device !== expected.directoryIdentity.device ||
        actual.directoryIdentity.inode !== expected.directoryIdentity.inode ||
        actual.emptyHooksDirectoryToken !== expected.emptyHooksDirectoryToken
      ) {
        throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
      }
      return actual;
    });
  } catch {
    try {
      closeNativeSafeGitDescriptorBootstrapV1(binding);
    } catch {
      // The redacted custody failure remains authoritative.
    }
    throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
  }
}

export async function bindProviderAcceptanceSafeGitExecutableForTestInternalV1(
  capability: ProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  binding: NativeSafeGitDescriptorBindingV1,
  absoluteExecutablePath: string,
): Promise<NativeSafeGitExecutableBindingInspectionV1> {
  try {
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
    return await identity.withKey(async (key, authority, expected) => {
      if (expected === undefined) {
        throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
      }
      const actual = bindNativeSafeGitExecutableV1(
        binding,
        authority,
        key,
        absoluteExecutablePath,
      );
      const keys = Object.keys(actual).sort();
      if (
        keys.length !== 2 ||
        keys[0] !== "executableBinding" ||
        keys[1] !== "profile" ||
        actual.profile !== "native_safe_git_executable_binding_v1" ||
        actual.executableBinding !== "verified" ||
        !Object.isFrozen(actual)
      ) {
        throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
      }
      return actual;
    });
  } catch {
    try {
      closeNativeSafeGitDescriptorBootstrapV1(binding);
    } catch {
      // The fixed, path-redacted custody failure remains authoritative.
    }
    throw new ProviderAcceptanceAuthorityErrorV1("identity_key_invalid");
  }
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

export async function observeProviderAcceptanceAuthorityLockTurnoverWithTestLayoutInternalV1(
  capability: ProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  testOnlyAfterPinnedRead: () => void | Promise<void>,
): Promise<"absent" | "contended" | "stable"> {
  requireTestProcessV1();
  const layout = requireCapabilityV1(capability);
  const identity =
    await openOrInitializeProviderAcceptanceInstallationIdentityInternalV1(
      layout,
    );
  return identity.withKey((key) =>
    observeProviderAcceptanceAuthorityLockTurnoverForTestInternalV1(
      layout,
      key,
      testOnlyAfterPinnedRead,
    )
  );
}

export function waitForProviderAcceptanceAuthorityLockReleasePollWithTestLayoutInternalV1(
  capability: ProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  testOnlyAfterPresentReobserve: () => void,
): Promise<void> {
  requireTestProcessV1();
  return waitForProviderAcceptanceAuthorityLockReleasePollForTestInternalV1(
    requireCapabilityV1(capability),
    testOnlyAfterPresentReobserve,
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

export function registerProviderStrongMutationLinuxExt4ExecutionFenceTestCapabilityInternalV1(
  input: RegisterProviderStrongMutationLinuxExt4ExecutionFenceInputInternalV1,
): ProviderStrongMutationExecutionFenceCapabilityInternalV1 {
  requireTestProcessV1();
  return registerProviderStrongMutationLinuxExt4ExecutionFenceForTestInternalV1(
    input,
  );
}

export function openProviderStrongMutationExecutionBrokerStoreForTestInternalV1(
  capability: ProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  verifierCapability:
    ProviderStrongMutationTrustVerifierCapabilityInternalV1,
  executionFenceCapability:
    ProviderStrongMutationExecutionFenceCapabilityInternalV1,
  options: ProviderAcceptanceAuthorityStoreOpenOptionsInternalV1 = {},
): Promise<ProviderStrongMutationBrokerStoreInternalV1> {
  requireTestProcessV1();
  return openProviderStrongMutationBrokerStoreWithExecutionFenceAndLayoutCoreInternalV1(
    requireCapabilityV1(capability),
    verifierCapability,
    executionFenceCapability,
    options,
  );
}

export function createProviderStrongMutationProductionSessionCallbacksForTestInternalV1(
  broker: ProviderStrongMutationBrokerStoreInternalV1,
): ProviderStrongMutationProductionSessionCallbacksInternalV1 {
  requireTestProcessV1();
  return createProviderStrongMutationProductionSessionCallbacksInternalV1(
    broker,
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

export function exportProviderStrongMutationBrokerResolvedReceiptBundlesForTestInternalV1(
  broker: ProviderStrongMutationBrokerStoreInternalV1,
): Promise<
  readonly ProviderStrongMutationBrokerResolvedReceiptBundleInternalV1[]
> {
  requireTestProcessV1();
  return exportProviderStrongMutationBrokerResolvedReceiptBundlesInternalV1(
    broker,
  );
}

export function openStep16ReceiptBindingDurableJournalForTestInternalV1(
  capability: ProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  hooks: Step16ReceiptBindingJournalDurabilityHooksInternalV1 = {},
): Promise<Step16ReceiptBindingJournalCapabilityInternalV1> {
  requireTestProcessV1();
  return openStep16ReceiptBindingDurableJournalWithLayoutCoreInternalV1(
    requireCapabilityV1(capability),
    hooks,
  );
}

export function inspectStep16ReceiptBindingDurableJournalForTestInternalV1(
  capability: Step16ReceiptBindingJournalCapabilityInternalV1,
): Promise<Step16ReceiptBindingJournalStateInternalV1 | undefined> {
  requireTestProcessV1();
  return inspectStep16ReceiptBindingDurableJournalInternalV1(capability);
}

export function armStep16ReceiptBindingDurableJournalForTestInternalV1(
  capability: Step16ReceiptBindingJournalCapabilityInternalV1,
  input: Step16ReceiptBindingJournalArmInternalV1,
): Promise<void> {
  requireTestProcessV1();
  return armStep16ReceiptBindingDurableJournalInternalV1(capability, input);
}

export function appendStep16ReceiptBindingExpectedOperationDurableForTestInternalV1(
  capability: Step16ReceiptBindingJournalCapabilityInternalV1,
  input: Step16ReceiptBindingJournalExpectedOperationInternalV1,
): Promise<void> {
  requireTestProcessV1();
  return appendStep16ReceiptBindingExpectedOperationDurableInternalV1(
    capability,
    input,
  );
}

export function completeStep16ReceiptBindingDurableJournalForTestInternalV1(
  capability: Step16ReceiptBindingJournalCapabilityInternalV1,
  input: Step16ReceiptBindingJournalCompletionInternalV1,
): Promise<void> {
  requireTestProcessV1();
  return completeStep16ReceiptBindingDurableJournalInternalV1(
    capability,
    input,
  );
}

export function finalizeStep16ReceiptBindingDurableJournalForTestInternalV1(
  capability: Step16ReceiptBindingJournalCapabilityInternalV1,
): Promise<void> {
  requireTestProcessV1();
  return finalizeStep16ReceiptBindingDurableJournalInternalV1(capability);
}

export function abortStep16ReceiptBindingDurableJournalForTestInternalV1(
  capability: Step16ReceiptBindingJournalCapabilityInternalV1,
): Promise<void> {
  requireTestProcessV1();
  return abortStep16ReceiptBindingDurableJournalInternalV1(capability);
}

export function verifyStep16ReceiptBindingDurableJournalAgainstBrokerLedgerForTestInternalV1(
  capability: Step16ReceiptBindingJournalCapabilityInternalV1,
  input: Step16ReceiptBindingBrokerLedgerViewInternalV1,
): Promise<void> {
  requireTestProcessV1();
  return verifyStep16ReceiptBindingDurableJournalAgainstBrokerLedgerInternalV1(
    capability,
    input,
  );
}

export function deriveStep16ReceiptBindingOrderedPrefixDigestForTestInternalV1(
  entries: readonly Step16ReceiptBindingBrokerLedgerEntryInternalV1[],
): string {
  requireTestProcessV1();
  return deriveStep16ReceiptBindingOrderedPrefixDigestInternalV1(entries);
}

export function createProviderProductionStrongAuthorityServiceForTestInternalV1(
  broker: ProviderStrongMutationBrokerStoreInternalV1,
  trustedProviderIdentity:
    ProviderProductionStrongAuthorityStep16TrustedProviderIdentityInternalV1,
  lifecycle: Readonly<{
    readonly closeServer?: () => Promise<void>;
    readonly closeExactObjectAuthority?: () => Promise<void>;
    readonly enableTrustedHostCallWitnesses?: boolean;
  }> = {},
): OpenedProviderProductionStrongAuthorityServiceInternalV1 {
  requireTestProcessV1();
  return createProviderProductionStrongAuthorityServiceCoreInternalV1(
    broker,
    trustedProviderIdentity,
    lifecycle.closeServer ?? (async () => undefined),
    lifecycle.closeExactObjectAuthority ?? (async () => undefined),
    lifecycle.enableTrustedHostCallWitnesses === false
      ? undefined
      : openTrustedHostCallWitnessForTestInternalV1,
  );
}

export function exportProviderProductionStrongAuthorityResolvedReceiptBundlesForTestInternalV1(
  capability:
    ProviderProductionStrongAuthorityReceiptExportCapabilityInternalV1,
): Promise<
  readonly ProviderStrongMutationBrokerResolvedReceiptBundleInternalV1[]
> {
  requireTestProcessV1();
  return exportProviderProductionStrongAuthorityResolvedReceiptBundlesInternalV1(
    capability,
  );
}

export function beginProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
  capability:
    ProviderProductionStrongAuthorityReceiptExportCapabilityInternalV1,
  input:
    BeginProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1Input,
): Promise<
  ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1
> {
  requireTestProcessV1();
  return beginProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1(
    capability,
    input,
  );
}

export function beginCollectingProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
  capability:
    ProviderProductionStrongAuthorityReceiptExportCapabilityInternalV1,
  input:
    BeginCollectingProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1Input,
): Promise<
  ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1
> {
  requireTestProcessV1();
  return beginCollectingProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1(
    capability,
    input,
  );
}

export function appendExpectedOperationProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
  capability:
    ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1,
  operation:
    ProviderProductionStrongAuthorityStep16ExpectedOperationInternalV1,
): Promise<void> {
  requireTestProcessV1();
  return appendExpectedOperationProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1(
    capability,
    operation,
  );
}

export function completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
  capability:
    ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1,
  witness:
    ProviderProductionStrongAuthorityTrustedHostCallWitnessCapabilityInternalV1,
): Promise<
  readonly ProviderProductionStrongAuthorityStep16ProviderReceiptBindingInternalV1[]
> {
  requireTestProcessV1();
  return completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1(
    capability,
    witness,
  );
}

export function abortProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
  capability:
    ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1,
): Promise<void> {
  requireTestProcessV1();
  return abortProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1(
    capability,
  );
}

export function mintProviderProductionStrongAuthorityTrustedHostCallWitnessForTestInternalV1(
  input: ProviderProductionStrongAuthorityTrustedHostCallWitnessInternalV1,
): ProviderProductionStrongAuthorityTrustedHostCallWitnessCapabilityInternalV1 {
  requireTestProcessV1();
  const opened = Object.freeze({
    host: input.host,
    sessionIdDigest: input.sessionIdDigest,
    callIdDigest: input.callIdDigest,
    expectedProviderOperations: Object.freeze(
      input.expectedProviderOperations.map((operation) =>
        Object.freeze({
          operation: operation.operation,
          operationNonce: operation.operationNonce,
          requestDigest: operation.requestDigest,
        })
      ),
    ),
  });
  const witness = Object.freeze(Object.create(null)) as
    ProviderProductionStrongAuthorityTrustedHostCallWitnessCapabilityInternalV1;
  TEST_TRUSTED_HOST_CALL_WITNESSES_V1.set(witness, opened);
  return witness;
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
  ProviderStrongMutationBrokerResolvedReceiptBundleInternalV1,
  ProviderProductionStrongAuthorityReceiptExportCapabilityInternalV1,
  ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1,
  ProviderProductionStrongAuthorityStep16ProviderReceiptBindingInternalV1,
  ProviderProductionStrongAuthorityStep16TrustedProviderIdentityInternalV1,
  ProviderProductionStrongAuthorityTrustedHostCallWitnessCapabilityInternalV1,
  ProviderProductionStrongAuthorityTrustedHostCallWitnessInternalV1,
  BeginProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1Input,
  ProviderStrongMutationExecutionFenceCapabilityInternalV1,
  RegisterProviderStrongMutationLinuxExt4ExecutionFenceInputInternalV1,
  ProviderStrongMutationProductionSessionCallbacksInternalV1,
  Step16ReceiptBindingBrokerLedgerEntryInternalV1,
  Step16ReceiptBindingBrokerLedgerViewInternalV1,
  Step16ReceiptBindingJournalArmInternalV1,
  Step16ReceiptBindingJournalBaselineInternalV1,
  Step16ReceiptBindingJournalCapabilityInternalV1,
  Step16ReceiptBindingJournalCompletionInternalV1,
  Step16ReceiptBindingJournalDurabilityHooksInternalV1,
  Step16ReceiptBindingJournalExpectedOperationInternalV1,
  Step16ReceiptBindingJournalStateInternalV1,
};
