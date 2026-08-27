import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(
  packageRoot,
  "scripts",
  "c09-aggregate-coverage-v1.json",
);
const vitestPath = join(packageRoot, "node_modules", "vitest", "vitest.mjs");
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const expectedFullLanes = Object.freeze([
  "package-build",
  "package-typecheck",
  "all-vitest",
  "packed-distribution",
]);
const expectedAreas = Object.freeze([
  "acceptance",
  "formal-plan",
  "compound-publication",
  "destination-zero-live",
  "terminal-seal",
  "prepared-catalog",
  "formal-plan-publication",
  "migration-only-acceptance",
  "final-strong-ready",
  "durable-execution",
]);
const exactManifestKeys = Object.freeze([
  "assertions",
  "distributionScript",
  "fullLanes",
  "gate",
  "version",
]);
const exactAssertionKeys = Object.freeze([
  "area",
  "class",
  "file",
  "fullName",
  "id",
]);

function assertExactKeys(value, expected, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())
  ) {
    throw new Error(`${label} must have exactly ${expected.join(", ")}`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new Error(`${label} must be a non-empty, trimmed string`);
  }
}

function assertInsidePackage(candidate, label) {
  const pathFromPackage = relative(packageRoot, candidate);
  if (
    pathFromPackage === "" ||
    pathFromPackage === ".." ||
    pathFromPackage.startsWith(`..${sep}`) ||
    isAbsolute(pathFromPackage)
  ) {
    throw new Error(`${label} resolves outside the package`);
  }
}

async function loadManifest() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assertExactKeys(manifest, exactManifestKeys, "coverage manifest");
  if (manifest.version !== 1 || manifest.gate !== "WP5-1P/C09 aggregate") {
    throw new Error("coverage manifest version/gate drift");
  }
  if (JSON.stringify(manifest.fullLanes) !== JSON.stringify(expectedFullLanes)) {
    throw new Error("coverage manifest full-lane order drift");
  }
  if (manifest.distributionScript !== "scripts/test-distribution.mjs") {
    throw new Error("coverage manifest distribution runner drift");
  }
  if (!Array.isArray(manifest.assertions) || manifest.assertions.length === 0) {
    throw new Error("coverage manifest must contain assertions");
  }

  const ids = new Set();
  const assertionKeys = new Set();
  const classesByArea = new Map(
    expectedAreas.map((area) => [area, new Set()]),
  );
  for (const [index, assertion] of manifest.assertions.entries()) {
    assertExactKeys(assertion, exactAssertionKeys, `assertions[${index}]`);
    for (const key of ["id", "area", "class", "file", "fullName"]) {
      assertNonEmptyString(assertion[key], `assertions[${index}].${key}`);
    }
    if (!classesByArea.has(assertion.area)) {
      throw new Error(`unexpected coverage area: ${assertion.area}`);
    }
    if (assertion.class !== "positive" && assertion.class !== "negative") {
      throw new Error(`unexpected assertion class: ${assertion.class}`);
    }
    if (ids.has(assertion.id)) {
      throw new Error(`duplicate coverage assertion id: ${assertion.id}`);
    }
    ids.add(assertion.id);
    const assertionKey = `${assertion.file}\u0000${assertion.fullName}`;
    if (assertionKeys.has(assertionKey)) {
      throw new Error(`duplicate coverage assertion: ${assertion.id}`);
    }
    assertionKeys.add(assertionKey);
    classesByArea.get(assertion.area).add(assertion.class);

    if (!assertion.file.startsWith("test/") || !assertion.file.endsWith(".test.ts")) {
      throw new Error(`coverage assertion is not a package test: ${assertion.file}`);
    }
    const testPath = resolve(packageRoot, assertion.file);
    assertInsidePackage(testPath, assertion.file);
    if (!(await stat(testPath)).isFile()) {
      throw new Error(`coverage test is not a file: ${assertion.file}`);
    }
  }
  for (const [area, classes] of classesByArea) {
    if (!classes.has("positive") || !classes.has("negative")) {
      throw new Error(`coverage area must have positive and negative evidence: ${area}`);
    }
  }

  const distributionPath = resolve(packageRoot, manifest.distributionScript);
  assertInsidePackage(distributionPath, "distributionScript");
  if (!(await stat(distributionPath)).isFile()) {
    throw new Error("distribution runner is not a file");
  }
  return manifest;
}

function run(command, args, label) {
  process.stdout.write(`C09 aggregate: starting ${label}\n`);
  return new Promise((fulfill, reject) => {
    const child = spawn(command, args, {
      cwd: packageRoot,
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0 && signal === null) {
        process.stdout.write(`C09 aggregate: passed ${label}\n`);
        fulfill();
        return;
      }
      reject(
        new Error(
          `${label} failed (${signal === null ? `exit ${String(code)}` : `signal ${signal}`})`,
        ),
      );
    });
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function validateVitestReport(reportPath, manifest, focused) {
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  if (report.success !== true || !Array.isArray(report.testResults)) {
    throw new Error("Vitest JSON report was not successful");
  }
  if (
    !focused &&
    (
      report.numPendingTests !== 0 ||
      report.numTodoTests !== 0 ||
      !Number.isSafeInteger(report.numPassedTests) ||
      report.numPassedTests <= 0 ||
      report.numPassedTests !== report.numTotalTests
    )
  ) {
    throw new Error("full Vitest corpus must pass with no skipped or todo tests");
  }

  const results = new Map();
  for (const testResult of report.testResults) {
    if (typeof testResult.name !== "string" || !Array.isArray(testResult.assertionResults)) {
      throw new Error("Vitest JSON report shape drift");
    }
    const absoluteTestPath = resolve(
      packageRoot,
      isAbsolute(testResult.name) ? relative(packageRoot, testResult.name) : testResult.name,
    );
    assertInsidePackage(absoluteTestPath, "Vitest result path");
    const testFile = relative(packageRoot, absoluteTestPath).split(sep).join("/");
    for (const assertion of testResult.assertionResults) {
      if (typeof assertion.fullName !== "string" || typeof assertion.status !== "string") {
        throw new Error("Vitest assertion report shape drift");
      }
      const key = `${testFile}\u0000${assertion.fullName}`;
      const statuses = results.get(key) ?? [];
      statuses.push(assertion.status);
      results.set(key, statuses);
    }
  }

  for (const assertion of manifest.assertions) {
    const key = `${assertion.file}\u0000${assertion.fullName}`;
    const statuses = results.get(key);
    if (statuses?.length !== 1 || statuses[0] !== "passed") {
      throw new Error(
        `required ${assertion.class} assertion did not pass exactly once: ${assertion.id} (${statuses?.join(",") ?? "missing"})`,
      );
    }
  }
}

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== "--focused")) {
  throw new Error("usage: node scripts/test-c09-aggregate.mjs [--focused]");
}
const focused = args[0] === "--focused";
const manifest = await loadManifest();
const temporaryRoot = await mkdtemp(join(tmpdir(), "understand-code-c09-aggregate-"));
try {
  if (!focused) {
    await run(pnpmCommand, ["run", "build"], "package build");
    await run(pnpmCommand, ["run", "typecheck"], "package typecheck");
  }

  const reportPath = join(temporaryRoot, "vitest-report.json");
  const vitestArgs = [
    vitestPath,
    "run",
    "--maxWorkers=1",
    "--reporter=json",
    `--outputFile=${reportPath}`,
  ];
  if (focused) {
    vitestArgs.push(
      ...[...new Set(manifest.assertions.map(({ file }) => file))],
      "--testNamePattern",
      `^(?:${manifest.assertions.map(({ fullName }) => escapeRegExp(fullName)).join("|")})$`,
    );
  }
  await run(
    process.execPath,
    vitestArgs,
    focused ? "focused manifest assertions" : "all package Vitest tests",
  );
  await validateVitestReport(reportPath, manifest, focused);

  if (focused) {
    process.stdout.write(
      `C09 focused evidence passed ${manifest.assertions.length} required assertions; package build, typecheck, the unselected Vitest corpus, and packed distribution were not run.\n`,
    );
  } else {
    await run(
      process.execPath,
      [resolve(packageRoot, manifest.distributionScript)],
      "packed distribution",
    );
    process.stdout.write(
      `C09 aggregate gate passed all lanes and ${manifest.assertions.length} required coverage assertions.\n`,
    );
  }
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}
