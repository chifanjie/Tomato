import { createPrivateKey } from "node:crypto";
import {
  chmod,
  lstat,
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createProviderServiceHandoffConfigV1,
  installProviderProductionStrongClientTrustV1,
  providerProductionStrongClientDescriptorPathV1,
  providerProductionStrongClientGatewayDirectoryPathV1,
  rollbackProviderProductionStrongClientTrustV1,
  rotateProviderProductionStrongClientTrustV1,
  uninstallProviderProductionStrongClientTrustV1,
} from "../dist/index.js";

if (process.platform !== "linux" || process.geteuid?.() !== 0) {
  throw new Error("production strong client lifecycle crash test requires Linux root");
}

const self = new URL(import.meta.url).pathname;
const servicePrivateKey = createPrivateKey({
  key: Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    Buffer.from("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "hex"),
  ]),
  format: "der",
  type: "pkcs8",
});

function fixture(root, version) {
  const runtimeRoot = `${root}-runtime`;
  const config = createProviderServiceHandoffConfigV1({
    payload: {
      schemaVersion: 1,
      profile: "understand_code_provider_service_handoff_payload_v1",
      platform: "linux",
      serviceLabel: "understand-code-step15-trust-crash",
      providerId: "durable-object-provider:step15-trust-crash",
      principal: {
        kind: "dedicated_os_principal",
        name: "ucstep15runtime",
        uid: 42101,
        gid: 42102,
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
    privateKey: servicePrivateKey,
  });
  return {
    canonicalInstallationRoot: root,
    serviceConfig: config,
    servicePrivateKey,
    trust: {
      canonicalTargetRoot: `${root}-target`,
      targetProfileId: `provider-target-profile:${"d".repeat(64)}`,
      targetFingerprintDigest: `sha256:${
        version === "v1" ? "e".repeat(64) : version === "v2" ? "f".repeat(64) : "9".repeat(64)
      }`,
      acceptanceHistory: [{ generation: version }],
      currentAcceptance: { generation: version },
      registryHistory: { generation: version },
      grantKeyPath: join(runtimeRoot, "grant.pk8"),
      callerPrincipal: { uid: 42103, gid: 42104 },
    },
  };
}

if (process.argv[2] === "--worker") {
  const action = process.argv[3];
  const root = process.argv[4];
  const version = process.argv[5] ?? "v1";
  if (action === "install") {
    await installProviderProductionStrongClientTrustV1(fixture(root, version));
  } else if (action === "rotate") {
    await rotateProviderProductionStrongClientTrustV1(fixture(root, version));
  } else if (action === "rollback") {
    await rollbackProviderProductionStrongClientTrustV1(root);
  } else if (action === "uninstall") {
    await uninstallProviderProductionStrongClientTrustV1(root);
  } else {
    throw new Error("unknown lifecycle worker action");
  }
  process.exit(0);
}

function runWorker(action, root, version, crashPhase) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = spawnSync(process.execPath, [self, "--worker", action, root, version], {
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: crashPhase === undefined ? "production" : "test",
        ...(crashPhase === undefined
          ? {}
          : { PROVIDER_STRONG_CLIENT_LIFECYCLE_CRASH_PHASE_V1: crashPhase }),
      },
    });
    const busy = result.status !== 0 && /trust lifecycle is busy/u.test(result.stderr);
    if (busy) continue;
    if (crashPhase === undefined) {
      if (result.status !== 0) {
        throw new Error(`lifecycle worker failed: ${result.stderr}`);
      }
      return;
    }
    if (result.signal !== "SIGKILL") {
      throw new Error(`lifecycle phase ${crashPhase} did not crash at its durable cut: ${result.stderr}`);
    }
    return;
  }
  throw new Error(`lifecycle worker remained busy for ${action}/${crashPhase ?? "normal"}`);
}

async function assertVersion(root, version) {
  const snapshot = JSON.parse(await readFile(
    join(root, "provider-production-strong-client-trust-v1.json"),
    "utf8",
  ));
  const expected = `sha256:${
    version === "v1" ? "e".repeat(64) : version === "v2" ? "f".repeat(64) : "9".repeat(64)
  }`;
  if (snapshot.payload.targetFingerprintDigest !== expected) {
    throw new Error("recovered lifecycle snapshot version is invalid");
  }
  const descriptor = JSON.parse(await readFile(
    providerProductionStrongClientDescriptorPathV1(root),
    "utf8",
  ));
  if (descriptor.payload.trustSnapshotDigest === undefined) {
    throw new Error("recovered lifecycle descriptor is invalid");
  }
  for (const path of [
    join(root, ".provider-production-strong-client-trust-transaction-v1.json"),
    join(root, ".provider-production-strong-client-trust-transaction-v1.json.provider-production-strong-client-stage-v1"),
    join(root, "provider-production-strong-client-trust-v1.json.provider-production-strong-client-stage-v1"),
    `${providerProductionStrongClientDescriptorPathV1(root)}.provider-production-strong-client-stage-v1`,
  ]) {
    try {
      await lstat(path);
      throw new Error("recovery retained lifecycle transaction/stage state");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

function runParallelWorker(action, root, version) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [self, "--worker", action, root, version], {
      env: { ...process.env, NODE_ENV: "production" },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("close", (status, signal) => resolvePromise({ status, signal, stderr }));
  });
}

async function snapshotVersion(root) {
  const snapshot = JSON.parse(await readFile(
    join(root, "provider-production-strong-client-trust-v1.json"),
    "utf8",
  ));
  return snapshot.payload.currentAcceptance.generation;
}

const phaseMatrix = {
  install: ["prepared", "gateway_directory_durable", "snapshot_durable", "descriptor_durable", "completed"],
  rotate: ["prepared", "gateway_directory_durable", "rollback_durable", "snapshot_durable", "descriptor_durable", "completed"],
  rollback: ["prepared", "gateway_directory_durable", "snapshot_durable", "descriptor_durable", "completed"],
  uninstall: ["prepared", "descriptor_removed", "rollback_removed", "snapshot_removed", "gateway_directory_removed", "completed"],
};

let verifiedCuts = 0;
for (const [action, phases] of Object.entries(phaseMatrix)) {
  for (const phase of phases) {
    const root = await mkdtemp(join(tmpdir(), `uc-step15-trust-${action}-`));
    await chmod(root, 0o700);
    try {
      if (action !== "install") runWorker("install", root, "v1");
      if (action === "rollback" || action === "uninstall") {
        runWorker("rotate", root, "v2");
      }
      runWorker(action, root, action === "rotate" ? "v2" : "v1", phase);
      runWorker(action, root, action === "rotate" ? "v2" : "v1");
      if (action === "uninstall") {
        for (const path of [
          join(root, "provider-production-strong-client-trust-v1.json"),
          providerProductionStrongClientDescriptorPathV1(root),
          providerProductionStrongClientGatewayDirectoryPathV1(root),
        ]) {
          try {
            await lstat(path);
            throw new Error("uninstall recovery retained managed state");
          } catch (error) {
            if (error?.code !== "ENOENT") throw error;
          }
        }
      } else {
        await assertVersion(root, action === "rotate" ? "v2" : "v1");
        runWorker("uninstall", root, "v1");
      }
      verifiedCuts += 1;
    } finally {
      await rm(providerProductionStrongClientDescriptorPathV1(root), { force: true });
      await rm(providerProductionStrongClientGatewayDirectoryPathV1(root), {
        recursive: true,
        force: true,
      });
      await rm(root, { recursive: true, force: true });
      await rm(`${root}-runtime`, { recursive: true, force: true });
    }
  }
}

let rejectedForeignDirectories = 0;
for (const mode of [0o755, 0o700]) {
  const root = await mkdtemp(join(tmpdir(), "uc-step15-trust-foreign-dir-"));
  await chmod(root, 0o700);
  const gatewayDirectory = providerProductionStrongClientGatewayDirectoryPathV1(root);
  try {
    await import("node:fs/promises").then(({ mkdir }) => mkdir(gatewayDirectory, { mode }));
    await chmod(gatewayDirectory, mode);
    const result = spawnSync(process.execPath, [self, "--worker", "install", root, "v1"], {
      encoding: "utf8",
      env: { ...process.env, NODE_ENV: "production" },
    });
    const after = await lstat(gatewayDirectory);
    if (result.status === 0 || after.uid !== 0 || (after.mode & 0o777) !== mode) {
      throw new Error("foreign gateway directory was adopted or repaired");
    }
    rejectedForeignDirectories += 1;
  } finally {
    await rm(providerProductionStrongClientDescriptorPathV1(root), { force: true });
    await rm(gatewayDirectory, { recursive: true, force: true });
    await rm(root, { recursive: true, force: true });
  }
}

const rotateRaceRoot = await mkdtemp(join(tmpdir(), "uc-step15-trust-rotate-race-"));
await chmod(rotateRaceRoot, 0o700);
let rotateRaceVerified = false;
try {
  runWorker("install", rotateRaceRoot, "v1");
  const [left, right] = await Promise.all([
    runParallelWorker("rotate", rotateRaceRoot, "v2"),
    runParallelWorker("rotate", rotateRaceRoot, "v3"),
  ]);
  const successful = [left, right].filter((result) => result.status === 0).length;
  if (successful < 1 || successful > 2) throw new Error("rotate race was not serialized");
  const finalVersion = await snapshotVersion(rotateRaceRoot);
  runWorker("rollback", rotateRaceRoot, "v1");
  const predecessorVersion = await snapshotVersion(rotateRaceRoot);
  const expectedPredecessor = successful === 2
    ? (finalVersion === "v2" ? "v3" : "v2")
    : "v1";
  if (predecessorVersion !== expectedPredecessor) {
    throw new Error("rotate rollback did not preserve the direct predecessor");
  }
  runWorker("uninstall", rotateRaceRoot, "v1");
  rotateRaceVerified = true;
} finally {
  await rm(providerProductionStrongClientDescriptorPathV1(rotateRaceRoot), { force: true });
  await rm(providerProductionStrongClientGatewayDirectoryPathV1(rotateRaceRoot), { recursive: true, force: true });
  await rm(rotateRaceRoot, { recursive: true, force: true });
  await rm(`${rotateRaceRoot}-runtime`, { recursive: true, force: true });
}

const uninstallRaceRoot = await mkdtemp(join(tmpdir(), "uc-step15-trust-uninstall-race-"));
await chmod(uninstallRaceRoot, 0o700);
let uninstallRaceVerified = false;
try {
  runWorker("install", uninstallRaceRoot, "v1");
  await Promise.all([
    runParallelWorker("rotate", uninstallRaceRoot, "v2"),
    runParallelWorker("uninstall", uninstallRaceRoot, "v1"),
  ]);
  try {
    await lstat(providerProductionStrongClientDescriptorPathV1(uninstallRaceRoot));
    runWorker("uninstall", uninstallRaceRoot, "v1");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  try {
    await lstat(providerProductionStrongClientDescriptorPathV1(uninstallRaceRoot));
    throw new Error("rotate/uninstall race retained an active descriptor");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  uninstallRaceVerified = true;
} finally {
  await rm(providerProductionStrongClientDescriptorPathV1(uninstallRaceRoot), { force: true });
  await rm(providerProductionStrongClientGatewayDirectoryPathV1(uninstallRaceRoot), { recursive: true, force: true });
  await rm(uninstallRaceRoot, { recursive: true, force: true });
  await rm(`${uninstallRaceRoot}-runtime`, { recursive: true, force: true });
}

process.stdout.write(`${JSON.stringify({
  profile: "provider_production_strong_client_trust_lifecycle_crash_linux_v1",
  status: "verified",
  verifiedCuts,
  noReplace: "hard_link_no_replace",
  recovery: "reinvoke_converged",
  rejectedForeignDirectories,
  rotateRaceVerified,
  uninstallRaceVerified,
})}\n`);
