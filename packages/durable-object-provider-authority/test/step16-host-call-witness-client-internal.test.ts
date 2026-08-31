import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  connectStep16HostCallWitnessClientCoreInternalV1,
  connectStep16HostCallWitnessClientInternalV1,
  type ConnectStep16HostCallWitnessClientInternalV1Options,
  type Step16HostCallWitnessClientInternalV1,
} from "../src/step16-host-call-witness-client-internal.js";
import { STEP16_HOST_CALL_WITNESS_UDS_PROFILE_INTERNAL_V1 as PROFILE } from "../src/step16-host-call-witness-uds-internal.js";

const PID = 42424;
const RUN_NONCE = "a".repeat(64);
const PLAN_DIGEST = digest("b");
const SESSION_DIGEST = digest("c");
const CALL_DIGEST = digest("d");
const TOKEN = `step16-window-v1:${"e".repeat(64)}`;
const RECEIPT_DIGEST = digest("1");
const UNKNOWN_COMPLETION = { deliberatelyUnvalidatedReceipt: "top-level schema must validate this" };
const cleanup: Array<() => Promise<void>> = [];
const clients: Step16HostCallWitnessClientInternalV1[] = [];

type Request = Record<string, unknown> & { kind: string; sequence: number };
type Respond = (socket: Socket, request: Request, normal: () => void) => void;

function digest(character: string): string { return `sha256:${character.repeat(64)}`; }
function operation() { return { operation: "write_object" as const, operationNonce: "f".repeat(32), requestDigest: digest("0") }; }
function response(request: Request, result: unknown) {
  return { profile: PROFILE, sequence: request.sequence, status: request.kind === "finalize" ? "finalized" : "ok", result };
}

async function server(respond: Respond = (_socket, _request, normal) => normal()) {
  const path = mkdtempSync(join(tmpdir(), "step16-witness-client-"));
  const socketPath = join(path, "witness.sock");
  const requests: Request[] = [];
  const sockets = new Set<Socket>();
  let connections = 0;
  let ordinal = 0;
  const listener = createServer((socket) => {
    connections += 1;
    sockets.add(socket);
    socket.on("error", () => undefined);
    socket.once("close", () => sockets.delete(socket));
    let buffered = "";
    socket.on("data", (chunk: Buffer) => {
      buffered += chunk.toString("utf8");
      for (;;) {
        const newline = buffered.indexOf("\n");
        if (newline < 0) return;
        const request = JSON.parse(buffered.slice(0, newline)) as Request;
        buffered = buffered.slice(newline + 1);
        requests.push(request);
        respond(socket, request, () => {
          let result: unknown;
          if (request.kind === "hello") result = { status: "ready" };
          else if (request.kind === "arm") { ordinal = 0; result = TOKEN; }
          else if (request.kind === "observe_provider_operation") result = { status: "observed", operationOrdinal: ++ordinal };
          else if (request.kind === "complete") result = { status: "completed", receiptBundleDigests: Array.from({ length: ordinal }, (_entry, index) => digest(String(index + 1))) };
          else if (request.kind === "abort") result = { status: "aborted" };
          else result = UNKNOWN_COMPLETION;
          const bytes = `${JSON.stringify(response(request, result))}\n`;
          if (request.kind === "abort" || request.kind === "finalize") socket.end(bytes);
          else socket.write(bytes);
        });
      }
    });
  });
  await new Promise<void>((resolvePromise, rejectPromise) => { listener.once("error", rejectPromise); listener.listen(socketPath, resolvePromise); });
  cleanup.push(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolvePromise) => listener.close(() => resolvePromise()));
    rmSync(path, { recursive: true, force: true });
  });
  const options: ConnectStep16HostCallWitnessClientInternalV1Options = { socketPath, expectedAuthorityPid: PID, runNonce: RUN_NONCE, closingPlanDigest: PLAN_DIGEST, timeoutMs: 500 };
  const readPeerCredentials = vi.fn(() => ({ uid: 0, gid: 0, pid: PID }));
  async function connect(overrides: Partial<ConnectStep16HostCallWitnessClientInternalV1Options> = {}) {
    const client = await connectStep16HostCallWitnessClientCoreInternalV1({ ...options, ...overrides }, { readPeerCredentials });
    clients.push(client);
    return client;
  }
  return { socketPath, requests, options, readPeerCredentials, connect, connections: () => connections };
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  await Promise.all(cleanup.splice(0).map((close) => close()));
});

async function expectRejected(work: Promise<unknown>): Promise<void> {
  await expect(work).rejects.toMatchObject({ code: "witness_transport_rejected" });
}

function bounded<T>(work: Promise<T>, timeoutMs = 750): Promise<T> {
  return new Promise<T>((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => rejectPromise(new Error("client did not terminate within bound")), timeoutMs);
    void work.then((value) => { clearTimeout(timer); resolvePromise(value); }, (error: unknown) => { clearTimeout(timer); rejectPromise(error); });
  });
}

describe("private root supervisor witness UDS client", () => {
  it("binds hello and arm identity, uses one sequenced connection, and leaves finalize result unknown", async () => {
    const test = await server();
    const client = await test.connect();
    expect(test.requests[0]).toEqual({ profile: PROFILE, kind: "hello", sequence: 1, runNonce: RUN_NONCE, closingPlanDigest: PLAN_DIGEST });
    const token = await client.arm(1, SESSION_DIGEST, CALL_DIGEST);
    expect(token).toBe(TOKEN);
    await client.observe(token, operation());
    expect(await client.complete(token, SESSION_DIGEST, CALL_DIGEST)).toEqual({ status: "completed", receiptBundleDigests: [RECEIPT_DIGEST] });
    const finalized: unknown = await client.finalize();
    expect(finalized).toEqual(UNKNOWN_COMPLETION);
    expect(test.requests.map((request) => request.sequence)).toEqual([1, 2, 3, 4, 5]);
    expect(test.requests[1]).toEqual({ profile: PROFILE, kind: "arm", sequence: 2, callOrdinal: 1, sessionIdDigest: SESSION_DIGEST, callIdDigest: CALL_DIGEST });
    expect(test.requests[2]).toEqual({ profile: PROFILE, kind: "observe_provider_operation", sequence: 3, token, ...operation() });
    expect(test.connections()).toBe(1);
    await client.close();
  });

  it("accepts a split UTF8 finalize response only after EOF", async () => {
    const test = await server((socket, request, normal) => {
      if (request.kind !== "finalize") { normal(); return; }
      const bytes = Buffer.from(`${JSON.stringify(response(request, { unicode: "🙂" }))}\n`, "utf8");
      const offset = bytes.indexOf(Buffer.from("🙂"));
      socket.write(bytes.subarray(0, offset + 1));
      setImmediate(() => socket.end(bytes.subarray(offset + 1)));
    });
    const client = await test.connect();
    expect(await client.finalize()).toEqual({ unicode: "🙂" });
  });

  it("aborts the active window and waits for the terminal frame EOF", async () => {
    const test = await server();
    const client = await test.connect();
    const token = await client.arm(1, SESSION_DIGEST, CALL_DIGEST);
    await client.abort(token);
    await expectRejected(client.observe(token, operation()));
    expect(test.requests.map((request) => request.kind)).toEqual(["hello", "arm", "abort"]);
  });

  it.each(["uid", "gid", "pid"] as const)("requires exact native root peer %s before sending hello", async (field) => {
    const test = await server();
    test.readPeerCredentials.mockReturnValue({ uid: 0, gid: 0, pid: PID, [field]: 999 });
    await expectRejected(test.connect());
    expect(test.requests).toHaveLength(0);
  });

  it("fails closed when the native peer reader fails", async () => {
    const test = await server();
    test.readPeerCredentials.mockImplementation(() => { throw new Error("native private details"); });
    await expectRejected(test.connect());
    expect(test.requests).toHaveLength(0);
  });

  it.each([
    ["sequence", (ack: Record<string, unknown>) => ({ ...ack, sequence: 999 })],
    ["profile", (ack: Record<string, unknown>) => ({ ...ack, profile: "wrong" })],
    ["status", (ack: Record<string, unknown>) => ({ ...ack, status: "finalized" })],
    ["extra field", (ack: Record<string, unknown>) => ({ ...ack, privateBytes: "secret" })],
    ["malformed token", (ack: Record<string, unknown>) => ({ ...ack, result: "not-a-window-token" })],
  ] as const)("rejects a wrong %s ACK and becomes sticky", async (_name, mutate) => {
    const test = await server((socket, request, normal) => {
      if (request.kind === "arm") socket.write(`${JSON.stringify(mutate(response(request, TOKEN)))}\n`);
      else normal();
    });
    const client = await test.connect();
    await expectRejected(client.arm(1, SESSION_DIGEST, CALL_DIGEST));
    await expectRejected(client.arm(1, SESSION_DIGEST, CALL_DIGEST));
    expect(test.connections()).toBe(1);
    expect(test.requests).toHaveLength(2);
  });

  it.each([
    ["invalid UTF8", (_request: Request) => Buffer.from([0xc3, 0x28, 0x0a])],
    ["duplicate key", (request: Request) => `${JSON.stringify(response(request, TOKEN)).replace('"sequence":2', '"sequence":2,"sequence":2')}\n`],
    ["CRLF", (request: Request) => `${JSON.stringify(response(request, TOKEN))}\r\n`],
    ["two frames", (request: Request) => `${JSON.stringify(response(request, TOKEN))}\n${JSON.stringify(response(request, TOKEN))}\n`],
    ["overlong frame", (_request: Request) => " ".repeat(64 * 1024 + 1)],
  ] as const)("rejects %s response framing", async (_name, bytes) => {
    const test = await server((socket, request, normal) => {
      if (request.kind === "arm") socket.write(bytes(request));
      else normal();
    });
    const client = await test.connect();
    await expectRejected(client.arm(1, SESSION_DIGEST, CALL_DIGEST));
  });

  it("rejects an unexpected per-window operation ordinal", async () => {
    const test = await server((socket, request, normal) => {
      if (request.kind === "observe_provider_operation") socket.write(`${JSON.stringify(response(request, { status: "observed", operationOrdinal: 9 }))}\n`);
      else normal();
    });
    const client = await test.connect();
    const token = await client.arm(1, SESSION_DIGEST, CALL_DIGEST);
    await expectRejected(client.observe(token, operation()));
  });

  it("rejects a complete identity mismatch locally before writing", async () => {
    const test = await server();
    const client = await test.connect();
    const token = await client.arm(1, SESSION_DIGEST, CALL_DIGEST);
    await client.observe(token, operation());
    await expectRejected(client.complete(token, digest("8"), CALL_DIGEST));
    expect(test.requests.map((request) => request.kind)).not.toContain("complete");
  });

  it("cancels a pending operation immediately and ignores a late ACK", async () => {
    let lateAck: (() => void) | undefined;
    const test = await server((_socket, request, normal) => {
      if (request.kind === "arm") lateAck = normal;
      else normal();
    });
    const controller = new AbortController();
    const client = await test.connect({ signal: controller.signal });
    const pending = expectRejected(bounded(client.arm(1, SESSION_DIGEST, CALL_DIGEST)));
    await vi.waitFor(() => expect(test.requests).toHaveLength(2));
    controller.abort();
    await pending;
    lateAck?.();
    await expectRejected(client.finalize());
    expect(test.requests).toHaveLength(2);
  });

  it("keeps an operation signal linked so a later idle abort invalidates the session", async () => {
    const test = await server();
    const client = await test.connect();
    const controller = new AbortController();
    const token = await client.arm(1, SESSION_DIGEST, CALL_DIGEST, controller.signal);
    controller.abort();
    await expectRejected(client.observe(token, operation()));
    expect(test.requests).toHaveLength(2);
  });

  it("rejects pre-aborted signals without opening a connection", async () => {
    const test = await server();
    const controller = new AbortController();
    controller.abort();
    await expectRejected(test.connect({ signal: controller.signal }));
    expect(test.connections()).toBe(0);
  });

  it("terminates both operations on concurrent use rather than accepting two in-flight requests", async () => {
    const test = await server((_socket, request, normal) => { if (request.kind !== "arm") normal(); });
    const client = await test.connect();
    const results = await Promise.allSettled([client.arm(1, SESSION_DIGEST, CALL_DIGEST), client.finalize()]);
    expect(results.every((result) => result.status === "rejected")).toBe(true);
    await expectRejected(client.arm(1, SESSION_DIGEST, CALL_DIGEST));
  });

  it("uses an absolute deadline despite response byte trickle", async () => {
    let drip: ReturnType<typeof setInterval> | undefined;
    const test = await server((socket, request, normal) => {
      if (request.kind !== "arm") { normal(); return; }
      socket.write("{");
      drip = setInterval(() => socket.write(" "), 5);
      socket.once("close", () => clearInterval(drip));
    });
    const client = await test.connect({ timeoutMs: 50 });
    try { await expectRejected(bounded(client.arm(1, SESSION_DIGEST, CALL_DIGEST))); }
    finally { clearInterval(drip); }
  });

  it("rejects a terminal ACK that never reaches EOF", async () => {
    const test = await server((socket, request, normal) => {
      if (request.kind === "finalize") socket.write(`${JSON.stringify(response(request, UNKNOWN_COMPLETION))}\n`);
      else normal();
    });
    const client = await test.connect({ timeoutMs: 50 });
    await expectRejected(bounded(client.finalize()));
  });

  it("closes a hung pending request without waiting for the server", async () => {
    const test = await server((_socket, request, normal) => { if (request.kind !== "arm") normal(); });
    const client = await test.connect();
    const pending = expectRejected(bounded(client.arm(1, SESSION_DIGEST, CALL_DIGEST)));
    await vi.waitFor(() => expect(test.requests).toHaveLength(2));
    await bounded(client.close());
    await pending;
    await client.close();
  });

  it("snapshots own data options without invoking accessors", async () => {
    const test = await server();
    const getter = vi.fn(() => PID);
    const input = { ...test.options };
    Object.defineProperty(input, "expectedAuthorityPid", { get: getter });
    await expectRejected(connectStep16HostCallWitnessClientCoreInternalV1(input, { readPeerCredentials: test.readPeerCredentials }));
    expect(getter).not.toHaveBeenCalled();
    expect(test.connections()).toBe(0);
  });

  it.skipIf(process.platform === "linux" && process.geteuid?.() === 0 && process.getegid?.() === 0)("keeps the native production entrypoint Linux/root-only", async () => {
    const test = await server();
    await expectRejected(connectStep16HostCallWitnessClientInternalV1(test.options));
    expect(test.connections()).toBe(0);
  });
});
