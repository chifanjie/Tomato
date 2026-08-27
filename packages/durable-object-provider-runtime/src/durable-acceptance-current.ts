import { createHash } from "node:crypto";

import {
  ProviderRuntimeIpcJournalStateV1Schema,
  type ProviderRuntimeIpcJsonValueV1,
  type ProviderRuntimeIpcJournalStateV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";
import {
  ContentDigestV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  ProviderMigrationIdV1Schema,
  type ContentDigestV1,
  type InstallationIdentityGenerationIdV1,
} from "@understand-code/durable-object-provider-contracts/primitives";
import {
  ProviderAcceptanceGenerationPinV1Schema,
  ProviderAcceptanceStateEnvelopeV1Schema,
  deriveProviderAcceptanceStateContentDigestV1,
  deriveProviderAcceptanceStateGenerationIdV1,
  type ProviderAcceptanceGenerationPinV1,
  type ProviderAcceptanceStateEnvelopeV1,
} from "@understand-code/durable-object-provider-contracts/provider-acceptance";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1Schema,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1,
} from "@understand-code/durable-object-provider-contracts";
import {
  ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema,
  ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
  deriveProviderActiveWriterSelectorContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
  type ProviderStrongReadyAcceptanceGenerationPinCandidateV1,
  type ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
} from "@understand-code/durable-object-provider-contracts/provider-strong-ready-acceptance-candidate";
import {
  diagnoseProviderRuntimeLiveGateBindingV1,
  type ProviderRuntimeLiveGateActivationCandidateV1,
  type ProviderRuntimeLiveGateBindingGateValuesV1,
  type ProviderRuntimeLiveGateBindingOptionsV1,
} from "./live-gate-binding.js";
import {
  projectProviderRuntimeDurableLifecycleArtifactSetV1,
  type ProviderRuntimeDurableBusinessHeadV1,
} from "./durable-lifecycle-artifacts.js";
import { inspectProviderRuntimeAuthenticatedJournalStateV1 } from "./live-service-readiness.js";
import { assertProviderRuntimeTargetContinuityV1 } from "./target-inspection.js";

export const PROVIDER_RUNTIME_DURABLE_ACCEPTANCE_REQUIRED_NEXT_V1 =
  "acceptance_identity_token_and_os_peer_gate" as const;

const FINAL_CLOSURE_KEYS_V1 = Object.freeze([
  "authority",
  "durability",
  "profile",
  "relationship",
  "sealedTerminalJournal",
  "candidateValidation",
  "finalStrongReadyAcceptanceEnvelope",
  "finalStrongReadyAcceptancePin",
  "acceptanceCompareAppendReceipt",
  "acceptanceReferenceState",
  "destinationProviderId",
  "sourceWriterRetired",
  "migrationOnlyWriterRetired",
  "destinationOnlyPublicStrongWriter",
  "finalSteadyRegistryAndCatalogBound",
  "formalPlanAndTerminalSealBound",
  "acceptancePublicationCount",
  "publicStrongWriterPublicationCount",
]);

const FINAL_CANDIDATE_KEYS_V1 = Object.freeze([
  "authority",
  "durability",
  "profile",
  "relationship",
  "formalMigrationId",
  "formalPlanPin",
  "activeWriterSelector",
  "activeWriterSelectorContentDigest",
  "acceptanceStateEnvelope",
  "acceptanceGenerationPin",
  "destinationOnlyPublicStrongWriter",
  "acceptanceAppendCount",
]);

const FINAL_RECEIPT_KEYS_V1 = Object.freeze([
  "profile",
  "durability",
  "operationNonce",
  "requestContentDigest",
  "resolvedAt",
  "outcome",
  "receiptContentDigest",
]);

const FINAL_STATE_KEYS_V1 = Object.freeze([
  "profile",
  "durability",
  "installationIdentityGenerationId",
  "highWaterRevision",
  "generationCount",
  "generationSetDigest",
  "currentVersionToken",
  "currentAcceptance",
  "retiredMigrationOnlyState",
  "finalStrongReadyAcceptance",
  "receipts",
  "acceptancePublicationCount",
]);

const TERMINAL_JOURNAL_KEYS_V1 = Object.freeze([
  "authority",
  "durability",
  "profile",
  "relationship",
  "steadyRegistryCompletion",
  "sourceTombstoneRecord",
  "readyToActivateRecord",
  "sealedProgressHead",
  "terminalJournalReceipt",
  "terminalJournalReceiptContentDigest",
  "currentRegistryManifestEnvelope",
  "currentRegistryManifestPin",
  "currentSupportCatalogPin",
  "formalPlanPin",
  "terminalProgressReceipt",
  "installationIdentityGenerationId",
  "formalMigrationId",
  "sourceProviderId",
  "destinationProviderId",
  "journalRevision",
  "strongWriterPublicationCount",
  "acceptancePublicationCount",
  "closureContentDigest",
]);

const SOURCE_TOMBSTONE_KEYS_V1 = Object.freeze([
  "profile",
  "journalOrdinal",
  "installationIdentityGenerationId",
  "formalMigrationId",
  "sourceProviderId",
  "steadyRegistryManifestPin",
  "lastEnabledRegistryEntryContentDigest",
  "revokedAtManifestGeneration",
  "reason",
  "zeroLiveProofContentDigest",
  "terminalProgressReceiptContentDigest",
  "relationship",
  "contentDigest",
]);

const READY_TO_ACTIVATE_KEYS_V1 = Object.freeze([
  "profile",
  "journalOrdinal",
  "state",
  "installationIdentityGenerationId",
  "formalMigrationId",
  "destinationProviderId",
  "steadyRegistryManifestPin",
  "currentSupportCatalogPin",
  "formalPlanPin",
  "sourceTombstoneRecordContentDigest",
  "terminalProgressReceiptContentDigest",
  "relationship",
  "contentDigest",
]);

const SEALED_PROGRESS_HEAD_KEYS_V1 = Object.freeze([
  "profile",
  "journalOrdinal",
  "state",
  "journalRevision",
  "steadyRegistryManifestPin",
  "formalPlanPin",
  "terminalProgressReceiptContentDigest",
  "destinationUniverseContentDigest",
  "completeDestinationPublicationReceiptSetDigest",
  "zeroLiveProofContentDigest",
  "sourceTombstoneRecordContentDigest",
  "readyToActivateRecordContentDigest",
  "relationship",
  "contentDigest",
]);

const TERMINAL_JOURNAL_RECEIPT_KEYS_V1 = Object.freeze([
  "profile",
  "durability",
  "status",
  "operationNonce",
  "requestContentDigest",
  "previousJournalRevision",
  "committedJournalRevision",
  "sourceTombstoneRecordContentDigest",
  "readyToActivateRecordContentDigest",
  "sealedProgressHeadContentDigest",
  "contentDigest",
]);

const TERMINAL_PROGRESS_RECEIPT_KEYS_V1 = Object.freeze([
  "profile",
  "durability",
  "resolution",
  "operationNonce",
  "requestContentDigest",
  "linearizationOrdinal",
  "progressRecord",
  "destinationObjectPublication",
  "committedHighWater",
  "receiptContentDigest",
]);

const SOURCE_TOMBSTONE_DOMAIN_V1 =
  "provider-migration-same-installation-identity-terminal-source-tombstone-record-v1";
const READY_TO_ACTIVATE_DOMAIN_V1 =
  "provider-migration-same-installation-identity-terminal-ready-to-activate-record-v1";
const SEALED_PROGRESS_HEAD_DOMAIN_V1 =
  "provider-migration-same-installation-identity-terminal-sealed-progress-head-v1";
const TERMINAL_JOURNAL_RECEIPT_DOMAIN_V1 =
  "provider-migration-same-installation-identity-terminal-journal-receipt-v1";
const TERMINAL_JOURNAL_CLOSURE_DOMAIN_V1 =
  "provider-migration-same-installation-identity-terminal-journal-sealed-closure-v1";
const TERMINAL_PROGRESS_RECEIPT_DOMAIN_V1 =
  "provider-migration-same-installation-identity-execution-progress-receipt-v1";
export interface VerifyProviderRuntimeDurableAcceptanceCurrentOptionsV1 {
  /** Complete raw values required to recompute and freshly probe the live Gate. */
  readonly liveGateBinding: ProviderRuntimeLiveGateBindingOptionsV1;
}

export interface ProviderRuntimeDurableAcceptanceCurrentCandidateV1 {
  readonly status: "durable_acceptance_current_candidate";
  readonly authority: "none";
  readonly accessMode: "read_only";
  readonly strongWriteStatus: "locked";
  readonly acceptanceTokenStatus: "not_verified_external_identity_capability_required";
  readonly requiredNext: typeof PROVIDER_RUNTIME_DURABLE_ACCEPTANCE_REQUIRED_NEXT_V1;
  readonly bindings: Readonly<{
    readonly providerId: string;
    readonly targetProfileId: string;
    readonly installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
    readonly acceptanceOrdinal: number;
    readonly acceptanceGenerationId: string;
    readonly acceptanceContentDigest: ContentDigestV1;
    readonly registryManifestContentDigest: ContentDigestV1;
    readonly supportCatalogContentDigest: ContentDigestV1;
    readonly formalPlanContentDigest: ContentDigestV1;
    readonly journalRevision: number;
    readonly journalMutationDigest: ContentDigestV1;
    readonly liveInspectedRevision: number;
  }>;
}

export interface ProviderRuntimeDurableLifecycleProjectionV1 {
  readonly state: ProviderRuntimeIpcJournalStateV1;
  readonly lifecycleArtifacts: Readonly<
    Record<string, ProviderRuntimeIpcJsonValueV1>
  >;
  readonly businessHead?: ProviderRuntimeDurableBusinessHeadV1;
}

export type ProviderRuntimeDurableAcceptanceCurrentDiagnosticV1 =
  | Readonly<{
      readonly ok: true;
      readonly value: ProviderRuntimeDurableAcceptanceCurrentCandidateV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly code: "provider_unavailable";
      readonly reason: "attestation_invalid";
      readonly stage: "live_gate" | "journal_observation" | "acceptance_current";
    }>;

function isRecordV1(value: unknown): value is Record<string, unknown> {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function asRecordV1(value: unknown, label: string): Record<string, unknown> {
  if (!isRecordV1(value)) throw new TypeError(`${label} must be a record`);
  return value;
}

function exactKeysV1(
  value: Record<string, unknown>,
  expected: readonly string[],
): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) {
    throw new TypeError("record keys are not exact");
  }
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  try {
    return canonicalizeJcsSafeIntegerV1(left) ===
      canonicalizeJcsSafeIntegerV1(right);
  } catch {
    return false;
  }
}

function domainDigestV1(domain: string, value: unknown): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${createHash("sha256")
      .update(canonicalizeJcsSafeIntegerV1([domain, value]), "utf8")
      .digest("hex")}`,
  );
}

function validateDomainRecordV1(
  value: Record<string, unknown>,
  keys: readonly string[],
  domain: string,
  digestKey: "contentDigest" | "receiptContentDigest" |
    "closureContentDigest" = "contentDigest",
): void {
  exactKeysV1(value, keys);
  const digest = value[digestKey];
  const unsigned = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== digestKey),
  );
  if (
    ContentDigestV1Schema.parse(digest) !==
      domainDigestV1(domain, unsigned)
  ) {
    throw new TypeError("terminal Journal record digest is invalid");
  }
}

function validateStoredFormalPlanV1(
  envelopeInput: unknown,
  pinInput: unknown,
): Readonly<{
  envelope: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1;
  pin: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1;
}> {
  let envelope: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1;
  let pin: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1;
  try {
    envelope =
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1Schema.parse(
        envelopeInput,
      );
    pin =
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1Schema.parse(
        pinInput,
      );
  } catch (cause) {
    throw new TypeError("stored formal Plan Envelope or Pin is invalid", {
      cause,
    });
  }
  if (!canonicalEqualV1(
    pin,
    deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinV1(
      envelope,
    ),
  )) {
    throw new TypeError("stored formal Plan Envelope or Pin is invalid");
  }
  return Object.freeze({ envelope, pin });
}

function safePositiveIntegerV1(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new TypeError(`${label} must be a positive safe integer`);
  }
  return value as number;
}

function resolveGateValuesV1(
  input: ProviderRuntimeLiveGateBindingOptionsV1,
): ProviderRuntimeLiveGateBindingGateValuesV1 {
  const aliases = [input.gateValues, input.values, input.projectionInput].filter(
    (value): value is ProviderRuntimeLiveGateBindingGateValuesV1 =>
      value !== undefined,
  );
  if (aliases.length === 0) throw new TypeError("Gate values are required");
  const first = aliases[0]!;
  if (aliases.some((value) => !canonicalEqualV1(value, first))) {
    throw new TypeError("Gate values disagree");
  }
  return first;
}

function validateReferenceAcceptanceEnvelopeV1(
  envelopeInput: unknown,
  pinInput: unknown,
): Readonly<{
  readonly envelope: ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1;
  readonly pin: ProviderStrongReadyAcceptanceGenerationPinCandidateV1;
}> {
  const envelope = ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema.parse(
    envelopeInput,
  );
  const pin = ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema.parse(
    pinInput,
  );
  const payload = envelope.payload;
  const generationId = deriveProviderStrongReadyAcceptanceStateGenerationIdV1({
    installationIdentityGenerationId: payload.installationIdentityGenerationId,
    acceptanceOrdinal: payload.acceptanceOrdinal,
    predecessor: payload.predecessor,
    configuration: payload.configuration,
  });
  const contentDigest = deriveProviderStrongReadyAcceptanceStateContentDigestV1(
    payload,
  );
  if (
    envelope.generationId !== generationId ||
    payload.generationId !== generationId ||
    envelope.contentDigest !== contentDigest ||
    envelope.installationIdentityGenerationId !==
      payload.installationIdentityGenerationId ||
    envelope.acceptedAt !== payload.acceptedAt ||
    pin.generationId !== generationId ||
    pin.contentDigest !== contentDigest ||
    pin.acceptanceOrdinal !== payload.acceptanceOrdinal
  ) {
    throw new TypeError("Acceptance envelope or Pin binding is invalid");
  }
  return { envelope, pin };
}

function validateFormalAcceptanceEnvelopeV1(
  envelopeInput: unknown,
  pinInput: unknown,
): Readonly<{
  readonly envelope: ProviderAcceptanceStateEnvelopeV1;
  readonly pin: ProviderAcceptanceGenerationPinV1;
}> {
  const envelope = ProviderAcceptanceStateEnvelopeV1Schema.parse(envelopeInput);
  const pin = ProviderAcceptanceGenerationPinV1Schema.parse(pinInput);
  const payload = envelope.payload;
  const generationId = deriveProviderAcceptanceStateGenerationIdV1({
    installationIdentityGenerationId: payload.installationIdentityGenerationId,
    acceptanceOrdinal: payload.acceptanceOrdinal,
    predecessor: payload.predecessor,
    configuration: payload.configuration,
  });
  const contentDigest = deriveProviderAcceptanceStateContentDigestV1(payload);
  if (
    envelope.generationId !== generationId ||
    payload.generationId !== generationId ||
    envelope.contentDigest !== contentDigest ||
    envelope.installationIdentityGenerationId !==
      payload.installationIdentityGenerationId ||
    envelope.acceptedAt !== payload.acceptedAt ||
    pin.generationId !== generationId ||
    pin.contentDigest !== contentDigest ||
    pin.acceptanceOrdinal !== payload.acceptanceOrdinal
  ) {
    throw new TypeError("formal Acceptance envelope or Pin binding is invalid");
  }
  return { envelope, pin };
}

function validateReferenceToFormalAcceptanceBridgeV1(
  reference: ReturnType<typeof validateReferenceAcceptanceEnvelopeV1>,
  artifacts: Readonly<Record<string, ProviderRuntimeIpcJsonValueV1>>,
  formal: ReturnType<typeof validateFormalAcceptanceEnvelopeV1>,
): Readonly<{
  readonly formalPlanContentDigest: ContentDigestV1;
}> {
  const terminalJournal = asRecordV1(
    artifacts.terminalJournal,
    "sealed terminal Journal",
  );
  exactKeysV1(terminalJournal, TERMINAL_JOURNAL_KEYS_V1);
  const storedFormalPlan = validateStoredFormalPlanV1(
    artifacts.formalPlan,
    artifacts.formalPlanPin,
  );
  const formalPlan = storedFormalPlan.envelope;
  const formalPlanPin = storedFormalPlan.pin;
  const formalQuotaReservations = asRecordV1(
    formalPlan.payload.migrationHistoryQuotaReservations,
    "stored formal Plan history quota reservations",
  );
  const formalJournalReservation = asRecordV1(
    formalQuotaReservations.journal,
    "stored formal Plan journal quota reservation",
  );
  const terminalFormalPlanPin = validateStoredFormalPlanV1(
    artifacts.formalPlan,
    terminalJournal.formalPlanPin,
  ).pin;
  const sourceTombstone = asRecordV1(
    terminalJournal.sourceTombstoneRecord,
    "terminal source tombstone",
  );
  const readyToActivate = asRecordV1(
    terminalJournal.readyToActivateRecord,
    "terminal ready-to-activate record",
  );
  const sealedProgressHead = asRecordV1(
    terminalJournal.sealedProgressHead,
    "terminal sealed progress head",
  );
  const terminalProgressReceipt = asRecordV1(
    terminalJournal.terminalProgressReceipt,
    "terminal progress receipt",
  );
  const terminalJournalReceipt = asRecordV1(
    terminalJournal.terminalJournalReceipt,
    "terminal Journal receipt",
  );
  validateDomainRecordV1(
    sourceTombstone,
    SOURCE_TOMBSTONE_KEYS_V1,
    SOURCE_TOMBSTONE_DOMAIN_V1,
  );
  validateDomainRecordV1(
    readyToActivate,
    READY_TO_ACTIVATE_KEYS_V1,
    READY_TO_ACTIVATE_DOMAIN_V1,
  );
  validateDomainRecordV1(
    sealedProgressHead,
    SEALED_PROGRESS_HEAD_KEYS_V1,
    SEALED_PROGRESS_HEAD_DOMAIN_V1,
  );
  validateDomainRecordV1(
    terminalJournalReceipt,
    TERMINAL_JOURNAL_RECEIPT_KEYS_V1,
    TERMINAL_JOURNAL_RECEIPT_DOMAIN_V1,
  );
  validateDomainRecordV1(
    terminalProgressReceipt,
    TERMINAL_PROGRESS_RECEIPT_KEYS_V1,
    TERMINAL_PROGRESS_RECEIPT_DOMAIN_V1,
    "receiptContentDigest",
  );
  validateDomainRecordV1(
    terminalJournal,
    TERMINAL_JOURNAL_KEYS_V1,
    TERMINAL_JOURNAL_CLOSURE_DOMAIN_V1,
    "closureContentDigest",
  );
  const referenceConfiguration = reference.envelope.payload.configuration;
  const formalConfiguration = formal.envelope.payload.configuration;
  if (formalConfiguration.state !== "strong_ready") {
    throw new TypeError("formal Acceptance is not strong-ready");
  }
  const formalActivation = formalConfiguration.activation;
  if (
    referenceConfiguration.activation.origin !==
      "provider_migration_terminal_sealed_success_v1" ||
    formalActivation.origin !== "completed_provider_migration" ||
    formalActivation.migrationPlan.mode !== "same_installation_identity"
  ) {
    throw new TypeError("reference or formal Acceptance activation is invalid");
  }
  const quotaCommits = formalActivation.migrationHistoryQuotaCommits;
  if (quotaCommits.mode !== "same_installation_identity") {
    throw new TypeError("formal Acceptance quota mode is invalid");
  }
  const referenceActivation = referenceConfiguration.activation;
  const quotaCommit = quotaCommits.journalCommit;
  if (
    terminalJournal.profile !==
      "provider_migration_same_installation_identity_current_strong_source_normal_terminal_journal_sealed_validation_v1" ||
    terminalJournal.authority !==
      "in_memory_metadata_reference_only_no_real_provider_bytes_or_io_proof_v1" ||
    terminalJournal.durability !==
      "in_memory_terminal_journal_reference_only_not_a_durable_provider_v1" ||
    terminalJournal.relationship !==
      "exact_steady_registry_source_tombstone_ready_to_activate_and_progress_head_atomically_sealed_v1" ||
    terminalJournal.journalRevision !== 1 ||
    terminalJournal.strongWriterPublicationCount !== 0 ||
    terminalJournal.acceptancePublicationCount !== 0 ||
    sourceTombstone.profile !==
      "provider_migration_same_installation_identity_current_strong_source_normal_source_tombstone_record_v1" ||
    sourceTombstone.journalOrdinal !== 1 ||
    sourceTombstone.installationIdentityGenerationId !==
      formal.envelope.installationIdentityGenerationId ||
    sourceTombstone.formalMigrationId !== formalPlan.migrationId ||
    sourceTombstone.sourceProviderId !== terminalJournal.sourceProviderId ||
    sourceTombstone.reason !== "migration_completed" ||
    sourceTombstone.relationship !==
      "steady_registry_revoked_source_member_bound_to_exact_zero_live_terminal_progress_v1" ||
    readyToActivate.profile !==
      "provider_migration_same_installation_identity_current_strong_source_normal_ready_to_activate_record_v1" ||
    readyToActivate.journalOrdinal !== 2 ||
    readyToActivate.state !== "ready_to_activate" ||
    readyToActivate.installationIdentityGenerationId !==
      formal.envelope.installationIdentityGenerationId ||
    readyToActivate.formalMigrationId !== formalPlan.migrationId ||
    readyToActivate.destinationProviderId !==
      terminalJournal.destinationProviderId ||
    readyToActivate.relationship !==
      "terminal_metadata_ready_for_final_strong_activation_not_activated_v1" ||
    sealedProgressHead.profile !==
      "provider_migration_same_installation_identity_current_strong_source_normal_sealed_progress_head_v1" ||
    sealedProgressHead.journalOrdinal !== 3 ||
    sealedProgressHead.state !== "sealed" ||
    sealedProgressHead.journalRevision !== 1 ||
    sealedProgressHead.relationship !==
      "terminal_metadata_progress_head_sealed_before_final_acceptance_v1" ||
    terminalJournalReceipt.profile !==
      "provider_migration_same_installation_identity_current_strong_source_normal_terminal_journal_seal_receipt_v1" ||
    terminalJournalReceipt.durability !==
      "in_memory_terminal_journal_reference_only_not_a_durable_provider_v1" ||
    terminalJournalReceipt.status !== "committed" ||
    terminalJournalReceipt.previousJournalRevision !== 0 ||
    terminalJournalReceipt.committedJournalRevision !== 1 ||
    terminalProgressReceipt.profile !==
      "provider_migration_same_installation_identity_current_strong_source_normal_execution_progress_receipt_v1" ||
    terminalProgressReceipt.durability !==
      "in_memory_execution_progress_reference_only_not_a_durable_provider_v1" ||
    terminalProgressReceipt.resolution !== "committed" ||
    reference.envelope.installationIdentityGenerationId !==
      formal.envelope.installationIdentityGenerationId ||
    // Formal record continuity (ordinal, predecessor and acceptedAt) belongs
    // to the authenticated Acceptance authority history.  The immutable
    // runtime basis binds the terminal strong-ready semantics, so an exact
    // semantic successor can become current without rewriting the journal.
    !canonicalEqualV1(referenceConfiguration.core, formalConfiguration.core) ||
    referenceActivation.formalMigrationId !== formalPlan.migrationId ||
    referenceActivation.formalMigrationId !==
      formalActivation.migrationPlan.migrationId ||
    formalPlan.mode !== formalActivation.migrationPlan.mode ||
    formalPlan.contentDigest !== formalActivation.migrationPlan.contentDigest ||
    formalPlan.payload.migrationId !== formalPlan.migrationId ||
    formalPlan.payload.mode !== formalPlan.mode ||
    formalPlanPin.formalMigrationId !== formalPlan.migrationId ||
    formalPlanPin.contentDigest !== formalPlan.contentDigest ||
    !canonicalEqualV1(referenceActivation.formalPlanPin, formalPlanPin) ||
    !canonicalEqualV1(terminalFormalPlanPin, formalPlanPin) ||
    terminalJournal.installationIdentityGenerationId !==
      formal.envelope.installationIdentityGenerationId ||
    terminalJournal.formalMigrationId !== formalPlan.migrationId ||
    terminalJournal.destinationProviderId !==
      referenceConfiguration.core.activeWriterSelector.selections[0]?.providerId ||
    !canonicalEqualV1(
      terminalJournal.currentRegistryManifestPin,
      referenceConfiguration.core.providerRegistryManifest,
    ) ||
    !canonicalEqualV1(
      terminalJournal.currentSupportCatalogPin,
      referenceConfiguration.core.providerSupportCatalog,
    ) ||
    !canonicalEqualV1(sourceTombstone.steadyRegistryManifestPin,
      terminalJournal.currentRegistryManifestPin) ||
    !canonicalEqualV1(readyToActivate.steadyRegistryManifestPin,
      terminalJournal.currentRegistryManifestPin) ||
    !canonicalEqualV1(readyToActivate.currentSupportCatalogPin,
      terminalJournal.currentSupportCatalogPin) ||
    !canonicalEqualV1(readyToActivate.formalPlanPin, formalPlanPin) ||
    !canonicalEqualV1(sealedProgressHead.steadyRegistryManifestPin,
      terminalJournal.currentRegistryManifestPin) ||
    !canonicalEqualV1(sealedProgressHead.formalPlanPin, formalPlanPin) ||
    terminalProgressReceipt.receiptContentDigest !==
      referenceActivation.terminalProgressReceiptContentDigest ||
    terminalJournal.terminalJournalReceiptContentDigest !==
      referenceActivation.terminalJournalReceiptContentDigest ||
    terminalJournalReceipt.contentDigest !==
      terminalJournal.terminalJournalReceiptContentDigest ||
    sourceTombstone.contentDigest !==
      referenceActivation.sourceTombstoneRecordContentDigest ||
    readyToActivate.contentDigest !==
      referenceActivation.readyToActivateRecordContentDigest ||
    sealedProgressHead.contentDigest !==
      referenceActivation.sealedProgressHeadContentDigest ||
    terminalJournalReceipt.sourceTombstoneRecordContentDigest !==
      sourceTombstone.contentDigest ||
    terminalJournalReceipt.readyToActivateRecordContentDigest !==
      readyToActivate.contentDigest ||
    terminalJournalReceipt.sealedProgressHeadContentDigest !==
      sealedProgressHead.contentDigest ||
    sealedProgressHead.sourceTombstoneRecordContentDigest !==
      sourceTombstone.contentDigest ||
    sealedProgressHead.readyToActivateRecordContentDigest !==
      readyToActivate.contentDigest ||
    sealedProgressHead.terminalProgressReceiptContentDigest !==
      terminalProgressReceipt.receiptContentDigest ||
    formalActivation.sealedProgressHead.migrationId !== formalPlan.migrationId ||
    formalActivation.sealedProgressHead.headContentDigest !==
      sealedProgressHead.contentDigest ||
    formalActivation.sealedProgressHead.readyToActivateRecord.migrationId !==
      formalPlan.migrationId ||
    formalActivation.sealedProgressHead.readyToActivateRecord.contentDigest !==
      readyToActivate.contentDigest ||
    quotaCommit.installationIdentityGenerationId !==
      formal.envelope.installationIdentityGenerationId ||
    quotaCommit.migrationId !== formalPlan.migrationId ||
    quotaCommit.migrationPlanContentDigest !== formalPlan.contentDigest ||
    formalQuotaReservations.mode !== "same_installation_identity" ||
    formalJournalReservation.role !== quotaCommit.role ||
    formalJournalReservation.formalMigrationId !== quotaCommit.migrationId ||
    formalJournalReservation.installationIdentityGenerationId !==
      quotaCommit.installationIdentityGenerationId
  ) {
    throw new TypeError(
      "reference and formal Acceptance terminal binding is invalid",
    );
  }
  return Object.freeze({ formalPlanContentDigest: formalPlan.contentDigest });
}

function validateReferenceReceiptAndStateV1(
  closure: Record<string, unknown>,
  envelope: ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
  pin: ProviderStrongReadyAcceptanceGenerationPinCandidateV1,
): void {
  const receipt = asRecordV1(
    closure.acceptanceCompareAppendReceipt,
    "Acceptance receipt",
  );
  exactKeysV1(receipt, FINAL_RECEIPT_KEYS_V1);
  const outcome = asRecordV1(receipt.outcome, "Acceptance receipt outcome");
  exactKeysV1(outcome, ["state", "appendedAcceptance", "highWaterRevision"]);
  if (
    receipt.profile !==
      "provider_migration_same_installation_identity_current_strong_source_normal_final_strong_ready_acceptance_compare_append_receipt_v1" ||
    receipt.durability !==
      "in_memory_reference_only_not_a_durable_provider_v1" ||
    typeof receipt.operationNonce !== "string" ||
    !/^[0-9a-f]{32}$/u.test(receipt.operationNonce) ||
    typeof receipt.resolvedAt !== "string" ||
    outcome.state !== "committed" ||
    !canonicalEqualV1(outcome.appendedAcceptance, pin)
  ) {
    throw new TypeError("Acceptance compare-append receipt is invalid");
  }
  ContentDigestV1Schema.parse(receipt.requestContentDigest);
  ContentDigestV1Schema.parse(receipt.receiptContentDigest);
  const highWaterRevision = safePositiveIntegerV1(
    outcome.highWaterRevision,
    "Acceptance high-water revision",
  );

  const state = asRecordV1(
    closure.acceptanceReferenceState,
    "Acceptance reference state",
  );
  exactKeysV1(state, FINAL_STATE_KEYS_V1);
  if (
    state.profile !==
      "provider_migration_same_installation_identity_current_strong_source_normal_final_strong_ready_acceptance_compare_append_state_v1" ||
    state.durability !==
      "in_memory_reference_only_not_a_durable_provider_v1" ||
    state.installationIdentityGenerationId !==
      envelope.installationIdentityGenerationId ||
    state.highWaterRevision !== highWaterRevision ||
    state.acceptancePublicationCount !== 1 ||
    !canonicalEqualV1(state.currentAcceptance, pin) ||
    !canonicalEqualV1(state.finalStrongReadyAcceptance, envelope) ||
    !Array.isArray(state.receipts) ||
    state.receipts.length !== 1 ||
    !canonicalEqualV1(state.receipts[0], receipt)
  ) {
    throw new TypeError("Acceptance current state is invalid");
  }
  safePositiveIntegerV1(state.generationCount, "Acceptance generation count");
  ContentDigestV1Schema.parse(state.generationSetDigest);
  if (
    typeof state.currentVersionToken !== "string" ||
    state.currentVersionToken.length === 0 ||
    !isRecordV1(state.retiredMigrationOnlyState)
  ) {
    throw new TypeError("Acceptance state continuity is invalid");
  }
}

function validateLifecycleArtifactsV1(artifactsInput: unknown) {
  const projected = projectProviderRuntimeDurableLifecycleArtifactSetV1(
    artifactsInput,
  );
  const artifacts = projected.lifecycleArtifacts;
  const closure = asRecordV1(
    artifacts.finalStrongReadyAcceptance,
    "final strong-ready Acceptance closure",
  );
  exactKeysV1(closure, FINAL_CLOSURE_KEYS_V1);
  if (
    closure.authority !==
      "in_memory_reference_machine_only_no_production_provider_authority_v1" ||
    closure.durability !==
      "in_memory_reference_only_not_a_durable_provider_v1" ||
    closure.profile !==
      "provider_migration_same_installation_identity_current_strong_source_normal_final_strong_ready_acceptance_reference_validation_v1" ||
    closure.relationship !==
      "exact_terminal_sealed_new_destination_writer_final_strong_ready_acceptance_compare_appended_v1" ||
    closure.sourceWriterRetired !== true ||
    closure.migrationOnlyWriterRetired !== true ||
    closure.destinationOnlyPublicStrongWriter !== true ||
    closure.finalSteadyRegistryAndCatalogBound !== true ||
    closure.formalPlanAndTerminalSealBound !== true ||
    closure.acceptancePublicationCount !== 1 ||
    closure.publicStrongWriterPublicationCount !== 1 ||
    !canonicalEqualV1(closure.sealedTerminalJournal, artifacts.terminalJournal)
  ) {
    throw new TypeError("final strong-ready Acceptance closure is invalid");
  }

  const { envelope, pin } = validateReferenceAcceptanceEnvelopeV1(
    closure.finalStrongReadyAcceptanceEnvelope,
    closure.finalStrongReadyAcceptancePin,
  );
  const candidate = asRecordV1(
    closure.candidateValidation,
    "final strong-ready candidate",
  );
  exactKeysV1(candidate, FINAL_CANDIDATE_KEYS_V1);
  if (
    candidate.authority !== "none" ||
    candidate.durability !== "none" ||
    candidate.profile !==
      "provider_migration_same_installation_identity_current_strong_source_normal_final_strong_ready_acceptance_candidate_validation_v1" ||
    candidate.relationship !==
      "exact_terminal_sealed_destination_only_strong_ready_acceptance_candidate_not_appended_v1" ||
    candidate.destinationOnlyPublicStrongWriter !== true ||
    candidate.acceptanceAppendCount !== 0 ||
    !canonicalEqualV1(candidate.acceptanceStateEnvelope, envelope) ||
    !canonicalEqualV1(candidate.acceptanceGenerationPin, pin) ||
    !canonicalEqualV1(candidate.formalPlanPin, artifacts.formalPlanPin)
  ) {
    throw new TypeError("final strong-ready candidate binding is invalid");
  }
  const configuration = envelope.payload.configuration;
  const core = configuration.core;
  const selection = core.activeWriterSelector.selections[0];
  if (
    configuration.activation.origin !==
      "provider_migration_terminal_sealed_success_v1"
  ) {
    throw new TypeError("final Acceptance activation is invalid");
  }
  const activation = configuration.activation;
  const selectorDigest = deriveProviderActiveWriterSelectorContentDigestV1(
    core.activeWriterSelector,
  );
  if (
    candidate.formalMigrationId !== activation.formalMigrationId ||
    !canonicalEqualV1(candidate.formalPlanPin, activation.formalPlanPin) ||
    candidate.activeWriterSelectorContentDigest !== selectorDigest ||
    !canonicalEqualV1(candidate.activeWriterSelector, core.activeWriterSelector) ||
    core.activeWriterSelector.selections.length !== 1 ||
    selection === undefined ||
    selection.providerId !== closure.destinationProviderId
  ) {
    throw new TypeError("active writer selector digest is invalid");
  }
  validateReferenceReceiptAndStateV1(closure, envelope, pin);

  const storedRegistry = asRecordV1(
    artifacts.registryManifest,
    "stored Registry manifest",
  );
  const storedCatalog = asRecordV1(
    artifacts.supportCatalog,
    "stored support Catalog",
  );
  const storedFormalPlan = asRecordV1(
    artifacts.formalPlan,
    "stored formal Plan",
  );
  if (
    storedRegistry.contentDigest !== core.providerRegistryManifest.contentDigest ||
    storedCatalog.contentDigest !== core.providerSupportCatalog.contentDigest ||
    storedFormalPlan.contentDigest !== activation.formalPlanPin.contentDigest
  ) {
    throw new TypeError("durable lifecycle artifacts do not match Acceptance");
  }
  return {
    ...projected,
    closure,
    envelope,
    pin,
    configuration,
    activation,
    core,
    selection,
  };
}

export function projectProviderRuntimeDurableLifecycleArtifactsV1(
  input: Readonly<{
    journalState: unknown;
    expectedAcceptanceEnvelope: unknown;
    expectedAcceptancePin: unknown;
  }>,
): ProviderRuntimeDurableLifecycleProjectionV1 {
  const state = ProviderRuntimeIpcJournalStateV1Schema.parse(input.journalState);
  if (state.phase !== "final_strong_ready" || state.revision < 1) {
    throw new TypeError("durable journal is not final_strong_ready");
  }
  const validated = validateLifecycleArtifactsV1(state.artifacts);
  const expected = validateFormalAcceptanceEnvelopeV1(
    input.expectedAcceptanceEnvelope,
    input.expectedAcceptancePin,
  );
  validateReferenceToFormalAcceptanceBridgeV1(
    { envelope: validated.envelope, pin: validated.pin },
    validated.lifecycleArtifacts,
    expected,
  );
  return Object.freeze({
    state,
    lifecycleArtifacts: Object.freeze({ ...validated.lifecycleArtifacts }),
    ...(validated.businessHead === undefined
      ? {}
      : { businessHead: validated.businessHead }),
  });
}

function validateCurrentArtifactV1(input: {
  readonly journalState: ProviderRuntimeIpcJournalStateV1;
  readonly liveGate: ProviderRuntimeLiveGateActivationCandidateV1;
  readonly gateValues: ProviderRuntimeLiveGateBindingGateValuesV1;
}): ProviderRuntimeDurableAcceptanceCurrentCandidateV1 {
  const state = ProviderRuntimeIpcJournalStateV1Schema.parse(input.journalState);
  if (
    state.phase !== "final_strong_ready" ||
    state.revision < input.liveGate.bindings.inspectedRevision ||
    state.revision < 1
  ) {
    throw new TypeError("durable journal is not current final_strong_ready");
  }
  const mutationDigest = ContentDigestV1Schema.parse(state.mutationDigest);
  const validated = validateLifecycleArtifactsV1(state.artifacts);
  const {
    lifecycleArtifacts: artifacts,
    closure,
    envelope,
    pin,
    configuration,
    activation,
    core,
    selection,
  } = validated;

  const values = input.gateValues;
  const registryClosure = values.registry.closure;
  const catalogClosure = values.catalog.closure;
  const registryHistory = registryClosure.registryManifestHistoryClosure;
  const registryEntry = registryClosure.candidateRegistryEntry;
  if (
    selection.providerId !== input.liveGate.bindings.providerId ||
    selection.targetProfileId !== input.liveGate.bindings.targetProfileId ||
    selection.registryEntryContentDigest !==
      registryClosure.candidateRegistryEntryContentDigest ||
    selection.semanticProviderPolicyDigest !==
      registryEntry.semanticProviderPolicyDigest ||
    !canonicalEqualV1(
      selection.providerFeasibilityEvidence,
      values.evidence.pin,
    ) ||
    selection.runtimeAttestationContentDigest !==
      registryEntry.runtimeAttestation.contentDigest ||
    selection.bindingDerivationKeyGeneration !==
      registryEntry.verificationKeys.activeBindingDerivationKeyGeneration ||
    envelope.installationIdentityGenerationId !==
      registryHistory.installationIdentityGenerationId ||
    envelope.installationIdentityGenerationId !==
      registryEntry.installationIdentityGenerationId ||
    !canonicalEqualV1(
      core.activeRootMetadata,
      registryHistory.currentRootMetadata,
    ) ||
    !canonicalEqualV1(
      core.providerRegistryManifest,
      registryHistory.currentRegistryManifest,
    ) ||
    !canonicalEqualV1(
      core.providerSupportCatalog,
      catalogClosure.providerFeasibilitySupportCatalogPin,
    ) ||
    core.providerSupportCatalog.contentDigest !==
      input.liveGate.bindings.catalogContentDigest ||
    !canonicalEqualV1(activation.formalPlanPin, artifacts.formalPlanPin)
  ) {
    throw new TypeError("Acceptance does not bind the live Gate current state");
  }

  return Object.freeze({
    status: "durable_acceptance_current_candidate" as const,
    authority: "none" as const,
    accessMode: "read_only" as const,
    strongWriteStatus: "locked" as const,
    acceptanceTokenStatus:
      "not_verified_external_identity_capability_required" as const,
    requiredNext: PROVIDER_RUNTIME_DURABLE_ACCEPTANCE_REQUIRED_NEXT_V1,
    bindings: Object.freeze({
      providerId: selection.providerId,
      targetProfileId: selection.targetProfileId,
      installationIdentityGenerationId:
        InstallationIdentityGenerationIdV1Schema.parse(
          envelope.installationIdentityGenerationId,
        ),
      acceptanceOrdinal: pin.acceptanceOrdinal,
      acceptanceGenerationId: pin.generationId,
      acceptanceContentDigest: pin.contentDigest,
      registryManifestContentDigest: core.providerRegistryManifest.contentDigest,
      supportCatalogContentDigest: core.providerSupportCatalog.contentDigest,
      formalPlanContentDigest: activation.formalPlanPin.contentDigest,
      journalRevision: state.revision,
      journalMutationDigest: mutationDigest,
      liveInspectedRevision: input.liveGate.bindings.inspectedRevision,
    }),
  });
}

function unavailableV1(
  stage: Extract<
    ProviderRuntimeDurableAcceptanceCurrentDiagnosticV1,
    { readonly ok: false }
  >["stage"],
): ProviderRuntimeDurableAcceptanceCurrentDiagnosticV1 {
  return Object.freeze({
    ok: false as const,
    code: "provider_unavailable" as const,
    reason: "attestation_invalid" as const,
    stage,
  });
}

/**
 * Recompute the live Gate, observe the provider's actual durable journal over
 * authenticated IPC, and bind the terminal Acceptance to the exact Gate
 * Registry/Catalog/provider selection.  The returned value remains locked:
 * the keyed Acceptance token and kernel peer identity are separate gates.
 */
export async function diagnoseProviderRuntimeDurableAcceptanceCurrentV1(
  input: VerifyProviderRuntimeDurableAcceptanceCurrentOptionsV1,
): Promise<ProviderRuntimeDurableAcceptanceCurrentDiagnosticV1> {
  const live = await diagnoseProviderRuntimeLiveGateBindingV1(
    input.liveGateBinding,
  ).catch(() => undefined);
  if (live === undefined || !live.ok) return unavailableV1("live_gate");
  let state: ProviderRuntimeIpcJournalStateV1;
  try {
    state = await inspectProviderRuntimeAuthenticatedJournalStateV1({
      config: input.liveGateBinding.config,
      authKey: input.liveGateBinding.authKey,
      expectedInstallationIdentityDigest:
        input.liveGateBinding.expectedInstallationIdentityDigest,
      timeoutMs: input.liveGateBinding.timeoutMs,
    });
    const currentTarget = await assertProviderRuntimeTargetContinuityV1(
      input.liveGateBinding.targetBaseline,
    );
    if (
      currentTarget.targetFingerprintDigest !==
      live.value.bindings.targetFingerprintDigest
    ) {
      return unavailableV1("journal_observation");
    }
  } catch {
    return unavailableV1("journal_observation");
  }
  try {
    return Object.freeze({
      ok: true as const,
      value: validateCurrentArtifactV1({
        journalState: state,
        liveGate: live.value,
        gateValues: resolveGateValuesV1(input.liveGateBinding),
      }),
    });
  } catch {
    return unavailableV1("acceptance_current");
  }
}

export const verifyProviderRuntimeDurableAcceptanceCurrentV1 =
  diagnoseProviderRuntimeDurableAcceptanceCurrentV1;
