import {
  chmodSync,
  linkSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  SAFE_GIT_FILESYSTEM_BOOTSTRAP_PROFILE_V1,
  SafeGitBootstrapErrorV1,
  bootstrapSafeGitFilesystemCandidateV1,
  isSafeGitBootstrapCapabilityV1,
} from "../src/safe-git-bootstrap.js";
import { withSafeGitBootstrapTestHooksInternalV1 } from "../src/safe-git-bootstrap-testing-internal.js";
import {
  cleanupTemporaryDirectories,
  git,
  initializeRepository,
  temporaryDirectory,
} from "./helpers.js";

afterEach(cleanupTemporaryDirectories);

async function expectBootstrapFailure(
  operation: Promise<unknown>,
  code: SafeGitBootstrapErrorV1["code"],
  pathCanary: string,
): Promise<void> {
  try {
    await operation;
    throw new Error("expected SafeGit bootstrap to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(SafeGitBootstrapErrorV1);
    expect((error as SafeGitBootstrapErrorV1).code).toBe(code);
    expect((error as Error).message).not.toContain(pathCanary);
  }
}

describe("filesystem-only SafeGit bootstrap candidate", () => {
  it("binds an ordinary repository while every stronger authority remains locked", async () => {
    const root = initializeRepository();
    const result = await bootstrapSafeGitFilesystemCandidateV1(root);

    expect(result.inspection).toEqual({
      profile: SAFE_GIT_FILESYSTEM_BOOTSTRAP_PROFILE_V1,
      status: "verified_candidate",
      layout: "ordinary",
      filesystemBinding: "verified",
      linkedWorktreeBackpointer: "not_applicable",
      descriptorRelativeTraversal: "locked",
      extendedAccessControl: "locked",
      repositoryControlShape: "locked",
      handleBoundExecution: "locked",
      osSandbox: "locked",
      hmacIdentity: "locked",
      strongWrites: "locked",
      requiredNext: [
        "descriptor_relative_traversal",
        "extended_access_control_verification",
        "local_odb_and_ref_backend_verification",
        "handle_bound_execution",
        "os_sandbox",
        "hmac_identity",
        "strong_writer",
      ],
    });
    expect(isSafeGitBootstrapCapabilityV1(result.capability)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(root);
    expect(result.capability.closed).toBe(false);
    await result.capability.close();
    expect(result.capability.closed).toBe(true);
    expect(isSafeGitBootstrapCapabilityV1(result.capability)).toBe(false);
    await result.capability.close();
  });

  it("verifies both backpointers of a real linked worktree", async () => {
    const root = initializeRepository();
    const linkedParent = temporaryDirectory("safe-git-linked");
    const linkedRoot = join(linkedParent, "worktree");
    git(root, ["worktree", "add", "-q", linkedRoot]);

    const result = await bootstrapSafeGitFilesystemCandidateV1(linkedRoot);
    expect(result.inspection).toMatchObject({
      layout: "linked_worktree",
      filesystemBinding: "verified",
      linkedWorktreeBackpointer: "verified",
      descriptorRelativeTraversal: "locked",
      extendedAccessControl: "locked",
      repositoryControlShape: "locked",
      handleBoundExecution: "locked",
      osSandbox: "locked",
      hmacIdentity: "locked",
      strongWrites: "locked",
    });
    expect(JSON.stringify(result)).not.toContain(linkedRoot);
    expect(JSON.stringify(result)).not.toContain(root);
    await result.capability.close();
  });

  it("rejects a relative public root instead of treating cwd as authority", async () => {
    await expectBootstrapFailure(
      bootstrapSafeGitFilesystemCandidateV1("relative/repository"),
      "invalid_root",
      process.cwd(),
    );
  });

  it("rejects a .git file that points at an arbitrary external directory", async () => {
    const parent = temporaryDirectory("safe-git-external");
    const root = join(parent, "workspace");
    const external = join(parent, "external-control");
    mkdirSync(root, { mode: 0o700 });
    mkdirSync(external, { mode: 0o700 });
    writeFileSync(join(root, ".git"), `gitdir: ${realpathSync(external)}\n`, {
      mode: 0o600,
    });

    await expectBootstrapFailure(
      bootstrapSafeGitFilesystemCandidateV1(root),
      "external_git_target",
      parent,
    );
  });

  it.each([
    ["empty target", "gitdir: \n"],
    ["additional line", "gitdir: /outside\nsecond\n"],
    ["NUL byte", "gitdir: /outside\u0000\n"],
    ["CRLF ambiguity", "gitdir: /outside\r\n"],
  ])("rejects malformed strict .git pointers: %s", async (_label, pointer) => {
    const parent = temporaryDirectory("safe-git-malformed-pointer");
    const root = join(parent, "workspace");
    mkdirSync(root, { mode: 0o700 });
    writeFileSync(join(root, ".git"), pointer, { mode: 0o600 });

    await expectBootstrapFailure(
      bootstrapSafeGitFilesystemCandidateV1(root),
      "malformed_git_pointer",
      parent,
    );
  });

  it("rejects a symbolic-link .git control boundary", async () => {
    const parent = temporaryDirectory("safe-git-symlink");
    const root = join(parent, "workspace");
    const external = join(parent, "external-control");
    mkdirSync(root, { mode: 0o700 });
    mkdirSync(external, { mode: 0o700 });
    symlinkSync(external, join(root, ".git"), "dir");

    await expectBootstrapFailure(
      bootstrapSafeGitFilesystemCandidateV1(root),
      "symlink_detected",
      parent,
    );
  });

  it("rejects group- or other-writable repository control metadata", async () => {
    const root = initializeRepository();
    chmodSync(join(root, ".git"), 0o777);

    await expectBootstrapFailure(
      bootstrapSafeGitFilesystemCandidateV1(root),
      "unsafe_mode",
      root,
    );
  });

  it("rejects a multiply-linked administrative pointer", async () => {
    const root = initializeRepository();
    const linkedParent = temporaryDirectory("safe-git-hardlink");
    const linkedRoot = join(linkedParent, "worktree");
    git(root, ["worktree", "add", "-q", linkedRoot]);
    linkSync(join(linkedRoot, ".git"), join(linkedRoot, ".git.alias"));

    await expectBootstrapFailure(
      bootstrapSafeGitFilesystemCandidateV1(linkedRoot),
      "filesystem_binding_invalid",
      linkedParent,
    );
  });

  it("rejects a symlinked linked-worktree commondir pointer", async () => {
    const root = initializeRepository();
    const linkedParent = temporaryDirectory("safe-git-commondir-symlink");
    const linkedRoot = join(linkedParent, "worktree");
    git(root, ["worktree", "add", "-q", linkedRoot]);
    const dotGit = readFileSync(join(linkedRoot, ".git"), "utf8");
    const gitDirectory = dotGit.slice("gitdir: ".length).trimEnd();
    const commonPointer = join(gitDirectory, "commondir");
    renameSync(commonPointer, `${commonPointer}.real`);
    symlinkSync("commondir.real", commonPointer, "file");

    await expectBootstrapFailure(
      bootstrapSafeGitFilesystemCandidateV1(linkedRoot),
      "symlink_detected",
      linkedParent,
    );
  });

  it("rejects a linked worktree whose administrative reverse pointer differs", async () => {
    const root = initializeRepository();
    const linkedParent = temporaryDirectory("safe-git-backpointer");
    const linkedRoot = join(linkedParent, "worktree");
    git(root, ["worktree", "add", "-q", linkedRoot]);
    const dotGit = readFileSync(join(linkedRoot, ".git"), "utf8");
    const gitDirectory = dotGit.slice("gitdir: ".length).trimEnd();
    writeFileSync(join(gitDirectory, "gitdir"), `${join(root, ".git")}\n`);

    await expectBootstrapFailure(
      bootstrapSafeGitFilesystemCandidateV1(linkedRoot),
      "backpointer_mismatch",
      linkedParent,
    );
  });

  it("detects same-kind replacement of an observed ordinary .git directory", async () => {
    const root = initializeRepository();
    const dotGitPath = join(root, ".git");

    await expectBootstrapFailure(
      withSafeGitBootstrapTestHooksInternalV1(
        root,
        {
          afterDotGitObserved: () => {
            renameSync(dotGitPath, join(root, ".git.observed"));
            mkdirSync(dotGitPath, { mode: 0o700 });
          },
        },
        () => bootstrapSafeGitFilesystemCandidateV1(root),
      ),
      "binding_changed",
      root,
    );
  });

  it("detects same-kind replacement of an observed linked .git pointer", async () => {
    const root = initializeRepository();
    const linkedParent = temporaryDirectory("safe-git-pre-open-race");
    const linkedRoot = join(linkedParent, "worktree");
    git(root, ["worktree", "add", "-q", linkedRoot]);
    const dotGitPath = join(linkedRoot, ".git");
    const original = readFileSync(dotGitPath);

    await expectBootstrapFailure(
      withSafeGitBootstrapTestHooksInternalV1(
        linkedRoot,
        {
          afterDotGitObserved: () => {
            renameSync(dotGitPath, join(linkedRoot, ".git.observed"));
            writeFileSync(dotGitPath, original, { mode: 0o644 });
          },
        },
        () => bootstrapSafeGitFilesystemCandidateV1(linkedRoot),
      ),
      "binding_changed",
      linkedParent,
    );
  });

  it("detects replacement of the opened .git pointer before capability publication", async () => {
    const root = initializeRepository();
    const linkedParent = temporaryDirectory("safe-git-race");
    const linkedRoot = join(linkedParent, "worktree");
    git(root, ["worktree", "add", "-q", linkedRoot]);
    const dotGitPath = join(linkedRoot, ".git");
    const original = readFileSync(dotGitPath);

    await expectBootstrapFailure(
      withSafeGitBootstrapTestHooksInternalV1(
        linkedRoot,
        {
          afterBindingsOpened: () => {
            renameSync(dotGitPath, join(linkedRoot, ".git.replaced"));
            writeFileSync(dotGitPath, original, { mode: 0o644 });
          },
        },
        () => bootstrapSafeGitFilesystemCandidateV1(linkedRoot),
      ),
      "binding_changed",
      linkedParent,
    );
  });

  it("rejects a root swapped to a symlink after its first observation", async () => {
    const root = initializeRepository();
    const movedRoot = join(dirname(root), "repository-observed");

    await expectBootstrapFailure(
      withSafeGitBootstrapTestHooksInternalV1(
        root,
        {
          afterRootObserved: () => {
            renameSync(root, movedRoot);
            symlinkSync(movedRoot, root, "dir");
          },
        },
        () => bootstrapSafeGitFilesystemCandidateV1(root),
      ),
      "binding_changed",
      dirname(root),
    );
  });

  it("enforces the fixed pointer byte bound before materialization", async () => {
    const parent = temporaryDirectory("safe-git-pointer-limit");
    const root = join(parent, "workspace");
    mkdirSync(root, { mode: 0o700 });
    writeFileSync(join(root, ".git"), `gitdir: /${"a".repeat(4_096)}\n`, {
      mode: 0o600,
    });

    await expectBootstrapFailure(
      bootstrapSafeGitFilesystemCandidateV1(root),
      "pointer_limit_exceeded",
      parent,
    );
  });

  it("has no Git process execution dependency", () => {
    const source = readFileSync(
      new URL("../src/safe-git-bootstrap.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain("node:child_process");
    expect(source).not.toContain("executeGit(");
    expect(source).not.toContain("execFile(");
    expect(source).not.toContain("spawn(");
  });
});
