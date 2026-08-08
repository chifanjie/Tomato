import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  cp,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import { builtinModules } from "node:module";
import { createGunzip, gzipSync } from "node:zlib";
import ts from "typescript";

import {
  FIXED_PROVIDER_RESOURCES,
  assertExactProviderResourceEntries,
} from "./lib/provider-resource-inventory.mjs";
const scriptPath = fileURLToPath(import.meta.url);
const packageRoot = resolve(dirname(scriptPath), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const viteCommand = join(
  packageRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "vite.CMD" : "vite",
);
const typescriptCli = join(
  packageRoot,
  "node_modules",
  "typescript",
  "bin",
  "tsc",
);
const vitestCommand = join(
  packageRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "vitest.CMD" : "vitest",
);
const MAX_UNCOMPRESSED_PACK_BYTES = 64 * 1024 * 1024;
const DEFAULT_COMMAND_TIMEOUT_MS = 10 * 60 * 1_000;
const PACK_COMMAND_TIMEOUT_MS = 20 * 60 * 1_000;
const C09_VITE_BUILD_TIMEOUT_MS = 8 * 60 * 1_000;
const C09_RUNTIME_TIMEOUT_MS = 12 * 60 * 1_000;
const C09_MINIMAL_RUNTIME_TIMEOUT_MS = 4 * 60 * 1_000;
const C09_DEDICATED_GATE_MAX_WALL_MS = 10 * 60 * 1_000;
const C09_DEDICATED_GATE_MAX_TREE_RSS_BYTES = 1_536 * 1024 * 1024;
const C09_DEDICATED_MAX_LIVE_REPLAY_WORKERS = 3;
const C09_DEDICATED_WORKER_OUTPUT_MAX_BYTES = 2 * 1024 * 1024;
const C09_DEDICATED_MONITOR_READY_TIMEOUT_MS = 10_000;
const C09_DEDICATED_MONITOR_STOP_TIMEOUT_MS = 10_000;
const C09_DEDICATED_PROCESS_TREE_STOP_TIMEOUT_MS = 10_000;
const C09_DISTRIBUTION_REPLAY_PROFILE_V1 =
  "provider_registry_evidence_binding_distribution_replay_v1";
const C09_DISTRIBUTION_REPLAY_LANES_V1 = Object.freeze([
  Object.freeze([0, 96]),
  Object.freeze([96, 192]),
  Object.freeze([192, 288]),
  Object.freeze([288, 354]),
]);
// The normative 1,536 MiB gate is process-tree aggregate RSS, not a V8 heap
// allowance.  Keep child heaps materially below it so the resident parent,
// young generation, ArrayBuffers, native code, and Vite workers retain room.
const C09_NODE_OPTIONS =
  "--max-old-space-size=1024 --max-semi-space-size=16";
const C09_BROWSER_RUNTIME_NODE_OPTIONS =
  `${C09_NODE_OPTIONS} --disallow-code-generation-from-strings`;
// npm prepack runs the topology proof parent beside its fixed-heap parser
// worker.  A tighter parent heap forces collection before that overlap while
// retaining the complete prepack verifier chain and worker protocol.
const C09_PACK_NODE_OPTIONS =
  "--max-old-space-size=640 --max-semi-space-size=16";
const C09_BROWSER_INVALID_BYTES_GLOBAL_V1 =
  "__UNDERSTAND_CODE_C09_REGISTRY_EVIDENCE_BINDING_INVALID_BYTES_V1__";
const C09_BROWSER_MINIMAL_GOLDEN_DATA_GLOBAL_V1 =
  "__UNDERSTAND_CODE_C09_REGISTRY_EVIDENCE_BINDING_MINIMAL_GOLDEN_DATA_V1__";
const C09_BROWSER_ZOD_VERSION_V1 = "4.3.6";
const C09_BROWSER_ZOD_RUNTIME_WRAPPER_RELATIVE_PATH_V1 =
  "./dist/zod-runtime.js";
const C09_BROWSER_ZOD_RUNTIME_WRAPPER_BYTE_LENGTH_V1 = 64;
const C09_BROWSER_ZOD_RUNTIME_WRAPPER_SHA256_V1 =
  "49e118923933dc2de84d058d3aec3fcd55b5d3d40ac07bc65872d0768efc053d";
const C09_BROWSER_ZOD_RUNTIME_WRAPPER_DTS_BYTE_LENGTH_V1 = 66;
const C09_BROWSER_ZOD_RUNTIME_WRAPPER_DTS_SHA256_V1 =
  "fdb8350fa7d70a64c2b7457ee0907066f405cf060147e5ecd72023bbd2e214e6";
const C09_BROWSER_ZOD_RELATIVE_PATH_V1 = "./dist/browser-zod.js";
const C09_BROWSER_ZOD_BYTE_LENGTH_V1 = 461_202;
const C09_BROWSER_ZOD_SHA256_V1 =
  "838c855b17d7108c6a19f6cfcd7de50eff6c08553c062b3e493b61e7b50e54f6";
const C09_BROWSER_ZOD_LICENSE_BYTE_LENGTH_V1 = 1_072;
const C09_BROWSER_ZOD_LICENSE_SHA256_V1 =
  "3f1189b28e3866e0d979968d466b78f813f76827cfdca1fbb124cc0a5c8841f8";
const C09_VITE_DEPENDENCY_GUARD_SENTINEL_IDENTIFIER_V1 =
  "__UNDERSTAND_CODE_C09_VITE_DEPENDENCY_GUARD_V1__";
const C09_VITE_DEPENDENCY_GUARD_SENTINEL_DOMAIN_V1 =
  "understand-code-c09-vite-dependency-guard/module-graph-checked/v1";
const C09_VITE_DEPENDENCY_GUARD_BLOCKED_PREFIX_V1 =
  "C09_VITE_DEPENDENCY_GUARD_BLOCKED";
const C09_MINIMAL_EXPECTED_IMPORT_SURFACE = Object.freeze([
  Object.freeze({
    specifier:
      "@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point",
    bindings: Object.freeze([
      Object.freeze({
        imported: "validateProviderRegistryEvidenceBindingPointClosureV1",
        local: "validateProviderRegistryEvidenceBindingPointClosureV1",
      }),
    ]),
  }),
  Object.freeze({
    specifier:
      "@understand-code/durable-object-provider-contracts/strict-ed25519",
    bindings: Object.freeze([
      Object.freeze({
        imported: "STRICT_ED25519_VERIFICATION_PROFILE_V1",
        local: "STRICT_ED25519_VERIFICATION_PROFILE_V1",
      }),
      Object.freeze({
        imported: "validatePrimeSubgroupPoint",
        local: "validatePrimeSubgroupPoint",
      }),
      Object.freeze({
        imported: "verifyRawEd25519",
        local: "verifyRawEd25519",
      }),
    ]),
  }),
  Object.freeze({
    specifier:
      "@understand-code/durable-object-provider-contracts/strict-ed25519-conformance",
    bindings: Object.freeze([
      Object.freeze({
        imported: "PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1",
        local: "PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1",
      }),
      Object.freeze({
        imported: "PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1",
        local: "PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1",
      }),
      Object.freeze({
        imported: "attestProviderStrictEd25519CryptoHostV1",
        local: "attestProviderStrictEd25519CryptoHostV1",
      }),
    ]),
  }),
]);
const C09_MINIMAL_EXPECTED_IMPORT_SPECIFIERS = Object.freeze(
  C09_MINIMAL_EXPECTED_IMPORT_SURFACE.map(({ specifier }) => specifier),
);

async function run(command, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError(`Distribution command timeout is invalid: ${timeoutMs}`);
  }
  const execution = startCapturedC09ProcessV1(
    {
      label: options.label ?? `${command} ${args.join(" ")}`,
      command,
      args,
      cwd: options.cwd,
      env: options.env,
    },
    timeoutMs,
    32 * 1024 * 1024,
  );
  return execution.promise;
}

let installedCanonicalizeJcsSafeIntegerUtf8V1;

function requireInstalledCanonicalizerV1() {
  if (typeof installedCanonicalizeJcsSafeIntegerUtf8V1 !== "function") {
    throw new Error(
      "C09 distribution replay canonicalizer was not loaded from the cold install",
    );
  }
  return installedCanonicalizeJcsSafeIntegerUtf8V1;
}

function isStrictPathDescendantV1(rootPath, candidatePath) {
  const relativePath = relative(rootPath, candidatePath);
  return (
    relativePath.length > 0 &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  );
}

function sha256HexV1(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function assertColdInstalledBrowserZodV1(
  installedRoot,
  installedRootRealPath,
  manifest,
) {
  if (
    manifest.dependencies?.zod !== C09_BROWSER_ZOD_VERSION_V1 ||
    manifest.browser?.[
      C09_BROWSER_ZOD_RUNTIME_WRAPPER_RELATIVE_PATH_V1
    ] !== C09_BROWSER_ZOD_RELATIVE_PATH_V1 ||
    Object.keys(manifest.browser ?? {}).length !== 1
  ) {
    throw new Error(
      "Cold-installed browser Zod dependency or browser mapping drifted",
    );
  }

  for (const expected of [
    Object.freeze({
      relativePath: C09_BROWSER_ZOD_RUNTIME_WRAPPER_RELATIVE_PATH_V1.slice(2),
      byteLength: C09_BROWSER_ZOD_RUNTIME_WRAPPER_BYTE_LENGTH_V1,
      sha256: C09_BROWSER_ZOD_RUNTIME_WRAPPER_SHA256_V1,
      label: "browser Zod Node runtime wrapper",
    }),
    Object.freeze({
      relativePath: "dist/zod-runtime.d.ts",
      byteLength: C09_BROWSER_ZOD_RUNTIME_WRAPPER_DTS_BYTE_LENGTH_V1,
      sha256: C09_BROWSER_ZOD_RUNTIME_WRAPPER_DTS_SHA256_V1,
      label: "browser Zod runtime wrapper declarations",
    }),
    Object.freeze({
      relativePath: C09_BROWSER_ZOD_RELATIVE_PATH_V1.slice(2),
      byteLength: C09_BROWSER_ZOD_BYTE_LENGTH_V1,
      sha256: C09_BROWSER_ZOD_SHA256_V1,
      label: "browser Zod runtime",
    }),
    Object.freeze({
      relativePath: "dist/browser-zod.LICENSE.txt",
      byteLength: C09_BROWSER_ZOD_LICENSE_BYTE_LENGTH_V1,
      sha256: C09_BROWSER_ZOD_LICENSE_SHA256_V1,
      label: "browser Zod license",
    }),
  ]) {
    const lexicalPath = join(installedRoot, expected.relativePath);
    const installedPath = await realpath(lexicalPath);
    if (
      !isStrictPathDescendantV1(installedRootRealPath, installedPath) ||
      installedPath !== join(installedRootRealPath, expected.relativePath)
    ) {
      throw new Error(
        `Cold-installed ${expected.label} escaped its exact installed path`,
      );
    }
    const metadata = await lstat(lexicalPath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error(`Cold-installed ${expected.label} is not a regular file`);
    }
    const bytes = await readFile(installedPath);
    if (
      bytes.byteLength !== expected.byteLength ||
      sha256HexV1(bytes) !== expected.sha256
    ) {
      throw new Error(`Cold-installed ${expected.label} bytes drifted`);
    }
  }
}

async function loadColdInstalledCanonicalizerV1(installedRoot) {
  const installedRootRealPath = await realpath(installedRoot);
  const installedJcsRealPath = await realpath(
    join(installedRootRealPath, "dist", "jcs.js"),
  );
  if (!isStrictPathDescendantV1(installedRootRealPath, installedJcsRealPath)) {
    throw new Error("Cold-installed JCS module escaped the installed package");
  }
  const installedJcs = await import(pathToFileURL(installedJcsRealPath).href);
  const canonicalize = installedJcs.canonicalizeJcsSafeIntegerUtf8V1;
  if (typeof canonicalize !== "function") {
    throw new Error("Cold-installed JCS canonicalizer export is unavailable");
  }
  const probe = canonicalize(Object.freeze(["cold-install-jcs-probe", 1]));
  if (
    !(probe instanceof Uint8Array) ||
    new TextDecoder().decode(probe) !== '["cold-install-jcs-probe",1]'
  ) {
    throw new Error("Cold-installed JCS canonicalizer failed its exact probe");
  }
  installedCanonicalizeJcsSafeIntegerUtf8V1 = canonicalize;
  return installedRootRealPath;
}

function canonicalJsonEqualV1(left, right) {
  const canonicalize = requireInstalledCanonicalizerV1();
  const leftBytes = canonicalize(left);
  const rightBytes = canonicalize(right);
  if (leftBytes.byteLength !== rightBytes.byteLength) return false;
  for (let index = 0; index < leftBytes.byteLength; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) return false;
  }
  return true;
}

function semanticDigestV1(domain, value) {
  return `sha256:${createHash("sha256")
    .update(requireInstalledCanonicalizerV1()([domain, value]))
    .digest("hex")}`;
}

function parseExactJsonObjectV1(text, label) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} emitted garbled JSON`, { cause: error });
  }
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new Error(`${label} did not emit a JSON object`);
  }
  return value;
}

function delayV1(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

const C09_RSS_MONITOR_PROFILE_V1 =
  "provider_registry_evidence_binding_distribution_process_tree_rss_v1";
const C09_RSS_MONITOR_COUNTING_POLICY_V1 =
  "same_sample_distribution_parent_and_all_live_descendants_including_monitor";
const C09_RSS_MONITOR_ROLES_V1 = new Set([
  "distribution_parent",
  "rss_monitor",
  "generator_check",
  "direct_replay",
  "packed_node_replay_lane",
  "packed_browser_replay_lane",
  "packed_browser_replay_vite",
  "minimal_vite",
  "minimal_browser_runtime",
  "main_vite",
  "main_browser_runtime",
  "main_node_runtime",
  "vite_child",
  "distribution_descendant",
]);

function validateC09RssMonitorReadyReportV1(report, expected) {
  assertExactObjectKeysV1(
    report,
    [
      "profile",
      "state",
      "nonce",
      "rootPid",
      "monitorPid",
      "sampleIntervalMs",
      "countingPolicy",
    ],
    "C09 RSS monitor readiness",
  );
  if (
    report.profile !== C09_RSS_MONITOR_PROFILE_V1 ||
    report.state !== "ready" ||
    report.nonce !== expected.nonce ||
    !/^[0-9a-f]{32}$/u.test(report.nonce) ||
    report.rootPid !== expected.rootPid ||
    report.monitorPid !== expected.monitorPid ||
    !Number.isSafeInteger(report.rootPid) ||
    report.rootPid <= 1 ||
    !Number.isSafeInteger(report.monitorPid) ||
    report.monitorPid <= 1 ||
    report.monitorPid === report.rootPid ||
    report.sampleIntervalMs !== 50 ||
    report.countingPolicy !== C09_RSS_MONITOR_COUNTING_POLICY_V1
  ) {
    throw new Error("C09 RSS monitor readiness is stale or malformed");
  }
  return report;
}

function validateC09RssMonitorCompleteReportV1(report, expected) {
  assertExactObjectKeysV1(
    report,
    [
      "profile",
      "state",
      "nonce",
      "rootPid",
      "monitorPid",
      "sampleIntervalMs",
      "countingPolicy",
      "sampleCount",
      "elapsedMs",
      "peakSample",
    ],
    "C09 RSS monitor report",
  );
  if (
    report.profile !== C09_RSS_MONITOR_PROFILE_V1 ||
    report.state !== "complete" ||
    report.nonce !== expected.nonce ||
    !/^[0-9a-f]{32}$/u.test(report.nonce) ||
    report.rootPid !== expected.rootPid ||
    report.monitorPid !== expected.monitorPid ||
    !Number.isSafeInteger(report.rootPid) ||
    report.rootPid <= 1 ||
    !Number.isSafeInteger(report.monitorPid) ||
    report.monitorPid <= 1 ||
    report.monitorPid === report.rootPid ||
    report.sampleIntervalMs !== 50 ||
    report.countingPolicy !== C09_RSS_MONITOR_COUNTING_POLICY_V1 ||
    !Number.isSafeInteger(report.sampleCount) ||
    report.sampleCount < 1 ||
    typeof report.elapsedMs !== "number" ||
    !Number.isFinite(report.elapsedMs) ||
    report.elapsedMs < 0
  ) {
    throw new Error("C09 RSS monitor report is stale or malformed");
  }
  assertExactObjectKeysV1(
    report.peakSample,
    ["monotonicOffsetMs", "aggregateRssBytes", "processes"],
    "C09 RSS monitor peak sample",
  );
  const peak = report.peakSample;
  if (
    typeof peak.monotonicOffsetMs !== "number" ||
    !Number.isFinite(peak.monotonicOffsetMs) ||
    peak.monotonicOffsetMs < 0 ||
    peak.monotonicOffsetMs > report.elapsedMs ||
    !Number.isSafeInteger(peak.aggregateRssBytes) ||
    peak.aggregateRssBytes <= 0 ||
    !Array.isArray(peak.processes) ||
    peak.processes.length < 2
  ) {
    throw new Error("C09 RSS monitor peak sample is malformed");
  }
  const pidSet = new Set();
  let rootProcess;
  let monitorProcess;
  let rssSum = 0;
  let previousPid = 0;
  for (const processRecord of peak.processes) {
    assertExactObjectKeysV1(
      processRecord,
      ["pid", "parentPid", "rssBytes", "role"],
      "C09 RSS monitor process record",
    );
    if (
      !Number.isSafeInteger(processRecord.pid) ||
      processRecord.pid <= 1 ||
      processRecord.pid <= previousPid ||
      !Number.isSafeInteger(processRecord.parentPid) ||
      processRecord.parentPid < 0 ||
      !Number.isSafeInteger(processRecord.rssBytes) ||
      processRecord.rssBytes < 0 ||
      typeof processRecord.role !== "string" ||
      !C09_RSS_MONITOR_ROLES_V1.has(processRecord.role) ||
      pidSet.has(processRecord.pid)
    ) {
      throw new Error("C09 RSS monitor process record is malformed");
    }
    previousPid = processRecord.pid;
    pidSet.add(processRecord.pid);
    rssSum += processRecord.rssBytes;
    if (!Number.isSafeInteger(rssSum)) {
      throw new Error("C09 RSS monitor RSS sum is unsafe");
    }
    if (processRecord.pid === report.rootPid) rootProcess = processRecord;
    if (processRecord.pid === report.monitorPid) monitorProcess = processRecord;
  }
  const processesByPid = new Map(
    peak.processes.map((record) => [record.pid, record]),
  );
  const everyNonRootReachesRoot = peak.processes.every((record) => {
    if (record.pid === report.rootPid) return true;
    const visited = new Set();
    let cursor = record;
    for (let hop = 0; hop < peak.processes.length; hop += 1) {
      if (cursor.pid === report.rootPid) return true;
      if (visited.has(cursor.pid)) return false;
      visited.add(cursor.pid);
      const parent = processesByPid.get(cursor.parentPid);
      if (parent === undefined) return false;
      cursor = parent;
    }
    return false;
  });
  if (
    rootProcess?.role !== "distribution_parent" ||
    monitorProcess?.role !== "rss_monitor" ||
    monitorProcess.parentPid !== report.rootPid ||
    !everyNonRootReachesRoot ||
    peak.processes.some(
      (record) =>
        record.pid !== report.rootPid && !pidSet.has(record.parentPid),
    ) ||
    peak.processes.some(
      (record) =>
        record.pid !== report.rootPid &&
        record.pid !== report.monitorPid &&
        (record.role === "distribution_parent" || record.role === "rss_monitor"),
    ) ||
    rssSum !== peak.aggregateRssBytes
  ) {
    throw new Error("C09 RSS monitor process tree is incomplete or under-reported");
  }
  return report;
}

async function assertC09PrivateReportModeV1(path, label) {
  const metadata = await stat(path);
  if ((metadata.mode & 0o777) !== 0o600) {
    throw new Error(`${label} mode is not 0600`);
  }
}

function createC09ChildCompletionV1(child) {
  let spawnError;
  let outcome;
  const promise = new Promise((resolveCompletion) => {
    child.once("error", (error) => {
      spawnError = error;
    });
    child.once("close", (status, signal) => {
      outcome = { error: spawnError, status, signal };
      resolveCompletion(outcome);
    });
  });
  return Object.freeze({ promise, readOutcome: () => outcome });
}

function isC09ProcessTreeLiveV1(child) {
  if (!Number.isSafeInteger(child.pid) || child.pid <= 1) {
    return child.exitCode === null && child.signalCode === null;
  }
  if (process.platform === "win32") {
    return child.exitCode === null && child.signalCode === null;
  }
  try {
    process.kill(-child.pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    if (error?.code === "EPERM") return true;
    throw error;
  }
}

function readC09ProcessTableV1() {
  if (process.platform === "win32") {
    return Object.freeze({ records: Object.freeze([]), error: undefined });
  }
  const result = spawnSync("ps", ["-axo", "pid=,ppid=,pgid="], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error !== undefined || result.status !== 0) {
    return Object.freeze({
      records: Object.freeze([]),
      error: new Error(
        `C09 process-tree snapshot failed: ${result.error?.message ?? result.status}`,
      ),
    });
  }
  const records = [];
  for (const line of result.stdout.split("\n")) {
    const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s*$/u.exec(line);
    if (match === null) continue;
    const record = {
      pid: Number(match[1]),
      parentPid: Number(match[2]),
      processGroupId: Number(match[3]),
    };
    records.push(record);
  }
  return Object.freeze({ records: Object.freeze(records), error: undefined });
}

function snapshotC09ProcessTreePidsV1(rootPid) {
  if (!Number.isSafeInteger(rootPid) || rootPid <= 1) {
    return Object.freeze({ targets: Object.freeze([]), error: undefined });
  }
  if (process.platform === "win32") {
    return Object.freeze({
      targets: Object.freeze([
        Object.freeze({ pid: rootPid, processGroupId: rootPid }),
      ]),
      error: undefined,
    });
  }
  const table = readC09ProcessTableV1();
  const children = new Map();
  for (const record of table.records) {
    const siblings = children.get(record.parentPid) ?? [];
    siblings.push(record);
    children.set(record.parentPid, siblings);
  }
  const selected = new Set([rootPid]);
  for (const record of table.records) {
    if (record.processGroupId === rootPid) selected.add(record.pid);
  }
  const pending = [...selected];
  while (pending.length > 0) {
    const parentPid = pending.pop();
    for (const childRecord of children.get(parentPid) ?? []) {
      if (!selected.has(childRecord.pid)) {
        selected.add(childRecord.pid);
        pending.push(childRecord.pid);
      }
    }
  }
  const recordsByPid = new Map(
    table.records.map((record) => [record.pid, record]),
  );
  return Object.freeze({
    targets: Object.freeze(
      [...selected]
        .map((pid) =>
          Object.freeze({
            pid,
            processGroupId:
              recordsByPid.get(pid)?.processGroupId ?? rootPid,
          }),
        )
        .sort((left, right) => right.pid - left.pid),
    ),
    error: table.error,
  });
}

function signalC09ProcessTreeV1(child, targets = []) {
  if (!Number.isSafeInteger(child.pid) || child.pid <= 1) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
    }
    return;
  }
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      encoding: "utf8",
      windowsHide: true,
    });
    return;
  }
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
  for (const { pid } of targets) {
    if (
      !Number.isSafeInteger(pid) ||
      pid <= 1 ||
      pid === process.pid
    ) {
      continue;
    }
    try {
      process.kill(pid, "SIGKILL");
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
    }
  }
}

async function awaitC09PromiseWithTimeoutV1(promise, timeoutMs) {
  const timeoutSentinel = Symbol("c09-timeout");
  let timeoutHandle;
  const timeout = new Promise((resolveTimeout) => {
    timeoutHandle = setTimeout(() => resolveTimeout(timeoutSentinel), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function terminateC09ProcessTreeAndWaitV1(child, completion, label) {
  const snapshot = snapshotC09ProcessTreePidsV1(child.pid);
  signalC09ProcessTreeV1(child, snapshot.targets);
  const outcome = await awaitC09PromiseWithTimeoutV1(
    completion,
    C09_DEDICATED_PROCESS_TREE_STOP_TIMEOUT_MS,
  );
  // awaitC09PromiseWithTimeoutV1 returns its private timeout Symbol.  A child
  // outcome is always an ordinary object, so any Symbol means timeout.
  if (typeof outcome === "symbol") {
    signalC09ProcessTreeV1(child, snapshot.targets);
    throw new Error(`${label} process leader did not exit after SIGKILL`);
  }
  const deadline =
    performance.now() + C09_DEDICATED_PROCESS_TREE_STOP_TIMEOUT_MS;
  let processTableError;
  for (;;) {
    const table = readC09ProcessTableV1();
    processTableError ??= table.error;
    const recordsByPid = new Map(
      table.records.map((record) => [record.pid, record]),
    );
    const liveTargets = snapshot.targets.filter(
      (target) =>
        recordsByPid.get(target.pid)?.processGroupId === target.processGroupId,
    );
    if (!isC09ProcessTreeLiveV1(child) && liveTargets.length === 0) break;
    signalC09ProcessTreeV1(child, liveTargets);
    if (performance.now() >= deadline) {
      throw new Error(`${label} process tree survived SIGKILL`);
    }
    await delayV1(10);
  }
  if (snapshot.error !== undefined) throw snapshot.error;
  if (processTableError !== undefined) throw processTableError;
  return outcome;
}

async function startC09DedicatedGateMonitorV1(temporaryRoot) {
  const nonce = randomBytes(16).toString("hex");
  const reportPath = join(temporaryRoot, `c09-rss-${nonce}.json`);
  const stopPath = join(temporaryRoot, `c09-rss-${nonce}.stop`);
  const monitorPath = join(
    packageRoot,
    "scripts",
    "lib",
    "provider-registry-evidence-binding-distribution-rss-monitor.mjs",
  );
  const child = spawn(
    process.execPath,
    [monitorPath, reportPath, stopPath, nonce, String(process.pid)],
    {
      cwd: packageRoot,
      env: { ...process.env, NODE_OPTIONS: C09_NODE_OPTIONS },
      stdio: ["ignore", "ignore", "pipe"],
      detached: process.platform !== "win32",
    },
  );
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
    if (Buffer.byteLength(stderr, "utf8") > 512 * 1024) {
      stderr = `${stderr.slice(0, 512 * 1024)}\n[monitor stderr truncated]`;
    }
  });
  const lifecycle = createC09ChildCompletionV1(child);
  const gate = {
    nonce,
    reportPath,
    stopPath,
    child,
    completion: lifecycle.promise,
    readMonitorExit: lifecycle.readOutcome,
    readMonitorStderr: () => stderr,
    startedAt: undefined,
    lastChildExitAt: undefined,
    stopped: false,
  };
  try {
    const readyDeadline =
      performance.now() + C09_DEDICATED_MONITOR_READY_TIMEOUT_MS;
    for (;;) {
      const monitorExit = lifecycle.readOutcome();
      if (monitorExit !== undefined) {
        throw new Error(
          `C09 RSS monitor exited before readiness: ${JSON.stringify(monitorExit)}\n${stderr}`,
        );
      }
      try {
        const ready = parseExactJsonObjectV1(
          await readFile(reportPath, "utf8"),
          "C09 RSS monitor readiness",
        );
        validateC09RssMonitorReadyReportV1(ready, {
          nonce,
          rootPid: process.pid,
          monitorPid: child.pid,
        });
        await assertC09PrivateReportModeV1(
          reportPath,
          "C09 RSS monitor readiness",
        );
        if (
          lifecycle.readOutcome() !== undefined ||
          !isC09ProcessTreeLiveV1(child)
        ) {
          throw new Error("C09 RSS monitor exited during readiness");
        }
        return gate;
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      if (performance.now() >= readyDeadline) {
        throw new Error("C09 RSS monitor did not become ready in 10 seconds");
      }
      await delayV1(10);
    }
  } catch (error) {
    let cleanupError;
    try {
      await terminateC09ProcessTreeAndWaitV1(
        child,
        lifecycle.promise,
        "C09 RSS monitor startup",
      );
      gate.stopped = true;
    } catch (caught) {
      cleanupError = caught;
    }
    if (cleanupError !== undefined) {
      throw new AggregateError(
        [error, cleanupError],
        "C09 RSS monitor startup and cleanup both failed",
      );
    }
    throw error;
  }
}

function beginC09DedicatedGateWindowV1(gate) {
  if (gate.startedAt !== undefined) {
    throw new Error("C09 dedicated distribution gate was started twice");
  }
  gate.startedAt = performance.now();
}

function remainingC09DedicatedGateTimeoutV1(gate, commandTimeoutMs) {
  if (gate.startedAt === undefined || gate.stopped) {
    throw new Error("C09 dedicated distribution gate is not active");
  }
  const remaining =
    C09_DEDICATED_GATE_MAX_WALL_MS - (performance.now() - gate.startedAt);
  if (remaining <= 1) {
    throw new Error("C09 dedicated distribution gate exceeded 600000 ms");
  }
  return Math.max(1, Math.min(commandTimeoutMs, Math.floor(remaining)));
}

function startCapturedC09ProcessV1(specification, timeoutMs, maxOutputBytes) {
  const child = spawn(specification.command, specification.args, {
    cwd: specification.cwd,
    env: { ...process.env, ...specification.env },
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });
  const lifecycle = createC09ChildCompletionV1(child);
  const stdoutChunks = [];
  const stderrChunks = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let overflow;
  let timedOut = false;
  let resolveEarlyFailure;
  const earlyFailure = new Promise((resolveFailure) => {
    resolveEarlyFailure = resolveFailure;
  });
  const capture = (chunks, chunk, stream) => {
    const byteLength = chunk.byteLength;
    if (stream === "stdout") stdoutBytes += byteLength;
    else stderrBytes += byteLength;
    if (
      stdoutBytes > maxOutputBytes ||
      stderrBytes > maxOutputBytes
    ) {
      if (overflow === undefined) {
        overflow = stream;
        resolveEarlyFailure("overflow");
      }
      return;
    }
    chunks.push(chunk);
  };
  child.stdout.on("data", (chunk) => capture(stdoutChunks, chunk, "stdout"));
  child.stderr.on("data", (chunk) => capture(stderrChunks, chunk, "stderr"));
  const timeout = setTimeout(() => {
    timedOut = true;
    resolveEarlyFailure("timeout");
  }, timeoutMs);
  let termination;
  const terminate = () => {
    termination ??= terminateC09ProcessTreeAndWaitV1(
      child,
      lifecycle.promise,
      `C09 ${specification.label}`,
    );
    return termination;
  };
  const promise = (async () => {
    const winner = await Promise.race([lifecycle.promise, earlyFailure]);
    clearTimeout(timeout);
    let outcome;
    if (winner === "overflow" || winner === "timeout") {
      outcome = await terminate();
    } else {
      outcome = winner;
    }
    const stdout = Buffer.concat(stdoutChunks).toString("utf8");
    const stderr = Buffer.concat(stderrChunks).toString("utf8");
    if (timedOut) {
      throw new Error(
        `C09 ${specification.label} timed out after ${timeoutMs} ms`,
      );
    }
    if (overflow !== undefined) {
      throw new Error(
        `C09 ${specification.label} exceeded the ${overflow} cap`,
      );
    }
    if (
      outcome.error !== undefined ||
      outcome.status !== 0 ||
      outcome.signal !== null
    ) {
      await terminate();
      throw new Error(
        [
          `C09 ${specification.label} crashed (${outcome.status ?? "spawn error"}/${outcome.signal ?? "none"})`,
          stderr.trim(),
          outcome.error?.stack,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }
    if (isC09ProcessTreeLiveV1(child)) {
      await terminate();
      throw new Error(`C09 ${specification.label} left a live descendant`);
    }
    return Object.freeze({ stdout, stderr });
  })();
  return { child, promise, terminate };
}

async function runC09DedicatedCommandV1(
  gate,
  command,
  args,
  options = {},
) {
  const timeoutMs = remainingC09DedicatedGateTimeoutV1(
    gate,
    options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS,
  );
  const execution = startCapturedC09ProcessV1(
    {
      label: options.label ?? `${command} ${args.join(" ")}`,
      command,
      args,
      cwd: options.cwd,
      env: options.env,
    },
    timeoutMs,
    32 * 1024 * 1024,
  );
  const result = await execution.promise;
  gate.lastChildExitAt = performance.now();
  return result;
}

function spawnBoundedC09WorkerV1(specification, timeoutMs) {
  const execution = startCapturedC09ProcessV1(
    specification,
    timeoutMs,
    C09_DEDICATED_WORKER_OUTPUT_MAX_BYTES,
  );
  const promise = execution.promise.then(({ stdout, stderr }) => {
    if (stderr.trim().length !== 0) {
      throw new Error(`C09 ${specification.label} emitted stderr\n${stderr}`);
    }
    return parseExactJsonObjectV1(
      stdout.trim(),
      `C09 ${specification.label}`,
    );
  });
  return { ...execution, promise };
}

async function runParallelC09WorkersV1(gate, specifications) {
  if (specifications.length !== 4) {
    throw new TypeError("C09 distribution replay requires exactly four workers");
  }
  const reports = new Array(specifications.length);
  const activeWorkers = new Set();
  let nextSpecificationIndex = 0;
  let aborted = false;
  const runWorkerQueueV1 = async () => {
    for (;;) {
      if (aborted) return;
      const specificationIndex = nextSpecificationIndex;
      if (specificationIndex >= specifications.length) return;
      nextSpecificationIndex += 1;
      let worker;
      try {
        const timeoutMs = remainingC09DedicatedGateTimeoutV1(
          gate,
          C09_RUNTIME_TIMEOUT_MS,
        );
        worker = spawnBoundedC09WorkerV1(
          specifications[specificationIndex],
          timeoutMs,
        );
        activeWorkers.add(worker);
        reports[specificationIndex] = await worker.promise;
      } catch (error) {
        aborted = true;
        throw error;
      } finally {
        if (worker !== undefined) activeWorkers.delete(worker);
      }
    }
  };
  const queues = Array.from(
    {
      length: Math.min(
        C09_DEDICATED_MAX_LIVE_REPLAY_WORKERS,
        specifications.length,
      ),
    },
    () => runWorkerQueueV1(),
  );
  try {
    await Promise.all(queues);
    if (
      reports.some((report) => report === undefined) ||
      !Array.from(
        { length: reports.length },
        (_, index) => Object.hasOwn(reports, index),
      ).every(Boolean)
    ) {
      throw new Error("C09 distribution replay worker result is incomplete");
    }
    gate.lastChildExitAt = performance.now();
    return reports;
  } catch (error) {
    aborted = true;
    const workersToTerminate = [...activeWorkers];
    const terminationOutcomes = await Promise.allSettled(
      workersToTerminate.map(({ terminate }) => terminate()),
    );
    await Promise.allSettled(queues);
    gate.lastChildExitAt = performance.now();
    const cleanupErrors = terminationOutcomes.flatMap((outcome) =>
      outcome.status === "rejected" ? [outcome.reason] : [],
    );
    if (cleanupErrors.length !== 0) {
      throw new AggregateError(
        [error, ...cleanupErrors],
        "C09 distribution replay and worker cleanup both failed",
      );
    }
    throw error;
  }
}

function assertExactObjectKeysV1(value, keys, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new Error(`${label} is not an exact JSON object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(`${label} has unexpected fields: ${actual.join(", ")}`);
  }
}

function validateC09ReplayReportsV1(
  reports,
  runtime,
  nonce,
  expectedManifest,
) {
  if (reports.length !== 4) {
    throw new Error(`C09 ${runtime} replay did not return four lanes`);
  }
  const reportsByLane = [...reports].sort(
    (left, right) => left.laneIndex - right.laneIndex,
  );
  const observedLaneIndexes = new Set();
  const observedShards = [];
  let caseCursor = 0;
  for (let laneIndex = 0; laneIndex < 4; laneIndex += 1) {
    const report = reportsByLane[laneIndex];
    const expectedRange = C09_DISTRIBUTION_REPLAY_LANES_V1[laneIndex];
    assertExactObjectKeysV1(
      report,
      [
        "profile",
        "runtime",
        "nonce",
        "laneIndex",
        "startCaseIndex",
        "endCaseIndexExclusive",
        "executedCaseCount",
        "aggregateContentDigest",
        "goldenPointAdmissionCount",
        "goldenSignatureVerificationCount",
        "shards",
      ],
      `C09 ${runtime} lane ${laneIndex}`,
    );
    if (
      report.profile !== C09_DISTRIBUTION_REPLAY_PROFILE_V1 ||
      report.runtime !== runtime ||
      report.nonce !== nonce ||
      report.laneIndex !== laneIndex ||
      observedLaneIndexes.has(report.laneIndex) ||
      report.startCaseIndex !== expectedRange[0] ||
      report.endCaseIndexExclusive !== expectedRange[1] ||
      report.executedCaseCount !== expectedRange[1] - expectedRange[0] ||
      report.aggregateContentDigest !== expectedManifest.aggregateContentDigest ||
      report.goldenPointAdmissionCount !== 24 ||
      report.goldenSignatureVerificationCount !== 46 ||
      !Array.isArray(report.shards) ||
      report.shards.length !== 3
    ) {
      throw new Error(`C09 ${runtime} lane ${laneIndex} is stale or incomplete`);
    }
    observedLaneIndexes.add(report.laneIndex);
    for (const shard of report.shards) {
      assertExactObjectKeysV1(
        shard,
        [
          "shardIndex",
          "startCaseIndex",
          "endCaseIndexExclusive",
          "caseCount",
          "caseIdsContentDigest",
          "expectedOutcomesContentDigest",
          "cryptoCountsContentDigest",
        ],
        `C09 ${runtime} shard`,
      );
      if (
        shard.startCaseIndex !== caseCursor ||
        shard.endCaseIndexExclusive <= shard.startCaseIndex ||
        shard.caseCount !==
          shard.endCaseIndexExclusive - shard.startCaseIndex ||
        shard.shardIndex !== observedShards.length
      ) {
        throw new Error(
          `C09 ${runtime} shard ${shard.shardIndex} has a gap, overlap, or duplicate`,
        );
      }
      const expectedShard = expectedManifest.shards[shard.shardIndex];
      if (
        expectedShard === undefined ||
        !canonicalJsonEqualV1(shard, expectedShard)
      ) {
        throw new Error(`C09 ${runtime} shard ${shard.shardIndex} digest drifted`);
      }
      observedShards.push(shard);
      caseCursor = shard.endCaseIndexExclusive;
    }
  }
  if (
    observedLaneIndexes.size !== 4 ||
    observedShards.length !== 12 ||
    caseCursor !== 354 ||
    semanticDigestV1(expectedManifest.aggregateSemanticDomain, observedShards) !==
      expectedManifest.aggregateContentDigest
  ) {
    throw new Error(`C09 ${runtime} replay is not the exact 354-case cover`);
  }
  return Object.freeze({
    runtime,
    laneCount: 4,
    shardCount: 12,
    caseCount: caseCursor,
    aggregateContentDigest: expectedManifest.aggregateContentDigest,
  });
}

function runC09ReplayAggregatorRegressionsV1(
  reports,
  runtime,
  nonce,
  expectedManifest,
) {
  const mutations = [
    (copy) => {
      copy[0].nonce =
        nonce === "0".repeat(32) ? "1".repeat(32) : "0".repeat(32);
    },
    (copy) => {
      copy[1].laneIndex = 0;
    },
    (copy) => {
      copy[1].shards[0].startCaseIndex += 1;
    },
    (copy) => {
      copy[2].shards[0].caseIdsContentDigest = `sha256:${"0".repeat(64)}`;
    },
  ];
  for (const [index, mutate] of mutations.entries()) {
    const copy = JSON.parse(JSON.stringify(reports));
    mutate(copy);
    let rejected = false;
    try {
      validateC09ReplayReportsV1(copy, runtime, nonce, expectedManifest);
    } catch {
      rejected = true;
    }
    if (!rejected) {
      throw new Error(`C09 replay aggregator regression ${index} was accepted`);
    }
  }
}

async function stopC09DedicatedGateMonitorV1(gate, enforceGates) {
  if (gate === undefined) return undefined;
  if (gate.stopped) {
    if (isC09ProcessTreeLiveV1(gate.child)) {
      await terminateC09ProcessTreeAndWaitV1(
        gate.child,
        gate.completion,
        "C09 RSS monitor inconsistent stopped state",
      );
      throw new Error("C09 RSS monitor was marked stopped while still live");
    }
    return undefined;
  }
  let monitorExit;
  try {
    await writeFile(gate.stopPath, `${gate.nonce}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    monitorExit = await awaitC09PromiseWithTimeoutV1(
      gate.completion,
      C09_DEDICATED_MONITOR_STOP_TIMEOUT_MS,
    );
    if (typeof monitorExit === "symbol") {
      throw new Error("C09 RSS monitor did not stop in 10 seconds");
    }
    if (isC09ProcessTreeLiveV1(gate.child)) {
      throw new Error("C09 RSS monitor left a live descendant");
    }
    gate.stopped = true;
  } catch (error) {
    let cleanupError;
    try {
      monitorExit = await terminateC09ProcessTreeAndWaitV1(
        gate.child,
        gate.completion,
        "C09 RSS monitor stop cleanup",
      );
      gate.stopped = true;
    } catch (caught) {
      cleanupError = caught;
    }
    if (cleanupError !== undefined) {
      throw new AggregateError(
        [error, cleanupError],
        "C09 RSS monitor stop and cleanup both failed",
      );
    }
    throw error;
  }
  if (
    monitorExit.error !== undefined ||
    monitorExit.status !== 0 ||
    monitorExit.signal !== null
  ) {
    throw new Error(
      `C09 RSS monitor crashed: ${JSON.stringify(monitorExit)}\n${gate.readMonitorStderr()}`,
    );
  }
  await assertC09PrivateReportModeV1(
    gate.reportPath,
    "C09 RSS monitor report",
  );
  const report = parseExactJsonObjectV1(
    await readFile(gate.reportPath, "utf8"),
    "C09 RSS monitor report",
  );
  validateC09RssMonitorCompleteReportV1(report, {
    nonce: gate.nonce,
    rootPid: process.pid,
    monitorPid: gate.child.pid,
  });
  if (!enforceGates) return report;
  if (
    gate.startedAt === undefined ||
    gate.lastChildExitAt === undefined ||
    gate.lastChildExitAt < gate.startedAt
  ) {
    throw new Error("C09 dedicated wall-time sample is incomplete");
  }
  const wallTimeMs = gate.lastChildExitAt - gate.startedAt;
  if (wallTimeMs > C09_DEDICATED_GATE_MAX_WALL_MS) {
    throw new Error(
      `C09 dedicated distribution gate exceeded 600000 ms: ${wallTimeMs}`,
    );
  }
  if (
    report.peakSample.aggregateRssBytes >
    C09_DEDICATED_GATE_MAX_TREE_RSS_BYTES
  ) {
    const peakRoles = report.peakSample.processes.map(
      ({ pid, role, rssBytes }) => ({ pid, role, rssBytes }),
    );
    throw new Error(
      `C09 dedicated distribution gate exceeded 1536 MiB process-tree RSS: ${report.peakSample.aggregateRssBytes}; wallTimeMs=${wallTimeMs}; peakRoles=${JSON.stringify(peakRoles)}`,
    );
  }
  return Object.freeze({
    wallTimeMs,
    peakTreeRssBytes: report.peakSample.aggregateRssBytes,
    sampleCount: report.sampleCount,
    peakRoles: Object.freeze(
      report.peakSample.processes.map(({ pid, role, rssBytes }) =>
        Object.freeze({ pid, role, rssBytes }),
      ),
    ),
    countingPolicy: report.countingPolicy,
  });
}

const bareNodeBuiltinSpecifiers = new Set(
  builtinModules.map((specifier) => specifier.replace(/^node:/u, "")),
);

function findBrowserRuntimeDependency(source, options = {}) {
  const allowedStaticBareModuleSpecifiers = new Set(
    options.allowedStaticBareModuleSpecifiers ?? [],
  );
  const sourceFileName = "/browser-bundle.mjs";
  const sourceFile = ts.createSourceFile(
    sourceFileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  if (sourceFile.parseDiagnostics.length !== 0) {
    return "unparseable emitted JavaScript";
  }

  const compilerOptions = {
    allowJs: true,
    checkJs: true,
    module: ts.ModuleKind.ESNext,
    noLib: true,
    noResolve: true,
    target: ts.ScriptTarget.Latest,
  };
  const compilerHost = {
    fileExists(fileName) {
      return fileName === sourceFileName;
    },
    getCanonicalFileName(fileName) {
      return fileName;
    },
    getCurrentDirectory() {
      return "/";
    },
    getDefaultLibFileName() {
      return "/lib.d.ts";
    },
    getDirectories() {
      return [];
    },
    getNewLine() {
      return "\n";
    },
    getSourceFile(fileName) {
      return fileName === sourceFileName ? sourceFile : undefined;
    },
    readFile(fileName) {
      return fileName === sourceFileName ? source : undefined;
    },
    useCaseSensitiveFileNames() {
      return true;
    },
    writeFile() {},
  };
  const program = ts.createProgram(
    [sourceFileName],
    compilerOptions,
    compilerHost,
  );
  const checkedSourceFile = program.getSourceFile(sourceFileName);
  if (checkedSourceFile === undefined) {
    return "unbound emitted JavaScript";
  }
  const checker = program.getTypeChecker();

  const bareNodeRuntimeIdentifiers = new Set([
    "process",
    "Buffer",
    "require",
    "module",
    "exports",
    "__dirname",
    "__filename",
    "global",
  ]);
  const dynamicCodeIdentifiers = new Set([
    "eval",
    "Function",
    "AsyncFunction",
    "GeneratorFunction",
    "AsyncGeneratorFunction",
  ]);
  const ambientGlobalObjectIdentifiers = new Set([
    "globalThis",
    "window",
    "self",
    "global",
    "top",
    "parent",
    "frames",
    "opener",
  ]);
  const ambientNodeEscapeMembers = new Set([
    ...bareNodeRuntimeIdentifiers,
    ...dynamicCodeIdentifiers,
    ...ambientGlobalObjectIdentifiers,
  ]);
  const ambientGlobalAliasMembers = new Set([
    "top",
    "parent",
    "frames",
    "opener",
    "window",
    "self",
    "globalThis",
    "global",
  ]);
  const knownFunctionObjectIdentifiers = new Set([
    "Object",
    "Array",
    "String",
    "Number",
    "Boolean",
    "BigInt",
    "Symbol",
    "RegExp",
    "Date",
    "Promise",
    "Error",
    "EvalError",
    "RangeError",
    "ReferenceError",
    "SyntaxError",
    "TypeError",
    "URIError",
    "Map",
    "Set",
    "WeakMap",
    "WeakSet",
  ]);
  const knownArrayFunctionObjectMembers = new Set([
    "at",
    "concat",
    "copyWithin",
    "entries",
    "every",
    "fill",
    "filter",
    "find",
    "findIndex",
    "findLast",
    "findLastIndex",
    "flat",
    "flatMap",
    "forEach",
    "includes",
    "indexOf",
    "join",
    "keys",
    "lastIndexOf",
    "map",
    "pop",
    "push",
    "reduce",
    "reduceRight",
    "reverse",
    "shift",
    "slice",
    "some",
    "sort",
    "splice",
    "toLocaleString",
    "toReversed",
    "toSorted",
    "toSpliced",
    "toString",
    "unshift",
    "values",
    "with",
  ]);

  function classifyModuleSpecifier(specifier) {
    if (specifier.includes("__vite-browser-external")) {
      return "Vite browser-external shim";
    }
    if (specifier.startsWith("node:")) {
      return `Node builtin import ${specifier}`;
    }
    if (bareNodeBuiltinSpecifiers.has(specifier)) {
      return `bare Node builtin import ${specifier}`;
    }
    if (
      !specifier.startsWith("./") &&
      !specifier.startsWith("../") &&
      !specifier.startsWith("/")
    ) {
      return `bare external runtime import ${specifier}`;
    }
    return undefined;
  }

  function moduleSpecifierText(node) {
    return node !== undefined &&
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node))
      ? node.text
      : undefined;
  }

  function unwrapParentheses(node) {
    let current = node;
    while (ts.isParenthesizedExpression(current)) {
      current = current.expression;
    }
    return current;
  }

  function hasCurrentSourceDeclaration(node) {
    const shorthandValueSymbol =
      ts.isIdentifier(node) &&
      ts.isShorthandPropertyAssignment(node.parent) &&
      node.parent.name === node
        ? checker.getShorthandAssignmentValueSymbol(node.parent)
        : undefined;
    const symbol = shorthandValueSymbol ?? checker.getSymbolAtLocation(node);
    return (
      symbol?.declarations?.some(
        (declaration) =>
          declaration.getSourceFile() === checkedSourceFile &&
          (ts.isVariableDeclaration(declaration) ||
            ts.isParameter(declaration) ||
            ts.isBindingElement(declaration) ||
            ts.isFunctionDeclaration(declaration) ||
            ts.isFunctionExpression(declaration) ||
            ts.isClassDeclaration(declaration) ||
            ts.isClassExpression(declaration) ||
            ts.isImportClause(declaration) ||
            ts.isImportSpecifier(declaration) ||
            ts.isNamespaceImport(declaration) ||
            ts.isImportEqualsDeclaration(declaration)),
      ) ?? false
    );
  }

  function isValueReferenceIdentifier(node) {
    const shorthandReference =
      ts.isShorthandPropertyAssignment(node.parent) &&
      node.parent.name === node;
    if (shorthandReference) return true;
    if (
      (ts.isPropertyAccessExpression(node.parent) &&
        node.parent.name === node) ||
      ts.isDeclarationName(node)
    ) {
      return false;
    }
    return ts.isInExpressionContext(node);
  }

  function staticAccessName(node) {
    if (ts.isPropertyAccessExpression(node)) return node.name.text;
    const argument = unwrapParentheses(node.argumentExpression);
    return moduleSpecifierText(argument);
  }

  function ambientGlobalIdentifierFromExpression(node) {
    const expression = unwrapParentheses(node);
    return ts.isIdentifier(expression) &&
      ambientGlobalObjectIdentifiers.has(expression.text) &&
      !hasCurrentSourceDeclaration(expression)
      ? expression
      : undefined;
  }

  function isImportMeta(node) {
    const expression = unwrapParentheses(node);
    return (
      ts.isMetaProperty(expression) &&
      expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
      expression.name.text === "meta"
    );
  }

  function directStaticAccessForReceiver(node) {
    let expression = node;
    let parent = node.parent;
    while (
      parent !== undefined &&
      ts.isParenthesizedExpression(parent) &&
      parent.expression === expression
    ) {
      expression = parent;
      parent = parent.parent;
    }
    return (
      parent !== undefined &&
      (ts.isPropertyAccessExpression(parent) ||
        ts.isElementAccessExpression(parent)) &&
      parent.expression === expression
    )
      ? parent
      : undefined;
  }

  function isDirectStaticAccessReceiver(node) {
    return directStaticAccessForReceiver(node) !== undefined;
  }

  function isUnshadowedIdentifier(node, expectedName) {
    const expression = unwrapParentheses(node);
    return (
      ts.isIdentifier(expression) &&
      expression.text === expectedName &&
      !hasCurrentSourceDeclaration(expression)
    );
  }

  function expressionResolvesToExactGlobalIntrinsicV1(
    node,
    expectedName,
    seenSymbols = new Set(),
  ) {
    const expression = unwrapParentheses(node);
    if (isUnshadowedIdentifier(expression, expectedName)) return true;
    if (!ts.isIdentifier(expression)) return false;
    const symbol = checker.getSymbolAtLocation(expression);
    if (symbol === undefined || seenSymbols.has(symbol)) return false;
    seenSymbols.add(symbol);
    const declarations = symbol.declarations ?? [];
    return (
      declarations.length === 1 &&
      ts.isVariableDeclaration(declarations[0]) &&
      declarations[0].getSourceFile() === checkedSourceFile &&
      declarations[0].initializer !== undefined &&
      ts.isIdentifier(declarations[0].name) &&
      (declarations[0].parent.flags & ts.NodeFlags.Const) !== 0 &&
      expressionResolvesToExactGlobalIntrinsicV1(
        declarations[0].initializer,
        expectedName,
        seenSymbols,
      )
    );
  }

  function looksLikeFunctionPrototypeComputedAccess(node) {
    if (!ts.isElementAccessExpression(node)) return false;
    const receiver = unwrapParentheses(node.expression);
    if (
      !ts.isPropertyAccessExpression(receiver) &&
      !ts.isElementAccessExpression(receiver)
    ) {
      return false;
    }
    const functionIdentifier = unwrapParentheses(receiver.expression);
    return (
      staticAccessName(receiver) === "prototype" &&
      ts.isIdentifier(functionIdentifier) &&
      functionIdentifier.text === "Function"
    );
  }

  function isExactFunctionPrototypeHasInstanceAccess(node) {
    if (!looksLikeFunctionPrototypeComputedAccess(node)) return false;
    const receiver = unwrapParentheses(node.expression);
    const functionIdentifier = unwrapParentheses(receiver.expression);
    const key = unwrapParentheses(node.argumentExpression);
    return (
      isUnshadowedIdentifier(functionIdentifier, "Function") &&
      (ts.isPropertyAccessExpression(key) ||
        ts.isElementAccessExpression(key)) &&
      staticAccessName(key) === "hasInstance" &&
      isUnshadowedIdentifier(key.expression, "Symbol")
    );
  }

  function isExactFunctionPrototypeSafeMemberAccess(node) {
    if (
      ts.isElementAccessExpression(node) &&
      isExactFunctionPrototypeHasInstanceAccess(node)
    ) {
      return true;
    }
    if (!ts.isPropertyAccessExpression(node)) return false;
    const receiver = unwrapParentheses(node.expression);
    if (
      (!ts.isPropertyAccessExpression(receiver) &&
        !ts.isElementAccessExpression(receiver)) ||
      staticAccessName(receiver) !== "prototype" ||
      !isUnshadowedIdentifier(receiver.expression, "Function")
    ) {
      return false;
    }
    return node.name.text === "call" || node.name.text === "bind";
  }

  function isFunctionIdentifierInExactSafeMemberAccess(node) {
    let expression = node;
    let parent = node.parent;
    while (
      parent !== undefined &&
      ts.isParenthesizedExpression(parent) &&
      parent.expression === expression
    ) {
      expression = parent;
      parent = parent.parent;
    }
    if (
      parent === undefined ||
      (!ts.isPropertyAccessExpression(parent) &&
        !ts.isElementAccessExpression(parent)) ||
      parent.expression !== expression ||
      staticAccessName(parent) !== "prototype"
    ) {
      return false;
    }
    expression = parent;
    parent = parent.parent;
    while (
      parent !== undefined &&
      ts.isParenthesizedExpression(parent) &&
      parent.expression === expression
    ) {
      expression = parent;
      parent = parent.parent;
    }
    return (
      parent !== undefined &&
      (ts.isPropertyAccessExpression(parent) ||
        ts.isElementAccessExpression(parent)) &&
      parent.expression === expression &&
      isExactFunctionPrototypeSafeMemberAccess(parent)
    );
  }

  function isSafeAmbientStaticAccessReceiver(node) {
    const access = directStaticAccessForReceiver(node);
    if (access === undefined) return false;
    const accessName = staticAccessName(access);
    return (
      accessName !== undefined &&
      accessName !== "constructor" &&
      !ambientNodeEscapeMembers.has(accessName) &&
      !ambientGlobalAliasMembers.has(accessName)
    );
  }

  const safeAmbientSimpleAliasSymbols = new Map();
  function symbolAtLocationResolvesTo(node, expectedSymbol) {
    const shorthandValueSymbol =
      ts.isIdentifier(node) &&
      ts.isShorthandPropertyAssignment(node.parent) &&
      node.parent.name === node
        ? checker.getShorthandAssignmentValueSymbol(node.parent)
        : undefined;
    let symbol = shorthandValueSymbol ?? checker.getSymbolAtLocation(node);
    const seen = new Set();
    while (
      symbol !== undefined &&
      symbol !== expectedSymbol &&
      (symbol.flags & ts.SymbolFlags.Alias) !== 0 &&
      !seen.has(symbol)
    ) {
      seen.add(symbol);
      symbol = checker.getAliasedSymbol(symbol);
    }
    return symbol === expectedSymbol;
  }

  function isSafeAmbientSimpleAliasAssignment(node) {
    const assignment = node.parent;
    if (
      !ts.isBinaryExpression(assignment) ||
      assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
      unwrapParentheses(assignment.right) !== node ||
      !isSafeAmbientStaticAccessReceiver(assignment)
    ) {
      return false;
    }
    const alias = unwrapParentheses(assignment.left);
    if (!ts.isIdentifier(alias)) return false;
    const symbol = checker.getSymbolAtLocation(alias);
    if (symbol === undefined) return false;
    const memoized = safeAmbientSimpleAliasSymbols.get(symbol);
    if (memoized !== undefined) return memoized;
    safeAmbientSimpleAliasSymbols.set(symbol, false);
    const declarations = symbol.declarations ?? [];
    if (
      declarations.length !== 1 ||
      !ts.isVariableDeclaration(declarations[0]) ||
      declarations[0].getSourceFile() !== checkedSourceFile ||
      declarations[0].initializer !== undefined ||
      !ts.isIdentifier(declarations[0].name)
    ) {
      return false;
    }
    const declarationStatement = declarations[0].parent.parent;
    if (
      ts.isVariableStatement(declarationStatement) &&
      declarationStatement.modifiers?.some(
        ({ kind }) => kind === ts.SyntaxKind.ExportKeyword,
      )
    ) {
      return false;
    }
    let safe = true;
    function validateAliasReference(candidate) {
      if (!safe) return;
      if (
        ts.isIdentifier(candidate) &&
        symbolAtLocationResolvesTo(candidate, symbol)
      ) {
        if (candidate === declarations[0].name || candidate === alias) return;
        if (!isSafeAmbientStaticAccessReceiver(candidate)) safe = false;
      }
      ts.forEachChild(candidate, validateAliasReference);
    }
    validateAliasReference(checkedSourceFile);
    safeAmbientSimpleAliasSymbols.set(symbol, safe);
    return safe;
  }

  function isExactGlobalStructuredCloneDescriptorOperation(node) {
    let argument = node;
    let parent = node.parent;
    while (
      parent !== undefined &&
      ts.isParenthesizedExpression(parent) &&
      parent.expression === argument
    ) {
      argument = parent;
      parent = parent.parent;
    }
    if (
      parent === undefined ||
      !ts.isCallExpression(parent) ||
      parent.arguments[0] !== argument
    ) {
      return false;
    }
    const callee = unwrapParentheses(parent.expression);
    if (
      !(
        ts.isPropertyAccessExpression(callee) ||
        ts.isElementAccessExpression(callee)
      ) ||
      !isUnshadowedIdentifier(callee.expression, "Object") ||
      moduleSpecifierText(unwrapParentheses(parent.arguments[1])) !==
        "structuredClone"
    ) {
      return false;
    }
    const operation = staticAccessName(callee);
    return (
      (operation === "getOwnPropertyDescriptor" &&
        parent.arguments.length === 2) ||
      (operation === "defineProperty" && parent.arguments.length === 3)
    );
  }

  function expressionResolvesToAmbientGlobal(node, seenSymbols = new Set()) {
    const expression = unwrapParentheses(node);
    const directAmbientGlobal =
      ambientGlobalIdentifierFromExpression(expression);
    if (directAmbientGlobal !== undefined) return true;
    if (ts.isIdentifier(expression)) {
      const symbol = checker.getSymbolAtLocation(expression);
      if (symbol === undefined || seenSymbols.has(symbol)) return false;
      seenSymbols.add(symbol);
      return (
        symbol.declarations?.some(
          (declaration) =>
            ts.isVariableDeclaration(declaration) &&
            declaration.initializer !== undefined &&
            expressionResolvesToAmbientGlobal(
              declaration.initializer,
              seenSymbols,
            ),
        ) ?? false
      );
    }
    if (
      ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression)
    ) {
      const accessName = staticAccessName(expression);
      if (
        accessName !== undefined &&
        ambientGlobalAliasMembers.has(accessName) &&
        expressionResolvesToAmbientGlobal(expression.expression, seenSymbols)
      ) {
        return true;
      }
      if (
        accessName === "defaultView" &&
        (ts.isPropertyAccessExpression(expression.expression) ||
          ts.isElementAccessExpression(expression.expression)) &&
        staticAccessName(expression.expression) === "document" &&
        expressionResolvesToAmbientGlobal(
          expression.expression.expression,
          seenSymbols,
        )
      ) {
        return true;
      }
      return false;
    }
    if (ts.isCallExpression(expression)) {
      const callee = unwrapParentheses(expression.expression);
      return (
        (ts.isPropertyAccessExpression(callee) ||
          ts.isElementAccessExpression(callee)) &&
        staticAccessName(callee) === "valueOf" &&
        expression.arguments.length === 0 &&
        expressionResolvesToAmbientGlobal(callee.expression, seenSymbols)
      );
    }
    return false;
  }

  function isSafeConstructorNameObservation(node) {
    if (staticAccessName(node) !== "constructor") return false;
    let expression = node;
    let parent = node.parent;
    while (
      parent !== undefined &&
      ts.isParenthesizedExpression(parent) &&
      parent.expression === expression
    ) {
      expression = parent;
      parent = parent.parent;
    }
    return (
      parent !== undefined &&
      (ts.isPropertyAccessExpression(parent) ||
        ts.isElementAccessExpression(parent)) &&
      parent.expression === expression &&
      staticAccessName(parent) === "name"
    );
  }

  const safeConstructorIntrospectionAliases = new Map();
  const safePrototypeIntrospectionAliases = new Map();
  function isUndefinedValueExpression(node) {
    const expression = unwrapParentheses(node);
    return (
      (ts.isIdentifier(expression) &&
        expression.text === "undefined" &&
        !hasCurrentSourceDeclaration(expression)) ||
      (ts.isVoidExpression(expression) &&
        ts.isNumericLiteral(unwrapParentheses(expression.expression)) &&
        unwrapParentheses(expression.expression).text === "0")
    );
  }

  function isSafeConstructorIntrospectionAlias(node) {
    let initializer = node;
    let parent = node.parent;
    while (
      parent !== undefined &&
      ts.isParenthesizedExpression(parent) &&
      parent.expression === initializer
    ) {
      initializer = parent;
      parent = parent.parent;
    }
    if (
      parent === undefined ||
      !ts.isVariableDeclaration(parent) ||
      parent.initializer !== initializer ||
      !ts.isIdentifier(parent.name) ||
      (parent.parent.flags & ts.NodeFlags.Const) === 0
    ) {
      return false;
    }
    const declaration = parent;
    const declarationStatement = declaration.parent.parent;
    if (
      !ts.isVariableStatement(declarationStatement) ||
      declarationStatement.modifiers?.some(
        ({ kind }) => kind === ts.SyntaxKind.ExportKeyword,
      )
    ) {
      return false;
    }
    const symbol = checker.getSymbolAtLocation(declaration.name);
    if (symbol === undefined) return false;
    const memoized = safeConstructorIntrospectionAliases.get(symbol);
    if (memoized !== undefined) return memoized;
    safeConstructorIntrospectionAliases.set(symbol, false);
    if (
      symbol.declarations?.length !== 1 ||
      symbol.declarations[0] !== declaration
    ) {
      return false;
    }

    let safe = true;
    let undefinedObservationCount = 0;
    let typeofObservationCount = 0;
    let prototypeObservationCount = 0;
    function validateAliasReference(candidate) {
      if (!safe) return;
      if (
        ts.isIdentifier(candidate) &&
        symbolAtLocationResolvesTo(candidate, symbol)
      ) {
        if (candidate === declaration.name) return;
        let reference = candidate;
        let referenceParent = candidate.parent;
        while (
          referenceParent !== undefined &&
          ts.isParenthesizedExpression(referenceParent) &&
          referenceParent.expression === reference
        ) {
          reference = referenceParent;
          referenceParent = referenceParent.parent;
        }
        if (
          referenceParent !== undefined &&
          ts.isTypeOfExpression(referenceParent) &&
          referenceParent.expression === reference
        ) {
          typeofObservationCount += 1;
          return;
        }
        if (
          referenceParent !== undefined &&
          (ts.isPropertyAccessExpression(referenceParent) ||
            ts.isElementAccessExpression(referenceParent)) &&
          referenceParent.expression === reference &&
          staticAccessName(referenceParent) === "prototype" &&
          isSafePrototypeIntrospectionResult(referenceParent)
        ) {
          prototypeObservationCount += 1;
          return;
        }
        if (
          referenceParent !== undefined &&
          ts.isBinaryExpression(referenceParent) &&
          (referenceParent.operatorToken.kind ===
            ts.SyntaxKind.EqualsEqualsEqualsToken ||
            referenceParent.operatorToken.kind ===
              ts.SyntaxKind.ExclamationEqualsEqualsToken) &&
          ((referenceParent.left === reference &&
            isUndefinedValueExpression(referenceParent.right)) ||
            (referenceParent.right === reference &&
              isUndefinedValueExpression(referenceParent.left)))
        ) {
          undefinedObservationCount += 1;
          return;
        }
        safe = false;
        return;
      }
      ts.forEachChild(candidate, validateAliasReference);
    }
    validateAliasReference(checkedSourceFile);
    const accepted =
      safe &&
      undefinedObservationCount === 1 &&
      typeofObservationCount === 1 &&
      prototypeObservationCount === 1;
    safeConstructorIntrospectionAliases.set(symbol, accepted);
    return accepted;
  }

  function isSafePrototypeIntrospectionResult(node) {
    let initializer = node;
    let parent = node.parent;
    while (
      parent !== undefined &&
      ts.isParenthesizedExpression(parent) &&
      parent.expression === initializer
    ) {
      initializer = parent;
      parent = parent.parent;
    }
    if (
      parent === undefined ||
      !ts.isVariableDeclaration(parent) ||
      parent.initializer !== initializer ||
      !ts.isIdentifier(parent.name) ||
      (parent.parent.flags & ts.NodeFlags.Const) === 0
    ) {
      return false;
    }
    const declaration = parent;
    const declarationStatement = declaration.parent.parent;
    if (
      !ts.isVariableStatement(declarationStatement) ||
      declarationStatement.modifiers?.some(
        ({ kind }) => kind === ts.SyntaxKind.ExportKeyword,
      )
    ) {
      return false;
    }
    const symbol = checker.getSymbolAtLocation(declaration.name);
    if (symbol === undefined) return false;
    const memoized = safePrototypeIntrospectionAliases.get(symbol);
    if (memoized !== undefined) return memoized;
    safePrototypeIntrospectionAliases.set(symbol, false);
    if (
      symbol.declarations?.length !== 1 ||
      symbol.declarations[0] !== declaration
    ) {
      return false;
    }

    let safe = true;
    let typeofObservationCount = 0;
    let nullObservationCount = 0;
    let arrayObservationCount = 0;
    let hasOwnPropertyObservationCount = 0;
    function validatePrototypeReference(candidate) {
      if (!safe) return;
      if (
        ts.isIdentifier(candidate) &&
        symbolAtLocationResolvesTo(candidate, symbol)
      ) {
        if (candidate === declaration.name) return;
        let reference = candidate;
        let referenceParent = candidate.parent;
        while (
          referenceParent !== undefined &&
          ts.isParenthesizedExpression(referenceParent) &&
          referenceParent.expression === reference
        ) {
          reference = referenceParent;
          referenceParent = referenceParent.parent;
        }
        if (
          referenceParent !== undefined &&
          ts.isTypeOfExpression(referenceParent) &&
          referenceParent.expression === reference
        ) {
          typeofObservationCount += 1;
          return;
        }
        if (
          referenceParent !== undefined &&
          ts.isBinaryExpression(referenceParent) &&
          (referenceParent.operatorToken.kind ===
            ts.SyntaxKind.EqualsEqualsEqualsToken ||
            referenceParent.operatorToken.kind ===
              ts.SyntaxKind.ExclamationEqualsEqualsToken) &&
          ((referenceParent.left === reference &&
            unwrapParentheses(referenceParent.right).kind ===
              ts.SyntaxKind.NullKeyword) ||
            (referenceParent.right === reference &&
              unwrapParentheses(referenceParent.left).kind ===
                ts.SyntaxKind.NullKeyword))
        ) {
          nullObservationCount += 1;
          return;
        }
        if (
          referenceParent !== undefined &&
          ts.isCallExpression(referenceParent) &&
          referenceParent.arguments.length === 1 &&
          referenceParent.arguments[0] === reference &&
          (ts.isPropertyAccessExpression(referenceParent.expression) ||
            ts.isElementAccessExpression(referenceParent.expression)) &&
          staticAccessName(referenceParent.expression) === "isArray" &&
          isUnshadowedIdentifier(referenceParent.expression.expression, "Array")
        ) {
          arrayObservationCount += 1;
          return;
        }
        if (
          referenceParent !== undefined &&
          ts.isCallExpression(referenceParent) &&
          referenceParent.arguments.length === 2 &&
          referenceParent.arguments[0] === reference &&
          moduleSpecifierText(
            unwrapParentheses(referenceParent.arguments[1]),
          ) === "isPrototypeOf"
        ) {
          const callAccess = unwrapParentheses(referenceParent.expression);
          const hasOwnPropertyAccess =
            (ts.isPropertyAccessExpression(callAccess) ||
              ts.isElementAccessExpression(callAccess)) &&
            staticAccessName(callAccess) === "call"
              ? unwrapParentheses(callAccess.expression)
              : undefined;
          const prototypeAccess =
            hasOwnPropertyAccess !== undefined &&
            (ts.isPropertyAccessExpression(hasOwnPropertyAccess) ||
              ts.isElementAccessExpression(hasOwnPropertyAccess)) &&
            staticAccessName(hasOwnPropertyAccess) === "hasOwnProperty"
              ? unwrapParentheses(hasOwnPropertyAccess.expression)
              : undefined;
          if (
            prototypeAccess !== undefined &&
            (ts.isPropertyAccessExpression(prototypeAccess) ||
              ts.isElementAccessExpression(prototypeAccess)) &&
            staticAccessName(prototypeAccess) === "prototype" &&
            isUnshadowedIdentifier(prototypeAccess.expression, "Object")
          ) {
            hasOwnPropertyObservationCount += 1;
            return;
          }
        }
        safe = false;
        return;
      }
      ts.forEachChild(candidate, validatePrototypeReference);
    }
    validatePrototypeReference(checkedSourceFile);
    const accepted =
      safe &&
      typeofObservationCount === 1 &&
      nullObservationCount === 1 &&
      arrayObservationCount === 1 &&
      hasOwnPropertyObservationCount === 1;
    safePrototypeIntrospectionAliases.set(symbol, accepted);
    return accepted;
  }

  function isDiscardedConstructorTruthinessObservation(node) {
    let expression = node;
    let parent = node.parent;
    while (
      parent !== undefined &&
      ts.isParenthesizedExpression(parent) &&
      parent.expression === expression
    ) {
      expression = parent;
      parent = parent.parent;
    }
    if (
      parent === undefined ||
      !ts.isBinaryExpression(parent) ||
      parent.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken ||
      parent.right !== expression
    ) {
      return false;
    }
    expression = parent;
    parent = parent.parent;
    while (
      parent !== undefined &&
      ((ts.isParenthesizedExpression(parent) &&
        parent.expression === expression) ||
        (ts.isBinaryExpression(parent) &&
          parent.operatorToken.kind ===
            ts.SyntaxKind.AmpersandAmpersandToken &&
          (parent.left === expression || parent.right === expression)))
    ) {
      expression = parent;
      parent = parent.parent;
    }
    return parent !== undefined && ts.isIfStatement(parent) && parent.expression === expression;
  }

  function expressionResolvesToFunctionObject(node, seenSymbols = new Set()) {
    const expression = unwrapParentheses(node);
    if (
      ts.isArrowFunction(expression) ||
      ts.isFunctionExpression(expression) ||
      ts.isClassExpression(expression)
    ) {
      return true;
    }
    if (ts.isIdentifier(expression)) {
      if (
        knownFunctionObjectIdentifiers.has(expression.text) &&
        !hasCurrentSourceDeclaration(expression)
      ) {
        return true;
      }
      const symbol = checker.getSymbolAtLocation(expression);
      if (symbol === undefined || seenSymbols.has(symbol)) return false;
      seenSymbols.add(symbol);
      return (
        symbol.declarations?.some((declaration) => {
          if (
            ts.isFunctionDeclaration(declaration) ||
            ts.isClassDeclaration(declaration)
          ) {
            return true;
          }
          return (
            ts.isVariableDeclaration(declaration) &&
            declaration.initializer !== undefined &&
            expressionResolvesToFunctionObject(
              declaration.initializer,
              seenSymbols,
            )
          );
        }) ?? false
      );
    }
    if (
      (ts.isPropertyAccessExpression(expression) ||
        ts.isElementAccessExpression(expression)) &&
      staticAccessName(expression) !== undefined
    ) {
      const accessName = staticAccessName(expression);
      if (accessName === "constructor") {
        // Reading an ordinary object's `.constructor` is not itself a dynamic
        // code escape.  Treating the resulting value as a function lets the
        // outer `.constructor` in `value.constructor.constructor` be caught
        // without rejecting ordinary Zod-style `value.constructor.name` reads.
        return true;
      }
      if (
        accessName === "__proto__" &&
        expressionResolvesToFunctionObject(expression.expression, seenSymbols)
      ) {
        return true;
      }
      if (
        knownArrayFunctionObjectMembers.has(accessName) &&
        ts.isArrayLiteralExpression(unwrapParentheses(expression.expression))
      ) {
        return true;
      }
      const ambientGlobal = ambientGlobalIdentifierFromExpression(
        expression.expression,
      );
      if (
        ambientGlobal !== undefined &&
        knownFunctionObjectIdentifiers.has(staticAccessName(expression))
      ) {
        return true;
      }
      const propertySymbol = checker.getSymbolAtLocation(
        ts.isPropertyAccessExpression(expression)
          ? expression.name
          : expression.argumentExpression,
      );
      return (
        propertySymbol?.declarations?.some((declaration) => {
          if (ts.isMethodDeclaration(declaration)) return true;
          return (
            ts.isPropertyAssignment(declaration) &&
            expressionResolvesToFunctionObject(
              declaration.initializer,
              seenSymbols,
            )
          );
        }) ?? false
      );
    }
    if (ts.isCallExpression(expression)) {
      const callee = unwrapParentheses(expression.expression);
      if (
        (ts.isPropertyAccessExpression(callee) ||
          ts.isElementAccessExpression(callee)) &&
        staticAccessName(callee) === "bind" &&
        expressionResolvesToFunctionObject(callee.expression, seenSymbols)
      ) {
        return true;
      }
      if (
        (ts.isPropertyAccessExpression(callee) ||
          ts.isElementAccessExpression(callee)) &&
        staticAccessName(callee) === "getPrototypeOf" &&
        (isUnshadowedIdentifier(callee.expression, "Object") ||
          isUnshadowedIdentifier(callee.expression, "Reflect")) &&
        expression.arguments.length === 1
      ) {
        return expressionResolvesToFunctionObject(
          expression.arguments[0],
          seenSymbols,
        );
      }
      if (
        (ts.isPropertyAccessExpression(callee) ||
          ts.isElementAccessExpression(callee)) &&
        staticAccessName(callee) === "get" &&
        isUnshadowedIdentifier(callee.expression, "Reflect") &&
        expression.arguments.length >= 2 &&
        moduleSpecifierText(unwrapParentheses(expression.arguments[1])) ===
          "constructor"
      ) {
        return true;
      }
    }
    return false;
  }

  function isUnshadowedReflectGetCall(node) {
    if (!ts.isCallExpression(node)) return false;
    const callee = unwrapParentheses(node.expression);
    return (
      (ts.isPropertyAccessExpression(callee) ||
        ts.isElementAccessExpression(callee)) &&
      staticAccessName(callee) === "get" &&
      expressionResolvesToExactGlobalIntrinsicV1(callee.expression, "Reflect")
    );
  }

  function isUnshadowedObjectGetOwnPropertyDescriptorCall(node) {
    if (!ts.isCallExpression(node)) return false;
    const callee = unwrapParentheses(node.expression);
    return (
      (ts.isPropertyAccessExpression(callee) ||
        ts.isElementAccessExpression(callee)) &&
      staticAccessName(callee) === "getOwnPropertyDescriptor" &&
      isUnshadowedIdentifier(callee.expression, "Object")
    );
  }

  function isUnshadowedReflectGetOwnPropertyDescriptorCall(node) {
    if (!ts.isCallExpression(node)) return false;
    const callee = unwrapParentheses(node.expression);
    return (
      (ts.isPropertyAccessExpression(callee) ||
        ts.isElementAccessExpression(callee)) &&
      staticAccessName(callee) === "getOwnPropertyDescriptor" &&
      expressionResolvesToExactGlobalIntrinsicV1(callee.expression, "Reflect")
    );
  }

  function isExactGlobalObjectGetOwnPropertyDescriptorCallV1(node) {
    if (!ts.isCallExpression(node)) return false;
    const callee = unwrapParentheses(node.expression);
    return (
      (ts.isPropertyAccessExpression(callee) ||
        ts.isElementAccessExpression(callee)) &&
      staticAccessName(callee) === "getOwnPropertyDescriptor" &&
      expressionResolvesToExactGlobalIntrinsicV1(callee.expression, "Object")
    );
  }

  function isUnshadowedDescriptorReflectionCall(node) {
    return (
      isExactGlobalObjectGetOwnPropertyDescriptorCallV1(node) ||
      isUnshadowedReflectGetOwnPropertyDescriptorCall(node)
    );
  }

  const safeOpaqueNativePromiseDescriptorRoundTrips = new Map();
  function expressionResolvesToExactNativePromiseV1(
    node,
    seenSymbols = new Set(),
  ) {
    const expression = unwrapParentheses(node);
    if (
      ts.isIdentifier(expression) &&
      expression.text === "Promise" &&
      !hasCurrentSourceDeclaration(expression)
    ) {
      return true;
    }
    if (!ts.isIdentifier(expression)) return false;
    const symbol = checker.getSymbolAtLocation(expression);
    if (symbol === undefined || seenSymbols.has(symbol)) return false;
    seenSymbols.add(symbol);
    const declarations = symbol.declarations ?? [];
    return (
      declarations.length === 1 &&
      ts.isVariableDeclaration(declarations[0]) &&
      declarations[0].initializer !== undefined &&
      ts.isIdentifier(declarations[0].name) &&
      (declarations[0].parent.flags & ts.NodeFlags.Const) !== 0 &&
      expressionResolvesToExactNativePromiseV1(
        declarations[0].initializer,
        seenSymbols,
      )
    );
  }

  function expressionResolvesToExactNativePromisePrototypeV1(node) {
    const expression = unwrapParentheses(node);
    return (
      (ts.isPropertyAccessExpression(expression) ||
        ts.isElementAccessExpression(expression)) &&
      staticAccessName(expression) === "prototype" &&
      expressionResolvesToExactNativePromiseV1(expression.expression)
    );
  }

  function isExactConstructorStringLiteralV1(node) {
    const expression = unwrapParentheses(node);
    return ts.isStringLiteral(expression) && expression.text === "constructor";
  }

  function isExactUnshadowedSymbolSpeciesV1(node) {
    const expression = unwrapParentheses(node);
    return (
      ts.isPropertyAccessExpression(expression) &&
      expression.name.text === "species" &&
      isUnshadowedIdentifier(expression.expression, "Symbol")
    );
  }

  function exactOpaqueNativePromiseDescriptorProfileV1(target, key) {
    if (
      expressionResolvesToExactNativePromisePrototypeV1(target) &&
      isExactConstructorStringLiteralV1(key)
    ) {
      return "promise_prototype_constructor";
    }
    if (
      expressionResolvesToExactNativePromiseV1(target) &&
      isExactUnshadowedSymbolSpeciesV1(key)
    ) {
      return "promise_symbol_species";
    }
    return undefined;
  }

  const exactGlobalPromiseTargetIdentityV1 = Object.freeze({});
  function exactNativePromiseTargetIdentityV1(node) {
    const expression = unwrapParentheses(node);
    if (
      ts.isIdentifier(expression) &&
      expression.text === "Promise" &&
      !hasCurrentSourceDeclaration(expression)
    ) {
      return exactGlobalPromiseTargetIdentityV1;
    }
    return ts.isIdentifier(expression) &&
      expressionResolvesToExactNativePromiseV1(expression)
      ? checker.getSymbolAtLocation(expression)
      : undefined;
  }

  function exactOpaqueNativePromiseProfileTargetIdentityV1(profile, target) {
    const expression = unwrapParentheses(target);
    if (profile === "promise_prototype_constructor") {
      if (
        (!ts.isPropertyAccessExpression(expression) &&
          !ts.isElementAccessExpression(expression)) ||
        staticAccessName(expression) !== "prototype"
      ) {
        return undefined;
      }
      return exactNativePromiseTargetIdentityV1(expression.expression);
    }
    return profile === "promise_symbol_species"
      ? exactNativePromiseTargetIdentityV1(expression)
      : undefined;
  }

  function isExactOpaqueNativePromiseDescriptorRoundTripV1(node) {
    const profile =
      node.arguments.length === 2
        ? exactOpaqueNativePromiseDescriptorProfileV1(
            node.arguments[0],
            node.arguments[1],
          )
        : undefined;
    if (
      !isUnshadowedObjectGetOwnPropertyDescriptorCall(node) ||
      profile === undefined
    ) {
      return false;
    }
    const targetIdentity =
      exactOpaqueNativePromiseProfileTargetIdentityV1(
        profile,
        node.arguments[0],
      );
    if (targetIdentity === undefined) return false;
    let initializer = node;
    let parent = node.parent;
    while (
      parent !== undefined &&
      ts.isParenthesizedExpression(parent) &&
      parent.expression === initializer
    ) {
      initializer = parent;
      parent = parent.parent;
    }
    if (
      parent === undefined ||
      !ts.isVariableDeclaration(parent) ||
      parent.initializer !== initializer ||
      !ts.isIdentifier(parent.name) ||
      (parent.parent.flags & ts.NodeFlags.Const) === 0
    ) {
      return false;
    }
    const declaration = parent;
    const declarationStatement = declaration.parent.parent;
    if (
      !ts.isVariableStatement(declarationStatement) ||
      declarationStatement.modifiers?.some(
        ({ kind }) => kind === ts.SyntaxKind.ExportKeyword,
      )
    ) {
      return false;
    }
    const symbol = checker.getSymbolAtLocation(declaration.name);
    if (symbol === undefined) return false;
    const memoized =
      safeOpaqueNativePromiseDescriptorRoundTrips.get(symbol);
    if (memoized !== undefined) return memoized;
    safeOpaqueNativePromiseDescriptorRoundTrips.set(symbol, false);
    if (
      symbol.declarations?.length !== 1 ||
      symbol.declarations[0] !== declaration
    ) {
      return false;
    }

    let safe = true;
    let undefinedGuardCount = 0;
    let exactRestoreCount = 0;
    function validateDescriptorReference(candidate) {
      if (!safe) return;
      if (
        ts.isIdentifier(candidate) &&
        symbolAtLocationResolvesTo(candidate, symbol)
      ) {
        if (candidate === declaration.name) return;
        let reference = candidate;
        let referenceParent = candidate.parent;
        while (
          referenceParent !== undefined &&
          ts.isParenthesizedExpression(referenceParent) &&
          referenceParent.expression === reference
        ) {
          reference = referenceParent;
          referenceParent = referenceParent.parent;
        }
        if (
          referenceParent !== undefined &&
          ts.isBinaryExpression(referenceParent) &&
          (referenceParent.operatorToken.kind ===
            ts.SyntaxKind.EqualsEqualsEqualsToken ||
            referenceParent.operatorToken.kind ===
              ts.SyntaxKind.ExclamationEqualsEqualsToken) &&
          ((referenceParent.left === reference &&
            isUndefinedValueExpression(referenceParent.right)) ||
            (referenceParent.right === reference &&
              isUndefinedValueExpression(referenceParent.left)))
        ) {
          let guard = referenceParent;
          let guardParent = guard.parent;
          while (
            guardParent !== undefined &&
            ts.isParenthesizedExpression(guardParent) &&
            guardParent.expression === guard
          ) {
            guard = guardParent;
            guardParent = guardParent.parent;
          }
          if (
            guardParent !== undefined &&
            ts.isIfStatement(guardParent) &&
            guardParent.expression === guard
          ) {
            undefinedGuardCount += 1;
            return;
          }
        }
        if (
          referenceParent !== undefined &&
          ts.isCallExpression(referenceParent) &&
          referenceParent.arguments.length === 3 &&
          referenceParent.arguments[2] === reference
        ) {
          const callee = unwrapParentheses(referenceParent.expression);
          if (
            (ts.isPropertyAccessExpression(callee) ||
              ts.isElementAccessExpression(callee)) &&
            staticAccessName(callee) === "defineProperty" &&
            isUnshadowedIdentifier(callee.expression, "Object") &&
            exactOpaqueNativePromiseDescriptorProfileV1(
              referenceParent.arguments[0],
              referenceParent.arguments[1],
            ) === profile &&
            exactOpaqueNativePromiseProfileTargetIdentityV1(
              profile,
              referenceParent.arguments[0],
            ) === targetIdentity
          ) {
            exactRestoreCount += 1;
            return;
          }
        }
        safe = false;
        return;
      }
      ts.forEachChild(candidate, validateDescriptorReference);
    }
    validateDescriptorReference(checkedSourceFile);
    const accepted =
      safe && undefinedGuardCount === 1 && exactRestoreCount === 1;
    safeOpaqueNativePromiseDescriptorRoundTrips.set(symbol, accepted);
    return accepted;
  }

  function isDiscardedComputedDescriptorExistenceObservation(node) {
    if (
      !isUnshadowedDescriptorReflectionCall(node) ||
      node.arguments.length !== 2 ||
      moduleSpecifierText(unwrapParentheses(node.arguments[1])) !== undefined
    ) {
      return false;
    }
    let expression = node;
    let parent = node.parent;
    while (
      parent !== undefined &&
      ts.isParenthesizedExpression(parent) &&
      parent.expression === expression
    ) {
      expression = parent;
      parent = parent.parent;
    }
    return (
      parent !== undefined &&
      ts.isBinaryExpression(parent) &&
      (parent.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
        parent.operatorToken.kind ===
          ts.SyntaxKind.ExclamationEqualsEqualsToken) &&
      ((parent.left === expression &&
        isUndefinedValueExpression(parent.right)) ||
        (parent.right === expression &&
          isUndefinedValueExpression(parent.left)))
    );
  }

  function reflectionIntrinsicKindFromExpressionV1(
    node,
    seenSymbols = new Set(),
  ) {
    const expression = unwrapParentheses(node);
    if (
      ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression)
    ) {
      const member = staticAccessName(expression);
      if (
        member === "getOwnPropertyDescriptor" &&
        (expressionResolvesToExactGlobalIntrinsicV1(
          expression.expression,
          "Object",
        ) ||
          expressionResolvesToExactGlobalIntrinsicV1(
            expression.expression,
            "Reflect",
          ))
      ) {
        return "descriptor";
      }
      if (
        member === "getOwnPropertyDescriptors" &&
        expressionResolvesToExactGlobalIntrinsicV1(
          expression.expression,
          "Object",
        )
      ) {
        return "descriptors";
      }
      if (
        member === "get" &&
        expressionResolvesToExactGlobalIntrinsicV1(
          expression.expression,
          "Reflect",
        )
      ) {
        return "get";
      }
      return undefined;
    }
    if (!ts.isIdentifier(expression)) return undefined;
    const symbol = checker.getSymbolAtLocation(expression);
    if (symbol === undefined || seenSymbols.has(symbol)) return undefined;
    seenSymbols.add(symbol);
    for (const declaration of symbol.declarations ?? []) {
      if (
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer !== undefined &&
        (declaration.parent.flags & ts.NodeFlags.Const) !== 0
      ) {
        const kind = reflectionIntrinsicKindFromExpressionV1(
          declaration.initializer,
          seenSymbols,
        );
        if (kind !== undefined) return kind;
      }
    }
    return undefined;
  }

  function resolvesToExactFunctionPrototypeCallV1(
    node,
    seenSymbols = new Set(),
  ) {
    const expression = unwrapParentheses(node);
    if (
      ts.isPropertyAccessExpression(expression) &&
      expression.name.text === "call"
    ) {
      const prototypeAccess = unwrapParentheses(expression.expression);
      return (
        (ts.isPropertyAccessExpression(prototypeAccess) ||
          ts.isElementAccessExpression(prototypeAccess)) &&
        staticAccessName(prototypeAccess) === "prototype" &&
        isUnshadowedIdentifier(prototypeAccess.expression, "Function")
      );
    }
    if (!ts.isIdentifier(expression)) return false;
    const symbol = checker.getSymbolAtLocation(expression);
    if (symbol === undefined || seenSymbols.has(symbol)) return false;
    seenSymbols.add(symbol);
    return (
      symbol.declarations?.some(
        (declaration) =>
          ts.isVariableDeclaration(declaration) &&
          declaration.initializer !== undefined &&
          (declaration.parent.flags & ts.NodeFlags.Const) !== 0 &&
          resolvesToExactFunctionPrototypeCallV1(
            declaration.initializer,
            seenSymbols,
          ),
      ) ?? false
    );
  }

  function staticStringValueV1(node, seenSymbols = new Set()) {
    const expression = unwrapParentheses(node);
    if (
      ts.isStringLiteral(expression) ||
      ts.isNoSubstitutionTemplateLiteral(expression)
    ) {
      return expression.text;
    }
    if (!ts.isIdentifier(expression)) return undefined;
    const symbol = checker.getSymbolAtLocation(expression);
    if (symbol === undefined || seenSymbols.has(symbol)) return undefined;
    seenSymbols.add(symbol);
    for (const declaration of symbol.declarations ?? []) {
      if (
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer !== undefined &&
        (declaration.parent.flags & ts.NodeFlags.Const) !== 0
      ) {
        const value = staticStringValueV1(
          declaration.initializer,
          seenSymbols,
        );
        if (value !== undefined) return value;
      }
    }
    return undefined;
  }

  function reflectionCallAcquisitionV1(node) {
    if (!ts.isCallExpression(node)) return undefined;
    const directKind = reflectionIntrinsicKindFromExpressionV1(
      node.expression,
    );
    if (directKind === "descriptors" && node.arguments.length >= 1) {
      return Object.freeze({
        kind: directKind,
        target: node.arguments[0],
      });
    }
    if (directKind !== undefined && node.arguments.length >= 2) {
      return Object.freeze({
        key: node.arguments[1],
        kind: directKind,
        target: node.arguments[0],
      });
    }
    const callee = unwrapParentheses(node.expression);
    if (
      (ts.isPropertyAccessExpression(callee) ||
        ts.isElementAccessExpression(callee)) &&
      staticAccessName(callee) === "call" &&
      resolvesToExactFunctionPrototypeCallV1(callee.expression) &&
      node.arguments.length >= 4
    ) {
      const indirectKind = reflectionIntrinsicKindFromExpressionV1(
        node.arguments[0],
      );
      if (indirectKind !== undefined) {
        if (indirectKind === "descriptors") {
          return Object.freeze({
            kind: indirectKind,
            target: node.arguments[2],
          });
        }
        return Object.freeze({
          key: node.arguments[3],
          kind: indirectKind,
          target: node.arguments[2],
        });
      }
    }
    return undefined;
  }

  function reflectionAcquisitionMayReadConstructorV1(acquisition) {
    const staticKey = staticStringValueV1(acquisition.key);
    return staticKey === undefined || staticKey === "constructor";
  }

  function expressionResolvesToReflectionDescriptorV1(
    node,
    seenSymbols = new Set(),
  ) {
    const expression = unwrapParentheses(node);
    const acquisition = reflectionCallAcquisitionV1(expression);
    if (
      acquisition?.kind === "descriptor" &&
      reflectionAcquisitionMayReadConstructorV1(acquisition)
    ) {
      return true;
    }
    if (!ts.isIdentifier(expression)) return false;
    const symbol = checker.getSymbolAtLocation(expression);
    if (symbol === undefined || seenSymbols.has(symbol)) return false;
    seenSymbols.add(symbol);
    return (
      symbol.declarations?.some(
        (declaration) =>
          ts.isVariableDeclaration(declaration) &&
          declaration.initializer !== undefined &&
          expressionResolvesToReflectionDescriptorV1(
            declaration.initializer,
            seenSymbols,
          ),
      ) ?? false
    );
  }

  function expressionResolvesToReflectedFunctionValueV1(
    node,
    seenSymbols = new Set(),
  ) {
    const expression = unwrapParentheses(node);
    const acquisition = reflectionCallAcquisitionV1(expression);
    if (
      acquisition?.kind === "get" &&
      reflectionAcquisitionMayReadConstructorV1(acquisition)
    ) {
      return true;
    }
    if (
      (ts.isPropertyAccessExpression(expression) ||
        ts.isElementAccessExpression(expression)) &&
      (staticAccessName(expression) === undefined ||
        staticAccessName(expression) === "value" ||
        staticAccessName(expression) === "get") &&
      expressionResolvesToReflectionDescriptorV1(
        expression.expression,
        seenSymbols,
      )
    ) {
      return true;
    }
    if (!ts.isIdentifier(expression)) return false;
    const symbol = checker.getSymbolAtLocation(expression);
    if (symbol === undefined || seenSymbols.has(symbol)) return false;
    seenSymbols.add(symbol);
    return (
      symbol.declarations?.some((declaration) => {
        if (
          ts.isVariableDeclaration(declaration) &&
          declaration.initializer !== undefined
        ) {
          return expressionResolvesToReflectedFunctionValueV1(
            declaration.initializer,
            seenSymbols,
          );
        }
        if (
          ts.isBindingElement(declaration) &&
          declaration.propertyName !== undefined &&
          !ts.isComputedPropertyName(declaration.propertyName) &&
          (moduleSpecifierText(declaration.propertyName) === "value" ||
            (ts.isIdentifier(declaration.propertyName) &&
              declaration.propertyName.text === "value"))
        ) {
          const variableDeclaration = declaration.parent.parent;
          return (
            ts.isVariableDeclaration(variableDeclaration) &&
            variableDeclaration.initializer !== undefined &&
            expressionResolvesToReflectionDescriptorV1(
              variableDeclaration.initializer,
              seenSymbols,
            )
          );
        }
        return false;
      }) ?? false
    );
  }

  function bindingElementAcquisitionV1(node) {
    if (
      !ts.isBindingElement(node) ||
      !ts.isObjectBindingPattern(node.parent) ||
      node.dotDotDotToken !== undefined
    ) {
      return undefined;
    }
    if (node.propertyName === undefined) {
      return ts.isIdentifier(node.name)
        ? Object.freeze({ computed: false, name: node.name.text })
        : undefined;
    }
    if (ts.isComputedPropertyName(node.propertyName)) {
      return Object.freeze({ computed: true, name: undefined });
    }
    const propertyName = unwrapParentheses(node.propertyName);
    if (
      ts.isIdentifier(propertyName) ||
      ts.isPrivateIdentifier(propertyName) ||
      ts.isStringLiteral(propertyName) ||
      ts.isNoSubstitutionTemplateLiteral(propertyName) ||
      ts.isNumericLiteral(propertyName)
    ) {
      return Object.freeze({ computed: false, name: propertyName.text });
    }
    return Object.freeze({ computed: true, name: undefined });
  }

  function objectDestructuringAssignmentAcquisitionV1(node) {
    if (
      !ts.isPropertyAssignment(node) &&
      !ts.isShorthandPropertyAssignment(node)
    ) {
      return undefined;
    }
    let pattern = node.parent;
    if (!ts.isObjectLiteralExpression(pattern)) return undefined;
    for (;;) {
      let parent = pattern.parent;
      while (
        parent !== undefined &&
        ts.isParenthesizedExpression(parent) &&
        parent.expression === pattern
      ) {
        pattern = parent;
        parent = pattern.parent;
      }
      if (
        parent !== undefined &&
        ts.isPropertyAssignment(parent) &&
        parent.initializer === pattern &&
        ts.isObjectLiteralExpression(parent.parent)
      ) {
        pattern = parent.parent;
        continue;
      }
      if (
        parent !== undefined &&
        ts.isArrayLiteralExpression(parent) &&
        parent.elements.includes(pattern)
      ) {
        pattern = parent;
        continue;
      }
      if (
        parent !== undefined &&
        ts.isSpreadElement(parent) &&
        parent.expression === pattern &&
        ts.isArrayLiteralExpression(parent.parent)
      ) {
        pattern = parent.parent;
        continue;
      }
      if (
        parent !== undefined &&
        (ts.isForOfStatement(parent) || ts.isForInStatement(parent)) &&
        parent.initializer === pattern
      ) {
        break;
      }
      if (
        parent === undefined ||
        !ts.isBinaryExpression(parent) ||
        parent.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
        parent.left !== pattern
      ) {
        return undefined;
      }
      break;
    }
    const propertyName = node.name;
    if (ts.isComputedPropertyName(propertyName)) {
      return Object.freeze({ computed: true, name: undefined });
    }
    if (
      ts.isIdentifier(propertyName) ||
      ts.isPrivateIdentifier(propertyName) ||
      ts.isStringLiteral(propertyName) ||
      ts.isNoSubstitutionTemplateLiteral(propertyName) ||
      ts.isNumericLiteral(propertyName)
    ) {
      return Object.freeze({ computed: false, name: propertyName.text });
    }
    return Object.freeze({ computed: true, name: undefined });
  }

  let dependency;
  function visit(node) {
    if (dependency !== undefined) return;

    const bindingAcquisition = bindingElementAcquisitionV1(node);
    if (bindingAcquisition?.computed === true) {
      dependency = "computed destructuring property acquisition";
      return;
    }
    const assignmentAcquisition =
      objectDestructuringAssignmentAcquisitionV1(node);
    if (assignmentAcquisition?.computed === true) {
      dependency = "computed destructuring property acquisition";
      return;
    }
    if (assignmentAcquisition?.name === "constructor") {
      dependency =
        "dynamic Function-family constructor destructuring acquisition";
      return;
    }
    if (bindingAcquisition?.name === "constructor") {
      dependency =
        "dynamic Function-family constructor destructuring acquisition";
      return;
    }

    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined
    ) {
      const specifier = moduleSpecifierText(node.moduleSpecifier);
      dependency =
        specifier === undefined
          ? "non-literal static module specifier"
          : allowedStaticBareModuleSpecifiers.has(specifier)
            ? undefined
            : classifyModuleSpecifier(specifier);
      if (dependency !== undefined) return;
    }

    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      const specifier =
        node.moduleReference.expression === undefined
          ? undefined
          : moduleSpecifierText(node.moduleReference.expression);
      dependency =
        specifier === undefined
          ? "non-literal import-equals module specifier"
          : allowedStaticBareModuleSpecifiers.has(specifier)
            ? undefined
            : classifyModuleSpecifier(specifier);
      if (dependency !== undefined) return;
    }

    if (ts.isCallExpression(node)) {
      const reflectionAcquisition = reflectionCallAcquisitionV1(node);
      const exactOpaqueNativePromiseDescriptorRoundTrip =
        reflectionAcquisition?.kind === "descriptor" &&
        isExactOpaqueNativePromiseDescriptorRoundTripV1(node);
      if (
        reflectionAcquisition?.kind === "descriptors" &&
        expressionResolvesToFunctionObject(reflectionAcquisition.target)
      ) {
        dependency =
          "dynamic Function-family property-descriptor enumeration";
        return;
      }
      if (
        reflectionAcquisition !== undefined &&
        reflectionAcquisition.kind !== "descriptors"
      ) {
        const staticReflectionKey = staticStringValueV1(
          reflectionAcquisition.key,
        );
        if (
          staticReflectionKey === "constructor" &&
          !exactOpaqueNativePromiseDescriptorRoundTrip
        ) {
          dependency =
            "dynamic Function-family constructor reflection acquisition";
          return;
        }
        if (
          staticReflectionKey === undefined &&
          expressionResolvesToFunctionObject(reflectionAcquisition.target) &&
          !exactOpaqueNativePromiseDescriptorRoundTrip
        ) {
          dependency =
            "computed Function-family reflection acquisition";
          return;
        }
      }
      if (expressionResolvesToReflectedFunctionValueV1(node.expression)) {
        dependency = "dynamic reflected Function-family invocation";
        return;
      }
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const specifier = moduleSpecifierText(node.arguments[0]);
        dependency =
          specifier === undefined
            ? "non-literal dynamic import"
            : classifyModuleSpecifier(specifier);
        if (dependency !== undefined) return;
      }
      if (
        isUnshadowedReflectGetCall(node) &&
        node.arguments.length >= 2
      ) {
        const accessName = moduleSpecifierText(
          unwrapParentheses(node.arguments[1]),
        );
        if (accessName === undefined || accessName === "constructor") {
          dependency =
            accessName === undefined
              ? "computed dynamic function-object access"
              : "dynamic Function-family constructor access";
          return;
        }
      }
      if (
        isUnshadowedDescriptorReflectionCall(node) &&
        node.arguments.length >= 2 &&
        !exactOpaqueNativePromiseDescriptorRoundTrip
      ) {
        const descriptorName = moduleSpecifierText(
          unwrapParentheses(node.arguments[1]),
        );
        if (
          (descriptorName === undefined &&
            !isDiscardedComputedDescriptorExistenceObservation(node)) ||
          descriptorName === "constructor"
        ) {
          dependency =
            descriptorName === undefined
              ? "computed dynamic function-object descriptor access"
              : "dynamic Function-family constructor descriptor access";
          return;
        }
      }
      if (expressionResolvesToAmbientGlobal(node)) {
        dependency = "ambient global object-returning call";
        return;
      }
    }

    if (
      ts.isNewExpression(node) &&
      expressionResolvesToReflectedFunctionValueV1(node.expression)
    ) {
      dependency = "dynamic reflected Function-family construction";
      return;
    }

    if (
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node)
    ) {
      const accessName = staticAccessName(node);
      const ambientGlobal = expressionResolvesToAmbientGlobal(node.expression);
      if (ambientGlobal) {
        if (accessName === undefined) {
          dependency = "computed ambient global access";
          return;
        }
        if (ambientNodeEscapeMembers.has(accessName)) {
          dependency = `Node runtime global member ${accessName}`;
          return;
        }
        if (ambientGlobalAliasMembers.has(accessName)) {
          dependency = `ambient global alias member ${accessName}`;
          return;
        }
      }
      if (isImportMeta(node.expression)) {
        if (accessName === undefined) {
          dependency = "computed import.meta access";
          return;
        }
        if (accessName === "resolve") {
          dependency = "runtime import.meta.resolve resource lookup";
          return;
        }
      }
      if (
        looksLikeFunctionPrototypeComputedAccess(node) &&
        !isExactFunctionPrototypeHasInstanceAccess(node)
      ) {
        dependency = "computed dynamic function-object access";
        return;
      }
      if (
        accessName === "constructor" &&
        !isSafeConstructorNameObservation(node) &&
        !isSafeConstructorIntrospectionAlias(node) &&
        !isDiscardedConstructorTruthinessObservation(node)
      ) {
        dependency = "dynamic Function-family constructor value escape";
        return;
      }
      if (
        expressionResolvesToFunctionObject(node.expression) &&
        (accessName === undefined || accessName === "constructor")
      ) {
        dependency =
          accessName === undefined
            ? "computed dynamic function-object access"
            : "dynamic Function-family constructor access";
        return;
      }
    }

    if (
      ts.isIdentifier(node) &&
      /^__viteBrowserExternal(?:$|[$_])/u.test(node.text)
    ) {
      dependency = "Vite browser-external shim";
      return;
    }

    if (
      ts.isIdentifier(node) &&
      isValueReferenceIdentifier(node) &&
      !hasCurrentSourceDeclaration(node)
    ) {
      if (bareNodeRuntimeIdentifiers.has(node.text)) {
        dependency = `Node runtime global ${node.text}`;
        return;
      }
      if (dynamicCodeIdentifiers.has(node.text)) {
        if (
          node.text === "Function" &&
          isFunctionIdentifierInExactSafeMemberAccess(node)
        ) {
          ts.forEachChild(node, visit);
          return;
        }
        dependency = `dynamic code global ${node.text}`;
        return;
      }
      if (
        ambientGlobalObjectIdentifiers.has(node.text) &&
        !isDirectStaticAccessReceiver(node) &&
        !isSafeAmbientSimpleAliasAssignment(node) &&
        !isExactGlobalStructuredCloneDescriptorOperation(node)
      ) {
        dependency = `ambient global object escape ${node.text}`;
        return;
      }
    }

    if (
      ts.isMetaProperty(node) &&
      node.keywordToken === ts.SyntaxKind.ImportKeyword &&
      node.name.text === "meta" &&
      !isDirectStaticAccessReceiver(node)
    ) {
      dependency = "import.meta object escape";
      return;
    }

    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return dependency;
}

for (const regressionSource of [
  'export const latentCrypto = () => import("crypto");',
  'export const latentFs = () => import(/* latent */ "node:fs");',
  'export const latentTemplateFs = () => import(`node:fs`);',
  'export const latentComputed = (specifier) => import(specifier);',
  'import shim from "./__vite-browser-external-latent.js";',
  'export { readFile } from "node:fs";',
  'export const fixtureUrl = import.meta.resolve("./fixture.json");',
  'export const environment = process?.env;',
  'export const bytes = Buffer.from("00", "hex");',
  'export const directory = __dirname;',
  'export const filename = __filename;',
  'export const load = () => require("node:fs");',
  'export const resolve = require.resolve("node:fs");',
  'module.exports = { ready: true };',
  'export const namespace = { process };',
  'exports.ready = true;',
  'export const environment = globalThis.process?.env;',
  'export const bytes = globalThis.Buffer.from("00", "hex");',
  'export const load = () => globalThis.require("node:fs");',
  'export const environment = globalThis["process"]?.env;',
  'export const environment = window["process"]?.env;',
  'export const bytes = self["Buffer"].from("00", "hex");',
  'export const environment = window.process?.env;',
  'export const bytes = self.Buffer.from("00", "hex");',
  'export const environment = global.process?.env;',
  'export const root = globalThis.window;',
  'export const root = window.self;',
  'export const load = () => module.require("node:fs");',
  'export const ready = module["exports"];',
  'export const resolve = require["resolve"]("node:fs");',
  'export const fixtureUrl = import.meta["resolve"]("./fixture.json");',
  'export const fixtureUrl = import.meta[specifier];',
  'export const value = globalThis[propertyName];',
  'const inputGlobal = "__UNDERSTAND_CODE_C09_DISTRIBUTION_REPLAY_INPUT_V1__"; const input = globalThis[inputGlobal]; delete globalThis[inputGlobal]; export { input };',
  'const ambient = globalThis; export { ambient };',
  'export const value = Reflect.get(globalThis, propertyName);',
  'export const load = (0, eval)("require")("node:fs");',
  'export const load = new Function("return process")();',
  'export const unsafe = Function.prototype[Symbol.iterator];',
  'export const unsafe = Function.prototype[computedKey];',
  'export const unsafe = Function.prototype.apply;',
  'export const unsafe = Function.prototype["call"];',
  'export const unsafe = Function.prototype.call.constructor;',
  'export const unsafe = Function[Symbol.hasInstance];',
  'const Function = { prototype: {} }; export const unsafe = Function.prototype[Symbol.hasInstance];',
  'const Symbol = { hasInstance: "safe" }; export const unsafe = Function.prototype[Symbol.hasInstance];',
  'const RuntimeFunction = Function; export const load = new RuntimeFunction("return process")();',
  'const RuntimeAsyncFunction = (async () => {}).constructor; export const load = new RuntimeAsyncFunction("return process")();',
  'const RuntimeGeneratorFunction = (function* () {}).constructor; export const load = new RuntimeGeneratorFunction("return process")();',
  'const RuntimeAsyncGeneratorFunction = (async function* () {}).constructor; export const load = new RuntimeAsyncGeneratorFunction("return process")();',
  'const RuntimeAsyncFunction = Object.getPrototypeOf(async function () {}).constructor; export { RuntimeAsyncFunction };',
  'const Dynamic = (() => {}).constructor; export const value = Dynamic("return 730010")();',
  'const Dynamic = Reflect.get(Object.getPrototypeOf(() => {}), "constructor"); export const value = Dynamic("return 730011")();',
  'const Dynamic = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(() => {}), "constructor").value; export const value = Dynamic("return 730012")();',
  'const Dynamic = Reflect.getOwnPropertyDescriptor(Object.getPrototypeOf(() => {}), "constructor").value; export const value = Dynamic("return 730013")();',
  'const descriptor = Object.getOwnPropertyDescriptor; const Dynamic = descriptor(Object.getPrototypeOf(() => {}), "constructor").value; export const value = Dynamic("return 730014")();',
  'const descriptor = Reflect.getOwnPropertyDescriptor; const Dynamic = descriptor(Object.getPrototypeOf(() => {}), "constructor").value; export const value = Dynamic("return 730015")();',
  'const get = Reflect.get; const Dynamic = get(Object.getPrototypeOf(() => {}), "constructor"); export const value = Dynamic("return 730016")();',
  'const get = Reflect.get; const target = Object.getPrototypeOf(() => {}); const key = String.fromCharCode(99, 111, 110, 115, 116, 114, 117, 99, 116, 111, 114); export const Dynamic = get(target, key);',
  'const descriptor = Object.getOwnPropertyDescriptor; const target = Object.getPrototypeOf(() => {}); const key = String.fromCharCode(99, 111, 110, 115, 116, 114, 117, 99, 116, 111, 114); export const Dynamic = descriptor(target, key).value;',
  'const descriptor = Reflect.getOwnPropertyDescriptor; const target = Object.getPrototypeOf(() => {}); const key = String.fromCharCode(99, 111, 110, 115, 116, 114, 117, 99, 116, 111, 114); export const Dynamic = descriptor(target, key).value;',
  'const call = Function.prototype.call; const descriptor = Object.getOwnPropertyDescriptor; const Dynamic = call.call(descriptor, Object, Object.getPrototypeOf(() => {}), "constructor").value; export const value = Dynamic("return 730017")();',
  'const descriptors = Object.getOwnPropertyDescriptors(Object.getPrototypeOf(() => {})); const Dynamic = Object.values(descriptors).find(({ value }) => typeof value === "function" && value.name === "Function").value; export const proof = Dynamic("return 730018")();',
  'const descriptors = Object.getOwnPropertyDescriptors(Object.getPrototypeOf(() => {})); const Dynamic = Object.entries(descriptors).find(([key]) => key === "constructor")[1].value; export const proof = Dynamic("return 730019")();',
  'const { constructor: Dynamic } = () => {}; export const value = new Dynamic("return 730030")();',
  'const { constructor: Dynamic } = Function.prototype.call; export const value = new Dynamic("return 730031")();',
  'const { constructor: Dynamic } = Object.getPrototypeOf(async () => {}); export const value = new Dynamic("return 730032")();',
  'const { constructor: CryptoConstructor } = globalThis.crypto; const { constructor: Dynamic } = CryptoConstructor; export const value = new Dynamic("return 730033")();',
  'const { constructor: Dynamic } = (() => {}).bind(null); export const value = new Dynamic("return 730034")();',
  'const { constructor } = Function.prototype.call; export const value = new constructor("return 730035")();',
  'const { "constructor": Dynamic } = Function.prototype.call; export const value = new Dynamic("return 730036")();',
  'const key = "constructor"; const { [key]: Dynamic } = Function.prototype.call; export const value = new Dynamic("return 730037")();',
  'function load({ constructor: Dynamic }) { return new Dynamic("return 730038")(); } export { load };',
  'let Dynamic; ({ constructor: Dynamic } = Function.prototype.call); export const value = new Dynamic("return 730039")();',
  'let constructor; ({ constructor } = Function.prototype.call); export const value = new constructor("return 730040")();',
  'let Dynamic; const key = "constructor"; ({ [key]: Dynamic } = Function.prototype.call); export const value = new Dynamic("return 730041")();',
  'let Dynamic; ([{ constructor: Dynamic }] = [Function.prototype.call]); export const value = new Dynamic("return 730042")();',
  'let Dynamic; [...[{ constructor: Dynamic }]] = [Function.prototype.call]; export const value = new Dynamic("return 7300421")();',
  'let Dynamic; for ({ constructor: Dynamic } of [Function.prototype.call]) { exportValue(new Dynamic("return 730043")()); }',
  'let Dynamic; for ({ constructor: Dynamic } in { ready: true }) { exportValue(Dynamic); }',
  'const RuntimeFunction = ({ }).constructor.constructor; export { RuntimeFunction };',
  'const holder = { execute() {} }; export const RuntimeFunction = holder.execute.constructor;',
  'export const load = [].filter.constructor("return process")().env;',
  'export const RuntimeFunction = [].filter[propertyName];',
  'export const load = (async () => {}).__proto__.constructor("return process")().env;',
  'export const RuntimeFunction = (async () => {}).__proto__[propertyName];',
  'export const load = (function* () {}).__proto__.constructor("yield process")().next().value;',
  'export const RuntimeFunction = (function* () {}).__proto__[propertyName];',
  'export const load = (() => {}).bind(null).constructor("return process")().env;',
  'export const RuntimeFunction = (() => {}).bind(null)[propertyName];',
  'export const RuntimeFunction = Object.getOwnPropertyDescriptor(() => {}, "constructor").value;',
  'export const RuntimeFunction = Object.getOwnPropertyDescriptor([].filter, propertyName).value;',
  'export const present = Object.getOwnPropertyDescriptor({}, propertyName);',
  'export const present = Object.getOwnPropertyDescriptor({}, propertyName) !== null;',
  'export const present = Object.getOwnPropertyDescriptor({}, "constructor") !== undefined;',
  'const nativePromise = Promise; const descriptor = Object.getOwnPropertyDescriptor(nativePromise.prototype, "constructor"); if (descriptor !== undefined) Object.defineProperty(nativePromise.prototype, "constructor", descriptor); consume(descriptor.value);',
  'const nativePromise = Promise; const descriptor = Object.getOwnPropertyDescriptor(nativePromise.prototype, "constructor"); if (descriptor !== undefined) Object.defineProperty(nativePromise.prototype, "constructor", descriptor); consume(descriptor.get);',
  'const nativePromise = Promise; const descriptor = Object.getOwnPropertyDescriptor(nativePromise.prototype, "constructor"); if (descriptor !== undefined) Object.defineProperty(nativePromise.prototype, "constructor", descriptor); export { descriptor };',
  'function save() { const nativePromise = Promise; const descriptor = Object.getOwnPropertyDescriptor(nativePromise.prototype, "constructor"); if (descriptor !== undefined) Object.defineProperty(nativePromise.prototype, "constructor", descriptor); return descriptor; } export { save };',
  'const nativePromise = Promise; const descriptor = Object.getOwnPropertyDescriptor(nativePromise.prototype, "constructor"); if (descriptor !== undefined) Object.defineProperty(nativePromise.prototype, "constructor", descriptor); consume({ descriptor });',
  'const nativePromise = Promise; const descriptor = Object.getOwnPropertyDescriptor(nativePromise.prototype, "constructor"); if (descriptor !== undefined) Object.defineProperty(nativePromise.prototype, "constructor", descriptor); consume(descriptor);',
  'const nativePromise = Promise; const descriptor = Object.getOwnPropertyDescriptor(nativePromise.prototype, "constructor"); if (descriptor !== undefined) Object.defineProperty(nativePromise, "constructor", descriptor);',
  'const nativePromise = Promise; const descriptor = Object.getOwnPropertyDescriptor(nativePromise.prototype, "constructor"); if (descriptor !== undefined) Object.defineProperty(nativePromise.prototype, "then", descriptor);',
  'const nativePromise = Promise; const descriptor = Object.getOwnPropertyDescriptor(nativePromise.prototype, "constructor"); function restore(Object) { if (descriptor !== undefined) Object.defineProperty(nativePromise.prototype, "constructor", descriptor); } export { restore };',
  'const nativePromise = Promise; const descriptor = Object.getOwnPropertyDescriptor(nativePromise.prototype, "constructor"); const defineProperty = () => {}; if (descriptor !== undefined) defineProperty(nativePromise.prototype, "constructor", descriptor);',
  'const nativePromise = Promise; let descriptor = Object.getOwnPropertyDescriptor(nativePromise.prototype, "constructor"); if (descriptor !== undefined) Object.defineProperty(nativePromise.prototype, "constructor", descriptor);',
  'const nativePromise = Promise; const descriptor = Object.getOwnPropertyDescriptor(nativePromise.prototype, "constructor"); if (descriptor !== undefined) Object.defineProperty(nativePromise.prototype, "constructor", descriptor); descriptor = undefined;',
  'const nativePromise = Promise; const speciesDescriptor = Object.getOwnPropertyDescriptor(nativePromise, Symbol.species); if (speciesDescriptor !== undefined) Object.defineProperty(nativePromise, Symbol.species, speciesDescriptor); consume(speciesDescriptor.value);',
  'const nativePromise = Promise; const speciesDescriptor = Object.getOwnPropertyDescriptor(nativePromise, Symbol.species); if (speciesDescriptor !== undefined) Object.defineProperty(nativePromise, Symbol.species, speciesDescriptor); export { speciesDescriptor };',
  'const nativePromise = Promise; const speciesDescriptor = Object.getOwnPropertyDescriptor(nativePromise, Symbol.species); if (speciesDescriptor !== undefined) Object.defineProperty(nativePromise, Symbol.species, speciesDescriptor); consume({ speciesDescriptor });',
  'const nativePromise = Promise; const speciesDescriptor = Object.getOwnPropertyDescriptor(nativePromise, Symbol.species); if (speciesDescriptor !== undefined) Object.defineProperty(nativePromise.prototype, Symbol.species, speciesDescriptor);',
  'const nativePromise = Promise; const otherPromise = Promise; const speciesDescriptor = Object.getOwnPropertyDescriptor(nativePromise, Symbol.species); if (speciesDescriptor !== undefined) Object.defineProperty(otherPromise, Symbol.species, speciesDescriptor);',
  'const nativePromise = Promise; const speciesDescriptor = Object.getOwnPropertyDescriptor(nativePromise, Symbol.species); if (speciesDescriptor !== undefined) Object.defineProperty(nativePromise, Symbol.iterator, speciesDescriptor);',
  'const nativePromise = Promise; const Symbol = { species: "species" }; const speciesDescriptor = Object.getOwnPropertyDescriptor(nativePromise, Symbol.species); if (speciesDescriptor !== undefined) Object.defineProperty(nativePromise, Symbol.species, speciesDescriptor);',
  'const nativePromise = Promise; const speciesDescriptor = Object.getOwnPropertyDescriptor(nativePromise, Symbol.species); function restore(Object) { if (speciesDescriptor !== undefined) Object.defineProperty(nativePromise, Symbol.species, speciesDescriptor); } export { restore };',
  'const nativePromise = Promise; let speciesDescriptor = Object.getOwnPropertyDescriptor(nativePromise, Symbol.species); if (speciesDescriptor !== undefined) Object.defineProperty(nativePromise, Symbol.species, speciesDescriptor);',
  'const nativePromise = Promise; const speciesDescriptor = Object.getOwnPropertyDescriptor(nativePromise, Symbol.species); if (speciesDescriptor !== undefined) Object.defineProperty(nativePromise, Symbol.species, speciesDescriptor); speciesDescriptor = undefined;',
  'const NativeObject = Object; const Dynamic = NativeObject.getOwnPropertyDescriptor(Object.getPrototypeOf(() => {}), "constructor").value; export const value = Dynamic("return 730044")();',
  'const NativeReflect = Reflect; const Dynamic = NativeReflect.getOwnPropertyDescriptor(Object.getPrototypeOf(() => {}), "constructor").value; export const value = Dynamic("return 730045")();',
  'const NativeReflect = Reflect; const Dynamic = NativeReflect.get(Object.getPrototypeOf(() => {}), "constructor"); export const value = Dynamic("return 730046")();',
  'const ordinary = {}; export const EscapedConstructor = ordinary.constructor;',
  'const ordinary = {}; export const EscapedConstructor = ordinary.constructor && true;',
  'const ordinary = {}; if (ordinary.constructor && new ordinary.constructor()) throw new Error();',
  'const ordinary = {}; const ctor = ordinary.constructor; if (ctor === void 0) throw new Error(); if (typeof ctor !== "function") throw new Error(); const prototype = ctor.prototype; export { ctor, prototype };',
  'const ordinary = {}; const ctor = ordinary.constructor; if (ctor === void 0) throw new Error(); if (typeof ctor !== "function") throw new Error(); export const escaped = ctor.prototype;',
  'const ordinary = {}; const ctor = ordinary.constructor; if (ctor === void 0) throw new Error(); if (typeof ctor !== "function") throw new Error(); const prototype = ctor.prototype; export const RuntimeFunction = new ctor();',
  'const ordinary = {}; const ctor = ordinary.constructor; if (ctor === void 0) throw new Error(); if (typeof ctor !== "function") throw new Error(); const prototype = ctor.prototype; export const RuntimeFunction = ctor.constructor;',
  'export const RuntimeFunction = Reflect.get(() => {}, "constructor");',
  'export const RuntimeFunction = Reflect.get(() => {}, propertyName);',
  'export const RuntimeFunction = Reflect.get({ ready: true }, propertyName);',
  'export const RuntimeFunction = (() => {})[propertyName];',
  'export const RuntimeFunction = globalThis["Function"];',
  'export const environment = window.top.process?.env;',
  'export const bytes = window.parent.Buffer.from("00", "hex");',
  'export const load = () => self.frames.require("node:fs");',
  'const ambientAlias = window.top; export const environment = ambientAlias.process?.env;',
  'export const environment = top.process?.env;',
  'export const bytes = parent.Buffer.from("00", "hex");',
  'export const load = () => frames[0].require("node:fs");',
  'const ambientAlias = opener; export const RuntimeFunction = ambientAlias[propertyName];',
  'export const environment = window.valueOf().process?.env;',
  'var ambientAlias; (ambientAlias = globalThis).crypto; export { ambientAlias };',
  'var ambientAlias; (ambientAlias = globalThis).crypto; consume(ambientAlias);',
  'var ambientAlias; (ambientAlias = globalThis).crypto; export const value = ambientAlias[propertyName];',
  'var ambientAlias; (ambientAlias = globalThis).crypto; export const environment = ambientAlias.process?.env;',
  'var ambientAlias; (ambientAlias = globalThis).crypto; ambientAlias = { safe: true };',
  'Object.getOwnPropertyDescriptor(globalThis, propertyName);',
  'Object.getOwnPropertyDescriptor(globalThis, "process");',
  'Object.defineProperty(globalThis, "process", { value: 1 });',
  'const Object = { getOwnPropertyDescriptor() {} }; Object.getOwnPropertyDescriptor(globalThis, "structuredClone");',
  'saveProperty(globalThis, "structuredClone");',
  'const __viteBrowserExternal$1 = {}; export { __viteBrowserExternal$1 };',
  'import { z } from "zod";',
]) {
  if (findBrowserRuntimeDependency(regressionSource) === undefined) {
    throw new Error(
      `Browser runtime-dependency detector regression: ${regressionSource}`,
    );
  }
}
for (const regressionSource of [
  'export const loadHelper = () => import("./crypto-helper.js");',
  'export const loadHelper = () => import(`./crypto-helper.js`);',
  'import helper from "./helper.js"; export { helper };',
  'import { value as process } from "./helper.js"; export const mode = process.env.MODE;',
  'const process = { env: { MODE: "browser" } }; export const mode = process.env.MODE;',
  'function process() { return "local"; } export const namespace = { process };',
  'export function byteLength(Buffer) { return Buffer.byteLength; }',
  'export function load(require) { return require("./helper.js"); }',
  'const module = { require: () => 1, exports: {} }; export const value = module.require();',
  'const exports = {}; exports.ready = true; export { exports };',
  'const global = { process: { env: {} } }; export const environment = global.process.env;',
  'const window = { process: { env: {} } }; export const environment = window.process.env;',
  'const self = { Buffer: { from: () => new Uint8Array() } }; export const bytes = self.Buffer.from();',
  'const globalThis = { process: { env: {} } }; export const environment = globalThis.process.env;',
  'const Function = () => 1; export const value = Function();',
  'export const hasInstance = Function.prototype[Symbol.hasInstance];',
  'export const functionCall = Function.prototype.call;',
  'export const functionBind = Function.prototype.bind;',
  'const Reflect = { get: () => "safe" }; export const value = Reflect.get(() => {}, "constructor");',
  'export const value = Reflect.get({ name: "safe" }, "name");',
  'export const descriptor = Object.getOwnPropertyDescriptor({ name: "safe" }, "name");',
  'export const present = Object.getOwnPropertyDescriptor({}, propertyName) !== undefined;',
  'export const cryptography = globalThis.crypto.subtle;',
  'function registry() { return {}; } var zodGlobal; (zodGlobal = globalThis).__zod_globalRegistry ?? (zodGlobal.__zod_globalRegistry = registry()); export const sharedRegistry = globalThis.__zod_globalRegistry;',
  'const structuredCloneDescriptor = Object.getOwnPropertyDescriptor(globalThis, "structuredClone"); Object.defineProperty(globalThis, "structuredClone", structuredCloneDescriptor); delete globalThis.structuredClone;',
  'function savePromiseConstructorDescriptor() { const nativePromise = Promise; const descriptor = Object.getOwnPropertyDescriptor(nativePromise.prototype, "constructor"); const restore = () => { if (descriptor !== undefined) Object.defineProperty(nativePromise.prototype, "constructor", descriptor); }; return restore; } export { savePromiseConstructorDescriptor };',
  'function savePromiseSpeciesDescriptor() { const nativePromise = Promise; const speciesDescriptor = Object.getOwnPropertyDescriptor(nativePromise, Symbol.species); const restore = () => { if (speciesDescriptor !== undefined) Object.defineProperty(nativePromise, Symbol.species, speciesDescriptor); }; return restore; } export { savePromiseSpeciesDescriptor };',
  'const Object = { getOwnPropertyDescriptor: () => ({ value: "safe" }) }; const NativeObject = Object; export const descriptor = NativeObject.getOwnPropertyDescriptor({}, "constructor");',
  'const Reflect = { getOwnPropertyDescriptor: () => ({ value: "safe" }) }; const NativeReflect = Reflect; export const descriptor = NativeReflect.getOwnPropertyDescriptor({}, "constructor");',
  'export const injected = globalThis["__C09_TEST_DATA__"];',
  'const input = globalThis["__UNDERSTAND_CODE_C09_DISTRIBUTION_REPLAY_INPUT_V1__"]; delete globalThis["__UNDERSTAND_CODE_C09_DISTRIBUTION_REPLAY_INPUT_V1__"]; export { input };',
  'export const moduleUrl = import.meta.url;',
  'import { z } from "./zod.js"; const schema = z.object({}); export const schemaName = schema.constructor.name;',
  'import { z } from "./zod.js"; const schema = z.object({}); export const schemaName = schema?.constructor?.name;',
  'import { z } from "./zod.js"; const schema = z.object({}); export const schemaName = schema["constructor"]["name"];',
  'class ZodLike {}; const schema = new ZodLike(); export const schemaName = schema.constructor.name;',
  'const ordinary = {}; if (ordinary && "constructor" in ordinary && ordinary.constructor) { exportName(ordinary.constructor.name); }',
  'const ordinary = {}; const ctor = ordinary.constructor; if (ctor === void 0) throw new Error(); if (typeof ctor !== "function") throw new Error(); const prototype = ctor.prototype; if (typeof prototype !== "object" || prototype === null || Array.isArray(prototype)) throw new Error(); export const ready = Object.prototype.hasOwnProperty.call(prototype, "isPrototypeOf");',
  'const record = { constructor: { name: "ordinary" } }; export const name = record.constructor.name;',
  'const { ready } = { ready: true }; export { ready };',
  'const { label: localLabel } = { label: "ordinary" }; export { localLabel };',
  'const { constructorName } = { constructorName: "ordinary" }; export { constructorName };',
  'const [constructor] = ["ordinary"]; export { constructor };',
  'const { ready, ...constructor } = { ready: true, value: 1 }; export { constructor };',
  'let name; ({ name } = { name: "ordinary" }); export { name };',
  'let rest; ({ ready: rest } = { ready: true }); export { rest };',
  'let constructor; [constructor] = ["ordinary"]; export { constructor };',
  'let constructor; ({ ...constructor } = { ready: true }); export { constructor };',
  'const Object = { getOwnPropertyDescriptor: () => ({ value: "safe" }), getOwnPropertyDescriptors: () => ({}) }; const descriptor = Object.getOwnPropertyDescriptor({}, "constructor"); export { descriptor };',
  'const Reflect = { get: () => "safe", getOwnPropertyDescriptor: () => ({ value: "safe" }) }; export const value = Reflect.get({}, "constructor");',
  'const descriptor = Object.getOwnPropertyDescriptor; export const safe = descriptor({ name: "ordinary" }, "name").value;',
  'const get = Reflect.get; export const safe = get({ name: "ordinary" }, "name");',
  'const descriptor = Reflect.getOwnPropertyDescriptor; export const safe = descriptor({ name: "ordinary" }, "name").value;',
  'const get = Reflect.get; export function read(record, key) { return get(record, key); }',
  'const descriptor = Object.getOwnPropertyDescriptor; export function read(record, key) { return descriptor(record, key)?.value; }',
  'const descriptor = Reflect.getOwnPropertyDescriptor; export function read(record, key) { return descriptor(record, key)?.value; }',
  'const descriptors = Object.getOwnPropertyDescriptors({ name: "ordinary" }); export const safe = Object.values(descriptors)[0].value;',
  '// __vite-browser-external appears only in a comment\nexport const ready = true;',
  'export const marker = "__vite-browser-external";',
  'export const object = { process: 1, Buffer: 2, require: 3 };',
]) {
  const dependency = findBrowserRuntimeDependency(regressionSource);
  if (dependency !== undefined) {
    throw new Error(
      `Browser runtime-dependency detector false positive (${dependency}): ${regressionSource}`,
    );
  }
}

function inspectMinimalBrowserImportSurface(source) {
  const sourceFile = ts.createSourceFile(
    "c09-minimal-entry.js",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  if (sourceFile.parseDiagnostics.length !== 0) {
    return {
      imports: [],
      specifiers: [],
      violation: "unparseable minimal browser entry",
    };
  }
  const imports = [];
  const forbiddenRuntimeIdentifiers = new Set([
    "require",
    "module",
    "exports",
    "eval",
    "Function",
    "AsyncFunction",
    "GeneratorFunction",
    "AsyncGeneratorFunction",
  ]);
  let violation;
  function visit(node) {
    if (violation !== undefined) return;
    if (ts.isImportDeclaration(node)) {
      if (node.importClause === undefined) {
        violation = "side-effect-only import";
        return;
      }
      if (node.importClause.isTypeOnly) {
        violation = "type-only import";
        return;
      }
      if (node.importClause.name !== undefined) {
        violation = "default import";
        return;
      }
      if (node.importClause.namedBindings === undefined) {
        violation = "default-only import";
        return;
      }
      if (ts.isNamespaceImport(node.importClause.namedBindings)) {
        violation = "namespace import";
        return;
      }
      if (
        node.importClause.namedBindings.elements.length === 0 ||
        node.importClause.namedBindings.elements.some(
          (element) => element.isTypeOnly,
        )
      ) {
        violation = "empty or type-only named import";
        return;
      }
      if (node.attributes !== undefined || node.assertClause !== undefined) {
        violation = "import attributes";
        return;
      }
      if (!ts.isStringLiteral(node.moduleSpecifier)) {
        violation = "non-literal static import";
        return;
      }
      const bindings = [];
      for (const element of node.importClause.namedBindings.elements) {
        const imported = element.propertyName ?? element.name;
        if (!ts.isIdentifier(imported) || !ts.isIdentifier(element.name)) {
          violation = "non-identifier named import binding";
          return;
        }
        bindings.push({ imported: imported.text, local: element.name.text });
      }
      imports.push({ specifier: node.moduleSpecifier.text, bindings });
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined
    ) {
      violation = "module re-export";
      return;
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      violation = "dynamic import";
      return;
    } else if (ts.isImportEqualsDeclaration(node)) {
      violation = "import-equals declaration";
      return;
    } else if (
      ts.isMetaProperty(node) &&
      node.keywordToken === ts.SyntaxKind.ImportKeyword &&
      node.name.text === "meta"
    ) {
      violation = "import.meta reference";
      return;
    } else if (
      ts.isIdentifier(node) &&
      forbiddenRuntimeIdentifiers.has(node.text)
    ) {
      violation = `forbidden minimal runtime identifier ${node.text}`;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return {
    imports,
    specifiers: imports.map(({ specifier }) => specifier),
    violation,
  };
}

function hasExactMinimalBrowserImportSurface(result) {
  return (
    result.violation === undefined &&
    result.imports.length === C09_MINIMAL_EXPECTED_IMPORT_SURFACE.length &&
    result.imports.every(
      (actualImport, importIndex) => {
        const expectedImport =
          C09_MINIMAL_EXPECTED_IMPORT_SURFACE[importIndex];
        return (
          expectedImport !== undefined &&
          actualImport.specifier === expectedImport.specifier &&
          actualImport.bindings.length === expectedImport.bindings.length &&
          actualImport.bindings.every(
            (actualBinding, bindingIndex) => {
              const expectedBinding = expectedImport.bindings[bindingIndex];
              return (
                expectedBinding !== undefined &&
                actualBinding.imported === expectedBinding.imported &&
                actualBinding.local === expectedBinding.local
              );
            },
          )
        );
      },
    )
  );
}

function renderExpectedMinimalBrowserImports() {
  return C09_MINIMAL_EXPECTED_IMPORT_SURFACE.map(
    ({ specifier, bindings }) =>
      `import { ${bindings
        .map(({ imported, local }) =>
          imported === local ? imported : `${imported} as ${local}`,
        )
        .join(", ")} } from ${JSON.stringify(specifier)};`,
  ).join("\n");
}

const minimalExpectedImportSource = renderExpectedMinimalBrowserImports();
const minimalImportSurfaceRegression = inspectMinimalBrowserImportSurface(
  minimalExpectedImportSource,
);
if (!hasExactMinimalBrowserImportSurface(minimalImportSurfaceRegression)) {
  throw new Error("Minimal browser import-surface detector rejected exact imports");
}
const minimalExpectedImportDependency = findBrowserRuntimeDependency(
  minimalExpectedImportSource,
  {
    allowedStaticBareModuleSpecifiers:
      C09_MINIMAL_EXPECTED_IMPORT_SPECIFIERS,
  },
);
if (minimalExpectedImportDependency !== undefined) {
  throw new Error(
    `Minimal browser dependency scanner rejected exact imports: ${minimalExpectedImportDependency}`,
  );
}
for (const regressionSource of [
  'import "@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point-fixtures";',
  'import defaultBinding from "@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point";',
  'import defaultBinding, { validateProviderRegistryEvidenceBindingPointClosureV1 } from "@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point";',
  'import * as bindingPoint from "@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point";',
  'import {} from "@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point";',
  'void import("@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point-fixtures");',
  'export { value } from "@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point-fixtures";',
  'const bindingPoint = require("@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point");',
  'const require = () => ({}); require("@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point");',
  'import { validateProviderRegistryEvidenceBindingPointClosureV1 } from "@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point";',
  minimalExpectedImportSource.replace(
    "validateProviderRegistryEvidenceBindingPointClosureV1 }",
    "validateProviderRegistryEvidenceBindingPointClosureV1, extra }",
  ),
  minimalExpectedImportSource.replace(
    "validateProviderRegistryEvidenceBindingPointClosureV1 }",
    "validateProviderRegistryEvidenceBindingPointClosureV1 as validateBinding }",
  ),
  minimalExpectedImportSource.replace(
    "STRICT_ED25519_VERIFICATION_PROFILE_V1, validatePrimeSubgroupPoint",
    "validatePrimeSubgroupPoint, STRICT_ED25519_VERIFICATION_PROFILE_V1",
  ),
  minimalExpectedImportSource.replace(
    ";",
    ' with { type: "json" };',
  ),
  `${minimalExpectedImportSource}\nimport "./side-effect.js";`,
  `${minimalExpectedImportSource}\nvoid import("./dynamic.js");`,
  `${minimalExpectedImportSource}\nexport { value } from "./extra.js";`,
  `${minimalExpectedImportSource}\nexport const url = import.meta.resolve("./fixture.json");`,
  `${minimalExpectedImportSource}\nmodule.exports = {};`,
  `${minimalExpectedImportSource}\n(0, eval)("import('./extra.js')");`,
  [...C09_MINIMAL_EXPECTED_IMPORT_SURFACE]
    .reverse()
    .map(({ specifier, bindings }) =>
      `import { ${bindings.map(({ imported }) => imported).join(", ")} } from ${JSON.stringify(specifier)};`,
    )
    .join("\n"),
]) {
  if (hasExactMinimalBrowserImportSurface(
    inspectMinimalBrowserImportSurface(regressionSource),
  )) {
    throw new Error(
      `Minimal browser import-surface detector regression: ${regressionSource}`,
    );
  }
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function listFiles(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const absolutePath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolutePath)));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
}

function createC09ViteDependencyGuardNonce() {
  return randomBytes(16).toString("hex");
}

function c09ViteDependencyGuardSentinelValue(nonce) {
  if (!/^[0-9a-f]{32}$/u.test(nonce)) {
    throw new TypeError("C09 Vite dependency-guard nonce is invalid");
  }
  return `${C09_VITE_DEPENDENCY_GUARD_SENTINEL_DOMAIN_V1}:${nonce}`;
}

function renderC09ViteDependencyGuardConfigPreamble(nonce) {
  const sentinelValue = c09ViteDependencyGuardSentinelValue(nonce);
  return [
    'import { builtinModules as c09BuiltinModules } from "node:module";',
    'const c09BareNodeBuiltins = new Set(c09BuiltinModules.map((specifier) => specifier.replace(/^node:/u, "")));',
    `const c09GuardSentinelIdentifier = ${JSON.stringify(C09_VITE_DEPENDENCY_GUARD_SENTINEL_IDENTIFIER_V1)};`,
    `const c09GuardSentinelValue = ${JSON.stringify(sentinelValue)};`,
    `const c09GuardBlockedPrefix = ${JSON.stringify(C09_VITE_DEPENDENCY_GUARD_BLOCKED_PREFIX_V1)};`,
    'function c09AssertClosedDependencyId(id, phase) {',
    '  if (typeof id !== "string") throw new Error(`${c09GuardBlockedPrefix}: non-string module id at ${phase}`);',
    '  const withoutNullPrefix = id.replace(/^\\0+/u, "");',
    '  const normalized = withoutNullPrefix.split(/[?#]/u, 1)[0];',
    '  if (withoutNullPrefix.includes("__vite-browser-external")) throw new Error(`${c09GuardBlockedPrefix}: Vite browser-external module at ${phase}: ${id}`);',
    '  if (normalized.startsWith("node:") || c09BareNodeBuiltins.has(normalized)) throw new Error(`${c09GuardBlockedPrefix}: Node builtin at ${phase}: ${id}`);',
    '}',
    'function c09AssertClosedModuleGraph(context, phase) {',
    '  for (const id of context.getModuleIds()) {',
    '    c09AssertClosedDependencyId(id, `${phase}/module`);',
    '    const info = context.getModuleInfo(id);',
    '    if (info === null) throw new Error(`${c09GuardBlockedPrefix}: missing module info at ${phase}: ${id}`);',
    '    for (const importedId of [...info.importedIds, ...info.dynamicallyImportedIds]) c09AssertClosedDependencyId(importedId, `${phase}/edge`);',
    '  }',
    '}',
    'function c09ClosedBrowserDependencyGuard() {',
    '  return {',
    '    name: "understand-code-c09-closed-browser-dependency-guard",',
    '    enforce: "pre",',
    '    resolveId(source, importer) { c09AssertClosedDependencyId(source, `resolve:${importer ?? "entry"}`); return null; },',
    '    load(id) { c09AssertClosedDependencyId(id, "load"); return null; },',
    '    moduleParsed(info) {',
    '      c09AssertClosedDependencyId(info.id, "moduleParsed/module");',
    '      for (const importedId of [...info.importedIds, ...info.dynamicallyImportedIds]) c09AssertClosedDependencyId(importedId, "moduleParsed/edge");',
    '    },',
    '    renderChunk(code) {',
    '      c09AssertClosedModuleGraph(this, "renderChunk");',
    '      return { code: `const ${c09GuardSentinelIdentifier} = ${JSON.stringify(c09GuardSentinelValue)};\\n${code}`, map: null };',
    '    },',
    '    generateBundle() { c09AssertClosedModuleGraph(this, "generateBundle"); },',
    '  };',
    '}',
  ];
}

function hasExactC09ViteDependencyGuardSentinel(source, nonce) {
  const expectedValue = c09ViteDependencyGuardSentinelValue(nonce);
  const sourceFile = ts.createSourceFile(
    "c09-vite-dependency-guard-output.mjs",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  if (sourceFile.parseDiagnostics.length !== 0) return false;
  let matchCount = 0;
  for (const statement of sourceFile.statements) {
    if (
      !ts.isVariableStatement(statement) ||
      (statement.declarationList.flags & ts.NodeFlags.Const) === 0
    ) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text ===
          C09_VITE_DEPENDENCY_GUARD_SENTINEL_IDENTIFIER_V1 &&
        declaration.initializer !== undefined &&
        ts.isStringLiteral(declaration.initializer) &&
        declaration.initializer.text === expectedValue
      ) {
        matchCount += 1;
      }
    }
  }
  return matchCount === 1;
}

const c09ViteDependencyGuardSentinelRegressionNonce =
  "0123456789abcdef0123456789abcdef";
const c09ViteDependencyGuardSentinelRegressionSource = `const ${C09_VITE_DEPENDENCY_GUARD_SENTINEL_IDENTIFIER_V1} = ${JSON.stringify(c09ViteDependencyGuardSentinelValue(c09ViteDependencyGuardSentinelRegressionNonce))};\nexport const ready = true;`;
if (
  !hasExactC09ViteDependencyGuardSentinel(
    c09ViteDependencyGuardSentinelRegressionSource,
    c09ViteDependencyGuardSentinelRegressionNonce,
  ) ||
  hasExactC09ViteDependencyGuardSentinel(
    `// ${c09ViteDependencyGuardSentinelRegressionSource}`,
    c09ViteDependencyGuardSentinelRegressionNonce,
  ) ||
  hasExactC09ViteDependencyGuardSentinel(
    c09ViteDependencyGuardSentinelRegressionSource.replace(
      c09ViteDependencyGuardSentinelRegressionNonce,
      "ffffffffffffffffffffffffffffffff",
    ),
    c09ViteDependencyGuardSentinelRegressionNonce,
  )
) {
  throw new Error("C09 Vite dependency-guard sentinel detector regression");
}

async function runC09ViteDependencyGuardRegression(temporaryRoot) {
  const regressionRoot = join(temporaryRoot, "vite-dependency-guard-regression");
  await mkdir(regressionRoot, { recursive: true });
  const entryPath = join(regressionRoot, "entry.js");
  const configPath = join(regressionRoot, "vite.config.mjs");
  const guardNonce = createC09ViteDependencyGuardNonce();
  await writeFile(entryPath, 'export const ready = true;\n', "utf8");
  await writeFile(
    configPath,
    [
      'import { resolve } from "node:path";',
      ...renderC09ViteDependencyGuardConfigPreamble(guardNonce),
      'export default {',
      '  plugins: [c09ClosedBrowserDependencyGuard()],',
      '  build: {',
      '    target: "es2022",',
      '    outDir: "dist",',
      '    emptyOutDir: true,',
      '    minify: false,',
      '    lib: { entry: resolve("entry.js"), formats: ["es"], fileName: "guard-regression" },',
      '  },',
      '};',
    ].join("\n"),
    "utf8",
  );
  await run(viteCommand, ["build", "--config", "vite.config.mjs"], {
    cwd: regressionRoot,
    env: { NODE_OPTIONS: C09_NODE_OPTIONS },
    timeoutMs: C09_VITE_BUILD_TIMEOUT_MS,
  });
  const safeJavaScriptFiles = (await listFiles(join(regressionRoot, "dist"))).filter(
    (filePath) => /\.(?:m?js)$/u.test(filePath),
  );
  if (safeJavaScriptFiles.length !== 1) {
    throw new Error(
      `C09 Vite dependency-guard safe regression emitted ${safeJavaScriptFiles.length} JavaScript files`,
    );
  }
  const safeSource = await readFile(safeJavaScriptFiles[0], "utf8");
  if (!hasExactC09ViteDependencyGuardSentinel(safeSource, guardNonce)) {
    throw new Error(
      "C09 Vite dependency-guard sentinel was absent after real Vite rendering",
    );
  }

  for (const forbiddenEntrySource of [
    'import fs from "node:fs"; export const latent = () => fs.readFileSync;\n',
    'import shim from "__vite-browser-external"; export { shim };\n',
  ]) {
    await writeFile(entryPath, forbiddenEntrySource, "utf8");
    let rejectedError;
    try {
      await run(viteCommand, ["build", "--config", "vite.config.mjs"], {
        cwd: regressionRoot,
        env: { NODE_OPTIONS: C09_NODE_OPTIONS },
        timeoutMs: C09_VITE_BUILD_TIMEOUT_MS,
      });
    } catch (error) {
      rejectedError = error;
    }
    const rejectionText = String(rejectedError?.message ?? rejectedError ?? "");
    if (
      !rejectionText.includes(C09_VITE_DEPENDENCY_GUARD_BLOCKED_PREFIX_V1) ||
      /externalized for browser compatibility/u.test(rejectionText)
    ) {
      throw new Error(
        `Real Vite dependency-guard regression did not fail in the guard plugin: ${rejectionText}`,
      );
    }
  }
}

const C09_BROWSER_ZOD_VALID_CAPABILITY_V1 = Object.freeze({
  profile: "provider_strict_ed25519_crypto_capability_v1",
  verificationProfile: "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
  adversarialManifest: Object.freeze({
    locatorProfile:
      "distribution_provider_strict_ed25519_adversarial_manifest_v1",
    manifestVersion: 1,
    contentDigest:
      "sha256:6c65e40a20d82c557ba6485008bce62a903d81ff15cc859fab589d203904f1d9",
  }),
});
const C09_BROWSER_ZOD_INVALID_CAPABILITY_V1 = Object.freeze({
  profile: "wrong-profile",
  verificationProfile: "wrong-verification-profile",
  adversarialManifest: Object.freeze({
    locatorProfile: "wrong-locator-profile",
    manifestVersion: 0,
    contentDigest: "not-a-content-digest",
    extra: true,
  }),
  extra: true,
});

function inspectC09BrowserZodSchemaV1(schema) {
  const valid = schema.safeParse(C09_BROWSER_ZOD_VALID_CAPABILITY_V1);
  const invalid = schema.safeParse(C09_BROWSER_ZOD_INVALID_CAPABILITY_V1);
  if (!valid.success || invalid.success) {
    throw new Error("C09 browser Zod equivalence probe inputs drifted");
  }
  return Object.freeze({
    schemaConstructorName: schema.constructor.name,
    errorConstructorName: invalid.error.constructor.name,
    classicSurface: Object.freeze({
      parse: typeof schema.parse,
      safeParse: typeof schema.safeParse,
      optional: typeof schema.optional,
      refine: typeof schema.refine,
      superRefine: typeof schema.superRefine,
      extend: typeof schema.extend,
      toJSONSchema: typeof schema.toJSONSchema,
    }),
    validData: valid.data,
    invalidIssues: invalid.error.issues,
    jsonSchema: schema.toJSONSchema(),
  });
}

function renderC09BrowserZodEquivalenceEntryV1() {
  return [
    'import { ProviderStrictEd25519CryptoCapabilityV1Schema as packageSchema, attestProviderStrictEd25519CryptoHostV1 } from "@understand-code/durable-object-provider-contracts/strict-ed25519-conformance";',
    'import { executeProviderReleaseTargetUniversePointInvalidCaseV1 } from "@understand-code/durable-object-provider-contracts/provider-release-target-universe-point-fixtures";',
    `const validInput = ${JSON.stringify(C09_BROWSER_ZOD_VALID_CAPABILITY_V1)};`,
    `const invalidInput = ${JSON.stringify(C09_BROWSER_ZOD_INVALID_CAPABILITY_V1)};`,
    "const valid = packageSchema.safeParse(validInput);",
    "const invalid = packageSchema.safeParse(invalidInput);",
    'if (!valid.success || invalid.success) throw new Error("browser Zod equivalence probe inputs drifted");',
    "export const c09BrowserZodProbe = Object.freeze({",
    "  schemaConstructorName: packageSchema.constructor.name,",
    "  errorConstructorName: invalid.error.constructor.name,",
    "  classicSurface: Object.freeze({",
    "    parse: typeof packageSchema.parse,",
    "    safeParse: typeof packageSchema.safeParse,",
    "    optional: typeof packageSchema.optional,",
    "    refine: typeof packageSchema.refine,",
    "    superRefine: typeof packageSchema.superRefine,",
    "    extend: typeof packageSchema.extend,",
    "    toJSONSchema: typeof packageSchema.toJSONSchema,",
    "  }),",
    "  validData: valid.data,",
    "  invalidIssues: invalid.error.issues,",
    "  jsonSchema: packageSchema.toJSONSchema(),",
    "});",
    "export const retainedBrowserSurface = Object.freeze([attestProviderStrictEd25519CryptoHostV1, executeProviderReleaseTargetUniversePointInvalidCaseV1]);",
  ].join("\n");
}

async function expectedC09BrowserZodProbeV1(installedRoot) {
  const packageModule = await import(
    `${pathToFileURL(join(installedRoot, "dist", "strict-ed25519-conformance.js")).href}?c09-node=${randomBytes(8).toString("hex")}`
  );
  return inspectC09BrowserZodSchemaV1(
    packageModule.ProviderStrictEd25519CryptoCapabilityV1Schema,
  );
}

async function runC09BrowserZodBundleRuntimeV1(
  bundlePath,
  expectedProbe,
  cwd,
) {
  await run(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      [
        `const expected = ${JSON.stringify(expectedProbe)};`,
        "delete globalThis.process;",
        "delete globalThis.Buffer;",
        `const { c09BrowserZodProbe: actual } = await import(${JSON.stringify(`${pathToFileURL(bundlePath).href}?c09-browser=${randomBytes(8).toString("hex")}`)});`,
        'if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`browser Zod equivalence mismatch: ${JSON.stringify(actual)}`);',
      ].join("\n"),
    ],
    {
      cwd,
      env: { NODE_OPTIONS: C09_BROWSER_RUNTIME_NODE_OPTIONS },
      timeoutMs: C09_RUNTIME_TIMEOUT_MS,
    },
  );
}

async function runC09BrowserRuntimeScannerViteRegressionsV1(
  temporaryRoot,
  providerPackageRoot = packageRoot,
) {
  const regressionRoot = join(
    temporaryRoot,
    "browser-runtime-scanner-vite-regression",
  );
  const scopedModulesRoot = join(
    regressionRoot,
    "node_modules",
    "@understand-code",
  );
  await mkdir(scopedModulesRoot, { recursive: true });
  await symlink(
    providerPackageRoot,
    join(scopedModulesRoot, "durable-object-provider-contracts"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await symlink(
    await realpath(
      (await isFile(join(providerPackageRoot, "node_modules", "zod", "package.json")))
        ? join(providerPackageRoot, "node_modules", "zod")
        : join(dirname(dirname(providerPackageRoot)), "zod"),
    ),
    join(regressionRoot, "node_modules", "zod"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const entryPath = join(regressionRoot, "entry.js");
  const guardNonce = createC09ViteDependencyGuardNonce();
  await writeFile(
    join(regressionRoot, "poison-zod.js"),
    [
      'throw new Error("C09_CONSUMER_ZOD_ALIAS_POISON");',
      "export const z = undefined;",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(regressionRoot, "vite.config.mjs"),
    [
      'import { resolve } from "node:path";',
      ...renderC09ViteDependencyGuardConfigPreamble(guardNonce),
      "export default {",
      "  plugins: [c09ClosedBrowserDependencyGuard()],",
      "  build: {",
      '    target: "es2022",',
      '    outDir: "dist",',
      "    emptyOutDir: true,",
      "    minify: false,",
      '    lib: { entry: resolve("entry.js"), formats: ["es"], fileName: "scanner-regression" },',
      "  },",
      "};",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(regressionRoot, "vite-poison.config.mjs"),
    [
      'import { resolve } from "node:path";',
      ...renderC09ViteDependencyGuardConfigPreamble(guardNonce),
      "export default {",
      '  resolve: { alias: { zod: resolve("poison-zod.js") } },',
      "  plugins: [c09ClosedBrowserDependencyGuard()],",
      "  build: {",
      '    target: "es2022",',
      '    outDir: "dist",',
      "    emptyOutDir: true,",
      "    minify: false,",
      '    lib: { entry: resolve("entry.js"), formats: ["es"], fileName: "scanner-regression" },',
      "  },",
      "};",
    ].join("\n"),
    "utf8",
  );

  async function buildSourceV1(
    label,
    entrySource,
    configFile = "vite.config.mjs",
  ) {
    await writeFile(entryPath, entrySource, "utf8");
    await run(viteCommand, ["build", "--config", configFile], {
      cwd: regressionRoot,
      env: { NODE_OPTIONS: C09_NODE_OPTIONS },
      timeoutMs: C09_VITE_BUILD_TIMEOUT_MS,
    });
    const javaScriptFiles = (
      await listFiles(join(regressionRoot, "dist"))
    ).filter((filePath) => /\.(?:m?js)$/u.test(filePath));
    if (javaScriptFiles.length !== 1) {
      throw new Error(
        `${label} emitted ${javaScriptFiles.length} JavaScript files`,
      );
    }
    const source = await readFile(javaScriptFiles[0], "utf8");
    if (!hasExactC09ViteDependencyGuardSentinel(source, guardNonce)) {
      throw new Error(`${label} lost the Vite dependency-guard sentinel`);
    }
    return Object.freeze({ source, filePath: javaScriptFiles[0] });
  }

  const safeBuild = await buildSourceV1(
    "C09 browser scanner safe regression",
    renderC09BrowserZodEquivalenceEntryV1(),
  );
  const safeDependency = findBrowserRuntimeDependency(safeBuild.source);
  if (safeDependency !== undefined) {
    throw new Error(
      `Real Vite browser scanner safe regression failed: ${safeDependency}`,
    );
  }
  const expectedProbe = await expectedC09BrowserZodProbeV1(
    providerPackageRoot,
  );
  await runC09BrowserZodBundleRuntimeV1(
    safeBuild.filePath,
    expectedProbe,
    regressionRoot,
  );

  const opaqueNativePromiseDescriptorRoundTripBuild =
    await buildSourceV1(
      "C09 opaque native Promise descriptor round-trip regression",
      [
        "function savePromiseDescriptors() {",
        "  const nativePromise = Promise;",
        '  const constructorDescriptor = Object.getOwnPropertyDescriptor(nativePromise.prototype, "constructor");',
        "  const speciesDescriptor = Object.getOwnPropertyDescriptor(nativePromise, Symbol.species);",
        "  const restore = () => {",
        "    if (constructorDescriptor !== undefined) {",
        '      Object.defineProperty(nativePromise.prototype, "constructor", constructorDescriptor);',
        "    }",
        "    if (speciesDescriptor !== undefined) {",
        "      Object.defineProperty(nativePromise, Symbol.species, speciesDescriptor);",
        "    }",
        "  };",
        "  return restore;",
        "}",
        "export { savePromiseDescriptors };",
      ].join("\n"),
    );
  const opaqueNativePromiseDescriptorRoundTripDependency =
    findBrowserRuntimeDependency(
      opaqueNativePromiseDescriptorRoundTripBuild.source,
    );
  if (opaqueNativePromiseDescriptorRoundTripDependency !== undefined) {
    throw new Error(
      `Real Vite opaque native Promise descriptor round-trip regression failed: ${opaqueNativePromiseDescriptorRoundTripDependency}`,
    );
  }
  await run(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      [
        `const { savePromiseDescriptors } = await import(${JSON.stringify(pathToFileURL(opaqueNativePromiseDescriptorRoundTripBuild.filePath).href)});`,
        "const restore = savePromiseDescriptors();",
        'if (typeof restore !== "function") throw new Error("Promise descriptor restore closure is missing");',
        "restore();",
        "let codegenError;",
        'try { Function("return 730047")(); } catch (error) { codegenError = error; }',
        'if (!(codegenError instanceof EvalError) || codegenError.message !== "Code generation from strings disallowed for this context") throw new Error(`Promise descriptor runtime did not retain no-string-codegen: ${codegenError?.name}/${codegenError?.message}`);',
      ].join("\n"),
    ],
    {
      cwd: regressionRoot,
      env: { NODE_OPTIONS: C09_BROWSER_RUNTIME_NODE_OPTIONS },
      timeoutMs: C09_RUNTIME_TIMEOUT_MS,
      label: "C09 opaque native Promise descriptor round-trip runtime",
    },
  );

  const objectReceiverAliasExploitBuild = await buildSourceV1(
    "C09 Object reflection receiver-alias exploit",
    [
      "const NativeObject = Object;",
      "export function executeObjectReceiverAliasExploit() {",
      '  const Dynamic = NativeObject.getOwnPropertyDescriptor(Object.getPrototypeOf(() => {}), "constructor").value;',
      '  return Dynamic("return 730048")();',
      "}",
    ].join("\n"),
  );
  const objectReceiverAliasExploitDependency = findBrowserRuntimeDependency(
    objectReceiverAliasExploitBuild.source,
  );
  if (
    objectReceiverAliasExploitDependency !==
    "dynamic Function-family constructor reflection acquisition"
  ) {
    throw new Error(
      `Real Vite Object reflection receiver-alias exploit was not statically rejected: ${String(objectReceiverAliasExploitDependency)}`,
    );
  }

  const poisonBuild = await buildSourceV1(
    "C09 browser consumer Zod alias-poison regression",
    renderC09BrowserZodEquivalenceEntryV1(),
    "vite-poison.config.mjs",
  );
  const poisonDependency = findBrowserRuntimeDependency(poisonBuild.source);
  if (
    poisonDependency !== undefined ||
    poisonBuild.source.includes("C09_CONSUMER_ZOD_ALIAS_POISON")
  ) {
    throw new Error(
      `Consumer Zod alias poisoned the package browser runtime: ${String(poisonDependency)}`,
    );
  }
  await runC09BrowserZodBundleRuntimeV1(
    poisonBuild.filePath,
    expectedProbe,
    regressionRoot,
  );

  const unsafeBuild = await buildSourceV1(
    "C09 browser scanner unsafe regression",
    [
      "let ambientAlias;",
      "(ambientAlias = globalThis).crypto;",
      "export const escapedAmbientGlobal = ambientAlias;",
    ].join("\n"),
  );
  const unsafeDependency = findBrowserRuntimeDependency(unsafeBuild.source);
  if (
    unsafeDependency === undefined ||
    !unsafeDependency.includes("ambient global object escape")
  ) {
    throw new Error(
      `Real Vite browser scanner unsafe regression was accepted: ${String(unsafeDependency)}`,
    );
  }

  const exportedReflectionCapabilityBuild = await buildSourceV1(
    "C09 exported reflection capability exploit",
    [
      "const get = Reflect.get;",
      "const target = Object.getPrototypeOf(() => {});",
      "const key = String.fromCharCode(99, 111, 110, 115, 116, 114, 117, 99, 116, 111, 114);",
      "export const Dynamic = get(target, key);",
    ].join("\n"),
  );
  const exportedReflectionCapabilityDependency =
    findBrowserRuntimeDependency(exportedReflectionCapabilityBuild.source);
  if (
    exportedReflectionCapabilityDependency !==
    "computed Function-family reflection acquisition"
  ) {
    throw new Error(
      `Real Vite exported reflection capability did not fail at the dependency scanner: ${String(exportedReflectionCapabilityDependency)}`,
    );
  }

  async function assertScannerOrNoStringCodegenRejectionV1(
    label,
    entrySource,
  ) {
    const exploitBuild = await buildSourceV1(label, entrySource);
    const staticDependency = findBrowserRuntimeDependency(exploitBuild.source);
    if (staticDependency !== undefined) {
      return Object.freeze({ gate: "dependency_scanner", staticDependency });
    }
    await run(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        [
          "let runtimeError;",
          `try { await import(${JSON.stringify(`${pathToFileURL(exploitBuild.filePath).href}?c09-no-codegen=${randomBytes(8).toString("hex")}`)}); } catch (error) { runtimeError = error; }`,
          'if (!(runtimeError instanceof EvalError) || runtimeError.message !== "Code generation from strings disallowed for this context") throw new Error(`no-string-codegen rejection mismatch: ${runtimeError?.name}/${runtimeError?.message}`);',
        ].join("\n"),
      ],
      {
        cwd: regressionRoot,
        env: { NODE_OPTIONS: C09_BROWSER_RUNTIME_NODE_OPTIONS },
        timeoutMs: C09_RUNTIME_TIMEOUT_MS,
        label: `${label} no-string-codegen runtime`,
      },
    );
    return Object.freeze({ gate: "no_string_codegen_runtime" });
  }

  const exploitGateCounts = {
    dependency_scanner: 0,
    no_string_codegen_runtime: 0,
  };
  for (const [label, exploitSource] of [
    [
      "C09 constructor-destructuring exploit",
      [
        "const { constructor: Dynamic } = Function.prototype.call;",
        'export const proof = new Dynamic("return 730031")();',
      ].join("\n"),
    ],
    [
      "C09 reflected descriptor-alias exploit",
      [
        "const descriptor = Reflect.getOwnPropertyDescriptor;",
        'const Dynamic = descriptor(Object.getPrototypeOf(() => {}), "constructor").value;',
        'export const proof = Dynamic("return 730014")();',
      ].join("\n"),
    ],
    [
      "C09 descriptor-enumeration exploit",
      [
        "const descriptors = Object.getOwnPropertyDescriptors(Object.getPrototypeOf(() => {}));",
        'const Dynamic = Object.values(descriptors).find(({ value }) => typeof value === "function" && value.name === "Function").value;',
        'export const proof = Dynamic("return 730018")();',
      ].join("\n"),
    ],
    [
      "C09 shorthand-holder laundering exploit",
      [
        "const proto = Object.getPrototypeOf(() => {});",
        "const holder = { proto };",
        'const key = "constructor";',
        'const Dynamic = holder.proto[key];',
        'export const proof = Dynamic("return 730020")();',
      ].join("\n"),
    ],
    [
      "C09 array-holder laundering exploit",
      [
        "const proto = Object.getPrototypeOf(() => {});",
        "const holder = [proto];",
        'const key = "constructor";',
        'const Dynamic = holder[0][key];',
        'export const proof = Dynamic("return 730021")();',
      ].join("\n"),
    ],
    [
      "C09 identity-call laundering exploit",
      [
        "const proto = Object.getPrototypeOf(() => {});",
        "const identity = (value) => value;",
        'const key = "constructor";',
        'const Dynamic = identity(proto)[key];',
        'export const proof = Dynamic("return 730022")();',
      ].join("\n"),
    ],
    [
      "C09 conditional laundering exploit",
      [
        "const proto = Object.getPrototypeOf(() => {});",
        'const key = "constructor";',
        'const Dynamic = (true ? proto : null)[key];',
        'export const proof = Dynamic("return 730023")();',
      ].join("\n"),
    ],
    [
      "C09 second-order reflection-alias laundering exploit",
      [
        "const get1 = Reflect.get;",
        "const get2 = get1;",
        "const target = Object.getPrototypeOf(() => {});",
        "const key = String.fromCharCode(99, 111, 110, 115, 116, 114, 117, 99, 116, 111, 114);",
        "const Dynamic = get2(target, key);",
        'export const proof = Dynamic("return 730024")();',
      ].join("\n"),
    ],
    [
      "C09 Reflect.apply laundering exploit",
      [
        "const target = Object.getPrototypeOf(() => {});",
        "const key = String.fromCharCode(99, 111, 110, 115, 116, 114, 117, 99, 116, 111, 114);",
        "const Dynamic = Reflect.apply(Reflect.get, null, [target, key]);",
        'export const proof = Dynamic("return 730025")();',
      ].join("\n"),
    ],
    [
      "C09 Reflect.get.call laundering exploit",
      [
        "const target = Object.getPrototypeOf(() => {});",
        "const key = String.fromCharCode(99, 111, 110, 115, 116, 114, 117, 99, 116, 111, 114);",
        "const Dynamic = Reflect.get.call(null, target, key);",
        'export const proof = Dynamic("return 730026")();',
      ].join("\n"),
    ],
    [
      "C09 Reflect.get.bind laundering exploit",
      [
        "const target = Object.getPrototypeOf(() => {});",
        "const key = String.fromCharCode(99, 111, 110, 115, 116, 114, 117, 99, 116, 111, 114);",
        "const bound = Reflect.get.bind(null, target, key);",
        "const Dynamic = bound();",
        'export const proof = Dynamic("return 730027")();',
      ].join("\n"),
    ],
  ]) {
    const evidence = await assertScannerOrNoStringCodegenRejectionV1(
      label,
      exploitSource,
    );
    exploitGateCounts[evidence.gate] += 1;
  }
  if (
    exploitGateCounts.dependency_scanner < 1 ||
    exploitGateCounts.no_string_codegen_runtime < 1
  ) {
    throw new Error(
      `C09 browser exploit combination gate did not exercise both branches: ${JSON.stringify(exploitGateCounts)}`,
    );
  }

  const consumerZodBuild = await buildSourceV1(
    "C09 browser consumer Zod isolation regression",
    [
      'import { ProviderStrictEd25519CryptoCapabilityV1Schema as packageSchema } from "@understand-code/durable-object-provider-contracts/strict-ed25519-conformance";',
      'import { ZodError, ZodObject } from "zod";',
      `const invalid = packageSchema.safeParse(${JSON.stringify(C09_BROWSER_ZOD_INVALID_CAPABILITY_V1)});`,
      'if (invalid.success) throw new Error("consumer Zod isolation invalid input passed");',
      "export const c09ConsumerZodIsolationProbe = Object.freeze({",
      "  schemaIsConsumerZodObject: packageSchema instanceof ZodObject,",
      "  errorIsConsumerZodError: invalid.error instanceof ZodError,",
      "  schemaConstructorIsConsumerZodObject: packageSchema.constructor === ZodObject,",
      "  errorConstructorIsConsumerZodError: invalid.error.constructor === ZodError,",
      "  schemaConstructorName: packageSchema.constructor.name,",
      "  errorConstructorName: invalid.error.constructor.name,",
      "});",
    ].join("\n"),
  );
  const consumerZodDependency = findBrowserRuntimeDependency(
    consumerZodBuild.source,
  );
  if (
    consumerZodDependency !== "dynamic code global Function" ||
    !consumerZodBuild.source.includes(
      "Zod transparent proxy is disabled in this browser-safe build",
    )
  ) {
    throw new Error(
      `Consumer Zod isolation bundle did not retain both runtimes: ${String(consumerZodDependency)}`,
    );
  }
  await run(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      [
        `const { c09ConsumerZodIsolationProbe: probe } = await import(${JSON.stringify(`${pathToFileURL(consumerZodBuild.filePath).href}?c09-consumer-zod=${randomBytes(8).toString("hex")}`)});`,
        'if (probe.schemaIsConsumerZodObject !== true || probe.errorIsConsumerZodError !== true || probe.schemaConstructorIsConsumerZodObject !== false || probe.errorConstructorIsConsumerZodError !== false || probe.schemaConstructorName !== "ZodObject" || probe.errorConstructorName !== "ZodError") throw new Error(`consumer Zod isolation mismatch: ${JSON.stringify(probe)}`);',
      ].join("\n"),
    ],
    {
      cwd: regressionRoot,
      env: { NODE_OPTIONS: C09_BROWSER_RUNTIME_NODE_OPTIONS },
      timeoutMs: C09_RUNTIME_TIMEOUT_MS,
    },
  );
}

async function runC09BrowserZodColdPackRegressionsV1(temporaryRoot) {
  const startedAt = performance.now();
  const cleanPackageRoot = join(temporaryRoot, "clean-package");
  const packRoot = join(temporaryRoot, "pack");
  const consumerRoot = join(temporaryRoot, "consumer");
  const viteRegressionRoot = join(temporaryRoot, "installed-vite");
  await Promise.all([
    mkdir(packRoot, { recursive: true }),
    mkdir(consumerRoot, { recursive: true }),
    mkdir(viteRegressionRoot, { recursive: true }),
  ]);
  await cp(packageRoot, cleanPackageRoot, {
    recursive: true,
    filter(sourcePath) {
      const sourceRelativePath = relative(packageRoot, sourcePath);
      if (sourceRelativePath === "") return true;
      const topLevelSegment = sourceRelativePath.split(sep)[0];
      return topLevelSegment !== "dist" && topLevelSegment !== "node_modules";
    },
  });
  await symlink(
    join(packageRoot, "node_modules"),
    join(cleanPackageRoot, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  for (const forbiddenBeforeBuild of [
    "dist/browser-zod.js",
    "dist/browser-zod.LICENSE.txt",
    "dist/zod-runtime.js",
    "dist/zod-runtime.d.ts",
  ]) {
    if (await isFile(join(cleanPackageRoot, forbiddenBeforeBuild))) {
      throw new Error(
        `Clean browser Zod build inherited ${forbiddenBeforeBuild}`,
      );
    }
  }

  await run(npmCommand, ["run", "build"], {
    cwd: cleanPackageRoot,
    env: { NODE_OPTIONS: C09_NODE_OPTIONS },
    timeoutMs: C09_VITE_BUILD_TIMEOUT_MS,
  });
  const cleanPackageRealPath = await realpath(cleanPackageRoot);
  const cleanManifest = JSON.parse(
    await readFile(join(cleanPackageRoot, "package.json"), "utf8"),
  );
  await assertColdInstalledBrowserZodV1(
    cleanPackageRoot,
    cleanPackageRealPath,
    cleanManifest,
  );

  await run(
    npmCommand,
    [
      "pack",
      ".",
      "--ignore-scripts",
      "--pack-destination",
      packRoot,
      "--silent",
    ],
    {
      cwd: cleanPackageRoot,
      env: { NODE_OPTIONS: C09_NODE_OPTIONS },
      timeoutMs: PACK_COMMAND_TIMEOUT_MS,
    },
  );
  const tarballs = (await readdir(packRoot))
    .filter((name) => name.endsWith(".tgz"))
    .sort();
  if (tarballs.length !== 1) {
    throw new Error(
      `Cold browser Zod pack emitted ${tarballs.length} tarballs`,
    );
  }
  const tarballPath = join(packRoot, tarballs[0]);
  await assertExactProviderTarInventory(tarballPath, "cold browser Zod pack");

  await run(
    npmCommand,
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      tarballPath,
    ],
    {
      cwd: consumerRoot,
      env: { NODE_OPTIONS: C09_NODE_OPTIONS },
      timeoutMs: DEFAULT_COMMAND_TIMEOUT_MS,
    },
  );
  const installedRoot = join(
    consumerRoot,
    "node_modules",
    "@understand-code",
    "durable-object-provider-contracts",
  );
  const installedRootRealPath = await realpath(installedRoot);
  const installedManifest = JSON.parse(
    await readFile(join(installedRoot, "package.json"), "utf8"),
  );
  await assertColdInstalledBrowserZodV1(
    installedRoot,
    installedRootRealPath,
    installedManifest,
  );
  const installedZodPackagePath = await realpath(
    join(consumerRoot, "node_modules", "zod", "package.json"),
  );
  const consumerRootRealPath = await realpath(consumerRoot);
  if (
    !isStrictPathDescendantV1(consumerRootRealPath, installedZodPackagePath)
  ) {
    throw new Error("Cold-installed official Zod escaped the consumer root");
  }
  const installedZodManifest = JSON.parse(
    await readFile(installedZodPackagePath, "utf8"),
  );
  if (
    installedZodManifest.name !== "zod" ||
    installedZodManifest.version !== C09_BROWSER_ZOD_VERSION_V1
  ) {
    throw new Error("Cold-installed official Zod version drifted");
  }

  await runC09BrowserRuntimeScannerViteRegressionsV1(
    viteRegressionRoot,
    installedRoot,
  );
  return Object.freeze({ wallTimeMs: performance.now() - startedAt });
}

async function listRelativeSchemaPaths(schemaRoot) {
  return (await listFiles(schemaRoot))
    .filter((filePath) => filePath.endsWith(".schema.json"))
    .map((filePath) => relative(schemaRoot, filePath).split(sep).join("/"))
    .sort();
}

function assertExactSortedPathSet(actual, expected, label) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((filePath) => !actualSet.has(filePath));
  const extra = actual.filter((filePath) => !expectedSet.has(filePath));
  if (
    actual.length !== actualSet.size ||
    expected.length !== expectedSet.size ||
    actual.length !== expected.length ||
    actual.some((filePath, index) => filePath !== expected[index]) ||
    missing.length !== 0 ||
    extra.length !== 0
  ) {
    throw new Error(
      `${label} differs: missing=[${missing.join(", ")}], extra=[${extra.join(", ")}]`,
    );
  }
}

async function assertExactProviderDirectory(providerRoot, label) {
  const directoryEntries = await readdir(providerRoot);
  const entries = await Promise.all(
    directoryEntries.map(async (name) => {
      const resourcePath = join(providerRoot, name);
      const metadata = await lstat(resourcePath);
      const regular = metadata.isFile();
      return {
        path: name,
        type: regular ? "regular" : "other",
        nlink: metadata.nlink,
        bytes: regular
          ? new Uint8Array(await readFile(resourcePath))
          : new Uint8Array(),
      };
    }),
  );
  assertExactProviderResourceEntries(
    entries,
    FIXED_PROVIDER_RESOURCES,
    `${label} provider inventory`,
  );
}

async function expectAsyncRejection(operation, label) {
  try {
    await operation();
  } catch {
    return;
  }
  throw new Error(`${label} regression was not rejected`);
}

function readTarString(header, offset, length) {
  const field = header.subarray(offset, offset + length);
  const terminator = field.indexOf(0);
  return field
    .subarray(0, terminator === -1 ? field.length : terminator)
    .toString("utf8");
}

function readTarOctal(header, offset, length, label) {
  const field = header.subarray(offset, offset + length);
  if ((field[0] ?? 0) >= 0x80) {
    throw new Error(`${label} uses unsupported base-256 encoding`);
  }
  const text = field
    .toString("ascii")
    .replace(/\0.*$/u, "")
    .trim();
  if (!/^[0-7]+$/u.test(text)) {
    throw new Error(`${label} is not canonical octal`);
  }
  const value = Number.parseInt(text, 8);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} is outside the safe range`);
  }
  return value;
}

function assertTarHeaderChecksum(header, entryOffset) {
  const expected = readTarOctal(
    header,
    148,
    8,
    `tar checksum at ${entryOffset}`,
  );
  let actual = 0;
  for (let index = 0; index < header.length; index += 1) {
    actual +=
      index >= 148 && index < 156 ? 0x20 : header[index];
  }
  if (actual !== expected) {
    throw new Error(`tar checksum mismatch at ${entryOffset}`);
  }
}

function parsePaxAttributes(payload) {
  const attributes = new Map();
  let offset = 0;
  while (offset < payload.byteLength) {
    const separator = payload.indexOf(0x20, offset);
    if (separator === -1) {
      throw new Error("invalid PAX record length");
    }
    const lengthText = payload
      .subarray(offset, separator)
      .toString("ascii");
    if (!/^[1-9][0-9]*$/u.test(lengthText)) {
      throw new Error("invalid PAX record length");
    }
    const recordLength = Number.parseInt(lengthText, 10);
    const recordEnd = offset + recordLength;
    if (
      !Number.isSafeInteger(recordLength) ||
      recordEnd > payload.byteLength ||
      payload[recordEnd - 1] !== 0x0a
    ) {
      throw new Error("invalid PAX record boundary");
    }
    const record = new TextDecoder("utf-8", { fatal: true }).decode(
      payload.subarray(separator + 1, recordEnd - 1),
    );
    const equals = record.indexOf("=");
    if (equals <= 0) throw new Error("invalid PAX attribute");
    const key = record.slice(0, equals);
    if (attributes.has(key)) {
      throw new Error(`duplicate PAX attribute ${key}`);
    }
    attributes.set(key, record.slice(equals + 1));
    offset = recordEnd;
  }
  return attributes;
}

function assertSupportedPaxAttributes(attributes, scope) {
  const allowedKeys =
    scope === "local" ? new Set(["path"]) : new Set();
  for (const key of attributes.keys()) {
    if (!allowedKeys.has(key)) {
      throw new Error(
        `${scope} PAX attribute ${key} is not supported`,
      );
    }
  }
  if (
    scope === "local" &&
    (attributes.size !== 1 ||
      (attributes.get("path")?.length ?? 0) === 0)
  ) {
    throw new Error(
      "local PAX header must contain exactly one non-empty path",
    );
  }
  if (scope === "global" && attributes.size !== 0) {
    throw new Error("global PAX attributes are not supported");
  }
}

function expectSynchronousRejection(operation, label) {
  try {
    operation();
  } catch {
    return;
  }
  throw new Error(`${label} regression was not rejected`);
}

expectSynchronousRejection(
  () =>
    assertSupportedPaxAttributes(
      parsePaxAttributes(Buffer.from("10 size=1\n", "ascii")),
      "local",
    ),
  "PAX size override",
);
expectSynchronousRejection(
  () =>
    assertSupportedPaxAttributes(
      parsePaxAttributes(Buffer.from("11 mtime=0\n", "ascii")),
      "global",
    ),
  "global PAX metadata",
);

function collidesWithProviderArchivePath(path) {
  const normalizedSegments = [];
  for (const segment of path.replaceAll("\\", "/").split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      normalizedSegments.pop();
    } else {
      normalizedSegments.push(segment);
    }
  }
  const collisionKey = normalizedSegments
    .join("/")
    .normalize("NFC")
    .toLowerCase();
  return (
    collisionKey === "package/provider" ||
    collisionKey.startsWith("package/provider/")
  );
}

async function readGunzipBounded(tarballPath) {
  const chunks = [];
  let total = 0;
  const gunzip = createReadStream(tarballPath).pipe(createGunzip());
  for await (const chunk of gunzip) {
    total += chunk.byteLength;
    if (total > MAX_UNCOMPRESSED_PACK_BYTES) {
      gunzip.destroy();
      throw new Error("packed archive exceeds the verification byte cap");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

async function assertExactProviderTarInventory(
  tarballPath,
  label,
) {
  const archive = await readGunzipBounded(tarballPath);
  const providerEntries = [];
  const browserZodEntries = [];
  let offset = 0;
  let pendingPaxPath;
  let pendingLongPath;
  let zeroBlockCount = 0;

  while (offset + 512 <= archive.byteLength) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      zeroBlockCount += 1;
      offset += 512;
      if (zeroBlockCount === 2) break;
      continue;
    }
    if (zeroBlockCount !== 0) {
      throw new Error("non-zero tar header follows an end marker");
    }

    assertTarHeaderChecksum(header, offset);
    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const headerPath = prefix.length === 0 ? name : `${prefix}/${name}`;
    const size = readTarOctal(header, 124, 12, `tar size for ${headerPath}`);
    const typeFlag = String.fromCharCode(header[156] ?? 0);
    const linkPath = readTarString(header, 157, 100);
    const payloadStart = offset + 512;
    const payloadEnd = payloadStart + size;
    if (payloadEnd > archive.byteLength) {
      throw new Error(`truncated tar payload for ${headerPath}`);
    }
    const payload = archive.subarray(payloadStart, payloadEnd);
    offset =
      payloadStart + Math.ceil(size / 512) * 512;

    if (typeFlag === "x") {
      if (pendingPaxPath !== undefined || pendingLongPath !== undefined) {
        throw new Error("stacked tar path extension");
      }
      const attributes = parsePaxAttributes(payload);
      assertSupportedPaxAttributes(attributes, "local");
      pendingPaxPath = attributes.get("path");
      continue;
    }
    if (typeFlag === "g") {
      const attributes = parsePaxAttributes(payload);
      assertSupportedPaxAttributes(attributes, "global");
      continue;
    }
    if (typeFlag === "L") {
      if (pendingPaxPath !== undefined || pendingLongPath !== undefined) {
        throw new Error("stacked tar path extension");
      }
      const terminator = payload.indexOf(0);
      pendingLongPath = payload
        .subarray(
          0,
          terminator === -1 ? payload.byteLength : terminator,
        )
        .toString("utf8");
      continue;
    }

    const effectivePath =
      pendingPaxPath ?? pendingLongPath ?? headerPath;
    pendingPaxPath = undefined;
    pendingLongPath = undefined;
    if (collidesWithProviderArchivePath(effectivePath)) {
      providerEntries.push({
        path: effectivePath,
        typeFlag,
        linkPath,
        size,
        payload,
      });
    }
    if (
      effectivePath === "package/dist/browser-zod.js" ||
      effectivePath === "package/dist/browser-zod.LICENSE.txt" ||
      effectivePath === "package/dist/zod-runtime.js" ||
      effectivePath === "package/dist/zod-runtime.d.ts"
    ) {
      browserZodEntries.push({
        path: effectivePath,
        typeFlag,
        linkPath,
        size,
        payload,
      });
    }
  }

  if (
    pendingPaxPath !== undefined ||
    pendingLongPath !== undefined ||
    zeroBlockCount < 2
  ) {
    throw new Error("packed tar has an incomplete terminal structure");
  }
  if (archive.subarray(offset).some((byte) => byte !== 0)) {
    throw new Error(
      "packed tar contains non-zero data after its terminal marker",
    );
  }

  assertExactProviderResourceEntries(
    providerEntries.map((entry) => ({
      path: entry.path,
      type:
        (entry.typeFlag === "0" || entry.typeFlag === "\0") &&
        entry.linkPath === "" &&
        !entry.path.includes("\\") &&
        !entry.path
          .split("/")
          .some((segment) => segment === "." || segment === "..")
          ? "regular"
          : "other",
      nlink: entry.typeFlag === "1" ? 2 : 1,
      bytes: new Uint8Array(entry.payload),
    })),
    FIXED_PROVIDER_RESOURCES.map((resource) => ({
      ...resource,
      path: resource.archivePath,
    })),
    `${label} tar provider inventory`,
  );

  const expectedBrowserZodEntries = Object.freeze([
    Object.freeze({
      path: "package/dist/zod-runtime.js",
      byteLength: C09_BROWSER_ZOD_RUNTIME_WRAPPER_BYTE_LENGTH_V1,
      sha256: C09_BROWSER_ZOD_RUNTIME_WRAPPER_SHA256_V1,
    }),
    Object.freeze({
      path: "package/dist/zod-runtime.d.ts",
      byteLength: C09_BROWSER_ZOD_RUNTIME_WRAPPER_DTS_BYTE_LENGTH_V1,
      sha256: C09_BROWSER_ZOD_RUNTIME_WRAPPER_DTS_SHA256_V1,
    }),
    Object.freeze({
      path: "package/dist/browser-zod.js",
      byteLength: C09_BROWSER_ZOD_BYTE_LENGTH_V1,
      sha256: C09_BROWSER_ZOD_SHA256_V1,
    }),
    Object.freeze({
      path: "package/dist/browser-zod.LICENSE.txt",
      byteLength: C09_BROWSER_ZOD_LICENSE_BYTE_LENGTH_V1,
      sha256: C09_BROWSER_ZOD_LICENSE_SHA256_V1,
    }),
  ]);
  if (browserZodEntries.length !== expectedBrowserZodEntries.length) {
    throw new Error(
      `${label} tar browser Zod inventory has ${browserZodEntries.length} entries`,
    );
  }
  for (const expected of expectedBrowserZodEntries) {
    const matches = browserZodEntries.filter(
      (entry) => entry.path === expected.path,
    );
    const [entry] = matches;
    if (
      matches.length !== 1 ||
      (entry.typeFlag !== "0" && entry.typeFlag !== "\0") ||
      entry.linkPath !== "" ||
      entry.size !== expected.byteLength ||
      entry.payload.byteLength !== expected.byteLength ||
      sha256HexV1(entry.payload) !== expected.sha256
    ) {
      throw new Error(`${label} tar ${expected.path} drifted`);
    }
  }
}

function duplicateTarMemberForRegression(
  archive,
  targetPath,
) {
  let offset = 0;
  let member;
  let endMarkerOffset;
  while (offset + 512 <= archive.byteLength) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      endMarkerOffset = offset;
      break;
    }
    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const path = prefix.length === 0 ? name : `${prefix}/${name}`;
    const size = readTarOctal(
      header,
      124,
      12,
      `regression tar size for ${path}`,
    );
    const memberEnd =
      offset + 512 + Math.ceil(size / 512) * 512;
    if (path === targetPath) {
      member = archive.subarray(offset, memberEnd);
    }
    offset = memberEnd;
  }
  if (member === undefined || endMarkerOffset === undefined) {
    throw new Error("could not construct duplicate tar regression");
  }
  return Buffer.concat([
    archive.subarray(0, endMarkerOffset),
    member,
    archive.subarray(endMarkerOffset),
  ]);
}

function appendTarMemberAfterEndForRegression(
  archive,
  targetPath,
) {
  let offset = 0;
  let member;
  while (offset + 512 <= archive.byteLength) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const path = prefix.length === 0 ? name : `${prefix}/${name}`;
    const size = readTarOctal(
      header,
      124,
      12,
      `trailing regression tar size for ${path}`,
    );
    const memberEnd =
      offset + 512 + Math.ceil(size / 512) * 512;
    if (path === targetPath) {
      member = archive.subarray(offset, memberEnd);
    }
    offset = memberEnd;
  }
  if (member === undefined) {
    throw new Error(
      "could not construct trailing tar member regression",
    );
  }
  return Buffer.concat([archive, member, Buffer.alloc(1_024)]);
}

function mutateTarMemberTypeForRegression(
  archive,
  targetPath,
  typeFlag,
  linkPath,
) {
  const mutated = Buffer.from(archive);
  let offset = 0;
  while (offset + 512 <= mutated.byteLength) {
    const header = mutated.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const path = prefix.length === 0 ? name : `${prefix}/${name}`;
    const size = readTarOctal(
      header,
      124,
      12,
      `regression tar size for ${path}`,
    );
    if (path === targetPath) {
      header[156] = typeFlag.charCodeAt(0);
      header.fill(0, 157, 257);
      const encodedLinkPath = Buffer.from(linkPath, "utf8");
      if (encodedLinkPath.byteLength > 100) {
        throw new Error("regression tar link path is too long");
      }
      encodedLinkPath.copy(header, 157);
      header.fill(0x20, 148, 156);
      let checksum = 0;
      for (const byte of header) checksum += byte;
      const checksumField = `${checksum.toString(8).padStart(6, "0")}\0 `;
      Buffer.from(checksumField, "ascii").copy(header, 148);
      return mutated;
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  throw new Error(`could not mutate tar member ${targetPath}`);
}

function packageSpecifier(exportKey) {
  return exportKey === "."
    ? "@understand-code/durable-object-provider-contracts"
    : `@understand-code/durable-object-provider-contracts${exportKey.slice(1)}`;
}

async function expectC09LightRejectionV1(label, operation) {
  try {
    await operation();
  } catch {
    return;
  }
  throw new Error(`C09 light regression was accepted: ${label}`);
}

async function runC09DedicatedGateLightRegressionsV1() {
  await expectC09LightRejectionV1("pre-cold-install canonicalizer", () =>
    requireInstalledCanonicalizerV1(),
  );

  const expected = Object.freeze({
    nonce: "0123456789abcdef0123456789abcdef",
    rootPid: 41_001,
    monitorPid: 41_002,
  });
  const ready = {
    profile: C09_RSS_MONITOR_PROFILE_V1,
    state: "ready",
    nonce: expected.nonce,
    rootPid: expected.rootPid,
    monitorPid: expected.monitorPid,
    sampleIntervalMs: 50,
    countingPolicy: C09_RSS_MONITOR_COUNTING_POLICY_V1,
  };
  validateC09RssMonitorReadyReportV1(ready, expected);
  const complete = {
    ...ready,
    state: "complete",
    sampleCount: 3,
    elapsedMs: 100,
    peakSample: {
      monotonicOffsetMs: 20,
      aggregateRssBytes: 175,
      processes: [
        {
          pid: expected.rootPid,
          parentPid: 1,
          rssBytes: 100,
          role: "distribution_parent",
        },
        {
          pid: expected.monitorPid,
          parentPid: expected.rootPid,
          rssBytes: 50,
          role: "rss_monitor",
        },
        {
          pid: 41_003,
          parentPid: expected.monitorPid,
          rssBytes: 25,
          role: "distribution_descendant",
        },
      ],
    },
  };
  validateC09RssMonitorCompleteReportV1(complete, expected);
  for (const [label, mutate] of [
    ["under-reported RSS", (copy) => (copy.peakSample.aggregateRssBytes -= 1)],
    ["extra report field", (copy) => (copy.extra = true)],
    ["stale nonce", (copy) => (copy.nonce = "f".repeat(32))],
    ["partial process record", (copy) => delete copy.peakSample.processes[1].parentPid],
    [
      "self-parent cycle",
      (copy) => (copy.peakSample.processes[2].parentPid = 41_003),
    ],
    [
      "two-node cycle",
      (copy) => {
        copy.peakSample.processes[2].parentPid = 41_004;
        copy.peakSample.processes.push({
          pid: 41_004,
          parentPid: 41_003,
          rssBytes: 0,
          role: "distribution_descendant",
        });
      },
    ],
    [
      "unrooted component",
      (copy) => {
        copy.peakSample.processes[2].parentPid = 41_004;
        copy.peakSample.processes.push({
          pid: 41_004,
          parentPid: 1,
          rssBytes: 0,
          role: "distribution_descendant",
        });
      },
    ],
  ]) {
    const copy = JSON.parse(JSON.stringify(complete));
    mutate(copy);
    await expectC09LightRejectionV1(label, () =>
      validateC09RssMonitorCompleteReportV1(copy, expected),
    );
  }
  await expectC09LightRejectionV1("partial JSON", () =>
    parseExactJsonObjectV1('{"profile":', "C09 partial report"),
  );

  const lightRoot = await mkdtemp(join(tmpdir(), "c09-gate-light-"));
  try {
    const pathRoot = join(lightRoot, "path-root");
    await mkdir(pathRoot);
    const expectedPaths = {
      golden: join(pathRoot, "golden.json"),
      invalid: join(pathRoot, "invalid.json"),
      strict: join(pathRoot, "strict.json"),
    };
    await Promise.all(
      Object.values(expectedPaths).map((path) => writeFile(path, "{}", "utf8")),
    );
    const { resolveC09ColdInstallPathsV1 } = await import(
      "./lib/provider-registry-evidence-binding-distribution-node-worker.mjs"
    );
    const resolvedPaths = await resolveC09ColdInstallPathsV1({
      installedRoot: pathRoot,
      expectedPaths,
    });
    const canonicalPathRoot = await realpath(pathRoot);
    if (
      resolvedPaths.installedRoot !== canonicalPathRoot ||
      (process.platform === "darwin" &&
        pathRoot.startsWith("/var/") &&
        !canonicalPathRoot.startsWith("/private/var/"))
    ) {
      throw new Error("C09 macOS /var realpath regression failed");
    }
    const outsidePath = join(lightRoot, "outside.json");
    await writeFile(outsidePath, "{}", "utf8");
    await expectC09LightRejectionV1("cold-install path escape", () =>
      resolveC09ColdInstallPathsV1({
        installedRoot: pathRoot,
        expectedPaths: { ...expectedPaths, strict: outsidePath },
      }),
    );

    const normalMonitorRoot = join(lightRoot, "normal-monitor");
    await mkdir(normalMonitorRoot);
    const normalGate = await startC09DedicatedGateMonitorV1(normalMonitorRoot);
    await delayV1(125);
    const normalReport = await stopC09DedicatedGateMonitorV1(normalGate, false);
    if (
      normalReport.state !== "complete" ||
      !normalGate.stopped ||
      isC09ProcessTreeLiveV1(normalGate.child)
    ) {
      throw new Error("C09 normal monitor lifecycle regression failed");
    }

    const stopWriteRoot = join(lightRoot, "stop-write-monitor");
    await mkdir(stopWriteRoot);
    const stopWriteGate =
      await startC09DedicatedGateMonitorV1(stopWriteRoot);
    await mkdir(stopWriteGate.stopPath);
    await expectC09LightRejectionV1("stop write", () =>
      stopC09DedicatedGateMonitorV1(stopWriteGate, false),
    );
    if (
      !stopWriteGate.stopped ||
      isC09ProcessTreeLiveV1(stopWriteGate.child)
    ) {
      throw new Error("C09 stop-write cleanup left a monitor alive");
    }

    const treeChildSource = [
      'const { spawn } = require("node:child_process");',
      'const { writeFileSync } = require("node:fs");',
      'const grandchild = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });',
      'writeFileSync(process.env.C09_LIGHT_GRANDCHILD_PID_PATH, String(grandchild.pid));',
      'if (process.env.C09_LIGHT_TREE_MODE === "crash") setTimeout(() => process.exit(17), 25);',
      'setInterval(() => {}, 1000);',
    ].join("\n");
    for (const mode of ["timeout", "crash"]) {
      const grandchildPidPath = join(lightRoot, `grandchild-${mode}.pid`);
      const execution = startCapturedC09ProcessV1(
        {
          label: `tree-child ${mode} regression`,
          command: process.execPath,
          args: ["-e", treeChildSource],
          cwd: lightRoot,
          env: {
            NODE_OPTIONS: C09_NODE_OPTIONS,
            C09_LIGHT_TREE_MODE: mode,
            C09_LIGHT_GRANDCHILD_PID_PATH: grandchildPidPath,
          },
        },
        mode === "timeout" ? 250 : 5_000,
        64 * 1024,
      );
      await expectC09LightRejectionV1(`tree-child ${mode}`, () =>
        execution.promise,
      );
      const grandchildPid = Number(await readFile(grandchildPidPath, "utf8"));
      const postCleanupTable = readC09ProcessTableV1();
      if (postCleanupTable.error !== undefined) throw postCleanupTable.error;
      const grandchildIdentityStillLive = postCleanupTable.records.some(
        (record) =>
          record.pid === grandchildPid &&
          record.processGroupId === execution.child.pid,
      );
      if (
        !Number.isSafeInteger(grandchildPid) ||
        grandchildPid <= 1 ||
        grandchildIdentityStillLive ||
        isC09ProcessTreeLiveV1(execution.child)
      ) {
        throw new Error(`C09 tree-child ${mode} cleanup left an orphan`);
      }
    }

    const boundedSchedulerSource = [
      "const laneIndex = Number(process.argv[1]);",
      "const delays = [500, 550, 600, 25];",
      "const startedAt = Date.now();",
      "setTimeout(() => {",
      "  process.stdout.write(JSON.stringify({ laneIndex, startedAt, endedAt: Date.now() }));",
      "}, delays[laneIndex]);",
    ].join("\n");
    const boundedSchedulerGate = {
      startedAt: performance.now(),
      stopped: false,
      lastChildExitAt: undefined,
    };
    const boundedSchedulerReports = await runParallelC09WorkersV1(
      boundedSchedulerGate,
      Array.from({ length: 4 }, (_, laneIndex) => ({
        label: `bounded scheduler success lane ${laneIndex}`,
        command: process.execPath,
        args: ["-e", boundedSchedulerSource, String(laneIndex)],
        cwd: lightRoot,
        env: { NODE_OPTIONS: C09_NODE_OPTIONS },
      })),
    );
    const firstCompletion = Math.min(
      ...boundedSchedulerReports.slice(0, 3).map(({ endedAt }) => endedAt),
    );
    if (
      boundedSchedulerReports.some(
        ({ laneIndex }, index) => laneIndex !== index,
      ) ||
      boundedSchedulerReports
        .slice(0, 3)
        .some(({ startedAt }) => startedAt >= firstCompletion) ||
      boundedSchedulerReports[3].startedAt < firstCompletion
    ) {
      throw new Error(
        "C09 bounded replay scheduler did not retain three-live ordered execution",
      );
    }

    const pendingWorkerMarker = join(lightRoot, "pending-worker-started");
    const failingSchedulerSource = [
      'const { writeFileSync } = require("node:fs");',
      "const laneIndex = Number(process.argv[1]);",
      "const pendingMarker = process.argv[2];",
      "if (laneIndex === 3) {",
      '  writeFileSync(pendingMarker, "started");',
      '  process.stdout.write(JSON.stringify({ laneIndex, outcome: "unexpected" }));',
      "} else if (laneIndex === 0) {",
      "  setTimeout(() => process.exit(17), 100);",
      "} else {",
      "  setInterval(() => {}, 1_000);",
      "}",
    ].join("\n");
    const failingSchedulerGate = {
      startedAt: performance.now(),
      stopped: false,
      lastChildExitAt: undefined,
    };
    await expectC09LightRejectionV1("bounded scheduler active failure", () =>
      runParallelC09WorkersV1(
        failingSchedulerGate,
        Array.from({ length: 4 }, (_, laneIndex) => ({
          label: `bounded scheduler failure lane ${laneIndex}`,
          command: process.execPath,
          args: [
            "-e",
            failingSchedulerSource,
            String(laneIndex),
            pendingWorkerMarker,
          ],
          cwd: lightRoot,
          env: { NODE_OPTIONS: C09_NODE_OPTIONS },
        })),
      ),
    );
    try {
      await readFile(pendingWorkerMarker);
      throw new Error("C09 bounded scheduler started a pending worker after failure");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }

    const temporaryReports = (await listFiles(lightRoot)).filter((path) =>
      path.endsWith(".tmp"),
    );
    if (temporaryReports.length !== 0) {
      throw new Error("C09 atomic report write left a temporary file");
    }
  } finally {
    await rm(lightRoot, { recursive: true, force: true });
  }
}

if (process.argv[2] === "--c09-dedicated-gate-light-regressions") {
  await runC09DedicatedGateLightRegressionsV1();
  process.stdout.write("C09 dedicated gate light regressions passed.\n");
} else if (
  process.argv[2] ===
  "--c09-browser-runtime-scanner-vite-regressions"
) {
  const scannerRegressionRoot = await mkdtemp(
    join(tmpdir(), "c09-browser-runtime-scanner-vite-"),
  );
  try {
    await runC09BrowserRuntimeScannerViteRegressionsV1(
      scannerRegressionRoot,
    );
  } finally {
    await rm(scannerRegressionRoot, { recursive: true, force: true });
  }
  process.stdout.write(
    "C09 browser runtime scanner Vite regressions passed.\n",
  );
} else if (
  process.argv[2] === "--c09-browser-zod-cold-regressions"
) {
  const coldRegressionRoot = await mkdtemp(
    join(tmpdir(), "c09-browser-zod-cold-"),
  );
  try {
    const evidence = await runC09BrowserZodColdPackRegressionsV1(
      coldRegressionRoot,
    );
    process.stdout.write(
      `C09 browser Zod cold-pack regressions passed in ${evidence.wallTimeMs.toFixed(1)} ms.\n`,
    );
  } finally {
    await rm(coldRegressionRoot, { recursive: true, force: true });
  }
} else {

const temporaryRoot = await mkdtemp(
  join(tmpdir(), "understand-code-provider-contracts-distribution-"),
);
let c09DedicatedGate;
let c09DedicatedGateEvidence;

try {
  await runC09ViteDependencyGuardRegression(temporaryRoot);
  await runC09BrowserRuntimeScannerViteRegressionsV1(temporaryRoot);
  const sourceSchemaRelativePaths = await listRelativeSchemaPaths(
    join(packageRoot, "schemas", "v1"),
  );
  if (sourceSchemaRelativePaths.length !== 275) {
    throw new Error(
      `Source provider contracts must contain exactly 275 JSON Schemas, found ${sourceSchemaRelativePaths.length}`,
    );
  }
  await assertExactProviderDirectory(
    join(packageRoot, "provider"),
    "source",
  );
  const inventoryRegressionRoot = join(
    temporaryRoot,
    "provider-inventory-regression",
  );
  await cp(
    join(packageRoot, "provider"),
    inventoryRegressionRoot,
    { recursive: true },
  );
  await writeFile(
    join(inventoryRegressionRoot, "alternate-bundle.json"),
    "{}",
    "utf8",
  );
  await expectAsyncRejection(
    () =>
      assertExactProviderDirectory(
        inventoryRegressionRoot,
        "extra-file regression",
      ),
    "extra provider file",
  );
  await rm(join(inventoryRegressionRoot, "alternate-bundle.json"));
  await rm(
    join(
      inventoryRegressionRoot,
      "bootstrap-trust-bundle-v1.json",
    ),
  );
  await symlink(
    "ed25519-strict-host-conformance-v1.json",
    join(
      inventoryRegressionRoot,
      "bootstrap-trust-bundle-v1.json",
    ),
  );
  await expectAsyncRejection(
    () =>
      assertExactProviderDirectory(
        inventoryRegressionRoot,
        "symlink regression",
      ),
    "provider symlink",
  );
  await rm(
    join(
      inventoryRegressionRoot,
      "bootstrap-trust-bundle-v1.json",
    ),
  );
  await cp(
    join(
      packageRoot,
      "provider",
      "bootstrap-trust-bundle-v1.json",
    ),
    join(
      inventoryRegressionRoot,
      "bootstrap-trust-bundle-v1.json",
    ),
  );
  const hardlinkWitnessPath = join(
    temporaryRoot,
    "provider-hardlink-witness.json",
  );
  await link(
    join(
      inventoryRegressionRoot,
      "bootstrap-trust-bundle-v1.json",
    ),
    hardlinkWitnessPath,
  );
  await expectAsyncRejection(
    () =>
      assertExactProviderDirectory(
        inventoryRegressionRoot,
        "hardlink regression",
      ),
    "provider hardlink",
  );
  await rm(hardlinkWitnessPath);

  const cleanPackageRoot = join(temporaryRoot, "package");
  const packRoot = join(temporaryRoot, "pack");
  const consumerRoot = join(temporaryRoot, "consumer");
  await mkdir(packRoot, { recursive: true });
  await mkdir(consumerRoot, { recursive: true });
  await cp(packageRoot, cleanPackageRoot, {
    recursive: true,
    filter(sourcePath) {
      const sourceRelativePath = relative(packageRoot, sourcePath);
      if (sourceRelativePath === "") return true;
      const topLevelSegment = sourceRelativePath.split(sep)[0];
      return topLevelSegment !== "dist" && topLevelSegment !== "node_modules";
    },
  });
  await symlink(
    join(packageRoot, "node_modules"),
    join(cleanPackageRoot, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assertExactProviderDirectory(
    join(cleanPackageRoot, "provider"),
    "clean pack source",
  );

  await run(
    npmCommand,
    [
      "pack",
      ".",
      "--ignore-scripts=false",
      "--pack-destination",
      packRoot,
      "--silent",
    ],
    {
      cwd: cleanPackageRoot,
      env: { NODE_OPTIONS: C09_PACK_NODE_OPTIONS },
      timeoutMs: PACK_COMMAND_TIMEOUT_MS,
    },
  );
  const tarballs = (await readdir(packRoot))
    .filter((name) => name.endsWith(".tgz"))
    .sort();
  if (tarballs.length !== 1) {
    throw new Error(`Expected one package tarball, found ${tarballs.join(", ")}`);
  }
  await assertExactProviderTarInventory(
    join(packRoot, tarballs[0]),
    "npm pack",
  );
  const duplicateTarRegressionPath = join(
    temporaryRoot,
    "duplicate-provider-member.tgz",
  );
  await writeFile(
    duplicateTarRegressionPath,
    gzipSync(
      duplicateTarMemberForRegression(
        await readGunzipBounded(join(packRoot, tarballs[0])),
        FIXED_PROVIDER_RESOURCES[0].archivePath,
      ),
    ),
  );
  await expectAsyncRejection(
    () =>
      assertExactProviderTarInventory(
        duplicateTarRegressionPath,
        "duplicate-member regression",
      ),
    "duplicate provider tar member",
  );
  const trailingTarRegressionPath = join(
    temporaryRoot,
    "trailing-provider-member.tgz",
  );
  await writeFile(
    trailingTarRegressionPath,
    gzipSync(
      appendTarMemberAfterEndForRegression(
        await readGunzipBounded(join(packRoot, tarballs[0])),
        FIXED_PROVIDER_RESOURCES[0].archivePath,
      ),
    ),
  );
  await expectAsyncRejection(
    () =>
      assertExactProviderTarInventory(
        trailingTarRegressionPath,
        "trailing-member regression",
      ),
    "provider tar member after terminal marker",
  );
  for (const [typeFlag, label] of [
    ["1", "hardlink"],
    ["2", "symlink"],
  ]) {
    const linkedTarRegressionPath = join(
      temporaryRoot,
      `${label}-provider-member.tgz`,
    );
    await writeFile(
      linkedTarRegressionPath,
      gzipSync(
        mutateTarMemberTypeForRegression(
          await readGunzipBounded(join(packRoot, tarballs[0])),
          FIXED_PROVIDER_RESOURCES[0].archivePath,
          typeFlag,
          FIXED_PROVIDER_RESOURCES[1].archivePath,
        ),
      ),
    );
    await expectAsyncRejection(
      () =>
        assertExactProviderTarInventory(
          linkedTarRegressionPath,
          `${label}-member regression`,
        ),
      `provider tar ${label}`,
    );
  }

  await run(
    npmCommand,
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      join(packRoot, tarballs[0]),
    ],
    {
      cwd: consumerRoot,
      env: { NODE_OPTIONS: C09_NODE_OPTIONS },
    },
  );

  const installedRoot = join(
    consumerRoot,
    "node_modules",
    "@understand-code",
    "durable-object-provider-contracts",
  );
  await assertExactProviderDirectory(
    join(installedRoot, "provider"),
    "installed package",
  );
  const installedRootRealPath =
    await loadColdInstalledCanonicalizerV1(installedRoot);
  const manifest = JSON.parse(
    await readFile(join(installedRoot, "package.json"), "utf8"),
  );
  await assertColdInstalledBrowserZodV1(
    installedRoot,
    installedRootRealPath,
    manifest,
  );
  const explicitSpecifiers = Object.keys(manifest.exports)
    .filter((key) => !key.includes("*"))
    .map(packageSpecifier);
  if (explicitSpecifiers.length !== 23) {
    throw new Error(
      `Packed provider contracts must expose exactly 23 public modules, found ${explicitSpecifiers.length}`,
    );
  }
  const installedStrictManifestPath = await realpath(
    join(
      installedRoot,
      "provider",
      "ed25519-strict-host-conformance-v1.json",
    ),
  );
  const installedBootstrapBundlePath = await realpath(
    join(
      installedRoot,
      "provider",
      "bootstrap-trust-bundle-v1.json",
    ),
  );
  const installedBootstrapGoldenPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "golden",
      "provider-bootstrap-structure-crypto-v1.json",
    ),
  );
  const installedBootstrapInvalidPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "invalid",
      "provider-bootstrap-structure-crypto-v1.json",
    ),
  );
  const installedRootHistoryGoldenPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "golden",
      "provider-registry-root-history-v1.json",
    ),
  );
  const installedRootHistoryInvalidPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "invalid",
      "provider-registry-root-history-v1.json",
    ),
  );
  const installedRegistryManifestGoldenPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "golden",
      "provider-registry-entry-manifest-history-v1.json",
    ),
  );
  const installedRegistryManifestInvalidPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "invalid",
      "provider-registry-entry-manifest-history-v1.json",
    ),
  );
  const installedRegistryManifestInvalidRecipePath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "invalid",
      "provider-registry-entry-manifest-history-v1.recipe-dialect.md",
    ),
  );
  const installedRealFilesystemSourceGoldenPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "golden",
      "provider-real-filesystem-source-v1.json",
    ),
  );
  const installedRealFilesystemSourceInvalidPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "invalid",
      "provider-real-filesystem-source-v1.json",
    ),
  );
  const installedTargetDiscoveryPointGoldenPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "golden",
      "provider-target-discovery-point-v1.json",
    ),
  );
  const installedTargetDiscoveryPointInvalidPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "invalid",
      "provider-target-discovery-point-v1.json",
    ),
  );
  const installedRealFilesystemConformanceResultGoldenPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "golden",
      "provider-real-filesystem-conformance-result-v1.json",
    ),
  );
  const installedRealFilesystemConformanceResultInvalidPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "invalid",
      "provider-real-filesystem-conformance-result-v1.json",
    ),
  );
  const installedProviderRuntimeAttestationPointGoldenPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "golden",
      "provider-runtime-attestation-point-v1.json",
    ),
  );
  const installedProviderRuntimeAttestationPointInvalidPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "invalid",
      "provider-runtime-attestation-point-v1.json",
    ),
  );
  const installedProviderFeasibilityEvidencePointGoldenPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "golden",
      "provider-feasibility-evidence-point-v1.json",
    ),
  );
  const installedProviderFeasibilityEvidencePointInvalidPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "invalid",
      "provider-feasibility-evidence-point-v1.json",
    ),
  );
  const installedProviderRegistryEvidenceBindingPointGoldenPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "golden",
      "provider-registry-evidence-binding-point-v1.json",
    ),
  );
  const installedProviderRegistryEvidenceBindingPointInvalidPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "invalid",
      "provider-registry-evidence-binding-point-v1.json",
    ),
  );
  const installedProviderRegistryEvidenceBindingTopologyProofPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "golden",
      "provider-registry-evidence-binding-topology-proof-v1.json",
    ),
  );
  const installedProviderReleaseTargetUniversePointGoldenPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "golden",
      "provider-release-target-universe-point-v1.json",
    ),
  );
  const installedProviderReleaseTargetUniversePointInvalidPath = await realpath(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "invalid",
      "provider-release-target-universe-point-v1.json",
    ),
  );

  c09DedicatedGate =
    await startC09DedicatedGateMonitorV1(temporaryRoot);
  beginC09DedicatedGateWindowV1(c09DedicatedGate);
  await runC09DedicatedCommandV1(
    c09DedicatedGate,
    process.execPath,
    [
      join(
        cleanPackageRoot,
        "scripts",
        "generate-provider-registry-evidence-binding-point.mjs",
      ),
      "--check",
    ],
    {
      cwd: cleanPackageRoot,
      env: { NODE_OPTIONS: C09_NODE_OPTIONS },
      timeoutMs: C09_RUNTIME_TIMEOUT_MS,
    },
  );
  await runC09DedicatedCommandV1(
    c09DedicatedGate,
    vitestCommand,
    [
      "run",
      `--maxWorkers=${C09_DEDICATED_MAX_LIVE_REPLAY_WORKERS}`,
      "test/provider-registry-evidence-binding-point-fixtures-replay-lane-0.test.ts",
      "test/provider-registry-evidence-binding-point-fixtures-replay-lane-1.test.ts",
      "test/provider-registry-evidence-binding-point-fixtures-replay-lane-2.test.ts",
      "test/provider-registry-evidence-binding-point-fixtures-replay-lane-3.test.ts",
    ],
    {
      cwd: cleanPackageRoot,
      env: { NODE_OPTIONS: C09_NODE_OPTIONS },
      timeoutMs: C09_RUNTIME_TIMEOUT_MS,
    },
  );
  const c09ExpectedInvalidManifest = JSON.parse(
    await readFile(
      installedProviderRegistryEvidenceBindingPointInvalidPath,
      "utf8",
    ),
  );
  if (
    c09ExpectedInvalidManifest.caseCount !== 354 ||
    c09ExpectedInvalidManifest.shardSize !== 32 ||
    c09ExpectedInvalidManifest.maxWorkers !== 4 ||
    !Array.isArray(c09ExpectedInvalidManifest.shards) ||
    c09ExpectedInvalidManifest.shards.length !== 12
  ) {
    throw new Error("Cold-installed C09 replay manifest topology drifted");
  }
  const c09ReplayCorePath = join(
    consumerRoot,
    "provider-registry-evidence-binding-distribution-replay-core.mjs",
  );
  const c09NodeWorkerPath = join(
    consumerRoot,
    "provider-registry-evidence-binding-distribution-node-worker.mjs",
  );
  await Promise.all([
    cp(
      join(
        packageRoot,
        "scripts",
        "lib",
        "provider-registry-evidence-binding-distribution-replay-core.mjs",
      ),
      c09ReplayCorePath,
    ),
    cp(
      join(
        packageRoot,
        "scripts",
        "lib",
        "provider-registry-evidence-binding-distribution-node-worker.mjs",
      ),
      c09NodeWorkerPath,
    ),
  ]);
  const c09NodeReplayReports = await runParallelC09WorkersV1(
    c09DedicatedGate,
    C09_DISTRIBUTION_REPLAY_LANES_V1.map((_, laneIndex) => ({
      label: `packed Node replay lane ${laneIndex}`,
      command: process.execPath,
      args: [
        c09NodeWorkerPath,
        c09DedicatedGate.nonce,
        String(laneIndex),
        installedRootRealPath,
        installedProviderRegistryEvidenceBindingPointGoldenPath,
        installedProviderRegistryEvidenceBindingPointInvalidPath,
        installedStrictManifestPath,
      ],
      cwd: consumerRoot,
      env: { NODE_OPTIONS: C09_NODE_OPTIONS },
    })),
  );
  const c09NodeReplaySummary = validateC09ReplayReportsV1(
    c09NodeReplayReports,
    "node",
    c09DedicatedGate.nonce,
    c09ExpectedInvalidManifest,
  );
  runC09ReplayAggregatorRegressionsV1(
    c09NodeReplayReports,
    "node",
    c09DedicatedGate.nonce,
    c09ExpectedInvalidManifest,
  );

  const runtimeProbe = join(consumerRoot, "runtime-probe.mjs");
  await writeFile(
    runtimeProbe,
    [
      'import { readFile, realpath } from "node:fs/promises";',
      'import { createHash, createHmac, createPrivateKey, createPublicKey, sign } from "node:crypto";',
      'import { fileURLToPath } from "node:url";',
      ...explicitSpecifiers.map(
        (specifier, index) =>
          `import * as providerContractModule${index} from ${JSON.stringify(specifier)};`,
      ),
      `const modules = [${explicitSpecifiers.map((_, index) => `providerContractModule${index}`).join(", ")}];`,
      'if (modules.some((module) => Object.keys(module).length === 0)) throw new Error("empty public export");',
      'const root = await import("@understand-code/durable-object-provider-contracts");',
      'if (root.DurableObjectIdentityProviderIdV1Schema.parse("durable-object-provider:native-fs") !== "durable-object-provider:native-fs") throw new Error("reader ID schema failed");',
      'const providerError = await import("@understand-code/durable-object-provider-contracts/provider-error");',
      'const providerRegistry = await import("@understand-code/durable-object-provider-contracts/provider-registry");',
      'const realFilesystemSource = await import("@understand-code/durable-object-provider-contracts/provider-real-filesystem-source");',
      'const targetDiscoveryPoint = await import("@understand-code/durable-object-provider-contracts/provider-target-discovery-point");',
      'const targetDiscoveryPointFixtures = await import("@understand-code/durable-object-provider-contracts/provider-target-discovery-point-fixtures");',
      'const realFilesystemConformanceResult = await import("@understand-code/durable-object-provider-contracts/provider-real-filesystem-conformance-result");',
      'const realFilesystemConformanceResultFixtures = await import("@understand-code/durable-object-provider-contracts/provider-real-filesystem-conformance-result-fixtures");',
      'const providerRuntimeAttestationPoint = await import("@understand-code/durable-object-provider-contracts/provider-runtime-attestation-point");',
      'const providerRuntimeAttestationPointFixtures = await import("@understand-code/durable-object-provider-contracts/provider-runtime-attestation-point-fixtures");',
      'const providerFeasibilityEvidencePoint = await import("@understand-code/durable-object-provider-contracts/provider-feasibility-evidence-point");',
      'const providerFeasibilityEvidencePointFixtures = await import("@understand-code/durable-object-provider-contracts/provider-feasibility-evidence-point-fixtures");',
      'const providerRegistryEvidenceBindingPoint = await import("@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point");',
      'const providerRegistryEvidenceBindingPointFixtures = await import("@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point-fixtures");',
      'const providerReleaseTargetUniversePoint = await import("@understand-code/durable-object-provider-contracts/provider-release-target-universe-point");',
      'const providerReleaseTargetUniversePointFixtures = await import("@understand-code/durable-object-provider-contracts/provider-release-target-universe-point-fixtures");',
      'const unavailable = providerError.createProviderUnavailableToolErrorV1("unavailable");',
      'if (providerError.ProviderUnavailableToolErrorV1Schema.parse(unavailable).details.reason !== "unavailable") throw new Error("provider error export failed");',
      'const schemaUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/schemas/v1/canonical-byte-string.schema.json"));',
      'const providerErrorSchemaUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/schemas/v1/provider-unavailable-tool-error.schema.json"));',
      'const goldenUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/golden/manifest.json"));',
      'const providerErrorFixtureUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/reference/provider-unavailable-tool-errors.json"));',
      'const publicKeyDigestGoldenUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/golden/ed25519-public-key-digest-v1.json"));',
      'const strictEd25519ManifestUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/provider/ed25519-strict-host-conformance-v1.json"));',
      'const bootstrapTrustBundleUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/provider/bootstrap-trust-bundle-v1.json"));',
      'const bootstrapTrustGoldenUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/golden/provider-bootstrap-structure-crypto-v1.json"));',
      'const bootstrapTrustInvalidUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/invalid/provider-bootstrap-structure-crypto-v1.json"));',
      'const rootHistoryGoldenUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/golden/provider-registry-root-history-v1.json"));',
      'const rootHistoryInvalidUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/invalid/provider-registry-root-history-v1.json"));',
      'const registryManifestGoldenUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/golden/provider-registry-entry-manifest-history-v1.json"));',
      'const registryManifestInvalidUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/invalid/provider-registry-entry-manifest-history-v1.json"));',
      'const registryManifestInvalidRecipeUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/invalid/provider-registry-entry-manifest-history-v1.recipe-dialect.md"));',
      'const realFilesystemSourceGoldenUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/golden/provider-real-filesystem-source-v1.json"));',
      'const realFilesystemSourceInvalidUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/invalid/provider-real-filesystem-source-v1.json"));',
      'const targetDiscoveryPointGoldenUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/golden/provider-target-discovery-point-v1.json"));',
      'const targetDiscoveryPointInvalidUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/invalid/provider-target-discovery-point-v1.json"));',
      'const realFilesystemConformanceResultGoldenUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/golden/provider-real-filesystem-conformance-result-v1.json"));',
      'const realFilesystemConformanceResultInvalidUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/invalid/provider-real-filesystem-conformance-result-v1.json"));',
      'const providerRuntimeAttestationPointGoldenUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/golden/provider-runtime-attestation-point-v1.json"));',
      'const providerRuntimeAttestationPointInvalidUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/invalid/provider-runtime-attestation-point-v1.json"));',
      'const providerFeasibilityEvidencePointGoldenUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/golden/provider-feasibility-evidence-point-v1.json"));',
      'const providerFeasibilityEvidencePointInvalidUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/invalid/provider-feasibility-evidence-point-v1.json"));',
      'const providerRegistryEvidenceBindingPointGoldenUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/golden/provider-registry-evidence-binding-point-v1.json"));',
      'const providerRegistryEvidenceBindingPointInvalidUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/invalid/provider-registry-evidence-binding-point-v1.json"));',
      'const providerRegistryEvidenceBindingTopologyProofUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/golden/provider-registry-evidence-binding-topology-proof-v1.json"));',
      'const providerReleaseTargetUniversePointGoldenUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/golden/provider-release-target-universe-point-v1.json"));',
      'const providerReleaseTargetUniversePointInvalidUrl = new URL(import.meta.resolve("@understand-code/durable-object-provider-contracts/fixtures/v1/invalid/provider-release-target-universe-point-v1.json"));',
      `if (await realpath(fileURLToPath(strictEd25519ManifestUrl)) !== ${JSON.stringify(installedStrictManifestPath)}) throw new Error("strict manifest resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(bootstrapTrustBundleUrl)) !== ${JSON.stringify(installedBootstrapBundlePath)}) throw new Error("bootstrap Bundle resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(bootstrapTrustGoldenUrl)) !== ${JSON.stringify(installedBootstrapGoldenPath)}) throw new Error("bootstrap golden resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(bootstrapTrustInvalidUrl)) !== ${JSON.stringify(installedBootstrapInvalidPath)}) throw new Error("bootstrap invalid manifest resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(rootHistoryGoldenUrl)) !== ${JSON.stringify(installedRootHistoryGoldenPath)}) throw new Error("root history golden resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(rootHistoryInvalidUrl)) !== ${JSON.stringify(installedRootHistoryInvalidPath)}) throw new Error("root history invalid manifest resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(registryManifestGoldenUrl)) !== ${JSON.stringify(installedRegistryManifestGoldenPath)}) throw new Error("Registry Manifest golden resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(registryManifestInvalidUrl)) !== ${JSON.stringify(installedRegistryManifestInvalidPath)}) throw new Error("Registry Manifest invalid corpus resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(registryManifestInvalidRecipeUrl)) !== ${JSON.stringify(installedRegistryManifestInvalidRecipePath)}) throw new Error("Registry Manifest invalid recipe resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(realFilesystemSourceGoldenUrl)) !== ${JSON.stringify(installedRealFilesystemSourceGoldenPath)}) throw new Error("real filesystem source golden resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(realFilesystemSourceInvalidUrl)) !== ${JSON.stringify(installedRealFilesystemSourceInvalidPath)}) throw new Error("real filesystem source invalid corpus resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(targetDiscoveryPointGoldenUrl)) !== ${JSON.stringify(installedTargetDiscoveryPointGoldenPath)}) throw new Error("target discovery point golden resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(targetDiscoveryPointInvalidUrl)) !== ${JSON.stringify(installedTargetDiscoveryPointInvalidPath)}) throw new Error("target discovery point invalid corpus resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(realFilesystemConformanceResultGoldenUrl)) !== ${JSON.stringify(installedRealFilesystemConformanceResultGoldenPath)}) throw new Error("real filesystem conformance result golden resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(realFilesystemConformanceResultInvalidUrl)) !== ${JSON.stringify(installedRealFilesystemConformanceResultInvalidPath)}) throw new Error("real filesystem conformance result invalid corpus resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(providerRuntimeAttestationPointGoldenUrl)) !== ${JSON.stringify(installedProviderRuntimeAttestationPointGoldenPath)}) throw new Error("provider runtime attestation point golden resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(providerRuntimeAttestationPointInvalidUrl)) !== ${JSON.stringify(installedProviderRuntimeAttestationPointInvalidPath)}) throw new Error("provider runtime attestation point invalid corpus resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(providerFeasibilityEvidencePointGoldenUrl)) !== ${JSON.stringify(installedProviderFeasibilityEvidencePointGoldenPath)}) throw new Error("provider feasibility evidence point golden resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(providerFeasibilityEvidencePointInvalidUrl)) !== ${JSON.stringify(installedProviderFeasibilityEvidencePointInvalidPath)}) throw new Error("provider feasibility evidence point invalid corpus resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(providerRegistryEvidenceBindingPointGoldenUrl)) !== ${JSON.stringify(installedProviderRegistryEvidenceBindingPointGoldenPath)}) throw new Error("provider Registry/Evidence binding golden resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(providerRegistryEvidenceBindingPointInvalidUrl)) !== ${JSON.stringify(installedProviderRegistryEvidenceBindingPointInvalidPath)}) throw new Error("provider Registry/Evidence binding invalid corpus resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(providerRegistryEvidenceBindingTopologyProofUrl)) !== ${JSON.stringify(installedProviderRegistryEvidenceBindingTopologyProofPath)}) throw new Error("provider Registry/Evidence topology proof resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(providerReleaseTargetUniversePointGoldenUrl)) !== ${JSON.stringify(installedProviderReleaseTargetUniversePointGoldenPath)}) throw new Error("provider release target Universe point golden resolved outside the exact installed path");`,
      `if (await realpath(fileURLToPath(providerReleaseTargetUniversePointInvalidUrl)) !== ${JSON.stringify(installedProviderReleaseTargetUniversePointInvalidPath)}) throw new Error("provider release target Universe point invalid corpus resolved outside the exact installed path");`,
      'const schema = JSON.parse(await readFile(schemaUrl, "utf8"));',
      'const providerErrorSchema = JSON.parse(await readFile(providerErrorSchemaUrl, "utf8"));',
      'const golden = JSON.parse(await readFile(goldenUrl, "utf8"));',
      'const providerErrorFixture = JSON.parse(await readFile(providerErrorFixtureUrl, "utf8"));',
      'const publicKeyDigestGolden = JSON.parse(await readFile(publicKeyDigestGoldenUrl, "utf8"));',
      'const strictEd25519ManifestBytes = new Uint8Array(await readFile(strictEd25519ManifestUrl));',
      'const bootstrapTrustBundleBytes = new Uint8Array(await readFile(bootstrapTrustBundleUrl));',
      'const bootstrapTrustGoldenBytes = new Uint8Array(await readFile(bootstrapTrustGoldenUrl));',
      'const bootstrapTrustInvalidBytes = new Uint8Array(await readFile(bootstrapTrustInvalidUrl));',
      'const rootHistoryGoldenBytes = new Uint8Array(await readFile(rootHistoryGoldenUrl));',
      'const rootHistoryInvalidBytes = new Uint8Array(await readFile(rootHistoryInvalidUrl));',
      'const registryManifestGoldenBytes = new Uint8Array(await readFile(registryManifestGoldenUrl));',
      'const registryManifestInvalidBytes = new Uint8Array(await readFile(registryManifestInvalidUrl));',
      'const registryManifestInvalidRecipe = await readFile(registryManifestInvalidRecipeUrl, "utf8");',
      'const realFilesystemSourceGoldenBytes = new Uint8Array(await readFile(realFilesystemSourceGoldenUrl));',
      'const realFilesystemSourceInvalidBytes = new Uint8Array(await readFile(realFilesystemSourceInvalidUrl));',
      'const targetDiscoveryPointGoldenBytes = new Uint8Array(await readFile(targetDiscoveryPointGoldenUrl));',
      'const targetDiscoveryPointInvalidBytes = new Uint8Array(await readFile(targetDiscoveryPointInvalidUrl));',
      'const realFilesystemConformanceResultGoldenBytes = new Uint8Array(await readFile(realFilesystemConformanceResultGoldenUrl));',
      'const realFilesystemConformanceResultInvalidBytes = new Uint8Array(await readFile(realFilesystemConformanceResultInvalidUrl));',
      'const providerRuntimeAttestationPointGoldenBytes = new Uint8Array(await readFile(providerRuntimeAttestationPointGoldenUrl));',
      'const providerRuntimeAttestationPointInvalidBytes = new Uint8Array(await readFile(providerRuntimeAttestationPointInvalidUrl));',
      'const providerFeasibilityEvidencePointGoldenBytes = new Uint8Array(await readFile(providerFeasibilityEvidencePointGoldenUrl));',
      'const providerFeasibilityEvidencePointInvalidBytes = new Uint8Array(await readFile(providerFeasibilityEvidencePointInvalidUrl));',
      'const providerRegistryEvidenceBindingPointGoldenBytes = new Uint8Array(await readFile(providerRegistryEvidenceBindingPointGoldenUrl));',
      'const providerRegistryEvidenceBindingPointInvalidFileBytes = await readFile(providerRegistryEvidenceBindingPointInvalidUrl);',
      'const providerRegistryEvidenceBindingPointInvalidBytes = new Uint8Array(providerRegistryEvidenceBindingPointInvalidFileBytes.buffer, providerRegistryEvidenceBindingPointInvalidFileBytes.byteOffset, providerRegistryEvidenceBindingPointInvalidFileBytes.byteLength);',
      'if (providerRegistryEvidenceBindingPointInvalidBytes.buffer !== providerRegistryEvidenceBindingPointInvalidFileBytes.buffer || providerRegistryEvidenceBindingPointInvalidBytes.byteOffset !== providerRegistryEvidenceBindingPointInvalidFileBytes.byteOffset || providerRegistryEvidenceBindingPointInvalidBytes.byteLength !== providerRegistryEvidenceBindingPointInvalidFileBytes.byteLength) throw new Error("packed Registry/Evidence binding invalid bytes were copied instead of viewed");',
      'const providerRegistryEvidenceBindingTopologyProofBytes = new Uint8Array(await readFile(providerRegistryEvidenceBindingTopologyProofUrl));',
      'const providerReleaseTargetUniversePointGoldenBytes = new Uint8Array(await readFile(providerReleaseTargetUniversePointGoldenUrl));',
      'const providerReleaseTargetUniversePointInvalidBytes = new Uint8Array(await readFile(providerReleaseTargetUniversePointInvalidUrl));',
      'const strictEd25519Manifest = JSON.parse(new TextDecoder().decode(strictEd25519ManifestBytes));',
      'if (schema.$id !== "urn:understand-code:provider-contract:schema:v1:canonical-byte-string") throw new Error("packed schema missing");',
      'if (providerErrorSchema.$id !== "urn:understand-code:provider-contract:schema:v1:provider-unavailable-tool-error") throw new Error("packed provider error schema missing");',
      'if (golden.profile !== "rfc8785-jcs-safe-integer-v1") throw new Error("packed golden manifest missing");',
      'if (providerErrorFixture.cases.length !== 6) throw new Error("packed provider error fixture missing");',
      'const cryptoHost = { sha256(message) { return new Uint8Array(createHash("sha256").update(message).digest()); }, hmacSha256(key, message) { return new Uint8Array(createHmac("sha256", key).update(message).digest()); } };',
      'await root.verifyProviderEd25519PublicKeyDigestGoldenManifestV1(publicKeyDigestGolden, cryptoHost);',
      'if (strictEd25519Manifest.payload.cases.length !== 28) throw new Error("packed strict Ed25519 manifest missing");',
      'const strictEd25519 = await import("@understand-code/durable-object-provider-contracts/strict-ed25519");',
      'const strictConformance = await import("@understand-code/durable-object-provider-contracts/strict-ed25519-conformance");',
      'let pointCalls = 0;',
      'let verifyCalls = 0;',
      'let nextSignatureMutation;',
      'const strictHost = { verificationProfile: strictEd25519.STRICT_ED25519_VERIFICATION_PROFILE_V1, validatePrimeSubgroupPoint(point) { pointCalls += 1; return strictEd25519.validatePrimeSubgroupPoint(point); }, verifyRawEd25519(publicKey, message, signature) { verifyCalls += 1; const mutation = nextSignatureMutation; nextSignatureMutation = undefined; mutation?.(); return strictEd25519.verifyRawEd25519(publicKey, message, signature); } };',
      'const universeExecutionCounter = Object.freeze({ pointAdmissionCount() { return pointCalls; }, signatureVerificationCount() { return verifyCalls; }, mutateDuringNextSignature(mutation) { if (nextSignatureMutation !== undefined) throw new Error("a packed Universe signature-time mutation is already registered"); nextSignatureMutation = mutation; } });',
      'const resourceHost = { readFixedSignedPackageResource(path, maxBytes) { if (path !== strictConformance.PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 || strictEd25519ManifestBytes.byteLength > maxBytes) throw new Error("invalid resource request"); return strictEd25519ManifestBytes; } };',
      'const strictCapability = await strictConformance.attestProviderStrictEd25519CryptoHostV1({ host: strictHost, resourceHost });',
      'if (strictConformance.getProviderStrictEd25519CryptoCapabilityBytesV1(strictCapability).byteLength === 0) throw new Error("packed strict Ed25519 attestation failed");',
      '{ // packed bootstrap phase',
      'const bootstrapTrustGoldenValidation = await root.verifyProviderBootstrapTrustGoldenManifestResourceV1(bootstrapTrustGoldenBytes, strictCapability);',
      'if (bootstrapTrustGoldenValidation.authority !== "none_structure_only" || bootstrapTrustGoldenValidation.manifest.vectors.recoveryKeyIds.length !== 3) throw new Error("packed bootstrap trust golden failed");',
      'const bootstrapTrustInvalidValidation = root.verifyProviderBootstrapTrustInvalidManifestResourceV1(bootstrapTrustInvalidBytes);',
      'if (bootstrapTrustInvalidValidation.authority !== "none_rejection_only" || bootstrapTrustInvalidValidation.manifest.cases.length !== 51) throw new Error("packed bootstrap trust invalid manifest failed");',
      'if (bootstrapTrustInvalidValidation.manifest.cases[0].witnesses[0].recipe.dialect !== "provider_bootstrap_invalid_recipe_v1" || bootstrapTrustInvalidValidation.manifest.cases[50].witnesses[0].recipe.deterministicSeed.seedHex !== "4444444444444444444444444444444444444444444444444444444444444444") throw new Error("packed bootstrap trust invalid recipes failed");',
      'if (bootstrapTrustInvalidValidation.manifest.cases[41].witnesses[5].recipe.operands[1] !== "alternate_root_key_id=661166fa4208cb1d325f30") throw new Error("packed prefix-mismatch recipe is not self-contained");',
      'const deterministicVector = bootstrapTrustGoldenValidation.manifest.vectors.deterministicRootSelfSignatureSigning;',
      'const deterministicPrivateKey = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(deterministicVector.rfc8032TestSeedHex, "hex")]), format: "der", type: "pkcs8" });',
      'const deterministicSpki = createPublicKey(deterministicPrivateKey).export({ format: "der", type: "spki" });',
      'if (deterministicSpki.subarray(-32).toString("hex") !== deterministicVector.expected.rawPublicKeyHex || sign(null, Buffer.from(deterministicVector.expected.canonicalMessageUtf8Hex, "hex"), deterministicPrivateKey).toString("hex") !== deterministicVector.expected.rawSignatureHex) throw new Error("packed deterministic signing golden failed");',
      'const bootstrapValidation = await root.validateProviderBootstrapTrustBundleStructureV1({ bundleEnvelopeBytes: bootstrapTrustBundleBytes, strictManifestEnvelopeBytes: strictEd25519ManifestBytes, strictCryptoCapability: strictCapability });',
      'if (bootstrapValidation.authority !== "none_structure_only" || bootstrapValidation.bundleEnvelope.contentDigest !== root.PROVIDER_BOOTSTRAP_TRUST_BUNDLE_CONTENT_DIGEST_V1) throw new Error("packed bootstrap trust validation failed");',
      'if (pointCalls !== 62 || verifyCalls !== 31) throw new Error(`packed bootstrap crypto calls: ${pointCalls}/${verifyCalls}`);',
      '}',
      '{ // packed root-history phase',
      'const rootHistoryGolden = providerRegistry.verifyProviderRegistryRootHistoryGoldenManifestResourceV1(rootHistoryGoldenBytes);',
      'const rootHistoryInvalid = providerRegistry.verifyProviderRegistryRootHistoryInvalidManifestResourceV1(rootHistoryInvalidBytes);',
      'if (rootHistoryGolden.fixtureAuthority !== "none_structure_and_history_only" || rootHistoryGolden.rootMetadataHistory.length !== 3) throw new Error("packed root history golden failed");',
      'if (rootHistoryInvalid.fixtureAuthority !== "none_rejection_only" || rootHistoryInvalid.cases.length !== 31) throw new Error("packed root history invalid manifest failed");',
      'pointCalls = 0;',
      'verifyCalls = 0;',
      'const rootHistoryValidation = await providerRegistry.validateProviderRegistryRootMetadataHistoryV1({ bootstrapTrustBundle: rootHistoryGolden.bootstrapTrustBundle, rootMetadataHistory: rootHistoryGolden.rootMetadataHistory, strictCryptoCapability: strictCapability });',
      'if (rootHistoryValidation.authority !== "none_structure_and_history_only" || rootHistoryValidation.retainedRootMetadataGenerationCount !== 3 || rootHistoryValidation.currentRootMetadata.rootGeneration !== 3) throw new Error("packed root history validation failed");',
      'if (pointCalls !== 11 || verifyCalls !== 9) throw new Error(`packed root history crypto calls: ${pointCalls}/${verifyCalls}`);',
      'const latestRootEnvelope = rootHistoryGolden.rootMetadataHistory[2];',
      'const latestRootLocator = providerRegistry.buildProviderRegistryRootMetadataRelativePathV1({ locatorProfile: providerRegistry.PROVIDER_REGISTRY_ROOT_METADATA_LOCATOR_PROFILE_V1, rootGeneration: latestRootEnvelope.rootGeneration, rootKeyId: latestRootEnvelope.rootKeyId });',
      'if (latestRootLocator !== rootHistoryGolden.expected.vectors[2].locator) throw new Error("packed root history locator failed");',
      '}',
      '{ // packed registry-history phase',
      'if (root.validateProviderRegistryManifestHistoryV1 !== providerRegistry.validateProviderRegistryManifestHistoryV1 || root.verifyProviderRegistryManifestHistoryGoldenResourceV1 !== providerRegistry.verifyProviderRegistryManifestHistoryGoldenResourceV1 || root.verifyProviderRegistryManifestHistoryInvalidResourceV1 !== providerRegistry.verifyProviderRegistryManifestHistoryInvalidResourceV1) throw new Error("root/provider-registry Registry exports diverged");',
      'if (registryManifestGoldenBytes.byteLength !== providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1 || createHash("sha256").update(registryManifestGoldenBytes).digest("hex") !== providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1) throw new Error("packed Registry golden raw anchor failed");',
      'const registryGolden = providerRegistry.verifyProviderRegistryManifestHistoryGoldenResourceV1(registryManifestGoldenBytes);',
      'const registrySemanticDigest = `sha256:${createHash("sha256").update(root.canonicalizeJcsSafeIntegerUtf8V1([providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_DOMAIN_V1, registryGolden])).digest("hex")}`;',
      'if (registrySemanticDigest !== providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1 || registryGolden.fixtureAuthority !== "none_registry_structure_and_history_only" || registryGolden.registryManifestHistory.length !== 7) throw new Error("packed Registry golden semantic anchor failed");',
      'if (registryManifestInvalidBytes.byteLength !== providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_BYTE_LENGTH_V1 || createHash("sha256").update(registryManifestInvalidBytes).digest("hex") !== providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_SHA256_HEX_V1) throw new Error("packed Registry invalid raw anchor failed");',
      'const registryInvalid = providerRegistry.verifyProviderRegistryManifestHistoryInvalidResourceV1(registryManifestInvalidBytes);',
      'const registryInvalidSemanticDigest = `sha256:${createHash("sha256").update(root.canonicalizeJcsSafeIntegerUtf8V1([providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_DOMAIN_V1, registryInvalid])).digest("hex")}`;',
      'if (registryInvalidSemanticDigest !== providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_CONTENT_DIGEST_V1 || registryInvalid.fixtureAuthority !== "none_rejection_only" || registryInvalid.caseCount !== 89 || registryInvalid.cases.length !== 89 || registryInvalid.caseIds.length !== 89 || new Set(registryInvalid.caseIds).size !== 89 || JSON.stringify(registryInvalid.caseIds) !== JSON.stringify(providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_CASE_IDS_V1)) throw new Error("packed Registry invalid semantic or case closure failed");',
      'const registryInvalidMaterializedRequestDigests = registryInvalid.cases.map((invalidCase, index) => { if (invalidCase.caseId !== registryInvalid.caseIds[index]) throw new Error("packed Registry materialized request case alignment failed"); return invalidCase.expected.materializedRequestSemanticDigest; });',
      'if (root.PROVIDER_REGISTRY_MANIFEST_INVALID_MATERIALIZED_REQUEST_SEMANTIC_DOMAIN_V1 !== providerRegistry.PROVIDER_REGISTRY_MANIFEST_INVALID_MATERIALIZED_REQUEST_SEMANTIC_DOMAIN_V1 || registryInvalid.materializedRequestSemanticDomain !== providerRegistry.PROVIDER_REGISTRY_MANIFEST_INVALID_MATERIALIZED_REQUEST_SEMANTIC_DOMAIN_V1 || registryInvalidMaterializedRequestDigests.length !== 89 || new Set(registryInvalidMaterializedRequestDigests).size !== 89 || registryInvalidMaterializedRequestDigests.some((digest) => !/^sha256:[0-9a-f]{64}$/u.test(digest))) throw new Error("packed Registry materialized request semantic digest closure failed");',
      'if (registryInvalid.goldenDependency.resourcePath !== providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1 || registryInvalid.goldenDependency.resourceByteLength !== providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1 || registryInvalid.goldenDependency.resourceSha256Hex !== providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1 || registryInvalid.goldenDependency.semanticContentDigest !== providerRegistry.PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1) throw new Error("packed Registry invalid golden dependency drifted");',
      'const packedRegistryNegativeCaseIds = ["envelope-extra-field", "manifest-signature-bitflip", "runtime-signature-bitflip"];',
      'if (!packedRegistryNegativeCaseIds.every((caseId) => registryInvalid.caseIds.includes(caseId)) || !registryManifestInvalidRecipe.includes(registryInvalid.mutationRecipeDialect) || !registryManifestInvalidRecipe.includes(registryInvalid.goldenDependency.resourcePath) || !registryManifestInvalidRecipe.includes("ProviderRegistryManifestHistoryValidationError")) throw new Error("packed Registry invalid recipe contract failed");',
      'pointCalls = 0;',
      'verifyCalls = 0;',
      'const registryValidation = await providerRegistry.validateProviderRegistryManifestHistoryV1({ installationIdentityGenerationId: registryGolden.installationIdentityGenerationId, bootstrapTrustBundle: registryGolden.bootstrapTrustBundle, rootMetadataHistory: registryGolden.rootMetadataHistory, registryManifestHistory: registryGolden.registryManifestHistory, strictCryptoCapability: strictCapability });',
      'if (registryValidation.authority !== "none_registry_structure_and_history_only" || registryValidation.retainedRegistryManifestGenerationCount !== 7 || registryValidation.currentRegistryManifest.contentDigest !== registryGolden.expected.currentRegistryManifest.contentDigest) throw new Error("packed Registry history validation failed");',
      'if (pointCalls !== 24 || verifyCalls !== 38) throw new Error(`packed Registry history crypto calls: ${pointCalls}/${verifyCalls}`);',
      'async function expectPackedRegistryRejection(registryManifestHistory, label) { try { await providerRegistry.validateProviderRegistryManifestHistoryV1({ installationIdentityGenerationId: registryGolden.installationIdentityGenerationId, bootstrapTrustBundle: registryGolden.bootstrapTrustBundle, rootMetadataHistory: registryGolden.rootMetadataHistory, registryManifestHistory, strictCryptoCapability: strictCapability }); } catch (error) { if (!(error instanceof providerRegistry.ProviderRegistryManifestHistoryValidationError) || error.name !== "ProviderRegistryManifestHistoryValidationError" || error.code !== "provider_unavailable" || error.reason !== "attestation_invalid" || error.message !== "Provider registry manifest history validation failed") throw new Error(`packed Registry negative escaped opaque boundary: ${label}`, { cause: error }); return; } throw new Error(`packed Registry negative accepted: ${label}`); }',
      'const packedSchemaExtraField = structuredClone(registryGolden.registryManifestHistory);',
      'packedSchemaExtraField[6].unexpectedField = true;',
      'await expectPackedRegistryRejection(packedSchemaExtraField, "envelope-extra-field");',
      'const packedManifestSignatureBitflip = structuredClone(registryGolden.registryManifestHistory);',
      'const packedManifestSignature = packedManifestSignatureBitflip[6].payload.manifestSignature;',
      'packedManifestSignatureBitflip[6].payload.manifestSignature = `${packedManifestSignature.slice(0, -1)}${packedManifestSignature.endsWith("0") ? "1" : "0"}`;',
      'await expectPackedRegistryRejection(packedManifestSignatureBitflip, "manifest-signature-bitflip");',
      'const packedRuntimeSignatureBitflip = structuredClone(registryGolden.registryManifestHistory);',
      'const packedRuntimeSignature = packedRuntimeSignatureBitflip[0].payload.members[0].registryEntry.runtimeAttestation.payload.registrySignature;',
      'packedRuntimeSignatureBitflip[0].payload.members[0].registryEntry.runtimeAttestation.payload.registrySignature = `${packedRuntimeSignature.slice(0, -1)}${packedRuntimeSignature.endsWith("0") ? "1" : "0"}`;',
      'await expectPackedRegistryRejection(packedRuntimeSignatureBitflip, "runtime-signature-bitflip");',
      '}',
      '{ // packed real-filesystem-source phase',
      'if (root.validateProviderRealFilesystemSourceClosureV1 !== realFilesystemSource.validateProviderRealFilesystemSourceClosureV1 || root.buildProviderRealFilesystemFixtureCorpusManifestRelativePathV1 === undefined || root.buildProviderRealFilesystemSuiteManifestRelativePathV1 === undefined) throw new Error("root/real-filesystem-source exports diverged");',
      'const realFilesystemGoldenValidation = await root.verifyProviderRealFilesystemSourceGoldenResourceV1(realFilesystemSourceGoldenBytes, strictCapability);',
      'if (realFilesystemGoldenValidation.authority !== "none_real_fs_source_structure_only" || realFilesystemGoldenValidation.sourceClosure.recordCount !== 12 || realFilesystemGoldenValidation.sourceClosure.caseCount !== 4 || realFilesystemGoldenValidation.sourceClosure.requiredCaseCutCount !== 8) throw new Error("packed real filesystem source golden failed");',
      'if (root.buildProviderRealFilesystemFixtureCorpusManifestRelativePathV1(realFilesystemGoldenValidation.manifest.fixtureCorpusManifest) !== realFilesystemGoldenValidation.sourceClosure.fixtureCorpusManifestRelativePath || root.buildProviderRealFilesystemSuiteManifestRelativePathV1(realFilesystemGoldenValidation.manifest.suiteManifest) !== realFilesystemGoldenValidation.sourceClosure.suiteManifestRelativePath) throw new Error("packed real filesystem Envelope locator failed");',
      'const packedSuiteSemanticDigestSubstitution = structuredClone(realFilesystemGoldenValidation.manifest.suiteManifest);',
      'packedSuiteSemanticDigestSubstitution.contentDigest = packedSuiteSemanticDigestSubstitution.payload.suiteDigest;',
      'try { root.buildProviderRealFilesystemSuiteManifestRelativePathV1(packedSuiteSemanticDigestSubstitution); throw new Error("packed real filesystem semantic locator substitution accepted"); } catch (error) { if (error?.message === "packed real filesystem semantic locator substitution accepted") throw error; }',
      'const realFilesystemInvalid = root.verifyProviderRealFilesystemSourceInvalidResourceV1(realFilesystemSourceInvalidBytes);',
      'if (realFilesystemInvalid.fixtureAuthority !== "none_rejection_only" || realFilesystemInvalid.caseCount !== 43 || realFilesystemInvalid.cases.length !== 43 || JSON.stringify(realFilesystemInvalid.caseIds) !== JSON.stringify(root.PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_CASE_IDS_V1)) throw new Error("packed real filesystem source invalid corpus failed");',
      '}',
      '{ // packed target-discovery phase',
      'if (root.validateProviderTargetDiscoveryPointClosureV1 !== targetDiscoveryPoint.validateProviderTargetDiscoveryPointClosureV1 || root.verifyProviderTargetDiscoveryPointGoldenResourceV1 !== targetDiscoveryPointFixtures.verifyProviderTargetDiscoveryPointGoldenResourceV1 || root.verifyProviderTargetDiscoveryPointInvalidResourceV1 !== targetDiscoveryPointFixtures.verifyProviderTargetDiscoveryPointInvalidResourceV1) throw new Error("root/target-discovery-point exports diverged");',
      'pointCalls = 0;',
      'verifyCalls = 0;',
      'const targetDiscoveryGoldenValidation = await targetDiscoveryPointFixtures.verifyProviderTargetDiscoveryPointGoldenResourceV1(targetDiscoveryPointGoldenBytes, strictCapability);',
      'if (targetDiscoveryGoldenValidation.authority !== "none_target_discovery_point_structure_only" || targetDiscoveryGoldenValidation.pointClosure.authority !== "none_target_discovery_point_structure_only" || targetDiscoveryGoldenValidation.pointClosure.targetCount !== targetDiscoveryGoldenValidation.manifest.expected.targetCount || targetDiscoveryGoldenValidation.pointClosure.unresolvedObservationCount !== targetDiscoveryGoldenValidation.manifest.expected.unresolvedObservationCount) throw new Error("packed target discovery point golden failed");',
      'if (pointCalls !== 1 || verifyCalls !== 6) throw new Error(`packed target discovery point crypto calls: ${pointCalls}/${verifyCalls}`);',
      'const targetDiscoveryLocatorPairs = [["publicSupportTaxonomy", targetDiscoveryPoint.buildProviderPublicSupportTaxonomyRelativePathV1(targetDiscoveryGoldenValidation.manifest.publicSupportTaxonomy)], ["releaseMatrix", targetDiscoveryPoint.buildProviderReleaseMatrixRelativePathV1(targetDiscoveryGoldenValidation.manifest.releaseMatrix)], ["targetDiscoveryFixtureManifest", targetDiscoveryPoint.buildProviderTargetDiscoveryFixtureManifestRelativePathV1(targetDiscoveryGoldenValidation.manifest.targetDiscoveryFixtureManifest)], ["targetDiscoveryRunnerRun", targetDiscoveryPoint.buildProviderTargetDiscoveryRunnerRunRelativePathV1(targetDiscoveryGoldenValidation.manifest.targetDiscoveryRunnerRun)], ["targetDiscoveryResult", targetDiscoveryPoint.buildProviderTargetDiscoveryResultRelativePathV1(targetDiscoveryGoldenValidation.manifest.targetDiscoveryResult)]];',
      'if (targetDiscoveryLocatorPairs.length !== 5 || targetDiscoveryLocatorPairs.some(([key, path]) => path !== targetDiscoveryGoldenValidation.manifest.expected.locators[key] || path !== targetDiscoveryGoldenValidation.pointClosure.locators[key])) throw new Error("packed target discovery point locator closure failed");',
      'const targetDiscoveryInvalid = targetDiscoveryPointFixtures.verifyProviderTargetDiscoveryPointInvalidResourceV1(targetDiscoveryPointInvalidBytes);',
      'if (targetDiscoveryInvalid.fixtureAuthority !== "none_rejection_only" || targetDiscoveryInvalid.caseCount !== targetDiscoveryPointFixtures.PROVIDER_TARGET_DISCOVERY_POINT_INVALID_CASE_IDS_V1.length || targetDiscoveryInvalid.cases.length !== targetDiscoveryInvalid.caseCount || JSON.stringify(targetDiscoveryInvalid.caseIds) !== JSON.stringify(targetDiscoveryPointFixtures.PROVIDER_TARGET_DISCOVERY_POINT_INVALID_CASE_IDS_V1)) throw new Error("packed target discovery point invalid corpus failed");',
      '}',
      '{ // packed conformance-result phase',
      'if (root.validateProviderRealFilesystemConformanceResultClosureV1 !== realFilesystemConformanceResult.validateProviderRealFilesystemConformanceResultClosureV1 || root.verifyProviderRealFilesystemConformanceResultGoldenResourceV1 !== realFilesystemConformanceResultFixtures.verifyProviderRealFilesystemConformanceResultGoldenResourceV1 || root.verifyProviderRealFilesystemConformanceResultInvalidResourceV1 !== realFilesystemConformanceResultFixtures.verifyProviderRealFilesystemConformanceResultInvalidResourceV1) throw new Error("root/real-filesystem-conformance-result exports diverged");',
      'pointCalls = 0;',
      'verifyCalls = 0;',
      'const conformanceResultGoldenValidation = await realFilesystemConformanceResultFixtures.verifyProviderRealFilesystemConformanceResultGoldenResourceV1(realFilesystemConformanceResultGoldenBytes, strictCapability);',
      'if (conformanceResultGoldenValidation.authority !== "none_real_fs_conformance_result_structure_only" || conformanceResultGoldenValidation.resultClosure.caseResultCount !== 8 || conformanceResultGoldenValidation.manifest.expected.resultSignatureCount !== 0 || pointCalls !== 1 || verifyCalls !== 6) throw new Error(`packed conformance result golden/crypto closure failed: ${pointCalls}/${verifyCalls}`);',
      'const conformanceResultPath = realFilesystemConformanceResult.buildProviderRealFilesystemConformanceResultRelativePathV1(conformanceResultGoldenValidation.manifest.realFilesystemConformanceResultLocator);',
      'if (conformanceResultPath !== conformanceResultGoldenValidation.manifest.expected.relativePath || conformanceResultPath !== conformanceResultGoldenValidation.resultClosure.relativePath) throw new Error("packed conformance result Locator-only path failed");',
      'for (const substitution of [conformanceResultGoldenValidation.manifest.realFilesystemConformanceResult, conformanceResultGoldenValidation.manifest.realFilesystemConformanceResultPin, { ...conformanceResultGoldenValidation.manifest.realFilesystemConformanceResultLocator, path: "provider/real-fs-conformance-results/latest.json" }]) { try { realFilesystemConformanceResult.buildProviderRealFilesystemConformanceResultRelativePathV1(substitution); throw new Error("packed conformance result non-Locator path input accepted"); } catch (error) { if (!(error instanceof TypeError) || error.message !== "real filesystem conformance result path requires the exact locator DTO") throw error; } }',
      'const conformanceResultInvalid = realFilesystemConformanceResultFixtures.verifyProviderRealFilesystemConformanceResultInvalidResourceV1(realFilesystemConformanceResultInvalidBytes);',
      'if (conformanceResultInvalid.fixtureAuthority !== "none_rejection_only" || conformanceResultInvalid.caseCount !== 50 || conformanceResultInvalid.cases.length !== conformanceResultInvalid.caseCount || JSON.stringify(conformanceResultInvalid.caseIds) !== JSON.stringify(realFilesystemConformanceResultFixtures.PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_CASE_IDS_V1)) throw new Error("packed conformance result invalid corpus failed");',
      'let conformanceResultInvalidExecutedCaseCount = 0;',
      'for (const [index, invalidCase] of conformanceResultInvalid.cases.entries()) {',
      '  if (invalidCase.caseId !== conformanceResultInvalid.caseIds[index] || invalidCase.mutation.operation !== invalidCase.caseId) throw new Error(`packed conformance result invalid operation/order drift: ${invalidCase.caseId}`);',
      '  const outcome = await realFilesystemConformanceResultFixtures.executeProviderRealFilesystemConformanceResultInvalidCaseV1(conformanceResultGoldenValidation.manifest, invalidCase.mutation.operation, strictCapability);',
      '  if (invalidCase.expected.boundary === "snapshot_stability") {',
      '    if (outcome.kind !== "snapshot_acceptance" || outcome.boundary !== "snapshot_stability" || outcome.authority !== invalidCase.expected.authority || outcome.caseResultCount !== invalidCase.expected.caseResultCount || outcome.passedCaseResultCount !== invalidCase.expected.passedCaseResultCount) throw new Error(`packed conformance result snapshot replay drift: ${invalidCase.caseId}/${JSON.stringify(outcome)}`);',
      '  } else if (invalidCase.expected.boundary === "locator_builder") {',
      '    if (outcome.kind !== "rejection" || outcome.boundary !== "locator_builder" || outcome.stage !== invalidCase.expected.stage || outcome.reason !== invalidCase.expected.reason) throw new Error(`packed conformance result locator replay drift: ${invalidCase.caseId}/${JSON.stringify(outcome)}`);',
      '  } else {',
      '    if (outcome.kind !== "rejection" || outcome.boundary !== "internal_diagnostic" || outcome.stage !== invalidCase.expected.stage || outcome.reason !== invalidCase.expected.reason || outcome.publicFailure?.errorName !== "ProviderRealFilesystemConformanceResultClosureValidationError" || outcome.publicFailure?.code !== "provider_unavailable" || outcome.publicFailure?.reason !== "attestation_invalid" || outcome.publicFailure.errorName !== invalidCase.expected.publicFailure.errorName || outcome.publicFailure.code !== invalidCase.expected.publicFailure.code || outcome.publicFailure.reason !== invalidCase.expected.publicFailure.reason) throw new Error(`packed conformance result diagnostic replay drift: ${invalidCase.caseId}/${JSON.stringify(outcome)}`);',
      '  }',
      '  conformanceResultInvalidExecutedCaseCount += 1;',
      '}',
      'if (conformanceResultInvalidExecutedCaseCount !== conformanceResultInvalid.caseCount) throw new Error(`packed conformance result replay count drift: ${conformanceResultInvalidExecutedCaseCount}/${conformanceResultInvalid.caseCount}`);',
      '}',
      '{ // packed runtime-attestation phase',
      'if (root.validateProviderRuntimeAttestationPointClosureV1 !== providerRuntimeAttestationPoint.validateProviderRuntimeAttestationPointClosureV1 || root.verifyProviderRuntimeAttestationPointGoldenResourceV1 !== providerRuntimeAttestationPointFixtures.verifyProviderRuntimeAttestationPointGoldenResourceV1 || root.verifyProviderRuntimeAttestationPointInvalidResourceV1 !== providerRuntimeAttestationPointFixtures.verifyProviderRuntimeAttestationPointInvalidResourceV1) throw new Error("root/provider-runtime-attestation-point exports diverged");',
      'pointCalls = 0;',
      'verifyCalls = 0;',
      'const runtimeAttestationPointGoldenValidation = await providerRuntimeAttestationPointFixtures.verifyProviderRuntimeAttestationPointGoldenResourceV1(providerRuntimeAttestationPointGoldenBytes, strictCapability);',
      'if (runtimeAttestationPointGoldenValidation.authority !== "none_provider_runtime_attestation_structure_only" || runtimeAttestationPointGoldenValidation.pointClosure.authority !== "none_provider_runtime_attestation_structure_only" || runtimeAttestationPointGoldenValidation.pointClosure.conformanceResultClosure.authority !== "none_real_fs_conformance_result_structure_only" || runtimeAttestationPointGoldenValidation.manifest.expected.activeRootPointAdmissionCount !== 1 || runtimeAttestationPointGoldenValidation.manifest.expected.signatureVerificationCount !== 7 || runtimeAttestationPointGoldenValidation.manifest.expected.runtimeSignatureCount !== 1 || runtimeAttestationPointGoldenValidation.manifest.expected.conformanceResultSignatureCount !== 0 || pointCalls !== 1 || verifyCalls !== 7) throw new Error(`packed runtime attestation point golden/crypto closure failed: ${pointCalls}/${verifyCalls}`);',
      'const runtimeAttestationPointInvalid = providerRuntimeAttestationPointFixtures.verifyProviderRuntimeAttestationPointInvalidResourceV1(providerRuntimeAttestationPointInvalidBytes);',
      'if (runtimeAttestationPointInvalid.fixtureAuthority !== "none_rejection_only" || runtimeAttestationPointInvalid.innerCaseCount !== 50 || runtimeAttestationPointInvalid.pointCaseCount !== 72 || runtimeAttestationPointInvalid.caseCount !== 122 || runtimeAttestationPointInvalid.cases.length !== 122 || runtimeAttestationPointInvalid.caseIds.length !== 122 || new Set(runtimeAttestationPointInvalid.caseIds).size !== 122 || JSON.stringify(runtimeAttestationPointInvalid.caseIds) !== JSON.stringify(providerRuntimeAttestationPointFixtures.PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_CASE_IDS_V1)) throw new Error("packed runtime attestation point invalid corpus failed");',
      'let runtimeAttestationPointInvalidExecutedCaseCount = 0;',
      'for (const [index, invalidCase] of runtimeAttestationPointInvalid.cases.entries()) {',
      '  if (invalidCase.caseId !== runtimeAttestationPointInvalid.caseIds[index] || invalidCase.mutation.operation !== invalidCase.caseId) throw new Error(`packed runtime attestation point invalid operation/order drift: ${invalidCase.caseId}`);',
      '  const materializedRequest = providerRuntimeAttestationPointFixtures.materializeProviderRuntimeAttestationPointInvalidRequestWitnessV1(runtimeAttestationPointGoldenValidation.manifest, invalidCase);',
      '  const materializedRequestDigest = `sha256:${createHash("sha256").update(root.canonicalizeJcsSafeIntegerUtf8V1([providerRuntimeAttestationPointFixtures.PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1, materializedRequest])).digest("hex")}`;',
      '  if (materializedRequestDigest !== invalidCase.expected.materializedRequestSemanticDigest) throw new Error(`packed runtime attestation point materialized request drift: ${invalidCase.caseId}`);',
      '  pointCalls = 0;',
      '  verifyCalls = 0;',
      '  const outcome = await providerRuntimeAttestationPointFixtures.executeProviderRuntimeAttestationPointInvalidCaseV1(runtimeAttestationPointGoldenValidation.manifest, invalidCase, strictCapability);',
      '  if (pointCalls !== invalidCase.expected.pointAdmissionCount || verifyCalls !== invalidCase.expected.signatureVerificationCount) throw new Error(`packed runtime attestation point crypto replay drift: ${invalidCase.caseId}/${pointCalls}/${verifyCalls}`);',
      '  if (invalidCase.expected.boundary === "snapshot_stability") {',
      '    if (outcome.kind !== "snapshot_acceptance" || outcome.boundary !== "snapshot_stability" || outcome.authority !== invalidCase.expected.authority || JSON.stringify(outcome.snapshotProjection) !== JSON.stringify(invalidCase.expected.snapshotProjection)) throw new Error(`packed runtime attestation point snapshot replay drift: ${invalidCase.caseId}/${JSON.stringify(outcome)}`);',
      '  } else {',
      '    if (outcome.kind !== "rejection" || outcome.boundary !== "internal_diagnostic" || outcome.stage !== invalidCase.expected.stage || outcome.reason !== invalidCase.expected.reason || outcome.publicFailure?.errorName !== invalidCase.expected.publicFailure.errorName || outcome.publicFailure?.code !== invalidCase.expected.publicFailure.code || outcome.publicFailure?.reason !== invalidCase.expected.publicFailure.reason) throw new Error(`packed runtime attestation point diagnostic replay drift: ${invalidCase.caseId}/${JSON.stringify(outcome)}`);',
      '  }',
      '  runtimeAttestationPointInvalidExecutedCaseCount += 1;',
      '}',
      'if (runtimeAttestationPointInvalidExecutedCaseCount !== 122) throw new Error(`packed runtime attestation point replay count drift: ${runtimeAttestationPointInvalidExecutedCaseCount}/122`);',
      '}',
      '{ // packed feasibility-evidence phase',
      'if (root.validateProviderFeasibilityEvidencePointClosureV1 !== providerFeasibilityEvidencePoint.validateProviderFeasibilityEvidencePointClosureV1 || root.verifyProviderFeasibilityEvidencePointGoldenResourceV1 !== providerFeasibilityEvidencePointFixtures.verifyProviderFeasibilityEvidencePointGoldenResourceV1 || root.verifyProviderFeasibilityEvidencePointPositiveVectorsV1 !== providerFeasibilityEvidencePointFixtures.verifyProviderFeasibilityEvidencePointPositiveVectorsV1 || root.verifyProviderFeasibilityEvidencePointInvalidResourceV1 !== providerFeasibilityEvidencePointFixtures.verifyProviderFeasibilityEvidencePointInvalidResourceV1) throw new Error("root/provider-feasibility-evidence-point exports diverged");',
      'pointCalls = 0;',
      'verifyCalls = 0;',
      'const feasibilityEvidencePointGoldenValidation = await providerFeasibilityEvidencePointFixtures.verifyProviderFeasibilityEvidencePointGoldenResourceV1(providerFeasibilityEvidencePointGoldenBytes, strictCapability);',
      'if (feasibilityEvidencePointGoldenValidation.authority !== "none_provider_feasibility_evidence_structure_only" || feasibilityEvidencePointGoldenValidation.pointClosure.authority !== "none_provider_feasibility_evidence_structure_only" || feasibilityEvidencePointGoldenValidation.pointClosure.runtimeAttestationPointClosure.authority !== "none_provider_runtime_attestation_structure_only" || feasibilityEvidencePointGoldenValidation.manifest.expected.activeRootPointAdmissionCount !== 3 || feasibilityEvidencePointGoldenValidation.manifest.expected.signatureVerificationCount !== 11 || feasibilityEvidencePointGoldenValidation.manifest.expected.approverRecordSignatureCount !== 2 || feasibilityEvidencePointGoldenValidation.manifest.expected.evidenceSignatureCount !== 2 || pointCalls !== 3 || verifyCalls !== 11) throw new Error(`packed feasibility evidence point golden/crypto closure failed: ${pointCalls}/${verifyCalls}`);',
      'pointCalls = 0;',
      'verifyCalls = 0;',
      'const feasibilityEvidencePositiveVectorClosures = await providerFeasibilityEvidencePointFixtures.verifyProviderFeasibilityEvidencePointPositiveVectorsV1(feasibilityEvidencePointGoldenValidation.manifest, strictCapability);',
      'if (feasibilityEvidencePositiveVectorClosures.length !== 3 || JSON.stringify(feasibilityEvidencePositiveVectorClosures.map((closure) => closure.providerFeasibilityEvidence.payload.result)) !== JSON.stringify(["passed", "failed", "unsupported"]) || pointCalls !== 9 || verifyCalls !== 33) throw new Error(`packed feasibility evidence point positive vectors failed: ${pointCalls}/${verifyCalls}`);',
      'const feasibilityEvidencePointInvalid = providerFeasibilityEvidencePointFixtures.verifyProviderFeasibilityEvidencePointInvalidResourceV1(providerFeasibilityEvidencePointInvalidBytes);',
      'if (feasibilityEvidencePointInvalid.fixtureAuthority !== "none_rejection_only" || feasibilityEvidencePointInvalid.runtimeCaseCount !== 122 || feasibilityEvidencePointInvalid.pointCaseCount !== 105 || feasibilityEvidencePointInvalid.caseCount !== 227 || feasibilityEvidencePointInvalid.cases.length !== 227 || feasibilityEvidencePointInvalid.caseIds.length !== 227 || new Set(feasibilityEvidencePointInvalid.caseIds).size !== 227 || JSON.stringify(feasibilityEvidencePointInvalid.caseIds) !== JSON.stringify(providerFeasibilityEvidencePointFixtures.PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_CASE_IDS_V1)) throw new Error("packed feasibility evidence point invalid corpus failed");',
      'let feasibilityEvidencePointInvalidExecutedCaseCount = 0;',
      'for (const [index, invalidCase] of feasibilityEvidencePointInvalid.cases.entries()) {',
      '  if (invalidCase.caseId !== feasibilityEvidencePointInvalid.caseIds[index] || invalidCase.mutation.operation !== invalidCase.caseId) throw new Error(`packed feasibility evidence point invalid operation/order drift: ${invalidCase.caseId}`);',
      '  const materializedRequest = providerFeasibilityEvidencePointFixtures.materializeProviderFeasibilityEvidencePointInvalidRequestWitnessV1(feasibilityEvidencePointGoldenValidation.manifest, feasibilityEvidencePointInvalid, invalidCase);',
      '  const materializedRequestDigest = `sha256:${createHash("sha256").update(root.canonicalizeJcsSafeIntegerUtf8V1([providerFeasibilityEvidencePointFixtures.PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1, materializedRequest])).digest("hex")}`;',
      '  if (materializedRequestDigest !== invalidCase.expected.materializedRequestSemanticDigest) throw new Error(`packed feasibility evidence point materialized request drift: ${invalidCase.caseId}`);',
      '  pointCalls = 0;',
      '  verifyCalls = 0;',
      '  const outcome = await providerFeasibilityEvidencePointFixtures.executeProviderFeasibilityEvidencePointInvalidCaseV1(feasibilityEvidencePointGoldenValidation.manifest, feasibilityEvidencePointInvalid, invalidCase, strictCapability);',
      '  if (pointCalls !== invalidCase.expected.pointAdmissionCount || verifyCalls !== invalidCase.expected.signatureVerificationCount) throw new Error(`packed feasibility evidence point crypto replay drift: ${invalidCase.caseId}/${pointCalls}/${verifyCalls}`);',
      '  if (invalidCase.expected.boundary === "snapshot_stability") {',
      '    if (outcome.kind !== "snapshot_acceptance" || outcome.boundary !== "snapshot_stability" || outcome.authority !== invalidCase.expected.authority || JSON.stringify(outcome.snapshotProjection) !== JSON.stringify(invalidCase.expected.snapshotProjection)) throw new Error(`packed feasibility evidence point snapshot replay drift: ${invalidCase.caseId}/${JSON.stringify(outcome)}`);',
      '  } else {',
      '    if (outcome.kind !== "rejection" || outcome.boundary !== "internal_diagnostic" || outcome.stage !== invalidCase.expected.stage || outcome.reason !== invalidCase.expected.reason || outcome.publicFailure?.errorName !== invalidCase.expected.publicFailure.errorName || outcome.publicFailure?.code !== invalidCase.expected.publicFailure.code || outcome.publicFailure?.reason !== invalidCase.expected.publicFailure.reason) throw new Error(`packed feasibility evidence point diagnostic replay drift: ${invalidCase.caseId}/${JSON.stringify(outcome)}`);',
      '  }',
      '  feasibilityEvidencePointInvalidExecutedCaseCount += 1;',
      '}',
      'if (feasibilityEvidencePointInvalidExecutedCaseCount !== 227) throw new Error(`packed feasibility evidence point replay count drift: ${feasibilityEvidencePointInvalidExecutedCaseCount}/227`);',
      '}',
      '{ // packed Registry/Evidence-binding phase',
      'if (root.validateProviderRegistryEvidenceBindingPointClosureV1 !== providerRegistryEvidenceBindingPoint.validateProviderRegistryEvidenceBindingPointClosureV1 || root.diagnoseProviderRegistryEvidenceBindingPointClosureV1 !== providerRegistryEvidenceBindingPoint.diagnoseProviderRegistryEvidenceBindingPointClosureV1 || root.ProviderRegistryEvidenceBindingPointClosureValidationError !== providerRegistryEvidenceBindingPoint.ProviderRegistryEvidenceBindingPointClosureValidationError || root.verifyProviderRegistryEvidenceBindingPointGoldenResourceV1 !== providerRegistryEvidenceBindingPointFixtures.verifyProviderRegistryEvidenceBindingPointGoldenResourceV1 || root.verifyProviderRegistryEvidenceBindingPointInvalidResourceV1 !== providerRegistryEvidenceBindingPointFixtures.verifyProviderRegistryEvidenceBindingPointInvalidResourceV1 || root.materializeProviderRegistryEvidenceBindingPointGoldenRequestV1 !== providerRegistryEvidenceBindingPointFixtures.materializeProviderRegistryEvidenceBindingPointGoldenRequestV1 || root.materializeProviderRegistryEvidenceBindingPointInvalidCaseV1 !== providerRegistryEvidenceBindingPointFixtures.materializeProviderRegistryEvidenceBindingPointInvalidCaseV1 || root.executeProviderRegistryEvidenceBindingPointInvalidCaseV1 !== providerRegistryEvidenceBindingPointFixtures.executeProviderRegistryEvidenceBindingPointInvalidCaseV1 || root.verifyProviderRegistryEvidenceBindingTopologyProofResourceV1 === undefined) throw new Error("root/provider Registry/Evidence binding exports diverged");',
      'if (providerRegistryEvidenceBindingPointGoldenBytes.byteLength !== providerRegistryEvidenceBindingPointFixtures.PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1 || createHash("sha256").update(providerRegistryEvidenceBindingPointGoldenBytes).digest("hex") !== providerRegistryEvidenceBindingPointFixtures.PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1) throw new Error("packed Registry/Evidence binding golden raw anchor failed");',
      'if (providerRegistryEvidenceBindingPointInvalidBytes.byteLength !== providerRegistryEvidenceBindingPointFixtures.PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1 || createHash("sha256").update(providerRegistryEvidenceBindingPointInvalidBytes).digest("hex") !== providerRegistryEvidenceBindingPointFixtures.PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_RESOURCE_SHA256_HEX_V1) throw new Error("packed Registry/Evidence binding invalid raw anchor failed");',
      'const registryEvidenceBindingGoldenManifest = providerRegistryEvidenceBindingPointFixtures.verifyProviderRegistryEvidenceBindingPointGoldenResourceV1(providerRegistryEvidenceBindingPointGoldenBytes);',
      'pointCalls = 0;',
      'verifyCalls = 0;',
      'const registryEvidenceBindingClosure = await providerRegistryEvidenceBindingPoint.validateProviderRegistryEvidenceBindingPointClosureV1(providerRegistryEvidenceBindingPointFixtures.materializeProviderRegistryEvidenceBindingPointGoldenRequestV1(registryEvidenceBindingGoldenManifest, strictCapability));',
      'if (registryEvidenceBindingClosure.authority !== "none_registry_entry_evidence_binding_structure_only" || pointCalls !== 24 || verifyCalls !== 46 || JSON.stringify(providerRegistryEvidenceBindingPointFixtures.projectProviderRegistryEvidenceBindingPointClosureSnapshotV1(registryEvidenceBindingClosure)) !== JSON.stringify(registryEvidenceBindingGoldenManifest.expected.successProjection)) throw new Error(`packed Registry/Evidence binding golden/crypto closure failed: ${pointCalls}/${verifyCalls}`);',
      'const registryEvidenceBindingInvalid = providerRegistryEvidenceBindingPointFixtures.verifyProviderRegistryEvidenceBindingPointInvalidResourceV1(providerRegistryEvidenceBindingPointInvalidBytes);',
      'if (registryEvidenceBindingInvalid.fixtureAuthority !== "none_fixture_replay_only" || registryEvidenceBindingInvalid.inheritedEvidenceCaseCount !== 227 || registryEvidenceBindingInvalid.inheritedRegistryCaseCount !== 89 || registryEvidenceBindingInvalid.pointSpecificCaseCount !== 38 || registryEvidenceBindingInvalid.caseCount !== 354 || registryEvidenceBindingInvalid.shardSize !== 32 || registryEvidenceBindingInvalid.maxWorkers !== 4 || registryEvidenceBindingInvalid.shards.length !== 12 || registryEvidenceBindingInvalid.caseIds.length !== 354 || registryEvidenceBindingInvalid.cases.length !== 354 || new Set(registryEvidenceBindingInvalid.caseIds).size !== 354 || JSON.stringify(registryEvidenceBindingInvalid.caseIds) !== JSON.stringify(providerRegistryEvidenceBindingPointFixtures.PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_CASE_IDS_V1)) throw new Error("packed Registry/Evidence binding invalid corpus failed");',
      '// The exact 354-case replay runs once in four fixed packed-Node lanes.',
      'const registryEvidenceBindingTopologyProof = root.verifyProviderRegistryEvidenceBindingTopologyProofResourceV1(providerRegistryEvidenceBindingTopologyProofBytes);',
      'if (registryEvidenceBindingTopologyProof.profile !== root.PROVIDER_REGISTRY_EVIDENCE_BINDING_TOPOLOGY_PROOF_PROFILE_V1 || registryEvidenceBindingTopologyProof.productionParserBindings.length !== 21 || registryEvidenceBindingTopologyProof.status !== "accepted_after_contract_reopen" || registryEvidenceBindingTopologyProof.contractReopenRequired !== false || registryEvidenceBindingTopologyProof.priorContractReopenRequired !== true || registryEvidenceBindingTopologyProof.capAssessment.adoptedAssessment.withinSoundUpper !== true || registryEvidenceBindingTopologyProof.capAssessment.priorFailures.length !== 2 || registryEvidenceBindingTopologyProof.capAssessment.adoptedFailures.length !== 0) throw new Error("packed Registry/Evidence topology proof failed");',
      '}',
      '{ // packed release-target-Universe phase',
      'if (root.validateProviderReleaseTargetUniversePointClosureV1 !== providerReleaseTargetUniversePoint.validateProviderReleaseTargetUniversePointClosureV1 || root.diagnoseProviderReleaseTargetUniversePointClosureV1 !== providerReleaseTargetUniversePoint.diagnoseProviderReleaseTargetUniversePointClosureV1 || root.buildProviderReleaseTargetUniverseRelativePathV1 !== providerReleaseTargetUniversePoint.buildProviderReleaseTargetUniverseRelativePathV1 || root.ProviderReleaseTargetUniversePointClosureValidationError !== providerReleaseTargetUniversePoint.ProviderReleaseTargetUniversePointClosureValidationError || root.verifyProviderReleaseTargetUniversePointGoldenResourceV1 !== providerReleaseTargetUniversePointFixtures.verifyProviderReleaseTargetUniversePointGoldenResourceV1 || root.verifyProviderReleaseTargetUniversePointPositiveVectorsV1 !== providerReleaseTargetUniversePointFixtures.verifyProviderReleaseTargetUniversePointPositiveVectorsV1 || root.verifyProviderReleaseTargetUniversePointInvalidResourceV1 !== providerReleaseTargetUniversePointFixtures.verifyProviderReleaseTargetUniversePointInvalidResourceV1 || root.materializeProviderReleaseTargetUniversePointInvalidCaseWitnessV1 !== providerReleaseTargetUniversePointFixtures.materializeProviderReleaseTargetUniversePointInvalidCaseWitnessV1 || root.executeProviderReleaseTargetUniversePointInvalidCaseV1 !== providerReleaseTargetUniversePointFixtures.executeProviderReleaseTargetUniversePointInvalidCaseV1 || root.ProviderReleaseTargetUniversePointFixtureError !== providerReleaseTargetUniversePointFixtures.ProviderReleaseTargetUniversePointFixtureError || root.PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_CASE_IDS_V1 !== providerReleaseTargetUniversePointFixtures.PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_CASE_IDS_V1) throw new Error("root/provider-release-target-universe-point exports diverged");',
      'if (providerReleaseTargetUniversePointGoldenBytes.byteLength !== providerReleaseTargetUniversePointFixtures.PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1 || createHash("sha256").update(providerReleaseTargetUniversePointGoldenBytes).digest("hex") !== providerReleaseTargetUniversePointFixtures.PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1) throw new Error("packed release target Universe golden raw anchor failed");',
      'if (providerReleaseTargetUniversePointInvalidBytes.byteLength !== providerReleaseTargetUniversePointFixtures.PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1 || createHash("sha256").update(providerReleaseTargetUniversePointInvalidBytes).digest("hex") !== providerReleaseTargetUniversePointFixtures.PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_RESOURCE_SHA256_HEX_V1) throw new Error("packed release target Universe invalid raw anchor failed");',
      'pointCalls = 0;',
      'verifyCalls = 0;',
      'nextSignatureMutation = undefined;',
      'const releaseTargetUniverseGoldenValidation = await providerReleaseTargetUniversePointFixtures.verifyProviderReleaseTargetUniversePointGoldenResourceV1(providerReleaseTargetUniversePointGoldenBytes, strictCapability);',
      'if (releaseTargetUniverseGoldenValidation.authority !== "none_release_target_universe_structure_only" || releaseTargetUniverseGoldenValidation.pointClosure.authority !== "none_release_target_universe_structure_only" || releaseTargetUniverseGoldenValidation.pointClosure.targetDiscoveryPointClosure.authority !== "none_target_discovery_point_structure_only" || releaseTargetUniverseGoldenValidation.manifest.positiveVectors.length !== 4 || releaseTargetUniverseGoldenValidation.manifest.expected.pointAdmissionCount !== 1 || releaseTargetUniverseGoldenValidation.manifest.expected.signatureVerificationCount !== 7 || pointCalls !== 1 || verifyCalls !== 7 || nextSignatureMutation !== undefined) throw new Error(`packed release target Universe golden/crypto closure failed: ${pointCalls}/${verifyCalls}`);',
      'const releaseTargetUniversePath = providerReleaseTargetUniversePoint.buildProviderReleaseTargetUniverseRelativePathV1(releaseTargetUniverseGoldenValidation.manifest.releaseTargetUniverse);',
      'if (releaseTargetUniversePath !== releaseTargetUniverseGoldenValidation.pointClosure.relativePath || releaseTargetUniversePath !== releaseTargetUniverseGoldenValidation.manifest.expected.snapshotProjection.universeRelativePath) throw new Error("packed release target Universe Locator-only path failed");',
      'pointCalls = 0;',
      'verifyCalls = 0;',
      'const releaseTargetUniversePositiveVectorClosures = await providerReleaseTargetUniversePointFixtures.verifyProviderReleaseTargetUniversePointPositiveVectorsV1(releaseTargetUniverseGoldenValidation.manifest, strictCapability);',
      'if (releaseTargetUniversePositiveVectorClosures.length !== 4 || JSON.stringify(releaseTargetUniverseGoldenValidation.manifest.positiveVectors.map(({ vectorId }) => vectorId)) !== JSON.stringify(["taxonomy-mapping-unresolved", "target-discovery-unresolved", "release-matrix-incomplete", "closed-world-complete"]) || releaseTargetUniversePositiveVectorClosures.some((closure) => closure.authority !== "none_release_target_universe_structure_only") || pointCalls !== 4 || verifyCalls !== 28 || nextSignatureMutation !== undefined) throw new Error(`packed release target Universe positive-vector closure failed: ${pointCalls}/${verifyCalls}`);',
      'const releaseTargetUniverseInvalid = providerReleaseTargetUniversePointFixtures.verifyProviderReleaseTargetUniversePointInvalidResourceV1(providerReleaseTargetUniversePointInvalidBytes);',
      'if (releaseTargetUniverseInvalid.fixtureAuthority !== "none_rejection_only" || releaseTargetUniverseInvalid.inheritedCaseCount !== 116 || releaseTargetUniverseInvalid.pointCaseCount !== 169 || releaseTargetUniverseInvalid.caseCount !== 285 || releaseTargetUniverseInvalid.caseIds.length !== 285 || releaseTargetUniverseInvalid.cases.length !== 285 || releaseTargetUniverseInvalid.inheritedReplayRecipes.length !== 116 || new Set(releaseTargetUniverseInvalid.caseIds).size !== 285 || JSON.stringify(releaseTargetUniverseInvalid.caseIds) !== JSON.stringify(providerReleaseTargetUniversePointFixtures.PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_CASE_IDS_V1)) throw new Error("packed release target Universe invalid corpus failed");',
      'let releaseTargetUniverseInvalidExecutedCaseCount = 0;',
      'for (const [index, invalidCase] of releaseTargetUniverseInvalid.cases.entries()) {',
      '  if (invalidCase.caseId !== releaseTargetUniverseInvalid.caseIds[index] || invalidCase.mutation.operation !== invalidCase.caseId) throw new Error(`packed release target Universe invalid operation/order drift: ${invalidCase.caseId}`);',
      '  const firstWitness = providerReleaseTargetUniversePointFixtures.materializeProviderReleaseTargetUniversePointInvalidCaseWitnessV1(releaseTargetUniverseGoldenValidation.manifest, releaseTargetUniverseInvalid, invalidCase);',
      '  const secondWitness = providerReleaseTargetUniversePointFixtures.materializeProviderReleaseTargetUniversePointInvalidCaseWitnessV1(releaseTargetUniverseGoldenValidation.manifest, releaseTargetUniverseInvalid, invalidCase);',
      '  if (firstWitness === secondWitness) throw new Error(`packed release target Universe witness was reused: ${invalidCase.caseId}`);',
      '  const firstWitnessDigest = `sha256:${createHash("sha256").update(root.canonicalizeJcsSafeIntegerUtf8V1([providerReleaseTargetUniversePointFixtures.PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1, firstWitness])).digest("hex")}`;',
      '  const secondWitnessDigest = `sha256:${createHash("sha256").update(root.canonicalizeJcsSafeIntegerUtf8V1([providerReleaseTargetUniversePointFixtures.PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1, secondWitness])).digest("hex")}`;',
      '  if (firstWitnessDigest !== invalidCase.expected.materializedRequestSemanticDigest || secondWitnessDigest !== firstWitnessDigest) throw new Error(`packed release target Universe materialized request drift: ${invalidCase.caseId}`);',
      '  pointCalls = 0;',
      '  verifyCalls = 0;',
      '  nextSignatureMutation = undefined;',
      '  const outcome = await providerReleaseTargetUniversePointFixtures.executeProviderReleaseTargetUniversePointInvalidCaseV1(releaseTargetUniverseGoldenValidation.manifest, releaseTargetUniverseInvalid, invalidCase, strictCapability, universeExecutionCounter);',
      '  if (nextSignatureMutation !== undefined || pointCalls !== invalidCase.expected.pointAdmissionCount || verifyCalls !== invalidCase.expected.signatureVerificationCount || outcome.pointAdmissionCount !== invalidCase.expected.pointAdmissionCount || outcome.signatureVerificationCount !== invalidCase.expected.signatureVerificationCount || Object.getPrototypeOf(outcome) !== null || !Object.isFrozen(outcome)) throw new Error(`packed release target Universe execution/count drift: ${invalidCase.caseId}/${pointCalls}/${verifyCalls}`);',
      '  if (invalidCase.expected.boundary === "snapshot_stability") {',
      '    if (outcome.kind !== "snapshot_acceptance" || outcome.boundary !== "snapshot_stability" || outcome.authority !== invalidCase.expected.authority || JSON.stringify(outcome.snapshotProjection) !== JSON.stringify(invalidCase.expected.snapshotProjection)) throw new Error(`packed release target Universe snapshot replay drift: ${invalidCase.caseId}/${JSON.stringify(outcome)}`);',
      '  } else if (invalidCase.expected.boundary === "locator_builder") {',
      '    if (outcome.kind !== "rejection" || outcome.boundary !== "locator_builder" || outcome.stage !== invalidCase.expected.stage || outcome.reason !== invalidCase.expected.reason) throw new Error(`packed release target Universe locator replay drift: ${invalidCase.caseId}/${JSON.stringify(outcome)}`);',
      '  } else {',
      '    if (outcome.kind !== "rejection" || outcome.boundary !== "internal_diagnostic" || outcome.stage !== invalidCase.expected.stage || outcome.reason !== invalidCase.expected.reason || outcome.publicFailure?.errorName !== invalidCase.expected.publicFailure.errorName || outcome.publicFailure?.code !== invalidCase.expected.publicFailure.code || outcome.publicFailure?.reason !== invalidCase.expected.publicFailure.reason) throw new Error(`packed release target Universe diagnostic replay drift: ${invalidCase.caseId}/${JSON.stringify(outcome)}`);',
      '  }',
      '  releaseTargetUniverseInvalidExecutedCaseCount += 1;',
      '}',
      'if (releaseTargetUniverseInvalidExecutedCaseCount !== 285) throw new Error(`packed release target Universe replay count drift: ${releaseTargetUniverseInvalidExecutedCaseCount}/285`);',
      '}',
      'for (const internalExportName of ["createProviderPointRawAdmissionSessionV1", "createProviderPointPromiseV1", "createProviderTargetDiscoveryPointSnapshotV1", "assertProviderStrictEd25519CryptoCapabilityIdentityV1"]) { if (Object.hasOwn(root, internalExportName)) throw new Error(`private internal helper exported from root: ${internalExportName}`); }',
      'if (providerRegistry.StoreFilenameKeyV1Schema.parse("id-c4") !== "id-c4" || providerRegistry.decodeShortStoreFilenameKeyV1("id-c4") !== "a") throw new Error("packed lowercase base32hex filename codec failed");',
      'const privatePackagePrefix = "@understand-code/durable-object-provider-contracts";',
      'async function assertPrivateDeepImportUnavailable(privateSpecifier) {',
      '  let rejection;',
      '  try { await import(privateSpecifier); } catch (error) { rejection = error; }',
      '  if (rejection === undefined) throw new Error(`private deep import exported: ${privateSpecifier}`);',
      '  const privateSubpath = `.${privateSpecifier.slice(privatePackagePrefix.length)}`;',
      '  if (rejection?.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED" || typeof rejection?.message !== "string" || !rejection.message.includes(`Package subpath \'${privateSubpath}\'`)) throw new Error(`private deep import rejection mismatch for ${privateSpecifier}: ${rejection?.code ?? "no-code"}/${rejection?.message ?? String(rejection)}`);',
      '}',
      'for (const privateSpecifier of ["@understand-code/durable-object-provider-contracts/domain-crypto", "@understand-code/durable-object-provider-contracts/provider-registry-records", "@understand-code/durable-object-provider-contracts/provider-registry-manifest-history", "@understand-code/durable-object-provider-contracts/provider-point-raw-admission-internal", "@understand-code/durable-object-provider-contracts/provider-point-runtime-internal", "@understand-code/durable-object-provider-contracts/provider-target-discovery-point-internal", "@understand-code/durable-object-provider-contracts/provider-feasibility-evidence-point-internal", "@understand-code/durable-object-provider-contracts/provider-real-filesystem-conformance-result-internal", "@understand-code/durable-object-provider-contracts/provider-real-filesystem-source-internal", "@understand-code/durable-object-provider-contracts/provider-registry-history-prepared-handle-internal", "@understand-code/durable-object-provider-contracts/provider-registry-history-prepared-internal", "@understand-code/durable-object-provider-contracts/provider-runtime-attestation-point-internal", "@understand-code/durable-object-provider-contracts/provider-target-discovery-point-prepared-internal", "@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-topology-proof", "@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point-budget-test-seam-internal", "@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point-budget-witness-internal", "@understand-code/durable-object-provider-contracts/strict-ed25519-capability-internal"]) await assertPrivateDeepImportUnavailable(privateSpecifier);',
    ].join("\n"),
    "utf8",
  );
  const typeProbe = join(consumerRoot, "type-probe.mts");
  await writeFile(
    typeProbe,
    [
      'import { DurableObjectIdentityProviderIdV1Schema, DurableObjectIdentityProviderSlugV1Schema, createDurableObjectIdentityProviderIdV1, validateProviderRegistryManifestHistoryV1, verifyProviderRegistryManifestHistoryInvalidResourceV1 } from "@understand-code/durable-object-provider-contracts";',
      'import { createProviderUnavailableToolErrorV1 } from "@understand-code/durable-object-provider-contracts/provider-error";',
      'import type { ProviderCapabilityFailureReasonV1, ProviderUnavailableToolErrorV1 } from "@understand-code/durable-object-provider-contracts/provider-error";',
      'import { ProviderRegistryManifestHistoryGoldenManifestV1Schema, ProviderRegistryManifestHistoryInvalidManifestV1Schema, StoreFilenameKeyV1Schema, buildProviderRegistryRootMetadataRelativePathV1 } from "@understand-code/durable-object-provider-contracts/provider-registry";',
      'import type { ProviderRegistryManifestHistoryGoldenManifestV1, ProviderRegistryManifestHistoryInvalidManifestV1, ProviderRegistryManifestHistoryValidationV1, ProviderRegistryRootMetadataHistoryValidationV1, ProviderRegistryRootMetadataRelativePathV1, StoreFilenameKeyV1, ValidateProviderRegistryManifestHistoryV1Input } from "@understand-code/durable-object-provider-contracts/provider-registry";',
      'import { ProviderRealFilesystemSourceGoldenManifestV1Schema } from "@understand-code/durable-object-provider-contracts";',
      'import type { Ed25519PublicKeyDigestV1, ContentDigestV1, ProviderBootstrapTrustBundleStructureValidationV1, ProviderBootstrapTrustGoldenManifestValidationV1, ProviderBootstrapTrustInvalidManifestValidationV1, ProviderRealFilesystemSourceGoldenManifestV1, ProviderStrictEd25519FixedResourceHostV1 } from "@understand-code/durable-object-provider-contracts";',
      'import type { ProviderPublicSupportTaxonomyLocatorV1 as RootProviderPublicSupportTaxonomyLocatorV1, ProviderReleaseMatrixLocatorV1 as RootProviderReleaseMatrixLocatorV1, ProviderTargetDiscoveryFixtureManifestLocatorV1 as RootProviderTargetDiscoveryFixtureManifestLocatorV1, ProviderTargetDiscoveryResultLocatorV1 as RootProviderTargetDiscoveryResultLocatorV1, ProviderTargetDiscoveryResultPinV1 as RootProviderTargetDiscoveryResultPinV1, ProviderTargetDiscoveryRunnerRunLocatorV1 as RootProviderTargetDiscoveryRunnerRunLocatorV1 } from "@understand-code/durable-object-provider-contracts";',
      'import { validateProviderRealFilesystemSourceClosureV1 } from "@understand-code/durable-object-provider-contracts/provider-real-filesystem-source";',
      'import type { ProviderRealFilesystemSourceClosureValidationV1, ValidateProviderRealFilesystemSourceClosureV1Input } from "@understand-code/durable-object-provider-contracts/provider-real-filesystem-source";',
      'import { validateProviderTargetDiscoveryPointClosureV1 } from "@understand-code/durable-object-provider-contracts/provider-target-discovery-point";',
      'import type { ProviderPublicSupportTaxonomyLocatorV1 as SubpathProviderPublicSupportTaxonomyLocatorV1, ProviderReleaseMatrixLocatorV1 as SubpathProviderReleaseMatrixLocatorV1, ProviderTargetDiscoveryFixtureManifestLocatorV1 as SubpathProviderTargetDiscoveryFixtureManifestLocatorV1, ProviderTargetDiscoveryPointClosureValidationV1, ProviderTargetDiscoveryResultLocatorV1 as SubpathProviderTargetDiscoveryResultLocatorV1, ProviderTargetDiscoveryResultPinV1 as SubpathProviderTargetDiscoveryResultPinV1, ProviderTargetDiscoveryRunnerRunLocatorV1 as SubpathProviderTargetDiscoveryRunnerRunLocatorV1, ValidateProviderTargetDiscoveryPointClosureV1Input } from "@understand-code/durable-object-provider-contracts/provider-target-discovery-point";',
      'import { verifyProviderTargetDiscoveryPointGoldenResourceV1 } from "@understand-code/durable-object-provider-contracts/provider-target-discovery-point-fixtures";',
      'import { buildProviderRealFilesystemConformanceResultRelativePathV1, validateProviderRealFilesystemConformanceResultClosureV1 } from "@understand-code/durable-object-provider-contracts/provider-real-filesystem-conformance-result";',
      'import type { ProviderRealFilesystemConformanceResultClosureValidationV1, ProviderRealFilesystemConformanceResultLocatorV1, ProviderRealFilesystemConformanceResultPinV1, ProviderRealFilesystemConformanceResultRelativePathV1, ValidateProviderRealFilesystemConformanceResultClosureV1Input } from "@understand-code/durable-object-provider-contracts/provider-real-filesystem-conformance-result";',
      'import { verifyProviderRealFilesystemConformanceResultGoldenResourceV1 } from "@understand-code/durable-object-provider-contracts/provider-real-filesystem-conformance-result-fixtures";',
      'import { deriveStoreDurableObjectProviderPolicyDigestV1, validateProviderRuntimeAttestationPointClosureV1 } from "@understand-code/durable-object-provider-contracts/provider-runtime-attestation-point";',
      'import type { ProviderRuntimeAttestationPointClosureValidationV1, StoreDurableObjectProviderPolicyV1, ValidateProviderRuntimeAttestationPointClosureV1Input } from "@understand-code/durable-object-provider-contracts/provider-runtime-attestation-point";',
      'import { ProviderRuntimeAttestationPointGoldenManifestV1Schema, verifyProviderRuntimeAttestationPointGoldenResourceV1 } from "@understand-code/durable-object-provider-contracts/provider-runtime-attestation-point-fixtures";',
      'import type { ProviderRuntimeAttestationPointGoldenManifestV1, ProviderRuntimeAttestationPointInvalidCaseIdV1 } from "@understand-code/durable-object-provider-contracts/provider-runtime-attestation-point-fixtures";',
      'import { buildProviderFeasibilityEvidenceRelativePathV1, validateProviderFeasibilityEvidencePointClosureV1 } from "@understand-code/durable-object-provider-contracts/provider-feasibility-evidence-point";',
      'import type { ProviderFeasibilityEvidencePointClosureValidationV1, ProviderFeasibilityEvidenceRelativePathV1, ValidateProviderFeasibilityEvidencePointClosureV1Input } from "@understand-code/durable-object-provider-contracts/provider-feasibility-evidence-point";',
      'import { ProviderFeasibilityEvidencePointGoldenManifestV1Schema, verifyProviderFeasibilityEvidencePointGoldenResourceV1 } from "@understand-code/durable-object-provider-contracts/provider-feasibility-evidence-point-fixtures";',
      'import type { ProviderFeasibilityEvidencePointGoldenManifestV1, ProviderFeasibilityEvidencePointInvalidCaseIdV1 } from "@understand-code/durable-object-provider-contracts/provider-feasibility-evidence-point-fixtures";',
      'import { diagnoseProviderRegistryEvidenceBindingPointClosureV1, validateProviderRegistryEvidenceBindingPointClosureV1 } from "@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point";',
      'import type { ProviderRegistryEvidenceBindingPointClosureValidationV1, ValidateProviderRegistryEvidenceBindingPointClosureV1Input } from "@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point";',
      'import { ProviderRegistryEvidenceBindingPointGoldenManifestV1Schema, verifyProviderRegistryEvidenceBindingPointGoldenResourceV1 } from "@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point-fixtures";',
      'import type { ProviderRegistryEvidenceBindingPointGoldenManifestV1, ProviderRegistryEvidenceBindingPointInvalidCaseIdV1 } from "@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point-fixtures";',
      'import { verifyProviderRegistryEvidenceBindingTopologyProofResourceV1 } from "@understand-code/durable-object-provider-contracts";',
      'import type { ProviderRegistryEvidenceBindingTopologyProofV1 } from "@understand-code/durable-object-provider-contracts";',
      'import { buildProviderReleaseTargetUniverseRelativePathV1, validateProviderReleaseTargetUniversePointClosureV1 } from "@understand-code/durable-object-provider-contracts/provider-release-target-universe-point";',
      'import type { ProviderReleaseTargetUniversePointClosureValidationV1, ProviderReleaseTargetUniverseRelativePathV1, ValidateProviderReleaseTargetUniversePointClosureV1Input } from "@understand-code/durable-object-provider-contracts/provider-release-target-universe-point";',
      'import { ProviderReleaseTargetUniversePointGoldenManifestV1Schema, verifyProviderReleaseTargetUniversePointGoldenResourceV1 } from "@understand-code/durable-object-provider-contracts/provider-release-target-universe-point-fixtures";',
      'import type { ProviderReleaseTargetUniversePointExecutionCounterV1, ProviderReleaseTargetUniversePointGoldenManifestV1, ProviderReleaseTargetUniversePointInvalidCaseIdV1 } from "@understand-code/durable-object-provider-contracts/provider-release-target-universe-point-fixtures";',
      'const slug = DurableObjectIdentityProviderSlugV1Schema.parse("native-fs");',
      'const id = createDurableObjectIdentityProviderIdV1(slug);',
      'DurableObjectIdentityProviderIdV1Schema.parse(id);',
      'const reason: ProviderCapabilityFailureReasonV1 = "attestation_invalid";',
      'const providerError: ProviderUnavailableToolErrorV1 = createProviderUnavailableToolErrorV1(reason);',
      'declare const rawKeyDigest: Ed25519PublicKeyDigestV1;',
      'declare const contentDigest: ContentDigestV1;',
      'declare const resourceHost: ProviderStrictEd25519FixedResourceHostV1;',
      'declare const bootstrapValidation: ProviderBootstrapTrustBundleStructureValidationV1;',
      'declare const goldenValidation: ProviderBootstrapTrustGoldenManifestValidationV1;',
      'declare const invalidValidation: ProviderBootstrapTrustInvalidManifestValidationV1;',
      'declare const rootHistoryValidation: ProviderRegistryRootMetadataHistoryValidationV1;',
      'declare const registryHistoryInput: ValidateProviderRegistryManifestHistoryV1Input;',
      'declare const registryGoldenManifest: ProviderRegistryManifestHistoryGoldenManifestV1;',
      'declare const registryInvalidBytes: Uint8Array;',
      'declare const realFilesystemSourceInput: ValidateProviderRealFilesystemSourceClosureV1Input;',
      'declare const realFilesystemGoldenManifest: ProviderRealFilesystemSourceGoldenManifestV1;',
      'declare const targetDiscoveryPointInput: ValidateProviderTargetDiscoveryPointClosureV1Input;',
      'declare const targetDiscoveryResultPin: SubpathProviderTargetDiscoveryResultPinV1;',
      'declare const targetDiscoveryTaxonomyLocator: SubpathProviderPublicSupportTaxonomyLocatorV1;',
      'declare const targetDiscoveryMatrixLocator: SubpathProviderReleaseMatrixLocatorV1;',
      'declare const targetDiscoveryFixtureLocator: SubpathProviderTargetDiscoveryFixtureManifestLocatorV1;',
      'declare const targetDiscoveryRunnerLocator: SubpathProviderTargetDiscoveryRunnerRunLocatorV1;',
      'declare const targetDiscoveryResultLocator: SubpathProviderTargetDiscoveryResultLocatorV1;',
      'declare const conformanceResultInput: ValidateProviderRealFilesystemConformanceResultClosureV1Input;',
      'declare const conformanceResultLocator: ProviderRealFilesystemConformanceResultLocatorV1;',
      'declare const conformanceResultPin: ProviderRealFilesystemConformanceResultPinV1;',
      'declare const runtimeAttestationPointInput: ValidateProviderRuntimeAttestationPointClosureV1Input;',
      'declare const runtimeAttestationPointClosure: ProviderRuntimeAttestationPointClosureValidationV1;',
      'declare const runtimeProviderPolicy: StoreDurableObjectProviderPolicyV1;',
      'declare const runtimeFixtureManifest: unknown;',
      'declare const feasibilityEvidencePointInput: ValidateProviderFeasibilityEvidencePointClosureV1Input;',
      'declare const feasibilityEvidencePointClosure: ProviderFeasibilityEvidencePointClosureValidationV1;',
      'declare const feasibilityEvidencePointFixtureManifest: unknown;',
      'declare const registryEvidenceBindingPointInput: ValidateProviderRegistryEvidenceBindingPointClosureV1Input;',
      'declare const registryEvidenceBindingPointClosure: ProviderRegistryEvidenceBindingPointClosureValidationV1;',
      'declare const registryEvidenceBindingPointFixtureManifest: unknown;',
      'declare const registryEvidenceBindingTopologyProofBytes: Uint8Array;',
      'declare const releaseTargetUniversePointInput: ValidateProviderReleaseTargetUniversePointClosureV1Input;',
      'declare const releaseTargetUniversePointClosure: ProviderReleaseTargetUniversePointClosureValidationV1;',
      'declare const releaseTargetUniversePointFixtureManifest: unknown;',
      'declare const releaseTargetUniversePointExecutionCounter: ProviderReleaseTargetUniversePointExecutionCounterV1;',
      'const registryGoldenParsed = ProviderRegistryManifestHistoryGoldenManifestV1Schema.parse(registryGoldenManifest);',
      'const registryHistoryValidation: Promise<ProviderRegistryManifestHistoryValidationV1> = validateProviderRegistryManifestHistoryV1(registryHistoryInput);',
      'const registryInvalidManifest: ProviderRegistryManifestHistoryInvalidManifestV1 = ProviderRegistryManifestHistoryInvalidManifestV1Schema.parse(verifyProviderRegistryManifestHistoryInvalidResourceV1(registryInvalidBytes));',
      'const registryMaterializedRequestDigest: ContentDigestV1 = registryInvalidManifest.cases[0]!.expected.materializedRequestSemanticDigest;',
      'const realFilesystemGoldenParsed = ProviderRealFilesystemSourceGoldenManifestV1Schema.parse(realFilesystemGoldenManifest);',
      'const realFilesystemSourceValidation: Promise<ProviderRealFilesystemSourceClosureValidationV1> = validateProviderRealFilesystemSourceClosureV1(realFilesystemSourceInput);',
      'const targetDiscoveryPointValidation: Promise<ProviderTargetDiscoveryPointClosureValidationV1> = validateProviderTargetDiscoveryPointClosureV1(targetDiscoveryPointInput);',
      'const conformanceResultValidation: Promise<ProviderRealFilesystemConformanceResultClosureValidationV1> = validateProviderRealFilesystemConformanceResultClosureV1(conformanceResultInput);',
      'const conformanceResultPath: ProviderRealFilesystemConformanceResultRelativePathV1 = buildProviderRealFilesystemConformanceResultRelativePathV1(conformanceResultLocator);',
      'const conformanceResultLocatorFromPin: ProviderRealFilesystemConformanceResultLocatorV1 = conformanceResultPin;',
      'const runtimeAttestationPointValidation: Promise<ProviderRuntimeAttestationPointClosureValidationV1> = validateProviderRuntimeAttestationPointClosureV1(runtimeAttestationPointInput);',
      'const runtimeProviderPolicyDigest: ContentDigestV1 = deriveStoreDurableObjectProviderPolicyDigestV1(runtimeProviderPolicy);',
      'const runtimeFixtureParsed: ProviderRuntimeAttestationPointGoldenManifestV1 = ProviderRuntimeAttestationPointGoldenManifestV1Schema.parse(runtimeFixtureManifest);',
      'const runtimeInvalidCaseId: ProviderRuntimeAttestationPointInvalidCaseIdV1 = "inner-input-extra-field";',
      '// @ts-expect-error Runtime point invalid IDs are an exact closed union',
      'const unknownRuntimeInvalidCaseId: ProviderRuntimeAttestationPointInvalidCaseIdV1 = "runtime-attestation-point-unknown";',
      'const runtimeAttestationAuthority: "none_provider_runtime_attestation_structure_only" = runtimeAttestationPointClosure.authority;',
      'const feasibilityEvidencePointValidation: Promise<ProviderFeasibilityEvidencePointClosureValidationV1> = validateProviderFeasibilityEvidencePointClosureV1(feasibilityEvidencePointInput);',
      'const feasibilityEvidencePointPath: ProviderFeasibilityEvidenceRelativePathV1 = buildProviderFeasibilityEvidenceRelativePathV1(feasibilityEvidencePointClosure.providerFeasibilityEvidencePin);',
      'const feasibilityEvidencePointFixtureParsed: ProviderFeasibilityEvidencePointGoldenManifestV1 = ProviderFeasibilityEvidencePointGoldenManifestV1Schema.parse(feasibilityEvidencePointFixtureManifest);',
      'const feasibilityEvidencePointInvalidCaseId: ProviderFeasibilityEvidencePointInvalidCaseIdV1 = "runtime-inner-input-extra-field";',
      '// @ts-expect-error Evidence point invalid IDs are an exact closed union',
      'const unknownFeasibilityEvidencePointInvalidCaseId: ProviderFeasibilityEvidencePointInvalidCaseIdV1 = "provider-feasibility-evidence-point-unknown";',
      'const feasibilityEvidencePointAuthority: "none_provider_feasibility_evidence_structure_only" = feasibilityEvidencePointClosure.authority;',
      'const registryEvidenceBindingPointValidation: Promise<ProviderRegistryEvidenceBindingPointClosureValidationV1> = validateProviderRegistryEvidenceBindingPointClosureV1(registryEvidenceBindingPointInput);',
      'const registryEvidenceBindingPointDiagnostic = diagnoseProviderRegistryEvidenceBindingPointClosureV1(registryEvidenceBindingPointInput);',
      'const registryEvidenceBindingPointFixtureParsed: ProviderRegistryEvidenceBindingPointGoldenManifestV1 = ProviderRegistryEvidenceBindingPointGoldenManifestV1Schema.parse(registryEvidenceBindingPointFixtureManifest);',
      'const registryEvidenceBindingPointInvalidCaseId: ProviderRegistryEvidenceBindingPointInvalidCaseIdV1 = "evidence-runtime-inner-input-extra-field";',
      '// @ts-expect-error Registry/Evidence binding invalid IDs are an exact closed union',
      'const unknownRegistryEvidenceBindingPointInvalidCaseId: ProviderRegistryEvidenceBindingPointInvalidCaseIdV1 = "registry-not-a-real-case";',
      'const registryEvidenceBindingPointAuthority: "none_registry_entry_evidence_binding_structure_only" = registryEvidenceBindingPointClosure.authority;',
      'const registryEvidenceBindingTopologyProof: ProviderRegistryEvidenceBindingTopologyProofV1 = verifyProviderRegistryEvidenceBindingTopologyProofResourceV1(registryEvidenceBindingTopologyProofBytes);',
      'const releaseTargetUniversePointValidation: Promise<ProviderReleaseTargetUniversePointClosureValidationV1> = validateProviderReleaseTargetUniversePointClosureV1(releaseTargetUniversePointInput);',
      'const releaseTargetUniversePointPath: ProviderReleaseTargetUniverseRelativePathV1 = buildProviderReleaseTargetUniverseRelativePathV1(releaseTargetUniversePointClosure.releaseTargetUniverse);',
      'const releaseTargetUniversePointFixtureParsed: ProviderReleaseTargetUniversePointGoldenManifestV1 = ProviderReleaseTargetUniversePointGoldenManifestV1Schema.parse(releaseTargetUniversePointFixtureManifest);',
      'const releaseTargetUniversePointInvalidCaseId: ProviderReleaseTargetUniversePointInvalidCaseIdV1 = "discovery-input-extra-field";',
      '// @ts-expect-error Release target Universe invalid IDs are an exact closed union',
      'const unknownReleaseTargetUniversePointInvalidCaseId: ProviderReleaseTargetUniversePointInvalidCaseIdV1 = "provider-release-target-universe-point-unknown";',
      'const releaseTargetUniversePointAuthority: "none_release_target_universe_structure_only" = releaseTargetUniversePointClosure.authority;',
      'const rootTargetDiscoveryResultPin: RootProviderTargetDiscoveryResultPinV1 = targetDiscoveryResultPin;',
      'const rootTargetDiscoveryTaxonomyLocator: RootProviderPublicSupportTaxonomyLocatorV1 = targetDiscoveryTaxonomyLocator;',
      'const rootTargetDiscoveryMatrixLocator: RootProviderReleaseMatrixLocatorV1 = targetDiscoveryMatrixLocator;',
      'const rootTargetDiscoveryFixtureLocator: RootProviderTargetDiscoveryFixtureManifestLocatorV1 = targetDiscoveryFixtureLocator;',
      'const rootTargetDiscoveryRunnerLocator: RootProviderTargetDiscoveryRunnerRunLocatorV1 = targetDiscoveryRunnerLocator;',
      'const rootTargetDiscoveryResultLocator: RootProviderTargetDiscoveryResultLocatorV1 = targetDiscoveryResultLocator;',
      'void verifyProviderTargetDiscoveryPointGoldenResourceV1;',
      'void verifyProviderRealFilesystemConformanceResultGoldenResourceV1;',
      'void verifyProviderRuntimeAttestationPointGoldenResourceV1;',
      'void verifyProviderFeasibilityEvidencePointGoldenResourceV1;',
      'void verifyProviderRegistryEvidenceBindingPointGoldenResourceV1;',
      'void verifyProviderReleaseTargetUniversePointGoldenResourceV1;',
      'const filenameKey: StoreFilenameKeyV1 = StoreFilenameKeyV1Schema.parse("id-c4");',
      'const rootMetadataPath: ProviderRegistryRootMetadataRelativePathV1 = buildProviderRegistryRootMetadataRelativePathV1({ locatorProfile: "installation_provider_registry_root_metadata_v1", rootGeneration: 1, rootKeyId: "0000000000000000000000" });',
      'void rawKeyDigest;',
      'void resourceHost;',
      'const structureAuthority: "none_structure_only" = bootstrapValidation.authority;',
      'const fixtureAuthority: "none_structure_only" = goldenValidation.authority;',
      'const invalidAuthority: "none_rejection_only" = invalidValidation.authority;',
      'const rootHistoryAuthority: "none_structure_and_history_only" = rootHistoryValidation.authority;',
      'void structureAuthority;',
      'void fixtureAuthority;',
      'void invalidAuthority;',
      'void rootHistoryAuthority;',
      'void registryGoldenParsed;',
      'void registryHistoryValidation;',
      'void registryInvalidManifest;',
      'void registryMaterializedRequestDigest;',
      'void realFilesystemGoldenParsed;',
      'void realFilesystemSourceValidation;',
      'void targetDiscoveryPointValidation;',
      'void conformanceResultValidation;',
      'void conformanceResultPath;',
      'void conformanceResultLocatorFromPin;',
      'void runtimeAttestationPointValidation;',
      'void runtimeProviderPolicyDigest;',
      'void runtimeFixtureParsed;',
      'void runtimeInvalidCaseId;',
      'void unknownRuntimeInvalidCaseId;',
      'void runtimeAttestationAuthority;',
      'void feasibilityEvidencePointValidation;',
      'void feasibilityEvidencePointPath;',
      'void feasibilityEvidencePointFixtureParsed;',
      'void feasibilityEvidencePointInvalidCaseId;',
      'void unknownFeasibilityEvidencePointInvalidCaseId;',
      'void feasibilityEvidencePointAuthority;',
      'void registryEvidenceBindingPointValidation;',
      'void registryEvidenceBindingPointDiagnostic;',
      'void registryEvidenceBindingPointFixtureParsed;',
      'void registryEvidenceBindingPointInvalidCaseId;',
      'void unknownRegistryEvidenceBindingPointInvalidCaseId;',
      'void registryEvidenceBindingPointAuthority;',
      'void registryEvidenceBindingTopologyProof;',
      'void releaseTargetUniversePointValidation;',
      'void releaseTargetUniversePointPath;',
      'void releaseTargetUniversePointFixtureParsed;',
      'void releaseTargetUniversePointInvalidCaseId;',
      'void unknownReleaseTargetUniversePointInvalidCaseId;',
      'void releaseTargetUniversePointAuthority;',
      'void releaseTargetUniversePointExecutionCounter;',
      'void rootTargetDiscoveryResultPin;',
      'void rootTargetDiscoveryTaxonomyLocator;',
      'void rootTargetDiscoveryMatrixLocator;',
      'void rootTargetDiscoveryFixtureLocator;',
      'void rootTargetDiscoveryRunnerLocator;',
      'void rootTargetDiscoveryResultLocator;',
      'void filenameKey;',
      'void rootMetadataPath;',
      'void providerError;',
      '// @ts-expect-error a raw string has not passed the branded slug schema',
      'createDurableObjectIdentityProviderIdV1("native-fs");',
      '// @ts-expect-error provider failure reasons are closed',
      'createProviderUnavailableToolErrorV1("network_error");',
      '// @ts-expect-error raw-key and content digest brands are independent',
      'const wrongDigest: Ed25519PublicKeyDigestV1 = contentDigest;',
      'void wrongDigest;',
    ].join("\n"),
    "utf8",
  );
  const packedStrictEd25519ManifestText = await readFile(
    join(
      installedRoot,
      "provider",
      "ed25519-strict-host-conformance-v1.json",
    ),
    "utf8",
  );
  const packedBootstrapTrustBundleText = await readFile(
    join(
      installedRoot,
      "provider",
      "bootstrap-trust-bundle-v1.json",
    ),
    "utf8",
  );
  const packedBootstrapTrustGoldenText = await readFile(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "golden",
      "provider-bootstrap-structure-crypto-v1.json",
    ),
    "utf8",
  );
  const packedBootstrapTrustInvalidText = await readFile(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "invalid",
      "provider-bootstrap-structure-crypto-v1.json",
    ),
    "utf8",
  );
  const packedRootHistoryGoldenText = await readFile(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "golden",
      "provider-registry-root-history-v1.json",
    ),
    "utf8",
  );
  const packedRootHistoryInvalidText = await readFile(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "invalid",
      "provider-registry-root-history-v1.json",
    ),
    "utf8",
  );
  const packedRegistryManifestGoldenText = await readFile(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "golden",
      "provider-registry-entry-manifest-history-v1.json",
    ),
    "utf8",
  );
  const packedRegistryManifestInvalidText = await readFile(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "invalid",
      "provider-registry-entry-manifest-history-v1.json",
    ),
    "utf8",
  );
  const packedRealFilesystemSourceGoldenText = await readFile(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "golden",
      "provider-real-filesystem-source-v1.json",
    ),
    "utf8",
  );
  const packedRealFilesystemSourceInvalidText = await readFile(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "invalid",
      "provider-real-filesystem-source-v1.json",
    ),
    "utf8",
  );
  const packedTargetDiscoveryPointGoldenText = await readFile(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "golden",
      "provider-target-discovery-point-v1.json",
    ),
    "utf8",
  );
  const packedTargetDiscoveryPointInvalidText = await readFile(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "invalid",
      "provider-target-discovery-point-v1.json",
    ),
    "utf8",
  );
  const packedRealFilesystemConformanceResultGoldenText = await readFile(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "golden",
      "provider-real-filesystem-conformance-result-v1.json",
    ),
    "utf8",
  );
  const packedRealFilesystemConformanceResultInvalidText = await readFile(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "invalid",
      "provider-real-filesystem-conformance-result-v1.json",
    ),
    "utf8",
  );
  const packedProviderRuntimeAttestationPointGoldenText = await readFile(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "golden",
      "provider-runtime-attestation-point-v1.json",
    ),
    "utf8",
  );
  const packedProviderRuntimeAttestationPointInvalidText = await readFile(
    join(
      installedRoot,
      "fixtures",
      "v1",
      "invalid",
      "provider-runtime-attestation-point-v1.json",
    ),
    "utf8",
  );
  const packedProviderFeasibilityEvidencePointGoldenText = await readFile(
    installedProviderFeasibilityEvidencePointGoldenPath,
    "utf8",
  );
  const packedProviderFeasibilityEvidencePointInvalidText = await readFile(
    installedProviderFeasibilityEvidencePointInvalidPath,
    "utf8",
  );
  const packedProviderRegistryEvidenceBindingPointGoldenText = await readFile(
    installedProviderRegistryEvidenceBindingPointGoldenPath,
    "utf8",
  );
  const packedProviderRegistryEvidenceBindingTopologyProofText = await readFile(
    installedProviderRegistryEvidenceBindingTopologyProofPath,
    "utf8",
  );
  const packedProviderReleaseTargetUniversePointGoldenText = await readFile(
    installedProviderReleaseTargetUniversePointGoldenPath,
    "utf8",
  );
  const packedProviderReleaseTargetUniversePointInvalidText = await readFile(
    installedProviderReleaseTargetUniversePointInvalidPath,
    "utf8",
  );
  await writeFile(
    join(consumerRoot, "browser-entry.js"),
    [
      'import { ProviderUnavailableToolErrorV1Schema, createProviderUnavailableToolErrorV1 } from "@understand-code/durable-object-provider-contracts/provider-error";',
      'import { PROVIDER_BOOTSTRAP_TRUST_BUNDLE_CONTENT_DIGEST_V1, PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_CASE_IDS_V1, validateProviderBootstrapTrustBundleStructureV1, validateProviderFeasibilityEvidencePointClosureV1 as rootValidateProviderFeasibilityEvidencePointClosureV1, verifyProviderBootstrapTrustGoldenManifestResourceV1, verifyProviderBootstrapTrustInvalidManifestResourceV1, verifyProviderFeasibilityEvidencePointGoldenResourceV1 as rootVerifyProviderFeasibilityEvidencePointGoldenResourceV1, verifyProviderFeasibilityEvidencePointPositiveVectorsV1 as rootVerifyProviderFeasibilityEvidencePointPositiveVectorsV1, verifyProviderFeasibilityEvidencePointInvalidResourceV1 as rootVerifyProviderFeasibilityEvidencePointInvalidResourceV1, verifyProviderRealFilesystemSourceGoldenResourceV1, verifyProviderRealFilesystemSourceInvalidResourceV1 } from "@understand-code/durable-object-provider-contracts";',
      'import { PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1, PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1, PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_DOMAIN_V1, PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1, PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_CASE_IDS_V1, PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_BYTE_LENGTH_V1, PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_SHA256_HEX_V1, PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_CONTENT_DIGEST_V1, PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_DOMAIN_V1, PROVIDER_REGISTRY_MANIFEST_INVALID_MATERIALIZED_REQUEST_SEMANTIC_DOMAIN_V1, PROVIDER_REGISTRY_ROOT_METADATA_LOCATOR_PROFILE_V1, ProviderRegistryManifestHistoryValidationError, buildProviderRegistryRootMetadataRelativePathV1, validateProviderRegistryManifestHistoryV1, validateProviderRegistryRootMetadataHistoryV1, verifyProviderRegistryManifestHistoryGoldenResourceV1, verifyProviderRegistryManifestHistoryInvalidResourceV1, verifyProviderRegistryRootHistoryGoldenManifestResourceV1, verifyProviderRegistryRootHistoryInvalidManifestResourceV1 } from "@understand-code/durable-object-provider-contracts/provider-registry";',
      'import { validateProviderRealFilesystemSourceClosureV1 } from "@understand-code/durable-object-provider-contracts/provider-real-filesystem-source";',
      'import { buildProviderPublicSupportTaxonomyRelativePathV1, buildProviderReleaseMatrixRelativePathV1, buildProviderTargetDiscoveryFixtureManifestRelativePathV1, buildProviderTargetDiscoveryResultRelativePathV1, buildProviderTargetDiscoveryRunnerRunRelativePathV1, validateProviderTargetDiscoveryPointClosureV1 } from "@understand-code/durable-object-provider-contracts/provider-target-discovery-point";',
      'import { PROVIDER_TARGET_DISCOVERY_POINT_INVALID_CASE_IDS_V1, verifyProviderTargetDiscoveryPointGoldenResourceV1, verifyProviderTargetDiscoveryPointInvalidResourceV1 } from "@understand-code/durable-object-provider-contracts/provider-target-discovery-point-fixtures";',
      'import { buildProviderRealFilesystemConformanceResultRelativePathV1, validateProviderRealFilesystemConformanceResultClosureV1 } from "@understand-code/durable-object-provider-contracts/provider-real-filesystem-conformance-result";',
      'import { PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_CASE_IDS_V1, executeProviderRealFilesystemConformanceResultInvalidCaseV1, verifyProviderRealFilesystemConformanceResultGoldenResourceV1, verifyProviderRealFilesystemConformanceResultInvalidResourceV1 } from "@understand-code/durable-object-provider-contracts/provider-real-filesystem-conformance-result-fixtures";',
      'import { validateProviderRuntimeAttestationPointClosureV1 } from "@understand-code/durable-object-provider-contracts/provider-runtime-attestation-point";',
      'import { PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_CASE_IDS_V1, PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1, executeProviderRuntimeAttestationPointInvalidCaseV1, materializeProviderRuntimeAttestationPointInvalidRequestWitnessV1, verifyProviderRuntimeAttestationPointGoldenResourceV1, verifyProviderRuntimeAttestationPointInvalidResourceV1 } from "@understand-code/durable-object-provider-contracts/provider-runtime-attestation-point-fixtures";',
      'import { validateProviderFeasibilityEvidencePointClosureV1 } from "@understand-code/durable-object-provider-contracts/provider-feasibility-evidence-point";',
      'import { PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_CASE_IDS_V1, PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1, executeProviderFeasibilityEvidencePointInvalidCaseV1, materializeProviderFeasibilityEvidencePointInvalidRequestWitnessV1, verifyProviderFeasibilityEvidencePointGoldenResourceV1, verifyProviderFeasibilityEvidencePointPositiveVectorsV1, verifyProviderFeasibilityEvidencePointInvalidResourceV1 } from "@understand-code/durable-object-provider-contracts/provider-feasibility-evidence-point-fixtures";',
      'import { ProviderRegistryEvidenceBindingPointClosureValidationError, diagnoseProviderRegistryEvidenceBindingPointClosureV1, validateProviderRegistryEvidenceBindingPointClosureV1 } from "@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point";',
      'import { PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1, PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1, PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_CASE_IDS_V1, PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1, PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_RESOURCE_SHA256_HEX_V1, ProviderRegistryEvidenceBindingPointFixtureError, executeProviderRegistryEvidenceBindingPointInvalidCaseV1, materializeProviderRegistryEvidenceBindingPointGoldenRequestV1, materializeProviderRegistryEvidenceBindingPointInvalidCaseV1, projectProviderRegistryEvidenceBindingPointClosureSnapshotV1, verifyProviderRegistryEvidenceBindingPointGoldenResourceV1, verifyProviderRegistryEvidenceBindingPointInvalidResourceV1 } from "@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point-fixtures";',
      'import { ProviderRegistryEvidenceBindingPointClosureValidationError as RootProviderRegistryEvidenceBindingPointClosureValidationError, ProviderRegistryEvidenceBindingPointFixtureError as RootProviderRegistryEvidenceBindingPointFixtureError, diagnoseProviderRegistryEvidenceBindingPointClosureV1 as rootDiagnoseProviderRegistryEvidenceBindingPointClosureV1, executeProviderRegistryEvidenceBindingPointInvalidCaseV1 as rootExecuteProviderRegistryEvidenceBindingPointInvalidCaseV1, materializeProviderRegistryEvidenceBindingPointGoldenRequestV1 as rootMaterializeProviderRegistryEvidenceBindingPointGoldenRequestV1, materializeProviderRegistryEvidenceBindingPointInvalidCaseV1 as rootMaterializeProviderRegistryEvidenceBindingPointInvalidCaseV1, projectProviderRegistryEvidenceBindingPointClosureSnapshotV1 as rootProjectProviderRegistryEvidenceBindingPointClosureSnapshotV1, validateProviderRegistryEvidenceBindingPointClosureV1 as rootValidateProviderRegistryEvidenceBindingPointClosureV1, verifyProviderRegistryEvidenceBindingPointGoldenResourceV1 as rootVerifyProviderRegistryEvidenceBindingPointGoldenResourceV1, verifyProviderRegistryEvidenceBindingPointInvalidResourceV1 as rootVerifyProviderRegistryEvidenceBindingPointInvalidResourceV1, verifyProviderRegistryEvidenceBindingTopologyProofResourceV1 } from "@understand-code/durable-object-provider-contracts";',
      'import { ProviderReleaseTargetUniversePointClosureValidationError, buildProviderReleaseTargetUniverseRelativePathV1, diagnoseProviderReleaseTargetUniversePointClosureV1, validateProviderReleaseTargetUniversePointClosureV1 } from "@understand-code/durable-object-provider-contracts/provider-release-target-universe-point";',
      'import { PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1, PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1, PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_CASE_IDS_V1, PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1, PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1, PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_RESOURCE_SHA256_HEX_V1, ProviderReleaseTargetUniversePointFixtureError, executeProviderReleaseTargetUniversePointInvalidCaseV1, materializeProviderReleaseTargetUniversePointInvalidCaseWitnessV1, verifyProviderReleaseTargetUniversePointGoldenResourceV1, verifyProviderReleaseTargetUniversePointInvalidResourceV1, verifyProviderReleaseTargetUniversePointPositiveVectorsV1 } from "@understand-code/durable-object-provider-contracts/provider-release-target-universe-point-fixtures";',
      'import { ProviderReleaseTargetUniversePointClosureValidationError as RootProviderReleaseTargetUniversePointClosureValidationError, buildProviderReleaseTargetUniverseRelativePathV1 as rootBuildProviderReleaseTargetUniverseRelativePathV1, diagnoseProviderReleaseTargetUniversePointClosureV1 as rootDiagnoseProviderReleaseTargetUniversePointClosureV1, executeProviderReleaseTargetUniversePointInvalidCaseV1 as rootExecuteProviderReleaseTargetUniversePointInvalidCaseV1, materializeProviderReleaseTargetUniversePointInvalidCaseWitnessV1 as rootMaterializeProviderReleaseTargetUniversePointInvalidCaseWitnessV1, ProviderReleaseTargetUniversePointFixtureError as RootProviderReleaseTargetUniversePointFixtureError, validateProviderReleaseTargetUniversePointClosureV1 as rootValidateProviderReleaseTargetUniversePointClosureV1, verifyProviderReleaseTargetUniversePointGoldenResourceV1 as rootVerifyProviderReleaseTargetUniversePointGoldenResourceV1, verifyProviderReleaseTargetUniversePointInvalidResourceV1 as rootVerifyProviderReleaseTargetUniversePointInvalidResourceV1, verifyProviderReleaseTargetUniversePointPositiveVectorsV1 as rootVerifyProviderReleaseTargetUniversePointPositiveVectorsV1 } from "@understand-code/durable-object-provider-contracts";',
      'import { canonicalizeJcsSafeIntegerUtf8V1 } from "@understand-code/durable-object-provider-contracts/jcs";',
      'import { STRICT_ED25519_VERIFICATION_PROFILE_V1, validatePrimeSubgroupPoint, verifyRawEd25519 } from "@understand-code/durable-object-provider-contracts/strict-ed25519";',
      'import { PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1, PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1, attestProviderStrictEd25519CryptoHostV1, getProviderStrictEd25519CryptoCapabilityBytesV1 } from "@understand-code/durable-object-provider-contracts/strict-ed25519-conformance";',
      ...explicitSpecifiers.map(
        (specifier, index) =>
          `import * as providerContractBrowserModule${index} from ${JSON.stringify(specifier)};`,
      ),
      `const manifestResourceBytes = new TextEncoder().encode(${JSON.stringify(packedStrictEd25519ManifestText)});`,
      `const bundleResourceBytes = new TextEncoder().encode(${JSON.stringify(packedBootstrapTrustBundleText)});`,
      `const bootstrapTrustGoldenBytes = new TextEncoder().encode(${JSON.stringify(packedBootstrapTrustGoldenText)});`,
      `const bootstrapTrustInvalidBytes = new TextEncoder().encode(${JSON.stringify(packedBootstrapTrustInvalidText)});`,
      `const rootHistoryGoldenBytes = new TextEncoder().encode(${JSON.stringify(packedRootHistoryGoldenText)});`,
      `const rootHistoryInvalidBytes = new TextEncoder().encode(${JSON.stringify(packedRootHistoryInvalidText)});`,
      `const registryManifestGoldenBytes = new TextEncoder().encode(${JSON.stringify(packedRegistryManifestGoldenText)});`,
      `const registryManifestInvalidBytes = new TextEncoder().encode(${JSON.stringify(packedRegistryManifestInvalidText)});`,
      `const realFilesystemSourceGoldenBytes = new TextEncoder().encode(${JSON.stringify(packedRealFilesystemSourceGoldenText)});`,
      `const realFilesystemSourceInvalidBytes = new TextEncoder().encode(${JSON.stringify(packedRealFilesystemSourceInvalidText)});`,
      `const targetDiscoveryPointGoldenBytes = new TextEncoder().encode(${JSON.stringify(packedTargetDiscoveryPointGoldenText)});`,
      `const targetDiscoveryPointInvalidBytes = new TextEncoder().encode(${JSON.stringify(packedTargetDiscoveryPointInvalidText)});`,
      `const realFilesystemConformanceResultGoldenBytes = new TextEncoder().encode(${JSON.stringify(packedRealFilesystemConformanceResultGoldenText)});`,
      `const realFilesystemConformanceResultInvalidBytes = new TextEncoder().encode(${JSON.stringify(packedRealFilesystemConformanceResultInvalidText)});`,
      `const providerRuntimeAttestationPointGoldenBytes = new TextEncoder().encode(${JSON.stringify(packedProviderRuntimeAttestationPointGoldenText)});`,
      `const providerRuntimeAttestationPointInvalidBytes = new TextEncoder().encode(${JSON.stringify(packedProviderRuntimeAttestationPointInvalidText)});`,
      `const providerFeasibilityEvidencePointGoldenBytes = new TextEncoder().encode(${JSON.stringify(packedProviderFeasibilityEvidencePointGoldenText)});`,
      `const providerFeasibilityEvidencePointInvalidBytes = new TextEncoder().encode(${JSON.stringify(packedProviderFeasibilityEvidencePointInvalidText)});`,
      `const providerRegistryEvidenceBindingPointGoldenBytes = new TextEncoder().encode(${JSON.stringify(packedProviderRegistryEvidenceBindingPointGoldenText)});`,
      `const providerRegistryEvidenceBindingPointInvalidBytes = globalThis[${JSON.stringify(C09_BROWSER_INVALID_BYTES_GLOBAL_V1)}];`,
      'if (!(providerRegistryEvidenceBindingPointInvalidBytes instanceof Uint8Array)) throw new Error("browser Registry/Evidence binding invalid bytes were not injected");',
      `delete globalThis[${JSON.stringify(C09_BROWSER_INVALID_BYTES_GLOBAL_V1)}];`,
      `const providerRegistryEvidenceBindingTopologyProofBytes = new TextEncoder().encode(${JSON.stringify(packedProviderRegistryEvidenceBindingTopologyProofText)});`,
      `const providerReleaseTargetUniversePointGoldenBytes = new TextEncoder().encode(${JSON.stringify(packedProviderReleaseTargetUniversePointGoldenText)});`,
      `const providerReleaseTargetUniversePointInvalidBytes = new TextEncoder().encode(${JSON.stringify(packedProviderReleaseTargetUniversePointInvalidText)});`,
      'let pointCalls = 0;',
      'let verifyCalls = 0;',
      'let nextSignatureMutation;',
      'const strictHost = {',
      '  verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,',
      '  validatePrimeSubgroupPoint(point) { pointCalls += 1; return validatePrimeSubgroupPoint(point); },',
      '  verifyRawEd25519(publicKey, message, signature) { verifyCalls += 1; const mutation = nextSignatureMutation; nextSignatureMutation = undefined; mutation?.(); return verifyRawEd25519(publicKey, message, signature); },',
      '};',
      'const universeExecutionCounter = Object.freeze({ pointAdmissionCount() { return pointCalls; }, signatureVerificationCount() { return verifyCalls; }, mutateDuringNextSignature(mutation) { if (nextSignatureMutation !== undefined) throw new Error("a browser Universe signature-time mutation is already registered"); nextSignatureMutation = mutation; } });',
      'const resourceHost = {',
      '  readFixedSignedPackageResource(path, maxBytes) {',
      '    if (path !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 || maxBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1 || manifestResourceBytes.byteLength > maxBytes) throw new Error("invalid fixed resource request");',
      '    return manifestResourceBytes;',
      '  },',
      '};',
      'const strictCapability = await attestProviderStrictEd25519CryptoHostV1({ host: strictHost, resourceHost });',
      'const lowerHex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");',
      'const browserSemanticDigest = async (domain, value) => `sha256:${lowerHex(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", canonicalizeJcsSafeIntegerUtf8V1([domain, value]))))}`;',
      'const bootstrapValidation = await validateProviderBootstrapTrustBundleStructureV1({ bundleEnvelopeBytes: bundleResourceBytes, strictManifestEnvelopeBytes: manifestResourceBytes, strictCryptoCapability: strictCapability });',
      'if (bootstrapValidation.bundleEnvelope.contentDigest !== PROVIDER_BOOTSTRAP_TRUST_BUNDLE_CONTENT_DIGEST_V1) throw new Error("browser bootstrap trust digest mismatch");',
      'const bootstrapGoldenValidation = await verifyProviderBootstrapTrustGoldenManifestResourceV1(bootstrapTrustGoldenBytes, strictCapability);',
      'if (bootstrapGoldenValidation.authority !== "none_structure_only" || bootstrapGoldenValidation.manifest.vectors.recoveryKeyIds.length !== 3) throw new Error("browser bootstrap golden mismatch");',
      'const bootstrapInvalidValidation = verifyProviderBootstrapTrustInvalidManifestResourceV1(bootstrapTrustInvalidBytes);',
      'if (bootstrapInvalidValidation.authority !== "none_rejection_only" || bootstrapInvalidValidation.manifest.cases.length !== 51) throw new Error("browser bootstrap invalid manifest mismatch");',
      'if (bootstrapInvalidValidation.manifest.cases[0].witnesses[0].recipe.dialect !== "provider_bootstrap_invalid_recipe_v1" || bootstrapInvalidValidation.manifest.cases[50].witnesses[0].recipe.deterministicSeed.seedHex !== "4444444444444444444444444444444444444444444444444444444444444444") throw new Error("browser bootstrap invalid recipes mismatch");',
      'if (bootstrapInvalidValidation.manifest.cases[41].witnesses[5].recipe.operands[1] !== "alternate_root_key_id=661166fa4208cb1d325f30") throw new Error("browser prefix-mismatch recipe is not self-contained");',
      'const bootstrapPointCalls = pointCalls;',
      'const bootstrapVerifyCalls = verifyCalls;',
      'const rootHistoryGolden = verifyProviderRegistryRootHistoryGoldenManifestResourceV1(rootHistoryGoldenBytes);',
      'const rootHistoryInvalid = verifyProviderRegistryRootHistoryInvalidManifestResourceV1(rootHistoryInvalidBytes);',
      'if (rootHistoryGolden.fixtureAuthority !== "none_structure_and_history_only" || rootHistoryGolden.rootMetadataHistory.length !== 3) throw new Error("browser root history golden mismatch");',
      'if (rootHistoryInvalid.fixtureAuthority !== "none_rejection_only" || rootHistoryInvalid.cases.length !== 31) throw new Error("browser root history invalid manifest mismatch");',
      'pointCalls = 0;',
      'verifyCalls = 0;',
      'const rootHistoryValidation = await validateProviderRegistryRootMetadataHistoryV1({ bootstrapTrustBundle: rootHistoryGolden.bootstrapTrustBundle, rootMetadataHistory: rootHistoryGolden.rootMetadataHistory, strictCryptoCapability: strictCapability });',
      'if (rootHistoryValidation.authority !== "none_structure_and_history_only" || rootHistoryValidation.retainedRootMetadataGenerationCount !== 3 || rootHistoryValidation.currentRootMetadata.rootGeneration !== 3) throw new Error("browser root history validation mismatch");',
      'const rootHistoryPointCalls = pointCalls;',
      'const rootHistoryVerifyCalls = verifyCalls;',
      'const latestRootEnvelope = rootHistoryGolden.rootMetadataHistory[2];',
      'const latestRootLocator = buildProviderRegistryRootMetadataRelativePathV1({ locatorProfile: PROVIDER_REGISTRY_ROOT_METADATA_LOCATOR_PROFILE_V1, rootGeneration: latestRootEnvelope.rootGeneration, rootKeyId: latestRootEnvelope.rootKeyId });',
      'if (latestRootLocator !== rootHistoryGolden.expected.vectors[2].locator) throw new Error("browser root history locator mismatch");',
      'if (registryManifestGoldenBytes.byteLength !== PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1 || !/^[0-9a-f]{64}$/.test(PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1) || PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_DOMAIN_V1 !== "provider-registry-entry-manifest-history-golden-manifest-v1" || !PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1.startsWith("sha256:")) throw new Error("browser Registry golden anchor exports mismatch");',
      'const registryGolden = verifyProviderRegistryManifestHistoryGoldenResourceV1(registryManifestGoldenBytes);',
      'if (registryGolden.fixtureAuthority !== "none_registry_structure_and_history_only" || registryGolden.registryManifestHistory.length !== 7) throw new Error("browser Registry golden mismatch");',
      'if (registryManifestInvalidBytes.byteLength !== PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_BYTE_LENGTH_V1 || !/^[0-9a-f]{64}$/.test(PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_SHA256_HEX_V1) || PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_DOMAIN_V1 !== "provider-registry-manifest-history-invalid-manifest-v1" || !PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_SEMANTIC_CONTENT_DIGEST_V1.startsWith("sha256:")) throw new Error("browser Registry invalid anchor exports mismatch");',
      'const registryInvalid = verifyProviderRegistryManifestHistoryInvalidResourceV1(registryManifestInvalidBytes);',
      'if (registryInvalid.fixtureAuthority !== "none_rejection_only" || registryInvalid.caseCount !== 89 || registryInvalid.cases.length !== 89 || registryInvalid.caseIds.length !== 89 || new Set(registryInvalid.caseIds).size !== 89 || JSON.stringify(registryInvalid.caseIds) !== JSON.stringify(PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_CASE_IDS_V1)) throw new Error("browser Registry invalid corpus mismatch");',
      'const registryInvalidMaterializedRequestDigests = registryInvalid.cases.map((invalidCase, index) => { if (invalidCase.caseId !== registryInvalid.caseIds[index]) throw new Error("browser Registry materialized request case alignment mismatch"); return invalidCase.expected.materializedRequestSemanticDigest; });',
      'if (registryInvalid.materializedRequestSemanticDomain !== PROVIDER_REGISTRY_MANIFEST_INVALID_MATERIALIZED_REQUEST_SEMANTIC_DOMAIN_V1 || registryInvalidMaterializedRequestDigests.length !== 89 || new Set(registryInvalidMaterializedRequestDigests).size !== 89 || registryInvalidMaterializedRequestDigests.some((digest) => !/^sha256:[0-9a-f]{64}$/u.test(digest))) throw new Error("browser Registry materialized request semantic digest closure mismatch");',
      'if (registryInvalid.goldenDependency.resourceByteLength !== PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1 || registryInvalid.goldenDependency.resourceSha256Hex !== PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1 || registryInvalid.goldenDependency.semanticContentDigest !== PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1) throw new Error("browser Registry invalid golden dependency mismatch");',
      'pointCalls = 0;',
      'verifyCalls = 0;',
      'const registryValidation = await validateProviderRegistryManifestHistoryV1({ installationIdentityGenerationId: registryGolden.installationIdentityGenerationId, bootstrapTrustBundle: registryGolden.bootstrapTrustBundle, rootMetadataHistory: registryGolden.rootMetadataHistory, registryManifestHistory: registryGolden.registryManifestHistory, strictCryptoCapability: strictCapability });',
      'if (registryValidation.authority !== "none_registry_structure_and_history_only" || registryValidation.retainedRegistryManifestGenerationCount !== 7 || registryValidation.currentRegistryManifest.contentDigest !== registryGolden.expected.currentRegistryManifest.contentDigest) throw new Error("browser Registry history validation mismatch");',
      'const registryHistoryPointCalls = pointCalls;',
      'const registryHistoryVerifyCalls = verifyCalls;',
      'let registryNegativeCount = 0;',
      'async function expectRegistryRejection(registryManifestHistory, label) { try { await validateProviderRegistryManifestHistoryV1({ installationIdentityGenerationId: registryGolden.installationIdentityGenerationId, bootstrapTrustBundle: registryGolden.bootstrapTrustBundle, rootMetadataHistory: registryGolden.rootMetadataHistory, registryManifestHistory, strictCryptoCapability: strictCapability }); } catch (error) { if (!(error instanceof ProviderRegistryManifestHistoryValidationError) || error.name !== "ProviderRegistryManifestHistoryValidationError" || error.code !== "provider_unavailable" || error.reason !== "attestation_invalid" || error.message !== "Provider registry manifest history validation failed") throw new Error(`browser Registry negative escaped opaque boundary: ${label}`, { cause: error }); registryNegativeCount += 1; return; } throw new Error(`browser Registry negative accepted: ${label}`); }',
      'const signatureBitflip = structuredClone(registryGolden.registryManifestHistory);',
      'const signature = signatureBitflip[6].payload.manifestSignature;',
      'signatureBitflip[6].payload.manifestSignature = `${signature.slice(0, -1)}${signature.endsWith("0") ? "1" : "0"}`;',
      'await expectRegistryRejection(signatureBitflip, "Manifest signature bitflip");',
      'const schemaExtraField = structuredClone(registryGolden.registryManifestHistory);',
      'schemaExtraField[6].unexpectedField = true;',
      'await expectRegistryRejection(schemaExtraField, "Envelope extra field");',
      'const digestBitflip = structuredClone(registryGolden.registryManifestHistory);',
      'const digest = digestBitflip[6].contentDigest;',
      'digestBitflip[6].contentDigest = `${digest.slice(0, -1)}${digest.endsWith("0") ? "1" : "0"}`;',
      'await expectRegistryRejection(digestBitflip, "Envelope digest bitflip");',
      'if (typeof validateProviderRealFilesystemSourceClosureV1 !== "function") throw new Error("browser real filesystem source subpath export missing");',
      'const realFilesystemGoldenValidation = await verifyProviderRealFilesystemSourceGoldenResourceV1(realFilesystemSourceGoldenBytes, strictCapability);',
      'if (realFilesystemGoldenValidation.authority !== "none_real_fs_source_structure_only" || realFilesystemGoldenValidation.sourceClosure.recordCount !== 12 || realFilesystemGoldenValidation.sourceClosure.caseCount !== 4 || realFilesystemGoldenValidation.sourceClosure.requiredCaseCutCount !== 8) throw new Error("browser real filesystem source golden mismatch");',
      'const realFilesystemInvalid = verifyProviderRealFilesystemSourceInvalidResourceV1(realFilesystemSourceInvalidBytes);',
      'if (realFilesystemInvalid.fixtureAuthority !== "none_rejection_only" || realFilesystemInvalid.caseCount !== 43 || realFilesystemInvalid.cases.length !== 43 || JSON.stringify(realFilesystemInvalid.caseIds) !== JSON.stringify(PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_CASE_IDS_V1)) throw new Error("browser real filesystem source invalid mismatch");',
      'if (typeof validateProviderTargetDiscoveryPointClosureV1 !== "function") throw new Error("browser target discovery point subpath export missing");',
      'pointCalls = 0;',
      'verifyCalls = 0;',
      'const targetDiscoveryGoldenValidation = await verifyProviderTargetDiscoveryPointGoldenResourceV1(targetDiscoveryPointGoldenBytes, strictCapability);',
      'if (targetDiscoveryGoldenValidation.authority !== "none_target_discovery_point_structure_only" || targetDiscoveryGoldenValidation.pointClosure.authority !== "none_target_discovery_point_structure_only" || targetDiscoveryGoldenValidation.pointClosure.targetCount !== targetDiscoveryGoldenValidation.manifest.expected.targetCount || targetDiscoveryGoldenValidation.pointClosure.unresolvedObservationCount !== targetDiscoveryGoldenValidation.manifest.expected.unresolvedObservationCount) throw new Error("browser target discovery point golden mismatch");',
      'const targetDiscoveryPointCalls = pointCalls;',
      'const targetDiscoveryVerifyCalls = verifyCalls;',
      'const targetDiscoveryLocatorPairs = [["publicSupportTaxonomy", buildProviderPublicSupportTaxonomyRelativePathV1(targetDiscoveryGoldenValidation.manifest.publicSupportTaxonomy)], ["releaseMatrix", buildProviderReleaseMatrixRelativePathV1(targetDiscoveryGoldenValidation.manifest.releaseMatrix)], ["targetDiscoveryFixtureManifest", buildProviderTargetDiscoveryFixtureManifestRelativePathV1(targetDiscoveryGoldenValidation.manifest.targetDiscoveryFixtureManifest)], ["targetDiscoveryRunnerRun", buildProviderTargetDiscoveryRunnerRunRelativePathV1(targetDiscoveryGoldenValidation.manifest.targetDiscoveryRunnerRun)], ["targetDiscoveryResult", buildProviderTargetDiscoveryResultRelativePathV1(targetDiscoveryGoldenValidation.manifest.targetDiscoveryResult)]];',
      'if (targetDiscoveryLocatorPairs.length !== 5 || targetDiscoveryLocatorPairs.some(([key, path]) => path !== targetDiscoveryGoldenValidation.manifest.expected.locators[key] || path !== targetDiscoveryGoldenValidation.pointClosure.locators[key])) throw new Error("browser target discovery point locator closure mismatch");',
      'const targetDiscoveryInvalid = verifyProviderTargetDiscoveryPointInvalidResourceV1(targetDiscoveryPointInvalidBytes);',
      'if (targetDiscoveryInvalid.fixtureAuthority !== "none_rejection_only" || targetDiscoveryInvalid.caseCount !== PROVIDER_TARGET_DISCOVERY_POINT_INVALID_CASE_IDS_V1.length || targetDiscoveryInvalid.cases.length !== targetDiscoveryInvalid.caseCount || JSON.stringify(targetDiscoveryInvalid.caseIds) !== JSON.stringify(PROVIDER_TARGET_DISCOVERY_POINT_INVALID_CASE_IDS_V1)) throw new Error("browser target discovery point invalid corpus mismatch");',
      'if (typeof validateProviderRealFilesystemConformanceResultClosureV1 !== "function") throw new Error("browser conformance result subpath export missing");',
      'pointCalls = 0;',
      'verifyCalls = 0;',
      'const conformanceResultGoldenValidation = await verifyProviderRealFilesystemConformanceResultGoldenResourceV1(realFilesystemConformanceResultGoldenBytes, strictCapability);',
      'if (conformanceResultGoldenValidation.authority !== "none_real_fs_conformance_result_structure_only" || conformanceResultGoldenValidation.resultClosure.caseResultCount !== 8 || conformanceResultGoldenValidation.manifest.expected.resultSignatureCount !== 0) throw new Error("browser conformance result golden mismatch");',
      'const conformanceResultPointCalls = pointCalls;',
      'const conformanceResultVerifyCalls = verifyCalls;',
      'const conformanceResultPath = buildProviderRealFilesystemConformanceResultRelativePathV1(conformanceResultGoldenValidation.manifest.realFilesystemConformanceResultLocator);',
      'if (conformanceResultPath !== conformanceResultGoldenValidation.manifest.expected.relativePath || conformanceResultPath !== conformanceResultGoldenValidation.resultClosure.relativePath) throw new Error("browser conformance result Locator-only path mismatch");',
      'const conformanceResultInvalid = verifyProviderRealFilesystemConformanceResultInvalidResourceV1(realFilesystemConformanceResultInvalidBytes);',
      'if (conformanceResultInvalid.fixtureAuthority !== "none_rejection_only" || conformanceResultInvalid.caseCount !== 50 || conformanceResultInvalid.cases.length !== conformanceResultInvalid.caseCount || JSON.stringify(conformanceResultInvalid.caseIds) !== JSON.stringify(PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_CASE_IDS_V1)) throw new Error("browser conformance result invalid corpus mismatch");',
      'let conformanceResultInvalidExecutedCaseCount = 0;',
      'for (const [index, invalidCase] of conformanceResultInvalid.cases.entries()) {',
      '  if (invalidCase.caseId !== conformanceResultInvalid.caseIds[index] || invalidCase.mutation.operation !== invalidCase.caseId) throw new Error(`browser conformance result invalid operation/order drift: ${invalidCase.caseId}`);',
      '  const outcome = await executeProviderRealFilesystemConformanceResultInvalidCaseV1(conformanceResultGoldenValidation.manifest, invalidCase.mutation.operation, strictCapability);',
      '  if (invalidCase.expected.boundary === "snapshot_stability") {',
      '    if (outcome.kind !== "snapshot_acceptance" || outcome.boundary !== "snapshot_stability" || outcome.authority !== invalidCase.expected.authority || outcome.caseResultCount !== invalidCase.expected.caseResultCount || outcome.passedCaseResultCount !== invalidCase.expected.passedCaseResultCount) throw new Error(`browser conformance result snapshot replay drift: ${invalidCase.caseId}/${JSON.stringify(outcome)}`);',
      '  } else if (invalidCase.expected.boundary === "locator_builder") {',
      '    if (outcome.kind !== "rejection" || outcome.boundary !== "locator_builder" || outcome.stage !== invalidCase.expected.stage || outcome.reason !== invalidCase.expected.reason) throw new Error(`browser conformance result locator replay drift: ${invalidCase.caseId}/${JSON.stringify(outcome)}`);',
      '  } else {',
      '    if (outcome.kind !== "rejection" || outcome.boundary !== "internal_diagnostic" || outcome.stage !== invalidCase.expected.stage || outcome.reason !== invalidCase.expected.reason || outcome.publicFailure?.errorName !== "ProviderRealFilesystemConformanceResultClosureValidationError" || outcome.publicFailure?.code !== "provider_unavailable" || outcome.publicFailure?.reason !== "attestation_invalid" || outcome.publicFailure.errorName !== invalidCase.expected.publicFailure.errorName || outcome.publicFailure.code !== invalidCase.expected.publicFailure.code || outcome.publicFailure.reason !== invalidCase.expected.publicFailure.reason) throw new Error(`browser conformance result diagnostic replay drift: ${invalidCase.caseId}/${JSON.stringify(outcome)}`);',
      '  }',
      '  conformanceResultInvalidExecutedCaseCount += 1;',
      '}',
      'if (conformanceResultInvalidExecutedCaseCount !== conformanceResultInvalid.caseCount) throw new Error(`browser conformance result replay count drift: ${conformanceResultInvalidExecutedCaseCount}/${conformanceResultInvalid.caseCount}`);',
      'if (typeof validateProviderRuntimeAttestationPointClosureV1 !== "function") throw new Error("browser runtime attestation point subpath export missing");',
      'pointCalls = 0;',
      'verifyCalls = 0;',
      'const runtimeAttestationPointGoldenValidation = await verifyProviderRuntimeAttestationPointGoldenResourceV1(providerRuntimeAttestationPointGoldenBytes, strictCapability);',
      'if (runtimeAttestationPointGoldenValidation.authority !== "none_provider_runtime_attestation_structure_only" || runtimeAttestationPointGoldenValidation.pointClosure.authority !== "none_provider_runtime_attestation_structure_only" || runtimeAttestationPointGoldenValidation.pointClosure.conformanceResultClosure.authority !== "none_real_fs_conformance_result_structure_only" || runtimeAttestationPointGoldenValidation.manifest.expected.activeRootPointAdmissionCount !== 1 || runtimeAttestationPointGoldenValidation.manifest.expected.signatureVerificationCount !== 7 || runtimeAttestationPointGoldenValidation.manifest.expected.runtimeSignatureCount !== 1 || runtimeAttestationPointGoldenValidation.manifest.expected.conformanceResultSignatureCount !== 0) throw new Error("browser runtime attestation point golden mismatch");',
      'const runtimeAttestationPointCalls = pointCalls;',
      'const runtimeAttestationPointVerifyCalls = verifyCalls;',
      'const runtimeAttestationPointInvalid = verifyProviderRuntimeAttestationPointInvalidResourceV1(providerRuntimeAttestationPointInvalidBytes);',
      'if (runtimeAttestationPointInvalid.fixtureAuthority !== "none_rejection_only" || runtimeAttestationPointInvalid.innerCaseCount !== 50 || runtimeAttestationPointInvalid.pointCaseCount !== 72 || runtimeAttestationPointInvalid.caseCount !== 122 || runtimeAttestationPointInvalid.cases.length !== 122 || runtimeAttestationPointInvalid.caseIds.length !== 122 || new Set(runtimeAttestationPointInvalid.caseIds).size !== 122 || JSON.stringify(runtimeAttestationPointInvalid.caseIds) !== JSON.stringify(PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_CASE_IDS_V1)) throw new Error("browser runtime attestation point invalid corpus mismatch");',
      'let runtimeAttestationPointInvalidExecutedCaseCount = 0;',
      'for (const [index, invalidCase] of runtimeAttestationPointInvalid.cases.entries()) {',
      '  if (invalidCase.caseId !== runtimeAttestationPointInvalid.caseIds[index] || invalidCase.mutation.operation !== invalidCase.caseId) throw new Error(`browser runtime attestation point invalid operation/order drift: ${invalidCase.caseId}`);',
      '  const materializedRequest = materializeProviderRuntimeAttestationPointInvalidRequestWitnessV1(runtimeAttestationPointGoldenValidation.manifest, invalidCase);',
      '  const materializedRequestDigest = await browserSemanticDigest(PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1, materializedRequest);',
      '  if (materializedRequestDigest !== invalidCase.expected.materializedRequestSemanticDigest) throw new Error(`browser runtime attestation point materialized request drift: ${invalidCase.caseId}`);',
      '  pointCalls = 0;',
      '  verifyCalls = 0;',
      '  const outcome = await executeProviderRuntimeAttestationPointInvalidCaseV1(runtimeAttestationPointGoldenValidation.manifest, invalidCase, strictCapability);',
      '  if (pointCalls !== invalidCase.expected.pointAdmissionCount || verifyCalls !== invalidCase.expected.signatureVerificationCount) throw new Error(`browser runtime attestation point crypto replay drift: ${invalidCase.caseId}/${pointCalls}/${verifyCalls}`);',
      '  if (invalidCase.expected.boundary === "snapshot_stability") {',
      '    if (outcome.kind !== "snapshot_acceptance" || outcome.boundary !== "snapshot_stability" || outcome.authority !== invalidCase.expected.authority || JSON.stringify(outcome.snapshotProjection) !== JSON.stringify(invalidCase.expected.snapshotProjection)) throw new Error(`browser runtime attestation point snapshot replay drift: ${invalidCase.caseId}/${JSON.stringify(outcome)}`);',
      '  } else {',
      '    if (outcome.kind !== "rejection" || outcome.boundary !== "internal_diagnostic" || outcome.stage !== invalidCase.expected.stage || outcome.reason !== invalidCase.expected.reason || outcome.publicFailure?.errorName !== invalidCase.expected.publicFailure.errorName || outcome.publicFailure?.code !== invalidCase.expected.publicFailure.code || outcome.publicFailure?.reason !== invalidCase.expected.publicFailure.reason) throw new Error(`browser runtime attestation point diagnostic replay drift: ${invalidCase.caseId}/${JSON.stringify(outcome)}`);',
      '  }',
      '  runtimeAttestationPointInvalidExecutedCaseCount += 1;',
      '}',
      'if (runtimeAttestationPointInvalidExecutedCaseCount !== 122) throw new Error(`browser runtime attestation point replay count drift: ${runtimeAttestationPointInvalidExecutedCaseCount}/122`);',
      'if (rootValidateProviderFeasibilityEvidencePointClosureV1 !== validateProviderFeasibilityEvidencePointClosureV1 || rootVerifyProviderFeasibilityEvidencePointGoldenResourceV1 !== verifyProviderFeasibilityEvidencePointGoldenResourceV1 || rootVerifyProviderFeasibilityEvidencePointPositiveVectorsV1 !== verifyProviderFeasibilityEvidencePointPositiveVectorsV1 || rootVerifyProviderFeasibilityEvidencePointInvalidResourceV1 !== verifyProviderFeasibilityEvidencePointInvalidResourceV1) throw new Error("browser root/provider-feasibility-evidence-point exports diverged");',
      'pointCalls = 0;',
      'verifyCalls = 0;',
      'const feasibilityEvidencePointGoldenValidation = await verifyProviderFeasibilityEvidencePointGoldenResourceV1(providerFeasibilityEvidencePointGoldenBytes, strictCapability);',
      'if (feasibilityEvidencePointGoldenValidation.authority !== "none_provider_feasibility_evidence_structure_only" || feasibilityEvidencePointGoldenValidation.pointClosure.authority !== "none_provider_feasibility_evidence_structure_only" || feasibilityEvidencePointGoldenValidation.pointClosure.runtimeAttestationPointClosure.authority !== "none_provider_runtime_attestation_structure_only" || feasibilityEvidencePointGoldenValidation.manifest.expected.activeRootPointAdmissionCount !== 3 || feasibilityEvidencePointGoldenValidation.manifest.expected.signatureVerificationCount !== 11 || feasibilityEvidencePointGoldenValidation.manifest.expected.approverRecordSignatureCount !== 2 || feasibilityEvidencePointGoldenValidation.manifest.expected.evidenceSignatureCount !== 2 || pointCalls !== 3 || verifyCalls !== 11) throw new Error(`browser feasibility evidence point golden/crypto closure failed: ${pointCalls}/${verifyCalls}`);',
      'const feasibilityEvidencePointCalls = pointCalls;',
      'const feasibilityEvidencePointVerifyCalls = verifyCalls;',
      'pointCalls = 0;',
      'verifyCalls = 0;',
      'const feasibilityEvidencePositiveVectorClosures = await verifyProviderFeasibilityEvidencePointPositiveVectorsV1(feasibilityEvidencePointGoldenValidation.manifest, strictCapability);',
      'if (feasibilityEvidencePositiveVectorClosures.length !== 3 || JSON.stringify(feasibilityEvidencePositiveVectorClosures.map((closure) => closure.providerFeasibilityEvidence.payload.result)) !== JSON.stringify(["passed", "failed", "unsupported"]) || pointCalls !== 9 || verifyCalls !== 33) throw new Error(`browser feasibility evidence point positive vectors failed: ${pointCalls}/${verifyCalls}`);',
      'const feasibilityEvidencePositiveVectorPointCalls = pointCalls;',
      'const feasibilityEvidencePositiveVectorVerifyCalls = verifyCalls;',
      'const feasibilityEvidencePointInvalid = verifyProviderFeasibilityEvidencePointInvalidResourceV1(providerFeasibilityEvidencePointInvalidBytes);',
      'if (feasibilityEvidencePointInvalid.fixtureAuthority !== "none_rejection_only" || feasibilityEvidencePointInvalid.runtimeCaseCount !== 122 || feasibilityEvidencePointInvalid.pointCaseCount !== 105 || feasibilityEvidencePointInvalid.caseCount !== 227 || feasibilityEvidencePointInvalid.cases.length !== 227 || feasibilityEvidencePointInvalid.caseIds.length !== 227 || new Set(feasibilityEvidencePointInvalid.caseIds).size !== 227 || JSON.stringify(feasibilityEvidencePointInvalid.caseIds) !== JSON.stringify(PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_CASE_IDS_V1)) throw new Error("browser feasibility evidence point invalid corpus mismatch");',
      'let feasibilityEvidencePointInvalidExecutedCaseCount = 0;',
      'for (const [index, invalidCase] of feasibilityEvidencePointInvalid.cases.entries()) {',
      '  if (invalidCase.caseId !== feasibilityEvidencePointInvalid.caseIds[index] || invalidCase.mutation.operation !== invalidCase.caseId) throw new Error(`browser feasibility evidence point invalid operation/order drift: ${invalidCase.caseId}`);',
      '  const materializedRequest = materializeProviderFeasibilityEvidencePointInvalidRequestWitnessV1(feasibilityEvidencePointGoldenValidation.manifest, feasibilityEvidencePointInvalid, invalidCase);',
      '  const materializedRequestDigest = await browserSemanticDigest(PROVIDER_FEASIBILITY_EVIDENCE_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1, materializedRequest);',
      '  if (materializedRequestDigest !== invalidCase.expected.materializedRequestSemanticDigest) throw new Error(`browser feasibility evidence point materialized request drift: ${invalidCase.caseId}`);',
      '  pointCalls = 0;',
      '  verifyCalls = 0;',
      '  const outcome = await executeProviderFeasibilityEvidencePointInvalidCaseV1(feasibilityEvidencePointGoldenValidation.manifest, feasibilityEvidencePointInvalid, invalidCase, strictCapability);',
      '  if (pointCalls !== invalidCase.expected.pointAdmissionCount || verifyCalls !== invalidCase.expected.signatureVerificationCount) throw new Error(`browser feasibility evidence point crypto replay drift: ${invalidCase.caseId}/${pointCalls}/${verifyCalls}`);',
      '  if (invalidCase.expected.boundary === "snapshot_stability") {',
      '    if (outcome.kind !== "snapshot_acceptance" || outcome.boundary !== "snapshot_stability" || outcome.authority !== invalidCase.expected.authority || JSON.stringify(outcome.snapshotProjection) !== JSON.stringify(invalidCase.expected.snapshotProjection)) throw new Error(`browser feasibility evidence point snapshot replay drift: ${invalidCase.caseId}/${JSON.stringify(outcome)}`);',
      '  } else {',
      '    if (outcome.kind !== "rejection" || outcome.boundary !== "internal_diagnostic" || outcome.stage !== invalidCase.expected.stage || outcome.reason !== invalidCase.expected.reason || outcome.publicFailure?.errorName !== invalidCase.expected.publicFailure.errorName || outcome.publicFailure?.code !== invalidCase.expected.publicFailure.code || outcome.publicFailure?.reason !== invalidCase.expected.publicFailure.reason) throw new Error(`browser feasibility evidence point diagnostic replay drift: ${invalidCase.caseId}/${JSON.stringify(outcome)}`);',
      '  }',
      '  feasibilityEvidencePointInvalidExecutedCaseCount += 1;',
      '}',
      'if (feasibilityEvidencePointInvalidExecutedCaseCount !== 227) throw new Error(`browser feasibility evidence point replay count drift: ${feasibilityEvidencePointInvalidExecutedCaseCount}/227`);',
      'if (rootValidateProviderRegistryEvidenceBindingPointClosureV1 !== validateProviderRegistryEvidenceBindingPointClosureV1 || rootDiagnoseProviderRegistryEvidenceBindingPointClosureV1 !== diagnoseProviderRegistryEvidenceBindingPointClosureV1 || RootProviderRegistryEvidenceBindingPointClosureValidationError !== ProviderRegistryEvidenceBindingPointClosureValidationError || rootVerifyProviderRegistryEvidenceBindingPointGoldenResourceV1 !== verifyProviderRegistryEvidenceBindingPointGoldenResourceV1 || rootVerifyProviderRegistryEvidenceBindingPointInvalidResourceV1 !== verifyProviderRegistryEvidenceBindingPointInvalidResourceV1 || rootMaterializeProviderRegistryEvidenceBindingPointGoldenRequestV1 !== materializeProviderRegistryEvidenceBindingPointGoldenRequestV1 || rootMaterializeProviderRegistryEvidenceBindingPointInvalidCaseV1 !== materializeProviderRegistryEvidenceBindingPointInvalidCaseV1 || rootProjectProviderRegistryEvidenceBindingPointClosureSnapshotV1 !== projectProviderRegistryEvidenceBindingPointClosureSnapshotV1 || rootExecuteProviderRegistryEvidenceBindingPointInvalidCaseV1 !== executeProviderRegistryEvidenceBindingPointInvalidCaseV1 || RootProviderRegistryEvidenceBindingPointFixtureError !== ProviderRegistryEvidenceBindingPointFixtureError) throw new Error("browser root/provider Registry/Evidence binding exports diverged");',
      'if (providerRegistryEvidenceBindingPointGoldenBytes.byteLength !== PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1 || lowerHex(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", providerRegistryEvidenceBindingPointGoldenBytes))) !== PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1) throw new Error("browser Registry/Evidence binding golden raw anchor mismatch");',
      'if (providerRegistryEvidenceBindingPointInvalidBytes.byteLength !== PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1 || lowerHex(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", providerRegistryEvidenceBindingPointInvalidBytes))) !== PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_RESOURCE_SHA256_HEX_V1) throw new Error("browser Registry/Evidence binding invalid raw anchor mismatch");',
      'const registryEvidenceBindingGoldenManifest = verifyProviderRegistryEvidenceBindingPointGoldenResourceV1(providerRegistryEvidenceBindingPointGoldenBytes);',
      'pointCalls = 0;',
      'verifyCalls = 0;',
      'const registryEvidenceBindingClosure = await validateProviderRegistryEvidenceBindingPointClosureV1(materializeProviderRegistryEvidenceBindingPointGoldenRequestV1(registryEvidenceBindingGoldenManifest, strictCapability));',
      'if (registryEvidenceBindingClosure.authority !== "none_registry_entry_evidence_binding_structure_only" || pointCalls !== 24 || verifyCalls !== 46 || JSON.stringify(projectProviderRegistryEvidenceBindingPointClosureSnapshotV1(registryEvidenceBindingClosure)) !== JSON.stringify(registryEvidenceBindingGoldenManifest.expected.successProjection)) throw new Error(`browser Registry/Evidence binding golden/crypto closure failed: ${pointCalls}/${verifyCalls}`);',
      'const registryEvidenceBindingPointCalls = pointCalls;',
      'const registryEvidenceBindingVerifyCalls = verifyCalls;',
      'const registryEvidenceBindingInvalid = verifyProviderRegistryEvidenceBindingPointInvalidResourceV1(providerRegistryEvidenceBindingPointInvalidBytes);',
      'if (registryEvidenceBindingInvalid.fixtureAuthority !== "none_fixture_replay_only" || registryEvidenceBindingInvalid.inheritedEvidenceCaseCount !== 227 || registryEvidenceBindingInvalid.inheritedRegistryCaseCount !== 89 || registryEvidenceBindingInvalid.pointSpecificCaseCount !== 38 || registryEvidenceBindingInvalid.caseCount !== 354 || registryEvidenceBindingInvalid.shardSize !== 32 || registryEvidenceBindingInvalid.maxWorkers !== 4 || registryEvidenceBindingInvalid.shards.length !== 12 || registryEvidenceBindingInvalid.caseIds.length !== 354 || registryEvidenceBindingInvalid.cases.length !== 354 || new Set(registryEvidenceBindingInvalid.caseIds).size !== 354 || JSON.stringify(registryEvidenceBindingInvalid.caseIds) !== JSON.stringify(PROVIDER_REGISTRY_EVIDENCE_BINDING_POINT_INVALID_CASE_IDS_V1)) throw new Error("browser Registry/Evidence binding invalid corpus mismatch");',
      '// The exact 354-case replay runs once in four fixed packed-browser lanes.',
      'const registryEvidenceBindingTopologyProof = verifyProviderRegistryEvidenceBindingTopologyProofResourceV1(providerRegistryEvidenceBindingTopologyProofBytes);',
      'if (registryEvidenceBindingTopologyProof.productionParserBindings.length !== 21 || registryEvidenceBindingTopologyProof.status !== "accepted_after_contract_reopen" || registryEvidenceBindingTopologyProof.contractReopenRequired !== false || registryEvidenceBindingTopologyProof.priorContractReopenRequired !== true || registryEvidenceBindingTopologyProof.capAssessment.adoptedAssessment.withinSoundUpper !== true || registryEvidenceBindingTopologyProof.capAssessment.priorFailures.length !== 2 || registryEvidenceBindingTopologyProof.capAssessment.adoptedFailures.length !== 0) throw new Error("browser Registry/Evidence topology proof mismatch");',
      'if (rootValidateProviderReleaseTargetUniversePointClosureV1 !== validateProviderReleaseTargetUniversePointClosureV1 || rootDiagnoseProviderReleaseTargetUniversePointClosureV1 !== diagnoseProviderReleaseTargetUniversePointClosureV1 || rootBuildProviderReleaseTargetUniverseRelativePathV1 !== buildProviderReleaseTargetUniverseRelativePathV1 || RootProviderReleaseTargetUniversePointClosureValidationError !== ProviderReleaseTargetUniversePointClosureValidationError || rootVerifyProviderReleaseTargetUniversePointGoldenResourceV1 !== verifyProviderReleaseTargetUniversePointGoldenResourceV1 || rootVerifyProviderReleaseTargetUniversePointPositiveVectorsV1 !== verifyProviderReleaseTargetUniversePointPositiveVectorsV1 || rootVerifyProviderReleaseTargetUniversePointInvalidResourceV1 !== verifyProviderReleaseTargetUniversePointInvalidResourceV1 || rootMaterializeProviderReleaseTargetUniversePointInvalidCaseWitnessV1 !== materializeProviderReleaseTargetUniversePointInvalidCaseWitnessV1 || rootExecuteProviderReleaseTargetUniversePointInvalidCaseV1 !== executeProviderReleaseTargetUniversePointInvalidCaseV1 || RootProviderReleaseTargetUniversePointFixtureError !== ProviderReleaseTargetUniversePointFixtureError) throw new Error("browser root/provider-release-target-universe-point exports diverged");',
      'if (providerReleaseTargetUniversePointGoldenBytes.byteLength !== PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1 || lowerHex(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", providerReleaseTargetUniversePointGoldenBytes))) !== PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1) throw new Error("browser release target Universe golden raw anchor mismatch");',
      'if (providerReleaseTargetUniversePointInvalidBytes.byteLength !== PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_RESOURCE_BYTE_LENGTH_V1 || lowerHex(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", providerReleaseTargetUniversePointInvalidBytes))) !== PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_RESOURCE_SHA256_HEX_V1) throw new Error("browser release target Universe invalid raw anchor mismatch");',
      'pointCalls = 0;',
      'verifyCalls = 0;',
      'nextSignatureMutation = undefined;',
      'const releaseTargetUniverseGoldenValidation = await verifyProviderReleaseTargetUniversePointGoldenResourceV1(providerReleaseTargetUniversePointGoldenBytes, strictCapability);',
      'if (releaseTargetUniverseGoldenValidation.authority !== "none_release_target_universe_structure_only" || releaseTargetUniverseGoldenValidation.pointClosure.authority !== "none_release_target_universe_structure_only" || releaseTargetUniverseGoldenValidation.pointClosure.targetDiscoveryPointClosure.authority !== "none_target_discovery_point_structure_only" || releaseTargetUniverseGoldenValidation.manifest.positiveVectors.length !== 4 || pointCalls !== 1 || verifyCalls !== 7 || nextSignatureMutation !== undefined) throw new Error(`browser release target Universe golden/crypto closure failed: ${pointCalls}/${verifyCalls}`);',
      'const releaseTargetUniversePointCalls = pointCalls;',
      'const releaseTargetUniverseVerifyCalls = verifyCalls;',
      'const releaseTargetUniversePath = buildProviderReleaseTargetUniverseRelativePathV1(releaseTargetUniverseGoldenValidation.manifest.releaseTargetUniverse);',
      'if (releaseTargetUniversePath !== releaseTargetUniverseGoldenValidation.pointClosure.relativePath || releaseTargetUniversePath !== releaseTargetUniverseGoldenValidation.manifest.expected.snapshotProjection.universeRelativePath) throw new Error("browser release target Universe Locator-only path mismatch");',
      'pointCalls = 0;',
      'verifyCalls = 0;',
      'const releaseTargetUniversePositiveVectorClosures = await verifyProviderReleaseTargetUniversePointPositiveVectorsV1(releaseTargetUniverseGoldenValidation.manifest, strictCapability);',
      'if (releaseTargetUniversePositiveVectorClosures.length !== 4 || JSON.stringify(releaseTargetUniverseGoldenValidation.manifest.positiveVectors.map(({ vectorId }) => vectorId)) !== JSON.stringify(["taxonomy-mapping-unresolved", "target-discovery-unresolved", "release-matrix-incomplete", "closed-world-complete"]) || releaseTargetUniversePositiveVectorClosures.some((closure) => closure.authority !== "none_release_target_universe_structure_only") || pointCalls !== 4 || verifyCalls !== 28 || nextSignatureMutation !== undefined) throw new Error(`browser release target Universe positive-vector closure failed: ${pointCalls}/${verifyCalls}`);',
      'const releaseTargetUniversePositiveVectorPointCalls = pointCalls;',
      'const releaseTargetUniversePositiveVectorVerifyCalls = verifyCalls;',
      'const releaseTargetUniverseInvalid = verifyProviderReleaseTargetUniversePointInvalidResourceV1(providerReleaseTargetUniversePointInvalidBytes);',
      'if (releaseTargetUniverseInvalid.fixtureAuthority !== "none_rejection_only" || releaseTargetUniverseInvalid.inheritedCaseCount !== 116 || releaseTargetUniverseInvalid.pointCaseCount !== 169 || releaseTargetUniverseInvalid.caseCount !== 285 || releaseTargetUniverseInvalid.caseIds.length !== 285 || releaseTargetUniverseInvalid.cases.length !== 285 || releaseTargetUniverseInvalid.inheritedReplayRecipes.length !== 116 || new Set(releaseTargetUniverseInvalid.caseIds).size !== 285 || JSON.stringify(releaseTargetUniverseInvalid.caseIds) !== JSON.stringify(PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_CASE_IDS_V1)) throw new Error("browser release target Universe invalid corpus mismatch");',
      'let releaseTargetUniverseInvalidExecutedCaseCount = 0;',
      'for (const [index, invalidCase] of releaseTargetUniverseInvalid.cases.entries()) {',
      '  if (invalidCase.caseId !== releaseTargetUniverseInvalid.caseIds[index] || invalidCase.mutation.operation !== invalidCase.caseId) throw new Error(`browser release target Universe invalid operation/order drift: ${invalidCase.caseId}`);',
      '  const firstWitness = materializeProviderReleaseTargetUniversePointInvalidCaseWitnessV1(releaseTargetUniverseGoldenValidation.manifest, releaseTargetUniverseInvalid, invalidCase);',
      '  const secondWitness = materializeProviderReleaseTargetUniversePointInvalidCaseWitnessV1(releaseTargetUniverseGoldenValidation.manifest, releaseTargetUniverseInvalid, invalidCase);',
      '  if (firstWitness === secondWitness) throw new Error(`browser release target Universe witness was reused: ${invalidCase.caseId}`);',
      '  const firstWitnessDigest = await browserSemanticDigest(PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1, firstWitness);',
      '  const secondWitnessDigest = await browserSemanticDigest(PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1, secondWitness);',
      '  if (firstWitnessDigest !== invalidCase.expected.materializedRequestSemanticDigest || secondWitnessDigest !== firstWitnessDigest) throw new Error(`browser release target Universe materialized request drift: ${invalidCase.caseId}`);',
      '  pointCalls = 0;',
      '  verifyCalls = 0;',
      '  nextSignatureMutation = undefined;',
      '  const outcome = await executeProviderReleaseTargetUniversePointInvalidCaseV1(releaseTargetUniverseGoldenValidation.manifest, releaseTargetUniverseInvalid, invalidCase, strictCapability, universeExecutionCounter);',
      '  if (nextSignatureMutation !== undefined || pointCalls !== invalidCase.expected.pointAdmissionCount || verifyCalls !== invalidCase.expected.signatureVerificationCount || outcome.pointAdmissionCount !== invalidCase.expected.pointAdmissionCount || outcome.signatureVerificationCount !== invalidCase.expected.signatureVerificationCount || Object.getPrototypeOf(outcome) !== null || !Object.isFrozen(outcome)) throw new Error(`browser release target Universe execution/count drift: ${invalidCase.caseId}/${pointCalls}/${verifyCalls}`);',
      '  if (invalidCase.expected.boundary === "snapshot_stability") {',
      '    if (outcome.kind !== "snapshot_acceptance" || outcome.boundary !== "snapshot_stability" || outcome.authority !== invalidCase.expected.authority || JSON.stringify(outcome.snapshotProjection) !== JSON.stringify(invalidCase.expected.snapshotProjection)) throw new Error(`browser release target Universe snapshot replay drift: ${invalidCase.caseId}/${JSON.stringify(outcome)}`);',
      '  } else if (invalidCase.expected.boundary === "locator_builder") {',
      '    if (outcome.kind !== "rejection" || outcome.boundary !== "locator_builder" || outcome.stage !== invalidCase.expected.stage || outcome.reason !== invalidCase.expected.reason) throw new Error(`browser release target Universe locator replay drift: ${invalidCase.caseId}/${JSON.stringify(outcome)}`);',
      '  } else {',
      '    if (outcome.kind !== "rejection" || outcome.boundary !== "internal_diagnostic" || outcome.stage !== invalidCase.expected.stage || outcome.reason !== invalidCase.expected.reason || outcome.publicFailure?.errorName !== invalidCase.expected.publicFailure.errorName || outcome.publicFailure?.code !== invalidCase.expected.publicFailure.code || outcome.publicFailure?.reason !== invalidCase.expected.publicFailure.reason) throw new Error(`browser release target Universe diagnostic replay drift: ${invalidCase.caseId}/${JSON.stringify(outcome)}`);',
      '  }',
      '  releaseTargetUniverseInvalidExecutedCaseCount += 1;',
      '}',
      'if (releaseTargetUniverseInvalidExecutedCaseCount !== 285) throw new Error(`browser release target Universe replay count drift: ${releaseTargetUniverseInvalidExecutedCaseCount}/285`);',
      'const capabilityBytes = getProviderStrictEd25519CryptoCapabilityBytesV1(strictCapability);',
      'const providerError = createProviderUnavailableToolErrorV1("revoked");',
      'ProviderUnavailableToolErrorV1Schema.parse(providerError);',
      `const publicModules = [${explicitSpecifiers
        .map((_, index) => `providerContractBrowserModule${index}`)
        .join(", ")}];`,
      'if (publicModules.some((module) => Object.keys(module).length === 0)) throw new Error("empty browser public export");',
      'export const browserKatResult = Object.freeze({ pointCalls: bootstrapPointCalls, verifyCalls: bootstrapVerifyCalls, rootHistoryPointCalls, rootHistoryVerifyCalls, registryHistoryPointCalls, registryHistoryVerifyCalls, registryNegativeCount, registryInvalidCaseCount: registryInvalid.caseCount, registryHistoryAuthority: registryValidation.authority, registryManifestCount: registryValidation.retainedRegistryManifestGenerationCount, realFilesystemAuthority: realFilesystemGoldenValidation.authority, realFilesystemRecordCount: realFilesystemGoldenValidation.sourceClosure.recordCount, realFilesystemCaseCount: realFilesystemGoldenValidation.sourceClosure.caseCount, realFilesystemCutCount: realFilesystemGoldenValidation.sourceClosure.requiredCaseCutCount, realFilesystemInvalidCaseCount: realFilesystemInvalid.caseCount, targetDiscoveryAuthority: targetDiscoveryGoldenValidation.authority, targetDiscoveryPointCalls, targetDiscoveryVerifyCalls, targetDiscoveryTargetCount: targetDiscoveryGoldenValidation.pointClosure.targetCount, targetDiscoveryUnresolvedObservationCount: targetDiscoveryGoldenValidation.pointClosure.unresolvedObservationCount, targetDiscoveryInvalidCaseCount: targetDiscoveryInvalid.caseCount, conformanceResultAuthority: conformanceResultGoldenValidation.authority, conformanceResultPointCalls, conformanceResultVerifyCalls, conformanceResultCaseCount: conformanceResultGoldenValidation.resultClosure.caseResultCount, conformanceResultInvalidCaseCount: conformanceResultInvalid.caseCount, conformanceResultInvalidExecutedCaseCount, conformanceResultPath, expectedConformanceResultPath: conformanceResultGoldenValidation.manifest.expected.relativePath, runtimeAttestationPointAuthority: runtimeAttestationPointGoldenValidation.authority, runtimeAttestationPointCalls, runtimeAttestationPointVerifyCalls, runtimeAttestationPointInnerCaseCount: runtimeAttestationPointInvalid.innerCaseCount, runtimeAttestationPointSpecificCaseCount: runtimeAttestationPointInvalid.pointCaseCount, runtimeAttestationPointInvalidCaseCount: runtimeAttestationPointInvalid.caseCount, runtimeAttestationPointInvalidExecutedCaseCount, feasibilityEvidencePointAuthority: feasibilityEvidencePointGoldenValidation.authority, feasibilityEvidencePointCalls, feasibilityEvidencePointVerifyCalls, feasibilityEvidencePointPositiveVectorCount: feasibilityEvidencePositiveVectorClosures.length, feasibilityEvidencePositiveVectorPointCalls, feasibilityEvidencePositiveVectorVerifyCalls, feasibilityEvidencePointRuntimeCaseCount: feasibilityEvidencePointInvalid.runtimeCaseCount, feasibilityEvidencePointSpecificCaseCount: feasibilityEvidencePointInvalid.pointCaseCount, feasibilityEvidencePointInvalidCaseCount: feasibilityEvidencePointInvalid.caseCount, feasibilityEvidencePointInvalidExecutedCaseCount, registryEvidenceBindingAuthority: registryEvidenceBindingClosure.authority, registryEvidenceBindingPointCalls, registryEvidenceBindingVerifyCalls, registryEvidenceBindingInheritedEvidenceCaseCount: registryEvidenceBindingInvalid.inheritedEvidenceCaseCount, registryEvidenceBindingInheritedRegistryCaseCount: registryEvidenceBindingInvalid.inheritedRegistryCaseCount, registryEvidenceBindingSpecificCaseCount: registryEvidenceBindingInvalid.pointSpecificCaseCount, registryEvidenceBindingInvalidCaseCount: registryEvidenceBindingInvalid.caseCount, registryEvidenceBindingTopologyParserCount: registryEvidenceBindingTopologyProof.productionParserBindings.length, releaseTargetUniverseAuthority: releaseTargetUniverseGoldenValidation.authority, releaseTargetUniversePointCalls, releaseTargetUniverseVerifyCalls, releaseTargetUniversePositiveVectorCount: releaseTargetUniversePositiveVectorClosures.length, releaseTargetUniversePositiveVectorPointCalls, releaseTargetUniversePositiveVectorVerifyCalls, releaseTargetUniverseInheritedCaseCount: releaseTargetUniverseInvalid.inheritedCaseCount, releaseTargetUniverseSpecificCaseCount: releaseTargetUniverseInvalid.pointCaseCount, releaseTargetUniverseInvalidCaseCount: releaseTargetUniverseInvalid.caseCount, releaseTargetUniverseInvalidExecutedCaseCount, releaseTargetUniversePath, expectedReleaseTargetUniversePath: releaseTargetUniverseGoldenValidation.manifest.expected.snapshotProjection.universeRelativePath, capabilityByteLength: capabilityBytes.byteLength, bootstrapAuthority: bootstrapValidation.authority, goldenAuthority: bootstrapGoldenValidation.authority, goldenCaseCount: 5 + bootstrapGoldenValidation.manifest.vectors.recoveryKeyIds.length, invalidAuthority: bootstrapInvalidValidation.authority, invalidCaseCount: bootstrapInvalidValidation.manifest.cases.length, rootHistoryAuthority: rootHistoryValidation.authority, rootHistoryGenerationCount: rootHistoryValidation.retainedRootMetadataGenerationCount, rootHistoryInvalidCaseCount: rootHistoryInvalid.cases.length, rootHistoryLocator: latestRootLocator, expectedRootHistoryLocator: rootHistoryGolden.expected.vectors[2].locator, publicModuleCount: publicModules.length, providerReason: providerError.details.reason });',
    ].join("\n"),
    "utf8",
  );
  const runLegacyMainViteBrowserKatsV1 = async () => {
  const browserViteDependencyGuardNonce =
    createC09ViteDependencyGuardNonce();
  await writeFile(
    join(consumerRoot, "vite.config.mjs"),
    [
      'import { resolve } from "node:path";',
      ...renderC09ViteDependencyGuardConfigPreamble(
        browserViteDependencyGuardNonce,
      ),
      'export default {',
      '  plugins: [c09ClosedBrowserDependencyGuard()],',
      '  build: {',
      '    target: "es2022",',
      '    outDir: "browser-dist",',
      '    emptyOutDir: true,',
      '    minify: false,',
      '    lib: { entry: resolve("browser-entry.js"), formats: ["es"], fileName: "browser-kat" },',
      '  },',
      '};',
    ].join("\n"),
    "utf8",
  );
  const viteBuildResult = await run(
    viteCommand,
    ["build", "--config", "vite.config.mjs"],
    {
      cwd: consumerRoot,
      env: { NODE_OPTIONS: C09_NODE_OPTIONS },
      timeoutMs: C09_VITE_BUILD_TIMEOUT_MS,
    },
  );
  const viteBuildOutput = [
    viteBuildResult.stdout,
    viteBuildResult.stderr,
  ].join("\n");
  if (
    /(?:externalized for browser compatibility|__vite-browser-external)/u.test(
      viteBuildOutput,
    )
  ) {
    throw new Error(
      "Vite externalized a Node-only dependency from the browser bundle",
    );
  }
  const browserJavaScriptFiles = (
    await listFiles(join(consumerRoot, "browser-dist"))
  ).filter((filePath) => /\.(?:m?js)$/u.test(filePath));
  if (browserJavaScriptFiles.length === 0) {
    throw new Error("Vite did not emit a browser JavaScript bundle");
  }
  const browserEntryCandidates = browserJavaScriptFiles.filter((filePath) =>
    basename(filePath).startsWith("browser-kat."),
  );
  if (browserEntryCandidates.length !== 1) {
    throw new Error(
      `Vite emitted ${browserEntryCandidates.length} browser KAT entry candidates instead of exactly one`,
    );
  }
  const [browserEntryFile] = browserEntryCandidates;
  for (const filePath of browserJavaScriptFiles) {
    const source = await readFile(filePath, "utf8");
    if (
      !hasExactC09ViteDependencyGuardSentinel(
        source,
        browserViteDependencyGuardNonce,
      )
    ) {
      throw new Error(
        `Browser bundle ${basename(filePath)} lacks the exact post-tree-shake dependency-guard sentinel`,
      );
    }
    const dependency = findBrowserRuntimeDependency(source);
    if (dependency !== undefined) {
      throw new Error(
        `Browser bundle ${basename(filePath)} contains ${dependency}`,
      );
    }
  }
  const browserRuntimeProbe = join(
    consumerRoot,
    "browser-runtime-probe.mjs",
  );
  await writeFile(
    browserRuntimeProbe,
    [
      'import { readFile } from "node:fs/promises";',
      `const registryEvidenceBindingInvalidFileBytes = await readFile(${JSON.stringify(installedProviderRegistryEvidenceBindingPointInvalidPath)});`,
      `Object.defineProperty(globalThis, ${JSON.stringify(C09_BROWSER_INVALID_BYTES_GLOBAL_V1)}, { configurable: true, value: new Uint8Array(registryEvidenceBindingInvalidFileBytes.buffer, registryEvidenceBindingInvalidFileBytes.byteOffset, registryEvidenceBindingInvalidFileBytes.byteLength) });`,
      "delete globalThis.process;",
      "delete globalThis.Buffer;",
      `const { browserKatResult } = await import(${JSON.stringify(`./browser-dist/${basename(browserEntryFile)}`)});`,
      `if (Object.hasOwn(globalThis, ${JSON.stringify(C09_BROWSER_INVALID_BYTES_GLOBAL_V1)})) throw new Error("browser Registry/Evidence binding invalid-byte injection was not deleted");`,
      'if (browserKatResult.pointCalls !== 62) throw new Error(`browser KAT+trust point calls: ${browserKatResult.pointCalls}`);',
      'if (browserKatResult.verifyCalls !== 31) throw new Error(`browser KAT+trust verify calls: ${browserKatResult.verifyCalls}`);',
      'if (browserKatResult.rootHistoryPointCalls !== 11) throw new Error(`browser root history point calls: ${browserKatResult.rootHistoryPointCalls}`);',
      'if (browserKatResult.rootHistoryVerifyCalls !== 9) throw new Error(`browser root history verify calls: ${browserKatResult.rootHistoryVerifyCalls}`);',
      'if (browserKatResult.registryHistoryPointCalls !== 24) throw new Error(`browser Registry history point calls: ${browserKatResult.registryHistoryPointCalls}`);',
      'if (browserKatResult.registryHistoryVerifyCalls !== 38) throw new Error(`browser Registry history verify calls: ${browserKatResult.registryHistoryVerifyCalls}`);',
      'if (browserKatResult.registryNegativeCount !== 3) throw new Error(`browser Registry exact negative count: ${browserKatResult.registryNegativeCount}`);',
      'if (browserKatResult.registryInvalidCaseCount !== 89) throw new Error(`browser Registry invalid case count: ${browserKatResult.registryInvalidCaseCount}`);',
      'if (browserKatResult.capabilityByteLength === 0) throw new Error("browser KAT capability is empty");',
      'if (browserKatResult.bootstrapAuthority !== "none_structure_only") throw new Error("browser bootstrap trust exposed authority");',
      'if (browserKatResult.goldenAuthority !== "none_structure_only" || browserKatResult.goldenCaseCount !== 8) throw new Error("browser bootstrap golden exposed authority or lost cases");',
      'if (browserKatResult.invalidAuthority !== "none_rejection_only" || browserKatResult.invalidCaseCount !== 51) throw new Error("browser bootstrap invalid manifest exposed authority or lost cases");',
      'if (browserKatResult.rootHistoryAuthority !== "none_structure_and_history_only" || browserKatResult.rootHistoryGenerationCount !== 3 || browserKatResult.rootHistoryInvalidCaseCount !== 31) throw new Error("browser root history exposed authority or lost cases");',
      'if (browserKatResult.registryHistoryAuthority !== "none_registry_structure_and_history_only" || browserKatResult.registryManifestCount !== 7) throw new Error("browser Registry history exposed authority or lost generations");',
      'if (browserKatResult.realFilesystemAuthority !== "none_real_fs_source_structure_only" || browserKatResult.realFilesystemRecordCount !== 12 || browserKatResult.realFilesystemCaseCount !== 4 || browserKatResult.realFilesystemCutCount !== 8 || browserKatResult.realFilesystemInvalidCaseCount !== 43) throw new Error("browser real filesystem source exposed authority or lost fixture coverage");',
      'if (browserKatResult.targetDiscoveryAuthority !== "none_target_discovery_point_structure_only") throw new Error("browser target discovery point exposed authority");',
      'if (browserKatResult.targetDiscoveryPointCalls !== 1 || browserKatResult.targetDiscoveryVerifyCalls !== 6) throw new Error(`browser target discovery point crypto calls: ${browserKatResult.targetDiscoveryPointCalls}/${browserKatResult.targetDiscoveryVerifyCalls}`);',
      'if (browserKatResult.targetDiscoveryTargetCount === 0 || browserKatResult.targetDiscoveryUnresolvedObservationCount === 0 || browserKatResult.targetDiscoveryInvalidCaseCount === 0) throw new Error("browser target discovery point lost golden or invalid fixture coverage");',
      'if (browserKatResult.conformanceResultAuthority !== "none_real_fs_conformance_result_structure_only" || browserKatResult.conformanceResultCaseCount !== 8 || browserKatResult.conformanceResultInvalidCaseCount !== 50 || browserKatResult.conformanceResultInvalidExecutedCaseCount !== 50) throw new Error("browser conformance result exposed authority or lost executable fixture coverage");',
      'if (browserKatResult.conformanceResultPointCalls !== 1 || browserKatResult.conformanceResultVerifyCalls !== 6) throw new Error(`browser conformance result crypto calls: ${browserKatResult.conformanceResultPointCalls}/${browserKatResult.conformanceResultVerifyCalls}`);',
      'if (browserKatResult.conformanceResultPath !== browserKatResult.expectedConformanceResultPath) throw new Error("browser conformance result Locator-only path mismatch");',
      'if (browserKatResult.runtimeAttestationPointAuthority !== "none_provider_runtime_attestation_structure_only") throw new Error("browser runtime attestation point exposed authority");',
      'if (browserKatResult.runtimeAttestationPointCalls !== 1 || browserKatResult.runtimeAttestationPointVerifyCalls !== 7) throw new Error(`browser runtime attestation point crypto calls: ${browserKatResult.runtimeAttestationPointCalls}/${browserKatResult.runtimeAttestationPointVerifyCalls}`);',
      'if (browserKatResult.runtimeAttestationPointInnerCaseCount !== 50 || browserKatResult.runtimeAttestationPointSpecificCaseCount !== 72 || browserKatResult.runtimeAttestationPointInvalidCaseCount !== 122 || browserKatResult.runtimeAttestationPointInvalidExecutedCaseCount !== 122) throw new Error("browser runtime attestation point lost executable fixture coverage");',
      'if (browserKatResult.feasibilityEvidencePointAuthority !== "none_provider_feasibility_evidence_structure_only") throw new Error("browser feasibility evidence point exposed authority");',
      'if (browserKatResult.feasibilityEvidencePointCalls !== 3 || browserKatResult.feasibilityEvidencePointVerifyCalls !== 11) throw new Error(`browser feasibility evidence point golden crypto calls: ${browserKatResult.feasibilityEvidencePointCalls}/${browserKatResult.feasibilityEvidencePointVerifyCalls}`);',
      'if (browserKatResult.feasibilityEvidencePointPositiveVectorCount !== 3 || browserKatResult.feasibilityEvidencePositiveVectorPointCalls !== 9 || browserKatResult.feasibilityEvidencePositiveVectorVerifyCalls !== 33) throw new Error(`browser feasibility evidence point positive-vector crypto calls: ${browserKatResult.feasibilityEvidencePositiveVectorPointCalls}/${browserKatResult.feasibilityEvidencePositiveVectorVerifyCalls}`);',
      'if (browserKatResult.feasibilityEvidencePointRuntimeCaseCount !== 122 || browserKatResult.feasibilityEvidencePointSpecificCaseCount !== 105 || browserKatResult.feasibilityEvidencePointInvalidCaseCount !== 227 || browserKatResult.feasibilityEvidencePointInvalidExecutedCaseCount !== 227) throw new Error("browser feasibility evidence point lost executable fixture coverage");',
      'if (browserKatResult.registryEvidenceBindingAuthority !== "none_registry_entry_evidence_binding_structure_only") throw new Error("browser Registry/Evidence binding exposed authority");',
      'if (browserKatResult.registryEvidenceBindingPointCalls !== 24 || browserKatResult.registryEvidenceBindingVerifyCalls !== 46) throw new Error(`browser Registry/Evidence binding golden crypto calls: ${browserKatResult.registryEvidenceBindingPointCalls}/${browserKatResult.registryEvidenceBindingVerifyCalls}`);',
      'if (browserKatResult.registryEvidenceBindingInheritedEvidenceCaseCount !== 227 || browserKatResult.registryEvidenceBindingInheritedRegistryCaseCount !== 89 || browserKatResult.registryEvidenceBindingSpecificCaseCount !== 38 || browserKatResult.registryEvidenceBindingInvalidCaseCount !== 354 || browserKatResult.registryEvidenceBindingTopologyParserCount !== 21) throw new Error("browser Registry/Evidence binding lost fixture/topology coverage");',
      'if (browserKatResult.releaseTargetUniverseAuthority !== "none_release_target_universe_structure_only") throw new Error("browser release target Universe exposed authority");',
      'if (browserKatResult.releaseTargetUniversePointCalls !== 1 || browserKatResult.releaseTargetUniverseVerifyCalls !== 7) throw new Error(`browser release target Universe golden crypto calls: ${browserKatResult.releaseTargetUniversePointCalls}/${browserKatResult.releaseTargetUniverseVerifyCalls}`);',
      'if (browserKatResult.releaseTargetUniversePositiveVectorCount !== 4 || browserKatResult.releaseTargetUniversePositiveVectorPointCalls !== 4 || browserKatResult.releaseTargetUniversePositiveVectorVerifyCalls !== 28) throw new Error(`browser release target Universe positive-vector crypto calls: ${browserKatResult.releaseTargetUniversePositiveVectorPointCalls}/${browserKatResult.releaseTargetUniversePositiveVectorVerifyCalls}`);',
      'if (browserKatResult.releaseTargetUniverseInheritedCaseCount !== 116 || browserKatResult.releaseTargetUniverseSpecificCaseCount !== 169 || browserKatResult.releaseTargetUniverseInvalidCaseCount !== 285 || browserKatResult.releaseTargetUniverseInvalidExecutedCaseCount !== 285) throw new Error("browser release target Universe lost executable fixture coverage");',
      'if (browserKatResult.releaseTargetUniversePath !== browserKatResult.expectedReleaseTargetUniversePath) throw new Error("browser release target Universe Locator-only path mismatch");',
      'if (browserKatResult.rootHistoryLocator !== browserKatResult.expectedRootHistoryLocator) throw new Error("browser root history locator mismatch");',
      `if (browserKatResult.publicModuleCount !== ${explicitSpecifiers.length}) throw new Error("browser public module count mismatch");`,
      'if (browserKatResult.providerReason !== "revoked") throw new Error("browser provider error probe failed");',
    ].join("\n"),
    "utf8",
  );
  await run(
    process.execPath,
    [browserRuntimeProbe],
    {
    cwd: consumerRoot,
    env: { NODE_OPTIONS: C09_BROWSER_RUNTIME_NODE_OPTIONS },
    timeoutMs: DEFAULT_COMMAND_TIMEOUT_MS,
    },
  );
  };

  const c09BrowserReplayEntryPath = join(
    consumerRoot,
    "provider-registry-evidence-binding-distribution-browser-entry.mjs",
  );
  const c09BrowserReplayRuntimePath = join(
    consumerRoot,
    "provider-registry-evidence-binding-distribution-browser-runtime.mjs",
  );
  await Promise.all([
    cp(
      join(
        packageRoot,
        "scripts",
        "lib",
        "provider-registry-evidence-binding-distribution-browser-entry.mjs",
      ),
      c09BrowserReplayEntryPath,
    ),
    cp(
      join(
        packageRoot,
        "scripts",
        "lib",
        "provider-registry-evidence-binding-distribution-browser-runtime.mjs",
      ),
      c09BrowserReplayRuntimePath,
    ),
  ]);
  const c09ReplayViteDependencyGuardNonce =
    createC09ViteDependencyGuardNonce();
  await writeFile(
    join(consumerRoot, "vite-c09-replay.config.mjs"),
    [
      'import { resolve } from "node:path";',
      ...renderC09ViteDependencyGuardConfigPreamble(
        c09ReplayViteDependencyGuardNonce,
      ),
      'export default {',
      '  plugins: [c09ClosedBrowserDependencyGuard()],',
      '  build: {',
      '    target: "es2022",',
      '    outDir: "c09-replay-dist",',
      '    emptyOutDir: true,',
      '    minify: false,',
      '    lib: { entry: resolve("provider-registry-evidence-binding-distribution-browser-entry.mjs"), formats: ["es"], fileName: "c09-replay-kat" },',
      '  },',
      '};',
    ].join("\n"),
    "utf8",
  );
  const c09ReplayViteBuildResult = await runC09DedicatedCommandV1(
    c09DedicatedGate,
    viteCommand,
    ["build", "--config", "vite-c09-replay.config.mjs"],
    {
      cwd: consumerRoot,
      env: { NODE_OPTIONS: C09_NODE_OPTIONS },
      timeoutMs: C09_VITE_BUILD_TIMEOUT_MS,
    },
  );
  const c09ReplayViteBuildOutput = [
    c09ReplayViteBuildResult.stdout,
    c09ReplayViteBuildResult.stderr,
  ].join("\n");
  if (
    /(?:externalized for browser compatibility|__vite-browser-external)/u.test(
      c09ReplayViteBuildOutput,
    )
  ) {
    throw new Error(
      "Vite externalized a Node-only dependency from the C09 replay bundle",
    );
  }
  const c09ReplayJavaScriptFiles = (
    await listFiles(join(consumerRoot, "c09-replay-dist"))
  ).filter((filePath) => /\.(?:m?js)$/u.test(filePath));
  const c09ReplayEntryCandidates = c09ReplayJavaScriptFiles.filter((filePath) =>
    basename(filePath).startsWith("c09-replay-kat."),
  );
  if (c09ReplayEntryCandidates.length !== 1) {
    throw new Error(
      `Vite emitted ${c09ReplayEntryCandidates.length} C09 replay entries instead of exactly one`,
    );
  }
  const [c09ReplayEntryFile] = c09ReplayEntryCandidates;
  for (const filePath of c09ReplayJavaScriptFiles) {
    const source = await readFile(filePath, "utf8");
    if (
      !hasExactC09ViteDependencyGuardSentinel(
        source,
        c09ReplayViteDependencyGuardNonce,
      )
    ) {
      throw new Error(
        `C09 replay browser bundle ${basename(filePath)} lacks the exact dependency-guard sentinel`,
      );
    }
    const dependency = findBrowserRuntimeDependency(source);
    if (dependency !== undefined) {
      throw new Error(
        `C09 replay browser bundle ${basename(filePath)} contains ${dependency}`,
      );
    }
  }
  const c09BrowserReplayReports = await runParallelC09WorkersV1(
    c09DedicatedGate,
    C09_DISTRIBUTION_REPLAY_LANES_V1.map((_, laneIndex) => ({
      label: `packed browser replay lane ${laneIndex}`,
      command: process.execPath,
      args: [
        c09BrowserReplayRuntimePath,
        c09DedicatedGate.nonce,
        String(laneIndex),
        c09ReplayEntryFile,
        installedProviderRegistryEvidenceBindingPointGoldenPath,
        installedProviderRegistryEvidenceBindingPointInvalidPath,
        installedStrictManifestPath,
      ],
      cwd: consumerRoot,
      env: { NODE_OPTIONS: C09_BROWSER_RUNTIME_NODE_OPTIONS },
    })),
  );
  const c09BrowserReplaySummary = validateC09ReplayReportsV1(
    c09BrowserReplayReports,
    "browser",
    c09DedicatedGate.nonce,
    c09ExpectedInvalidManifest,
  );
  if (
    c09NodeReplaySummary.caseCount !== c09BrowserReplaySummary.caseCount ||
    c09NodeReplaySummary.shardCount !== c09BrowserReplaySummary.shardCount ||
    c09NodeReplaySummary.aggregateContentDigest !==
      c09BrowserReplaySummary.aggregateContentDigest
  ) {
    throw new Error("Packed Node/browser C09 replay aggregates diverged");
  }

  const c09MinimalEntrySource = [
    'import { validateProviderRegistryEvidenceBindingPointClosureV1 } from "@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point";',
    'import { STRICT_ED25519_VERIFICATION_PROFILE_V1, validatePrimeSubgroupPoint, verifyRawEd25519 } from "@understand-code/durable-object-provider-contracts/strict-ed25519";',
    'import { PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1, PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1, attestProviderStrictEd25519CryptoHostV1 } from "@understand-code/durable-object-provider-contracts/strict-ed25519-conformance";',
    `const minimalGoldenData = globalThis[${JSON.stringify(C09_BROWSER_MINIMAL_GOLDEN_DATA_GLOBAL_V1)}];`,
    `delete globalThis[${JSON.stringify(C09_BROWSER_MINIMAL_GOLDEN_DATA_GLOBAL_V1)}];`,
    'if (minimalGoldenData === null || typeof minimalGoldenData !== "object" || Array.isArray(minimalGoldenData) || minimalGoldenData.compatibleBase === null || typeof minimalGoldenData.compatibleBase !== "object" || Array.isArray(minimalGoldenData.compatibleBase) || minimalGoldenData.expected === null || typeof minimalGoldenData.expected !== "object" || Array.isArray(minimalGoldenData.expected)) throw new Error("minimal C09 golden data was not injected as ordinary parsed data");',
    'const compatibleBase = structuredClone(minimalGoldenData.compatibleBase);',
    'if (Object.keys(compatibleBase).length !== 21 || Object.hasOwn(compatibleBase, "strictCryptoCapability")) throw new Error("minimal C09 compatible base did not retain exactly 21 non-capability fields");',
    `const strictManifestBytes = new TextEncoder().encode(${JSON.stringify(packedStrictEd25519ManifestText)});`,
    'let pointCalls = 0;',
    'let verifyCalls = 0;',
    'const strictHost = Object.freeze({',
    '  verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,',
    '  validatePrimeSubgroupPoint(point) { pointCalls += 1; return validatePrimeSubgroupPoint(point); },',
    '  verifyRawEd25519(publicKey, message, signature) { verifyCalls += 1; return verifyRawEd25519(publicKey, message, signature); },',
    '});',
    'const resourceHost = Object.freeze({',
    '  readFixedSignedPackageResource(path, maxBytes) {',
    '    if (path !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 || maxBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1 || strictManifestBytes.byteLength > maxBytes) throw new Error("minimal C09 fixed resource request mismatch");',
    '    return strictManifestBytes;',
    '  },',
    '});',
    'const strictCapability = await attestProviderStrictEd25519CryptoHostV1({ host: strictHost, resourceHost });',
    'pointCalls = 0;',
    'verifyCalls = 0;',
    'const request = { ...compatibleBase, strictCryptoCapability: strictCapability };',
    'if (Object.keys(request).length !== 22 || request.strictCryptoCapability !== strictCapability) throw new Error("minimal C09 request did not contain exactly 22 fields including the opaque capability identity");',
    'const closure = await validateProviderRegistryEvidenceBindingPointClosureV1(request);',
    'const snapshotProjection = {',
    '  installationIdentityGenerationId: closure.registryManifestHistoryClosure.installationIdentityGenerationId,',
    '  registryManifestContentDigest: closure.registryManifestHistoryClosure.currentRegistryManifest.contentDigest,',
    '  candidateRegistryEntryContentDigest: closure.candidateRegistryEntryContentDigest,',
    '  providerId: closure.candidateRegistryEntry.providerId,',
    '  runtimeAttestationContentDigest: closure.runtimeAttestationPointClosure.runtimeAttestation.contentDigest,',
    '  evidenceId: closure.providerFeasibilityEvidence.evidenceId,',
    '  evidenceContentDigest: closure.providerFeasibilityEvidence.contentDigest,',
    '  evidenceRelativePath: closure.relativePath,',
    '  qaApproverKeyId: closure.qaApproverPublicKey.keyId,',
    '  releaseApproverKeyId: closure.releaseApproverPublicKey.keyId,',
    '};',
    'if (Object.keys(snapshotProjection).length !== 10 || JSON.stringify(snapshotProjection) !== JSON.stringify(minimalGoldenData.expected.successProjection)) throw new Error("minimal tree-shaken C09 10-field closure projection drifted");',
    'if (minimalGoldenData.expected.completeCryptoClosure?.pointAdmissionCount !== 24 || minimalGoldenData.expected.completeCryptoClosure?.signatureVerificationCount !== 46) throw new Error("minimal C09 injected expected crypto closure drifted from 24/46");',
    'if (closure.authority !== "none_registry_entry_evidence_binding_structure_only" || pointCalls !== 24 || verifyCalls !== 46) throw new Error(`minimal tree-shaken C09 golden closure failed: ${pointCalls}/${verifyCalls}`);',
    'export const c09MinimalKatResult = Object.freeze({ authority: closure.authority, pointCalls, verifyCalls, requestFieldCount: Object.keys(request).length, projectionFieldCount: Object.keys(snapshotProjection).length });',
  ].join("\n");
  const c09MinimalImportSurface = inspectMinimalBrowserImportSurface(
    c09MinimalEntrySource,
  );
  if (!hasExactMinimalBrowserImportSurface(c09MinimalImportSurface)) {
    throw new Error(
      `Minimal C09 Vite consumer import surface drifted: ${c09MinimalImportSurface.violation ?? c09MinimalImportSurface.specifiers.join(", ")}`,
    );
  }
  const c09MinimalSourceDependency = findBrowserRuntimeDependency(
    c09MinimalEntrySource,
    {
      allowedStaticBareModuleSpecifiers:
        C09_MINIMAL_EXPECTED_IMPORT_SPECIFIERS,
    },
  );
  if (c09MinimalSourceDependency !== undefined) {
    throw new Error(
      `Minimal C09 Vite consumer contains ${c09MinimalSourceDependency}`,
    );
  }
  await writeFile(
    join(consumerRoot, "c09-minimal-entry.js"),
    c09MinimalEntrySource,
    "utf8",
  );
  const c09MinimalViteDependencyGuardNonce =
    createC09ViteDependencyGuardNonce();
  await writeFile(
    join(consumerRoot, "vite-c09-minimal.config.mjs"),
    [
      'import { resolve } from "node:path";',
      ...renderC09ViteDependencyGuardConfigPreamble(
        c09MinimalViteDependencyGuardNonce,
      ),
      'export default {',
      '  plugins: [c09ClosedBrowserDependencyGuard()],',
      '  build: {',
      '    target: "es2022",',
      '    outDir: "c09-minimal-dist",',
      '    emptyOutDir: true,',
      '    minify: false,',
      '    lib: { entry: resolve("c09-minimal-entry.js"), formats: ["es"], fileName: "c09-minimal-kat" },',
      '  },',
      '};',
    ].join("\n"),
    "utf8",
  );
  const c09MinimalViteBuildResult = await runC09DedicatedCommandV1(
    c09DedicatedGate,
    viteCommand,
    ["build", "--config", "vite-c09-minimal.config.mjs"],
    {
      cwd: consumerRoot,
      env: { NODE_OPTIONS: C09_NODE_OPTIONS },
      timeoutMs: C09_VITE_BUILD_TIMEOUT_MS,
    },
  );
  const c09MinimalViteBuildOutput = [
    c09MinimalViteBuildResult.stdout,
    c09MinimalViteBuildResult.stderr,
  ].join("\n");
  if (
    /(?:externalized for browser compatibility|__vite-browser-external)/u.test(
      c09MinimalViteBuildOutput,
    )
  ) {
    throw new Error(
      "Vite externalized a Node-only dependency from the minimal C09 browser bundle",
    );
  }
  const c09MinimalJavaScriptFiles = (
    await listFiles(join(consumerRoot, "c09-minimal-dist"))
  ).filter((filePath) => /\.(?:m?js)$/u.test(filePath));
  const c09MinimalEntryCandidates = c09MinimalJavaScriptFiles.filter(
    (filePath) => basename(filePath).startsWith("c09-minimal-kat."),
  );
  if (c09MinimalEntryCandidates.length !== 1) {
    throw new Error(
      `Vite emitted ${c09MinimalEntryCandidates.length} independent minimal C09 KAT entry candidates instead of exactly one`,
    );
  }
  const [c09MinimalEntryFile] = c09MinimalEntryCandidates;
  for (const filePath of c09MinimalJavaScriptFiles) {
    const source = await readFile(filePath, "utf8");
    if (
      !hasExactC09ViteDependencyGuardSentinel(
        source,
        c09MinimalViteDependencyGuardNonce,
      )
    ) {
      throw new Error(
        `Minimal C09 browser bundle ${basename(filePath)} lacks the exact post-tree-shake dependency-guard sentinel`,
      );
    }
    const dependency = findBrowserRuntimeDependency(source);
    if (dependency !== undefined) {
      throw new Error(
        `Minimal C09 browser bundle ${basename(filePath)} contains ${dependency}`,
      );
    }
  }
  const c09MinimalRuntimeProbe = join(
    consumerRoot,
    "c09-minimal-runtime-probe.mjs",
  );
  await writeFile(
    c09MinimalRuntimeProbe,
    [
      'import { readFile } from "node:fs/promises";',
      `const minimalGoldenFileBytes = await readFile(${JSON.stringify(installedProviderRegistryEvidenceBindingPointGoldenPath)});`,
      'if (minimalGoldenFileBytes.byteLength <= 0) throw new Error("installed minimal C09 golden resource is empty");',
      'const minimalGoldenManifest = JSON.parse(new TextDecoder().decode(minimalGoldenFileBytes));',
      `Object.defineProperty(globalThis, ${JSON.stringify(C09_BROWSER_MINIMAL_GOLDEN_DATA_GLOBAL_V1)}, { configurable: true, value: { compatibleBase: minimalGoldenManifest.compatibleBase, expected: minimalGoldenManifest.expected } });`,
      "delete globalThis.process;",
      "delete globalThis.Buffer;",
      `const { c09MinimalKatResult } = await import(${JSON.stringify(`./c09-minimal-dist/${basename(c09MinimalEntryFile)}`)});`,
      `if (Object.hasOwn(globalThis, ${JSON.stringify(C09_BROWSER_MINIMAL_GOLDEN_DATA_GLOBAL_V1)})) throw new Error("minimal C09 golden-data injection was not deleted");`,
      'if (c09MinimalKatResult.authority !== "none_registry_entry_evidence_binding_structure_only" || c09MinimalKatResult.pointCalls !== 24 || c09MinimalKatResult.verifyCalls !== 46 || c09MinimalKatResult.requestFieldCount !== 22 || c09MinimalKatResult.projectionFieldCount !== 10) throw new Error(`minimal tree-shaken C09 runtime mismatch: ${JSON.stringify(c09MinimalKatResult)}`);',
    ].join("\n"),
    "utf8",
  );
  await runC09DedicatedCommandV1(
    c09DedicatedGate,
    process.execPath,
    [c09MinimalRuntimeProbe],
    {
    cwd: consumerRoot,
    env: { NODE_OPTIONS: C09_BROWSER_RUNTIME_NODE_OPTIONS },
    timeoutMs: C09_MINIMAL_RUNTIME_TIMEOUT_MS,
    },
  );
  c09DedicatedGateEvidence =
    await stopC09DedicatedGateMonitorV1(c09DedicatedGate, true);

  await run(process.execPath, [runtimeProbe], {
    cwd: consumerRoot,
    env: { NODE_OPTIONS: C09_NODE_OPTIONS },
    timeoutMs: DEFAULT_COMMAND_TIMEOUT_MS,
  });
  await run(
    process.execPath,
    [
      typescriptCli,
      "--noEmit",
      "--strict",
      "--skipLibCheck",
      "--target",
      "ES2022",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      typeProbe,
    ],
    {
      cwd: consumerRoot,
      env: { NODE_OPTIONS: C09_NODE_OPTIONS },
    },
  );
  await runLegacyMainViteBrowserKatsV1();

  const packedSchemaRelativePaths = await listRelativeSchemaPaths(
    join(installedRoot, "schemas", "v1"),
  );
  assertExactSortedPathSet(
    packedSchemaRelativePaths,
    sourceSchemaRelativePaths,
    "Cold-installed provider schema path set",
  );

  for (const requiredPath of [
    "dist/index.js",
    "dist/index.d.ts",
    "dist/bootstrap-trust-bundle.js",
    "dist/bootstrap-trust-bundle.d.ts",
    "dist/bootstrap-trust-golden.js",
    "dist/bootstrap-trust-golden.d.ts",
    "dist/bootstrap-trust-invalid.js",
    "dist/bootstrap-trust-invalid.d.ts",
    "dist/installation-bootstrap-trust.js",
    "dist/installation-bootstrap-trust.d.ts",
    "dist/jcs.js",
    "dist/provider-error.js",
    "dist/provider-error.d.ts",
    "dist/public-key-digest.js",
    "dist/public-key-digest.d.ts",
    "dist/provider-distribution-trust.js",
    "dist/provider-distribution-trust.d.ts",
    "dist/provider-registry-trust.js",
    "dist/provider-registry-trust.d.ts",
    "dist/provider-fixed-locator.js",
    "dist/provider-fixed-locator.d.ts",
    "dist/provider-registry-root-history.js",
    "dist/provider-registry-root-history.d.ts",
    "dist/provider-registry-root-history-fixtures.js",
    "dist/provider-registry-root-history-fixtures.d.ts",
    "dist/provider-registry-root-history-invalid-definitions.js",
    "dist/provider-registry-root-history-invalid-definitions.d.ts",
    "dist/provider-registry-records.js",
    "dist/provider-registry-records.d.ts",
    "dist/provider-registry-manifest-history.js",
    "dist/provider-registry-manifest-history.d.ts",
    "dist/provider-registry-manifest-fixtures.js",
    "dist/provider-registry-manifest-fixtures.d.ts",
    "dist/provider-registry-manifest-invalid-definitions.js",
    "dist/provider-registry-manifest-invalid-definitions.d.ts",
    "dist/provider-registry.js",
    "dist/provider-registry.d.ts",
    "dist/provider-real-filesystem-source.js",
    "dist/provider-real-filesystem-source.d.ts",
    "dist/provider-real-filesystem-source-fixtures.js",
    "dist/provider-real-filesystem-source-fixtures.d.ts",
    "dist/provider-real-filesystem-conformance-result.js",
    "dist/provider-real-filesystem-conformance-result.d.ts",
    "dist/provider-real-filesystem-conformance-result-fixtures.js",
    "dist/provider-real-filesystem-conformance-result-fixtures.d.ts",
    "dist/provider-runtime-attestation-point.js",
    "dist/provider-runtime-attestation-point.d.ts",
    "dist/provider-runtime-attestation-point-fixtures.js",
    "dist/provider-runtime-attestation-point-fixtures.d.ts",
    "dist/provider-feasibility-evidence-point.js",
    "dist/provider-feasibility-evidence-point.d.ts",
    "dist/provider-feasibility-evidence-point-fixtures.js",
    "dist/provider-feasibility-evidence-point-fixtures.d.ts",
    "dist/provider-registry-evidence-binding-point.js",
    "dist/provider-registry-evidence-binding-point.d.ts",
    "dist/provider-registry-evidence-binding-point-fixtures.js",
    "dist/provider-registry-evidence-binding-point-fixtures.d.ts",
    "dist/provider-registry-evidence-binding-topology-proof.js",
    "dist/provider-registry-evidence-binding-topology-proof.d.ts",
    "dist/provider-target-discovery-point.js",
    "dist/provider-target-discovery-point.d.ts",
    "dist/provider-target-discovery-point-fixtures.js",
    "dist/provider-target-discovery-point-fixtures.d.ts",
    "dist/provider-point-raw-admission-internal.js",
    "dist/provider-point-raw-admission-internal.d.ts",
    "dist/provider-point-runtime-internal.js",
    "dist/provider-point-runtime-internal.d.ts",
    "dist/provider-target-discovery-point-internal.js",
    "dist/provider-target-discovery-point-internal.d.ts",
    "dist/strict-ed25519-capability-internal.js",
    "dist/strict-ed25519-capability-internal.d.ts",
    "dist/provider-release-target-universe-point.js",
    "dist/provider-release-target-universe-point.d.ts",
    "dist/provider-release-target-universe-point-fixtures.js",
    "dist/provider-release-target-universe-point-fixtures.d.ts",
    "dist/provider-trust-policy.js",
    "dist/provider-trust-policy.d.ts",
    "dist/strict-ed25519.js",
    "dist/strict-ed25519.d.ts",
    "dist/strict-ed25519-conformance.js",
    "dist/strict-ed25519-conformance.d.ts",
    "schemas/v1/canonical-byte-string.schema.json",
    "schemas/v1/ed25519-public-key-digest.schema.json",
    "schemas/v1/ed25519-public-key-digest-golden-manifest.schema.json",
    "schemas/v1/provider-strict-ed25519-adversarial-manifest-envelope.schema.json",
    "schemas/v1/provider-bootstrap-trust-bundle-envelope.schema.json",
    "schemas/v1/provider-bootstrap-trust-golden-manifest.schema.json",
    "schemas/v1/provider-bootstrap-trust-invalid-manifest.schema.json",
    "schemas/v1/short-store-filename-key-syntax.schema.json",
    "schemas/v1/hashed-store-filename-key.schema.json",
    "schemas/v1/store-filename-key-syntax.schema.json",
    "schemas/v1/provider-registry-root-metadata-locator.schema.json",
    "schemas/v1/provider-registry-root-cross-signature-wrapper.schema.json",
    "schemas/v1/provider-registry-root-recovery-signature-wrapper.schema.json",
    "schemas/v1/provider-registry-root-history-golden-manifest.schema.json",
    "schemas/v1/provider-registry-root-history-invalid-manifest.schema.json",
    "schemas/v1/provider-registry-root-history-invalid-stage.schema.json",
    "schemas/v1/provider-registry-root-history-invalid-reason.schema.json",
    "schemas/v1/provider-registry-root-metadata.schema.json",
    "schemas/v1/provider-registry-manifest-locator.schema.json",
    "schemas/v1/provider-registry-manifest-envelope.schema.json",
    "schemas/v1/provider-registry-manifest-history-golden-manifest.schema.json",
    "schemas/v1/provider-registry-manifest-history-invalid-manifest.schema.json",
    "schemas/v1/provider-registry-manifest-history-invalid-stage.schema.json",
    "schemas/v1/provider-registry-manifest-history-invalid-reason.schema.json",
    "schemas/v1/provider-real-filesystem-fixture-corpus-manifest-envelope.schema.json",
    "schemas/v1/provider-real-filesystem-fixture-corpus-manifest-pin.schema.json",
    "schemas/v1/provider-real-filesystem-fixture-corpus-manifest-locator.schema.json",
    "schemas/v1/provider-real-filesystem-suite-manifest-envelope.schema.json",
    "schemas/v1/provider-real-filesystem-suite-manifest-pin.schema.json",
    "schemas/v1/provider-real-filesystem-suite-manifest-locator.schema.json",
    "schemas/v1/provider-real-filesystem-source-golden-manifest.schema.json",
    "schemas/v1/provider-real-filesystem-source-invalid-manifest.schema.json",
    "schemas/v1/provider-public-support-taxonomy-locator.schema.json",
    "schemas/v1/provider-release-matrix-locator.schema.json",
    "schemas/v1/provider-target-discovery-fixture-manifest-locator.schema.json",
    "schemas/v1/provider-target-discovery-runner-run-locator.schema.json",
    "schemas/v1/provider-target-discovery-result-locator.schema.json",
    "schemas/v1/provider-target-discovery-result-pin.schema.json",
    "schemas/v1/provider-target-discovery-point-golden-manifest.schema.json",
    "schemas/v1/provider-target-discovery-point-invalid-manifest.schema.json",
    "schemas/v1/provider-release-coverage-incomplete-reason.schema.json",
    "schemas/v1/provider-release-target-bucket-coverage.schema.json",
    "schemas/v1/provider-release-target-coverage-basis.schema.json",
    "schemas/v1/provider-release-target-coverage-resolution.schema.json",
    "schemas/v1/provider-release-target-universe-bucket.schema.json",
    "schemas/v1/provider-release-target-universe-unsigned-claims.schema.json",
    "schemas/v1/provider-release-target-universe.schema.json",
    "schemas/v1/provider-release-target-universe-envelope.schema.json",
    "schemas/v1/provider-release-target-universe-pin.schema.json",
    "schemas/v1/provider-release-target-universe-signature.schema.json",
    "schemas/v1/provider-release-target-universe-signature-wrapper.schema.json",
    "schemas/v1/provider-release-target-universe-point-invalid-stage.schema.json",
    "schemas/v1/provider-release-target-universe-point-invalid-reason.schema.json",
    "schemas/v1/provider-release-target-universe-point-golden-manifest.schema.json",
    "schemas/v1/provider-release-target-universe-point-invalid-manifest.schema.json",
    "schemas/v1/provider-real-filesystem-conformance-result-id.schema.json",
    "schemas/v1/provider-real-filesystem-conformance-result.schema.json",
    "schemas/v1/provider-real-filesystem-conformance-result-envelope.schema.json",
    "schemas/v1/provider-real-filesystem-conformance-result-locator.schema.json",
    "schemas/v1/provider-real-filesystem-conformance-result-pin.schema.json",
    "schemas/v1/provider-real-filesystem-conformance-result-golden-manifest.schema.json",
    "schemas/v1/provider-real-filesystem-conformance-result-invalid-manifest.schema.json",
    "schemas/v1/provider-runtime-attestation-point-golden-manifest.schema.json",
    "schemas/v1/provider-runtime-attestation-point-invalid-manifest.schema.json",
    "schemas/v1/provider-runtime-attestation-point-invalid-reason.schema.json",
    "schemas/v1/provider-runtime-attestation-point-invalid-stage.schema.json",
    "schemas/v1/provider-feasibility-qa-signature.schema.json",
    "schemas/v1/provider-feasibility-release-signature.schema.json",
    "schemas/v1/provider-feasibility-evidence-id-fields.schema.json",
    "schemas/v1/provider-feasibility-evidence-unsigned-claims.schema.json",
    "schemas/v1/provider-feasibility-evidence.schema.json",
    "schemas/v1/provider-feasibility-evidence-envelope.schema.json",
    "schemas/v1/provider-feasibility-evidence-qa-signature-wrapper.schema.json",
    "schemas/v1/provider-feasibility-evidence-release-signature-wrapper.schema.json",
    "schemas/v1/provider-feasibility-evidence-point-invalid-stage.schema.json",
    "schemas/v1/provider-feasibility-evidence-point-invalid-reason.schema.json",
    "schemas/v1/provider-feasibility-evidence-point-golden-manifest.schema.json",
    "schemas/v1/provider-feasibility-evidence-point-invalid-manifest.schema.json",
    "schemas/v1/provider-registry-evidence-binding-point-invalid-stage.schema.json",
    "schemas/v1/provider-registry-evidence-binding-point-invalid-reason.schema.json",
    "schemas/v1/provider-registry-evidence-binding-point-compatible-base.schema.json",
    "schemas/v1/provider-registry-evidence-binding-point-success-projection.schema.json",
    "schemas/v1/provider-registry-evidence-binding-point-golden-manifest.schema.json",
    "schemas/v1/provider-registry-evidence-binding-point-invalid-manifest.schema.json",
    "schemas/v1/provider-registry-evidence-binding-topology-proof.schema.json",
    "schemas/v1/store-durable-object-provider-isolation.schema.json",
    "schemas/v1/store-durable-object-provider-policy.schema.json",
    "schemas/v1/store-manifest-compare-append-receipt-ledger-policy.schema.json",
    "schemas/v1/store-provider-filesystem-profile-fields.schema.json",
    "schemas/v1/store-durable-object-provider-runtime-attestation.schema.json",
    "schemas/v1/store-durable-object-provider-verification-keys.schema.json",
    "schemas/v1/store-durable-object-provider-registry-entry.schema.json",
    "schemas/v1/provider-signed-distribution-root-binding.schema.json",
    "schemas/v1/installation-identity-bootstrap-trust-fields.schema.json",
    "schemas/v1/provider-unavailable-tool-error.schema.json",
    "fixtures/v1/golden/manifest.json",
    "fixtures/v1/golden/ed25519-public-key-digest-v1.json",
    "fixtures/v1/golden/bootstrap-trust-bundle-v1.json",
    "fixtures/v1/golden/provider-bootstrap-structure-crypto-v1.json",
    "fixtures/v1/golden/provider-registry-root-history-v1.json",
    "fixtures/v1/golden/provider-registry-entry-manifest-history-v1.json",
    "fixtures/v1/golden/provider-real-filesystem-source-v1.json",
    "fixtures/v1/golden/provider-target-discovery-point-v1.json",
    "fixtures/v1/golden/provider-real-filesystem-conformance-result-v1.json",
    "fixtures/v1/golden/provider-runtime-attestation-point-v1.json",
    "fixtures/v1/golden/provider-feasibility-evidence-point-v1.json",
    "fixtures/v1/golden/provider-registry-evidence-binding-point-v1.json",
    "fixtures/v1/golden/provider-registry-evidence-binding-topology-proof-v1.json",
    "fixtures/v1/golden/provider-release-target-universe-point-v1.json",
    "fixtures/v1/invalid/manifest.json",
    "fixtures/v1/invalid/provider-bootstrap-structure-crypto-v1.json",
    "fixtures/v1/invalid/provider-registry-root-history-v1.json",
    "fixtures/v1/invalid/provider-registry-entry-manifest-history-v1.json",
    "fixtures/v1/invalid/provider-real-filesystem-source-v1.json",
    "fixtures/v1/invalid/provider-target-discovery-point-v1.json",
    "fixtures/v1/invalid/provider-real-filesystem-conformance-result-v1.json",
    "fixtures/v1/invalid/provider-runtime-attestation-point-v1.json",
    "fixtures/v1/invalid/provider-feasibility-evidence-point-v1.json",
    "fixtures/v1/invalid/provider-registry-evidence-binding-point-v1.json",
    "fixtures/v1/invalid/provider-release-target-universe-point-v1.json",
    "fixtures/v1/invalid/provider-registry-entry-manifest-history-v1.recipe-dialect.md",
    "fixtures/v1/invalid/provider-registry-root-history-invalid-recipe-v1.md",
    "fixtures/v1/reference/provider-unavailable-tool-errors.json",
    "fixtures/v1/invalid/provider-unavailable-tool-errors.json",
    "provider/ed25519-strict-host-conformance-v1.json",
    "provider/bootstrap-trust-bundle-v1.json",
    "dist/browser-zod.js",
    "dist/browser-zod.LICENSE.txt",
    "dist/zod-runtime.js",
    "dist/zod-runtime.d.ts",
    "README.md",
  ]) {
    if (!(await isFile(join(installedRoot, requiredPath)))) {
      throw new Error(`Packed provider contracts are missing ${requiredPath}`);
    }
  }
  for (const forbiddenPath of ["src", "scripts", "test", "node_modules"]) {
    try {
      await stat(join(installedRoot, forbiddenPath));
      throw new Error(`Packed provider contracts contain ${forbiddenPath}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes("contain")) throw error;
    }
  }

  process.stdout.write(
    `Verified packed provider contracts with exactly ${explicitSpecifiers.length} public module exports and ${packedSchemaRelativePaths.length} JSON Schemas, browser bundles passing the dependency scanner plus no-string-codegen runtime gate and no-global runtime probes, browser ESM trust checks for bootstrap (62 point/31 signature), root history (11 point/9 signature), 7-generation Registry history (24 point/38 signature), 89 anchored Registry invalid recipes/materialized-request digests with 3 exact opaque consumer rejections, signed real filesystem source closure (12 records/4 cases/8 cuts plus 43 invalid cases), signed target discovery point closure (1 point/6 signatures with five locators), unsigned real filesystem conformance result closure (8 tuples/1 point/6 signatures/no seventh signature/50 replayed invalid cases/Locator-only path), root-signed runtime attestation point closure (1 point/7 signatures/50 inherited plus 72 point-specific invalid recipes), QA/Release-signed feasibility evidence point closure (3 point/11 signatures per success, passed/failed/unsupported positives, 122 inherited plus 105 point-specific invalid recipes), Registry Entry/Evidence supplied-history candidate closure (24 point/46 signatures, all 354 cases replayed as the exact 12-shard aggregate in four fixed packed-Node lanes and four fixed packed-browser lanes, plus direct replay, generator check and independent minimal Vite golden replay) under the dedicated same-sample gate (${c09DedicatedGateEvidence.wallTimeMs.toFixed(1)} ms, ${c09DedicatedGateEvidence.peakTreeRssBytes} process-tree RSS bytes, ${c09DedicatedGateEvidence.sampleCount} samples), with the full main Node, type and Vite/browser regressions retained outside that dedicated resource window, and release target Universe closure (4 genuine positives at 1 point/7 signatures each, 116 inherited plus 169 point-specific fresh invalid recipes replayed in Node and browser) with exact root/subpath identities, the 21-branch topology proof and private internals unavailable.\n`,
  );
  process.stdout.write(
    `C09 dedicated peak process roles: ${JSON.stringify({ countingPolicy: c09DedicatedGateEvidence.countingPolicy, processes: c09DedicatedGateEvidence.peakRoles })}\n`,
  );
} finally {
  if (c09DedicatedGate !== undefined) {
    try {
      if (isC09ProcessTreeLiveV1(c09DedicatedGate.child)) {
        await stopC09DedicatedGateMonitorV1(c09DedicatedGate, false);
      } else if (!c09DedicatedGate.stopped) {
        const monitorExit = await c09DedicatedGate.completion;
        c09DedicatedGate.stopped = true;
        if (
          monitorExit.error !== undefined ||
          monitorExit.status !== 0 ||
          monitorExit.signal !== null
        ) {
          throw new Error(
            `C09 RSS monitor was already dead during cleanup: ${JSON.stringify(monitorExit)}`,
          );
        }
      }
    } catch (error) {
      process.stderr.write(
        `C09 RSS monitor cleanup also failed: ${error instanceof Error ? error.stack : String(error)}\n`,
      );
    }
  }
  await rm(temporaryRoot, { recursive: true, force: true });
}
}
