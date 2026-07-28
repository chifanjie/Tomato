import { describe, expect, it } from "vitest";
import {
  CompatibilityDecisionV1Schema,
  decideLegacyCompatibility,
  type DecideLegacyCompatibilityOptions,
} from "../src/compatibility.js";
import {
  LEGACY_RAW_ARTIFACT_DESCRIPTORS_V1,
  type LegacyRawArtifactDescriptorV1,
} from "../src/descriptors.js";
import type { MigrationStepV1 } from "../src/migration.js";

const graphDescriptor = LEGACY_RAW_ARTIFACT_DESCRIPTORS_V1[0];
const diffDescriptor = LEGACY_RAW_ARTIFACT_DESCRIPTORS_V1.at(-1)!;
const graphMigrationRegistry: readonly MigrationStepV1[] = [
  {
    format: "graph_v1",
    fromVersion: "0.9.0",
    toVersion: "1.0.0",
    migrate: (input) => input,
  },
];

describe("legacy compatibility decisions", () => {
  it("allows an exact active legacy version under its explicit write policy", () => {
    const decision = decideLegacyCompatibility(graphDescriptor, {
      observedVersion: "1.0.0",
    });
    expect(CompatibilityDecisionV1Schema.safeParse(decision).success).toBe(true);
    expect(decision).toMatchObject({
      status: "legacy_readable",
      readable: true,
      writable: true,
    });
  });

  it("never promotes historical Diff Overlay to an active writable source", () => {
    expect(
      decideLegacyCompatibility(diffDescriptor, { observedVersion: "1.0.0" }),
    ).toMatchObject({
      status: "read_only_recovery",
      reason: "historical_artifact",
      readable: true,
      writable: false,
    });
  });

  it("requires an explicitly registered migration for version mismatches", () => {
    expect(
      decideLegacyCompatibility(graphDescriptor, { observedVersion: "0.9.0" }),
    ).toMatchObject({
      status: "unsupported_version",
      readable: false,
      writable: false,
    });
    expect(
      decideLegacyCompatibility(graphDescriptor, {
        observedVersion: "0.9.0",
        migration: {
          targetVersion: "1.0.0",
          registry: graphMigrationRegistry,
        },
      }),
    ).toMatchObject({
      status: "migration_required",
      readable: true,
      writable: false,
      targetVersion: "1.0.0",
    });
  });

  it("does not trust a forged registration boolean or an unrelated migration path", () => {
    const forgedRegistration = {
      observedVersion: "0.9.0",
      hasRegisteredMigration: true,
      migrationTargetVersion: "1.0.0",
    } as unknown as DecideLegacyCompatibilityOptions;
    expect(
      decideLegacyCompatibility(graphDescriptor, forgedRegistration),
    ).toMatchObject({
      status: "unsupported_version",
      readable: false,
      writable: false,
    });

    expect(
      decideLegacyCompatibility(graphDescriptor, {
        observedVersion: "0.9.0",
        migration: {
          targetVersion: "1.0.0",
          registry: [
            {
              ...graphMigrationRegistry[0]!,
              format: "diff_overlay_v1",
            },
          ],
        },
      }),
    ).toMatchObject({
      status: "unsupported_version",
      readable: false,
      writable: false,
    });
  });

  it("fails closed when a legacy descriptor cross-wires registered identities", () => {
    const forgedDescriptor = {
      ...diffDescriptor,
      readPolicy: "legacy_read_write",
    } as unknown as LegacyRawArtifactDescriptorV1;

    expect(
      decideLegacyCompatibility(forgedDescriptor, {
        observedVersion: "1.0.0",
      }),
    ).toMatchObject({
      status: "invalid",
      reason: "invalid_descriptor",
      readable: false,
      writable: false,
    });
  });
});
