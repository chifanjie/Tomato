import { createHash, createHmac, randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createConnection, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

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
import { afterEach, describe, expect, it, vi } from "vitest";

import { DurableObjectProviderRuntimeServerV1 } from "../src/server.js";

type AuthenticatedWireV1 =
  | ProviderRuntimeIpcClientHelloV1
  | ProviderRuntimeIpcServerHelloV1
  | ProviderRuntimeIpcRequestV1
  | ProviderRuntimeIpcResponseV1;

const CAPABILITY_DIGEST = `sha256:${"a".repeat(64)}`;
const PROVIDER_ID = "durable-object-provider:service-mutation-lock";
const roots = new Set<string>();
const servers = new Set<DurableObjectProviderRuntimeServerV1>();

afterEach(async () => {
  await Promise.all([...servers].map((server) => server.close()));
  servers.clear();
  await Promise.all(
    [...roots].map((root) => rm(root, { recursive: true, force: true })),
  );
  roots.clear();
  vi.restoreAllMocks();
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
    return ProviderRuntimeIpcResponseV1Schema.parse(
      JSON.parse(responseLine.value!),
    );
  } finally {
    lines.close();
    socket.destroy();
  }
}

async function startServerV1(
  rootPath: string,
  key: Uint8Array,
  mutationPolicy?: "hmac_candidate" | "acceptance_authority_session_required",
): Promise<DurableObjectProviderRuntimeServerV1> {
  const server = new DurableObjectProviderRuntimeServerV1({
    rootPath,
    socketPath: join(rootPath, "runtime.sock"),
    providerId: PROVIDER_ID,
    authKey: key,
    authorizedCapabilityDigest: CAPABILITY_DIGEST,
    ...(mutationPolicy === undefined ? {} : { mutationPolicy }),
  });
  servers.add(server);
  await server.start();
  return server;
}

describe("provider service mutation lock", () => {
  it("keeps plain HMAC candidate writes compatible but rejects service mutations before store effects", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "provider-service-lock-"));
    roots.add(rootPath);
    const key = randomBytes(32);
    const bytes = Buffer.from("existing readable object", "utf8");
    const locator = {
      providerId: PROVIDER_ID,
      contentDigest: contentDigestV1(bytes),
    };
    const encodedBytes = `base64url:${bytes.toString("base64url")}`;

    const plain = await startServerV1(rootPath, key);
    await expect(
      callV1(plain.socketPath, key, "write_object", {
        locator,
        logicalBytes: bytes.byteLength,
        bytes: encodedBytes,
      }),
    ).resolves.toMatchObject({
      ok: true,
      payload: { operation: "write_object", resolution: "committed" },
    });
    await expect(
      callV1(plain.socketPath, key, "compare_commit", {
        expectedRevision: 0,
        operationNonce: "1".repeat(32),
        phase: "plain_candidate_committed",
        artifacts: { objectDigest: locator.contentDigest },
      }),
    ).resolves.toMatchObject({
      ok: true,
      payload: {
        operation: "compare_commit",
        resolution: "committed",
        state: { revision: 1 },
      },
    });
    await plain.close();
    servers.delete(plain);

    const service = await startServerV1(
      rootPath,
      key,
      "acceptance_authority_session_required",
    );
    const writeObject = vi.spyOn(service.store, "writeFixedObject");
    const compareCommit = vi.spyOn(service.store, "compareCommit");

    await expect(
      callV1(service.socketPath, key, "inspect_state", {}),
    ).resolves.toMatchObject({
      ok: true,
      payload: {
        operation: "inspect_state",
        state: {
          revision: 1,
          phase: "plain_candidate_committed",
        },
      },
    });
    await expect(
      callV1(service.socketPath, key, "read_object", { locator }),
    ).resolves.toMatchObject({
      ok: true,
      payload: {
        operation: "read_object",
        locator,
        bytes: encodedBytes,
      },
    });

    const rejectedBytes = Buffer.from("must not be written", "utf8");
    await expect(
      callV1(service.socketPath, key, "write_object", {
        locator: {
          providerId: PROVIDER_ID,
          contentDigest: contentDigestV1(rejectedBytes),
        },
        logicalBytes: rejectedBytes.byteLength,
        bytes: `base64url:${rejectedBytes.toString("base64url")}`,
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        code: "capability_mismatch",
        message: "runtime mutation capability is unavailable",
      },
    });
    await expect(
      callV1(service.socketPath, key, "compare_commit", {
        expectedRevision: 1,
        operationNonce: "2".repeat(32),
        phase: "must_not_commit",
        artifacts: { leaked: true },
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        code: "capability_mismatch",
        message: "runtime mutation capability is unavailable",
      },
    });

    expect(writeObject).not.toHaveBeenCalled();
    expect(compareCommit).not.toHaveBeenCalled();
    expect(service.store.inspectState()).toMatchObject({
      revision: 1,
      phase: "plain_candidate_committed",
      artifacts: { objectDigest: locator.contentDigest },
    });
  });
});
