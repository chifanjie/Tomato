import { spawnSync } from "node:child_process";
import {
  accessSync,
  constants,
  mkdirSync,
  readFileSync,
  lstatSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const nativeDirectory = dirname(fileURLToPath(import.meta.url));
const packageDirectory = resolve(nativeDirectory, "..");
const sourcePath = join(nativeDirectory, "kernel_peer_credentials.c");
const outputDirectory = join(
  packageDirectory,
  "dist",
  "native",
  `${process.platform}-${process.arch}`,
);
const outputPath = join(outputDirectory, "provider_kernel_peer.node");

const executablePrefix = resolve(dirname(process.execPath), "..");
const headerCandidates = [
  join(executablePrefix, "include", "node"),
  "/usr/local/include/node",
  "/usr/include/node",
];
const headerDirectory = headerCandidates.find((candidate) => {
  try {
    accessSync(join(candidate, "node_api.h"), constants.R_OK);
    return true;
  } catch {
    return false;
  }
});

if (headerDirectory === undefined) {
  throw new Error("Node N-API headers are unavailable");
}
if (process.platform !== "darwin" && process.platform !== "linux") {
  throw new Error("native kernel peer credentials require Darwin or Linux");
}

mkdirSync(outputDirectory, { recursive: true });

const commonArguments = [
  "-std=c11",
  "-DNAPI_VERSION=8",
  "-fPIC",
  "-O2",
  "-Wall",
  "-Wextra",
  "-Werror",
  `-I${headerDirectory}`,
  sourcePath,
  "-o",
  outputPath,
];
const platformArguments =
  process.platform === "darwin"
    ? [
        "-bundle",
        "-undefined",
        "dynamic_lookup",
        "-mmacosx-version-min=13.0",
      ]
    : ["-shared", "-lm"];
const compiler = process.env.CC ?? "cc";
const result = spawnSync(compiler, [...commonArguments, ...platformArguments], {
  cwd: nativeDirectory,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

if (result.error !== undefined || result.status !== 0) {
  const detail = [result.error?.message, result.stdout, result.stderr]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join("\n");
  throw new Error(
    detail.length > 0
      ? `native kernel peer build failed\n${detail}`
      : "native kernel peer build failed",
  );
}

const outputMetadata = lstatSync(outputPath);
const magic = readFileSync(outputPath).subarray(0, 4).toString("hex");
const expectedMagic = process.platform === "darwin" ? "cffaedfe" : "7f454c46";
if (
  !outputMetadata.isFile() ||
  outputMetadata.isSymbolicLink() ||
  outputMetadata.size < 4 ||
  magic !== expectedMagic
) {
  throw new Error("native kernel peer build produced an invalid binary");
}

process.stdout.write(`${outputPath}\n`);
