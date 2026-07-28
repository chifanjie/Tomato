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
export type Revision = z.infer<typeof RevisionSchema>;
export type ProducerVersion = z.infer<typeof ProducerVersionSchema>;
export type IsoTimestamp = z.infer<typeof IsoTimestampSchema>;
export type ContentDigest = z.infer<typeof ContentDigestSchema>;
export type GitObjectId = z.infer<typeof GitObjectIdSchema>;
export type RepositoryRelativePath = z.infer<typeof RepositoryRelativePathSchema>;
export type LineRange = z.infer<typeof LineRangeSchema>;
