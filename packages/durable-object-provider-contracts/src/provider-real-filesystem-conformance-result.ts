import { z } from "./zod-runtime.js";

import {
  assertDataObjectDescriptorsBeforeSchemaV1,
  assertJsonDataTreeBeforeSchemaV1,
  createDomainPreimageBytesV1,
} from "./domain-crypto.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  ProviderRealFilesystemConformanceResultIdV1Schema,
  type ContentDigestV1,
  type ProviderRealFilesystemConformanceResultIdV1,
} from "./primitives.js";
import {
  encodeStoreFilenameKeyV1,
  type StoreFilenameKeyV1,
} from "./provider-fixed-locator.js";
import {
  ProviderRealFilesystemRequiredCaseCutEntryV1Schema,
  ProviderRealFilesystemSuiteManifestEnvelopeV1Schema,
  ProviderRealFilesystemSuiteManifestPinV1Schema,
  type ProviderRealFilesystemRequiredCaseCutEntryV1,
  type ProviderRealFilesystemSuiteManifestEnvelopeV1,
  type ProviderRealFilesystemSuiteManifestPinV1,
} from "./provider-real-filesystem-source.js";
import { ProviderRegistryIsoTimestampV1Schema } from "./provider-registry-trust.js";
import { sha256InternalV1 } from "./sha256.js";
import {
  ProviderFeasibilityTargetV1Schema,
  ProviderTargetDiscoveryResultEnvelopeV1Schema,
  ProviderTargetDiscoveryResultPinV1Schema,
  deriveProviderTargetProfileIdV1,
  diagnoseProviderTargetDiscoveryPointClosureV1,
  type ProviderFeasibilityTargetV1,
  type ProviderTargetDiscoveryPointClosureDiagnosticResultV1,
  type ProviderTargetDiscoveryPointClosureValidationV1,
  type ProviderTargetDiscoveryResultEnvelopeV1,
  type ProviderTargetDiscoveryResultPinV1,
  type ValidateProviderTargetDiscoveryPointClosureV1Input,
} from "./provider-target-discovery-point.js";
import {
  diagnoseProviderTargetDiscoveryPointPreparedInternalV1,
} from "./provider-target-discovery-point-prepared-internal.js";
import {
  assertPreparedDistributionInputBindingsInternalV1,
  type PreparedDistributionVerificationContextV1,
} from "./provider-real-filesystem-source-internal.js";
import {
  registerProviderRealFilesystemConformanceResultPreparedCoreInternalV1,
} from "./provider-real-filesystem-conformance-result-internal.js";
import {
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import type { ProviderStrictEd25519OpaqueCapabilityV1 } from "./strict-ed25519-conformance.js";

const CapturedArrayPrototypeFilterV1 = Array.prototype.filter;
const CapturedArrayPrototypeMapV1 = Array.prototype.map;
const CapturedArrayPrototypePushV1 = Array.prototype.push;
const CapturedArrayPrototypeSomeV1 = Array.prototype.some;
const CapturedArrayPrototypeSortV1 = Array.prototype.sort;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorsV1 =
  Object.getOwnPropertyDescriptors;
const CapturedObjectKeysV1 = Object.keys;
const CapturedObjectValuesV1 = Object.values;
const CapturedReflectApplyV1 = Reflect.apply;

function hardenPromiseV1<T>(promise: Promise<T>): Promise<T> {
  return hardenProviderPointPromiseV1(promise);
}

function arrayFilterV1<T>(
  array: readonly T[],
  callback: (value: T, index: number, source: readonly T[]) => unknown,
): T[] {
  return CapturedReflectApplyV1(CapturedArrayPrototypeFilterV1, array, [
    callback,
  ]) as T[];
}

function arrayMapV1<T, U>(
  array: readonly T[],
  callback: (value: T, index: number, source: readonly T[]) => U,
): U[] {
  return CapturedReflectApplyV1(CapturedArrayPrototypeMapV1, array, [
    callback,
  ]) as U[];
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

export const PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_ID_DOMAIN_V1 =
  "provider-real-fs-conformance-result-id-v1" as const;
export const PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_DOMAIN_V1 =
  "provider-real-fs-conformance-result-v1" as const;
export const PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_LOCATOR_PROFILE_V1 =
  "installation_provider_real_fs_conformance_result_v1" as const;
export const PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_MAX_CANONICAL_BYTES_V1 =
  16_777_216 as const;

export const ProviderRealFilesystemConformanceCaseOutcomeV1Schema = z.enum([
  "passed",
  "failed",
  "unsupported",
]);
export type ProviderRealFilesystemConformanceCaseOutcomeV1 = z.infer<
  typeof ProviderRealFilesystemConformanceCaseOutcomeV1Schema
>;

export const ProviderRealFilesystemConformanceResultCodeV1Schema = z.enum([
  "passed",
  "assertion_failed",
  "provider_rejected",
  "crash_recovery_failed",
  "identity_discontinuity",
  "containment_violation",
  "unsupported_by_target_profile",
]);
export type ProviderRealFilesystemConformanceResultCodeV1 = z.infer<
  typeof ProviderRealFilesystemConformanceResultCodeV1Schema
>;

export const ProviderRealFilesystemConformanceCaseResultV1Schema = z.strictObject({
  caseId: ProviderRealFilesystemRequiredCaseCutEntryV1Schema.shape.caseId,
  crashCutId: ProviderRealFilesystemRequiredCaseCutEntryV1Schema.shape.crashCutId,
  outcome: ProviderRealFilesystemConformanceCaseOutcomeV1Schema,
  resultCode: ProviderRealFilesystemConformanceResultCodeV1Schema,
});
export type ProviderRealFilesystemConformanceCaseResultV1 = z.infer<
  typeof ProviderRealFilesystemConformanceCaseResultV1Schema
>;

const ResultIdentityShapeV1 = {
  providerId: DurableObjectIdentityProviderIdV1Schema,
  semanticProviderPolicyDigest: ContentDigestV1Schema,
  implementationDigest: ContentDigestV1Schema,
  binaryAttestationDigest: ContentDigestV1Schema,
  target: ProviderFeasibilityTargetV1Schema,
  targetDiscoveryResult: ProviderTargetDiscoveryResultPinV1Schema,
  targetDiscoveryInputBundleContentDigest: ContentDigestV1Schema,
  realFilesystemSuiteManifest: ProviderRealFilesystemSuiteManifestPinV1Schema,
  suiteDigest: ContentDigestV1Schema,
  fixtureManifestDigest: ContentDigestV1Schema,
  runnerProfileDigest: ContentDigestV1Schema,
  crashCutCoverageDigest: ContentDigestV1Schema,
  caseResults: z.array(ProviderRealFilesystemConformanceCaseResultV1Schema).min(1),
  result: ProviderRealFilesystemConformanceCaseOutcomeV1Schema,
  completedAt: ProviderRegistryIsoTimestampV1Schema,
} as const;

export const ProviderRealFilesystemConformanceResultIdFieldsV1Schema = z.strictObject(
  ResultIdentityShapeV1,
);
export type ProviderRealFilesystemConformanceResultIdFieldsV1 = z.infer<
  typeof ProviderRealFilesystemConformanceResultIdFieldsV1Schema
>;

export const ProviderRealFilesystemConformanceResultV1Schema = z.strictObject({
  profile: z.literal("provider_real_fs_conformance_result_v1"),
  resultId: ProviderRealFilesystemConformanceResultIdV1Schema,
  ...ResultIdentityShapeV1,
});
export type ProviderRealFilesystemConformanceResultV1 = z.infer<
  typeof ProviderRealFilesystemConformanceResultV1Schema
>;

export const ProviderRealFilesystemConformanceResultEnvelopeV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  recordType: z.literal("provider_real_fs_conformance_result"),
  resultId: ProviderRealFilesystemConformanceResultIdV1Schema,
  contentDigest: ContentDigestV1Schema,
  payload: ProviderRealFilesystemConformanceResultV1Schema,
});
export type ProviderRealFilesystemConformanceResultEnvelopeV1 = z.infer<
  typeof ProviderRealFilesystemConformanceResultEnvelopeV1Schema
>;

export const ProviderRealFilesystemConformanceResultLocatorV1Schema = z.strictObject({
  locatorProfile: z.literal(PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_LOCATOR_PROFILE_V1),
  resultId: ProviderRealFilesystemConformanceResultIdV1Schema,
});
export type ProviderRealFilesystemConformanceResultLocatorV1 = z.infer<
  typeof ProviderRealFilesystemConformanceResultLocatorV1Schema
>;

export const ProviderRealFilesystemConformanceResultPinV1Schema = z.strictObject({
  locatorProfile: z.literal(PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_LOCATOR_PROFILE_V1),
  resultId: ProviderRealFilesystemConformanceResultIdV1Schema,
  contentDigest: ContentDigestV1Schema,
});
export type ProviderRealFilesystemConformanceResultPinV1 = z.infer<
  typeof ProviderRealFilesystemConformanceResultPinV1Schema
>;

export type ProviderRealFilesystemConformanceResultRelativePathV1 =
  `provider/real-fs-conformance-results/${StoreFilenameKeyV1}.json`;

function bytesToLowerHexV1(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}

function parseStrictFieldsV1<T>(schema: z.ZodType<T>, input: unknown): T {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  return schema.parse(input);
}

function digestForDomainV1(domain: string, fields: object): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHexV1(sha256InternalV1(createDomainPreimageBytesV1(domain, fields)))}`,
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
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.min(leftBytes.byteLength, rightBytes.byteLength);
  for (let index = 0; index < length; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!;
    if (difference !== 0) return difference;
  }
  return leftBytes.byteLength - rightBytes.byteLength;
}

export function projectProviderRealFilesystemConformanceResultIdFieldsV1(
  input: unknown,
): ProviderRealFilesystemConformanceResultIdFieldsV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const result = ProviderRealFilesystemConformanceResultV1Schema.parse(input);
  const { profile: _profile, resultId: _resultId, ...fields } = result;
  return ProviderRealFilesystemConformanceResultIdFieldsV1Schema.parse(fields);
}

export function deriveProviderRealFilesystemConformanceResultIdV1(
  input: unknown,
): ProviderRealFilesystemConformanceResultIdV1 {
  const fields = parseStrictFieldsV1(
    ProviderRealFilesystemConformanceResultIdFieldsV1Schema,
    input,
  );
  const hex = bytesToLowerHexV1(
    sha256InternalV1(
      createDomainPreimageBytesV1(
        PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_ID_DOMAIN_V1,
        fields,
      ),
    ),
  );
  return ProviderRealFilesystemConformanceResultIdV1Schema.parse(
    `provider-real-fs-result:${hex.slice(0, 22)}`,
  );
}

export function deriveProviderRealFilesystemConformanceResultContentDigestV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_DOMAIN_V1,
    parseStrictFieldsV1(ProviderRealFilesystemConformanceResultV1Schema, input),
  );
}

function contentBoundResultEnvelopeV1(
  input: unknown,
): ProviderRealFilesystemConformanceResultEnvelopeV1 {
  try {
    assertJsonDataTreeBeforeSchemaV1(input);
    const envelope = ProviderRealFilesystemConformanceResultEnvelopeV1Schema.parse(input);
    const fields = projectProviderRealFilesystemConformanceResultIdFieldsV1(envelope.payload);
    const resultId = deriveProviderRealFilesystemConformanceResultIdV1(fields);
    const contentDigest = deriveProviderRealFilesystemConformanceResultContentDigestV1(envelope.payload);
    if (
      envelope.resultId !== resultId ||
      envelope.payload.resultId !== resultId ||
      envelope.contentDigest !== contentDigest
    ) {
      throw new TypeError("result envelope identity mismatch");
    }
    return envelope;
  } catch {
    throw new TypeError(
      "real filesystem conformance locator requires an exact content-bound envelope",
    );
  }
}

export function deriveProviderRealFilesystemConformanceResultLocatorV1(
  input: unknown,
): ProviderRealFilesystemConformanceResultLocatorV1 {
  const envelope = contentBoundResultEnvelopeV1(input);
  return ProviderRealFilesystemConformanceResultLocatorV1Schema.parse({
    locatorProfile: PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_LOCATOR_PROFILE_V1,
    resultId: envelope.resultId,
  });
}

export function deriveProviderRealFilesystemConformanceResultPinV1(
  input: unknown,
): ProviderRealFilesystemConformanceResultPinV1 {
  const envelope = contentBoundResultEnvelopeV1(input);
  return ProviderRealFilesystemConformanceResultPinV1Schema.parse({
    ...deriveProviderRealFilesystemConformanceResultLocatorV1(envelope),
    contentDigest: envelope.contentDigest,
  });
}

export function buildProviderRealFilesystemConformanceResultRelativePathV1(
  input: unknown,
): ProviderRealFilesystemConformanceResultRelativePathV1 {
  try {
    const locator = parseStrictFieldsV1(
      ProviderRealFilesystemConformanceResultLocatorV1Schema,
      input,
    );
    return `provider/real-fs-conformance-results/${encodeStoreFilenameKeyV1(locator.resultId)}.json`;
  } catch {
    throw new TypeError(
      "real filesystem conformance result path requires the exact locator DTO",
    );
  }
}

export const ProviderRealFilesystemConformanceResultInvalidStageV1Schema = z.enum([
  "input",
  "target_discovery_point",
  "envelope_limit",
  "result_structure",
  "target_identity",
  "target_membership",
  "discovery_pin",
  "suite_pin",
  "source_digests",
  "case_coverage",
  "case_outcome",
  "aggregate",
  "result_id",
  "result_digest",
  "result_envelope",
  "locator",
]);
export type ProviderRealFilesystemConformanceResultInvalidStageV1 = z.infer<
  typeof ProviderRealFilesystemConformanceResultInvalidStageV1Schema
>;

export const ProviderRealFilesystemConformanceResultInvalidReasonV1Schema = z.enum([
  "schema_invalid",
  "source_invalid",
  "byte_limit_exceeded",
  "binding_mismatch",
  "identity_mismatch",
  "membership_mismatch",
  "ordering_invalid",
  "coverage_mismatch",
  "outcome_code_mismatch",
  "aggregate_mismatch",
  "digest_mismatch",
  "envelope_mismatch",
  "locator_mismatch",
]);
export type ProviderRealFilesystemConformanceResultInvalidReasonV1 = z.infer<
  typeof ProviderRealFilesystemConformanceResultInvalidReasonV1Schema
>;

interface ResultDiagnosticFailureV1 {
  readonly ok: false;
  readonly stage: ProviderRealFilesystemConformanceResultInvalidStageV1;
  readonly reason: ProviderRealFilesystemConformanceResultInvalidReasonV1;
}

interface ResultDiagnosticSuccessV1 {
  readonly ok: true;
  readonly value: ProviderRealFilesystemConformanceResultClosureValidationV1;
}

export type ProviderRealFilesystemConformanceResultClosureDiagnosticResultV1 =
  | ResultDiagnosticFailureV1
  | ResultDiagnosticSuccessV1;

class ResultDiagnosticSignal extends Error {
  constructor(
    readonly stage: ProviderRealFilesystemConformanceResultInvalidStageV1,
    readonly reason: ProviderRealFilesystemConformanceResultInvalidReasonV1,
  ) {
    super("real filesystem conformance result diagnostic");
  }
}

function fail(
  stage: ProviderRealFilesystemConformanceResultInvalidStageV1,
  reason: ProviderRealFilesystemConformanceResultInvalidReasonV1,
): never {
  throw new ResultDiagnosticSignal(stage, reason);
}

export interface ValidateProviderRealFilesystemConformanceResultClosureV1Input
  extends ValidateProviderTargetDiscoveryPointClosureV1Input {
  readonly realFilesystemConformanceResult: ProviderRealFilesystemConformanceResultEnvelopeV1;
  readonly realFilesystemConformanceResultLocator: ProviderRealFilesystemConformanceResultLocatorV1;
  readonly realFilesystemConformanceResultPin: ProviderRealFilesystemConformanceResultPinV1;
}

export interface ProviderRealFilesystemConformanceResultClosureValidationV1 {
  readonly authority: "none_real_fs_conformance_result_structure_only";
  readonly targetDiscoveryPoint: ProviderTargetDiscoveryPointClosureValidationV1;
  readonly result: ProviderRealFilesystemConformanceResultPinV1;
  readonly locator: ProviderRealFilesystemConformanceResultLocatorV1;
  readonly relativePath: ProviderRealFilesystemConformanceResultRelativePathV1;
  readonly target: ProviderFeasibilityTargetV1;
  readonly targetDiscoveryResult: ProviderTargetDiscoveryResultPinV1;
  readonly realFilesystemSuiteManifest: ProviderRealFilesystemSuiteManifestPinV1;
  readonly caseResultCount: number;
  readonly passedCaseResultCount: number;
  readonly failedCaseResultCount: number;
  readonly unsupportedCaseResultCount: number;
}

export class ProviderRealFilesystemConformanceResultClosureValidationError extends Error {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super("Provider real filesystem conformance result closure validation failed");
    this.name = "ProviderRealFilesystemConformanceResultClosureValidationError";
  }
}

const RESULT_CLOSURE_INPUT_KEYS = [
  "activeRoot",
  "activeRootMetadata",
  "distributionRootBinding",
  "fixtureCorpusManifest",
  "publicSupportTaxonomy",
  "realFilesystemConformanceResult",
  "realFilesystemConformanceResultLocator",
  "realFilesystemConformanceResultPin",
  "releaseMatrix",
  "strictCryptoCapability",
  "suiteManifest",
  "targetDiscoveryFixtureManifest",
  "targetDiscoveryResult",
  "targetDiscoveryRunnerRun",
] as const;

type ResultClosureInputKeyV1 = (typeof RESULT_CLOSURE_INPUT_KEYS)[number];
type SnapshotResultClosureInputV1 = Record<ResultClosureInputKeyV1, unknown>;

function deepFreezeV1<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of CapturedObjectValuesV1(value)) deepFreezeV1(child);
    CapturedObjectFreezeV1(value);
  }
  return value;
}

function snapshotResultClosureInputV1(input: unknown): SnapshotResultClosureInputV1 {
  try {
    assertDataObjectDescriptorsBeforeSchemaV1(input);
    const descriptors = CapturedObjectGetOwnPropertyDescriptorsV1(input);
    const keys = arraySortV1(CapturedObjectKeysV1(descriptors));
    if (
      keys.length !== RESULT_CLOSURE_INPUT_KEYS.length ||
      arraySomeV1(
        keys,
        (key, index) => key !== RESULT_CLOSURE_INPUT_KEYS[index],
      )
    ) {
      return fail("input", "schema_invalid");
    }
    const captured = {} as SnapshotResultClosureInputV1;
    for (const key of RESULT_CLOSURE_INPUT_KEYS) {
      const descriptor = descriptors[key];
      if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
        return fail("input", "schema_invalid");
      }
      captured[key] = descriptor.value;
    }
    const { strictCryptoCapability, ...jsonArtifacts } = captured;
    assertJsonDataTreeBeforeSchemaV1(jsonArtifacts);
    structuredClone(input as object);
    const isolatedArtifacts = structuredClone(jsonArtifacts);
    assertJsonDataTreeBeforeSchemaV1(isolatedArtifacts);
    return {
      ...deepFreezeV1(isolatedArtifacts),
      strictCryptoCapability,
    } as SnapshotResultClosureInputV1;
  } catch (error) {
    if (error instanceof ResultDiagnosticSignal) throw error;
    return fail("input", "schema_invalid");
  }
}

function targetFieldsV1(target: ProviderFeasibilityTargetV1) {
  const { targetProfileId: _targetProfileId, ...fields } = target;
  return fields;
}

function requiredCaseCutsV1(
  suite: ProviderRealFilesystemSuiteManifestEnvelopeV1,
): ProviderRealFilesystemRequiredCaseCutEntryV1[] {
  const required: ProviderRealFilesystemRequiredCaseCutEntryV1[] = [];
  for (const suiteCase of suite.payload.cases) {
    for (const cut of suiteCase.requiredCrashCuts) {
      arrayPushV1(required, {
        caseId: suiteCase.caseId,
        crashCutId: cut.crashCutId,
      });
    }
  }
  return arraySortV1(required, (left, right) => {
      const caseOrder = compareUtf8V1(left.caseId, right.caseId);
      return caseOrder !== 0 ? caseOrder : compareUtf8V1(left.crashCutId, right.crashCutId);
  });
}

function validOutcomeCodeV1(result: ProviderRealFilesystemConformanceCaseResultV1): boolean {
  if (result.outcome === "passed") return result.resultCode === "passed";
  if (result.outcome === "unsupported") {
    return result.resultCode === "unsupported_by_target_profile";
  }
  return result.resultCode !== "passed" && result.resultCode !== "unsupported_by_target_profile";
}

function aggregateResultV1(
  caseResults: readonly ProviderRealFilesystemConformanceCaseResultV1[],
): ProviderRealFilesystemConformanceCaseOutcomeV1 {
  if (arraySomeV1(caseResults, (entry) => entry.outcome === "failed")) return "failed";
  if (arraySomeV1(caseResults, (entry) => entry.outcome === "unsupported")) return "unsupported";
  return "passed";
}

async function validateResultClosureFromSnapshotInternalV1(
  snapshot: SnapshotResultClosureInputV1,
  preparedContext: PreparedDistributionVerificationContextV1 | undefined,
  diagnoseTargetDiscovery: (
    input: ValidateProviderTargetDiscoveryPointClosureV1Input,
  ) => Promise<ProviderTargetDiscoveryPointClosureDiagnosticResultV1>,
): Promise<ProviderRealFilesystemConformanceResultClosureValidationV1> {
  if (preparedContext !== undefined) {
    const preparedInput = snapshot as unknown as
      ValidateProviderRealFilesystemConformanceResultClosureV1Input;
    assertPreparedDistributionInputBindingsInternalV1(
      preparedContext,
      preparedInput.activeRoot,
      preparedInput.strictCryptoCapability,
    );
  }
  const targetDiscoveryInput = {
    distributionRootBinding: snapshot.distributionRootBinding,
    activeRootMetadata: snapshot.activeRootMetadata,
    activeRoot: snapshot.activeRoot,
    fixtureCorpusManifest: snapshot.fixtureCorpusManifest,
    suiteManifest: snapshot.suiteManifest,
    publicSupportTaxonomy: snapshot.publicSupportTaxonomy,
    releaseMatrix: snapshot.releaseMatrix,
    targetDiscoveryFixtureManifest: snapshot.targetDiscoveryFixtureManifest,
    targetDiscoveryRunnerRun: snapshot.targetDiscoveryRunnerRun,
    targetDiscoveryResult: snapshot.targetDiscoveryResult,
    strictCryptoCapability:
      snapshot.strictCryptoCapability as ProviderStrictEd25519OpaqueCapabilityV1,
  } as ValidateProviderTargetDiscoveryPointClosureV1Input;
  // The prepared Target bridge returns a fully hardened Promise with its own
  // closed constructor/species. Re-pinning that frozen Promise would reject
  // the valid hardening contract, so consume it directly.
  const targetDiscoveryDiagnostic = await diagnoseTargetDiscovery(
    targetDiscoveryInput,
  );
  if (!targetDiscoveryDiagnostic.ok) return fail("target_discovery_point", "source_invalid");
  const point = targetDiscoveryDiagnostic.value;

  let envelope: ProviderRealFilesystemConformanceResultEnvelopeV1;
  let locator: ProviderRealFilesystemConformanceResultLocatorV1;
  let pin: ProviderRealFilesystemConformanceResultPinV1;
  let discovery: ProviderTargetDiscoveryResultEnvelopeV1;
  let suite: ProviderRealFilesystemSuiteManifestEnvelopeV1;
  try {
    const parsedEnvelope = ProviderRealFilesystemConformanceResultEnvelopeV1Schema.parse(
      snapshot.realFilesystemConformanceResult,
    );
    const parsedLocator = ProviderRealFilesystemConformanceResultLocatorV1Schema.parse(
      snapshot.realFilesystemConformanceResultLocator,
    );
    const parsedPin = ProviderRealFilesystemConformanceResultPinV1Schema.parse(
      snapshot.realFilesystemConformanceResultPin,
    );
    const parsedDiscovery = ProviderTargetDiscoveryResultEnvelopeV1Schema.parse(
      snapshot.targetDiscoveryResult,
    );
    const parsedSuite = ProviderRealFilesystemSuiteManifestEnvelopeV1Schema.parse(
      snapshot.suiteManifest,
    );
    if (preparedContext === undefined) {
      envelope = parsedEnvelope;
      locator = parsedLocator;
      pin = parsedPin;
      discovery = parsedDiscovery;
      suite = parsedSuite;
    } else {
      envelope = snapshot.realFilesystemConformanceResult as ProviderRealFilesystemConformanceResultEnvelopeV1;
      locator = snapshot.realFilesystemConformanceResultLocator as ProviderRealFilesystemConformanceResultLocatorV1;
      pin = snapshot.realFilesystemConformanceResultPin as ProviderRealFilesystemConformanceResultPinV1;
      discovery = snapshot.targetDiscoveryResult as ProviderTargetDiscoveryResultEnvelopeV1;
      suite = snapshot.suiteManifest as ProviderRealFilesystemSuiteManifestEnvelopeV1;
    }
  } catch {
    return fail("result_structure", "schema_invalid");
  }
  if (
    canonicalizeJcsSafeIntegerUtf8V1(envelope).byteLength >
    PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_MAX_CANONICAL_BYTES_V1
  ) {
    return fail("envelope_limit", "byte_limit_exceeded");
  }

  const result = envelope.payload;
  const recomputedTargetId = deriveProviderTargetProfileIdV1(targetFieldsV1(result.target));
  if (result.target.targetProfileId !== recomputedTargetId) {
    return fail("target_identity", "identity_mismatch");
  }
  const sameIdTargets = arrayFilterV1(
    discovery.payload.targets,
    (entry) => entry.target.targetProfileId === result.target.targetProfileId,
  );
  if (
    sameIdTargets.length !== 1 ||
    !canonicalEqualV1(sameIdTargets[0]!.target, result.target)
  ) {
    return fail("target_membership", "membership_mismatch");
  }

  const discoveryPin = ProviderTargetDiscoveryResultPinV1Schema.parse({
    locatorProfile: "distribution_provider_target_discovery_result_v1",
    discoveryGeneration: discovery.payload.discoveryGeneration,
    contentDigest: discovery.contentDigest,
  });
  if (
    !canonicalEqualV1(result.targetDiscoveryResult, point.targetDiscoveryResult) ||
    !canonicalEqualV1(result.targetDiscoveryResult, discoveryPin) ||
    result.targetDiscoveryInputBundleContentDigest !==
      point.targetDiscoveryInputBundleContentDigest ||
    result.targetDiscoveryInputBundleContentDigest !==
      discovery.payload.targetDiscoveryInputBundleContentDigest
  ) {
    return fail("discovery_pin", "binding_mismatch");
  }

  const suitePin = ProviderRealFilesystemSuiteManifestPinV1Schema.parse({
    locatorProfile: "distribution_provider_real_fs_suite_manifest_v1",
    distributionRootBinding: suite.payload.distributionRootBinding,
    suiteDigest: suite.payload.suiteDigest,
    fixtureManifestDigest: suite.payload.fixtureCorpusManifest.fixtureManifestDigest,
    contentDigest: suite.contentDigest,
  });
  const embeddedSuitePin =
    discovery.payload.targetDiscoveryInputBundle.realFilesystemFixtureManifest
      .realFilesystemSuiteManifest;
  if (
    !canonicalEqualV1(result.realFilesystemSuiteManifest, suitePin) ||
    !canonicalEqualV1(result.realFilesystemSuiteManifest, point.realFilesystemSuiteManifest) ||
    !canonicalEqualV1(result.realFilesystemSuiteManifest, embeddedSuitePin)
  ) {
    return fail("suite_pin", "binding_mismatch");
  }
  if (
    result.suiteDigest !== suite.payload.suiteDigest ||
    result.fixtureManifestDigest !== suite.payload.fixtureCorpusManifest.fixtureManifestDigest ||
    result.runnerProfileDigest !== suite.payload.runnerProfileDigest ||
    result.crashCutCoverageDigest !== suite.payload.requiredCaseCutSetDigest
  ) {
    return fail("source_digests", "digest_mismatch");
  }

  const requiredEntries = requiredCaseCutsV1(suite);
  const actualEntries = arrayMapV1(
    result.caseResults,
    ({ caseId, crashCutId }) => ({ caseId, crashCutId }),
  );
  if (!canonicalEqualV1(actualEntries, requiredEntries)) {
    const sortedActual = arraySortV1([...actualEntries], (left, right) => {
      const caseOrder = compareUtf8V1(left.caseId, right.caseId);
      return caseOrder !== 0 ? caseOrder : compareUtf8V1(left.crashCutId, right.crashCutId);
    });
    if (canonicalEqualV1(sortedActual, requiredEntries)) {
      return fail("case_coverage", "ordering_invalid");
    }
    return fail("case_coverage", "coverage_mismatch");
  }
  if (arraySomeV1(result.caseResults, (entry) => !validOutcomeCodeV1(entry))) {
    return fail("case_outcome", "outcome_code_mismatch");
  }
  if (result.result !== aggregateResultV1(result.caseResults)) {
    return fail("aggregate", "aggregate_mismatch");
  }

  const idFields = projectProviderRealFilesystemConformanceResultIdFieldsV1(result);
  const resultId = deriveProviderRealFilesystemConformanceResultIdV1(idFields);
  if (result.resultId !== resultId) return fail("result_id", "identity_mismatch");
  const contentDigest = deriveProviderRealFilesystemConformanceResultContentDigestV1(result);
  if (envelope.contentDigest !== contentDigest) return fail("result_digest", "digest_mismatch");
  if (envelope.resultId !== resultId || envelope.resultId !== result.resultId) {
    return fail("result_envelope", "envelope_mismatch");
  }

  const expectedLocator = ProviderRealFilesystemConformanceResultLocatorV1Schema.parse({
    locatorProfile: PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_LOCATOR_PROFILE_V1,
    resultId,
  });
  const expectedPin = ProviderRealFilesystemConformanceResultPinV1Schema.parse({
    ...expectedLocator,
    contentDigest,
  });
  if (!canonicalEqualV1(locator, expectedLocator) || !canonicalEqualV1(pin, expectedPin)) {
    return fail("locator", "locator_mismatch");
  }

  let relativePath: ProviderRealFilesystemConformanceResultRelativePathV1;
  try {
    relativePath = buildProviderRealFilesystemConformanceResultRelativePathV1(expectedLocator);
  } catch {
    return fail("locator", "locator_mismatch");
  }

  const passedCaseResultCount = arrayFilterV1(
    result.caseResults,
    (entry) => entry.outcome === "passed",
  ).length;
  const failedCaseResultCount = arrayFilterV1(
    result.caseResults,
    (entry) => entry.outcome === "failed",
  ).length;
  const unsupportedCaseResultCount = result.caseResults.length -
    passedCaseResultCount - failedCaseResultCount;
  return deepFreezeV1({
    authority: "none_real_fs_conformance_result_structure_only" as const,
    targetDiscoveryPoint: point,
    result: expectedPin,
    locator: expectedLocator,
    relativePath,
    target: result.target,
    targetDiscoveryResult: discoveryPin,
    realFilesystemSuiteManifest: suitePin,
    caseResultCount: result.caseResults.length,
    passedCaseResultCount,
    failedCaseResultCount,
    unsupportedCaseResultCount,
  });
}

async function validateResultClosureInternalV1(
  input: unknown,
): Promise<ProviderRealFilesystemConformanceResultClosureValidationV1> {
  return validateResultClosureFromSnapshotInternalV1(
    snapshotResultClosureInputV1(input),
    undefined,
    diagnoseProviderTargetDiscoveryPointClosureV1,
  );
}

export async function diagnoseProviderRealFilesystemConformanceResultClosureV1(
  input: unknown,
): Promise<ProviderRealFilesystemConformanceResultClosureDiagnosticResultV1> {
  try {
    return { ok: true, value: await validateResultClosureInternalV1(input) };
  } catch (error) {
    if (error instanceof ResultDiagnosticSignal) {
      return { ok: false, stage: error.stage, reason: error.reason };
    }
    return { ok: false, stage: "input", reason: "schema_invalid" };
  }
}

export async function validateProviderRealFilesystemConformanceResultClosureV1(
  input: ValidateProviderRealFilesystemConformanceResultClosureV1Input,
): Promise<ProviderRealFilesystemConformanceResultClosureValidationV1> {
  const diagnostic = await diagnoseProviderRealFilesystemConformanceResultClosureV1(input);
  if (!diagnostic.ok) {
    throw new ProviderRealFilesystemConformanceResultClosureValidationError();
  }
  return diagnostic.value;
}

registerProviderRealFilesystemConformanceResultPreparedCoreInternalV1(
  (
    input: ValidateProviderRealFilesystemConformanceResultClosureV1Input,
    context: PreparedDistributionVerificationContextV1,
  ): Promise<ProviderRealFilesystemConformanceResultClosureDiagnosticResultV1> => {
    const operation = (async () => {
      try {
        return {
          ok: true as const,
          value: await hardenPromiseV1(
            validateResultClosureFromSnapshotInternalV1(
              input as unknown as SnapshotResultClosureInputV1,
              context,
              (targetInput) =>
                diagnoseProviderTargetDiscoveryPointPreparedInternalV1(
                  targetInput,
                  context,
                ),
            ),
          ),
        };
      } catch (error) {
        if (error instanceof ResultDiagnosticSignal) {
          return { ok: false as const, stage: error.stage, reason: error.reason };
        }
        return { ok: false as const, stage: "input" as const, reason: "schema_invalid" as const };
      }
    })();
    return hardenPromiseV1(operation);
  },
);
