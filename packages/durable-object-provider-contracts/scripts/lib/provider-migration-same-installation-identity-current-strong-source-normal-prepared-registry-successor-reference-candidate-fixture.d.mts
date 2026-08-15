import type {
  ValidateProviderDistributionHistoryCurrentCandidatePointV1Input,
} from "../../src/provider-distribution-history-current-candidate-point.js";
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
