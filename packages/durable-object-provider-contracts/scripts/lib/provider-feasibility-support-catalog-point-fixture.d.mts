import type {
  ProviderFeasibilityOwnerTargetCapabilityV1,
  ProviderFeasibilityPublicSupportV1,
  ProviderFeasibilityReleaseDispositionV1,
  ProviderFeasibilitySupportCandidateArtifactV1,
  ProviderFeasibilitySupportCandidateV1,
  ProviderFeasibilitySupportCatalogEnvelopeV1,
  ProviderFeasibilitySupportCatalogPinV1,
  ValidateProviderFeasibilitySupportCatalogPointClosureV1Input,
} from "../../src/provider-feasibility-support-catalog-point.js";
import type {
  ProviderFeasibilityApproverPublicKeyV1,
} from "../../src/provider-registry-records.js";
import type {
  ProviderFeasibilityTargetV1,
} from "../../src/provider-target-discovery-point.js";

interface ProviderFeasibilitySupportCatalogFixtureDiscoveryV1 {
  readonly activeRoot:
    ValidateProviderFeasibilitySupportCatalogPointClosureV1Input["activeRoot"];
}

interface ProviderFeasibilitySupportCatalogFixtureCompatibleV1 {
  readonly qaApproverPublicKey: ProviderFeasibilityApproverPublicKeyV1;
  readonly releaseApproverPublicKey: ProviderFeasibilityApproverPublicKeyV1;
}

export type ProviderFeasibilitySupportCatalogPositiveVectorIdFixtureV1 =
  | "both-passed-strong"
  | "second-passed-read-only"
  | "second-failed-read-only"
  | "second-unsupported-read-only";

export type ProviderFeasibilitySupportCatalogInvalidMaterializedCaseIdFixtureV1 =
  | "catalog-target-missing"
  | "catalog-target-extra"
  | "catalog-target-duplicate"
  | "catalog-provider-duplicate"
  | "catalog-evidence-cross-group"
  | "catalog-failed-strong"
  | "catalog-unsupported-strong";

interface ProviderFeasibilitySupportCatalogPositiveVectorFixtureV1 {
  readonly vectorId:
    ProviderFeasibilitySupportCatalogPositiveVectorIdFixtureV1;
  readonly providerFeasibilitySupportCatalog:
    ProviderFeasibilitySupportCatalogEnvelopeV1;
  readonly providerFeasibilitySupportCatalogPin:
    ProviderFeasibilitySupportCatalogPinV1;
  readonly providerFeasibilitySupportCandidateArtifacts:
    readonly ProviderFeasibilitySupportCandidateArtifactV1[];
  readonly expected: {
    readonly authority:
      "none_provider_feasibility_support_catalog_structure_only";
    readonly ownerTargetCapabilities:
      readonly ProviderFeasibilityOwnerTargetCapabilityV1[];
    readonly publicSupport:
      readonly ProviderFeasibilityPublicSupportV1[];
  };
}

interface GoldenProviderFeasibilitySupportCatalogPointFixtureV1 {
  readonly compatible:
    ProviderFeasibilitySupportCatalogFixtureCompatibleV1;
  readonly discovery: ProviderFeasibilitySupportCatalogFixtureDiscoveryV1;
  readonly providerFeasibilitySupportCatalog:
    ProviderFeasibilitySupportCatalogEnvelopeV1;
  readonly providerFeasibilitySupportCatalogPin:
    ProviderFeasibilitySupportCatalogPinV1;
  readonly providerFeasibilitySupportCandidateArtifacts:
    readonly ProviderFeasibilitySupportCandidateArtifactV1[];
  readonly positiveVectors:
    readonly ProviderFeasibilitySupportCatalogPositiveVectorFixtureV1[];
  readonly expected: {
    readonly authority:
      "none_provider_feasibility_support_catalog_structure_only";
    readonly ownerTargetCapabilities:
      readonly ProviderFeasibilityOwnerTargetCapabilityV1[];
    readonly publicSupport:
      readonly ProviderFeasibilityPublicSupportV1[];
  };
}

interface BuildProviderFeasibilitySupportCandidateFixtureOptionsV1 {
  readonly discovery: ProviderFeasibilitySupportCatalogFixtureDiscoveryV1;
  readonly targetProfileId: ProviderFeasibilityTargetV1["targetProfileId"];
  readonly qaApproverPublicKey: ProviderFeasibilityApproverPublicKeyV1;
  readonly releaseApproverPublicKey:
    ProviderFeasibilityApproverPublicKeyV1;
  readonly providerId?: ProviderFeasibilitySupportCandidateV1["providerId"];
  readonly result?: "passed" | "failed" | "unsupported";
  readonly releaseDisposition?: ProviderFeasibilityReleaseDispositionV1;
  readonly rootSeedHex?: string;
}

interface ProviderFeasibilitySupportCandidateFixtureV1 {
  readonly catalogCandidate: ProviderFeasibilitySupportCandidateV1;
  readonly candidateArtifact: ProviderFeasibilitySupportCandidateArtifactV1;
}

export function jsonClone<T>(value: T): T;

export function buildGoldenProviderFeasibilitySupportCatalogPointFixture(
  input: Readonly<{
    rootGolden: unknown;
    registryGolden: unknown;
    sourceGolden: unknown;
  }>,
): GoldenProviderFeasibilitySupportCatalogPointFixtureV1;

export function buildProviderFeasibilitySupportCandidateFixture(
  options: BuildProviderFeasibilitySupportCandidateFixtureOptionsV1,
): ProviderFeasibilitySupportCandidateFixtureV1;

export function requestFromGoldenProviderFeasibilitySupportCatalogPointFixture(
  golden: GoldenProviderFeasibilitySupportCatalogPointFixtureV1,
  strictCryptoCapability:
    ValidateProviderFeasibilitySupportCatalogPointClosureV1Input["strictCryptoCapability"],
): ValidateProviderFeasibilitySupportCatalogPointClosureV1Input;

export function requestFromGoldenProviderFeasibilitySupportCatalogPositiveVectorFixture(
  golden: GoldenProviderFeasibilitySupportCatalogPointFixtureV1,
  vectorId: ProviderFeasibilitySupportCatalogPositiveVectorIdFixtureV1,
  strictCryptoCapability:
    ValidateProviderFeasibilitySupportCatalogPointClosureV1Input["strictCryptoCapability"],
): ValidateProviderFeasibilitySupportCatalogPointClosureV1Input;

export function resignProviderFeasibilitySupportCatalogEnvelopeFixture(
  envelope: ProviderFeasibilitySupportCatalogEnvelopeV1,
  options: Readonly<{
    rootKeyId:
      ValidateProviderFeasibilitySupportCatalogPointClosureV1Input["activeRoot"]["rootKeyId"];
    rootSeedHex?: string;
  }>,
): ProviderFeasibilitySupportCatalogEnvelopeV1;

export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POSITIVE_VECTOR_IDS:
  readonly ProviderFeasibilitySupportCatalogPositiveVectorIdFixtureV1[];

export const PROVIDER_FEASIBILITY_SUPPORT_CATALOG_INVALID_MATERIALIZED_CASE_IDS:
  readonly ProviderFeasibilitySupportCatalogInvalidMaterializedCaseIdFixtureV1[];

export function buildProviderFeasibilitySupportCatalogInvalidMaterializedRequestCaseFixture(
  golden: GoldenProviderFeasibilitySupportCatalogPointFixtureV1,
  caseId:
    ProviderFeasibilitySupportCatalogInvalidMaterializedCaseIdFixtureV1,
): Readonly<{
  caseId: ProviderFeasibilitySupportCatalogInvalidMaterializedCaseIdFixtureV1;
  request: Omit<
    ValidateProviderFeasibilitySupportCatalogPointClosureV1Input,
    "strictCryptoCapability"
  >;
  expected: Readonly<{ stage: string; reason: string }>;
}>;

export function buildProviderFeasibilitySupportCatalogInvalidMaterializedRequestCasesFixture(
  golden: GoldenProviderFeasibilitySupportCatalogPointFixtureV1,
): readonly ReturnType<
  typeof buildProviderFeasibilitySupportCatalogInvalidMaterializedRequestCaseFixture
>[];
