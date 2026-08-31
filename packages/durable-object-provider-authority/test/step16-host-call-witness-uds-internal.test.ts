import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  chmodSync,
  lstatSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createConnection, type Socket } from "node:net";

import type {
  ProviderProductionStrongAuthorityStep16ProviderReceiptBindingInternalV1,
  ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1,
} from "../src/provider-production-strong-authority-service.js";
import {
  deriveStep16HostCallWitnessClosingPlanDigestInternalV1,
  openStep16HostCallWitnessCapabilityInternalV1,
  type Step16HostCallWitnessAuthorityCallbacksInternalV1,
  type Step16HostCallWitnessClosingPlanInternalV1,
} from "../src/step16-host-call-witness-server-internal.js";
import {
  STEP16_HOST_CALL_WITNESS_UDS_LIMITS_INTERNAL_V1,
  STEP16_HOST_CALL_WITNESS_UDS_PROFILE_INTERNAL_V1,
  startStep16HostCallWitnessUdsServerCoreInternalV1,
  startStep16HostCallWitnessUdsServerInternalV1,
  type Step16HostCallWitnessUdsServerInternalV1,
} from "../src/step16-host-call-witness-uds-internal.js";

const PROFILE = STEP16_HOST_CALL_WITNESS_UDS_PROFILE_INTERNAL_V1;
const SUPERVISOR_PID = 777;
const RUN_NONCE = "a".repeat(64);
const SESSION_DIGEST = digest("1");
const CALL_DIGEST = digest("2");
const ARGUMENTS_DIGEST = digest("3");
const OPERATION_NONCE = "b".repeat(32);
const REQUEST_DIGEST = digest("4");
const RECEIPT_DIGEST = digest("5");
const PRIVATE_SENTINEL = "raw-private-receipt-bundle-and-signature";

const openServers: Step16HostCallWitnessUdsServerInternalV1[] = [];
const temporaryDirectories: string[] = [];

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}

function plan(): Step16HostCallWitnessClosingPlanInternalV1 {
  const calls = Object.freeze([
    Object.freeze({
      callOrdinal: 1,
      eventOrdinal: 3,
      host: "codex" as const,
      tool: "update_task",
      argumentsDigest: ARGUMENTS_DIGEST,
    }),
  ]);
  return Object.freeze({
    closingPlanDigest: deriveStep16HostCallWitnessClosingPlanDigestInternalV1({
      runNonce: RUN_NONCE,
      calls,
    }),
    runNonce: RUN_NONCE,
    calls,
  });
}

function binding(
  input: Readonly<{
    readonly host: "codex" | "claude";
    readonly sessionIdDigest: string;
    readonly callIdDigest: string;
    readonly operation: "write_object" | "compare_commit";
    readonly operationNonce: string;
    readonly requestDigest: string;
  }>,
): ProviderProductionStrongAuthorityStep16ProviderReceiptBindingInternalV1 {
  const value: ProviderProductionStrongAuthorityStep16ProviderReceiptBindingInternalV1 = {
    schemaVersion: 1,
    profile: "step16_provider_receipt_binding_v1",
    host: input.host,
    sessionIdDigest: input.sessionIdDigest,
    callIdDigest: input.callIdDigest,
    providerIdentityDigest: digest("6"),
    receiptLedger: {
      authority: "root_owned_private_provider_receipt_ledger",
      locatorPolicy: "fixed_locator_component_nofollow",
      receiptBundleDigest: RECEIPT_DIGEST,
    },
    providerOperation: {
      operation: input.operation,
      operationNonce: input.operationNonce,
      requestDigest: input.requestDigest,
      sessionBindingDigest: digest("7"),
      principalAttestationDigest: digest("8"),
      authorityGrantContentDigest: digest("9"),
      responseResolution: "committed",
    },
    componentDigests: {
      strongMutationRequest: digest("a"),
      strongMutationResponse: digest("b"),
      principalAttestation: digest("c"),
      authorityGrantEnvelope: digest("d"),
      authorityGrantSignature: digest("e"),
      responseSignature: digest("f"),
      principalAttestationSignature: digest("0"),
    },
    privateBundleVerification: {
      status: "verified",
      verifierProfile: "provider_runtime_ipc_full_private_bundle_verifier_v1",
      verifiedBindings: [
        "request_digest",
        "session_binding",
        "authority_grant_signature",
        "response_signature",
        "principal_attestation_signature",
      ],
    },
  };
  Object.defineProperty(value, "rawPrivateBundle", {
    value: PRIVATE_SENTINEL,
    enumerable: false,
  });
  return value;
}

function authority() {
  const authorityWindow = Object.freeze(Object.create(null)) as
    ProviderProductionStrongAuthorityStep16ReceiptBindingWindowCapabilityInternalV1;
  const beginCollecting = vi.fn<
    Step16HostCallWitnessAuthorityCallbacksInternalV1["beginCollecting"]
  >(async () => authorityWindow);
  const appendExpectedOperation = vi.fn<
    Step16HostCallWitnessAuthorityCallbacksInternalV1["appendExpectedOperation"]
  >(async () => undefined);
  const complete = vi.fn<
    Step16HostCallWitnessAuthorityCallbacksInternalV1["complete"]
  >(async (_window, witness) => {
    const opened = openStep16HostCallWitnessCapabilityInternalV1(witness);
    if (opened === undefined) {
      throw new Error("missing test witness");
    }
    return Object.freeze(
      opened.expectedProviderOperations.map((operation) =>
        binding({
          host: opened.host,
          sessionIdDigest: opened.sessionIdDigest,
          callIdDigest: opened.callIdDigest,
          operation: operation.operation,
          operationNonce: operation.operationNonce,
          requestDigest: operation.requestDigest,
        }),
      ),
    );
  });
  const abort = vi.fn<
    Step16HostCallWitnessAuthorityCallbacksInternalV1["abort"]
  >(async () => undefined);
  return {
    callbacks: { beginCollecting, appendExpectedOperation, complete, abort },
    beginCollecting,
    appendExpectedOperation,
    complete,
    abort,
  };
}

interface TestFixture {
  readonly server: Step16HostCallWitnessUdsServerInternalV1;
  readonly socketPath: string;
  readonly closingPlan: Step16HostCallWitnessClosingPlanInternalV1;
  readonly authority: ReturnType<typeof authority>;
}

async function fixture(input: Readonly<{
  readonly timeoutMs?: number;
  readonly finalizeRun?: NonNullable<Step16HostCallWitnessAuthorityCallbacksInternalV1["finalizeRun"]>;
  readonly readPeerCredentials?: (
    socket: Socket,
  ) => Readonly<{ readonly uid: number; readonly gid: number; readonly pid: number }>;
}> = {}): Promise<TestFixture> {
  const directory = mkdtempSync(join(tmpdir(), "step16-witness-uds-"));
  temporaryDirectories.push(directory);
  chmodSync(directory, 0o700);
  const directoryStats = lstatSync(directory);
  const socketPath = join(directory, "authority.sock");
  const closingPlan = plan();
  const authorityFixture = authority();
  const server = await startStep16HostCallWitnessUdsServerCoreInternalV1(
    {
      socketPath,
      directSupervisorPid: SUPERVISOR_PID,
      closingPlan,
      authority: { ...authorityFixture.callbacks,
        ...(input.finalizeRun === undefined ? {} : { finalizeRun: input.finalizeRun }) },
      timeoutMs: input.timeoutMs,
    },
    {
      filesystemOwnerUid: directoryStats.uid,
      filesystemOwnerGid: directoryStats.gid,
      readPeerCredentials:
        input.readPeerCredentials ??
        (() => ({ uid: 0, gid: 0, pid: SUPERVISOR_PID })),
    },
  );
  openServers.push(server);
  return { server, socketPath, closingPlan, authority: authorityFixture };
}

interface Client {
  readonly socket: Socket;
  readonly messages: unknown[];
  readonly closed: Promise<void>;
  nextMessage(): Promise<unknown>;
  send(value: unknown): Promise<void>;
  sendRaw(value: Buffer | string): Promise<void>;
}

async function client(socketPath: string): Promise<Client> {
  const socket = createConnection(socketPath);
  socket.on("error", () => undefined);
  const messages: unknown[] = [];
  const waiters: Array<(value: unknown) => void> = [];
  let buffered = Buffer.alloc(0);
  socket.on("data", (chunk: Buffer) => {
    buffered = Buffer.concat([buffered, chunk]);
    for (;;) {
      const newline = buffered.indexOf(0x0a);
      if (newline < 0) break;
      const line = buffered.subarray(0, newline).toString("utf8");
      buffered = buffered.subarray(newline + 1);
      const message = JSON.parse(line) as unknown;
      const waiter = waiters.shift();
      if (waiter === undefined) messages.push(message);
      else waiter(message);
    }
  });
  const closed = new Promise<void>((resolvePromise) => {
    socket.once("close", () => resolvePromise());
  });
  await new Promise<void>((resolvePromise, rejectPromise) => {
    socket.once("connect", () => resolvePromise());
    socket.once("error", rejectPromise);
  });
  return {
    socket,
    messages,
    closed,
    nextMessage: () => {
      const message = messages.shift();
      if (message !== undefined) return Promise.resolve(message);
      return withTimeout(new Promise((resolvePromise) => {
        waiters.push(resolvePromise);
      }));
    },
    send: (value) => write(socket, `${JSON.stringify(value)}\n`),
    sendRaw: (value) => write(socket, value),
  };
}

function write(socket: Socket, value: Buffer | string): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    socket.write(value, (error) => {
      if (error != null) rejectPromise(error);
      else resolvePromise();
    });
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs = 1500): Promise<T> {
  return new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(
      () => rejectPromise(new Error("test timeout")),
      timeoutMs,
    );
    void promise.then(
      (value) => {
        clearTimeout(timer);
        resolvePromise(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        rejectPromise(error);
      },
    );
  });
}

function hello(closingPlan: Step16HostCallWitnessClosingPlanInternalV1) {
  return {
    profile: PROFILE,
    kind: "hello",
    sequence: 1,
    closingPlanDigest: closingPlan.closingPlanDigest,
    runNonce: closingPlan.runNonce,
  };
}

function arm() {
  return {
    profile: PROFILE,
    kind: "arm",
    sequence: 2,
    callOrdinal: 1,
    sessionIdDigest: SESSION_DIGEST,
    callIdDigest: CALL_DIGEST,
  };
}

function observe(token: string) {
  return {
    profile: PROFILE,
    kind: "observe_provider_operation",
    sequence: 3,
    token,
    operation: "write_object",
    operationNonce: OPERATION_NONCE,
    requestDigest: REQUEST_DIGEST,
  };
}

function complete(token: string) {
  return {
    profile: PROFILE,
    kind: "complete",
    sequence: 4,
    token,
    sessionIdDigest: SESSION_DIGEST,
    callIdDigest: CALL_DIGEST,
  };
}

function finalize(sequence = 5) {
  return { profile: PROFILE, kind: "finalize", sequence };
}

async function beginWindow(
  clientFixture: Client,
  closingPlan: Step16HostCallWitnessClosingPlanInternalV1,
): Promise<string> {
  await clientFixture.send(hello(closingPlan));
  await clientFixture.nextMessage();
  await clientFixture.send(arm());
  const response = await clientFixture.nextMessage() as {
    readonly result: string;
  };
  return response.result;
}

afterEach(async () => {
  for (const server of openServers.splice(0)) {
    await server.close().catch(() => undefined);
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Step16 Host-call witness root UDS adapter", () => {
  it("serializes split and coalesced frames and finalizes a complete public receipt result", async () => {
    const finalizeRun = vi.fn(async () => undefined);
    const test = await fixture({ finalizeRun });
    expect(lstatSync(test.socketPath).mode & 0o7777).toBe(0o600);
    const connected = await client(test.socketPath);
    const helloLine = `${JSON.stringify(hello(test.closingPlan))}\n`;
    const splitAt = Math.floor(helloLine.length / 2);
    await connected.sendRaw(helloLine.slice(0, splitAt));
    await connected.sendRaw(
      `${helloLine.slice(splitAt)}${JSON.stringify(arm())}\n`,
    );

    expect(await connected.nextMessage()).toMatchObject({
      profile: PROFILE,
      sequence: 1,
      status: "ok",
      result: { status: "ready" },
    });
    const armed = await connected.nextMessage() as { readonly result: string };
    expect(test.authority.beginCollecting).toHaveBeenCalledWith({
      host: "codex",
      runNonce: RUN_NONCE,
      closingPlanDigest: test.closingPlan.closingPlanDigest,
      callOrdinal: 1,
      eventOrdinal: 3,
      tool: "update_task",
      argumentsDigest: ARGUMENTS_DIGEST,
      sessionIdDigest: SESSION_DIGEST,
      callIdDigest: CALL_DIGEST,
    });
    const token = armed.result;
    await connected.sendRaw(
      `${JSON.stringify(observe(token))}\n${JSON.stringify(complete(token))}\n`,
    );
    expect(await connected.nextMessage()).toMatchObject({
      sequence: 3,
      result: { status: "observed", operationOrdinal: 1 },
    });
    expect(await connected.nextMessage()).toMatchObject({
      sequence: 4,
      result: {
        status: "completed",
        receiptBundleDigests: [RECEIPT_DIGEST],
      },
    });
    await connected.send(finalize());
    const finalized = await connected.nextMessage();
    expect(finalizeRun).toHaveBeenCalledExactlyOnceWith({
      runNonce: RUN_NONCE,
      closingPlanDigest: test.closingPlan.closingPlanDigest,
      callCount: 1,
    });
    expect(finalized).toMatchObject({
      profile: PROFILE,
      sequence: 5,
      status: "finalized",
      result: {
        strongCallProviderReceipts: [{
          callIdDigest: CALL_DIGEST,
          receiptBundleDigests: [RECEIPT_DIGEST],
        }],
        providerBindings: [{
          profile: "step16_provider_receipt_binding_v1",
          callIdDigest: CALL_DIGEST,
          receiptLedger: { receiptBundleDigest: RECEIPT_DIGEST },
        }],
      },
    });
    expect(JSON.stringify(finalized)).not.toContain(PRIVATE_SENTINEL);
    await withTimeout(connected.closed);
    await expect(test.server.close()).resolves.toBeUndefined();
    expect(() => lstatSync(test.socketPath)).toThrow(
      expect.objectContaining({ code: "ENOENT" }),
    );
  });

  it.each(["sessionIdDigest", "callIdDigest"] as const)(
    "rejects an arm frame missing %s before opening authority",
    async (field) => {
      const test = await fixture();
      const connected = await client(test.socketPath);
      await connected.send(hello(test.closingPlan));
      await connected.nextMessage();
      const frame: Record<string, unknown> = arm();
      delete frame[field];
      await connected.send(frame);
      await withTimeout(connected.closed);
      expect(test.authority.beginCollecting).not.toHaveBeenCalled();
      expect(connected.messages).toEqual([]);
    },
  );

  it.each(["sessionIdDigest", "callIdDigest"] as const)(
    "rejects completion replacing the armed %s with zero authority completion",
    async (field) => {
      const test = await fixture();
      const connected = await client(test.socketPath);
      const token = await beginWindow(connected, test.closingPlan);
      await connected.send(observe(token));
      await connected.nextMessage();
      await connected.send({ ...complete(token), [field]: digest("a") });
      await withTimeout(connected.closed);
      expect(test.authority.complete).not.toHaveBeenCalled();
      expect(test.authority.abort).toHaveBeenCalledTimes(1);
      expect(connected.messages).toEqual([]);
      await expect(test.server.close()).rejects.toThrow(
        "step16 witness transport unavailable",
      );
    },
  );

  it("never publishes a finalized response when durable run finalization fails", async () => {
    const finalizeRun = vi.fn(async () => { throw new Error("private durable failure"); });
    const test = await fixture({ finalizeRun });
    const connected = await client(test.socketPath);
    const token = await beginWindow(connected, test.closingPlan);
    await connected.send(observe(token));
    await connected.nextMessage();
    await connected.send(complete(token));
    await connected.nextMessage();
    await connected.send(finalize());
    await withTimeout(connected.closed);
    expect(finalizeRun).toHaveBeenCalledTimes(1);
    expect(connected.messages).toEqual([]);
    await expect(test.server.close()).rejects.toThrow("step16 witness transport unavailable");
  });

  it("rejects finalize at a strict plan prefix and still cleans up", async () => {
    const test = await fixture();
    const connected = await client(test.socketPath);
    await connected.send(hello(test.closingPlan));
    await connected.nextMessage();
    await connected.send(finalize(2));
    await withTimeout(connected.closed);
    expect(connected.messages).toEqual([]);
    await expect(test.server.close()).rejects.toThrow(
      "step16 witness transport unavailable",
    );
    expect(() => lstatSync(test.socketPath)).toThrow(
      expect.objectContaining({ code: "ENOENT" }),
    );
  });

  it("does not report a successful close when finalize delivery is interrupted", async () => {
    let acceptedSocket: Socket | undefined;
    const test = await fixture({
      readPeerCredentials: (socket) => {
        acceptedSocket = socket;
        return { uid: 0, gid: 0, pid: SUPERVISOR_PID };
      },
    });
    const connected = await client(test.socketPath);
    const token = await beginWindow(connected, test.closingPlan);
    await connected.send(observe(token));
    await connected.nextMessage();
    await connected.send(complete(token));
    await connected.nextMessage();
    expect(acceptedSocket).toBeDefined();
    let finishWrite: ((error: Error | null) => void) | undefined;
    vi.spyOn(acceptedSocket!, "write").mockImplementationOnce(
      (...arguments_: unknown[]) => {
        finishWrite = arguments_[2] as (error: Error | null) => void;
        return true;
      },
    );
    await connected.send(finalize());
    await vi.waitFor(() => expect(finishWrite).toBeTypeOf("function"));
    const closeResult = test.server.close().then(
      () => "completed" as const,
      () => "failed" as const,
    );
    finishWrite!(new Error("test interrupted final response"));
    expect(await withTimeout(closeResult)).toBe("failed");
    await withTimeout(connected.closed);
    expect(connected.messages).toEqual([]);
  });

  it("fatally rejects an oversized unterminated frame", async () => {
    const test = await fixture();
    const connected = await client(test.socketPath);
    await connected.sendRaw(
      Buffer.alloc(
        STEP16_HOST_CALL_WITNESS_UDS_LIMITS_INTERNAL_V1.maxFrameBytes + 1,
        0x61,
      ),
    );
    await withTimeout(connected.closed);
    expect(connected.messages).toEqual([]);
  });

  it.each([
    ["CR framing", Buffer.from("{}\r\n", "utf8")],
    ["blank framing", Buffer.from("\n", "utf8")],
    ["invalid UTF-8", Buffer.from([0xc3, 0x28, 0x0a])],
  ])("fatally rejects %s without a diagnostic leak", async (_label, payload) => {
    const test = await fixture();
    const connected = await client(test.socketPath);
    await connected.sendRaw(payload);
    await withTimeout(connected.closed);
    expect(connected.messages).toEqual([]);
  });

  it("rejects unknown JSON fields as an exact-frame violation", async () => {
    const test = await fixture();
    const connected = await client(test.socketPath);
    await connected.send({ ...hello(test.closingPlan), surprise: true });
    await withTimeout(connected.closed);
    expect(connected.messages).toEqual([]);
  });

  it.each([
    { uid: 1, gid: 0, pid: SUPERVISOR_PID },
    { uid: 0, gid: 1, pid: SUPERVISOR_PID },
    { uid: 0, gid: 0, pid: SUPERVISOR_PID + 1 },
  ])("does not consume the single admission slot for a wrong kernel peer %j", async (wrongPeer) => {
    let reads = 0;
    const test = await fixture({
      readPeerCredentials: () => {
        reads += 1;
        return reads === 1
          ? wrongPeer
          : { uid: 0, gid: 0, pid: SUPERVISOR_PID };
      },
    });
    const wrong = await client(test.socketPath);
    await withTimeout(wrong.closed);
    const accepted = await client(test.socketPath);
    await accepted.send(hello(test.closingPlan));
    await expect(accepted.nextMessage()).resolves.toMatchObject({
      sequence: 1,
      result: { status: "ready" },
    });
  });

  it("awaits the authority append before acknowledging or processing a queued completion", async () => {
    const test = await fixture();
    let releaseAppend!: () => void;
    test.authority.appendExpectedOperation.mockImplementation(
      async () => new Promise<void>((resolvePromise) => {
        releaseAppend = resolvePromise;
      }),
    );
    const connected = await client(test.socketPath);
    const token = await beginWindow(connected, test.closingPlan);
    await connected.sendRaw(
      `${JSON.stringify(observe(token))}\n${JSON.stringify(complete(token))}\n`,
    );
    await vi.waitFor(() =>
      expect(test.authority.appendExpectedOperation).toHaveBeenCalledTimes(1),
    );
    expect(test.authority.complete).not.toHaveBeenCalled();
    expect(connected.messages).toEqual([]);
    releaseAppend();
    expect(await connected.nextMessage()).toMatchObject({
      sequence: 3,
      result: { status: "observed", operationOrdinal: 1 },
    });
    expect(await connected.nextMessage()).toMatchObject({
      sequence: 4,
      result: { status: "completed" },
    });
    expect(test.authority.complete).toHaveBeenCalledTimes(1);
    await connected.send(finalize());
    expect(await connected.nextMessage()).toMatchObject({ status: "finalized" });
  });

  it.each([
    "wrong_host",
    "wrong_session",
    "wrong_operation",
    "wrong_request_digest",
    "private_payload",
  ])("rejects an invalid public binding (%s) before publishing completion", async (mutation) => {
    const test = await fixture();
    const value = binding({
      host: "codex",
      sessionIdDigest: SESSION_DIGEST,
      callIdDigest: CALL_DIGEST,
      operation: "write_object",
      operationNonce: OPERATION_NONCE,
      requestDigest: REQUEST_DIGEST,
    });
    if (mutation === "wrong_host") Object.assign(value, { host: "claude" });
    if (mutation === "wrong_session") {
      Object.assign(value, { sessionIdDigest: digest("a") });
    }
    if (mutation === "wrong_operation") {
      Object.assign(value.providerOperation, { operation: "compare_commit" });
    }
    if (mutation === "wrong_request_digest") {
      Object.assign(value.providerOperation, { requestDigest: digest("a") });
    }
    if (mutation === "private_payload") {
      Object.assign(value, { privatePayload: PRIVATE_SENTINEL });
    }
    test.authority.complete.mockResolvedValue([value]);
    const connected = await client(test.socketPath);
    const token = await beginWindow(connected, test.closingPlan);
    await connected.send(observe(token));
    await connected.nextMessage();
    await connected.send(complete(token));
    await withTimeout(connected.closed);
    expect(connected.messages).toEqual([]);
    await expect(test.server.close()).rejects.toThrow(
      "step16 witness transport unavailable",
    );
  });

  it("does not unlink the live socket when a concurrent start loses bind", async () => {
    const first = await fixture();
    const socketIdentity = lstatSync(first.socketPath);
    const directoryStats = lstatSync(dirname(first.socketPath));
    await expect(startStep16HostCallWitnessUdsServerCoreInternalV1(
      {
        socketPath: first.socketPath,
        directSupervisorPid: SUPERVISOR_PID,
        closingPlan: plan(),
        authority: authority().callbacks,
      },
      {
        filesystemOwnerUid: directoryStats.uid,
        filesystemOwnerGid: directoryStats.gid,
        readPeerCredentials: () => ({ uid: 0, gid: 0, pid: SUPERVISOR_PID }),
      },
    )).rejects.toThrow("step16 witness transport unavailable");
    const after = lstatSync(first.socketPath);
    expect([after.dev, after.ino]).toEqual([socketIdentity.dev, socketIdentity.ino]);
    const accepted = await client(first.socketPath);
    await accepted.send(hello(first.closingPlan));
    await expect(accepted.nextMessage()).resolves.toMatchObject({
      result: { status: "ready" },
    });
  });

  it("rejects a second connection after one peer is admitted", async () => {
    const test = await fixture();
    const first = await client(test.socketPath);
    await first.send(hello(test.closingPlan));
    await first.nextMessage();
    const second = await client(test.socketPath);
    await withTimeout(second.closed);
    expect(second.messages).toEqual([]);
  });

  it("aborts an armed authority window on disconnect", async () => {
    const test = await fixture();
    const connected = await client(test.socketPath);
    await beginWindow(connected, test.closingPlan);
    connected.socket.destroy();
    await withTimeout(connected.closed);
    await vi.waitFor(() => expect(test.authority.abort).toHaveBeenCalledTimes(1));
  });

  it("starts fail-closed abort while an authority append is still pending", async () => {
    const test = await fixture();
    let releaseAppend!: () => void;
    test.authority.appendExpectedOperation.mockImplementation(
      async () => new Promise<void>((resolvePromise) => {
        releaseAppend = resolvePromise;
      }),
    );
    const connected = await client(test.socketPath);
    const token = await beginWindow(connected, test.closingPlan);
    await connected.send(observe(token));
    await vi.waitFor(() =>
      expect(test.authority.appendExpectedOperation).toHaveBeenCalledTimes(1),
    );
    connected.socket.destroy();
    await withTimeout(connected.closed);
    await vi.waitFor(() => expect(test.authority.abort).toHaveBeenCalledTimes(1));
    releaseAppend();
  });

  it("bounds close when both an authority append and its abort remain pending", async () => {
    let acceptedSocket: Socket | undefined;
    const test = await fixture({
      timeoutMs: 30,
      readPeerCredentials: (socket) => {
        acceptedSocket = socket;
        return { uid: 0, gid: 0, pid: SUPERVISOR_PID };
      },
    });
    let releaseAppend!: () => void;
    let releaseAbort!: () => void;
    test.authority.appendExpectedOperation.mockImplementation(
      async () => new Promise<void>((resolvePromise) => {
        releaseAppend = resolvePromise;
      }),
    );
    test.authority.abort.mockImplementation(
      async () => new Promise<void>((resolvePromise) => {
        releaseAbort = resolvePromise;
      }),
    );
    const connected = await client(test.socketPath);
    const token = await beginWindow(connected, test.closingPlan);
    const writes = vi.spyOn(acceptedSocket!, "write");
    await connected.send(observe(token));
    await vi.waitFor(() =>
      expect(test.authority.appendExpectedOperation).toHaveBeenCalledTimes(1),
    );
    connected.socket.destroy();
    await withTimeout(connected.closed);
    await vi.waitFor(() => expect(test.authority.abort).toHaveBeenCalledTimes(1));
    await expect(withTimeout(test.server.close(), 500)).rejects.toThrow(
      "step16 witness transport unavailable",
    );
    expect(connected.messages).toEqual([]);
    releaseAppend();
    releaseAbort();
    await new Promise<void>((resolvePromise) => setImmediate(resolvePromise));
    expect(writes).not.toHaveBeenCalled();
    expect(test.authority.complete).not.toHaveBeenCalled();
  });

  it.each(["ready", "armed"] as const)("allows authenticated %s waiting beyond the RPC deadline", async (phase) => {
    const test = await fixture({ timeoutMs: 30 });
    const connected = await client(test.socketPath);
    let token = "";
    if (phase === "armed") token = await beginWindow(connected, test.closingPlan);
    else {
      await connected.send(hello(test.closingPlan));
      await connected.nextMessage();
    }
    let closed = false;
    void connected.closed.then(() => { closed = true; });
    await new Promise<void>((resolve) => setTimeout(resolve, 90));
    expect(closed).toBe(false);
    expect(test.authority.abort).not.toHaveBeenCalled();
    if (phase === "ready") {
      await connected.send(arm());
      token = (await connected.nextMessage() as { result: string }).result;
    }
    await connected.send(observe(token));
    await connected.nextMessage();
    await connected.send(complete(token));
    await connected.nextMessage();
    await connected.send(finalize());
    expect(await connected.nextMessage()).toMatchObject({ status: "finalized" });
    await withTimeout(connected.closed);
  });

  it.each(["quiet", "slow_drip"] as const)("bounds unauthenticated hello (%s)", async (mode) => {
    const test = await fixture({ timeoutMs: 30 });
    const connected = await client(test.socketPath);
    const drip = mode === "slow_drip"
      ? setInterval(() => connected.socket.write(" "), 5)
      : undefined;
    try {
      await withTimeout(connected.closed, 500);
      expect(connected.messages).toEqual([]);
      expect(test.authority.beginCollecting).not.toHaveBeenCalled();
    } finally {
      clearInterval(drip);
    }
  });

  it("bounds an authenticated partial frame even when bytes keep arriving", async () => {
    const test = await fixture({ timeoutMs: 30 });
    const connected = await client(test.socketPath);
    await connected.send(hello(test.closingPlan));
    await connected.nextMessage();
    await connected.sendRaw("{");
    const drip = setInterval(() => connected.socket.write(" "), 5);
    try {
      await withTimeout(connected.closed, 500);
      expect(connected.messages).toEqual([]);
      expect(test.authority.beginCollecting).not.toHaveBeenCalled();
    } finally {
      clearInterval(drip);
    }
  });

  it("times out a pending authority RPC without allowing a late ACK", async () => {
    const test = await fixture({ timeoutMs: 30 });
    let releaseAppend!: () => void;
    test.authority.appendExpectedOperation.mockImplementation(async () =>
      new Promise<void>((resolve) => { releaseAppend = resolve; }));
    const connected = await client(test.socketPath);
    const token = await beginWindow(connected, test.closingPlan);
    await connected.send(observe(token));
    await vi.waitFor(() => expect(test.authority.appendExpectedOperation).toHaveBeenCalledTimes(1));
    await withTimeout(connected.closed);
    await vi.waitFor(() => expect(test.authority.abort).toHaveBeenCalledTimes(1));
    releaseAppend();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(connected.messages).toEqual([]);
  });

  it("rejects an insecure UDS parent before creating a socket", async () => {
    const directory = mkdtempSync(join(tmpdir(), "step16-witness-uds-bad-"));
    temporaryDirectories.push(directory);
    chmodSync(directory, 0o755);
    const stats = lstatSync(directory);
    await expect(startStep16HostCallWitnessUdsServerCoreInternalV1(
      {
        socketPath: join(directory, "authority.sock"),
        directSupervisorPid: SUPERVISOR_PID,
        closingPlan: plan(),
        authority: authority().callbacks,
      },
      {
        filesystemOwnerUid: stats.uid,
        filesystemOwnerGid: stats.gid,
        readPeerCredentials: () => ({ uid: 0, gid: 0, pid: SUPERVISOR_PID }),
      },
    )).rejects.toThrow("step16 witness transport unavailable");
    expect(() => lstatSync(join(directory, "authority.sock"))).toThrow(
      expect.objectContaining({ code: "ENOENT" }),
    );
  });

  it("keeps the production entry fail-closed outside Linux root", async () => {
    if (
      process.platform === "linux" &&
      process.geteuid?.() === 0 &&
      process.getegid?.() === 0
    ) {
      return;
    }
    const directory = mkdtempSync(join(tmpdir(), "step16-witness-uds-prod-"));
    temporaryDirectories.push(directory);
    chmodSync(directory, 0o700);
    await expect(startStep16HostCallWitnessUdsServerInternalV1({
      socketPath: join(directory, "authority.sock"),
      directSupervisorPid: SUPERVISOR_PID,
      closingPlan: plan(),
      authority: authority().callbacks,
    })).rejects.toThrow("step16 witness transport unavailable");
  });
});
