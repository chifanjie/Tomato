import { createHash, createHmac, randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { lstat, mkdtemp, stat, writeFile } from "node:fs/promises";
import { createConnection, type Socket } from "node:net";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import {
  PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
  ProviderRuntimeIpcClientHelloV1Schema,
  ProviderRuntimeIpcRequestV1Schema,
  ProviderRuntimeIpcResponseV1Schema,
  ProviderRuntimeIpcServerHelloV1Schema,
  canonicalizeProviderRuntimeIpcAuthenticatedClaimsV1,
  type ProviderRuntimeIpcClientHelloV1,
  type ProviderRuntimeIpcRequestV1,
  type ProviderRuntimeIpcResponseV1,
  type ProviderRuntimeIpcServerHelloV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import { afterEach, describe, expect, it } from "vitest";

import { DurableObjectProviderRuntimeServerV1 } from "../src/server.js";

type AuthenticatedWireV1 =
  | ProviderRuntimeIpcClientHelloV1
  | ProviderRuntimeIpcServerHelloV1
  | ProviderRuntimeIpcRequestV1
  | ProviderRuntimeIpcResponseV1;

const CAPABILITY_DIGEST = `sha256:${"a".repeat(64)}`;
const PROVIDER_ID = "durable-object-provider:runtime-test";
const servers = new Set<DurableObjectProviderRuntimeServerV1>();
const childProcesses = new Set<ChildProcess>();

afterEach(async () => {
  await Promise.all([...servers].map((server) => server.close()));
  servers.clear();
  for (const child of childProcesses) child.kill("SIGKILL");
  childProcesses.clear();
});

function contentDigestV1(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function signV1<T extends object>(key: Uint8Array, unsigned: T): T & {
  readonly authTag: string;
} {
  const placeholder = {
    ...unsigned,
    authTag: `hmac-sha256:${"0".repeat(64)}`,
  } as unknown as AuthenticatedWireV1;
  const digest = createHmac("sha256", key)
    .update(canonicalizeProviderRuntimeIpcAuthenticatedClaimsV1(placeholder))
    .digest("hex");
  return { ...unsigned, authTag: `hmac-sha256:${digest}` };
}

function verifyV1(key: Uint8Array, wire: AuthenticatedWireV1): boolean {
  const { authTag: _authTag, ...unsigned } = wire;
  return signV1(key, unsigned).authTag === wire.authTag;
}

async function connectV1(socketPath: string): Promise<Socket> {
  return new Promise<Socket>((resolvePromise, rejectPromise) => {
    const socket = createConnection(socketPath);
    socket.once("connect", () => resolvePromise(socket));
    socket.once("error", rejectPromise);
  });
}

async function callV1(
  socketPath: string,
  key: Uint8Array,
  operation: ProviderRuntimeIpcRequestV1["operation"],
  payload: unknown,
): Promise<ProviderRuntimeIpcResponseV1> {
  const socket = await connectV1(socketPath);
  const lines = createInterface({ input: socket, crlfDelay: Infinity });
  const iterator = lines[Symbol.asyncIterator]();
  try {
    const clientNonce = randomBytes(32).toString("hex");
    const hello = ProviderRuntimeIpcClientHelloV1Schema.parse(
      signV1(key, {
        protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
        kind: "client_hello",
        clientNonce,
        capabilityDigest: CAPABILITY_DIGEST,
      }),
    );
    socket.write(`${JSON.stringify(hello)}\n`);
    const serverHelloLine = await iterator.next();
    expect(serverHelloLine.done).toBe(false);
    const serverHello = ProviderRuntimeIpcServerHelloV1Schema.parse(
      JSON.parse(serverHelloLine.value!),
    );
    expect(serverHello.clientNonce).toBe(clientNonce);
    expect(verifyV1(key, serverHello)).toBe(true);

    const request = ProviderRuntimeIpcRequestV1Schema.parse(
      signV1(key, {
        protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
        kind: "request",
        sessionId: serverHello.sessionId,
        requestId: randomBytes(16).toString("hex"),
        sequence: 1,
        capabilityDigest: CAPABILITY_DIGEST,
        operation,
        payload,
      }),
    );
    socket.write(`${JSON.stringify(request)}\n`);
    const responseLine = await iterator.next();
    expect(responseLine.done).toBe(false);
    const response = ProviderRuntimeIpcResponseV1Schema.parse(
      JSON.parse(responseLine.value!),
    );
    expect(response.sessionId).toBe(serverHello.sessionId);
    expect(response.requestId).toBe(request.requestId);
    expect(verifyV1(key, response)).toBe(true);
    return response;
  } finally {
    lines.close();
    socket.destroy();
  }
}

async function startServerV1(rootPath: string, key: Uint8Array) {
  const server = new DurableObjectProviderRuntimeServerV1({
    rootPath,
    socketPath: join(rootPath, "runtime.sock"),
    providerId: PROVIDER_ID,
    authKey: key,
    authorizedCapabilityDigest: CAPABILITY_DIGEST,
  });
  servers.add(server);
  await server.start();
  return server;
}

async function startCliProcessV1(
  rootPath: string,
  socketPath: string,
  keyPath: string,
): Promise<{ readonly child: ChildProcess; readonly readyLine: string }> {
  const cliPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "dist",
    "cli.js",
  );
  const child = spawn(
    process.execPath,
    [
      cliPath,
      "--root",
      rootPath,
      "--socket",
      socketPath,
      "--provider-id",
      PROVIDER_ID,
      "--auth-key-file",
      keyPath,
      "--capability-digest",
      CAPABILITY_DIGEST,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  childProcesses.add(child);
  let stderr = "";
  child.stderr!.setEncoding("utf8");
  child.stderr!.on("data", (chunk: string) => {
    stderr += chunk;
  });
  const readyLine = await new Promise<string>((resolvePromise, rejectPromise) => {
    let stdout = "";
    const timer = setTimeout(
      () => rejectPromise(new Error(`CLI did not become ready: ${stderr}`)),
      5_000,
    );
    child.stdout!.setEncoding("utf8");
    child.stdout!.on("data", (chunk: string) => {
      stdout += chunk;
      const newline = stdout.indexOf("\n");
      if (newline >= 0) {
        clearTimeout(timer);
        resolvePromise(stdout.slice(0, newline));
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      rejectPromise(
        new Error(`CLI exited before ready (${String(code)}): ${stderr}`),
      );
    });
  });
  return { child, readyLine };
}

async function stopCliProcessV1(child: ChildProcess): Promise<void> {
  const exited = new Promise<number | null>((resolvePromise) => {
    child.once("exit", resolvePromise);
  });
  child.kill("SIGTERM");
  expect(await exited).toBe(0);
  childProcesses.delete(child);
}

describe("durable object provider OS-process runtime", () => {
  it("serializes close against asynchronous startup", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "provider-runtime-close-start-"));
    const key = randomBytes(32);
    const server = new DurableObjectProviderRuntimeServerV1({
      rootPath,
      socketPath: join(rootPath, "runtime.sock"),
      providerId: PROVIDER_ID,
      authKey: key,
      authorizedCapabilityDigest: CAPABILITY_DIGEST,
    });
    servers.add(server);

    const startup = server.start();
    await server.close();
    await expect(startup).rejects.toMatchObject({
      message: "runtime server is closing",
    });
    await expect(lstat(join(rootPath, "runtime.sock"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("persists a CLI-process commit and recovers it in a second OS process", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "provider-runtime-cli-"));
    const key = randomBytes(32);
    const keyPath = join(rootPath, "auth.key");
    const socketPath = join(rootPath, "runtime.sock");
    await writeFile(keyPath, key, { mode: 0o600 });
    const first = await startCliProcessV1(rootPath, socketPath, keyPath);
    expect(JSON.parse(first.readyLine)).toEqual({
      profile: "understand_code_durable_provider_runtime_ready_v1",
      protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
      socketPath,
      pid: first.child.pid,
    });
    const inspected = await callV1(socketPath, key, "inspect_state", {});
    expect(inspected).toMatchObject({
      ok: true,
      payload: {
        operation: "inspect_state",
        state: { revision: 0, phase: "uninitialized" },
      },
    });
    const mutation = {
      expectedRevision: 0,
      operationNonce: "3".repeat(32),
      phase: "cli_process_committed",
      artifacts: { marker: "restart-visible" },
    };
    const committed = await callV1(
      socketPath,
      key,
      "compare_commit",
      mutation,
    );
    expect(committed).toMatchObject({
      ok: true,
      payload: {
        operation: "compare_commit",
        resolution: "committed",
        state: { revision: 1, artifacts: mutation.artifacts },
      },
    });
    await stopCliProcessV1(first.child);
    await expect(lstat(socketPath)).rejects.toMatchObject({ code: "ENOENT" });

    const second = await startCliProcessV1(rootPath, socketPath, keyPath);
    const recovered = await callV1(socketPath, key, "inspect_state", {});
    expect(recovered).toMatchObject({
      ok: true,
      payload: {
        operation: "inspect_state",
        state: {
          revision: 1,
          phase: mutation.phase,
          operationNonce: mutation.operationNonce,
          artifacts: mutation.artifacts,
        },
      },
    });
    await stopCliProcessV1(second.child);
    await expect(lstat(socketPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("puts, gets, verifies, CAS-commits, and recovers journal state after restart", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "provider-runtime-"));
    const key = randomBytes(32);
    let server = await startServerV1(rootPath, key);
    const socketPath = server.socketPath;
    expect((await stat(rootPath)).mode & 0o777).toBe(0o700);
    expect((await stat(socketPath)).mode & 0o777).toBe(0o600);

    const bytes = Buffer.from("durable provider bytes", "utf8");
    const locator = {
      providerId: PROVIDER_ID,
      contentDigest: contentDigestV1(bytes),
    };
    const encodedBytes = `base64url:${bytes.toString("base64url")}`;
    const write = await callV1(socketPath, key, "write_object", {
      locator,
      logicalBytes: bytes.byteLength,
      bytes: encodedBytes,
    });
    expect(write).toMatchObject({
      ok: true,
      payload: {
        operation: "write_object",
        resolution: "committed",
        locator,
        verifiedContentDigest: locator.contentDigest,
      },
    });
    const replayedWrite = await callV1(socketPath, key, "write_object", {
      locator,
      logicalBytes: bytes.byteLength,
      bytes: encodedBytes,
    });
    expect(replayedWrite).toMatchObject({
      ok: true,
      payload: { operation: "write_object", resolution: "replayed" },
    });
    const read = await callV1(socketPath, key, "read_object", { locator });
    expect(read).toMatchObject({
      ok: true,
      payload: {
        operation: "read_object",
        locator,
        logicalBytes: bytes.byteLength,
        bytes: encodedBytes,
        verifiedContentDigest: locator.contentDigest,
      },
    });

    const mutation = {
      expectedRevision: 0,
      operationNonce: "1".repeat(32),
      phase: "objects_published",
      artifacts: {
        objectDigest: locator.contentDigest,
        objectCount: 1,
      },
    };
    const committed = await callV1(socketPath, key, "compare_commit", mutation);
    expect(committed).toMatchObject({
      ok: true,
      payload: {
        operation: "compare_commit",
        resolution: "committed",
        state: {
          revision: 1,
          phase: "objects_published",
          operationNonce: mutation.operationNonce,
          artifacts: mutation.artifacts,
        },
      },
    });

    await server.close();
    servers.delete(server);
    server = await startServerV1(rootPath, key);
    const recovered = await callV1(
      server.socketPath,
      key,
      "inspect_state",
      {},
    );
    expect(recovered).toMatchObject({
      ok: true,
      payload: {
        operation: "inspect_state",
        state: {
          revision: 1,
          phase: "objects_published",
          operationNonce: mutation.operationNonce,
          artifacts: mutation.artifacts,
        },
      },
    });
    const advanced = await callV1(
      server.socketPath,
      key,
      "compare_commit",
      {
        expectedRevision: 1,
        operationNonce: "3".repeat(32),
        phase: "later_commit",
        artifacts: { later: true },
      },
    );
    expect(advanced).toMatchObject({
      ok: true,
      payload: {
        operation: "compare_commit",
        resolution: "committed",
        state: { revision: 2, artifacts: { later: true } },
      },
    });
    const replayed = await callV1(
      server.socketPath,
      key,
      "compare_commit",
      mutation,
    );
    expect(replayed).toMatchObject({
      ok: true,
      payload: {
        operation: "compare_commit",
        resolution: "replayed",
        state: {
          revision: 1,
          phase: "objects_published",
          operationNonce: mutation.operationNonce,
          artifacts: mutation.artifacts,
        },
      },
    });
    const stale = await callV1(server.socketPath, key, "compare_commit", {
      ...mutation,
      operationNonce: "2".repeat(32),
    });
    expect(stale).toMatchObject({
      ok: true,
      payload: {
        operation: "compare_commit",
        resolution: "stale",
        state: { revision: 2 },
      },
    });

    const objectPath = join(
      rootPath,
      "objects",
      encodeURIComponent(PROVIDER_ID),
      `${locator.contentDigest.slice("sha256:".length)}.blob`,
    );
    expect((await stat(objectPath)).mode & 0o777).toBe(0o600);
    expect((await stat(join(rootPath, "journal", "state.json"))).mode & 0o777)
      .toBe(0o600);
  });

  it("fails an unauthenticated capability attempt closed without an oracle response", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "provider-runtime-auth-"));
    const key = randomBytes(32);
    const server = await startServerV1(rootPath, key);
    const socket = await connectV1(server.socketPath);
    const observed: Buffer[] = [];
    socket.on("data", (chunk: Buffer) => observed.push(chunk));
    const wrongKey = randomBytes(32);
    const hello = ProviderRuntimeIpcClientHelloV1Schema.parse(
      signV1(wrongKey, {
        protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
        kind: "client_hello",
        clientNonce: randomBytes(32).toString("hex"),
        capabilityDigest: CAPABILITY_DIGEST,
      }),
    );
    socket.write(`${JSON.stringify(hello)}\n`);
    await new Promise<void>((resolvePromise, rejectPromise) => {
      const timer = setTimeout(
        () => rejectPromise(new Error("runtime did not close rejected handshake")),
        2_000,
      );
      const finish = (): void => {
        clearTimeout(timer);
        resolvePromise();
      };
      socket.once("close", finish);
      socket.once("end", finish);
      socket.once("error", finish);
    });
    expect(Buffer.concat(observed)).toHaveLength(0);
  });

  it("rejects bytes that do not match their fixed content-digest locator", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "provider-runtime-digest-"));
    const key = randomBytes(32);
    const server = await startServerV1(rootPath, key);
    const bytes = Buffer.from("wrong object", "utf8");
    const response = await callV1(server.socketPath, key, "write_object", {
      locator: {
        providerId: PROVIDER_ID,
        contentDigest: `sha256:${"b".repeat(64)}`,
      },
      logicalBytes: bytes.byteLength,
      bytes: `base64url:${bytes.toString("base64url")}`,
    });
    expect(response).toMatchObject({
      ok: false,
      error: { code: "object_digest_mismatch" },
    });

    const wrongProvider = await callV1(
      server.socketPath,
      key,
      "read_object",
      {
        locator: {
          providerId: "durable-object-provider:other-runtime",
          contentDigest: contentDigestV1(bytes),
        },
      },
    );
    expect(wrongProvider).toMatchObject({
      ok: false,
      error: { code: "capability_mismatch" },
    });
  });
});
