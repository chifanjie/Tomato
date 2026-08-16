/**
 * Package-private in-memory terminal journal reference machine.
 *
 * The machine records metadata only. It does not prove Provider byte I/O or
 * durable deletion, and it never publishes a strong-writer Acceptance.
 */

import { createDomainPreimageBytesV1 } from "./domain-crypto.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  LowerHex32V1Schema,
  type ContentDigestV1,
  type InstallationIdentityGenerationIdV1,
  type ProviderMigrationIdV1,
} from "./primitives.js";
import type { ProviderFeasibilitySupportCatalogPinV1 } from "./provider-feasibility-support-catalog-point.js";
import {
  inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-compound-publication-reference-machine-internal.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReceiptInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-execution-progress-reference-machine-internal.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-formal-plan-reference-candidate-wire.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-migration-only-acceptance-compare-append-reference-machine-internal.js";
import {
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionTerminalJournalContinuationInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceValidationInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-steady-registry-completion-reference-capability-internal.js";
import type {
  ProviderRegistryManifestEnvelopeV1,
  ProviderRegistryManifestPinV1,
} from "./provider-registry-records.js";
import type {
  ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
} from "./provider-strong-ready-bootstrap-or-steady-acceptance-identity-verification-capability-internal.js";
import { sha256InternalV1 } from "./sha256.js";

const CapturedArrayIsArrayV1 = Array.isArray;
const CapturedNumberIsSafeIntegerV1 = Number.isSafeInteger;
const CapturedObjectCreateV1 = Object.create;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedObjectPrototypeV1 = Object.prototype;
const CapturedReflectOwnKeysV1 = Reflect.ownKeys;
const CapturedTypeErrorV1 = TypeError;
const CapturedWeakMapV1 = WeakMap;
const CapturedWeakSetV1 = WeakSet;

const DURABILITY_V1 =
  "in_memory_terminal_journal_reference_only_not_a_durable_provider_v1" as const;
const REQUEST_DOMAIN_V1 =
  "provider-migration-same-installation-identity-terminal-journal-seal-request-v1";
const SOURCE_TOMBSTONE_DOMAIN_V1 =
  "provider-migration-same-installation-identity-terminal-source-tombstone-record-v1";
const READY_DOMAIN_V1 =
  "provider-migration-same-installation-identity-terminal-ready-to-activate-record-v1";
const SEALED_HEAD_DOMAIN_V1 =
  "provider-migration-same-installation-identity-terminal-sealed-progress-head-v1";
const RECEIPT_DOMAIN_V1 =
  "provider-migration-same-installation-identity-terminal-journal-receipt-v1";
const SEALED_CLOSURE_DOMAIN_V1 =
  "provider-migration-same-installation-identity-terminal-journal-sealed-closure-v1";

declare const terminalJournalCapabilityBrandInternalV1: unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealReferenceMachineCapabilityInternalV1 {
  readonly [terminalJournalCapabilityBrandInternalV1]: true;
}

export interface MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealReferenceMachineInputInternalV1 {
  readonly steadyRegistryCompletion:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceValidationInternalV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealRequestInternalV1 {
  readonly operationNonce: string;
  readonly expectedJournalRevision: number;
  readonly expectedSteadyRegistryManifestPin: ProviderRegistryManifestPinV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceTombstoneRecordInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_source_tombstone_record_v1";
  readonly journalOrdinal: 1;
  readonly installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  readonly formalMigrationId: ProviderMigrationIdV1;
  readonly sourceProviderId: string;
  readonly steadyRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly lastEnabledRegistryEntryContentDigest: ContentDigestV1;
  readonly revokedAtManifestGeneration: number;
  readonly reason: "migration_completed";
  readonly zeroLiveProofContentDigest: ContentDigestV1;
  readonly terminalProgressReceiptContentDigest: ContentDigestV1;
  readonly relationship: "steady_registry_revoked_source_member_bound_to_exact_zero_live_terminal_progress_v1";
  readonly contentDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalReadyToActivateRecordInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_ready_to_activate_record_v1";
  readonly journalOrdinal: 2;
  readonly state: "ready_to_activate";
  readonly installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  readonly formalMigrationId: ProviderMigrationIdV1;
  readonly destinationProviderId: string;
  readonly steadyRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly currentSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1;
  readonly formalPlanPin: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1;
  readonly sourceTombstoneRecordContentDigest: ContentDigestV1;
  readonly terminalProgressReceiptContentDigest: ContentDigestV1;
  readonly relationship: "terminal_metadata_ready_for_final_strong_activation_not_activated_v1";
  readonly contentDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSealedProgressHeadInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_sealed_progress_head_v1";
  readonly journalOrdinal: 3;
  readonly state: "sealed";
  readonly journalRevision: 1;
  readonly steadyRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly formalPlanPin: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1;
  readonly terminalProgressReceiptContentDigest: ContentDigestV1;
  readonly destinationUniverseContentDigest: ContentDigestV1;
  readonly completeDestinationPublicationReceiptSetDigest: ContentDigestV1;
  readonly zeroLiveProofContentDigest: ContentDigestV1;
  readonly sourceTombstoneRecordContentDigest: ContentDigestV1;
  readonly readyToActivateRecordContentDigest: ContentDigestV1;
  readonly relationship: "terminal_metadata_progress_head_sealed_before_final_acceptance_v1";
  readonly contentDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealReceiptInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_terminal_journal_seal_receipt_v1";
  readonly durability: typeof DURABILITY_V1;
  readonly status: "committed";
  readonly operationNonce: string;
  readonly requestContentDigest: ContentDigestV1;
  readonly previousJournalRevision: 0;
  readonly committedJournalRevision: 1;
  readonly sourceTombstoneRecordContentDigest: ContentDigestV1;
  readonly readyToActivateRecordContentDigest: ContentDigestV1;
  readonly sealedProgressHeadContentDigest: ContentDigestV1;
  readonly contentDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealedValidationInternalV1 {
  readonly authority: "in_memory_metadata_reference_only_no_real_provider_bytes_or_io_proof_v1";
  readonly durability: typeof DURABILITY_V1;
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_terminal_journal_sealed_validation_v1";
  readonly relationship: "exact_steady_registry_source_tombstone_ready_to_activate_and_progress_head_atomically_sealed_v1";
  readonly steadyRegistryCompletion:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceValidationInternalV1;
  readonly sourceTombstoneRecord:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceTombstoneRecordInternalV1;
  readonly readyToActivateRecord:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalReadyToActivateRecordInternalV1;
  readonly sealedProgressHead:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSealedProgressHeadInternalV1;
  readonly terminalJournalReceipt:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealReceiptInternalV1;
  readonly terminalJournalReceiptContentDigest: ContentDigestV1;
  readonly currentRegistryManifestEnvelope: ProviderRegistryManifestEnvelopeV1;
  readonly currentRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly currentSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1;
  readonly formalPlanPin: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1;
  readonly terminalProgressReceipt:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReceiptInternalV1;
  readonly installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  readonly formalMigrationId: ProviderMigrationIdV1;
  readonly sourceProviderId: string;
  readonly destinationProviderId: string;
  readonly journalRevision: 1;
  readonly strongWriterPublicationCount: 0;
  readonly acceptancePublicationCount: 0;
  readonly closureContentDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalStateInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_terminal_journal_state_v1";
  readonly durability: typeof DURABILITY_V1;
  readonly state: "open" | "sealed";
  readonly journalRevision: 0 | 1;
  readonly steadyRegistryCompletion:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceValidationInternalV1;
  readonly sealedSuccess:
    | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealedValidationInternalV1
    | "none";
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealResultInternalV1 =
  | Readonly<{
      readonly status: "committed";
      readonly replay: boolean;
      readonly value:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealedValidationInternalV1;
      readonly currentState:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalStateInternalV1;
    }>
  | Readonly<{
      readonly status: "not_committed";
      readonly reason: "stale_expected_journal";
      readonly observedJournalRevision: 0 | 1;
      readonly observedSteadyRegistryManifestPin: ProviderRegistryManifestPinV1;
    }>
  | Readonly<{
      readonly status: "rejected";
      readonly reason:
        | "capability_invalid"
        | "schema_invalid"
        | "operation_nonce_conflict"
        | "already_sealed"
        | "terminal_basis_invalid";
    }>;

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSealedTerminalJournalFinalAcceptanceContinuationInternalV1 {
  readonly sealedTerminalJournal:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealedValidationInternalV1;
  readonly steadyRegistryCompletion:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceValidationInternalV1;
  readonly compoundPublicationReferenceMachineCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1;
  readonly migrationOnlyAcceptanceReferenceMachineCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1;
  readonly acceptanceIdentityVerificationCapability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
}

interface BindingInternalV1 {
  state: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalStateInternalV1;
  readonly compoundPublicationReferenceMachineCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1;
  readonly migrationOnlyAcceptanceReferenceMachineCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1;
  readonly acceptanceIdentityVerificationCapability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
  operationNonce?: string;
  requestCanonicalBytes?: Uint8Array;
}

const bindingsInternalV1 = new CapturedWeakMapV1<object, BindingInternalV1>();
const finalAcceptanceContinuationsInternalV1 = new CapturedWeakMapV1<
  object,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSealedTerminalJournalFinalAcceptanceContinuationInternalV1
>();

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

function bytesEqualV1(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  return bytesEqualV1(
    canonicalizeJcsSafeIntegerUtf8V1(left),
    canonicalizeJcsSafeIntegerUtf8V1(right),
  );
}

function deepFreezeV1<T>(value: T): T {
  const seen = new CapturedWeakSetV1<object>();
  function visitV1(current: unknown): void {
    if (current === null || typeof current !== "object" || seen.has(current)) {
      return;
    }
    seen.add(current);
    const keys = CapturedReflectOwnKeysV1(current);
    for (let index = 0; index < keys.length; index += 1) {
      const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(
        current,
        keys[index]!,
      );
      if (descriptor !== undefined && "value" in descriptor) {
        visitV1(descriptor.value);
      }
    }
    CapturedObjectFreezeV1(current);
  }
  visitV1(value);
  return value;
}

function hasExactKeysV1(value: unknown, expected: readonly string[]): boolean {
  if (
    value === null ||
    typeof value !== "object" ||
    CapturedArrayIsArrayV1(value) ||
    (CapturedObjectGetPrototypeOfV1(value) !== CapturedObjectPrototypeV1 &&
      CapturedObjectGetPrototypeOfV1(value) !== null) ||
    CapturedReflectOwnKeysV1(value).length !== expected.length
  ) return false;
  for (let index = 0; index < expected.length; index += 1) {
    const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(
      value,
      expected[index]!,
    );
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) return false;
  }
  return true;
}

function getBindingV1(capability: unknown): BindingInternalV1 | undefined {
  if (capability === null || typeof capability !== "object") return undefined;
  return bindingsInternalV1.get(capability);
}

export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealReferenceMachineInternalV1(
  input: MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealReferenceMachineInputInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealReferenceMachineCapabilityInternalV1 {
  if (!hasExactKeysV1(input, ["steadyRegistryCompletion"])) {
    throw new CapturedTypeErrorV1("terminal journal mint input invalid");
  }
  const continuation =
    takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionTerminalJournalContinuationInternalV1(
      input.steadyRegistryCompletion,
    );
  if (
    continuation === undefined ||
    continuation.steadyRegistryCompletion !== input.steadyRegistryCompletion
  ) throw new CapturedTypeErrorV1("steady completion continuation invalid");
  const state =
    inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
      continuation.compoundPublicationReferenceMachineCapability,
    );
  const steady = input.steadyRegistryCompletion;
  if (
    state.migrationPublicationState.state !== "committed" ||
    state.currentRegistryManifestEnvelope !==
      steady.currentRegistryManifestEnvelope ||
    !canonicalEqualV1(
      state.currentRegistryManifestPin,
      steady.currentRegistryManifestPin,
    ) ||
    state.currentRegistryManifestEnvelope.payload.routing.state !== "steady" ||
    steady.terminalProgressReceipt.progressRecord.phase !== "completed" ||
    steady.terminalProgressReceipt.progressRecord.transition !==
      "complete_execution"
  ) throw new CapturedTypeErrorV1("steady completion terminal basis invalid");
  const capability = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealReferenceMachineCapabilityInternalV1;
  bindingsInternalV1.set(capability, {
    state: deepFreezeV1({
      profile:
        "provider_migration_same_installation_identity_current_strong_source_normal_terminal_journal_state_v1" as const,
      durability: DURABILITY_V1,
      state: "open" as const,
      journalRevision: 0 as const,
      steadyRegistryCompletion: steady,
      sealedSuccess: "none" as const,
    }),
    compoundPublicationReferenceMachineCapability:
      continuation.compoundPublicationReferenceMachineCapability,
    migrationOnlyAcceptanceReferenceMachineCapability:
      continuation.migrationOnlyAcceptanceReferenceMachineCapability,
    acceptanceIdentityVerificationCapability:
      continuation.acceptanceIdentityVerificationCapability,
  });
  return capability;
}

function buildSealedSuccessV1(
  steady: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistryCompletionReferenceValidationInternalV1,
  request: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealRequestInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealedValidationInternalV1 | undefined {
  const zeroLive =
    steady.sourceDrainedRegistrySuccessorClosure.zeroLiveClosure;
  const members = steady.currentRegistryManifestEnvelope.payload.members;
  let sourceRevokedMember:
    | Extract<(typeof members)[number], { readonly disposition: "revoked" }>
    | undefined;
  let enabledDestinationCount = 0;
  for (let index = 0; index < members.length; index += 1) {
    const member = members[index]!;
    if (
      member.providerId === steady.sourceProviderId &&
      member.disposition === "revoked"
    ) sourceRevokedMember = member;
    if (
      member.providerId === steady.destinationProviderId &&
      member.disposition === "enabled"
    ) enabledDestinationCount += 1;
  }
  if (
    sourceRevokedMember === undefined ||
    sourceRevokedMember.reason !== "migration_completed" ||
    sourceRevokedMember.revokedAtManifestGeneration !==
      steady.currentRegistryManifestEnvelope.payload.manifestGeneration ||
    enabledDestinationCount !== 1 ||
    zeroLive.remainingSourceLiveOrdinals.length !== 0 ||
    zeroLive.zeroLiveReferenceProof.remainingSourceLiveObjectCount !== 0 ||
    zeroLive.zeroLiveReferenceProof.remainingSourceLiveReferenceCount !== 0
  ) return undefined;
  const terminalProgressReceiptContentDigest =
    steady.terminalProgressReceipt.receiptContentDigest;
  const sourceTombstoneUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_source_tombstone_record_v1" as const,
    journalOrdinal: 1 as const,
    installationIdentityGenerationId:
      steady.installationIdentityGenerationId,
    formalMigrationId: steady.formalMigrationId,
    sourceProviderId: steady.sourceProviderId,
    steadyRegistryManifestPin: steady.currentRegistryManifestPin,
    lastEnabledRegistryEntryContentDigest:
      sourceRevokedMember.lastEnabledRegistryEntryContentDigest,
    revokedAtManifestGeneration:
      sourceRevokedMember.revokedAtManifestGeneration,
    reason: "migration_completed" as const,
    zeroLiveProofContentDigest:
      zeroLive.zeroLiveReferenceProof.proofContentDigest,
    terminalProgressReceiptContentDigest,
    relationship:
      "steady_registry_revoked_source_member_bound_to_exact_zero_live_terminal_progress_v1" as const,
  };
  const sourceTombstoneRecord = deepFreezeV1({
    ...sourceTombstoneUnsigned,
    contentDigest: digestV1(
      SOURCE_TOMBSTONE_DOMAIN_V1,
      sourceTombstoneUnsigned,
    ),
  });
  const readyUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_ready_to_activate_record_v1" as const,
    journalOrdinal: 2 as const,
    state: "ready_to_activate" as const,
    installationIdentityGenerationId:
      steady.installationIdentityGenerationId,
    formalMigrationId: steady.formalMigrationId,
    destinationProviderId: steady.destinationProviderId,
    steadyRegistryManifestPin: steady.currentRegistryManifestPin,
    currentSupportCatalogPin: steady.currentSupportCatalogPin,
    formalPlanPin: steady.formalPlanPin,
    sourceTombstoneRecordContentDigest: sourceTombstoneRecord.contentDigest,
    terminalProgressReceiptContentDigest,
    relationship:
      "terminal_metadata_ready_for_final_strong_activation_not_activated_v1" as const,
  };
  const readyToActivateRecord = deepFreezeV1({
    ...readyUnsigned,
    contentDigest: digestV1(READY_DOMAIN_V1, readyUnsigned),
  });
  const sealedHeadUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_sealed_progress_head_v1" as const,
    journalOrdinal: 3 as const,
    state: "sealed" as const,
    journalRevision: 1 as const,
    steadyRegistryManifestPin: steady.currentRegistryManifestPin,
    formalPlanPin: steady.formalPlanPin,
    terminalProgressReceiptContentDigest,
    destinationUniverseContentDigest:
      zeroLive.destinationUniverseMetadata.universeContentDigest,
    completeDestinationPublicationReceiptSetDigest:
      zeroLive.completeDestinationPublicationReceiptSet.receiptSetDigest,
    zeroLiveProofContentDigest:
      zeroLive.zeroLiveReferenceProof.proofContentDigest,
    sourceTombstoneRecordContentDigest: sourceTombstoneRecord.contentDigest,
    readyToActivateRecordContentDigest: readyToActivateRecord.contentDigest,
    relationship:
      "terminal_metadata_progress_head_sealed_before_final_acceptance_v1" as const,
  };
  const sealedProgressHead = deepFreezeV1({
    ...sealedHeadUnsigned,
    contentDigest: digestV1(SEALED_HEAD_DOMAIN_V1, sealedHeadUnsigned),
  });
  const requestContentDigest = digestV1(REQUEST_DOMAIN_V1, request);
  const receiptUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_terminal_journal_seal_receipt_v1" as const,
    durability: DURABILITY_V1,
    status: "committed" as const,
    operationNonce: request.operationNonce,
    requestContentDigest,
    previousJournalRevision: 0 as const,
    committedJournalRevision: 1 as const,
    sourceTombstoneRecordContentDigest: sourceTombstoneRecord.contentDigest,
    readyToActivateRecordContentDigest: readyToActivateRecord.contentDigest,
    sealedProgressHeadContentDigest: sealedProgressHead.contentDigest,
  };
  const terminalJournalReceipt = deepFreezeV1({
    ...receiptUnsigned,
    contentDigest: digestV1(RECEIPT_DOMAIN_V1, receiptUnsigned),
  });
  const closureUnsigned = {
    authority:
      "in_memory_metadata_reference_only_no_real_provider_bytes_or_io_proof_v1" as const,
    durability: DURABILITY_V1,
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_terminal_journal_sealed_validation_v1" as const,
    relationship:
      "exact_steady_registry_source_tombstone_ready_to_activate_and_progress_head_atomically_sealed_v1" as const,
    steadyRegistryCompletion: steady,
    sourceTombstoneRecord,
    readyToActivateRecord,
    sealedProgressHead,
    terminalJournalReceipt,
    terminalJournalReceiptContentDigest: terminalJournalReceipt.contentDigest,
    currentRegistryManifestEnvelope: steady.currentRegistryManifestEnvelope,
    currentRegistryManifestPin: steady.currentRegistryManifestPin,
    currentSupportCatalogPin: steady.currentSupportCatalogPin,
    formalPlanPin: steady.formalPlanPin,
    terminalProgressReceipt: steady.terminalProgressReceipt,
    installationIdentityGenerationId:
      steady.installationIdentityGenerationId,
    formalMigrationId: steady.formalMigrationId,
    sourceProviderId: steady.sourceProviderId,
    destinationProviderId: steady.destinationProviderId,
    journalRevision: 1 as const,
    strongWriterPublicationCount: 0 as const,
    acceptancePublicationCount: 0 as const,
  };
  return deepFreezeV1({
    ...closureUnsigned,
    closureContentDigest: digestV1(
      SEALED_CLOSURE_DOMAIN_V1,
      closureUnsigned,
    ),
  });
}

export function compareSealProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalReferenceMachineInternalV1(
  capability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealReferenceMachineCapabilityInternalV1,
  request: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealRequestInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealResultInternalV1 {
  const binding = getBindingV1(capability);
  if (binding === undefined) {
    return CapturedObjectFreezeV1({
      status: "rejected",
      reason: "capability_invalid",
    });
  }
  if (
    !hasExactKeysV1(request, [
      "operationNonce",
      "expectedJournalRevision",
      "expectedSteadyRegistryManifestPin",
    ]) ||
    !LowerHex32V1Schema.safeParse(request.operationNonce).success ||
    !CapturedNumberIsSafeIntegerV1(request.expectedJournalRevision) ||
    request.expectedJournalRevision < 0
  ) return CapturedObjectFreezeV1({
    status: "rejected",
    reason: "schema_invalid",
  });
  let requestCanonicalBytes: Uint8Array;
  try {
    requestCanonicalBytes = canonicalizeJcsSafeIntegerUtf8V1(request);
  } catch {
    return CapturedObjectFreezeV1({
      status: "rejected",
      reason: "schema_invalid",
    });
  }
  if (binding.operationNonce === request.operationNonce) {
    if (
      binding.requestCanonicalBytes === undefined ||
      !bytesEqualV1(binding.requestCanonicalBytes, requestCanonicalBytes)
    ) return CapturedObjectFreezeV1({
      status: "rejected",
      reason: "operation_nonce_conflict",
    });
    if (binding.state.sealedSuccess === "none") {
      return CapturedObjectFreezeV1({
        status: "rejected",
        reason: "terminal_basis_invalid",
      });
    }
    return CapturedObjectFreezeV1({
      status: "committed",
      replay: true,
      value: binding.state.sealedSuccess,
      currentState: binding.state,
    });
  }
  const steady = binding.state.steadyRegistryCompletion;
  if (
    request.expectedJournalRevision !== binding.state.journalRevision ||
    !canonicalEqualV1(
      request.expectedSteadyRegistryManifestPin,
      steady.currentRegistryManifestPin,
    )
  ) return CapturedObjectFreezeV1({
    status: "not_committed",
    reason: "stale_expected_journal",
    observedJournalRevision: binding.state.journalRevision,
    observedSteadyRegistryManifestPin: steady.currentRegistryManifestPin,
  });
  if (binding.state.state === "sealed") {
    return CapturedObjectFreezeV1({
      status: "rejected",
      reason: "already_sealed",
    });
  }
  const sealedSuccess = buildSealedSuccessV1(steady, request);
  if (sealedSuccess === undefined) {
    return CapturedObjectFreezeV1({
      status: "rejected",
      reason: "terminal_basis_invalid",
    });
  }
  const prospective = deepFreezeV1({
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_terminal_journal_state_v1" as const,
    durability: DURABILITY_V1,
    state: "sealed" as const,
    journalRevision: 1 as const,
    steadyRegistryCompletion: steady,
    sealedSuccess,
  });
  binding.state = prospective;
  binding.operationNonce = request.operationNonce;
  binding.requestCanonicalBytes = requestCanonicalBytes;
  finalAcceptanceContinuationsInternalV1.set(
    sealedSuccess,
    CapturedObjectFreezeV1({
      sealedTerminalJournal: sealedSuccess,
      steadyRegistryCompletion: steady,
      compoundPublicationReferenceMachineCapability:
        binding.compoundPublicationReferenceMachineCapability,
      migrationOnlyAcceptanceReferenceMachineCapability:
        binding.migrationOnlyAcceptanceReferenceMachineCapability,
      acceptanceIdentityVerificationCapability:
        binding.acceptanceIdentityVerificationCapability,
    }),
  );
  return CapturedObjectFreezeV1({
    status: "committed",
    replay: false,
    value: sealedSuccess,
    currentState: prospective,
  });
}

export function inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalReferenceMachineInternalV1(
  capability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealReferenceMachineCapabilityInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalStateInternalV1 {
  const binding = getBindingV1(capability);
  if (binding === undefined) {
    throw new CapturedTypeErrorV1("terminal journal capability invalid");
  }
  return binding.state;
}

export function takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSealedTerminalJournalFinalAcceptanceContinuationInternalV1(
  exactSealedSuccess:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealedValidationInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSealedTerminalJournalFinalAcceptanceContinuationInternalV1 | undefined {
  if (exactSealedSuccess === null || typeof exactSealedSuccess !== "object") {
    return undefined;
  }
  const continuation = finalAcceptanceContinuationsInternalV1.get(
    exactSealedSuccess,
  );
  if (
    continuation === undefined ||
    !finalAcceptanceContinuationsInternalV1.delete(exactSealedSuccess)
  ) return undefined;
  return continuation;
}

for (const exportedFunctionV1 of [
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalSealReferenceMachineInternalV1,
  compareSealProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalReferenceMachineInternalV1,
  inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTerminalJournalReferenceMachineInternalV1,
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSealedTerminalJournalFinalAcceptanceContinuationInternalV1,
]) CapturedObjectFreezeV1(exportedFunctionV1);
