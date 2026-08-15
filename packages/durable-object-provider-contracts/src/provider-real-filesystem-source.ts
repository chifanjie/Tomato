import { z } from "./zod-runtime.js";

import {
  assertDataObjectDescriptorsBeforeSchemaV1,
  assertJsonDataTreeBeforeSchemaV1,
  createDomainPreimageBytesV1,
} from "./domain-crypto.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  encodeStoreFilenameKeyV1,
  type ProviderRealFilesystemFixtureCorpusManifestRelativePathV1,
  type ProviderRealFilesystemSuiteManifestRelativePathV1,
} from "./provider-fixed-locator.js";
import {
  ProviderSignedDistributionRootBindingV1Schema,
  validateProviderSignedDistributionRootBindingStructureV1,
  type ProviderSignedDistributionRootBindingV1,
} from "./provider-distribution-trust.js";
import {
  CanonicalByteStringV1Schema,
  ContentDigestV1Schema,
  ProviderRealFilesystemCaseIdV1Schema,
  ProviderRealFilesystemCaseKeyV1Schema,
  ProviderRealFilesystemCrashCutIdV1Schema,
  ProviderRealFilesystemFixtureCorpusManifestSignatureV1Schema,
  ProviderRealFilesystemSuiteManifestSignatureV1Schema,
  ProviderRegistryRootKeyIdV1Schema,
  type ContentDigestV1,
  type ProviderRealFilesystemCaseIdV1,
  type ProviderRealFilesystemCrashCutIdV1,
} from "./primitives.js";
import {
  ProviderRegistryRootMetadataPinV1Schema,
  ProviderRegistryRootPublicKeyV1Schema,
  validateProviderRegistryRootPublicKeyV1,
  type ProviderRegistryRootMetadataPinV1,
  type ProviderRegistryRootPublicKeyV1,
} from "./provider-registry-trust.js";
import { sha256InternalV1 } from "./sha256.js";
import {
  validateProviderStrictEd25519PointWithCapabilityV1,
  verifyRawEd25519WithCapabilityV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "./strict-ed25519-conformance.js";
import {
  assertPreparedDistributionInputBindingsInternalV1,
  recordPreparedDistributionSignatureVerificationInternalV1,
  registerProviderRealFilesystemSourcePreparedCoreInternalV1,
  type PreparedDistributionVerificationContextV1,
} from "./provider-real-filesystem-source-internal.js";
import {
  registerProviderDistributionHistoricalCorpusSemanticCoreInternalV1,
  registerProviderDistributionHistoricalSuiteSemanticCoreInternalV1,
} from "./provider-distribution-historical-semantic-internal.js";
import {
  createProviderNonThenableFrozenRecordV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";

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
const CapturedObjectKeysV1 = Object.keys;
const CapturedObjectValuesV1 = Object.values;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedRegExpPrototypeExecV1 = RegExp.prototype.exec;
const CapturedSetV1 = Set;
const CapturedSetPrototypeAddV1 = Set.prototype.add;
const CapturedSetPrototypeHasV1 = Set.prototype.has;

function hardenPromiseV1<T>(promise: Promise<T>): Promise<T> {
  return hardenProviderPointPromiseV1(promise);
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

function mapKeysArrayV1<K, V>(map: ReadonlyMap<K, V>): K[] {
  const output: K[] = [];
  CapturedReflectApplyV1(CapturedMapPrototypeForEachV1, map, [
    (_value: V, key: K) => {
      arrayPushV1(output, key);
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

function regExpExecV1(pattern: RegExp, value: string): RegExpExecArray | null {
  return CapturedReflectApplyV1(CapturedRegExpPrototypeExecV1, pattern, [
    value,
  ]) as RegExpExecArray | null;
}

function regExpTestV1(pattern: RegExp, value: string): boolean {
  return regExpExecV1(pattern, value) !== null;
}

export const PROVIDER_REAL_FILESYSTEM_FIXTURE_PROGRAM_DOMAIN_V1 =
  "provider-real-fs-fixture-program-v1" as const;
export const PROVIDER_REAL_FILESYSTEM_FIXTURE_CORPUS_RECORD_SET_DOMAIN_V1 =
  "provider-real-fs-fixture-corpus-record-set-v1" as const;
export const PROVIDER_REAL_FILESYSTEM_FIXTURE_CASE_RECORD_SET_DOMAIN_V1 =
  "provider-real-fs-fixture-case-record-set-v1" as const;
export const PROVIDER_REAL_FILESYSTEM_FIXTURE_MANIFEST_DOMAIN_V1 =
  "provider-real-fs-fixture-manifest-v1" as const;
export const PROVIDER_REAL_FILESYSTEM_FIXTURE_CORPUS_MANIFEST_SIGNATURE_DOMAIN_V1 =
  "provider-real-fs-fixture-corpus-manifest-signature-v1" as const;
export const PROVIDER_REAL_FILESYSTEM_FIXTURE_CORPUS_MANIFEST_DOMAIN_V1 =
  "provider-real-fs-fixture-corpus-manifest-v1" as const;
export const PROVIDER_REAL_FILESYSTEM_RUNNER_PROFILE_DOMAIN_V1 =
  "provider-real-fs-runner-profile-v1" as const;
export const PROVIDER_REAL_FILESYSTEM_RECOVERY_ASSERTION_DOMAIN_V1 =
  "provider-real-fs-recovery-assertion-v1" as const;
export const PROVIDER_REAL_FILESYSTEM_CASE_ID_DOMAIN_V1 =
  "provider-real-fs-case-id-v1" as const;
export const PROVIDER_REAL_FILESYSTEM_CRASH_CUT_ID_DOMAIN_V1 =
  "provider-real-fs-crash-cut-id-v1" as const;
export const PROVIDER_REAL_FILESYSTEM_SUITE_CASE_SET_DOMAIN_V1 =
  "provider-real-fs-suite-case-set-v1" as const;
export const PROVIDER_REAL_FILESYSTEM_REQUIRED_CASE_CUT_SET_DOMAIN_V1 =
  "provider-real-fs-required-case-cut-set-v1" as const;
export const PROVIDER_REAL_FILESYSTEM_SUITE_DEFINITION_DOMAIN_V1 =
  "provider-real-fs-suite-definition-v1" as const;
export const PROVIDER_REAL_FILESYSTEM_SUITE_MANIFEST_SIGNATURE_DOMAIN_V1 =
  "provider-real-fs-suite-manifest-signature-v1" as const;
export const PROVIDER_REAL_FILESYSTEM_SUITE_MANIFEST_DOMAIN_V1 =
  "provider-real-fs-suite-manifest-v1" as const;

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
const ProducerVersionV1Schema = z
  .string()
  .regex(
    /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u,
  );

export const ProviderRealFilesystemFixtureProgramFieldsV1Schema =
  z.strictObject({
    fixtureProgramProfile: z.literal(
      "provider_real_fs_fixture_program_v1",
    ),
    fixtureProgramBytes: CanonicalByteStringV1Schema,
  });
export type ProviderRealFilesystemFixtureProgramFieldsV1 = z.infer<
  typeof ProviderRealFilesystemFixtureProgramFieldsV1Schema
>;

export const ProviderRealFilesystemFixtureCorpusRecordV1Schema =
  z.strictObject({
    caseKey: ProviderRealFilesystemCaseKeyV1Schema,
    fixtureOrdinal: NonnegativeSafeIntegerV1Schema,
    fixtureRole: z.enum(["setup", "operation", "assertion"]),
    fixtureProgramProfile: z.literal(
      "provider_real_fs_fixture_program_v1",
    ),
    fixtureProgramBytes: CanonicalByteStringV1Schema,
    fixtureProgramContentDigest: ContentDigestV1Schema,
    fixtureProgramLogicalBytes: NonnegativeSafeIntegerV1Schema,
  });
export type ProviderRealFilesystemFixtureCorpusRecordV1 = z.infer<
  typeof ProviderRealFilesystemFixtureCorpusRecordV1Schema
>;

const FixtureCorpusRecordsV1Schema = z
  .array(ProviderRealFilesystemFixtureCorpusRecordV1Schema)
  .min(1);

export const ProviderRealFilesystemFixtureCorpusRecordSetFieldsV1Schema =
  z.strictObject({ records: FixtureCorpusRecordsV1Schema });
export const ProviderRealFilesystemFixtureCaseRecordSetFieldsV1Schema =
  z.strictObject({
    caseKey: ProviderRealFilesystemCaseKeyV1Schema,
    records: FixtureCorpusRecordsV1Schema,
  });
export const ProviderRealFilesystemFixtureManifestFieldsV1Schema =
  z.strictObject({
    corpusVersion: ProducerVersionV1Schema,
    recordCount: PositiveSafeIntegerV1Schema,
    recordSetDigest: ContentDigestV1Schema,
    records: FixtureCorpusRecordsV1Schema,
  });

const FixtureCorpusUnsignedShapeV1 = {
  profile: z.literal(
    "provider_real_fs_fixture_corpus_manifest_v1",
  ),
  distributionRootBinding: ProviderSignedDistributionRootBindingV1Schema,
  activeRootMetadata: ProviderRegistryRootMetadataPinV1Schema,
  registryRootKeyId: ProviderRegistryRootKeyIdV1Schema,
  releaseRevisionDigest: ContentDigestV1Schema,
  corpusVersion: ProducerVersionV1Schema,
  recordCount: PositiveSafeIntegerV1Schema,
  recordSetDigest: ContentDigestV1Schema,
  records: FixtureCorpusRecordsV1Schema,
  fixtureManifestDigest: ContentDigestV1Schema,
} as const;

export const ProviderRealFilesystemFixtureCorpusManifestUnsignedClaimsV1Schema =
  z.strictObject(FixtureCorpusUnsignedShapeV1);
export type ProviderRealFilesystemFixtureCorpusManifestUnsignedClaimsV1 =
  z.infer<
    typeof ProviderRealFilesystemFixtureCorpusManifestUnsignedClaimsV1Schema
  >;

export const ProviderRealFilesystemFixtureCorpusManifestV1Schema =
  z.strictObject({
    ...FixtureCorpusUnsignedShapeV1,
    corpusSignature:
      ProviderRealFilesystemFixtureCorpusManifestSignatureV1Schema,
  });
export type ProviderRealFilesystemFixtureCorpusManifestV1 = z.infer<
  typeof ProviderRealFilesystemFixtureCorpusManifestV1Schema
>;

export const ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema =
  z.strictObject({
    schemaVersion: z.literal(1),
    recordType: z.literal(
      "provider_real_fs_fixture_corpus_manifest",
    ),
    contentDigest: ContentDigestV1Schema,
    payload: ProviderRealFilesystemFixtureCorpusManifestV1Schema,
  });
export type ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1 = z.infer<
  typeof ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema
>;

export const ProviderRealFilesystemFixtureCorpusManifestPinV1Schema =
  z.strictObject({
    locatorProfile: z.literal(
      "distribution_provider_real_fs_fixture_corpus_manifest_v1",
    ),
    distributionRootBinding: ProviderSignedDistributionRootBindingV1Schema,
    fixtureManifestDigest: ContentDigestV1Schema,
    contentDigest: ContentDigestV1Schema,
  });
export type ProviderRealFilesystemFixtureCorpusManifestPinV1 = z.infer<
  typeof ProviderRealFilesystemFixtureCorpusManifestPinV1Schema
>;

export const ProviderRealFilesystemRunnerProfileV1Schema = z.strictObject({
  profile: z.literal("provider_real_fs_runner_profile_v1"),
  protocolVersion: z.literal("provider-real-fs-runner-v1"),
  canonicalProfileBytes: CanonicalByteStringV1Schema,
});
export type ProviderRealFilesystemRunnerProfileV1 = z.infer<
  typeof ProviderRealFilesystemRunnerProfileV1Schema
>;

const ProviderRealFilesystemNoCrashCutV1Schema = z.strictObject({
  crashCutId: ProviderRealFilesystemCrashCutIdV1Schema.refine(
    (value) => value === "no-crash",
  ),
  crashCutOrdinal: z.literal(0),
  injection: z.strictObject({ state: z.literal("none") }),
});
const ProviderRealFilesystemHashedCrashCutV1Schema = z.strictObject({
  crashCutId: ProviderRealFilesystemCrashCutIdV1Schema.refine(
    (value) => value !== "no-crash",
  ),
  crashCutOrdinal: PositiveSafeIntegerV1Schema,
  injection: z.strictObject({
    state: z.literal("after_fixture_operation"),
    afterFixtureOrdinal: NonnegativeSafeIntegerV1Schema,
  }),
  recoveryAssertionProfile: z.literal(
    "provider_real_fs_recovery_assertion_v1",
  ),
  recoveryAssertionBytes: CanonicalByteStringV1Schema,
  recoveryAssertionContentDigest: ContentDigestV1Schema,
});
export const ProviderRealFilesystemSuiteCrashCutV1Schema = z.union([
  ProviderRealFilesystemNoCrashCutV1Schema,
  ProviderRealFilesystemHashedCrashCutV1Schema,
]);
export type ProviderRealFilesystemSuiteCrashCutV1 = z.infer<
  typeof ProviderRealFilesystemSuiteCrashCutV1Schema
>;

export const ProviderRealFilesystemSuiteCaseV1Schema = z.strictObject({
  caseId: ProviderRealFilesystemCaseIdV1Schema,
  caseKey: ProviderRealFilesystemCaseKeyV1Schema,
  fixtureRecordCount: PositiveSafeIntegerV1Schema,
  fixtureRecordSetDigest: ContentDigestV1Schema,
  requiredCrashCuts: z
    .array(ProviderRealFilesystemSuiteCrashCutV1Schema)
    .min(1),
});
export type ProviderRealFilesystemSuiteCaseV1 = z.infer<
  typeof ProviderRealFilesystemSuiteCaseV1Schema
>;

const SuiteCasesV1Schema = z
  .array(ProviderRealFilesystemSuiteCaseV1Schema)
  .min(1);

export const ProviderRealFilesystemCaseIdFieldsV1Schema = z.strictObject({
  caseKey: ProviderRealFilesystemCaseKeyV1Schema,
  fixtureRecordCount: PositiveSafeIntegerV1Schema,
  fixtureRecordSetDigest: ContentDigestV1Schema,
});
export const ProviderRealFilesystemCrashCutIdFieldsV1Schema = z.strictObject({
  caseId: ProviderRealFilesystemCaseIdV1Schema,
  crashCutOrdinal: PositiveSafeIntegerV1Schema,
  injection: z.strictObject({
    state: z.literal("after_fixture_operation"),
    afterFixtureOrdinal: NonnegativeSafeIntegerV1Schema,
  }),
  recoveryAssertionContentDigest: ContentDigestV1Schema,
});
export const ProviderRealFilesystemRecoveryAssertionFieldsV1Schema =
  z.strictObject({
    recoveryAssertionProfile: z.literal(
      "provider_real_fs_recovery_assertion_v1",
    ),
    recoveryAssertionBytes: CanonicalByteStringV1Schema,
  });
export const ProviderRealFilesystemSuiteCaseSetFieldsV1Schema =
  z.strictObject({ cases: SuiteCasesV1Schema });
export const ProviderRealFilesystemRequiredCaseCutEntryV1Schema =
  z.strictObject({
    caseId: ProviderRealFilesystemCaseIdV1Schema,
    crashCutId: ProviderRealFilesystemCrashCutIdV1Schema,
  });
export type ProviderRealFilesystemRequiredCaseCutEntryV1 = z.infer<
  typeof ProviderRealFilesystemRequiredCaseCutEntryV1Schema
>;
export const ProviderRealFilesystemRequiredCaseCutSetFieldsV1Schema =
  z.strictObject({
    entries: z
      .array(ProviderRealFilesystemRequiredCaseCutEntryV1Schema)
      .min(1),
  });

export const ProviderRealFilesystemSuiteDefinitionFieldsV1Schema =
  z.strictObject({
    suiteVersion: ProducerVersionV1Schema,
    fixtureManifestDigest: ContentDigestV1Schema,
    runnerProfileDigest: ContentDigestV1Schema,
    caseCount: PositiveSafeIntegerV1Schema,
    caseSetDigest: ContentDigestV1Schema,
    requiredCaseCutCount: PositiveSafeIntegerV1Schema,
    requiredCaseCutSetDigest: ContentDigestV1Schema,
    cases: SuiteCasesV1Schema,
  });

const SuiteManifestUnsignedShapeV1 = {
  profile: z.literal("provider_real_fs_suite_manifest_v1"),
  distributionRootBinding: ProviderSignedDistributionRootBindingV1Schema,
  activeRootMetadata: ProviderRegistryRootMetadataPinV1Schema,
  registryRootKeyId: ProviderRegistryRootKeyIdV1Schema,
  releaseRevisionDigest: ContentDigestV1Schema,
  suiteVersion: ProducerVersionV1Schema,
  fixtureCorpusManifest:
    ProviderRealFilesystemFixtureCorpusManifestPinV1Schema,
  runnerProfile: ProviderRealFilesystemRunnerProfileV1Schema,
  runnerProfileDigest: ContentDigestV1Schema,
  caseCount: PositiveSafeIntegerV1Schema,
  caseSetDigest: ContentDigestV1Schema,
  requiredCaseCutCount: PositiveSafeIntegerV1Schema,
  requiredCaseCutSetDigest: ContentDigestV1Schema,
  cases: SuiteCasesV1Schema,
  suiteDigest: ContentDigestV1Schema,
} as const;

export const ProviderRealFilesystemSuiteManifestUnsignedClaimsV1Schema =
  z.strictObject(SuiteManifestUnsignedShapeV1);
export type ProviderRealFilesystemSuiteManifestUnsignedClaimsV1 = z.infer<
  typeof ProviderRealFilesystemSuiteManifestUnsignedClaimsV1Schema
>;
export const ProviderRealFilesystemSuiteManifestV1Schema = z.strictObject({
  ...SuiteManifestUnsignedShapeV1,
  suiteSignature: ProviderRealFilesystemSuiteManifestSignatureV1Schema,
});
export type ProviderRealFilesystemSuiteManifestV1 = z.infer<
  typeof ProviderRealFilesystemSuiteManifestV1Schema
>;
export const ProviderRealFilesystemSuiteManifestEnvelopeV1Schema =
  z.strictObject({
    schemaVersion: z.literal(1),
    recordType: z.literal("provider_real_fs_suite_manifest"),
    contentDigest: ContentDigestV1Schema,
    payload: ProviderRealFilesystemSuiteManifestV1Schema,
  });
export type ProviderRealFilesystemSuiteManifestEnvelopeV1 = z.infer<
  typeof ProviderRealFilesystemSuiteManifestEnvelopeV1Schema
>;

function fixtureCorpusLocatorEnvelopeV1(
  input: unknown,
): ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1 {
  try {
    assertJsonDataTreeBeforeSchemaV1(input);
    const envelope =
      ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema.parse(input);
    if (
      envelope.contentDigest !==
      deriveProviderRealFilesystemFixtureCorpusManifestContentDigestV1(
        envelope.payload,
      )
    ) {
      throw new TypeError("fixture corpus envelope content digest mismatch");
    }
    return envelope;
  } catch {
    throw new TypeError(
      "real filesystem fixture corpus locator requires an exact content-bound envelope",
    );
  }
}

function suiteLocatorEnvelopeV1(
  input: unknown,
): ProviderRealFilesystemSuiteManifestEnvelopeV1 {
  try {
    assertJsonDataTreeBeforeSchemaV1(input);
    const envelope =
      ProviderRealFilesystemSuiteManifestEnvelopeV1Schema.parse(input);
    if (
      envelope.contentDigest !==
      deriveProviderRealFilesystemSuiteManifestContentDigestV1(
        envelope.payload,
      )
    ) {
      throw new TypeError("suite envelope content digest mismatch");
    }
    return envelope;
  } catch {
    throw new TypeError(
      "real filesystem suite locator requires an exact content-bound envelope",
    );
  }
}

/** Derives a path only from a complete, content-bound signed Corpus Envelope. */
export function buildProviderRealFilesystemFixtureCorpusManifestRelativePathV1(
  input: unknown,
): ProviderRealFilesystemFixtureCorpusManifestRelativePathV1 {
  const envelope = fixtureCorpusLocatorEnvelopeV1(input);
  const filenameKey = encodeStoreFilenameKeyV1(
    `fixture-corpus-envelope:${envelope.contentDigest}`,
  );
  return `provider/real-fs-fixture-corpus-manifests/${filenameKey}.json` as ProviderRealFilesystemFixtureCorpusManifestRelativePathV1;
}

/** Derives a path only from a complete, content-bound signed Suite Envelope. */
export function buildProviderRealFilesystemSuiteManifestRelativePathV1(
  input: unknown,
): ProviderRealFilesystemSuiteManifestRelativePathV1 {
  const envelope = suiteLocatorEnvelopeV1(input);
  const filenameKey = encodeStoreFilenameKeyV1(
    `suite-envelope:${envelope.contentDigest}`,
  );
  return `provider/real-fs-suite-manifests/${filenameKey}.json` as ProviderRealFilesystemSuiteManifestRelativePathV1;
}

export const ProviderRealFilesystemSuiteManifestPinV1Schema = z.strictObject({
  locatorProfile: z.literal(
    "distribution_provider_real_fs_suite_manifest_v1",
  ),
  distributionRootBinding: ProviderSignedDistributionRootBindingV1Schema,
  suiteDigest: ContentDigestV1Schema,
  fixtureManifestDigest: ContentDigestV1Schema,
  contentDigest: ContentDigestV1Schema,
});
export type ProviderRealFilesystemSuiteManifestPinV1 = z.infer<
  typeof ProviderRealFilesystemSuiteManifestPinV1Schema
>;

export const ProviderRealFilesystemFixtureCorpusManifestSignatureWrapperV1Schema =
  z.strictObject({
    rootKeyId: ProviderRegistryRootKeyIdV1Schema,
    domain: z.literal(
      PROVIDER_REAL_FILESYSTEM_FIXTURE_CORPUS_MANIFEST_SIGNATURE_DOMAIN_V1,
    ),
    claims:
      ProviderRealFilesystemFixtureCorpusManifestUnsignedClaimsV1Schema,
  });
export const ProviderRealFilesystemSuiteManifestSignatureWrapperV1Schema =
  z.strictObject({
    rootKeyId: ProviderRegistryRootKeyIdV1Schema,
    domain: z.literal(
      PROVIDER_REAL_FILESYSTEM_SUITE_MANIFEST_SIGNATURE_DOMAIN_V1,
    ),
    claims: ProviderRealFilesystemSuiteManifestUnsignedClaimsV1Schema,
  });

function bytesToLowerHexV1(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}

function lowerHexToBytesV1(hex: string): Uint8Array {
  if (!regExpTestV1(/^(?:[0-9a-f]{2})+$/u, hex)) {
    throw new TypeError("signature is not lowercase octets");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function digestForDomainV1(domain: string, fields: object): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHexV1(
      sha256InternalV1(createDomainPreimageBytesV1(domain, fields)),
    )}`,
  );
}

function shortHexForDomainV1(domain: string, fields: object): string {
  return bytesToLowerHexV1(
    sha256InternalV1(createDomainPreimageBytesV1(domain, fields)),
  ).slice(0, 22);
}

function parseStrictFieldsV1<T>(schema: z.ZodType<T>, input: unknown): T {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  return schema.parse(input);
}

export function deriveProviderRealFilesystemFixtureProgramContentDigestV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_REAL_FILESYSTEM_FIXTURE_PROGRAM_DOMAIN_V1,
    parseStrictFieldsV1(
      ProviderRealFilesystemFixtureProgramFieldsV1Schema,
      input,
    ),
  );
}

export function deriveProviderRealFilesystemFixtureCorpusRecordSetDigestV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_REAL_FILESYSTEM_FIXTURE_CORPUS_RECORD_SET_DOMAIN_V1,
    parseStrictFieldsV1(
      ProviderRealFilesystemFixtureCorpusRecordSetFieldsV1Schema,
      input,
    ),
  );
}

export function deriveProviderRealFilesystemFixtureCaseRecordSetDigestV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_REAL_FILESYSTEM_FIXTURE_CASE_RECORD_SET_DOMAIN_V1,
    parseStrictFieldsV1(
      ProviderRealFilesystemFixtureCaseRecordSetFieldsV1Schema,
      input,
    ),
  );
}

export function deriveProviderRealFilesystemFixtureManifestDigestV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_REAL_FILESYSTEM_FIXTURE_MANIFEST_DOMAIN_V1,
    parseStrictFieldsV1(
      ProviderRealFilesystemFixtureManifestFieldsV1Schema,
      input,
    ),
  );
}

export function projectProviderRealFilesystemFixtureCorpusManifestUnsignedClaimsV1(
  input: unknown,
): ProviderRealFilesystemFixtureCorpusManifestUnsignedClaimsV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const signed =
    ProviderRealFilesystemFixtureCorpusManifestV1Schema.safeParse(input);
  if (signed.success) {
    const { corpusSignature: _signature, ...claims } = signed.data;
    return ProviderRealFilesystemFixtureCorpusManifestUnsignedClaimsV1Schema.parse(
      claims,
    );
  }
  return ProviderRealFilesystemFixtureCorpusManifestUnsignedClaimsV1Schema.parse(
    input,
  );
}

export function deriveProviderRealFilesystemFixtureCorpusManifestContentDigestV1(
  input: unknown,
): ContentDigestV1 {
  const payload = parseStrictFieldsV1(
    ProviderRealFilesystemFixtureCorpusManifestV1Schema,
    input,
  );
  return digestForDomainV1(
    PROVIDER_REAL_FILESYSTEM_FIXTURE_CORPUS_MANIFEST_DOMAIN_V1,
    payload,
  );
}

export function deriveProviderRealFilesystemRunnerProfileDigestV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_REAL_FILESYSTEM_RUNNER_PROFILE_DOMAIN_V1,
    parseStrictFieldsV1(ProviderRealFilesystemRunnerProfileV1Schema, input),
  );
}

export function deriveProviderRealFilesystemRecoveryAssertionContentDigestV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_REAL_FILESYSTEM_RECOVERY_ASSERTION_DOMAIN_V1,
    parseStrictFieldsV1(
      ProviderRealFilesystemRecoveryAssertionFieldsV1Schema,
      input,
    ),
  );
}

export function deriveProviderRealFilesystemCaseIdV1(
  input: unknown,
): ProviderRealFilesystemCaseIdV1 {
  const fields = parseStrictFieldsV1(
    ProviderRealFilesystemCaseIdFieldsV1Schema,
    input,
  );
  return ProviderRealFilesystemCaseIdV1Schema.parse(
    `provider-real-fs-case:${shortHexForDomainV1(
      PROVIDER_REAL_FILESYSTEM_CASE_ID_DOMAIN_V1,
      fields,
    )}`,
  );
}

export function deriveProviderRealFilesystemCrashCutIdV1(
  input: unknown,
): ProviderRealFilesystemCrashCutIdV1 {
  const fields = parseStrictFieldsV1(
    ProviderRealFilesystemCrashCutIdFieldsV1Schema,
    input,
  );
  return ProviderRealFilesystemCrashCutIdV1Schema.parse(
    `provider-crash-cut:${shortHexForDomainV1(
      PROVIDER_REAL_FILESYSTEM_CRASH_CUT_ID_DOMAIN_V1,
      fields,
    )}`,
  );
}

export function deriveProviderRealFilesystemSuiteCaseSetDigestV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_REAL_FILESYSTEM_SUITE_CASE_SET_DOMAIN_V1,
    parseStrictFieldsV1(
      ProviderRealFilesystemSuiteCaseSetFieldsV1Schema,
      input,
    ),
  );
}

export function deriveProviderRealFilesystemRequiredCaseCutSetDigestV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_REAL_FILESYSTEM_REQUIRED_CASE_CUT_SET_DOMAIN_V1,
    parseStrictFieldsV1(
      ProviderRealFilesystemRequiredCaseCutSetFieldsV1Schema,
      input,
    ),
  );
}

export function deriveProviderRealFilesystemSuiteDigestV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_REAL_FILESYSTEM_SUITE_DEFINITION_DOMAIN_V1,
    parseStrictFieldsV1(
      ProviderRealFilesystemSuiteDefinitionFieldsV1Schema,
      input,
    ),
  );
}

export function projectProviderRealFilesystemSuiteManifestUnsignedClaimsV1(
  input: unknown,
): ProviderRealFilesystemSuiteManifestUnsignedClaimsV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const signed = ProviderRealFilesystemSuiteManifestV1Schema.safeParse(input);
  if (signed.success) {
    const { suiteSignature: _signature, ...claims } = signed.data;
    return ProviderRealFilesystemSuiteManifestUnsignedClaimsV1Schema.parse(
      claims,
    );
  }
  return ProviderRealFilesystemSuiteManifestUnsignedClaimsV1Schema.parse(
    input,
  );
}

export function deriveProviderRealFilesystemSuiteManifestContentDigestV1(
  input: unknown,
): ContentDigestV1 {
  const payload = parseStrictFieldsV1(
    ProviderRealFilesystemSuiteManifestV1Schema,
    input,
  );
  return digestForDomainV1(
    PROVIDER_REAL_FILESYSTEM_SUITE_MANIFEST_DOMAIN_V1,
    payload,
  );
}

function rootKeyIdFromSignatureV1(
  input: unknown,
  field: "corpusSignature" | "suiteSignature",
  pattern: RegExp,
): string | undefined {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  const value = CapturedObjectGetOwnPropertyDescriptorsV1(input)[field]?.value;
  return typeof value === "string" ? regExpExecV1(pattern, value)?.[1] : undefined;
}

function resolveSignatureRootKeyIdV1(
  input: unknown,
  field: "corpusSignature" | "suiteSignature",
  pattern: RegExp,
  rootKeyId: unknown,
): string {
  const signedKeyId = rootKeyIdFromSignatureV1(input, field, pattern);
  const requested = rootKeyId === undefined
    ? undefined
    : ProviderRegistryRootKeyIdV1Schema.parse(rootKeyId);
  if (
    signedKeyId !== undefined &&
    requested !== undefined &&
    signedKeyId !== requested
  ) {
    throw new TypeError("real filesystem source signature root key mismatch");
  }
  if (signedKeyId === undefined && requested === undefined) {
    throw new TypeError("rootKeyId is required for unsigned source claims");
  }
  return ProviderRegistryRootKeyIdV1Schema.parse(signedKeyId ?? requested);
}

const CORPUS_SIGNATURE_PATTERN =
  /^provider-real-fs-fixture-corpus-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;
const SUITE_SIGNATURE_PATTERN =
  /^provider-real-fs-suite-manifest-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;

export function createProviderRealFilesystemFixtureCorpusManifestSignatureMessageV1(
  input: unknown,
  rootKeyId?: unknown,
): Uint8Array {
  const wrapper =
    ProviderRealFilesystemFixtureCorpusManifestSignatureWrapperV1Schema.parse({
      rootKeyId: resolveSignatureRootKeyIdV1(
        input,
        "corpusSignature",
        CORPUS_SIGNATURE_PATTERN,
        rootKeyId,
      ),
      domain:
        PROVIDER_REAL_FILESYSTEM_FIXTURE_CORPUS_MANIFEST_SIGNATURE_DOMAIN_V1,
      claims:
        projectProviderRealFilesystemFixtureCorpusManifestUnsignedClaimsV1(
          input,
        ),
    });
  return canonicalizeJcsSafeIntegerUtf8V1([
    PROVIDER_REAL_FILESYSTEM_FIXTURE_CORPUS_MANIFEST_SIGNATURE_DOMAIN_V1,
    wrapper,
  ]);
}

export function createProviderRealFilesystemSuiteManifestSignatureMessageV1(
  input: unknown,
  rootKeyId?: unknown,
): Uint8Array {
  const wrapper =
    ProviderRealFilesystemSuiteManifestSignatureWrapperV1Schema.parse({
      rootKeyId: resolveSignatureRootKeyIdV1(
        input,
        "suiteSignature",
        SUITE_SIGNATURE_PATTERN,
        rootKeyId,
      ),
      domain: PROVIDER_REAL_FILESYSTEM_SUITE_MANIFEST_SIGNATURE_DOMAIN_V1,
      claims: projectProviderRealFilesystemSuiteManifestUnsignedClaimsV1(
        input,
      ),
    });
  return canonicalizeJcsSafeIntegerUtf8V1([
    PROVIDER_REAL_FILESYSTEM_SUITE_MANIFEST_SIGNATURE_DOMAIN_V1,
    wrapper,
  ]);
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

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  const leftBytes = canonicalizeJcsSafeIntegerUtf8V1(left);
  const rightBytes = canonicalizeJcsSafeIntegerUtf8V1(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index]! ^ rightBytes[index]!;
  }
  return difference === 0;
}

function canonicalByteStringLogicalLengthV1(value: string): number {
  return Math.floor((value.slice("base64url:".length).length * 6) / 8);
}

function decodeCanonicalPublicKeyBytes32V1(value: string): Uint8Array {
  const body = value.slice("base64url:".length);
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
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
  if (offset !== 32 || availableBits !== 2 || accumulator !== 0) {
    throw new TypeError("public key must decode to exact raw32");
  }
  return output;
}

type SourceStageV1 =
  | "input"
  | "distribution_binding"
  | "active_root"
  | "envelope_limit"
  | "corpus_structure"
  | "corpus_digest"
  | "corpus_signature"
  | "corpus_envelope"
  | "suite_structure"
  | "suite_corpus_pin"
  | "suite_digest"
  | "suite_signature"
  | "suite_envelope";
type SourceReasonV1 =
  | "schema_invalid"
  | "binding_mismatch"
  | "root_mismatch"
  | "byte_limit_exceeded"
  | "ordering_invalid"
  | "count_mismatch"
  | "digest_mismatch"
  | "coverage_mismatch"
  | "signature_invalid"
  | "envelope_mismatch";

interface SourceDiagnosticFailureV1 {
  readonly ok: false;
  readonly stage: SourceStageV1;
  readonly reason: SourceReasonV1;
}
interface SourceDiagnosticSuccessV1 {
  readonly ok: true;
  readonly value: ProviderRealFilesystemSourceClosureValidationV1;
}
export type ProviderRealFilesystemSourceClosureDiagnosticResultV1 =
  | SourceDiagnosticFailureV1
  | SourceDiagnosticSuccessV1;

class SourceDiagnosticSignal extends Error {
  constructor(
    readonly stage: SourceStageV1,
    readonly reason: SourceReasonV1,
  ) {
    super("real filesystem source diagnostic");
  }
}

function fail(
  stage: SourceStageV1,
  reason: SourceReasonV1,
): never {
  throw new SourceDiagnosticSignal(stage, reason);
}

export interface ValidateProviderRealFilesystemSourceClosureV1Input {
  readonly distributionRootBinding: ProviderSignedDistributionRootBindingV1;
  readonly activeRootMetadata: ProviderRegistryRootMetadataPinV1;
  readonly activeRoot: ProviderRegistryRootPublicKeyV1;
  readonly fixtureCorpusManifest:
    ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1;
  readonly suiteManifest: ProviderRealFilesystemSuiteManifestEnvelopeV1;
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
}

export interface ProviderRealFilesystemSourceClosureValidationV1 {
  readonly authority: "none_real_fs_source_structure_only";
  readonly distributionRootBinding: ProviderSignedDistributionRootBindingV1;
  readonly activeRootMetadata: ProviderRegistryRootMetadataPinV1;
  readonly fixtureCorpusManifest:
    ProviderRealFilesystemFixtureCorpusManifestPinV1;
  readonly suiteManifest: ProviderRealFilesystemSuiteManifestPinV1;
  readonly fixtureCorpusManifestRelativePath:
    ProviderRealFilesystemFixtureCorpusManifestRelativePathV1;
  readonly suiteManifestRelativePath:
    ProviderRealFilesystemSuiteManifestRelativePathV1;
  readonly recordCount: number;
  readonly caseCount: number;
  readonly requiredCaseCutCount: number;
}

export class ProviderRealFilesystemSourceClosureValidationError extends Error {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super("Provider real filesystem source closure validation failed");
    this.name = "ProviderRealFilesystemSourceClosureValidationError";
  }
}

function snapshotInputV1(input: unknown): {
  distributionRootBinding: unknown;
  activeRootMetadata: unknown;
  activeRoot: unknown;
  fixtureCorpusManifest: unknown;
  suiteManifest: unknown;
  strictCryptoCapability: unknown;
} {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  const descriptors = CapturedObjectGetOwnPropertyDescriptorsV1(input);
  const keys = arraySortV1(CapturedObjectKeysV1(descriptors));
  const expected = [
    "activeRoot",
    "activeRootMetadata",
    "distributionRootBinding",
    "fixtureCorpusManifest",
    "strictCryptoCapability",
    "suiteManifest",
  ];
  if (
    keys.length !== expected.length ||
    arraySomeV1(keys, (key, index) => key !== expected[index])
  ) {
    return fail("input", "schema_invalid");
  }
  for (const key of expected) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      return fail("input", "schema_invalid");
    }
  }
  return {
    distributionRootBinding: descriptors.distributionRootBinding!.value,
    activeRootMetadata: descriptors.activeRootMetadata!.value,
    activeRoot: descriptors.activeRoot!.value,
    fixtureCorpusManifest: descriptors.fixtureCorpusManifest!.value,
    suiteManifest: descriptors.suiteManifest!.value,
    strictCryptoCapability: descriptors.strictCryptoCapability!.value,
  };
}

function parseSignatureV1(
  signature: string,
  pattern: RegExp,
): { rootKeyId: string; bytes: Uint8Array } {
  const match = regExpExecV1(pattern, signature);
  if (match?.[1] === undefined || match[2] === undefined) {
    throw new TypeError("invalid source signature");
  }
  return { rootKeyId: match[1], bytes: lowerHexToBytesV1(match[2]) };
}

function verifyRootSignatureV1(
  signature: string,
  pattern: RegExp,
  root: ProviderRegistryRootPublicKeyV1,
  message: Uint8Array,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
  stage: "corpus_signature" | "suite_signature",
  preparedContext?: PreparedDistributionVerificationContextV1,
): Promise<void> {
  return hardenPromiseV1(
    (async (): Promise<void> => {
      try {
        const parsed = parseSignatureV1(signature, pattern);
        if (parsed.rootKeyId !== root.rootKeyId) {
          return fail(stage, "signature_invalid");
        }
        const publicKeyBytes = decodeCanonicalPublicKeyBytes32V1(
          root.publicKeyBytes,
        );
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
            parsed.bytes,
          ))
        ) {
          return fail(stage, "signature_invalid");
        }
      } catch (error) {
        if (error instanceof SourceDiagnosticSignal) throw error;
        return fail(stage, "signature_invalid");
      }
    })(),
  );
}

function deepFreezeV1<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of CapturedObjectValuesV1(value)) deepFreezeV1(child);
    CapturedObjectFreezeV1(value);
  }
  return value;
}

interface HistoricalCorpusSemanticStateV1 {
  readonly corpusPin: ProviderRealFilesystemFixtureCorpusManifestPinV1;
  readonly envelope: ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1;
  readonly recordsByCase: ReadonlyMap<
    string,
    readonly ProviderRealFilesystemFixtureCorpusRecordV1[]
  >;
}

interface HistoricalSuiteSemanticStateV1 {
  readonly corpus: HistoricalCorpusSemanticStateV1;
  readonly envelope: ProviderRealFilesystemSuiteManifestEnvelopeV1;
  readonly suitePin: ProviderRealFilesystemSuiteManifestPinV1;
}

function validateHistoricalCorpusSemanticCoreV1(
  suppliedEnvelope: ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1,
): HistoricalCorpusSemanticStateV1 {
  ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema.parse(
    suppliedEnvelope,
  );
  const envelope = suppliedEnvelope;
  const corpus = envelope.payload;
  if (
    corpus.releaseRevisionDigest !==
      corpus.distributionRootBinding.releaseRevisionDigest
  ) {
    return fail("distribution_binding", "binding_mismatch");
  }
  if (corpus.activeRootMetadata.rootKeyId !== corpus.registryRootKeyId) {
    return fail("active_root", "root_mismatch");
  }
  if (corpus.recordCount !== corpus.records.length) {
    return fail("corpus_structure", "count_mismatch");
  }
  const recordsByCase = new CapturedMapV1<
    string,
    ProviderRealFilesystemFixtureCorpusRecordV1[]
  >();
  for (let index = 0; index < corpus.records.length; index += 1) {
    const record = corpus.records[index]!;
    const previous = corpus.records[index - 1];
    if (
      previous !== undefined &&
      (compareUtf8V1(previous.caseKey, record.caseKey) > 0 ||
        (previous.caseKey === record.caseKey &&
          previous.fixtureOrdinal >= record.fixtureOrdinal))
    ) {
      return fail("corpus_structure", "ordering_invalid");
    }
    const records = mapGetV1(recordsByCase, record.caseKey) ?? [];
    if (record.fixtureOrdinal !== records.length) {
      return fail("corpus_structure", "ordering_invalid");
    }
    if (
      record.fixtureProgramContentDigest !==
        deriveProviderRealFilesystemFixtureProgramContentDigestV1({
          fixtureProgramProfile: record.fixtureProgramProfile,
          fixtureProgramBytes: record.fixtureProgramBytes,
        }) ||
      record.fixtureProgramLogicalBytes !==
        canonicalByteStringLogicalLengthV1(record.fixtureProgramBytes)
    ) {
      return fail("corpus_digest", "digest_mismatch");
    }
    arrayPushV1(records, record);
    mapSetV1(recordsByCase, record.caseKey, records);
  }
  if (
    corpus.recordSetDigest !==
      deriveProviderRealFilesystemFixtureCorpusRecordSetDigestV1({
        records: corpus.records,
      }) ||
    corpus.fixtureManifestDigest !==
      deriveProviderRealFilesystemFixtureManifestDigestV1({
        corpusVersion: corpus.corpusVersion,
        recordCount: corpus.recordCount,
        recordSetDigest: corpus.recordSetDigest,
        records: corpus.records,
      })
  ) {
    return fail("corpus_digest", "digest_mismatch");
  }
  if (
    envelope.contentDigest !==
    deriveProviderRealFilesystemFixtureCorpusManifestContentDigestV1(corpus)
  ) {
    return fail("corpus_envelope", "envelope_mismatch");
  }
  return {
    corpusPin: ProviderRealFilesystemFixtureCorpusManifestPinV1Schema.parse({
      locatorProfile:
        "distribution_provider_real_fs_fixture_corpus_manifest_v1",
      distributionRootBinding: corpus.distributionRootBinding,
      fixtureManifestDigest: corpus.fixtureManifestDigest,
      contentDigest: envelope.contentDigest,
    }),
    envelope,
    recordsByCase,
  };
}

function asHistoricalCorpusStateV1(
  value: unknown,
  envelope: ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1,
): HistoricalCorpusSemanticStateV1 {
  const state = value as HistoricalCorpusSemanticStateV1;
  if (state?.envelope !== envelope) {
    return fail("suite_corpus_pin", "binding_mismatch");
  }
  return state;
}

function validateHistoricalSuiteSemanticCoreV1(
  suppliedEnvelope: ProviderRealFilesystemSuiteManifestEnvelopeV1,
  corpusEnvelope: ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1,
  suppliedCorpusState: unknown,
): HistoricalSuiteSemanticStateV1 {
  ProviderRealFilesystemSuiteManifestEnvelopeV1Schema.parse(suppliedEnvelope);
  const corpus = asHistoricalCorpusStateV1(
    suppliedCorpusState,
    corpusEnvelope,
  );
  const envelope = suppliedEnvelope;
  const suite = envelope.payload;
  if (
    suite.releaseRevisionDigest !==
      suite.distributionRootBinding.releaseRevisionDigest ||
    !canonicalEqualV1(
      suite.distributionRootBinding,
      corpus.envelope.payload.distributionRootBinding,
    )
  ) {
    return fail("distribution_binding", "binding_mismatch");
  }
  if (
    suite.activeRootMetadata.rootKeyId !== suite.registryRootKeyId ||
    !canonicalEqualV1(
      suite.activeRootMetadata,
      corpus.envelope.payload.activeRootMetadata,
    ) ||
    suite.registryRootKeyId !== corpus.envelope.payload.registryRootKeyId
  ) {
    return fail("active_root", "root_mismatch");
  }
  if (!canonicalEqualV1(suite.fixtureCorpusManifest, corpus.corpusPin)) {
    return fail("suite_corpus_pin", "binding_mismatch");
  }
  if (
    suite.runnerProfileDigest !==
    deriveProviderRealFilesystemRunnerProfileDigestV1(suite.runnerProfile)
  ) {
    return fail("suite_digest", "digest_mismatch");
  }
  if (suite.caseCount !== suite.cases.length) {
    return fail("suite_structure", "count_mismatch");
  }

  const requiredEntries: ProviderRealFilesystemRequiredCaseCutEntryV1[] = [];
  for (let caseIndex = 0; caseIndex < suite.cases.length; caseIndex += 1) {
    const suiteCase = suite.cases[caseIndex]!;
    for (
      let cutIndex = 0;
      cutIndex < suiteCase.requiredCrashCuts.length;
      cutIndex += 1
    ) {
      arrayPushV1(requiredEntries, {
        caseId: suiteCase.caseId,
        crashCutId: suiteCase.requiredCrashCuts[cutIndex]!.crashCutId,
      });
    }
  }
  arraySortV1(requiredEntries, (left, right) => {
    const caseOrder = compareUtf8V1(left.caseId, right.caseId);
    return caseOrder !== 0
      ? caseOrder
      : compareUtf8V1(left.crashCutId, right.crashCutId);
  });
  for (let index = 1; index < requiredEntries.length; index += 1) {
    const previous = requiredEntries[index - 1]!;
    const current = requiredEntries[index]!;
    if (
      previous.caseId === current.caseId &&
      previous.crashCutId === current.crashCutId
    ) {
      return fail("suite_structure", "ordering_invalid");
    }
  }

  const observedCaseKeys = new CapturedSetV1<string>();
  for (let index = 0; index < suite.cases.length; index += 1) {
    const suiteCase = suite.cases[index]!;
    const previous = suite.cases[index - 1];
    if (
      previous !== undefined &&
      compareUtf8V1(previous.caseId, suiteCase.caseId) >= 0
    ) {
      return fail("suite_structure", "ordering_invalid");
    }
    if (setHasV1(observedCaseKeys, suiteCase.caseKey)) {
      return fail("suite_structure", "coverage_mismatch");
    }
    setAddV1(observedCaseKeys, suiteCase.caseKey);
    const caseRecords = mapGetV1(corpus.recordsByCase, suiteCase.caseKey);
    if (caseRecords === undefined) {
      return fail("suite_structure", "coverage_mismatch");
    }
    const caseRecordSetDigest =
      deriveProviderRealFilesystemFixtureCaseRecordSetDigestV1({
        caseKey: suiteCase.caseKey,
        records: caseRecords,
      });
    const expectedCaseId = deriveProviderRealFilesystemCaseIdV1({
      caseKey: suiteCase.caseKey,
      fixtureRecordCount: caseRecords.length,
      fixtureRecordSetDigest: caseRecordSetDigest,
    });
    if (
      suiteCase.fixtureRecordCount !== caseRecords.length ||
      suiteCase.fixtureRecordSetDigest !== caseRecordSetDigest ||
      suiteCase.caseId !== expectedCaseId
    ) {
      return fail("suite_digest", "digest_mismatch");
    }
    for (
      let cutIndex = 0;
      cutIndex < suiteCase.requiredCrashCuts.length;
      cutIndex += 1
    ) {
      const cut = suiteCase.requiredCrashCuts[cutIndex]!;
      if (cut.crashCutOrdinal !== cutIndex) {
        return fail("suite_structure", "ordering_invalid");
      }
      if (cut.injection.state === "none") {
        if (
          cutIndex !== 0 ||
          cut.crashCutId !== "no-crash" ||
          cut.crashCutOrdinal !== 0
        ) {
          return fail("suite_structure", "coverage_mismatch");
        }
      } else {
        if (
          cutIndex === 0 ||
          cut.crashCutId === "no-crash" ||
          cut.crashCutOrdinal < 1 ||
          !("recoveryAssertionProfile" in cut)
        ) {
          return fail("suite_structure", "coverage_mismatch");
        }
        const record = caseRecords[cut.injection.afterFixtureOrdinal];
        if (record?.fixtureRole !== "operation") {
          return fail("suite_structure", "coverage_mismatch");
        }
        const assertionDigest =
          deriveProviderRealFilesystemRecoveryAssertionContentDigestV1({
            recoveryAssertionProfile: cut.recoveryAssertionProfile,
            recoveryAssertionBytes: cut.recoveryAssertionBytes,
          });
        if (
          cut.recoveryAssertionContentDigest !== assertionDigest ||
          cut.crashCutId !==
            deriveProviderRealFilesystemCrashCutIdV1({
              caseId: suiteCase.caseId,
              crashCutOrdinal: cut.crashCutOrdinal,
              injection: cut.injection,
              recoveryAssertionContentDigest: assertionDigest,
            })
        ) {
          return fail("suite_digest", "digest_mismatch");
        }
      }
    }
  }
  if (
    observedCaseKeys.size !== corpus.recordsByCase.size ||
    arraySomeV1(
      mapKeysArrayV1(corpus.recordsByCase),
      (key) => !setHasV1(observedCaseKeys, key),
    )
  ) {
    return fail("suite_structure", "coverage_mismatch");
  }
  if (
    suite.caseSetDigest !==
      deriveProviderRealFilesystemSuiteCaseSetDigestV1({
        cases: suite.cases,
      }) ||
    suite.requiredCaseCutCount !== requiredEntries.length ||
    suite.requiredCaseCutSetDigest !==
      deriveProviderRealFilesystemRequiredCaseCutSetDigestV1({
        entries: requiredEntries,
      }) ||
    suite.suiteDigest !==
      deriveProviderRealFilesystemSuiteDigestV1({
        suiteVersion: suite.suiteVersion,
        fixtureManifestDigest:
          suite.fixtureCorpusManifest.fixtureManifestDigest,
        runnerProfileDigest: suite.runnerProfileDigest,
        caseCount: suite.caseCount,
        caseSetDigest: suite.caseSetDigest,
        requiredCaseCutCount: suite.requiredCaseCutCount,
        requiredCaseCutSetDigest: suite.requiredCaseCutSetDigest,
        cases: suite.cases,
      })
  ) {
    return fail("suite_digest", "digest_mismatch");
  }
  if (
    envelope.contentDigest !==
    deriveProviderRealFilesystemSuiteManifestContentDigestV1(suite)
  ) {
    return fail("suite_envelope", "envelope_mismatch");
  }
  return {
    corpus,
    envelope,
    suitePin: ProviderRealFilesystemSuiteManifestPinV1Schema.parse({
      locatorProfile: "distribution_provider_real_fs_suite_manifest_v1",
      distributionRootBinding: suite.distributionRootBinding,
      suiteDigest: suite.suiteDigest,
      fixtureManifestDigest:
        suite.fixtureCorpusManifest.fixtureManifestDigest,
      contentDigest: envelope.contentDigest,
    }),
  };
}

async function validateSourceClosureFromSnapshotInternalV1(
  snapshot: ReturnType<typeof snapshotInputV1>,
  preparedContext?: PreparedDistributionVerificationContextV1,
  admitActiveRoot?: (
    capability: ProviderStrictEd25519OpaqueCapabilityV1,
    publicKeyBytes: Uint8Array,
  ) => Promise<boolean>,
): Promise<ProviderRealFilesystemSourceClosureValidationV1> {
  if (preparedContext !== undefined) {
    assertPreparedDistributionInputBindingsInternalV1(
      preparedContext,
      snapshot.activeRoot as ProviderRegistryRootPublicKeyV1,
      snapshot.strictCryptoCapability as ProviderStrictEd25519OpaqueCapabilityV1,
    );
  }

  let binding: ProviderSignedDistributionRootBindingV1;
  let activeRootMetadata: ProviderRegistryRootMetadataPinV1;
  let activeRoot: ProviderRegistryRootPublicKeyV1;
  let corpusEnvelope: ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1;
  let suiteEnvelope: ProviderRealFilesystemSuiteManifestEnvelopeV1;
  try {
    const parsedBinding = validateProviderSignedDistributionRootBindingStructureV1(
      snapshot.distributionRootBinding,
    );
    binding = preparedContext === undefined
      ? parsedBinding
      : snapshot.distributionRootBinding as ProviderSignedDistributionRootBindingV1;
  } catch {
    return fail("distribution_binding", "schema_invalid");
  }
  try {
    const parsedActiveRootMetadata = ProviderRegistryRootMetadataPinV1Schema.parse(
      snapshot.activeRootMetadata,
    );
    const parsedActiveRoot = validateProviderRegistryRootPublicKeyV1(
      snapshot.activeRoot,
    );
    activeRootMetadata = preparedContext === undefined
      ? parsedActiveRootMetadata
      : snapshot.activeRootMetadata as ProviderRegistryRootMetadataPinV1;
    activeRoot = preparedContext === undefined
      ? parsedActiveRoot
      : snapshot.activeRoot as ProviderRegistryRootPublicKeyV1;
    if (
      activeRootMetadata.rootKeyId !== activeRoot.rootKeyId ||
      (admitActiveRoot !== undefined &&
        !(await admitActiveRoot(
          snapshot.strictCryptoCapability as ProviderStrictEd25519OpaqueCapabilityV1,
          decodeCanonicalPublicKeyBytes32V1(activeRoot.publicKeyBytes),
        )))
    ) {
      return fail("active_root", "root_mismatch");
    }
  } catch (error) {
    if (error instanceof SourceDiagnosticSignal) throw error;
    return fail("active_root", "schema_invalid");
  }
  try {
    assertJsonDataTreeBeforeSchemaV1(snapshot.fixtureCorpusManifest);
    const parsedCorpusEnvelope =
      ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema.parse(
        snapshot.fixtureCorpusManifest,
      );
    corpusEnvelope = preparedContext === undefined
      ? parsedCorpusEnvelope
      : snapshot.fixtureCorpusManifest as ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1;
  } catch {
    return fail("corpus_structure", "schema_invalid");
  }
  try {
    assertJsonDataTreeBeforeSchemaV1(snapshot.suiteManifest);
    const parsedSuiteEnvelope = ProviderRealFilesystemSuiteManifestEnvelopeV1Schema.parse(
      snapshot.suiteManifest,
    );
    suiteEnvelope = preparedContext === undefined
      ? parsedSuiteEnvelope
      : snapshot.suiteManifest as ProviderRealFilesystemSuiteManifestEnvelopeV1;
  } catch {
    return fail("suite_structure", "schema_invalid");
  }

  const maxEnvelopeBytes =
    binding.historyPolicy.maxSingleDistributionObjectCanonicalBytes;
  if (
    canonicalizeJcsSafeIntegerUtf8V1(corpusEnvelope).byteLength >
      maxEnvelopeBytes ||
    canonicalizeJcsSafeIntegerUtf8V1(suiteEnvelope).byteLength >
      maxEnvelopeBytes
  ) {
    return fail("envelope_limit", "byte_limit_exceeded");
  }

  const corpus = corpusEnvelope.payload;
  if (
    !canonicalEqualV1(corpus.distributionRootBinding, binding) ||
    corpus.releaseRevisionDigest !== binding.releaseRevisionDigest
  ) {
    return fail("distribution_binding", "binding_mismatch");
  }
  if (
    !canonicalEqualV1(corpus.activeRootMetadata, activeRootMetadata) ||
    corpus.registryRootKeyId !== activeRoot.rootKeyId
  ) {
    return fail("active_root", "root_mismatch");
  }
  if (corpus.recordCount !== corpus.records.length) {
    return fail("corpus_structure", "count_mismatch");
  }

  const recordsByCase = new CapturedMapV1<
    string,
    ProviderRealFilesystemFixtureCorpusRecordV1[]
  >();
  for (let index = 0; index < corpus.records.length; index += 1) {
    const record = corpus.records[index]!;
    const previous = corpus.records[index - 1];
    if (
      previous !== undefined &&
      (compareUtf8V1(previous.caseKey, record.caseKey) > 0 ||
        (previous.caseKey === record.caseKey &&
          previous.fixtureOrdinal >= record.fixtureOrdinal))
    ) {
      return fail("corpus_structure", "ordering_invalid");
    }
    const records = mapGetV1(recordsByCase, record.caseKey) ?? [];
    if (record.fixtureOrdinal !== records.length) {
      return fail("corpus_structure", "ordering_invalid");
    }
    if (
      record.fixtureProgramContentDigest !==
        deriveProviderRealFilesystemFixtureProgramContentDigestV1({
          fixtureProgramProfile: record.fixtureProgramProfile,
          fixtureProgramBytes: record.fixtureProgramBytes,
        }) ||
      record.fixtureProgramLogicalBytes !==
        canonicalByteStringLogicalLengthV1(record.fixtureProgramBytes)
    ) {
      return fail("corpus_digest", "digest_mismatch");
    }
    arrayPushV1(records, record);
    mapSetV1(recordsByCase, record.caseKey, records);
  }
  if (
    corpus.recordSetDigest !==
      deriveProviderRealFilesystemFixtureCorpusRecordSetDigestV1({
        records: corpus.records,
      }) ||
    corpus.fixtureManifestDigest !==
      deriveProviderRealFilesystemFixtureManifestDigestV1({
        corpusVersion: corpus.corpusVersion,
        recordCount: corpus.recordCount,
        recordSetDigest: corpus.recordSetDigest,
        records: corpus.records,
      })
  ) {
    return fail("corpus_digest", "digest_mismatch");
  }
  await verifyRootSignatureV1(
    corpus.corpusSignature,
    CORPUS_SIGNATURE_PATTERN,
    activeRoot,
    createProviderRealFilesystemFixtureCorpusManifestSignatureMessageV1(
      corpus,
      activeRoot.rootKeyId,
    ),
    snapshot.strictCryptoCapability as ProviderStrictEd25519OpaqueCapabilityV1,
    "corpus_signature",
    preparedContext,
  );
  const expectedCorpusContentDigest =
    deriveProviderRealFilesystemFixtureCorpusManifestContentDigestV1(corpus);
  if (corpusEnvelope.contentDigest !== expectedCorpusContentDigest) {
    return fail("corpus_envelope", "envelope_mismatch");
  }
  const parsedCorpusPin =
    ProviderRealFilesystemFixtureCorpusManifestPinV1Schema.parse({
      locatorProfile:
        "distribution_provider_real_fs_fixture_corpus_manifest_v1",
      distributionRootBinding: binding,
      fixtureManifestDigest: corpus.fixtureManifestDigest,
      contentDigest: corpusEnvelope.contentDigest,
    });
  const corpusPin = preparedContext === undefined
    ? parsedCorpusPin
    : deepFreezeV1({
      ...parsedCorpusPin,
      distributionRootBinding: binding,
    });

  const suite = suiteEnvelope.payload;
  if (
    !canonicalEqualV1(suite.distributionRootBinding, binding) ||
    suite.releaseRevisionDigest !== binding.releaseRevisionDigest
  ) {
    return fail("distribution_binding", "binding_mismatch");
  }
  if (
    !canonicalEqualV1(suite.activeRootMetadata, activeRootMetadata) ||
    suite.registryRootKeyId !== activeRoot.rootKeyId
  ) {
    return fail("active_root", "root_mismatch");
  }
  if (!canonicalEqualV1(suite.fixtureCorpusManifest, corpusPin)) {
    return fail("suite_corpus_pin", "binding_mismatch");
  }
  if (
    suite.runnerProfileDigest !==
    deriveProviderRealFilesystemRunnerProfileDigestV1(suite.runnerProfile)
  ) {
    return fail("suite_digest", "digest_mismatch");
  }
  if (suite.caseCount !== suite.cases.length) {
    return fail("suite_structure", "count_mismatch");
  }

  const requiredEntries: ProviderRealFilesystemRequiredCaseCutEntryV1[] = [];
  for (const suiteCase of suite.cases) {
    for (const cut of suiteCase.requiredCrashCuts) {
      arrayPushV1(requiredEntries, {
        caseId: suiteCase.caseId,
        crashCutId: cut.crashCutId,
      });
    }
  }
  arraySortV1(requiredEntries, (left, right) => {
    const caseOrder = compareUtf8V1(left.caseId, right.caseId);
    return caseOrder !== 0
      ? caseOrder
      : compareUtf8V1(left.crashCutId, right.crashCutId);
  });
  for (let index = 1; index < requiredEntries.length; index += 1) {
    const previous = requiredEntries[index - 1]!;
    const current = requiredEntries[index]!;
    if (
      previous.caseId === current.caseId &&
      previous.crashCutId === current.crashCutId
    ) {
      return fail("suite_structure", "ordering_invalid");
    }
  }

  const observedCaseKeys = new CapturedSetV1<string>();
  for (let index = 0; index < suite.cases.length; index += 1) {
    const suiteCase = suite.cases[index]!;
    const previous = suite.cases[index - 1];
    if (
      previous !== undefined &&
      compareUtf8V1(previous.caseId, suiteCase.caseId) >= 0
    ) {
      return fail("suite_structure", "ordering_invalid");
    }
    if (setHasV1(observedCaseKeys, suiteCase.caseKey)) {
      return fail("suite_structure", "coverage_mismatch");
    }
    setAddV1(observedCaseKeys, suiteCase.caseKey);
    const caseRecords = mapGetV1(recordsByCase, suiteCase.caseKey);
    if (caseRecords === undefined) {
      return fail("suite_structure", "coverage_mismatch");
    }
    const caseRecordSetDigest =
      deriveProviderRealFilesystemFixtureCaseRecordSetDigestV1({
        caseKey: suiteCase.caseKey,
        records: caseRecords,
      });
    const expectedCaseId = deriveProviderRealFilesystemCaseIdV1({
      caseKey: suiteCase.caseKey,
      fixtureRecordCount: caseRecords.length,
      fixtureRecordSetDigest: caseRecordSetDigest,
    });
    if (
      suiteCase.fixtureRecordCount !== caseRecords.length ||
      suiteCase.fixtureRecordSetDigest !== caseRecordSetDigest ||
      suiteCase.caseId !== expectedCaseId
    ) {
      return fail("suite_digest", "digest_mismatch");
    }
    for (
      let cutIndex = 0;
      cutIndex < suiteCase.requiredCrashCuts.length;
      cutIndex += 1
    ) {
      const cut = suiteCase.requiredCrashCuts[cutIndex]!;
      if (cut.crashCutOrdinal !== cutIndex) {
        return fail("suite_structure", "ordering_invalid");
      }
      if (cut.injection.state === "none") {
        if (
          cutIndex !== 0 ||
          cut.crashCutId !== "no-crash" ||
          cut.crashCutOrdinal !== 0
        ) {
          return fail("suite_structure", "coverage_mismatch");
        }
      } else {
        if (
          cutIndex === 0 ||
          cut.crashCutId === "no-crash" ||
          cut.crashCutOrdinal < 1 ||
          !("recoveryAssertionProfile" in cut)
        ) {
          return fail("suite_structure", "coverage_mismatch");
        }
        const record = caseRecords[cut.injection.afterFixtureOrdinal];
        if (record?.fixtureRole !== "operation") {
          return fail("suite_structure", "coverage_mismatch");
        }
        const assertionDigest =
          deriveProviderRealFilesystemRecoveryAssertionContentDigestV1({
            recoveryAssertionProfile: cut.recoveryAssertionProfile,
            recoveryAssertionBytes: cut.recoveryAssertionBytes,
          });
        if (
          cut.recoveryAssertionContentDigest !== assertionDigest ||
          cut.crashCutId !==
            deriveProviderRealFilesystemCrashCutIdV1({
              caseId: suiteCase.caseId,
              crashCutOrdinal: cut.crashCutOrdinal,
              injection: cut.injection,
              recoveryAssertionContentDigest: assertionDigest,
            })
        ) {
          return fail("suite_digest", "digest_mismatch");
        }
      }
    }
  }
  if (
    observedCaseKeys.size !== recordsByCase.size ||
    arraySomeV1(
      mapKeysArrayV1(recordsByCase),
      (key) => !setHasV1(observedCaseKeys, key),
    )
  ) {
    return fail("suite_structure", "coverage_mismatch");
  }
  if (
    suite.caseSetDigest !==
      deriveProviderRealFilesystemSuiteCaseSetDigestV1({
        cases: suite.cases,
      }) ||
    suite.requiredCaseCutCount !== requiredEntries.length ||
    suite.requiredCaseCutSetDigest !==
      deriveProviderRealFilesystemRequiredCaseCutSetDigestV1({
        entries: requiredEntries,
      }) ||
    suite.suiteDigest !==
      deriveProviderRealFilesystemSuiteDigestV1({
        suiteVersion: suite.suiteVersion,
        fixtureManifestDigest:
          suite.fixtureCorpusManifest.fixtureManifestDigest,
        runnerProfileDigest: suite.runnerProfileDigest,
        caseCount: suite.caseCount,
        caseSetDigest: suite.caseSetDigest,
        requiredCaseCutCount: suite.requiredCaseCutCount,
        requiredCaseCutSetDigest: suite.requiredCaseCutSetDigest,
        cases: suite.cases,
      })
  ) {
    return fail("suite_digest", "digest_mismatch");
  }
  await verifyRootSignatureV1(
    suite.suiteSignature,
    SUITE_SIGNATURE_PATTERN,
    activeRoot,
    createProviderRealFilesystemSuiteManifestSignatureMessageV1(
      suite,
      activeRoot.rootKeyId,
    ),
    snapshot.strictCryptoCapability as ProviderStrictEd25519OpaqueCapabilityV1,
    "suite_signature",
    preparedContext,
  );
  const expectedSuiteContentDigest =
    deriveProviderRealFilesystemSuiteManifestContentDigestV1(suite);
  if (suiteEnvelope.contentDigest !== expectedSuiteContentDigest) {
    return fail("suite_envelope", "envelope_mismatch");
  }
  const parsedSuitePin = ProviderRealFilesystemSuiteManifestPinV1Schema.parse({
    locatorProfile: "distribution_provider_real_fs_suite_manifest_v1",
    distributionRootBinding: binding,
    suiteDigest: suite.suiteDigest,
    fixtureManifestDigest:
      suite.fixtureCorpusManifest.fixtureManifestDigest,
    contentDigest: suiteEnvelope.contentDigest,
  });
  const suitePin = preparedContext === undefined
    ? parsedSuitePin
    : deepFreezeV1({
      ...parsedSuitePin,
      distributionRootBinding: binding,
    });

  return createProviderNonThenableFrozenRecordV1(deepFreezeV1({
    authority: "none_real_fs_source_structure_only" as const,
    distributionRootBinding: binding,
    activeRootMetadata,
    fixtureCorpusManifest: corpusPin,
    suiteManifest: suitePin,
    fixtureCorpusManifestRelativePath:
      buildProviderRealFilesystemFixtureCorpusManifestRelativePathV1(
        corpusEnvelope,
      ),
    suiteManifestRelativePath:
      buildProviderRealFilesystemSuiteManifestRelativePathV1(suiteEnvelope),
    recordCount: corpus.recordCount,
    caseCount: suite.caseCount,
    requiredCaseCutCount: suite.requiredCaseCutCount,
  }));
}

async function validateSourceClosureInternalV1(
  input: unknown,
): Promise<ProviderRealFilesystemSourceClosureValidationV1> {
  let snapshot: ReturnType<typeof snapshotInputV1>;
  try {
    snapshot = snapshotInputV1(input);
  } catch (error) {
    if (error instanceof SourceDiagnosticSignal) throw error;
    return fail("input", "schema_invalid");
  }
  return validateSourceClosureFromSnapshotInternalV1(
    snapshot,
    undefined,
    validateProviderStrictEd25519PointWithCapabilityV1,
  );
}

export async function diagnoseProviderRealFilesystemSourceClosureV1(
  input: unknown,
): Promise<ProviderRealFilesystemSourceClosureDiagnosticResultV1> {
  try {
    return { ok: true, value: await validateSourceClosureInternalV1(input) };
  } catch (error) {
    if (error instanceof SourceDiagnosticSignal) {
      return { ok: false, stage: error.stage, reason: error.reason };
    }
    return { ok: false, stage: "input", reason: "schema_invalid" };
  }
}

export async function validateProviderRealFilesystemSourceClosureV1(
  input: ValidateProviderRealFilesystemSourceClosureV1Input,
): Promise<ProviderRealFilesystemSourceClosureValidationV1> {
  const result = await diagnoseProviderRealFilesystemSourceClosureV1(input);
  if (!result.ok) {
    throw new ProviderRealFilesystemSourceClosureValidationError();
  }
  return result.value;
}

registerProviderRealFilesystemSourcePreparedCoreInternalV1(
  (
    input: ValidateProviderRealFilesystemSourceClosureV1Input,
    context: PreparedDistributionVerificationContextV1,
  ): Promise<ProviderRealFilesystemSourceClosureDiagnosticResultV1> =>
    hardenPromiseV1(
      (async (): Promise<ProviderRealFilesystemSourceClosureDiagnosticResultV1> => {
        try {
          const validation = validateSourceClosureFromSnapshotInternalV1(
            input,
            context,
          );
          return createProviderNonThenableFrozenRecordV1({
            ok: true,
            value: await hardenPromiseV1(validation),
          });
        } catch (error) {
          if (error instanceof SourceDiagnosticSignal) {
            return createProviderNonThenableFrozenRecordV1({
              ok: false,
              stage: error.stage,
              reason: error.reason,
            });
          }
          return createProviderNonThenableFrozenRecordV1({
            ok: false,
            stage: "input",
            reason: "schema_invalid",
          });
        }
      })(),
  ),
);

registerProviderDistributionHistoricalCorpusSemanticCoreInternalV1(
  validateHistoricalCorpusSemanticCoreV1,
);
registerProviderDistributionHistoricalSuiteSemanticCoreInternalV1(
  validateHistoricalSuiteSemanticCoreV1,
);
