#!/usr/bin/env node

import { lstat, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { PROVIDER_RUNTIME_IPC_PROTOCOL_V1 } from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";

import { DurableObjectProviderRuntimeServerV1 } from "./server.js";

interface RuntimeCliOptionsV1 {
  readonly rootPath: string;
  readonly socketPath: string;
  readonly authKeyFile: string;
  readonly providerId: string;
  readonly authorizedCapabilityDigest: string;
}

function usageV1(): string {
  return [
    "Usage: understand-code-durable-provider-runtime \\",
    "  --root <private-directory> \\",
    "  [--socket <unix-socket-path>] \\",
    "  --auth-key-file <0600-raw-32-byte-key> \\",
    "  --provider-id <durable-object-provider:id> \\",
    "  --capability-digest <sha256:hex64>",
  ].join("\n");
}

function parseArgumentsV1(argv: readonly string[]): RuntimeCliOptionsV1 {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (
      name === undefined ||
      value === undefined ||
      ![
        "--root",
        "--socket",
        "--auth-key-file",
        "--provider-id",
        "--capability-digest",
      ].includes(name) ||
      values.has(name)
    ) {
      throw new Error(usageV1());
    }
    values.set(name, value);
  }
  const rootValue = values.get("--root");
  const authKeyFileValue = values.get("--auth-key-file");
  const capabilityDigest = values.get("--capability-digest");
  const providerId = values.get("--provider-id");
  if (
    rootValue === undefined ||
    authKeyFileValue === undefined ||
    capabilityDigest === undefined ||
    providerId === undefined
  ) {
    throw new Error(usageV1());
  }
  const rootPath = resolve(rootValue);
  return {
    rootPath,
    socketPath: resolve(values.get("--socket") ?? join(rootPath, "runtime.sock")),
    authKeyFile: resolve(authKeyFileValue),
    providerId,
    authorizedCapabilityDigest: capabilityDigest,
  };
}

async function readPrivateAuthKeyV1(path: string): Promise<Uint8Array> {
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error("runtime auth key path must be a regular file");
  }
  if (typeof process.getuid === "function" && metadata.uid !== process.getuid()) {
    throw new Error("runtime auth key file must be owned by the current user");
  }
  if ((metadata.mode & 0o777) !== 0o600) {
    throw new Error("runtime auth key file mode must be exactly 0600");
  }
  const key = await readFile(path);
  if (key.byteLength !== 32) {
    throw new Error("runtime auth key file must contain exactly 32 raw bytes");
  }
  return key;
}

export async function runDurableObjectProviderRuntimeCliV1(
  argv: readonly string[],
): Promise<void> {
  const options = parseArgumentsV1(argv);
  const authKey = await readPrivateAuthKeyV1(options.authKeyFile);
  const server = new DurableObjectProviderRuntimeServerV1({
    rootPath: options.rootPath,
    socketPath: options.socketPath,
    providerId: options.providerId,
    authKey,
    authorizedCapabilityDigest: options.authorizedCapabilityDigest,
  });

  let resolveStop!: () => void;
  const stopRequested = new Promise<void>((resolvePromise) => {
    resolveStop = resolvePromise;
  });
  const stopForSignal = (): void => resolveStop();
  process.once("SIGINT", stopForSignal);
  process.once("SIGTERM", stopForSignal);
  try {
    const address = await server.start();
    process.stdout.write(
      `${JSON.stringify({
        profile: "understand_code_durable_provider_runtime_ready_v1",
        protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
        socketPath: address.socketPath,
        pid: process.pid,
      })}\n`,
    );
    await stopRequested;
  } finally {
    process.off("SIGINT", stopForSignal);
    process.off("SIGTERM", stopForSignal);
    await server.close();
    authKey.fill(0);
  }
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  import.meta.url === pathToFileURL(resolve(invokedPath)).href
) {
  runDurableObjectProviderRuntimeCliV1(process.argv.slice(2)).catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
