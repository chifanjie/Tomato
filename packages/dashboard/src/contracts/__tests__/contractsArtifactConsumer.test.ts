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

function fixture(fileName: string, section = "reference"): unknown {
  return JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(
          `../../../../contracts/fixtures/v1/${section}/${fileName}`,
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

describe("Dashboard consumes the shared Contracts package", () => {
  it("parses the exact reference artifacts consumed by Core and MCP DTOs", () => {
    expect(
      RepositorySnapshotArtifactV1Schema.safeParse(
        fixture("repository-snapshot.json"),
      ).success,
    ).toBe(true);
    expect(
      TaskManifestArtifactV1Schema.safeParse(fixture("task.json")).success,
    ).toBe(true);
    const taskBundle = fixture("task-bundle.json");
    expect(TaskArtifactBundleV1Schema.safeParse(taskBundle).success).toBe(true);
    expect(
      parseTrustedTaskArtifactBundleV1(taskBundle, digestCanonicalJson)
        .manifest.taskId,
    ).toBe(
      TaskManifestArtifactV1Schema.parse(fixture("task.json")).payload.taskId,
    );
  });

  it("fails closed for incompatible, dangling, and digest-mismatched artifacts", () => {
    expect(
      PersistedArtifactV1Schema.safeParse(
        fixture("unknown-version-artifact.json", "invalid"),
      ).success,
    ).toBe(false);
    expect(
      TaskArtifactBundleV1Schema.safeParse(
        fixture("dangling-task-bundle.json", "invalid"),
      ).success,
    ).toBe(false);

    const digestMismatch = RepositorySnapshotArtifactV1Schema.parse(
      fixture("digest-mismatch-artifact.json", "invalid"),
    );
    expect(
      verifyArtifactContentDigestV1(digestMismatch, digestCanonicalJson).valid,
    ).toBe(false);

    const tamperedTaskBundle = structuredClone(
      parseTrustedTaskArtifactBundleV1(
        fixture("task-bundle.json"),
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
