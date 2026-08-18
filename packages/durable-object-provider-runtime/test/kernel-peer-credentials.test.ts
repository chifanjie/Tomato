import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server, Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  sealTrustedProviderRuntimeKernelPeerCredentialHelperV1,
  verifyProviderRuntimeKernelPeerCredentialsV1,
  type ProviderRuntimeKernelPeerCredentialMechanismV1,
  type ProviderRuntimeKernelPeerCredentialPlatformV1,
} from "../src/kernel-peer-credentials.js";

const roots = new Set<string>();
const servers = new Set<Server>();
const sockets = new Set<Socket>();

afterEach(async () => {
  for (const socket of sockets) socket.destroy();
  sockets.clear();
  await Promise.all(
    [...servers].map(
      (server) =>
        new Promise<void>((resolve) => server.close(() => resolve())),
    ),
  );
  servers.clear();
  await Promise.all(
    [...roots].map((root) => rm(root, { recursive: true, force: true })),
  );
  roots.clear();
});

async function connectedUnixSocketsV1(): Promise<{
  readonly client: Socket;
  readonly accepted: Socket;
}> {
  const root = await mkdtemp(join(tmpdir(), "uc-kernel-peer-"));
  roots.add(root);
  const socketPath = join(root, "peer.sock");
  const server = createServer();
  servers.add(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const acceptedPromise = new Promise<Socket>((resolve, reject) => {
    server.once("connection", resolve);
    server.once("error", reject);
  });
  const client = new Socket();
  sockets.add(client);
  await new Promise<void>((resolve, reject) => {
    client.once("error", reject);
    client.connect(socketPath, () => {
      client.off("error", reject);
      resolve();
    });
  });
  const accepted = await acceptedPromise;
  sockets.add(accepted);
  return { client, accepted };
}

function currentPlatformV1(): {
  readonly platform: ProviderRuntimeKernelPeerCredentialPlatformV1;
  readonly mechanism: ProviderRuntimeKernelPeerCredentialMechanismV1;
} {
  if (process.platform === "linux") {
    return { platform: "linux", mechanism: "linux_so_peercred" };
  }
  if (process.platform === "darwin") {
    return {
      platform: "darwin",
      mechanism: "darwin_getpeereid_local_peercred_peerpid",
    };
  }
  throw new Error("kernel peer credential test requires Linux or macOS");
}

describe("kernel peer credential adapter", () => {
  it("binds a trusted helper observation to the exact live Unix socket", async () => {
    const { accepted } = await connectedUnixSocketsV1();
    const identity = {
      uid: process.getuid!(),
      gid: process.getgid!(),
      pid: process.pid,
    };
    let observedSocket: Socket | undefined;
    const helper = sealTrustedProviderRuntimeKernelPeerCredentialHelperV1({
      ...currentPlatformV1(),
      readPeerCredentials: (socket) => {
        observedSocket = socket;
        return identity;
      },
    });

    await expect(
      verifyProviderRuntimeKernelPeerCredentialsV1({
        socket: accepted,
        expected: identity,
        helper,
      }),
    ).resolves.toMatchObject({
      status: "kernel_os_peer_candidate",
      authority: "none",
      accessMode: "read_only",
      strongWriteStatus: "locked",
      requiredNext: "acceptance_identity_token_gate",
      bindings: identity,
    });
    expect(observedSocket).toBe(accepted);
  });

  it("fails closed when the kernel-observed identity differs", async () => {
    const { accepted } = await connectedUnixSocketsV1();
    const identity = {
      uid: process.getuid!(),
      gid: process.getgid!(),
      pid: process.pid,
    };
    const helper = sealTrustedProviderRuntimeKernelPeerCredentialHelperV1({
      ...currentPlatformV1(),
      readPeerCredentials: () => identity,
    });

    await expect(
      verifyProviderRuntimeKernelPeerCredentialsV1({
        socket: accepted,
        expected: { ...identity, uid: identity.uid + 1 },
        helper,
      }),
    ).resolves.toEqual({
      status: "unavailable",
      authority: "none",
      accessMode: "read_only",
      strongWriteStatus: "locked",
      reason: "identity_mismatch",
    });
  });
});
