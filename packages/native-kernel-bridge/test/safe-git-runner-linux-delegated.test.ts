import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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
} from "../src/index.js";

const RUN_DELEGATED_LINUX_ADVERSARIAL_V1 =
  process.platform === "linux" &&
  process.env.UNDERSTAND_CODE_RUN_DELEGATED_SAFE_GIT_ADVERSARIAL_V1 === "1";

describe.runIf(RUN_DELEGATED_LINUX_ADVERSARIAL_V1)(
  "delegated Linux SafeGit runner adversarial boundary",
  () => {
    it("closes initial exec authority and admits only the exact /dev/null device", () => {
      const root = realpathSync(
        mkdtempSync(join(tmpdir(), "uc-safe-git-runner-adversarial-")),
      );
      const repository = join(root, "repository");
      const authorityRoot = join(root, "authority");
      const executable = join(root, "safe-git-adversarial");
      const source = fileURLToPath(
        new URL("./fixtures/safe-git-runner-adversarial.c", import.meta.url),
      );
      const key = Buffer.alloc(32, 0x63);
      let authority:
        | ReturnType<typeof openNativeTestInstallationStateAuthorityV1>
        | undefined;
      let bootstrap:
        | ReturnType<typeof openNativeSafeGitDescriptorBootstrapV1>
        | undefined;
      try {
        mkdirSync(repository, { mode: 0o700 });
        execFileSync("/usr/bin/git", ["init", "--quiet", repository], {
          stdio: "pipe",
        });
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

        expect(
          executeNativeSafeGitVersionV1(
            bootstrap.binding,
            authority.authority,
            key,
          ),
        ).toStrictEqual({ major: 9, minor: 9, patch: 9 });
        expect(
          revalidateNativeSafeGitDescriptorBootstrapV1(bootstrap.binding),
        ).toBe("ordinary");
      } finally {
        if (bootstrap !== undefined) {
          closeNativeSafeGitDescriptorBootstrapV1(bootstrap.binding);
        }
        if (authority !== undefined) {
          closeNativeInstallationStateAuthorityV1(authority.authority);
        }
        rmSync(root, { force: true, recursive: true });
      }
    });
  },
);
