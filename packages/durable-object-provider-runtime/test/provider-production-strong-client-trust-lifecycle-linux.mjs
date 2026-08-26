import { generateKeyPairSync } from "node:crypto";
import { chmod, lstat, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createProviderServiceHandoffConfigV1,
  installProviderProductionStrongClientTrustV1,
  rollbackProviderProductionStrongClientTrustV1,
  rotateProviderProductionStrongClientTrustV1,
  uninstallProviderProductionStrongClientTrustV1,
} from "../dist/index.js";

if (process.platform !== "linux" || process.geteuid?.() !== 0) {
  throw new Error("production strong client trust lifecycle requires Linux root");
}

const root = await mkdtemp(join(tmpdir(), "uc-step15-strong-client-trust-"));
await chmod(root, 0o700);
const runtimeRoot = `${root}-runtime`;
const privateKey = generateKeyPairSync("ed25519").privateKey;
const servicePrincipal = { uid: 42001, gid: 42002 };
const callerPrincipal = { uid: 42003, gid: 42004 };
const config = createProviderServiceHandoffConfigV1({
  payload: {
    schemaVersion: 1,
    profile: "understand_code_provider_service_handoff_payload_v1",
    platform: "linux",
    serviceLabel: "understand-code-step15-trust-lifecycle",
    providerId: "durable-object-provider:step15-trust-lifecycle",
    principal: {
      kind: "dedicated_os_principal",
      name: "ucstep15runtime",
      ...servicePrincipal,
    },
    runtimeRoot,
    socketPath: join(runtimeRoot, "provider.sock"),
    executablePath: process.execPath,
    configPath: `${root}-provider-config.json`,
    authKeyPath: join(runtimeRoot, "auth.key"),
    readinessPath: join(runtimeRoot, "readiness.json"),
    signingKeyPath: join(runtimeRoot, "signing.key"),
    installationIdentityCustody: {
      keyPath: join(runtimeRoot, "installation-identity.key"),
      initializationNonce: "000102030405060708090a0b0c0d0e0f",
      installationIdentityGenerationId:
        "installation-identity-generation:4fe634940e20afac35e02d",
      keyCheckToken:
        "hmac-sha256:9b585cbb13d23ae739df3988278dfdc09ed612ccd8af853ac26f570bc8ce2eef",
    },
    installationIdentityDigest: `sha256:${"a".repeat(64)}`,
    binaryDigest: `sha256:${"b".repeat(64)}`,
    capabilityDigest: `sha256:${"c".repeat(64)}`,
  },
  privateKey,
});

const trust = (targetFingerprintDigest) => ({
  canonicalTargetRoot: `${root}-target`,
  targetProfileId: `provider-target-profile:${"d".repeat(64)}`,
  targetFingerprintDigest,
  acceptanceHistory: [{ generation: 1 }],
  currentAcceptance: { generation: 1 },
  registryHistory: { generation: 1 },
  grantKeyPath: join(runtimeRoot, "grant.pk8"),
  callerPrincipal,
});

let descriptorPath;
let gatewaySocketPath;
try {
  const installed = await installProviderProductionStrongClientTrustV1({
    canonicalInstallationRoot: root,
    serviceConfig: config,
    servicePrivateKey: privateKey,
    trust: trust(`sha256:${"e".repeat(64)}`),
  });
  descriptorPath = installed.descriptorPath;
  gatewaySocketPath = installed.gatewaySocketPath;
  const firstSnapshot = await readFile(installed.snapshotPath);
  const firstDescriptor = await readFile(installed.descriptorPath);
  const directory = await lstat(installed.gatewaySocketPath.slice(
    0,
    installed.gatewaySocketPath.lastIndexOf("/"),
  ));
  if (
    installed.status !== "installed" ||
    (directory.mode & 0o777) !== 0o710 ||
    directory.uid !== servicePrincipal.uid || directory.gid !== callerPrincipal.gid
  ) throw new Error("trust install projection failed");

  const rotated = await rotateProviderProductionStrongClientTrustV1({
    canonicalInstallationRoot: root,
    serviceConfig: config,
    servicePrivateKey: privateKey,
    trust: trust(`sha256:${"f".repeat(64)}`),
  });
  const rotatedSnapshot = await readFile(rotated.snapshotPath);
  if (rotatedSnapshot.equals(firstSnapshot)) {
    throw new Error("trust rotation did not replace the snapshot");
  }

  const rolledBack = await rollbackProviderProductionStrongClientTrustV1(root);
  if (
    rolledBack.status !== "rolled_back" ||
    !(await readFile(rolledBack.snapshotPath)).equals(firstSnapshot) ||
    !(await readFile(rolledBack.descriptorPath)).equals(firstDescriptor)
  ) throw new Error("trust rollback did not restore the exact prior files");

  const uninstalled = await uninstallProviderProductionStrongClientTrustV1(root);
  if (uninstalled.status !== "uninstalled") {
    throw new Error("trust uninstall failed");
  }
  for (const path of [uninstalled.snapshotPath, uninstalled.descriptorPath]) {
    try {
      await lstat(path);
      throw new Error("trust uninstall retained a managed path");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  process.stdout.write(`${JSON.stringify({
    profile: "provider_production_strong_client_trust_lifecycle_linux_v1",
    status: "verified",
    install: "verified",
    rotate: "verified",
    rollback: "verified",
    uninstall: "verified",
  })}\n`);
} finally {
  if (descriptorPath !== undefined) await rm(descriptorPath, { force: true });
  if (gatewaySocketPath !== undefined) {
    await rm(gatewaySocketPath.slice(0, gatewaySocketPath.lastIndexOf("/")), {
      recursive: true,
      force: true,
    });
  }
  await rm(root, { recursive: true, force: true });
  await rm(runtimeRoot, { recursive: true, force: true });
}
