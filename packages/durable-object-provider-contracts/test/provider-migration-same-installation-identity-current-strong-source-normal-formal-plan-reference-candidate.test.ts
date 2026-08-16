import { describe, expect, it } from "vitest";

import * as publicFacadeModuleV1 from "../src/provider-migration-same-installation-identity-current-strong-source-normal-formal-plan-reference-candidate.js";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationError,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationV1Schema,
  buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-formal-plan-reference-candidate.js";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationDescriptorReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1Schema,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationIdV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-formal-plan-reference-candidate-wire.js";

function digestV1(character: string) {
  return `sha256:${character.repeat(64)}` as const;
}

describe("D-44 branch-specific formal Plan/Pin reference candidate", () => {
  it("derives the formal reservation descriptor and keeps the public runtime exact3", () => {
    const fields = {
      formalMigrationId: `provider-migration:${"a".repeat(22)}` as const,
      role: "same_identity_journal" as const,
      installationIdentityGenerationId:
        `installation-identity-generation:${"b".repeat(22)}` as const,
      admissionVectorDigest: digestV1("c"),
    };
    const reservationId =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationIdV1(
        fields,
      );
    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalHistoryQuotaReservationDescriptorReferenceCandidateV1Schema.parse(
        {
          profile:
            "provider_migration_same_installation_identity_current_strong_source_normal_formal_history_quota_reservation_descriptor_reference_candidate_v1",
          locatorProfile:
            "provider_migration_same_installation_identity_current_strong_source_normal_formal_history_quota_reservation_reference_candidate_v1",
          reservationId,
          ...fields,
        },
      ).reservationId,
    ).toBe(reservationId);
    expect(Object.keys(publicFacadeModuleV1).sort()).toEqual(
      [
        "ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationError",
        "ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationV1Schema",
        "buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateV1",
      ].sort(),
    );
  });

  it("rejects detached/tampered Plan-Pin projections and exposes one opaque error", async () => {
    const formalPlanPin =
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPinReferenceCandidateV1Schema.parse(
        {
          locatorProfile:
            "provider_migration_same_installation_identity_current_strong_source_normal_formal_plan_reference_candidate_v1",
          formalMigrationId: `provider-migration:${"a".repeat(22)}`,
          contentDigest: digestV1("d"),
        },
      );
    const tamperedProjection = Object.freeze({
      relationship:
        "formal_plan_and_pin_constructed_not_published_or_reserved",
      formalPlanEnvelope: Object.freeze({
        contentDigest: digestV1("e"),
      }),
      formalPlanPin,
    });
    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationV1Schema.safeParse(
        tamperedProjection,
      ).success,
    ).toBe(false);
    let error: unknown;
    try {
      await buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateV1(
        tamperedProjection,
      );
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateValidationError,
    );
    expect(Object.isFrozen(error)).toBe(true);
    expect(error).toMatchObject({
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });
    for (const leakedField of ["stage", "diagnostic", "value", "cause"]) {
      expect(Object.hasOwn(error as object, leakedField)).toBe(false);
    }
  });
});
