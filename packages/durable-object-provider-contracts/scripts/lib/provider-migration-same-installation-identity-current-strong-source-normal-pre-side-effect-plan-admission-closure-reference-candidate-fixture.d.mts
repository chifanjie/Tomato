import type {
  ProviderFeasibilityEvidenceEnvelopeV1,
} from "../../src/provider-feasibility-evidence-point.js";
import type {
  ProviderFeasibilitySupportCandidateV1,
} from "../../src/provider-feasibility-support-catalog-point.js";
import type {
  ValidateProviderDistributionHistoryCurrentCandidatePointV1Input,
} from "../../src/provider-distribution-history-current-candidate-point.js";
import type {
  ProviderRealFilesystemConformanceResultEnvelopeV1,
} from "../../src/provider-real-filesystem-conformance-result.js";
import type {
  StoreDurableObjectProviderRegistryEntryV1,
} from "../../src/provider-registry-records.js";
import type {
  DurableObjectIdentityProviderIdV1,
  ProviderTargetProfileIdV1,
} from "../../src/primitives.js";
import type {
  ProviderFeasibilityTargetV1,
} from "../../src/provider-target-discovery-point.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationEvidenceValidationSourceInternalV1,
} from "../../src/provider-migration-same-installation-identity-current-strong-source-normal-endpoint-trust-capability-internal.js";

type RawDistributionV1 = Omit<
  ValidateProviderDistributionHistoryCurrentCandidatePointV1Input,
  "strictCryptoCapability"
>;

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSignedProspectiveDestinationFixtureV1 {
  readonly providerId: DurableObjectIdentityProviderIdV1;
  readonly targetOrdinal: number;
  readonly target: ProviderFeasibilityTargetV1 & {
    readonly targetProfileId: ProviderTargetProfileIdV1;
  };
  readonly prospectiveRegistryEntry:
    StoreDurableObjectProviderRegistryEntryV1;
  readonly prospectiveRegistryEntryContentDigest: string;
  readonly prospectiveSupportCandidate:
    ProviderFeasibilitySupportCandidateV1;
  readonly evidenceEnvelope: ProviderFeasibilityEvidenceEnvelopeV1;
  readonly realFilesystemConformanceResult:
    ProviderRealFilesystemConformanceResultEnvelopeV1;
  readonly evidenceValidationSource:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationEvidenceValidationSourceInternalV1;
}

export function buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSignedProspectiveDestinationFixture(
  input: Readonly<{
    distributionRawRequest: RawDistributionV1;
    targetOrdinal?: number;
    providerId?: DurableObjectIdentityProviderIdV1;
    materialAliasPublicKeyBytes?: string;
  }>,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSignedProspectiveDestinationFixtureV1;
