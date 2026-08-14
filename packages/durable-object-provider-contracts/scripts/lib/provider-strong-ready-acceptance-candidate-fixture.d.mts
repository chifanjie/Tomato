import type {
  ValidateProviderDistributionHistoryCurrentCandidatePointV1Input,
} from "../../src/provider-distribution-history-current-candidate-point.js";

export type ProviderStrongReadyAcceptanceSingleTargetRawRequestFixtureV1 =
  Omit<
    ValidateProviderDistributionHistoryCurrentCandidatePointV1Input,
    "strictCryptoCapability"
  >;

export type ProviderStrongReadyAcceptanceMultiTargetRawRequestFixtureV1 =
  ProviderStrongReadyAcceptanceSingleTargetRawRequestFixtureV1;

export function buildProviderStrongReadyAcceptanceSingleTargetRawRequestFixture(
  input: Readonly<{
    rootGolden: unknown;
    registryGolden: unknown;
    sourceGolden: unknown;
  }>,
): ProviderStrongReadyAcceptanceSingleTargetRawRequestFixtureV1;

export function buildProviderStrongReadyAcceptanceMultiTargetRawRequestFixture(
  input: Readonly<{
    rootGolden: unknown;
    registryGolden: unknown;
    sourceGolden: unknown;
  }>,
): ProviderStrongReadyAcceptanceMultiTargetRawRequestFixtureV1;
