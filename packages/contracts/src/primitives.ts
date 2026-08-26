import { z } from "zod";

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;
const RFC3339_UTC_PATTERN =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?Z$/u;
const SEMVER_PATTERN =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

function isRealUtcTimestamp(value: string): boolean {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?Z$/u.exec(
      value,
    );
  if (match === null) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  if (
    yearText === undefined ||
    monthText === undefined ||
    dayText === undefined ||
    hourText === undefined ||
    minuteText === undefined ||
    secondText === undefined
  ) {
    return false;
  }
  const expected = [
    Number(yearText),
    Number(monthText),
    Number(dayText),
    Number(hourText),
    Number(minuteText),
    Number(secondText),
  ] as const;
  const date = new Date(0);
  date.setUTCFullYear(expected[0], expected[1] - 1, expected[2]);
  date.setUTCHours(expected[3], expected[4], expected[5], 0);
  return (
    date.getUTCFullYear() === expected[0] &&
    date.getUTCMonth() + 1 === expected[1] &&
    date.getUTCDate() === expected[2] &&
    date.getUTCHours() === expected[3] &&
    date.getUTCMinutes() === expected[4] &&
    date.getUTCSeconds() === expected[5]
  );
}

/**
 * JavaScript strings may contain lone UTF-16 surrogates even though they have
 * no lossless UTF-8 representation. Strong Repository paths must never admit
 * those values: encoding them would replace distinct inputs with U+FFFD and
 * could collapse both ordering and identity preimages.
 */
export function isUnicodeScalarStringV1(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
      continue;
    }
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) return false;
  }
  return true;
}

export const SchemaVersionV1Schema = z.literal(1);

export const NonEmptyStringSchema = z
  .string()
  .min(1)
  .max(16_384)
  .refine((value) => value.trim().length > 0, "value must contain non-whitespace characters");

export const OpaqueIdentifierSchema = z
  .string()
  .min(1)
  .max(256)
  .refine((value) => value === value.trim(), "identifier must not have surrounding whitespace")
  .refine((value) => !CONTROL_CHARACTER_PATTERN.test(value), "identifier must not contain control characters");

export const RepositoryIdSchema = OpaqueIdentifierSchema;
export const WorktreeIdSchema = OpaqueIdentifierSchema;
export const SnapshotIdSchema = OpaqueIdentifierSchema;
export const ArtifactIdSchema = OpaqueIdentifierSchema;
export const ClaimIdSchema = OpaqueIdentifierSchema;
export const EvidenceIdSchema = OpaqueIdentifierSchema;
export const FindingIdSchema = OpaqueIdentifierSchema;
export const VerificationRecordIdSchema = OpaqueIdentifierSchema;
export const PlannedChangeIdSchema = OpaqueIdentifierSchema;
export const ImpactPathIdSchema = OpaqueIdentifierSchema;
export const EventIdSchema = OpaqueIdentifierSchema;
export const ActorSchema = OpaqueIdentifierSchema;
export const IdempotencyKeySchema = OpaqueIdentifierSchema;
export const RootIdentitySchema = OpaqueIdentifierSchema;

const LOWER_HEX_64_PATTERN = /^[0-9a-f]{64}$/u;

/**
 * Strong Repository identities are deliberately separate from the legacy
 * opaque identifier family.  Their prefixes are part of the frozen wire
 * grammar; accepting a caller-selected opaque value here would let legacy
 * path-derived identifiers enter a strong Repository Basis.
 */
export const PathSafeRepositoryIdV1Schema = z
  .string()
  .regex(/^repo-hmac-[0-9a-f]{64}$/u, "path-safe repository ID must use repo-hmac-<64 lowercase hex>")
  .brand<"PathSafeRepositoryIdV1">();
export const PathSafeWorktreeIdV1Schema = z
  .string()
  .regex(/^worktree-hmac-[0-9a-f]{64}$/u, "path-safe worktree ID must use worktree-hmac-<64 lowercase hex>")
  .brand<"PathSafeWorktreeIdV1">();
export const PathSafeRootIdentityV1Schema = z
  .string()
  .regex(/^root-hmac-[0-9a-f]{64}$/u, "path-safe root identity must use root-hmac-<64 lowercase hex>")
  .brand<"PathSafeRootIdentityV1">();
export const PathSafeRepositorySnapshotIdV1Schema = z
  .string()
  .regex(/^snapshot-[0-9a-f]{64}$/u, "path-safe Snapshot ID must use snapshot-<64 lowercase hex>")
  .brand<"PathSafeRepositorySnapshotIdV1">();
export const PathSafeRepositoryChangeIdV1Schema = z
  .string()
  .regex(/^change-[0-9a-f]{64}$/u, "path-safe Repository Change ID must use change-<64 lowercase hex>")
  .brand<"PathSafeRepositoryChangeIdV1">();
export const PathSafeRepositoryRedactionIdV1Schema = z
  .string()
  .regex(/^snapshot-redaction-[0-9a-f]{64}$/u, "path-safe Repository redaction ID must use snapshot-redaction-<64 lowercase hex>")
  .brand<"PathSafeRepositoryRedactionIdV1">();
export const PathSafeRepositoryUnknownStateIdV1Schema = z
  .string()
  .regex(/^snapshot-unknown-state-[0-9a-f]{64}$/u, "path-safe Repository unknown-state ID must use snapshot-unknown-state-<64 lowercase hex>")
  .brand<"PathSafeRepositoryUnknownStateIdV1">();
export const KeyedStateTokenV1Schema = z
  .string()
  .regex(/^hmac-sha256:[0-9a-f]{64}$/u, "keyed state token must use hmac-sha256:<64 lowercase hex>")
  .brand<"KeyedStateTokenV1">();

const lowerHex22Id = <Brand extends string>(
  prefix: string,
  brand: Brand,
) => z
  .string()
  .regex(
    new RegExp(`^${prefix}[0-9a-f]{22}$`, "u"),
    `${brand} must use ${prefix}<22 lowercase hex>`,
  )
  .brand<Brand>();

/** Frozen WP5 strong Change Intelligence identifier grammars. */
export const AnalysisBoundaryIdV1Schema = lowerHex22Id(
  "analysis-boundary:",
  "AnalysisBoundaryIdV1",
);
export const RepositoryDeltaSegmentIdV1Schema = lowerHex22Id(
  "repository-delta-segment:",
  "RepositoryDeltaSegmentIdV1",
);
export const EffectiveRepositoryChangeIdV1Schema = lowerHex22Id(
  "repository-effective-change:",
  "EffectiveRepositoryChangeIdV1",
);
export const RepositoryPathDeltaIdV1Schema = lowerHex22Id(
  "repository-path-delta:",
  "RepositoryPathDeltaIdV1",
);
export const DiffHunkIdV1Schema = lowerHex22Id(
  "diff-hunk:",
  "DiffHunkIdV1",
);
export const SourceSymbolRefIdV1Schema = lowerHex22Id(
  "source-symbol-ref:",
  "SourceSymbolRefIdV1",
);
export const ActualChangeIdV1Schema = lowerHex22Id(
  "actual-change:",
  "ActualChangeIdV1",
);
export const DiffHunkEvidenceIdV1Schema = lowerHex22Id(
  "diff-evidence:",
  "DiffHunkEvidenceIdV1",
);
export const AnalysisBoundaryEvidenceIdV1Schema = lowerHex22Id(
  "boundary-evidence:",
  "AnalysisBoundaryEvidenceIdV1",
);
export const StrongFindingIdV1Schema = lowerHex22Id(
  "change-finding:",
  "StrongFindingIdV1",
);
export const StrongPlannedChangeIdV1Schema = lowerHex22Id(
  "planned-change:",
  "StrongPlannedChangeIdV1",
);
export const VerificationPlanEntryIdV1Schema = lowerHex22Id(
  "verification-plan:",
  "VerificationPlanEntryIdV1",
);
export const TaskBaselineArtifactIdV1Schema = lowerHex22Id(
  "task-baseline:",
  "TaskBaselineArtifactIdV1",
);
export const RepositoryBasisRecordIdV1Schema = lowerHex22Id(
  "repository-basis-record:",
  "RepositoryBasisRecordIdV1",
);
export const ContextGenerationIdV1Schema = lowerHex22Id(
  "context-generation:",
  "ContextGenerationIdV1",
);
export const StrongVerificationRecordIdV1Schema = lowerHex22Id(
  "verification-record:",
  "StrongVerificationRecordIdV1",
);

/** Host callbacks may return a full ContentDigest; strong ID helpers strip it. */
export function lowerHex64FromContentDigestV1(value: string): string {
  const parsed = ContentDigestSchema.parse(value);
  const hex = parsed.slice("sha256:".length);
  if (!LOWER_HEX_64_PATTERN.test(hex)) {
    throw new TypeError("content digest did not contain 64 lowercase hex characters");
  }
  return hex;
}

export const TaskIdSchema = z
  .string()
  .regex(/^[0-9A-HJKMNP-TV-Z]{26}$/u, "taskId must be a canonical uppercase ULID");

export const RevisionSchema = z.number().int().nonnegative();

export const ProducerVersionSchema = z
  .string()
  .regex(SEMVER_PATTERN, "producerVersion must be a semantic version");

export const IsoTimestampSchema = z
  .string()
  .regex(RFC3339_UTC_PATTERN, "timestamp must be an RFC 3339 UTC value")
  .refine(isRealUtcTimestamp, "timestamp must be a real calendar date");

export const ContentDigestSchema = z
  .string()
  .regex(/^sha256:[0-9a-f]{64}$/u, "digest must use sha256:<64 lowercase hex>");

export const GitObjectIdSchema = z
  .string()
  .regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u, "Git object ID must be 40 or 64 lowercase hex characters");

export const RepositoryRelativePathSchema = z
  .string()
  .min(1)
  .max(4_096)
  .superRefine((value, context) => {
    if (CONTROL_CHARACTER_PATTERN.test(value)) {
      context.addIssue({ code: "custom", message: "path must not contain control characters" });
    }
    if (value.startsWith("/") || /^[A-Za-z]:/u.test(value)) {
      context.addIssue({ code: "custom", message: "path must be repository-relative" });
    }
    if (value.includes("\\")) {
      context.addIssue({ code: "custom", message: "path must use POSIX separators" });
    }
    if (value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
      context.addIssue({ code: "custom", message: "path must not contain empty, dot, or parent segments" });
    }
  });

/**
 * Strong Repository identities require a lossless UTF-8 path preimage. Keep
 * that rule separate from the legacy path reader so historical JSON strings
 * retain their exact acceptance and canonical bytes.
 */
export const PathSafeRepositoryRelativePathV1Schema =
  RepositoryRelativePathSchema.refine(
    isUnicodeScalarStringV1,
    "path-safe Repository paths must contain only Unicode scalar values representable as UTF-8",
  );

export const LineRangeSchema = z
  .tuple([z.number().int().positive(), z.number().int().positive()])
  .superRefine(([start, end], context) => {
    if (end < start) {
      context.addIssue({ code: "custom", message: "line range end must be greater than or equal to start" });
    }
  });

export type SchemaVersionV1 = z.infer<typeof SchemaVersionV1Schema>;
export type NonEmptyString = z.infer<typeof NonEmptyStringSchema>;
export type OpaqueIdentifier = z.infer<typeof OpaqueIdentifierSchema>;
export type RepositoryId = z.infer<typeof RepositoryIdSchema>;
export type WorktreeId = z.infer<typeof WorktreeIdSchema>;
export type SnapshotId = z.infer<typeof SnapshotIdSchema>;
export type ArtifactId = z.infer<typeof ArtifactIdSchema>;
export type TaskId = z.infer<typeof TaskIdSchema>;
export type ClaimId = z.infer<typeof ClaimIdSchema>;
export type EvidenceId = z.infer<typeof EvidenceIdSchema>;
export type FindingId = z.infer<typeof FindingIdSchema>;
export type VerificationRecordId = z.infer<typeof VerificationRecordIdSchema>;
export type PlannedChangeId = z.infer<typeof PlannedChangeIdSchema>;
export type ImpactPathId = z.infer<typeof ImpactPathIdSchema>;
export type EventId = z.infer<typeof EventIdSchema>;
export type Actor = z.infer<typeof ActorSchema>;
export type IdempotencyKey = z.infer<typeof IdempotencyKeySchema>;
export type RootIdentity = z.infer<typeof RootIdentitySchema>;
export type PathSafeRepositoryIdV1 = z.infer<typeof PathSafeRepositoryIdV1Schema>;
export type PathSafeWorktreeIdV1 = z.infer<typeof PathSafeWorktreeIdV1Schema>;
export type PathSafeRootIdentityV1 = z.infer<typeof PathSafeRootIdentityV1Schema>;
export type PathSafeRepositorySnapshotIdV1 = z.infer<
  typeof PathSafeRepositorySnapshotIdV1Schema
>;
export type PathSafeRepositoryChangeIdV1 = z.infer<
  typeof PathSafeRepositoryChangeIdV1Schema
>;
export type PathSafeRepositoryRedactionIdV1 = z.infer<
  typeof PathSafeRepositoryRedactionIdV1Schema
>;
export type PathSafeRepositoryUnknownStateIdV1 = z.infer<
  typeof PathSafeRepositoryUnknownStateIdV1Schema
>;
export type KeyedStateTokenV1 = z.infer<typeof KeyedStateTokenV1Schema>;
export type AnalysisBoundaryIdV1 = z.infer<typeof AnalysisBoundaryIdV1Schema>;
export type RepositoryDeltaSegmentIdV1 = z.infer<
  typeof RepositoryDeltaSegmentIdV1Schema
>;
export type EffectiveRepositoryChangeIdV1 = z.infer<
  typeof EffectiveRepositoryChangeIdV1Schema
>;
export type RepositoryPathDeltaIdV1 = z.infer<
  typeof RepositoryPathDeltaIdV1Schema
>;
export type DiffHunkIdV1 = z.infer<typeof DiffHunkIdV1Schema>;
export type SourceSymbolRefIdV1 = z.infer<typeof SourceSymbolRefIdV1Schema>;
export type ActualChangeIdV1 = z.infer<typeof ActualChangeIdV1Schema>;
export type DiffHunkEvidenceIdV1 = z.infer<
  typeof DiffHunkEvidenceIdV1Schema
>;
export type AnalysisBoundaryEvidenceIdV1 = z.infer<
  typeof AnalysisBoundaryEvidenceIdV1Schema
>;
export type StrongFindingIdV1 = z.infer<typeof StrongFindingIdV1Schema>;
export type StrongPlannedChangeIdV1 = z.infer<
  typeof StrongPlannedChangeIdV1Schema
>;
export type VerificationPlanEntryIdV1 = z.infer<
  typeof VerificationPlanEntryIdV1Schema
>;
export type TaskBaselineArtifactIdV1 = z.infer<
  typeof TaskBaselineArtifactIdV1Schema
>;
export type RepositoryBasisRecordIdV1 = z.infer<
  typeof RepositoryBasisRecordIdV1Schema
>;
export type ContextGenerationIdV1 = z.infer<
  typeof ContextGenerationIdV1Schema
>;
export type StrongVerificationRecordIdV1 = z.infer<
  typeof StrongVerificationRecordIdV1Schema
>;
export type PathSafeRepositoryRelativePathV1 = z.infer<
  typeof PathSafeRepositoryRelativePathV1Schema
>;
export type Revision = z.infer<typeof RevisionSchema>;
export type ProducerVersion = z.infer<typeof ProducerVersionSchema>;
export type IsoTimestamp = z.infer<typeof IsoTimestampSchema>;
export type ContentDigest = z.infer<typeof ContentDigestSchema>;
export type GitObjectId = z.infer<typeof GitObjectIdSchema>;
export type RepositoryRelativePath = z.infer<typeof RepositoryRelativePathSchema>;
export type LineRange = z.infer<typeof LineRangeSchema>;
