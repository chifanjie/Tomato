import { execFile } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";
import {
  bindNativeSafeGitRepositoryControlV1,
  closeNativeSafeGitDescriptorBootstrapV1,
  openNativeSafeGitDescriptorBootstrapV1,
} from "@understand-code/native-kernel-bridge";

import {
  createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  deriveProviderAcceptanceSafeGitPathIdentityForTestInternalV1,
} from "../src/test-seam-internal.js";

const execFileAsync = promisify(execFile);
const roots = new Set<string>();

afterEach(async () => {
  await Promise.all([...roots].map((root) =>
    rm(root, { recursive: true, force: true })
  ));
  roots.clear();
});

describe("Provider custody to native SafeGit identity integration", () => {
  it("derives stable real identities and rejects equal or descendant state roots", async () => {
    const repositoryParent = await realpath(
      await mkdtemp(join(tmpdir(), "provider-real-git-")),
    );
    const repositoryRoot = join(repositoryParent, "repository");
    const stateParent = await realpath(
      await mkdtemp(join(tmpdir(), "provider-real-state-")),
    );
    roots.add(repositoryParent);
    roots.add(stateParent);
    await mkdir(repositoryRoot, { mode: 0o700 });
    await execFileAsync("git", ["init", "--quiet", repositoryRoot], {
      env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1" },
    });
    const bootstrap = openNativeSafeGitDescriptorBootstrapV1(repositoryRoot);
    bindNativeSafeGitRepositoryControlV1(bootstrap.binding);
    try {
      const stateRoot = join(stateParent, "authority");
      const capability =
        createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1(
          stateRoot,
        );
      const first =
        await deriveProviderAcceptanceSafeGitPathIdentityForTestInternalV1(
          capability,
          bootstrap.binding,
        );
      const second =
        await deriveProviderAcceptanceSafeGitPathIdentityForTestInternalV1(
          capability,
          bootstrap.binding,
        );
      expect(second).toEqual(first);
      expect(first).toMatchObject({
        profile: "native_safe_git_path_identity_v1",
        repositoryId: expect.stringMatching(/^repo-hmac-[0-9a-f]{64}$/u),
        worktreeId: expect.stringMatching(/^worktree-hmac-[0-9a-f]{64}$/u),
        rootIdentity: expect.stringMatching(/^root-hmac-[0-9a-f]{64}$/u),
      });

      const equal =
        createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1(
          repositoryRoot,
        );
      await expect(
        deriveProviderAcceptanceSafeGitPathIdentityForTestInternalV1(
          equal,
          bootstrap.binding,
        ),
      ).rejects.toThrow();

      const descendant =
        createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1(
          join(repositoryRoot, ".provider-state"),
        );
      await expect(
        deriveProviderAcceptanceSafeGitPathIdentityForTestInternalV1(
          descendant,
          bootstrap.binding,
        ),
      ).rejects.toThrow();
    } finally {
      closeNativeSafeGitDescriptorBootstrapV1(bootstrap.binding);
    }
  });
});
