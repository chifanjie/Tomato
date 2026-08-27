import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const liveGateMock = vi.hoisted(() => vi.fn());
const targetContinuityMock = vi.hoisted(() => vi.fn());

vi.mock("../src/live-gate-binding.js", () => ({
  diagnoseProviderRuntimeLiveGateBindingV1: liveGateMock,
}));
vi.mock("../src/target-inspection.js", () => ({
  assertProviderRuntimeTargetContinuityV1: targetContinuityMock,
}));

import {
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
} from "@understand-code/durable-object-provider-contracts/primitives";
import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";
import {
  ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
  deriveProviderActiveWriterSelectorContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
} from "@understand-code/durable-object-provider-contracts/provider-strong-ready-acceptance-candidate";
import {
  ProviderAcceptanceStateEnvelopeV1Schema,
  deriveProviderAcceptanceStateContentDigestV1,
  deriveProviderAcceptanceStateGenerationIdV1,
} from "@understand-code/durable-object-provider-contracts/provider-acceptance";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1Schema,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinV1,
} from "@understand-code/durable-object-provider-contracts";

import {
  diagnoseProviderRuntimeDurableAcceptanceCurrentV1,
  projectProviderRuntimeDurableLifecycleArtifactsV1,
} from "../src/durable-acceptance-current.js";
import {
  PROVIDER_RUNTIME_DURABLE_BUSINESS_HEAD_ARTIFACT_KEY_V1,
  PROVIDER_RUNTIME_DURABLE_BUSINESS_HEAD_PROFILE_V1,
} from "../src/durable-lifecycle-artifacts.js";
import { DurableObjectProviderRuntimeServerV1 } from "../src/server.js";
import {
  createProviderServiceHandoffConfigV1,
  generateProviderServiceSigningKeyPairV1,
} from "../src/service-handoff.js";
import { DurableObjectProviderRuntimeStoreV1 } from "../src/storage.js";

const PROVIDER_ID = DurableObjectIdentityProviderIdV1Schema.parse(
  "durable-object-provider:acceptance-current",
);
const TARGET_PROFILE_ID = `provider-target-profile:${"4".repeat(64)}`;
const OFFICIAL_FORMAL_PLAN =
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1Schema.parse(
    JSON.parse(readFileSync(new URL(
      "./fixtures/provider-migration-formal-plan-reference-candidate-v1.json",
      import.meta.url,
    ), "utf8")),
  );
const OFFICIAL_FORMAL_PLAN_PIN =
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinV1(
    OFFICIAL_FORMAL_PLAN,
  );
const INSTALLATION_GENERATION_ID =
  OFFICIAL_FORMAL_PLAN.payload.journalAuthorityInstallationIdentityGenerationId;
const FORMAL_MIGRATION_ID = OFFICIAL_FORMAL_PLAN.migrationId;

function digestV1(value: string) {
  return ContentDigestV1Schema.parse(`sha256:${value.repeat(64)}`);
}

const INSTALLATION_DIGEST = digestV1("1");
const BINARY_DIGEST = digestV1("2");
const CAPABILITY_DIGEST = digestV1("3");
const TARGET_FINGERPRINT_DIGEST = digestV1("4");
const ROOT_DIGEST = digestV1("5");
const REGISTRY_DIGEST = digestV1("6");
const CATALOG_DIGEST = digestV1("7");
const REGISTRY_ENTRY_DIGEST = digestV1("8");
const POLICY_DIGEST = digestV1("9");
const EVIDENCE_DIGEST = digestV1("a");
const RUNTIME_ATTESTATION_DIGEST = digestV1("b");

function domainDigestV1(domain: string, value: unknown) {
  return ContentDigestV1Schema.parse(
    `sha256:${createHash("sha256")
      .update(canonicalizeJcsSafeIntegerV1([domain, value]), "utf8")
      .digest("hex")}`,
  );
}

const roots = new Set<string>();
const servers = new Set<DurableObjectProviderRuntimeServerV1>();

afterEach(async () => {
  await Promise.all([...servers].map((server) => server.close()));
  servers.clear();
  await Promise.all(
    [...roots].map((root) => rm(root, { recursive: true, force: true })),
  );
  roots.clear();
  vi.clearAllMocks();
});

function currentArtifactsV1() {
  const rootPin = {
    locatorProfile: "installation_provider_registry_root_metadata_v1" as const,
    rootGeneration: 1,
    rootKeyId: "1".repeat(22),
    contentDigest: ROOT_DIGEST,
  };
  const registryPin = {
    locatorProfile: "installation_provider_registry_manifest_v1" as const,
    manifestGeneration: 1,
    generationId: `provider-registry-manifest:${"2".repeat(22)}`,
    contentDigest: REGISTRY_DIGEST,
  };
  const catalogPin = {
    locatorProfile:
      "distribution_provider_feasibility_support_catalog_v1" as const,
    catalogGeneration: 1,
    contentDigest: CATALOG_DIGEST,
  };
  const evidencePin = {
    locatorProfile: "installation_provider_feasibility_evidence_v1" as const,
    evidenceId: `provider-feasibility-evidence:${"3".repeat(22)}`,
    contentDigest: EVIDENCE_DIGEST,
  };
  const selection = {
    targetProfileId: TARGET_PROFILE_ID,
    providerId: PROVIDER_ID,
    registryEntryContentDigest: REGISTRY_ENTRY_DIGEST,
    semanticProviderPolicyDigest: POLICY_DIGEST,
    providerFeasibilityEvidence: evidencePin,
    runtimeAttestationContentDigest: RUNTIME_ATTESTATION_DIGEST,
    bindingDerivationKeyGeneration: 1,
  };
  const selector = {
    profile: "provider_active_writer_selector_v1" as const,
    selections: [selection],
  };
  const formalPlan = structuredClone(OFFICIAL_FORMAL_PLAN);
  const formalPlanPin = structuredClone(OFFICIAL_FORMAL_PLAN_PIN);
  const formalPlanDigest = formalPlan.contentDigest;
  const core = {
    activeRootMetadata: rootPin,
    providerRegistryManifest: registryPin,
    providerSupportCatalog: catalogPin,
    activeWriterSelector: selector,
  };
  const migrationPlan = {
    locatorProfile: "installation_provider_migration_plan_v1" as const,
    migrationId: FORMAL_MIGRATION_ID,
    mode: "same_installation_identity" as const,
    contentDigest: formalPlanDigest,
  };
  const migrationHistoryQuotaCommits = {
    mode: "same_installation_identity" as const,
    journalCommit: {
      locatorProfile:
        "installation_provider_migration_history_quota_operation_receipt_v1" as const,
      installationIdentityGenerationId: INSTALLATION_GENERATION_ID,
      operationNonce: "c".repeat(32),
      contentDigest: digestV1("d"),
      receiptToken: `hmac-sha256:${"d".repeat(64)}` as const,
      migrationId: FORMAL_MIGRATION_ID,
      reservationId:
        `provider-migration-history-reservation:${"c".repeat(22)}` as const,
      migrationPlanContentDigest: formalPlanDigest,
      role: "same_identity_journal" as const,
      operation: "compare_commit" as const,
      commitKind: "commit_retained_history" as const,
      outcome: "committed" as const,
    },
  };
  const terminalProgressUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_execution_progress_receipt_v1" as const,
    durability:
      "in_memory_execution_progress_reference_only_not_a_durable_provider_v1" as const,
    resolution: "committed" as const,
    operationNonce: "d".repeat(32),
    requestContentDigest: digestV1("d"),
    linearizationOrdinal: 1,
    progressRecord: { phase: "completed" },
    destinationObjectPublication: "none" as const,
    committedHighWater: { phase: "completed" },
  };
  const terminalProgressReceipt = {
    ...terminalProgressUnsigned,
    receiptContentDigest: domainDigestV1(
      "provider-migration-same-installation-identity-execution-progress-receipt-v1",
      terminalProgressUnsigned,
    ),
  };
  const sourceTombstoneUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_source_tombstone_record_v1" as const,
    journalOrdinal: 1,
    installationIdentityGenerationId: INSTALLATION_GENERATION_ID,
    formalMigrationId: FORMAL_MIGRATION_ID,
    sourceProviderId: "durable-object-provider:source",
    steadyRegistryManifestPin: registryPin,
    lastEnabledRegistryEntryContentDigest: REGISTRY_ENTRY_DIGEST,
    revokedAtManifestGeneration: 1,
    reason: "migration_completed" as const,
    zeroLiveProofContentDigest: digestV1("e"),
    terminalProgressReceiptContentDigest:
      terminalProgressReceipt.receiptContentDigest,
    relationship:
      "steady_registry_revoked_source_member_bound_to_exact_zero_live_terminal_progress_v1" as const,
  };
  const sourceTombstoneRecord = {
    ...sourceTombstoneUnsigned,
    contentDigest: domainDigestV1(
      "provider-migration-same-installation-identity-terminal-source-tombstone-record-v1",
      sourceTombstoneUnsigned,
    ),
  };
  const readyToActivateUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_ready_to_activate_record_v1" as const,
    journalOrdinal: 2,
    state: "ready_to_activate" as const,
    installationIdentityGenerationId: INSTALLATION_GENERATION_ID,
    formalMigrationId: FORMAL_MIGRATION_ID,
    destinationProviderId: PROVIDER_ID,
    steadyRegistryManifestPin: registryPin,
    currentSupportCatalogPin: catalogPin,
    formalPlanPin,
    sourceTombstoneRecordContentDigest: sourceTombstoneRecord.contentDigest,
    terminalProgressReceiptContentDigest:
      terminalProgressReceipt.receiptContentDigest,
    relationship:
      "terminal_metadata_ready_for_final_strong_activation_not_activated_v1" as const,
  };
  const readyToActivateRecord = {
    ...readyToActivateUnsigned,
    contentDigest: domainDigestV1(
      "provider-migration-same-installation-identity-terminal-ready-to-activate-record-v1",
      readyToActivateUnsigned,
    ),
  };
  const sealedProgressHeadUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_sealed_progress_head_v1" as const,
    journalOrdinal: 3,
    state: "sealed" as const,
    journalRevision: 1,
    steadyRegistryManifestPin: registryPin,
    formalPlanPin,
    terminalProgressReceiptContentDigest:
      terminalProgressReceipt.receiptContentDigest,
    destinationUniverseContentDigest: digestV1("f"),
    completeDestinationPublicationReceiptSetDigest: digestV1("0"),
    zeroLiveProofContentDigest: sourceTombstoneUnsigned.zeroLiveProofContentDigest,
    sourceTombstoneRecordContentDigest: sourceTombstoneRecord.contentDigest,
    readyToActivateRecordContentDigest: readyToActivateRecord.contentDigest,
    relationship:
      "terminal_metadata_progress_head_sealed_before_final_acceptance_v1" as const,
  };
  const terminalSealedProgressHead = {
    ...sealedProgressHeadUnsigned,
    contentDigest: domainDigestV1(
      "provider-migration-same-installation-identity-terminal-sealed-progress-head-v1",
      sealedProgressHeadUnsigned,
    ),
  };
  const terminalJournalReceiptUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_terminal_journal_seal_receipt_v1" as const,
    durability:
      "in_memory_terminal_journal_reference_only_not_a_durable_provider_v1" as const,
    status: "committed" as const,
    operationNonce: "e".repeat(32),
    requestContentDigest: digestV1("1"),
    previousJournalRevision: 0,
    committedJournalRevision: 1,
    sourceTombstoneRecordContentDigest: sourceTombstoneRecord.contentDigest,
    readyToActivateRecordContentDigest: readyToActivateRecord.contentDigest,
    sealedProgressHeadContentDigest: terminalSealedProgressHead.contentDigest,
  };
  const terminalJournalReceipt = {
    ...terminalJournalReceiptUnsigned,
    contentDigest: domainDigestV1(
      "provider-migration-same-installation-identity-terminal-journal-receipt-v1",
      terminalJournalReceiptUnsigned,
    ),
  };
  const terminalJournalUnsigned = {
    authority:
      "in_memory_metadata_reference_only_no_real_provider_bytes_or_io_proof_v1" as const,
    durability:
      "in_memory_terminal_journal_reference_only_not_a_durable_provider_v1" as const,
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_terminal_journal_sealed_validation_v1" as const,
    relationship:
      "exact_steady_registry_source_tombstone_ready_to_activate_and_progress_head_atomically_sealed_v1" as const,
    steadyRegistryCompletion: { state: "completed" },
    sourceTombstoneRecord,
    readyToActivateRecord,
    sealedProgressHead: terminalSealedProgressHead,
    terminalJournalReceipt,
    terminalJournalReceiptContentDigest: terminalJournalReceipt.contentDigest,
    currentRegistryManifestEnvelope: { contentDigest: REGISTRY_DIGEST },
    currentRegistryManifestPin: registryPin,
    currentSupportCatalogPin: catalogPin,
    formalPlanPin,
    terminalProgressReceipt,
    installationIdentityGenerationId: INSTALLATION_GENERATION_ID,
    formalMigrationId: FORMAL_MIGRATION_ID,
    sourceProviderId: sourceTombstoneUnsigned.sourceProviderId,
    destinationProviderId: PROVIDER_ID,
    journalRevision: 1,
    strongWriterPublicationCount: 0,
    acceptancePublicationCount: 0,
  };
  const terminalJournal = {
    ...terminalJournalUnsigned,
    closureContentDigest: domainDigestV1(
      "provider-migration-same-installation-identity-terminal-journal-sealed-closure-v1",
      terminalJournalUnsigned,
    ),
  };
  const formalSealedProgressHead = {
    locatorProfile:
      "installation_provider_migration_progress_head_v1" as const,
    migrationId: FORMAL_MIGRATION_ID,
    versionOrdinal: 2,
    headContentDigest: terminalSealedProgressHead.contentDigest,
    currentVersionToken: `hmac-sha256:${"1".repeat(64)}` as const,
    readyToActivateRecord: {
      locatorProfile:
        "installation_provider_migration_progress_record_v1" as const,
      migrationId: FORMAL_MIGRATION_ID,
      recordOrdinal: 2,
      recordId: `provider-migration-progress:${"0".repeat(22)}` as const,
      contentDigest: readyToActivateRecord.contentDigest,
    },
  };
  const formalConfiguration = {
    state: "strong_ready" as const,
    core,
    activation: {
      origin: "completed_provider_migration" as const,
      migrationPlan,
      sealedProgressHead: formalSealedProgressHead,
      migrationHistoryQuotaCommits,
    },
  };
  const referenceConfiguration = {
    state: "strong_ready" as const,
    core,
    activation: {
      origin: "provider_migration_terminal_sealed_success_v1" as const,
      formalMigrationId: FORMAL_MIGRATION_ID,
      formalPlanPin,
      terminalProgressReceiptContentDigest:
        terminalProgressReceipt.receiptContentDigest,
      terminalJournalReceiptContentDigest: terminalJournalReceipt.contentDigest,
      sourceTombstoneRecordContentDigest: sourceTombstoneRecord.contentDigest,
      readyToActivateRecordContentDigest: readyToActivateRecord.contentDigest,
      sealedProgressHeadContentDigest: terminalSealedProgressHead.contentDigest,
    },
  };
  const referenceGenerationId = deriveProviderStrongReadyAcceptanceStateGenerationIdV1({
    installationIdentityGenerationId: INSTALLATION_GENERATION_ID,
    acceptanceOrdinal: 1,
    predecessor: { state: "genesis" },
    configuration: referenceConfiguration,
  });
  const referencePayload = {
    profile: "provider_acceptance_state_v1" as const,
    generationId: referenceGenerationId,
    installationIdentityGenerationId: INSTALLATION_GENERATION_ID,
    acceptanceOrdinal: 1,
    predecessor: { state: "genesis" as const },
    configuration: referenceConfiguration,
    acceptedAt: "2026-08-18T08:00:00Z",
    acceptanceToken: `hmac-sha256:${"a".repeat(64)}`,
  };
  const referenceEnvelope = ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_acceptance_state",
    generationId: referenceGenerationId,
    installationIdentityGenerationId: INSTALLATION_GENERATION_ID,
    acceptedAt: referencePayload.acceptedAt,
    contentDigest: deriveProviderStrongReadyAcceptanceStateContentDigestV1(
      referencePayload,
    ),
    payload: referencePayload,
  });
  const referencePin = {
    locatorProfile: "installation_provider_acceptance_state_v1" as const,
    acceptanceOrdinal: 1,
    generationId: referenceGenerationId,
    contentDigest: referenceEnvelope.contentDigest,
  };
  const formalGenerationId = deriveProviderAcceptanceStateGenerationIdV1({
    installationIdentityGenerationId: INSTALLATION_GENERATION_ID,
    acceptanceOrdinal: 1,
    predecessor: { state: "genesis" },
    configuration: formalConfiguration,
  });
  const formalPayload = {
    profile: "provider_acceptance_state_v1" as const,
    generationId: formalGenerationId,
    installationIdentityGenerationId: INSTALLATION_GENERATION_ID,
    acceptanceOrdinal: 1,
    predecessor: { state: "genesis" as const },
    configuration: formalConfiguration,
    acceptedAt: referencePayload.acceptedAt,
    acceptanceToken: `hmac-sha256:${"b".repeat(64)}`,
  };
  const formalEnvelope = ProviderAcceptanceStateEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_acceptance_state",
    generationId: formalGenerationId,
    installationIdentityGenerationId: INSTALLATION_GENERATION_ID,
    acceptedAt: formalPayload.acceptedAt,
    contentDigest: deriveProviderAcceptanceStateContentDigestV1(formalPayload),
    payload: formalPayload,
  });
  const formalPin = {
    locatorProfile: "installation_provider_acceptance_state_v1" as const,
    acceptanceOrdinal: 1,
    generationId: formalGenerationId,
    contentDigest: formalEnvelope.contentDigest,
  };
  const receipt = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_final_strong_ready_acceptance_compare_append_receipt_v1" as const,
    durability: "in_memory_reference_only_not_a_durable_provider_v1" as const,
    operationNonce: "2".repeat(32),
    requestContentDigest: digestV1("2"),
    resolvedAt: "2026-08-18T08:00:01Z",
    outcome: {
      state: "committed" as const,
      appendedAcceptance: referencePin,
      highWaterRevision: 1,
    },
    receiptContentDigest: digestV1("3"),
  };
  const acceptanceState = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_final_strong_ready_acceptance_compare_append_state_v1" as const,
    durability: "in_memory_reference_only_not_a_durable_provider_v1" as const,
    installationIdentityGenerationId: INSTALLATION_GENERATION_ID,
    highWaterRevision: 1,
    generationCount: 1,
    generationSetDigest: digestV1("4"),
    currentVersionToken: digestV1("5"),
    currentAcceptance: referencePin,
    retiredMigrationOnlyState: { lifecycle: "retired" },
    finalStrongReadyAcceptance: referenceEnvelope,
    receipts: [receipt],
    acceptancePublicationCount: 1,
  };
  const candidate = {
    authority: "none" as const,
    durability: "none" as const,
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_final_strong_ready_acceptance_candidate_validation_v1" as const,
    relationship:
      "exact_terminal_sealed_destination_only_strong_ready_acceptance_candidate_not_appended_v1" as const,
    formalMigrationId: FORMAL_MIGRATION_ID,
    formalPlanPin,
    activeWriterSelector: selector,
    activeWriterSelectorContentDigest:
      deriveProviderActiveWriterSelectorContentDigestV1(selector),
    acceptanceStateEnvelope: referenceEnvelope,
    acceptanceGenerationPin: referencePin,
    destinationOnlyPublicStrongWriter: true as const,
    acceptanceAppendCount: 0,
  };
  const closure = {
    authority:
      "in_memory_reference_machine_only_no_production_provider_authority_v1" as const,
    durability: "in_memory_reference_only_not_a_durable_provider_v1" as const,
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_final_strong_ready_acceptance_reference_validation_v1" as const,
    relationship:
      "exact_terminal_sealed_new_destination_writer_final_strong_ready_acceptance_compare_appended_v1" as const,
    sealedTerminalJournal: terminalJournal,
    candidateValidation: candidate,
    finalStrongReadyAcceptanceEnvelope: referenceEnvelope,
    finalStrongReadyAcceptancePin: referencePin,
    acceptanceCompareAppendReceipt: receipt,
    acceptanceReferenceState: acceptanceState,
    destinationProviderId: PROVIDER_ID,
    sourceWriterRetired: true as const,
    migrationOnlyWriterRetired: true as const,
    destinationOnlyPublicStrongWriter: true as const,
    finalSteadyRegistryAndCatalogBound: true as const,
    formalPlanAndTerminalSealBound: true as const,
    acceptancePublicationCount: 1,
    publicStrongWriterPublicationCount: 1,
  };
  return {
    gateValues: {
      evidence: { pin: evidencePin },
      registry: {
        closure: {
          registryManifestHistoryClosure: {
            installationIdentityGenerationId: INSTALLATION_GENERATION_ID,
            currentRootMetadata: rootPin,
            currentRegistryManifest: registryPin,
          },
          candidateRegistryEntry: {
            installationIdentityGenerationId: INSTALLATION_GENERATION_ID,
            semanticProviderPolicyDigest: POLICY_DIGEST,
            runtimeAttestation: { contentDigest: RUNTIME_ATTESTATION_DIGEST },
            verificationKeys: { activeBindingDerivationKeyGeneration: 1 },
          },
          candidateRegistryEntryContentDigest: REGISTRY_ENTRY_DIGEST,
        },
      },
      catalog: {
        closure: { providerFeasibilitySupportCatalogPin: catalogPin },
      },
    },
    envelope: formalEnvelope,
    pin: formalPin,
    formalPlanDigest,
    artifacts: {
      preparedCatalogSuccessor: {},
      registryManifest: { contentDigest: REGISTRY_DIGEST },
      supportCatalog: { contentDigest: CATALOG_DIGEST },
      formalPlan,
      formalPlanPin,
      formalReservation: {},
      reservationRecord: {},
      compoundPublicationReceipt: {},
      migrationOnlyAcceptance: {},
      rebindingRegistry: {},
      executionProgress: {},
      destinationObjectPublications: [],
      zeroLive: {},
      sourceDrainedRegistry: {},
      steadyRegistry: {},
      terminalJournal,
      finalStrongReadyAcceptance: closure,
    },
  };
}

function liveGateCandidateV1() {
  return {
    status: "live_activation_candidate" as const,
    authority: "none" as const,
    accessMode: "read_only" as const,
    strongWriteStatus: "locked" as const,
    requiredNext: "provider_acceptance_current_and_os_peer_gate" as const,
    bindings: {
      providerId: PROVIDER_ID,
      targetProfileId: TARGET_PROFILE_ID,
      installationIdentityDigest: INSTALLATION_DIGEST,
      binaryDigest: BINARY_DIGEST,
      capabilityDigest: CAPABILITY_DIGEST,
      targetFingerprintDigest: TARGET_FINGERPRINT_DIGEST,
      conformanceResultId: "provider-real-fs-result:fixture",
      conformanceContentDigest: digestV1("6"),
      evidenceId: `provider-feasibility-evidence:${"3".repeat(22)}`,
      evidenceContentDigest: EVIDENCE_DIGEST,
      catalogContentDigest: CATALOG_DIGEST,
      gateStatus: "candidate_ready" as const,
      gateAuthority: "none" as const,
      gateAccessMode: "read_only" as const,
      gateStrongWriteStatus: "locked" as const,
      liveStatus: "live_candidate" as const,
      liveAuthority: "read_only" as const,
      liveStrongWrites: "locked" as const,
      inspectedRevision: 1,
    },
  };
}

async function runFixtureV1(
  mutateArtifacts?: (artifacts: Record<string, unknown>) => void,
) {
  const root = await mkdtemp(join(tmpdir(), "uc-acceptance-current-"));
  roots.add(root);
  await chmod(root, 0o700);
  const socketPath = join(root, "runtime.sock");
  const authKeyPath = join(root, "auth.key");
  const authKey = randomBytes(32);
  await writeFile(authKeyPath, authKey, { mode: 0o600 });

  const current = currentArtifactsV1();
  const artifacts = structuredClone(current.artifacts) as Record<string, unknown>;
  mutateArtifacts?.(artifacts);
  const store = new DurableObjectProviderRuntimeStoreV1({
    rootPath: root,
    providerId: PROVIDER_ID,
  });
  await store.initialize();
  await store.compareCommit({
    expectedRevision: 0,
    operationNonce: "1".repeat(32),
    phase: "final_strong_ready",
    artifacts: artifacts as never,
  });

  const server = new DurableObjectProviderRuntimeServerV1({
    rootPath: root,
    socketPath,
    providerId: PROVIDER_ID,
    authKey,
    authorizedCapabilityDigest: CAPABILITY_DIGEST,
  });
  await server.start();
  servers.add(server);

  const signingKey = generateProviderServiceSigningKeyPairV1().privateKey;
  const config = createProviderServiceHandoffConfigV1({
    privateKey: signingKey,
    payload: {
      schemaVersion: 1,
      profile: "understand_code_provider_service_handoff_payload_v1",
      platform: process.platform === "darwin" ? "darwin" : "linux",
      serviceLabel: "acceptance-current-test",
      providerId: PROVIDER_ID,
      principal: {
        kind: "dedicated_os_principal",
        name: "acceptance_current_test",
        uid: process.getuid!(),
        gid: process.getgid!(),
      },
      runtimeRoot: root,
      socketPath,
      executablePath: process.execPath,
      configPath: join(root, "service.json"),
      authKeyPath,
      readinessPath: join(root, "readiness.json"),
      signingKeyPath: join(root, "signing.key"),
      installationIdentityDigest: INSTALLATION_DIGEST,
      binaryDigest: BINARY_DIGEST,
      capabilityDigest: CAPABILITY_DIGEST,
    },
  });

  liveGateMock.mockResolvedValueOnce({ ok: true, value: liveGateCandidateV1() });
  targetContinuityMock.mockResolvedValueOnce({
    targetFingerprintDigest: TARGET_FINGERPRINT_DIGEST,
  });
  return diagnoseProviderRuntimeDurableAcceptanceCurrentV1({
    liveGateBinding: {
      config,
      authKey,
      targetBaseline: {} as never,
      gateValues: current.gateValues as never,
      expectedInstallationIdentityDigest: INSTALLATION_DIGEST,
      expectedBinaryDigest: BINARY_DIGEST,
      expectedCapabilityDigest: CAPABILITY_DIGEST,
      expectedTargetFingerprintDigest: TARGET_FINGERPRINT_DIGEST,
    },
  });
}

describe("durable Acceptance-current authenticated IPC binding", () => {
  it("observes final_strong_ready over authenticated inspect_state and binds current Acceptance", async () => {
    const expectedFormalPlanDigest = currentArtifactsV1().formalPlanDigest;
    await expect(runFixtureV1()).resolves.toMatchObject({
      ok: true,
      value: {
        status: "durable_acceptance_current_candidate",
        authority: "none",
        strongWriteStatus: "locked",
        requiredNext: "acceptance_identity_token_and_os_peer_gate",
        bindings: {
          providerId: PROVIDER_ID,
          targetProfileId: TARGET_PROFILE_ID,
          registryManifestContentDigest: REGISTRY_DIGEST,
          supportCatalogContentDigest: CATALOG_DIGEST,
          formalPlanContentDigest: expectedFormalPlanDigest,
          journalRevision: 1,
          liveInspectedRevision: 1,
        },
      },
    });
  });

  it("keeps the exact lifecycle basis current with one namespaced business head", async () => {
    await expect(runFixtureV1((artifacts) => {
      artifacts[PROVIDER_RUNTIME_DURABLE_BUSINESS_HEAD_ARTIFACT_KEY_V1] = {
        profile: PROVIDER_RUNTIME_DURABLE_BUSINESS_HEAD_PROFILE_V1,
        phase: "strong_change_check_v1",
        artifacts: { requestDigest: digestV1("f") },
      };
    })).resolves.toMatchObject({
      ok: true,
      value: {
        status: "durable_acceptance_current_candidate",
        bindings: { journalRevision: 1 },
      },
    });
  });

  it("bridges an equivalent current formal Acceptance successor", () => {
    const current = currentArtifactsV1();
    const predecessor = {
      state: "acceptance" as const,
      generationId: current.envelope.generationId,
      contentDigest: current.envelope.contentDigest,
    };
    const acceptedAt = "2026-08-18T08:00:01Z";
    const generationId = deriveProviderAcceptanceStateGenerationIdV1({
      installationIdentityGenerationId: INSTALLATION_GENERATION_ID,
      acceptanceOrdinal: 2,
      predecessor,
      configuration: current.envelope.payload.configuration,
    });
    const payload = {
      ...structuredClone(current.envelope.payload),
      generationId,
      acceptanceOrdinal: 2,
      predecessor,
      acceptedAt,
      acceptanceToken: `hmac-sha256:${"c".repeat(64)}` as const,
    };
    const envelope = ProviderAcceptanceStateEnvelopeV1Schema.parse({
      ...structuredClone(current.envelope),
      generationId,
      acceptedAt,
      contentDigest: deriveProviderAcceptanceStateContentDigestV1(payload),
      payload,
    });
    const pin = {
      locatorProfile: "installation_provider_acceptance_state_v1" as const,
      acceptanceOrdinal: 2,
      generationId,
      contentDigest: envelope.contentDigest,
    };
    const projected = projectProviderRuntimeDurableLifecycleArtifactsV1({
      journalState: {
        profile: "provider_runtime_durable_journal_state_v1",
        revision: 1,
        phase: "final_strong_ready",
        operationNonce: "f".repeat(32),
        mutationDigest: digestV1("f"),
        artifacts: current.artifacts,
      },
      expectedAcceptanceEnvelope: envelope,
      expectedAcceptancePin: pin,
    });
    expect(Object.keys(projected.lifecycleArtifacts)).toHaveLength(17);
  });

  it("projects A-B-A from the immutable 17-artifact basis without retaining B", () => {
    const current = currentArtifactsV1();
    const wrap = (label: "a" | "b") => ({
      ...structuredClone(current.artifacts),
      [PROVIDER_RUNTIME_DURABLE_BUSINESS_HEAD_ARTIFACT_KEY_V1]: {
        profile: PROVIDER_RUNTIME_DURABLE_BUSINESS_HEAD_PROFILE_V1,
        phase: "strong_change_check_v1" as const,
        artifacts: { label },
      },
    });
    const firstA = projectProviderRuntimeDurableLifecycleArtifactsV1({
      journalState: {
        profile: "provider_runtime_durable_journal_state_v1",
        revision: 2,
        phase: "final_strong_ready",
        operationNonce: "a".repeat(32),
        mutationDigest: digestV1("a"),
        artifacts: wrap("a"),
      },
      expectedAcceptanceEnvelope: current.envelope,
      expectedAcceptancePin: current.pin,
    });
    const projectedB = projectProviderRuntimeDurableLifecycleArtifactsV1({
      journalState: {
        ...firstA.state,
        revision: 3,
        operationNonce: "b".repeat(32),
        mutationDigest: digestV1("b"),
        artifacts: wrap("b"),
      },
      expectedAcceptanceEnvelope: current.envelope,
      expectedAcceptancePin: current.pin,
    });
    const rebuiltA = {
      ...projectedB.lifecycleArtifacts,
      [PROVIDER_RUNTIME_DURABLE_BUSINESS_HEAD_ARTIFACT_KEY_V1]: {
        profile: PROVIDER_RUNTIME_DURABLE_BUSINESS_HEAD_PROFILE_V1,
        phase: "strong_change_check_v1" as const,
        artifacts: { label: "a" },
      },
    };
    expect(rebuiltA).toEqual(wrap("a"));
    expect(Object.keys(projectedB.lifecycleArtifacts)).toHaveLength(17);
  });

  it("rejects terminal-record and full-Plan payload tampering by domain digest", () => {
    const current = currentArtifactsV1();
    const journalState = (artifacts: unknown) => ({
      profile: "provider_runtime_durable_journal_state_v1" as const,
      revision: 1,
      phase: "final_strong_ready" as const,
      operationNonce: "f".repeat(32),
      mutationDigest: digestV1("f"),
      artifacts,
    });
    const terminalTamper = structuredClone(current.artifacts) as Record<
      string,
      any
    >;
    terminalTamper.terminalJournal.sourceTombstoneRecord.reason =
      "forged_after_seal";
    expect(() => projectProviderRuntimeDurableLifecycleArtifactsV1({
      journalState: journalState(terminalTamper),
      expectedAcceptanceEnvelope: current.envelope,
      expectedAcceptancePin: current.pin,
    })).toThrow(/terminal Journal record digest is invalid/u);

    const planTamper = structuredClone(current.artifacts) as Record<
      string,
      any
    >;
    planTamper.formalPlan.payload.reason = "forged_after_plan";
    expect(() => projectProviderRuntimeDurableLifecycleArtifactsV1({
      journalState: journalState(planTamper),
      expectedAcceptanceEnvelope: current.envelope,
      expectedAcceptancePin: current.pin,
    })).toThrow(/stored formal Plan Envelope or Pin is invalid/u);
  });

  it.each([
    ["namespace", (plan: any) => {
      plan.payload.sourceNamespace.unexpectedAuthority = "forged";
    }],
    ["trust", (plan: any) => {
      plan.payload.sourceTrust.unexpectedAuthority = "forged";
    }],
    ["admission", (plan: any) => {
      plan.payload.migrationHistoryQuotaAdmission.unexpectedAuthority =
        "forged";
    }],
    ["reservation", (plan: any) => {
      plan.payload.migrationHistoryQuotaReservations.journal
        .unexpectedAuthority = "forged";
    }],
  ])("rejects official full-Plan %s nested-shape tampering", (_label, mutate) => {
    const plan = structuredClone(OFFICIAL_FORMAL_PLAN);
    mutate(plan);
    expect(() =>
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1Schema.parse(
        plan,
      )
    ).toThrow();
  });

  it("rejects a missing lifecycle artifact before the first final-ready commit", async () => {
    await expect(runFixtureV1((artifacts) => {
      delete artifacts.finalStrongReadyAcceptance;
    })).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("rejects a tampered final Acceptance artifact", async () => {
    await expect(runFixtureV1((artifacts) => {
      const closure = artifacts.finalStrongReadyAcceptance as Record<string, unknown>;
      const envelope = closure.finalStrongReadyAcceptanceEnvelope as Record<string, unknown>;
      envelope.contentDigest = digestV1("f");
    })).resolves.toEqual({
      ok: false,
      code: "provider_unavailable",
      reason: "attestation_invalid",
      stage: "acceptance_current",
    });
  });
});
