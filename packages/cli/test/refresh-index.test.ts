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
    inspectIndexPublicationAuthority: vi.fn(),
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
    captureSafeGit: vi.fn(),
    readStableFile: vi.fn(),
    preflightIndex: vi.fn(),
    buildRepositoryIndex: vi.fn(),
    publishStagedRepositoryIndex: vi.fn(),
    publishIncrementalStrongCutV1: vi.fn(),
    discardStagedRepositoryIndex: vi.fn(),
    legacyCapture: vi.fn(),
    providerRevision: 0,
    providerIndexAuthority: undefined as any,
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
  getRepositorySnapshotDetailedWithSafeGitCapabilityV1:
    sideEffects.captureSafeGit,
  isSensitiveRepositoryPath: (value: string) =>
    value === ".env" || value.endsWith("/.env"),
  readStableRepositoryFile: sideEffects.readStableFile,
}));

vi.mock("../src/runtime/repository-indexer.js", () => ({
  RepositoryIndexError: sideEffects.RepositoryIndexError,
  preflightRepositoryIndex: sideEffects.preflightIndex,
  buildRepositoryIndex: sideEffects.buildRepositoryIndex,
  publishStagedRepositoryIndex: sideEffects.publishStagedRepositoryIndex,
  publishIncrementalStrongCutV1: sideEffects.publishIncrementalStrongCutV1,
  discardStagedRepositoryIndex: sideEffects.discardStagedRepositoryIndex,
}));

vi.mock("../src/runtime/context.js", () => ({
  captureBoundRepositorySnapshot: sideEffects.legacyCapture,
  fingerprintPublishedSnapshot: vi.fn(),
}));

import {
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
const ownerToken = "hmac-sha256:" + "4".repeat(64);

function rawCanonicalDigest(value: string): string {
  return "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");
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
}

beforeEach(() => {
  vi.clearAllMocks();
  sideEffects.providerRevision = 0;
  sideEffects.providerIndexAuthority = undefined;
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

  sideEffects.openStore.mockResolvedValue(sideEffects.store);
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
  sideEffects.provider.commitOwnerOnlyState.mockResolvedValue(ownerToken);
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
    expect(snapshotArtifact.payload.indexToken).toBe(ownerToken);
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

  it("uses read-only business-head inspection without a mutating recovery probe", async () => {
    sideEffects.providerRevision = 1;
    sideEffects.providerHead = {
      phase: "concurrent_business_phase_v1",
      operationNonce: "concurrent-operation",
      artifacts: { schemaVersion: 1, operation: "concurrent_write" },
    };

    await refreshIndex({
      mode: "incremental",
      idempotencyKey: "refresh-read-only-head",
      actor: "agent:cli-test",
    }, root, installationRoot);

    expect(sideEffects.provider.compareCommit).toHaveBeenCalledOnce();
    expect(sideEffects.provider.compareCommit.mock.calls[0]![0]).toMatchObject({
      expectedRevision: 1,
      artifacts: { operation: "refresh_index" },
    });
    expect(sideEffects.provider.compareCommit.mock.calls.some(
      ([request]) => request.artifacts.operation === "refresh_index_probe",
    )).toBe(false);
    expect(sideEffects.providerRevision).toBe(2);
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

  it("does not rebase full finalization over a head changed before inspection", async () => {
    const inspectBusinessHead =
      sideEffects.provider.inspectBusinessHead.getMockImplementation()!;
    let inspections = 0;
    sideEffects.provider.inspectBusinessHead.mockImplementation(async () => {
      inspections += 1;
      if (inspections === 3) {
        sideEffects.providerRevision += 1;
        sideEffects.providerHead = {
          phase: "concurrent_business_phase_v1",
          operationNonce: "concurrent-before-finalize",
          artifacts: { schemaVersion: 1, operation: "concurrent_write" },
        };
      }
      return await inspectBusinessHead();
    });

    await expect(refreshIndex({
      mode: "full",
      idempotencyKey: "refresh-no-finalize-rebase",
      actor: "agent:cli-test",
    }, root, installationRoot)).rejects.toThrow(
      "Provider refresh prepared head changed before full finalization",
    );

    expect(sideEffects.provider.compareCommit).toHaveBeenCalledOnce();
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

  it("replays the durable Provider cut to reconcile a crash before local publish", async () => {
    sideEffects.failNextPersist = true;
    const input = {
      mode: "incremental" as const,
      idempotencyKey: "refresh-crash-replay",
      actor: "agent:cli-test",
    };
    await expect(
      refreshIndex(input, root, installationRoot),
    ).rejects.toThrow("simulated_local_crash");
    expect(sideEffects.providerRevision).toBe(1);
    expect(sideEffects.savedSnapshot).toBeUndefined();

    const result = await refreshIndex(input, root, installationRoot) as any;
    expect(result.isError).toBe(false);
    expect(sideEffects.provider.readExactObject).toHaveBeenCalledOnce();
    expect(sideEffects.providerRevision).toBe(1);
    expect(sideEffects.provider.compareCommit.mock.results.some(
      (resultEntry) => resultEntry.type === "return",
    )).toBe(true);
    expect(sideEffects.savedSnapshot).toBeDefined();
    expect(sideEffects.savedPulse).toBeDefined();
  });
});
