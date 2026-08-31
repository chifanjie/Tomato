import { chmodSync, existsSync, lstatSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createConnection, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  startStep16ProviderOperationPlanRelayCoreInternalV1,
  startStep16ProviderOperationPlanRelayInternalV1,
  STEP16_PROVIDER_OPERATION_PLAN_RELAY_LIMITS_INTERNAL_V1,
  STEP16_PROVIDER_OPERATION_PLAN_RELAY_PROFILE_INTERNAL_V1,
  type StartStep16ProviderOperationPlanRelayInternalV1Options,
  type Step16ProviderOperationPlanRelayInternalV1,
} from "../src/step16-provider-operation-plan-relay-internal.js";

const PROFILE = STEP16_PROVIDER_OPERATION_PLAN_RELAY_PROFILE_INTERNAL_V1;
const RUN_NONCE = "a".repeat(64);
const PLAN_DIGEST = `sha256:${"b".repeat(64)}`;
const REQUEST_DIGEST = `sha256:${"c".repeat(64)}`;
const PEER_UID = 1025;
const PEER_PID = 42424;
const directories: string[] = [];
const servers: Step16ProviderOperationPlanRelayInternalV1[] = [];
const clients: Socket[] = [];

type Observer = StartStep16ProviderOperationPlanRelayInternalV1Options["observeProviderOperation"];

function directory(): string {
  const path = mkdtempSync(join(tmpdir(), "step16-plan-relay-"));
  chmodSync(path, 0o710);
  directories.push(path);
  return path;
}

function options(path: string, observeProviderOperation: Observer = async () => undefined) {
  const stats = lstatSync(path);
  return {
    socketPath: join(path, "relay.sock"),
    expectedGatewayPeer: { uid: PEER_UID, gid: stats.gid, pid: PEER_PID },
    runNonce: RUN_NONCE,
    closingPlanDigest: PLAN_DIGEST,
    observeProviderOperation,
    timeoutMs: 1000,
  };
}

async function fixture(input: Readonly<{ observe?: Observer; timeoutMs?: number }> = {}) {
  const path = directory();
  const observed = vi.fn<Observer>(input.observe ?? (async () => undefined));
  const config = { ...options(path, observed), timeoutMs: input.timeoutMs ?? 1000 };
  const readPeerCredentials = vi.fn(() => ({ ...config.expectedGatewayPeer }));
  const dependencies = { filesystemOwnerUid: lstatSync(path).uid, readPeerCredentials };
  const server = await startStep16ProviderOperationPlanRelayCoreInternalV1(config, dependencies);
  servers.push(server);
  return { path, config, server, observed, readPeerCredentials, dependencies };
}

function observed(operation: "write_object" | "compare_commit" = "write_object") {
  return { operation, operationNonce: "d".repeat(32), requestDigest: REQUEST_DIGEST };
}

function request(sequence = 1) {
  return { profile: PROFILE, runNonce: RUN_NONCE, closingPlanDigest: PLAN_DIGEST, operationSequence: sequence, observed: observed() };
}

function frame(value: unknown): string {
  return `${canonicalizeJcsSafeIntegerV1(value)}\n`;
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}

async function client(socketPath: string) {
  const socket = createConnection(socketPath);
  clients.push(socket);
  const chunks: Buffer[] = [];
  socket.on("data", (chunk: Buffer) => chunks.push(chunk));
  socket.on("error", () => undefined);
  const closed = new Promise<Buffer>((resolvePromise) => socket.once("close", () => resolvePromise(Buffer.concat(chunks))));
  await new Promise<void>((resolvePromise, rejectPromise) => {
    socket.once("connect", resolvePromise);
    socket.once("error", rejectPromise);
  });
  return {
    socket, closed,
    bytes: () => Buffer.concat(chunks),
    send: (bytes: string | Buffer) => new Promise<void>((resolvePromise, rejectPromise) => {
      socket.write(bytes, (error) => error == null ? resolvePromise() : rejectPromise(error));
    }),
  };
}

async function exchange(socketPath: string, bytes: string | Buffer): Promise<Buffer> {
  const connection = await client(socketPath);
  await connection.send(bytes).catch(() => undefined);
  return connection.closed;
}

async function exchangeOnAck(socketPath: string, bytes: string): Promise<Buffer> {
  const connection = await client(socketPath);
  const ack = new Promise<Buffer>((resolvePromise, rejectPromise) => {
    connection.socket.on("data", () => {
      if (connection.bytes().includes(0x0a)) resolvePromise(connection.bytes());
    });
    connection.socket.once("close", () => {
      if (!connection.bytes().includes(0x0a)) rejectPromise(new Error("ACK missing"));
    });
  });
  await connection.send(bytes);
  // Deliberately return on the ACK data event, without awaiting EOF or close.
  return ack;
}

function bounded<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => rejectPromise(new Error("bounded close exceeded")), 500);
    void promise.then((value) => { clearTimeout(timer); resolvePromise(value); }, (error: unknown) => { clearTimeout(timer); rejectPromise(error); });
  });
}

afterEach(async () => {
  for (const socket of clients.splice(0)) socket.destroy();
  await Promise.all(servers.splice(0).map((server) => bounded(server.close()).catch(() => undefined)));
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("root-side Provider operation-plan relay (internal)", () => {
  it("uses group-only connection permissions and ACKs exact run/plan/sequence/digest after observation", async () => {
    const test = await fixture();
    expect(lstatSync(test.path).mode & 0o7777).toBe(0o710);
    expect(lstatSync(test.server.socketPath).mode & 0o7777).toBe(0o620);
    expect(lstatSync(test.server.socketPath).uid).toBe(test.dependencies.filesystemOwnerUid);
    expect(lstatSync(test.server.socketPath).gid).toBe(test.config.expectedGatewayPeer.gid);
    const first = JSON.parse((await exchange(test.server.socketPath, frame(request()))).toString("utf8"));
    const secondRequest = { ...request(2), observed: observed("compare_commit") };
    const second = JSON.parse((await exchange(test.server.socketPath, frame(secondRequest))).toString("utf8"));
    expect(first).toEqual({ profile: PROFILE, status: "observed", runNonce: RUN_NONCE, closingPlanDigest: PLAN_DIGEST, operationSequence: 1, requestDigest: REQUEST_DIGEST });
    expect(second).toEqual({ ...first, operationSequence: 2 });
    expect(test.observed.mock.calls.map((call) => call[1].operationSequence)).toEqual([1, 2]);
    expect(test.observed.mock.calls[0]?.[0]).toEqual(observed());
    expect(Object.isFrozen(test.observed.mock.calls[0]?.[0])).toBe(true);
    expect(Object.isFrozen(test.observed.mock.calls[0]?.[1])).toBe(true);
    for (let sequence = 3; sequence <= 22; sequence += 1) {
      const ack = JSON.parse((await exchangeOnAck(test.server.socketPath, frame(request(sequence)))).toString("utf8"));
      expect(ack.operationSequence).toBe(sequence);
    }
    expect(test.observed).toHaveBeenCalledTimes(22);
    await test.server.close();
    expect(existsSync(test.server.socketPath)).toBe(false);
    expect(test.server.close()).toBe(test.server.close());
  });

  it("withholds ACK while the async observation has not settled", async () => {
    const pending = deferred();
    const test = await fixture({ observe: () => pending.promise });
    const connection = await client(test.server.socketPath);
    await connection.send(frame(request()));
    await vi.waitFor(() => expect(test.observed).toHaveBeenCalledOnce());
    expect(connection.bytes().length).toBe(0);
    pending.resolve();
    expect(JSON.parse((await connection.closed).toString("utf8")).status).toBe("observed");
    await test.server.close();
  });

  it.each(["uid", "gid", "pid"] as const)("rejects a wrong kernel %s without consuming the authorized sequence", async (field) => {
    const test = await fixture();
    test.readPeerCredentials.mockReturnValueOnce({ ...test.config.expectedGatewayPeer, [field]: test.config.expectedGatewayPeer[field] + 1 });
    expect((await exchange(test.server.socketPath, frame(request()))).length).toBe(0);
    expect(test.observed).not.toHaveBeenCalled();
    expect((await exchange(test.server.socketPath, frame(request()))).length).toBeGreaterThan(0);
    await test.server.close();
  });

  it("rejects unavailable native peer credentials before parsing or observing", async () => {
    const test = await fixture();
    test.readPeerCredentials.mockImplementationOnce(() => { throw new Error("native peer unavailable"); });
    expect((await exchange(test.server.socketPath, frame(request()))).length).toBe(0);
    expect(test.observed).not.toHaveBeenCalled();
    await test.server.close();
  });

  it.each([
    ["wrong run", { ...request(), runNonce: "e".repeat(64) }],
    ["wrong plan", { ...request(), closingPlanDigest: `sha256:${"e".repeat(64)}` }],
    ["wrong profile", { ...request(), profile: "other" }],
    ["out of order", request(2)],
    ["zero sequence", request(0)],
    ["fractional sequence", request(1.5)],
    ["caller identity field", { ...request(), uid: 0 }],
    ["bad operation", { ...request(), observed: { ...observed(), operation: "delete_object" } }],
    ["64hex operation nonce", { ...request(), observed: { ...observed(), operationNonce: "d".repeat(64) } }],
    ["bad digest", { ...request(), observed: { ...observed(), requestDigest: "raw" } }],
    ["private payload", { ...request(), observed: { ...observed(), payload: "secret" } }],
    ["missing field", { ...request(), observed: { operation: "write_object", requestDigest: REQUEST_DIGEST } }],
    ["array", []],
    ["null", null],
  ] as const)("fails closed on %s", async (_name, value) => {
    const test = await fixture();
    const bytes = _name === "fractional sequence" ? `${JSON.stringify(value)}\n` : frame(value);
    expect((await exchange(test.server.socketPath, bytes)).length).toBe(0);
    expect(test.observed).not.toHaveBeenCalled();
    await expect(test.server.close()).rejects.toMatchObject({ code: "operation_plan_rejected" });
  });

  it.each([
    ["duplicate key", () => frame(request()).replace('"operationSequence":1', '"operationSequence":1,"operationSequence":1')],
    ["invalid UTF8", () => Buffer.from([0xc3, 0x28, 0x0a])],
    ["BOM", () => `\ufeff${frame(request())}`],
    ["CRLF", () => frame(request()).replace(/\n$/u, "\r\n")],
    ["two frames", () => frame(request()) + frame(request(2))],
    ["over 16KiB", () => "x".repeat(STEP16_PROVIDER_OPERATION_PLAN_RELAY_LIMITS_INTERNAL_V1.maxFrameBytes) + "\n"],
  ] as const)("rejects %s framing without exposing callback data", async (_name, bytes) => {
    const test = await fixture();
    expect((await exchange(test.server.socketPath, bytes())).length).toBe(0);
    expect(test.observed).not.toHaveBeenCalled();
    await expect(test.server.close()).rejects.toMatchObject({ code: "operation_plan_rejected" });
  });

  it("accepts a canonical request fragmented across socket chunks", async () => {
    const test = await fixture();
    const connection = await client(test.server.socketPath);
    const bytes = frame(request());
    await connection.send(bytes.slice(0, 7));
    await connection.send(bytes.slice(7, -1));
    expect(test.observed).not.toHaveBeenCalled();
    await connection.send("\n");
    expect((await connection.closed).length).toBeGreaterThan(0);
    expect(test.observed).toHaveBeenCalledOnce();
    await test.server.close();
  });

  it("does not reset the operation sequence on a new connection", async () => {
    const test = await fixture();
    await exchange(test.server.socketPath, frame(request()));
    expect((await exchange(test.server.socketPath, frame(request()))).length).toBe(0);
    expect(test.observed).toHaveBeenCalledOnce();
    await expect(test.server.close()).rejects.toMatchObject({ code: "operation_plan_rejected" });
  });

  it("rejects callback failure with no ACK or private error disclosure", async () => {
    const test = await fixture({ observe: async () => { throw new Error("PRIVATE_PAYLOAD"); } });
    expect((await exchange(test.server.socketPath, frame(request()))).length).toBe(0);
    await expect(test.server.close()).rejects.toThrow("step16 provider operation plan relay unavailable");
  });

  it.each(["close", "close late rejection", "deadline", "disconnect", "extra frame", "concurrent connection"] as const)("aborts a hung observation on %s and never ACKs its late completion", async (reason) => {
    const pending = deferred();
    const test = await fixture({ observe: () => pending.promise, timeoutMs: reason === "deadline" ? 100 : 1000 });
    const connection = await client(test.server.socketPath);
    await connection.send(frame(request()));
    await vi.waitFor(() => expect(test.observed).toHaveBeenCalledOnce());
    const signal = test.observed.mock.calls[0]![1].signal;
    let closeResult: Promise<void> | undefined;
    if (reason === "close" || reason === "close late rejection") {
      closeResult = test.server.close();
      void closeResult.catch(() => undefined);
    }
    if (reason === "disconnect") connection.socket.destroy();
    if (reason === "extra frame") await connection.send(frame(request(2))).catch(() => undefined);
    if (reason === "concurrent connection") expect((await exchange(test.server.socketPath, frame(request(2)))).length).toBe(0);
    expect((await bounded(connection.closed)).length).toBe(0);
    expect(signal.aborted).toBe(true);
    await expect(bounded(closeResult ?? test.server.close())).rejects.toMatchObject({ code: "operation_plan_rejected" });
    expect(existsSync(test.server.socketPath)).toBe(false);
    if (reason === "close late rejection") pending.reject(new Error("late private rejection"));
    else pending.resolve();
    await new Promise<void>((resolvePromise) => setImmediate(resolvePromise));
    expect(connection.bytes().length).toBe(0);
    expect(test.observed).toHaveBeenCalledOnce();
  });

  it("times out an unfinished frame before any callback", async () => {
    const test = await fixture({ timeoutMs: 50 });
    expect((await bounded(exchange(test.server.socketPath, frame(request()).slice(0, -1)))).length).toBe(0);
    expect(test.observed).not.toHaveBeenCalled();
    await expect(test.server.close()).rejects.toMatchObject({ code: "operation_plan_rejected" });
  });

  it("enforces an absolute deadline even while request bytes keep arriving", async () => {
    const test = await fixture({ timeoutMs: 80 });
    const connection = await client(test.server.socketPath);
    await connection.send("{");
    let sends = 0;
    const drip = setInterval(() => {
      sends += 1;
      void connection.send(" ").catch(() => undefined);
    }, 10);
    try {
      expect((await bounded(connection.closed)).length).toBe(0);
    } finally { clearInterval(drip); }
    expect(sends).toBeGreaterThan(1);
    expect(test.observed).not.toHaveBeenCalled();
    await expect(test.server.close()).rejects.toMatchObject({ code: "operation_plan_rejected" });
  });

  it("reattests socket permissions before ACK", async () => {
    const pending = deferred();
    const test = await fixture({ observe: () => pending.promise });
    const result = exchange(test.server.socketPath, frame(request()));
    await vi.waitFor(() => expect(test.observed).toHaveBeenCalledOnce());
    chmodSync(test.server.socketPath, 0o666);
    pending.resolve();
    expect((await result).length).toBe(0);
    await expect(test.server.close()).rejects.toMatchObject({ code: "operation_plan_rejected" });
  });

  it.each([0o700, 0o711, 0o770])("refuses a parent with mode %s", async (mode) => {
    const path = directory();
    chmodSync(path, mode);
    await expect(startStep16ProviderOperationPlanRelayCoreInternalV1(options(path), {
      filesystemOwnerUid: lstatSync(path).uid,
      readPeerCredentials: () => options(path).expectedGatewayPeer,
    })).rejects.toMatchObject({ code: "operation_plan_rejected" });
    expect(existsSync(join(path, "relay.sock"))).toBe(false);
  });

  it("does not replace an existing path or accept a symlink parent", async () => {
    const path = directory();
    const config = options(path);
    writeFileSync(config.socketPath, "keep-user-file");
    const dependencies = { filesystemOwnerUid: lstatSync(path).uid, readPeerCredentials: () => config.expectedGatewayPeer };
    await expect(startStep16ProviderOperationPlanRelayCoreInternalV1(config, dependencies)).rejects.toMatchObject({ code: "operation_plan_rejected" });
    expect(readFileSync(config.socketPath, "utf8")).toBe("keep-user-file");
    const link = join(directory(), "linked-parent");
    symlinkSync(path, link);
    await expect(startStep16ProviderOperationPlanRelayCoreInternalV1({ ...config, socketPath: join(link, "another.sock") }, dependencies)).rejects.toMatchObject({ code: "operation_plan_rejected" });
  });

  it("snapshots own data options and never invokes an option accessor", async () => {
    const path = directory();
    const config = options(path);
    const getter = vi.fn(() => async () => undefined);
    Object.defineProperty(config, "observeProviderOperation", { get: getter });
    await expect(startStep16ProviderOperationPlanRelayCoreInternalV1(config, {
      filesystemOwnerUid: lstatSync(path).uid,
      readPeerCredentials: () => config.expectedGatewayPeer,
    })).rejects.toMatchObject({ code: "operation_plan_rejected" });
    expect(getter).not.toHaveBeenCalled();
    expect(existsSync(config.socketPath)).toBe(false);
  });

  it.skipIf(process.platform === "linux" && process.geteuid?.() === 0 && process.getegid?.() === 0)("keeps the production entrypoint Linux/root-only", async () => {
    const config = options(directory());
    await expect(startStep16ProviderOperationPlanRelayInternalV1(config)).rejects.toMatchObject({ code: "operation_plan_rejected" });
    expect(existsSync(config.socketPath)).toBe(false);
  });

  it("closes an idle relay and refuses new connections", async () => {
    const test = await fixture();
    await bounded(test.server.close());
    expect(existsSync(test.server.socketPath)).toBe(false);
    await expect(client(test.server.socketPath)).rejects.toBeDefined();
  });
});
