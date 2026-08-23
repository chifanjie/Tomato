import { describe, expect, it } from "vitest";
import {
  RepoPulseSurfaceResponseV1Schema,
  RepositorySnapshotSurfaceResponseV1Schema,
  StrongRepoPulseV1Schema,
  StrongRepositorySnapshotV1Schema,
  type RepoPulsePersistedPayloadV1,
  type RepositorySnapshotPersistedPayloadV1,
} from "@understand-code/contracts";
import {
  projectRepoPulseSurface,
  projectRepositorySnapshotSurface,
} from "../src/surface.js";

type LegacyRepositorySnapshotV1 = Exclude<
  RepositorySnapshotPersistedPayloadV1,
  { profile: string }
>;
type StrongRepositorySnapshotV1 = Extract<
  RepositorySnapshotPersistedPayloadV1,
  { profile: "repository_snapshot_path_safe_v1" }
>;
type LegacyRepoPulseV1 = Exclude<
  RepoPulsePersistedPayloadV1,
  { profile: string }
>;
type StrongRepoPulseV1 = Extract<
  RepoPulsePersistedPayloadV1,
  { profile: "repo_pulse_path_safe_v1" }
>;

const LEGACY_BRANCH_CANARY = "legacy/private-branch-canary";
const LEGACY_PATH_CANARY = "private/legacy-path-canary.ts";
const LEGACY_OID_CANARY = "deadbeef".repeat(5);
const LEGACY_DIGEST_CANARY = `sha256:${"d00df00d".repeat(8)}`;
const LEGACY_FREE_TEXT_CANARY = "legacy free-text diagnostic canary";
const STRONG_PRIVATE_BRANCH_CANARY = "strong/private-branch-canary";
const STRONG_PRIVATE_PATH_CANARY = "private/strong-path-canary.ts";
const STRONG_PRIVATE_OID_CANARY = "facefeed".repeat(5);
const STRONG_PRIVATE_DIGEST_CANARY = `sha256:${"cab00d1e".repeat(8)}`;
const STRONG_PRIVATE_FREE_TEXT_CANARY = "strong private free-text canary";

function hex(character: string, length = 64): string {
  return character.repeat(length);
}

function digest(character: string): string {
  return `sha256:${hex(character)}`;
}

function stateToken(character: string): string {
  return `hmac-sha256:${hex(character)}`;
}

function legacySnapshotFixture(): LegacyRepositorySnapshotV1 {
  return {
    schemaVersion: 1,
    snapshotId: "legacy-snapshot-canary",
    repositoryId: "legacy-repository-canary",
    worktreeId: "legacy-worktree-canary",
    rootIdentity: "legacy-root-canary",
    branch: LEGACY_BRANCH_CANARY,
    headCommit: LEGACY_OID_CANARY,
    baseCommit: "a".repeat(40),
    mergeBase: "b".repeat(40),
    indexDigest: LEGACY_DIGEST_CANARY,
    worktreeDigest: digest("1"),
    untrackedDigest: digest("2"),
    ignoreDigest: digest("3"),
    createdAt: "2026-08-23T10:00:00Z",
    captureStatus: "partial",
    limitations: [LEGACY_FREE_TEXT_CANARY],
    changes: [
      {
        id: "legacy-change-canary",
        path: LEGACY_PATH_CANARY,
        source: "unstaged",
        kind: "modified",
        contentDigest: digest("4"),
        previousContentDigest: digest("5"),
      },
    ],
  };
}

function legacyPulseFixture(): LegacyRepoPulseV1 {
  return {
    evaluatedSnapshotId: "legacy-pulse-snapshot-canary",
    baselineSnapshotId: "legacy-pulse-baseline-canary",
    status: "partial",
    artifactFreshness: {
      graph: "stale",
    },
    repositoryState: {
      rootIdentity: "legacy-pulse-root-canary",
      branch: LEGACY_BRANCH_CANARY,
      baselineCommit: "a".repeat(40),
      headCommit: LEGACY_OID_CANARY,
      mergeBase: "b".repeat(40),
      ahead: 2,
      behind: 1,
      captureStatus: "partial",
      limitations: [LEGACY_FREE_TEXT_CANARY],
    },
    changeSummary: {
      total: 3,
      bySource: {
        committed: 0,
        staged: 0,
        unstaged: 2,
        untracked: 1,
        conflict: 0,
      },
      byKind: {
        added: 1,
        modified: 2,
        deleted: 0,
        renamed: 0,
        copied: 0,
        type_changed: 0,
      },
    },
    completeness: {
      parser: {
        status: "partial",
        coverage: 0.5,
        reasons: [LEGACY_FREE_TEXT_CANARY],
      },
      callGraph: {
        status: "unknown",
        reasons: [LEGACY_FREE_TEXT_CANARY],
      },
    },
    recommendedRefresh: "full",
    errors: [
      {
        code: "legacy-error-canary",
        scope: "repository",
        message: LEGACY_FREE_TEXT_CANARY,
      },
    ],
    unknowns: [],
    reasons: [LEGACY_FREE_TEXT_CANARY],
    evaluatedAt: "2026-08-23T10:01:00Z",
  };
}

function strongSnapshotFixture(): StrongRepositorySnapshotV1 {
  return StrongRepositorySnapshotV1Schema.parse({
    schemaVersion: 1,
    profile: "repository_snapshot_path_safe_v1",
    snapshotId: `snapshot-${hex("1")}`,
    repositoryId: `repo-hmac-${hex("2")}`,
    worktreeId: `worktree-hmac-${hex("3")}`,
    rootIdentity: `root-hmac-${hex("4")}`,
    branchState: {
      status: "safe",
      name: "feature/safe-surface",
    },
    objectFormat: "sha1",
    headState: {
      kind: "commit",
      commit: "a".repeat(40),
    },
    baseCommit: STRONG_PRIVATE_OID_CANARY,
    mergeBase: "b".repeat(40),
    repositoryStateToken: stateToken("5"),
    indexToken: stateToken("6"),
    worktreeToken: stateToken("7"),
    untrackedToken: stateToken("8"),
    ignoreToken: stateToken("9"),
    securityScanPolicyDigest: STRONG_PRIVATE_DIGEST_CANARY,
    safeGitExecutionDigest: digest("a"),
    createdAt: "2026-08-23T11:00:00Z",
    captureStatus: "partial",
    accounting: {
      rawLayerUnitCount: 3,
      candidateUnitCount: 3,
      safeChangeCount: 1,
      redactedKnownChangeCount: 1,
      unknownStateCount: 1,
    },
    changes: [
      {
        id: `change-${hex("a")}`,
        path: "src/safe-new.ts",
        oldPath: "src/safe-old.ts",
        source: "staged",
        kind: "renamed",
        contentDigest: digest("b"),
        previousContentDigest: digest("c"),
      },
    ],
    redactedChanges: [
      {
        id: `snapshot-redaction-${hex("d")}`,
        source: "untracked",
        kind: "added",
        boundaryCode: "secret_content",
        count: 1,
      },
    ],
    unknownStates: [
      {
        id: `snapshot-unknown-state-${hex("e")}`,
        code: "unreadable",
        count: 1,
      },
    ],
  });
}

function strongPulseFixture(): StrongRepoPulseV1 {
  return StrongRepoPulseV1Schema.parse({
    profile: "repo_pulse_path_safe_v1",
    evaluatedSnapshotId: `snapshot-${hex("1")}`,
    evaluatedSnapshotContentDigest: STRONG_PRIVATE_DIGEST_CANARY,
    baselineSnapshotId: `snapshot-${hex("f")}`,
    status: "partial",
    artifactFreshness: {
      graph: "stale",
      wiki: "fresh",
      evidence: "fresh",
      diff: "fresh",
      task: "fresh",
    },
    repositoryState: {
      repositoryId: `repo-hmac-${hex("2")}`,
      worktreeId: `worktree-hmac-${hex("3")}`,
      rootIdentity: `root-hmac-${hex("4")}`,
      branchState: {
        status: "redacted",
        boundaryCode: "sensitive_path",
      },
      objectFormat: "sha1",
      headState: {
        kind: "commit",
        commit: STRONG_PRIVATE_OID_CANARY,
      },
      repositoryStateToken: stateToken("5"),
      captureStatus: "partial",
    },
    changeSummary: {
      total: 2,
      bySource: {
        committed: 0,
        staged: 1,
        unstaged: 0,
        untracked: 1,
        conflict: 0,
      },
      byKind: {
        added: 1,
        modified: 0,
        deleted: 0,
        renamed: 1,
        copied: 0,
        type_changed: 0,
      },
    },
    security: {
      snapshotProfile: "repository_snapshot_path_safe_v1",
      safeChangeCount: 1,
      redactedChangeCount: 1,
      unknownStateCount: 1,
      redactionBoundaryCodes: ["secret_content", "sensitive_path"],
      uncertaintyCodes: ["unreadable"],
    },
    securityScanPolicyDigest: digest("6"),
    safeGitExecutionDigest: digest("7"),
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
    evaluatedAt: "2026-08-23T11:01:00Z",
  });
}

function expectSerializedWithout(
  value: unknown,
  canaries: readonly string[],
): void {
  const serialized = JSON.stringify(value);
  for (const canary of canaries) {
    expect(serialized).not.toContain(canary);
  }
}

describe("Repository Surface projectors", () => {
  it("reduces a legacy Snapshot to status, count, time, and a false strong flag", () => {
    const projected = projectRepositorySnapshotSurface(legacySnapshotFixture());

    expect(projected).toEqual({
      viewVersion: 1,
      viewKind: "legacy_repository_snapshot_redacted",
      sourceCaptureStatus: "partial",
      aggregateChangeCount: 1,
      capturedAt: "2026-08-23T10:00:00Z",
      strongOperationSupported: false,
    });
    expect(RepositorySnapshotSurfaceResponseV1Schema.parse(projected)).toEqual(
      projected,
    );
    expectSerializedWithout(projected, [
      LEGACY_BRANCH_CANARY,
      LEGACY_PATH_CANARY,
      LEGACY_OID_CANARY,
      LEGACY_DIGEST_CANARY,
      LEGACY_FREE_TEXT_CANARY,
    ]);
  });

  it("reduces a legacy Pulse and omits an unavailable aggregate count", () => {
    const withCount = projectRepoPulseSurface(legacyPulseFixture());
    const withoutCountInput = legacyPulseFixture();
    delete withoutCountInput.changeSummary;
    const withoutCount = projectRepoPulseSurface(withoutCountInput);

    expect(withCount).toEqual({
      viewVersion: 1,
      viewKind: "legacy_repo_pulse_redacted",
      status: "partial",
      aggregateChangeCount: 3,
      evaluatedAt: "2026-08-23T10:01:00Z",
      strongOperationSupported: false,
    });
    expect(withoutCount).toEqual({
      viewVersion: 1,
      viewKind: "legacy_repo_pulse_redacted",
      status: "partial",
      evaluatedAt: "2026-08-23T10:01:00Z",
      strongOperationSupported: false,
    });
    expect(RepoPulseSurfaceResponseV1Schema.parse(withCount)).toEqual(withCount);
    expect(RepoPulseSurfaceResponseV1Schema.parse(withoutCount)).toEqual(
      withoutCount,
    );
    expectSerializedWithout(withCount, [
      LEGACY_BRANCH_CANARY,
      LEGACY_OID_CANARY,
      LEGACY_FREE_TEXT_CANARY,
    ]);
  });

  it("copies exactly the frozen safe fields from a strong Snapshot", () => {
    const snapshot = strongSnapshotFixture();
    Object.assign(snapshot, {
      privateBranchCanary: STRONG_PRIVATE_BRANCH_CANARY,
      privatePathCanary: STRONG_PRIVATE_PATH_CANARY,
      privateFreeTextCanary: STRONG_PRIVATE_FREE_TEXT_CANARY,
    });
    Object.assign(snapshot.branchState, {
      nestedPrivatePathCanary: STRONG_PRIVATE_PATH_CANARY,
    });
    const firstChange = snapshot.changes[0];
    if (firstChange === undefined) {
      throw new Error("strong Snapshot fixture must contain a safe change");
    }
    Object.assign(firstChange, {
      nestedPrivateFreeTextCanary: STRONG_PRIVATE_FREE_TEXT_CANARY,
    });

    const projected = projectRepositorySnapshotSurface(snapshot);

    expect(projected).toEqual({
      viewVersion: 1,
      viewKind: "strong_repository_snapshot",
      snapshotId: `snapshot-${hex("1")}`,
      repositoryId: `repo-hmac-${hex("2")}`,
      worktreeId: `worktree-hmac-${hex("3")}`,
      branchState: {
        status: "safe",
        name: "feature/safe-surface",
      },
      objectFormat: "sha1",
      headState: {
        kind: "commit",
        commit: "a".repeat(40),
      },
      captureStatus: "partial",
      accounting: {
        rawLayerUnitCount: 3,
        candidateUnitCount: 3,
        safeChangeCount: 1,
        redactedKnownChangeCount: 1,
        unknownStateCount: 1,
      },
      changes: [
        {
          id: `change-${hex("a")}`,
          path: "src/safe-new.ts",
          oldPath: "src/safe-old.ts",
          source: "staged",
          kind: "renamed",
          contentDigest: digest("b"),
          previousContentDigest: digest("c"),
        },
      ],
      redactedChanges: [
        {
          id: `snapshot-redaction-${hex("d")}`,
          source: "untracked",
          kind: "added",
          boundaryCode: "secret_content",
          count: 1,
        },
      ],
      unknownStates: [
        {
          id: `snapshot-unknown-state-${hex("e")}`,
          code: "unreadable",
          count: 1,
        },
      ],
      capturedAt: "2026-08-23T11:00:00Z",
      strongOperationSupported: true,
    });
    expect(RepositorySnapshotSurfaceResponseV1Schema.parse(projected)).toEqual(
      projected,
    );
    expectSerializedWithout(projected, [
      STRONG_PRIVATE_BRANCH_CANARY,
      STRONG_PRIVATE_PATH_CANARY,
      STRONG_PRIVATE_OID_CANARY,
      STRONG_PRIVATE_DIGEST_CANARY,
      STRONG_PRIVATE_FREE_TEXT_CANARY,
    ]);
  });

  it("copies exactly the frozen safe fields from a strong Pulse", () => {
    const pulse = strongPulseFixture();
    Object.assign(pulse.repositoryState, {
      privateBranchCanary: STRONG_PRIVATE_BRANCH_CANARY,
      privatePathCanary: STRONG_PRIVATE_PATH_CANARY,
      privateFreeTextCanary: STRONG_PRIVATE_FREE_TEXT_CANARY,
    });

    const projected = projectRepoPulseSurface(pulse);

    expect(projected).toEqual({
      viewVersion: 1,
      viewKind: "strong_repo_pulse",
      evaluatedSnapshotId: `snapshot-${hex("1")}`,
      status: "partial",
      branchState: {
        status: "redacted",
        boundaryCode: "sensitive_path",
      },
      safeChangeCount: 1,
      redactedChangeCount: 1,
      unknownStateCount: 1,
      redactionBoundaryCodes: ["secret_content", "sensitive_path"],
      uncertaintyCodes: ["unreadable"],
      evaluatedAt: "2026-08-23T11:01:00Z",
      strongOperationSupported: true,
    });
    expect(RepoPulseSurfaceResponseV1Schema.parse(projected)).toEqual(projected);
    expectSerializedWithout(projected, [
      STRONG_PRIVATE_BRANCH_CANARY,
      STRONG_PRIVATE_PATH_CANARY,
      STRONG_PRIVATE_OID_CANARY,
      STRONG_PRIVATE_DIGEST_CANARY,
      STRONG_PRIVATE_FREE_TEXT_CANARY,
    ]);
  });

  it("keeps both Surface response schemas strict against extra keys", () => {
    const snapshotWithExtraKey = Object.assign(
      {},
      projectRepositorySnapshotSurface(legacySnapshotFixture()),
      { extraKey: STRONG_PRIVATE_FREE_TEXT_CANARY },
    );
    const pulseWithExtraKey = Object.assign(
      {},
      projectRepoPulseSurface(strongPulseFixture()),
      { extraKey: STRONG_PRIVATE_FREE_TEXT_CANARY },
    );

    expect(
      RepositorySnapshotSurfaceResponseV1Schema.safeParse(snapshotWithExtraKey)
        .success,
    ).toBe(false);
    expect(RepoPulseSurfaceResponseV1Schema.safeParse(pulseWithExtraKey).success).toBe(
      false,
    );
  });
});
