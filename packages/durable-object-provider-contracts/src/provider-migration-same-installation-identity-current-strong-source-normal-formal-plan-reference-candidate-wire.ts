import { z } from "./zod-runtime.js";

import { canonicalizeJcsSafeIntegerV1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  ProviderMigrationIdV1Schema,
  ProviderTargetProfileIdV1Schema,
  type ContentDigestV1,
} from "./primitives.js";
import {
  ProviderFeasibilitySupportCandidateV1Schema,
  ProviderFeasibilitySupportCatalogPinV1Schema,
} from "./provider-feasibility-support-catalog-point.js";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCreatedAtReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalInitialDestinationNamespaceReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateIdV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunCutReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1Schema,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-reference-candidate-wire.js";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1Schema,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-prepared-catalog-successor-reference-candidate-wire.js";
import {
  ProviderRegistryManifestMemberV1Schema,
  ProviderRegistryManifestPinV1Schema,
} from "./provider-registry-records.js";
import { ProviderFeasibilityTargetV1Schema } from "./provider-target-discovery-point.js";
import {
  deepFreezeProviderPointDetachedDataTreeV1,
} from "./provider-point-raw-admission-internal.js";
import { sha256InternalV1 } from "./sha256.js";

const CapturedObjectFreezeV1 = Object.freeze;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedStringPrototypeSliceV1 = String.prototype.slice;
const CapturedTextEncoderV1 = TextEncoder;
const CapturedTextEncoderPrototypeEncodeV1 = TextEncoder.prototype.encode;
const CapturedTypeErrorV1 = TypeError;
const CapturedUtf8EncoderV1 = CapturedObjectFreezeV1(
  new CapturedTextEncoderV1(),
);

const FORMAL_RESERVATION_ID_DOMAIN_V1 =
  "provider-migration-same-installation-identity-current-strong-source-normal-formal-history-quota-reservation-id-v1" as const;
const FORMAL_PLAN_CONTENT_DOMAIN_V1 =
  "provider-migration-same-installation-identity-current-strong-source-normal-formal-plan-content-v1" as const;
const FORMAL_PLAN_CLOSURE_DOMAIN_V1 =
  "provider-migration-same-installation-identity-current-strong-source-normal-formal-plan-reference-candidate-v1" as const;
const OrdinalV1Schema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);

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
  for (let index = 0; index < bytes.byteLength; index += 1) {
    const byte = bytes[index]!;
    output += alphabet[(byte >>> 4) & 0x0f]! + alphabet[byte & 0x0f]!;
  }
  return output;
}

function digestForDomainV1(domain: string, fields: unknown): ContentDigestV1 {
  const preimage = canonicalizeJcsSafeIntegerV1([domain, fields]);
  return ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHexV1(sha256InternalV1(encodeUtf8V1(preimage)))}`,
  );
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  return (
    canonicalizeJcsSafeIntegerV1(left) === canonicalizeJcsSafeIntegerV1(right)
  );
}

function addIssueV1(
  context: z.RefinementCtx,
  path: PropertyKey[],
  message: string,
): void {
  context.addIssue({ code: "custom", path, message });
}

const CandidateToFormalMigrationIdMappingV1Schema = z.strictObject({
  profile: z.literal(
    "provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_plan_admission_closure_reference_candidate_to_formal_id_v1",
  ),
  candidateMigrationId:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateIdV1Schema,
  formalMigrationId: ProviderMigrationIdV1Schema,
  derivation: z.literal(
    "sha256_jcs_domain_preimage_candidate_migration_id_only_first_22_lowercase_hex_v1",
  ),
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCandidateToFormalMigrationIdMappingV1 =
  z.infer<typeof CandidateToFormalMigrationIdMappingV1Schema>;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalDestinationTrustReferenceCandidateV1Schema =
  z
    .strictObject({
      profile: z.literal(
        "provider_migration_same_installation_identity_current_strong_source_normal_formal_destination_trust_reference_candidate_v1",
      ),
      destinationEndpointTrust:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1Schema,
      currentAcceptanceSelection: z.literal(
        "destination_absent_not_selected_current_source_remains_selected_v1",
      ),
      preparedRegistryManifestPin: ProviderRegistryManifestPinV1Schema,
      preparedRegistryMemberOrdinal: OrdinalV1Schema,
      preparedRegistryMember: ProviderRegistryManifestMemberV1Schema,
      preparedSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1Schema,
      preparedSupportCatalogTargetOrdinal: OrdinalV1Schema,
      preparedSupportCatalogCandidateOrdinal: OrdinalV1Schema,
      target: ProviderFeasibilityTargetV1Schema,
      candidate: ProviderFeasibilitySupportCandidateV1Schema,
      relationship: z.literal(
        "formally_admitted_in_prepared_registry_and_catalog_not_selected_by_current_acceptance_v1",
      ),
    })
    .superRefine((trust, context) => {
      if (
        trust.destinationEndpointTrust.role !==
        "destination_prospective_not_selected"
      ) {
        addIssueV1(
          context,
          ["destinationEndpointTrust"],
          "formal destination trust must retain the exact D-41 not-selected endpoint proof",
        );
      }
      if (
        trust.preparedRegistryMember.providerId !== trust.candidate.providerId ||
        trust.preparedRegistryMember.disposition !== "enabled"
      ) {
        addIssueV1(
          context,
          ["preparedRegistryMember"],
          "formal destination material must bind one enabled Registry member to one Catalog candidate",
        );
      }
    });
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalDestinationTrustReferenceCandidateV1 =
  z.infer<
    typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalDestinationTrustReferenceCandidateV1Schema
  >;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationIdV1Schema =
  z
    .string()
    .regex(
      /^provider-migration-same-installation-identity-current-strong-source-normal-formal-history-quota-reservation:[0-9a-f]{22}$/u,
    )
    .brand<"ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationIdV1">();
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationIdV1 =
  z.infer<
    typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationIdV1Schema
  >;

const FormalReservationIdFieldsV1Schema = z.strictObject({
  formalMigrationId: ProviderMigrationIdV1Schema,
  role: z.literal("same_identity_journal"),
  installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1Schema,
  admissionVectorDigest: ContentDigestV1Schema,
});

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationIdV1(
  input: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationIdV1 {
  const value = input as Readonly<Record<string, unknown>> | null;
  const fields = FormalReservationIdFieldsV1Schema.parse({
    formalMigrationId: value?.formalMigrationId,
    role: value?.role,
    installationIdentityGenerationId:
      value?.installationIdentityGenerationId,
    admissionVectorDigest: value?.admissionVectorDigest,
  });
  const digest = digestForDomainV1(FORMAL_RESERVATION_ID_DOMAIN_V1, fields);
  const lowerHex = CapturedReflectApplyV1(
    CapturedStringPrototypeSliceV1,
    digest,
    ["sha256:".length, "sha256:".length + 22],
  ) as string;
  return ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationIdV1Schema.parse(
    `provider-migration-same-installation-identity-current-strong-source-normal-formal-history-quota-reservation:${lowerHex}`,
  );
}

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationDescriptorReferenceCandidateV1Schema =
  z
    .strictObject({
      profile: z.literal(
        "provider_migration_same_installation_identity_current_strong_source_normal_formal_history_quota_reservation_descriptor_reference_candidate_v1",
      ),
      locatorProfile: z.literal(
        "provider_migration_same_installation_identity_current_strong_source_normal_formal_history_quota_reservation_reference_candidate_v1",
      ),
      reservationId:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationIdV1Schema,
      formalMigrationId: ProviderMigrationIdV1Schema,
      installationIdentityGenerationId:
        InstallationIdentityGenerationIdV1Schema,
      role: z.literal("same_identity_journal"),
      admissionVectorDigest: ContentDigestV1Schema,
    })
    .superRefine((descriptor, context) => {
      if (
        descriptor.reservationId !==
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationIdV1(
          descriptor,
        )
      ) {
        addIssueV1(
          context,
          ["reservationId"],
          "formal reservation ID must bind formal Migration ID, role, Identity, and admission vector only",
        );
      }
    });
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationDescriptorReferenceCandidateV1 =
  z.infer<
    typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationDescriptorReferenceCandidateV1Schema
  >;

const SourceEndpointTrustOnlyV1Schema =
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1Schema.refine(
    (trust) => trust.role === "source_current_strong_writer",
    "sourceTrust must retain the current strong writer branch",
  );

const FormalPlanPayloadShapeV1 = {
  profile: z.literal(
    "provider_migration_same_installation_identity_current_strong_source_normal_formal_plan_payload_reference_candidate_v1",
  ),
  mode: z.literal("same_installation_identity"),
  migrationId: ProviderMigrationIdV1Schema,
  reason: z.literal("provider_decommission"),
  identityRelationship: z.literal("source_destination_exact_same"),
  candidateToFormalMigrationIdMapping:
    CandidateToFormalMigrationIdMappingV1Schema,
  sourceNamespace:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceReferenceCandidateV1Schema,
  destinationNamespace:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceReferenceCandidateV1Schema,
  namespaceTranslation:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceCandidateV1Schema,
  targetProfileId: ProviderTargetProfileIdV1Schema,
  sourceTrust: SourceEndpointTrustOnlyV1Schema,
  formalDestinationTrust:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalDestinationTrustReferenceCandidateV1Schema,
  completeSourceReadClosure:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1Schema,
  sourceDryRunCut:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunCutReferenceCandidateV1Schema,
  initialSourceStoreManifest:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1Schema,
  initialDestinationNamespace:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalInitialDestinationNamespaceReferenceCandidateV1Schema,
  journalAuthorityInstallationIdentityGenerationId:
    InstallationIdentityGenerationIdV1Schema,
  progressJournalLocatorProfile: z.literal(
    "provider_migration_same_installation_identity_current_strong_source_normal_progress_head_reference_candidate_v1",
  ),
  migrationBudgets:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1Schema,
  migrationBudgetsDigest: ContentDigestV1Schema,
  migrationHistoryQuotaSizing:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaSizingReferenceCandidateV1Schema,
  migrationHistoryQuotaSizingDigest: ContentDigestV1Schema,
  migrationHistoryQuotaAdmission:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionReferenceCandidateV1Schema,
  admissionVectorDigest: ContentDigestV1Schema,
  migrationHistoryQuotaReservations: z.strictObject({
    mode: z.literal("same_installation_identity"),
    journal:
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationDescriptorReferenceCandidateV1Schema,
  }),
  preparedRegistryManifestPin: ProviderRegistryManifestPinV1Schema,
  preparedSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1Schema,
  liveReferenceSchemaDigest: ContentDigestV1Schema,
  migrationProtocolDigest: ContentDigestV1Schema,
  createdAt:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCreatedAtReferenceCandidateV1Schema,
} as const;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPayloadReferenceCandidateV1Schema =
  z.strictObject(FormalPlanPayloadShapeV1).superRefine((plan, context) => {
    const mapping = plan.candidateToFormalMigrationIdMapping;
    const descriptor = plan.migrationHistoryQuotaReservations.journal;
    const destinationEndpoint =
      plan.formalDestinationTrust.destinationEndpointTrust;
    if (
      plan.migrationId !== mapping.formalMigrationId ||
      descriptor.formalMigrationId !== plan.migrationId ||
      descriptor.installationIdentityGenerationId !==
        plan.journalAuthorityInstallationIdentityGenerationId ||
      descriptor.admissionVectorDigest !== plan.admissionVectorDigest
    ) {
      addIssueV1(
        context,
        ["migrationHistoryQuotaReservations", "journal"],
        "formal mapping, Plan ID, reservation descriptor, Identity, and admission vector must close exactly",
      );
    }
    if (
      !canonicalEqualV1(plan.sourceNamespace, plan.destinationNamespace) ||
      !canonicalEqualV1(
        plan.sourceNamespace,
        plan.namespaceTranslation.sourceNamespace,
      ) ||
      !canonicalEqualV1(
        plan.destinationNamespace,
        plan.namespaceTranslation.destinationNamespace,
      ) ||
      !canonicalEqualV1(
        plan.sourceNamespace,
        plan.initialSourceStoreManifest.namespace,
      ) ||
      plan.journalAuthorityInstallationIdentityGenerationId !==
        plan.sourceNamespace.installationIdentityGenerationId
    ) {
      addIssueV1(
        context,
        ["namespaceTranslation"],
        "formal Plan namespace, Store cut, translation, and journal Identity must remain exact",
      );
    }
    if (
      destinationEndpoint.role !== "destination_prospective_not_selected" ||
      plan.targetProfileId !== plan.sourceTrust.targetProfileId ||
      plan.targetProfileId !== destinationEndpoint.targetProfileId ||
      plan.sourceTrust.currentWriterSelection.providerId ===
        plan.formalDestinationTrust.candidate.providerId
    ) {
      addIssueV1(
        context,
        ["formalDestinationTrust"],
        "formal destination trust must retain a different not-selected destination on the exact Plan target",
      );
    }
    if (
      !canonicalEqualV1(
        plan.completeSourceReadClosure,
        plan.sourceDryRunCut.completeSourceReadClosure,
      ) ||
      !canonicalEqualV1(
        plan.sourceDryRunCut,
        plan.migrationHistoryQuotaSizing.sourceDryRunCut,
      ) ||
      plan.migrationHistoryQuotaSizing.migrationBudgetsDigest !==
        plan.migrationBudgetsDigest ||
      plan.migrationHistoryQuotaAdmission.sizingDigest !==
        plan.migrationHistoryQuotaSizingDigest
    ) {
      addIssueV1(
        context,
        ["sourceDryRunCut"],
        "formal Plan must retain the exact D-41 source closure, dry-run cut, sizing, admission, and budgets chain",
      );
    }
  });
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPayloadReferenceCandidateV1 =
  z.infer<
    typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPayloadReferenceCandidateV1Schema
  >;

const FormalPlanEnvelopeShapeV1 = {
  schemaVersion: z.literal(1),
  recordType: z.literal(
    "provider_migration_same_installation_identity_current_strong_source_normal_formal_plan_reference_candidate",
  ),
  mode: z.literal("same_installation_identity"),
  migrationId: ProviderMigrationIdV1Schema,
  sourceRepositoryId:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceReferenceCandidateV1Schema.shape.repositoryId,
  sourceWorktreeId:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceReferenceCandidateV1Schema.shape.worktreeId,
  destinationRepositoryId:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceReferenceCandidateV1Schema.shape.repositoryId,
  destinationWorktreeId:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceReferenceCandidateV1Schema.shape.worktreeId,
  createdAt:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCreatedAtReferenceCandidateV1Schema,
  contentDigest: ContentDigestV1Schema,
  payload:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPayloadReferenceCandidateV1Schema,
} as const;

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContentDigestV1(
  input: unknown,
): ContentDigestV1 {
  const payload =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPayloadReferenceCandidateV1Schema.parse(
      input,
    );
  return digestForDomainV1(FORMAL_PLAN_CONTENT_DOMAIN_V1, payload);
}

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1Schema =
  z.strictObject(FormalPlanEnvelopeShapeV1).superRefine((envelope, context) => {
    const payload = envelope.payload;
    if (
      envelope.mode !== payload.mode ||
      envelope.migrationId !== payload.migrationId ||
      envelope.sourceRepositoryId !== payload.sourceNamespace.repositoryId ||
      envelope.sourceWorktreeId !== payload.sourceNamespace.worktreeId ||
      envelope.destinationRepositoryId !==
        payload.destinationNamespace.repositoryId ||
      envelope.destinationWorktreeId !==
        payload.destinationNamespace.worktreeId ||
      envelope.createdAt !== payload.createdAt
    ) {
      addIssueV1(
        context,
        ["payload"],
        "formal Plan Envelope outer identity and namespaces must equal payload",
      );
    }
    if (
      envelope.contentDigest !==
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContentDigestV1(
        payload,
      )
    ) {
      addIssueV1(
        context,
        ["contentDigest"],
        "formal Plan digest must cover the complete mapping, reservation descriptor, trust, and retained branch payload",
      );
    }
  });
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1 =
  z.infer<
    typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1Schema
  >;

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1Schema =
  z.strictObject({
    locatorProfile: z.literal(
      "provider_migration_same_installation_identity_current_strong_source_normal_formal_plan_reference_candidate_v1",
    ),
    formalMigrationId: ProviderMigrationIdV1Schema,
    contentDigest: ContentDigestV1Schema,
  });
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1 =
  z.infer<
    typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1Schema
  >;

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinV1(
  input: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1 {
  const envelope =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1Schema.parse(
      input,
    );
  return ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1Schema.parse(
    {
      locatorProfile:
        "provider_migration_same_installation_identity_current_strong_source_normal_formal_plan_reference_candidate_v1",
      formalMigrationId: envelope.migrationId,
      contentDigest: envelope.contentDigest,
    },
  );
}

const FormalPlanPublicationStateV1Schema = z.strictObject({
  state: z.literal("constructed_not_published_or_reserved"),
  formalDestinationTrust: z.literal("verified"),
  formalPlan: z.literal("constructed_not_published"),
  formalPlanPin: z.literal("constructed_not_published"),
  formalReservationDescriptor: z.literal("constructed_not_reserved"),
  reservationRecord: z.literal("none"),
  reservationToken: z.literal("none"),
  registryManifestPublication: z.literal("none"),
  catalogPublication: z.literal("none"),
  planPublication: z.literal("none"),
  migrationOnlyAcceptance: z.literal("none"),
  requiredNext: z.literal("atomic_quota_reservation_and_plan_publication"),
});

const VerificationBoundaryV1Schema = z.strictObject({
  preparedCatalogSuccessorClosure: z.literal(
    "complete_d43_strict_public_projection_revalidated_v1",
  ),
  formalDestinationTrust: z.literal(
    "d41_not_selected_acceptance_plus_exact_d42_registry_and_d43_catalog_ordinals_v1",
  ),
  formalPlanDigest: z.literal(
    "complete_mapping_reservation_descriptor_destination_trust_and_branch_payload_v1",
  ),
  quotaReservationAuthority: z.literal("none"),
  planPublicationAuthority: z.literal("none"),
  registryCatalogPublicationAuthority: z.literal("none"),
  migrationOnlyAcceptanceAuthority: z.literal("none"),
  providerAuthority: z.literal("none"),
  durability: z.literal("none"),
});

const FormalPlanClosureProjectionShapeV1 = {
  authority: z.literal(
    "none_provider_migration_same_installation_identity_current_strong_source_normal_formal_plan_reference_candidate_only",
  ),
  profile: z.literal(
    "provider_migration_same_installation_identity_current_strong_source_normal_formal_plan_reference_candidate_v1",
  ),
  relationship: z.literal(
    "formal_plan_and_pin_constructed_not_published_or_reserved",
  ),
  preparedCatalogSuccessorClosure:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1Schema,
  formalDestinationTrust:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalDestinationTrustReferenceCandidateV1Schema,
  formalReservationDescriptor:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationDescriptorReferenceCandidateV1Schema,
  formalPlanEnvelope:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1Schema,
  formalPlanPin:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1Schema,
  publicationState: FormalPlanPublicationStateV1Schema,
  verificationBoundary: VerificationBoundaryV1Schema,
} as const;

const FormalPlanClosureProjectionV1Schema = z.strictObject(
  FormalPlanClosureProjectionShapeV1,
);
const FormalPlanBareValidationV1Schema = z.strictObject({
  ...FormalPlanClosureProjectionShapeV1,
  closureContentDigest: ContentDigestV1Schema,
});

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationV1 =
  z.infer<typeof FormalPlanBareValidationV1Schema>;

function refineFormalPlanValidationV1(
  value: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationV1,
  context: z.RefinementCtx,
): void {
  const d43 = value.preparedCatalogSuccessorClosure;
  const d42 = d43.preparedRegistrySuccessorClosure;
  const d41 = d42.preSideEffectPlanAdmissionClosure;
  const cut =
    d41.destinationTrust.authorization.prospectiveDestinationCut;
  const formalTrust = value.formalDestinationTrust;
  const plan = value.formalPlanEnvelope.payload;
  const mapping = d42.formalMigrationIdMapping;

  const registryMember =
    d42.preparedRegistryManifestEnvelope.payload.members[
      formalTrust.preparedRegistryMemberOrdinal
    ];
  const catalogTarget =
    d43.preparedSupportCatalogEnvelope.payload.targets[
      formalTrust.preparedSupportCatalogTargetOrdinal
    ];
  const catalogCandidate =
    catalogTarget?.candidates[
      formalTrust.preparedSupportCatalogCandidateOrdinal
    ];
  if (
    !canonicalEqualV1(
      formalTrust.destinationEndpointTrust,
      d41.destinationTrust,
    ) ||
    !canonicalEqualV1(
      formalTrust.preparedRegistryManifestPin,
      d42.preparedRegistryManifestPin,
    ) ||
    !canonicalEqualV1(registryMember, formalTrust.preparedRegistryMember) ||
    !canonicalEqualV1(
      formalTrust.preparedSupportCatalogPin,
      d43.preparedSupportCatalogPin,
    ) ||
    !canonicalEqualV1(catalogTarget?.target, formalTrust.target) ||
    !canonicalEqualV1(catalogCandidate, formalTrust.candidate) ||
    !canonicalEqualV1(formalTrust.target, cut.target) ||
    !canonicalEqualV1(formalTrust.candidate, cut.prospectiveSupportCandidate)
  ) {
    addIssueV1(
      context,
      ["formalDestinationTrust"],
      "formal destination trust must bind the exact D-41 endpoint and D-42/D-43 prepared member/candidate ordinals",
    );
  }

  const d41Plan = d41.planCandidate.payload;
  if (
    !canonicalEqualV1(plan.candidateToFormalMigrationIdMapping, mapping) ||
    plan.migrationId !== mapping.formalMigrationId ||
    !canonicalEqualV1(plan.sourceNamespace, d41Plan.sourceNamespace) ||
    !canonicalEqualV1(plan.destinationNamespace, d41Plan.destinationNamespace) ||
    !canonicalEqualV1(plan.namespaceTranslation, d41.namespaceTranslation) ||
    !canonicalEqualV1(plan.sourceTrust, d41.sourceTrust) ||
    !canonicalEqualV1(plan.completeSourceReadClosure, d41.completeSourceReadClosure) ||
    !canonicalEqualV1(plan.sourceDryRunCut, d41.sourceDryRunCut) ||
    !canonicalEqualV1(
      plan.initialSourceStoreManifest,
      d41Plan.initialSourceStoreManifest,
    ) ||
    !canonicalEqualV1(
      plan.initialDestinationNamespace,
      d41Plan.initialDestinationNamespace,
    ) ||
    !canonicalEqualV1(plan.migrationBudgets, d41Plan.migrationBudgets) ||
    !canonicalEqualV1(
      plan.migrationHistoryQuotaSizing,
      d41.historyQuotaSizing,
    ) ||
    !canonicalEqualV1(
      plan.migrationHistoryQuotaAdmission,
      d41.historyQuotaAdmission,
    ) ||
    !canonicalEqualV1(plan.formalDestinationTrust, formalTrust) ||
    !canonicalEqualV1(
      plan.preparedRegistryManifestPin,
      d42.preparedRegistryManifestPin,
    ) ||
    !canonicalEqualV1(
      plan.preparedSupportCatalogPin,
      d43.preparedSupportCatalogPin,
    )
  ) {
    addIssueV1(
      context,
      ["formalPlanEnvelope", "payload"],
      "formal Plan must replace only candidate identity/trust/reservation and retain the complete D-41/D-42/D-43 basis",
    );
  }

  if (
    !canonicalEqualV1(
      value.formalReservationDescriptor,
      plan.migrationHistoryQuotaReservations.journal,
    ) ||
    !canonicalEqualV1(
      value.formalPlanPin,
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinV1(
        value.formalPlanEnvelope,
      ),
    )
  ) {
    addIssueV1(
      context,
      ["formalPlanPin"],
      "formal descriptor, Plan Envelope, and Plan Pin must close exactly",
    );
  }

  if (
    value.closureContentDigest !==
    deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanClosureContentDigestV1(
      value,
    )
  ) {
    addIssueV1(
      context,
      ["closureContentDigest"],
      "formal Plan closure digest must bind the complete strict success projection",
    );
  }
}

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationV1Schema: z.ZodType<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationV1> =
  FormalPlanBareValidationV1Schema.superRefine(refineFormalPlanValidationV1);

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanClosureContentDigestV1(
  input: unknown,
): ContentDigestV1 {
  const full = FormalPlanBareValidationV1Schema.safeParse(input);
  let projection: z.infer<typeof FormalPlanClosureProjectionV1Schema>;
  if (full.success) {
    const { closureContentDigest: _closureContentDigest, ...withoutDigest } =
      full.data;
    projection = FormalPlanClosureProjectionV1Schema.parse(withoutDigest);
  } else {
    projection = FormalPlanClosureProjectionV1Schema.parse(input);
  }
  return digestForDomainV1(FORMAL_PLAN_CLOSURE_DOMAIN_V1, projection);
}

function findFormalDestinationOrdinalsV1(
  d43: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1,
): {
  readonly registryMemberOrdinal: number;
  readonly catalogTargetOrdinal: number;
  readonly catalogCandidateOrdinal: number;
} {
  const d42 = d43.preparedRegistrySuccessorClosure;
  const cut =
    d42.preSideEffectPlanAdmissionClosure.destinationTrust.authorization
      .prospectiveDestinationCut;
  const providerId = cut.prospectiveSupportCandidate.providerId;
  let registryMemberOrdinal = -1;
  for (
    let index = 0;
    index < d42.preparedRegistryManifestEnvelope.payload.members.length;
    index += 1
  ) {
    if (
      d42.preparedRegistryManifestEnvelope.payload.members[index]!.providerId ===
      providerId
    ) {
      if (registryMemberOrdinal !== -1) {
        throw new CapturedTypeErrorV1("formal destination Registry member ambiguous");
      }
      registryMemberOrdinal = index;
    }
  }
  let catalogTargetOrdinal = -1;
  let catalogCandidateOrdinal = -1;
  const targets = d43.preparedSupportCatalogEnvelope.payload.targets;
  for (let targetIndex = 0; targetIndex < targets.length; targetIndex += 1) {
    const target = targets[targetIndex]!;
    if (!canonicalEqualV1(target.target, cut.target)) continue;
    if (catalogTargetOrdinal !== -1) {
      throw new CapturedTypeErrorV1("formal destination Catalog target ambiguous");
    }
    catalogTargetOrdinal = targetIndex;
    for (
      let candidateIndex = 0;
      candidateIndex < target.candidates.length;
      candidateIndex += 1
    ) {
      if (target.candidates[candidateIndex]!.providerId === providerId) {
        if (catalogCandidateOrdinal !== -1) {
          throw new CapturedTypeErrorV1(
            "formal destination Catalog candidate ambiguous",
          );
        }
        catalogCandidateOrdinal = candidateIndex;
      }
    }
  }
  if (
    registryMemberOrdinal < 0 ||
    catalogTargetOrdinal < 0 ||
    catalogCandidateOrdinal < 0
  ) {
    throw new CapturedTypeErrorV1("formal destination material unavailable");
  }
  return CapturedObjectFreezeV1({
    registryMemberOrdinal,
    catalogTargetOrdinal,
    catalogCandidateOrdinal,
  });
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateV1(
  input: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationV1 {
  const d43 =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1Schema.parse(
      input,
    );
  const d42 = d43.preparedRegistrySuccessorClosure;
  const d41 = d42.preSideEffectPlanAdmissionClosure;
  const d41Plan = d41.planCandidate.payload;
  const cut =
    d41.destinationTrust.authorization.prospectiveDestinationCut;
  const ordinals = findFormalDestinationOrdinalsV1(d43);
  const registryMember =
    d42.preparedRegistryManifestEnvelope.payload.members[
      ordinals.registryMemberOrdinal
    ]!;
  const catalogTarget =
    d43.preparedSupportCatalogEnvelope.payload.targets[
      ordinals.catalogTargetOrdinal
    ]!;
  const catalogCandidate =
    catalogTarget.candidates[ordinals.catalogCandidateOrdinal]!;
  const formalDestinationTrust =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalDestinationTrustReferenceCandidateV1Schema.parse(
      {
        profile:
          "provider_migration_same_installation_identity_current_strong_source_normal_formal_destination_trust_reference_candidate_v1",
        destinationEndpointTrust: d41.destinationTrust,
        currentAcceptanceSelection:
          "destination_absent_not_selected_current_source_remains_selected_v1",
        preparedRegistryManifestPin: d42.preparedRegistryManifestPin,
        preparedRegistryMemberOrdinal: ordinals.registryMemberOrdinal,
        preparedRegistryMember: registryMember,
        preparedSupportCatalogPin: d43.preparedSupportCatalogPin,
        preparedSupportCatalogTargetOrdinal: ordinals.catalogTargetOrdinal,
        preparedSupportCatalogCandidateOrdinal: ordinals.catalogCandidateOrdinal,
        target: catalogTarget.target,
        candidate: catalogCandidate,
        relationship:
          "formally_admitted_in_prepared_registry_and_catalog_not_selected_by_current_acceptance_v1",
      },
    );
  const reservationFields = {
    formalMigrationId: d42.formalMigrationIdMapping.formalMigrationId,
    role: "same_identity_journal" as const,
    installationIdentityGenerationId:
      d41Plan.journalAuthorityInstallationIdentityGenerationId,
    admissionVectorDigest: d41.admissionVectorDigest,
  };
  const formalReservationDescriptor =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationDescriptorReferenceCandidateV1Schema.parse(
      {
        profile:
          "provider_migration_same_installation_identity_current_strong_source_normal_formal_history_quota_reservation_descriptor_reference_candidate_v1",
        locatorProfile:
          "provider_migration_same_installation_identity_current_strong_source_normal_formal_history_quota_reservation_reference_candidate_v1",
        reservationId:
          deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationIdV1(
            reservationFields,
          ),
        ...reservationFields,
      },
    );
  const payload =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPayloadReferenceCandidateV1Schema.parse(
      {
        profile:
          "provider_migration_same_installation_identity_current_strong_source_normal_formal_plan_payload_reference_candidate_v1",
        mode: "same_installation_identity",
        migrationId: d42.formalMigrationIdMapping.formalMigrationId,
        reason: "provider_decommission",
        identityRelationship: "source_destination_exact_same",
        candidateToFormalMigrationIdMapping: d42.formalMigrationIdMapping,
        sourceNamespace: d41Plan.sourceNamespace,
        destinationNamespace: d41Plan.destinationNamespace,
        namespaceTranslation: d41.namespaceTranslation,
        targetProfileId: d41Plan.targetProfileId,
        sourceTrust: d41.sourceTrust,
        formalDestinationTrust,
        completeSourceReadClosure: d41.completeSourceReadClosure,
        sourceDryRunCut: d41.sourceDryRunCut,
        initialSourceStoreManifest: d41Plan.initialSourceStoreManifest,
        initialDestinationNamespace: d41Plan.initialDestinationNamespace,
        journalAuthorityInstallationIdentityGenerationId:
          d41Plan.journalAuthorityInstallationIdentityGenerationId,
        progressJournalLocatorProfile: d41Plan.progressJournalLocatorProfile,
        migrationBudgets: d41Plan.migrationBudgets,
        migrationBudgetsDigest: d41.migrationBudgetsDigest,
        migrationHistoryQuotaSizing: d41.historyQuotaSizing,
        migrationHistoryQuotaSizingDigest: d41.historyQuotaSizingDigest,
        migrationHistoryQuotaAdmission: d41.historyQuotaAdmission,
        admissionVectorDigest: d41.admissionVectorDigest,
        migrationHistoryQuotaReservations: {
          mode: "same_installation_identity",
          journal: formalReservationDescriptor,
        },
        preparedRegistryManifestPin: d42.preparedRegistryManifestPin,
        preparedSupportCatalogPin: d43.preparedSupportCatalogPin,
        liveReferenceSchemaDigest: d41Plan.liveReferenceSchemaDigest,
        migrationProtocolDigest: d41Plan.migrationProtocolDigest,
        createdAt: d41.createdAt,
      },
    );
  const formalPlanEnvelope =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1Schema.parse(
      {
        schemaVersion: 1,
        recordType:
          "provider_migration_same_installation_identity_current_strong_source_normal_formal_plan_reference_candidate",
        mode: payload.mode,
        migrationId: payload.migrationId,
        sourceRepositoryId: payload.sourceNamespace.repositoryId,
        sourceWorktreeId: payload.sourceNamespace.worktreeId,
        destinationRepositoryId: payload.destinationNamespace.repositoryId,
        destinationWorktreeId: payload.destinationNamespace.worktreeId,
        createdAt: payload.createdAt,
        contentDigest:
          deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContentDigestV1(
            payload,
          ),
        payload,
      },
    );
  const formalPlanPin =
    deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinV1(
      formalPlanEnvelope,
    );
  const projection = {
    authority:
      "none_provider_migration_same_installation_identity_current_strong_source_normal_formal_plan_reference_candidate_only" as const,
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_formal_plan_reference_candidate_v1" as const,
    relationship:
      "formal_plan_and_pin_constructed_not_published_or_reserved" as const,
    preparedCatalogSuccessorClosure: d43,
    formalDestinationTrust,
    formalReservationDescriptor,
    formalPlanEnvelope,
    formalPlanPin,
    publicationState: {
      state: "constructed_not_published_or_reserved" as const,
      formalDestinationTrust: "verified" as const,
      formalPlan: "constructed_not_published" as const,
      formalPlanPin: "constructed_not_published" as const,
      formalReservationDescriptor: "constructed_not_reserved" as const,
      reservationRecord: "none" as const,
      reservationToken: "none" as const,
      registryManifestPublication: "none" as const,
      catalogPublication: "none" as const,
      planPublication: "none" as const,
      migrationOnlyAcceptance: "none" as const,
      requiredNext:
        "atomic_quota_reservation_and_plan_publication" as const,
    },
    verificationBoundary: {
      preparedCatalogSuccessorClosure:
        "complete_d43_strict_public_projection_revalidated_v1" as const,
      formalDestinationTrust:
        "d41_not_selected_acceptance_plus_exact_d42_registry_and_d43_catalog_ordinals_v1" as const,
      formalPlanDigest:
        "complete_mapping_reservation_descriptor_destination_trust_and_branch_payload_v1" as const,
      quotaReservationAuthority: "none" as const,
      planPublicationAuthority: "none" as const,
      registryCatalogPublicationAuthority: "none" as const,
      migrationOnlyAcceptanceAuthority: "none" as const,
      providerAuthority: "none" as const,
      durability: "none" as const,
    },
  };
  return validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateV1(
    {
      ...projection,
      closureContentDigest:
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanClosureContentDigestV1(
          projection,
        ),
    },
  );
}

export function validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateV1(
  input: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationV1 {
  return deepFreezeProviderPointDetachedDataTreeV1(
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationV1Schema.parse(
      input,
    ),
  );
}

CapturedObjectFreezeV1(
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationV1Schema,
);
CapturedObjectFreezeV1(
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationIdV1,
);
CapturedObjectFreezeV1(
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContentDigestV1,
);
CapturedObjectFreezeV1(
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinV1,
);
CapturedObjectFreezeV1(
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanClosureContentDigestV1,
);
CapturedObjectFreezeV1(
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateV1,
);
CapturedObjectFreezeV1(
  validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateV1,
);
