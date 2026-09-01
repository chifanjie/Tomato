import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ContentDigestV1Schema,
  LowerHex32V1Schema,
  LowerHex64V1Schema,
} from "@understand-code/durable-object-provider-contracts/primitives";

const kernelPeerV1 = vi.hoisted(() => ({ uid: 0, gid: 0, pid: 42_424 }));

vi.mock("@understand-code/native-kernel-bridge", () => ({
  readProviderRuntimeNativeKernelPeerCredentialsV1: () =>
    Object.freeze({ ...kernelPeerV1 }),
}));

import * as publicClientApi from "../src/index.js";
import {
  createProviderOperationPlanSupervisorObserverInternalV1,
  ProviderOperationPlanRejectedInternalV1,
} from "../src/provider-operation-plan-supervisor-transport-internal.js";
import type { ProviderRuntimeStrongMutationOperationPlanInternalV1 } from "../src/provider-runtime-strong-mutation-transport-internal.js";

const temporaryDirectories = new Set<string>();
const RUN_NONCE_V1 = LowerHex64V1Schema.parse("a".repeat(64));
const CLOSING_PLAN_DIGEST_V1 = ContentDigestV1Schema.parse(
  `sha256:${"b".repeat(64)}`,
);
const REQUEST_DIGEST_V1 = ContentDigestV1Schema.parse(
  `sha256:${"c".repeat(64)}`,
);

type RequestV1 = Readonly<{
  profile: "step16_provider_operation_plan_v1";
  runNonce: string;
  closingPlanDigest: string;
  operationSequence: number;
  observed: Readonly<{
    operation: string;
    operationNonce: string;
    requestDigest: string;
  }>;
}>;

interface TestServerV1 {
  readonly socketPath: string;
  readonly requests: readonly RequestV1[];
  readonly connections: () => number;
  close(): Promise<void>;
}

afterEach(async () => {
  kernelPeerV1.uid = 0;
  kernelPeerV1.gid = 0;
  kernelPeerV1.pid = 42_424;
  await Promise.all(
    [...temporaryDirectories].map((directory) =>
      rm(directory, { recursive: true, force: true })
    ),
  );
  temporaryDirectories.clear();
});

function planV1(
  requestDigest = REQUEST_DIGEST_V1,
): ProviderRuntimeStrongMutationOperationPlanInternalV1 {
  return Object.freeze({
    operation: "write_object",
    operationNonce: LowerHex32V1Schema.parse("d".repeat(32)),
    requestDigest,
  });
}

function ackV1(request: RequestV1): Record<string, unknown> {
  return {
    profile: "step16_provider_operation_plan_v1",
    status: "observed",
    runNonce: request.runNonce,
    closingPlanDigest: request.closingPlanDigest,
    operationSequence: request.operationSequence,
    requestDigest: request.observed.requestDigest,
  };
}

async function serverV1(
  respond: (socket: Socket, request: RequestV1) => void,
): Promise<TestServerV1> {
  const root = await mkdtemp(join(tmpdir(), "step16-operation-plan-"));
  temporaryDirectories.add(root);
  const socketPath = join(root, "supervisor.sock");
  const requests: RequestV1[] = [];
  const sockets = new Set<Socket>();
  let connections = 0;
  const server: Server = createServer((socket) => {
    connections += 1;
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    const chunks: Buffer[] = [];
    socket.on("data", (chunk: Buffer) => {
      chunks.push(Buffer.from(chunk));
      const bytes = Buffer.concat(chunks);
      const newline = bytes.indexOf(0x0a);
      if (newline < 0) return;
      const request = JSON.parse(
        bytes.subarray(0, newline).toString("utf8"),
      ) as RequestV1;
      requests.push(request);
      socket.removeAllListeners("data");
      respond(socket, request);
    });
  });
  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(socketPath, resolvePromise);
  });
  return {
    socketPath,
    requests,
    connections: () => connections,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolvePromise) =>
        server.close(() => resolvePromise())
      );
    },
  };
}

function observerV1(socketPath: string, timeoutMs = 500) {
  return createProviderOperationPlanSupervisorObserverInternalV1({
    socketPath,
    expectedSupervisorPid: 42_424,
    runNonce: RUN_NONCE_V1,
    closingPlanDigest: CLOSING_PLAN_DIGEST_V1,
    timeoutMs,
  });
}

async function expectRejectedV1(operation: Promise<unknown>): Promise<void> {
  try {
    await operation;
    expect.fail("expected operation-plan rejection");
  } catch (error) {
    expect(error).toBeInstanceOf(ProviderOperationPlanRejectedInternalV1);
    expect((error as ProviderOperationPlanRejectedInternalV1).code)
      .toBe("operation_plan_rejected");
  }
}

describe("Provider operation-plan supervisor UDS transport (internal)", () => {
  it("authenticates the exact root supervisor and increments exact sequences", async () => {
    const server = await serverV1((socket, request) => {
      socket.end(`${JSON.stringify(ackV1(request))}\n`);
    });
    try {
      const observer = observerV1(server.socketPath);
      await observer(planV1());
      await observer(planV1(ContentDigestV1Schema.parse(
        `sha256:${createHash("sha256").update("second").digest("hex")}`,
      )));

      expect(server.requests).toHaveLength(2);
      expect(server.requests.map((request) => request.operationSequence))
        .toEqual([1, 2]);
      expect(server.requests[0]).toEqual({
        profile: "step16_provider_operation_plan_v1",
        runNonce: RUN_NONCE_V1,
        closingPlanDigest: CLOSING_PLAN_DIGEST_V1,
        operationSequence: 1,
        observed: planV1(),
      });
    } finally {
      await server.close();
    }
  });

  it.each([
    ["run", (ack: Record<string, unknown>) => ({ ...ack, runNonce: "e".repeat(64) })],
    ["plan", (ack: Record<string, unknown>) => ({
      ...ack,
      closingPlanDigest: `sha256:${"e".repeat(64)}`,
    })],
    ["sequence", (ack: Record<string, unknown>) => ({ ...ack, operationSequence: 9 })],
    ["digest", (ack: Record<string, unknown>) => ({
      ...ack,
      requestDigest: `sha256:${"e".repeat(64)}`,
    })],
    ["shape", (ack: Record<string, unknown>) => ({ ...ack, extra: true })],
  ] as const)("rejects a wrong %s ACK and becomes sticky", async (_name, mutate) => {
    const server = await serverV1((socket, request) => {
      socket.end(`${JSON.stringify(mutate(ackV1(request)))}\n`);
    });
    try {
      const observer = observerV1(server.socketPath);
      await expectRejectedV1(observer(planV1()));
      await expectRejectedV1(observer(planV1()));
      expect(server.connections()).toBe(1);
    } finally {
      await server.close();
    }
  });

  it("rejects a replayed ACK sequence without opening a third connection", async () => {
    const server = await serverV1((socket, request) => {
      socket.end(`${JSON.stringify({
        ...ackV1(request),
        operationSequence: 1,
      })}\n`);
    });
    try {
      const observer = observerV1(server.socketPath);
      await observer(planV1());
      await expectRejectedV1(observer(planV1()));
      await expectRejectedV1(observer(planV1()));
      expect(server.connections()).toBe(2);
      expect(server.requests.map((request) => request.operationSequence))
        .toEqual([1, 2]);
    } finally {
      await server.close();
    }
  });

  it("rejects both concurrent observations even while the first is connecting", async () => {
    const server = await serverV1((socket, request) => {
      socket.end(`${JSON.stringify(ackV1(request))}\n`);
    });
    try {
      const observer = observerV1(server.socketPath);
      const firstRejected = expectRejectedV1(observer(planV1()));
      await expectRejectedV1(observer(planV1()));
      await firstRejected;
      await expectRejectedV1(observer(planV1()));
      expect(server.requests).toHaveLength(0);
    } finally {
      await server.close();
    }
  });

  it("uses an absolute deadline even when the peer continuously sends bytes", async () => {
    const server = await serverV1((socket) => {
      socket.write("{");
      const drip = setInterval(() => socket.write(" "), 10);
      socket.on("error", (error) => {
        clearInterval(drip);
        if ((error as NodeJS.ErrnoException).code !== "EPIPE") {
          throw error;
        }
      });
      socket.once("close", () => clearInterval(drip));
    });
    try {
      const observer = observerV1(server.socketPath, 60);
      const started = Date.now();
      await expectRejectedV1(observer(planV1()));
      expect(Date.now() - started).toBeLessThan(1_000);
      await expectRejectedV1(observer(planV1()));
      expect(server.connections()).toBe(1);
    } finally {
      await server.close();
    }
  });

  it.each(["timeout", "eof", "invalid_utf8"] as const)(
    "maps %s to stable operation_plan_rejected",
    async (failure) => {
      const server = await serverV1((socket) => {
        if (failure === "eof") socket.end();
        if (failure === "invalid_utf8") socket.end(Buffer.from([0xff]));
      });
      try {
        const observer = observerV1(server.socketPath, 40);
        await expectRejectedV1(observer(planV1()));
        await expectRejectedV1(observer(planV1()));
        expect(server.connections()).toBe(1);
      } finally {
        await server.close();
      }
    },
  );

  it.each([
    { uid: 1, gid: 0, pid: 42_424 },
    { uid: 0, gid: 1, pid: 42_424 },
    { uid: 0, gid: 0, pid: 42_425 },
  ])("rejects non-exact kernel peer credentials %#", async (peer) => {
    Object.assign(kernelPeerV1, peer);
    const server = await serverV1((socket, request) => {
      socket.end(`${JSON.stringify(ackV1(request))}\n`);
    });
    try {
      const observer = observerV1(server.socketPath);
      await expectRejectedV1(observer(planV1()));
      expect(server.requests).toHaveLength(0);
    } finally {
      await server.close();
    }
  });

  it("keeps the transport absent from the public package index", () => {
    expect(publicClientApi).not.toHaveProperty(
      "createProviderOperationPlanSupervisorObserverInternalV1",
    );
    expect(publicClientApi).not.toHaveProperty(
      "ProviderOperationPlanRejectedInternalV1",
    );
  });
});
