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
  ProviderFeasibilityApproverKeyIdV1Schema,
  ProviderFeasibilityEvidenceIdV1Schema,
  type ContentDigestV1,
  type ProviderFeasibilityEvidenceIdV1,
} from "./primitives.js";
import {
  encodeStoreFilenameKeyV1,
  type StoreFilenameKeyV1,
} from "./provider-fixed-locator.js";
import {
  createProviderNonThenableFrozenRecordV1,
  createProviderPointFulfilledPromiseV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import {
  ProviderRealFilesystemConformanceResultEnvelopeV1Schema,
  ProviderRealFilesystemConformanceResultPinV1Schema,
} from "./provider-real-filesystem-conformance-result.js";
import {
  ProviderFeasibilityApproverPublicKeyV1Schema,
  ProviderFeasibilityEvidencePinV1Schema,
  createProviderFeasibilityApproverPublicKeySignatureMessageV1,
  deriveProviderFeasibilityApproverKeyIdV1,
  type ProviderFeasibilityApproverPublicKeyV1,
  type ProviderFeasibilityEvidencePinV1,
} from "./provider-registry-records.js";
import {
  ProviderRegistryIsoTimestampV1Schema,
  ProviderRegistryRootPublicKeyV1Schema,
  deriveProviderEd25519PublicKeyDigestInternalV1,
  type ProviderRegistryRootPublicKeyV1,
} from "./provider-registry-trust.js";
import {
  diagnoseProviderRuntimeAttestationPointClosureV1,
  type ProviderRuntimeAttestationPointClosureDiagnosticResultV1,
  type ProviderRuntimeAttestationPointClosureValidationV1,
  type ValidateProviderRuntimeAttestationPointClosureV1Input,
} from "./provider-runtime-attestation-point.js";
import {
  diagnoseProviderRuntimeAttestationPointPreparedInternalV1,
} from "./provider-runtime-attestation-point-internal.js";
import {
  registerProviderFeasibilityEvidencePointPreparedCoreInternalV1,
  registerProviderFeasibilityEvidencePointRegistryTrustedPreparedCoreInternalV1,
} from "./provider-feasibility-evidence-point-prepared-internal.js";
import { sha256InternalV1 } from "./sha256.js";
import {
  ProviderFeasibilityTargetV1Schema,
} from "./provider-target-discovery-point.js";
import {
  assertProviderStrictEd25519CryptoCapabilityIdentityV1,
} from "./strict-ed25519-capability-internal.js";
import {
  ProviderStrictEd25519AttestationError,
  validateProviderStrictEd25519PointWithCapabilityV1,
  verifyRawEd25519WithCapabilityV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "./strict-ed25519-conformance.js";

const CapturedArrayPrototypeSomeV1 = Array.prototype.some;
const CapturedArrayPrototypeSortV1 = Array.prototype.sort;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorsV1 =
  Object.getOwnPropertyDescriptors;
const CapturedObjectKeysV1 = Object.keys;
const CapturedObjectIsFrozenV1 = Object.isFrozen;
const CapturedObjectValuesV1 = Object.values;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedRegExpPrototypeExecV1 = RegExp.prototype.exec;
const CapturedSymbolV1 = Symbol;
const CapturedTypeErrorV1 = TypeError;

const VERIFY_APPROVER_RECORD_ROOT_SIGNATURES_V1 = CapturedSymbolV1(
  "verify provider feasibility approver record root signatures",
);
const REGISTRY_TRUSTED_APPROVER_RECORDS_V1 = CapturedSymbolV1(
  "Registry-trusted provider feasibility approver records",
);
type ApproverRecordTrustV1 =
  | typeof VERIFY_APPROVER_RECORD_ROOT_SIGNATURES_V1
  | typeof REGISTRY_TRUSTED_APPROVER_RECORDS_V1;

function arraySomeV1<T>(
  array: readonly T[],
  callback: (value: T, index: number, source: readonly T[]) => unknown,
): boolean {
  return CapturedReflectApplyV1(CapturedArrayPrototypeSomeV1, array, [
    callback,
  ]) as boolean;
}

function arraySortV1<T>(array: T[]): T[] {
  return CapturedReflectApplyV1(CapturedArrayPrototypeSortV1, array, [
    undefined,
  ]) as T[];
}

function objectGetOwnPropertyDescriptorsV1(
  value: object,
): PropertyDescriptorMap {
  return CapturedReflectApplyV1(
    CapturedObjectGetOwnPropertyDescriptorsV1,
    undefined,
    [value],
  ) as PropertyDescriptorMap;
}

function objectKeysV1(value: object): string[] {
  return CapturedReflectApplyV1(CapturedObjectKeysV1, undefined, [
    value,
  ]) as string[];
}

function objectValuesV1(value: object): unknown[] {
  return CapturedReflectApplyV1(CapturedObjectValuesV1, undefined, [
    value,
  ]) as unknown[];
}

function regExpExecV1(pattern: RegExp, value: string): RegExpExecArray | null {
  return CapturedReflectApplyV1(CapturedRegExpPrototypeExecV1, pattern, [
    value,
  ]) as RegExpExecArray | null;
}

function regExpTestV1(pattern: RegExp, value: string): boolean {
  return regExpExecV1(pattern, value) !== null;
}

export const PROVIDER_FEASIBILITY_EVIDENCE_ID_DOMAIN_V1 =
  "provider-feasibility-evidence-id-v1" as const;
export const PROVIDER_FEASIBILITY_EVIDENCE_DOMAIN_V1 =
  "provider-feasibility-evidence-v1" as const;
export const PROVIDER_FEASIBILITY_EVIDENCE_QA_SIGNATURE_DOMAIN_V1 =
  "provider-feasibility-evidence-qa-signature-v1" as const;
export const PROVIDER_FEASIBILITY_EVIDENCE_RELEASE_SIGNATURE_DOMAIN_V1 =
  "provider-feasibility-evidence-release-signature-v1" as const;
export const PROVIDER_FEASIBILITY_EVIDENCE_LOCATOR_PROFILE_V1 =
  "installation_provider_feasibility_evidence_v1" as const;

export const ProviderFeasibilityQaSignatureV1Schema = z
  .string()
  .regex(/^provider-feasibility-ed25519:qa:[0-9a-f]{22}:[0-9a-f]{128}$/u)
  .brand<"ProviderFeasibilityQaSignatureV1">();
export type ProviderFeasibilityQaSignatureV1 = z.infer<
  typeof ProviderFeasibilityQaSignatureV1Schema
>;

export const ProviderFeasibilityReleaseSignatureV1Schema = z
  .string()
  .regex(
    /^provider-feasibility-ed25519:release:[0-9a-f]{22}:[0-9a-f]{128}$/u,
  )
  .brand<"ProviderFeasibilityReleaseSignatureV1">();
export type ProviderFeasibilityReleaseSignatureV1 = z.infer<
  typeof ProviderFeasibilityReleaseSignatureV1Schema
>;

const ProviderFeasibilityEvidenceIdentityShapeV1 = {
  providerId: DurableObjectIdentityProviderIdV1Schema,
  semanticProviderPolicyDigest: ContentDigestV1Schema,
  runtimeAttestationContentDigest: ContentDigestV1Schema,
  implementationDigest: ContentDigestV1Schema,
  binaryAttestationDigest: ContentDigestV1Schema,
  target: ProviderFeasibilityTargetV1Schema,
  isolationSecurityBoundaryProfileDigest: ContentDigestV1Schema,
  ipcPeerAuthenticationPolicyDigest: ContentDigestV1Schema,
  realFilesystemSuiteDigest: ContentDigestV1Schema,
  realFilesystemConformanceResult:
    ProviderRealFilesystemConformanceResultPinV1Schema,
  realFilesystemConformanceResultDigest: ContentDigestV1Schema,
  fixtureManifestDigest: ContentDigestV1Schema,
  runnerProfileDigest: ContentDigestV1Schema,
  crashCutCoverageDigest: ContentDigestV1Schema,
  result: z.enum(["passed", "failed", "unsupported"]),
  issuedAt: ProviderRegistryIsoTimestampV1Schema,
} as const;

export const ProviderFeasibilityEvidenceIdFieldsV1Schema = z.strictObject(
  ProviderFeasibilityEvidenceIdentityShapeV1,
);
export type ProviderFeasibilityEvidenceIdFieldsV1 = z.infer<
  typeof ProviderFeasibilityEvidenceIdFieldsV1Schema
>;

export const ProviderFeasibilityEvidenceUnsignedClaimsV1Schema = z.strictObject(
  {
    profile: z.literal("provider_feasibility_evidence_v1"),
    evidenceId: ProviderFeasibilityEvidenceIdV1Schema,
    ...ProviderFeasibilityEvidenceIdentityShapeV1,
  },
);
export type ProviderFeasibilityEvidenceUnsignedClaimsV1 = z.infer<
  typeof ProviderFeasibilityEvidenceUnsignedClaimsV1Schema
>;

export const ProviderFeasibilityEvidenceV1Schema = z.strictObject({
  ...ProviderFeasibilityEvidenceUnsignedClaimsV1Schema.shape,
  qaSignature: ProviderFeasibilityQaSignatureV1Schema,
  releaseSignature: ProviderFeasibilityReleaseSignatureV1Schema,
});
export type ProviderFeasibilityEvidenceV1 = z.infer<
  typeof ProviderFeasibilityEvidenceV1Schema
>;

export const ProviderFeasibilityEvidenceEnvelopeV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  recordType: z.literal("provider_feasibility_evidence"),
  evidenceId: ProviderFeasibilityEvidenceIdV1Schema,
  contentDigest: ContentDigestV1Schema,
  payload: ProviderFeasibilityEvidenceV1Schema,
});
export type ProviderFeasibilityEvidenceEnvelopeV1 = z.infer<
  typeof ProviderFeasibilityEvidenceEnvelopeV1Schema
>;

export const ProviderFeasibilityEvidenceQaSignatureWrapperV1Schema =
  z.strictObject({
    role: z.literal("qa"),
    keyId: ProviderFeasibilityApproverKeyIdV1Schema,
    claims: ProviderFeasibilityEvidenceUnsignedClaimsV1Schema,
  });
export type ProviderFeasibilityEvidenceQaSignatureWrapperV1 = z.infer<
  typeof ProviderFeasibilityEvidenceQaSignatureWrapperV1Schema
>;

export const ProviderFeasibilityEvidenceReleaseSignatureWrapperV1Schema =
  z.strictObject({
    role: z.literal("release"),
    keyId: ProviderFeasibilityApproverKeyIdV1Schema,
    claims: ProviderFeasibilityEvidenceUnsignedClaimsV1Schema,
  });
export type ProviderFeasibilityEvidenceReleaseSignatureWrapperV1 = z.infer<
  typeof ProviderFeasibilityEvidenceReleaseSignatureWrapperV1Schema
>;

export type ProviderFeasibilityEvidenceRelativePathV1 =
  `provider/feasibility-evidence/${StoreFilenameKeyV1}.json`;

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

const BASE64URL_PREFIX_V1 = "base64url:";
const BASE64URL_ALPHABET_V1 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function decodeCanonicalPublicKeyBytes32V1(value: string): Uint8Array {
  if (!value.startsWith(BASE64URL_PREFIX_V1)) {
    throw new TypeError("public key bytes have the wrong prefix");
  }
  const body = value.slice(BASE64URL_PREFIX_V1.length);
  const decoded = new Uint8Array(32);
  let accumulator = 0;
  let availableBits = 0;
  let offset = 0;
  for (const character of body) {
    const digit = BASE64URL_ALPHABET_V1.indexOf(character);
    if (digit < 0) throw new TypeError("public key bytes are not base64url");
    accumulator = (accumulator << 6) | digit;
    availableBits += 6;
    if (availableBits >= 8) {
      availableBits -= 8;
      if (offset >= decoded.byteLength) {
        throw new TypeError("public key bytes exceed raw32");
      }
      decoded[offset] = (accumulator >>> availableBits) & 0xff;
      offset += 1;
      accumulator &= (1 << availableBits) - 1;
    }
  }
  if (offset !== 32 || availableBits !== 2 || accumulator !== 0) {
    throw new TypeError("public key bytes are not canonical raw32");
  }
  return decoded;
}

function digestForDomainV1(domain: string, fields: object): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHexV1(
      sha256InternalV1(createDomainPreimageBytesV1(domain, fields)),
    )}`,
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

function parseStrictFieldsV1<T>(schema: z.ZodType<T>, input: unknown): T {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  return schema.parse(input);
}

export function projectProviderFeasibilityEvidenceIdFieldsV1(
  input: unknown,
): ProviderFeasibilityEvidenceIdFieldsV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const evidence = ProviderFeasibilityEvidenceV1Schema.safeParse(input);
  if (evidence.success) {
    const {
      profile: _profile,
      evidenceId: _evidenceId,
      qaSignature: _qaSignature,
      releaseSignature: _releaseSignature,
      ...fields
    } = evidence.data;
    return ProviderFeasibilityEvidenceIdFieldsV1Schema.parse(fields);
  }
  return ProviderFeasibilityEvidenceIdFieldsV1Schema.parse(input);
}

export function deriveProviderFeasibilityEvidenceIdV1(
  input: unknown,
): ProviderFeasibilityEvidenceIdV1 {
  const fields = projectProviderFeasibilityEvidenceIdFieldsV1(input);
  const hex = bytesToLowerHexV1(
    sha256InternalV1(
      createDomainPreimageBytesV1(
        PROVIDER_FEASIBILITY_EVIDENCE_ID_DOMAIN_V1,
        fields,
      ),
    ),
  );
  return ProviderFeasibilityEvidenceIdV1Schema.parse(
    `provider-feasibility-evidence:${hex.slice(0, 22)}`,
  );
}

export function projectProviderFeasibilityEvidenceUnsignedClaimsV1(
  input: unknown,
): ProviderFeasibilityEvidenceUnsignedClaimsV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const evidence = ProviderFeasibilityEvidenceV1Schema.safeParse(input);
  if (evidence.success) {
    const {
      qaSignature: _qaSignature,
      releaseSignature: _releaseSignature,
      ...claims
    } = evidence.data;
    return ProviderFeasibilityEvidenceUnsignedClaimsV1Schema.parse(claims);
  }
  return ProviderFeasibilityEvidenceUnsignedClaimsV1Schema.parse(input);
}

export function createProviderFeasibilityEvidenceQaSignatureMessageV1(
  input: unknown,
  keyId: unknown,
): Uint8Array {
  const wrapper =
    ProviderFeasibilityEvidenceQaSignatureWrapperV1Schema.parse({
      role: "qa",
      keyId,
      claims: projectProviderFeasibilityEvidenceUnsignedClaimsV1(input),
    });
  return createDomainPreimageBytesV1(
    PROVIDER_FEASIBILITY_EVIDENCE_QA_SIGNATURE_DOMAIN_V1,
    wrapper,
  );
}

export function createProviderFeasibilityEvidenceReleaseSignatureMessageV1(
  input: unknown,
  keyId: unknown,
): Uint8Array {
  const wrapper =
    ProviderFeasibilityEvidenceReleaseSignatureWrapperV1Schema.parse({
      role: "release",
      keyId,
      claims: projectProviderFeasibilityEvidenceUnsignedClaimsV1(input),
    });
  return createDomainPreimageBytesV1(
    PROVIDER_FEASIBILITY_EVIDENCE_RELEASE_SIGNATURE_DOMAIN_V1,
    wrapper,
  );
}

export function deriveProviderFeasibilityEvidenceContentDigestV1(
  input: unknown,
): ContentDigestV1 {
  return digestForDomainV1(
    PROVIDER_FEASIBILITY_EVIDENCE_DOMAIN_V1,
    parseStrictFieldsV1(ProviderFeasibilityEvidenceV1Schema, input),
  );
}

function contentBoundEvidenceEnvelopeV1(
  input: unknown,
): ProviderFeasibilityEvidenceEnvelopeV1 {
  try {
    const envelope = parseStrictFieldsV1(
      ProviderFeasibilityEvidenceEnvelopeV1Schema,
      input,
    );
    const evidenceId = deriveProviderFeasibilityEvidenceIdV1(
      envelope.payload,
    );
    const contentDigest = deriveProviderFeasibilityEvidenceContentDigestV1(
      envelope.payload,
    );
    if (
      envelope.evidenceId !== evidenceId ||
      envelope.payload.evidenceId !== evidenceId ||
      envelope.contentDigest !== contentDigest
    ) {
      throw new TypeError("evidence envelope identity mismatch");
    }
    return envelope;
  } catch {
    throw new TypeError("feasibility evidence Pin requires a bound Envelope");
  }
}

export function deriveProviderFeasibilityEvidencePinV1(
  input: unknown,
): ProviderFeasibilityEvidencePinV1 {
  const envelope = contentBoundEvidenceEnvelopeV1(input);
  return ProviderFeasibilityEvidencePinV1Schema.parse({
    locatorProfile: PROVIDER_FEASIBILITY_EVIDENCE_LOCATOR_PROFILE_V1,
    evidenceId: envelope.evidenceId,
    contentDigest: envelope.contentDigest,
  });
}

export function buildProviderFeasibilityEvidenceRelativePathV1(
  input: unknown,
): ProviderFeasibilityEvidenceRelativePathV1 {
  try {
    const pin = parseStrictFieldsV1(
      ProviderFeasibilityEvidencePinV1Schema,
      input,
    );
    return `provider/feasibility-evidence/${encodeStoreFilenameKeyV1(
      pin.evidenceId,
    )}.json`;
  } catch {
    throw new TypeError(
      "feasibility evidence path requires the exact validated Pin DTO",
    );
  }
}

export const ProviderFeasibilityEvidencePointInvalidStageV1Schema = z.enum([
  "input",
  "runtime_attestation_closure",
  "evidence_structure",
  "evidence_pin_structure",
  "qa_approver_key_structure",
  "release_approver_key_structure",
  "qa_approver_key_identity",
  "release_approver_key_identity",
  "approver_key_separation",
  "qa_approver_key_root",
  "release_approver_key_root",
  "qa_approver_key_admission",
  "release_approver_key_admission",
  "qa_approver_key_signature",
  "release_approver_key_signature",
  "evidence_result_binding",
  "evidence_policy_binding",
  "evidence_runtime_binding",
  "evidence_time",
  "evidence_id",
  "evidence_qa_signature_binding",
  "evidence_release_signature_binding",
  "evidence_qa_signature",
  "evidence_release_signature",
  "evidence_digest",
  "evidence_envelope",
  "evidence_pin",
]);
export type ProviderFeasibilityEvidencePointInvalidStageV1 = z.infer<
  typeof ProviderFeasibilityEvidencePointInvalidStageV1Schema
>;

export const ProviderFeasibilityEvidencePointInvalidReasonV1Schema = z.enum([
  "schema_invalid",
  "source_invalid",
  "binding_mismatch",
  "identity_mismatch",
  "digest_mismatch",
  "pin_mismatch",
  "root_mismatch",
  "public_key_invalid",
  "signature_invalid",
  "ordering_invalid",
  "envelope_mismatch",
]);
export type ProviderFeasibilityEvidencePointInvalidReasonV1 = z.infer<
  typeof ProviderFeasibilityEvidencePointInvalidReasonV1Schema
>;

interface EvidencePointDiagnosticFailureV1 {
  readonly ok: false;
  readonly stage: ProviderFeasibilityEvidencePointInvalidStageV1;
  readonly reason: ProviderFeasibilityEvidencePointInvalidReasonV1;
}

interface EvidencePointDiagnosticSuccessV1 {
  readonly ok: true;
  readonly value: ProviderFeasibilityEvidencePointClosureValidationV1;
}

export type ProviderFeasibilityEvidencePointClosureDiagnosticResultV1 =
  | EvidencePointDiagnosticFailureV1
  | EvidencePointDiagnosticSuccessV1;

class EvidencePointDiagnosticSignal extends Error {
  constructor(
    readonly stage: ProviderFeasibilityEvidencePointInvalidStageV1,
    readonly reason: ProviderFeasibilityEvidencePointInvalidReasonV1,
  ) {
    super("provider feasibility evidence point diagnostic");
  }
}

function fail(
  stage: ProviderFeasibilityEvidencePointInvalidStageV1,
  reason: ProviderFeasibilityEvidencePointInvalidReasonV1,
): never {
  throw new EvidencePointDiagnosticSignal(stage, reason);
}

export interface ValidateProviderFeasibilityEvidencePointClosureV1Input
  extends ValidateProviderRuntimeAttestationPointClosureV1Input {
  readonly providerFeasibilityEvidence: ProviderFeasibilityEvidenceEnvelopeV1;
  readonly providerFeasibilityEvidencePin: ProviderFeasibilityEvidencePinV1;
  readonly qaApproverPublicKey: ProviderFeasibilityApproverPublicKeyV1;
  readonly releaseApproverPublicKey: ProviderFeasibilityApproverPublicKeyV1;
}

export interface ProviderFeasibilityEvidencePointClosureValidationV1 {
  readonly authority: "none_provider_feasibility_evidence_structure_only";
  readonly runtimeAttestationPointClosure:
    ProviderRuntimeAttestationPointClosureValidationV1;
  readonly providerFeasibilityEvidence: ProviderFeasibilityEvidenceEnvelopeV1;
  readonly providerFeasibilityEvidencePin: ProviderFeasibilityEvidencePinV1;
  readonly relativePath: ProviderFeasibilityEvidenceRelativePathV1;
  readonly qaApproverPublicKey: ProviderFeasibilityApproverPublicKeyV1;
  readonly releaseApproverPublicKey: ProviderFeasibilityApproverPublicKeyV1;
}

export class ProviderFeasibilityEvidencePointClosureValidationError extends Error {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super("Provider feasibility evidence point closure validation failed");
    this.name = "ProviderFeasibilityEvidencePointClosureValidationError";
  }
}

const EVIDENCE_POINT_INPUT_KEYS = [
  "activeRoot",
  "activeRootMetadata",
  "distributionRootBinding",
  "fixtureCorpusManifest",
  "providerFeasibilityEvidence",
  "providerFeasibilityEvidencePin",
  "publicSupportTaxonomy",
  "qaApproverPublicKey",
  "realFilesystemConformanceResult",
  "realFilesystemConformanceResultLocator",
  "realFilesystemConformanceResultPin",
  "releaseApproverPublicKey",
  "releaseMatrix",
  "runtimeAttestation",
  "semanticProviderPolicy",
  "strictCryptoCapability",
  "suiteManifest",
  "targetDiscoveryFixtureManifest",
  "targetDiscoveryResult",
  "targetDiscoveryRunnerRun",
] as const;

type EvidencePointInputKeyV1 = (typeof EVIDENCE_POINT_INPUT_KEYS)[number];
type SnapshotEvidencePointInputV1 = Record<EvidencePointInputKeyV1, unknown>;

function deepFreezeV1<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of objectValuesV1(value)) deepFreezeV1(child);
    CapturedObjectFreezeV1(value);
  }
  return value;
}

function snapshotEvidencePointInputV1(
  input: unknown,
): SnapshotEvidencePointInputV1 {
  try {
    assertDataObjectDescriptorsBeforeSchemaV1(input);
    const descriptors = objectGetOwnPropertyDescriptorsV1(input as object);
    const keys = arraySortV1(objectKeysV1(descriptors));
    if (
      keys.length !== EVIDENCE_POINT_INPUT_KEYS.length ||
      arraySomeV1(
        keys,
        (key, index) => key !== EVIDENCE_POINT_INPUT_KEYS[index],
      )
    ) {
      return fail("input", "schema_invalid");
    }

    const captured = {} as SnapshotEvidencePointInputV1;
    for (const key of EVIDENCE_POINT_INPUT_KEYS) {
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
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
    } as SnapshotEvidencePointInputV1;
  } catch (error) {
    if (error instanceof EvidencePointDiagnosticSignal) throw error;
    return fail("input", "schema_invalid");
  }
}

function assertRecursivelyFrozenEvidenceJsonV1(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (!CapturedObjectIsFrozenV1(value)) {
    throw new CapturedTypeErrorV1(
      "prepared Evidence JSON must already be frozen",
    );
  }
  for (const child of objectValuesV1(value)) {
    assertRecursivelyFrozenEvidenceJsonV1(child);
  }
}

function snapshotPreparedEvidencePointInputV1(
  input: unknown,
): SnapshotEvidencePointInputV1 {
  try {
    assertDataObjectDescriptorsBeforeSchemaV1(input);
    if (!CapturedObjectIsFrozenV1(input as object)) {
      return fail("input", "schema_invalid");
    }
    const descriptors = objectGetOwnPropertyDescriptorsV1(input as object);
    const keys = arraySortV1(objectKeysV1(descriptors));
    if (
      keys.length !== EVIDENCE_POINT_INPUT_KEYS.length ||
      arraySomeV1(
        keys,
        (key, index) => key !== EVIDENCE_POINT_INPUT_KEYS[index],
      )
    ) {
      return fail("input", "schema_invalid");
    }

    const captured = {} as SnapshotEvidencePointInputV1;
    for (const key of EVIDENCE_POINT_INPUT_KEYS) {
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        return fail("input", "schema_invalid");
      }
      captured[key] = descriptor.value;
    }
    assertProviderStrictEd25519CryptoCapabilityIdentityV1(
      ProviderStrictEd25519AttestationError,
      captured.strictCryptoCapability,
    );
    const { strictCryptoCapability: _strictCryptoCapability, ...jsonArtifacts } =
      captured;
    assertJsonDataTreeBeforeSchemaV1(jsonArtifacts);
    for (const value of objectValuesV1(jsonArtifacts)) {
      assertRecursivelyFrozenEvidenceJsonV1(value);
    }
    return captured;
  } catch (error) {
    if (error instanceof EvidencePointDiagnosticSignal) throw error;
    return fail("input", "schema_invalid");
  }
}

const REGISTRY_SIGNATURE_PATTERN_V1 =
  /^provider-registry-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;
const QA_SIGNATURE_PATTERN_V1 =
  /^provider-feasibility-ed25519:qa:([0-9a-f]{22}):([0-9a-f]{128})$/u;
const RELEASE_SIGNATURE_PATTERN_V1 =
  /^provider-feasibility-ed25519:release:([0-9a-f]{22}):([0-9a-f]{128})$/u;

type KeyRoleV1 = "qa" | "release";

function validateApproverIdentityV1(
  record: ProviderFeasibilityApproverPublicKeyV1,
  role: KeyRoleV1,
): void {
  const stage =
    role === "qa"
      ? "qa_approver_key_identity"
      : "release_approver_key_identity";
  if (record.role !== role) return fail(stage, "binding_mismatch");
  const keyId = deriveProviderFeasibilityApproverKeyIdV1({
    role: record.role,
    publicKeyBytes: record.publicKeyBytes,
  });
  if (record.keyId !== keyId) return fail(stage, "identity_mismatch");
  const digest = deriveProviderEd25519PublicKeyDigestInternalV1(
    record.publicKeyBytes,
  );
  if (record.publicKeyDigest !== digest) return fail(stage, "digest_mismatch");
}

function validateApproverRootV1(
  record: ProviderFeasibilityApproverPublicKeyV1,
  role: KeyRoleV1,
  activeRoot: ProviderRegistryRootPublicKeyV1,
): void {
  const stage =
    role === "qa" ? "qa_approver_key_root" : "release_approver_key_root";
  const match = regExpExecV1(
    REGISTRY_SIGNATURE_PATTERN_V1,
    record.registrySignature,
  );
  if (match?.[1] !== activeRoot.rootKeyId) {
    return fail(stage, "root_mismatch");
  }
  try {
    createProviderFeasibilityApproverPublicKeySignatureMessageV1(
      record,
      activeRoot.rootKeyId,
    );
  } catch {
    return fail(stage, "root_mismatch");
  }
}

async function admitApproverKeyV1(
  record: ProviderFeasibilityApproverPublicKeyV1,
  role: KeyRoleV1,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<void> {
  const stage =
    role === "qa"
      ? "qa_approver_key_admission"
      : "release_approver_key_admission";
  try {
    const accepted = await validateProviderStrictEd25519PointWithCapabilityV1(
      capability,
      decodeCanonicalPublicKeyBytes32V1(record.publicKeyBytes),
    );
    if (!accepted) return fail(stage, "public_key_invalid");
  } catch (error) {
    if (error instanceof EvidencePointDiagnosticSignal) throw error;
    return fail(stage, "public_key_invalid");
  }
}

async function verifyApproverRecordSignatureV1(
  record: ProviderFeasibilityApproverPublicKeyV1,
  role: KeyRoleV1,
  activeRoot: ProviderRegistryRootPublicKeyV1,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<void> {
  const stage =
    role === "qa"
      ? "qa_approver_key_signature"
      : "release_approver_key_signature";
  try {
    const match = regExpExecV1(
      REGISTRY_SIGNATURE_PATTERN_V1,
      record.registrySignature,
    );
    if (match?.[2] === undefined) return fail(stage, "signature_invalid");
    const message =
      createProviderFeasibilityApproverPublicKeySignatureMessageV1(
        record,
        activeRoot.rootKeyId,
      );
    const accepted = await verifyRawEd25519WithCapabilityV1(
      capability,
      decodeCanonicalPublicKeyBytes32V1(activeRoot.publicKeyBytes),
      message,
      lowerHexToBytesV1(match[2]),
    );
    if (!accepted) return fail(stage, "signature_invalid");
  } catch (error) {
    if (error instanceof EvidencePointDiagnosticSignal) throw error;
    return fail(stage, "signature_invalid");
  }
}

function timestampTupleV1(value: string): readonly number[] {
  const match = regExpExecV1(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/u,
    value,
  );
  if (match === null) throw new TypeError("timestamp is not canonical UTC");
  const fraction = (match[7] ?? "").padEnd(9, "0");
  return [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
    Number(fraction || "0"),
  ];
}

export function compareProviderFeasibilityEvidenceTimestampsV1(
  left: unknown,
  right: unknown,
): number {
  const leftTuple = timestampTupleV1(
    ProviderRegistryIsoTimestampV1Schema.parse(left),
  );
  const rightTuple = timestampTupleV1(
    ProviderRegistryIsoTimestampV1Schema.parse(right),
  );
  for (let index = 0; index < leftTuple.length; index += 1) {
    const difference = leftTuple[index]! - rightTuple[index]!;
    if (difference !== 0) return difference;
  }
  return 0;
}

function validateEvidenceSignatureBindingV1(
  evidence: ProviderFeasibilityEvidenceV1,
  record: ProviderFeasibilityApproverPublicKeyV1,
  role: KeyRoleV1,
): void {
  const bindingStage =
    role === "qa"
      ? "evidence_qa_signature_binding"
      : "evidence_release_signature_binding";
  const signature =
    role === "qa" ? evidence.qaSignature : evidence.releaseSignature;
  const pattern =
    role === "qa" ? QA_SIGNATURE_PATTERN_V1 : RELEASE_SIGNATURE_PATTERN_V1;
  const match = regExpExecV1(pattern, signature);
  if (match?.[1] !== record.keyId) {
    return fail(bindingStage, "binding_mismatch");
  }
}

async function verifyEvidenceSignatureV1(
  evidence: ProviderFeasibilityEvidenceV1,
  record: ProviderFeasibilityApproverPublicKeyV1,
  role: KeyRoleV1,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<void> {
  const signatureStage =
    role === "qa" ? "evidence_qa_signature" : "evidence_release_signature";
  const signature =
    role === "qa" ? evidence.qaSignature : evidence.releaseSignature;
  const pattern =
    role === "qa" ? QA_SIGNATURE_PATTERN_V1 : RELEASE_SIGNATURE_PATTERN_V1;
  const match = regExpExecV1(pattern, signature);
  if (match?.[2] === undefined) {
    return fail(signatureStage, "signature_invalid");
  }
  try {
    const message =
      role === "qa"
        ? createProviderFeasibilityEvidenceQaSignatureMessageV1(
            evidence,
            record.keyId,
          )
        : createProviderFeasibilityEvidenceReleaseSignatureMessageV1(
            evidence,
            record.keyId,
          );
    const accepted = await verifyRawEd25519WithCapabilityV1(
      capability,
      decodeCanonicalPublicKeyBytes32V1(record.publicKeyBytes),
      message,
      lowerHexToBytesV1(match[2]),
    );
    if (!accepted) return fail(signatureStage, "signature_invalid");
  } catch (error) {
    if (error instanceof EvidencePointDiagnosticSignal) throw error;
    return fail(signatureStage, "signature_invalid");
  }
}

type DiagnoseRuntimePointV1 = (
  input: ValidateProviderRuntimeAttestationPointClosureV1Input,
) => Promise<ProviderRuntimeAttestationPointClosureDiagnosticResultV1>;

function createPreparedRuntimePointInputV1(
  snapshot: SnapshotEvidencePointInputV1,
  capability: ProviderStrictEd25519OpaqueCapabilityV1,
): ValidateProviderRuntimeAttestationPointClosureV1Input {
  return createProviderNonThenableFrozenRecordV1({
    activeRoot: snapshot.activeRoot,
    activeRootMetadata: snapshot.activeRootMetadata,
    distributionRootBinding: snapshot.distributionRootBinding,
    fixtureCorpusManifest: snapshot.fixtureCorpusManifest,
    publicSupportTaxonomy: snapshot.publicSupportTaxonomy,
    realFilesystemConformanceResult:
      snapshot.realFilesystemConformanceResult,
    realFilesystemConformanceResultLocator:
      snapshot.realFilesystemConformanceResultLocator,
    realFilesystemConformanceResultPin:
      snapshot.realFilesystemConformanceResultPin,
    releaseMatrix: snapshot.releaseMatrix,
    runtimeAttestation: snapshot.runtimeAttestation,
    semanticProviderPolicy: snapshot.semanticProviderPolicy,
    strictCryptoCapability: capability,
    suiteManifest: snapshot.suiteManifest,
    targetDiscoveryFixtureManifest:
      snapshot.targetDiscoveryFixtureManifest,
    targetDiscoveryResult: snapshot.targetDiscoveryResult,
    targetDiscoveryRunnerRun: snapshot.targetDiscoveryRunnerRun,
  }) as unknown as ValidateProviderRuntimeAttestationPointClosureV1Input;
}

async function validateEvidencePointClosureFromSnapshotInternalV1(
  snapshot: SnapshotEvidencePointInputV1,
  diagnoseRuntimePoint: DiagnoseRuntimePointV1,
  approverRecordTrust: ApproverRecordTrustV1,
): Promise<ProviderFeasibilityEvidencePointClosureValidationV1> {
  const capability =
    snapshot.strictCryptoCapability as ProviderStrictEd25519OpaqueCapabilityV1;

  const runtimeDiagnostic =
    await diagnoseRuntimePoint(
      createPreparedRuntimePointInputV1(snapshot, capability),
    );
  if (!runtimeDiagnostic.ok) {
    return fail("runtime_attestation_closure", "source_invalid");
  }
  const runtimeAttestationPointClosure = runtimeDiagnostic.value;

  let evidenceEnvelope: ProviderFeasibilityEvidenceEnvelopeV1;
  try {
    evidenceEnvelope = ProviderFeasibilityEvidenceEnvelopeV1Schema.parse(
      snapshot.providerFeasibilityEvidence,
    );
  } catch {
    return fail("evidence_structure", "schema_invalid");
  }
  let evidencePin: ProviderFeasibilityEvidencePinV1;
  try {
    evidencePin = ProviderFeasibilityEvidencePinV1Schema.parse(
      snapshot.providerFeasibilityEvidencePin,
    );
  } catch {
    return fail("evidence_pin_structure", "schema_invalid");
  }
  let qaApproverPublicKey: ProviderFeasibilityApproverPublicKeyV1;
  try {
    qaApproverPublicKey = ProviderFeasibilityApproverPublicKeyV1Schema.parse(
      snapshot.qaApproverPublicKey,
    );
  } catch {
    return fail("qa_approver_key_structure", "schema_invalid");
  }
  let releaseApproverPublicKey: ProviderFeasibilityApproverPublicKeyV1;
  try {
    releaseApproverPublicKey =
      ProviderFeasibilityApproverPublicKeyV1Schema.parse(
        snapshot.releaseApproverPublicKey,
      );
  } catch {
    return fail("release_approver_key_structure", "schema_invalid");
  }

  validateApproverIdentityV1(qaApproverPublicKey, "qa");
  validateApproverIdentityV1(releaseApproverPublicKey, "release");

  let activeRoot: ProviderRegistryRootPublicKeyV1;
  let resultEnvelope: ReturnType<
    typeof ProviderRealFilesystemConformanceResultEnvelopeV1Schema.parse
  >;
  try {
    activeRoot = ProviderRegistryRootPublicKeyV1Schema.parse(
      snapshot.activeRoot,
    );
    resultEnvelope =
      ProviderRealFilesystemConformanceResultEnvelopeV1Schema.parse(
        snapshot.realFilesystemConformanceResult,
      );
  } catch {
    return fail("runtime_attestation_closure", "source_invalid");
  }

  if (
    qaApproverPublicKey.publicKeyBytes ===
      releaseApproverPublicKey.publicKeyBytes ||
    qaApproverPublicKey.publicKeyBytes === activeRoot.publicKeyBytes ||
    releaseApproverPublicKey.publicKeyBytes === activeRoot.publicKeyBytes
  ) {
    return fail("approver_key_separation", "binding_mismatch");
  }

  if (approverRecordTrust === VERIFY_APPROVER_RECORD_ROOT_SIGNATURES_V1) {
    validateApproverRootV1(qaApproverPublicKey, "qa", activeRoot);
    validateApproverRootV1(releaseApproverPublicKey, "release", activeRoot);
  } else if (approverRecordTrust !== REGISTRY_TRUSTED_APPROVER_RECORDS_V1) {
    return fail("input", "schema_invalid");
  }
  await admitApproverKeyV1(qaApproverPublicKey, "qa", capability);
  await admitApproverKeyV1(releaseApproverPublicKey, "release", capability);
  if (approverRecordTrust === VERIFY_APPROVER_RECORD_ROOT_SIGNATURES_V1) {
    await verifyApproverRecordSignatureV1(
      qaApproverPublicKey,
      "qa",
      activeRoot,
      capability,
    );
    await verifyApproverRecordSignatureV1(
      releaseApproverPublicKey,
      "release",
      activeRoot,
      capability,
    );
  }

  const evidence = evidenceEnvelope.payload;
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
    return fail("evidence_result_binding", "binding_mismatch");
  }
  if (
    !canonicalEqualV1(
      evidence.realFilesystemConformanceResult,
      runtimeAttestationPointClosure.conformanceResultClosure.result,
    )
  ) {
    return fail("evidence_result_binding", "pin_mismatch");
  }
  if (
    evidence.realFilesystemConformanceResultDigest !==
    resultEnvelope.contentDigest
  ) {
    return fail("evidence_result_binding", "digest_mismatch");
  }

  const policy = runtimeAttestationPointClosure.semanticProviderPolicy;
  if (
    evidence.isolationSecurityBoundaryProfileDigest !==
      policy.isolation.securityBoundaryProfileDigest ||
    evidence.ipcPeerAuthenticationPolicyDigest !==
      policy.ipcPeerAuthenticationPolicyDigest ||
    evidence.realFilesystemSuiteDigest !==
      policy.realFilesystemConformanceSuiteDigest
  ) {
    return fail("evidence_policy_binding", "digest_mismatch");
  }

  if (
    evidence.runtimeAttestationContentDigest !==
      runtimeAttestationPointClosure.runtimeAttestation.contentDigest ||
    evidence.realFilesystemConformanceResultDigest !==
      runtimeAttestationPointClosure.runtimeAttestation.payload
        .realFilesystemConformanceResultDigest
  ) {
    return fail("evidence_runtime_binding", "digest_mismatch");
  }

  if (
    compareProviderFeasibilityEvidenceTimestampsV1(
      evidence.issuedAt,
      result.completedAt,
    ) < 0
  ) {
    return fail("evidence_time", "ordering_invalid");
  }

  const derivedEvidenceId = deriveProviderFeasibilityEvidenceIdV1(evidence);
  if (evidence.evidenceId !== derivedEvidenceId) {
    return fail("evidence_id", "identity_mismatch");
  }

  validateEvidenceSignatureBindingV1(
    evidence,
    qaApproverPublicKey,
    "qa",
  );
  validateEvidenceSignatureBindingV1(
    evidence,
    releaseApproverPublicKey,
    "release",
  );
  await verifyEvidenceSignatureV1(
    evidence,
    qaApproverPublicKey,
    "qa",
    capability,
  );
  await verifyEvidenceSignatureV1(
    evidence,
    releaseApproverPublicKey,
    "release",
    capability,
  );

  const contentDigest =
    deriveProviderFeasibilityEvidenceContentDigestV1(evidence);
  if (evidenceEnvelope.contentDigest !== contentDigest) {
    return fail("evidence_digest", "digest_mismatch");
  }
  if (
    evidenceEnvelope.evidenceId !== evidence.evidenceId ||
    evidenceEnvelope.evidenceId !== derivedEvidenceId
  ) {
    return fail("evidence_envelope", "envelope_mismatch");
  }
  if (
    evidencePin.evidenceId !== evidenceEnvelope.evidenceId ||
    evidencePin.contentDigest !== evidenceEnvelope.contentDigest
  ) {
    return fail("evidence_pin", "pin_mismatch");
  }

  const relativePath = buildProviderFeasibilityEvidenceRelativePathV1(
    evidencePin,
  );
  const closureFields = deepFreezeV1({
    authority: "none_provider_feasibility_evidence_structure_only" as const,
    runtimeAttestationPointClosure,
    providerFeasibilityEvidence: evidenceEnvelope,
    providerFeasibilityEvidencePin: evidencePin,
    relativePath,
    qaApproverPublicKey,
    releaseApproverPublicKey,
  });
  return createProviderNonThenableFrozenRecordV1(closureFields);
}

async function validateEvidencePointClosureInternalV1(
  input: unknown,
): Promise<ProviderFeasibilityEvidencePointClosureValidationV1> {
  return validateEvidencePointClosureFromSnapshotInternalV1(
    snapshotEvidencePointInputV1(input),
    diagnoseProviderRuntimeAttestationPointClosureV1,
    VERIFY_APPROVER_RECORD_ROOT_SIGNATURES_V1,
  );
}

function createEvidencePointDiagnosticFailureV1(
  stage: ProviderFeasibilityEvidencePointInvalidStageV1,
  reason: ProviderFeasibilityEvidencePointInvalidReasonV1,
): EvidencePointDiagnosticFailureV1 {
  return createProviderNonThenableFrozenRecordV1({
    ok: false as const,
    stage,
    reason,
  });
}

function createEvidencePointDiagnosticFailureFromErrorV1(
  error: unknown,
): EvidencePointDiagnosticFailureV1 {
  if (error instanceof EvidencePointDiagnosticSignal) {
    return createEvidencePointDiagnosticFailureV1(error.stage, error.reason);
  }
  return createEvidencePointDiagnosticFailureV1("input", "schema_invalid");
}

function diagnosePreparedEvidencePointCoreWithApproverTrustV1(
  input: ValidateProviderFeasibilityEvidencePointClosureV1Input,
  approverRecordTrust: ApproverRecordTrustV1,
): Promise<ProviderFeasibilityEvidencePointClosureDiagnosticResultV1> {
  let snapshot: SnapshotEvidencePointInputV1;
  try {
    snapshot = snapshotPreparedEvidencePointInputV1(input);
  } catch (error) {
    return createProviderPointFulfilledPromiseV1(
      createEvidencePointDiagnosticFailureFromErrorV1(error),
    );
  }
  const operation = hardenProviderPointPromiseV1(
    validateEvidencePointClosureFromSnapshotInternalV1(
      snapshot,
      diagnoseProviderRuntimeAttestationPointPreparedInternalV1,
      approverRecordTrust,
    ),
  );
  return operation.then(
    (value): EvidencePointDiagnosticSuccessV1 =>
      createProviderNonThenableFrozenRecordV1({
        ok: true as const,
        value,
      }),
    createEvidencePointDiagnosticFailureFromErrorV1,
  );
}

function diagnosePreparedEvidencePointCoreV1(
  input: ValidateProviderFeasibilityEvidencePointClosureV1Input,
): Promise<ProviderFeasibilityEvidencePointClosureDiagnosticResultV1> {
  return diagnosePreparedEvidencePointCoreWithApproverTrustV1(
    input,
    VERIFY_APPROVER_RECORD_ROOT_SIGNATURES_V1,
  );
}

function diagnoseRegistryTrustedPreparedEvidencePointCoreV1(
  input: ValidateProviderFeasibilityEvidencePointClosureV1Input,
): Promise<ProviderFeasibilityEvidencePointClosureDiagnosticResultV1> {
  return diagnosePreparedEvidencePointCoreWithApproverTrustV1(
    input,
    REGISTRY_TRUSTED_APPROVER_RECORDS_V1,
  );
}

export async function diagnoseProviderFeasibilityEvidencePointClosureV1(
  input: unknown,
): Promise<ProviderFeasibilityEvidencePointClosureDiagnosticResultV1> {
  try {
    return {
      ok: true,
      value: await validateEvidencePointClosureInternalV1(input),
    };
  } catch (error) {
    if (error instanceof EvidencePointDiagnosticSignal) {
      return { ok: false, stage: error.stage, reason: error.reason };
    }
    return { ok: false, stage: "input", reason: "schema_invalid" };
  }
}

export async function validateProviderFeasibilityEvidencePointClosureV1(
  input: ValidateProviderFeasibilityEvidencePointClosureV1Input,
): Promise<ProviderFeasibilityEvidencePointClosureValidationV1> {
  const diagnostic =
    await diagnoseProviderFeasibilityEvidencePointClosureV1(input);
  if (!diagnostic.ok) {
    throw new ProviderFeasibilityEvidencePointClosureValidationError();
  }
  return diagnostic.value;
}

registerProviderFeasibilityEvidencePointPreparedCoreInternalV1(
  diagnosePreparedEvidencePointCoreV1,
);
registerProviderFeasibilityEvidencePointRegistryTrustedPreparedCoreInternalV1(
  diagnoseRegistryTrustedPreparedEvidencePointCoreV1,
);
