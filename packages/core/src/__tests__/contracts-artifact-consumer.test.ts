import {
  PersistedArtifactV1Schema,
  RepositorySnapshotArtifactV1Schema,
  TaskArtifactBundleV1Schema,
  TaskManifestArtifactV1Schema,
  parseTrustedTaskArtifactBundleV1,
  verifyArtifactContentDigestV1,
} from "@understand-code/contracts";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseWikiIndexV2 } from "../knowledge-base/wiki-contract.js";
import { validateGraph } from "../schema.js";

function fixture(section: string, fileName: string): unknown {
  return JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(
          `../../../contracts/fixtures/v1/${section}/${fileName}`,
          import.meta.url,
        ),
      ),
      "utf8",
    ),
  ) as unknown;
}

function digestCanonicalJson(canonicalJson: string): string {
  return `sha256:${createHash("sha256")
    .update(canonicalJson, "utf8")
    .digest("hex")}`;
}

describe("Core consumes the shared Contracts package", () => {
  it("parses the same reference Snapshot and Task artifacts shipped to other consumers", () => {
    expect(
      RepositorySnapshotArtifactV1Schema.safeParse(
        fixture("reference", "repository-snapshot.json"),
      ).success,
    ).toBe(true);
    expect(
      TaskManifestArtifactV1Schema.safeParse(
        fixture("reference", "task.json"),
      ).success,
    ).toBe(true);
    const taskBundle = fixture("reference", "task-bundle.json");
    expect(TaskArtifactBundleV1Schema.safeParse(taskBundle).success).toBe(true);
    expect(
      parseTrustedTaskArtifactBundleV1(taskBundle, digestCanonicalJson)
        .manifest.taskId,
    ).toBe(
      TaskManifestArtifactV1Schema.parse(fixture("reference", "task.json"))
        .payload.taskId,
    );
  });

  it("keeps legacy Graph V1 and Wiki V2 readable through their existing Core readers", () => {
    expect(validateGraph(fixture("legacy", "graph-v1.json")).success).toBe(
      true,
    );
    expect(parseWikiIndexV2(fixture("legacy", "wiki-index-v2.json")).ok).toBe(
      true,
    );
  });

  it("fails closed for incompatible, dangling, and digest-mismatched facts", () => {
    expect(
      PersistedArtifactV1Schema.safeParse(
        fixture("invalid", "unknown-version-artifact.json"),
      ).success,
    ).toBe(false);
    expect(
      TaskArtifactBundleV1Schema.safeParse(
        fixture("invalid", "dangling-task-bundle.json"),
      ).success,
    ).toBe(false);

    const digestMismatch = RepositorySnapshotArtifactV1Schema.parse(
      fixture("invalid", "digest-mismatch-artifact.json"),
    );
    expect(
      verifyArtifactContentDigestV1(digestMismatch, digestCanonicalJson).valid,
    ).toBe(false);

    const tamperedTaskBundle = structuredClone(
      parseTrustedTaskArtifactBundleV1(
        fixture("reference", "task-bundle.json"),
        digestCanonicalJson,
      ),
    );
    tamperedTaskBundle.events[1]!.actor = "tampered-actor";
    tamperedTaskBundle.idempotencyRecords[1]!.actor = "tampered-actor";
    expect(() =>
      parseTrustedTaskArtifactBundleV1(
        tamperedTaskBundle,
        digestCanonicalJson,
      ),
    ).toThrow();
  });
});
