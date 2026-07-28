import { describe, expect, it } from "vitest";
import {
  ArtifactDescriptorV1Schema,
  ArtifactManifestV1Schema,
  LEGACY_RAW_ARTIFACT_DESCRIPTORS_V1,
  LegacyRawArtifactDescriptorV1Schema,
  TaskEventLogArtifactDescriptorV1Schema,
  validateArtifactDependencyDagV1,
  type ArtifactDescriptorV1,
} from "../src/descriptors.js";

const digestA = `sha256:${"a".repeat(64)}`;
const digestB = `sha256:${"b".repeat(64)}`;
const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";

function descriptor(
  overrides: Partial<ArtifactDescriptorV1> = {},
): ArtifactDescriptorV1 {
  return {
    descriptorVersion: 1,
    artifactId: "artifact:snapshot",
    artifactType: "repository_snapshot",
    storageFormat: "enveloped_v1",
    path: ".understand-code/snapshots/snapshot-1.json",
    schemaVersion: 1,
    producerVersion: "3.0.0-alpha.1",
    sourceSnapshotId: "snapshot:1",
    revision: 0,
    contentDigest: digestA,
    state: "current",
    freshness: "fresh",
    generatedAt: "2026-07-28T08:30:00Z",
    dependencies: [],
    ...overrides,
  };
}

describe("legacy_raw artifact descriptors", () => {
  it("strictly describes every supported legacy artifact without enveloping it", () => {
    expect(LEGACY_RAW_ARTIFACT_DESCRIPTORS_V1.length).toBe(9);
    for (const descriptor of LEGACY_RAW_ARTIFACT_DESCRIPTORS_V1) {
      expect(LegacyRawArtifactDescriptorV1Schema.safeParse(descriptor).success).toBe(
        true,
      );
      expect(descriptor.storageFormat).toBe("legacy_raw");
      expect(descriptor.path.startsWith(".understand-code/")).toBe(true);
    }
  });

  it("keeps legacy Diff Overlay historical and read-only", () => {
    const descriptor = LEGACY_RAW_ARTIFACT_DESCRIPTORS_V1.find(
      (candidate) => candidate.artifactType === "diff_overlay",
    );
    expect(descriptor).toMatchObject({
      format: "diff_overlay_v1",
      readPolicy: "historical_read_only",
    });
  });

  it("lists Graph and both readable Wiki index versions explicitly", () => {
    expect(
      LEGACY_RAW_ARTIFACT_DESCRIPTORS_V1.map(
        (descriptor) => `${descriptor.artifactType}:${descriptor.format}`,
      ),
    ).toEqual(
      expect.arrayContaining([
        "graph:graph_v1",
        "wiki_index:wiki_v1",
        "wiki_index:wiki_v2",
      ]),
    );
  });

  it("rejects unknown descriptor fields and unsafe paths", () => {
    expect(
      LegacyRawArtifactDescriptorV1Schema.safeParse({
        ...LEGACY_RAW_ARTIFACT_DESCRIPTORS_V1[0],
        unknown: true,
      }).success,
    ).toBe(false);
    expect(
      LegacyRawArtifactDescriptorV1Schema.safeParse({
        ...LEGACY_RAW_ARTIFACT_DESCRIPTORS_V1[0],
        path: "../knowledge-graph.json",
      }).success,
    ).toBe(false);
  });

  it("rejects cross-wired legacy type, format, path, version, and policy tuples", () => {
    const graph = LEGACY_RAW_ARTIFACT_DESCRIPTORS_V1[0];
    const diff = LEGACY_RAW_ARTIFACT_DESCRIPTORS_V1.at(-1)!;

    for (const invalidDescriptor of [
      { ...graph, format: "diff_overlay_v1" },
      { ...graph, path: diff.path },
      { ...graph, schemaVersion: "2" },
      { ...graph, readPolicy: "historical_read_only" },
      { ...diff, readPolicy: "legacy_read_write" },
    ]) {
      expect(
        LegacyRawArtifactDescriptorV1Schema.safeParse(invalidDescriptor).success,
      ).toBe(false);
    }
  });

  it("rejects cross-wired legacy identities in manifest descriptors", () => {
    const legacyGraph = descriptor({
      artifactId: "artifact:legacy-graph",
      artifactType: "graph",
      storageFormat: "legacy_raw",
      path: ".understand-code/knowledge-graph.json",
      schemaVersion: "1.0.0",
      sourceSnapshotId: undefined,
      revision: undefined,
      contentDigest: undefined,
      state: "read_only_recovery",
      freshness: "stale",
      generatedAt: undefined,
      legacyFormat: "graph_v1",
    });

    expect(ArtifactDescriptorV1Schema.safeParse(legacyGraph).success).toBe(true);
    expect(
      ArtifactDescriptorV1Schema.safeParse({
        ...legacyGraph,
        legacyFormat: "diff_overlay_v1",
      }).success,
    ).toBe(false);
    expect(
      ArtifactDescriptorV1Schema.safeParse({
        ...legacyGraph,
        path: ".understand-code/diff-overlay.json",
      }).success,
    ).toBe(false);
  });
});

describe("ArtifactManifestV1 dependency DAG", () => {
  it("accepts strict enveloped, legacy_raw, and task events.jsonl descriptors", () => {
    const snapshotDescriptor = descriptor();
    const pulseDescriptor = descriptor({
      artifactId: "artifact:pulse",
      artifactType: "repo_pulse",
      path: ".understand-code/repo-pulse.json",
      dependencies: [
        {
          artifactId: snapshotDescriptor.artifactId,
          relation: "derived_from",
          requiredDigest: digestA,
          requiredSnapshotId: "snapshot:1",
        },
      ],
    });
    const eventDescriptor = descriptor({
      artifactId: "artifact:events",
      artifactType: "task_event_log",
      storageFormat: "jsonl_v1",
      path: `.understand-code/tasks/${taskId}/events.jsonl`,
      taskId,
      dependencies: [],
    });
    const legacyGraphDescriptor = descriptor({
      artifactId: "artifact:legacy-graph",
      artifactType: "graph",
      storageFormat: "legacy_raw",
      path: ".understand-code/knowledge-graph.json",
      schemaVersion: "1.0.0",
      sourceSnapshotId: undefined,
      revision: undefined,
      contentDigest: undefined,
      state: "read_only_recovery",
      freshness: "stale",
      generatedAt: undefined,
      legacyFormat: "graph_v1",
      dependencies: [],
    });

    expect(
      TaskEventLogArtifactDescriptorV1Schema.safeParse(eventDescriptor).success,
    ).toBe(true);
    expect(
      ArtifactManifestV1Schema.safeParse({
        schemaVersion: 1,
        repositoryId: "repository:1",
        worktreeId: "worktree:1",
        status: "ready",
        latestSnapshotId: "snapshot:1",
        producerVersion: "3.0.0-alpha.1",
        updatedAt: "2026-07-28T08:30:00Z",
        reasons: [],
        artifacts: [
          snapshotDescriptor,
          pulseDescriptor,
          eventDescriptor,
          legacyGraphDescriptor,
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects dangling, self, digest, snapshot, and cyclic dependencies", () => {
    const snapshotDescriptor = descriptor({
      dependencies: [
        {
          artifactId: "artifact:pulse",
          relation: "requires",
        },
      ],
    });
    const pulseDescriptor = descriptor({
      artifactId: "artifact:pulse",
      artifactType: "repo_pulse",
      path: ".understand-code/repo-pulse.json",
      dependencies: [
        {
          artifactId: snapshotDescriptor.artifactId,
          relation: "derived_from",
          requiredDigest: digestB,
          requiredSnapshotId: "snapshot:other",
        },
        {
          artifactId: "artifact:missing",
          relation: "requires",
        },
        {
          artifactId: "artifact:pulse",
          relation: "requires",
        },
      ],
    });

    expect(
      validateArtifactDependencyDagV1([
        snapshotDescriptor,
        pulseDescriptor,
      ]).map((issue) => issue.code),
    ).toEqual(
      expect.arrayContaining([
        "dependency_cycle",
        "dependency_digest_mismatch",
        "dependency_snapshot_mismatch",
        "dangling_dependency",
        "self_dependency",
      ]),
    );
    expect(
      ArtifactManifestV1Schema.safeParse({
        schemaVersion: 1,
        repositoryId: "repository:1",
        worktreeId: "worktree:1",
        status: "ready",
        latestSnapshotId: "snapshot:1",
        producerVersion: "3.0.0-alpha.1",
        updatedAt: "2026-07-28T08:30:00Z",
        reasons: [],
        artifacts: [snapshotDescriptor, pulseDescriptor],
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate artifact IDs and storage paths", () => {
    const first = descriptor();
    const duplicate = descriptor({
      artifactType: "repo_pulse",
    });
    expect(
      validateArtifactDependencyDagV1([first, duplicate]).map(
        (issue) => issue.code,
      ),
    ).toEqual(
      expect.arrayContaining([
        "duplicate_artifact_id",
        "duplicate_artifact_path",
      ]),
    );
  });

  it("prevents fresh dependents from hiding stale or partial dependencies", () => {
    for (const upstreamFreshness of ["partial", "stale", "invalid"] as const) {
      const upstream = descriptor({ freshness: upstreamFreshness });
      const dependent = descriptor({
        artifactId: `artifact:dependent:${upstreamFreshness}`,
        artifactType: "repo_pulse",
        path: `.understand-code/pulse-${upstreamFreshness}.json`,
        dependencies: [
          {
            artifactId: upstream.artifactId,
            relation: "derived_from",
          },
        ],
      });
      expect(
        validateArtifactDependencyDagV1([upstream, dependent]).map(
          (issue) => issue.code,
        ),
      ).toContain("dependency_freshness_mismatch");

      expect(
        validateArtifactDependencyDagV1([
          upstream,
          { ...dependent, freshness: upstreamFreshness },
        ]).map((issue) => issue.code),
      ).not.toContain("dependency_freshness_mismatch");
    }
  });

  it("binds fresh current descriptors to manifest latestSnapshotId", () => {
    const oldSnapshot = descriptor({
      state: "historical",
      sourceSnapshotId: "snapshot:old",
      freshness: "stale",
    });
    const freshOnOldSnapshot = descriptor({
      artifactId: "artifact:pulse",
      artifactType: "repo_pulse",
      path: ".understand-code/repo-pulse.json",
      sourceSnapshotId: "snapshot:old",
    });
    const latestSnapshot = descriptor({
      artifactId: "artifact:latest-snapshot",
      path: ".understand-code/snapshots/latest.json",
      sourceSnapshotId: "snapshot:latest",
    });

    expect(
      ArtifactManifestV1Schema.safeParse({
        schemaVersion: 1,
        repositoryId: "repository:1",
        worktreeId: "worktree:1",
        status: "ready",
        latestSnapshotId: "snapshot:latest",
        producerVersion: "3.0.0-alpha.1",
        updatedAt: "2026-07-28T08:30:00Z",
        reasons: [],
        artifacts: [oldSnapshot, latestSnapshot, freshOnOldSnapshot],
      }).success,
    ).toBe(false);
  });

  it("requires ready manifests to reference a current usable V1 snapshot", () => {
    const manifest = (snapshotDescriptor: ArtifactDescriptorV1) => ({
      schemaVersion: 1,
      repositoryId: "repository:1",
      worktreeId: "worktree:1",
      status: "ready",
      latestSnapshotId: "snapshot:1",
      producerVersion: "3.0.0-alpha.1",
      updatedAt: "2026-07-28T08:30:00Z",
      reasons: [],
      artifacts: [snapshotDescriptor],
    });

    for (const unusableSnapshot of [
      descriptor({ state: "historical", freshness: "stale" }),
      descriptor({ state: "read_only_recovery", freshness: "stale" }),
      descriptor({ state: "corrupt", freshness: "invalid" }),
      descriptor({ freshness: "stale" }),
      descriptor({ freshness: "invalid" }),
      descriptor({ schemaVersion: 2 }),
      descriptor({ producerVersion: undefined }),
    ]) {
      expect(
        ArtifactManifestV1Schema.safeParse(manifest(unusableSnapshot)).success,
      ).toBe(false);
    }

    expect(
      ArtifactManifestV1Schema.safeParse(
        manifest(descriptor({ freshness: "partial" })),
      ).success,
    ).toBe(true);
  });

  it("allows latestSnapshotId omission only for cold/error manifests", () => {
    const base = {
      schemaVersion: 1,
      repositoryId: "repository:1",
      worktreeId: "worktree:1",
      producerVersion: "3.0.0-alpha.1",
      updatedAt: "2026-07-28T08:30:00Z",
      artifacts: [],
    };
    expect(
      ArtifactManifestV1Schema.safeParse({
        ...base,
        status: "ready",
        reasons: [],
      }).success,
    ).toBe(false);
    expect(
      ArtifactManifestV1Schema.safeParse({
        ...base,
        status: "cold",
        reasons: ["Repository has not been captured yet."],
      }).success,
    ).toBe(true);
    expect(
      ArtifactManifestV1Schema.safeParse({
        ...base,
        status: "error",
        reasons: ["Repository state could not be read."],
      }).success,
    ).toBe(true);
  });

  it("requires comparison metadata on active legacy_raw descriptors", () => {
    const activeLegacy = descriptor({
      artifactId: "artifact:legacy-graph",
      artifactType: "graph",
      storageFormat: "legacy_raw",
      path: ".understand-code/knowledge-graph.json",
      schemaVersion: "1.0.0",
      state: "current",
      freshness: "partial",
      legacyFormat: "graph_v1",
    });
    expect(
      LegacyRawArtifactDescriptorV1Schema.safeParse(
        LEGACY_RAW_ARTIFACT_DESCRIPTORS_V1[0],
      ).success,
    ).toBe(true);
    expect(
      ArtifactManifestV1Schema.safeParse({
        schemaVersion: 1,
        repositoryId: "repository:1",
        worktreeId: "worktree:1",
        status: "cold",
        producerVersion: "3.0.0-alpha.1",
        updatedAt: "2026-07-28T08:30:00Z",
        reasons: ["No current repository snapshot."],
        artifacts: [activeLegacy],
      }).success,
    ).toBe(true);

    for (const missingField of [
      "sourceSnapshotId",
      "contentDigest",
      "generatedAt",
    ] as const) {
      expect(
        ArtifactManifestV1Schema.safeParse({
          schemaVersion: 1,
          repositoryId: "repository:1",
          worktreeId: "worktree:1",
          status: "cold",
          producerVersion: "3.0.0-alpha.1",
          updatedAt: "2026-07-28T08:30:00Z",
          reasons: ["No current repository snapshot."],
          artifacts: [{ ...activeLegacy, [missingField]: undefined }],
        }).success,
      ).toBe(false);
    }
  });
});
