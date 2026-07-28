import { afterEach, describe, expect, it } from "vitest";
import {
  RepoPulseV1Schema,
  type ArtifactFreshnessV1,
} from "@understand-code/contracts";
import { buildRepoPulse, serializeRepoPulse } from "../src/pulse.js";
import { getRepositorySnapshotDetailed } from "../src/snapshot.js";
import type { GraphRefreshDecision } from "../src/taxonomy.js";
import {
  cleanupTemporaryDirectories,
  initializeRepository,
  temporaryDirectory,
  writeRepositoryFile,
} from "./helpers.js";

afterEach(cleanupTemporaryDirectories);

const completeCoverage = {
  parser: { status: "complete" as const, coverage: 1, reasons: [] },
  callGraph: { status: "complete" as const, coverage: 1, reasons: [] },
};

function artifactMap(
  graph: ArtifactFreshnessV1 = "fresh",
): Record<"graph" | "wiki" | "evidence" | "diff" | "task", ArtifactFreshnessV1> {
  return {
    graph,
    wiki: "fresh",
    evidence: "fresh",
    diff: "fresh",
    task: "fresh",
  };
}

function refreshDecision(
  level: GraphRefreshDecision["level"],
): GraphRefreshDecision {
  return {
    level,
    filesToReanalyze: [],
    rerunArchitecture: false,
    reasons: [`fixture ${level}`],
  };
}

describe("buildRepoPulse", () => {
  it("builds the exact structured fresh Contracts payload", async () => {
    const root = initializeRepository();
    const capture = await getRepositorySnapshotDetailed(root);
    const pulse = buildRepoPulse({
      snapshot: capture.snapshot,
      git: capture.git,
      artifacts: artifactMap(),
      completeness: completeCoverage,
      evaluatedAt: "2026-07-28T10:00:00Z",
    });

    expect(RepoPulseV1Schema.parse(pulse)).toEqual(pulse);
    expect(pulse).toMatchObject({
      status: "fresh",
      artifactFreshness: {
        graph: "fresh",
        wiki: "fresh",
        evidence: "fresh",
        diff: "fresh",
        task: "fresh",
      },
      recommendedRefresh: "none",
      errors: [],
      unknowns: [],
      reasons: [],
      repositoryState: {
        captureStatus: "complete",
        ahead: 0,
        behind: 0,
      },
      changeSummary: { total: 0 },
    });
    expect(JSON.parse(serializeRepoPulse(pulse))).toEqual(pulse);
  });

  it("turns Git failure into unknown with five explicit error families", async () => {
    const root = initializeRepository();
    const capture = await getRepositorySnapshotDetailed(root, {
      gitBinary: `missing-git-${temporaryDirectory().split("/").at(-1)}`,
    });
    const pulse = buildRepoPulse({
      snapshot: capture.snapshot,
      git: capture.git,
      artifacts: artifactMap(),
      evaluatedAt: "2026-07-28T10:00:00Z",
    });

    expect(pulse.status).toBe("unknown");
    expect(pulse.artifactFreshness).toEqual({
      graph: "error",
      wiki: "error",
      evidence: "error",
      diff: "error",
      task: "error",
    });
    expect(pulse.errors?.map((item) => item.code)).toContain(
      "git_capture_error",
    );
    expect(RepoPulseV1Schema.safeParse(pulse).success).toBe(true);
  });

  it("summarizes every change source and kind", async () => {
    const root = initializeRepository();
    writeRepositoryFile(root, "src/main.ts", "export const value = 2;\n");
    writeRepositoryFile(root, "src/new.ts", "export {};\n");
    const capture = await getRepositorySnapshotDetailed(root);
    const pulse = buildRepoPulse({
      snapshot: capture.snapshot,
      git: capture.git,
      artifacts: artifactMap("stale"),
      completeness: completeCoverage,
      evaluatedAt: "2026-07-28T10:00:00Z",
    });

    expect(pulse.status).toBe("stale");
    expect(pulse.changeSummary).toEqual({
      total: 2,
      bySource: {
        committed: 0,
        staged: 0,
        unstaged: 1,
        untracked: 1,
        conflict: 0,
      },
      byKind: {
        added: 1,
        modified: 1,
        deleted: 0,
        renamed: 0,
        copied: 0,
        type_changed: 0,
      },
    });
  });

  it.each([
    ["missing", "none", "full"],
    ["error", "none", "full"],
    ["stale", "none", "incremental"],
    ["partial", "none", "incremental"],
    ["fresh", "incremental", "incremental"],
    ["fresh", "full", "full"],
    ["stale", "full", "full"],
  ] as const)(
    "takes the conservative max for graph=%s and decision=%s",
    async (graph, decision, expected) => {
      const root = initializeRepository();
      const capture = await getRepositorySnapshotDetailed(root);
      const pulse = buildRepoPulse({
        snapshot: capture.snapshot,
        artifacts: artifactMap(graph),
        completeness: completeCoverage,
        graphRefreshDecision: refreshDecision(decision),
        evaluatedAt: "2026-07-28T10:00:00Z",
      });
      expect(pulse.recommendedRefresh).toBe(expected);
    },
  );

  it("uses not_ready for missing Graph and partial for missing Wiki", async () => {
    const root = initializeRepository();
    const capture = await getRepositorySnapshotDetailed(root);
    const graphMissing = buildRepoPulse({
      snapshot: capture.snapshot,
      artifacts: artifactMap("missing"),
      completeness: completeCoverage,
      evaluatedAt: "2026-07-28T10:00:00Z",
    });
    const wikiMissing = buildRepoPulse({
      snapshot: capture.snapshot,
      artifacts: { ...artifactMap(), wiki: "missing" },
      completeness: completeCoverage,
      evaluatedAt: "2026-07-28T10:00:00Z",
    });

    expect(graphMissing.status).toBe("not_ready");
    expect(wikiMissing.status).toBe("partial");
  });

  it.each(["evidence", "diff", "task"] as const)(
    "separates stale %s recomputation from repository index refresh",
    async (family) => {
      const root = initializeRepository();
      const capture = await getRepositorySnapshotDetailed(root);
      const pulse = buildRepoPulse({
        snapshot: capture.snapshot,
        artifacts: { ...artifactMap(), [family]: "stale" },
        completeness: completeCoverage,
        evaluatedAt: "2026-07-28T10:00:00Z",
      });

      expect(pulse.status).toBe("stale");
      expect(pulse.recommendedRefresh).toBe("none");
      expect(pulse.reasons).toContain(
        `${family} artifacts require downstream recomputation; repository index refresh is not required`,
      );
    },
  );
});
