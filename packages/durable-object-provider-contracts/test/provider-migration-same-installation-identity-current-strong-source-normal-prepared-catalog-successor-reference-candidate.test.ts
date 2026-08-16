import { describe, expect, it } from "vitest";

import * as publicFacadeModuleV1 from "../src/provider-migration-same-installation-identity-current-strong-source-normal-prepared-catalog-successor-reference-candidate.js";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationError,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1Schema,
  buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-prepared-catalog-successor-reference-candidate.js";

describe("D-43 public prepared Catalog successor facade", () => {
  it("maps tampered/unregistered input to one opaque error and exposes exact3 runtime", async () => {
    const operation =
      buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateV1(
        Object.freeze({
          request: Object.freeze({
            profile:
              "provider_migration_same_installation_identity_current_strong_source_normal_prepared_catalog_successor_request_reference_candidate_v1",
            preparedRegistrySuccessorRequest: Object.freeze({}),
            expectedPreparedCatalogPin: Object.freeze({}),
          }),
          preparedCatalogSuccessorReferenceCapability: Object.freeze(
            Object.create(null),
          ),
          unexpected: true,
        }),
      );
    expect(Object.isFrozen(operation)).toBe(true);
    await expect(operation).rejects.toMatchObject({
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });
    let error: unknown;
    try {
      await buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateV1(
        Object.freeze(Object.create(null)),
      );
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationError,
    );
    expect(Object.isFrozen(error)).toBe(true);
    for (const leakedField of [
      "ok",
      "stage",
      "partial",
      "diagnostic",
      "value",
      "cause",
    ]) {
      expect(Object.hasOwn(error as object, leakedField)).toBe(false);
    }
    expect(Object.keys(publicFacadeModuleV1).sort()).toEqual(
      [
        "ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationError",
        "ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1Schema",
        "buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateV1",
      ].sort(),
    );
    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1Schema,
    ).toBeDefined();
  });
});
