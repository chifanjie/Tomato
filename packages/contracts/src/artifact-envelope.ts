import { z } from "zod";
import { canonicalizeJson } from "./canonical-json.js";
import {
  ArtifactIdSchema,
  ContentDigestSchema,
  IsoTimestampSchema,
  ProducerVersionSchema,
  RepositoryIdSchema,
  RevisionSchema,
  SchemaVersionV1Schema,
  SnapshotIdSchema,
  TaskIdSchema,
  WorktreeIdSchema,
  type ArtifactId,
  type ContentDigest,
  type IsoTimestamp,
  type ProducerVersion,
  type RepositoryId,
  type Revision,
  type SnapshotId,
  type TaskId,
  type WorktreeId,
} from "./primitives.js";

export const ArtifactTypeV1Schema = z.enum([
  "repository_snapshot",
  "repo_pulse",
  "task_manifest",
  "task_brief",
  "claim_ledger",
  "evidence_ledger",
  "impact",
  "task_operation_journal",
  "change_check",
  "verification",
]);

export type ArtifactTypeV1 = z.infer<typeof ArtifactTypeV1Schema>;

export const TASK_SCOPED_ARTIFACT_TYPES = Object.freeze([
  "task_manifest",
  "task_brief",
  "claim_ledger",
  "evidence_ledger",
  "impact",
  "task_operation_journal",
  "change_check",
  "verification",
] as const satisfies readonly ArtifactTypeV1[]);

const taskScopedArtifactTypes = new Set<ArtifactTypeV1>(TASK_SCOPED_ARTIFACT_TYPES);

const artifactEnvelopeShape = {
  schemaVersion: SchemaVersionV1Schema,
  artifactType: ArtifactTypeV1Schema,
  artifactId: ArtifactIdSchema,
  repositoryId: RepositoryIdSchema,
  worktreeId: WorktreeIdSchema,
  sourceSnapshotId: SnapshotIdSchema,
  taskId: TaskIdSchema.optional(),
  revision: RevisionSchema,
  producerVersion: ProducerVersionSchema,
  createdAt: IsoTimestampSchema,
  contentDigest: ContentDigestSchema,
};

function validateTaskScope(
  envelope: { artifactType: ArtifactTypeV1; taskId?: string },
  context: z.core.$RefinementCtx,
): void {
  const taskScoped = taskScopedArtifactTypes.has(envelope.artifactType);
  if (taskScoped && envelope.taskId === undefined) {
    context.addIssue({
      code: "custom",
      path: ["taskId"],
      message: `${envelope.artifactType} requires taskId`,
    });
  }
  if (!taskScoped && envelope.taskId !== undefined) {
    context.addIssue({
      code: "custom",
      path: ["taskId"],
      message: `${envelope.artifactType} must not include taskId`,
    });
  }
}

export const ArtifactEnvelopeBaseV1Schema = z
  .strictObject({
    ...artifactEnvelopeShape,
    payload: z.unknown(),
  })
  .superRefine(validateTaskScope);

export function createArtifactEnvelopeV1Schema<
  const TArtifactType extends ArtifactTypeV1,
  TPayloadSchema extends z.ZodType,
>(artifactType: TArtifactType, payloadSchema: TPayloadSchema) {
  return z
    .strictObject({
      ...artifactEnvelopeShape,
      artifactType: z.literal(artifactType),
      payload: payloadSchema,
    })
    .superRefine(validateTaskScope);
}

export interface ArtifactEnvelopeV1<TPayload = unknown> {
  schemaVersion: 1;
  artifactType: ArtifactTypeV1;
  artifactId: ArtifactId;
  repositoryId: RepositoryId;
  worktreeId: WorktreeId;
  sourceSnapshotId: SnapshotId;
  taskId?: TaskId;
  revision: Revision;
  producerVersion: ProducerVersion;
  createdAt: IsoTimestamp;
  contentDigest: ContentDigest;
  payload: TPayload;
}

/**
 * The digest input is payload-only. Envelope IDs, timestamps, revisions and
 * the contentDigest field itself never participate in this canonical string.
 */
export function canonicalArtifactPayloadJson(
  envelope: Pick<ArtifactEnvelopeV1, "payload">,
): string {
  return canonicalizeJson(envelope.payload);
}

export interface ArtifactIntegrityResultV1 {
  valid: boolean;
  expectedDigest: ContentDigest;
  actualDigest: ContentDigest;
}

/**
 * Verifies payload integrity without importing a host crypto implementation.
 * Consumers provide the SHA-256 function so this package remains portable in
 * Node, browsers, workers, and embedded MCP runtimes.
 */
export function verifyArtifactContentDigestV1(
  envelope: Pick<ArtifactEnvelopeV1, "payload" | "contentDigest">,
  digestCanonicalJson: (canonicalPayloadJson: string) => string,
): ArtifactIntegrityResultV1 {
  const expectedDigest = ContentDigestSchema.parse(envelope.contentDigest);
  const actualDigest = ContentDigestSchema.parse(
    digestCanonicalJson(canonicalArtifactPayloadJson(envelope)),
  );
  return {
    valid: expectedDigest === actualDigest,
    expectedDigest,
    actualDigest,
  };
}
