/*
 * Step15-A production composition smoke.  This is deliberately a Linux-only
 * subprocess harness: root creates the signed installation fixture and starts
 * the real root authority broker; a dedicated runtime principal owns the
 * runtime/ext4 object tree; an unrelated caller reaches it only through the
 * tracked public gateway/client.  The authority fixture uses the existing
 * signed Registry golden history and the real Acceptance/broker stores.  It is
 * not a systemd installer test; service lifecycle is represented by the three
 * real OS processes and a restart of both runtime and gateway.
 */

import {
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign,
} from "node:crypto";
import {
  access,
  chmod,
  chown,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  statfs,
  symlink,
  writeFile,
} from "node:fs/promises";
import { constants as fsConstants, readFileSync } from "node:fs";
import { execFile, spawn } from "node:child_process";
import { userInfo } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  canonicalizeJcsSafeIntegerV1,
} from "@understand-code/durable-object-provider-contracts/jcs";
import {
  ProviderAcceptanceCompareAppendRequestV1Schema,
  ProviderAcceptanceStateEnvelopeV1Schema,
  createProviderAcceptanceStateTokenMessageV1,
  deriveProviderAcceptanceStateContentDigestV1,
  deriveProviderAcceptanceStateGenerationIdV1,
} from "@understand-code/durable-object-provider-contracts/provider-acceptance";
import {
  ProviderRegistryManifestEnvelopeV1Schema,
  ProviderRegistryManifestV1Schema,
  StoreDurableObjectProviderRegistryEntryUnsignedClaimsV1Schema,
  StoreDurableObjectProviderRegistryEntryV1Schema,
  StoreDurableObjectProviderVerificationPublicKeyV1Schema,
  createProviderRegistryManifestSignatureMessageV1,
  createStoreDurableObjectProviderRegistryEntrySignatureMessageV1,
  createStoreDurableObjectProviderVerificationPublicKeySignatureMessageV1,
  deriveProviderRegistryManifestContentDigestV1,
  deriveProviderRegistryManifestGenerationIdV1,
  deriveStoreDurableObjectProviderRegistryEntryContentDigestV1,
  deriveStoreProviderVerificationKeyIdV1,
} from "@understand-code/durable-object-provider-contracts/provider-registry";
import {
  ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
  deriveProviderActiveWriterSelectorContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
} from "@understand-code/durable-object-provider-contracts/provider-strong-ready-acceptance-candidate";
import {
  deriveInstallationIdentityGenerationIdV1,
  deriveInstallationIdentityKeyCheckTokenV1,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1Schema,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinV1,
} from "@understand-code/durable-object-provider-contracts";
import {
  InstallationIdentityGenerationIdV1Schema,
  KeyedStateTokenV1Schema,
} from "@understand-code/durable-object-provider-contracts/primitives";
import {
  createProviderServiceHandoffConfigV1,
  createProviderServiceReadinessReceiptV1,
} from "@understand-code/durable-object-provider-runtime/service-handoff";
import {
  PROVIDER_PRODUCTION_STRONG_CLIENT_TRUST_FILE_V1,
  installProviderProductionStrongClientTrustV1,
  providerProductionStrongClientDescriptorPathV1,
  providerProductionStrongClientGatewaySocketPathV1,
  rollbackProviderProductionStrongClientTrustV1,
  rotateProviderProductionStrongClientTrustV1,
  uninstallProviderProductionStrongClientTrustV1,
} from "@understand-code/durable-object-provider-runtime/provider-production-strong-client-trust-lifecycle";
import {
  openProviderProductionStrongObjectClientV1,
  startProviderProductionStrongObjectGatewayServiceV1,
} from "@understand-code/durable-object-provider-client";
import { DurableObjectProviderRuntimeServerV1 } from "@understand-code/durable-object-provider-runtime/server";
import {
  projectProviderRuntimeDurableLifecycleArtifactsV1,
} from "@understand-code/durable-object-provider-runtime/durable-acceptance-current";
import {
  closeProviderRuntimeNativeExactObjectPublisherV1,
  closeProviderRuntimeNativeExactObjectSourceV1,
  commitProviderRuntimeNativeExactObjectV1,
  openProviderRuntimeNativeExactObjectPublisherV1,
  stageProviderRuntimeNativeExactObjectV1,
} from "@understand-code/native-kernel-bridge";
import {
  createProviderRuntimeStrongMutationBrokerVerifierInternalV1,
} from "../../durable-object-provider-runtime/dist/strong-mutation-broker-client-internal.js";

const PROVIDER_ID = "durable-object-provider:native-b";
const TARGET_PROFILE_ID = `provider-target-profile:${"a".repeat(64)}`;
const TARGET_FINGERPRINT_DIGEST = `sha256:${"c".repeat(64)}`;
const CAPABILITY_DIGEST = `sha256:${"1".repeat(64)}`;
const SERVICE_UID = 42001;
const SERVICE_GID = 42002;
const CALLER_UID = 42003;
const CALLER_GID = 42004;
const BAD_CALLER_UID = 42005;
const BAD_CALLER_GID = 42006;
const IDENTITY_NONCE = "a1".repeat(16);
const IDENTITY_KEY = Uint8Array.from({ length: 32 }, (_v, i) => i);
const GRANT_SEED = 0x41;
const SERVICE_SEED = 0x51;
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(SCRIPT_PATH), "../../..");
const FORMAL_PLAN_FIXTURE_PATH = join(
  dirname(SCRIPT_PATH),
  "fixtures/provider-migration-formal-plan-reference-candidate-v1.json",
);
const FORMAL_PLAN =
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1Schema.parse(
    JSON.parse(readFileSync(FORMAL_PLAN_FIXTURE_PATH, "utf8")),
  );
const FORMAL_PLAN_PIN =
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinV1(
    FORMAL_PLAN,
  );
const FORMAL_MIGRATION_ID = FORMAL_PLAN.migrationId;
const FORMAL_PLAN_DIGEST = FORMAL_PLAN.contentDigest;
const REGISTRY_FIXTURE_PATH = join(
  REPO_ROOT,
  "packages/durable-object-provider-contracts/fixtures/v1/golden/provider-registry-entry-manifest-history-v1.json",
);
const ALPHA_GOLD_CORPUS_PATH = join(
  REPO_ROOT,
  "packages/contracts/fixtures/v1/golden/alpha-gold-task-corpus-v1.json",
);
const PREVIEW_PLUGIN_E2E_PATH = join(
  REPO_ROOT,
  "packages/preview/test/plugin-clean-install.test.mjs",
);
const execFileAsync = promisify(execFile);

function privateKey(seed) {
  return createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      Buffer.alloc(32, seed),
    ]),
    format: "der",
    type: "pkcs8",
  });
}

function publicSpki(key) {
  return `base64url:${Buffer.from(
    createPublicKey(key).export({ format: "der", type: "spki" }),
  ).toString("base64url")}`;
}

function rawPublic(key) {
  const spki = Buffer.from(createPublicKey(key).export({ format: "der", type: "spki" }));
  return `base64url:${spki.subarray(-32).toString("base64url")}`;
}

function digestBytes(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function digestValue(value) {
  return digestBytes(Buffer.from(canonicalizeJcsSafeIntegerV1(value), "utf8"));
}

function domainDigest(domain, value) {
  return digestValue([domain, value]);
}

function rootPrivate(fixture) {
  return privateKey(Buffer.from(
    fixture.deterministicSeeds.rootHistoryDependencySeeds.compromiseRootSeedHex,
    "hex",
  ));
}

function rootId(fixture) {
  return fixture.rootMetadataHistory.at(-1).rootKeyId;
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function clone(value) {
  return structuredClone(value);
}

function createGrantKeyRecord(fixture, generation, seed) {
  const key = privateKey(seed);
  const publicKeyBytes = rawPublic(key);
  const unsigned = {
    profile: "store_durable_object_provider_verification_public_key_v1",
    providerId: PROVIDER_ID,
    registryGenerationIntroduced: generation,
    keyId: deriveStoreProviderVerificationKeyIdV1({
      providerId: PROVIDER_ID,
      usage: "strong_mutation_authority_grant",
      publicKeyBytes,
    }),
    usage: "strong_mutation_authority_grant",
    algorithm: "ed25519",
    publicKeyBytes,
    publicKeyDigest: digestBytes(Buffer.from(publicKeyBytes.slice("base64url:".length), "base64url")),
  };
  return StoreDurableObjectProviderVerificationPublicKeyV1Schema.parse({
    ...unsigned,
    registrySignature: `provider-registry-ed25519:${rootId(fixture)}:${sign(null, Buffer.from(createStoreDurableObjectProviderVerificationPublicKeySignatureMessageV1(unsigned, rootId(fixture))), rootPrivate(fixture)).toString("hex")}`,
  });
}

function appendGrantManifest(fixture) {
  const history = clone(fixture.registryManifestHistory);
  const previous = history.at(-1);
  const member = previous.payload.members.find(
    (candidate) => candidate.providerId === PROVIDER_ID && candidate.disposition === "enabled",
  );
  if (member === undefined) throw new Error("enabled Registry member missing");
  const previousEntry = member.registryEntry;
  const generation = previousEntry.registryGeneration + 1;
  const grantKey = createGrantKeyRecord(fixture, generation, GRANT_SEED);
  const { registrySignature: _oldSignature, ...unsignedPrevious } = previousEntry;
  const entryCandidate = clone({
    ...unsignedPrevious,
    registryGeneration: generation,
    predecessorRegistryEntryContentDigest:
      deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(previousEntry),
  });
  entryCandidate.verificationKeys.publicKeyRecords.push(grantKey);
  entryCandidate.verificationKeys.publicKeyRecords.sort((a, b) =>
    compareUtf8(a.providerId, b.providerId) || compareUtf8(a.usage, b.usage) || compareUtf8(a.keyId, b.keyId));
  entryCandidate.verificationKeys.activeKeyIds.strongMutationAuthorityGrant = grantKey.keyId;
  const entryUnsigned = StoreDurableObjectProviderRegistryEntryUnsignedClaimsV1Schema.parse(entryCandidate);
  const entry = StoreDurableObjectProviderRegistryEntryV1Schema.parse({
    ...entryUnsigned,
    registrySignature: `provider-registry-ed25519:${rootId(fixture)}:${sign(null, Buffer.from(createStoreDurableObjectProviderRegistryEntrySignatureMessageV1(entryUnsigned, rootId(fixture))), rootPrivate(fixture)).toString("hex")}`,
  });
  const members = previous.payload.members.map((candidate) => candidate.providerId === PROVIDER_ID && candidate.disposition === "enabled"
    ? { ...candidate, registryEntryContentDigest: deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(entry), registryEntry: entry }
    : candidate);
  const idFields = {
    installationIdentityGenerationId: previous.payload.installationIdentityGenerationId,
    activeRootMetadata: previous.payload.activeRootMetadata,
    manifestGeneration: previous.payload.manifestGeneration + 1,
    predecessor: { state: "manifest", generationId: previous.generationId, contentDigest: previous.contentDigest },
    members,
    routing: previous.payload.routing,
  };
  const generationId = deriveProviderRegistryManifestGenerationIdV1(idFields);
  const unsignedManifest = { profile: "provider_registry_manifest_v1", generationId, ...idFields, issuedAt: "2026-08-26T00:00:00Z" };
  const manifestPayload = ProviderRegistryManifestV1Schema.parse({
    ...unsignedManifest,
    manifestSignature: `provider-registry-manifest-ed25519:${rootId(fixture)}:${sign(null, Buffer.from(createProviderRegistryManifestSignatureMessageV1(unsignedManifest, rootId(fixture))), rootPrivate(fixture)).toString("hex")}`,
  });
  const envelope = ProviderRegistryManifestEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_registry_manifest",
    generationId,
    contentDigest: deriveProviderRegistryManifestContentDigestV1(manifestPayload),
    payload: manifestPayload,
  });
  return { history: [...history, envelope], grantKey };
}

function trustedCore(fixture, history) {
  const current = history.at(-1);
  const member = current.payload.members.find(
    (candidate) =>
      candidate.providerId === PROVIDER_ID &&
      candidate.disposition === "enabled",
  );
  if (member === undefined) throw new Error("enabled Registry member missing");
  const entry = member.registryEntry;
  return {
    activeRootMetadata: current.payload.activeRootMetadata,
    providerRegistryManifest: {
      locatorProfile: "installation_provider_registry_manifest_v1",
      manifestGeneration: current.payload.manifestGeneration,
      generationId: current.generationId,
      contentDigest: current.contentDigest,
    },
    providerSupportCatalog: {
      locatorProfile: "distribution_provider_feasibility_support_catalog_v1",
      catalogGeneration: 1,
      contentDigest: `sha256:${"9".repeat(64)}`,
    },
    activeWriterSelector: {
      profile: "provider_active_writer_selector_v1",
      selections: [{
        targetProfileId: TARGET_PROFILE_ID,
        providerId: PROVIDER_ID,
        registryEntryContentDigest: member.registryEntryContentDigest,
        semanticProviderPolicyDigest: entry.semanticProviderPolicyDigest,
        providerFeasibilityEvidence: entry.providerFeasibilityEvidence,
        runtimeAttestationContentDigest: entry.runtimeAttestation.contentDigest,
        bindingDerivationKeyGeneration:
          entry.verificationKeys.activeBindingDerivationKeyGeneration,
      }],
    },
  };
}

function formalAcceptanceEnvelopeV1({
  configuration,
  installationIdentityGenerationId,
  acceptanceOrdinal,
  predecessor,
  acceptedAt,
}) {
  const generationId = deriveProviderAcceptanceStateGenerationIdV1({
    installationIdentityGenerationId,
    acceptanceOrdinal,
    predecessor,
    configuration,
  });
  const unsigned = {
    profile: "provider_acceptance_state_v1",
    generationId,
    installationIdentityGenerationId,
    acceptanceOrdinal,
    predecessor,
    configuration,
    acceptedAt,
  };
  const payload = {
    ...unsigned,
    acceptanceToken: `hmac-sha256:${createHmac("sha256", IDENTITY_KEY)
      .update(createProviderAcceptanceStateTokenMessageV1(unsigned))
      .digest("hex")}`,
  };
  return ProviderAcceptanceStateEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_acceptance_state",
    generationId,
    installationIdentityGenerationId,
    acceptedAt,
    contentDigest: deriveProviderAcceptanceStateContentDigestV1(payload),
    payload,
  });
}

function referenceAcceptanceEnvelopeV1({
  configuration,
  installationIdentityGenerationId,
  acceptedAt,
}) {
  const predecessor = { state: "genesis" };
  const generationId = deriveProviderStrongReadyAcceptanceStateGenerationIdV1({
    installationIdentityGenerationId,
    acceptanceOrdinal: 1,
    predecessor,
    configuration,
  });
  const payload = {
    profile: "provider_acceptance_state_v1",
    generationId,
    installationIdentityGenerationId,
    acceptanceOrdinal: 1,
    predecessor,
    configuration,
    acceptedAt,
    acceptanceToken: `hmac-sha256:${"a".repeat(64)}`,
  };
  return ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_acceptance_state",
    generationId,
    installationIdentityGenerationId,
    acceptedAt,
    contentDigest:
      deriveProviderStrongReadyAcceptanceStateContentDigestV1(payload),
    payload,
  });
}

function terminalLifecycleV1(core, installationIdentityGenerationId) {
  if (
    FORMAL_PLAN.payload.journalAuthorityInstallationIdentityGenerationId !==
      installationIdentityGenerationId
  ) throw new Error("official formal Plan Identity does not match Registry");
  const formalPlan = clone(FORMAL_PLAN);
  const formalPlanPin = clone(FORMAL_PLAN_PIN);
  const terminalProgressUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_execution_progress_receipt_v1",
    durability:
      "in_memory_execution_progress_reference_only_not_a_durable_provider_v1",
    resolution: "committed",
    operationNonce: "d".repeat(32),
    requestContentDigest: `sha256:${"d".repeat(64)}`,
    linearizationOrdinal: 1,
    progressRecord: { phase: "completed" },
    destinationObjectPublication: "none",
    committedHighWater: { phase: "completed" },
  };
  const terminalProgressReceipt = {
    ...terminalProgressUnsigned,
    receiptContentDigest: domainDigest(
      "provider-migration-same-installation-identity-execution-progress-receipt-v1",
      terminalProgressUnsigned,
    ),
  };
  const sourceTombstoneUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_source_tombstone_record_v1",
    journalOrdinal: 1,
    installationIdentityGenerationId,
    formalMigrationId: FORMAL_MIGRATION_ID,
    sourceProviderId: "durable-object-provider:native-a",
    steadyRegistryManifestPin: core.providerRegistryManifest,
    lastEnabledRegistryEntryContentDigest: `sha256:${"8".repeat(64)}`,
    revokedAtManifestGeneration: core.providerRegistryManifest.manifestGeneration,
    reason: "migration_completed",
    zeroLiveProofContentDigest: `sha256:${"e".repeat(64)}`,
    terminalProgressReceiptContentDigest:
      terminalProgressReceipt.receiptContentDigest,
    relationship:
      "steady_registry_revoked_source_member_bound_to_exact_zero_live_terminal_progress_v1",
  };
  const sourceTombstoneRecord = {
    ...sourceTombstoneUnsigned,
    contentDigest: domainDigest(
      "provider-migration-same-installation-identity-terminal-source-tombstone-record-v1",
      sourceTombstoneUnsigned,
    ),
  };
  const readyUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_ready_to_activate_record_v1",
    journalOrdinal: 2,
    state: "ready_to_activate",
    installationIdentityGenerationId,
    formalMigrationId: FORMAL_MIGRATION_ID,
    destinationProviderId: PROVIDER_ID,
    steadyRegistryManifestPin: core.providerRegistryManifest,
    currentSupportCatalogPin: core.providerSupportCatalog,
    formalPlanPin,
    sourceTombstoneRecordContentDigest: sourceTombstoneRecord.contentDigest,
    terminalProgressReceiptContentDigest:
      terminalProgressReceipt.receiptContentDigest,
    relationship:
      "terminal_metadata_ready_for_final_strong_activation_not_activated_v1",
  };
  const readyToActivateRecord = {
    ...readyUnsigned,
    contentDigest: domainDigest(
      "provider-migration-same-installation-identity-terminal-ready-to-activate-record-v1",
      readyUnsigned,
    ),
  };
  const sealedUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_sealed_progress_head_v1",
    journalOrdinal: 3,
    state: "sealed",
    journalRevision: 1,
    steadyRegistryManifestPin: core.providerRegistryManifest,
    formalPlanPin,
    terminalProgressReceiptContentDigest:
      terminalProgressReceipt.receiptContentDigest,
    destinationUniverseContentDigest: `sha256:${"f".repeat(64)}`,
    completeDestinationPublicationReceiptSetDigest: `sha256:${"0".repeat(64)}`,
    zeroLiveProofContentDigest: sourceTombstoneUnsigned.zeroLiveProofContentDigest,
    sourceTombstoneRecordContentDigest: sourceTombstoneRecord.contentDigest,
    readyToActivateRecordContentDigest: readyToActivateRecord.contentDigest,
    relationship:
      "terminal_metadata_progress_head_sealed_before_final_acceptance_v1",
  };
  const sealedProgressHead = {
    ...sealedUnsigned,
    contentDigest: domainDigest(
      "provider-migration-same-installation-identity-terminal-sealed-progress-head-v1",
      sealedUnsigned,
    ),
  };
  const journalReceiptUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_terminal_journal_seal_receipt_v1",
    durability:
      "in_memory_terminal_journal_reference_only_not_a_durable_provider_v1",
    status: "committed",
    operationNonce: "e".repeat(32),
    requestContentDigest: `sha256:${"1".repeat(64)}`,
    previousJournalRevision: 0,
    committedJournalRevision: 1,
    sourceTombstoneRecordContentDigest: sourceTombstoneRecord.contentDigest,
    readyToActivateRecordContentDigest: readyToActivateRecord.contentDigest,
    sealedProgressHeadContentDigest: sealedProgressHead.contentDigest,
  };
  const terminalJournalReceipt = {
    ...journalReceiptUnsigned,
    contentDigest: domainDigest(
      "provider-migration-same-installation-identity-terminal-journal-receipt-v1",
      journalReceiptUnsigned,
    ),
  };
  const terminalUnsigned = {
    authority:
      "in_memory_metadata_reference_only_no_real_provider_bytes_or_io_proof_v1",
    durability:
      "in_memory_terminal_journal_reference_only_not_a_durable_provider_v1",
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_terminal_journal_sealed_validation_v1",
    relationship:
      "exact_steady_registry_source_tombstone_ready_to_activate_and_progress_head_atomically_sealed_v1",
    steadyRegistryCompletion: { state: "completed" },
    sourceTombstoneRecord,
    readyToActivateRecord,
    sealedProgressHead,
    terminalJournalReceipt,
    terminalJournalReceiptContentDigest: terminalJournalReceipt.contentDigest,
    currentRegistryManifestEnvelope: {
      contentDigest: core.providerRegistryManifest.contentDigest,
    },
    currentRegistryManifestPin: core.providerRegistryManifest,
    currentSupportCatalogPin: core.providerSupportCatalog,
    formalPlanPin,
    terminalProgressReceipt,
    installationIdentityGenerationId,
    formalMigrationId: FORMAL_MIGRATION_ID,
    sourceProviderId: sourceTombstoneUnsigned.sourceProviderId,
    destinationProviderId: PROVIDER_ID,
    journalRevision: 1,
    strongWriterPublicationCount: 0,
    acceptancePublicationCount: 0,
  };
  const terminalJournal = {
    ...terminalUnsigned,
    closureContentDigest: domainDigest(
      "provider-migration-same-installation-identity-terminal-journal-sealed-closure-v1",
      terminalUnsigned,
    ),
  };
  return {
    formalPlan,
    formalPlanPin,
    terminalProgressReceipt,
    sourceTombstoneRecord,
    readyToActivateRecord,
    sealedProgressHead,
    terminalJournalReceipt,
    terminalJournal,
  };
}

function buildLifecycleAuthorityV1(core, installationIdentityGenerationId) {
  const terminal = terminalLifecycleV1(
    core,
    installationIdentityGenerationId,
  );
  const role =
    FORMAL_PLAN.payload.migrationHistoryQuotaReservations.journal.role;
  const formalConfiguration = {
    state: "strong_ready",
    core,
    activation: {
      origin: "completed_provider_migration",
      migrationPlan: {
        locatorProfile: "installation_provider_migration_plan_v1",
        migrationId: FORMAL_MIGRATION_ID,
        mode: "same_installation_identity",
        contentDigest: FORMAL_PLAN_DIGEST,
      },
      sealedProgressHead: {
        locatorProfile: "installation_provider_migration_progress_head_v1",
        migrationId: FORMAL_MIGRATION_ID,
        versionOrdinal: 2,
        headContentDigest: terminal.sealedProgressHead.contentDigest,
        currentVersionToken: `hmac-sha256:${"1".repeat(64)}`,
        readyToActivateRecord: {
          locatorProfile: "installation_provider_migration_progress_record_v1",
          migrationId: FORMAL_MIGRATION_ID,
          recordOrdinal: 2,
          recordId: `provider-migration-progress:${"0".repeat(22)}`,
          contentDigest: terminal.readyToActivateRecord.contentDigest,
        },
      },
      migrationHistoryQuotaCommits: {
        mode: "same_installation_identity",
        journalCommit: {
          locatorProfile:
            "installation_provider_migration_history_quota_operation_receipt_v1",
          installationIdentityGenerationId,
          operationNonce: "c".repeat(32),
          contentDigest: `sha256:${"d".repeat(64)}`,
          receiptToken: `hmac-sha256:${"d".repeat(64)}`,
          migrationId: FORMAL_MIGRATION_ID,
          reservationId:
            `provider-migration-history-reservation:${"c".repeat(22)}`,
          migrationPlanContentDigest: FORMAL_PLAN_DIGEST,
          role,
          operation: "compare_commit",
          commitKind: "commit_retained_history",
          outcome: "committed",
        },
      },
    },
  };
  const referenceConfiguration = {
    state: "strong_ready",
    core,
    activation: {
      origin: "provider_migration_terminal_sealed_success_v1",
      formalMigrationId: FORMAL_MIGRATION_ID,
      formalPlanPin: terminal.formalPlanPin,
      terminalProgressReceiptContentDigest:
        terminal.terminalProgressReceipt.receiptContentDigest,
      terminalJournalReceiptContentDigest:
        terminal.terminalJournalReceipt.contentDigest,
      sourceTombstoneRecordContentDigest:
        terminal.sourceTombstoneRecord.contentDigest,
      readyToActivateRecordContentDigest:
        terminal.readyToActivateRecord.contentDigest,
      sealedProgressHeadContentDigest: terminal.sealedProgressHead.contentDigest,
    },
  };
  const acceptedAt = "2026-08-26T00:00:00.000Z";
  const referenceAcceptance = referenceAcceptanceEnvelopeV1({
    configuration: referenceConfiguration,
    installationIdentityGenerationId,
    acceptedAt,
  });
  const formalAcceptanceA = formalAcceptanceEnvelopeV1({
    configuration: formalConfiguration,
    installationIdentityGenerationId,
    acceptanceOrdinal: 1,
    predecessor: { state: "genesis" },
    acceptedAt,
  });
  const formalAcceptanceB = formalAcceptanceEnvelopeV1({
    configuration: formalConfiguration,
    installationIdentityGenerationId,
    acceptanceOrdinal: 2,
    predecessor: {
      state: "acceptance",
      generationId: formalAcceptanceA.generationId,
      contentDigest: formalAcceptanceA.contentDigest,
    },
    acceptedAt: "2026-08-26T00:00:01.000Z",
  });
  const referencePin = {
    locatorProfile: "installation_provider_acceptance_state_v1",
    acceptanceOrdinal: 1,
    generationId: referenceAcceptance.generationId,
    contentDigest: referenceAcceptance.contentDigest,
  };
  const referenceReceipt = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_final_strong_ready_acceptance_compare_append_receipt_v1",
    durability: "in_memory_reference_only_not_a_durable_provider_v1",
    operationNonce: "2".repeat(32),
    requestContentDigest: `sha256:${"2".repeat(64)}`,
    resolvedAt: "2026-08-26T00:00:01.000Z",
    outcome: {
      state: "committed",
      appendedAcceptance: referencePin,
      highWaterRevision: 1,
    },
    receiptContentDigest: `sha256:${"3".repeat(64)}`,
  };
  const acceptanceState = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_final_strong_ready_acceptance_compare_append_state_v1",
    durability: "in_memory_reference_only_not_a_durable_provider_v1",
    installationIdentityGenerationId,
    highWaterRevision: 1,
    generationCount: 1,
    generationSetDigest: `sha256:${"4".repeat(64)}`,
    currentVersionToken: `hmac-sha256:${"5".repeat(64)}`,
    currentAcceptance: referencePin,
    retiredMigrationOnlyState: { lifecycle: "retired" },
    finalStrongReadyAcceptance: referenceAcceptance,
    receipts: [referenceReceipt],
    acceptancePublicationCount: 1,
  };
  const candidate = {
    authority: "none",
    durability: "none",
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_final_strong_ready_acceptance_candidate_validation_v1",
    relationship:
      "exact_terminal_sealed_destination_only_strong_ready_acceptance_candidate_not_appended_v1",
    formalMigrationId: FORMAL_MIGRATION_ID,
    formalPlanPin: terminal.formalPlanPin,
    activeWriterSelector: core.activeWriterSelector,
    activeWriterSelectorContentDigest:
      deriveProviderActiveWriterSelectorContentDigestV1(
        core.activeWriterSelector,
      ),
    acceptanceStateEnvelope: referenceAcceptance,
    acceptanceGenerationPin: referencePin,
    destinationOnlyPublicStrongWriter: true,
    acceptanceAppendCount: 0,
  };
  const closure = {
    authority:
      "in_memory_reference_machine_only_no_production_provider_authority_v1",
    durability: "in_memory_reference_only_not_a_durable_provider_v1",
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_final_strong_ready_acceptance_reference_validation_v1",
    relationship:
      "exact_terminal_sealed_new_destination_writer_final_strong_ready_acceptance_compare_appended_v1",
    sealedTerminalJournal: terminal.terminalJournal,
    candidateValidation: candidate,
    finalStrongReadyAcceptanceEnvelope: referenceAcceptance,
    finalStrongReadyAcceptancePin: referencePin,
    acceptanceCompareAppendReceipt: referenceReceipt,
    acceptanceReferenceState: acceptanceState,
    destinationProviderId: PROVIDER_ID,
    sourceWriterRetired: true,
    migrationOnlyWriterRetired: true,
    destinationOnlyPublicStrongWriter: true,
    finalSteadyRegistryAndCatalogBound: true,
    formalPlanAndTerminalSealBound: true,
    acceptancePublicationCount: 1,
    publicStrongWriterPublicationCount: 1,
  };
  return {
    formalAcceptanceA,
    formalAcceptanceB,
    referenceAcceptance,
    lifecycleArtifacts: {
      preparedCatalogSuccessor: { profile: "prepared_catalog_successor_v1" },
      registryManifest: core.providerRegistryManifest,
      supportCatalog: core.providerSupportCatalog,
      formalPlan: terminal.formalPlan,
      formalPlanPin: terminal.formalPlanPin,
      formalReservation: { profile: "formal_reservation_v1" },
      reservationRecord: { profile: "reservation_record_v1" },
      compoundPublicationReceipt: { profile: "compound_publication_receipt_v1" },
      migrationOnlyAcceptance: { profile: "migration_only_acceptance_v1" },
      rebindingRegistry: { profile: "rebinding_registry_v1" },
      executionProgress: { profile: "execution_progress_v1" },
      destinationObjectPublications: [],
      zeroLive: { profile: "zero_live_v1" },
      sourceDrainedRegistry: { profile: "source_drained_registry_v1" },
      steadyRegistry: { profile: "steady_registry_v1" },
      terminalJournal: terminal.terminalJournal,
      finalStrongReadyAcceptance: closure,
    },
  };
}

function identityGeneration(fixture) {
  return InstallationIdentityGenerationIdV1Schema.parse(fixture.installationIdentityGenerationId);
}

async function makeFixture(work, installRoot, runtimeRoot, paths) {
  const fixture = JSON.parse(await readFile(REGISTRY_FIXTURE_PATH, "utf8"));
  const registry = appendGrantManifest(fixture);
  const installationIdentityGenerationId = identityGeneration(fixture);
  const cryptoHost = {
    sha256(message) { return new Uint8Array(createHash("sha256").update(message).digest()); },
    hmacSha256(key, message) { return new Uint8Array(createHmac("sha256", key).update(message).digest()); },
  };
  const keyCheckToken = await deriveInstallationIdentityKeyCheckTokenV1(
    { generationId: installationIdentityGenerationId, initializationNonce: IDENTITY_NONCE },
    IDENTITY_KEY,
    cryptoHost,
  );
  const core = trustedCore(fixture, registry.history);
  const lifecycle = buildLifecycleAuthorityV1(
    core,
    installationIdentityGenerationId,
  );
  const acceptance = lifecycle.formalAcceptanceA;
  const acceptanceB = lifecycle.formalAcceptanceB;
  const acceptanceRequest = ProviderAcceptanceCompareAppendRequestV1Schema.parse({
    profile: "provider_acceptance_compare_append_request_v1",
    operationNonce: "00000000000000000000000000000001",
    installationIdentityGenerationId,
    expected: { state: "genesis", expectedNamespaceState: "absent" },
    candidate: acceptance,
  });
  const servicePrivateKey = privateKey(SERVICE_SEED);
  const config = createProviderServiceHandoffConfigV1({
    payload: {
      schemaVersion: 1,
      profile: "understand_code_provider_service_handoff_payload_v1",
      platform: "linux",
      serviceLabel: "understand-code-step15-production-e2e",
      providerId: PROVIDER_ID,
      principal: { kind: "dedicated_os_principal", name: "ucstep15runtime", uid: SERVICE_UID, gid: SERVICE_GID },
      runtimeRoot,
      socketPath: join(runtimeRoot, "provider.sock"),
      executablePath: process.execPath,
      configPath: join(installRoot, "provider-service-config-v1.json"),
      authKeyPath: join(runtimeRoot, "auth.key"),
      readinessPath: join(runtimeRoot, "readiness.json"),
      signingKeyPath: join(runtimeRoot, "signing.key"),
      installationIdentityCustody: {
        keyPath: join(runtimeRoot, "installation-identity.key"),
        initializationNonce: IDENTITY_NONCE,
        installationIdentityGenerationId,
        keyCheckToken,
      },
      installationIdentityDigest: digestBytes(IDENTITY_KEY),
      binaryDigest: `sha256:${"b".repeat(64)}`,
      capabilityDigest: CAPABILITY_DIGEST,
    },
    privateKey: servicePrivateKey,
  });
  await writeFile(paths.configPath, `${canonicalizeJcsSafeIntegerV1(config)}\n`, { mode: 0o644 });
  await chown(paths.configPath, 0, 0);
  const authKey = randomBytes(32);
  await writeFile(config.payload.authKeyPath, authKey, { mode: 0o600 });
  await chown(config.payload.authKeyPath, SERVICE_UID, SERVICE_GID);
  const signingKey = Buffer.from(servicePrivateKey.export({ format: "der", type: "pkcs8" }));
  await writeFile(config.payload.signingKeyPath, signingKey, { mode: 0o600 });
  await chown(config.payload.signingKeyPath, SERVICE_UID, SERVICE_GID);
  await writeFile(config.payload.installationIdentityCustody.keyPath, IDENTITY_KEY, { mode: 0o600 });
  await chown(config.payload.installationIdentityCustody.keyPath, SERVICE_UID, SERVICE_GID);
  const grantKey = Buffer.from(privateKey(GRANT_SEED).export({ format: "der", type: "pkcs8" }));
  await writeFile(paths.grantKeyPath, grantKey, { mode: 0o600 });
  await chown(paths.grantKeyPath, SERVICE_UID, SERVICE_GID);
  const readiness = createProviderServiceReadinessReceiptV1({
    config,
    observedUid: SERVICE_UID,
    observedGid: SERVICE_GID,
    targetFingerprintDigest: TARGET_FINGERPRINT_DIGEST,
    nonce: Uint8Array.from({ length: 32 }, (_v, i) => 255 - i),
    privateKey: servicePrivateKey,
  });
  await writeFile(config.payload.readinessPath, `${canonicalizeJcsSafeIntegerV1(readiness)}\n`, { mode: 0o600 });
  await chown(config.payload.readinessPath, SERVICE_UID, SERVICE_GID);
  const identityManifest = {
    schemaVersion: 1,
    profile: "understand_code_provider_service_installation_manifest_v1",
    installationRoot: installRoot,
    manifestGeneration: 1,
    platform: "linux",
    serviceLabel: config.payload.serviceLabel,
    providerId: PROVIDER_ID,
    principal: config.payload.principal,
    runtimeRoot,
    installationIdentityDigest: config.payload.installationIdentityDigest,
    handoffPayloadDigest: config.payloadDigest,
    binaryDigest: config.payload.binaryDigest,
    capabilityDigest: CAPABILITY_DIGEST,
    servicePublicKey: config.publicKey,
    managedArtifacts: [
      { kind: "service_config", path: paths.configPath, contentDigest: digestBytes(Buffer.from(`${canonicalizeJcsSafeIntegerV1(config)}\n`)), byteLength: Buffer.byteLength(`${canonicalizeJcsSafeIntegerV1(config)}\n`), mode: 0o644, owner: "authority" },
      { kind: "service_descriptor", path: `${installRoot}.provider-production-strong-client-v1.json`, contentDigest: `sha256:${"d".repeat(64)}`, byteLength: 1, mode: 0o644, owner: "authority" },
      { kind: "runtime_auth_key", path: config.payload.authKeyPath, contentDigest: digestBytes(authKey), byteLength: authKey.byteLength, mode: 0o600, owner: "service_principal" },
      { kind: "runtime_signing_key", path: config.payload.signingKeyPath, contentDigest: digestBytes(signingKey), byteLength: signingKey.byteLength, mode: 0o600, owner: "service_principal" },
    ],
    ephemeralPaths: { socketPath: config.payload.socketPath, readinessPath: config.payload.readinessPath },
    retainedState: { runtimeRoot, installationIdentityKeyPath: config.payload.installationIdentityCustody.keyPath },
    previous: null,
  };
  const manifestEnvelope = {
    payload: identityManifest,
    contentDigest: digestValue(["understand-code-provider-service-installation-manifest-v1", identityManifest]),
  };
  await writeFile(join(installRoot, "provider-service-installation-manifest-v1.json"), `${canonicalizeJcsSafeIntegerV1(manifestEnvelope)}\n`, { mode: 0o600 });
  await chown(join(installRoot, "provider-service-installation-manifest-v1.json"), 0, 0);
  const registryHistory = {
    installationIdentityGenerationId,
    bootstrapTrustBundle: fixture.bootstrapTrustBundle,
    rootMetadataHistory: fixture.rootMetadataHistory,
    registryManifestHistory: registry.history,
  };
  const trust = {
    canonicalTargetRoot: runtimeRoot,
    targetProfileId: TARGET_PROFILE_ID,
    targetFingerprintDigest: TARGET_FINGERPRINT_DIGEST,
    acceptanceHistory: [acceptance],
    currentAcceptance: {
      generationId: acceptance.generationId,
      contentDigest: acceptance.contentDigest,
      acceptanceOrdinal: 1,
      installationIdentityGenerationId,
    },
    registryHistory,
    grantKeyPath: paths.grantKeyPath,
    callerPrincipal: { uid: CALLER_UID, gid: CALLER_GID },
  };
  const installedTrust = await installProviderProductionStrongClientTrustV1({
    canonicalInstallationRoot: installRoot,
    serviceConfig: config,
    servicePrivateKey,
    trust,
  });
  if (installedTrust.status !== "installed") {
    throw new Error("production client trust installation did not complete");
  }
  await writeFile(paths.fixturePath, `${canonicalizeJcsSafeIntegerV1({
    providerId: PROVIDER_ID,
    serviceUid: SERVICE_UID,
    serviceGid: SERVICE_GID,
    callerUid: CALLER_UID,
    callerGid: CALLER_GID,
    badCallerUid: BAD_CALLER_UID,
    badCallerGid: BAD_CALLER_GID,
    capabilityDigest: CAPABILITY_DIGEST,
    targetProfileId: TARGET_PROFILE_ID,
    targetFingerprintDigest: TARGET_FINGERPRINT_DIGEST,
    installationIdentityGenerationId,
    identityNonce: IDENTITY_NONCE,
    acceptance,
    acceptanceB,
    acceptanceRequest,
    referenceAcceptance: lifecycle.referenceAcceptance,
    lifecycleArtifacts: lifecycle.lifecycleArtifacts,
    registryHistory,
    config,
    configPath: paths.configPath,
    runtimeRoot,
    installRoot,
    authorityHome: paths.authorityHome,
    nativeProbeRoot: paths.nativeProbeRoot,
    authKeyPath: config.payload.authKeyPath,
    grantKeyPath: paths.grantKeyPath,
    readinessPath: config.payload.readinessPath,
    servicePublicKey: config.publicKey,
    trustInstallStatus: installedTrust.status,
    brokerSocketPath: join(runtimeRoot, "strong-mutation-broker-v1.sock"),
    runtimeSocketPath: config.payload.socketPath,
    gatewaySocketPath: providerProductionStrongClientGatewaySocketPathV1(installRoot),
    step16RepositoryRoot: paths.step16RepositoryRoot,
    step16InvalidRoot: paths.step16InvalidRoot,
    step16HostsRoot: paths.step16HostsRoot,
    step16EvidencePath: paths.step16EvidencePath,
    alphaGoldCorpusPath: ALPHA_GOLD_CORPUS_PATH,
    previewPluginE2ePath: PREVIEW_PLUGIN_E2E_PATH,
  })}\n`, { mode: 0o644 });
  await chown(paths.fixturePath, 0, 0);
  authKey.fill(0);
  signingKey.fill(0);
  grantKey.fill(0);
  return {
    config,
    servicePrivateKey,
    acceptance,
    acceptanceB,
    registryHistory,
  };
}

async function readFixture(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function durableLifecycleArtifactsV1(fixture) {
  return clone(fixture.lifecycleArtifacts);
}
function trustMaterialV1(
  fixture,
  targetFingerprintDigest,
  acceptanceHistory = [fixture.acceptance],
) {
  const currentAcceptance = acceptanceHistory.at(-1);
  return {
    canonicalTargetRoot: fixture.runtimeRoot,
    targetProfileId: fixture.targetProfileId,
    targetFingerprintDigest,
    acceptanceHistory,
    currentAcceptance: {
      generationId: currentAcceptance.generationId,
      contentDigest: currentAcceptance.contentDigest,
      acceptanceOrdinal: currentAcceptance.payload.acceptanceOrdinal,
      installationIdentityGenerationId:
        fixture.installationIdentityGenerationId,
    },
    registryHistory: fixture.registryHistory,
    grantKeyPath: fixture.grantKeyPath,
    callerPrincipal: { uid: fixture.callerUid, gid: fixture.callerGid },
  };
}

async function productionTrustLifecycleV1(fixture) {
  const snapshotPath = join(
    fixture.installRoot,
    PROVIDER_PRODUCTION_STRONG_CLIENT_TRUST_FILE_V1,
  );
  const descriptorPath = providerProductionStrongClientDescriptorPathV1(
    fixture.installRoot,
  );
  const initialSnapshot = await readFile(snapshotPath);
  const initialDescriptor = await readFile(descriptorPath);
  const servicePrivateKey = privateKey(SERVICE_SEED);
  const rotated = await rotateProviderProductionStrongClientTrustV1({
    canonicalInstallationRoot: fixture.installRoot,
    serviceConfig: fixture.config,
    servicePrivateKey,
    trust: trustMaterialV1(
      fixture,
      `sha256:${"8".repeat(64)}`,
      [fixture.acceptance, fixture.acceptanceB],
    ),
  });
  const rotatedSnapshot = await readFile(snapshotPath);
  if (
    rotated.status !== "rotated" ||
    rotatedSnapshot.equals(initialSnapshot)
  ) throw new Error("production trust upgrade did not replace the snapshot");
  const rolledBack = await rollbackProviderProductionStrongClientTrustV1(
    fixture.installRoot,
  );
  if (
    rolledBack.status !== "rolled_back" ||
    !(await readFile(snapshotPath)).equals(initialSnapshot) ||
    !(await readFile(descriptorPath)).equals(initialDescriptor)
  ) throw new Error("production trust rollback did not restore exact files");
  const uninstalled = await uninstallProviderProductionStrongClientTrustV1(
    fixture.installRoot,
  );
  if (uninstalled.status !== "uninstalled") {
    throw new Error("production trust uninstall did not complete");
  }
  for (const path of [snapshotPath, descriptorPath]) {
    try {
      await access(path);
      throw new Error("production trust uninstall retained a managed file");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  await access(fixture.config.payload.installationIdentityCustody.keyPath);
  await access(fixture.authKeyPath);
  return {
    install: fixture.trustInstallStatus,
    upgrade: rotated.status,
    rollback: rolledBack.status,
    uninstall: uninstalled.status,
    retainedIdentity: "verified",
  };
}

async function waitForPath(path, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await access(path);
      return;
    } catch {
      if (Date.now() >= deadline) throw new Error(`timed out waiting for ${path}`);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
    }
  }
}

async function retainedSocketIdentityV1(path, expectedUid, expectedGid) {
  const metadata = await lstat(path, { bigint: true });
  if (
    !metadata.isSocket() || metadata.isSymbolicLink() ||
    metadata.uid !== BigInt(expectedUid) ||
    metadata.gid !== BigInt(expectedGid)
  ) throw new Error(`retained production socket is invalid: ${path}`);
  return Object.freeze({ dev: metadata.dev, ino: metadata.ino });
}

async function assertRetainedSocketIdentityV1(
  path,
  expectedUid,
  expectedGid,
  identity,
) {
  const actual = await retainedSocketIdentityV1(
    path,
    expectedUid,
    expectedGid,
  );
  if (actual.dev !== identity.dev || actual.ino !== identity.ino) {
    throw new Error(`SIGKILL socket projection changed before restart: ${path}`);
  }
}

function dropTo(uid, gid) {
  if (process.geteuid?.() !== 0) throw new Error("role must start root");
  if (typeof process.setgroups !== "function" || typeof process.getgroups !== "function" ||
      typeof process.setgid !== "function" || typeof process.setuid !== "function") {
    throw new Error("Linux privilege-drop APIs unavailable");
  }
  process.setgroups([gid]);
  process.setgid(gid);
  process.setuid(uid);
  const groups = process.getgroups();
  if (process.geteuid() !== uid || process.getegid() !== gid || groups.includes(0) ||
      groups.some((value) => value !== gid)) throw new Error("privilege drop was not exact");
}

async function strictCryptoCapability() {
  const {
    attestProviderStrictEd25519CryptoHostV1,
    PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
    PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  } = await import("@understand-code/durable-object-provider-contracts/strict-ed25519-conformance");
  const {
    STRICT_ED25519_VERIFICATION_PROFILE_V1,
    validatePrimeSubgroupPoint,
    verifyRawEd25519,
  } = await import("@understand-code/durable-object-provider-contracts/strict-ed25519");
  const manifestPath = join(REPO_ROOT, "packages/durable-object-provider-contracts/provider/ed25519-strict-host-conformance-v1.json");
  const bytes = new Uint8Array(await readFile(manifestPath));
  return attestProviderStrictEd25519CryptoHostV1({
    host: { verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1, validatePrimeSubgroupPoint, verifyRawEd25519 },
    resourceHost: {
      readFixedSignedPackageResource(path, maximumBytes) {
        if (path !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 || maximumBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1) {
          throw new Error("unexpected strict resource request");
        }
        return bytes.slice();
      },
    },
  });
}

async function authorityRole(fixturePath) {
  const fixture = await readFixture(fixturePath);
  const account = userInfo({ encoding: "utf8" });
  if (
    process.geteuid?.() !== 0 ||
    !isAbsolute(account.homedir) ||
    resolve(account.homedir) !== account.homedir ||
    REPO_ROOT === account.homedir ||
    REPO_ROOT.startsWith(`${account.homedir}/`)
  ) throw new Error("isolated production authority home is unavailable");
  await execFileAsync("/usr/bin/mount", [
    "--bind",
    fixture.authorityHome,
    account.homedir,
  ]);
  const {
    inspectProviderAcceptanceAuthorityCandidateV1,
    openProviderProductionStrongAuthorityServiceV1,
  } = await import("@understand-code/durable-object-provider-authority");
  const {
    openProviderAcceptanceAuthorityStoreCandidateInternalV1,
  } = await import("@understand-code/durable-object-provider-authority/internal/acceptance-store");
  const {
    resolveProviderAcceptanceAuthorityProductionLayoutInternalV1,
  } = await import("../../durable-object-provider-authority/dist/platform-layout.js");
  const {
    provisionProviderAcceptanceInstallationIdentityForTestInternalV1,
  } = await import("../../durable-object-provider-authority/dist/key-custody-internal.js");
  const layout = resolveProviderAcceptanceAuthorityProductionLayoutInternalV1();
  let authorityAlreadyProvisioned = true;
  try {
    await access(layout.authorityRoot);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    authorityAlreadyProvisioned = false;
  }
  if (!authorityAlreadyProvisioned) {
    // Fixture setup fixes the otherwise-random installation identity so the
    // checked-in signed Registry history remains exact.  Strong admission
    // below is exclusively the production composition root and native fence.
    await provisionProviderAcceptanceInstallationIdentityForTestInternalV1(
      layout,
      {
      installationIdentityGenerationId: fixture.installationIdentityGenerationId,
      installationIdentityKey: IDENTITY_KEY,
      },
    );
  }
  const acceptance = await openProviderAcceptanceAuthorityStoreCandidateInternalV1();
  if (!authorityAlreadyProvisioned) {
    await acceptance.compareAppend(fixture.acceptanceRequest);
  }
  const authorityDoctor = await inspectProviderAcceptanceAuthorityCandidateV1();
  if (
    authorityDoctor.status !== "ready" ||
    authorityDoctor.namespace !== "current" ||
    authorityDoctor.strongWrites !== "locked"
  ) {
    throw new Error("production Acceptance authority Doctor is not ready");
  }
  const strict = await strictCryptoCapability();
  const service = await openProviderProductionStrongAuthorityServiceV1({
    serviceConfigPath: fixture.configPath,
    targetProfileId: fixture.targetProfileId,
    strictCryptoCapability: strict,
    readTrustEvidence: async () => ({
      bootstrapTrustBundle: fixture.registryHistory.bootstrapTrustBundle,
      rootMetadataHistory: fixture.registryHistory.rootMetadataHistory,
      registryManifestHistory: fixture.registryHistory.registryManifestHistory,
    }),
  });
  await writeFile(join(dirname(fixturePath), "authority.ready"), "ready\n", { mode: 0o644 });
  const stopPath = join(dirname(fixturePath), "authority.stop");
  const rotatePath = join(dirname(fixturePath), "authority.rotate-b");
  const rotatedPath = join(dirname(fixturePath), "authority.rotated-b");
  try {
    let rotated = false;
    for (;;) {
      try {
        await access(stopPath);
        break;
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      if (!rotated) {
        try {
          await access(rotatePath);
          const currentResult = await acceptance.readCurrent();
          if (currentResult.state !== "current") {
            throw new Error("Acceptance G1 is unavailable for rotation");
          }
          const current = currentResult.current;
          const request = ProviderAcceptanceCompareAppendRequestV1Schema.parse({
            profile: "provider_acceptance_compare_append_request_v1",
            operationNonce: "00000000000000000000000000000002",
            installationIdentityGenerationId:
              fixture.installationIdentityGenerationId,
            expected: {
              state: "current",
              highWaterRevision: current.highWater.payload.highWaterRevision,
              highWaterContentDigest: current.highWater.contentDigest,
              currentVersionToken: current.highWater.currentVersionToken,
              generationCount: current.highWater.payload.generationCount,
              generationSetDigest:
                current.highWater.payload.generationSetDigest,
            },
            candidate: fixture.acceptanceB,
          });
          await acceptance.compareAppend(request);
          await writeFile(rotatedPath, "rotated\n", { mode: 0o644 });
          rotated = true;
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
        }
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
    }
  } finally {
    await service.close();
  }
}

async function runtimeRole(fixturePath) {
  const fixture = await readFixture(fixturePath);
  const { mintProviderServiceInstallationIdentityVerificationCapabilityInternalV1 } = await import("@understand-code/durable-object-provider-contracts/provider-service-installation-identity-custody-internal");
  const serviceKey = privateKey(SERVICE_SEED);
  const identityCapability = await mintProviderServiceInstallationIdentityVerificationCapabilityInternalV1({
    installationIdentityKey: IDENTITY_KEY,
    initializationNonce: fixture.identityNonce,
    installationIdentityGenerationId: fixture.installationIdentityGenerationId,
    keyCheckToken: fixture.config.payload.installationIdentityCustody.keyCheckToken,
  });
  const authKey = new Uint8Array(await readFile(fixture.authKeyPath));
  const verifier = createProviderRuntimeStrongMutationBrokerVerifierInternalV1({
    socketPath: fixture.brokerSocketPath,
    expectedAuthorityUid: 0,
    expectedAuthorityGid: 0,
    expectedSocketGid: fixture.serviceGid,
  });
  const server = new DurableObjectProviderRuntimeServerV1({
    rootPath: fixture.runtimeRoot,
    socketPath: fixture.runtimeSocketPath,
    providerId: fixture.providerId,
    authKey,
    authorizedCapabilityDigest: fixture.capabilityDigest,
    principalAttestation: {
      privateKey: serviceKey,
      handoffPayloadDigest: fixture.config.payloadDigest,
      publicKey: fixture.servicePublicKey,
    },
    acceptanceIdentityVerificationCapability: identityCapability,
    mutationPolicy: "acceptance_authority_session_required",
    strongMutationAuthorityVerifier: verifier,
  });
  // The runtime store is owned by the dedicated provider principal.  Drop
  // every supplementary/root group before opening or mutating that tree;
  // root authority is a separate process and never owns runtime state.
  dropTo(fixture.serviceUid, fixture.serviceGid);
  // Seed only the first process.  A restart recovers the already durable
  // journal and must not manufacture a new revision.
  await server.store.initialize();
  const state = server.store.inspectState();
  if (state.revision === 0) {
    await server.store.compareCommit({
      expectedRevision: 0,
      operationNonce: "0".repeat(31) + "1",
      phase: "final_strong_ready",
      artifacts: durableLifecycleArtifactsV1(fixture),
    });
  }
  const acceptancePin = {
    locatorProfile: "installation_provider_acceptance_state_v1",
    acceptanceOrdinal: fixture.acceptance.payload.acceptanceOrdinal,
    generationId: fixture.acceptance.generationId,
    contentDigest: fixture.acceptance.contentDigest,
  };
  const projectDurableCurrent = () =>
    projectProviderRuntimeDurableLifecycleArtifactsV1({
      journalState: server.store.inspectState(),
      expectedAcceptanceEnvelope: fixture.acceptance,
      expectedAcceptancePin: acceptancePin,
    });
  if (Object.keys(projectDurableCurrent().lifecycleArtifacts).length !== 17) {
    throw new Error("runtime durable-current lifecycle basis is incomplete");
  }
  await server.start();
  const readyPath = join(fixture.runtimeRoot, ".runtime.ready");
  await writeFile(readyPath, "ready\n", { mode: 0o600 });
  const stopPath = join(fixture.runtimeRoot, ".runtime.stop");
  try {
    await waitForPath(stopPath, 24 * 60 * 60 * 1000);
  } finally {
    const durableCurrent = projectDurableCurrent();
    await writeFile(
      join(fixture.runtimeRoot, ".runtime.durable-current.json"),
      `${canonicalizeJcsSafeIntegerV1({
        revision: durableCurrent.state.revision,
        lifecycleArtifactCount:
          Object.keys(durableCurrent.lifecycleArtifacts).length,
        businessHeadPresent: durableCurrent.businessHead !== undefined,
      })}\n`,
      { mode: 0o600 },
    );
    await server.close();
    authKey.fill(0);
  }
}

async function gatewayRole(fixturePath) {
  const fixture = await readFixture(fixturePath);
  const service = await startProviderProductionStrongObjectGatewayServiceV1({
    canonicalInstallationRoot: fixture.installRoot,
  });
  const readyPath = join(dirname(fixture.gatewaySocketPath), ".gateway.ready");
  await writeFile(readyPath, "ready\n", { mode: 0o600 });
  const stopPath = join(dirname(fixture.gatewaySocketPath), ".gateway.stop");
  try {
    await waitForPath(stopPath, 24 * 60 * 60 * 1000);
  } finally {
    await service.close();
  }
}

async function renameExchangeV1(left, right) {
  await execFileAsync("/usr/bin/python3", [
    "-c",
    [
      "import ctypes, os, sys",
      "libc=ctypes.CDLL(None, use_errno=True)",
      "fn=libc.renameat2",
      "fn.argtypes=[ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint]",
      "result=fn(-100,os.fsencode(sys.argv[1]),-100,os.fsencode(sys.argv[2]),2)",
      "result == 0 or (_ for _ in ()).throw(OSError(ctypes.get_errno(),os.strerror(ctypes.get_errno())))",
    ].join(";"),
    left,
    right,
  ]);
}

function exactOutcomeV1(actual, status, reason) {
  return actual?.status === status &&
    (reason === undefined || actual?.reason === reason);
}

async function nativeExactObjectRole(fixturePath) {
  const fixture = await readFixture(fixturePath);
  dropTo(fixture.serviceUid, fixture.serviceGid);
  const root = fixture.nativeProbeRoot;
  const finalName = `${"f".repeat(64)}.blob`;
  const publishers = [];
  const sources = [];
  const openPublisher = (path) => {
    const publisher = openProviderRuntimeNativeExactObjectPublisherV1(path, {
      expectedOwnerUid: fixture.serviceUid,
      expectedOwnerGid: fixture.serviceGid,
    });
    publishers.push(publisher);
    return publisher;
  };
  const stage = (publisher, bytes) => {
    const source = stageProviderRuntimeNativeExactObjectV1(publisher, bytes);
    sources.push(source);
    return source;
  };
  try {
    const exact = join(root, "exact");
    await mkdir(exact, { mode: 0o700 });
    const exactPublisher = openPublisher(exact);
    const exactBytes = Buffer.from("provider-exact-object\n", "utf8");
    if (!exactOutcomeV1(
      commitProviderRuntimeNativeExactObjectV1(
        exactPublisher,
        stage(exactPublisher, exactBytes),
        finalName,
      ),
      "committed",
    )) throw new Error("exact-object publication did not commit");
    if (!exactOutcomeV1(
      commitProviderRuntimeNativeExactObjectV1(
        exactPublisher,
        stage(exactPublisher, exactBytes),
        finalName,
      ),
      "not_committed",
      "final_collision",
    )) throw new Error("exact-object no-replace was not enforced");

    const renameRoot = join(root, "rename-reparent");
    const originalParent = join(renameRoot, "from", "parent");
    const movedParent = join(renameRoot, "to", "moved");
    await mkdir(originalParent, { recursive: true, mode: 0o700 });
    await mkdir(dirname(movedParent), { recursive: true, mode: 0o700 });
    const renamePublisher = openPublisher(originalParent);
    const renameSource = stage(
      renamePublisher,
      Buffer.from("rename-reparent-race", "utf8"),
    );
    await rename(originalParent, movedParent);
    await mkdir(originalParent, { mode: 0o700 });
    if (!exactOutcomeV1(
      commitProviderRuntimeNativeExactObjectV1(
        renamePublisher,
        renameSource,
        finalName,
      ),
      "not_committed",
      "parent_path_projection_changed",
    ) || (await readdir(originalParent)).length !== 0 ||
      (await readdir(movedParent)).length !== 0) {
      throw new Error("rename/reparent was not rejected at zero write");
    }

    const abaRoot = join(root, "aba");
    const left = join(abaRoot, "left");
    const right = join(abaRoot, "right");
    await mkdir(left, { recursive: true, mode: 0o700 });
    await mkdir(right, { mode: 0o700 });
    const abaPublisher = openPublisher(left);
    const abaSource = stage(abaPublisher, Buffer.from("aba-race", "utf8"));
    await renameExchangeV1(left, right);
    await renameExchangeV1(left, right);
    if (!exactOutcomeV1(
      commitProviderRuntimeNativeExactObjectV1(
        abaPublisher,
        abaSource,
        finalName,
      ),
      "not_committed",
      "parent_path_projection_changed",
    ) || (await readdir(left)).length !== 0 || (await readdir(right)).length !== 0) {
      throw new Error("pathname ABA was not rejected at zero write");
    }

    const sourceRoot = join(root, "source-swap");
    const sourceLeft = join(sourceRoot, "left");
    const sourceRight = join(sourceRoot, "right");
    await mkdir(sourceLeft, { recursive: true, mode: 0o700 });
    await mkdir(sourceRight, { mode: 0o700 });
    const sourceLeftPublisher = openPublisher(sourceLeft);
    const sourceRightPublisher = openPublisher(sourceRight);
    const foreignSource = stage(
      sourceRightPublisher,
      Buffer.from("foreign-source", "utf8"),
    );
    let sourceSwapRejected = false;
    try {
      commitProviderRuntimeNativeExactObjectV1(
        sourceLeftPublisher,
        foreignSource,
        finalName,
      );
    } catch (error) {
      sourceSwapRejected =
        error?.code === "ERR_PROVIDER_RUNTIME_NATIVE_EXACT_OBJECT_UNAVAILABLE";
    }
    if (!sourceSwapRejected || (await readdir(sourceLeft)).length !== 0 ||
      (await readdir(sourceRight)).length !== 0) {
      throw new Error("cross-authority source swap was not rejected at zero write");
    }

    process.stdout.write(`${JSON.stringify({
      profile: "provider_runtime_native_exact_object_service_principal_ext4_v1",
      status: "verified",
      principalUid: process.geteuid(),
      exactObject: "verified",
      noReplace: "verified",
      renameReparent: "rejected_zero_write",
      pathnameAba: "rejected_zero_write",
      sourceSwap: "rejected_zero_write",
    })}\n`);
  } finally {
    for (const source of sources) {
      try {
        closeProviderRuntimeNativeExactObjectSourceV1(source);
      } catch {
        // Commit or rejection consumes the retained source.
      }
    }
    for (const publisher of publishers) {
      try {
        closeProviderRuntimeNativeExactObjectPublisherV1(publisher);
      } catch {
        // Continue closing every retained exact authority.
      }
    }
    await rm(root, { recursive: true, force: true });
  }
}

async function callerRole(fixturePath, mode = "primary") {
  const fixture = await readFixture(fixturePath);
  const bad = mode === "bad";
  dropTo(
    bad ? fixture.badCallerUid : fixture.callerUid,
    bad ? fixture.badCallerGid : fixture.callerGid,
  );
  if (!bad) {
    const protectedKeys = [
      fixture.authKeyPath,
      fixture.grantKeyPath,
      fixture.config.payload.signingKeyPath,
      fixture.config.payload.installationIdentityCustody.keyPath,
    ];
    for (const path of protectedKeys) {
      let denied = false;
      try {
        await readFile(path);
      } catch (error) {
        denied = error?.code === "EACCES" || error?.code === "EPERM";
      }
      if (!denied) throw new Error(`ordinary caller could read protected key ${path}`);
    }
  }
  if (bad) {
    try {
      const client = await openProviderProductionStrongObjectClientV1({
        canonicalInstallationRoot: fixture.installRoot,
      });
      await client.close();
    } catch {
      process.stdout.write(`${JSON.stringify({ role: "bad-caller", rejected: true })}\n`);
      return;
    }
    throw new Error("foreign caller unexpectedly opened public gateway");
  }
  try {
    const client = await openProviderProductionStrongObjectClientV1({ canonicalInstallationRoot: fixture.installRoot });
    if (mode === "cas-probe") {
      let writeNonceConflict = false;
      const differentBytes = Buffer.from("step15-operation-nonce-conflict\n", "utf8");
      try {
        await client.writeExactObject({
          locator: {
            providerId: fixture.providerId,
            contentDigest: digestBytes(differentBytes),
          },
          logicalBytes: differentBytes.byteLength,
          bytes: `base64url:${differentBytes.toString("base64url")}`,
          operationNonce: "a".repeat(32),
        });
      } catch {
        writeNonceConflict = true;
      }
      let compareNonceConflict = false;
      try {
        await client.compareCommit({
          expectedRevision: 2,
          operationNonce: "b".repeat(32),
          phase: "strong_verification_v1",
          artifacts: { conflict: true },
        });
      } catch {
        compareNonceConflict = true;
      }
      const futureStaleInput = {
        expectedRevision: 4,
        operationNonce: "c".repeat(32),
        phase: "strong_change_check_v1",
        artifacts: { futureStale: true },
      };
      const stale = await client.compareCommit(futureStaleInput);
      const advance = await client.compareCommit({
        expectedRevision: 3,
        operationNonce: "f".repeat(32),
        phase: "strong_verification_v1",
        artifacts: { advanced: true },
      });
      const staleReplay = await client.compareCommit(futureStaleInput);
      await client.close();
      if (
        !writeNonceConflict || !compareNonceConflict ||
        stale.resolution !== "stale" ||
        stale.state.revision !== 3 ||
        stale.state.phase !== "strong_verification_v1" ||
        canonicalizeJcsSafeIntegerV1(stale.state.artifacts) !==
          canonicalizeJcsSafeIntegerV1({
            operation: "record_verification",
            checkRevision: 2,
          }) ||
        (advance.resolution !== "committed" && advance.resolution !== "replayed") ||
        advance.state.revision !== 4 ||
        staleReplay.resolution !== "stale" ||
        canonicalizeJcsSafeIntegerV1(staleReplay.state) !==
          canonicalizeJcsSafeIntegerV1(stale.state)
      ) {
        throw new Error("CAS/nonce constraints were not enforced");
      }
      process.stdout.write(`${JSON.stringify({
        role: "cas-probe",
        writeNonceConflict,
        compareNonceConflict,
        stale: stale.resolution,
        staleReplay: staleReplay.resolution,
        revision: advance.state.revision,
      })}\n`);
      return;
    }
    if (mode === "trust-rotation-replay") {
      const bytes = Buffer.from("step15-three-principal-ext4\n", "utf8");
      const contentDigest = digestBytes(bytes);
      const locator = { providerId: fixture.providerId, contentDigest };
      const ownerCanonicalValue = canonicalizeJcsSafeIntegerV1([
        "record-verification-full-input-v1",
        contentDigest,
      ]);
      const checkInput = {
        expectedRevision: 1,
        operationNonce: "b".repeat(32),
        phase: "strong_change_check_v1",
        artifacts: {
          operation: "check_changes",
          object: locator,
          owner: await client.commitOwnerOnlyState(
            "record-verification-full-input-v1",
            ownerCanonicalValue,
          ),
        },
      };
      const before = await client.inspectState();
      const replay = await client.compareCommit(checkInput);
      const after = await client.inspectState();
      await client.close();
      if (
        before.revision !== 4 ||
        replay.resolution !== "committed" ||
        replay.state.revision !== 2 ||
        replay.state.phase !== checkInput.phase ||
        canonicalizeJcsSafeIntegerV1(replay.state.artifacts) !==
          canonicalizeJcsSafeIntegerV1(checkInput.artifacts) ||
        after.revision !== before.revision
      ) {
        throw new Error("Acceptance A-to-B logical nonce replay was not exact");
      }
      process.stdout.write(`${JSON.stringify({
        role: "trust-rotation-replay",
        acceptanceOrdinal: fixture.acceptanceB.payload.acceptanceOrdinal,
        resolution: replay.resolution,
        originalRevision: replay.state.revision,
        currentRevision: after.revision,
        zeroWrite: true,
      })}\n`);
      return;
    }
    const inspectedBefore = await client.inspectState();
    if (Object.keys(inspectedBefore).join(",") !== "revision") {
      throw new Error("public inspect leaked Provider journal state");
    }
    const bytes = Buffer.from("step15-three-principal-ext4\n", "utf8");
    const contentDigest = digestBytes(bytes);
    const locator = { providerId: fixture.providerId, contentDigest };
    const writeResult = await client.writeExactObject({
      locator,
      logicalBytes: bytes.byteLength,
      bytes: `base64url:${bytes.toString("base64url")}`,
      operationNonce: "a".repeat(32),
    });
    const readResult = await client.readExactObject(locator);
    const ownerCanonicalValue = canonicalizeJcsSafeIntegerV1([
      "record-verification-full-input-v1",
      contentDigest,
    ]);
    const checkInput = {
      expectedRevision: 1,
      operationNonce: "b".repeat(32),
      phase: "strong_change_check_v1",
      artifacts: {
        operation: "check_changes",
        object: locator,
        owner: await client.commitOwnerOnlyState(
          "record-verification-full-input-v1",
          ownerCanonicalValue,
        ),
      },
    };
    const checkResult = await client.compareCommit(checkInput);
    const inspectedAfterCheck = await client.inspectState();
    const replayedCheck = await client.compareCommit(checkInput);
    const inspectedAfterReplay = await client.inspectState();
    const verificationInput = {
      expectedRevision: 2,
      operationNonce: "d".repeat(32),
      phase: "strong_verification_v1",
      artifacts: {
        operation: "record_verification",
        checkRevision: checkResult.state.revision,
      },
    };
    const verificationResult = await client.compareCommit(verificationInput);
    const inspectedAfterVerification = await client.inspectState();
    let reservedForgeryRejected = false;
    try {
      await client.compareCommit({
        expectedRevision: 3,
        operationNonce: "e".repeat(32),
        phase: "strong_change_check_v1",
        artifacts: { finalStrongReadyAcceptance: { forged: true } },
      });
    } catch {
      reservedForgeryRejected = true;
    }
    const inspectedAfterForgery = await client.inspectState();
    await client.close();
    if (
      (checkResult.resolution !== "committed" && checkResult.resolution !== "replayed") ||
      replayedCheck.resolution !== checkResult.resolution ||
      replayedCheck.state.revision !== 2 ||
      canonicalizeJcsSafeIntegerV1(replayedCheck.state.artifacts) !==
        canonicalizeJcsSafeIntegerV1(checkInput.artifacts) ||
      (verificationResult.resolution !== "committed" && verificationResult.resolution !== "replayed") ||
      verificationResult.state.revision !== 3 ||
      canonicalizeJcsSafeIntegerV1(verificationResult.state.artifacts) !==
        canonicalizeJcsSafeIntegerV1(verificationInput.artifacts) ||
      inspectedAfterCheck.revision < 2 ||
      inspectedAfterReplay.revision !== inspectedAfterCheck.revision ||
      inspectedAfterVerification.revision !== 3 ||
      inspectedAfterForgery.revision !== inspectedAfterVerification.revision ||
      !reservedForgeryRejected
    ) throw new Error("business journal Acceptance closure was not preserved");
    process.stdout.write(`${JSON.stringify({
      role: "caller",
      callerUid: process.geteuid(),
      keyDenied: true,
      keyDenials: 4,
      write: writeResult.resolution,
      read: readResult.verifiedContentDigest,
      inspectBefore: inspectedBefore.revision,
      check: checkResult.resolution,
      checkReplay: replayedCheck.resolution,
      verification: verificationResult.resolution,
      revision: inspectedAfterVerification.revision,
      revisionOnly: true,
      reservedForgeryRejected,
    })}\n`);
  } catch (error) {
    throw error;
  }
}

async function step16DualHostRole(fixturePath) {
  const fixture = await readFixture(fixturePath);
  dropTo(fixture.callerUid, fixture.callerGid);
  await rm(fixture.step16EvidencePath, { force: true });
  await execFileAsync(
    process.execPath,
    ["--test", fixture.previewPluginE2ePath],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        RUN_STEP16_DUAL_HOST_E2E: "1",
        TMPDIR: fixture.step16HostsRoot,
        UNDERSTAND_CODE_STEP16_PROVIDER_INSTALLATION_ROOT:
          fixture.installRoot,
        UNDERSTAND_CODE_STEP16_REPOSITORY_ROOT:
          fixture.step16RepositoryRoot,
        UNDERSTAND_CODE_STEP16_INVALID_ROOT: fixture.step16InvalidRoot,
        UNDERSTAND_CODE_STEP16_HOSTS_ROOT: fixture.step16HostsRoot,
        UNDERSTAND_CODE_STEP16_CORPUS_PATH: fixture.alphaGoldCorpusPath,
        UNDERSTAND_CODE_STEP16_EVIDENCE_PATH: fixture.step16EvidencePath,
      },
      maxBuffer: 16 * 1024 * 1024,
      timeout: 25 * 60 * 1000,
    },
  );
  let result;
  try {
    result = JSON.parse(await readFile(fixture.step16EvidencePath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    const { createStep16DualHostBlockedEvidenceV1 } = await import(
      "./step16-dual-host-strong-alpha-linux.mjs"
    );
    result = await createStep16DualHostBlockedEvidenceV1({
      corpusPath: fixture.alphaGoldCorpusPath,
      blocker: "real_host_clis_unavailable",
    });
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

const STEP16_CLOSING_EVIDENCE_NAME_PATTERN =
  /^step16-closing-evidence-[0-9a-f]{32}\.json$/u;

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function assertRootOwnedEvidenceDirectory(metadata) {
  if (
    !metadata.isDirectory() ||
    metadata.uid !== 0n ||
    Number(metadata.mode & 0o777n) !== 0o700 ||
    metadata.nlink < 1n
  ) {
    throw new Error("Step16 closing evidence directory is not root-owned 0700");
  }
}

function assertRootOwnedEvidenceFile(metadata) {
  if (
    !metadata.isFile() ||
    metadata.uid !== 0n ||
    metadata.nlink !== 1n ||
    Number(metadata.mode & 0o777n) !== 0o600
  ) {
    throw new Error("Step16 closing evidence file identity is unsafe");
  }
}

export async function writeStep16ClosingEvidenceV1(targetPath, evidence) {
  if (
    process.geteuid?.() !== 0 ||
    typeof targetPath !== "string" ||
    !isAbsolute(targetPath) ||
    /[\u0000-\u001f\u007f]/u.test(targetPath) ||
    !STEP16_CLOSING_EVIDENCE_NAME_PATTERN.test(basename(targetPath))
  ) {
    throw new Error("Step16 closing evidence path is unsafe");
  }
  const parentPath = dirname(targetPath);
  if (join(parentPath, basename(targetPath)) !== targetPath) {
    throw new Error("Step16 closing evidence path is not canonical");
  }
  const canonicalParentPath = await realpath(parentPath);
  if (canonicalParentPath !== parentPath) {
    throw new Error("Step16 closing evidence directory is not canonical");
  }
  const parentBefore = await lstat(parentPath, { bigint: true });
  assertRootOwnedEvidenceDirectory(parentBefore);

  const directoryHandle = await open(
    parentPath,
    fsConstants.O_RDONLY |
      fsConstants.O_DIRECTORY |
      fsConstants.O_NOFOLLOW,
  );
  let fileHandle;
  let fileIdentity;
  try {
    const openedParent = await directoryHandle.stat({ bigint: true });
    assertRootOwnedEvidenceDirectory(openedParent);
    if (!sameIdentity(parentBefore, openedParent)) {
      throw new Error("Step16 closing evidence directory changed before create");
    }
    fileHandle = await open(
      targetPath,
      fsConstants.O_WRONLY |
        fsConstants.O_CREAT |
        fsConstants.O_EXCL |
        fsConstants.O_NOFOLLOW,
      0o600,
    );
    await fileHandle.chmod(0o600);
    fileIdentity = await fileHandle.stat({ bigint: true });
    assertRootOwnedEvidenceFile(fileIdentity);
    await fileHandle.writeFile(`${JSON.stringify(evidence, null, 2)}\n`);
    await fileHandle.sync();
    const fileAfterWrite = await fileHandle.stat({ bigint: true });
    assertRootOwnedEvidenceFile(fileAfterWrite);
    if (!sameIdentity(fileIdentity, fileAfterWrite)) {
      throw new Error("Step16 closing evidence file changed while writing");
    }
    await directoryHandle.sync();
  } finally {
    await fileHandle?.close().catch(() => undefined);
    await directoryHandle.close().catch(() => undefined);
  }

  const [parentAfter, pathAfter] = await Promise.all([
    lstat(parentPath, { bigint: true }),
    lstat(targetPath, { bigint: true }),
  ]);
  assertRootOwnedEvidenceDirectory(parentAfter);
  assertRootOwnedEvidenceFile(pathAfter);
  if (
    !sameIdentity(parentBefore, parentAfter) ||
    fileIdentity === undefined ||
    !sameIdentity(fileIdentity, pathAfter)
  ) {
    throw new Error("Step16 closing evidence identity changed after fsync");
  }
}

async function exerciseStep16ClosingEvidenceRejectionsV1(targetPath) {
  const parentPath = dirname(targetPath);
  const suffix = randomBytes(16).toString("hex");
  const victimPath = join(parentPath, `nofollow-victim-${suffix}`);
  const symlinkPath = join(
    parentPath,
    `step16-closing-evidence-${suffix}.json`,
  );
  await writeFile(victimPath, "unchanged\n", { mode: 0o600 });
  await symlink(victimPath, symlinkPath);
  let symlinkRejected = false;
  try {
    await writeStep16ClosingEvidenceV1(symlinkPath, { forged: true });
  } catch {
    symlinkRejected = true;
  }
  const victimBytes = await readFile(victimPath, "utf8");
  await Promise.all([
    rm(symlinkPath, { force: true }),
    rm(victimPath, { force: true }),
  ]);
  if (!symlinkRejected || victimBytes !== "unchanged\n") {
    throw new Error("Step16 closing evidence symlink was not rejected zero-write");
  }

  let unknownPathRejected = false;
  try {
    await writeStep16ClosingEvidenceV1(
      join(parentPath, "unknown", `step16-closing-evidence-${suffix}.json`),
      { forged: true },
    );
  } catch {
    unknownPathRejected = true;
  }
  if (!unknownPathRejected) {
    throw new Error("Step16 unknown closing evidence path was accepted");
  }
  return {
    symlinkPreset: "rejected_zero_write",
    unknownPath: "rejected_zero_write",
    create: "exclusive_nofollow_root_owned_fsync",
  };
}

async function orchestrate() {
  if (process.platform !== "linux" || process.geteuid?.() !== 0) throw new Error("three-principal smoke requires Linux root");
  const ext4Mount = "/var/mnt/uc-step15-ext4-root";
  const fs = await statfs(ext4Mount, { bigint: true });
  if (fs.type !== 0xef53n) throw new Error("dedicated ext4 mount is unavailable");
  const work = await mkdtemp(join("/var/tmp", "uc-step15-three-principal-"));
  // The descriptor is intentionally public (root-owned 0644) so the ordinary
  // caller can discover the gateway; keep the enclosing test fixture
  // traversable while retaining 0700 on installation/runtime/key directories.
  await chmod(work, 0o755);
  const installRoot = join(work, "installation");
  const runtimeRoot = join(ext4Mount, `step15-three-principal-${process.pid}-${randomBytes(4).toString("hex")}`);
  const paths = {
    configPath: join(installRoot, "provider-service-config-v1.json"),
    grantKeyPath: join(runtimeRoot, "grant.pk8"),
    fixturePath: join(work, "fixture.json"),
    // Bind-mounted over the root account home in an isolated mount namespace;
    // the production resolver therefore uses real ext4 without touching host
    // installation state.
    authorityHome: join(ext4Mount, `step15-authority-home-${process.pid}-${randomBytes(4).toString("hex")}`),
    nativeProbeRoot: join(ext4Mount, `step15-native-probe-${process.pid}-${randomBytes(4).toString("hex")}`),
    step16RepositoryRoot: join(ext4Mount, `step16-dual-host-repository-${process.pid}-${randomBytes(4).toString("hex")}`),
    step16InvalidRoot: join(ext4Mount, `step16-invalid-root-${process.pid}-${randomBytes(4).toString("hex")}`),
    step16HostsRoot: join(work, "step16-hosts"),
    step16EvidencePath: join(work, "step16-hosts", "step16-evidence.json"),
  };
  const authorityReadyPath = join(work, "authority.ready");
  const authorityStopPath = join(work, "authority.stop");
  const runtimeReadyPath = join(runtimeRoot, ".runtime.ready");
  const runtimeStopPath = join(runtimeRoot, ".runtime.stop");
  const gatewaySocketPath = providerProductionStrongClientGatewaySocketPathV1(installRoot);
  const gatewayReadyPath = join(dirname(gatewaySocketPath), ".gateway.ready");
  const gatewayStopPath = join(dirname(gatewaySocketPath), ".gateway.stop");
  await mkdir(installRoot, { recursive: true, mode: 0o700 });
  await chmod(installRoot, 0o700);
  await mkdir(runtimeRoot, { recursive: true, mode: 0o700 });
  await chown(runtimeRoot, SERVICE_UID, SERVICE_GID);
  await chmod(runtimeRoot, 0o700);
  await mkdir(paths.authorityHome, { recursive: true, mode: 0o700 });
  await chmod(paths.authorityHome, 0o700);
  await mkdir(paths.nativeProbeRoot, { recursive: true, mode: 0o700 });
  await chown(paths.nativeProbeRoot, SERVICE_UID, SERVICE_GID);
  await chmod(paths.nativeProbeRoot, 0o700);
  for (const callerRoot of [
    paths.step16RepositoryRoot,
    paths.step16InvalidRoot,
    paths.step16HostsRoot,
  ]) {
    await mkdir(callerRoot, { recursive: true, mode: 0o700 });
    await chown(callerRoot, CALLER_UID, CALLER_GID);
    await chmod(callerRoot, 0o700);
  }
  let authority;
  let runtime;
  let gateway;
  const childEnvironment = { ...process.env };
  delete childEnvironment.UNDERSTAND_CODE_STEP16_CLOSING_EVIDENCE_PATH;
  const start = (role, env = {}) => spawn(process.execPath, [SCRIPT_PATH, "--role", role, "--fixture", paths.fixturePath], {
    env: { ...childEnvironment, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const startAuthority = () => spawn("/usr/bin/unshare", [
    "--mount",
    "--propagation",
    "private",
    process.execPath,
    SCRIPT_PATH,
    "--role",
    "authority",
    "--fixture",
    paths.fixturePath,
  ], {
    env: childEnvironment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const collect = (child) => {
    let stderr = "";
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.on("exit", (code, signal) => { if (code !== 0 && signal !== "SIGTERM") process.stderr.write(stderr); });
    return { child, get stderr() { return stderr; } };
  };
  const killAndWait = async (tracked, signal = "SIGKILL") => {
    if (tracked.child.exitCode !== null || tracked.child.signalCode !== null) return;
    const exited = new Promise((resolvePromise) => tracked.child.once("exit", resolvePromise));
    tracked.child.kill(signal);
    await exited;
  };
  try {
    await makeFixture(work, installRoot, runtimeRoot, paths);
    const nativeExactObject = await new Promise((resolvePromise, rejectPromise) => {
      const child = collect(start("native-exact-object"));
      let out = "";
      child.child.stdout?.setEncoding("utf8");
      child.child.stdout?.on("data", (chunk) => { out += chunk; });
      child.child.once("error", rejectPromise);
      child.child.once("exit", (code) => code === 0
        ? resolvePromise(out.trim())
        : rejectPromise(new Error(`native exact-object probe failed: ${code} ${child.stderr}`)));
    });
    runtime = collect(start("runtime"));
    await waitForPath(runtimeReadyPath);
    authority = collect(startAuthority());
    await waitForPath(authorityReadyPath);
    gateway = collect(start("gateway"));
    await waitForPath(gatewayReadyPath);
    const caller = await new Promise((resolvePromise, rejectPromise) => {
      const child = collect(start("caller"));
      let out = "";
      child.child.stdout?.setEncoding("utf8");
      child.child.stdout?.on("data", (chunk) => { out += chunk; });
      child.child.once("error", rejectPromise);
      child.child.once("exit", (code) => code === 0
        ? resolvePromise(out.trim())
        : rejectPromise(new Error(`caller failed: ${code} ${child.stderr}`)));
    });
    const denied = await new Promise((resolvePromise) => {
      const child = collect(start("bad-caller"));
      child.child.once("exit", (code) => resolvePromise(code === 0));
    });
    const killedSocketIdentities = {
      broker: await retainedSocketIdentityV1(
        join(runtimeRoot, "strong-mutation-broker-v1.sock"),
        0,
        SERVICE_GID,
      ),
      runtime: await retainedSocketIdentityV1(
        join(runtimeRoot, "provider.sock"),
        SERVICE_UID,
        SERVICE_GID,
      ),
      gateway: await retainedSocketIdentityV1(
        gatewaySocketPath,
        SERVICE_UID,
        CALLER_GID,
      ),
    };
    // Abruptly terminate every production process after the durable response.
    // Restart must recover the exact object, journal, broker grant ledger, and
    // operation-nonce receipts without relying on graceful close hooks.
    await Promise.all([
      killAndWait(gateway),
      killAndWait(runtime),
      killAndWait(authority),
    ]);
    await Promise.all([
      assertRetainedSocketIdentityV1(
        join(runtimeRoot, "strong-mutation-broker-v1.sock"),
        0,
        SERVICE_GID,
        killedSocketIdentities.broker,
      ),
      assertRetainedSocketIdentityV1(
        join(runtimeRoot, "provider.sock"),
        SERVICE_UID,
        SERVICE_GID,
        killedSocketIdentities.runtime,
      ),
      assertRetainedSocketIdentityV1(
        gatewaySocketPath,
        SERVICE_UID,
        CALLER_GID,
        killedSocketIdentities.gateway,
      ),
    ]);
    // Restart all production processes and replay the exact nonces.  The
    // caller process is fresh and still has no key custody.
    await Promise.all([
      rm(gatewayReadyPath, { force: true }),
      rm(gatewayStopPath, { force: true }),
      rm(runtimeReadyPath, { force: true }),
      rm(runtimeStopPath, { force: true }),
      rm(authorityReadyPath, { force: true }),
      rm(authorityStopPath, { force: true }),
    ]);
    authority = collect(startAuthority());
    await waitForPath(authorityReadyPath);
    await retainedSocketIdentityV1(
      join(runtimeRoot, "strong-mutation-broker-v1.sock"),
      0,
      SERVICE_GID,
    );
    runtime = collect(start("runtime"));
    await waitForPath(runtimeReadyPath);
    await retainedSocketIdentityV1(
      join(runtimeRoot, "provider.sock"),
      SERVICE_UID,
      SERVICE_GID,
    );
    gateway = collect(start("gateway"));
    await waitForPath(gatewayReadyPath);
    await retainedSocketIdentityV1(
      gatewaySocketPath,
      SERVICE_UID,
      CALLER_GID,
    );
    const replay = await new Promise((resolvePromise, rejectPromise) => {
      const child = collect(start("caller"));
      let out = "";
      child.child.stdout?.setEncoding("utf8");
      child.child.stdout?.on("data", (chunk) => { out += chunk; });
      child.child.once("exit", (code) => code === 0
        ? resolvePromise(out.trim())
        : rejectPromise(new Error(`replay caller failed: ${code} ${child.stderr}`)));
    });
    const cas = await new Promise((resolvePromise, rejectPromise) => {
      const child = collect(start("cas-probe"));
      let out = "";
      child.child.stdout?.setEncoding("utf8");
      child.child.stdout?.on("data", (chunk) => { out += chunk; });
      child.child.once("exit", (code) => code === 0
        ? resolvePromise(out.trim())
        : rejectPromise(new Error(`CAS/nonce probe failed: ${code} ${child.stderr}`)));
    });
    const secondGatewayRejected = await new Promise((resolvePromise) => {
      const child = collect(start("gateway"));
      child.child.once("exit", (code) => resolvePromise(code !== 0));
    });
    if (!secondGatewayRejected) {
      throw new Error("exclusive gateway lifecycle lease admitted two listeners");
    }
    const liveFixture = await readFixture(paths.fixturePath);
    const liveSnapshotPath = join(
      liveFixture.installRoot,
      PROVIDER_PRODUCTION_STRONG_CLIENT_TRUST_FILE_V1,
    );
    const liveDescriptorPath = providerProductionStrongClientDescriptorPathV1(
      liveFixture.installRoot,
    );
    const liveSnapshot = await readFile(liveSnapshotPath);
    const liveDescriptor = await readFile(liveDescriptorPath);
    let liveGatewayLeaseRefused = false;
    try {
      await uninstallProviderProductionStrongClientTrustV1(
        liveFixture.installRoot,
      );
    } catch (error) {
      liveGatewayLeaseRefused = /trust lifecycle is busy/u.test(
        String(error?.message),
      );
    }
    if (
      !liveGatewayLeaseRefused ||
      !(await readFile(liveSnapshotPath)).equals(liveSnapshot) ||
      !(await readFile(liveDescriptorPath)).equals(liveDescriptor)
    ) throw new Error("live gateway lease did not block uninstall atomically");
    try {
      await access(join(
        liveFixture.installRoot,
        ".provider-production-strong-client-trust-transaction-v1.json",
      ));
      throw new Error("live gateway lease created an uninstall transaction");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    const gatewayExited = new Promise((resolvePromise) =>
      gateway.child.once("exit", resolvePromise)
    );
    await writeFile(gatewayStopPath, "stop\n");
    await gatewayExited;
    await Promise.all([
      rm(gatewayReadyPath, { force: true }),
      rm(gatewayStopPath, { force: true }),
    ]);
    const authorityRotatePath = join(work, "authority.rotate-b");
    const authorityRotatedPath = join(work, "authority.rotated-b");
    await writeFile(authorityRotatePath, "rotate\n", { mode: 0o644 });
    await waitForPath(authorityRotatedPath);
    const rotationFixture = await readFixture(paths.fixturePath);
    const rotatedTrust = await rotateProviderProductionStrongClientTrustV1({
      canonicalInstallationRoot: rotationFixture.installRoot,
      serviceConfig: rotationFixture.config,
      servicePrivateKey: privateKey(SERVICE_SEED),
      trust: trustMaterialV1(
        rotationFixture,
        rotationFixture.targetFingerprintDigest,
        [rotationFixture.acceptance, rotationFixture.acceptanceB],
      ),
    });
    if (rotatedTrust.status !== "rotated") {
      throw new Error("formal Acceptance B trust rotation did not complete");
    }
    gateway = collect(start("gateway"));
    await waitForPath(gatewayReadyPath);
    const trustRotationReplay = await new Promise(
      (resolvePromise, rejectPromise) => {
        const child = collect(start("trust-rotation-replay"));
        let out = "";
        child.child.stdout?.setEncoding("utf8");
        child.child.stdout?.on("data", (chunk) => { out += chunk; });
        child.child.once("exit", (code) => code === 0
          ? resolvePromise(out.trim())
          : rejectPromise(new Error(
              `trust rotation replay failed: ${code} ${child.stderr}`,
            )));
      },
    );
    const dualHost = process.env.RUN_STEP16_DUAL_HOST_E2E === "1"
      ? await new Promise((resolvePromise, rejectPromise) => {
          const child = collect(start("step16-dual-host"));
          let out = "";
          child.child.stdout?.setEncoding("utf8");
          child.child.stdout?.on("data", (chunk) => { out += chunk; });
          child.child.once("exit", (code) => code === 0
            ? resolvePromise(JSON.parse(out.trim()))
            : rejectPromise(new Error(
                `Step16 dual-Host Alpha failed: ${code} ${child.stderr}`,
              )));
        })
      : undefined;
    const closingEvidencePath =
      process.env.UNDERSTAND_CODE_STEP16_CLOSING_EVIDENCE_PATH;
    let closingEvidenceSafety;
    if (dualHost !== undefined) {
      if (closingEvidencePath === undefined) {
        throw new Error("Step16 closing evidence path is required");
      }
      closingEvidenceSafety =
        await exerciseStep16ClosingEvidenceRejectionsV1(closingEvidencePath);
      await writeStep16ClosingEvidenceV1(closingEvidencePath, dualHost);
    }
    const rotatedGatewayExited = new Promise((resolvePromise) =>
      gateway.child.once("exit", resolvePromise)
    );
    await writeFile(gatewayStopPath, "stop\n");
    await rotatedGatewayExited;
    await Promise.all([
      rm(gatewayReadyPath, { force: true }),
      rm(gatewayStopPath, { force: true }),
    ]);
    const lifecycle = await productionTrustLifecycleV1(
      await readFixture(paths.fixturePath),
    );
    const runtimeExited = new Promise((resolvePromise) =>
      runtime.child.once("exit", resolvePromise)
    );
    await writeFile(runtimeStopPath, "stop\n");
    await runtimeExited;
    const durableCurrent = JSON.parse(await readFile(
      join(runtimeRoot, ".runtime.durable-current.json"),
      "utf8",
    ));
    const expectedDurableRevision = dualHost?.providerRevision ?? 4;
    if (
      durableCurrent.lifecycleArtifactCount !== 17 ||
      durableCurrent.businessHeadPresent !== true ||
      durableCurrent.revision !== expectedDurableRevision
    ) {
      throw new Error("runtime durable-current did not preserve the exact lifecycle basis");
    }
    const authorityExited = new Promise((resolvePromise) =>
      authority.child.once("exit", resolvePromise)
    );
    await writeFile(authorityStopPath, "stop\n");
    await authorityExited;
    process.stdout.write(`${JSON.stringify({ profile: "provider_production_strong_object_three_principal_linux_v1", status: "verified", ext4: true, nativeExactObject: JSON.parse(nativeExactObject), caller: JSON.parse(caller), foreignCallerRejected: denied, restartReplay: JSON.parse(replay), restartSockets: { retainedAfterSigkill: "verified", broker: "reclaimed", runtime: "reclaimed", gateway: "reclaimed", startOrder: "authority_runtime_gateway" }, lifecycleLease: { liveUninstall: "refused_zero_write", doubleStart: "rejected" }, casNonce: JSON.parse(cas), trustRotationReplay: JSON.parse(trustRotationReplay), ...(dualHost === undefined ? {} : { dualHost, closingEvidenceSafety }), durableCurrent, lifecycle, authorityUid: 0, runtimeUid: SERVICE_UID, callerUid: CALLER_UID })}\n`);
  } finally {
    for (const child of [gateway?.child, runtime?.child, authority?.child]) {
      if (child && child.exitCode === null) child.kill("SIGTERM");
    }
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
    await rm(runtimeRoot, { recursive: true, force: true }).catch(() => undefined);
    await rm(paths.authorityHome, { recursive: true, force: true }).catch(() => undefined);
    await rm(paths.nativeProbeRoot, { recursive: true, force: true }).catch(() => undefined);
    await rm(paths.step16RepositoryRoot, { recursive: true, force: true }).catch(() => undefined);
    await rm(paths.step16InvalidRoot, { recursive: true, force: true }).catch(() => undefined);
    await rm(paths.step16HostsRoot, { recursive: true, force: true }).catch(() => undefined);
    await rm(`${installRoot}.provider-production-strong-client-v1.json`, { force: true }).catch(() => undefined);
  }
}

const role = process.argv[2];
if (role === "--role") {
  const selected = process.argv[3];
  const fixtureFlag = process.argv.indexOf("--fixture");
  const fixturePath = fixtureFlag >= 0 ? process.argv[fixtureFlag + 1] : undefined;
  if (typeof fixturePath !== "string") throw new Error("fixture path is required");
  if (selected === "authority") await authorityRole(fixturePath);
  else if (selected === "runtime") await runtimeRole(fixturePath);
  else if (selected === "gateway") await gatewayRole(fixturePath);
  else if (selected === "caller") await callerRole(fixturePath, "primary");
  else if (selected === "bad-caller") await callerRole(fixturePath, "bad");
  else if (selected === "cas-probe") await callerRole(fixturePath, "cas-probe");
  else if (selected === "trust-rotation-replay") {
    await callerRole(fixturePath, "trust-rotation-replay");
  }
  else if (selected === "step16-dual-host") await step16DualHostRole(fixturePath);
  else if (selected === "native-exact-object") await nativeExactObjectRole(fixturePath);
  else throw new Error(`unknown role ${selected}`);
} else {
  await orchestrate();
}
