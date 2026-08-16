/**
 * Package-private, process-local metadata closure after exact execution.
 *
 * This model proves only that the immutable in-memory publication metadata
 * exactly covers the formal Plan object set. It is not evidence that a real
 * Provider copied bytes, performed I/O, or durably deleted source objects.
 */

import { createDomainPreimageBytesV1 } from "./domain-crypto.js";
import { canonicalizeJcsSafeIntegerV1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  type ContentDigestV1,
  type InstallationIdentityGenerationIdV1,
  type ProviderMigrationIdV1,
} from "./primitives.js";
import type { ProviderFeasibilitySupportCatalogPinV1 } from "./provider-feasibility-support-catalog-point.js";
import {
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndCompletedExecutionContinuationInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndExecutionReferenceValidationInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-end-to-end-execution-reference-orchestrator-internal.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-compound-publication-reference-machine-internal.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompletedExecutionContinuationInternalV1,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationObjectPublicationMetadataReceiptInternalV1,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReceiptInternalV1,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressStateInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-execution-progress-reference-machine-internal.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-migration-only-acceptance-compare-append-reference-machine-internal.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-formal-plan-reference-candidate-wire.js";
import type {
  ProviderRegistryManifestEnvelopeV1,
  ProviderRegistryManifestPinV1,
} from "./provider-registry-records.js";
import type {
  ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
} from "./provider-strong-ready-bootstrap-or-steady-acceptance-identity-verification-capability-internal.js";
import { sha256InternalV1 } from "./sha256.js";

const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectIsFrozenV1 = Object.isFrozen;
const CapturedTypeErrorV1 = TypeError;
const CapturedWeakMapV1 = WeakMap;
const CapturedWeakMapPrototypeDeleteV1 = WeakMap.prototype.delete;
const CapturedWeakMapPrototypeGetV1 = WeakMap.prototype.get;
const CapturedWeakMapPrototypeSetV1 = WeakMap.prototype.set;

const EXECUTION_MODEL_V1 =
  "in_memory_metadata_reference_only_no_real_provider_bytes_or_io_proof_v1" as const;
const DURABILITY_V1 =
  "in_memory_reference_only_not_a_durable_provider_v1" as const;
const RECEIPT_SET_DOMAIN_V1 =
  "provider-migration-same-installation-identity-destination-publication-receipt-set-v1";
const DESTINATION_UNIVERSE_DOMAIN_V1 =
  "provider-migration-same-installation-identity-destination-universe-metadata-v1";
const ZERO_LIVE_PROOF_DOMAIN_V1 =
  "provider-migration-same-installation-identity-zero-live-reference-proof-v1";
const CLOSURE_DOMAIN_V1 =
  "provider-migration-same-installation-identity-destination-universe-zero-live-closure-v1";

function bindUncurriedAtBootstrapV1(method: Function): Function {
  return CapturedObjectFreezeV1(Function.prototype.call.bind(method));
}

const weakMapDeleteV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeDeleteV1,
) as <K extends object>(map: WeakMap<K, unknown>, key: K) => boolean;
const weakMapGetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeGetV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K) => V | undefined;
const weakMapSetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeSetV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K, value: V) => void;

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

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  return canonicalizeJcsSafeIntegerV1(left) ===
    canonicalizeJcsSafeIntegerV1(right);
}

function deepFreezeV1<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreezeV1(child);
    CapturedObjectFreezeV1(value);
  }
  return value;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseObjectMetadataInternalV1 {
  readonly objectOrdinal: number;
  readonly contentDigest: ContentDigestV1;
  readonly semanticLocatorDigest: ContentDigestV1;
  readonly logicalLocatorReferenceDigest: ContentDigestV1;
  readonly logicalBytes: number;
  readonly destinationPublicationReceiptContentDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteDestinationPublicationReceiptSetInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_complete_destination_publication_receipt_set_v1";
  readonly executionModel: typeof EXECUTION_MODEL_V1;
  readonly receiptCount: number;
  readonly receipts: readonly ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationObjectPublicationMetadataReceiptInternalV1[];
  readonly relationship: "exact_complete_ordered_receipt_set_for_formal_plan_objects_v1";
  readonly receiptSetDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseMetadataInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_destination_universe_metadata_v1";
  readonly executionModel: typeof EXECUTION_MODEL_V1;
  readonly formalPlanPin: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1;
  readonly destinationProviderId: string;
  readonly destinationProviderBindingReferenceDigest: ContentDigestV1;
  readonly objectCount: number;
  readonly logicalObjectBytesTotal: number;
  readonly objects: readonly ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseObjectMetadataInternalV1[];
  readonly completeReceiptSetDigest: ContentDigestV1;
  readonly relationship: "metadata_universe_exactly_covers_formal_plan_objects_v1";
  readonly universeContentDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveReferenceProofInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_zero_live_reference_proof_v1";
  readonly executionModel: typeof EXECUTION_MODEL_V1;
  readonly formalPlanPin: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1;
  readonly sourceReadClosureContentDigest: ContentDigestV1;
  readonly destinationUniverseContentDigest: ContentDigestV1;
  readonly completeReceiptSetDigest: ContentDigestV1;
  readonly sourceObjectCount: number;
  readonly migratedObjectCount: number;
  readonly remainingSourceLiveObjectCount: 0;
  readonly remainingSourceLiveOrdinals: readonly [];
  readonly remainingSourceLiveReferenceCount: 0;
  readonly relationship: "exact_publication_coverage_implies_zero_remaining_live_ordinals_in_metadata_model_v1";
  readonly proofContentDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseZeroLiveReferenceValidationInternalV1 {
  readonly authority: typeof EXECUTION_MODEL_V1;
  readonly durability: typeof DURABILITY_V1;
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_destination_universe_zero_live_reference_validation_v1";
  readonly relationship: "exact_completed_execution_forms_destination_universe_and_zero_live_metadata_proof_v1";
  readonly executionCompletedState: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressStateInternalV1;
  readonly terminalProgressReceipt: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReceiptInternalV1;
  readonly formalPlanEnvelope: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1;
  readonly formalPlanPin: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1;
  readonly installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  readonly formalMigrationId: ProviderMigrationIdV1;
  readonly sourceProviderId: string;
  readonly destinationProviderId: string;
  readonly currentRegistryManifestEnvelope: ProviderRegistryManifestEnvelopeV1;
  readonly currentRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly currentSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1;
  readonly completeDestinationPublicationReceiptSet: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteDestinationPublicationReceiptSetInternalV1;
  readonly destinationUniverseMetadata: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseMetadataInternalV1;
  readonly remainingSourceLiveOrdinals: readonly [];
  readonly zeroLiveReferenceProof: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveReferenceProofInternalV1;
  readonly closureContentDigest: ContentDigestV1;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseZeroLiveReferenceDiagnosticResultInternalV1 =
  | Readonly<{
      readonly ok: true;
      readonly value: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseZeroLiveReferenceValidationInternalV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage: "end_to_end_handoff" | "publication_coverage";
      readonly reason: "capability_invalid" | "incomplete_or_invalid_destination_publications";
    }>;

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveRegistryContinuationInternalV1 {
  readonly zeroLiveClosure: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseZeroLiveReferenceValidationInternalV1;
  readonly compoundPublicationReferenceMachineCapability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1;
  readonly migrationOnlyAcceptanceReferenceMachineCapability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1;
  readonly acceptanceIdentityVerificationCapability: ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
  readonly currentRegistryManifestEnvelope: ProviderRegistryManifestEnvelopeV1;
  readonly currentRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly formalMigrationId: ProviderMigrationIdV1;
  readonly sourceProviderId: string;
  readonly destinationProviderId: string;
  readonly exactCompletedExecution: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompletedExecutionContinuationInternalV1;
  readonly completeDestinationPublicationReceiptSet: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteDestinationPublicationReceiptSetInternalV1;
  readonly destinationUniverseMetadata: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseMetadataInternalV1;
  readonly zeroLiveReferenceProof: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveReferenceProofInternalV1;
}

const registryContinuationsV1 = new CapturedWeakMapV1<
  object,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveRegistryContinuationInternalV1
>();

function failureV1(
  stage: "end_to_end_handoff" | "publication_coverage",
  reason: "capability_invalid" | "incomplete_or_invalid_destination_publications",
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseZeroLiveReferenceDiagnosticResultInternalV1 {
  return CapturedObjectFreezeV1({ ok: false, stage, reason });
}

function validateAndProjectObjectsV1(
  completed: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompletedExecutionContinuationInternalV1,
): readonly ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseObjectMetadataInternalV1[] | undefined {
  const sourceObjects = completed.sourceReadClosure.objects;
  const publications = completed.destinationObjectPublications;
  if (
    completed.executionCompletedState.highWater.phase !== "completed" ||
    completed.terminalProgressReceipt.progressRecord.phase !== "completed" ||
    completed.terminalProgressReceipt.progressRecord.transition !== "complete_execution" ||
    publications.length !== sourceObjects.length ||
    publications.length !== completed.sourceReadClosure.objectCount ||
    completed.executionCompletedState.highWater.copiedObjectCount !==
      sourceObjects.length ||
    completed.executionCompletedState.highWater.remainingSourceObjectCount !== 0 ||
    !CapturedObjectIsFrozenV1(publications)
  ) return undefined;
  const output: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseObjectMetadataInternalV1[] = [];
  let logicalBytes = 0;
  for (let index = 0; index < sourceObjects.length; index += 1) {
    const source = sourceObjects[index]!;
    const publication = publications[index]!;
    logicalBytes += source.logicalBytes;
    if (
      !Number.isSafeInteger(logicalBytes) ||
      source.objectOrdinal !== index ||
      publication.publicationOrdinal !== index ||
      publication.sourceObjectOrdinal !== index ||
      publication.sourceContentDigest !== source.contentDigest ||
      publication.sourceSemanticLocatorDigest !== source.semanticLocatorDigest ||
      publication.sourceLogicalLocatorReferenceDigest !==
        source.logicalLocatorReferenceDigest ||
      publication.sourceProviderBindingReferenceDigest !==
        source.providerBindingReferenceDigest ||
      publication.sourceLogicalBytes !== source.logicalBytes ||
      publication.destinationProviderId !== completed.destinationProviderBinding.providerId ||
      !canonicalEqualV1(
        publication.destinationProviderBinding,
        completed.destinationProviderBinding,
      ) ||
      !canonicalEqualV1(publication.formalPlanPin, completed.formalPlanPin)
    ) return undefined;
    output[index] = CapturedObjectFreezeV1({
      objectOrdinal: index,
      contentDigest: source.contentDigest,
      semanticLocatorDigest: source.semanticLocatorDigest,
      logicalLocatorReferenceDigest: source.logicalLocatorReferenceDigest,
      logicalBytes: source.logicalBytes,
      destinationPublicationReceiptContentDigest:
        publication.receiptContentDigest,
    });
  }
  if (logicalBytes !== completed.sourceReadClosure.logicalObjectBytesTotal) {
    return undefined;
  }
  return CapturedObjectFreezeV1(output);
}

export function buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseZeroLiveReferenceFromExactEndToEndSuccessInternalV1(
  exactEndToEndSuccess: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndExecutionReferenceValidationInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseZeroLiveReferenceDiagnosticResultInternalV1 {
  const completed =
    takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndToEndCompletedExecutionContinuationInternalV1(
      exactEndToEndSuccess,
    );
  if (
    completed === undefined ||
    exactEndToEndSuccess.executionProgressState !==
      completed.executionCompletedState ||
    exactEndToEndSuccess.terminalReceipt !== completed.terminalProgressReceipt ||
    !canonicalEqualV1(
      exactEndToEndSuccess.rebindingRegistrySuccessorClosure.currentRegistryManifestEnvelope,
      completed.currentRegistryManifestEnvelope,
    ) ||
    !canonicalEqualV1(
      exactEndToEndSuccess.rebindingRegistrySuccessorClosure.currentRegistryManifestPin,
      completed.currentRegistryManifestPin,
    )
  ) return failureV1("end_to_end_handoff", "capability_invalid");
  const routing = completed.currentRegistryManifestEnvelope.payload.routing;
  const objects = validateAndProjectObjectsV1(completed);
  if (
    objects === undefined ||
    routing.state !== "migration" ||
    routing.phase !== "rebinding" ||
    routing.activeForMigrationWrites !== routing.destinationProviderId ||
    routing.migrationId !== completed.formalMigrationId
  ) return failureV1(
    "publication_coverage",
    "incomplete_or_invalid_destination_publications",
  );

  const receiptSetUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_complete_destination_publication_receipt_set_v1" as const,
    executionModel: EXECUTION_MODEL_V1,
    receiptCount: completed.destinationObjectPublications.length,
    receipts: completed.destinationObjectPublications,
    relationship:
      "exact_complete_ordered_receipt_set_for_formal_plan_objects_v1" as const,
  };
  const completeDestinationPublicationReceiptSet = deepFreezeV1({
    ...receiptSetUnsigned,
    receiptSetDigest: digestV1(RECEIPT_SET_DOMAIN_V1, receiptSetUnsigned),
  });
  const universeUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_destination_universe_metadata_v1" as const,
    executionModel: EXECUTION_MODEL_V1,
    formalPlanPin: completed.formalPlanPin,
    destinationProviderId: routing.destinationProviderId,
    destinationProviderBindingReferenceDigest:
      completed.destinationProviderBinding.bindingReferenceDigest,
    objectCount: objects.length,
    logicalObjectBytesTotal:
      completed.sourceReadClosure.logicalObjectBytesTotal,
    objects,
    completeReceiptSetDigest:
      completeDestinationPublicationReceiptSet.receiptSetDigest,
    relationship:
      "metadata_universe_exactly_covers_formal_plan_objects_v1" as const,
  };
  const destinationUniverseMetadata = deepFreezeV1({
    ...universeUnsigned,
    universeContentDigest: digestV1(
      DESTINATION_UNIVERSE_DOMAIN_V1,
      universeUnsigned,
    ),
  });
  const remainingSourceLiveOrdinals = CapturedObjectFreezeV1([]) as readonly [];
  const zeroLiveUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_zero_live_reference_proof_v1" as const,
    executionModel: EXECUTION_MODEL_V1,
    formalPlanPin: completed.formalPlanPin,
    sourceReadClosureContentDigest:
      completed.sourceReadClosure.completeReadClosureContentDigest,
    destinationUniverseContentDigest:
      destinationUniverseMetadata.universeContentDigest,
    completeReceiptSetDigest:
      completeDestinationPublicationReceiptSet.receiptSetDigest,
    sourceObjectCount: completed.sourceReadClosure.objectCount,
    migratedObjectCount: objects.length,
    remainingSourceLiveObjectCount: 0 as const,
    remainingSourceLiveOrdinals,
    remainingSourceLiveReferenceCount: 0 as const,
    relationship:
      "exact_publication_coverage_implies_zero_remaining_live_ordinals_in_metadata_model_v1" as const,
  };
  const zeroLiveReferenceProof = deepFreezeV1({
    ...zeroLiveUnsigned,
    proofContentDigest: digestV1(ZERO_LIVE_PROOF_DOMAIN_V1, zeroLiveUnsigned),
  });
  const closureUnsigned = {
    authority: EXECUTION_MODEL_V1,
    durability: DURABILITY_V1,
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_destination_universe_zero_live_reference_validation_v1" as const,
    relationship:
      "exact_completed_execution_forms_destination_universe_and_zero_live_metadata_proof_v1" as const,
    executionCompletedState: completed.executionCompletedState,
    terminalProgressReceipt: completed.terminalProgressReceipt,
    formalPlanEnvelope: completed.formalPlanEnvelope,
    formalPlanPin: completed.formalPlanPin,
    installationIdentityGenerationId:
      completed.installationIdentityGenerationId,
    formalMigrationId: completed.formalMigrationId,
    sourceProviderId: routing.sourceProviderId,
    destinationProviderId: routing.destinationProviderId,
    currentRegistryManifestEnvelope: completed.currentRegistryManifestEnvelope,
    currentRegistryManifestPin: completed.currentRegistryManifestPin,
    currentSupportCatalogPin: completed.currentSupportCatalogPin,
    completeDestinationPublicationReceiptSet,
    destinationUniverseMetadata,
    remainingSourceLiveOrdinals,
    zeroLiveReferenceProof,
  };
  const value = deepFreezeV1({
    ...closureUnsigned,
    closureContentDigest: digestV1(CLOSURE_DOMAIN_V1, closureUnsigned),
  });
  weakMapSetV1(registryContinuationsV1, value, CapturedObjectFreezeV1({
    zeroLiveClosure: value,
    compoundPublicationReferenceMachineCapability:
      completed.compoundPublicationReferenceMachineCapability,
    migrationOnlyAcceptanceReferenceMachineCapability:
      completed.migrationOnlyAcceptanceReferenceMachineCapability,
    acceptanceIdentityVerificationCapability:
      completed.acceptanceIdentityVerificationCapability,
    currentRegistryManifestEnvelope: value.currentRegistryManifestEnvelope,
    currentRegistryManifestPin: value.currentRegistryManifestPin,
    formalMigrationId: value.formalMigrationId,
    sourceProviderId: value.sourceProviderId,
    destinationProviderId: value.destinationProviderId,
    exactCompletedExecution: completed,
    completeDestinationPublicationReceiptSet:
      value.completeDestinationPublicationReceiptSet,
    destinationUniverseMetadata: value.destinationUniverseMetadata,
    zeroLiveReferenceProof: value.zeroLiveReferenceProof,
  }));
  return CapturedObjectFreezeV1({ ok: true, value });
}

export function takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveRegistryContinuationInternalV1(
  exactZeroLiveSuccess: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseZeroLiveReferenceValidationInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveRegistryContinuationInternalV1 | undefined {
  if (exactZeroLiveSuccess === null || typeof exactZeroLiveSuccess !== "object") {
    return undefined;
  }
  const continuation = weakMapGetV1(registryContinuationsV1, exactZeroLiveSuccess);
  if (
    continuation === undefined ||
    !weakMapDeleteV1(registryContinuationsV1, exactZeroLiveSuccess)
  ) return undefined;
  return continuation;
}

for (const exportedFunctionV1 of [
  buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseZeroLiveReferenceFromExactEndToEndSuccessInternalV1,
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveRegistryContinuationInternalV1,
]) CapturedObjectFreezeV1(exportedFunctionV1);
