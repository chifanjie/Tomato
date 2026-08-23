import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  bindNativeSafeGitRepositoryControlV1,
  closeNativeSafeGitDescriptorBootstrapV1,
  openNativeSafeGitDescriptorBootstrapV1,
  revalidateNativeSafeGitDescriptorBootstrapV1,
  type NativeSafeGitDescriptorBindingV1,
} from "../src/index.js";

const fixtureRootsV1 = new Set<string>();

function createFixtureRootV1(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "uc-native-bridge-")));
  fixtureRootsV1.add(root);
  return root;
}

function initializeRepositoryV1(repository: string): void {
  mkdirSync(repository, { mode: 0o700 });
  execFileSync("git", ["init", "--quiet", repository], { stdio: "pipe" });
}

function expectSafeGitUnavailableV1(callback: () => unknown): void {
  expect(callback).toThrowError(
    expect.objectContaining({
      code: "ERR_NATIVE_KERNEL_BRIDGE_SAFE_GIT_UNAVAILABLE",
    }),
  );
}

afterEach(() => {
  for (const root of fixtureRootsV1) {
    rmSync(root, { force: true, recursive: true });
  }
  fixtureRootsV1.clear();
});

describe.runIf(process.platform === "darwin" || process.platform === "linux")(
  "native kernel bridge loader",
  () => {
    it("opens, revalidates, and idempotently closes an ordinary repository binding", () => {
      const root = createFixtureRootV1();
      const repository = join(root, "repository");
      initializeRepositoryV1(repository);

      const opened = openNativeSafeGitDescriptorBootstrapV1(repository);

      expect(opened.layout).toBe("ordinary");
      expect(bindNativeSafeGitRepositoryControlV1(opened.binding)).toEqual({
        profile: "native_safe_git_repository_control_v1",
        objectFormat: "sha1",
        objectDatabase: "local_only_verified",
        refBackend: "files_verified",
        repositoryConfig: "verified",
        worktreeConfig: "absent",
      });
      expect(bindNativeSafeGitRepositoryControlV1(opened.binding)).toEqual(
        bindNativeSafeGitRepositoryControlV1(opened.binding),
      );
      expect(revalidateNativeSafeGitDescriptorBootstrapV1(opened.binding)).toBe(
        "ordinary",
      );
      closeNativeSafeGitDescriptorBootstrapV1(opened.binding);
      expect(() =>
        closeNativeSafeGitDescriptorBootstrapV1(opened.binding),
      ).not.toThrow();
      expectSafeGitUnavailableV1(() =>
        revalidateNativeSafeGitDescriptorBootstrapV1(opened.binding),
      );
    });

    it("binds SHA-256 object format without invoking Git during control inspection", () => {
      const root = createFixtureRootV1();
      const repository = join(root, "sha256-repository");
      mkdirSync(repository, { mode: 0o700 });
      execFileSync("git", ["init", "--quiet", "--object-format=sha256", repository], {
        stdio: "pipe",
      });

      const opened = openNativeSafeGitDescriptorBootstrapV1(repository);
      expect(bindNativeSafeGitRepositoryControlV1(opened.binding)).toMatchObject({
        objectFormat: "sha256",
        objectDatabase: "local_only_verified",
        refBackend: "files_verified",
      });
      closeNativeSafeGitDescriptorBootstrapV1(opened.binding);
    });

    it("opens and revalidates a real linked worktree binding", () => {
      const root = createFixtureRootV1();
      const repository = join(root, "main");
      const linkedWorktree = join(root, "linked");
      initializeRepositoryV1(repository);
      execFileSync(
        "git",
        [
          "-C",
          repository,
          "-c",
          "user.name=Understand Code",
          "-c",
          "user.email=understand-code@example.invalid",
          "commit",
          "--quiet",
          "--allow-empty",
          "-m",
          "initial",
        ],
        { stdio: "pipe" },
      );
      execFileSync(
        "git",
        ["-C", repository, "worktree", "add", "--quiet", "--detach", linkedWorktree],
        { stdio: "pipe" },
      );

      const opened = openNativeSafeGitDescriptorBootstrapV1(linkedWorktree);

      expect(opened.layout).toBe("linked_worktree");
      expect(bindNativeSafeGitRepositoryControlV1(opened.binding)).toMatchObject({
        objectFormat: "sha1",
        objectDatabase: "local_only_verified",
        refBackend: "files_verified",
      });
      expect(revalidateNativeSafeGitDescriptorBootstrapV1(opened.binding)).toBe(
        "linked_worktree",
      );
      closeNativeSafeGitDescriptorBootstrapV1(opened.binding);
    });

    it("binds a real local clone with common safe remote, branch, user, and init keys", () => {
      const root = createFixtureRootV1();
      const source = join(root, "source");
      const clone = join(root, "clone");
      initializeRepositoryV1(source);
      execFileSync(
        "git",
        [
          "-C",
          source,
          "-c",
          "user.name=Understand Code",
          "-c",
          "user.email=understand-code@example.invalid",
          "commit",
          "--quiet",
          "--allow-empty",
          "-m",
          "initial",
        ],
        { stdio: "pipe" },
      );
      execFileSync("git", ["clone", "--quiet", source, clone], {
        stdio: "pipe",
      });
      const branch = execFileSync(
        "git",
        ["-C", clone, "branch", "--show-current"],
        { encoding: "utf8" },
      ).trim();
      execFileSync("git", ["-C", clone, "config", "remote.origin.pushurl", source]);
      execFileSync("git", ["-C", clone, "config", "remote.origin.push", "refs/heads/*:refs/heads/*"]);
      execFileSync("git", ["-C", clone, "config", "remote.origin.tagopt", "--no-tags"]);
      execFileSync("git", ["-C", clone, "config", "remote.origin.prune", "true"]);
      execFileSync("git", ["-C", clone, "config", "remote.origin.mirror", "false"]);
      execFileSync("git", ["-C", clone, "config", `branch.${branch}.pushremote`, "origin"]);
      execFileSync("git", ["-C", clone, "config", `branch.${branch}.rebase`, "false"]);
      execFileSync("git", ["-C", clone, "config", `branch.${branch}.description`, "safe branch"]);
      execFileSync("git", ["-C", clone, "config", "user.name", "Understand Code"]);
      execFileSync("git", ["-C", clone, "config", "user.email", "understand-code@example.invalid"]);
      execFileSync("git", ["-C", clone, "config", "init.defaultBranch", branch]);

      const opened = openNativeSafeGitDescriptorBootstrapV1(clone);
      expect(bindNativeSafeGitRepositoryControlV1(opened.binding)).toMatchObject({
        objectDatabase: "local_only_verified",
        refBackend: "files_verified",
        repositoryConfig: "verified",
      });
      expect(revalidateNativeSafeGitDescriptorBootstrapV1(opened.binding)).toBe(
        "ordinary",
      );
      closeNativeSafeGitDescriptorBootstrapV1(opened.binding);
    });

    it("rejects alternate, promisor, replace, and reftable repository controls", () => {
      for (const hostile of ["alternate", "promisor", "replace", "reftable"] as const) {
        const root = createFixtureRootV1();
        const repository = join(root, `repository-${hostile}`);
        initializeRepositoryV1(repository);
        if (hostile === "alternate") {
          writeFileSync(join(repository, ".git", "objects", "info", "alternates"), "/tmp/foreign\n", { mode: 0o600 });
        } else if (hostile === "promisor") {
          writeFileSync(join(repository, ".git", "objects", "pack", "pack-deadbeef.promisor"), "", { mode: 0o600 });
        } else if (hostile === "replace") {
          mkdirSync(join(repository, ".git", "refs", "replace"), { mode: 0o700 });
        } else {
          appendFileSync(join(repository, ".git", "config"), "\n[extensions]\n\trefStorage = reftable\n");
        }
        const opened = openNativeSafeGitDescriptorBootstrapV1(repository);
        expectSafeGitUnavailableV1(() =>
          bindNativeSafeGitRepositoryControlV1(opened.binding),
        );
        if (hostile === "promisor") {
          expectSafeGitUnavailableV1(() =>
            bindNativeSafeGitRepositoryControlV1(opened.binding),
          );
          expectSafeGitUnavailableV1(() =>
            revalidateNativeSafeGitDescriptorBootstrapV1(opened.binding),
          );
        }
        closeNativeSafeGitDescriptorBootstrapV1(opened.binding);
      }
    });

    it("rejects executable configuration and malformed packed refs", () => {
      const root = createFixtureRootV1();
      const hostileConfigs = [
        "[include]\n\tpath = /tmp/hostile\n",
        "[core]\n\tgitProxy = !hostile\n",
        "[core]\n\teditor = hostile\n",
        "[core]\n\tpager = hostile\n",
        "[credential]\n\thelper = !hostile\n",
        "[gpg]\n\tprogram = /tmp/hostile\n",
        "[merge \"hostile\"]\n\tdriver = !hostile %O %A %B\n",
        "[interactive]\n\tdiffFilter = hostile\n",
        "[alias]\n\tpwn = !hostile\n",
        "[remote \"origin\"]\n\tpromisor = true\n",
        "[remote \"origin\"]\n\tpartialCloneFilter = blob:none\n",
        "[remote \"origin\"]\n\tuploadpack = hostile\n",
        "[remote \"origin\"]\n\treceivepack = hostile\n",
        "[remote \"origin\"]\n\tvcs = hostile\n",
        "[remote \"origin\"]\n\thelper = hostile\n",
        "[remote \"origin\"]\n\turl = ext::hostile\n",
        "[user]\n\tsigningkey = /tmp/hostile\n",
      ] as const;
      for (const [index, hostileConfig] of hostileConfigs.entries()) {
        const unsafeRepository = join(root, `unsafe-config-${index}`);
        initializeRepositoryV1(unsafeRepository);
        appendFileSync(
          join(unsafeRepository, ".git", "config"),
          `\n${hostileConfig}`,
        );
        const unsafeOpened =
          openNativeSafeGitDescriptorBootstrapV1(unsafeRepository);
        expectSafeGitUnavailableV1(() =>
          bindNativeSafeGitRepositoryControlV1(unsafeOpened.binding),
        );
        closeNativeSafeGitDescriptorBootstrapV1(unsafeOpened.binding);
      }

      const malformedRepository = join(root, "malformed-packed-refs");
      initializeRepositoryV1(malformedRepository);
      writeFileSync(join(malformedRepository, ".git", "packed-refs"), "not-a-packed-ref\n", { mode: 0o600 });
      const malformedOpened = openNativeSafeGitDescriptorBootstrapV1(malformedRepository);
      expectSafeGitUnavailableV1(() =>
        bindNativeSafeGitRepositoryControlV1(malformedOpened.binding),
      );
      closeNativeSafeGitDescriptorBootstrapV1(malformedOpened.binding);
    });

    it("admits a safe enabled worktree config and rejects unsafe or inert copies", () => {
      const root = createFixtureRootV1();
      const safeRepository = join(root, "safe-worktree-config");
      initializeRepositoryV1(safeRepository);
      execFileSync("git", ["-C", safeRepository, "config", "core.repositoryformatversion", "1"]);
      execFileSync("git", ["-C", safeRepository, "config", "extensions.worktreeConfig", "true"]);
      writeFileSync(
        join(safeRepository, ".git", "config.worktree"),
        "[core]\n\tsparseCheckout = false\n",
        { mode: 0o600 },
      );
      const safeOpened = openNativeSafeGitDescriptorBootstrapV1(safeRepository);
      expect(bindNativeSafeGitRepositoryControlV1(safeOpened.binding)).toMatchObject({
        worktreeConfig: "verified",
      });
      expect(revalidateNativeSafeGitDescriptorBootstrapV1(safeOpened.binding)).toBe(
        "ordinary",
      );
      closeNativeSafeGitDescriptorBootstrapV1(safeOpened.binding);

      const unsafeRepository = join(root, "unsafe-worktree-config");
      initializeRepositoryV1(unsafeRepository);
      execFileSync("git", ["-C", unsafeRepository, "config", "core.repositoryformatversion", "1"]);
      execFileSync("git", ["-C", unsafeRepository, "config", "extensions.worktreeConfig", "true"]);
      writeFileSync(
        join(unsafeRepository, ".git", "config.worktree"),
        "[include]\n\tpath = /tmp/hostile\n",
        { mode: 0o600 },
      );
      const unsafeOpened = openNativeSafeGitDescriptorBootstrapV1(unsafeRepository);
      expectSafeGitUnavailableV1(() =>
        bindNativeSafeGitRepositoryControlV1(unsafeOpened.binding),
      );
      closeNativeSafeGitDescriptorBootstrapV1(unsafeOpened.binding);

      const inertRepository = join(root, "inert-worktree-config");
      initializeRepositoryV1(inertRepository);
      writeFileSync(join(inertRepository, ".git", "config.worktree"), "", {
        mode: 0o600,
      });
      const inertOpened = openNativeSafeGitDescriptorBootstrapV1(inertRepository);
      expectSafeGitUnavailableV1(() =>
        bindNativeSafeGitRepositoryControlV1(inertOpened.binding),
      );
      closeNativeSafeGitDescriptorBootstrapV1(inertOpened.binding);
    });

    it("rejects escaped semantic drift, unknown extensions, and packed replace refs", () => {
      const root = createFixtureRootV1();
      const extensionDrift = [
        ["refStorage", "\"files \""],
        ["objectFormat", "\"sha1 \""],
        ["worktreeConfig", "\"true \""],
        ["refStorage", "files\\t"],
        ["objectFormat", "sha1\\t"],
        ["worktreeConfig", "true\\t"],
      ] as const;
      const cases = [
        ...extensionDrift.map(([key, value], index) => ({
          kind: `drift-${index}`,
          config: `\n[extensions]\n\t${key} = ${value}\n`,
        })),
        {
          kind: "unknown",
          config: "\n[extensions]\n\tfutureStorage = enabled\n",
        },
      ];
      for (const { kind, config } of cases) {
        const repository = join(root, kind);
        initializeRepositoryV1(repository);
        execFileSync("git", [
          "-C",
          repository,
          "config",
          "core.repositoryformatversion",
          "1",
        ]);
        appendFileSync(join(repository, ".git", "config"), config);
        const opened = openNativeSafeGitDescriptorBootstrapV1(repository);
        expectSafeGitUnavailableV1(() =>
          bindNativeSafeGitRepositoryControlV1(opened.binding),
        );
        closeNativeSafeGitDescriptorBootstrapV1(opened.binding);
      }

      const packedReplaceRepository = join(root, "packed-replace");
      initializeRepositoryV1(packedReplaceRepository);
      writeFileSync(
        join(packedReplaceRepository, ".git", "packed-refs"),
        `${"0".repeat(40)} refs/replace/hostile\n`,
        { mode: 0o600 },
      );
      const packedReplaceOpened =
        openNativeSafeGitDescriptorBootstrapV1(packedReplaceRepository);
      expectSafeGitUnavailableV1(() =>
        bindNativeSafeGitRepositoryControlV1(packedReplaceOpened.binding),
      );
      closeNativeSafeGitDescriptorBootstrapV1(packedReplaceOpened.binding);

      for (const [index, refName] of [
        "refs/foo.lock/bar",
        "refs/.hidden/x",
      ].entries()) {
        const repository = join(root, `invalid-packed-ref-${index}`);
        initializeRepositoryV1(repository);
        writeFileSync(
          join(repository, ".git", "packed-refs"),
          `${"0".repeat(40)} ${refName}\n`,
          { mode: 0o600 },
        );
        const opened = openNativeSafeGitDescriptorBootstrapV1(repository);
        expectSafeGitUnavailableV1(() =>
          bindNativeSafeGitRepositoryControlV1(opened.binding),
        );
        closeNativeSafeGitDescriptorBootstrapV1(opened.binding);
      }
    });

    it("fails revalidation when pinned config or local ODB layout changes", () => {
      const root = createFixtureRootV1();
      const configRepository = join(root, "config-race");
      initializeRepositoryV1(configRepository);
      const configOpened = openNativeSafeGitDescriptorBootstrapV1(configRepository);
      bindNativeSafeGitRepositoryControlV1(configOpened.binding);
      appendFileSync(join(configRepository, ".git", "config"), "\n# changed\n");
      expectSafeGitUnavailableV1(() =>
        revalidateNativeSafeGitDescriptorBootstrapV1(configOpened.binding),
      );
      closeNativeSafeGitDescriptorBootstrapV1(configOpened.binding);

      const objectRepository = join(root, "object-race");
      initializeRepositoryV1(objectRepository);
      const objectOpened = openNativeSafeGitDescriptorBootstrapV1(objectRepository);
      bindNativeSafeGitRepositoryControlV1(objectOpened.binding);
      mkdirSync(join(objectRepository, ".git", "objects", "aa"), { mode: 0o700 });
      expectSafeGitUnavailableV1(() =>
        revalidateNativeSafeGitDescriptorBootstrapV1(objectOpened.binding),
      );
      closeNativeSafeGitDescriptorBootstrapV1(objectOpened.binding);
    });

    it("retains authority across ordinary worktree and Git index churn", () => {
      const root = createFixtureRootV1();
      const repository = join(root, "repository");
      initializeRepositoryV1(repository);
      const opened = openNativeSafeGitDescriptorBootstrapV1(repository);

      writeFileSync(join(repository, "added.txt"), "safe churn\n", {
        mode: 0o600,
      });
      execFileSync("git", ["-C", repository, "add", "added.txt"], {
        stdio: "pipe",
      });

      expect(revalidateNativeSafeGitDescriptorBootstrapV1(opened.binding)).toBe(
        "ordinary",
      );
      closeNativeSafeGitDescriptorBootstrapV1(opened.binding);
    });

    it("rejects a symlink in an intermediate repository path component", () => {
      const root = createFixtureRootV1();
      const realParent = join(root, "real-parent");
      const repository = join(realParent, "repository");
      mkdirSync(realParent, { mode: 0o700 });
      initializeRepositoryV1(repository);
      symlinkSync(realParent, join(root, "linked-parent"), "dir");

      expectSafeGitUnavailableV1(() =>
        openNativeSafeGitDescriptorBootstrapV1(
          join(root, "linked-parent", "repository"),
        ),
      );
    });

    it("keeps regular-file admission nonblocking under special-file replacement", () => {
      const source = readFileSync(
        new URL("../native/kernel_bridge.c", import.meta.url),
        "utf8",
      );
      expect(source).toContain("flags |= O_NONBLOCK | O_NOCTTY;");
      expect(source).toContain("entry_capacity == 0 ? 32 : entry_capacity * 2");

      const root = createFixtureRootV1();
      const repository = join(root, "repository");
      initializeRepositoryV1(repository);
      rmSync(join(repository, ".git"), { force: true, recursive: true });
      execFileSync("mkfifo", [join(repository, ".git")], { stdio: "pipe" });

      expectSafeGitUnavailableV1(() =>
        openNativeSafeGitDescriptorBootstrapV1(repository),
      );
    });

    it("fails revalidation after the bound repository namespace is renamed", () => {
      const root = createFixtureRootV1();
      const repository = join(root, "repository");
      initializeRepositoryV1(repository);
      const opened = openNativeSafeGitDescriptorBootstrapV1(repository);

      renameSync(repository, join(root, "moved-repository"));

      expectSafeGitUnavailableV1(() =>
        revalidateNativeSafeGitDescriptorBootstrapV1(opened.binding),
      );
      closeNativeSafeGitDescriptorBootstrapV1(opened.binding);
    });

    it("rejects relative roots and bindings not issued by this loader", () => {
      expectSafeGitUnavailableV1(() =>
        openNativeSafeGitDescriptorBootstrapV1("relative/repository"),
      );
      expectSafeGitUnavailableV1(() =>
        closeNativeSafeGitDescriptorBootstrapV1(
          Object.freeze({}) as NativeSafeGitDescriptorBindingV1,
        ),
      );
    });
  },
);
