import { z } from "./zod-runtime.js";

import {
  assertDataObjectDescriptorsBeforeSchemaV1,
  assertJsonDataTreeBeforeSchemaV1,
  createDomainPreimageBytesV1,
} from "./domain-crypto.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  ProviderPublicSupportProfileIdV1Schema,
  ProviderRegistryRootKeyIdV1Schema,
  ProviderReleaseTargetUniverseSignatureV1Schema,
  ProviderTargetProfileIdV1Schema,
  type ContentDigestV1,
} from "./primitives.js";
import {
  encodeStoreFilenameKeyV1,
  type StoreFilenameKeyV1,
} from "./provider-fixed-locator.js";
import {
  captureProviderPointRawExactTopLevelV1,
  captureProviderPointRawObservedDenseArrayV1,
  captureProviderPointRawObservedExactDataObjectUnionV1,
  captureProviderPointRawObservedExactDataObjectV1,
  cloneProviderPointRawAdmissionCapsuleV1,
  countProviderPointRawAdmissionBudgetRootV1,
  createProviderPointRawAdmissionBudgetV1,
  createProviderPointRawAdmissionSessionV1,
  deepFreezeProviderPointDetachedDataTreeV1,
  observeProviderPointRawObjectIdentityV1,
  walkProviderPointRawJsonIdentityTreeV1,
  type ProviderPointRawAdmissionBudgetV1,
  type ProviderPointRawAdmissionSessionV1,
  type ProviderPointRawObservedObjectV1,
} from "./provider-point-raw-admission-internal.js";
import {
  createProviderNonThenableFrozenRecordV1,
  createProviderPointFulfilledPromiseV1,
  createProviderPointRejectedPromiseV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import { ProviderSignedDistributionRootBindingV1Schema } from "./provider-distribution-trust.js";
import { ProviderRegistryRootMetadataPinV1Schema } from "./provider-registry-trust.js";
import {
  diagnoseProviderTargetDiscoveryPointClosureV1,
  deriveProviderPublicSupportProfileIdV1,
  ProviderPublicSupportProfileFieldsV1Schema,
  ProviderPublicSupportTaxonomyPinV1Schema,
  ProviderReleaseMatrixPinV1Schema,
  ProviderReleaseTargetUniverseTargetEntryV1Schema,
  ProviderTargetDiscoveryObservationSourceV1Schema,
  ProviderTargetDiscoveryResultPinV1Schema,
  type ProviderPublicSupportTaxonomyEnvelopeV1,
  type ProviderPublicSupportTaxonomyPinV1,
  type ProviderReleaseMatrixEnvelopeV1,
  type ProviderReleaseMatrixPinV1,
  type ProviderTargetDiscoveryResultEnvelopeV1,
  type ProviderTargetDiscoveryResultPinV1,
  type ProviderTargetDiscoveryPointClosureValidationV1,
  type ProviderReleaseTargetUniverseTargetEntryV1,
  type ValidateProviderTargetDiscoveryPointClosureV1Input,
} from "./provider-target-discovery-point.js";
import {
  createProviderTargetDiscoveryPointSnapshotV1,
  registerProviderTargetDiscoveryPointPreSnapshotV1,
  takeProviderTargetDiscoveryPointClosureSnapshotV1,
  type ProviderTargetDiscoveryPointSnapshotV1,
} from "./provider-target-discovery-point-internal.js";
import {
  registerProviderReleaseTargetUniversePointPreparedCoreInternalV1,
} from "./provider-release-target-universe-point-prepared-internal.js";
import {
  registerProviderDistributionHistoricalUniverseSemanticCoreInternalV1,
} from "./provider-distribution-historical-semantic-internal.js";
import { sha256InternalV1 } from "./sha256.js";
import {
  assertProviderStrictEd25519CryptoCapabilityIdentityV1,
} from "./strict-ed25519-capability-internal.js";
import {
  ProviderStrictEd25519AttestationError,
  verifyRawEd25519WithCapabilityV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "./strict-ed25519-conformance.js";

export const PROVIDER_RELEASE_TARGET_UNIVERSE_DOMAIN_V1 =
  "provider-release-target-universe-v1" as const;
export const PROVIDER_RELEASE_TARGET_UNIVERSE_SIGNATURE_DOMAIN_V1 =
  "provider-release-target-universe-signature-v1" as const;
export const PROVIDER_RELEASE_TARGET_UNIVERSE_LOCATOR_PROFILE_V1 =
  "distribution_provider_release_target_universe_v1" as const;

const PositiveSafeIntegerV1Schema = z
  .number()
  .int()
  .min(1)
  .max(Number.MAX_SAFE_INTEGER);
const NonnegativeSafeIntegerV1Schema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);

export const ProviderReleaseCoverageIncompleteReasonV1Schema = z.enum([
  "release_matrix_incomplete",
  "target_discovery_unresolved",
  "taxonomy_mapping_unresolved",
]);
export type ProviderReleaseCoverageIncompleteReasonV1 = z.infer<
  typeof ProviderReleaseCoverageIncompleteReasonV1Schema
>;

export const ProviderReleaseTargetBucketCoverageV1Schema = z.discriminatedUnion(
  "coverageState",
  [
    z.strictObject({
      coverageState: z.literal("closed_world_complete"),
      targetProfileIds: z
        .array(ProviderTargetProfileIdV1Schema)
        .min(1)
        .max(4096),
    }),
    z.strictObject({
      coverageState: z.literal("incomplete"),
      reason: ProviderReleaseCoverageIncompleteReasonV1Schema,
      targetProfileIds: z
        .array(ProviderTargetProfileIdV1Schema)
        .min(1)
        .max(4096),
    }),
  ],
);
export type ProviderReleaseTargetBucketCoverageV1 = z.infer<
  typeof ProviderReleaseTargetBucketCoverageV1Schema
>;

export const ProviderReleaseTargetUniverseBucketV1Schema = z.strictObject({
  publicProfileId: ProviderPublicSupportProfileIdV1Schema,
  ...ProviderPublicSupportProfileFieldsV1Schema.shape,
  coverage: ProviderReleaseTargetBucketCoverageV1Schema,
});
export type ProviderReleaseTargetUniverseBucketV1 = z.infer<
  typeof ProviderReleaseTargetUniverseBucketV1Schema
>;

export const ProviderReleaseTargetCoverageResolutionV1Schema = z.discriminatedUnion(
  "state",
  [
    z.strictObject({
      state: z.literal("closed_world_complete"),
    }),
    z.strictObject({
      state: z.literal("incomplete"),
      reason: ProviderReleaseCoverageIncompleteReasonV1Schema,
    }),
  ],
);
export type ProviderReleaseTargetCoverageResolutionV1 = z.infer<
  typeof ProviderReleaseTargetCoverageResolutionV1Schema
>;

// These supplied-claim schemas intentionally preserve structural validity for
// a well-shaped but non-current coverage policy.  The point validator must
// compare each claim with the already verified Discovery snapshot in the
// normative limits -> ruleset -> dimensions -> sources order; reusing the
// literal-only Discovery schemas here would make that binding stage
// unreachable and misclassify mismatches as Universe structure failures.
const ProviderReleaseTargetSuppliedCoverageLimitsV1Schema = z.strictObject({
  profile: z
    .string()
    .regex(/^provider_release_coverage_artifact_limits_v[1-9][0-9]*$/u),
  maxTargetEntriesPerArtifact: PositiveSafeIntegerV1Schema,
  maxCanonicalUnionTargetEntries: PositiveSafeIntegerV1Schema,
  maxUnresolvedObservationsPerDiscoveryResult: PositiveSafeIntegerV1Schema,
  maxCanonicalEnvelopeBytes: PositiveSafeIntegerV1Schema,
});
const ProviderReleaseTargetSuppliedRulesetVersionV1Schema = z
  .string()
  .regex(/^provider_release_target_discovery_v[1-9][0-9]*$/u);
const ProviderReleaseTargetSuppliedRequiredDimensionV1Schema = z.enum([
  "osPlatform",
  "osReleaseFamilyCode",
  "osBuildDigest",
  "architecture",
  "filesystemProfileCode",
  "filesystemFeatureProfileDigest",
  "mountOptionProfileDigest",
]);
const ProviderReleaseTargetSuppliedRequiredDimensionsV1Schema = z.tuple([
  ProviderReleaseTargetSuppliedRequiredDimensionV1Schema,
  ProviderReleaseTargetSuppliedRequiredDimensionV1Schema,
  ProviderReleaseTargetSuppliedRequiredDimensionV1Schema,
  ProviderReleaseTargetSuppliedRequiredDimensionV1Schema,
  ProviderReleaseTargetSuppliedRequiredDimensionV1Schema,
  ProviderReleaseTargetSuppliedRequiredDimensionV1Schema,
  ProviderReleaseTargetSuppliedRequiredDimensionV1Schema,
]);
const ProviderReleaseTargetSuppliedObservationSourcesV1Schema = z.tuple([
  ProviderTargetDiscoveryObservationSourceV1Schema,
  ProviderTargetDiscoveryObservationSourceV1Schema,
  ProviderTargetDiscoveryObservationSourceV1Schema,
]);

export const ProviderReleaseTargetCoverageBasisV1Schema = z.strictObject({
  profile: z.literal("provider_release_target_coverage_basis_v1"),
  releaseMatrix: ProviderReleaseMatrixPinV1Schema,
  targetDiscoveryResult: ProviderTargetDiscoveryResultPinV1Schema,
  targetDiscoveryInputBundleContentDigest: ContentDigestV1Schema,
  observationCutDigest: ContentDigestV1Schema,
  observationSetDigest: ContentDigestV1Schema,
  limits: ProviderReleaseTargetSuppliedCoverageLimitsV1Schema,
  discoveryRulesetVersion:
    ProviderReleaseTargetSuppliedRulesetVersionV1Schema,
  requiredDimensions:
    ProviderReleaseTargetSuppliedRequiredDimensionsV1Schema,
  observationSources:
    ProviderReleaseTargetSuppliedObservationSourcesV1Schema,
  releaseMatrixTargetCount: NonnegativeSafeIntegerV1Schema,
  releaseMatrixTargetSetDigest: ContentDigestV1Schema,
  discoveredTargetCount: NonnegativeSafeIntegerV1Schema,
  discoveredTargetSetDigest: ContentDigestV1Schema,
  unresolvedObservationCount: NonnegativeSafeIntegerV1Schema,
  resolution: ProviderReleaseTargetCoverageResolutionV1Schema,
});
export type ProviderReleaseTargetCoverageBasisV1 = z.infer<
  typeof ProviderReleaseTargetCoverageBasisV1Schema
>;

const UniverseUnsignedShapeV1 = {
  profile: z.literal("provider_release_target_universe_v1"),
  distributionRootBinding: ProviderSignedDistributionRootBindingV1Schema,
  activeRootMetadata: ProviderRegistryRootMetadataPinV1Schema,
  registryRootKeyId: ProviderRegistryRootKeyIdV1Schema,
  universeGeneration: PositiveSafeIntegerV1Schema,
  predecessorUniverseContentDigest: ContentDigestV1Schema.optional(),
  publicSupportTaxonomy: ProviderPublicSupportTaxonomyPinV1Schema,
  coverageBasis: ProviderReleaseTargetCoverageBasisV1Schema,
  targets: z
    .array(ProviderReleaseTargetUniverseTargetEntryV1Schema)
    .min(1)
    .max(4096),
  buckets: z.array(ProviderReleaseTargetUniverseBucketV1Schema).min(1).max(4096),
} as const;

export const ProviderReleaseTargetUniverseUnsignedClaimsV1Schema =
  z.strictObject(UniverseUnsignedShapeV1);
export type ProviderReleaseTargetUniverseUnsignedClaimsV1 = z.infer<
  typeof ProviderReleaseTargetUniverseUnsignedClaimsV1Schema
>;

export const ProviderReleaseTargetUniverseV1Schema = z.strictObject({
  ...UniverseUnsignedShapeV1,
  universeSignature: ProviderReleaseTargetUniverseSignatureV1Schema,
});
export type ProviderReleaseTargetUniverseV1 = z.infer<
  typeof ProviderReleaseTargetUniverseV1Schema
>;

export const ProviderReleaseTargetUniverseEnvelopeV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  recordType: z.literal("provider_release_target_universe"),
  universeGeneration: PositiveSafeIntegerV1Schema,
  contentDigest: ContentDigestV1Schema,
  payload: ProviderReleaseTargetUniverseV1Schema,
});
export type ProviderReleaseTargetUniverseEnvelopeV1 = z.infer<
  typeof ProviderReleaseTargetUniverseEnvelopeV1Schema
>;

export const ProviderReleaseTargetUniversePinV1Schema = z.strictObject({
  locatorProfile: z.literal(PROVIDER_RELEASE_TARGET_UNIVERSE_LOCATOR_PROFILE_V1),
  universeGeneration: PositiveSafeIntegerV1Schema,
  contentDigest: ContentDigestV1Schema,
});
export type ProviderReleaseTargetUniversePinV1 = z.infer<
  typeof ProviderReleaseTargetUniversePinV1Schema
>;

export const ProviderReleaseTargetUniverseSignatureWrapperV1Schema = z.strictObject({
  rootKeyId: ProviderRegistryRootKeyIdV1Schema,
  domain: z.literal(PROVIDER_RELEASE_TARGET_UNIVERSE_SIGNATURE_DOMAIN_V1),
  claims: ProviderReleaseTargetUniverseUnsignedClaimsV1Schema,
});
export type ProviderReleaseTargetUniverseSignatureWrapperV1 = z.infer<
  typeof ProviderReleaseTargetUniverseSignatureWrapperV1Schema
>;

export type ProviderReleaseTargetUniverseRelativePathV1 =
  `provider/release-target-universe/${StoreFilenameKeyV1}.json`;

function bytesToLowerHexV1(bytes: Uint8Array): string {
  let output = "";
  for (let index = 0; index < bytes.length; index += 1) {
    output += stringPadStartV1(numberToStringV1(bytes[index]!, 16), 2, "0");
  }
  return output;
}

function digestForDomainV1(
  domain: string,
  fields: object,
): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHexV1(
      sha256InternalV1(createDomainPreimageBytesV1(domain, fields)),
    )}`,
  );
}

export function projectProviderReleaseTargetUniverseUnsignedClaimsV1(
  input: unknown,
): ProviderReleaseTargetUniverseUnsignedClaimsV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const signed = ProviderReleaseTargetUniverseV1Schema.safeParse(input);
  if (!signed.success) {
    return ProviderReleaseTargetUniverseUnsignedClaimsV1Schema.parse(input);
  }
  const { universeSignature: _universeSignature, ...claims } = signed.data;
  return ProviderReleaseTargetUniverseUnsignedClaimsV1Schema.parse(claims);
}

export function deriveProviderReleaseTargetUniverseContentDigestV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_RELEASE_TARGET_UNIVERSE_DOMAIN_V1,
    projectProviderReleaseTargetUniverseUnsignedClaimsV1(input),
  );
}

const UNIVERSE_SIGNATURE_PATTERN_V1 =
  /^provider-release-target-universe-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;

function resolveSignatureRootKeyIdV1(
  input: unknown,
  rootKeyId: unknown,
): string {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  const signatureDescriptor = CapturedObjectGetOwnPropertyDescriptorV1(
    input as object,
    "universeSignature",
  );
  const signature =
    signatureDescriptor !== undefined &&
    hasOwnV1(signatureDescriptor, "value")
      ? signatureDescriptor.value
      : undefined;
  const signedRootKeyId =
    typeof signature === "string"
      ? regExpExecV1(UNIVERSE_SIGNATURE_PATTERN_V1, signature)?.[1]
      : undefined;
  const requestedRootKeyId =
    rootKeyId === undefined
      ? undefined
      : ProviderRegistryRootKeyIdV1Schema.parse(rootKeyId);
  if (
    signedRootKeyId !== undefined &&
    requestedRootKeyId !== undefined &&
    signedRootKeyId !== requestedRootKeyId
  ) {
    throw new CapturedTypeErrorV1("signature root key mismatch");
  }
  if (signedRootKeyId === undefined && requestedRootKeyId === undefined) {
    throw new CapturedTypeErrorV1(
      "rootKeyId is required for unsigned claims",
    );
  }
  return ProviderRegistryRootKeyIdV1Schema.parse(
    signedRootKeyId ?? requestedRootKeyId,
  );
}

export function createProviderReleaseTargetUniverseSignatureMessageV1(
  input: unknown,
  rootKeyId?: unknown,
): Uint8Array {
  const wrapper = ProviderReleaseTargetUniverseSignatureWrapperV1Schema.parse({
    rootKeyId: resolveSignatureRootKeyIdV1(input, rootKeyId),
    domain: PROVIDER_RELEASE_TARGET_UNIVERSE_SIGNATURE_DOMAIN_V1,
    claims: projectProviderReleaseTargetUniverseUnsignedClaimsV1(input),
  });
  return canonicalizeJcsSafeIntegerUtf8V1([
    PROVIDER_RELEASE_TARGET_UNIVERSE_SIGNATURE_DOMAIN_V1,
    wrapper,
  ]);
}

/** @internal Package-only resolver for an already self-bound verified Pin. */
function resolveProviderReleaseTargetUniverseRelativePathFromVerifiedPinV1(
  input: unknown,
): ProviderReleaseTargetUniverseRelativePathV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const pin = ProviderReleaseTargetUniversePinV1Schema.parse(input);
  const semanticKey =
    `universe-generation:${CapturedStringV1(pin.universeGeneration)}`;
  return `provider/release-target-universe/${encodeStoreFilenameKeyV1(
    semanticKey,
  )}.json`;
}

const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectIsFrozenV1 = Object.isFrozen;
const CapturedObjectPrototypeHasOwnPropertyV1 =
  Object.prototype.hasOwnProperty;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedReflectOwnKeysV1 = Reflect.ownKeys;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedMapV1 = Map;
const CapturedMapGetV1 = CapturedMapV1.prototype.get;
const CapturedMapHasV1 = CapturedMapV1.prototype.has;
const CapturedMapSetV1 = CapturedMapV1.prototype.set;
const CapturedSetV1 = Set;
const CapturedSetAddV1 = CapturedSetV1.prototype.add;
const CapturedSetHasV1 = CapturedSetV1.prototype.has;
const CapturedSetSizeGetterV1 = CapturedObjectGetOwnPropertyDescriptorV1(
  CapturedSetV1.prototype,
  "size",
)!.get!;
const CapturedNumberParseIntV1 = Number.parseInt;
const CapturedNumberPrototypeToStringV1 = Number.prototype.toString;
const CapturedStringV1 = String;
const CapturedStringPrototypeIndexOfV1 = String.prototype.indexOf;
const CapturedStringPrototypePadStartV1 = String.prototype.padStart;
const CapturedStringPrototypeSliceV1 = String.prototype.slice;
const CapturedRegExpPrototypeExecV1 = RegExp.prototype.exec;
const CapturedRegExpPrototypeTestV1 = RegExp.prototype.test;
const CapturedMathMinV1 = Math.min;
const CapturedTypeErrorV1 = TypeError;
const CapturedUint8ArrayV1 = Uint8Array;
const CapturedTextEncoderV1 = TextEncoder;
const CapturedTextEncoderPrototypeEncodeV1 =
  CapturedTextEncoderV1.prototype.encode;
const CapturedUtf8EncoderV1 = new CapturedTextEncoderV1();

function bindUncurriedUniverseIntrinsicV1(method: Function): Function {
  const argumentsList = CapturedObjectFreezeV1([method]);
  return CapturedObjectFreezeV1(
    CapturedReflectApplyV1(
      CapturedFunctionPrototypeBindV1,
      CapturedFunctionPrototypeCallV1,
      argumentsList,
    ) as Function,
  );
}

const hasOwnV1 = bindUncurriedUniverseIntrinsicV1(
  CapturedObjectPrototypeHasOwnPropertyV1,
) as (receiver: object, key: PropertyKey) => boolean;
const mapGetV1 = bindUncurriedUniverseIntrinsicV1(
  CapturedMapGetV1,
) as <K, V>(receiver: Map<K, V>, key: K) => V | undefined;
const mapHasV1 = bindUncurriedUniverseIntrinsicV1(
  CapturedMapHasV1,
) as <K, V>(receiver: Map<K, V>, key: K) => boolean;
const mapSetV1 = bindUncurriedUniverseIntrinsicV1(
  CapturedMapSetV1,
) as <K, V>(receiver: Map<K, V>, key: K, value: V) => Map<K, V>;
const setAddV1 = bindUncurriedUniverseIntrinsicV1(
  CapturedSetAddV1,
) as <T>(receiver: Set<T>, value: T) => Set<T>;
const setHasV1 = bindUncurriedUniverseIntrinsicV1(
  CapturedSetHasV1,
) as <T>(receiver: Set<T>, value: T) => boolean;
const setSizeV1 = bindUncurriedUniverseIntrinsicV1(
  CapturedSetSizeGetterV1,
) as <T>(receiver: Set<T>) => number;
const numberToStringV1 = bindUncurriedUniverseIntrinsicV1(
  CapturedNumberPrototypeToStringV1,
) as (receiver: number, radix?: number) => string;
const stringIndexOfV1 = bindUncurriedUniverseIntrinsicV1(
  CapturedStringPrototypeIndexOfV1,
) as (receiver: string, search: string, position?: number) => number;
const stringPadStartV1 = bindUncurriedUniverseIntrinsicV1(
  CapturedStringPrototypePadStartV1,
) as (receiver: string, length: number, fill?: string) => string;
const stringSliceV1 = bindUncurriedUniverseIntrinsicV1(
  CapturedStringPrototypeSliceV1,
) as (receiver: string, start?: number, end?: number) => string;
const regExpExecV1 = bindUncurriedUniverseIntrinsicV1(
  CapturedRegExpPrototypeExecV1,
) as (receiver: RegExp, value: string) => RegExpExecArray | null;
const regExpTestV1 = bindUncurriedUniverseIntrinsicV1(
  CapturedRegExpPrototypeTestV1,
) as (receiver: RegExp, value: string) => boolean;
const invokeTextEncoderEncodeV1 = bindUncurriedUniverseIntrinsicV1(
  CapturedTextEncoderPrototypeEncodeV1,
) as (receiver: TextEncoder, value?: string) => Uint8Array;

function encodeUtf8V1(value: string): Uint8Array {
  return invokeTextEncoderEncodeV1(CapturedUtf8EncoderV1, value);
}

const UNIVERSE_RAW_MAX_DEPTH_V1 = 64;
const UNIVERSE_RAW_MAX_NODES_V1 = 262_144;
const UNIVERSE_RAW_MAX_STRING_CODE_UNITS_V1 = 4_096;
const UNIVERSE_RAW_MAX_TOTAL_STRING_CODE_UNITS_V1 = 16_777_216;
const UNIVERSE_RAW_MAX_TARGETS_V1 = 4_096;
const UNIVERSE_RAW_MAX_BUCKETS_V1 = 4_096;
const UNIVERSE_RAW_MAX_COVERAGE_IDS_V1 = 4_096;

const POINT_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "activeRoot",
  "activeRootMetadata",
  "distributionRootBinding",
  "fixtureCorpusManifest",
  "publicSupportTaxonomy",
  "releaseMatrix",
  "releaseTargetUniverse",
  "strictCryptoCapability",
  "suiteManifest",
  "targetDiscoveryFixtureManifest",
  "targetDiscoveryResult",
  "targetDiscoveryRunnerRun",
] as const);
const POINT_INHERITED_JSON_KEYS_V1 = CapturedObjectFreezeV1([
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
const UNIVERSE_ENVELOPE_KEYS_V1 = CapturedObjectFreezeV1([
  "schemaVersion",
  "recordType",
  "universeGeneration",
  "contentDigest",
  "payload",
] as const);
const UNIVERSE_PAYLOAD_KEYS_WITHOUT_PREDECESSOR_V1 =
  CapturedObjectFreezeV1([
    "profile",
    "distributionRootBinding",
    "activeRootMetadata",
    "registryRootKeyId",
    "universeGeneration",
    "publicSupportTaxonomy",
    "coverageBasis",
    "targets",
    "buckets",
    "universeSignature",
  ] as const);
const UNIVERSE_PAYLOAD_KEYS_WITH_PREDECESSOR_V1 =
  CapturedObjectFreezeV1([
    "profile",
    "distributionRootBinding",
    "activeRootMetadata",
    "registryRootKeyId",
    "universeGeneration",
    "predecessorUniverseContentDigest",
    "publicSupportTaxonomy",
    "coverageBasis",
    "targets",
    "buckets",
    "universeSignature",
  ] as const);
const UNIVERSE_PAYLOAD_KEY_VARIANTS_V1 = CapturedObjectFreezeV1([
  UNIVERSE_PAYLOAD_KEYS_WITHOUT_PREDECESSOR_V1,
  UNIVERSE_PAYLOAD_KEYS_WITH_PREDECESSOR_V1,
] as const);
const COVERAGE_BASIS_KEYS_V1 = CapturedObjectFreezeV1([
  "profile",
  "releaseMatrix",
  "targetDiscoveryResult",
  "targetDiscoveryInputBundleContentDigest",
  "observationCutDigest",
  "observationSetDigest",
  "limits",
  "discoveryRulesetVersion",
  "requiredDimensions",
  "observationSources",
  "releaseMatrixTargetCount",
  "releaseMatrixTargetSetDigest",
  "discoveredTargetCount",
  "discoveredTargetSetDigest",
  "unresolvedObservationCount",
  "resolution",
] as const);
const RELEASE_MATRIX_PIN_KEYS_V1 = CapturedObjectFreezeV1([
  "locatorProfile",
  "releaseMatrixGeneration",
  "contentDigest",
] as const);
const DISCOVERY_RESULT_PIN_KEYS_V1 = CapturedObjectFreezeV1([
  "locatorProfile",
  "discoveryGeneration",
  "contentDigest",
] as const);
const TAXONOMY_PIN_KEYS_V1 = CapturedObjectFreezeV1([
  "locatorProfile",
  "taxonomyGeneration",
  "contentDigest",
] as const);
const COVERAGE_LIMIT_KEYS_V1 = CapturedObjectFreezeV1([
  "profile",
  "maxTargetEntriesPerArtifact",
  "maxCanonicalUnionTargetEntries",
  "maxUnresolvedObservationsPerDiscoveryResult",
  "maxCanonicalEnvelopeBytes",
] as const);
const COVERAGE_RESOLUTION_KEYS_COMPLETE_V1 = CapturedObjectFreezeV1([
  "state",
] as const);
const COVERAGE_RESOLUTION_KEYS_INCOMPLETE_V1 = CapturedObjectFreezeV1([
  "state",
  "reason",
] as const);
const COVERAGE_RESOLUTION_KEY_VARIANTS_V1 = CapturedObjectFreezeV1([
  COVERAGE_RESOLUTION_KEYS_COMPLETE_V1,
  COVERAGE_RESOLUTION_KEYS_INCOMPLETE_V1,
] as const);
const TARGET_ENTRY_KEYS_V1 = CapturedObjectFreezeV1([
  "target",
  "publicProfileId",
] as const);
const TARGET_KEYS_V1 = CapturedObjectFreezeV1([
  "targetProfileId",
  "osPlatform",
  "osReleaseFamilyCode",
  "osBuildDigest",
  "architecture",
  "filesystemProfileCode",
  "filesystemFeatureProfileDigest",
  "mountOptionProfileDigest",
] as const);
const BUCKET_KEYS_V1 = CapturedObjectFreezeV1([
  "publicProfileId",
  "osPlatform",
  "osReleaseFamilyCode",
  "architecture",
  "filesystemProfileCode",
  "coverage",
] as const);
const BUCKET_COVERAGE_KEYS_WITHOUT_REASON_V1 = CapturedObjectFreezeV1([
  "coverageState",
  "targetProfileIds",
] as const);
const BUCKET_COVERAGE_KEYS_WITH_REASON_V1 = CapturedObjectFreezeV1([
  "coverageState",
  "reason",
  "targetProfileIds",
] as const);
const BUCKET_COVERAGE_KEY_VARIANTS_V1 = CapturedObjectFreezeV1([
  BUCKET_COVERAGE_KEYS_WITHOUT_REASON_V1,
  BUCKET_COVERAGE_KEYS_WITH_REASON_V1,
] as const);
const DISTRIBUTION_ROOT_BINDING_KEYS_V1 = CapturedObjectFreezeV1([
  "profile",
  "resolverProfile",
  "signedPackageIdentityDigest",
  "releaseRevisionDigest",
  "bootstrapTrustBundle",
  "historyPolicy",
] as const);
const BOOTSTRAP_TRUST_BUNDLE_PIN_KEYS_V1 = CapturedObjectFreezeV1([
  "locatorProfile",
  "contentDigest",
] as const);
const DISTRIBUTION_HISTORY_POLICY_KEYS_V1 = CapturedObjectFreezeV1([
  "profile",
  "maxSupportCatalogGenerationCount",
  "maxPublicTaxonomyGenerationCount",
  "maxReleaseMatrixGenerationCount",
  "maxTargetDiscoveryResultGenerationCount",
  "maxReleaseTargetUniverseGenerationCount",
  "maxSingleDistributionObjectCanonicalBytes",
  "maxTotalRetainedDistributionObjectCount",
  "maxTotalRetainedDistributionHistoryLogicalBytes",
  "normalUpdateEmergencyGenerationReservePerChain",
  "normalUpdateEmergencyLogicalBytesReserve",
  "admission",
  "exhaustion",
] as const);
const ACTIVE_ROOT_METADATA_PIN_KEYS_V1 = CapturedObjectFreezeV1([
  "locatorProfile",
  "rootGeneration",
  "rootKeyId",
  "contentDigest",
] as const);

function rawInputFailureV1(message: string): never {
  throw new CapturedTypeErrorV1(message);
}

function requireRawPrimitiveKindV1(
  value: unknown,
  expected: "number" | "string",
): void {
  if (typeof value !== expected) {
    return rawInputFailureV1("Universe raw primitive kind mismatch");
  }
}

function requireRawObjectTokenV1(
  session: ProviderPointRawAdmissionSessionV1,
  value: unknown,
): ProviderPointRawObservedObjectV1 {
  return observeProviderPointRawObjectIdentityV1(session, value);
}

function preflightRawDistributionRootBindingV1(
  session: ProviderPointRawAdmissionSessionV1,
  value: unknown,
  budget: ProviderPointRawAdmissionBudgetV1,
  depth: number,
): void {
  const fields = captureProviderPointRawObservedExactDataObjectV1(
    session,
    requireRawObjectTokenV1(session, value),
    DISTRIBUTION_ROOT_BINDING_KEYS_V1,
    budget,
    depth,
  );
  requireRawPrimitiveKindV1(fields.profile, "string");
  requireRawPrimitiveKindV1(fields.resolverProfile, "string");
  requireRawPrimitiveKindV1(fields.signedPackageIdentityDigest, "string");
  requireRawPrimitiveKindV1(fields.releaseRevisionDigest, "string");

  const bootstrapTrustBundle =
    captureProviderPointRawObservedExactDataObjectV1(
      session,
      requireRawObjectTokenV1(session, fields.bootstrapTrustBundle),
      BOOTSTRAP_TRUST_BUNDLE_PIN_KEYS_V1,
      budget,
      depth + 1,
    );
  requireRawPrimitiveKindV1(bootstrapTrustBundle.locatorProfile, "string");
  requireRawPrimitiveKindV1(bootstrapTrustBundle.contentDigest, "string");

  const historyPolicy = captureProviderPointRawObservedExactDataObjectV1(
    session,
    requireRawObjectTokenV1(session, fields.historyPolicy),
    DISTRIBUTION_HISTORY_POLICY_KEYS_V1,
    budget,
    depth + 1,
  );
  requireRawPrimitiveKindV1(historyPolicy.profile, "string");
  requireRawPrimitiveKindV1(
    historyPolicy.maxSupportCatalogGenerationCount,
    "number",
  );
  requireRawPrimitiveKindV1(
    historyPolicy.maxPublicTaxonomyGenerationCount,
    "number",
  );
  requireRawPrimitiveKindV1(
    historyPolicy.maxReleaseMatrixGenerationCount,
    "number",
  );
  requireRawPrimitiveKindV1(
    historyPolicy.maxTargetDiscoveryResultGenerationCount,
    "number",
  );
  requireRawPrimitiveKindV1(
    historyPolicy.maxReleaseTargetUniverseGenerationCount,
    "number",
  );
  requireRawPrimitiveKindV1(
    historyPolicy.maxSingleDistributionObjectCanonicalBytes,
    "number",
  );
  requireRawPrimitiveKindV1(
    historyPolicy.maxTotalRetainedDistributionObjectCount,
    "number",
  );
  requireRawPrimitiveKindV1(
    historyPolicy.maxTotalRetainedDistributionHistoryLogicalBytes,
    "number",
  );
  requireRawPrimitiveKindV1(
    historyPolicy.normalUpdateEmergencyGenerationReservePerChain,
    "number",
  );
  requireRawPrimitiveKindV1(
    historyPolicy.normalUpdateEmergencyLogicalBytesReserve,
    "number",
  );
  requireRawPrimitiveKindV1(historyPolicy.admission, "string");
  requireRawPrimitiveKindV1(historyPolicy.exhaustion, "string");
}

function preflightRawActiveRootMetadataPinV1(
  session: ProviderPointRawAdmissionSessionV1,
  value: unknown,
  budget: ProviderPointRawAdmissionBudgetV1,
  depth: number,
): void {
  const fields = captureProviderPointRawObservedExactDataObjectV1(
    session,
    requireRawObjectTokenV1(session, value),
    ACTIVE_ROOT_METADATA_PIN_KEYS_V1,
    budget,
    depth,
  );
  requireRawPrimitiveKindV1(fields.locatorProfile, "string");
  requireRawPrimitiveKindV1(fields.rootGeneration, "number");
  requireRawPrimitiveKindV1(fields.rootKeyId, "string");
  requireRawPrimitiveKindV1(fields.contentDigest, "string");
}

function requireDenseStringArrayV1(
  session: ProviderPointRawAdmissionSessionV1,
  value: unknown,
  budget: ProviderPointRawAdmissionBudgetV1,
  depth: number,
  expectedLength: number,
): void {
  const capture = captureProviderPointRawObservedDenseArrayV1(
    session,
    requireRawObjectTokenV1(session, value),
    expectedLength,
    budget,
    depth,
  );
  if (capture.length !== expectedLength) {
    return rawInputFailureV1("Universe raw fixed tuple length mismatch");
  }
  for (let index = 0; index < capture.length; index += 1) {
    requireRawPrimitiveKindV1(
      capture.items[CapturedStringV1(index)],
      "string",
    );
  }
}

function preflightRawTaxonomyPinV1(
  session: ProviderPointRawAdmissionSessionV1,
  value: unknown,
  budget: ProviderPointRawAdmissionBudgetV1,
  depth: number,
): void {
  const fields = captureProviderPointRawObservedExactDataObjectV1(
    session,
    requireRawObjectTokenV1(session, value),
    TAXONOMY_PIN_KEYS_V1,
    budget,
    depth,
  );
  requireRawPrimitiveKindV1(fields.locatorProfile, "string");
  requireRawPrimitiveKindV1(fields.taxonomyGeneration, "number");
  requireRawPrimitiveKindV1(fields.contentDigest, "string");
}

function preflightRawReleaseMatrixPinV1(
  session: ProviderPointRawAdmissionSessionV1,
  value: unknown,
  budget: ProviderPointRawAdmissionBudgetV1,
  depth: number,
): void {
  const fields = captureProviderPointRawObservedExactDataObjectV1(
    session,
    requireRawObjectTokenV1(session, value),
    RELEASE_MATRIX_PIN_KEYS_V1,
    budget,
    depth,
  );
  requireRawPrimitiveKindV1(fields.locatorProfile, "string");
  requireRawPrimitiveKindV1(fields.releaseMatrixGeneration, "number");
  requireRawPrimitiveKindV1(fields.contentDigest, "string");
}

function preflightRawDiscoveryResultPinV1(
  session: ProviderPointRawAdmissionSessionV1,
  value: unknown,
  budget: ProviderPointRawAdmissionBudgetV1,
  depth: number,
): void {
  const fields = captureProviderPointRawObservedExactDataObjectV1(
    session,
    requireRawObjectTokenV1(session, value),
    DISCOVERY_RESULT_PIN_KEYS_V1,
    budget,
    depth,
  );
  requireRawPrimitiveKindV1(fields.locatorProfile, "string");
  requireRawPrimitiveKindV1(fields.discoveryGeneration, "number");
  requireRawPrimitiveKindV1(fields.contentDigest, "string");
}

function preflightRawCoverageLimitsV1(
  session: ProviderPointRawAdmissionSessionV1,
  value: unknown,
  budget: ProviderPointRawAdmissionBudgetV1,
  depth: number,
): void {
  const fields = captureProviderPointRawObservedExactDataObjectV1(
    session,
    requireRawObjectTokenV1(session, value),
    COVERAGE_LIMIT_KEYS_V1,
    budget,
    depth,
  );
  requireRawPrimitiveKindV1(fields.profile, "string");
  requireRawPrimitiveKindV1(fields.maxTargetEntriesPerArtifact, "number");
  requireRawPrimitiveKindV1(
    fields.maxCanonicalUnionTargetEntries,
    "number",
  );
  requireRawPrimitiveKindV1(
    fields.maxUnresolvedObservationsPerDiscoveryResult,
    "number",
  );
  requireRawPrimitiveKindV1(fields.maxCanonicalEnvelopeBytes, "number");
}

function preflightRawCoverageResolutionV1(
  session: ProviderPointRawAdmissionSessionV1,
  value: unknown,
  budget: ProviderPointRawAdmissionBudgetV1,
  depth: number,
): void {
  const capture = captureProviderPointRawObservedExactDataObjectUnionV1(
    session,
    requireRawObjectTokenV1(session, value),
    COVERAGE_RESOLUTION_KEY_VARIANTS_V1,
    budget,
    depth,
  );
  requireRawPrimitiveKindV1(capture.fields.state, "string");
  if (capture.variantIndex === 1) {
    requireRawPrimitiveKindV1(capture.fields.reason, "string");
  }
}

function preflightRawCoverageBasisV1(
  session: ProviderPointRawAdmissionSessionV1,
  value: unknown,
  budget: ProviderPointRawAdmissionBudgetV1,
  depth: number,
): void {
  const fields = captureProviderPointRawObservedExactDataObjectV1(
    session,
    requireRawObjectTokenV1(session, value),
    COVERAGE_BASIS_KEYS_V1,
    budget,
    depth,
  );
  requireRawPrimitiveKindV1(fields.profile, "string");
  requireRawPrimitiveKindV1(
    fields.targetDiscoveryInputBundleContentDigest,
    "string",
  );
  requireRawPrimitiveKindV1(fields.observationCutDigest, "string");
  requireRawPrimitiveKindV1(fields.observationSetDigest, "string");
  requireRawPrimitiveKindV1(fields.discoveryRulesetVersion, "string");
  requireRawPrimitiveKindV1(fields.releaseMatrixTargetCount, "number");
  requireRawPrimitiveKindV1(
    fields.releaseMatrixTargetSetDigest,
    "string",
  );
  requireRawPrimitiveKindV1(fields.discoveredTargetCount, "number");
  requireRawPrimitiveKindV1(fields.discoveredTargetSetDigest, "string");
  requireRawPrimitiveKindV1(fields.unresolvedObservationCount, "number");

  preflightRawReleaseMatrixPinV1(
    session,
    fields.releaseMatrix,
    budget,
    depth + 1,
  );
  preflightRawDiscoveryResultPinV1(
    session,
    fields.targetDiscoveryResult,
    budget,
    depth + 1,
  );
  preflightRawCoverageLimitsV1(
    session,
    fields.limits,
    budget,
    depth + 1,
  );
  requireDenseStringArrayV1(
    session,
    fields.requiredDimensions,
    budget,
    depth + 1,
    7,
  );
  requireDenseStringArrayV1(
    session,
    fields.observationSources,
    budget,
    depth + 1,
    3,
  );
  preflightRawCoverageResolutionV1(
    session,
    fields.resolution,
    budget,
    depth + 1,
  );
}

function preflightRawTargetsV1(
  session: ProviderPointRawAdmissionSessionV1,
  value: unknown,
  budget: ProviderPointRawAdmissionBudgetV1,
  depth: number,
): void {
  const targets = captureProviderPointRawObservedDenseArrayV1(
    session,
    requireRawObjectTokenV1(session, value),
    UNIVERSE_RAW_MAX_TARGETS_V1,
    budget,
    depth,
  );
  if (targets.length < 1) {
    return rawInputFailureV1("Universe raw targets must be nonempty");
  }
  for (let index = 0; index < targets.length; index += 1) {
    const key = CapturedStringV1(index);
    const entryToken = targets.itemTokens[key];
    if (entryToken === undefined) {
      return rawInputFailureV1("Universe raw target entry must be an object");
    }
    const entry = captureProviderPointRawObservedExactDataObjectV1(
      session,
      entryToken,
      TARGET_ENTRY_KEYS_V1,
      budget,
      depth + 1,
    );
    requireRawPrimitiveKindV1(entry.publicProfileId, "string");
    const target = captureProviderPointRawObservedExactDataObjectV1(
      session,
      requireRawObjectTokenV1(session, entry.target),
      TARGET_KEYS_V1,
      budget,
      depth + 2,
    );
    requireRawPrimitiveKindV1(target.targetProfileId, "string");
    requireRawPrimitiveKindV1(target.osPlatform, "string");
    requireRawPrimitiveKindV1(target.osReleaseFamilyCode, "string");
    requireRawPrimitiveKindV1(target.osBuildDigest, "string");
    requireRawPrimitiveKindV1(target.architecture, "string");
    requireRawPrimitiveKindV1(target.filesystemProfileCode, "string");
    requireRawPrimitiveKindV1(
      target.filesystemFeatureProfileDigest,
      "string",
    );
    requireRawPrimitiveKindV1(target.mountOptionProfileDigest, "string");
  }
}

function preflightRawBucketsV1(
  session: ProviderPointRawAdmissionSessionV1,
  value: unknown,
  budget: ProviderPointRawAdmissionBudgetV1,
  depth: number,
): void {
  const buckets = captureProviderPointRawObservedDenseArrayV1(
    session,
    requireRawObjectTokenV1(session, value),
    UNIVERSE_RAW_MAX_BUCKETS_V1,
    budget,
    depth,
  );
  if (buckets.length < 1) {
    return rawInputFailureV1("Universe raw buckets must be nonempty");
  }
  let totalCoverageIds = 0;
  for (let index = 0; index < buckets.length; index += 1) {
    const key = CapturedStringV1(index);
    const bucketToken = buckets.itemTokens[key];
    if (bucketToken === undefined) {
      return rawInputFailureV1("Universe raw bucket must be an object");
    }
    const bucket = captureProviderPointRawObservedExactDataObjectV1(
      session,
      bucketToken,
      BUCKET_KEYS_V1,
      budget,
      depth + 1,
    );
    requireRawPrimitiveKindV1(bucket.publicProfileId, "string");
    requireRawPrimitiveKindV1(bucket.osPlatform, "string");
    requireRawPrimitiveKindV1(bucket.osReleaseFamilyCode, "string");
    requireRawPrimitiveKindV1(bucket.architecture, "string");
    requireRawPrimitiveKindV1(bucket.filesystemProfileCode, "string");
    const coverage = captureProviderPointRawObservedExactDataObjectUnionV1(
      session,
      requireRawObjectTokenV1(session, bucket.coverage),
      BUCKET_COVERAGE_KEY_VARIANTS_V1,
      budget,
      depth + 2,
    );
    requireRawPrimitiveKindV1(coverage.fields.coverageState, "string");
    if (coverage.variantIndex === 1) {
      requireRawPrimitiveKindV1(coverage.fields.reason, "string");
    }
    const remainingIds = UNIVERSE_RAW_MAX_COVERAGE_IDS_V1 - totalCoverageIds;
    const ids = captureProviderPointRawObservedDenseArrayV1(
      session,
      requireRawObjectTokenV1(session, coverage.fields.targetProfileIds),
      remainingIds,
      budget,
      depth + 3,
    );
    if (ids.length < 1) {
      return rawInputFailureV1(
        "Universe raw bucket coverage IDs must be nonempty",
      );
    }
    totalCoverageIds += ids.length;
    for (let idIndex = 0; idIndex < ids.length; idIndex += 1) {
      requireRawPrimitiveKindV1(
        ids.items[CapturedStringV1(idIndex)],
        "string",
      );
    }
  }
}

function preflightCapturedRawUniverseEnvelopeV1(
  session: ProviderPointRawAdmissionSessionV1,
  envelope: Readonly<Record<string, unknown>>,
  budget: ProviderPointRawAdmissionBudgetV1,
): void {
  requireRawPrimitiveKindV1(envelope.schemaVersion, "number");
  requireRawPrimitiveKindV1(envelope.recordType, "string");
  requireRawPrimitiveKindV1(envelope.universeGeneration, "number");
  requireRawPrimitiveKindV1(envelope.contentDigest, "string");

  const payloadCapture =
    captureProviderPointRawObservedExactDataObjectUnionV1(
      session,
      requireRawObjectTokenV1(session, envelope.payload),
      UNIVERSE_PAYLOAD_KEY_VARIANTS_V1,
      budget,
      2,
    );
  const payload = payloadCapture.fields;
  requireRawPrimitiveKindV1(payload.profile, "string");
  requireRawPrimitiveKindV1(payload.registryRootKeyId, "string");
  requireRawPrimitiveKindV1(payload.universeGeneration, "number");
  if (payloadCapture.variantIndex === 1) {
    requireRawPrimitiveKindV1(
      payload.predecessorUniverseContentDigest,
      "string",
    );
  }
  requireRawPrimitiveKindV1(payload.universeSignature, "string");

  preflightRawDistributionRootBindingV1(
    session,
    payload.distributionRootBinding,
    budget,
    3,
  );
  preflightRawActiveRootMetadataPinV1(
    session,
    payload.activeRootMetadata,
    budget,
    3,
  );
  preflightRawTaxonomyPinV1(
    session,
    payload.publicSupportTaxonomy,
    budget,
    3,
  );
  preflightRawCoverageBasisV1(
    session,
    payload.coverageBasis,
    budget,
    3,
  );
  preflightRawTargetsV1(session, payload.targets, budget, 3);
  preflightRawBucketsV1(session, payload.buckets, budget, 3);
}

function createUniverseRawBudgetV1(): ProviderPointRawAdmissionBudgetV1 {
  return createProviderPointRawAdmissionBudgetV1(
    UNIVERSE_RAW_MAX_DEPTH_V1,
    UNIVERSE_RAW_MAX_NODES_V1,
    UNIVERSE_RAW_MAX_STRING_CODE_UNITS_V1,
    UNIVERSE_RAW_MAX_TOTAL_STRING_CODE_UNITS_V1,
  );
}

function preflightRawUniverseFromPointFieldV1(
  session: ProviderPointRawAdmissionSessionV1,
  value: unknown,
): void {
  const budget = createUniverseRawBudgetV1();
  countProviderPointRawAdmissionBudgetRootV1(budget, value);
  const envelope = captureProviderPointRawObservedExactDataObjectV1(
    session,
    requireRawObjectTokenV1(session, value),
    UNIVERSE_ENVELOPE_KEYS_V1,
    budget,
    1,
  );
  preflightCapturedRawUniverseEnvelopeV1(session, envelope, budget);
}

function preflightRawUniverseAsTopLevelV1(
  session: ProviderPointRawAdmissionSessionV1,
  value: unknown,
): void {
  const budget = createUniverseRawBudgetV1();
  countProviderPointRawAdmissionBudgetRootV1(budget, value);
  const envelope = captureProviderPointRawExactTopLevelV1(
    session,
    UNIVERSE_ENVELOPE_KEYS_V1,
    budget,
    1,
  );
  preflightCapturedRawUniverseEnvelopeV1(session, envelope, budget);
}

export const ProviderReleaseTargetUniversePointInvalidStageV1Schema = z.enum([
  "input",
  "target_discovery_closure",
  "universe_structure",
  "universe_distribution_binding",
  "universe_active_root",
  "universe_taxonomy_pin",
  "universe_coverage_pins",
  "universe_coverage_binding",
  "universe_coverage_counts",
  "universe_target_union",
  "universe_resolution",
  "universe_buckets",
  "universe_signature_binding",
  "universe_signature",
  "universe_digest",
  "universe_envelope",
]);
export type ProviderReleaseTargetUniversePointInvalidStageV1 = z.infer<
  typeof ProviderReleaseTargetUniversePointInvalidStageV1Schema
>;

export const ProviderReleaseTargetUniversePointInvalidReasonV1Schema = z.enum([
  "schema_invalid",
  "source_invalid",
  "binding_mismatch",
  "pin_mismatch",
  "root_mismatch",
  "count_mismatch",
  "digest_mismatch",
  "ordering_invalid",
  "coverage_mismatch",
  "signature_invalid",
  "envelope_mismatch",
]);
export type ProviderReleaseTargetUniversePointInvalidReasonV1 = z.infer<
  typeof ProviderReleaseTargetUniversePointInvalidReasonV1Schema
>;

interface ProviderReleaseTargetUniversePointDiagnosticFailureV1 {
  readonly ok: false;
  readonly stage: ProviderReleaseTargetUniversePointInvalidStageV1;
  readonly reason: ProviderReleaseTargetUniversePointInvalidReasonV1;
}

interface ProviderReleaseTargetUniversePointDiagnosticSuccessV1 {
  readonly ok: true;
  readonly value: ProviderReleaseTargetUniversePointClosureValidationV1;
}

export type ProviderReleaseTargetUniversePointClosureDiagnosticResultV1 =
  | ProviderReleaseTargetUniversePointDiagnosticFailureV1
  | ProviderReleaseTargetUniversePointDiagnosticSuccessV1;

export interface ValidateProviderReleaseTargetUniversePointClosureV1Input
  extends ValidateProviderTargetDiscoveryPointClosureV1Input {
  readonly releaseTargetUniverse: ProviderReleaseTargetUniverseEnvelopeV1;
}

export interface ProviderReleaseTargetUniversePointClosureValidationV1 {
  readonly authority: "none_release_target_universe_structure_only";
  readonly targetDiscoveryPointClosure: ProviderTargetDiscoveryPointClosureValidationV1;
  readonly releaseTargetUniverse: ProviderReleaseTargetUniverseEnvelopeV1;
  readonly releaseTargetUniversePin: ProviderReleaseTargetUniversePinV1;
  readonly relativePath: ProviderReleaseTargetUniverseRelativePathV1;
  readonly targetCount: number;
  readonly bucketCount: number;
  readonly coverageResolution: ProviderReleaseTargetCoverageResolutionV1;
}

export class ProviderReleaseTargetUniversePointClosureValidationError extends Error {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super("Provider release target Universe point closure validation failed");
    this.name =
      "ProviderReleaseTargetUniversePointClosureValidationError";
    CapturedObjectFreezeV1(this);
  }
}

class UniversePointDiagnosticSignalV1 extends Error {
  constructor(
    readonly stage: ProviderReleaseTargetUniversePointInvalidStageV1,
    readonly reason: ProviderReleaseTargetUniversePointInvalidReasonV1,
  ) {
    super("release target Universe point diagnostic");
  }
}

function failUniversePointV1(
  stage: ProviderReleaseTargetUniversePointInvalidStageV1,
  reason: ProviderReleaseTargetUniversePointInvalidReasonV1,
): never {
  throw new UniversePointDiagnosticSignalV1(stage, reason);
}

interface PreparedProviderReleaseTargetUniversePointInputV1 {
  readonly inheritedRequest: ValidateProviderTargetDiscoveryPointClosureV1Input;
  readonly inheritedSnapshot: ProviderTargetDiscoveryPointSnapshotV1;
  readonly releaseTargetUniverse: ProviderReleaseTargetUniverseEnvelopeV1;
}

function walkInheritedRawPointFieldsV1(
  admission: ProviderPointRawAdmissionSessionV1,
  fields: Readonly<Record<string, unknown>>,
): void {
  for (
    let index = 0;
    index < POINT_INHERITED_JSON_KEYS_V1.length;
    index += 1
  ) {
    const key = POINT_INHERITED_JSON_KEYS_V1[index]!;
    walkProviderPointRawJsonIdentityTreeV1(admission, fields[key]);
  }
}

function freezeDetachedPointInputV1(
  detachedInput: unknown,
  originalCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): PreparedProviderReleaseTargetUniversePointInputV1 {
  const admission = createProviderPointRawAdmissionSessionV1(detachedInput);
  const detached = captureProviderPointRawExactTopLevelV1(
    admission,
    POINT_INPUT_KEYS_V1,
  );
  preflightRawUniverseFromPointFieldV1(
    admission,
    detached.releaseTargetUniverse,
  );
  walkInheritedRawPointFieldsV1(admission, detached);

  const inheritedRequest = CapturedObjectFreezeV1({
    activeRoot: deepFreezeProviderPointDetachedDataTreeV1(
      detached.activeRoot,
    ),
    activeRootMetadata: deepFreezeProviderPointDetachedDataTreeV1(
      detached.activeRootMetadata,
    ),
    distributionRootBinding: deepFreezeProviderPointDetachedDataTreeV1(
      detached.distributionRootBinding,
    ),
    fixtureCorpusManifest: deepFreezeProviderPointDetachedDataTreeV1(
      detached.fixtureCorpusManifest,
    ),
    publicSupportTaxonomy: deepFreezeProviderPointDetachedDataTreeV1(
      detached.publicSupportTaxonomy,
    ),
    releaseMatrix: deepFreezeProviderPointDetachedDataTreeV1(
      detached.releaseMatrix,
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
  }) as unknown as ValidateProviderTargetDiscoveryPointClosureV1Input;
  const releaseTargetUniverse =
    deepFreezeProviderPointDetachedDataTreeV1(
      detached.releaseTargetUniverse,
    ) as ProviderReleaseTargetUniverseEnvelopeV1;
  const inheritedSnapshot =
    createProviderTargetDiscoveryPointSnapshotV1(inheritedRequest);

  return CapturedObjectFreezeV1({
    inheritedRequest,
    inheritedSnapshot,
    releaseTargetUniverse,
  });
}

function assertRecursivelyFrozenDetachedUniverseJsonV1(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (!CapturedObjectIsFrozenV1(value)) {
    throw new CapturedTypeErrorV1(
      "prepared release target Universe JSON must already be frozen",
    );
  }
  const keys = CapturedReflectOwnKeysV1(value);
  for (let index = 0; index < keys.length; index += 1) {
    const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(
      value,
      keys[index]!,
    );
    if (descriptor === undefined || !hasOwnV1(descriptor, "value")) {
      throw new CapturedTypeErrorV1(
        "prepared release target Universe JSON must use data properties",
      );
    }
    assertRecursivelyFrozenDetachedUniverseJsonV1(descriptor.value);
  }
}

function prepareProviderReleaseTargetUniversePointFromDetachedInputV1(
  input: ValidateProviderReleaseTargetUniversePointClosureV1Input,
): PreparedProviderReleaseTargetUniversePointInputV1 {
  if (!CapturedObjectIsFrozenV1(input)) {
    throw new CapturedTypeErrorV1(
      "prepared release target Universe input must already be frozen",
    );
  }
  const admission = createProviderPointRawAdmissionSessionV1(input);
  const captured = captureProviderPointRawExactTopLevelV1(
    admission,
    POINT_INPUT_KEYS_V1,
  );
  preflightRawUniverseFromPointFieldV1(
    admission,
    captured.releaseTargetUniverse,
  );
  const strictCryptoCapability = captured.strictCryptoCapability;
  assertProviderStrictEd25519CryptoCapabilityIdentityV1(
    ProviderStrictEd25519AttestationError,
    strictCryptoCapability,
  );
  walkInheritedRawPointFieldsV1(admission, captured);
  for (
    let index = 0;
    index < POINT_INHERITED_JSON_KEYS_V1.length;
    index += 1
  ) {
    assertRecursivelyFrozenDetachedUniverseJsonV1(
      captured[POINT_INHERITED_JSON_KEYS_V1[index]!],
    );
  }
  assertRecursivelyFrozenDetachedUniverseJsonV1(
    captured.releaseTargetUniverse,
  );
  return freezeDetachedPointInputV1(
    input,
    strictCryptoCapability as ProviderStrictEd25519OpaqueCapabilityV1,
  );
}

function prepareProviderReleaseTargetUniversePointFromRawInputV1(
  input: unknown,
): PreparedProviderReleaseTargetUniversePointInputV1 {
  const admission = createProviderPointRawAdmissionSessionV1(input);
  const captured = captureProviderPointRawExactTopLevelV1(
    admission,
    POINT_INPUT_KEYS_V1,
  );

  // D-36 fixes this order: bounded Universe first, opaque identity second,
  // inherited JSON third, and exactly one full-input capsule clone last.
  preflightRawUniverseFromPointFieldV1(
    admission,
    captured.releaseTargetUniverse,
  );
  const strictCryptoCapability = captured.strictCryptoCapability;
  assertProviderStrictEd25519CryptoCapabilityIdentityV1(
    ProviderStrictEd25519AttestationError,
    strictCryptoCapability,
  );
  walkInheritedRawPointFieldsV1(admission, captured);

  return freezeDetachedPointInputV1(
    cloneProviderPointRawAdmissionCapsuleV1(admission),
    strictCryptoCapability as ProviderStrictEd25519OpaqueCapabilityV1,
  );
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

function compareUtf8V1(left: string, right: string): number {
  const leftBytes = encodeUtf8V1(left);
  const rightBytes = encodeUtf8V1(right);
  const length = CapturedMathMinV1(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!;
    if (difference !== 0) return difference;
  }
  return leftBytes.length - rightBytes.length;
}

function deepFreezeSemanticV1<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    const record = value as Record<PropertyKey, unknown>;
    const keys = CapturedReflectOwnKeysV1(record);
    for (let index = 0; index < keys.length; index += 1) {
      const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(
        record,
        keys[index]!,
      );
      if (descriptor !== undefined && hasOwnV1(descriptor, "value")) {
        deepFreezeSemanticV1(descriptor.value);
      }
    }
    CapturedObjectFreezeV1(record);
  }
  return value;
}

function validateUniverseGenerationPredecessorV1(
  universe: ProviderReleaseTargetUniverseV1,
): void {
  if (
    (universe.universeGeneration === 1) !==
    (universe.predecessorUniverseContentDigest === undefined)
  ) {
    return failUniversePointV1(
      "universe_structure",
      "coverage_mismatch",
    );
  }
}

function deriveExpectedCoverageResolutionV1(
  snapshot: ProviderTargetDiscoveryPointSnapshotV1,
): ProviderReleaseTargetCoverageResolutionV1 {
  const result = snapshot.targetDiscoveryResult.payload;
  for (
    let index = 0;
    index < result.unresolvedObservations.length;
    index += 1
  ) {
    if (
      result.unresolvedObservations[index]!.reason ===
      "taxonomy_mapping_unresolved"
    ) {
      return {
        state: "incomplete",
        reason: "taxonomy_mapping_unresolved",
      };
    }
  }
  if (result.unresolvedObservations.length > 0) {
    return {
      state: "incomplete",
      reason: "target_discovery_unresolved",
    };
  }
  if (!canonicalEqualV1(snapshot.releaseMatrix.payload.targets, result.targets)) {
    return {
      state: "incomplete",
      reason: "release_matrix_incomplete",
    };
  }
  return { state: "closed_world_complete" };
}

function validateUniverseCoverageBindingV1(
  universe: ProviderReleaseTargetUniverseV1,
  snapshot: ProviderTargetDiscoveryPointSnapshotV1,
): void {
  const coverage = universe.coverageBasis;
  const matrix = snapshot.releaseMatrix.payload;
  const result = snapshot.targetDiscoveryResult.payload;
  const bundle = result.targetDiscoveryInputBundle;

  if (!canonicalEqualV1(coverage.limits, matrix.limits)) {
    return failUniversePointV1(
      "universe_coverage_binding",
      "binding_mismatch",
    );
  }
  if (coverage.discoveryRulesetVersion !== bundle.discoveryRulesetVersion) {
    return failUniversePointV1(
      "universe_coverage_binding",
      "binding_mismatch",
    );
  }
  if (!canonicalEqualV1(coverage.requiredDimensions, bundle.requiredDimensions)) {
    return failUniversePointV1(
      "universe_coverage_binding",
      "binding_mismatch",
    );
  }
  if (!canonicalEqualV1(coverage.observationSources, bundle.observationSources)) {
    return failUniversePointV1(
      "universe_coverage_binding",
      "binding_mismatch",
    );
  }
  if (
    coverage.targetDiscoveryInputBundleContentDigest !==
    result.targetDiscoveryInputBundleContentDigest
  ) {
    return failUniversePointV1(
      "universe_coverage_binding",
      "digest_mismatch",
    );
  }
  if (coverage.observationCutDigest !== result.observationCutDigest) {
    return failUniversePointV1(
      "universe_coverage_binding",
      "digest_mismatch",
    );
  }
  if (coverage.observationSetDigest !== result.observationSetDigest) {
    return failUniversePointV1(
      "universe_coverage_binding",
      "digest_mismatch",
    );
  }
}

function validateUniverseCoverageCountsV1(
  universe: ProviderReleaseTargetUniverseV1,
  snapshot: ProviderTargetDiscoveryPointSnapshotV1,
): void {
  const coverage = universe.coverageBasis;
  const matrix = snapshot.releaseMatrix.payload;
  const result = snapshot.targetDiscoveryResult.payload;
  if (coverage.releaseMatrixTargetCount !== matrix.targetCount) {
    return failUniversePointV1(
      "universe_coverage_counts",
      "count_mismatch",
    );
  }
  if (coverage.releaseMatrixTargetSetDigest !== matrix.targetSetDigest) {
    return failUniversePointV1(
      "universe_coverage_counts",
      "digest_mismatch",
    );
  }
  if (coverage.discoveredTargetCount !== result.targetCount) {
    return failUniversePointV1(
      "universe_coverage_counts",
      "count_mismatch",
    );
  }
  if (coverage.discoveredTargetSetDigest !== result.targetSetDigest) {
    return failUniversePointV1(
      "universe_coverage_counts",
      "digest_mismatch",
    );
  }
  if (
    coverage.unresolvedObservationCount !==
    result.unresolvedObservationCount
  ) {
    return failUniversePointV1(
      "universe_coverage_counts",
      "count_mismatch",
    );
  }
}

function validateUniverseTargetUnionV1(
  universe: ProviderReleaseTargetUniverseV1,
  snapshot: ProviderTargetDiscoveryPointSnapshotV1,
): void {
  const targets = universe.targets;
  for (let index = 1; index < targets.length; index += 1) {
    if (
      compareUtf8V1(
        targets[index - 1]!.target.targetProfileId,
        targets[index]!.target.targetProfileId,
      ) >= 0
    ) {
      return failUniversePointV1(
        "universe_target_union",
        "ordering_invalid",
      );
    }
  }
  const expectedTargets = snapshot.targetDiscoveryResult.payload.targets;
  if (targets.length !== expectedTargets.length) {
    return failUniversePointV1(
      "universe_target_union",
      "count_mismatch",
    );
  }
  if (!canonicalEqualV1(targets, expectedTargets)) {
    return failUniversePointV1(
      "universe_target_union",
      "coverage_mismatch",
    );
  }
}

interface TargetPublicFieldsV1 {
  readonly publicProfileId: string;
  readonly osPlatform: string;
  readonly osReleaseFamilyCode: string;
  readonly architecture: string;
  readonly filesystemProfileCode: string;
}

function publicFieldsFromTargetV1(
  entry: ProviderReleaseTargetUniverseTargetEntryV1,
): TargetPublicFieldsV1 {
  return {
    publicProfileId: entry.publicProfileId,
    osPlatform: entry.target.osPlatform,
    osReleaseFamilyCode: entry.target.osReleaseFamilyCode,
    architecture: entry.target.architecture,
    filesystemProfileCode: entry.target.filesystemProfileCode,
  };
}

function validateUniverseBucketsV1(
  universe: ProviderReleaseTargetUniverseV1,
  expectedResolution: ProviderReleaseTargetCoverageResolutionV1,
): void {
  const buckets = universe.buckets;
  for (let index = 0; index < buckets.length; index += 1) {
    const bucket = buckets[index]!;
    const previous = buckets[index - 1];
    if (
      previous !== undefined &&
      compareUtf8V1(previous.publicProfileId, bucket.publicProfileId) >= 0
    ) {
      return failUniversePointV1(
        "universe_buckets",
        "ordering_invalid",
      );
    }
    const ids = bucket.coverage.targetProfileIds;
    for (let idIndex = 1; idIndex < ids.length; idIndex += 1) {
      if (compareUtf8V1(ids[idIndex - 1]!, ids[idIndex]!) >= 0) {
        return failUniversePointV1(
          "universe_buckets",
          "ordering_invalid",
        );
      }
    }
  }

  const targetById = new CapturedMapV1<
    string,
    ProviderReleaseTargetUniverseTargetEntryV1
  >();
  const publicFieldsById = new CapturedMapV1<
    string,
    TargetPublicFieldsV1
  >();
  for (let index = 0; index < universe.targets.length; index += 1) {
    const entry = universe.targets[index]!;
    mapSetV1(targetById, entry.target.targetProfileId, entry);
    if (!mapHasV1(publicFieldsById, entry.publicProfileId)) {
      mapSetV1(
        publicFieldsById,
        entry.publicProfileId,
        publicFieldsFromTargetV1(entry),
      );
    }
  }

  for (let index = 0; index < buckets.length; index += 1) {
    const bucket = buckets[index]!;
    const expectedPublicFields = mapGetV1(
      publicFieldsById,
      bucket.publicProfileId,
    );
    let derivedPublicProfileId: string;
    try {
      derivedPublicProfileId = deriveProviderPublicSupportProfileIdV1({
        osPlatform: bucket.osPlatform,
        osReleaseFamilyCode: bucket.osReleaseFamilyCode,
        architecture: bucket.architecture,
        filesystemProfileCode: bucket.filesystemProfileCode,
      });
    } catch {
      return failUniversePointV1(
        "universe_buckets",
        "coverage_mismatch",
      );
    }
    if (
      expectedPublicFields === undefined ||
      derivedPublicProfileId !== bucket.publicProfileId ||
      bucket.osPlatform !== expectedPublicFields.osPlatform ||
      bucket.osReleaseFamilyCode !== expectedPublicFields.osReleaseFamilyCode ||
      bucket.architecture !== expectedPublicFields.architecture ||
      bucket.filesystemProfileCode !==
        expectedPublicFields.filesystemProfileCode
    ) {
      return failUniversePointV1(
        "universe_buckets",
        "coverage_mismatch",
      );
    }
    for (
      let idIndex = 0;
      idIndex < bucket.coverage.targetProfileIds.length;
      idIndex += 1
    ) {
      const entry = mapGetV1(
        targetById,
        bucket.coverage.targetProfileIds[idIndex]!,
      );
      if (entry === undefined || entry.publicProfileId !== bucket.publicProfileId) {
        return failUniversePointV1(
          "universe_buckets",
          "coverage_mismatch",
        );
      }
    }
  }

  const partition = new CapturedSetV1<string>();
  for (let index = 0; index < buckets.length; index += 1) {
    const ids = buckets[index]!.coverage.targetProfileIds;
    for (let idIndex = 0; idIndex < ids.length; idIndex += 1) {
      const id = ids[idIndex]!;
      if (setHasV1(partition, id)) {
        return failUniversePointV1(
          "universe_buckets",
          "coverage_mismatch",
        );
      }
      setAddV1(partition, id);
    }
  }
  if (setSizeV1(partition) !== universe.targets.length) {
    return failUniversePointV1(
      "universe_buckets",
      "coverage_mismatch",
    );
  }
  for (let index = 0; index < universe.targets.length; index += 1) {
    if (
      !setHasV1(
        partition,
        universe.targets[index]!.target.targetProfileId,
      )
    ) {
      return failUniversePointV1(
        "universe_buckets",
        "coverage_mismatch",
      );
    }
  }

  for (let index = 0; index < buckets.length; index += 1) {
    const coverage = buckets[index]!.coverage;
    if (expectedResolution.state === "closed_world_complete") {
      if (coverage.coverageState !== "closed_world_complete") {
        return failUniversePointV1(
          "universe_buckets",
          "coverage_mismatch",
        );
      }
    } else if (
      coverage.coverageState !== "incomplete" ||
      coverage.reason !== expectedResolution.reason
    ) {
      return failUniversePointV1(
        "universe_buckets",
        "coverage_mismatch",
      );
    }
  }
}

interface HistoricalTargetDiscoveryResultSemanticStateViewV1 {
  readonly envelope: ProviderTargetDiscoveryResultEnvelopeV1;
  readonly pin: ProviderTargetDiscoveryResultPinV1;
  readonly bundle: {
    readonly matrix: {
      readonly envelope: ProviderReleaseMatrixEnvelopeV1;
      readonly pin: ProviderReleaseMatrixPinV1;
    };
    readonly taxonomy: {
      readonly envelope: ProviderPublicSupportTaxonomyEnvelopeV1;
      readonly pin: ProviderPublicSupportTaxonomyPinV1;
    };
  };
}

interface HistoricalUniverseSemanticStateV1 {
  readonly envelope: ProviderReleaseTargetUniverseEnvelopeV1;
  readonly pin: ProviderReleaseTargetUniversePinV1;
  readonly result: HistoricalTargetDiscoveryResultSemanticStateViewV1;
}

function validateHistoricalUniverseSemanticCoreV1(
  suppliedEnvelope: ProviderReleaseTargetUniverseEnvelopeV1,
  suppliedResultState: unknown,
): HistoricalUniverseSemanticStateV1 {
  ProviderReleaseTargetUniverseEnvelopeV1Schema.parse(suppliedEnvelope);
  const resultState =
    suppliedResultState as HistoricalTargetDiscoveryResultSemanticStateViewV1;
  if (
    resultState?.envelope === undefined ||
    resultState.bundle?.matrix?.envelope === undefined ||
    resultState.bundle?.taxonomy?.envelope === undefined
  ) {
    return failUniversePointV1(
      "target_discovery_closure",
      "source_invalid",
    );
  }
  const envelope = suppliedEnvelope;
  const universe = envelope.payload;
  const result = resultState.envelope.payload;
  const matrix = resultState.bundle.matrix.envelope.payload;
  const taxonomy = resultState.bundle.taxonomy.envelope.payload;
  validateUniverseGenerationPredecessorV1(universe);
  if (
    !canonicalEqualV1(
      universe.distributionRootBinding,
      result.distributionRootBinding,
    )
  ) {
    return failUniversePointV1(
      "universe_distribution_binding",
      "binding_mismatch",
    );
  }
  if (
    !canonicalEqualV1(universe.activeRootMetadata, result.activeRootMetadata) ||
    universe.registryRootKeyId !== result.registryRootKeyId
  ) {
    return failUniversePointV1("universe_active_root", "root_mismatch");
  }
  if (
    !canonicalEqualV1(
      universe.publicSupportTaxonomy,
      resultState.bundle.taxonomy.pin,
    ) ||
    !canonicalEqualV1(universe.publicSupportTaxonomy, result.publicSupportTaxonomy)
  ) {
    return failUniversePointV1("universe_taxonomy_pin", "pin_mismatch");
  }
  if (
    !canonicalEqualV1(
      universe.coverageBasis.releaseMatrix,
      resultState.bundle.matrix.pin,
    ) ||
    !canonicalEqualV1(
      universe.coverageBasis.targetDiscoveryResult,
      resultState.pin,
    )
  ) {
    return failUniversePointV1("universe_coverage_pins", "pin_mismatch");
  }

  const snapshot = {
    publicSupportTaxonomy: resultState.bundle.taxonomy.envelope,
    releaseMatrix: resultState.bundle.matrix.envelope,
    targetDiscoveryResult: resultState.envelope,
  } as ProviderTargetDiscoveryPointSnapshotV1;
  validateUniverseCoverageBindingV1(universe, snapshot);
  validateUniverseCoverageCountsV1(universe, snapshot);
  validateUniverseTargetUnionV1(universe, snapshot);
  const expectedResolution = deriveExpectedCoverageResolutionV1(snapshot);
  if (!canonicalEqualV1(universe.coverageBasis.resolution, expectedResolution)) {
    return failUniversePointV1("universe_resolution", "coverage_mismatch");
  }
  validateUniverseBucketsV1(universe, expectedResolution);
  if (
    envelope.contentDigest !==
    deriveProviderReleaseTargetUniverseContentDigestV1(universe)
  ) {
    return failUniversePointV1("universe_digest", "digest_mismatch");
  }
  if (envelope.universeGeneration !== universe.universeGeneration) {
    return failUniversePointV1("universe_envelope", "envelope_mismatch");
  }
  if (
    matrix.distributionRootBinding.releaseRevisionDigest !==
      taxonomy.distributionRootBinding.releaseRevisionDigest
  ) {
    return failUniversePointV1(
      "universe_distribution_binding",
      "binding_mismatch",
    );
  }
  return {
    envelope,
    pin: ProviderReleaseTargetUniversePinV1Schema.parse({
      locatorProfile: PROVIDER_RELEASE_TARGET_UNIVERSE_LOCATOR_PROFILE_V1,
      universeGeneration: universe.universeGeneration,
      contentDigest: envelope.contentDigest,
    }),
    result: resultState,
  };
}

function lowerHexToBytesV1(hex: string): Uint8Array {
  if (!regExpTestV1(/^(?:[0-9a-f]{2})+$/u, hex)) {
    throw new CapturedTypeErrorV1("invalid lowercase hex");
  }
  const bytes = new CapturedUint8ArrayV1(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = CapturedNumberParseIntV1(
      stringSliceV1(hex, index * 2, index * 2 + 2),
      16,
    );
  }
  return bytes;
}

function decodeCanonicalPublicKeyBytes32V1(value: string): Uint8Array {
  const body = stringSliceV1(value, "base64url:".length);
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const output = new CapturedUint8ArrayV1(32);
  let accumulator = 0;
  let availableBits = 0;
  let offset = 0;
  for (let index = 0; index < body.length; index += 1) {
    const digit = stringIndexOfV1(alphabet, body[index]!);
    if (digit < 0) {
      throw new CapturedTypeErrorV1("invalid canonical public key");
    }
    accumulator = (accumulator << 6) | digit;
    availableBits += 6;
    if (availableBits >= 8) {
      availableBits -= 8;
      output[offset] = (accumulator >>> availableBits) & 0xff;
      offset += 1;
      accumulator &= (1 << availableBits) - 1;
    }
  }
  if (offset !== 32 || availableBits !== 2 || accumulator !== 0) {
    throw new CapturedTypeErrorV1("public key must decode to exact raw32");
  }
  return output;
}

async function verifyUniverseRootSignatureV1(
  universe: ProviderReleaseTargetUniverseV1,
  snapshot: ProviderTargetDiscoveryPointSnapshotV1,
): Promise<void> {
  const match = regExpExecV1(
    UNIVERSE_SIGNATURE_PATTERN_V1,
    universe.universeSignature,
  );
  if (
    match?.[1] === undefined ||
    match[2] === undefined ||
    match[1] !== snapshot.activeRoot.rootKeyId
  ) {
    return failUniversePointV1(
      "universe_signature_binding",
      "root_mismatch",
    );
  }
  try {
    if (
      !(await verifyRawEd25519WithCapabilityV1(
        snapshot.strictCryptoCapability,
        decodeCanonicalPublicKeyBytes32V1(
          snapshot.activeRoot.publicKeyBytes,
        ),
        createProviderReleaseTargetUniverseSignatureMessageV1(
          universe,
          snapshot.activeRoot.rootKeyId,
        ),
        lowerHexToBytesV1(match[2]),
      ))
    ) {
      return failUniversePointV1(
        "universe_signature",
        "signature_invalid",
      );
    }
  } catch (error) {
    if (error instanceof UniversePointDiagnosticSignalV1) throw error;
    return failUniversePointV1(
      "universe_signature",
      "signature_invalid",
    );
  }
}

async function validateUniversePointClosureInternalV1(
  prepared: PreparedProviderReleaseTargetUniversePointInputV1,
): Promise<ProviderReleaseTargetUniversePointClosureValidationV1> {
  let targetDiscoveryDiagnostic;
  try {
    registerProviderTargetDiscoveryPointPreSnapshotV1(
      prepared.inheritedRequest,
      prepared.inheritedSnapshot,
    );
    targetDiscoveryDiagnostic =
      await diagnoseProviderTargetDiscoveryPointClosureV1(
        prepared.inheritedRequest,
      );
  } catch {
    return failUniversePointV1(
      "target_discovery_closure",
      "source_invalid",
    );
  }
  if (!targetDiscoveryDiagnostic.ok) {
    return failUniversePointV1(
      "target_discovery_closure",
      "source_invalid",
    );
  }
  const targetDiscoveryPointClosure = targetDiscoveryDiagnostic.value;
  let snapshot: ProviderTargetDiscoveryPointSnapshotV1 | undefined;
  try {
    snapshot = takeProviderTargetDiscoveryPointClosureSnapshotV1(
      targetDiscoveryPointClosure,
    );
  } catch {
    snapshot = undefined;
  }
  if (snapshot === undefined) {
    return failUniversePointV1(
      "target_discovery_closure",
      "source_invalid",
    );
  }

  let envelope: ProviderReleaseTargetUniverseEnvelopeV1;
  try {
    envelope = ProviderReleaseTargetUniverseEnvelopeV1Schema.parse(
      prepared.releaseTargetUniverse,
    );
  } catch {
    return failUniversePointV1("universe_structure", "schema_invalid");
  }
  const universe = envelope.payload;
  validateUniverseGenerationPredecessorV1(universe);

  if (
    !canonicalEqualV1(
      universe.distributionRootBinding,
      targetDiscoveryPointClosure.distributionRootBinding,
    )
  ) {
    return failUniversePointV1(
      "universe_distribution_binding",
      "binding_mismatch",
    );
  }
  if (
    !canonicalEqualV1(
      universe.activeRootMetadata,
      targetDiscoveryPointClosure.activeRootMetadata,
    ) ||
    universe.registryRootKeyId !== snapshot.activeRoot.rootKeyId
  ) {
    return failUniversePointV1(
      "universe_active_root",
      "root_mismatch",
    );
  }
  if (
    !canonicalEqualV1(
      universe.publicSupportTaxonomy,
      targetDiscoveryPointClosure.publicSupportTaxonomy,
    )
  ) {
    return failUniversePointV1(
      "universe_taxonomy_pin",
      "pin_mismatch",
    );
  }
  if (
    !canonicalEqualV1(
      universe.coverageBasis.releaseMatrix,
      targetDiscoveryPointClosure.releaseMatrix,
    )
  ) {
    return failUniversePointV1(
      "universe_coverage_pins",
      "pin_mismatch",
    );
  }
  if (
    !canonicalEqualV1(
      universe.coverageBasis.targetDiscoveryResult,
      targetDiscoveryPointClosure.targetDiscoveryResult,
    )
  ) {
    return failUniversePointV1(
      "universe_coverage_pins",
      "pin_mismatch",
    );
  }

  validateUniverseCoverageBindingV1(universe, snapshot);
  validateUniverseCoverageCountsV1(universe, snapshot);
  validateUniverseTargetUnionV1(universe, snapshot);

  const expectedResolution = deriveExpectedCoverageResolutionV1(snapshot);
  if (!canonicalEqualV1(universe.coverageBasis.resolution, expectedResolution)) {
    return failUniversePointV1(
      "universe_resolution",
      "coverage_mismatch",
    );
  }
  validateUniverseBucketsV1(universe, expectedResolution);

  await verifyUniverseRootSignatureV1(universe, snapshot);

  if (
    envelope.contentDigest !==
    deriveProviderReleaseTargetUniverseContentDigestV1(universe)
  ) {
    return failUniversePointV1("universe_digest", "digest_mismatch");
  }
  if (envelope.universeGeneration !== universe.universeGeneration) {
    return failUniversePointV1("universe_envelope", "envelope_mismatch");
  }

  let releaseTargetUniversePin: ProviderReleaseTargetUniversePinV1;
  let relativePath: ProviderReleaseTargetUniverseRelativePathV1;
  try {
    releaseTargetUniversePin = deepFreezeSemanticV1(
      ProviderReleaseTargetUniversePinV1Schema.parse({
        locatorProfile: PROVIDER_RELEASE_TARGET_UNIVERSE_LOCATOR_PROFILE_V1,
        universeGeneration: universe.universeGeneration,
        contentDigest: envelope.contentDigest,
      }),
    );
    relativePath =
      resolveProviderReleaseTargetUniverseRelativePathFromVerifiedPinV1(
        releaseTargetUniversePin,
      );
  } catch {
    return failUniversePointV1("universe_envelope", "envelope_mismatch");
  }

  const frozenEnvelope = deepFreezeSemanticV1(envelope);
  const closureFields = deepFreezeSemanticV1({
    authority: "none_release_target_universe_structure_only" as const,
    targetDiscoveryPointClosure,
    releaseTargetUniverse: frozenEnvelope,
    releaseTargetUniversePin,
    relativePath,
    targetCount: frozenEnvelope.payload.targets.length,
    bucketCount: frozenEnvelope.payload.buckets.length,
    coverageResolution: frozenEnvelope.payload.coverageBasis.resolution,
  });
  return createProviderNonThenableFrozenRecordV1(closureFields);
}

function createUniversePointDiagnosticFailureV1(
  stage: ProviderReleaseTargetUniversePointInvalidStageV1,
  reason: ProviderReleaseTargetUniversePointInvalidReasonV1,
): ProviderReleaseTargetUniversePointDiagnosticFailureV1 {
  return createProviderNonThenableFrozenRecordV1({
    ok: false as const,
    stage,
    reason,
  });
}

function createUniversePointDiagnosticFailureFromErrorV1(
  error: unknown,
): ProviderReleaseTargetUniversePointDiagnosticFailureV1 {
  if (error instanceof UniversePointDiagnosticSignalV1) {
    return createUniversePointDiagnosticFailureV1(error.stage, error.reason);
  }
  return createUniversePointDiagnosticFailureV1(
    "target_discovery_closure",
    "source_invalid",
  );
}

export function diagnoseProviderReleaseTargetUniversePointClosureV1(
  input: unknown,
): Promise<ProviderReleaseTargetUniversePointClosureDiagnosticResultV1> {
  let prepared: PreparedProviderReleaseTargetUniversePointInputV1;
  try {
    prepared = prepareProviderReleaseTargetUniversePointFromRawInputV1(input);
  } catch {
    return createProviderPointFulfilledPromiseV1(
      createUniversePointDiagnosticFailureV1("input", "schema_invalid"),
    );
  }
  const corePromise = hardenProviderPointPromiseV1(
    validateUniversePointClosureInternalV1(prepared),
  );
  return corePromise.then(
    (value): ProviderReleaseTargetUniversePointDiagnosticSuccessV1 =>
      createProviderNonThenableFrozenRecordV1({
        ok: true as const,
        value,
      }),
    createUniversePointDiagnosticFailureFromErrorV1,
  );
}

export function validateProviderReleaseTargetUniversePointClosureV1(
  input: ValidateProviderReleaseTargetUniversePointClosureV1Input,
): Promise<ProviderReleaseTargetUniversePointClosureValidationV1> {
  let prepared: PreparedProviderReleaseTargetUniversePointInputV1;
  try {
    prepared = prepareProviderReleaseTargetUniversePointFromRawInputV1(input);
  } catch {
    return createProviderPointRejectedPromiseV1(
      new ProviderReleaseTargetUniversePointClosureValidationError(),
    );
  }
  const corePromise = hardenProviderPointPromiseV1(
    validateUniversePointClosureInternalV1(prepared),
  );
  return corePromise.then(
    (value) => value,
    () => {
      throw new ProviderReleaseTargetUniversePointClosureValidationError();
    },
  );
}

function diagnosePreparedReleaseTargetUniversePointCoreV1(
  input: ValidateProviderReleaseTargetUniversePointClosureV1Input,
): Promise<ProviderReleaseTargetUniversePointClosureDiagnosticResultV1> {
  let prepared: PreparedProviderReleaseTargetUniversePointInputV1;
  try {
    prepared =
      prepareProviderReleaseTargetUniversePointFromDetachedInputV1(input);
  } catch {
    return createProviderPointFulfilledPromiseV1(
      createUniversePointDiagnosticFailureV1("input", "schema_invalid"),
    );
  }
  const corePromise = hardenProviderPointPromiseV1(
    validateUniversePointClosureInternalV1(prepared),
  );
  return corePromise.then(
    (value): ProviderReleaseTargetUniversePointDiagnosticSuccessV1 =>
      createProviderNonThenableFrozenRecordV1({
        ok: true as const,
        value,
      }),
    createUniversePointDiagnosticFailureFromErrorV1,
  );
}

function prepareDetachedUniverseEnvelopeForBuilderV1(
  detachedInput: unknown,
): ProviderReleaseTargetUniverseEnvelopeV1 {
  const detachedAdmission =
    createProviderPointRawAdmissionSessionV1(detachedInput);
  preflightRawUniverseAsTopLevelV1(detachedAdmission, detachedInput);
  return deepFreezeProviderPointDetachedDataTreeV1(
    detachedInput,
  ) as ProviderReleaseTargetUniverseEnvelopeV1;
}

export function buildProviderReleaseTargetUniverseRelativePathV1(
  input: unknown,
): ProviderReleaseTargetUniverseRelativePathV1 {
  const admission = createProviderPointRawAdmissionSessionV1(input);
  preflightRawUniverseAsTopLevelV1(admission, input);
  const detached = prepareDetachedUniverseEnvelopeForBuilderV1(
    cloneProviderPointRawAdmissionCapsuleV1(admission),
  );
  const envelope = ProviderReleaseTargetUniverseEnvelopeV1Schema.parse(
    detached,
  );
  const universe = envelope.payload;
  if (
    (universe.universeGeneration === 1) !==
    (universe.predecessorUniverseContentDigest === undefined)
  ) {
    throw new CapturedTypeErrorV1(
      "Universe locator generation/predecessor mismatch",
    );
  }
  if (
    envelope.contentDigest !==
      deriveProviderReleaseTargetUniverseContentDigestV1(universe) ||
    envelope.universeGeneration !== universe.universeGeneration
  ) {
    throw new CapturedTypeErrorV1("Universe locator envelope mismatch");
  }
  const pin = ProviderReleaseTargetUniversePinV1Schema.parse({
    locatorProfile: PROVIDER_RELEASE_TARGET_UNIVERSE_LOCATOR_PROFILE_V1,
    universeGeneration: universe.universeGeneration,
    contentDigest: envelope.contentDigest,
  });
  return resolveProviderReleaseTargetUniverseRelativePathFromVerifiedPinV1(
    pin,
  );
}

CapturedObjectFreezeV1(
  diagnoseProviderReleaseTargetUniversePointClosureV1,
);
CapturedObjectFreezeV1(
  validateProviderReleaseTargetUniversePointClosureV1,
);
CapturedObjectFreezeV1(buildProviderReleaseTargetUniverseRelativePathV1);
registerProviderReleaseTargetUniversePointPreparedCoreInternalV1(
  diagnosePreparedReleaseTargetUniversePointCoreV1,
);
registerProviderDistributionHistoricalUniverseSemanticCoreInternalV1(
  validateHistoricalUniverseSemanticCoreV1,
);
