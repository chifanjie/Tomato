import { fork, type ChildProcess } from "node:child_process";
import {
  chmod,
  lstat,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ProviderAcceptanceCompareAppendResultV1Schema,
  ProviderAcceptanceCurrentReadV1Schema,
  type ProviderAcceptanceCompareAppendRequestV1,
  type ProviderAcceptanceCompareAppendResultV1,
  type ProviderAcceptanceCurrentReadV1,
} from "@understand-code/durable-object-provider-contracts/provider-acceptance";
import { afterEach, describe, expect, it } from "vitest";

import {
  createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  inspectProviderAcceptanceAuthoritySnapshotForTestInternalV1,
  openProviderAcceptanceAuthorityStoreForTestInternalV1,
  provisionProviderAcceptanceAuthorityForTestInternalV1,
  type ProviderAcceptanceAuthorityStoreOpenOptionsInternalV1,
} from "../src/test-seam-internal.js";
import {
  TEST_INSTALLATION_IDENTITY_GENERATION_ID,
  TEST_INSTALLATION_IDENTITY_KEY,
  genesisRequestV1,
  operationNonceV1,
  successorRequestV1,
  testAuthorityClockV1,
} from "./acceptance-store-fixtures.js";

type ProviderAcceptanceAuthorityDurablePhaseInternalV1 = Parameters<
  NonNullable<
    ProviderAcceptanceAuthorityStoreOpenOptionsInternalV1["afterDurablePhase"]
  >
>[0];

type WorkerMessageV1 =
  | { readonly type: "ready" }
  | {
      readonly type: "phase";
      readonly phase: ProviderAcceptanceAuthorityDurablePhaseInternalV1;
    }
  | {
      readonly type: "result";
      readonly result: ProviderAcceptanceCompareAppendResultV1;
    }
  | {
      readonly type: "error";
      readonly error: Readonly<{
        name?: string;
        code?: string;
        message?: string;
        stack?: string;
        ownPropertyNames?: readonly string[];
        hasCause?: boolean;
        hasPath?: boolean;
        hasDestination?: boolean;
        json?: string;
        stringValue?: string;
      }>;
    };

const workerPath = fileURLToPath(
  new URL("./acceptance-store-worker.mjs", import.meta.url),
);
const fixtureRoots = new Set<string>();
const childProcesses = new Set<ChildProcess>();

afterEach(async () => {
  for (const child of childProcesses) child.kill("SIGKILL");
  childProcesses.clear();
  await Promise.all(
    [...fixtureRoots].map((root) => rm(root, { recursive: true, force: true })),
  );
  fixtureRoots.clear();
});

async function fixtureV1() {
  const root = await mkdtemp(join(tmpdir(), "provider-authority-process-"));
  fixtureRoots.add(root);
  const capability =
    createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1(root);
  await provisionProviderAcceptanceAuthorityForTestInternalV1(capability, {
    installationIdentityGenerationId:
      TEST_INSTALLATION_IDENTITY_GENERATION_ID,
    installationIdentityKey: TEST_INSTALLATION_IDENTITY_KEY,
  });
  const store =
    await openProviderAcceptanceAuthorityStoreForTestInternalV1(capability, {
      clock: testAuthorityClockV1,
    });
  return { root, capability, store };
}

function currentV1(
  result: Awaited<
    ReturnType<
      Awaited<
        ReturnType<
          typeof openProviderAcceptanceAuthorityStoreForTestInternalV1
        >
      >["readCurrent"]
    >
  >,
): ProviderAcceptanceCurrentReadV1 {
  if (result.state !== "current") throw new Error("expected current");
  return ProviderAcceptanceCurrentReadV1Schema.parse(result.current);
}

function startWorkerV1(options: Readonly<{
  mode: "compare" | "crash" | "lock_crash" | "release_error";
  root: string;
  request: ProviderAcceptanceCompareAppendRequestV1;
  targetPhase?: ProviderAcceptanceAuthorityDurablePhaseInternalV1;
}>): ChildProcess {
  const child = fork(workerPath, [], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      AUTHORITY_WORKER_MODE: options.mode,
      AUTHORITY_WORKER_ROOT: options.root,
      AUTHORITY_WORKER_REQUEST_BASE64: Buffer.from(
        JSON.stringify(options.request),
        "utf8",
      ).toString("base64"),
      ...(options.targetPhase === undefined
        ? {}
        : { AUTHORITY_WORKER_TARGET_PHASE: options.targetPhase }),
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  childProcesses.add(child);
  return child;
}

function waitForMessageV1<T extends WorkerMessageV1["type"]>(
  child: ChildProcess,
  type: T,
): Promise<Extract<WorkerMessageV1, { readonly type: T }>> {
  return new Promise((resolvePromise, rejectPromise) => {
    let stderr = "";
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    const timeout = setTimeout(() => {
      cleanupV1();
      rejectPromise(
        new Error(`authority worker timed out waiting for ${type}: ${stderr}`),
      );
    }, 10_000);
    const onMessage = (message: unknown) => {
      if (
        message !== null &&
        typeof message === "object" &&
        "type" in message &&
        message.type === type
      ) {
        cleanupV1();
        resolvePromise(
          message as Extract<WorkerMessageV1, { readonly type: T }>,
        );
        return;
      }
      if (
        message !== null &&
        typeof message === "object" &&
        "type" in message &&
        message.type === "error"
      ) {
        cleanupV1();
        rejectPromise(
          new Error(`authority worker error: ${JSON.stringify(message)}`),
        );
      }
    };
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      cleanupV1();
      rejectPromise(
        new Error(
          `authority worker exited before ${type}: code=${String(code)} signal=${String(signal)} ${stderr}`,
        ),
      );
    };
    const cleanupV1 = () => {
      clearTimeout(timeout);
      child.off("message", onMessage);
      child.off("exit", onExit);
    };
    child.on("message", onMessage);
    child.once("exit", onExit);
  });
}

function waitForExitV1(
  child: ChildProcess,
): Promise<Readonly<{ code: number | null; signal: NodeJS.Signals | null }>> {
  return new Promise((resolvePromise) => {
    child.once("exit", (code, signal) => {
      childProcesses.delete(child);
      resolvePromise({ code, signal });
    });
  });
}

const LOCK_CANONICAL_NAME_V1 = ".provider-acceptance-authority-v1.lock";
const LOCK_STAGE_NAME_V1 = ".provider-acceptance-authority-v1.lock.stage";
const LOCK_RECOVERY_NAME_V1 =
  ".provider-acceptance-authority-v1.lock.recovery";
const LOCK_QUARANTINE_NAME_V1 =
  ".provider-acceptance-authority-v1.lock.stale";
const LOCK_PREPARATION_PREFIX_V1 =
  ".provider-acceptance-authority-v1.lock.prepare-";
const LOCK_RECOVERY_PREPARATION_PREFIX_V1 =
  ".provider-acceptance-authority-v1.lock.recovery.prepare-";

function privateDirectoryV1(root: string): string {
  return join(root, "runtime-state", "private");
}

function lockPathV1(root: string, name: string): string {
  return join(privateDirectoryV1(root), name);
}

async function lockProtocolEntriesV1(root: string): Promise<readonly string[]> {
  return (await readdir(privateDirectoryV1(root)))
    .filter((name) => name.startsWith(".provider-acceptance-authority-v1.lock"))
    .sort();
}

async function expectSameInodeWithLinksV1(
  leftPath: string,
  rightPath: string,
  expectedLinks: number,
): Promise<void> {
  const [left, right] = await Promise.all([
    lstat(leftPath),
    lstat(rightPath),
  ]);
  expect({ dev: left.dev, ino: left.ino }).toEqual({
    dev: right.dev,
    ino: right.ino,
  });
  expect([left.nlink, right.nlink]).toEqual([
    expectedLinks,
    expectedLinks,
  ]);
}

async function killAtLockPhaseV1(input: Readonly<{
  root: string;
  request: ProviderAcceptanceCompareAppendRequestV1;
  phase: ProviderAcceptanceAuthorityDurablePhaseInternalV1;
}>): Promise<void> {
  const child = startWorkerV1({
    mode: "lock_crash",
    root: input.root,
    request: input.request,
    targetPhase: input.phase,
  });
  const reachedPhase = waitForMessageV1(child, "phase");
  const exited = waitForExitV1(child);
  await expect(reachedPhase).resolves.toEqual({
    type: "phase",
    phase: input.phase,
  });
  child.kill("SIGKILL");
  await expect(exited).resolves.toEqual({ code: null, signal: "SIGKILL" });
}

async function leaveCommittedStaleLockV1(
  root: string,
  request: ProviderAcceptanceCompareAppendRequestV1,
): Promise<void> {
  const child = startWorkerV1({
    mode: "crash",
    root,
    request,
    targetPhase: "snapshot_directory_fsynced_before_response",
  });
  const ready = waitForMessageV1(child, "ready");
  await ready;
  const reachedPhase = waitForMessageV1(child, "phase");
  const exited = waitForExitV1(child);
  child.send({ type: "go" });
  await expect(reachedPhase).resolves.toEqual({
    type: "phase",
    phase: "snapshot_directory_fsynced_before_response",
  });
  child.kill("SIGKILL");
  await expect(exited).resolves.toEqual({ code: null, signal: "SIGKILL" });
}

async function expectRecoveredGenesisAndNoLockTransientsV1(input: Readonly<{
  root: string;
  capability: Parameters<
    typeof openProviderAcceptanceAuthorityStoreForTestInternalV1
  >[0];
  request: ProviderAcceptanceCompareAppendRequestV1;
}>): Promise<void> {
  const recovered =
    await openProviderAcceptanceAuthorityStoreForTestInternalV1(
      input.capability,
      { clock: testAuthorityClockV1 },
    );
  const result = ProviderAcceptanceCompareAppendResultV1Schema.parse(
    await recovered.compareAppend(input.request),
  );
  expect(result.resolution).toBe("resolved");
  if (result.resolution === "resolved") {
    expect(result.receipt.payload.durableOutcome.outcome).toBe("committed");
  }
  await expect(
    inspectProviderAcceptanceAuthoritySnapshotForTestInternalV1(
      input.capability,
    ),
  ).resolves.toMatchObject({
    generationCount: 1,
    receiptCount: 1,
    transactionCount: 1,
  });
  expect(await lockProtocolEntriesV1(input.root)).toEqual([]);
}

describe("provider Acceptance authority OS-process serialization", () => {
  it("serializes two processes from the same head into one G2 and one durable expected_current_changed receipt", async () => {
    const { root, capability, store } = await fixtureV1();
    await store.compareAppend(genesisRequestV1());
    const current = currentV1(await store.readCurrent());
    const leftRequest = successorRequestV1({
      current,
      operationNonce: operationNonceV1(21),
    });

    // Rebuild the right request through the fixture with distinct floors so it
    // remains formally self-consistent while competing for the exact same head.
    const validRightRequest = successorRequestV1({
      current,
      operationNonce: operationNonceV1(22),
      floors: {
        rootMetadataGeneration: 2,
        registryManifestGeneration: 2,
        supportCatalogGeneration: 2,
      },
    });
    const left = startWorkerV1({
      mode: "compare",
      root,
      request: leftRequest,
    });
    const leftReady = waitForMessageV1(left, "ready");
    const right = startWorkerV1({
      mode: "compare",
      root,
      request: validRightRequest,
    });
    const rightReady = waitForMessageV1(right, "ready");
    await Promise.all([leftReady, rightReady]);
    const leftResultPromise = waitForMessageV1(left, "result");
    const rightResultPromise = waitForMessageV1(right, "result");
    const leftExit = waitForExitV1(left);
    const rightExit = waitForExitV1(right);
    left.send({ type: "go" });
    right.send({ type: "go" });
    const [leftMessage, rightMessage] = await Promise.all([
      leftResultPromise,
      rightResultPromise,
    ]);
    await expect(Promise.all([leftExit, rightExit])).resolves.toEqual([
      { code: 0, signal: null },
      { code: 0, signal: null },
    ]);
    const results = [leftMessage.result, rightMessage.result].map((value) =>
      ProviderAcceptanceCompareAppendResultV1Schema.parse(value)
    );
    const outcomes = results.map((result) => {
      if (result.resolution !== "resolved") return "rejected";
      const outcome = result.receipt.payload.durableOutcome;
      return outcome.outcome === "committed" ? "committed" : outcome.reason;
    });
    expect(outcomes.sort()).toEqual([
      "committed",
      "expected_current_changed",
    ]);

    const reopened =
      await openProviderAcceptanceAuthorityStoreForTestInternalV1(capability, {
        clock: testAuthorityClockV1,
      });
    const finalCurrent = currentV1(await reopened.readCurrent());
    expect(finalCurrent.enumeration.entries).toHaveLength(2);
    expect(finalCurrent.enumeration.entries[1]?.commitOperationNonce).toSatisfy(
      (nonce: string) =>
        nonce === operationNonceV1(21) || nonce === operationNonceV1(22),
    );
    await expect(
      inspectProviderAcceptanceAuthoritySnapshotForTestInternalV1(capability),
    ).resolves.toMatchObject({
      generationCount: 2,
      receiptCount: 3,
      transactionCount: 3,
    });

    expect(
      await reopened.compareAppend(leftRequest),
    ).toEqual(leftMessage.result);
    expect(
      await reopened.compareAppend(validRightRequest),
    ).toEqual(rightMessage.result);
  });
});

describe("provider Acceptance authority SIGKILL recovery", () => {
  const phases: readonly ProviderAcceptanceAuthorityDurablePhaseInternalV1[] = [
    "snapshot_stage_preparation_opened_before_complete_write",
    "snapshot_stage_file_fsynced",
    "snapshot_canonical_renamed_before_directory_fsync",
    "snapshot_directory_fsynced_before_publication",
    "publication_stage_preparation_opened_before_complete_write",
    "publication_stage_file_fsynced",
    "publication_canonical_renamed_before_directory_fsync",
    "publication_directory_fsynced",
    "snapshot_directory_fsynced_before_response",
  ];

  for (const phase of phases) {
    it(`recovers only the old or complete new snapshot after ${phase}`, async () => {
      const { root, capability, store } = await fixtureV1();
      await store.compareAppend(genesisRequestV1());
      const before =
        await inspectProviderAcceptanceAuthoritySnapshotForTestInternalV1(
          capability,
        );
      const request = successorRequestV1({
        current: currentV1(await store.readCurrent()),
        operationNonce: operationNonceV1(31),
      });
      const child = startWorkerV1({
        mode: "crash",
        root,
        request,
        targetPhase: phase,
      });
      await waitForMessageV1(child, "ready");
      const reachedPhase = waitForMessageV1(child, "phase");
      const exited = waitForExitV1(child);
      child.send({ type: "go" });
      await expect(reachedPhase).resolves.toEqual({ type: "phase", phase });
      child.kill("SIGKILL");
      await expect(exited).resolves.toEqual({ code: null, signal: "SIGKILL" });

      const recovered =
        await openProviderAcceptanceAuthorityStoreForTestInternalV1(
          capability,
          { clock: testAuthorityClockV1 },
        );
      const recoveredState = currentV1(await recovered.readCurrent());
      const after =
        await inspectProviderAcceptanceAuthoritySnapshotForTestInternalV1(
          capability,
        );
      expect([1, 2]).toContain(recoveredState.enumeration.entries.length);
      if (recoveredState.enumeration.entries.length === 1) {
        expect(after).toEqual(before);
        const retried = ProviderAcceptanceCompareAppendResultV1Schema.parse(
          await recovered.compareAppend(request),
        );
        expect(retried.resolution).toBe("resolved");
        if (retried.resolution === "resolved") {
          expect(retried.receipt.payload.durableOutcome.outcome).toBe(
            "committed",
          );
        }
      } else {
        expect(after).toMatchObject({
          generationCount: 2,
          receiptCount: 2,
          transactionCount: 2,
        });
        const responseLostReplay =
          ProviderAcceptanceCompareAppendResultV1Schema.parse(
            await recovered.compareAppend(request),
          );
        expect(responseLostReplay.resolution).toBe("resolved");
        if (responseLostReplay.resolution === "resolved") {
          expect(responseLostReplay.receipt.payload.durableOutcome.outcome)
            .toBe("committed");
        }
        expect(
          await inspectProviderAcceptanceAuthoritySnapshotForTestInternalV1(
            capability,
          ),
        ).toEqual(after);
      }

      if (
        phase === "snapshot_stage_preparation_opened_before_complete_write" ||
        phase === "snapshot_stage_file_fsynced"
      ) {
        expect(recoveredState.enumeration.entries).toHaveLength(1);
      }
      if (
        phase ===
          "publication_stage_preparation_opened_before_complete_write" ||
        phase === "publication_stage_file_fsynced"
      ) {
        expect(recoveredState.enumeration.entries).toHaveLength(1);
      }
      if (
        phase === "publication_directory_fsynced" ||
        phase === "snapshot_directory_fsynced_before_response"
      ) {
        expect(recoveredState.enumeration.entries).toHaveLength(2);
      }
      expect(
        (await readdir(join(root, "runtime-state", "private"))).sort(),
      ).toEqual([
        "installation-identity-v1.init",
        "installation-identity-v1.json",
        "installation-identity-v1.key",
        "provider-acceptance-authority-v1.publication.json",
        "provider-acceptance-authority-v1.snapshot.json",
      ]);
    });
  }
});

describe("provider Acceptance authority post-commit lock release", () => {
  it("recovers the exact retained same-process lock and immediately replays on the same store", async () => {
    const { root, capability, store } = await fixtureV1();
    await store.compareAppend(genesisRequestV1());
    const request = successorRequestV1({
      current: currentV1(await store.readCurrent()),
      operationNonce: operationNonceV1(50),
    });
    const privateDirectory = privateDirectoryV1(root);
    const canonicalSnapshot = join(
      privateDirectory,
      "provider-acceptance-authority-v1.snapshot.json",
    );
    const failingStore =
      await openProviderAcceptanceAuthorityStoreForTestInternalV1(capability, {
        clock: testAuthorityClockV1,
        async afterDurablePhase(phase) {
          if (phase !== "snapshot_directory_fsynced_before_response") return;
          await chmod(privateDirectory, 0o500);
        },
      });

    let releaseError: unknown;
    try {
      await failingStore.compareAppend(request);
    } catch (error) {
      releaseError = error;
    } finally {
      await chmod(privateDirectory, 0o700).catch(() => undefined);
    }
    expect(releaseError).toMatchObject({
      name: "ProviderAcceptanceAuthorityErrorV1",
      code: "io_error",
      message: "provider Acceptance authority operation failed",
    });
    expect(
      releaseError !== null && typeof releaseError === "object" &&
        Object.hasOwn(releaseError, "cause"),
    ).toBe(false);
    expect(
      releaseError !== null && typeof releaseError === "object" &&
        Object.hasOwn(releaseError, "path"),
    ).toBe(false);
    const observableError = `${String(releaseError)} ${JSON.stringify(releaseError)}`;
    for (const forbidden of [
      root,
      request.operationNonce,
      request.candidate.generationId,
      request.candidate.payload.acceptanceToken,
      JSON.stringify(request),
      "EACCES",
      "EPERM",
      "errno",
      "syscall",
    ]) {
      expect(observableError).not.toContain(forbidden);
    }

    const beforeReplaySnapshotBytes = await readFile(canonicalSnapshot);
    const replay = ProviderAcceptanceCompareAppendResultV1Schema.parse(
      await failingStore.compareAppend(request),
    );
    expect(replay.resolution).toBe("resolved");
    if (replay.resolution !== "resolved") throw new Error("expected replay");
    expect(replay.receipt.operationNonce).toBe(request.operationNonce);
    expect(replay.receipt.payload.requestDurableProjection).toEqual(request);
    expect(replay.receipt.payload.durableOutcome.outcome).toBe("committed");
    expect(await readFile(canonicalSnapshot)).toEqual(beforeReplaySnapshotBytes);
    await expect(
      inspectProviderAcceptanceAuthoritySnapshotForTestInternalV1(capability),
    ).resolves.toMatchObject({
      generationCount: 2,
      receiptCount: 2,
      transactionCount: 2,
    });
    expect(await lockProtocolEntriesV1(root)).toEqual([]);
  });

  it("redacts the release failure and replays the exact durable receipt without another write", async () => {
    const { root, capability, store } = await fixtureV1();
    await store.compareAppend(genesisRequestV1());
    const request = successorRequestV1({
      current: currentV1(await store.readCurrent()),
      operationNonce: operationNonceV1(51),
    });
    const privateDirectory = join(root, "runtime-state", "private");
    const canonicalSnapshot = join(
      privateDirectory,
      "provider-acceptance-authority-v1.snapshot.json",
    );
    const child = startWorkerV1({
      mode: "release_error",
      root,
      request,
    });

    try {
      await waitForMessageV1(child, "ready");
      const reachedPhase = waitForMessageV1(child, "phase");
      const releaseError = waitForMessageV1(child, "error");
      const exited = waitForExitV1(child);
      child.send({ type: "go" });

      await expect(reachedPhase).resolves.toEqual({
        type: "phase",
        phase: "snapshot_directory_fsynced_before_response",
      });
      const errorMessage = await releaseError;
      await expect(exited).resolves.toEqual({ code: 1, signal: null });

      expect(errorMessage.error).toMatchObject({
        name: "ProviderAcceptanceAuthorityErrorV1",
        code: "io_error",
        message: "provider Acceptance authority operation failed",
        hasCause: false,
        hasPath: false,
        hasDestination: false,
      });
      expect(errorMessage.error.ownPropertyNames).not.toContain("cause");
      expect(errorMessage.error.ownPropertyNames).not.toContain("path");
      expect(errorMessage.error.ownPropertyNames).not.toContain("dest");
      const observableError = JSON.stringify(errorMessage.error);
      const forbiddenValues = [
        root,
        privateDirectory,
        request.operationNonce,
        request.installationIdentityGenerationId,
        request.candidate.generationId,
        request.candidate.contentDigest,
        request.candidate.payload.acceptanceToken,
        JSON.stringify(request),
        "EACCES",
        "EPERM",
        "errno",
        "syscall",
      ];
      for (const forbidden of forbiddenValues) {
        expect(observableError).not.toContain(forbidden);
      }
    } finally {
      await chmod(privateDirectory, 0o700).catch(() => undefined);
    }

    const beforeReplaySnapshotBytes = await readFile(canonicalSnapshot);
    const recovered =
      await openProviderAcceptanceAuthorityStoreForTestInternalV1(capability, {
        clock: testAuthorityClockV1,
      });
    const replay = ProviderAcceptanceCompareAppendResultV1Schema.parse(
      await recovered.compareAppend(request),
    );
    expect(replay.resolution).toBe("resolved");
    if (replay.resolution !== "resolved") throw new Error("expected replay");
    expect(replay.receipt.operationNonce).toBe(request.operationNonce);
    expect(replay.receipt.payload.requestDurableProjection).toEqual(request);
    expect(replay.receipt.payload.durableOutcome.outcome).toBe("committed");
    const replayBytes = JSON.stringify(replay);

    const restarted =
      await openProviderAcceptanceAuthorityStoreForTestInternalV1(capability, {
        clock: testAuthorityClockV1,
      });
    const replayAfterRestart =
      ProviderAcceptanceCompareAppendResultV1Schema.parse(
        await restarted.compareAppend(request),
      );
    expect(JSON.stringify(replayAfterRestart)).toBe(replayBytes);
    expect(await readFile(canonicalSnapshot)).toEqual(beforeReplaySnapshotBytes);
    await expect(
      inspectProviderAcceptanceAuthoritySnapshotForTestInternalV1(capability),
    ).resolves.toMatchObject({
      generationCount: 2,
      receiptCount: 2,
      transactionCount: 2,
    });
  });
});

describe("provider Acceptance authority lock publication crash recovery", () => {
  const phases = [
    "lock_preparation_file_fsynced",
    "lock_stage_linked_before_preparation_unlink",
    "lock_canonical_linked_before_stage_unlink",
  ] as const;

  for (const phase of phases) {
    it(`converges a dead child at ${phase}`, async () => {
      const { root, capability } = await fixtureV1();
      const request = genesisRequestV1();
      const child = startWorkerV1({
        mode: "lock_crash",
        root,
        request,
        targetPhase: phase,
      });
      const reachedPhase = waitForMessageV1(child, "phase");
      const exited = waitForExitV1(child);
      await expect(reachedPhase).resolves.toEqual({ type: "phase", phase });

      const entries = await lockProtocolEntriesV1(root);
      if (phase === "lock_preparation_file_fsynced") {
        const preparations = entries.filter((name) =>
          name.startsWith(LOCK_PREPARATION_PREFIX_V1)
        );
        expect(preparations).toHaveLength(1);
        expect(entries).toEqual(preparations);
        expect(
          (await lstat(lockPathV1(root, preparations[0]!))).nlink,
        ).toBe(1);
      } else if (phase === "lock_stage_linked_before_preparation_unlink") {
        const preparations = entries.filter((name) =>
          name.startsWith(LOCK_PREPARATION_PREFIX_V1)
        );
        expect(preparations).toHaveLength(1);
        expect(entries).toEqual([
          LOCK_STAGE_NAME_V1,
          preparations[0]!,
        ].sort());
        await expectSameInodeWithLinksV1(
          lockPathV1(root, LOCK_STAGE_NAME_V1),
          lockPathV1(root, preparations[0]!),
          2,
        );
      } else {
        expect(entries).toEqual([
          LOCK_CANONICAL_NAME_V1,
          LOCK_STAGE_NAME_V1,
        ]);
        await expectSameInodeWithLinksV1(
          lockPathV1(root, LOCK_CANONICAL_NAME_V1),
          lockPathV1(root, LOCK_STAGE_NAME_V1),
          2,
        );
      }

      child.kill("SIGKILL");
      await expect(exited).resolves.toEqual({
        code: null,
        signal: "SIGKILL",
      });
      await expectRecoveredGenesisAndNoLockTransientsV1({
        root,
        capability,
        request,
      });
    });
  }
});

describe("provider Acceptance authority stale-lock recovery crash cuts", () => {
  const phases = [
    "recovery_preparation_file_fsynced",
    "recovery_claim_linked_before_preparation_unlink",
    "recovery_quarantine_linked_before_canonical_unlink",
    "recovery_canonical_unlinked_before_quarantine_unlink",
    "recovery_quarantine_unlinked_before_claim_retire",
  ] as const;

  for (const phase of phases) {
    it(`resumes a dead breaker from ${phase}`, async () => {
      const { root, capability } = await fixtureV1();
      const request = genesisRequestV1();
      await leaveCommittedStaleLockV1(root, request);
      expect(await lockProtocolEntriesV1(root)).toEqual([
        LOCK_CANONICAL_NAME_V1,
      ]);

      const breaker = startWorkerV1({
        mode: "lock_crash",
        root,
        request,
        targetPhase: phase,
      });
      const reachedPhase = waitForMessageV1(breaker, "phase");
      const exited = waitForExitV1(breaker);
      await expect(reachedPhase).resolves.toEqual({ type: "phase", phase });

      const entries = await lockProtocolEntriesV1(root);
      if (phase === "recovery_preparation_file_fsynced") {
        const preparations = entries.filter((name) =>
          name.startsWith(LOCK_RECOVERY_PREPARATION_PREFIX_V1)
        );
        expect(preparations).toHaveLength(1);
        expect(entries).toEqual([
          LOCK_CANONICAL_NAME_V1,
          preparations[0]!,
        ].sort());
        expect(
          (await lstat(lockPathV1(root, preparations[0]!))).nlink,
        ).toBe(1);
      } else if (
        phase === "recovery_claim_linked_before_preparation_unlink"
      ) {
        const preparations = entries.filter((name) =>
          name.startsWith(LOCK_RECOVERY_PREPARATION_PREFIX_V1)
        );
        expect(preparations).toHaveLength(1);
        expect(entries).toEqual([
          LOCK_CANONICAL_NAME_V1,
          LOCK_RECOVERY_NAME_V1,
          preparations[0]!,
        ].sort());
        await expectSameInodeWithLinksV1(
          lockPathV1(root, LOCK_RECOVERY_NAME_V1),
          lockPathV1(root, preparations[0]!),
          2,
        );
      } else if (
        phase === "recovery_quarantine_linked_before_canonical_unlink"
      ) {
        expect(entries).toEqual([
          LOCK_CANONICAL_NAME_V1,
          LOCK_RECOVERY_NAME_V1,
          LOCK_QUARANTINE_NAME_V1,
        ]);
        await expectSameInodeWithLinksV1(
          lockPathV1(root, LOCK_CANONICAL_NAME_V1),
          lockPathV1(root, LOCK_QUARANTINE_NAME_V1),
          2,
        );
      } else if (
        phase === "recovery_canonical_unlinked_before_quarantine_unlink"
      ) {
        expect(entries).toEqual([
          LOCK_RECOVERY_NAME_V1,
          LOCK_QUARANTINE_NAME_V1,
        ]);
        expect(
          (await lstat(lockPathV1(root, LOCK_QUARANTINE_NAME_V1))).nlink,
        ).toBe(1);
      } else {
        expect(entries).toEqual([LOCK_RECOVERY_NAME_V1]);
      }

      breaker.kill("SIGKILL");
      await expect(exited).resolves.toEqual({
        code: null,
        signal: "SIGKILL",
      });
      await expectRecoveredGenesisAndNoLockTransientsV1({
        root,
        capability,
        request,
      });
    });
  }

  it("retires an old claim without deleting a late authenticated canonical lock", async () => {
    const { root, capability } = await fixtureV1();
    const request = genesisRequestV1();
    await leaveCommittedStaleLockV1(root, request);
    await killAtLockPhaseV1({
      root,
      request,
      phase: "recovery_canonical_unlinked_before_quarantine_unlink",
    });
    expect(await lockProtocolEntriesV1(root)).toEqual([
      LOCK_RECOVERY_NAME_V1,
      LOCK_QUARANTINE_NAME_V1,
    ]);

    const auxiliary = await fixtureV1();
    const liveHolder = startWorkerV1({
      mode: "crash",
      root: auxiliary.root,
      request,
      targetPhase: "snapshot_directory_fsynced_before_response",
    });
    const holderReady = waitForMessageV1(liveHolder, "ready");
    await holderReady;
    const holderPhase = waitForMessageV1(liveHolder, "phase");
    const holderExit = waitForExitV1(liveHolder);
    liveHolder.send({ type: "go" });
    await expect(holderPhase).resolves.toEqual({
      type: "phase",
      phase: "snapshot_directory_fsynced_before_response",
    });
    const liveLockBytes = await readFile(
      lockPathV1(auxiliary.root, LOCK_CANONICAL_NAME_V1),
    );
    const targetCanonical = lockPathV1(root, LOCK_CANONICAL_NAME_V1);
    await writeFile(targetCanonical, liveLockBytes, {
      flag: "wx",
      mode: 0o600,
    });
    const lateCanonical = await lstat(targetCanonical);

    const observer = startWorkerV1({
      mode: "lock_crash",
      root,
      request,
      targetPhase: "recovery_quarantine_unlinked_before_claim_retire",
    });
    const observerPhase = waitForMessageV1(observer, "phase");
    const observerExit = waitForExitV1(observer);
    await expect(observerPhase).resolves.toEqual({
      type: "phase",
      phase: "recovery_quarantine_unlinked_before_claim_retire",
    });
    expect(await readFile(targetCanonical)).toEqual(liveLockBytes);
    const preservedCanonical = await lstat(targetCanonical);
    expect({ dev: preservedCanonical.dev, ino: preservedCanonical.ino }).toEqual({
      dev: lateCanonical.dev,
      ino: lateCanonical.ino,
    });
    expect(await lockProtocolEntriesV1(root)).toEqual([
      LOCK_CANONICAL_NAME_V1,
      LOCK_RECOVERY_NAME_V1,
    ]);

    observer.kill("SIGKILL");
    await expect(observerExit).resolves.toEqual({
      code: null,
      signal: "SIGKILL",
    });
    liveHolder.kill("SIGKILL");
    await expect(holderExit).resolves.toEqual({
      code: null,
      signal: "SIGKILL",
    });
    await expectRecoveredGenesisAndNoLockTransientsV1({
      root,
      capability,
      request,
    });
  });
});
