import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { open, rename, rm } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const PROFILE_V1 =
  "provider_registry_evidence_binding_distribution_process_tree_rss_v1";
const SAMPLE_INTERVAL_MS = 50;

function parseArgumentsV1(argv) {
  if (argv.length !== 4) {
    throw new TypeError("C09 RSS monitor requires exactly four arguments");
  }
  const [outputPath, stopPath, nonce, rootPidText] = argv;
  const rootPid = Number(rootPidText);
  if (
    !outputPath.startsWith("/") ||
    !stopPath.startsWith("/") ||
    !/^[0-9a-f]{32}$/u.test(nonce) ||
    !Number.isSafeInteger(rootPid) ||
    rootPid <= 1
  ) {
    throw new TypeError("C09 RSS monitor arguments are invalid");
  }
  return { outputPath, stopPath, nonce, rootPid };
}

function roleV1(pid, command, input) {
  if (pid === input.rootPid) return "distribution_parent";
  if (pid === process.pid) return "rss_monitor";
  if (command.includes("generate-provider-registry-evidence-binding-point.mjs")) {
    return "generator_check";
  }
  if (command.includes("provider-registry-evidence-binding-point-fixtures-replay-lane-")) {
    return "direct_replay";
  }
  if (command.includes("distribution-node-worker.mjs")) {
    return "packed_node_replay_lane";
  }
  if (command.includes("distribution-browser-runtime.mjs")) {
    return "packed_browser_replay_lane";
  }
  if (command.includes("vite-c09-replay.config.mjs")) {
    return "packed_browser_replay_vite";
  }
  if (command.includes("vite-c09-minimal.config.mjs")) {
    return "minimal_vite";
  }
  if (command.includes("c09-minimal-runtime-probe.mjs")) {
    return "minimal_browser_runtime";
  }
  if (command.includes("vite.config.mjs")) return "main_vite";
  if (command.includes("browser-runtime-probe.mjs")) {
    return "main_browser_runtime";
  }
  if (command.includes("runtime-probe.mjs")) return "main_node_runtime";
  if (/(?:^|\/)vitest(?:\s|$)/u.test(command)) return "direct_replay";
  if (/(?:^|\/)vite(?:\s|$)/u.test(command)) return "vite_child";
  return "distribution_descendant";
}

function sampleProcessTreeV1(input) {
  const result = spawnSync(
    "ps",
    ["-axo", "pid=,ppid=,rss=,command="],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(
      `C09 RSS monitor ps failed: ${result.status ?? result.error?.message ?? "unknown"}`,
    );
  }
  const records = [];
  const children = new Map();
  for (const line of result.stdout.split("\n")) {
    const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/u.exec(line);
    if (match === null) continue;
    const pid = Number(match[1]);
    const parentPid = Number(match[2]);
    const rssKiB = Number(match[3]);
    if (
      !Number.isSafeInteger(pid) ||
      !Number.isSafeInteger(parentPid) ||
      !Number.isSafeInteger(rssKiB)
    ) {
      throw new Error("C09 RSS monitor received an invalid ps row");
    }
    const record = { pid, parentPid, rssKiB, command: match[4] };
    records.push(record);
    const siblings = children.get(parentPid) ?? [];
    siblings.push(record);
    children.set(parentPid, siblings);
  }
  const root = records.find(({ pid }) => pid === input.rootPid);
  if (root === undefined) {
    throw new Error("C09 RSS monitor lost the distribution parent");
  }
  const selected = [];
  const pending = [root];
  const seen = new Set();
  while (pending.length > 0) {
    const record = pending.pop();
    if (record === undefined || seen.has(record.pid)) continue;
    seen.add(record.pid);
    selected.push(record);
    pending.push(...(children.get(record.pid) ?? []));
  }
  const processes = selected
    .map(({ pid, parentPid, rssKiB, command }) => ({
      pid,
      parentPid,
      rssBytes: rssKiB * 1024,
      role: roleV1(pid, command, input),
    }))
    .sort((left, right) => left.pid - right.pid);
  return {
    aggregateRssBytes: processes.reduce(
      (total, { rssBytes }) => total + rssBytes,
      0,
    ),
    processes,
  };
}

function readStopNonceV1(path) {
  if (!existsSync(path)) return undefined;
  const value = readFileSync(path, "utf8");
  if (!/^[0-9a-f]{32}\n?$/u.test(value)) {
    throw new Error("C09 RSS monitor stop file is garbled");
  }
  return value.trim();
}

async function writeAtomicReportV1(outputPath, state, report) {
  const temporaryPath = `${outputPath}.${state}.${process.pid}.tmp`;
  let created = false;
  try {
    const handle = await open(temporaryPath, "wx", 0o600);
    created = true;
    try {
      await handle.writeFile(`${JSON.stringify(report)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporaryPath, outputPath);
    created = false;
  } finally {
    if (created) await rm(temporaryPath, { force: true });
  }
}

const input = parseArgumentsV1(process.argv.slice(2));
const startedAt = performance.now();
await writeAtomicReportV1(
  input.outputPath,
  "ready",
  {
    profile: PROFILE_V1,
    state: "ready",
    nonce: input.nonce,
    rootPid: input.rootPid,
    monitorPid: process.pid,
    sampleIntervalMs: SAMPLE_INTERVAL_MS,
    countingPolicy:
      "same_sample_distribution_parent_and_all_live_descendants_including_monitor",
  },
);

let sampleCount = 0;
let peakSample;
for (;;) {
  const sampleStartedAt = performance.now();
  const sample = sampleProcessTreeV1(input);
  sampleCount += 1;
  if (
    peakSample === undefined ||
    sample.aggregateRssBytes > peakSample.aggregateRssBytes
  ) {
    peakSample = {
      monotonicOffsetMs: sampleStartedAt - startedAt,
      ...sample,
    };
  }
  const stopNonce = readStopNonceV1(input.stopPath);
  if (stopNonce !== undefined) {
    if (stopNonce !== input.nonce) {
      throw new Error("C09 RSS monitor stop nonce is stale");
    }
    break;
  }
  const delayMs = Math.max(
    0,
    SAMPLE_INTERVAL_MS - (performance.now() - sampleStartedAt),
  );
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

if (peakSample === undefined || sampleCount < 1) {
  throw new Error("C09 RSS monitor produced no process-tree sample");
}
await writeAtomicReportV1(
  input.outputPath,
  "complete",
  {
    profile: PROFILE_V1,
    state: "complete",
    nonce: input.nonce,
    rootPid: input.rootPid,
    monitorPid: process.pid,
    sampleIntervalMs: SAMPLE_INTERVAL_MS,
    countingPolicy:
      "same_sample_distribution_parent_and_all_live_descendants_including_monitor",
    sampleCount,
    elapsedMs: performance.now() - startedAt,
    peakSample,
  },
);
