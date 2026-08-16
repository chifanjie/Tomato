import type {
  ValidateProviderDistributionHistoryCurrentCandidatePointV1Input,
} from "../../src/provider-distribution-history-current-candidate-point.js";
import type {
  ProviderFeasibilitySupportCatalogEnvelopeV1,
  ProviderFeasibilitySupportCatalogPinV1,
} from "../../src/provider-feasibility-support-catalog-point.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSignedProspectiveDestinationFixtureV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-closure-reference-candidate-fixture.mjs";
import type {
  ProviderRegistryManifestEnvelopeV1,
  ProviderRegistryManifestPinV1,
} from "../../src/provider-registry-records.js";
import type {
  DurableObjectIdentityProviderIdV1,
  ProviderMigrationIdV1,
} from "../../src/primitives.js";

type RawDistributionV1 = Omit<
  ValidateProviderDistributionHistoryCurrentCandidatePointV1Input,
  "strictCryptoCapability"
>;

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedRegistrySuccessorFixtureV1 {
  readonly envelope: ProviderRegistryManifestEnvelopeV1;
  readonly pin: ProviderRegistryManifestPinV1;
  readonly currentSteadyRegistryManifestEnvelope:
    ProviderRegistryManifestEnvelopeV1;
  readonly formalMigrationId: ProviderMigrationIdV1;
  readonly sourceProviderId: DurableObjectIdentityProviderIdV1;
  readonly destinationProviderId: DurableObjectIdentityProviderIdV1;
  readonly invalidSignature: boolean;
}

export function buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedRegistrySuccessorFixture(
  input: Readonly<{
    distributionRawRequest: RawDistributionV1;
    prospectiveDestination:
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSignedProspectiveDestinationFixtureV1;
    formalMigrationId: ProviderMigrationIdV1;
    invalidSignature?: boolean;
  }>,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedRegistrySuccessorFixtureV1;

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedRebindingRegistrySuccessorFixtureV1 {
  readonly envelope: ProviderRegistryManifestEnvelopeV1;
  readonly pin: ProviderRegistryManifestPinV1;
  readonly currentPreparedRegistryManifestEnvelope:
    ProviderRegistryManifestEnvelopeV1;
  readonly formalMigrationId: ProviderMigrationIdV1;
  readonly sourceProviderId: DurableObjectIdentityProviderIdV1;
  readonly destinationProviderId: DurableObjectIdentityProviderIdV1;
  readonly invalidSignature: boolean;
}

export function buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedRebindingRegistrySuccessorFixture(
  input: Readonly<{
    currentPreparedRegistryManifestEnvelope:
      ProviderRegistryManifestEnvelopeV1;
    invalidSignature?: boolean;
  }>,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedRebindingRegistrySuccessorFixtureV1;

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSourceDrainedRegistrySuccessorFixtureV1 {
  readonly envelope: ProviderRegistryManifestEnvelopeV1;
  readonly pin: ProviderRegistryManifestPinV1;
  readonly currentRebindingRegistryManifestEnvelope:
    ProviderRegistryManifestEnvelopeV1;
  readonly formalMigrationId: ProviderMigrationIdV1;
  readonly sourceProviderId: DurableObjectIdentityProviderIdV1;
  readonly destinationProviderId: DurableObjectIdentityProviderIdV1;
  readonly invalidSignature: boolean;
}

export function buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSourceDrainedRegistrySuccessorFixture(
  input: Readonly<{
    currentRebindingRegistryManifestEnvelope:
      ProviderRegistryManifestEnvelopeV1;
    invalidSignature?: boolean;
  }>,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSourceDrainedRegistrySuccessorFixtureV1;

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSteadyRegistrySuccessorFixtureV1 {
  readonly envelope: ProviderRegistryManifestEnvelopeV1;
  readonly pin: ProviderRegistryManifestPinV1;
  readonly currentSourceDrainedRegistryManifestEnvelope:
    ProviderRegistryManifestEnvelopeV1;
  readonly formalMigrationId: ProviderMigrationIdV1;
  readonly sourceProviderId: DurableObjectIdentityProviderIdV1;
  readonly destinationProviderId: DurableObjectIdentityProviderIdV1;
  readonly invalidSignature: boolean;
}

export function buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSteadyRegistrySuccessorFixture(
  input: Readonly<{
    currentSourceDrainedRegistryManifestEnvelope:
      ProviderRegistryManifestEnvelopeV1;
    invalidSignature?: boolean;
  }>,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSteadyRegistrySuccessorFixtureV1;

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedCatalogSuccessorFixtureV1 {
  readonly envelope: ProviderFeasibilitySupportCatalogEnvelopeV1;
  readonly pin: ProviderFeasibilitySupportCatalogPinV1;
  readonly currentSupportCatalogEnvelope:
    ProviderFeasibilitySupportCatalogEnvelopeV1;
  readonly destinationProviderId: DurableObjectIdentityProviderIdV1;
  readonly invalidSignature: boolean;
}

export function buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedCatalogSuccessorFixture(
  input: Readonly<{
    distributionRawRequest: RawDistributionV1;
    prospectiveDestination:
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSignedProspectiveDestinationFixtureV1;
    invalidSignature?: boolean;
  }>,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedCatalogSuccessorFixtureV1;
