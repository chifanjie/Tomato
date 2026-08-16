/**
 * D-44 same-installation-identity branch-specific formal Plan/Pin reference
 * candidate. This facade constructs no reservation record or token and
 * publishes no Registry, Catalog, Plan, or Acceptance artifact.
 */

export {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationV1Schema,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-formal-plan-reference-candidate-wire.js";
export type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-formal-plan-reference-candidate-wire.js";

import {
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-formal-plan-reference-candidate-wire.js";
import {
  createProviderNonThenableFrozenRecordV1,
  createProviderPointRejectedPromiseV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";

const CapturedObjectFreezeV1 = Object.freeze;
const CapturedTypeErrorV1 = TypeError;

export class ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationError
  extends CapturedTypeErrorV1 {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super("Provider Migration formal Plan reference candidate failed");
    this.name =
      "ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationError";
    CapturedObjectFreezeV1(this);
  }
}

async function buildInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationV1> {
  try {
    return createProviderNonThenableFrozenRecordV1(
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateV1(
        input,
      ),
    );
  } catch {
    throw new ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationError();
  }
}

export function buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationV1> {
  try {
    return hardenProviderPointPromiseV1(buildInternalV1(input));
  } catch {
    return createProviderPointRejectedPromiseV1(
      new ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationError(),
    );
  }
}

CapturedObjectFreezeV1(
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationError,
);
CapturedObjectFreezeV1(
  buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateV1,
);
