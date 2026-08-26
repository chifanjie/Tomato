import {
  ContextGenerationIdV1Schema,
  PathSafeRepositorySnapshotIdV1Schema,
  StrongCheckChangesInputV1Schema,
  VerificationPlanEntryIdV1Schema,
} from "@understand-code/contracts";
import { describe, expect, it } from "vitest";

import {
  deriveStrongActualChangeIdV1,
  deriveStrongDiffHunkIdentityV1,
  deriveStrongEffectiveRepositoryChangeIdV1,
  deriveStrongFindingIdV1,
  deriveStrongRepositoryDeltaSegmentIdV1,
  deriveStrongRepositoryPathDeltaIdV1,
  deriveStrongSourceSymbolRefIdV1,
  deriveStrongVerificationRecordIdV1,
} from "../src/strong-change-intelligence.js";

const digest = (digit: string): string => `sha256:${digit.repeat(64)}`;
const baselineSnapshotId = PathSafeRepositorySnapshotIdV1Schema.parse(
  `snapshot-${"a".repeat(64)}`,
);
const actualSnapshotId = PathSafeRepositorySnapshotIdV1Schema.parse(
  `snapshot-${"b".repeat(64)}`,
);
const before = {
  status: "content" as const,
  path: "src/a.ts",
  domain: "git_object" as const,
  objectId: "1".repeat(40),
  contentDigest: digest("1"),
  mode: "100644" as const,
  size: 10,
};
const after = {
  status: "content" as const,
  path: "src/a.ts",
  domain: "worktree_raw" as const,
  contentDigest: digest("2"),
  mode: "100644" as const,
  size: 12,
};

describe("strong Change Intelligence frozen identities", () => {
  const segmentFields = {
    baselineSnapshotId,
    actualSnapshotId,
    path: "src/a.ts",
    source: "unstaged" as const,
    before,
    after,
  };
  const segmentId = deriveStrongRepositoryDeltaSegmentIdV1(segmentFields);
  const effectiveFields = {
    baselineSnapshotId,
    actualSnapshotId,
    path: "src/a.ts",
    kind: "modified" as const,
    before,
    after,
    sourceSegmentIds: [segmentId],
  };
  const effectiveId = deriveStrongEffectiveRepositoryChangeIdV1(
    effectiveFields,
  );
  const pathFields = {
    baselineSnapshotId,
    actualSnapshotId,
    path: "src/a.ts",
    segmentIds: [segmentId],
    effectiveChangeId: effectiveId,
  };
  const pathId = deriveStrongRepositoryPathDeltaIdV1(pathFields);
  const hunkFields = {
    algorithm: "diff-lines-v1" as const,
    baselineSnapshotId,
    actualSnapshotId,
    path: "src/a.ts",
    beforeContent: { status: "content" as const, contentDigest: digest("1") },
    afterContent: { status: "content" as const, contentDigest: digest("2") },
    oldSpan: { startLine: 1, lineCount: 1 },
    newSpan: { startLine: 1, lineCount: 1 },
    sourceLayers: ["unstaged" as const],
    operations: [
      { op: "delete" as const, lineDigest: digest("3") },
      { op: "insert" as const, lineDigest: digest("4") },
    ],
  };
  const hunk = deriveStrongDiffHunkIdentityV1(hunkFields);
  const span = {
    start: { line: 1, column: 0, byteOffset: 0 },
    endExclusive: { line: 2, column: 0, byteOffset: 10 },
  };
  const symbolFields = {
    snapshotId: actualSnapshotId,
    path: "src/a.ts",
    language: "typescript",
    parserVersion: "1",
    kind: "function" as const,
    qualifiedName: "a",
    fullSpan: span,
    signatureSpan: span,
    bodySpan: span,
    declarationDigest: digest("5"),
    graphNodeId: "node:a",
  };
  const symbolId = deriveStrongSourceSymbolRefIdV1(symbolFields);
  const actualFields = {
    baselineSnapshotId,
    actualSnapshotId,
    repositoryPathDeltaId: pathId,
    effectiveChangeId: effectiveId,
    diffHunkIds: [hunk.id],
    granularity: "symbol" as const,
  };
  const actualId = deriveStrongActualChangeIdV1(actualFields);
  const findingFields = {
    taskId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    baselineSnapshotId,
    actualSnapshotId,
    type: "unplanned_change" as const,
    plannedChangeIds: [],
    actualChangeIds: [actualId],
    claimIds: ["claim:a"],
    evidenceIds: [`diff-evidence:${"c".repeat(22)}`],
    impactPathIds: [],
  };
  const findingId = deriveStrongFindingIdV1(findingFields);
  const verificationFields = {
    taskId: findingFields.taskId,
    contextGenerationId: ContextGenerationIdV1Schema.parse(
      `context-generation:${"d".repeat(22)}`,
    ),
    snapshotId: actualSnapshotId,
    changeCheckContentDigest: digest("6"),
    verificationPlanEntryId: VerificationPlanEntryIdV1Schema.parse(
      `verification-plan:${"e".repeat(22)}`,
    ),
    attempt: 1,
    method: "test" as const,
    status: "passed" as const,
    claimIds: ["claim:a"],
    publicResultCode: "verification_passed" as const,
    detail: { status: "none" as const },
  };

  it("matches the frozen golden IDs", () => {
    expect(segmentId).toBe(
      "repository-delta-segment:6a250f98b4187d47a5bd45",
    );
    expect(effectiveId).toBe(
      "repository-effective-change:5843d7008b1df2b3847700",
    );
    expect(pathId).toBe("repository-path-delta:8d53fee6c840c623076bd6");
    expect(hunk).toEqual({
      operationsDigest:
        "sha256:6f1e9720536b0b34d50d16e725959c86b86eebf8bc2d9a483a372c39dcbc2204",
      patchDigest:
        "sha256:7efbc08514791d678e412f2294b6bdb84342c7732bdf1275607499e985448aa5",
      id: "diff-hunk:e91d2f7f66801d7a2fcf0d",
    });
    expect(symbolId).toBe("source-symbol-ref:afa376d8c3d931ffedc981");
    expect(actualId).toBe("actual-change:24c3363d78590eafea9dc0");
    expect(findingId).toBe("change-finding:5a189c49aca1081a9b3711");
    expect(deriveStrongVerificationRecordIdV1(verificationFields)).toBe(
      "verification-record:01a67a36c5edfd02314d7f",
    );
  });

  it("changes every ID when one frozen field changes and ignores excluded fields", () => {
    expect(deriveStrongRepositoryDeltaSegmentIdV1({
      ...segmentFields,
      source: "staged",
    })).not.toBe(segmentId);
    expect(deriveStrongRepositoryDeltaSegmentIdV1({
      ...segmentFields,
      status: "unknown",
    } as typeof segmentFields)).toBe(segmentId);
    expect(deriveStrongEffectiveRepositoryChangeIdV1({
      ...effectiveFields,
      kind: "type_changed",
    })).not.toBe(effectiveId);
    expect(deriveStrongRepositoryPathDeltaIdV1({
      ...pathFields,
      segmentIds: [`repository-delta-segment:${"f".repeat(22)}`],
    })).not.toBe(pathId);
    expect(deriveStrongDiffHunkIdentityV1({
      ...hunkFields,
      newSpan: { startLine: 2, lineCount: 1 },
    }).id).not.toBe(hunk.id);
    expect(deriveStrongSourceSymbolRefIdV1({
      ...symbolFields,
      qualifiedName: "b",
    })).not.toBe(symbolId);
    expect(deriveStrongSourceSymbolRefIdV1({
      ...symbolFields,
      graphNodeId: "node:other",
    })).toBe(symbolId);
    expect(deriveStrongActualChangeIdV1({
      ...actualFields,
      diffHunkIds: [`diff-hunk:${"f".repeat(22)}`],
    })).not.toBe(actualId);
    expect(deriveStrongFindingIdV1({
      ...findingFields,
      claimIds: ["claim:b"],
    })).not.toBe(findingId);
    expect(deriveStrongVerificationRecordIdV1({
      ...verificationFields,
      status: "failed",
      publicResultCode: "verification_failed",
    })).not.toBe(deriveStrongVerificationRecordIdV1(verificationFields));
  });

  it("does not allow callers to report their own diff or IDs", () => {
    const safeInput = {
      profile: "check_changes_strong_v1",
      taskId: findingFields.taskId,
      actualSnapshotId,
      includeWorktree: true,
      expectedRevision: 5,
      idempotencyKey: "check-once",
      actor: "codex",
    };
    expect(StrongCheckChangesInputV1Schema.safeParse(safeInput).success).toBe(
      true,
    );
    expect(StrongCheckChangesInputV1Schema.safeParse({
      ...safeInput,
      repositoryDelta: { paths: [] },
      changeCheckId: "caller-selected",
      hunkIds: [],
    }).success).toBe(false);
  });
});
