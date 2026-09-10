import { createHash } from "node:crypto";
import path from "node:path";
import { openActiveRepositoryIndexV1, openRepositoryIndexSourcesV1 } from "./repository-indexer.js";
import { LOCAL_INDEX_READ_BUDGETS_V1, withLocalIndexReadBudgetsV1 } from "./local-read-budgets.js";
import type { Stats } from "node:fs";
import { lstat, readFile, statfs } from "node:fs/promises";

import {
  ArtifactStore,
  ArtifactStoreError,
  ArtifactStoreStrongChangeAuthorityV1,
  type StrongChangeProviderAuthorityV1,
} from "@understand-code/artifact-store";
import {
  canonicalizeJson,
  type RepoPulseV1,
  type RepositorySnapshotV1,
} from "@understand-code/contracts";
import {
  bootstrapSafeGitDescriptorBoundCandidateV1,
  getRepositorySnapshotDetailed,
  getRepositorySnapshotDetailedWithSafeGitCapabilityV1,
  type SafeGitTaskBaselineLeaseCreateRequestV1,
} from "@understand-code/repository-state";
import {
  isProviderProductionStrongObjectUnavailableErrorV1,
  openProviderProductionStrongObjectClientV1,
  type ProviderProductionStrongObjectClientV1,
} from "@understand-code/durable-object-provider-client";
import {
  ProviderRuntimeIpcFixedObjectLocatorV1Schema,
  type ProviderRuntimeIpcJsonValueV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import {
  RepositoryTaskContextProvider,
  RepositoryStrongChangeMaterialAuthorityV1,
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
  readonly runtimeProfile?: "local_durable_v1" | "production_provider_v1";
  readonly store: ArtifactStore;
  readonly taskEngine: TaskEngine;
  readonly close?: () => Promise<void>;
  readonly providerClient?: ProviderProductionStrongObjectClientV1;
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

const PRODUCTION_SAFE_GIT_EXECUTABLE_V1 = "/opt/understand-code/bin/git";
const PRODUCTION_SAFE_GIT_CGROUP_SUBGROUP_V1 =
  "understand-code-safe-git-supervisor-v1";
const LINUX_EXT4_SUPER_MAGIC_V1 = 0xef53;

const AMBIENT_GIT_AUTHORITY_VARIABLES = Object.freeze([
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_COMMON_DIR",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
] as const);

function isErrnoV1(error: unknown, code: string): boolean {
  return (
    typeof error === "object" && error !== null && "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}

async function withoutAmbientGitAuthority<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const names = [
    ...AMBIENT_GIT_AUTHORITY_VARIABLES,
    "GIT_OPTIONAL_LOCKS",
  ] as const;
  const previous = new Map(names.map((name) => [name, process.env[name]]));
  for (const name of AMBIENT_GIT_AUTHORITY_VARIABLES) delete process.env[name];
  process.env.GIT_OPTIONAL_LOCKS = "0";
  try {
    return await operation();
  } finally {
    for (const name of names) {
      const value = previous.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

async function useProductionSafeGitProfileV1(
  canonicalRoot: string,
): Promise<boolean> {
  if (process.platform !== "linux") return false;

  let executable: Stats | undefined;
  try {
    executable = await lstat(PRODUCTION_SAFE_GIT_EXECUTABLE_V1);
  } catch (error) {
    if (!isErrnoV1(error, "ENOENT")) throw error;
  }
  let delegated = false;
  try {
    const cgroup = await readFile("/proc/self/cgroup", "utf8");
    delegated = cgroup
      .trim()
      .split("\n")
      .some((line) =>
        line.startsWith("0::/") &&
        line.split("/").at(-1) === PRODUCTION_SAFE_GIT_CGROUP_SUBGROUP_V1
      );
  } catch {
    delegated = false;
  }

  if (executable === undefined && !delegated) return false;
  if (
    executable === undefined || !delegated || !executable.isFile() ||
    executable.isSymbolicLink() || executable.uid !== 0 || executable.gid !== 0 ||
    executable.nlink !== 1 || (executable.mode & 0o7777) !== 0o755
  ) {
    throw new Error("installed SafeGit production profile is invalid");
  }
  const filesystem = await statfs(canonicalRoot);
  if (filesystem.type !== LINUX_EXT4_SUPER_MAGIC_V1) {
    throw new Error("installed SafeGit production filesystem is invalid");
  }
  return true;
}

async function openProductionSafeGitReadSessionV1(canonicalRoot: string) {
  const candidate = await bootstrapSafeGitDescriptorBoundCandidateV1(canonicalRoot);
  try {
    await candidate.capability.bindRepositoryControl();
    await candidate.capability.bindRepositoryIdentity();
    await candidate.capability.bindEmptyHooksDirectory();
    await candidate.capability.bindGitExecutable(PRODUCTION_SAFE_GIT_EXECUTABLE_V1);
    await candidate.capability.executeGitVersion();
    return {
      executor: candidate.capability.createReadExecutor(),
      executeGitObjectType: (objectId: string) =>
        candidate.capability.executeGitObjectType(objectId),
      createTaskBaselineLease: (request: SafeGitTaskBaselineLeaseCreateRequestV1) =>
        candidate.capability.createTaskBaselineLease(request),
      recoverTaskBaselineLease: (request: SafeGitTaskBaselineLeaseCreateRequestV1) =>
        candidate.capability.recoverTaskBaselineLease(request),
      close: () => candidate.capability.close(),
    };
  } catch (error) {
    await candidate.capability.close().catch(() => undefined);
    throw error;
  }
}

/**
 * Capture repository facts using only the explicitly bound worktree.  Public
 * write tools (for example refresh_index) must use the same Git authority
 * boundary as read-only runtime opening; ambient GIT_* variables are never
 * allowed to redirect a capture.
 */
/** Fixed repository-only capture for the local profile; installed Provider
 * executables and cgroup state never select this runtime's Git authority. */
export async function captureLocalRepositorySnapshot(canonicalRoot: string) {
  return withoutAmbientGitAuthority(() => getRepositorySnapshotDetailed(canonicalRoot));
}

export async function captureBoundRepositorySnapshot(
  canonicalRoot: string,
) {
  if (!(await useProductionSafeGitProfileV1(canonicalRoot))) {
    return withoutAmbientGitAuthority(() =>
      getRepositorySnapshotDetailed(canonicalRoot),
    );
  }
  const candidate =
    await bootstrapSafeGitDescriptorBoundCandidateV1(canonicalRoot);
  try {
    await candidate.capability.bindRepositoryControl();
    await candidate.capability.bindRepositoryIdentity();
    await candidate.capability.bindEmptyHooksDirectory();
    await candidate.capability.bindGitExecutable(
      PRODUCTION_SAFE_GIT_EXECUTABLE_V1,
    );
    await candidate.capability.executeGitVersion();
    return await getRepositorySnapshotDetailedWithSafeGitCapabilityV1(
      canonicalRoot,
      candidate.capability,
    );
  } finally {
    await candidate.capability.close();
  }
}

export async function openRuntime(
  canonicalRoot: string,
  options: Readonly<{ canonicalInstallationRoot?: string; runtimeProfile?: "local_durable_v1" }> = {},
): Promise<RuntimeContext> {
  // The explicit, frozen root and production-pinned Git executable are the
  // only repository read authorities; no cwd, PATH, env, or raw argv enters
  // the contained snapshot runner.
  const strongSelector = options.canonicalInstallationRoot;
  const providerClient = strongSelector === undefined
    ? undefined
    : await openProviderProductionStrongObjectClientV1({
        canonicalInstallationRoot: strongSelector,
      });
  let providerClientOwnedByRuntime = false;
  try {
    const bound = strongSelector === undefined
      ? { capture: await (options.runtimeProfile === "local_durable_v1" ? captureLocalRepositorySnapshot(canonicalRoot) : captureBoundRepositorySnapshot(canonicalRoot)) }
      : await (async () => {
          const candidate =
            await bootstrapSafeGitDescriptorBoundCandidateV1(canonicalRoot);
          try {
            await candidate.capability.bindRepositoryControl();
            const identity =
              await candidate.capability.bindRepositoryIdentity();
            await candidate.capability.bindEmptyHooksDirectory();
            await candidate.capability.bindGitExecutable(
              PRODUCTION_SAFE_GIT_EXECUTABLE_V1,
            );
            await candidate.capability.executeGitVersion();
            return {
              capture:
                await getRepositorySnapshotDetailedWithSafeGitCapabilityV1(
                  canonicalRoot,
                  candidate.capability,
                ),
              identity,
            };
          } finally {
            await candidate.capability.close();
          }
        })();
    const capture = bound.capture;
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
      // A production selector promotes the descriptor-bound,
      // installation-keyed identity into the Store binding. The legacy
      // capture still proves repository state and canonical root, but its
      // path-derived opaque IDs must never select a strong namespace.
      repositoryId: "identity" in bound
        ? bound.identity.repositoryId
        : capture.snapshot.repositoryId,
      worktreeId: "identity" in bound
        ? bound.identity.worktreeId
        : capture.snapshot.worktreeId,
      producerVersion: PRODUCT_VERSION,
    });
    try {
      await store.readManifest({ verifyArtifacts: false });
    } catch (error) {
      if (error instanceof ArtifactStoreError) {
        if (error.code === "artifact_not_found") {
          throw missingRepositoryContext();
        }
        if (error.code === "manifest_inconsistent") {
          throw new RuntimeBindingError();
        }
        if (error.code === "artifact_corrupt") {
          throw new ToolFailure(
            artifactUnavailableFailure("corrupt", "artifact_manifest"),
          );
        }
      }
      throw error;
    }

    let strongChangeAuthority:
      | ArtifactStoreStrongChangeAuthorityV1
      | undefined;
    let localIndexPaths = {};
    if (strongSelector === undefined) {
      try {
        const index = withLocalIndexReadBudgetsV1(await openActiveRepositoryIndexV1(canonicalRoot));
        const manifest = await store.readManifest({ verifyArtifacts: false });
        if (index.authority.runtimeProfile === "local_durable_v1" && index.authority.sourceSnapshotId === manifest.latestSnapshotId) {
          await Promise.all([index.read("knowledge-graph.json"), index.read("knowledge-base/wiki-index.json"), index.read("knowledge-base/search-index.json")]);
          const prefix = path.relative(canonicalRoot, index.generationRoot);
          const sourceReader = await openRepositoryIndexSourcesV1({ canonicalRoot, sourceSnapshotId: index.authority.sourceSnapshotId });
          localIndexPaths = {
            maxGraphBytes: LOCAL_INDEX_READ_BUDGETS_V1.graphBytes,
            maxWikiBytes: LOCAL_INDEX_READ_BUDGETS_V1.wikiBytes,
            maxSearchBytes: LOCAL_INDEX_READ_BUDGETS_V1.searchBytes,
            graphPath: `${prefix}/knowledge-graph.json`,
            wikiIndexPath: `${prefix}/knowledge-base/wiki-index.json`,
            wikiSearchPath: `${prefix}/knowledge-base/search-index.json`,
            readLocalSnapshotSource: ({ sourceSnapshotId, filePath }: { sourceSnapshotId: string; filePath: string }) =>
              sourceSnapshotId === index.authority.sourceSnapshotId ? sourceReader.read(filePath) : Promise.resolve(undefined),
          };
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    const contextProvider = await RepositoryTaskContextProvider.open({
      canonicalRoot,
      ...localIndexPaths,
      ...(strongSelector === undefined
        ? {}
        : {
            openStrongSafeGitReadSession: () =>
              openProductionSafeGitReadSessionV1(canonicalRoot),
          }),
    });
    if (providerClient !== undefined) {
      const provider: StrongChangeProviderAuthorityV1 = {
        inspectBusinessHead: () => providerClient!.inspectBusinessHead(),
        inspectState: async () => {
          const result = await providerClient.inspectState();
          return { revision: result.revision };
        },
        readExactObject: ({ locator }) =>
          providerClient.readExactObject(
            ProviderRuntimeIpcFixedObjectLocatorV1Schema.parse(locator),
          ),
        writeExactObject: (input) =>
          providerClient.writeExactObject({
            ...input,
            locator: ProviderRuntimeIpcFixedObjectLocatorV1Schema.parse(
              input.locator,
            ),
          }),
        compareCommit: async (input) => {
          const result = await providerClient.compareCommit({
            ...input,
            artifacts: input.artifacts as Readonly<
              Record<string, ProviderRuntimeIpcJsonValueV1>
            >,
          });
          return {
            resolution: result.resolution,
            committedRevision: result.state.revision,
            artifacts: result.state.artifacts,
          };
        },
      };
      const ownerKeyAuthority = {
        provenance: "provider_installation_owner_v1" as const,
        commit: (
          domain:
            | "record-verification-full-input-v1"
            | "verification-detail-semantic-v1",
          canonicalValue: string,
        ) => providerClient.commitOwnerOnlyState(domain, canonicalValue),
      };
      const materialAuthority =
        new RepositoryStrongChangeMaterialAuthorityV1({
          store,
          repositoryContextProvider: contextProvider,
          provider,
          providerId: providerClient.verifiedProviderId,
          ownerKeyAuthority,
        });
      strongChangeAuthority = new ArtifactStoreStrongChangeAuthorityV1(store, {
        provider,
        materialAuthority,
        providerId: providerClient.verifiedProviderId,
      });
    }
    const runtime: RuntimeContext = {
      runtimeProfile: providerClient === undefined ? "local_durable_v1" : "production_provider_v1",
      store,
      taskEngine: new TaskEngine(store, {
        contextProvider,
        createScope: "mcp:build_task_brief:v1",
        ...(strongChangeAuthority === undefined
          ? {}
          : { strongChangeAuthority }),
      }),
      ...(providerClient === undefined
        ? {}
        : {
            providerClient,
            close: async () => providerClient.close(),
          }),
    };
    providerClientOwnedByRuntime = providerClient !== undefined;
    return runtime;
  } finally {
    if (!providerClientOwnedByRuntime) providerClient?.close();
  }
}

/** Explicit production composition entrypoint.  The installation selector is
 * intentionally mandatory here; it is never inferred from cwd, PATH, or
 * ambient environment. */
export async function openProductionRuntime(
  canonicalRoot: string,
  canonicalInstallationRoot: string,
): Promise<RuntimeContext> {
  try {
    return await openRuntime(canonicalRoot, { canonicalInstallationRoot });
  } catch (error) {
    if (isProviderProductionStrongObjectUnavailableErrorV1(error)) {
      throw new ToolFailure(strongStoreUnavailableFailure());
    }
    throw error;
  }
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
