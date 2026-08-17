import { generateKeyPairSync } from "node:crypto";
import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createProviderServiceHandoffConfigV1,
  createProviderServiceReadinessReceiptV1,
  generateProviderServiceSigningKeyPairV1,
  inspectProviderServiceHandoffV1,
  provisionProviderServiceHandoffV1,
  readProviderServiceReadinessV1,
  renderProviderServiceDescriptorV1,
  verifyProviderServiceHandoffConfigV1,
  type ProviderServiceHandoffPayloadV1,
} from "../src/index.js";
import {
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
} from "@understand-code/durable-object-provider-contracts/primitives";

const INSTALLATION_DIGEST = ContentDigestV1Schema.parse(
  `sha256:${"a".repeat(64)}`,
);
const BINARY_DIGEST = ContentDigestV1Schema.parse(`sha256:${"b".repeat(64)}`);
const TARGET_DIGEST = ContentDigestV1Schema.parse(`sha256:${"c".repeat(64)}`);
const CAPABILITY_DIGEST = ContentDigestV1Schema.parse(
  `sha256:${"d".repeat(64)}`,
);
const PROVIDER_ID = DurableObjectIdentityProviderIdV1Schema.parse(
  "durable-object-provider:local-helper",
);

function principalV1(): { kind: "dedicated_os_principal"; name: string; uid: number; gid: number } {
  const uid = typeof process.getuid === "function" ? process.getuid() : 501;
  const gid = typeof process.getgid === "function" ? process.getgid() : uid;
  return {
    kind: "dedicated_os_principal",
    name: "ucprovider",
    uid: uid > 0 ? uid : 501,
    gid: gid > 0 ? gid : 501,
  };
}

function payloadV1(
  platform: "darwin" | "linux",
  readinessPath?: string,
  runtimeRoot = "/var/lib/understand-code/provider",
): ProviderServiceHandoffPayloadV1 {
  return {
    schemaVersion: 1,
    profile: "understand_code_provider_service_handoff_payload_v1",
    platform,
    serviceLabel: "com.openai.understand-code.provider",
    providerId: PROVIDER_ID,
    principal: principalV1(),
    runtimeRoot,
    socketPath: join(runtimeRoot, "provider.sock"),
    executablePath: "/opt/understand-code/bin/provider-runtime",
    configPath: "/etc/understand-code/provider.json",
    authKeyPath: join(runtimeRoot, "auth.key"),
    readinessPath: readinessPath ?? join(runtimeRoot, "readiness.json"),
    signingKeyPath: join(runtimeRoot, "readiness.key"),
    installationIdentityDigest: INSTALLATION_DIGEST,
    binaryDigest: BINARY_DIGEST,
    capabilityDigest: CAPABILITY_DIGEST,
  };
}

describe("provider service handoff", () => {
  it("signs identity-bound config and renders strict launchd/systemd descriptors", async () => {
    const keyPair = generateProviderServiceSigningKeyPairV1();
    const config = createProviderServiceHandoffConfigV1({
      payload: payloadV1("darwin"),
      privateKey: keyPair.privateKey,
    });

    expect(
      verifyProviderServiceHandoffConfigV1(config, INSTALLATION_DIGEST).payload
        .serviceLabel,
    ).toBe("com.openai.understand-code.provider");
    const launchd = renderProviderServiceDescriptorV1(config);
    expect(launchd.format).toBe("launchd_plist");
    expect(launchd.descriptor).toContain("<key>UserName</key>");
    expect(launchd.descriptor).toContain("--service-config");
    await expect(
      inspectProviderServiceHandoffV1({ config }),
    ).resolves.toMatchObject({
      status: "valid_unprovisioned",
      authority: "read_only",
      strongWrites: "locked",
      descriptorFormat: "launchd_plist",
    });

    const linuxConfig = createProviderServiceHandoffConfigV1({
      payload: payloadV1("linux"),
      privateKey: keyPair.privateKey,
    });
    const systemd = renderProviderServiceDescriptorV1(linuxConfig);
    expect(systemd.format).toBe("systemd_unit");
    expect(systemd.descriptor).toContain("NoNewPrivileges=true");
    expect(systemd.descriptor).toContain("ProtectSystem=strict");

    expect(() =>
      verifyProviderServiceHandoffConfigV1(
        {
          ...config,
          payload: { ...config.payload, serviceLabel: "tampered" },
        },
        INSTALLATION_DIGEST,
      ),
    ).toThrowError(/signature|digest/u);
    expect(() =>
      createProviderServiceHandoffConfigV1({
        payload: {
          ...payloadV1("linux"),
          socketPath: "/var/run/understand-code/provider.sock",
        },
        privateKey: keyPair.privateKey,
      }),
    ).toThrowError(/direct child/u);
  });

  it("checks a principal-owned signed readiness receipt and keeps same-UID claims locked", async () => {
    const keyPair = generateProviderServiceSigningKeyPairV1();
    const root = await mkdtemp(join(tmpdir(), "uc-service-handoff-"));
    const readinessPath = join(root, "ready.json");
    const config = createProviderServiceHandoffConfigV1({
      payload: payloadV1(
        process.platform === "linux" ? "linux" : "darwin",
        readinessPath,
        root,
      ),
      privateKey: keyPair.privateKey,
    });
    const uid = config.payload.principal.uid;
    const gid = config.payload.principal.gid;
    const receipt = createProviderServiceReadinessReceiptV1({
      config,
      observedUid: uid,
      observedGid: gid,
      targetFingerprintDigest: TARGET_DIGEST,
      nonce: Uint8Array.from([1, 2, 3, 4]),
      privateKey: keyPair.privateKey,
    });
    expect(receipt.payload.handoffPayloadDigest).toBe(config.payloadDigest);
    await writeFile(readinessPath, `${JSON.stringify(receipt)}\n`, {
      mode: 0o600,
    });
    await chmod(readinessPath, 0o600);
    const readiness = await readProviderServiceReadinessV1({
      config,
      readinessPath,
      expectedInstallationIdentityDigest: INSTALLATION_DIGEST,
    });
    expect(readiness).toMatchObject({
      status: "unavailable",
      authority: "read_only",
      strongWrites: "locked",
      reason: "principal_mismatch",
    });
    const wrongPath = await readProviderServiceReadinessV1({
      config,
      readinessPath: join(root, "different-ready.json"),
    });
    expect(wrongPath).toMatchObject({
      status: "unavailable",
      authority: "read_only",
      strongWrites: "locked",
      reason: "attestation_invalid",
    });
  });

  it("provisions principal-owned runtime keys in a private direct-child namespace", async () => {
    const keyPair = generateProviderServiceSigningKeyPairV1();
    const root = await mkdtemp(join(tmpdir(), "uc-service-provision-"));
    const runtimeRoot = join(root, "runtime");
    const actualUid = typeof process.getuid === "function" ? process.getuid() : 501;
    const actualGid = typeof process.getgid === "function" ? process.getgid() : 501;
    const principalUid = actualUid > 0 ? actualUid : 501;
    const principalGid = actualGid > 0 ? actualGid : 501;
    const config = createProviderServiceHandoffConfigV1({
      payload: {
        ...payloadV1(
          process.platform === "linux" ? "linux" : "darwin",
          join(runtimeRoot, "readiness.json"),
          runtimeRoot,
        ),
        principal: {
          kind: "dedicated_os_principal",
          name: "ucprovider",
          uid: principalUid,
          gid: principalGid,
        },
        executablePath: process.execPath,
        configPath: join(root, "provider.json"),
      },
      privateKey: keyPair.privateKey,
    });
    const originalGetuid = process.getuid;
    if (actualUid !== 0) {
      Object.defineProperty(process, "getuid", {
        configurable: true,
        value: () => 0,
      });
    }
    try {
      await expect(
        provisionProviderServiceHandoffV1({
          config,
          privateKey: keyPair.privateKey,
          descriptorPath: join(root, "provider.service"),
        }),
      ).resolves.toMatchObject({
        status: "provisioned",
        authority: "read_only",
        strongWrites: "locked",
      });
    } finally {
      if (actualUid !== 0) {
        Object.defineProperty(process, "getuid", {
          configurable: true,
          value: originalGetuid,
        });
      }
    }
    const [runtimeMetadata, authMetadata, signingMetadata, authKey] =
      await Promise.all([
        stat(runtimeRoot),
        stat(config.payload.authKeyPath),
        stat(config.payload.signingKeyPath),
        readFile(config.payload.authKeyPath),
      ]);
    expect(runtimeMetadata.mode & 0o777).toBe(0o700);
    expect(runtimeMetadata.uid).toBe(principalUid);
    expect(runtimeMetadata.gid).toBe(principalGid);
    expect(authMetadata.mode & 0o777).toBe(0o600);
    expect(authMetadata.uid).toBe(principalUid);
    expect(authMetadata.gid).toBe(principalGid);
    expect(signingMetadata.mode & 0o777).toBe(0o600);
    expect(signingMetadata.uid).toBe(principalUid);
    expect(signingMetadata.gid).toBe(principalGid);
    expect(authKey).toHaveLength(32);
    await rm(root, { recursive: true, force: true });
  });

  it("fails closed for missing readiness and non-root provisioning", async () => {
    const keyPair = generateKeyPairSync("ed25519");
    const root = await mkdtemp(join(tmpdir(), "uc-service-handoff-missing-"));
    const readinessPath = join(root, "missing.json");
    const config = createProviderServiceHandoffConfigV1({
      payload: payloadV1(
        process.platform === "linux" ? "linux" : "darwin",
        readinessPath,
        root,
      ),
      privateKey: keyPair.privateKey,
    });
    const readiness = await readProviderServiceReadinessV1({
      config,
      readinessPath,
    });
    expect(readiness).toMatchObject({
      status: "unavailable",
      authority: "read_only",
      strongWrites: "locked",
      reason: "service_not_provisioned",
    });
    if (typeof process.getuid === "function" && process.getuid() !== 0) {
      await expect(
        provisionProviderServiceHandoffV1({
          config,
          privateKey: keyPair.privateKey,
          descriptorPath: join(root, "provider.service"),
        }),
      ).rejects.toMatchObject({ code: "non_root_provisioning_forbidden" });
      await expect(readFile(join(root, "provider.service"))).rejects.toMatchObject({
        code: "ENOENT",
      });
    }
  });
});
