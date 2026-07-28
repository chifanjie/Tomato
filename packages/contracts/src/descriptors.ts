import { z } from "zod";
import {
  ArtifactTypeV1Schema,
  TASK_SCOPED_ARTIFACT_TYPES,
  type ArtifactTypeV1,
} from "./artifact-envelope.js";
import {
  ArtifactIdSchema,
  ContentDigestSchema,
  IsoTimestampSchema,
  OpaqueIdentifierSchema,
  ProducerVersionSchema,
  RepositoryIdSchema,
  RepositoryRelativePathSchema,
  RevisionSchema,
  SchemaVersionV1Schema,
  SnapshotIdSchema,
  TaskIdSchema,
  WorktreeIdSchema,
} from "./primitives.js";

export const LegacyArtifactTypeV1Schema = z.enum([
  "graph",
  "graph_meta",
  "fingerprint",
  "wiki_index",
  "wiki_search_index",
  "wiki_document_traces",
  "wiki_generation_report",
  "diff_overlay",
]);

export const LegacyRawFormatV1Schema = z.enum([
  "graph_v1",
  "graph_meta_v1",
  "fingerprint_v1",
  "wiki_v1",
  "wiki_v2",
  "wiki_search_v2",
  "wiki_document_traces_v2",
  "wiki_generation_report_v2",
  "diff_overlay_v1",
]);

export const LegacyReadPolicyV1Schema = z.enum([
  "legacy_read_write",
  "legacy_read_only",
  "historical_read_only",
]);

export type LegacyArtifactTypeV1 = z.infer<typeof LegacyArtifactTypeV1Schema>;
export type LegacyRawFormatV1 = z.infer<typeof LegacyRawFormatV1Schema>;
export type LegacyReadPolicyV1 = z.infer<typeof LegacyReadPolicyV1Schema>;

interface LegacyRawArtifactIdentityV1 {
  descriptorVersion: 1;
  storageFormat: "legacy_raw";
  artifactType: LegacyArtifactTypeV1;
  format: LegacyRawFormatV1;
  path: string;
  schemaVersion: string;
  readPolicy: LegacyReadPolicyV1;
}

export const LEGACY_RAW_ARTIFACT_DESCRIPTORS_V1 = Object.freeze([
  {
    descriptorVersion: 1,
    storageFormat: "legacy_raw",
    artifactType: "graph",
    format: "graph_v1",
    path: ".understand-code/knowledge-graph.json",
    schemaVersion: "1.0.0",
    readPolicy: "legacy_read_write",
  },
  {
    descriptorVersion: 1,
    storageFormat: "legacy_raw",
    artifactType: "graph_meta",
    format: "graph_meta_v1",
    path: ".understand-code/meta.json",
    schemaVersion: "1.0.0",
    readPolicy: "legacy_read_write",
  },
  {
    descriptorVersion: 1,
    storageFormat: "legacy_raw",
    artifactType: "fingerprint",
    format: "fingerprint_v1",
    path: ".understand-code/fingerprints.json",
    schemaVersion: "1.0.0",
    readPolicy: "legacy_read_write",
  },
  {
    descriptorVersion: 1,
    storageFormat: "legacy_raw",
    artifactType: "wiki_index",
    format: "wiki_v1",
    path: ".understand-code/knowledge-base/wiki-index.json",
    schemaVersion: "1",
    readPolicy: "legacy_read_only",
  },
  {
    descriptorVersion: 1,
    storageFormat: "legacy_raw",
    artifactType: "wiki_index",
    format: "wiki_v2",
    path: ".understand-code/knowledge-base/wiki-index.json",
    schemaVersion: "2",
    readPolicy: "legacy_read_only",
  },
  {
    descriptorVersion: 1,
    storageFormat: "legacy_raw",
    artifactType: "wiki_search_index",
    format: "wiki_search_v2",
    path: ".understand-code/knowledge-base/search-index.json",
    schemaVersion: "2",
    readPolicy: "legacy_read_only",
  },
  {
    descriptorVersion: 1,
    storageFormat: "legacy_raw",
    artifactType: "wiki_document_traces",
    format: "wiki_document_traces_v2",
    path: ".understand-code/knowledge-base/document-traces.json",
    schemaVersion: "2",
    readPolicy: "legacy_read_only",
  },
  {
    descriptorVersion: 1,
    storageFormat: "legacy_raw",
    artifactType: "wiki_generation_report",
    format: "wiki_generation_report_v2",
    path: ".understand-code/knowledge-base/generation-report.json",
    schemaVersion: "2",
    readPolicy: "legacy_read_only",
  },
  {
    descriptorVersion: 1,
    storageFormat: "legacy_raw",
    artifactType: "diff_overlay",
    format: "diff_overlay_v1",
    path: ".understand-code/diff-overlay.json",
    schemaVersion: "1.0.0",
    readPolicy: "historical_read_only",
  },
] as const satisfies readonly LegacyRawArtifactIdentityV1[]);

function hasRegisteredLegacyRawIdentityV1(
  descriptor: LegacyRawArtifactIdentityV1,
): boolean {
  return LEGACY_RAW_ARTIFACT_DESCRIPTORS_V1.some(
    (registered) =>
      registered.artifactType === descriptor.artifactType &&
      registered.format === descriptor.format &&
      registered.path === descriptor.path &&
      registered.schemaVersion === descriptor.schemaVersion &&
      registered.readPolicy === descriptor.readPolicy,
  );
}

export const LegacyRawArtifactDescriptorV1Schema = z
  .strictObject({
    descriptorVersion: SchemaVersionV1Schema,
    storageFormat: z.literal("legacy_raw"),
    artifactType: LegacyArtifactTypeV1Schema,
    format: LegacyRawFormatV1Schema,
    path: RepositoryRelativePathSchema,
    schemaVersion: z.string().min(1).max(64),
    readPolicy: LegacyReadPolicyV1Schema,
    producerVersion: ProducerVersionSchema.optional(),
  })
  .superRefine((descriptor, context) => {
    if (!hasRegisteredLegacyRawIdentityV1(descriptor)) {
      context.addIssue({
        code: "custom",
        path: ["format"],
        message:
          "legacy_raw artifact type, format, path, version, and read policy must match a registered descriptor",
      });
    }
  });

export type LegacyRawArtifactDescriptorV1 = z.infer<
  typeof LegacyRawArtifactDescriptorV1Schema
>;

export const ManagedArtifactTypeV1Schema = z.union([
  ArtifactTypeV1Schema,
  LegacyArtifactTypeV1Schema,
  z.literal("task_event_log"),
]);

export const ArtifactStorageFormatV1Schema = z.enum([
  "enveloped_v1",
  "legacy_raw",
  "jsonl_v1",
]);

export const ArtifactDescriptorStateV1Schema = z.enum([
  "current",
  "historical",
  "read_only_recovery",
  "corrupt",
]);

export const ArtifactDescriptorFreshnessV1Schema = z.enum([
  "fresh",
  "partial",
  "stale",
  "invalid",
]);

export const ArtifactDependencyRelationV1Schema = z.enum([
  "derived_from",
  "requires",
  "indexes",
  "projects",
]);

export const ArtifactDependencyV1Schema = z.strictObject({
  artifactId: ArtifactIdSchema,
  relation: ArtifactDependencyRelationV1Schema,
  requiredDigest: ContentDigestSchema.optional(),
  requiredSnapshotId: SnapshotIdSchema.optional(),
});

const taskScopedArtifactTypes = new Set<ArtifactTypeV1>(
  TASK_SCOPED_ARTIFACT_TYPES,
);

export const ArtifactDescriptorV1Schema = z
  .strictObject({
    descriptorVersion: SchemaVersionV1Schema,
    artifactId: ArtifactIdSchema,
    artifactType: ManagedArtifactTypeV1Schema,
    storageFormat: ArtifactStorageFormatV1Schema,
    path: RepositoryRelativePathSchema,
    schemaVersion: z.union([
      z.number().int().positive(),
      z.string().min(1).max(64),
    ]),
    producerVersion: ProducerVersionSchema.optional(),
    sourceSnapshotId: SnapshotIdSchema.optional(),
    taskId: TaskIdSchema.optional(),
    revision: RevisionSchema.optional(),
    contentDigest: ContentDigestSchema.optional(),
    state: ArtifactDescriptorStateV1Schema,
    freshness: ArtifactDescriptorFreshnessV1Schema,
    generatedAt: IsoTimestampSchema.optional(),
    legacyFormat: LegacyRawFormatV1Schema.optional(),
    dependencies: z.array(ArtifactDependencyV1Schema),
  })
  .superRefine((descriptor, context) => {
    const envelopeArtifact = ArtifactTypeV1Schema.safeParse(descriptor.artifactType).success;
    const legacyArtifact = LegacyArtifactTypeV1Schema.safeParse(
      descriptor.artifactType,
    ).success;

    if (descriptor.state === "current") {
      for (const field of [
        "sourceSnapshotId",
        "contentDigest",
        "generatedAt",
      ] as const) {
        if (descriptor[field] === undefined) {
          context.addIssue({
            code: "custom",
            path: [field],
            message: `current artifact descriptors require ${field}`,
          });
        }
      }
    }
    if (descriptor.state === "corrupt" && descriptor.freshness !== "invalid") {
      context.addIssue({
        code: "custom",
        path: ["freshness"],
        message: "corrupt artifact descriptors must have invalid freshness",
      });
    }

    if (descriptor.storageFormat === "enveloped_v1") {
      if (!envelopeArtifact) {
        context.addIssue({
          code: "custom",
          path: ["artifactType"],
          message: "enveloped_v1 requires a V1 envelope artifact type",
        });
      }
      for (const field of ["sourceSnapshotId", "revision", "contentDigest"] as const) {
        if (descriptor[field] === undefined) {
          context.addIssue({
            code: "custom",
            path: [field],
            message: `enveloped_v1 requires ${field}`,
          });
        }
      }
      if (descriptor.legacyFormat !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["legacyFormat"],
          message: "enveloped_v1 must not include legacyFormat",
        });
      }
    }

    if (descriptor.storageFormat === "legacy_raw") {
      if (!legacyArtifact) {
        context.addIssue({
          code: "custom",
          path: ["artifactType"],
          message: "legacy_raw requires an explicit legacy artifact type",
        });
      }
      if (descriptor.legacyFormat === undefined) {
        context.addIssue({
          code: "custom",
          path: ["legacyFormat"],
          message: "legacy_raw requires legacyFormat",
        });
      }
      const registeredLegacyDescriptor =
        descriptor.legacyFormat !== undefined &&
        typeof descriptor.schemaVersion === "string" &&
        LEGACY_RAW_ARTIFACT_DESCRIPTORS_V1.some(
          (registered) =>
            registered.artifactType === descriptor.artifactType &&
            registered.format === descriptor.legacyFormat &&
            registered.path === descriptor.path &&
            registered.schemaVersion === descriptor.schemaVersion,
        );
      if (!registeredLegacyDescriptor) {
        context.addIssue({
          code: "custom",
          path: ["legacyFormat"],
          message:
            "legacy_raw artifact type, format, path, and version must match a registered descriptor",
        });
      }
      if (
        descriptor.artifactType === "diff_overlay" &&
        descriptor.state !== "historical"
      ) {
        context.addIssue({
          code: "custom",
          path: ["state"],
          message: "legacy Diff Overlay must remain historical",
        });
      }
    }

    if (descriptor.storageFormat === "jsonl_v1") {
      if (descriptor.artifactType !== "task_event_log") {
        context.addIssue({
          code: "custom",
          path: ["artifactType"],
          message: "jsonl_v1 is reserved for task_event_log",
        });
      }
      for (const field of [
        "sourceSnapshotId",
        "taskId",
        "revision",
        "contentDigest",
      ] as const) {
        if (descriptor[field] === undefined) {
          context.addIssue({
            code: "custom",
            path: [field],
            message: `task_event_log requires ${field}`,
          });
        }
      }
      if (descriptor.legacyFormat !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["legacyFormat"],
          message: "task_event_log must not include legacyFormat",
        });
      }
    }

    const taskScoped =
      descriptor.artifactType === "task_event_log" ||
      (envelopeArtifact &&
        taskScopedArtifactTypes.has(descriptor.artifactType as ArtifactTypeV1));
    if (taskScoped && descriptor.taskId === undefined) {
      context.addIssue({
        code: "custom",
        path: ["taskId"],
        message: `${descriptor.artifactType} requires taskId`,
      });
    }
    if (!taskScoped && descriptor.taskId !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["taskId"],
        message: `${descriptor.artifactType} must not include taskId`,
      });
    }

    const dependencyIds = new Set<string>();
    descriptor.dependencies.forEach((dependency, index) => {
      if (dependencyIds.has(dependency.artifactId)) {
        context.addIssue({
          code: "custom",
          path: ["dependencies", index, "artifactId"],
          message: `duplicate dependency ${dependency.artifactId}`,
        });
      }
      dependencyIds.add(dependency.artifactId);
    });
  });

export const TaskEventLogArtifactDescriptorV1Schema =
  ArtifactDescriptorV1Schema.refine(
    (descriptor) =>
      descriptor.storageFormat === "jsonl_v1" &&
      descriptor.artifactType === "task_event_log",
    {
      message: "descriptor must describe a V1 task event JSONL file",
    },
  );

export interface ArtifactDependencyDagIssueV1 {
  code:
    | "duplicate_artifact_id"
    | "duplicate_artifact_path"
    | "dangling_dependency"
    | "self_dependency"
    | "dependency_digest_mismatch"
    | "dependency_snapshot_mismatch"
    | "dependency_freshness_mismatch"
    | "artifact_snapshot_mismatch"
    | "dependency_cycle";
  artifactId: string;
  dependencyArtifactId?: string;
  message: string;
}

export function validateArtifactDependencyDagV1(
  artifacts: readonly ArtifactDescriptorV1[],
  options: { latestSnapshotId?: string } = {},
): ArtifactDependencyDagIssueV1[] {
  const issues: ArtifactDependencyDagIssueV1[] = [];
  const byId = new Map<string, ArtifactDescriptorV1>();
  const byPath = new Map<string, ArtifactDescriptorV1>();

  for (const artifact of artifacts) {
    if (byId.has(artifact.artifactId)) {
      issues.push({
        code: "duplicate_artifact_id",
        artifactId: artifact.artifactId,
        message: `Duplicate artifact ID: ${artifact.artifactId}`,
      });
    } else {
      byId.set(artifact.artifactId, artifact);
    }
    if (byPath.has(artifact.path)) {
      issues.push({
        code: "duplicate_artifact_path",
        artifactId: artifact.artifactId,
        message: `Duplicate artifact path: ${artifact.path}`,
      });
    } else {
      byPath.set(artifact.path, artifact);
    }
  }

  for (const artifact of artifacts) {
    for (const dependency of artifact.dependencies) {
      if (dependency.artifactId === artifact.artifactId) {
        issues.push({
          code: "self_dependency",
          artifactId: artifact.artifactId,
          dependencyArtifactId: dependency.artifactId,
          message: `${artifact.artifactId} depends on itself`,
        });
        continue;
      }
      const target = byId.get(dependency.artifactId);
      if (target === undefined) {
        issues.push({
          code: "dangling_dependency",
          artifactId: artifact.artifactId,
          dependencyArtifactId: dependency.artifactId,
          message: `${artifact.artifactId} depends on missing ${dependency.artifactId}`,
        });
        continue;
      }
      if (
        dependency.requiredDigest !== undefined &&
        target.contentDigest !== dependency.requiredDigest
      ) {
        issues.push({
          code: "dependency_digest_mismatch",
          artifactId: artifact.artifactId,
          dependencyArtifactId: dependency.artifactId,
          message: `${artifact.artifactId} requires a different digest for ${dependency.artifactId}`,
        });
      }
      if (
        dependency.requiredSnapshotId !== undefined &&
        target.sourceSnapshotId !== dependency.requiredSnapshotId
      ) {
        issues.push({
          code: "dependency_snapshot_mismatch",
          artifactId: artifact.artifactId,
          dependencyArtifactId: dependency.artifactId,
          message: `${artifact.artifactId} requires a different snapshot for ${dependency.artifactId}`,
        });
      }
      if (
        artifact.freshness === "fresh" &&
        target.freshness !== "fresh"
      ) {
        issues.push({
          code: "dependency_freshness_mismatch",
          artifactId: artifact.artifactId,
          dependencyArtifactId: dependency.artifactId,
          message: `${artifact.artifactId} cannot be fresh while ${dependency.artifactId} is ${target.freshness}`,
        });
      }
    }
  }

  if (options.latestSnapshotId !== undefined) {
    for (const artifact of artifacts) {
      if (
        artifact.state === "current" &&
        artifact.freshness === "fresh" &&
        artifact.sourceSnapshotId !== options.latestSnapshotId
      ) {
        issues.push({
          code: "artifact_snapshot_mismatch",
          artifactId: artifact.artifactId,
          message: `${artifact.artifactId} is fresh but does not target manifest latestSnapshotId`,
        });
      }
    }
  }

  const visitState = new Map<string, "visiting" | "visited">();
  const cycleArtifacts = new Set<string>();
  const visit = (artifactId: string, path: string[]): void => {
    const state = visitState.get(artifactId);
    if (state === "visited") return;
    if (state === "visiting") {
      const cycleStart = path.indexOf(artifactId);
      const cycle = [...path.slice(Math.max(0, cycleStart)), artifactId];
      const cycleKey = cycle.join(" -> ");
      if (!cycleArtifacts.has(cycleKey)) {
        cycleArtifacts.add(cycleKey);
        issues.push({
          code: "dependency_cycle",
          artifactId,
          message: `Artifact dependency cycle: ${cycleKey}`,
        });
      }
      return;
    }
    visitState.set(artifactId, "visiting");
    const artifact = byId.get(artifactId);
    for (const dependency of artifact?.dependencies ?? []) {
      if (byId.has(dependency.artifactId)) {
        visit(dependency.artifactId, [...path, artifactId]);
      }
    }
    visitState.set(artifactId, "visited");
  };

  for (const artifactId of byId.keys()) visit(artifactId, []);
  return issues;
}

export const ArtifactManifestV1Schema = z
  .strictObject({
    schemaVersion: SchemaVersionV1Schema,
    repositoryId: RepositoryIdSchema,
    worktreeId: WorktreeIdSchema,
    status: z.enum(["ready", "cold", "error"]),
    latestSnapshotId: SnapshotIdSchema.optional(),
    producerVersion: ProducerVersionSchema,
    updatedAt: IsoTimestampSchema,
    reasons: z.array(z.string().min(1).max(4_096)),
    artifacts: z.array(ArtifactDescriptorV1Schema),
  })
  .superRefine((manifest, context) => {
    if (manifest.status === "ready" && manifest.latestSnapshotId === undefined) {
      context.addIssue({
        code: "custom",
        path: ["latestSnapshotId"],
        message: "ready artifact manifest requires latestSnapshotId",
      });
    }
    if (manifest.status !== "ready" && manifest.reasons.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["reasons"],
        message: `${manifest.status} artifact manifest requires at least one reason`,
      });
    }
    const referencedSnapshotDescriptor =
      manifest.latestSnapshotId === undefined
        ? undefined
        : manifest.artifacts.find(
            (artifact) =>
              artifact.artifactType === "repository_snapshot" &&
              artifact.sourceSnapshotId === manifest.latestSnapshotId,
          );
    const readySnapshotDescriptor =
      manifest.latestSnapshotId === undefined
        ? undefined
        : manifest.artifacts.find(
            (artifact) =>
              artifact.artifactType === "repository_snapshot" &&
              artifact.sourceSnapshotId === manifest.latestSnapshotId &&
              artifact.storageFormat === "enveloped_v1" &&
              artifact.schemaVersion === 1 &&
              artifact.state === "current" &&
              (artifact.freshness === "fresh" ||
                artifact.freshness === "partial") &&
              artifact.producerVersion !== undefined,
          );
    if (
      manifest.latestSnapshotId !== undefined &&
      referencedSnapshotDescriptor === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["latestSnapshotId"],
        message: "latestSnapshotId must have a repository_snapshot descriptor",
      });
    }
    if (
      manifest.status === "ready" &&
      manifest.latestSnapshotId !== undefined &&
      readySnapshotDescriptor === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["latestSnapshotId"],
        message:
          "latestSnapshotId must have a current, usable V1 repository_snapshot descriptor",
      });
    }

    for (const issue of validateArtifactDependencyDagV1(manifest.artifacts, {
      latestSnapshotId: manifest.latestSnapshotId,
    })) {
      const artifactIndex = manifest.artifacts.findIndex(
        (artifact) => artifact.artifactId === issue.artifactId,
      );
      context.addIssue({
        code: "custom",
        path: ["artifacts", Math.max(0, artifactIndex)],
        message: issue.message,
      });
    }
  });

export type ManagedArtifactTypeV1 = z.infer<typeof ManagedArtifactTypeV1Schema>;
export type ArtifactStorageFormatV1 = z.infer<typeof ArtifactStorageFormatV1Schema>;
export type ArtifactDescriptorStateV1 = z.infer<typeof ArtifactDescriptorStateV1Schema>;
export type ArtifactDescriptorFreshnessV1 = z.infer<
  typeof ArtifactDescriptorFreshnessV1Schema
>;
export type ArtifactDependencyRelationV1 = z.infer<
  typeof ArtifactDependencyRelationV1Schema
>;
export type ArtifactDependencyV1 = z.infer<typeof ArtifactDependencyV1Schema>;
export type ArtifactDescriptorV1 = z.infer<typeof ArtifactDescriptorV1Schema>;
export type TaskEventLogArtifactDescriptorV1 = z.infer<
  typeof TaskEventLogArtifactDescriptorV1Schema
>;
export type ArtifactManifestV1 = z.infer<typeof ArtifactManifestV1Schema>;
