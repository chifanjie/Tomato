import { beforeEach, describe, expect, it, vi } from "vitest";

const safeGitStateV1 = vi.hoisted(() => ({
  events: [] as string[],
  failAt: undefined as string | undefined,
  executableInstalled: false,
  delegated: false,
  ext4: false,
  capture: Object.freeze({
    snapshot: Object.freeze({ captureStatus: "complete" }),
    canonicalRoot: "/workspace",
    git: Object.freeze({ detached: false, linkedWorktree: false }),
    diagnostics: Object.freeze([]),
  }),
}));

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>(
    "node:fs/promises",
  );
  return {
    ...actual,
    lstat: async (path: string) => {
      if (
        path === "/opt/understand-code/bin/git" &&
        safeGitStateV1.executableInstalled
      ) {
        return {
          isFile: () => true,
          isSymbolicLink: () => false,
          uid: 0,
          gid: 0,
          nlink: 1,
          mode: 0o100755,
        };
      }
      const error = new Error("not found") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      throw error;
    },
    readFile: async (path: string, encoding: string) => {
      if (path !== "/proc/self/cgroup" || encoding !== "utf8") {
        throw new Error("unexpected readFile in profile test");
      }
      return safeGitStateV1.delegated
        ? "0::/system.slice/service/understand-code-safe-git-supervisor-v1\n"
        : "0::/user.slice/development.scope\n";
    },
    statfs: async () => ({ type: safeGitStateV1.ext4 ? 0xef53 : 0x01021994 }),
  };
});

vi.mock("@understand-code/repository-state", () => {
  const step = async (name: string) => {
    safeGitStateV1.events.push(name);
    if (safeGitStateV1.failAt === name) throw new Error(`failed:${name}`);
  };
  const capability = {
    bindRepositoryControl: () => step("control"),
    bindRepositoryIdentity: () => step("identity"),
    bindEmptyHooksDirectory: () => step("empty_hooks"),
    bindGitExecutable: async (path: string) => step(`executable:${path}`),
    executeGitVersion: () => step("version"),
    close: () => step("close"),
  };
  return {
    bootstrapSafeGitDescriptorBoundCandidateV1: async (root: string) => {
      await step(`bootstrap:${root}`);
      return { capability };
    },
    getRepositorySnapshotDetailedWithSafeGitCapabilityV1: async (
      root: string,
      observedCapability: unknown,
    ) => {
      if (observedCapability !== capability) {
        throw new Error("snapshot received another capability");
      }
      await step(`snapshot:${root}`);
      return safeGitStateV1.capture;
    },
    getRepositorySnapshotDetailed: async (root: string) => {
      await step(`legacy_snapshot:${root}`);
      return safeGitStateV1.capture;
    },
  };
});

import { captureBoundRepositorySnapshot } from "../src/runtime/context.js";

describe("production runtime SafeGit snapshot lifecycle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    safeGitStateV1.events.length = 0;
    safeGitStateV1.failAt = undefined;
    safeGitStateV1.executableInstalled = false;
    safeGitStateV1.delegated = false;
    safeGitStateV1.ext4 = false;
  });

  function selectStrongProfile(): void {
    vi.spyOn(process, "platform", "get").mockReturnValue("linux");
    safeGitStateV1.executableInstalled = true;
    safeGitStateV1.delegated = true;
    safeGitStateV1.ext4 = true;
  }

  it("promotes one capability through version, captures, and always closes it", async () => {
    selectStrongProfile();
    process.env.GIT_DIR = "/caller/must/not/be/authority";
    process.env.GIT_CONFIG_GLOBAL = "/caller/malicious/config";
    try {
      await expect(
        captureBoundRepositorySnapshot("/workspace"),
      ).resolves.toBe(safeGitStateV1.capture);
      expect(process.env.GIT_DIR).toBe("/caller/must/not/be/authority");
      expect(process.env.GIT_CONFIG_GLOBAL).toBe("/caller/malicious/config");
    } finally {
      delete process.env.GIT_DIR;
      delete process.env.GIT_CONFIG_GLOBAL;
    }
    expect(safeGitStateV1.events).toEqual([
      "bootstrap:/workspace",
      "control",
      "identity",
      "empty_hooks",
      "executable:/opt/understand-code/bin/git",
      "version",
      "snapshot:/workspace",
      "close",
    ]);
  });

  it.each([
    "control",
    "identity",
    "empty_hooks",
    "executable:/opt/understand-code/bin/git",
    "version",
    "snapshot:/workspace",
    "close",
  ])("fails closed and closes on %s failure", async (failure) => {
    selectStrongProfile();
    safeGitStateV1.failAt = failure;
    await expect(
      captureBoundRepositorySnapshot("/workspace"),
    ).rejects.toThrow(`failed:${failure}`);
    expect(safeGitStateV1.events.at(-1)).toBe("close");
    expect(safeGitStateV1.events.filter((event) => event === "close")).toHaveLength(1);
  });

  it("keeps non-Linux installations on the legacy read-only snapshot path", async () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
    await expect(
      captureBoundRepositorySnapshot("/workspace"),
    ).resolves.toBe(safeGitStateV1.capture);
    expect(safeGitStateV1.events).toEqual(["legacy_snapshot:/workspace"]);
  });

  it("keeps an ordinary Linux development machine read-only", async () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("linux");
    await expect(
      captureBoundRepositorySnapshot("/workspace"),
    ).resolves.toBe(safeGitStateV1.capture);
    expect(safeGitStateV1.events).toEqual(["legacy_snapshot:/workspace"]);
  });

  it("never silently downgrades a partially installed strong profile", async () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("linux");
    safeGitStateV1.executableInstalled = true;
    await expect(
      captureBoundRepositorySnapshot("/workspace"),
    ).rejects.toThrow("installed SafeGit production profile is invalid");
    expect(safeGitStateV1.events).toEqual([]);
  });
});
