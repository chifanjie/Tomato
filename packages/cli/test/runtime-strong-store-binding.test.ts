import { beforeEach, describe, expect, it, vi } from "vitest";

const fakes = vi.hoisted(() => {
  class ProviderUnavailableError extends TypeError {
    constructor() {
      super("production strong object gateway is unavailable");
      this.name = "ProviderProductionStrongObjectUnavailableErrorV1";
    }
  }
  const identity = Object.freeze({
    repositoryId: `repo-hmac-${"1".repeat(64)}`,
    worktreeId: `worktree-hmac-${"2".repeat(64)}`,
    rootIdentity: `root-hmac-${"3".repeat(64)}`,
  });
  const capture = Object.freeze({
    canonicalRoot: "/workspace",
    snapshot: Object.freeze({
      captureStatus: "complete",
      repositoryId: "repo-legacy",
      worktreeId: "worktree-legacy",
    }),
  });
  const store = {
    repositoryId: identity.repositoryId,
    worktreeId: identity.worktreeId,
    readManifest: vi.fn(async () => ({ artifacts: [] })),
  };
  const providerClient = {
    verifiedProviderId: "durable-object-provider:native-b",
    inspectState: vi.fn(async () => ({ revision: 1 })),
    readExactObject: vi.fn(),
    writeExactObject: vi.fn(),
    compareCommit: vi.fn(),
    commitOwnerOnlyState: vi.fn(),
    close: vi.fn(),
  };
  const closeCapability = vi.fn(async () => undefined);
  const bootstrapSafeGit = vi.fn(async () => ({
    capability: {
      bindRepositoryControl: vi.fn(async () => ({})),
      bindRepositoryIdentity: vi.fn(async () => identity),
      bindEmptyHooksDirectory: vi.fn(async () => ({})),
      bindGitExecutable: vi.fn(async () => ({})),
      executeGitVersion: vi.fn(async () => ({})),
      createReadExecutor: vi.fn(),
      executeGitObjectType: vi.fn(),
      createTaskBaselineLease: vi.fn(),
      recoverTaskBaselineLease: vi.fn(),
      close: closeCapability,
    },
  }));
  return {
    capture,
    identity,
    store,
    providerClient,
    openStore: vi.fn(async () => store),
    bootstrapSafeGit,
    closeCapability,
    openProviderClient: vi.fn(async () => providerClient),
    ProviderUnavailableError,
  };
});

vi.mock("@understand-code/artifact-store", () => ({
  ArtifactStore: { open: fakes.openStore },
  ArtifactStoreError: class ArtifactStoreError extends Error {
    readonly code = "artifact_not_found";
  },
  ArtifactStoreStrongChangeAuthorityV1: class ArtifactStoreStrongChangeAuthorityV1 {},
}));

vi.mock("@understand-code/contracts", () => ({
  canonicalizeJson: JSON.stringify,
}));

vi.mock("@understand-code/repository-state", () => ({
  bootstrapSafeGitDescriptorBoundCandidateV1: fakes.bootstrapSafeGit,
  getRepositorySnapshotDetailed: vi.fn(),
  getRepositorySnapshotDetailedWithSafeGitCapabilityV1: vi.fn(
    async () => fakes.capture,
  ),
}));

vi.mock("@understand-code/durable-object-provider-client", () => ({
  isProviderProductionStrongObjectUnavailableErrorV1: (error: unknown) =>
    error instanceof fakes.ProviderUnavailableError,
  openProviderProductionStrongObjectClientV1: fakes.openProviderClient,
}));

vi.mock(
  "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1",
  () => ({
    ProviderRuntimeIpcFixedObjectLocatorV1Schema: { parse: (value: unknown) => value },
  }),
);

vi.mock("@understand-code/task-engine", () => ({
  RepositoryTaskContextProvider: {
    open: vi.fn(async () => ({})),
  },
  RepositoryStrongChangeMaterialAuthorityV1: class RepositoryStrongChangeMaterialAuthorityV1 {},
  TaskEngine: class TaskEngine {},
}));

import { openProductionRuntime } from "../src/runtime/context.js";

describe("production strong Store binding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects the installation-keyed descriptor identity, never legacy capture IDs", async () => {
    const runtime = await openProductionRuntime(
      "/workspace",
      "/provider-installation",
    );

    expect(fakes.openStore).toHaveBeenCalledWith("/workspace", {
      repositoryId: fakes.identity.repositoryId,
      worktreeId: fakes.identity.worktreeId,
      producerVersion: expect.any(String),
    });
    expect(fakes.openStore).not.toHaveBeenCalledWith(
      "/workspace",
      expect.objectContaining({ repositoryId: "repo-legacy" }),
    );
    expect(fakes.closeCapability).toHaveBeenCalledOnce();
    expect(fakes.openProviderClient).toHaveBeenCalledWith({
      canonicalInstallationRoot: "/provider-installation",
    });

    await runtime.close?.();
    expect(fakes.providerClient.close).toHaveBeenCalledOnce();
  });

  it("maps an explicitly unavailable Provider gateway to the public locked Store failure", async () => {
    fakes.openProviderClient.mockRejectedValueOnce(
      new fakes.ProviderUnavailableError(),
    );

    await expect(openProductionRuntime(
      "/workspace",
      "/provider-installation",
    )).rejects.toMatchObject({
      name: "ToolFailure",
      result: {
        structuredContent: {
          error: {
            code: "provider_unavailable",
            details: { reason: "unavailable" },
          },
        },
      },
    });
    expect(fakes.bootstrapSafeGit).not.toHaveBeenCalled();
  });

  it("does not disguise an unexpected Provider failure as ordinary unavailability", async () => {
    const unexpected = new Error("unexpected Provider failure");
    fakes.openProviderClient.mockRejectedValueOnce(unexpected);

    await expect(openProductionRuntime(
      "/workspace",
      "/provider-installation",
    )).rejects.toBe(unexpected);
    expect(fakes.bootstrapSafeGit).not.toHaveBeenCalled();
  });

  it("closes the pre-opened Provider client when later runtime initialization fails", async () => {
    const unexpected = new Error("SafeGit initialization failed");
    fakes.bootstrapSafeGit.mockRejectedValueOnce(unexpected);

    await expect(openProductionRuntime(
      "/workspace",
      "/provider-installation",
    )).rejects.toBe(unexpected);
    expect(fakes.providerClient.close).toHaveBeenCalledOnce();
  });
});
