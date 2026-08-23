import { createHash } from "node:crypto";

import {
  ArtifactStore,
  ArtifactStoreError,
} from "@understand-code/artifact-store";
import {
  canonicalizeJson,
  type RepoPulseV1,
  type RepositorySnapshotV1,
} from "@understand-code/contracts";
import { getRepositorySnapshotDetailed } from "@understand-code/repository-state";
import {
  RepositoryTaskContextProvider,
  TaskEngine,
} from "@understand-code/task-engine";

import { PRODUCT_VERSION } from "../constants.js";
import {
  ToolFailure,
  artifactUnavailableFailure,
  repositoryNotReadyFailure,
  strongStoreUnavailableFailure,
} from "../errors/tool-errors.js";

export class RuntimeBindingError extends Error {
  readonly reason = "secondary_session_required" as const;

  constructor() {
    super("The managed store belongs to another workspace binding.");
    this.name = "RuntimeBindingError";
  }
}

export interface RuntimeContext {
  readonly store: ArtifactStore;
  readonly taskEngine: TaskEngine;
}

export interface PublishedSnapshotContext {
  readonly snapshot: RepositorySnapshotV1;
  readonly worktreeFingerprint: `sha256:${string}`;
}

function sha256(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

export function fingerprintPublishedSnapshot(
  snapshot: RepositorySnapshotV1,
): `sha256:${string}` {
  return sha256(
    canonicalizeJson({
      snapshotId: snapshot.snapshotId,
      repositoryId: snapshot.repositoryId,
      worktreeId: snapshot.worktreeId,
      headCommit: snapshot.headCommit ?? null,
      indexDigest: snapshot.indexDigest,
      worktreeDigest: snapshot.worktreeDigest,
      untrackedDigest: snapshot.untrackedDigest,
      ignoreDigest: snapshot.ignoreDigest,
    }),
  );
}

function missingRepositoryContext(): ToolFailure {
  return new ToolFailure(strongStoreUnavailableFailure());
}

const AMBIENT_GIT_AUTHORITY_VARIABLES = Object.freeze([
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_COMMON_DIR",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
] as const);

async function withoutAmbientGitAuthority<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const name of [
    ...AMBIENT_GIT_AUTHORITY_VARIABLES,
    "GIT_OPTIONAL_LOCKS",
  ] as const) {
    previous.set(name, process.env[name]);
  }
  for (const name of AMBIENT_GIT_AUTHORITY_VARIABLES) {
    delete process.env[name];
  }
  // Repository capture invokes read-only Git commands such as `status`.
  // Suppress Git's optional index refresh so a read tool cannot mutate .git.
  process.env.GIT_OPTIONAL_LOCKS = "0";
  try {
    return await operation();
  } finally {
    for (const name of [
      ...AMBIENT_GIT_AUTHORITY_VARIABLES,
      "GIT_OPTIONAL_LOCKS",
    ] as const) {
      const value = previous.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

/**
 * Capture repository facts using only the explicitly bound worktree.  Public
 * write tools (for example refresh_index) must use the same Git authority
 * boundary as read-only runtime opening; ambient GIT_* variables are never
 * allowed to redirect a capture.
 */
export async function captureBoundRepositorySnapshot(
  canonicalRoot: string,
) {
  return withoutAmbientGitAuthority(() =>
    getRepositorySnapshotDetailed(canonicalRoot),
  );
}

export async function openRuntime(
  canonicalRoot: string,
): Promise<RuntimeContext> {
  // The explicit, frozen root is the only repository authority. Repository
  // State currently inherits process.env for Git subprocesses, so strip the
  // variables that could redirect Git to a different worktree or object set.
  const capture = await captureBoundRepositorySnapshot(canonicalRoot);
  if (
    capture.snapshot.captureStatus === "error" ||
    capture.canonicalRoot !== canonicalRoot
  ) {
    throw new ToolFailure(
      repositoryNotReadyFailure(
        "unknown",
        ["repository_snapshot"],
        "repair_environment",
      ),
    );
  }

  const store = await ArtifactStore.open(canonicalRoot, {
    repositoryId: capture.snapshot.repositoryId,
    worktreeId: capture.snapshot.worktreeId,
    producerVersion: PRODUCT_VERSION,
  });
  try {
    await store.readManifest({ verifyArtifacts: false });
  } catch (error) {
    if (error instanceof ArtifactStoreError) {
      if (error.code === "artifact_not_found") throw missingRepositoryContext();
      if (error.code === "manifest_inconsistent") {
        throw new RuntimeBindingError();
      }
      if (error.code === "artifact_corrupt") {
        throw new ToolFailure(artifactUnavailableFailure("corrupt", "artifact_manifest"));
      }
    }
    throw error;
  }

  const contextProvider = await RepositoryTaskContextProvider.open({
    canonicalRoot,
  });
  return {
    store,
    taskEngine: new TaskEngine(store, {
      contextProvider,
      createScope: "mcp:build_task_brief:v1",
    }),
  };
}

export async function readPublishedSnapshot(
  store: ArtifactStore,
  snapshotId: string,
): Promise<PublishedSnapshotContext> {
  try {
    const read = await store.readArtifact("repository_snapshot", { snapshotId });
    if (read.artifact.artifactType !== "repository_snapshot") {
      throw new ToolFailure(
        artifactUnavailableFailure("corrupt", "repository_snapshot"),
      );
    }
    if ("profile" in read.artifact.payload) {
      throw new ToolFailure(strongStoreUnavailableFailure());
    }
    return {
      snapshot: read.artifact.payload,
      worktreeFingerprint: fingerprintPublishedSnapshot(read.artifact.payload),
    };
  } catch (error) {
    if (error instanceof ToolFailure) throw error;
    if (error instanceof ArtifactStoreError) {
      const reason =
        error.code === "artifact_not_found"
          ? "missing"
          : error.code === "artifact_corrupt" ||
              error.code === "manifest_inconsistent" ||
              error.code === "reference_integrity_failed"
            ? "corrupt"
            : undefined;
      if (reason !== undefined) {
        throw new ToolFailure(
          artifactUnavailableFailure(reason, "repository_snapshot"),
        );
      }
    }
    throw error;
  }
}

export async function readPublishedPulse(
  store: ArtifactStore,
): Promise<{ readonly pulse: RepoPulseV1; readonly snapshot: PublishedSnapshotContext }> {
  try {
    const read = await store.readArtifact("repo_pulse");
    if (read.artifact.artifactType !== "repo_pulse") {
      throw new ToolFailure(artifactUnavailableFailure("corrupt", "repo_pulse"));
    }
    if ("profile" in read.artifact.payload) {
      throw new ToolFailure(strongStoreUnavailableFailure());
    }
    return {
      pulse: read.artifact.payload,
      snapshot: await readPublishedSnapshot(
        store,
        read.artifact.payload.evaluatedSnapshotId,
      ),
    };
  } catch (error) {
    if (error instanceof ToolFailure) throw error;
    if (error instanceof ArtifactStoreError) {
      if (error.code === "artifact_not_found") {
        throw new ToolFailure(strongStoreUnavailableFailure());
      }
      if (
        error.code === "artifact_corrupt" ||
        error.code === "manifest_inconsistent" ||
        error.code === "reference_integrity_failed"
      ) {
        throw new ToolFailure(artifactUnavailableFailure("corrupt", "repo_pulse"));
      }
    }
    throw error;
  }
}
