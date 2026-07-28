import { z } from "zod";
import {
  LegacyRawArtifactDescriptorV1Schema,
  type LegacyRawArtifactDescriptorV1,
} from "./descriptors.js";
import { planMigrationV1, type MigrationStepV1 } from "./migration.js";

export const CompatibilityStatusV1Schema = z.enum([
  "legacy_readable",
  "migration_required",
  "read_only_recovery",
  "unsupported_version",
  "invalid",
]);

export const CompatibilityReasonV1Schema = z.enum([
  "exact_legacy_version",
  "registered_migration",
  "historical_artifact",
  "version_mismatch",
  "invalid_descriptor",
]);

export const CompatibilityDecisionV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  status: CompatibilityStatusV1Schema,
  reason: CompatibilityReasonV1Schema,
  readable: z.boolean(),
  writable: z.boolean(),
  sourceVersion: z.string().min(1).max(64),
  targetVersion: z.string().min(1).max(64).optional(),
  warnings: z.array(z.string().min(1).max(4_096)),
});

export interface DecideLegacyCompatibilityOptions {
  observedVersion: string;
  migration?: {
    targetVersion: string;
    registry: readonly MigrationStepV1[];
  };
}

export function decideLegacyCompatibility(
  descriptor: LegacyRawArtifactDescriptorV1,
  options: DecideLegacyCompatibilityOptions,
): CompatibilityDecisionV1 {
  const descriptorResult = LegacyRawArtifactDescriptorV1Schema.safeParse(descriptor);
  if (!descriptorResult.success) {
    return {
      schemaVersion: 1,
      status: "invalid",
      reason: "invalid_descriptor",
      readable: false,
      writable: false,
      sourceVersion: options.observedVersion,
      warnings: ["Legacy artifact descriptor failed strict validation."],
    };
  }

  const registeredDescriptor = descriptorResult.data;
  const exactVersion =
    options.observedVersion === registeredDescriptor.schemaVersion;
  if (exactVersion) {
    const historical =
      registeredDescriptor.readPolicy === "historical_read_only";
    return {
      schemaVersion: 1,
      status: historical ? "read_only_recovery" : "legacy_readable",
      reason: historical ? "historical_artifact" : "exact_legacy_version",
      readable: true,
      writable: registeredDescriptor.readPolicy === "legacy_read_write",
      sourceVersion: options.observedVersion,
      warnings: historical
        ? ["Historical artifact is not an active product data source."]
        : ["Artifact uses an explicitly supported legacy_raw format."],
    };
  }

  let registeredMigrationPath: MigrationStepV1[] | null = null;
  if (
    options.migration !== undefined &&
    options.migration.targetVersion === registeredDescriptor.schemaVersion
  ) {
    try {
      registeredMigrationPath = planMigrationV1(
        options.migration.registry,
        registeredDescriptor.format,
        options.observedVersion,
        options.migration.targetVersion,
      );
    } catch {
      registeredMigrationPath = null;
    }
  }

  if (
    registeredMigrationPath !== null &&
    registeredMigrationPath.length > 0 &&
    options.migration !== undefined
  ) {
    return {
      schemaVersion: 1,
      status: "migration_required",
      reason: "registered_migration",
      readable: true,
      writable: false,
      sourceVersion: options.observedVersion,
      targetVersion: options.migration.targetVersion,
      warnings: ["Artifact must be migrated and validated before it can be written."],
    };
  }

  return {
    schemaVersion: 1,
    status: "unsupported_version",
    reason: "version_mismatch",
    readable: false,
    writable: false,
    sourceVersion: options.observedVersion,
    warnings: [
      `Expected legacy version ${registeredDescriptor.schemaVersion}; observed ${options.observedVersion}.`,
    ],
  };
}

export type CompatibilityStatusV1 = z.infer<typeof CompatibilityStatusV1Schema>;
export type CompatibilityReasonV1 = z.infer<typeof CompatibilityReasonV1Schema>;
export type CompatibilityDecisionV1 = z.infer<typeof CompatibilityDecisionV1Schema>;
