import { createHash } from "node:crypto";
import { access, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sideEffects = vi.hoisted(() => {
  class RepositoryIndexError extends Error {
    readonly code = "repository_index_failed";
  }
  const store = {
    readManifest: vi.fn(),
    initialize: vi.fn(),
    readArtifact: vi.fn(),
    persistArtifact: vi.fn(),
  };
  const capability = {
    bindRepositoryControl: vi.fn(),
    bindRepositoryIdentity: vi.fn(),
    bindEmptyHooksDirectory: vi.fn(),
    bindGitExecutable: vi.fn(),
    executeGitVersion: vi.fn(),
    createReadExecutor: vi.fn(),
    revalidate: vi.fn(),
    close: vi.fn(),
  };
  const provider = {
    verifiedProviderId: "durable-object-provider:fixture",
    inspectState: vi.fn(),
    inspectBusinessHead: vi.fn(),
    readExactObject: vi.fn(),
    writeExactObject: vi.fn(),
    compareCommit: vi.fn(),
    compareCommitIndexPublication: vi.fn(),
    compareCommitRefreshPublication: vi.fn(),
    inspectIndexPublicationAuthority: vi.fn(),
    inspectStrongRefreshAuthority: vi.fn(),
    commitOwnerOnlyState: vi.fn(),
    close: vi.fn(),
  };
  return {
    ArtifactStoreError: undefined as any,
    RepositoryIndexError,
    store,
    capability,
    provider,
    openStore: vi.fn(),
    openProvider: vi.fn(),
    bootstrapSafeGit: vi.fn(),
    createLayeredSession: vi.fn(),
    captureSafeGit: vi.fn(),
    readLayeredSource: vi.fn(),
    readStableFile: vi.fn(),
    preflightIndex: vi.fn(),
    buildRepositoryIndex: vi.fn(),
    publishStagedRepositoryIndex: vi.fn(),
    publishIncrementalStrongCutV1: vi.fn(),
    discardStagedRepositoryIndex: vi.fn(),
    savePendingRepositoryIndexV1: vi.fn(),
    prepareTaskKnowledgeV1: vi.fn(),
    openActiveRepositoryIndexV1: vi.fn(),
    legacyCapture: vi.fn(),
    providerRevision: 0,
    providerIndexAuthority: undefined as any,
    providerRefreshAuthority: undefined as any,
    providerHead: {
      phase: "strong_business_uninitialized_v1",
      operationNonce: "none",
      artifacts: {} as Record<string, unknown>,
    },
    providerRecords: new Map<string, {
      revision: number;
      phase: string;
      operationNonce: string;
      artifacts: Record<string, unknown>;
    }>(),
    providerObjects: new Map<string, {
      locator: { providerId: string; contentDigest: string };
      logicalBytes: number;
      bytes: string;
    }>(),
    manifestExists: false,
    savedSnapshot: undefined as unknown,
    savedPulse: undefined as unknown,
    failNextPersist: false,
    failNextPulsePersist: false,
  };
});

vi.mock("@understand-code/artifact-store", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@understand-code/artifact-store")
  >();
  sideEffects.ArtifactStoreError = actual.ArtifactStoreError;
  return {
    ...actual,
    ArtifactStore: { open: sideEffects.openStore },
  };
});

vi.mock("@understand-code/durable-object-provider-client", () => ({
  isProviderProductionStrongObjectUnavailableErrorV1: () => false,
  openProviderProductionStrongObjectClientV1: sideEffects.openProvider,
}));

vi.mock("@understand-code/repository-state", () => ({
  bootstrapSafeGitDescriptorBoundCandidateV1: sideEffects.bootstrapSafeGit,
  createSafeGitLayeredContentReadSessionV1:
    sideEffects.createLayeredSession,
  getRepositorySnapshotDetailedWithSafeGitCapabilityV1:
    sideEffects.captureSafeGit,
  isSensitiveRepositoryPath: (value: string) =>
    value === ".env" || value.endsWith("/.env"),
  readSafeGitLayeredRepositoryChangeContentV1:
    sideEffects.readLayeredSource,
  readStableRepositoryFile: sideEffects.readStableFile,
}));

vi.mock("../src/runtime/repository-indexer.js", () => ({
  RepositoryIndexError: sideEffects.RepositoryIndexError,
  preflightRepositoryIndex: sideEffects.preflightIndex,
  buildRepositoryIndex: sideEffects.buildRepositoryIndex,
  publishStagedRepositoryIndex: sideEffects.publishStagedRepositoryIndex,
  publishIncrementalStrongCutV1: sideEffects.publishIncrementalStrongCutV1,
  discardStagedRepositoryIndex: sideEffects.discardStagedRepositoryIndex,
  savePendingRepositoryIndexV1: sideEffects.savePendingRepositoryIndexV1,
  openActiveRepositoryIndexV1: sideEffects.openActiveRepositoryIndexV1,
}));

vi.mock("../src/handlers/knowledge-publication.js", () => ({
  prepareTaskKnowledgeV1: sideEffects.prepareTaskKnowledgeV1,
}));

vi.mock("../src/runtime/context.js", () => ({
  captureBoundRepositorySnapshot: sideEffects.legacyCapture,
  fingerprintPublishedSnapshot: vi.fn(),
}));

import {
  derivePathSafeRepositorySnapshotIdV1,
  parseTrustedStrongRepoPulseV1,
  parseTrustedStrongRepositorySnapshotV1,
} from "@understand-code/contracts";
import { canonicalizeJson } from "@understand-code/contracts";
import { ToolFailure } from "../src/errors/tool-errors.js";
import { refreshIndex as refreshIndexHandler } from "../src/handlers/refresh-index.js";

const refreshIndex = (
  input: unknown,
  root: string,
  installationRoot?: string,
) => refreshIndexHandler(input, root, installationRoot, installationRoot);

const root = "/srv/repository";
const installationRoot = "/opt/understand-code";
const headCommit = "a".repeat(40);
const digest = "sha256:" + "b".repeat(64);
const repositoryId = "repo-hmac-" + "1".repeat(64);
const worktreeId = "worktree-hmac-" + "2".repeat(64);
const rootIdentity = "root-hmac-" + "3".repeat(64);
function rawCanonicalDigest(value: string): string {
  return "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");
}

function latestProviderCut(): any {
  const authority = sideEffects.providerRefreshAuthority;
  const stored = sideEffects.providerObjects.get(
    authority.cutObject.contentDigest,
  );
  if (stored === undefined) throw new Error("latest Provider cut is missing");
  return JSON.parse(
    Buffer.from(stored.bytes.slice("base64url:".length), "base64url")
      .toString("utf8"),
  );
}

function capture(overrides: Record<string, unknown> = {}) {
  return {
    canonicalRoot: root,
    snapshot: {
      schemaVersion: 1,
      snapshotId: "snapshot:legacy",
      repositoryId: "repository:legacy",
      worktreeId: "worktree:legacy",
      rootIdentity: "root:legacy",
      branch: "main",
      headCommit,
      baseCommit: headCommit,
      mergeBase: headCommit,
      indexDigest: digest,
      worktreeDigest: digest,
      untrackedDigest: digest,
      ignoreDigest: digest,
      createdAt: "2026-08-27T08:00:00.000Z",
      captureStatus: "complete",
      limitations: [],
      changes: [],
      ...overrides,
    },
    git: {
      branch: "main",
      detached: false,
      linkedWorktree: false,
      baselineCommit: headCommit,
      headCommit,
      mergeBase: headCommit,
      ahead: 0,
      behind: 0,
    },
    diagnostics: [],
  };
}

function missingArtifact(): Error {
  const ErrorType = sideEffects.ArtifactStoreError!;
  return new ErrorType("artifact_not_found", "missing");
}

function installStoreBehavior(): void {
  sideEffects.store.readManifest.mockImplementation(async () => {
    if (!sideEffects.manifestExists) throw missingArtifact();
    return {
      schemaVersion: 1,
      repositoryId,
      worktreeId,
      status: sideEffects.savedSnapshot === undefined ? "cold" : "ready",
      producerVersion: "0.1.0",
      updatedAt: "2026-08-27T08:00:00.000Z",
      reasons: [],
      artifacts: [],
      ...(sideEffects.savedSnapshot === undefined
        ? {}
        : {
            latestSnapshotId:
              (sideEffects.savedSnapshot as any).sourceSnapshotId,
          }),
    };
  });
  sideEffects.store.initialize.mockImplementation(async () => {
    sideEffects.manifestExists = true;
    return {
      schemaVersion: 1,
      repositoryId,
      worktreeId,
      status: "cold",
      producerVersion: "0.1.0",
      updatedAt: "2026-08-27T08:00:00.000Z",
      reasons: ["cold"],
      artifacts: [],
    };
  });
  sideEffects.store.readArtifact.mockImplementation(
    async (artifactType: string) => {
      const artifact = artifactType === "repository_snapshot"
        ? sideEffects.savedSnapshot
        : sideEffects.savedPulse;
      if (artifact === undefined) throw missingArtifact();
      return { artifact };
    },
  );
  sideEffects.store.persistArtifact.mockImplementation(async (artifact) => {
    if (sideEffects.failNextPersist) {
      sideEffects.failNextPersist = false;
      throw new Error("simulated_local_crash");
    }
    if (
      artifact.artifactType === "repo_pulse" &&
      sideEffects.failNextPulsePersist
    ) {
      sideEffects.failNextPulsePersist = false;
      throw new Error("simulated_local_pulse_crash");
    }
    if (artifact.artifactType === "repository_snapshot") {
      sideEffects.savedSnapshot = artifact;
    } else {
      sideEffects.savedPulse = artifact;
    }
    return { artifact, descriptor: {}, replayed: false };
  });
}

function installProviderBehavior(): void {
  sideEffects.provider.inspectState.mockImplementation(async () => ({
    revision: sideEffects.providerRevision,
  }));
  sideEffects.provider.inspectBusinessHead.mockImplementation(async () => ({
    profile: "journal",
    revision: sideEffects.providerRevision,
    phase: sideEffects.providerHead.phase,
    operationNonce: sideEffects.providerHead.operationNonce,
    mutationDigest: sideEffects.providerRevision === 0 ? "none" : digest,
    artifacts: sideEffects.providerHead.artifacts,
  }));
  sideEffects.provider.writeExactObject.mockImplementation(async (input) => {
    sideEffects.providerObjects.set(input.locator.contentDigest, input);
    return {
      operation: "write_object",
      resolution: "committed",
      locator: input.locator,
      logicalBytes: input.logicalBytes,
      verifiedContentDigest: input.locator.contentDigest,
    };
  });
  sideEffects.provider.readExactObject.mockImplementation(async (locator) => {
    const value = sideEffects.providerObjects.get(locator.contentDigest);
    if (value === undefined) throw new Error("provider_object_missing");
    return {
      operation: "read_object",
      locator: value.locator,
      logicalBytes: value.logicalBytes,
      bytes: value.bytes,
      verifiedContentDigest: value.locator.contentDigest,
    };
  });
  sideEffects.provider.compareCommit.mockImplementation(async (input) => {
    const prior = sideEffects.providerRecords.get(input.operationNonce);
    if (prior !== undefined) {
      return {
        operation: "compare_commit",
        resolution: "replayed",
        state: { profile: "journal", ...prior },
      };
    }
    if (input.expectedRevision !== sideEffects.providerRevision) {
      return {
        operation: "compare_commit",
        resolution: "stale",
        state: {
          profile: "journal",
          revision: sideEffects.providerRevision,
          phase: sideEffects.providerHead.phase,
          operationNonce: sideEffects.providerHead.operationNonce,
          mutationDigest: sideEffects.providerRevision === 0 ? "none" : digest,
          artifacts: sideEffects.providerHead.artifacts,
        },
      };
    }
    sideEffects.providerRevision += 1;
    const record = {
      revision: sideEffects.providerRevision,
      phase: input.phase,
      operationNonce: input.operationNonce,
      mutationDigest: digest,
      artifacts: input.artifacts,
    };
    sideEffects.providerRecords.set(input.operationNonce, record);
    sideEffects.providerHead = {
      phase: input.phase,
      operationNonce: input.operationNonce,
      artifacts: input.artifacts,
    };
    return {
      operation: "compare_commit",
      resolution: "committed",
      state: { profile: "journal", ...record },
    };
  });
  sideEffects.provider.compareCommitIndexPublication.mockImplementation(async (input) => {
    const result = await sideEffects.provider.compareCommit(input);
    if (result.resolution !== "stale") {
      sideEffects.providerIndexAuthority = {
        ...input.authority,
        finalizedProviderRevision: result.state.revision,
      };
    }
    return result;
  });
  sideEffects.provider.inspectIndexPublicationAuthority.mockImplementation(
    async () => sideEffects.providerIndexAuthority,
  );
  sideEffects.provider.inspectStrongRefreshAuthority.mockImplementation(
    async () => ({
      authority: sideEffects.providerRefreshAuthority,
      observedProviderRevision: sideEffects.providerRevision,
    }),
  );
  sideEffects.provider.compareCommitRefreshPublication.mockImplementation(
    async (input) => {
      const result = await sideEffects.provider.compareCommit(input);
      if (result.resolution === "committed") {
        sideEffects.providerRefreshAuthority = {
          ...input.refreshAuthority,
          finalizedProviderRevision: result.state.revision,
        };
        if (input.indexPublicationAuthority !== undefined) {
          sideEffects.providerIndexAuthority = {
            ...input.indexPublicationAuthority,
            finalizedProviderRevision: result.state.revision,
          };
        }
      }
      return result;
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sideEffects.providerRevision = 0;
  sideEffects.providerIndexAuthority = undefined;
  sideEffects.providerRefreshAuthority = undefined;
  sideEffects.providerHead = {
    phase: "strong_business_uninitialized_v1",
    operationNonce: "none",
    artifacts: {},
  };
  sideEffects.providerRecords.clear();
  sideEffects.providerObjects.clear();
  sideEffects.manifestExists = false;
  sideEffects.savedSnapshot = undefined;
  sideEffects.savedPulse = undefined;
  sideEffects.failNextPersist = false;
  sideEffects.failNextPulsePersist = false;

  sideEffects.openStore.mockResolvedValue(sideEffects.store);
  sideEffects.openActiveRepositoryIndexV1.mockImplementation(async () => ({
    generation: {
      generationId: sideEffects.providerIndexAuthority.generationId,
      generationManifestDigest: sideEffects.providerIndexAuthority.generationManifestDigest,
      sourceInventoryDigest: sideEffects.providerIndexAuthority.sourceInventoryDigest,
    },
    authority: {
      sourceSnapshotId: sideEffects.providerIndexAuthority.sourceSnapshotId,
      finalizedProviderRevision: sideEffects.providerIndexAuthority.finalizedProviderRevision,
    },
  }));
  sideEffects.openProvider.mockResolvedValue(sideEffects.provider);
  sideEffects.bootstrapSafeGit.mockResolvedValue({
    capability: sideEffects.capability,
  });
  sideEffects.capability.bindRepositoryIdentity.mockResolvedValue({
    repositoryId,
    worktreeId,
    rootIdentity,
    objectFormat: "sha1",
  });
  sideEffects.capability.revalidate.mockResolvedValue({
    profile: "descriptor-bound-safe-git-version-probe-v1",
    objectFormat: "sha1",
    gitVersion: { major: 2, minor: 51, patch: 0 },
  });
  sideEffects.captureSafeGit.mockResolvedValue(capture());
  sideEffects.createLayeredSession.mockReturnValue({
    profile: "safe_git_layered_content_read_session_v1",
  });
  sideEffects.capability.createReadExecutor.mockReturnValue({
    execute: vi.fn(),
  });
  sideEffects.readLayeredSource.mockImplementation(
    async (_executor, _headCommit, change) =>
      change.kind === "deleted"
        ? {
            status: "absent",
            path: change.path,
            source: change.source,
            layer: change.source === "committed" ? "head_tree" : "index",
          }
        : {
            status: "content",
            path: change.path,
            source: change.source,
            layer: change.source === "committed" ? "head_tree" : "index",
            mode: "100644",
            objectId: "d".repeat(40),
            bytes: Buffer.from("safe\n", "utf8"),
          },
  );
  sideEffects.readStableFile.mockResolvedValue(Buffer.from("safe\n", "utf8"));
  sideEffects.preflightIndex.mockResolvedValue({
    sourceInventoryDigest: digest,
    sourceFileCount: 1,
  });
  sideEffects.buildRepositoryIndex.mockResolvedValue({
    generation: {
      generationId: "generation-" + "5".repeat(64),
      generationManifestDigest: "sha256:" + "6".repeat(64),
      sourceInventoryDigest: digest,
    },
    publication: { manifestBytes: Buffer.from("{}"), files: [] },
  });
  sideEffects.publishStagedRepositoryIndex.mockImplementation(
    async (input) => input.publishStoreCut(),
  );
  sideEffects.publishIncrementalStrongCutV1.mockImplementation(
    async (input) => input.publishStoreCut(),
  );
  sideEffects.provider.commitOwnerOnlyState.mockImplementation(
    async (domain, value) =>
      `hmac-sha256:${createHash("sha256")
        .update(domain, "utf8")
        .update("\0", "utf8")
        .update(value, "utf8")
        .digest("hex")}`,
  );
  installStoreBehavior();
  installProviderBehavior();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("refreshIndex production strong writer", () => {
  it("keeps the legacy path locked without an explicit selector and creates no state", async () => {
    const temporaryRoot = await mkdtemp(
      path.join(tmpdir(), "understand-code-refresh-lock-"),
    );
    const entriesBefore = await readdir(temporaryRoot);
    try {
      await expect(refreshIndex({
        mode: "full",
        idempotencyKey: "refresh-lock-test",
        actor: "agent:cli-test",
      }, temporaryRoot)).rejects.toBeInstanceOf(ToolFailure);
      expect(sideEffects.openProvider).not.toHaveBeenCalled();
      expect(sideEffects.legacyCapture).not.toHaveBeenCalled();
      expect(sideEffects.openStore).not.toHaveBeenCalled();
      expect(await readdir(temporaryRoot)).toEqual(entriesBefore);
      await expect(
        access(path.join(temporaryRoot, ".understand-code")),
      ).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(temporaryRoot, { force: true, recursive: true });
    }
  });

  it("publishes an ID-recomputed strong Snapshot/Pulse only after Provider authority", async () => {
    const result = await refreshIndex({
      mode: "incremental",
      idempotencyKey: "refresh-strong-test",
      actor: "agent:cli-test",
    }, root, installationRoot) as any;

    expect(result.isError).toBe(false);
    expect(result.structuredContent.meta.repositoryId).toBe(repositoryId);
    expect(sideEffects.openProvider).toHaveBeenCalledWith({
      canonicalInstallationRoot: installationRoot,
    });
    expect(sideEffects.capability.close).toHaveBeenCalledOnce();
    expect(sideEffects.provider.close).toHaveBeenCalledOnce();
    expect(sideEffects.provider.commitOwnerOnlyState.mock.calls.map(
      ([domain]) => domain,
    )).toEqual([
      "repository-index-state-v1",
      "repository-worktree-state-v1",
      "repository-untracked-state-v1",
      "repository-ignore-state-v1",
      "repository-state-semantic-v1",
    ]);
    expect(sideEffects.provider.writeExactObject).toHaveBeenCalledOnce();
    const providerCommit = sideEffects.provider.compareCommit.mock.calls.find(
      ([input]) => input.expectedRevision === 0,
    )![0];
    expect(providerCommit.phase).toBe("strong_refresh_index_v1");
    expect(providerCommit.artifacts).toMatchObject({
      operation: "refresh_index",
      mode: "incremental",
    });
    expect(sideEffects.store.initialize).toHaveBeenCalledOnce();
    expect(sideEffects.store.persistArtifact).toHaveBeenCalledTimes(2);
    expect(
      sideEffects.provider.compareCommit.mock.invocationCallOrder.at(-1),
    ).toBeLessThan(
      sideEffects.store.initialize.mock.invocationCallOrder[0]!,
    );

    const snapshotArtifact = sideEffects.savedSnapshot as any;
    const pulseArtifact = sideEffects.savedPulse as any;
    expect(snapshotArtifact.payload.profile).toBe(
      "repository_snapshot_path_safe_v1",
    );
    expect(snapshotArtifact.payload.snapshotId).toMatch(/^snapshot-[0-9a-f]{64}$/u);
    expect(snapshotArtifact.payload.repositoryId).toBe(repositoryId);
    expect(snapshotArtifact.payload.indexToken).toMatch(
      /^hmac-sha256:[0-9a-f]{64}$/u,
    );
    expect(snapshotArtifact.payload).not.toHaveProperty("indexDigest");
    expect(pulseArtifact.payload.profile).toBe("repo_pulse_path_safe_v1");
    expect(pulseArtifact.payload.evaluatedSnapshotId).toBe(
      snapshotArtifact.payload.snapshotId,
    );
    parseTrustedStrongRepositorySnapshotV1(
      snapshotArtifact.payload,
      rawCanonicalDigest,
    );
    parseTrustedStrongRepoPulseV1(
      pulseArtifact.payload,
      snapshotArtifact.payload,
      rawCanonicalDigest,
    );
  });

  it("uses the last published commit as the next refresh baseline and never false-cleans committed changes", async () => {
    await refreshIndex({
      mode: "incremental",
      idempotencyKey: "refresh-committed-baseline-initial",
      actor: "agent:cli-test",
    }, root, installationRoot);
    const publishedBefore = sideEffects.savedSnapshot;
    const providerCommitsBefore = sideEffects.provider.compareCommit.mock.calls.length;
    const nextHeadCommit = "c".repeat(40);
    const committedCapture = capture({
      headCommit: nextHeadCommit,
      baseCommit: headCommit,
      mergeBase: headCommit,
      changes: [{
        id: "change:committed-after-baseline",
        path: "src/committed.ts",
        source: "committed",
        kind: "added",
      }],
    });
    committedCapture.git = {
      ...committedCapture.git,
      baselineCommit: headCommit,
      headCommit: nextHeadCommit,
      mergeBase: headCommit,
      ahead: 1,
    };
    const falseCleanCapture = capture({
      headCommit: nextHeadCommit,
      baseCommit: nextHeadCommit,
      mergeBase: nextHeadCommit,
      changes: [],
    });
    falseCleanCapture.git = {
      ...falseCleanCapture.git,
      baselineCommit: nextHeadCommit,
      headCommit: nextHeadCommit,
      mergeBase: nextHeadCommit,
      ahead: 0,
    };
    sideEffects.captureSafeGit.mockClear();
    sideEffects.readLayeredSource.mockClear();
    sideEffects.readStableFile.mockClear();
    sideEffects.captureSafeGit.mockImplementation(
      async (_root, _capability, options) =>
        options?.baselineRef === headCommit
          ? committedCapture
          : falseCleanCapture,
    );

    const result = await refreshIndex({
      mode: "incremental",
      idempotencyKey: "refresh-committed-baseline-next",
      actor: "agent:cli-test",
    }, root, installationRoot) as any;

    expect(result.isError).toBe(false);
    expect(sideEffects.captureSafeGit).toHaveBeenCalledTimes(2);
    expect(sideEffects.captureSafeGit).toHaveBeenNthCalledWith(
      1,
      root,
      sideEffects.capability,
      { baselineRef: headCommit },
    );
    expect(sideEffects.captureSafeGit).toHaveBeenNthCalledWith(
      2,
      root,
      sideEffects.capability,
      { baselineRef: headCommit },
    );
    expect(sideEffects.provider.compareCommit).toHaveBeenCalledTimes(
      providerCommitsBefore + 1,
    );
    expect(sideEffects.savedSnapshot).not.toBe(publishedBefore);
    expect((sideEffects.savedSnapshot as any).payload.changes).toEqual([
      expect.objectContaining({
        path: "src/committed.ts",
        source: "committed",
        kind: "added",
      }),
    ]);
    expect((sideEffects.savedPulse as any).payload.changeSummary.bySource.committed)
      .toBe(1);
    expect(sideEffects.readLayeredSource).toHaveBeenCalledOnce();
    expect(sideEffects.createLayeredSession).toHaveBeenCalledWith(
      expect.any(Object),
      {
        maxMetadataBytes: 64 * 1024 * 1024,
        maxBlobBytes: 64 * 1024 * 1024,
        maxCommands: 16_384,
      },
    );
    expect(sideEffects.readLayeredSource).toHaveBeenCalledWith(
      expect.any(Object),
      nextHeadCommit,
      expect.objectContaining({
        path: "src/committed.ts",
        source: "committed",
      }),
      expect.objectContaining({ maxBytes: 64 * 1024 * 1024 }),
    );
    expect(sideEffects.readStableFile).not.toHaveBeenCalled();
  });

  it("binds staged layered reads to the Snapshot content digest", async () => {
    const stagedContentDigest = rawCanonicalDigest("safe\n");
    sideEffects.captureSafeGit.mockResolvedValue(capture({
      changes: [{
        id: "change:staged-digest-bound",
        path: "src/staged.ts",
        source: "staged",
        kind: "modified",
        contentDigest: stagedContentDigest,
      }],
    }));

    const result = await refreshIndex({
      mode: "incremental",
      idempotencyKey: "refresh-staged-digest-bound",
      actor: "agent:cli-test",
    }, root, installationRoot) as any;

    expect(result.isError).toBe(false);
    expect(sideEffects.readLayeredSource).toHaveBeenCalledWith(
      expect.any(Object),
      headCommit,
      expect.objectContaining({ source: "staged" }),
      expect.objectContaining({
        expectedContentDigest: stagedContentDigest,
        session: expect.objectContaining({
          profile: "safe_git_layered_content_read_session_v1",
        }),
      }),
    );
  });

  it("ignores an older legitimate local cut and captures from the latest Provider refresh authority", async () => {
    await refreshIndex({
      mode: "incremental",
      idempotencyKey: "refresh-authority-chain-a",
      actor: "agent:cli-test",
    }, root, installationRoot);
    const localSnapshotA = sideEffects.savedSnapshot;
    const localPulseA = sideEffects.savedPulse;
    const headB = "c".repeat(40);
    const committedB = capture({
      headCommit: headB,
      baseCommit: headCommit,
      mergeBase: headCommit,
      changes: [{
        id: "change:authority-chain-b",
        path: "src/authority-b.ts",
        source: "committed",
        kind: "added",
      }],
    });
    committedB.git = {
      ...committedB.git,
      baselineCommit: headCommit,
      headCommit: headB,
      mergeBase: headCommit,
      ahead: 1,
    };
    sideEffects.captureSafeGit.mockResolvedValue(committedB);
    await refreshIndex({
      mode: "incremental",
      idempotencyKey: "refresh-authority-chain-b",
      actor: "agent:cli-test",
    }, root, installationRoot);
    const authorityB = sideEffects.providerRefreshAuthority;
    const providerPulseRevisionB = latestProviderCut().pulseArtifact.revision;
    expect(authorityB.snapshotId).toBe(
      (sideEffects.savedSnapshot as any).payload.snapshotId,
    );
    expect(providerPulseRevisionB).toBe(1);

    sideEffects.savedSnapshot = localSnapshotA;
    sideEffects.savedPulse = localPulseA;
    const cleanAtB = capture({
      headCommit: headB,
      baseCommit: headB,
      mergeBase: headB,
      changes: [],
    });
    cleanAtB.git = {
      ...cleanAtB.git,
      baselineCommit: headB,
      headCommit: headB,
      mergeBase: headB,
      ahead: 0,
    };
    sideEffects.captureSafeGit.mockClear();
    sideEffects.captureSafeGit.mockResolvedValue(cleanAtB);

    const result = await refreshIndex({
      mode: "incremental",
      idempotencyKey: "refresh-authority-chain-c",
      actor: "agent:cli-test",
    }, root, installationRoot) as any;

    expect(result.isError).toBe(false);
    expect(sideEffects.captureSafeGit).toHaveBeenNthCalledWith(
      1,
      root,
      sideEffects.capability,
      { baselineRef: headB },
    );
    expect(sideEffects.providerRefreshAuthority.previous).toEqual({
      snapshotId: authorityB.snapshotId,
      finalizedProviderRevision: authorityB.finalizedProviderRevision,
    });
    expect(latestProviderCut().pulseArtifact.revision).toBe(
      providerPulseRevisionB + 1,
    );
    expect((sideEffects.savedPulse as any).revision).toBe(
      (localPulseA as any).revision + 1,
    );
  });

  it("recovers a cold local Store from the latest Provider refresh authority", async () => {
    await refreshIndex({
      mode: "incremental",
      idempotencyKey: "refresh-provider-cold-recovery-a",
      actor: "agent:cli-test",
    }, root, installationRoot);
    const headB = "c".repeat(40);
    const captureB = capture({
      headCommit: headB,
      baseCommit: headCommit,
      mergeBase: headCommit,
      changes: [{
        id: "change:cold-recovery-b",
        path: "src/cold-b.ts",
        source: "committed",
        kind: "added",
      }],
    });
    captureB.git = {
      ...captureB.git,
      baselineCommit: headCommit,
      headCommit: headB,
      mergeBase: headCommit,
      ahead: 1,
    };
    sideEffects.captureSafeGit.mockResolvedValue(captureB);
    await refreshIndex({
      mode: "incremental",
      idempotencyKey: "refresh-provider-cold-recovery-b",
      actor: "agent:cli-test",
    }, root, installationRoot);
    const providerPulseRevisionB = latestProviderCut().pulseArtifact.revision;
    expect(providerPulseRevisionB).toBe(1);

    sideEffects.manifestExists = false;
    sideEffects.savedSnapshot = undefined;
    sideEffects.savedPulse = undefined;
    const headC = "d".repeat(40);
    const captureC = capture({
      headCommit: headC,
      baseCommit: headB,
      mergeBase: headB,
      changes: [{
        id: "change:cold-recovery-c",
        path: "src/cold-c.ts",
        source: "committed",
        kind: "added",
      }],
    });
    captureC.git = {
      ...captureC.git,
      baselineCommit: headB,
      headCommit: headC,
      mergeBase: headB,
      ahead: 1,
    };
    sideEffects.captureSafeGit.mockClear();
    sideEffects.captureSafeGit.mockResolvedValue(captureC);

    const result = await refreshIndex({
      mode: "incremental",
      idempotencyKey: "refresh-provider-cold-recovery-c",
      actor: "agent:cli-test",
    }, root, installationRoot) as any;

    expect(result.isError).toBe(false);
    expect(sideEffects.captureSafeGit).toHaveBeenNthCalledWith(
      1,
      root,
      sideEffects.capability,
      { baselineRef: headB },
    );
    expect(latestProviderCut().pulseArtifact.revision).toBe(
      providerPulseRevisionB + 1,
    );
    expect((sideEffects.savedPulse as any).revision).toBe(0);
  });

  it("fails closed when the manifest baseline artifact is missing", async () => {
    await refreshIndex({
      mode: "incremental",
      idempotencyKey: "refresh-missing-baseline-initial",
      actor: "agent:cli-test",
    }, root, installationRoot);
    const manifest = await sideEffects.store.readManifest();
    sideEffects.savedSnapshot = undefined;
    sideEffects.store.readManifest.mockResolvedValue(manifest);
    sideEffects.captureSafeGit.mockClear();

    await expect(refreshIndex({
      mode: "incremental",
      idempotencyKey: "refresh-missing-baseline-next",
      actor: "agent:cli-test",
    }, root, installationRoot)).rejects.toThrow(
      "Published refresh baseline Snapshot is unavailable or not strong",
    );

    expect(sideEffects.captureSafeGit).not.toHaveBeenCalled();
  });

  it("fails closed when the manifest baseline is a legacy non-strong Snapshot", async () => {
    await refreshIndex({
      mode: "incremental",
      idempotencyKey: "refresh-legacy-baseline-initial",
      actor: "agent:cli-test",
    }, root, installationRoot);
    const published = sideEffects.savedSnapshot as any;
    const legacyPayload = capture().snapshot;
    sideEffects.savedSnapshot = {
      ...published,
      artifactId: "artifact:repository-snapshot:snapshot:legacy",
      repositoryId: legacyPayload.repositoryId,
      worktreeId: legacyPayload.worktreeId,
      sourceSnapshotId: legacyPayload.snapshotId,
      createdAt: legacyPayload.createdAt,
      contentDigest: rawCanonicalDigest(canonicalizeJson(legacyPayload)),
      payload: legacyPayload,
    };
    sideEffects.captureSafeGit.mockClear();

    await expect(refreshIndex({
      mode: "incremental",
      idempotencyKey: "refresh-legacy-baseline-next",
      actor: "agent:cli-test",
    }, root, installationRoot)).rejects.toThrow(
      "Published refresh baseline Snapshot is unavailable or not strong",
    );

    expect(sideEffects.captureSafeGit).not.toHaveBeenCalled();
  });

  it("rejects a local Snapshot/Pulse pair that conflicts while Provider authority remains valid", async () => {
    await refreshIndex({
      mode: "incremental",
      idempotencyKey: "refresh-forged-baseline-initial",
      actor: "agent:cli-test",
    }, root, installationRoot);
    const published = sideEffects.savedSnapshot as any;
    const draft = {
      ...published.payload,
      snapshotId: `snapshot-${"0".repeat(64)}`,
      headState: { kind: "commit", commit: "d".repeat(40) },
    };
    const forgedPayload = {
      ...draft,
      snapshotId: derivePathSafeRepositorySnapshotIdV1(
        draft,
        rawCanonicalDigest,
      ),
    };
    sideEffects.savedSnapshot = {
      ...published,
      artifactId: `artifact:repository-snapshot:${forgedPayload.snapshotId}`,
      sourceSnapshotId: forgedPayload.snapshotId,
      contentDigest: rawCanonicalDigest(canonicalizeJson(forgedPayload)),
      payload: forgedPayload,
    };
    sideEffects.captureSafeGit.mockClear();

    await expect(refreshIndex({
      mode: "incremental",
      idempotencyKey: "refresh-forged-baseline-next",
      actor: "agent:cli-test",
    }, root, installationRoot)).rejects.toThrow(
      "Published local refresh Pulse does not match its Snapshot",
    );

    expect(sideEffects.captureSafeGit).not.toHaveBeenCalled();
  });

  it("refuses a cold local Store when the Provider head cannot authenticate its baseline", async () => {
    sideEffects.providerRevision = 1;
    sideEffects.providerHead = {
      phase: "concurrent_business_phase_v1",
      operationNonce: "concurrent-operation",
      artifacts: { schemaVersion: 1, operation: "concurrent_write" },
    };

    await expect(refreshIndex({
      mode: "incremental",
      idempotencyKey: "refresh-read-only-head",
      actor: "agent:cli-test",
    }, root, installationRoot)).rejects.toThrow(
      "A cold local Store has no matching authenticated Provider recovery cut",
    );

    expect(sideEffects.provider.compareCommit).not.toHaveBeenCalled();
    expect(sideEffects.provider.compareCommit.mock.calls.some(
      ([request]) => request.artifacts.operation === "refresh_index_probe",
    )).toBe(false);
    expect(sideEffects.providerRevision).toBe(1);
  });

  it("preflights the complete full-index corpus before Provider writes", async () => {
    await refreshIndex({
      mode: "full",
      idempotencyKey: "refresh-full-test",
      actor: "agent:cli-test",
    }, root, installationRoot);

    expect(sideEffects.preflightIndex).toHaveBeenCalledWith(root);
    const preflightOrder = sideEffects.preflightIndex.mock.invocationCallOrder[0]!;
    expect(sideEffects.captureSafeGit.mock.invocationCallOrder[0]).toBeLessThan(
      preflightOrder,
    );
    expect(preflightOrder).toBeLessThan(
      sideEffects.captureSafeGit.mock.invocationCallOrder[1]!,
    );
    expect(preflightOrder).toBeLessThan(
      sideEffects.buildRepositoryIndex.mock.invocationCallOrder[0]!,
    );
    expect(sideEffects.buildRepositoryIndex).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalRoot: root,
        canonicalInstallationRoot: installationRoot,
        operationId: expect.stringMatching(/^[0-9a-f]{32}$/u),
        expectedSourceInventoryDigest: digest,
        snapshot: expect.objectContaining({
          profile: "repository_snapshot_path_safe_v1",
        }),
      }),
    );
    const prepared = sideEffects.provider.compareCommit.mock.calls.find(
      ([input]) => input.artifacts.operation === "refresh_index_prepared",
    )!;
    const finalized = sideEffects.provider.compareCommit.mock.calls.find(
      ([input]) => input.artifacts.operation === "refresh_index",
    )!;
    expect(prepared).toBeDefined();
    expect(finalized).toBeDefined();
    expect(prepared[0].expectedRevision).toBe(0);
    expect(finalized[0].expectedRevision).toBe(1);
    expect(prepared[0].artifacts).toMatchObject({
      indexGenerationId: "generation-" + "5".repeat(64),
      indexGenerationManifestDigest: "sha256:" + "6".repeat(64),
      indexSourceInventoryDigest: digest,
    });
    expect(finalized[0].artifacts).toMatchObject({
      indexGenerationId: "generation-" + "5".repeat(64),
      indexGenerationManifestDigest: "sha256:" + "6".repeat(64),
      indexSourceInventoryDigest: digest,
    });
    expect(
      sideEffects.buildRepositoryIndex.mock.invocationCallOrder[0],
    ).toBeLessThan(
      sideEffects.provider.compareCommit.mock.invocationCallOrder[
        sideEffects.provider.compareCommit.mock.calls.indexOf(prepared)
      ]!,
    );
    expect(
      sideEffects.buildRepositoryIndex.mock.invocationCallOrder[0],
    ).toBeLessThan(
      sideEffects.provider.compareCommit.mock.invocationCallOrder[
        sideEffects.provider.compareCommit.mock.calls.indexOf(finalized)
      ]!,
    );
    expect(
      sideEffects.provider.compareCommit.mock.invocationCallOrder[
        sideEffects.provider.compareCommit.mock.calls.indexOf(finalized)
      ],
    ).toBeLessThan(
      sideEffects.publishStagedRepositoryIndex.mock.invocationCallOrder[0]!,
    );
    expect(sideEffects.discardStagedRepositoryIndex).toHaveBeenCalledAfter(
      sideEffects.publishStagedRepositoryIndex,
    );
  });

  it("keeps the canonical index unchanged when full finalization loses its CAS", async () => {
    let canonicalIndex = "old-authoritative-index";
    sideEffects.publishStagedRepositoryIndex.mockImplementation(async () => {
      canonicalIndex = "new-index";
    });
    const compareCommit = sideEffects.provider.compareCommit.getMockImplementation()!;
    sideEffects.provider.compareCommit.mockImplementation(async (input) => {
      if (input.artifacts.operation === "refresh_index") {
        sideEffects.providerRevision += 1;
        sideEffects.providerHead = {
          phase: "concurrent_business_phase_v1",
          operationNonce: "concurrent-operation",
          artifacts: { schemaVersion: 1, operation: "concurrent_write" },
        };
        return {
          operation: "compare_commit",
          resolution: "stale",
          state: {
            profile: "journal",
            revision: sideEffects.providerRevision,
            phase: sideEffects.providerHead.phase,
            operationNonce: sideEffects.providerHead.operationNonce,
            mutationDigest: digest,
            artifacts: sideEffects.providerHead.artifacts,
          },
        };
      }
      return await compareCommit(input);
    });

    await expect(refreshIndex({
      mode: "full",
      idempotencyKey: "refresh-finalize-cas-stale",
      actor: "agent:cli-test",
    }, root, installationRoot)).rejects.toThrow(
      "Provider refresh finalization did not publish the exact full cut",
    );

    expect(sideEffects.buildRepositoryIndex).toHaveBeenCalledOnce();
    expect(sideEffects.publishStagedRepositoryIndex).not.toHaveBeenCalled();
    expect(sideEffects.discardStagedRepositoryIndex).toHaveBeenCalledOnce();
    expect(canonicalIndex).toBe("old-authoritative-index");
    expect(sideEffects.store.initialize).not.toHaveBeenCalled();
    expect(sideEffects.store.persistArtifact).not.toHaveBeenCalled();
  });

  it("keeps an incremental capture bound to its pre-scan Provider revision", async () => {
    const compareRefresh = sideEffects.provider.compareCommitRefreshPublication
      .getMockImplementation()!;
    sideEffects.provider.compareCommitRefreshPublication.mockImplementationOnce(
      async (input) => {
        sideEffects.providerRevision += 1;
        sideEffects.providerHead = {
          phase: "concurrent_business_phase_v1",
          operationNonce: "concurrent-after-capture",
          artifacts: { schemaVersion: 1, operation: "concurrent_write" },
        };
        return await compareRefresh(input);
      },
    );

    await expect(refreshIndex({
      mode: "incremental",
      idempotencyKey: "refresh-fixed-observation-cas",
      actor: "agent:cli-test",
    }, root, installationRoot)).rejects.toThrow(
      "Provider refresh compare-commit did not publish the exact cut",
    );

    expect(sideEffects.provider.compareCommitRefreshPublication)
      .toHaveBeenCalledOnce();
    expect(
      sideEffects.provider.compareCommitRefreshPublication.mock.calls[0]![0]
        .expectedRevision,
    ).toBe(0);
    expect(sideEffects.store.initialize).not.toHaveBeenCalled();
    expect(sideEffects.store.persistArtifact).not.toHaveBeenCalled();
  });

  it("does not rebase full finalization over a head changed before its fixed CAS", async () => {
    const compareRefresh = sideEffects.provider.compareCommitRefreshPublication
      .getMockImplementation()!;
    sideEffects.provider.compareCommitRefreshPublication.mockImplementationOnce(
      async (input) => {
        sideEffects.providerRevision += 1;
        sideEffects.providerHead = {
          phase: "concurrent_business_phase_v1",
          operationNonce: "concurrent-before-finalize",
          artifacts: { schemaVersion: 1, operation: "concurrent_write" },
        };
        return await compareRefresh(input);
      },
    );

    await expect(refreshIndex({
      mode: "full",
      idempotencyKey: "refresh-no-finalize-rebase",
      actor: "agent:cli-test",
    }, root, installationRoot)).rejects.toThrow(
      "Provider refresh finalization did not publish the exact full cut",
    );

    expect(sideEffects.provider.compareCommit).toHaveBeenCalledTimes(2);
    expect(sideEffects.provider.compareCommit.mock.calls[0]![0].artifacts)
      .toMatchObject({ operation: "refresh_index_prepared" });
    expect(sideEffects.publishStagedRepositoryIndex).not.toHaveBeenCalled();
    expect(sideEffects.discardStagedRepositoryIndex).toHaveBeenCalledOnce();
  });

  it("zero-publishes when full-corpus preflight is bracketed by repository drift", async () => {
    sideEffects.captureSafeGit
      .mockResolvedValueOnce(capture())
      .mockResolvedValueOnce(capture({
        worktreeDigest: "sha256:" + "c".repeat(64),
      }));

    await expect(refreshIndex({
      mode: "full",
      idempotencyKey: "refresh-preflight-drift",
      actor: "agent:cli-test",
    }, root, installationRoot)).rejects.toBeDefined();

    const preflightOrder = sideEffects.preflightIndex.mock.invocationCallOrder[0]!;
    expect(sideEffects.captureSafeGit.mock.invocationCallOrder[0]).toBeLessThan(
      preflightOrder,
    );
    expect(preflightOrder).toBeLessThan(
      sideEffects.captureSafeGit.mock.invocationCallOrder[1]!,
    );
    expect(sideEffects.provider.writeExactObject).not.toHaveBeenCalled();
    expect(sideEffects.provider.compareCommit).not.toHaveBeenCalled();
    expect(sideEffects.store.initialize).not.toHaveBeenCalled();
    expect(sideEffects.store.persistArtifact).not.toHaveBeenCalled();
  });

  it("does not prepare Provider authority when the full inventory changes", async () => {
    sideEffects.buildRepositoryIndex.mockRejectedValue(
      new sideEffects.RepositoryIndexError(
        "repository source inventory changed after index preflight",
      ),
    );

    await expect(refreshIndex({
      mode: "full",
      idempotencyKey: "refresh-build-drift",
      actor: "agent:cli-test",
    }, root, installationRoot)).rejects.toBeDefined();

    expect(sideEffects.providerRevision).toBe(0);
    expect(sideEffects.provider.writeExactObject).not.toHaveBeenCalled();
    expect(sideEffects.provider.compareCommit).not.toHaveBeenCalled();
    expect(sideEffects.discardStagedRepositoryIndex).toHaveBeenCalledOnce();
    expect(sideEffects.store.initialize).not.toHaveBeenCalled();
    expect(sideEffects.store.persistArtifact).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "partial or sensitive capture",
      arrange: () => {
        sideEffects.captureSafeGit.mockResolvedValue(capture({
          captureStatus: "partial",
          limitations: ["sensitive path excluded"],
        }));
      },
    },
    {
      name: "invalid UTF-8",
      arrange: () => {
        sideEffects.captureSafeGit.mockResolvedValue(capture({
          changes: [{
            id: "change:legacy",
            path: "src/invalid.ts",
            source: "untracked",
            kind: "added",
          }],
        }));
        sideEffects.readStableFile.mockResolvedValue(Buffer.from([0xff]));
      },
    },
    {
      name: "secret content",
      arrange: () => {
        sideEffects.captureSafeGit.mockResolvedValue(capture({
          changes: [{
            id: "change:legacy",
            path: "src/secret.ts",
            source: "untracked",
            kind: "added",
          }],
        }));
        sideEffects.readStableFile.mockResolvedValue(Buffer.from(
          "-----BEGIN PRIVATE KEY-----\n" +
            "A".repeat(96) +
            "\n-----END PRIVATE KEY-----\n",
          "utf8",
        ));
      },
    },
    {
      name: "secret content in the exact committed blob",
      arrange: () => {
        sideEffects.captureSafeGit.mockResolvedValue(capture({
          changes: [{
            id: "change:committed-secret",
            path: "src/committed-secret.ts",
            source: "committed",
            kind: "added",
          }],
        }));
        sideEffects.readLayeredSource.mockResolvedValue({
          status: "content",
          path: "src/committed-secret.ts",
          source: "committed",
          layer: "head_tree",
          mode: "100644",
          objectId: "d".repeat(40),
          bytes: Buffer.from(
            "-----BEGIN PRIVATE KEY-----\n" +
              "A".repeat(96) +
              "\n-----END PRIVATE KEY-----\n",
            "utf8",
          ),
        });
      },
    },
    {
      name: "staged content without an authenticated digest",
      arrange: () => {
        sideEffects.captureSafeGit.mockResolvedValue(capture({
          changes: [{
            id: "change:staged-missing-digest",
            path: "src/staged-missing-digest.ts",
            source: "staged",
            kind: "modified",
          }],
        }));
      },
    },
    {
      name: "changed path budget",
      arrange: () => {
        sideEffects.captureSafeGit.mockResolvedValue(capture({
          changes: Array.from({ length: 4_097 }, (_, index) => ({
            id: `change:path-budget-${index}`,
            path: `src/generated-${index}.ts`,
            source: "untracked",
            kind: "added",
          })),
        }));
      },
    },
    {
      name: "symlink or special changed source",
      arrange: () => {
        sideEffects.captureSafeGit.mockResolvedValue(capture({
          changes: [{
            id: "change:legacy",
            path: "src/link.ts",
            source: "untracked",
            kind: "added",
          }],
        }));
        sideEffects.readStableFile.mockRejectedValue(new Error("symlink"));
      },
    },
    {
      name: "capture drift",
      arrange: () => {
        sideEffects.captureSafeGit
          .mockResolvedValueOnce(capture())
          .mockResolvedValueOnce(capture({ worktreeDigest: "sha256:" + "c".repeat(64) }));
      },
    },
    {
      name: "unsafe full corpus",
      mode: "full" as const,
      arrange: () => {
        sideEffects.preflightIndex.mockRejectedValue(
          new sideEffects.RepositoryIndexError("special repository path"),
        );
      },
    },
  ])("fails $name with zero durable or local writes", async ({ arrange, mode }) => {
    arrange();
    await expect(refreshIndex({
      mode: mode ?? "incremental",
      idempotencyKey: "refresh-unsafe-test",
      actor: "agent:cli-test",
    }, root, installationRoot)).rejects.toBeDefined();

    expect(sideEffects.provider.writeExactObject).not.toHaveBeenCalled();
    expect(sideEffects.store.initialize).not.toHaveBeenCalled();
    expect(sideEffects.store.persistArtifact).not.toHaveBeenCalled();
    expect(sideEffects.buildRepositoryIndex).not.toHaveBeenCalled();
    expect(sideEffects.capability.close).toHaveBeenCalledOnce();
    expect(sideEffects.provider.close).toHaveBeenCalledOnce();
  });

  it("replays a finalized real-delta Provider cut without replacing it with the clean recapture", async () => {
    await refreshIndex({
      mode: "incremental",
      idempotencyKey: "refresh-crash-replay-baseline",
      actor: "agent:cli-test",
    }, root, installationRoot);
    const baselineSnapshotId =
      (sideEffects.savedSnapshot as any).payload.snapshotId;
    const nextHeadCommit = "c".repeat(40);
    const committedCapture = capture({
      headCommit: nextHeadCommit,
      baseCommit: headCommit,
      mergeBase: headCommit,
      changes: [{
        id: "change:crash-replay-delta",
        path: "src/crash-replay.ts",
        source: "committed",
        kind: "added",
      }],
    });
    committedCapture.git = {
      ...committedCapture.git,
      baselineCommit: headCommit,
      headCommit: nextHeadCommit,
      mergeBase: headCommit,
      ahead: 1,
    };
    sideEffects.captureSafeGit.mockResolvedValue(committedCapture);
    const input = {
      mode: "incremental" as const,
      idempotencyKey: "refresh-crash-replay",
      actor: "agent:cli-test",
      expectedSourceSnapshotId: baselineSnapshotId,
    };
    sideEffects.failNextPersist = true;
    await expect(
      refreshIndex(input, root, installationRoot),
    ).rejects.toThrow("simulated_local_crash");
    expect(sideEffects.providerRevision).toBe(2);
    expect((sideEffects.savedSnapshot as any).payload.changes).toEqual([]);

    sideEffects.captureSafeGit.mockClear();
    sideEffects.captureSafeGit.mockResolvedValue(capture({
      headCommit: nextHeadCommit,
      baseCommit: nextHeadCommit,
      mergeBase: nextHeadCommit,
      changes: [],
    }));
    const result = await refreshIndex(input, root, installationRoot) as any;
    expect(result.isError).toBe(false);
    expect(sideEffects.captureSafeGit).toHaveBeenCalledTimes(2);
    expect(sideEffects.captureSafeGit).toHaveBeenNthCalledWith(
      1,
      root,
      sideEffects.capability,
      { baselineRef: nextHeadCommit },
    );
    expect(sideEffects.providerRevision).toBe(2);
    expect((sideEffects.savedSnapshot as any).payload.changes).toEqual([
      expect.objectContaining({
        path: "src/crash-replay.ts",
        source: "committed",
        kind: "added",
      }),
    ]);
    expect((sideEffects.savedPulse as any).payload.changeSummary.bySource.committed)
      .toBe(1);
  });

  it("recovers the authenticated real-delta cut after a later Provider business commit", async () => {
    await refreshIndex({
      mode: "incremental",
      idempotencyKey: "refresh-intervening-head-baseline",
      actor: "agent:cli-test",
    }, root, installationRoot);
    const baselineSnapshotId =
      (sideEffects.savedSnapshot as any).payload.snapshotId;
    const nextHeadCommit = "c".repeat(40);
    const committedCapture = capture({
      headCommit: nextHeadCommit,
      baseCommit: headCommit,
      mergeBase: headCommit,
      changes: [{
        id: "change:intervening-head-delta",
        path: "src/intervening-head.ts",
        source: "committed",
        kind: "added",
      }],
    });
    committedCapture.git = {
      ...committedCapture.git,
      baselineCommit: headCommit,
      headCommit: nextHeadCommit,
      mergeBase: headCommit,
      ahead: 1,
    };
    sideEffects.captureSafeGit.mockResolvedValue(committedCapture);
    const input = {
      mode: "incremental" as const,
      idempotencyKey: "refresh-intervening-head-recovery",
      actor: "agent:cli-test",
      expectedSourceSnapshotId: baselineSnapshotId,
    };
    sideEffects.failNextPersist = true;
    await expect(refreshIndex(input, root, installationRoot)).rejects
      .toThrow("simulated_local_crash");
    expect(sideEffects.providerRevision).toBe(2);

    await sideEffects.provider.compareCommit({
      expectedRevision: 2,
      operationNonce: "intervening-provider-business-head",
      phase: "intervening_business_phase_v1",
      artifacts: { schemaVersion: 1, operation: "intervening_business_write" },
    });
    expect(sideEffects.providerRevision).toBe(3);
    sideEffects.captureSafeGit.mockResolvedValue(capture({
      headCommit: nextHeadCommit,
      baseCommit: nextHeadCommit,
      mergeBase: nextHeadCommit,
      changes: [],
    }));

    const result = await refreshIndex(input, root, installationRoot) as any;
    expect(result.isError).toBe(false);
    expect(sideEffects.providerRevision).toBe(3);
    expect((sideEffects.savedSnapshot as any).payload.changes).toEqual([
      expect.objectContaining({
        path: "src/intervening-head.ts",
        source: "committed",
        kind: "added",
      }),
    ]);
    expect((sideEffects.savedPulse as any).payload.changeSummary.bySource.committed)
      .toBe(1);
  });

  it("fails closed when recovered replay loses the latest refresh authority lease", async () => {
    await refreshIndex({
      mode: "incremental",
      idempotencyKey: "refresh-replay-lease-baseline",
      actor: "agent:cli-test",
    }, root, installationRoot);
    const nextHeadCommit = "c".repeat(40);
    const committedCapture = capture({
      headCommit: nextHeadCommit,
      baseCommit: headCommit,
      mergeBase: headCommit,
      changes: [{
        id: "change:replay-lease-delta",
        path: "src/replay-lease.ts",
        source: "committed",
        kind: "added",
      }],
    });
    committedCapture.git = {
      ...committedCapture.git,
      baselineCommit: headCommit,
      headCommit: nextHeadCommit,
      mergeBase: headCommit,
      ahead: 1,
    };
    sideEffects.captureSafeGit.mockResolvedValue(committedCapture);
    const input = {
      mode: "incremental" as const,
      idempotencyKey: "refresh-replay-lease-recovery",
      actor: "agent:cli-test",
    };
    sideEffects.failNextPersist = true;
    await expect(refreshIndex(input, root, installationRoot)).rejects
      .toThrow("simulated_local_crash");
    const persistedCallsBeforeRetry = sideEffects.store.persistArtifact.mock.calls.length;
    const compareCommit = sideEffects.provider.compareCommit.getMockImplementation()!;
    sideEffects.provider.compareCommit.mockImplementationOnce(async (request) => {
      const replay = await compareCommit(request);
      sideEffects.providerRevision += 1;
      sideEffects.providerHead = {
        phase: "concurrent_refresh_phase_v1",
        operationNonce: "concurrent-refresh-authority",
        artifacts: { schemaVersion: 1, operation: "concurrent_refresh" },
      };
      sideEffects.providerRefreshAuthority = {
        ...sideEffects.providerRefreshAuthority,
        finalizedProviderRevision: sideEffects.providerRevision,
      };
      return replay;
    });

    await expect(refreshIndex(input, root, installationRoot)).rejects.toThrow(
      "Provider refresh authority changed before local publication",
    );
    expect(sideEffects.store.persistArtifact.mock.calls.length)
      .toBe(persistedCallsBeforeRetry);
  });

  it("repairs a Snapshot-only local half-commit after a later Provider business commit", async () => {
    await refreshIndex({
      mode: "incremental",
      idempotencyKey: "refresh-pulse-crash-baseline",
      actor: "agent:cli-test",
    }, root, installationRoot);
    const baselineSnapshotId =
      (sideEffects.savedSnapshot as any).payload.snapshotId;
    const baselinePulse = sideEffects.savedPulse as any;
    const nextHeadCommit = "c".repeat(40);
    const committedCapture = capture({
      headCommit: nextHeadCommit,
      baseCommit: headCommit,
      mergeBase: headCommit,
      changes: [{
        id: "change:pulse-crash-delta",
        path: "src/pulse-crash.ts",
        source: "committed",
        kind: "added",
      }],
    });
    committedCapture.git = {
      ...committedCapture.git,
      baselineCommit: headCommit,
      headCommit: nextHeadCommit,
      mergeBase: headCommit,
      ahead: 1,
    };
    sideEffects.captureSafeGit.mockResolvedValue(committedCapture);
    const input = {
      mode: "incremental" as const,
      idempotencyKey: "refresh-pulse-crash-replay",
      actor: "agent:cli-test",
      expectedSourceSnapshotId: baselineSnapshotId,
    };
    sideEffects.failNextPulsePersist = true;

    await expect(refreshIndex(input, root, installationRoot)).rejects
      .toThrow("simulated_local_pulse_crash");
    expect((sideEffects.savedSnapshot as any).payload.changes).toHaveLength(1);
    expect(sideEffects.savedPulse).toBe(baselinePulse);
    expect(sideEffects.providerRevision).toBe(2);

    await sideEffects.provider.compareCommit({
      expectedRevision: 2,
      operationNonce: "intervening-provider-head-after-pulse-crash",
      phase: "intervening_business_phase_v1",
      artifacts: { schemaVersion: 1, operation: "intervening_business_write" },
    });
    expect(sideEffects.providerRevision).toBe(3);

    sideEffects.captureSafeGit.mockClear();
    sideEffects.captureSafeGit.mockResolvedValue(capture({
      headCommit: nextHeadCommit,
      baseCommit: nextHeadCommit,
      mergeBase: nextHeadCommit,
      changes: [],
    }));
    const result = await refreshIndex(input, root, installationRoot) as any;

    expect(result.isError).toBe(false);
    expect(sideEffects.captureSafeGit).toHaveBeenCalledTimes(2);
    expect(sideEffects.providerRevision).toBe(3);
    expect((sideEffects.savedPulse as any).payload.changeSummary.bySource.committed)
      .toBe(1);
    expect((sideEffects.savedPulse as any).revision).toBe(
      baselinePulse.revision + 1,
    );
  });

  it("finalizes the exact prepared full cut after a crash without preparing a new head", async () => {
    const input = {
      mode: "full" as const,
      idempotencyKey: "refresh-prepared-crash-recovery",
      actor: "agent:cli-test",
    };
    sideEffects.provider.compareCommitRefreshPublication
      .mockRejectedValueOnce(new Error("simulated_crash_before_full_finalize"));

    await expect(refreshIndex(input, root, installationRoot)).rejects
      .toThrow("simulated_crash_before_full_finalize");
    expect(sideEffects.providerRevision).toBe(1);
    expect(sideEffects.providerHead.artifacts).toMatchObject({
      operation: "refresh_index_prepared",
    });
    expect(sideEffects.providerRefreshAuthority).toBeUndefined();

    const result = await refreshIndex(input, root, installationRoot) as any;
    expect(result.isError).toBe(false);
    expect(sideEffects.providerRevision).toBe(2);
    expect(sideEffects.providerRefreshAuthority.finalizedProviderRevision)
      .toBe(2);
    expect(
      sideEffects.provider.compareCommit.mock.calls.filter(
        ([request]) => request.artifacts.operation === "refresh_index_prepared",
      ),
    ).toHaveLength(1);
    expect(sideEffects.provider.compareCommitRefreshPublication)
      .toHaveBeenCalledTimes(2);
  });

  it("stages Task knowledge durably without any Provider or current-cut publication", async () => {
    await refreshIndex({ mode: "incremental", idempotencyKey: "stage-baseline", actor: "codex" }, root, installationRoot);
    const snapshot = sideEffects.savedSnapshot as any;
    const pulse = sideEffects.savedPulse;
    const revision = sideEffects.providerRevision;
    const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    sideEffects.prepareTaskKnowledgeV1.mockResolvedValue({ action: "stage", knowledgeLineage: {
      status: "pending", taskId, taskRevision: 4, sourceSnapshotId: snapshot.sourceSnapshotId,
    } });
    vi.clearAllMocks();
    const result = await refreshIndex({ mode: "full", expectedSourceSnapshotId: snapshot.sourceSnapshotId,
      idempotencyKey: "stage-knowledge", actor: "codex",
      knowledge: { action: "stage", taskId, expectedTaskRevision: 4 },
    }, root, installationRoot) as any;
    expect(result.structuredContent.result.knowledge).toMatchObject({ status: "pending", taskId, taskRevision: 4 });
    expect(sideEffects.savePendingRepositoryIndexV1).toHaveBeenCalledOnce();
    expect(sideEffects.publishStagedRepositoryIndex).not.toHaveBeenCalled();
    expect(sideEffects.publishIncrementalStrongCutV1).not.toHaveBeenCalled();
    expect(sideEffects.provider.compareCommit).not.toHaveBeenCalled();
    expect(sideEffects.provider.writeExactObject).not.toHaveBeenCalled();
    expect(sideEffects.store.persistArtifact).not.toHaveBeenCalled();
    expect(sideEffects.providerRevision).toBe(revision);
    expect(sideEffects.savedSnapshot).toBe(snapshot);
    expect(sideEffects.savedPulse).toBe(pulse);
    expect(sideEffects.discardStagedRepositoryIndex).toHaveBeenCalledOnce();
  });

  it("publishes the authorized candidate bytes through the existing full atomic cut and replays it", async () => {
    await refreshIndex({ mode: "incremental", idempotencyKey: "publish-baseline", actor: "codex" }, root, installationRoot);
    const snapshot = sideEffects.savedSnapshot as any;
    const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const candidateGenerationId = `generation-${"4".repeat(64)}`;
    const built = await sideEffects.buildRepositoryIndex();
    const candidate = { ...built, generation: { ...built.generation, generationId: candidateGenerationId },
      knowledgeLineage: { status: "pending", taskId, taskRevision: 4, sourceSnapshotId: snapshot.sourceSnapshotId },
    };
    sideEffects.buildRepositoryIndex.mockResolvedValue(candidate);
    sideEffects.prepareTaskKnowledgeV1.mockResolvedValue({ action: "publish", ...built,
      candidate,
      knowledgeLineage: { status: "published", taskId, taskRevision: 7, sourceSnapshotId: snapshot.sourceSnapshotId },
    });
    vi.clearAllMocks();
    const input = { mode: "full", expectedSourceSnapshotId: snapshot.sourceSnapshotId,
      idempotencyKey: "publish-knowledge", actor: "codex",
      knowledge: { action: "publish", taskId, expectedTaskRevision: 7, candidateGenerationId },
    };
    const result = await refreshIndex(input, root, installationRoot) as any;
    expect(result.structuredContent.result.knowledge).toMatchObject({ status: "published", taskId, candidateGenerationId });
    expect(sideEffects.buildRepositoryIndex).toHaveBeenCalledOnce();
    expect(sideEffects.publishStagedRepositoryIndex).toHaveBeenCalledWith(expect.objectContaining({ publication: built.publication }));
    const revision = sideEffects.providerRevision;
    await expect(refreshIndex(input, root, installationRoot)).resolves.toMatchObject({ isError: false });
    expect(sideEffects.providerRevision).toBe(revision);
    expect(sideEffects.prepareTaskKnowledgeV1).toHaveBeenLastCalledWith(expect.objectContaining({ recoveredGenerationId: built.generation.generationId }));
  });

  it("returns the existing machine-readable idempotency conflict for a pending key reused by another request", async () => {
    await refreshIndex({ mode: "incremental", idempotencyKey: "pending-conflict-baseline", actor: "codex" }, root, installationRoot);
    const snapshot = sideEffects.savedSnapshot as any;
    const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    sideEffects.prepareTaskKnowledgeV1.mockResolvedValue({ action: "stage", knowledgeLineage: {
      status: "pending", taskId, taskRevision: 4, sourceSnapshotId: snapshot.sourceSnapshotId,
    } });
    sideEffects.savePendingRepositoryIndexV1.mockRejectedValueOnce(Object.assign(
      new sideEffects.RepositoryIndexError("pending knowledge idempotency conflict"), { existingRequestDigest: digest },
    ));
    vi.clearAllMocks();
    await expect(refreshIndex({ mode: "full", expectedSourceSnapshotId: snapshot.sourceSnapshotId,
      idempotencyKey: "pending-conflict", actor: "codex",
      knowledge: { action: "stage", taskId, expectedTaskRevision: 4 },
    }, root, installationRoot)).rejects.toMatchObject({ result: { structuredContent: { error: {
      code: "idempotency_conflict", details: { idempotencyKey: "pending-conflict", existingRequestDigest: digest },
    } } } });
    expect(sideEffects.provider.compareCommit).not.toHaveBeenCalled();
    expect(sideEffects.store.persistArtifact).not.toHaveBeenCalled();
  });

  it("rejects a self-consistent candidate that does not reconstruct from the captured source", async () => {
    await refreshIndex({ mode: "incremental", idempotencyKey: "forged-candidate-baseline", actor: "codex" }, root, installationRoot);
    const snapshot = sideEffects.savedSnapshot as any;
    const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const built = await sideEffects.buildRepositoryIndex();
    const candidateGenerationId = `generation-${"4".repeat(64)}`;
    sideEffects.prepareTaskKnowledgeV1.mockResolvedValue({ action: "publish", ...built,
      candidate: { ...built, generation: { ...built.generation, generationId: candidateGenerationId },
        knowledgeLineage: { status: "pending", taskId, taskRevision: 4, sourceSnapshotId: snapshot.sourceSnapshotId } },
    });
    vi.clearAllMocks();
    await expect(refreshIndex({ mode: "full", expectedSourceSnapshotId: snapshot.sourceSnapshotId,
      idempotencyKey: "forged-candidate-publish", actor: "codex",
      knowledge: { action: "publish", taskId, expectedTaskRevision: 7, candidateGenerationId },
    }, root, installationRoot)).rejects.toThrow();
    expect(sideEffects.provider.writeExactObject).not.toHaveBeenCalled();
    expect(sideEffects.publishStagedRepositoryIndex).not.toHaveBeenCalled();
    expect(sideEffects.store.persistArtifact).not.toHaveBeenCalled();
  });

  it("cannot overwrite Task-published knowledge by omitting the Task publication selector", async () => {
    await refreshIndex({ mode: "full", idempotencyKey: "protected-baseline", actor: "codex" }, root, installationRoot);
    const original = sideEffects.openActiveRepositoryIndexV1.getMockImplementation()!;
    sideEffects.openActiveRepositoryIndexV1.mockImplementation(async () => ({
      ...await original(), knowledgeLineage: { status: "published" },
    }));
    vi.clearAllMocks();
    await expect(refreshIndex({ mode: "full", idempotencyKey: "omit-selector", actor: "codex" }, root, installationRoot)).rejects.toThrow();
    expect(sideEffects.buildRepositoryIndex).not.toHaveBeenCalled();
    expect(sideEffects.provider.writeExactObject).not.toHaveBeenCalled();
    expect(sideEffects.store.persistArtifact).not.toHaveBeenCalled();
  });
});
