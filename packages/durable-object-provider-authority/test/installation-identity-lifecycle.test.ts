import {
  chmod,
  cp,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { createHmac } from "node:crypto";
import { fork } from "node:child_process";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "@understand-code/durable-object-provider-contracts/jcs";

import {
  createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  openOrInitializeProviderAcceptanceAuthorityForTestInternalV1,
  provisionProviderAcceptanceAuthorityForTestInternalV1,
} from "../src/test-seam-internal.js";
import {
  TEST_INSTALLATION_IDENTITY_GENERATION_ID,
  TEST_INSTALLATION_IDENTITY_KEY,
} from "./acceptance-store-fixtures.js";

const roots = new Set<string>();
const workerPath = fileURLToPath(
  new URL("./installation-identity-worker.mjs", import.meta.url),
);

afterEach(async () => {
  await Promise.all([...roots].map((root) =>
    rm(root, { recursive: true, force: true })
  ));
  roots.clear();
});

async function fixtureV1(): Promise<Readonly<{
  root: string;
  capability: ReturnType<
    typeof createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1
  >;
}>> {
  const root = await mkdtemp(join(tmpdir(), "provider-identity-lifecycle-"));
  const applicationRoot = join(root, "authority");
  roots.add(root);
  return Object.freeze({
    root: applicationRoot,
    capability:
      createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1(
        applicationRoot,
      ),
  });
}

const privatePathV1 = (root: string, name: string) =>
  join(root, "runtime-state", "private", name);

async function expectIdentityInvalidV1(operation: Promise<unknown>) {
  try {
    await operation;
    throw new Error("expected identity operation to fail");
  } catch (error) {
    expect(error).toMatchObject({
      name: "ProviderAcceptanceAuthorityErrorV1",
    });
    expect([
      "identity_key_invalid",
      "namespace_integrity_failed",
      "invalid_layout",
    ]).toContain(
      error !== null && typeof error === "object" && "code" in error
        ? error.code
        : undefined,
    );
  }
}

async function initializeInWorkerV1(root: string): Promise<string> {
  const child = fork(workerPath, [root], {
    env: { ...process.env, NODE_ENV: "test" },
    stdio: ["ignore", "ignore", "pipe", "ipc"],
  });
  const stderr: Buffer[] = [];
  child.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));
  return new Promise<string>((resolve, reject) => {
    child.once("message", (message: unknown) => {
      if (
        typeof message === "object" && message !== null &&
        "type" in message && message.type === "result" &&
        "installationIdentityGenerationId" in message &&
        typeof message.installationIdentityGenerationId === "string"
      ) {
        resolve(message.installationIdentityGenerationId);
      } else {
        reject(new Error(`worker failure: ${JSON.stringify(message)}`));
      }
    });
    child.once("exit", (code, signal) => {
      if (code !== 0) {
        reject(new Error(
          `worker exit ${String(code)}/${String(signal)}: ${Buffer.concat(stderr).toString("utf8")}`,
        ));
      }
    });
  });
}

describe("production installation identity lifecycle", () => {
  it("matches independent exact-field HMAC oracles without persisting path or owner bytes", async () => {
    const root = await mkdtemp(join(tmpdir(), "provider-identity-oracle-"));
    roots.add(root);
    const capability =
      createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1(root);
    await provisionProviderAcceptanceAuthorityForTestInternalV1(capability, {
      installationIdentityGenerationId:
        TEST_INSTALLATION_IDENTITY_GENERATION_ID,
      installationIdentityKey: TEST_INSTALLATION_IDENTITY_KEY,
    });
    const stateBytes = await readFile(
      privatePathV1(root, "installation-identity-v1.json"),
    );
    const state = JSON.parse(stateBytes.toString("utf8")) as Record<
      string,
      unknown
    >;
    const hmac = (domain: string, fields: object) =>
      `hmac-sha256:${createHmac("sha256", TEST_INSTALLATION_IDENTITY_KEY)
        .update(canonicalizeJcsSafeIntegerUtf8V1([domain, fields]))
        .digest("hex")}`;
    expect(state.keyCheckToken).toBe(hmac(
      "installation-identity-key-check-v1",
      {
        generationId: TEST_INSTALLATION_IDENTITY_GENERATION_ID,
        initializationNonce: state.initializationNonce,
      },
    ));
    const canonicalRoot = `base64url:${Buffer.from(
      await realpath(root),
      "utf8",
    ).toString("base64url")}`;
    const ownerIdentity = `base64url:${Buffer.from(
      `posix-uid:${userInfo({ encoding: "utf8" }).uid}`,
      "utf8",
    ).toString("base64url")}`;
    expect(state.stateRootBindingToken).toBe(hmac(
      "installation-state-root-binding-v1",
      {
        resolverId: "test-explicit-temporary-root-v1",
        canonicalStateRootBytes: canonicalRoot,
        ownerIdentity,
        stateRootFileIdentity: state.stateRootFileIdentity,
      },
    ));
    const persisted = stateBytes.toString("utf8");
    expect(persisted).not.toContain(canonicalRoot);
    expect(persisted).not.toContain(ownerIdentity);
  });

  it("rejects an empty pre-existing application root without adopting or writing it", async () => {
    const root = await mkdtemp(join(tmpdir(), "provider-preexisting-empty-"));
    roots.add(root);
    const capability =
      createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1(root);
    await expectIdentityInvalidV1(
      openOrInitializeProviderAcceptanceAuthorityForTestInternalV1(capability),
    );
    await expect(readdir(root)).resolves.toEqual([]);
  });

  it("rejects an unknown pre-existing entry without deleting or creating anything", async () => {
    const root = await mkdtemp(join(tmpdir(), "provider-preexisting-unknown-"));
    roots.add(root);
    const unknownPath = join(root, "unknown-executable");
    const unknownBytes = Buffer.from("do-not-adopt");
    await writeFile(unknownPath, unknownBytes, { mode: 0o700 });
    const capability =
      createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1(root);
    await expectIdentityInvalidV1(
      openOrInitializeProviderAcceptanceAuthorityForTestInternalV1(capability),
    );
    await expect(readFile(unknownPath)).resolves.toEqual(unknownBytes);
    await expect(readdir(root)).resolves.toEqual(["unknown-executable"]);
  });

  it("initializes exactly once and returns the same generation across restart", async () => {
    const { root, capability } = await fixtureV1();
    const first = await openOrInitializeProviderAcceptanceAuthorityForTestInternalV1(
      capability,
    );
    const second = await openOrInitializeProviderAcceptanceAuthorityForTestInternalV1(
      capability,
    );
    expect(second).toEqual(first);
    for (const name of [
      "installation-identity-v1.init",
      "installation-identity-v1.key",
      "installation-identity-v1.json",
    ]) {
      const metadata = await lstat(privatePathV1(root, name));
      expect(metadata.mode & 0o777).toBe(0o600);
      expect(metadata.nlink).toBe(1);
    }
  });

  it("serializes concurrent first opens into one generation", async () => {
    const { capability } = await fixtureV1();
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        openOrInitializeProviderAcceptanceAuthorityForTestInternalV1(
          capability,
        )
      ),
    );
    expect(new Set(results.map((value) =>
      value.installationIdentityGenerationId
    )).size).toBe(1);
  });

  it("converges twelve OS-process first opens on one generation", async () => {
    const parent = await mkdtemp(join(tmpdir(), "provider-process-bootstrap-"));
    roots.add(parent);
    const root = join(parent, "authority");
    const generations = await Promise.all(
      Array.from({ length: 12 }, () => initializeInWorkerV1(root)),
    );
    expect(new Set(generations).size).toBe(1);
  }, 20_000);

  for (const name of [
    "installation-identity-v1.init",
    "installation-identity-v1.key",
    "installation-identity-v1.json",
  ]) {
    it(`fails closed when active ${name} is missing`, async () => {
      const { root, capability } = await fixtureV1();
      await openOrInitializeProviderAcceptanceAuthorityForTestInternalV1(
        capability,
      );
      await unlink(privatePathV1(root, name));
      await expectIdentityInvalidV1(
        openOrInitializeProviderAcceptanceAuthorityForTestInternalV1(
          capability,
        ),
      );
    });
  }

  it("does not rekey after all active identity artifacts are deleted", async () => {
    const { root, capability } = await fixtureV1();
    const first =
      await openOrInitializeProviderAcceptanceAuthorityForTestInternalV1(
        capability,
      );
    const names = [
      "installation-identity-v1.init",
      "installation-identity-v1.key",
      "installation-identity-v1.json",
    ] as const;
    await Promise.all(names.map((name) => unlink(privatePathV1(root, name))));

    await expectIdentityInvalidV1(
      openOrInitializeProviderAcceptanceAuthorityForTestInternalV1(capability),
    );
    expect(first.installationIdentityGenerationId).toMatch(
      /^installation-identity-generation:[0-9a-f]{22}$/u,
    );
    for (const name of names) {
      await expect(lstat(privatePathV1(root, name))).rejects.toMatchObject({
        code: "ENOENT",
      });
    }
  });

  it("fails closed on state tamper and state-root inode replacement", async () => {
    const { root, capability } = await fixtureV1();
    await openOrInitializeProviderAcceptanceAuthorityForTestInternalV1(
      capability,
    );
    const statePath = privatePathV1(root, "installation-identity-v1.json");
    const original = await readFile(statePath);
    await writeFile(statePath, Buffer.concat([original, Buffer.from(" ")]));
    await expectIdentityInvalidV1(
      openOrInitializeProviderAcceptanceAuthorityForTestInternalV1(capability),
    );

    await rm(root, { recursive: true, force: true });
    roots.delete(root);
  });

  it("rejects symlink, loose mode, and extra hard link identity artifacts", async () => {
    for (const mutation of ["symlink", "mode", "nlink"] as const) {
      const { root, capability } = await fixtureV1();
      await openOrInitializeProviderAcceptanceAuthorityForTestInternalV1(
        capability,
      );
      const statePath = privatePathV1(root, "installation-identity-v1.json");
      if (mutation === "symlink") {
        const target = `${statePath}.target`;
        await rename(statePath, target);
        await symlink(target, statePath);
      } else if (mutation === "mode") {
        await chmod(statePath, 0o640);
      } else {
        await link(statePath, `${statePath}.extra-link`);
      }
      await expectIdentityInvalidV1(
        openOrInitializeProviderAcceptanceAuthorityForTestInternalV1(
          capability,
        ),
      );
    }
  });

  it("recovers an authenticated marker+key crash cut but rejects marker-only", async () => {
    const first = await fixtureV1();
    await expect(
      openOrInitializeProviderAcceptanceAuthorityForTestInternalV1(
        first.capability,
        {
          afterDurablePhase(phase) {
            if (phase === "identity_key_fsynced") throw new Error("crash-cut");
          },
        },
      ),
    ).rejects.toThrow("crash-cut");
    await expect(
      openOrInitializeProviderAcceptanceAuthorityForTestInternalV1(
        first.capability,
      ),
    ).resolves.toMatchObject({
      installationIdentityGenerationId: expect.stringMatching(
        /^installation-identity-generation:[0-9a-f]{22}$/u,
      ),
    });

    const second = await fixtureV1();
    await expect(
      openOrInitializeProviderAcceptanceAuthorityForTestInternalV1(
        second.capability,
        {
          afterDurablePhase(phase) {
            if (phase === "initializing_marker_fsynced") {
              throw new Error("crash-cut");
            }
          },
        },
      ),
    ).rejects.toThrow("crash-cut");
    await expectIdentityInvalidV1(
      openOrInitializeProviderAcceptanceAuthorityForTestInternalV1(
        second.capability,
      ),
    );
  });

  it("rejects copied identity state after the authority root inode drifts", async () => {
    const { root, capability } = await fixtureV1();
    await openOrInitializeProviderAcceptanceAuthorityForTestInternalV1(
      capability,
    );
    const oldRoot = `${root}-old`;
    roots.add(oldRoot);
    await rename(root, oldRoot);
    await mkdir(root, { mode: 0o700 });
    await cp(join(oldRoot, "runtime-state"), join(root, "runtime-state"), {
      recursive: true,
      preserveTimestamps: true,
    });
    await cp(join(oldRoot, "provider"), join(root, "provider"), {
      recursive: true,
      preserveTimestamps: true,
    });
    await expectIdentityInvalidV1(
      openOrInitializeProviderAcceptanceAuthorityForTestInternalV1(capability),
    );
  });
});
