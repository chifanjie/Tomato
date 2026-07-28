import { cloneCanonicalJson, type JsonValue } from "./canonical-json.js";

export interface MigrationStepV1 {
  format: string;
  fromVersion: string;
  toVersion: string;
  migrate: (input: JsonValue) => JsonValue;
}

export type MigrationFailureCodeV1 =
  | "invalid_input"
  | "no_migration_path"
  | "migration_failed";

export type MigrationResultV1 =
  | {
      ok: true;
      value: JsonValue;
      fromVersion: string;
      toVersion: string;
      appliedVersions: string[];
      migrated: boolean;
    }
  | {
      ok: false;
      code: MigrationFailureCodeV1;
      fromVersion: string;
      toVersion: string;
      message: string;
    };

function assertRegistry(steps: readonly MigrationStepV1[]): void {
  const edges = new Set<string>();
  for (const step of steps) {
    if (
      step.format.trim().length === 0 ||
      step.fromVersion.trim().length === 0 ||
      step.toVersion.trim().length === 0 ||
      step.fromVersion === step.toVersion
    ) {
      throw new TypeError("Migration registry contains an invalid step");
    }
    const edge = `${step.format}\u0000${step.fromVersion}\u0000${step.toVersion}`;
    if (edges.has(edge)) {
      throw new TypeError(
        `Migration registry contains duplicate step ${step.format} ${step.fromVersion} -> ${step.toVersion}`,
      );
    }
    edges.add(edge);
  }
}

export function planMigrationV1(
  steps: readonly MigrationStepV1[],
  format: string,
  fromVersion: string,
  toVersion: string,
): MigrationStepV1[] | null {
  assertRegistry(steps);
  if (fromVersion === toVersion) return [];

  const applicable = steps
    .filter((step) => step.format === format)
    .sort((left, right) => {
      const fromComparison = left.fromVersion.localeCompare(right.fromVersion);
      return fromComparison !== 0
        ? fromComparison
        : left.toVersion.localeCompare(right.toVersion);
    });

  const queue: Array<{ version: string; path: MigrationStepV1[] }> = [
    { version: fromVersion, path: [] },
  ];
  const visited = new Set([fromVersion]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const step of applicable) {
      if (step.fromVersion !== current.version || visited.has(step.toVersion)) continue;
      const path = [...current.path, step];
      if (step.toVersion === toVersion) return path;
      visited.add(step.toVersion);
      queue.push({ version: step.toVersion, path });
    }
  }

  return null;
}

export function migrateArtifactValueV1(options: {
  value: unknown;
  format: string;
  fromVersion: string;
  toVersion: string;
  steps: readonly MigrationStepV1[];
}): MigrationResultV1 {
  let current: JsonValue;
  try {
    current = cloneCanonicalJson(options.value);
  } catch (error) {
    return {
      ok: false,
      code: "invalid_input",
      fromVersion: options.fromVersion,
      toVersion: options.toVersion,
      message: error instanceof Error ? error.message : "Migration input is not JSON.",
    };
  }

  const path = planMigrationV1(
    options.steps,
    options.format,
    options.fromVersion,
    options.toVersion,
  );
  if (path === null) {
    return {
      ok: false,
      code: "no_migration_path",
      fromVersion: options.fromVersion,
      toVersion: options.toVersion,
      message: `No migration path for ${options.format} ${options.fromVersion} -> ${options.toVersion}.`,
    };
  }

  try {
    for (const step of path) {
      const isolatedInput = cloneCanonicalJson(current);
      current = cloneCanonicalJson(step.migrate(isolatedInput));
    }
  } catch (error) {
    return {
      ok: false,
      code: "migration_failed",
      fromVersion: options.fromVersion,
      toVersion: options.toVersion,
      message: error instanceof Error ? error.message : "Migration failed.",
    };
  }

  return {
    ok: true,
    value: current,
    fromVersion: options.fromVersion,
    toVersion: options.toVersion,
    appliedVersions: path.map((step) => step.toVersion),
    migrated: path.length > 0,
  };
}
