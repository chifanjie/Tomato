import { z } from "./zod-runtime.js";

import { canonicalizeJcsSafeIntegerV1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  ProviderMigrationIdV1Schema,
  type ContentDigestV1,
  type ProviderMigrationIdV1,
} from "./primitives.js";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateIdV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestReferenceCandidateV1Schema,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateIdV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-reference-candidate-wire.js";
import {
  ProviderRegistryManifestEnvelopeV1Schema,
  ProviderRegistryManifestPinV1Schema,
  deriveProviderRegistryManifestContentDigestV1,
  deriveProviderRegistryManifestGenerationIdV1,
  type ProviderRegistryManifestMemberV1,
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
const CapturedNumberMaxSafeIntegerV1 = Number.MAX_SAFE_INTEGER;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedStringPrototypeSliceV1 = String.prototype.slice;
const CapturedTextEncoderV1 = TextEncoder;
const CapturedTextEncoderPrototypeEncodeV1 = TextEncoder.prototype.encode;
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
const stringSliceV1 = bindUncurriedAtBootstrapV1(
  CapturedStringPrototypeSliceV1,
) as (receiver: string, start?: number, end?: number) => string;
const encodeTextV1 = bindUncurriedAtBootstrapV1(
  CapturedTextEncoderPrototypeEncodeV1,
) as (receiver: TextEncoder, value: string) => Uint8Array;
const typedArrayByteLengthV1 = bindUncurriedAtBootstrapV1(
  CapturedTypedArrayByteLengthGetterCandidateV1,
) as (receiver: Uint8Array) => number;
const CapturedUtf8EncoderV1 = CapturedObjectFreezeV1(
  new CapturedTextEncoderV1(),
);

const FORMAL_MIGRATION_ID_MAPPING_DOMAIN_V1 =
  "provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-closure-reference-candidate-to-formal-id-v1" as const;
const PREPARED_REGISTRY_SUCCESSOR_CLOSURE_DOMAIN_V1 =
  "provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-reference-candidate-v1" as const;

function encodeUtf8V1(value: string): Uint8Array {
  return encodeTextV1(CapturedUtf8EncoderV1, value);
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

function sha256HexForDomainV1(domain: string, fields: object): string {
  const preimage = canonicalizeJcsSafeIntegerV1([domain, fields]);
  return bytesToLowerHexV1(sha256InternalV1(encodeUtf8V1(preimage)));
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
  const limit =
    leftLength < rightLength
      ? leftLength
      : rightLength;
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

function deriveFormalMigrationIdV1(
  candidateMigrationId: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateIdV1,
): ProviderMigrationIdV1 {
  const lowerHex = sha256HexForDomainV1(
    FORMAL_MIGRATION_ID_MAPPING_DOMAIN_V1,
    { candidateMigrationId },
  );
  return ProviderMigrationIdV1Schema.parse(
    `provider-migration:${stringSliceV1(lowerHex, 0, 22)}`,
  );
}

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorRequestReferenceCandidateV1Schema =
  z.strictObject({
    profile: z.literal(
      "provider_migration_same_installation_identity_current_strong_source_normal_prepared_registry_successor_request_reference_candidate_v1",
    ),
    preSideEffectRequest:
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestReferenceCandidateV1Schema,
    expectedCandidateMigrationId:
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateIdV1Schema,
    expectedPreparedRegistryManifestPin:
      ProviderRegistryManifestPinV1Schema,
  });
export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorRequestReferenceCandidateV1 =
  z.infer<
    typeof ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorRequestReferenceCandidateV1Schema
  >;

const FormalMigrationIdMappingV1Schema = z.strictObject({
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

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalMigrationIdMappingV1(
  input: unknown,
): z.infer<typeof FormalMigrationIdMappingV1Schema> {
  const candidateMigrationId =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateIdV1Schema.parse(
      input,
    );
  return CapturedObjectFreezeV1(
    FormalMigrationIdMappingV1Schema.parse({
      profile:
        "provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_plan_admission_closure_reference_candidate_to_formal_id_v1",
      candidateMigrationId,
      formalMigrationId: deriveFormalMigrationIdV1(candidateMigrationId),
      derivation:
        "sha256_jcs_domain_preimage_candidate_migration_id_only_first_22_lowercase_hex_v1",
    }),
  );
}

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

const PlanPublicationPrerequisiteV1Schema = z.strictObject({
  profile: z.literal(
    "provider_migration_same_installation_identity_current_strong_source_normal_plan_publication_prerequisite_reference_candidate_v1",
  ),
  state: z.literal("locked_awaiting_formal_catalog_direct_successor"),
  formalMigrationId: ProviderMigrationIdV1Schema,
  candidatePlanContentDigest: ContentDigestV1Schema,
  admissionVectorDigest: ContentDigestV1Schema,
  journalAuthorityInstallationIdentityGenerationId:
    InstallationIdentityGenerationIdV1Schema,
  intendedOperation: IntendedOperationV1Schema,
  futureFormalPlanRule: FutureFormalPlanRuleV1Schema,
  atomicity: PublicationAtomicityV1Schema,
});

const PublicationGateV1Schema = z.strictObject({
  profile: z.literal(
    "provider_migration_same_installation_identity_current_strong_source_normal_publication_gate_reference_candidate_v1",
  ),
  state: z.literal("locked_awaiting_formal_catalog_direct_successor"),
  formalIdMapping: z.literal("verified"),
  preparedRegistryDirectSuccessor: z.literal("verified_not_published"),
  formalCatalogDirectSuccessor: z.literal("none"),
  formalDestinationTrust: z.literal("none"),
  requiredNext: z.literal("formal_catalog_direct_successor"),
  formalPlan: z.literal("none"),
  formalPlanPin: z.literal("none"),
  reservationRecords: z.literal("none"),
  reservationTokens: z.literal("none"),
  planPublication: z.literal("none"),
});

const SideEffectBoundaryV1Schema = z.strictObject({
  policy: z.literal(
    "zero_side_effect_prepared_registry_successor_validation_reference_candidate_v1",
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

const VerificationBoundaryV1Schema = z.strictObject({
  d41PreSideEffectClosure: z.literal(
    "complete_embedded_public_hash_dag_and_same_cohort_opaque_evidence_v1",
  ),
  formalMigrationIdMapping: z.literal(
    "cycle_free_public_projection_recomputable_v1",
  ),
  currentRegistryContinuity: z.literal(
    "same_cohort_opaque_retained_registry_history_direct_successor_v1",
  ),
  preparedRegistrySignature: z.literal(
    "externally_root_signed_and_verified_against_retained_active_root_v1",
  ),
  preparedRegistryRelationship: z.literal(
    "root_signed_direct_successor_of_same_cohort_retained_steady_tip_candidate_not_current_or_published_v1",
  ),
  rootSigningAuthority: z.literal(
    "external_signature_verification_only_no_signer_capability_v1",
  ),
  formalCatalogDirectSuccessor: z.literal("none"),
  formalDestinationTrust: z.literal("none"),
  formalPlan: z.literal("none"),
  formalPlanPin: z.literal("none"),
  reservationRecords: z.literal("none"),
  reservationTokens: z.literal("none"),
  planPublication: z.literal("none"),
  providerAuthority: z.literal("none"),
  durability: z.literal("none"),
  migrationExecution: z.literal("none"),
});

const PreparedRegistrySuccessorClosureProjectionShapeV1 = {
  authority: z.literal(
    "none_provider_migration_same_installation_identity_current_strong_source_normal_prepared_registry_successor_reference_candidate_only",
  ),
  profile: z.literal(
    "provider_migration_same_installation_identity_current_strong_source_normal_prepared_registry_successor_reference_candidate_v1",
  ),
  stopPoint: z.literal(
    "after_external_root_signed_prepared_registry_direct_successor_validation_before_registry_manifest_publication",
  ),
  preSideEffectPlanAdmissionClosure:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1Schema,
  formalMigrationIdMapping: FormalMigrationIdMappingV1Schema,
  currentSteadyRegistryManifestPin: ProviderRegistryManifestPinV1Schema,
  preparedRegistryManifestEnvelope: ProviderRegistryManifestEnvelopeV1Schema,
  preparedRegistryManifestPin: ProviderRegistryManifestPinV1Schema,
  publicationPrerequisite: PlanPublicationPrerequisiteV1Schema,
  publicationGate: PublicationGateV1Schema,
  sideEffectBoundary: SideEffectBoundaryV1Schema,
  verificationBoundary: VerificationBoundaryV1Schema,
} as const;

const PreparedRegistrySuccessorClosureProjectionV1Schema = z.strictObject(
  PreparedRegistrySuccessorClosureProjectionShapeV1,
);

const PreparedRegistrySuccessorValidationShapeV1 = {
  ...PreparedRegistrySuccessorClosureProjectionShapeV1,
  closureContentDigest: ContentDigestV1Schema,
} as const;
const PreparedRegistrySuccessorBareValidationV1Schema = z.strictObject(
  PreparedRegistrySuccessorValidationShapeV1,
);

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1 {
  readonly authority: "none_provider_migration_same_installation_identity_current_strong_source_normal_prepared_registry_successor_reference_candidate_only";
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_prepared_registry_successor_reference_candidate_v1";
  readonly stopPoint: "after_external_root_signed_prepared_registry_direct_successor_validation_before_registry_manifest_publication";
  readonly preSideEffectPlanAdmissionClosure: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1;
  readonly formalMigrationIdMapping: z.infer<
    typeof FormalMigrationIdMappingV1Schema
  >;
  readonly currentSteadyRegistryManifestPin: z.infer<
    typeof ProviderRegistryManifestPinV1Schema
  >;
  readonly preparedRegistryManifestEnvelope: z.infer<
    typeof ProviderRegistryManifestEnvelopeV1Schema
  >;
  readonly preparedRegistryManifestPin: z.infer<
    typeof ProviderRegistryManifestPinV1Schema
  >;
  readonly publicationPrerequisite: z.infer<
    typeof PlanPublicationPrerequisiteV1Schema
  >;
  readonly publicationGate: z.infer<typeof PublicationGateV1Schema>;
  readonly sideEffectBoundary: z.infer<typeof SideEffectBoundaryV1Schema>;
  readonly verificationBoundary: z.infer<typeof VerificationBoundaryV1Schema>;
  readonly closureContentDigest: ContentDigestV1;
}

function expectedPreparedMembersV1(
  currentMembers: readonly ProviderRegistryManifestMemberV1[],
  destinationMember: ProviderRegistryManifestMemberV1,
): ProviderRegistryManifestMemberV1[] | undefined {
  const output: ProviderRegistryManifestMemberV1[] = [];
  let inserted = false;
  for (let index = 0; index < currentMembers.length; index += 1) {
    const current = currentMembers[index]!;
    const order = compareUtf8StringsV1(
      destinationMember.providerId,
      current.providerId,
    );
    if (order === 0) return undefined;
    if (!inserted && order < 0) {
      arrayPushV1(output, destinationMember);
      inserted = true;
    }
    arrayPushV1(output, current);
  }
  if (!inserted) arrayPushV1(output, destinationMember);
  return output;
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorClosureContentDigestV1(
  input: unknown,
): ContentDigestV1 {
  const full = PreparedRegistrySuccessorBareValidationV1Schema.safeParse(input);
  let completeProjection: z.infer<
    typeof PreparedRegistrySuccessorClosureProjectionV1Schema
  >;
  if (full.success) {
    const {
      closureContentDigest: _closureContentDigest,
      ...projection
    } = full.data;
    completeProjection =
      PreparedRegistrySuccessorClosureProjectionV1Schema.parse(projection);
  } else {
    completeProjection =
      PreparedRegistrySuccessorClosureProjectionV1Schema.parse(input);
  }
  const hex = sha256HexForDomainV1(
    PREPARED_REGISTRY_SUCCESSOR_CLOSURE_DOMAIN_V1,
    completeProjection,
  );
  return ContentDigestV1Schema.parse(`sha256:${hex}`);
}

function refinePreparedRegistrySuccessorValidationV1(
  value: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1,
  context: z.RefinementCtx,
): void {
  const d41 = value.preSideEffectPlanAdmissionClosure;
  const mapping = value.formalMigrationIdMapping;
  const destinationTrust = d41.destinationTrust;
  if (destinationTrust.role !== "destination_prospective_not_selected") return;
  const destinationCut =
    destinationTrust.authorization.prospectiveDestinationCut;
  const currentEnvelope = destinationCut.currentSteadyRegistryManifestEnvelope;
  const current = currentEnvelope.payload;
  const preparedEnvelope = value.preparedRegistryManifestEnvelope;
  const prepared = preparedEnvelope.payload;

  if (
    mapping.candidateMigrationId !== d41.migrationId ||
    mapping.formalMigrationId !==
      deriveFormalMigrationIdV1(mapping.candidateMigrationId)
  ) {
    addIssueV1(
      context,
      ["formalMigrationIdMapping"],
      "formal Migration ID must be the exact one-way domain projection of the embedded D-41 candidate Migration ID",
    );
  }

  if (
    !canonicalEqualV1(
      value.currentSteadyRegistryManifestPin,
      destinationCut.currentSteadyRegistryManifestPin,
    )
  ) {
    addIssueV1(
      context,
      ["currentSteadyRegistryManifestPin"],
      "current steady Registry Pin must equal the D-41 prospective destination cut",
    );
  }

  if (current.routing.state !== "steady") {
    addIssueV1(
      context,
      [
        "preSideEffectPlanAdmissionClosure",
        "destinationTrust",
        "authorization",
        "prospectiveDestinationCut",
        "currentSteadyRegistryManifestEnvelope",
        "payload",
        "routing",
      ],
      "D-41 current Registry Manifest must be steady",
    );
  }

  const currentEnabledMembers: ProviderRegistryManifestMemberV1[] = [];
  for (let index = 0; index < current.members.length; index += 1) {
    const member = current.members[index]!;
    if (member.disposition === "enabled") {
      arrayPushV1(currentEnabledMembers, member);
    }
  }
  const sourceProviderId = d41.sourceTrust.currentWriterSelection.providerId;
  const destinationEntry = destinationCut.prospectiveRegistryEntry;
  const destinationProviderId = destinationEntry.providerId;
  if (
    currentEnabledMembers.length !== 1 ||
    currentEnabledMembers[0]?.providerId !== sourceProviderId
  ) {
    addIssueV1(
      context,
      ["preparedRegistryManifestEnvelope", "payload", "members"],
      "the current steady Manifest must contain the D-41 selected source as its only enabled member",
    );
  }

  const expectedDestinationMember: ProviderRegistryManifestMemberV1 = {
    providerId: destinationProviderId,
    disposition: "enabled",
    registryEntryContentDigest:
      destinationCut.prospectiveRegistryEntryContentDigest,
    registryEntry: destinationEntry,
  };
  const expectedMembers = expectedPreparedMembersV1(
    current.members,
    expectedDestinationMember,
  );

  if (
    current.manifestGeneration >= CapturedNumberMaxSafeIntegerV1 ||
    prepared.manifestGeneration !== current.manifestGeneration + 1 ||
    prepared.predecessor.state !== "manifest" ||
    prepared.predecessor.generationId !== currentEnvelope.generationId ||
    prepared.predecessor.contentDigest !== currentEnvelope.contentDigest ||
    prepared.installationIdentityGenerationId !==
      current.installationIdentityGenerationId ||
    !canonicalEqualV1(prepared.activeRootMetadata, current.activeRootMetadata) ||
    expectedMembers === undefined ||
    !canonicalEqualV1(prepared.members, expectedMembers)
  ) {
    addIssueV1(
      context,
      ["preparedRegistryManifestEnvelope", "payload"],
      "prepared Registry Manifest must be the direct same-Identity, same-Root successor retaining every old member and enabling only the D-41 destination",
    );
  }

  if (
    prepared.routing.state !== "migration" ||
    prepared.routing.migrationId !== mapping.formalMigrationId ||
    prepared.routing.sourceProviderId !== sourceProviderId ||
    prepared.routing.destinationProviderId !== destinationProviderId ||
    prepared.routing.activeForMigrationWrites !== sourceProviderId ||
    prepared.routing.phase !== "prepared"
  ) {
    addIssueV1(
      context,
      ["preparedRegistryManifestEnvelope", "payload", "routing"],
      "prepared routing must bind the mapped formal Migration ID, exact endpoints, active source, and prepared phase",
    );
  }

  let derivedPreparedGenerationId: string | undefined;
  let derivedPreparedContentDigest: string | undefined;
  try {
    derivedPreparedGenerationId =
      deriveProviderRegistryManifestGenerationIdV1(prepared);
    derivedPreparedContentDigest =
      deriveProviderRegistryManifestContentDigestV1(prepared);
  } catch {
    addIssueV1(
      context,
      ["preparedRegistryManifestEnvelope", "payload"],
      "prepared Registry Manifest identity and content must be derivable",
    );
  }
  if (
    derivedPreparedGenerationId === undefined ||
    derivedPreparedContentDigest === undefined ||
    preparedEnvelope.generationId !== derivedPreparedGenerationId ||
    preparedEnvelope.contentDigest !== derivedPreparedContentDigest ||
    value.preparedRegistryManifestPin.locatorProfile !==
      "installation_provider_registry_manifest_v1" ||
    value.preparedRegistryManifestPin.manifestGeneration !==
      prepared.manifestGeneration ||
    value.preparedRegistryManifestPin.generationId !==
      derivedPreparedGenerationId ||
    value.preparedRegistryManifestPin.contentDigest !==
      derivedPreparedContentDigest
  ) {
    addIssueV1(
      context,
      ["preparedRegistryManifestPin"],
      "prepared Registry Envelope and Pin must bind the exact successor payload",
    );
  }

  const prerequisite = value.publicationPrerequisite;
  if (
    prerequisite.formalMigrationId !== mapping.formalMigrationId ||
    prerequisite.candidatePlanContentDigest !== d41.planCandidate.contentDigest ||
    prerequisite.admissionVectorDigest !== d41.admissionVectorDigest ||
    prerequisite.journalAuthorityInstallationIdentityGenerationId !==
      d41.planCandidate.payload
        .journalAuthorityInstallationIdentityGenerationId
  ) {
    addIssueV1(
      context,
      ["publicationPrerequisite"],
      "future formal Plan rules must bind the exact mapping and D-41 candidate Plan admission basis without treating that candidate as a formal Plan",
    );
  }

  if (
    value.closureContentDigest !==
    deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorClosureContentDigestV1(
      value,
    )
  ) {
    addIssueV1(
      context,
      ["closureContentDigest"],
      "closure digest must bind the complete strict D-42 success projection",
    );
  }
}

export const ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1Schema: z.ZodType<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1> =
  z
    .strictObject(PreparedRegistrySuccessorValidationShapeV1)
    .superRefine(refinePreparedRegistrySuccessorValidationV1);

export function validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateV1(
  input: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1 {
  return deepFreezeProviderPointDetachedDataTreeV1(
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1Schema.parse(
      input,
    ),
  );
}

CapturedObjectFreezeV1(
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorRequestReferenceCandidateV1Schema,
);
CapturedObjectFreezeV1(
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1Schema,
);
CapturedObjectFreezeV1(
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalMigrationIdMappingV1,
);
CapturedObjectFreezeV1(
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorClosureContentDigestV1,
);
CapturedObjectFreezeV1(
  validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateV1,
);
