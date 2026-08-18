import { randomBytes } from "node:crypto";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import {
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
} from "@understand-code/durable-object-provider-contracts/primitives";

import { verifyProviderRuntimeLivePrincipalChallengeV1 } from "../src/live-principal-challenge.js";
import { DurableObjectProviderRuntimeServerV1 } from "../src/server.js";
import {
  createProviderServiceHandoffConfigV1,
  generateProviderServiceSigningKeyPairV1,
  type ProviderServiceHandoffConfigV1,
} from "../src/service-handoff.js";

const PROVIDER_ID = DurableObjectIdentityProviderIdV1Schema.parse(
  "durable-object-provider:principal-live-test",
);
const CAPABILITY_DIGEST = ContentDigestV1Schema.parse(
  `sha256:${"a".repeat(64)}`,
);
const INSTALLATION_DIGEST = ContentDigestV1Schema.parse(
  `sha256:${"b".repeat(64)}`,
);
const BINARY_DIGEST = ContentDigestV1Schema.parse(
  `sha256:${"c".repeat(64)}`,
);

const roots = new Set<string>();
const servers = new Set<DurableObjectProviderRuntimeServerV1>();

afterEach(async () => {
  await Promise.all([...servers].map((server) => server.close()));
  servers.clear();
  await Promise.all([...roots].map((root) => rm(root, { recursive: true, force: true })));
  roots.clear();
});

async function fixtureV1(): Promise<{
  readonly config: ProviderServiceHandoffConfigV1;
  readonly server: DurableObjectProviderRuntimeServerV1;
}> {
  const root = await mkdtemp(join(tmpdir(), "uc-principal-live-"));
  roots.add(root);
  await chmod(root, 0o700);
  const signing = generateProviderServiceSigningKeyPairV1();
  const config = createProviderServiceHandoffConfigV1({
    privateKey: signing.privateKey,
    payload: {
      schemaVersion: 1,
      profile: "understand_code_provider_service_handoff_payload_v1",
      platform: process.platform === "darwin" ? "darwin" : "linux",
      serviceLabel: "uc-principal-live-test",
      providerId: PROVIDER_ID,
      principal: {
        kind: "dedicated_os_principal",
        name: "ucprovider",
        uid: process.getuid!(),
        gid: process.getgid!(),
      },
      runtimeRoot: root,
      socketPath: join(root, "runtime.sock"),
      executablePath: process.execPath,
      configPath: join(root, "service.json"),
      authKeyPath: join(root, "auth.key"),
      readinessPath: join(root, "readiness.json"),
      signingKeyPath: join(root, "signing.key"),
      installationIdentityDigest: INSTALLATION_DIGEST,
      binaryDigest: BINARY_DIGEST,
      capabilityDigest: CAPABILITY_DIGEST,
    },
  });
  const server = new DurableObjectProviderRuntimeServerV1({
    rootPath: root,
    socketPath: config.payload.socketPath,
    providerId: PROVIDER_ID,
    authKey: randomBytes(32),
    authorizedCapabilityDigest: CAPABILITY_DIGEST,
    principalAttestation: {
      privateKey: signing.privateKey,
      handoffPayloadDigest: config.payloadDigest,
      publicKey: config.publicKey,
    },
  });
  await server.start();
  servers.add(server);
  return { config, server };
}

describe("live provider principal challenge", () => {
  it("proves the signed handoff key is live without reading the HMAC key", async () => {
    const { config } = await fixtureV1();

    await expect(
      verifyProviderRuntimeLivePrincipalChallengeV1({
        config,
        expectedJournalRevision: 0,
        expectedJournalPhase: "uninitialized",
        expectedJournalMutationDigest: "none",
        expectedInstallationIdentityDigest: INSTALLATION_DIGEST,
      }),
    ).resolves.toEqual({
      status: "principal_key_live_candidate",
      authority: "none",
      accessMode: "read_only",
      strongWriteStatus: "locked",
      requiredNext: "kernel_os_peer_and_acceptance_token_gate",
      bindings: {
        providerId: PROVIDER_ID,
        capabilityDigest: CAPABILITY_DIGEST,
        handoffPayloadDigest: config.payloadDigest,
        servicePublicKey: config.publicKey,
        journalRevision: 0,
        journalPhase: "uninitialized",
        journalMutationDigest: "none",
      },
    });
  });

  it("rejects a different signed key and a different journal head", async () => {
    const { config } = await fixtureV1();
    const wrongSigning = generateProviderServiceSigningKeyPairV1();
    const wrongKeyConfig = createProviderServiceHandoffConfigV1({
      privateKey: wrongSigning.privateKey,
      payload: config.payload,
    });

    await expect(
      verifyProviderRuntimeLivePrincipalChallengeV1({
        config: wrongKeyConfig,
        expectedJournalRevision: 0,
        expectedJournalPhase: "uninitialized",
        expectedJournalMutationDigest: "none",
      }),
    ).resolves.toMatchObject({
      status: "unavailable",
      reason: "signature_invalid",
      strongWriteStatus: "locked",
    });

    await expect(
      verifyProviderRuntimeLivePrincipalChallengeV1({
        config,
        expectedJournalRevision: 0,
        expectedJournalPhase: "final_strong_ready",
        expectedJournalMutationDigest: "none",
      }),
    ).resolves.toMatchObject({
      status: "unavailable",
      reason: "binding_mismatch",
      strongWriteStatus: "locked",
    });
  });
});
