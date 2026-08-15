/**
 * Package-private D-40 in-memory Acceptance compare-append reference machine.
 *
 * This module is deliberately absent from the package export map.  Its opaque
 * capability authorizes only one process-local reference state machine.  It
 * proves neither durable I/O nor Installation Identity key custody.
 */

import { z } from "./zod-runtime.js";

import { canonicalizeJcsSafeIntegerV1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  LowerHex32V1Schema,
  type InstallationIdentityGenerationIdV1,
} from "./primitives.js";
import {
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptUnsignedReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentReadReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationEntryReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1Schema,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptContentDigestReferenceCandidateV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationSetDigestReferenceCandidateV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterContentDigestReferenceCandidateV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendResultReferenceCandidateV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentReadReferenceCandidateV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationEntryReferenceCandidateV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1,
} from "./provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-reference-candidate-wire.js";
import {
  assertProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptTokenWithIdentityCapabilityInternalV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenWithIdentityCapabilityInternalV1,
  getProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInstallationIdentityGenerationIdInternalV1,
  verifyProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptTokenWithIdentityCapabilityInternalV1,
  verifyProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenWithIdentityCapabilityInternalV1,
  verifyProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
} from "./provider-strong-ready-bootstrap-or-steady-acceptance-identity-verification-capability-internal.js";
import {
  captureProviderPointDetachedExactDataObjectV1,
  deepFreezeProviderPointDetachedDataTreeV1,
} from "./provider-point-raw-admission-internal.js";
import {
  createProviderPointRejectedPromiseV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import {
  ProviderRegistryIsoTimestampV1Schema,
} from "./provider-registry-trust.js";
import {
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
  ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
  type ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
} from "./provider-strong-ready-acceptance-candidate.js";
import { PROVIDER_TRUST_HISTORY_POLICY_V1 } from "./provider-trust-policy.js";
import { sha256InternalV1 } from "./sha256.js";

const CapturedArrayPrototypeSliceV1 = Array.prototype.slice;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedJsonParseV1 = JSON.parse;
const CapturedMapV1 = Map;
const CapturedObjectCreateV1 = Object.create;
const CapturedObjectDefinePropertyV1 = Object.defineProperty;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedPromisePrototypeThenV1 = Promise.prototype.then;
const CapturedPromiseRejectV1 = Promise.reject.bind(Promise);
const CapturedPromiseResolveV1 = Promise.resolve.bind(Promise);
const CapturedReflectApplyV1 = Reflect.apply;
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
const CapturedMapGetV1 = Map.prototype.get;
const CapturedMapHasV1 = Map.prototype.has;
const CapturedMapSetV1 = Map.prototype.set;
const CapturedSetAddV1 = Set.prototype.add;
const CapturedSetHasV1 = Set.prototype.has;
const CapturedSetV1 = Set;
const CapturedWeakMapV1 = WeakMap;
const CapturedWeakMapDeleteV1 = WeakMap.prototype.delete;
const CapturedWeakMapGetV1 = WeakMap.prototype.get;
const CapturedWeakMapHasV1 = WeakMap.prototype.has;
const CapturedWeakMapSetV1 = WeakMap.prototype.set;
const CapturedWeakSetV1 = WeakSet;
const CapturedWeakSetAddV1 = WeakSet.prototype.add;
const CapturedWeakSetHasV1 = WeakSet.prototype.has;

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

const promiseThenV1 = bindUncurriedAtBootstrapV1(
  CapturedPromisePrototypeThenV1,
) as <T, TResult1 = T, TResult2 = never>(
  promise: Promise<T>,
  fulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
  rejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
) => Promise<TResult1 | TResult2>;
const arraySliceV1 = bindUncurriedAtBootstrapV1(
  CapturedArrayPrototypeSliceV1,
) as <T>(array: readonly T[], start?: number, end?: number) => T[];
const mapGetV1 = bindUncurriedAtBootstrapV1(
  CapturedMapGetV1,
) as <K, V>(map: Map<K, V>, key: K) => V | undefined;
const mapHasV1 = bindUncurriedAtBootstrapV1(
  CapturedMapHasV1,
) as <K>(map: Map<K, unknown>, key: K) => boolean;
const mapSetV1 = bindUncurriedAtBootstrapV1(
  CapturedMapSetV1,
) as <K, V>(map: Map<K, V>, key: K, value: V) => Map<K, V>;
const setAddV1 = bindUncurriedAtBootstrapV1(
  CapturedSetAddV1,
) as <T>(set: Set<T>, value: T) => Set<T>;
const setHasV1 = bindUncurriedAtBootstrapV1(
  CapturedSetHasV1,
) as <T>(set: ReadonlySet<T>, value: T) => boolean;
const typedArrayByteLengthV1 = bindUncurriedAtBootstrapV1(
  CapturedTypedArrayByteLengthGetterCandidateV1,
) as (value: Uint8Array) => number;
const weakMapGetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapGetV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K) => V | undefined;
const weakMapDeleteV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapDeleteV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K) => boolean;
const weakMapHasV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapHasV1,
) as <K extends object>(map: WeakMap<K, unknown>, key: K) => boolean;
const weakMapSetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapSetV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K, value: V) => void;
const weakSetAddV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakSetAddV1,
) as <T extends object>(set: WeakSet<T>, value: T) => void;
const weakSetHasV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakSetHasV1,
) as <T extends object>(set: WeakSet<T>, value: T) => boolean;

const CapturedUtf8EncoderV1 = CapturedObjectFreezeV1(
  new CapturedTextEncoderV1(),
);

function appendFrozenArrayByIndexV1<T>(
  values: readonly T[],
  value: T,
): readonly T[] {
  const appended: T[] = [];
  for (let index = 0; index < values.length; index += 1) {
    appended[index] = values[index]!;
  }
  appended[values.length] = value;
  return CapturedObjectFreezeV1(appended);
}

const MINT_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "identityVerificationCapability",
  "initialState",
  "retainedNonAcceptanceTrustHistoryLogicalBytes",
] as const);
const EXECUTE_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "identityVerificationCapability",
  "referenceMachineCapability",
  "request",
  "resolvedAt",
  "transaction",
] as const);
const INITIAL_STATE_KEYS_V1 = CapturedObjectFreezeV1([
  "namespace",
  "receiptLedger",
] as const);
const NAMESPACE_ABSENT_KEYS_V1 = CapturedObjectFreezeV1(["state"] as const);
const NAMESPACE_CURRENT_KEYS_V1 = CapturedObjectFreezeV1([
  "currentRead",
  "generations",
  "state",
] as const);
const NAMESPACE_INTEGRITY_FAILED_KEYS_V1 = CapturedObjectFreezeV1([
  "evidenceDigest",
  "state",
] as const);
const TRANSACTION_CANDIDATE_INVALID_KEYS_V1 = CapturedObjectFreezeV1([
  "classification",
] as const);
const TRANSACTION_FLOOR_REGRESSED_KEYS_V1 = CapturedObjectFreezeV1([
  "classification",
] as const);
const TRANSACTION_COMMITTED_KEYS_V1 = CapturedObjectFreezeV1([
  "acceptedGenerationFloors",
  "candidate",
  "classification",
] as const);
const GENERATION_FLOOR_KEYS_V1 = CapturedObjectFreezeV1([
  "registryManifestGeneration",
  "rootMetadataGeneration",
  "supportCatalogGeneration",
] as const);
const RECEIPT_LEDGER_ENTRY_KEYS_V1 = CapturedObjectFreezeV1([
  "contentDigest",
  "linearizationOrdinal",
  "operationNonce",
  "receipt",
] as const);

export const PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_COMPARE_APPEND_RECEIPT_SET_REFERENCE_CANDIDATE_DOMAIN_INTERNAL_V1 =
  "provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-receipt-set-reference-candidate-v1" as const;

const ReceiptLedgerEntryCandidateInternalV1Schema = z.strictObject({
  linearizationOrdinal: z.number().int().min(1).max(
    PROVIDER_TRUST_HISTORY_POLICY_V1
      .maxAcceptanceCompareAppendReceiptCountPerInstallationIdentity,
  ),
  operationNonce: LowerHex32V1Schema,
  contentDigest: ContentDigestV1Schema,
  receipt: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1Schema,
});
const ReceiptLedgerCandidateInternalV1Schema = z.strictObject({
  profile: z.literal(
    "provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_receipt_ledger_reference_candidate_v1",
  ),
  installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1Schema,
  entries: z.array(ReceiptLedgerEntryCandidateInternalV1Schema).max(
    PROVIDER_TRUST_HISTORY_POLICY_V1
      .maxAcceptanceCompareAppendReceiptCountPerInstallationIdentity,
  ),
  receiptCount: z.number().int().min(0).max(
    PROVIDER_TRUST_HISTORY_POLICY_V1
      .maxAcceptanceCompareAppendReceiptCountPerInstallationIdentity,
  ),
  receiptSetDigest: ContentDigestV1Schema,
  receiptLogicalBytes: z.number().int().min(0).max(
    PROVIDER_TRUST_HISTORY_POLICY_V1
      .maxAcceptanceCompareAppendReceiptLogicalBytesPerInstallationIdentity,
  ),
});
const GenerationEnvelopeListV1Schema = z.array(
  ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
).min(1).max(PROVIDER_TRUST_HISTORY_POLICY_V1
  .maxAcceptanceGenerationCountPerInstallationIdentity);
const GenerationFloorsV1Schema = z.strictObject({
  rootMetadataGeneration: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  registryManifestGeneration: z.number().int().min(1).max(
    Number.MAX_SAFE_INTEGER,
  ),
  supportCatalogGeneration: z.number().int().min(1).max(
    Number.MAX_SAFE_INTEGER,
  ),
});
const RetainedNonAcceptanceTrustHistoryLogicalBytesV1Schema = z
  .number()
  .int()
  .min(0)
  .max(
    PROVIDER_TRUST_HISTORY_POLICY_V1
      .maxTotalTrustHistoryLogicalBytesPerInstallationIdentity,
  );

export type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineStageInternalV1 =
  | "input"
  | "identity_verification_capability"
  | "reference_machine_capability"
  | "acceptance_compare_append_request"
  | "acceptance_receipt_ledger"
  | "acceptance_capacity"
  | "acceptance_namespace"
  | "expected_current"
  | "candidate"
  | "generation_floors"
  | "acceptance_receipt"
  | "atomic_resolution"
  | "post_state_closure";

export type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineReasonInternalV1 =
  | "schema_invalid"
  | "capability_invalid"
  | "source_invalid"
  | "ledger_integrity_failed"
  | "receipt_capacity_exhausted"
  | "namespace_integrity_failed"
  | "expected_current_changed"
  | "candidate_invalid"
  | "generation_floor_regressed"
  | "operation_nonce_request_mismatch"
  | "post_state_invalid";

const machineErrorsV1 = new CapturedWeakSetV1<object>();

export class ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineErrorInternalV1
  extends CapturedTypeErrorV1 {
  readonly stage:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineStageInternalV1;
  readonly reason:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineReasonInternalV1;

  constructor(
    stage: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineStageInternalV1,
    reason: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineReasonInternalV1,
  ) {
    super("provider Acceptance compare-append reference operation failed");
    this.name =
      "ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineErrorInternalV1";
    this.stage = stage;
    this.reason = reason;
    weakSetAddV1(machineErrorsV1, this);
    CapturedObjectFreezeV1(this);
  }
}

export function isProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineErrorInternalV1(
  value: unknown,
): value is ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineErrorInternalV1 {
  return isObjectIdentityV1(value) && weakSetHasV1(machineErrorsV1, value);
}

declare const providerAcceptanceCompareAppendReferenceMachineBrandV1:
  unique symbol;
export interface ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1 {
  readonly [providerAcceptanceCompareAppendReferenceMachineBrandV1]: true;
}

export type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceNamespaceInternalV1 =
  | Readonly<{ readonly state: "absent" }>
  | Readonly<{
      readonly state: "current";
      readonly currentRead: ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentReadReferenceCandidateV1;
      readonly generations:
        readonly ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1[];
    }>
  | Readonly<{
      readonly state: "integrity_failed";
      readonly evidenceDigest: ReturnType<typeof ContentDigestV1Schema.parse>;
    }>;

export type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerEntryCandidateInternalV1 =
  z.infer<typeof ReceiptLedgerEntryCandidateInternalV1Schema>;

/**
 * Private reference-only sealed-set candidate. Its count/digest/bytes prove
 * self-consistency of the set captured by one machine capability; they do not
 * prove that a real Provider supplied a complete durable receipt history.
 */
export type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerCandidateInternalV1 =
  z.infer<typeof ReceiptLedgerCandidateInternalV1Schema>;

export interface ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceStateInternalV1 {
  readonly namespace:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceNamespaceInternalV1;
  readonly receiptLedger:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerCandidateInternalV1;
}

export interface MintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1Input {
  readonly identityVerificationCapability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
  readonly initialState: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceStateInternalV1;
  /**
   * Reference-only accounting basis for retained Root/Registry/Catalog/key
   * history outside this machine's Acceptance namespace. The private mint
   * freezes this scalar into the machine binding; it is not production proof
   * of authenticated Installation Identity storage.
   */
  readonly retainedNonAcceptanceTrustHistoryLogicalBytes: number;
}

export type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceTransactionDecisionInternalV1 =
  | Readonly<{ readonly classification: "candidate_invalid" }>
  | Readonly<{ readonly classification: "generation_floor_regressed" }>
  | Readonly<{
      readonly classification: "committed";
      readonly candidate:
        ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1;
      readonly acceptedGenerationFloors: Readonly<{
        readonly rootMetadataGeneration: number;
        readonly registryManifestGeneration: number;
        readonly supportCatalogGeneration: number;
      }>;
    }>;

export interface ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceTransactionInputInternalV1 {
  readonly request: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1;
  readonly preState: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceStateInternalV1;
}

export type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceTransactionInternalV1 = (
  input: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceTransactionInputInternalV1,
) => ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceTransactionDecisionInternalV1 |
  PromiseLike<ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceTransactionDecisionInternalV1>;

export interface ExecuteProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1Input {
  readonly identityVerificationCapability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
  readonly referenceMachineCapability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1;
  readonly request: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1;
  readonly resolvedAt: ReturnType<typeof ProviderRegistryIsoTimestampV1Schema.parse>;
  readonly transaction:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceTransactionInternalV1;
}

interface ProviderStrongReadyBootstrapOrSteadyAcceptanceReferenceMachineBindingInternalV1 {
  readonly identityVerificationCapability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
  readonly installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1;
  readonly retainedNonAcceptanceTrustHistoryLogicalBytes: number;
  current: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceStateInternalV1;
  tail: Promise<void>;
}

const machineBindingsV1 = new CapturedWeakMapV1<
  object,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceReferenceMachineBindingInternalV1
>();

declare const readOnlyContinuityHandleBrandInternalV1: unique symbol;
export interface ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReadOnlyContinuityHandleInternalV1 {
  readonly [readOnlyContinuityHandleBrandInternalV1]: true;
}

export type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReadOnlyContinuityPhaseInternalV1 =
  | "endpoint_claim"
  | "pre"
  | "post";

interface ReadOnlyContinuityBindingInternalV1 {
  readonly machineBinding:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceReferenceMachineBindingInternalV1;
  readonly expectedState:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceStateInternalV1;
  nextPhaseIndex: number;
}

const readOnlyContinuityBindingsInternalV1 = new CapturedWeakMapV1<
  object,
  ReadOnlyContinuityBindingInternalV1
>();
const READ_ONLY_CONTINUITY_PHASES_INTERNAL_V1 = CapturedObjectFreezeV1([
  "endpoint_claim",
  "pre",
  "post",
] as const);

function isObjectIdentityV1(value: unknown): value is object {
  return value !== null &&
    (typeof value === "object" || typeof value === "function");
}

function failV1(
  stage: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineStageInternalV1,
  reason: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineReasonInternalV1,
): never {
  throw new ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineErrorInternalV1(
    stage,
    reason,
  );
}

function defineFrozenEnumerableDataV1(
  target: object,
  key: string,
  value: unknown,
): void {
  const descriptor = CapturedObjectCreateV1(null) as Record<string, unknown>;
  descriptor.value = value;
  descriptor.enumerable = true;
  descriptor.configurable = false;
  descriptor.writable = false;
  CapturedObjectDefinePropertyV1(target, key, descriptor);
}

function createFrozenRecordV1<T extends object>(
  entries: readonly (readonly [string, unknown])[],
): T {
  const record = CapturedObjectCreateV1(null) as object;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    defineFrozenEnumerableDataV1(record, entry[0], entry[1]);
  }
  return CapturedObjectFreezeV1(record) as T;
}

function freezeParsedJsonV1<T extends object>(value: T): T {
  return deepFreezeProviderPointDetachedDataTreeV1(value);
}

function cloneFrozenJsonV1<T extends object>(value: T): T {
  return freezeParsedJsonV1(
    CapturedJsonParseV1(canonicalizeJcsSafeIntegerV1(value)) as T,
  );
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  return canonicalizeJcsSafeIntegerV1(left) ===
    canonicalizeJcsSafeIntegerV1(right);
}

function readEnumerableDataFieldV1(
  value: unknown,
  key: string,
): unknown {
  if (!isObjectIdentityV1(value)) {
    return failV1("input", "schema_invalid");
  }
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = CapturedObjectGetOwnPropertyDescriptorV1(value, key);
  } catch {
    return failV1("input", "schema_invalid");
  }
  if (
    descriptor === undefined ||
    !("value" in descriptor) ||
    descriptor.enumerable !== true
  ) {
    return failV1("input", "schema_invalid");
  }
  return descriptor.value;
}

function canonicalLogicalBytesV1(value: object): number {
  return typedArrayByteLengthV1(CapturedReflectApplyV1(
    CapturedTextEncoderPrototypeEncodeV1,
    CapturedUtf8EncoderV1,
    [canonicalizeJcsSafeIntegerV1(value)],
  ) as Uint8Array);
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
  const byteLength = typedArrayByteLengthV1(bytes);
  for (let index = 0; index < byteLength; index += 1) {
    const byte = bytes[index]!;
    output += alphabet[(byte >>> 4) & 0x0f]! + alphabet[byte & 0x0f]!;
  }
  return output;
}

function projectReceiptLedgerDigestEntriesV1(
  entries:
    readonly ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerEntryCandidateInternalV1[],
): readonly Readonly<{
  readonly linearizationOrdinal: number;
  readonly operationNonce: string;
  readonly contentDigest: string;
}>[] {
  const projected: Readonly<{
    readonly linearizationOrdinal: number;
    readonly operationNonce: string;
    readonly contentDigest: string;
  }>[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    projected[index] = createFrozenRecordV1([
      ["linearizationOrdinal", entries[index]!.linearizationOrdinal],
      ["operationNonce", entries[index]!.operationNonce],
      ["contentDigest", entries[index]!.contentDigest],
    ]);
  }
  return CapturedObjectFreezeV1(projected);
}

export function deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptSetDigestCandidateInternalV1(
  input: Readonly<{
    readonly installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1;
    readonly entries: readonly Readonly<{
      readonly linearizationOrdinal: number;
      readonly operationNonce: string;
      readonly contentDigest: string;
    }>[];
  }>,
): ReturnType<typeof ContentDigestV1Schema.parse> {
  return ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHexV1(sha256InternalV1(encodeUtf8V1(
      canonicalizeJcsSafeIntegerV1([
        PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_COMPARE_APPEND_RECEIPT_SET_REFERENCE_CANDIDATE_DOMAIN_INTERNAL_V1,
        input,
      ]),
    )))}`,
  );
}

/**
 * Constructs the private sealed-set candidate used by the reference machine.
 * The returned commitment is self-consistency evidence only, never a claim of
 * real Provider receipt-ledger completeness or durability.
 */
export function createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerCandidateInternalV1(
  input: Readonly<{
    readonly installationIdentityGenerationId:
      InstallationIdentityGenerationIdV1;
    readonly receipts:
      readonly ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1[];
  }>,
): ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerCandidateInternalV1 {
  const entries:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerEntryCandidateInternalV1[] =
      [];
  for (let index = 0; index < input.receipts.length; index += 1) {
    const receipt = input.receipts[index]!;
    entries[index] = createFrozenRecordV1<
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerEntryCandidateInternalV1
    >([
      ["linearizationOrdinal", index + 1],
      ["operationNonce", receipt.operationNonce],
      ["contentDigest", receipt.contentDigest],
      ["receipt", receipt],
    ]);
  }
  let receiptLogicalBytes = 0;
  for (let index = 0; index < entries.length; index += 1) {
    receiptLogicalBytes += canonicalLogicalBytesV1(entries[index]!.receipt);
  }
  const frozenEntries = CapturedObjectFreezeV1(entries);
  const receiptSetDigest =
    deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptSetDigestCandidateInternalV1({
      installationIdentityGenerationId:
        input.installationIdentityGenerationId,
      entries: projectReceiptLedgerDigestEntriesV1(frozenEntries),
    });
  return freezeParsedJsonV1(
    ReceiptLedgerCandidateInternalV1Schema.parse({
      profile:
        "provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_receipt_ledger_reference_candidate_v1",
      installationIdentityGenerationId:
        input.installationIdentityGenerationId,
      entries: frozenEntries,
      receiptCount: frozenEntries.length,
      receiptSetDigest,
      receiptLogicalBytes,
    }),
  );
}

function parseInitialStateV1(
  input: unknown,
): ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceStateInternalV1 {
  try {
    const fields = captureProviderPointDetachedExactDataObjectV1(
      input,
      INITIAL_STATE_KEYS_V1,
    );
    const namespaceState = readEnumerableDataFieldV1(
      fields.namespace,
      "state",
    );
    const namespaceFields = captureProviderPointDetachedExactDataObjectV1(
      fields.namespace,
      namespaceState === "current"
        ? NAMESPACE_CURRENT_KEYS_V1
        : namespaceState === "integrity_failed"
        ? NAMESPACE_INTEGRITY_FAILED_KEYS_V1
        : NAMESPACE_ABSENT_KEYS_V1,
    );
    let namespace:
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceNamespaceInternalV1;
    if (namespaceFields.state === "absent") {
      namespace = createFrozenRecordV1([["state", "absent"]]);
    } else if (namespaceFields.state === "integrity_failed") {
      namespace = createFrozenRecordV1([
        ["state", "integrity_failed"],
        ["evidenceDigest", ContentDigestV1Schema.parse(
          namespaceFields.evidenceDigest,
        )],
      ]);
    } else if (namespaceFields.state === "current") {
      const currentRead = freezeParsedJsonV1(
        ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentReadReferenceCandidateV1Schema.parse(
          namespaceFields.currentRead,
        ),
      );
      const generations = freezeParsedJsonV1(
        GenerationEnvelopeListV1Schema.parse(namespaceFields.generations),
      );
      namespace = createFrozenRecordV1([
        ["state", "current"],
        ["currentRead", currentRead],
        ["generations", generations],
      ]);
    } else {
      return failV1("acceptance_namespace", "source_invalid");
    }
    const receiptLedger = freezeParsedJsonV1(
      ReceiptLedgerCandidateInternalV1Schema.parse(fields.receiptLedger),
    );
    return createFrozenRecordV1([
      ["namespace", namespace],
      ["receiptLedger", receiptLedger],
    ]);
  } catch (error) {
    if (isProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineErrorInternalV1(error)) {
      throw error;
    }
    return failV1("input", "schema_invalid");
  }
}

function createOpaqueMachineCapabilityV1():
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1 {
  return CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1;
}

function requireMachineBindingV1(
  capability: unknown,
): ProviderStrongReadyBootstrapOrSteadyAcceptanceReferenceMachineBindingInternalV1 {
  if (
    !isObjectIdentityV1(capability) ||
    !weakMapHasV1(machineBindingsV1, capability)
  ) {
    return failV1("reference_machine_capability", "capability_invalid");
  }
  const binding = weakMapGetV1(machineBindingsV1, capability);
  if (binding === undefined) {
    return failV1("reference_machine_capability", "capability_invalid");
  }
  return binding;
}

function pinForGenerationV1(
  generation: ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
): Readonly<{
  locatorProfile: "installation_provider_acceptance_state_v1";
  acceptanceOrdinal: number;
  generationId: typeof generation.generationId;
  contentDigest: typeof generation.contentDigest;
}> {
  return createFrozenRecordV1([
    ["locatorProfile", "installation_provider_acceptance_state_v1"],
    ["acceptanceOrdinal", generation.payload.acceptanceOrdinal],
    ["generationId", generation.generationId],
    ["contentDigest", generation.contentDigest],
  ]);
}

function generationMatchesEntryV1(
  generation: ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
  entry: ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationEntryReferenceCandidateV1,
): boolean {
  const pin = pinForGenerationV1(generation);
  return pin.locatorProfile === entry.locatorProfile &&
    pin.acceptanceOrdinal === entry.acceptanceOrdinal &&
    pin.generationId === entry.generationId &&
    pin.contentDigest === entry.contentDigest;
}

function observedHighWaterV1(
  namespace: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceNamespaceInternalV1,
): object {
  if (namespace.state === "absent") {
    return createFrozenRecordV1([["state", "absent"]]);
  }
  if (namespace.state === "integrity_failed") {
    return createFrozenRecordV1([
      ["state", "integrity_failed"],
      ["evidenceDigest", namespace.evidenceDigest],
    ]);
  }
  return createFrozenRecordV1([
    ["state", "trusted"],
    ["highWater", namespace.currentRead.highWater],
  ]);
}

function expectedMatchesV1(
  request: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1,
  namespace: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceNamespaceInternalV1,
): boolean {
  if (namespace.state === "integrity_failed") return false;
  if (namespace.state === "absent") return request.expected.state === "genesis";
  if (request.expected.state !== "current") return false;
  const highWater = namespace.currentRead.highWater;
  return request.expected.highWaterRevision ===
      highWater.payload.highWaterRevision &&
    request.expected.highWaterContentDigest === highWater.contentDigest &&
    request.expected.currentVersionToken === highWater.currentVersionToken &&
    request.expected.generationCount === highWater.payload.generationCount &&
    request.expected.generationSetDigest ===
      highWater.payload.generationSetDigest;
}

async function validateGenerationEnvelopeV1(
  capability: ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
  identity: InstallationIdentityGenerationIdV1,
  input: unknown,
): Promise<ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1> {
  const envelope = freezeParsedJsonV1(
    ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema.parse(input),
  );
  const payload = envelope.payload;
  if (
    envelope.generationId !== payload.generationId ||
    envelope.installationIdentityGenerationId !==
      payload.installationIdentityGenerationId ||
    envelope.acceptedAt !== payload.acceptedAt ||
    envelope.installationIdentityGenerationId !== identity ||
    envelope.generationId !==
      deriveProviderStrongReadyAcceptanceStateGenerationIdV1({
        installationIdentityGenerationId:
          payload.installationIdentityGenerationId,
        acceptanceOrdinal: payload.acceptanceOrdinal,
        predecessor: payload.predecessor,
        configuration: payload.configuration,
      }) ||
    envelope.contentDigest !==
      deriveProviderStrongReadyAcceptanceStateContentDigestV1(payload) ||
    !(await verifyProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
      capability,
      identity,
      payload,
      payload.acceptanceToken,
    ))
  ) {
    return failV1("acceptance_namespace", "namespace_integrity_failed");
  }
  return envelope;
}

async function validateHighWaterEnvelopeV1(
  capability: ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
  identity: InstallationIdentityGenerationIdV1,
  input: unknown,
): Promise<ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1> {
  const highWater = freezeParsedJsonV1(
    ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1Schema.parse(input),
  );
  if (
    highWater.payload.installationIdentityGenerationId !== identity ||
    !(await verifyProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenWithIdentityCapabilityInternalV1(
      capability,
      identity,
      highWater,
      highWater.currentVersionToken,
    ))
  ) {
    return failV1("acceptance_namespace", "namespace_integrity_failed");
  }
  return highWater;
}

async function validateReceiptLedgerV1(
  capability: ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
  identity: InstallationIdentityGenerationIdV1,
  state: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceStateInternalV1,
): Promise<Map<string, ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1>> {
  const ledger = state.receiptLedger;
  const receipts = ledger.entries;
  if (
    ledger.installationIdentityGenerationId !== identity ||
    ledger.receiptCount !== receipts.length ||
    receipts.length > PROVIDER_TRUST_HISTORY_POLICY_V1
      .maxAcceptanceCompareAppendReceiptCountPerInstallationIdentity
  ) {
    return failV1("acceptance_receipt_ledger", "ledger_integrity_failed");
  }
  const byNonce = new CapturedMapV1<
    string,
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1
  >();
  let logicalBytes = 0;
  try {
    for (let index = 0; index < receipts.length; index += 1) {
      const entryFields = captureProviderPointDetachedExactDataObjectV1(
        receipts[index],
        RECEIPT_LEDGER_ENTRY_KEYS_V1,
      );
      const entry = freezeParsedJsonV1(
        ReceiptLedgerEntryCandidateInternalV1Schema.parse(entryFields),
      );
      const receipt = freezeParsedJsonV1(
        ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1Schema.parse(
          entry.receipt,
        ),
      );
      if (
        entry.linearizationOrdinal !== index + 1 ||
        entry.operationNonce !== receipt.operationNonce ||
        entry.contentDigest !== receipt.contentDigest ||
        receipt.payload.linearizationOrdinal !== entry.linearizationOrdinal ||
        receipt.installationIdentityGenerationId !== identity ||
        mapHasV1(byNonce, receipt.operationNonce) ||
        !(await verifyProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptTokenWithIdentityCapabilityInternalV1(
          capability,
          identity,
          receipt.payload,
          receipt.payload.receiptToken,
        ))
      ) {
        return failV1(
          "acceptance_receipt_ledger",
          "ledger_integrity_failed",
        );
      }
      const bytes = canonicalLogicalBytesV1(receipt);
      if (
        bytes > PROVIDER_TRUST_HISTORY_POLICY_V1
          .maxSingleAcceptanceCompareAppendReceiptLogicalBytes
      ) {
        return failV1(
          "acceptance_receipt_ledger",
          "ledger_integrity_failed",
        );
      }
      logicalBytes += bytes;
      mapSetV1(byNonce, receipt.operationNonce, receipt);
    }
    if (
      ledger.receiptLogicalBytes !== logicalBytes ||
      ledger.receiptSetDigest !==
        deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptSetDigestCandidateInternalV1({
          installationIdentityGenerationId: identity,
          entries: projectReceiptLedgerDigestEntriesV1(receipts),
        }) ||
      logicalBytes > PROVIDER_TRUST_HISTORY_POLICY_V1
        .maxAcceptanceCompareAppendReceiptLogicalBytesPerInstallationIdentity
    ) {
      return failV1("acceptance_receipt_ledger", "ledger_integrity_failed");
    }
    return byNonce;
  } catch (error) {
    if (isProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineErrorInternalV1(error)) {
      throw error;
    }
    return failV1("acceptance_receipt_ledger", "ledger_integrity_failed");
  }
}

async function validateNamespaceClosureV1(
  capability: ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
  identity: InstallationIdentityGenerationIdV1,
  state: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceStateInternalV1,
  receiptsByNonce: Map<
    string,
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1
  >,
): Promise<void> {
  const namespace = state.namespace;
  if (namespace.state === "integrity_failed") return;

  try {
    let replayedHighWater:
      ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1 | undefined;
    let committedReplayCount = 0;
    for (
      let index = 0;
      index < state.receiptLedger.entries.length;
      index += 1
    ) {
      const receipt = state.receiptLedger.entries[index]!.receipt;
      const outcome = receipt.payload.referenceOutcome;
      const expectedObservation = replayedHighWater === undefined
        ? createFrozenRecordV1([["state", "absent"]])
        : createFrozenRecordV1([
          ["state", "trusted"],
          ["highWater", replayedHighWater],
        ]);
      if (outcome.outcome === "not_committed") {
        if (!canonicalEqualV1(outcome.observedHighWater, expectedObservation)) {
          return failV1(
            "acceptance_namespace",
            "namespace_integrity_failed",
          );
        }
        continue;
      }
      const nextHighWater = await validateHighWaterEnvelopeV1(
        capability,
        identity,
        outcome.committedHighWater,
      );
      if (
        nextHighWater.payload.highWaterRevision !== committedReplayCount + 1 ||
        (replayedHighWater === undefined
          ? nextHighWater.payload.predecessor.state !== "genesis"
          : nextHighWater.payload.predecessor.state !== "version" ||
            nextHighWater.payload.predecessor.highWaterRevision !==
              replayedHighWater.payload.highWaterRevision ||
            nextHighWater.payload.predecessor.contentDigest !==
              replayedHighWater.contentDigest ||
            nextHighWater.payload.predecessor.currentVersionToken !==
              replayedHighWater.currentVersionToken)
      ) {
        return failV1("acceptance_namespace", "namespace_integrity_failed");
      }
      replayedHighWater = nextHighWater;
      committedReplayCount += 1;
    }
    if (namespace.state === "absent") {
      if (replayedHighWater !== undefined) {
        return failV1("acceptance_namespace", "namespace_integrity_failed");
      }
      return;
    }
    const currentRead = freezeParsedJsonV1(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentReadReferenceCandidateV1Schema.parse(
        namespace.currentRead,
      ),
    );
    const enumeration = currentRead.enumeration;
    const generations = namespace.generations;
    if (
      enumeration.installationIdentityGenerationId !== identity ||
      generations.length !== enumeration.entries.length
    ) {
      return failV1("acceptance_namespace", "namespace_integrity_failed");
    }

    const committedReceipts = new CapturedSetV1<string>();
    let previousHighWater:
      ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1 | undefined;
    let runningFloors:
      Readonly<{
        readonly rootMetadataGeneration: number;
        readonly registryManifestGeneration: number;
        readonly supportCatalogGeneration: number;
      }> | undefined;
    for (let index = 0; index < generations.length; index += 1) {
      const generation = await validateGenerationEnvelopeV1(
        capability,
        identity,
        generations[index],
      );
      if (
        canonicalLogicalBytesV1(generation) >
          PROVIDER_TRUST_HISTORY_POLICY_V1
            .maxSingleTrustEnvelopeLogicalBytes
      ) {
        return failV1("acceptance_namespace", "namespace_integrity_failed");
      }
      const entry = enumeration.entries[index]!;
      if (
        !generationMatchesEntryV1(generation, entry) ||
        !canonicalEqualV1(generation.payload.predecessor, entry.predecessor)
      ) {
        return failV1("acceptance_namespace", "namespace_integrity_failed");
      }
      const receipt = mapGetV1(
        receiptsByNonce,
        entry.commitOperationNonce,
      );
      if (
        receipt === undefined ||
        receipt.payload.referenceOutcome.outcome !== "committed" ||
        setHasV1(committedReceipts, entry.commitOperationNonce)
      ) {
        return failV1(
          "acceptance_receipt_ledger",
          "ledger_integrity_failed",
        );
      }
      setAddV1(committedReceipts, entry.commitOperationNonce);
      const outcome = receipt.payload.referenceOutcome;
      const highWater = await validateHighWaterEnvelopeV1(
        capability,
        identity,
        outcome.committedHighWater,
      );
      if (
        canonicalLogicalBytesV1(highWater) >
          PROVIDER_TRUST_HISTORY_POLICY_V1
            .maxSingleTrustEnvelopeLogicalBytes
      ) {
        return failV1("acceptance_namespace", "namespace_integrity_failed");
      }
      const prefix = arraySliceV1(enumeration.entries, 0, index + 1);
      const candidateFloors = candidateFloorsV1(generation);
      runningFloors = runningFloors === undefined
        ? candidateFloors
        : createFrozenRecordV1<{
          readonly rootMetadataGeneration: number;
          readonly registryManifestGeneration: number;
          readonly supportCatalogGeneration: number;
        }>([
          ["rootMetadataGeneration",
            candidateFloors.rootMetadataGeneration >
                runningFloors.rootMetadataGeneration
              ? candidateFloors.rootMetadataGeneration
              : runningFloors.rootMetadataGeneration],
          ["registryManifestGeneration",
            candidateFloors.registryManifestGeneration >
                runningFloors.registryManifestGeneration
              ? candidateFloors.registryManifestGeneration
              : runningFloors.registryManifestGeneration],
          ["supportCatalogGeneration",
            candidateFloors.supportCatalogGeneration >
                runningFloors.supportCatalogGeneration
              ? candidateFloors.supportCatalogGeneration
              : runningFloors.supportCatalogGeneration],
        ]);
      if (
        !canonicalEqualV1(
          receipt.payload.requestReferenceProjection.candidate,
          generation,
        ) ||
        receipt.payload.requestReferenceProjection.operationNonce !==
          entry.commitOperationNonce ||
        !canonicalEqualV1(outcome.appendedGeneration, entry) ||
        highWater.payload.highWaterRevision !== index + 1 ||
        highWater.payload.generationCount !== index + 1 ||
        highWater.payload.generationSetDigest !==
          deriveProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationSetDigestReferenceCandidateV1({
            entries: prefix,
          }) ||
        !canonicalEqualV1(
          highWater.payload.acceptedGenerationFloors,
          runningFloors,
        ) ||
        (previousHighWater === undefined
          ? highWater.payload.predecessor.state !== "genesis"
          : highWater.payload.predecessor.state !== "version" ||
            highWater.payload.predecessor.highWaterRevision !==
              previousHighWater.payload.highWaterRevision ||
            highWater.payload.predecessor.contentDigest !==
              previousHighWater.contentDigest ||
            highWater.payload.predecessor.currentVersionToken !==
              previousHighWater.currentVersionToken)
      ) {
        return failV1("acceptance_namespace", "namespace_integrity_failed");
      }
      previousHighWater = highWater;
    }
    for (
      let index = 0;
      index < state.receiptLedger.entries.length;
      index += 1
    ) {
      const receipt = state.receiptLedger.entries[index]!.receipt;
      if (
        receipt.payload.referenceOutcome.outcome === "committed" &&
        !setHasV1(committedReceipts, receipt.operationNonce)
      ) {
        return failV1(
          "acceptance_receipt_ledger",
          "ledger_integrity_failed",
        );
      }
    }
    if (
      previousHighWater === undefined ||
      !canonicalEqualV1(currentRead.highWater, previousHighWater) ||
      committedReplayCount !== generations.length ||
      replayedHighWater === undefined ||
      !canonicalEqualV1(replayedHighWater, currentRead.highWater)
    ) {
      return failV1("acceptance_namespace", "namespace_integrity_failed");
    }
  } catch (error) {
    if (isProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineErrorInternalV1(error)) {
      throw error;
    }
    return failV1("acceptance_namespace", "namespace_integrity_failed");
  }
}

function receiptLogicalBytesV1(
  state: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceStateInternalV1,
): number {
  return state.receiptLedger.receiptLogicalBytes;
}

function generationLogicalBytesV1(
  state: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceStateInternalV1,
): number {
  if (state.namespace.state !== "current") return 0;
  let total = 0;
  for (
    let index = 0;
    index < state.namespace.generations.length;
    index += 1
  ) {
    total += canonicalLogicalBytesV1(state.namespace.generations[index]!);
  }
  return total;
}

function currentMetadataLogicalBytesV1(
  state: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceStateInternalV1,
): number {
  if (state.namespace.state !== "current") return 0;
  return canonicalLogicalBytesV1(state.namespace.currentRead.highWater) +
    canonicalLogicalBytesV1(state.namespace.currentRead.enumeration);
}

function acceptanceLogicalBytesV1(
  state: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceStateInternalV1,
): number {
  return receiptLogicalBytesV1(state) + generationLogicalBytesV1(state) +
    currentMetadataLogicalBytesV1(state);
}

export interface ProviderStrongReadyBootstrapOrSteadyAcceptanceAdmissionScalarsInternalV1 {
  readonly acceptanceGenerationCount: number;
  readonly acceptanceReceiptCount: number;
  readonly acceptanceReceiptLogicalBytes: number;
  readonly singleAcceptanceReceiptLogicalBytes: number;
  readonly singleAcceptanceGenerationLogicalBytes: number;
  readonly singleAcceptanceHighWaterLogicalBytes: number;
  readonly totalTrustHistoryLogicalBytes: number;
}

export type ProviderStrongReadyBootstrapOrSteadyAcceptanceAdmissionClassificationInternalV1 =
  | "admitted"
  | "acceptance_generation_count_exhausted"
  | "acceptance_receipt_count_exhausted"
  | "acceptance_receipt_logical_bytes_exhausted"
  | "single_acceptance_receipt_too_large"
  | "single_acceptance_generation_too_large"
  | "single_acceptance_high_water_too_large"
  | "total_trust_history_logical_bytes_exhausted";

/**
 * Pure scalar form of the normal-update admission policy. Callers provide the
 * complete prospective totals (including the new operation), so the same
 * boundary classifier is used by both the early zero-write gate and the exact
 * canonical successor admission below.
 */
export function classifyProviderStrongReadyBootstrapOrSteadyAcceptanceAdmissionScalarsInternalV1(
  input: ProviderStrongReadyBootstrapOrSteadyAcceptanceAdmissionScalarsInternalV1,
): ProviderStrongReadyBootstrapOrSteadyAcceptanceAdmissionClassificationInternalV1 {
  const policy = PROVIDER_TRUST_HISTORY_POLICY_V1;
  if (
    input.acceptanceReceiptCount >
      policy.maxAcceptanceCompareAppendReceiptCountPerInstallationIdentity -
        policy.normalUpdateEmergencyAcceptanceReceiptReserve
  ) return "acceptance_receipt_count_exhausted";
  if (
    input.acceptanceGenerationCount >
      policy.maxAcceptanceGenerationCountPerInstallationIdentity -
        policy.normalUpdateEmergencyGenerationReserve
  ) return "acceptance_generation_count_exhausted";
  if (
    input.singleAcceptanceReceiptLogicalBytes >
      policy.maxSingleAcceptanceCompareAppendReceiptLogicalBytes
  ) return "single_acceptance_receipt_too_large";
  if (
    input.singleAcceptanceGenerationLogicalBytes >
      policy.maxSingleTrustEnvelopeLogicalBytes
  ) return "single_acceptance_generation_too_large";
  if (
    input.singleAcceptanceHighWaterLogicalBytes >
      policy.maxSingleTrustEnvelopeLogicalBytes
  ) return "single_acceptance_high_water_too_large";
  if (
    input.acceptanceReceiptLogicalBytes >
      policy.maxAcceptanceCompareAppendReceiptLogicalBytesPerInstallationIdentity -
        policy.normalUpdateEmergencyLogicalBytesReserve
  ) return "acceptance_receipt_logical_bytes_exhausted";
  if (
    input.totalTrustHistoryLogicalBytes >
      policy.maxTotalTrustHistoryLogicalBytesPerInstallationIdentity -
        policy.normalUpdateEmergencyLogicalBytesReserve
  ) return "total_trust_history_logical_bytes_exhausted";
  return "admitted";
}

function preAdmitCapacityV1(
  state: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceStateInternalV1,
  retainedNonAcceptanceTrustHistoryLogicalBytes: number,
): void {
  const generationCount = state.namespace.state === "current"
    ? state.namespace.generations.length
    : 0;
  const receiptBytes = receiptLogicalBytesV1(state);
  const totalBytes = retainedNonAcceptanceTrustHistoryLogicalBytes +
    acceptanceLogicalBytesV1(state);
  if (
    classifyProviderStrongReadyBootstrapOrSteadyAcceptanceAdmissionScalarsInternalV1({
      acceptanceGenerationCount: generationCount + 1,
      acceptanceReceiptCount: state.receiptLedger.receiptCount + 1,
      // Every canonical receipt is non-empty. Adding one byte preserves the
      // old early-gate semantics at the exact remaining-byte boundary.
      acceptanceReceiptLogicalBytes: receiptBytes + 1,
      singleAcceptanceReceiptLogicalBytes: 0,
      singleAcceptanceGenerationLogicalBytes: 0,
      singleAcceptanceHighWaterLogicalBytes: 0,
      totalTrustHistoryLogicalBytes: totalBytes + 1,
    }) !== "admitted"
  ) {
    return failV1("acceptance_capacity", "receipt_capacity_exhausted");
  }
}

function parseTransactionDecisionV1(
  input: unknown,
): ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceTransactionDecisionInternalV1 {
  try {
    if (!isObjectIdentityV1(input)) {
      return failV1("candidate", "source_invalid");
    }
    const classification = readEnumerableDataFieldV1(
      input,
      "classification",
    );
    if (classification === "candidate_invalid") {
      captureProviderPointDetachedExactDataObjectV1(
        input,
        TRANSACTION_CANDIDATE_INVALID_KEYS_V1,
      );
      return createFrozenRecordV1([["classification", "candidate_invalid"]]);
    }
    if (
      classification === "generation_floor_regressed"
    ) {
      captureProviderPointDetachedExactDataObjectV1(
        input,
        TRANSACTION_FLOOR_REGRESSED_KEYS_V1,
      );
      return createFrozenRecordV1([
        ["classification", "generation_floor_regressed"],
      ]);
    }
    if (classification !== "committed") {
      return failV1("candidate", "source_invalid");
    }
    const fields = captureProviderPointDetachedExactDataObjectV1(
      input,
      TRANSACTION_COMMITTED_KEYS_V1,
    );
    captureProviderPointDetachedExactDataObjectV1(
      fields.acceptedGenerationFloors,
      GENERATION_FLOOR_KEYS_V1,
    );
    return createFrozenRecordV1([
      ["classification", "committed"],
      ["candidate", freezeParsedJsonV1(
        ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema.parse(
          fields.candidate,
        ),
      )],
      ["acceptedGenerationFloors", freezeParsedJsonV1(
        GenerationFloorsV1Schema.parse(fields.acceptedGenerationFloors),
      )],
    ]);
  } catch (error) {
    if (isProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineErrorInternalV1(error)) {
      throw error;
    }
    return failV1("candidate", "source_invalid");
  }
}

function candidateFloorsV1(
  candidate: ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
): Readonly<{
  rootMetadataGeneration: number;
  registryManifestGeneration: number;
  supportCatalogGeneration: number;
}> {
  const core = candidate.payload.configuration.core;
  return createFrozenRecordV1([
    ["rootMetadataGeneration", core.activeRootMetadata.rootGeneration],
    ["registryManifestGeneration",
      core.providerRegistryManifest.manifestGeneration],
    ["supportCatalogGeneration",
      core.providerSupportCatalog.catalogGeneration],
  ]);
}

function floorsRegressedV1(
  next: Readonly<{
    rootMetadataGeneration: number;
    registryManifestGeneration: number;
    supportCatalogGeneration: number;
  }>,
  namespace: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceNamespaceInternalV1,
): boolean {
  if (namespace.state !== "current") return false;
  const current = namespace.currentRead.highWater.payload
    .acceptedGenerationFloors;
  return next.rootMetadataGeneration < current.rootMetadataGeneration ||
    next.registryManifestGeneration < current.registryManifestGeneration ||
    next.supportCatalogGeneration < current.supportCatalogGeneration;
}

async function buildHighWaterV1(
  capability: ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
  identity: InstallationIdentityGenerationIdV1,
  request: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1,
  preState: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceStateInternalV1,
  entry: ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationEntryReferenceCandidateV1,
  entries: readonly ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationEntryReferenceCandidateV1[],
  floors: Readonly<{
    rootMetadataGeneration: number;
    registryManifestGeneration: number;
    supportCatalogGeneration: number;
  }>,
): Promise<ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1> {
  const previous = preState.namespace.state === "current"
    ? preState.namespace.currentRead.highWater
    : undefined;
  const payload = freezeParsedJsonV1(
    ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterReferenceCandidateV1Schema.parse({
      profile: "provider_strong_ready_bootstrap_or_steady_acceptance_high_water_reference_candidate_v1",
      installationIdentityGenerationId: identity,
      highWaterRevision: entries.length,
      operationNonce: request.operationNonce,
      predecessor: previous === undefined
        ? { state: "genesis", expectedNamespaceState: "absent" }
        : {
          state: "version",
          highWaterRevision: previous.payload.highWaterRevision,
          contentDigest: previous.contentDigest,
          currentVersionToken: previous.currentVersionToken,
        },
      currentAcceptance: createFrozenRecordV1([
        ["locatorProfile", entry.locatorProfile],
        ["acceptanceOrdinal", entry.acceptanceOrdinal],
        ["generationId", entry.generationId],
        ["contentDigest", entry.contentDigest],
      ]),
      generationCount: entries.length,
      generationSetDigest:
        deriveProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationSetDigestReferenceCandidateV1({ entries }),
      acceptedGenerationFloors: floors,
    }),
  );
  const contentDigest =
    deriveProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterContentDigestReferenceCandidateV1(payload);
  const provisional = {
    schemaVersion: 1,
    recordType: "provider_strong_ready_bootstrap_or_steady_acceptance_high_water_reference_candidate",
    locatorProfile: "installation_provider_strong_ready_bootstrap_or_steady_acceptance_high_water_reference_candidate_v1",
    contentDigest,
    currentVersionToken: `hmac-sha256:${"0".repeat(64)}`,
    payload,
  };
  const currentVersionToken =
    await deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenWithIdentityCapabilityInternalV1(
      capability,
      identity,
      provisional,
    );
  return freezeParsedJsonV1(
    ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1Schema.parse({
      ...provisional,
      currentVersionToken,
    }),
  );
}

async function buildReceiptV1(
  capability: ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
  identity: InstallationIdentityGenerationIdV1,
  request: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1,
  linearizationOrdinal: number,
  resolvedAt: ReturnType<typeof ProviderRegistryIsoTimestampV1Schema.parse>,
  referenceOutcome: object,
): Promise<ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1> {
  const unsigned = freezeParsedJsonV1(
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptUnsignedReferenceCandidateV1Schema.parse({
      profile: "provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_receipt_reference_candidate_v1",
      installationIdentityGenerationId: identity,
      operationNonce: request.operationNonce,
      linearizationOrdinal,
      requestContentDigest:
        deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1(
          request,
        ),
      requestReferenceProjection: request,
      referenceOutcome,
      resolvedAt,
    }),
  );
  const receiptToken =
    await deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptTokenWithIdentityCapabilityInternalV1(
      capability,
      identity,
      unsigned,
    );
  const payload = freezeParsedJsonV1(
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptReferenceCandidateV1Schema.parse({
      ...unsigned,
      receiptToken,
    }),
  );
  return freezeParsedJsonV1(
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1Schema.parse({
      schemaVersion: 1,
      recordType: "provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_receipt_reference_candidate",
      locatorProfile:
        "installation_provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_receipt_reference_candidate_v1",
      installationIdentityGenerationId: identity,
      operationNonce: request.operationNonce,
      resolvedAt,
      contentDigest:
        deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptContentDigestReferenceCandidateV1(
          payload,
        ),
      payload,
    }),
  );
}

function admitProspectiveReceiptV1(
  preState: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceStateInternalV1,
  retainedNonAcceptanceTrustHistoryLogicalBytes: number,
  receipt: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1,
  generation?: ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
  highWater?: ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1,
  enumeration?: ReturnType<
    typeof ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationReferenceCandidateV1Schema.parse
  >,
): void {
  const receiptBytes = canonicalLogicalBytesV1(receipt);
  const generationBytes = generation === undefined
    ? 0
    : canonicalLogicalBytesV1(generation);
  const highWaterBytes = highWater === undefined
    ? 0
    : canonicalLogicalBytesV1(highWater);
  const nextReceiptBytes = receiptLogicalBytesV1(preState) + receiptBytes;
  const nextTotalBytes = retainedNonAcceptanceTrustHistoryLogicalBytes +
    nextReceiptBytes + generationLogicalBytesV1(preState) +
    generationBytes +
    (highWater === undefined
      ? currentMetadataLogicalBytesV1(preState)
      : highWaterBytes +
        canonicalLogicalBytesV1(enumeration!));
  const generationCount = preState.namespace.state === "current"
    ? preState.namespace.generations.length
    : 0;
  if (
    classifyProviderStrongReadyBootstrapOrSteadyAcceptanceAdmissionScalarsInternalV1({
      acceptanceGenerationCount: generationCount +
        (generation === undefined ? 0 : 1),
      acceptanceReceiptCount: preState.receiptLedger.receiptCount + 1,
      acceptanceReceiptLogicalBytes: nextReceiptBytes,
      singleAcceptanceReceiptLogicalBytes: receiptBytes,
      singleAcceptanceGenerationLogicalBytes: generationBytes,
      singleAcceptanceHighWaterLogicalBytes: highWaterBytes,
      totalTrustHistoryLogicalBytes: nextTotalBytes,
    }) !== "admitted"
  ) {
    return failV1("acceptance_receipt", "receipt_capacity_exhausted");
  }
}

function resolvedResultV1(
  receipt: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1,
): ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendResultReferenceCandidateV1 {
  return createFrozenRecordV1([
    ["resolution", "resolved"],
    ["receipt", receipt],
  ]);
}

async function executeLinearizedV1(
  binding: ProviderStrongReadyBootstrapOrSteadyAcceptanceReferenceMachineBindingInternalV1,
  request: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1,
  resolvedAt: ReturnType<typeof ProviderRegistryIsoTimestampV1Schema.parse>,
  transaction: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceTransactionInternalV1,
): Promise<ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendResultReferenceCandidateV1> {
  const preState = binding.current;
  const receiptsByNonce = await validateReceiptLedgerV1(
    binding.identityVerificationCapability,
    binding.installationIdentityGenerationId,
    preState,
  );
  const requestDigest =
    deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1(
      request,
    );
  const existing = mapGetV1(
    receiptsByNonce,
    request.operationNonce,
  );
  if (existing !== undefined) {
    if (existing.payload.requestContentDigest === requestDigest) {
      return resolvedResultV1(existing);
    }
    return createFrozenRecordV1([
      ["resolution", "request_rejected"],
      ["reason", "operation_nonce_request_mismatch"],
      ["existingReceipt", existing],
    ]);
  }

  preAdmitCapacityV1(
    preState,
    binding.retainedNonAcceptanceTrustHistoryLogicalBytes,
  );
  await validateNamespaceClosureV1(
    binding.identityVerificationCapability,
    binding.installationIdentityGenerationId,
    preState,
    receiptsByNonce,
  );

  let notCommittedReason:
    | "namespace_integrity_failed"
    | "expected_current_changed"
    | "candidate_invalid"
    | "generation_floor_regressed"
    | undefined;
  let committedCandidate:
    ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1 | undefined;
  let committedFloors: Readonly<{
    rootMetadataGeneration: number;
    registryManifestGeneration: number;
    supportCatalogGeneration: number;
  }> | undefined;

  if (preState.namespace.state === "integrity_failed") {
    notCommittedReason = "namespace_integrity_failed";
  } else if (!expectedMatchesV1(request, preState.namespace)) {
    notCommittedReason = "expected_current_changed";
  } else {
    let rawDecision: unknown;
    try {
      rawDecision = await CapturedReflectApplyV1(transaction, undefined, [
        createFrozenRecordV1([
          ["request", request],
          ["preState", cloneFrozenJsonV1(preState)],
        ]),
      ]);
    } catch (error) {
      throw error;
    }
    const decision = parseTransactionDecisionV1(rawDecision);
    if (decision.classification === "candidate_invalid") {
      notCommittedReason = "candidate_invalid";
    } else if (decision.classification === "generation_floor_regressed") {
      notCommittedReason = "generation_floor_regressed";
    } else {
      committedCandidate = await validateGenerationEnvelopeV1(
        binding.identityVerificationCapability,
        binding.installationIdentityGenerationId,
        decision.candidate,
      );
      const projectedFloors = candidateFloorsV1(committedCandidate);
      if (
        !canonicalEqualV1(committedCandidate, request.candidate) ||
        !canonicalEqualV1(projectedFloors, decision.acceptedGenerationFloors)
      ) {
        return failV1("candidate", "source_invalid");
      }
      committedFloors = decision.acceptedGenerationFloors;
      if (floorsRegressedV1(committedFloors, preState.namespace)) {
        notCommittedReason = "generation_floor_regressed";
        committedCandidate = undefined;
        committedFloors = undefined;
      }
    }
  }

  let receipt:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1;
  let successor:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceStateInternalV1;
  if (notCommittedReason !== undefined) {
    receipt = await buildReceiptV1(
      binding.identityVerificationCapability,
      binding.installationIdentityGenerationId,
      request,
      preState.receiptLedger.receiptCount + 1,
      resolvedAt,
      createFrozenRecordV1([
        ["outcome", "not_committed"],
        ["reason", notCommittedReason],
        ["observedHighWater", observedHighWaterV1(preState.namespace)],
      ]),
    );
    admitProspectiveReceiptV1(
      preState,
      binding.retainedNonAcceptanceTrustHistoryLogicalBytes,
      receipt,
    );
    const nextReceipts:
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1[] = [];
    for (
      let index = 0;
      index < preState.receiptLedger.entries.length;
      index += 1
    ) {
      nextReceipts[index] =
        preState.receiptLedger.entries[index]!.receipt;
    }
    nextReceipts[nextReceipts.length] = receipt;
    successor = createFrozenRecordV1([
      ["namespace", preState.namespace],
      ["receiptLedger",
        createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerCandidateInternalV1({
          installationIdentityGenerationId:
            binding.installationIdentityGenerationId,
          receipts: CapturedObjectFreezeV1(nextReceipts),
        })],
    ]);
  } else {
    if (committedCandidate === undefined || committedFloors === undefined) {
      return failV1("atomic_resolution", "post_state_invalid");
    }
    const previousEntries = preState.namespace.state === "current"
      ? preState.namespace.currentRead.enumeration.entries
      : [];
    const entry = freezeParsedJsonV1(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationEntryReferenceCandidateV1Schema.parse({
        ...pinForGenerationV1(committedCandidate),
        commitOperationNonce: request.operationNonce,
        predecessor: committedCandidate.payload.predecessor,
      }),
    );
    const entries = appendFrozenArrayByIndexV1(previousEntries, entry);
    const enumeration = freezeParsedJsonV1(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationReferenceCandidateV1Schema.parse({
        profile: "provider_strong_ready_bootstrap_or_steady_acceptance_generation_enumeration_reference_candidate_v1",
        installationIdentityGenerationId:
          binding.installationIdentityGenerationId,
        namespaceRevision: entries.length,
        entries,
        generationCount: entries.length,
        generationSetDigest:
          deriveProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationSetDigestReferenceCandidateV1({ entries }),
      }),
    );
    const highWater = await buildHighWaterV1(
      binding.identityVerificationCapability,
      binding.installationIdentityGenerationId,
      request,
      preState,
      entry,
      entries,
      committedFloors,
    );
    receipt = await buildReceiptV1(
      binding.identityVerificationCapability,
      binding.installationIdentityGenerationId,
      request,
      preState.receiptLedger.receiptCount + 1,
      resolvedAt,
      createFrozenRecordV1([
        ["outcome", "committed"],
        ["committedHighWater", highWater],
        ["appendedGeneration", entry],
      ]),
    );
    admitProspectiveReceiptV1(
      preState,
      binding.retainedNonAcceptanceTrustHistoryLogicalBytes,
      receipt,
      committedCandidate,
      highWater,
      enumeration,
    );
    const previousGenerations = preState.namespace.state === "current"
      ? preState.namespace.generations
      : [];
    const generations = appendFrozenArrayByIndexV1(
      previousGenerations,
      committedCandidate,
    );
    const currentRead = freezeParsedJsonV1(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentReadReferenceCandidateV1Schema.parse({
        profile: "provider_strong_ready_bootstrap_or_steady_acceptance_current_read_reference_candidate_v1",
        highWater,
        enumeration,
      }),
    );
    const nextReceipts:
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1[] = [];
    for (
      let index = 0;
      index < preState.receiptLedger.entries.length;
      index += 1
    ) {
      nextReceipts[index] =
        preState.receiptLedger.entries[index]!.receipt;
    }
    nextReceipts[nextReceipts.length] = receipt;
    successor = createFrozenRecordV1([
      ["namespace", createFrozenRecordV1([
        ["state", "current"],
        ["currentRead", currentRead],
        ["generations", generations],
      ])],
      ["receiptLedger",
        createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerCandidateInternalV1({
          installationIdentityGenerationId:
            binding.installationIdentityGenerationId,
          receipts: CapturedObjectFreezeV1(nextReceipts),
        })],
    ]);
  }

  try {
    const successorReceipts = await validateReceiptLedgerV1(
      binding.identityVerificationCapability,
      binding.installationIdentityGenerationId,
      successor,
    );
    await validateNamespaceClosureV1(
      binding.identityVerificationCapability,
      binding.installationIdentityGenerationId,
      successor,
      successorReceipts,
    );
  } catch {
    return failV1("post_state_closure", "post_state_invalid");
  }

  // The sole publication point. Every prospective object is already frozen,
  // admitted, and revalidated before this one full-state pointer swap.
  binding.current = successor;
  return resolvedResultV1(receipt);
}

async function mintPreparedV1(
  identityVerificationCapability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
  identity: InstallationIdentityGenerationIdV1,
  initialState: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceStateInternalV1,
  retainedNonAcceptanceTrustHistoryLogicalBytes: number,
): Promise<ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1> {
  const receipts = await validateReceiptLedgerV1(
    identityVerificationCapability,
    identity,
    initialState,
  );
  await validateNamespaceClosureV1(
    identityVerificationCapability,
    identity,
    initialState,
    receipts,
  );
  const capability = createOpaqueMachineCapabilityV1();
  weakMapSetV1(machineBindingsV1, capability, {
    identityVerificationCapability,
    installationIdentityGenerationId: identity,
    retainedNonAcceptanceTrustHistoryLogicalBytes,
    current: initialState,
    tail: CapturedPromiseResolveV1(undefined),
  });
  return capability;
}

/** Package-private mint; its exact input binds the machine to one identity. */
export function mintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(
  input: MintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1Input,
): Promise<ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1> {
  try {
    const fields = captureProviderPointDetachedExactDataObjectV1(
      input,
      MINT_INPUT_KEYS_V1,
    );
    const identity =
      getProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInstallationIdentityGenerationIdInternalV1(
        fields.identityVerificationCapability,
      );
    assertProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1(
      fields.identityVerificationCapability,
      identity,
    );
    const state = parseInitialStateV1(fields.initialState);
    const retainedNonAcceptanceTrustHistoryLogicalBytes =
      RetainedNonAcceptanceTrustHistoryLogicalBytesV1Schema.parse(
        fields.retainedNonAcceptanceTrustHistoryLogicalBytes,
      );
    return hardenProviderPointPromiseV1(
      mintPreparedV1(
        fields.identityVerificationCapability,
        identity,
        state,
        retainedNonAcceptanceTrustHistoryLogicalBytes,
      ),
    );
  } catch (error) {
    return createProviderPointRejectedPromiseV1(error);
  }
}

/**
 * Claims the per-machine queue synchronously, before request parsing and before
 * any callback or identity crypto. Existing-nonce paths never invoke the
 * transaction callback.
 */
export function executeProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(
  input: ExecuteProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1Input,
): Promise<ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendResultReferenceCandidateV1> {
  let fields: Readonly<Record<string, unknown>>;
  let binding: ProviderStrongReadyBootstrapOrSteadyAcceptanceReferenceMachineBindingInternalV1;
  try {
    fields = captureProviderPointDetachedExactDataObjectV1(
      input,
      EXECUTE_INPUT_KEYS_V1,
    );
    const suppliedIdentity =
      getProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInstallationIdentityGenerationIdInternalV1(
        fields.identityVerificationCapability,
      );
    binding = requireMachineBindingV1(fields.referenceMachineCapability);
    if (
      fields.identityVerificationCapability !==
        binding.identityVerificationCapability ||
      suppliedIdentity !== binding.installationIdentityGenerationId
    ) {
      return createProviderPointRejectedPromiseV1(
        new ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineErrorInternalV1(
          "reference_machine_capability",
          "capability_invalid",
        ),
      );
    }
    assertProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1(
      fields.identityVerificationCapability,
      binding.installationIdentityGenerationId,
    );
  } catch (error) {
    return createProviderPointRejectedPromiseV1(error);
  }

  let start: () => Promise<ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendResultReferenceCandidateV1>;
  try {
    const request = freezeParsedJsonV1(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1Schema.parse(
        fields.request,
      ),
    );
    if (
      request.installationIdentityGenerationId !==
      binding.installationIdentityGenerationId
    ) {
      return failV1("acceptance_compare_append_request", "source_invalid");
    }
    const resolvedAt = ProviderRegistryIsoTimestampV1Schema.parse(
      fields.resolvedAt,
    );
    if (typeof fields.transaction !== "function") {
      return failV1("input", "schema_invalid");
    }
    const transaction = fields.transaction as
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceTransactionInternalV1;
    start = () => executeLinearizedV1(
      binding,
      request,
      resolvedAt,
      transaction,
    );
  } catch (error) {
    const rejection = isProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineErrorInternalV1(
        error,
      )
      ? error
      : new ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineErrorInternalV1(
        "acceptance_compare_append_request",
        "schema_invalid",
      );
    start = () => CapturedPromiseRejectV1(rejection);
  }
  // Queue ownership is installed synchronously after the exact request
  // snapshot is captured and before `start` can run any callback/crypto.
  const operation = promiseThenV1(binding.tail, () => start());
  binding.tail = promiseThenV1(
    operation,
    () => undefined,
    () => undefined,
  );
  return hardenProviderPointPromiseV1(operation);
}

/** Test-only package-internal detached snapshot seam. */
export function inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(
  capability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1,
): ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceStateInternalV1 {
  return cloneFrozenJsonV1(requireMachineBindingV1(capability).current);
}

/**
 * Mint a zero-key observer that can only perform the fixed
 * endpoint_claim -> pre -> post continuity sequence against one immutable
 * expected D-40 state. It exposes no transaction, token, identity, or write
 * authority and cannot be converted back into the machine capability.
 */
export function mintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReadOnlyContinuityHandleInternalV1(
  capability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1,
  expectedState: unknown,
): ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReadOnlyContinuityHandleInternalV1 {
  const machineBinding = requireMachineBindingV1(capability);
  const parsedExpectedState = parseInitialStateV1(expectedState);
  if (!canonicalEqualV1(machineBinding.current, parsedExpectedState)) {
    return failV1("reference_machine_capability", "source_invalid");
  }
  const handle = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReadOnlyContinuityHandleInternalV1;
  weakMapSetV1(
    readOnlyContinuityBindingsInternalV1,
    handle,
    {
      machineBinding,
      expectedState: parsedExpectedState,
      nextPhaseIndex: 0,
    },
  );
  return handle;
}

/**
 * Claim one ordered read-only barrier. The phase is burned synchronously
 * before the machine tail is observed, and any mismatch permanently
 * invalidates the observer.
 */
export function captureProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReadOnlyContinuityInternalV1(
  handle:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReadOnlyContinuityHandleInternalV1,
  phase:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReadOnlyContinuityPhaseInternalV1,
): Promise<void> {
  if (!isObjectIdentityV1(handle)) {
    return createProviderPointRejectedPromiseV1(
      new ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineErrorInternalV1(
        "reference_machine_capability",
        "capability_invalid",
      ),
    );
  }
  const continuity = weakMapGetV1(
    readOnlyContinuityBindingsInternalV1,
    handle,
  );
  if (
    continuity === undefined ||
    READ_ONLY_CONTINUITY_PHASES_INTERNAL_V1[continuity.nextPhaseIndex] !==
      phase
  ) {
    return createProviderPointRejectedPromiseV1(
      new ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineErrorInternalV1(
        "reference_machine_capability",
        "capability_invalid",
      ),
    );
  }
  continuity.nextPhaseIndex += 1;
  if (phase === "post") {
    weakMapDeleteV1(readOnlyContinuityBindingsInternalV1, handle);
  }
  const machineBinding = continuity.machineBinding;
  const observation = promiseThenV1(machineBinding.tail, () => {
    if (!canonicalEqualV1(machineBinding.current, continuity.expectedState)) {
      return failV1("reference_machine_capability", "source_invalid");
    }
  });
  machineBinding.tail = promiseThenV1(
    observation,
    () => undefined,
    () => {
      weakMapDeleteV1(readOnlyContinuityBindingsInternalV1, handle);
    },
  );
  return hardenProviderPointPromiseV1(observation);
}

/**
 * Package-internal linearization barrier. The snapshot task is installed as
 * the new tail synchronously, so a later execute cannot pass it and the
 * returned detached state is adjacent to all work already claimed.
 */
export function captureProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineStateAfterPendingInternalV1(
  capability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1,
): Promise<ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceStateInternalV1> {
  let binding: ProviderStrongReadyBootstrapOrSteadyAcceptanceReferenceMachineBindingInternalV1;
  try {
    binding = requireMachineBindingV1(capability);
  } catch (error) {
    return createProviderPointRejectedPromiseV1(error);
  }
  const snapshot = promiseThenV1(
    binding.tail,
    () => cloneFrozenJsonV1(binding.current),
  );
  binding.tail = promiseThenV1(
    snapshot,
    () => undefined,
    () => undefined,
  );
  return hardenProviderPointPromiseV1(snapshot);
}

CapturedObjectFreezeV1(
  mintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1,
);
CapturedObjectFreezeV1(
  executeProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1,
);
CapturedObjectFreezeV1(
  inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1,
);
CapturedObjectFreezeV1(
  mintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReadOnlyContinuityHandleInternalV1,
);
CapturedObjectFreezeV1(
  captureProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReadOnlyContinuityInternalV1,
);
CapturedObjectFreezeV1(
  captureProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineStateAfterPendingInternalV1,
);
CapturedObjectFreezeV1(
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptSetDigestCandidateInternalV1,
);
CapturedObjectFreezeV1(
  createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerCandidateInternalV1,
);
CapturedObjectFreezeV1(
  classifyProviderStrongReadyBootstrapOrSteadyAcceptanceAdmissionScalarsInternalV1,
);
