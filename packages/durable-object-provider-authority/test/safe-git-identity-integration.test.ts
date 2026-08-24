import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  rmdir,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";
import {
  bindNativeSafeGitRepositoryControlV1,
  closeNativeSafeGitDescriptorBootstrapV1,
  openNativeSafeGitDescriptorBootstrapV1,
  revalidateNativeSafeGitDescriptorBootstrapV1,
} from "@understand-code/native-kernel-bridge";

import {
  bindProviderAcceptanceSafeGitEmptyHooksDirectoryForTestInternalV1,
  createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  deriveProviderAcceptanceSafeGitPathIdentityForTestInternalV1,
  provisionProviderAcceptanceAuthorityForTestInternalV1,
} from "../src/test-seam-internal.js";
import {
  TEST_INSTALLATION_IDENTITY_GENERATION_ID,
  TEST_INSTALLATION_IDENTITY_KEY,
} from "./acceptance-store-fixtures.js";

const execFileAsync = promisify(execFile);
const roots = new Set<string>();

async function snapshotTreeV1(root: string): Promise<readonly string[]> {
  const records: string[] = [];
  const visit = async (relativePath: string): Promise<void> => {
    const path = relativePath === "" ? root : join(root, relativePath);
    const metadata = await lstat(path);
    const kind = metadata.isDirectory()
      ? "directory"
      : metadata.isFile()
      ? "file"
      : "other";
    let digest = "";
    if (metadata.isFile()) {
      digest = createHash("sha256").update(await readFile(path)).digest("hex");
    }
    records.push(JSON.stringify({
      relativePath,
      kind,
      mode: metadata.mode,
      uid: metadata.uid,
      gid: metadata.gid,
      device: metadata.dev,
      inode: metadata.ino,
      size: metadata.size,
      mtimeMs: metadata.mtimeMs,
      digest,
    }));
    if (!metadata.isDirectory()) return;
    const names = await readdir(path);
    names.sort();
    for (const name of names) {
      await visit(relativePath === "" ? name : join(relativePath, name));
    }
  };
  await visit("");
  return Object.freeze(records);
}

async function fixtureV1() {
  const repositoryParent = await realpath(
    await mkdtemp(join(tmpdir(), "provider-hooks-git-")),
  );
  const stateParent = await realpath(
    await mkdtemp(join(tmpdir(), "provider-hooks-state-")),
  );
  roots.add(repositoryParent);
  roots.add(stateParent);
  const repositoryRoot = join(repositoryParent, "repository");
  await mkdir(repositoryRoot, { mode: 0o700 });
  await execFileAsync("git", ["init", "--quiet", repositoryRoot], {
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1" },
  });
  const bootstrap = openNativeSafeGitDescriptorBootstrapV1(repositoryRoot);
  bindNativeSafeGitRepositoryControlV1(bootstrap.binding);
  const stateRoot = join(stateParent, "authority");
  const capability =
    createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1(stateRoot);
  return Object.freeze({ bootstrap, stateRoot, capability });
}

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

  it("binds the authenticated empty hooks directory without exposing key custody", async () => {
    const fixture = await fixtureV1();
    try {
      const binding =
        await bindProviderAcceptanceSafeGitEmptyHooksDirectoryForTestInternalV1(
          fixture.capability,
          fixture.bootstrap.binding,
        );
      expect(binding).toMatchObject({
        profile: "native_safe_git_empty_hooks_binding_v1",
        directoryIdentity: {
          platform: "posix",
          device: expect.stringMatching(/^(0|[1-9][0-9]*)$/u),
          inode: expect.stringMatching(/^(0|[1-9][0-9]*)$/u),
        },
        emptyHooksDirectoryToken: expect.stringMatching(
          /^hmac-sha256:[0-9a-f]{64}$/u,
        ),
      });
      await expect(
        readdir(join(
          fixture.stateRoot,
          "runtime-state/private/safe-git-empty-hooks-v1",
        )),
      ).resolves.toEqual([]);
    } finally {
      closeNativeSafeGitDescriptorBootstrapV1(fixture.bootstrap.binding);
    }
  });

  it("keeps exact legacy identity readable but rejects hooks binding with zero writes", async () => {
    const fixture = await fixtureV1();
    try {
      await provisionProviderAcceptanceAuthorityForTestInternalV1(
        fixture.capability,
        {
          installationIdentityGenerationId:
            TEST_INSTALLATION_IDENTITY_GENERATION_ID,
          installationIdentityKey: TEST_INSTALLATION_IDENTITY_KEY,
          legacyWithoutEmptyHooksDirectoryBinding: true,
        },
      );
      await rmdir(join(
        fixture.stateRoot,
        "runtime-state/private/safe-git-empty-hooks-v1",
      ));
      await expect(
        deriveProviderAcceptanceSafeGitPathIdentityForTestInternalV1(
          fixture.capability,
          fixture.bootstrap.binding,
        ),
      ).resolves.toMatchObject({
        profile: "native_safe_git_path_identity_v1",
      });
      const before = await snapshotTreeV1(fixture.stateRoot);
      await expect(
        bindProviderAcceptanceSafeGitEmptyHooksDirectoryForTestInternalV1(
          fixture.capability,
          fixture.bootstrap.binding,
        ),
      ).rejects.toMatchObject({ code: "identity_key_invalid" });
      await expect(snapshotTreeV1(fixture.stateRoot)).resolves.toEqual(before);
      expect(() =>
        revalidateNativeSafeGitDescriptorBootstrapV1(
          fixture.bootstrap.binding,
        )
      ).toThrow();
    } finally {
      closeNativeSafeGitDescriptorBootstrapV1(fixture.bootstrap.binding);
    }
  });

  for (const mutation of ["nonempty", "swapped"] as const) {
    it(`fails closed with zero writes when the hooks directory is ${mutation}`, async () => {
      const fixture = await fixtureV1();
      try {
        await deriveProviderAcceptanceSafeGitPathIdentityForTestInternalV1(
          fixture.capability,
          fixture.bootstrap.binding,
        );
        const hooksPath = join(
          fixture.stateRoot,
          "runtime-state/private/safe-git-empty-hooks-v1",
        );
        if (mutation === "nonempty") {
          await writeFile(join(hooksPath, "hostile-hook"), "must remain\n", {
            mode: 0o600,
          });
        } else {
          await rename(hooksPath, `${hooksPath}.old`);
          await mkdir(hooksPath, { mode: 0o700 });
        }
        const before = await snapshotTreeV1(fixture.stateRoot);
        await expect(
          bindProviderAcceptanceSafeGitEmptyHooksDirectoryForTestInternalV1(
            fixture.capability,
            fixture.bootstrap.binding,
          ),
        ).rejects.toThrow();
        await expect(snapshotTreeV1(fixture.stateRoot)).resolves.toEqual(before);
        expect(() =>
          revalidateNativeSafeGitDescriptorBootstrapV1(
            fixture.bootstrap.binding,
          )
        ).toThrow();
      } finally {
        closeNativeSafeGitDescriptorBootstrapV1(fixture.bootstrap.binding);
      }
    });
  }

  it("rejects an identity-state hooks token tamper without repairing or writing", async () => {
    const fixture = await fixtureV1();
    try {
      await deriveProviderAcceptanceSafeGitPathIdentityForTestInternalV1(
        fixture.capability,
        fixture.bootstrap.binding,
      );
      const statePath = join(
        fixture.stateRoot,
        "runtime-state/private/installation-identity-v1.json",
      );
      const state = JSON.parse(await readFile(statePath, "utf8")) as {
        emptyHooksDirectoryBinding: { emptyHooksDirectoryToken: string };
      };
      const token = state.emptyHooksDirectoryBinding.emptyHooksDirectoryToken;
      state.emptyHooksDirectoryBinding.emptyHooksDirectoryToken =
        `${token.slice(0, -1)}${token.endsWith("0") ? "1" : "0"}`;
      await writeFile(statePath, JSON.stringify(state), { mode: 0o600 });
      const before = await snapshotTreeV1(fixture.stateRoot);
      await expect(
        bindProviderAcceptanceSafeGitEmptyHooksDirectoryForTestInternalV1(
          fixture.capability,
          fixture.bootstrap.binding,
        ),
      ).rejects.toMatchObject({ code: "identity_key_invalid" });
      await expect(snapshotTreeV1(fixture.stateRoot)).resolves.toEqual(before);
      expect(() =>
        revalidateNativeSafeGitDescriptorBootstrapV1(
          fixture.bootstrap.binding,
        )
      ).toThrow();
    } finally {
      closeNativeSafeGitDescriptorBootstrapV1(fixture.bootstrap.binding);
    }
  });
});
