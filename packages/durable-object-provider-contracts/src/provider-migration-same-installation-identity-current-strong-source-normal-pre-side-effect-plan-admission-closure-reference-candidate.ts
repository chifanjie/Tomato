/**
 * D-41 same-installation-identity current-strong-source normal
 * pre-side-effect Plan/admission closure/reference candidate.
 *
 * This public seam exposes a none-authority, zero-side-effect validation
 * candidate.  Capability minting, diagnostics, and reference machines remain
 * package-private.
 */

export {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1Schema,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-reference-candidate-wire.js";
export type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-reference-candidate-wire.js";

import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestReferenceCandidateV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-reference-candidate-wire.js";
import {
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-pre-plan-reference-capability-internal.js";
import {
  createProviderNonThenableFrozenRecordV1,
  createProviderPointRejectedPromiseV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";

const CapturedObjectFreezeV1 = Object.freeze;
const CapturedTypeErrorV1 = TypeError;

export type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityV1,
};

export interface BuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1Input {
  readonly request:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectRequestReferenceCandidateV1;
  readonly prePlanReferenceCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityV1;
}

export class ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationError
  extends CapturedTypeErrorV1 {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super(
      "Provider Migration pre-side-effect Plan/admission closure/reference candidate failed",
    );
    this.name =
      "ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationError";
    CapturedObjectFreezeV1(this);
  }
}

async function buildInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1> {
  try {
    const result =
      await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1(
        input,
    );
    if (result.ok) {
      return createProviderNonThenableFrozenRecordV1(result.value);
    }
  } catch {
    // Public callers receive only the opaque failure below.
  }
  throw new ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationError();
}

export function buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1> {
  try {
    return hardenProviderPointPromiseV1(buildInternalV1(input));
  } catch {
    return createProviderPointRejectedPromiseV1(
      new ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationError(),
    );
  }
}

CapturedObjectFreezeV1(
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationError,
);
CapturedObjectFreezeV1(
  buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1,
);
