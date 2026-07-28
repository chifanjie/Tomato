import { z } from "zod";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  ArtifactEnvelopeBaseV1Schema,
  canonicalArtifactPayloadJson,
  createArtifactEnvelopeV1Schema,
  verifyArtifactContentDigestV1,
} from "../src/artifact-envelope.js";

const digest = `sha256:${"a".repeat(64)}`;
const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";

function envelope(artifactType: string, payload: unknown) {
  return {
    schemaVersion: 1,
    artifactType,
    artifactId: "artifact:1",
    repositoryId: "repository:1",
    worktreeId: "worktree:1",
    sourceSnapshotId: "snapshot:1",
    revision: 0,
    producerVersion: "3.0.0-alpha.1",
    createdAt: "2026-07-28T08:30:00Z",
    contentDigest: digest,
    payload,
  };
}

describe("ArtifactEnvelopeV1", () => {
  it("strictly parses repository-scoped and task-scoped envelopes", () => {
    expect(
      ArtifactEnvelopeBaseV1Schema.parse(envelope("repo_pulse", {})).artifactType,
    ).toBe("repo_pulse");

    expect(
      ArtifactEnvelopeBaseV1Schema.parse({
        ...envelope("task_manifest", {}),
        taskId,
      }).taskId,
    ).toBe(taskId);
  });

  it("enforces task scope from artifactType", () => {
    expect(
      ArtifactEnvelopeBaseV1Schema.safeParse(envelope("task_manifest", {})).success,
    ).toBe(false);
    expect(
      ArtifactEnvelopeBaseV1Schema.safeParse({
        ...envelope("repository_snapshot", {}),
        taskId,
      }).success,
    ).toBe(false);
  });

  it("rejects unknown envelope and payload fields", () => {
    const schema = createArtifactEnvelopeV1Schema(
      "repo_pulse",
      z.strictObject({ status: z.literal("fresh") }),
    );
    expect(
      schema.safeParse({
        ...envelope("repo_pulse", { status: "fresh" }),
        unexpected: true,
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse(
        envelope("repo_pulse", { status: "fresh", unexpected: true }),
      ).success,
    ).toBe(false);
  });

  it("canonicalizes payload only for the digest input", () => {
    const first = envelope("repo_pulse", { z: 2, a: 1 });
    const second = {
      ...first,
      artifactId: "artifact:other",
      revision: 99,
      createdAt: "2026-07-28T09:30:00Z",
      contentDigest: `sha256:${"b".repeat(64)}`,
    };

    expect(canonicalArtifactPayloadJson(first)).toBe('{"a":1,"z":2}');
    expect(canonicalArtifactPayloadJson(first)).toBe(
      canonicalArtifactPayloadJson(second),
    );
  });

  it("verifies payload integrity through a host-supplied SHA-256 function", () => {
    const payload = { z: 2, a: 1 };
    const contentDigest = `sha256:${createHash("sha256")
      .update('{"a":1,"z":2}', "utf8")
      .digest("hex")}`;
    const artifact = { ...envelope("repo_pulse", payload), contentDigest };
    const hash = (canonicalJson: string) =>
      `sha256:${createHash("sha256").update(canonicalJson, "utf8").digest("hex")}`;

    expect(verifyArtifactContentDigestV1(artifact, hash).valid).toBe(true);
    expect(
      verifyArtifactContentDigestV1(
        { ...artifact, payload: { a: 1, z: 3 } },
        hash,
      ).valid,
    ).toBe(false);
  });
});
