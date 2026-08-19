import { execFileSync } from "node:child_process";
import { mkdtemp, open, rm } from "node:fs/promises";
import { createServer, connect, type Server, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  sealTrustedProviderRuntimeKernelPeerCredentialHelperV1,
  verifyProviderRuntimeKernelPeerCredentialsV1,
  type ProviderRuntimeKernelPeerCredentialReaderV1,
} from "../src/kernel-peer-credentials.js";
import {
  assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1,
  readProviderRuntimeNativeKernelPeerCredentialsV1,
} from "../src/native-kernel-peer.js";

interface UnixSocketPairV1 {
  readonly accepted: Socket;
  readonly client: Socket;
  readonly directory: string;
  readonly server: Server;
}

const openPairsV1 = new Set<UnixSocketPairV1>();
const nativeBuildScriptV1 = fileURLToPath(
  new URL("../native/build-native-kernel-peer.mjs", import.meta.url),
);

function closeServerV1(server: Server): Promise<void> {
  if (!server.listening) {
    return Promise.resolve();
  }
  return new Promise((resolve) => server.close(() => resolve()));
}

async function closePairV1(pair: UnixSocketPairV1): Promise<void> {
  pair.client.destroy();
  pair.accepted.destroy();
  await closeServerV1(pair.server);
  await rm(pair.directory, { force: true, recursive: true });
  openPairsV1.delete(pair);
}

async function openUnixSocketPairV1(): Promise<UnixSocketPairV1> {
  const directory = await mkdtemp(join(tmpdir(), "uc-kernel-peer-"));
  const socketPath = join(directory, "provider.sock");
  const server = createServer();
  const acceptedPromise = once(server, "connection").then(
    ([socket]) => socket as Socket,
  );
  server.listen(socketPath);
  await once(server, "listening");
  const client = connect(socketPath);
  await once(client, "connect");
  const accepted = await acceptedPromise;
  const pair = Object.freeze({ accepted, client, directory, server });
  openPairsV1.add(pair);
  return pair;
}

function nativeReaderV1(): ProviderRuntimeKernelPeerCredentialReaderV1 {
  if (process.platform === "linux") {
    return Object.freeze({
      platform: "linux" as const,
      mechanism: "linux_so_peercred" as const,
      readPeerCredentials: readProviderRuntimeNativeKernelPeerCredentialsV1,
    });
  }
  if (process.platform === "darwin") {
    return Object.freeze({
      platform: "darwin" as const,
      mechanism: "darwin_getpeereid_local_peercred_peerpid" as const,
      readPeerCredentials: readProviderRuntimeNativeKernelPeerCredentialsV1,
    });
  }
  throw new Error("unsupported test platform");
}

describe.runIf(process.platform === "darwin" || process.platform === "linux")(
  "native kernel peer credentials",
  () => {
    beforeAll(() => {
      execFileSync(process.execPath, [nativeBuildScriptV1], {
        stdio: "pipe",
      });
    }, 30_000);

    afterEach(async () => {
      await Promise.all([...openPairsV1].map(closePairV1));
    });

    it("reads uid, gid, and pid from the kernel for the exact accepted Unix socket", async () => {
      const pair = await openUnixSocketPairV1();

      expect(readProviderRuntimeNativeKernelPeerCredentialsV1(pair.accepted)).toEqual({
        uid: process.getuid?.(),
        gid: process.getgid?.(),
        pid: process.pid,
      });

      const helper =
        sealTrustedProviderRuntimeKernelPeerCredentialHelperV1(nativeReaderV1());
      await expect(
        verifyProviderRuntimeKernelPeerCredentialsV1({
          socket: pair.accepted,
          expected: {
            uid: process.getuid?.() ?? -1,
            gid: process.getgid?.() ?? -1,
            pid: process.pid === 0x7fff_ffff ? process.pid - 1 : process.pid + 1,
          },
          helper,
        }),
      ).resolves.toMatchObject({
        status: "unavailable",
        authority: "none",
        strongWriteStatus: "locked",
        reason: "identity_mismatch",
      });
    });

    it("fails closed after the exact accepted socket descriptor is closed", async () => {
      const pair = await openUnixSocketPairV1();
      const closed = once(pair.accepted, "close");
      pair.accepted.destroy();
      await closed;

      expect(() =>
        readProviderRuntimeNativeKernelPeerCredentialsV1(pair.accepted),
      ).toThrowError(
        expect.objectContaining({
          code: "ERR_PROVIDER_KERNEL_PEER_CREDENTIALS_UNAVAILABLE",
        }),
      );
    });

    it("admits only the exact opened directory or regular-file kind without extended access control", async () => {
      const directory = await mkdtemp(join(tmpdir(), "uc-native-fd-acl-"));
      const filePath = join(directory, "control.json");
      const directoryHandle = await open(directory, "r");
      const fileHandle = await open(filePath, "w+");
      let fileHandleOpen = true;

      try {
        expect(() =>
          assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1(
            directoryHandle.fd,
            { expectedKind: "directory" },
          ),
        ).not.toThrow();
        expect(() =>
          assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1(
            fileHandle.fd,
            { expectedKind: "regular-file" },
          ),
        ).not.toThrow();

        for (const [fileDescriptor, expectedKind] of [
          [directoryHandle.fd, "regular-file"],
          [fileHandle.fd, "directory"],
        ] as const) {
          expect(() =>
            assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1(
              fileDescriptor,
              { expectedKind },
            ),
          ).toThrowError(
            expect.objectContaining({
              code: "ERR_PROVIDER_RUNTIME_NATIVE_FD_ACCESS_CONTROL_UNAVAILABLE",
            }),
          );
        }

        const closedFileDescriptor = fileHandle.fd;
        await fileHandle.close();
        fileHandleOpen = false;
        expect(() =>
          assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1(
            closedFileDescriptor,
            { expectedKind: "regular-file" },
          ),
        ).toThrowError(
          expect.objectContaining({
            code: "ERR_PROVIDER_RUNTIME_NATIVE_FD_ACCESS_CONTROL_UNAVAILABLE",
          }),
        );

        for (const invalidFileDescriptor of [
          -1,
          0.5,
          Number.NaN,
          Number.POSITIVE_INFINITY,
          0x8000_0000,
        ]) {
          expect(() =>
            assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1(
              invalidFileDescriptor,
              { expectedKind: "regular-file" },
            ),
          ).toThrowError(
            expect.objectContaining({
              code: "ERR_PROVIDER_RUNTIME_NATIVE_FD_ACCESS_CONTROL_UNAVAILABLE",
            }),
          );
        }
      } finally {
        if (fileHandleOpen) {
          await fileHandle.close();
        }
        await directoryHandle.close();
        await rm(directory, { force: true, recursive: true });
      }
    });

    it.runIf(process.platform === "darwin")(
      "admits a deny-only ACL but rejects an allow ACL and immutable flag",
      async () => {
        const directory = await mkdtemp(join(tmpdir(), "uc-native-fd-acl-"));
        const filePath = join(directory, "control.json");
        const directoryHandle = await open(directory, "r");
        const fileHandle = await open(filePath, "w+");

        try {
          execFileSync("/bin/chmod", [
            "+a",
            "everyone deny delete",
            directory,
          ]);
          expect(() =>
            assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1(
              directoryHandle.fd,
              { expectedKind: "directory" },
            ),
          ).not.toThrow();

          execFileSync("/bin/chmod", [
            "+a",
            "everyone allow read,write",
            directory,
          ]);
          expect(() =>
            assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1(
              directoryHandle.fd,
              { expectedKind: "directory" },
            ),
          ).toThrowError(
            expect.objectContaining({
              code: "ERR_PROVIDER_RUNTIME_NATIVE_FD_ACCESS_CONTROL_UNAVAILABLE",
            }),
          );
          execFileSync("/bin/chmod", ["-N", directory]);

          execFileSync("/bin/chmod", [
            "+a",
            "everyone allow read,write",
            filePath,
          ]);
          expect(() =>
            assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1(
              fileHandle.fd,
              { expectedKind: "regular-file" },
            ),
          ).toThrowError(
            expect.objectContaining({
              code: "ERR_PROVIDER_RUNTIME_NATIVE_FD_ACCESS_CONTROL_UNAVAILABLE",
            }),
          );

          execFileSync("/bin/chmod", ["-N", filePath]);
          execFileSync("/usr/bin/chflags", ["uchg", filePath]);
          expect(() =>
            assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1(
              fileHandle.fd,
              { expectedKind: "regular-file" },
            ),
          ).toThrowError(
            expect.objectContaining({
              code: "ERR_PROVIDER_RUNTIME_NATIVE_FD_ACCESS_CONTROL_UNAVAILABLE",
            }),
          );
        } finally {
          execFileSync("/usr/bin/chflags", ["nouchg", filePath]);
          execFileSync("/bin/chmod", ["-N", filePath]);
          execFileSync("/bin/chmod", ["-N", directory]);
          await fileHandle.close();
          await directoryHandle.close();
          await rm(directory, { force: true, recursive: true });
        }
      },
    );
  },
);
