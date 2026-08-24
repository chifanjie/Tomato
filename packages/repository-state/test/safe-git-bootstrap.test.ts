import { execFileSync } from "node:child_process";
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
import type {
  NativeSafeGitDescriptorBindingV1,
} from "@understand-code/native-kernel-bridge";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SAFE_GIT_DESCRIPTOR_BOOTSTRAP_PROFILE_V1,
  SAFE_GIT_REPOSITORY_IDENTITY_PROFILE_V1,
  SAFE_GIT_REPOSITORY_CONTROL_PROFILE_V1,
  SafeGitBootstrapErrorV1,
  bootstrapSafeGitDescriptorBoundCandidateV1 as bootstrapSafeGitFilesystemCandidateV1,
  isSafeGitDescriptorBoundCapabilityV1 as isSafeGitBootstrapCapabilityV1,
} from "../src/safe-git-bootstrap.js";
import { withSafeGitBootstrapTestHooksInternalV1 } from "../src/safe-git-bootstrap-testing-internal.js";
import {
  cleanupTemporaryDirectories,
  git,
  initializeRepository,
  temporaryDirectory,
} from "./helpers.js";

const identityAuthorityTestStateV1 = vi.hoisted(() => ({
  derivations: 0,
  keyByte: 0x41,
  unavailable: false,
}));

vi.mock(
  "@understand-code/durable-object-provider-authority/internal/acceptance-store",
  async () => {
    const native = await vi.importActual<
      typeof import("@understand-code/native-kernel-bridge")
    >("@understand-code/native-kernel-bridge");
    return {
      deriveProviderAcceptanceSafeGitPathIdentityInternalV1: async (
        binding: NativeSafeGitDescriptorBindingV1,
      ) => {
        identityAuthorityTestStateV1.derivations += 1;
        if (identityAuthorityTestStateV1.unavailable) {
          throw new Error("test identity authority unavailable");
        }
        const key = Buffer.alloc(32, identityAuthorityTestStateV1.keyByte);
        try {
          return native.deriveNativeSafeGitPathIdentityV1(binding, key);
        } finally {
          key.fill(0);
        }
      },
    };
  },
);

afterEach(() => {
  identityAuthorityTestStateV1.derivations = 0;
  identityAuthorityTestStateV1.keyByte = 0x41;
  identityAuthorityTestStateV1.unavailable = false;
  cleanupTemporaryDirectories();
});

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

describe("descriptor-bound SafeGit bootstrap candidate", () => {
  it("uses a distinct versioned descriptor-bound profile", async () => {
    expect(SAFE_GIT_DESCRIPTOR_BOOTSTRAP_PROFILE_V1).toBe(
      "descriptor_bound_safe_git_bootstrap_candidate_v1",
    );
    const root = initializeRepository();
    const result = await bootstrapSafeGitFilesystemCandidateV1(root);
    expect(result.inspection.profile).toBe(
      SAFE_GIT_DESCRIPTOR_BOOTSTRAP_PROFILE_V1,
    );
    await result.capability.close();
  });

  it("binds an ordinary repository while later SafeGit authorities remain locked", async () => {
    const root = initializeRepository();
    const result = await bootstrapSafeGitFilesystemCandidateV1(root);

    expect(result.inspection).toEqual({
      profile: SAFE_GIT_DESCRIPTOR_BOOTSTRAP_PROFILE_V1,
      status: "verified_candidate",
      layout: "ordinary",
      filesystemBinding: "verified",
      linkedWorktreeBackpointer: "not_applicable",
      descriptorRelativeTraversal: "verified",
      extendedAccessControl: "verified",
      nativeHandleCustody: "verified",
      repositoryControlShape: "locked",
      repositoryControlReader: "locked",
      localObjectDatabase: "locked",
      refBackend: "locked",
      handleBoundExecution: "locked",
      osSandbox: "locked",
      hmacIdentity: "locked",
      strongWrites: "locked",
      requiredNext: [
        "repository_control_reader",
        "local_odb_and_ref_backend_verification",
        "handle_bound_execution",
        "os_sandbox",
        "hmac_identity",
        "strong_writer",
      ],
    });
    expect(isSafeGitBootstrapCapabilityV1(result.capability)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(root);
    expect(JSON.parse(JSON.stringify(result.capability))).toEqual({
      profile: SAFE_GIT_DESCRIPTOR_BOOTSTRAP_PROFILE_V1,
    });
    expect(result.capability.closed).toBe(false);
    await expect(result.capability.revalidate()).resolves.toEqual(
      result.inspection,
    );
    await result.capability.close();
    expect(result.capability.closed).toBe(true);
    expect(isSafeGitBootstrapCapabilityV1(result.capability)).toBe(false);
    await result.capability.close();
    await expectBootstrapFailure(
      result.capability.revalidate(),
      "binding_changed",
      root,
    );
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
      descriptorRelativeTraversal: "verified",
      extendedAccessControl: "verified",
      nativeHandleCustody: "verified",
      repositoryControlShape: "locked",
      repositoryControlReader: "locked",
      localObjectDatabase: "locked",
      refBackend: "locked",
      handleBoundExecution: "locked",
      osSandbox: "locked",
      hmacIdentity: "locked",
      strongWrites: "locked",
    });
    expect(JSON.stringify(result)).not.toContain(linkedRoot);
    expect(JSON.stringify(result)).not.toContain(root);
    await expect(result.capability.revalidate()).resolves.toMatchObject({
      layout: "linked_worktree",
      descriptorRelativeTraversal: "verified",
      extendedAccessControl: "verified",
      nativeHandleCustody: "verified",
    });
    await result.capability.close();
  });

  it("promotes an ordinary binding to path-redacted local ODB and files-ref authority", async () => {
    const root = initializeRepository();
    const result = await bootstrapSafeGitFilesystemCandidateV1(root);

    const control = await result.capability.bindRepositoryControl();
    expect(control).toEqual({
      profile: SAFE_GIT_REPOSITORY_CONTROL_PROFILE_V1,
      status: "verified_candidate",
      layout: "ordinary",
      filesystemBinding: "verified",
      linkedWorktreeBackpointer: "not_applicable",
      descriptorRelativeTraversal: "verified",
      extendedAccessControl: "verified",
      nativeHandleCustody: "verified",
      repositoryControlShape: "verified",
      repositoryControlReader: "verified",
      localObjectDatabase: "verified",
      refBackend: "verified",
      objectFormat: control.objectFormat,
      objectDatabase: "local_only_verified",
      repositoryConfig: "verified",
      worktreeConfig: "absent",
      emptyHooksDirectory: "locked",
      handleBoundExecution: "locked",
      osSandbox: "locked",
      hmacIdentity: "locked",
      strongWrites: "locked",
      requiredNext: [
        "empty_hooks_directory",
        "handle_bound_execution",
        "os_sandbox",
        "hmac_identity",
        "strong_writer",
      ],
    });
    expect(["sha1", "sha256"]).toContain(control.objectFormat);
    expect(JSON.stringify(control)).not.toContain(root);
    await expect(result.capability.revalidate()).resolves.toEqual(control);
    await result.capability.close();
  });

  it("promotes a real linked worktree without exposing either Host root", async () => {
    const root = initializeRepository();
    const linkedParent = temporaryDirectory("safe-git-control-linked");
    const linkedRoot = join(linkedParent, "worktree");
    git(root, ["worktree", "add", "-q", linkedRoot]);
    const result = await bootstrapSafeGitFilesystemCandidateV1(linkedRoot);

    const control = await result.capability.bindRepositoryControl();
    expect(control).toMatchObject({
      profile: SAFE_GIT_REPOSITORY_CONTROL_PROFILE_V1,
      layout: "linked_worktree",
      linkedWorktreeBackpointer: "verified",
      repositoryControlShape: "verified",
      repositoryControlReader: "verified",
      localObjectDatabase: "verified",
      refBackend: "verified",
      objectDatabase: "local_only_verified",
      repositoryConfig: "verified",
      worktreeConfig: "absent",
      emptyHooksDirectory: "locked",
      handleBoundExecution: "locked",
      osSandbox: "locked",
      hmacIdentity: "locked",
      strongWrites: "locked",
    });
    expect(JSON.stringify(control)).not.toContain(root);
    expect(JSON.stringify(control)).not.toContain(linkedRoot);
    await expect(result.capability.revalidate()).resolves.toEqual(control);
    await result.capability.close();
  });

  it("keeps path-safe HMAC identities stable across ordinary repository restarts", async () => {
    const root = initializeRepository();
    const first = await bootstrapSafeGitFilesystemCandidateV1(root);
    await first.capability.bindRepositoryControl();
    const firstControl = await first.capability.bindRepositoryIdentity();
    await first.capability.close();

    const restarted = await bootstrapSafeGitFilesystemCandidateV1(root);
    await restarted.capability.bindRepositoryControl();
    const restartedControl =
      await restarted.capability.bindRepositoryIdentity();
    expect(restartedControl).toMatchObject({
      profile: SAFE_GIT_REPOSITORY_IDENTITY_PROFILE_V1,
      hmacIdentity: "verified",
      emptyHooksDirectory: "locked",
      handleBoundExecution: "locked",
      osSandbox: "locked",
      strongWrites: "locked",
      requiredNext: [
        "empty_hooks_directory",
        "handle_bound_execution",
        "os_sandbox",
        "strong_writer",
      ],
    });
    expect(restartedControl.repositoryId).toMatch(/^repo-hmac-[0-9a-f]{64}$/u);
    expect(restartedControl.worktreeId).toMatch(
      /^worktree-hmac-[0-9a-f]{64}$/u,
    );
    expect(restartedControl.rootIdentity).toMatch(
      /^root-hmac-[0-9a-f]{64}$/u,
    );
    expect({
      repositoryId: restartedControl.repositoryId,
      worktreeId: restartedControl.worktreeId,
      rootIdentity: restartedControl.rootIdentity,
    }).toEqual({
      repositoryId: firstControl.repositoryId,
      worktreeId: firstControl.worktreeId,
      rootIdentity: firstControl.rootIdentity,
    });
    expect(JSON.stringify(restartedControl)).not.toContain(root);
    await expect(restarted.capability.revalidate()).resolves.toEqual(
      restartedControl,
    );
    await restarted.capability.close();
    expect(restarted.capability.closed).toBe(true);
    await expectBootstrapFailure(
      restarted.capability.revalidate(),
      "binding_changed",
      root,
    );
  });

  it("does not open installation identity before repository control is bound", async () => {
    const root = initializeRepository();
    const result = await bootstrapSafeGitFilesystemCandidateV1(root);

    await expectBootstrapFailure(
      result.capability.bindRepositoryIdentity(),
      "repository_identity_invalid",
      root,
    );
    expect(identityAuthorityTestStateV1.derivations).toBe(0);
    expect(result.capability.closed).toBe(false);
    await expect(result.capability.bindRepositoryControl()).resolves.toMatchObject({
      profile: SAFE_GIT_REPOSITORY_CONTROL_PROFILE_V1,
      hmacIdentity: "locked",
    });
    await result.capability.close();
  });

  it("shares repository identity but isolates real linked worktree and root identities", async () => {
    const root = initializeRepository();
    const linkedParent = temporaryDirectory("safe-git-identity-linked");
    const linkedRoot = join(linkedParent, "worktree");
    git(root, ["worktree", "add", "-q", linkedRoot]);

    const ordinary = await bootstrapSafeGitFilesystemCandidateV1(root);
    const linked = await bootstrapSafeGitFilesystemCandidateV1(linkedRoot);
    await ordinary.capability.bindRepositoryControl();
    await linked.capability.bindRepositoryControl();
    const ordinaryControl =
      await ordinary.capability.bindRepositoryIdentity();
    const linkedControl = await linked.capability.bindRepositoryIdentity();

    expect(linkedControl.repositoryId).toBe(ordinaryControl.repositoryId);
    expect(linkedControl.worktreeId).not.toBe(ordinaryControl.worktreeId);
    expect(linkedControl.rootIdentity).not.toBe(ordinaryControl.rootIdentity);
    expect(JSON.stringify({ ordinaryControl, linkedControl })).not.toContain(root);
    expect(JSON.stringify({ ordinaryControl, linkedControl })).not.toContain(
      linkedRoot,
    );
    await Promise.all([
      ordinary.capability.close(),
      linked.capability.close(),
    ]);
  });

  it("poisons a promoted capability when installation identity drifts", async () => {
    const root = initializeRepository();
    const result = await bootstrapSafeGitFilesystemCandidateV1(root);
    await result.capability.bindRepositoryControl();
    await result.capability.bindRepositoryIdentity();
    identityAuthorityTestStateV1.keyByte = 0x42;

    await expectBootstrapFailure(
      result.capability.revalidate(),
      "binding_changed",
      root,
    );
    expect(result.capability.closed).toBe(true);
    expect(isSafeGitBootstrapCapabilityV1(result.capability)).toBe(false);
  });

  it("fails closed without exposing repository paths when identity authority is unavailable", async () => {
    const root = initializeRepository();
    const result = await bootstrapSafeGitFilesystemCandidateV1(root);
    await result.capability.bindRepositoryControl();
    identityAuthorityTestStateV1.unavailable = true;

    await expectBootstrapFailure(
      result.capability.bindRepositoryIdentity(),
      "repository_identity_invalid",
      root,
    );
    expect(result.capability.closed).toBe(true);
    expect(isSafeGitBootstrapCapabilityV1(result.capability)).toBe(false);
  });

  it("verifies explicitly enabled worktree-scoped configuration", async () => {
    const root = initializeRepository();
    git(root, ["config", "core.repositoryformatversion", "1"]);
    git(root, ["config", "extensions.worktreeConfig", "true"]);
    git(root, ["config", "--worktree", "core.sparseCheckout", "false"]);
    const result = await bootstrapSafeGitFilesystemCandidateV1(root);

    const control = await result.capability.bindRepositoryControl();
    expect(control).toMatchObject({
      repositoryConfig: "verified",
      worktreeConfig: "verified",
      localObjectDatabase: "verified",
      refBackend: "verified",
    });
    await expect(result.capability.revalidate()).resolves.toEqual(control);
    await result.capability.close();
  });

  it("rejects an alternate object database before granting local ODB authority", async () => {
    const root = initializeRepository();
    writeFileSync(join(root, ".git", "objects", "info", "alternates"), "/outside\n", {
      mode: 0o600,
    });
    const result = await bootstrapSafeGitFilesystemCandidateV1(root);

    await expectBootstrapFailure(
      result.capability.bindRepositoryControl(),
      "repository_control_invalid",
      root,
    );
    expect(result.capability.closed).toBe(true);
    expect(isSafeGitBootstrapCapabilityV1(result.capability)).toBe(false);
  });

  it("rejects include and unsupported ref-storage configuration", async () => {
    for (const unsafeConfig of [
      "\n[include]\n\tpath = /outside/config\n",
      "\n[extensions]\n\trefStorage = reftable\n",
    ]) {
      const root = initializeRepository();
      const configPath = join(root, ".git", "config");
      writeFileSync(
        configPath,
        Buffer.concat([readFileSync(configPath), Buffer.from(unsafeConfig)]),
        { mode: 0o600 },
      );
      const result = await bootstrapSafeGitFilesystemCandidateV1(root);
      await expectBootstrapFailure(
        result.capability.bindRepositoryControl(),
        "repository_control_invalid",
        root,
      );
      expect(result.capability.closed).toBe(true);
    }
  });

  it("poisons promoted authority when bound repository config is replaced", async () => {
    const root = initializeRepository();
    const result = await bootstrapSafeGitFilesystemCandidateV1(root);
    await result.capability.bindRepositoryControl();
    const configPath = join(root, ".git", "config");
    const original = readFileSync(configPath);
    renameSync(configPath, `${configPath}.bound`);
    writeFileSync(configPath, original, { mode: 0o600 });

    await expectBootstrapFailure(
      result.capability.revalidate(),
      "binding_changed",
      root,
    );
    expect(result.capability.closed).toBe(true);
    expect(isSafeGitBootstrapCapabilityV1(result.capability)).toBe(false);
  });

  it("fails closed when a descriptor-bound ordinary .git directory is replaced", async () => {
    const root = initializeRepository();
    const result = await bootstrapSafeGitFilesystemCandidateV1(root);
    const dotGitPath = join(root, ".git");
    renameSync(dotGitPath, join(root, ".git.bound"));
    mkdirSync(dotGitPath, { mode: 0o700 });

    await expectBootstrapFailure(
      result.capability.revalidate(),
      "binding_changed",
      root,
    );
    expect(result.capability.closed).toBe(true);
    expect(isSafeGitBootstrapCapabilityV1(result.capability)).toBe(false);
    await result.capability.close();
  });

  it("fails closed when a descriptor-bound linked-worktree pointer is replaced", async () => {
    const root = initializeRepository();
    const linkedParent = temporaryDirectory("safe-git-revalidate-linked");
    const linkedRoot = join(linkedParent, "worktree");
    git(root, ["worktree", "add", "-q", linkedRoot]);
    const result = await bootstrapSafeGitFilesystemCandidateV1(linkedRoot);
    const dotGitPath = join(linkedRoot, ".git");
    const original = readFileSync(dotGitPath);
    renameSync(dotGitPath, join(linkedRoot, ".git.bound"));
    writeFileSync(dotGitPath, original, { mode: 0o600 });

    await expectBootstrapFailure(
      result.capability.revalidate(),
      "binding_changed",
      linkedParent,
    );
    expect(JSON.stringify(result)).not.toContain(linkedRoot);
    expect(JSON.stringify(result)).not.toContain(root);
    expect(result.capability.closed).toBe(true);
    expect(isSafeGitBootstrapCapabilityV1(result.capability)).toBe(false);
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

  it("rejects a special .git file without a blocking regular-file open", async () => {
    const parent = temporaryDirectory("safe-git-fifo");
    const root = join(parent, "workspace");
    mkdirSync(root, { mode: 0o700 });
    execFileSync("mkfifo", [join(root, ".git")], { stdio: "pipe" });

    await expectBootstrapFailure(
      bootstrapSafeGitFilesystemCandidateV1(root),
      "unsafe_file_kind",
      parent,
    );
    const source = readFileSync(
      new URL("../src/safe-git-bootstrap.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("openFlags.nonBlock");
    expect(source).toContain("openFlags.noControllingTerminal");
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

  it("rejects a root namespace swap during native capability publication", async () => {
    const root = initializeRepository();
    const observedRoot = join(dirname(root), "repository.native-bound");

    await expectBootstrapFailure(
      withSafeGitBootstrapTestHooksInternalV1(
        root,
        {
          afterNativeBindingOpened: () => {
            renameSync(root, observedRoot);
            mkdirSync(root, { mode: 0o700 });
            git(root, ["init", "-q", "-b", "main"]);
          },
        },
        () => bootstrapSafeGitFilesystemCandidateV1(root),
      ),
      "binding_changed",
      dirname(root),
    );
  });

  it("revalidates native custody after legacy descriptor cleanup", async () => {
    const root = initializeRepository();
    const observedRoot = join(dirname(root), "repository.legacy-closed");

    await expectBootstrapFailure(
      withSafeGitBootstrapTestHooksInternalV1(
        root,
        {
          afterLegacyBindingsClosed: () => {
            renameSync(root, observedRoot);
            mkdirSync(root, { mode: 0o700 });
            git(root, ["init", "-q", "-b", "main"]);
          },
        },
        () => bootstrapSafeGitFilesystemCandidateV1(root),
      ),
      "binding_changed",
      dirname(root),
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
