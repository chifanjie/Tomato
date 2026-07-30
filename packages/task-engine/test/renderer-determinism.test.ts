import { readFile } from "node:fs/promises";

import type { ReadTaskBundleResult } from "@understand-code/artifact-store";
import {
  containsAbsoluteFilesystemPathV1,
  RepoPulseV1Schema,
  RepositorySnapshotV1Schema,
  TaskManifestV1Schema,
} from "@understand-code/contracts";
import type { KnowledgeGraph } from "@understand-code/core";
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildContextDraft,
  renderTaskBriefMarkdown,
  sha256CanonicalJson,
} from "../src/index.js";

const TASK_ID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const SOURCE_SECRET =
  "SOURCE_ONLY_SECRET = '/opt/company/private/runtime-token.ts'";

async function repositoryFixtures() {
  const [snapshotArtifact, pulseArtifact] = await Promise.all([
    readFile(
      new URL(
        "../../contracts/fixtures/v1/reference/repository-snapshot.json",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../../contracts/fixtures/v1/reference/repo-pulse.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  const repositorySnapshot = RepositorySnapshotV1Schema.parse(
    (JSON.parse(snapshotArtifact) as { payload: unknown }).payload,
  );
  const basePulse = (
    JSON.parse(pulseArtifact) as { payload: Record<string, unknown> }
  ).payload as {
    artifactFreshness: Record<string, string>;
    completeness: {
      parser: Record<string, unknown>;
      callGraph: Record<string, unknown>;
    };
  } & Record<string, unknown>;
  const pulse = RepoPulseV1Schema.parse({
    ...basePulse,
    status: "stale",
    artifactFreshness: {
      ...basePulse.artifactFreshness,
      graph: "stale",
      wiki: "stale",
      evidence: "stale",
      diff: "stale",
      task: "stale",
    },
    completeness: {
      ...basePulse.completeness,
      callGraph: {
        status: "partial",
        coverage: 0.5,
        reasons: ["Runtime dispatch targets remain unresolved."],
      },
    },
    recommendedRefresh: "incremental",
    reasons: [
      "The Task is being rendered from a stale repository revision.",
    ],
  });
  return { repositorySnapshot, pulse };
}

function depthLimitedGraph(): KnowledgeGraph {
  const nodes = [
    {
      id: "root-handler",
      name: "RootHandler",
      filePath: "src/root-handler.ts",
    },
    {
      id: "child-handler",
      name: "ChildHandler",
      filePath: "src/child-handler.ts",
    },
    {
      id: "grandchild-handler",
      name: "GrandchildHandler",
      filePath: "src/grandchild-handler.ts",
    },
  ].map((node) => ({
    ...node,
    type: "function" as const,
    lineRange: [1, 20] as [number, number],
    summary: `${node.name} participates in a depth-limited runtime flow.`,
    tags: ["handler", "runtime"],
    complexity: "simple" as const,
  }));
  return {
    version: "1",
    project: {
      name: "renderer-determinism",
      languages: ["TypeScript"],
      frameworks: [],
      description: "Renderer boundary fixture",
      analyzedAt: "2026-07-29T00:00:00.000Z",
      gitCommitHash: "a".repeat(40),
    },
    nodes,
    edges: [
      {
        source: "root-handler",
        target: "child-handler",
        type: "calls",
        direction: "forward",
        weight: 1,
      },
      {
        source: "child-handler",
        target: "grandchild-handler",
        type: "calls",
        direction: "forward",
        weight: 1,
      },
    ],
    layers: [],
    tour: [],
  };
}

describe("Task Brief Markdown determinism", () => {
  it("renders one stale revision byte-identically with explicit unknown/truncation boundaries and no Host or source leakage", async () => {
    const { repositorySnapshot, pulse } = await repositoryFixtures();
    const hostIntent = [
      "Update RootHandler from /Users/example/private/root-handler.ts",
      "C:\\Users\\didi\\private\\root-handler.ts",
      "\\\\server\\share\\root-handler.ts",
      "file:///private/tmp/root-handler.ts",
    ].join(" ");
    const createdAt = "2026-07-29T08:00:00.001Z";
    const graph = depthLimitedGraph();
    const draft = buildContextDraft({
      taskId: TASK_ID,
      intent: hostIntent,
      snapshotId: repositorySnapshot.snapshotId,
      createdAt,
      pulse,
      repositorySnapshot,
      context: {
        graph,
        existingFilePaths: graph.nodes.map(
          (node) => node.filePath!,
        ),
        sourceEvidence: [
          {
            nodeId: "root-handler",
            filePath: "src/root-handler.ts",
            lineRange: [1, 20],
            excerpt: SOURCE_SECRET,
            contentHash:
              "sha256:034be1c7304cd2d721eb758d60ae69c6115f11f1edca7b939e2dd0cebfbe3bc0",
            kind: "source",
          },
        ],
      },
      maxCandidates: 3,
      maxImpactDepth: 1,
    });
    expect(
      draft.evidence.some(
        (item) =>
          "excerpt" in item && item.excerpt === SOURCE_SECRET,
      ),
    ).toBe(true);
    expect(
      draft.impactPaths.some(
        (impactPath) => impactPath.truncatedAt !== undefined,
      ),
    ).toBe(true);
    expect(draft.brief.unknownClaimIds.length).toBeGreaterThan(0);

    const manifest = TaskManifestV1Schema.parse({
      schemaVersion: 1,
      taskId: TASK_ID,
      title: hostIntent,
      originalIntent: hostIntent,
      status: "context_ready",
      repositoryId: repositorySnapshot.repositoryId,
      worktreeId: repositorySnapshot.worktreeId,
      baselineSnapshotId: pulse.baselineSnapshotId,
      latestSnapshotId: repositorySnapshot.snapshotId,
      createdAt,
      updatedAt: createdAt,
      producerVersion: "3.0.0-alpha.1",
      revision: 2,
    });
    const read = {
      bundle: {
        manifest,
        brief: draft.brief,
        claims: draft.claims,
        evidence: draft.evidence,
        impactPaths: draft.impactPaths,
        changeChecks: [],
        verificationRecords: [],
        events: [],
        idempotencyRecords: [],
      },
      artifacts: [],
      receipts: [],
      state: "current",
      freshness: "stale",
      latestSnapshotId: repositorySnapshot.snapshotId,
      recoveryState: "read_only_recovery",
    } as unknown as ReadTaskBundleResult;

    const first = renderTaskBriefMarkdown(read);
    const second = renderTaskBriefMarkdown(read);

    expect(second).toBe(first);
    expect(sha256CanonicalJson(second)).toBe(
      sha256CanonicalJson(first),
    );
    expect(first).toContain("- Revision: `2`");
    expect(first).toContain("- Freshness: `stale`");
    expect(first).toContain(
      "- Recovery state: `read_only_recovery`",
    );
    expect(first).toContain("## Unknowns");
    expect(first).toContain("## Impact boundaries");
    expect(first).toContain("truncated=");
    expect(first).toMatch(
      /Call Graph completeness is partial|Runtime dispatch targets remain unresolved/iu,
    );
    expect(first).toContain("[redacted-host-path]");
    expect(containsAbsoluteFilesystemPathV1(first)).toBe(false);
    expect(first).not.toContain("/Users/example");
    expect(first).not.toContain("C:\\Users");
    expect(first).not.toContain("\\\\server\\share");
    expect(first).not.toContain("file:///private");
    expect(first).not.toContain(SOURCE_SECRET);
    expect(first).not.toContain("SOURCE_ONLY_SECRET");
    expect(first).not.toContain("/opt/company/private");
  });

  it("keeps ranking/context Unknown reasons visible when no ImpactPath exists", async () => {
    const { repositorySnapshot, pulse } = await repositoryFixtures();
    const createdAt = "2026-07-29T08:00:00.001Z";
    const graph = depthLimitedGraph();
    const draft = buildContextDraft({
      taskId: TASK_ID,
      intent: "Update RootHandler",
      snapshotId: repositorySnapshot.snapshotId,
      createdAt,
      pulse,
      repositorySnapshot,
      context: {
        graph,
        // Excluding every Graph file must be a visible context boundary, not
        // a generic “there is an unknown” sentence.
        existingFilePaths: [],
      },
      maxCandidates: 3,
      maxImpactDepth: 1,
    });
    expect(draft.impactPaths).toEqual([]);
    const contextUnknown = draft.claims.find(
      (claim) =>
        claim.statement ===
        "Candidate coverage has an explicit analysis boundary.",
    );
    expect(contextUnknown?.boundaryReason).toContain(
      "file existence was not verified for this Snapshot",
    );
    const manifest = TaskManifestV1Schema.parse({
      schemaVersion: 1,
      taskId: TASK_ID,
      title: "Update RootHandler",
      originalIntent: "Update RootHandler",
      status: "context_ready",
      repositoryId: repositorySnapshot.repositoryId,
      worktreeId: repositorySnapshot.worktreeId,
      baselineSnapshotId: pulse.baselineSnapshotId,
      latestSnapshotId: repositorySnapshot.snapshotId,
      createdAt,
      updatedAt: createdAt,
      producerVersion: "3.0.0-alpha.1",
      revision: 2,
    });
    const markdown = renderTaskBriefMarkdown({
      bundle: {
        manifest,
        brief: draft.brief,
        claims: draft.claims,
        evidence: draft.evidence,
        impactPaths: [],
        changeChecks: [],
        verificationRecords: [],
        events: [],
        idempotencyRecords: [],
      },
      artifacts: [],
      receipts: [],
      state: "current",
      freshness: "stale",
      latestSnapshotId: repositorySnapshot.snapshotId,
      recoveryState: "current",
    } as unknown as ReadTaskBundleResult);

    expect(markdown).toContain("## Unknowns");
    expect(markdown).toContain("Boundary:");
    expect(markdown).toContain(
      "file existence was not verified for this Snapshot",
    );
    expect(markdown).toContain("Graph artifact is stale");
  });
});
