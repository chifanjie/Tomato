import { createHash, randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { once } from "node:events";

import { afterEach, describe, expect, it } from "vitest";

import {
  createDurableObjectProviderRuntimeClientV1,
  createProviderMigrationDurableExecutionHostV1,
  runProviderMigrationDurableExecutionWithTwoRuntimeClientsV1,
} from "../src/index.js";

const runtimeCliPath = fileURLToPath(
  new URL(
    "../../durable-object-provider-runtime/dist/cli.js",
    import.meta.url,
  ),
);
const SOURCE_PROVIDER_ID = "durable-object-provider:durable-source";
const DESTINATION_PROVIDER_ID = "durable-object-provider:durable-destination";
const SOURCE_CAPABILITY_DIGEST = `sha256:${"a".repeat(64)}` as const;
const DESTINATION_CAPABILITY_DIGEST = `sha256:${"b".repeat(64)}` as const;
const children = new Set<ChildProcess>();

interface RunningRuntimeV1 {
  readonly child: ChildProcess;
  readonly socketPath: string;
}

async function stopChildV1(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    children.delete(child);
    return;
  }
  child.kill("SIGTERM");
  await once(child, "exit");
  children.delete(child);
}

afterEach(async () => {
  await Promise.all([...children].map(stopChildV1));
});

async function prepareRootV1(prefix: string, key: Uint8Array) {
  void prefix;
  // Darwin's sockaddr_un path is short; keep the fixture below that platform
  // limit while still using distinct private roots for each runtime.
  const parent = await mkdtemp(join(tmpdir(), "ucp-"));
  const rootPath = join(parent, "r");
  await mkdir(rootPath, { mode: 0o700 });
  const keyPath = join(rootPath, "k");
  await writeFile(keyPath, key, { mode: 0o600 });
  return { rootPath, keyPath, socketPath: join(rootPath, "s") };
}

async function startRuntimeV1(input: {
  readonly rootPath: string;
  readonly keyPath: string;
  readonly socketPath: string;
  readonly providerId: string;
  readonly capabilityDigest: string;
}): Promise<RunningRuntimeV1> {
  const child = spawn(
    process.execPath,
    [
      runtimeCliPath,
      "--root",
      input.rootPath,
      "--socket",
      input.socketPath,
      "--auth-key-file",
      input.keyPath,
      "--provider-id",
      input.providerId,
      "--capability-digest",
      input.capabilityDigest,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  children.add(child);
  const stdout = createInterface({ input: child.stdout!, crlfDelay: Infinity });
  const stderrChunks: Buffer[] = [];
  child.stderr!.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
  const ready = await Promise.race([
    once(stdout, "line").then(([line]) => JSON.parse(String(line)) as unknown),
    once(child, "exit").then(([code, signal]) => {
      throw new Error(
        `runtime exited before ready (${String(code)}/${String(signal)}): ${Buffer.concat(stderrChunks).toString("utf8")}`,
      );
    }),
    new Promise<never>((_resolve, reject) =>
      setTimeout(() => reject(new Error("runtime ready timeout")), 5_000),
    ),
  ]);
  stdout.close();
  expect(ready).toMatchObject({
    profile: "understand_code_durable_provider_runtime_ready_v1",
    socketPath: input.socketPath,
  });
  return { child, socketPath: input.socketPath };
}

function contentDigestV1(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function makeClientV1(input: {
  readonly socketPath: string;
  readonly key: Uint8Array;
  readonly providerId: string;
  readonly capabilityDigest: `sha256:${string}`;
}) {
  return createDurableObjectProviderRuntimeClientV1({
    socketPath: input.socketPath,
    sharedSecret: input.key,
    verifiedSelection: {
      verification: "caller_verified_registry_selection_v1",
      providerId: input.providerId,
      capabilityDigest: input.capabilityDigest,
    },
  });
}

describe("durable Provider IPC client and migration host", () => {
  it("copies a fixed-locator object across two child runtimes and recovers bytes and journal after restart", async () => {
    const sourceKey = randomBytes(32);
    const destinationKey = randomBytes(32);
    const sourcePaths = await prepareRootV1("provider-source-", sourceKey);
    const destinationPaths = await prepareRootV1(
      "provider-destination-",
      destinationKey,
    );
    const sourceRuntime = await startRuntimeV1({
      ...sourcePaths,
      providerId: SOURCE_PROVIDER_ID,
      capabilityDigest: SOURCE_CAPABILITY_DIGEST,
    });
    let destinationRuntime = await startRuntimeV1({
      ...destinationPaths,
      providerId: DESTINATION_PROVIDER_ID,
      capabilityDigest: DESTINATION_CAPABILITY_DIGEST,
    });
    const sourceClient = makeClientV1({
      socketPath: sourceRuntime.socketPath,
      key: sourceKey,
      providerId: SOURCE_PROVIDER_ID,
      capabilityDigest: SOURCE_CAPABILITY_DIGEST,
    });
    let destinationClient = makeClientV1({
      socketPath: destinationRuntime.socketPath,
      key: destinationKey,
      providerId: DESTINATION_PROVIDER_ID,
      capabilityDigest: DESTINATION_CAPABILITY_DIGEST,
    });
    const bytes = Buffer.from("real provider migration object bytes", "utf8");
    const digest = contentDigestV1(bytes);
    const encoded = `base64url:${bytes.toString("base64url")}`;
    await sourceClient.writeObject({
      locator: {
        providerId: SOURCE_PROVIDER_ID as never,
        contentDigest: digest as never,
      },
      logicalBytes: bytes.byteLength,
      bytes: encoded,
    });
    let host = createProviderMigrationDurableExecutionHostV1({
      sourceClient,
      destinationClient,
      sourceVerifiedSelection: {
        verification: "caller_verified_registry_selection_v1",
        providerId: SOURCE_PROVIDER_ID,
        capabilityDigest: SOURCE_CAPABILITY_DIGEST,
      },
      destinationVerifiedSelection: {
        verification: "caller_verified_registry_selection_v1",
        providerId: DESTINATION_PROVIDER_ID,
        capabilityDigest: DESTINATION_CAPABILITY_DIGEST,
      },
    });
    const sourceRead = await host.readSourceObject({
      providerId: SOURCE_PROVIDER_ID as never,
      contentDigest: digest as never,
    });
    const firstWrite = await host.writeDestinationObject({
      locator: {
        providerId: DESTINATION_PROVIDER_ID as never,
        contentDigest: digest as never,
      },
      logicalBytes: bytes.byteLength,
      bytes: sourceRead.bytes,
    });
    expect(firstWrite.resolution).toBe("committed");

    // Crash cut: object is durable, journal is not yet committed.
    destinationRuntime.child.kill("SIGKILL");
    await once(destinationRuntime.child, "exit");
    children.delete(destinationRuntime.child);
    destinationRuntime = await startRuntimeV1({
      ...destinationPaths,
      providerId: DESTINATION_PROVIDER_ID,
      capabilityDigest: DESTINATION_CAPABILITY_DIGEST,
    });
    destinationClient = makeClientV1({
      socketPath: destinationRuntime.socketPath,
      key: destinationKey,
      providerId: DESTINATION_PROVIDER_ID,
      capabilityDigest: DESTINATION_CAPABILITY_DIGEST,
    });
    host = createProviderMigrationDurableExecutionHostV1({
      sourceClient,
      destinationClient,
      sourceVerifiedSelection: {
        verification: "caller_verified_registry_selection_v1",
        providerId: SOURCE_PROVIDER_ID,
        capabilityDigest: SOURCE_CAPABILITY_DIGEST,
      },
      destinationVerifiedSelection: {
        verification: "caller_verified_registry_selection_v1",
        providerId: DESTINATION_PROVIDER_ID,
        capabilityDigest: DESTINATION_CAPABILITY_DIGEST,
      },
    });
    const replayedWrite = await host.writeDestinationObject({
      locator: {
        providerId: DESTINATION_PROVIDER_ID as never,
        contentDigest: digest as never,
      },
      logicalBytes: bytes.byteLength,
      bytes: encoded,
    });
    expect(replayedWrite.resolution).toBe("replayed");
    const committed = await host.compareCommitDestinationJournal({
      expectedRevision: 0,
      operationNonce: "1".repeat(32),
      phase: "execution_completed",
      artifacts: { objectDigest: digest, objectCount: 1 },
    });
    expect(committed).toMatchObject({
      resolution: "committed",
      state: { revision: 1, phase: "execution_completed" },
    });

    await stopChildV1(destinationRuntime.child);
    destinationRuntime = await startRuntimeV1({
      ...destinationPaths,
      providerId: DESTINATION_PROVIDER_ID,
      capabilityDigest: DESTINATION_CAPABILITY_DIGEST,
    });
    destinationClient = makeClientV1({
      socketPath: destinationRuntime.socketPath,
      key: destinationKey,
      providerId: DESTINATION_PROVIDER_ID,
      capabilityDigest: DESTINATION_CAPABILITY_DIGEST,
    });
    expect(
      await destinationClient.readObject({
        providerId: DESTINATION_PROVIDER_ID as never,
        contentDigest: digest as never,
      }),
    ).toMatchObject({ bytes: encoded, verifiedContentDigest: digest });
    expect(await destinationClient.inspectState()).toMatchObject({
      state: { revision: 1, phase: "execution_completed" },
    });
  });

  it("locks verifiedSelection against post-construction mutation", async () => {
    const sourceKey = randomBytes(32);
    const sourcePaths = await prepareRootV1("provider-source-", sourceKey);
    const sourceRuntime = await startRuntimeV1({
      ...sourcePaths,
      providerId: SOURCE_PROVIDER_ID,
      capabilityDigest: SOURCE_CAPABILITY_DIGEST,
    });
    const verifiedSelection = {
      verification: "caller_verified_registry_selection_v1" as const,
      providerId: SOURCE_PROVIDER_ID,
      capabilityDigest: SOURCE_CAPABILITY_DIGEST,
    };
    const client = createDurableObjectProviderRuntimeClientV1({
      socketPath: sourceRuntime.socketPath,
      sharedSecret: sourceKey,
      verifiedSelection,
    });
    verifiedSelection.capabilityDigest = DESTINATION_CAPABILITY_DIGEST;
    await expect(client.inspectState()).resolves.toMatchObject({
      operation: "inspect_state",
      state: { revision: 0 },
    });
  });

  it("returns the durable observed revision on stale compare-commit", async () => {
    const key = randomBytes(32);
    const paths = await prepareRootV1("provider-stale-", key);
    const runtime = await startRuntimeV1({
      ...paths,
      providerId: DESTINATION_PROVIDER_ID,
      capabilityDigest: DESTINATION_CAPABILITY_DIGEST,
    });
    const client = makeClientV1({
      socketPath: runtime.socketPath,
      key,
      providerId: DESTINATION_PROVIDER_ID,
      capabilityDigest: DESTINATION_CAPABILITY_DIGEST,
    });
    const entrypointFailure =
      await runProviderMigrationDurableExecutionWithTwoRuntimeClientsV1({
        lifecycleInput: {} as never,
        sourceClient: client,
        destinationClient: client,
        sourceVerifiedSelection: {
          verification: "caller_verified_registry_selection_v1",
          providerId: SOURCE_PROVIDER_ID,
          capabilityDigest: SOURCE_CAPABILITY_DIGEST,
        },
        destinationVerifiedSelection: {
          verification: "caller_verified_registry_selection_v1",
          providerId: DESTINATION_PROVIDER_ID,
          capabilityDigest: DESTINATION_CAPABILITY_DIGEST,
        },
        expectedDurableJournalRevision: 0,
        durableOperationNonceSeed: "4".repeat(32),
      });
    expect(entrypointFailure).toMatchObject({
      ok: false,
      stage: "reference_lifecycle",
      reason: "reference_lifecycle_rejected",
    });
    await client.compareCommit({
      expectedRevision: 0,
      operationNonce: "2".repeat(32),
      phase: "prepared",
      artifacts: { marker: "first" },
    });
    const stale = await client.compareCommit({
      expectedRevision: 0,
      operationNonce: "3".repeat(32),
      phase: "terminal",
      artifacts: { marker: "stale" },
    });
    expect(stale).toMatchObject({
      resolution: "stale",
      state: { revision: 1, phase: "prepared" },
    });
  });
});
