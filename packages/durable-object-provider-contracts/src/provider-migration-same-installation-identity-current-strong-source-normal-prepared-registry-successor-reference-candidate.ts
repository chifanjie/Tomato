/**
 * D-42 same-installation-identity prepared Registry direct-successor
 * validation/reference candidate.
 *
 * The public seam exposes one none-authority, zero-write result. Capability
 * minting, retained-cohort continuation, external signature sources, and
 * diagnostics remain package-private.
 */

export {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1Schema,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-reference-candidate-wire.js";
export type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-reference-candidate-wire.js";

import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorRequestReferenceCandidateV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-reference-candidate-wire.js";
import {
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-reference-capability-internal.js";
import {
  createProviderNonThenableFrozenRecordV1,
  createProviderPointRejectedPromiseV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";

const CapturedObjectFreezeV1 = Object.freeze;
const CapturedTypeErrorV1 = TypeError;

export interface BuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateV1Input {
  readonly request:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorRequestReferenceCandidateV1;
  readonly preparedRegistrySuccessorReferenceCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityV1;
}

export class ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationError
  extends CapturedTypeErrorV1 {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super(
      "Provider Migration prepared Registry successor reference candidate failed",
    );
    this.name =
      "ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationError";
    CapturedObjectFreezeV1(this);
  }
}

async function buildInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1> {
  try {
    const result =
      await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateInternalV1(
        input,
      );
    if (result.ok) {
      return createProviderNonThenableFrozenRecordV1(result.value);
    }
  } catch {
    // Public callers receive only the opaque failure below.
  }
  throw new ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationError();
}

export function buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1> {
  try {
    return hardenProviderPointPromiseV1(buildInternalV1(input));
  } catch {
    return createProviderPointRejectedPromiseV1(
      new ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationError(),
    );
  }
}

CapturedObjectFreezeV1(
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationError,
);
CapturedObjectFreezeV1(
  buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateV1,
);
