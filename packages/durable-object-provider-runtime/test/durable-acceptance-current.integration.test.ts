import { randomBytes } from "node:crypto";
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
import {
  ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
  deriveProviderActiveWriterSelectorContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
} from "@understand-code/durable-object-provider-contracts/provider-strong-ready-acceptance-candidate";

import {
  diagnoseProviderRuntimeDurableAcceptanceCurrentV1,
} from "../src/durable-acceptance-current.js";
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
const INSTALLATION_GENERATION_ID =
  `installation-identity-generation:${"a".repeat(22)}`;
const FORMAL_MIGRATION_ID = `provider-migration:${"b".repeat(22)}`;

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
const FORMAL_PLAN_DIGEST = digestV1("c");

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
  const formalPlanPin = {
    locatorProfile:
      "provider_migration_same_installation_identity_current_strong_source_normal_formal_plan_reference_candidate_v1" as const,
    formalMigrationId: FORMAL_MIGRATION_ID,
    contentDigest: FORMAL_PLAN_DIGEST,
  };
  const configuration = {
    state: "strong_ready" as const,
    core: {
      activeRootMetadata: rootPin,
      providerRegistryManifest: registryPin,
      providerSupportCatalog: catalogPin,
      activeWriterSelector: selector,
    },
    activation: {
      origin: "provider_migration_terminal_sealed_success_v1" as const,
      formalMigrationId: FORMAL_MIGRATION_ID,
      formalPlanPin,
      terminalProgressReceiptContentDigest: digestV1("d"),
      terminalJournalReceiptContentDigest: digestV1("e"),
      sourceTombstoneRecordContentDigest: digestV1("f"),
      readyToActivateRecordContentDigest: digestV1("0"),
      sealedProgressHeadContentDigest: digestV1("1"),
    },
  };
  const generationId = deriveProviderStrongReadyAcceptanceStateGenerationIdV1({
    installationIdentityGenerationId: INSTALLATION_GENERATION_ID,
    acceptanceOrdinal: 1,
    predecessor: { state: "genesis" },
    configuration,
  });
  const payload = {
    profile: "provider_acceptance_state_v1" as const,
    generationId,
    installationIdentityGenerationId: INSTALLATION_GENERATION_ID,
    acceptanceOrdinal: 1,
    predecessor: { state: "genesis" as const },
    configuration,
    acceptedAt: "2026-08-18T08:00:00Z",
    acceptanceToken: `hmac-sha256:${"a".repeat(64)}`,
  };
  const envelope = ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_acceptance_state",
    generationId,
    installationIdentityGenerationId: INSTALLATION_GENERATION_ID,
    acceptedAt: payload.acceptedAt,
    contentDigest: deriveProviderStrongReadyAcceptanceStateContentDigestV1(payload),
    payload,
  });
  const pin = {
    locatorProfile: "installation_provider_acceptance_state_v1" as const,
    acceptanceOrdinal: 1,
    generationId,
    contentDigest: envelope.contentDigest,
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
      appendedAcceptance: pin,
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
    currentAcceptance: pin,
    retiredMigrationOnlyState: { lifecycle: "retired" },
    finalStrongReadyAcceptance: envelope,
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
    acceptanceStateEnvelope: envelope,
    acceptanceGenerationPin: pin,
    destinationOnlyPublicStrongWriter: true as const,
    acceptanceAppendCount: 0,
  };
  const terminalJournal = { profile: "terminal-journal-fixture-v1" };
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
    finalStrongReadyAcceptanceEnvelope: envelope,
    finalStrongReadyAcceptancePin: pin,
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
    envelope,
    artifacts: {
      preparedCatalogSuccessor: {},
      registryManifest: { contentDigest: REGISTRY_DIGEST },
      supportCatalog: { contentDigest: CATALOG_DIGEST },
      formalPlan: { contentDigest: FORMAL_PLAN_DIGEST },
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
          formalPlanContentDigest: FORMAL_PLAN_DIGEST,
          journalRevision: 1,
          liveInspectedRevision: 1,
        },
      },
    });
  });

  it.each([
    ["missing", (artifacts: Record<string, unknown>) => {
      delete artifacts.finalStrongReadyAcceptance;
    }],
    ["tampered", (artifacts: Record<string, unknown>) => {
      const closure = artifacts.finalStrongReadyAcceptance as Record<string, unknown>;
      const envelope = closure.finalStrongReadyAcceptanceEnvelope as Record<string, unknown>;
      envelope.contentDigest = digestV1("f");
    }],
  ])("rejects a %s final Acceptance artifact", async (_label, mutate) => {
    await expect(runFixtureV1(mutate)).resolves.toEqual({
      ok: false,
      code: "provider_unavailable",
      reason: "attestation_invalid",
      stage: "acceptance_current",
    });
  });
});
