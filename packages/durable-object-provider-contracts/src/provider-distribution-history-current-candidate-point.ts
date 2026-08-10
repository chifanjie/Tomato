import { z } from "./zod-runtime.js";

import type { ProviderBootstrapTrustBundleV1 } from "./bootstrap-trust-bundle.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  type ContentDigestV1,
  type InstallationIdentityGenerationIdV1,
  type ProviderRegistryRootKeyIdV1,
} from "./primitives.js";
import {
  ProviderSignedDistributionRootBindingV1Schema,
  type ProviderSignedDistributionRootBindingV1,
} from "./provider-distribution-trust.js";
import {
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_AUTHORITY_V1,
  createProviderFeasibilitySupportCatalogSignatureMessageV1,
  deriveProviderFeasibilitySupportCatalogContentDigestV1,
  ProviderFeasibilitySupportCatalogEnvelopeV1Schema,
  type ProviderFeasibilityOwnerTargetCapabilityV1,
  type ProviderFeasibilityPublicSupportV1,
  type ProviderFeasibilitySupportCandidateArtifactV1,
  type ProviderFeasibilitySupportCatalogEnvelopeV1,
  type ProviderFeasibilitySupportCatalogPinV1,
  type ProviderFeasibilitySupportCatalogPointClosureValidationV1,
  type ProviderFeasibilitySupportCatalogRelativePathV1,
  type ValidateProviderFeasibilitySupportCatalogPointClosureV1Input,
} from "./provider-feasibility-support-catalog-point.js";
import {
  diagnoseProviderFeasibilitySupportCatalogPointRegistryTrustedPreparedInternalV1,
  registerProviderFeasibilitySupportCatalogRegistryTrustedInternalV1,
} from "./provider-feasibility-support-catalog-point-prepared-internal.js";
import { encodeStoreFilenameKeyV1 } from "./provider-fixed-locator.js";
import {
  createProviderDistributionRetainedAccountingAccumulatorInternalV1,
  diagnoseProviderDistributionRetainedNormalCandidateInternalV1,
  isProviderDistributionRetainedAccountingErrorInternalV1,
  type ProviderDistributionRetainedAccountingAccumulatorInternalV1,
  type ProviderDistributionRetainedAccountingFailureReasonInternalV1,
} from "./provider-distribution-retained-accounting-internal.js";
import {
  registerProviderDistributionHistoricalVerifiedSignatureInternalV1,
  takeProviderDistributionCurrentTipSemanticTokensInternalV1,
  validateProviderDistributionHistoricalBundleSemanticInternalV1,
  validateProviderDistributionHistoricalCatalogSemanticInternalV1,
  validateProviderDistributionHistoricalCorpusSemanticInternalV1,
  validateProviderDistributionHistoricalMatrixSemanticInternalV1,
  validateProviderDistributionHistoricalResultSemanticInternalV1,
  validateProviderDistributionHistoricalSuiteSemanticInternalV1,
  validateProviderDistributionHistoricalTaxonomySemanticInternalV1,
  validateProviderDistributionHistoricalUniverseSemanticInternalV1,
  type ProviderDistributionHistoricalCorpusSemanticTokenInternalV1,
  type ProviderDistributionHistoricalMatrixSemanticTokenInternalV1,
  type ProviderDistributionHistoricalResultSemanticTokenInternalV1,
  type ProviderDistributionHistoricalSuiteSemanticTokenInternalV1,
  type ProviderDistributionHistoricalSignedObjectKindInternalV1,
  type ProviderDistributionHistoricalTaxonomySemanticTokenInternalV1,
  type ProviderDistributionHistoricalUniverseSemanticTokenInternalV1,
  type ProviderDistributionCurrentTipSemanticTokensInternalV1,
} from "./provider-distribution-historical-semantic-internal.js";
import {
  captureProviderPointDetachedExactDataObjectV1,
  captureProviderPointRawExactTopLevelV1,
  cloneProviderPointRawAdmissionCapsuleV1,
  createProviderPointRawAdmissionBudgetForSessionV1,
  createProviderPointRawAdmissionSessionV1,
  deepFreezeProviderPointDetachedDataTreeV1,
  walkProviderPointRawJsonIdentityTreeV1,
} from "./provider-point-raw-admission-internal.js";
import {
  createProviderNonThenableFrozenRecordV1,
  createProviderPointFulfilledPromiseV1,
  createProviderPointRejectedPromiseV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import {
  createProviderRealFilesystemFixtureCorpusManifestSignatureMessageV1,
  createProviderRealFilesystemSuiteManifestSignatureMessageV1,
  deriveProviderRealFilesystemFixtureCorpusManifestContentDigestV1,
  deriveProviderRealFilesystemSuiteManifestContentDigestV1,
  ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema,
  ProviderRealFilesystemSuiteManifestEnvelopeV1Schema,
  type ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1,
  type ProviderRealFilesystemSuiteManifestEnvelopeV1,
} from "./provider-real-filesystem-source.js";
import type {
  ProviderRegistryManifestHistoryValidationV1,
  ValidateProviderRegistryManifestHistoryV1Input,
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
import type { ProviderRegistryManifestEnvelopeV1 } from "./provider-registry-records.js";
import type {
  ProviderRegistryRootMetadataEnvelopeV1,
  ProviderRegistryRootMetadataPinV1,
  ProviderRegistryRootPublicKeyV1,
} from "./provider-registry-trust.js";
import {
  createProviderReleaseTargetUniverseSignatureMessageV1,
  deriveProviderReleaseTargetUniverseContentDigestV1,
  ProviderReleaseTargetUniverseEnvelopeV1Schema,
  type ProviderReleaseTargetUniverseEnvelopeV1,
} from "./provider-release-target-universe-point.js";
import {
  createProviderPublicSupportTaxonomySignatureMessageV1,
  createProviderReleaseMatrixSignatureMessageV1,
  createProviderTargetDiscoveryInputBundleSignatureMessageV1,
  createProviderTargetDiscoveryResultSignatureMessageV1,
  deriveProviderPublicSupportTaxonomyContentDigestV1,
  deriveProviderReleaseMatrixContentDigestV1,
  deriveProviderTargetDiscoveryFixtureManifestContentDigestV1,
  deriveProviderTargetDiscoveryInputBundleContentDigestV1,
  deriveProviderTargetDiscoveryRunnerRunManifestContentDigestV1,
  deriveProviderTargetDiscoveryResultContentDigestV1,
  ProviderPublicSupportTaxonomyEnvelopeV1Schema,
  ProviderReleaseMatrixEnvelopeV1Schema,
  ProviderTargetDiscoveryFixtureManifestEnvelopeV1Schema,
  ProviderTargetDiscoveryResultEnvelopeV1Schema,
  ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema,
  type ProviderPublicSupportTaxonomyEnvelopeV1,
  type ProviderReleaseMatrixEnvelopeV1,
  type ProviderTargetDiscoveryFixtureManifestEnvelopeV1,
  type ProviderTargetDiscoveryResultEnvelopeV1,
  type ProviderTargetDiscoveryRunnerRunEnvelopeV1,
} from "./provider-target-discovery-point.js";
import {
  assertProviderStrictEd25519CryptoCapabilityIdentityV1,
} from "./strict-ed25519-capability-internal.js";
import {
  ProviderStrictEd25519AttestationError,
  verifyRawEd25519WithCapabilityV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "./strict-ed25519-conformance.js";

const CapturedArrayIsArrayV1 = Array.isArray;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedMapV1 = Map;
const CapturedMapGetV1 = CapturedMapV1.prototype.get;
const CapturedMapHasV1 = CapturedMapV1.prototype.has;
const CapturedMapSetV1 = CapturedMapV1.prototype.set;
const CapturedNumberIsSafeIntegerV1 = Number.isSafeInteger;
const CapturedNumberParseIntV1 = Number.parseInt;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedRegExpPrototypeExecV1 = RegExp.prototype.exec;
const CapturedStringPrototypeIndexOfV1 = String.prototype.indexOf;
const CapturedStringPrototypeSliceV1 = String.prototype.slice;
const CapturedTypeErrorV1 = TypeError;
const CapturedUint8ArrayV1 = Uint8Array;
const CapturedWeakSetV1 = WeakSet;
const CapturedWeakSetAddV1 = CapturedWeakSetV1.prototype.add;
const CapturedWeakSetHasV1 = CapturedWeakSetV1.prototype.has;

function bindUncurriedDistributionHistoryIntrinsicV1(
  method: Function,
): Function {
  return CapturedObjectFreezeV1(
    CapturedReflectApplyV1(
      CapturedFunctionPrototypeBindV1,
      CapturedFunctionPrototypeCallV1,
      CapturedObjectFreezeV1([method]),
    ) as Function,
  );
}

const mapGetV1 = bindUncurriedDistributionHistoryIntrinsicV1(
  CapturedMapGetV1,
) as <K, V>(receiver: Map<K, V>, key: K) => V | undefined;
const mapHasV1 = bindUncurriedDistributionHistoryIntrinsicV1(
  CapturedMapHasV1,
) as <K>(receiver: Map<K, unknown>, key: K) => boolean;
const mapSetV1 = bindUncurriedDistributionHistoryIntrinsicV1(
  CapturedMapSetV1,
) as <K, V>(receiver: Map<K, V>, key: K, value: V) => Map<K, V>;
const regExpExecV1 = bindUncurriedDistributionHistoryIntrinsicV1(
  CapturedRegExpPrototypeExecV1,
) as (receiver: RegExp, value: string) => RegExpExecArray | null;
const stringIndexOfV1 = bindUncurriedDistributionHistoryIntrinsicV1(
  CapturedStringPrototypeIndexOfV1,
) as (receiver: string, search: string) => number;
const stringSliceV1 = bindUncurriedDistributionHistoryIntrinsicV1(
  CapturedStringPrototypeSliceV1,
) as (receiver: string, start?: number, end?: number) => string;
const weakSetAddV1 = bindUncurriedDistributionHistoryIntrinsicV1(
  CapturedWeakSetAddV1,
) as <T extends object>(receiver: WeakSet<T>, value: T) => WeakSet<T>;
const weakSetHasV1 = bindUncurriedDistributionHistoryIntrinsicV1(
  CapturedWeakSetHasV1,
) as <T extends object>(receiver: WeakSet<T>, value: T) => boolean;

export const PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_AUTHORITY_V1 =
  "none_provider_distribution_history_current_candidate_structure_only" as const;

export const ProviderDistributionHistoryCurrentCandidatePointInvalidStageV1Schema =
  z.enum([
    "input",
    "registry_history_closure",
    "public_support_taxonomy_history",
    "release_matrix_history",
    "target_discovery_result_history",
    "release_target_universe_history",
    "provider_feasibility_support_catalog_history",
    "history_pin_closure",
    "retained_history_accounting",
    "current_source_closure",
    "catalog_point_closure",
  ]);
export type ProviderDistributionHistoryCurrentCandidatePointInvalidStageV1 =
  z.infer<
    typeof ProviderDistributionHistoryCurrentCandidatePointInvalidStageV1Schema
  >;

export const ProviderDistributionHistoryCurrentCandidatePointInvalidReasonV1Schema =
  z.enum([
    "schema_invalid",
    "source_invalid",
    "history_empty",
    "history_generation_limit_exceeded",
    "envelope_byte_limit_exceeded",
    "generation_not_contiguous",
    "predecessor_digest_mismatch",
    "digest_mismatch",
    "envelope_mismatch",
    "distribution_binding_mismatch",
    "active_root_mismatch",
    "active_root_rollback",
    "signature_invalid",
    "locator_invalid",
    "pin_mismatch",
    "generation_rollback",
    "count_mismatch",
    "object_invalid",
    "invalid_safe_integer",
    "single_object_byte_limit_exceeded",
    "retained_object_count_limit_exceeded",
    "retained_history_byte_limit_exceeded",
    "normal_update_emergency_generation_reserve_exhausted",
    "normal_update_emergency_logical_bytes_reserve_exhausted",
    "locator_ownership_conflict",
    "retained_object_key_conflict",
    "source_exact_cover_mismatch",
  ]);
export type ProviderDistributionHistoryCurrentCandidatePointInvalidReasonV1 =
  z.infer<
    typeof ProviderDistributionHistoryCurrentCandidatePointInvalidReasonV1Schema
  >;

export interface ValidateProviderDistributionHistoryCurrentCandidatePointV1Input {
  readonly bootstrapTrustBundle: ProviderBootstrapTrustBundleV1;
  readonly distributionRootBinding: ProviderSignedDistributionRootBindingV1;
  readonly installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  readonly rootMetadataHistory: readonly ProviderRegistryRootMetadataEnvelopeV1[];
  readonly registryManifestHistory: readonly ProviderRegistryManifestEnvelopeV1[];
  readonly publicSupportTaxonomyHistory: readonly ProviderPublicSupportTaxonomyEnvelopeV1[];
  readonly releaseMatrixHistory: readonly ProviderReleaseMatrixEnvelopeV1[];
  readonly targetDiscoveryResultHistory: readonly ProviderTargetDiscoveryResultEnvelopeV1[];
  readonly releaseTargetUniverseHistory: readonly ProviderReleaseTargetUniverseEnvelopeV1[];
  readonly providerFeasibilitySupportCatalogHistory: readonly ProviderFeasibilitySupportCatalogEnvelopeV1[];
  readonly targetDiscoveryFixtureManifests: readonly ProviderTargetDiscoveryFixtureManifestEnvelopeV1[];
  readonly targetDiscoveryRunnerRuns: readonly ProviderTargetDiscoveryRunnerRunEnvelopeV1[];
  readonly realFilesystemSuiteManifests: readonly ProviderRealFilesystemSuiteManifestEnvelopeV1[];
  readonly realFilesystemFixtureCorpusManifests: readonly ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1[];
  readonly providerFeasibilitySupportCandidateArtifacts: readonly ProviderFeasibilitySupportCandidateArtifactV1[];
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
}

export interface ProviderDistributionHistoryCurrentCandidatePointValidationV1 {
  readonly authority: typeof PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_AUTHORITY_V1;
  readonly publicSupportTaxonomyTip: ProviderPublicSupportTaxonomyEnvelopeV1;
  readonly releaseMatrixTip: ProviderReleaseMatrixEnvelopeV1;
  readonly targetDiscoveryResultTip: ProviderTargetDiscoveryResultEnvelopeV1;
  readonly releaseTargetUniverseTip: ProviderReleaseTargetUniverseEnvelopeV1;
  readonly providerFeasibilitySupportCatalogTip: ProviderFeasibilitySupportCatalogEnvelopeV1;
  readonly currentCatalogProjection: ProviderDistributionHistoryCurrentCatalogProjectionV1;
  readonly catalogPointClosure: ProviderFeasibilitySupportCatalogPointClosureValidationV1;
}

export interface ProviderDistributionHistoryCurrentCatalogProjectionV1 {
  readonly authority: typeof PROVIDER_FEASIBILITY_SUPPORT_CATALOG_AUTHORITY_V1;
  readonly ownerTargetCapabilities: readonly ProviderFeasibilityOwnerTargetCapabilityV1[];
  readonly publicSupport: readonly ProviderFeasibilityPublicSupportV1[];
  readonly providerFeasibilitySupportCatalogContentDigest: ContentDigestV1;
  readonly providerFeasibilitySupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1;
  readonly relativePath: ProviderFeasibilitySupportCatalogRelativePathV1;
  readonly targetCount: number;
  readonly candidateCount: number;
  readonly publicSupportRowCount: number;
}

interface DistributionHistoryDiagnosticFailureV1 {
  readonly ok: false;
  readonly stage: ProviderDistributionHistoryCurrentCandidatePointInvalidStageV1;
  readonly reason: ProviderDistributionHistoryCurrentCandidatePointInvalidReasonV1;
}

interface DistributionHistoryDiagnosticSuccessV1 {
  readonly ok: true;
  readonly value: ProviderDistributionHistoryCurrentCandidatePointValidationV1;
}

export type ProviderDistributionHistoryCurrentCandidatePointDiagnosticResultV1 =
  | DistributionHistoryDiagnosticFailureV1
  | DistributionHistoryDiagnosticSuccessV1;

export class ProviderDistributionHistoryCurrentCandidatePointValidationError extends Error {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super("Provider distribution history current candidate validation failed");
    this.name =
      "ProviderDistributionHistoryCurrentCandidatePointValidationError";
    CapturedObjectFreezeV1(this);
  }
}

class DistributionHistoryDiagnosticSignalV1 extends Error {
  constructor(
    readonly stage: ProviderDistributionHistoryCurrentCandidatePointInvalidStageV1,
    readonly reason: ProviderDistributionHistoryCurrentCandidatePointInvalidReasonV1,
  ) {
    super("provider distribution history current candidate diagnostic");
    weakSetAddV1(DistributionHistoryDiagnosticSignalsV1, this);
  }
}

const DistributionHistoryDiagnosticSignalsV1 =
  new CapturedWeakSetV1<object>();

function isDistributionHistoryDiagnosticSignalV1(
  value: unknown,
): value is DistributionHistoryDiagnosticSignalV1 {
  return typeof value === "object" && value !== null &&
    weakSetHasV1(DistributionHistoryDiagnosticSignalsV1, value);
}

function failDistributionHistoryV1(
  stage: ProviderDistributionHistoryCurrentCandidatePointInvalidStageV1,
  reason: ProviderDistributionHistoryCurrentCandidatePointInvalidReasonV1,
): never {
  throw new DistributionHistoryDiagnosticSignalV1(stage, reason);
}

const POINT_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "bootstrapTrustBundle",
  "distributionRootBinding",
  "installationIdentityGenerationId",
  "rootMetadataHistory",
  "registryManifestHistory",
  "publicSupportTaxonomyHistory",
  "releaseMatrixHistory",
  "targetDiscoveryResultHistory",
  "releaseTargetUniverseHistory",
  "providerFeasibilitySupportCatalogHistory",
  "targetDiscoveryFixtureManifests",
  "targetDiscoveryRunnerRuns",
  "realFilesystemSuiteManifests",
  "realFilesystemFixtureCorpusManifests",
  "providerFeasibilitySupportCandidateArtifacts",
  "strictCryptoCapability",
] as const);
type PointInputKeyV1 = (typeof POINT_INPUT_KEYS_V1)[number];
type DetachedPointFieldsV1 = Record<PointInputKeyV1, unknown>;

const MAX_HISTORY_GENERATIONS_V1 = 4096;
const MAX_CANONICAL_ENVELOPE_BYTES_V1 = 16_777_216;
const MAX_C09_1N_OBSERVED_IDENTITIES_V1 = 4_194_304;
const MAX_C09_1N_PRECLONE_WORK_UNITS_V1 = 268_435_456;
const MAX_C09_1N_DEPTH_V1 = 64;
const MAX_C09_1N_TRUST_BRANCH_UNITS_V1 = 4_194_304;
const MAX_C09_1N_DISTRIBUTION_BRANCH_UNITS_V1 = 16_777_216;
const MAX_C09_1N_AGGREGATE_BRANCH_UNITS_V1 = 268_435_456;

interface PreparedDistributionHistoryPointInputV1 {
  readonly fields: DetachedPointFieldsV1;
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
  readonly registryRequest: ValidateProviderRegistryManifestHistoryV1Input;
  readonly registryInputHandle: PreparedRegistryHistoryInputHandleV1;
}

function branchLimitV1(key: PointInputKeyV1): number {
  if (
    key === "rootMetadataHistory" ||
    key === "registryManifestHistory" ||
    key === "publicSupportTaxonomyHistory" ||
    key === "releaseMatrixHistory" ||
    key === "targetDiscoveryResultHistory" ||
    key === "releaseTargetUniverseHistory" ||
    key === "providerFeasibilitySupportCatalogHistory" ||
    key === "targetDiscoveryFixtureManifests" ||
    key === "targetDiscoveryRunnerRuns" ||
    key === "realFilesystemSuiteManifests" ||
    key === "realFilesystemFixtureCorpusManifests" ||
    key === "providerFeasibilitySupportCandidateArtifacts"
  ) {
    return MAX_C09_1N_AGGREGATE_BRANCH_UNITS_V1;
  }
  if (key === "bootstrapTrustBundle") {
    return MAX_C09_1N_TRUST_BRANCH_UNITS_V1;
  }
  return MAX_C09_1N_DISTRIBUTION_BRANCH_UNITS_V1;
}

function prepareDistributionHistoryPointInputV1(
  input: unknown,
): PreparedDistributionHistoryPointInputV1 {
  const admission = createProviderPointRawAdmissionSessionV1(input, {
    maxObservedIdentities: MAX_C09_1N_OBSERVED_IDENTITIES_V1,
    maxPrecloneAllocationWorkUnits: MAX_C09_1N_PRECLONE_WORK_UNITS_V1,
  });
  const captured = captureProviderPointRawExactTopLevelV1(
    admission,
    POINT_INPUT_KEYS_V1,
  );
  const capability = captured.strictCryptoCapability;
  assertProviderStrictEd25519CryptoCapabilityIdentityV1(
    ProviderStrictEd25519AttestationError,
    capability,
  );
  for (let index = 0; index < POINT_INPUT_KEYS_V1.length; index += 1) {
    const key = POINT_INPUT_KEYS_V1[index]!;
    if (key === "strictCryptoCapability") continue;
    const value = captured[key];
    if (value === null || typeof value !== "object") {
      if (
        key !== "installationIdentityGenerationId" ||
        typeof value !== "string" ||
        value.length > MAX_C09_1N_DISTRIBUTION_BRANCH_UNITS_V1
      ) {
        throw new CapturedTypeErrorV1(
          "distribution history point JSON input branch is invalid",
        );
      }
      continue;
    }
    const limit = branchLimitV1(key);
    const budget = createProviderPointRawAdmissionBudgetForSessionV1(
      admission,
      MAX_C09_1N_DEPTH_V1,
      limit,
      limit,
      limit,
    );
    walkProviderPointRawJsonIdentityTreeV1(admission, value, budget);
  }
  const detached = captureProviderPointDetachedExactDataObjectV1(
    cloneProviderPointRawAdmissionCapsuleV1(admission),
    POINT_INPUT_KEYS_V1,
  );
  const fields = createProviderNonThenableFrozenRecordV1({
    bootstrapTrustBundle: deepFreezeProviderPointDetachedDataTreeV1(
      detached.bootstrapTrustBundle,
    ),
    distributionRootBinding: deepFreezeProviderPointDetachedDataTreeV1(
      detached.distributionRootBinding,
    ),
    installationIdentityGenerationId:
      detached.installationIdentityGenerationId,
    rootMetadataHistory: deepFreezeProviderPointDetachedDataTreeV1(
      detached.rootMetadataHistory,
    ),
    registryManifestHistory: deepFreezeProviderPointDetachedDataTreeV1(
      detached.registryManifestHistory,
    ),
    publicSupportTaxonomyHistory: deepFreezeProviderPointDetachedDataTreeV1(
      detached.publicSupportTaxonomyHistory,
    ),
    releaseMatrixHistory: deepFreezeProviderPointDetachedDataTreeV1(
      detached.releaseMatrixHistory,
    ),
    targetDiscoveryResultHistory: deepFreezeProviderPointDetachedDataTreeV1(
      detached.targetDiscoveryResultHistory,
    ),
    releaseTargetUniverseHistory: deepFreezeProviderPointDetachedDataTreeV1(
      detached.releaseTargetUniverseHistory,
    ),
    providerFeasibilitySupportCatalogHistory:
      deepFreezeProviderPointDetachedDataTreeV1(
        detached.providerFeasibilitySupportCatalogHistory,
      ),
    targetDiscoveryFixtureManifests:
      deepFreezeProviderPointDetachedDataTreeV1(
        detached.targetDiscoveryFixtureManifests,
      ),
    targetDiscoveryRunnerRuns: deepFreezeProviderPointDetachedDataTreeV1(
      detached.targetDiscoveryRunnerRuns,
    ),
    realFilesystemSuiteManifests: deepFreezeProviderPointDetachedDataTreeV1(
      detached.realFilesystemSuiteManifests,
    ),
    realFilesystemFixtureCorpusManifests:
      deepFreezeProviderPointDetachedDataTreeV1(
        detached.realFilesystemFixtureCorpusManifests,
      ),
    providerFeasibilitySupportCandidateArtifacts:
      deepFreezeProviderPointDetachedDataTreeV1(
        detached.providerFeasibilitySupportCandidateArtifacts,
      ),
    strictCryptoCapability:
      capability as ProviderStrictEd25519OpaqueCapabilityV1,
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
    strictCryptoCapability:
      capability as ProviderStrictEd25519OpaqueCapabilityV1,
  }) as unknown as ValidateProviderRegistryManifestHistoryV1Input;
  const registrySnapshot = createPreparedRegistryHistorySnapshotInternalV1({
    bootstrapTrustBundle: registryRequest.bootstrapTrustBundle,
    installationIdentityGenerationId:
      registryRequest.installationIdentityGenerationId,
    registryManifestHistory: registryRequest.registryManifestHistory,
    rootMetadataHistory: registryRequest.rootMetadataHistory,
    strictCryptoCapability:
      capability as ProviderStrictEd25519OpaqueCapabilityV1,
  });
  const registryInputHandle = registerPreparedRegistryHistoryInputInternalV1(
    registryRequest,
    registrySnapshot,
    capability as ProviderStrictEd25519OpaqueCapabilityV1,
  );
  return createProviderNonThenableFrozenRecordV1({
    fields,
    strictCryptoCapability:
      capability as ProviderStrictEd25519OpaqueCapabilityV1,
    registryRequest,
    registryInputHandle,
  });
}

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

function lowerHexToBytesV1(hex: string): Uint8Array {
  const bytes = new CapturedUint8ArrayV1(hex.length / 2);
  for (let index = 0; index < bytes.byteLength; index += 1) {
    bytes[index] = CapturedNumberParseIntV1(
      stringSliceV1(hex, index * 2, index * 2 + 2),
      16,
    );
  }
  return bytes;
}

function decodeCanonicalPublicKeyBytes32V1(value: string): Uint8Array {
  if (stringSliceV1(value, 0, "base64url:".length) !== "base64url:") {
    throw new CapturedTypeErrorV1("active root public key is not canonical");
  }
  const encoded = stringSliceV1(value, "base64url:".length);
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  if (encoded.length !== 43) {
    throw new CapturedTypeErrorV1("active root public key length is invalid");
  }
  const bytes = new CapturedUint8ArrayV1(32);
  let buffer = 0;
  let bitCount = 0;
  let outputIndex = 0;
  for (let index = 0; index < encoded.length; index += 1) {
    const valueIndex = stringIndexOfV1(alphabet, encoded[index]!);
    if (valueIndex < 0) {
      throw new CapturedTypeErrorV1("active root public key is invalid");
    }
    buffer = (buffer << 6) | valueIndex;
    bitCount += 6;
    while (bitCount >= 8 && outputIndex < bytes.length) {
      bitCount -= 8;
      bytes[outputIndex] = (buffer >>> bitCount) & 255;
      outputIndex += 1;
    }
  }
  if (outputIndex !== 32) {
    throw new CapturedTypeErrorV1("active root public key is invalid");
  }
  return bytes;
}

interface SignedHistoryPayloadBaseV1 {
  readonly distributionRootBinding: ProviderSignedDistributionRootBindingV1;
  readonly activeRootMetadata: ProviderRegistryRootMetadataPinV1;
  readonly registryRootKeyId: ProviderRegistryRootKeyIdV1;
}

interface SignedHistoryEnvelopeBaseV1<
  TPayload extends SignedHistoryPayloadBaseV1,
> {
  readonly contentDigest: ContentDigestV1;
  readonly payload: TPayload;
}

interface SafeParseSchemaV1<T> {
  safeParse(input: unknown):
    | { readonly success: true; readonly data: T }
    | { readonly success: false };
}

interface SignedHistoryConfigurationV1<
  TPayload extends SignedHistoryPayloadBaseV1,
  TEnvelope extends SignedHistoryEnvelopeBaseV1<TPayload>,
> {
  readonly stage: ProviderDistributionHistoryCurrentCandidatePointInvalidStageV1;
  readonly schema: SafeParseSchemaV1<TEnvelope>;
  readonly signaturePattern: RegExp;
  readonly generationLabel:
    | "taxonomy-generation"
    | "release-matrix-generation"
    | "discovery-generation"
    | "universe-generation"
    | "catalog-generation";
  readonly locator: (generation: number) => object;
  readonly generation: (envelope: TEnvelope) => number;
  readonly payloadGeneration: (payload: TPayload) => number;
  readonly predecessorDigest: (
    payload: TPayload,
  ) => ContentDigestV1 | undefined;
  readonly signature: (payload: TPayload) => string;
  readonly deriveDigest: (payload: TPayload) => ContentDigestV1;
  readonly createSignatureMessage: (
    payload: TPayload,
    rootKeyId: ProviderRegistryRootKeyIdV1,
  ) => Uint8Array;
}

function failRetainedAccountingV1(
  reason:
    | ProviderDistributionRetainedAccountingFailureReasonInternalV1
    | "source_exact_cover_mismatch",
): never {
  return failDistributionHistoryV1("retained_history_accounting", reason);
}

function admitRetainedEnvelopeV1(
  accumulator: ProviderDistributionRetainedAccountingAccumulatorInternalV1,
  distributionRootBinding: ProviderSignedDistributionRootBindingV1,
  locator: object,
  contentDigest: ContentDigestV1,
  envelope: object,
): void {
  try {
    accumulator.admitEnvelope({
      distributionRootBinding,
      locator,
      contentDigest,
      envelope,
    });
  } catch (error) {
    if (isProviderDistributionRetainedAccountingErrorInternalV1(error)) {
      return failRetainedAccountingV1(error.reason);
    }
    throw error;
  }
}

function resolveVerifiedHistoryRootV1(
  rootHistory: readonly ProviderRegistryRootMetadataEnvelopeV1[],
  pin: ProviderRegistryRootMetadataPinV1,
): ProviderRegistryRootPublicKeyV1 | undefined {
  const candidate = rootHistory[pin.rootGeneration - 1];
  if (
    candidate === undefined ||
    candidate.rootGeneration !== pin.rootGeneration ||
    candidate.rootKeyId !== pin.rootKeyId ||
    candidate.contentDigest !== pin.contentDigest ||
    candidate.payload.activeRoot.rootKeyId !== pin.rootKeyId
  ) {
    return undefined;
  }
  return candidate.payload.activeRoot;
}

async function verifyHistoricalRetainedSignatureV1(
  payload: SignedHistoryPayloadBaseV1,
  signature: string,
  signaturePattern: RegExp,
  createSignatureMessage: (
    payload: SignedHistoryPayloadBaseV1,
    rootKeyId: ProviderRegistryRootKeyIdV1,
  ) => Uint8Array,
  rootHistory: readonly ProviderRegistryRootMetadataEnvelopeV1[],
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<void> {
  const activeRoot = resolveVerifiedHistoryRootV1(
    rootHistory,
    payload.activeRootMetadata,
  );
  if (
    activeRoot === undefined ||
    activeRoot.rootKeyId !== payload.registryRootKeyId
  ) {
    return failDistributionHistoryV1(
      "current_source_closure",
      "pin_mismatch",
    );
  }
  const match = regExpExecV1(signaturePattern, signature);
  if (
    match?.[1] === undefined ||
    match[2] === undefined ||
    match[1] !== activeRoot.rootKeyId
  ) {
    return failDistributionHistoryV1(
      "current_source_closure",
      "signature_invalid",
    );
  }
  try {
    const accepted = await hardenProviderPointPromiseV1(
      verifyRawEd25519WithCapabilityV1(
        strictCryptoCapability,
        decodeCanonicalPublicKeyBytes32V1(activeRoot.publicKeyBytes),
        createSignatureMessage(payload, activeRoot.rootKeyId),
        lowerHexToBytesV1(match[2]),
      ),
    );
    if (!accepted) {
      return failDistributionHistoryV1(
        "current_source_closure",
        "signature_invalid",
      );
    }
  } catch (error) {
    if (isDistributionHistoryDiagnosticSignalV1(error)) throw error;
    return failDistributionHistoryV1(
      "current_source_closure",
      "signature_invalid",
    );
  }
}

async function validateSignedHistoryV1<
  TPayload extends SignedHistoryPayloadBaseV1,
  TEnvelope extends SignedHistoryEnvelopeBaseV1<TPayload>,
>(
  input: unknown,
  distributionRootBinding: ProviderSignedDistributionRootBindingV1,
  rootHistory: readonly ProviderRegistryRootMetadataEnvelopeV1[],
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
  retainedAccounting: ProviderDistributionRetainedAccountingAccumulatorInternalV1,
  configuration: SignedHistoryConfigurationV1<TPayload, TEnvelope>,
): Promise<readonly TEnvelope[]> {
  if (!CapturedArrayIsArrayV1(input)) {
    return failDistributionHistoryV1(configuration.stage, "schema_invalid");
  }
  if (input.length === 0) {
    return failDistributionHistoryV1(configuration.stage, "history_empty");
  }
  if (input.length > MAX_HISTORY_GENERATIONS_V1) {
    return failDistributionHistoryV1(
      configuration.stage,
      "history_generation_limit_exceeded",
    );
  }
  const history = input as readonly unknown[];
  let previousRootGeneration = 0;
  for (let index = 0; index < history.length; index += 1) {
    const candidate = history[index];
    if (candidate === null || typeof candidate !== "object") {
      return failDistributionHistoryV1(configuration.stage, "schema_invalid");
    }
    const rawEnvelope = candidate as TEnvelope;
    const rawGeneration = configuration.generation(rawEnvelope);
    if (
      !CapturedNumberIsSafeIntegerV1(rawGeneration) ||
      rawGeneration < 1 ||
      !ContentDigestV1Schema.safeParse(rawEnvelope.contentDigest).success
    ) {
      return failDistributionHistoryV1(configuration.stage, "schema_invalid");
    }
    admitRetainedEnvelopeV1(
      retainedAccounting,
      distributionRootBinding,
      configuration.locator(rawGeneration),
      rawEnvelope.contentDigest,
      candidate,
    );
    if (!configuration.schema.safeParse(candidate).success) {
      return failDistributionHistoryV1(configuration.stage, "schema_invalid");
    }
    const envelope = candidate as TEnvelope;
    const payload = envelope.payload;
    const expectedGeneration = index + 1;
    if (
      configuration.generation(envelope) !== expectedGeneration ||
      configuration.payloadGeneration(payload) !== expectedGeneration
    ) {
      return failDistributionHistoryV1(
        configuration.stage,
        "generation_not_contiguous",
      );
    }
    const predecessorDigest = configuration.predecessorDigest(payload);
    if (
      (index === 0 && predecessorDigest !== undefined) ||
      (index > 0 && predecessorDigest !==
        (history[index - 1] as TEnvelope).contentDigest)
    ) {
      return failDistributionHistoryV1(
        configuration.stage,
        "predecessor_digest_mismatch",
      );
    }
    if (envelope.contentDigest !== configuration.deriveDigest(payload)) {
      return failDistributionHistoryV1(
        configuration.stage,
        "digest_mismatch",
      );
    }
    if (
      !canonicalEqualV1(
        payload.distributionRootBinding,
        distributionRootBinding,
      )
    ) {
      return failDistributionHistoryV1(
        configuration.stage,
        "distribution_binding_mismatch",
      );
    }
    const activeRoot = resolveVerifiedHistoryRootV1(
      rootHistory,
      payload.activeRootMetadata,
    );
    if (
      activeRoot === undefined ||
      activeRoot.rootKeyId !== payload.registryRootKeyId
    ) {
      return failDistributionHistoryV1(
        configuration.stage,
        "active_root_mismatch",
      );
    }
    if (payload.activeRootMetadata.rootGeneration < previousRootGeneration) {
      return failDistributionHistoryV1(
        configuration.stage,
        "active_root_rollback",
      );
    }
    previousRootGeneration = payload.activeRootMetadata.rootGeneration;
    try {
      encodeStoreFilenameKeyV1(
        `${configuration.generationLabel}:${expectedGeneration}`,
      );
    } catch {
      return failDistributionHistoryV1(
        configuration.stage,
        "locator_invalid",
      );
    }
    if (index < history.length - 1) {
      const match = regExpExecV1(
        configuration.signaturePattern,
        configuration.signature(payload),
      );
      if (
        match?.[1] === undefined ||
        match[2] === undefined ||
        match[1] !== activeRoot.rootKeyId
      ) {
        return failDistributionHistoryV1(
          configuration.stage,
          "signature_invalid",
        );
      }
      try {
        const accepted = await hardenProviderPointPromiseV1(
          verifyRawEd25519WithCapabilityV1(
            strictCryptoCapability,
            decodeCanonicalPublicKeyBytes32V1(activeRoot.publicKeyBytes),
            configuration.createSignatureMessage(
              payload,
              activeRoot.rootKeyId,
            ),
            lowerHexToBytesV1(match[2]),
          ),
        );
        if (!accepted) {
          return failDistributionHistoryV1(
            configuration.stage,
            "signature_invalid",
          );
        }
      } catch (error) {
        if (isDistributionHistoryDiagnosticSignalV1(error)) throw error;
        return failDistributionHistoryV1(
          configuration.stage,
          "signature_invalid",
        );
      }
    }
  }
  return input as readonly TEnvelope[];
}

const TAXONOMY_SIGNATURE_PATTERN_V1 =
  /^provider-public-support-taxonomy-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;
const MATRIX_SIGNATURE_PATTERN_V1 =
  /^provider-release-matrix-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;
const DISCOVERY_SIGNATURE_PATTERN_V1 =
  /^provider-target-discovery-result-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;
const UNIVERSE_SIGNATURE_PATTERN_V1 =
  /^provider-release-target-universe-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;
const CATALOG_SIGNATURE_PATTERN_V1 =
  /^provider-support-catalog-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;
const BUNDLE_SIGNATURE_PATTERN_V1 =
  /^provider-target-discovery-input-bundle-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;
const SUITE_SIGNATURE_PATTERN_V1 =
  /^provider-real-fs-suite-manifest-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;
const CORPUS_SIGNATURE_PATTERN_V1 =
  /^provider-real-fs-fixture-corpus-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;

function pinMatchesHistoryV1<TEnvelope extends { readonly contentDigest: ContentDigestV1 }>(
  history: readonly TEnvelope[],
  generation: number,
  contentDigest: ContentDigestV1,
): boolean {
  const envelope = history[generation - 1];
  return envelope !== undefined && envelope.contentDigest === contentDigest;
}

function validateHistoryPinClosureV1(
  taxonomyHistory: readonly ProviderPublicSupportTaxonomyEnvelopeV1[],
  matrixHistory: readonly ProviderReleaseMatrixEnvelopeV1[],
  discoveryHistory: readonly ProviderTargetDiscoveryResultEnvelopeV1[],
  universeHistory: readonly ProviderReleaseTargetUniverseEnvelopeV1[],
  catalogHistory: readonly ProviderFeasibilitySupportCatalogEnvelopeV1[],
): void {
  for (let index = 0; index < matrixHistory.length; index += 1) {
    const pin = matrixHistory[index]!.payload.publicSupportTaxonomy;
    if (
      !pinMatchesHistoryV1(
        taxonomyHistory,
        pin.taxonomyGeneration,
        pin.contentDigest,
      )
    ) {
      return failDistributionHistoryV1(
        "history_pin_closure",
        "pin_mismatch",
      );
    }
  }
  for (let index = 0; index < discoveryHistory.length; index += 1) {
    const discovery = discoveryHistory[index]!.payload;
    if (
      !pinMatchesHistoryV1(
        taxonomyHistory,
        discovery.publicSupportTaxonomy.taxonomyGeneration,
        discovery.publicSupportTaxonomy.contentDigest,
      ) ||
      !pinMatchesHistoryV1(
        matrixHistory,
        discovery.targetDiscoveryInputBundle.releaseMatrix
          .releaseMatrixGeneration,
        discovery.targetDiscoveryInputBundle.releaseMatrix.contentDigest,
      )
    ) {
      return failDistributionHistoryV1(
        "history_pin_closure",
        "pin_mismatch",
      );
    }
  }
  let previousMatrixGeneration = 0;
  let previousDiscoveryGeneration = 0;
  for (let index = 0; index < universeHistory.length; index += 1) {
    const universe = universeHistory[index]!.payload;
    const matrixPin = universe.coverageBasis.releaseMatrix;
    const discoveryPin = universe.coverageBasis.targetDiscoveryResult;
    if (
      !pinMatchesHistoryV1(
        taxonomyHistory,
        universe.publicSupportTaxonomy.taxonomyGeneration,
        universe.publicSupportTaxonomy.contentDigest,
      ) ||
      !pinMatchesHistoryV1(
        matrixHistory,
        matrixPin.releaseMatrixGeneration,
        matrixPin.contentDigest,
      ) ||
      !pinMatchesHistoryV1(
        discoveryHistory,
        discoveryPin.discoveryGeneration,
        discoveryPin.contentDigest,
      )
    ) {
      return failDistributionHistoryV1(
        "history_pin_closure",
        "pin_mismatch",
      );
    }
    if (
      matrixPin.releaseMatrixGeneration < previousMatrixGeneration ||
      discoveryPin.discoveryGeneration < previousDiscoveryGeneration
    ) {
      return failDistributionHistoryV1(
        "history_pin_closure",
        "generation_rollback",
      );
    }
    previousMatrixGeneration = matrixPin.releaseMatrixGeneration;
    previousDiscoveryGeneration = discoveryPin.discoveryGeneration;
  }
  let previousTaxonomyGeneration = 0;
  let previousUniverseGeneration = 0;
  for (let index = 0; index < catalogHistory.length; index += 1) {
    const catalog = catalogHistory[index]!.payload;
    if (
      !pinMatchesHistoryV1(
        taxonomyHistory,
        catalog.publicSupportTaxonomy.taxonomyGeneration,
        catalog.publicSupportTaxonomy.contentDigest,
      ) ||
      !pinMatchesHistoryV1(
        universeHistory,
        catalog.releaseTargetUniverse.universeGeneration,
        catalog.releaseTargetUniverse.contentDigest,
      )
    ) {
      return failDistributionHistoryV1(
        "history_pin_closure",
        "pin_mismatch",
      );
    }
    if (
      catalog.publicSupportTaxonomy.taxonomyGeneration <
        previousTaxonomyGeneration ||
      catalog.releaseTargetUniverse.universeGeneration <
        previousUniverseGeneration
    ) {
      return failDistributionHistoryV1(
        "history_pin_closure",
        "generation_rollback",
      );
    }
    previousTaxonomyGeneration =
      catalog.publicSupportTaxonomy.taxonomyGeneration;
    previousUniverseGeneration =
      catalog.releaseTargetUniverse.universeGeneration;
  }
}

interface CurrentSourceClosureV1 {
  readonly fixtureCorpusManifest: ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1;
  readonly suiteManifest: ProviderRealFilesystemSuiteManifestEnvelopeV1;
  readonly targetDiscoveryFixtureManifest: ProviderTargetDiscoveryFixtureManifestEnvelopeV1;
  readonly targetDiscoveryRunnerRun: ProviderTargetDiscoveryRunnerRunEnvelopeV1;
}

interface RetainedSourceCollectionV1<
  TEnvelope extends { readonly contentDigest: ContentDigestV1 },
> {
  readonly entries: readonly unknown[];
  readonly byDigest: Map<ContentDigestV1, object>;
  readonly validatedByDigest: Map<ContentDigestV1, TEnvelope>;
  readonly reachedByDigest: Map<ContentDigestV1, true>;
  readonly schema: SafeParseSchemaV1<TEnvelope>;
  readonly deriveDigest: (payload: object) => ContentDigestV1;
  readonly locator: (contentDigest: ContentDigestV1) => object;
}

function createRetainedSourceCollectionV1<
  TEnvelope extends {
    readonly contentDigest: ContentDigestV1;
    readonly payload: object;
  },
>(
  input: unknown,
  schema: SafeParseSchemaV1<TEnvelope>,
  deriveDigest: (payload: object) => ContentDigestV1,
  locator: (contentDigest: ContentDigestV1) => object,
): RetainedSourceCollectionV1<TEnvelope> {
  if (
    !CapturedArrayIsArrayV1(input) ||
    input.length > MAX_HISTORY_GENERATIONS_V1
  ) {
    return failDistributionHistoryV1(
      "current_source_closure",
      "schema_invalid",
    );
  }
  const byDigest = new CapturedMapV1<ContentDigestV1, object>();
  for (let index = 0; index < input.length; index += 1) {
    const candidate = input[index];
    if (candidate === null || typeof candidate !== "object") {
      return failDistributionHistoryV1(
        "current_source_closure",
        "schema_invalid",
      );
    }
    const parsedDigest = ContentDigestV1Schema.safeParse(
      (candidate as { readonly contentDigest?: unknown }).contentDigest,
    );
    if (!parsedDigest.success) {
      return failDistributionHistoryV1(
        "current_source_closure",
        "schema_invalid",
      );
    }
    if (mapHasV1(byDigest, parsedDigest.data)) {
      return failRetainedAccountingV1("source_exact_cover_mismatch");
    }
    mapSetV1(byDigest, parsedDigest.data, candidate);
  }
  return createProviderNonThenableFrozenRecordV1({
    entries: input as readonly unknown[],
    byDigest,
    validatedByDigest: new CapturedMapV1<ContentDigestV1, TEnvelope>(),
    reachedByDigest: new CapturedMapV1<ContentDigestV1, true>(),
    schema,
    deriveDigest,
    locator,
  });
}

function requireRetainedSourceEnvelopeV1<
  TEnvelope extends {
    readonly contentDigest: ContentDigestV1;
    readonly payload: object;
  },
>(
  collection: RetainedSourceCollectionV1<TEnvelope>,
  contentDigest: ContentDigestV1,
  retainedAccounting: ProviderDistributionRetainedAccountingAccumulatorInternalV1,
  distributionRootBinding: ProviderSignedDistributionRootBindingV1,
): TEnvelope {
  const candidate = mapGetV1(collection.byDigest, contentDigest);
  if (candidate === undefined) {
    return failRetainedAccountingV1("source_exact_cover_mismatch");
  }
  let envelope = mapGetV1(collection.validatedByDigest, contentDigest);
  if (envelope === undefined) {
    admitRetainedEnvelopeV1(
      retainedAccounting,
      distributionRootBinding,
      collection.locator(contentDigest),
      contentDigest,
      candidate,
    );
    if (!collection.schema.safeParse(candidate).success) {
      return failDistributionHistoryV1(
        "current_source_closure",
        "schema_invalid",
      );
    }
    envelope = candidate as TEnvelope;
    if (envelope.contentDigest !== collection.deriveDigest(envelope.payload)) {
      return failDistributionHistoryV1(
        "current_source_closure",
        "digest_mismatch",
      );
    }
    mapSetV1(collection.validatedByDigest, contentDigest, envelope);
  }
  mapSetV1(collection.reachedByDigest, contentDigest, true);
  return envelope;
}

function assertRetainedSourceExactCoverV1<
  TEnvelope extends {
    readonly contentDigest: ContentDigestV1;
    readonly payload: object;
  },
>(collection: RetainedSourceCollectionV1<TEnvelope>): void {
  for (let index = 0; index < collection.entries.length; index += 1) {
    const candidate = collection.entries[index] as {
      readonly contentDigest: ContentDigestV1;
    };
    if (!mapHasV1(collection.reachedByDigest, candidate.contentDigest)) {
      return failRetainedAccountingV1("source_exact_cover_mismatch");
    }
  }
}

function admitRetainedEmbeddedBundleV1(
  retainedAccounting: ProviderDistributionRetainedAccountingAccumulatorInternalV1,
  distributionRootBinding: ProviderSignedDistributionRootBindingV1,
  discoveryEnvelope: ProviderTargetDiscoveryResultEnvelopeV1,
): void {
  try {
    retainedAccounting.admitEmbeddedTargetDiscoveryInputBundle({
      distributionRootBinding,
      parentDiscoveryContentDigest: discoveryEnvelope.contentDigest,
      bundleContentDigest:
        discoveryEnvelope.payload.targetDiscoveryInputBundleContentDigest,
      bundle: discoveryEnvelope.payload.targetDiscoveryInputBundle,
    });
  } catch (error) {
    if (isProviderDistributionRetainedAccountingErrorInternalV1(error)) {
      return failRetainedAccountingV1(error.reason);
    }
    throw error;
  }
}

function validateSourceDistributionBindingV1(
  payload: {
    readonly distributionRootBinding: ProviderSignedDistributionRootBindingV1;
    readonly releaseRevisionDigest: ContentDigestV1;
  },
  distributionRootBinding: ProviderSignedDistributionRootBindingV1,
): void {
  if (
    !canonicalEqualV1(
      payload.distributionRootBinding,
      distributionRootBinding,
    ) ||
    payload.releaseRevisionDigest !==
      distributionRootBinding.releaseRevisionDigest
  ) {
    return failDistributionHistoryV1(
      "current_source_closure",
      "distribution_binding_mismatch",
    );
  }
}

async function resolveRetainedSourceClosureV1(
  fields: DetachedPointFieldsV1,
  discoveryHistory: readonly ProviderTargetDiscoveryResultEnvelopeV1[],
  rootHistory: readonly ProviderRegistryRootMetadataEnvelopeV1[],
  distributionRootBinding: ProviderSignedDistributionRootBindingV1,
  retainedAccounting: ProviderDistributionRetainedAccountingAccumulatorInternalV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<CurrentSourceClosureV1> {
  const fixtures = createRetainedSourceCollectionV1(
    fields.targetDiscoveryFixtureManifests,
    ProviderTargetDiscoveryFixtureManifestEnvelopeV1Schema,
    deriveProviderTargetDiscoveryFixtureManifestContentDigestV1,
    (contentDigest) =>
      createProviderNonThenableFrozenRecordV1({
        locatorProfile:
          "distribution_provider_real_fs_fixture_manifest_v1" as const,
        contentDigest,
      }),
  );
  const runners = createRetainedSourceCollectionV1(
    fields.targetDiscoveryRunnerRuns,
    ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema,
    deriveProviderTargetDiscoveryRunnerRunManifestContentDigestV1,
    (runManifestContentDigest) =>
      createProviderNonThenableFrozenRecordV1({
        locatorProfile:
          "distribution_provider_target_discovery_runner_run_v1" as const,
        runManifestContentDigest,
      }),
  );
  const suites = createRetainedSourceCollectionV1(
    fields.realFilesystemSuiteManifests,
    ProviderRealFilesystemSuiteManifestEnvelopeV1Schema,
    deriveProviderRealFilesystemSuiteManifestContentDigestV1,
    (contentDigest) =>
      createProviderNonThenableFrozenRecordV1({
        locatorProfile:
          "distribution_provider_real_fs_suite_manifest_v1" as const,
        contentDigest,
      }),
  );
  const corpora = createRetainedSourceCollectionV1(
    fields.realFilesystemFixtureCorpusManifests,
    ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema,
    deriveProviderRealFilesystemFixtureCorpusManifestContentDigestV1,
    (contentDigest) =>
      createProviderNonThenableFrozenRecordV1({
        locatorProfile:
          "distribution_provider_real_fs_fixture_corpus_manifest_v1" as const,
        contentDigest,
      }),
  );
  let currentSourceClosure: CurrentSourceClosureV1 | undefined;
  for (let index = 0; index < discoveryHistory.length; index += 1) {
    const discoveryEnvelope = discoveryHistory[index]!;
    const discovery = discoveryEnvelope.payload;
    const bundle = discovery.targetDiscoveryInputBundle;
    admitRetainedEmbeddedBundleV1(
      retainedAccounting,
      distributionRootBinding,
      discoveryEnvelope,
    );
    if (
      discovery.targetDiscoveryInputBundleContentDigest !==
        deriveProviderTargetDiscoveryInputBundleContentDigestV1(bundle) ||
      !canonicalEqualV1(
        bundle.distributionRootBinding,
        distributionRootBinding,
      ) ||
      !canonicalEqualV1(
        bundle.activeRootMetadata,
        discovery.activeRootMetadata,
      ) ||
      bundle.registryRootKeyId !== discovery.registryRootKeyId ||
      !canonicalEqualV1(
        bundle.publicSupportTaxonomy,
        discovery.publicSupportTaxonomy,
      )
    ) {
      return failDistributionHistoryV1(
        "current_source_closure",
        "digest_mismatch",
      );
    }
    if (index < discoveryHistory.length - 1) {
      await verifyHistoricalRetainedSignatureV1(
        bundle,
        bundle.bundleSignature,
        BUNDLE_SIGNATURE_PATTERN_V1,
        createProviderTargetDiscoveryInputBundleSignatureMessageV1,
        rootHistory,
        strictCryptoCapability,
      );
    }

    const targetDiscoveryFixtureManifest = requireRetainedSourceEnvelopeV1(
      fixtures,
      bundle.realFilesystemFixtureManifest.contentDigest,
      retainedAccounting,
      distributionRootBinding,
    );
    const fixture = targetDiscoveryFixtureManifest.payload;
    validateSourceDistributionBindingV1(fixture, distributionRootBinding);
    if (
      targetDiscoveryFixtureManifest.fixtureManifestDigest !==
        fixture.fixtureManifestDigest ||
      !canonicalEqualV1(bundle.realFilesystemFixtureManifest, {
        locatorProfile:
          "distribution_provider_real_fs_fixture_manifest_v1",
        realFilesystemSuiteManifest:
          fixture.realFilesystemSuiteManifest,
        realFilesystemSuiteDigest: fixture.realFilesystemSuiteDigest,
        fixtureManifestDigest: fixture.fixtureManifestDigest,
        contentDigest: targetDiscoveryFixtureManifest.contentDigest,
      })
    ) {
      return failDistributionHistoryV1(
        "current_source_closure",
        "pin_mismatch",
      );
    }

    const targetDiscoveryRunnerRun = requireRetainedSourceEnvelopeV1(
      runners,
      bundle.targetDiscoveryRunner.runManifestContentDigest,
      retainedAccounting,
      distributionRootBinding,
    );
    const runner = targetDiscoveryRunnerRun.payload;
    validateSourceDistributionBindingV1(runner, distributionRootBinding);
    if (
      !canonicalEqualV1(bundle.targetDiscoveryRunner, {
        locatorProfile:
          "distribution_provider_target_discovery_runner_run_v1",
        producerName: runner.producerName,
        producerVersion: runner.producerVersion,
        implementationDigest: runner.implementationDigest,
        binaryAttestationDigest: runner.binaryAttestationDigest,
        runnerProfileDigest: runner.runnerProfileDigest,
        runManifestContentDigest: targetDiscoveryRunnerRun.contentDigest,
        releaseRevisionDigest: runner.releaseRevisionDigest,
        executedAt: runner.executedAt,
      })
    ) {
      return failDistributionHistoryV1(
        "current_source_closure",
        "pin_mismatch",
      );
    }

    const suiteManifest = requireRetainedSourceEnvelopeV1(
      suites,
      fixture.realFilesystemSuiteManifest.contentDigest,
      retainedAccounting,
      distributionRootBinding,
    );
    const suite = suiteManifest.payload;
    validateSourceDistributionBindingV1(suite, distributionRootBinding);
    if (
      resolveVerifiedHistoryRootV1(rootHistory, suite.activeRootMetadata)
          ?.rootKeyId !== suite.registryRootKeyId ||
      !canonicalEqualV1(fixture.realFilesystemSuiteManifest, {
        locatorProfile: "distribution_provider_real_fs_suite_manifest_v1",
        distributionRootBinding,
        suiteDigest: suite.suiteDigest,
        fixtureManifestDigest:
          suite.fixtureCorpusManifest.fixtureManifestDigest,
        contentDigest: suiteManifest.contentDigest,
      }) ||
      fixture.realFilesystemSuiteDigest !== suite.suiteDigest ||
      fixture.fixtureManifestDigest !==
        suite.fixtureCorpusManifest.fixtureManifestDigest
    ) {
      return failDistributionHistoryV1(
        "current_source_closure",
        "pin_mismatch",
      );
    }

    const fixtureCorpusManifest = requireRetainedSourceEnvelopeV1(
      corpora,
      suite.fixtureCorpusManifest.contentDigest,
      retainedAccounting,
      distributionRootBinding,
    );
    const corpus = fixtureCorpusManifest.payload;
    validateSourceDistributionBindingV1(corpus, distributionRootBinding);
    if (
      resolveVerifiedHistoryRootV1(rootHistory, corpus.activeRootMetadata)
          ?.rootKeyId !== corpus.registryRootKeyId ||
      !canonicalEqualV1(suite.fixtureCorpusManifest, {
        locatorProfile:
          "distribution_provider_real_fs_fixture_corpus_manifest_v1",
        distributionRootBinding,
        fixtureManifestDigest: corpus.fixtureManifestDigest,
        contentDigest: fixtureCorpusManifest.contentDigest,
      })
    ) {
      return failDistributionHistoryV1(
        "current_source_closure",
        "pin_mismatch",
      );
    }

    if (index === discoveryHistory.length - 1) {
      currentSourceClosure = createProviderNonThenableFrozenRecordV1({
        fixtureCorpusManifest,
        suiteManifest,
        targetDiscoveryFixtureManifest,
        targetDiscoveryRunnerRun,
      });
    }
  }
  assertRetainedSourceExactCoverV1(fixtures);
  assertRetainedSourceExactCoverV1(runners);
  assertRetainedSourceExactCoverV1(suites);
  assertRetainedSourceExactCoverV1(corpora);
  if (currentSourceClosure === undefined) {
    return failRetainedAccountingV1("source_exact_cover_mismatch");
  }
  for (let index = 0; index < suites.entries.length; index += 1) {
    const contentDigest = (
      suites.entries[index] as { readonly contentDigest: ContentDigestV1 }
    ).contentDigest;
    if (contentDigest === currentSourceClosure.suiteManifest.contentDigest) {
      continue;
    }
    const suiteManifest = mapGetV1(suites.validatedByDigest, contentDigest);
    if (suiteManifest === undefined) {
      return failRetainedAccountingV1("source_exact_cover_mismatch");
    }
    await verifyHistoricalRetainedSignatureV1(
      suiteManifest.payload,
      suiteManifest.payload.suiteSignature,
      SUITE_SIGNATURE_PATTERN_V1,
      createProviderRealFilesystemSuiteManifestSignatureMessageV1,
      rootHistory,
      strictCryptoCapability,
    );
  }
  for (let index = 0; index < corpora.entries.length; index += 1) {
    const contentDigest = (
      corpora.entries[index] as { readonly contentDigest: ContentDigestV1 }
    ).contentDigest;
    if (
      contentDigest === currentSourceClosure.fixtureCorpusManifest.contentDigest
    ) {
      continue;
    }
    const fixtureCorpusManifest = mapGetV1(
      corpora.validatedByDigest,
      contentDigest,
    );
    if (fixtureCorpusManifest === undefined) {
      return failRetainedAccountingV1("source_exact_cover_mismatch");
    }
    await verifyHistoricalRetainedSignatureV1(
      fixtureCorpusManifest.payload,
      fixtureCorpusManifest.payload.corpusSignature,
      CORPUS_SIGNATURE_PATTERN_V1,
      createProviderRealFilesystemFixtureCorpusManifestSignatureMessageV1,
      rootHistory,
      strictCryptoCapability,
    );
  }
  return currentSourceClosure;
}

function registerHistoricalSemanticWitnessV1(
  kind: ProviderDistributionHistoricalSignedObjectKindInternalV1,
  signedObject: object,
  ownerHistoryIndex: number,
  ownerHistoryLength: number,
  stage: ProviderDistributionHistoryCurrentCandidatePointInvalidStageV1,
) {
  try {
    return registerProviderDistributionHistoricalVerifiedSignatureInternalV1(
      kind,
      signedObject,
      ownerHistoryIndex,
      ownerHistoryLength,
    );
  } catch {
    return failDistributionHistoryV1(stage, "source_invalid");
  }
}

function requireHistoricalSemanticTokenV1<T>(
  token: T | undefined,
  stage: ProviderDistributionHistoryCurrentCandidatePointInvalidStageV1,
): T {
  if (token === undefined) {
    return failDistributionHistoryV1(stage, "source_invalid");
  }
  return token;
}

function indexRetainedSourcesByDigestV1<
  TEnvelope extends { readonly contentDigest: ContentDigestV1 },
>(input: unknown): Map<ContentDigestV1, TEnvelope> {
  const output = new CapturedMapV1<ContentDigestV1, TEnvelope>();
  const entries = input as readonly TEnvelope[];
  for (let index = 0; index < entries.length; index += 1) {
    const envelope = entries[index]!;
    mapSetV1(output, envelope.contentDigest, envelope);
  }
  return output;
}

function validateNonTipHistoricalSemanticsV1(
  fields: DetachedPointFieldsV1,
  taxonomyHistory: readonly ProviderPublicSupportTaxonomyEnvelopeV1[],
  matrixHistory: readonly ProviderReleaseMatrixEnvelopeV1[],
  discoveryHistory: readonly ProviderTargetDiscoveryResultEnvelopeV1[],
  universeHistory: readonly ProviderReleaseTargetUniverseEnvelopeV1[],
  catalogHistory: readonly ProviderFeasibilitySupportCatalogEnvelopeV1[],
  currentTipTokens: ProviderDistributionCurrentTipSemanticTokensInternalV1,
): void {
  if (
    taxonomyHistory.length === 1 &&
    matrixHistory.length === 1 &&
    discoveryHistory.length === 1 &&
    universeHistory.length === 1 &&
    catalogHistory.length === 1
  ) {
    return;
  }

  const taxonomyTokens: Array<
    ProviderDistributionHistoricalTaxonomySemanticTokenInternalV1 | undefined
  > = [];
  taxonomyTokens[taxonomyHistory.length - 1] = currentTipTokens.taxonomyToken;
  for (let index = 0; index < taxonomyHistory.length - 1; index += 1) {
    const envelope = taxonomyHistory[index]!;
    taxonomyTokens[index] = requireHistoricalSemanticTokenV1(
      validateProviderDistributionHistoricalTaxonomySemanticInternalV1(
        envelope,
        registerHistoricalSemanticWitnessV1(
          "public_support_taxonomy",
          envelope.payload,
          index,
          taxonomyHistory.length,
          "public_support_taxonomy_history",
        ),
      ),
      "public_support_taxonomy_history",
    );
  }

  const matrixTokens: Array<
    ProviderDistributionHistoricalMatrixSemanticTokenInternalV1 | undefined
  > = [];
  matrixTokens[matrixHistory.length - 1] = currentTipTokens.matrixToken;
  for (let index = 0; index < matrixHistory.length - 1; index += 1) {
    const envelope = matrixHistory[index]!;
    const taxonomyIndex =
      envelope.payload.publicSupportTaxonomy.taxonomyGeneration - 1;
    const taxonomyEnvelope = taxonomyHistory[taxonomyIndex];
    const taxonomyToken = taxonomyTokens[taxonomyIndex];
    if (taxonomyEnvelope === undefined || taxonomyToken === undefined) {
      return failDistributionHistoryV1(
        "release_matrix_history",
        "source_invalid",
      );
    }
    matrixTokens[index] = requireHistoricalSemanticTokenV1(
      validateProviderDistributionHistoricalMatrixSemanticInternalV1(
        envelope,
        taxonomyEnvelope,
        taxonomyToken,
        registerHistoricalSemanticWitnessV1(
          "release_matrix",
          envelope.payload,
          index,
          matrixHistory.length,
          "release_matrix_history",
        ),
      ),
      "release_matrix_history",
    );
  }

  const fixturesByDigest = indexRetainedSourcesByDigestV1<
    ProviderTargetDiscoveryFixtureManifestEnvelopeV1
  >(fields.targetDiscoveryFixtureManifests);
  const runnersByDigest = indexRetainedSourcesByDigestV1<
    ProviderTargetDiscoveryRunnerRunEnvelopeV1
  >(fields.targetDiscoveryRunnerRuns);
  const suitesByDigest = indexRetainedSourcesByDigestV1<
    ProviderRealFilesystemSuiteManifestEnvelopeV1
  >(fields.realFilesystemSuiteManifests);
  const corporaByDigest = indexRetainedSourcesByDigestV1<
    ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1
  >(fields.realFilesystemFixtureCorpusManifests);
  const corpusTokens = new CapturedMapV1<
    ContentDigestV1,
    ProviderDistributionHistoricalCorpusSemanticTokenInternalV1
  >();
  const suiteTokens = new CapturedMapV1<
    ContentDigestV1,
    ProviderDistributionHistoricalSuiteSemanticTokenInternalV1
  >();
  const resultTokens: Array<
    ProviderDistributionHistoricalResultSemanticTokenInternalV1 | undefined
  > = [];
  resultTokens[discoveryHistory.length - 1] = currentTipTokens.resultToken;
  const currentDiscovery = discoveryHistory[discoveryHistory.length - 1]!;
  const currentSuiteDigest = currentDiscovery.payload.targetDiscoveryInputBundle
    .realFilesystemFixtureManifest.realFilesystemSuiteManifest.contentDigest;
  const currentSuite = mapGetV1(suitesByDigest, currentSuiteDigest);
  const currentCorpusDigest = currentSuite?.payload.fixtureCorpusManifest
    .contentDigest;
  const currentCorpus = currentCorpusDigest === undefined
    ? undefined
    : mapGetV1(corporaByDigest, currentCorpusDigest);
  if (currentSuite === undefined || currentCorpus === undefined) {
    return failDistributionHistoryV1(
      "current_source_closure",
      "source_invalid",
    );
  }
  mapSetV1(
    corpusTokens,
    currentCorpus.contentDigest,
    currentTipTokens.corpusToken,
  );
  mapSetV1(
    suiteTokens,
    currentSuite.contentDigest,
    currentTipTokens.suiteToken,
  );

  for (let index = 0; index < discoveryHistory.length - 1; index += 1) {
    const resultEnvelope = discoveryHistory[index]!;
    const bundle = resultEnvelope.payload.targetDiscoveryInputBundle;
    const taxonomyIndex = bundle.publicSupportTaxonomy.taxonomyGeneration - 1;
    const matrixIndex = bundle.releaseMatrix.releaseMatrixGeneration - 1;
    const taxonomyEnvelope = taxonomyHistory[taxonomyIndex];
    const taxonomyToken = taxonomyTokens[taxonomyIndex];
    const matrixEnvelope = matrixHistory[matrixIndex];
    const matrixToken = matrixTokens[matrixIndex];
    const fixtureEnvelope = mapGetV1(
      fixturesByDigest,
      bundle.realFilesystemFixtureManifest.contentDigest,
    );
    const runnerEnvelope = mapGetV1(
      runnersByDigest,
      bundle.targetDiscoveryRunner.runManifestContentDigest,
    );
    const suiteEnvelope = fixtureEnvelope === undefined
      ? undefined
      : mapGetV1(
        suitesByDigest,
        fixtureEnvelope.payload.realFilesystemSuiteManifest.contentDigest,
      );
    const corpusEnvelope = suiteEnvelope === undefined
      ? undefined
      : mapGetV1(
        corporaByDigest,
        suiteEnvelope.payload.fixtureCorpusManifest.contentDigest,
      );
    if (
      taxonomyEnvelope === undefined ||
      taxonomyToken === undefined ||
      matrixEnvelope === undefined ||
      matrixToken === undefined ||
      fixtureEnvelope === undefined ||
      runnerEnvelope === undefined ||
      suiteEnvelope === undefined ||
      corpusEnvelope === undefined
    ) {
      return failDistributionHistoryV1(
        "current_source_closure",
        "source_invalid",
      );
    }

    let corpusToken = mapGetV1(
      corpusTokens,
      corpusEnvelope.contentDigest,
    );
    if (corpusToken === undefined) {
      corpusToken = requireHistoricalSemanticTokenV1(
        validateProviderDistributionHistoricalCorpusSemanticInternalV1(
          corpusEnvelope,
          registerHistoricalSemanticWitnessV1(
            "real_filesystem_fixture_corpus",
            corpusEnvelope.payload,
            index,
            discoveryHistory.length,
            "current_source_closure",
          ),
        ),
        "current_source_closure",
      );
      mapSetV1(corpusTokens, corpusEnvelope.contentDigest, corpusToken);
    }
    let suiteToken = mapGetV1(suiteTokens, suiteEnvelope.contentDigest);
    if (suiteToken === undefined) {
      suiteToken = requireHistoricalSemanticTokenV1(
        validateProviderDistributionHistoricalSuiteSemanticInternalV1(
          suiteEnvelope,
          corpusEnvelope,
          corpusToken,
          registerHistoricalSemanticWitnessV1(
            "real_filesystem_suite",
            suiteEnvelope.payload,
            index,
            discoveryHistory.length,
            "current_source_closure",
          ),
        ),
        "current_source_closure",
      );
      mapSetV1(suiteTokens, suiteEnvelope.contentDigest, suiteToken);
    }
    const bundleToken = requireHistoricalSemanticTokenV1(
      validateProviderDistributionHistoricalBundleSemanticInternalV1(
        createProviderNonThenableFrozenRecordV1({
          bundle,
          fixtureEnvelope,
          runnerEnvelope,
          taxonomyEnvelope,
          taxonomyToken,
          matrixEnvelope,
          matrixToken,
          suiteEnvelope,
          suiteToken,
        }),
        registerHistoricalSemanticWitnessV1(
          "target_discovery_input_bundle",
          bundle,
          index,
          discoveryHistory.length,
          "current_source_closure",
        ),
      ),
      "current_source_closure",
    );
    resultTokens[index] = requireHistoricalSemanticTokenV1(
      validateProviderDistributionHistoricalResultSemanticInternalV1(
        resultEnvelope,
        bundle,
        bundleToken,
        registerHistoricalSemanticWitnessV1(
          "target_discovery_result",
          resultEnvelope.payload,
          index,
          discoveryHistory.length,
          "target_discovery_result_history",
        ),
      ),
      "target_discovery_result_history",
    );
  }

  const universeTokens: Array<
    ProviderDistributionHistoricalUniverseSemanticTokenInternalV1 | undefined
  > = [];
  universeTokens[universeHistory.length - 1] = currentTipTokens.universeToken;
  for (let index = 0; index < universeHistory.length - 1; index += 1) {
    const envelope = universeHistory[index]!;
    const resultIndex =
      envelope.payload.coverageBasis.targetDiscoveryResult
        .discoveryGeneration - 1;
    const resultEnvelope = discoveryHistory[resultIndex];
    const resultToken = resultTokens[resultIndex];
    if (resultEnvelope === undefined || resultToken === undefined) {
      return failDistributionHistoryV1(
        "release_target_universe_history",
        "source_invalid",
      );
    }
    universeTokens[index] = requireHistoricalSemanticTokenV1(
      validateProviderDistributionHistoricalUniverseSemanticInternalV1(
        envelope,
        resultEnvelope,
        resultToken,
        registerHistoricalSemanticWitnessV1(
          "release_target_universe",
          envelope.payload,
          index,
          universeHistory.length,
          "release_target_universe_history",
        ),
      ),
      "release_target_universe_history",
    );
  }

  for (let index = 0; index < catalogHistory.length - 1; index += 1) {
    const envelope = catalogHistory[index]!;
    const universeIndex =
      envelope.payload.releaseTargetUniverse.universeGeneration - 1;
    const universeEnvelope = universeHistory[universeIndex];
    const universeToken = universeTokens[universeIndex];
    if (universeEnvelope === undefined || universeToken === undefined) {
      return failDistributionHistoryV1(
        "provider_feasibility_support_catalog_history",
        "source_invalid",
      );
    }
    requireHistoricalSemanticTokenV1(
      validateProviderDistributionHistoricalCatalogSemanticInternalV1(
        envelope,
        universeEnvelope,
        universeToken,
        registerHistoricalSemanticWitnessV1(
          "feasibility_support_catalog",
          envelope.payload,
          index,
          catalogHistory.length,
          "provider_feasibility_support_catalog_history",
        ),
      ),
      "provider_feasibility_support_catalog_history",
    );
  }
}

function createCatalogRequestV1(
  fields: DetachedPointFieldsV1,
  activeRoot: ProviderRegistryRootPublicKeyV1,
  taxonomyTip: ProviderPublicSupportTaxonomyEnvelopeV1,
  matrixTip: ProviderReleaseMatrixEnvelopeV1,
  discoveryTip: ProviderTargetDiscoveryResultEnvelopeV1,
  universeTip: ProviderReleaseTargetUniverseEnvelopeV1,
  catalogTip: ProviderFeasibilitySupportCatalogEnvelopeV1,
  sourceClosure: CurrentSourceClosureV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): ValidateProviderFeasibilitySupportCatalogPointClosureV1Input {
  // The prepared Catalog request must itself remain a JSON identity tree.
  // These two small records also occur inside retained history Envelopes, so
  // project fresh frozen scalar records instead of aliasing those identities.
  const detachedActiveRoot = createProviderNonThenableFrozenRecordV1({
    profile: activeRoot.profile,
    rootKeyId: activeRoot.rootKeyId,
    algorithm: activeRoot.algorithm,
    publicKeyBytes: activeRoot.publicKeyBytes,
    publicKeyDigest: activeRoot.publicKeyDigest,
  }) as ProviderRegistryRootPublicKeyV1;
  const detachedActiveRootMetadata =
    createProviderNonThenableFrozenRecordV1({
      locatorProfile: catalogTip.payload.activeRootMetadata.locatorProfile,
      rootGeneration: catalogTip.payload.activeRootMetadata.rootGeneration,
      rootKeyId: catalogTip.payload.activeRootMetadata.rootKeyId,
      contentDigest: catalogTip.payload.activeRootMetadata.contentDigest,
    }) as ProviderRegistryRootMetadataPinV1;
  return createProviderNonThenableFrozenRecordV1({
    activeRoot: detachedActiveRoot,
    activeRootMetadata: detachedActiveRootMetadata,
    bootstrapTrustBundle:
      fields.bootstrapTrustBundle as ProviderBootstrapTrustBundleV1,
    distributionRootBinding:
      fields.distributionRootBinding as ProviderSignedDistributionRootBindingV1,
    fixtureCorpusManifest: sourceClosure.fixtureCorpusManifest,
    installationIdentityGenerationId:
      fields.installationIdentityGenerationId as InstallationIdentityGenerationIdV1,
    providerFeasibilitySupportCandidateArtifacts:
      fields.providerFeasibilitySupportCandidateArtifacts as readonly ProviderFeasibilitySupportCandidateArtifactV1[],
    providerFeasibilitySupportCatalog: catalogTip,
    publicSupportTaxonomy: taxonomyTip,
    registryManifestHistory:
      fields.registryManifestHistory as readonly ProviderRegistryManifestEnvelopeV1[],
    releaseMatrix: matrixTip,
    releaseTargetUniverse: universeTip,
    rootMetadataHistory:
      fields.rootMetadataHistory as readonly ProviderRegistryRootMetadataEnvelopeV1[],
    strictCryptoCapability,
    suiteManifest: sourceClosure.suiteManifest,
    targetDiscoveryFixtureManifest:
      sourceClosure.targetDiscoveryFixtureManifest,
    targetDiscoveryResult: discoveryTip,
    targetDiscoveryRunnerRun: sourceClosure.targetDiscoveryRunnerRun,
  });
}

async function validateDistributionHistoryPointInternalV1(
  prepared: PreparedDistributionHistoryPointInputV1,
): Promise<ProviderDistributionHistoryCurrentCandidatePointValidationV1> {
  const { fields, strictCryptoCapability } = prepared;
  let registryClosure: ProviderRegistryManifestHistoryValidationV1 | undefined;
  let registryTrustWitnessHandle: RegistryTrustWitnessHandleV1 | undefined;
  try {
    if (
      !ProviderSignedDistributionRootBindingV1Schema.safeParse(
        fields.distributionRootBinding,
      ).success
    ) {
      return failDistributionHistoryV1("input", "schema_invalid");
    }
    let registryDiagnostic;
    try {
      registryDiagnostic = await hardenProviderPointPromiseV1(
        diagnoseProviderRegistryManifestHistoryPreparedInternalV1(
          prepared.registryRequest,
          prepared.registryInputHandle,
          strictCryptoCapability,
        ),
      );
    } catch {
      return failDistributionHistoryV1(
        "registry_history_closure",
        "source_invalid",
      );
    }
    if (!registryDiagnostic.ok) {
      return failDistributionHistoryV1(
        "registry_history_closure",
        "source_invalid",
      );
    }
    registryClosure = registryDiagnostic.value.closure;
    registryTrustWitnessHandle =
      registryDiagnostic.value.registryTrustWitnessHandle;
    const rootHistory = registryClosure.rootMetadataHistory;
    const distributionRootBinding =
      fields.distributionRootBinding as ProviderSignedDistributionRootBindingV1;
    const retainedAccounting =
      createProviderDistributionRetainedAccountingAccumulatorInternalV1();

    const taxonomyHistory = await validateSignedHistoryV1<
      ProviderPublicSupportTaxonomyEnvelopeV1["payload"],
      ProviderPublicSupportTaxonomyEnvelopeV1
    >(
      fields.publicSupportTaxonomyHistory,
      distributionRootBinding,
      rootHistory,
      strictCryptoCapability,
      retainedAccounting,
      {
        stage: "public_support_taxonomy_history",
        schema: ProviderPublicSupportTaxonomyEnvelopeV1Schema,
        signaturePattern: TAXONOMY_SIGNATURE_PATTERN_V1,
        generationLabel: "taxonomy-generation",
        locator: (taxonomyGeneration) =>
          createProviderNonThenableFrozenRecordV1({
            locatorProfile:
              "distribution_provider_public_support_taxonomy_v1" as const,
            taxonomyGeneration,
          }),
        generation: (envelope) => envelope.taxonomyGeneration,
        payloadGeneration: (payload) => payload.taxonomyGeneration,
        predecessorDigest: (payload) =>
          payload.predecessorTaxonomyContentDigest,
        signature: (payload) => payload.taxonomySignature,
        deriveDigest: deriveProviderPublicSupportTaxonomyContentDigestV1,
        createSignatureMessage:
          createProviderPublicSupportTaxonomySignatureMessageV1,
      },
    );
    const matrixHistory = await validateSignedHistoryV1<
      ProviderReleaseMatrixEnvelopeV1["payload"],
      ProviderReleaseMatrixEnvelopeV1
    >(
      fields.releaseMatrixHistory,
      distributionRootBinding,
      rootHistory,
      strictCryptoCapability,
      retainedAccounting,
      {
        stage: "release_matrix_history",
        schema: ProviderReleaseMatrixEnvelopeV1Schema,
        signaturePattern: MATRIX_SIGNATURE_PATTERN_V1,
        generationLabel: "release-matrix-generation",
        locator: (releaseMatrixGeneration) =>
          createProviderNonThenableFrozenRecordV1({
            locatorProfile:
              "distribution_provider_release_matrix_v1" as const,
            releaseMatrixGeneration,
          }),
        generation: (envelope) => envelope.releaseMatrixGeneration,
        payloadGeneration: (payload) => payload.releaseMatrixGeneration,
        predecessorDigest: (payload) =>
          payload.predecessorReleaseMatrixContentDigest,
        signature: (payload) => payload.matrixSignature,
        deriveDigest: deriveProviderReleaseMatrixContentDigestV1,
        createSignatureMessage: createProviderReleaseMatrixSignatureMessageV1,
      },
    );
    const discoveryHistory = await validateSignedHistoryV1<
      ProviderTargetDiscoveryResultEnvelopeV1["payload"],
      ProviderTargetDiscoveryResultEnvelopeV1
    >(
      fields.targetDiscoveryResultHistory,
      distributionRootBinding,
      rootHistory,
      strictCryptoCapability,
      retainedAccounting,
      {
        stage: "target_discovery_result_history",
        schema: ProviderTargetDiscoveryResultEnvelopeV1Schema,
        signaturePattern: DISCOVERY_SIGNATURE_PATTERN_V1,
        generationLabel: "discovery-generation",
        locator: (discoveryGeneration) =>
          createProviderNonThenableFrozenRecordV1({
            locatorProfile:
              "distribution_provider_target_discovery_result_v1" as const,
            discoveryGeneration,
          }),
        generation: (envelope) => envelope.discoveryGeneration,
        payloadGeneration: (payload) => payload.discoveryGeneration,
        predecessorDigest: (payload) =>
          payload.predecessorDiscoveryContentDigest,
        signature: (payload) => payload.discoverySignature,
        deriveDigest: deriveProviderTargetDiscoveryResultContentDigestV1,
        createSignatureMessage:
          createProviderTargetDiscoveryResultSignatureMessageV1,
      },
    );
    const universeHistory = await validateSignedHistoryV1<
      ProviderReleaseTargetUniverseEnvelopeV1["payload"],
      ProviderReleaseTargetUniverseEnvelopeV1
    >(
      fields.releaseTargetUniverseHistory,
      distributionRootBinding,
      rootHistory,
      strictCryptoCapability,
      retainedAccounting,
      {
        stage: "release_target_universe_history",
        schema: ProviderReleaseTargetUniverseEnvelopeV1Schema,
        signaturePattern: UNIVERSE_SIGNATURE_PATTERN_V1,
        generationLabel: "universe-generation",
        locator: (universeGeneration) =>
          createProviderNonThenableFrozenRecordV1({
            locatorProfile:
              "distribution_provider_release_target_universe_v1" as const,
            universeGeneration,
          }),
        generation: (envelope) => envelope.universeGeneration,
        payloadGeneration: (payload) => payload.universeGeneration,
        predecessorDigest: (payload) =>
          payload.predecessorUniverseContentDigest,
        signature: (payload) => payload.universeSignature,
        deriveDigest: deriveProviderReleaseTargetUniverseContentDigestV1,
        createSignatureMessage:
          createProviderReleaseTargetUniverseSignatureMessageV1,
      },
    );
    const catalogHistory = await validateSignedHistoryV1<
      ProviderFeasibilitySupportCatalogEnvelopeV1["payload"],
      ProviderFeasibilitySupportCatalogEnvelopeV1
    >(
      fields.providerFeasibilitySupportCatalogHistory,
      distributionRootBinding,
      rootHistory,
      strictCryptoCapability,
      retainedAccounting,
      {
        stage: "provider_feasibility_support_catalog_history",
        schema: ProviderFeasibilitySupportCatalogEnvelopeV1Schema,
        signaturePattern: CATALOG_SIGNATURE_PATTERN_V1,
        generationLabel: "catalog-generation",
        locator: (catalogGeneration) =>
          createProviderNonThenableFrozenRecordV1({
            locatorProfile:
              "distribution_provider_feasibility_support_catalog_v1" as const,
            catalogGeneration,
          }),
        generation: (envelope) => envelope.catalogGeneration,
        payloadGeneration: (payload) => payload.catalogGeneration,
        predecessorDigest: (payload) =>
          payload.predecessorCatalogContentDigest,
        signature: (payload) => payload.catalogSignature,
        deriveDigest: deriveProviderFeasibilitySupportCatalogContentDigestV1,
        createSignatureMessage:
          createProviderFeasibilitySupportCatalogSignatureMessageV1,
      },
    );

    validateHistoryPinClosureV1(
      taxonomyHistory,
      matrixHistory,
      discoveryHistory,
      universeHistory,
      catalogHistory,
    );

    const taxonomyTip = taxonomyHistory[taxonomyHistory.length - 1]!;
    const matrixTip = matrixHistory[matrixHistory.length - 1]!;
    const discoveryTip = discoveryHistory[discoveryHistory.length - 1]!;
    const universeTip = universeHistory[universeHistory.length - 1]!;
    const catalogTip = catalogHistory[catalogHistory.length - 1]!;
    const activeRoot = resolveVerifiedHistoryRootV1(
      rootHistory,
      catalogTip.payload.activeRootMetadata,
    );
    if (activeRoot === undefined) {
      return failDistributionHistoryV1(
        "provider_feasibility_support_catalog_history",
        "active_root_mismatch",
      );
    }
    const sourceClosure = await resolveRetainedSourceClosureV1(
      fields,
      discoveryHistory,
      rootHistory,
      distributionRootBinding,
      retainedAccounting,
      strictCryptoCapability,
    );
    const retainedSnapshot = retainedAccounting.snapshot();
    const retainedNormalCandidateFailure =
      diagnoseProviderDistributionRetainedNormalCandidateInternalV1({
        supportCatalogGenerationCount: catalogHistory.length,
        publicTaxonomyGenerationCount: taxonomyHistory.length,
        releaseMatrixGenerationCount: matrixHistory.length,
        targetDiscoveryResultGenerationCount: discoveryHistory.length,
        releaseTargetUniverseGenerationCount: universeHistory.length,
        retainedHistoryLogicalBytes:
          retainedSnapshot.retainedHistoryLogicalBytes,
      });
    if (retainedNormalCandidateFailure !== undefined) {
      return failRetainedAccountingV1(retainedNormalCandidateFailure);
    }
    const catalogRequest = createCatalogRequestV1(
      fields,
      activeRoot,
      taxonomyTip,
      matrixTip,
      discoveryTip,
      universeTip,
      catalogTip,
      sourceClosure,
      strictCryptoCapability,
    );
    let catalogDiagnostic;
    try {
      const catalogTrustedHandle =
        registerProviderFeasibilitySupportCatalogRegistryTrustedInternalV1(
          catalogRequest,
          registryClosure,
          registryTrustWitnessHandle,
          strictCryptoCapability,
        );
      catalogDiagnostic = await hardenProviderPointPromiseV1(
        diagnoseProviderFeasibilitySupportCatalogPointRegistryTrustedPreparedInternalV1(
          catalogRequest,
          catalogTrustedHandle,
          strictCryptoCapability,
        ),
      );
    } catch {
      return failDistributionHistoryV1(
        "catalog_point_closure",
        "source_invalid",
      );
    }
    if (!catalogDiagnostic.ok) {
      return failDistributionHistoryV1(
        "catalog_point_closure",
        "source_invalid",
      );
    }
    registryTrustWitnessHandle = undefined;
    const catalogPointClosure = catalogDiagnostic.value;
    if (
      !canonicalEqualV1(
        catalogPointClosure.providerFeasibilitySupportCatalog,
        catalogTip,
      ) ||
      !canonicalEqualV1(
        catalogPointClosure.releaseTargetUniversePointClosure
          .releaseTargetUniverse,
        universeTip,
      )
    ) {
      return failDistributionHistoryV1(
        "catalog_point_closure",
        "source_invalid",
      );
    }
    const currentTipSemanticTokens =
      takeProviderDistributionCurrentTipSemanticTokensInternalV1(
        catalogPointClosure,
        catalogRequest,
      );
    if (currentTipSemanticTokens === undefined) {
      return failDistributionHistoryV1(
        "catalog_point_closure",
        "source_invalid",
      );
    }
    validateNonTipHistoricalSemanticsV1(
      fields,
      taxonomyHistory,
      matrixHistory,
      discoveryHistory,
      universeHistory,
      catalogHistory,
      currentTipSemanticTokens,
    );
    const currentCatalogProjection =
      createProviderNonThenableFrozenRecordV1({
        authority: catalogPointClosure.authority,
        ownerTargetCapabilities:
          catalogPointClosure.ownerTargetCapabilities,
        publicSupport: catalogPointClosure.publicSupport,
        providerFeasibilitySupportCatalogContentDigest:
          catalogPointClosure.providerFeasibilitySupportCatalog
            .contentDigest,
        providerFeasibilitySupportCatalogPin:
          catalogPointClosure.providerFeasibilitySupportCatalogPin,
        relativePath: catalogPointClosure.relativePath,
        targetCount: catalogPointClosure.targetCount,
        candidateCount: catalogPointClosure.candidateCount,
        publicSupportRowCount: catalogPointClosure.publicSupportRowCount,
      });
    return createProviderNonThenableFrozenRecordV1({
      authority:
        PROVIDER_DISTRIBUTION_HISTORY_CURRENT_CANDIDATE_AUTHORITY_V1,
      publicSupportTaxonomyTip: taxonomyTip,
      releaseMatrixTip: matrixTip,
      targetDiscoveryResultTip: discoveryTip,
      releaseTargetUniverseTip: universeTip,
      providerFeasibilitySupportCatalogTip: catalogTip,
      currentCatalogProjection,
      catalogPointClosure,
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

function diagnosticFailureV1(
  stage: ProviderDistributionHistoryCurrentCandidatePointInvalidStageV1,
  reason: ProviderDistributionHistoryCurrentCandidatePointInvalidReasonV1,
): DistributionHistoryDiagnosticFailureV1 {
  return createProviderNonThenableFrozenRecordV1({
    ok: false as const,
    stage,
    reason,
  });
}

function diagnosticFailureFromErrorV1(
  error: unknown,
): DistributionHistoryDiagnosticFailureV1 {
  if (isDistributionHistoryDiagnosticSignalV1(error)) {
    return diagnosticFailureV1(error.stage, error.reason);
  }
  return diagnosticFailureV1("input", "source_invalid");
}

export function diagnoseProviderDistributionHistoryCurrentCandidatePointV1(
  input: unknown,
): Promise<ProviderDistributionHistoryCurrentCandidatePointDiagnosticResultV1> {
  let prepared: PreparedDistributionHistoryPointInputV1;
  try {
    prepared = prepareDistributionHistoryPointInputV1(input);
  } catch {
    return createProviderPointFulfilledPromiseV1(
      diagnosticFailureV1("input", "schema_invalid"),
    );
  }
  let operation: Promise<ProviderDistributionHistoryCurrentCandidatePointValidationV1>;
  try {
    operation = hardenProviderPointPromiseV1(
      validateDistributionHistoryPointInternalV1(prepared),
    );
  } catch (error) {
    return createProviderPointFulfilledPromiseV1(
      diagnosticFailureFromErrorV1(error),
    );
  }
  return operation.then(
    (value) =>
      createProviderNonThenableFrozenRecordV1({ ok: true as const, value }),
    (error) => diagnosticFailureFromErrorV1(error),
  );
}

export function validateProviderDistributionHistoryCurrentCandidatePointV1(
  input: ValidateProviderDistributionHistoryCurrentCandidatePointV1Input,
): Promise<ProviderDistributionHistoryCurrentCandidatePointValidationV1> {
  let prepared: PreparedDistributionHistoryPointInputV1;
  try {
    prepared = prepareDistributionHistoryPointInputV1(input);
  } catch {
    return createProviderPointRejectedPromiseV1(
      new ProviderDistributionHistoryCurrentCandidatePointValidationError(),
    );
  }
  let operation: Promise<ProviderDistributionHistoryCurrentCandidatePointValidationV1>;
  try {
    operation = hardenProviderPointPromiseV1(
      validateDistributionHistoryPointInternalV1(prepared),
    );
  } catch {
    return createProviderPointRejectedPromiseV1(
      new ProviderDistributionHistoryCurrentCandidatePointValidationError(),
    );
  }
  return operation.then(
    (value) => value,
    () => {
      throw new ProviderDistributionHistoryCurrentCandidatePointValidationError();
    },
  );
}

CapturedObjectFreezeV1(
  diagnoseProviderDistributionHistoryCurrentCandidatePointV1,
);
CapturedObjectFreezeV1(
  validateProviderDistributionHistoryCurrentCandidatePointV1,
);
