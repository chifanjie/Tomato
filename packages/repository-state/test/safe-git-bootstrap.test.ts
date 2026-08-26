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
  SAFE_GIT_EMPTY_HOOKS_PROFILE_V1,
  SAFE_GIT_DESCRIPTOR_BOOTSTRAP_PROFILE_V1,
  SAFE_GIT_EXECUTABLE_BINDING_PROFILE_V1,
  SAFE_GIT_REPOSITORY_IDENTITY_PROFILE_V1,
  SAFE_GIT_REPOSITORY_CONTROL_PROFILE_V1,
  SAFE_GIT_VERSION_PROBE_PROFILE_V1,
  SafeGitBootstrapErrorV1,
  bootstrapSafeGitDescriptorBoundCandidateV1 as bootstrapSafeGitFilesystemCandidateV1,
  isSafeGitDescriptorBoundCapabilityV1 as isSafeGitBootstrapCapabilityV1,
} from "../src/safe-git-bootstrap.js";
import { withSafeGitBootstrapTestHooksInternalV1 } from "../src/safe-git-bootstrap-testing-internal.js";
import {
  classifySafeGitReadCommandV1,
  type SafeGitReadCommandV1,
} from "../src/safe-git-read-command.js";
import {
  cleanupTemporaryDirectories,
  git,
  initializeRepository,
  temporaryDirectory,
} from "./helpers.js";

const identityAuthorityTestStateV1 = vi.hoisted(() => ({
  derivations: 0,
  emptyHooksBindings: 0,
  keyByte: 0x41,
  unavailable: false,
  emptyHooksUnavailable: false,
  emptyHooksTokenByte: 0x51,
  executableBindings: 0,
  executableUnavailable: false,
  executablePath: undefined as string | undefined,
}));

const safeGitExecutionTestStateV1 = vi.hoisted(() => ({
  executions: 0,
  reads: 0,
  requests: [] as unknown[],
  unavailable: false,
}));

vi.mock(
  "@understand-code/durable-object-provider-authority/internal/acceptance-store",
  async () => {
    const native = await vi.importActual<
      typeof import("@understand-code/native-kernel-bridge")
    >("@understand-code/native-kernel-bridge");
    return {
      executeProviderAcceptanceSafeGitVersionInternalV1: async () => {
        safeGitExecutionTestStateV1.executions += 1;
        if (safeGitExecutionTestStateV1.unavailable) {
          throw new Error("test SafeGit execution unavailable");
        }
        return Object.freeze({ major: 2, minor: 50, patch: 1 });
      },
      executeProviderAcceptanceSafeGitReadInternalV1: async (
        _binding: NativeSafeGitDescriptorBindingV1,
        request: unknown,
      ) => {
        safeGitExecutionTestStateV1.reads += 1;
        safeGitExecutionTestStateV1.requests.push(request);
        return Object.freeze({
          stdout: Buffer.from("/descriptor-bound/repository\n", "utf8"),
          stderr: Buffer.alloc(0),
          exitCode: 0,
        });
      },
      bindProviderAcceptanceSafeGitExecutableInternalV1: async (
        _binding: NativeSafeGitDescriptorBindingV1,
        absoluteExecutablePath: string,
      ) => {
        identityAuthorityTestStateV1.executableBindings += 1;
        if (
          identityAuthorityTestStateV1.executableUnavailable ||
          (identityAuthorityTestStateV1.executablePath !== undefined &&
            identityAuthorityTestStateV1.executablePath !==
              absoluteExecutablePath)
        ) {
          throw new Error(
            `test executable authority unavailable: ${absoluteExecutablePath}`,
          );
        }
        identityAuthorityTestStateV1.executablePath = absoluteExecutablePath;
        return Object.freeze({
          profile: "native_safe_git_executable_binding_v1" as const,
          executableBinding: "verified" as const,
        });
      },
      bindProviderAcceptanceSafeGitEmptyHooksDirectoryInternalV1: async () => {
        identityAuthorityTestStateV1.emptyHooksBindings += 1;
        if (identityAuthorityTestStateV1.emptyHooksUnavailable) {
          throw new Error("test empty-hooks authority unavailable");
        }
        return Object.freeze({
          profile: "native_safe_git_empty_hooks_binding_v1" as const,
          directoryIdentity: Object.freeze({
            platform: "posix" as const,
            device: "1",
            inode: "2",
          }),
          emptyHooksDirectoryToken: `hmac-sha256:${identityAuthorityTestStateV1.emptyHooksTokenByte
            .toString(16)
            .padStart(2, "0")
            .repeat(32)}` as const,
        });
      },
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
  identityAuthorityTestStateV1.emptyHooksBindings = 0;
  identityAuthorityTestStateV1.keyByte = 0x41;
  identityAuthorityTestStateV1.unavailable = false;
  identityAuthorityTestStateV1.emptyHooksUnavailable = false;
  identityAuthorityTestStateV1.emptyHooksTokenByte = 0x51;
  identityAuthorityTestStateV1.executableBindings = 0;
  identityAuthorityTestStateV1.executableUnavailable = false;
  identityAuthorityTestStateV1.executablePath = undefined;
  safeGitExecutionTestStateV1.executions = 0;
  safeGitExecutionTestStateV1.reads = 0;
  safeGitExecutionTestStateV1.requests.length = 0;
  safeGitExecutionTestStateV1.unavailable = false;
  cleanupTemporaryDirectories();
});

async function expectBootstrapFailure(
  operation: Promise<unknown>,
  code: SafeGitBootstrapErrorV1["code"],
  pathCanaries: string | readonly string[],
): Promise<void> {
  try {
    await operation;
    throw new Error("expected SafeGit bootstrap to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(SafeGitBootstrapErrorV1);
    expect((error as SafeGitBootstrapErrorV1).code).toBe(code);
    for (const pathCanary of typeof pathCanaries === "string"
      ? [pathCanaries]
      : pathCanaries) {
      expect((error as Error).message).not.toContain(pathCanary);
    }
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

  it("promotes repository identity to a path-redacted empty-hooks authority", async () => {
    const root = initializeRepository();
    const result = await bootstrapSafeGitFilesystemCandidateV1(root);
    await result.capability.bindRepositoryControl();
    const identity = await result.capability.bindRepositoryIdentity();

    const emptyHooks = await result.capability.bindEmptyHooksDirectory();
    expect(emptyHooks).toEqual({
      ...identity,
      profile: SAFE_GIT_EMPTY_HOOKS_PROFILE_V1,
      emptyHooksDirectory: "verified",
      requiredNext: [
        "handle_bound_execution",
        "os_sandbox",
        "strong_writer",
      ],
    });
    expect(identityAuthorityTestStateV1.emptyHooksBindings).toBe(1);
    expect(JSON.stringify(emptyHooks)).not.toContain(root);
    expect(JSON.stringify(emptyHooks)).not.toContain("hmac-sha256:");
    await expect(result.capability.revalidate()).resolves.toEqual(emptyHooks);
    expect(identityAuthorityTestStateV1.emptyHooksBindings).toBe(2);
    await result.capability.close();
  });

  it("does not request empty-hooks authority before repository identity is bound", async () => {
    const root = initializeRepository();
    const result = await bootstrapSafeGitFilesystemCandidateV1(root);
    await result.capability.bindRepositoryControl();

    await expectBootstrapFailure(
      result.capability.bindEmptyHooksDirectory(),
      "empty_hooks_directory_invalid",
      root,
    );
    expect(identityAuthorityTestStateV1.emptyHooksBindings).toBe(0);
    expect(result.capability.closed).toBe(false);
    await result.capability.close();
  });

  it("poisons empty-hooks authority on token drift or custody failure", async () => {
    for (const failure of ["token_drift", "custody_failure"] as const) {
      const root = initializeRepository();
      const result = await bootstrapSafeGitFilesystemCandidateV1(root);
      await result.capability.bindRepositoryControl();
      await result.capability.bindRepositoryIdentity();
      await result.capability.bindEmptyHooksDirectory();
      if (failure === "token_drift") {
        identityAuthorityTestStateV1.emptyHooksTokenByte = 0x52;
      } else {
        identityAuthorityTestStateV1.emptyHooksUnavailable = true;
      }

      await expectBootstrapFailure(
        result.capability.revalidate(),
        "binding_changed",
        root,
      );
      expect(result.capability.closed).toBe(true);
      expect(isSafeGitBootstrapCapabilityV1(result.capability)).toBe(false);
      identityAuthorityTestStateV1.emptyHooksUnavailable = false;
      identityAuthorityTestStateV1.emptyHooksTokenByte = 0x51;
    }
  });

  it("promotes only an explicit absolute Git executable with a fixed redacted projection", async () => {
    const root = initializeRepository();
    const absoluteExecutablePath = join(
      temporaryDirectory("safe-git-executable"),
      "git",
    );
    const result = await bootstrapSafeGitFilesystemCandidateV1(root);
    await result.capability.bindRepositoryControl();
    await result.capability.bindRepositoryIdentity();

    await expectBootstrapFailure(
      result.capability.bindGitExecutable(absoluteExecutablePath),
      "executable_binding_invalid",
      [root, absoluteExecutablePath],
    );
    expect(identityAuthorityTestStateV1.executableBindings).toBe(0);
    expect(result.capability.closed).toBe(false);

    const emptyHooks = await result.capability.bindEmptyHooksDirectory();
    await expectBootstrapFailure(
      result.capability.bindGitExecutable("git"),
      "executable_binding_invalid",
      root,
    );
    expect(identityAuthorityTestStateV1.executableBindings).toBe(0);
    expect(result.capability.closed).toBe(false);

    const executable =
      await result.capability.bindGitExecutable(absoluteExecutablePath);
    expect(executable).toEqual({
      ...emptyHooks,
      profile: SAFE_GIT_EXECUTABLE_BINDING_PROFILE_V1,
      executableBinding: "verified",
      gitVersion: "locked",
      requiredNext: [
        "git_version_diagnostic",
        "handle_bound_execution",
        "os_sandbox",
        "strong_writer",
      ],
    });
    expect(identityAuthorityTestStateV1.executableBindings).toBe(1);
    const serialized = JSON.stringify({
      executable,
      capability: result.capability,
    });
    expect(serialized).not.toContain(root);
    expect(serialized).not.toContain(absoluteExecutablePath);
    expect(serialized).not.toContain("hmac-sha256:");
    expect(serialized).not.toMatch(/(?:device|digest|inode|path|token)/iu);

    await expect(
      result.capability.bindGitExecutable(absoluteExecutablePath),
    ).resolves.toEqual(executable);
    expect(identityAuthorityTestStateV1.executableBindings).toBe(2);
    await expect(result.capability.revalidate()).resolves.toEqual(executable);
    expect(identityAuthorityTestStateV1.executableBindings).toBe(2);
    await result.capability.close();
    await result.capability.close();
    expect(result.capability.closed).toBe(true);
  });

  it("permanently poisons executable authority on path mismatch or native drift", async () => {
    for (const failure of [
      "path_mismatch",
      "native_drift",
      "descriptor_drift",
    ] as const) {
      identityAuthorityTestStateV1.executablePath = undefined;
      identityAuthorityTestStateV1.executableUnavailable = false;
      const root = initializeRepository();
      const absoluteExecutablePath = join(
        temporaryDirectory("safe-git-executable"),
        "git",
      );
      const result = await bootstrapSafeGitFilesystemCandidateV1(root);
      await result.capability.bindRepositoryControl();
      await result.capability.bindRepositoryIdentity();
      await result.capability.bindEmptyHooksDirectory();
      await result.capability.bindGitExecutable(absoluteExecutablePath);

      if (failure === "path_mismatch") {
        const differentExecutablePath = join(
          temporaryDirectory("safe-git-executable-other"),
          "git",
        );
        await expectBootstrapFailure(
          result.capability.bindGitExecutable(
            differentExecutablePath,
          ),
          "executable_binding_invalid",
          [root, absoluteExecutablePath, differentExecutablePath],
        );
      } else if (failure === "native_drift") {
        identityAuthorityTestStateV1.executableUnavailable = true;
        await expectBootstrapFailure(
          result.capability.bindGitExecutable(absoluteExecutablePath),
          "executable_binding_invalid",
          [root, absoluteExecutablePath],
        );
      } else {
        renameSync(join(root, ".git"), join(root, ".git.drifted"));
        await expectBootstrapFailure(
          result.capability.revalidate(),
          "binding_changed",
          root,
        );
      }
      expect(result.capability.closed).toBe(true);
      expect(isSafeGitBootstrapCapabilityV1(result.capability)).toBe(false);
      identityAuthorityTestStateV1.executableUnavailable = false;
    }
  });

  it("promotes a real native version probe without accepting caller output", async () => {
    const root = initializeRepository();
    const absoluteExecutablePath = join(
      temporaryDirectory("safe-git-version-executable"),
      "git",
    );
    const result = await bootstrapSafeGitFilesystemCandidateV1(root);

    await expectBootstrapFailure(
      result.capability.executeGitVersion(),
      "version_execution_invalid",
      root,
    );
    expect(result.capability.closed).toBe(false);
    expect(safeGitExecutionTestStateV1.executions).toBe(0);

    await result.capability.bindRepositoryControl();
    await result.capability.bindRepositoryIdentity();
    await result.capability.bindEmptyHooksDirectory();
    await result.capability.bindGitExecutable(absoluteExecutablePath);
    const version = await result.capability.executeGitVersion();

    expect(version).toMatchObject({
      profile: SAFE_GIT_VERSION_PROBE_PROFILE_V1,
      gitVersion: { major: 2, minor: 50, patch: 1 },
      handleBoundExecution: "verified_version_probe",
      osSandbox: "verified_version_probe",
      requiredNext: ["remaining_safe_git_commands", "strong_writer"],
    });
    expect(Object.isFrozen(version)).toBe(true);
    expect(Object.isFrozen(version.gitVersion)).toBe(true);
    expect(safeGitExecutionTestStateV1.executions).toBe(1);
    await expect(result.capability.revalidate()).resolves.toEqual(version);
    expect(safeGitExecutionTestStateV1.executions).toBe(1);
    await result.capability.close();
  });

  it("mints the read executor only after the same capability completes its version probe", async () => {
    const root = initializeRepository();
    const absoluteExecutablePath = join(
      temporaryDirectory("safe-git-read-version-gate"),
      "git",
    );
    const result = await bootstrapSafeGitFilesystemCandidateV1(root);
    await result.capability.bindRepositoryControl();
    await result.capability.bindRepositoryIdentity();
    await result.capability.bindEmptyHooksDirectory();
    await result.capability.bindGitExecutable(absoluteExecutablePath);

    expect(() => result.capability.createReadExecutor()).toThrowError(
      expect.objectContaining({ code: "read_execution_invalid" }),
    );
    expect(result.capability.closed).toBe(true);

    const readyRoot = initializeRepository();
    const ready = await bootstrapSafeGitFilesystemCandidateV1(readyRoot);
    await ready.capability.bindRepositoryControl();
    await ready.capability.bindRepositoryIdentity();
    await ready.capability.bindEmptyHooksDirectory();
    await ready.capability.bindGitExecutable(absoluteExecutablePath);
    await ready.capability.executeGitVersion();
    const executor = ready.capability.createReadExecutor();
    expect(ready.capability.createReadExecutor()).toBe(executor);
    await expect(
      executor.execute(
        classifySafeGitReadCommandV1(["rev-parse", "--show-toplevel"]),
      ),
    ).resolves.toMatchObject({ exitCode: 0, stderr: Buffer.alloc(0) });
    expect(safeGitExecutionTestStateV1.reads).toBe(1);
    expect(safeGitExecutionTestStateV1.requests).toEqual([
      { profile: "rev_parse_show_toplevel_v1" },
    ]);
    await ready.capability.close();
  });

  it("rejects accessor and Proxy command DTOs without invoking traps", async () => {
    const absoluteExecutablePath = join(
      temporaryDirectory("safe-git-read-dto"),
      "git",
    );
    const createReady = async () => {
      const result = await bootstrapSafeGitFilesystemCandidateV1(
        initializeRepository(),
      );
      await result.capability.bindRepositoryControl();
      await result.capability.bindRepositoryIdentity();
      await result.capability.bindEmptyHooksDirectory();
      await result.capability.bindGitExecutable(absoluteExecutablePath);
      await result.capability.executeGitVersion();
      return result;
    };

    let getterExecutions = 0;
    const accessorCommand = Object.create(null) as SafeGitReadCommandV1;
    Object.defineProperties(accessorCommand, {
      acceptedExitCodes: { value: Object.freeze([0]) },
      outputFraming: { value: "text" },
      request: {
        get() {
          getterExecutions += 1;
          return { profile: "rev_parse_show_toplevel_v1" };
        },
      },
      stderrLimitBytes: { value: 64 * 1_024 },
      stdoutLimitBytes: { value: 4 * 1_024 },
    });
    const accessorReady = await createReady();
    await expect(
      accessorReady.capability.createReadExecutor().execute(accessorCommand),
    ).rejects.toMatchObject({ code: "read_execution_invalid" });
    expect(getterExecutions).toBe(0);
    expect(accessorReady.capability.closed).toBe(true);

    let proxyTrapExecutions = 0;
    const validCommand = classifySafeGitReadCommandV1([
      "rev-parse",
      "--show-toplevel",
    ]);
    const proxyCommand = new Proxy(validCommand, {
      get(target, property, receiver) {
        proxyTrapExecutions += 1;
        return Reflect.get(target, property, receiver);
      },
    });
    const proxyReady = await createReady();
    await expect(
      proxyReady.capability.createReadExecutor().execute(proxyCommand),
    ).rejects.toMatchObject({ code: "read_execution_invalid" });
    expect(proxyTrapExecutions).toBe(0);
    expect(proxyReady.capability.closed).toBe(true);
    expect(safeGitExecutionTestStateV1.reads).toBe(0);
  });

  it("fails closed when a read is already aborted", async () => {
    const root = initializeRepository();
    const absoluteExecutablePath = join(
      temporaryDirectory("safe-git-read-abort"),
      "git",
    );
    const result = await bootstrapSafeGitFilesystemCandidateV1(root);
    await result.capability.bindRepositoryControl();
    await result.capability.bindRepositoryIdentity();
    await result.capability.bindEmptyHooksDirectory();
    await result.capability.bindGitExecutable(absoluteExecutablePath);
    await result.capability.executeGitVersion();
    const controller = new AbortController();
    controller.abort();
    await expect(
      result.capability.createReadExecutor().execute(
        classifySafeGitReadCommandV1(["rev-parse", "--show-toplevel"]),
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ code: "read_execution_invalid" });
    expect(safeGitExecutionTestStateV1.reads).toBe(0);
    expect(result.capability.closed).toBe(true);
  });

  it("redacts and poisons a failed native version execution", async () => {
    const root = initializeRepository();
    const absoluteExecutablePath = join(
      temporaryDirectory("safe-git-version-failure"),
      "git",
    );
    const result = await bootstrapSafeGitFilesystemCandidateV1(root);
    await result.capability.bindRepositoryControl();
    await result.capability.bindRepositoryIdentity();
    await result.capability.bindEmptyHooksDirectory();
    await result.capability.bindGitExecutable(absoluteExecutablePath);
    safeGitExecutionTestStateV1.unavailable = true;

    await expectBootstrapFailure(
      result.capability.executeGitVersion(),
      "version_execution_invalid",
      [root, absoluteExecutablePath],
    );
    expect(safeGitExecutionTestStateV1.executions).toBe(1);
    expect(result.capability.closed).toBe(true);
    expect(isSafeGitBootstrapCapabilityV1(result.capability)).toBe(false);
  });

  it("redacts executable custody errors and poisons the retained binding", async () => {
    const root = initializeRepository();
    const absoluteExecutablePath = join(
      temporaryDirectory("safe-git-secret-executable"),
      "git",
    );
    const result = await bootstrapSafeGitFilesystemCandidateV1(root);
    await result.capability.bindRepositoryControl();
    await result.capability.bindRepositoryIdentity();
    await result.capability.bindEmptyHooksDirectory();
    identityAuthorityTestStateV1.executableUnavailable = true;

    await expectBootstrapFailure(
      result.capability.bindGitExecutable(absoluteExecutablePath),
      "executable_binding_invalid",
      [root, absoluteExecutablePath],
    );
    expect(result.capability.closed).toBe(true);
    expect(isSafeGitBootstrapCapabilityV1(result.capability)).toBe(false);
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
    const sources = [
      new URL("../src/safe-git-bootstrap.ts", import.meta.url),
      new URL(
        "../../durable-object-provider-authority/src/acceptance-store-internal.ts",
        import.meta.url,
      ),
    ].map((url) => readFileSync(url, "utf8"));
    for (const source of sources) {
      expect(source).not.toContain("node:child_process");
      expect(source).not.toContain("executeGit(");
      expect(source).not.toMatch(/\b(?:exec|execFile|fork|spawn)\s*\(/u);
      expect(source).not.toContain("git --version");
      expect(source).not.toContain('"--version"');
    }
  });
});
