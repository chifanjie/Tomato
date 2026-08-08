import { lstat, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, resolve } from "node:path";

import {
  PARSER_RUNTIME_WORKER_PROFILE_V1,
  runProductionParserRuntimePhaseDirectV1,
} from "./provider-registry-evidence-binding-topology-proof.mjs";

const MAX_IPC_BYTES_V1 = 2 * 1_048_576;

function fail(message) {
  throw new Error(`D-37 parser runtime worker: ${message}`);
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function assertExactKeys(value, expectedKeys, label) {
  if (!isPlainObject(value)) fail(`${label} is not a plain object`);
  const observed = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    fail(`${label} keys drifted`);
  }
}

async function assertPrivateRegularFile(filePath, label) {
  const status = await lstat(filePath);
  if (
    !status.isFile() ||
    (status.mode & 0o077) !== 0 ||
    status.size <= 0 ||
    status.size > MAX_IPC_BYTES_V1
  ) {
    fail(`${label} failed private regular-file checks`);
  }
  return status;
}

async function main() {
  if (
    JSON.stringify(process.execArgv) !==
      JSON.stringify(["--max-old-space-size=1280"]) ||
    process.env.NODE_OPTIONS !== undefined
  ) {
    fail("Node execution profile drifted");
  }
  const args = process.argv.slice(2);
  if (
    args.length !== 8 ||
    args[0] !== "--profile" ||
    args[2] !== "--phase" ||
    args[4] !== "--input" ||
    args[6] !== "--output"
  ) {
    fail("argv shape drifted");
  }
  const profile = args[1];
  const phase = args[3];
  const inputPath = args[5];
  const outputPath = args[7];
  if (profile !== PARSER_RUNTIME_WORKER_PROFILE_V1) {
    fail("profile drifted");
  }
  if (phase !== "uninstrumented" && phase !== "instrumented") {
    fail("phase drifted");
  }
  if (
    !isAbsolute(inputPath) ||
    !isAbsolute(outputPath) ||
    dirname(inputPath) !== dirname(outputPath) ||
    basename(inputPath) !== `${phase}-request.json` ||
    basename(outputPath) !== `${phase}-result.json`
  ) {
    fail("IPC paths drifted");
  }
  await assertPrivateRegularFile(inputPath, "request");
  try {
    await lstat(outputPath);
    fail("result path already exists");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const requestBytes = await readFile(inputPath);
  let request;
  try {
    request = JSON.parse(requestBytes.toString("utf8"));
  } catch {
    fail("request is not valid JSON");
  }
  assertExactKeys(
    request,
    [
      "profile",
      "requestNonce",
      "phase",
      "packageRoot",
      "compatibleBase",
      "sourceOverrides",
    ],
    "request",
  );
  if (
    request.profile !== profile ||
    request.phase !== phase ||
    typeof request.requestNonce !== "string" ||
    !/^[0-9a-f]{48}$/u.test(request.requestNonce) ||
    typeof request.packageRoot !== "string" ||
    !isAbsolute(request.packageRoot) ||
    resolve(request.packageRoot) !== resolve(process.cwd())
  ) {
    fail("request authority fields drifted");
  }
  const result = await runProductionParserRuntimePhaseDirectV1({
    packageRoot: request.packageRoot,
    compatibleBase: request.compatibleBase,
    sourceOverrides: request.sourceOverrides,
    phase,
    requestNonce: request.requestNonce,
  });
  const serializedResult = JSON.stringify(result);
  if (
    Buffer.byteLength(serializedResult, "utf8") <= 0 ||
    Buffer.byteLength(serializedResult, "utf8") > MAX_IPC_BYTES_V1
  ) {
    fail("result exceeds the IPC byte cap");
  }
  await writeFile(outputPath, serializedResult, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  await assertPrivateRegularFile(outputPath, "result");
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown failure";
  process.stderr.write(`${message.replaceAll(/\s+/gu, " ").slice(0, 512)}\n`);
  process.exitCode = 1;
}
