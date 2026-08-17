import { lstat, readFile } from "node:fs/promises";

import { PROVIDER_RUNTIME_IPC_PROTOCOL_V1 } from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import { DurableObjectProviderRuntimeServerV1 } from "@understand-code/durable-object-provider-runtime";

export interface ProviderRuntimeChildOptionsV1 {
  readonly root: string;
  readonly socket: string;
  readonly authKeyFile: string;
  readonly providerId: string;
  readonly capabilityDigest: `sha256:${string}`;
}

async function readPrivateAuthKeyV1(path: string): Promise<Uint8Array> {
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error("provider runtime auth key must be a regular file");
  }
  if (typeof process.getuid === "function" && metadata.uid !== process.getuid()) {
    throw new Error("provider runtime auth key owner is invalid");
  }
  if ((metadata.mode & 0o777) !== 0o600) {
    throw new Error("provider runtime auth key mode is invalid");
  }
  const key = await readFile(path);
  if (key.byteLength !== 32) {
    throw new Error("provider runtime auth key length is invalid");
  }
  return key;
}

/**
 * Hidden child-process target for the single-file CLI bundle. It carries no
 * repository authority and exposes only the authenticated runtime IPC server.
 */
export async function runProviderRuntimeChildV1(
  options: ProviderRuntimeChildOptionsV1,
): Promise<void> {
  const authKey = await readPrivateAuthKeyV1(options.authKeyFile);
  const server = new DurableObjectProviderRuntimeServerV1({
    rootPath: options.root,
    socketPath: options.socket,
    providerId: options.providerId,
    authKey,
    authorizedCapabilityDigest: options.capabilityDigest,
  });
  let requestStop!: () => void;
  const stopRequested = new Promise<void>((resolve) => {
    requestStop = resolve;
  });
  const onSignal = (): void => requestStop();
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  try {
    const address = await server.start();
    process.stdout.write(
      `${JSON.stringify({
        profile: "understand_code_durable_provider_runtime_ready_v1",
        protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
        socketPath: address.socketPath,
      })}\n`,
    );
    await stopRequested;
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    await server.close();
    authKey.fill(0);
  }
}
