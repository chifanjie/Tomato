/**
 * Package-private D-45 strict migration-only Acceptance orchestrator.
 *
 * D-44 must first commit. The orchestrator then queue-retires the exact D-40
 * writer capability, consumes that one-way handoff into the branch machine,
 * and compare-appends one identity-keyed migration-only Acceptance. Nothing
 * here claims production Provider authority or crash durability.
 */

import { LowerHex32V1Schema } from "./primitives.js";
import {
  inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-compound-publication-reference-machine-internal.js";
import {
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceCandidateInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceCapabilityInternalV1,
  type MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceCapabilityInternalV1Input,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceBoundBuildInputInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceRequestInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceValidationInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-formal-plan-publication-reference-capability-internal.js";
import {
  compareAppendProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceMachineInternalV1,
  inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReceiptInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceStateInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-migration-only-acceptance-compare-append-reference-machine-internal.js";
import {
  discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1,
  registerProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1,
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationPayloadInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-migration-only-acceptance-continuation-internal.js";
import {
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContentDigestInternalV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceGenerationIdInternalV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1,
  validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceEnvelopeInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceConfigurationInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceEnvelopeInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-migration-only-acceptance-reference-candidate-internal.js";
import {
  deepFreezeProviderPointDetachedDataTreeV1,
} from "./provider-point-raw-admission-internal.js";
import {
  createProviderNonThenableFrozenRecordV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import {
  deriveProviderMigrationOnlyAcceptanceStateTokenWithIdentityCapabilityInternalV1,
  getProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInstallationIdentityGenerationIdInternalV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
} from "./provider-strong-ready-bootstrap-or-steady-acceptance-identity-verification-capability-internal.js";
import {
  inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1,
  isProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineErrorInternalV1,
  retireProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineForMigrationInternalV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1,
} from "./provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-reference-machine-internal.js";
import { ProviderRegistryIsoTimestampV1Schema } from "./provider-registry-trust.js";

const CapturedObjectCreateV1 = Object.create;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedTypeErrorV1 = TypeError;
const CapturedWeakMapV1 = WeakMap;

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceRequestInternalV1 {
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_migration_only_acceptance_reference_request_v1";
  readonly formalPlanPublicationRequest:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceRequestInternalV1;
  readonly acceptanceOperationNonce: ReturnType<typeof LowerHex32V1Schema.parse>;
  readonly acceptedAt: ReturnType<typeof ProviderRegistryIsoTimestampV1Schema.parse>;
  readonly resolvedAt: ReturnType<typeof ProviderRegistryIsoTimestampV1Schema.parse>;
}

export interface MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceCapabilityInternalV1Input
  extends Omit<
    MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceCapabilityInternalV1Input,
    "request"
  > {
  readonly acceptanceIdentityVerificationCapability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
  readonly acceptanceReferenceMachineCapability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1;
  readonly request:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceRequestInternalV1;
}

declare const migrationOnlyAcceptanceReferenceCapabilityBrandInternalV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceCapabilityInternalV1 {
  readonly [migrationOnlyAcceptanceReferenceCapabilityBrandInternalV1]: true;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceBoundBuildInputInternalV1 {
  readonly request:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceRequestInternalV1;
  readonly migrationOnlyAcceptanceReferenceCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceCapabilityInternalV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceReadyBuildInputInternalV1 {
  readonly request:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceRequestInternalV1;
  readonly migrationOnlyAcceptanceReferenceCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceCapabilityInternalV1;
  readonly buildInput:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceBoundBuildInputInternalV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceValidationInternalV1 {
  readonly authority: "in_memory_reference_machine_only_no_production_provider_authority_v1";
  readonly durability: "in_memory_reference_only_not_a_durable_provider_v1";
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_migration_only_acceptance_reference_validation_v1";
  readonly relationship: "committed_d44_publication_strict_migration_only_acceptance_compare_appended_v1";
  readonly formalPlanPublicationClosure:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceValidationInternalV1;
  readonly migrationOnlyAcceptanceEnvelope:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceEnvelopeInternalV1;
  readonly migrationOnlyAcceptancePin:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1;
  readonly acceptanceCompareAppendReceipt:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReceiptInternalV1;
  readonly acceptanceReferenceState:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceStateInternalV1;
  readonly acceptanceOrdinal: number;
  readonly configuration:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceConfigurationInternalV1;
  readonly acceptedRegistryManifestPin:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceValidationInternalV1["currentRegistryManifestPin"];
  readonly acceptedSupportCatalogPin:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceValidationInternalV1["currentSupportCatalogPin"];
  readonly sourceObjectCount: number;
  readonly sourceLogicalBytes: number;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceDiagnosticResultInternalV1 =
  | Readonly<{
      readonly ok: true;
      readonly value:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceValidationInternalV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage:
        | "input"
        | "formal_plan_publication"
        | "acceptance_handoff"
        | "acceptance_compare_append";
      readonly reason:
        | "schema_invalid"
        | "capability_invalid"
        | "publication_failed"
        | "identity_mismatch"
        | "stale_expected_acceptance"
        | "operation_nonce_conflict"
        | "candidate_invalid";
      readonly acceptanceCompareAppendReceipt?:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReceiptInternalV1;
    }>;

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceExecutionContinuationInternalV1 {
  readonly migrationOnlyAcceptance:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceValidationInternalV1;
  readonly compoundPublicationReferenceMachineCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1;
  readonly migrationOnlyAcceptanceReferenceMachineCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1;
  readonly acceptanceIdentityVerificationCapability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
}

interface ContextInternalV1 {
  readonly request:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceRequestInternalV1;
  readonly d44BuildInput:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceBoundBuildInputInternalV1;
  readonly continuationIntent:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1;
  readonly acceptanceIdentityVerificationCapability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
  readonly acceptanceReferenceMachineCapability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1;
}

const contextsInternalV1 = new CapturedWeakMapV1<object, ContextInternalV1>();
const readyInputsInternalV1 = new CapturedWeakMapV1<object, object>();
const executionContinuationsInternalV1 = new CapturedWeakMapV1<
  object,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceExecutionContinuationInternalV1
>();

function failureV1(
  stage: Extract<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceDiagnosticResultInternalV1,
    { readonly ok: false }
  >["stage"],
  reason: Extract<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceDiagnosticResultInternalV1,
    { readonly ok: false }
  >["reason"],
  receipt?: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReceiptInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceDiagnosticResultInternalV1 {
  return createProviderNonThenableFrozenRecordV1({
    ok: false as const,
    stage,
    reason,
    ...(receipt === undefined ? {} : { acceptanceCompareAppendReceipt: receipt }),
  });
}

function parseRequestV1(
  input: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceRequestInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceRequestInternalV1 {
  if (
    input?.profile !==
      "provider_migration_same_installation_identity_current_strong_source_normal_migration_only_acceptance_reference_request_v1"
  ) throw new CapturedTypeErrorV1("migration-only Acceptance request invalid");
  const acceptanceOperationNonce = LowerHex32V1Schema.parse(
    input.acceptanceOperationNonce,
  );
  const acceptedAt = ProviderRegistryIsoTimestampV1Schema.parse(
    input.acceptedAt,
  );
  const resolvedAt = ProviderRegistryIsoTimestampV1Schema.parse(
    input.resolvedAt,
  );
  if (acceptedAt > resolvedAt) {
    throw new CapturedTypeErrorV1("Acceptance resolution precedes acceptance");
  }
  return deepFreezeProviderPointDetachedDataTreeV1({
    profile: input.profile,
    formalPlanPublicationRequest: input.formalPlanPublicationRequest,
    acceptanceOperationNonce,
    acceptedAt,
    resolvedAt,
  });
}

async function mintInternalV1(
  input: MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceCapabilityInternalV1Input,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceReadyBuildInputInternalV1> {
  const request = parseRequestV1(input.request);
  const continuationIntent =
    mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1();
  try {
    const d44Ready =
      await mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceCapabilityInternalV1({
        acceptanceClosureIdentity: input.acceptanceClosureIdentity,
        compoundPublicationReferenceMachineCapability:
          input.compoundPublicationReferenceMachineCapability,
        endpointObservationHost: input.endpointObservationHost,
        externallySignedPreparedCatalogSourceCapability:
          input.externallySignedPreparedCatalogSourceCapability,
        externallySignedPreparedRegistryManifestSourceCapability:
          input.externallySignedPreparedRegistryManifestSourceCapability,
        prospectiveDestinationPreparedSourceCapability:
          input.prospectiveDestinationPreparedSourceCapability,
        quotaObservationHost: input.quotaObservationHost,
        request: request.formalPlanPublicationRequest,
        sideEffectAuditObserver: input.sideEffectAuditObserver,
        sourceStreamHost: input.sourceStreamHost,
        verifiedLiveReferenceSchemaDigest:
          input.verifiedLiveReferenceSchemaDigest,
        verifiedMigrationProtocolDigest: input.verifiedMigrationProtocolDigest,
      });
    registerProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1(
      d44Ready.formalPlanPublicationReferenceCapability,
      continuationIntent,
    );
    const capability = CapturedObjectFreezeV1(
      CapturedObjectCreateV1(null),
    ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceCapabilityInternalV1;
    const buildInput = createProviderNonThenableFrozenRecordV1({
      request,
      migrationOnlyAcceptanceReferenceCapability: capability,
    }) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceBoundBuildInputInternalV1;
    contextsInternalV1.set(capability, {
      request,
      d44BuildInput: d44Ready.buildInput,
      continuationIntent,
      acceptanceIdentityVerificationCapability:
        input.acceptanceIdentityVerificationCapability,
      acceptanceReferenceMachineCapability:
        input.acceptanceReferenceMachineCapability,
    });
    readyInputsInternalV1.set(buildInput, capability);
    return createProviderNonThenableFrozenRecordV1({
      request,
      migrationOnlyAcceptanceReferenceCapability: capability,
      buildInput,
    });
  } catch (error) {
    discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1(
      continuationIntent,
    );
    throw error;
  }
}

export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceCapabilityInternalV1(
  input: MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceCapabilityInternalV1Input,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceReadyBuildInputInternalV1> {
  return hardenProviderPointPromiseV1(mintInternalV1(input));
}

async function diagnoseInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceDiagnosticResultInternalV1> {
  if (input === null || typeof input !== "object") {
    return failureV1("input", "schema_invalid");
  }
  const capability = readyInputsInternalV1.get(input);
  if (capability === undefined || !readyInputsInternalV1.delete(input)) {
    return failureV1("input", "capability_invalid");
  }
  const context = contextsInternalV1.get(capability);
  if (context === undefined || !contextsInternalV1.delete(capability)) {
    return failureV1("input", "capability_invalid");
  }

  const d44Result =
    await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceCandidateInternalV1(
      context.d44BuildInput,
    );
  if (!d44Result.ok) {
    return failureV1("formal_plan_publication", "publication_failed");
  }
  const continuation =
    takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationPayloadInternalV1(
      context.continuationIntent,
      d44Result.value,
    );
  if (continuation === undefined) {
    return failureV1("formal_plan_publication", "capability_invalid");
  }
  const d44 = continuation.exactD44Publication;
  const identity =
    getProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInstallationIdentityGenerationIdInternalV1(
      context.acceptanceIdentityVerificationCapability,
    );
  if (
    d44.currentRegistryManifestEnvelope.payload
      .installationIdentityGenerationId !== identity
  ) {
    return failureV1("acceptance_handoff", "identity_mismatch");
  }
  const compoundState =
    inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
      continuation.compoundPublicationReferenceMachineCapability,
    );
  if (
    compoundState.revision !== 1 ||
    compoundState.migrationPublicationState.state !== "committed" ||
    compoundState.migrationPublicationState.immutableReceipt !==
      d44.committedReceipt
  ) {
    return failureV1("formal_plan_publication", "publication_failed");
  }

  let migrationMachine;
  try {
    const expectedState =
      inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(
        context.acceptanceReferenceMachineCapability,
      );
    const handoff =
      await retireProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineForMigrationInternalV1(
        {
          identityVerificationCapability:
            context.acceptanceIdentityVerificationCapability,
          referenceMachineCapability:
            context.acceptanceReferenceMachineCapability,
          expectedState,
        },
      );
    migrationMachine =
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineInternalV1(
        {
          identityVerificationCapability:
            context.acceptanceIdentityVerificationCapability,
          strongReadyMigrationHandoffCapability: handoff,
        },
      );
  } catch (error) {
    return failureV1(
      "acceptance_handoff",
      isProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineErrorInternalV1(
          error,
        ) && error.reason === "source_invalid"
        ? "stale_expected_acceptance"
        : "capability_invalid",
    );
  }

  const before =
    inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceCompareAppendReferenceMachineInternalV1(
      migrationMachine,
    );
  const d41 =
    d44.preparedCatalogSuccessorClosure.preparedRegistrySuccessorClosure
      .preSideEffectPlanAdmissionClosure;
  const configuration = deepFreezeProviderPointDetachedDataTreeV1({
    state: "migration_only" as const,
    reason: "provider_decommission" as const,
    publishedTrustPins: {
      rootMetadata:
        d44.currentRegistryManifestEnvelope.payload.activeRootMetadata,
      registryManifest: d44.currentRegistryManifestPin,
      supportCatalog: d44.currentSupportCatalogPin,
    },
    publicStrongWriter: {
      state: "disabled" as const,
      reason:
        "migration_only_acceptance_does_not_select_a_public_writer_v1" as const,
      previousActiveWriterSelector: before.previousActiveWriterSelector,
    },
    formalPlanPin: d44.formalPlanPin,
    executor: {
      state: "enabled_for_plan_only" as const,
      formalMigrationId: d44.formalPlanPin.formalMigrationId,
    },
    sourceWriter: d41.sourceTrust.currentWriterSelection,
    destinationWriter: d41.destinationTrust.prospectiveWriterProjection,
  });
  const acceptanceOrdinal = before.currentAcceptance.acceptanceOrdinal + 1;
  const predecessor = deepFreezeProviderPointDetachedDataTreeV1({
    state: "acceptance" as const,
    generationId: before.currentAcceptance.generationId,
    contentDigest: before.currentAcceptance.contentDigest,
  });
  const generationId =
    deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceGenerationIdInternalV1(
      {
        installationIdentityGenerationId: identity,
        acceptanceOrdinal,
        predecessor,
        configuration,
      },
    );
  const unsignedPayload = deepFreezeProviderPointDetachedDataTreeV1({
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_migration_only_acceptance_payload_reference_candidate_v1" as const,
    generationId,
    installationIdentityGenerationId: identity,
    acceptanceOrdinal,
    predecessor,
    configuration,
    acceptedAt: context.request.acceptedAt,
  });
  const acceptanceToken =
    await deriveProviderMigrationOnlyAcceptanceStateTokenWithIdentityCapabilityInternalV1(
      context.acceptanceIdentityVerificationCapability,
      identity,
      unsignedPayload,
    );
  const payload = deepFreezeProviderPointDetachedDataTreeV1({
    ...unsignedPayload,
    acceptanceToken,
  });
  let envelope:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceEnvelopeInternalV1;
  try {
    envelope =
      validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceEnvelopeInternalV1(
        {
          schemaVersion: 1,
          recordType:
            "provider_migration_same_installation_identity_current_strong_source_normal_migration_only_acceptance_reference_candidate",
          generationId,
          installationIdentityGenerationId: identity,
          acceptedAt: context.request.acceptedAt,
          contentDigest:
            deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContentDigestInternalV1(
              payload,
            ),
          payload,
        },
      );
  } catch {
    return failureV1("acceptance_compare_append", "candidate_invalid");
  }
  const append =
    await compareAppendProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceMachineInternalV1(
      migrationMachine,
      {
        identityVerificationCapability:
          context.acceptanceIdentityVerificationCapability,
        request: {
          profile:
            "provider_migration_same_installation_identity_current_strong_source_normal_migration_only_acceptance_compare_append_request_v1",
          operationNonce: context.request.acceptanceOperationNonce,
          installationIdentityGenerationId: identity,
          expected: {
            highWaterRevision: before.highWaterRevision,
            currentAcceptance: before.currentAcceptance,
            currentVersionToken: before.currentVersionToken,
            generationCount: before.generationCount,
            generationSetDigest: before.generationSetDigest,
          },
          candidate: envelope,
        },
        resolvedAt: context.request.resolvedAt,
      },
    );
  if (append.status === "not_committed") {
    return failureV1(
      "acceptance_compare_append",
      "stale_expected_acceptance",
      append.receipt,
    );
  }
  if (append.status === "rejected") {
    return failureV1(
      "acceptance_compare_append",
      append.reason === "operation_nonce_conflict"
        ? "operation_nonce_conflict"
        : append.reason === "identity_mismatch"
          ? "identity_mismatch"
          : append.reason === "candidate_invalid"
            ? "candidate_invalid"
            : "capability_invalid",
    );
  }
  const pin =
    deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptancePinInternalV1(
      envelope,
    );
  const sourceObjectCount =
    d44.formalPlanEnvelope.payload.completeSourceReadClosure.objectCount;
  const sourceLogicalBytes =
    d44.formalPlanEnvelope.payload.completeSourceReadClosure
      .logicalObjectBytesTotal;
  if (sourceObjectCount < 1) {
    return failureV1("acceptance_compare_append", "candidate_invalid");
  }
  const value = CapturedObjectFreezeV1({
    authority:
      "in_memory_reference_machine_only_no_production_provider_authority_v1" as const,
    durability:
      "in_memory_reference_only_not_a_durable_provider_v1" as const,
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_migration_only_acceptance_reference_validation_v1" as const,
    relationship:
      "committed_d44_publication_strict_migration_only_acceptance_compare_appended_v1" as const,
    formalPlanPublicationClosure: d44,
    migrationOnlyAcceptanceEnvelope: envelope,
    migrationOnlyAcceptancePin: pin,
    acceptanceCompareAppendReceipt: append.receipt,
    acceptanceReferenceState: append.state,
    acceptanceOrdinal,
    configuration,
    acceptedRegistryManifestPin: d44.currentRegistryManifestPin,
    acceptedSupportCatalogPin: d44.currentSupportCatalogPin,
    sourceObjectCount,
    sourceLogicalBytes,
  }) satisfies ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceValidationInternalV1;
  executionContinuationsInternalV1.set(value, CapturedObjectFreezeV1({
    migrationOnlyAcceptance: value,
    compoundPublicationReferenceMachineCapability:
      continuation.compoundPublicationReferenceMachineCapability,
    migrationOnlyAcceptanceReferenceMachineCapability: migrationMachine,
    acceptanceIdentityVerificationCapability:
      context.acceptanceIdentityVerificationCapability,
  }));
  return createProviderNonThenableFrozenRecordV1({ ok: true as const, value });
}

export function diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceCandidateInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceDiagnosticResultInternalV1> {
  return hardenProviderPointPromiseV1(diagnoseInternalV1(input));
}

/** Foreign success identities and replay do not consume another continuation. */
export function takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceExecutionContinuationInternalV1(
  exactD45Success:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceValidationInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceExecutionContinuationInternalV1 | undefined {
  if (exactD45Success === null || typeof exactD45Success !== "object") {
    return undefined;
  }
  const continuation = executionContinuationsInternalV1.get(exactD45Success);
  if (
    continuation === undefined ||
    !executionContinuationsInternalV1.delete(exactD45Success)
  ) return undefined;
  return continuation;
}

for (const exportedFunctionV1 of [
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceCapabilityInternalV1,
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceCandidateInternalV1,
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceExecutionContinuationInternalV1,
]) CapturedObjectFreezeV1(exportedFunctionV1);
