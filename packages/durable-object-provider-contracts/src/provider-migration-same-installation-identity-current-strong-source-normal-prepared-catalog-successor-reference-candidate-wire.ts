import { z } from "./zod-runtime.js";

import { canonicalizeJcsSafeIntegerV1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  ProviderMigrationIdV1Schema,
  type ContentDigestV1,
} from "./primitives.js";
import {
  ProviderFeasibilitySupportCatalogEnvelopeV1Schema,
  ProviderFeasibilitySupportCatalogPinV1Schema,
  deriveProviderFeasibilitySupportCatalogPinV1,
  type ProviderFeasibilitySupportCandidateV1,
} from "./provider-feasibility-support-catalog-point.js";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorRequestReferenceCandidateV1Schema,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-reference-candidate-wire.js";
import {
  ProviderRegistryManifestPinV1Schema,
} from "./provider-registry-records.js";
import {
  deepFreezeProviderPointDetachedDataTreeV1,
} from "./provider-point-raw-admission-internal.js";
import { sha256InternalV1 } from "./sha256.js";

const CapturedArrayPrototypePushV1 = Array.prototype.push;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedTextEncoderV1 = TextEncoder;
const CapturedTextEncoderPrototypeEncodeV1 = TextEncoder.prototype.encode;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedNumberMaxSafeIntegerV1 = Number.MAX_SAFE_INTEGER;
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

const arrayPushV1 = bindUncurriedAtBootstrapV1(
  CapturedArrayPrototypePushV1,
) as <T>(receiver: T[], value: T) => number;
const typedArrayByteLengthV1 = bindUncurriedAtBootstrapV1(
  CapturedTypedArrayByteLengthGetterCandidateV1,
) as (receiver: Uint8Array) => number;
const CapturedUtf8EncoderV1 = CapturedObjectFreezeV1(
  new CapturedTextEncoderV1(),
);

const PREPARED_CATALOG_SUCCESSOR_CLOSURE_DOMAIN_V1 =
  "provider-migration-same-installation-identity-current-strong-source-normal-prepared-catalog-successor-reference-candidate-v1" as const;

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
  const length = typedArrayByteLengthV1(bytes);
  for (let index = 0; index < length; index += 1) {
    const byte = bytes[index]!;
    output += alphabet[(byte >>> 4) & 0x0f]! + alphabet[byte & 0x0f]!;
  }
  return output;
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  return (
    canonicalizeJcsSafeIntegerV1(left) === canonicalizeJcsSafeIntegerV1(right)
  );
}

function compareUtf8StringsV1(left: string, right: string): number {
  const leftBytes = encodeUtf8V1(left);
  const rightBytes = encodeUtf8V1(right);
  const leftLength = typedArrayByteLengthV1(leftBytes);
  const rightLength = typedArrayByteLengthV1(rightBytes);
  const limit = leftLength < rightLength ? leftLength : rightLength;
  for (let index = 0; index < limit; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!;
    if (difference !== 0) return difference;
  }
  return leftLength - rightLength;
}

function addIssueV1(
  context: z.RefinementCtx,
  path: PropertyKey[],
  message: string,
): void {
  context.addIssue({ code: "custom", path, message });
}

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorRequestReferenceCandidateV1Schema =
  z.strictObject({
    profile: z.literal(
      "provider_migration_same_installation_identity_current_strong_source_normal_prepared_catalog_successor_request_reference_candidate_v1",
    ),
    preparedRegistrySuccessorRequest:
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorRequestReferenceCandidateV1Schema,
    expectedPreparedCatalogPin:
      ProviderFeasibilitySupportCatalogPinV1Schema,
  });
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorRequestReferenceCandidateV1 =
  z.infer<
    typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorRequestReferenceCandidateV1Schema
  >;

const IntendedOperationV1Schema = z.strictObject({
  operation: z.literal("compare_reserve"),
  role: z.literal("same_identity_journal"),
  publicationKind: z.literal("publish_same_identity_plan_atomically"),
});

const FutureFormalPlanRuleV1Schema = z.strictObject({
  candidateToFormalMapping: z.literal("complete_mapping_record_required_v1"),
  formalPlanDigestCoverage: z.literal(
    "must_cover_complete_mapping_and_deterministic_reservation_descriptor_v1",
  ),
  reservationRecordAndTokenBinding: z.literal(
    "only_after_formal_plan_content_digest_v1",
  ),
  candidatePlanDisposition: z.literal(
    "d41_candidate_plan_is_not_a_formal_plan_v1",
  ),
  futureNoReplacePublication: z.literal(
    "must_revalidate_live_current_tip_and_publish_atomically_in_later_gate_v1",
  ),
});

const PublicationAtomicityV1Schema = z.strictObject({
  reservationAndPublication: z.literal("all_or_none_v1"),
  sameNonceSameRequest: z.literal(
    "return_byte_identical_first_operation_receipt_v1",
  ),
  sameNonceDifferentRequest: z.literal("zero_write_reject_v1"),
});

const PublicationPrerequisiteV1Schema = z.strictObject({
  profile: z.literal(
    "provider_migration_same_installation_identity_current_strong_source_normal_prepared_catalog_successor_publication_prerequisite_reference_candidate_v1",
  ),
  state: z.literal("locked_awaiting_formal_destination_trust_and_plan"),
  formalMigrationId: ProviderMigrationIdV1Schema,
  candidatePlanContentDigest: ContentDigestV1Schema,
  admissionVectorDigest: ContentDigestV1Schema,
  journalAuthorityInstallationIdentityGenerationId:
    InstallationIdentityGenerationIdV1Schema,
  intendedOperation: IntendedOperationV1Schema,
  futureFormalPlanRule: FutureFormalPlanRuleV1Schema,
  atomicity: PublicationAtomicityV1Schema,
  preparedRegistryManifestPin: ProviderRegistryManifestPinV1Schema,
  currentSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1Schema,
  preparedSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1Schema,
  futureFormalPlanBinding: z.literal(
    "must_bind_complete_d43_closure_digest_and_exact_registry_catalog_pins_v1",
  ),
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorPublicationPrerequisiteReferenceCandidateV1 =
  z.infer<typeof PublicationPrerequisiteV1Schema>;

const PublicationGateV1Schema = z.strictObject({
  profile: z.literal(
    "provider_migration_same_installation_identity_current_strong_source_normal_prepared_catalog_successor_publication_gate_reference_candidate_v1",
  ),
  state: z.literal("locked_awaiting_formal_destination_trust_and_plan"),
  formalIdMapping: z.literal("verified"),
  preparedRegistryDirectSuccessor: z.literal("verified_not_published"),
  formalCatalogDirectSuccessor: z.literal("verified_not_published"),
  formalDestinationTrust: z.literal("none"),
  requiredNext: z.literal("formal_destination_trust_and_plan"),
  formalPlan: z.literal("none"),
  formalPlanPin: z.literal("none"),
  reservationRecords: z.literal("none"),
  reservationTokens: z.literal("none"),
  registryManifestPublication: z.literal("none"),
  catalogPublication: z.literal("none"),
  planPublication: z.literal("none"),
  migrationOnlyAcceptance: z.literal("none"),
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorPublicationGateReferenceCandidateV1 =
  z.infer<typeof PublicationGateV1Schema>;

const SideEffectBoundaryV1Schema = z.strictObject({
  policy: z.literal(
    "zero_side_effect_prepared_catalog_successor_validation_reference_candidate_v1",
  ),
  reservationWrites: z.literal(0),
  planPublications: z.literal(0),
  acceptanceAppends: z.literal(0),
  progressAppends: z.literal(0),
  operationReceiptWrites: z.literal(0),
  destinationObjectAllocations: z.literal(0),
  quotaConsumptions: z.literal(0),
  emergencyReserveConsumptions: z.literal(0),
  pendingIntents: z.literal(0),
  rootSigningRequests: z.literal(0),
  registryManifestPublications: z.literal(0),
  catalogPublications: z.literal(0),
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorSideEffectBoundaryReferenceCandidateV1 =
  z.infer<typeof SideEffectBoundaryV1Schema>;

const VerificationBoundaryV1Schema = z.strictObject({
  preparedRegistrySuccessorClosure: z.literal(
    "complete_fresh_d42_same_cohort_candidate_v1",
  ),
  currentCatalogContinuity: z.literal(
    "same_cohort_retained_current_accepted_steady_catalog_v1",
  ),
  preparedCatalogSignature: z.literal(
    "externally_root_signed_and_verified_against_same_cohort_retained_active_root_v1",
  ),
  preparedCatalogRelationship: z.literal(
    "root_signed_direct_successor_of_same_cohort_retained_current_catalog_candidate_not_current_or_published_v1",
  ),
  registryCatalogDestinationBinding: z.literal(
    "exact_d41_d42_d43_destination_evidence_policy_runtime_and_routing_closure_v1",
  ),
  rootSigningAuthority: z.literal(
    "external_signature_verification_only_no_signer_capability_v1",
  ),
  formalDestinationTrust: z.literal("none"),
  formalPlan: z.literal("none"),
  formalPlanPin: z.literal("none"),
  reservationRecords: z.literal("none"),
  reservationTokens: z.literal("none"),
  registryManifestPublication: z.literal("none"),
  catalogPublication: z.literal("none"),
  planPublication: z.literal("none"),
  migrationOnlyAcceptance: z.literal("none"),
  providerAuthority: z.literal("none"),
  durability: z.literal("none"),
  migrationExecution: z.literal("none"),
});
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorVerificationBoundaryReferenceCandidateV1 =
  z.infer<typeof VerificationBoundaryV1Schema>;

const PreparedCatalogSuccessorClosureProjectionShapeV1 = {
  authority: z.literal(
    "none_provider_migration_same_installation_identity_current_strong_source_normal_prepared_catalog_successor_reference_candidate_only",
  ),
  profile: z.literal(
    "provider_migration_same_installation_identity_current_strong_source_normal_prepared_catalog_successor_reference_candidate_v1",
  ),
  stopPoint: z.literal(
    "after_external_root_signed_formal_catalog_direct_successor_validation_before_registry_or_catalog_publication",
  ),
  preparedRegistrySuccessorClosure:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1Schema,
  currentSupportCatalogEnvelope:
    ProviderFeasibilitySupportCatalogEnvelopeV1Schema,
  currentSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1Schema,
  preparedSupportCatalogEnvelope:
    ProviderFeasibilitySupportCatalogEnvelopeV1Schema,
  preparedSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1Schema,
  publicationPrerequisite: PublicationPrerequisiteV1Schema,
  publicationGate: PublicationGateV1Schema,
  sideEffectBoundary: SideEffectBoundaryV1Schema,
  verificationBoundary: VerificationBoundaryV1Schema,
} as const;

const PreparedCatalogSuccessorClosureProjectionV1Schema = z.strictObject(
  PreparedCatalogSuccessorClosureProjectionShapeV1,
);
const PreparedCatalogSuccessorBareValidationV1Schema = z.strictObject({
  ...PreparedCatalogSuccessorClosureProjectionShapeV1,
  closureContentDigest: ContentDigestV1Schema,
});

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1 {
  readonly authority: "none_provider_migration_same_installation_identity_current_strong_source_normal_prepared_catalog_successor_reference_candidate_only";
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_prepared_catalog_successor_reference_candidate_v1";
  readonly stopPoint: "after_external_root_signed_formal_catalog_direct_successor_validation_before_registry_or_catalog_publication";
  readonly preparedRegistrySuccessorClosure: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1;
  readonly currentSupportCatalogEnvelope: z.infer<
    typeof ProviderFeasibilitySupportCatalogEnvelopeV1Schema
  >;
  readonly currentSupportCatalogPin: z.infer<
    typeof ProviderFeasibilitySupportCatalogPinV1Schema
  >;
  readonly preparedSupportCatalogEnvelope: z.infer<
    typeof ProviderFeasibilitySupportCatalogEnvelopeV1Schema
  >;
  readonly preparedSupportCatalogPin: z.infer<
    typeof ProviderFeasibilitySupportCatalogPinV1Schema
  >;
  readonly publicationPrerequisite: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorPublicationPrerequisiteReferenceCandidateV1;
  readonly publicationGate: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorPublicationGateReferenceCandidateV1;
  readonly sideEffectBoundary: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorSideEffectBoundaryReferenceCandidateV1;
  readonly verificationBoundary: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorVerificationBoundaryReferenceCandidateV1;
  readonly closureContentDigest: ContentDigestV1;
}

function expectedPreparedCandidatesV1(
  current: readonly ProviderFeasibilitySupportCandidateV1[],
  destination: ProviderFeasibilitySupportCandidateV1,
): ProviderFeasibilitySupportCandidateV1[] | undefined {
  const output: ProviderFeasibilitySupportCandidateV1[] = [];
  let inserted = false;
  for (let index = 0; index < current.length; index += 1) {
    const candidate = current[index]!;
    const order = compareUtf8StringsV1(
      destination.providerId,
      candidate.providerId,
    );
    if (order === 0) return undefined;
    if (!inserted && order < 0) {
      arrayPushV1(output, destination);
      inserted = true;
    }
    arrayPushV1(output, candidate);
  }
  if (!inserted) arrayPushV1(output, destination);
  return output;
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorClosureContentDigestV1(
  input: unknown,
): ContentDigestV1 {
  const full = PreparedCatalogSuccessorBareValidationV1Schema.safeParse(input);
  let projection: z.infer<
    typeof PreparedCatalogSuccessorClosureProjectionV1Schema
  >;
  if (full.success) {
    const { closureContentDigest: _closureContentDigest, ...withoutDigest } =
      full.data;
    projection =
      PreparedCatalogSuccessorClosureProjectionV1Schema.parse(withoutDigest);
  } else {
    projection =
      PreparedCatalogSuccessorClosureProjectionV1Schema.parse(input);
  }
  const preimage = canonicalizeJcsSafeIntegerV1([
    PREPARED_CATALOG_SUCCESSOR_CLOSURE_DOMAIN_V1,
    projection,
  ]);
  return ContentDigestV1Schema.parse(
    `sha256:${bytesToLowerHexV1(sha256InternalV1(encodeUtf8V1(preimage)))}`,
  );
}

function refinePreparedCatalogSuccessorValidationV1(
  value: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1,
  context: z.RefinementCtx,
): void {
  const d42 = value.preparedRegistrySuccessorClosure;
  const d41 = d42.preSideEffectPlanAdmissionClosure;
  const destinationTrust = d41.destinationTrust;
  if (destinationTrust.role !== "destination_prospective_not_selected") return;
  const destinationCut =
    destinationTrust.authorization.prospectiveDestinationCut;
  const currentEnvelope = value.currentSupportCatalogEnvelope;
  const current = currentEnvelope.payload;
  const preparedEnvelope = value.preparedSupportCatalogEnvelope;
  const prepared = preparedEnvelope.payload;

  if (
    !canonicalEqualV1(
      currentEnvelope,
      destinationCut.currentSupportCatalogEnvelope,
    ) ||
    !canonicalEqualV1(
      value.currentSupportCatalogPin,
      destinationCut.currentSupportCatalog,
    )
  ) {
    addIssueV1(
      context,
      ["currentSupportCatalogEnvelope"],
      "current Catalog must be the exact retained current accepted Catalog from the fresh D-42 closure",
    );
  }

  try {
    if (
      !canonicalEqualV1(
        value.currentSupportCatalogPin,
        deriveProviderFeasibilitySupportCatalogPinV1(currentEnvelope),
      ) ||
      !canonicalEqualV1(
        value.preparedSupportCatalogPin,
        deriveProviderFeasibilitySupportCatalogPinV1(preparedEnvelope),
      )
    ) {
      addIssueV1(
        context,
        ["preparedSupportCatalogPin"],
        "current and prepared Catalog Envelopes and Pins must be self-bound",
      );
    }
  } catch {
    addIssueV1(
      context,
      ["preparedSupportCatalogEnvelope"],
      "prepared Catalog Envelope identity and content must be derivable",
    );
  }

  if (
    current.catalogGeneration >= CapturedNumberMaxSafeIntegerV1 ||
    prepared.catalogGeneration !== current.catalogGeneration + 1 ||
    preparedEnvelope.catalogGeneration !== prepared.catalogGeneration ||
    prepared.predecessorCatalogContentDigest !== currentEnvelope.contentDigest ||
    !canonicalEqualV1(
      prepared.distributionRootBinding,
      current.distributionRootBinding,
    ) ||
    !canonicalEqualV1(prepared.activeRootMetadata, current.activeRootMetadata) ||
    prepared.registryRootKeyId !== current.registryRootKeyId ||
    !canonicalEqualV1(
      prepared.feasibilityApprovalKeys,
      current.feasibilityApprovalKeys,
    ) ||
    !canonicalEqualV1(
      prepared.publicSupportTaxonomy,
      current.publicSupportTaxonomy,
    ) ||
    !canonicalEqualV1(
      prepared.releaseTargetUniverse,
      current.releaseTargetUniverse,
    ) ||
    prepared.targets.length !== current.targets.length
  ) {
    addIssueV1(
      context,
      ["preparedSupportCatalogEnvelope", "payload"],
      "prepared Catalog must be the direct same-Root successor preserving all signed catalog-wide claims",
    );
  }

  const destinationCandidate = destinationCut.prospectiveSupportCandidate;
  let matchingTargetCount = 0;
  for (let targetIndex = 0; targetIndex < current.targets.length; targetIndex += 1) {
    const currentTarget = current.targets[targetIndex]!;
    const preparedTarget = prepared.targets[targetIndex];
    if (
      preparedTarget === undefined ||
      !canonicalEqualV1(preparedTarget.target, currentTarget.target)
    ) {
      addIssueV1(
        context,
        ["preparedSupportCatalogEnvelope", "payload", "targets", targetIndex],
        "prepared Catalog target groups and order must be preserved",
      );
      continue;
    }
    if (canonicalEqualV1(currentTarget.target, destinationCut.target)) {
      matchingTargetCount += 1;
      const expected = expectedPreparedCandidatesV1(
        currentTarget.candidates,
        destinationCandidate,
      );
      if (
        expected === undefined ||
        !canonicalEqualV1(preparedTarget.candidates, expected)
      ) {
        addIssueV1(
          context,
          [
            "preparedSupportCatalogEnvelope",
            "payload",
            "targets",
            targetIndex,
            "candidates",
          ],
          "the D-41 target must preserve every old candidate and insert exactly the D-41 destination in UTF-8 provider order",
        );
      }
    } else if (
      !canonicalEqualV1(preparedTarget.candidates, currentTarget.candidates)
    ) {
      addIssueV1(
        context,
        ["preparedSupportCatalogEnvelope", "payload", "targets", targetIndex],
        "non-D-41 Catalog target groups must remain byte-identical",
      );
    }
  }
  if (matchingTargetCount !== 1) {
    addIssueV1(
      context,
      ["preparedSupportCatalogEnvelope", "payload", "targets"],
      "the exact D-41 target group must occur once",
    );
  }

  const preparedRegistry = d42.preparedRegistryManifestEnvelope.payload;
  const routing = preparedRegistry.routing;
  const destinationEntry = destinationCut.prospectiveRegistryEntry;
  let destinationMember:
    | (typeof preparedRegistry.members)[number]
    | undefined;
  let destinationMemberCount = 0;
  for (let index = 0; index < preparedRegistry.members.length; index += 1) {
    const member = preparedRegistry.members[index]!;
    if (member.providerId === destinationCandidate.providerId) {
      destinationMember = member;
      destinationMemberCount += 1;
    }
  }
  if (
    destinationCandidate.releaseDisposition !== "strong_read_write" ||
    destinationCandidate.providerId !== destinationEntry.providerId ||
    destinationMemberCount !== 1 ||
    destinationMember?.disposition !== "enabled" ||
    !canonicalEqualV1(destinationMember?.registryEntry, destinationEntry) ||
    routing.state !== "migration" ||
    routing.migrationId !== d42.formalMigrationIdMapping.formalMigrationId ||
    routing.destinationProviderId !== destinationCandidate.providerId ||
    routing.sourceProviderId !== d41.sourceTrust.currentWriterSelection.providerId ||
    routing.activeForMigrationWrites !== routing.sourceProviderId ||
    routing.phase !== "prepared"
  ) {
    addIssueV1(
      context,
      ["preparedRegistrySuccessorClosure"],
      "the D-41 candidate, D-42 enabled Entry and prepared routing must close exactly",
    );
  }

  const prerequisite = value.publicationPrerequisite;
  const d42Prerequisite = d42.publicationPrerequisite;
  if (
    prerequisite.formalMigrationId !== d42Prerequisite.formalMigrationId ||
    prerequisite.candidatePlanContentDigest !==
      d42Prerequisite.candidatePlanContentDigest ||
    prerequisite.admissionVectorDigest !==
      d42Prerequisite.admissionVectorDigest ||
    prerequisite.journalAuthorityInstallationIdentityGenerationId !==
      d42Prerequisite.journalAuthorityInstallationIdentityGenerationId ||
    !canonicalEqualV1(
      prerequisite.intendedOperation,
      d42Prerequisite.intendedOperation,
    ) ||
    !canonicalEqualV1(
      prerequisite.futureFormalPlanRule,
      d42Prerequisite.futureFormalPlanRule,
    ) ||
    !canonicalEqualV1(prerequisite.atomicity, d42Prerequisite.atomicity) ||
    !canonicalEqualV1(
      prerequisite.preparedRegistryManifestPin,
      d42.preparedRegistryManifestPin,
    ) ||
    !canonicalEqualV1(
      prerequisite.currentSupportCatalogPin,
      value.currentSupportCatalogPin,
    ) ||
    !canonicalEqualV1(
      prerequisite.preparedSupportCatalogPin,
      value.preparedSupportCatalogPin,
    )
  ) {
    addIssueV1(
      context,
      ["publicationPrerequisite"],
      "future formal Plan rules must retain the exact D-42 basis and bind the prepared Registry/current Catalog/prepared Catalog Pins",
    );
  }

  if (
    value.closureContentDigest !==
    deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorClosureContentDigestV1(
      value,
    )
  ) {
    addIssueV1(
      context,
      ["closureContentDigest"],
      "closure digest must bind the complete strict D-43 success projection",
    );
  }
}

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1Schema: z.ZodType<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1> =
  PreparedCatalogSuccessorBareValidationV1Schema.superRefine(
    refinePreparedCatalogSuccessorValidationV1,
  );

export function validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateV1(
  input: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1 {
  return deepFreezeProviderPointDetachedDataTreeV1(
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1Schema.parse(
      input,
    ),
  );
}

CapturedObjectFreezeV1(
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorRequestReferenceCandidateV1Schema,
);
CapturedObjectFreezeV1(
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1Schema,
);
CapturedObjectFreezeV1(
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorClosureContentDigestV1,
);
CapturedObjectFreezeV1(
  validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateV1,
);
