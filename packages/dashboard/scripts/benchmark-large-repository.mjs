#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const dashboardRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(dashboardRoot, "../..");
const invocationRoot = process.env.INIT_CWD
  ? path.resolve(process.env.INIT_CWD)
  : process.cwd();

function usage() {
  return [
    "Usage: node scripts/benchmark-large-repository.mjs [--output <json-path>]",
    "",
    "Runs the deterministic self-host-shape and synthetic-10k graph benchmarks.",
    "Without --output, the complete JSON result is written to stdout.",
  ].join("\n");
}

function parseArgs(argv) {
  let outputPath = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") continue;
    if (argument === "--help" || argument === "-h") return { help: true, outputPath: null };
    if (argument !== "--output") throw new Error(`unknown argument: ${argument}`);
    if (outputPath !== null) throw new Error("--output may only be provided once");
    const value = argv[index + 1];
    if (!value || value.startsWith("-")) throw new Error("--output requires a path");
    outputPath = path.resolve(invocationRoot, value);
    index += 1;
  }
  return { help: false, outputPath };
}

function commandOutput(command, args) {
  try {
    return execFileSync(command, args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unavailable";
  }
}

function machineMetadata() {
  const cpus = os.cpus();
  return {
    capturedAt: new Date().toISOString(),
    product: {
      name: "@understand-code/skill",
      version: commandOutput(
        process.execPath,
        ["-p", "require('./package.json').version"],
      ),
      gitCommit: commandOutput("git", ["rev-parse", "HEAD"]),
      gitDirty: commandOutput("git", ["status", "--porcelain"]).length > 0,
    },
    runtime: {
      node: process.version,
      v8: process.versions.v8,
      pnpm: commandOutput("pnpm", ["--version"]),
    },
    machine: {
      platform: os.platform(),
      release: os.release(),
      architecture: os.arch(),
      cpuModel: cpus[0]?.model ?? "unknown",
      logicalCpuCount: cpus.length,
      totalMemoryBytes: os.totalmem(),
    },
  };
}

function implementationMetadata() {
  const relativeFiles = [
    "packages/dashboard/src/graphExplorer/benchmarks/largeRepositoryPerformanceFixture.ts",
    "packages/dashboard/src/graphExplorer/benchmarks/largeRepositoryBenchmark.ts",
    "packages/dashboard/src/graphExplorer/hierarchicalGraph.ts",
    "packages/dashboard/src/graphExplorer/graphQuickJump.ts",
    "packages/dashboard/src/components/graphExplorer/semanticGraphCanvasModel.ts",
    "packages/dashboard/src/utils/layoutAlgorithm.ts",
  ];
  const sha256 = (relativePath) => createHash("sha256")
    .update(readFileSync(path.join(repositoryRoot, relativePath)))
    .digest("hex");
  return {
    lockfileSha256: sha256("pnpm-lock.yaml"),
    sourceSha256: Object.fromEntries(relativeFiles.map((relativePath) => [
      relativePath,
      sha256(relativePath),
    ])),
  };
}

async function writeAtomically(targetPath, contents) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  const temporaryPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`,
  );
  await writeFile(temporaryPath, contents, { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, targetPath);
}

async function loadBenchmark() {
  const vite = await createServer({
    root: dashboardRoot,
    configFile: false,
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });
  try {
    return await vite.ssrLoadModule(
      "/src/graphExplorer/benchmarks/largeRepositoryBenchmark.ts",
    );
  } finally {
    await vite.close();
  }
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${usage()}\n`);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const benchmarkModule = await loadBenchmark();
  const benchmark = benchmarkModule.runLargeRepositoryBenchmark();
  const result = {
    ...machineMetadata(),
    implementation: implementationMetadata(),
    benchmark,
  };
  const json = `${JSON.stringify(result, null, 2)}\n`;

  if (options.outputPath) {
    await writeAtomically(options.outputPath, json);
    const measurements = benchmark.corpora.flatMap((corpus) =>
      corpus.measurements.map((measurement) =>
        `${corpus.corpus.id}/${measurement.operation}/${measurement.cacheState}`
        + ` p95=${measurement.statistics.p95Ms}ms`,
      ),
    );
    process.stdout.write(
      `${benchmark.passed ? "PASS" : "FAIL"} ${measurements.join(" | ")}\n`
      + `Evidence: ${options.outputPath}\n`,
    );
  } else {
    process.stdout.write(json);
  }

  if (!benchmark.passed) process.exitCode = 1;
}

await main();
