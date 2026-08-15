import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { canonicalizeJcsSafeIntegerV1 } from "../src/jcs.js";
import {
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_HISTORY_QUOTA_ADMISSION_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_COMPLETE_SOURCE_READ_CLOSURE_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PRE_SIDE_EFFECT_PLAN_ADMISSION_CLOSURE_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_REFERENCE_CANDIDATE_DOMAINS_V1,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCreatedAtReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundsReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReservationDescriptorReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectEntryReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceEdgeReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootEntryReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanEnvelopeReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanPayloadReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrePostObservationEqualityReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateIdV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunCutReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceCandidateV1Schema,
  checkedSumProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLogicalObjectBytesReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalObjectSetBytesReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalReferenceSetBytesReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalRootSetBytesReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalUniverseBytesReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionVectorDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReservationIdReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectSetDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceSetDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootSetDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationBudgetsDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationIdReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestAbsenceReferenceDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrePostObservationEqualityContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalClosureContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveChargedUsageReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountSetDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaObservationContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageFromAccountsReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunCutContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceDigestReferenceCandidateV1,
  validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1,
  verifyProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidatePublicHashDagAndEqualityV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-reference-candidate-wire.js";
import {
  deriveProviderFeasibilityEvidenceContentDigestV1,
  deriveProviderFeasibilityEvidenceIdV1,
  deriveProviderFeasibilityEvidencePinV1,
} from "../src/provider-feasibility-evidence-point.js";
import {
  deriveProviderFeasibilitySupportCatalogContentDigestV1,
  deriveProviderFeasibilitySupportCatalogPinV1,
} from "../src/provider-feasibility-support-catalog-point.js";
import {
  deriveProviderRegistryManifestContentDigestV1,
  deriveProviderRegistryManifestGenerationIdV1,
  deriveStoreDurableObjectProviderRegistryEntryContentDigestV1,
} from "../src/provider-registry-records.js";
import { deriveStoreDurableObjectProviderPolicyDigestV1 } from "../src/provider-runtime-attestation-point.js";
import { deriveProviderReleaseTargetUniverseContentDigestV1 } from "../src/provider-release-target-universe-point.js";
import {
  ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
} from "../src/provider-strong-ready-acceptance-candidate.js";
import {
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentReadReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterReferenceCandidateV1Schema,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationSetDigestReferenceCandidateV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterContentDigestReferenceCandidateV1,
} from "../src/provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-reference-candidate-wire.js";

function digestV1(value: string) {
  return `sha256:${value.repeat(64)}`;
}

const identityV1 = `installation-identity-generation:${"a".repeat(22)}`;
const repositoryIdV1 = `provider-migration-same-installation-identity-current-strong-source-normal-repository-reference-candidate:${"b".repeat(64)}`;
const worktreeIdV1 = `provider-migration-same-installation-identity-current-strong-source-normal-worktree-reference-candidate:${"c".repeat(64)}`;

function bindingV1() {
  const unsigned = {
    targetProfileId: `provider-target-profile:${"d".repeat(64)}`,
    providerId: "durable-object-provider:d41-source",
    registryEntryContentDigest: digestV1("1"),
    semanticProviderPolicyDigest: digestV1("2"),
    providerFeasibilityEvidence: {
      locatorProfile: "installation_provider_feasibility_evidence_v1" as const,
      evidenceId: `provider-feasibility-evidence:${"3".repeat(22)}`,
      contentDigest: digestV1("3"),
    },
    runtimeAttestationContentDigest: digestV1("4"),
    bindingDerivationKeyGeneration: 1,
  };
  return ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceCandidateV1Schema.parse({
    ...unsigned,
    bindingReferenceDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceDigestReferenceCandidateV1(unsigned),
  });
}

function storeCutV1(): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1 {
  const unsigned = {
    profile: "provider_migration_same_installation_identity_current_strong_source_normal_store_manifest_current_cut_reference_candidate_v1" as const,
    namespace: {
      installationIdentityGenerationId: identityV1,
      repositoryId: repositoryIdV1,
      worktreeId: worktreeIdV1,
    },
    providerBinding: bindingV1(),
    namespaceRevision: 1,
    headContentDigest: digestV1("5"),
    currentVersionReferenceDigest: digestV1("6"),
    generationCount: 1,
    generationSetDigest: digestV1("7"),
    currentGeneration: {
      generationOrdinal: 1,
      generationReferenceId: `provider-migration-same-installation-identity-current-strong-source-normal-store-manifest-generation-reference-candidate:${"8".repeat(22)}`,
      contentDigest: digestV1("5"),
    },
  };
  return ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1Schema.parse({
    ...unsigned,
    cutContentDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutContentDigestReferenceCandidateV1(unsigned),
  });
}

function completeSourceV1(
  store = storeCutV1(),
  sourceTrustClosureContentDigest = digestV1("2"),
  liveReferenceSchemaDigest = digestV1("4"),
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1 {
  const unorderedRoots = [
    { rootKind: "store_manifest_complete_set" as const, current: store },
    {
      rootKind: "quota_index_and_transition_chain" as const,
      currentQuotaIndexRootContentDigest: digestV1("9"),
      transitionHead: { state: "genesis" as const },
    },
    {
      rootKind: "artifact_descriptor_history_closure" as const,
      rootCount: 0,
      rootSetDigest: digestV1("a"),
    },
    {
      rootKind: "initialization_terminal" as const,
      terminalHeadReferenceDigest: digestV1("b"),
    },
    {
      rootKind: "store_manifest_compare_append_receipt_ledger" as const,
      providerId: store.providerBinding.providerId,
      providerPolicyDigest: store.providerBinding.semanticProviderPolicyDigest,
      receiptCount: 0,
      receiptSetDigest: digestV1("c"),
      receiptLogicalBytes: 0,
    },
    {
      rootKind: "active_recovery_control" as const,
      activeTransactionCount: 0 as const,
      controlUniverseDigest: digestV1("d"),
    },
  ];
  unorderedRoots.sort((left, right) =>
    canonicalizeJcsSafeIntegerV1({ root: left }).localeCompare(
      canonicalizeJcsSafeIntegerV1({ root: right }),
    ),
  );
  const roots = unorderedRoots.map((root, rootOrdinal) =>
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootEntryReferenceCandidateV1Schema.parse({ rootOrdinal, root }),
  );
  const sourceRootOrdinal = roots.findIndex(
    (entry) => entry.root.rootKind === "initialization_terminal",
  );
  const objects = [
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectEntryReferenceCandidateV1Schema.parse({
      objectOrdinal: 0,
      objectKind: "control_state",
      locatorNamespace: "store",
      logicalLocatorReferenceDigest: digestV1("e"),
      semanticLocatorDigest: digestV1("f"),
      contentDigest: digestV1("0"),
      logicalBytes: 17,
      providerBindingReferenceDigest: store.providerBinding.bindingReferenceDigest,
    }),
  ];
  const references = [
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceEdgeReferenceCandidateV1Schema.parse({
      edgeOrdinal: 0,
      from: { sourceKind: "root", rootOrdinal: sourceRootOrdinal },
      referenceSlotReferenceDigest: digestV1("1"),
      referenceSlotDescriptor: {
        sourceKind: "root",
        rootKind: "initialization_terminal",
        schemaFieldPath: "base64url:YWJj",
        occurrenceOrdinal: 0,
      },
      toObjectOrdinal: 0,
    }),
  ];
  const unsigned = {
    profile: "provider_migration_same_installation_identity_current_strong_source_normal_complete_source_read_closure_reference_candidate_v1" as const,
    sourceInstallationIdentityGenerationId: store.namespace.installationIdentityGenerationId,
    sourceTrustClosureContentDigest,
    sourceStoreManifest: store,
    sourceFreezeStateReferenceDigest: digestV1("3"),
    liveReferenceSchemaDigest,
    roots,
    objects,
    references,
    rootCount: roots.length,
    rootSetDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootSetDigestReferenceCandidateV1({ entries: roots }),
    canonicalRootSetBytes:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalRootSetBytesReferenceCandidateV1({ entries: roots }),
    objectCount: objects.length,
    objectSetDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectSetDigestReferenceCandidateV1({ entries: objects }),
    canonicalObjectSetBytes:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalObjectSetBytesReferenceCandidateV1({ entries: objects }),
    logicalObjectBytesTotal:
      checkedSumProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLogicalObjectBytesReferenceCandidateV1(objects),
    referenceCount: references.length,
    referenceSetDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceSetDigestReferenceCandidateV1({ entries: references }),
    canonicalReferenceSetBytes:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalReferenceSetBytesReferenceCandidateV1({ entries: references }),
    canonicalUniverseBytes:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalUniverseBytesReferenceCandidateV1({ roots, objects, references }),
    activeTransactions: [] as [],
  };
  return ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1Schema.parse({
    ...unsigned,
    completeReadClosureContentDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureContentDigestReferenceCandidateV1(unsigned),
  });
}

function budgetsV1(): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1 {
  return ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1Schema.parse({
    profile: "provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_budgets_reference_candidate_v1",
    maxRootEntries: 6,
    maxLiveObjects: 1,
    maxReferenceEdges: 1,
    maxRewriteObjects: 1,
    maxRewriteReferenceMappings: 1,
    maxRewriteSccs: 1,
    maxLogicalObjectBytesTotal: 100,
    maxProgressRecords: 9,
    maxProgressOperationReceipts: 1,
    maxCanonicalUniverseBytes: 1_000_000,
    maxCanonicalReferenceSetBytes: 1_000_000,
    maxCanonicalRewritePlanBytes: 1,
    maxCanonicalRewrittenReferenceSetBytesTotal: 1,
    maxCanonicalSemanticEquivalenceProofBytesTotal: 1,
    maxCanonicalRootRewriteProofSetBytes: 1,
    maxCanonicalZeroLiveProofBytes: 1,
    maxCanonicalReceiptBytesTotal: 1,
    maxCanonicalProgressRecordSetBytes: 1,
    maxCanonicalProgressOperationReceiptBytesTotal: 1,
    maxCanonicalMigrationBytesTotal: 4_194_304,
    maxRetainedMigrationHistoryLogicalBytesTotal: 4_194_304,
    maxRetainedMigrationHistoryProviderAllocatedBytesTotal: 8_388_608,
    maxSingleRecordBytes: 4_194_304,
  });
}

function emptyQuotaSnapshotV1(
  installationIdentityGenerationId = identityV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotReferenceCandidateV1 {
  const accounts: [] = [];
  const usage = ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageReferenceCandidateV1Schema.parse({
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
  });
  const unsigned = {
    profile: "provider_migration_same_installation_identity_current_strong_source_normal_quota_snapshot_reference_candidate_v1" as const,
    installationIdentityGenerationId,
    accounts,
    accountCount: 0,
    accountSetDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountSetDigestReferenceCandidateV1({ entries: accounts }),
    usage,
    reservationRecordCount: 0,
    reservationRecordSetDigest: digestV1("5"),
    reservationRecordLogicalBytes: 0,
    eventCount: 0,
    eventSetDigest: digestV1("6"),
    ledgerEventLogicalBytes: 0,
    receiptCount: 0,
    receiptSetDigest: digestV1("7"),
    operationReceiptLogicalBytes: 0,
    futureTerminalTransitionEscrowCount: 0,
    eventEscrowLogicalBytes: 0,
    receiptEscrowLogicalBytes: 0,
    quotaHighWaterReferenceDigest: digestV1("8"),
  };
  return ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotReferenceCandidateV1Schema.parse({
    ...unsigned,
    quotaSnapshotContentDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotContentDigestReferenceCandidateV1(unsigned),
  });
}

const quotaChargeFieldsV1 = [
  "reservedHistoryLogicalBytes",
  "reservedHistoryProviderAllocatedBytes",
  "reservedObjectReceiptCount",
  "reservedObjectReceiptLogicalBytes",
  "reservedSemanticRootZeroProofCount",
  "reservedSemanticRootZeroProofLogicalBytes",
  "reservedProgressRecordCount",
  "reservedProgressRecordLogicalBytes",
  "reservedProgressOperationReceiptCount",
  "reservedProgressOperationReceiptLogicalBytes",
] as const;

type QuotaChargeFieldV1 = (typeof quotaChargeFieldsV1)[number];

function quotaRoleChargeV1(
  values: Partial<Record<QuotaChargeFieldV1, number>> = {},
) {
  return {
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
    ...values,
    role: "same_identity_journal" as const,
    installationIdentityGenerationId: identityV1,
    policyDigest: digestV1("9"),
    migrationSlotCount: 1 as const,
  };
}

function quotaControlUpperBoundsV1(
  snapshot: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotReferenceCandidateV1,
) {
  const postE = snapshot.futureTerminalTransitionEscrowCount + 3;
  return {
    reservationRecordCountIncrement: 1 as const,
    reservationRecordLogicalBytesUpperBound: 1_048_576 as const,
    reserveEventCountIncrement: 1 as const,
    reserveEventLogicalBytesUpperBound: 262_144 as const,
    reserveReceiptCountIncrement: 1 as const,
    reserveReceiptLogicalBytesUpperBound: 1_048_576 as const,
    postReserveFutureTerminalTransitionEscrowCount: postE,
    prospectiveEventCountIncludingEscrow: snapshot.eventCount + 1 + postE,
    prospectiveEventLogicalBytesIncludingEscrow:
      snapshot.ledgerEventLogicalBytes + 262_144 + postE * 262_144,
    prospectiveReceiptCountIncludingEscrow: snapshot.receiptCount + 1 + postE,
    prospectiveReceiptLogicalBytesIncludingEscrow:
      snapshot.operationReceiptLogicalBytes + 1_048_576 + postE * 1_048_576,
    prospectiveReservationRecordCount: snapshot.reservationRecordCount + 1,
    prospectiveReservationRecordLogicalBytes:
      snapshot.reservationRecordLogicalBytes + 1_048_576,
    currentHighWaterLogicalBytesUpperBound: 1_048_576 as const,
  };
}

function quotaAdmissionV1(
  snapshot: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotReferenceCandidateV1,
  chargeValues: Partial<Record<QuotaChargeFieldV1, number>> = {},
) {
  const charge = quotaRoleChargeV1(chargeValues);
  return {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_history_quota_admission_reference_candidate_v1" as const,
    mode: "same_installation_identity" as const,
    admissionClass: "normal" as const,
    sizingDigest: digestV1("8"),
    quotaSnapshot: snapshot,
    charges: [charge] as [typeof charge],
    prospectiveChargedUsage:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveChargedUsageReferenceCandidateV1(
        { usage: snapshot.usage, charge },
      ),
    controlUpperBounds: quotaControlUpperBoundsV1(snapshot),
    decision: "reference_admissible_at_captured_snapshot" as const,
  };
}

type QuotaAccountStateV1 = "reserved" | "retained";

function quotaSnapshotWithAccountsV1(
  accountInputs: ReadonlyArray<Readonly<{
    state: QuotaAccountStateV1;
    contribution?: Partial<Record<
      | "historyLogicalBytes"
      | "historyProviderAllocatedBytes"
      | "objectReceiptCount"
      | "objectReceiptLogicalBytes"
      | "semanticRootZeroProofCount"
      | "semanticRootZeroProofLogicalBytes"
      | "progressRecordCount"
      | "progressRecordLogicalBytes"
      | "progressOperationReceiptCount"
      | "progressOperationReceiptLogicalBytes",
      number
    >>;
  }>>,
  ledger: Partial<Pick<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotReferenceCandidateV1,
    | "reservationRecordCount"
    | "reservationRecordLogicalBytes"
    | "eventCount"
    | "ledgerEventLogicalBytes"
    | "receiptCount"
    | "operationReceiptLogicalBytes"
  >> = {},
) {
  const accounts = accountInputs.map((input, accountOrdinal) => {
    const reservationOrdinal = accountOrdinal + 1;
    const createdByOperationNonce = accountOrdinal
      .toString(16)
      .padStart(32, "0");
    const contribution = {
      historyLogicalBytes: 0,
      historyProviderAllocatedBytes: 0,
      objectReceiptCount: 0,
      objectReceiptLogicalBytes: 0,
      semanticRootZeroProofCount: 0,
      semanticRootZeroProofLogicalBytes: 0,
      progressRecordCount: 0,
      progressRecordLogicalBytes: 0,
      progressOperationReceiptCount: 0,
      progressOperationReceiptLogicalBytes: 0,
      ...input.contribution,
    };
    return {
      accountOrdinal,
      reservationOrdinal,
      createdByOperationNonce,
      accountReferenceDigest:
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceDigestReferenceCandidateV1(
          {
            installationIdentityGenerationId: identityV1,
            reservationOrdinal,
            createdByOperationNonce,
          },
        ),
      state: input.state,
      migrationSlotCount: 1 as const,
      contribution,
    };
  });
  const usage =
    deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageFromAccountsReferenceCandidateV1(
      accounts,
    );
  const futureTerminalTransitionEscrowCount =
    usage.reservedAccountCount * 3 + usage.retainedAccountCount;
  const unsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_quota_snapshot_reference_candidate_v1" as const,
    installationIdentityGenerationId: identityV1,
    accounts,
    accountCount: accounts.length,
    accountSetDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountSetDigestReferenceCandidateV1(
        { entries: accounts },
      ),
    usage,
    reservationRecordCount: ledger.reservationRecordCount ?? 0,
    reservationRecordSetDigest: digestV1("5"),
    reservationRecordLogicalBytes:
      ledger.reservationRecordLogicalBytes ?? 0,
    eventCount: ledger.eventCount ?? 0,
    eventSetDigest: digestV1("6"),
    ledgerEventLogicalBytes: ledger.ledgerEventLogicalBytes ?? 0,
    receiptCount: ledger.receiptCount ?? 0,
    receiptSetDigest: digestV1("7"),
    operationReceiptLogicalBytes: ledger.operationReceiptLogicalBytes ?? 0,
    futureTerminalTransitionEscrowCount,
    eventEscrowLogicalBytes:
      futureTerminalTransitionEscrowCount * 262_144,
    receiptEscrowLogicalBytes:
      futureTerminalTransitionEscrowCount * 1_048_576,
    quotaHighWaterReferenceDigest: digestV1("8"),
  };
  return ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotReferenceCandidateV1Schema.parse({
    ...unsigned,
    quotaSnapshotContentDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotContentDigestReferenceCandidateV1(
        unsigned,
      ),
  });
}

function cloneJsonV1<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function tokenV1(value: string) {
  return `hmac-sha256:${value.repeat(64)}`;
}

function buildFullValidationV1(
  createdAt = "2026-08-15T01:02:03.004Z",
) {
  const golden = JSON.parse(
    readFileSync(
      new URL(
        "../fixtures/v1/golden/provider-feasibility-support-catalog-point-v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as any;
  const fixtureRequest = golden.positiveVectors[0].request;
  const manifestEnvelope = cloneJsonV1(
    fixtureRequest.registryManifestHistory[
      fixtureRequest.registryManifestHistory.length - 1
    ],
  ) as any;
  const catalogEnvelope = cloneJsonV1(
    fixtureRequest.providerFeasibilitySupportCatalog,
  ) as any;
  const universeEnvelope = cloneJsonV1(
    fixtureRequest.releaseTargetUniverse,
  ) as any;
  const target = cloneJsonV1(universeEnvelope.payload.targets[0].target) as any;
  const catalogTarget = catalogEnvelope.payload.targets.find(
    (entry: any) => entry.target.targetProfileId === target.targetProfileId,
  );
  const sourceCandidate = cloneJsonV1(catalogTarget.candidates[0]) as any;
  const sourceMember = manifestEnvelope.payload.members.find(
    (member: any) =>
      member.disposition === "enabled" &&
      member.providerId === sourceCandidate.providerId,
  );
  const sourceEntry = cloneJsonV1(sourceMember.registryEntry) as any;
  const installationIdentityGenerationId =
    manifestEnvelope.payload.installationIdentityGenerationId as string;
  const manifestPin = {
    locatorProfile: "installation_provider_registry_manifest_v1" as const,
    manifestGeneration: manifestEnvelope.payload.manifestGeneration,
    generationId: deriveProviderRegistryManifestGenerationIdV1(
      manifestEnvelope.payload,
    ),
    contentDigest: deriveProviderRegistryManifestContentDigestV1(
      manifestEnvelope.payload,
    ),
  };
  const catalogPin = deriveProviderFeasibilitySupportCatalogPinV1(
    catalogEnvelope,
  );
  const universePin = {
    locatorProfile: "distribution_provider_release_target_universe_v1" as const,
    universeGeneration: universeEnvelope.payload.universeGeneration,
    contentDigest: deriveProviderReleaseTargetUniverseContentDigestV1(
      universeEnvelope.payload,
    ),
  };
  const sourceSelection = {
    targetProfileId: target.targetProfileId,
    providerId: sourceEntry.providerId,
    registryEntryContentDigest: sourceMember.registryEntryContentDigest,
    semanticProviderPolicyDigest: sourceEntry.semanticProviderPolicyDigest,
    providerFeasibilityEvidence: sourceEntry.providerFeasibilityEvidence,
    runtimeAttestationContentDigest:
      sourceEntry.runtimeAttestation.contentDigest,
    bindingDerivationKeyGeneration:
      sourceEntry.verificationKeys.activeBindingDerivationKeyGeneration,
  };
  const configuration = {
    state: "strong_ready" as const,
    core: {
      activeRootMetadata: cloneJsonV1(fixtureRequest.activeRootMetadata),
      providerRegistryManifest: manifestPin,
      providerSupportCatalog: catalogPin,
      activeWriterSelector: {
        profile: "provider_active_writer_selector_v1" as const,
        selections: [sourceSelection],
      },
    },
    activation: { origin: "bootstrap_or_steady_successor" as const },
  };
  const acceptanceGenerationId =
    deriveProviderStrongReadyAcceptanceStateGenerationIdV1({
      installationIdentityGenerationId,
      acceptanceOrdinal: 1,
      predecessor: { state: "genesis" },
      configuration,
    });
  const acceptancePayload = {
    profile: "provider_acceptance_state_v1" as const,
    generationId: acceptanceGenerationId,
    installationIdentityGenerationId,
    acceptanceOrdinal: 1,
    predecessor: { state: "genesis" as const },
    configuration,
    acceptedAt: "2026-08-15T00:00:00Z",
    acceptanceToken: tokenV1("a"),
  };
  const acceptanceEnvelope =
    ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema.parse({
      schemaVersion: 1,
      recordType: "provider_acceptance_state",
      generationId: acceptanceGenerationId,
      installationIdentityGenerationId,
      acceptedAt: acceptancePayload.acceptedAt,
      contentDigest:
        deriveProviderStrongReadyAcceptanceStateContentDigestV1(
          acceptancePayload,
        ),
      payload: acceptancePayload,
    });
  const enumerationEntry = {
    locatorProfile: "installation_provider_acceptance_state_v1" as const,
    acceptanceOrdinal: 1,
    generationId: acceptanceEnvelope.generationId,
    contentDigest: acceptanceEnvelope.contentDigest,
    commitOperationNonce: "b".repeat(32),
    predecessor: { state: "genesis" as const },
  };
  const generationSetDigest =
    deriveProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationSetDigestReferenceCandidateV1(
      { entries: [enumerationEntry] },
    );
  const enumeration =
    ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationReferenceCandidateV1Schema.parse(
      {
        profile:
          "provider_strong_ready_bootstrap_or_steady_acceptance_generation_enumeration_reference_candidate_v1",
        installationIdentityGenerationId,
        namespaceRevision: 1,
        entries: [enumerationEntry],
        generationCount: 1,
        generationSetDigest,
      },
    );
  const highWaterPayload =
    ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterReferenceCandidateV1Schema.parse(
      {
        profile:
          "provider_strong_ready_bootstrap_or_steady_acceptance_high_water_reference_candidate_v1",
        installationIdentityGenerationId,
        highWaterRevision: 1,
        operationNonce: "b".repeat(32),
        predecessor: { state: "genesis", expectedNamespaceState: "absent" },
        currentAcceptance: {
          locatorProfile: "installation_provider_acceptance_state_v1",
          acceptanceOrdinal: 1,
          generationId: acceptanceEnvelope.generationId,
          contentDigest: acceptanceEnvelope.contentDigest,
        },
        generationCount: 1,
        generationSetDigest,
        acceptedGenerationFloors: {
          rootMetadataGeneration:
            configuration.core.activeRootMetadata.rootGeneration,
          registryManifestGeneration: manifestPin.manifestGeneration,
          supportCatalogGeneration: catalogPin.catalogGeneration,
        },
      },
    );
  const highWater =
    ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1Schema.parse(
      {
        schemaVersion: 1,
        recordType:
          "provider_strong_ready_bootstrap_or_steady_acceptance_high_water_reference_candidate",
        locatorProfile:
          "installation_provider_strong_ready_bootstrap_or_steady_acceptance_high_water_reference_candidate_v1",
        contentDigest:
          deriveProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterContentDigestReferenceCandidateV1(
            highWaterPayload,
          ),
        currentVersionToken: tokenV1("b"),
        payload: highWaterPayload,
      },
    );
  const currentAcceptanceRead =
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentReadReferenceCandidateV1Schema.parse(
      {
        profile:
          "provider_strong_ready_bootstrap_or_steady_acceptance_current_read_reference_candidate_v1",
        highWater,
        enumeration,
      },
    );
  const sourceTrustUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_endpoint_trust_reference_candidate_v1" as const,
    installationIdentityGenerationId,
    currentAcceptanceRead,
    retainedAcceptanceGenerations: [acceptanceEnvelope],
    targetProfileId: target.targetProfileId,
    role: "source_current_strong_writer" as const,
    currentWriterSelection: sourceSelection,
    authorization: {
      kind: "current_strong_writer_reference_candidate" as const,
      selectorOrdinal: 0,
    },
  };
  const sourceTrust =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1Schema.parse(
      {
        ...sourceTrustUnsigned,
        trustClosureContentDigest:
          deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustContentDigestReferenceCandidateV1(
            {
              ...sourceTrustUnsigned,
              trustClosureContentDigest: digestV1("0"),
            },
          ),
      },
    );

  const destinationProviderId = "durable-object-provider:d41-destination";
  const evidenceArtifact = cloneJsonV1(
    fixtureRequest.providerFeasibilitySupportCandidateArtifacts.find(
      (artifact: any) =>
        artifact.providerFeasibilityEvidence.payload.target.targetProfileId ===
        target.targetProfileId,
    ).providerFeasibilityEvidence,
  ) as any;
  evidenceArtifact.payload.providerId = destinationProviderId;
  evidenceArtifact.payload.evidenceId =
    deriveProviderFeasibilityEvidenceIdV1(evidenceArtifact.payload);
  evidenceArtifact.evidenceId = evidenceArtifact.payload.evidenceId;
  evidenceArtifact.contentDigest =
    deriveProviderFeasibilityEvidenceContentDigestV1(evidenceArtifact.payload);
  const evidencePin = deriveProviderFeasibilityEvidencePinV1(evidenceArtifact);
  const prospectiveEntry = cloneJsonV1(sourceEntry) as any;
  prospectiveEntry.providerId = destinationProviderId;
  prospectiveEntry.providerFeasibilityEvidence = cloneJsonV1(evidencePin);
  prospectiveEntry.runtimeAttestation = cloneJsonV1(
    sourceCandidate.runtimeAttestation,
  );
  for (const record of prospectiveEntry.verificationKeys.publicKeyRecords) {
    record.providerId = destinationProviderId;
  }
  for (const record of prospectiveEntry.verificationKeys
    .bindingDerivationGenerationRecords) {
    record.providerId = destinationProviderId;
  }
  const prospectiveRegistryEntryContentDigest =
    deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(
      prospectiveEntry,
    );
  const prospectiveSupportCandidate = cloneJsonV1(sourceCandidate) as any;
  prospectiveSupportCandidate.providerId = destinationProviderId;
  prospectiveSupportCandidate.providerFeasibilityEvidence =
    cloneJsonV1(evidencePin);
  expect(
    deriveStoreDurableObjectProviderPolicyDigestV1(
      prospectiveSupportCandidate.semanticProviderPolicy,
    ),
  ).toBe(prospectiveEntry.semanticProviderPolicyDigest);
  const prospectiveCutUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_prospective_destination_cut_reference_candidate_v1" as const,
    activeRootMetadata: cloneJsonV1(fixtureRequest.activeRootMetadata),
    currentSteadyRegistryManifestPin: manifestPin,
    currentSteadyRegistryManifestEnvelope: manifestEnvelope,
    currentSupportCatalog: catalogPin,
    currentSupportCatalogEnvelope: catalogEnvelope,
    currentReleaseTargetUniverse: universePin,
    currentReleaseTargetUniverseEnvelope: universeEnvelope,
    prospectiveRegistryEntryContentDigest,
    prospectiveRegistryEntry: prospectiveEntry,
    releaseTargetUniverseTargetOrdinal: 0,
    target,
    prospectiveSupportCandidate,
    evidenceEnvelope: evidenceArtifact,
    supportAdmission:
      "not_yet_catalog_signed_or_registry_bound" as const,
    registryMembership: "none" as const,
    migrationPreparedManifest: "none" as const,
    selectorDisposition:
      "outside_current_accepted_steady_selector_cut" as const,
  };
  expect({
    candidateProvider: prospectiveSupportCandidate.providerId,
    entryProvider: prospectiveEntry.providerId,
    evidenceProvider: evidenceArtifact.payload.providerId,
    candidateEvidence: prospectiveSupportCandidate.providerFeasibilityEvidence,
    derivedEvidence: evidencePin,
    entryEvidence: prospectiveEntry.providerFeasibilityEvidence,
    candidatePolicyDigest: deriveStoreDurableObjectProviderPolicyDigestV1(
      prospectiveSupportCandidate.semanticProviderPolicy,
    ),
    entryPolicyDigest: prospectiveEntry.semanticProviderPolicyDigest,
    evidencePolicyDigest: evidenceArtifact.payload.semanticProviderPolicyDigest,
    candidateRuntimeDigest:
      prospectiveSupportCandidate.runtimeAttestation.contentDigest,
    entryRuntimeDigest: prospectiveEntry.runtimeAttestation.contentDigest,
    evidenceRuntimeDigest:
      evidenceArtifact.payload.runtimeAttestationContentDigest,
    evidenceResult: evidenceArtifact.payload.result,
  }).toEqual({
    candidateProvider: destinationProviderId,
    entryProvider: destinationProviderId,
    evidenceProvider: destinationProviderId,
    candidateEvidence: evidencePin,
    derivedEvidence: evidencePin,
    entryEvidence: evidencePin,
    candidatePolicyDigest: prospectiveEntry.semanticProviderPolicyDigest,
    entryPolicyDigest: prospectiveEntry.semanticProviderPolicyDigest,
    evidencePolicyDigest: prospectiveEntry.semanticProviderPolicyDigest,
    candidateRuntimeDigest: prospectiveEntry.runtimeAttestation.contentDigest,
    entryRuntimeDigest: prospectiveEntry.runtimeAttestation.contentDigest,
    evidenceRuntimeDigest: prospectiveEntry.runtimeAttestation.contentDigest,
    evidenceResult: "passed",
  });
  const prospectiveDestinationCut =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutReferenceCandidateV1Schema.parse(
      {
        ...prospectiveCutUnsigned,
        cutContentDigest:
          deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutContentDigestReferenceCandidateV1(
            prospectiveCutUnsigned,
          ),
      },
    );
  const prospectiveWriterProjection = {
    targetProfileId: target.targetProfileId,
    providerId: destinationProviderId,
    registryEntryContentDigest: prospectiveRegistryEntryContentDigest,
    semanticProviderPolicyDigest:
      prospectiveEntry.semanticProviderPolicyDigest,
    providerFeasibilityEvidence: cloneJsonV1(evidencePin),
    runtimeAttestationContentDigest:
      prospectiveEntry.runtimeAttestation.contentDigest,
    bindingDerivationKeyGeneration:
      prospectiveEntry.verificationKeys.activeBindingDerivationKeyGeneration,
  };
  const destinationTrustUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_endpoint_trust_reference_candidate_v1" as const,
    installationIdentityGenerationId,
    currentAcceptanceRead,
    retainedAcceptanceGenerations: [acceptanceEnvelope],
    targetProfileId: target.targetProfileId,
    role: "destination_prospective_not_selected" as const,
    prospectiveWriterProjection,
    authorization: {
      kind: "prospective_migration_destination_reference_candidate" as const,
      prospectiveDestinationCut,
    },
  };
  const destinationTrust =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1Schema.parse(
      {
        ...destinationTrustUnsigned,
        trustClosureContentDigest:
          deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustContentDigestReferenceCandidateV1(
            {
              ...destinationTrustUnsigned,
              trustClosureContentDigest: digestV1("0"),
            },
          ),
      },
    );
  const namespace = {
    installationIdentityGenerationId,
    repositoryId: repositoryIdV1,
    worktreeId: worktreeIdV1,
  };
  const sourceBinding =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceCandidateV1Schema.parse(
      {
        ...sourceSelection,
        bindingReferenceDigest:
          deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceDigestReferenceCandidateV1(
            sourceSelection,
          ),
      },
    );
  const sourceStoreUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_store_manifest_current_cut_reference_candidate_v1" as const,
    namespace,
    providerBinding: sourceBinding,
    namespaceRevision: 1,
    headContentDigest: digestV1("1"),
    currentVersionReferenceDigest: digestV1("2"),
    generationCount: 1,
    generationSetDigest: digestV1("3"),
    currentGeneration: {
      generationOrdinal: 1,
      generationReferenceId: `provider-migration-same-installation-identity-current-strong-source-normal-store-manifest-generation-reference-candidate:${"4".repeat(22)}`,
      contentDigest: digestV1("1"),
    },
  };
  const sourceStore =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1Schema.parse(
      {
        ...sourceStoreUnsigned,
        cutContentDigest:
          deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutContentDigestReferenceCandidateV1(
            sourceStoreUnsigned,
          ),
      },
    );
  const liveReferenceSchemaDigest = digestV1("5");
  const migrationProtocolDigest = digestV1("6");
  const completeSourceReadClosure = completeSourceV1(
    sourceStore,
    sourceTrust.trustClosureContentDigest,
    liveReferenceSchemaDigest,
  );
  const migrationBudgets = budgetsV1();
  const migrationBudgetsDigest =
    deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationBudgetsDigestReferenceCandidateV1(
      migrationBudgets,
    );
  const retainedArtifactUpperBounds =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundsReferenceCandidateV1Schema.parse(
      [
        { artifactKind: "canonical_rewrite_plan", artifactCount: 0, canonicalEnvelopeBytesUpperBoundTotal: 0, providerAllocatedBytesUpperBoundTotal: 0 },
        { artifactKind: "destination_universe", artifactCount: 0, canonicalEnvelopeBytesUpperBoundTotal: 0, providerAllocatedBytesUpperBoundTotal: 0 },
        { artifactKind: "migration_plan", artifactCount: 1, canonicalEnvelopeBytesUpperBoundTotal: 4_194_304, providerAllocatedBytesUpperBoundTotal: 8_388_608 },
        { artifactKind: "object_receipt", artifactCount: 0, canonicalEnvelopeBytesUpperBoundTotal: 0, providerAllocatedBytesUpperBoundTotal: 0 },
        { artifactKind: "progress_operation_receipt", artifactCount: 0, canonicalEnvelopeBytesUpperBoundTotal: 0, providerAllocatedBytesUpperBoundTotal: 0 },
        { artifactKind: "progress_record", artifactCount: 0, canonicalEnvelopeBytesUpperBoundTotal: 0, providerAllocatedBytesUpperBoundTotal: 0 },
        { artifactKind: "sealed_progress_head", artifactCount: 0, canonicalEnvelopeBytesUpperBoundTotal: 0, providerAllocatedBytesUpperBoundTotal: 0 },
        { artifactKind: "semantic_equivalence_proof", artifactCount: 0, canonicalEnvelopeBytesUpperBoundTotal: 0, providerAllocatedBytesUpperBoundTotal: 0 },
        { artifactKind: "source_tombstone", artifactCount: 0, canonicalEnvelopeBytesUpperBoundTotal: 0, providerAllocatedBytesUpperBoundTotal: 0 },
        { artifactKind: "source_universe", artifactCount: 0, canonicalEnvelopeBytesUpperBoundTotal: 0, providerAllocatedBytesUpperBoundTotal: 0 },
        { artifactKind: "zero_live_proof", artifactCount: 0, canonicalEnvelopeBytesUpperBoundTotal: 0, providerAllocatedBytesUpperBoundTotal: 0 },
      ],
    );
  const charge = {
    reservedHistoryLogicalBytes: 4_194_304,
    reservedHistoryProviderAllocatedBytes: 8_388_608,
    reservedObjectReceiptCount: 1,
    reservedObjectReceiptLogicalBytes: 1,
    reservedSemanticRootZeroProofCount: 9,
    reservedSemanticRootZeroProofLogicalBytes: 4,
    reservedProgressRecordCount: 9,
    reservedProgressRecordLogicalBytes: 1,
    reservedProgressOperationReceiptCount: 1,
    reservedProgressOperationReceiptLogicalBytes: 1,
  };
  const sourceDryRunUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_source_dry_run_cut_reference_candidate_v1" as const,
    mode: "same_installation_identity" as const,
    completeSourceReadClosure,
    completeSourceReadClosureContentDigest:
      completeSourceReadClosure.completeReadClosureContentDigest,
    migrationBudgetsDigest,
    retainedArtifactUpperBounds,
    derivedJournalChargeAmounts: charge,
  };
  const sourceDryRunCut =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunCutReferenceCandidateV1Schema.parse(
      {
        ...sourceDryRunUnsigned,
        sourceDryRunCutContentDigest:
          deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunCutContentDigestReferenceCandidateV1(
            sourceDryRunUnsigned,
          ),
      },
    );
  const historyQuotaSizing =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingReferenceCandidateV1Schema.parse(
      {
        profile:
          "provider_migration_same_installation_identity_current_strong_source_normal_history_quota_sizing_reference_candidate_v1",
        sizingProfile:
          "provider_migration_same_installation_identity_current_strong_source_normal_zero_side_effect_complete_source_streaming_dry_run_reference_candidate_v1",
        mode: "same_installation_identity",
        migrationBudgetsDigest,
        sourceDryRunCut,
        sourceDryRunCutContentDigest:
          sourceDryRunCut.sourceDryRunCutContentDigest,
        journalChargeAmounts: charge,
      },
    );
  const historyQuotaSizingDigest =
    deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingDigestReferenceCandidateV1(
      historyQuotaSizing,
    );
  const quotaReferenceSnapshot = emptyQuotaSnapshotV1(
    installationIdentityGenerationId,
  );
  const roleCharge = {
    ...charge,
    role: "same_identity_journal" as const,
    installationIdentityGenerationId,
    policyDigest: digestV1("7"),
    migrationSlotCount: 1 as const,
  };
  const prospectiveChargedUsage =
    deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveChargedUsageReferenceCandidateV1(
      { usage: quotaReferenceSnapshot.usage, charge: roleCharge },
    );
  const historyQuotaAdmission =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema.parse(
      {
        profile:
          "provider_migration_same_installation_identity_current_strong_source_normal_history_quota_admission_reference_candidate_v1",
        mode: "same_installation_identity",
        admissionClass: "normal",
        sizingDigest: historyQuotaSizingDigest,
        quotaSnapshot: quotaReferenceSnapshot,
        charges: [roleCharge],
        prospectiveChargedUsage,
        controlUpperBounds: {
          reservationRecordCountIncrement: 1,
          reservationRecordLogicalBytesUpperBound: 1_048_576,
          reserveEventCountIncrement: 1,
          reserveEventLogicalBytesUpperBound: 262_144,
          reserveReceiptCountIncrement: 1,
          reserveReceiptLogicalBytesUpperBound: 1_048_576,
          postReserveFutureTerminalTransitionEscrowCount: 3,
          prospectiveEventCountIncludingEscrow: 4,
          prospectiveEventLogicalBytesIncludingEscrow: 1_048_576,
          prospectiveReceiptCountIncludingEscrow: 4,
          prospectiveReceiptLogicalBytesIncludingEscrow: 4_194_304,
          prospectiveReservationRecordCount: 1,
          prospectiveReservationRecordLogicalBytes: 1_048_576,
          currentHighWaterLogicalBytesUpperBound: 1_048_576,
        },
        decision: "reference_admissible_at_captured_snapshot",
      },
    );
  const admissionVectorDigest =
    deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionVectorDigestReferenceCandidateV1(
      historyQuotaAdmission,
    );
  const translationUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_namespace_translation_reference_candidate_v1" as const,
    mode: "same_installation_identity" as const,
    relationship:
      "same_identity_repository_and_worktree_exact_equal" as const,
    sourceNamespace: cloneJsonV1(namespace),
    destinationNamespace: cloneJsonV1(namespace),
    journalAuthorityInstallationIdentityGenerationId:
      installationIdentityGenerationId,
  };
  const namespaceTranslation =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceCandidateV1Schema.parse(
      {
        ...translationUnsigned,
        translationReferenceDigest:
          deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceDigestReferenceCandidateV1(
            translationUnsigned,
          ),
      },
    );
  const destinationBinding =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceCandidateV1Schema.parse(
      {
        ...prospectiveWriterProjection,
        bindingReferenceDigest:
          deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceDigestReferenceCandidateV1(
            prospectiveWriterProjection,
          ),
      },
    );
  const initialDestinationUnsigned = {
    state: "absent" as const,
    namespace: cloneJsonV1(namespace),
    providerBinding: destinationBinding,
  };
  const initialDestinationNamespace = {
    ...initialDestinationUnsigned,
    absenceReferenceDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestAbsenceReferenceDigestReferenceCandidateV1(
        initialDestinationUnsigned,
      ),
  };
  const migrationIdFields = {
    mode: "same_installation_identity" as const,
    reason: "provider_decommission" as const,
    identityRelationship: "source_destination_exact_same" as const,
    sourceNamespace: cloneJsonV1(namespace),
    destinationNamespace: cloneJsonV1(namespace),
    namespaceTranslation,
    targetProfileId: target.targetProfileId,
    sourceTrust,
    destinationTrust,
    initialSourceStoreManifest: sourceStore,
    initialDestinationNamespace,
    journalAuthorityInstallationIdentityGenerationId:
      installationIdentityGenerationId,
    migrationBudgets,
    migrationBudgetsDigest,
    migrationHistoryQuotaSizing: historyQuotaSizing,
    migrationHistoryQuotaSizingDigest: historyQuotaSizingDigest,
    migrationHistoryQuotaAdmission: historyQuotaAdmission,
    admissionVectorDigest,
    liveReferenceSchemaDigest,
    migrationProtocolDigest,
  };
  const migrationId =
    deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationIdReferenceCandidateV1(
      migrationIdFields,
    );
  const reservationFields = {
    migrationId,
    role: "same_identity_journal" as const,
    installationIdentityGenerationId,
    admissionVectorDigest,
  };
  const reservationDescriptor =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReservationDescriptorReferenceCandidateV1Schema.parse(
      {
        profile:
          "provider_migration_same_installation_identity_current_strong_source_normal_history_quota_reservation_descriptor_reference_candidate_v1",
        locatorProfile:
          "provider_migration_same_installation_identity_current_strong_source_normal_history_quota_reservation_reference_candidate_v1",
        reservationId:
          deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReservationIdReferenceCandidateV1(
            reservationFields,
          ),
        ...reservationFields,
      },
    );
  const planPayload =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanPayloadReferenceCandidateV1Schema.parse(
      {
        profile:
          "provider_migration_same_installation_identity_current_strong_source_normal_plan_payload_reference_candidate_v1",
        ...migrationIdFields,
        migrationId,
        progressJournalLocatorProfile:
          "provider_migration_same_installation_identity_current_strong_source_normal_progress_head_reference_candidate_v1",
        migrationHistoryQuotaReservations: {
          mode: "same_installation_identity",
          journal: reservationDescriptor,
        },
        createdAt,
      },
    );
  const planCandidate =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanEnvelopeReferenceCandidateV1Schema.parse(
      {
        schemaVersion: 1,
        recordType:
          "provider_migration_same_installation_identity_current_strong_source_normal_plan_reference_candidate",
        mode: "same_installation_identity",
        migrationId,
        sourceRepositoryId: namespace.repositoryId,
        sourceWorktreeId: namespace.worktreeId,
        destinationRepositoryId: namespace.repositoryId,
        destinationWorktreeId: namespace.worktreeId,
        createdAt,
        contentDigest:
          deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanContentDigestReferenceCandidateV1(
            planPayload,
          ),
        payload: planPayload,
      },
    );
  const observation = {
    sourceStoreCutContentDigest: sourceStore.cutContentDigest,
    sourceFreezeStateReferenceDigest:
      completeSourceReadClosure.sourceFreezeStateReferenceDigest,
    sourceTrustClosureContentDigest: sourceTrust.trustClosureContentDigest,
    destinationTrustClosureContentDigest:
      destinationTrust.trustClosureContentDigest,
    destinationNamespaceObservationDigest:
      initialDestinationNamespace.absenceReferenceDigest,
    quotaSnapshotContentDigest:
      quotaReferenceSnapshot.quotaSnapshotContentDigest,
  };
  const prePostObservationEquality =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrePostObservationEqualityReferenceCandidateV1Schema.parse(
      {
        profile:
          "provider_migration_same_installation_identity_current_strong_source_normal_pre_post_observation_equality_reference_candidate_v1",
        pre: cloneJsonV1(observation),
        post: cloneJsonV1(observation),
        equality: "exact",
        equalityContentDigest:
          deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrePostObservationEqualityContentDigestReferenceCandidateV1(
            {
              profile:
                "provider_migration_same_installation_identity_current_strong_source_normal_pre_post_observation_equality_reference_candidate_v1",
              pre: cloneJsonV1(observation),
              post: cloneJsonV1(observation),
              equality: "exact",
            },
          ),
      },
    );
  const quotaObservationUnsigned = {
    preSnapshotContentDigest:
      quotaReferenceSnapshot.quotaSnapshotContentDigest,
    postSnapshotContentDigest:
      quotaReferenceSnapshot.quotaSnapshotContentDigest,
    equality: "exact" as const,
  };
  const request = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_request_reference_candidate_v1" as const,
    mode: "same_installation_identity" as const,
    reason: "provider_decommission" as const,
    admissionClass: "normal" as const,
    createdAt,
    migrationBudgets,
    liveReferenceSchemaDigest,
    migrationProtocolDigest,
  };
  const successUnsigned = {
    authority:
      "none_provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_plan_admission_closure_reference_candidate_only" as const,
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_plan_admission_closure_reference_candidate_v1" as const,
    stopPoint:
      "before_same_installation_identity_migration_history_quota_reservation_write" as const,
    requestContentDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestContentDigestReferenceCandidateV1(
        request,
      ),
    mode: "same_installation_identity" as const,
    reason: "provider_decommission" as const,
    admissionClass: "normal" as const,
    createdAt,
    sourceTrust,
    destinationTrust,
    namespaceTranslation,
    completeSourceReadClosure,
    sourceDryRunCut,
    migrationBudgetsDigest,
    historyQuotaSizing,
    historyQuotaSizingDigest,
    historyQuotaAdmission,
    admissionVectorDigest,
    quotaReferenceSnapshot,
    quotaReferenceObservation: {
      ...quotaObservationUnsigned,
      observationContentDigest:
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaObservationContentDigestReferenceCandidateV1(
          quotaObservationUnsigned,
        ),
    },
    migrationId,
    reservationDescriptors: [reservationDescriptor] as [typeof reservationDescriptor],
    planCandidate,
    prePostObservationEquality,
    sideEffectBoundary: {
      policy:
        "zero_side_effect_before_first_same_installation_identity_migration_history_quota_reservation_write_reference_candidate_v1" as const,
      reservationWrites: 0 as const,
      planPublications: 0 as const,
      acceptanceAppends: 0 as const,
      progressAppends: 0 as const,
      operationReceiptWrites: 0 as const,
      destinationObjectAllocations: 0 as const,
      quotaConsumptions: 0 as const,
      emergencyReserveConsumptions: 0 as const,
      pendingIntents: 0 as const,
    },
    verificationBoundary: {
      hashDag: "self_contained_public_projection_recomputable_v1" as const,
      sourceCompleteness:
        "same_operation_opaque_streaming_capability_exact_once_eof_and_pre_post_continuity_v1" as const,
      locatorAuthenticity:
        "same_cohort_live_reference_schema_bound_strict_locator_commitment_deriver_v1" as const,
      referenceSlotAuthenticity:
        "same_cohort_live_reference_schema_bound_exact_slot_enumerator_and_commitment_deriver_v1" as const,
      quotaCompleteness:
        "same_cohort_opaque_quota_machine_complete_snapshot_and_pre_post_continuity_v1" as const,
      quotaLedgerSemantics:
        "same_cohort_machine_opaque_request_commitment_linkage_without_public_request_replay_v1" as const,
      endpointTrustAuthenticity:
        "same_cohort_opaque_retained_root_registry_catalog_universe_evidence_runtime_closure_v1" as const,
      prospectiveRegistryMaterialOwnership:
        "same_cohort_copied_retained_registry_state_read_only_temporary_admit_no_public_key_material_alias_except_identical_current_feasibility_approver_records_v1" as const,
      prospectiveDestination:
        "signed_genesis_registry_entry_evidence_runtime_and_universe_target_not_catalog_or_manifest_admitted_v1" as const,
      catalogAdmission: "none" as const,
      registryMembership: "none" as const,
      migrationPreparedManifest: "none" as const,
      formalMigrationIdMapping: "none" as const,
      providerAuthority: "none" as const,
      durability: "none" as const,
      migrationExecution: "none" as const,
    },
  };
  const validation =
    validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1(
      {
        ...successUnsigned,
        closureContentDigest:
          deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalClosureContentDigestReferenceCandidateV1(
            successUnsigned,
          ),
      },
    );
  return { validation, sourceTrust, destinationTrust, planPayload };
}

describe("D-41 pure reference-candidate wire", () => {
  it("freezes exactly 35 unique candidate domains and strict narrow scalar profiles", () => {
    expect(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_REFERENCE_CANDIDATE_DOMAINS_V1).toHaveLength(35);
    expect(new Set(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_REFERENCE_CANDIDATE_DOMAINS_V1).size).toBe(35);
    expect(ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCreatedAtReferenceCandidateV1Schema.safeParse("2026-08-15T01:02:03.004Z").success).toBe(true);
    expect(ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCreatedAtReferenceCandidateV1Schema.safeParse("2026-08-15T01:02:03Z").success).toBe(false);
    expect(ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateIdV1Schema.safeParse(`provider-migration:${"a".repeat(22)}`).success).toBe(false);
    const budgets = budgetsV1();
    const request = ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestReferenceCandidateV1Schema.parse({
      profile: "provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_request_reference_candidate_v1",
      mode: "same_installation_identity",
      reason: "provider_decommission",
      admissionClass: "normal",
      createdAt: "2026-08-15T01:02:03.004Z",
      migrationBudgets: budgets,
      liveReferenceSchemaDigest: digestV1("9"),
      migrationProtocolDigest: digestV1("a"),
    });
    expect(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestContentDigestReferenceCandidateV1(request)).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestReferenceCandidateV1Schema.safeParse({ ...request, reason: "semantic_policy_change" }).success).toBe(false);
  });

  it("locks createdAt digest exclusions plus the endpoint/request role-mode-target matrix", () => {
    for (const invalidCreatedAt of [
      "2026-02-30T01:02:03.004Z",
      "2026-08-15T01:02:03.004+00:00",
      "2026-08-15T01:02:03Z",
    ]) {
      expect(
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCreatedAtReferenceCandidateV1Schema.safeParse(
          invalidCreatedAt,
        ).success,
        invalidCreatedAt,
      ).toBe(false);
    }

    const earlier = buildFullValidationV1("2026-08-15T01:02:03.004Z");
    const later = buildFullValidationV1("2026-08-15T01:02:03.005Z");
    expect(later.validation.requestContentDigest).not.toBe(
      earlier.validation.requestContentDigest,
    );
    expect(later.validation.planCandidate.contentDigest).not.toBe(
      earlier.validation.planCandidate.contentDigest,
    );
    expect(later.validation.closureContentDigest).not.toBe(
      earlier.validation.closureContentDigest,
    );
    expect(later.validation.migrationId).toBe(earlier.validation.migrationId);
    expect(later.validation.reservationDescriptors).toEqual(
      earlier.validation.reservationDescriptors,
    );
    expect(later.validation.admissionVectorDigest).toBe(
      earlier.validation.admissionVectorDigest,
    );
    expect(later.validation.historyQuotaSizingDigest).toBe(
      earlier.validation.historyQuotaSizingDigest,
    );
    expect(later.validation.sourceDryRunCut.sourceDryRunCutContentDigest).toBe(
      earlier.validation.sourceDryRunCut.sourceDryRunCutContentDigest,
    );
    expect(
      later.validation.completeSourceReadClosure.completeReadClosureContentDigest,
    ).toBe(
      earlier.validation.completeSourceReadClosure
        .completeReadClosureContentDigest,
    );

    const baseRequest = {
      profile:
        "provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_request_reference_candidate_v1",
      mode: "same_installation_identity",
      reason: "provider_decommission",
      admissionClass: "normal",
      createdAt: earlier.validation.createdAt,
      migrationBudgets: earlier.validation.planCandidate.payload.migrationBudgets,
      liveReferenceSchemaDigest:
        earlier.validation.planCandidate.payload.liveReferenceSchemaDigest,
      migrationProtocolDigest:
        earlier.validation.planCandidate.payload.migrationProtocolDigest,
    };
    const lockedRequestCases = [
      { ...baseRequest, reason: "semantic_policy_change" },
      { ...baseRequest, reason: "binding_derivation_secret_compromise" },
      { ...baseRequest, reason: "post_root_compromise_rebind" },
      { ...baseRequest, reason: "emergency_recovery" },
      { ...baseRequest, mode: "cross_installation_identity" },
      { ...baseRequest, historicalSource: true },
      { ...baseRequest, recoveryOnly: true },
      { ...baseRequest, crossRole: "destination_as_source" },
    ];
    for (const requestCase of lockedRequestCases) {
      expect(
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestReferenceCandidateV1Schema.safeParse(
          requestCase,
        ).success,
      ).toBe(false);
    }

    const otherTarget = `provider-target-profile:${"f".repeat(64)}`;
    const endpointCases = [
      {
        ...cloneJsonV1(earlier.sourceTrust),
        targetProfileId: otherTarget,
      },
      {
        ...cloneJsonV1(earlier.sourceTrust),
        authorization: {
          kind: "current_strong_writer_reference_candidate",
          selectorOrdinal: 1,
        },
      },
      {
        ...cloneJsonV1(earlier.sourceTrust),
        role: "destination_prospective_not_selected",
      },
      {
        ...cloneJsonV1(earlier.destinationTrust),
        targetProfileId: otherTarget,
      },
      {
        ...cloneJsonV1(earlier.destinationTrust),
        role: "source_current_strong_writer",
      },
    ];
    for (const endpointCase of endpointCases) {
      expect(
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1Schema.safeParse(
          endpointCase,
        ).success,
      ).toBe(false);
    }

    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceCandidateV1Schema.safeParse({
        ...earlier.validation.namespaceTranslation,
        mode: "cross_installation_identity",
      }).success,
    ).toBe(false);
  });

  it("rejects rebuilt source-closure claim, ordinal, canonical-tie, locator-pair, and safe-sum tamper as a table", () => {
    const { validation } = buildFullValidationV1();
    const baseClosure = cloneJsonV1(validation.completeSourceReadClosure) as any;
    const rebuildClaimsAndFinal = (closure: any, logicalBytesOverride?: number) => {
      closure.rootCount = closure.roots.length;
      closure.rootSetDigest = deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootSetDigestReferenceCandidateV1({ entries: closure.roots });
      closure.canonicalRootSetBytes = deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalRootSetBytesReferenceCandidateV1({ entries: closure.roots });
      closure.objectCount = closure.objects.length;
      closure.objectSetDigest = deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectSetDigestReferenceCandidateV1({ entries: closure.objects });
      closure.canonicalObjectSetBytes = deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalObjectSetBytesReferenceCandidateV1({ entries: closure.objects });
      closure.logicalObjectBytesTotal = logicalBytesOverride ?? checkedSumProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLogicalObjectBytesReferenceCandidateV1(closure.objects);
      closure.referenceCount = closure.references.length;
      closure.referenceSetDigest = deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceSetDigestReferenceCandidateV1({ entries: closure.references });
      closure.canonicalReferenceSetBytes = deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalReferenceSetBytesReferenceCandidateV1({ entries: closure.references });
      closure.canonicalUniverseBytes = deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalUniverseBytesReferenceCandidateV1({ roots: closure.roots, objects: closure.objects, references: closure.references });
      closure.completeReadClosureContentDigest = deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureContentDigestReferenceCandidateV1(closure);
      return closure;
    };
    const rebuildFinalOnly = (closure: any) => {
      const {
        completeReadClosureContentDigest: _oldDigest,
        ...unsigned
      } = closure;
      closure.completeReadClosureContentDigest = `sha256:${createHash("sha256")
        .update(canonicalizeJcsSafeIntegerV1([
          PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_COMPLETE_SOURCE_READ_CLOSURE_REFERENCE_CANDIDATE_DOMAIN_V1,
          unsigned,
        ]), "utf8")
        .digest("hex")}`;
      return closure;
    };
    const rebuildOutermostFinal = (candidate: any) => {
      const { closureContentDigest: _oldDigest, ...unsigned } = candidate;
      candidate.closureContentDigest = `sha256:${createHash("sha256")
        .update(canonicalizeJcsSafeIntegerV1([
          PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PRE_SIDE_EFFECT_PLAN_ADMISSION_CLOSURE_REFERENCE_CANDIDATE_DOMAIN_V1,
          unsigned,
        ]), "utf8")
        .digest("hex")}`;
      return candidate;
    };
    const objectProjection = ({ objectOrdinal: _ordinal, ...entry }: any) => entry;
    const referenceProjection = ({ edgeOrdinal: _ordinal, ...entry }: any) => entry;
    const compareCanonical = (left: unknown, right: unknown) => {
      const leftKey = canonicalizeJcsSafeIntegerV1(left);
      const rightKey = canonicalizeJcsSafeIntegerV1(right);
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    };

    const twoObjectClosure = cloneJsonV1(baseClosure) as any;
    const originalObject = cloneJsonV1(twoObjectClosure.objects[0]);
    const secondObject = {
      ...originalObject,
      objectKind: "committed_private_blob",
      logicalLocatorReferenceDigest: digestV1("7"),
      semanticLocatorDigest: digestV1("8"),
      contentDigest: digestV1("9"),
      logicalBytes: 19,
    };
    const objectsWithOldOrdinal = [originalObject, secondObject]
      .sort((left, right) => compareCanonical(objectProjection(left), objectProjection(right)))
      .map((entry, objectOrdinal) => ({ ...entry, objectOrdinal }));
    const objectOrdinalByContentDigest = new Map(
      objectsWithOldOrdinal.map((entry) => [entry.contentDigest, entry.objectOrdinal]),
    );
    const rootOrdinal = twoObjectClosure.references[0].from.rootOrdinal;
    const references = [
      {
        ...twoObjectClosure.references[0],
        toObjectOrdinal: objectOrdinalByContentDigest.get(originalObject.contentDigest),
      },
      {
        edgeOrdinal: 1,
        from: { sourceKind: "root", rootOrdinal },
        referenceSlotReferenceDigest: digestV1("2"),
        referenceSlotDescriptor: {
          sourceKind: "root",
          rootKind: "initialization_terminal",
          schemaFieldPath: "base64url:ZGVm",
          occurrenceOrdinal: 1,
        },
        toObjectOrdinal: objectOrdinalByContentDigest.get(secondObject.contentDigest),
      },
    ]
      .sort((left, right) => compareCanonical(referenceProjection(left), referenceProjection(right)))
      .map((entry, edgeOrdinal) => ({ ...entry, edgeOrdinal }));
    twoObjectClosure.objects = objectsWithOldOrdinal;
    twoObjectClosure.references = references;
    rebuildClaimsAndFinal(twoObjectClosure);
    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1Schema.safeParse(twoObjectClosure).success,
    ).toBe(true);

    const cases: Array<{ label: string; valid: boolean; closure: any }> = [];
    for (const [countKey, digestKey, bytesKey] of [
      ["rootCount", "rootSetDigest", "canonicalRootSetBytes"],
      ["objectCount", "objectSetDigest", "canonicalObjectSetBytes"],
      ["referenceCount", "referenceSetDigest", "canonicalReferenceSetBytes"],
    ] as const) {
      for (const delta of [-1, 0, 1] as const) {
        const countTamper = cloneJsonV1(baseClosure) as any;
        countTamper[countKey] += delta;
        cases.push({ label: `${countKey} B${delta < 0 ? "-1" : delta > 0 ? "+1" : ""}`, valid: delta === 0, closure: rebuildFinalOnly(countTamper) });
        const bytesTamper = cloneJsonV1(baseClosure) as any;
        bytesTamper[bytesKey] += delta;
        cases.push({ label: `${bytesKey} B${delta < 0 ? "-1" : delta > 0 ? "+1" : ""}`, valid: delta === 0, closure: rebuildFinalOnly(bytesTamper) });
      }
      const digestTamper = cloneJsonV1(baseClosure) as any;
      digestTamper[digestKey] = digestV1("f");
      cases.push({ label: digestKey, valid: false, closure: rebuildFinalOnly(digestTamper) });
    }
    for (const delta of [-1, 0, 1] as const) {
      for (const key of ["canonicalUniverseBytes", "logicalObjectBytesTotal"] as const) {
        const tamper = cloneJsonV1(baseClosure) as any;
        tamper[key] += delta;
        cases.push({ label: `${key} B${delta < 0 ? "-1" : delta > 0 ? "+1" : ""}`, valid: delta === 0, closure: rebuildFinalOnly(tamper) });
      }
    }
    for (const [label, mutate] of [
      ["caller root ordinal pollution", (closure: any) => { closure.roots[0].rootOrdinal = 1; }],
      ["caller object ordinal pollution", (closure: any) => { closure.objects[0].objectOrdinal = 1; }],
      ["caller reference ordinal pollution", (closure: any) => { closure.references[0].edgeOrdinal = 1; }],
    ] as const) {
      const tamper = cloneJsonV1(baseClosure) as any;
      mutate(tamper);
      cases.push({ label, valid: false, closure: rebuildClaimsAndFinal(tamper) });
    }
    const canonicalTie = cloneJsonV1(twoObjectClosure) as any;
    canonicalTie.objects[1] = { ...canonicalTie.objects[0], objectOrdinal: 1 };
    cases.push({ label: "caller canonical tie excluding ordinal", valid: false, closure: rebuildClaimsAndFinal(canonicalTie) });
    const locatorPairSubstitution = cloneJsonV1(twoObjectClosure) as any;
    expect(locatorPairSubstitution.objects.every((entry: object) => !Object.hasOwn(entry, "privateLocator"))).toBe(true);
    locatorPairSubstitution.objects[1].logicalLocatorReferenceDigest = locatorPairSubstitution.objects[0].logicalLocatorReferenceDigest;
    locatorPairSubstitution.objects[1].semanticLocatorDigest = locatorPairSubstitution.objects[0].semanticLocatorDigest;
    cases.push({ label: "cross-object decoded logical/semantic locator output-pair substitution", valid: false, closure: rebuildClaimsAndFinal(locatorPairSubstitution) });
    const safeSumOverflow = cloneJsonV1(twoObjectClosure) as any;
    safeSumOverflow.objects[0].logicalBytes = Number.MAX_SAFE_INTEGER;
    safeSumOverflow.objects[1].logicalBytes = 1;
    cases.push({ label: "logical object safe-sum overflow", valid: false, closure: rebuildClaimsAndFinal(safeSumOverflow, Number.MAX_SAFE_INTEGER) });

    for (const testCase of cases) {
      const parseClosure = () =>
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1Schema.parse(
          testCase.closure,
        );
      if (testCase.valid) expect(parseClosure, testCase.label).not.toThrow();
      else expect(parseClosure, testCase.label).toThrow();
      const outerCandidate = cloneJsonV1(validation) as any;
      outerCandidate.completeSourceReadClosure = testCase.closure;
      rebuildOutermostFinal(outerCandidate);
      const verify = () => verifyProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidatePublicHashDagAndEqualityV1(outerCandidate);
      if (testCase.valid) expect(verify, testCase.label).not.toThrow();
      else expect(verify, testCase.label).toThrow();
    }
  }, 20_000);

  it("does not late-bind Set.prototype.size while validating the source closure", () => {
    const descriptor = Object.getOwnPropertyDescriptor(Set.prototype, "size");
    expect(descriptor?.get).toBeTypeOf("function");
    Object.defineProperty(Set.prototype, "size", {
      configurable: true,
      get() {
        throw new Error("late-bound Set size getter used");
      },
    });
    try {
      expect(completeSourceV1().rootCount).toBe(6);
    } finally {
      Object.defineProperty(Set.prototype, "size", descriptor!);
    }
  });

  it("closes dry-run sizing, quota account identity, checked prospective usage, and control admission", () => {
    const closure = completeSourceV1();
    const budgets = budgetsV1();
    const migrationBudgetsDigest = deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationBudgetsDigestReferenceCandidateV1(budgets);
    const retainedArtifactUpperBounds = ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryArtifactUpperBoundsReferenceCandidateV1Schema.parse([
      { artifactKind: "canonical_rewrite_plan", artifactCount: 0, canonicalEnvelopeBytesUpperBoundTotal: 0, providerAllocatedBytesUpperBoundTotal: 0 },
      { artifactKind: "destination_universe", artifactCount: 0, canonicalEnvelopeBytesUpperBoundTotal: 0, providerAllocatedBytesUpperBoundTotal: 0 },
      { artifactKind: "migration_plan", artifactCount: 1, canonicalEnvelopeBytesUpperBoundTotal: 4_194_304, providerAllocatedBytesUpperBoundTotal: 8_388_608 },
      { artifactKind: "object_receipt", artifactCount: 0, canonicalEnvelopeBytesUpperBoundTotal: 0, providerAllocatedBytesUpperBoundTotal: 0 },
      { artifactKind: "progress_operation_receipt", artifactCount: 0, canonicalEnvelopeBytesUpperBoundTotal: 0, providerAllocatedBytesUpperBoundTotal: 0 },
      { artifactKind: "progress_record", artifactCount: 0, canonicalEnvelopeBytesUpperBoundTotal: 0, providerAllocatedBytesUpperBoundTotal: 0 },
      { artifactKind: "sealed_progress_head", artifactCount: 0, canonicalEnvelopeBytesUpperBoundTotal: 0, providerAllocatedBytesUpperBoundTotal: 0 },
      { artifactKind: "semantic_equivalence_proof", artifactCount: 0, canonicalEnvelopeBytesUpperBoundTotal: 0, providerAllocatedBytesUpperBoundTotal: 0 },
      { artifactKind: "source_tombstone", artifactCount: 0, canonicalEnvelopeBytesUpperBoundTotal: 0, providerAllocatedBytesUpperBoundTotal: 0 },
      { artifactKind: "source_universe", artifactCount: 0, canonicalEnvelopeBytesUpperBoundTotal: 0, providerAllocatedBytesUpperBoundTotal: 0 },
      { artifactKind: "zero_live_proof", artifactCount: 0, canonicalEnvelopeBytesUpperBoundTotal: 0, providerAllocatedBytesUpperBoundTotal: 0 },
    ]);
    const charge = {
      reservedHistoryLogicalBytes: 4_194_304,
      reservedHistoryProviderAllocatedBytes: 8_388_608,
      reservedObjectReceiptCount: 1,
      reservedObjectReceiptLogicalBytes: 1,
      reservedSemanticRootZeroProofCount: 9,
      reservedSemanticRootZeroProofLogicalBytes: 4,
      reservedProgressRecordCount: 9,
      reservedProgressRecordLogicalBytes: 1,
      reservedProgressOperationReceiptCount: 1,
      reservedProgressOperationReceiptLogicalBytes: 1,
    };
    const dryRunUnsigned = {
      profile: "provider_migration_same_installation_identity_current_strong_source_normal_source_dry_run_cut_reference_candidate_v1" as const,
      mode: "same_installation_identity" as const,
      completeSourceReadClosure: closure,
      completeSourceReadClosureContentDigest: closure.completeReadClosureContentDigest,
      migrationBudgetsDigest,
      retainedArtifactUpperBounds,
      derivedJournalChargeAmounts: charge,
    };
    const sourceDryRunCut = ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunCutReferenceCandidateV1Schema.parse({
      ...dryRunUnsigned,
      sourceDryRunCutContentDigest: deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunCutContentDigestReferenceCandidateV1(dryRunUnsigned),
    });
    const historyQuotaSizing = ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingReferenceCandidateV1Schema.parse({
      profile: "provider_migration_same_installation_identity_current_strong_source_normal_history_quota_sizing_reference_candidate_v1",
      sizingProfile: "provider_migration_same_installation_identity_current_strong_source_normal_zero_side_effect_complete_source_streaming_dry_run_reference_candidate_v1",
      mode: "same_installation_identity",
      migrationBudgetsDigest,
      sourceDryRunCut,
      sourceDryRunCutContentDigest: sourceDryRunCut.sourceDryRunCutContentDigest,
      journalChargeAmounts: charge,
    });
    expect(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingDigestReferenceCandidateV1(historyQuotaSizing)).toMatch(/^sha256:/u);
    const snapshot = emptyQuotaSnapshotV1();
    const roleCharge = { ...charge, role: "same_identity_journal" as const, installationIdentityGenerationId: identityV1, policyDigest: digestV1("9"), migrationSlotCount: 1 as const };
    const prospectiveChargedUsage = deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveChargedUsageReferenceCandidateV1({ usage: snapshot.usage, charge: roleCharge });
    const admission = ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema.parse({
      profile: "provider_migration_same_installation_identity_current_strong_source_normal_history_quota_admission_reference_candidate_v1",
      mode: "same_installation_identity",
      admissionClass: "normal",
      sizingDigest: deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingDigestReferenceCandidateV1(historyQuotaSizing),
      quotaSnapshot: snapshot,
      charges: [roleCharge],
      prospectiveChargedUsage,
      controlUpperBounds: {
        reservationRecordCountIncrement: 1,
        reservationRecordLogicalBytesUpperBound: 1_048_576,
        reserveEventCountIncrement: 1,
        reserveEventLogicalBytesUpperBound: 262_144,
        reserveReceiptCountIncrement: 1,
        reserveReceiptLogicalBytesUpperBound: 1_048_576,
        postReserveFutureTerminalTransitionEscrowCount: 3,
        prospectiveEventCountIncludingEscrow: 4,
        prospectiveEventLogicalBytesIncludingEscrow: 1_048_576,
        prospectiveReceiptCountIncludingEscrow: 4,
        prospectiveReceiptLogicalBytesIncludingEscrow: 4_194_304,
        prospectiveReservationRecordCount: 1,
        prospectiveReservationRecordLogicalBytes: 1_048_576,
        currentHighWaterLogicalBytesUpperBound: 1_048_576,
      },
      decision: "reference_admissible_at_captured_snapshot",
    });
    expect(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionVectorDigestReferenceCandidateV1(admission)).toMatch(/^sha256:/u);
    expect(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceDigestReferenceCandidateV1({ installationIdentityGenerationId: identityV1, reservationOrdinal: 1, createdByOperationNonce: "a".repeat(32) })).not.toBe(
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceDigestReferenceCandidateV1({ installationIdentityGenerationId: identityV1, reservationOrdinal: 2, createdByOperationNonce: "a".repeat(32) }),
    );
    const observationUnsigned = { preSnapshotContentDigest: snapshot.quotaSnapshotContentDigest, postSnapshotContentDigest: snapshot.quotaSnapshotContentDigest, equality: "exact" as const };
    expect(deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaObservationContentDigestReferenceCandidateV1(observationUnsigned)).toMatch(/^sha256:/u);
    expect(ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema.safeParse({ ...admission, prospectiveChargedUsage: { ...prospectiveChargedUsage, chargedMigrationCount: 2 } }).success).toBe(false);
  });

  it("enforces every machine-equivalent charged and reserved category hard cap at B-1/B/B+1", () => {
    const snapshot = emptyQuotaSnapshotV1();
    const capCases = [
      {
        chargeField: "reservedObjectReceiptCount",
        chargedField: "chargedObjectReceiptCount",
        reservedField: "reservedObjectReceiptCount",
        cap: 2_000_000,
      },
      {
        chargeField: "reservedObjectReceiptLogicalBytes",
        chargedField: "chargedObjectReceiptLogicalBytes",
        reservedField: "reservedObjectReceiptLogicalBytes",
        cap: 2_147_483_648,
      },
      {
        chargeField: "reservedSemanticRootZeroProofCount",
        chargedField: "chargedSemanticRootZeroProofCount",
        reservedField: "reservedSemanticRootZeroProofCount",
        cap: 4_000_512,
      },
      {
        chargeField: "reservedSemanticRootZeroProofLogicalBytes",
        chargedField: "chargedSemanticRootZeroProofLogicalBytes",
        reservedField: "reservedSemanticRootZeroProofLogicalBytes",
        cap: 2_147_483_648,
      },
      {
        chargeField: "reservedProgressRecordCount",
        chargedField: "chargedProgressRecordCount",
        reservedField: "reservedProgressRecordCount",
        cap: 4_000_032,
      },
      {
        chargeField: "reservedProgressRecordLogicalBytes",
        chargedField: "chargedProgressRecordLogicalBytes",
        reservedField: "reservedProgressRecordLogicalBytes",
        cap: 2_147_483_648,
      },
      {
        chargeField: "reservedProgressOperationReceiptCount",
        chargedField: "chargedProgressOperationReceiptCount",
        reservedField: "reservedProgressOperationReceiptCount",
        cap: 8_000_000,
      },
      {
        chargeField: "reservedProgressOperationReceiptLogicalBytes",
        chargedField: "chargedProgressOperationReceiptLogicalBytes",
        reservedField: "reservedProgressOperationReceiptLogicalBytes",
        cap: 2_147_483_648,
      },
    ] as const;
    const buildAdmission = (
      chargeField: (typeof capCases)[number]["chargeField"],
      value: number,
    ) => quotaAdmissionV1(snapshot, { [chargeField]: value });

    for (const capCase of capCases) {
      expect(
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema.safeParse(
          buildAdmission(capCase.chargeField, capCase.cap - 1),
        ).success,
        `${capCase.chargeField} B-1`,
      ).toBe(true);
      const atBoundary =
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema.safeParse(
          buildAdmission(capCase.chargeField, capCase.cap),
        );
      expect(atBoundary.success, `${capCase.chargeField} B`).toBe(true);
      if (!atBoundary.success) continue;
      expect(atBoundary.data.prospectiveChargedUsage[capCase.chargedField]).toBe(
        capCase.cap,
      );
      expect(atBoundary.data.prospectiveChargedUsage[capCase.reservedField]).toBe(
        capCase.cap,
      );

      const aboveBoundary =
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema.safeParse(
          buildAdmission(capCase.chargeField, capCase.cap + 1),
        );
      expect(aboveBoundary.success, `${capCase.chargeField} B+1`).toBe(false);
      if (aboveBoundary.success) continue;
      const issuePaths = aboveBoundary.error.issues.map((issue) =>
        issue.path.join("."),
      );
      expect(issuePaths).toContain(
        `prospectiveChargedUsage.${capCase.chargedField}`,
      );
      expect(issuePaths).toContain(
        `prospectiveChargedUsage.${capCase.reservedField}`,
      );
    }

    const correctCategory = buildAdmission(
      "reservedSemanticRootZeroProofCount",
      4_000_512,
    );
    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema.safeParse(
        correctCategory,
      ).success,
    ).toBe(true);
    const categoryTampered = buildAdmission(
      "reservedObjectReceiptCount",
      4_000_512,
    );
    const rebuiltAdmissionVectorDigest = `sha256:${createHash("sha256")
      .update(
        canonicalizeJcsSafeIntegerV1([
          PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_HISTORY_QUOTA_ADMISSION_REFERENCE_CANDIDATE_DOMAIN_V1,
          categoryTampered,
        ]),
        "utf8",
      )
      .digest("hex")}`;
    expect(rebuiltAdmissionVectorDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema.safeParse(
        categoryTampered,
      ).success,
    ).toBe(false);
    expect(() =>
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionVectorDigestReferenceCandidateV1(
        categoryTampered,
      )
    ).toThrow(/fixed per-category hard cap/u);
  });

  it("covers hard/reserve B-1/B/B+1 and all six conservative control equations", () => {
    const emptySnapshot = emptyQuotaSnapshotV1();
    for (const [chargeField, cap] of [
      ["reservedHistoryLogicalBytes", 4_294_967_296],
      ["reservedHistoryProviderAllocatedBytes", 8_589_934_592],
    ] as const) {
      for (const [label, value, expected] of [
        ["B-1", cap - 1, true],
        ["B", cap, true],
        ["B+1", cap + 1, false],
      ] as const) {
        expect(
          ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema.safeParse(
            quotaAdmissionV1(emptySnapshot, { [chargeField]: value }),
          ).success,
          `${chargeField} ${label}`,
        ).toBe(expected);
      }
    }

    for (const [label, prospectiveReservedAccounts, expected] of [
      ["B-1", 3, true],
      ["B", 4, true],
      ["B+1", 5, false],
    ] as const) {
      const snapshot = quotaSnapshotWithAccountsV1(
        Array.from({ length: prospectiveReservedAccounts - 1 }, () => ({
          state: "reserved" as const,
        })),
      );
      const admission = quotaAdmissionV1(snapshot);
      expect(admission.prospectiveChargedUsage.reservedAccountCount).toBe(
        prospectiveReservedAccounts,
      );
      expect(
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema.safeParse(
          admission,
        ).success,
        `reservedAccountCount ${label}`,
      ).toBe(expected);
    }

    const controlCases = [
      {
        field: "prospectiveEventCountIncludingEscrow",
        cap: 4_096,
        offset: 4,
        ledgerField: "eventCount",
      },
      {
        field: "prospectiveEventLogicalBytesIncludingEscrow",
        cap: 67_108_864,
        offset: 1_048_576,
        ledgerField: "ledgerEventLogicalBytes",
      },
      {
        field: "prospectiveReceiptCountIncludingEscrow",
        cap: 4_096,
        offset: 4,
        ledgerField: "receiptCount",
      },
      {
        field: "prospectiveReceiptLogicalBytesIncludingEscrow",
        cap: 268_435_456,
        offset: 4_194_304,
        ledgerField: "operationReceiptLogicalBytes",
      },
      {
        field: "prospectiveReservationRecordCount",
        cap: 4_096,
        offset: 1,
        ledgerField: "reservationRecordCount",
      },
      {
        field: "prospectiveReservationRecordLogicalBytes",
        cap: 67_108_864,
        offset: 1_048_576,
        ledgerField: "reservationRecordLogicalBytes",
      },
    ] as const;
    for (const controlCase of controlCases) {
      for (const [label, prospectiveValue, expected] of [
        ["B-1", controlCase.cap - 1, true],
        ["B", controlCase.cap, true],
        ["B+1", controlCase.cap + 1, false],
      ] as const) {
        const snapshot = quotaSnapshotWithAccountsV1([], {
          [controlCase.ledgerField]: prospectiveValue - controlCase.offset,
        });
        const admission = quotaAdmissionV1(snapshot);
        expect(
          admission.controlUpperBounds[controlCase.field],
          `${controlCase.field} ${label} equation`,
        ).toBe(prospectiveValue);
        expect(
          ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema.safeParse(
            admission,
          ).success,
          `${controlCase.field} ${label} cap`,
        ).toBe(expected);
      }
    }
  });

  it("rejects every prospective-usage ±1, category drift, retained-fold drift, and safe-add overflow", () => {
    const contributionV1 = (first: number) => ({
      historyLogicalBytes: first,
      historyProviderAllocatedBytes: first + 1,
      objectReceiptCount: first + 2,
      objectReceiptLogicalBytes: first + 3,
      semanticRootZeroProofCount: first + 4,
      semanticRootZeroProofLogicalBytes: first + 5,
      progressRecordCount: first + 6,
      progressRecordLogicalBytes: first + 7,
      progressOperationReceiptCount: first + 8,
      progressOperationReceiptLogicalBytes: first + 9,
    });
    const snapshot = quotaSnapshotWithAccountsV1([
      { state: "retained", contribution: contributionV1(2) },
      { state: "reserved", contribution: contributionV1(20) },
    ]);
    const chargeValues = Object.fromEntries(
      quotaChargeFieldsV1.map((field, index) => [field, 40 + index]),
    ) as Record<QuotaChargeFieldV1, number>;
    const admission = quotaAdmissionV1(snapshot, chargeValues);
    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema.safeParse(
        admission,
      ).success,
    ).toBe(true);

    const prospectiveFields = Object.keys(
      admission.prospectiveChargedUsage,
    ) as (keyof typeof admission.prospectiveChargedUsage)[];
    for (const field of prospectiveFields) {
      for (const delta of [-1, 1] as const) {
        const drift = cloneJsonV1(admission);
        drift.prospectiveChargedUsage[field] += delta;
        expect(
          ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema.safeParse(
            drift,
          ).success,
          `${field} ${delta < 0 ? "-1" : "+1"}`,
        ).toBe(false);
      }
    }

    const categoryDrift = cloneJsonV1(admission);
    const objectReceiptCount =
      categoryDrift.prospectiveChargedUsage.chargedObjectReceiptCount;
    categoryDrift.prospectiveChargedUsage.chargedObjectReceiptCount =
      categoryDrift.prospectiveChargedUsage.chargedSemanticRootZeroProofCount;
    categoryDrift.prospectiveChargedUsage.chargedSemanticRootZeroProofCount =
      objectReceiptCount;
    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema.safeParse(
        categoryDrift,
      ).success,
      "wrong category with the same two-field total",
    ).toBe(false);

    const retainedFoldDrift = cloneJsonV1(admission);
    retainedFoldDrift.quotaSnapshot.accounts[0]!.contribution.historyLogicalBytes += 1;
    retainedFoldDrift.quotaSnapshot.accountSetDigest =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountSetDigestReferenceCandidateV1(
        { entries: retainedFoldDrift.quotaSnapshot.accounts },
      );
    retainedFoldDrift.quotaSnapshot.quotaSnapshotContentDigest =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaSnapshotContentDigestReferenceCandidateV1(
        retainedFoldDrift.quotaSnapshot,
      );
    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema.safeParse(
        retainedFoldDrift,
      ).success,
      "retained account contribution fold",
    ).toBe(false);

    const emptyUsage = emptyQuotaSnapshotV1().usage;
    const overflowUsage = {
      ...emptyUsage,
      reservedAccountCount: Number.MAX_SAFE_INTEGER,
    };
    expect(() =>
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveChargedUsageReferenceCandidateV1(
        { usage: overflowUsage, charge: quotaRoleChargeV1() },
      )
    ).toThrow(/overflow/u);
    expect(() =>
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveChargedUsageReferenceCandidateV1(
        {
          usage: {
            ...emptyUsage,
            chargedHistoryLogicalBytes: Number.MAX_SAFE_INTEGER,
          },
          charge: quotaRoleChargeV1({ reservedHistoryLogicalBytes: 1 }),
        },
      )
    ).toThrow(/overflow/u);
  });

  it("validates the complete public success hash-DAG and rejects a rebuilt cross-Acceptance-cut Plan", () => {
    const { validation, destinationTrust, planPayload } =
      buildFullValidationV1();
    expect(
      verifyProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidatePublicHashDagAndEqualityV1(
        validation,
      ).closureContentDigest,
    ).toBe(validation.closureContentDigest);

    const driftDestinationTrust = cloneJsonV1(destinationTrust) as any;
    driftDestinationTrust.retainedAcceptanceGenerations[0].payload.acceptanceToken =
      tokenV1("c");
    driftDestinationTrust.trustClosureContentDigest =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustContentDigestReferenceCandidateV1(
        driftDestinationTrust,
      );
    const independentlyValidDriftTrust =
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1Schema.parse(
        driftDestinationTrust,
      );
    const rebuiltPlan = cloneJsonV1(planPayload) as any;
    rebuiltPlan.destinationTrust = independentlyValidDriftTrust;
    rebuiltPlan.migrationId =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationIdReferenceCandidateV1(
        rebuiltPlan,
      );
    const descriptor = rebuiltPlan.migrationHistoryQuotaReservations.journal;
    descriptor.migrationId = rebuiltPlan.migrationId;
    descriptor.reservationId =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReservationIdReferenceCandidateV1(
        descriptor,
      );
    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPlanPayloadReferenceCandidateV1Schema.safeParse(
        rebuiltPlan,
      ).success,
    ).toBe(false);
  });

  it("rejects a prospective Entry whose approval snapshot differs from the current source and Catalog", () => {
    const { destinationTrust } = buildFullValidationV1();
    const driftTrust = cloneJsonV1(destinationTrust) as any;
    const cut = driftTrust.authorization.prospectiveDestinationCut;
    const approvalRecord =
      cut.prospectiveRegistryEntry.feasibilityApprovalKeys
        .publicKeyRecords[0];
    expect(approvalRecord).toBeDefined();
    approvalRecord.registrySignature =
      `provider-registry-ed25519:${cut.prospectiveRegistryEntry.registryRootKeyId}:${"f".repeat(128)}`;
    cut.prospectiveRegistryEntryContentDigest =
      deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(
        cut.prospectiveRegistryEntry,
      );
    cut.cutContentDigest =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutContentDigestReferenceCandidateV1(
        cut,
      );
    driftTrust.prospectiveWriterProjection.registryEntryContentDigest =
      cut.prospectiveRegistryEntryContentDigest;

    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutReferenceCandidateV1Schema.safeParse(
        cut,
      ).success,
    ).toBe(false);
    const sourceDriftTrust = cloneJsonV1(destinationTrust) as any;
    const sourceDriftCut =
      sourceDriftTrust.authorization.prospectiveDestinationCut;
    const currentSelection = sourceDriftTrust.retainedAcceptanceGenerations
      .at(-1).payload.configuration.core.activeWriterSelector.selections
      .find((selection: any) =>
        selection.targetProfileId === sourceDriftTrust.targetProfileId
      );
    const currentMember = sourceDriftCut.currentSteadyRegistryManifestEnvelope
      .payload.members.find((member: any) =>
        member.disposition === "enabled" &&
        member.providerId === currentSelection.providerId
      );
    currentMember.registryEntry.feasibilityApprovalKeys.publicKeyRecords[0]
      .registrySignature =
        `provider-registry-ed25519:${currentMember.registryEntry.registryRootKeyId}:${"e".repeat(128)}`;
    currentMember.registryEntryContentDigest =
      deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(
        currentMember.registryEntry,
      );
    const manifestPayload =
      sourceDriftCut.currentSteadyRegistryManifestEnvelope.payload;
    manifestPayload.generationId =
      deriveProviderRegistryManifestGenerationIdV1(manifestPayload);
    sourceDriftCut.currentSteadyRegistryManifestEnvelope.generationId =
      manifestPayload.generationId;
    sourceDriftCut.currentSteadyRegistryManifestEnvelope.contentDigest =
      deriveProviderRegistryManifestContentDigestV1(manifestPayload);
    sourceDriftCut.currentSteadyRegistryManifestPin = {
      locatorProfile: "installation_provider_registry_manifest_v1",
      manifestGeneration: manifestPayload.manifestGeneration,
      generationId: manifestPayload.generationId,
      contentDigest:
        sourceDriftCut.currentSteadyRegistryManifestEnvelope.contentDigest,
    };
    sourceDriftCut.cutContentDigest =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutContentDigestReferenceCandidateV1(
        sourceDriftCut,
      );
    expect(() =>
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1Schema.parse(
        sourceDriftTrust,
      )
    ).toThrow(
      /prospective, current-source Registry, and current Catalog approval keys/u,
    );
  });

  it("rejects an Entry Evidence Pin with the wrong evidence ID after rebuilding the outer cut", () => {
    const { destinationTrust } = buildFullValidationV1();
    const driftTrust = cloneJsonV1(destinationTrust) as any;
    const cut = driftTrust.authorization.prospectiveDestinationCut;
    cut.prospectiveRegistryEntry.providerFeasibilityEvidence.evidenceId =
      `provider-feasibility-evidence:${"f".repeat(22)}`;
    cut.prospectiveRegistryEntryContentDigest =
      deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(
        cut.prospectiveRegistryEntry,
      );
    cut.cutContentDigest =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutContentDigestReferenceCandidateV1(
        cut,
      );
    driftTrust.prospectiveWriterProjection.registryEntryContentDigest =
      cut.prospectiveRegistryEntryContentDigest;
    driftTrust.prospectiveWriterProjection.providerFeasibilityEvidence =
      cloneJsonV1(cut.prospectiveRegistryEntry.providerFeasibilityEvidence);

    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutReferenceCandidateV1Schema.safeParse(
        cut,
      ).success,
    ).toBe(false);
  });

  it("rejects a self-rebuilt current Catalog that pins a different Universe", () => {
    const { destinationTrust } = buildFullValidationV1();
    if (destinationTrust.role !== "destination_prospective_not_selected") {
      throw new TypeError("fixture lost destination trust role");
    }
    const cut = cloneJsonV1(
      destinationTrust.authorization.prospectiveDestinationCut,
    ) as any;
    cut.currentSupportCatalogEnvelope.payload.releaseTargetUniverse = {
      ...cut.currentSupportCatalogEnvelope.payload.releaseTargetUniverse,
      contentDigest: digestV1("f"),
    };
    cut.currentSupportCatalogEnvelope.contentDigest =
      deriveProviderFeasibilitySupportCatalogContentDigestV1(
        cut.currentSupportCatalogEnvelope.payload,
      );
    cut.currentSupportCatalog =
      deriveProviderFeasibilitySupportCatalogPinV1(
        cut.currentSupportCatalogEnvelope,
      );
    cut.cutContentDigest =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutContentDigestReferenceCandidateV1(
        cut,
      );

    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutReferenceCandidateV1Schema.safeParse(
        cut,
      ).success,
    ).toBe(false);
  });

  it("rejects public hash-DAG, prospective Entry/Evidence, support-Pin, and formal-routing tamper as a table", () => {
    const { validation } = buildFullValidationV1();
    const otherUniverseTarget =
      validation.destinationTrust.authorization.prospectiveDestinationCut
        .currentReleaseTargetUniverseEnvelope.payload.targets[1]!.target;
    const cases: readonly {
      readonly label: string;
      readonly mutate: (candidate: any) => void;
    }[] = [
      {
        label: "request digest",
        mutate(candidate) {
          candidate.requestContentDigest = digestV1("f");
        },
      },
      {
        label: "top-level source dry-run cut",
        mutate(candidate) {
          candidate.sourceDryRunCut.sourceDryRunCutContentDigest = digestV1("f");
        },
      },
      {
        label: "pre/post equality digest",
        mutate(candidate) {
          candidate.prePostObservationEquality.equalityContentDigest =
            digestV1("f");
        },
      },
      {
        label: "prospective Entry unsigned genesis field",
        mutate(candidate) {
          const cut =
            candidate.destinationTrust.authorization.prospectiveDestinationCut;
          cut.prospectiveRegistryEntry.registryGeneration = 2;
        },
      },
      {
        label: "prospective Entry digest",
        mutate(candidate) {
          candidate.destinationTrust.authorization.prospectiveDestinationCut
            .prospectiveRegistryEntryContentDigest = digestV1("f");
        },
      },
      {
        label: "Evidence target with internally rebuilt ID/content",
        mutate(candidate) {
          const evidence =
            candidate.destinationTrust.authorization.prospectiveDestinationCut
              .evidenceEnvelope;
          evidence.payload.target = cloneJsonV1(otherUniverseTarget);
          evidence.payload.evidenceId =
            deriveProviderFeasibilityEvidenceIdV1(evidence.payload);
          evidence.evidenceId = evidence.payload.evidenceId;
          evidence.contentDigest =
            deriveProviderFeasibilityEvidenceContentDigestV1(evidence.payload);
        },
      },
      {
        label: "Evidence outer ID",
        mutate(candidate) {
          candidate.destinationTrust.authorization.prospectiveDestinationCut
            .evidenceEnvelope.evidenceId =
              `provider-feasibility-evidence:${"f".repeat(22)}`;
        },
      },
      {
        label: "Evidence payload ID",
        mutate(candidate) {
          candidate.destinationTrust.authorization.prospectiveDestinationCut
            .evidenceEnvelope.payload.evidenceId =
              `provider-feasibility-evidence:${"f".repeat(22)}`;
        },
      },
      {
        label: "Evidence content digest",
        mutate(candidate) {
          candidate.destinationTrust.authorization.prospectiveDestinationCut
            .evidenceEnvelope.contentDigest = digestV1("f");
        },
      },
      {
        label: "support Pin",
        mutate(candidate) {
          candidate.destinationTrust.authorization.prospectiveDestinationCut
            .prospectiveSupportCandidate.providerFeasibilityEvidence
            .contentDigest = digestV1("f");
        },
      },
      {
        label: "D-41 candidate ID used as formal Registry routing ID",
        mutate(candidate) {
          const cut =
            candidate.destinationTrust.authorization.prospectiveDestinationCut;
          cut.currentSteadyRegistryManifestEnvelope.payload.routing = {
            state: "migration",
            migrationId: candidate.migrationId,
            sourceProviderId:
              candidate.sourceTrust.currentWriterSelection.providerId,
            destinationProviderId:
              cut.prospectiveRegistryEntry.providerId,
            activeForMigrationWrites:
              candidate.sourceTrust.currentWriterSelection.providerId,
            phase: "prepared",
          };
        },
      },
    ];

    for (const tamperCase of cases) {
      const candidate = cloneJsonV1(validation) as any;
      tamperCase.mutate(candidate);
      try {
        candidate.closureContentDigest =
          deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalClosureContentDigestReferenceCandidateV1(
            candidate,
          );
      } catch {
        // Some inner schemas reject before a final closure can be rebuilt.
      }
      expect(
        () =>
          validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1(
            candidate,
          ),
        tamperCase.label,
      ).toThrow();
    }
  });

  it("rejects rebuilt Runtime-Pin and Root/Distribution cross-cut contradictions", () => {
    const { destinationTrust } = buildFullValidationV1();
    if (destinationTrust.role !== "destination_prospective_not_selected") {
      throw new TypeError("fixture lost destination trust role");
    }
    const original = destinationTrust.authorization.prospectiveDestinationCut;

    const runtimeDrift = cloneJsonV1(original) as any;
    runtimeDrift.prospectiveSupportCandidate.runtimeAttestation.payload.issuedAt =
      "2026-08-15T00:00:01Z";
    runtimeDrift.cutContentDigest =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutContentDigestReferenceCandidateV1(
        runtimeDrift,
      );
    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutReferenceCandidateV1Schema.safeParse(
        runtimeDrift,
      ).success,
    ).toBe(false);

    const manifestIdentityDrift = cloneJsonV1(original) as any;
    const manifestPayload =
      manifestIdentityDrift.currentSteadyRegistryManifestEnvelope.payload;
    manifestPayload.installationIdentityGenerationId =
      `installation-identity-generation:${"f".repeat(22)}`;
    manifestPayload.generationId =
      deriveProviderRegistryManifestGenerationIdV1(manifestPayload);
    manifestIdentityDrift.currentSteadyRegistryManifestEnvelope.generationId =
      manifestPayload.generationId;
    manifestIdentityDrift.currentSteadyRegistryManifestEnvelope.contentDigest =
      deriveProviderRegistryManifestContentDigestV1(manifestPayload);
    manifestIdentityDrift.currentSteadyRegistryManifestPin = {
      locatorProfile: "installation_provider_registry_manifest_v1",
      manifestGeneration: manifestPayload.manifestGeneration,
      generationId: manifestPayload.generationId,
      contentDigest:
        manifestIdentityDrift.currentSteadyRegistryManifestEnvelope
          .contentDigest,
    };
    manifestIdentityDrift.cutContentDigest =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutContentDigestReferenceCandidateV1(
        manifestIdentityDrift,
      );
    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutReferenceCandidateV1Schema.safeParse(
        manifestIdentityDrift,
      ).success,
    ).toBe(false);

    const entryRootDrift = cloneJsonV1(original) as any;
    entryRootDrift.prospectiveRegistryEntry.activeRootMetadata = {
      ...entryRootDrift.prospectiveRegistryEntry.activeRootMetadata,
      contentDigest: digestV1("f"),
    };
    entryRootDrift.prospectiveRegistryEntryContentDigest =
      deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(
        entryRootDrift.prospectiveRegistryEntry,
      );
    entryRootDrift.cutContentDigest =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutContentDigestReferenceCandidateV1(
        entryRootDrift,
      );
    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutReferenceCandidateV1Schema.safeParse(
        entryRootDrift,
      ).success,
    ).toBe(false);

    const taxonomyDrift = cloneJsonV1(original) as any;
    taxonomyDrift.currentSupportCatalogEnvelope.payload
      .publicSupportTaxonomy.contentDigest = digestV1("f");
    taxonomyDrift.currentSupportCatalogEnvelope.contentDigest =
      deriveProviderFeasibilitySupportCatalogContentDigestV1(
        taxonomyDrift.currentSupportCatalogEnvelope.payload,
      );
    taxonomyDrift.currentSupportCatalog =
      deriveProviderFeasibilitySupportCatalogPinV1(
        taxonomyDrift.currentSupportCatalogEnvelope,
      );
    taxonomyDrift.cutContentDigest =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutContentDigestReferenceCandidateV1(
        taxonomyDrift,
      );
    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutReferenceCandidateV1Schema.safeParse(
        taxonomyDrift,
      ).success,
    ).toBe(false);
  });
});
