import { execFileSync } from "node:child_process";
import {
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
      expect(revalidateNativeSafeGitDescriptorBootstrapV1(opened.binding)).toBe(
        "linked_worktree",
      );
      closeNativeSafeGitDescriptorBootstrapV1(opened.binding);
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
