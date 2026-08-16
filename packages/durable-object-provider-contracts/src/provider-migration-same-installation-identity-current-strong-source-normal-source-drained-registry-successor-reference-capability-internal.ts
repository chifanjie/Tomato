/**
 * Package-private source_drained Registry publication reference orchestrator.
 * It consumes an exact zero-live closure, validates the externally Root-signed
 * rebinding -> source_drained successor, and advances the process-local
 * compound Registry current pointer with one CAS.
 */

import { LowerHex32V1Schema } from "./primitives.js";
import {
  comparePublishRegistrySuccessorProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1,
  inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundRegistrySuccessorPublicationReceiptInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-compound-publication-reference-machine-internal.js";
import {
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveRegistryContinuationInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseZeroLiveReferenceValidationInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-destination-universe-zero-live-reference-machine-internal.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-migration-only-acceptance-compare-append-reference-machine-internal.js";
import {
  diagnoseProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorCandidateInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSourceDrainedRegistryManifestSourceCapabilityInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorCandidateValidationInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-source-drained-registry-successor-validator-internal.js";
import {
  createProviderNonThenableFrozenRecordV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import type {
  ProviderRegistryManifestEnvelopeV1,
  ProviderRegistryManifestPinV1,
} from "./provider-registry-records.js";
import type {
  ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
} from "./provider-strong-ready-bootstrap-or-steady-acceptance-identity-verification-capability-internal.js";

const CapturedArrayIsArrayV1 = Array.isArray;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedObjectPrototypeV1 = Object.prototype;
const CapturedReflectOwnKeysV1 = Reflect.ownKeys;
const CapturedWeakMapV1 = WeakMap;

export interface BuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceCandidateInternalV1Input {
  readonly zeroLiveClosure:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseZeroLiveReferenceValidationInternalV1;
  readonly externallySignedSourceDrainedRegistryManifestSourceCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSourceDrainedRegistryManifestSourceCapabilityInternalV1;
  readonly operationNonce: ReturnType<typeof LowerHex32V1Schema.parse>;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceValidationInternalV1 {
  readonly authority: "in_memory_reference_machine_only_no_production_provider_authority_v1";
  readonly durability: "in_memory_reference_only_not_a_durable_provider_v1";
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_source_drained_registry_successor_reference_validation_v1";
  readonly relationship: "exact_zero_live_externally_root_signed_source_drained_registry_direct_successor_compound_cas_published_current_v1";
  readonly zeroLiveClosure:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseZeroLiveReferenceValidationInternalV1;
  readonly candidateValidation:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorCandidateValidationInternalV1;
  readonly sourceDrainedRegistryManifestEnvelope:
    ProviderRegistryManifestEnvelopeV1;
  readonly sourceDrainedRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly registryPublicationReceipt:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundRegistrySuccessorPublicationReceiptInternalV1;
  readonly publicationReplay: boolean;
  readonly currentRegistryManifestEnvelope:
    ProviderRegistryManifestEnvelopeV1;
  readonly currentRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly compoundStateRevision: number;
  readonly registryManifestPublicationCount: 1;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceDiagnosticResultInternalV1 =
  | Readonly<{
      readonly ok: true;
      readonly value:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceValidationInternalV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage:
        | "input"
        | "source_drained_candidate"
        | "registry_publication";
      readonly reason:
        | "schema_invalid"
        | "capability_invalid"
        | "candidate_invalid"
        | "signature_invalid"
        | "stale_expected_current_registry"
        | "operation_nonce_conflict"
        | "publication_rejected";
      readonly candidateStage?: string;
      readonly candidateReason?: string;
      readonly observedCurrentRegistryManifestPin?:
        ProviderRegistryManifestPinV1;
    }>;

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistryTerminalContinuationInternalV1 {
  readonly zeroLiveClosure:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationUniverseZeroLiveReferenceValidationInternalV1;
  readonly compoundPublicationReferenceMachineCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1;
  readonly migrationOnlyAcceptanceReferenceMachineCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1;
  readonly acceptanceIdentityVerificationCapability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
  readonly sourceDrainedRegistrySuccessor:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceValidationInternalV1;
}

const terminalContinuationsInternalV1 = new CapturedWeakMapV1<
  object,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistryTerminalContinuationInternalV1
>();

function inputHasExactShapeV1(
  input: unknown,
): input is BuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceCandidateInternalV1Input {
  if (
    input === null ||
    typeof input !== "object" ||
    CapturedArrayIsArrayV1(input) ||
    (CapturedObjectGetPrototypeOfV1(input) !== CapturedObjectPrototypeV1 &&
      CapturedObjectGetPrototypeOfV1(input) !== null)
  ) return false;
  const expected = [
    "zeroLiveClosure",
    "externallySignedSourceDrainedRegistryManifestSourceCapability",
    "operationNonce",
  ] as const;
  const keys = CapturedReflectOwnKeysV1(input);
  if (keys.length !== expected.length) return false;
  for (let index = 0; index < expected.length; index += 1) {
    const expectedKey = expected[index];
    if (expectedKey === undefined) return false;
    const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(
      input,
      expectedKey,
    );
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) return false;
  }
  return true;
}

function failureV1(
  stage: Extract<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceDiagnosticResultInternalV1,
    { readonly ok: false }
  >["stage"],
  reason: Extract<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceDiagnosticResultInternalV1,
    { readonly ok: false }
  >["reason"],
  extra: Readonly<Record<string, unknown>> = {},
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceDiagnosticResultInternalV1 {
  return createProviderNonThenableFrozenRecordV1({
    ok: false as const,
    stage,
    reason,
    ...extra,
  }) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceDiagnosticResultInternalV1;
}

async function diagnoseInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceDiagnosticResultInternalV1> {
  if (!inputHasExactShapeV1(input)) {
    return failureV1("input", "schema_invalid");
  }
  const operationNonce = LowerHex32V1Schema.safeParse(input.operationNonce);
  if (!operationNonce.success) return failureV1("input", "schema_invalid");
  const zeroLiveContinuation =
    takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveRegistryContinuationInternalV1(
      input.zeroLiveClosure,
    );
  if (
    zeroLiveContinuation === undefined ||
    zeroLiveContinuation.zeroLiveClosure !== input.zeroLiveClosure
  ) return failureV1("input", "capability_invalid");

  const candidate =
    await diagnoseProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorCandidateInternalV1(
      zeroLiveContinuation,
      input.externallySignedSourceDrainedRegistryManifestSourceCapability,
    );
  if (!candidate.ok) {
    return failureV1(
      "source_drained_candidate",
      candidate.reason === "signature_invalid"
        ? "signature_invalid"
        : "candidate_invalid",
      {
        candidateStage: candidate.stage,
        candidateReason: candidate.reason,
      },
    );
  }

  const publication =
    comparePublishRegistrySuccessorProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
      zeroLiveContinuation.compoundPublicationReferenceMachineCapability,
      CapturedObjectFreezeV1({
        operationNonce: operationNonce.data,
        expectedCurrentRegistryManifestPin:
          candidate.value.currentRebindingRegistryManifestPin,
        validatedSignedSuccessorEnvelope:
          candidate.value.sourceDrainedRegistryManifestEnvelope,
        validatedSignedSuccessorPin:
          candidate.value.sourceDrainedRegistryManifestPin,
      }),
    );
  if (publication.status === "not_committed") {
    return failureV1(
      "registry_publication",
      "stale_expected_current_registry",
      {
        observedCurrentRegistryManifestPin:
          publication.observedCurrentRegistryManifestPin,
      },
    );
  }
  if (publication.status === "rejected") {
    return failureV1(
      "registry_publication",
      publication.reason === "operation_nonce_conflict"
        ? "operation_nonce_conflict"
        : publication.reason === "capability_invalid"
          ? "capability_invalid"
          : "publication_rejected",
    );
  }

  const state =
    inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
      zeroLiveContinuation.compoundPublicationReferenceMachineCapability,
    );
  const routing = state.currentRegistryManifestEnvelope.payload.routing;
  if (
    state.migrationPublicationState.state !== "committed" ||
    state.currentRegistryManifestEnvelope !==
      publication.receipt.publishedRegistryManifestEnvelope ||
    state.currentRegistryManifestPin !==
      publication.receipt.publishedRegistryManifestPin ||
    routing.state !== "migration" ||
    routing.phase !== "source_drained" ||
    routing.activeForMigrationWrites !== routing.destinationProviderId ||
    state.currentRegistryManifestPin.contentDigest !==
      candidate.value.sourceDrainedRegistryManifestPin.contentDigest
  ) return failureV1("registry_publication", "publication_rejected");

  const value = CapturedObjectFreezeV1({
    authority:
      "in_memory_reference_machine_only_no_production_provider_authority_v1" as const,
    durability:
      "in_memory_reference_only_not_a_durable_provider_v1" as const,
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_source_drained_registry_successor_reference_validation_v1" as const,
    relationship:
      "exact_zero_live_externally_root_signed_source_drained_registry_direct_successor_compound_cas_published_current_v1" as const,
    zeroLiveClosure: input.zeroLiveClosure,
    candidateValidation: candidate.value,
    sourceDrainedRegistryManifestEnvelope:
      candidate.value.sourceDrainedRegistryManifestEnvelope,
    sourceDrainedRegistryManifestPin:
      candidate.value.sourceDrainedRegistryManifestPin,
    registryPublicationReceipt: publication.receipt,
    publicationReplay: publication.replay,
    currentRegistryManifestEnvelope: state.currentRegistryManifestEnvelope,
    currentRegistryManifestPin: state.currentRegistryManifestPin,
    compoundStateRevision: state.revision,
    registryManifestPublicationCount: 1 as const,
  }) satisfies ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceValidationInternalV1;
  terminalContinuationsInternalV1.set(
    value,
    CapturedObjectFreezeV1({
      zeroLiveClosure: input.zeroLiveClosure,
      compoundPublicationReferenceMachineCapability:
        zeroLiveContinuation.compoundPublicationReferenceMachineCapability,
      migrationOnlyAcceptanceReferenceMachineCapability:
        zeroLiveContinuation.migrationOnlyAcceptanceReferenceMachineCapability,
      acceptanceIdentityVerificationCapability:
        zeroLiveContinuation.acceptanceIdentityVerificationCapability,
      sourceDrainedRegistrySuccessor: value,
    }),
  );
  return createProviderNonThenableFrozenRecordV1({ ok: true as const, value });
}

export function diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceCandidateInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceDiagnosticResultInternalV1> {
  return hardenProviderPointPromiseV1(diagnoseInternalV1(input));
}

/** Foreign/cloned successes do not consume the exact owner. */
export function takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistryTerminalContinuationInternalV1(
  exactSourceDrainedSuccess:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceValidationInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistryTerminalContinuationInternalV1 | undefined {
  if (
    exactSourceDrainedSuccess === null ||
    typeof exactSourceDrainedSuccess !== "object"
  ) return undefined;
  const continuation = terminalContinuationsInternalV1.get(
    exactSourceDrainedSuccess,
  );
  if (
    continuation === undefined ||
    !terminalContinuationsInternalV1.delete(exactSourceDrainedSuccess)
  ) return undefined;
  return continuation;
}

for (const exportedFunctionV1 of [
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorReferenceCandidateInternalV1,
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistryTerminalContinuationInternalV1,
]) CapturedObjectFreezeV1(exportedFunctionV1);
