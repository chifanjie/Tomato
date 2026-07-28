import { describe, expect, it } from "vitest";
import {
  migrateArtifactValueV1,
  planMigrationV1,
  type MigrationStepV1,
} from "../src/migration.js";

const steps: MigrationStepV1[] = [
  {
    format: "fixture",
    fromVersion: "1",
    toVersion: "2",
    migrate: (input) => ({ ...(input as object), version: 2, middle: true }),
  },
  {
    format: "fixture",
    fromVersion: "2",
    toVersion: "3",
    migrate: (input) => ({ ...(input as object), version: 3, final: true }),
  },
];

describe("pure migration harness", () => {
  it("plans and executes a deterministic multi-step migration", () => {
    expect(planMigrationV1(steps, "fixture", "1", "3")).toEqual(steps);

    const source = { version: 1, nested: { value: "unchanged" } };
    const result = migrateArtifactValueV1({
      value: source,
      format: "fixture",
      fromVersion: "1",
      toVersion: "3",
      steps,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        final: true,
        middle: true,
        nested: { value: "unchanged" },
        version: 3,
      },
      fromVersion: "1",
      toVersion: "3",
      appliedVersions: ["2", "3"],
      migrated: true,
    });
    expect(source).toEqual({ version: 1, nested: { value: "unchanged" } });
  });

  it("returns a detached identity result without inventing a migration", () => {
    const source = { version: 1 };
    const result = migrateArtifactValueV1({
      value: source,
      format: "fixture",
      fromVersion: "1",
      toVersion: "1",
      steps,
    });

    expect(result).toMatchObject({ ok: true, value: source, migrated: false });
    if (result.ok) expect(result.value).not.toBe(source);
  });

  it("fails closed for non-JSON input and missing paths", () => {
    expect(
      migrateArtifactValueV1({
        value: { invalid: undefined },
        format: "fixture",
        fromVersion: "1",
        toVersion: "3",
        steps,
      }),
    ).toMatchObject({ ok: false, code: "invalid_input" });
    expect(
      migrateArtifactValueV1({
        value: { version: 1 },
        format: "fixture",
        fromVersion: "1",
        toVersion: "4",
        steps,
      }),
    ).toMatchObject({ ok: false, code: "no_migration_path" });
  });

  it("isolates mutation attempts and reports migration exceptions", () => {
    const source = { values: ["original"] };
    const mutatingStep: MigrationStepV1 = {
      format: "fixture",
      fromVersion: "1",
      toVersion: "2",
      migrate: (input) => {
        (input as { values: string[] }).values.push("migration");
        throw new Error("failed after mutation");
      },
    };

    expect(
      migrateArtifactValueV1({
        value: source,
        format: "fixture",
        fromVersion: "1",
        toVersion: "2",
        steps: [mutatingStep],
      }),
    ).toMatchObject({ ok: false, code: "migration_failed" });
    expect(source).toEqual({ values: ["original"] });
  });

  it("rejects duplicate migration registry edges", () => {
    expect(() =>
      planMigrationV1([steps[0]!, steps[0]!], "fixture", "1", "2"),
    ).toThrow(/duplicate step/u);
  });
});
