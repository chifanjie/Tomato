/**
 * Process-local compare-append machine for the single terminal destination
 * strong-ready Acceptance. It can only be minted from the irreversible
 * migration-only writer handoff and commits at most one new generation.
 */

import { createDomainPreimageBytesV1 } from "./domain-crypto.js";
import { canonicalizeJcsSafeIntegerV1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  LowerHex32V1Schema,
  type ContentDigestV1,
} from "./primitives.js";
import {
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceSteadyHandoffSnapshotInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceStateInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceSteadyHandoffCapabilityInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-migration-only-acceptance-compare-append-reference-machine-internal.js";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1Schema,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-migration-only-acceptance-reference-candidate-internal.js";
import {
  deepFreezeProviderPointDetachedDataTreeV1,
} from "./provider-point-raw-admission-internal.js";
import {
  ProviderActiveWriterSelectorV1Schema,
  ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema,
  ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
  type ProviderStrongReadyAcceptanceGenerationPinCandidateV1,
  type ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
} from "./provider-strong-ready-acceptance-candidate.js";
import {
  getProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInstallationIdentityGenerationIdInternalV1,
  verifyProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
} from "./provider-strong-ready-bootstrap-or-steady-acceptance-identity-verification-capability-internal.js";
import { ProviderRegistryIsoTimestampV1Schema } from "./provider-registry-trust.js";
import { sha256InternalV1 } from "./sha256.js";

const CapturedObjectCreateV1 = Object.create;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedJsonParseV1 = JSON.parse;
const CapturedPromiseResolveV1 = Promise.resolve.bind(Promise);
const CapturedTypeErrorV1 = TypeError;
const CapturedWeakMapV1 = WeakMap;

const DURABILITY_V1 =
  "in_memory_reference_only_not_a_durable_provider_v1" as const;
const REQUEST_DOMAIN_V1 =
  "provider-migration-terminal-strong-ready-acceptance-compare-append-request-v1";
const RECEIPT_DOMAIN_V1 =
  "provider-migration-terminal-strong-ready-acceptance-compare-append-receipt-v1";
const GENERATION_SET_DOMAIN_V1 =
  "provider-migration-terminal-strong-ready-acceptance-generation-set-v1";
const VERSION_DOMAIN_V1 =
  "provider-migration-terminal-strong-ready-acceptance-current-version-v1";

function bytesToLowerHexV1(bytes: Uint8Array): string {
  const alphabet = "0123456789abcdef";
  let output = "";
  for (let index = 0; index < bytes.byteLength; index += 1) {
    const byte = bytes[index]!;
    output += alphabet[(byte >>> 4) & 15]! + alphabet[byte & 15]!;
  }
  return output;
}

function digestV1(domain: string, fields: object): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHexV1(
      sha256InternalV1(createDomainPreimageBytesV1(domain, fields)),
    )}`,
  );
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  return canonicalizeJcsSafeIntegerV1(left) ===
    canonicalizeJcsSafeIntegerV1(right);
}

function freezeDetachedV1<T>(value: T): T {
  return deepFreezeProviderPointDetachedDataTreeV1(
    CapturedJsonParseV1(canonicalizeJcsSafeIntegerV1(value)) as T,
  );
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceExpectedInternalV1 {
  readonly highWaterRevision: number;
  readonly currentAcceptance: AcceptancePinInternalV1;
  readonly currentVersionToken: string;
  readonly generationCount: number;
  readonly generationSetDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendRequestInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_final_strong_ready_acceptance_compare_append_request_v1";
  readonly operationNonce: ReturnType<typeof LowerHex32V1Schema.parse>;
  readonly installationIdentityGenerationId: string;
  readonly expected:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceExpectedInternalV1;
  readonly candidate:
    ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendReceiptInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_final_strong_ready_acceptance_compare_append_receipt_v1";
  readonly durability: typeof DURABILITY_V1;
  readonly operationNonce: string;
  readonly requestContentDigest: ContentDigestV1;
  readonly resolvedAt: string;
  readonly outcome:
    | Readonly<{
        readonly state: "committed";
        readonly appendedAcceptance:
          ProviderStrongReadyAcceptanceGenerationPinCandidateV1;
        readonly highWaterRevision: number;
      }>
    | Readonly<{
        readonly state: "not_committed";
        readonly reason: "expected_current_changed";
        readonly observedCurrentAcceptance: AcceptancePinInternalV1;
        readonly observedHighWaterRevision: number;
      }>;
  readonly receiptContentDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceStateInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_final_strong_ready_acceptance_compare_append_state_v1";
  readonly durability: typeof DURABILITY_V1;
  readonly installationIdentityGenerationId: string;
  readonly highWaterRevision: number;
  readonly generationCount: number;
  readonly generationSetDigest: ContentDigestV1;
  readonly currentVersionToken: string;
  readonly currentAcceptance: AcceptancePinInternalV1;
  readonly retiredMigrationOnlyState:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceStateInternalV1;
  readonly finalStrongReadyAcceptance:
    | "none"
    | ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1;
  readonly receipts:
    readonly ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendReceiptInternalV1[];
  readonly acceptancePublicationCount: 0 | 1;
}

declare const finalStrongReadyAcceptanceMachineBrandInternalV1: unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1 {
  readonly [finalStrongReadyAcceptanceMachineBrandInternalV1]: true;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendResultInternalV1 =
  | Readonly<{
      readonly status: "committed";
      readonly replay: boolean;
      readonly receipt:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendReceiptInternalV1;
      readonly state:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceStateInternalV1;
    }>
  | Readonly<{
      readonly status: "not_committed";
      readonly replay: boolean;
      readonly reason: "expected_current_changed";
      readonly receipt:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendReceiptInternalV1;
      readonly state:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceStateInternalV1;
    }>
  | Readonly<{
      readonly status: "rejected";
      readonly reason:
        | "capability_invalid"
        | "schema_invalid"
        | "identity_mismatch"
        | "operation_nonce_conflict"
        | "candidate_invalid";
    }>;

interface NonceEntryInternalV1 {
  readonly operationNonce: string;
  readonly requestCanonical: string;
  readonly result:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendResultInternalV1;
}

interface BindingInternalV1 {
  readonly identityVerificationCapability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
  state:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceStateInternalV1;
  readonly nonceEntries: NonceEntryInternalV1[];
  tail: Promise<void>;
  lifecycle: "active" | "committed";
}

const bindingsInternalV1 = new CapturedWeakMapV1<object, BindingInternalV1>();

type AcceptancePinInternalV1 =
  | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1
  | ProviderStrongReadyAcceptanceGenerationPinCandidateV1;

function pinV1(
  envelope: ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
): ProviderStrongReadyAcceptanceGenerationPinCandidateV1 {
  return freezeDetachedV1(
    ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema.parse({
      locatorProfile: "installation_provider_acceptance_state_v1",
      acceptanceOrdinal: envelope.payload.acceptanceOrdinal,
      generationId: envelope.generationId,
      contentDigest: envelope.contentDigest,
    }),
  );
}

export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendReferenceMachineInternalV1(
  input: Readonly<{
    identityVerificationCapability:
      ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
    migrationOnlyAcceptanceSteadyHandoffCapability:
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceSteadyHandoffCapabilityInternalV1;
  }>,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1 {
  const snapshot =
    takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceSteadyHandoffSnapshotInternalV1(
      input.migrationOnlyAcceptanceSteadyHandoffCapability,
      input.identityVerificationCapability,
    );
  const identity =
    getProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInstallationIdentityGenerationIdInternalV1(
      input.identityVerificationCapability,
    );
  if (
    snapshot === undefined ||
    snapshot.installationIdentityGenerationId !== identity
  ) throw new CapturedTypeErrorV1(
    "final strong-ready Acceptance handoff invalid",
  );
  const currentAcceptance = freezeDetachedV1(
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1Schema.parse(
      snapshot.retiredState.currentAcceptance,
    ),
  );
  const state = freezeDetachedV1({
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_final_strong_ready_acceptance_compare_append_state_v1" as const,
    durability: DURABILITY_V1,
    installationIdentityGenerationId: identity,
    highWaterRevision: snapshot.retiredState.highWaterRevision,
    generationCount: snapshot.retiredState.generationCount,
    generationSetDigest: snapshot.retiredState.generationSetDigest,
    currentVersionToken: snapshot.retiredState.currentVersionToken,
    currentAcceptance,
    retiredMigrationOnlyState: snapshot.retiredState,
    finalStrongReadyAcceptance: "none" as const,
    receipts: [],
    acceptancePublicationCount: 0 as const,
  });
  const capability = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1;
  bindingsInternalV1.set(capability, {
    identityVerificationCapability: input.identityVerificationCapability,
    state,
    nonceEntries: [],
    tail: CapturedPromiseResolveV1(undefined),
    lifecycle: "active",
  });
  return capability;
}

function rejectedV1(
  reason: Extract<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendResultInternalV1,
    { readonly status: "rejected" }
  >["reason"],
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendResultInternalV1 {
  return CapturedObjectFreezeV1({ status: "rejected" as const, reason });
}

function requestIsValidV1(
  input:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendRequestInternalV1,
): boolean {
  return input !== null && typeof input === "object" &&
    input.profile ===
      "provider_migration_same_installation_identity_current_strong_source_normal_final_strong_ready_acceptance_compare_append_request_v1" &&
    LowerHex32V1Schema.safeParse(input.operationNonce).success &&
    (ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1Schema.safeParse(
      input.expected.currentAcceptance,
    ).success ||
      ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema.safeParse(
        input.expected.currentAcceptance,
      ).success) &&
    ContentDigestV1Schema.safeParse(input.expected.generationSetDigest).success &&
    Number.isSafeInteger(input.expected.highWaterRevision) &&
    Number.isSafeInteger(input.expected.generationCount) &&
    ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema.safeParse(
      input.candidate,
    ).success;
}

function expectedMatchesV1(
  state:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceStateInternalV1,
  expected:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceExpectedInternalV1,
): boolean {
  return expected.highWaterRevision === state.highWaterRevision &&
    expected.generationCount === state.generationCount &&
    expected.generationSetDigest === state.generationSetDigest &&
    expected.currentVersionToken === state.currentVersionToken &&
    canonicalEqualV1(expected.currentAcceptance, state.currentAcceptance);
}

async function candidateIsValidV1(
  binding: BindingInternalV1,
  candidate: ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
): Promise<boolean> {
  const state = binding.state;
  const payload = candidate.payload;
  const activation = payload.configuration.activation;
  if (
    candidate.installationIdentityGenerationId !==
      state.installationIdentityGenerationId ||
    payload.installationIdentityGenerationId !==
      state.installationIdentityGenerationId ||
    payload.acceptanceOrdinal !== state.currentAcceptance.acceptanceOrdinal + 1 ||
    payload.predecessor.state !== "acceptance" ||
    payload.predecessor.generationId !== state.currentAcceptance.generationId ||
    payload.predecessor.contentDigest !== state.currentAcceptance.contentDigest ||
    payload.configuration.state !== "strong_ready" ||
    activation.origin !== "provider_migration_terminal_sealed_success_v1" ||
    activation.formalMigrationId !== activation.formalPlanPin.formalMigrationId ||
    payload.configuration.core.activeWriterSelector.selections.length !== 1 ||
    !ProviderActiveWriterSelectorV1Schema.safeParse(
      payload.configuration.core.activeWriterSelector,
    ).success ||
    candidate.generationId !== payload.generationId ||
    candidate.generationId !==
      deriveProviderStrongReadyAcceptanceStateGenerationIdV1({
        installationIdentityGenerationId:
          payload.installationIdentityGenerationId,
        acceptanceOrdinal: payload.acceptanceOrdinal,
        predecessor: payload.predecessor,
        configuration: payload.configuration,
      }) ||
    candidate.contentDigest !==
      deriveProviderStrongReadyAcceptanceStateContentDigestV1(payload)
  ) return false;
  try {
    return await verifyProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
      binding.identityVerificationCapability,
      state.installationIdentityGenerationId,
      payload,
      payload.acceptanceToken,
    );
  } catch {
    return false;
  }
}

function receiptV1(
  request:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendRequestInternalV1,
  resolvedAt: string,
  outcome:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendReceiptInternalV1["outcome"],
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendReceiptInternalV1 {
  const unsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_final_strong_ready_acceptance_compare_append_receipt_v1" as const,
    durability: DURABILITY_V1,
    operationNonce: request.operationNonce,
    requestContentDigest: digestV1(REQUEST_DOMAIN_V1, request),
    resolvedAt,
    outcome,
  };
  return freezeDetachedV1({
    ...unsigned,
    receiptContentDigest: digestV1(RECEIPT_DOMAIN_V1, unsigned),
  });
}

async function compareAppendLinearizedV1(
  binding: BindingInternalV1,
  request:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendRequestInternalV1,
  resolvedAtInput: string,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendResultInternalV1> {
  if (!requestIsValidV1(request)) return rejectedV1("schema_invalid");
  const resolvedAt = ProviderRegistryIsoTimestampV1Schema.safeParse(
    resolvedAtInput,
  );
  if (!resolvedAt.success) return rejectedV1("schema_invalid");
  if (
    request.installationIdentityGenerationId !==
      binding.state.installationIdentityGenerationId
  ) return rejectedV1("identity_mismatch");
  const requestCanonical = canonicalizeJcsSafeIntegerV1(request);
  for (let index = 0; index < binding.nonceEntries.length; index += 1) {
    const existing = binding.nonceEntries[index]!;
    if (existing.operationNonce !== request.operationNonce) continue;
    if (existing.requestCanonical !== requestCanonical) {
      return rejectedV1("operation_nonce_conflict");
    }
    if (existing.result.status === "rejected") return existing.result;
    return CapturedObjectFreezeV1({ ...existing.result, replay: true });
  }
  if (binding.lifecycle !== "active") {
    return rejectedV1("capability_invalid");
  }
  const before = binding.state;
  if (!expectedMatchesV1(before, request.expected)) {
    const receipt = receiptV1(request, resolvedAt.data, {
      state: "not_committed",
      reason: "expected_current_changed",
      observedCurrentAcceptance: before.currentAcceptance,
      observedHighWaterRevision: before.highWaterRevision,
    });
    const state = freezeDetachedV1({
      ...before,
      receipts: [...before.receipts, receipt],
    });
    binding.state = state;
    const result = CapturedObjectFreezeV1({
      status: "not_committed" as const,
      replay: false,
      reason: "expected_current_changed" as const,
      receipt,
      state,
    });
    binding.nonceEntries.push({
      operationNonce: request.operationNonce,
      requestCanonical,
      result,
    });
    return result;
  }
  if (!(await candidateIsValidV1(binding, request.candidate))) {
    return rejectedV1("candidate_invalid");
  }
  const pin = pinV1(request.candidate);
  const highWaterRevision = before.highWaterRevision + 1;
  const generationCount = before.generationCount + 1;
  const generationSetDigest = digestV1(GENERATION_SET_DOMAIN_V1, {
    predecessorGenerationSetDigest: before.generationSetDigest,
    generationCount,
    currentAcceptance: pin,
  });
  const currentVersionToken = digestV1(VERSION_DOMAIN_V1, {
    installationIdentityGenerationId:
      before.installationIdentityGenerationId,
    highWaterRevision,
    generationCount,
    generationSetDigest,
    currentAcceptance: pin,
  });
  const receipt = receiptV1(request, resolvedAt.data, {
    state: "committed",
    appendedAcceptance: pin,
    highWaterRevision,
  });
  const state = freezeDetachedV1({
    ...before,
    highWaterRevision,
    generationCount,
    generationSetDigest,
    currentVersionToken,
    currentAcceptance: pin,
    finalStrongReadyAcceptance: request.candidate,
    receipts: [...before.receipts, receipt],
    acceptancePublicationCount: 1 as const,
  });
  binding.state = state;
  binding.lifecycle = "committed";
  const result = CapturedObjectFreezeV1({
    status: "committed" as const,
    replay: false,
    receipt,
    state,
  });
  binding.nonceEntries.push({
    operationNonce: request.operationNonce,
    requestCanonical,
    result,
  });
  return result;
}

export function compareAppendProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceMachineInternalV1(
  capability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1,
  input: Readonly<{
    request:
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendRequestInternalV1;
    resolvedAt: string;
  }>,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendResultInternalV1> {
  if (capability === null || typeof capability !== "object") {
    return CapturedPromiseResolveV1(rejectedV1("capability_invalid"));
  }
  const binding = bindingsInternalV1.get(capability);
  if (binding === undefined) {
    return CapturedPromiseResolveV1(rejectedV1("capability_invalid"));
  }
  const operation = binding.tail.then(() =>
    compareAppendLinearizedV1(binding, input.request, input.resolvedAt)
  );
  binding.tail = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}

export function inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceMachineInternalV1(
  capability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceStateInternalV1 {
  if (capability === null || typeof capability !== "object") {
    throw new CapturedTypeErrorV1("final strong-ready Acceptance capability invalid");
  }
  const binding = bindingsInternalV1.get(capability);
  if (binding === undefined) {
    throw new CapturedTypeErrorV1("final strong-ready Acceptance capability invalid");
  }
  return binding.state;
}

for (const exportedFunctionV1 of [
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCompareAppendReferenceMachineInternalV1,
  compareAppendProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceMachineInternalV1,
  inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceReferenceMachineInternalV1,
]) CapturedObjectFreezeV1(exportedFunctionV1);
