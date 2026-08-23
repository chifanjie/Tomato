import { z } from "zod";
import {
  createArtifactEnvelopeV1Schema,
  verifyArtifactContentDigestV1,
} from "./artifact-envelope.js";
import { canonicalizeJson } from "./canonical-json.js";
import {
  ContentDigestSchema,
  GitObjectIdSchema,
  IsoTimestampSchema,
  KeyedStateTokenV1Schema,
  NonEmptyStringSchema,
  OpaqueIdentifierSchema,
  PathSafeRepositoryChangeIdV1Schema,
  PathSafeRepositoryIdV1Schema,
  PathSafeRepositoryRedactionIdV1Schema,
  PathSafeRepositoryRelativePathV1Schema,
  PathSafeRepositorySnapshotIdV1Schema,
  PathSafeRepositoryUnknownStateIdV1Schema,
  PathSafeRootIdentityV1Schema,
  PathSafeWorktreeIdV1Schema,
  RepositoryIdSchema,
  RepositoryRelativePathSchema,
  RootIdentitySchema,
  SchemaVersionV1Schema,
  SnapshotIdSchema,
  WorktreeIdSchema,
  isUnicodeScalarStringV1,
  lowerHex64FromContentDigestV1,
} from "./primitives.js";

export const RepositoryChangeSourceV1Schema = z.enum([
  "committed",
  "staged",
  "unstaged",
  "untracked",
  "conflict",
]);

export const RepositoryChangeKindV1Schema = z.enum([
  "added",
  "modified",
  "deleted",
  "renamed",
  "copied",
  "type_changed",
]);

export const RepositoryChangeV1Schema = z
  .strictObject({
    id: OpaqueIdentifierSchema,
    path: RepositoryRelativePathSchema,
    oldPath: RepositoryRelativePathSchema.optional(),
    source: RepositoryChangeSourceV1Schema,
    kind: RepositoryChangeKindV1Schema,
    contentDigest: ContentDigestSchema.optional(),
    previousContentDigest: ContentDigestSchema.optional(),
  })
  .superRefine((change, context) => {
    const carriesOldPath = change.kind === "renamed" || change.kind === "copied";
    if (carriesOldPath && change.oldPath === undefined) {
      context.addIssue({
        code: "custom",
        path: ["oldPath"],
        message: `${change.kind} changes require oldPath; path is the new path`,
      });
    }
    if (!carriesOldPath && change.oldPath !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["oldPath"],
        message: `${change.kind} changes must not include oldPath`,
      });
    }
    if (change.oldPath === change.path) {
      context.addIssue({
        code: "custom",
        path: ["oldPath"],
        message: "oldPath must differ from path",
      });
    }
  });

export const RepositoryCaptureStatusV1Schema = z.enum(["complete", "partial", "error"]);

export const RepositorySnapshotV1Schema = z
  .strictObject({
    schemaVersion: SchemaVersionV1Schema,
    snapshotId: SnapshotIdSchema,
    repositoryId: RepositoryIdSchema,
    worktreeId: WorktreeIdSchema,
    rootIdentity: RootIdentitySchema,
    branch: z.string().min(1).max(1_024).optional(),
    headCommit: GitObjectIdSchema.optional(),
    baseCommit: GitObjectIdSchema.optional(),
    mergeBase: GitObjectIdSchema.optional(),
    indexDigest: ContentDigestSchema,
    worktreeDigest: ContentDigestSchema,
    untrackedDigest: ContentDigestSchema,
    ignoreDigest: ContentDigestSchema,
    createdAt: IsoTimestampSchema,
    captureStatus: RepositoryCaptureStatusV1Schema,
    limitations: z.array(z.string().min(1).max(4_096)),
    changes: z.array(RepositoryChangeV1Schema),
  })
  .superRefine((snapshot, context) => {
    if (
      (snapshot.captureStatus === "complete" ||
        snapshot.captureStatus === "partial") &&
      snapshot.headCommit === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["headCommit"],
        message: `${snapshot.captureStatus} captures require headCommit`,
      });
    }
    if (
      snapshot.headCommit === undefined &&
      (snapshot.baseCommit !== undefined || snapshot.mergeBase !== undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["headCommit"],
        message: "baseCommit and mergeBase require headCommit",
      });
    }
    if (snapshot.captureStatus !== "complete" && snapshot.limitations.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["limitations"],
        message: `${snapshot.captureStatus} captures require at least one limitation`,
      });
    }
    const changeIds = new Set<string>();
    snapshot.changes.forEach((change, index) => {
      if (changeIds.has(change.id)) {
        context.addIssue({
          code: "custom",
          path: ["changes", index, "id"],
          message: `duplicate repository change ID: ${change.id}`,
        });
      }
      changeIds.add(change.id);
    });
  });

/** Explicit alias used by the persisted reader union; bytes remain unchanged. */
export const LegacyRepositorySnapshotV1Schema = RepositorySnapshotV1Schema;

export const RepositoryObjectFormatV1Schema = z.enum(["sha1", "sha256"]);

export const RepositorySnapshotBoundaryCodeV1Schema = z.enum([
  "hard_deny_path",
  "sensitive_path",
  "secret_content",
  "invalid_utf8",
  "control_character",
  "branch_value_oversized",
  "unsafe_git_ref",
  "scan_unit_oversized",
  "scan_capture_limit",
  "unstable_read",
  "unrepresentable_path",
  "unsafe_file_kind",
]);

export const RepositoryBranchRedactionCodeV1Schema = z.enum([
  "sensitive_path",
  "secret_content",
  "invalid_utf8",
  "control_character",
  "branch_value_oversized",
  "unsafe_git_ref",
]);

export const RepositoryStateUncertaintyCodeV1Schema = z.enum([
  "hard_deny_equality_unprovable",
  "scan_unit_limit_equality_unprovable",
  "scan_capture_limit_equality_unprovable",
  "unstable_read",
  "unreadable",
  "unrepresentable_path",
  "unsafe_file_kind",
]);

export const RepositoryBranchStateV1Schema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("detached") }),
  z.strictObject({
    status: z.literal("safe"),
    name: NonEmptyStringSchema.refine(
      isUnicodeScalarStringV1,
      "safe branch name must contain only Unicode scalar values representable as UTF-8",
    ),
  }),
  z.strictObject({
    status: z.literal("redacted"),
    boundaryCode: RepositoryBranchRedactionCodeV1Schema,
  }),
]);

export const RepositoryHeadStateV1Schema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("commit"), commit: GitObjectIdSchema }),
  z.strictObject({
    kind: z.literal("unborn"),
    emptyTreeObjectId: GitObjectIdSchema,
  }),
]);

export const PathSafeRepositoryChangeV1Schema = z
  .strictObject({
    id: PathSafeRepositoryChangeIdV1Schema,
    path: PathSafeRepositoryRelativePathV1Schema,
    oldPath: PathSafeRepositoryRelativePathV1Schema.optional(),
    source: RepositoryChangeSourceV1Schema,
    kind: RepositoryChangeKindV1Schema,
    contentDigest: ContentDigestSchema.optional(),
    previousContentDigest: ContentDigestSchema.optional(),
  })
  .superRefine((change, context) => {
    const carriesOldPath = change.kind === "renamed" || change.kind === "copied";
    if (carriesOldPath && change.oldPath === undefined) {
      context.addIssue({
        code: "custom",
        path: ["oldPath"],
        message: `${change.kind} changes require oldPath; path is the new path`,
      });
    }
    if (!carriesOldPath && change.oldPath !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["oldPath"],
        message: `${change.kind} changes must not include oldPath`,
      });
    }
    if (change.oldPath === change.path) {
      context.addIssue({
        code: "custom",
        path: ["oldPath"],
        message: "oldPath must differ from path",
      });
    }
  });

const PositiveSafeIntegerV1Schema = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
const NonnegativeSafeIntegerV1Schema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

export const RedactedRepositoryChangeAggregateV1Schema = z.strictObject({
  id: PathSafeRepositoryRedactionIdV1Schema,
  source: RepositoryChangeSourceV1Schema,
  kind: RepositoryChangeKindV1Schema,
  boundaryCode: RepositorySnapshotBoundaryCodeV1Schema,
  count: PositiveSafeIntegerV1Schema,
});

export const OpaqueRepositoryStateAggregateV1Schema = z.strictObject({
  id: PathSafeRepositoryUnknownStateIdV1Schema,
  code: RepositoryStateUncertaintyCodeV1Schema,
  count: PositiveSafeIntegerV1Schema,
});

export const RepositoryCaptureAccountingV1Schema = z.strictObject({
  rawLayerUnitCount: NonnegativeSafeIntegerV1Schema,
  candidateUnitCount: NonnegativeSafeIntegerV1Schema,
  safeChangeCount: NonnegativeSafeIntegerV1Schema,
  redactedKnownChangeCount: NonnegativeSafeIntegerV1Schema,
  unknownStateCount: NonnegativeSafeIntegerV1Schema,
});

const STRONG_SOURCE_ORDER: Readonly<Record<z.infer<typeof RepositoryChangeSourceV1Schema>, number>> = {
  committed: 0,
  staged: 1,
  unstaged: 2,
  untracked: 3,
  conflict: 4,
};
const STRONG_KIND_ORDER: Readonly<Record<z.infer<typeof RepositoryChangeKindV1Schema>, number>> = {
  added: 0,
  modified: 1,
  deleted: 2,
  renamed: 3,
  copied: 4,
  type_changed: 5,
};

function compareStringsV1(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareUtf8StringsV1(left: string, right: string): number {
  // For Unicode scalar sequences, lexicographic scalar order is identical to
  // lexicographic UTF-8 byte order because UTF-8 preserves code-point order.
  // Avoid a host-global TextEncoder dependency so the packed Contracts build
  // remains portable and cannot apply replacement semantics to lone surrogates.
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    const leftCodePoint = left.codePointAt(leftIndex)!;
    const rightCodePoint = right.codePointAt(rightIndex)!;
    const difference = leftCodePoint - rightCodePoint;
    if (difference !== 0) return difference;
    leftIndex += leftCodePoint > 0xffff ? 2 : 1;
    rightIndex += rightCodePoint > 0xffff ? 2 : 1;
  }
  return leftIndex < left.length ? 1 : rightIndex < right.length ? -1 : 0;
}

function comparePathSafeChangesV1(
  left: z.infer<typeof PathSafeRepositoryChangeV1Schema>,
  right: z.infer<typeof PathSafeRepositoryChangeV1Schema>,
): number {
  return (
    STRONG_SOURCE_ORDER[left.source] - STRONG_SOURCE_ORDER[right.source] ||
    compareUtf8StringsV1(left.path, right.path) ||
    compareUtf8StringsV1(left.oldPath ?? "", right.oldPath ?? "") ||
    STRONG_KIND_ORDER[left.kind] - STRONG_KIND_ORDER[right.kind] ||
    compareStringsV1(left.id, right.id)
  );
}

function compareRedactedChangesV1(
  left: z.infer<typeof RedactedRepositoryChangeAggregateV1Schema>,
  right: z.infer<typeof RedactedRepositoryChangeAggregateV1Schema>,
): number {
  return (
    STRONG_SOURCE_ORDER[left.source] - STRONG_SOURCE_ORDER[right.source] ||
    STRONG_KIND_ORDER[left.kind] - STRONG_KIND_ORDER[right.kind] ||
    compareStringsV1(left.boundaryCode, right.boundaryCode) ||
    compareStringsV1(left.id, right.id)
  );
}

function compareUnknownStatesV1(
  left: z.infer<typeof OpaqueRepositoryStateAggregateV1Schema>,
  right: z.infer<typeof OpaqueRepositoryStateAggregateV1Schema>,
): number {
  return compareStringsV1(left.code, right.code) || compareStringsV1(left.id, right.id);
}

function validateStrictOrderV1<T>(
  values: readonly T[],
  compare: (left: T, right: T) => number,
  context: z.RefinementCtx,
  path: string,
): void {
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (previous !== undefined && current !== undefined && compare(previous, current) >= 0) {
      context.addIssue({
        code: "custom",
        path: [path, index],
        message: `${path} must be strictly sorted and tuple-unique`,
      });
      return;
    }
  }
}

function validateGitObjectFormatV1(
  objectFormat: z.infer<typeof RepositoryObjectFormatV1Schema>,
  objectId: string,
  context: z.RefinementCtx,
  path: PropertyKey[],
): void {
  const expectedLength = objectFormat === "sha1" ? 40 : 64;
  if (objectId.length !== expectedLength) {
    context.addIssue({
      code: "custom",
      path,
      message: `${objectFormat} object IDs must contain ${expectedLength} lowercase hex characters`,
    });
  }
}

export const StrongRepositorySnapshotV1Schema = z
  .strictObject({
    schemaVersion: SchemaVersionV1Schema,
    profile: z.literal("repository_snapshot_path_safe_v1"),
    snapshotId: PathSafeRepositorySnapshotIdV1Schema,
    repositoryId: PathSafeRepositoryIdV1Schema,
    worktreeId: PathSafeWorktreeIdV1Schema,
    rootIdentity: PathSafeRootIdentityV1Schema,
    branchState: RepositoryBranchStateV1Schema,
    objectFormat: RepositoryObjectFormatV1Schema,
    headState: RepositoryHeadStateV1Schema,
    baseCommit: GitObjectIdSchema.optional(),
    mergeBase: GitObjectIdSchema.optional(),
    repositoryStateToken: KeyedStateTokenV1Schema,
    indexToken: KeyedStateTokenV1Schema,
    worktreeToken: KeyedStateTokenV1Schema,
    untrackedToken: KeyedStateTokenV1Schema,
    ignoreToken: KeyedStateTokenV1Schema,
    securityScanPolicyDigest: ContentDigestSchema,
    safeGitExecutionDigest: ContentDigestSchema,
    createdAt: IsoTimestampSchema,
    captureStatus: z.enum(["complete", "partial"]),
    accounting: RepositoryCaptureAccountingV1Schema,
    changes: z.array(PathSafeRepositoryChangeV1Schema),
    redactedChanges: z.array(RedactedRepositoryChangeAggregateV1Schema),
    unknownStates: z.array(OpaqueRepositoryStateAggregateV1Schema),
  })
  .superRefine((snapshot, context) => {
    const headObjectId = snapshot.headState.kind === "commit"
      ? snapshot.headState.commit
      : snapshot.headState.emptyTreeObjectId;
    validateGitObjectFormatV1(snapshot.objectFormat, headObjectId, context, ["headState"]);
    if (snapshot.baseCommit !== undefined) {
      validateGitObjectFormatV1(snapshot.objectFormat, snapshot.baseCommit, context, ["baseCommit"]);
    }
    if (snapshot.mergeBase !== undefined) {
      validateGitObjectFormatV1(snapshot.objectFormat, snapshot.mergeBase, context, ["mergeBase"]);
    }
    if (
      snapshot.headState.kind === "unborn" &&
      (snapshot.baseCommit !== undefined || snapshot.mergeBase !== undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["headState"],
        message: "unborn repositories must not carry baseCommit or mergeBase",
      });
    }
    if (snapshot.mergeBase !== undefined && snapshot.baseCommit === undefined) {
      context.addIssue({
        code: "custom",
        path: ["mergeBase"],
        message: "mergeBase requires baseCommit",
      });
    }

    validateStrictOrderV1(snapshot.changes, comparePathSafeChangesV1, context, "changes");
    validateStrictOrderV1(
      snapshot.redactedChanges,
      compareRedactedChangesV1,
      context,
      "redactedChanges",
    );
    validateStrictOrderV1(
      snapshot.unknownStates,
      compareUnknownStatesV1,
      context,
      "unknownStates",
    );
    for (const [path, values] of [
      ["changes", snapshot.changes],
      ["redactedChanges", snapshot.redactedChanges],
      ["unknownStates", snapshot.unknownStates],
    ] as const) {
      const ids = new Set<string>();
      values.forEach((entry, index) => {
        if (ids.has(entry.id)) {
          context.addIssue({
            code: "custom",
            path: [path, index, "id"],
            message: `${path} must not contain a duplicate strong ID`,
          });
        }
        ids.add(entry.id);
      });
    }

    const redactedKnownChangeCount = snapshot.redactedChanges.reduce(
      (total, entry) => total + entry.count,
      0,
    );
    const unknownStateCount = snapshot.unknownStates.reduce(
      (total, entry) => total + entry.count,
      0,
    );
    const candidateUnitCount =
      snapshot.changes.length + redactedKnownChangeCount + unknownStateCount;
    const expectedAccounting = {
      candidateUnitCount,
      safeChangeCount: snapshot.changes.length,
      redactedKnownChangeCount,
      unknownStateCount,
    } as const;
    for (const [field, expected] of Object.entries(expectedAccounting)) {
      if (snapshot.accounting[field as keyof typeof expectedAccounting] !== expected) {
        context.addIssue({
          code: "custom",
          path: ["accounting", field],
          message: `${field} must equal the exact safe/redacted/unknown capture count`,
        });
      }
    }
    if (snapshot.accounting.rawLayerUnitCount < snapshot.accounting.candidateUnitCount) {
      context.addIssue({
        code: "custom",
        path: ["accounting", "rawLayerUnitCount"],
        message: "rawLayerUnitCount must cover every candidate unit",
      });
    }

    const hasSecurityBoundary =
      snapshot.redactedChanges.length > 0 ||
      snapshot.unknownStates.length > 0 ||
      snapshot.branchState.status === "redacted";
    if (snapshot.captureStatus === "complete" && hasSecurityBoundary) {
      context.addIssue({
        code: "custom",
        path: ["captureStatus"],
        message: "complete strong captures cannot contain redacted or unknown state",
      });
    }
    if (snapshot.captureStatus === "partial" && !hasSecurityBoundary) {
      context.addIssue({
        code: "custom",
        path: ["captureStatus"],
        message: "partial strong captures require a branch, change, or state security boundary",
      });
    }
  });

export const RepositorySnapshotPersistedPayloadV1Schema = z.union([
  LegacyRepositorySnapshotV1Schema,
  StrongRepositorySnapshotV1Schema,
]);

type DigestCanonicalJsonV1 = (canonicalJson: string) => string;

function canonicalStrongIdentityJsonV1(domain: string, fields: unknown): string {
  return canonicalizeJson([domain, fields]);
}

function strongIdentityHexV1(
  domain: string,
  fields: unknown,
  digestCanonicalJson: DigestCanonicalJsonV1,
): string {
  return lowerHex64FromContentDigestV1(
    digestCanonicalJson(canonicalStrongIdentityJsonV1(domain, fields)),
  );
}

function pathSafeChangeIdentityFieldsV1(
  change: PathSafeRepositoryChangeIdentityInputV1,
): PathSafeRepositoryChangeIdentityFieldsV1 {
  return {
    path: change.path,
    ...(change.oldPath === undefined ? {} : { oldPath: change.oldPath }),
    source: change.source,
    kind: change.kind,
    ...(change.contentDigest === undefined
      ? {}
      : { contentDigest: change.contentDigest }),
    ...(change.previousContentDigest === undefined
      ? {}
      : { previousContentDigest: change.previousContentDigest }),
  };
}

export function canonicalPathSafeRepositoryChangeIdentityJsonV1(
  change: PathSafeRepositoryChangeIdentityInputV1,
): string {
  return canonicalStrongIdentityJsonV1(
    "path-safe-repository-change-v1",
    pathSafeChangeIdentityFieldsV1(change),
  );
}

export function derivePathSafeRepositoryChangeIdV1(
  change: PathSafeRepositoryChangeIdentityInputV1,
  digestCanonicalJson: DigestCanonicalJsonV1,
): z.output<typeof PathSafeRepositoryChangeIdV1Schema> {
  return PathSafeRepositoryChangeIdV1Schema.parse(
    `change-${lowerHex64FromContentDigestV1(
      digestCanonicalJson(canonicalPathSafeRepositoryChangeIdentityJsonV1(change)),
    )}`,
  );
}

export function derivePathSafeRepositoryRedactionIdV1(
  fields: RepositoryRedactionIdentityFieldsV1,
  digestCanonicalJson: DigestCanonicalJsonV1,
): z.output<typeof PathSafeRepositoryRedactionIdV1Schema> {
  return PathSafeRepositoryRedactionIdV1Schema.parse(
    `snapshot-redaction-${strongIdentityHexV1(
      "repository-snapshot-redaction-v1",
      fields,
      digestCanonicalJson,
    )}`,
  );
}

export function derivePathSafeRepositoryUnknownStateIdV1(
  fields: RepositoryUnknownStateIdentityFieldsV1,
  digestCanonicalJson: DigestCanonicalJsonV1,
): z.output<typeof PathSafeRepositoryUnknownStateIdV1Schema> {
  return PathSafeRepositoryUnknownStateIdV1Schema.parse(
    `snapshot-unknown-state-${strongIdentityHexV1(
      "repository-snapshot-unknown-state-v1",
      fields,
      digestCanonicalJson,
    )}`,
  );
}

function strongRepositorySnapshotIdentityFieldsV1(
  snapshot: StrongRepositorySnapshotIdentityInputV1,
): StrongRepositorySnapshotIdentityFieldsV1 {
  return {
    schemaVersion: snapshot.schemaVersion,
    profile: snapshot.profile,
    repositoryId: snapshot.repositoryId,
    worktreeId: snapshot.worktreeId,
    rootIdentity: snapshot.rootIdentity,
    branchState: snapshot.branchState,
    objectFormat: snapshot.objectFormat,
    headState: snapshot.headState,
    ...(snapshot.baseCommit === undefined
      ? {}
      : { baseCommit: snapshot.baseCommit }),
    ...(snapshot.mergeBase === undefined
      ? {}
      : { mergeBase: snapshot.mergeBase }),
    repositoryStateToken: snapshot.repositoryStateToken,
    indexToken: snapshot.indexToken,
    worktreeToken: snapshot.worktreeToken,
    untrackedToken: snapshot.untrackedToken,
    ignoreToken: snapshot.ignoreToken,
    securityScanPolicyDigest: snapshot.securityScanPolicyDigest,
    safeGitExecutionDigest: snapshot.safeGitExecutionDigest,
    captureStatus: snapshot.captureStatus,
    accounting: snapshot.accounting,
    changes: snapshot.changes,
    redactedChanges: snapshot.redactedChanges,
    unknownStates: snapshot.unknownStates,
    createdAt: snapshot.createdAt,
  };
}

export function canonicalStrongRepositorySnapshotIdentityJsonV1(
  snapshot: StrongRepositorySnapshotIdentityInputV1,
): string {
  return canonicalStrongIdentityJsonV1(
    "repository-snapshot-path-safe-v1",
    strongRepositorySnapshotIdentityFieldsV1(snapshot),
  );
}

export function derivePathSafeRepositorySnapshotIdV1(
  snapshot: StrongRepositorySnapshotIdentityInputV1,
  digestCanonicalJson: DigestCanonicalJsonV1,
): z.output<typeof PathSafeRepositorySnapshotIdV1Schema> {
  return PathSafeRepositorySnapshotIdV1Schema.parse(
    `snapshot-${lowerHex64FromContentDigestV1(
      digestCanonicalJson(canonicalStrongRepositorySnapshotIdentityJsonV1(snapshot)),
    )}`,
  );
}

export interface StrongRepositorySnapshotIdentityIssueV1 {
  readonly path: readonly PropertyKey[];
  readonly actualId: string;
  readonly expectedId: string;
}

export interface StrongRepositorySnapshotIdentityResultV1 {
  readonly valid: boolean;
  readonly issues: readonly StrongRepositorySnapshotIdentityIssueV1[];
}

export function verifyStrongRepositorySnapshotIdentityV1(
  snapshot: StrongRepositorySnapshotV1,
  digestCanonicalJson: DigestCanonicalJsonV1,
): StrongRepositorySnapshotIdentityResultV1 {
  const issues: StrongRepositorySnapshotIdentityIssueV1[] = [];
  snapshot.changes.forEach((change, index) => {
    const expectedId = derivePathSafeRepositoryChangeIdV1(
      change,
      digestCanonicalJson,
    );
    if (change.id !== expectedId) {
      issues.push({ path: ["changes", index, "id"], actualId: change.id, expectedId });
    }
  });
  snapshot.redactedChanges.forEach((aggregate, index) => {
    const expectedId = derivePathSafeRepositoryRedactionIdV1(
      {
        repositoryId: snapshot.repositoryId,
        worktreeId: snapshot.worktreeId,
        repositoryStateToken: snapshot.repositoryStateToken,
        source: aggregate.source,
        kind: aggregate.kind,
        boundaryCode: aggregate.boundaryCode,
        count: aggregate.count,
      },
      digestCanonicalJson,
    );
    if (aggregate.id !== expectedId) {
      issues.push({
        path: ["redactedChanges", index, "id"],
        actualId: aggregate.id,
        expectedId,
      });
    }
  });
  snapshot.unknownStates.forEach((aggregate, index) => {
    const expectedId = derivePathSafeRepositoryUnknownStateIdV1(
      {
        repositoryId: snapshot.repositoryId,
        worktreeId: snapshot.worktreeId,
        repositoryStateToken: snapshot.repositoryStateToken,
        code: aggregate.code,
        count: aggregate.count,
      },
      digestCanonicalJson,
    );
    if (aggregate.id !== expectedId) {
      issues.push({
        path: ["unknownStates", index, "id"],
        actualId: aggregate.id,
        expectedId,
      });
    }
  });
  const expectedSnapshotId = derivePathSafeRepositorySnapshotIdV1(
    snapshot,
    digestCanonicalJson,
  );
  if (snapshot.snapshotId !== expectedSnapshotId) {
    issues.push({
      path: ["snapshotId"],
      actualId: snapshot.snapshotId,
      expectedId: expectedSnapshotId,
    });
  }
  return { valid: issues.length === 0, issues };
}

export class StrongRepositorySnapshotIdentityErrorV1 extends TypeError {
  readonly issues: readonly StrongRepositorySnapshotIdentityIssueV1[];

  constructor(issues: readonly StrongRepositorySnapshotIdentityIssueV1[]) {
    super("strong Repository Snapshot identity verification failed");
    this.name = "StrongRepositorySnapshotIdentityErrorV1";
    this.issues = issues;
  }
}

export function parseTrustedStrongRepositorySnapshotV1(
  input: unknown,
  digestCanonicalJson: DigestCanonicalJsonV1,
): StrongRepositorySnapshotV1 {
  const snapshot = StrongRepositorySnapshotV1Schema.parse(input);
  const result = verifyStrongRepositorySnapshotIdentityV1(
    snapshot,
    digestCanonicalJson,
  );
  if (!result.valid) {
    throw new StrongRepositorySnapshotIdentityErrorV1(result.issues);
  }
  return snapshot;
}

export const ArtifactFreshnessV1Schema = z.enum([
  "fresh",
  "partial",
  "stale",
  "missing",
  "error",
]);

export const RepoPulseStatusV1Schema = z.enum([
  "not_ready",
  "fresh",
  "partial",
  "stale",
  "unknown",
  "rebuilding",
  "error",
]);

export const REPO_PULSE_REQUIRED_ARTIFACT_KEYS_V1 = Object.freeze([
  "graph",
  "wiki",
  "evidence",
  "diff",
  "task",
] as const);

const RepoPulseCountV1Schema = z.number().int().nonnegative();

export const RepoPulseRepositoryStateV1Schema = z
  .strictObject({
    rootIdentity: RootIdentitySchema,
    branch: z.string().min(1).max(1_024).optional(),
    baselineCommit: GitObjectIdSchema.optional(),
    headCommit: GitObjectIdSchema.optional(),
    mergeBase: GitObjectIdSchema.optional(),
    ahead: RepoPulseCountV1Schema.optional(),
    behind: RepoPulseCountV1Schema.optional(),
    captureStatus: RepositoryCaptureStatusV1Schema,
    limitations: z.array(z.string().min(1).max(4_096)),
  })
  .superRefine((state, context) => {
    if ((state.ahead === undefined) !== (state.behind === undefined)) {
      context.addIssue({
        code: "custom",
        path: [state.ahead === undefined ? "ahead" : "behind"],
        message: "ahead and behind must either both be present or both be absent",
      });
    }
    if (
      (state.ahead !== undefined ||
        state.behind !== undefined ||
        state.mergeBase !== undefined) &&
      (state.baselineCommit === undefined || state.headCommit === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["baselineCommit"],
        message:
          "ahead, behind, and mergeBase require both baselineCommit and headCommit",
      });
    }
    if (
      (state.captureStatus === "complete" ||
        state.captureStatus === "partial") &&
      state.headCommit === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["headCommit"],
        message: `${state.captureStatus} repository pulse state requires headCommit`,
      });
    }
    if (
      state.captureStatus !== "complete" &&
      state.limitations.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["limitations"],
        message: `${state.captureStatus} repository pulse state requires at least one limitation`,
      });
    }
  });

export const RepoPulseChangeSummaryV1Schema = z
  .strictObject({
    total: RepoPulseCountV1Schema,
    bySource: z.strictObject({
      committed: RepoPulseCountV1Schema,
      staged: RepoPulseCountV1Schema,
      unstaged: RepoPulseCountV1Schema,
      untracked: RepoPulseCountV1Schema,
      conflict: RepoPulseCountV1Schema,
    }),
    byKind: z.strictObject({
      added: RepoPulseCountV1Schema,
      modified: RepoPulseCountV1Schema,
      deleted: RepoPulseCountV1Schema,
      renamed: RepoPulseCountV1Schema,
      copied: RepoPulseCountV1Schema,
      type_changed: RepoPulseCountV1Schema,
    }),
  })
  .superRefine((summary, context) => {
    const sourceTotal = Object.values(summary.bySource).reduce(
      (total, count) => total + count,
      0,
    );
    const kindTotal = Object.values(summary.byKind).reduce(
      (total, count) => total + count,
      0,
    );
    if (sourceTotal !== summary.total) {
      context.addIssue({
        code: "custom",
        path: ["bySource"],
        message: "change source counts must add up to total",
      });
    }
    if (kindTotal !== summary.total) {
      context.addIssue({
        code: "custom",
        path: ["byKind"],
        message: "change kind counts must add up to total",
      });
    }
  });

export const RepoPulseCompletenessStatusV1Schema = z.enum([
  "complete",
  "partial",
  "unknown",
  "unsupported",
]);

export const RepoPulseCompletenessComponentV1Schema = z
  .strictObject({
    status: RepoPulseCompletenessStatusV1Schema,
    coverage: z.number().min(0).max(1).optional(),
    reasons: z.array(z.string().min(1).max(4_096)),
  })
  .superRefine((component, context) => {
    if (component.status !== "complete" && component.reasons.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["reasons"],
        message: `${component.status} completeness requires at least one reason`,
      });
    }
    if (
      component.status === "complete" &&
      component.coverage !== undefined &&
      component.coverage !== 1
    ) {
      context.addIssue({
        code: "custom",
        path: ["coverage"],
        message: "complete coverage, when reported, must equal 1",
      });
    }
  });

export const RepoPulseCompletenessV1Schema = z.strictObject({
  parser: RepoPulseCompletenessComponentV1Schema,
  callGraph: RepoPulseCompletenessComponentV1Schema,
});

export const RepoPulseRecommendedRefreshV1Schema = z.enum([
  "none",
  "incremental",
  "full",
]);

export const RepoPulseDiagnosticV1Schema = z.strictObject({
  code: OpaqueIdentifierSchema,
  scope: z.enum([
    "repository",
    "git",
    "artifact",
    "parser",
    "call_graph",
    "refresh",
  ]),
  message: z.string().min(1).max(4_096),
});

export const RepoPulseV1Schema = z
  .strictObject({
    evaluatedSnapshotId: SnapshotIdSchema,
    baselineSnapshotId: SnapshotIdSchema.optional(),
    status: RepoPulseStatusV1Schema,
    artifactFreshness: z
      .record(z.string().min(1), ArtifactFreshnessV1Schema)
      .refine(
        (freshness) => Object.keys(freshness).length > 0,
        "artifactFreshness must report at least one artifact",
      ),
    repositoryState: RepoPulseRepositoryStateV1Schema.optional(),
    changeSummary: RepoPulseChangeSummaryV1Schema.optional(),
    completeness: RepoPulseCompletenessV1Schema.optional(),
    recommendedRefresh: RepoPulseRecommendedRefreshV1Schema.optional(),
    errors: z.array(RepoPulseDiagnosticV1Schema).optional(),
    unknowns: z.array(RepoPulseDiagnosticV1Schema).optional(),
    reasons: z.array(z.string().min(1).max(4_096)),
    evaluatedAt: IsoTimestampSchema,
  })
  .superRefine((pulse, context) => {
    if (pulse.status === "fresh") {
      for (const field of [
        "repositoryState",
        "changeSummary",
        "completeness",
        "recommendedRefresh",
        "errors",
        "unknowns",
      ] as const) {
        if (pulse[field] === undefined) {
          context.addIssue({
            code: "custom",
            path: [field],
            message: `fresh repository pulse requires ${field}`,
          });
        }
      }
      for (const artifactKey of REPO_PULSE_REQUIRED_ARTIFACT_KEYS_V1) {
        if (pulse.artifactFreshness[artifactKey] === undefined) {
          context.addIssue({
            code: "custom",
            path: ["artifactFreshness", artifactKey],
            message: `fresh repository pulse must report ${artifactKey} freshness`,
          });
        }
      }
    }
    if (pulse.status !== "fresh" && pulse.reasons.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["reasons"],
        message: `${pulse.status} repository pulse requires at least one reason`,
      });
    }
    if (pulse.status === "fresh" && pulse.reasons.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["reasons"],
        message: "fresh repository pulse must not include degradation reasons",
      });
    }

    if (
      pulse.status === "fresh" &&
      Object.values(pulse.artifactFreshness).some(
        (freshness) => freshness !== "fresh",
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["artifactFreshness"],
        message: "fresh repository pulse requires every artifact to be fresh",
      });
    }
    if (
      pulse.status === "fresh" &&
      pulse.repositoryState !== undefined &&
      pulse.repositoryState.captureStatus !== "complete"
    ) {
      context.addIssue({
        code: "custom",
        path: ["repositoryState", "captureStatus"],
        message: "fresh repository pulse requires a complete repository capture",
      });
    }
    if (
      pulse.status === "fresh" &&
      pulse.completeness !== undefined &&
      (pulse.completeness.parser.status !== "complete" ||
        pulse.completeness.callGraph.status !== "complete")
    ) {
      context.addIssue({
        code: "custom",
        path: ["completeness"],
        message:
          "fresh repository pulse requires complete parser and call graph coverage",
      });
    }
    if (
      pulse.status === "fresh" &&
      ((pulse.errors?.length ?? 0) > 0 ||
        (pulse.unknowns?.length ?? 0) > 0)
    ) {
      context.addIssue({
        code: "custom",
        path: [(pulse.errors?.length ?? 0) > 0 ? "errors" : "unknowns"],
        message: "fresh repository pulse must not contain errors or unknowns",
      });
    }
    if (
      pulse.status === "fresh" &&
      pulse.recommendedRefresh !== undefined &&
      pulse.recommendedRefresh !== "none"
    ) {
      context.addIssue({
        code: "custom",
        path: ["recommendedRefresh"],
        message: "fresh repository pulse cannot recommend an index refresh",
      });
    }
  });

/** Explicit alias used by the persisted reader union; bytes remain unchanged. */
export const LegacyRepoPulseV1Schema = RepoPulseV1Schema;

export const RepoPulseDiagnosticCodeV1Schema = z.enum([
  "repository_capture_partial",
  "repository_branch_redacted",
  "repository_security_boundary",
  "artifact_missing",
  "artifact_stale",
  "parser_partial",
  "parser_unsupported",
  "call_graph_partial",
  "strong_refresh_required",
]);

function validateSortedUniqueStringsV1(
  values: readonly string[],
  context: z.RefinementCtx,
  path: PropertyKey[],
  label: string,
): void {
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (
      previous !== undefined &&
      current !== undefined &&
      compareStringsV1(previous, current) >= 0
    ) {
      context.addIssue({
        code: "custom",
        path: [...path, index],
        message: `${label} must be sorted and unique`,
      });
      return;
    }
  }
}

export const StrongRepoPulseCompletenessComponentV1Schema = z
  .strictObject({
    status: RepoPulseCompletenessStatusV1Schema,
    coverage: z.number().min(0).max(1).optional(),
    reasonCodes: z.array(RepoPulseDiagnosticCodeV1Schema),
  })
  .superRefine((component, context) => {
    validateSortedUniqueStringsV1(
      component.reasonCodes,
      context,
      ["reasonCodes"],
      "Repo Pulse completeness reason codes",
    );
    if (
      component.status === "complete" &&
      component.coverage !== undefined &&
      component.coverage !== 1
    ) {
      context.addIssue({
        code: "custom",
        path: ["coverage"],
        message: "complete coverage, when reported, must equal 1",
      });
    }
    if (component.status === "complete" && component.reasonCodes.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["reasonCodes"],
        message: "complete coverage must not carry degradation reason codes",
      });
    }
    if (component.status !== "complete" && component.reasonCodes.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["reasonCodes"],
        message: `${component.status} coverage requires a versioned reason code`,
      });
    }
  });

export const StrongRepoPulseSecurityFieldsV1Schema = z
  .strictObject({
    snapshotProfile: z.literal("repository_snapshot_path_safe_v1"),
    safeChangeCount: NonnegativeSafeIntegerV1Schema,
    redactedChangeCount: NonnegativeSafeIntegerV1Schema,
    unknownStateCount: NonnegativeSafeIntegerV1Schema,
    redactionBoundaryCodes: z.array(RepositorySnapshotBoundaryCodeV1Schema),
    uncertaintyCodes: z.array(RepositoryStateUncertaintyCodeV1Schema),
  })
  .superRefine((security, context) => {
    validateSortedUniqueStringsV1(
      security.redactionBoundaryCodes,
      context,
      ["redactionBoundaryCodes"],
      "Repository redaction boundary codes",
    );
    validateSortedUniqueStringsV1(
      security.uncertaintyCodes,
      context,
      ["uncertaintyCodes"],
      "Repository uncertainty codes",
    );
    if (
      (security.unknownStateCount === 0) !==
      (security.uncertaintyCodes.length === 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["uncertaintyCodes"],
        message: "uncertainty codes must be present exactly when unknown states exist",
      });
    }
  });

export const StrongRepoPulseChangeSummaryV1Schema = z
  .strictObject({
    total: NonnegativeSafeIntegerV1Schema,
    bySource: z.strictObject({
      committed: NonnegativeSafeIntegerV1Schema,
      staged: NonnegativeSafeIntegerV1Schema,
      unstaged: NonnegativeSafeIntegerV1Schema,
      untracked: NonnegativeSafeIntegerV1Schema,
      conflict: NonnegativeSafeIntegerV1Schema,
    }),
    byKind: z.strictObject({
      added: NonnegativeSafeIntegerV1Schema,
      modified: NonnegativeSafeIntegerV1Schema,
      deleted: NonnegativeSafeIntegerV1Schema,
      renamed: NonnegativeSafeIntegerV1Schema,
      copied: NonnegativeSafeIntegerV1Schema,
      type_changed: NonnegativeSafeIntegerV1Schema,
    }),
  })
  .superRefine((summary, context) => {
    if (
      Object.values(summary.bySource).reduce((total, count) => total + count, 0) !==
      summary.total
    ) {
      context.addIssue({
        code: "custom",
        path: ["bySource"],
        message: "strong Pulse source counts must add up to total",
      });
    }
    if (
      Object.values(summary.byKind).reduce((total, count) => total + count, 0) !==
      summary.total
    ) {
      context.addIssue({
        code: "custom",
        path: ["byKind"],
        message: "strong Pulse kind counts must add up to total",
      });
    }
  });

export const StrongRepoPulseRepositoryStateV1Schema = z
  .strictObject({
    repositoryId: PathSafeRepositoryIdV1Schema,
    worktreeId: PathSafeWorktreeIdV1Schema,
    rootIdentity: PathSafeRootIdentityV1Schema,
    branchState: RepositoryBranchStateV1Schema,
    objectFormat: RepositoryObjectFormatV1Schema,
    headState: RepositoryHeadStateV1Schema,
    repositoryStateToken: KeyedStateTokenV1Schema,
    captureStatus: z.enum(["complete", "partial"]),
  })
  .superRefine((state, context) => {
    const objectId = state.headState.kind === "commit"
      ? state.headState.commit
      : state.headState.emptyTreeObjectId;
    validateGitObjectFormatV1(state.objectFormat, objectId, context, ["headState"]);
    const hasBoundary = state.branchState.status === "redacted";
    if (state.captureStatus === "complete" && hasBoundary) {
      context.addIssue({
        code: "custom",
        path: ["captureStatus"],
        message: "complete strong Pulse state cannot contain a redacted branch",
      });
    }
  });

const StrongRepoPulseArtifactFreshnessV1Schema = z.strictObject({
  graph: ArtifactFreshnessV1Schema,
  wiki: ArtifactFreshnessV1Schema,
  evidence: ArtifactFreshnessV1Schema,
  diff: ArtifactFreshnessV1Schema,
  task: ArtifactFreshnessV1Schema,
});

export const StrongRepoPulseV1Schema = z
  .strictObject({
    profile: z.literal("repo_pulse_path_safe_v1"),
    evaluatedSnapshotId: PathSafeRepositorySnapshotIdV1Schema,
    evaluatedSnapshotContentDigest: ContentDigestSchema,
    baselineSnapshotId: PathSafeRepositorySnapshotIdV1Schema.optional(),
    status: RepoPulseStatusV1Schema,
    artifactFreshness: StrongRepoPulseArtifactFreshnessV1Schema,
    repositoryState: StrongRepoPulseRepositoryStateV1Schema,
    changeSummary: StrongRepoPulseChangeSummaryV1Schema,
    security: StrongRepoPulseSecurityFieldsV1Schema,
    securityScanPolicyDigest: ContentDigestSchema,
    safeGitExecutionDigest: ContentDigestSchema,
    completeness: z.strictObject({
      parser: StrongRepoPulseCompletenessComponentV1Schema,
      callGraph: StrongRepoPulseCompletenessComponentV1Schema,
    }),
    recommendedRefresh: RepoPulseRecommendedRefreshV1Schema,
    diagnosticCodes: z.array(RepoPulseDiagnosticCodeV1Schema),
    evaluatedAt: IsoTimestampSchema,
  })
  .superRefine((pulse, context) => {
    validateSortedUniqueStringsV1(
      pulse.diagnosticCodes,
      context,
      ["diagnosticCodes"],
      "Repo Pulse diagnostic codes",
    );
    const knownChangeCount =
      pulse.security.safeChangeCount + pulse.security.redactedChangeCount;
    if (pulse.changeSummary.total !== knownChangeCount) {
      context.addIssue({
        code: "custom",
        path: ["changeSummary", "total"],
        message: "strong Pulse change total must equal safe plus known-redacted changes",
      });
    }
    const hasSecurityBoundary =
      pulse.security.redactedChangeCount > 0 ||
      pulse.security.unknownStateCount > 0 ||
      pulse.repositoryState.branchState.status === "redacted";
    const expectsRedactionBoundaryCodes =
      pulse.security.redactedChangeCount > 0 ||
      pulse.repositoryState.branchState.status === "redacted";
    if (
      expectsRedactionBoundaryCodes !==
      (pulse.security.redactionBoundaryCodes.length > 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["security", "redactionBoundaryCodes"],
        message: "redaction boundary codes must exactly reflect redacted changes or branch state",
      });
    }
    if (
      pulse.repositoryState.branchState.status === "redacted" &&
      !pulse.security.redactionBoundaryCodes.includes(
        pulse.repositoryState.branchState.boundaryCode,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["security", "redactionBoundaryCodes"],
        message: "redacted branch boundary code must appear in strong Pulse security fields",
      });
    }
    if (pulse.repositoryState.captureStatus === "complete" && hasSecurityBoundary) {
      context.addIssue({
        code: "custom",
        path: ["repositoryState", "captureStatus"],
        message: "complete strong Pulse state cannot contain security boundaries",
      });
    }
    if (pulse.repositoryState.captureStatus === "partial" && !hasSecurityBoundary) {
      context.addIssue({
        code: "custom",
        path: ["repositoryState", "captureStatus"],
        message: "partial strong Pulse state requires a security boundary",
      });
    }
    if (pulse.status === "fresh") {
      if (Object.values(pulse.artifactFreshness).some((value) => value !== "fresh")) {
        context.addIssue({
          code: "custom",
          path: ["artifactFreshness"],
          message: "fresh strong Pulse requires every artifact family to be fresh",
        });
      }
      if (
        pulse.repositoryState.captureStatus !== "complete" ||
        pulse.completeness.parser.status !== "complete" ||
        pulse.completeness.callGraph.status !== "complete" ||
        pulse.recommendedRefresh !== "none" ||
        pulse.diagnosticCodes.length > 0
      ) {
        context.addIssue({
          code: "custom",
          path: ["status"],
          message: "fresh strong Pulse requires complete capture and analysis with no diagnostics or refresh",
        });
      }
    } else if (pulse.diagnosticCodes.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["diagnosticCodes"],
        message: "degraded strong Pulse status requires a versioned diagnostic code",
      });
    }
  });

export const RepoPulsePersistedPayloadV1Schema = z.union([
  LegacyRepoPulseV1Schema,
  StrongRepoPulseV1Schema,
]);

export interface StrongRepoPulseSnapshotBindingIssueV1 {
  readonly path: readonly PropertyKey[];
  readonly actual: unknown;
  readonly expected: unknown;
}

export interface StrongRepoPulseSnapshotBindingResultV1 {
  readonly valid: boolean;
  readonly issues: readonly StrongRepoPulseSnapshotBindingIssueV1[];
}

function strongPulseChangeSummaryFromSnapshotV1(
  snapshot: StrongRepositorySnapshotV1,
): StrongRepoPulseChangeSummaryV1 {
  const bySource: StrongRepoPulseChangeSummaryV1["bySource"] = {
    committed: 0,
    staged: 0,
    unstaged: 0,
    untracked: 0,
    conflict: 0,
  };
  const byKind: StrongRepoPulseChangeSummaryV1["byKind"] = {
    added: 0,
    modified: 0,
    deleted: 0,
    renamed: 0,
    copied: 0,
    type_changed: 0,
  };
  for (const change of snapshot.changes) {
    bySource[change.source] += 1;
    byKind[change.kind] += 1;
  }
  for (const aggregate of snapshot.redactedChanges) {
    bySource[aggregate.source] += aggregate.count;
    byKind[aggregate.kind] += aggregate.count;
  }
  return {
    total:
      snapshot.accounting.safeChangeCount +
      snapshot.accounting.redactedKnownChangeCount,
    bySource,
    byKind,
  };
}

function strongPulseSecurityFromSnapshotV1(
  snapshot: StrongRepositorySnapshotV1,
): StrongRepoPulseSecurityFieldsV1 {
  const redactionBoundaryCodes = new Set<RepositorySnapshotBoundaryCodeV1>(
    snapshot.redactedChanges.map((aggregate) => aggregate.boundaryCode),
  );
  if (snapshot.branchState.status === "redacted") {
    redactionBoundaryCodes.add(snapshot.branchState.boundaryCode);
  }
  return {
    snapshotProfile: "repository_snapshot_path_safe_v1",
    safeChangeCount: snapshot.accounting.safeChangeCount,
    redactedChangeCount: snapshot.accounting.redactedKnownChangeCount,
    unknownStateCount: snapshot.accounting.unknownStateCount,
    redactionBoundaryCodes: [...redactionBoundaryCodes].sort(compareStringsV1),
    uncertaintyCodes: [
      ...new Set(snapshot.unknownStates.map((aggregate) => aggregate.code)),
    ].sort(compareStringsV1),
  };
}

function addStrongPulseBindingIssueV1(
  issues: StrongRepoPulseSnapshotBindingIssueV1[],
  path: readonly PropertyKey[],
  actual: unknown,
  expected: unknown,
): void {
  if (canonicalizeJson(actual) !== canonicalizeJson(expected)) {
    issues.push({ path, actual, expected });
  }
}

/**
 * Cross-record closure for a strong Pulse. This is separate from the structural
 * schema because the evaluated Snapshot payload is required to prove the Pulse
 * did not claim strong semantics for unrelated or tampered repository state.
 */
export function verifyStrongRepoPulseAgainstSnapshotV1(
  pulse: StrongRepoPulseV1,
  snapshot: StrongRepositorySnapshotV1,
  digestCanonicalJson: DigestCanonicalJsonV1,
): StrongRepoPulseSnapshotBindingResultV1 {
  const issues: StrongRepoPulseSnapshotBindingIssueV1[] = [];
  addStrongPulseBindingIssueV1(
    issues,
    ["evaluatedSnapshotId"],
    pulse.evaluatedSnapshotId,
    snapshot.snapshotId,
  );
  addStrongPulseBindingIssueV1(
    issues,
    ["evaluatedSnapshotContentDigest"],
    pulse.evaluatedSnapshotContentDigest,
    ContentDigestSchema.parse(digestCanonicalJson(canonicalizeJson(snapshot))),
  );
  addStrongPulseBindingIssueV1(
    issues,
    ["repositoryState"],
    pulse.repositoryState,
    {
      repositoryId: snapshot.repositoryId,
      worktreeId: snapshot.worktreeId,
      rootIdentity: snapshot.rootIdentity,
      branchState: snapshot.branchState,
      objectFormat: snapshot.objectFormat,
      headState: snapshot.headState,
      repositoryStateToken: snapshot.repositoryStateToken,
      captureStatus: snapshot.captureStatus,
    },
  );
  addStrongPulseBindingIssueV1(
    issues,
    ["changeSummary"],
    pulse.changeSummary,
    strongPulseChangeSummaryFromSnapshotV1(snapshot),
  );
  addStrongPulseBindingIssueV1(
    issues,
    ["security"],
    pulse.security,
    strongPulseSecurityFromSnapshotV1(snapshot),
  );
  addStrongPulseBindingIssueV1(
    issues,
    ["securityScanPolicyDigest"],
    pulse.securityScanPolicyDigest,
    snapshot.securityScanPolicyDigest,
  );
  addStrongPulseBindingIssueV1(
    issues,
    ["safeGitExecutionDigest"],
    pulse.safeGitExecutionDigest,
    snapshot.safeGitExecutionDigest,
  );
  return { valid: issues.length === 0, issues };
}

export class StrongRepoPulseSnapshotBindingErrorV1 extends TypeError {
  readonly issues: readonly StrongRepoPulseSnapshotBindingIssueV1[];

  constructor(issues: readonly StrongRepoPulseSnapshotBindingIssueV1[]) {
    super("strong Repo Pulse does not match its evaluated Repository Snapshot");
    this.name = "StrongRepoPulseSnapshotBindingErrorV1";
    this.issues = issues;
  }
}

export function parseTrustedStrongRepoPulseV1(
  input: unknown,
  evaluatedSnapshotInput: unknown,
  digestCanonicalJson: DigestCanonicalJsonV1,
): StrongRepoPulseV1 {
  const snapshot = parseTrustedStrongRepositorySnapshotV1(
    evaluatedSnapshotInput,
    digestCanonicalJson,
  );
  const pulse = StrongRepoPulseV1Schema.parse(input);
  const binding = verifyStrongRepoPulseAgainstSnapshotV1(
    pulse,
    snapshot,
    digestCanonicalJson,
  );
  if (!binding.valid) {
    throw new StrongRepoPulseSnapshotBindingErrorV1(binding.issues);
  }
  return pulse;
}

export const LegacyRepositorySnapshotRedactedViewV1Schema = z.strictObject({
  viewVersion: z.literal(1),
  viewKind: z.literal("legacy_repository_snapshot_redacted"),
  sourceCaptureStatus: RepositoryCaptureStatusV1Schema,
  aggregateChangeCount: NonnegativeSafeIntegerV1Schema,
  capturedAt: IsoTimestampSchema,
  strongOperationSupported: z.literal(false),
});

export const StrongRepositorySnapshotSurfaceViewV1Schema = z
  .strictObject({
    viewVersion: z.literal(1),
    viewKind: z.literal("strong_repository_snapshot"),
    snapshotId: PathSafeRepositorySnapshotIdV1Schema,
    repositoryId: PathSafeRepositoryIdV1Schema,
    worktreeId: PathSafeWorktreeIdV1Schema,
    branchState: RepositoryBranchStateV1Schema,
    objectFormat: RepositoryObjectFormatV1Schema,
    headState: RepositoryHeadStateV1Schema,
    captureStatus: z.enum(["complete", "partial"]),
    accounting: RepositoryCaptureAccountingV1Schema,
    changes: z.array(PathSafeRepositoryChangeV1Schema),
    redactedChanges: z.array(RedactedRepositoryChangeAggregateV1Schema),
    unknownStates: z.array(OpaqueRepositoryStateAggregateV1Schema),
    capturedAt: IsoTimestampSchema,
    strongOperationSupported: z.literal(true),
  })
  .superRefine((surface, context) => {
    const headObjectId = surface.headState.kind === "commit"
      ? surface.headState.commit
      : surface.headState.emptyTreeObjectId;
    validateGitObjectFormatV1(surface.objectFormat, headObjectId, context, ["headState"]);
    validateStrictOrderV1(surface.changes, comparePathSafeChangesV1, context, "changes");
    validateStrictOrderV1(
      surface.redactedChanges,
      compareRedactedChangesV1,
      context,
      "redactedChanges",
    );
    validateStrictOrderV1(
      surface.unknownStates,
      compareUnknownStatesV1,
      context,
      "unknownStates",
    );
    const redactedKnownChangeCount = surface.redactedChanges.reduce(
      (total, entry) => total + entry.count,
      0,
    );
    const unknownStateCount = surface.unknownStates.reduce(
      (total, entry) => total + entry.count,
      0,
    );
    const candidateUnitCount =
      surface.changes.length + redactedKnownChangeCount + unknownStateCount;
    const expectedAccounting = {
      candidateUnitCount,
      safeChangeCount: surface.changes.length,
      redactedKnownChangeCount,
      unknownStateCount,
    } as const;
    for (const [field, expected] of Object.entries(expectedAccounting)) {
      if (surface.accounting[field as keyof typeof expectedAccounting] !== expected) {
        context.addIssue({
          code: "custom",
          path: ["accounting", field],
          message: `${field} must match the projected strong capture arrays`,
        });
      }
    }
    if (surface.accounting.rawLayerUnitCount < candidateUnitCount) {
      context.addIssue({
        code: "custom",
        path: ["accounting", "rawLayerUnitCount"],
        message: "rawLayerUnitCount must cover every projected candidate unit",
      });
    }
    const hasBoundary =
      surface.redactedChanges.length > 0 ||
      surface.unknownStates.length > 0 ||
      surface.branchState.status === "redacted";
    if ((surface.captureStatus === "partial") !== hasBoundary) {
      context.addIssue({
        code: "custom",
        path: ["captureStatus"],
        message: "strong Snapshot Surface capture status must exactly reflect security boundaries",
      });
    }
  });

export const RepositorySnapshotSurfaceResponseV1Schema = z.discriminatedUnion(
  "viewKind",
  [
    LegacyRepositorySnapshotRedactedViewV1Schema,
    StrongRepositorySnapshotSurfaceViewV1Schema,
  ],
);

export const LegacyRepoPulseRedactedViewV1Schema = z.strictObject({
  viewVersion: z.literal(1),
  viewKind: z.literal("legacy_repo_pulse_redacted"),
  status: RepoPulseStatusV1Schema,
  aggregateChangeCount: NonnegativeSafeIntegerV1Schema.optional(),
  evaluatedAt: IsoTimestampSchema,
  strongOperationSupported: z.literal(false),
});

export const StrongRepoPulseSurfaceViewV1Schema = z
  .strictObject({
    viewVersion: z.literal(1),
    viewKind: z.literal("strong_repo_pulse"),
    evaluatedSnapshotId: PathSafeRepositorySnapshotIdV1Schema,
    status: RepoPulseStatusV1Schema,
    branchState: RepositoryBranchStateV1Schema,
    safeChangeCount: NonnegativeSafeIntegerV1Schema,
    redactedChangeCount: NonnegativeSafeIntegerV1Schema,
    unknownStateCount: NonnegativeSafeIntegerV1Schema,
    redactionBoundaryCodes: z.array(RepositorySnapshotBoundaryCodeV1Schema),
    uncertaintyCodes: z.array(RepositoryStateUncertaintyCodeV1Schema),
    evaluatedAt: IsoTimestampSchema,
    strongOperationSupported: z.literal(true),
  })
  .superRefine((surface, context) => {
    validateSortedUniqueStringsV1(
      surface.redactionBoundaryCodes,
      context,
      ["redactionBoundaryCodes"],
      "Repository redaction boundary codes",
    );
    validateSortedUniqueStringsV1(
      surface.uncertaintyCodes,
      context,
      ["uncertaintyCodes"],
      "Repository uncertainty codes",
    );
    const expectsRedactionBoundaryCodes =
      surface.redactedChangeCount > 0 || surface.branchState.status === "redacted";
    if (
      expectsRedactionBoundaryCodes !==
      (surface.redactionBoundaryCodes.length > 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["redactionBoundaryCodes"],
        message: "Pulse Surface redaction codes must exactly reflect redacted changes or branch state",
      });
    }
    if (
      surface.branchState.status === "redacted" &&
      !surface.redactionBoundaryCodes.includes(surface.branchState.boundaryCode)
    ) {
      context.addIssue({
        code: "custom",
        path: ["redactionBoundaryCodes"],
        message: "Pulse Surface must include its redacted branch boundary code",
      });
    }
    if (
      (surface.unknownStateCount === 0) !==
      (surface.uncertaintyCodes.length === 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["uncertaintyCodes"],
        message: "Pulse Surface uncertainty codes must exactly reflect unknown state",
      });
    }
  });

export const RepoPulseSurfaceResponseV1Schema = z.discriminatedUnion("viewKind", [
  LegacyRepoPulseRedactedViewV1Schema,
  StrongRepoPulseSurfaceViewV1Schema,
]);

export const RepositorySnapshotArtifactV1Schema = createArtifactEnvelopeV1Schema(
  "repository_snapshot",
  RepositorySnapshotPersistedPayloadV1Schema,
).superRefine((artifact, context) => {
  if (artifact.sourceSnapshotId !== artifact.payload.snapshotId) {
    context.addIssue({
      code: "custom",
      path: ["sourceSnapshotId"],
      message: "repository snapshot envelope sourceSnapshotId must equal payload.snapshotId",
    });
  }
  if (artifact.repositoryId !== artifact.payload.repositoryId) {
    context.addIssue({
      code: "custom",
      path: ["repositoryId"],
      message: "repository snapshot envelope and payload repositoryId must match",
    });
  }
  if (artifact.worktreeId !== artifact.payload.worktreeId) {
    context.addIssue({
      code: "custom",
      path: ["worktreeId"],
      message: "repository snapshot envelope and payload worktreeId must match",
    });
  }
});

export const RepoPulseArtifactV1Schema = createArtifactEnvelopeV1Schema(
  "repo_pulse",
  RepoPulsePersistedPayloadV1Schema,
).superRefine((artifact, context) => {
  if (artifact.sourceSnapshotId !== artifact.payload.evaluatedSnapshotId) {
    context.addIssue({
      code: "custom",
      path: ["sourceSnapshotId"],
      message: "repo pulse envelope sourceSnapshotId must equal payload.evaluatedSnapshotId",
    });
  }
  if (
    "profile" in artifact.payload &&
    artifact.payload.profile === "repo_pulse_path_safe_v1"
  ) {
    if (artifact.repositoryId !== artifact.payload.repositoryState.repositoryId) {
      context.addIssue({
        code: "custom",
        path: ["repositoryId"],
        message: "strong repo pulse envelope and payload repositoryId must match",
      });
    }
    if (artifact.worktreeId !== artifact.payload.repositoryState.worktreeId) {
      context.addIssue({
        code: "custom",
        path: ["worktreeId"],
        message: "strong repo pulse envelope and payload worktreeId must match",
      });
    }
  }
});

/**
 * Owner-only persisted reader for Snapshot artifacts. Structural parsing alone
 * is intentionally insufficient for the strong variant: every nested ID, the
 * Snapshot ID, and the payload digest are recomputed before the value is
 * trusted. Legacy bytes retain their historical structural reader behavior,
 * while their envelope payload digest is still verified here.
 */
export function parseTrustedRepositorySnapshotArtifactV1(
  input: unknown,
  digestCanonicalJson: DigestCanonicalJsonV1,
): RepositorySnapshotArtifactV1 {
  const artifact = RepositorySnapshotArtifactV1Schema.parse(input);
  if ("profile" in artifact.payload) {
    parseTrustedStrongRepositorySnapshotV1(
      artifact.payload,
      digestCanonicalJson,
    );
  }
  const integrity = verifyArtifactContentDigestV1(
    artifact,
    digestCanonicalJson,
  );
  if (!integrity.valid) {
    throw new TypeError(
      "Repository Snapshot artifact payload content digest verification failed",
    );
  }
  return artifact;
}

export type RepositoryChangeSourceV1 = z.infer<typeof RepositoryChangeSourceV1Schema>;
export type RepositoryChangeKindV1 = z.infer<typeof RepositoryChangeKindV1Schema>;
export type RepositoryChangeV1 = z.infer<typeof RepositoryChangeV1Schema>;
export type RepositoryCaptureStatusV1 = z.infer<typeof RepositoryCaptureStatusV1Schema>;
export type RepositorySnapshotV1 = z.infer<typeof RepositorySnapshotV1Schema>;
export type LegacyRepositorySnapshotV1 = z.infer<
  typeof LegacyRepositorySnapshotV1Schema
>;
export type RepositoryObjectFormatV1 = z.infer<
  typeof RepositoryObjectFormatV1Schema
>;
export type RepositorySnapshotBoundaryCodeV1 = z.infer<
  typeof RepositorySnapshotBoundaryCodeV1Schema
>;
export type RepositoryBranchRedactionCodeV1 = z.infer<
  typeof RepositoryBranchRedactionCodeV1Schema
>;
export type RepositoryStateUncertaintyCodeV1 = z.infer<
  typeof RepositoryStateUncertaintyCodeV1Schema
>;
export type RepositoryBranchStateV1 = z.infer<
  typeof RepositoryBranchStateV1Schema
>;
export type RepositoryHeadStateV1 = z.infer<
  typeof RepositoryHeadStateV1Schema
>;
export type PathSafeRepositoryChangeV1 = z.infer<
  typeof PathSafeRepositoryChangeV1Schema
>;
export type RedactedRepositoryChangeAggregateV1 = z.infer<
  typeof RedactedRepositoryChangeAggregateV1Schema
>;
export type OpaqueRepositoryStateAggregateV1 = z.infer<
  typeof OpaqueRepositoryStateAggregateV1Schema
>;
export type RepositoryCaptureAccountingV1 = z.infer<
  typeof RepositoryCaptureAccountingV1Schema
>;
export type StrongRepositorySnapshotV1 = z.infer<
  typeof StrongRepositorySnapshotV1Schema
>;
export type RepositorySnapshotPersistedPayloadV1 = z.infer<
  typeof RepositorySnapshotPersistedPayloadV1Schema
>;
export type PathSafeRepositoryChangeIdentityInputV1 = Omit<
  PathSafeRepositoryChangeV1,
  "id"
>;
export type PathSafeRepositoryChangeIdentityFieldsV1 =
  PathSafeRepositoryChangeIdentityInputV1;
export type RepositoryRedactionIdentityFieldsV1 = Pick<
  StrongRepositorySnapshotV1,
  "repositoryId" | "worktreeId" | "repositoryStateToken"
> & Omit<RedactedRepositoryChangeAggregateV1, "id">;
export type RepositoryUnknownStateIdentityFieldsV1 = Pick<
  StrongRepositorySnapshotV1,
  "repositoryId" | "worktreeId" | "repositoryStateToken"
> & Omit<OpaqueRepositoryStateAggregateV1, "id">;
export type StrongRepositorySnapshotIdentityFieldsV1 = Omit<
  StrongRepositorySnapshotV1,
  "snapshotId"
>;
export type StrongRepositorySnapshotIdentityInputV1 =
  StrongRepositorySnapshotIdentityFieldsV1 &
    Partial<Pick<StrongRepositorySnapshotV1, "snapshotId">>;
export type ArtifactFreshnessV1 = z.infer<typeof ArtifactFreshnessV1Schema>;
export type RepoPulseStatusV1 = z.infer<typeof RepoPulseStatusV1Schema>;
export type RepoPulseRepositoryStateV1 = z.infer<
  typeof RepoPulseRepositoryStateV1Schema
>;
export type RepoPulseChangeSummaryV1 = z.infer<
  typeof RepoPulseChangeSummaryV1Schema
>;
export type RepoPulseCompletenessStatusV1 = z.infer<
  typeof RepoPulseCompletenessStatusV1Schema
>;
export type RepoPulseCompletenessComponentV1 = z.infer<
  typeof RepoPulseCompletenessComponentV1Schema
>;
export type RepoPulseCompletenessV1 = z.infer<
  typeof RepoPulseCompletenessV1Schema
>;
export type RepoPulseRecommendedRefreshV1 = z.infer<
  typeof RepoPulseRecommendedRefreshV1Schema
>;
export type RepoPulseDiagnosticV1 = z.infer<
  typeof RepoPulseDiagnosticV1Schema
>;
export type RepoPulseV1 = z.infer<typeof RepoPulseV1Schema>;
export type LegacyRepoPulseV1 = z.infer<typeof LegacyRepoPulseV1Schema>;
export type RepoPulseDiagnosticCodeV1 = z.infer<
  typeof RepoPulseDiagnosticCodeV1Schema
>;
export type StrongRepoPulseCompletenessComponentV1 = z.infer<
  typeof StrongRepoPulseCompletenessComponentV1Schema
>;
export type StrongRepoPulseSecurityFieldsV1 = z.infer<
  typeof StrongRepoPulseSecurityFieldsV1Schema
>;
export type StrongRepoPulseChangeSummaryV1 = z.infer<
  typeof StrongRepoPulseChangeSummaryV1Schema
>;
export type StrongRepoPulseRepositoryStateV1 = z.infer<
  typeof StrongRepoPulseRepositoryStateV1Schema
>;
export type StrongRepoPulseV1 = z.infer<typeof StrongRepoPulseV1Schema>;
export type RepoPulsePersistedPayloadV1 = z.infer<
  typeof RepoPulsePersistedPayloadV1Schema
>;
export type LegacyRepositorySnapshotRedactedViewV1 = z.infer<
  typeof LegacyRepositorySnapshotRedactedViewV1Schema
>;
export type StrongRepositorySnapshotSurfaceViewV1 = z.infer<
  typeof StrongRepositorySnapshotSurfaceViewV1Schema
>;
export type RepositorySnapshotSurfaceResponseV1 = z.infer<
  typeof RepositorySnapshotSurfaceResponseV1Schema
>;
export type LegacyRepoPulseRedactedViewV1 = z.infer<
  typeof LegacyRepoPulseRedactedViewV1Schema
>;
export type StrongRepoPulseSurfaceViewV1 = z.infer<
  typeof StrongRepoPulseSurfaceViewV1Schema
>;
export type RepoPulseSurfaceResponseV1 = z.infer<
  typeof RepoPulseSurfaceResponseV1Schema
>;
export type RepositorySnapshotArtifactV1 = z.infer<typeof RepositorySnapshotArtifactV1Schema>;
export type RepoPulseArtifactV1 = z.infer<typeof RepoPulseArtifactV1Schema>;
