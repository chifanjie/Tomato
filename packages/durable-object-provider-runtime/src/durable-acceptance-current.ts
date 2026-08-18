import {
  ProviderRuntimeIpcJournalStateV1Schema,
  type ProviderRuntimeIpcJournalStateV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";
import {
  ContentDigestV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  type ContentDigestV1,
  type InstallationIdentityGenerationIdV1,
} from "@understand-code/durable-object-provider-contracts/primitives";
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
import { inspectProviderRuntimeAuthenticatedJournalStateV1 } from "./live-service-readiness.js";
import { assertProviderRuntimeTargetContinuityV1 } from "./target-inspection.js";

export const PROVIDER_RUNTIME_DURABLE_ACCEPTANCE_REQUIRED_NEXT_V1 =
  "acceptance_identity_token_and_os_peer_gate" as const;

const FINAL_ARTIFACT_KEYS_V1 = Object.freeze([
  "preparedCatalogSuccessor",
  "registryManifest",
  "supportCatalog",
  "formalPlan",
  "formalPlanPin",
  "formalReservation",
  "reservationRecord",
  "compoundPublicationReceipt",
  "migrationOnlyAcceptance",
  "rebindingRegistry",
  "executionProgress",
  "destinationObjectPublications",
  "zeroLive",
  "sourceDrainedRegistry",
  "steadyRegistry",
  "terminalJournal",
  "finalStrongReadyAcceptance",
]);

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

function validateAcceptanceEnvelopeV1(
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
  const artifacts = asRecordV1(state.artifacts, "durable journal artifacts");
  exactKeysV1(artifacts, FINAL_ARTIFACT_KEYS_V1);

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

  const { envelope, pin } = validateAcceptanceEnvelopeV1(
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
  const selectorDigest = deriveProviderActiveWriterSelectorContentDigestV1(
    envelope.payload.configuration.core.activeWriterSelector,
  );
  if (
    candidate.activeWriterSelectorContentDigest !== selectorDigest ||
    !canonicalEqualV1(
      candidate.activeWriterSelector,
      envelope.payload.configuration.core.activeWriterSelector,
    )
  ) {
    throw new TypeError("active writer selector digest is invalid");
  }
  validateReferenceReceiptAndStateV1(closure, envelope, pin);

  const values = input.gateValues;
  const registryClosure = values.registry.closure;
  const catalogClosure = values.catalog.closure;
  const registryHistory = registryClosure.registryManifestHistoryClosure;
  const registryEntry = registryClosure.candidateRegistryEntry;
  const configuration = envelope.payload.configuration;
  const core = configuration.core;
  const selection = core.activeWriterSelector.selections[0];
  if (
    configuration.activation.origin !==
      "provider_migration_terminal_sealed_success_v1" ||
    core.activeWriterSelector.selections.length !== 1 ||
    selection === undefined ||
    selection.providerId !== input.liveGate.bindings.providerId ||
    selection.providerId !== closure.destinationProviderId ||
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
    !canonicalEqualV1(configuration.activation.formalPlanPin, artifacts.formalPlanPin)
  ) {
    throw new TypeError("Acceptance does not bind the live Gate current state");
  }

  const storedRegistry = asRecordV1(
    artifacts.registryManifest,
    "stored Registry manifest",
  );
  const storedCatalog = asRecordV1(artifacts.supportCatalog, "stored support Catalog");
  const storedFormalPlan = asRecordV1(artifacts.formalPlan, "stored formal Plan");
  if (
    storedRegistry.contentDigest !== core.providerRegistryManifest.contentDigest ||
    storedCatalog.contentDigest !== core.providerSupportCatalog.contentDigest ||
    storedFormalPlan.contentDigest !== configuration.activation.formalPlanPin.contentDigest
  ) {
    throw new TypeError("durable lifecycle artifacts do not match Acceptance");
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
      formalPlanContentDigest: configuration.activation.formalPlanPin.contentDigest,
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
