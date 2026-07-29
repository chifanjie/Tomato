import { randomUUID } from "node:crypto";
import {
  readdir,
  rename,
  rmdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";

import {
  ArtifactDependencyV1Schema,
  ArtifactDescriptorV1Schema,
  ArtifactManifestV1Schema,
  ArtifactTypeV1Schema,
  ContentDigestSchema,
  IdempotencyKeySchema,
  IsoTimestampSchema,
  ProducerVersionSchema,
  RepositoryIdSchema,
  TaskIdSchema,
  WorktreeIdSchema,
  canonicalizeJson,
  migrateArtifactValueV1,
  parsePersistedArtifactV1,
  verifyArtifactContentDigestV1,
  type ArtifactDependencyV1,
  type ArtifactDescriptorFreshnessV1,
  type ArtifactDescriptorStateV1,
  type ArtifactManifestV1,
  type ArtifactTypeV1,
  type ContentDigest,
  type JsonValue,
  type IdempotencyRecordV1,
  type MigrationStepV1,
  type PersistedArtifactV1,
  type TaskArtifactBundleV1,
  type TaskEventV1,
} from "@understand-code/contracts";

import {
  appendTaskEvent as appendTaskEventFile,
  parseTrustedTaskBundle,
  readTaskEventLog,
  type AppendTaskEventOptions,
  type AppendTaskEventResult,
  type ParsedTaskEventLog,
} from "./event-log.js";
import {
  atomicWriteFile,
  atomicWriteJson,
  readManagedFile,
  readManagedJson,
  type AtomicWriteOptions,
} from "./atomic.js";
import { digestCanonicalJson, sha256Bytes } from "./digest.js";
import { ArtifactStoreError } from "./errors.js";
import {
  createArtifactStoreLayout,
  type ArtifactStoreLayout,
} from "./layout.js";
import {
  withStoreLock,
  type LockAcquireOptions,
} from "./lock.js";
import {
  ensureManagedDirectory,
  repositoryRelativePathFromAbsolute,
  resolveManagedPath,
} from "./path-guard.js";

interface StoreIdempotencyRecord {
  key: string;
  requestDigest: ContentDigest;
  artifactType: ArtifactTypeV1;
  artifactId: string;
  resultRevision: number;
  resultDigest: ContentDigest;
  recordedAt: string;
}

interface StoreIdempotencyIndex {
  version: 1;
  records: StoreIdempotencyRecord[];
}

export interface ArtifactStoreOptions {
  repositoryId: string;
  worktreeId: string;
  producerVersion: string;
  clock?: () => Date;
  lock?: LockAcquireOptions;
}

export interface PersistArtifactOptions {
  expectedRevision?: number;
  idempotencyKey?: string;
  requestDigest?: ContentDigest;
  dependencies?: readonly ArtifactDependencyV1[];
  state?: ArtifactDescriptorStateV1;
  freshness?: ArtifactDescriptorFreshnessV1;
  artifactWrite?: AtomicWriteOptions;
  manifestWrite?: AtomicWriteOptions;
  promoteRecovery?: boolean;
}

export interface PersistArtifactResult<TArtifact extends PersistedArtifactV1> {
  artifact: TArtifact;
  descriptor: ReturnType<typeof ArtifactDescriptorV1Schema.parse>;
  replayed: boolean;
  backupPath?: string;
}

export interface ReadArtifactResult<TArtifact extends PersistedArtifactV1> {
  artifact: TArtifact;
  descriptor: ReturnType<typeof ArtifactDescriptorV1Schema.parse>;
  state: ArtifactDescriptorStateV1;
  freshness: ArtifactDescriptorFreshnessV1;
  latestSnapshotId?: string;
  recoveryState: "current" | "historical" | "read_only_recovery";
}

export interface ReadTaskEventsResult extends ParsedTaskEventLog {
  descriptor: ReturnType<typeof ArtifactDescriptorV1Schema.parse>;
  state: ArtifactDescriptorStateV1;
  freshness: ArtifactDescriptorFreshnessV1;
  latestSnapshotId?: string;
}

export interface ReadManifestOptions {
  verifyArtifacts?: boolean;
}

export interface MigrationExecutionOptions {
  relativePath: string;
  format: string;
  fromVersion: string;
  toVersion: string;
  steps: readonly MigrationStepV1[];
  validate: (value: unknown) => unknown | Promise<unknown>;
  write?: AtomicWriteOptions;
  manifestWrite?: AtomicWriteOptions;
  afterSwitch?: () => void | Promise<void>;
}

export interface MigrationExecutionResult {
  value: JsonValue;
  appliedVersions: string[];
  migrated: boolean;
  backupPath?: string;
}

export interface PersistTaskBundleInput {
  artifacts: readonly PersistedArtifactV1[];
  events: readonly TaskEventV1[];
  idempotencyRecords: readonly IdempotencyRecordV1[];
}

export interface PersistTaskBundleOptions {
  expectedRevision: number;
  idempotencyKey: string;
  requestDigest: ContentDigest;
  dependenciesByArtifactId?: Readonly<
    Record<string, readonly ArtifactDependencyV1[]>
  >;
  artifactWrite?: AtomicWriteOptions;
  manifestWrite?: AtomicWriteOptions;
  promoteRecovery?: boolean;
}

export interface PersistTaskBundleResult {
  bundle: TaskArtifactBundleV1;
  artifacts: PersistedArtifactV1[];
  replayed: boolean;
}

interface PreparedTaskBundle {
  bundle: TaskArtifactBundleV1;
  artifacts: PersistedArtifactV1[];
  taskId: string;
  revision: number;
}

function parseIdempotencyIndex(input: unknown): StoreIdempotencyIndex {
  if (typeof input !== "object" || input === null) {
    throw new ArtifactStoreError(
      "artifact_corrupt",
      "Store idempotency index is not an object.",
    );
  }
  const candidate = input as {
    version?: unknown;
    records?: unknown;
  };
  if (candidate.version !== 1 || !Array.isArray(candidate.records)) {
    throw new ArtifactStoreError(
      "artifact_corrupt",
      "Store idempotency index has an unsupported shape.",
    );
  }
  const records = candidate.records.map((record, index) => {
    if (typeof record !== "object" || record === null) {
      throw new ArtifactStoreError(
        "artifact_corrupt",
        "Store idempotency record is invalid.",
        { index },
      );
    }
    const value = record as Partial<StoreIdempotencyRecord>;
    const key = IdempotencyKeySchema.parse(value.key);
    const requestDigest = ContentDigestSchema.parse(value.requestDigest);
    const resultDigest = ContentDigestSchema.parse(value.resultDigest);
    const recordedAt = IsoTimestampSchema.parse(value.recordedAt);
    if (
      typeof value.artifactType !== "string" ||
      typeof value.artifactId !== "string" ||
      typeof value.resultRevision !== "number" ||
      !Number.isSafeInteger(value.resultRevision) ||
      value.resultRevision < 0
    ) {
      throw new ArtifactStoreError(
        "artifact_corrupt",
        "Store idempotency record fields are invalid.",
        { index },
      );
    }
    return {
      key,
      requestDigest,
      artifactType: ArtifactTypeV1Schema.parse(value.artifactType),
      artifactId: value.artifactId,
      resultRevision: value.resultRevision,
      resultDigest,
      recordedAt,
    };
  });
  if (new Set(records.map((record) => record.key)).size !== records.length) {
    throw new ArtifactStoreError(
      "artifact_corrupt",
      "Store idempotency index contains duplicate keys.",
    );
  }
  return { version: 1, records };
}

function compareArtifacts(
  left: PersistedArtifactV1,
  right: PersistedArtifactV1,
): boolean {
  return canonicalizeJson(left) === canonicalizeJson(right);
}

function isArtifactIntegrityFailure(
  error: unknown,
): error is ArtifactStoreError {
  return (
    error instanceof ArtifactStoreError &&
    (error.code === "artifact_corrupt" ||
      error.code === "artifact_not_found" ||
      error.code === "manifest_inconsistent" ||
      error.code === "reference_integrity_failed")
  );
}

function isCommittedAtomicWriteError(
  error: unknown,
  targetPath: string,
): error is ArtifactStoreError {
  return (
    error instanceof ArtifactStoreError &&
    error.details?.committed === true &&
    error.details?.targetPath === targetPath
  );
}

export class ArtifactStore {
  readonly layout: ArtifactStoreLayout;
  readonly repositoryId: string;
  readonly worktreeId: string;
  readonly producerVersion: string;
  readonly #clock: () => Date;
  readonly #lockOptions?: LockAcquireOptions;

  private constructor(
    layout: ArtifactStoreLayout,
    options: ArtifactStoreOptions,
  ) {
    this.layout = layout;
    this.repositoryId = RepositoryIdSchema.parse(options.repositoryId);
    this.worktreeId = WorktreeIdSchema.parse(options.worktreeId);
    this.producerVersion = ProducerVersionSchema.parse(
      options.producerVersion,
    );
    this.#clock = options.clock ?? (() => new Date());
    this.#lockOptions = options.lock;
  }

  static async open(
    worktreeRoot: string,
    options: ArtifactStoreOptions,
  ): Promise<ArtifactStore> {
    const layout = await createArtifactStoreLayout(worktreeRoot);
    return new ArtifactStore(layout, options);
  }

  #now(): string {
    return IsoTimestampSchema.parse(this.#clock().toISOString());
  }

  async #verifiedSnapshotDescriptor(
    manifest: ArtifactManifestV1,
    snapshotId: string,
    options: {
      requireLatest: boolean;
      subject: string;
    },
  ): Promise<ReturnType<typeof ArtifactDescriptorV1Schema.parse>> {
    if (
      options.requireLatest &&
      manifest.latestSnapshotId !== snapshotId
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `${options.subject} does not target the latest published Repository Snapshot.`,
        {
          sourceSnapshotId: snapshotId,
          latestSnapshotId: manifest.latestSnapshotId,
        },
      );
    }
    const descriptor = manifest.artifacts.find(
      (candidate) =>
        candidate.artifactType === "repository_snapshot" &&
        candidate.storageFormat === "enveloped_v1" &&
        candidate.schemaVersion === 1 &&
        candidate.sourceSnapshotId === snapshotId &&
        candidate.state !== "corrupt" &&
        (!options.requireLatest ||
          candidate.state === "current" ||
          candidate.state === "read_only_recovery"),
    );
    if (descriptor === undefined) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `${options.subject} requires a published Repository Snapshot descriptor.`,
        {
          sourceSnapshotId: snapshotId,
          latestSnapshotId: manifest.latestSnapshotId,
        },
      );
    }

    const snapshotPath = this.layout.snapshot(snapshotId);
    const expectedPath = repositoryRelativePathFromAbsolute(
      this.layout.worktreeRoot,
      snapshotPath,
    );
    if (descriptor.path !== expectedPath) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        "Repository Snapshot descriptor path is not canonical.",
        {
          artifactId: descriptor.artifactId,
          expectedPath,
          actualPath: descriptor.path,
        },
      );
    }
    const artifact = await this.#readArtifactPath(snapshotPath);
    if (
      artifact.artifactType !== "repository_snapshot" ||
      artifact.artifactId !== descriptor.artifactId ||
      artifact.sourceSnapshotId !== snapshotId ||
      artifact.revision !== descriptor.revision ||
      artifact.contentDigest !== descriptor.contentDigest ||
      artifact.taskId !== undefined
    ) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        "Repository Snapshot bytes do not match their published descriptor.",
        { artifactId: descriptor.artifactId, sourceSnapshotId: snapshotId },
      );
    }
    return descriptor;
  }

  async #usableSnapshotDescriptor(
    manifest: ArtifactManifestV1,
    snapshotId: string,
  ): Promise<
    ReturnType<typeof ArtifactDescriptorV1Schema.parse> | undefined
  > {
    try {
      return await this.#verifiedSnapshotDescriptor(manifest, snapshotId, {
        requireLatest: true,
        subject: "The write transaction",
      });
    } catch (error) {
      if (isArtifactIntegrityFailure(error)) return undefined;
      throw error;
    }
  }

  async #hasUsableSnapshot(
    manifest: ArtifactManifestV1,
    snapshotId: string,
  ): Promise<boolean> {
    return (
      (await this.#usableSnapshotDescriptor(manifest, snapshotId)) !==
      undefined
    );
  }

  async #requireUsableSnapshot(
    manifest: ArtifactManifestV1,
    snapshotId: string,
    subject: string,
  ): Promise<ReturnType<typeof ArtifactDescriptorV1Schema.parse>> {
    const descriptor = await this.#usableSnapshotDescriptor(
      manifest,
      snapshotId,
    );
    if (descriptor !== undefined) return descriptor;
    throw new ArtifactStoreError(
      "reference_integrity_failed",
      `${subject} requires verified bytes for the current published Repository Snapshot.`,
      {
        sourceSnapshotId: snapshotId,
        latestSnapshotId: manifest.latestSnapshotId,
      },
    );
  }

  async #requireReadableSourceSnapshot(
    manifest: ArtifactManifestV1,
    snapshotId: string,
    subject: string,
  ): Promise<ReturnType<typeof ArtifactDescriptorV1Schema.parse>> {
    try {
      return await this.#verifiedSnapshotDescriptor(manifest, snapshotId, {
        requireLatest: false,
        subject,
      });
    } catch (error) {
      if (!isArtifactIntegrityFailure(error)) throw error;
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        `${subject} cannot be trusted because its source Repository Snapshot bytes are unavailable or invalid.`,
        {
          sourceSnapshotId: snapshotId,
          integrityCode: error.code,
        },
        { cause: error },
      );
    }
  }

  async #requireArtifactSourceSnapshot(
    manifest: ArtifactManifestV1,
    descriptor: ReturnType<typeof ArtifactDescriptorV1Schema.parse>,
    artifact: PersistedArtifactV1,
    subject: string,
  ): Promise<void> {
    if (
      artifact.artifactType === "repository_snapshot" ||
      this.#isContextlessColdRecovery(manifest, descriptor)
    ) {
      return;
    }
    await this.#requireReadableSourceSnapshot(
      manifest,
      artifact.sourceSnapshotId,
      subject,
    );
  }

  async #requireReplayableArtifact(
    artifact: PersistedArtifactV1,
    targetPath: string,
    subject: string,
  ): Promise<ReturnType<typeof ArtifactDescriptorV1Schema.parse>> {
    const manifest = await this.#readManifestRaw();
    const descriptor = await this.#requirePublishedDescriptor(
      artifact,
      targetPath,
      manifest,
    );
    await this.#requireArtifactSourceSnapshot(
      manifest,
      descriptor,
      artifact,
      subject,
    );
    if (artifact.taskId === undefined) {
      await this.#verifyDescriptorGraph(manifest, [descriptor]);
    } else {
      await this.#verifyTaskDescriptorSet(manifest, artifact.taskId);
    }
    await this.#requireStableManifest(manifest);
    return descriptor;
  }

  #readArtifactResult<TArtifact extends PersistedArtifactV1>(
    artifact: TArtifact,
    descriptor: ReturnType<typeof ArtifactDescriptorV1Schema.parse>,
    manifest: ArtifactManifestV1,
  ): ReadArtifactResult<TArtifact> {
    return {
      artifact,
      descriptor,
      state: descriptor.state,
      freshness: descriptor.freshness,
      ...(manifest.latestSnapshotId === undefined
        ? {}
        : { latestSnapshotId: manifest.latestSnapshotId }),
      recoveryState:
        descriptor.state === "read_only_recovery"
          ? "read_only_recovery"
          : descriptor.state === "historical"
            ? "historical"
            : "current",
    };
  }

  async #verifyDescriptorBytes(
    manifest: ArtifactManifestV1,
    descriptor: ReturnType<typeof ArtifactDescriptorV1Schema.parse>,
  ): Promise<void> {
    if (
      descriptor.state === "corrupt" ||
      descriptor.freshness === "invalid"
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "A trusted read cannot use a corrupt or invalid Artifact descriptor.",
        {
          artifactId: descriptor.artifactId,
          state: descriptor.state,
          freshness: descriptor.freshness,
        },
      );
    }
    const absolutePath = await resolveManagedPath(
      this.layout.worktreeRoot,
      descriptor.path,
    );
    if (descriptor.storageFormat === "enveloped_v1") {
      const artifact = await this.#readArtifactPath(absolutePath);
      await this.#requirePublishedDescriptor(
        artifact,
        absolutePath,
        manifest,
      );
      await this.#requireArtifactSourceSnapshot(
        manifest,
        descriptor,
        artifact,
        `Artifact dependency ${descriptor.artifactId}`,
      );
      return;
    }
    if (descriptor.storageFormat === "jsonl_v1") {
      if (
        descriptor.taskId === undefined ||
        descriptor.sourceSnapshotId === undefined ||
        absolutePath !== this.layout.task(descriptor.taskId).events
      ) {
        throw new ArtifactStoreError(
          "manifest_inconsistent",
          "Task event-log dependency path or identity is not canonical.",
          { artifactId: descriptor.artifactId },
        );
      }
      const parsed = await readTaskEventLog(
        this.layout,
        descriptor.taskId,
      );
      const lastEvent = parsed.events.at(-1);
      if (
        parsed.truncatedTail !== undefined ||
        parsed.contentDigest !== descriptor.contentDigest ||
        lastEvent?.revision !== descriptor.revision ||
        (lastEvent?.sourceSnapshotId !== undefined &&
          lastEvent.sourceSnapshotId !== descriptor.sourceSnapshotId) ||
        parsed.events.some(
          (event) =>
            event.repositoryId !== this.repositoryId ||
            event.worktreeId !== this.worktreeId ||
            event.taskId !== descriptor.taskId,
        )
      ) {
        throw new ArtifactStoreError(
          "manifest_inconsistent",
          "Task event-log dependency bytes do not match their descriptor.",
          { artifactId: descriptor.artifactId },
        );
      }
      if (!this.#isContextlessColdRecovery(manifest, descriptor)) {
        await this.#requireReadableSourceSnapshot(
          manifest,
          descriptor.sourceSnapshotId,
          `Task Event log ${descriptor.artifactId}`,
        );
      }
      return;
    }
    const bytes = await readManagedFile(
      this.layout.worktreeRoot,
      absolutePath,
    );
    if (
      descriptor.contentDigest !== undefined &&
      sha256Bytes(bytes) !== descriptor.contentDigest
    ) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        "Legacy Artifact dependency digest does not match its descriptor.",
        { artifactId: descriptor.artifactId },
      );
    }
  }

  async #verifyDescriptorGraph(
    manifest: ArtifactManifestV1,
    roots: readonly ReturnType<typeof ArtifactDescriptorV1Schema.parse>[],
  ): Promise<void> {
    const verified = new Set<string>();
    const verify = async (
      descriptor: ReturnType<typeof ArtifactDescriptorV1Schema.parse>,
    ): Promise<void> => {
      if (verified.has(descriptor.artifactId)) return;
      verified.add(descriptor.artifactId);
      await this.#verifyDescriptorBytes(manifest, descriptor);
      for (const dependency of descriptor.dependencies) {
        const target = manifest.artifacts.find(
          (candidate) =>
            candidate.artifactId === dependency.artifactId,
        );
        if (
          target === undefined ||
          (dependency.requiredDigest !== undefined &&
            target.contentDigest !== dependency.requiredDigest) ||
          (dependency.requiredSnapshotId !== undefined &&
            target.sourceSnapshotId !== dependency.requiredSnapshotId)
        ) {
          throw new ArtifactStoreError(
            "reference_integrity_failed",
            "Artifact dependency does not resolve to its digest- and Snapshot-pinned descriptor.",
            {
              artifactId: descriptor.artifactId,
              dependencyArtifactId: dependency.artifactId,
            },
          );
        }
        await verify(target);
      }
    };
    try {
      for (const root of roots) await verify(root);
    } catch (error) {
      if (
        error instanceof ArtifactStoreError &&
        error.code === "reference_integrity_failed"
      ) {
        throw error;
      }
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "Artifact dependency bytes are unavailable, corrupt, or inconsistent.",
        { rootArtifactIds: roots.map((root) => root.artifactId) },
        { cause: error },
      );
    }
  }

  async #verifyTaskDescriptorSet(
    manifest: ArtifactManifestV1,
    taskId: string,
  ): Promise<void> {
    const descriptors = manifest.artifacts.filter(
      (descriptor) => descriptor.taskId === taskId,
    );
    const taskManifest = descriptors.find(
      (descriptor) => descriptor.artifactType === "task_manifest",
    );
    const eventLog = descriptors.find(
      (descriptor) => descriptor.artifactType === "task_event_log",
    );
    if (
      taskManifest === undefined ||
      eventLog === undefined ||
      taskManifest.revision === undefined ||
      taskManifest.sourceSnapshotId === undefined ||
      descriptors.some(
        (descriptor) =>
          descriptor.revision !== taskManifest.revision ||
          descriptor.sourceSnapshotId !==
            taskManifest.sourceSnapshotId,
      )
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "A trusted Task read requires one complete, single-revision Artifact and Event descriptor set.",
        { taskId },
      );
    }
    await this.#verifyDescriptorGraph(manifest, descriptors);
  }

  async #requireStableManifest(
    expected: ArtifactManifestV1,
  ): Promise<void> {
    const observed = await this.#readManifestRaw();
    if (canonicalizeJson(observed) !== canonicalizeJson(expected)) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "Artifact Manifest changed during a trusted read.",
      );
    }
  }

  #isContextlessColdRecovery(
    manifest: ArtifactManifestV1,
    descriptor: ReturnType<typeof ArtifactDescriptorV1Schema.parse>,
  ): boolean {
    if (
      manifest.status !== "cold" ||
      manifest.latestSnapshotId !== undefined ||
      descriptor.taskId === undefined ||
      descriptor.freshness !== "partial" ||
      (descriptor.artifactType !== "task_manifest" &&
        descriptor.artifactType !== "task_event_log")
    ) {
      return false;
    }
    const taskDescriptors = manifest.artifacts.filter(
      (candidate) => candidate.taskId === descriptor.taskId,
    );
    return (
      taskDescriptors.some(
        (candidate) => candidate.artifactType === "task_manifest",
      ) &&
      taskDescriptors.every(
        (candidate) =>
          candidate.artifactType === "task_manifest" ||
          candidate.artifactType === "task_event_log",
      )
    );
  }

  #requiredDependency(
    descriptor: ReturnType<typeof ArtifactDescriptorV1Schema.parse>,
  ): ArtifactDependencyV1 {
    if (descriptor.contentDigest === undefined) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        "A canonical V1 dependency target requires a content digest.",
        { artifactId: descriptor.artifactId },
      );
    }
    return ArtifactDependencyV1Schema.parse({
      artifactId: descriptor.artifactId,
      relation: "requires",
      requiredDigest: descriptor.contentDigest,
      requiredSnapshotId: descriptor.sourceSnapshotId,
    });
  }

  #requiredArtifactDependency(
    artifact: PersistedArtifactV1,
  ): ArtifactDependencyV1 {
    return ArtifactDependencyV1Schema.parse({
      artifactId: artifact.artifactId,
      relation: "requires",
      requiredDigest: artifact.contentDigest,
      requiredSnapshotId: artifact.sourceSnapshotId,
    });
  }

  #mergeRequiredDependencies(
    required: readonly ArtifactDependencyV1[],
    supplied: readonly ArtifactDependencyV1[] = [],
  ): ArtifactDependencyV1[] {
    const merged = new Map<string, ArtifactDependencyV1>();
    for (const dependency of required) {
      merged.set(dependency.artifactId, dependency);
    }
    for (const input of supplied) {
      const dependency = ArtifactDependencyV1Schema.parse(input);
      const canonical = merged.get(dependency.artifactId);
      if (
        canonical !== undefined &&
        canonicalizeJson(canonical) !== canonicalizeJson(dependency)
      ) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "A caller cannot weaken or replace a canonical dependency pin.",
          { artifactId: dependency.artifactId },
        );
      }
      merged.set(dependency.artifactId, dependency);
    }
    return [...merged.values()].sort((left, right) =>
      left.artifactId.localeCompare(right.artifactId),
    );
  }

  async #requireCurrentRepoPulse(
    manifest: ArtifactManifestV1,
    snapshotId: string,
  ): Promise<ReturnType<typeof ArtifactDescriptorV1Schema.parse>> {
    const descriptor = manifest.artifacts.find(
      (candidate) =>
        candidate.artifactType === "repo_pulse" &&
        candidate.storageFormat === "enveloped_v1" &&
        candidate.state === "current" &&
        (candidate.freshness === "fresh" ||
          candidate.freshness === "partial") &&
        candidate.sourceSnapshotId === snapshotId,
    );
    if (descriptor === undefined) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "A contextual Task transaction requires the current Repo Pulse.",
        { snapshotId },
      );
    }
    const targetPath = this.layout.artifact("repo_pulse");
    if (
      descriptor.path !==
      repositoryRelativePathFromAbsolute(
        this.layout.worktreeRoot,
        targetPath,
      )
    ) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        "The current Repo Pulse descriptor path is not canonical.",
        { artifactId: descriptor.artifactId },
      );
    }
    const pulse = await this.#readArtifactPath(targetPath);
    if (
      pulse.artifactType !== "repo_pulse" ||
      pulse.artifactId !== descriptor.artifactId ||
      pulse.sourceSnapshotId !== snapshotId ||
      pulse.revision !== descriptor.revision ||
      pulse.contentDigest !== descriptor.contentDigest
    ) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        "The current Repo Pulse bytes do not match their descriptor.",
        { artifactId: descriptor.artifactId },
      );
    }
    return descriptor;
  }

  async #taskBundleFreshness(
    manifest: ArtifactManifestV1,
    prepared: PreparedTaskBundle,
  ): Promise<"fresh" | "partial"> {
    const contextless = prepared.artifacts.length === 1;
    const snapshotDescriptor = await this.#usableSnapshotDescriptor(
      manifest,
      prepared.bundle.manifest.latestSnapshotId,
    );
    if (snapshotDescriptor !== undefined) {
      const pulseDescriptor = await this.#requireCurrentRepoPulse(
        manifest,
        prepared.bundle.manifest.latestSnapshotId,
      );
      return !contextless &&
        snapshotDescriptor.state === "current" &&
        snapshotDescriptor.freshness === "fresh" &&
        pulseDescriptor.freshness === "fresh"
        ? "fresh"
        : "partial";
    }
    if (
      contextless &&
      prepared.artifacts[0]?.artifactType === "task_manifest" &&
      manifest.status === "cold" &&
      manifest.latestSnapshotId === undefined
    ) {
      return "partial";
    }
    throw new ArtifactStoreError(
      "reference_integrity_failed",
      "A contextual Task bundle requires the current published Repository Snapshot.",
      {
        taskId: prepared.taskId,
        sourceSnapshotId: prepared.bundle.manifest.latestSnapshotId,
        latestSnapshotId: manifest.latestSnapshotId,
      },
    );
  }

  async initialize(): Promise<ArtifactManifestV1> {
    const directories = [
      ".understand-code",
      ".understand-code/snapshots",
      ".understand-code/knowledge-base",
      ".understand-code/tasks",
      ".understand-code/.locks",
      ".understand-code/.locks/tasks",
      ".understand-code/.recovery",
      ".understand-code/.recovery/backups",
      ".understand-code/.recovery/quarantine",
      ".understand-code/.recovery/migrations",
    ];
    for (const directory of directories) {
      await ensureManagedDirectory(this.layout.worktreeRoot, directory);
    }

    return withStoreLock(
      this.layout.worktreeRoot,
      this.layout.repositoryLock,
      async () => {
        let manifest: ArtifactManifestV1;
        try {
          manifest = await this.#readManifestRaw();
        } catch (error) {
          if (
            error instanceof ArtifactStoreError &&
            error.code === "artifact_not_found"
          ) {
            const manifestBackups = await this.#backupCandidates(
              this.layout.manifest,
            );
            if (manifestBackups.length > 0) {
              manifest = await this.#recoverManifestFromBackup();
              await this.#verifyManifestArtifacts(manifest);
              return manifest;
            }
            const coldManifest = ArtifactManifestV1Schema.parse({
              schemaVersion: 1,
              repositoryId: this.repositoryId,
              worktreeId: this.worktreeId,
              status: "cold",
              producerVersion: this.producerVersion,
              updatedAt: this.#now(),
              reasons: ["No Repository Snapshot has been persisted yet."],
              artifacts: [],
            });
            await atomicWriteJson(
              this.layout.worktreeRoot,
              this.layout.manifest,
              coldManifest,
            );
            return coldManifest;
          }
          if (
            error instanceof ArtifactStoreError &&
            error.code === "artifact_corrupt"
          ) {
            manifest = await this.#recoverManifestFromBackup();
          } else {
            throw error;
          }
        }
        await this.#verifyManifestArtifacts(manifest);
        return manifest;
      },
      this.#lockOptions,
    );
  }

  async #readManifestRaw(): Promise<ArtifactManifestV1> {
    const input = await readManagedJson(
      this.layout.worktreeRoot,
      this.layout.manifest,
    );
    let manifest: ArtifactManifestV1;
    try {
      manifest = ArtifactManifestV1Schema.parse(input);
    } catch (error) {
      throw new ArtifactStoreError(
        "artifact_corrupt",
        "Artifact Manifest failed its V1 contract.",
        undefined,
        { cause: error },
      );
    }
    if (
      manifest.repositoryId !== this.repositoryId ||
      manifest.worktreeId !== this.worktreeId
    ) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        "Artifact Manifest belongs to a different repository or worktree.",
        {
          expectedRepositoryId: this.repositoryId,
          actualRepositoryId: manifest.repositoryId,
          expectedWorktreeId: this.worktreeId,
          actualWorktreeId: manifest.worktreeId,
        },
      );
    }
    return manifest;
  }

  async readManifest(
    options: ReadManifestOptions = {},
  ): Promise<ArtifactManifestV1> {
    const manifest = await this.#readManifestRaw();
    if (options.verifyArtifacts !== false) {
      await this.#verifyManifestArtifacts(manifest);
    }
    return manifest;
  }

  #artifactPath(artifact: PersistedArtifactV1): string {
    return this.layout.artifact(artifact.artifactType, {
      ...(artifact.taskId === undefined ? {} : { taskId: artifact.taskId }),
      ...(artifact.artifactType === "repository_snapshot"
        ? { snapshotId: artifact.sourceSnapshotId }
        : {}),
    });
  }

  #assertArtifactIdentity(artifact: PersistedArtifactV1): void {
    if (
      artifact.repositoryId !== this.repositoryId ||
      artifact.worktreeId !== this.worktreeId
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "Persisted Artifact belongs to a different repository or worktree.",
        {
          artifactId: artifact.artifactId,
          repositoryId: artifact.repositoryId,
          worktreeId: artifact.worktreeId,
        },
      );
    }
    const integrity = verifyArtifactContentDigestV1(
      artifact,
      digestCanonicalJson,
    );
    if (!integrity.valid) {
      throw new ArtifactStoreError(
        "artifact_corrupt",
        "Persisted Artifact payload digest does not match its envelope.",
        {
          artifactId: artifact.artifactId,
          expectedDigest: integrity.expectedDigest,
          actualDigest: integrity.actualDigest,
        },
      );
    }
  }

  #parseTrustedArtifact(input: unknown): PersistedArtifactV1 {
    let artifact: PersistedArtifactV1;
    try {
      artifact = parsePersistedArtifactV1(input);
    } catch (error) {
      throw new ArtifactStoreError(
        "artifact_corrupt",
        "Persisted Artifact failed its typed V1 parser.",
        undefined,
        { cause: error },
      );
    }
    this.#assertArtifactIdentity(artifact);
    return artifact;
  }

  async #readArtifactPath(targetPath: string): Promise<PersistedArtifactV1> {
    return this.#parseTrustedArtifact(
      await readManagedJson(this.layout.worktreeRoot, targetPath),
    );
  }

  async readArtifact(
    artifactType: ArtifactTypeV1,
    identifiers: { taskId?: string; snapshotId?: string } = {},
    options: { recover?: boolean } = {},
  ): Promise<ReadArtifactResult<PersistedArtifactV1>> {
    const targetPath = this.layout.artifact(artifactType, identifiers);
    try {
      const artifact = await this.#readArtifactPath(targetPath);
      if (artifact.artifactType !== artifactType) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Artifact type does not match its canonical path.",
          { expected: artifactType, actual: artifact.artifactType },
        );
      }
      if (
        (identifiers.taskId !== undefined &&
          artifact.taskId !== identifiers.taskId) ||
        (identifiers.snapshotId !== undefined &&
          artifact.sourceSnapshotId !== identifiers.snapshotId)
      ) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "Artifact identity does not match the requested Task or Snapshot.",
          {
            requestedTaskId: identifiers.taskId,
            actualTaskId: artifact.taskId,
            requestedSnapshotId: identifiers.snapshotId,
            actualSnapshotId: artifact.sourceSnapshotId,
          },
        );
      }
      const manifest = await this.#readManifestRaw();
      const descriptor = await this.#requirePublishedDescriptor(
        artifact,
        targetPath,
        manifest,
      );
      await this.#requireArtifactSourceSnapshot(
        manifest,
        descriptor,
        artifact,
        `Artifact ${artifact.artifactId}`,
      );
      if (artifact.taskId === undefined) {
        await this.#verifyDescriptorGraph(manifest, [descriptor]);
      } else {
        await this.#verifyTaskDescriptorSet(
          manifest,
          artifact.taskId,
        );
      }
      await this.#requireStableManifest(manifest);
      return this.#readArtifactResult(artifact, descriptor, manifest);
    } catch (error) {
      if (
        options.recover === true &&
        error instanceof ArtifactStoreError &&
        (error.code === "artifact_corrupt" ||
          error.code === "artifact_not_found" ||
          error.code === "manifest_inconsistent")
      ) {
        if (identifiers.taskId !== undefined) {
          throw new ArtifactStoreError(
            "reference_integrity_failed",
            "Task-scoped Artifacts cannot be recovered one file at a time because every Task revision must remain an atomic descriptor set.",
            {
              artifactType,
              taskId: identifiers.taskId,
              recoveryPolicy: "whole_task_required",
            },
            { cause: error },
          );
        }
        return this.#recoverArtifact(
          artifactType,
          identifiers,
          targetPath,
          error,
        );
      }
      throw error;
    }
  }

  async persistArtifact<TArtifact extends PersistedArtifactV1>(
    artifactInput: TArtifact,
    options: PersistArtifactOptions = {},
  ): Promise<PersistArtifactResult<TArtifact>> {
    const artifact = this.#parseTrustedArtifact(artifactInput) as TArtifact;
    if (
      artifact.artifactType === "repository_snapshot" &&
      artifact.revision !== 0
    ) {
      throw new ArtifactStoreError(
        "revision_conflict",
        "Repository Snapshots are immutable facts and must use revision 0.",
        {
          artifactId: artifact.artifactId,
          sourceSnapshotId: artifact.sourceSnapshotId,
          actualRevision: artifact.revision,
          requiredRevision: 0,
        },
      );
    }
    if (artifact.taskId !== undefined) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "Task-scoped Artifacts must be committed through persistTaskBundle so Artifact, Event, CAS, and idempotency state advance together.",
        {
          artifactId: artifact.artifactId,
          artifactType: artifact.artifactType,
          taskId: artifact.taskId,
        },
      );
    }
    const targetPath = this.#artifactPath(artifact);
    const taskId = artifact.taskId;
    const lockPath =
      taskId === undefined
        ? this.layout.repositoryLock
        : this.layout.taskLock(taskId);
    await this.#ensureArtifactParent(artifact);

    return withStoreLock(
      this.layout.worktreeRoot,
      lockPath,
      async () =>
        this.#persistArtifactLocked(artifact, targetPath, options),
      this.#lockOptions,
    );
  }

  async #ensureArtifactParent(artifact: PersistedArtifactV1): Promise<void> {
    if (artifact.taskId !== undefined) {
      TaskIdSchema.parse(artifact.taskId);
      await ensureManagedDirectory(
        this.layout.worktreeRoot,
        `.understand-code/tasks/${artifact.taskId}`,
      );
      return;
    }
    if (artifact.artifactType === "repository_snapshot") {
      await ensureManagedDirectory(
        this.layout.worktreeRoot,
        ".understand-code/snapshots",
      );
    }
  }

  async #persistArtifactLocked<TArtifact extends PersistedArtifactV1>(
    artifact: TArtifact,
    targetPath: string,
    options: PersistArtifactOptions,
  ): Promise<PersistArtifactResult<TArtifact>> {
    const current = await this.#tryReadArtifactPath(targetPath);
    if (
      artifact.artifactType === "repository_snapshot" &&
      current !== undefined &&
      !compareArtifacts(current, artifact)
    ) {
      throw new ArtifactStoreError(
        "revision_conflict",
        "A published Repository Snapshot identity cannot be revised or replaced in place.",
        {
          artifactId: artifact.artifactId,
          sourceSnapshotId: artifact.sourceSnapshotId,
          currentArtifactId: current.artifactId,
          currentSnapshotId: current.sourceSnapshotId,
          currentRevision: current.revision,
          attemptedRevision: artifact.revision,
        },
      );
    }
    if (
      artifact.artifactType === "repository_snapshot" &&
      current === undefined
    ) {
      const targetRelative = repositoryRelativePathFromAbsolute(
        this.layout.worktreeRoot,
        targetPath,
      );
      const manifest = await this.#readManifestRaw();
      const publishedIdentity = manifest.artifacts.find(
        (descriptor) =>
          descriptor.artifactType === "repository_snapshot" &&
          (descriptor.artifactId === artifact.artifactId ||
            descriptor.path === targetRelative ||
            descriptor.sourceSnapshotId === artifact.sourceSnapshotId),
      );
      if (publishedIdentity !== undefined) {
        throw new ArtifactStoreError(
          "revision_conflict",
          publishedIdentity.path === targetRelative ||
            publishedIdentity.sourceSnapshotId ===
              artifact.sourceSnapshotId
            ? "A missing published Repository Snapshot must be restored through recovery, never replaced by caller-supplied bytes."
            : "A Repository Snapshot artifactId cannot be reused for a different immutable Snapshot.",
          {
            artifactId: artifact.artifactId,
            sourceSnapshotId: artifact.sourceSnapshotId,
            existingArtifactId: publishedIdentity.artifactId,
            existingSnapshotId: publishedIdentity.sourceSnapshotId,
            recoveryRequired:
              publishedIdentity.path === targetRelative ||
              publishedIdentity.sourceSnapshotId ===
                artifact.sourceSnapshotId,
          },
        );
      }
    }
    const idempotency = this.#validateIdempotencyOptions(options);
    const idempotencyPath = this.#idempotencyPath(artifact.taskId);
    const idempotencyIndex =
      idempotency === undefined
        ? undefined
        : await this.#readIdempotencyIndex(idempotencyPath);
    const existingRecord =
      idempotency === undefined
        ? undefined
        : idempotencyIndex?.records.find(
            (record) => record.key === idempotency.key,
          );
    let currentDescriptor:
      | ReturnType<typeof ArtifactDescriptorV1Schema.parse>
      | undefined;
    if (current !== undefined) {
      try {
        currentDescriptor = await this.#requirePublishedDescriptor(
          current,
          targetPath,
        );
      } catch (error) {
        if (
          error instanceof ArtifactStoreError &&
          error.code === "manifest_inconsistent" &&
          idempotency !== undefined &&
          compareArtifacts(current, artifact)
        ) {
          if (
            existingRecord !== undefined &&
            (existingRecord.requestDigest !== idempotency.requestDigest ||
              existingRecord.artifactType !== artifact.artifactType ||
              existingRecord.artifactId !== artifact.artifactId ||
              existingRecord.resultRevision !== artifact.revision ||
              existingRecord.resultDigest !== artifact.contentDigest)
          ) {
            throw new ArtifactStoreError(
              "idempotency_conflict",
              "Idempotency key was already used for a different mutation.",
              { key: idempotency.key },
            );
          }
          const relativePath = repositoryRelativePathFromAbsolute(
            this.layout.worktreeRoot,
            targetPath,
          );
          const manifest = await this.#readManifestRaw();
          const descriptorAtPath = manifest.artifacts.find(
            (candidate) => candidate.path === relativePath,
          );
          if (
            descriptorAtPath !== undefined &&
            (descriptorAtPath.artifactType !== artifact.artifactType ||
              descriptorAtPath.artifactId !== artifact.artifactId)
          ) {
            throw error;
          }
          const publishedRevision = descriptorAtPath?.revision ?? 0;
          if (
            options.expectedRevision === undefined ||
            options.expectedRevision !== publishedRevision ||
            artifact.revision !== publishedRevision + 1
          ) {
            throw new ArtifactStoreError(
              "revision_conflict",
              "Orphan reconciliation must advance the published revision exactly once.",
              {
                artifactId: artifact.artifactId,
                expectedRevision: options.expectedRevision,
                publishedRevision,
                actualRevision: artifact.revision,
              },
            );
          }
          const descriptor = await this.#updateManifestForArtifact(
            artifact,
            options,
          );
          await this.#recordIdempotency(
            idempotencyPath,
            idempotencyIndex ?? { version: 1, records: [] },
            artifact,
            idempotency,
          );
          return { artifact, descriptor, replayed: true };
        }
        throw error;
      }
      if (
        currentDescriptor.state === "read_only_recovery" &&
        options.promoteRecovery !== true
      ) {
        throw new ArtifactStoreError(
          "revision_conflict",
          "Recovered Artifacts are read-only until explicitly promoted.",
          { artifactId: current.artifactId },
        );
      }
    }
    if (existingRecord !== undefined && idempotency !== undefined) {
      if (
        existingRecord.requestDigest !== idempotency.requestDigest ||
        existingRecord.artifactType !== artifact.artifactType ||
        existingRecord.artifactId !== artifact.artifactId
      ) {
        throw new ArtifactStoreError(
          "idempotency_conflict",
          "Idempotency key was already used for a different mutation.",
          { key: idempotency.key },
        );
      }
      if (
        current === undefined ||
        current.revision !== existingRecord.resultRevision ||
        current.contentDigest !== existingRecord.resultDigest
      ) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Idempotency record does not match the current persisted Artifact.",
          { key: idempotency.key },
        );
      }
      const replayDescriptor = await this.#requireReplayableArtifact(
        current,
        targetPath,
        `Idempotent replay of Artifact ${current.artifactId}`,
      );
      return {
        artifact: current as TArtifact,
        descriptor: replayDescriptor,
        replayed: true,
      };
    }

    if (
      idempotency !== undefined &&
      current !== undefined &&
      compareArtifacts(current, artifact)
    ) {
      const replayDescriptor = await this.#requireReplayableArtifact(
        current,
        targetPath,
        `Idempotent replay of Artifact ${current.artifactId}`,
      );
      await this.#recordIdempotency(
        idempotencyPath,
        idempotencyIndex ?? { version: 1, records: [] },
        artifact,
        idempotency,
      );
      return {
        artifact,
        descriptor: replayDescriptor,
        replayed: true,
      };
    }

    if (current !== undefined && options.expectedRevision === undefined) {
      if (compareArtifacts(current, artifact)) {
        const replayDescriptor = await this.#requireReplayableArtifact(
          current,
          targetPath,
          `Replay of Artifact ${current.artifactId}`,
        );
        return {
          artifact: current as TArtifact,
          descriptor: replayDescriptor,
          replayed: true,
        };
      }
      throw new ArtifactStoreError(
        "revision_conflict",
        "Replacing an existing canonical Artifact requires expectedRevision.",
        {
          artifactId: artifact.artifactId,
          currentRevision: current.revision,
        },
      );
    }

    if (options.expectedRevision !== undefined) {
      const currentRevision = current?.revision ?? 0;
      if (options.expectedRevision !== currentRevision) {
        throw new ArtifactStoreError(
          "revision_conflict",
          "Artifact compare-and-swap revision does not match current state.",
          {
            artifactId: artifact.artifactId,
            expectedRevision: options.expectedRevision,
            currentRevision,
          },
        );
      }
      const requiredRevision =
        current === undefined && options.expectedRevision === 0
          ? 1
          : currentRevision + 1;
      if (artifact.revision !== requiredRevision) {
        throw new ArtifactStoreError(
          "revision_conflict",
          "Replacement Artifact does not advance revision exactly once.",
          {
            artifactId: artifact.artifactId,
            requiredRevision,
            actualRevision: artifact.revision,
          },
        );
      }
    }

    const previousBytes =
      current === undefined
        ? undefined
        : await readManagedFile(this.layout.worktreeRoot, targetPath);
    let backupPath =
      previousBytes === undefined
        ? undefined
        : await this.#writeBackup(targetPath, previousBytes);
    let artifactWritten = false;
    let manifestCommitted = false;
    try {
      await atomicWriteJson(
        this.layout.worktreeRoot,
        targetPath,
        artifact,
        options.artifactWrite,
      );
      artifactWritten = true;
      if (
        backupPath === undefined &&
        artifact.artifactType === "repository_snapshot"
      ) {
        backupPath = await this.#writeBackup(
          targetPath,
          await readManagedFile(this.layout.worktreeRoot, targetPath),
        );
      }
      const descriptor = await this.#updateManifestForArtifact(
        artifact,
        options,
      );
      manifestCommitted = true;
      if (idempotency !== undefined) {
        await this.#recordIdempotency(
          idempotencyPath,
          idempotencyIndex ?? { version: 1, records: [] },
          artifact,
          idempotency,
        );
      }
      return {
        artifact,
        descriptor,
        replayed: false,
        ...(backupPath === undefined ? {} : { backupPath }),
      };
    } catch (error) {
      if (isCommittedAtomicWriteError(error, this.layout.manifest)) {
        manifestCommitted = true;
      } else if (
        error instanceof ArtifactStoreError &&
        error.details?.committed === true
      ) {
        artifactWritten = true;
      }
      if (artifactWritten && !manifestCommitted) {
        if (previousBytes !== undefined) {
          await atomicWriteFile(
            this.layout.worktreeRoot,
            targetPath,
            previousBytes,
          );
        } else {
          await this.#quarantinePath(targetPath, "uncommitted");
        }
      }
      throw error;
    }
  }

  #validateIdempotencyOptions(
    options: PersistArtifactOptions,
  ): { key: string; requestDigest: ContentDigest } | undefined {
    if (
      (options.idempotencyKey === undefined) !==
      (options.requestDigest === undefined)
    ) {
      throw new TypeError(
        "idempotencyKey and requestDigest must be provided together.",
      );
    }
    if (
      options.idempotencyKey === undefined ||
      options.requestDigest === undefined
    ) {
      return undefined;
    }
    return {
      key: IdempotencyKeySchema.parse(options.idempotencyKey),
      requestDigest: ContentDigestSchema.parse(options.requestDigest),
    };
  }

  #idempotencyPath(taskId: string | undefined): string {
    return taskId === undefined
      ? path.join(this.layout.storeRoot, ".repository-idempotency.json")
      : this.layout.task(taskId).idempotency;
  }

  async #readIdempotencyIndex(
    idempotencyPath: string,
  ): Promise<StoreIdempotencyIndex> {
    try {
      return parseIdempotencyIndex(
        await readManagedJson(this.layout.worktreeRoot, idempotencyPath),
      );
    } catch (error) {
      if (
        error instanceof ArtifactStoreError &&
        error.code === "artifact_not_found"
      ) {
        return { version: 1, records: [] };
      }
      throw error;
    }
  }

  async #recordIdempotency(
    idempotencyPath: string,
    index: StoreIdempotencyIndex,
    artifact: PersistedArtifactV1,
    idempotency: { key: string; requestDigest: ContentDigest },
  ): Promise<void> {
    const records = [
      ...index.records.filter((record) => record.key !== idempotency.key),
      {
        key: idempotency.key,
        requestDigest: idempotency.requestDigest,
        artifactType: artifact.artifactType,
        artifactId: artifact.artifactId,
        resultRevision: artifact.revision,
        resultDigest: artifact.contentDigest,
        recordedAt: this.#now(),
      },
    ].slice(-2_000);
    await atomicWriteJson(
      this.layout.worktreeRoot,
      idempotencyPath,
      { version: 1, records } satisfies StoreIdempotencyIndex,
    );
  }

  async #tryReadArtifactPath(
    targetPath: string,
  ): Promise<PersistedArtifactV1 | undefined> {
    try {
      return await this.#readArtifactPath(targetPath);
    } catch (error) {
      if (
        error instanceof ArtifactStoreError &&
        error.code === "artifact_not_found"
      ) {
        return undefined;
      }
      throw error;
    }
  }

  async #requirePublishedDescriptor(
    artifact: PersistedArtifactV1,
    targetPath: string,
    manifestInput?: ArtifactManifestV1,
  ) {
    const manifest = manifestInput ?? (await this.#readManifestRaw());
    const relativePath = repositoryRelativePathFromAbsolute(
      this.layout.worktreeRoot,
      targetPath,
    );
    const descriptor = manifest.artifacts.find(
      (candidate) =>
        candidate.artifactId === artifact.artifactId &&
        candidate.path === relativePath,
    );
    if (
      descriptor === undefined ||
      descriptor.storageFormat !== "enveloped_v1" ||
      descriptor.artifactType !== artifact.artifactType ||
      descriptor.sourceSnapshotId !== artifact.sourceSnapshotId ||
      descriptor.taskId !== artifact.taskId ||
      descriptor.revision !== artifact.revision ||
      descriptor.contentDigest !== artifact.contentDigest ||
      descriptor.state === "corrupt" ||
      descriptor.freshness === "invalid"
    ) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        "Artifact bytes are not committed by a matching Manifest descriptor.",
        {
          artifactId: artifact.artifactId,
          path: relativePath,
          descriptor,
        },
      );
    }
    return descriptor;
  }

  async #descriptorForArtifact(
    artifact: PersistedArtifactV1,
    options: PersistArtifactOptions,
  ) {
    const relativePath = repositoryRelativePathFromAbsolute(
      this.layout.worktreeRoot,
      this.#artifactPath(artifact),
    );
    return ArtifactDescriptorV1Schema.parse({
      descriptorVersion: 1,
      artifactId: artifact.artifactId,
      artifactType: artifact.artifactType,
      storageFormat: "enveloped_v1",
      path: relativePath,
      schemaVersion: 1,
      producerVersion: artifact.producerVersion,
      sourceSnapshotId: artifact.sourceSnapshotId,
      ...(artifact.taskId === undefined ? {} : { taskId: artifact.taskId }),
      revision: artifact.revision,
      contentDigest: artifact.contentDigest,
      state: options.state ?? "current",
      freshness: options.freshness ?? "fresh",
      generatedAt: artifact.createdAt,
      dependencies: (options.dependencies ?? []).map((dependency) =>
        ArtifactDependencyV1Schema.parse(dependency),
      ),
    });
  }

  async #updateManifestForArtifact(
    artifact: PersistedArtifactV1,
    options: PersistArtifactOptions,
  ) {
    let descriptor:
      | ReturnType<typeof ArtifactDescriptorV1Schema.parse>
      | undefined;
    const update = async (): Promise<void> => {
      const currentManifest = await this.#readManifestRaw();
      const snapshotDescriptor =
        artifact.artifactType === "repository_snapshot"
          ? undefined
          : await this.#requireUsableSnapshot(
              currentManifest,
              artifact.sourceSnapshotId,
              `Artifact ${artifact.artifactId}`,
            );
      const requestedFreshness = options.freshness ?? "fresh";
      const effectiveFreshness =
        snapshotDescriptor !== undefined &&
        requestedFreshness === "fresh" &&
        !(
          snapshotDescriptor.state === "current" &&
          snapshotDescriptor.freshness === "fresh"
        )
          ? ("partial" as const)
          : requestedFreshness;
      const nextDescriptor = await this.#descriptorForArtifact(
        artifact,
        snapshotDescriptor !== undefined
          ? {
              ...options,
              freshness: effectiveFreshness,
              dependencies: this.#mergeRequiredDependencies(
                [this.#requiredDependency(snapshotDescriptor)],
                options.dependencies,
              ),
            }
          : options,
      );
      descriptor = nextDescriptor;
      const previousManifestBytes = await readManagedFile(
        this.layout.worktreeRoot,
        this.layout.manifest,
      );
      await this.#writeBackup(this.layout.manifest, previousManifestBytes);

      const latestSnapshotChanged =
        artifact.artifactType === "repository_snapshot" &&
        currentManifest.latestSnapshotId !== artifact.sourceSnapshotId;
      const normalizedExisting = currentManifest.artifacts
        .filter(
          (candidate) =>
            candidate.artifactId !== nextDescriptor.artifactId &&
            candidate.path !== nextDescriptor.path,
        )
        .map((candidate) => {
          if (
            latestSnapshotChanged &&
            candidate.sourceSnapshotId !== artifact.sourceSnapshotId &&
            candidate.state === "current"
          ) {
            return {
              ...candidate,
              state:
                candidate.artifactType === "repository_snapshot"
                  ? ("historical" as const)
                  : candidate.state,
              freshness:
                candidate.freshness === "fresh"
                  ? ("stale" as const)
                  : candidate.freshness,
            };
          }
          return candidate;
        });
      const nextManifest = ArtifactManifestV1Schema.parse({
        ...currentManifest,
        status:
          artifact.artifactType === "repository_snapshot"
            ? "ready"
            : currentManifest.status,
        ...(artifact.artifactType === "repository_snapshot"
          ? { latestSnapshotId: artifact.sourceSnapshotId }
          : {}),
        producerVersion: this.producerVersion,
        updatedAt: this.#now(),
        reasons:
          artifact.artifactType === "repository_snapshot"
            ? []
            : currentManifest.reasons,
        artifacts: [...normalizedExisting, nextDescriptor],
      });
      try {
        await atomicWriteJson(
          this.layout.worktreeRoot,
          this.layout.manifest,
          nextManifest,
          options.manifestWrite,
        );
      } catch (error) {
        if (isCommittedAtomicWriteError(error, this.layout.manifest)) {
          throw error;
        }
        await atomicWriteFile(
          this.layout.worktreeRoot,
          this.layout.manifest,
          previousManifestBytes,
        );
        throw error;
      }
    };

    if (artifact.taskId === undefined) {
      await update();
    } else {
      await withStoreLock(
        this.layout.worktreeRoot,
        this.layout.repositoryLock,
        async () => update(),
        this.#lockOptions,
      );
    }
    if (descriptor === undefined) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        "Artifact descriptor was not produced during Manifest publication.",
        { artifactId: artifact.artifactId },
      );
    }
    return descriptor;
  }

  async #writeBackup(
    targetPath: string,
    bytes: Uint8Array,
  ): Promise<string> {
    const targetRelative = repositoryRelativePathFromAbsolute(
      this.layout.worktreeRoot,
      targetPath,
    );
    const bucket = sha256Bytes(targetRelative).slice("sha256:".length);
    const backupDirectoryRelative =
      `.understand-code/.recovery/backups/${bucket}`;
    const backupDirectory = await ensureManagedDirectory(
      this.layout.worktreeRoot,
      backupDirectoryRelative,
    );
    const sequencePath = path.join(backupDirectory, ".sequence");
    let sequence = 0n;
    try {
      const sequenceText = (
        await readManagedFile(this.layout.worktreeRoot, sequencePath)
      )
        .toString("utf8")
        .trim();
      if (!/^(?:0|[1-9][0-9]*)$/u.test(sequenceText)) {
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Backup sequence metadata is invalid.",
          { sequencePath },
        );
      }
      sequence = BigInt(sequenceText);
    } catch (error) {
      if (
        !(
          error instanceof ArtifactStoreError &&
          error.code === "artifact_not_found"
        )
      ) {
        throw error;
      }
    }
    sequence += 1n;
    await atomicWriteFile(
      this.layout.worktreeRoot,
      sequencePath,
      `${sequence}\n`,
    );
    const backupPath = path.join(
      backupDirectory,
      `seq-${sequence.toString().padStart(24, "0")}-${
        String(this.#clock().getTime()).padStart(16, "0")
      }-${randomUUID()}.bak`,
    );
    await atomicWriteFile(this.layout.worktreeRoot, backupPath, bytes);
    return backupPath;
  }

  async #backupCandidates(targetPath: string): Promise<string[]> {
    const targetRelative = repositoryRelativePathFromAbsolute(
      this.layout.worktreeRoot,
      targetPath,
    );
    const bucket = sha256Bytes(targetRelative).slice("sha256:".length);
    const backupDirectoryRelative =
      `.understand-code/.recovery/backups/${bucket}`;
    let backupDirectory: string;
    try {
      backupDirectory = await resolveManagedPath(
        this.layout.worktreeRoot,
        backupDirectoryRelative,
      );
    } catch (error) {
      if (
        error instanceof ArtifactStoreError &&
        error.code === "artifact_not_found"
      ) {
        return [];
      }
      throw error;
    }
    const sequenceOf = (entry: string): bigint | undefined => {
      const match = /^seq-([0-9]+)-/u.exec(entry);
      return match?.[1] === undefined ? undefined : BigInt(match[1]);
    };
    return (await readdir(backupDirectory))
      .filter((entry) => entry.endsWith(".bak"))
      .sort((left, right) => {
        const leftSequence = sequenceOf(left);
        const rightSequence = sequenceOf(right);
        if (leftSequence !== undefined && rightSequence !== undefined) {
          if (leftSequence === rightSequence) {
            return right.localeCompare(left);
          }
          return leftSequence > rightSequence ? -1 : 1;
        }
        if (leftSequence !== undefined) return -1;
        if (rightSequence !== undefined) return 1;
        return right.localeCompare(left);
      })
      .map((entry) => path.join(backupDirectory, entry));
  }

  async #quarantinePath(targetPath: string, reason: string): Promise<string> {
    const targetRelative = repositoryRelativePathFromAbsolute(
      this.layout.worktreeRoot,
      targetPath,
    );
    await resolveManagedPath(this.layout.worktreeRoot, targetRelative);
    const quarantineDirectory = await ensureManagedDirectory(
      this.layout.worktreeRoot,
      ".understand-code/.recovery/quarantine/artifacts",
    );
    const quarantinePath = path.join(
      quarantineDirectory,
      `${path.basename(targetPath)}-${reason}-${this.#clock().getTime()}-${randomUUID()}`,
    );
    await rename(targetPath, quarantinePath);
    return quarantinePath;
  }

  async #recoverArtifact(
    artifactType: ArtifactTypeV1,
    identifiers: { taskId?: string; snapshotId?: string },
    targetPath: string,
    originalError: ArtifactStoreError,
  ): Promise<ReadArtifactResult<PersistedArtifactV1>> {
    const taskId = identifiers.taskId;
    const lockPath =
      taskId === undefined
        ? this.layout.repositoryLock
        : this.layout.taskLock(taskId);
    return withStoreLock(
      this.layout.worktreeRoot,
      lockPath,
      async () => {
        let sourceSnapshotFailure: ArtifactStoreError | undefined;
        try {
          const nowReadable = await this.#readArtifactPath(targetPath);
          if (
            nowReadable.artifactType !== artifactType ||
            (identifiers.taskId !== undefined &&
              nowReadable.taskId !== identifiers.taskId) ||
            (identifiers.snapshotId !== undefined &&
              nowReadable.sourceSnapshotId !== identifiers.snapshotId)
          ) {
            throw new ArtifactStoreError(
              "reference_integrity_failed",
              "Artifact identity changed while entering recovery.",
              { artifactType, identifiers },
            );
          }
          const manifest = await this.#readManifestRaw();
          const descriptor = await this.#requirePublishedDescriptor(
            nowReadable,
            targetPath,
            manifest,
          );
          try {
            await this.#requireArtifactSourceSnapshot(
              manifest,
              descriptor,
              nowReadable,
              `Recovered Artifact ${nowReadable.artifactId}`,
            );
          } catch (error) {
            if (
              error instanceof ArtifactStoreError &&
              error.code === "reference_integrity_failed"
            ) {
              sourceSnapshotFailure = error;
            }
            throw error;
          }
          await this.#verifyDescriptorGraph(manifest, [descriptor]);
          await this.#requireStableManifest(manifest);
          return this.#readArtifactResult(
            nowReadable,
            descriptor,
            manifest,
          );
        } catch (error) {
          if (!isArtifactIntegrityFailure(error)) throw error;
          // Continue with bounded backup recovery under the writer lock.
        }
        const targetRelative = repositoryRelativePathFromAbsolute(
          this.layout.worktreeRoot,
          targetPath,
        );
        const recoveryManifest = await this.#readManifestRaw();
        const committedDescriptor = recoveryManifest.artifacts.find(
          (descriptor) =>
            descriptor.path === targetRelative &&
            descriptor.storageFormat === "enveloped_v1" &&
            descriptor.artifactType === artifactType &&
            (identifiers.taskId === undefined ||
              descriptor.taskId === identifiers.taskId) &&
            (identifiers.snapshotId === undefined ||
              descriptor.sourceSnapshotId === identifiers.snapshotId),
        );
        if (committedDescriptor === undefined) {
          await this.#quarantinePath(targetPath, "orphan").catch(
            () => undefined,
          );
          throw new ArtifactStoreError(
            "artifact_corrupt",
            "Artifact recovery requires an existing committed Manifest descriptor.",
            { artifactType, identifiers, path: targetRelative },
            { cause: originalError },
          );
        }
        try {
          await this.#quarantinePath(targetPath, "corrupt");
        } catch (error) {
          if (
            !(
              error instanceof ArtifactStoreError &&
              error.code === "artifact_not_found"
            )
          ) {
            throw error;
          }
        }

        for (const candidate of await this.#backupCandidates(targetPath)) {
          let bytes: Buffer;
          let parsed: PersistedArtifactV1;
          try {
            bytes = await readManagedFile(
              this.layout.worktreeRoot,
              candidate,
            );
          } catch (error) {
            if (
              error instanceof ArtifactStoreError &&
              error.code === "artifact_not_found"
            ) {
              continue;
            }
            throw error;
          }
          let candidateValue: unknown;
          try {
            candidateValue = JSON.parse(bytes.toString("utf8")) as unknown;
          } catch {
            continue;
          }
          try {
            parsed = this.#parseTrustedArtifact(candidateValue);
            if (
              parsed.artifactType !== artifactType ||
              (taskId !== undefined && parsed.taskId !== taskId) ||
              (identifiers.snapshotId !== undefined &&
                parsed.sourceSnapshotId !== identifiers.snapshotId)
            ) {
              continue;
            }
          } catch (error) {
            if (isArtifactIntegrityFailure(error)) {
              // A corrupt backup is skipped; the next older backup is attempted.
              continue;
            }
            throw error;
          }
          try {
            await this.#requireArtifactSourceSnapshot(
              recoveryManifest,
              committedDescriptor,
              parsed,
              `Recovered Artifact ${parsed.artifactId}`,
            );
          } catch (error) {
            if (
              error instanceof ArtifactStoreError &&
              error.code === "reference_integrity_failed"
            ) {
              sourceSnapshotFailure = error;
              continue;
            }
            throw error;
          }
          try {
            await atomicWriteFile(
              this.layout.worktreeRoot,
              targetPath,
              bytes,
            );
            await this.#markDescriptorRecoveryState(
              parsed,
              "read_only_recovery",
              "stale",
            );
            const recoveredManifest = await this.#readManifestRaw();
            const recoveredDescriptor =
              await this.#requirePublishedDescriptor(
                parsed,
                targetPath,
                recoveredManifest,
              );
            await this.#verifyDescriptorGraph(recoveredManifest, [
              recoveredDescriptor,
            ]);
            await this.#requireStableManifest(recoveredManifest);
            return this.#readArtifactResult(
              parsed,
              recoveredDescriptor,
              recoveredManifest,
            );
          } catch (error) {
            if (
              isCommittedAtomicWriteError(
                error,
                this.layout.manifest,
              )
            ) {
              // The Manifest is the recovery commit point. Preserve the
              // candidate bytes it now publishes, but surface the durability
              // ambiguity so the caller can retry and verify that state.
              throw error;
            }
            await this.#quarantinePath(
              targetPath,
              "recovery-rejected",
            ).catch(() => undefined);
            if (
              error instanceof ArtifactStoreError &&
              (error.code === "manifest_inconsistent" ||
                error.code === "reference_integrity_failed")
            ) {
              continue;
            }
            throw error;
          }
        }
        await this.#markDescriptorCorrupt(artifactType, identifiers);
        if (sourceSnapshotFailure !== undefined) {
          throw sourceSnapshotFailure;
        }
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "No valid Artifact backup was available for recovery.",
          { artifactType, identifiers },
          { cause: originalError },
        );
      },
      this.#lockOptions,
    );
  }

  async #markDescriptorRecoveryState(
    artifact: PersistedArtifactV1,
    state: "read_only_recovery",
    freshness: "stale",
  ): Promise<void> {
    const update = async (): Promise<void> => {
      const manifest = await this.#readManifestRaw();
      const recoveredPath = repositoryRelativePathFromAbsolute(
        this.layout.worktreeRoot,
        this.#artifactPath(artifact),
      );
      const existing = manifest.artifacts.find(
        (descriptor) =>
          descriptor.path === recoveredPath &&
          descriptor.artifactType === artifact.artifactType,
      );
      if (existing === undefined) {
        throw new ArtifactStoreError(
          "manifest_inconsistent",
          "Recovered Artifact has no committed descriptor to replace.",
          { artifactId: artifact.artifactId, path: recoveredPath },
        );
      }
      const recoveredDescriptor = await this.#descriptorForArtifact(artifact, {
        state,
        freshness,
        dependencies: existing?.dependencies ?? [],
      });
      const recoveredArtifacts = manifest.artifacts.map((descriptor) =>
        descriptor.path === recoveredPath
          ? recoveredDescriptor
          : descriptor,
      );
      let next: ArtifactManifestV1;
      try {
        next = ArtifactManifestV1Schema.parse({
          ...manifest,
          ...(artifact.artifactType === "repository_snapshot"
            ? {
                status: "error" as const,
                reasons: [
                  "The latest Repository Snapshot was restored from backup and is read-only.",
                ],
              }
            : {}),
          updatedAt: this.#now(),
          artifacts:
            artifact.artifactType === "repository_snapshot"
              ? recoveredArtifacts.map((descriptor) =>
                  descriptor.artifactId !== artifact.artifactId &&
                  descriptor.sourceSnapshotId === artifact.sourceSnapshotId &&
                  descriptor.freshness !== "invalid"
                    ? {
                        ...descriptor,
                        freshness: "stale" as const,
                      }
                    : descriptor,
                )
              : recoveredArtifacts,
        });
      } catch (error) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "Recovered Artifact conflicts with published dependency pins.",
          { artifactId: artifact.artifactId },
          { cause: error },
        );
      }
      await atomicWriteJson(
        this.layout.worktreeRoot,
        this.layout.manifest,
        next,
      );
    };
    if (artifact.taskId === undefined) {
      await update();
    } else {
      await withStoreLock(
        this.layout.worktreeRoot,
        this.layout.repositoryLock,
        async () => update(),
        this.#lockOptions,
      );
    }
  }

  async #markDescriptorCorrupt(
    artifactType: ArtifactTypeV1,
    identifiers: { taskId?: string; snapshotId?: string },
  ): Promise<void> {
    const update = async (): Promise<void> => {
      const manifest = await this.#readManifestRaw();
      let artifacts = manifest.artifacts.map((descriptor) =>
        descriptor.artifactType === artifactType &&
        (identifiers.taskId === undefined ||
          descriptor.taskId === identifiers.taskId) &&
        (identifiers.snapshotId === undefined ||
          descriptor.sourceSnapshotId === identifiers.snapshotId)
          ? {
              ...descriptor,
              state: "corrupt" as const,
              freshness: "invalid" as const,
            }
          : descriptor,
      );
      if (artifactType === "repository_snapshot") {
        const invalidSnapshotIds = new Set(
          artifacts
            .filter(
              (descriptor) =>
                descriptor.artifactType === "repository_snapshot" &&
                descriptor.state === "corrupt",
            )
            .map((descriptor) => descriptor.sourceSnapshotId),
        );
        artifacts = artifacts.map((descriptor) =>
          descriptor.artifactType !== "repository_snapshot" &&
          invalidSnapshotIds.has(descriptor.sourceSnapshotId)
            ? {
                ...descriptor,
                freshness: "invalid" as const,
              }
            : descriptor,
        );
      }
      const invalidArtifactIds = new Set(
        artifacts
          .filter((descriptor) => descriptor.state === "corrupt")
          .map((descriptor) => descriptor.artifactId),
      );
      let propagated = true;
      while (propagated) {
        propagated = false;
        artifacts = artifacts.map((descriptor) => {
          if (
            invalidArtifactIds.has(descriptor.artifactId) ||
            !descriptor.dependencies.some((dependency) =>
              invalidArtifactIds.has(dependency.artifactId),
            )
          ) {
            return descriptor;
          }
          invalidArtifactIds.add(descriptor.artifactId);
          propagated = true;
          return {
            ...descriptor,
            freshness: "invalid" as const,
          };
        });
      }
      const hasCorrupt = artifacts.some(
        (descriptor) => descriptor.state === "corrupt",
      );
      const next = ArtifactManifestV1Schema.parse({
        ...manifest,
        status: hasCorrupt ? "error" : manifest.status,
        reasons: hasCorrupt
          ? [`${artifactType} is corrupt and no valid backup was found.`]
          : manifest.reasons,
        updatedAt: this.#now(),
        artifacts,
      });
      await atomicWriteJson(
        this.layout.worktreeRoot,
        this.layout.manifest,
        next,
      );
    };
    if (identifiers.taskId === undefined) {
      await update();
    } else {
      await withStoreLock(
        this.layout.worktreeRoot,
        this.layout.repositoryLock,
        async () => update(),
        this.#lockOptions,
      );
    }
  }

  async #recoverManifestFromBackup(): Promise<ArtifactManifestV1> {
    let corruptBytes: Buffer | undefined;
    try {
      corruptBytes = await readManagedFile(
        this.layout.worktreeRoot,
        this.layout.manifest,
      );
    } catch (error) {
      if (
        !(
          error instanceof ArtifactStoreError &&
          error.code === "artifact_not_found"
        )
      ) {
        throw error;
      }
    }
    for (const candidate of await this.#backupCandidates(this.layout.manifest)) {
      let bytes: Buffer;
      try {
        bytes = await readManagedFile(
          this.layout.worktreeRoot,
          candidate,
        );
      } catch (error) {
        if (
          error instanceof ArtifactStoreError &&
          error.code === "artifact_not_found"
        ) {
          continue;
        }
        throw error;
      }
      let parsed: ArtifactManifestV1;
      try {
        parsed = ArtifactManifestV1Schema.parse(
          JSON.parse(bytes.toString("utf8")) as unknown,
        );
      } catch {
        continue;
      }
      if (
        parsed.repositoryId !== this.repositoryId ||
        parsed.worktreeId !== this.worktreeId
      ) {
        continue;
      }
      try {
        await this.#verifyManifestArtifacts(parsed);
      } catch (error) {
        if (isArtifactIntegrityFailure(error)) {
          continue;
        }
        throw error;
      }
      try {
        if (corruptBytes !== undefined) {
          await this.#quarantinePath(
            this.layout.manifest,
            "corrupt-manifest",
          );
        }
        await atomicWriteFile(
          this.layout.worktreeRoot,
          this.layout.manifest,
          bytes,
        );
      } catch (error) {
        if (
          error instanceof ArtifactStoreError &&
          error.details?.committed === true &&
          error.details?.targetPath === this.layout.manifest
        ) {
          throw error;
        }
        if (corruptBytes !== undefined) {
          try {
            await atomicWriteFile(
              this.layout.worktreeRoot,
              this.layout.manifest,
              corruptBytes,
            );
          } catch (rollbackError) {
            throw new ArtifactStoreError(
              "artifact_corrupt",
              "Manifest recovery failed and the prior corrupt bytes could not be restored.",
              { backupPath: candidate },
              { cause: rollbackError },
            );
          }
        }
        throw error;
      }
      return parsed;
    }
    throw new ArtifactStoreError(
      "artifact_corrupt",
      "Artifact Manifest is corrupt and has no valid backup.",
    );
  }

  async #verifyManifestArtifacts(
    manifest: ArtifactManifestV1,
  ): Promise<void> {
    const verifiedSourceSnapshots = new Set<string>();
    for (const descriptor of manifest.artifacts) {
      if (
        descriptor.state !== "current" &&
        descriptor.state !== "read_only_recovery"
      ) {
        continue;
      }
      if (descriptor.freshness === "invalid") {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "A current Artifact descriptor is explicitly invalid.",
          { artifactId: descriptor.artifactId },
        );
      }
      const absolutePath = await resolveManagedPath(
        this.layout.worktreeRoot,
        descriptor.path,
      );
      if (descriptor.storageFormat === "enveloped_v1") {
        const artifact = await this.#readArtifactPath(absolutePath);
        const canonicalPath = this.#artifactPath(artifact);
        if (
          canonicalPath !== absolutePath ||
          artifact.artifactId !== descriptor.artifactId ||
          artifact.artifactType !== descriptor.artifactType ||
          artifact.sourceSnapshotId !== descriptor.sourceSnapshotId ||
          artifact.revision !== descriptor.revision ||
          artifact.contentDigest !== descriptor.contentDigest ||
          artifact.taskId !== descriptor.taskId
        ) {
          throw new ArtifactStoreError(
            "manifest_inconsistent",
            "Artifact descriptor does not match the typed persisted Artifact.",
            { artifactId: descriptor.artifactId },
          );
        }
      } else if (descriptor.storageFormat === "jsonl_v1") {
        if (
          descriptor.taskId === undefined ||
          absolutePath !== this.layout.task(descriptor.taskId).events
        ) {
          throw new ArtifactStoreError(
            "manifest_inconsistent",
            "Task event-log descriptor path is not canonical.",
            { artifactId: descriptor.artifactId },
          );
        }
        const parsed = await readTaskEventLog(
          this.layout,
          descriptor.taskId,
        );
        if (
          parsed.truncatedTail !== undefined ||
          parsed.contentDigest !== descriptor.contentDigest ||
          parsed.events.at(-1)?.revision !== descriptor.revision
        ) {
          throw new ArtifactStoreError(
            "manifest_inconsistent",
            "Task event-log descriptor does not match the trusted log.",
            { artifactId: descriptor.artifactId },
          );
        }
      } else {
        const bytes = await readManagedFile(
          this.layout.worktreeRoot,
          absolutePath,
        );
        if (
          descriptor.contentDigest !== undefined &&
          sha256Bytes(bytes) !== descriptor.contentDigest
        ) {
          throw new ArtifactStoreError(
            "manifest_inconsistent",
            "Legacy Artifact digest does not match its descriptor.",
            { artifactId: descriptor.artifactId },
          );
        }
      }
      if (
        descriptor.artifactType !== "repository_snapshot" &&
        descriptor.sourceSnapshotId !== undefined &&
        !this.#isContextlessColdRecovery(manifest, descriptor) &&
        !verifiedSourceSnapshots.has(descriptor.sourceSnapshotId)
      ) {
        await this.#requireReadableSourceSnapshot(
          manifest,
          descriptor.sourceSnapshotId,
          `Artifact ${descriptor.artifactId}`,
        );
        verifiedSourceSnapshots.add(descriptor.sourceSnapshotId);
      }
    }
  }

  async appendTaskEvent(
    taskIdInput: string,
    event: TaskEventV1,
    options: AppendTaskEventOptions = {},
  ): Promise<AppendTaskEventResult> {
    const taskId = TaskIdSchema.parse(taskIdInput);
    if (
      event.repositoryId !== this.repositoryId ||
      event.worktreeId !== this.worktreeId
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "Task event belongs to a different repository or worktree.",
        {
          repositoryId: event.repositoryId,
          worktreeId: event.worktreeId,
        },
      );
    }
    const requiredSnapshotId = event.sourceSnapshotId;
    if (requiredSnapshotId === undefined) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "A standalone Task Event must reference a published repository snapshot.",
        { eventId: event.eventId, taskId },
      );
    }
    await ensureManagedDirectory(
      this.layout.worktreeRoot,
      `.understand-code/tasks/${taskId}`,
    );
    return withStoreLock(
      this.layout.worktreeRoot,
      this.layout.taskLock(taskId),
      async (taskLockLease) =>
        withStoreLock(
          this.layout.worktreeRoot,
          this.layout.repositoryLock,
          async () => {
            const manifest = await this.#readManifestRaw();
            const existing = manifest.artifacts.find(
              (descriptor) =>
                descriptor.artifactType === "task_event_log" &&
                descriptor.taskId === taskId,
            );
            const currentLog = await readTaskEventLog(this.layout, taskId);
            const eventsPath = this.layout.task(taskId).events;
            let previousEventBytes: Buffer | undefined;
            try {
              previousEventBytes = await readManagedFile(
                this.layout.worktreeRoot,
                eventsPath,
              );
            } catch (error) {
              if (
                !(
                  error instanceof ArtifactStoreError &&
                  error.code === "artifact_not_found"
                )
              ) {
                throw error;
              }
            }
            const restoreEventBytes = async (): Promise<void> => {
              let currentEventBytes: Buffer | undefined;
              try {
                currentEventBytes = await readManagedFile(
                  this.layout.worktreeRoot,
                  eventsPath,
                );
              } catch (error) {
                if (
                  !(
                    error instanceof ArtifactStoreError &&
                    error.code === "artifact_not_found"
                  )
                ) {
                  throw error;
                }
              }
              if (
                (previousEventBytes === undefined &&
                  currentEventBytes === undefined) ||
                (previousEventBytes !== undefined &&
                  currentEventBytes !== undefined &&
                  previousEventBytes.equals(currentEventBytes))
              ) {
                return;
              }
              if (previousEventBytes === undefined) {
                await this.#quarantinePath(
                  eventsPath,
                  "uncommitted-event",
                );
              } else {
                await atomicWriteFile(
                  this.layout.worktreeRoot,
                  eventsPath,
                  previousEventBytes,
                );
              }
            };
            const exactReplay = currentLog.events.find(
              (candidate) =>
                candidate.eventId === event.eventId &&
                canonicalizeJson(candidate) === canonicalizeJson(event),
            );
            if (exactReplay !== undefined) {
              const lastEvent = currentLog.events.at(-1);
              const expectedPath = repositoryRelativePathFromAbsolute(
                this.layout.worktreeRoot,
                this.layout.task(taskId).events,
              );
              if (
                existing === undefined ||
                existing.storageFormat !== "jsonl_v1" ||
                (existing.state !== "current" &&
                  existing.state !== "read_only_recovery") ||
                existing.path !== expectedPath ||
                existing.revision !== lastEvent?.revision ||
                existing.contentDigest !== currentLog.contentDigest ||
                existing.sourceSnapshotId !== lastEvent?.sourceSnapshotId
              ) {
                throw new ArtifactStoreError(
                  "manifest_inconsistent",
                  "An exact Event retry found bytes that are not fully committed by the Manifest.",
                  {
                    taskId,
                    eventId: event.eventId,
                    descriptorRevision: existing?.revision,
                    eventRevision: lastEvent?.revision,
                  },
                );
              }
              await this.#verifyTaskDescriptorSet(manifest, taskId);
              await this.#requireStableManifest(manifest);
              if (!this.#isContextlessColdRecovery(manifest, existing)) {
                await this.#requireReadableSourceSnapshot(
                  manifest,
                  existing.sourceSnapshotId!,
                  `Task Event replay ${event.eventId}`,
                );
              }
              try {
                const replay = await appendTaskEventFile(
                  this.layout,
                  taskId,
                  event,
                  {
                    ...options,
                    taskLockLease,
                  },
                );
                if (
                  replay.events.at(-1)?.revision !== existing.revision ||
                  replay.contentDigest !== existing.contentDigest
                ) {
                  throw new ArtifactStoreError(
                    "manifest_inconsistent",
                    "Event replay repair did not reproduce the published descriptor.",
                    { taskId, eventId: event.eventId },
                  );
                }
                return replay;
              } catch (error) {
                try {
                  await restoreEventBytes();
                } catch (rollbackError) {
                  throw new ArtifactStoreError(
                    "artifact_corrupt",
                    "Event replay failed and its prior bytes could not be restored.",
                    { taskId, eventId: event.eventId },
                    { cause: rollbackError },
                  );
                }
                throw error;
              }
            }
            const snapshotDescriptor = await this.#requireUsableSnapshot(
              manifest,
              requiredSnapshotId,
              `Task Event ${event.eventId}`,
            );
            const taskDescriptor = manifest.artifacts.find(
              (descriptor) =>
                descriptor.artifactType === "task_manifest" &&
                descriptor.taskId === taskId &&
                descriptor.sourceSnapshotId === requiredSnapshotId &&
                descriptor.revision === event.revision &&
                (descriptor.state === "current" ||
                  descriptor.state === "read_only_recovery"),
            );
            if (
              taskDescriptor === undefined ||
              taskDescriptor.contentDigest === undefined
            ) {
              throw new ArtifactStoreError(
                "reference_integrity_failed",
                "Standalone Event publication is recovery-only and requires the matching committed Task revision.",
                { eventId: event.eventId, taskId, revision: event.revision },
              );
            }
            const taskArtifactDescriptors = manifest.artifacts.filter(
              (descriptor) =>
                descriptor.taskId === taskId &&
                descriptor.storageFormat === "enveloped_v1",
            );
            if (
              taskArtifactDescriptors.length === 0 ||
              taskArtifactDescriptors.some(
                (descriptor) =>
                  descriptor.revision !== event.revision ||
                  descriptor.sourceSnapshotId !==
                    requiredSnapshotId,
              )
            ) {
              throw new ArtifactStoreError(
                "reference_integrity_failed",
                "Standalone Event recovery requires one complete Task Artifact descriptor revision.",
                { eventId: event.eventId, taskId },
              );
            }
            await this.#verifyDescriptorGraph(
              manifest,
              taskArtifactDescriptors,
            );
            await this.#requireStableManifest(manifest);
            const idempotency = await this.#readIdempotencyIndex(
              this.#idempotencyPath(taskId),
            );
            const control = idempotency.records.find(
              (record) =>
                record.key === event.idempotencyKey &&
                record.requestDigest === event.requestDigest &&
                record.artifactType === "task_manifest" &&
                record.artifactId === taskDescriptor.artifactId &&
                record.resultRevision === event.revision &&
                record.resultDigest === taskDescriptor.contentDigest,
            );
            if (control === undefined) {
              throw new ArtifactStoreError(
                "idempotency_conflict",
                "Standalone Event publication requires the committed Task transaction idempotency record.",
                { eventId: event.eventId, taskId },
              );
            }
            let manifestCommitted = false;
            try {
              const result = await appendTaskEventFile(
                this.layout,
                taskId,
                event,
                {
                  ...options,
                  taskLockLease,
                },
              );
              const revision = result.events.at(-1)?.revision ?? 0;
              if ((existing?.revision ?? -1) > revision) {
                throw new ArtifactStoreError(
                  "manifest_inconsistent",
                  "The published Event descriptor is ahead of the verified event-log bytes.",
                  {
                    taskId,
                    descriptorRevision: existing?.revision,
                    eventRevision: revision,
                  },
                );
              }
              const sourceSnapshotId =
                result.events.at(-1)?.sourceSnapshotId ??
                existing?.sourceSnapshotId;
              if (sourceSnapshotId === undefined) {
                throw new ArtifactStoreError(
                  "manifest_inconsistent",
                  "A non-empty Task event log requires sourceSnapshotId.",
                );
              }
              const descriptor = ArtifactDescriptorV1Schema.parse({
                descriptorVersion: 1,
                artifactId:
                  existing?.artifactId ?? `artifact:task-events:${taskId}`,
                artifactType: "task_event_log",
                storageFormat: "jsonl_v1",
                path: repositoryRelativePathFromAbsolute(
                  this.layout.worktreeRoot,
                  eventsPath,
                ),
                schemaVersion: 1,
                producerVersion: this.producerVersion,
                sourceSnapshotId,
                taskId,
                revision,
                contentDigest: result.contentDigest,
                state: "current",
                freshness:
                  snapshotDescriptor.state === "current" &&
                  snapshotDescriptor.freshness === "fresh"
                    ? "fresh"
                    : "partial",
                generatedAt: this.#now(),
                dependencies: this.#mergeRequiredDependencies(
                  [
                    this.#requiredDependency(snapshotDescriptor),
                    this.#requiredDependency(taskDescriptor),
                  ],
                  existing?.dependencies,
                ),
              });
              const next = ArtifactManifestV1Schema.parse({
                ...manifest,
                updatedAt: this.#now(),
                artifacts: [
                  ...manifest.artifacts.filter(
                    (candidate) =>
                      !(
                        candidate.artifactType === "task_event_log" &&
                        candidate.taskId === taskId
                      ),
                  ),
                  descriptor,
                ],
              });
              const previous = await readManagedFile(
                this.layout.worktreeRoot,
                this.layout.manifest,
              );
              await this.#writeBackup(this.layout.manifest, previous);
              await atomicWriteJson(
                this.layout.worktreeRoot,
                this.layout.manifest,
                next,
              );
              manifestCommitted = true;
              return result;
            } catch (error) {
              if (
                error instanceof ArtifactStoreError &&
                error.details?.committed === true &&
                error.details?.targetPath === this.layout.manifest
              ) {
                manifestCommitted = true;
              }
              if (!manifestCommitted) {
                try {
                  await restoreEventBytes();
                } catch (rollbackError) {
                  throw new ArtifactStoreError(
                    "artifact_corrupt",
                    "Event recovery failed before its Manifest commit and prior bytes could not be restored.",
                    { taskId, eventId: event.eventId },
                    { cause: rollbackError },
                  );
                }
              }
              throw error;
            }
          },
          this.#lockOptions,
        ),
      this.#lockOptions,
    );
  }

  async readTaskEvents(taskIdInput: string): Promise<ReadTaskEventsResult> {
    const taskId = TaskIdSchema.parse(taskIdInput);
    const parsed = await readTaskEventLog(this.layout, taskId);
    const manifest = await this.#readManifestRaw();
    const descriptor = manifest.artifacts.find(
      (candidate) =>
        candidate.artifactType === "task_event_log" &&
        candidate.taskId === taskId,
    );
    const expectedPath = repositoryRelativePathFromAbsolute(
      this.layout.worktreeRoot,
      this.layout.task(taskId).events,
    );
    const lastEvent = parsed.events.at(-1);
    const sourceSnapshotId = descriptor?.sourceSnapshotId;
    if (
      descriptor === undefined ||
      descriptor.storageFormat !== "jsonl_v1" ||
      (descriptor.state !== "current" &&
        descriptor.state !== "read_only_recovery") ||
      descriptor.freshness === "invalid" ||
      descriptor.path !== expectedPath ||
      sourceSnapshotId === undefined ||
      descriptor.revision !== lastEvent?.revision ||
      descriptor.contentDigest !== parsed.contentDigest ||
      parsed.truncatedTail !== undefined ||
      parsed.events.some(
        (event) =>
          event.repositoryId !== this.repositoryId ||
          event.worktreeId !== this.worktreeId ||
          event.taskId !== taskId,
      ) ||
      (lastEvent?.sourceSnapshotId !== undefined &&
        descriptor.sourceSnapshotId !== lastEvent.sourceSnapshotId)
    ) {
      throw new ArtifactStoreError(
        "manifest_inconsistent",
        "Task Event bytes are not committed by a matching Manifest descriptor.",
        {
          taskId,
          descriptor,
          eventRevision: lastEvent?.revision,
          contentDigest: parsed.contentDigest,
          truncatedTail: parsed.truncatedTail !== undefined,
        },
      );
    }
    if (!this.#isContextlessColdRecovery(manifest, descriptor)) {
      await this.#requireReadableSourceSnapshot(
        manifest,
        sourceSnapshotId,
        `Task Event log ${descriptor.artifactId}`,
      );
    }
    await this.#verifyTaskDescriptorSet(manifest, taskId);
    await this.#requireStableManifest(manifest);
    return {
      ...parsed,
      descriptor,
      state: descriptor.state,
      freshness: descriptor.freshness,
      ...(manifest.latestSnapshotId === undefined
        ? {}
        : { latestSnapshotId: manifest.latestSnapshotId }),
    };
  }

  parseTrustedTaskBundle(input: unknown): TaskArtifactBundleV1 {
    return parseTrustedTaskBundle(input);
  }

  #prepareTaskBundle(
    input: PersistTaskBundleInput,
  ): PreparedTaskBundle {
    const artifacts = input.artifacts.map((artifact) =>
      this.#parseTrustedArtifact(artifact),
    );
    const byType = new Map<ArtifactTypeV1, PersistedArtifactV1>();
    for (const artifact of artifacts) {
      if (artifact.taskId === undefined) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "A Task transaction cannot include repository-scoped Artifacts.",
          { artifactType: artifact.artifactType },
        );
      }
      if (byType.has(artifact.artifactType)) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Task transaction contains duplicate ${artifact.artifactType} Artifacts.`,
        );
      }
      byType.set(artifact.artifactType, artifact);
    }

    const taskManifestArtifact = byType.get("task_manifest");
    if (taskManifestArtifact === undefined) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "Task transaction requires one task_manifest Artifact.",
      );
    }
    if (taskManifestArtifact.artifactType !== "task_manifest") {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "Task transaction manifest lookup resolved an invalid Artifact type.",
      );
    }
    const taskId = taskManifestArtifact.taskId;
    if (taskId === undefined) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        "Task Manifest Artifact requires taskId.",
      );
    }
    const revision = taskManifestArtifact.revision;
    for (const artifact of artifacts) {
      if (
        artifact.taskId !== taskId ||
        artifact.repositoryId !== taskManifestArtifact.repositoryId ||
        artifact.worktreeId !== taskManifestArtifact.worktreeId ||
        artifact.sourceSnapshotId !==
          taskManifestArtifact.payload.latestSnapshotId ||
        artifact.revision !== revision
      ) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          "Every Artifact in a Task transaction must share Task identity, latest Snapshot, and revision.",
          { artifactId: artifact.artifactId },
        );
      }
    }

    const fullTypes = [
      "task_manifest",
      "task_brief",
      "claim_ledger",
      "evidence_ledger",
      "impact",
      "change_check",
      "verification",
    ] as const satisfies readonly ArtifactTypeV1[];
    const hasContext = byType.has("task_brief");
    if (
      (hasContext &&
        (byType.size !== fullTypes.length ||
          fullTypes.some((type) => !byType.has(type)))) ||
      (!hasContext &&
        (byType.size !== 1 || !byType.has("task_manifest")))
    ) {
      throw new ArtifactStoreError(
        "reference_integrity_failed",
        hasContext
          ? "A contextual Task transaction requires all seven canonical Task Artifacts."
          : "A contextless Task transaction may contain only task_manifest.",
      );
    }

    const payload = (type: ArtifactTypeV1): unknown => {
      const artifact = byType.get(type);
      if (artifact === undefined) {
        throw new ArtifactStoreError(
          "reference_integrity_failed",
          `Task transaction is missing ${type}.`,
        );
      }
      return artifact.payload;
    };
    const candidate: unknown = hasContext
      ? {
          manifest: payload("task_manifest"),
          brief: payload("task_brief"),
          claims: (payload("claim_ledger") as { claims?: unknown }).claims,
          evidence: (payload("evidence_ledger") as { evidence?: unknown })
            .evidence,
          impactPaths: (payload("impact") as { paths?: unknown }).paths,
          changeChecks: [payload("change_check")],
          verificationRecords: (
            payload("verification") as { records?: unknown }
          ).records,
          events: [...input.events],
          idempotencyRecords: [...input.idempotencyRecords],
        }
      : {
          manifest: payload("task_manifest"),
          events: [...input.events],
          idempotencyRecords: [...input.idempotencyRecords],
        };
    const bundle = this.parseTrustedTaskBundle(candidate);
    return { bundle, artifacts, taskId, revision };
  }

  async #verifyPublishedTaskBundle(
    prepared: PreparedTaskBundle,
  ): Promise<boolean> {
    try {
      const manifest = await this.#readManifestRaw();
      let taskManifestArtifact: PersistedArtifactV1 | undefined;
      let taskManifestDescriptor:
        | ReturnType<typeof ArtifactDescriptorV1Schema.parse>
        | undefined;
      for (const expected of prepared.artifacts) {
        const actual = await this.#readArtifactPath(
          this.#artifactPath(expected),
        );
        const descriptor = await this.#requirePublishedDescriptor(
          actual,
          this.#artifactPath(expected),
          manifest,
        );
        if (!compareArtifacts(actual, expected)) return false;
        if (actual.artifactType === "task_manifest") {
          taskManifestArtifact = actual;
          taskManifestDescriptor = descriptor;
        }
      }
      const eventLog = await readTaskEventLog(
        this.layout,
        prepared.taskId,
      );
      if (
        eventLog.truncatedTail !== undefined ||
        canonicalizeJson(eventLog.events) !==
          canonicalizeJson(prepared.bundle.events)
      ) {
        return false;
      }
      const eventDescriptor = manifest.artifacts.find(
        (descriptor) =>
          descriptor.artifactType === "task_event_log" &&
          descriptor.taskId === prepared.taskId,
      );
      const published =
        eventDescriptor?.revision === prepared.revision &&
        eventDescriptor.contentDigest === eventLog.contentDigest;
      if (
        !published ||
        taskManifestArtifact === undefined ||
        taskManifestDescriptor === undefined
      ) {
        return false;
      }
      await this.#requireArtifactSourceSnapshot(
        manifest,
        taskManifestDescriptor,
        taskManifestArtifact,
        `Task transaction ${prepared.taskId}`,
      );
      await this.#verifyTaskDescriptorSet(
        manifest,
        prepared.taskId,
      );
      await this.#requireStableManifest(manifest);
      return true;
    } catch (error) {
      if (
        error instanceof ArtifactStoreError &&
        error.code === "reference_integrity_failed"
      ) {
        throw error;
      }
      return false;
    }
  }

  async #publishTaskBundleManifest(
    prepared: PreparedTaskBundle,
    serializedEvents: string,
    options: PersistTaskBundleOptions,
  ): Promise<void> {
    await withStoreLock(
      this.layout.worktreeRoot,
      this.layout.repositoryLock,
      async () => {
        const current = await this.#readManifestRaw();
        const freshness = await this.#taskBundleFreshness(current, prepared);
        const artifactByType = new Map(
          prepared.artifacts.map((artifact) => [
            artifact.artifactType,
            artifact,
          ]),
        );
        const taskManifestArtifact = artifactByType.get("task_manifest");
        if (taskManifestArtifact === undefined) {
          throw new ArtifactStoreError(
            "reference_integrity_failed",
            "Prepared Task bundle lost its Task Manifest.",
          );
        }
        const snapshotDescriptor = current.artifacts.find(
          (descriptor) =>
            descriptor.artifactType === "repository_snapshot" &&
            descriptor.sourceSnapshotId ===
              prepared.bundle.manifest.latestSnapshotId &&
            (descriptor.state === "current" ||
              descriptor.state === "read_only_recovery"),
        );
        const repoPulseDescriptor = current.artifacts.find(
          (descriptor) =>
            descriptor.artifactType === "repo_pulse" &&
            descriptor.sourceSnapshotId ===
              prepared.bundle.manifest.latestSnapshotId &&
            descriptor.state === "current" &&
            (descriptor.freshness === "fresh" ||
              descriptor.freshness === "partial"),
        );
        const requirePrepared = (
          artifactType: ArtifactTypeV1,
        ): ArtifactDependencyV1 => {
          const artifact = artifactByType.get(artifactType);
          if (artifact === undefined) {
            throw new ArtifactStoreError(
              "reference_integrity_failed",
              `Task dependency target is missing: ${artifactType}.`,
            );
          }
          return this.#requiredArtifactDependency(artifact);
        };
        const repositoryDependencies: ArtifactDependencyV1[] = [];
        if (snapshotDescriptor !== undefined) {
          repositoryDependencies.push(
            this.#requiredDependency(snapshotDescriptor),
          );
        }
        if (repoPulseDescriptor !== undefined) {
          repositoryDependencies.push(
            this.#requiredDependency(repoPulseDescriptor),
          );
        }
        const canonicalDependencies = (
          artifactType: ArtifactTypeV1,
        ): ArtifactDependencyV1[] => {
          switch (artifactType) {
            case "task_manifest":
              return repositoryDependencies;
            case "claim_ledger":
              return [requirePrepared("task_manifest")];
            case "evidence_ledger":
              return [
                requirePrepared("task_manifest"),
                requirePrepared("claim_ledger"),
              ];
            case "impact":
              return [
                requirePrepared("claim_ledger"),
                requirePrepared("evidence_ledger"),
              ];
            case "task_brief":
              return [
                requirePrepared("task_manifest"),
                requirePrepared("claim_ledger"),
                requirePrepared("evidence_ledger"),
                requirePrepared("impact"),
              ];
            case "change_check":
              return [
                requirePrepared("task_brief"),
                requirePrepared("evidence_ledger"),
                requirePrepared("impact"),
              ];
            case "verification":
              return [
                requirePrepared("change_check"),
                requirePrepared("claim_ledger"),
              ];
            default:
              return [];
          }
        };
        const descriptors = await Promise.all(
          prepared.artifacts.map((artifact) =>
            this.#descriptorForArtifact(artifact, {
              state: "current",
              freshness,
              dependencies: this.#mergeRequiredDependencies(
                canonicalDependencies(artifact.artifactType),
                options.dependenciesByArtifactId?.[artifact.artifactId],
              ),
            }),
          ),
        );
        const existingEventDescriptor = current.artifacts.find(
          (descriptor) =>
            descriptor.artifactType === "task_event_log" &&
            descriptor.taskId === prepared.taskId,
        );
        const eventDescriptor = ArtifactDescriptorV1Schema.parse({
          descriptorVersion: 1,
          artifactId:
            existingEventDescriptor?.artifactId ??
            `artifact:task-events:${prepared.taskId}`,
          artifactType: "task_event_log",
          storageFormat: "jsonl_v1",
          path: repositoryRelativePathFromAbsolute(
            this.layout.worktreeRoot,
            this.layout.task(prepared.taskId).events,
          ),
          schemaVersion: 1,
          producerVersion: this.producerVersion,
          sourceSnapshotId: prepared.bundle.manifest.latestSnapshotId,
          taskId: prepared.taskId,
          revision: prepared.revision,
          contentDigest: sha256Bytes(serializedEvents),
          state: "current",
          freshness,
          generatedAt:
            prepared.bundle.events.at(-1)?.occurredAt ?? this.#now(),
          dependencies: this.#mergeRequiredDependencies(
            [this.#requiredArtifactDependency(taskManifestArtifact)],
            options.dependenciesByArtifactId?.[
              existingEventDescriptor?.artifactId ??
                `artifact:task-events:${prepared.taskId}`
            ],
          ),
        });
        const next = ArtifactManifestV1Schema.parse({
          ...current,
          updatedAt: this.#now(),
          artifacts: [
            ...current.artifacts.filter(
              (descriptor) => descriptor.taskId !== prepared.taskId,
            ),
            ...descriptors,
            eventDescriptor,
          ],
        });
        const previousManifest = await readManagedFile(
          this.layout.worktreeRoot,
          this.layout.manifest,
        );
        await this.#writeBackup(this.layout.manifest, previousManifest);
        try {
          await atomicWriteJson(
            this.layout.worktreeRoot,
            this.layout.manifest,
            next,
            options.manifestWrite,
          );
        } catch (error) {
          if (isCommittedAtomicWriteError(error, this.layout.manifest)) {
            throw error;
          }
          await atomicWriteFile(
            this.layout.worktreeRoot,
            this.layout.manifest,
            previousManifest,
          );
          throw error;
        }
      },
      this.#lockOptions,
    );
  }

  /**
   * Persists one semantically complete Task revision.
   *
   * Contracts validates every Claim/Evidence/Finding/Verification backlink and
   * the trusted Event digest chain before any bytes are written. Canonical
   * files may be replaced one at a time, but they are not committed until one
   * Manifest switch publishes the complete descriptor set; public reads reject
   * any crash-interrupted intermediate state.
   */
  async persistTaskBundle(
    input: PersistTaskBundleInput,
    options: PersistTaskBundleOptions,
  ): Promise<PersistTaskBundleResult> {
    const prepared = this.#prepareTaskBundle(input);
    const expectedRevision = options.expectedRevision;
    if (
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0 ||
      prepared.revision <= expectedRevision
    ) {
      throw new ArtifactStoreError(
        "revision_conflict",
        "Task bundle revision must advance beyond expectedRevision.",
        { expectedRevision, bundleRevision: prepared.revision },
      );
    }
    const idempotency = {
      key: IdempotencyKeySchema.parse(options.idempotencyKey),
      requestDigest: ContentDigestSchema.parse(options.requestDigest),
    };
    const matchingControlRecord = prepared.bundle.idempotencyRecords.find(
      (record) =>
        record.idempotencyKey === idempotency.key &&
        record.requestDigest === idempotency.requestDigest &&
        record.resultRevision === prepared.revision,
    );
    if (matchingControlRecord === undefined) {
      throw new ArtifactStoreError(
        "idempotency_conflict",
        "Task transaction control must match a trusted bundle idempotency record.",
        { idempotencyKey: idempotency.key },
      );
    }

    await ensureManagedDirectory(
      this.layout.worktreeRoot,
      `.understand-code/tasks/${prepared.taskId}`,
    );
    return withStoreLock(
      this.layout.worktreeRoot,
      this.layout.taskLock(prepared.taskId),
      async () => {
        const idempotencyPath = this.#idempotencyPath(prepared.taskId);
        const index = await this.#readIdempotencyIndex(idempotencyPath);
        const recorded = index.records.find(
          (record) => record.key === idempotency.key,
        );
        if (recorded !== undefined) {
          if (
            recorded.requestDigest !== idempotency.requestDigest ||
            recorded.resultRevision !== prepared.revision ||
            recorded.resultDigest !==
              prepared.artifacts.find(
                (artifact) => artifact.artifactType === "task_manifest",
              )?.contentDigest
          ) {
            throw new ArtifactStoreError(
              "idempotency_conflict",
              "Task transaction idempotency key was used for another result.",
              { idempotencyKey: idempotency.key },
            );
          }
          if (!(await this.#verifyPublishedTaskBundle(prepared))) {
            throw new ArtifactStoreError(
              "manifest_inconsistent",
              "Recorded Task transaction is not fully published.",
              { taskId: prepared.taskId },
            );
          }
          return {
            bundle: prepared.bundle,
            artifacts: prepared.artifacts,
            replayed: true,
          };
        }

        const currentManifest = await this.#readManifestRaw();
        await this.#taskBundleFreshness(currentManifest, prepared);
        const currentTaskDescriptor = currentManifest.artifacts.find(
          (descriptor) =>
            descriptor.artifactType === "task_manifest" &&
            descriptor.taskId === prepared.taskId,
        );
        const currentRevision = currentTaskDescriptor?.revision ?? 0;
        if (
          currentTaskDescriptor?.state === "read_only_recovery" &&
          options.promoteRecovery !== true
        ) {
          throw new ArtifactStoreError(
            "revision_conflict",
            "Recovered Task state is read-only until explicitly promoted.",
            { taskId: prepared.taskId },
          );
        }

        if (
          currentRevision === prepared.revision &&
          (await this.#verifyPublishedTaskBundle(prepared))
        ) {
          const taskManifestArtifact = prepared.artifacts.find(
            (artifact) => artifact.artifactType === "task_manifest",
          );
          if (taskManifestArtifact === undefined) {
            throw new ArtifactStoreError(
              "reference_integrity_failed",
              "Prepared Task bundle lost its Task Manifest.",
            );
          }
          await this.#recordIdempotency(
            idempotencyPath,
            index,
            taskManifestArtifact,
            idempotency,
          );
          return {
            bundle: prepared.bundle,
            artifacts: prepared.artifacts,
            replayed: true,
          };
        }
        if (currentRevision !== expectedRevision) {
          throw new ArtifactStoreError(
            "revision_conflict",
            "Task bundle compare-and-swap revision does not match the published Manifest.",
            {
              expectedRevision,
              currentRevision,
              bundleRevision: prepared.revision,
            },
          );
        }

        const desiredEvents = prepared.bundle.events;
        const desiredPrefix = desiredEvents.filter(
          (event) => event.revision <= expectedRevision,
        );
        let currentEvents: ParsedTaskEventLog;
        try {
          currentEvents = await readTaskEventLog(
            this.layout,
            prepared.taskId,
          );
        } catch (error) {
          throw new ArtifactStoreError(
            "artifact_corrupt",
            "Current Task Event log cannot participate in a Task transaction.",
            { taskId: prepared.taskId },
            { cause: error },
          );
        }
        if (currentEvents.truncatedTail !== undefined) {
          throw new ArtifactStoreError(
            "artifact_corrupt",
            "Task Event log has an uncommitted tail; recover it before mutation.",
            { taskId: prepared.taskId },
          );
        }
        const currentMatchesPrefix =
          canonicalizeJson(currentEvents.events) ===
          canonicalizeJson(desiredPrefix);
        const currentMatchesDesired =
          canonicalizeJson(currentEvents.events) ===
          canonicalizeJson(desiredEvents);
        if (
          (expectedRevision === 0 &&
            currentEvents.events.length > 0 &&
            !currentMatchesDesired) ||
          (expectedRevision > 0 &&
            !currentMatchesPrefix &&
            !currentMatchesDesired)
        ) {
          throw new ArtifactStoreError(
            "revision_conflict",
            "Task Event log is not the expected committed prefix or an identical interrupted retry.",
            { taskId: prepared.taskId, expectedRevision },
          );
        }

        const serializedEvents = `${desiredEvents
          .map((event) => canonicalizeJson(event))
          .join("\n")}\n`;
        const writes = [
          ...prepared.artifacts.map((artifact) => ({
            path: this.#artifactPath(artifact),
            content: `${canonicalizeJson(artifact)}\n`,
          })),
          {
            path: this.layout.task(prepared.taskId).events,
            content: serializedEvents,
          },
        ];
        const previousByPath = new Map<string, Buffer | undefined>();
        for (const write of writes) {
          try {
            const previous = await readManagedFile(
              this.layout.worktreeRoot,
              write.path,
            );
            previousByPath.set(write.path, previous);
            await this.#writeBackup(write.path, previous);
          } catch (error) {
            if (
              error instanceof ArtifactStoreError &&
              error.code === "artifact_not_found"
            ) {
              previousByPath.set(write.path, undefined);
            } else {
              throw error;
            }
          }
        }

        const writtenPaths: string[] = [];
        let manifestCommitted = false;
        try {
          for (const write of writes) {
            try {
              await atomicWriteFile(
                this.layout.worktreeRoot,
                write.path,
                write.content,
                options.artifactWrite,
              );
              writtenPaths.push(write.path);
            } catch (error) {
              if (
                error instanceof ArtifactStoreError &&
                error.details?.committed === true
              ) {
                writtenPaths.push(write.path);
              }
              throw error;
            }
          }
          await this.#publishTaskBundleManifest(
            prepared,
            serializedEvents,
            options,
          );
          manifestCommitted = true;
          const taskManifestArtifact = prepared.artifacts.find(
            (artifact) => artifact.artifactType === "task_manifest",
          );
          if (taskManifestArtifact === undefined) {
            throw new ArtifactStoreError(
              "reference_integrity_failed",
              "Prepared Task bundle lost its Task Manifest.",
            );
          }
          await this.#recordIdempotency(
            idempotencyPath,
            index,
            taskManifestArtifact,
            idempotency,
          );
          return {
            bundle: prepared.bundle,
            artifacts: prepared.artifacts,
            replayed: false,
          };
        } catch (error) {
          if (isCommittedAtomicWriteError(error, this.layout.manifest)) {
            manifestCommitted = true;
          }
          if (!manifestCommitted) {
            for (const writtenPath of writtenPaths.reverse()) {
              const previous = previousByPath.get(writtenPath);
              if (previous === undefined) {
                await this.#quarantinePath(
                  writtenPath,
                  "uncommitted-task-transaction",
                ).catch(() => undefined);
              } else {
                await atomicWriteFile(
                  this.layout.worktreeRoot,
                  writtenPath,
                  previous,
                );
              }
            }
          }
          throw error;
        }
      },
      this.#lockOptions,
    );
  }

  async migrateJson(
    options: MigrationExecutionOptions,
  ): Promise<MigrationExecutionResult> {
    const targetPath = await resolveManagedPath(
      this.layout.worktreeRoot,
      options.relativePath,
    );
    const targetRelative = repositoryRelativePathFromAbsolute(
      this.layout.worktreeRoot,
      targetPath,
    );
    return withStoreLock(
      this.layout.worktreeRoot,
      this.layout.repositoryLock,
      async () => {
        const manifest = await this.#readManifestRaw();
        const publishedDescriptor = manifest.artifacts.find(
          (descriptor) => descriptor.path === targetRelative,
        );
        if (
          targetRelative.startsWith(".understand-code/tasks/") ||
          publishedDescriptor?.taskId !== undefined ||
          publishedDescriptor?.storageFormat === "jsonl_v1"
        ) {
          throw new ArtifactStoreError(
            "migration_failed",
            "Task-scoped Artifacts and Event logs must be migrated as one complete Task transaction.",
            { relativePath: targetRelative },
          );
        }
        if (
          publishedDescriptor === undefined &&
          (!targetRelative.startsWith(".understand-code/legacy/") ||
            !targetRelative.endsWith(".json"))
        ) {
          throw new ArtifactStoreError(
            "migration_failed",
            "Unpublished migrations are restricted to JSON files under .understand-code/legacy/.",
            { relativePath: targetRelative },
          );
        }
        if (publishedDescriptor?.state === "corrupt") {
          throw new ArtifactStoreError(
            "migration_failed",
            "A corrupt published Artifact must be recovered before migration.",
            {
              artifactId: publishedDescriptor.artifactId,
              relativePath: targetRelative,
            },
          );
        }
        if (
          publishedDescriptor?.artifactType === "repository_snapshot"
        ) {
          throw new ArtifactStoreError(
            "migration_failed",
            "Published Repository Snapshots are immutable and cannot be migrated in place.",
            {
              artifactId: publishedDescriptor.artifactId,
              sourceSnapshotId: publishedDescriptor.sourceSnapshotId,
              migrationPolicy: "create_new_snapshot",
            },
          );
        }
        if (publishedDescriptor !== undefined) {
          await this.#verifyManifestArtifacts(manifest);
        }

        const originalBytes = await readManagedFile(
          this.layout.worktreeRoot,
          targetPath,
        );
        const originalManifestBytes =
          publishedDescriptor === undefined
            ? undefined
            : await readManagedFile(
                this.layout.worktreeRoot,
                this.layout.manifest,
              );
        let original: unknown;
        try {
          original = JSON.parse(originalBytes.toString("utf8")) as unknown;
        } catch (error) {
          throw new ArtifactStoreError(
            "migration_failed",
            "Migration input is not valid JSON.",
            undefined,
            { cause: error },
          );
        }
        let originalArtifact: PersistedArtifactV1 | undefined;
        if (publishedDescriptor?.storageFormat === "enveloped_v1") {
          originalArtifact = this.#parseTrustedArtifact(original);
          await this.#requirePublishedDescriptor(
            originalArtifact,
            targetPath,
            manifest,
          );
        } else if (publishedDescriptor?.storageFormat === "legacy_raw") {
          if (
            publishedDescriptor.legacyFormat !== options.format ||
            String(publishedDescriptor.schemaVersion) !== options.toVersion
          ) {
            throw new ArtifactStoreError(
              "migration_failed",
              "Published legacy migration format and target version must match its registered descriptor.",
              {
                artifactId: publishedDescriptor.artifactId,
                expectedFormat: publishedDescriptor.legacyFormat,
                actualFormat: options.format,
                expectedVersion: String(publishedDescriptor.schemaVersion),
                actualVersion: options.toVersion,
              },
            );
          }
        }

        const migration = migrateArtifactValueV1({
          value: original,
          format: options.format,
          fromVersion: options.fromVersion,
          toVersion: options.toVersion,
          steps: options.steps,
        });
        if (!migration.ok) {
          throw new ArtifactStoreError(
            "migration_failed",
            migration.message,
            { migrationCode: migration.code },
          );
        }

        const isolationRelative =
          `.understand-code/.recovery/migrations/${randomUUID()}`;
        const isolationDirectory = await ensureManagedDirectory(
          this.layout.worktreeRoot,
          isolationRelative,
        );
        const candidatePath = path.join(isolationDirectory, "candidate.json");
        let targetSwitched = false;
        let manifestCommitted = false;
        let backupPath: string | undefined;
        try {
          await atomicWriteJson(
            this.layout.worktreeRoot,
            candidatePath,
            migration.value,
          );
          const isolatedBytes = await readManagedFile(
            this.layout.worktreeRoot,
            candidatePath,
          );
          const isolatedValue = JSON.parse(
            isolatedBytes.toString("utf8"),
          ) as unknown;
          await options.validate(isolatedValue);
          if (!migration.migrated) {
            return {
              value: migration.value,
              appliedVersions: migration.appliedVersions,
              migrated: false,
            };
          }

          let nextManifest: ArtifactManifestV1 | undefined;
          if (publishedDescriptor !== undefined) {
            let nextDescriptor:
              | ReturnType<typeof ArtifactDescriptorV1Schema.parse>
              | undefined;
            if (publishedDescriptor.storageFormat === "enveloped_v1") {
              if (originalArtifact === undefined) {
                throw new ArtifactStoreError(
                  "migration_failed",
                  "Published V1 migration lost its trusted source identity.",
                  { artifactId: publishedDescriptor.artifactId },
                );
              }
              const migratedArtifact = this.#parseTrustedArtifact(
                isolatedValue,
              );
              if (
                migratedArtifact.repositoryId !== originalArtifact.repositoryId ||
                migratedArtifact.worktreeId !== originalArtifact.worktreeId ||
                migratedArtifact.artifactId !== originalArtifact.artifactId ||
                migratedArtifact.artifactType !== originalArtifact.artifactType ||
                migratedArtifact.taskId !== originalArtifact.taskId ||
                migratedArtifact.sourceSnapshotId !==
                  originalArtifact.sourceSnapshotId ||
                migratedArtifact.revision !== originalArtifact.revision + 1 ||
                this.#artifactPath(migratedArtifact) !== targetPath
              ) {
                throw new ArtifactStoreError(
                  "migration_failed",
                  "A published V1 migration must preserve canonical identity and advance revision exactly once.",
                  {
                    artifactId: originalArtifact.artifactId,
                    sourceRevision: originalArtifact.revision,
                    migratedRevision: migratedArtifact.revision,
                  },
                );
              }
              nextDescriptor = ArtifactDescriptorV1Schema.parse({
                ...publishedDescriptor,
                schemaVersion: migratedArtifact.schemaVersion,
                producerVersion: migratedArtifact.producerVersion,
                sourceSnapshotId: migratedArtifact.sourceSnapshotId,
                revision: migratedArtifact.revision,
                contentDigest: migratedArtifact.contentDigest,
                generatedAt: migratedArtifact.createdAt,
              });
            } else if (publishedDescriptor.storageFormat === "legacy_raw") {
              nextDescriptor = ArtifactDescriptorV1Schema.parse({
                ...publishedDescriptor,
                producerVersion: this.producerVersion,
                revision: (publishedDescriptor.revision ?? 0) + 1,
                contentDigest: sha256Bytes(isolatedBytes),
                generatedAt: this.#now(),
              });
            } else {
              throw new ArtifactStoreError(
                "migration_failed",
                "The published storage format is not migratable through migrateJson.",
                {
                  artifactId: publishedDescriptor.artifactId,
                  storageFormat: publishedDescriptor.storageFormat,
                },
              );
            }

            const conflictingDependents = manifest.artifacts.filter(
              (descriptor) =>
                descriptor.dependencies.some(
                  (dependency) =>
                    dependency.artifactId ===
                      publishedDescriptor.artifactId &&
                    dependency.requiredDigest !== undefined &&
                    dependency.requiredDigest !==
                      nextDescriptor?.contentDigest,
                ),
            );
            if (conflictingDependents.length > 0) {
              throw new ArtifactStoreError(
                "migration_failed",
                "Published migration would invalidate digest-pinned dependents; migrate the complete dependency transaction instead.",
                {
                  artifactId: publishedDescriptor.artifactId,
                  dependentArtifactIds: conflictingDependents.map(
                    (descriptor) => descriptor.artifactId,
                  ),
                },
              );
            }
            try {
              nextManifest = ArtifactManifestV1Schema.parse({
                ...manifest,
                producerVersion: this.producerVersion,
                updatedAt: this.#now(),
                artifacts: manifest.artifacts.map((descriptor) =>
                  descriptor.artifactId === publishedDescriptor.artifactId
                    ? nextDescriptor
                    : descriptor,
                ),
              });
            } catch (error) {
              throw new ArtifactStoreError(
                "migration_failed",
                "Migrated descriptor would violate Artifact Manifest invariants.",
                { artifactId: publishedDescriptor.artifactId },
                { cause: error },
              );
            }
          }

          backupPath = await this.#writeBackup(targetPath, originalBytes);
          if (originalManifestBytes !== undefined) {
            await this.#writeBackup(
              this.layout.manifest,
              originalManifestBytes,
            );
          }
          await atomicWriteFile(
            this.layout.worktreeRoot,
            targetPath,
            isolatedBytes,
            options.write,
          );
          targetSwitched = true;
          await options.afterSwitch?.();
          const switchedBytes = await readManagedFile(
            this.layout.worktreeRoot,
            targetPath,
          );
          if (!switchedBytes.equals(isolatedBytes)) {
            throw new ArtifactStoreError(
              "migration_failed",
              "Migration target changed before its Manifest commit.",
              { relativePath: targetRelative },
            );
          }
          if (
            nextManifest !== undefined &&
            originalManifestBytes !== undefined
          ) {
            const currentManifestBytes = await readManagedFile(
              this.layout.worktreeRoot,
              this.layout.manifest,
            );
            if (!currentManifestBytes.equals(originalManifestBytes)) {
              throw new ArtifactStoreError(
                "migration_failed",
                "Artifact Manifest changed during migration.",
                {
                  relativePath: targetRelative,
                  artifactId: publishedDescriptor?.artifactId,
                },
              );
            }
            try {
              await atomicWriteJson(
                this.layout.worktreeRoot,
                this.layout.manifest,
                nextManifest,
                options.manifestWrite,
              );
              manifestCommitted = true;
            } catch (error) {
              if (
                error instanceof ArtifactStoreError &&
                error.details?.committed === true
              ) {
                const committedManifest = await this.#readManifestRaw();
                if (
                  canonicalizeJson(committedManifest) ===
                  canonicalizeJson(nextManifest)
                ) {
                  manifestCommitted = true;
                }
              }
              throw error;
            }
          }
          return {
            value: migration.value,
            appliedVersions: migration.appliedVersions,
            migrated: migration.migrated,
            backupPath,
          };
        } catch (error) {
          if (
            error instanceof ArtifactStoreError &&
            error.details?.committed === true &&
            error.details?.targetPath === targetPath
          ) {
            targetSwitched = true;
          }
          let rolledBack = !targetSwitched;
          let rollbackError: unknown;
          if (targetSwitched && !manifestCommitted) {
            try {
              await atomicWriteFile(
                this.layout.worktreeRoot,
                targetPath,
                originalBytes,
              );
              const restored = await readManagedFile(
                this.layout.worktreeRoot,
                targetPath,
              );
              rolledBack = restored.equals(originalBytes);
            } catch (candidateRollbackError) {
              rollbackError = candidateRollbackError;
              try {
                const restored = await readManagedFile(
                  this.layout.worktreeRoot,
                  targetPath,
                );
                rolledBack = restored.equals(originalBytes);
              } catch {
                rolledBack = false;
              }
            }
          }
          if (
            originalManifestBytes !== undefined &&
            !manifestCommitted
          ) {
            try {
              const currentManifestBytes = await readManagedFile(
                this.layout.worktreeRoot,
                this.layout.manifest,
              );
              if (!currentManifestBytes.equals(originalManifestBytes)) {
                await atomicWriteFile(
                  this.layout.worktreeRoot,
                  this.layout.manifest,
                  originalManifestBytes,
                );
              }
            } catch (manifestRollbackError) {
              rollbackError ??= manifestRollbackError;
              rolledBack = false;
            }
          }
          throw new ArtifactStoreError(
            "migration_failed",
            manifestCommitted
              ? "Migration crossed the Manifest commit point, but durability confirmation failed."
              : rolledBack
                ? "Migration failed validation or switching; original Artifact and Manifest bytes were restored."
                : "Migration rollback could not restore the original publication.",
            {
              ...(error instanceof ArtifactStoreError
                ? error.details
                : {}),
              targetSwitched,
              manifestCommitted,
              rolledBack,
              ...(rollbackError instanceof Error
                ? { rollbackError: rollbackError.message }
                : {}),
            },
            { cause: error },
          );
        } finally {
          await unlink(candidatePath).catch(() => undefined);
          await rmdir(isolationDirectory).catch(() => undefined);
        }
      },
      this.#lockOptions,
    );
  }
}
