/**
 * Package-private, process-local reference machine for the same-Identity
 * Registry + Catalog + formal Plan + quota-reservation compound publication.
 *
 * This is executable write state, but deliberately is not a durable-provider
 * implementation. A successful operation constructs a complete prospective
 * immutable snapshot and commits it with one synchronous pointer assignment.
 */

import {
  createDomainPreimageBytesV1,
} from "./domain-crypto.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  ContentDigestV1Schema,
  LowerHex32V1Schema,
  type ContentDigestV1,
  type InstallationIdentityGenerationIdV1,
} from "./primitives.js";
import {
  ProviderFeasibilitySupportCatalogEnvelopeV1Schema,
  deriveProviderFeasibilitySupportCatalogPinV1,
  type ProviderFeasibilitySupportCatalogEnvelopeV1,
  type ProviderFeasibilitySupportCatalogPinV1,
} from "./provider-feasibility-support-catalog-point.js";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationDescriptorReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1Schema,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationDescriptorReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-formal-plan-reference-candidate-wire.js";
import {
  ProviderRegistryManifestEnvelopeV1Schema,
  ProviderRegistryManifestPinV1Schema,
  deriveProviderRegistryManifestContentDigestV1,
  deriveProviderRegistryManifestGenerationIdV1,
  projectProviderRegistryManifestIdFieldsV1,
  type ProviderRegistryManifestEnvelopeV1,
  type ProviderRegistryManifestPinV1,
} from "./provider-registry-records.js";
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
  "in_memory_reference_only_not_a_durable_provider_v1" as const;
const REQUEST_DOMAIN_V1 =
  "provider-migration-same-installation-identity-compound-publication-request-v1";
const RESERVATION_DOMAIN_V1 =
  "provider-migration-same-installation-identity-compound-publication-reservation-v1";
const EVENT_DOMAIN_V1 =
  "provider-migration-same-installation-identity-compound-publication-reserved-event-v1";
const ACCOUNT_DOMAIN_V1 =
  "provider-migration-same-installation-identity-compound-publication-account-v1";
const HIGH_WATER_DOMAIN_V1 =
  "provider-migration-same-installation-identity-compound-publication-high-water-v1";
const RECEIPT_DOMAIN_V1 =
  "provider-migration-same-installation-identity-compound-publication-receipt-v1";
const REGISTRY_SUCCESSOR_REQUEST_DOMAIN_V1 =
  "provider-migration-same-installation-identity-compound-registry-successor-publication-request-v1";
const REGISTRY_SUCCESSOR_RECEIPT_DOMAIN_V1 =
  "provider-migration-same-installation-identity-compound-registry-successor-publication-receipt-v1";
const MINT_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "currentRegistryManifestEnvelope",
  "currentRegistryManifestPin",
  "currentSupportCatalogEnvelope",
  "currentSupportCatalogPin",
  "migrationPublicationState",
] as const);
const REQUEST_KEYS_V1 = CapturedObjectFreezeV1([
  "operationNonce",
  "expectedCurrentRegistryManifestPin",
  "expectedCurrentSupportCatalogPin",
  "preparedRegistryManifestEnvelope",
  "preparedRegistryManifestPin",
  "preparedSupportCatalogEnvelope",
  "preparedSupportCatalogPin",
  "formalPlanEnvelope",
  "formalPlanPin",
  "formalReservationDescriptor",
] as const);
const EMPTY_STATE_KEYS_V1 = CapturedObjectFreezeV1([
  "profile",
  "state",
  "revision",
] as const);
const REGISTRY_SUCCESSOR_REQUEST_KEYS_V1 = CapturedObjectFreezeV1([
  "operationNonce",
  "expectedCurrentRegistryManifestPin",
  "validatedSignedSuccessorEnvelope",
  "validatedSignedSuccessorPin",
] as const);

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationDescriptorLikeInternalV1 =
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationDescriptorReferenceCandidateV1;

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeLikeInternalV1 =
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1;

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinLikeInternalV1 =
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1;

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationEmptyStateInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_compound_publication_empty_state_v1";
  readonly state: "empty";
  readonly revision: 0;
}

export interface MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInputInternalV1 {
  readonly currentRegistryManifestEnvelope: ProviderRegistryManifestEnvelopeV1;
  readonly currentRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly currentSupportCatalogEnvelope: ProviderFeasibilitySupportCatalogEnvelopeV1;
  readonly currentSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1;
  readonly migrationPublicationState: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationEmptyStateInternalV1;
}

declare const compoundPublicationReferenceMachineCapabilityBrandInternalV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1 {
  readonly [compoundPublicationReferenceMachineCapabilityBrandInternalV1]: true;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCompareReservePublishRequestInternalV1 {
  readonly operationNonce: string;
  readonly expectedCurrentRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly expectedCurrentSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1;
  readonly preparedRegistryManifestEnvelope: ProviderRegistryManifestEnvelopeV1;
  readonly preparedRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly preparedSupportCatalogEnvelope: ProviderFeasibilitySupportCatalogEnvelopeV1;
  readonly preparedSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1;
  readonly formalPlanEnvelope: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeLikeInternalV1;
  readonly formalPlanPin: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinLikeInternalV1;
  readonly formalReservationDescriptor: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationDescriptorLikeInternalV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReservationRecordInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_compound_publication_reservation_record_v1";
  readonly reservationOrdinal: 1;
  readonly operationNonce: string;
  readonly descriptor: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationDescriptorLikeInternalV1;
  readonly formalPlanPin: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinLikeInternalV1;
  readonly state: "reserved";
  readonly contentDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReservedEventInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_compound_publication_reserved_event_v1";
  readonly eventOrdinal: 1;
  readonly operationNonce: string;
  readonly transition: "reserved";
  readonly reservationRecordContentDigest: ContentDigestV1;
  readonly formalPlanPin: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinLikeInternalV1;
  readonly contentDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReservedAccountInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_compound_publication_reserved_account_v1";
  readonly accountRevision: 1;
  readonly installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  readonly role: "same_identity_journal";
  readonly state: "reserved";
  readonly activeReservationCount: 1;
  readonly reservationRecordContentDigest: ContentDigestV1;
  readonly reservedEventContentDigest: ContentDigestV1;
  readonly contentDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationHighWaterInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_compound_publication_high_water_v1";
  readonly revision: 1;
  readonly operationNonce: string;
  readonly currentRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly currentSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1;
  readonly currentFormalPlanPin: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinLikeInternalV1;
  readonly reservationRecordContentDigest: ContentDigestV1;
  readonly reservedEventContentDigest: ContentDigestV1;
  readonly reservedAccountContentDigest: ContentDigestV1;
  readonly contentDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCommittedReceiptInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_compound_publication_committed_receipt_v1";
  readonly durability: typeof MACHINE_DURABILITY_V1;
  readonly status: "committed";
  readonly commitOrdinal: 1;
  readonly operationNonce: string;
  readonly requestContentDigest: ContentDigestV1;
  readonly publishedRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly publishedSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1;
  readonly publishedFormalPlanPin: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinLikeInternalV1;
  readonly reservationRecord: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReservationRecordInternalV1;
  readonly reservedEvent: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReservedEventInternalV1;
  readonly reservedAccount: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReservedAccountInternalV1;
  readonly highWater: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationHighWaterInternalV1;
  readonly receiptContentDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCommittedStateInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_compound_publication_state_v1";
  readonly durability: typeof MACHINE_DURABILITY_V1;
  readonly revision: number;
  readonly currentRegistryManifestEnvelope: ProviderRegistryManifestEnvelopeV1;
  readonly currentRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly currentSupportCatalogEnvelope: ProviderFeasibilitySupportCatalogEnvelopeV1;
  readonly currentSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1;
  readonly registrySuccessorPublicationReceipts:
    readonly ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundRegistrySuccessorPublicationReceiptInternalV1[];
  readonly migrationPublicationState: Readonly<{
    readonly state: "committed";
    readonly registryManifestPublication: "published_current";
    readonly catalogPublication: "published_current";
    readonly formalPlanPublication: "published";
    readonly formalPlanEnvelope: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeLikeInternalV1;
    readonly formalPlanPin: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinLikeInternalV1;
    readonly reservationRecord: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReservationRecordInternalV1;
    readonly reservedEvent: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReservedEventInternalV1;
    readonly reservedAccount: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReservedAccountInternalV1;
    readonly highWater: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationHighWaterInternalV1;
    readonly immutableReceipt: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCommittedReceiptInternalV1;
  }>;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationStateInternalV1 =
  | Readonly<{
      readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_compound_publication_state_v1";
      readonly durability: typeof MACHINE_DURABILITY_V1;
      readonly revision: 0;
      readonly currentRegistryManifestEnvelope: ProviderRegistryManifestEnvelopeV1;
      readonly currentRegistryManifestPin: ProviderRegistryManifestPinV1;
      readonly currentSupportCatalogEnvelope: ProviderFeasibilitySupportCatalogEnvelopeV1;
      readonly currentSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1;
      readonly registrySuccessorPublicationReceipts:
        readonly ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundRegistrySuccessorPublicationReceiptInternalV1[];
      readonly migrationPublicationState: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationEmptyStateInternalV1;
    }>
  | ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCommittedStateInternalV1;

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCompareReservePublishResultInternalV1 =
  | Readonly<{
      readonly status: "committed";
      readonly replay: boolean;
      readonly receipt: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCommittedReceiptInternalV1;
    }>
  | Readonly<{
      readonly status: "not_committed";
      readonly reason: "stale_expected_current_cut";
      readonly observedCurrentRegistryManifestPin: ProviderRegistryManifestPinV1;
      readonly observedCurrentSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1;
    }>
  | Readonly<{
      readonly status: "rejected";
      readonly reason:
        | "capability_invalid"
        | "schema_invalid"
        | "operation_nonce_conflict"
        | "publication_state_not_empty"
        | "successor_invalid"
        | "formal_plan_invalid";
    }>;

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundRegistrySuccessorPublicationRequestInternalV1 {
  readonly operationNonce: string;
  readonly expectedCurrentRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly validatedSignedSuccessorEnvelope: ProviderRegistryManifestEnvelopeV1;
  readonly validatedSignedSuccessorPin: ProviderRegistryManifestPinV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundRegistrySuccessorPublicationReceiptInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_compound_registry_successor_publication_receipt_v1";
  readonly durability: typeof MACHINE_DURABILITY_V1;
  readonly status: "committed";
  readonly operationNonce: string;
  readonly requestContentDigest: ContentDigestV1;
  readonly publicationOrdinal: number;
  readonly compoundRevision: number;
  readonly previousRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly publishedRegistryManifestEnvelope: ProviderRegistryManifestEnvelopeV1;
  readonly publishedRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly routingPhase: "rebinding" | "source_drained" | "steady";
  readonly activeForMigrationWrites: string;
  readonly receiptContentDigest: ContentDigestV1;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundRegistrySuccessorPublicationResultInternalV1 =
  | Readonly<{
      readonly status: "committed";
      readonly replay: boolean;
      readonly receipt: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundRegistrySuccessorPublicationReceiptInternalV1;
      readonly currentState: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCommittedStateInternalV1;
    }>
  | Readonly<{
      readonly status: "not_committed";
      readonly reason: "stale_expected_current_registry";
      readonly observedCurrentRegistryManifestPin: ProviderRegistryManifestPinV1;
    }>
  | Readonly<{
      readonly status: "rejected";
      readonly reason:
        | "capability_invalid"
        | "schema_invalid"
        | "operation_nonce_conflict"
        | "publication_state_not_committed"
        | "successor_invalid";
    }>;

interface RegistrySuccessorReplayEntryInternalV1 {
  readonly operationNonce: string;
  readonly requestCanonicalBytes: Uint8Array;
  readonly receipt: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundRegistrySuccessorPublicationReceiptInternalV1;
  readonly committedState: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCommittedStateInternalV1;
}

interface MachineSnapshotInternalV1 {
  readonly publicState: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationStateInternalV1;
  readonly committedOperationNonce?: string;
  readonly committedRequestCanonicalBytes?: Uint8Array;
  readonly committedReceipt?: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCommittedReceiptInternalV1;
  readonly registrySuccessorReplayEntries:
    readonly RegistrySuccessorReplayEntryInternalV1[];
}

interface MachineBindingInternalV1 {
  snapshot: MachineSnapshotInternalV1;
}

const machineBindingsInternalV1 = new CapturedWeakMapV1<
  object,
  MachineBindingInternalV1
>();

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
      const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(current, keys[index]!);
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

function deriveRegistryPinV1(
  envelope: ProviderRegistryManifestEnvelopeV1,
): ProviderRegistryManifestPinV1 {
  if (!ProviderRegistryManifestEnvelopeV1Schema.safeParse(envelope).success) {
    throw new CapturedTypeErrorV1("Registry Manifest Envelope invalid");
  }
  if (
    envelope.payload.generationId !== envelope.generationId ||
    envelope.generationId !==
      deriveProviderRegistryManifestGenerationIdV1(
        projectProviderRegistryManifestIdFieldsV1(envelope.payload),
      ) ||
    envelope.contentDigest !==
      deriveProviderRegistryManifestContentDigestV1(envelope.payload)
  ) throw new CapturedTypeErrorV1("Registry Manifest Envelope not self-bound");
  return deepFreezeTreeV1(
    ProviderRegistryManifestPinV1Schema.parse({
      locatorProfile: "installation_provider_registry_manifest_v1",
      manifestGeneration: envelope.payload.manifestGeneration,
      generationId: envelope.generationId,
      contentDigest: envelope.contentDigest,
    }),
  );
}

function isPlainFrozenObjectV1(value: unknown): value is object {
  if (
    value === null ||
    typeof value !== "object" ||
    CapturedArrayIsArrayV1(value) ||
    !CapturedObjectIsFrozenV1(value)
  ) return false;
  const prototype = CapturedObjectGetPrototypeOfV1(value);
  return prototype === CapturedObjectPrototypeV1 || prototype === null;
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

function rejectedV1(
  reason: Extract<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCompareReservePublishResultInternalV1,
    { readonly status: "rejected" }
  >["reason"],
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCompareReservePublishResultInternalV1 {
  return CapturedObjectFreezeV1({ status: "rejected", reason });
}

function getBindingV1(
  capability: unknown,
): MachineBindingInternalV1 | undefined {
  if (capability === null || typeof capability !== "object") return undefined;
  return weakMapGetV1(machineBindingsInternalV1, capability);
}

export function createProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationEmptyStateInternalV1(): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationEmptyStateInternalV1 {
  return CapturedObjectFreezeV1({
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_compound_publication_empty_state_v1",
    state: "empty",
    revision: 0,
  });
}

export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
  input: MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInputInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1 {
  if (
    !hasExactEnumerableOwnDataKeysV1(input, MINT_INPUT_KEYS_V1) ||
    !isPlainFrozenObjectV1(input.currentRegistryManifestEnvelope) ||
    !isPlainFrozenObjectV1(input.currentRegistryManifestPin) ||
    !isPlainFrozenObjectV1(input.currentSupportCatalogEnvelope) ||
    !isPlainFrozenObjectV1(input.currentSupportCatalogPin) ||
    !isPlainFrozenObjectV1(input.migrationPublicationState) ||
    !hasExactEnumerableOwnDataKeysV1(
      input.migrationPublicationState,
      EMPTY_STATE_KEYS_V1,
    ) ||
    input.migrationPublicationState.profile !==
      "provider_migration_same_installation_identity_current_strong_source_normal_compound_publication_empty_state_v1" ||
    input.migrationPublicationState.state !== "empty" ||
    input.migrationPublicationState.revision !== 0
  ) throw new CapturedTypeErrorV1("compound publication initial state invalid");
  const registryPin = deriveRegistryPinV1(input.currentRegistryManifestEnvelope);
  const catalogPin = deepFreezeTreeV1(
    deriveProviderFeasibilitySupportCatalogPinV1(
      input.currentSupportCatalogEnvelope,
    ),
  );
  if (
    !canonicalEqualV1(registryPin, input.currentRegistryManifestPin) ||
    !canonicalEqualV1(catalogPin, input.currentSupportCatalogPin) ||
    input.currentRegistryManifestEnvelope.payload.routing.state !== "steady" ||
    !canonicalEqualV1(
      input.currentRegistryManifestEnvelope.payload.activeRootMetadata,
      input.currentSupportCatalogEnvelope.payload.activeRootMetadata,
    )
  ) throw new CapturedTypeErrorV1("compound publication current cut invalid");
  const state = deepFreezeTreeV1({
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_compound_publication_state_v1" as const,
    durability: MACHINE_DURABILITY_V1,
    revision: 0 as const,
    currentRegistryManifestEnvelope: input.currentRegistryManifestEnvelope,
    currentRegistryManifestPin: input.currentRegistryManifestPin,
    currentSupportCatalogEnvelope: input.currentSupportCatalogEnvelope,
    currentSupportCatalogPin: input.currentSupportCatalogPin,
    registrySuccessorPublicationReceipts: CapturedObjectFreezeV1([]),
    migrationPublicationState: input.migrationPublicationState,
  });
  const capability = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1;
  weakMapSetV1(machineBindingsInternalV1, capability, {
    snapshot: CapturedObjectFreezeV1({
      publicState: state,
      registrySuccessorReplayEntries: CapturedObjectFreezeV1([]),
    }),
  });
  return capability;
}

function requestIsStructurallyValidV1(
  request: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCompareReservePublishRequestInternalV1,
): boolean {
  return hasExactEnumerableOwnDataKeysV1(request, REQUEST_KEYS_V1) &&
    LowerHex32V1Schema.safeParse(request.operationNonce).success &&
    isPlainFrozenObjectV1(request.expectedCurrentRegistryManifestPin) &&
    isPlainFrozenObjectV1(request.expectedCurrentSupportCatalogPin) &&
    isPlainFrozenObjectV1(request.preparedRegistryManifestEnvelope) &&
    isPlainFrozenObjectV1(request.preparedRegistryManifestPin) &&
    isPlainFrozenObjectV1(request.preparedSupportCatalogEnvelope) &&
    isPlainFrozenObjectV1(request.preparedSupportCatalogPin) &&
    isPlainFrozenObjectV1(request.formalPlanEnvelope) &&
    isPlainFrozenObjectV1(request.formalPlanPin) &&
    isPlainFrozenObjectV1(request.formalReservationDescriptor);
}

function requestSuccessorAndPlanAreBoundV1(
  currentState: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationStateInternalV1,
  request: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCompareReservePublishRequestInternalV1,
): "ok" | "successor_invalid" | "formal_plan_invalid" {
  let preparedRegistryPin: ProviderRegistryManifestPinV1;
  let preparedCatalogPin: ProviderFeasibilitySupportCatalogPinV1;
  try {
    preparedRegistryPin = deriveRegistryPinV1(
      request.preparedRegistryManifestEnvelope,
    );
    if (
      !ProviderFeasibilitySupportCatalogEnvelopeV1Schema.safeParse(
        request.preparedSupportCatalogEnvelope,
      ).success
    ) return "successor_invalid";
    preparedCatalogPin = deepFreezeTreeV1(
      deriveProviderFeasibilitySupportCatalogPinV1(
        request.preparedSupportCatalogEnvelope,
      ),
    );
  } catch {
    return "successor_invalid";
  }
  const currentRegistry = currentState.currentRegistryManifestEnvelope;
  const preparedRegistry = request.preparedRegistryManifestEnvelope;
  const currentCatalog = currentState.currentSupportCatalogEnvelope;
  const preparedCatalog = request.preparedSupportCatalogEnvelope;
  if (
    !canonicalEqualV1(preparedRegistryPin, request.preparedRegistryManifestPin) ||
    !canonicalEqualV1(preparedCatalogPin, request.preparedSupportCatalogPin) ||
    !CapturedNumberIsSafeIntegerV1(currentRegistry.payload.manifestGeneration) ||
    currentRegistry.payload.manifestGeneration >= Number.MAX_SAFE_INTEGER ||
    preparedRegistry.payload.manifestGeneration !==
      currentRegistry.payload.manifestGeneration + 1 ||
    preparedRegistry.payload.predecessor.state !== "manifest" ||
    preparedRegistry.payload.predecessor.generationId !== currentRegistry.generationId ||
    preparedRegistry.payload.predecessor.contentDigest !== currentRegistry.contentDigest ||
    !CapturedNumberIsSafeIntegerV1(currentCatalog.catalogGeneration) ||
    currentCatalog.catalogGeneration >= Number.MAX_SAFE_INTEGER ||
    preparedCatalog.catalogGeneration !== currentCatalog.catalogGeneration + 1 ||
    preparedCatalog.payload.predecessorCatalogContentDigest !== currentCatalog.contentDigest
  ) return "successor_invalid";

  const plan = request.formalPlanEnvelope;
  const planPin = request.formalPlanPin;
  const descriptor = request.formalReservationDescriptor;
  try {
    if (
      !ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanEnvelopeReferenceCandidateV1Schema.safeParse(
        plan,
      ).success ||
      !ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1Schema.safeParse(
        planPin,
      ).success ||
      !ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationDescriptorReferenceCandidateV1Schema.safeParse(
        descriptor,
      ).success ||
      !canonicalEqualV1(
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinV1(
          plan,
        ),
        planPin,
      )
    ) return "formal_plan_invalid";
  } catch {
    return "formal_plan_invalid";
  }
  if (
    plan.contentDigest !== planPin.contentDigest ||
    plan.payload.migrationId !== planPin.formalMigrationId ||
    plan.payload.migrationId !== descriptor.formalMigrationId ||
    plan.payload.journalAuthorityInstallationIdentityGenerationId !==
      descriptor.installationIdentityGenerationId ||
    descriptor.installationIdentityGenerationId !==
      preparedRegistry.payload.installationIdentityGenerationId ||
    descriptor.role !== "same_identity_journal" ||
    !canonicalEqualV1(
      plan.payload.preparedRegistryManifestPin,
      request.preparedRegistryManifestPin,
    ) ||
    !canonicalEqualV1(
      plan.payload.preparedSupportCatalogPin,
      request.preparedSupportCatalogPin,
    ) ||
    !canonicalEqualV1(
      plan.payload.migrationHistoryQuotaReservations.journal,
      descriptor,
    ) ||
    preparedRegistry.payload.routing.state !== "migration" ||
    preparedRegistry.payload.routing.migrationId !== descriptor.formalMigrationId
  ) return "formal_plan_invalid";
  return "ok";
}

function createCommittedSnapshotV1(
  request: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCompareReservePublishRequestInternalV1,
  requestCanonicalBytes: Uint8Array,
): MachineSnapshotInternalV1 {
  const requestContentDigest = digestV1(REQUEST_DOMAIN_V1, request);
  const reservationUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_compound_publication_reservation_record_v1" as const,
    reservationOrdinal: 1 as const,
    operationNonce: request.operationNonce,
    descriptor: request.formalReservationDescriptor,
    formalPlanPin: request.formalPlanPin,
    state: "reserved" as const,
  };
  const reservationRecord = deepFreezeTreeV1({
    ...reservationUnsigned,
    contentDigest: digestV1(RESERVATION_DOMAIN_V1, reservationUnsigned),
  });
  const eventUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_compound_publication_reserved_event_v1" as const,
    eventOrdinal: 1 as const,
    operationNonce: request.operationNonce,
    transition: "reserved" as const,
    reservationRecordContentDigest: reservationRecord.contentDigest,
    formalPlanPin: request.formalPlanPin,
  };
  const reservedEvent = deepFreezeTreeV1({
    ...eventUnsigned,
    contentDigest: digestV1(EVENT_DOMAIN_V1, eventUnsigned),
  });
  const accountUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_compound_publication_reserved_account_v1" as const,
    accountRevision: 1 as const,
    installationIdentityGenerationId:
      request.formalReservationDescriptor.installationIdentityGenerationId,
    role: "same_identity_journal" as const,
    state: "reserved" as const,
    activeReservationCount: 1 as const,
    reservationRecordContentDigest: reservationRecord.contentDigest,
    reservedEventContentDigest: reservedEvent.contentDigest,
  };
  const reservedAccount = deepFreezeTreeV1({
    ...accountUnsigned,
    contentDigest: digestV1(ACCOUNT_DOMAIN_V1, accountUnsigned),
  });
  const highWaterUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_compound_publication_high_water_v1" as const,
    revision: 1 as const,
    operationNonce: request.operationNonce,
    currentRegistryManifestPin: request.preparedRegistryManifestPin,
    currentSupportCatalogPin: request.preparedSupportCatalogPin,
    currentFormalPlanPin: request.formalPlanPin,
    reservationRecordContentDigest: reservationRecord.contentDigest,
    reservedEventContentDigest: reservedEvent.contentDigest,
    reservedAccountContentDigest: reservedAccount.contentDigest,
  };
  const highWater = deepFreezeTreeV1({
    ...highWaterUnsigned,
    contentDigest: digestV1(HIGH_WATER_DOMAIN_V1, highWaterUnsigned),
  });
  const receiptUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_compound_publication_committed_receipt_v1" as const,
    durability: MACHINE_DURABILITY_V1,
    status: "committed" as const,
    commitOrdinal: 1 as const,
    operationNonce: request.operationNonce,
    requestContentDigest,
    publishedRegistryManifestPin: request.preparedRegistryManifestPin,
    publishedSupportCatalogPin: request.preparedSupportCatalogPin,
    publishedFormalPlanPin: request.formalPlanPin,
    reservationRecord,
    reservedEvent,
    reservedAccount,
    highWater,
  };
  const receipt = deepFreezeTreeV1({
    ...receiptUnsigned,
    receiptContentDigest: digestV1(RECEIPT_DOMAIN_V1, receiptUnsigned),
  });
  const publicState = deepFreezeTreeV1({
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_compound_publication_state_v1" as const,
    durability: MACHINE_DURABILITY_V1,
    revision: 1 as const,
    currentRegistryManifestEnvelope: request.preparedRegistryManifestEnvelope,
    currentRegistryManifestPin: request.preparedRegistryManifestPin,
    currentSupportCatalogEnvelope: request.preparedSupportCatalogEnvelope,
    currentSupportCatalogPin: request.preparedSupportCatalogPin,
    registrySuccessorPublicationReceipts: CapturedObjectFreezeV1([]),
    migrationPublicationState: {
      state: "committed" as const,
      registryManifestPublication: "published_current" as const,
      catalogPublication: "published_current" as const,
      formalPlanPublication: "published" as const,
      formalPlanEnvelope: request.formalPlanEnvelope,
      formalPlanPin: request.formalPlanPin,
      reservationRecord,
      reservedEvent,
      reservedAccount,
      highWater,
      immutableReceipt: receipt,
    },
  });
  return CapturedObjectFreezeV1({
    publicState,
    committedOperationNonce: request.operationNonce,
    committedRequestCanonicalBytes: requestCanonicalBytes,
    committedReceipt: receipt,
    registrySuccessorReplayEntries: CapturedObjectFreezeV1([]),
  });
}

export function compareReservePublishProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
  capability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1,
  request: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCompareReservePublishRequestInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCompareReservePublishResultInternalV1 {
  const binding = getBindingV1(capability);
  if (binding === undefined) return rejectedV1("capability_invalid");
  if (!requestIsStructurallyValidV1(request)) return rejectedV1("schema_invalid");
  let requestCanonicalBytes: Uint8Array;
  try {
    requestCanonicalBytes = canonicalizeJcsSafeIntegerUtf8V1(request);
  } catch {
    return rejectedV1("schema_invalid");
  }
  const before = binding.snapshot;
  if (
    before.committedOperationNonce === request.operationNonce &&
    before.committedRequestCanonicalBytes !== undefined &&
    before.committedReceipt !== undefined
  ) {
    if (!bytesEqualV1(before.committedRequestCanonicalBytes, requestCanonicalBytes)) {
      return rejectedV1("operation_nonce_conflict");
    }
    return CapturedObjectFreezeV1({
      status: "committed",
      replay: true,
      receipt: before.committedReceipt,
    });
  }
  const current = before.publicState;
  if (
    !canonicalEqualV1(
      request.expectedCurrentRegistryManifestPin,
      current.currentRegistryManifestPin,
    ) ||
    !canonicalEqualV1(
      request.expectedCurrentSupportCatalogPin,
      current.currentSupportCatalogPin,
    )
  ) {
    return CapturedObjectFreezeV1({
      status: "not_committed",
      reason: "stale_expected_current_cut",
      observedCurrentRegistryManifestPin: current.currentRegistryManifestPin,
      observedCurrentSupportCatalogPin: current.currentSupportCatalogPin,
    });
  }
  if (current.migrationPublicationState.state !== "empty") {
    return rejectedV1("publication_state_not_empty");
  }
  const relationship = requestSuccessorAndPlanAreBoundV1(current, request);
  if (relationship !== "ok") return rejectedV1(relationship);

  const prospective = createCommittedSnapshotV1(request, requestCanonicalBytes);
  binding.snapshot = prospective;
  return CapturedObjectFreezeV1({
    status: "committed",
    replay: false,
    receipt: prospective.committedReceipt!,
  });
}

function appendFrozenV1<T>(values: readonly T[], value: T): readonly T[] {
  const output: T[] = [];
  for (let index = 0; index < values.length; index += 1) {
    output[index] = values[index]!;
  }
  output[values.length] = value;
  return CapturedObjectFreezeV1(output);
}

function rejectedRegistrySuccessorV1(
  reason: Extract<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundRegistrySuccessorPublicationResultInternalV1,
    { readonly status: "rejected" }
  >["reason"],
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundRegistrySuccessorPublicationResultInternalV1 {
  return CapturedObjectFreezeV1({ status: "rejected", reason });
}

function registrySuccessorRequestIsStructurallyValidV1(
  request: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundRegistrySuccessorPublicationRequestInternalV1,
): boolean {
  return hasExactEnumerableOwnDataKeysV1(
    request,
    REGISTRY_SUCCESSOR_REQUEST_KEYS_V1,
  ) &&
    LowerHex32V1Schema.safeParse(request.operationNonce).success &&
    isPlainFrozenObjectV1(request.expectedCurrentRegistryManifestPin) &&
    isPlainFrozenObjectV1(request.validatedSignedSuccessorEnvelope) &&
    isPlainFrozenObjectV1(request.validatedSignedSuccessorPin);
}

function registrySuccessorIsValidV1(
  currentState: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCommittedStateInternalV1,
  request: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundRegistrySuccessorPublicationRequestInternalV1,
): boolean {
  const currentEnvelope = currentState.currentRegistryManifestEnvelope;
  const successorEnvelope = request.validatedSignedSuccessorEnvelope;
  let derivedPin: ProviderRegistryManifestPinV1;
  try {
    derivedPin = deriveRegistryPinV1(successorEnvelope);
  } catch {
    return false;
  }
  const currentRouting = currentEnvelope.payload.routing;
  const successorRouting = successorEnvelope.payload.routing;
  if (
    !canonicalEqualV1(derivedPin, request.validatedSignedSuccessorPin) ||
    !CapturedNumberIsSafeIntegerV1(currentEnvelope.payload.manifestGeneration) ||
    currentEnvelope.payload.manifestGeneration >= Number.MAX_SAFE_INTEGER ||
    successorEnvelope.payload.manifestGeneration !==
      currentEnvelope.payload.manifestGeneration + 1 ||
    successorEnvelope.payload.predecessor.state !== "manifest" ||
    successorEnvelope.payload.predecessor.generationId !==
      currentEnvelope.generationId ||
    successorEnvelope.payload.predecessor.contentDigest !==
      currentEnvelope.contentDigest ||
    successorEnvelope.payload.installationIdentityGenerationId !==
      currentEnvelope.payload.installationIdentityGenerationId ||
    !canonicalEqualV1(
      successorEnvelope.payload.activeRootMetadata,
      currentEnvelope.payload.activeRootMetadata,
    ) ||
    currentRouting.state !== "migration"
  ) return false;
  if (successorRouting.state === "steady") {
    if (
      currentRouting.phase !== "source_drained" ||
      currentRouting.activeForMigrationWrites !==
        currentRouting.destinationProviderId
    ) return false;
    const currentMembers = currentEnvelope.payload.members;
    const successorMembers = successorEnvelope.payload.members;
    if (successorMembers.length !== currentMembers.length) return false;
    let currentEnabledCount = 0;
    let successorEnabledCount = 0;
    let sourceRevoked = false;
    let destinationEnabled = false;
    for (let index = 0; index < currentMembers.length; index += 1) {
      const currentMember = currentMembers[index]!;
      const successorMember = successorMembers[index]!;
      if (currentMember.providerId !== successorMember.providerId) return false;
      if (currentMember.disposition === "enabled") currentEnabledCount += 1;
      if (successorMember.disposition === "enabled") {
        successorEnabledCount += 1;
      }
      if (currentMember.providerId === currentRouting.sourceProviderId) {
        if (
          currentMember.disposition !== "enabled" ||
          successorMember.disposition !== "revoked" ||
          successorMember.lastEnabledRegistryEntryContentDigest !==
            currentMember.registryEntryContentDigest ||
          successorMember.revokedAtManifestGeneration !==
            successorEnvelope.payload.manifestGeneration ||
          successorMember.reason !== "migration_completed"
        ) return false;
        sourceRevoked = true;
        continue;
      }
      if (!canonicalEqualV1(successorMember, currentMember)) return false;
      if (
        currentMember.providerId === currentRouting.destinationProviderId &&
        currentMember.disposition === "enabled"
      ) destinationEnabled = true;
    }
    return currentEnabledCount === 2 &&
      successorEnabledCount === 1 &&
      sourceRevoked &&
      destinationEnabled;
  }
  if (
    !canonicalEqualV1(
      successorEnvelope.payload.members,
      currentEnvelope.payload.members,
    ) ||
    successorRouting.migrationId !== currentRouting.migrationId ||
    successorRouting.sourceProviderId !== currentRouting.sourceProviderId ||
    successorRouting.destinationProviderId !==
      currentRouting.destinationProviderId ||
    successorRouting.activeForMigrationWrites !==
      currentRouting.destinationProviderId
  ) return false;
  if (
    currentRouting.phase === "prepared" &&
    currentRouting.activeForMigrationWrites === currentRouting.sourceProviderId
  ) return successorRouting.phase === "rebinding";
  if (
    currentRouting.phase === "rebinding" &&
    currentRouting.activeForMigrationWrites ===
      currentRouting.destinationProviderId
  ) return successorRouting.phase === "source_drained";
  return false;
}

export function comparePublishRegistrySuccessorProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
  capability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1,
  request: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundRegistrySuccessorPublicationRequestInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundRegistrySuccessorPublicationResultInternalV1 {
  const binding = getBindingV1(capability);
  if (binding === undefined) {
    return rejectedRegistrySuccessorV1("capability_invalid");
  }
  if (!registrySuccessorRequestIsStructurallyValidV1(request)) {
    return rejectedRegistrySuccessorV1("schema_invalid");
  }
  let requestCanonicalBytes: Uint8Array;
  try {
    requestCanonicalBytes = canonicalizeJcsSafeIntegerUtf8V1(request);
  } catch {
    return rejectedRegistrySuccessorV1("schema_invalid");
  }
  const before = binding.snapshot;
  for (
    let index = 0;
    index < before.registrySuccessorReplayEntries.length;
    index += 1
  ) {
    const entry = before.registrySuccessorReplayEntries[index]!;
    if (entry.operationNonce !== request.operationNonce) continue;
    if (!bytesEqualV1(entry.requestCanonicalBytes, requestCanonicalBytes)) {
      return rejectedRegistrySuccessorV1("operation_nonce_conflict");
    }
    return CapturedObjectFreezeV1({
      status: "committed",
      replay: true,
      receipt: entry.receipt,
      currentState: entry.committedState,
    });
  }
  if (before.committedOperationNonce === request.operationNonce) {
    return rejectedRegistrySuccessorV1("operation_nonce_conflict");
  }
  const current = before.publicState;
  if (
    !canonicalEqualV1(
      request.expectedCurrentRegistryManifestPin,
      current.currentRegistryManifestPin,
    )
  ) {
    return CapturedObjectFreezeV1({
      status: "not_committed",
      reason: "stale_expected_current_registry",
      observedCurrentRegistryManifestPin: current.currentRegistryManifestPin,
    });
  }
  if (current.migrationPublicationState.state !== "committed") {
    return rejectedRegistrySuccessorV1("publication_state_not_committed");
  }
  if (
    !CapturedNumberIsSafeIntegerV1(current.revision) ||
    current.revision >= Number.MAX_SAFE_INTEGER ||
    !registrySuccessorIsValidV1(
      current as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCommittedStateInternalV1,
      request,
    )
  ) return rejectedRegistrySuccessorV1("successor_invalid");

  const requestContentDigest = digestV1(
    REGISTRY_SUCCESSOR_REQUEST_DOMAIN_V1,
    request,
  );
  const routing = request.validatedSignedSuccessorEnvelope.payload.routing;
  if (routing.state === "migration" && routing.phase === "prepared") {
    return rejectedRegistrySuccessorV1("successor_invalid");
  }
  const currentRouting = current.currentRegistryManifestEnvelope.payload.routing;
  const routingPhase:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundRegistrySuccessorPublicationReceiptInternalV1["routingPhase"] =
      routing.state === "steady"
        ? "steady"
        : routing.phase === "rebinding"
          ? "rebinding"
          : "source_drained";
  const activeForMigrationWrites = routing.state === "steady"
    ? currentRouting.state === "migration"
      ? currentRouting.destinationProviderId
      : ""
    : routing.activeForMigrationWrites;
  const publicationOrdinal =
    current.registrySuccessorPublicationReceipts.length + 1;
  const compoundRevision = current.revision + 1;
  const receiptUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_compound_registry_successor_publication_receipt_v1" as const,
    durability: MACHINE_DURABILITY_V1,
    status: "committed" as const,
    operationNonce: request.operationNonce,
    requestContentDigest,
    publicationOrdinal,
    compoundRevision,
    previousRegistryManifestPin: current.currentRegistryManifestPin,
    publishedRegistryManifestEnvelope:
      request.validatedSignedSuccessorEnvelope,
    publishedRegistryManifestPin: request.validatedSignedSuccessorPin,
    routingPhase,
    activeForMigrationWrites,
  };
  const receipt = deepFreezeTreeV1({
    ...receiptUnsigned,
    receiptContentDigest: digestV1(
      REGISTRY_SUCCESSOR_RECEIPT_DOMAIN_V1,
      receiptUnsigned,
    ),
  });
  const publicState = deepFreezeTreeV1({
    ...current,
    revision: compoundRevision,
    currentRegistryManifestEnvelope:
      request.validatedSignedSuccessorEnvelope,
    currentRegistryManifestPin: request.validatedSignedSuccessorPin,
    registrySuccessorPublicationReceipts: appendFrozenV1(
      current.registrySuccessorPublicationReceipts,
      receipt,
    ),
  }) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationCommittedStateInternalV1;
  const replayEntry = CapturedObjectFreezeV1({
    operationNonce: request.operationNonce,
    requestCanonicalBytes,
    receipt,
    committedState: publicState,
  });
  const prospective = CapturedObjectFreezeV1({
    ...before,
    publicState,
    registrySuccessorReplayEntries: appendFrozenV1(
      before.registrySuccessorReplayEntries,
      replayEntry,
    ),
  });
  binding.snapshot = prospective;
  return CapturedObjectFreezeV1({
    status: "committed",
    replay: false,
    receipt,
    currentState: publicState,
  });
}

export function inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
  capability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationStateInternalV1 {
  const binding = getBindingV1(capability);
  if (binding === undefined) {
    throw new CapturedTypeErrorV1("compound publication capability invalid");
  }
  return binding.snapshot.publicState;
}

for (const exportedFunctionV1 of [
  createProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationEmptyStateInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1,
  compareReservePublishProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1,
  comparePublishRegistrySuccessorProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1,
  inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1,
]) CapturedObjectFreezeV1(exportedFunctionV1);
