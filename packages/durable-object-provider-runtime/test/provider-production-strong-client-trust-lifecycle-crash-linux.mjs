import { createPrivateKey } from "node:crypto";
import {
  chmod,
  lstat,
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createProviderServiceHandoffConfigV1,
  installProviderProductionStrongClientTrustV1,
  providerProductionStrongClientDescriptorPathV1,
  providerProductionStrongClientGatewayDirectoryPathV1,
  providerProductionStrongClientGatewaySocketPathV1,
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
        version.endsWith("v1") ? "e".repeat(64) : version.endsWith("v2") ? "f".repeat(64) : "9".repeat(64)
      }`,
      acceptanceHistory: [{ generation: version }],
      currentAcceptance: { generation: version },
      registryHistory: {
        generation: version,
        ...(version.startsWith("large-") ? { padding: "x".repeat(17 * 1024 * 1024) } : {}),
      },
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

function spawnWorkerAsync(action, root, version, crashPhase) {
  return new Promise((resolvePromise, rejectPromise) => {
    let child;
    try {
      child = spawn(process.execPath, [self, "--worker", action, root, version], {
        env: {
          ...process.env,
          NODE_ENV: crashPhase === undefined ? "production" : "test",
          ...(crashPhase === undefined
            ? {}
            : { PROVIDER_STRONG_CLIENT_LIFECYCLE_CRASH_PHASE_V1: crashPhase }),
        },
        stdio: ["ignore", "ignore", "pipe"],
      });
    } catch (error) {
      rejectPromise(error);
      return;
    }
    let stderr = "";
    let settled = false;
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", (error) => {
      if (!settled) {
        settled = true;
        rejectPromise(error);
      }
    });
    child.once("close", (status, signal) => {
      if (settled) return;
      settled = true;
      resolvePromise({ status, signal, stderr });
    });
  });
}

async function runWorkerAsync(action, root, version, crashPhase) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = await spawnWorkerAsync(action, root, version, crashPhase);
    const busy = result.status !== 0 && /trust lifecycle is busy/u.test(result.stderr);
    if (busy) {
      // Let another phase case make progress before retrying this root.  The
      // lock is per installation root, so this does not alter serialization.
      await new Promise((resolvePromise) => setImmediate(resolvePromise));
      continue;
    }
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

function runWorkerExpectStoppedGatewayRefusal(root) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = spawnSync(process.execPath, [self, "--worker", "uninstall", root, "v1"], {
      encoding: "utf8",
      env: { ...process.env, NODE_ENV: "production" },
    });
    if (result.status !== 0 && /trust lifecycle is busy/u.test(result.stderr)) {
      continue;
    }
    if (
      result.status !== 0 &&
      /gateway must be stopped before uninstall/u.test(result.stderr)
    ) return;
    throw new Error(`live gateway uninstall was not refused: ${result.stderr}`);
  }
  throw new Error("lifecycle worker remained busy during live gateway refusal");
}

async function listenGateway(socketPath) {
  const server = createServer();
  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(socketPath, resolvePromise);
  });
  return server;
}

async function stopGateway(server, socketPath) {
  await new Promise((resolvePromise, rejectPromise) => {
    server.close((error) => error === undefined ? resolvePromise() : rejectPromise(error));
  });
  await rm(socketPath, { force: true });
}

async function assertMissing(path, message) {
  try {
    await lstat(path);
    throw new Error(message);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function assertVersion(root, version) {
  const snapshot = JSON.parse(await readFile(
    join(root, "provider-production-strong-client-trust-v1.json"),
    "utf8",
  ));
  const expected = `sha256:${
    version.endsWith("v1") ? "e".repeat(64) : version.endsWith("v2") ? "f".repeat(64) : "9".repeat(64)
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
  install: ["transaction_snapshot_staged", "transaction_descriptor_staged", "prepared", "gateway_directory_durable", "snapshot_durable", "descriptor_durable", "completed", "transaction_snapshot_cleaned", "transaction_descriptor_cleaned"],
  rotate: ["transaction_snapshot_staged", "transaction_descriptor_staged", "transaction_rollback_staged", "transaction_rollback_descriptor_staged", "prepared", "gateway_directory_durable", "rollback_durable", "snapshot_durable", "descriptor_durable", "completed", "transaction_snapshot_cleaned", "transaction_descriptor_cleaned", "transaction_rollback_cleaned", "transaction_rollback_descriptor_cleaned"],
  rollback: ["transaction_snapshot_staged", "transaction_descriptor_staged", "prepared", "gateway_directory_durable", "snapshot_durable", "descriptor_durable", "completed", "transaction_snapshot_cleaned", "transaction_descriptor_cleaned"],
  uninstall: ["prepared", "descriptor_removed", "rollback_removed", "rollback_snapshot_removed", "rollback_descriptor_removed", "snapshot_removed", "gateway_directory_removed", "completed"],
};

let verifiedCuts = 0;

async function runCrashPhaseCase(action, phase) {
  const root = await mkdtemp(join(tmpdir(), `uc-step15-trust-${action}-`));
  await chmod(root, 0o700);
  try {
    if (action !== "install") await runWorkerAsync("install", root, "v1");
    if (action === "rollback" || action === "uninstall") {
      await runWorkerAsync("rotate", root, "v2");
    }
    await runWorkerAsync(action, root, action === "rotate" ? "v2" : "v1", phase);
    await runWorkerAsync(action, root, action === "rotate" ? "v2" : "v1");
    if (action === "uninstall") {
      for (const path of [
        join(root, "provider-production-strong-client-trust-v1.json"),
        providerProductionStrongClientDescriptorPathV1(root),
        providerProductionStrongClientGatewayDirectoryPathV1(root),
        join(root, ".provider-production-strong-client-trust-rollback-v1.json"),
        join(root, ".provider-production-strong-client-trust-rollback-v1.json.snapshot"),
        join(root, ".provider-production-strong-client-trust-rollback-v1.json.descriptor"),
        ...["", ".snapshot", ".descriptor", ".rollback", ".rollback-descriptor"].map(
          (suffix) => join(root, `.provider-production-strong-client-trust-transaction-v1.json${suffix}`),
        ),
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
      await runWorkerAsync("uninstall", root, "v1");
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

const phaseCases = Object.entries(phaseMatrix).flatMap(([action, phases]) =>
  phases.map((phase) => ({ action, phase })));
// Each case uses a private installation root and keeps its own lifecycle
// operations serialized.  A small pool removes avoidable Node-process startup
// latency while retaining every crash cut and post-restart assertion.
const phaseConcurrency = Math.min(4, phaseCases.length);
let nextPhaseCase = 0;
const phaseWorkers = Array.from({ length: phaseConcurrency }, async () => {
  while (true) {
    const index = nextPhaseCase;
    nextPhaseCase += 1;
    if (index >= phaseCases.length) return;
    const { action, phase } = phaseCases[index];
    await runCrashPhaseCase(action, phase);
  }
});
const phaseOutcomes = await Promise.allSettled(phaseWorkers);
const failedPhase = phaseOutcomes.find((outcome) => outcome.status === "rejected");
if (failedPhase?.status === "rejected") throw failedPhase.reason;

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

const transactionFile = ".provider-production-strong-client-trust-transaction-v1.json";
const liveGatewayRoot = await mkdtemp(join(tmpdir(), "uc-step15-trust-live-gateway-"));
await chmod(liveGatewayRoot, 0o700);
let liveGatewayUninstallVerified = false;
let liveGatewayServer;
try {
  runWorker("install", liveGatewayRoot, "v1");
  runWorker("rotate", liveGatewayRoot, "v2");
  const snapshotPath = join(liveGatewayRoot, "provider-production-strong-client-trust-v1.json");
  const descriptorPath = providerProductionStrongClientDescriptorPathV1(liveGatewayRoot);
  const rollbackPath = join(liveGatewayRoot, ".provider-production-strong-client-trust-rollback-v1.json");
  const socketPath = providerProductionStrongClientGatewaySocketPathV1(liveGatewayRoot);
  const [snapshotBefore, descriptorBefore, rollbackBefore] = await Promise.all([
    readFile(snapshotPath),
    readFile(descriptorPath),
    readFile(rollbackPath),
  ]);
  liveGatewayServer = await listenGateway(socketPath);
  runWorkerExpectStoppedGatewayRefusal(liveGatewayRoot);
  const [snapshotAfter, descriptorAfter, rollbackAfter] = await Promise.all([
    readFile(snapshotPath),
    readFile(descriptorPath),
    readFile(rollbackPath),
  ]);
  if (
    !snapshotAfter.equals(snapshotBefore) ||
    !descriptorAfter.equals(descriptorBefore) ||
    !rollbackAfter.equals(rollbackBefore)
  ) throw new Error("live gateway refusal changed managed trust bytes");
  await assertMissing(
    join(liveGatewayRoot, transactionFile),
    "live gateway refusal created an uninstall transaction",
  );
  await stopGateway(liveGatewayServer, socketPath);
  liveGatewayServer = undefined;
  runWorker("uninstall", liveGatewayRoot, "v1");
  liveGatewayUninstallVerified = true;
} finally {
  if (liveGatewayServer !== undefined) {
    await stopGateway(
      liveGatewayServer,
      providerProductionStrongClientGatewaySocketPathV1(liveGatewayRoot),
    );
  }
  await rm(providerProductionStrongClientDescriptorPathV1(liveGatewayRoot), { force: true });
  await rm(providerProductionStrongClientGatewayDirectoryPathV1(liveGatewayRoot), { recursive: true, force: true });
  await rm(liveGatewayRoot, { recursive: true, force: true });
  await rm(`${liveGatewayRoot}-runtime`, { recursive: true, force: true });
}

const partialUninstallRoot = await mkdtemp(join(tmpdir(), "uc-step15-trust-partial-uninstall-"));
await chmod(partialUninstallRoot, 0o700);
let partialUninstallLiveGatewayVerified = false;
let partialGatewayServer;
try {
  runWorker("install", partialUninstallRoot, "v1");
  runWorker("rotate", partialUninstallRoot, "v2");
  runWorker("uninstall", partialUninstallRoot, "v1", "descriptor_removed");
  const snapshotPath = join(partialUninstallRoot, "provider-production-strong-client-trust-v1.json");
  const descriptorPath = providerProductionStrongClientDescriptorPathV1(partialUninstallRoot);
  const rollbackPath = join(partialUninstallRoot, ".provider-production-strong-client-trust-rollback-v1.json");
  const journalPath = join(partialUninstallRoot, transactionFile);
  const socketPath = providerProductionStrongClientGatewaySocketPathV1(partialUninstallRoot);
  const [snapshotBefore, rollbackBefore, journalBefore] = await Promise.all([
    readFile(snapshotPath),
    readFile(rollbackPath),
    readFile(journalPath),
  ]);
  await assertMissing(descriptorPath, "partial uninstall retained its removed descriptor");
  partialGatewayServer = await listenGateway(socketPath);
  runWorkerExpectStoppedGatewayRefusal(partialUninstallRoot);
  const [snapshotAfter, rollbackAfter, journalAfter] = await Promise.all([
    readFile(snapshotPath),
    readFile(rollbackPath),
    readFile(journalPath),
  ]);
  if (
    !snapshotAfter.equals(snapshotBefore) ||
    !rollbackAfter.equals(rollbackBefore) ||
    !journalAfter.equals(journalBefore)
  ) throw new Error("live gateway advanced a partial uninstall transaction");
  await assertMissing(descriptorPath, "partial uninstall recreated its descriptor");
  await stopGateway(partialGatewayServer, socketPath);
  partialGatewayServer = undefined;
  runWorker("uninstall", partialUninstallRoot, "v1");
  for (const path of [snapshotPath, descriptorPath, rollbackPath, journalPath]) {
    await assertMissing(path, "stopped-gateway recovery retained uninstall state");
  }
  partialUninstallLiveGatewayVerified = true;
} finally {
  if (partialGatewayServer !== undefined) {
    await stopGateway(
      partialGatewayServer,
      providerProductionStrongClientGatewaySocketPathV1(partialUninstallRoot),
    );
  }
  await rm(providerProductionStrongClientDescriptorPathV1(partialUninstallRoot), { force: true });
  await rm(providerProductionStrongClientGatewayDirectoryPathV1(partialUninstallRoot), { recursive: true, force: true });
  await rm(partialUninstallRoot, { recursive: true, force: true });
  await rm(`${partialUninstallRoot}-runtime`, { recursive: true, force: true });
}

const largeLifecycleRoot = await mkdtemp(join(tmpdir(), "uc-step15-trust-large-"));
await chmod(largeLifecycleRoot, 0o700);
let largeLifecycleVerified = false;
try {
  runWorker("install", largeLifecycleRoot, "large-v1");
  const largeSnapshotPath = join(largeLifecycleRoot, "provider-production-strong-client-trust-v1.json");
  if ((await lstat(largeSnapshotPath)).size <= 16 * 1024 * 1024) {
    throw new Error("large lifecycle fixture did not cross the legacy 16 MiB cap");
  }
  runWorker("rotate", largeLifecycleRoot, "large-v2", "snapshot_durable");
  runWorker("rotate", largeLifecycleRoot, "large-v2");
  runWorker("rollback", largeLifecycleRoot, "large-v1");
  if (await snapshotVersion(largeLifecycleRoot) !== "large-v1") {
    throw new Error("large lifecycle rollback did not restore the prior trust snapshot");
  }
  runWorker("uninstall", largeLifecycleRoot, "large-v1");
  largeLifecycleVerified = true;
} finally {
  await rm(providerProductionStrongClientDescriptorPathV1(largeLifecycleRoot), { force: true });
  await rm(providerProductionStrongClientGatewayDirectoryPathV1(largeLifecycleRoot), { recursive: true, force: true });
  await rm(largeLifecycleRoot, { recursive: true, force: true });
  await rm(`${largeLifecycleRoot}-runtime`, { recursive: true, force: true });
}

const rawRollbackGuardRoot = await mkdtemp(join(tmpdir(), "uc-step15-trust-raw-rollback-guard-"));
await chmod(rawRollbackGuardRoot, 0o700);
let rawRollbackGatewayGuardVerified = false;
let rawRollbackGatewayServer;
try {
  runWorker("install", rawRollbackGuardRoot, "v1");
  runWorker("rotate", rawRollbackGuardRoot, "v2");
  runWorker("uninstall", rawRollbackGuardRoot, "v1", "rollback_removed");
  const socketPath = providerProductionStrongClientGatewaySocketPathV1(rawRollbackGuardRoot);
  const journalPath = join(rawRollbackGuardRoot, transactionFile);
  const priorSnapshotPath = join(rawRollbackGuardRoot, ".provider-production-strong-client-trust-rollback-v1.json.snapshot");
  const priorDescriptorPath = join(rawRollbackGuardRoot, ".provider-production-strong-client-trust-rollback-v1.json.descriptor");
  const [journalBefore, priorSnapshotBefore, priorDescriptorBefore] = await Promise.all([
    readFile(journalPath), readFile(priorSnapshotPath), readFile(priorDescriptorPath),
  ]);
  rawRollbackGatewayServer = await listenGateway(socketPath);
  runWorkerExpectStoppedGatewayRefusal(rawRollbackGuardRoot);
  const [journalAfter, priorSnapshotAfter, priorDescriptorAfter] = await Promise.all([
    readFile(journalPath), readFile(priorSnapshotPath), readFile(priorDescriptorPath),
  ]);
  if (!journalAfter.equals(journalBefore) || !priorSnapshotAfter.equals(priorSnapshotBefore) ||
    !priorDescriptorAfter.equals(priorDescriptorBefore)) {
    throw new Error("live gateway advanced raw rollback deletion cuts");
  }
  await stopGateway(rawRollbackGatewayServer, socketPath);
  rawRollbackGatewayServer = undefined;
  runWorker("uninstall", rawRollbackGuardRoot, "v1");
  rawRollbackGatewayGuardVerified = true;
} finally {
  if (rawRollbackGatewayServer !== undefined) {
    await stopGateway(rawRollbackGatewayServer, providerProductionStrongClientGatewaySocketPathV1(rawRollbackGuardRoot));
  }
  await rm(providerProductionStrongClientDescriptorPathV1(rawRollbackGuardRoot), { force: true });
  await rm(providerProductionStrongClientGatewayDirectoryPathV1(rawRollbackGuardRoot), { recursive: true, force: true });
  await rm(rawRollbackGuardRoot, { recursive: true, force: true });
  await rm(`${rawRollbackGuardRoot}-runtime`, { recursive: true, force: true });
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
  liveGatewayUninstallVerified,
  partialUninstallLiveGatewayVerified,
  largeLifecycleVerified,
  rawRollbackGatewayGuardVerified,
})}\n`);
