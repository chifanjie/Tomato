import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canonicalizeJson } from "../src/canonical-json.js";
import {
  KeyedStateTokenV1Schema,
  PathSafeRepositoryChangeIdV1Schema,
  PathSafeRepositoryIdV1Schema,
  PathSafeRepositorySnapshotIdV1Schema,
  PathSafeRepositoryUnknownStateIdV1Schema,
  PathSafeRepositoryRedactionIdV1Schema,
  PathSafeRootIdentityV1Schema,
  PathSafeWorktreeIdV1Schema,
} from "../src/primitives.js";
import {
  RepoPulsePersistedPayloadV1Schema,
  RepoPulseSurfaceResponseV1Schema,
  RepoPulseArtifactV1Schema,
  RepoPulseV1Schema,
  RepositoryChangeV1Schema,
  RepositorySnapshotPersistedPayloadV1Schema,
  RepositorySnapshotSurfaceResponseV1Schema,
  RepositorySnapshotArtifactV1Schema,
  RepositorySnapshotV1Schema,
  StrongRepoPulseV1Schema,
  StrongRepositorySnapshotV1Schema,
  canonicalStrongRepositorySnapshotIdentityJsonV1,
  derivePathSafeRepositoryChangeIdV1,
  derivePathSafeRepositoryRedactionIdV1,
  derivePathSafeRepositorySnapshotIdV1,
  derivePathSafeRepositoryUnknownStateIdV1,
  parseTrustedRepositorySnapshotArtifactV1,
  parseTrustedStrongRepoPulseV1,
  parseTrustedStrongRepositorySnapshotV1,
} from "../src/repository.js";

const digest = `sha256:${"a".repeat(64)}`;
const headCommit = "1".repeat(40);

function digestCanonicalJson(canonicalJson: string): string {
  return `sha256:${createHash("sha256")
    .update(canonicalJson, "utf8")
    .digest("hex")}`;
}

function fixtureText(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../fixtures/v1/${relativePath}`, import.meta.url)),
    "utf8",
  );
}

function jsonFixture(relativePath: string): unknown {
  return JSON.parse(fixtureText(relativePath)) as unknown;
}

const strongRepositoryId = PathSafeRepositoryIdV1Schema.parse(
  `repo-hmac-${"1".repeat(64)}`,
);
const strongWorktreeId = PathSafeWorktreeIdV1Schema.parse(
  `worktree-hmac-${"2".repeat(64)}`,
);
const strongRootIdentity = PathSafeRootIdentityV1Schema.parse(
  `root-hmac-${"3".repeat(64)}`,
);
const strongRepositoryStateToken = KeyedStateTokenV1Schema.parse(
  `hmac-sha256:${"4".repeat(64)}`,
);
const strongIndexToken = KeyedStateTokenV1Schema.parse(
  `hmac-sha256:${"5".repeat(64)}`,
);
const strongWorktreeToken = KeyedStateTokenV1Schema.parse(
  `hmac-sha256:${"6".repeat(64)}`,
);
const strongUntrackedToken = KeyedStateTokenV1Schema.parse(
  `hmac-sha256:${"7".repeat(64)}`,
);
const strongIgnoreToken = KeyedStateTokenV1Schema.parse(
  `hmac-sha256:${"8".repeat(64)}`,
);

function strongSnapshot(options: { partial?: boolean } = {}) {
  const changeFields = {
    path: "src/path-safe.ts",
    source: "staged",
    kind: "modified",
    contentDigest: digest,
    previousContentDigest: `sha256:${"b".repeat(64)}`,
  } as const;
  const change = {
    id: derivePathSafeRepositoryChangeIdV1(
      changeFields,
      digestCanonicalJson,
    ),
    ...changeFields,
  };
  const partial = options.partial === true;
  const redactedChanges = partial
    ? [
        {
          id: derivePathSafeRepositoryRedactionIdV1(
            {
              repositoryId: strongRepositoryId,
              worktreeId: strongWorktreeId,
              repositoryStateToken: strongRepositoryStateToken,
              source: "untracked",
              kind: "added",
              boundaryCode: "secret_content",
              count: 1,
            },
            digestCanonicalJson,
          ),
          source: "untracked" as const,
          kind: "added" as const,
          boundaryCode: "secret_content" as const,
          count: 1,
        },
      ]
    : [];
  const unknownStates = partial
    ? [
        {
          id: derivePathSafeRepositoryUnknownStateIdV1(
            {
              repositoryId: strongRepositoryId,
              worktreeId: strongWorktreeId,
              repositoryStateToken: strongRepositoryStateToken,
              code: "unreadable",
              count: 1,
            },
            digestCanonicalJson,
          ),
          code: "unreadable" as const,
          count: 1,
        },
      ]
    : [];
  const draft = StrongRepositorySnapshotV1Schema.parse({
    schemaVersion: 1,
    profile: "repository_snapshot_path_safe_v1",
    snapshotId: `snapshot-${"0".repeat(64)}`,
    repositoryId: strongRepositoryId,
    worktreeId: strongWorktreeId,
    rootIdentity: strongRootIdentity,
    branchState: partial
      ? { status: "redacted", boundaryCode: "sensitive_path" }
      : { status: "safe", name: "feature/path-safe-contracts" },
    objectFormat: "sha1",
    headState: { kind: "commit", commit: headCommit },
    repositoryStateToken: strongRepositoryStateToken,
    indexToken: strongIndexToken,
    worktreeToken: strongWorktreeToken,
    untrackedToken: strongUntrackedToken,
    ignoreToken: strongIgnoreToken,
    securityScanPolicyDigest: `sha256:${"9".repeat(64)}`,
    safeGitExecutionDigest: `sha256:${"c".repeat(64)}`,
    createdAt: "2026-07-28T08:30:00Z",
    captureStatus: partial ? "partial" : "complete",
    accounting: {
      rawLayerUnitCount: partial ? 3 : 1,
      candidateUnitCount: partial ? 3 : 1,
      safeChangeCount: 1,
      redactedKnownChangeCount: partial ? 1 : 0,
      unknownStateCount: partial ? 1 : 0,
    },
    changes: [change],
    redactedChanges,
    unknownStates,
  });
  return StrongRepositorySnapshotV1Schema.parse({
    ...draft,
    snapshotId: derivePathSafeRepositorySnapshotIdV1(
      draft,
      digestCanonicalJson,
    ),
  });
}

function strongPulse() {
  const sourceSnapshot = strongSnapshot();
  return {
    profile: "repo_pulse_path_safe_v1",
    evaluatedSnapshotId: sourceSnapshot.snapshotId,
    evaluatedSnapshotContentDigest: digestCanonicalJson(
      canonicalizeJson(sourceSnapshot),
    ),
    status: "fresh",
    artifactFreshness: {
      graph: "fresh",
      wiki: "fresh",
      evidence: "fresh",
      diff: "fresh",
      task: "fresh",
    },
    repositoryState: {
      repositoryId: sourceSnapshot.repositoryId,
      worktreeId: sourceSnapshot.worktreeId,
      rootIdentity: sourceSnapshot.rootIdentity,
      branchState: sourceSnapshot.branchState,
      objectFormat: sourceSnapshot.objectFormat,
      headState: sourceSnapshot.headState,
      repositoryStateToken: sourceSnapshot.repositoryStateToken,
      captureStatus: sourceSnapshot.captureStatus,
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
      redactionBoundaryCodes: [],
      uncertaintyCodes: [],
    },
    securityScanPolicyDigest: sourceSnapshot.securityScanPolicyDigest,
    safeGitExecutionDigest: sourceSnapshot.safeGitExecutionDigest,
    completeness: {
      parser: { status: "complete", coverage: 1, reasonCodes: [] },
      callGraph: { status: "complete", coverage: 1, reasonCodes: [] },
    },
    recommendedRefresh: "none",
    diagnosticCodes: [],
    evaluatedAt: "2026-07-28T08:31:00Z",
  } as const;
}

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

  it("keeps legacy Snapshot/Pulse readers byte-compatible while adding persisted unions", () => {
    const legacySnapshotArtifact = jsonFixture("reference/repository-snapshot.json") as {
      payload: unknown;
    };
    const legacyPulseArtifact = jsonFixture("reference/repo-pulse.json") as {
      payload: unknown;
    };
    const parsedSnapshot = RepositorySnapshotPersistedPayloadV1Schema.parse(
      legacySnapshotArtifact.payload,
    );
    const parsedPulse = RepoPulsePersistedPayloadV1Schema.parse(
      legacyPulseArtifact.payload,
    );
    expect(canonicalizeJson(parsedSnapshot)).toBe(
      canonicalizeJson(legacySnapshotArtifact.payload),
    );
    expect(canonicalizeJson(parsedPulse)).toBe(
      canonicalizeJson(legacyPulseArtifact.payload),
    );
    expect(
      createHash("sha256")
        .update(fixtureText("reference/repository-snapshot.json"), "utf8")
        .digest("hex"),
    ).toBe("80028d8e4a5195f93b7664aff06545cbbd1b8a5fe020f1be557d159498cb430d");
    expect(
      createHash("sha256")
        .update(fixtureText("reference/repo-pulse.json"), "utf8")
        .digest("hex"),
    ).toBe("5c35167f112a3835a0a06e05252a64ddd1b2c2fca4206e58eb6e797100bb00e7");
    expect(
      (jsonFixture("reference/repository-snapshot.json") as { contentDigest: string })
        .contentDigest,
    ).toBe("sha256:1b58264b1bbaef31b008cfe5b69f8a0ec20c070b199bcd8de4f8d3f78c2be819");
    expect(
      (jsonFixture("reference/repo-pulse.json") as { contentDigest: string })
        .contentDigest,
    ).toBe("sha256:d1514c0b959dcf598607c730c0ce10998e513487f17c573f6bce58c0006dd8c0");
  });

  it("preserves legacy path bytes while rejecting non-UTF-8 identity preimages from strong Snapshots", () => {
    const legacy = snapshot();
    const legacyChange = legacy.changes[0];
    expect(legacyChange).toBeDefined();
    expect(
      RepositorySnapshotV1Schema.safeParse({
        ...legacy,
        changes: [{ ...legacyChange!, path: "src/\ud800.ts" }],
      }).success,
    ).toBe(true);

    const strong = strongSnapshot();
    const strongChange = strong.changes[0];
    expect(strongChange).toBeDefined();
    expect(
      StrongRepositorySnapshotV1Schema.safeParse({
        ...strong,
        changes: [{ ...strongChange!, path: "src/\ud800.ts" }],
      }).success,
    ).toBe(false);
  });

  it("uses independent path-safe ID brands and rejects legacy or uppercase wire values", () => {
    const validValues = [
      [PathSafeRepositoryIdV1Schema, `repo-hmac-${"a".repeat(64)}`],
      [PathSafeRepositorySnapshotIdV1Schema, `snapshot-${"b".repeat(64)}`],
      [PathSafeRepositoryChangeIdV1Schema, `change-${"c".repeat(64)}`],
      [PathSafeRepositoryRedactionIdV1Schema, `snapshot-redaction-${"d".repeat(64)}`],
      [PathSafeRepositoryUnknownStateIdV1Schema, `snapshot-unknown-state-${"e".repeat(64)}`],
    ] as const;
    for (const [schema, value] of validValues) {
      expect(schema.safeParse(value).success).toBe(true);
      expect(schema.safeParse(value.toUpperCase()).success).toBe(false);
      expect(schema.safeParse("snapshot:legacy").success).toBe(false);
    }
  });

  it("validates strong Snapshot accounting, ordering, capture closure, and object format", () => {
    const complete = strongSnapshot();
    const partial = strongSnapshot({ partial: true });
    expect(StrongRepositorySnapshotV1Schema.parse(complete)).toEqual(complete);
    expect(StrongRepositorySnapshotV1Schema.parse(partial)).toEqual(partial);
    expect(
      StrongRepositorySnapshotV1Schema.safeParse({
        ...complete,
        captureStatus: "partial",
      }).success,
    ).toBe(false);
    expect(
      StrongRepositorySnapshotV1Schema.safeParse({
        ...complete,
        accounting: { ...complete.accounting, candidateUnitCount: 2 },
      }).success,
    ).toBe(false);
    expect(
      StrongRepositorySnapshotV1Schema.safeParse({
        ...complete,
        objectFormat: "sha256",
      }).success,
    ).toBe(false);
    expect(
      StrongRepositorySnapshotV1Schema.safeParse({
        ...complete,
        repositoryId: "repository:legacy-path-derived",
      }).success,
    ).toBe(false);
    expect(
      StrongRepositorySnapshotV1Schema.safeParse({
        ...complete,
        debugPath: "/private/repository",
      }).success,
    ).toBe(false);
    const earlyChangeFields = {
      path: "src/a.ts",
      source: "staged",
      kind: "added",
      contentDigest: digest,
    } as const;
    const earlyChange = {
      id: derivePathSafeRepositoryChangeIdV1(
        earlyChangeFields,
        digestCanonicalJson,
      ),
      ...earlyChangeFields,
    };
    const twoChangeDraft = {
      ...complete,
      snapshotId: `snapshot-${"0".repeat(64)}`,
      accounting: {
        ...complete.accounting,
        rawLayerUnitCount: 2,
        candidateUnitCount: 2,
        safeChangeCount: 2,
      },
      changes: [earlyChange, complete.changes[0]!],
    };
    expect(StrongRepositorySnapshotV1Schema.safeParse(twoChangeDraft).success).toBe(true);
    expect(
      StrongRepositorySnapshotV1Schema.safeParse({
        ...twoChangeDraft,
        changes: [...twoChangeDraft.changes].reverse(),
      }).success,
    ).toBe(false);
    expect(
      StrongRepositorySnapshotV1Schema.safeParse({
        ...partial,
        changes: [partial.changes[0]!, partial.changes[0]!],
        accounting: {
          ...partial.accounting,
          rawLayerUnitCount: 4,
          candidateUnitCount: 4,
          safeChangeCount: 2,
        },
      }).success,
    ).toBe(false);
  });

  it("recomputes all four strong Snapshot identity families and rejects same-ID payload changes", () => {
    const sourceSnapshot = strongSnapshot({ partial: true });
    const trusted = parseTrustedStrongRepositorySnapshotV1(
      sourceSnapshot,
      digestCanonicalJson,
    );
    expect(trusted.snapshotId).toBe(sourceSnapshot.snapshotId);
    expect(sourceSnapshot.changes[0]?.id).toBe(
      "change-2a120b496c21f55841a935fcc8db37c7eabd4823cfa8cbb1de2e4d150dc50bb0",
    );
    expect(sourceSnapshot.redactedChanges[0]?.id).toBe(
      "snapshot-redaction-b2697cc1a2c243750383c264d69a04fc690319a6d7597e7bc3a62d6d31c81d43",
    );
    expect(sourceSnapshot.unknownStates[0]?.id).toBe(
      "snapshot-unknown-state-c8ac483a4d1d9e6e4def335a2a31af86383b131da49a0b4b3deb9f7e733f3625",
    );
    expect(sourceSnapshot.snapshotId).toBe(
      "snapshot-3836e0d1453d8e821af6b558bb648f5318cdddd16b9b58a0719ae0e8ce122a50",
    );
    expect(canonicalStrongRepositorySnapshotIdentityJsonV1(sourceSnapshot)).toContain(
      '"repository-snapshot-path-safe-v1"',
    );

    const artifact = {
      schemaVersion: 1,
      artifactType: "repository_snapshot",
      artifactId: "artifact:strong-snapshot:1",
      repositoryId: sourceSnapshot.repositoryId,
      worktreeId: sourceSnapshot.worktreeId,
      sourceSnapshotId: sourceSnapshot.snapshotId,
      revision: 0,
      producerVersion: "3.0.0-alpha.1",
      createdAt: sourceSnapshot.createdAt,
      contentDigest: digestCanonicalJson(canonicalizeJson(sourceSnapshot)),
      payload: sourceSnapshot,
    };
    expect(
      parseTrustedRepositorySnapshotArtifactV1(artifact, digestCanonicalJson),
    ).toEqual(artifact);

    const tampered = structuredClone(artifact);
    tampered.payload.createdAt = "2026-07-28T08:30:01Z";
    tampered.createdAt = tampered.payload.createdAt;
    tampered.contentDigest = digestCanonicalJson(
      canonicalizeJson(tampered.payload),
    );
    expect(RepositorySnapshotArtifactV1Schema.safeParse(tampered).success).toBe(true);
    expect(() =>
      parseTrustedRepositorySnapshotArtifactV1(tampered, digestCanonicalJson),
    ).toThrow("identity verification failed");
  });

  it("requires exact, code-only strong Pulse structure and count closure", () => {
    const pulse = strongPulse();
    expect(StrongRepoPulseV1Schema.parse(pulse)).toEqual(pulse);
    expect(
      parseTrustedStrongRepoPulseV1(
        pulse,
        strongSnapshot(),
        digestCanonicalJson,
      ),
    ).toEqual(pulse);
    expect(RepoPulsePersistedPayloadV1Schema.safeParse(pulse).success).toBe(true);
    expect(
      StrongRepoPulseV1Schema.safeParse({
        ...pulse,
        reasons: ["free-form degradation text"],
      }).success,
    ).toBe(false);
    expect(
      StrongRepoPulseV1Schema.safeParse({
        ...pulse,
        artifactFreshness: {
          graph: "fresh",
          wiki: "fresh",
          evidence: "fresh",
          diff: "fresh",
        },
      }).success,
    ).toBe(false);
    expect(
      StrongRepoPulseV1Schema.safeParse({
        ...pulse,
        changeSummary: { ...pulse.changeSummary, total: 2 },
      }).success,
    ).toBe(false);
    expect(
      StrongRepoPulseV1Schema.safeParse({
        ...pulse,
        status: "stale",
      }).success,
    ).toBe(false);
    const mismatchedPulse = {
      ...pulse,
      evaluatedSnapshotContentDigest: `sha256:${"f".repeat(64)}`,
    };
    expect(StrongRepoPulseV1Schema.safeParse(mismatchedPulse).success).toBe(true);
    expect(() =>
      parseTrustedStrongRepoPulseV1(
        mismatchedPulse,
        strongSnapshot(),
        digestCanonicalJson,
      ),
    ).toThrow("does not match its evaluated Repository Snapshot");

    const artifact = {
      schemaVersion: 1,
      artifactType: "repo_pulse",
      artifactId: "artifact:strong-pulse:1",
      repositoryId: pulse.repositoryState.repositoryId,
      worktreeId: pulse.repositoryState.worktreeId,
      sourceSnapshotId: pulse.evaluatedSnapshotId,
      revision: 0,
      producerVersion: "3.0.0-alpha.1",
      createdAt: pulse.evaluatedAt,
      contentDigest: digestCanonicalJson(canonicalizeJson(pulse)),
      payload: pulse,
    };
    expect(RepoPulseArtifactV1Schema.parse(artifact)).toEqual(artifact);
    expect(
      RepoPulseArtifactV1Schema.safeParse({
        ...artifact,
        repositoryId: `repo-hmac-${"f".repeat(64)}`,
      }).success,
    ).toBe(false);
  });

  it("accepts strict Surface fixtures and rejects raw legacy identity leakage", () => {
    const legacySnapshotSurface = jsonFixture(
      "surface/legacy-repository-snapshot-redacted.json",
    );
    const legacyPulseSurface = jsonFixture(
      "surface/legacy-repo-pulse-redacted.json",
    );
    expect(
      RepositorySnapshotSurfaceResponseV1Schema.safeParse(legacySnapshotSurface)
        .success,
    ).toBe(true);
    expect(
      RepoPulseSurfaceResponseV1Schema.safeParse(legacyPulseSurface).success,
    ).toBe(true);
    expect(
      RepositorySnapshotSurfaceResponseV1Schema.safeParse({
        ...(legacySnapshotSurface as Record<string, unknown>),
        repositoryId: "repository:legacy-path-derived",
        headCommit,
        indexDigest: digest,
      }).success,
    ).toBe(false);
    expect(
      RepoPulseSurfaceResponseV1Schema.safeParse({
        ...(legacyPulseSurface as Record<string, unknown>),
        evaluatedSnapshotId: "snapshot:legacy",
        rootIdentity: "root:/private/repository",
        reasons: ["raw diagnostic text"],
      }).success,
    ).toBe(false);
  });
});
