import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
  ProviderRuntimeIpcPrincipalChallengeV1Schema,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import { createDurableObjectProviderRuntimeClientV1 } from "../src/provider-runtime-client.js";

const PROVIDER_ID = "durable-object-provider:principal-client";
const CAPABILITY_DIGEST = `sha256:${"a".repeat(64)}` as const;
const HANDOFF_PAYLOAD_DIGEST = `sha256:${"b".repeat(64)}`;
const fixtures: Array<{
  readonly rootPath: string;
  readonly server: Server;
}> = [];

afterEach(async () => {
  await Promise.all(
    fixtures.splice(0).map(
      ({ rootPath, server }) =>
        new Promise<void>((resolve) => {
          server.close(() => {
            void rm(rootPath, { force: true, recursive: true }).then(() =>
              resolve(),
            );
          });
        }),
    ),
  );
});

async function startPrincipalAttestationServerV1(input: {
  readonly responseChallenge?: string;
  readonly extraResponseField?: boolean;
} = {}): Promise<string> {
  const rootPath = await mkdtemp(join(tmpdir(), "ucpc-"));
  const socketPath = join(rootPath, "s");
  const server = createServer((socket) => {
    socket.setEncoding("utf8");
    let buffered = "";
    socket.on("data", (chunk: string) => {
      buffered += chunk;
      const newlineIndex = buffered.indexOf("\n");
      if (newlineIndex === -1) return;
      const challenge = ProviderRuntimeIpcPrincipalChallengeV1Schema.parse(
        JSON.parse(buffered.slice(0, newlineIndex)),
      );
      socket.end(
        `${JSON.stringify({
          protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
          kind: "principal_attestation",
          providerId: PROVIDER_ID,
          capabilityDigest: CAPABILITY_DIGEST,
          challenge: input.responseChallenge ?? challenge.challenge,
          processId: process.pid,
          revision: 4,
          phase: "final_strong_ready",
          mutationDigest: `sha256:${"c".repeat(64)}`,
          handoffPayloadDigest: HANDOFF_PAYLOAD_DIGEST,
          publicKey: "base64url:AQ",
          signature: "base64url:Ag",
          ...(input.extraResponseField ? { unexpected: true } : {}),
        })}\n`,
      );
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, () => {
      server.off("error", reject);
      resolve();
    });
  });
  fixtures.push({ rootPath, server });
  return socketPath;
}

function makeClientV1(socketPath: string) {
  return createDurableObjectProviderRuntimeClientV1({
    socketPath,
    sharedSecret: new Uint8Array(32),
    verifiedSelection: {
      verification: "caller_verified_registry_selection_v1",
      providerId: PROVIDER_ID,
      capabilityDigest: CAPABILITY_DIGEST,
    },
    transportRetryCount: 0,
  });
}

describe("provider runtime principal challenge client", () => {
  it("exchanges a first-frame challenge for a strictly parsed attestation", async () => {
    const socketPath = await startPrincipalAttestationServerV1();
    const challenge = "d".repeat(64);

    await expect(makeClientV1(socketPath).attestPrincipal(challenge)).resolves.toMatchObject({
      protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
      kind: "principal_attestation",
      providerId: PROVIDER_ID,
      capabilityDigest: CAPABILITY_DIGEST,
      challenge,
      processId: process.pid,
      revision: 4,
      phase: "final_strong_ready",
      handoffPayloadDigest: HANDOFF_PAYLOAD_DIGEST,
    });
  });

  it("rejects an attestation that does not echo the requested challenge", async () => {
    const socketPath = await startPrincipalAttestationServerV1({
      responseChallenge: "e".repeat(64),
    });

    await expect(
      makeClientV1(socketPath).attestPrincipal("f".repeat(64)),
    ).rejects.toMatchObject({
      code: "challenge_mismatch",
    });
  });
});
