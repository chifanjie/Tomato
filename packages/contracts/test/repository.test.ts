import { describe, expect, it } from "vitest";
import {
  RepoPulseArtifactV1Schema,
  RepoPulseV1Schema,
  RepositoryChangeV1Schema,
  RepositorySnapshotArtifactV1Schema,
  RepositorySnapshotV1Schema,
} from "../src/repository.js";

const digest = `sha256:${"a".repeat(64)}`;
const headCommit = "1".repeat(40);

function snapshot() {
  return {
    schemaVersion: 1,
    snapshotId: "snapshot:1",
    repositoryId: "repository:1",
    worktreeId: "worktree:1",
    rootIdentity: "root:sha256:1",
    branch: "feature/contracts",
    headCommit,
    indexDigest: digest,
    worktreeDigest: digest,
    untrackedDigest: digest,
    ignoreDigest: digest,
    createdAt: "2026-07-28T08:30:00Z",
    captureStatus: "complete",
    limitations: [],
    changes: [
      {
        id: "change:1",
        path: "src/new.ts",
        oldPath: "src/old.ts",
        source: "staged",
        kind: "renamed",
        contentDigest: digest,
        previousContentDigest: digest,
      },
    ],
  } as const;
}

function structuredPulse() {
  return {
    evaluatedSnapshotId: "snapshot:1",
    baselineSnapshotId: "snapshot:baseline",
    status: "fresh",
    artifactFreshness: {
      graph: "fresh",
      wiki: "fresh",
      evidence: "fresh",
      diff: "fresh",
      task: "fresh",
    },
    repositoryState: {
      rootIdentity: "root:sha256:1",
      branch: "feature/contracts",
      baselineCommit: "2".repeat(40),
      headCommit,
      mergeBase: "2".repeat(40),
      ahead: 1,
      behind: 0,
      captureStatus: "complete",
      limitations: [],
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
        modified: 0,
        deleted: 0,
        renamed: 1,
        copied: 0,
        type_changed: 0,
      },
    },
    completeness: {
      parser: { status: "complete", coverage: 1, reasons: [] },
      callGraph: { status: "complete", coverage: 1, reasons: [] },
    },
    recommendedRefresh: "none",
    errors: [],
    unknowns: [],
    reasons: [],
    evaluatedAt: "2026-07-28T08:30:00Z",
  } as const;
}

describe("repository contracts", () => {
  it("parses a strict immutable repository snapshot", () => {
    expect(RepositorySnapshotV1Schema.parse(snapshot())).toEqual(snapshot());
  });

  it("enforces rename/copy path semantics and unique change IDs", () => {
    expect(
      RepositoryChangeV1Schema.safeParse({
        id: "change:1",
        path: "src/new.ts",
        source: "staged",
        kind: "renamed",
      }).success,
    ).toBe(false);
    expect(
      RepositoryChangeV1Schema.safeParse({
        id: "change:1",
        path: "src/file.ts",
        oldPath: "src/old.ts",
        source: "staged",
        kind: "modified",
      }).success,
    ).toBe(false);
    expect(
      RepositorySnapshotV1Schema.safeParse({
        ...snapshot(),
        changes: [snapshot().changes[0], snapshot().changes[0]],
      }).success,
    ).toBe(false);
  });

  it("requires limitations for partial and failed captures", () => {
    expect(
      RepositorySnapshotV1Schema.safeParse({
        ...snapshot(),
        captureStatus: "partial",
        limitations: [],
      }).success,
    ).toBe(false);
    expect(
      RepositorySnapshotV1Schema.safeParse({
        ...snapshot(),
        captureStatus: "error",
        limitations: ["Git index could not be read."],
        headCommit: undefined,
      }).success,
    ).toBe(true);
  });

  it("requires headCommit for complete/partial captures but not Git errors", () => {
    expect(
      RepositorySnapshotV1Schema.safeParse({
        ...snapshot(),
        headCommit: undefined,
      }).success,
    ).toBe(false);
    expect(
      RepositorySnapshotV1Schema.safeParse({
        ...snapshot(),
        captureStatus: "partial",
        limitations: ["Untracked files were unavailable."],
        headCommit: undefined,
      }).success,
    ).toBe(false);
    expect(
      RepositorySnapshotV1Schema.safeParse({
        ...snapshot(),
        captureStatus: "error",
        limitations: ["Repository HEAD is unavailable."],
        headCommit: undefined,
      }).success,
    ).toBe(true);
    expect(
      RepositorySnapshotV1Schema.safeParse({
        ...snapshot(),
        captureStatus: "error",
        limitations: ["Repository HEAD is unavailable."],
        headCommit: undefined,
        baseCommit: headCommit,
      }).success,
    ).toBe(false);
  });

  it("binds repository snapshot envelope identity to its payload", () => {
    const artifact = {
      schemaVersion: 1,
      artifactType: "repository_snapshot",
      artifactId: "artifact:snapshot:1",
      repositoryId: "repository:1",
      worktreeId: "worktree:1",
      sourceSnapshotId: "snapshot:1",
      revision: 0,
      producerVersion: "3.0.0-alpha.1",
      createdAt: "2026-07-28T08:30:00Z",
      contentDigest: digest,
      payload: snapshot(),
    };
    expect(RepositorySnapshotArtifactV1Schema.safeParse(artifact).success).toBe(true);
    expect(
      RepositorySnapshotArtifactV1Schema.safeParse({
        ...artifact,
        sourceSnapshotId: "snapshot:other",
      }).success,
    ).toBe(false);
  });

  it("requires reasons for degraded repository pulse states", () => {
    const pulse = {
      evaluatedSnapshotId: "snapshot:1",
      status: "stale",
      artifactFreshness: { graph: "stale" },
      reasons: [],
      evaluatedAt: "2026-07-28T08:30:00Z",
    };
    expect(RepoPulseV1Schema.safeParse(pulse).success).toBe(false);
    expect(
      RepoPulseV1Schema.safeParse({
        ...pulse,
        reasons: ["Worktree digest changed."],
      }).success,
    ).toBe(true);
    expect(
      RepoPulseV1Schema.safeParse({
        ...pulse,
        reasons: ["Worktree digest changed."],
        extra: true,
      }).success,
    ).toBe(false);
  });

  it("parses structured repository state, change, completeness, and refresh fields", () => {
    expect(RepoPulseV1Schema.parse(structuredPulse())).toEqual(
      structuredPulse(),
    );
  });

  it("rejects fresh pulses that hide stale artifacts or incomplete analysis", () => {
    expect(
      RepoPulseV1Schema.safeParse({
        ...structuredPulse(),
        artifactFreshness: { graph: "fresh" },
      }).success,
    ).toBe(false);
    expect(
      RepoPulseV1Schema.safeParse({
        ...structuredPulse(),
        artifactFreshness: { graph: "stale" },
      }).success,
    ).toBe(false);
    expect(
      RepoPulseV1Schema.safeParse({
        ...structuredPulse(),
        completeness: {
          ...structuredPulse().completeness,
          callGraph: {
            status: "partial",
            coverage: 0.75,
            reasons: ["Dynamic dispatch could not be resolved."],
          },
        },
      }).success,
    ).toBe(false);
    expect(
      RepoPulseV1Schema.safeParse({
        ...structuredPulse(),
        repositoryState: {
          ...structuredPulse().repositoryState,
          captureStatus: "partial",
          limitations: ["Untracked files could not be read."],
        },
      }).success,
    ).toBe(false);
  });

  it("rejects fresh pulses with errors, unknowns, refresh work, or reasons", () => {
    const diagnostic = {
      code: "git_unavailable",
      scope: "git",
      message: "Git state could not be read.",
    } as const;

    for (const inconsistentPulse of [
      { ...structuredPulse(), errors: [diagnostic] },
      { ...structuredPulse(), unknowns: [diagnostic] },
      { ...structuredPulse(), recommendedRefresh: "incremental" },
      {
        ...structuredPulse(),
        reasons: ["Repository state requires attention."],
      },
      { ...structuredPulse(), artifactFreshness: {} },
      { ...structuredPulse(), repositoryState: undefined },
      { ...structuredPulse(), changeSummary: undefined },
      { ...structuredPulse(), completeness: undefined },
    ]) {
      expect(RepoPulseV1Schema.safeParse(inconsistentPulse).success).toBe(
        false,
      );
    }
  });

  it("validates structured count and comparison consistency", () => {
    expect(
      RepoPulseV1Schema.safeParse({
        ...structuredPulse(),
        changeSummary: {
          ...structuredPulse().changeSummary,
          total: 2,
        },
      }).success,
    ).toBe(false);
    expect(
      RepoPulseV1Schema.safeParse({
        ...structuredPulse(),
        repositoryState: {
          ...structuredPulse().repositoryState,
          behind: undefined,
        },
      }).success,
    ).toBe(false);
  });

  it("requires reasons for not-ready and rebuilding pulses", () => {
    for (const status of ["not_ready", "rebuilding"] as const) {
      expect(
        RepoPulseV1Schema.safeParse({
          evaluatedSnapshotId: "snapshot:1",
          status,
          artifactFreshness: { graph: "missing" },
          reasons: [],
          evaluatedAt: "2026-07-28T08:30:00Z",
        }).success,
      ).toBe(false);
    }
  });

  it("binds Repo Pulse envelope sourceSnapshotId to evaluatedSnapshotId", () => {
    const payload = structuredPulse();
    const artifact = {
      schemaVersion: 1,
      artifactType: "repo_pulse",
      artifactId: "artifact:pulse:1",
      repositoryId: "repository:1",
      worktreeId: "worktree:1",
      sourceSnapshotId: "snapshot:1",
      revision: 0,
      producerVersion: "3.0.0-alpha.1",
      createdAt: "2026-07-28T08:30:00Z",
      contentDigest: digest,
      payload,
    };
    expect(RepoPulseArtifactV1Schema.safeParse(artifact).success).toBe(true);
    expect(
      RepoPulseArtifactV1Schema.safeParse({
        ...artifact,
        sourceSnapshotId: "snapshot:other",
      }).success,
    ).toBe(false);
  });
});
