import { createHash, randomBytes } from "node:crypto";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import {
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  type ContentDigestV1,
} from "@understand-code/durable-object-provider-contracts/primitives";

import { DurableObjectProviderRuntimeServerV1 } from "../src/server.js";
import {
  createProviderServiceHandoffConfigV1,
  createProviderServiceReadinessReceiptV1,
  generateProviderServiceSigningKeyPairV1,
  verifyProviderRuntimeLiveServiceReadinessV1,
  type ProviderServiceHandoffConfigV1,
  type ProviderServiceReadinessResultV1,
} from "../src/index.js";
import { probeProviderRuntimeTargetV1 } from "../src/target-inspection.js";

const CAPABILITY = ContentDigestV1Schema.parse(`sha256:${"a".repeat(64)}`);
const TARGET = ContentDigestV1Schema.parse(`sha256:${"b".repeat(64)}`);
const PROVIDER = DurableObjectIdentityProviderIdV1Schema.parse(
  "durable-object-provider:live-readiness",
);
const roots = new Set<string>();
const servers = new Set<DurableObjectProviderRuntimeServerV1>();

async function executableDigestV1(path: string): Promise<ContentDigestV1> {
  return ContentDigestV1Schema.parse(
    `sha256:${createHash("sha256")
      .update(await readFile(path))
      .digest("hex")}`,
  );
}

afterEach(async () => {
  await Promise.all([...servers].map((server) => server.close()));
  servers.clear();
  await Promise.all([...roots].map((root) => rm(root, { recursive: true, force: true })));
  roots.clear();
});

async function fixtureV1(providerId = PROVIDER): Promise<{
  readonly root: string;
  readonly config: ProviderServiceHandoffConfigV1;
  readonly baseline: Awaited<ReturnType<typeof probeProviderRuntimeTargetV1>>;
  readonly key: Uint8Array;
  readonly signingKey: ReturnType<typeof generateProviderServiceSigningKeyPairV1>["privateKey"];
}> {
  const root = await mkdtemp(join(tmpdir(), "uc-live-readiness-"));
  roots.add(root);
  await chmod(root, 0o700);
  const keyPair = generateProviderServiceSigningKeyPairV1();
  const key = randomBytes(32);
  const config = createProviderServiceHandoffConfigV1({
    payload: {
      schemaVersion: 1,
      profile: "understand_code_provider_service_handoff_payload_v1",
      platform: process.platform === "darwin" ? "darwin" : "linux",
      serviceLabel: "uc-live-readiness",
      providerId,
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
      installationIdentityDigest: TARGET,
      binaryDigest: await executableDigestV1(process.execPath),
      capabilityDigest: CAPABILITY,
    },
    privateKey: keyPair.privateKey,
  });
  await writeFile(config.payload.authKeyPath, key, { mode: 0o600 });
  const baseline = await probeProviderRuntimeTargetV1(root);
  const server = new DurableObjectProviderRuntimeServerV1({
    rootPath: root,
    socketPath: config.payload.socketPath,
    providerId,
    authKey: key,
    authorizedCapabilityDigest: CAPABILITY,
  });
  await server.start();
  servers.add(server);
  const receipt = createProviderServiceReadinessReceiptV1({
    config,
    observedUid: process.getuid!(),
    observedGid: process.getgid!(),
    targetFingerprintDigest: ContentDigestV1Schema.parse(
      baseline.targetFingerprintDigest,
    ),
    nonce: Uint8Array.from([1, 2, 3]),
    privateKey: keyPair.privateKey,
  });
  await writeFile(config.payload.readinessPath, `${JSON.stringify(receipt)}\n`, {
    mode: 0o600,
  });
  return { root, config, baseline, key, signingKey: keyPair.privateKey };
}

describe("live provider service readiness verifier", () => {
  it("authenticates inspect_state and binds the signed receipt to target continuity", async () => {
    const fixture = await fixtureV1();
    await expect(
      verifyProviderRuntimeLiveServiceReadinessV1({
        config: fixture.config,
        targetBaseline: fixture.baseline,
        authKey: fixture.key,
        readinessReader: async () => ({
          status: "signed_candidate",
          authority: "read_only",
          strongWrites: "locked",
          platform: process.platform === "darwin" ? "darwin" : "linux",
          serviceLabel: fixture.config.payload.serviceLabel,
          providerId: PROVIDER,
          principalUid: fixture.config.payload.principal.uid,
          targetFingerprintDigest: ContentDigestV1Schema.parse(
            fixture.baseline.targetFingerprintDigest,
          ),
        } satisfies ProviderServiceReadinessResultV1),
      }),
    ).resolves.toEqual({
      status: "live_candidate",
      authority: "read_only",
      strongWrites: "locked",
      providerId: PROVIDER,
      targetFingerprintDigest: fixture.baseline.targetFingerprintDigest,
      binaryDigest: fixture.config.payload.binaryDigest,
      binaryIdentity: "verified",
      inspectedRevision: 0,
    });
  });

  it("rejects a live socket whose journal provider identity, signed target, or binary digest is wrong", async () => {
    const fixture = await fixtureV1();
    const wrongConfig = createProviderServiceHandoffConfigV1({
      payload: { ...fixture.config.payload, providerId: DurableObjectIdentityProviderIdV1Schema.parse("durable-object-provider:other") },
      privateKey: generateProviderServiceSigningKeyPairV1().privateKey,
    });
    await expect(
      verifyProviderRuntimeLiveServiceReadinessV1({
        config: wrongConfig,
        targetBaseline: fixture.baseline,
        authKey: fixture.key,
      }),
    ).resolves.toMatchObject({ status: "unavailable", reason: "provider_identity_mismatch" });

    const stale = createProviderServiceReadinessReceiptV1({
      config: fixture.config,
      observedUid: process.getuid!(),
      observedGid: process.getgid!(),
      targetFingerprintDigest: ContentDigestV1Schema.parse(`sha256:${"f".repeat(64)}`),
      nonce: Uint8Array.from([4, 5, 6]),
      privateKey: fixture.signingKey,
    });
    await writeFile(fixture.config.payload.readinessPath, `${JSON.stringify(stale)}\n`, {
      mode: 0o600,
    });
    await expect(
      verifyProviderRuntimeLiveServiceReadinessV1({
        config: fixture.config,
        targetBaseline: fixture.baseline,
        authKey: fixture.key,
        readinessReader: async () => ({
          status: "signed_candidate",
          authority: "read_only",
          strongWrites: "locked",
          platform: process.platform === "darwin" ? "darwin" : "linux",
          serviceLabel: fixture.config.payload.serviceLabel,
          providerId: PROVIDER,
          principalUid: fixture.config.payload.principal.uid,
          targetFingerprintDigest: ContentDigestV1Schema.parse(`sha256:${"f".repeat(64)}`),
        } satisfies ProviderServiceReadinessResultV1),
      }),
    ).resolves.toMatchObject({ status: "unavailable", reason: "readiness_stale" });

    const wrongBinaryConfig = createProviderServiceHandoffConfigV1({
      payload: {
        ...fixture.config.payload,
        binaryDigest: ContentDigestV1Schema.parse(`sha256:${"f".repeat(64)}`),
      },
      privateKey: fixture.signingKey,
    });
    await expect(
      verifyProviderRuntimeLiveServiceReadinessV1({
        config: wrongBinaryConfig,
        targetBaseline: fixture.baseline,
        authKey: fixture.key,
      }),
    ).resolves.toMatchObject({ status: "unavailable", reason: "binary_identity_mismatch" });
  });
});
