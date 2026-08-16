/**
 * Package-private in-memory execution/progress reference machine for the
 * exact formal-Plan object set on the same-Identity migration path.
 *
 * The machine is intentionally not a durable Provider implementation. It
 * authenticates one committed D44 compound-publication machine capability,
 * retains one exact migration-only Acceptance boundary, and advances only
 * accepted -> running -> contiguous object commits -> source_drained ->
 * completed by immutable snapshots.
 */

import { createDomainPreimageBytesV1 } from "./domain-crypto.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  LowerHex32V1Schema,
  ProviderAcceptanceStateGenerationIdV1Schema,
  type ContentDigestV1,
  type InstallationIdentityGenerationIdV1,
  type ProviderAcceptanceStateGenerationIdV1,
  type ProviderMigrationIdV1,
} from "./primitives.js";
import type { ProviderFeasibilitySupportCatalogPinV1 } from "./provider-feasibility-support-catalog-point.js";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1Schema,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-formal-plan-reference-candidate-wire.js";
import {
  inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCommittedReceiptInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-compound-publication-reference-machine-internal.js";
import {
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceEnvelopeInternalV1Schema,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceEnvelopeInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-migration-only-acceptance-reference-candidate-internal.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-migration-only-acceptance-compare-append-reference-machine-internal.js";
import {
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceValidationInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-migration-only-acceptance-reference-capability-internal.js";
import {
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistryExecutionContinuationInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorReferenceValidationInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-rebinding-registry-successor-reference-capability-internal.js";
import {
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceDigestReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceCandidateV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-reference-candidate-wire.js";
import type {
  ProviderRegistryManifestEnvelopeV1,
  ProviderRegistryManifestPinV1,
} from "./provider-registry-records.js";
import type {
  ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
} from "./provider-strong-ready-bootstrap-or-steady-acceptance-identity-verification-capability-internal.js";
import { sha256InternalV1 } from "./sha256.js";

const CapturedArrayIsArrayV1 = Array.isArray;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedNumberIsSafeIntegerV1 = Number.isSafeInteger;
const CapturedNumberPrototypeToStringV1 = Number.prototype.toString;
const CapturedObjectCreateV1 = Object.create;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 = Object.getOwnPropertyDescriptor;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedObjectIsFrozenV1 = Object.isFrozen;
const CapturedObjectPrototypeV1 = Object.prototype;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedReflectOwnKeysV1 = Reflect.ownKeys;
const CapturedStringPrototypePadStartV1 = String.prototype.padStart;
const CapturedTypeErrorV1 = TypeError;
const CapturedWeakMapV1 = WeakMap;
const CapturedWeakMapPrototypeDeleteV1 = WeakMap.prototype.delete;
const CapturedWeakMapPrototypeGetV1 = WeakMap.prototype.get;
const CapturedWeakMapPrototypeSetV1 = WeakMap.prototype.set;
const CapturedWeakSetV1 = WeakSet;
const CapturedWeakSetPrototypeAddV1 = WeakSet.prototype.add;
const CapturedWeakSetPrototypeHasV1 = WeakSet.prototype.has;

function bindUncurriedAtBootstrapV1(method: Function): Function {
  return CapturedObjectFreezeV1(
    CapturedReflectApplyV1(
      CapturedFunctionPrototypeBindV1,
      CapturedFunctionPrototypeCallV1,
      CapturedObjectFreezeV1([method]),
    ) as Function,
  );
}

const numberToStringV1 = bindUncurriedAtBootstrapV1(
  CapturedNumberPrototypeToStringV1,
) as (value: number, radix?: number) => string;
const stringPadStartV1 = bindUncurriedAtBootstrapV1(
  CapturedStringPrototypePadStartV1,
) as (value: string, length: number, fill?: string) => string;
const weakMapGetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeGetV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K) => V | undefined;
const weakMapDeleteV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeDeleteV1,
) as <K extends object>(map: WeakMap<K, unknown>, key: K) => boolean;
const weakMapSetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeSetV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K, value: V) => void;
const weakSetAddV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakSetPrototypeAddV1,
) as <T extends object>(set: WeakSet<T>, value: T) => WeakSet<T>;
const weakSetHasV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakSetPrototypeHasV1,
) as <T extends object>(set: WeakSet<T>, value: T) => boolean;

const MACHINE_DURABILITY_V1 =
  "in_memory_execution_progress_reference_only_not_a_durable_provider_v1" as const;
const ACCEPTANCE_BOUNDARY_DOMAIN_V1 =
  "provider-migration-same-installation-identity-migration-only-acceptance-boundary-v1";
const REQUEST_DOMAIN_V1 =
  "provider-migration-same-installation-identity-execution-progress-request-v1";
const PROGRESS_DOMAIN_V1 =
  "provider-migration-same-installation-identity-execution-progress-record-v1";
const HIGH_WATER_DOMAIN_V1 =
  "provider-migration-same-installation-identity-execution-progress-high-water-v1";
const RECEIPT_DOMAIN_V1 =
  "provider-migration-same-installation-identity-execution-progress-receipt-v1";
const DESTINATION_OBJECT_PUBLICATION_DOMAIN_V1 =
  "provider-migration-same-installation-identity-execution-destination-object-publication-metadata-receipt-v1";
const DESTINATION_PUBLICATION_MODE_V1 =
  "metadata_only_in_memory_reference_no_external_destination_write_v1" as const;

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionPhaseInternalV1 =
  | "accepted"
  | "running"
  | "source_drained"
  | "completed";

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionTransitionInternalV1 =
  | "start_execution"
  | "commit_source_object"
  | "mark_source_drained"
  | "complete_execution";

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceBoundaryLikeInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_migration_only_acceptance_boundary_like_v1";
  readonly acceptanceKind: "migration_only";
  readonly migrationOnlyAcceptanceEnvelope: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceEnvelopeInternalV1;
  readonly migrationOnlyAcceptancePin: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1;
  readonly installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  readonly formalMigrationId: ProviderMigrationIdV1;
  readonly formalPlanPin: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1;
  readonly publishedRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly publishedSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1;
  readonly acceptanceGenerationId: ProviderAcceptanceStateGenerationIdV1;
  readonly acceptanceContentDigest: ContentDigestV1;
  readonly sourceObjectCount: number;
  readonly sourceLogicalBytes: number;
  readonly relationship: "migration_only_acceptance_committed_source_current_until_execution_completed_v1";
  readonly boundaryContentDigest: ContentDigestV1;
}

export interface MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInputInternalV1 {
  readonly rebindingRegistrySuccessor: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorReferenceValidationInternalV1;
}

interface MintFromValidatedBasisInputInternalV1 {
  readonly formalPlanEnvelope: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1;
  readonly formalPlanPin: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1;
  readonly compoundPublicationReferenceMachineCapability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1;
  readonly migrationOnlyAcceptanceReferenceMachineCapability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1;
  readonly acceptanceIdentityVerificationCapability: ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
  readonly committedPublicationReceipt: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCommittedReceiptInternalV1;
  readonly currentRegistryManifestEnvelope: ProviderRegistryManifestEnvelopeV1;
  readonly currentRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly migrationOnlyAcceptance: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceBoundaryLikeInternalV1;
}

declare const executionProgressReferenceMachineCapabilityBrandInternalV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineCapabilityInternalV1 {
  readonly [executionProgressReferenceMachineCapabilityBrandInternalV1]: true;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressAdvanceRequestInternalV1 {
  readonly operationNonce: string;
  readonly expectedProgressRevision: number;
  readonly expectedPhase: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionPhaseInternalV1;
  readonly transition: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionTransitionInternalV1;
  readonly sourceObjectOrdinal: number | "none";
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressRecordInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_execution_progress_record_v1";
  readonly progressRevision: number;
  readonly operationNonce: string;
  readonly transition: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionTransitionInternalV1;
  readonly previousPhase: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionPhaseInternalV1;
  readonly phase: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionPhaseInternalV1;
  readonly sourceObjectOrdinal: number | "none";
  readonly sourceObjectLogicalBytes: number | "none";
  readonly destinationObjectPublicationReceiptContentDigest:
    | ContentDigestV1
    | "none";
  readonly formalMigrationId: ProviderMigrationIdV1;
  readonly formalPlanPin: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1;
  readonly migrationOnlyAcceptanceBoundaryContentDigest: ContentDigestV1;
  readonly sourceObjectCount: number;
  readonly copiedObjectCount: number;
  readonly remainingSourceObjectCount: number;
  readonly sourceLogicalBytes: number;
  readonly copiedLogicalBytes: number;
  readonly contentDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressHighWaterInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_execution_progress_high_water_v1";
  readonly progressRevision: number;
  readonly phase: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionPhaseInternalV1;
  readonly progressRecordCount: number;
  readonly receiptCount: number;
  readonly destinationObjectPublicationCount: number;
  readonly sourceObjectCount: number;
  readonly copiedObjectCount: number;
  readonly remainingSourceObjectCount: number;
  readonly sourceLogicalBytes: number;
  readonly copiedLogicalBytes: number;
  readonly lastProgressContentDigest: ContentDigestV1 | "none";
  readonly contentDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationObjectPublicationMetadataReceiptInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_destination_object_publication_metadata_receipt_v1";
  readonly durability: typeof MACHINE_DURABILITY_V1;
  readonly publicationMode: typeof DESTINATION_PUBLICATION_MODE_V1;
  readonly resolution: "committed";
  readonly operationNonce: string;
  readonly requestContentDigest: ContentDigestV1;
  readonly publicationOrdinal: number;
  readonly sourceObjectOrdinal: number;
  readonly sourceContentDigest: ContentDigestV1;
  readonly sourceSemanticLocatorDigest: ContentDigestV1;
  readonly sourceLogicalLocatorReferenceDigest: ContentDigestV1;
  readonly sourceProviderBindingReferenceDigest: ContentDigestV1;
  readonly sourceLogicalBytes: number;
  readonly destinationProviderId:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceCandidateV1["providerId"];
  readonly destinationProviderBinding:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceCandidateV1;
  readonly formalMigrationId: ProviderMigrationIdV1;
  readonly formalPlanPin: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1;
  readonly relationship: "metadata_only_destination_publication_committed_from_exact_formal_plan_source_object_v1";
  readonly receiptContentDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReceiptInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_execution_progress_receipt_v1";
  readonly durability: typeof MACHINE_DURABILITY_V1;
  readonly resolution: "committed";
  readonly operationNonce: string;
  readonly requestContentDigest: ContentDigestV1;
  readonly linearizationOrdinal: number;
  readonly progressRecord: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressRecordInternalV1;
  readonly destinationObjectPublication:
    | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationObjectPublicationMetadataReceiptInternalV1
    | "none";
  readonly committedHighWater: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressHighWaterInternalV1;
  readonly receiptContentDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressStateInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_execution_progress_state_v1";
  readonly durability: typeof MACHINE_DURABILITY_V1;
  readonly formalPlanEnvelope: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1;
  readonly formalPlanPin: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1;
  readonly committedPublicationReceipt: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCommittedReceiptInternalV1;
  readonly currentRegistryManifestEnvelope: ProviderRegistryManifestEnvelopeV1;
  readonly currentRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly migrationOnlyAcceptance: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceBoundaryLikeInternalV1;
  readonly destinationPublicationMode: typeof DESTINATION_PUBLICATION_MODE_V1;
  readonly highWater: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressHighWaterInternalV1;
  readonly progressRecords: readonly ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressRecordInternalV1[];
  readonly receipts: readonly ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReceiptInternalV1[];
  readonly destinationObjectPublications:
    readonly ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationObjectPublicationMetadataReceiptInternalV1[];
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressAdvanceResultInternalV1 =
  | Readonly<{
      readonly status: "committed";
      readonly replay: boolean;
      readonly receipt: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReceiptInternalV1;
    }>
  | Readonly<{
      readonly status: "not_committed";
      readonly reason: "stale_expected_progress";
      readonly observedHighWater: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressHighWaterInternalV1;
    }>
  | Readonly<{
      readonly status: "rejected";
      readonly reason:
        | "capability_invalid"
        | "schema_invalid"
        | "operation_nonce_conflict"
        | "transition_invalid";
    }>;

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompletedExecutionContinuationInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_completed_execution_continuation_v1";
  readonly relationship: "exact_completed_execution_terminal_handoff_consumed_once_v1";
  readonly executionCompletedState: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressStateInternalV1;
  readonly terminalProgressReceipt: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReceiptInternalV1;
  readonly formalPlanEnvelope: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1;
  readonly formalPlanPin: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1;
  readonly migrationOnlyAcceptance: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceBoundaryLikeInternalV1;
  readonly installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  readonly formalMigrationId: ProviderMigrationIdV1;
  readonly compoundPublicationReferenceMachineCapability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1;
  readonly migrationOnlyAcceptanceReferenceMachineCapability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1;
  readonly acceptanceIdentityVerificationCapability: ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
  readonly currentRegistryManifestEnvelope: ProviderRegistryManifestEnvelopeV1;
  readonly currentRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly currentSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1;
  readonly sourceReadClosure:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1["payload"]["completeSourceReadClosure"];
  readonly destinationProviderBinding:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceCandidateV1;
  readonly destinationObjectPublications:
    readonly ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationObjectPublicationMetadataReceiptInternalV1[];
}

interface ReplayEntryInternalV1 {
  readonly operationNonce: string;
  readonly requestCanonicalBytes: Uint8Array;
  readonly receipt: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReceiptInternalV1;
}

interface SnapshotInternalV1 {
  readonly publicState: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressStateInternalV1;
  readonly replayEntries: readonly ReplayEntryInternalV1[];
}

interface BindingInternalV1 {
  snapshot: SnapshotInternalV1;
  readonly compoundPublicationReferenceMachineCapability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1;
  readonly migrationOnlyAcceptanceReferenceMachineCapability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1;
  readonly acceptanceIdentityVerificationCapability: ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
}

const bindingsInternalV1 = new CapturedWeakMapV1<object, BindingInternalV1>();
const completedContinuationsInternalV1 =
  new CapturedWeakMapV1<
    object,
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressStateInternalV1
  >();

const ACCEPTANCE_KEYS_V1 = CapturedObjectFreezeV1([
  "profile",
  "acceptanceKind",
  "migrationOnlyAcceptanceEnvelope",
  "migrationOnlyAcceptancePin",
  "installationIdentityGenerationId",
  "formalMigrationId",
  "formalPlanPin",
  "publishedRegistryManifestPin",
  "publishedSupportCatalogPin",
  "acceptanceGenerationId",
  "acceptanceContentDigest",
  "sourceObjectCount",
  "sourceLogicalBytes",
  "relationship",
  "boundaryContentDigest",
] as const);
const MINT_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "rebindingRegistrySuccessor",
] as const);
const MINT_FROM_VALIDATED_BASIS_KEYS_V1 = CapturedObjectFreezeV1([
  "formalPlanEnvelope",
  "formalPlanPin",
  "compoundPublicationReferenceMachineCapability",
  "migrationOnlyAcceptanceReferenceMachineCapability",
  "acceptanceIdentityVerificationCapability",
  "committedPublicationReceipt",
  "currentRegistryManifestEnvelope",
  "currentRegistryManifestPin",
  "migrationOnlyAcceptance",
] as const);
const REQUEST_KEYS_V1 = CapturedObjectFreezeV1([
  "operationNonce",
  "expectedProgressRevision",
  "expectedPhase",
  "transition",
  "sourceObjectOrdinal",
] as const);

function bytesToLowerHexV1(bytes: Uint8Array): string {
  let output = "";
  for (let index = 0; index < bytes.byteLength; index += 1) {
    output += stringPadStartV1(numberToStringV1(bytes[index]!, 16), 2, "0");
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
  const leftBytes = canonicalizeJcsSafeIntegerUtf8V1(left);
  const rightBytes = canonicalizeJcsSafeIntegerUtf8V1(right);
  if (leftBytes.byteLength !== rightBytes.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.byteLength; index += 1) {
    difference |= leftBytes[index]! ^ rightBytes[index]!;
  }
  return difference === 0;
}

function bytesEqualV1(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

function deepFreezeTreeV1<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const seen = new CapturedWeakSetV1<object>();
  function freezeNodeV1(current: object): void {
    if (weakSetHasV1(seen, current)) return;
    weakSetAddV1(seen, current);
    const keys = CapturedReflectOwnKeysV1(current);
    for (let index = 0; index < keys.length; index += 1) {
      const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(
        current,
        keys[index]!,
      );
      if (descriptor !== undefined && "value" in descriptor) {
        const child = descriptor.value;
        if (child !== null && typeof child === "object") freezeNodeV1(child);
      }
    }
    CapturedObjectFreezeV1(current);
  }
  freezeNodeV1(value);
  return value;
}

function hasExactEnumerableOwnDataKeysV1(
  value: unknown,
  expectedKeys: readonly string[],
): value is Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    CapturedArrayIsArrayV1(value)
  ) return false;
  const prototype = CapturedObjectGetPrototypeOfV1(value);
  if (prototype !== CapturedObjectPrototypeV1 && prototype !== null) {
    return false;
  }
  if (CapturedReflectOwnKeysV1(value).length !== expectedKeys.length) {
    return false;
  }
  for (let index = 0; index < expectedKeys.length; index += 1) {
    const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(
      value,
      expectedKeys[index]!,
    );
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) return false;
  }
  return true;
}

function acceptanceBoundaryUnsignedV1(
  value: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceBoundaryLikeInternalV1,
): object {
  const { boundaryContentDigest: _boundaryContentDigest, ...unsigned } = value;
  return unsigned;
}

export function deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceBoundaryContentDigestInternalV1(
  input: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceBoundaryLikeInternalV1,
): ContentDigestV1 {
  return digestV1(ACCEPTANCE_BOUNDARY_DOMAIN_V1, acceptanceBoundaryUnsignedV1(input));
}

function initialHighWaterV1(
  acceptance: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceBoundaryLikeInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressHighWaterInternalV1 {
  const unsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_execution_progress_high_water_v1" as const,
    progressRevision: 0,
    phase: "accepted" as const,
    progressRecordCount: 0,
    receiptCount: 0,
    destinationObjectPublicationCount: 0,
    sourceObjectCount: acceptance.sourceObjectCount,
    copiedObjectCount: 0,
    remainingSourceObjectCount: acceptance.sourceObjectCount,
    sourceLogicalBytes: acceptance.sourceLogicalBytes,
    copiedLogicalBytes: 0,
    lastProgressContentDigest: "none" as const,
  };
  return deepFreezeTreeV1({
    ...unsigned,
    contentDigest: digestV1(HIGH_WATER_DOMAIN_V1, unsigned),
  });
}

function rejectedV1(
  reason: Extract<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressAdvanceResultInternalV1,
    { readonly status: "rejected" }
  >["reason"],
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressAdvanceResultInternalV1 {
  return CapturedObjectFreezeV1({ status: "rejected", reason });
}

function appendFrozenV1<T>(values: readonly T[], value: T): readonly T[] {
  const output: T[] = [];
  for (let index = 0; index < values.length; index += 1) {
    output[index] = values[index]!;
  }
  output[values.length] = value;
  return CapturedObjectFreezeV1(output);
}

interface TransitionProjectionInternalV1 {
  readonly nextPhase: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionPhaseInternalV1;
  readonly sourceObjectOrdinal: number | "none";
  readonly sourceObjectLogicalBytes: number | "none";
  readonly copiedObjectCount: number;
  readonly copiedLogicalBytes: number;
}

function destinationProviderBindingV1(
  state: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressStateInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceCandidateV1 | undefined {
  const destinationEndpoint =
    state.formalPlanEnvelope.payload.formalDestinationTrust
      .destinationEndpointTrust;
  if (destinationEndpoint.role !== "destination_prospective_not_selected") {
    return undefined;
  }
  const projection = destinationEndpoint.prospectiveWriterProjection;
  const bindingFields = {
    targetProfileId: projection.targetProfileId,
    providerId: projection.providerId,
    registryEntryContentDigest: projection.registryEntryContentDigest,
    semanticProviderPolicyDigest: projection.semanticProviderPolicyDigest,
    providerFeasibilityEvidence: projection.providerFeasibilityEvidence,
    runtimeAttestationContentDigest:
      projection.runtimeAttestationContentDigest,
    bindingDerivationKeyGeneration:
      projection.bindingDerivationKeyGeneration,
  };
  return deepFreezeTreeV1({
    ...bindingFields,
    bindingReferenceDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceDigestReferenceCandidateV1(
        bindingFields,
      ),
  });
}

function destinationPublicationsExactCoverV1(
  state: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressStateInternalV1,
): boolean {
  const publications = state.destinationObjectPublications;
  const sourceObjects =
    state.formalPlanEnvelope.payload.completeSourceReadClosure.objects;
  if (
    publications.length !== state.highWater.copiedObjectCount ||
    publications.length > sourceObjects.length
  ) return false;
  const destinationBinding = destinationProviderBindingV1(state);
  if (destinationBinding === undefined) return false;
  for (let index = 0; index < publications.length; index += 1) {
    const publication = publications[index]!;
    const source = sourceObjects[index]!;
    if (
      publication.publicationMode !== DESTINATION_PUBLICATION_MODE_V1 ||
      publication.resolution !== "committed" ||
      publication.publicationOrdinal !== index ||
      publication.sourceObjectOrdinal !== index ||
      source.objectOrdinal !== index ||
      publication.sourceContentDigest !== source.contentDigest ||
      publication.sourceSemanticLocatorDigest !==
        source.semanticLocatorDigest ||
      publication.sourceLogicalLocatorReferenceDigest !==
        source.logicalLocatorReferenceDigest ||
      publication.sourceProviderBindingReferenceDigest !==
        source.providerBindingReferenceDigest ||
      publication.sourceLogicalBytes !== source.logicalBytes ||
      publication.destinationProviderId !== destinationBinding.providerId ||
      !canonicalEqualV1(
        publication.destinationProviderBinding,
        destinationBinding,
      ) ||
      !canonicalEqualV1(publication.formalPlanPin, state.formalPlanPin)
    ) return false;
  }
  return true;
}

function projectTransitionV1(
  state: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressStateInternalV1,
  request: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressAdvanceRequestInternalV1,
): TransitionProjectionInternalV1 | undefined {
  const highWater = state.highWater;
  if (
    highWater.phase === "accepted" &&
    request.transition === "start_execution" &&
    request.sourceObjectOrdinal === "none"
  ) {
    return {
      nextPhase: "running",
      sourceObjectOrdinal: "none",
      sourceObjectLogicalBytes: "none",
      copiedObjectCount: 0,
      copiedLogicalBytes: 0,
    };
  }
  if (
    highWater.phase === "running" &&
    request.transition === "commit_source_object" &&
    typeof request.sourceObjectOrdinal === "number" &&
    request.sourceObjectOrdinal === highWater.copiedObjectCount &&
    request.sourceObjectOrdinal < highWater.sourceObjectCount &&
    state.destinationObjectPublications.length === highWater.copiedObjectCount
  ) {
    const sourceObject =
      state.formalPlanEnvelope.payload.completeSourceReadClosure.objects[
        request.sourceObjectOrdinal
      ];
    if (
      sourceObject === undefined ||
      sourceObject.objectOrdinal !== request.sourceObjectOrdinal
    ) return undefined;
    const copiedLogicalBytes =
      highWater.copiedLogicalBytes + sourceObject.logicalBytes;
    if (
      !CapturedNumberIsSafeIntegerV1(copiedLogicalBytes) ||
      copiedLogicalBytes > highWater.sourceLogicalBytes
    ) return undefined;
    return {
      nextPhase: "running",
      sourceObjectOrdinal: request.sourceObjectOrdinal,
      sourceObjectLogicalBytes: sourceObject.logicalBytes,
      copiedObjectCount: highWater.copiedObjectCount + 1,
      copiedLogicalBytes,
    };
  }
  if (
    highWater.phase === "running" &&
    request.transition === "mark_source_drained" &&
    request.sourceObjectOrdinal === "none" &&
    highWater.copiedObjectCount === highWater.sourceObjectCount &&
    highWater.copiedLogicalBytes === highWater.sourceLogicalBytes &&
    state.destinationObjectPublications.length === highWater.sourceObjectCount &&
    destinationPublicationsExactCoverV1(state)
  ) {
    return {
      nextPhase: "source_drained",
      sourceObjectOrdinal: "none",
      sourceObjectLogicalBytes: "none",
      copiedObjectCount: highWater.copiedObjectCount,
      copiedLogicalBytes: highWater.copiedLogicalBytes,
    };
  }
  if (
    highWater.phase === "source_drained" &&
    request.transition === "complete_execution" &&
    request.sourceObjectOrdinal === "none" &&
    state.destinationObjectPublications.length === highWater.sourceObjectCount &&
    destinationPublicationsExactCoverV1(state)
  ) {
    return {
      nextPhase: "completed",
      sourceObjectOrdinal: "none",
      sourceObjectLogicalBytes: "none",
      copiedObjectCount: highWater.copiedObjectCount,
      copiedLogicalBytes: highWater.copiedLogicalBytes,
    };
  }
  return undefined;
}

function validateAcceptanceBasisV1(
  formalPlanEnvelope: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1,
  formalPlanPin: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1,
  publicationReceipt: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCommittedReceiptInternalV1,
  acceptance: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceBoundaryLikeInternalV1,
): boolean {
  if (
    !hasExactEnumerableOwnDataKeysV1(acceptance, ACCEPTANCE_KEYS_V1) ||
    !CapturedObjectIsFrozenV1(acceptance) ||
    acceptance.profile !==
      "provider_migration_same_installation_identity_current_strong_source_normal_migration_only_acceptance_boundary_like_v1" ||
    acceptance.acceptanceKind !== "migration_only" ||
    !ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceEnvelopeInternalV1Schema.safeParse(
      acceptance.migrationOnlyAcceptanceEnvelope,
    ).success ||
    !canonicalEqualV1(
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1(
        acceptance.migrationOnlyAcceptanceEnvelope,
      ),
      acceptance.migrationOnlyAcceptancePin,
    ) ||
    acceptance.acceptanceGenerationId !==
      acceptance.migrationOnlyAcceptanceEnvelope.generationId ||
    acceptance.acceptanceContentDigest !==
      acceptance.migrationOnlyAcceptanceEnvelope.contentDigest ||
    acceptance.relationship !==
      "migration_only_acceptance_committed_source_current_until_execution_completed_v1" ||
    !CapturedNumberIsSafeIntegerV1(acceptance.sourceObjectCount) ||
    acceptance.sourceObjectCount < 1 ||
    !CapturedNumberIsSafeIntegerV1(acceptance.sourceLogicalBytes) ||
    acceptance.sourceLogicalBytes < 0 ||
    !ProviderAcceptanceStateGenerationIdV1Schema.safeParse(
      acceptance.acceptanceGenerationId,
    ).success ||
    !ContentDigestV1Schema.safeParse(acceptance.acceptanceContentDigest).success ||
    acceptance.formalMigrationId !== formalPlanEnvelope.payload.migrationId ||
    acceptance.installationIdentityGenerationId !==
      formalPlanEnvelope.payload.journalAuthorityInstallationIdentityGenerationId ||
    acceptance.sourceObjectCount !==
      formalPlanEnvelope.payload.completeSourceReadClosure.objectCount ||
    acceptance.sourceLogicalBytes !==
      formalPlanEnvelope.payload.completeSourceReadClosure.logicalObjectBytesTotal ||
    !canonicalEqualV1(acceptance.formalPlanPin, formalPlanPin) ||
    !canonicalEqualV1(
      acceptance.publishedRegistryManifestPin,
      publicationReceipt.publishedRegistryManifestPin,
    ) ||
    !canonicalEqualV1(
      acceptance.publishedSupportCatalogPin,
      publicationReceipt.publishedSupportCatalogPin,
    ) ||
    acceptance.boundaryContentDigest !==
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceBoundaryContentDigestInternalV1(
        acceptance,
      )
  ) return false;
  return true;
}

function mintFromValidatedBasisV1(
  input: MintFromValidatedBasisInputInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineCapabilityInternalV1 {
  if (!hasExactEnumerableOwnDataKeysV1(
    input,
    MINT_FROM_VALIDATED_BASIS_KEYS_V1,
  )) {
    throw new CapturedTypeErrorV1("execution progress mint input invalid");
  }
  let publicationState;
  try {
    publicationState =
      inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
        input.compoundPublicationReferenceMachineCapability,
      );
  } catch {
    throw new CapturedTypeErrorV1("committed publication capability invalid");
  }
  const currentRouting =
    publicationState.currentRegistryManifestEnvelope.payload.routing;
  if (
    publicationState.revision < 2 ||
    publicationState.migrationPublicationState.state !== "committed" ||
    publicationState.migrationPublicationState.immutableReceipt !==
      input.committedPublicationReceipt ||
    publicationState.migrationPublicationState.formalPlanEnvelope !==
      input.formalPlanEnvelope ||
    publicationState.currentRegistryManifestEnvelope !==
      input.currentRegistryManifestEnvelope ||
    !canonicalEqualV1(
      publicationState.currentRegistryManifestPin,
      input.currentRegistryManifestPin,
    ) ||
    currentRouting.state !== "migration" ||
    currentRouting.phase !== "rebinding" ||
    currentRouting.activeForMigrationWrites !==
      currentRouting.destinationProviderId ||
    currentRouting.migrationId !== input.formalPlanEnvelope.payload.migrationId ||
    !canonicalEqualV1(
      publicationState.migrationPublicationState.formalPlanPin,
      input.formalPlanPin,
    ) ||
    !ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1Schema.safeParse(
      input.formalPlanEnvelope,
    ).success ||
    !canonicalEqualV1(
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinV1(
        input.formalPlanEnvelope,
      ),
      input.formalPlanPin,
    ) ||
    !validateAcceptanceBasisV1(
      input.formalPlanEnvelope,
      input.formalPlanPin,
      input.committedPublicationReceipt,
      input.migrationOnlyAcceptance,
    )
  ) throw new CapturedTypeErrorV1("execution progress basis invalid");

  const initialState = deepFreezeTreeV1({
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_execution_progress_state_v1" as const,
    durability: MACHINE_DURABILITY_V1,
    formalPlanEnvelope: input.formalPlanEnvelope,
    formalPlanPin: input.formalPlanPin,
    committedPublicationReceipt: input.committedPublicationReceipt,
    currentRegistryManifestEnvelope: input.currentRegistryManifestEnvelope,
    currentRegistryManifestPin: input.currentRegistryManifestPin,
    migrationOnlyAcceptance: input.migrationOnlyAcceptance,
    destinationPublicationMode: DESTINATION_PUBLICATION_MODE_V1,
    highWater: initialHighWaterV1(input.migrationOnlyAcceptance),
    progressRecords: CapturedObjectFreezeV1([]),
    receipts: CapturedObjectFreezeV1([]),
    destinationObjectPublications: CapturedObjectFreezeV1([]),
  });
  const capability = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineCapabilityInternalV1;
  weakMapSetV1(bindingsInternalV1, capability, {
    snapshot: CapturedObjectFreezeV1({
      publicState: initialState,
      replayEntries: CapturedObjectFreezeV1([]),
    }),
    compoundPublicationReferenceMachineCapability:
      input.compoundPublicationReferenceMachineCapability,
    migrationOnlyAcceptanceReferenceMachineCapability:
      input.migrationOnlyAcceptanceReferenceMachineCapability,
    acceptanceIdentityVerificationCapability:
      input.acceptanceIdentityVerificationCapability,
  });
  return capability;
}

function acceptanceBoundaryFromExactD45SuccessV1(
  success: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceValidationInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceBoundaryLikeInternalV1 {
  const d44 = success.formalPlanPublicationClosure;
  const envelope = success.migrationOnlyAcceptanceEnvelope;
  const pin = success.migrationOnlyAcceptancePin;
  const configuration = success.configuration;
  const appendOutcome = success.acceptanceCompareAppendReceipt.outcome;
  const generations = success.acceptanceReferenceState.migrationOnlyGenerations;
  if (
    success.authority !==
      "in_memory_reference_machine_only_no_production_provider_authority_v1" ||
    success.durability !==
      "in_memory_reference_only_not_a_durable_provider_v1" ||
    success.profile !==
      "provider_migration_same_installation_identity_current_strong_source_normal_migration_only_acceptance_reference_validation_v1" ||
    success.relationship !==
      "committed_d44_publication_strict_migration_only_acceptance_compare_appended_v1" ||
    !CapturedObjectIsFrozenV1(success) ||
    !ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceEnvelopeInternalV1Schema.safeParse(
      envelope,
    ).success ||
    !canonicalEqualV1(
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1(
        envelope,
      ),
      pin,
    ) ||
    !canonicalEqualV1(configuration, envelope.payload.configuration) ||
    configuration.state !== "migration_only" ||
    configuration.publicStrongWriter.state !== "disabled" ||
    configuration.executor.state !== "enabled_for_plan_only" ||
    !canonicalEqualV1(configuration.formalPlanPin, d44.formalPlanPin) ||
    configuration.executor.formalMigrationId !==
      d44.formalPlanEnvelope.payload.migrationId ||
    !canonicalEqualV1(
      configuration.publishedTrustPins.registryManifest,
      d44.currentRegistryManifestPin,
    ) ||
    !canonicalEqualV1(
      configuration.publishedTrustPins.supportCatalog,
      d44.currentSupportCatalogPin,
    ) ||
    !canonicalEqualV1(
      success.acceptedRegistryManifestPin,
      d44.currentRegistryManifestPin,
    ) ||
    !canonicalEqualV1(
      success.acceptedSupportCatalogPin,
      d44.currentSupportCatalogPin,
    ) ||
    success.acceptanceOrdinal !== envelope.payload.acceptanceOrdinal ||
    pin.acceptanceOrdinal !== success.acceptanceOrdinal ||
    envelope.installationIdentityGenerationId !==
      d44.formalPlanEnvelope.payload
        .journalAuthorityInstallationIdentityGenerationId ||
    success.sourceObjectCount !==
      d44.formalPlanEnvelope.payload.completeSourceReadClosure.objectCount ||
    success.sourceLogicalBytes !==
      d44.formalPlanEnvelope.payload.completeSourceReadClosure
        .logicalObjectBytesTotal ||
    appendOutcome.state !== "committed" ||
    !canonicalEqualV1(appendOutcome.appendedAcceptance, pin) ||
    !canonicalEqualV1(success.acceptanceReferenceState.currentAcceptance, pin) ||
    generations.length < 1 ||
    !canonicalEqualV1(generations[generations.length - 1], envelope)
  ) throw new CapturedTypeErrorV1("strict D45 Acceptance basis invalid");

  const unsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_migration_only_acceptance_boundary_like_v1" as const,
    acceptanceKind: "migration_only" as const,
    migrationOnlyAcceptanceEnvelope: envelope,
    migrationOnlyAcceptancePin: pin,
    installationIdentityGenerationId:
      envelope.installationIdentityGenerationId,
    formalMigrationId: d44.formalPlanEnvelope.payload.migrationId,
    formalPlanPin: d44.formalPlanPin,
    publishedRegistryManifestPin: d44.currentRegistryManifestPin,
    publishedSupportCatalogPin: d44.currentSupportCatalogPin,
    acceptanceGenerationId: envelope.generationId,
    acceptanceContentDigest: envelope.contentDigest,
    sourceObjectCount: success.sourceObjectCount,
    sourceLogicalBytes: success.sourceLogicalBytes,
    relationship:
      "migration_only_acceptance_committed_source_current_until_execution_completed_v1" as const,
  };
  return deepFreezeTreeV1({
    ...unsigned,
    boundaryContentDigest: digestV1(ACCEPTANCE_BOUNDARY_DOMAIN_V1, unsigned),
  });
}

export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1(
  input: MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInputInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineCapabilityInternalV1 {
  if (!hasExactEnumerableOwnDataKeysV1(input, MINT_INPUT_KEYS_V1)) {
    throw new CapturedTypeErrorV1("execution progress mint input invalid");
  }
  const continuation =
    takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistryExecutionContinuationInternalV1(
      input.rebindingRegistrySuccessor,
    );
  if (
    continuation === undefined ||
    continuation.rebindingRegistrySuccessor !==
      input.rebindingRegistrySuccessor ||
    input.rebindingRegistrySuccessor.migrationOnlyAcceptanceClosure !==
      continuation.migrationOnlyAcceptance ||
    !canonicalEqualV1(
      input.rebindingRegistrySuccessor.currentRegistryManifestEnvelope,
      input.rebindingRegistrySuccessor.rebindingRegistryManifestEnvelope,
    ) ||
    !canonicalEqualV1(
      input.rebindingRegistrySuccessor.currentRegistryManifestPin,
      input.rebindingRegistrySuccessor.rebindingRegistryManifestPin,
    )
  ) throw new CapturedTypeErrorV1(
    "rebinding Registry execution continuation invalid",
  );
  const d45 = continuation.migrationOnlyAcceptance;
  const d44 = d45.formalPlanPublicationClosure;
  return mintFromValidatedBasisV1({
    formalPlanEnvelope: d44.formalPlanEnvelope,
    formalPlanPin: d44.formalPlanPin,
    compoundPublicationReferenceMachineCapability:
      continuation.compoundPublicationReferenceMachineCapability,
    migrationOnlyAcceptanceReferenceMachineCapability:
      continuation.migrationOnlyAcceptanceReferenceMachineCapability,
    acceptanceIdentityVerificationCapability:
      continuation.acceptanceIdentityVerificationCapability,
    committedPublicationReceipt: d44.committedReceipt,
    currentRegistryManifestEnvelope:
      input.rebindingRegistrySuccessor.currentRegistryManifestEnvelope,
    currentRegistryManifestPin:
      input.rebindingRegistrySuccessor.currentRegistryManifestPin,
    migrationOnlyAcceptance: acceptanceBoundaryFromExactD45SuccessV1(
      d45,
    ),
  });
}

function getBindingV1(capability: unknown): BindingInternalV1 | undefined {
  if (capability === null || typeof capability !== "object") return undefined;
  return weakMapGetV1(bindingsInternalV1, capability);
}

function createDestinationObjectPublicationV1(
  state: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressStateInternalV1,
  request: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressAdvanceRequestInternalV1,
  requestContentDigest: ContentDigestV1,
  projection: TransitionProjectionInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationObjectPublicationMetadataReceiptInternalV1 | "none" {
  if (projection.sourceObjectOrdinal === "none") return "none";
  const sourceObject =
    state.formalPlanEnvelope.payload.completeSourceReadClosure.objects[
      projection.sourceObjectOrdinal
    ];
  const destinationProviderBinding = destinationProviderBindingV1(state);
  if (
    sourceObject === undefined ||
    sourceObject.objectOrdinal !== projection.sourceObjectOrdinal ||
    destinationProviderBinding === undefined ||
    state.destinationObjectPublications.length !==
      projection.sourceObjectOrdinal
  ) throw new CapturedTypeErrorV1(
    "destination object publication metadata basis invalid",
  );
  const unsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_destination_object_publication_metadata_receipt_v1" as const,
    durability: MACHINE_DURABILITY_V1,
    publicationMode: DESTINATION_PUBLICATION_MODE_V1,
    resolution: "committed" as const,
    operationNonce: request.operationNonce,
    requestContentDigest,
    publicationOrdinal: projection.sourceObjectOrdinal,
    sourceObjectOrdinal: projection.sourceObjectOrdinal,
    sourceContentDigest: sourceObject.contentDigest,
    sourceSemanticLocatorDigest: sourceObject.semanticLocatorDigest,
    sourceLogicalLocatorReferenceDigest:
      sourceObject.logicalLocatorReferenceDigest,
    sourceProviderBindingReferenceDigest:
      sourceObject.providerBindingReferenceDigest,
    sourceLogicalBytes: sourceObject.logicalBytes,
    destinationProviderId: destinationProviderBinding.providerId,
    destinationProviderBinding,
    formalMigrationId: state.formalPlanEnvelope.payload.migrationId,
    formalPlanPin: state.formalPlanPin,
    relationship:
      "metadata_only_destination_publication_committed_from_exact_formal_plan_source_object_v1" as const,
  };
  return deepFreezeTreeV1({
    ...unsigned,
    receiptContentDigest: digestV1(
      DESTINATION_OBJECT_PUBLICATION_DOMAIN_V1,
      unsigned,
    ),
  });
}

function createProspectiveSnapshotV1(
  before: SnapshotInternalV1,
  request: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressAdvanceRequestInternalV1,
  requestCanonicalBytes: Uint8Array,
  projection: TransitionProjectionInternalV1,
): SnapshotInternalV1 {
  const state = before.publicState;
  const revision = state.highWater.progressRevision + 1;
  const requestContentDigest = digestV1(REQUEST_DOMAIN_V1, request);
  const destinationObjectPublication = createDestinationObjectPublicationV1(
    state,
    request,
    requestContentDigest,
    projection,
  );
  const progressUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_execution_progress_record_v1" as const,
    progressRevision: revision,
    operationNonce: request.operationNonce,
    transition: request.transition,
    previousPhase: state.highWater.phase,
    phase: projection.nextPhase,
    sourceObjectOrdinal: projection.sourceObjectOrdinal,
    sourceObjectLogicalBytes: projection.sourceObjectLogicalBytes,
    destinationObjectPublicationReceiptContentDigest:
      destinationObjectPublication === "none"
        ? "none" as const
        : destinationObjectPublication.receiptContentDigest,
    formalMigrationId: state.formalPlanEnvelope.payload.migrationId,
    formalPlanPin: state.formalPlanPin,
    migrationOnlyAcceptanceBoundaryContentDigest:
      state.migrationOnlyAcceptance.boundaryContentDigest,
    sourceObjectCount: state.highWater.sourceObjectCount,
    copiedObjectCount: projection.copiedObjectCount,
    remainingSourceObjectCount:
      state.highWater.sourceObjectCount - projection.copiedObjectCount,
    sourceLogicalBytes: state.highWater.sourceLogicalBytes,
    copiedLogicalBytes: projection.copiedLogicalBytes,
  };
  const progressRecord = deepFreezeTreeV1({
    ...progressUnsigned,
    contentDigest: digestV1(PROGRESS_DOMAIN_V1, progressUnsigned),
  });
  const highWaterUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_execution_progress_high_water_v1" as const,
    progressRevision: revision,
    phase: projection.nextPhase,
    progressRecordCount: state.progressRecords.length + 1,
    receiptCount: state.receipts.length + 1,
    destinationObjectPublicationCount:
      state.destinationObjectPublications.length +
      (destinationObjectPublication === "none" ? 0 : 1),
    sourceObjectCount: state.highWater.sourceObjectCount,
    copiedObjectCount: projection.copiedObjectCount,
    remainingSourceObjectCount:
      state.highWater.sourceObjectCount - projection.copiedObjectCount,
    sourceLogicalBytes: state.highWater.sourceLogicalBytes,
    copiedLogicalBytes: projection.copiedLogicalBytes,
    lastProgressContentDigest: progressRecord.contentDigest,
  };
  const highWater = deepFreezeTreeV1({
    ...highWaterUnsigned,
    contentDigest: digestV1(HIGH_WATER_DOMAIN_V1, highWaterUnsigned),
  });
  const receiptUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_execution_progress_receipt_v1" as const,
    durability: MACHINE_DURABILITY_V1,
    resolution: "committed" as const,
    operationNonce: request.operationNonce,
    requestContentDigest,
    linearizationOrdinal: state.receipts.length + 1,
    progressRecord,
    destinationObjectPublication,
    committedHighWater: highWater,
  };
  const committedReceipt = deepFreezeTreeV1({
    ...receiptUnsigned,
    receiptContentDigest: digestV1(RECEIPT_DOMAIN_V1, receiptUnsigned),
  });
  const publicState = deepFreezeTreeV1({
    ...state,
    highWater,
    progressRecords: appendFrozenV1(state.progressRecords, progressRecord),
    receipts: appendFrozenV1(state.receipts, committedReceipt),
    destinationObjectPublications:
      destinationObjectPublication === "none"
        ? state.destinationObjectPublications
        : appendFrozenV1(
            state.destinationObjectPublications,
            destinationObjectPublication,
          ),
  });
  return CapturedObjectFreezeV1({
    publicState,
    replayEntries: appendFrozenV1(before.replayEntries, CapturedObjectFreezeV1({
      operationNonce: request.operationNonce,
      requestCanonicalBytes,
      receipt: committedReceipt,
    })),
  });
}

export function compareAdvanceProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1(
  capability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineCapabilityInternalV1,
  request: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressAdvanceRequestInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressAdvanceResultInternalV1 {
  const binding = getBindingV1(capability);
  if (binding === undefined) return rejectedV1("capability_invalid");
  if (
    !hasExactEnumerableOwnDataKeysV1(request, REQUEST_KEYS_V1) ||
    !LowerHex32V1Schema.safeParse(request.operationNonce).success ||
    !CapturedNumberIsSafeIntegerV1(request.expectedProgressRevision) ||
    request.expectedProgressRevision < 0 ||
    (request.sourceObjectOrdinal !== "none" &&
      (!CapturedNumberIsSafeIntegerV1(request.sourceObjectOrdinal) ||
        request.sourceObjectOrdinal < 0))
  ) return rejectedV1("schema_invalid");
  let requestCanonicalBytes: Uint8Array;
  try {
    requestCanonicalBytes = canonicalizeJcsSafeIntegerUtf8V1(request);
  } catch {
    return rejectedV1("schema_invalid");
  }
  const before = binding.snapshot;
  for (let index = 0; index < before.replayEntries.length; index += 1) {
    const entry = before.replayEntries[index]!;
    if (entry.operationNonce !== request.operationNonce) continue;
    if (!bytesEqualV1(entry.requestCanonicalBytes, requestCanonicalBytes)) {
      return rejectedV1("operation_nonce_conflict");
    }
    return CapturedObjectFreezeV1({
      status: "committed",
      replay: true,
      receipt: entry.receipt,
    });
  }
  const highWater = before.publicState.highWater;
  if (
    request.expectedProgressRevision !== highWater.progressRevision ||
    request.expectedPhase !== highWater.phase
  ) {
    return CapturedObjectFreezeV1({
      status: "not_committed",
      reason: "stale_expected_progress",
      observedHighWater: highWater,
    });
  }
  const projection = projectTransitionV1(before.publicState, request);
  if (projection === undefined) return rejectedV1("transition_invalid");
  const prospective = createProspectiveSnapshotV1(
    before,
    request,
    requestCanonicalBytes,
    projection,
  );
  binding.snapshot = prospective;
  if (prospective.publicState.highWater.phase === "completed") {
    weakMapSetV1(
      completedContinuationsInternalV1,
      capability,
      prospective.publicState,
    );
  }
  return CapturedObjectFreezeV1({
    status: "committed",
    replay: false,
    receipt: prospective.replayEntries[
      prospective.replayEntries.length - 1
    ]!.receipt,
  });
}

export function takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompletedExecutionContinuationInternalV1(
  capability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineCapabilityInternalV1,
  exactCompletedExecutionState: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressStateInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompletedExecutionContinuationInternalV1 | undefined {
  const binding = getBindingV1(capability);
  if (binding === undefined) return undefined;
  const available = weakMapGetV1(
    completedContinuationsInternalV1,
    capability,
  );
  if (
    available === undefined ||
    available !== exactCompletedExecutionState ||
    binding.snapshot.publicState !== exactCompletedExecutionState ||
    available.highWater.phase !== "completed" ||
    available.destinationObjectPublications.length !==
      available.highWater.sourceObjectCount ||
    !destinationPublicationsExactCoverV1(available)
  ) return undefined;
  const terminalProgressReceipt =
    available.receipts[available.receipts.length - 1];
  const destinationProviderBinding =
    available.destinationObjectPublications[0]?.destinationProviderBinding;
  if (
    terminalProgressReceipt === undefined ||
    terminalProgressReceipt.progressRecord.phase !== "completed" ||
    terminalProgressReceipt.progressRecord.transition !==
      "complete_execution" ||
    destinationProviderBinding === undefined ||
    !weakMapDeleteV1(completedContinuationsInternalV1, capability)
  ) return undefined;
  return CapturedObjectFreezeV1({
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_completed_execution_continuation_v1" as const,
    relationship:
      "exact_completed_execution_terminal_handoff_consumed_once_v1" as const,
    executionCompletedState: available,
    terminalProgressReceipt,
    formalPlanEnvelope: available.formalPlanEnvelope,
    formalPlanPin: available.formalPlanPin,
    migrationOnlyAcceptance: available.migrationOnlyAcceptance,
    installationIdentityGenerationId:
      available.migrationOnlyAcceptance.installationIdentityGenerationId,
    formalMigrationId: available.formalPlanEnvelope.payload.migrationId,
    compoundPublicationReferenceMachineCapability:
      binding.compoundPublicationReferenceMachineCapability,
    migrationOnlyAcceptanceReferenceMachineCapability:
      binding.migrationOnlyAcceptanceReferenceMachineCapability,
    acceptanceIdentityVerificationCapability:
      binding.acceptanceIdentityVerificationCapability,
    currentRegistryManifestEnvelope: available.currentRegistryManifestEnvelope,
    currentRegistryManifestPin: available.currentRegistryManifestPin,
    currentSupportCatalogPin:
      available.committedPublicationReceipt.publishedSupportCatalogPin,
    sourceReadClosure:
      available.formalPlanEnvelope.payload.completeSourceReadClosure,
    destinationProviderBinding,
    destinationObjectPublications: available.destinationObjectPublications,
  });
}

export function inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1(
  capability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineCapabilityInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressStateInternalV1 {
  const binding = getBindingV1(capability);
  if (binding === undefined) {
    throw new CapturedTypeErrorV1("execution progress capability invalid");
  }
  return binding.snapshot.publicState;
}

for (const exportedFunctionV1 of [
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceBoundaryContentDigestInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1,
  compareAdvanceProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1,
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompletedExecutionContinuationInternalV1,
  inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExecutionProgressReferenceMachineInternalV1,
]) CapturedObjectFreezeV1(exportedFunctionV1);
