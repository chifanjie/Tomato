import { z } from "./zod-runtime.js";

import {
  deriveProviderBootstrapTrustBundleContentDigestV1,
  ProviderBootstrapTrustBundleV1Schema,
  type ProviderBootstrapTrustBundleV1,
} from "./bootstrap-trust-bundle.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  ProviderFeasibilityEvidenceIdV1Schema,
  type ContentDigestV1,
  type InstallationIdentityGenerationIdV1,
} from "./primitives.js";
import {
  buildProviderFeasibilityEvidenceRelativePathV1,
  compareProviderFeasibilityEvidenceTimestampsV1,
  ProviderFeasibilityEvidenceEnvelopeV1Schema,
  ProviderFeasibilityEvidenceUnsignedClaimsV1Schema,
  type ProviderFeasibilityEvidenceEnvelopeV1,
  type ProviderFeasibilityEvidenceRelativePathV1,
  type ProviderFeasibilityEvidenceV1,
} from "./provider-feasibility-evidence-point.js";
import {
  createProviderFeasibilityEvidenceQaSignatureMessageFromPreparedPayloadInternalV1,
  createProviderFeasibilityEvidenceReleaseSignatureMessageFromPreparedPayloadInternalV1,
  deriveProviderFeasibilityEvidenceContentDigestFromPreparedPayloadInternalV1,
  deriveProviderFeasibilityEvidenceIdFromPreparedPayloadInternalV1,
  parseProviderFeasibilityEvidenceSignatureBindingInternalV1,
  type PreparedProviderFeasibilityEvidenceSignatureBindingV1,
} from "./provider-feasibility-evidence-point-internal.js";
import {
  captureProviderPointRawObservedDenseArrayV1,
  captureProviderPointDetachedExactDataObjectV1,
  captureProviderPointRawExactTopLevelV1,
  cloneProviderPointRawAdmissionCapsuleV1,
  countProviderPointRawAdmissionBudgetAdditionalRootV1,
  countProviderPointRawAdmissionBudgetRootV1,
  createProviderPointRawAdmissionBudgetForSessionV1,
  createProviderPointRawAdmissionBudgetForSessionObservedForTestV1,
  createProviderPointRawAdmissionSessionV1,
  deepFreezeProviderPointDetachedDataTreeV1,
  exerciseProviderPointRawAdmissionAllocationCapForTestV1,
  getProviderPointRawAdmissionAllocationLedgerForTestV1,
  getProviderPointRawAdmissionBudgetLedgerForTestV1,
  observeProviderPointRawObjectIdentityV1,
  walkProviderPointRawJsonIdentityTreeV1,
  walkProviderPointRawObservedJsonIdentityTreeWithDualBudgetsV1,
  type ProviderPointRawAdmissionSessionV1,
} from "./provider-point-raw-admission-internal.js";
import {
  createProviderNonThenableFrozenRecordV1,
  createProviderPointFulfilledPromiseV1,
  createProviderPointRejectedPromiseV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import {
  ProviderBootstrapTrustBundlePinV1Schema,
  ProviderSignedDistributionRootBindingV1Schema,
} from "./provider-distribution-trust.js";
import {
  type ProviderRegistryManifestHistoryValidationV1,
  type ValidateProviderRegistryManifestHistoryV1Input,
} from "./provider-registry-manifest-history.js";
import {
  createPreparedRegistryHistorySnapshotInternalV1,
  diagnoseProviderRegistryManifestHistoryPreparedInternalV1,
  discardPreparedRegistryHistoryInputInternalV1,
  discardRegistryHistoryVerifiedWitnessInternalV1,
  registerPreparedRegistryHistoryInputInternalV1,
  type PreparedRegistryHistoryInputHandleV1,
  type RegistryTrustWitnessHandleV1,
} from "./provider-registry-history-prepared-internal.js";
import {
  completeProviderRegistryEvidenceBindingBudgetReplayForTestV1,
  readProviderRegistryEvidenceBindingBudgetRecipeForTestV1,
  recordProviderRegistryEvidenceBindingStringBudgetForTestV1,
  takeProviderRegistryEvidenceBindingBudgetReplayForTestV1,
  type ProviderRegistryEvidenceBindingBudgetReplayTokenForTestV1,
} from "./provider-registry-evidence-binding-point-budget-test-seam-internal.js";
import {
  ProviderFeasibilityEvidencePinV1Schema,
  type ProviderFeasibilityApproverPublicKeyV1,
  type ProviderFeasibilityEvidencePinV1,
  type ProviderRegistryManifestEnvelopeV1,
  type ProviderRegistryManifestMemberV1,
  type StoreDurableObjectProviderRegistryEntryV1,
} from "./provider-registry-records.js";
import type { ProviderRealFilesystemConformanceResultEnvelopeV1 } from "./provider-real-filesystem-conformance-result.js";
import {
  ProviderRegistryRootMetadataEnvelopeV1Schema,
  ProviderRegistryRootMetadataPinV1Schema,
  ProviderRegistryRootPublicKeyV1Schema,
  type ProviderRegistryRootMetadataEnvelopeV1,
  type ProviderRegistryRootPublicKeyV1,
} from "./provider-registry-trust.js";
import "./provider-runtime-attestation-point.js";
import {
  type ProviderRuntimeAttestationPointClosureValidationV1,
  type ValidateProviderRuntimeAttestationPointClosureV1Input,
} from "./provider-runtime-attestation-point.js";
import {
  diagnoseProviderRuntimeAttestationPointFromRegistryHistoryInternalV1,
} from "./provider-runtime-attestation-point-internal.js";
import {
  assertProviderStrictEd25519CryptoCapabilityIdentityV1,
} from "./strict-ed25519-capability-internal.js";
import {
  ProviderStrictEd25519AttestationError,
  verifyRawEd25519WithCapabilityV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "./strict-ed25519-conformance.js";

const CapturedObjectFreezeV1 = Object.freeze;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedStringPrototypeIndexOfV1 = String.prototype.indexOf;
const CapturedStringPrototypeSliceV1 = String.prototype.slice;
const CapturedStringV1 = String;
const CapturedUint8ArrayV1 = Uint8Array;
const CapturedTypeErrorV1 = TypeError;

/**
 * C09-1L closes only the supplied-history Entry/Evidence candidate boundary.
 * The authority literal intentionally cannot authorize current selection,
 * registration, production readiness, strong writes, or release.
 */
export const PROVIDER_REGISTRY_EVIDENCE_BINDING_AUTHORITY_V1 =
  "none_registry_entry_evidence_binding_structure_only" as const;

export const MAX_C09_1L_OBSERVED_IDENTITIES_V1 = 4_194_304;
export const MAX_C09_1L_PRECLONE_ALLOCATION_WORK_UNITS_V1 = 268_435_456;
export const MAX_C09_1L_ROOT_METADATA_HISTORY_GENERATIONS_V1 = 256;
export const MAX_C09_1L_REGISTRY_MANIFEST_HISTORY_GENERATIONS_V1 = 4_096;
export const MAX_C09_1L_TRUST_ENVELOPE_RAW_UNITS_V1 = 4_194_304;
export const MAX_C09_1L_DISTRIBUTION_RAW_UNITS_V1 = 16_777_216;
export const MAX_C09_1L_RETAINED_TRUST_HISTORY_RAW_UNITS_V1 = 268_435_456;
export const MAX_C09_1L_RAW_DEPTH_V1 = 64;

export const ProviderRegistryEvidenceBindingPointInvalidStageV1Schema = z.enum([
  "input",
  "bootstrap_distribution_binding",
  "evidence_structure",
  "evidence_pin_structure",
  "registry_history_closure",
  "candidate_root_binding",
  "candidate_member_resolution",
  "registry_evidence_pin_binding",
  "registry_runtime_binding",
  "runtime_attestation_closure",
  "registry_policy_binding",
  "evidence_result_binding",
  "production_result_gate",
  "evidence_policy_binding",
  "evidence_runtime_binding",
  "evidence_time",
  "evidence_id",
  "evidence_qa_signature_binding",
  "evidence_release_signature_binding",
  "qa_approver_resolution",
  "release_approver_resolution",
  "evidence_qa_signature",
  "evidence_release_signature",
  "evidence_digest",
  "evidence_envelope",
  "evidence_pin",
]);
export type ProviderRegistryEvidenceBindingPointInvalidStageV1 = z.infer<
  typeof ProviderRegistryEvidenceBindingPointInvalidStageV1Schema
>;

export const ProviderRegistryEvidenceBindingPointInvalidReasonV1Schema = z.enum([
  "schema_invalid",
  "source_invalid",
  "identity_mismatch",
  "root_mismatch",
  "member_not_enabled",
  "routing_invalid",
  "binding_mismatch",
  "digest_mismatch",
  "pin_mismatch",
  "result_not_passed",
  "approver_not_found",
  "approver_revoked",
  "signature_invalid",
  "ordering_invalid",
  "envelope_mismatch",
]);
export type ProviderRegistryEvidenceBindingPointInvalidReasonV1 = z.infer<
  typeof ProviderRegistryEvidenceBindingPointInvalidReasonV1Schema
>;

const PreparedProviderFeasibilityEvidencePayloadV1Schema = z.strictObject({
  ...ProviderFeasibilityEvidenceUnsignedClaimsV1Schema.shape,
  qaSignature: z.string(),
  releaseSignature: z.string(),
});
type PreparedProviderFeasibilityEvidencePayloadV1 = z.infer<
  typeof PreparedProviderFeasibilityEvidencePayloadV1Schema
>;

const PreparedProviderFeasibilityEvidenceEnvelopeV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  recordType: z.literal("provider_feasibility_evidence"),
  evidenceId: ProviderFeasibilityEvidenceIdV1Schema,
  contentDigest: ContentDigestV1Schema,
  payload: PreparedProviderFeasibilityEvidencePayloadV1Schema,
});
type PreparedProviderFeasibilityEvidenceEnvelopeV1 = z.infer<
  typeof PreparedProviderFeasibilityEvidenceEnvelopeV1Schema
>;

export interface ValidateProviderRegistryEvidenceBindingPointClosureV1Input
  extends ValidateProviderRuntimeAttestationPointClosureV1Input {
  readonly bootstrapTrustBundle: ProviderBootstrapTrustBundleV1;
  readonly installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  readonly providerFeasibilityEvidence: ProviderFeasibilityEvidenceEnvelopeV1;
  readonly providerFeasibilityEvidencePin: ProviderFeasibilityEvidencePinV1;
  readonly registryManifestHistory: readonly ProviderRegistryManifestEnvelopeV1[];
  readonly rootMetadataHistory: readonly ProviderRegistryRootMetadataEnvelopeV1[];
}

export interface ProviderRegistryEvidenceBindingPointClosureValidationV1 {
  readonly authority: typeof PROVIDER_REGISTRY_EVIDENCE_BINDING_AUTHORITY_V1;
  readonly registryManifestHistoryClosure: ProviderRegistryManifestHistoryValidationV1;
  readonly runtimeAttestationPointClosure: ProviderRuntimeAttestationPointClosureValidationV1;
  readonly candidateRegistryEntryContentDigest: ContentDigestV1;
  readonly candidateRegistryEntry: StoreDurableObjectProviderRegistryEntryV1;
  readonly providerFeasibilityEvidence: ProviderFeasibilityEvidenceEnvelopeV1;
  readonly providerFeasibilityEvidencePin: ProviderFeasibilityEvidencePinV1;
  readonly relativePath: ProviderFeasibilityEvidenceRelativePathV1;
  readonly qaApproverPublicKey: ProviderFeasibilityApproverPublicKeyV1;
  readonly releaseApproverPublicKey: ProviderFeasibilityApproverPublicKeyV1;
}

interface ProviderRegistryEvidenceBindingPointDiagnosticFailureV1 {
  readonly ok: false;
  readonly stage: ProviderRegistryEvidenceBindingPointInvalidStageV1;
  readonly reason: ProviderRegistryEvidenceBindingPointInvalidReasonV1;
}

interface ProviderRegistryEvidenceBindingPointDiagnosticSuccessV1 {
  readonly ok: true;
  readonly value: ProviderRegistryEvidenceBindingPointClosureValidationV1;
}

export type ProviderRegistryEvidenceBindingPointClosureDiagnosticResultV1 =
  | ProviderRegistryEvidenceBindingPointDiagnosticFailureV1
  | ProviderRegistryEvidenceBindingPointDiagnosticSuccessV1;

export class ProviderRegistryEvidenceBindingPointClosureValidationError extends Error {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super("Provider registry Entry/Evidence binding point validation failed");
    this.name = "ProviderRegistryEvidenceBindingPointClosureValidationError";
    CapturedObjectFreezeV1(this);
  }
}

class ProviderRegistryEvidenceBindingDiagnosticSignalV1 extends Error {
  constructor(
    readonly stage: ProviderRegistryEvidenceBindingPointInvalidStageV1,
    readonly reason: ProviderRegistryEvidenceBindingPointInvalidReasonV1,
  ) {
    super("provider registry Entry/Evidence binding diagnostic");
  }
}

function failBindingPointV1(
  stage: ProviderRegistryEvidenceBindingPointInvalidStageV1,
  reason: ProviderRegistryEvidenceBindingPointInvalidReasonV1,
): never {
  throw new ProviderRegistryEvidenceBindingDiagnosticSignalV1(stage, reason);
}

const POINT_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "activeRoot",
  "activeRootMetadata",
  "bootstrapTrustBundle",
  "distributionRootBinding",
  "fixtureCorpusManifest",
  "installationIdentityGenerationId",
  "providerFeasibilityEvidence",
  "providerFeasibilityEvidencePin",
  "publicSupportTaxonomy",
  "realFilesystemConformanceResult",
  "realFilesystemConformanceResultLocator",
  "realFilesystemConformanceResultPin",
  "registryManifestHistory",
  "releaseMatrix",
  "rootMetadataHistory",
  "runtimeAttestation",
  "semanticProviderPolicy",
  "strictCryptoCapability",
  "suiteManifest",
  "targetDiscoveryFixtureManifest",
  "targetDiscoveryResult",
  "targetDiscoveryRunnerRun",
] as const);

const JSON_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "activeRoot",
  "activeRootMetadata",
  "bootstrapTrustBundle",
  "distributionRootBinding",
  "fixtureCorpusManifest",
  "installationIdentityGenerationId",
  "providerFeasibilityEvidence",
  "providerFeasibilityEvidencePin",
  "publicSupportTaxonomy",
  "realFilesystemConformanceResult",
  "realFilesystemConformanceResultLocator",
  "realFilesystemConformanceResultPin",
  "registryManifestHistory",
  "releaseMatrix",
  "rootMetadataHistory",
  "runtimeAttestation",
  "semanticProviderPolicy",
  "suiteManifest",
  "targetDiscoveryFixtureManifest",
  "targetDiscoveryResult",
  "targetDiscoveryRunnerRun",
] as const);

type PointInputKeyV1 = (typeof POINT_INPUT_KEYS_V1)[number];
type DetachedPointFieldsV1 = Record<PointInputKeyV1, unknown>;

interface PreparedProviderRegistryEvidenceBindingPointInputV1 {
  readonly fields: DetachedPointFieldsV1;
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
  readonly registryRequest: ValidateProviderRegistryManifestHistoryV1Input;
  readonly registryInputHandle: PreparedRegistryHistoryInputHandleV1;
}

interface CandidateRegistryMemberResolutionV1 {
  readonly member: Extract<ProviderRegistryManifestMemberV1, { disposition: "enabled" }>;
  readonly entry: StoreDurableObjectProviderRegistryEntryV1;
}

function bindUncurriedBindingIntrinsicV1(method: Function): Function {
  const argumentsList = CapturedObjectFreezeV1([method]);
  return CapturedObjectFreezeV1(
    CapturedReflectApplyV1(
      CapturedFunctionPrototypeBindV1,
      CapturedFunctionPrototypeCallV1,
      argumentsList,
    ) as Function,
  );
}

const stringIndexOfV1 = bindUncurriedBindingIntrinsicV1(
  CapturedStringPrototypeIndexOfV1,
) as (receiver: string, search: string, position?: number) => number;
const stringSliceV1 = bindUncurriedBindingIntrinsicV1(
  CapturedStringPrototypeSliceV1,
) as (receiver: string, start?: number, end?: number) => string;

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  const leftBytes = canonicalizeJcsSafeIntegerUtf8V1(left);
  const rightBytes = canonicalizeJcsSafeIntegerUtf8V1(right);
  if (leftBytes.byteLength !== rightBytes.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.byteLength; index += 1) {
    difference |= leftBytes[index]! ^ rightBytes[index]!;
  }
  return difference === 0;
}

function createRawBudgetV1(
  admission: ProviderPointRawAdmissionSessionV1,
  maxUnits: number,
  observeStringChargesForTest = false,
) {
  const createBudget = observeStringChargesForTest
    ? createProviderPointRawAdmissionBudgetForSessionObservedForTestV1
    : createProviderPointRawAdmissionBudgetForSessionV1;
  return createBudget(
    admission,
    MAX_C09_1L_RAW_DEPTH_V1,
    maxUnits,
    maxUnits,
    maxUnits,
  );
}

function preflightRawHistoryV1(
  admission: ProviderPointRawAdmissionSessionV1,
  history: unknown,
  maxLength: number,
  aggregateBudget: ReturnType<
    typeof createProviderPointRawAdmissionBudgetForSessionV1
  >,
  additionalAggregateRoot: boolean,
): void {
  if (additionalAggregateRoot) {
    countProviderPointRawAdmissionBudgetAdditionalRootV1(
      aggregateBudget,
      history,
    );
  } else {
    countProviderPointRawAdmissionBudgetRootV1(aggregateBudget, history);
  }
  const historyToken = observeProviderPointRawObjectIdentityV1(
    admission,
    history,
  );
  const captured = captureProviderPointRawObservedDenseArrayV1(
    admission,
    historyToken,
    maxLength,
    aggregateBudget,
    1,
  );
  for (let index = 0; index < captured.length; index += 1) {
    const indexKey = CapturedStringV1(index);
    const item = captured.items[indexKey];
    const token = captured.itemTokens[indexKey];
    if (item === undefined || token === undefined) {
      return failBindingPointV1("input", "schema_invalid");
    }
    const envelopeBudget = createRawBudgetV1(
      admission,
      MAX_C09_1L_TRUST_ENVELOPE_RAW_UNITS_V1,
    );
    countProviderPointRawAdmissionBudgetRootV1(envelopeBudget, item);
    walkProviderPointRawObservedJsonIdentityTreeWithDualBudgetsV1(
      admission,
      token,
      envelopeBudget,
      aggregateBudget,
    );
  }
}

function preflightRawJsonBranchesV1(
  admission: ProviderPointRawAdmissionSessionV1,
  fields: Readonly<Record<string, unknown>>,
  budgetReplayToken?: ProviderRegistryEvidenceBindingBudgetReplayTokenForTestV1,
): void {
  const budgetRecipe =
    budgetReplayToken === undefined
      ? undefined
      : readProviderRegistryEvidenceBindingBudgetRecipeForTestV1(
          budgetReplayToken,
        );
  const observeHistoryAggregate = budgetRecipe?.budget === "history_bh";
  const retainedHistoryAggregateBudget =
    (observeHistoryAggregate
      ? createProviderPointRawAdmissionBudgetForSessionObservedForTestV1
      : createProviderPointRawAdmissionBudgetForSessionV1)(
      admission,
      MAX_C09_1L_RAW_DEPTH_V1 + 1,
      MAX_C09_1L_RETAINED_TRUST_HISTORY_RAW_UNITS_V1,
      MAX_C09_1L_RETAINED_TRUST_HISTORY_RAW_UNITS_V1,
      MAX_C09_1L_RETAINED_TRUST_HISTORY_RAW_UNITS_V1,
    );
  let observedBranchBudget: ReturnType<typeof createRawBudgetV1> | undefined;
  let sawRetainedHistoryRoot = false;
  try {
    for (let index = 0; index < JSON_INPUT_KEYS_V1.length; index += 1) {
      const key = JSON_INPUT_KEYS_V1[index]!;
      const value = fields[key];
      if (key === "rootMetadataHistory") {
        preflightRawHistoryV1(
          admission,
          value,
          MAX_C09_1L_ROOT_METADATA_HISTORY_GENERATIONS_V1,
          retainedHistoryAggregateBudget,
          sawRetainedHistoryRoot,
        );
        sawRetainedHistoryRoot = true;
        continue;
      }
      if (key === "registryManifestHistory") {
        preflightRawHistoryV1(
          admission,
          value,
          MAX_C09_1L_REGISTRY_MANIFEST_HISTORY_GENERATIONS_V1,
          retainedHistoryAggregateBudget,
          sawRetainedHistoryRoot,
        );
        sawRetainedHistoryRoot = true;
        continue;
      }
      if (value === null || typeof value !== "object") {
        if (
          key !== "installationIdentityGenerationId" ||
          typeof value !== "string" ||
          value.length > MAX_C09_1L_DISTRIBUTION_RAW_UNITS_V1
        ) {
          return failBindingPointV1("input", "schema_invalid");
        }
        continue;
      }
      const maxUnits =
        key === "bootstrapTrustBundle" ||
        key === "providerFeasibilityEvidence"
          ? MAX_C09_1L_TRUST_ENVELOPE_RAW_UNITS_V1
          : MAX_C09_1L_DISTRIBUTION_RAW_UNITS_V1;
      const observeBranch =
        key === "bootstrapTrustBundle" &&
        (budgetRecipe?.budget === "value_b" ||
          budgetRecipe?.budget === "key_b");
      const branchBudget = createRawBudgetV1(
        admission,
        maxUnits,
        observeBranch,
      );
      if (observeBranch) observedBranchBudget = branchBudget;
      walkProviderPointRawJsonIdentityTreeV1(admission, value, branchBudget);
    }
  } finally {
    const observedBudget = observeHistoryAggregate
      ? retainedHistoryAggregateBudget
      : observedBranchBudget;
    if (budgetReplayToken !== undefined && observedBudget !== undefined) {
      recordProviderRegistryEvidenceBindingStringBudgetForTestV1(
        budgetReplayToken,
        getProviderPointRawAdmissionBudgetLedgerForTestV1(observedBudget),
      );
    }
  }
}

function freezeDetachedPointInputV1(
  detachedInput: unknown,
  originalCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): PreparedProviderRegistryEvidenceBindingPointInputV1 {
  const detached = captureProviderPointDetachedExactDataObjectV1(
    detachedInput,
    POINT_INPUT_KEYS_V1,
  );
  const fields = createProviderNonThenableFrozenRecordV1({
    activeRoot: deepFreezeProviderPointDetachedDataTreeV1(detached.activeRoot),
    activeRootMetadata: deepFreezeProviderPointDetachedDataTreeV1(
      detached.activeRootMetadata,
    ),
    bootstrapTrustBundle: deepFreezeProviderPointDetachedDataTreeV1(
      detached.bootstrapTrustBundle,
    ),
    distributionRootBinding: deepFreezeProviderPointDetachedDataTreeV1(
      detached.distributionRootBinding,
    ),
    fixtureCorpusManifest: deepFreezeProviderPointDetachedDataTreeV1(
      detached.fixtureCorpusManifest,
    ),
    installationIdentityGenerationId: detached.installationIdentityGenerationId,
    providerFeasibilityEvidence: deepFreezeProviderPointDetachedDataTreeV1(
      detached.providerFeasibilityEvidence,
    ),
    providerFeasibilityEvidencePin: deepFreezeProviderPointDetachedDataTreeV1(
      detached.providerFeasibilityEvidencePin,
    ),
    publicSupportTaxonomy: deepFreezeProviderPointDetachedDataTreeV1(
      detached.publicSupportTaxonomy,
    ),
    realFilesystemConformanceResult: deepFreezeProviderPointDetachedDataTreeV1(
      detached.realFilesystemConformanceResult,
    ),
    realFilesystemConformanceResultLocator:
      deepFreezeProviderPointDetachedDataTreeV1(
        detached.realFilesystemConformanceResultLocator,
      ),
    realFilesystemConformanceResultPin:
      deepFreezeProviderPointDetachedDataTreeV1(
        detached.realFilesystemConformanceResultPin,
      ),
    registryManifestHistory: deepFreezeProviderPointDetachedDataTreeV1(
      detached.registryManifestHistory,
    ),
    releaseMatrix: deepFreezeProviderPointDetachedDataTreeV1(
      detached.releaseMatrix,
    ),
    rootMetadataHistory: deepFreezeProviderPointDetachedDataTreeV1(
      detached.rootMetadataHistory,
    ),
    runtimeAttestation: deepFreezeProviderPointDetachedDataTreeV1(
      detached.runtimeAttestation,
    ),
    semanticProviderPolicy: deepFreezeProviderPointDetachedDataTreeV1(
      detached.semanticProviderPolicy,
    ),
    strictCryptoCapability: originalCapability,
    suiteManifest: deepFreezeProviderPointDetachedDataTreeV1(
      detached.suiteManifest,
    ),
    targetDiscoveryFixtureManifest:
      deepFreezeProviderPointDetachedDataTreeV1(
        detached.targetDiscoveryFixtureManifest,
      ),
    targetDiscoveryResult: deepFreezeProviderPointDetachedDataTreeV1(
      detached.targetDiscoveryResult,
    ),
    targetDiscoveryRunnerRun: deepFreezeProviderPointDetachedDataTreeV1(
      detached.targetDiscoveryRunnerRun,
    ),
  }) as unknown as DetachedPointFieldsV1;

  const registryRequest = createProviderNonThenableFrozenRecordV1({
    bootstrapTrustBundle:
      fields.bootstrapTrustBundle as ProviderBootstrapTrustBundleV1,
    installationIdentityGenerationId:
      fields.installationIdentityGenerationId as InstallationIdentityGenerationIdV1,
    registryManifestHistory:
      fields.registryManifestHistory as readonly ProviderRegistryManifestEnvelopeV1[],
    rootMetadataHistory:
      fields.rootMetadataHistory as readonly ProviderRegistryRootMetadataEnvelopeV1[],
    strictCryptoCapability: originalCapability,
  }) as unknown as ValidateProviderRegistryManifestHistoryV1Input;
  const snapshot = createPreparedRegistryHistorySnapshotInternalV1({
    bootstrapTrustBundle: registryRequest.bootstrapTrustBundle,
    installationIdentityGenerationId:
      registryRequest.installationIdentityGenerationId,
    registryManifestHistory: registryRequest.registryManifestHistory,
    rootMetadataHistory: registryRequest.rootMetadataHistory,
    strictCryptoCapability: originalCapability,
  });
  const registryInputHandle = registerPreparedRegistryHistoryInputInternalV1(
    registryRequest,
    snapshot,
    originalCapability,
  );
  return createProviderNonThenableFrozenRecordV1({
    fields,
    strictCryptoCapability: originalCapability,
    registryRequest,
    registryInputHandle,
  });
}

function prepareProviderRegistryEvidenceBindingPointFromRawInputV1(
  input: unknown,
): PreparedProviderRegistryEvidenceBindingPointInputV1 {
  const admission = createProviderPointRawAdmissionSessionV1(input, {
    maxObservedIdentities: MAX_C09_1L_OBSERVED_IDENTITIES_V1,
    maxPrecloneAllocationWorkUnits:
      MAX_C09_1L_PRECLONE_ALLOCATION_WORK_UNITS_V1,
  });
  const budgetReplayToken =
    takeProviderRegistryEvidenceBindingBudgetReplayForTestV1(input);
  try {
    const captured = captureProviderPointRawExactTopLevelV1(
      admission,
      POINT_INPUT_KEYS_V1,
    );
    const strictCryptoCapability = captured.strictCryptoCapability;
    assertProviderStrictEd25519CryptoCapabilityIdentityV1(
      ProviderStrictEd25519AttestationError,
      strictCryptoCapability,
    );
    preflightRawJsonBranchesV1(admission, captured, budgetReplayToken);
    if (budgetReplayToken !== undefined) {
      const recipe = readProviderRegistryEvidenceBindingBudgetRecipeForTestV1(
        budgetReplayToken,
      );
      if (recipe.budget === "identities_c" || recipe.budget === "work_w") {
        exerciseProviderPointRawAdmissionAllocationCapForTestV1(
          admission,
          recipe.budget,
          recipe.relation,
          MAX_C09_1L_OBSERVED_IDENTITIES_V1,
          MAX_C09_1L_PRECLONE_ALLOCATION_WORK_UNITS_V1,
        );
      }
    }
    return freezeDetachedPointInputV1(
      cloneProviderPointRawAdmissionCapsuleV1(admission),
      strictCryptoCapability as ProviderStrictEd25519OpaqueCapabilityV1,
    );
  } finally {
    if (budgetReplayToken !== undefined) {
      completeProviderRegistryEvidenceBindingBudgetReplayForTestV1(
        budgetReplayToken,
        getProviderPointRawAdmissionAllocationLedgerForTestV1(admission),
      );
    }
  }
}

interface BootstrapDistributionBindingV1 {
  readonly bootstrapTrustBundle: ProviderBootstrapTrustBundleV1;
  readonly distributionRootBinding: z.infer<
    typeof ProviderSignedDistributionRootBindingV1Schema
  >;
}

function validateBootstrapDistributionBindingV1(
  fields: DetachedPointFieldsV1,
): BootstrapDistributionBindingV1 {
  let bootstrapTrustBundle: ProviderBootstrapTrustBundleV1;
  let distributionRootBinding: z.infer<
    typeof ProviderSignedDistributionRootBindingV1Schema
  >;
  try {
    bootstrapTrustBundle = ProviderBootstrapTrustBundleV1Schema.parse(
      fields.bootstrapTrustBundle,
    );
    distributionRootBinding =
      ProviderSignedDistributionRootBindingV1Schema.parse(
        fields.distributionRootBinding,
      );
  } catch {
    return failBindingPointV1(
      "bootstrap_distribution_binding",
      "schema_invalid",
    );
  }
  let expectedPin;
  try {
    expectedPin = ProviderBootstrapTrustBundlePinV1Schema.parse({
      locatorProfile: "distribution_provider_bootstrap_trust_bundle_v1",
      contentDigest:
        deriveProviderBootstrapTrustBundleContentDigestV1(
          bootstrapTrustBundle,
        ),
    });
  } catch {
    return failBindingPointV1(
      "bootstrap_distribution_binding",
      "schema_invalid",
    );
  }
  if (
    !canonicalEqualV1(
      distributionRootBinding.bootstrapTrustBundle,
      expectedPin,
    )
  ) {
    return failBindingPointV1(
      "bootstrap_distribution_binding",
      "pin_mismatch",
    );
  }
  return createProviderNonThenableFrozenRecordV1({
    bootstrapTrustBundle:
      fields.bootstrapTrustBundle as ProviderBootstrapTrustBundleV1,
    distributionRootBinding,
  });
}

function validatePreparedEvidenceStructureV1(
  input: unknown,
): PreparedProviderFeasibilityEvidenceEnvelopeV1 {
  if (!PreparedProviderFeasibilityEvidenceEnvelopeV1Schema.safeParse(input).success) {
    return failBindingPointV1("evidence_structure", "schema_invalid");
  }
  return input as PreparedProviderFeasibilityEvidenceEnvelopeV1;
}

function validatePreparedEvidencePinStructureV1(
  input: unknown,
): ProviderFeasibilityEvidencePinV1 {
  if (!ProviderFeasibilityEvidencePinV1Schema.safeParse(input).success) {
    return failBindingPointV1("evidence_pin_structure", "schema_invalid");
  }
  return input as ProviderFeasibilityEvidencePinV1;
}

function findTipMemberByProviderIdV1(
  tip: ProviderRegistryManifestEnvelopeV1,
  providerId: string,
): ProviderRegistryManifestMemberV1 | undefined {
  const members = tip.payload.members;
  let match: ProviderRegistryManifestMemberV1 | undefined;
  for (let index = 0; index < members.length; index += 1) {
    const candidate = members[index]!;
    if (candidate.providerId !== providerId) continue;
    if (match !== undefined) {
      return failBindingPointV1(
        "candidate_member_resolution",
        "member_not_enabled",
      );
    }
    match = candidate;
  }
  return match;
}

function bindCandidateRootV1(
  fields: DetachedPointFieldsV1,
  closure: ProviderRegistryManifestHistoryValidationV1,
  tip: ProviderRegistryManifestEnvelopeV1,
  optionalMember: ProviderRegistryManifestMemberV1 | undefined,
): ProviderRegistryRootPublicKeyV1 {
  const installationIdentityGenerationId =
    fields.installationIdentityGenerationId;
  if (
    !InstallationIdentityGenerationIdV1Schema.safeParse(
      installationIdentityGenerationId,
    ).success ||
    installationIdentityGenerationId !==
      closure.installationIdentityGenerationId ||
    installationIdentityGenerationId !==
      tip.payload.installationIdentityGenerationId ||
    (optionalMember?.disposition === "enabled" &&
      installationIdentityGenerationId !==
        optionalMember.registryEntry.installationIdentityGenerationId)
  ) {
    return failBindingPointV1(
      "candidate_root_binding",
      "identity_mismatch",
    );
  }

  if (
    !ProviderRegistryRootMetadataPinV1Schema.safeParse(
      fields.activeRootMetadata,
    ).success ||
    !canonicalEqualV1(
      fields.activeRootMetadata,
      tip.payload.activeRootMetadata,
    ) ||
    !canonicalEqualV1(
      fields.activeRootMetadata,
      closure.currentRootMetadata,
    )
  ) {
    return failBindingPointV1("candidate_root_binding", "root_mismatch");
  }

  const activeRootMetadata =
    fields.activeRootMetadata as z.infer<
      typeof ProviderRegistryRootMetadataPinV1Schema
    >;
  let retainedRootEnvelope: ProviderRegistryRootMetadataEnvelopeV1 | undefined;
  for (let index = 0; index < closure.rootMetadataHistory.length; index += 1) {
    const envelope = closure.rootMetadataHistory[index]!;
    if (
      envelope.rootGeneration !== activeRootMetadata.rootGeneration ||
      envelope.rootKeyId !== activeRootMetadata.rootKeyId ||
      envelope.contentDigest !== activeRootMetadata.contentDigest
    ) {
      continue;
    }
    if (retainedRootEnvelope !== undefined) {
      return failBindingPointV1("candidate_root_binding", "root_mismatch");
    }
    retainedRootEnvelope = envelope;
  }
  if (
    retainedRootEnvelope === undefined ||
    !ProviderRegistryRootPublicKeyV1Schema.safeParse(fields.activeRoot).success ||
    !canonicalEqualV1(
      fields.activeRoot,
      retainedRootEnvelope.payload.activeRoot,
    )
  ) {
    return failBindingPointV1("candidate_root_binding", "root_mismatch");
  }
  return retainedRootEnvelope.payload.activeRoot;
}

function resolveCandidateMemberV1(
  tip: ProviderRegistryManifestEnvelopeV1,
  member: ProviderRegistryManifestMemberV1 | undefined,
): CandidateRegistryMemberResolutionV1 {
  if (tip.payload.routing.state !== "steady") {
    return failBindingPointV1(
      "candidate_member_resolution",
      "routing_invalid",
    );
  }
  if (member === undefined || member.disposition !== "enabled") {
    return failBindingPointV1(
      "candidate_member_resolution",
      "member_not_enabled",
    );
  }
  return createProviderNonThenableFrozenRecordV1({
    member,
    entry: member.registryEntry,
  });
}

function bindCandidateEntryPinsV1(
  entry: StoreDurableObjectProviderRegistryEntryV1,
  evidencePin: ProviderFeasibilityEvidencePinV1,
  runtimeAttestation: unknown,
): void {
  if (!canonicalEqualV1(entry.providerFeasibilityEvidence, evidencePin)) {
    return failBindingPointV1(
      "registry_evidence_pin_binding",
      "pin_mismatch",
    );
  }
  if (!canonicalEqualV1(entry.runtimeAttestation, runtimeAttestation)) {
    return failBindingPointV1(
      "registry_runtime_binding",
      "binding_mismatch",
    );
  }
}

function validateRegistryPolicyBindingV1(
  entry: StoreDurableObjectProviderRegistryEntryV1,
  runtimeClosure: ProviderRuntimeAttestationPointClosureValidationV1,
): void {
  if (
    entry.semanticProviderPolicyDigest !==
      runtimeClosure.semanticProviderPolicyDigest
  ) {
    return failBindingPointV1(
      "registry_policy_binding",
      "binding_mismatch",
    );
  }
}

function validateEvidenceResultBindingV1(
  evidence: PreparedProviderFeasibilityEvidencePayloadV1,
  resultEnvelope: ProviderRealFilesystemConformanceResultEnvelopeV1,
  runtimeClosure: ProviderRuntimeAttestationPointClosureValidationV1,
): void {
  const result = resultEnvelope.payload;
  if (
    evidence.providerId !== result.providerId ||
    evidence.semanticProviderPolicyDigest !==
      result.semanticProviderPolicyDigest ||
    evidence.implementationDigest !== result.implementationDigest ||
    evidence.binaryAttestationDigest !== result.binaryAttestationDigest ||
    !canonicalEqualV1(evidence.target, result.target) ||
    evidence.realFilesystemSuiteDigest !== result.suiteDigest ||
    evidence.fixtureManifestDigest !== result.fixtureManifestDigest ||
    evidence.runnerProfileDigest !== result.runnerProfileDigest ||
    evidence.crashCutCoverageDigest !== result.crashCutCoverageDigest ||
    evidence.result !== result.result
  ) {
    return failBindingPointV1(
      "evidence_result_binding",
      "binding_mismatch",
    );
  }
  if (
    !canonicalEqualV1(
      evidence.realFilesystemConformanceResult,
      runtimeClosure.conformanceResultClosure.result,
    )
  ) {
    return failBindingPointV1(
      "evidence_result_binding",
      "pin_mismatch",
    );
  }
  if (
    evidence.realFilesystemConformanceResultDigest !==
      resultEnvelope.contentDigest
  ) {
    return failBindingPointV1(
      "evidence_result_binding",
      "digest_mismatch",
    );
  }
}

function validateProductionResultGateV1(
  evidence: PreparedProviderFeasibilityEvidencePayloadV1,
  resultEnvelope: ProviderRealFilesystemConformanceResultEnvelopeV1,
): void {
  if (evidence.result !== "passed" || resultEnvelope.payload.result !== "passed") {
    return failBindingPointV1(
      "production_result_gate",
      "result_not_passed",
    );
  }
}

function validateEvidencePolicyBindingV1(
  evidence: PreparedProviderFeasibilityEvidencePayloadV1,
  runtimeClosure: ProviderRuntimeAttestationPointClosureValidationV1,
): void {
  const policy = runtimeClosure.semanticProviderPolicy;
  if (
    evidence.isolationSecurityBoundaryProfileDigest !==
      policy.isolation.securityBoundaryProfileDigest ||
    evidence.ipcPeerAuthenticationPolicyDigest !==
      policy.ipcPeerAuthenticationPolicyDigest ||
    evidence.realFilesystemSuiteDigest !==
      policy.realFilesystemConformanceSuiteDigest
  ) {
    return failBindingPointV1(
      "evidence_policy_binding",
      "digest_mismatch",
    );
  }
}

function validateEvidenceRuntimeBindingV1(
  evidence: PreparedProviderFeasibilityEvidencePayloadV1,
  runtimeClosure: ProviderRuntimeAttestationPointClosureValidationV1,
): void {
  if (
    evidence.runtimeAttestationContentDigest !==
      runtimeClosure.runtimeAttestation.contentDigest ||
    evidence.realFilesystemConformanceResultDigest !==
      runtimeClosure.runtimeAttestation.payload
        .realFilesystemConformanceResultDigest
  ) {
    return failBindingPointV1(
      "evidence_runtime_binding",
      "digest_mismatch",
    );
  }
}

function validateEvidenceTimeV1(
  evidence: PreparedProviderFeasibilityEvidencePayloadV1,
  resultEnvelope: ProviderRealFilesystemConformanceResultEnvelopeV1,
): void {
  try {
    if (
      compareProviderFeasibilityEvidenceTimestampsV1(
        evidence.issuedAt,
        resultEnvelope.payload.completedAt,
      ) < 0
    ) {
      return failBindingPointV1("evidence_time", "ordering_invalid");
    }
  } catch (error) {
    if (error instanceof ProviderRegistryEvidenceBindingDiagnosticSignalV1) {
      throw error;
    }
    return failBindingPointV1("evidence_time", "ordering_invalid");
  }
}

function deriveAndValidateEvidenceIdV1(
  evidence: PreparedProviderFeasibilityEvidencePayloadV1,
): ReturnType<
  typeof deriveProviderFeasibilityEvidenceIdFromPreparedPayloadInternalV1
> {
  let derivedEvidenceId: ReturnType<
    typeof deriveProviderFeasibilityEvidenceIdFromPreparedPayloadInternalV1
  >;
  try {
    derivedEvidenceId =
      deriveProviderFeasibilityEvidenceIdFromPreparedPayloadInternalV1(
        evidence as unknown as ProviderFeasibilityEvidenceV1,
      );
  } catch {
    return failBindingPointV1("evidence_id", "identity_mismatch");
  }
  if (evidence.evidenceId !== derivedEvidenceId) {
    return failBindingPointV1("evidence_id", "identity_mismatch");
  }
  return derivedEvidenceId;
}

function validateEvidenceSignatureBindingV1(
  signature: unknown,
  role: "qa" | "release",
): PreparedProviderFeasibilityEvidenceSignatureBindingV1 {
  try {
    return parseProviderFeasibilityEvidenceSignatureBindingInternalV1(
      signature,
      role,
    );
  } catch {
    return failBindingPointV1(
      role === "qa"
        ? "evidence_qa_signature_binding"
        : "evidence_release_signature_binding",
      "binding_mismatch",
    );
  }
}

function resolveHistoricalApproverV1(
  records: readonly ProviderFeasibilityApproverPublicKeyV1[],
  entry: StoreDurableObjectProviderRegistryEntryV1,
  binding: PreparedProviderFeasibilityEvidenceSignatureBindingV1,
  role: "qa" | "release",
): ProviderFeasibilityApproverPublicKeyV1 {
  const stage =
    role === "qa" ? "qa_approver_resolution" : "release_approver_resolution";
  let match: ProviderFeasibilityApproverPublicKeyV1 | undefined;
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]!;
    if (record.role !== role || record.keyId !== binding.keyId) continue;
    if (match !== undefined) {
      return failBindingPointV1(stage, "approver_not_found");
    }
    match = record;
  }
  if (match === undefined) {
    return failBindingPointV1(stage, "approver_not_found");
  }
  let retainedByTipEntry = false;
  const tipRecords = entry.feasibilityApprovalKeys.publicKeyRecords;
  for (let index = 0; index < tipRecords.length; index += 1) {
    if (tipRecords[index] === match) {
      retainedByTipEntry = true;
      break;
    }
  }
  if (!retainedByTipEntry) {
    return failBindingPointV1(stage, "approver_not_found");
  }
  const revoked = entry.feasibilityApprovalKeys.compromisedRevokedKeyIds;
  for (let index = 0; index < revoked.length; index += 1) {
    if (revoked[index] === binding.keyId) {
      return failBindingPointV1(stage, "approver_revoked");
    }
  }
  return match;
}

const BASE64URL_PREFIX_V1 = "base64url:";
const BASE64URL_ALPHABET_V1 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function decodeCanonicalPublicKeyBytes32V1(value: string): Uint8Array {
  if (
    stringSliceV1(value, 0, BASE64URL_PREFIX_V1.length) !==
    BASE64URL_PREFIX_V1
  ) {
    throw new CapturedTypeErrorV1("public key bytes have the wrong prefix");
  }
  const body = stringSliceV1(value, BASE64URL_PREFIX_V1.length);
  const decoded = new CapturedUint8ArrayV1(32);
  let accumulator = 0;
  let availableBits = 0;
  let offset = 0;
  for (let index = 0; index < body.length; index += 1) {
    const digit = stringIndexOfV1(
      BASE64URL_ALPHABET_V1,
      body[index]!,
    );
    if (digit < 0) {
      throw new CapturedTypeErrorV1("public key bytes are not base64url");
    }
    accumulator = (accumulator << 6) | digit;
    availableBits += 6;
    if (availableBits < 8) continue;
    availableBits -= 8;
    if (offset >= decoded.byteLength) {
      throw new CapturedTypeErrorV1("public key bytes exceed raw32");
    }
    decoded[offset] = (accumulator >>> availableBits) & 0xff;
    offset += 1;
    accumulator &= (1 << availableBits) - 1;
  }
  if (offset !== 32 || availableBits !== 2 || accumulator !== 0) {
    throw new CapturedTypeErrorV1("public key bytes are not canonical raw32");
  }
  return decoded;
}

async function verifyEvidenceApprovalSignatureV1(
  evidence: PreparedProviderFeasibilityEvidencePayloadV1,
  record: ProviderFeasibilityApproverPublicKeyV1,
  binding: PreparedProviderFeasibilityEvidenceSignatureBindingV1,
  role: "qa" | "release",
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<void> {
  const stage =
    role === "qa" ? "evidence_qa_signature" : "evidence_release_signature";
  try {
    const message =
      role === "qa"
        ? createProviderFeasibilityEvidenceQaSignatureMessageFromPreparedPayloadInternalV1(
            evidence as unknown as ProviderFeasibilityEvidenceV1,
            binding.keyId,
          )
        : createProviderFeasibilityEvidenceReleaseSignatureMessageFromPreparedPayloadInternalV1(
            evidence as unknown as ProviderFeasibilityEvidenceV1,
            binding.keyId,
          );
    const accepted = await verifyRawEd25519WithCapabilityV1(
      capability,
      decodeCanonicalPublicKeyBytes32V1(record.publicKeyBytes),
      message,
      binding.signatureBytes,
    );
    if (!accepted) return failBindingPointV1(stage, "signature_invalid");
  } catch (error) {
    if (error instanceof ProviderRegistryEvidenceBindingDiagnosticSignalV1) {
      throw error;
    }
    return failBindingPointV1(stage, "signature_invalid");
  }
}

function validateEvidenceDigestV1(
  envelope: PreparedProviderFeasibilityEvidenceEnvelopeV1,
): void {
  let digest: ContentDigestV1;
  try {
    digest =
      deriveProviderFeasibilityEvidenceContentDigestFromPreparedPayloadInternalV1(
        envelope.payload as unknown as ProviderFeasibilityEvidenceV1,
      );
  } catch {
    return failBindingPointV1("evidence_digest", "digest_mismatch");
  }
  if (envelope.contentDigest !== digest) {
    return failBindingPointV1("evidence_digest", "digest_mismatch");
  }
}

function validateCompleteEvidenceEnvelopeV1(
  envelope: PreparedProviderFeasibilityEvidenceEnvelopeV1,
  derivedEvidenceId: ReturnType<
    typeof deriveProviderFeasibilityEvidenceIdFromPreparedPayloadInternalV1
  >,
): ProviderFeasibilityEvidenceEnvelopeV1 {
  if (
    envelope.evidenceId !== envelope.payload.evidenceId ||
    envelope.evidenceId !== derivedEvidenceId ||
    !ProviderFeasibilityEvidenceEnvelopeV1Schema.safeParse(envelope).success
  ) {
    return failBindingPointV1("evidence_envelope", "envelope_mismatch");
  }
  return envelope as ProviderFeasibilityEvidenceEnvelopeV1;
}

function validateEvidencePinV1(
  pin: ProviderFeasibilityEvidencePinV1,
  envelope: ProviderFeasibilityEvidenceEnvelopeV1,
): ProviderFeasibilityEvidenceRelativePathV1 {
  if (
    pin.evidenceId !== envelope.evidenceId ||
    pin.contentDigest !== envelope.contentDigest
  ) {
    return failBindingPointV1("evidence_pin", "pin_mismatch");
  }
  try {
    return buildProviderFeasibilityEvidenceRelativePathV1(pin);
  } catch {
    return failBindingPointV1("evidence_pin", "pin_mismatch");
  }
}

function createPreparedRuntimeRequestV1(
  fields: DetachedPointFieldsV1,
  suppliedHistoryTipRoot: ProviderRegistryRootPublicKeyV1,
  entry: StoreDurableObjectProviderRegistryEntryV1,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): ValidateProviderRuntimeAttestationPointClosureV1Input {
  return createProviderNonThenableFrozenRecordV1({
    activeRoot: suppliedHistoryTipRoot,
    activeRootMetadata: fields.activeRootMetadata,
    distributionRootBinding: fields.distributionRootBinding,
    fixtureCorpusManifest: fields.fixtureCorpusManifest,
    publicSupportTaxonomy: fields.publicSupportTaxonomy,
    realFilesystemConformanceResult:
      fields.realFilesystemConformanceResult,
    realFilesystemConformanceResultLocator:
      fields.realFilesystemConformanceResultLocator,
    realFilesystemConformanceResultPin:
      fields.realFilesystemConformanceResultPin,
    releaseMatrix: fields.releaseMatrix,
    runtimeAttestation: entry.runtimeAttestation,
    semanticProviderPolicy: fields.semanticProviderPolicy,
    strictCryptoCapability: capability,
    suiteManifest: fields.suiteManifest,
    targetDiscoveryFixtureManifest:
      fields.targetDiscoveryFixtureManifest,
    targetDiscoveryResult: fields.targetDiscoveryResult,
    targetDiscoveryRunnerRun: fields.targetDiscoveryRunnerRun,
  }) as unknown as ValidateProviderRuntimeAttestationPointClosureV1Input;
}

function assertPreparedHistoryIdentityRetentionV1(
  fields: DetachedPointFieldsV1,
  closure: ProviderRegistryManifestHistoryValidationV1,
): void {
  if (
    closure.rootMetadataHistory !== fields.rootMetadataHistory ||
    closure.registryManifestHistory !== fields.registryManifestHistory
  ) {
    return failBindingPointV1(
      "registry_history_closure",
      "source_invalid",
    );
  }
  const rootHistory =
    fields.rootMetadataHistory as readonly ProviderRegistryRootMetadataEnvelopeV1[];
  const registryHistory =
    fields.registryManifestHistory as readonly ProviderRegistryManifestEnvelopeV1[];
  if (
    closure.rootMetadataHistory.length !== rootHistory.length ||
    closure.registryManifestHistory.length !== registryHistory.length
  ) {
    return failBindingPointV1(
      "registry_history_closure",
      "source_invalid",
    );
  }
  for (let index = 0; index < rootHistory.length; index += 1) {
    if (closure.rootMetadataHistory[index] !== rootHistory[index]) {
      return failBindingPointV1(
        "registry_history_closure",
        "source_invalid",
      );
    }
  }
  for (let index = 0; index < registryHistory.length; index += 1) {
    if (closure.registryManifestHistory[index] !== registryHistory[index]) {
      return failBindingPointV1(
        "registry_history_closure",
        "source_invalid",
      );
    }
  }
}

async function validateRegistryEvidenceBindingPointInternalV1(
  prepared: PreparedProviderRegistryEvidenceBindingPointInputV1,
): Promise<ProviderRegistryEvidenceBindingPointClosureValidationV1> {
  const { fields, strictCryptoCapability } = prepared;
  let registryClosure: ProviderRegistryManifestHistoryValidationV1 | undefined;
  let registryTrustWitnessHandle: RegistryTrustWitnessHandleV1 | undefined;
  try {
    validateBootstrapDistributionBindingV1(fields);
    const preparedEvidence = validatePreparedEvidenceStructureV1(
      fields.providerFeasibilityEvidence,
    );
    const evidencePin = validatePreparedEvidencePinStructureV1(
      fields.providerFeasibilityEvidencePin,
    );

    let registryDiagnostic;
    try {
      registryDiagnostic =
        await hardenProviderPointPromiseV1(
          diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
            prepared.registryRequest,
            prepared.registryInputHandle,
            strictCryptoCapability,
          ),
        );
    } catch {
      return failBindingPointV1(
        "registry_history_closure",
        "source_invalid",
      );
    }
    if (!registryDiagnostic.ok) {
      return failBindingPointV1(
        "registry_history_closure",
        "source_invalid",
      );
    }
    registryClosure = registryDiagnostic.value.closure;
    registryTrustWitnessHandle =
      registryDiagnostic.value.registryTrustWitnessHandle;
    assertPreparedHistoryIdentityRetentionV1(fields, registryClosure);

    const registryHistory = registryClosure.registryManifestHistory;
    const tip = registryHistory[registryHistory.length - 1];
    if (tip === undefined) {
      return failBindingPointV1(
        "registry_history_closure",
        "source_invalid",
      );
    }
    const evidence = preparedEvidence.payload;
    const optionalMember = findTipMemberByProviderIdV1(
      tip,
      evidence.providerId,
    );
    const suppliedHistoryTipRoot = bindCandidateRootV1(
      fields,
      registryClosure,
      tip,
      optionalMember,
    );
    const candidate = resolveCandidateMemberV1(tip, optionalMember);
    bindCandidateEntryPinsV1(
      candidate.entry,
      evidencePin,
      fields.runtimeAttestation,
    );

    const runtimeRequest = createPreparedRuntimeRequestV1(
      fields,
      suppliedHistoryTipRoot,
      candidate.entry,
      strictCryptoCapability,
    );
    let runtimeDiagnostic;
    try {
      runtimeDiagnostic =
        await hardenProviderPointPromiseV1(
          diagnoseProviderRuntimeAttestationPointFromRegistryHistoryInternalV1(
            runtimeRequest,
            registryClosure,
            registryTrustWitnessHandle,
            candidate.member.providerId,
            candidate.member.registryEntryContentDigest,
            strictCryptoCapability,
          ),
        );
    } catch {
      return failBindingPointV1(
        "runtime_attestation_closure",
        "source_invalid",
      );
    }
    if (!runtimeDiagnostic.ok) {
      return failBindingPointV1(
        "runtime_attestation_closure",
        "source_invalid",
      );
    }
    const runtimeTrustResult = runtimeDiagnostic.value;
    const runtimeClosure =
      runtimeTrustResult.runtimeAttestationPointClosure;

    validateRegistryPolicyBindingV1(candidate.entry, runtimeClosure);
    const resultEnvelope =
      fields.realFilesystemConformanceResult as ProviderRealFilesystemConformanceResultEnvelopeV1;
    validateEvidenceResultBindingV1(
      evidence,
      resultEnvelope,
      runtimeClosure,
    );
    validateProductionResultGateV1(evidence, resultEnvelope);
    validateEvidencePolicyBindingV1(evidence, runtimeClosure);
    validateEvidenceRuntimeBindingV1(evidence, runtimeClosure);
    validateEvidenceTimeV1(evidence, resultEnvelope);
    const derivedEvidenceId = deriveAndValidateEvidenceIdV1(evidence);
    const qaBinding = validateEvidenceSignatureBindingV1(
      evidence.qaSignature,
      "qa",
    );
    const releaseBinding = validateEvidenceSignatureBindingV1(
      evidence.releaseSignature,
      "release",
    );
    const qaApproverPublicKey = resolveHistoricalApproverV1(
      runtimeTrustResult.historicallyVerifiedApproverPublicKeys,
      candidate.entry,
      qaBinding,
      "qa",
    );
    const releaseApproverPublicKey = resolveHistoricalApproverV1(
      runtimeTrustResult.historicallyVerifiedApproverPublicKeys,
      candidate.entry,
      releaseBinding,
      "release",
    );
    await hardenProviderPointPromiseV1(
      verifyEvidenceApprovalSignatureV1(
        evidence,
        qaApproverPublicKey,
        qaBinding,
        "qa",
        strictCryptoCapability,
      ),
    );
    await hardenProviderPointPromiseV1(
      verifyEvidenceApprovalSignatureV1(
        evidence,
        releaseApproverPublicKey,
        releaseBinding,
        "release",
        strictCryptoCapability,
      ),
    );
    validateEvidenceDigestV1(preparedEvidence);
    const completeEvidence = validateCompleteEvidenceEnvelopeV1(
      preparedEvidence,
      derivedEvidenceId,
    );
    const relativePath = validateEvidencePinV1(
      evidencePin,
      completeEvidence,
    );

    return createProviderNonThenableFrozenRecordV1({
      authority: PROVIDER_REGISTRY_EVIDENCE_BINDING_AUTHORITY_V1,
      registryManifestHistoryClosure: registryClosure,
      runtimeAttestationPointClosure: runtimeClosure,
      candidateRegistryEntryContentDigest:
        candidate.member.registryEntryContentDigest,
      candidateRegistryEntry: candidate.entry,
      providerFeasibilityEvidence: completeEvidence,
      providerFeasibilityEvidencePin: evidencePin,
      relativePath,
      qaApproverPublicKey,
      releaseApproverPublicKey,
    });
  } finally {
    discardPreparedRegistryHistoryInputInternalV1(
      prepared.registryRequest,
      prepared.registryInputHandle,
      strictCryptoCapability,
    );
    if (
      registryClosure !== undefined &&
      registryTrustWitnessHandle !== undefined
    ) {
      discardRegistryHistoryVerifiedWitnessInternalV1(
        registryClosure,
        registryTrustWitnessHandle,
        strictCryptoCapability,
      );
    }
  }
}

function createBindingPointDiagnosticFailureV1(
  stage: ProviderRegistryEvidenceBindingPointInvalidStageV1,
  reason: ProviderRegistryEvidenceBindingPointInvalidReasonV1,
): ProviderRegistryEvidenceBindingPointDiagnosticFailureV1 {
  return createProviderNonThenableFrozenRecordV1({
    ok: false as const,
    stage,
    reason,
  });
}

function createBindingPointDiagnosticFailureFromErrorV1(
  error: unknown,
): ProviderRegistryEvidenceBindingPointDiagnosticFailureV1 {
  if (error instanceof ProviderRegistryEvidenceBindingDiagnosticSignalV1) {
    return createBindingPointDiagnosticFailureV1(error.stage, error.reason);
  }
  return createBindingPointDiagnosticFailureV1(
    "registry_history_closure",
    "source_invalid",
  );
}

export function diagnoseProviderRegistryEvidenceBindingPointClosureV1(
  input: unknown,
): Promise<ProviderRegistryEvidenceBindingPointClosureDiagnosticResultV1> {
  let prepared: PreparedProviderRegistryEvidenceBindingPointInputV1;
  try {
    prepared = prepareProviderRegistryEvidenceBindingPointFromRawInputV1(input);
  } catch {
    return createProviderPointFulfilledPromiseV1(
      createBindingPointDiagnosticFailureV1("input", "schema_invalid"),
    );
  }
  const corePromise = hardenProviderPointPromiseV1(
    validateRegistryEvidenceBindingPointInternalV1(prepared),
  );
  return corePromise.then(
    (value): ProviderRegistryEvidenceBindingPointDiagnosticSuccessV1 =>
      createProviderNonThenableFrozenRecordV1({
        ok: true as const,
        value,
      }),
    createBindingPointDiagnosticFailureFromErrorV1,
  );
}

export function validateProviderRegistryEvidenceBindingPointClosureV1(
  input: ValidateProviderRegistryEvidenceBindingPointClosureV1Input,
): Promise<ProviderRegistryEvidenceBindingPointClosureValidationV1> {
  let prepared: PreparedProviderRegistryEvidenceBindingPointInputV1;
  try {
    prepared = prepareProviderRegistryEvidenceBindingPointFromRawInputV1(input);
  } catch {
    return createProviderPointRejectedPromiseV1(
      new ProviderRegistryEvidenceBindingPointClosureValidationError(),
    );
  }
  const corePromise = hardenProviderPointPromiseV1(
    validateRegistryEvidenceBindingPointInternalV1(prepared),
  );
  return corePromise.then(
    (value) => value,
    () => {
      throw new ProviderRegistryEvidenceBindingPointClosureValidationError();
    },
  );
}

CapturedObjectFreezeV1(
  diagnoseProviderRegistryEvidenceBindingPointClosureV1,
);
CapturedObjectFreezeV1(
  validateProviderRegistryEvidenceBindingPointClosureV1,
);
