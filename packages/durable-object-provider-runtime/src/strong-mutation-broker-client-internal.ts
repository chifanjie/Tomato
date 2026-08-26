import { lstat } from "node:fs/promises";
import { createConnection, type Socket } from "node:net";
import { isAbsolute, resolve } from "node:path";

import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";
import { ProviderRuntimeIpcStrongMutationResponseV1Schema } from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import { readProviderRuntimeNativeKernelPeerCredentialsV1 } from "@understand-code/native-kernel-bridge";

import {
  mintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1,
  type ProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1,
  type ProviderRuntimeStrongMutationAuthorityGrantContextInternalV1,
  type ProviderRuntimeStrongMutationAuthorityGrantResolutionInternalV1,
} from "./strong-mutation-session-authority-internal.js";

const BROKER_WIRE_PROFILE_V1 =
  "provider_strong_mutation_broker_uds_v1" as const;
const MAX_BROKER_FRAME_BYTES_V1 = 10 * 1024 * 1024;
const BROKER_TIMEOUT_MS_V1 = 5_000;

interface BrokerClientOptionsInternalV1 {
  readonly socketPath: string;
  readonly expectedAuthorityUid: number;
  readonly expectedAuthorityGid: number;
  readonly expectedSocketGid: number;
}

function recordV1(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function kernelIdV1(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new TypeError("strong mutation broker principal is invalid");
  }
  return value;
}

async function readFrameV1(socket: Socket): Promise<unknown> {
  return new Promise<unknown>((resolvePromise, rejectPromise) => {
    let buffered = Buffer.alloc(0);
    const cleanup = (): void => {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);
    };
    const fail = (): void => {
      cleanup();
      rejectPromise(new Error("strong mutation broker unavailable"));
    };
    const onError = (): void => fail();
    const onClose = (): void => fail();
    const onData = (chunk: Buffer): void => {
      buffered = Buffer.concat([buffered, chunk]);
      if (buffered.byteLength > MAX_BROKER_FRAME_BYTES_V1) return fail();
      const newline = buffered.indexOf(0x0a);
      if (newline < 0) return;
      if (newline !== buffered.byteLength - 1) return fail();
      cleanup();
      try {
        resolvePromise(JSON.parse(buffered.subarray(0, newline).toString("utf8")));
      } catch {
        rejectPromise(new Error("strong mutation broker unavailable"));
      }
    };
    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("close", onClose);
  });
}

async function writeFrameV1(socket: Socket, value: unknown): Promise<void> {
  const bytes = Buffer.from(`${canonicalizeJcsSafeIntegerV1(value)}\n`, "utf8");
  if (bytes.byteLength > MAX_BROKER_FRAME_BYTES_V1) {
    throw new Error("strong mutation broker unavailable");
  }
  await new Promise<void>((resolvePromise, rejectPromise) => {
    socket.write(bytes, (error) => error === null || error === undefined
      ? resolvePromise()
      : rejectPromise(new Error("strong mutation broker unavailable")));
  });
}

async function connectAuthenticatedV1(
  options: BrokerClientOptionsInternalV1,
): Promise<Socket> {
  const metadata = await lstat(options.socketPath);
  if (
    !metadata.isSocket() ||
    metadata.isSymbolicLink() ||
    metadata.uid !== options.expectedAuthorityUid ||
    metadata.gid !== options.expectedSocketGid ||
    (metadata.mode & 0o777) !== 0o660
  ) throw new Error("strong mutation broker unavailable");
  const socket = createConnection(options.socketPath);
  socket.setTimeout(BROKER_TIMEOUT_MS_V1, () => socket.destroy());
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const fail = (): void => {
      socket.destroy();
      rejectPromise(new Error("strong mutation broker unavailable"));
    };
    socket.once("error", fail);
    socket.once("connect", () => {
      socket.off("error", fail);
      resolvePromise();
    });
  });
  const peer = readProviderRuntimeNativeKernelPeerCredentialsV1(socket);
  if (
    peer.uid !== options.expectedAuthorityUid ||
    peer.gid !== options.expectedAuthorityGid ||
    !Number.isSafeInteger(peer.pid) ||
    peer.pid < 1
  ) {
    socket.destroy();
    throw new Error("strong mutation broker unavailable");
  }
  return socket;
}

/**
 * Production-only verifier.  It has no caller-supplied path/env authority: the
 * composition root derives socketPath and expected peer IDs from the signed,
 * root-owned service config.
 */
export function createProviderRuntimeStrongMutationBrokerVerifierInternalV1(
  input: BrokerClientOptionsInternalV1,
): ProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1 {
  const socketPath = resolve(input.socketPath);
  if (!isAbsolute(input.socketPath) || socketPath !== input.socketPath) {
    throw new TypeError("strong mutation broker socket is invalid");
  }
  const options = Object.freeze({
    socketPath,
    expectedAuthorityUid: kernelIdV1(input.expectedAuthorityUid),
    expectedAuthorityGid: kernelIdV1(input.expectedAuthorityGid),
    expectedSocketGid: kernelIdV1(input.expectedSocketGid),
  });

  const consumeGrant = async (
    context: ProviderRuntimeStrongMutationAuthorityGrantContextInternalV1,
  ) => {
    let socket: Socket | undefined;
    try {
      socket = await connectAuthenticatedV1(options);
      await writeFrameV1(socket, {
        profile: BROKER_WIRE_PROFILE_V1,
        kind: "begin",
        context,
      });
      const result = recordV1(await readFrameV1(socket));
      if (
        result?.profile !== BROKER_WIRE_PROFILE_V1 ||
        result.kind !== "begin_result"
      ) throw new Error("strong mutation broker unavailable");
      if (result.disposition === "rejected") {
        socket.destroy();
        return false;
      }
      if (result.disposition === "resolved") {
        const response = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
          result.response,
        );
        socket.end();
        return Object.freeze({ disposition: "resolved" as const, response });
      }
      if (
        (result.disposition !== "execute" && result.disposition !== "recover") ||
        typeof result.leaseNonce !== "string" ||
        !/^[0-9a-f]{64}$/u.test(result.leaseNonce)
      ) throw new Error("strong mutation broker unavailable");
      const leaseSocket = socket;
      const leaseNonce = result.leaseNonce;
      let activated = false;
      return Object.freeze({
        disposition: result.disposition,
        async activateExecutionAuthorization(): Promise<boolean> {
          if (activated || leaseSocket.destroyed) return false;
          activated = true;
          try {
            await writeFrameV1(leaseSocket, {
              profile: BROKER_WIRE_PROFILE_V1,
              kind: "activate",
              leaseNonce,
            });
            const activation = recordV1(await readFrameV1(leaseSocket));
            return activation?.profile === BROKER_WIRE_PROFILE_V1 &&
              activation.kind === "activate_result" &&
              activation.activated === true;
          } catch {
            return false;
          } finally {
            leaseSocket.end();
          }
        },
      });
    } catch {
      socket?.destroy();
      return false;
    }
  };

  const resolveGrant = async (
    resolution: ProviderRuntimeStrongMutationAuthorityGrantResolutionInternalV1,
  ): Promise<boolean> => {
    let socket: Socket | undefined;
    try {
      socket = await connectAuthenticatedV1(options);
      await writeFrameV1(socket, {
        profile: BROKER_WIRE_PROFILE_V1,
        kind: "resolve",
        resolution,
      });
      const result = recordV1(await readFrameV1(socket));
      return result?.profile === BROKER_WIRE_PROFILE_V1 &&
        result.kind === "resolve_result" && result.resolved === true;
    } catch {
      return false;
    } finally {
      socket?.end();
    }
  };

  return mintProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1({
    consumeGrant,
    resolveGrant,
  });
}

export const PROVIDER_RUNTIME_STRONG_MUTATION_BROKER_SOCKET_BASENAME_INTERNAL_V1 =
  "strong-mutation-broker-v1.sock" as const;
