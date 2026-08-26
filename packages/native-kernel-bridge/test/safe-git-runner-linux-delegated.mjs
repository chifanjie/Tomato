import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  armNativeTestSafeGitExecutableOwnerAdmissionV1,
  bindNativeSafeGitEmptyHooksDirectoryV1,
  bindNativeSafeGitExecutableV1,
  bindNativeSafeGitRepositoryControlV1,
  closeNativeInstallationStateAuthorityV1,
  closeNativeSafeGitDescriptorBootstrapV1,
  executeNativeSafeGitVersionV1,
  openNativeSafeGitDescriptorBootstrapV1,
  openNativeTestInstallationStateAuthorityV1,
  revalidateNativeSafeGitDescriptorBootstrapV1,
} from "../dist/index.js";

if (process.platform !== "linux") {
  throw new Error("delegated SafeGit adversarial proof requires Linux");
}

const testDirectory = dirname(fileURLToPath(import.meta.url));
const root = realpathSync(
  mkdtempSync(join(tmpdir(), "uc-safe-git-runner-adversarial-")),
);
const repository = join(root, "repository");
const authorityRoot = join(root, "authority");
const providedExecutable =
  process.env.UNDERSTAND_CODE_SAFE_GIT_ADVERSARIAL_EXECUTABLE;
const executable =
  providedExecutable === undefined
    ? join(root, "safe-git-adversarial")
    : realpathSync(providedExecutable);
const source = join(testDirectory, "fixtures", "safe-git-runner-adversarial.c");
const key = Buffer.alloc(32, 0x63);
let authority;
let bootstrap;

try {
  mkdirSync(repository, { mode: 0o700 });
  execFileSync("/usr/bin/git", ["init", "--quiet", repository], {
    stdio: "pipe",
  });
  if (providedExecutable === undefined) {
    execFileSync(
      process.env.CC ?? "/usr/bin/cc",
      [
        "-std=c11",
        "-O2",
        "-Wall",
        "-Wextra",
        "-Werror",
        source,
        "-o",
        executable,
      ],
      { stdio: "pipe" },
    );
    chmodSync(executable, 0o700);
  }

  authority = openNativeTestInstallationStateAuthorityV1(authorityRoot, {
    create: true,
  });
  bootstrap = openNativeSafeGitDescriptorBootstrapV1(repository);
  bindNativeSafeGitRepositoryControlV1(bootstrap.binding);
  bindNativeSafeGitEmptyHooksDirectoryV1(
    bootstrap.binding,
    authority.authority,
    key,
  );
  armNativeTestSafeGitExecutableOwnerAdmissionV1(
    bootstrap.binding,
    authority.authority,
  );
  bindNativeSafeGitExecutableV1(
    bootstrap.binding,
    authority.authority,
    key,
    executable,
  );
  const version = executeNativeSafeGitVersionV1(
    bootstrap.binding,
    authority.authority,
    key,
  );
  const layout = revalidateNativeSafeGitDescriptorBootstrapV1(
    bootstrap.binding,
  );
  if (
    version.major !== 9 ||
    version.minor !== 9 ||
    version.patch !== 9 ||
    layout !== "ordinary"
  ) {
    throw new Error("delegated SafeGit adversarial proof result is invalid");
  }
  process.stdout.write(
    `${JSON.stringify({
      profile: "safe_git_runner_linux_delegated_adversarial_v1",
      status: "verified",
      initialExecFd: "closed_after_exec",
      selfReexec: "denied",
      devNullIdentity: "character_device_1_3",
      ambientDeviceWrite: "denied",
      socket: "denied",
      userNamespace: "denied",
      cgroupCleanup: "revalidated_after_execution",
    })}\n`,
  );
} finally {
  if (bootstrap !== undefined) {
    closeNativeSafeGitDescriptorBootstrapV1(bootstrap.binding);
  }
  if (authority !== undefined) {
    closeNativeInstallationStateAuthorityV1(authority.authority);
  }
  rmSync(root, { force: true, recursive: true });
}
