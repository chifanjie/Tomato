import { z } from "./zod-runtime.js";

import {
  assertDataObjectDescriptorsBeforeSchemaV1,
  assertJsonDataTreeBeforeSchemaV1,
  createDomainPreimageBytesV1,
} from "./domain-crypto.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  ProviderFilesystemProfileCodeV1Schema,
  ProviderOsReleaseFamilyCodeV1Schema,
  ProviderPublicSupportProfileIdV1Schema,
  ProviderPublicSupportTaxonomySignatureV1Schema,
  ProviderRegistryRootKeyIdV1Schema,
  ProviderReleaseMatrixSignatureV1Schema,
  ProviderTargetDiscoveryInputBundleSignatureV1Schema,
  ProviderTargetDiscoveryResultSignatureV1Schema,
  ProviderTargetProfileIdV1Schema,
  type ContentDigestV1,
} from "./primitives.js";
import {
  encodeStoreFilenameKeyV1,
  type StoreFilenameKeyV1,
} from "./provider-fixed-locator.js";
import {
  captureProviderPointRawExactTopLevelV1,
  cloneProviderPointRawAdmissionCapsuleV1,
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
  ProviderSignedDistributionRootBindingV1Schema,
  validateProviderSignedDistributionRootBindingStructureV1,
  type ProviderSignedDistributionRootBindingV1,
} from "./provider-distribution-trust.js";
import {
  ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema,
  ProviderRealFilesystemSuiteManifestEnvelopeV1Schema,
  ProviderRealFilesystemSuiteManifestPinV1Schema,
  diagnoseProviderRealFilesystemSourceClosureV1,
  type ProviderRealFilesystemSourceClosureDiagnosticResultV1,
  type ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1,
  type ProviderRealFilesystemSuiteManifestEnvelopeV1,
  type ProviderRealFilesystemSuiteManifestPinV1,
  type ValidateProviderRealFilesystemSourceClosureV1Input,
} from "./provider-real-filesystem-source.js";
import {
  assertPreparedDistributionInputBindingsInternalV1,
  diagnoseProviderRealFilesystemSourcePreparedInternalV1,
  recordPreparedDistributionSignatureVerificationInternalV1,
  type PreparedDistributionVerificationContextV1,
} from "./provider-real-filesystem-source-internal.js";
import {
  ProviderRegistryIsoTimestampV1Schema,
  ProviderRegistryRootMetadataPinV1Schema,
  ProviderRegistryRootPublicKeyV1Schema,
  validateProviderRegistryRootPublicKeyV1,
  type ProviderRegistryRootMetadataPinV1,
  type ProviderRegistryRootPublicKeyV1,
} from "./provider-registry-trust.js";
import { sha256InternalV1 } from "./sha256.js";
import {
  createProviderTargetDiscoveryPointSnapshotV1,
  registerProviderTargetDiscoveryPointClosureSnapshotV1,
  takeProviderTargetDiscoveryPointPreSnapshotV1,
  type ProviderTargetDiscoveryPointSnapshotV1,
} from "./provider-target-discovery-point-internal.js";
import {
  registerProviderTargetDiscoveryPointPreparedCoreInternalV1,
} from "./provider-target-discovery-point-prepared-internal.js";
import {
  registerProviderDistributionHistoricalBundleSemanticCoreInternalV1,
  registerProviderDistributionHistoricalMatrixSemanticCoreInternalV1,
  registerProviderDistributionHistoricalResultSemanticCoreInternalV1,
  registerProviderDistributionHistoricalTaxonomySemanticCoreInternalV1,
} from "./provider-distribution-historical-semantic-internal.js";
import {
  assertProviderStrictEd25519CryptoCapabilityIdentityV1,
} from "./strict-ed25519-capability-internal.js";
import {
  ProviderStrictEd25519AttestationError,
  verifyRawEd25519WithCapabilityV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "./strict-ed25519-conformance.js";

const CapturedArrayPrototypeMapV1 = Array.prototype.map;
const CapturedArrayPrototypeFlatV1 = Array.prototype.flat;
const CapturedArrayPrototypePushV1 = Array.prototype.push;
const CapturedArrayPrototypeSomeV1 = Array.prototype.some;
const CapturedArrayPrototypeSortV1 = Array.prototype.sort;
const CapturedMapV1 = Map;
const CapturedMapPrototypeForEachV1 = Map.prototype.forEach;
const CapturedMapPrototypeGetV1 = Map.prototype.get;
const CapturedMapPrototypeSetV1 = Map.prototype.set;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorsV1 =
  Object.getOwnPropertyDescriptors;
const CapturedObjectValuesV1 = Object.values;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedRegExpPrototypeExecV1 = RegExp.prototype.exec;
const CapturedSetV1 = Set;
const CapturedSetPrototypeAddV1 = Set.prototype.add;
const CapturedSetPrototypeHasV1 = Set.prototype.has;

function arrayMapV1<T, U>(
  array: readonly T[],
  callback: (value: T, index: number, source: readonly T[]) => U,
): U[] {
  return CapturedReflectApplyV1(CapturedArrayPrototypeMapV1, array, [
    callback,
  ]) as U[];
}

function arrayFlatV1<T>(array: readonly (T | readonly T[])[]): T[] {
  return CapturedReflectApplyV1(CapturedArrayPrototypeFlatV1, array, []) as T[];
}

function arrayPushV1<T>(array: T[], value: T): number {
  return CapturedReflectApplyV1(CapturedArrayPrototypePushV1, array, [
    value,
  ]) as number;
}

function arraySomeV1<T>(
  array: readonly T[],
  callback: (value: T, index: number, source: readonly T[]) => unknown,
): boolean {
  return CapturedReflectApplyV1(CapturedArrayPrototypeSomeV1, array, [
    callback,
  ]) as boolean;
}

function arraySortV1<T>(
  array: T[],
  compare?: (left: T, right: T) => number,
): T[] {
  return CapturedReflectApplyV1(CapturedArrayPrototypeSortV1, array, [
    compare,
  ]) as T[];
}

function mapGetV1<K, V>(map: ReadonlyMap<K, V>, key: K): V | undefined {
  return CapturedReflectApplyV1(CapturedMapPrototypeGetV1, map, [key]) as
    | V
    | undefined;
}

function mapSetV1<K, V>(map: Map<K, V>, key: K, value: V): void {
  CapturedReflectApplyV1(CapturedMapPrototypeSetV1, map, [key, value]);
}

function mapFromEntriesV1<K, V>(
  entries: readonly (readonly [K, V])[],
): Map<K, V> {
  const map = new CapturedMapV1<K, V>();
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    mapSetV1(map, entry[0], entry[1]);
  }
  return map;
}

function mapValuesArrayV1<K, V>(map: ReadonlyMap<K, V>): V[] {
  const output: V[] = [];
  CapturedReflectApplyV1(CapturedMapPrototypeForEachV1, map, [
    (value: V) => {
      arrayPushV1(output, value);
    },
  ]);
  return output;
}

function setAddV1<T>(set: Set<T>, value: T): void {
  CapturedReflectApplyV1(CapturedSetPrototypeAddV1, set, [value]);
}

function setHasV1<T>(set: ReadonlySet<T>, value: T): boolean {
  return CapturedReflectApplyV1(CapturedSetPrototypeHasV1, set, [
    value,
  ]) as boolean;
}

function setFromValuesV1<T>(values: readonly T[]): Set<T> {
  const set = new CapturedSetV1<T>();
  for (let index = 0; index < values.length; index += 1) {
    setAddV1(set, values[index]!);
  }
  return set;
}

function regExpExecV1(pattern: RegExp, value: string): RegExpExecArray | null {
  return CapturedReflectApplyV1(CapturedRegExpPrototypeExecV1, pattern, [
    value,
  ]) as RegExpExecArray | null;
}

function regExpTestV1(pattern: RegExp, value: string): boolean {
  return regExpExecV1(pattern, value) !== null;
}

export const PROVIDER_OS_RELEASE_FAMILY_CODE_DOMAIN_V1 =
  "provider-os-release-family-code-v1" as const;
export const PROVIDER_FILESYSTEM_PROFILE_CODE_DOMAIN_V1 =
  "provider-filesystem-profile-code-v1" as const;
export const PROVIDER_TARGET_PROFILE_ID_DOMAIN_V1 =
  "provider-target-profile-id-v1" as const;
export const PROVIDER_PUBLIC_SUPPORT_PROFILE_ID_DOMAIN_V1 =
  "provider-public-support-profile-id-v1" as const;
export const PROVIDER_PUBLIC_SUPPORT_TAXONOMY_DOMAIN_V1 =
  "provider-public-support-taxonomy-v1" as const;
export const PROVIDER_PUBLIC_SUPPORT_TAXONOMY_SIGNATURE_DOMAIN_V1 =
  "provider-public-support-taxonomy-signature-v1" as const;
export const PROVIDER_RELEASE_TARGET_ENTRY_SET_DOMAIN_V1 =
  "provider-release-target-entry-set-v1" as const;
export const PROVIDER_RELEASE_MATRIX_DOMAIN_V1 =
  "provider-release-matrix-v1" as const;
export const PROVIDER_RELEASE_MATRIX_SIGNATURE_DOMAIN_V1 =
  "provider-release-matrix-signature-v1" as const;
export const PROVIDER_TARGET_DISCOVERY_SOURCE_MANIFEST_RECORD_SET_DOMAIN_V1 =
  "provider-target-discovery-source-manifest-record-set-v1" as const;
export const PROVIDER_TARGET_DISCOVERY_FIXTURE_MANIFEST_DOMAIN_V1 =
  "provider-target-discovery-fixture-manifest-v1" as const;
export const PROVIDER_TARGET_DISCOVERY_RUNNER_RUN_MANIFEST_DOMAIN_V1 =
  "provider-target-discovery-runner-run-manifest-v1" as const;
export const PROVIDER_TARGET_DISCOVERY_OBSERVATION_CUT_DOMAIN_V1 =
  "provider-target-discovery-observation-cut-v1" as const;
export const PROVIDER_TARGET_DISCOVERY_SOURCE_RECORD_DOMAIN_V1 =
  "provider-target-discovery-source-record-v1" as const;
export const PROVIDER_TARGET_DISCOVERY_OBSERVATION_KEY_DOMAIN_V1 =
  "provider-target-discovery-observation-key-v1" as const;
export const PROVIDER_TARGET_DISCOVERY_SOURCE_OBSERVATION_SET_DOMAIN_V1 =
  "provider-target-discovery-source-observation-set-v1" as const;
export const PROVIDER_TARGET_DISCOVERY_INPUT_OBSERVATION_SET_DOMAIN_V1 =
  "provider-target-discovery-input-observation-set-v1" as const;
export const PROVIDER_TARGET_DISCOVERY_INPUT_BUNDLE_DOMAIN_V1 =
  "provider-target-discovery-input-bundle-v1" as const;
export const PROVIDER_TARGET_DISCOVERY_INPUT_BUNDLE_SIGNATURE_DOMAIN_V1 =
  "provider-target-discovery-input-bundle-signature-v1" as const;
export const PROVIDER_TARGET_DISCOVERY_RESULT_DOMAIN_V1 =
  "provider-target-discovery-result-v1" as const;
export const PROVIDER_TARGET_DISCOVERY_RESULT_SIGNATURE_DOMAIN_V1 =
  "provider-target-discovery-result-signature-v1" as const;

export const PROVIDER_PUBLIC_SUPPORT_TAXONOMY_LOCATOR_PROFILE_V1 =
  "distribution_provider_public_support_taxonomy_v1" as const;
export const PROVIDER_RELEASE_MATRIX_LOCATOR_PROFILE_V1 =
  "distribution_provider_release_matrix_v1" as const;
export const PROVIDER_TARGET_DISCOVERY_FIXTURE_MANIFEST_LOCATOR_PROFILE_V1 =
  "distribution_provider_real_fs_fixture_manifest_v1" as const;
export const PROVIDER_TARGET_DISCOVERY_RUNNER_RUN_LOCATOR_PROFILE_V1 =
  "distribution_provider_target_discovery_runner_run_v1" as const;
export const PROVIDER_TARGET_DISCOVERY_RESULT_LOCATOR_PROFILE_V1 =
  "distribution_provider_target_discovery_result_v1" as const;

const PositiveSafeIntegerV1Schema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const NonnegativeSafeIntegerV1Schema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const PublicMajorVersionV1Schema = z.number().int().min(1).max(999);
const ProducerVersionV1Schema = z.string().regex(
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u,
);

export const ProviderPublicLinuxDistributionIdV1Schema = z.enum([
  "almalinux",
  "amazon-linux",
  "debian",
  "fedora",
  "opensuse-leap",
  "rhel",
  "rocky",
  "sles",
  "ubuntu",
]);

export const ProviderPublicOsReleaseFamilyDescriptorV1Schema = z.union([
  z.strictObject({
    osPlatform: z.literal("darwin"),
    resolver: z.literal("darwin_product_major_version_v1"),
    productMajorVersion: PublicMajorVersionV1Schema,
  }),
  z.strictObject({
    osPlatform: z.literal("linux"),
    resolver: z.literal("linux_os_release_id_major_version_v1"),
    distributionId: ProviderPublicLinuxDistributionIdV1Schema,
    distributionMajorVersion: PublicMajorVersionV1Schema,
  }),
]);
export type ProviderPublicOsReleaseFamilyDescriptorV1 = z.infer<
  typeof ProviderPublicOsReleaseFamilyDescriptorV1Schema
>;

export const ProviderPublicFilesystemDescriptorV1Schema = z.union([
  z.strictObject({
    osPlatform: z.literal("darwin"),
    resolver: z.literal("darwin_filesystem_type_v1"),
    filesystemKind: z.literal("apfs"),
  }),
  z.strictObject({
    osPlatform: z.literal("linux"),
    resolver: z.literal("linux_statfs_type_v1"),
    filesystemKind: z.literal("ext4"),
  }),
]);
export type ProviderPublicFilesystemDescriptorV1 = z.infer<
  typeof ProviderPublicFilesystemDescriptorV1Schema
>;

export const ProviderPublicOsReleaseFamilyCodeFieldsV1Schema = z.strictObject({
  descriptor: ProviderPublicOsReleaseFamilyDescriptorV1Schema,
});
export const ProviderPublicFilesystemProfileCodeFieldsV1Schema = z.strictObject({
  descriptor: ProviderPublicFilesystemDescriptorV1Schema,
});
export const ProviderPublicOsReleaseFamilyTaxonomyRecordV1Schema = z.strictObject({
  descriptor: ProviderPublicOsReleaseFamilyDescriptorV1Schema,
  osReleaseFamilyCode: ProviderOsReleaseFamilyCodeV1Schema,
});
export type ProviderPublicOsReleaseFamilyTaxonomyRecordV1 = z.infer<
  typeof ProviderPublicOsReleaseFamilyTaxonomyRecordV1Schema
>;
export const ProviderPublicFilesystemTaxonomyRecordV1Schema = z.strictObject({
  descriptor: ProviderPublicFilesystemDescriptorV1Schema,
  filesystemProfileCode: ProviderFilesystemProfileCodeV1Schema,
});
export type ProviderPublicFilesystemTaxonomyRecordV1 = z.infer<
  typeof ProviderPublicFilesystemTaxonomyRecordV1Schema
>;

const TaxonomyUnsignedShapeV1 = {
  profile: z.literal("provider_public_support_taxonomy_v1"),
  distributionRootBinding: ProviderSignedDistributionRootBindingV1Schema,
  activeRootMetadata: ProviderRegistryRootMetadataPinV1Schema,
  registryRootKeyId: ProviderRegistryRootKeyIdV1Schema,
  taxonomyGeneration: PositiveSafeIntegerV1Schema,
  predecessorTaxonomyContentDigest: ContentDigestV1Schema.optional(),
  osReleaseFamilies: z.array(ProviderPublicOsReleaseFamilyTaxonomyRecordV1Schema).min(1),
  filesystemProfiles: z.array(ProviderPublicFilesystemTaxonomyRecordV1Schema).min(1),
  derivationPolicy: z.strictObject({
    osFamilySource: z.literal("strict_public_platform_release_api_without_build_identifier"),
    filesystemSource: z.literal("strict_public_filesystem_kind_without_features_or_mount_options"),
    excludedPrivateInputs: z.tuple([
      z.literal("osBuildDigest"),
      z.literal("filesystemFeatureProfileDigest"),
      z.literal("mountOptionProfileDigest"),
    ]),
    unknownOrNoncanonicalObservation: z.literal("public_strong_forbidden"),
  }),
} as const;
export const ProviderPublicSupportTaxonomyUnsignedClaimsV1Schema = z.strictObject(TaxonomyUnsignedShapeV1);
export type ProviderPublicSupportTaxonomyUnsignedClaimsV1 = z.infer<
  typeof ProviderPublicSupportTaxonomyUnsignedClaimsV1Schema
>;
export const ProviderPublicSupportTaxonomyV1Schema = z.strictObject({
  ...TaxonomyUnsignedShapeV1,
  taxonomySignature: ProviderPublicSupportTaxonomySignatureV1Schema,
});
export type ProviderPublicSupportTaxonomyV1 = z.infer<typeof ProviderPublicSupportTaxonomyV1Schema>;
export const ProviderPublicSupportTaxonomyEnvelopeV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  recordType: z.literal("provider_public_support_taxonomy"),
  taxonomyGeneration: PositiveSafeIntegerV1Schema,
  contentDigest: ContentDigestV1Schema,
  payload: ProviderPublicSupportTaxonomyV1Schema,
});
export type ProviderPublicSupportTaxonomyEnvelopeV1 = z.infer<
  typeof ProviderPublicSupportTaxonomyEnvelopeV1Schema
>;
export const ProviderPublicSupportTaxonomyPinV1Schema = z.strictObject({
  locatorProfile: z.literal(PROVIDER_PUBLIC_SUPPORT_TAXONOMY_LOCATOR_PROFILE_V1),
  taxonomyGeneration: PositiveSafeIntegerV1Schema,
  contentDigest: ContentDigestV1Schema,
});
export type ProviderPublicSupportTaxonomyPinV1 = z.infer<
  typeof ProviderPublicSupportTaxonomyPinV1Schema
>;

export const ProviderFeasibilityTargetFieldsV1Schema = z.strictObject({
  osPlatform: z.enum(["darwin", "linux"]),
  osReleaseFamilyCode: ProviderOsReleaseFamilyCodeV1Schema,
  osBuildDigest: ContentDigestV1Schema,
  architecture: z.enum(["arm64", "x86_64"]),
  filesystemProfileCode: ProviderFilesystemProfileCodeV1Schema,
  filesystemFeatureProfileDigest: ContentDigestV1Schema,
  mountOptionProfileDigest: ContentDigestV1Schema,
});
export const ProviderFeasibilityTargetV1Schema = z.strictObject({
  targetProfileId: ProviderTargetProfileIdV1Schema,
  ...ProviderFeasibilityTargetFieldsV1Schema.shape,
});
export type ProviderFeasibilityTargetV1 = z.infer<typeof ProviderFeasibilityTargetV1Schema>;
export const ProviderPublicSupportProfileFieldsV1Schema = z.strictObject({
  osPlatform: z.enum(["darwin", "linux"]),
  osReleaseFamilyCode: ProviderOsReleaseFamilyCodeV1Schema,
  architecture: z.enum(["arm64", "x86_64"]),
  filesystemProfileCode: ProviderFilesystemProfileCodeV1Schema,
});
export const ProviderReleaseTargetUniverseTargetEntryV1Schema = z.strictObject({
  target: ProviderFeasibilityTargetV1Schema,
  publicProfileId: ProviderPublicSupportProfileIdV1Schema,
});
export type ProviderReleaseTargetUniverseTargetEntryV1 = z.infer<
  typeof ProviderReleaseTargetUniverseTargetEntryV1Schema
>;
export const ProviderReleaseTargetEntrySetFieldsV1Schema = z.strictObject({
  targets: z.array(ProviderReleaseTargetUniverseTargetEntryV1Schema),
});
export const ProviderReleaseCoverageArtifactLimitsV1Schema = z.strictObject({
  profile: z.literal("provider_release_coverage_artifact_limits_v1"),
  maxTargetEntriesPerArtifact: z.literal(4096),
  maxCanonicalUnionTargetEntries: z.literal(4096),
  maxUnresolvedObservationsPerDiscoveryResult: z.literal(4096),
  maxCanonicalEnvelopeBytes: z.literal(16_777_216),
});
export type ProviderReleaseCoverageArtifactLimitsV1 = z.infer<
  typeof ProviderReleaseCoverageArtifactLimitsV1Schema
>;

const MatrixUnsignedShapeV1 = {
  profile: z.literal("provider_release_matrix_v1"),
  distributionRootBinding: ProviderSignedDistributionRootBindingV1Schema,
  activeRootMetadata: ProviderRegistryRootMetadataPinV1Schema,
  registryRootKeyId: ProviderRegistryRootKeyIdV1Schema,
  releaseMatrixGeneration: PositiveSafeIntegerV1Schema,
  predecessorReleaseMatrixContentDigest: ContentDigestV1Schema.optional(),
  publicSupportTaxonomy: ProviderPublicSupportTaxonomyPinV1Schema,
  limits: ProviderReleaseCoverageArtifactLimitsV1Schema,
  targetCount: PositiveSafeIntegerV1Schema,
  targetSetDigest: ContentDigestV1Schema,
  targets: z.array(ProviderReleaseTargetUniverseTargetEntryV1Schema).min(1).max(4096),
} as const;
export const ProviderReleaseMatrixUnsignedClaimsV1Schema = z.strictObject(MatrixUnsignedShapeV1);
export type ProviderReleaseMatrixUnsignedClaimsV1 = z.infer<typeof ProviderReleaseMatrixUnsignedClaimsV1Schema>;
export const ProviderReleaseMatrixV1Schema = z.strictObject({
  ...MatrixUnsignedShapeV1,
  matrixSignature: ProviderReleaseMatrixSignatureV1Schema,
});
export type ProviderReleaseMatrixV1 = z.infer<typeof ProviderReleaseMatrixV1Schema>;
export const ProviderReleaseMatrixEnvelopeV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  recordType: z.literal("provider_release_matrix"),
  releaseMatrixGeneration: PositiveSafeIntegerV1Schema,
  contentDigest: ContentDigestV1Schema,
  payload: ProviderReleaseMatrixV1Schema,
});
export type ProviderReleaseMatrixEnvelopeV1 = z.infer<typeof ProviderReleaseMatrixEnvelopeV1Schema>;
export const ProviderReleaseMatrixPinV1Schema = z.strictObject({
  locatorProfile: z.literal(PROVIDER_RELEASE_MATRIX_LOCATOR_PROFILE_V1),
  releaseMatrixGeneration: PositiveSafeIntegerV1Schema,
  contentDigest: ContentDigestV1Schema,
});
export type ProviderReleaseMatrixPinV1 = z.infer<typeof ProviderReleaseMatrixPinV1Schema>;

export const ProviderTargetDiscoveryObservationSourceV1Schema = z.enum([
  "signed_release_matrix",
  "real_filesystem_fixture_manifest",
  "target_discovery_runner",
]);
export type ProviderTargetDiscoveryObservationSourceV1 = z.infer<
  typeof ProviderTargetDiscoveryObservationSourceV1Schema
>;
export const ProviderTargetDiscoveryRequiredDimensionsV1Schema = z.tuple([
  z.literal("osPlatform"),
  z.literal("osReleaseFamilyCode"),
  z.literal("osBuildDigest"),
  z.literal("architecture"),
  z.literal("filesystemProfileCode"),
  z.literal("filesystemFeatureProfileDigest"),
  z.literal("mountOptionProfileDigest"),
]);
export const ProviderTargetDiscoveryObservationSourcesV1Schema = z.tuple([
  z.literal("signed_release_matrix"),
  z.literal("real_filesystem_fixture_manifest"),
  z.literal("target_discovery_runner"),
]);
export const ProviderTargetDiscoveryUnresolvedReasonV1Schema = z.enum([
  "target_dimensions_missing",
  "taxonomy_mapping_unresolved",
  "conflicting_target_claims",
  "observation_source_unavailable",
]);
export const ProviderTargetDiscoverySourceRecordOutcomeV1Schema = z.union([
  z.strictObject({ state: z.literal("resolved"), target: ProviderReleaseTargetUniverseTargetEntryV1Schema }),
  z.strictObject({ state: z.literal("unresolved"), reason: ProviderTargetDiscoveryUnresolvedReasonV1Schema }),
]);
export type ProviderTargetDiscoverySourceRecordOutcomeV1 = z.infer<
  typeof ProviderTargetDiscoverySourceRecordOutcomeV1Schema
>;
export const ProviderTargetDiscoverySourceManifestRecordV1Schema = z.strictObject({
  sourceRecordOrdinal: NonnegativeSafeIntegerV1Schema,
  outcome: ProviderTargetDiscoverySourceRecordOutcomeV1Schema,
});
export type ProviderTargetDiscoverySourceManifestRecordV1 = z.infer<
  typeof ProviderTargetDiscoverySourceManifestRecordV1Schema
>;
export const ProviderTargetDiscoverySourceManifestRecordSetFieldsV1Schema = z.strictObject({
  observationSource: ProviderTargetDiscoveryObservationSourceV1Schema,
  entries: z.array(ProviderTargetDiscoverySourceManifestRecordV1Schema),
});

export const ProviderTargetDiscoveryFixtureManifestPinV1Schema = z.strictObject({
  locatorProfile: z.literal(PROVIDER_TARGET_DISCOVERY_FIXTURE_MANIFEST_LOCATOR_PROFILE_V1),
  realFilesystemSuiteManifest: ProviderRealFilesystemSuiteManifestPinV1Schema,
  realFilesystemSuiteDigest: ContentDigestV1Schema,
  fixtureManifestDigest: ContentDigestV1Schema,
  contentDigest: ContentDigestV1Schema,
});
export type ProviderTargetDiscoveryFixtureManifestPinV1 = z.infer<
  typeof ProviderTargetDiscoveryFixtureManifestPinV1Schema
>;
export const ProviderTargetDiscoveryFixtureManifestV1Schema = z.strictObject({
  profile: z.literal("provider_target_discovery_fixture_manifest_v1"),
  distributionRootBinding: ProviderSignedDistributionRootBindingV1Schema,
  releaseRevisionDigest: ContentDigestV1Schema,
  realFilesystemSuiteManifest: ProviderRealFilesystemSuiteManifestPinV1Schema,
  realFilesystemSuiteDigest: ContentDigestV1Schema,
  fixtureManifestDigest: ContentDigestV1Schema,
  targetRecordCount: NonnegativeSafeIntegerV1Schema,
  targetRecordSetDigest: ContentDigestV1Schema,
  records: z.array(ProviderTargetDiscoverySourceManifestRecordV1Schema),
  completedAt: ProviderRegistryIsoTimestampV1Schema,
});
export type ProviderTargetDiscoveryFixtureManifestV1 = z.infer<
  typeof ProviderTargetDiscoveryFixtureManifestV1Schema
>;
export const ProviderTargetDiscoveryFixtureManifestEnvelopeV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  recordType: z.literal("provider_target_discovery_fixture_manifest"),
  fixtureManifestDigest: ContentDigestV1Schema,
  contentDigest: ContentDigestV1Schema,
  payload: ProviderTargetDiscoveryFixtureManifestV1Schema,
});
export type ProviderTargetDiscoveryFixtureManifestEnvelopeV1 = z.infer<
  typeof ProviderTargetDiscoveryFixtureManifestEnvelopeV1Schema
>;

export const ProviderTargetDiscoveryRunnerInstancePinV1Schema = z.strictObject({
  locatorProfile: z.literal(PROVIDER_TARGET_DISCOVERY_RUNNER_RUN_LOCATOR_PROFILE_V1),
  producerName: z.literal("understand-code"),
  producerVersion: ProducerVersionV1Schema,
  implementationDigest: ContentDigestV1Schema,
  binaryAttestationDigest: ContentDigestV1Schema,
  runnerProfileDigest: ContentDigestV1Schema,
  runManifestContentDigest: ContentDigestV1Schema,
  releaseRevisionDigest: ContentDigestV1Schema,
  executedAt: ProviderRegistryIsoTimestampV1Schema,
});
export type ProviderTargetDiscoveryRunnerInstancePinV1 = z.infer<
  typeof ProviderTargetDiscoveryRunnerInstancePinV1Schema
>;
export const ProviderTargetDiscoveryRunnerRunManifestV1Schema = z.strictObject({
  profile: z.literal("provider_target_discovery_runner_run_manifest_v1"),
  distributionRootBinding: ProviderSignedDistributionRootBindingV1Schema,
  releaseRevisionDigest: ContentDigestV1Schema,
  producerName: z.literal("understand-code"),
  producerVersion: ProducerVersionV1Schema,
  implementationDigest: ContentDigestV1Schema,
  binaryAttestationDigest: ContentDigestV1Schema,
  runnerProfileDigest: ContentDigestV1Schema,
  targetRecordCount: NonnegativeSafeIntegerV1Schema,
  targetRecordSetDigest: ContentDigestV1Schema,
  records: z.array(ProviderTargetDiscoverySourceManifestRecordV1Schema),
  executedAt: ProviderRegistryIsoTimestampV1Schema,
});
export type ProviderTargetDiscoveryRunnerRunManifestV1 = z.infer<
  typeof ProviderTargetDiscoveryRunnerRunManifestV1Schema
>;
export const ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  recordType: z.literal("provider_target_discovery_runner_run"),
  contentDigest: ContentDigestV1Schema,
  payload: ProviderTargetDiscoveryRunnerRunManifestV1Schema,
});
export type ProviderTargetDiscoveryRunnerRunEnvelopeV1 = z.infer<
  typeof ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema
>;

export const ProviderTargetDiscoveryObservationCutV1Schema = z.strictObject({
  profile: z.literal("provider_target_discovery_observation_cut_v1"),
  distributionRootBinding: ProviderSignedDistributionRootBindingV1Schema,
  activeRootMetadata: ProviderRegistryRootMetadataPinV1Schema,
  publicSupportTaxonomy: ProviderPublicSupportTaxonomyPinV1Schema,
  releaseMatrix: ProviderReleaseMatrixPinV1Schema,
  realFilesystemFixtureManifest: ProviderTargetDiscoveryFixtureManifestPinV1Schema,
  targetDiscoveryRunner: ProviderTargetDiscoveryRunnerInstancePinV1Schema,
  discoveryRulesetVersion: z.literal("provider_release_target_discovery_v1"),
  requiredDimensions: ProviderTargetDiscoveryRequiredDimensionsV1Schema,
  observationSources: ProviderTargetDiscoveryObservationSourcesV1Schema,
  freshnessRule: z.literal("exact_release_revision_and_source_digest_cut_v1"),
});
export type ProviderTargetDiscoveryObservationCutV1 = z.infer<
  typeof ProviderTargetDiscoveryObservationCutV1Schema
>;
export const ProviderTargetDiscoverySourceRecordProjectionV1Schema = z.strictObject({
  observationSource: ProviderTargetDiscoveryObservationSourceV1Schema,
  sourceArtifactContentDigest: ContentDigestV1Schema,
  sourceRecordOrdinal: NonnegativeSafeIntegerV1Schema,
  outcome: ProviderTargetDiscoverySourceRecordOutcomeV1Schema,
});
export const ProviderTargetDiscoveryInputObservationV1Schema = z.strictObject({
  ...ProviderTargetDiscoverySourceRecordProjectionV1Schema.shape,
  privacySafeObservationClaimsDigest: ContentDigestV1Schema,
  observationKeyDigest: ContentDigestV1Schema,
});
export type ProviderTargetDiscoveryInputObservationV1 = z.infer<
  typeof ProviderTargetDiscoveryInputObservationV1Schema
>;
export const ProviderTargetDiscoveryObservationKeyFieldsV1Schema = z.strictObject({
  observationSource: ProviderTargetDiscoveryObservationSourceV1Schema,
  sourceArtifactContentDigest: ContentDigestV1Schema,
  sourceRecordOrdinal: NonnegativeSafeIntegerV1Schema,
  privacySafeObservationClaimsDigest: ContentDigestV1Schema,
});
export const ProviderTargetDiscoverySourceObservationSetFieldsV1Schema = z.strictObject({
  observationSource: ProviderTargetDiscoveryObservationSourceV1Schema,
  sourceArtifactContentDigest: ContentDigestV1Schema,
  entries: z.array(ProviderTargetDiscoveryInputObservationV1Schema),
});
export const ProviderTargetDiscoveryInputObservationSetFieldsV1Schema = z.strictObject({
  entries: z.array(ProviderTargetDiscoveryInputObservationV1Schema),
});
const SourceObservationSummaryShapeV1 = {
  sourceArtifactContentDigest: ContentDigestV1Schema,
  observationCount: NonnegativeSafeIntegerV1Schema,
  observationSetDigest: ContentDigestV1Schema,
} as const;
export const ProviderTargetDiscoverySourceObservationSetSummaryV1Schema = z.strictObject({
  observationSource: ProviderTargetDiscoveryObservationSourceV1Schema,
  ...SourceObservationSummaryShapeV1,
});

const BundleUnsignedShapeV1 = {
  profile: z.literal("provider_target_discovery_input_bundle_v1"),
  distributionRootBinding: ProviderSignedDistributionRootBindingV1Schema,
  activeRootMetadata: ProviderRegistryRootMetadataPinV1Schema,
  registryRootKeyId: ProviderRegistryRootKeyIdV1Schema,
  publicSupportTaxonomy: ProviderPublicSupportTaxonomyPinV1Schema,
  releaseMatrix: ProviderReleaseMatrixPinV1Schema,
  realFilesystemFixtureManifest: ProviderTargetDiscoveryFixtureManifestPinV1Schema,
  targetDiscoveryRunner: ProviderTargetDiscoveryRunnerInstancePinV1Schema,
  discoveryRulesetVersion: z.literal("provider_release_target_discovery_v1"),
  requiredDimensions: ProviderTargetDiscoveryRequiredDimensionsV1Schema,
  observationSources: ProviderTargetDiscoveryObservationSourcesV1Schema,
  observationCut: ProviderTargetDiscoveryObservationCutV1Schema,
  observationCutDigest: ContentDigestV1Schema,
  sourceObservationSets: z.tuple([
    z.strictObject({ observationSource: z.literal("signed_release_matrix"), ...SourceObservationSummaryShapeV1 }),
    z.strictObject({ observationSource: z.literal("real_filesystem_fixture_manifest"), ...SourceObservationSummaryShapeV1 }),
    z.strictObject({ observationSource: z.literal("target_discovery_runner"), ...SourceObservationSummaryShapeV1 }),
  ]),
  observationCount: NonnegativeSafeIntegerV1Schema,
  observationSetDigest: ContentDigestV1Schema,
  observations: z.array(ProviderTargetDiscoveryInputObservationV1Schema),
} as const;
export const ProviderTargetDiscoveryInputBundleUnsignedClaimsV1Schema = z.strictObject(BundleUnsignedShapeV1);
export type ProviderTargetDiscoveryInputBundleUnsignedClaimsV1 = z.infer<
  typeof ProviderTargetDiscoveryInputBundleUnsignedClaimsV1Schema
>;
export const ProviderTargetDiscoveryInputBundleV1Schema = z.strictObject({
  ...BundleUnsignedShapeV1,
  bundleSignature: ProviderTargetDiscoveryInputBundleSignatureV1Schema,
});
export type ProviderTargetDiscoveryInputBundleV1 = z.infer<
  typeof ProviderTargetDiscoveryInputBundleV1Schema
>;

export const ProviderTargetDiscoveryUnresolvedObservationV1Schema = z.strictObject({
  observationSource: ProviderTargetDiscoveryObservationSourceV1Schema,
  sourceArtifactContentDigest: ContentDigestV1Schema,
  sourceRecordOrdinal: NonnegativeSafeIntegerV1Schema,
  privacySafeObservationClaimsDigest: ContentDigestV1Schema,
  observationKeyDigest: ContentDigestV1Schema,
  reason: ProviderTargetDiscoveryUnresolvedReasonV1Schema,
});
export type ProviderTargetDiscoveryUnresolvedObservationV1 = z.infer<
  typeof ProviderTargetDiscoveryUnresolvedObservationV1Schema
>;
const ResultUnsignedShapeV1 = {
  profile: z.literal("provider_target_discovery_result_v1"),
  distributionRootBinding: ProviderSignedDistributionRootBindingV1Schema,
  activeRootMetadata: ProviderRegistryRootMetadataPinV1Schema,
  registryRootKeyId: ProviderRegistryRootKeyIdV1Schema,
  discoveryGeneration: PositiveSafeIntegerV1Schema,
  predecessorDiscoveryContentDigest: ContentDigestV1Schema.optional(),
  publicSupportTaxonomy: ProviderPublicSupportTaxonomyPinV1Schema,
  limits: ProviderReleaseCoverageArtifactLimitsV1Schema,
  targetDiscoveryInputBundleContentDigest: ContentDigestV1Schema,
  targetDiscoveryInputBundle: ProviderTargetDiscoveryInputBundleV1Schema,
  observationCutDigest: ContentDigestV1Schema,
  observationSetDigest: ContentDigestV1Schema,
  discoveryRulesetVersion: z.literal("provider_release_target_discovery_v1"),
  requiredDimensions: ProviderTargetDiscoveryRequiredDimensionsV1Schema,
  observationSources: ProviderTargetDiscoveryObservationSourcesV1Schema,
  targetCount: NonnegativeSafeIntegerV1Schema,
  targetSetDigest: ContentDigestV1Schema,
  targets: z.array(ProviderReleaseTargetUniverseTargetEntryV1Schema).max(4096),
  unresolvedObservationCount: NonnegativeSafeIntegerV1Schema,
  unresolvedObservations: z.array(ProviderTargetDiscoveryUnresolvedObservationV1Schema).max(4096),
} as const;
export const ProviderTargetDiscoveryResultUnsignedClaimsV1Schema = z.strictObject(ResultUnsignedShapeV1);
export type ProviderTargetDiscoveryResultUnsignedClaimsV1 = z.infer<
  typeof ProviderTargetDiscoveryResultUnsignedClaimsV1Schema
>;
export const ProviderTargetDiscoveryResultV1Schema = z.strictObject({
  ...ResultUnsignedShapeV1,
  discoverySignature: ProviderTargetDiscoveryResultSignatureV1Schema,
});
export type ProviderTargetDiscoveryResultV1 = z.infer<typeof ProviderTargetDiscoveryResultV1Schema>;
export const ProviderTargetDiscoveryResultEnvelopeV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  recordType: z.literal("provider_target_discovery_result"),
  discoveryGeneration: PositiveSafeIntegerV1Schema,
  contentDigest: ContentDigestV1Schema,
  payload: ProviderTargetDiscoveryResultV1Schema,
});
export type ProviderTargetDiscoveryResultEnvelopeV1 = z.infer<
  typeof ProviderTargetDiscoveryResultEnvelopeV1Schema
>;
export const ProviderTargetDiscoveryResultPinV1Schema = z.strictObject({
  locatorProfile: z.literal(PROVIDER_TARGET_DISCOVERY_RESULT_LOCATOR_PROFILE_V1),
  discoveryGeneration: PositiveSafeIntegerV1Schema,
  contentDigest: ContentDigestV1Schema,
});
export type ProviderTargetDiscoveryResultPinV1 = z.infer<
  typeof ProviderTargetDiscoveryResultPinV1Schema
>;

export const ProviderPublicSupportTaxonomyLocatorV1Schema = z.strictObject({
  locatorProfile: z.literal(PROVIDER_PUBLIC_SUPPORT_TAXONOMY_LOCATOR_PROFILE_V1),
  taxonomyGeneration: PositiveSafeIntegerV1Schema,
});
export type ProviderPublicSupportTaxonomyLocatorV1 = z.infer<
  typeof ProviderPublicSupportTaxonomyLocatorV1Schema
>;
export const ProviderReleaseMatrixLocatorV1Schema = z.strictObject({
  locatorProfile: z.literal(PROVIDER_RELEASE_MATRIX_LOCATOR_PROFILE_V1),
  releaseMatrixGeneration: PositiveSafeIntegerV1Schema,
});
export type ProviderReleaseMatrixLocatorV1 = z.infer<
  typeof ProviderReleaseMatrixLocatorV1Schema
>;
export const ProviderTargetDiscoveryFixtureManifestLocatorV1Schema = z.strictObject({
  locatorProfile: z.literal(PROVIDER_TARGET_DISCOVERY_FIXTURE_MANIFEST_LOCATOR_PROFILE_V1),
  contentDigest: ContentDigestV1Schema,
});
export type ProviderTargetDiscoveryFixtureManifestLocatorV1 = z.infer<
  typeof ProviderTargetDiscoveryFixtureManifestLocatorV1Schema
>;
export const ProviderTargetDiscoveryRunnerRunLocatorV1Schema = z.strictObject({
  locatorProfile: z.literal(PROVIDER_TARGET_DISCOVERY_RUNNER_RUN_LOCATOR_PROFILE_V1),
  runManifestContentDigest: ContentDigestV1Schema,
});
export type ProviderTargetDiscoveryRunnerRunLocatorV1 = z.infer<
  typeof ProviderTargetDiscoveryRunnerRunLocatorV1Schema
>;
export const ProviderTargetDiscoveryResultLocatorV1Schema = z.strictObject({
  locatorProfile: z.literal(PROVIDER_TARGET_DISCOVERY_RESULT_LOCATOR_PROFILE_V1),
  discoveryGeneration: PositiveSafeIntegerV1Schema,
});
export type ProviderTargetDiscoveryResultLocatorV1 = z.infer<
  typeof ProviderTargetDiscoveryResultLocatorV1Schema
>;

export type ProviderPublicSupportTaxonomyRelativePathV1 =
  `provider/public-support-taxonomy/${StoreFilenameKeyV1}.json`;
export type ProviderReleaseMatrixRelativePathV1 =
  `provider/release-matrix/${StoreFilenameKeyV1}.json`;
export type ProviderTargetDiscoveryFixtureManifestRelativePathV1 =
  `provider/real-fs-fixture-manifests/${StoreFilenameKeyV1}.json`;
export type ProviderTargetDiscoveryRunnerRunRelativePathV1 =
  `provider/target-discovery-runner-runs/${StoreFilenameKeyV1}.json`;
export type ProviderTargetDiscoveryResultRelativePathV1 =
  `provider/target-discovery-results/${StoreFilenameKeyV1}.json`;

function bytesToLowerHexV1(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}
function lowerHexToBytesV1(hex: string): Uint8Array {
  if (!regExpTestV1(/^(?:[0-9a-f]{2})+$/u, hex)) {
    throw new TypeError("invalid lowercase hex");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}
function digestForDomainV1(domain: string, fields: object): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHexV1(sha256InternalV1(createDomainPreimageBytesV1(domain, fields)))}`,
  );
}
function parseStrictFieldsV1<T>(schema: z.ZodType<T>, input: unknown): T {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  return schema.parse(input);
}
function canonicalEqualV1(left: unknown, right: unknown): boolean {
  const leftBytes = canonicalizeJcsSafeIntegerUtf8V1(left);
  const rightBytes = canonicalizeJcsSafeIntegerUtf8V1(right);
  if (leftBytes.byteLength !== rightBytes.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.byteLength; index += 1) difference |= leftBytes[index]! ^ rightBytes[index]!;
  return difference === 0;
}
function compareUtf8V1(left: string, right: string): number {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!;
    if (difference !== 0) return difference;
  }
  return leftBytes.length - rightBytes.length;
}

export function deriveProviderOsReleaseFamilyCodeV1(input: unknown) {
  const fields = parseStrictFieldsV1(ProviderPublicOsReleaseFamilyCodeFieldsV1Schema, input);
  const hex = bytesToLowerHexV1(sha256InternalV1(createDomainPreimageBytesV1(PROVIDER_OS_RELEASE_FAMILY_CODE_DOMAIN_V1, fields)));
  return ProviderOsReleaseFamilyCodeV1Schema.parse(`provider-os-family:${hex.slice(0, 22)}`);
}
export function deriveProviderFilesystemProfileCodeV1(input: unknown) {
  const fields = parseStrictFieldsV1(ProviderPublicFilesystemProfileCodeFieldsV1Schema, input);
  const hex = bytesToLowerHexV1(sha256InternalV1(createDomainPreimageBytesV1(PROVIDER_FILESYSTEM_PROFILE_CODE_DOMAIN_V1, fields)));
  return ProviderFilesystemProfileCodeV1Schema.parse(`provider-fs-profile:${hex.slice(0, 22)}`);
}
export function deriveProviderTargetProfileIdV1(input: unknown) {
  const fields = parseStrictFieldsV1(ProviderFeasibilityTargetFieldsV1Schema, input);
  const hex = bytesToLowerHexV1(sha256InternalV1(createDomainPreimageBytesV1(PROVIDER_TARGET_PROFILE_ID_DOMAIN_V1, fields)));
  return ProviderTargetProfileIdV1Schema.parse(`provider-target-profile:${hex}`);
}
export function deriveProviderPublicSupportProfileIdV1(input: unknown) {
  const fields = parseStrictFieldsV1(ProviderPublicSupportProfileFieldsV1Schema, input);
  const hex = bytesToLowerHexV1(sha256InternalV1(createDomainPreimageBytesV1(PROVIDER_PUBLIC_SUPPORT_PROFILE_ID_DOMAIN_V1, fields)));
  return ProviderPublicSupportProfileIdV1Schema.parse(`provider-public-support-profile:${hex}`);
}

function projectUnsignedV1<TSigned, TUnsigned>(
  signedSchema: z.ZodType<TSigned>,
  unsignedSchema: z.ZodType<TUnsigned>,
  signatureField: string,
  input: unknown,
): TUnsigned {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const signed = signedSchema.safeParse(input);
  if (signed.success) {
    const claims = { ...(signed.data as Record<string, unknown>) };
    delete claims[signatureField];
    return unsignedSchema.parse(claims);
  }
  return unsignedSchema.parse(input);
}
export const projectProviderPublicSupportTaxonomyUnsignedClaimsV1 = (input: unknown) =>
  projectUnsignedV1(ProviderPublicSupportTaxonomyV1Schema, ProviderPublicSupportTaxonomyUnsignedClaimsV1Schema, "taxonomySignature", input);
export const projectProviderReleaseMatrixUnsignedClaimsV1 = (input: unknown) =>
  projectUnsignedV1(ProviderReleaseMatrixV1Schema, ProviderReleaseMatrixUnsignedClaimsV1Schema, "matrixSignature", input);
export const projectProviderTargetDiscoveryInputBundleUnsignedClaimsV1 = (input: unknown) =>
  projectUnsignedV1(ProviderTargetDiscoveryInputBundleV1Schema, ProviderTargetDiscoveryInputBundleUnsignedClaimsV1Schema, "bundleSignature", input);
export const projectProviderTargetDiscoveryResultUnsignedClaimsV1 = (input: unknown) =>
  projectUnsignedV1(ProviderTargetDiscoveryResultV1Schema, ProviderTargetDiscoveryResultUnsignedClaimsV1Schema, "discoverySignature", input);

export const deriveProviderPublicSupportTaxonomyContentDigestV1 = (input: unknown) =>
  digestForDomainV1(PROVIDER_PUBLIC_SUPPORT_TAXONOMY_DOMAIN_V1, projectProviderPublicSupportTaxonomyUnsignedClaimsV1(input));
export const deriveProviderReleaseTargetEntrySetDigestV1 = (input: unknown) =>
  digestForDomainV1(PROVIDER_RELEASE_TARGET_ENTRY_SET_DOMAIN_V1, parseStrictFieldsV1(ProviderReleaseTargetEntrySetFieldsV1Schema, input));
export const deriveProviderReleaseMatrixContentDigestV1 = (input: unknown) =>
  digestForDomainV1(PROVIDER_RELEASE_MATRIX_DOMAIN_V1, projectProviderReleaseMatrixUnsignedClaimsV1(input));
export const deriveProviderTargetDiscoverySourceManifestRecordSetDigestV1 = (input: unknown) =>
  digestForDomainV1(PROVIDER_TARGET_DISCOVERY_SOURCE_MANIFEST_RECORD_SET_DOMAIN_V1, parseStrictFieldsV1(ProviderTargetDiscoverySourceManifestRecordSetFieldsV1Schema, input));
export const deriveProviderTargetDiscoveryFixtureManifestContentDigestV1 = (input: unknown) =>
  digestForDomainV1(PROVIDER_TARGET_DISCOVERY_FIXTURE_MANIFEST_DOMAIN_V1, parseStrictFieldsV1(ProviderTargetDiscoveryFixtureManifestV1Schema, input));
export const deriveProviderTargetDiscoveryRunnerRunManifestContentDigestV1 = (input: unknown) =>
  digestForDomainV1(PROVIDER_TARGET_DISCOVERY_RUNNER_RUN_MANIFEST_DOMAIN_V1, parseStrictFieldsV1(ProviderTargetDiscoveryRunnerRunManifestV1Schema, input));
export const deriveProviderTargetDiscoveryObservationCutDigestV1 = (input: unknown) =>
  digestForDomainV1(PROVIDER_TARGET_DISCOVERY_OBSERVATION_CUT_DOMAIN_V1, parseStrictFieldsV1(ProviderTargetDiscoveryObservationCutV1Schema, input));
export const deriveProviderTargetDiscoveryPrivacySafeObservationClaimsDigestV1 = (input: unknown) =>
  digestForDomainV1(PROVIDER_TARGET_DISCOVERY_SOURCE_RECORD_DOMAIN_V1, parseStrictFieldsV1(ProviderTargetDiscoverySourceRecordProjectionV1Schema, input));
export const deriveProviderTargetDiscoveryObservationKeyDigestV1 = (input: unknown) =>
  digestForDomainV1(PROVIDER_TARGET_DISCOVERY_OBSERVATION_KEY_DOMAIN_V1, parseStrictFieldsV1(ProviderTargetDiscoveryObservationKeyFieldsV1Schema, input));
export const deriveProviderTargetDiscoverySourceObservationSetDigestV1 = (input: unknown) =>
  digestForDomainV1(PROVIDER_TARGET_DISCOVERY_SOURCE_OBSERVATION_SET_DOMAIN_V1, parseStrictFieldsV1(ProviderTargetDiscoverySourceObservationSetFieldsV1Schema, input));
export const deriveProviderTargetDiscoveryInputObservationSetDigestV1 = (input: unknown) =>
  digestForDomainV1(PROVIDER_TARGET_DISCOVERY_INPUT_OBSERVATION_SET_DOMAIN_V1, parseStrictFieldsV1(ProviderTargetDiscoveryInputObservationSetFieldsV1Schema, input));
export const deriveProviderTargetDiscoveryInputBundleContentDigestV1 = (input: unknown) =>
  digestForDomainV1(PROVIDER_TARGET_DISCOVERY_INPUT_BUNDLE_DOMAIN_V1, projectProviderTargetDiscoveryInputBundleUnsignedClaimsV1(input));
export const deriveProviderTargetDiscoveryResultContentDigestV1 = (input: unknown) =>
  digestForDomainV1(PROVIDER_TARGET_DISCOVERY_RESULT_DOMAIN_V1, projectProviderTargetDiscoveryResultUnsignedClaimsV1(input));

export const ProviderPublicSupportTaxonomySignatureWrapperV1Schema = z.strictObject({
  rootKeyId: ProviderRegistryRootKeyIdV1Schema,
  domain: z.literal(PROVIDER_PUBLIC_SUPPORT_TAXONOMY_SIGNATURE_DOMAIN_V1),
  claims: ProviderPublicSupportTaxonomyUnsignedClaimsV1Schema,
});
export const ProviderReleaseMatrixSignatureWrapperV1Schema = z.strictObject({
  rootKeyId: ProviderRegistryRootKeyIdV1Schema,
  domain: z.literal(PROVIDER_RELEASE_MATRIX_SIGNATURE_DOMAIN_V1),
  claims: ProviderReleaseMatrixUnsignedClaimsV1Schema,
});
export const ProviderTargetDiscoveryInputBundleSignatureWrapperV1Schema = z.strictObject({
  rootKeyId: ProviderRegistryRootKeyIdV1Schema,
  domain: z.literal(PROVIDER_TARGET_DISCOVERY_INPUT_BUNDLE_SIGNATURE_DOMAIN_V1),
  claims: ProviderTargetDiscoveryInputBundleUnsignedClaimsV1Schema,
});
export const ProviderTargetDiscoveryResultSignatureWrapperV1Schema = z.strictObject({
  rootKeyId: ProviderRegistryRootKeyIdV1Schema,
  domain: z.literal(PROVIDER_TARGET_DISCOVERY_RESULT_SIGNATURE_DOMAIN_V1),
  claims: ProviderTargetDiscoveryResultUnsignedClaimsV1Schema,
});

function rootKeyIdFromSignatureV1(input: unknown, field: string, pattern: RegExp): string | undefined {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  const value = CapturedObjectGetOwnPropertyDescriptorsV1(input)[field]?.value;
  return typeof value === "string" ? regExpExecV1(pattern, value)?.[1] : undefined;
}
function resolveSignatureRootKeyIdV1(input: unknown, field: string, pattern: RegExp, rootKeyId: unknown): string {
  const signed = rootKeyIdFromSignatureV1(input, field, pattern);
  const requested = rootKeyId === undefined ? undefined : ProviderRegistryRootKeyIdV1Schema.parse(rootKeyId);
  if (signed !== undefined && requested !== undefined && signed !== requested) throw new TypeError("signature root key mismatch");
  if (signed === undefined && requested === undefined) throw new TypeError("rootKeyId is required for unsigned claims");
  return ProviderRegistryRootKeyIdV1Schema.parse(signed ?? requested);
}
const TAXONOMY_SIGNATURE_PATTERN = /^provider-public-support-taxonomy-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;
const MATRIX_SIGNATURE_PATTERN = /^provider-release-matrix-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;
const BUNDLE_SIGNATURE_PATTERN = /^provider-target-discovery-input-bundle-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;
const RESULT_SIGNATURE_PATTERN = /^provider-target-discovery-result-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;
function signatureMessageV1<T>(domain: string, wrapperSchema: z.ZodType<T>, wrapper: unknown): Uint8Array {
  return canonicalizeJcsSafeIntegerUtf8V1([domain, wrapperSchema.parse(wrapper)]);
}
export function createProviderPublicSupportTaxonomySignatureMessageV1(input: unknown, rootKeyId?: unknown): Uint8Array {
  return signatureMessageV1(PROVIDER_PUBLIC_SUPPORT_TAXONOMY_SIGNATURE_DOMAIN_V1, ProviderPublicSupportTaxonomySignatureWrapperV1Schema, {
    rootKeyId: resolveSignatureRootKeyIdV1(input, "taxonomySignature", TAXONOMY_SIGNATURE_PATTERN, rootKeyId),
    domain: PROVIDER_PUBLIC_SUPPORT_TAXONOMY_SIGNATURE_DOMAIN_V1,
    claims: projectProviderPublicSupportTaxonomyUnsignedClaimsV1(input),
  });
}
export function createProviderReleaseMatrixSignatureMessageV1(input: unknown, rootKeyId?: unknown): Uint8Array {
  return signatureMessageV1(PROVIDER_RELEASE_MATRIX_SIGNATURE_DOMAIN_V1, ProviderReleaseMatrixSignatureWrapperV1Schema, {
    rootKeyId: resolveSignatureRootKeyIdV1(input, "matrixSignature", MATRIX_SIGNATURE_PATTERN, rootKeyId),
    domain: PROVIDER_RELEASE_MATRIX_SIGNATURE_DOMAIN_V1,
    claims: projectProviderReleaseMatrixUnsignedClaimsV1(input),
  });
}
export function createProviderTargetDiscoveryInputBundleSignatureMessageV1(input: unknown, rootKeyId?: unknown): Uint8Array {
  return signatureMessageV1(PROVIDER_TARGET_DISCOVERY_INPUT_BUNDLE_SIGNATURE_DOMAIN_V1, ProviderTargetDiscoveryInputBundleSignatureWrapperV1Schema, {
    rootKeyId: resolveSignatureRootKeyIdV1(input, "bundleSignature", BUNDLE_SIGNATURE_PATTERN, rootKeyId),
    domain: PROVIDER_TARGET_DISCOVERY_INPUT_BUNDLE_SIGNATURE_DOMAIN_V1,
    claims: projectProviderTargetDiscoveryInputBundleUnsignedClaimsV1(input),
  });
}
export function createProviderTargetDiscoveryResultSignatureMessageV1(input: unknown, rootKeyId?: unknown): Uint8Array {
  return signatureMessageV1(PROVIDER_TARGET_DISCOVERY_RESULT_SIGNATURE_DOMAIN_V1, ProviderTargetDiscoveryResultSignatureWrapperV1Schema, {
    rootKeyId: resolveSignatureRootKeyIdV1(input, "discoverySignature", RESULT_SIGNATURE_PATTERN, rootKeyId),
    domain: PROVIDER_TARGET_DISCOVERY_RESULT_SIGNATURE_DOMAIN_V1,
    claims: projectProviderTargetDiscoveryResultUnsignedClaimsV1(input),
  });
}

function contentBoundEnvelopeV1<T>(schema: z.ZodType<T>, input: unknown, derive: (payload: unknown) => ContentDigestV1, generationField?: string): T {
  assertJsonDataTreeBeforeSchemaV1(input);
  const envelope = schema.parse(input) as Record<string, unknown>;
  const payload = envelope.payload as Record<string, unknown>;
  if (envelope.contentDigest !== derive(payload)) throw new TypeError("locator envelope digest mismatch");
  if (generationField !== undefined && envelope[generationField] !== payload[generationField]) throw new TypeError("locator envelope generation mismatch");
  return envelope as T;
}
export function buildProviderPublicSupportTaxonomyRelativePathV1(input: unknown): ProviderPublicSupportTaxonomyRelativePathV1 {
  const envelope = contentBoundEnvelopeV1(ProviderPublicSupportTaxonomyEnvelopeV1Schema, input, deriveProviderPublicSupportTaxonomyContentDigestV1, "taxonomyGeneration");
  return `provider/public-support-taxonomy/${encodeStoreFilenameKeyV1(`taxonomy-generation:${envelope.payload.taxonomyGeneration}`)}.json`;
}
export function buildProviderReleaseMatrixRelativePathV1(input: unknown): ProviderReleaseMatrixRelativePathV1 {
  const envelope = contentBoundEnvelopeV1(ProviderReleaseMatrixEnvelopeV1Schema, input, deriveProviderReleaseMatrixContentDigestV1, "releaseMatrixGeneration");
  return `provider/release-matrix/${encodeStoreFilenameKeyV1(`release-matrix-generation:${envelope.payload.releaseMatrixGeneration}`)}.json`;
}
export function buildProviderTargetDiscoveryFixtureManifestRelativePathV1(input: unknown): ProviderTargetDiscoveryFixtureManifestRelativePathV1 {
  const envelope = contentBoundEnvelopeV1(ProviderTargetDiscoveryFixtureManifestEnvelopeV1Schema, input, deriveProviderTargetDiscoveryFixtureManifestContentDigestV1);
  if (envelope.fixtureManifestDigest !== envelope.payload.fixtureManifestDigest) {
    throw new TypeError("locator envelope fixture manifest digest mismatch");
  }
  return `provider/real-fs-fixture-manifests/${encodeStoreFilenameKeyV1(`fixture-envelope:${envelope.contentDigest}`)}.json`;
}
export function buildProviderTargetDiscoveryRunnerRunRelativePathV1(input: unknown): ProviderTargetDiscoveryRunnerRunRelativePathV1 {
  const envelope = contentBoundEnvelopeV1(ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema, input, deriveProviderTargetDiscoveryRunnerRunManifestContentDigestV1);
  return `provider/target-discovery-runner-runs/${encodeStoreFilenameKeyV1(`runner-run:${envelope.contentDigest}`)}.json`;
}
export function buildProviderTargetDiscoveryResultRelativePathV1(input: unknown): ProviderTargetDiscoveryResultRelativePathV1 {
  const envelope = contentBoundEnvelopeV1(ProviderTargetDiscoveryResultEnvelopeV1Schema, input, deriveProviderTargetDiscoveryResultContentDigestV1, "discoveryGeneration");
  return `provider/target-discovery-results/${encodeStoreFilenameKeyV1(`discovery-generation:${envelope.payload.discoveryGeneration}`)}.json`;
}

export const ProviderTargetDiscoveryPointInvalidStageV1Schema = z.enum([
  "input",
  "source_closure",
  "envelope_limit",
  "distribution_binding",
  "active_root",
  "taxonomy_structure",
  "taxonomy_digest",
  "taxonomy_signature",
  "taxonomy_envelope",
  "matrix_structure",
  "matrix_taxonomy_pin",
  "matrix_digest",
  "matrix_signature",
  "matrix_envelope",
  "fixture_structure",
  "fixture_source_pin",
  "fixture_digest",
  "fixture_envelope",
  "runner_structure",
  "runner_digest",
  "runner_envelope",
  "bundle_structure",
  "bundle_cut",
  "bundle_projection",
  "bundle_digest",
  "bundle_signature",
  "result_structure",
  "result_projection",
  "result_digest",
  "result_signature",
  "result_envelope",
  "locator",
]);
export type ProviderTargetDiscoveryPointInvalidStageV1 = z.infer<
  typeof ProviderTargetDiscoveryPointInvalidStageV1Schema
>;
export const ProviderTargetDiscoveryPointInvalidReasonV1Schema = z.enum([
  "schema_invalid",
  "source_invalid",
  "byte_limit_exceeded",
  "binding_mismatch",
  "root_mismatch",
  "ordering_invalid",
  "count_mismatch",
  "digest_mismatch",
  "coverage_mismatch",
  "signature_invalid",
  "envelope_mismatch",
  "conflicting_resolved_targets",
]);
export type ProviderTargetDiscoveryPointInvalidReasonV1 = z.infer<
  typeof ProviderTargetDiscoveryPointInvalidReasonV1Schema
>;

interface PointDiagnosticFailureV1 {
  readonly ok: false;
  readonly stage: ProviderTargetDiscoveryPointInvalidStageV1;
  readonly reason: ProviderTargetDiscoveryPointInvalidReasonV1;
}
interface PointDiagnosticSuccessV1 {
  readonly ok: true;
  readonly value: ProviderTargetDiscoveryPointClosureValidationV1;
}
export type ProviderTargetDiscoveryPointClosureDiagnosticResultV1 =
  | PointDiagnosticFailureV1
  | PointDiagnosticSuccessV1;

class PointDiagnosticSignal extends Error {
  constructor(
    readonly stage: ProviderTargetDiscoveryPointInvalidStageV1,
    readonly reason: ProviderTargetDiscoveryPointInvalidReasonV1,
  ) {
    super("target discovery point diagnostic");
  }
}
function fail(
  stage: ProviderTargetDiscoveryPointInvalidStageV1,
  reason: ProviderTargetDiscoveryPointInvalidReasonV1,
): never {
  throw new PointDiagnosticSignal(stage, reason);
}

export interface ValidateProviderTargetDiscoveryPointClosureV1Input {
  readonly distributionRootBinding: ProviderSignedDistributionRootBindingV1;
  readonly activeRootMetadata: ProviderRegistryRootMetadataPinV1;
  readonly activeRoot: ProviderRegistryRootPublicKeyV1;
  readonly fixtureCorpusManifest: ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1;
  readonly suiteManifest: ProviderRealFilesystemSuiteManifestEnvelopeV1;
  readonly publicSupportTaxonomy: ProviderPublicSupportTaxonomyEnvelopeV1;
  readonly releaseMatrix: ProviderReleaseMatrixEnvelopeV1;
  readonly targetDiscoveryFixtureManifest: ProviderTargetDiscoveryFixtureManifestEnvelopeV1;
  readonly targetDiscoveryRunnerRun: ProviderTargetDiscoveryRunnerRunEnvelopeV1;
  readonly targetDiscoveryResult: ProviderTargetDiscoveryResultEnvelopeV1;
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
}

export interface ProviderTargetDiscoveryPointClosureValidationV1 {
  readonly authority: "none_target_discovery_point_structure_only";
  readonly distributionRootBinding: ProviderSignedDistributionRootBindingV1;
  readonly activeRootMetadata: ProviderRegistryRootMetadataPinV1;
  readonly publicSupportTaxonomy: ProviderPublicSupportTaxonomyPinV1;
  readonly releaseMatrix: ProviderReleaseMatrixPinV1;
  readonly realFilesystemSuiteManifest: ProviderRealFilesystemSuiteManifestPinV1;
  readonly targetDiscoveryFixtureManifest: ProviderTargetDiscoveryFixtureManifestPinV1;
  readonly targetDiscoveryRunner: ProviderTargetDiscoveryRunnerInstancePinV1;
  readonly targetDiscoveryInputBundleContentDigest: ContentDigestV1;
  readonly targetDiscoveryResult: ProviderTargetDiscoveryResultPinV1;
  readonly locators: {
    readonly publicSupportTaxonomy: ProviderPublicSupportTaxonomyRelativePathV1;
    readonly releaseMatrix: ProviderReleaseMatrixRelativePathV1;
    readonly targetDiscoveryFixtureManifest: ProviderTargetDiscoveryFixtureManifestRelativePathV1;
    readonly targetDiscoveryRunnerRun: ProviderTargetDiscoveryRunnerRunRelativePathV1;
    readonly targetDiscoveryResult: ProviderTargetDiscoveryResultRelativePathV1;
  };
  readonly sourceRecordCount: number;
  readonly observationCount: number;
  readonly targetCount: number;
  readonly unresolvedObservationCount: number;
}

export class ProviderTargetDiscoveryPointClosureValidationError extends Error {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super("Provider target discovery point closure validation failed");
    this.name = "ProviderTargetDiscoveryPointClosureValidationError";
  }
}

const POINT_INPUT_KEYS = CapturedObjectFreezeV1([
  "activeRoot",
  "activeRootMetadata",
  "distributionRootBinding",
  "fixtureCorpusManifest",
  "publicSupportTaxonomy",
  "releaseMatrix",
  "strictCryptoCapability",
  "suiteManifest",
  "targetDiscoveryFixtureManifest",
  "targetDiscoveryResult",
  "targetDiscoveryRunnerRun",
] as const);
const POINT_JSON_INPUT_KEYS = CapturedObjectFreezeV1([
  "activeRoot",
  "activeRootMetadata",
  "distributionRootBinding",
  "fixtureCorpusManifest",
  "publicSupportTaxonomy",
  "releaseMatrix",
  "suiteManifest",
  "targetDiscoveryFixtureManifest",
  "targetDiscoveryResult",
  "targetDiscoveryRunnerRun",
] as const);

interface PreparedProviderTargetDiscoveryPointInputV1 {
  readonly snapshot: ProviderTargetDiscoveryPointSnapshotV1;
  readonly preSnapshotOptIn: boolean;
}

function prepareProviderTargetDiscoveryPointFromRawInputV1(
  input: unknown,
): PreparedProviderTargetDiscoveryPointInputV1 {
  const preSnapshot = takeProviderTargetDiscoveryPointPreSnapshotV1(input);
  if (preSnapshot !== undefined) {
    return { snapshot: preSnapshot, preSnapshotOptIn: true };
  }
  try {
    const admission = createProviderPointRawAdmissionSessionV1(input);
    const captured = captureProviderPointRawExactTopLevelV1(
      admission,
      POINT_INPUT_KEYS,
    );
    const strictCryptoCapability = captured.strictCryptoCapability;
    assertProviderStrictEd25519CryptoCapabilityIdentityV1(
      ProviderStrictEd25519AttestationError,
      strictCryptoCapability,
    );
    for (
      let index = 0;
      index < POINT_JSON_INPUT_KEYS.length;
      index += 1
    ) {
      const key = POINT_JSON_INPUT_KEYS[index]!;
      walkProviderPointRawJsonIdentityTreeV1(admission, captured[key]);
    }

    const detachedInput = cloneProviderPointRawAdmissionCapsuleV1(admission);
    const detachedAdmission = createProviderPointRawAdmissionSessionV1(
      detachedInput,
    );
    const detached = captureProviderPointRawExactTopLevelV1(
      detachedAdmission,
      POINT_INPUT_KEYS,
    );
    for (
      let index = 0;
      index < POINT_JSON_INPUT_KEYS.length;
      index += 1
    ) {
      const key = POINT_JSON_INPUT_KEYS[index]!;
      walkProviderPointRawJsonIdentityTreeV1(
        detachedAdmission,
        detached[key],
      );
    }

    const snapshot = createProviderTargetDiscoveryPointSnapshotV1({
      activeRoot: deepFreezeProviderPointDetachedDataTreeV1(
        detached.activeRoot,
      ) as ProviderRegistryRootPublicKeyV1,
      activeRootMetadata: deepFreezeProviderPointDetachedDataTreeV1(
        detached.activeRootMetadata,
      ) as ProviderRegistryRootMetadataPinV1,
      distributionRootBinding: deepFreezeProviderPointDetachedDataTreeV1(
        detached.distributionRootBinding,
      ) as ProviderSignedDistributionRootBindingV1,
      fixtureCorpusManifest: deepFreezeProviderPointDetachedDataTreeV1(
        detached.fixtureCorpusManifest,
      ) as ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1,
      publicSupportTaxonomy: deepFreezeProviderPointDetachedDataTreeV1(
        detached.publicSupportTaxonomy,
      ) as ProviderPublicSupportTaxonomyEnvelopeV1,
      releaseMatrix: deepFreezeProviderPointDetachedDataTreeV1(
        detached.releaseMatrix,
      ) as ProviderReleaseMatrixEnvelopeV1,
      strictCryptoCapability:
        strictCryptoCapability as ProviderStrictEd25519OpaqueCapabilityV1,
      suiteManifest: deepFreezeProviderPointDetachedDataTreeV1(
        detached.suiteManifest,
      ) as ProviderRealFilesystemSuiteManifestEnvelopeV1,
      targetDiscoveryFixtureManifest:
        deepFreezeProviderPointDetachedDataTreeV1(
          detached.targetDiscoveryFixtureManifest,
        ) as ProviderTargetDiscoveryFixtureManifestEnvelopeV1,
      targetDiscoveryResult: deepFreezeProviderPointDetachedDataTreeV1(
        detached.targetDiscoveryResult,
      ) as ProviderTargetDiscoveryResultEnvelopeV1,
      targetDiscoveryRunnerRun: deepFreezeProviderPointDetachedDataTreeV1(
        detached.targetDiscoveryRunnerRun,
      ) as ProviderTargetDiscoveryRunnerRunEnvelopeV1,
    });
    return { snapshot, preSnapshotOptIn: false };
  } catch {
    return fail("input", "schema_invalid");
  }
}

function decodeCanonicalPublicKeyBytes32V1(value: string): Uint8Array {
  const body = value.slice("base64url:".length);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const output = new Uint8Array(32);
  let accumulator = 0;
  let availableBits = 0;
  let offset = 0;
  for (const character of body) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) throw new TypeError("invalid canonical public key");
    accumulator = (accumulator << 6) | digit;
    availableBits += 6;
    if (availableBits >= 8) {
      availableBits -= 8;
      output[offset] = (accumulator >>> availableBits) & 0xff;
      offset += 1;
      accumulator &= (1 << availableBits) - 1;
    }
  }
  if (offset !== 32 || availableBits !== 2 || accumulator !== 0) throw new TypeError("public key must decode to exact raw32");
  return output;
}

function verifyPointRootSignatureV1(
  signature: string,
  pattern: RegExp,
  root: ProviderRegistryRootPublicKeyV1,
  createMessage: () => Uint8Array,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
  stage: "taxonomy_signature" | "matrix_signature" | "bundle_signature" | "result_signature",
  preparedContext?: PreparedDistributionVerificationContextV1,
): Promise<void> {
  return hardenProviderPointPromiseV1(
    (async (): Promise<void> => {
      try {
        const match = regExpExecV1(pattern, signature);
        if (
          match?.[1] === undefined ||
          match[2] === undefined ||
          match[1] !== root.rootKeyId
        ) {
          return fail(stage, "signature_invalid");
        }
        const publicKeyBytes = decodeCanonicalPublicKeyBytes32V1(
          root.publicKeyBytes,
        );
        const message = createMessage();
        const signatureBytes = lowerHexToBytesV1(match[2]);
        if (preparedContext !== undefined) {
          recordPreparedDistributionSignatureVerificationInternalV1(
            preparedContext,
          );
        }
        if (
          !(await verifyRawEd25519WithCapabilityV1(
            capability,
            publicKeyBytes,
            message,
            signatureBytes,
          ))
        ) {
          return fail(stage, "signature_invalid");
        }
      } catch (error) {
        if (error instanceof PointDiagnosticSignal) throw error;
        return fail(stage, "signature_invalid");
      }
    })(),
  );
}

function validateGenerationPredecessorV1(
  generation: number,
  predecessor: string | undefined,
  stage: "taxonomy_structure" | "matrix_structure" | "result_structure",
): void {
  if ((generation === 1) !== (predecessor === undefined)) return fail(stage, "coverage_mismatch");
}

function validateTaxonomyRecordsV1(taxonomy: ProviderPublicSupportTaxonomyV1): void {
  validateGenerationPredecessorV1(
    taxonomy.taxonomyGeneration,
    taxonomy.predecessorTaxonomyContentDigest,
    "taxonomy_structure",
  );
  const osDescriptorKeys = new CapturedSetV1<string>();
  for (let index = 0; index < taxonomy.osReleaseFamilies.length; index += 1) {
    const record = taxonomy.osReleaseFamilies[index]!;
    const previous = taxonomy.osReleaseFamilies[index - 1];
    if (previous !== undefined && compareUtf8V1(previous.osReleaseFamilyCode, record.osReleaseFamilyCode) >= 0) {
      return fail("taxonomy_structure", "ordering_invalid");
    }
    const descriptorKey = JSON.stringify(record.descriptor);
    if (setHasV1(osDescriptorKeys, descriptorKey)) {
      return fail("taxonomy_structure", "ordering_invalid");
    }
    setAddV1(osDescriptorKeys, descriptorKey);
    if (record.osReleaseFamilyCode !== deriveProviderOsReleaseFamilyCodeV1({ descriptor: record.descriptor })) {
      return fail("taxonomy_digest", "digest_mismatch");
    }
  }
  const filesystemDescriptorKeys = new CapturedSetV1<string>();
  for (let index = 0; index < taxonomy.filesystemProfiles.length; index += 1) {
    const record = taxonomy.filesystemProfiles[index]!;
    const previous = taxonomy.filesystemProfiles[index - 1];
    if (previous !== undefined && compareUtf8V1(previous.filesystemProfileCode, record.filesystemProfileCode) >= 0) {
      return fail("taxonomy_structure", "ordering_invalid");
    }
    const descriptorKey = JSON.stringify(record.descriptor);
    if (setHasV1(filesystemDescriptorKeys, descriptorKey)) {
      return fail("taxonomy_structure", "ordering_invalid");
    }
    setAddV1(filesystemDescriptorKeys, descriptorKey);
    if (record.filesystemProfileCode !== deriveProviderFilesystemProfileCodeV1({ descriptor: record.descriptor })) {
      return fail("taxonomy_digest", "digest_mismatch");
    }
  }
}

interface TaxonomyIndexesV1 {
  readonly osFamilies: Map<string, "darwin" | "linux">;
  readonly filesystems: Map<string, "darwin" | "linux">;
}
function taxonomyIndexesV1(taxonomy: ProviderPublicSupportTaxonomyV1): TaxonomyIndexesV1 {
  return {
    osFamilies: mapFromEntriesV1(arrayMapV1(taxonomy.osReleaseFamilies, (record) => [record.osReleaseFamilyCode, record.descriptor.osPlatform] as const)),
    filesystems: mapFromEntriesV1(arrayMapV1(taxonomy.filesystemProfiles, (record) => [record.filesystemProfileCode, record.descriptor.osPlatform] as const)),
  };
}
function validateTargetEntryV1(
  entry: ProviderReleaseTargetUniverseTargetEntryV1,
  taxonomy: TaxonomyIndexesV1,
  digestStage: "matrix_digest" | "fixture_digest" | "runner_digest" | "result_digest",
  taxonomyStage: "matrix_taxonomy_pin" | "fixture_structure" | "runner_structure" | "result_projection",
): void {
  const target = entry.target;
  const targetFields = {
    osPlatform: target.osPlatform,
    osReleaseFamilyCode: target.osReleaseFamilyCode,
    osBuildDigest: target.osBuildDigest,
    architecture: target.architecture,
    filesystemProfileCode: target.filesystemProfileCode,
    filesystemFeatureProfileDigest: target.filesystemFeatureProfileDigest,
    mountOptionProfileDigest: target.mountOptionProfileDigest,
  };
  if (
    target.targetProfileId !== deriveProviderTargetProfileIdV1(targetFields) ||
    entry.publicProfileId !== deriveProviderPublicSupportProfileIdV1({
      osPlatform: target.osPlatform,
      osReleaseFamilyCode: target.osReleaseFamilyCode,
      architecture: target.architecture,
      filesystemProfileCode: target.filesystemProfileCode,
    })
  ) {
    return fail(digestStage, "digest_mismatch");
  }
  if (
    mapGetV1(taxonomy.osFamilies, target.osReleaseFamilyCode) !== target.osPlatform ||
    mapGetV1(taxonomy.filesystems, target.filesystemProfileCode) !== target.osPlatform
  ) {
    return fail(taxonomyStage, "coverage_mismatch");
  }
}
function validateSortedTargetEntriesV1(
  targets: readonly ProviderReleaseTargetUniverseTargetEntryV1[],
  taxonomy: TaxonomyIndexesV1,
  stage: "matrix_structure" | "bundle_projection" | "result_projection",
  digestStage: "matrix_digest" | "result_digest",
  taxonomyStage: "matrix_taxonomy_pin" | "result_projection",
): void {
  for (let index = 0; index < targets.length; index += 1) {
    const entry = targets[index]!;
    validateTargetEntryV1(entry, taxonomy, digestStage, taxonomyStage);
    const previous = targets[index - 1];
    if (previous !== undefined && compareUtf8V1(previous.target.targetProfileId, entry.target.targetProfileId) >= 0) {
      return fail(stage, "ordering_invalid");
    }
  }
}

function validateSourceManifestRecordsV1(
  records: readonly ProviderTargetDiscoverySourceManifestRecordV1[],
  stage: "fixture_structure" | "runner_structure",
): void {
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]!;
    if (record.sourceRecordOrdinal !== index) return fail(stage, "ordering_invalid");
  }
}

function expectedObservationV1(
  observationSource: ProviderTargetDiscoveryObservationSourceV1,
  sourceArtifactContentDigest: ContentDigestV1,
  sourceRecordOrdinal: number,
  outcome: ProviderTargetDiscoverySourceRecordOutcomeV1,
): ProviderTargetDiscoveryInputObservationV1 {
  const projection = {
    observationSource,
    sourceArtifactContentDigest,
    sourceRecordOrdinal,
    outcome,
  };
  const privacySafeObservationClaimsDigest =
    deriveProviderTargetDiscoveryPrivacySafeObservationClaimsDigestV1(projection);
  return ProviderTargetDiscoveryInputObservationV1Schema.parse({
    ...projection,
    privacySafeObservationClaimsDigest,
    observationKeyDigest: deriveProviderTargetDiscoveryObservationKeyDigestV1({
      observationSource,
      sourceArtifactContentDigest,
      sourceRecordOrdinal,
      privacySafeObservationClaimsDigest,
    }),
  });
}

function projectExpectedObservationsV1(
  matrix: ProviderReleaseMatrixEnvelopeV1,
  fixture: ProviderTargetDiscoveryFixtureManifestEnvelopeV1,
  runner: ProviderTargetDiscoveryRunnerRunEnvelopeV1,
): readonly [
  ProviderTargetDiscoveryInputObservationV1[],
  ProviderTargetDiscoveryInputObservationV1[],
  ProviderTargetDiscoveryInputObservationV1[],
] {
  return [
    arrayMapV1(matrix.payload.targets, (target, sourceRecordOrdinal) => expectedObservationV1(
      "signed_release_matrix",
      matrix.contentDigest,
      sourceRecordOrdinal,
      { state: "resolved", target },
    )),
    arrayMapV1(fixture.payload.records, (record) => expectedObservationV1(
      "real_filesystem_fixture_manifest",
      fixture.contentDigest,
      record.sourceRecordOrdinal,
      record.outcome,
    )),
    arrayMapV1(runner.payload.records, (record) => expectedObservationV1(
      "target_discovery_runner",
      runner.contentDigest,
      record.sourceRecordOrdinal,
      record.outcome,
    )),
  ];
}

interface HistoricalTaxonomySemanticStateV1 {
  readonly envelope: ProviderPublicSupportTaxonomyEnvelopeV1;
  readonly pin: ProviderPublicSupportTaxonomyPinV1;
  readonly indexes: TaxonomyIndexesV1;
}

interface HistoricalMatrixSemanticStateV1 {
  readonly envelope: ProviderReleaseMatrixEnvelopeV1;
  readonly pin: ProviderReleaseMatrixPinV1;
  readonly taxonomy: HistoricalTaxonomySemanticStateV1;
}

interface HistoricalSuiteSemanticStateViewV1 {
  readonly envelope: ProviderRealFilesystemSuiteManifestEnvelopeV1;
  readonly suitePin: ProviderRealFilesystemSuiteManifestPinV1;
}

interface HistoricalBundleSemanticStateV1 {
  readonly bundle: ProviderTargetDiscoveryInputBundleV1;
  readonly bundleContentDigest: ContentDigestV1;
  readonly fixtureEnvelope: ProviderTargetDiscoveryFixtureManifestEnvelopeV1;
  readonly fixturePin: ProviderTargetDiscoveryFixtureManifestPinV1;
  readonly matrix: HistoricalMatrixSemanticStateV1;
  readonly observationCutDigest: ContentDigestV1;
  readonly observationSetDigest: ContentDigestV1;
  readonly projectedTargets: readonly ProviderReleaseTargetUniverseTargetEntryV1[];
  readonly runnerEnvelope: ProviderTargetDiscoveryRunnerRunEnvelopeV1;
  readonly runnerPin: ProviderTargetDiscoveryRunnerInstancePinV1;
  readonly suite: HistoricalSuiteSemanticStateViewV1;
  readonly taxonomy: HistoricalTaxonomySemanticStateV1;
  readonly unresolved: readonly ProviderTargetDiscoveryUnresolvedObservationV1[];
}

interface HistoricalResultSemanticStateV1 {
  readonly bundle: HistoricalBundleSemanticStateV1;
  readonly envelope: ProviderTargetDiscoveryResultEnvelopeV1;
  readonly pin: ProviderTargetDiscoveryResultPinV1;
}

function validateHistoricalTaxonomySemanticCoreV1(
  suppliedEnvelope: ProviderPublicSupportTaxonomyEnvelopeV1,
): HistoricalTaxonomySemanticStateV1 {
  ProviderPublicSupportTaxonomyEnvelopeV1Schema.parse(suppliedEnvelope);
  const envelope = suppliedEnvelope;
  const taxonomy = envelope.payload;
  validateTaxonomyRecordsV1(taxonomy);
  if (envelope.taxonomyGeneration !== taxonomy.taxonomyGeneration) {
    return fail("taxonomy_envelope", "envelope_mismatch");
  }
  if (
    envelope.contentDigest !==
    deriveProviderPublicSupportTaxonomyContentDigestV1(taxonomy)
  ) {
    return fail("taxonomy_envelope", "envelope_mismatch");
  }
  return {
    envelope,
    pin: ProviderPublicSupportTaxonomyPinV1Schema.parse({
      locatorProfile: PROVIDER_PUBLIC_SUPPORT_TAXONOMY_LOCATOR_PROFILE_V1,
      taxonomyGeneration: taxonomy.taxonomyGeneration,
      contentDigest: envelope.contentDigest,
    }),
    indexes: taxonomyIndexesV1(taxonomy),
  };
}

function asHistoricalTaxonomyStateV1(
  value: unknown,
  envelope: ProviderPublicSupportTaxonomyEnvelopeV1,
): HistoricalTaxonomySemanticStateV1 {
  const state = value as HistoricalTaxonomySemanticStateV1;
  if (state?.envelope !== envelope) {
    return fail("matrix_taxonomy_pin", "binding_mismatch");
  }
  return state;
}

function validateHistoricalMatrixSemanticCoreV1(
  suppliedEnvelope: ProviderReleaseMatrixEnvelopeV1,
  taxonomyEnvelope: ProviderPublicSupportTaxonomyEnvelopeV1,
  suppliedTaxonomyState: unknown,
): HistoricalMatrixSemanticStateV1 {
  ProviderReleaseMatrixEnvelopeV1Schema.parse(suppliedEnvelope);
  const taxonomy = asHistoricalTaxonomyStateV1(
    suppliedTaxonomyState,
    taxonomyEnvelope,
  );
  const envelope = suppliedEnvelope;
  const matrix = envelope.payload;
  if (
    !canonicalEqualV1(
      matrix.distributionRootBinding,
      taxonomy.envelope.payload.distributionRootBinding,
    ) ||
    !canonicalEqualV1(
      matrix.activeRootMetadata,
      taxonomy.envelope.payload.activeRootMetadata,
    ) ||
    matrix.registryRootKeyId !== taxonomy.envelope.payload.registryRootKeyId
  ) {
    return fail("matrix_taxonomy_pin", "binding_mismatch");
  }
  if (!canonicalEqualV1(matrix.publicSupportTaxonomy, taxonomy.pin)) {
    return fail("matrix_taxonomy_pin", "binding_mismatch");
  }
  validateGenerationPredecessorV1(
    matrix.releaseMatrixGeneration,
    matrix.predecessorReleaseMatrixContentDigest,
    "matrix_structure",
  );
  if (matrix.targetCount !== matrix.targets.length) {
    return fail("matrix_structure", "count_mismatch");
  }
  validateSortedTargetEntriesV1(
    matrix.targets,
    taxonomy.indexes,
    "matrix_structure",
    "matrix_digest",
    "matrix_taxonomy_pin",
  );
  if (
    matrix.targetSetDigest !==
    deriveProviderReleaseTargetEntrySetDigestV1({ targets: matrix.targets })
  ) {
    return fail("matrix_digest", "digest_mismatch");
  }
  if (
    envelope.releaseMatrixGeneration !== matrix.releaseMatrixGeneration ||
    envelope.contentDigest !== deriveProviderReleaseMatrixContentDigestV1(matrix)
  ) {
    return fail("matrix_envelope", "envelope_mismatch");
  }
  return {
    envelope,
    pin: ProviderReleaseMatrixPinV1Schema.parse({
      locatorProfile: PROVIDER_RELEASE_MATRIX_LOCATOR_PROFILE_V1,
      releaseMatrixGeneration: matrix.releaseMatrixGeneration,
      contentDigest: envelope.contentDigest,
    }),
    taxonomy,
  };
}

function asHistoricalMatrixStateV1(
  value: unknown,
  envelope: ProviderReleaseMatrixEnvelopeV1,
): HistoricalMatrixSemanticStateV1 {
  const state = value as HistoricalMatrixSemanticStateV1;
  if (state?.envelope !== envelope) {
    return fail("bundle_structure", "binding_mismatch");
  }
  return state;
}

function asHistoricalSuiteStateV1(
  value: unknown,
  envelope: ProviderRealFilesystemSuiteManifestEnvelopeV1,
): HistoricalSuiteSemanticStateViewV1 {
  const state = value as HistoricalSuiteSemanticStateViewV1;
  if (state?.envelope !== envelope) {
    return fail("fixture_source_pin", "binding_mismatch");
  }
  return state;
}

function validateHistoricalBundleSemanticCoreV1(
  suppliedBundle: ProviderTargetDiscoveryInputBundleV1,
  suppliedFixtureEnvelope: ProviderTargetDiscoveryFixtureManifestEnvelopeV1,
  suppliedRunnerEnvelope: ProviderTargetDiscoveryRunnerRunEnvelopeV1,
  taxonomyEnvelope: ProviderPublicSupportTaxonomyEnvelopeV1,
  suppliedTaxonomyState: unknown,
  matrixEnvelope: ProviderReleaseMatrixEnvelopeV1,
  suppliedMatrixState: unknown,
  suiteEnvelope: ProviderRealFilesystemSuiteManifestEnvelopeV1,
  suppliedSuiteState: unknown,
): HistoricalBundleSemanticStateV1 {
  ProviderTargetDiscoveryInputBundleV1Schema.parse(suppliedBundle);
  ProviderTargetDiscoveryFixtureManifestEnvelopeV1Schema.parse(
    suppliedFixtureEnvelope,
  );
  ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema.parse(suppliedRunnerEnvelope);
  const taxonomy = asHistoricalTaxonomyStateV1(
    suppliedTaxonomyState,
    taxonomyEnvelope,
  );
  const matrix = asHistoricalMatrixStateV1(
    suppliedMatrixState,
    matrixEnvelope,
  );
  const suite = asHistoricalSuiteStateV1(suppliedSuiteState, suiteEnvelope);
  if (matrix.taxonomy !== taxonomy) {
    return fail("bundle_structure", "binding_mismatch");
  }

  const binding = taxonomy.envelope.payload.distributionRootBinding;
  const activeRootMetadata = taxonomy.envelope.payload.activeRootMetadata;
  const rootKeyId = taxonomy.envelope.payload.registryRootKeyId;
  const fixtureEnvelope = suppliedFixtureEnvelope;
  const fixture = fixtureEnvelope.payload;
  if (
    !canonicalEqualV1(fixture.distributionRootBinding, binding) ||
    fixture.releaseRevisionDigest !== binding.releaseRevisionDigest
  ) {
    return fail("distribution_binding", "binding_mismatch");
  }
  if (
    !canonicalEqualV1(fixture.realFilesystemSuiteManifest, suite.suitePin) ||
    fixture.realFilesystemSuiteDigest !== suite.envelope.payload.suiteDigest ||
    fixture.fixtureManifestDigest !== suite.suitePin.fixtureManifestDigest
  ) {
    return fail("fixture_source_pin", "binding_mismatch");
  }
  if (fixture.targetRecordCount !== fixture.records.length) {
    return fail("fixture_structure", "count_mismatch");
  }
  validateSourceManifestRecordsV1(fixture.records, "fixture_structure");
  if (
    fixture.targetRecordSetDigest !==
    deriveProviderTargetDiscoverySourceManifestRecordSetDigestV1({
      observationSource: "real_filesystem_fixture_manifest",
      entries: fixture.records,
    })
  ) {
    return fail("fixture_digest", "digest_mismatch");
  }
  if (
    fixtureEnvelope.fixtureManifestDigest !== fixture.fixtureManifestDigest ||
    fixtureEnvelope.contentDigest !==
      deriveProviderTargetDiscoveryFixtureManifestContentDigestV1(fixture)
  ) {
    return fail("fixture_envelope", "envelope_mismatch");
  }
  const fixturePin = ProviderTargetDiscoveryFixtureManifestPinV1Schema.parse({
    locatorProfile:
      PROVIDER_TARGET_DISCOVERY_FIXTURE_MANIFEST_LOCATOR_PROFILE_V1,
    realFilesystemSuiteManifest: suite.suitePin,
    realFilesystemSuiteDigest: fixture.realFilesystemSuiteDigest,
    fixtureManifestDigest: fixture.fixtureManifestDigest,
    contentDigest: fixtureEnvelope.contentDigest,
  });

  const runnerEnvelope = suppliedRunnerEnvelope;
  const runner = runnerEnvelope.payload;
  if (
    !canonicalEqualV1(runner.distributionRootBinding, binding) ||
    runner.releaseRevisionDigest !== binding.releaseRevisionDigest
  ) {
    return fail("distribution_binding", "binding_mismatch");
  }
  if (runner.targetRecordCount !== runner.records.length) {
    return fail("runner_structure", "count_mismatch");
  }
  validateSourceManifestRecordsV1(runner.records, "runner_structure");
  if (
    runner.targetRecordSetDigest !==
    deriveProviderTargetDiscoverySourceManifestRecordSetDigestV1({
      observationSource: "target_discovery_runner",
      entries: runner.records,
    })
  ) {
    return fail("runner_digest", "digest_mismatch");
  }
  if (
    runnerEnvelope.contentDigest !==
    deriveProviderTargetDiscoveryRunnerRunManifestContentDigestV1(runner)
  ) {
    return fail("runner_envelope", "envelope_mismatch");
  }
  const runnerPin = ProviderTargetDiscoveryRunnerInstancePinV1Schema.parse({
    locatorProfile: PROVIDER_TARGET_DISCOVERY_RUNNER_RUN_LOCATOR_PROFILE_V1,
    producerName: runner.producerName,
    producerVersion: runner.producerVersion,
    implementationDigest: runner.implementationDigest,
    binaryAttestationDigest: runner.binaryAttestationDigest,
    runnerProfileDigest: runner.runnerProfileDigest,
    runManifestContentDigest: runnerEnvelope.contentDigest,
    releaseRevisionDigest: runner.releaseRevisionDigest,
    executedAt: runner.executedAt,
  });

  const bundle = suppliedBundle;
  if (
    !canonicalEqualV1(bundle.distributionRootBinding, binding) ||
    !canonicalEqualV1(bundle.activeRootMetadata, activeRootMetadata) ||
    bundle.registryRootKeyId !== rootKeyId ||
    !canonicalEqualV1(bundle.publicSupportTaxonomy, taxonomy.pin) ||
    !canonicalEqualV1(bundle.releaseMatrix, matrix.pin) ||
    !canonicalEqualV1(bundle.realFilesystemFixtureManifest, fixturePin) ||
    !canonicalEqualV1(bundle.targetDiscoveryRunner, runnerPin)
  ) {
    return fail("bundle_structure", "binding_mismatch");
  }
  const expectedCut = ProviderTargetDiscoveryObservationCutV1Schema.parse({
    profile: "provider_target_discovery_observation_cut_v1",
    distributionRootBinding: binding,
    activeRootMetadata,
    publicSupportTaxonomy: taxonomy.pin,
    releaseMatrix: matrix.pin,
    realFilesystemFixtureManifest: fixturePin,
    targetDiscoveryRunner: runnerPin,
    discoveryRulesetVersion: bundle.discoveryRulesetVersion,
    requiredDimensions: bundle.requiredDimensions,
    observationSources: bundle.observationSources,
    freshnessRule: "exact_release_revision_and_source_digest_cut_v1",
  });
  if (!canonicalEqualV1(bundle.observationCut, expectedCut)) {
    return fail("bundle_cut", "binding_mismatch");
  }
  const observationCutDigest =
    deriveProviderTargetDiscoveryObservationCutDigestV1(expectedCut);
  if (bundle.observationCutDigest !== observationCutDigest) {
    return fail("bundle_cut", "digest_mismatch");
  }

  const sourceObservations = projectExpectedObservationsV1(
    matrix.envelope,
    fixtureEnvelope,
    runnerEnvelope,
  );
  const expectedObservations = arrayFlatV1(sourceObservations);
  const observationSources = [
    "signed_release_matrix",
    "real_filesystem_fixture_manifest",
    "target_discovery_runner",
  ] as const;
  const sourceContentDigests = [
    matrix.envelope.contentDigest,
    fixtureEnvelope.contentDigest,
    runnerEnvelope.contentDigest,
  ] as const;
  const expectedSummaries = arrayMapV1(
    sourceObservations,
    (entries, index) => ({
      observationSource: observationSources[index]!,
      sourceArtifactContentDigest: sourceContentDigests[index]!,
      observationCount: entries.length,
      observationSetDigest:
        deriveProviderTargetDiscoverySourceObservationSetDigestV1({
          observationSource: observationSources[index]!,
          sourceArtifactContentDigest: sourceContentDigests[index]!,
          entries,
        }),
    }),
  );
  if (
    !canonicalEqualV1(bundle.sourceObservationSets, expectedSummaries) ||
    bundle.observationCount !== expectedObservations.length ||
    !canonicalEqualV1(bundle.observations, expectedObservations)
  ) {
    return fail("bundle_projection", "coverage_mismatch");
  }
  const observationSetDigest =
    deriveProviderTargetDiscoveryInputObservationSetDigestV1({
      entries: expectedObservations,
    });
  if (bundle.observationSetDigest !== observationSetDigest) {
    return fail("bundle_projection", "digest_mismatch");
  }
  const observationKeys = setFromValuesV1(
    arrayMapV1(
      bundle.observations,
      (observation) => observation.observationKeyDigest,
    ),
  );
  if (observationKeys.size !== bundle.observations.length) {
    return fail("bundle_projection", "ordering_invalid");
  }

  const targetById = new CapturedMapV1<
    string,
    ProviderReleaseTargetUniverseTargetEntryV1
  >();
  const unresolved: ProviderTargetDiscoveryUnresolvedObservationV1[] = [];
  for (let index = 0; index < expectedObservations.length; index += 1) {
    const observation = expectedObservations[index]!;
    if (observation.outcome.state === "resolved") {
      const targetId = observation.outcome.target.target.targetProfileId;
      const previous = mapGetV1(targetById, targetId);
      if (
        previous !== undefined &&
        !canonicalEqualV1(previous, observation.outcome.target)
      ) {
        return fail("result_projection", "conflicting_resolved_targets");
      }
      mapSetV1(targetById, targetId, observation.outcome.target);
    } else {
      arrayPushV1(unresolved, {
        observationSource: observation.observationSource,
        sourceArtifactContentDigest: observation.sourceArtifactContentDigest,
        sourceRecordOrdinal: observation.sourceRecordOrdinal,
        privacySafeObservationClaimsDigest:
          observation.privacySafeObservationClaimsDigest,
        observationKeyDigest: observation.observationKeyDigest,
        reason: observation.outcome.reason,
      });
    }
  }
  for (let index = 0; index < expectedObservations.length; index += 1) {
    const observation = expectedObservations[index]!;
    if (observation.outcome.state !== "resolved") continue;
    if (observation.observationSource === "real_filesystem_fixture_manifest") {
      validateTargetEntryV1(
        observation.outcome.target,
        taxonomy.indexes,
        "fixture_digest",
        "fixture_structure",
      );
    } else if (observation.observationSource === "target_discovery_runner") {
      validateTargetEntryV1(
        observation.outcome.target,
        taxonomy.indexes,
        "runner_digest",
        "runner_structure",
      );
    }
  }
  const projectedTargets = arraySortV1(
    mapValuesArrayV1(targetById),
    (left, right) =>
      compareUtf8V1(
        left.target.targetProfileId,
        right.target.targetProfileId,
      ),
  );
  arraySortV1(unresolved, (left, right) => {
    const sourceOrder = compareUtf8V1(
      left.observationSource,
      right.observationSource,
    );
    return sourceOrder !== 0
      ? sourceOrder
      : compareUtf8V1(left.observationKeyDigest, right.observationKeyDigest);
  });
  if (projectedTargets.length > 4096 || unresolved.length > 4096) {
    return fail("result_projection", "count_mismatch");
  }

  return {
    bundle,
    bundleContentDigest:
      deriveProviderTargetDiscoveryInputBundleContentDigestV1(bundle),
    fixtureEnvelope,
    fixturePin,
    matrix,
    observationCutDigest,
    observationSetDigest,
    projectedTargets,
    runnerEnvelope,
    runnerPin,
    suite,
    taxonomy,
    unresolved,
  };
}

function validateHistoricalResultSemanticCoreV1(
  suppliedEnvelope: ProviderTargetDiscoveryResultEnvelopeV1,
  suppliedBundleState: unknown,
): HistoricalResultSemanticStateV1 {
  ProviderTargetDiscoveryResultEnvelopeV1Schema.parse(suppliedEnvelope);
  const bundleState = suppliedBundleState as HistoricalBundleSemanticStateV1;
  const envelope = suppliedEnvelope;
  const result = envelope.payload;
  if (
    bundleState?.bundle === undefined ||
    result.targetDiscoveryInputBundle !== bundleState.bundle
  ) {
    return fail("result_structure", "binding_mismatch");
  }
  validateGenerationPredecessorV1(
    result.discoveryGeneration,
    result.predecessorDiscoveryContentDigest,
    "result_structure",
  );
  if (
    !canonicalEqualV1(
      result.distributionRootBinding,
      bundleState.taxonomy.envelope.payload.distributionRootBinding,
    ) ||
    !canonicalEqualV1(
      result.activeRootMetadata,
      bundleState.taxonomy.envelope.payload.activeRootMetadata,
    ) ||
    result.registryRootKeyId !==
      bundleState.taxonomy.envelope.payload.registryRootKeyId ||
    envelope.discoveryGeneration !== result.discoveryGeneration ||
    !canonicalEqualV1(result.publicSupportTaxonomy, bundleState.taxonomy.pin) ||
    !canonicalEqualV1(result.limits, bundleState.matrix.envelope.payload.limits) ||
    result.targetDiscoveryInputBundleContentDigest !==
      bundleState.bundleContentDigest ||
    result.observationCutDigest !== bundleState.observationCutDigest ||
    result.observationSetDigest !== bundleState.observationSetDigest ||
    result.discoveryRulesetVersion !== bundleState.bundle.discoveryRulesetVersion ||
    !canonicalEqualV1(
      result.requiredDimensions,
      bundleState.bundle.requiredDimensions,
    ) ||
    !canonicalEqualV1(
      result.observationSources,
      bundleState.bundle.observationSources,
    )
  ) {
    return fail("result_structure", "binding_mismatch");
  }
  if (
    result.targetCount !== bundleState.projectedTargets.length ||
    result.unresolvedObservationCount !== bundleState.unresolved.length
  ) {
    return fail("result_projection", "count_mismatch");
  }
  if (
    !canonicalEqualV1(result.targets, bundleState.projectedTargets) ||
    !canonicalEqualV1(
      result.unresolvedObservations,
      bundleState.unresolved,
    )
  ) {
    return fail("result_projection", "coverage_mismatch");
  }
  validateSortedTargetEntriesV1(
    result.targets,
    bundleState.taxonomy.indexes,
    "result_projection",
    "result_digest",
    "result_projection",
  );
  if (
    result.targetSetDigest !==
    deriveProviderReleaseTargetEntrySetDigestV1({
      targets: bundleState.projectedTargets,
    })
  ) {
    return fail("result_digest", "digest_mismatch");
  }
  if (
    envelope.contentDigest !==
    deriveProviderTargetDiscoveryResultContentDigestV1(result)
  ) {
    return fail("result_envelope", "envelope_mismatch");
  }
  return {
    bundle: bundleState,
    envelope,
    pin: ProviderTargetDiscoveryResultPinV1Schema.parse({
      locatorProfile: PROVIDER_TARGET_DISCOVERY_RESULT_LOCATOR_PROFILE_V1,
      discoveryGeneration: result.discoveryGeneration,
      contentDigest: envelope.contentDigest,
    }),
  };
}

function deepFreezeV1<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of CapturedObjectValuesV1(value)) deepFreezeV1(child);
    CapturedObjectFreezeV1(value);
  }
  return value;
}

async function validatePointClosureInternalV1(
  snapshot: ProviderTargetDiscoveryPointSnapshotV1,
  preSnapshotOptIn: boolean,
  preparedContext: PreparedDistributionVerificationContextV1 | undefined,
  diagnoseSource: (
    input: ValidateProviderRealFilesystemSourceClosureV1Input,
  ) => Promise<ProviderRealFilesystemSourceClosureDiagnosticResultV1>,
): Promise<ProviderTargetDiscoveryPointClosureValidationV1> {
  if (preparedContext !== undefined) {
    assertPreparedDistributionInputBindingsInternalV1(
      preparedContext,
      snapshot.activeRoot,
      snapshot.strictCryptoCapability,
    );
  }
  let binding: ProviderSignedDistributionRootBindingV1;
  let activeRootMetadata: ProviderRegistryRootMetadataPinV1;
  let activeRoot: ProviderRegistryRootPublicKeyV1;
  let corpus: ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1;
  let suite: ProviderRealFilesystemSuiteManifestEnvelopeV1;
  let taxonomyEnvelope: ProviderPublicSupportTaxonomyEnvelopeV1;
  let matrixEnvelope: ProviderReleaseMatrixEnvelopeV1;
  let fixtureEnvelope: ProviderTargetDiscoveryFixtureManifestEnvelopeV1;
  let runnerEnvelope: ProviderTargetDiscoveryRunnerRunEnvelopeV1;
  let resultEnvelope: ProviderTargetDiscoveryResultEnvelopeV1;
  try {
    binding = validateProviderSignedDistributionRootBindingStructureV1(snapshot.distributionRootBinding);
  } catch {
    return fail("distribution_binding", "schema_invalid");
  }
  try {
    activeRootMetadata = ProviderRegistryRootMetadataPinV1Schema.parse(snapshot.activeRootMetadata);
    activeRoot = validateProviderRegistryRootPublicKeyV1(snapshot.activeRoot);
    if (activeRootMetadata.rootKeyId !== activeRoot.rootKeyId) return fail("active_root", "root_mismatch");
  } catch (error) {
    if (error instanceof PointDiagnosticSignal) throw error;
    return fail("active_root", "schema_invalid");
  }
  try {
    assertJsonDataTreeBeforeSchemaV1(snapshot.fixtureCorpusManifest);
    assertJsonDataTreeBeforeSchemaV1(snapshot.suiteManifest);
    corpus = ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema.parse(snapshot.fixtureCorpusManifest);
    suite = ProviderRealFilesystemSuiteManifestEnvelopeV1Schema.parse(snapshot.suiteManifest);
  } catch {
    return fail("source_closure", "schema_invalid");
  }
  for (const [value, schema, stage] of [
    [snapshot.publicSupportTaxonomy, ProviderPublicSupportTaxonomyEnvelopeV1Schema, "taxonomy_structure"],
    [snapshot.releaseMatrix, ProviderReleaseMatrixEnvelopeV1Schema, "matrix_structure"],
    [snapshot.targetDiscoveryFixtureManifest, ProviderTargetDiscoveryFixtureManifestEnvelopeV1Schema, "fixture_structure"],
    [snapshot.targetDiscoveryRunnerRun, ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema, "runner_structure"],
    [snapshot.targetDiscoveryResult, ProviderTargetDiscoveryResultEnvelopeV1Schema, "result_structure"],
  ] as const) {
    try {
      assertJsonDataTreeBeforeSchemaV1(value);
      const parsed = schema.parse(value);
      if (stage === "taxonomy_structure") taxonomyEnvelope = parsed as ProviderPublicSupportTaxonomyEnvelopeV1;
      else if (stage === "matrix_structure") matrixEnvelope = parsed as ProviderReleaseMatrixEnvelopeV1;
      else if (stage === "fixture_structure") fixtureEnvelope = parsed as ProviderTargetDiscoveryFixtureManifestEnvelopeV1;
      else if (stage === "runner_structure") runnerEnvelope = parsed as ProviderTargetDiscoveryRunnerRunEnvelopeV1;
      else resultEnvelope = parsed as ProviderTargetDiscoveryResultEnvelopeV1;
    } catch {
      return fail(stage, "schema_invalid");
    }
  }

  if (preparedContext !== undefined) {
    // Zod parse results above are validation temporaries only.  The prepared
    // path continues with the exact detached/frozen identities produced by L.
    binding = snapshot.distributionRootBinding;
    activeRootMetadata = snapshot.activeRootMetadata;
    activeRoot = snapshot.activeRoot;
    corpus = snapshot.fixtureCorpusManifest;
    suite = snapshot.suiteManifest;
    taxonomyEnvelope = snapshot.publicSupportTaxonomy;
    matrixEnvelope = snapshot.releaseMatrix;
    fixtureEnvelope = snapshot.targetDiscoveryFixtureManifest;
    runnerEnvelope = snapshot.targetDiscoveryRunnerRun;
    resultEnvelope = snapshot.targetDiscoveryResult;
  }

  const sourceInput = {
    distributionRootBinding: binding,
    activeRootMetadata,
    activeRoot,
    fixtureCorpusManifest: corpus,
    suiteManifest: suite,
    strictCryptoCapability: snapshot.strictCryptoCapability as ProviderStrictEd25519OpaqueCapabilityV1,
  };
  const sourceDiagnostic = await diagnoseSource(sourceInput);
  if (!sourceDiagnostic.ok) return fail("source_closure", "source_invalid");
  const sourceClosure = sourceDiagnostic.value;

  const maxBytes = binding.historyPolicy.maxSingleDistributionObjectCanonicalBytes;
  if (
    arraySomeV1(
      [taxonomyEnvelope!, matrixEnvelope!, fixtureEnvelope!, runnerEnvelope!, resultEnvelope!],
      (envelope) => canonicalizeJcsSafeIntegerUtf8V1(envelope).byteLength > maxBytes,
    ) ||
    canonicalizeJcsSafeIntegerUtf8V1(resultEnvelope!.payload.targetDiscoveryInputBundle).byteLength > maxBytes
  ) {
    return fail("envelope_limit", "byte_limit_exceeded");
  }

  const taxonomy = taxonomyEnvelope!.payload;
  if (
    !canonicalEqualV1(taxonomy.distributionRootBinding, binding) ||
    taxonomy.distributionRootBinding.releaseRevisionDigest !== binding.releaseRevisionDigest
  ) return fail("distribution_binding", "binding_mismatch");
  if (
    !canonicalEqualV1(taxonomy.activeRootMetadata, activeRootMetadata) ||
    taxonomy.registryRootKeyId !== activeRoot.rootKeyId
  ) return fail("active_root", "root_mismatch");
  if (taxonomyEnvelope!.taxonomyGeneration !== taxonomy.taxonomyGeneration) return fail("taxonomy_envelope", "envelope_mismatch");
  validateTaxonomyRecordsV1(taxonomy);
  await verifyPointRootSignatureV1(
    taxonomy.taxonomySignature,
    TAXONOMY_SIGNATURE_PATTERN,
    activeRoot,
    () => createProviderPublicSupportTaxonomySignatureMessageV1(taxonomy, activeRoot.rootKeyId),
    snapshot.strictCryptoCapability as ProviderStrictEd25519OpaqueCapabilityV1,
    "taxonomy_signature",
    preparedContext,
  );
  if (taxonomyEnvelope!.contentDigest !== deriveProviderPublicSupportTaxonomyContentDigestV1(taxonomy)) {
    return fail("taxonomy_envelope", "envelope_mismatch");
  }
  const taxonomyPin = ProviderPublicSupportTaxonomyPinV1Schema.parse({
    locatorProfile: PROVIDER_PUBLIC_SUPPORT_TAXONOMY_LOCATOR_PROFILE_V1,
    taxonomyGeneration: taxonomy.taxonomyGeneration,
    contentDigest: taxonomyEnvelope!.contentDigest,
  });
  const taxonomyIndexes = taxonomyIndexesV1(taxonomy);

  const matrix = matrixEnvelope!.payload;
  if (
    !canonicalEqualV1(matrix.distributionRootBinding, binding) ||
    matrix.distributionRootBinding.releaseRevisionDigest !== binding.releaseRevisionDigest
  ) return fail("distribution_binding", "binding_mismatch");
  if (!canonicalEqualV1(matrix.activeRootMetadata, activeRootMetadata) || matrix.registryRootKeyId !== activeRoot.rootKeyId) {
    return fail("active_root", "root_mismatch");
  }
  if (!canonicalEqualV1(matrix.publicSupportTaxonomy, taxonomyPin)) return fail("matrix_taxonomy_pin", "binding_mismatch");
  if (matrixEnvelope!.releaseMatrixGeneration !== matrix.releaseMatrixGeneration) return fail("matrix_envelope", "envelope_mismatch");
  validateGenerationPredecessorV1(matrix.releaseMatrixGeneration, matrix.predecessorReleaseMatrixContentDigest, "matrix_structure");
  if (matrix.targetCount !== matrix.targets.length) return fail("matrix_structure", "count_mismatch");
  validateSortedTargetEntriesV1(
    matrix.targets,
    taxonomyIndexes,
    "matrix_structure",
    "matrix_digest",
    "matrix_taxonomy_pin",
  );
  if (matrix.targetSetDigest !== deriveProviderReleaseTargetEntrySetDigestV1({ targets: matrix.targets })) {
    return fail("matrix_digest", "digest_mismatch");
  }
  await verifyPointRootSignatureV1(
    matrix.matrixSignature,
    MATRIX_SIGNATURE_PATTERN,
    activeRoot,
    () => createProviderReleaseMatrixSignatureMessageV1(matrix, activeRoot.rootKeyId),
    snapshot.strictCryptoCapability as ProviderStrictEd25519OpaqueCapabilityV1,
    "matrix_signature",
    preparedContext,
  );
  if (matrixEnvelope!.contentDigest !== deriveProviderReleaseMatrixContentDigestV1(matrix)) return fail("matrix_envelope", "envelope_mismatch");
  const matrixPin = ProviderReleaseMatrixPinV1Schema.parse({
    locatorProfile: PROVIDER_RELEASE_MATRIX_LOCATOR_PROFILE_V1,
    releaseMatrixGeneration: matrix.releaseMatrixGeneration,
    contentDigest: matrixEnvelope!.contentDigest,
  });

  const fixture = fixtureEnvelope!.payload;
  if (!canonicalEqualV1(fixture.distributionRootBinding, binding) || fixture.releaseRevisionDigest !== binding.releaseRevisionDigest) {
    return fail("distribution_binding", "binding_mismatch");
  }
  if (
    !canonicalEqualV1(fixture.realFilesystemSuiteManifest, sourceClosure.suiteManifest) ||
    fixture.realFilesystemSuiteDigest !== sourceClosure.suiteManifest.suiteDigest ||
    fixture.fixtureManifestDigest !== sourceClosure.suiteManifest.fixtureManifestDigest
  ) return fail("fixture_source_pin", "binding_mismatch");
  if (fixture.targetRecordCount !== fixture.records.length) return fail("fixture_structure", "count_mismatch");
  validateSourceManifestRecordsV1(fixture.records, "fixture_structure");
  if (
    fixture.targetRecordSetDigest !== deriveProviderTargetDiscoverySourceManifestRecordSetDigestV1({
      observationSource: "real_filesystem_fixture_manifest",
      entries: fixture.records,
    })
  ) return fail("fixture_digest", "digest_mismatch");
  if (
    fixtureEnvelope!.fixtureManifestDigest !== fixture.fixtureManifestDigest ||
    fixtureEnvelope!.contentDigest !== deriveProviderTargetDiscoveryFixtureManifestContentDigestV1(fixture)
  ) return fail("fixture_envelope", "envelope_mismatch");
  const fixturePin = ProviderTargetDiscoveryFixtureManifestPinV1Schema.parse({
    locatorProfile: PROVIDER_TARGET_DISCOVERY_FIXTURE_MANIFEST_LOCATOR_PROFILE_V1,
    realFilesystemSuiteManifest: sourceClosure.suiteManifest,
    realFilesystemSuiteDigest: fixture.realFilesystemSuiteDigest,
    fixtureManifestDigest: fixture.fixtureManifestDigest,
    contentDigest: fixtureEnvelope!.contentDigest,
  });

  const runner = runnerEnvelope!.payload;
  if (!canonicalEqualV1(runner.distributionRootBinding, binding) || runner.releaseRevisionDigest !== binding.releaseRevisionDigest) {
    return fail("distribution_binding", "binding_mismatch");
  }
  if (runner.targetRecordCount !== runner.records.length) return fail("runner_structure", "count_mismatch");
  validateSourceManifestRecordsV1(runner.records, "runner_structure");
  if (
    runner.targetRecordSetDigest !== deriveProviderTargetDiscoverySourceManifestRecordSetDigestV1({
      observationSource: "target_discovery_runner",
      entries: runner.records,
    })
  ) return fail("runner_digest", "digest_mismatch");
  if (runnerEnvelope!.contentDigest !== deriveProviderTargetDiscoveryRunnerRunManifestContentDigestV1(runner)) {
    return fail("runner_envelope", "envelope_mismatch");
  }
  const runnerPin = ProviderTargetDiscoveryRunnerInstancePinV1Schema.parse({
    locatorProfile: PROVIDER_TARGET_DISCOVERY_RUNNER_RUN_LOCATOR_PROFILE_V1,
    producerName: runner.producerName,
    producerVersion: runner.producerVersion,
    implementationDigest: runner.implementationDigest,
    binaryAttestationDigest: runner.binaryAttestationDigest,
    runnerProfileDigest: runner.runnerProfileDigest,
    runManifestContentDigest: runnerEnvelope!.contentDigest,
    releaseRevisionDigest: runner.releaseRevisionDigest,
    executedAt: runner.executedAt,
  });

  const bundle = resultEnvelope!.payload.targetDiscoveryInputBundle;
  if (
    !canonicalEqualV1(bundle.distributionRootBinding, binding) ||
    !canonicalEqualV1(bundle.activeRootMetadata, activeRootMetadata) ||
    bundle.registryRootKeyId !== activeRoot.rootKeyId
  ) return fail("bundle_structure", "binding_mismatch");
  if (
    !canonicalEqualV1(bundle.publicSupportTaxonomy, taxonomyPin) ||
    !canonicalEqualV1(bundle.releaseMatrix, matrixPin) ||
    !canonicalEqualV1(bundle.realFilesystemFixtureManifest, fixturePin) ||
    !canonicalEqualV1(bundle.targetDiscoveryRunner, runnerPin)
  ) return fail("bundle_structure", "binding_mismatch");
  const expectedCut = ProviderTargetDiscoveryObservationCutV1Schema.parse({
    profile: "provider_target_discovery_observation_cut_v1",
    distributionRootBinding: binding,
    activeRootMetadata,
    publicSupportTaxonomy: taxonomyPin,
    releaseMatrix: matrixPin,
    realFilesystemFixtureManifest: fixturePin,
    targetDiscoveryRunner: runnerPin,
    discoveryRulesetVersion: bundle.discoveryRulesetVersion,
    requiredDimensions: bundle.requiredDimensions,
    observationSources: bundle.observationSources,
    freshnessRule: "exact_release_revision_and_source_digest_cut_v1",
  });
  if (!canonicalEqualV1(bundle.observationCut, expectedCut)) return fail("bundle_cut", "binding_mismatch");
  const expectedCutDigest = deriveProviderTargetDiscoveryObservationCutDigestV1(expectedCut);
  if (bundle.observationCutDigest !== expectedCutDigest) return fail("bundle_cut", "digest_mismatch");

  const sourceObservations = projectExpectedObservationsV1(matrixEnvelope!, fixtureEnvelope!, runnerEnvelope!);
  const expectedObservations = arrayFlatV1(sourceObservations);
  const expectedSummaries = arrayMapV1(sourceObservations, (entries, index) => {
    const observationSource = (["signed_release_matrix", "real_filesystem_fixture_manifest", "target_discovery_runner"] as const)[index]!;
    const sourceArtifactContentDigest = [matrixEnvelope!.contentDigest, fixtureEnvelope!.contentDigest, runnerEnvelope!.contentDigest][index]!;
    return {
      observationSource,
      sourceArtifactContentDigest,
      observationCount: entries.length,
      observationSetDigest: deriveProviderTargetDiscoverySourceObservationSetDigestV1({ observationSource, sourceArtifactContentDigest, entries }),
    };
  });
  if (
    !canonicalEqualV1(bundle.sourceObservationSets, expectedSummaries) ||
    bundle.observationCount !== expectedObservations.length ||
    !canonicalEqualV1(bundle.observations, expectedObservations)
  ) return fail("bundle_projection", "coverage_mismatch");
  const observationSetDigest = deriveProviderTargetDiscoveryInputObservationSetDigestV1({ entries: expectedObservations });
  if (bundle.observationSetDigest !== observationSetDigest) return fail("bundle_projection", "digest_mismatch");
  const observationKeys = setFromValuesV1(
    arrayMapV1(bundle.observations, (observation) => observation.observationKeyDigest),
  );
  if (observationKeys.size !== bundle.observations.length) return fail("bundle_projection", "ordering_invalid");
  await verifyPointRootSignatureV1(
    bundle.bundleSignature,
    BUNDLE_SIGNATURE_PATTERN,
    activeRoot,
    () => createProviderTargetDiscoveryInputBundleSignatureMessageV1(bundle, activeRoot.rootKeyId),
    snapshot.strictCryptoCapability as ProviderStrictEd25519OpaqueCapabilityV1,
    "bundle_signature",
    preparedContext,
  );
  const bundleContentDigest = deriveProviderTargetDiscoveryInputBundleContentDigestV1(bundle);

  const targetById = new CapturedMapV1<string, ProviderReleaseTargetUniverseTargetEntryV1>();
  const unresolved: ProviderTargetDiscoveryUnresolvedObservationV1[] = [];
  for (const observation of expectedObservations) {
    if (observation.outcome.state === "resolved") {
      const targetId = observation.outcome.target.target.targetProfileId;
      const previous = mapGetV1(targetById, targetId);
      if (previous !== undefined && !canonicalEqualV1(previous, observation.outcome.target)) {
        return fail("result_projection", "conflicting_resolved_targets");
      }
      mapSetV1(targetById, targetId, observation.outcome.target);
    } else {
      arrayPushV1(unresolved, {
        observationSource: observation.observationSource,
        sourceArtifactContentDigest: observation.sourceArtifactContentDigest,
        sourceRecordOrdinal: observation.sourceRecordOrdinal,
        privacySafeObservationClaimsDigest: observation.privacySafeObservationClaimsDigest,
        observationKeyDigest: observation.observationKeyDigest,
        reason: observation.outcome.reason,
      });
    }
  }
  for (const observation of expectedObservations) {
    if (observation.outcome.state !== "resolved") continue;
    if (observation.observationSource === "real_filesystem_fixture_manifest") {
      validateTargetEntryV1(
        observation.outcome.target,
        taxonomyIndexes,
        "fixture_digest",
        "fixture_structure",
      );
    } else if (observation.observationSource === "target_discovery_runner") {
      validateTargetEntryV1(
        observation.outcome.target,
        taxonomyIndexes,
        "runner_digest",
        "runner_structure",
      );
    }
  }
  const projectedTargets = arraySortV1(mapValuesArrayV1(targetById), (left, right) => compareUtf8V1(left.target.targetProfileId, right.target.targetProfileId));
  arraySortV1(unresolved, (left, right) => {
    const sourceOrder = compareUtf8V1(left.observationSource, right.observationSource);
    return sourceOrder !== 0 ? sourceOrder : compareUtf8V1(left.observationKeyDigest, right.observationKeyDigest);
  });
  if (projectedTargets.length > 4096 || unresolved.length > 4096) return fail("result_projection", "count_mismatch");

  const result = resultEnvelope!.payload;
  if (
    !canonicalEqualV1(result.distributionRootBinding, binding) ||
    !canonicalEqualV1(result.activeRootMetadata, activeRootMetadata) ||
    result.registryRootKeyId !== activeRoot.rootKeyId
  ) return fail("result_structure", "binding_mismatch");
  validateGenerationPredecessorV1(result.discoveryGeneration, result.predecessorDiscoveryContentDigest, "result_structure");
  if (
    resultEnvelope!.discoveryGeneration !== result.discoveryGeneration ||
    !canonicalEqualV1(result.publicSupportTaxonomy, taxonomyPin) ||
    !canonicalEqualV1(result.limits, matrix.limits) ||
    result.targetDiscoveryInputBundleContentDigest !== bundleContentDigest ||
    result.observationCutDigest !== expectedCutDigest ||
    result.observationSetDigest !== observationSetDigest ||
    result.discoveryRulesetVersion !== bundle.discoveryRulesetVersion ||
    !canonicalEqualV1(result.requiredDimensions, bundle.requiredDimensions) ||
    !canonicalEqualV1(result.observationSources, bundle.observationSources)
  ) return fail("result_structure", "binding_mismatch");
  if (
    result.targetCount !== projectedTargets.length ||
    result.unresolvedObservationCount !== unresolved.length
  ) return fail("result_projection", "count_mismatch");
  if (!canonicalEqualV1(result.targets, projectedTargets) || !canonicalEqualV1(result.unresolvedObservations, unresolved)) {
    return fail("result_projection", "coverage_mismatch");
  }
  validateSortedTargetEntriesV1(
    result.targets,
    taxonomyIndexes,
    "result_projection",
    "result_digest",
    "result_projection",
  );
  if (result.targetSetDigest !== deriveProviderReleaseTargetEntrySetDigestV1({ targets: projectedTargets })) {
    return fail("result_digest", "digest_mismatch");
  }
  await verifyPointRootSignatureV1(
    result.discoverySignature,
    RESULT_SIGNATURE_PATTERN,
    activeRoot,
    () => createProviderTargetDiscoveryResultSignatureMessageV1(result, activeRoot.rootKeyId),
    snapshot.strictCryptoCapability as ProviderStrictEd25519OpaqueCapabilityV1,
    "result_signature",
    preparedContext,
  );
  if (resultEnvelope!.contentDigest !== deriveProviderTargetDiscoveryResultContentDigestV1(result)) {
    return fail("result_envelope", "envelope_mismatch");
  }
  const resultPin = ProviderTargetDiscoveryResultPinV1Schema.parse({
    locatorProfile: PROVIDER_TARGET_DISCOVERY_RESULT_LOCATOR_PROFILE_V1,
    discoveryGeneration: result.discoveryGeneration,
    contentDigest: resultEnvelope!.contentDigest,
  });

  try {
    const closureFields = deepFreezeV1({
      authority: "none_target_discovery_point_structure_only" as const,
      distributionRootBinding: binding,
      activeRootMetadata,
      publicSupportTaxonomy: taxonomyPin,
      releaseMatrix: matrixPin,
      realFilesystemSuiteManifest: sourceClosure.suiteManifest,
      targetDiscoveryFixtureManifest: fixturePin,
      targetDiscoveryRunner: runnerPin,
      targetDiscoveryInputBundleContentDigest: bundleContentDigest,
      targetDiscoveryResult: resultPin,
      locators: {
        publicSupportTaxonomy: buildProviderPublicSupportTaxonomyRelativePathV1(taxonomyEnvelope!),
        releaseMatrix: buildProviderReleaseMatrixRelativePathV1(matrixEnvelope!),
        targetDiscoveryFixtureManifest: buildProviderTargetDiscoveryFixtureManifestRelativePathV1(fixtureEnvelope!),
        targetDiscoveryRunnerRun: buildProviderTargetDiscoveryRunnerRunRelativePathV1(runnerEnvelope!),
        targetDiscoveryResult: buildProviderTargetDiscoveryResultRelativePathV1(resultEnvelope!),
      },
      sourceRecordCount: corpus.payload.recordCount,
      observationCount: bundle.observationCount,
      targetCount: result.targetCount,
      unresolvedObservationCount: result.unresolvedObservationCount,
    });
    const closure = createProviderNonThenableFrozenRecordV1(closureFields);
    if (preSnapshotOptIn) {
      registerProviderTargetDiscoveryPointClosureSnapshotV1(
        closure,
        snapshot,
      );
    }
    return closure;
  } catch {
    return fail("locator", "envelope_mismatch");
  }
}

function createPointDiagnosticFailureV1(
  stage: ProviderTargetDiscoveryPointInvalidStageV1,
  reason: ProviderTargetDiscoveryPointInvalidReasonV1,
): PointDiagnosticFailureV1 {
  return createProviderNonThenableFrozenRecordV1({
    ok: false as const,
    stage,
    reason,
  });
}

function createPointDiagnosticFailureFromErrorV1(
  error: unknown,
): PointDiagnosticFailureV1 {
  if (error instanceof PointDiagnosticSignal) {
    return createPointDiagnosticFailureV1(error.stage, error.reason);
  }
  return createPointDiagnosticFailureV1("input", "schema_invalid");
}

export function diagnoseProviderTargetDiscoveryPointClosureV1(
  input: unknown,
): Promise<ProviderTargetDiscoveryPointClosureDiagnosticResultV1> {
  let prepared: PreparedProviderTargetDiscoveryPointInputV1;
  try {
    prepared = prepareProviderTargetDiscoveryPointFromRawInputV1(input);
  } catch {
    return createProviderPointFulfilledPromiseV1(
      createPointDiagnosticFailureV1("input", "schema_invalid"),
    );
  }
  const corePromise = hardenProviderPointPromiseV1(
    validatePointClosureInternalV1(
      prepared.snapshot,
      prepared.preSnapshotOptIn,
      undefined,
      diagnoseProviderRealFilesystemSourceClosureV1,
    ),
  );
  return corePromise.then(
    (value): PointDiagnosticSuccessV1 =>
      createProviderNonThenableFrozenRecordV1({
        ok: true as const,
        value,
      }),
    createPointDiagnosticFailureFromErrorV1,
  );
}

export function validateProviderTargetDiscoveryPointClosureV1(
  input: ValidateProviderTargetDiscoveryPointClosureV1Input,
): Promise<ProviderTargetDiscoveryPointClosureValidationV1> {
  let prepared: PreparedProviderTargetDiscoveryPointInputV1;
  try {
    prepared = prepareProviderTargetDiscoveryPointFromRawInputV1(input);
  } catch {
    return createProviderPointRejectedPromiseV1(
      new ProviderTargetDiscoveryPointClosureValidationError(),
    );
  }
  const corePromise = hardenProviderPointPromiseV1(
    validatePointClosureInternalV1(
      prepared.snapshot,
      prepared.preSnapshotOptIn,
      undefined,
      diagnoseProviderRealFilesystemSourceClosureV1,
    ),
  );
  return corePromise.then(
    (value) => value,
    () => {
      throw new ProviderTargetDiscoveryPointClosureValidationError();
    },
  );
}

registerProviderTargetDiscoveryPointPreparedCoreInternalV1(
  (
    input: ValidateProviderTargetDiscoveryPointClosureV1Input,
    context: PreparedDistributionVerificationContextV1,
  ): Promise<ProviderTargetDiscoveryPointClosureDiagnosticResultV1> => {
    const corePromise = hardenProviderPointPromiseV1(
      validatePointClosureInternalV1(
        input,
        false,
        context,
        (sourceInput) =>
          diagnoseProviderRealFilesystemSourcePreparedInternalV1(
            sourceInput,
            context,
          ),
      ),
    );
    return corePromise.then(
      (value): PointDiagnosticSuccessV1 =>
        createProviderNonThenableFrozenRecordV1({
          ok: true as const,
          value,
        }),
      createPointDiagnosticFailureFromErrorV1,
    );
  },
);

registerProviderDistributionHistoricalTaxonomySemanticCoreInternalV1(
  validateHistoricalTaxonomySemanticCoreV1,
);
registerProviderDistributionHistoricalMatrixSemanticCoreInternalV1(
  validateHistoricalMatrixSemanticCoreV1,
);
registerProviderDistributionHistoricalBundleSemanticCoreInternalV1(
  validateHistoricalBundleSemanticCoreV1,
);
registerProviderDistributionHistoricalResultSemanticCoreInternalV1(
  validateHistoricalResultSemanticCoreV1,
);
