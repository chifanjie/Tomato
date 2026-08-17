import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";

import { ArtifactStore, sha256CanonicalJson } from "../../artifact-store/dist/index.js";
import {
  BuildTaskBriefOutputV1Schema,
  GetRepoPulseOutputV1Schema,
  GetTaskBriefOutputV1Schema,
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
const MAX_PACKED_TARBALL_BYTES = 2 * 1024 * 1024;
const MAX_EXPANDED_TAR_BYTES = 12 * 1024 * 1024;
const MAX_PACKED_FILE_BYTES = 4 * 1024 * 1024;
const MAX_PACKED_TOTAL_FILE_BYTES = 8 * 1024 * 1024;
const EXPECTED_PACKED_FILE_COUNT = 36;

const packedFileRules = [
  { label: "package metadata", pattern: /^package\/(?:README\.md|package\.json)$/u, count: 2, mode: 0o644 },
  { label: "runtime modules", pattern: /^package\/dist\/(?:README\.md|bin\.mjs|contracts\.mjs|server\.mjs)$/u, count: 4, mode: 0o644 },
  { label: "MCP executable", pattern: /^package\/dist\/understand-code\.mjs$/u, count: 1, mode: 0o755 },
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
    assert.ok(entries.length < 64, "tar raw-entry count must remain bounded");
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
  let totalFileBytes = 0;
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
    totalFileBytes += entry.size;
    fileCount += 1;
  }
  assert.equal(pendingPax, null, "tar must not end with an unapplied PAX header");
  assert.equal(fileCount, EXPECTED_PACKED_FILE_COUNT, "packed logical file count must remain exact");
  assert.equal(seenPaxHeaders.size, expectedPaxPaths.size, "packed PAX header count must remain exact");
  assert.ok(totalFileBytes <= MAX_PACKED_TOTAL_FILE_BYTES, "packed logical files must satisfy the total-size bound");
  for (const rule of packedFileRules) {
    assert.equal(ruleCounts.get(rule.label), rule.count, `${rule.label} packed-entry count must remain exact`);
  }
  return packedFiles;
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
  return root;
}

async function createPublishedPreviewRoot(installedPackageRoot) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "preview-cold-published-root-")));
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(path.join(root, "src/app.ts"), "export function main() { return 'ready'; }\n");
  await writeFile(path.join(root, ".gitignore"), ".understand-code/\n");
  await git(root, ["init", "-q"]);
  await git(root, ["add", ".gitignore", "src/app.ts"]);
  await git(root, ["commit", "-q", "-m", "cold Preview root fixture"]);
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
  wiki.source.sourceRootIdentity = root;
  wiki.source.gitCommitHash = head;
  wiki.source.graphDigest = graphDigest;
  await writeFile(wikiPath, `${JSON.stringify(wiki, null, 2)}\n`);
  return root;
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
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

test("cold packed Preview installs outside the monorepo with both usable bins", async () => {
  const packDirectory = await mkdtemp(path.join(tmpdir(), "preview-pack-"));
  const installDirectory = await mkdtemp(path.join(tmpdir(), "preview-install-"));
  const mcpRoot = await createMcpRoot();
  let publishedRoot = null;
  let previewChild = null;
  let mcpChild = null;
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
    await execFileBounded("npm", ["install", "--global", "--prefix", installDirectory, "--ignore-scripts", "--no-package-lock", "--no-audit", "--no-fund", tarballPath], { cwd: installDirectory, encoding: "utf8" });
    const globalBinRoot = process.platform === "win32" ? installDirectory : path.join(installDirectory, "bin");
    const globalModulesRoot = process.platform === "win32" ? path.join(installDirectory, "node_modules") : path.join(installDirectory, "lib/node_modules");
    const installedPackageRoot = path.join(globalModulesRoot, "@understand-code/preview");
    const previewBin = path.join(globalBinRoot, "understand-code-preview");
    const mcpBin = path.join(globalBinRoot, "understand-code");
    const [previewVersion, mcpVersion] = await Promise.all([
      execFileBounded(previewBin, ["--version"], { cwd: installDirectory, encoding: "utf8" }),
      execFileBounded(mcpBin, ["--version"], { cwd: installDirectory, encoding: "utf8" }),
    ]);
    assert.equal(previewVersion.stdout, "0.1.0-preview.1\n");
    assert.equal(mcpVersion.stdout, "0.1.0\n");
    const help = await execFileBounded(previewBin, ["--help"], { cwd: installDirectory, encoding: "utf8" });
    assert.match(help.stdout, /understand-code-preview --demo/u);
    await assert.rejects(
      execFileBounded(previewBin, ["--unknown"], { cwd: installDirectory, encoding: "utf8" }),
      (error) => error && error.code === 2 && error.stderr === "preview_error unknown option: --unknown\n",
    );
    const manifest = JSON.parse(await readFile(path.join(installedPackageRoot, "package.json"), "utf8"));
    assert.deepEqual(manifest.dependencies ?? {}, {});
    assert.deepEqual(manifest.exports, {});
    assert.equal(Object.hasOwn(manifest, "main"), false);
    const importConsumerRoot = path.join(installDirectory, "import-consumer");
    await mkdir(importConsumerRoot, { recursive: true });
    await execFileBounded("npm", ["install", "--prefix", importConsumerRoot, "--ignore-scripts", "--no-package-lock", "--no-audit", "--no-fund", tarballPath], { cwd: importConsumerRoot, encoding: "utf8" });
    assert.deepEqual(await probePackageImport(importConsumerRoot, "@understand-code/preview"), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
    assert.deepEqual(await probePackageImport(importConsumerRoot, "@understand-code/preview/dist/bin.mjs"), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
    const bundle = await readFile(path.join(installedPackageRoot, "dist/understand-code.mjs"), "utf8");
    assert.doesNotMatch(bundle, /workspace:\*/u);
    assert.doesNotMatch(bundle, new RegExp(packageRoot.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
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
    assert.equal(task.status, 200);
    assert.equal((await task.json()).section, "summary");
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

    const sourceBefore = await readFile(path.join(mcpRoot, "src/task.ts"));
    const indexBefore = digest(await readFile(path.join(mcpRoot, ".git/index")));
    const mcp = spawn(mcpBin, ["mcp", "--stdio", "--root", mcpRoot], {
      cwd: installDirectory,
      env: { PATH: process.env.PATH, GIT_DIR: path.join(mcpRoot, "ambient-git-dir-must-not-be-authority") },
      stdio: ["pipe", "pipe", "pipe"],
    });
    mcpChild = mcp;
    const output = collectMessages(mcp);
    writeMessage(mcp, {
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "preview-cold", version: "1.0.0" } },
    });
    assert.deepEqual(await output.waitFor((message) => message.id === 1, "MCP initialize response"), {
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2025-11-25",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "understand-code", version: "0.1.0" },
      },
    });
    writeMessage(mcp, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });
    writeMessage(mcp, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    writeMessage(mcp, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_repo_pulse", arguments: {} } });
    writeMessage(mcp, {
      jsonrpc: "2.0", id: 4, method: "tools/call",
      params: {
        name: "build_task_brief",
        arguments: {
          task: "Prepare a safe change to the task function.", expectedRevision: 0,
          idempotencyKey: "preview-cold-brief", actor: "agent:preview-cold", scope: ["src/task.ts"],
        },
      },
    });
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
    ]);
    GetRepoPulseOutputV1Schema.parse((await output.waitFor((message) => message.id === 3, "MCP get_repo_pulse response")).result);
    const built = BuildTaskBriefOutputV1Schema.parse((await output.waitFor((message) => message.id === 4, "MCP build_task_brief response")).result);
    writeMessage(mcp, {
      jsonrpc: "2.0", id: 5, method: "tools/call",
      params: { name: "get_task_brief", arguments: { taskId: built.structuredContent.result.task.taskId, section: "summary" } },
    });
    GetTaskBriefOutputV1Schema.parse((await output.waitFor((message) => message.id === 5, "MCP get_task_brief response")).result);
    mcp.stdin.end();
    assert.deepEqual(await waitForExit(mcp, "MCP clean exit"), [0, null]);
    mcpChild = null;
    assert.equal(output.stderr.join(""), "");
    assert.deepEqual(await readFile(path.join(mcpRoot, "src/task.ts")), sourceBefore);
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
