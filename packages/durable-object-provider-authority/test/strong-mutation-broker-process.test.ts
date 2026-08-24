import { fork, type ChildProcess } from "node:child_process";
import {
  access,
  link,
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
} from "@understand-code/durable-object-provider-contracts/provider-acceptance";
import { afterEach, describe, expect, it } from "vitest";

import {
  createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  inspectProviderAcceptanceAuthorityCandidateForTestInternalV1,
  inspectProviderStrongMutationBrokerSnapshotForTestInternalV1 as inspectProviderStrongMutationBrokerSnapshotWithVerifierV1,
  openProviderAcceptanceAuthorityStoreForTestInternalV1,
  openProviderStrongMutationBrokerStoreForTestInternalV1 as openProviderStrongMutationBrokerStoreWithVerifierV1,
  provisionProviderAcceptanceAuthorityForTestInternalV1,
  type ProviderAcceptanceAuthorityStoreOpenOptionsInternalV1,
} from "../src/test-seam-internal.js";
import {
  TEST_INSTALLATION_IDENTITY_KEY,
  genesisRequestV1,
  operationNonceV1,
  successorRequestV1,
  testAuthorityClockV1,
} from "./acceptance-store-fixtures.js";
import {
  brokerResolveRequestV1,
  TEST_BROKER_INSTALLATION_IDENTITY_GENERATION_ID,
  currentAcceptanceIdentityV1,
  strongMutationRequestV1,
  strongMutationResponseV1,
  strongMutationTrustedConfigurationV1,
  strongMutationTrustedGenerationFloorsV1,
  strongMutationTrustEvidenceV1,
  strongMutationTrustVerifierV1,
} from "./strong-mutation-broker-fixtures.js";

type DurablePhaseV1 = Parameters<
  NonNullable<
    ProviderAcceptanceAuthorityStoreOpenOptionsInternalV1["afterDurablePhase"]
  >
>[0];

type WorkerMessageV1 =
  | { readonly type: "ready" }
  | { readonly type: "phase"; readonly phase: DurablePhaseV1 }
  | { readonly type: "result"; readonly result: unknown }
  | {
      readonly type: "error";
      readonly error: Readonly<{ readonly code?: string; readonly message?: string }>;
    };

const workerPath = fileURLToPath(
  new URL("./strong-mutation-broker-worker.mjs", import.meta.url),
);
const fixtureRoots = new Set<string>();
const childProcesses = new Set<ChildProcess>();
const brokerVerifierByLayoutV1 = new WeakMap<object, Awaited<
  ReturnType<typeof strongMutationTrustVerifierV1>
>>();
const workerEvidenceByAuthorityRootV1 = new Map<string, string>();

function verifierForLayoutV1(capability: object) {
  const verifier = brokerVerifierByLayoutV1.get(capability);
  if (verifier === undefined) throw new Error("broker verifier absent");
  return verifier;
}

function openProviderStrongMutationBrokerStoreForTestInternalV1(
  capability: Parameters<
    typeof openProviderStrongMutationBrokerStoreWithVerifierV1
  >[0],
  options: Parameters<
    typeof openProviderStrongMutationBrokerStoreWithVerifierV1
  >[2] = {},
) {
  return openProviderStrongMutationBrokerStoreWithVerifierV1(
    capability,
    verifierForLayoutV1(capability),
    options,
  );
}

function inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(
  capability: Parameters<
    typeof inspectProviderStrongMutationBrokerSnapshotWithVerifierV1
  >[0],
) {
  return inspectProviderStrongMutationBrokerSnapshotWithVerifierV1(
    capability,
    verifierForLayoutV1(capability),
  );
}

const BROKER_PHASES = [
  "broker_publication_stage_preparation_opened_before_complete_write",
  "broker_publication_stage_file_fsynced",
  "broker_snapshot_stage_preparation_opened_before_complete_write",
  "broker_snapshot_stage_file_fsynced",
  "broker_snapshot_canonical_renamed_before_directory_fsync",
  "broker_snapshot_directory_fsynced_before_publication",
  "broker_publication_canonical_renamed_before_directory_fsync",
  "broker_publication_directory_fsynced",
  "broker_snapshot_directory_fsynced_before_response",
] as const satisfies readonly DurablePhaseV1[];

const OLD_STATE_PHASES = new Set<DurablePhaseV1>([
  "broker_publication_stage_preparation_opened_before_complete_write",
  "broker_publication_stage_file_fsynced",
  "broker_snapshot_stage_preparation_opened_before_complete_write",
  "broker_snapshot_stage_file_fsynced",
]);

const PRIVATE_DIRECTORY = "runtime-state/private";
const SNAPSHOT_CANONICAL =
  "provider-strong-mutation-broker-v1.snapshot.json";
const SNAPSHOT_STAGE = ".provider-strong-mutation-broker-v1.snapshot.stage";
const PUBLICATION_CANONICAL =
  "provider-strong-mutation-broker-v1.publication.json";
const PUBLICATION_STAGE =
  ".provider-strong-mutation-broker-v1.publication.stage";

afterEach(async () => {
  for (const child of childProcesses) child.kill("SIGKILL");
  childProcesses.clear();
  await Promise.all(
    [...fixtureRoots].map((root) => rm(root, { recursive: true, force: true })),
  );
  fixtureRoots.clear();
  workerEvidenceByAuthorityRootV1.clear();
});

async function fixtureV1() {
  const parent = await mkdtemp(join(tmpdir(), "broker-process-"));
  const root = join(parent, "authority");
  fixtureRoots.add(parent);
  const capability =
    createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1(root);
  brokerVerifierByLayoutV1.set(
    capability,
    await strongMutationTrustVerifierV1(),
  );
  await provisionProviderAcceptanceAuthorityForTestInternalV1(capability, {
    installationIdentityGenerationId:
      TEST_BROKER_INSTALLATION_IDENTITY_GENERATION_ID,
    installationIdentityKey: TEST_INSTALLATION_IDENTITY_KEY,
  });
  const acceptance =
    await openProviderAcceptanceAuthorityStoreForTestInternalV1(capability, {
      clock: testAuthorityClockV1,
    });
  await acceptance.compareAppend(genesisRequestV1({
    installationIdentityGenerationId:
      TEST_BROKER_INSTALLATION_IDENTITY_GENERATION_ID,
    configuration: strongMutationTrustedConfigurationV1(),
  }));
  const read = await acceptance.readCurrent();
  if (read.state !== "current") throw new Error("expected current");
  const current = ProviderAcceptanceCurrentReadV1Schema.parse(read.current);
  const evidenceRoot = await mkdtemp(join(tmpdir(), "broker-evidence-"));
  fixtureRoots.add(evidenceRoot);
  const evidencePath = join(evidenceRoot, "trust-evidence.json");
  await writeFile(
    evidencePath,
    JSON.stringify(
      strongMutationTrustEvidenceV1(currentAcceptanceIdentityV1(current)),
    ),
    { mode: 0o600 },
  );
  workerEvidenceByAuthorityRootV1.set(root, evidencePath);
  const broker =
    await openProviderStrongMutationBrokerStoreForTestInternalV1(capability, {
      clock: testAuthorityClockV1,
    });
  return { root, capability, current, broker };
}

function startWorkerV1(input: Readonly<{
  action: "begin" | "resolve" | "acceptance_append";
  root: string;
  request: unknown;
  phase?: DurablePhaseV1;
  phaseSequence?: readonly DurablePhaseV1[];
}>): ChildProcess {
  const evidencePath = workerEvidenceByAuthorityRootV1.get(input.root);
  if (evidencePath === undefined) throw new Error("worker evidence absent");
  const child = fork(workerPath, [], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      AUTHORITY_BROKER_WORKER_ACTION: input.action,
      AUTHORITY_BROKER_WORKER_ROOT: input.root,
      AUTHORITY_BROKER_WORKER_EVIDENCE_PATH: evidencePath,
      AUTHORITY_BROKER_WORKER_INPUT_BASE64: Buffer.from(
        JSON.stringify(input.request),
        "utf8",
      ).toString("base64"),
      ...(input.phase === undefined
        ? {}
        : { AUTHORITY_BROKER_WORKER_TARGET_PHASE: input.phase }),
      ...(input.phaseSequence === undefined
        ? {}
        : {
            AUTHORITY_BROKER_WORKER_PHASE_SEQUENCE_BASE64: Buffer.from(
              JSON.stringify(input.phaseSequence),
              "utf8",
            ).toString("base64"),
            AUTHORITY_BROKER_WORKER_ARM_PHASES_AFTER_GO: "1",
          }),
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
      rejectPromise(new Error(`broker worker timeout ${type}: ${stderr}`));
    }, 30_000);
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
      } else if (
        message !== null &&
        typeof message === "object" &&
        "type" in message &&
        message.type === "error"
      ) {
        cleanupV1();
        rejectPromise(new Error(JSON.stringify(message)));
      }
    };
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      cleanupV1();
      rejectPromise(
        new Error(
          `broker worker exited before ${type}: code=${String(code)} signal=${String(signal)} ${stderr}`,
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

function waitForExitV1(child: ChildProcess) {
  return new Promise<Readonly<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>>((resolvePromise) => {
    child.once("exit", (code, signal) => {
      childProcesses.delete(child);
      resolvePromise({ code, signal });
    });
  });
}

async function continueToPhaseV1(
  child: ChildProcess,
  phase: DurablePhaseV1,
): Promise<void> {
  const reached = waitForMessageV1(child, "phase");
  child.send({ type: "continue" });
  await expect(reached).resolves.toEqual({ type: "phase", phase });
}

function waitForOutcomeV1(
  child: ChildProcess,
): Promise<Extract<WorkerMessageV1, { readonly type: "result" | "error" }>> {
  return new Promise((resolvePromise, rejectPromise) => {
    const timeout = setTimeout(() => {
      cleanupV1();
      rejectPromise(new Error("broker worker timed out waiting for outcome"));
    }, 30_000);
    const onMessage = (message: unknown) => {
      if (
        message !== null &&
        typeof message === "object" &&
        "type" in message &&
        (message.type === "result" || message.type === "error")
      ) {
        cleanupV1();
        resolvePromise(
          message as Extract<
            WorkerMessageV1,
            { readonly type: "result" | "error" }
          >,
        );
      }
    };
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      cleanupV1();
      rejectPromise(
        new Error(
          `broker worker exited before outcome: code=${String(code)} signal=${String(signal)}`,
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

function expectCommittedAcceptanceOutcomeV1(
  message: Extract<WorkerMessageV1, { readonly type: "result" | "error" }>,
): void {
  expect(message.type).toBe("result");
  if (message.type !== "result") {
    throw new Error("Acceptance append unexpectedly failed");
  }
  const result = ProviderAcceptanceCompareAppendResultV1Schema.parse(
    message.result,
  );
  expect(result.resolution).toBe("resolved");
  if (result.resolution !== "resolved") {
    throw new Error("expected resolved Acceptance append");
  }
  expect(result.receipt.payload.durableOutcome.outcome).toBe("committed");
}

async function killAtPhaseV1(input: Readonly<{
  action: "begin" | "resolve";
  root: string;
  request: unknown;
  phase: DurablePhaseV1;
}>): Promise<void> {
  const child = startWorkerV1(input);
  await waitForMessageV1(child, "ready");
  const reached = waitForMessageV1(child, "phase");
  const exited = waitForExitV1(child);
  child.send({ type: "go" });
  await expect(reached).resolves.toEqual({ type: "phase", phase: input.phase });
  child.kill("SIGKILL");
  await expect(exited).resolves.toEqual({ code: null, signal: "SIGKILL" });
}

async function killDuringOpenAtPhaseV1(input: Readonly<{
  action: "begin" | "resolve";
  root: string;
  request: unknown;
  phase: DurablePhaseV1;
}>): Promise<void> {
  const child = startWorkerV1(input);
  const reached = waitForMessageV1(child, "phase");
  const exited = waitForExitV1(child);
  await expect(reached).resolves.toEqual({ type: "phase", phase: input.phase });
  child.kill("SIGKILL");
  await expect(exited).resolves.toEqual({ code: null, signal: "SIGKILL" });
}

async function expectNoBrokerTransientsV1(root: string): Promise<void> {
  const entries = await readdir(join(root, PRIVATE_DIRECTORY));
  expect(entries.filter((name) =>
    name.startsWith(".provider-strong-mutation-broker-v1")
  )).toEqual([]);
}

async function isolateAndExpectIdentityResidueFailureV1(input: Readonly<{
  root: string;
  capability: Parameters<
    typeof openProviderAcceptanceAuthorityStoreForTestInternalV1
  >[0];
  residuePattern: RegExp;
}>): Promise<void> {
  const privateRoot = join(input.root, PRIVATE_DIRECTORY);
  const before = await readdir(privateRoot);
  const residues = before.filter((name) => input.residuePattern.test(name));
  expect(residues).toHaveLength(1);
  await Promise.all([
    "installation-identity-v1.key",
    "installation-identity-v1.json",
    "installation-identity-v1.init",
    "provider-acceptance-authority-v1.snapshot.json",
    "provider-acceptance-authority-v1.publication.json",
    SNAPSHOT_CANONICAL,
    PUBLICATION_CANONICAL,
    ".provider-acceptance-authority-v1.lock",
    ".provider-acceptance-authority-v1.lock.stage",
    ".provider-acceptance-authority-v1.lock.recovery",
    ".provider-acceptance-authority-v1.lock.stale",
  ].map((name) => rm(join(privateRoot, name), { force: true })));
  await rm(join(privateRoot, "safe-git-empty-hooks-v1"), {
    recursive: true,
    force: true,
  });
  expect((await readdir(privateRoot)).sort()).toEqual(residues.sort());

  await expect(
    openProviderAcceptanceAuthorityStoreForTestInternalV1(input.capability, {
      clock: testAuthorityClockV1,
    }),
  ).rejects.toMatchObject({
    name: "ProviderAcceptanceAuthorityErrorV1",
    code: "identity_key_invalid",
  });
  await expect(
    openProviderStrongMutationBrokerStoreForTestInternalV1(input.capability, {
      clock: testAuthorityClockV1,
    }),
  ).rejects.toMatchObject({
    name: "ProviderAcceptanceAuthorityErrorV1",
    code: "identity_key_invalid",
  });
  await expect(
    inspectProviderAcceptanceAuthorityCandidateForTestInternalV1(
      input.capability,
    ),
  ).resolves.toEqual({
    status: "integrity_failed",
    authority: "installation_owner_candidate",
    strongWrites: "locked",
    namespace: "unavailable",
  });
  expect((await readdir(privateRoot)).sort()).toEqual(residues.sort());
}

describe("strong-mutation broker SIGKILL recovery", () => {
  for (const phase of BROKER_PHASES) {
    it(`recovers only absent or one complete pending intent after begin ${phase}`, async () => {
      const { root, capability, current } = await fixtureV1();
      const request = strongMutationRequestV1(current);
      await killAtPhaseV1({ action: "begin", root, request, phase });
      const recovered =
        await openProviderStrongMutationBrokerStoreForTestInternalV1(
          capability,
          { clock: testAuthorityClockV1 },
        );
      const after =
        await inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(
          capability,
        );
      const expectedOld = OLD_STATE_PHASES.has(phase);
      expect(after).toMatchObject(expectedOld
        ? {
            snapshotRevision: 0,
            intentCount: 0,
            pendingCount: 0,
            resolvedCount: 0,
          }
        : {
            snapshotRevision: 1,
            intentCount: 1,
            pendingCount: 1,
            resolvedCount: 0,
          });
      const retried = await recovered.begin(request);
      expect(retried).toMatchObject({
        resolution: "recorded",
        disposition: expectedOld ? "created" : "replayed",
        intent: { state: "pending" },
      });
      await expectNoBrokerTransientsV1(root);
    });

    it(`recovers only pending or one complete resolved intent after resolve ${phase}`, async () => {
      const { root, capability, current, broker } = await fixtureV1();
      const request = strongMutationRequestV1(current);
      const begun = await broker.begin(request);
      if (begun.resolution !== "recorded") throw new Error("expected begin");
      const resolveRequest = brokerResolveRequestV1(
        begun.intent,
        strongMutationResponseV1(request),
      );
      await killAtPhaseV1({
        action: "resolve",
        root,
        request: resolveRequest,
        phase,
      });
      const recovered =
        await openProviderStrongMutationBrokerStoreForTestInternalV1(
          capability,
          { clock: testAuthorityClockV1 },
        );
      const after =
        await inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(
          capability,
        );
      const expectedOld = OLD_STATE_PHASES.has(phase);
      expect(after).toMatchObject(expectedOld
        ? {
            snapshotRevision: 1,
            intentCount: 1,
            pendingCount: 1,
            resolvedCount: 0,
          }
        : {
            snapshotRevision: 2,
            intentCount: 1,
            pendingCount: 0,
            resolvedCount: 1,
          });
      const retried = await recovered.resolve(resolveRequest);
      expect(retried).toMatchObject({
        resolution: "resolved",
        disposition: expectedOld ? "created" : "replayed",
        intent: { state: "resolved" },
      });
      await expectNoBrokerTransientsV1(root);
    });
  }
});

describe("strong-mutation broker cross-process Acceptance serialization", () => {
  it("serializes when the winner unlinks stage after the loser observes canonical at nlink=2", async () => {
    const { root, capability, current } = await fixtureV1();
    const beginRequest = strongMutationRequestV1(current, {
      nonceDigit: "c",
      requestId: "c".repeat(32),
    });
    const acceptanceRequest = successorRequestV1({
      current,
      operationNonce: operationNonceV1(2),
      floors: strongMutationTrustedGenerationFloorsV1(),
    });
    const acceptanceChild = startWorkerV1({
      action: "acceptance_append",
      root,
      request: acceptanceRequest,
      phaseSequence: [
        "lock_preparation_file_fsynced",
        "lock_canonical_linked_before_stage_unlink",
        "publication_stage_preparation_opened_before_complete_write",
      ],
    });
    await waitForMessageV1(acceptanceChild, "ready");
    const beginChild = startWorkerV1({
      action: "begin",
      root,
      request: beginRequest,
      phaseSequence: [
        "lock_preparation_file_fsynced",
        "lock_canonical_nlink2_observed_before_stage_observe",
        "lock_preparation_file_fsynced",
      ],
    });
    await waitForMessageV1(beginChild, "ready");
    const beginOutcome = waitForOutcomeV1(beginChild);
    const acceptanceOutcome = waitForOutcomeV1(acceptanceChild);
    const beginExit = waitForExitV1(beginChild);
    const acceptanceExit = waitForExitV1(acceptanceChild);
    const acceptancePrepared = waitForMessageV1(acceptanceChild, "phase");
    const beginPrepared = waitForMessageV1(beginChild, "phase");
    beginChild.send({ type: "go" });
    acceptanceChild.send({ type: "go" });
    await expect(Promise.all([acceptancePrepared, beginPrepared])).resolves
      .toEqual([
        { type: "phase", phase: "lock_preparation_file_fsynced" },
        { type: "phase", phase: "lock_preparation_file_fsynced" },
      ]);
    await continueToPhaseV1(
      acceptanceChild,
      "lock_canonical_linked_before_stage_unlink",
    );
    await continueToPhaseV1(
      beginChild,
      "lock_canonical_nlink2_observed_before_stage_observe",
    );
    await continueToPhaseV1(
      acceptanceChild,
      "publication_stage_preparation_opened_before_complete_write",
    );

    // Keep the winner's canonical nlink=1 lock held while the loser leaves
    // its nlink=2 observation. Repeated unrelated directory events make the
    // bounded watcher retry observable without a timing delay: the fixed path
    // reaches a second preparation hook, while the original regression exits
    // immediately with authority_busy.
    const retryPrepared = waitForMessageV1(beginChild, "phase");
    const wakePath = join(
      root,
      "runtime-state/private/.strong-mutation-lock-test-wakeup",
    );
    let stopWakeups = false;
    const wakeups = (async () => {
      let sequence = 0;
      while (!stopWakeups) {
        await writeFile(wakePath, String(sequence), { mode: 0o600 });
        sequence += 1;
        await new Promise<void>((resolvePromise) => setImmediate(resolvePromise));
      }
      await rm(wakePath, { force: true });
    })();
    beginChild.send({ type: "continue" });
    try {
      await expect(retryPrepared).resolves.toEqual({
        type: "phase",
        phase: "lock_preparation_file_fsynced",
      });
    } finally {
      stopWakeups = true;
      await wakeups;
    }

    acceptanceChild.send({ type: "continue" });
    await expect(acceptanceExit).resolves.toEqual({ code: 0, signal: null });
    beginChild.send({ type: "continue" });

    const [beginMessage, acceptanceMessage] = await Promise.all([
      beginOutcome,
      acceptanceOutcome,
    ]);
    expectCommittedAcceptanceOutcomeV1(acceptanceMessage);

    expect(beginMessage).toMatchObject({
      type: "error",
      error: { code: "invalid_request" },
    });
    await expect(acceptanceExit).resolves.toEqual({ code: 0, signal: null });
    await expect(beginExit).resolves.toEqual({ code: 1, signal: null });

    const reopenedAcceptance =
      await openProviderAcceptanceAuthorityStoreForTestInternalV1(capability, {
        clock: testAuthorityClockV1,
      });
    const finalRead = await reopenedAcceptance.readCurrent();
    expect(finalRead.state).toBe("current");
    if (finalRead.state !== "current") throw new Error("expected current");
    expect(finalRead.current.enumeration.entries).toHaveLength(2);

    const reopenedBroker =
      await openProviderStrongMutationBrokerStoreForTestInternalV1(
        capability,
        { clock: testAuthorityClockV1 },
      );
    await expect(
      inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(capability),
    ).resolves.toMatchObject({
      snapshotRevision: 0,
      intentCount: 0,
      pendingCount: 0,
      resolvedCount: 0,
    });
    await expect(reopenedBroker.begin(beginRequest)).rejects.toMatchObject({
      code: "invalid_request",
    });
    await expectNoBrokerTransientsV1(root);
  });
});

describe("strong-mutation broker real lock-residue identity classification", () => {
  it("classifies a real acquisition preparation SIGKILL residue as integrity failure", async () => {
    const { root, capability, current } = await fixtureV1();
    const request = strongMutationRequestV1(current);
    await killDuringOpenAtPhaseV1({
      action: "begin",
      root,
      request,
      phase: "lock_preparation_file_fsynced",
    });
    await isolateAndExpectIdentityResidueFailureV1({
      root,
      capability,
      residuePattern:
        /^\.provider-acceptance-authority-v1\.lock\.prepare-[1-9][0-9]*-[0-9a-f]{32}$/u,
    });
  });

  it("classifies a real stale-lock recovery preparation SIGKILL residue as integrity failure", async () => {
    const { root, capability, current } = await fixtureV1();
    const request = strongMutationRequestV1(current);
    await killAtPhaseV1({
      action: "begin",
      root,
      request,
      phase: "broker_snapshot_directory_fsynced_before_response",
    });
    await killDuringOpenAtPhaseV1({
      action: "begin",
      root,
      request,
      phase: "recovery_preparation_file_fsynced",
    });
    await isolateAndExpectIdentityResidueFailureV1({
      root,
      capability,
      residuePattern:
        /^\.provider-acceptance-authority-v1\.lock\.recovery\.prepare-[1-9][0-9]*-[0-9a-f]{32}$/u,
    });
  });
});

describe("strong-mutation broker deterministic-stage convergence", () => {
  it("converges a publication stage left at nlink=2 before the old-state early return", async () => {
    const { root, capability, current } = await fixtureV1();
    const request = strongMutationRequestV1(current);
    await killAtPhaseV1({
      action: "begin",
      root,
      request,
      phase: "broker_snapshot_stage_preparation_opened_before_complete_write",
    });
    const privateRoot = join(root, PRIVATE_DIRECTORY);
    const stage = join(privateRoot, PUBLICATION_STAGE);
    const preparation = `${stage}.prepare`;
    await link(stage, preparation);
    const [stageStat, preparationStat] = await Promise.all([
      lstat(stage),
      lstat(preparation),
    ]);
    expect({ dev: stageStat.dev, ino: stageStat.ino, nlink: stageStat.nlink })
      .toEqual({
        dev: preparationStat.dev,
        ino: preparationStat.ino,
        nlink: 2,
      });
    expect(preparationStat.nlink).toBe(2);

    const recovered =
      await openProviderStrongMutationBrokerStoreForTestInternalV1(
        capability,
        { clock: testAuthorityClockV1 },
      );
    await expect(
      inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(capability),
    ).resolves.toMatchObject({ snapshotRevision: 0, intentCount: 0 });
    await expect(access(stage)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(preparation)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(recovered.begin(request)).resolves.toMatchObject({
      resolution: "recorded",
      disposition: "created",
    });
    await expectNoBrokerTransientsV1(root);
  });

  it("cleans a large snapshot deterministic stage left at nlink=2", async () => {
    const { root, capability, current, broker } = await fixtureV1();
    const request = strongMutationRequestV1(current, {
      body: "large broker snapshot".repeat(4_096),
    });
    await broker.begin(request);
    const privateRoot = join(root, PRIVATE_DIRECTORY);
    const canonical = join(privateRoot, SNAPSHOT_CANONICAL);
    const stage = join(privateRoot, SNAPSHOT_STAGE);
    const preparation = `${stage}.prepare`;
    const bytes = await readFile(canonical);
    expect(bytes.byteLength).toBeGreaterThan(16 * 1024);
    await writeFile(preparation, bytes, { flag: "wx", mode: 0o600 });
    await link(preparation, stage);
    const [stageStat, preparationStat] = await Promise.all([
      lstat(stage),
      lstat(preparation),
    ]);
    expect(stageStat.nlink).toBe(2);
    expect({ dev: stageStat.dev, ino: stageStat.ino }).toEqual({
      dev: preparationStat.dev,
      ino: preparationStat.ino,
    });

    await openProviderStrongMutationBrokerStoreForTestInternalV1(capability, {
      clock: testAuthorityClockV1,
    });
    await expect(
      inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(capability),
    ).resolves.toMatchObject({ snapshotRevision: 1, intentCount: 1 });
    await expect(access(stage)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(preparation)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(join(privateRoot, PUBLICATION_CANONICAL))).resolves
      .toBeUndefined();
    await expectNoBrokerTransientsV1(root);
  });
});
