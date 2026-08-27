import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { cp, mkdir, mkdtemp, readFile, readdir, readlink, realpath, rm, writeFile } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";

import { ArtifactStore, sha256CanonicalJson } from "../../artifact-store/dist/index.js";
import {
  GetRepoPulseOutputV1Schema,
  McpToolErrorResultV1Schema,
  RepoPulseArtifactV1Schema,
  RepositorySnapshotArtifactV1Schema,
} from "../../contracts/dist/index.js";
import { buildRepoPulse, getRepositorySnapshotDetailed } from "../../repository-state/dist/index.js";

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const PROCESS_TIMEOUT_MS = 15_000;
const EXTERNAL_COMMAND_TIMEOUT_MS = 30_000;
const EXPECTED_CONTENT_SECURITY_POLICY = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; font-src 'self' data:; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
const EXPECTED_FIRST_PAINT_THEME_BOOTSTRAP_SHA256 = "bb1806d60772d743f0dc88538ee45b10fe829a951db7a24b7131c1acdceb4e0d";
const SCRIPT_SOURCE_ATTRIBUTE_PATTERN = /(?:^|\s)src\s*=\s*(["'])(?<source>[^"']+)\1/giu;
const MAX_PACKED_TARBALL_BYTES = 4 * 1024 * 1024;
const MAX_EXPANDED_TAR_BYTES = 20 * 1024 * 1024;
const MAX_PACKED_FILE_BYTES = 4 * 1024 * 1024;
const MAX_BASE_PACKED_TOTAL_FILE_BYTES = 8 * 1024 * 1024;
const MAX_PLUGIN_PACKED_TOTAL_FILE_BYTES = 12 * 1024 * 1024;
const EXPECTED_PACKED_FILE_COUNT = 89;
const NATIVE_TUPLE = `${process.platform}-${process.arch}`;
const PRODUCT_VERSION_PATTERN =
  /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const EXPECTED_PUBLIC_MUTATION_FAILURE = {
  isError: true,
  content: [{
    type: "text",
    text: "The strong Store is unavailable. Run Doctor for details.",
  }],
  structuredContent: {
    error: {
      schemaVersion: 1,
      code: "provider_unavailable",
      details: { reason: "unavailable" },
    },
  },
};

const packedFileRules = [
  { label: "package metadata", pattern: /^package\/(?:README\.md|package\.json)$/u, count: 2, mode: 0o644 },
  { label: "runtime modules", pattern: /^package\/dist\/(?:README\.md|contracts\.mjs|server\.mjs)$/u, count: 3, mode: 0o644 },
  { label: "Preview executable", pattern: /^package\/dist\/bin\.mjs$/u, count: 1, mode: 0o755 },
  { label: "MCP executable", pattern: /^package\/dist\/understand-code\.mjs$/u, count: 1, mode: 0o755 },
  { label: "host executable", pattern: /^package\/dist\/host-bin\.mjs$/u, count: 1, mode: 0o755 },
  { label: "release manifest", pattern: /^package\/dist\/release-manifest\.json$/u, count: 1, mode: 0o644 },
  { label: "Dashboard bundle manifest", pattern: /^package\/dist\/dashboard-manifest\.json$/u, count: 1, mode: 0o644 },
  { label: "Codex host release", pattern: /^package\/dist\/host-adapters\/codex\/(?:config\.toml|manifest\.json|mcp\.json)$/u, count: 3, mode: 0o644 },
  { label: "Claude host release", pattern: /^package\/dist\/host-adapters\/claude\/(?:\.mcp\.json|manifest\.json)$/u, count: 2, mode: 0o644 },
  { label: "Codex plugin contracts", pattern: /^package\/dist\/plugin-roots\/codex\/(?:\.agents\/plugins\/marketplace\.json|plugins\/understand-code\/(?:\.codex-plugin\/plugin\.json|\.mcp\.json))$/u, count: 3, mode: 0o644 },
  { label: "Claude plugin contracts", pattern: /^package\/dist\/plugin-roots\/claude\/(?:\.claude-plugin\/marketplace\.json|plugins\/understand-code\/(?:\.claude-plugin\/plugin\.json|\.mcp\.json))$/u, count: 3, mode: 0o644 },
  { label: "self-contained plugin executables", pattern: /^package\/dist\/plugin-roots\/(?:codex|claude)\/plugins\/understand-code\/bin\/(?:understand-code-plugin|understand-code)\.mjs$/u, count: 4, mode: 0o755 },
  { label: "self-contained plugin native peers", pattern: new RegExp(`^package/dist/plugin-roots/(?:codex|claude)/plugins/understand-code/bin/native/${NATIVE_TUPLE}/provider_kernel_peer\\.node$`, "u"), count: 2, mode: 0o644 },
  { label: "self-contained plugin Dashboard manifests", pattern: /^package\/dist\/plugin-roots\/(?:codex|claude)\/plugins\/understand-code\/bin\/dashboard-manifest\.json$/u, count: 2, mode: 0o644 },
  { label: "self-contained plugin Dashboard roots", pattern: /^package\/dist\/plugin-roots\/(?:codex|claude)\/plugins\/understand-code\/bin\/dashboard\/(?:config\.json|favicon\.ico|favicon\.svg|index\.html|meta\.json)$/u, count: 10, mode: 0o644 },
  { label: "self-contained plugin Graph Explorer chunks", pattern: /^package\/dist\/plugin-roots\/(?:codex|claude)\/plugins\/understand-code\/bin\/dashboard\/assets\/GraphExplorer-[A-Za-z0-9_-]+\.js$/u, count: 2, mode: 0o644 },
  { label: "self-contained plugin graph layout chunks", pattern: /^package\/dist\/plugin-roots\/(?:codex|claude)\/plugins\/understand-code\/bin\/dashboard\/assets\/graph-layout-[A-Za-z0-9_-]+\.js$/u, count: 2, mode: 0o644 },
  { label: "self-contained plugin Dashboard JavaScript entries", pattern: /^package\/dist\/plugin-roots\/(?:codex|claude)\/plugins\/understand-code\/bin\/dashboard\/assets\/index-[A-Za-z0-9_-]+\.js$/u, count: 2, mode: 0o644 },
  { label: "self-contained plugin Dashboard stylesheet entries", pattern: /^package\/dist\/plugin-roots\/(?:codex|claude)\/plugins\/understand-code\/bin\/dashboard\/assets\/index-[A-Za-z0-9_-]+\.css$/u, count: 2, mode: 0o644 },
  { label: "self-contained plugin layout worker chunks", pattern: /^package\/dist\/plugin-roots\/(?:codex|claude)\/plugins\/understand-code\/bin\/dashboard\/assets\/layout\.worker-[A-Za-z0-9_-]+\.js$/u, count: 2, mode: 0o644 },
  { label: "self-contained plugin markdown chunks", pattern: /^package\/dist\/plugin-roots\/(?:codex|claude)\/plugins\/understand-code\/bin\/dashboard\/assets\/markdown-[A-Za-z0-9_-]+\.js$/u, count: 2, mode: 0o644 },
  { label: "self-contained plugin React vendor chunks", pattern: /^package\/dist\/plugin-roots\/(?:codex|claude)\/plugins\/understand-code\/bin\/dashboard\/assets\/react-vendor-[A-Za-z0-9_-]+\.js$/u, count: 2, mode: 0o644 },
  { label: "self-contained plugin XYFlow JavaScript chunks", pattern: /^package\/dist\/plugin-roots\/(?:codex|claude)\/plugins\/understand-code\/bin\/dashboard\/assets\/xyflow-[A-Za-z0-9_-]+\.js$/u, count: 2, mode: 0o644 },
  { label: "self-contained plugin XYFlow stylesheet chunks", pattern: /^package\/dist\/plugin-roots\/(?:codex|claude)\/plugins\/understand-code\/bin\/dashboard\/assets\/xyflow-[A-Za-z0-9_-]+\.css$/u, count: 2, mode: 0o644 },
  { label: "self-contained plugin theme bootstraps", pattern: /^package\/dist\/plugin-roots\/(?:codex|claude)\/plugins\/understand-code\/bin\/dashboard\/assets\/theme-bootstrap-bb1806d60772d743f0dc88538ee45b10fe829a951db7a24b7131c1acdceb4e0d\.js$/u, count: 2, mode: 0o644 },
  { label: "native kernel peer", pattern: new RegExp(`^package/dist/native/${NATIVE_TUPLE}/provider_kernel_peer\\.node$`, "u"), count: 1, mode: 0o644 },
  { label: "dashboard roots", pattern: /^package\/dist\/dashboard\/(?:config\.json|favicon\.ico|favicon\.svg|index\.html|meta\.json)$/u, count: 5, mode: 0o644 },
  { label: "Graph Explorer chunk", pattern: /^package\/dist\/dashboard\/assets\/GraphExplorer-[A-Za-z0-9_-]+\.js$/u, count: 1, mode: 0o644 },
  { label: "graph layout chunk", pattern: /^package\/dist\/dashboard\/assets\/graph-layout-[A-Za-z0-9_-]+\.js$/u, count: 1, mode: 0o644 },
  { label: "dashboard JavaScript entry", pattern: /^package\/dist\/dashboard\/assets\/index-[A-Za-z0-9_-]+\.js$/u, count: 1, mode: 0o644 },
  { label: "dashboard stylesheet entry", pattern: /^package\/dist\/dashboard\/assets\/index-[A-Za-z0-9_-]+\.css$/u, count: 1, mode: 0o644 },
  { label: "layout worker chunk", pattern: /^package\/dist\/dashboard\/assets\/layout\.worker-[A-Za-z0-9_-]+\.js$/u, count: 1, mode: 0o644 },
  { label: "markdown chunk", pattern: /^package\/dist\/dashboard\/assets\/markdown-[A-Za-z0-9_-]+\.js$/u, count: 1, mode: 0o644 },
  { label: "React vendor chunk", pattern: /^package\/dist\/dashboard\/assets\/react-vendor-[A-Za-z0-9_-]+\.js$/u, count: 1, mode: 0o644 },
  { label: "XYFlow JavaScript chunk", pattern: /^package\/dist\/dashboard\/assets\/xyflow-[A-Za-z0-9_-]+\.js$/u, count: 1, mode: 0o644 },
  { label: "XYFlow stylesheet chunk", pattern: /^package\/dist\/dashboard\/assets\/xyflow-[A-Za-z0-9_-]+\.css$/u, count: 1, mode: 0o644 },
  { label: "theme bootstrap", pattern: /^package\/dist\/dashboard\/assets\/theme-bootstrap-bb1806d60772d743f0dc88538ee45b10fe829a951db7a24b7131c1acdceb4e0d\.js$/u, count: 1, mode: 0o644 },
  { label: "demo contracts", pattern: /^package\/dist\/demo\/\.understand-code\/(?:config\.json|knowledge-graph\.json|meta\.json)$/u, count: 3, mode: 0o644 },
  { label: "demo Task Pulse", pattern: /^package\/dist\/demo\/\.understand-code\/repo-pulse\.json$/u, count: 1, mode: 0o644 },
  { label: "demo Task manifest", pattern: /^package\/dist\/demo\/\.understand-code\/tasks\/01ARZ3NDEKTSV4RRFFQ69G5FAV\/task\.json$/u, count: 1, mode: 0o644 },
  { label: "demo Task Brief", pattern: /^package\/dist\/demo\/\.understand-code\/tasks\/01ARZ3NDEKTSV4RRFFQ69G5FAV\/task-brief\.json$/u, count: 1, mode: 0o644 },
  { label: "demo Change Check and Verification", pattern: /^package\/dist\/demo\/\.understand-code\/tasks\/01ARZ3NDEKTSV4RRFFQ69G5FAV\/(?:change-check|verification)\.json$/u, count: 2, mode: 0o644 },
  { label: "demo Wiki indexes", pattern: /^package\/dist\/demo\/\.understand-code\/knowledge-base\/(?:search-index|wiki-index)\.json$/u, count: 2, mode: 0o644 },
  { label: "demo Wiki pages", pattern: /^package\/dist\/demo\/\.understand-code\/knowledge-base\/(?:参考\/app\.ts|阅读流程|项目总览)\.md$/u, count: 3, mode: 0o644 },
  { label: "demo source", pattern: /^package\/dist\/demo\/src\/app\.ts$/u, count: 1, mode: 0o644 },
];

const expectedPaxPaths = new Map([
  ["PaxHeader/app.ts.md", "package/dist/demo/.understand-code/knowledge-base/参考/app.ts.md"],
  ["PaxHeader/阅读流程.md", "package/dist/demo/.understand-code/knowledge-base/阅读流程.md"],
  ["PaxHeader/项目总览.md", "package/dist/demo/.understand-code/knowledge-base/项目总览.md"],
]);

function withTimeout(promise, label, timeoutMs = PROCESS_TIMEOUT_MS) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

function execFileBounded(command, args, options = {}) {
  return execFileAsync(command, args, {
    ...options,
    timeout: EXTERNAL_COMMAND_TIMEOUT_MS,
    killSignal: "SIGKILL",
    maxBuffer: 8 * 1024 * 1024,
  });
}

function scriptSourceAttributes(attributes) {
  return [...attributes.matchAll(SCRIPT_SOURCE_ATTRIBUTE_PATTERN)].map((match) => match.groups?.source);
}

function tarText(header, offset, length) {
  const field = header.subarray(offset, offset + length);
  const terminator = field.indexOf(0);
  return field.subarray(0, terminator === -1 ? field.length : terminator).toString("utf8");
}

function tarOctal(header, offset, length, label) {
  const raw = tarText(header, offset, length).trim();
  assert.match(raw, /^[0-7]+$/u, `${label} must be a portable octal tar field`);
  const value = Number.parseInt(raw, 8);
  assert.ok(Number.isSafeInteger(value) && value >= 0, `${label} must be a safe non-negative integer`);
  return value;
}

function parsePaxRecords(payload) {
  const records = {};
  let offset = 0;
  while (offset < payload.byteLength) {
    const separator = payload.indexOf(0x20, offset);
    assert.ok(separator > offset, "PAX record must start with its decimal byte length");
    const lengthText = payload.subarray(offset, separator).toString("ascii");
    assert.match(lengthText, /^[1-9][0-9]*$/u);
    const length = Number.parseInt(lengthText, 10);
    const end = offset + length;
    assert.ok(Number.isSafeInteger(length) && end <= payload.byteLength && payload[end - 1] === 0x0a, "PAX record length must exactly bound a newline-terminated record");
    const record = payload.subarray(separator + 1, end - 1).toString("utf8");
    const equals = record.indexOf("=");
    assert.ok(equals > 0, "PAX record must have a non-empty key");
    const key = record.slice(0, equals);
    assert.equal(Object.hasOwn(records, key), false, `duplicate PAX key: ${key}`);
    records[key] = record.slice(equals + 1);
    offset = end;
  }
  return records;
}

function validatePackedTarball(tarballBytes) {
  assert.ok(tarballBytes.byteLength > 0 && tarballBytes.byteLength <= MAX_PACKED_TARBALL_BYTES, "packed tgz must satisfy its compressed-size bound");
  const archive = gunzipSync(tarballBytes, { maxOutputLength: MAX_EXPANDED_TAR_BYTES });
  assert.ok(archive.byteLength <= MAX_EXPANDED_TAR_BYTES, "expanded tar must satisfy its archive-size bound");

  const entries = [];
  let offset = 0;
  let terminated = false;
  while (offset + 512 <= archive.byteLength) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      assert.ok(offset + 1024 <= archive.byteLength, "tar must end with two zero records");
      assert.ok(archive.subarray(offset, offset + 1024).every((byte) => byte === 0), "tar must end with two zero records");
      assert.ok(archive.subarray(offset).every((byte) => byte === 0), "tar must not carry data after its zero terminator");
      terminated = true;
      break;
    }
    assert.ok(entries.length < 128, "tar raw-entry count must remain bounded");
    const declaredChecksum = tarOctal(header, 148, 8, "tar checksum");
    let checksum = 0;
    for (let index = 0; index < header.byteLength; index += 1) {
      checksum += index >= 148 && index < 156 ? 0x20 : header[index];
    }
    assert.equal(checksum, declaredChecksum, "tar header checksum must be valid");
    assert.ok(tarText(header, 257, 6).startsWith("ustar"), "tar entry must use the ustar format");
    const name = tarText(header, 0, 100);
    const prefix = tarText(header, 345, 155);
    const entryPath = prefix ? `${prefix}/${name}` : name;
    const mode = tarOctal(header, 100, 8, `${entryPath} mode`);
    const size = tarOctal(header, 124, 12, `${entryPath} size`);
    const typeByte = header[156];
    const type = typeByte === 0 ? "0" : String.fromCharCode(typeByte);
    const linkName = tarText(header, 157, 100);
    assert.ok(type === "0" || type === "x", `${entryPath} has forbidden tar entry type ${JSON.stringify(type)}`);
    const payloadStart = offset + 512;
    const payloadEnd = payloadStart + size;
    assert.ok(payloadEnd <= archive.byteLength, `${entryPath} payload must remain inside the tar archive`);
    entries.push({ path: entryPath, mode, size, type, linkName, payload: archive.subarray(payloadStart, payloadEnd) });
    offset = payloadStart + Math.ceil(size / 512) * 512;
  }
  assert.equal(terminated, true, "tar must have a canonical zero-block terminator");

  const ruleCounts = new Map(packedFileRules.map((rule) => [rule.label, 0]));
  const seenPaths = new Set();
  const packedFiles = new Map();
  const seenPaxHeaders = new Set();
  let pendingPax = null;
  let fileCount = 0;
  let baseFileBytes = 0;
  let pluginFileBytes = 0;
  for (const entry of entries) {
    assert.equal(entry.linkName, "", `${entry.path} must not carry a hard-link or symbolic-link target`);
    if (entry.type === "x") {
      assert.equal(pendingPax, null, "PAX headers must apply to exactly one following regular file");
      const expectedPath = expectedPaxPaths.get(entry.path);
      assert.ok(expectedPath, `unexpected PAX header: ${entry.path}`);
      assert.equal(seenPaxHeaders.has(entry.path), false, `duplicate PAX header: ${entry.path}`);
      assert.equal(entry.mode, 0o644, `${entry.path} mode must be 0644`);
      assert.ok(entry.size <= 1024, `${entry.path} metadata must remain bounded`);
      const records = parsePaxRecords(entry.payload);
      assert.deepEqual(Object.keys(records).sort(), ["mtime", "path", "size"]);
      assert.equal(records.path, expectedPath);
      assert.match(records.mtime, /^[0-9]+$/u);
      assert.match(records.size, /^[0-9]+$/u);
      seenPaxHeaders.add(entry.path);
      pendingPax = records;
      continue;
    }

    if (pendingPax !== null) {
      assert.equal(entry.path, pendingPax.path, "PAX path must match its following regular entry");
      assert.equal(entry.size, Number.parseInt(pendingPax.size, 10), "PAX size must match its following regular entry");
      pendingPax = null;
    }
    assert.equal(seenPaths.has(entry.path), false, `duplicate packed path: ${entry.path}`);
    seenPaths.add(entry.path);
    packedFiles.set(entry.path, entry.payload);
    const matchingRules = packedFileRules.filter((rule) => rule.pattern.test(entry.path));
    assert.equal(matchingRules.length, 1, `packed path is outside the release allowlist: ${entry.path}`);
    const [rule] = matchingRules;
    assert.equal(entry.mode, rule.mode, `${entry.path} has an unexpected file mode`);
    assert.ok(entry.size <= MAX_PACKED_FILE_BYTES, `${entry.path} exceeds the per-file size bound`);
    ruleCounts.set(rule.label, (ruleCounts.get(rule.label) ?? 0) + 1);
    if (entry.path.startsWith("package/dist/plugin-roots/")) {
      pluginFileBytes += entry.size;
    } else {
      baseFileBytes += entry.size;
    }
    fileCount += 1;
  }
  assert.equal(pendingPax, null, "tar must not end with an unapplied PAX header");
  assert.equal(fileCount, EXPECTED_PACKED_FILE_COUNT, "packed logical file count must remain exact");
  assert.equal(seenPaxHeaders.size, expectedPaxPaths.size, "packed PAX header count must remain exact");
  assert.ok(baseFileBytes <= MAX_BASE_PACKED_TOTAL_FILE_BYTES, "pre-plugin packed files must retain their original total-size bound");
  assert.ok(pluginFileBytes <= MAX_PLUGIN_PACKED_TOTAL_FILE_BYTES, "self-contained plugin files must satisfy their separate total-size bound");
  for (const rule of packedFileRules) {
    assert.equal(ruleCounts.get(rule.label), rule.count, `${rule.label} packed-entry count must remain exact`);
  }
  return packedFiles;
}

function expectedPackedVersion(packedFiles) {
  const bytes = packedFiles.get("package/package.json");
  assert.ok(Buffer.isBuffer(bytes), "packed package metadata must be present");
  assert.ok(bytes.byteLength > 0 && bytes.byteLength <= 4_096, "packed package metadata must remain bounded");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const manifest = JSON.parse(text);
  assert.equal(
    manifest !== null && typeof manifest === "object" && !Array.isArray(manifest),
    true,
    "packed package metadata must be one JSON object",
  );
  assert.equal(manifest.name, "@understand-code/preview");
  assert.equal(typeof manifest.version, "string");
  assert.equal(
    manifest.version.length > 0 && manifest.version.length <= 64,
    true,
    "packed product version must remain bounded",
  );
  assert.equal(
    PRODUCT_VERSION_PATTERN.test(manifest.version),
    true,
    "packed product version must be strict SemVer",
  );
  return manifest.version;
}

function waitForExit(child, label, timeoutMs = PROCESS_TIMEOUT_MS) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve([child.exitCode, child.signalCode]);
  }
  return withTimeout(new Promise((resolve, reject) => {
    const onError = (error) => {
      child.off("exit", onExit);
      reject(error);
    };
    const onExit = (code, signal) => {
      child.off("error", onError);
      resolve([code, signal]);
    };
    child.once("error", onError);
    child.once("exit", onExit);
  }), label, timeoutMs);
}

async function stopChild(child, label) {
  if (!child) return null;
  if (child.exitCode !== null || child.signalCode !== null) return [child.exitCode, child.signalCode];
  if (child.stdin?.writable) child.stdin.end();
  child.kill("SIGTERM");
  try {
    return await waitForExit(child, `${label} shutdown`, 2_000);
  } catch {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    return waitForExit(child, `${label} forced shutdown`, 2_000);
  }
}

async function assertPortReleased(url, label) {
  const parsed = new URL(url);
  const port = Number(parsed.port);
  assert.ok(Number.isInteger(port) && port > 0, `${label} must expose a concrete TCP port`);
  const probe = createNetServer();
  try {
    await withTimeout(new Promise((resolve, reject) => {
      const onError = (error) => reject(error);
      probe.once("error", onError);
      probe.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
        probe.off("error", onError);
        resolve();
      });
    }), `${label} port release`, 2_000);
  } finally {
    if (probe.listening) {
      await new Promise((resolve) => probe.close(resolve));
    }
  }
}

function startPreview(executable, cwd, args = ["--demo", "--port", "0", "--no-open"]) {
  const child = spawn(executable, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const ready = withTimeout(new Promise((resolve, reject) => {
    const output = [];
    const errors = [];
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => errors.push(chunk));
    createInterface({ input: child.stdout }).on("line", (line) => {
      output.push(line);
      if (!line.startsWith("PREVIEW_READY ")) return;
      try {
        resolve(JSON.parse(line.slice("PREVIEW_READY ".length)));
      } catch (error) {
        reject(error);
      }
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (output.every((line) => !line.startsWith("PREVIEW_READY "))) {
        reject(new Error(`preview exited before ready (code=${code}, signal=${signal}): ${errors.join("") || output.join("\n")}`));
      }
    });
  }), "cold Preview ready");
  return { child, ready };
}

function writeMessage(child, message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function collectMessages(child) {
  const messages = [];
  const stderr = [];
  const waiters = [];
  let terminalError = null;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  createInterface({ input: child.stdout }).on("line", (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      terminalError = new Error(`MCP emitted invalid JSON: ${line}`, { cause: error });
      for (const waiter of waiters.splice(0)) waiter.reject(terminalError);
      return;
    }
    messages.push(message);
    for (const waiter of [...waiters]) {
      if (!waiter.predicate(message)) continue;
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.resolve(message);
    }
  });
  child.once("error", (error) => {
    terminalError = error;
    for (const waiter of waiters.splice(0)) waiter.reject(error);
  });
  child.once("exit", (code, signal) => {
    terminalError = new Error(`MCP exited before the expected message (code=${code}, signal=${signal})`);
    for (const waiter of waiters.splice(0)) waiter.reject(terminalError);
  });
  child.stdin.once("error", (error) => {
    terminalError = error;
    for (const waiter of waiters.splice(0)) waiter.reject(error);
  });
  return {
    stderr,
    waitFor(predicate, label = "MCP response") {
      const existing = messages.find(predicate);
      if (existing) return Promise.resolve(existing);
      if (terminalError) return Promise.reject(terminalError);
      return withTimeout(new Promise((resolve, reject) => {
        const waiter = {
          predicate,
          resolve: (message) => {
            clearTimeout(waiter.timer);
            resolve(message);
          },
          reject: (error) => {
            clearTimeout(waiter.timer);
            reject(error);
          },
          timer: undefined,
        };
        waiter.timer = setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index !== -1) waiters.splice(index, 1);
          reject(new Error(`${label} timed out after ${PROCESS_TIMEOUT_MS}ms`));
        }, PROCESS_TIMEOUT_MS);
        waiters.push(waiter);
      }), label, PROCESS_TIMEOUT_MS + 100);
    },
  };
}

async function callTool(child, output, id, name, argumentsValue, schema) {
  writeMessage(child, {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: argumentsValue },
  });
  const message = await output.waitFor(
    (candidate) => candidate.id === id,
    `MCP ${name} response`,
  );
  assert.equal(message.jsonrpc, "2.0");
  assert.equal(Object.hasOwn(message, "error"), false, `${name} must return a tool result`);
  return schema.parse(message.result);
}

async function runCliJson(executable, argumentsValue, cwd) {
  const result = await execFileBounded(executable, argumentsValue, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_DIR: undefined, GIT_WORK_TREE: undefined },
  });
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

async function runCliJsonFailure(executable, argumentsValue, cwd, exitCode) {
  let failure;
  try {
    await execFileBounded(executable, argumentsValue, {
      cwd,
      encoding: "utf8",
      env: { ...process.env, GIT_DIR: undefined, GIT_WORK_TREE: undefined },
    });
  } catch (error) {
    failure = error;
  }
  assert.ok(failure, `${executable} must exit unsuccessfully`);
  assert.equal(failure.code, exitCode);
  assert.equal(failure.stderr, "");
  return JSON.parse(failure.stdout);
}

async function git(root, args) {
  return execFileBounded("git", args, {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Preview Cold Test",
      GIT_AUTHOR_EMAIL: "preview@example.invalid",
      GIT_COMMITTER_NAME: "Preview Cold Test",
      GIT_COMMITTER_EMAIL: "preview@example.invalid",
    },
  });
}

async function createMcpRoot() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "preview-mcp-root-")));
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(path.join(root, "src/task.ts"), "export function task() { return true; }\n");
  await git(root, ["init", "-q"]);
  await git(root, ["add", "src/task.ts"]);
  await git(root, ["commit", "-q", "-m", "preview MCP fixture"]);
  const capture = await getRepositorySnapshotDetailed(root, {
    now: () => new Date("2026-08-12T00:00:00.000Z"),
  });
  assert.equal(capture.snapshot.captureStatus, "complete");
  const store = await ArtifactStore.open(root, {
    repositoryId: capture.snapshot.repositoryId,
    worktreeId: capture.snapshot.worktreeId,
    producerVersion: "0.1.0",
    clock: () => new Date("2026-08-12T00:00:00.000Z"),
  });
  await store.initialize();
  const graph = {
    version: "1",
    project: {
      name: "preview-mcp-fixture",
      languages: ["TypeScript"], frameworks: [], description: "Cold MCP fixture",
      analyzedAt: "2026-08-12T00:00:00.000Z", gitCommitHash: capture.snapshot.headCommit,
    },
    nodes: [{
      id: "function:task", type: "function", name: "task", filePath: "src/task.ts",
      lineRange: [1, 1], summary: "Returns task state.", tags: ["task"], complexity: "simple",
    }],
    edges: [], layers: [], tour: [],
  };
  await writeFile(path.join(root, ".understand-code/knowledge-graph.json"), `${JSON.stringify(graph)}\n`);
  const pulse = buildRepoPulse({
    snapshot: capture.snapshot,
    git: capture.git,
    artifacts: { graph: "fresh", wiki: "missing", evidence: "fresh", diff: "missing", task: "fresh" },
    completeness: {
      parser: { status: "complete", coverage: 1, reasons: [] },
      callGraph: { status: "complete", coverage: 1, reasons: [] },
    },
    evaluatedAt: "2026-08-12T00:00:00.000Z",
  });
  await store.persistArtifact(RepositorySnapshotArtifactV1Schema.parse({
    schemaVersion: 1,
    artifactType: "repository_snapshot",
    artifactId: `artifact:repository-snapshot:${capture.snapshot.snapshotId}`,
    repositoryId: capture.snapshot.repositoryId,
    worktreeId: capture.snapshot.worktreeId,
    sourceSnapshotId: capture.snapshot.snapshotId,
    revision: 0,
    producerVersion: "0.1.0",
    createdAt: capture.snapshot.createdAt,
    contentDigest: sha256CanonicalJson(capture.snapshot),
    payload: capture.snapshot,
  }));
  await store.persistArtifact(RepoPulseArtifactV1Schema.parse({
    schemaVersion: 1,
    artifactType: "repo_pulse",
    artifactId: `artifact:repo-pulse:${capture.snapshot.snapshotId}`,
    repositoryId: capture.snapshot.repositoryId,
    worktreeId: capture.snapshot.worktreeId,
    sourceSnapshotId: capture.snapshot.snapshotId,
    revision: 0,
    producerVersion: "0.1.0",
    createdAt: pulse.evaluatedAt,
    contentDigest: sha256CanonicalJson(pulse),
    payload: pulse,
  }));
  return {
    root,
    rawLegacyIds: [
      capture.snapshot.repositoryId,
      capture.snapshot.worktreeId,
      capture.snapshot.snapshotId,
    ],
  };
}

async function createPublishedPreviewRoot(installedPackageRoot) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "preview-cold-published-root-")));
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(path.join(root, "src/app.ts"), "export function main() { return 'ready'; }\n");
  await writeFile(path.join(root, ".gitignore"), ".understand-code/\n");
  await git(root, ["init", "-q"]);
  await git(root, ["add", ".gitignore", "src/app.ts"]);
  await git(root, ["commit", "-q", "-m", "cold Preview root fixture"]);
  const launchCapture = await getRepositorySnapshotDetailed(root);
  assert.equal(launchCapture.snapshot.captureStatus, "complete");
  await cp(path.join(installedPackageRoot, "dist/demo/.understand-code"), path.join(root, ".understand-code"), { recursive: true });
  const head = (await git(root, ["rev-parse", "HEAD"])).stdout.trim();
  const graphPath = path.join(root, ".understand-code/knowledge-graph.json");
  const graph = JSON.parse(await readFile(graphPath, "utf8"));
  graph.project.gitCommitHash = head;
  await writeFile(graphPath, `${JSON.stringify(graph, null, 2)}\n`);
  const graphDigest = createHash("sha256").update(JSON.stringify(graph)).digest("hex");
  const metaPath = path.join(root, ".understand-code/meta.json");
  const meta = JSON.parse(await readFile(metaPath, "utf8"));
  meta.gitCommitHash = head;
  await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
  const wikiPath = path.join(root, ".understand-code/knowledge-base/wiki-index.json");
  const wiki = JSON.parse(await readFile(wikiPath, "utf8"));
  wiki.source.sourceRootIdentity = launchCapture.snapshot.rootIdentity;
  wiki.source.gitCommitHash = head;
  wiki.source.graphDigest = graphDigest;
  await writeFile(wikiPath, `${JSON.stringify(wiki, null, 2)}\n`);
  return root;
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function snapshotManagedStoreTree(root) {
  const snapshot = {};
  const storeRoot = path.join(root, ".understand-code");
  const walk = async (relativeDirectory) => {
    const absoluteDirectory = relativeDirectory === ""
      ? storeRoot
      : path.join(storeRoot, ...relativeDirectory.split("/"));
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const relativePath = relativeDirectory === ""
        ? entry.name
        : `${relativeDirectory}/${entry.name}`;
      const absolutePath = path.join(storeRoot, ...relativePath.split("/"));
      if (entry.isDirectory()) {
        snapshot[relativePath] = "directory";
        await walk(relativePath);
      } else if (entry.isFile()) {
        snapshot[relativePath] = `file:sha256:${digest(await readFile(absolutePath))}`;
      } else if (entry.isSymbolicLink()) {
        snapshot[relativePath] = `symlink:sha256:${digest(await readlink(absolutePath, "buffer"))}`;
      } else {
        snapshot[relativePath] = "special";
      }
    }
  };
  await walk("");
  return snapshot;
}

async function probePackageImport(consumerRoot, specifier) {
  const source = [
    `const specifier = ${JSON.stringify(specifier)};`,
    "try {",
    "  await import(specifier);",
    "  process.stdout.write(JSON.stringify({ code: null }));",
    "} catch (error) {",
    "  process.stdout.write(JSON.stringify({ code: error?.code ?? null }));",
    "}",
  ].join("\n");
  const result = await execFileBounded(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: consumerRoot,
    encoding: "utf8",
  });
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

async function assertPackedDashboard(indexResponse, indexHtml, previewUrl, packedFiles) {
  assert.equal(indexResponse.headers.get("content-security-policy"), EXPECTED_CONTENT_SECURITY_POLICY);
  assert.deepEqual(Buffer.from(indexHtml), packedFiles.get("package/dist/dashboard/index.html"), "served dashboard HTML must equal the installed tgz entry");
  assert.doesNotMatch(indexHtml, /\son[a-z]+\s*=/iu);
  assert.doesNotMatch(indexHtml, /\b(?:href|src)\s*=\s*(["'])javascript:/iu);
  const scriptElements = [...indexHtml.matchAll(/<script\b(?<attributes>[^>]*)>(?<body>[\s\S]*?)<\/script>/giu)];
  assert.ok(scriptElements.length > 0, "packed dashboard must contain external scripts");
  assert.equal(scriptElements.length, indexHtml.match(/<script\b/giu)?.length ?? 0, "every packed script opening tag must be well formed");
  assert.equal(scriptElements.length, indexHtml.match(/<\/script>/giu)?.length ?? 0, "every packed script closing tag must be well formed");
  const scriptSources = scriptElements.map((match) => {
    assert.equal((match.groups?.body ?? "").trim(), "", "packed dashboard must not contain inline script bodies");
    const sources = scriptSourceAttributes(match.groups?.attributes ?? "");
    assert.equal(sources.length, 1, "every packed dashboard script must have exactly one external src");
    const [source] = sources;
    assert.match(source, /^\/assets\/[A-Za-z0-9_.-]+\.js$/u, "every packed dashboard script must remain a same-origin JavaScript asset");
    return source;
  });
  const expectedBootstrapPath = `/assets/theme-bootstrap-${EXPECTED_FIRST_PAINT_THEME_BOOTSTRAP_SHA256}.js`;
  assert.equal(scriptSources.filter((source) => source === expectedBootstrapPath).length, 1, "packed dashboard must reference exactly one reviewed theme bootstrap");

  const stylesheetPaths = [...indexHtml.matchAll(/<link\b(?<attributes>[^>]*)>/giu)].flatMap((match) => {
    const attributes = match.groups?.attributes ?? "";
    if (![...attributes.matchAll(/(?:^|\s)rel\s*=\s*(["'])(?<value>[^"']+)\1/giu)].some((attribute) => attribute.groups?.value === "stylesheet")) return [];
    const hrefs = [...attributes.matchAll(/(?:^|\s)href\s*=\s*(["'])(?<value>[^"']+)\1/giu)].map((attribute) => attribute.groups?.value);
    assert.equal(hrefs.length, 1, "each stylesheet link must have exactly one href");
    return hrefs;
  });
  assert.ok(stylesheetPaths.length > 0 && stylesheetPaths.every((assetPath) => /^\/assets\/[A-Za-z0-9_.-]+\.css$/u.test(assetPath)), "packed dashboard must reference at least one same-origin stylesheet");
  const assetPaths = new Set([...indexHtml.matchAll(/(?:^|\s)(?:src|href)\s*=\s*(["'])(?<asset>\/assets\/[^"']+)\1/giu)].map((match) => match.groups.asset));
  assert.ok(assetPaths.size >= scriptSources.length, "packed dashboard must expose its same-origin script and style assets");
  const fetchedAssets = new Map();
  await Promise.all([...assetPaths].map(async (assetPath) => {
    assert.match(assetPath, /^\/assets\/[A-Za-z0-9_.-]+\.(?:css|js)$/u);
    const packedBytes = packedFiles.get(`package/dist/dashboard${assetPath}`);
    assert.ok(packedBytes, `${assetPath} must have an exact installed tgz entry`);
    const assetUrl = new URL(assetPath, previewUrl);
    assert.equal(assetUrl.origin, previewUrl.origin, `${assetPath} must remain same-origin`);
    const response = await fetch(assetUrl);
    assert.equal(response.status, 200, `${assetPath} must be retrievable from the installed tgz`);
    assert.equal(response.headers.get("content-security-policy"), EXPECTED_CONTENT_SECURITY_POLICY);
    const expectedContentType = assetPath.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/css; charset=utf-8";
    assert.equal(response.headers.get("content-type"), expectedContentType, `${assetPath} must not be an HTML fallback response`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.deepEqual(bytes, packedBytes, `${assetPath} response bytes must equal the installed tgz entry`);
    fetchedAssets.set(assetPath, { bytes, contentType: response.headers.get("content-type") });
  }));
  const bootstrap = fetchedAssets.get(expectedBootstrapPath);
  assert.ok(bootstrap, "theme bootstrap must be among the fetched same-origin assets");
  assert.equal(bootstrap.contentType, "text/javascript; charset=utf-8");
  assert.equal(digest(bootstrap.bytes), EXPECTED_FIRST_PAINT_THEME_BOOTSTRAP_SHA256, "theme bootstrap must equal its reviewed complete source digest");
  assert.match(bootstrap.bytes.toString("utf8"), /localStorage\.getItem\("uc-theme"\)/u);
}

test("cold packed Alpha validates the installed fail-closed lifecycle outside the monorepo", async () => {
  const packDirectory = await mkdtemp(path.join(tmpdir(), "preview-pack-"));
  const installDirectory = await mkdtemp(path.join(tmpdir(), "preview-install-"));
  const { root: mcpRoot, rawLegacyIds } = await createMcpRoot();
  let publishedRoot = null;
  let previewChild = null;
  let mcpChild = null;
  let managedInstallRoot = null;
  try {
    const suppliedTarball = process.env.UNDERSTAND_CODE_PREVIEW_TARBALL;
    let packRecord = null;
    if (suppliedTarball === undefined) {
      const packed = await execFileBounded("npm", ["pack", ".", "--ignore-scripts", "--pack-destination", packDirectory, "--json"], { cwd: packageRoot, encoding: "utf8" });
      const records = JSON.parse(packed.stdout);
      assert.equal(records.length, 1, "npm pack must produce exactly one package record");
      [packRecord] = records;
      assert.equal(packRecord.entryCount, EXPECTED_PACKED_FILE_COUNT);
    }
    const packedTarballs = suppliedTarball === undefined
      ? (await readdir(packDirectory)).filter((name) => name.endsWith(".tgz"))
      : [];
    if (suppliedTarball === undefined) assert.equal(packedTarballs.length, 1);
    const tarballPath = suppliedTarball === undefined
      ? path.join(packDirectory, packedTarballs[0] ?? "")
      : path.resolve(suppliedTarball);
    const tarball = path.basename(tarballPath);
    assert.ok(tarball);
    if (packRecord !== null) assert.equal(packRecord.filename, tarball);
    const tarballBefore = await readFile(tarballPath);
    const packedFiles = validatePackedTarball(tarballBefore);
    const expectedVersion = expectedPackedVersion(packedFiles);
    await execFileBounded("npm", ["install", "--global", "--prefix", installDirectory, "--ignore-scripts", "--no-package-lock", "--no-audit", "--no-fund", tarballPath], { cwd: installDirectory, encoding: "utf8" });
    const globalBinRoot = process.platform === "win32" ? installDirectory : path.join(installDirectory, "bin");
    const globalModulesRoot = process.platform === "win32" ? path.join(installDirectory, "node_modules") : path.join(installDirectory, "lib/node_modules");
    const installedPackageRoot = path.join(globalModulesRoot, "@understand-code/preview");
    const previewBin = path.join(globalBinRoot, "understand-code-preview");
    const mcpBin = path.join(globalBinRoot, "understand-code");
    const codexBin = path.join(globalBinRoot, "understand-code-codex");
    const claudeBin = path.join(globalBinRoot, "understand-code-claude");
    const [previewVersion, mcpVersion] = await Promise.all([
      execFileBounded(previewBin, ["--version"], { cwd: installDirectory, encoding: "utf8" }),
      execFileBounded(mcpBin, ["--version"], { cwd: installDirectory, encoding: "utf8" }),
    ]);
    assert.equal(previewVersion.stdout, `${expectedVersion}\n`);
    assert.equal(mcpVersion.stdout, `${expectedVersion}\n`);
    const help = await execFileBounded(previewBin, ["--help"], { cwd: installDirectory, encoding: "utf8" });
    assert.match(help.stdout, /understand-code-preview --demo/u);
    const mcpHelp = await execFileBounded(mcpBin, ["--help"], { cwd: installDirectory, encoding: "utf8" });
    assert.match(mcpHelp.stdout, /understand-code mcp --stdio --root/u);
    assert.match(mcpHelp.stdout, /understand-code install/u);
    assert.match(mcpHelp.stdout, /understand-code doctor/u);
    assert.match(mcpHelp.stdout, /understand-code uninstall/u);
    await assert.rejects(
      execFileBounded(previewBin, ["--unknown"], { cwd: installDirectory, encoding: "utf8" }),
      (error) => error && error.code === 2 && error.stderr === "preview_error unknown option: --unknown\n",
    );
    await assert.rejects(
      execFileBounded(mcpBin, ["--service-config", "relative-provider-service.json"], {
        cwd: installDirectory,
        encoding: "utf8",
      }),
      (error) =>
        error &&
        error.code === 2 &&
        error.stdout === "" &&
        error.stderr === "understand-code: configuration_error\n",
      "the public CLI must reject the private service entrypoint without an exact invocation",
    );
    const manifest = JSON.parse(await readFile(path.join(installedPackageRoot, "package.json"), "utf8"));
    assert.deepEqual(manifest.dependencies ?? {}, {});
    assert.deepEqual(manifest.exports, {});
    assert.equal(Object.hasOwn(manifest, "main"), false);
    assert.equal(manifest.version, expectedVersion);
    assert.deepEqual(manifest.bin, {
      "understand-code-preview": "dist/bin.mjs",
      "understand-code": "dist/understand-code.mjs",
      "understand-code-codex": "dist/host-bin.mjs",
      "understand-code-claude": "dist/host-bin.mjs",
    });
    const importConsumerRoot = path.join(installDirectory, "import-consumer");
    await mkdir(importConsumerRoot, { recursive: true });
    await execFileBounded("npm", ["install", "--prefix", importConsumerRoot, "--ignore-scripts", "--no-package-lock", "--no-audit", "--no-fund", tarballPath], { cwd: importConsumerRoot, encoding: "utf8" });
    assert.deepEqual(await probePackageImport(importConsumerRoot, "@understand-code/preview"), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
    assert.deepEqual(await probePackageImport(importConsumerRoot, "@understand-code/preview/dist/bin.mjs"), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
    const bundlePath = path.join(installedPackageRoot, "dist/understand-code.mjs");
    const hostEntrypointPath = path.join(installedPackageRoot, "dist/host-bin.mjs");
    const previewEntrypointPath = path.join(installedPackageRoot, "dist/bin.mjs");
    const bundleBytes = await readFile(bundlePath);
    const hostEntrypointBytes = await readFile(hostEntrypointPath);
    const previewEntrypointBytes = await readFile(previewEntrypointPath);
    const bundle = bundleBytes.toString("utf8");
    assert.doesNotMatch(bundle, /workspace:\*/u);
    assert.doesNotMatch(bundle, new RegExp(packageRoot.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
    assert.match(bundle, /understand-code-owned-v1/u, "the packed CLI must carry its managed-install identity");
    const cliRelease = {
      bin: "understand-code",
      path: "dist/understand-code.mjs",
      sha256: `sha256:${digest(bundleBytes)}`,
    };
    const hostEntrypointSha256 = `sha256:${digest(hostEntrypointBytes)}`;
    const pluginDefinitions = {
      codex: {
        marketplaceRoot: "dist/plugin-roots/codex",
        marketplace: "dist/plugin-roots/codex/.agents/plugins/marketplace.json",
        pluginRoot: "dist/plugin-roots/codex/plugins/understand-code",
        manifest: "dist/plugin-roots/codex/plugins/understand-code/.codex-plugin/plugin.json",
      },
      claude: {
        marketplaceRoot: "dist/plugin-roots/claude",
        marketplace: "dist/plugin-roots/claude/.claude-plugin/marketplace.json",
        pluginRoot: "dist/plugin-roots/claude/plugins/understand-code",
        manifest: "dist/plugin-roots/claude/plugins/understand-code/.claude-plugin/plugin.json",
      },
    };
    const pluginRoots = {};
    for (const [host, definition] of Object.entries(pluginDefinitions)) {
      const mcp = `${definition.pluginRoot}/.mcp.json`;
      const entrypoint = `${definition.pluginRoot}/bin/understand-code-plugin.mjs`;
      const pluginCli = `${definition.pluginRoot}/bin/understand-code.mjs`;
      const pluginNative =
        `${definition.pluginRoot}/bin/native/${NATIVE_TUPLE}/provider_kernel_peer.node`;
      const dashboardRoot = `${definition.pluginRoot}/bin/dashboard`;
      const dashboardManifest = `${definition.pluginRoot}/bin/dashboard-manifest.json`;
      const [marketplaceBytes, pluginManifestBytes, mcpBytes, entrypointBytes, pluginCliBytes,
        pluginNativeBytes, pluginDashboardManifestBytes] =
        await Promise.all([
          readFile(path.join(installedPackageRoot, definition.marketplace)),
          readFile(path.join(installedPackageRoot, definition.manifest)),
          readFile(path.join(installedPackageRoot, mcp)),
          readFile(path.join(installedPackageRoot, entrypoint)),
          readFile(path.join(installedPackageRoot, pluginCli)),
          readFile(path.join(installedPackageRoot, pluginNative)),
          readFile(path.join(installedPackageRoot, dashboardManifest)),
        ]);
      assert.deepEqual(pluginCliBytes, bundleBytes, `${host} plugin must carry the exact release CLI bytes`);
      assert.deepEqual(
        pluginNativeBytes,
        packedFiles.get(
          `package/dist/native/${NATIVE_TUPLE}/provider_kernel_peer.node`,
        ),
        `${host} plugin must carry the exact release native peer bytes`,
      );
      const pluginDashboardPrefix = `package/${dashboardRoot}/`;
      const pluginDashboardInventory = [...packedFiles.entries()]
        .filter(([entryPath]) => entryPath.startsWith(pluginDashboardPrefix))
        .map(([entryPath, bytes]) => ({
          path: entryPath.slice(pluginDashboardPrefix.length),
          sha256: `sha256:${digest(bytes)}`,
          bytes: bytes.byteLength,
        }))
        .sort((left, right) =>
          left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
        );
      const payloadFiles = {
        manifestSha256: `sha256:${digest(pluginManifestBytes)}`,
        mcpSha256: `sha256:${digest(mcpBytes)}`,
        entrypointSha256: `sha256:${digest(entrypointBytes)}`,
        cliSha256: `sha256:${digest(pluginCliBytes)}`,
        nativeSha256: `sha256:${digest(pluginNativeBytes)}`,
        dashboardManifestSha256: `sha256:${digest(pluginDashboardManifestBytes)}`,
        dashboardInventorySha256: `sha256:${digest(
          Buffer.from(JSON.stringify(pluginDashboardInventory), "utf8"),
        )}`,
      };
      pluginRoots[host] = {
        marketplaceRoot: definition.marketplaceRoot,
        marketplace: definition.marketplace,
        marketplaceSha256: `sha256:${digest(marketplaceBytes)}`,
        pluginRoot: definition.pluginRoot,
        manifest: definition.manifest,
        manifestSha256: payloadFiles.manifestSha256,
        mcp,
        mcpSha256: payloadFiles.mcpSha256,
        entrypoint,
        entrypointSha256: payloadFiles.entrypointSha256,
        cli: pluginCli,
        cliSha256: payloadFiles.cliSha256,
        native: pluginNative,
        nativeSha256: payloadFiles.nativeSha256,
        dashboardRoot,
        dashboardManifest,
        dashboardManifestSha256: payloadFiles.dashboardManifestSha256,
        dashboardFileCount: pluginDashboardInventory.length,
        dashboardInventorySha256: payloadFiles.dashboardInventorySha256,
        payloadSha256: `sha256:${digest(Buffer.from(JSON.stringify(payloadFiles), "utf8"))}`,
      };
      for (const relativePath of [
        definition.marketplace,
        definition.manifest,
        mcp,
        entrypoint,
        pluginCli,
        pluginNative,
        dashboardManifest,
      ]) {
        assert.deepEqual(
          await readFile(path.join(installedPackageRoot, relativePath)),
          packedFiles.get(`package/${relativePath}`),
          `${host} plugin file must equal its exact tgz entry: ${relativePath}`,
        );
      }
      for (const entry of pluginDashboardInventory) {
        const relativePath = `${dashboardRoot}/${entry.path}`;
        assert.deepEqual(
          await readFile(path.join(installedPackageRoot, relativePath)),
          packedFiles.get(`package/${relativePath}`),
          `${host} plugin Dashboard file must equal its exact tgz entry: ${relativePath}`,
        );
      }
    }
    const dashboardInventory = [...packedFiles.entries()]
      .filter(([entryPath]) =>
        entryPath.startsWith("package/dist/dashboard/"),
      )
      .map(([entryPath, bytes]) => ({
        path: entryPath.slice("package/dist/dashboard/".length),
        sha256: `sha256:${digest(bytes)}`,
        bytes: bytes.byteLength,
      }))
      .sort((left, right) =>
        left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
      );
    const releaseManifest = JSON.parse(
      await readFile(path.join(installedPackageRoot, "dist/release-manifest.json"), "utf8"),
    );
    assert.deepEqual(releaseManifest, {
      schemaVersion: "understand-code-alpha-release-v1",
      product: "understand-code",
      package: { name: "@understand-code/preview", version: manifest.version },
      cli: cliRelease,
      preview: {
        bin: "understand-code-preview",
        path: "dist/bin.mjs",
        sha256: `sha256:${digest(previewEntrypointBytes)}`,
      },
      native: {
        tuple: NATIVE_TUPLE,
        path: `dist/native/${NATIVE_TUPLE}/provider_kernel_peer.node`,
        sha256: `sha256:${digest(
          packedFiles.get(
            `package/dist/native/${NATIVE_TUPLE}/provider_kernel_peer.node`,
          ),
        )}`,
      },
      runtime: {
        productVersion: manifest.version,
        server: {
          path: "dist/server.mjs",
          sha256: `sha256:${digest(
            packedFiles.get("package/dist/server.mjs"),
          )}`,
        },
        contracts: {
          path: "dist/contracts.mjs",
          sha256: `sha256:${digest(
            packedFiles.get("package/dist/contracts.mjs"),
          )}`,
        },
      },
      dashboard: {
        productVersion: manifest.version,
        root: "dist/dashboard",
        manifest: "dist/dashboard-manifest.json",
        manifestSha256: `sha256:${digest(
          packedFiles.get("package/dist/dashboard-manifest.json"),
        )}`,
        fileCount: dashboardInventory.length,
        inventorySha256: `sha256:${digest(
          Buffer.from(JSON.stringify(dashboardInventory), "utf8"),
        )}`,
      },
      hostAdapters: {
        codex: {
          bin: "understand-code-codex",
          entrypoint: "dist/host-bin.mjs",
          entrypointSha256: hostEntrypointSha256,
          manifest: "dist/host-adapters/codex/manifest.json",
          configs: [
            "dist/host-adapters/codex/mcp.json",
            "dist/host-adapters/codex/config.toml",
          ],
        },
        claude: {
          bin: "understand-code-claude",
          entrypoint: "dist/host-bin.mjs",
          entrypointSha256: hostEntrypointSha256,
          manifest: "dist/host-adapters/claude/manifest.json",
          configs: ["dist/host-adapters/claude/.mcp.json"],
        },
      },
      pluginRoots,
    });
    const hostDefinitions = {
      codex: {
        bin: "understand-code-codex",
        placeholder: "${WORKSPACE_ROOT}",
        configs: ["mcp.json", "config.toml"],
      },
      claude: {
        bin: "understand-code-claude",
        placeholder: "${CLAUDE_PROJECT_DIR}",
        configs: [".mcp.json"],
      },
    };
    for (const [host, definition] of Object.entries(hostDefinitions)) {
      const hostRoot = path.join(installedPackageRoot, "dist/host-adapters", host);
      const hostManifest = JSON.parse(await readFile(path.join(hostRoot, "manifest.json"), "utf8"));
      assert.deepEqual(hostManifest, {
        schemaVersion: "understand-code-host-adapter-release-v1",
        product: "understand-code",
        productVersion: manifest.version,
        host,
        name: "understand-code",
        transport: "stdio",
        bin: definition.bin,
        entrypoint: "dist/host-bin.mjs",
        entrypointSha256: hostEntrypointSha256,
        cli: cliRelease,
        args: ["--root", definition.placeholder],
        root: {
          required: true,
          flag: "--root",
          placeholder: definition.placeholder,
          absolute: true,
        },
      });
      assert.deepEqual(
        await readFile(path.join(hostRoot, "manifest.json")),
        packedFiles.get(`package/dist/host-adapters/${host}/manifest.json`),
      );
      for (const config of definition.configs) {
        assert.deepEqual(
          await readFile(path.join(hostRoot, config)),
          packedFiles.get(`package/dist/host-adapters/${host}/${config}`),
        );
      }
    }
    assert.deepEqual(
      await readFile(path.join(installedPackageRoot, "dist/release-manifest.json")),
      packedFiles.get("package/dist/release-manifest.json"),
    );
    const codexConfig = JSON.parse(
      await readFile(path.join(installedPackageRoot, "dist/host-adapters/codex/mcp.json"), "utf8"),
    );
    const claudeConfig = JSON.parse(
      await readFile(path.join(installedPackageRoot, "dist/host-adapters/claude/.mcp.json"), "utf8"),
    );
    assert.deepEqual(codexConfig.mcpServers["understand-code"], {
      command: "understand-code-codex",
      args: ["--root", "${WORKSPACE_ROOT}"],
    });
    assert.deepEqual(claudeConfig.mcpServers["understand-code"], {
      command: "understand-code-claude",
      args: ["--root", "${CLAUDE_PROJECT_DIR}"],
    });
    for (const [hostBin, args] of [
      [codexBin, []],
      [claudeBin, ["--root", "relative/worktree"]],
      [codexBin, ["--root", "${WORKSPACE_ROOT}"]],
    ]) {
      await assert.rejects(
        execFileBounded(hostBin, args, { cwd: installDirectory, encoding: "utf8" }),
        (error) =>
          error?.code === 2 &&
          error.stdout === "" &&
          error.stderr === "workspace_root_required\n",
        "packed Host entrypoints must reject missing, non-absolute, or unexpanded Roots",
      );
    }
    assert.deepEqual(
      [...packedFiles.keys()].filter(
        (entry) => entry.includes("/dist/native/") || entry.endsWith("provider_kernel_peer.node"),
      ).sort(),
      [
        `package/dist/native/${NATIVE_TUPLE}/provider_kernel_peer.node`,
        `package/dist/plugin-roots/claude/plugins/understand-code/bin/native/${NATIVE_TUPLE}/provider_kernel_peer.node`,
        `package/dist/plugin-roots/codex/plugins/understand-code/bin/native/${NATIVE_TUPLE}/provider_kernel_peer.node`,
      ].sort(),
      "the Alpha tgz must carry exactly the current platform native tuple",
    );
    const requestedInstallRoot = path.join(installDirectory, "managed-install");
    const installed = await runCliJson(
      mcpBin,
      ["install", "--root", requestedInstallRoot, "--host", "codex"],
      installDirectory,
    );
    assert.equal(installed.ok, true);
    assert.equal(installed.status, "installed");
    assert.equal(installed.version, manifest.version);
    assert.equal(installed.root, await realpath(requestedInstallRoot));
    managedInstallRoot = installed.root;
    const installedWrapper = path.join(managedInstallRoot, "bin/understand-code");
    const installedBundle = path.join(managedInstallRoot, "lib/understand-code.mjs");
    const installedNativePeer = path.join(
      managedInstallRoot,
      `lib/native/${NATIVE_TUPLE}/provider_kernel_peer.node`,
    );
    assert.deepEqual(
      await readFile(installedNativePeer),
      packedFiles.get(`package/dist/native/${NATIVE_TUPLE}/provider_kernel_peer.node`),
      "managed install must copy the exact native peer from the single tgz",
    );
    const initialDoctor = await runCliJson(
      installedBundle,
      ["doctor", "--root", managedInstallRoot],
      installDirectory,
    );
    assert.equal(initialDoctor.ok, true);
    assert.equal(initialDoctor.status, "healthy");
    assert.equal(initialDoctor.version, manifest.version);
    const managedMcp = spawn(installedWrapper, ["--root", mcpRoot], {
      cwd: installDirectory,
      env: { PATH: process.env.PATH },
      stdio: ["pipe", "pipe", "pipe"],
    });
    mcpChild = managedMcp;
    const managedOutput = collectMessages(managedMcp);
    writeMessage(managedMcp, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "preview-managed-install-smoke", version: "1.0.0" },
      },
    });
    const managedInitialized = await managedOutput.waitFor(
      (message) => message.id === 1,
      "managed install MCP initialize response",
    );
    assert.equal(managedInitialized.result.serverInfo.version, manifest.version);
    writeMessage(managedMcp, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    });
    managedMcp.stdin.end();
    assert.deepEqual(await waitForExit(managedMcp, "managed install MCP clean exit"), [0, null]);
    mcpChild = null;
    assert.equal(managedOutput.stderr.join(""), "");
    const installedPreviewBundle = await readFile(path.join(installedPackageRoot, "dist/bin.mjs"), "utf8");
    assert.doesNotMatch(installedPreviewBundle, new RegExp(packageRoot.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
    const preview = startPreview(previewBin, installDirectory);
    previewChild = preview.child;
    const ready = await preview.ready;
    const previewUrl = new URL(ready.url);
    assert.equal(ready.mode, "demo");
    assert.equal(ready.wiki, "ready");
    const index = await fetch(previewUrl);
    assert.equal(index.status, 200);
    const indexHtml = await index.text();
    assert.match(indexHtml, /<div id="root"><\/div>/u);
    await assertPackedDashboard(index, indexHtml, previewUrl, packedFiles);
    const graph = await fetch(`${previewUrl.origin}/knowledge-graph.json?token=${encodeURIComponent(ready.token)}`);
    assert.equal(graph.status, 200);
    assert.equal((await graph.json()).project.name, "Preview 示例项目");
    const task = await fetch(`${previewUrl.origin}/tasks/01ARZ3NDEKTSV4RRFFQ69G5FAV/brief.json?token=${encodeURIComponent(ready.token)}`);
    assert.equal(task.status, 503);
    assert.deepEqual(await task.json(), {
      error: "provider_unavailable",
      reason: "unavailable",
    });
    assert.deepEqual(await stopChild(previewChild, "cold Preview"), [0, null]);
    previewChild = null;
    await assertPortReleased(previewUrl, "cold Preview");

    publishedRoot = await createPublishedPreviewRoot(installedPackageRoot);
    const rootPreview = startPreview(previewBin, installDirectory, ["--root", publishedRoot, "--port", "0", "--no-open"]);
    previewChild = rootPreview.child;
    const rootReady = await rootPreview.ready;
    assert.equal(rootReady.mode, "root");
    assert.equal(rootReady.wiki, "ready");
    const rootUrl = new URL(rootReady.url);
    const [rootGraph, rootWiki] = await Promise.all([
      fetch(`${rootUrl.origin}/knowledge-graph.json?token=${encodeURIComponent(rootReady.token)}`),
      fetch(`${rootUrl.origin}/knowledge-base/wiki-index.json?token=${encodeURIComponent(rootReady.token)}`),
    ]);
    assert.equal(rootGraph.status, 200);
    assert.equal(rootWiki.status, 200);
    assert.equal((await rootWiki.json()).version, 2);
    assert.deepEqual(await stopChild(previewChild, "cold root Preview"), [0, null]);
    previewChild = null;
    await assertPortReleased(rootUrl, "cold root Preview");

    const sourcePath = path.join(mcpRoot, "src/task.ts");
    const sourceBefore = await readFile(sourcePath);
    const indexBefore = digest(await readFile(path.join(mcpRoot, ".git/index")));
    const mcp = spawn(codexBin, ["--root", mcpRoot], {
      cwd: installDirectory,
      env: {
        PATH: process.env.PATH,
        GIT_DIR: path.join(mcpRoot, "ambient-git-dir-must-not-be-authority"),
        UNDERSTAND_CODE_CLI: path.join(installDirectory, "must-not-redirect-packed-host"),
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    mcpChild = mcp;
    const output = collectMessages(mcp);
    writeMessage(mcp, {
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "preview-cold-codex", version: "1.0.0" } },
    });
    assert.deepEqual(await output.waitFor((message) => message.id === 1, "MCP initialize response"), {
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2025-11-25",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "understand-code", version: manifest.version },
      },
    });
    writeMessage(mcp, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });
    writeMessage(mcp, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const listed = await output.waitFor((message) => message.id === 2, "MCP tools/list response");
    assert.deepEqual(listed.result.tools.map((tool) => tool.name), [
      "get_repo_pulse",
      "build_task_brief",
      "get_task_brief",
      "update_task",
      "check_change",
      "record_verification",
      "open_workbench",
      "get_evidence",
      "search_context",
      "trace_impact",
      "refresh_index",
    ]);

    const pulse = await callTool(
      mcp,
      output,
      3,
      "get_repo_pulse",
      {},
      GetRepoPulseOutputV1Schema,
    );
    assert.deepEqual(
      Object.keys(pulse.structuredContent.meta).sort(),
      ["cacheHit", "durationMs"],
    );
    assert.equal(pulse.structuredContent.meta.cacheHit, true);
    assert.equal(typeof pulse.structuredContent.meta.durationMs, "number");
    assert.ok(pulse.structuredContent.meta.durationMs >= 0);
    assert.deepEqual(pulse.structuredContent.result.pulse, {
      viewVersion: 1,
      viewKind: "legacy_repo_pulse_redacted",
      status: "partial",
      aggregateChangeCount: 0,
      evaluatedAt: "2026-08-12T00:00:00.000Z",
      strongOperationSupported: false,
    });
    const publicPulseJson = JSON.stringify(pulse);
    assert.doesNotMatch(
      publicPulseJson,
      /"[^"]*(?:repository|worktree|snapshot|root|branch|path|oid|digest|diagnostic)[^"]*"\s*:/iu,
    );
    assert.equal(publicPulseJson.includes(mcpRoot), false);
    assert.equal(publicPulseJson.includes("src/task.ts"), false);
    for (const rawLegacyId of rawLegacyIds) {
      assert.equal(publicPulseJson.includes(rawLegacyId), false);
    }

    const lockedTaskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const lockedSnapshotId = "snapshot:preview-alpha-strong-store-unavailable";
    const lockedBaselineSnapshotId =
      "snapshot:preview-alpha-rebase-baseline-strong-store-unavailable";
    const publicMutations = [
      {
        name: "refresh_index",
        arguments: {
          mode: "full",
          idempotencyKey: "preview-alpha-refresh-locked",
          actor: "agent:preview-alpha",
        },
      },
      {
        name: "build_task_brief",
        arguments: {
          task: "Prepare and verify a safe change to the task function.",
          expectedRevision: 0,
          idempotencyKey: "preview-alpha-build-locked",
          actor: "agent:preview-alpha",
          scope: ["src/task.ts"],
        },
      },
      {
        name: "update_task",
        arguments: {
          taskId: lockedTaskId,
          action: { type: "transition_status", to: "planned" },
          expectedRevision: 0,
          idempotencyKey: "preview-alpha-update-locked",
          actor: "agent:preview-alpha",
        },
      },
      {
        label: "update_task refresh_task_context",
        name: "update_task",
        arguments: {
          taskId: lockedTaskId,
          action: {
            type: "refresh_task_context",
            targetSnapshotId: lockedSnapshotId,
          },
          expectedRevision: 0,
          idempotencyKey: "preview-alpha-context-refresh-locked",
          actor: "agent:preview-alpha",
        },
      },
      {
        label: "update_task rebase_task",
        name: "update_task",
        arguments: {
          taskId: lockedTaskId,
          action: {
            type: "rebase_task",
            targetSnapshotId: lockedSnapshotId,
            newBaselineSnapshotId: lockedBaselineSnapshotId,
            reason: "Strong Store authority is unavailable.",
          },
          expectedRevision: 0,
          idempotencyKey: "preview-alpha-context-rebase-locked",
          actor: "agent:preview-alpha",
        },
      },
      {
        name: "check_change",
        arguments: {
          taskId: lockedTaskId,
          actualSnapshotId: lockedSnapshotId,
          includeWorktree: true,
          expectedRevision: 0,
          idempotencyKey: "preview-alpha-check-locked",
          actor: "agent:preview-alpha",
        },
      },
      {
        name: "record_verification",
        arguments: {
          taskId: lockedTaskId,
          record: {
            verificationPlanEntryId: "verification-plan:preview-alpha-locked",
            kind: "manual",
            status: "blocked",
            summary: "Strong Store authority is unavailable.",
            claimIds: [],
            snapshotId: lockedSnapshotId,
          },
          expectedRevision: 0,
          idempotencyKey: "preview-alpha-verification-locked",
          actor: "agent:preview-alpha",
        },
      },
    ];
    let nextMutationRequestId = 4;
    for (const mutation of publicMutations) {
      const mutationLabel = mutation.label ?? mutation.name;
      const [mutationSourceBefore, mutationIndexBefore, mutationStoreBefore] =
        await Promise.all([
          readFile(sourcePath),
          readFile(path.join(mcpRoot, ".git/index")),
          snapshotManagedStoreTree(mcpRoot),
        ]);
      const failure = await callTool(
        mcp,
        output,
        nextMutationRequestId++,
        mutation.name,
        mutation.arguments,
        McpToolErrorResultV1Schema,
      );
      assert.deepEqual(
        failure,
        EXPECTED_PUBLIC_MUTATION_FAILURE,
        `${mutationLabel} must fail closed behind the unavailable strong Store`,
      );
      assert.deepEqual(
        await readFile(sourcePath),
        mutationSourceBefore,
        `${mutationLabel} must not mutate source bytes`,
      );
      assert.deepEqual(
        await readFile(path.join(mcpRoot, ".git/index")),
        mutationIndexBefore,
        `${mutationLabel} must not mutate Git index bytes`,
      );
      assert.deepEqual(
        await snapshotManagedStoreTree(mcpRoot),
        mutationStoreBefore,
        `${mutationLabel} must leave the managed Store tree byte-identical`,
      );
    }

    const releaseDoctor = await runCliJsonFailure(
      mcpBin,
      ["doctor"],
      mcpRoot,
      1,
    );
    assert.deepEqual(
      {
        schemaVersion: releaseDoctor.schemaVersion,
        product: releaseDoctor.product,
        version: releaseDoctor.version,
        readiness: releaseDoctor.readiness,
        releaseReady: releaseDoctor.releaseReady,
        strongWrites: releaseDoctor.strongWrites,
        hostRegistration: releaseDoctor.hostRegistration,
        ok: releaseDoctor.ok,
        status: releaseDoctor.status,
      },
      {
        schemaVersion: "understand-code-release-doctor-v1",
        product: "understand-code",
        version: manifest.version,
        readiness: "alpha",
        releaseReady: false,
        strongWrites: "locked",
        hostRegistration: "not_checked",
        ok: false,
        status: "unhealthy",
      },
    );
    const releaseDoctorById = new Map(
      releaseDoctor.checks.map((check) => [check.id, check]),
    );
    assert.deepEqual([...releaseDoctorById.keys()], [
      "node_runtime",
      "git",
      "repository_root",
      "artifact_schema",
      "loopback_port",
      "package_metadata",
      "release_manifest",
      "bundle_integrity",
      "native_tuple",
      "codex_plugin_payload",
      "claude_plugin_payload",
      "release_authenticity",
      "provider_strong_writes",
    ]);
    for (const id of [
      "node_runtime",
      "git",
      "repository_root",
      "loopback_port",
      "package_metadata",
      "release_manifest",
      "bundle_integrity",
      "native_tuple",
      "codex_plugin_payload",
      "claude_plugin_payload",
    ]) {
      assert.equal(releaseDoctorById.get(id)?.status, "pass", `${id} must pass`);
    }
    assert.deepEqual(
      {
        status: releaseDoctorById.get("artifact_schema")?.status,
        code: releaseDoctorById.get("artifact_schema")?.code,
      },
      {
        status: "fail",
        code: "artifact_schema_incompatible",
      },
    );
    assert.deepEqual(
      {
        status: releaseDoctorById.get("release_authenticity")?.status,
        code: releaseDoctorById.get("release_authenticity")?.code,
      },
      {
        status: "locked",
        code: "release_attestation_unavailable",
      },
    );
    assert.deepEqual(
      {
        status: releaseDoctorById.get("provider_strong_writes")?.status,
        code: releaseDoctorById.get("provider_strong_writes")?.code,
      },
      {
        status: "locked",
        code: "provider_strong_writes_locked",
      },
    );
    const releaseDoctorBytes = JSON.stringify(releaseDoctor);
    assert.doesNotMatch(
      releaseDoctorBytes,
      /"strongWrites"\s*:\s*"(?:enabled|supported|unlocked)"/u,
    );
    assert.doesNotMatch(
      releaseDoctorBytes,
      new RegExp(mcpRoot.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"),
    );

    mcp.stdin.end();
    assert.deepEqual(await waitForExit(mcp, "MCP clean exit"), [0, null]);
    mcpChild = null;
    assert.equal(output.stderr.join(""), "");

    const finalDoctor = await runCliJson(
      installedBundle,
      ["doctor", "--root", managedInstallRoot],
      installDirectory,
    );
    assert.equal(finalDoctor.ok, true);
    assert.equal(finalDoctor.status, "healthy");
    assert.equal(finalDoctor.version, manifest.version);
    const uninstalled = await runCliJson(
      mcpBin,
      ["uninstall", "--root", managedInstallRoot],
      installDirectory,
    );
    assert.equal(uninstalled.ok, true);
    assert.equal(uninstalled.status, "removed");
    for (const relative of [
      ".understand-code-owner",
      "bin/understand-code",
      "lib/understand-code.mjs",
      `lib/native/${NATIVE_TUPLE}/provider_kernel_peer.node`,
      "config/mcp.json",
      "installation-manifest.json",
    ]) {
      await assert.rejects(
        readFile(path.join(managedInstallRoot, relative)),
        (error) => error?.code === "ENOENT",
        `uninstall must remove owned path ${relative}`,
      );
    }

    assert.deepEqual(await readFile(sourcePath), sourceBefore);
    assert.equal(digest(await readFile(path.join(mcpRoot, ".git/index"))), indexBefore);
    assert.deepEqual(await readFile(tarballPath), tarballBefore);
  } finally {
    await Promise.allSettled([
      stopChild(previewChild, "cold Preview"),
      stopChild(mcpChild, "cold MCP"),
    ]);
    await Promise.all([
      rm(packDirectory, { recursive: true, force: true }),
      rm(installDirectory, { recursive: true, force: true }),
      rm(mcpRoot, { recursive: true, force: true }),
      ...(publishedRoot === null ? [] : [rm(publishedRoot, { recursive: true, force: true })]),
    ]);
  }
});
