/**
 * Package-private final destination strong-ready Acceptance candidate.
 *
 * The candidate is branch-specific: its activation binds the exact terminal
 * migration seal. Building it does not append Acceptance state or grant a
 * writer capability.
 */

import {
  type ContentDigestV1,
  type InstallationIdentityGenerationIdV1,
  type ProviderMigrationIdV1,
} from "./primitives.js";
import type {
  ProviderFeasibilitySupportCatalogPinV1,
} from "./provider-feasibility-support-catalog-point.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-formal-plan-reference-candidate-wire.js";
import {
  deepFreezeProviderPointDetachedDataTreeV1,
} from "./provider-point-raw-admission-internal.js";
import type {
  ProviderRegistryManifestPinV1,
} from "./provider-registry-records.js";
import type {
  ProviderRegistryRootMetadataPinV1,
} from "./provider-registry-trust.js";
import {
  ProviderActiveWriterSelectorV1Schema,
  ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema,
  ProviderStrongReadyAcceptanceStateCandidateV1Schema,
  ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
  ProviderStrongReadyAcceptanceStateUnsignedCandidateV1Schema,
  deriveProviderActiveWriterSelectorContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
  type ProviderAcceptancePredecessorV1,
  type ProviderActiveWriterSelectionV1,
  type ProviderActiveWriterSelectorV1,
  type ProviderStrongReadyAcceptanceGenerationPinCandidateV1,
  type ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
} from "./provider-strong-ready-acceptance-candidate.js";
import {
  deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1,
  getProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInstallationIdentityGenerationIdInternalV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
} from "./provider-strong-ready-bootstrap-or-steady-acceptance-identity-verification-capability-internal.js";
import {
  ProviderRegistryIsoTimestampV1Schema,
} from "./provider-registry-trust.js";

const CapturedObjectFreezeV1 = Object.freeze;
const CapturedTypeErrorV1 = TypeError;

export interface BuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCandidateInternalV1Input {
  readonly identityVerificationCapability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
  readonly installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1;
  readonly acceptanceOrdinal: number;
  readonly predecessor: ProviderAcceptancePredecessorV1;
  readonly acceptedAt: ReturnType<typeof ProviderRegistryIsoTimestampV1Schema.parse>;
  readonly activeRootMetadata: ProviderRegistryRootMetadataPinV1;
  readonly steadyRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly currentSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1;
  readonly destinationActiveWriterSelection:
    ProviderActiveWriterSelectionV1;
  readonly formalMigrationId: ProviderMigrationIdV1;
  readonly formalPlanPin:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1;
  readonly terminalProgressReceiptContentDigest: ContentDigestV1;
  readonly terminalJournalReceiptContentDigest: ContentDigestV1;
  readonly sourceTombstoneRecordContentDigest: ContentDigestV1;
  readonly readyToActivateRecordContentDigest: ContentDigestV1;
  readonly sealedProgressHeadContentDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCandidateValidationInternalV1 {
  readonly authority: "none";
  readonly durability: "none";
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_final_strong_ready_acceptance_candidate_validation_v1";
  readonly relationship: "exact_terminal_sealed_destination_only_strong_ready_acceptance_candidate_not_appended_v1";
  readonly formalMigrationId: ProviderMigrationIdV1;
  readonly formalPlanPin:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1;
  readonly activeWriterSelector: ProviderActiveWriterSelectorV1;
  readonly activeWriterSelectorContentDigest: ContentDigestV1;
  readonly acceptanceStateEnvelope:
    ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1;
  readonly acceptanceGenerationPin:
    ProviderStrongReadyAcceptanceGenerationPinCandidateV1;
  readonly destinationOnlyPublicStrongWriter: true;
  readonly acceptanceAppendCount: 0;
}

export async function buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCandidateInternalV1(
  input:
    BuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCandidateInternalV1Input,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCandidateValidationInternalV1> {
  const identity =
    getProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInstallationIdentityGenerationIdInternalV1(
      input.identityVerificationCapability,
    );
  if (
    identity !== input.installationIdentityGenerationId ||
    input.formalPlanPin.formalMigrationId !== input.formalMigrationId ||
    input.acceptanceOrdinal < 1 ||
    !Number.isSafeInteger(input.acceptanceOrdinal)
  ) throw new CapturedTypeErrorV1(
    "final strong-ready Acceptance candidate identity/binding invalid",
  );
  const activeWriterSelector = deepFreezeProviderPointDetachedDataTreeV1(
    ProviderActiveWriterSelectorV1Schema.parse({
      profile: "provider_active_writer_selector_v1",
      selections: [input.destinationActiveWriterSelection],
    }),
  );
  const activeWriterSelectorContentDigest =
    deriveProviderActiveWriterSelectorContentDigestV1(activeWriterSelector);
  const configuration = deepFreezeProviderPointDetachedDataTreeV1({
    state: "strong_ready" as const,
    core: {
      activeRootMetadata: input.activeRootMetadata,
      providerRegistryManifest: input.steadyRegistryManifestPin,
      providerSupportCatalog: input.currentSupportCatalogPin,
      activeWriterSelector,
    },
    activation: {
      origin: "provider_migration_terminal_sealed_success_v1" as const,
      formalMigrationId: input.formalMigrationId,
      formalPlanPin: input.formalPlanPin,
      terminalProgressReceiptContentDigest:
        input.terminalProgressReceiptContentDigest,
      terminalJournalReceiptContentDigest:
        input.terminalJournalReceiptContentDigest,
      sourceTombstoneRecordContentDigest:
        input.sourceTombstoneRecordContentDigest,
      readyToActivateRecordContentDigest:
        input.readyToActivateRecordContentDigest,
      sealedProgressHeadContentDigest:
        input.sealedProgressHeadContentDigest,
    },
  });
  const generationId = deriveProviderStrongReadyAcceptanceStateGenerationIdV1({
    installationIdentityGenerationId: identity,
    acceptanceOrdinal: input.acceptanceOrdinal,
    predecessor: input.predecessor,
    configuration,
  });
  const acceptedAt = ProviderRegistryIsoTimestampV1Schema.parse(
    input.acceptedAt,
  );
  const unsigned = ProviderStrongReadyAcceptanceStateUnsignedCandidateV1Schema.parse({
    profile: "provider_acceptance_state_v1",
    generationId,
    installationIdentityGenerationId: identity,
    acceptanceOrdinal: input.acceptanceOrdinal,
    predecessor: input.predecessor,
    configuration,
    acceptedAt,
  });
  const acceptanceToken =
    await deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
      input.identityVerificationCapability,
      identity,
      unsigned,
    );
  const state = ProviderStrongReadyAcceptanceStateCandidateV1Schema.parse({
    ...unsigned,
    acceptanceToken,
  });
  const contentDigest =
    deriveProviderStrongReadyAcceptanceStateContentDigestV1(state);
  const acceptanceStateEnvelope =
    deepFreezeProviderPointDetachedDataTreeV1(
      ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema.parse({
        schemaVersion: 1,
        recordType: "provider_acceptance_state",
        generationId,
        installationIdentityGenerationId: identity,
        acceptedAt,
        contentDigest,
        payload: state,
      }),
    );
  const acceptanceGenerationPin =
    deepFreezeProviderPointDetachedDataTreeV1(
      ProviderStrongReadyAcceptanceGenerationPinCandidateV1Schema.parse({
        locatorProfile: "installation_provider_acceptance_state_v1",
        acceptanceOrdinal: input.acceptanceOrdinal,
        generationId,
        contentDigest,
      }),
    );
  return CapturedObjectFreezeV1({
    authority: "none" as const,
    durability: "none" as const,
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_final_strong_ready_acceptance_candidate_validation_v1" as const,
    relationship:
      "exact_terminal_sealed_destination_only_strong_ready_acceptance_candidate_not_appended_v1" as const,
    formalMigrationId: input.formalMigrationId,
    formalPlanPin: input.formalPlanPin,
    activeWriterSelector,
    activeWriterSelectorContentDigest,
    acceptanceStateEnvelope,
    acceptanceGenerationPin,
    destinationOnlyPublicStrongWriter: true as const,
    acceptanceAppendCount: 0 as const,
  });
}

CapturedObjectFreezeV1(
  buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalStrongReadyAcceptanceCandidateInternalV1,
);
