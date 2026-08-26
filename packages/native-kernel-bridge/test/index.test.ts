import { execFileSync, spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import {
  appendFileSync,
  chmodSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { userInfo } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  acquireNativeInstallationIdentityInitializationLockV1,
  armNativeTestSafeGitExecutableOwnerAdmissionV1,
  armNativeTestSafeGitEmptyHooksDirectoryRaceV1,
  armNativeTestInstallationStateAuthorityNamespaceRaceV1,
  assertNativeInstallationStateAuthorityFreshV1,
  assertNativeInstallationStateAuthoritySeparatedFromSafeGitV1,
  assertNativeResolvedInstallationStateRootSeparatedFromSafeGitV1,
  bindNativeSafeGitEmptyHooksDirectoryV1,
  bindNativeSafeGitExecutableV1,
  bindNativeSafeGitRepositoryControlV1,
  closeNativeInstallationStateAuthorityV1,
  closeNativeSafeGitDescriptorBootstrapV1,
  createNativeInstallationIdentityArtifactV1,
  deriveNativeSafeGitPathIdentityV1,
  executeNativeSafeGitVersionV1,
  inspectNativeInstallationEmptyHooksDirectoryV1,
  openNativeTestInstallationStateAuthorityV1,
  openNativeSafeGitDescriptorBootstrapV1,
  readNativeInstallationIdentityArtifactV1,
  releaseNativeInstallationIdentityInitializationLockV1,
  replaceNativeInstallationIdentityInitStageV1,
  revalidateNativeInstallationStateAuthorityV1,
  revalidateNativeSafeGitDescriptorBootstrapV1,
  resolveNativeInstallationStateRootV1,
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

function expectInstallationAuthorityUnavailableV1(callback: () => unknown): void {
  expect(callback).toThrowError(
    expect.objectContaining({
      code: "ERR_NATIVE_KERNEL_BRIDGE_INSTALLATION_STATE_AUTHORITY_UNAVAILABLE",
      message: "native installation state authority is unavailable",
    }),
  );
}

function canonicalLocatorV1(path: string): string {
  return `base64url:${Buffer.from(realpathSync(path), "utf8").toString("base64url")}`;
}

function hmacHexV1(key: Buffer, value: unknown): string {
  return createHmac("sha256", key).update(JSON.stringify(value)).digest("hex");
}

function canonicalGitExecutableV1(): string {
  const candidate =
    process.platform === "darwin"
      ? execFileSync("xcrun", ["--find", "git"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        }).trim()
      : "/usr/bin/git";
  return realpathSync(candidate);
}

function createExecutableFixtureV1(keyByte = 0x71) {
  const root = createFixtureRootV1();
  const repository = join(root, "repository");
  const authorityRoot = join(root, "authority");
  const key = Buffer.alloc(32, keyByte);
  initializeRepositoryV1(repository);
  const authority = openNativeTestInstallationStateAuthorityV1(authorityRoot, {
    create: true,
  });
  const bootstrap = openNativeSafeGitDescriptorBootstrapV1(repository);
  bindNativeSafeGitRepositoryControlV1(bootstrap.binding);
  bindNativeSafeGitEmptyHooksDirectoryV1(
    bootstrap.binding,
    authority.authority,
    key,
  );
  return { authority, authorityRoot, bootstrap, key, repository, root };
}

function closeExecutableFixtureV1(
  fixture: ReturnType<typeof createExecutableFixtureV1>,
): void {
  closeNativeSafeGitDescriptorBootstrapV1(fixture.bootstrap.binding);
  closeNativeInstallationStateAuthorityV1(fixture.authority.authority);
}

function createTemporaryExecutableV1(
  root: string,
  name = "git",
  content: string | Buffer = "#!/bin/sh\nexit 0\n",
): string {
  const directory = join(root, "tools");
  mkdirSync(directory, { mode: 0o700, recursive: true });
  const path = join(directory, name);
  writeFileSync(path, content, { mode: 0o700 });
  chmodSync(path, 0o700);
  return path;
}

function bindTemporaryExecutableV1(
  fixture: ReturnType<typeof createExecutableFixtureV1>,
  path: string,
  key = fixture.key,
) {
  armNativeTestSafeGitExecutableOwnerAdmissionV1(
    fixture.bootstrap.binding,
    fixture.authority.authority,
  );
  return bindNativeSafeGitExecutableV1(
    fixture.bootstrap.binding,
    fixture.authority.authority,
    key,
    path,
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
    it("owns fixed identity artifacts, a nonblocking kernel lock, and active reopen", async () => {
      const fixture = createFixtureRootV1();
      const authorityRoot = join(fixture, "authority");
      const opened = openNativeTestInstallationStateAuthorityV1(authorityRoot, {
        create: true,
      });
      expect(opened).toMatchObject({
        profile: "native_installation_state_authority_v1",
        resolverId: "test-explicit-temporary-root-v1",
        rootCreated: true,
        rootIdentity: {
          platform: "posix",
          device: expect.stringMatching(/^(0|[1-9][0-9]*)$/u),
          inode: expect.stringMatching(/^(0|[1-9][0-9]*)$/u),
        },
      });
      expect(
        Buffer.from(opened.canonicalStateRootBytes.slice("base64url:".length), "base64url").toString("utf8"),
      ).toBe(authorityRoot);
      expect(
        Buffer.from(opened.ownerIdentity.slice("base64url:".length), "base64url").toString("utf8"),
      ).toBe(`posix-uid:${process.geteuid?.() ?? process.getuid?.()}`);
      revalidateNativeInstallationStateAuthorityV1(opened.authority);

      const firstLock = acquireNativeInstallationIdentityInitializationLockV1(
        opened.authority,
      );
      expect(firstLock).toBeDefined();
      const reopened = openNativeTestInstallationStateAuthorityV1(authorityRoot, {
        create: false,
      });
      expect(reopened.rootCreated).toBe(false);
      expect(reopened.rootIdentity).toEqual(opened.rootIdentity);
      expect(
        acquireNativeInstallationIdentityInitializationLockV1(reopened.authority),
      ).toBeUndefined();
      releaseNativeInstallationIdentityInitializationLockV1(firstLock!);
      const secondLock = acquireNativeInstallationIdentityInitializationLockV1(
        reopened.authority,
      );
      expect(secondLock).toBeDefined();
      releaseNativeInstallationIdentityInitializationLockV1(secondLock!);
      assertNativeInstallationStateAuthorityFreshV1(reopened.authority);

      expect(readNativeInstallationIdentityArtifactV1(opened.authority, "key")).toBeUndefined();
      expect(readNativeInstallationIdentityArtifactV1(opened.authority, "init")).toBeUndefined();
      const key = Buffer.alloc(32, 0x5a);
      createNativeInstallationIdentityArtifactV1(opened.authority, "key", key);
      expectInstallationAuthorityUnavailableV1(() =>
        createNativeInstallationIdentityArtifactV1(opened.authority, "key", key),
      );
      const readKey = readNativeInstallationIdentityArtifactV1(opened.authority, "key");
      expect(readKey).toEqual(key);
      readKey!.fill(0);
      expect(readNativeInstallationIdentityArtifactV1(opened.authority, "key")).toEqual(key);

      const lockPath = join(
        authorityRoot,
        "runtime-state",
        "private",
        ".installation-identity-v1.lock",
      );
      const ancestorChurnPath = join(fixture, "unmanaged-ancestor-churn");
      const lockChurn = spawn(
        process.execPath,
        [
          "-e",
          `const fs = require("node:fs");
const lockPath = process.argv[1];
const ancestorChurnPath = process.argv[2];
process.stdout.write("ready\\n");
const deadline = Date.now() + 750;
while (Date.now() < deadline) {
  let descriptor;
  try {
    descriptor = fs.openSync(
      lockPath,
      fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR,
      0o600,
    );
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  if (descriptor !== undefined) fs.closeSync(descriptor);
  try {
    fs.unlinkSync(lockPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  try {
    fs.mkdirSync(ancestorChurnPath, { mode: 0o700 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  try {
    fs.rmdirSync(ancestorChurnPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}`,
          lockPath,
          ancestorChurnPath,
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      let lockChurnStderr = "";
      lockChurn.stderr.setEncoding("utf8");
      lockChurn.stderr.on("data", (chunk: string) => {
        lockChurnStderr += chunk;
      });
      await new Promise<void>((resolve, reject) => {
        lockChurn.once("error", reject);
        lockChurn.stdout.once("data", () => resolve());
        lockChurn.once("exit", (code) => {
          if (code !== 0) reject(new Error(`lock churn failed (${code}): ${lockChurnStderr}`));
        });
      });
      try {
        for (let attempt = 0; attempt < 500; attempt += 1) {
          revalidateNativeInstallationStateAuthorityV1(opened.authority);
          const concurrentlyOpened = openNativeTestInstallationStateAuthorityV1(
            authorityRoot,
            { create: false },
          );
          revalidateNativeInstallationStateAuthorityV1(
            concurrentlyOpened.authority,
          );
          closeNativeInstallationStateAuthorityV1(
            concurrentlyOpened.authority,
          );
          const observed = readNativeInstallationIdentityArtifactV1(
            opened.authority,
            "key",
          );
          expect(observed).toEqual(key);
          observed!.fill(0);
        }
        const lockChurnExit = await new Promise<number | null>((resolve) => {
          if (lockChurn.exitCode !== null) {
            resolve(lockChurn.exitCode);
          } else {
            lockChurn.once("exit", (code) => resolve(code));
          }
        });
        expect(lockChurnExit, lockChurnStderr).toBe(0);
      } finally {
        if (lockChurn.exitCode === null && lockChurn.signalCode === null) {
          lockChurn.kill();
          await new Promise<void>((resolve) => {
            lockChurn.once("exit", () => resolve());
          });
        }
        rmSync(lockPath, { force: true });
        rmSync(ancestorChurnPath, { force: true, recursive: true });
      }

      const stage = Buffer.from('{"profile":"initializing"}', "utf8");
      createNativeInstallationIdentityArtifactV1(opened.authority, "init_stage", stage);
      replaceNativeInstallationIdentityInitStageV1(opened.authority);
      expect(readNativeInstallationIdentityArtifactV1(opened.authority, "init")).toEqual(stage);
      expect(readNativeInstallationIdentityArtifactV1(opened.authority, "init_stage")).toBeUndefined();
      const active = Buffer.from('{"profile":"active"}', "utf8");
      createNativeInstallationIdentityArtifactV1(opened.authority, "init_stage", active);
      replaceNativeInstallationIdentityInitStageV1(opened.authority);
      expect(readNativeInstallationIdentityArtifactV1(opened.authority, "init")).toEqual(active);
      expect(readNativeInstallationIdentityArtifactV1(opened.authority, "init_stage")).toBeUndefined();

      closeNativeInstallationStateAuthorityV1(opened.authority);
      expectInstallationAuthorityUnavailableV1(() =>
        revalidateNativeInstallationStateAuthorityV1(opened.authority),
      );
      expect(readNativeInstallationIdentityArtifactV1(reopened.authority, "key")).toEqual(key);
      closeNativeInstallationStateAuthorityV1(reopened.authority);
    });

    it("binds the fresh native-owned empty hooks directory with its frozen HMAC", () => {
      const fixture = createFixtureRootV1();
      const authorityRoot = join(fixture, "authority");
      const hooksPath = join(
        authorityRoot,
        "runtime-state",
        "private",
        "safe-git-empty-hooks-v1",
      );
      const opened = openNativeTestInstallationStateAuthorityV1(authorityRoot, {
        create: true,
      });
      const inspected = inspectNativeInstallationEmptyHooksDirectoryV1(
        opened.authority,
      );
      expect(inspected).toEqual({
        profile: "native_installation_empty_hooks_directory_v1",
        directoryIdentity: {
          platform: "posix",
          device: expect.stringMatching(/^(0|[1-9][0-9]*)$/u),
          inode: expect.stringMatching(/^(0|[1-9][0-9]*)$/u),
        },
      });
      expect(readdirSync(hooksPath)).toEqual([]);
      expect(JSON.stringify(inspected)).not.toContain(authorityRoot);

      const repository = join(fixture, "repository");
      initializeRepositoryV1(repository);
      const first = openNativeSafeGitDescriptorBootstrapV1(repository);
      bindNativeSafeGitRepositoryControlV1(first.binding);
      const firstKey = Buffer.alloc(32, 0x51);
      const firstBinding = bindNativeSafeGitEmptyHooksDirectoryV1(
        first.binding,
        opened.authority,
        firstKey,
      );
      const expectedFirstToken = `hmac-sha256:${hmacHexV1(firstKey, [
        "empty-hooks-directory-token-v1",
        {
          directoryIdentity: {
            device: inspected.directoryIdentity.device,
            inode: inspected.directoryIdentity.inode,
            platform: "posix",
          },
          entries: [],
        },
      ])}`;
      expect(firstBinding).toEqual({
        profile: "native_safe_git_empty_hooks_binding_v1",
        directoryIdentity: inspected.directoryIdentity,
        emptyHooksDirectoryToken: expectedFirstToken,
      });
      expect(JSON.stringify(firstBinding)).not.toContain(authorityRoot);

      closeNativeInstallationStateAuthorityV1(opened.authority);
      expect(revalidateNativeSafeGitDescriptorBootstrapV1(first.binding)).toBe(
        "ordinary",
      );
      const reopened = openNativeTestInstallationStateAuthorityV1(authorityRoot, {
        create: false,
      });
      expect(
        inspectNativeInstallationEmptyHooksDirectoryV1(reopened.authority),
      ).toEqual(inspected);
      expect(
        bindNativeSafeGitEmptyHooksDirectoryV1(
          first.binding,
          reopened.authority,
          firstKey,
        ),
      ).toEqual(firstBinding);

      const second = openNativeSafeGitDescriptorBootstrapV1(repository);
      bindNativeSafeGitRepositoryControlV1(second.binding);
      const secondKey = Buffer.alloc(32, 0x52);
      const secondBinding = bindNativeSafeGitEmptyHooksDirectoryV1(
        second.binding,
        reopened.authority,
        secondKey,
      );
      expect(secondBinding.directoryIdentity).toEqual(
        inspected.directoryIdentity,
      );
      expect(secondBinding.emptyHooksDirectoryToken).not.toBe(
        firstBinding.emptyHooksDirectoryToken,
      );

      const missingControl = openNativeSafeGitDescriptorBootstrapV1(repository);
      expectSafeGitUnavailableV1(() =>
        bindNativeSafeGitEmptyHooksDirectoryV1(
          missingControl.binding,
          reopened.authority,
          firstKey,
        )
      );
      expectSafeGitUnavailableV1(() =>
        revalidateNativeSafeGitDescriptorBootstrapV1(missingControl.binding)
      );

      const mismatched = openNativeSafeGitDescriptorBootstrapV1(repository);
      bindNativeSafeGitRepositoryControlV1(mismatched.binding);
      expect(
        bindNativeSafeGitEmptyHooksDirectoryV1(
          mismatched.binding,
          reopened.authority,
          firstKey,
        ),
      ).toEqual(firstBinding);
      const otherAuthority = openNativeTestInstallationStateAuthorityV1(
        join(fixture, "other-authority"),
        { create: true },
      );
      expectSafeGitUnavailableV1(() =>
        bindNativeSafeGitEmptyHooksDirectoryV1(
          mismatched.binding,
          otherAuthority.authority,
          firstKey,
        )
      );
      expectSafeGitUnavailableV1(() =>
        revalidateNativeSafeGitDescriptorBootstrapV1(mismatched.binding)
      );
      closeNativeSafeGitDescriptorBootstrapV1(mismatched.binding);
      closeNativeInstallationStateAuthorityV1(otherAuthority.authority);

      const invalid = openNativeSafeGitDescriptorBootstrapV1(repository);
      bindNativeSafeGitRepositoryControlV1(invalid.binding);
      expectSafeGitUnavailableV1(() =>
        bindNativeSafeGitEmptyHooksDirectoryV1(
          invalid.binding,
          reopened.authority,
          Buffer.alloc(31) as Buffer,
        )
      );
      expectSafeGitUnavailableV1(() =>
        revalidateNativeSafeGitDescriptorBootstrapV1(invalid.binding)
      );

      const raced = openNativeSafeGitDescriptorBootstrapV1(repository);
      bindNativeSafeGitRepositoryControlV1(raced.binding);
      bindNativeSafeGitEmptyHooksDirectoryV1(
        raced.binding,
        reopened.authority,
        firstKey,
      );
      armNativeTestSafeGitEmptyHooksDirectoryRaceV1(raced.binding);
      expectSafeGitUnavailableV1(() =>
        revalidateNativeSafeGitDescriptorBootstrapV1(raced.binding),
      );
      expect(readdirSync(hooksPath)).toEqual([
        ".native-safe-git-empty-hooks-race-v1",
      ]);
      expectSafeGitUnavailableV1(() =>
        revalidateNativeSafeGitDescriptorBootstrapV1(raced.binding),
      );
      closeNativeSafeGitDescriptorBootstrapV1(raced.binding);

      writeFileSync(join(hooksPath, "unexpected-hook"), "#!/bin/sh\n", {
        mode: 0o600,
      });
      expectSafeGitUnavailableV1(() =>
        revalidateNativeSafeGitDescriptorBootstrapV1(first.binding)
      );
      expectSafeGitUnavailableV1(() =>
        revalidateNativeSafeGitDescriptorBootstrapV1(second.binding)
      );
      closeNativeSafeGitDescriptorBootstrapV1(first.binding);
      closeNativeSafeGitDescriptorBootstrapV1(second.binding);
      closeNativeSafeGitDescriptorBootstrapV1(invalid.binding);
      closeNativeSafeGitDescriptorBootstrapV1(missingControl.binding);
      closeNativeInstallationStateAuthorityV1(reopened.authority);
    });

    it("binds the actual canonical Git idempotently with an exact two-key redaction", () => {
      const executablePath = canonicalGitExecutableV1();
      const firstFixture = createExecutableFixtureV1(0x41);
      const secondFixture = createExecutableFixtureV1(0x42);
      if (process.platform === "darwin") {
        expect(executablePath).not.toBe("/usr/bin/git");
      } else {
        expect(executablePath).toBe("/usr/bin/git");
      }
      try {
        const first = bindNativeSafeGitExecutableV1(
          firstFixture.bootstrap.binding,
          firstFixture.authority.authority,
          firstFixture.key,
          executablePath,
        );
        const repeated = bindNativeSafeGitExecutableV1(
          firstFixture.bootstrap.binding,
          firstFixture.authority.authority,
          firstFixture.key,
          executablePath,
        );
        const second = bindNativeSafeGitExecutableV1(
          secondFixture.bootstrap.binding,
          secondFixture.authority.authority,
          secondFixture.key,
          executablePath,
        );
        const exactResult = {
          profile: "native_safe_git_executable_binding_v1",
          executableBinding: "verified",
        };
        expect(first).toEqual(exactResult);
        expect(repeated).toEqual(exactResult);
        expect(second).toEqual(exactResult);
        expect(Object.keys(first).sort()).toEqual([
          "executableBinding",
          "profile",
        ]);
        expect(Object.isFrozen(first)).toBe(true);
        expect(Object.isFrozen(repeated)).toBe(true);
        expect(Object.isFrozen(second)).toBe(true);
        const serialized = JSON.stringify({ first, repeated, second });
        expect(serialized).not.toContain(executablePath);
        expect(serialized).not.toContain(firstFixture.key.toString("hex"));
        expect(serialized).not.toContain(secondFixture.key.toString("hex"));
        expect(serialized).not.toMatch(
          /(?:binaryDigest|device|hmac|inode|mode|ownerIdentity|path|size|token)/iu,
        );
        expect(
          revalidateNativeSafeGitDescriptorBootstrapV1(
            firstFixture.bootstrap.binding,
          ),
        ).toBe("ordinary");
        expect(
          revalidateNativeSafeGitDescriptorBootstrapV1(
            secondFixture.bootstrap.binding,
          ),
        ).toBe("ordinary");
      } finally {
        closeExecutableFixtureV1(firstFixture);
        closeExecutableFixtureV1(secondFixture);
      }
    });

    it.runIf(process.platform === "darwin")(
      "rejects the exact Darwin command-line-tools shim path",
      () => {
        const fixture = createExecutableFixtureV1();
        try {
          expectSafeGitUnavailableV1(() =>
            bindNativeSafeGitExecutableV1(
              fixture.bootstrap.binding,
              fixture.authority.authority,
              fixture.key,
              "/usr/bin/git",
            ),
          );
          expectSafeGitUnavailableV1(() =>
            revalidateNativeSafeGitDescriptorBootstrapV1(
              fixture.bootstrap.binding,
            ),
          );
        } finally {
          closeExecutableFixtureV1(fixture);
        }
      },
    );

    it("requires the explicit authority-tied test arm for a temporary executable", () => {
      const unarmed = createExecutableFixtureV1();
      const unarmedPath = createTemporaryExecutableV1(unarmed.root);
      try {
        expectSafeGitUnavailableV1(() =>
          bindNativeSafeGitExecutableV1(
            unarmed.bootstrap.binding,
            unarmed.authority.authority,
            unarmed.key,
            unarmedPath,
          ),
        );
        expectSafeGitUnavailableV1(() =>
          revalidateNativeSafeGitDescriptorBootstrapV1(
            unarmed.bootstrap.binding,
          ),
        );
      } finally {
        closeExecutableFixtureV1(unarmed);
      }

      const armed = createExecutableFixtureV1();
      const armedPath = createTemporaryExecutableV1(armed.root);
      const foreignAuthority = openNativeTestInstallationStateAuthorityV1(
        join(armed.root, "foreign-authority"),
        { create: true },
      );
      try {
        expectSafeGitUnavailableV1(() =>
          armNativeTestSafeGitExecutableOwnerAdmissionV1(
            armed.bootstrap.binding,
            foreignAuthority.authority,
          ),
        );
        expect(bindTemporaryExecutableV1(armed, armedPath)).toEqual({
          profile: "native_safe_git_executable_binding_v1",
          executableBinding: "verified",
        });
        expect(
          revalidateNativeSafeGitDescriptorBootstrapV1(
            armed.bootstrap.binding,
          ),
        ).toBe("ordinary");
      } finally {
        closeNativeInstallationStateAuthorityV1(foreignAuthority.authority);
        closeExecutableFixtureV1(armed);
      }
    });

    it("fails closed instead of executing a bound script outside the native Git runner", () => {
      const fixture = createExecutableFixtureV1();
      const executablePath = createTemporaryExecutableV1(
        fixture.root,
        "git",
        "#!/bin/sh\nprintf 'git version 9.9.9\\n'\n",
      );
      try {
        expect(bindTemporaryExecutableV1(fixture, executablePath)).toEqual({
          profile: "native_safe_git_executable_binding_v1",
          executableBinding: "verified",
        });
        expectSafeGitUnavailableV1(() =>
          executeNativeSafeGitVersionV1(
            fixture.bootstrap.binding,
            fixture.authority.authority,
            fixture.key,
          ),
        );
        expectSafeGitUnavailableV1(() =>
          revalidateNativeSafeGitDescriptorBootstrapV1(
            fixture.bootstrap.binding,
          ),
        );
      } finally {
        closeExecutableFixtureV1(fixture);
      }
    });

    it("rejects non-canonical executable path spellings and poisons the binding", () => {
      const invalidPaths = [
        (_valid: string, _root: string) => "tools/git",
        (valid: string, _root: string) => `${valid}\0hidden`,
        (_valid: string, root: string) => `${join(root, "tools")}/./git`,
        (_valid: string, root: string) =>
          `${join(root, "tools")}/../tools/git`,
        (_valid: string, root: string) => `${join(root, "tools")}//git`,
        (valid: string, _root: string) => `${valid}/`,
      ] as const;
      for (const invalidPath of invalidPaths) {
        const fixture = createExecutableFixtureV1();
        const valid = createTemporaryExecutableV1(fixture.root);
        armNativeTestSafeGitExecutableOwnerAdmissionV1(
          fixture.bootstrap.binding,
          fixture.authority.authority,
        );
        try {
          expectSafeGitUnavailableV1(() =>
            bindNativeSafeGitExecutableV1(
              fixture.bootstrap.binding,
              fixture.authority.authority,
              fixture.key,
              invalidPath(valid, fixture.root),
            ),
          );
          expectSafeGitUnavailableV1(() =>
            revalidateNativeSafeGitDescriptorBootstrapV1(
              fixture.bootstrap.binding,
            ),
          );
        } finally {
          closeExecutableFixtureV1(fixture);
        }
      }
    });

    it("rejects symlink, special, non-executable, setid, linked, empty, and oversized files", () => {
      const invalidExecutableBuilders = [
        (fixture: ReturnType<typeof createExecutableFixtureV1>) => {
          const target = createTemporaryExecutableV1(fixture.root, "target");
          const path = join(fixture.root, "tools", "git");
          symlinkSync(target, path, "file");
          return path;
        },
        (fixture: ReturnType<typeof createExecutableFixtureV1>) => {
          const directory = join(fixture.root, "tools");
          mkdirSync(directory, { mode: 0o700 });
          const path = join(directory, "git");
          execFileSync("mkfifo", [path], { stdio: "pipe" });
          return path;
        },
        (fixture: ReturnType<typeof createExecutableFixtureV1>) => {
          const path = join(fixture.root, "tools", "git");
          mkdirSync(path, { mode: 0o700, recursive: true });
          return path;
        },
        (fixture: ReturnType<typeof createExecutableFixtureV1>) => {
          const path = createTemporaryExecutableV1(fixture.root);
          chmodSync(path, 0o400);
          return path;
        },
        (fixture: ReturnType<typeof createExecutableFixtureV1>) => {
          const path = createTemporaryExecutableV1(fixture.root);
          chmodSync(path, 0o4500);
          expect(statSync(path).mode & 0o6000).toBe(0o4000);
          return path;
        },
        (fixture: ReturnType<typeof createExecutableFixtureV1>) => {
          const path = createTemporaryExecutableV1(fixture.root);
          linkSync(path, join(fixture.root, "tools", "git-hardlink"));
          expect(statSync(path).nlink).toBe(2);
          return path;
        },
        (fixture: ReturnType<typeof createExecutableFixtureV1>) =>
          createTemporaryExecutableV1(fixture.root, "git", Buffer.alloc(0)),
        (fixture: ReturnType<typeof createExecutableFixtureV1>) => {
          const path = createTemporaryExecutableV1(
            fixture.root,
            "git",
            Buffer.from([0]),
          );
          truncateSync(path, 512 * 1024 * 1024 + 1);
          expect(statSync(path).size).toBe(512 * 1024 * 1024 + 1);
          return path;
        },
      ] as const;
      for (const buildInvalidExecutable of invalidExecutableBuilders) {
        const fixture = createExecutableFixtureV1();
        const path = buildInvalidExecutable(fixture);
        armNativeTestSafeGitExecutableOwnerAdmissionV1(
          fixture.bootstrap.binding,
          fixture.authority.authority,
        );
        try {
          expectSafeGitUnavailableV1(() =>
            bindNativeSafeGitExecutableV1(
              fixture.bootstrap.binding,
              fixture.authority.authority,
              fixture.key,
              path,
            ),
          );
          expectSafeGitUnavailableV1(() =>
            revalidateNativeSafeGitDescriptorBootstrapV1(
              fixture.bootstrap.binding,
            ),
          );
        } finally {
          closeExecutableFixtureV1(fixture);
        }
      }
    });

    it("rejects executables under workspace, Git, and installation-state leaves", () => {
      const protectedRepositoryPaths = [
        (fixture: ReturnType<typeof createExecutableFixtureV1>) =>
          join(fixture.repository, "git"),
        (fixture: ReturnType<typeof createExecutableFixtureV1>) =>
          join(fixture.repository, ".git", "git"),
      ] as const;
      for (const protectedPath of protectedRepositoryPaths) {
        const fixture = createExecutableFixtureV1();
        const path = protectedPath(fixture);
        writeFileSync(path, "#!/bin/sh\nexit 0\n", { mode: 0o500 });
        chmodSync(path, 0o500);
        armNativeTestSafeGitExecutableOwnerAdmissionV1(
          fixture.bootstrap.binding,
          fixture.authority.authority,
        );
        try {
          expectSafeGitUnavailableV1(() =>
            bindNativeSafeGitExecutableV1(
              fixture.bootstrap.binding,
              fixture.authority.authority,
              fixture.key,
              path,
            ),
          );
          expectSafeGitUnavailableV1(() =>
            revalidateNativeSafeGitDescriptorBootstrapV1(
              fixture.bootstrap.binding,
            ),
          );
        } finally {
          closeExecutableFixtureV1(fixture);
        }
      }

      const stateFixture = createExecutableFixtureV1();
      armNativeTestSafeGitExecutableOwnerAdmissionV1(
        stateFixture.bootstrap.binding,
        stateFixture.authority.authority,
      );
      const statePath = join(
        stateFixture.authorityRoot,
        "runtime-state",
        "private",
        "safe-git-empty-hooks-v1",
        "git",
      );
      writeFileSync(statePath, "#!/bin/sh\nexit 0\n", { mode: 0o500 });
      chmodSync(statePath, 0o500);
      try {
        expectSafeGitUnavailableV1(() =>
          bindNativeSafeGitExecutableV1(
            stateFixture.bootstrap.binding,
            stateFixture.authority.authority,
            stateFixture.key,
            statePath,
          ),
        );
        expectSafeGitUnavailableV1(() =>
          revalidateNativeSafeGitDescriptorBootstrapV1(
            stateFixture.bootstrap.binding,
          ),
        );
      } finally {
        closeExecutableFixtureV1(stateFixture);
      }
    });

    it("poisons revalidation after same-size mutation, rename, or replacement", () => {
      const mutated = createExecutableFixtureV1();
      const mutatedPath = createTemporaryExecutableV1(mutated.root);
      try {
        bindTemporaryExecutableV1(mutated, mutatedPath);
        const before = readFileSync(mutatedPath);
        const after = Buffer.from(before);
        after[0] = after[0]! ^ 0x01;
        writeFileSync(mutatedPath, after);
        expect(statSync(mutatedPath).size).toBe(before.byteLength);
        expectSafeGitUnavailableV1(() =>
          revalidateNativeSafeGitDescriptorBootstrapV1(
            mutated.bootstrap.binding,
          ),
        );
        expectSafeGitUnavailableV1(() =>
          revalidateNativeSafeGitDescriptorBootstrapV1(
            mutated.bootstrap.binding,
          ),
        );
      } finally {
        closeExecutableFixtureV1(mutated);
      }

      for (const replace of [false, true]) {
        const fixture = createExecutableFixtureV1();
        const path = createTemporaryExecutableV1(fixture.root);
        const bytes = readFileSync(path);
        bindTemporaryExecutableV1(fixture, path);
        renameSync(path, `${path}.retained`);
        if (replace) {
          writeFileSync(path, bytes, { mode: 0o500 });
          chmodSync(path, 0o500);
        }
        try {
          expectSafeGitUnavailableV1(() =>
            revalidateNativeSafeGitDescriptorBootstrapV1(
              fixture.bootstrap.binding,
            ),
          );
          expectSafeGitUnavailableV1(() =>
            revalidateNativeSafeGitDescriptorBootstrapV1(
              fixture.bootstrap.binding,
            ),
          );
        } finally {
          closeExecutableFixtureV1(fixture);
        }
      }
    });

    it("poisons a bound executable on a different path or key", () => {
      const changedPath = createExecutableFixtureV1();
      const firstPath = createTemporaryExecutableV1(changedPath.root, "git-a");
      const secondPath = createTemporaryExecutableV1(changedPath.root, "git-b");
      try {
        bindTemporaryExecutableV1(changedPath, firstPath);
        expectSafeGitUnavailableV1(() =>
          bindNativeSafeGitExecutableV1(
            changedPath.bootstrap.binding,
            changedPath.authority.authority,
            changedPath.key,
            secondPath,
          ),
        );
        expectSafeGitUnavailableV1(() =>
          revalidateNativeSafeGitDescriptorBootstrapV1(
            changedPath.bootstrap.binding,
          ),
        );
      } finally {
        closeExecutableFixtureV1(changedPath);
      }

      const changedKey = createExecutableFixtureV1();
      const path = createTemporaryExecutableV1(changedKey.root);
      try {
        bindTemporaryExecutableV1(changedKey, path);
        expectSafeGitUnavailableV1(() =>
          bindNativeSafeGitExecutableV1(
            changedKey.bootstrap.binding,
            changedKey.authority.authority,
            Buffer.alloc(32, 0x72),
            path,
          ),
        );
        expectSafeGitUnavailableV1(() =>
          revalidateNativeSafeGitDescriptorBootstrapV1(
            changedKey.bootstrap.binding,
          ),
        );
      } finally {
        closeExecutableFixtureV1(changedKey);
      }
    });

    it("allows sibling churn and idempotently closes the executable binding", () => {
      const fixture = createExecutableFixtureV1();
      const path = createTemporaryExecutableV1(fixture.root);
      try {
        bindTemporaryExecutableV1(fixture, path);
        const sibling = join(fixture.root, "tools", "sibling");
        writeFileSync(sibling, "churn", { mode: 0o600 });
        rmSync(sibling);
        expect(
          revalidateNativeSafeGitDescriptorBootstrapV1(
            fixture.bootstrap.binding,
          ),
        ).toBe("ordinary");
        closeNativeSafeGitDescriptorBootstrapV1(fixture.bootstrap.binding);
        expect(() =>
          closeNativeSafeGitDescriptorBootstrapV1(fixture.bootstrap.binding),
        ).not.toThrow();
        expectSafeGitUnavailableV1(() =>
          revalidateNativeSafeGitDescriptorBootstrapV1(
            fixture.bootstrap.binding,
          ),
        );
      } finally {
        closeExecutableFixtureV1(fixture);
      }
    });

    it("contains no native process-launch API", () => {
      const source = readFileSync(
        new URL("../native/kernel_bridge.c", import.meta.url),
        "utf8",
      );
      expect(source).not.toMatch(
        /\b(?:exec|execl|execle|execlp|execv|execve|execvp|execvpe|fork|popen|posix_spawn|posix_spawnp|spawn|system|vfork)\s*\(/u,
      );
    });

    it("never supplements an established installation root missing empty hooks", () => {
      const fixture = createFixtureRootV1();
      const authorityRoot = join(fixture, "authority");
      const privatePath = join(authorityRoot, "runtime-state", "private");
      const hooksPath = join(privatePath, "safe-git-empty-hooks-v1");
      const fresh = openNativeTestInstallationStateAuthorityV1(authorityRoot, {
        create: true,
      });
      closeNativeInstallationStateAuthorityV1(fresh.authority);
      rmSync(hooksPath, { recursive: true });
      expect(readdirSync(privatePath)).toEqual([]);

      const established = openNativeTestInstallationStateAuthorityV1(
        authorityRoot,
        { create: true },
      );
      expect(established.rootCreated).toBe(false);
      revalidateNativeInstallationStateAuthorityV1(established.authority);
      expectInstallationAuthorityUnavailableV1(() =>
        inspectNativeInstallationEmptyHooksDirectoryV1(established.authority)
      );
      expect(readdirSync(privatePath)).toEqual([]);
      closeNativeInstallationStateAuthorityV1(established.authority);
    });

    it("rejects empty-hooks swaps, mode drift, and extended ACLs", () => {
      const swappedFixture = createFixtureRootV1();
      const swappedRoot = join(swappedFixture, "authority");
      const swappedHooks = join(
        swappedRoot,
        "runtime-state",
        "private",
        "safe-git-empty-hooks-v1",
      );
      const swapped = openNativeTestInstallationStateAuthorityV1(swappedRoot, {
        create: true,
      });
      renameSync(swappedHooks, `${swappedHooks}-original`);
      mkdirSync(swappedHooks, { mode: 0o700 });
      expectInstallationAuthorityUnavailableV1(() =>
        revalidateNativeInstallationStateAuthorityV1(swapped.authority)
      );
      closeNativeInstallationStateAuthorityV1(swapped.authority);

      const modeFixture = createFixtureRootV1();
      const modeRoot = join(modeFixture, "authority");
      const modeHooks = join(
        modeRoot,
        "runtime-state",
        "private",
        "safe-git-empty-hooks-v1",
      );
      const mode = openNativeTestInstallationStateAuthorityV1(modeRoot, {
        create: true,
      });
      chmodSync(modeHooks, 0o755);
      expectInstallationAuthorityUnavailableV1(() =>
        inspectNativeInstallationEmptyHooksDirectoryV1(mode.authority)
      );
      closeNativeInstallationStateAuthorityV1(mode.authority);

      if (process.platform === "darwin") {
        const aclFixture = createFixtureRootV1();
        const aclRoot = join(aclFixture, "authority");
        const aclHooks = join(
          aclRoot,
          "runtime-state",
          "private",
          "safe-git-empty-hooks-v1",
        );
        const acl = openNativeTestInstallationStateAuthorityV1(aclRoot, {
          create: true,
        });
        execFileSync("chmod", ["+a", "everyone allow read", aclHooks]);
        try {
          expectInstallationAuthorityUnavailableV1(() =>
            inspectNativeInstallationEmptyHooksDirectoryV1(acl.authority)
          );
        } finally {
          execFileSync("chmod", ["-N", aclHooks]);
          closeNativeInstallationStateAuthorityV1(acl.authority);
        }

        const flags = openNativeTestInstallationStateAuthorityV1(aclRoot, {
          create: false,
        });
        execFileSync("chflags", ["uchg", aclHooks]);
        try {
          expectInstallationAuthorityUnavailableV1(() =>
            inspectNativeInstallationEmptyHooksDirectoryV1(flags.authority)
          );
        } finally {
          execFileSync("chflags", ["nouchg", aclHooks]);
          closeNativeInstallationStateAuthorityV1(flags.authority);
        }
      }
    });

    it("rejects fresh-namespace drift and pinned init-stage replacement races", () => {
      const fixture = createFixtureRootV1();
      const staticAuthorityRoot = join(fixture, "static-authority");
      const staticAuthority = openNativeTestInstallationStateAuthorityV1(
        staticAuthorityRoot,
        { create: true },
      );
      armNativeTestInstallationStateAuthorityNamespaceRaceV1(
        staticAuthority.authority,
        "static_shape",
      );
      expectInstallationAuthorityUnavailableV1(() =>
        revalidateNativeInstallationStateAuthorityV1(staticAuthority.authority),
      );
      expect(readdirSync(staticAuthorityRoot).sort()).toEqual([
        ".native-installation-namespace-race-v1",
        "provider",
        "runtime-state",
      ]);
      expect(
        readdirSync(join(staticAuthorityRoot, "runtime-state", "private")),
      ).toEqual(["safe-git-empty-hooks-v1"]);

      const authorityRoot = join(fixture, "authority");
      const privatePath = join(authorityRoot, "runtime-state", "private");
      const opened = openNativeTestInstallationStateAuthorityV1(authorityRoot, {
        create: true,
      });
      const lock = acquireNativeInstallationIdentityInitializationLockV1(opened.authority);
      expect(lock).toBeDefined();
      releaseNativeInstallationIdentityInitializationLockV1(lock!);
      armNativeTestInstallationStateAuthorityNamespaceRaceV1(
        opened.authority,
        "fresh_shape",
      );
      expectInstallationAuthorityUnavailableV1(() =>
        assertNativeInstallationStateAuthorityFreshV1(opened.authority),
      );
      expect(readdirSync(privatePath).sort()).toEqual([
        ".installation-identity-v1.lock",
        ".native-installation-namespace-race-v1",
        "safe-git-empty-hooks-v1",
      ]);
      const providerCompatible = openNativeTestInstallationStateAuthorityV1(
        authorityRoot,
        { create: false },
      );
      closeNativeInstallationStateAuthorityV1(providerCompatible.authority);
      expect(readNativeInstallationIdentityArtifactV1(opened.authority, "init")).toBeUndefined();
      createNativeInstallationIdentityArtifactV1(
        opened.authority,
        "init_stage",
        Buffer.from("original", "utf8"),
      );
      writeFileSync(
        join(authorityRoot, "runtime-state", "private", ".installation-identity-v1.init.stage"),
        "replaced",
      );
      expectInstallationAuthorityUnavailableV1(() =>
        replaceNativeInstallationIdentityInitStageV1(opened.authority),
      );
      closeNativeInstallationStateAuthorityV1(opened.authority);
      writeFileSync(join(authorityRoot, "unexpected-root-entry"), "x", {
        mode: 0o600,
      });
      expectInstallationAuthorityUnavailableV1(() =>
        openNativeTestInstallationStateAuthorityV1(authorityRoot, {
          create: false,
        }),
      );
    });

    it("does not adopt or mutate a pre-existing empty state root", () => {
      const fixture = createFixtureRootV1();
      const authorityRoot = join(fixture, "preexisting");
      mkdirSync(authorityRoot, { mode: 0o700 });
      expectInstallationAuthorityUnavailableV1(() =>
        openNativeTestInstallationStateAuthorityV1(authorityRoot, {
          create: true,
        }),
      );
      expect(readdirSync(authorityRoot)).toEqual([]);
    });

    it("rejects owner-mode drift on an established state root", () => {
      const fixture = createFixtureRootV1();
      const authorityRoot = join(fixture, "authority");
      const opened = openNativeTestInstallationStateAuthorityV1(authorityRoot, {
        create: true,
      });
      closeNativeInstallationStateAuthorityV1(opened.authority);
      chmodSync(authorityRoot, 0o770);
      expectInstallationAuthorityUnavailableV1(() =>
        openNativeTestInstallationStateAuthorityV1(authorityRoot, {
          create: false,
        }),
      );
      chmodSync(authorityRoot, 0o700);
    });

    it.runIf(process.platform === "darwin")(
      "rejects extended ACL and immutable-flag state roots",
      () => {
        const fixture = createFixtureRootV1();
        const authorityRoot = join(fixture, "authority");
        const opened = openNativeTestInstallationStateAuthorityV1(authorityRoot, {
          create: true,
        });
        closeNativeInstallationStateAuthorityV1(opened.authority);
        execFileSync("chmod", ["+a", "everyone allow read", authorityRoot]);
        try {
          expectInstallationAuthorityUnavailableV1(() =>
            openNativeTestInstallationStateAuthorityV1(authorityRoot, {
              create: false,
            }),
          );
        } finally {
          execFileSync("chmod", ["-N", authorityRoot]);
        }
        execFileSync("chflags", ["uchg", authorityRoot]);
        try {
          expectInstallationAuthorityUnavailableV1(() =>
            openNativeTestInstallationStateAuthorityV1(authorityRoot, {
              create: false,
            }),
          );
        } finally {
          execFileSync("chflags", ["nouchg", authorityRoot]);
        }
      },
    );

    it("rejects equal and descendant state authorities against descriptor-bound Git roots", () => {
      const fixture = createFixtureRootV1();
      const repository = join(fixture, "repository");
      const equal = openNativeTestInstallationStateAuthorityV1(repository, {
        create: true,
      });
      execFileSync("git", ["init", "--quiet", repository], { stdio: "pipe" });
      const binding = openNativeSafeGitDescriptorBootstrapV1(repository);
      assertNativeResolvedInstallationStateRootSeparatedFromSafeGitV1(binding.binding);

      expectInstallationAuthorityUnavailableV1(() =>
        assertNativeInstallationStateAuthoritySeparatedFromSafeGitV1(
          equal.authority,
          binding.binding,
        ),
      );
      const descendant = openNativeTestInstallationStateAuthorityV1(
        join(repository, "state"),
        { create: true },
      );
      expectInstallationAuthorityUnavailableV1(() =>
        assertNativeInstallationStateAuthoritySeparatedFromSafeGitV1(
          descendant.authority,
          binding.binding,
        ),
      );
      const descendantBinding = openNativeSafeGitDescriptorBootstrapV1(
        repository,
      );
      bindNativeSafeGitRepositoryControlV1(descendantBinding.binding);
      expectSafeGitUnavailableV1(() =>
        bindNativeSafeGitEmptyHooksDirectoryV1(
          descendantBinding.binding,
          descendant.authority,
          Buffer.alloc(32, 0x61),
        )
      );
      expectSafeGitUnavailableV1(() =>
        revalidateNativeSafeGitDescriptorBootstrapV1(
          descendantBinding.binding,
        )
      );
      const separate = openNativeTestInstallationStateAuthorityV1(
        join(fixture, "separate"),
        { create: true },
      );
      assertNativeInstallationStateAuthoritySeparatedFromSafeGitV1(
        separate.authority,
        binding.binding,
      );
      closeNativeInstallationStateAuthorityV1(equal.authority);
      closeNativeInstallationStateAuthorityV1(descendant.authority);
      closeNativeInstallationStateAuthorityV1(separate.authority);
      closeNativeSafeGitDescriptorBootstrapV1(descendantBinding.binding);
      closeNativeSafeGitDescriptorBootstrapV1(binding.binding);
    });
    it("resolves the effective account state root independently of environment", () => {
      const accountHome = userInfo().homedir;
      const originalHome = process.env.HOME;
      const originalXdgStateHome = process.env.XDG_STATE_HOME;
      const originalTmpdir = process.env.TMPDIR;
      try {
        process.env.HOME = "/environment/home/must-not-be-used";
        process.env.XDG_STATE_HOME = "/environment/xdg/must-not-be-used";
        process.env.TMPDIR = "/environment/tmp/must-not-be-used";
        const resolved = resolveNativeInstallationStateRootV1();
        expect(resolved).toEqual({
          profile: "native_installation_state_resolver_v1",
          resolverId:
            process.platform === "darwin"
              ? "darwin-user-domain-application-support-v1"
              : "linux-getpwuid-effective-user-state-v1",
          root:
            process.platform === "darwin"
              ? join(accountHome, "Library", "Application Support", "understand-code")
              : join(accountHome, ".local", "state", "understand-code"),
          uid: process.geteuid?.() ?? process.getuid?.(),
          gid: process.getegid?.() ?? process.getgid?.(),
        });
        expect(Object.isFrozen(resolved)).toBe(true);
        expect(resolved.root).not.toContain("environment");
      } finally {
        if (originalHome === undefined) delete process.env.HOME;
        else process.env.HOME = originalHome;
        if (originalXdgStateHome === undefined) delete process.env.XDG_STATE_HOME;
        else process.env.XDG_STATE_HOME = originalXdgStateHome;
        if (originalTmpdir === undefined) delete process.env.TMPDIR;
        else process.env.TMPDIR = originalTmpdir;
      }
    });

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

    it("derives frozen JCS path identities without exposing native locators", () => {
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
      const key = Buffer.from(
        "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
        "hex",
      );
      const ordinary = openNativeSafeGitDescriptorBootstrapV1(repository);
      const linked = openNativeSafeGitDescriptorBootstrapV1(linkedWorktree);
      bindNativeSafeGitRepositoryControlV1(ordinary.binding);
      bindNativeSafeGitRepositoryControlV1(linked.binding);

      const ordinaryIdentity = deriveNativeSafeGitPathIdentityV1(
        ordinary.binding,
        key,
      );
      const linkedIdentity = deriveNativeSafeGitPathIdentityV1(linked.binding, key);
      const common = canonicalLocatorV1(join(repository, ".git"));
      const expectedRepositoryId = `repo-hmac-${hmacHexV1(key, [
        "repository-identity-v1",
        { canonicalCommonGitDir: common },
      ])}`;
      const expectedLinkedRoot = canonicalLocatorV1(linkedWorktree);
      const expectedLinkedGit = canonicalLocatorV1(
        join(repository, ".git", "worktrees", "linked"),
      );

      expect(ordinaryIdentity.repositoryId).toBe(expectedRepositoryId);
      expect(linkedIdentity.repositoryId).toBe(expectedRepositoryId);
      expect(
        deriveNativeSafeGitPathIdentityV1(ordinary.binding, key),
      ).toEqual(ordinaryIdentity);
      expect(linkedIdentity).toEqual({
        profile: "native_safe_git_path_identity_v1",
        repositoryId: expectedRepositoryId,
        worktreeId: `worktree-hmac-${hmacHexV1(key, [
          "worktree-identity-v1",
          {
            canonicalGitDir: expectedLinkedGit,
            canonicalRoot: expectedLinkedRoot,
            repositoryId: expectedRepositoryId,
          },
        ])}`,
        rootIdentity: `root-hmac-${hmacHexV1(key, [
          "root-identity-v1",
          { canonicalRoot: expectedLinkedRoot },
        ])}`,
      });
      expect(ordinaryIdentity.worktreeId).not.toBe(linkedIdentity.worktreeId);
      expect(ordinaryIdentity.rootIdentity).not.toBe(linkedIdentity.rootIdentity);
      expect(JSON.stringify([ordinaryIdentity, linkedIdentity])).not.toContain(root);
      expect(Object.isFrozen(ordinaryIdentity)).toBe(true);
      expect(key.toString("hex")).toBe(
        "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
      );

      closeNativeSafeGitDescriptorBootstrapV1(ordinary.binding);
      closeNativeSafeGitDescriptorBootstrapV1(linked.binding);
      expectSafeGitUnavailableV1(() =>
        deriveNativeSafeGitPathIdentityV1(linked.binding, key),
      );
    });

    it("strictly rejects non-32-byte keys and poisons identity on revalidation failure", () => {
      const root = createFixtureRootV1();
      const repository = join(root, "repository");
      initializeRepositoryV1(repository);
      const opened = openNativeSafeGitDescriptorBootstrapV1(repository);
      bindNativeSafeGitRepositoryControlV1(opened.binding);
      expectSafeGitUnavailableV1(() =>
        deriveNativeSafeGitPathIdentityV1(opened.binding, Buffer.alloc(31)),
      );
      expectSafeGitUnavailableV1(() =>
        deriveNativeSafeGitPathIdentityV1(
          opened.binding,
          new Uint8Array(32) as unknown as Buffer,
        ),
      );
      expect(() =>
        deriveNativeSafeGitPathIdentityV1(opened.binding, Buffer.alloc(32, 7)),
      ).not.toThrow();

      const config = join(repository, ".git", "config");
      const moved = join(repository, ".git", "config.moved");
      renameSync(config, moved);
      expectSafeGitUnavailableV1(() =>
        deriveNativeSafeGitPathIdentityV1(opened.binding, Buffer.alloc(32, 7)),
      );
      renameSync(moved, config);
      expectSafeGitUnavailableV1(() =>
        deriveNativeSafeGitPathIdentityV1(opened.binding, Buffer.alloc(32, 7)),
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
