import {
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  verify,
} from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createConnection, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

import {
  PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
  ProviderRuntimeIpcPrincipalAttestationV1Schema,
  ProviderRuntimeIpcPrincipalChallengeV1Schema,
  canonicalizeProviderRuntimeIpcPrincipalAttestationClaimsV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import { afterEach, describe, expect, it } from "vitest";

import { DurableObjectProviderRuntimeServerV1 } from "../src/server.js";

const CAPABILITY_DIGEST = `sha256:${"a".repeat(64)}`;
const HANDOFF_PAYLOAD_DIGEST = `sha256:${"b".repeat(64)}`;
const PROVIDER_ID = "durable-object-provider:principal-attestation-test";
const servers = new Set<DurableObjectProviderRuntimeServerV1>();
const roots = new Set<string>();

afterEach(async () => {
  await Promise.all([...servers].map((server) => server.close()));
  servers.clear();
  await Promise.all(
    [...roots].map((root) => rm(root, { recursive: true, force: true })),
  );
  roots.clear();
});

async function connectV1(socketPath: string): Promise<Socket> {
  return new Promise<Socket>((resolvePromise, rejectPromise) => {
    const socket = createConnection(socketPath);
    socket.once("connect", () => resolvePromise(socket));
    socket.once("error", rejectPromise);
  });
}

async function challengePrincipalV1(
  socketPath: string,
  challenge: string,
): Promise<unknown | undefined> {
  const socket = await connectV1(socketPath);
  const lines = createInterface({ input: socket, crlfDelay: Infinity });
  const iterator = lines[Symbol.asyncIterator]();
  try {
    socket.write(
      `${JSON.stringify(
        ProviderRuntimeIpcPrincipalChallengeV1Schema.parse({
          protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
          kind: "principal_challenge",
          challenge,
        }),
      )}\n`,
    );
    const line = await iterator.next();
    return line.done ? undefined : JSON.parse(line.value) as unknown;
  } finally {
    lines.close();
    socket.destroy();
  }
}

async function startServerV1(input: {
  readonly rootPath: string;
  readonly principalAttestation?: ConstructorParameters<
    typeof DurableObjectProviderRuntimeServerV1
  >[0]["principalAttestation"];
}): Promise<DurableObjectProviderRuntimeServerV1> {
  const server = new DurableObjectProviderRuntimeServerV1({
    rootPath: input.rootPath,
    socketPath: join(input.rootPath, "runtime.sock"),
    providerId: PROVIDER_ID,
    authKey: randomBytes(32),
    authorizedCapabilityDigest: CAPABILITY_DIGEST,
    principalAttestation: input.principalAttestation,
  });
  servers.add(server);
  await server.start();
  return server;
}

describe("provider runtime principal challenge", () => {
  it("signs a fresh challenge together with the current durable journal state", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "provider-principal-attest-"));
    roots.add(rootPath);
    const pair = generateKeyPairSync("ed25519");
    const publicKey = `base64url:${createPublicKey(pair.privateKey)
      .export({ format: "der", type: "spki" })
      .toString("base64url")}`;
    const server = await startServerV1({
      rootPath,
      principalAttestation: {
        privateKey: pair.privateKey,
        handoffPayloadDigest: HANDOFF_PAYLOAD_DIGEST,
        publicKey,
      },
    });
    await server.store.compareCommit({
      expectedRevision: 0,
      operationNonce: "1".repeat(32),
      phase: "principal_attestation_ready",
      artifacts: { marker: "durable" },
    });
    const state = server.store.inspectState();
    const challenge = randomBytes(32).toString("hex");

    const attestation = ProviderRuntimeIpcPrincipalAttestationV1Schema.parse(
      await challengePrincipalV1(server.socketPath, challenge),
    );
    expect(attestation).toMatchObject({
      protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
      kind: "principal_attestation",
      providerId: PROVIDER_ID,
      capabilityDigest: CAPABILITY_DIGEST,
      challenge,
      revision: state.revision,
      phase: state.phase,
      mutationDigest: state.mutationDigest,
      handoffPayloadDigest: HANDOFF_PAYLOAD_DIGEST,
      publicKey,
    });
    const {
      protocol: _protocol,
      kind: _kind,
      signature,
      ...claims
    } = attestation;
    expect(
      verify(
        null,
        canonicalizeProviderRuntimeIpcPrincipalAttestationClaimsV1(claims),
        pair.publicKey,
        Buffer.from(signature.slice("base64url:".length), "base64url"),
      ),
    ).toBe(true);
  });

  it("closes opaquely when principal attestation is not configured", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "provider-no-attest-"));
    roots.add(rootPath);
    const server = await startServerV1({ rootPath });

    await expect(
      challengePrincipalV1(server.socketPath, randomBytes(32).toString("hex")),
    ).resolves.toBeUndefined();
  });
});
