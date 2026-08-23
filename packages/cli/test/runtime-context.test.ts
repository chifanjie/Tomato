import {
  ArtifactStoreError,
  type ArtifactStore,
} from "@understand-code/artifact-store";
import {
  RepoPulseArtifactV1Schema,
  StrongRepoPulseV1Schema,
} from "@understand-code/contracts";
import { describe, expect, it } from "vitest";

import { ToolFailure } from "../src/errors/tool-errors.js";
import { readPublishedPulse } from "../src/runtime/context.js";

const hex = (character: string): string => character.repeat(64);
const digest = (character: string): `sha256:${string}` =>
  `sha256:${hex(character)}`;
const stateToken = (character: string): `hmac-sha256:${string}` =>
  `hmac-sha256:${hex(character)}`;

describe("published Repository context capability boundary", () => {
  it("maps a missing Pulse to the same non-actionable Provider error", async () => {
    const store = {
      async readArtifact() {
        throw new ArtifactStoreError(
          "artifact_not_found",
          "No legacy Pulse exists.",
        );
      },
    } as unknown as ArtifactStore;

    await expect(readPublishedPulse(store)).rejects.toMatchObject({
      result: {
        structuredContent: {
          error: {
            code: "provider_unavailable",
            details: { reason: "unavailable" },
          },
        },
      },
    });
  });

  it("maps a structurally valid strong Pulse to the opaque Provider error", async () => {
    const repositoryId = `repo-hmac-${hex("1")}`;
    const worktreeId = `worktree-hmac-${hex("2")}`;
    const snapshotId = `snapshot-${hex("3")}`;
    const payload = StrongRepoPulseV1Schema.parse({
      profile: "repo_pulse_path_safe_v1",
      evaluatedSnapshotId: snapshotId,
      evaluatedSnapshotContentDigest: digest("4"),
      status: "partial",
      artifactFreshness: {
        graph: "stale",
        wiki: "fresh",
        evidence: "fresh",
        diff: "fresh",
        task: "fresh",
      },
      repositoryState: {
        repositoryId,
        worktreeId,
        rootIdentity: `root-hmac-${hex("5")}`,
        branchState: {
          status: "redacted",
          boundaryCode: "sensitive_path",
        },
        objectFormat: "sha1",
        headState: { kind: "commit", commit: "6".repeat(40) },
        repositoryStateToken: stateToken("7"),
        captureStatus: "partial",
      },
      changeSummary: {
        total: 1,
        bySource: {
          committed: 0,
          staged: 1,
          unstaged: 0,
          untracked: 0,
          conflict: 0,
        },
        byKind: {
          added: 0,
          modified: 1,
          deleted: 0,
          renamed: 0,
          copied: 0,
          type_changed: 0,
        },
      },
      security: {
        snapshotProfile: "repository_snapshot_path_safe_v1",
        safeChangeCount: 1,
        redactedChangeCount: 0,
        unknownStateCount: 0,
        redactionBoundaryCodes: ["sensitive_path"],
        uncertaintyCodes: [],
      },
      securityScanPolicyDigest: digest("8"),
      safeGitExecutionDigest: digest("9"),
      completeness: {
        parser: {
          status: "partial",
          coverage: 0.5,
          reasonCodes: ["parser_partial"],
        },
        callGraph: {
          status: "unsupported",
          reasonCodes: ["call_graph_partial"],
        },
      },
      recommendedRefresh: "incremental",
      diagnosticCodes: ["repository_security_boundary"],
      evaluatedAt: "2026-08-24T01:00:00Z",
    });
    const artifact = RepoPulseArtifactV1Schema.parse({
      schemaVersion: 1,
      artifactType: "repo_pulse",
      artifactId: "artifact:strong-pulse-capability-lock",
      repositoryId,
      worktreeId,
      sourceSnapshotId: snapshotId,
      revision: 0,
      producerVersion: "0.1.0",
      createdAt: payload.evaluatedAt,
      contentDigest: digest("a"),
      payload,
    });
    const store = {
      async readArtifact() {
        return { artifact };
      },
    } as unknown as ArtifactStore;

    let failure: unknown;
    try {
      await readPublishedPulse(store);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(ToolFailure);
    expect((failure as ToolFailure).result).toEqual({
      isError: true,
      content: [{
        type: "text",
        text: "The strong Store is unavailable. Run Doctor for details.",
      }],
      structuredContent: {
        error: {
          schemaVersion: 1,
          code: "provider_unavailable",
          details: { reason: "unavailable" },
        },
      },
    });
  });
});
