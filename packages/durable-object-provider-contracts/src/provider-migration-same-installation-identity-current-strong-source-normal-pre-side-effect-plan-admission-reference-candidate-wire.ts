import { z } from "./zod-runtime.js";

import {
  assertDataObjectDescriptorsBeforeSchemaV1,
  assertJsonDataTreeBeforeSchemaV1,
} from "./domain-crypto.js";
import { canonicalizeJcsSafeIntegerV1 } from "./jcs.js";
import {
  CanonicalByteStringV1Schema,
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  LowerHex32V1Schema,
  ProviderTargetProfileIdV1Schema,
  type ContentDigestV1,
} from "./primitives.js";
import {
  ProviderFeasibilityEvidenceEnvelopeV1Schema,
  deriveProviderFeasibilityEvidenceContentDigestV1,
  deriveProviderFeasibilityEvidenceIdV1,
  deriveProviderFeasibilityEvidencePinV1,
} from "./provider-feasibility-evidence-point.js";
import {
  ProviderFeasibilitySupportCandidateV1Schema,
  ProviderFeasibilitySupportCatalogEnvelopeV1Schema,
  ProviderFeasibilitySupportCatalogPinV1Schema,
  deriveProviderFeasibilitySupportCatalogPinV1,
} from "./provider-feasibility-support-catalog-point.js";
import {
  deepFreezeProviderPointDetachedDataTreeV1,
} from "./provider-point-raw-admission-internal.js";
import {
  ProviderRegistryManifestEnvelopeV1Schema,
  ProviderRegistryManifestPinV1Schema,
  StoreDurableObjectProviderRegistryEntryV1Schema,
  deriveProviderRegistryManifestContentDigestV1,
  deriveProviderRegistryManifestGenerationIdV1,
  deriveStoreDurableObjectProviderRegistryEntryContentDigestV1,
} from "./provider-registry-records.js";
import {
  ProviderRegistryIsoTimestampV1Schema,
  ProviderRegistryRootMetadataPinV1Schema,
} from "./provider-registry-trust.js";
import { deriveStoreDurableObjectProviderPolicyDigestV1 } from "./provider-runtime-attestation-point.js";
import {
  ProviderReleaseTargetUniverseEnvelopeV1Schema,
  ProviderReleaseTargetUniversePinV1Schema,
  deriveProviderReleaseTargetUniverseContentDigestV1,
} from "./provider-release-target-universe-point.js";
import {
  ProviderActiveWriterSelectionV1Schema,
  ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
} from "./provider-strong-ready-acceptance-candidate.js";
import {
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentReadReferenceCandidateV1Schema,
} from "./provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-reference-candidate-wire.js";
import { ProviderFeasibilityTargetV1Schema } from "./provider-target-discovery-point.js";
import { sha256InternalV1 } from "./sha256.js";

const CapturedArrayV1 = Array;
const CapturedArrayIsArrayV1 = Array.isArray;
const CapturedArrayPrototypePushV1 = Array.prototype.push;
const CapturedDateV1 = Date;
const CapturedDatePrototypeToISOStringV1 = Date.prototype.toISOString;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedNumberIsSafeIntegerV1 = Number.isSafeInteger;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 = Object.getOwnPropertyDescriptor;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedRegExpPrototypeExecV1 = RegExp.prototype.exec;
const CapturedSetV1 = Set;
const CapturedSetPrototypeAddV1 = Set.prototype.add;
const CapturedSetPrototypeHasV1 = Set.prototype.has;
const CapturedStringPrototypeSliceV1 = String.prototype.slice;
const CapturedTextEncoderV1 = TextEncoder;
const CapturedTextEncoderPrototypeEncodeV1 = TextEncoder.prototype.encode;
const CapturedTypeErrorV1 = TypeError;
const CapturedUint8ArrayV1 = Uint8Array;
const CapturedTypedArrayPrototypeV1 = CapturedObjectGetPrototypeOfV1(
  CapturedUint8ArrayV1.prototype,
);
const CapturedTypedArrayByteLengthGetterCandidateV1 =
  CapturedObjectGetOwnPropertyDescriptorV1(
    CapturedTypedArrayPrototypeV1,
    "byteLength",
  )?.get;

if (CapturedTypedArrayByteLengthGetterCandidateV1 === undefined) {
  throw new CapturedTypeErrorV1("Uint8Array byteLength primordial unavailable");
}

function bindUncurriedAtBootstrapV1(method: Function): Function {
  return CapturedObjectFreezeV1(
    CapturedReflectApplyV1(
      CapturedFunctionPrototypeBindV1,
      CapturedFunctionPrototypeCallV1,
      CapturedObjectFreezeV1([method]),
    ) as Function,
  );
}

const typedArrayByteLengthV1 = bindUncurriedAtBootstrapV1(
  CapturedTypedArrayByteLengthGetterCandidateV1,
) as (value: Uint8Array) => number;
const stringSliceV1 = bindUncurriedAtBootstrapV1(
  CapturedStringPrototypeSliceV1,
) as (value: string, start?: number, end?: number) => string;
const dateToISOStringV1 = bindUncurriedAtBootstrapV1(
  CapturedDatePrototypeToISOStringV1,
) as (value: Date) => string;
const CapturedUtf8EncoderV1 = CapturedObjectFreezeV1(
  new CapturedTextEncoderV1(),
);

function setHasV1<T>(set: ReadonlySet<T>, value: T): boolean {
  return CapturedReflectApplyV1(CapturedSetPrototypeHasV1, set, [value]) as boolean;
}

function setAddV1<T>(set: Set<T>, value: T): void {
  CapturedReflectApplyV1(CapturedSetPrototypeAddV1, set, [value]);
}

function arrayPushV1<T>(array: T[], value: T): number {
  return CapturedReflectApplyV1(CapturedArrayPrototypePushV1, array, [value]) as number;
}

function regExpTestV1(pattern: RegExp, value: string): boolean {
  return CapturedReflectApplyV1(CapturedRegExpPrototypeExecV1, pattern, [value]) !== null;
}

function encodeUtf8V1(value: string): Uint8Array {
  return CapturedReflectApplyV1(
    CapturedTextEncoderPrototypeEncodeV1,
    CapturedUtf8EncoderV1,
    [value],
  ) as Uint8Array;
}

function bytesToLowerHexV1(bytes: Uint8Array): string {
  const alphabet = "0123456789abcdef";
  let output = "";
  const length = typedArrayByteLengthV1(bytes);
  for (let index = 0; index < length; index += 1) {
    const byte = bytes[index]!;
    output += alphabet[(byte >>> 4) & 0x0f]! + alphabet[byte & 0x0f]!;
  }
  return output;
}

function canonicalStringV1(value: unknown): string {
  return canonicalizeJcsSafeIntegerV1(value);
}

function canonicalByteLengthV1(value: unknown): number {
  return typedArrayByteLengthV1(encodeUtf8V1(canonicalStringV1(value)));
}

function compareUtf8StringsV1(left: string, right: string): number {
  const leftBytes = encodeUtf8V1(left);
  const rightBytes = encodeUtf8V1(right);
  const leftLength = typedArrayByteLengthV1(leftBytes);
  const rightLength = typedArrayByteLengthV1(rightBytes);
  const limit = leftLength < rightLength ? leftLength : rightLength;
  for (let index = 0; index < limit; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!;
    if (difference !== 0) return difference;
  }
  return leftLength - rightLength;
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  return canonicalStringV1(left) === canonicalStringV1(right);
}

function domainPreimageBytesV1(domain: string, fields: object): Uint8Array {
  return encodeUtf8V1(canonicalStringV1([domain, fields]));
}

function digestForDomainV1(domain: string, fields: object): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHexV1(
      sha256InternalV1(domainPreimageBytesV1(domain, fields)),
    )}`,
  );
}

function shortHex22ForDomainV1(domain: string, fields: object): string {
  return stringSliceV1(
    bytesToLowerHexV1(
      sha256InternalV1(domainPreimageBytesV1(domain, fields)),
    ),
    0,
    22,
  );
}

function parseJsonFieldsV1<T>(schema: z.ZodType<T>, input: unknown): T {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  return schema.parse(input);
}

function freezeParsedJsonV1<T extends object>(value: T): T {
  return deepFreezeProviderPointDetachedDataTreeV1(value);
}

function addIssueV1(
  context: z.RefinementCtx,
  path: (string | number)[],
  message: string,
): void {
  context.addIssue({ code: "custom", path, message });
}

function checkedAddInternalV1(left: number, right: number): number {
  if (
    !CapturedNumberIsSafeIntegerV1(left) ||
    !CapturedNumberIsSafeIntegerV1(right) ||
    left < 0 ||
    right < 0 ||
    left > Number.MAX_SAFE_INTEGER - right
  ) {
    throw new CapturedTypeErrorV1("non-negative safe-integer addition overflow");
  }
  return left + right;
}

function checkedMultiplyInternalV1(left: number, right: number): number {
  if (
    !CapturedNumberIsSafeIntegerV1(left) ||
    !CapturedNumberIsSafeIntegerV1(right) ||
    left < 0 ||
    right < 0 ||
    (left !== 0 && right > Number.MAX_SAFE_INTEGER / left)
  ) {
    throw new CapturedTypeErrorV1("non-negative safe-integer multiplication overflow");
  }
  return left * right;
}

export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PRE_SIDE_EFFECT_REQUEST_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-request-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_ENDPOINT_TRUST_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-endpoint-trust-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PROSPECTIVE_DESTINATION_CUT_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-prospective-destination-cut-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_STORE_MANIFEST_CURRENT_CUT_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-store-manifest-current-cut-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_STORE_PROVIDER_BINDING_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-store-provider-binding-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_STORE_MANIFEST_ABSENCE_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-store-manifest-absence-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_NAMESPACE_TRANSLATION_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-namespace-translation-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_LIVE_ROOT_SET_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-live-root-set-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_LIVE_OBJECT_SET_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-live-object-set-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_LIVE_REFERENCE_SET_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-live-reference-set-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_COMPLETE_SOURCE_READ_CLOSURE_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-complete-source-read-closure-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PRE_SIDE_EFFECT_BUDGETS_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-budgets-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_HISTORY_ARTIFACT_UPPER_BOUND_SET_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-history-artifact-upper-bound-set-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_SOURCE_DRY_RUN_CUT_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-source-dry-run-cut-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_HISTORY_QUOTA_SIZING_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-history-quota-sizing-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_ACCOUNT_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-quota-account-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_ACCOUNT_SET_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-quota-account-set-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_ACCOUNT_STATE_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-quota-account-state-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_SNAPSHOT_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-quota-snapshot-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RESERVATION_ENVELOPE_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-quota-reservation-envelope-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_EVENT_ENVELOPE_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-quota-event-envelope-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RECEIPT_ENVELOPE_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-quota-receipt-envelope-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RESERVATION_SET_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-quota-reservation-set-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_EVENT_SET_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-quota-event-set-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RECEIPT_SET_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-quota-receipt-set-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_LEDGER_RECORD_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-quota-ledger-record-token-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_HIGH_WATER_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-quota-high-water-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_HIGH_WATER_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-quota-high-water-token-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_HISTORY_QUOTA_ADMISSION_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-history-quota-admission-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PRE_SIDE_EFFECT_PLAN_ADMISSION_CLOSURE_REFERENCE_CANDIDATE_ID_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-closure-reference-candidate-id-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PRE_SIDE_EFFECT_HISTORY_QUOTA_RESERVATION_REFERENCE_CANDIDATE_ID_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-history-quota-reservation-reference-candidate-id-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PLAN_PAYLOAD_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-plan-payload-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_OBSERVATION_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-quota-observation-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PRE_POST_OBSERVATION_EQUALITY_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-pre-post-observation-equality-reference-candidate-v1" as const;
export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PRE_SIDE_EFFECT_PLAN_ADMISSION_CLOSURE_REFERENCE_CANDIDATE_DOMAIN_V1 = "provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-closure-reference-candidate-v1" as const;

export const PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_REFERENCE_CANDIDATE_DOMAINS_V1 = CapturedObjectFreezeV1([
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PRE_SIDE_EFFECT_REQUEST_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_ENDPOINT_TRUST_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PROSPECTIVE_DESTINATION_CUT_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_STORE_MANIFEST_CURRENT_CUT_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_STORE_PROVIDER_BINDING_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_STORE_MANIFEST_ABSENCE_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_NAMESPACE_TRANSLATION_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_LIVE_ROOT_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_LIVE_OBJECT_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_LIVE_REFERENCE_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_COMPLETE_SOURCE_READ_CLOSURE_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PRE_SIDE_EFFECT_BUDGETS_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_HISTORY_ARTIFACT_UPPER_BOUND_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_SOURCE_DRY_RUN_CUT_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_HISTORY_QUOTA_SIZING_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_ACCOUNT_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_ACCOUNT_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_ACCOUNT_STATE_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_SNAPSHOT_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RESERVATION_ENVELOPE_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_EVENT_ENVELOPE_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RECEIPT_ENVELOPE_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RESERVATION_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_EVENT_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RECEIPT_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_LEDGER_RECORD_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_HIGH_WATER_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_HIGH_WATER_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_HISTORY_QUOTA_ADMISSION_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PRE_SIDE_EFFECT_PLAN_ADMISSION_CLOSURE_REFERENCE_CANDIDATE_ID_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PRE_SIDE_EFFECT_HISTORY_QUOTA_RESERVATION_REFERENCE_CANDIDATE_ID_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PLAN_PAYLOAD_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_OBSERVATION_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PRE_POST_OBSERVATION_EQUALITY_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PRE_SIDE_EFFECT_PLAN_ADMISSION_CLOSURE_REFERENCE_CANDIDATE_DOMAIN_V1,
] as const);

const NonnegativeSafeIntegerV1Schema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const PositiveSafeIntegerV1Schema = NonnegativeSafeIntegerV1Schema.min(1);
const OrdinalV1Schema = NonnegativeSafeIntegerV1Schema;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRepositoryReferenceCandidateIdV1Schema = z.string().regex(/^provider-migration-same-installation-identity-current-strong-source-normal-repository-reference-candidate:[0-9a-f]{64}$/u).brand<"ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRepositoryReferenceCandidateIdV1">();
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRepositoryReferenceCandidateIdV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRepositoryReferenceCandidateIdV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalWorktreeReferenceCandidateIdV1Schema = z.string().regex(/^provider-migration-same-installation-identity-current-strong-source-normal-worktree-reference-candidate:[0-9a-f]{64}$/u).brand<"ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalWorktreeReferenceCandidateIdV1">();
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalWorktreeReferenceCandidateIdV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalWorktreeReferenceCandidateIdV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateIdV1Schema = z.string().regex(/^provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-closure-reference-candidate:[0-9a-f]{22}$/u).brand<"ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateIdV1">();
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateIdV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateIdV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectHistoryQuotaReservationReferenceCandidateIdV1Schema = z.string().regex(/^provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-history-quota-reservation-reference-candidate:[0-9a-f]{22}$/u).brand<"ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectHistoryQuotaReservationReferenceCandidateIdV1">();
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectHistoryQuotaReservationReferenceCandidateIdV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectHistoryQuotaReservationReferenceCandidateIdV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestGenerationReferenceCandidateIdV1Schema = z.string().regex(/^provider-migration-same-installation-identity-current-strong-source-normal-store-manifest-generation-reference-candidate:[0-9a-f]{22}$/u).brand<"ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestGenerationReferenceCandidateIdV1">();
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestGenerationReferenceCandidateIdV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestGenerationReferenceCandidateIdV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCreatedAtReferenceCandidateV1Schema = ProviderRegistryIsoTimestampV1Schema.refine(
  (value) => {
    if (!regExpTestV1(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u, value)) return false;
    try {
      return dateToISOStringV1(new CapturedDateV1(value)) === value;
    } catch {
      return false;
    }
  },
  "createdAt must be the canonical 24-byte millisecond UTC form",
).brand<"ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCreatedAtReferenceCandidateV1">();
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCreatedAtReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCreatedAtReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceReferenceCandidateV1Schema = z.strictObject({
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1Schema,
  repositoryId: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRepositoryReferenceCandidateIdV1Schema,
  worktreeId: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalWorktreeReferenceCandidateIdV1Schema,
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceCandidateV1Schema = z.strictObject({
  targetProfileId: ProviderTargetProfileIdV1Schema,
  providerId: DurableObjectIdentityProviderIdV1Schema,
  registryEntryContentDigest: ContentDigestV1Schema,
  semanticProviderPolicyDigest: ContentDigestV1Schema,
  providerFeasibilityEvidence: ProviderFeasibilitySupportCandidateV1Schema.shape.providerFeasibilityEvidence,
  runtimeAttestationContentDigest: ContentDigestV1Schema,
  bindingDerivationKeyGeneration: PositiveSafeIntegerV1Schema,
  bindingReferenceDigest: ContentDigestV1Schema,
}).superRefine((binding, context) => {
  if (binding.bindingReferenceDigest !== deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceDigestReferenceCandidateV1(binding)) {
    addIssueV1(context, ["bindingReferenceDigest"], "bindingReferenceDigest must bind the exact seven-field writer projection");
  }
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1Schema = z.strictObject({
  profile: z.literal("provider_migration_same_installation_identity_current_strong_source_normal_store_manifest_current_cut_reference_candidate_v1"),
  namespace: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceReferenceCandidateV1Schema,
  providerBinding: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceCandidateV1Schema,
  namespaceRevision: PositiveSafeIntegerV1Schema,
  headContentDigest: ContentDigestV1Schema,
  currentVersionReferenceDigest: ContentDigestV1Schema,
  generationCount: PositiveSafeIntegerV1Schema,
  generationSetDigest: ContentDigestV1Schema,
  currentGeneration: z.strictObject({
    generationOrdinal: PositiveSafeIntegerV1Schema,
    generationReferenceId: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestGenerationReferenceCandidateIdV1Schema,
    contentDigest: ContentDigestV1Schema,
  }),
  cutContentDigest: ContentDigestV1Schema,
}).superRefine((cut, context) => {
  if (cut.namespaceRevision !== cut.generationCount || cut.currentGeneration.generationOrdinal !== cut.generationCount) {
    addIssueV1(context, ["currentGeneration", "generationOrdinal"], "current generation, generation count, and namespace revision must be equal");
  }
  if (cut.currentGeneration.contentDigest !== cut.headContentDigest) {
    addIssueV1(context, ["headContentDigest"], "head content digest must equal current generation content digest");
  }
  if (cut.cutContentDigest !== deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutContentDigestReferenceCandidateV1(cut)) {
    addIssueV1(context, ["cutContentDigest"], "Store cut digest must bind the complete current cut projection");
  }
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1Schema = z.strictObject({
  profile: z.literal("provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_budgets_reference_candidate_v1"),
  maxRootEntries: PositiveSafeIntegerV1Schema.max(65_536),
  maxLiveObjects: PositiveSafeIntegerV1Schema.max(1_000_000),
  maxReferenceEdges: PositiveSafeIntegerV1Schema.max(4_000_000),
  maxRewriteObjects: PositiveSafeIntegerV1Schema.max(1_000_000),
  maxRewriteReferenceMappings: PositiveSafeIntegerV1Schema.max(4_000_000),
  maxRewriteSccs: PositiveSafeIntegerV1Schema.max(1_000_000),
  maxLogicalObjectBytesTotal: PositiveSafeIntegerV1Schema.max(4_398_046_511_104),
  maxProgressRecords: PositiveSafeIntegerV1Schema.max(2_000_016),
  maxProgressOperationReceipts: PositiveSafeIntegerV1Schema.max(4_000_000),
  maxCanonicalUniverseBytes: PositiveSafeIntegerV1Schema.max(1_073_741_824),
  maxCanonicalReferenceSetBytes: PositiveSafeIntegerV1Schema.max(1_073_741_824),
  maxCanonicalRewritePlanBytes: PositiveSafeIntegerV1Schema.max(1_073_741_824),
  maxCanonicalRewrittenReferenceSetBytesTotal: PositiveSafeIntegerV1Schema.max(1_073_741_824),
  maxCanonicalSemanticEquivalenceProofBytesTotal: PositiveSafeIntegerV1Schema.max(1_073_741_824),
  maxCanonicalRootRewriteProofSetBytes: PositiveSafeIntegerV1Schema.max(1_073_741_824),
  maxCanonicalZeroLiveProofBytes: PositiveSafeIntegerV1Schema.max(1_073_741_824),
  maxCanonicalReceiptBytesTotal: PositiveSafeIntegerV1Schema.max(1_073_741_824),
  maxCanonicalProgressRecordSetBytes: PositiveSafeIntegerV1Schema.max(1_073_741_824),
  maxCanonicalProgressOperationReceiptBytesTotal: PositiveSafeIntegerV1Schema.max(1_073_741_824),
  maxCanonicalMigrationBytesTotal: PositiveSafeIntegerV1Schema.max(4_294_967_296),
  maxRetainedMigrationHistoryLogicalBytesTotal: PositiveSafeIntegerV1Schema.max(4_294_967_296),
  maxRetainedMigrationHistoryProviderAllocatedBytesTotal: PositiveSafeIntegerV1Schema.max(8_589_934_592),
  maxSingleRecordBytes: z.literal(4_194_304),
}).superRefine((budgets, context) => {
  if (budgets.maxRewriteObjects > budgets.maxLiveObjects) addIssueV1(context, ["maxRewriteObjects"], "rewrite objects cannot exceed live objects");
  if (budgets.maxRewriteReferenceMappings > budgets.maxReferenceEdges) addIssueV1(context, ["maxRewriteReferenceMappings"], "rewrite mappings cannot exceed reference edges");
  if (budgets.maxRewriteSccs > budgets.maxRewriteObjects) addIssueV1(context, ["maxRewriteSccs"], "rewrite SCCs cannot exceed rewrite objects");
  if (budgets.maxProgressRecords < 2 * budgets.maxLiveObjects + 7) addIssueV1(context, ["maxProgressRecords"], "progress record budget must cover 2 * live objects + 7");
  if (budgets.maxRetainedMigrationHistoryLogicalBytesTotal > budgets.maxCanonicalMigrationBytesTotal) addIssueV1(context, ["maxRetainedMigrationHistoryLogicalBytesTotal"], "retained logical bytes cannot exceed canonical migration bytes");
  const componentKeys = [
    "maxCanonicalReferenceSetBytes",
    "maxCanonicalRewritePlanBytes",
    "maxCanonicalRewrittenReferenceSetBytesTotal",
    "maxCanonicalSemanticEquivalenceProofBytesTotal",
    "maxCanonicalRootRewriteProofSetBytes",
    "maxCanonicalZeroLiveProofBytes",
    "maxCanonicalReceiptBytesTotal",
    "maxCanonicalProgressRecordSetBytes",
    "maxCanonicalProgressOperationReceiptBytesTotal",
  ] as const;
  for (let index = 0; index < componentKeys.length; index += 1) {
    const key = componentKeys[index]!;
    if (budgets[key] > budgets.maxCanonicalMigrationBytesTotal) addIssueV1(context, [key], "component budget cannot exceed canonical migration total");
  }
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestReferenceCandidateV1Schema = z.strictObject({
  profile: z.literal("provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_request_reference_candidate_v1"),
  mode: z.literal("same_installation_identity"),
  reason: z.literal("provider_decommission"),
  admissionClass: z.literal("normal"),
  createdAt: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCreatedAtReferenceCandidateV1Schema,
  migrationBudgets: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1Schema,
  liveReferenceSchemaDigest: ContentDigestV1Schema,
  migrationProtocolDigest: ContentDigestV1Schema,
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustCommonReferenceCandidateV1Schema = z.strictObject({
  profile: z.literal("provider_migration_same_installation_identity_current_strong_source_normal_endpoint_trust_reference_candidate_v1"),
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1Schema,
  currentAcceptanceRead: ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentReadReferenceCandidateV1Schema,
  retainedAcceptanceGenerations: z.array(ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema).min(1).max(4_096),
  targetProfileId: ProviderTargetProfileIdV1Schema,
  trustClosureContentDigest: ContentDigestV1Schema,
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustCommonReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustCommonReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveWriterProjectionReferenceCandidateV1Schema = z.strictObject({
  targetProfileId: ProviderTargetProfileIdV1Schema,
  providerId: DurableObjectIdentityProviderIdV1Schema,
  registryEntryContentDigest: ContentDigestV1Schema,
  semanticProviderPolicyDigest: ContentDigestV1Schema,
  providerFeasibilityEvidence: ProviderFeasibilitySupportCandidateV1Schema.shape.providerFeasibilityEvidence,
  runtimeAttestationContentDigest: ContentDigestV1Schema,
  bindingDerivationKeyGeneration: PositiveSafeIntegerV1Schema,
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveWriterProjectionReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveWriterProjectionReferenceCandidateV1Schema>;

const ProspectiveRegistryEntryV1Schema = StoreDurableObjectProviderRegistryEntryV1Schema.refine(
  (entry) => entry.registryGeneration === 1,
  "prospective Registry Entry must be a generation-one genesis Entry",
);
const ProspectiveSupportCandidateV1Schema = ProviderFeasibilitySupportCandidateV1Schema.extend({
  releaseDisposition: z.literal("strong_read_write"),
});

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutReferenceCandidateV1Schema = z.strictObject({
  profile: z.literal("provider_migration_same_installation_identity_current_strong_source_normal_prospective_destination_cut_reference_candidate_v1"),
  activeRootMetadata: ProviderRegistryRootMetadataPinV1Schema,
  currentSteadyRegistryManifestPin: ProviderRegistryManifestPinV1Schema,
  currentSteadyRegistryManifestEnvelope: ProviderRegistryManifestEnvelopeV1Schema,
  currentSupportCatalog: ProviderFeasibilitySupportCatalogPinV1Schema,
  currentSupportCatalogEnvelope: ProviderFeasibilitySupportCatalogEnvelopeV1Schema,
  currentReleaseTargetUniverse: ProviderReleaseTargetUniversePinV1Schema,
  currentReleaseTargetUniverseEnvelope: ProviderReleaseTargetUniverseEnvelopeV1Schema,
  prospectiveRegistryEntryContentDigest: ContentDigestV1Schema,
  prospectiveRegistryEntry: ProspectiveRegistryEntryV1Schema,
  releaseTargetUniverseTargetOrdinal: OrdinalV1Schema,
  target: ProviderFeasibilityTargetV1Schema,
  prospectiveSupportCandidate: ProspectiveSupportCandidateV1Schema,
  evidenceEnvelope: ProviderFeasibilityEvidenceEnvelopeV1Schema,
  supportAdmission: z.literal("not_yet_catalog_signed_or_registry_bound"),
  registryMembership: z.literal("none"),
  migrationPreparedManifest: z.literal("none"),
  selectorDisposition: z.literal("outside_current_accepted_steady_selector_cut"),
  cutContentDigest: ContentDigestV1Schema,
}).superRefine((cut, context) => {
  const entry = cut.prospectiveRegistryEntry;
  if (cut.prospectiveRegistryEntryContentDigest !== deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(entry)) {
    addIssueV1(context, ["prospectiveRegistryEntryContentDigest"], "prospective Registry Entry digest must be derived from the full genesis Entry");
  }
  const manifestEnvelope = cut.currentSteadyRegistryManifestEnvelope;
  const manifest = manifestEnvelope.payload;
  if (manifest.routing.state !== "steady") {
    addIssueV1(context, ["currentSteadyRegistryManifestEnvelope", "payload", "routing"], "current Registry Manifest must be steady");
  }
  const derivedManifestGenerationId = deriveProviderRegistryManifestGenerationIdV1(manifest);
  const derivedManifestContentDigest = deriveProviderRegistryManifestContentDigestV1(manifest);
  if (
    manifestEnvelope.generationId !== derivedManifestGenerationId ||
    manifestEnvelope.contentDigest !== derivedManifestContentDigest ||
    cut.currentSteadyRegistryManifestPin.manifestGeneration !== manifest.manifestGeneration ||
    cut.currentSteadyRegistryManifestPin.generationId !== derivedManifestGenerationId ||
    cut.currentSteadyRegistryManifestPin.contentDigest !== derivedManifestContentDigest
  ) {
    addIssueV1(context, ["currentSteadyRegistryManifestPin"], "current steady Manifest Pin must be derived from its complete Envelope");
  }
  if (
    manifest.installationIdentityGenerationId !==
      entry.installationIdentityGenerationId ||
    !canonicalEqualV1(manifest.activeRootMetadata, cut.activeRootMetadata) ||
    !canonicalEqualV1(entry.activeRootMetadata, cut.activeRootMetadata) ||
    entry.registryRootKeyId !== cut.activeRootMetadata.rootKeyId
  ) {
    addIssueV1(
      context,
      ["prospectiveRegistryEntry", "activeRootMetadata"],
      "current Manifest and prospective Entry must share the endpoint Identity and exact active Root",
    );
  }
  try {
    if (!canonicalEqualV1(cut.currentSupportCatalog, deriveProviderFeasibilitySupportCatalogPinV1(cut.currentSupportCatalogEnvelope))) {
      addIssueV1(context, ["currentSupportCatalog"], "current Catalog Pin must be derived from its complete Envelope");
    }
  } catch {
    addIssueV1(context, ["currentSupportCatalogEnvelope"], "current Catalog Envelope must be self-bound");
  }
  if (
    !canonicalEqualV1(
      entry.feasibilityApprovalKeys,
      cut.currentSupportCatalogEnvelope.payload.feasibilityApprovalKeys,
    )
  ) {
    addIssueV1(
      context,
      ["prospectiveRegistryEntry", "feasibilityApprovalKeys"],
      "prospective Registry Entry approval keys must equal the current Catalog approval snapshot",
    );
  }
  const universeEnvelope = cut.currentReleaseTargetUniverseEnvelope;
  const universeContentDigest = deriveProviderReleaseTargetUniverseContentDigestV1(universeEnvelope.payload);
  if (
    universeEnvelope.universeGeneration !== universeEnvelope.payload.universeGeneration ||
    universeEnvelope.contentDigest !== universeContentDigest ||
    cut.currentReleaseTargetUniverse.universeGeneration !== universeEnvelope.universeGeneration ||
    cut.currentReleaseTargetUniverse.contentDigest !== universeContentDigest
  ) {
    addIssueV1(context, ["currentReleaseTargetUniverse"], "current Universe Pin must be derived from its complete Envelope");
  }
  const catalogPayload = cut.currentSupportCatalogEnvelope.payload;
  const universePayload = universeEnvelope.payload;
  if (
    !canonicalEqualV1(catalogPayload.activeRootMetadata, cut.activeRootMetadata) ||
    !canonicalEqualV1(universePayload.activeRootMetadata, cut.activeRootMetadata) ||
    catalogPayload.registryRootKeyId !== cut.activeRootMetadata.rootKeyId ||
    universePayload.registryRootKeyId !== cut.activeRootMetadata.rootKeyId ||
    !canonicalEqualV1(
      catalogPayload.distributionRootBinding,
      universePayload.distributionRootBinding,
    ) ||
    !canonicalEqualV1(
      catalogPayload.publicSupportTaxonomy,
      universePayload.publicSupportTaxonomy,
    )
  ) {
    addIssueV1(
      context,
      ["currentSupportCatalogEnvelope", "payload"],
      "current Catalog and Universe must share the exact Root, Distribution binding, and public taxonomy",
    );
  }
  if (
    !canonicalEqualV1(
      cut.currentSupportCatalogEnvelope.payload.releaseTargetUniverse,
      cut.currentReleaseTargetUniverse,
    )
  ) {
    addIssueV1(
      context,
      ["currentSupportCatalogEnvelope", "payload", "releaseTargetUniverse"],
      "current Catalog must pin the exact current Release Target Universe",
    );
  }
  const targetEntry = universeEnvelope.payload.targets[cut.releaseTargetUniverseTargetOrdinal];
  if (targetEntry === undefined || !canonicalEqualV1(targetEntry.target, cut.target)) {
    addIssueV1(context, ["releaseTargetUniverseTargetOrdinal"], "target ordinal must select the exact target in the signed current Universe");
  }
  const evidence = cut.evidenceEnvelope;
  const evidenceId = deriveProviderFeasibilityEvidenceIdV1(evidence.payload);
  const evidenceContentDigest = deriveProviderFeasibilityEvidenceContentDigestV1(evidence.payload);
  if (
    evidence.evidenceId !== evidenceId ||
    evidence.payload.evidenceId !== evidenceId ||
    evidence.contentDigest !== evidenceContentDigest ||
    !canonicalEqualV1(evidence.payload.target, cut.target)
  ) {
    addIssueV1(context, ["evidenceEnvelope"], "Evidence Envelope identity, content, and target must be exact");
  }
  let evidencePin: unknown;
  try {
    evidencePin = deriveProviderFeasibilityEvidencePinV1(evidence);
  } catch {
    evidencePin = undefined;
  }
  const candidate = cut.prospectiveSupportCandidate;
  const entryRuntimeDigest = entry.runtimeAttestation.contentDigest;
  if (
    candidate.providerId !== entry.providerId ||
    candidate.providerId !== evidence.payload.providerId ||
    !canonicalEqualV1(candidate.providerFeasibilityEvidence, evidencePin) ||
    !canonicalEqualV1(entry.providerFeasibilityEvidence, evidencePin) ||
    entry.semanticProviderPolicyDigest !== deriveStoreDurableObjectProviderPolicyDigestV1(candidate.semanticProviderPolicy) ||
    entry.semanticProviderPolicyDigest !== evidence.payload.semanticProviderPolicyDigest ||
    !canonicalEqualV1(candidate.runtimeAttestation, entry.runtimeAttestation) ||
    entryRuntimeDigest !== evidence.payload.runtimeAttestationContentDigest ||
    evidence.payload.result !== "passed"
  ) {
    addIssueV1(context, ["prospectiveSupportCandidate"], "prospective Entry, support candidate, Evidence, policy, and Runtime Pin must close exactly");
  }
  for (let index = 0; index < manifest.members.length; index += 1) {
    if (manifest.members[index]!.providerId === entry.providerId) {
      addIssueV1(context, ["prospectiveRegistryEntry", "providerId"], "prospective provider must be absent from every current Manifest member");
      break;
    }
  }
  const catalogTargets = cut.currentSupportCatalogEnvelope.payload.targets;
  for (let targetIndex = 0; targetIndex < catalogTargets.length; targetIndex += 1) {
    const candidates = catalogTargets[targetIndex]!.candidates;
    for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
      if (candidates[candidateIndex]!.providerId === entry.providerId) {
        addIssueV1(context, ["prospectiveRegistryEntry", "providerId"], "prospective provider must be absent from every current Catalog candidate");
      }
    }
  }
  if (cut.cutContentDigest !== deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutContentDigestReferenceCandidateV1(cut)) {
    addIssueV1(context, ["cutContentDigest"], "prospective destination cut digest must bind the complete public cut");
  }
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutReferenceCandidateV1Schema>;

const SourceEndpointTrustReferenceCandidateV1Schema = ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustCommonReferenceCandidateV1Schema.extend({
  role: z.literal("source_current_strong_writer"),
  currentWriterSelection: ProviderActiveWriterSelectionV1Schema,
  authorization: z.strictObject({
    kind: z.literal("current_strong_writer_reference_candidate"),
    selectorOrdinal: OrdinalV1Schema,
  }),
});
const DestinationEndpointTrustReferenceCandidateV1Schema = ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustCommonReferenceCandidateV1Schema.extend({
  role: z.literal("destination_prospective_not_selected"),
  prospectiveWriterProjection: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveWriterProjectionReferenceCandidateV1Schema,
  authorization: z.strictObject({
    kind: z.literal("prospective_migration_destination_reference_candidate"),
    prospectiveDestinationCut: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutReferenceCandidateV1Schema,
  }),
});

const EndpointTrustUnrefinedReferenceCandidateV1Schema = z.discriminatedUnion("role", [
  SourceEndpointTrustReferenceCandidateV1Schema,
  DestinationEndpointTrustReferenceCandidateV1Schema,
]);
export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1Schema = EndpointTrustUnrefinedReferenceCandidateV1Schema.superRefine((trust, context) => {
  const currentRead = trust.currentAcceptanceRead;
  const retained = trust.retainedAcceptanceGenerations;
  const enumeration = currentRead.enumeration;
  if (
    trust.installationIdentityGenerationId !== enumeration.installationIdentityGenerationId ||
    trust.installationIdentityGenerationId !== currentRead.highWater.payload.installationIdentityGenerationId ||
    retained.length !== enumeration.entries.length
  ) {
    addIssueV1(context, ["retainedAcceptanceGenerations"], "retained Acceptance history must exactly cover the current read Identity and enumeration");
  }
  const limit = retained.length < enumeration.entries.length ? retained.length : enumeration.entries.length;
  for (let index = 0; index < limit; index += 1) {
    const envelope = retained[index]!;
    const entry = enumeration.entries[index]!;
    if (
      envelope.payload.acceptanceOrdinal !== entry.acceptanceOrdinal ||
      envelope.generationId !== entry.generationId ||
      envelope.contentDigest !== entry.contentDigest ||
      envelope.installationIdentityGenerationId !== trust.installationIdentityGenerationId
    ) {
      addIssueV1(context, ["retainedAcceptanceGenerations", index], "retained Acceptance Envelope must equal its current-read enumeration entry");
    }
  }
  const last = retained[retained.length - 1];
  if (
    last === undefined ||
    last.payload.configuration.state !== "strong_ready" ||
    last.payload.configuration.core.activeWriterSelector.selections.length === 0
  ) {
    addIssueV1(context, ["retainedAcceptanceGenerations"], "current retained Acceptance must be strong_ready");
  } else {
    const core = last.payload.configuration.core;
    if (trust.role === "source_current_strong_writer") {
      const selection = core.activeWriterSelector.selections[trust.authorization.selectorOrdinal];
      if (
        selection === undefined ||
        !canonicalEqualV1(selection, trust.currentWriterSelection) ||
        selection.targetProfileId !== trust.targetProfileId
      ) {
        addIssueV1(context, ["currentWriterSelection"], "source authorization must select the unique current steady writer at its exact ordinal");
      }
    } else {
      const cut = trust.authorization.prospectiveDestinationCut;
      const projection = trust.prospectiveWriterProjection;
      const entry = cut.prospectiveRegistryEntry;
      let currentSourceSelection:
        | (typeof core.activeWriterSelector.selections)[number]
        | undefined;
      for (
        let index = 0;
        index < core.activeWriterSelector.selections.length;
        index += 1
      ) {
        const selection = core.activeWriterSelector.selections[index]!;
        if (selection.targetProfileId === trust.targetProfileId) {
          currentSourceSelection = selection;
          break;
        }
      }
      let currentSourceRegistryEntry:
        | typeof entry
        | undefined;
      if (currentSourceSelection !== undefined) {
        const members = cut.currentSteadyRegistryManifestEnvelope.payload.members;
        for (let index = 0; index < members.length; index += 1) {
          const member = members[index]!;
          if (
            member.disposition === "enabled" &&
            member.providerId === currentSourceSelection.providerId &&
            member.registryEntryContentDigest ===
              currentSourceSelection.registryEntryContentDigest
          ) {
            currentSourceRegistryEntry = member.registryEntry;
            break;
          }
        }
      }
      const expectedProjection = {
        targetProfileId: cut.target.targetProfileId,
        providerId: entry.providerId,
        registryEntryContentDigest: cut.prospectiveRegistryEntryContentDigest,
        semanticProviderPolicyDigest: entry.semanticProviderPolicyDigest,
        providerFeasibilityEvidence: entry.providerFeasibilityEvidence,
        runtimeAttestationContentDigest: entry.runtimeAttestation.contentDigest,
        bindingDerivationKeyGeneration: entry.verificationKeys.activeBindingDerivationKeyGeneration,
      };
      if (
        trust.targetProfileId !== cut.target.targetProfileId ||
        !canonicalEqualV1(projection, expectedProjection) ||
        entry.installationIdentityGenerationId !== trust.installationIdentityGenerationId ||
        !canonicalEqualV1(cut.activeRootMetadata, core.activeRootMetadata) ||
        !canonicalEqualV1(cut.currentSteadyRegistryManifestPin, core.providerRegistryManifest) ||
        !canonicalEqualV1(cut.currentSupportCatalog, core.providerSupportCatalog)
      ) {
        addIssueV1(context, ["prospectiveWriterProjection"], "destination projection and current Acceptance trust anchors must close exactly");
      }
      if (
        currentSourceRegistryEntry === undefined ||
        !canonicalEqualV1(
          currentSourceRegistryEntry.feasibilityApprovalKeys,
          cut.currentSupportCatalogEnvelope.payload.feasibilityApprovalKeys,
        ) ||
        !canonicalEqualV1(
          entry.feasibilityApprovalKeys,
          currentSourceRegistryEntry.feasibilityApprovalKeys,
        )
      ) {
        addIssueV1(
          context,
          [
            "authorization",
            "prospectiveDestinationCut",
            "prospectiveRegistryEntry",
            "feasibilityApprovalKeys",
          ],
          "prospective, current-source Registry, and current Catalog approval keys must be byte-identical",
        );
      }
      for (let index = 0; index < core.activeWriterSelector.selections.length; index += 1) {
        const selection = core.activeWriterSelector.selections[index]!;
        if (selection.providerId === entry.providerId) {
          addIssueV1(context, ["authorization", "prospectiveDestinationCut", "selectorDisposition"], "prospective destination must remain outside the current accepted selector cut");
        }
      }
    }
  }
  if (trust.trustClosureContentDigest !== deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustContentDigestReferenceCandidateV1(trust)) {
    addIssueV1(context, ["trustClosureContentDigest"], "endpoint trust digest must bind the complete correlated endpoint projection");
  }
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceCandidateV1Schema = z.strictObject({
  profile: z.literal("provider_migration_same_installation_identity_current_strong_source_normal_namespace_translation_reference_candidate_v1"),
  mode: z.literal("same_installation_identity"),
  relationship: z.literal("same_identity_repository_and_worktree_exact_equal"),
  sourceNamespace: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceReferenceCandidateV1Schema,
  destinationNamespace: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceReferenceCandidateV1Schema,
  journalAuthorityInstallationIdentityGenerationId: InstallationIdentityGenerationIdV1Schema,
  translationReferenceDigest: ContentDigestV1Schema,
}).superRefine((translation, context) => {
  if (!canonicalEqualV1(translation.sourceNamespace, translation.destinationNamespace) || translation.journalAuthorityInstallationIdentityGenerationId !== translation.sourceNamespace.installationIdentityGenerationId) {
    addIssueV1(context, ["destinationNamespace"], "same-Identity namespace translation must preserve Identity, repository, and worktree exactly");
  }
  if (translation.translationReferenceDigest !== deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceDigestReferenceCandidateV1(translation)) {
    addIssueV1(context, ["translationReferenceDigest"], "translation digest must bind the complete non-authorizing projection");
  }
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectKindReferenceCandidateV1Schema = z.enum([
  "store_manifest_generation",
  "quota_index_node",
  "quota_index_root",
  "quota_transition_record",
  "artifact_manifest_generation",
  "repo_pulse_immutable_version",
  "committed_private_blob",
  "committed_private_metadata",
  "ownership_marker",
  "initialization_terminal_receipt",
  "terminalization_handoff_record",
  "provider_journal_record",
  "provider_operation_receipt",
  "store_manifest_compare_append_receipt",
  "reservation_membership",
  "active_blob_entitlement",
  "active_metadata_plan",
  "active_temp_plan",
  "control_state",
]);
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectKindReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectKindReferenceCandidateV1Schema>;

const StoreManifestCompleteRootReferenceCandidateV1Schema = z.strictObject({
  rootKind: z.literal("store_manifest_complete_set"),
  current: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1Schema,
});
const QuotaIndexRootReferenceCandidateV1Schema = z.strictObject({
  rootKind: z.literal("quota_index_and_transition_chain"),
  currentQuotaIndexRootContentDigest: ContentDigestV1Schema,
  transitionHead: z.discriminatedUnion("state", [
    z.strictObject({ state: z.literal("genesis") }),
    z.strictObject({
      state: z.literal("transition"),
      recordReferenceDigest: ContentDigestV1Schema,
      contentDigest: ContentDigestV1Schema,
    }),
  ]),
});
const ArtifactHistoryRootReferenceCandidateV1Schema = z.strictObject({
  rootKind: z.literal("artifact_descriptor_history_closure"),
  rootCount: NonnegativeSafeIntegerV1Schema,
  rootSetDigest: ContentDigestV1Schema,
});
const InitializationTerminalRootReferenceCandidateV1Schema = z.strictObject({
  rootKind: z.literal("initialization_terminal"),
  terminalHeadReferenceDigest: ContentDigestV1Schema,
});
const ReceiptLedgerRootReferenceCandidateV1Schema = z.strictObject({
  rootKind: z.literal("store_manifest_compare_append_receipt_ledger"),
  providerId: DurableObjectIdentityProviderIdV1Schema,
  providerPolicyDigest: ContentDigestV1Schema,
  receiptCount: NonnegativeSafeIntegerV1Schema,
  receiptSetDigest: ContentDigestV1Schema,
  receiptLogicalBytes: NonnegativeSafeIntegerV1Schema,
});
const ActiveRecoveryRootReferenceCandidateV1Schema = z.strictObject({
  rootKind: z.literal("active_recovery_control"),
  activeTransactionCount: z.literal(0),
  controlUniverseDigest: ContentDigestV1Schema,
});

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootReferenceCandidateV1Schema = z.discriminatedUnion("rootKind", [
  StoreManifestCompleteRootReferenceCandidateV1Schema,
  QuotaIndexRootReferenceCandidateV1Schema,
  ArtifactHistoryRootReferenceCandidateV1Schema,
  InitializationTerminalRootReferenceCandidateV1Schema,
  ReceiptLedgerRootReferenceCandidateV1Schema,
  ActiveRecoveryRootReferenceCandidateV1Schema,
]);
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootEntryReferenceCandidateV1Schema = z.strictObject({
  rootOrdinal: OrdinalV1Schema,
  root: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootReferenceCandidateV1Schema,
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootEntryReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootEntryReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectEntryReferenceCandidateV1Schema = z.strictObject({
  objectOrdinal: OrdinalV1Schema,
  objectKind: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectKindReferenceCandidateV1Schema,
  locatorNamespace: z.enum(["store", "provider_isolated_store_manifest_receipt_ledger"]),
  logicalLocatorReferenceDigest: ContentDigestV1Schema,
  semanticLocatorDigest: ContentDigestV1Schema,
  contentDigest: ContentDigestV1Schema,
  logicalBytes: NonnegativeSafeIntegerV1Schema,
  providerBindingReferenceDigest: ContentDigestV1Schema,
}).superRefine((entry, context) => {
  const receipt = entry.objectKind === "store_manifest_compare_append_receipt";
  const receiptNamespace = entry.locatorNamespace === "provider_isolated_store_manifest_receipt_ledger";
  if (receipt !== receiptNamespace) {
    addIssueV1(context, ["locatorNamespace"], "receipt objects iff use the provider-isolated receipt-ledger namespace");
  }
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectEntryReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectEntryReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceSourceReferenceCandidateV1Schema = z.discriminatedUnion("sourceKind", [
  z.strictObject({ sourceKind: z.literal("root"), rootOrdinal: OrdinalV1Schema }),
  z.strictObject({ sourceKind: z.literal("object"), objectOrdinal: OrdinalV1Schema, objectContentDigest: ContentDigestV1Schema }),
]);
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceSourceReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceSourceReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceSlotDescriptorReferenceCandidateV1Schema = z.discriminatedUnion("sourceKind", [
  z.strictObject({
    sourceKind: z.literal("root"),
    rootKind: z.enum([
      "store_manifest_complete_set",
      "quota_index_and_transition_chain",
      "artifact_descriptor_history_closure",
      "initialization_terminal",
      "store_manifest_compare_append_receipt_ledger",
      "active_recovery_control",
    ]),
    schemaFieldPath: CanonicalByteStringV1Schema,
    occurrenceOrdinal: OrdinalV1Schema,
  }),
  z.strictObject({
    sourceKind: z.literal("object"),
    objectKind: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectKindReferenceCandidateV1Schema,
    schemaFieldPath: CanonicalByteStringV1Schema,
    occurrenceOrdinal: OrdinalV1Schema,
  }),
]);
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceSlotDescriptorReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceSlotDescriptorReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceEdgeReferenceCandidateV1Schema = z.strictObject({
  edgeOrdinal: OrdinalV1Schema,
  from: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceSourceReferenceCandidateV1Schema,
  referenceSlotReferenceDigest: ContentDigestV1Schema,
  referenceSlotDescriptor: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceSlotDescriptorReferenceCandidateV1Schema,
  toObjectOrdinal: OrdinalV1Schema,
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceEdgeReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceEdgeReferenceCandidateV1Schema>;

const CompleteSourceReadClosureShapeReferenceCandidateV1 = {
  profile: z.literal("provider_migration_same_installation_identity_current_strong_source_normal_complete_source_read_closure_reference_candidate_v1"),
  sourceInstallationIdentityGenerationId: InstallationIdentityGenerationIdV1Schema,
  sourceTrustClosureContentDigest: ContentDigestV1Schema,
  sourceStoreManifest: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1Schema,
  sourceFreezeStateReferenceDigest: ContentDigestV1Schema,
  liveReferenceSchemaDigest: ContentDigestV1Schema,
  roots: z.array(ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootEntryReferenceCandidateV1Schema).min(1).max(65_536),
  objects: z.array(ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectEntryReferenceCandidateV1Schema).min(1).max(1_000_000),
  references: z.array(ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceEdgeReferenceCandidateV1Schema).max(4_000_000),
  rootCount: PositiveSafeIntegerV1Schema,
  rootSetDigest: ContentDigestV1Schema,
  canonicalRootSetBytes: PositiveSafeIntegerV1Schema,
  objectCount: PositiveSafeIntegerV1Schema,
  objectSetDigest: ContentDigestV1Schema,
  canonicalObjectSetBytes: PositiveSafeIntegerV1Schema,
  logicalObjectBytesTotal: NonnegativeSafeIntegerV1Schema,
  referenceCount: NonnegativeSafeIntegerV1Schema,
  referenceSetDigest: ContentDigestV1Schema,
  canonicalReferenceSetBytes: PositiveSafeIntegerV1Schema,
  canonicalUniverseBytes: PositiveSafeIntegerV1Schema,
  activeTransactions: z.tuple([]),
  completeReadClosureContentDigest: ContentDigestV1Schema,
} as const;

function refineCompleteSourceReadClosureV1(
  closure: z.infer<z.ZodObject<typeof CompleteSourceReadClosureShapeReferenceCandidateV1>>,
  context: z.RefinementCtx,
): void {
  const roots = closure.roots;
  const objects = closure.objects;
  const references = closure.references;
  const rootKinds = new CapturedSetV1<string>();
  let storeRoot: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootReferenceCandidateV1 | undefined;
  let receiptRoot: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootReferenceCandidateV1 | undefined;
  for (let index = 0; index < roots.length; index += 1) {
    const entry = roots[index]!;
    if (entry.rootOrdinal !== index) addIssueV1(context, ["roots", index, "rootOrdinal"], "root ordinals must be exact contiguous 0..N-1");
    const key = canonicalStringV1({ root: entry.root });
    if (index > 0) {
      const previous = canonicalStringV1({ root: roots[index - 1]!.root });
      if (compareUtf8StringsV1(previous, key) >= 0) addIssueV1(context, ["roots", index], "root entries must be bytewise JCS sorted and unique without ordinals");
    }
    if (setHasV1(rootKinds, entry.root.rootKind)) addIssueV1(context, ["roots", index, "root", "rootKind"], "each root kind must occur exactly once");
    setAddV1(rootKinds, entry.root.rootKind);
    if (entry.root.rootKind === "store_manifest_complete_set") storeRoot = entry.root;
    if (entry.root.rootKind === "store_manifest_compare_append_receipt_ledger") receiptRoot = entry.root;
  }
  if (roots.length !== 6) addIssueV1(context, ["roots"], "roots must exact-cover all six root kinds");
  if (storeRoot?.rootKind !== "store_manifest_complete_set" || !canonicalEqualV1(storeRoot.current, closure.sourceStoreManifest)) {
    addIssueV1(context, ["roots"], "Store complete-set root must equal the source Store cut");
  }
  if (
    receiptRoot?.rootKind !== "store_manifest_compare_append_receipt_ledger" ||
    receiptRoot.providerId !== closure.sourceStoreManifest.providerBinding.providerId ||
    receiptRoot.providerPolicyDigest !== closure.sourceStoreManifest.providerBinding.semanticProviderPolicyDigest
  ) {
    addIssueV1(context, ["roots"], "receipt-ledger root must bind the source writer provider and policy");
  }
  const semanticBindingTuples = new CapturedSetV1<string>();
  for (let index = 0; index < objects.length; index += 1) {
    const entry = objects[index]!;
    if (entry.objectOrdinal !== index) addIssueV1(context, ["objects", index, "objectOrdinal"], "object ordinals must be exact contiguous 0..N-1");
    const key = canonicalStringV1({
      objectKind: entry.objectKind,
      locatorNamespace: entry.locatorNamespace,
      logicalLocatorReferenceDigest: entry.logicalLocatorReferenceDigest,
      semanticLocatorDigest: entry.semanticLocatorDigest,
      contentDigest: entry.contentDigest,
      logicalBytes: entry.logicalBytes,
      providerBindingReferenceDigest: entry.providerBindingReferenceDigest,
    });
    if (index > 0) {
      const previousEntry = objects[index - 1]!;
      const previous = canonicalStringV1({
        objectKind: previousEntry.objectKind,
        locatorNamespace: previousEntry.locatorNamespace,
        logicalLocatorReferenceDigest: previousEntry.logicalLocatorReferenceDigest,
        semanticLocatorDigest: previousEntry.semanticLocatorDigest,
        contentDigest: previousEntry.contentDigest,
        logicalBytes: previousEntry.logicalBytes,
        providerBindingReferenceDigest: previousEntry.providerBindingReferenceDigest,
      });
      if (compareUtf8StringsV1(previous, key) >= 0) addIssueV1(context, ["objects", index], "object entries must be bytewise JCS sorted and unique without ordinals");
    }
    const tuple = canonicalStringV1([entry.semanticLocatorDigest, entry.providerBindingReferenceDigest]);
    if (setHasV1(semanticBindingTuples, tuple)) addIssueV1(context, ["objects", index, "semanticLocatorDigest"], "semantic locator plus provider binding tuples must be unique before ordinal assignment");
    setAddV1(semanticBindingTuples, tuple);
    if (entry.providerBindingReferenceDigest !== closure.sourceStoreManifest.providerBinding.bindingReferenceDigest) {
      addIssueV1(context, ["objects", index, "providerBindingReferenceDigest"], "every object must use the source current-writer Store binding");
    }
  }
  const slotKeys = new CapturedSetV1<string>();
  const adjacency = new CapturedArrayV1<number[]>(objects.length);
  const reachable = new CapturedArrayV1<boolean>(objects.length);
  const queue: number[] = [];
  for (let index = 0; index < objects.length; index += 1) {
    adjacency[index] = [];
    reachable[index] = false;
  }
  for (let index = 0; index < references.length; index += 1) {
    const edge = references[index]!;
    if (edge.edgeOrdinal !== index) addIssueV1(context, ["references", index, "edgeOrdinal"], "edge ordinals must be exact contiguous 0..N-1");
    const key = canonicalStringV1({
      from: edge.from,
      referenceSlotReferenceDigest: edge.referenceSlotReferenceDigest,
      referenceSlotDescriptor: edge.referenceSlotDescriptor,
      toObjectOrdinal: edge.toObjectOrdinal,
    });
    if (index > 0) {
      const previousEdge = references[index - 1]!;
      const previous = canonicalStringV1({
        from: previousEdge.from,
        referenceSlotReferenceDigest: previousEdge.referenceSlotReferenceDigest,
        referenceSlotDescriptor: previousEdge.referenceSlotDescriptor,
        toObjectOrdinal: previousEdge.toObjectOrdinal,
      });
      if (compareUtf8StringsV1(previous, key) >= 0) addIssueV1(context, ["references", index], "reference edges must be bytewise JCS sorted and unique without ordinals");
    }
    if (edge.toObjectOrdinal >= objects.length) addIssueV1(context, ["references", index, "toObjectOrdinal"], "edge target object must exist");
    const slotKey = canonicalStringV1([edge.from, edge.referenceSlotDescriptor]);
    if (setHasV1(slotKeys, slotKey)) addIssueV1(context, ["references", index, "referenceSlotDescriptor"], "each source and slot descriptor may occur exactly once");
    setAddV1(slotKeys, slotKey);
    if (edge.from.sourceKind !== edge.referenceSlotDescriptor.sourceKind) {
      addIssueV1(context, ["references", index, "referenceSlotDescriptor", "sourceKind"], "slot descriptor source kind must equal edge source kind");
    } else if (edge.from.sourceKind === "root") {
      const root = roots[edge.from.rootOrdinal];
      if (root === undefined || edge.referenceSlotDescriptor.sourceKind !== "root" || root.root.rootKind !== edge.referenceSlotDescriptor.rootKind) {
        addIssueV1(context, ["references", index, "from"], "root edge source and descriptor must identify an existing exact root");
      }
      if (edge.toObjectOrdinal < objects.length && !reachable[edge.toObjectOrdinal]) {
        reachable[edge.toObjectOrdinal] = true;
        arrayPushV1(queue, edge.toObjectOrdinal);
      }
    } else {
      const source = objects[edge.from.objectOrdinal];
      if (
        source === undefined ||
        source.contentDigest !== edge.from.objectContentDigest ||
        edge.referenceSlotDescriptor.sourceKind !== "object" ||
        source.objectKind !== edge.referenceSlotDescriptor.objectKind
      ) {
        addIssueV1(context, ["references", index, "from"], "object edge source, content digest, and descriptor must identify an existing exact object");
      } else if (edge.toObjectOrdinal < objects.length) {
        arrayPushV1(adjacency[edge.from.objectOrdinal]!, edge.toObjectOrdinal);
      }
    }
  }
  let queueIndex = 0;
  while (queueIndex < queue.length) {
    const sourceOrdinal = queue[queueIndex]!;
    queueIndex += 1;
    const targets = adjacency[sourceOrdinal]!;
    for (let targetIndex = 0; targetIndex < targets.length; targetIndex += 1) {
      const target = targets[targetIndex]!;
      if (!reachable[target]) {
        reachable[target] = true;
        arrayPushV1(queue, target);
      }
    }
  }
  for (let index = 0; index < reachable.length; index += 1) {
    if (!reachable[index]) addIssueV1(context, ["objects", index], "every object must be reachable from the exact root set");
  }
  let logicalBytes = 0;
  try {
    for (let index = 0; index < objects.length; index += 1) logicalBytes = checkedAddInternalV1(logicalBytes, objects[index]!.logicalBytes);
  } catch {
    addIssueV1(context, ["logicalObjectBytesTotal"], "logical object bytes must have a non-overflowing safe sum");
  }
  const expectedClaims = {
    rootCount: roots.length,
    objectCount: objects.length,
    referenceCount: references.length,
    rootSetDigest: deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootSetDigestReferenceCandidateV1({ entries: roots }),
    objectSetDigest: deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectSetDigestReferenceCandidateV1({ entries: objects }),
    referenceSetDigest: deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceSetDigestReferenceCandidateV1({ entries: references }),
    canonicalRootSetBytes: canonicalByteLengthV1({ entries: roots }),
    canonicalObjectSetBytes: canonicalByteLengthV1({ entries: objects }),
    canonicalReferenceSetBytes: canonicalByteLengthV1({ entries: references }),
    canonicalUniverseBytes: canonicalByteLengthV1({ roots, objects, references }),
    logicalObjectBytesTotal: logicalBytes,
  };
  const claimKeys = ["rootCount", "objectCount", "referenceCount", "rootSetDigest", "objectSetDigest", "referenceSetDigest", "canonicalRootSetBytes", "canonicalObjectSetBytes", "canonicalReferenceSetBytes", "canonicalUniverseBytes", "logicalObjectBytesTotal"] as const;
  for (let index = 0; index < claimKeys.length; index += 1) {
    const key = claimKeys[index]!;
    if (closure[key] !== expectedClaims[key]) addIssueV1(context, [key], `${key} must be recomputed from the complete ordered source arrays`);
  }
  if (closure.sourceInstallationIdentityGenerationId !== closure.sourceStoreManifest.namespace.installationIdentityGenerationId) {
    addIssueV1(context, ["sourceInstallationIdentityGenerationId"], "source closure Identity must equal source Store namespace Identity");
  }
  if (closure.completeReadClosureContentDigest !== deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureContentDigestReferenceCandidateV1(closure)) {
    addIssueV1(context, ["completeReadClosureContentDigest"], "complete source closure digest must bind every public closure field");
  }
}

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1Schema = z.strictObject(CompleteSourceReadClosureShapeReferenceCandidateV1).superRefine(refineCompleteSourceReadClosureV1);
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactKindReferenceCandidateV1Schema = z.enum([
  "canonical_rewrite_plan",
  "destination_universe",
  "migration_plan",
  "object_receipt",
  "progress_operation_receipt",
  "progress_record",
  "sealed_progress_head",
  "semantic_equivalence_proof",
  "source_tombstone",
  "source_universe",
  "zero_live_proof",
]);
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactKindReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactKindReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundReferenceCandidateV1Schema = z.strictObject({
  artifactKind: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactKindReferenceCandidateV1Schema,
  artifactCount: NonnegativeSafeIntegerV1Schema,
  canonicalEnvelopeBytesUpperBoundTotal: NonnegativeSafeIntegerV1Schema,
  providerAllocatedBytesUpperBoundTotal: NonnegativeSafeIntegerV1Schema,
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundReferenceCandidateV1Schema>;

const HistoryArtifactKindsInCanonicalOrderV1 = CapturedObjectFreezeV1([
  "canonical_rewrite_plan",
  "destination_universe",
  "migration_plan",
  "object_receipt",
  "progress_operation_receipt",
  "progress_record",
  "sealed_progress_head",
  "semantic_equivalence_proof",
  "source_tombstone",
  "source_universe",
  "zero_live_proof",
] as const);

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundsReferenceCandidateV1Schema = z.tuple([
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundReferenceCandidateV1Schema,
]).superRefine((entries, context) => {
  for (let index = 0; index < HistoryArtifactKindsInCanonicalOrderV1.length; index += 1) {
    const entry = entries[index]!;
    if (entry.artifactKind !== HistoryArtifactKindsInCanonicalOrderV1[index]) {
      addIssueV1(context, [index, "artifactKind"], "artifact upper bounds must exact-cover the frozen eleven-kind UTF-8 order");
    }
    if (entry.artifactCount === 0 && (entry.canonicalEnvelopeBytesUpperBoundTotal !== 0 || entry.providerAllocatedBytesUpperBoundTotal !== 0)) {
      addIssueV1(context, [index], "an inapplicable zero-count artifact kind must carry both explicit zero byte bounds");
    }
  }
  const migrationPlan = entries[2]!;
  if (migrationPlan.artifactKind !== "migration_plan" || migrationPlan.artifactCount !== 1 || migrationPlan.canonicalEnvelopeBytesUpperBoundTotal !== 4_194_304) {
    addIssueV1(context, [2], "migration_plan must use the single static 4 MiB cycle-free Envelope upper bound");
  }
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundsReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundsReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaChargeAmountsReferenceCandidateV1Schema = z.strictObject({
  reservedHistoryLogicalBytes: NonnegativeSafeIntegerV1Schema,
  reservedHistoryProviderAllocatedBytes: NonnegativeSafeIntegerV1Schema,
  reservedObjectReceiptCount: NonnegativeSafeIntegerV1Schema,
  reservedObjectReceiptLogicalBytes: NonnegativeSafeIntegerV1Schema,
  reservedSemanticRootZeroProofCount: NonnegativeSafeIntegerV1Schema,
  reservedSemanticRootZeroProofLogicalBytes: NonnegativeSafeIntegerV1Schema,
  reservedProgressRecordCount: NonnegativeSafeIntegerV1Schema,
  reservedProgressRecordLogicalBytes: NonnegativeSafeIntegerV1Schema,
  reservedProgressOperationReceiptCount: NonnegativeSafeIntegerV1Schema,
  reservedProgressOperationReceiptLogicalBytes: NonnegativeSafeIntegerV1Schema,
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaChargeAmountsReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaChargeAmountsReferenceCandidateV1Schema>;

const SourceDryRunCutShapeReferenceCandidateV1 = {
  profile: z.literal("provider_migration_same_installation_identity_current_strong_source_normal_source_dry_run_cut_reference_candidate_v1"),
  mode: z.literal("same_installation_identity"),
  completeSourceReadClosure: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1Schema,
  completeSourceReadClosureContentDigest: ContentDigestV1Schema,
  migrationBudgetsDigest: ContentDigestV1Schema,
  retainedArtifactUpperBounds: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundsReferenceCandidateV1Schema,
  derivedJournalChargeAmounts: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaChargeAmountsReferenceCandidateV1Schema,
  sourceDryRunCutContentDigest: ContentDigestV1Schema,
} as const;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunCutReferenceCandidateV1Schema = z.strictObject(SourceDryRunCutShapeReferenceCandidateV1).superRefine((cut, context) => {
  if (cut.completeSourceReadClosureContentDigest !== cut.completeSourceReadClosure.completeReadClosureContentDigest) {
    addIssueV1(context, ["completeSourceReadClosureContentDigest"], "dry-run cut must pin its embedded complete source closure");
  }
  const closure = cut.completeSourceReadClosure;
  let logical = 0;
  let allocated = 0;
  try {
    for (let index = 0; index < cut.retainedArtifactUpperBounds.length; index += 1) {
      logical = checkedAddInternalV1(logical, cut.retainedArtifactUpperBounds[index]!.canonicalEnvelopeBytesUpperBoundTotal);
      allocated = checkedAddInternalV1(allocated, cut.retainedArtifactUpperBounds[index]!.providerAllocatedBytesUpperBoundTotal);
    }
  } catch {
    addIssueV1(context, ["retainedArtifactUpperBounds"], "artifact upper-bound totals must not overflow safe integers");
  }
  const charge = cut.derivedJournalChargeAmounts;
  if (charge.reservedHistoryLogicalBytes !== logical || charge.reservedHistoryProviderAllocatedBytes !== allocated) {
    addIssueV1(context, ["derivedJournalChargeAmounts"], "history charges must equal the exact eleven-kind upper-bound sums");
  }
  if (cut.sourceDryRunCutContentDigest !== deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunCutContentDigestReferenceCandidateV1(cut)) {
    addIssueV1(context, ["sourceDryRunCutContentDigest"], "source dry-run cut digest must bind the complete cut");
  }
  if (closure.rootCount > 65_536 || closure.objectCount > 1_000_000 || closure.referenceCount > 4_000_000) {
    addIssueV1(context, ["completeSourceReadClosure"], "source closure exceeds absolute reference-candidate bounds");
  }
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunCutReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunCutReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingReferenceCandidateV1Schema = z.strictObject({
  profile: z.literal("provider_migration_same_installation_identity_current_strong_source_normal_history_quota_sizing_reference_candidate_v1"),
  sizingProfile: z.literal("provider_migration_same_installation_identity_current_strong_source_normal_zero_side_effect_complete_source_streaming_dry_run_reference_candidate_v1"),
  mode: z.literal("same_installation_identity"),
  migrationBudgetsDigest: ContentDigestV1Schema,
  sourceDryRunCut: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunCutReferenceCandidateV1Schema,
  sourceDryRunCutContentDigest: ContentDigestV1Schema,
  journalChargeAmounts: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaChargeAmountsReferenceCandidateV1Schema,
}).superRefine((sizing, context) => {
  if (
    sizing.migrationBudgetsDigest !== sizing.sourceDryRunCut.migrationBudgetsDigest ||
    sizing.sourceDryRunCutContentDigest !== sizing.sourceDryRunCut.sourceDryRunCutContentDigest ||
    !canonicalEqualV1(sizing.journalChargeAmounts, sizing.sourceDryRunCut.derivedJournalChargeAmounts)
  ) {
    addIssueV1(context, ["sourceDryRunCut"], "sizing must exactly pin the dry-run cut, budgets, and derived journal charge");
  }
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingReferenceCandidateV1Schema>;

const QuotaUsageShapeReferenceCandidateV1 = {
  reservedAccountCount: NonnegativeSafeIntegerV1Schema,
  reservedHistoryLogicalBytes: NonnegativeSafeIntegerV1Schema,
  reservedHistoryProviderAllocatedBytes: NonnegativeSafeIntegerV1Schema,
  reservedObjectReceiptCount: NonnegativeSafeIntegerV1Schema,
  reservedObjectReceiptLogicalBytes: NonnegativeSafeIntegerV1Schema,
  reservedSemanticRootZeroProofCount: NonnegativeSafeIntegerV1Schema,
  reservedSemanticRootZeroProofLogicalBytes: NonnegativeSafeIntegerV1Schema,
  reservedProgressRecordCount: NonnegativeSafeIntegerV1Schema,
  reservedProgressRecordLogicalBytes: NonnegativeSafeIntegerV1Schema,
  reservedProgressOperationReceiptCount: NonnegativeSafeIntegerV1Schema,
  reservedProgressOperationReceiptLogicalBytes: NonnegativeSafeIntegerV1Schema,
  retainedAccountCount: NonnegativeSafeIntegerV1Schema,
  retainedHistoryLogicalBytes: NonnegativeSafeIntegerV1Schema,
  retainedHistoryProviderAllocatedBytes: NonnegativeSafeIntegerV1Schema,
  chargedMigrationCount: NonnegativeSafeIntegerV1Schema,
  chargedHistoryLogicalBytes: NonnegativeSafeIntegerV1Schema,
  chargedHistoryProviderAllocatedBytes: NonnegativeSafeIntegerV1Schema,
  chargedObjectReceiptCount: NonnegativeSafeIntegerV1Schema,
  chargedObjectReceiptLogicalBytes: NonnegativeSafeIntegerV1Schema,
  chargedSemanticRootZeroProofCount: NonnegativeSafeIntegerV1Schema,
  chargedSemanticRootZeroProofLogicalBytes: NonnegativeSafeIntegerV1Schema,
  chargedProgressRecordCount: NonnegativeSafeIntegerV1Schema,
  chargedProgressRecordLogicalBytes: NonnegativeSafeIntegerV1Schema,
  chargedProgressOperationReceiptCount: NonnegativeSafeIntegerV1Schema,
  chargedProgressOperationReceiptLogicalBytes: NonnegativeSafeIntegerV1Schema,
} as const;
export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1Schema = z.strictObject(QuotaUsageShapeReferenceCandidateV1);
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1Schema>;

const QuotaAccountContributionShapeReferenceCandidateV1 = {
  historyLogicalBytes: NonnegativeSafeIntegerV1Schema,
  historyProviderAllocatedBytes: NonnegativeSafeIntegerV1Schema,
  objectReceiptCount: NonnegativeSafeIntegerV1Schema,
  objectReceiptLogicalBytes: NonnegativeSafeIntegerV1Schema,
  semanticRootZeroProofCount: NonnegativeSafeIntegerV1Schema,
  semanticRootZeroProofLogicalBytes: NonnegativeSafeIntegerV1Schema,
  progressRecordCount: NonnegativeSafeIntegerV1Schema,
  progressRecordLogicalBytes: NonnegativeSafeIntegerV1Schema,
  progressOperationReceiptCount: NonnegativeSafeIntegerV1Schema,
  progressOperationReceiptLogicalBytes: NonnegativeSafeIntegerV1Schema,
} as const;
export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountContributionReferenceCandidateV1Schema = z.strictObject(QuotaAccountContributionShapeReferenceCandidateV1);
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountContributionReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountContributionReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1Schema = z.strictObject({
  accountOrdinal: OrdinalV1Schema,
  reservationOrdinal: PositiveSafeIntegerV1Schema,
  createdByOperationNonce: LowerHex32V1Schema,
  accountReferenceDigest: ContentDigestV1Schema,
  state: z.enum(["reserved", "retained"]),
  migrationSlotCount: z.literal(1),
  contribution: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountContributionReferenceCandidateV1Schema,
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1Schema>;

function zeroQuotaUsageV1(): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1 {
  return {
    reservedAccountCount: 0,
    reservedHistoryLogicalBytes: 0,
    reservedHistoryProviderAllocatedBytes: 0,
    reservedObjectReceiptCount: 0,
    reservedObjectReceiptLogicalBytes: 0,
    reservedSemanticRootZeroProofCount: 0,
    reservedSemanticRootZeroProofLogicalBytes: 0,
    reservedProgressRecordCount: 0,
    reservedProgressRecordLogicalBytes: 0,
    reservedProgressOperationReceiptCount: 0,
    reservedProgressOperationReceiptLogicalBytes: 0,
    retainedAccountCount: 0,
    retainedHistoryLogicalBytes: 0,
    retainedHistoryProviderAllocatedBytes: 0,
    chargedMigrationCount: 0,
    chargedHistoryLogicalBytes: 0,
    chargedHistoryProviderAllocatedBytes: 0,
    chargedObjectReceiptCount: 0,
    chargedObjectReceiptLogicalBytes: 0,
    chargedSemanticRootZeroProofCount: 0,
    chargedSemanticRootZeroProofLogicalBytes: 0,
    chargedProgressRecordCount: 0,
    chargedProgressRecordLogicalBytes: 0,
    chargedProgressOperationReceiptCount: 0,
    chargedProgressOperationReceiptLogicalBytes: 0,
  };
}

function addContributionToUsageV1(
  usage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1,
  account: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1,
): void {
  const contribution = account.contribution;
  usage.chargedMigrationCount = checkedAddInternalV1(usage.chargedMigrationCount, 1);
  usage.chargedHistoryLogicalBytes = checkedAddInternalV1(usage.chargedHistoryLogicalBytes, contribution.historyLogicalBytes);
  usage.chargedHistoryProviderAllocatedBytes = checkedAddInternalV1(usage.chargedHistoryProviderAllocatedBytes, contribution.historyProviderAllocatedBytes);
  usage.chargedObjectReceiptCount = checkedAddInternalV1(usage.chargedObjectReceiptCount, contribution.objectReceiptCount);
  usage.chargedObjectReceiptLogicalBytes = checkedAddInternalV1(usage.chargedObjectReceiptLogicalBytes, contribution.objectReceiptLogicalBytes);
  usage.chargedSemanticRootZeroProofCount = checkedAddInternalV1(usage.chargedSemanticRootZeroProofCount, contribution.semanticRootZeroProofCount);
  usage.chargedSemanticRootZeroProofLogicalBytes = checkedAddInternalV1(usage.chargedSemanticRootZeroProofLogicalBytes, contribution.semanticRootZeroProofLogicalBytes);
  usage.chargedProgressRecordCount = checkedAddInternalV1(usage.chargedProgressRecordCount, contribution.progressRecordCount);
  usage.chargedProgressRecordLogicalBytes = checkedAddInternalV1(usage.chargedProgressRecordLogicalBytes, contribution.progressRecordLogicalBytes);
  usage.chargedProgressOperationReceiptCount = checkedAddInternalV1(usage.chargedProgressOperationReceiptCount, contribution.progressOperationReceiptCount);
  usage.chargedProgressOperationReceiptLogicalBytes = checkedAddInternalV1(usage.chargedProgressOperationReceiptLogicalBytes, contribution.progressOperationReceiptLogicalBytes);
  if (account.state === "retained") {
    usage.retainedAccountCount = checkedAddInternalV1(usage.retainedAccountCount, 1);
    usage.retainedHistoryLogicalBytes = checkedAddInternalV1(usage.retainedHistoryLogicalBytes, contribution.historyLogicalBytes);
    usage.retainedHistoryProviderAllocatedBytes = checkedAddInternalV1(usage.retainedHistoryProviderAllocatedBytes, contribution.historyProviderAllocatedBytes);
    return;
  }
  usage.reservedAccountCount = checkedAddInternalV1(usage.reservedAccountCount, 1);
  usage.reservedHistoryLogicalBytes = checkedAddInternalV1(usage.reservedHistoryLogicalBytes, contribution.historyLogicalBytes);
  usage.reservedHistoryProviderAllocatedBytes = checkedAddInternalV1(usage.reservedHistoryProviderAllocatedBytes, contribution.historyProviderAllocatedBytes);
  usage.reservedObjectReceiptCount = checkedAddInternalV1(usage.reservedObjectReceiptCount, contribution.objectReceiptCount);
  usage.reservedObjectReceiptLogicalBytes = checkedAddInternalV1(usage.reservedObjectReceiptLogicalBytes, contribution.objectReceiptLogicalBytes);
  usage.reservedSemanticRootZeroProofCount = checkedAddInternalV1(usage.reservedSemanticRootZeroProofCount, contribution.semanticRootZeroProofCount);
  usage.reservedSemanticRootZeroProofLogicalBytes = checkedAddInternalV1(usage.reservedSemanticRootZeroProofLogicalBytes, contribution.semanticRootZeroProofLogicalBytes);
  usage.reservedProgressRecordCount = checkedAddInternalV1(usage.reservedProgressRecordCount, contribution.progressRecordCount);
  usage.reservedProgressRecordLogicalBytes = checkedAddInternalV1(usage.reservedProgressRecordLogicalBytes, contribution.progressRecordLogicalBytes);
  usage.reservedProgressOperationReceiptCount = checkedAddInternalV1(usage.reservedProgressOperationReceiptCount, contribution.progressOperationReceiptCount);
  usage.reservedProgressOperationReceiptLogicalBytes = checkedAddInternalV1(usage.reservedProgressOperationReceiptLogicalBytes, contribution.progressOperationReceiptLogicalBytes);
}

const QuotaSnapshotShapeReferenceCandidateV1 = {
  profile: z.literal("provider_migration_same_installation_identity_current_strong_source_normal_quota_snapshot_reference_candidate_v1"),
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1Schema,
  accounts: z.array(ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1Schema).max(64),
  accountCount: NonnegativeSafeIntegerV1Schema,
  accountSetDigest: ContentDigestV1Schema,
  usage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1Schema,
  reservationRecordCount: NonnegativeSafeIntegerV1Schema,
  reservationRecordSetDigest: ContentDigestV1Schema,
  reservationRecordLogicalBytes: NonnegativeSafeIntegerV1Schema,
  eventCount: NonnegativeSafeIntegerV1Schema,
  eventSetDigest: ContentDigestV1Schema,
  ledgerEventLogicalBytes: NonnegativeSafeIntegerV1Schema,
  receiptCount: NonnegativeSafeIntegerV1Schema,
  receiptSetDigest: ContentDigestV1Schema,
  operationReceiptLogicalBytes: NonnegativeSafeIntegerV1Schema,
  futureTerminalTransitionEscrowCount: NonnegativeSafeIntegerV1Schema,
  eventEscrowLogicalBytes: NonnegativeSafeIntegerV1Schema,
  receiptEscrowLogicalBytes: NonnegativeSafeIntegerV1Schema,
  quotaHighWaterReferenceDigest: ContentDigestV1Schema,
  quotaSnapshotContentDigest: ContentDigestV1Schema,
} as const;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotReferenceCandidateV1Schema = z.strictObject(QuotaSnapshotShapeReferenceCandidateV1).superRefine((snapshot, context) => {
  const digests = new CapturedSetV1<string>();
  let expectedUsage = zeroQuotaUsageV1();
  for (let index = 0; index < snapshot.accounts.length; index += 1) {
    const account = snapshot.accounts[index]!;
    if (account.accountOrdinal !== index) addIssueV1(context, ["accounts", index, "accountOrdinal"], "account ordinals must equal array positions");
    if (index > 0 && snapshot.accounts[index - 1]!.reservationOrdinal >= account.reservationOrdinal) addIssueV1(context, ["accounts", index, "reservationOrdinal"], "accounts must be strictly increasing and unique by reservation ordinal");
    const expectedDigest = deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceDigestReferenceCandidateV1({
      installationIdentityGenerationId: snapshot.installationIdentityGenerationId,
      reservationOrdinal: account.reservationOrdinal,
      createdByOperationNonce: account.createdByOperationNonce,
    });
    if (account.accountReferenceDigest !== expectedDigest) addIssueV1(context, ["accounts", index, "accountReferenceDigest"], "account reference digest must bind Identity, reservation ordinal, and creation nonce");
    if (setHasV1(digests, account.accountReferenceDigest)) addIssueV1(context, ["accounts", index, "accountReferenceDigest"], "account reference digests must be unique");
    setAddV1(digests, account.accountReferenceDigest);
    try {
      addContributionToUsageV1(expectedUsage, account);
    } catch {
      addIssueV1(context, ["accounts", index, "contribution"], "account contribution fold must not overflow safe integers");
    }
  }
  expectedUsage = ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1Schema.parse(expectedUsage);
  if (snapshot.accountCount !== snapshot.accounts.length) addIssueV1(context, ["accountCount"], "account count must equal complete account projection length");
  if (snapshot.accountSetDigest !== deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountSetDigestReferenceCandidateV1({ entries: snapshot.accounts })) addIssueV1(context, ["accountSetDigest"], "account set digest must bind all ordered account projections");
  if (!canonicalEqualV1(snapshot.usage, expectedUsage)) addIssueV1(context, ["usage"], "quota usage must be independently folded from the complete account set");
  let expectedFuture = 0;
  try {
    expectedFuture = checkedAddInternalV1(checkedMultiplyInternalV1(snapshot.usage.reservedAccountCount, 3), snapshot.usage.retainedAccountCount);
  } catch {
    addIssueV1(context, ["futureTerminalTransitionEscrowCount"], "terminal escrow count must not overflow");
  }
  if (
    snapshot.futureTerminalTransitionEscrowCount !== expectedFuture ||
    snapshot.eventEscrowLogicalBytes !== checkedMultiplyInternalV1(expectedFuture, 262_144) ||
    snapshot.receiptEscrowLogicalBytes !== checkedMultiplyInternalV1(expectedFuture, 1_048_576)
  ) {
    addIssueV1(context, ["futureTerminalTransitionEscrowCount"], "terminal event and receipt escrow must be exactly derived from account states");
  }
  if (snapshot.quotaSnapshotContentDigest !== deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotContentDigestReferenceCandidateV1(snapshot)) {
    addIssueV1(context, ["quotaSnapshotContentDigest"], "quota snapshot digest must bind the complete public snapshot");
  }
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotReferenceCandidateV1Schema>;

const QuotaAccountStateShapeReferenceCandidateV1 = {
  profile: z.literal("provider_migration_same_installation_identity_current_strong_source_normal_quota_account_state_reference_candidate_v1"),
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1Schema,
  accounts: z.array(ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1Schema).max(64),
  accountCount: NonnegativeSafeIntegerV1Schema,
  accountSetDigest: ContentDigestV1Schema,
  usage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1Schema,
  futureTerminalTransitionEscrowCount: NonnegativeSafeIntegerV1Schema,
  eventEscrowLogicalBytes: NonnegativeSafeIntegerV1Schema,
  receiptEscrowLogicalBytes: NonnegativeSafeIntegerV1Schema,
  contentDigest: ContentDigestV1Schema,
} as const;
export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountStateReferenceCandidateV1Schema = z.strictObject(QuotaAccountStateShapeReferenceCandidateV1).superRefine((state, context) => {
  if (state.accountCount !== state.accounts.length) addIssueV1(context, ["accountCount"], "account-state count must equal the complete account set length");
  if (state.accountSetDigest !== deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountSetDigestReferenceCandidateV1({ entries: state.accounts })) addIssueV1(context, ["accountSetDigest"], "account-state set digest must bind all ordered accounts");
  if (state.contentDigest !== deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountStateContentDigestReferenceCandidateV1(state)) addIssueV1(context, ["contentDigest"], "account-state digest must bind the complete cycle-free account-state projection");
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountStateReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountStateReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalControlUpperBoundsReferenceCandidateV1Schema = z.strictObject({
  reservationRecordCountIncrement: z.literal(1),
  reservationRecordLogicalBytesUpperBound: z.literal(1_048_576),
  reserveEventCountIncrement: z.literal(1),
  reserveEventLogicalBytesUpperBound: z.literal(262_144),
  reserveReceiptCountIncrement: z.literal(1),
  reserveReceiptLogicalBytesUpperBound: z.literal(1_048_576),
  postReserveFutureTerminalTransitionEscrowCount: NonnegativeSafeIntegerV1Schema,
  prospectiveEventCountIncludingEscrow: NonnegativeSafeIntegerV1Schema,
  prospectiveEventLogicalBytesIncludingEscrow: NonnegativeSafeIntegerV1Schema,
  prospectiveReceiptCountIncludingEscrow: NonnegativeSafeIntegerV1Schema,
  prospectiveReceiptLogicalBytesIncludingEscrow: NonnegativeSafeIntegerV1Schema,
  prospectiveReservationRecordCount: NonnegativeSafeIntegerV1Schema,
  prospectiveReservationRecordLogicalBytes: NonnegativeSafeIntegerV1Schema,
  currentHighWaterLogicalBytesUpperBound: z.literal(1_048_576),
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalControlUpperBoundsReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalControlUpperBoundsReferenceCandidateV1Schema>;

const QuotaChargeWithRoleReferenceCandidateV1Schema = ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaChargeAmountsReferenceCandidateV1Schema.extend({
  role: z.literal("same_identity_journal"),
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1Schema,
  policyDigest: ContentDigestV1Schema,
  migrationSlotCount: z.literal(1),
});

const MAX_CHARGED_OBJECT_RECEIPT_COUNT_REFERENCE_CANDIDATE_V1 = 2_000_000;
const MAX_CHARGED_OBJECT_RECEIPT_LOGICAL_BYTES_REFERENCE_CANDIDATE_V1 = 2_147_483_648;
const MAX_CHARGED_SEMANTIC_ROOT_ZERO_PROOF_COUNT_REFERENCE_CANDIDATE_V1 = 4_000_512;
const MAX_CHARGED_SEMANTIC_ROOT_ZERO_PROOF_LOGICAL_BYTES_REFERENCE_CANDIDATE_V1 = 2_147_483_648;
const MAX_CHARGED_PROGRESS_RECORD_COUNT_REFERENCE_CANDIDATE_V1 = 4_000_032;
const MAX_CHARGED_PROGRESS_RECORD_LOGICAL_BYTES_REFERENCE_CANDIDATE_V1 = 2_147_483_648;
const MAX_CHARGED_PROGRESS_OPERATION_RECEIPT_COUNT_REFERENCE_CANDIDATE_V1 = 8_000_000;
const MAX_CHARGED_PROGRESS_OPERATION_RECEIPT_LOGICAL_BYTES_REFERENCE_CANDIDATE_V1 = 2_147_483_648;

function addQuotaUsageHardCapIssueV1(
  context: z.RefinementCtx,
  field: keyof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1,
): void {
  addIssueV1(
    context,
    ["prospectiveChargedUsage", field],
    "normal admission prospective quota usage exceeds the fixed per-category hard cap",
  );
}

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema = z.strictObject({
  profile: z.literal("provider_migration_same_installation_identity_current_strong_source_normal_history_quota_admission_reference_candidate_v1"),
  mode: z.literal("same_installation_identity"),
  admissionClass: z.literal("normal"),
  sizingDigest: ContentDigestV1Schema,
  quotaSnapshot: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotReferenceCandidateV1Schema,
  charges: z.tuple([QuotaChargeWithRoleReferenceCandidateV1Schema]),
  prospectiveChargedUsage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1Schema,
  controlUpperBounds: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalControlUpperBoundsReferenceCandidateV1Schema,
  decision: z.literal("reference_admissible_at_captured_snapshot"),
}).superRefine((admission, context) => {
  const snapshot = admission.quotaSnapshot;
  const charge = admission.charges[0];
  if (charge.installationIdentityGenerationId !== snapshot.installationIdentityGenerationId) addIssueV1(context, ["charges", 0, "installationIdentityGenerationId"], "single journal charge must use the quota snapshot Identity");
  let expectedUsage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1 | undefined;
  try {
    expectedUsage = deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveChargedUsageReferenceCandidateV1({ usage: snapshot.usage, charge });
  } catch {
    addIssueV1(context, ["prospectiveChargedUsage"], "prospective quota usage must use non-overflowing checked additions");
  }
  if (expectedUsage !== undefined && !canonicalEqualV1(expectedUsage, admission.prospectiveChargedUsage)) addIssueV1(context, ["prospectiveChargedUsage"], "prospective usage must equal pre usage plus the single journal charge");
  const bounds = admission.controlUpperBounds;
  let postE = 0;
  try {
    postE = checkedAddInternalV1(snapshot.futureTerminalTransitionEscrowCount, 3);
    const expected = {
      prospectiveEventCountIncludingEscrow: checkedAddInternalV1(checkedAddInternalV1(snapshot.eventCount, 1), postE),
      prospectiveEventLogicalBytesIncludingEscrow: checkedAddInternalV1(checkedAddInternalV1(snapshot.ledgerEventLogicalBytes, 262_144), checkedMultiplyInternalV1(postE, 262_144)),
      prospectiveReceiptCountIncludingEscrow: checkedAddInternalV1(checkedAddInternalV1(snapshot.receiptCount, 1), postE),
      prospectiveReceiptLogicalBytesIncludingEscrow: checkedAddInternalV1(checkedAddInternalV1(snapshot.operationReceiptLogicalBytes, 1_048_576), checkedMultiplyInternalV1(postE, 1_048_576)),
      prospectiveReservationRecordCount: checkedAddInternalV1(snapshot.reservationRecordCount, 1),
      prospectiveReservationRecordLogicalBytes: checkedAddInternalV1(snapshot.reservationRecordLogicalBytes, 1_048_576),
    };
    if (
      bounds.postReserveFutureTerminalTransitionEscrowCount !== postE ||
      bounds.prospectiveEventCountIncludingEscrow !== expected.prospectiveEventCountIncludingEscrow ||
      bounds.prospectiveEventLogicalBytesIncludingEscrow !== expected.prospectiveEventLogicalBytesIncludingEscrow ||
      bounds.prospectiveReceiptCountIncludingEscrow !== expected.prospectiveReceiptCountIncludingEscrow ||
      bounds.prospectiveReceiptLogicalBytesIncludingEscrow !== expected.prospectiveReceiptLogicalBytesIncludingEscrow ||
      bounds.prospectiveReservationRecordCount !== expected.prospectiveReservationRecordCount ||
      bounds.prospectiveReservationRecordLogicalBytes !== expected.prospectiveReservationRecordLogicalBytes
    ) addIssueV1(context, ["controlUpperBounds"], "control upper bounds must be uniquely derived from the captured snapshot and terminal escrow");
  } catch {
    addIssueV1(context, ["controlUpperBounds"], "control upper-bound arithmetic must not overflow");
  }
  if (
    bounds.prospectiveEventCountIncludingEscrow > 4_096 ||
    bounds.prospectiveEventLogicalBytesIncludingEscrow > 67_108_864 ||
    bounds.prospectiveReceiptCountIncludingEscrow > 4_096 ||
    bounds.prospectiveReceiptLogicalBytesIncludingEscrow > 268_435_456 ||
    bounds.prospectiveReservationRecordCount > 4_096 ||
    bounds.prospectiveReservationRecordLogicalBytes > 67_108_864
  ) addIssueV1(context, ["controlUpperBounds"], "prospective ledger control usage exceeds a fixed hard cap");
  if (
    charge.reservedHistoryLogicalBytes > 4_294_967_296 ||
    charge.reservedHistoryProviderAllocatedBytes > 8_589_934_592 ||
    admission.prospectiveChargedUsage.chargedMigrationCount > 63 ||
    admission.prospectiveChargedUsage.chargedHistoryLogicalBytes > 4_294_967_296 ||
    admission.prospectiveChargedUsage.chargedHistoryProviderAllocatedBytes > 8_589_934_592 ||
    admission.prospectiveChargedUsage.reservedAccountCount > 4 ||
    admission.prospectiveChargedUsage.reservedHistoryLogicalBytes > 8_589_934_592 ||
    admission.prospectiveChargedUsage.reservedHistoryProviderAllocatedBytes > 17_179_869_184
  ) addIssueV1(context, ["prospectiveChargedUsage"], "normal admission must preserve the final migration and 4/8 GiB emergency reserve without crossing hard caps");
  const prospective = admission.prospectiveChargedUsage;
  if (prospective.chargedObjectReceiptCount > MAX_CHARGED_OBJECT_RECEIPT_COUNT_REFERENCE_CANDIDATE_V1) addQuotaUsageHardCapIssueV1(context, "chargedObjectReceiptCount");
  if (prospective.chargedObjectReceiptLogicalBytes > MAX_CHARGED_OBJECT_RECEIPT_LOGICAL_BYTES_REFERENCE_CANDIDATE_V1) addQuotaUsageHardCapIssueV1(context, "chargedObjectReceiptLogicalBytes");
  if (prospective.chargedSemanticRootZeroProofCount > MAX_CHARGED_SEMANTIC_ROOT_ZERO_PROOF_COUNT_REFERENCE_CANDIDATE_V1) addQuotaUsageHardCapIssueV1(context, "chargedSemanticRootZeroProofCount");
  if (prospective.chargedSemanticRootZeroProofLogicalBytes > MAX_CHARGED_SEMANTIC_ROOT_ZERO_PROOF_LOGICAL_BYTES_REFERENCE_CANDIDATE_V1) addQuotaUsageHardCapIssueV1(context, "chargedSemanticRootZeroProofLogicalBytes");
  if (prospective.chargedProgressRecordCount > MAX_CHARGED_PROGRESS_RECORD_COUNT_REFERENCE_CANDIDATE_V1) addQuotaUsageHardCapIssueV1(context, "chargedProgressRecordCount");
  if (prospective.chargedProgressRecordLogicalBytes > MAX_CHARGED_PROGRESS_RECORD_LOGICAL_BYTES_REFERENCE_CANDIDATE_V1) addQuotaUsageHardCapIssueV1(context, "chargedProgressRecordLogicalBytes");
  if (prospective.chargedProgressOperationReceiptCount > MAX_CHARGED_PROGRESS_OPERATION_RECEIPT_COUNT_REFERENCE_CANDIDATE_V1) addQuotaUsageHardCapIssueV1(context, "chargedProgressOperationReceiptCount");
  if (prospective.chargedProgressOperationReceiptLogicalBytes > MAX_CHARGED_PROGRESS_OPERATION_RECEIPT_LOGICAL_BYTES_REFERENCE_CANDIDATE_V1) addQuotaUsageHardCapIssueV1(context, "chargedProgressOperationReceiptLogicalBytes");
  if (prospective.reservedObjectReceiptCount > MAX_CHARGED_OBJECT_RECEIPT_COUNT_REFERENCE_CANDIDATE_V1) addQuotaUsageHardCapIssueV1(context, "reservedObjectReceiptCount");
  if (prospective.reservedObjectReceiptLogicalBytes > MAX_CHARGED_OBJECT_RECEIPT_LOGICAL_BYTES_REFERENCE_CANDIDATE_V1) addQuotaUsageHardCapIssueV1(context, "reservedObjectReceiptLogicalBytes");
  if (prospective.reservedSemanticRootZeroProofCount > MAX_CHARGED_SEMANTIC_ROOT_ZERO_PROOF_COUNT_REFERENCE_CANDIDATE_V1) addQuotaUsageHardCapIssueV1(context, "reservedSemanticRootZeroProofCount");
  if (prospective.reservedSemanticRootZeroProofLogicalBytes > MAX_CHARGED_SEMANTIC_ROOT_ZERO_PROOF_LOGICAL_BYTES_REFERENCE_CANDIDATE_V1) addQuotaUsageHardCapIssueV1(context, "reservedSemanticRootZeroProofLogicalBytes");
  if (prospective.reservedProgressRecordCount > MAX_CHARGED_PROGRESS_RECORD_COUNT_REFERENCE_CANDIDATE_V1) addQuotaUsageHardCapIssueV1(context, "reservedProgressRecordCount");
  if (prospective.reservedProgressRecordLogicalBytes > MAX_CHARGED_PROGRESS_RECORD_LOGICAL_BYTES_REFERENCE_CANDIDATE_V1) addQuotaUsageHardCapIssueV1(context, "reservedProgressRecordLogicalBytes");
  if (prospective.reservedProgressOperationReceiptCount > MAX_CHARGED_PROGRESS_OPERATION_RECEIPT_COUNT_REFERENCE_CANDIDATE_V1) addQuotaUsageHardCapIssueV1(context, "reservedProgressOperationReceiptCount");
  if (prospective.reservedProgressOperationReceiptLogicalBytes > MAX_CHARGED_PROGRESS_OPERATION_RECEIPT_LOGICAL_BYTES_REFERENCE_CANDIDATE_V1) addQuotaUsageHardCapIssueV1(context, "reservedProgressOperationReceiptLogicalBytes");
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReservationDescriptorReferenceCandidateV1Schema = z.strictObject({
  profile: z.literal("provider_migration_same_installation_identity_current_strong_source_normal_history_quota_reservation_descriptor_reference_candidate_v1"),
  locatorProfile: z.literal("provider_migration_same_installation_identity_current_strong_source_normal_history_quota_reservation_reference_candidate_v1"),
  reservationId: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectHistoryQuotaReservationReferenceCandidateIdV1Schema,
  migrationId: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateIdV1Schema,
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1Schema,
  role: z.literal("same_identity_journal"),
  admissionVectorDigest: ContentDigestV1Schema,
}).superRefine((descriptor, context) => {
  if (descriptor.reservationId !== deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReservationIdReferenceCandidateV1(descriptor)) {
    addIssueV1(context, ["reservationId"], "reservation ID must bind migration, role, Identity, and admission vector only");
  }
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReservationDescriptorReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReservationDescriptorReferenceCandidateV1Schema>;

const InitialDestinationAbsentReferenceCandidateV1Schema = z.strictObject({
  state: z.literal("absent"),
  namespace: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceReferenceCandidateV1Schema,
  providerBinding: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceCandidateV1Schema,
  absenceReferenceDigest: ContentDigestV1Schema,
}).superRefine((value, context) => {
  if (value.absenceReferenceDigest !== deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestAbsenceReferenceDigestReferenceCandidateV1(value)) {
    addIssueV1(context, ["absenceReferenceDigest"], "destination absence digest must bind namespace and provider binding only");
  }
});
const InitialDestinationCurrentReferenceCandidateV1Schema = z.strictObject({
  state: z.literal("current"),
  current: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1Schema,
});
export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalInitialDestinationNamespaceReferenceCandidateV1Schema = z.discriminatedUnion("state", [
  InitialDestinationAbsentReferenceCandidateV1Schema,
  InitialDestinationCurrentReferenceCandidateV1Schema,
]);
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalInitialDestinationNamespaceReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalInitialDestinationNamespaceReferenceCandidateV1Schema>;

const SourceEndpointTrustOnlyReferenceCandidateV1Schema = ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1Schema.refine(
  (trust) => trust.role === "source_current_strong_writer",
  "sourceTrust must use the source current-writer branch",
);
const DestinationEndpointTrustOnlyReferenceCandidateV1Schema = ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1Schema.refine(
  (trust) => trust.role === "destination_prospective_not_selected",
  "destinationTrust must use the prospective destination branch",
);

const PlanPayloadShapeReferenceCandidateV1 = {
  profile: z.literal("provider_migration_same_installation_identity_current_strong_source_normal_plan_payload_reference_candidate_v1"),
  mode: z.literal("same_installation_identity"),
  migrationId: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateIdV1Schema,
  reason: z.literal("provider_decommission"),
  identityRelationship: z.literal("source_destination_exact_same"),
  sourceNamespace: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceReferenceCandidateV1Schema,
  destinationNamespace: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceReferenceCandidateV1Schema,
  namespaceTranslation: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceCandidateV1Schema,
  targetProfileId: ProviderTargetProfileIdV1Schema,
  sourceTrust: SourceEndpointTrustOnlyReferenceCandidateV1Schema,
  destinationTrust: DestinationEndpointTrustOnlyReferenceCandidateV1Schema,
  initialSourceStoreManifest: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1Schema,
  initialDestinationNamespace: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalInitialDestinationNamespaceReferenceCandidateV1Schema,
  journalAuthorityInstallationIdentityGenerationId: InstallationIdentityGenerationIdV1Schema,
  progressJournalLocatorProfile: z.literal("provider_migration_same_installation_identity_current_strong_source_normal_progress_head_reference_candidate_v1"),
  migrationBudgets: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1Schema,
  migrationBudgetsDigest: ContentDigestV1Schema,
  migrationHistoryQuotaSizing: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingReferenceCandidateV1Schema,
  migrationHistoryQuotaSizingDigest: ContentDigestV1Schema,
  migrationHistoryQuotaAdmission: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema,
  admissionVectorDigest: ContentDigestV1Schema,
  migrationHistoryQuotaReservations: z.strictObject({
    mode: z.literal("same_installation_identity"),
    journal: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReservationDescriptorReferenceCandidateV1Schema,
  }),
  liveReferenceSchemaDigest: ContentDigestV1Schema,
  migrationProtocolDigest: ContentDigestV1Schema,
  createdAt: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCreatedAtReferenceCandidateV1Schema,
} as const;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanPayloadReferenceCandidateV1Schema = z.strictObject(PlanPayloadShapeReferenceCandidateV1).superRefine((plan, context) => {
  const sourceTrust = plan.sourceTrust;
  const destinationTrust = plan.destinationTrust;
  if (sourceTrust.role !== "source_current_strong_writer" || destinationTrust.role !== "destination_prospective_not_selected") return;
  if (
    !canonicalEqualV1(plan.sourceNamespace, plan.destinationNamespace) ||
    !canonicalEqualV1(plan.sourceNamespace, plan.namespaceTranslation.sourceNamespace) ||
    !canonicalEqualV1(plan.destinationNamespace, plan.namespaceTranslation.destinationNamespace) ||
    !canonicalEqualV1(plan.sourceNamespace, plan.initialSourceStoreManifest.namespace) ||
    plan.journalAuthorityInstallationIdentityGenerationId !== plan.sourceNamespace.installationIdentityGenerationId ||
    plan.targetProfileId !== sourceTrust.targetProfileId ||
    plan.targetProfileId !== destinationTrust.targetProfileId
  ) addIssueV1(context, ["namespaceTranslation"], "Plan namespaces, journal Identity, Store namespace, target, and translation must close exactly");
  if (
    sourceTrust.installationIdentityGenerationId !== plan.sourceNamespace.installationIdentityGenerationId ||
    destinationTrust.installationIdentityGenerationId !== plan.sourceNamespace.installationIdentityGenerationId ||
    !canonicalEqualV1(sourceTrust.currentAcceptanceRead, destinationTrust.currentAcceptanceRead) ||
    !canonicalEqualV1(sourceTrust.retainedAcceptanceGenerations, destinationTrust.retainedAcceptanceGenerations)
  ) addIssueV1(context, ["destinationTrust"], "source and destination trust must share the exact Plan Identity, current Acceptance read, and retained Acceptance cut");
  const sourceSelection = sourceTrust.currentWriterSelection;
  const sourceBinding = plan.initialSourceStoreManifest.providerBinding;
  const sourceBindingProjection = {
    targetProfileId: sourceBinding.targetProfileId,
    providerId: sourceBinding.providerId,
    registryEntryContentDigest: sourceBinding.registryEntryContentDigest,
    semanticProviderPolicyDigest: sourceBinding.semanticProviderPolicyDigest,
    providerFeasibilityEvidence: sourceBinding.providerFeasibilityEvidence,
    runtimeAttestationContentDigest: sourceBinding.runtimeAttestationContentDigest,
    bindingDerivationKeyGeneration: sourceBinding.bindingDerivationKeyGeneration,
  };
  if (!canonicalEqualV1(sourceSelection, sourceBindingProjection)) addIssueV1(context, ["initialSourceStoreManifest", "providerBinding"], "source Store binding exact7 must equal the selected current writer");
  const destinationProjection = destinationTrust.prospectiveWriterProjection;
  const destinationBinding = plan.initialDestinationNamespace.state === "absent"
    ? plan.initialDestinationNamespace.providerBinding
    : plan.initialDestinationNamespace.current.providerBinding;
  const destinationBindingProjection = {
    targetProfileId: destinationBinding.targetProfileId,
    providerId: destinationBinding.providerId,
    registryEntryContentDigest: destinationBinding.registryEntryContentDigest,
    semanticProviderPolicyDigest: destinationBinding.semanticProviderPolicyDigest,
    providerFeasibilityEvidence: destinationBinding.providerFeasibilityEvidence,
    runtimeAttestationContentDigest: destinationBinding.runtimeAttestationContentDigest,
    bindingDerivationKeyGeneration: destinationBinding.bindingDerivationKeyGeneration,
  };
  if (!canonicalEqualV1(destinationProjection, destinationBindingProjection)) addIssueV1(context, ["initialDestinationNamespace"], "initial destination Store binding exact7 must equal the prospective writer projection");
  const destinationNamespace = plan.initialDestinationNamespace.state === "absent"
    ? plan.initialDestinationNamespace.namespace
    : plan.initialDestinationNamespace.current.namespace;
  if (!canonicalEqualV1(destinationNamespace, plan.destinationNamespace)) addIssueV1(context, ["initialDestinationNamespace"], "initial destination branch must use the Plan destination namespace");
  if (sourceBinding.providerId === destinationBinding.providerId) addIssueV1(context, ["destinationTrust"], "source and destination provider IDs must differ");
  if (plan.migrationBudgetsDigest !== deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationBudgetsDigestReferenceCandidateV1(plan.migrationBudgets)) addIssueV1(context, ["migrationBudgetsDigest"], "Plan budgets digest must bind the complete budgets DTO");
  if (
    plan.migrationHistoryQuotaSizing.migrationBudgetsDigest !== plan.migrationBudgetsDigest ||
    plan.migrationHistoryQuotaSizingDigest !== deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingDigestReferenceCandidateV1(plan.migrationHistoryQuotaSizing) ||
    plan.migrationHistoryQuotaAdmission.sizingDigest !== plan.migrationHistoryQuotaSizingDigest ||
    plan.admissionVectorDigest !== deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionVectorDigestReferenceCandidateV1(plan.migrationHistoryQuotaAdmission)
  ) addIssueV1(context, ["migrationHistoryQuotaSizing"], "Plan budgets, sizing, and admission digest chain must close exactly");
  const descriptor = plan.migrationHistoryQuotaReservations.journal;
  if (
    descriptor.migrationId !== plan.migrationId ||
    descriptor.installationIdentityGenerationId !== plan.journalAuthorityInstallationIdentityGenerationId ||
    descriptor.admissionVectorDigest !== plan.admissionVectorDigest
  ) addIssueV1(context, ["migrationHistoryQuotaReservations", "journal"], "journal descriptor must pin the Plan migration, Identity, and admission vector");
  if (plan.migrationId !== deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationIdReferenceCandidateV1(plan)) addIssueV1(context, ["migrationId"], "migration candidate ID must bind the exact cycle-free semantic projection");
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanPayloadReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanPayloadReferenceCandidateV1Schema>;

const PlanEnvelopeShapeReferenceCandidateV1 = {
  schemaVersion: z.literal(1),
  recordType: z.literal("provider_migration_same_installation_identity_current_strong_source_normal_plan_reference_candidate"),
  mode: z.literal("same_installation_identity"),
  migrationId: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateIdV1Schema,
  sourceRepositoryId: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRepositoryReferenceCandidateIdV1Schema,
  sourceWorktreeId: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalWorktreeReferenceCandidateIdV1Schema,
  destinationRepositoryId: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRepositoryReferenceCandidateIdV1Schema,
  destinationWorktreeId: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalWorktreeReferenceCandidateIdV1Schema,
  createdAt: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCreatedAtReferenceCandidateV1Schema,
  contentDigest: ContentDigestV1Schema,
  payload: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanPayloadReferenceCandidateV1Schema,
} as const;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanEnvelopeReferenceCandidateV1Schema = z.strictObject(PlanEnvelopeShapeReferenceCandidateV1).superRefine((envelope, context) => {
  const payload = envelope.payload;
  if (
    envelope.mode !== payload.mode ||
    envelope.migrationId !== payload.migrationId ||
    envelope.sourceRepositoryId !== payload.sourceNamespace.repositoryId ||
    envelope.sourceWorktreeId !== payload.sourceNamespace.worktreeId ||
    envelope.destinationRepositoryId !== payload.destinationNamespace.repositoryId ||
    envelope.destinationWorktreeId !== payload.destinationNamespace.worktreeId ||
    envelope.createdAt !== payload.createdAt
  ) addIssueV1(context, ["payload"], "Plan Envelope outer mode, identity, namespaces, and createdAt must equal payload");
  if (envelope.contentDigest !== deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanContentDigestReferenceCandidateV1(payload)) addIssueV1(context, ["contentDigest"], "Plan content digest must bind the complete Plan payload");
  if (canonicalByteLengthV1(envelope) > payload.migrationBudgets.maxSingleRecordBytes) addIssueV1(context, [], "complete canonical Plan Envelope exceeds the exact 4 MiB single-record cap");
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanEnvelopeReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanEnvelopeReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalObservationReferenceCandidateV1Schema = z.strictObject({
  sourceStoreCutContentDigest: ContentDigestV1Schema,
  sourceFreezeStateReferenceDigest: ContentDigestV1Schema,
  sourceTrustClosureContentDigest: ContentDigestV1Schema,
  destinationTrustClosureContentDigest: ContentDigestV1Schema,
  destinationNamespaceObservationDigest: ContentDigestV1Schema,
  quotaSnapshotContentDigest: ContentDigestV1Schema,
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalObservationReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalObservationReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrePostObservationEqualityReferenceCandidateV1Schema = z.strictObject({
  profile: z.literal("provider_migration_same_installation_identity_current_strong_source_normal_pre_post_observation_equality_reference_candidate_v1"),
  pre: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalObservationReferenceCandidateV1Schema,
  post: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalObservationReferenceCandidateV1Schema,
  equality: z.literal("exact"),
  equalityContentDigest: ContentDigestV1Schema,
}).superRefine((equality, context) => {
  if (!canonicalEqualV1(equality.pre, equality.post)) addIssueV1(context, ["post"], "post observation must exactly equal pre observation");
  if (equality.equalityContentDigest !== deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrePostObservationEqualityContentDigestReferenceCandidateV1(equality)) addIssueV1(context, ["equalityContentDigest"], "pre/post equality digest must bind both full observations and exact equality");
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrePostObservationEqualityReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrePostObservationEqualityReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaReferenceObservationReferenceCandidateV1Schema = z.strictObject({
  preSnapshotContentDigest: ContentDigestV1Schema,
  postSnapshotContentDigest: ContentDigestV1Schema,
  equality: z.literal("exact"),
  observationContentDigest: ContentDigestV1Schema,
}).superRefine((observation, context) => {
  if (observation.preSnapshotContentDigest !== observation.postSnapshotContentDigest) addIssueV1(context, ["postSnapshotContentDigest"], "post quota snapshot must exactly equal pre snapshot");
  if (observation.observationContentDigest !== deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaObservationContentDigestReferenceCandidateV1(observation)) addIssueV1(context, ["observationContentDigest"], "quota observation digest must bind pre/post snapshot digests and exact equality");
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaReferenceObservationReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaReferenceObservationReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectBoundaryReferenceCandidateV1Schema = z.strictObject({
  policy: z.literal("zero_side_effect_before_first_same_installation_identity_migration_history_quota_reservation_write_reference_candidate_v1"),
  reservationWrites: z.literal(0),
  planPublications: z.literal(0),
  acceptanceAppends: z.literal(0),
  progressAppends: z.literal(0),
  operationReceiptWrites: z.literal(0),
  destinationObjectAllocations: z.literal(0),
  quotaConsumptions: z.literal(0),
  emergencyReserveConsumptions: z.literal(0),
  pendingIntents: z.literal(0),
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectBoundaryReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectBoundaryReferenceCandidateV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalVerificationBoundaryReferenceCandidateV1Schema = z.strictObject({
  hashDag: z.literal("self_contained_public_projection_recomputable_v1"),
  sourceCompleteness: z.literal("same_operation_opaque_streaming_capability_exact_once_eof_and_pre_post_continuity_v1"),
  locatorAuthenticity: z.literal("same_cohort_live_reference_schema_bound_strict_locator_commitment_deriver_v1"),
  referenceSlotAuthenticity: z.literal("same_cohort_live_reference_schema_bound_exact_slot_enumerator_and_commitment_deriver_v1"),
  quotaCompleteness: z.literal("same_cohort_opaque_quota_machine_complete_snapshot_and_pre_post_continuity_v1"),
  quotaLedgerSemantics: z.literal("same_cohort_machine_opaque_request_commitment_linkage_without_public_request_replay_v1"),
  endpointTrustAuthenticity: z.literal("same_cohort_opaque_retained_root_registry_catalog_universe_evidence_runtime_closure_v1"),
  prospectiveRegistryMaterialOwnership: z.literal("same_cohort_copied_retained_registry_state_read_only_temporary_admit_no_public_key_material_alias_except_identical_current_feasibility_approver_records_v1"),
  prospectiveDestination: z.literal("signed_genesis_registry_entry_evidence_runtime_and_universe_target_not_catalog_or_manifest_admitted_v1"),
  catalogAdmission: z.literal("none"),
  registryMembership: z.literal("none"),
  migrationPreparedManifest: z.literal("none"),
  formalMigrationIdMapping: z.literal("none"),
  providerAuthority: z.literal("none"),
  durability: z.literal("none"),
  migrationExecution: z.literal("none"),
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalVerificationBoundaryReferenceCandidateV1 = z.infer<typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalVerificationBoundaryReferenceCandidateV1Schema>;

const ValidationShapeReferenceCandidateV1 = {
  authority: z.literal("none_provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_plan_admission_closure_reference_candidate_only"),
  profile: z.literal("provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_plan_admission_closure_reference_candidate_v1"),
  stopPoint: z.literal("before_same_installation_identity_migration_history_quota_reservation_write"),
  requestContentDigest: ContentDigestV1Schema,
  mode: z.literal("same_installation_identity"),
  reason: z.literal("provider_decommission"),
  admissionClass: z.literal("normal"),
  createdAt: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCreatedAtReferenceCandidateV1Schema,
  sourceTrust: SourceEndpointTrustOnlyReferenceCandidateV1Schema,
  destinationTrust: DestinationEndpointTrustOnlyReferenceCandidateV1Schema,
  namespaceTranslation: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceCandidateV1Schema,
  completeSourceReadClosure: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1Schema,
  sourceDryRunCut: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunCutReferenceCandidateV1Schema,
  migrationBudgetsDigest: ContentDigestV1Schema,
  historyQuotaSizing: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingReferenceCandidateV1Schema,
  historyQuotaSizingDigest: ContentDigestV1Schema,
  historyQuotaAdmission: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema,
  admissionVectorDigest: ContentDigestV1Schema,
  quotaReferenceSnapshot: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotReferenceCandidateV1Schema,
  quotaReferenceObservation: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaReferenceObservationReferenceCandidateV1Schema,
  migrationId: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateIdV1Schema,
  reservationDescriptors: z.tuple([ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReservationDescriptorReferenceCandidateV1Schema]),
  planCandidate: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanEnvelopeReferenceCandidateV1Schema,
  prePostObservationEquality: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrePostObservationEqualityReferenceCandidateV1Schema,
  sideEffectBoundary: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectBoundaryReferenceCandidateV1Schema,
  verificationBoundary: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalVerificationBoundaryReferenceCandidateV1Schema,
  closureContentDigest: ContentDigestV1Schema,
} as const;

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1 {
  authority: "none_provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_plan_admission_closure_reference_candidate_only";
  profile: "provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_plan_admission_closure_reference_candidate_v1";
  stopPoint: "before_same_installation_identity_migration_history_quota_reservation_write";
  requestContentDigest: ContentDigestV1;
  mode: "same_installation_identity";
  reason: "provider_decommission";
  admissionClass: "normal";
  createdAt: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCreatedAtReferenceCandidateV1;
  sourceTrust: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1 & { role: "source_current_strong_writer" };
  destinationTrust: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1 & { role: "destination_prospective_not_selected" };
  namespaceTranslation: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceCandidateV1;
  completeSourceReadClosure: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1;
  sourceDryRunCut: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunCutReferenceCandidateV1;
  migrationBudgetsDigest: ContentDigestV1;
  historyQuotaSizing: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingReferenceCandidateV1;
  historyQuotaSizingDigest: ContentDigestV1;
  historyQuotaAdmission: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1;
  admissionVectorDigest: ContentDigestV1;
  quotaReferenceSnapshot: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotReferenceCandidateV1;
  quotaReferenceObservation: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaReferenceObservationReferenceCandidateV1;
  migrationId: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateIdV1;
  reservationDescriptors: [ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReservationDescriptorReferenceCandidateV1];
  planCandidate: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanEnvelopeReferenceCandidateV1;
  prePostObservationEquality: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrePostObservationEqualityReferenceCandidateV1;
  sideEffectBoundary: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectBoundaryReferenceCandidateV1;
  verificationBoundary: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalVerificationBoundaryReferenceCandidateV1;
  closureContentDigest: ContentDigestV1;
}

function expectedDestinationObservationDigestV1(
  destination: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalInitialDestinationNamespaceReferenceCandidateV1,
): ContentDigestV1 {
  return destination.state === "absent"
    ? destination.absenceReferenceDigest
    : destination.current.cutContentDigest;
}

function refineValidationV1(
  value: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1,
  context: z.RefinementCtx,
): void {
  const planEnvelope = value.planCandidate;
  const plan = planEnvelope.payload;
  if (value.sourceTrust.role !== "source_current_strong_writer" || value.destinationTrust.role !== "destination_prospective_not_selected") return;
  const request = {
    profile: "provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_request_reference_candidate_v1" as const,
    mode: value.mode,
    reason: value.reason,
    admissionClass: value.admissionClass,
    createdAt: value.createdAt,
    migrationBudgets: plan.migrationBudgets,
    liveReferenceSchemaDigest: plan.liveReferenceSchemaDigest,
    migrationProtocolDigest: plan.migrationProtocolDigest,
  };
  if (value.requestContentDigest !== deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestContentDigestReferenceCandidateV1(request)) {
    addIssueV1(context, ["requestContentDigest"], "request digest must be reconstructed from the exact public request projection");
  }
  if (
    value.mode !== plan.mode ||
    value.reason !== plan.reason ||
    value.createdAt !== plan.createdAt ||
    value.migrationId !== plan.migrationId ||
    value.migrationId !== planEnvelope.migrationId ||
    !canonicalEqualV1(value.sourceTrust, plan.sourceTrust) ||
    !canonicalEqualV1(value.destinationTrust, plan.destinationTrust) ||
    !canonicalEqualV1(value.namespaceTranslation, plan.namespaceTranslation)
  ) addIssueV1(context, ["planCandidate"], "top-level request metadata, endpoint trust, namespace translation, and migration ID must equal Plan");
  if (
    !canonicalEqualV1(value.completeSourceReadClosure, value.sourceDryRunCut.completeSourceReadClosure) ||
    !canonicalEqualV1(value.completeSourceReadClosure, value.historyQuotaSizing.sourceDryRunCut.completeSourceReadClosure) ||
    !canonicalEqualV1(value.sourceDryRunCut, value.historyQuotaSizing.sourceDryRunCut) ||
    !canonicalEqualV1(value.historyQuotaSizing, plan.migrationHistoryQuotaSizing)
  ) addIssueV1(context, ["completeSourceReadClosure"], "source closure, dry-run cut, sizing, and Plan copies must be byte-identical");
  if (
    value.completeSourceReadClosure.sourceTrustClosureContentDigest !== value.sourceTrust.trustClosureContentDigest ||
    !canonicalEqualV1(value.completeSourceReadClosure.sourceStoreManifest, plan.initialSourceStoreManifest) ||
    value.completeSourceReadClosure.liveReferenceSchemaDigest !== plan.liveReferenceSchemaDigest
  ) addIssueV1(context, ["completeSourceReadClosure"], "source closure must bind the Plan source trust, Store cut, and verified live-reference schema");
  const budgets = plan.migrationBudgets;
  const closure = value.completeSourceReadClosure;
  if (
    value.migrationBudgetsDigest !== plan.migrationBudgetsDigest ||
    value.migrationBudgetsDigest !== value.sourceDryRunCut.migrationBudgetsDigest ||
    value.migrationBudgetsDigest !== value.historyQuotaSizing.migrationBudgetsDigest ||
    value.migrationBudgetsDigest !== deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationBudgetsDigestReferenceCandidateV1(budgets)
  ) addIssueV1(context, ["migrationBudgetsDigest"], "the complete budgets digest chain must be exact");
  if (
    closure.rootCount > budgets.maxRootEntries ||
    closure.objectCount > budgets.maxLiveObjects ||
    closure.referenceCount > budgets.maxReferenceEdges ||
    closure.logicalObjectBytesTotal > budgets.maxLogicalObjectBytesTotal ||
    closure.canonicalUniverseBytes > budgets.maxCanonicalUniverseBytes ||
    closure.canonicalReferenceSetBytes > budgets.maxCanonicalReferenceSetBytes
  ) addIssueV1(context, ["completeSourceReadClosure"], "authenticated complete source closure exceeds a request budget");
  const charge = value.sourceDryRunCut.derivedJournalChargeAmounts;
  let semanticRootZeroCount = 0;
  let semanticRootZeroBytes = 0;
  try {
    semanticRootZeroCount = checkedAddInternalV1(checkedAddInternalV1(budgets.maxRewriteObjects, budgets.maxRootEntries), 2);
    semanticRootZeroBytes = checkedAddInternalV1(
      checkedAddInternalV1(budgets.maxCanonicalRewritePlanBytes, budgets.maxCanonicalSemanticEquivalenceProofBytesTotal),
      checkedAddInternalV1(budgets.maxCanonicalRootRewriteProofSetBytes, budgets.maxCanonicalZeroLiveProofBytes),
    );
  } catch {
    addIssueV1(context, ["planCandidate", "payload", "migrationBudgets"], "derived charge arithmetic must not overflow");
  }
  if (
    charge.reservedHistoryLogicalBytes !== budgets.maxRetainedMigrationHistoryLogicalBytesTotal ||
    charge.reservedHistoryProviderAllocatedBytes !== budgets.maxRetainedMigrationHistoryProviderAllocatedBytesTotal ||
    charge.reservedObjectReceiptCount !== budgets.maxLiveObjects ||
    charge.reservedObjectReceiptLogicalBytes !== budgets.maxCanonicalReceiptBytesTotal ||
    charge.reservedSemanticRootZeroProofCount !== semanticRootZeroCount ||
    charge.reservedSemanticRootZeroProofLogicalBytes !== semanticRootZeroBytes ||
    charge.reservedProgressRecordCount !== budgets.maxProgressRecords ||
    charge.reservedProgressRecordLogicalBytes !== budgets.maxCanonicalProgressRecordSetBytes ||
    charge.reservedProgressOperationReceiptCount !== budgets.maxProgressOperationReceipts ||
    charge.reservedProgressOperationReceiptLogicalBytes !== budgets.maxCanonicalProgressOperationReceiptBytesTotal
  ) addIssueV1(context, ["sourceDryRunCut", "derivedJournalChargeAmounts"], "journal charge must follow the unique budgets-derived category formula");
  if (
    value.historyQuotaSizingDigest !== deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingDigestReferenceCandidateV1(value.historyQuotaSizing) ||
    value.historyQuotaSizingDigest !== plan.migrationHistoryQuotaSizingDigest ||
    !canonicalEqualV1(value.historyQuotaAdmission, plan.migrationHistoryQuotaAdmission) ||
    value.admissionVectorDigest !== deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionVectorDigestReferenceCandidateV1(value.historyQuotaAdmission) ||
    value.admissionVectorDigest !== plan.admissionVectorDigest
  ) addIssueV1(context, ["historyQuotaSizing"], "sizing and admission values and digests must equal the Plan copies");
  if (
    !canonicalEqualV1(value.quotaReferenceSnapshot, value.historyQuotaAdmission.quotaSnapshot) ||
    value.quotaReferenceObservation.preSnapshotContentDigest !== value.quotaReferenceSnapshot.quotaSnapshotContentDigest ||
    value.quotaReferenceObservation.postSnapshotContentDigest !== value.quotaReferenceSnapshot.quotaSnapshotContentDigest
  ) addIssueV1(context, ["quotaReferenceSnapshot"], "top-level quota snapshot and exact pre/post observation must equal admission snapshot");
  const descriptor = value.reservationDescriptors[0];
  if (!canonicalEqualV1(descriptor, plan.migrationHistoryQuotaReservations.journal)) addIssueV1(context, ["reservationDescriptors", 0], "the only reservation descriptor must equal the Plan same-journal descriptor");
  const destinationObservationDigest = expectedDestinationObservationDigestV1(plan.initialDestinationNamespace);
  const expectedObservation = {
    sourceStoreCutContentDigest: closure.sourceStoreManifest.cutContentDigest,
    sourceFreezeStateReferenceDigest: closure.sourceFreezeStateReferenceDigest,
    sourceTrustClosureContentDigest: value.sourceTrust.trustClosureContentDigest,
    destinationTrustClosureContentDigest: value.destinationTrust.trustClosureContentDigest,
    destinationNamespaceObservationDigest: destinationObservationDigest,
    quotaSnapshotContentDigest: value.quotaReferenceSnapshot.quotaSnapshotContentDigest,
  };
  if (
    !canonicalEqualV1(value.prePostObservationEquality.pre, expectedObservation) ||
    !canonicalEqualV1(value.prePostObservationEquality.post, expectedObservation)
  ) addIssueV1(context, ["prePostObservationEquality"], "pre/post observations must exactly map the Plan branch and source/destination/quota cuts");
  if (value.closureContentDigest !== deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalClosureContentDigestReferenceCandidateV1(value)) {
    addIssueV1(context, ["closureContentDigest"], "final closure digest must bind the complete strict success projection");
  }
}

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1Schema: z.ZodType<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1> = z.strictObject(ValidationShapeReferenceCandidateV1).superRefine(refineValidationV1);

const StoreProviderBindingFieldsReferenceCandidateV1Schema = z.strictObject({
  targetProfileId: ProviderTargetProfileIdV1Schema,
  providerId: DurableObjectIdentityProviderIdV1Schema,
  registryEntryContentDigest: ContentDigestV1Schema,
  semanticProviderPolicyDigest: ContentDigestV1Schema,
  providerFeasibilityEvidence: ProviderFeasibilitySupportCandidateV1Schema.shape.providerFeasibilityEvidence,
  runtimeAttestationContentDigest: ContentDigestV1Schema,
  bindingDerivationKeyGeneration: PositiveSafeIntegerV1Schema,
});

const StoreManifestCurrentCutUnsignedReferenceCandidateV1Schema = z.strictObject({
  profile: z.literal("provider_migration_same_installation_identity_current_strong_source_normal_store_manifest_current_cut_reference_candidate_v1"),
  namespace: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceReferenceCandidateV1Schema,
  providerBinding: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceCandidateV1Schema,
  namespaceRevision: PositiveSafeIntegerV1Schema,
  headContentDigest: ContentDigestV1Schema,
  currentVersionReferenceDigest: ContentDigestV1Schema,
  generationCount: PositiveSafeIntegerV1Schema,
  generationSetDigest: ContentDigestV1Schema,
  currentGeneration: z.strictObject({
    generationOrdinal: PositiveSafeIntegerV1Schema,
    generationReferenceId: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestGenerationReferenceCandidateIdV1Schema,
    contentDigest: ContentDigestV1Schema,
  }),
});

const ProspectiveDestinationCutUnsignedReferenceCandidateV1Schema = z.strictObject({
  profile: z.literal("provider_migration_same_installation_identity_current_strong_source_normal_prospective_destination_cut_reference_candidate_v1"),
  activeRootMetadata: ProviderRegistryRootMetadataPinV1Schema,
  currentSteadyRegistryManifestPin: ProviderRegistryManifestPinV1Schema,
  currentSteadyRegistryManifestEnvelope: ProviderRegistryManifestEnvelopeV1Schema,
  currentSupportCatalog: ProviderFeasibilitySupportCatalogPinV1Schema,
  currentSupportCatalogEnvelope: ProviderFeasibilitySupportCatalogEnvelopeV1Schema,
  currentReleaseTargetUniverse: ProviderReleaseTargetUniversePinV1Schema,
  currentReleaseTargetUniverseEnvelope: ProviderReleaseTargetUniverseEnvelopeV1Schema,
  prospectiveRegistryEntryContentDigest: ContentDigestV1Schema,
  prospectiveRegistryEntry: ProspectiveRegistryEntryV1Schema,
  releaseTargetUniverseTargetOrdinal: OrdinalV1Schema,
  target: ProviderFeasibilityTargetV1Schema,
  prospectiveSupportCandidate: ProspectiveSupportCandidateV1Schema,
  evidenceEnvelope: ProviderFeasibilityEvidenceEnvelopeV1Schema,
  supportAdmission: z.literal("not_yet_catalog_signed_or_registry_bound"),
  registryMembership: z.literal("none"),
  migrationPreparedManifest: z.literal("none"),
  selectorDisposition: z.literal("outside_current_accepted_steady_selector_cut"),
});

const NamespaceTranslationUnsignedReferenceCandidateV1Schema = z.strictObject({
  profile: z.literal("provider_migration_same_installation_identity_current_strong_source_normal_namespace_translation_reference_candidate_v1"),
  mode: z.literal("same_installation_identity"),
  relationship: z.literal("same_identity_repository_and_worktree_exact_equal"),
  sourceNamespace: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceReferenceCandidateV1Schema,
  destinationNamespace: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceReferenceCandidateV1Schema,
  journalAuthorityInstallationIdentityGenerationId: InstallationIdentityGenerationIdV1Schema,
});

const LiveRootSetFieldsReferenceCandidateV1Schema = z.strictObject({
  entries: z.array(ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootEntryReferenceCandidateV1Schema).min(1).max(65_536),
});
const LiveObjectSetFieldsReferenceCandidateV1Schema = z.strictObject({
  entries: z.array(ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectEntryReferenceCandidateV1Schema).min(1).max(1_000_000),
});
const LiveReferenceSetFieldsReferenceCandidateV1Schema = z.strictObject({
  entries: z.array(ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceEdgeReferenceCandidateV1Schema).max(4_000_000),
});
const { completeReadClosureContentDigest: _completeSourceDigestSchema, ...CompleteSourceReadClosureUnsignedShapeReferenceCandidateV1 } = CompleteSourceReadClosureShapeReferenceCandidateV1;
const CompleteSourceReadClosureUnsignedReferenceCandidateV1Schema = z.strictObject(CompleteSourceReadClosureUnsignedShapeReferenceCandidateV1);
const { sourceDryRunCutContentDigest: _sourceDryRunDigestSchema, ...SourceDryRunCutUnsignedShapeReferenceCandidateV1 } = SourceDryRunCutShapeReferenceCandidateV1;
const SourceDryRunCutUnsignedReferenceCandidateV1Schema = z.strictObject(SourceDryRunCutUnsignedShapeReferenceCandidateV1);
const QuotaAccountReferenceFieldsReferenceCandidateV1Schema = z.strictObject({
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1Schema,
  reservationOrdinal: PositiveSafeIntegerV1Schema,
  createdByOperationNonce: LowerHex32V1Schema,
});
const QuotaAccountSetFieldsReferenceCandidateV1Schema = z.strictObject({
  entries: z.array(ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1Schema).max(64),
});
const { contentDigest: _accountStateDigestSchema, ...QuotaAccountStateUnsignedShapeReferenceCandidateV1 } = QuotaAccountStateShapeReferenceCandidateV1;
const QuotaAccountStateUnsignedReferenceCandidateV1Schema = z.strictObject(QuotaAccountStateUnsignedShapeReferenceCandidateV1);
const { quotaSnapshotContentDigest: _quotaSnapshotDigestSchema, ...QuotaSnapshotUnsignedShapeReferenceCandidateV1 } = QuotaSnapshotShapeReferenceCandidateV1;
const QuotaSnapshotUnsignedReferenceCandidateV1Schema = z.strictObject(QuotaSnapshotUnsignedShapeReferenceCandidateV1);
const ReservationIdFieldsReferenceCandidateV1Schema = z.strictObject({
  migrationId: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateIdV1Schema,
  role: z.literal("same_identity_journal"),
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1Schema,
  admissionVectorDigest: ContentDigestV1Schema,
});
const MigrationIdFieldsReferenceCandidateV1Schema = z.strictObject({
  mode: z.literal("same_installation_identity"),
  reason: z.literal("provider_decommission"),
  identityRelationship: z.literal("source_destination_exact_same"),
  sourceNamespace: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceReferenceCandidateV1Schema,
  destinationNamespace: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceReferenceCandidateV1Schema,
  namespaceTranslation: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceCandidateV1Schema,
  targetProfileId: ProviderTargetProfileIdV1Schema,
  sourceTrust: SourceEndpointTrustOnlyReferenceCandidateV1Schema,
  destinationTrust: DestinationEndpointTrustOnlyReferenceCandidateV1Schema,
  initialSourceStoreManifest: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1Schema,
  initialDestinationNamespace: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalInitialDestinationNamespaceReferenceCandidateV1Schema,
  journalAuthorityInstallationIdentityGenerationId: InstallationIdentityGenerationIdV1Schema,
  migrationBudgets: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1Schema,
  migrationBudgetsDigest: ContentDigestV1Schema,
  migrationHistoryQuotaSizing: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingReferenceCandidateV1Schema,
  migrationHistoryQuotaSizingDigest: ContentDigestV1Schema,
  migrationHistoryQuotaAdmission: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema,
  admissionVectorDigest: ContentDigestV1Schema,
  liveReferenceSchemaDigest: ContentDigestV1Schema,
  migrationProtocolDigest: ContentDigestV1Schema,
});
const PrePostObservationEqualityUnsignedReferenceCandidateV1Schema = z.strictObject({
  profile: z.literal("provider_migration_same_installation_identity_current_strong_source_normal_pre_post_observation_equality_reference_candidate_v1"),
  pre: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalObservationReferenceCandidateV1Schema,
  post: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalObservationReferenceCandidateV1Schema,
  equality: z.literal("exact"),
});
const QuotaObservationUnsignedReferenceCandidateV1Schema = z.strictObject({
  preSnapshotContentDigest: ContentDigestV1Schema,
  postSnapshotContentDigest: ContentDigestV1Schema,
  equality: z.literal("exact"),
});
const { closureContentDigest: _closureDigestSchema, ...ValidationUnsignedShapeReferenceCandidateV1 } = ValidationShapeReferenceCandidateV1;
const ValidationUnsignedReferenceCandidateV1Schema = z.strictObject(ValidationUnsignedShapeReferenceCandidateV1);

function projectStoreBindingFieldsV1(input: unknown) {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const value = input as Record<string, unknown>;
  return StoreProviderBindingFieldsReferenceCandidateV1Schema.parse({
    targetProfileId: value.targetProfileId,
    providerId: value.providerId,
    registryEntryContentDigest: value.registryEntryContentDigest,
    semanticProviderPolicyDigest: value.semanticProviderPolicyDigest,
    providerFeasibilityEvidence: value.providerFeasibilityEvidence,
    runtimeAttestationContentDigest: value.runtimeAttestationContentDigest,
    bindingDerivationKeyGeneration: value.bindingDerivationKeyGeneration,
  });
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceDigestReferenceCandidateV1(input: unknown): ContentDigestV1 {
  return digestForDomainV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_STORE_PROVIDER_BINDING_REFERENCE_CANDIDATE_DOMAIN_V1, projectStoreBindingFieldsV1(input));
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutContentDigestReferenceCandidateV1(input: unknown): ContentDigestV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const value = input as Record<string, unknown>;
  return digestForDomainV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_STORE_MANIFEST_CURRENT_CUT_REFERENCE_CANDIDATE_DOMAIN_V1, StoreManifestCurrentCutUnsignedReferenceCandidateV1Schema.parse({
    profile: value.profile,
    namespace: value.namespace,
    providerBinding: value.providerBinding,
    namespaceRevision: value.namespaceRevision,
    headContentDigest: value.headContentDigest,
    currentVersionReferenceDigest: value.currentVersionReferenceDigest,
    generationCount: value.generationCount,
    generationSetDigest: value.generationSetDigest,
    currentGeneration: value.currentGeneration,
  }));
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestAbsenceReferenceDigestReferenceCandidateV1(input: unknown): ContentDigestV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const value = input as Record<string, unknown>;
  const projection = z.strictObject({
    namespace: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceReferenceCandidateV1Schema,
    providerBinding: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceCandidateV1Schema,
  }).parse({ namespace: value.namespace, providerBinding: value.providerBinding });
  return digestForDomainV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_STORE_MANIFEST_ABSENCE_REFERENCE_CANDIDATE_DOMAIN_V1, projection);
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutContentDigestReferenceCandidateV1(input: unknown): ContentDigestV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const value = input as Record<string, unknown>;
  const projection = ProspectiveDestinationCutUnsignedReferenceCandidateV1Schema.parse({
    profile: value.profile,
    activeRootMetadata: value.activeRootMetadata,
    currentSteadyRegistryManifestPin: value.currentSteadyRegistryManifestPin,
    currentSteadyRegistryManifestEnvelope: value.currentSteadyRegistryManifestEnvelope,
    currentSupportCatalog: value.currentSupportCatalog,
    currentSupportCatalogEnvelope: value.currentSupportCatalogEnvelope,
    currentReleaseTargetUniverse: value.currentReleaseTargetUniverse,
    currentReleaseTargetUniverseEnvelope: value.currentReleaseTargetUniverseEnvelope,
    prospectiveRegistryEntryContentDigest: value.prospectiveRegistryEntryContentDigest,
    prospectiveRegistryEntry: value.prospectiveRegistryEntry,
    releaseTargetUniverseTargetOrdinal: value.releaseTargetUniverseTargetOrdinal,
    target: value.target,
    prospectiveSupportCandidate: value.prospectiveSupportCandidate,
    evidenceEnvelope: value.evidenceEnvelope,
    supportAdmission: value.supportAdmission,
    registryMembership: value.registryMembership,
    migrationPreparedManifest: value.migrationPreparedManifest,
    selectorDisposition: value.selectorDisposition,
  });
  return digestForDomainV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PROSPECTIVE_DESTINATION_CUT_REFERENCE_CANDIDATE_DOMAIN_V1, projection);
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustContentDigestReferenceCandidateV1(input: unknown): ContentDigestV1 {
  const trust = parseJsonFieldsV1(EndpointTrustUnrefinedReferenceCandidateV1Schema, input);
  const { trustClosureContentDigest: _digest, ...projection } = trust;
  return digestForDomainV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_ENDPOINT_TRUST_REFERENCE_CANDIDATE_DOMAIN_V1, projection);
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceDigestReferenceCandidateV1(input: unknown): ContentDigestV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const value = input as Record<string, unknown>;
  return digestForDomainV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_NAMESPACE_TRANSLATION_REFERENCE_CANDIDATE_DOMAIN_V1, NamespaceTranslationUnsignedReferenceCandidateV1Schema.parse({
    profile: value.profile,
    mode: value.mode,
    relationship: value.relationship,
    sourceNamespace: value.sourceNamespace,
    destinationNamespace: value.destinationNamespace,
    journalAuthorityInstallationIdentityGenerationId: value.journalAuthorityInstallationIdentityGenerationId,
  }));
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestContentDigestReferenceCandidateV1(input: unknown): ContentDigestV1 {
  return digestForDomainV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PRE_SIDE_EFFECT_REQUEST_REFERENCE_CANDIDATE_DOMAIN_V1, parseJsonFieldsV1(ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestReferenceCandidateV1Schema, input));
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootSetDigestReferenceCandidateV1(input: unknown): ContentDigestV1 {
  return digestForDomainV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_LIVE_ROOT_SET_REFERENCE_CANDIDATE_DOMAIN_V1, parseJsonFieldsV1(LiveRootSetFieldsReferenceCandidateV1Schema, input));
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectSetDigestReferenceCandidateV1(input: unknown): ContentDigestV1 {
  return digestForDomainV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_LIVE_OBJECT_SET_REFERENCE_CANDIDATE_DOMAIN_V1, parseJsonFieldsV1(LiveObjectSetFieldsReferenceCandidateV1Schema, input));
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceSetDigestReferenceCandidateV1(input: unknown): ContentDigestV1 {
  return digestForDomainV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_LIVE_REFERENCE_SET_REFERENCE_CANDIDATE_DOMAIN_V1, parseJsonFieldsV1(LiveReferenceSetFieldsReferenceCandidateV1Schema, input));
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalRootSetBytesReferenceCandidateV1(input: unknown): number {
  return canonicalByteLengthV1(parseJsonFieldsV1(LiveRootSetFieldsReferenceCandidateV1Schema, input));
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalObjectSetBytesReferenceCandidateV1(input: unknown): number {
  return canonicalByteLengthV1(parseJsonFieldsV1(LiveObjectSetFieldsReferenceCandidateV1Schema, input));
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalReferenceSetBytesReferenceCandidateV1(input: unknown): number {
  return canonicalByteLengthV1(parseJsonFieldsV1(LiveReferenceSetFieldsReferenceCandidateV1Schema, input));
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalUniverseBytesReferenceCandidateV1(input: unknown): number {
  const fields = z.strictObject({
    roots: LiveRootSetFieldsReferenceCandidateV1Schema.shape.entries,
    objects: LiveObjectSetFieldsReferenceCandidateV1Schema.shape.entries,
    references: LiveReferenceSetFieldsReferenceCandidateV1Schema.shape.entries,
  }).parse(input);
  return canonicalByteLengthV1(fields);
}

export function checkedSumProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLogicalObjectBytesReferenceCandidateV1(input: unknown): number {
  const objects = LiveObjectSetFieldsReferenceCandidateV1Schema.shape.entries.parse(input);
  let total = 0;
  for (let index = 0; index < objects.length; index += 1) total = checkedAddInternalV1(total, objects[index]!.logicalBytes);
  return total;
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureContentDigestReferenceCandidateV1(input: unknown): ContentDigestV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const value = input as Record<string, unknown>;
  const projection = CompleteSourceReadClosureUnsignedReferenceCandidateV1Schema.parse({
    profile: value.profile,
    sourceInstallationIdentityGenerationId: value.sourceInstallationIdentityGenerationId,
    sourceTrustClosureContentDigest: value.sourceTrustClosureContentDigest,
    sourceStoreManifest: value.sourceStoreManifest,
    sourceFreezeStateReferenceDigest: value.sourceFreezeStateReferenceDigest,
    liveReferenceSchemaDigest: value.liveReferenceSchemaDigest,
    roots: value.roots,
    objects: value.objects,
    references: value.references,
    rootCount: value.rootCount,
    rootSetDigest: value.rootSetDigest,
    canonicalRootSetBytes: value.canonicalRootSetBytes,
    objectCount: value.objectCount,
    objectSetDigest: value.objectSetDigest,
    canonicalObjectSetBytes: value.canonicalObjectSetBytes,
    logicalObjectBytesTotal: value.logicalObjectBytesTotal,
    referenceCount: value.referenceCount,
    referenceSetDigest: value.referenceSetDigest,
    canonicalReferenceSetBytes: value.canonicalReferenceSetBytes,
    canonicalUniverseBytes: value.canonicalUniverseBytes,
    activeTransactions: value.activeTransactions,
  });
  return digestForDomainV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_COMPLETE_SOURCE_READ_CLOSURE_REFERENCE_CANDIDATE_DOMAIN_V1, projection);
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationBudgetsDigestReferenceCandidateV1(input: unknown): ContentDigestV1 {
  return digestForDomainV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PRE_SIDE_EFFECT_BUDGETS_REFERENCE_CANDIDATE_DOMAIN_V1, parseJsonFieldsV1(ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1Schema, input));
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundSetDigestReferenceCandidateV1(input: unknown): ContentDigestV1 {
  const entries = parseJsonFieldsV1(ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundsReferenceCandidateV1Schema, input);
  return digestForDomainV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_HISTORY_ARTIFACT_UPPER_BOUND_SET_REFERENCE_CANDIDATE_DOMAIN_V1, { entries });
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunCutContentDigestReferenceCandidateV1(input: unknown): ContentDigestV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const value = input as Record<string, unknown>;
  const projection = SourceDryRunCutUnsignedReferenceCandidateV1Schema.parse({
    profile: value.profile,
    mode: value.mode,
    completeSourceReadClosure: value.completeSourceReadClosure,
    completeSourceReadClosureContentDigest: value.completeSourceReadClosureContentDigest,
    migrationBudgetsDigest: value.migrationBudgetsDigest,
    retainedArtifactUpperBounds: value.retainedArtifactUpperBounds,
    derivedJournalChargeAmounts: value.derivedJournalChargeAmounts,
  });
  return digestForDomainV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_SOURCE_DRY_RUN_CUT_REFERENCE_CANDIDATE_DOMAIN_V1, projection);
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingDigestReferenceCandidateV1(input: unknown): ContentDigestV1 {
  return digestForDomainV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_HISTORY_QUOTA_SIZING_REFERENCE_CANDIDATE_DOMAIN_V1, parseJsonFieldsV1(ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingReferenceCandidateV1Schema, input));
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceDigestReferenceCandidateV1(input: unknown): ContentDigestV1 {
  return digestForDomainV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_ACCOUNT_REFERENCE_CANDIDATE_DOMAIN_V1, parseJsonFieldsV1(QuotaAccountReferenceFieldsReferenceCandidateV1Schema, input));
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountSetDigestReferenceCandidateV1(input: unknown): ContentDigestV1 {
  return digestForDomainV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_ACCOUNT_SET_REFERENCE_CANDIDATE_DOMAIN_V1, parseJsonFieldsV1(QuotaAccountSetFieldsReferenceCandidateV1Schema, input));
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountStateContentDigestReferenceCandidateV1(input: unknown): ContentDigestV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const value = input as Record<string, unknown>;
  const projection = QuotaAccountStateUnsignedReferenceCandidateV1Schema.parse({
    profile: value.profile,
    installationIdentityGenerationId: value.installationIdentityGenerationId,
    accounts: value.accounts,
    accountCount: value.accountCount,
    accountSetDigest: value.accountSetDigest,
    usage: value.usage,
    futureTerminalTransitionEscrowCount: value.futureTerminalTransitionEscrowCount,
    eventEscrowLogicalBytes: value.eventEscrowLogicalBytes,
    receiptEscrowLogicalBytes: value.receiptEscrowLogicalBytes,
  });
  return digestForDomainV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_ACCOUNT_STATE_REFERENCE_CANDIDATE_DOMAIN_V1, projection);
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotContentDigestReferenceCandidateV1(input: unknown): ContentDigestV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const value = input as Record<string, unknown>;
  const projection = QuotaSnapshotUnsignedReferenceCandidateV1Schema.parse({
    profile: value.profile,
    installationIdentityGenerationId: value.installationIdentityGenerationId,
    accounts: value.accounts,
    accountCount: value.accountCount,
    accountSetDigest: value.accountSetDigest,
    usage: value.usage,
    reservationRecordCount: value.reservationRecordCount,
    reservationRecordSetDigest: value.reservationRecordSetDigest,
    reservationRecordLogicalBytes: value.reservationRecordLogicalBytes,
    eventCount: value.eventCount,
    eventSetDigest: value.eventSetDigest,
    ledgerEventLogicalBytes: value.ledgerEventLogicalBytes,
    receiptCount: value.receiptCount,
    receiptSetDigest: value.receiptSetDigest,
    operationReceiptLogicalBytes: value.operationReceiptLogicalBytes,
    futureTerminalTransitionEscrowCount: value.futureTerminalTransitionEscrowCount,
    eventEscrowLogicalBytes: value.eventEscrowLogicalBytes,
    receiptEscrowLogicalBytes: value.receiptEscrowLogicalBytes,
    quotaHighWaterReferenceDigest: value.quotaHighWaterReferenceDigest,
  });
  return digestForDomainV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_SNAPSHOT_REFERENCE_CANDIDATE_DOMAIN_V1, projection);
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageFromAccountsReferenceCandidateV1(input: unknown): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1 {
  const accounts = ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceCandidateV1Schema.array().max(64).parse(input);
  const usage = zeroQuotaUsageV1();
  for (let index = 0; index < accounts.length; index += 1) addContributionToUsageV1(usage, accounts[index]!);
  return freezeParsedJsonV1(ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1Schema.parse(usage));
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveChargedUsageReferenceCandidateV1(input: unknown): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const outer = input as Record<string, unknown>;
  const usage = ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1Schema.parse(outer.usage);
  const rawCharge = outer.charge as Record<string, unknown>;
  const charge = ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaChargeAmountsReferenceCandidateV1Schema.parse({
    reservedHistoryLogicalBytes: rawCharge.reservedHistoryLogicalBytes,
    reservedHistoryProviderAllocatedBytes: rawCharge.reservedHistoryProviderAllocatedBytes,
    reservedObjectReceiptCount: rawCharge.reservedObjectReceiptCount,
    reservedObjectReceiptLogicalBytes: rawCharge.reservedObjectReceiptLogicalBytes,
    reservedSemanticRootZeroProofCount: rawCharge.reservedSemanticRootZeroProofCount,
    reservedSemanticRootZeroProofLogicalBytes: rawCharge.reservedSemanticRootZeroProofLogicalBytes,
    reservedProgressRecordCount: rawCharge.reservedProgressRecordCount,
    reservedProgressRecordLogicalBytes: rawCharge.reservedProgressRecordLogicalBytes,
    reservedProgressOperationReceiptCount: rawCharge.reservedProgressOperationReceiptCount,
    reservedProgressOperationReceiptLogicalBytes: rawCharge.reservedProgressOperationReceiptLogicalBytes,
  });
  const output: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1 = {
    reservedAccountCount: checkedAddInternalV1(usage.reservedAccountCount, 1),
    reservedHistoryLogicalBytes: checkedAddInternalV1(usage.reservedHistoryLogicalBytes, charge.reservedHistoryLogicalBytes),
    reservedHistoryProviderAllocatedBytes: checkedAddInternalV1(usage.reservedHistoryProviderAllocatedBytes, charge.reservedHistoryProviderAllocatedBytes),
    reservedObjectReceiptCount: checkedAddInternalV1(usage.reservedObjectReceiptCount, charge.reservedObjectReceiptCount),
    reservedObjectReceiptLogicalBytes: checkedAddInternalV1(usage.reservedObjectReceiptLogicalBytes, charge.reservedObjectReceiptLogicalBytes),
    reservedSemanticRootZeroProofCount: checkedAddInternalV1(usage.reservedSemanticRootZeroProofCount, charge.reservedSemanticRootZeroProofCount),
    reservedSemanticRootZeroProofLogicalBytes: checkedAddInternalV1(usage.reservedSemanticRootZeroProofLogicalBytes, charge.reservedSemanticRootZeroProofLogicalBytes),
    reservedProgressRecordCount: checkedAddInternalV1(usage.reservedProgressRecordCount, charge.reservedProgressRecordCount),
    reservedProgressRecordLogicalBytes: checkedAddInternalV1(usage.reservedProgressRecordLogicalBytes, charge.reservedProgressRecordLogicalBytes),
    reservedProgressOperationReceiptCount: checkedAddInternalV1(usage.reservedProgressOperationReceiptCount, charge.reservedProgressOperationReceiptCount),
    reservedProgressOperationReceiptLogicalBytes: checkedAddInternalV1(usage.reservedProgressOperationReceiptLogicalBytes, charge.reservedProgressOperationReceiptLogicalBytes),
    retainedAccountCount: usage.retainedAccountCount,
    retainedHistoryLogicalBytes: usage.retainedHistoryLogicalBytes,
    retainedHistoryProviderAllocatedBytes: usage.retainedHistoryProviderAllocatedBytes,
    chargedMigrationCount: checkedAddInternalV1(usage.chargedMigrationCount, 1),
    chargedHistoryLogicalBytes: checkedAddInternalV1(usage.chargedHistoryLogicalBytes, charge.reservedHistoryLogicalBytes),
    chargedHistoryProviderAllocatedBytes: checkedAddInternalV1(usage.chargedHistoryProviderAllocatedBytes, charge.reservedHistoryProviderAllocatedBytes),
    chargedObjectReceiptCount: checkedAddInternalV1(usage.chargedObjectReceiptCount, charge.reservedObjectReceiptCount),
    chargedObjectReceiptLogicalBytes: checkedAddInternalV1(usage.chargedObjectReceiptLogicalBytes, charge.reservedObjectReceiptLogicalBytes),
    chargedSemanticRootZeroProofCount: checkedAddInternalV1(usage.chargedSemanticRootZeroProofCount, charge.reservedSemanticRootZeroProofCount),
    chargedSemanticRootZeroProofLogicalBytes: checkedAddInternalV1(usage.chargedSemanticRootZeroProofLogicalBytes, charge.reservedSemanticRootZeroProofLogicalBytes),
    chargedProgressRecordCount: checkedAddInternalV1(usage.chargedProgressRecordCount, charge.reservedProgressRecordCount),
    chargedProgressRecordLogicalBytes: checkedAddInternalV1(usage.chargedProgressRecordLogicalBytes, charge.reservedProgressRecordLogicalBytes),
    chargedProgressOperationReceiptCount: checkedAddInternalV1(usage.chargedProgressOperationReceiptCount, charge.reservedProgressOperationReceiptCount),
    chargedProgressOperationReceiptLogicalBytes: checkedAddInternalV1(usage.chargedProgressOperationReceiptLogicalBytes, charge.reservedProgressOperationReceiptLogicalBytes),
  };
  return freezeParsedJsonV1(ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1Schema.parse(output));
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionVectorDigestReferenceCandidateV1(input: unknown): ContentDigestV1 {
  return digestForDomainV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_HISTORY_QUOTA_ADMISSION_REFERENCE_CANDIDATE_DOMAIN_V1, parseJsonFieldsV1(ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema, input));
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationIdReferenceCandidateV1(input: unknown): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateIdV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const value = input as Record<string, unknown>;
  const fields = MigrationIdFieldsReferenceCandidateV1Schema.parse({
    mode: value.mode,
    reason: value.reason,
    identityRelationship: value.identityRelationship,
    sourceNamespace: value.sourceNamespace,
    destinationNamespace: value.destinationNamespace,
    namespaceTranslation: value.namespaceTranslation,
    targetProfileId: value.targetProfileId,
    sourceTrust: value.sourceTrust,
    destinationTrust: value.destinationTrust,
    initialSourceStoreManifest: value.initialSourceStoreManifest,
    initialDestinationNamespace: value.initialDestinationNamespace,
    journalAuthorityInstallationIdentityGenerationId: value.journalAuthorityInstallationIdentityGenerationId,
    migrationBudgets: value.migrationBudgets,
    migrationBudgetsDigest: value.migrationBudgetsDigest,
    migrationHistoryQuotaSizing: value.migrationHistoryQuotaSizing,
    migrationHistoryQuotaSizingDigest: value.migrationHistoryQuotaSizingDigest,
    migrationHistoryQuotaAdmission: value.migrationHistoryQuotaAdmission,
    admissionVectorDigest: value.admissionVectorDigest,
    liveReferenceSchemaDigest: value.liveReferenceSchemaDigest,
    migrationProtocolDigest: value.migrationProtocolDigest,
  });
  return ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateIdV1Schema.parse(
    `provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-closure-reference-candidate:${shortHex22ForDomainV1(
      PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PRE_SIDE_EFFECT_PLAN_ADMISSION_CLOSURE_REFERENCE_CANDIDATE_ID_DOMAIN_V1,
      fields,
    )}`,
  );
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReservationIdReferenceCandidateV1(input: unknown): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectHistoryQuotaReservationReferenceCandidateIdV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const value = input as Record<string, unknown>;
  const fields = ReservationIdFieldsReferenceCandidateV1Schema.parse({
    migrationId: value.migrationId,
    role: value.role,
    installationIdentityGenerationId: value.installationIdentityGenerationId,
    admissionVectorDigest: value.admissionVectorDigest,
  });
  return ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectHistoryQuotaReservationReferenceCandidateIdV1Schema.parse(
    `provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-history-quota-reservation-reference-candidate:${shortHex22ForDomainV1(
      PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PRE_SIDE_EFFECT_HISTORY_QUOTA_RESERVATION_REFERENCE_CANDIDATE_ID_DOMAIN_V1,
      fields,
    )}`,
  );
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanContentDigestReferenceCandidateV1(input: unknown): ContentDigestV1 {
  return digestForDomainV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PLAN_PAYLOAD_REFERENCE_CANDIDATE_DOMAIN_V1, parseJsonFieldsV1(ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanPayloadReferenceCandidateV1Schema, input));
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaObservationContentDigestReferenceCandidateV1(input: unknown): ContentDigestV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const value = input as Record<string, unknown>;
  const projection = QuotaObservationUnsignedReferenceCandidateV1Schema.parse({
    preSnapshotContentDigest: value.preSnapshotContentDigest,
    postSnapshotContentDigest: value.postSnapshotContentDigest,
    equality: value.equality,
  });
  return digestForDomainV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_OBSERVATION_REFERENCE_CANDIDATE_DOMAIN_V1, projection);
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrePostObservationEqualityContentDigestReferenceCandidateV1(input: unknown): ContentDigestV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const value = input as Record<string, unknown>;
  const projection = PrePostObservationEqualityUnsignedReferenceCandidateV1Schema.parse({
    profile: value.profile,
    pre: value.pre,
    post: value.post,
    equality: value.equality,
  });
  return digestForDomainV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PRE_POST_OBSERVATION_EQUALITY_REFERENCE_CANDIDATE_DOMAIN_V1, projection);
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalClosureContentDigestReferenceCandidateV1(input: unknown): ContentDigestV1 {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  assertJsonDataTreeBeforeSchemaV1(input);
  const value = input as Record<string, unknown>;
  const projection = ValidationUnsignedReferenceCandidateV1Schema.parse({
    authority: value.authority,
    profile: value.profile,
    stopPoint: value.stopPoint,
    requestContentDigest: value.requestContentDigest,
    mode: value.mode,
    reason: value.reason,
    admissionClass: value.admissionClass,
    createdAt: value.createdAt,
    sourceTrust: value.sourceTrust,
    destinationTrust: value.destinationTrust,
    namespaceTranslation: value.namespaceTranslation,
    completeSourceReadClosure: value.completeSourceReadClosure,
    sourceDryRunCut: value.sourceDryRunCut,
    migrationBudgetsDigest: value.migrationBudgetsDigest,
    historyQuotaSizing: value.historyQuotaSizing,
    historyQuotaSizingDigest: value.historyQuotaSizingDigest,
    historyQuotaAdmission: value.historyQuotaAdmission,
    admissionVectorDigest: value.admissionVectorDigest,
    quotaReferenceSnapshot: value.quotaReferenceSnapshot,
    quotaReferenceObservation: value.quotaReferenceObservation,
    migrationId: value.migrationId,
    reservationDescriptors: value.reservationDescriptors,
    planCandidate: value.planCandidate,
    prePostObservationEquality: value.prePostObservationEquality,
    sideEffectBoundary: value.sideEffectBoundary,
    verificationBoundary: value.verificationBoundary,
  });
  return digestForDomainV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PRE_SIDE_EFFECT_PLAN_ADMISSION_CLOSURE_REFERENCE_CANDIDATE_DOMAIN_V1, projection);
}

export function validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1(
  input: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1 {
  return freezeParsedJsonV1(parseJsonFieldsV1(
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1Schema,
    input,
  ));
}

export function verifyProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidatePublicHashDagAndEqualityV1(
  input: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1 {
  return validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1(input);
}

CapturedObjectFreezeV1(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceDigestReferenceCandidateV1);
CapturedObjectFreezeV1(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutContentDigestReferenceCandidateV1);
CapturedObjectFreezeV1(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestAbsenceReferenceDigestReferenceCandidateV1);
CapturedObjectFreezeV1(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutContentDigestReferenceCandidateV1);
CapturedObjectFreezeV1(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustContentDigestReferenceCandidateV1);
CapturedObjectFreezeV1(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceDigestReferenceCandidateV1);
CapturedObjectFreezeV1(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestContentDigestReferenceCandidateV1);
CapturedObjectFreezeV1(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootSetDigestReferenceCandidateV1);
CapturedObjectFreezeV1(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectSetDigestReferenceCandidateV1);
CapturedObjectFreezeV1(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceSetDigestReferenceCandidateV1);
CapturedObjectFreezeV1(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureContentDigestReferenceCandidateV1);
CapturedObjectFreezeV1(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationBudgetsDigestReferenceCandidateV1);
CapturedObjectFreezeV1(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunCutContentDigestReferenceCandidateV1);
CapturedObjectFreezeV1(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingDigestReferenceCandidateV1);
CapturedObjectFreezeV1(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceDigestReferenceCandidateV1);
CapturedObjectFreezeV1(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountSetDigestReferenceCandidateV1);
CapturedObjectFreezeV1(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountStateContentDigestReferenceCandidateV1);
CapturedObjectFreezeV1(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotContentDigestReferenceCandidateV1);
CapturedObjectFreezeV1(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionVectorDigestReferenceCandidateV1);
CapturedObjectFreezeV1(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationIdReferenceCandidateV1);
CapturedObjectFreezeV1(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReservationIdReferenceCandidateV1);
CapturedObjectFreezeV1(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanContentDigestReferenceCandidateV1);
CapturedObjectFreezeV1(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaObservationContentDigestReferenceCandidateV1);
CapturedObjectFreezeV1(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrePostObservationEqualityContentDigestReferenceCandidateV1);
CapturedObjectFreezeV1(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalClosureContentDigestReferenceCandidateV1);
CapturedObjectFreezeV1(validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1);
CapturedObjectFreezeV1(verifyProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidatePublicHashDagAndEqualityV1);
