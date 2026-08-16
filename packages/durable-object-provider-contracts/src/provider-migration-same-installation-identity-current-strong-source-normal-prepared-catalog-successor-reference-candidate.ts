/**
 * D-43 same-installation-identity prepared Catalog direct-successor
 * validation/reference candidate.
 *
 * The public seam exposes one none-authority, zero-write result. Capability
 * minting, same-cohort continuation, retained witnesses, external signature
 * sources, and diagnostics remain package-private.
 */

export {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1Schema,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-prepared-catalog-successor-reference-candidate-wire.js";
export type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-prepared-catalog-successor-reference-candidate-wire.js";

import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorRequestReferenceCandidateV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-prepared-catalog-successor-reference-candidate-wire.js";
import {
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCapabilityV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-prepared-catalog-successor-reference-capability-internal.js";
import {
  createProviderNonThenableFrozenRecordV1,
  createProviderPointRejectedPromiseV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";

const CapturedObjectFreezeV1 = Object.freeze;
const CapturedTypeErrorV1 = TypeError;

export interface BuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateV1Input {
  readonly request:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorRequestReferenceCandidateV1;
  readonly preparedCatalogSuccessorReferenceCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCapabilityV1;
}

export class ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationError
  extends CapturedTypeErrorV1 {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super(
      "Provider Migration prepared Catalog successor reference candidate failed",
    );
    this.name =
      "ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationError";
    CapturedObjectFreezeV1(this);
  }
}

async function buildInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1> {
  try {
    const result =
      await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateInternalV1(
        input,
      );
    if (result.ok) {
      return createProviderNonThenableFrozenRecordV1(result.value);
    }
  } catch {
    // Public callers receive only the opaque failure below.
  }
  throw new ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationError();
}

export function buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1> {
  try {
    return hardenProviderPointPromiseV1(buildInternalV1(input));
  } catch {
    return createProviderPointRejectedPromiseV1(
      new ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationError(),
    );
  }
}

CapturedObjectFreezeV1(
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationError,
);
CapturedObjectFreezeV1(
  buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateV1,
);
