import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";

import {
  BuildTaskBriefOutputV1Schema,
  CheckChangeOutputV1Schema,
  GetEvidenceOutputV1Schema,
  GetTaskBriefOutputV1Schema,
  OpenWorkbenchOutputV1Schema,
  RecordVerificationOutputV1Schema,
  RefreshIndexOutputV1Schema,
  RepositorySnapshotArtifactV1Schema,
  UpdateTaskOutputV1Schema,
} from "../../contracts/dist/index.js";
import { launchBrowser, resolveBrowserExecutable } from "./browser-harness.mjs";

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceRoot = path.resolve(packageRoot, "../..");
const PROCESS_TIMEOUT_MS = 60_000;
const EXTERNAL_TIMEOUT_MS = 120_000;
const REQUIRE_REAL_BROWSER = process.env.UNDERSTAND_CODE_REQUIRE_REAL_BROWSER === "1";
const INITIAL_SOURCE = [
  "export function foo() { return 'foo-before'; }",
  "export function bar() { return 'bar-before'; }",
  "",
].join("\n");
const BAR_ONLY_SOURCE = [
  "export function foo() { return 'foo-before'; }",
  "export function bar() { return 'bar-wrong-hunk'; }",
  "",
].join("\n");
const FOO_ONLY_SOURCE = [
  "export function foo() { return 'browser-ready'; }",
  "export function bar() { return 'bar-before'; }",
  "",
].join("\n");
const INITIAL_EXTRA_SOURCE =
  "export function extra() { return 'extra-before'; }\n";
const ADDED_SOURCE =
  "export function added() { return 'added-unplanned'; }\n";
const UNTRACKED_SOURCE =
  "export function untrackedAdded() { return 'untracked-ready'; }\n";
const INTENT_TO_ADD_SOURCE =
  "export function intentToAdd() { return 'intent-ready'; }\n";
const FOO_NODE_ID = "function:src/index.ts:foo";
const BAR_NODE_ID = "function:src/index.ts:bar";
const EXTRA_NODE_ID = "function:src/extra.ts:extra";
const ADDED_NODE_ID = "function:src/added.ts:added";
const UNTRACKED_NODE_ID = "function:src/untracked.ts:untrackedAdded";
const INTENT_TO_ADD_NODE_ID =
  "function:src/intent-to-add.ts:intentToAdd";
const LIFECYCLE_V2_VERSION = "0.1.0-preview.2.workbench.lifecycle-v2";
const CANDIDATE_SCRIPT = "packages/preview/scripts/alpha-candidate.mjs";
const CANDIDATE_MANIFEST = "understand-code-alpha-candidate.json";
const CANDIDATE_SCHEMA = "understand-code-alpha-candidate-v1.schema.json";
const CANDIDATE_CHECKSUMS = "SHA256SUMS";
const V1_OVERLAY_FILES = [
  "packages/preview/test/cold-packed.test.mjs",
  "packages/preview/test/workbench-browser-packed.test.mjs",
  "packages/task-engine/src/change-intelligence.ts",
  "packages/task-engine/src/engine-types.ts",
  "packages/task-engine/src/repository-context-provider.ts",
];
const V2_SOURCE_FILES = [
  "packages/preview/package.json",
  "packages/host-adapters/plugin-roots/codex/plugins/understand-code/.codex-plugin/plugin.json",
  "packages/host-adapters/plugin-roots/claude/plugins/understand-code/.claude-plugin/plugin.json",
  "packages/host-adapters/plugin-roots/claude/.claude-plugin/marketplace.json",
  "packages/dashboard/index.html",
];

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function contentDigest(bytes) {
  return `sha256:${digest(bytes)}`;
}

function execBounded(command, args, options = {}) {
  return execFileAsync(command, args, {
    ...options,
    timeout: options.timeout ?? EXTERNAL_TIMEOUT_MS,
    killSignal: "SIGKILL",
    maxBuffer: 8 * 1024 * 1024,
  });
}

function withTimeout(promise, label, timeoutMs = PROCESS_TIMEOUT_MS) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

function waitForExit(child, label, timeoutMs = PROCESS_TIMEOUT_MS) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve([child.exitCode, child.signalCode]);
  }
  return withTimeout(new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve([code, signal]));
  }), label, timeoutMs);
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (child.stdin?.writable) child.stdin.end();
  try {
    await waitForExit(child, "MCP clean exit", 3_000);
    return;
  } catch {
    child.kill("SIGTERM");
  }
  try {
    await waitForExit(child, "MCP graceful stop", 3_000);
  } catch {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await waitForExit(child, "MCP forced stop", 3_000);
  }
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
    terminalError = new Error(`MCP exited before its expected response (code=${code}, signal=${signal})`);
    for (const waiter of waiters.splice(0)) waiter.reject(terminalError);
  });
  return {
    stderr,
    waitFor(predicate, label) {
      const existing = messages.find(predicate);
      if (existing) return Promise.resolve(existing);
      if (terminalError) return Promise.reject(terminalError);
      return withTimeout(new Promise((resolve, reject) => {
        waiters.push({ predicate, resolve, reject });
      }), label);
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
  const message = await output.waitFor((candidate) => candidate.id === id, `MCP ${name}`);
  assert.equal(message.jsonrpc, "2.0");
  assert.equal(Object.hasOwn(message, "error"), false, `${name} must return a tool result`);
  assert.notEqual(
    message.result?.isError,
    true,
    `${name} returned an MCP tool error: ${JSON.stringify(message.result?.structuredContent?.error ?? message.result)}`,
  );
  return schema.parse(message.result);
}

async function initializeMcp(child, output, clientName, expectedVersion) {
  writeMessage(child, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: clientName, version: "1.0.0" },
    },
  });
  const initialized = await output.waitFor((message) => message.id === 1, `${clientName} initialize`);
  assert.equal(initialized.result.serverInfo.name, "understand-code");
  assert.equal(initialized.result.serverInfo.version, expectedVersion);
  writeMessage(child, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });
}

async function git(root, args) {
  return execBounded("git", args, {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_DIR: undefined,
      GIT_WORK_TREE: undefined,
      GIT_AUTHOR_NAME: "Workbench Browser Test",
      GIT_AUTHOR_EMAIL: "workbench-browser@example.invalid",
      GIT_COMMITTER_NAME: "Workbench Browser Test",
      GIT_COMMITTER_EMAIL: "workbench-browser@example.invalid",
    },
  });
}

async function createRepositoryFixture() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "uc-workbench-browser-root-")));
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(path.join(root, ".gitignore"), ".understand-code/\n", "utf8");
  await writeFile(
    path.join(root, "README.md"),
    "# Workbench browser fixture\n\nA tiny TypeScript repository used by the installed Alpha browser gate.\n",
    "utf8",
  );
  await writeFile(
    path.join(root, "src/index.ts"),
    INITIAL_SOURCE,
    "utf8",
  );
  await writeFile(
    path.join(root, "src/extra.ts"),
    INITIAL_EXTRA_SOURCE,
    "utf8",
  );
  await git(root, ["init", "-q"]);
  await git(root, [
    "add",
    ".gitignore",
    "README.md",
    "src/extra.ts",
    "src/index.ts",
  ]);
  await git(root, ["commit", "-q", "-m", "Workbench browser fixture"]);
  return root;
}

function packedRegularFileCount(bytes) {
  const archive = gunzipSync(bytes);
  let offset = 0;
  let count = 0;
  while (offset + 512 <= archive.byteLength) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const sizeText = header.subarray(124, 136).toString("ascii").replaceAll("\0", "").trim();
    assert.match(sizeText, /^[0-7]+$/u, "packed tar size must be portable octal");
    const size = Number.parseInt(sizeText, 8);
    const type = header[156] === 0 ? "0" : String.fromCharCode(header[156]);
    if (type === "0") count += 1;
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return count;
}

function sanitizedGitEnvironment() {
  return {
    ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_"))),
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_COUNT: "0",
    GIT_NO_LAZY_FETCH: "1",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_TERMINAL_PROMPT: "0",
  };
}

async function candidateGit(cwd, args, timeout = EXTERNAL_TIMEOUT_MS) {
  return execBounded(
    "git",
    ["--no-pager", "-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", ...args],
    { cwd, env: sanitizedGitEnvironment(), encoding: "utf8", timeout },
  );
}

async function commitCandidateSource(cwd, message, files) {
  await candidateGit(cwd, ["add", "--", ...files]);
  await candidateGit(cwd, [
    "-c",
    "user.name=Understand Code Workbench Candidate",
    "-c",
    "user.email=workbench-candidate@example.invalid",
    "commit",
    "--quiet",
    "--allow-empty",
    "-m",
    message,
  ]);
  return (await candidateGit(cwd, ["rev-parse", "HEAD"])).stdout.trim();
}

async function updateJsonFile(filePath, update) {
  const value = JSON.parse(await readFile(filePath, "utf8"));
  update(value);
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function runCandidate(scriptPath, operation, candidateRoot, cwd, environment) {
  const flag = operation === "assemble" ? "--output" : "--candidate";
  const result = await execBounded(
    process.execPath,
    [scriptPath, operation, flag, candidateRoot],
    { cwd, env: environment, encoding: "utf8", timeout: 15 * 60 * 1000 },
  );
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    operation,
    disposition: "unsigned_alpha_candidate",
    releaseReady: false,
  });
}

async function readCandidate(candidateRoot, expectedVersion, sourceCommit, sourceTree) {
  const names = (await readdir(candidateRoot)).sort();
  const tarballs = names.filter((name) => name.endsWith(".tgz"));
  assert.equal(tarballs.length, 1);
  assert.deepEqual(names, [CANDIDATE_CHECKSUMS, CANDIDATE_MANIFEST, CANDIDATE_SCHEMA, tarballs[0]].sort());
  const tarballPath = path.join(candidateRoot, tarballs[0]);
  const [tarballBytes, manifestBytes, schemaBytes, checksumBytes] = await Promise.all([
    readFile(tarballPath),
    readFile(path.join(candidateRoot, CANDIDATE_MANIFEST)),
    readFile(path.join(candidateRoot, CANDIDATE_SCHEMA)),
    readFile(path.join(candidateRoot, CANDIDATE_CHECKSUMS)),
  ]);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  assert.deepEqual(Object.keys(manifest).sort(), [
    "build",
    "disposition",
    "embeddedReleaseManifest",
    "gates",
    "limitations",
    "package",
    "releaseReady",
    "schemaVersion",
    "source",
    "subject",
  ]);
  assert.deepEqual(manifest.package, { name: "@understand-code/preview", version: expectedVersion });
  assert.deepEqual(
    { clean: manifest.source.clean, commit: manifest.source.commit, tree: manifest.source.tree },
    { clean: true, commit: sourceCommit, tree: sourceTree },
  );
  assert.deepEqual(manifest.gates, { coldPacked: "passed", checksum: "passed" });
  assert.deepEqual(manifest.subject, {
    file: tarballs[0],
    mediaType: "application/vnd.npm.package+gzip",
    bytes: tarballBytes.byteLength,
    sha256: contentDigest(tarballBytes),
  });
  assert.equal(manifest.releaseReady, false);
  assert.equal(manifest.disposition, "unsigned_alpha_candidate");
  assert.equal(manifest.build.nativeTuple, `${manifest.build.platform}-${manifest.build.arch}`);
  const expectedChecksums = [
    [CANDIDATE_MANIFEST, manifestBytes],
    [CANDIDATE_SCHEMA, schemaBytes],
    [tarballs[0], tarballBytes],
  ].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(
    ([name, bytes]) => `${digest(bytes)}  ${name}`,
  );
  assert.deepEqual(checksumBytes.toString("utf8").trimEnd().split("\n"), expectedChecksums);
  return {
    root: candidateRoot,
    manifest,
    tarballPath,
    tarballBytes,
    entryCount: packedRegularFileCount(tarballBytes),
  };
}

async function createLifecycleCandidates() {
  assert.match(
    LIFECYCLE_V2_VERSION,
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u,
    "the v2 version must remain safe in the npm-derived candidate tarball filename",
  );
  const parent = await realpath(await mkdtemp(path.join(tmpdir(), "uc-workbench-real-candidates-")));
  try {
    const cloneRoot = path.join(parent, "source");
    const v1Root = path.join(parent, "candidate-v1");
    const v2Root = path.join(parent, "candidate-v2");
    const sourceHead = (await candidateGit(sourceRoot, ["rev-parse", "HEAD^{commit}"])).stdout.trim();
    await candidateGit(parent, ["clone", "--no-local", "--no-checkout", "--no-tags", sourceRoot, cloneRoot], 2 * 60 * 1000);
    await candidateGit(cloneRoot, ["checkout", "--detach", sourceHead]);
    await Promise.all(V1_OVERLAY_FILES.map((relativePath) =>
      cp(path.join(sourceRoot, relativePath), path.join(cloneRoot, relativePath)),
    ));
    const overlayOutput = (await candidateGit(
      cloneRoot,
      ["diff", "--name-only", "HEAD"],
    )).stdout.trim();
    const overlayDelta = overlayOutput === "" ? [] : overlayOutput.split("\n").sort();
    assert.equal(
      overlayDelta.every((relativePath) => V1_OVERLAY_FILES.includes(relativePath)),
      true,
      "the ephemeral v1 source delta may only contain the reviewed packed gates and Change Intelligence implementation",
    );
    const v1Commit = await commitCandidateSource(
      cloneRoot,
      "bind candidate to reviewed packed lifecycle slice",
      V1_OVERLAY_FILES,
    );
    assert.equal((await candidateGit(cloneRoot, ["rev-parse", "HEAD^"])).stdout.trim(), sourceHead);
    const committedOverlayOutput = (await candidateGit(
      cloneRoot,
      ["diff", "--name-only", `${sourceHead}..${v1Commit}`],
    )).stdout.trim();
    assert.deepEqual(
      committedOverlayOutput === "" ? [] : committedOverlayOutput.split("\n").sort(),
      overlayDelta,
      "the v1 candidate must bind its clean ephemeral commit, not claim direct HEAD provenance",
    );
    const v1Tree = (await candidateGit(cloneRoot, ["rev-parse", "HEAD^{tree}"])).stdout.trim();
    assert.equal((await candidateGit(cloneRoot, ["status", "--porcelain=v1", "--untracked-files=all"])).stdout, "");
    const environment = { ...process.env, CI: "true" };
    await execBounded("pnpm", ["install", "--offline", "--frozen-lockfile"], {
      cwd: cloneRoot,
      env: environment,
      encoding: "utf8",
      timeout: 10 * 60 * 1000,
    });
    const scriptPath = path.join(cloneRoot, CANDIDATE_SCRIPT);
    await runCandidate(scriptPath, "assemble", v1Root, cloneRoot, environment);
    await runCandidate(scriptPath, "verify", v1Root, cloneRoot, environment);
    const v1Package = JSON.parse(await readFile(path.join(cloneRoot, "packages/preview/package.json"), "utf8"));
    const v1 = await readCandidate(v1Root, v1Package.version, v1Commit, v1Tree);

    await updateJsonFile(path.join(cloneRoot, V2_SOURCE_FILES[0]), (value) => { value.version = LIFECYCLE_V2_VERSION; });
    await updateJsonFile(path.join(cloneRoot, V2_SOURCE_FILES[1]), (value) => { value.version = LIFECYCLE_V2_VERSION; });
    await updateJsonFile(path.join(cloneRoot, V2_SOURCE_FILES[2]), (value) => { value.version = LIFECYCLE_V2_VERSION; });
    await updateJsonFile(path.join(cloneRoot, V2_SOURCE_FILES[3]), (value) => { value.plugins[0].version = LIFECYCLE_V2_VERSION; });
    const dashboardIndexPath = path.join(cloneRoot, V2_SOURCE_FILES[4]);
    const dashboardIndex = await readFile(dashboardIndexPath, "utf8");
    const marker = `<meta name="understand-code-lifecycle-release" content="${LIFECYCLE_V2_VERSION}">`;
    assert.match(dashboardIndex, /<\/head>/iu);
    await writeFile(dashboardIndexPath, dashboardIndex.replace(/<\/head>/iu, `${marker}</head>`), "utf8");
    const v2Commit = await commitCandidateSource(cloneRoot, "test real v2 lifecycle candidate", V2_SOURCE_FILES);
    assert.equal((await candidateGit(cloneRoot, ["rev-parse", "HEAD^"])).stdout.trim(), v1Commit);
    assert.deepEqual(
      (await candidateGit(cloneRoot, ["diff", "--name-only", `${v1Commit}..${v2Commit}`])).stdout.trim().split("\n").sort(),
      [...V2_SOURCE_FILES].sort(),
    );
    assert.equal((await candidateGit(cloneRoot, ["status", "--porcelain=v1", "--untracked-files=all"])).stdout, "");
    const v2Tree = (await candidateGit(cloneRoot, ["rev-parse", "HEAD^{tree}"])).stdout.trim();
    await runCandidate(scriptPath, "assemble", v2Root, cloneRoot, environment);
    await runCandidate(scriptPath, "verify", v2Root, cloneRoot, environment);
    const v2 = await readCandidate(v2Root, LIFECYCLE_V2_VERSION, v2Commit, v2Tree);
    assert.notEqual(contentDigest(v1.tarballBytes), contentDigest(v2.tarballBytes));
    return { parent, cloneRoot, v1, v2 };
  } catch (error) {
    await rm(parent, { recursive: true, force: true });
    throw error;
  }
}

function cleanMcpEnvironment(home, repositoryRoot) {
  return {
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    TMPDIR: process.env.TMPDIR ?? tmpdir(),
    LANG: process.env.LANG ?? "C.UTF-8",
    HOME: home,
    USERPROFILE: home,
    USER: "understand-code-browser-e2e",
    LOGNAME: "understand-code-browser-e2e",
    XDG_CACHE_HOME: path.join(home, ".cache"),
    XDG_CONFIG_HOME: path.join(home, ".config"),
    XDG_DATA_HOME: path.join(home, ".local/share"),
    CI: "1",
    NO_COLOR: "1",
    GIT_DIR: path.join(repositoryRoot, "ambient-git-dir-must-not-be-authority"),
    UNDERSTAND_CODE_CLI: path.join(home, "must-not-redirect-installed-host"),
  };
}

function installedLocations(installDirectory) {
  const binRoot = process.platform === "win32" ? installDirectory : path.join(installDirectory, "bin");
  const modulesRoot = process.platform === "win32"
    ? path.join(installDirectory, "node_modules")
    : path.join(installDirectory, "lib/node_modules");
  return {
    cliBin: path.join(binRoot, process.platform === "win32" ? "understand-code.cmd" : "understand-code"),
    codexBin: path.join(binRoot, process.platform === "win32" ? "understand-code-codex.cmd" : "understand-code-codex"),
    packageRoot: path.join(modulesRoot, "@understand-code/preview"),
  };
}

async function runCliJson(executable, args, cwd, env) {
  const result = await execBounded(executable, args, {
    cwd,
    encoding: "utf8",
    env,
  });
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

async function dashboardInventory(root) {
  const inventory = [];
  async function walk(directory, relativeDirectory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    for (const entry of entries) {
      assert.equal(entry.isSymbolicLink(), false, "Dashboard fixture must not contain symlinks");
      const relativePath = relativeDirectory === "" ? entry.name : `${relativeDirectory}/${entry.name}`;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath, relativePath);
        continue;
      }
      assert.equal(entry.isFile(), true, "Dashboard fixture must contain regular files only");
      const bytes = await readFile(absolutePath);
      inventory.push({ path: relativePath, sha256: contentDigest(bytes), bytes: bytes.byteLength });
    }
  }
  await walk(root, "");
  inventory.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  return {
    inventory,
    fileCount: inventory.length,
    inventorySha256: contentDigest(Buffer.from(JSON.stringify(inventory), "utf8")),
  };
}

function expectedReactEntry(indexHtml) {
  const match = indexHtml.match(/<script\b[^>]*\bsrc=["'](?<source>\/assets\/index-[A-Za-z0-9_-]+\.js)["'][^>]*>/iu);
  assert.ok(match?.groups?.source, "the installed Dashboard must name one hashed React entry asset");
  return match.groups.source;
}

function bodyContains(value) {
  return `document.body?.innerText?.includes(${JSON.stringify(value)}) === true`;
}

async function assertInstalledCandidateBindings(installed, candidate) {
  const packageManifest = JSON.parse(await readFile(path.join(installed.packageRoot, "package.json"), "utf8"));
  const releaseManifestBytes = await readFile(path.join(installed.packageRoot, "dist/release-manifest.json"));
  const releaseManifest = JSON.parse(releaseManifestBytes.toString("utf8"));
  assert.deepEqual(
    { name: packageManifest.name, version: packageManifest.version },
    candidate.manifest.package,
  );
  assert.deepEqual(releaseManifest.package, candidate.manifest.package);
  assert.deepEqual(candidate.manifest.embeddedReleaseManifest, {
    path: "package/dist/release-manifest.json",
    schemaVersion: "understand-code-alpha-release-v1",
    sha256: contentDigest(releaseManifestBytes),
  });
  assert.equal(releaseManifest.native.tuple, candidate.manifest.build.nativeTuple);
  const nativeBytes = await readFile(path.join(installed.packageRoot, releaseManifest.native.path));
  assert.equal(contentDigest(nativeBytes), releaseManifest.native.sha256);
  const cliBytes = await readFile(path.join(installed.packageRoot, releaseManifest.cli.path));
  assert.equal(contentDigest(cliBytes), releaseManifest.cli.sha256);
  const dashboardRoot = path.join(installed.packageRoot, releaseManifest.dashboard.root);
  const dashboardManifestBytes = await readFile(path.join(installed.packageRoot, releaseManifest.dashboard.manifest));
  assert.equal(contentDigest(dashboardManifestBytes), releaseManifest.dashboard.manifestSha256);
  assert.equal(releaseManifest.dashboard.productVersion, candidate.manifest.package.version);
  const dashboard = await dashboardInventory(dashboardRoot);
  assert.deepEqual(
    { fileCount: dashboard.fileCount, inventorySha256: dashboard.inventorySha256 },
    {
      fileCount: releaseManifest.dashboard.fileCount,
      inventorySha256: releaseManifest.dashboard.inventorySha256,
    },
  );
  for (const host of ["codex", "claude"]) {
    const plugin = releaseManifest.pluginRoots[host];
    for (const [file, expectedDigest] of [
      [plugin.marketplace, plugin.marketplaceSha256],
      [plugin.manifest, plugin.manifestSha256],
      [plugin.mcp, plugin.mcpSha256],
      [plugin.entrypoint, plugin.entrypointSha256],
      [plugin.cli, plugin.cliSha256],
      [plugin.dashboardManifest, plugin.dashboardManifestSha256],
    ]) {
      assert.equal(contentDigest(await readFile(path.join(installed.packageRoot, file))), expectedDigest);
    }
    assert.equal(plugin.cliSha256, releaseManifest.cli.sha256);
    const pluginDashboard = await dashboardInventory(path.join(installed.packageRoot, plugin.dashboardRoot));
    assert.deepEqual(
      { fileCount: pluginDashboard.fileCount, inventorySha256: pluginDashboard.inventorySha256 },
      { fileCount: plugin.dashboardFileCount, inventorySha256: plugin.dashboardInventorySha256 },
    );
  }
  return { packageManifest, releaseManifest, cliBytes, nativeBytes, dashboard };
}

test("installed tgz opens the React Workbench and preserves snapshot-bound Task evidence", { timeout: 15 * 60 * 1000 }, async (t) => {
  const browserExecutable = await resolveBrowserExecutable();
  if (browserExecutable === null) {
    assert.equal(
      REQUIRE_REAL_BROWSER,
      false,
      "UNDERSTAND_CODE_REQUIRE_REAL_BROWSER=1 requires UNDERSTAND_CODE_BROWSER_EXECUTABLE or an installed Chrome/Chromium",
    );
    t.skip("Chrome/Chromium is unavailable; the release gate sets UNDERSTAND_CODE_REQUIRE_REAL_BROWSER=1");
    return;
  }

  const installDirectory = await mkdtemp(path.join(tmpdir(), "uc-workbench-browser-install-"));
  const upgradeInstallDirectory = await mkdtemp(path.join(tmpdir(), "uc-workbench-browser-upgrade-install-"));
  const browserProfile = await mkdtemp(path.join(tmpdir(), "uc-workbench-browser-profile-"));
  const deletionBrowserProfile = await mkdtemp(path.join(tmpdir(), "uc-workbench-browser-deletion-profile-"));
  const home = await mkdtemp(path.join(tmpdir(), "uc-workbench-browser-home-"));
  let repositoryRoot = await createRepositoryFixture();
  const repositoryRoots = [repositoryRoot];
  let browser = null;
  let mcp = null;
  let lifecycleCandidates = null;
  let retainLifecycleCandidates = false;
  try {
    lifecycleCandidates = await createLifecycleCandidates();
    const tarballPath = lifecycleCandidates.v1.tarballPath;
    const tarballBefore = lifecycleCandidates.v1.tarballBytes;
    const entryCount = lifecycleCandidates.v1.entryCount;
    const upgradeTarballPath = lifecycleCandidates.v2.tarballPath;
    const upgradeTarballBefore = lifecycleCandidates.v2.tarballBytes;
    const upgradeEntryCount = lifecycleCandidates.v2.entryCount;
    assert.equal(entryCount, upgradeEntryCount, "both real candidates must carry the same bounded release inventory size");
    await execBounded(
      "npm",
      ["install", "--global", "--prefix", installDirectory, "--ignore-scripts", "--no-package-lock", "--no-audit", "--no-fund", tarballPath],
      { cwd: installDirectory, encoding: "utf8" },
    );
    await execBounded(
      "npm",
      ["install", "--global", "--prefix", upgradeInstallDirectory, "--ignore-scripts", "--no-package-lock", "--no-audit", "--no-fund", upgradeTarballPath],
      { cwd: upgradeInstallDirectory, encoding: "utf8" },
    );
    const installed = installedLocations(installDirectory);
    const upgradeInstalled = installedLocations(upgradeInstallDirectory);
    const v1Bindings = await assertInstalledCandidateBindings(installed, lifecycleCandidates.v1);
    const v2Bindings = await assertInstalledCandidateBindings(upgradeInstalled, lifecycleCandidates.v2);
    const baseVersion = v1Bindings.packageManifest.version;
    const upgradedVersion = v2Bindings.packageManifest.version;
    assert.equal(upgradedVersion, LIFECYCLE_V2_VERSION);
    assert.notEqual(baseVersion, upgradedVersion);
    assert.notDeepEqual(v1Bindings.cliBytes, v2Bindings.cliBytes);
    const installedIndexHtml = await readFile(path.join(installed.packageRoot, "dist/dashboard/index.html"), "utf8");
    const reactEntry = expectedReactEntry(installedIndexHtml);
    const initialReactDigest = contentDigest(await readFile(
      path.join(installed.packageRoot, "dist/dashboard", reactEntry.slice(1)),
    ));
    let lifecycleEnv = cleanMcpEnvironment(home, repositoryRoot);
    const requestedManagedRoot = path.join(installDirectory, "managed-install");
    const managedInstall = await runCliJson(
      installed.cliBin,
      ["install", "--root", requestedManagedRoot, "--host", "codex"],
      installDirectory,
      lifecycleEnv,
    );
    assert.deepEqual(
      {
        ok: managedInstall.ok,
        status: managedInstall.status,
        version: managedInstall.version,
      },
      { ok: true, status: "installed", version: baseVersion },
    );
    const managedInstallRoot = await realpath(requestedManagedRoot);
    const managedWrapper = path.join(managedInstallRoot, "bin/understand-code");
    const managedBundle = path.join(managedInstallRoot, "lib/understand-code.mjs");
    assert.match(v1Bindings.releaseManifest.native.path, /^dist\/native\/[^/]+\/[^/]+$/u);
    assert.equal(
      v2Bindings.releaseManifest.native.path,
      v1Bindings.releaseManifest.native.path,
      "both candidates must bind the same current-platform native destination",
    );
    const managedNative = path.join(
      managedInstallRoot,
      `lib/${v1Bindings.releaseManifest.native.path.slice("dist/".length)}`,
    );
    const managedDashboardRoot = path.join(managedInstallRoot, "lib/dashboard");
    const managedDashboardManifestPath = path.join(managedInstallRoot, "lib/dashboard-manifest.json");
    const managedManifestPath = path.join(managedInstallRoot, "installation-manifest.json");
    const rollbackPath = path.join(managedInstallRoot, "installation-rollback.json");
    const sentinelPath = path.join(managedInstallRoot, "user-owned.txt");
    await writeFile(sentinelPath, "preserve user bytes\n", "utf8");
    const initialManagedBundle = await readFile(managedBundle);
    assert.deepEqual(
      initialManagedBundle,
      v1Bindings.cliBytes,
      "managed install must copy the exact CLI bytes from the real v1 tgz",
    );
    assert.deepEqual(
      await readFile(managedNative),
      v1Bindings.nativeBytes,
      "managed install must copy the exact native bytes named by the v1 release manifest",
    );
    const initialManagedDashboardManifest = await readFile(managedDashboardManifestPath);
    const initialManagedDashboard = await dashboardInventory(managedDashboardRoot);
    assert.deepEqual(
      initialManagedDashboard,
      await dashboardInventory(path.join(installed.packageRoot, "dist/dashboard")),
      "managed install must copy the exact Dashboard inventory from the same tgz",
    );
    assert.deepEqual(
      initialManagedDashboardManifest,
      await readFile(path.join(installed.packageRoot, "dist/dashboard-manifest.json")),
      "managed install must copy the exact Dashboard manifest from the same tgz",
    );
    const initialManagedManifestBytes = await readFile(managedManifestPath);
    const initialManagedManifest = JSON.parse(initialManagedManifestBytes.toString("utf8"));
    assert.equal(initialManagedManifest.workbenchUi, "react_dashboard_v1");
    const initialOwnedBytes = new Map(await Promise.all(
      initialManagedManifest.files.map(async (file) => [
        file.path,
        await readFile(path.join(managedInstallRoot, file.path)),
      ]),
    ));
    const initialDoctor = await runCliJson(
      managedBundle,
      ["doctor", "--root", managedInstallRoot],
      installDirectory,
      lifecycleEnv,
    );
    assert.deepEqual(
      { ok: initialDoctor.ok, status: initialDoctor.status, version: initialDoctor.version },
      { ok: true, status: "healthy", version: baseVersion },
    );

    mcp = spawn(managedWrapper, ["--root", repositoryRoot], {
      cwd: installDirectory,
      env: lifecycleEnv,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = collectMessages(mcp);
    await initializeMcp(mcp, output, "preview-workbench-browser", baseVersion);

    let requestId = 2;
    const actor = "agent:preview-workbench-browser";
    const wrongInitialRefresh = await callTool(mcp, output, requestId++, "refresh_index", {
      mode: "full",
      idempotencyKey: "preview-workbench-browser-initial-refresh",
      actor,
    }, RefreshIndexOutputV1Schema);
    assert.equal(wrongInitialRefresh.structuredContent.result.operation.status, "completed");
    const wrongInitialSnapshotId = wrongInitialRefresh.structuredContent.meta.sourceSnapshotId;

    const wrongBuilt = await callTool(mcp, output, requestId++, "build_task_brief", {
      task: "Change the foo function behavior.",
      expectedRevision: 0,
      idempotencyKey: "preview-workbench-browser-wrong-hunk-brief",
      actor,
      scope: ["src/index.ts"],
      maxCandidates: 1,
    }, BuildTaskBriefOutputV1Schema);
    const wrongTaskId = wrongBuilt.structuredContent.result.task.taskId;
    const wrongBrief = wrongBuilt.structuredContent.result.brief;
    assert.deepEqual(
      wrongBrief.plannedChanges.map((change) => change.symbolId),
      [FOO_NODE_ID],
      "the mismatch regression must carry one confirmed foo-symbol obligation",
    );
    let wrongRevision = wrongBuilt.structuredContent.result.task.revision;
    const updateWrongTask = async (action, idempotencyKey) => {
      const updated = await callTool(mcp, output, requestId++, "update_task", {
        taskId: wrongTaskId,
        action,
        expectedRevision: wrongRevision,
        idempotencyKey,
        actor,
      }, UpdateTaskOutputV1Schema);
      wrongRevision = updated.structuredContent.result.mutation.revision;
      return updated;
    };
    await updateWrongTask(
      { type: "confirm_goal", claimId: wrongBrief.goalClaimId },
      "preview-workbench-browser-wrong-confirm-goal",
    );
    await updateWrongTask(
      { type: "confirm_acceptance_criteria", claimIds: wrongBrief.acceptanceClaimIds },
      "preview-workbench-browser-wrong-confirm-acceptance",
    );
    await updateWrongTask(
      { type: "confirm_plan", plannedChangeIds: wrongBrief.plannedChanges.map((change) => change.id) },
      "preview-workbench-browser-wrong-confirm-plan",
    );
    await updateWrongTask(
      { type: "transition_status", to: "planned" },
      "preview-workbench-browser-wrong-planned",
    );
    await updateWrongTask(
      { type: "transition_status", to: "in_progress" },
      "preview-workbench-browser-wrong-in-progress",
    );

    let sourcePath = path.join(repositoryRoot, "src/index.ts");
    await writeFile(sourcePath, BAR_ONLY_SOURCE, "utf8");
    const wrongRefresh = await callTool(mcp, output, requestId++, "refresh_index", {
      mode: "full",
      expectedSourceSnapshotId: wrongInitialSnapshotId,
      idempotencyKey: "preview-workbench-browser-wrong-hunk-refresh",
      actor,
    }, RefreshIndexOutputV1Schema);
    const wrongSnapshotId = wrongRefresh.structuredContent.meta.sourceSnapshotId;
    assert.notEqual(wrongSnapshotId, wrongInitialSnapshotId);
    await updateWrongTask(
      { type: "transition_status", to: "check_required" },
      "preview-workbench-browser-wrong-check-required",
    );
    const wrongChecked = await callTool(mcp, output, requestId++, "check_change", {
      taskId: wrongTaskId,
      actualSnapshotId: wrongSnapshotId,
      includeWorktree: true,
      expectedRevision: wrongRevision,
      idempotencyKey: "preview-workbench-browser-wrong-check",
      actor,
    }, CheckChangeOutputV1Schema);
    const wrongFindings = wrongChecked.structuredContent.result.changeCheck.findings;
    assert.equal(
      wrongFindings.some((finding) => finding.type === "planned_completed"),
      false,
      "changing bar in the planned foo file must not report the foo obligation completed",
    );
    const barFinding = wrongFindings.find((finding) => finding.type === "unplanned_change");
    assert.ok(barFinding, "the same-file bar hunk must be reported as an unplanned change");
    assert.ok(
      wrongFindings.some((finding) =>
        finding.type === "cannot_determine" &&
        finding.blocking &&
        finding.plannedChangeIds.includes(wrongBrief.plannedChanges[0].id)),
      "the legacy foo plan lacks a required-change expectation and must remain an explicit blocking unknown",
    );
    const barEvidenceRead = await callTool(mcp, output, requestId++, "get_evidence", {
      taskId: wrongTaskId,
      evidenceIds: barFinding.evidenceIds,
      maxExcerptChars: 8_192,
      pageSize: barFinding.evidenceIds.length,
    }, GetEvidenceOutputV1Schema);
    const barEvidence = barEvidenceRead.structuredContent.result.evidence.find((evidence) =>
      "filePath" in evidence && evidence.filePath === "src/index.ts",
    );
    assert.ok(barEvidence && "filePath" in barEvidence, "the unplanned bar Finding must resolve to source Evidence");
    assert.deepEqual(barEvidence.lineRange, [2, 2]);
    assert.deepEqual(barEvidence.nodeIds, [BAR_NODE_ID]);
    assert.equal(barEvidence.contentHash, contentDigest(Buffer.from(BAR_ONLY_SOURCE, "utf8")));
    assert.equal(barEvidence.observedAtSnapshotId, wrongSnapshotId);

    mcp.stdin.end();
    assert.deepEqual(await waitForExit(mcp, "mismatch repository MCP EOF"), [0, null]);
    assert.equal(output.stderr.join(""), "");
    mcp = null;

    repositoryRoot = await createRepositoryFixture();
    repositoryRoots.push(repositoryRoot);
    lifecycleEnv = cleanMcpEnvironment(home, repositoryRoot);
    const deletedExtraPath = path.join(repositoryRoot, "src/extra.ts");
    const deletedUntrackedPath = path.join(repositoryRoot, "src/untracked.ts");
    mcp = spawn(managedWrapper, ["--root", repositoryRoot], {
      cwd: installDirectory,
      env: lifecycleEnv,
      stdio: ["pipe", "pipe", "pipe"],
    });
    output = collectMessages(mcp);
    await initializeMcp(
      mcp,
      output,
      "preview-workbench-browser-deleted",
      baseVersion,
    );
    requestId = 2;
    const deletedInitialRefresh = await callTool(
      mcp,
      output,
      requestId++,
      "refresh_index",
      {
        mode: "full",
        idempotencyKey: "preview-workbench-browser-deleted-initial-refresh",
        actor,
      },
      RefreshIndexOutputV1Schema,
    );
    const deletedInitialSnapshotId =
      deletedInitialRefresh.structuredContent.meta.sourceSnapshotId;
    const deletedBaselineHead = (
      await git(repositoryRoot, ["rev-parse", "HEAD"])
    ).stdout.trim();
    const deletedBuilt = await callTool(
      mcp,
      output,
      requestId++,
      "build_task_brief",
      {
        task: "Remove the extra function implementation.",
        expectedRevision: 0,
        idempotencyKey: "preview-workbench-browser-deleted-brief",
        actor,
        scope: ["src/extra.ts"],
        maxCandidates: 1,
      },
      BuildTaskBriefOutputV1Schema,
    );
    const deletedTaskId =
      deletedBuilt.structuredContent.result.task.taskId;
    const deletedBrief = deletedBuilt.structuredContent.result.brief;
    assert.equal(deletedBrief.plannedChanges.length, 1);
    const deletedExtraPlan = deletedBrief.plannedChanges[0];
    assert.equal(deletedExtraPlan.filePath, "src/extra.ts");
    assert.equal(deletedExtraPlan.symbolId, EXTRA_NODE_ID);
    let deletedRevision =
      deletedBuilt.structuredContent.result.task.revision;
    const updateDeletedTask = async (action, idempotencyKey) => {
      const updated = await callTool(
        mcp,
        output,
        requestId++,
        "update_task",
        {
          taskId: deletedTaskId,
          action,
          expectedRevision: deletedRevision,
          idempotencyKey,
          actor,
        },
        UpdateTaskOutputV1Schema,
      );
      deletedRevision = updated.structuredContent.result.mutation.revision;
      return updated;
    };
    await updateDeletedTask(
      { type: "confirm_goal", claimId: deletedBrief.goalClaimId },
      "preview-workbench-browser-deleted-confirm-goal",
    );
    await updateDeletedTask(
      {
        type: "confirm_acceptance_criteria",
        claimIds: deletedBrief.acceptanceClaimIds,
      },
      "preview-workbench-browser-deleted-confirm-acceptance",
    );
    await updateDeletedTask(
      {
        type: "confirm_plan",
        plannedChangeIds: [deletedExtraPlan.id],
      },
      "preview-workbench-browser-deleted-confirm-plan",
    );
    await updateDeletedTask(
      { type: "transition_status", to: "planned" },
      "preview-workbench-browser-deleted-planned",
    );
    await updateDeletedTask(
      { type: "transition_status", to: "in_progress" },
      "preview-workbench-browser-deleted-in-progress",
    );

    await Promise.all([
      rm(deletedExtraPath),
      writeFile(deletedUntrackedPath, UNTRACKED_SOURCE, "utf8"),
    ]);
    assert.equal(
      (await git(repositoryRoot, ["diff", "--cached", "--name-only"])).stdout,
      "",
      "the deletion vertical must not stage the removed path",
    );
    assert.equal(
      (await git(repositoryRoot, [
        "status",
        "--porcelain",
        "--untracked-files=all",
      ])).stdout,
      " D src/extra.ts\n?? src/untracked.ts\n",
      "the real repository must contain exactly one unstaged tracked deletion and one untracked add",
    );
    const deletedChangedRefresh = await callTool(
      mcp,
      output,
      requestId++,
      "refresh_index",
      {
        mode: "full",
        expectedSourceSnapshotId: deletedInitialSnapshotId,
        idempotencyKey: "preview-workbench-browser-deleted-changed-refresh",
        actor,
      },
      RefreshIndexOutputV1Schema,
    );
    const deletedChangedSnapshotId =
      deletedChangedRefresh.structuredContent.meta.sourceSnapshotId;
    const deletedSnapshotArtifact =
      RepositorySnapshotArtifactV1Schema.parse(JSON.parse(await readFile(
        path.join(
          repositoryRoot,
          ".understand-code",
          "snapshots",
          `${deletedChangedSnapshotId}.json`,
        ),
        "utf8",
      )));
    assert.equal(deletedSnapshotArtifact.payload.captureStatus, "complete");
    assert.equal(deletedSnapshotArtifact.payload.changes.length, 2);
    const deletedSnapshotChange =
      deletedSnapshotArtifact.payload.changes.find(
        (change) => change.path === "src/extra.ts",
      );
    const deletedUntrackedSnapshotChange =
      deletedSnapshotArtifact.payload.changes.find(
        (change) => change.path === "src/untracked.ts",
      );
    assert.deepEqual(deletedSnapshotChange, {
      id: deletedSnapshotChange?.id,
      path: "src/extra.ts",
      source: "unstaged",
      kind: "deleted",
    });
    assert.equal(
      Object.hasOwn(deletedSnapshotChange, "contentDigest"),
      false,
      "a deleted Snapshot change must not invent actual-side content bytes",
    );
    assert.deepEqual(deletedUntrackedSnapshotChange, {
      id: deletedUntrackedSnapshotChange?.id,
      path: "src/untracked.ts",
      source: "untracked",
      kind: "added",
      contentDigest: contentDigest(Buffer.from(UNTRACKED_SOURCE, "utf8")),
    });

    await updateDeletedTask(
      { type: "transition_status", to: "check_required" },
      "preview-workbench-browser-deleted-check-required",
    );
    const deletedChecked = await callTool(
      mcp,
      output,
      requestId++,
      "check_change",
      {
        taskId: deletedTaskId,
        actualSnapshotId: deletedChangedSnapshotId,
        includeWorktree: true,
        expectedRevision: deletedRevision,
        idempotencyKey: "preview-workbench-browser-deleted-check",
        actor,
      },
      CheckChangeOutputV1Schema,
    );
    deletedRevision =
      deletedChecked.structuredContent.result.mutation.revision;
    const deletedFindings =
      deletedChecked.structuredContent.result.changeCheck.findings;
    const deletedCannotDetermine = deletedFindings.find(
      (finding) =>
        finding.type === "cannot_determine" &&
        finding.plannedChangeIds.includes(deletedExtraPlan.id),
    );
    const deletedUnplanned = deletedFindings.find(
      (finding) =>
        finding.type === "unplanned_change" &&
        finding.actualChangeIds.includes(deletedSnapshotChange.id),
    );
    const deletedAddedUnplanned = deletedFindings.find(
      (finding) =>
        finding.type === "unplanned_change" &&
        finding.actualChangeIds.includes(deletedUntrackedSnapshotChange.id),
    );
    assert.equal(
      deletedFindings.some(
        (finding) =>
          finding.type === "planned_completed" ||
          finding.type === "possible_omission",
      ),
      false,
      "the live add/delete profile must neither satisfy nor invent omission for a legacy planned change",
    );
    assert.deepEqual(
      {
        type: deletedCannotDetermine?.type,
        blocking: deletedCannotDetermine?.blocking,
        plannedChangeIds: deletedCannotDetermine?.plannedChangeIds,
        actualChangeIds: deletedCannotDetermine?.actualChangeIds,
      },
      {
        type: "cannot_determine",
        blocking: true,
        plannedChangeIds: [deletedExtraPlan.id],
        actualChangeIds: [deletedSnapshotChange.id],
      },
    );
    assert.deepEqual(
      {
        type: deletedUnplanned?.type,
        blocking: deletedUnplanned?.blocking,
        plannedChangeIds: deletedUnplanned?.plannedChangeIds,
        actualChangeIds: deletedUnplanned?.actualChangeIds,
      },
      {
        type: "unplanned_change",
        blocking: true,
        plannedChangeIds: [],
        actualChangeIds: [deletedSnapshotChange.id],
      },
    );
    assert.deepEqual(
      {
        type: deletedAddedUnplanned?.type,
        blocking: deletedAddedUnplanned?.blocking,
        plannedChangeIds: deletedAddedUnplanned?.plannedChangeIds,
        actualChangeIds: deletedAddedUnplanned?.actualChangeIds,
      },
      {
        type: "unplanned_change",
        blocking: true,
        plannedChangeIds: [],
        actualChangeIds: [deletedUntrackedSnapshotChange.id],
      },
    );
    assert.deepEqual(
      deletedFindings.map((finding) => finding.type).sort(),
      ["cannot_determine", "unplanned_change", "unplanned_change"],
    );
    assert.equal(deletedFindings.length, 3);
    assert.ok(deletedCannotDetermine, "the legacy deletion plan must remain blocking");
    assert.ok(deletedUnplanned, "the deleted baseline file must remain independently unplanned");
    assert.ok(deletedAddedUnplanned, "the untracked source file must remain independently unplanned");
    assert.equal(deletedUnplanned.evidenceIds.length, 1);
    assert.equal(deletedAddedUnplanned.evidenceIds.length, 1);
    const deletedEvidenceRead = await callTool(
      mcp,
      output,
      requestId++,
      "get_evidence",
      {
        taskId: deletedTaskId,
        evidenceIds: [
          ...deletedUnplanned.evidenceIds,
          ...deletedAddedUnplanned.evidenceIds,
        ],
        maxExcerptChars: 8_192,
        pageSize:
          deletedUnplanned.evidenceIds.length +
          deletedAddedUnplanned.evidenceIds.length,
      },
      GetEvidenceOutputV1Schema,
    );
    assert.deepEqual(
      deletedEvidenceRead.structuredContent.result.missingEvidenceIds,
      [],
    );
    assert.equal(
      deletedEvidenceRead.structuredContent.result.evidence.length,
      2,
    );
    const deletedEvidence =
      deletedEvidenceRead.structuredContent.result.evidence.find(
        (evidence) =>
          "filePath" in evidence && evidence.filePath === "src/extra.ts",
      );
    const deletedAddedEvidence =
      deletedEvidenceRead.structuredContent.result.evidence.find(
        (evidence) =>
          "filePath" in evidence && evidence.filePath === "src/untracked.ts",
      );
    assert.ok(deletedEvidence, "the deletion Finding must resolve to baseline Evidence");
    assert.ok(deletedAddedEvidence, "the untracked Finding must resolve to current Evidence");
    assert.deepEqual(
      {
        kind: deletedEvidence.kind,
        epistemicStatus: deletedEvidence.epistemicStatus,
        freshness: deletedEvidence.freshness,
        freshnessReason: deletedEvidence.freshnessReason,
        observedAtSnapshotId: deletedEvidence.observedAtSnapshotId,
        filePath: "filePath" in deletedEvidence
          ? deletedEvidence.filePath
          : undefined,
        lineRange: "lineRange" in deletedEvidence
          ? deletedEvidence.lineRange
          : undefined,
        commit: "commit" in deletedEvidence
          ? deletedEvidence.commit
          : undefined,
        nodeIds: deletedEvidence.nodeIds,
        contentHash: "contentHash" in deletedEvidence
          ? deletedEvidence.contentHash
          : undefined,
      },
      {
        kind: "source",
        epistemicStatus: "observed",
        freshness: "changed",
        freshnessReason:
          "The source existed at the Task baseline and is absent from the exact actual Snapshot.",
        observedAtSnapshotId: deletedInitialSnapshotId,
        filePath: "src/extra.ts",
        lineRange: [1, 1],
        commit: deletedBaselineHead,
        nodeIds: [],
        contentHash: contentDigest(Buffer.from(INITIAL_EXTRA_SOURCE, "utf8")),
      },
    );
    assert.deepEqual(deletedUnplanned.evidenceIds, [deletedEvidence.id]);
    assert.deepEqual(
      {
        kind: deletedAddedEvidence.kind,
        epistemicStatus: deletedAddedEvidence.epistemicStatus,
        freshness: deletedAddedEvidence.freshness,
        observedAtSnapshotId: deletedAddedEvidence.observedAtSnapshotId,
        filePath: "filePath" in deletedAddedEvidence
          ? deletedAddedEvidence.filePath
          : undefined,
        lineRange: "lineRange" in deletedAddedEvidence
          ? deletedAddedEvidence.lineRange
          : undefined,
        nodeIds: deletedAddedEvidence.nodeIds,
        contentHash: "contentHash" in deletedAddedEvidence
          ? deletedAddedEvidence.contentHash
          : undefined,
      },
      {
        kind: "source",
        epistemicStatus: "observed",
        freshness: "current",
        observedAtSnapshotId: deletedChangedSnapshotId,
        filePath: "src/untracked.ts",
        lineRange: [1, 1],
        nodeIds: [UNTRACKED_NODE_ID],
        contentHash: contentDigest(Buffer.from(UNTRACKED_SOURCE, "utf8")),
      },
    );
    assert.deepEqual(deletedAddedUnplanned.evidenceIds, [deletedAddedEvidence.id]);

    for (const [finding, key, reason] of [
      [
        deletedCannotDetermine,
        "preview-workbench-browser-deleted-accept-cannot-determine",
        "The legacy deletion obligation remains explicitly accepted as unresolved for this Alpha flow.",
      ],
      [
        deletedUnplanned,
        "preview-workbench-browser-deleted-accept-deletion",
        "The unstaged deletion is intentional and explicitly accepted for this Alpha flow.",
      ],
      [
        deletedAddedUnplanned,
        "preview-workbench-browser-deleted-accept-untracked-add",
        "The untracked source addition is intentional and explicitly accepted for this Alpha flow.",
      ],
    ]) {
      await updateDeletedTask(
        { type: "accept_finding", findingId: finding.id, reason },
        key,
      );
    }
    await updateDeletedTask(
      { type: "transition_status", to: "verification_required" },
      "preview-workbench-browser-deleted-verification-required",
    );
    const deletedVerificationEntries =
      deletedBrief.verificationPlan.filter((entry) => entry.required);
    assert.ok(
      deletedVerificationEntries.length > 0,
      "the live add/delete Task must carry a required Verification entry",
    );
    const deletedVerificationProgram = [
      "const { untrackedAdded } = await import('./src/untracked.ts');",
      "if (untrackedAdded() !== 'untracked-ready') throw new Error('unexpected untracked result');",
      "const { access } = await import('node:fs/promises');",
      "await access('./src/extra.ts').then(() => { throw new Error('deleted source still exists'); }, (error) => { if (error?.code !== 'ENOENT') throw error; });",
    ].join(" ");
    const deletedVerificationStartedAt = Date.now();
    const deletedVerificationExecution = await execBounded(
      process.execPath,
      ["--input-type=module", "--eval", deletedVerificationProgram],
      { cwd: repositoryRoot, encoding: "utf8" },
    );
    assert.equal(deletedVerificationExecution.stderr, "");
    const deletedVerificationDurationMs =
      Date.now() - deletedVerificationStartedAt;
    for (const [index, planEntry] of deletedVerificationEntries.entries()) {
      const recorded = await callTool(
        mcp,
        output,
        requestId++,
        "record_verification",
        {
          taskId: deletedTaskId,
          record: {
            verificationPlanEntryId: planEntry.id,
            kind: planEntry.method,
            status: "passed",
            command:
              `node --input-type=module --eval ${JSON.stringify(deletedVerificationProgram)}`,
            exitCode: 0,
            durationMs: deletedVerificationDurationMs,
            outputDigest: contentDigest(Buffer.from(
              `${deletedVerificationExecution.stdout}${deletedVerificationExecution.stderr}`,
              "utf8",
            )),
            summary:
              "The external untracked-add and unstaged-delete verification completed successfully.",
            claimIds: planEntry.acceptanceClaimIds,
            snapshotId: deletedChangedSnapshotId,
          },
          expectedRevision: deletedRevision,
          idempotencyKey:
            `preview-workbench-browser-deleted-verification-${index}`,
          actor,
        },
        RecordVerificationOutputV1Schema,
      );
      assert.equal(recorded.structuredContent.result.verification.status, "passed");
      assert.equal(
        recorded.structuredContent.result.verification.snapshotId,
        deletedChangedSnapshotId,
      );
      deletedRevision = recorded.structuredContent.result.mutation.revision;
    }
    const deletedVerified = await updateDeletedTask(
      { type: "transition_status", to: "verified" },
      "preview-workbench-browser-deleted-verified",
    );
    assert.equal(deletedVerified.structuredContent.result.task.status, "verified");

    const deletedOpened = await callTool(
      mcp,
      output,
      requestId++,
      "open_workbench",
      {
        route: {
          view: "tasks",
          taskId: deletedTaskId,
          section: "planned_changes",
          findingId: deletedUnplanned.id,
          evidenceId: deletedEvidence.id,
        },
        openBrowser: false,
      },
      OpenWorkbenchOutputV1Schema,
    );
    assert.equal(
      deletedOpened.structuredContent.meta.sourceSnapshotId,
      deletedChangedSnapshotId,
    );
    browser = await launchBrowser({
      executable: browserExecutable,
      userDataDir: deletionBrowserProfile,
      timeoutMs: 30_000,
    });
    await browser.navigate(deletedOpened.structuredContent.result.deepLink);
    await browser.waitFor(
      "document.querySelector('[data-testid=\"task-first-workbench\"]') !== null",
      "deleted-file Task Workbench",
      30_000,
    );
    const deletedWorkbenchEvidence = await browser.evaluate(`fetch(
      '/__workbench/evidence?taskId=' + encodeURIComponent(${JSON.stringify(deletedTaskId)})
        + '&evidenceId=' + encodeURIComponent(${JSON.stringify(deletedEvidence.id)}),
      { credentials: 'same-origin', headers: { accept: 'application/json' } },
    ).then(async (response) => ({ statusCode: response.status, payload: await response.json() }))`);
    assert.equal(deletedWorkbenchEvidence.statusCode, 200);
    assert.deepEqual(
      {
        status: deletedWorkbenchEvidence.payload.status,
        reason: deletedWorkbenchEvidence.payload.reason,
        observedSnapshotId:
          deletedWorkbenchEvidence.payload.observedSnapshotId,
      },
      {
        status: "stale",
        reason: "evidence_stale",
        observedSnapshotId: deletedInitialSnapshotId,
      },
    );
    assert.equal(
      Object.hasOwn(deletedWorkbenchEvidence.payload, "source"),
      false,
      "the Workbench must never read or return source bytes for a deleted file",
    );
    assert.equal(
      JSON.stringify(deletedWorkbenchEvidence.payload).includes(
        INITIAL_EXTRA_SOURCE.trim(),
      ),
      false,
      "the deleted baseline source must not appear in the Workbench response",
    );
    assert.equal(
      await browser.evaluate(
        "document.querySelector('[aria-label=\"证据源码行\"]') !== null",
      ),
      false,
      "the deleted Evidence view must not render guarded source lines",
    );
    assert.equal(
      await browser.evaluate(
        "document.querySelector('[data-testid=\"task-evidence-open-graph\"]') !== null",
      ),
      false,
      "deleted Evidence has no current Graph node navigation",
    );
    const deletedAddedOpened = await callTool(
      mcp,
      output,
      requestId++,
      "open_workbench",
      {
        route: {
          view: "tasks",
          taskId: deletedTaskId,
          section: "planned_changes",
          findingId: deletedAddedUnplanned.id,
          evidenceId: deletedAddedEvidence.id,
        },
        openBrowser: false,
      },
      OpenWorkbenchOutputV1Schema,
    );
    assert.equal(
      deletedAddedOpened.structuredContent.meta.sourceSnapshotId,
      deletedChangedSnapshotId,
    );
    await browser.navigate(deletedAddedOpened.structuredContent.result.deepLink);
    await browser.waitFor(
      `document.querySelector('[data-testid="task-evidence-view"][data-evidence-id="${deletedAddedEvidence.id}"]')?.textContent?.includes('untracked-ready') === true`,
      "live untracked addition current Source projection",
      30_000,
    );
    await browser.click(
      `[data-testid="task-evidence-open-graph"][data-node-id="${UNTRACKED_NODE_ID}"]`,
    );
    await browser.waitFor(
      `document.querySelector('[data-graph-node-id="${UNTRACKED_NODE_ID}"][data-selected="true"]') !== null`,
      "live untracked addition exact Graph focus",
      30_000,
    );
    await browser.close();
    browser = null;
    mcp.stdin.end();
    assert.deepEqual(
      await waitForExit(mcp, "deleted repository MCP EOF"),
      [0, null],
    );
    assert.equal(output.stderr.join(""), "");
    mcp = null;
    repositoryRoot = await createRepositoryFixture();
    repositoryRoots.push(repositoryRoot);
    lifecycleEnv = cleanMcpEnvironment(home, repositoryRoot);
    sourcePath = path.join(repositoryRoot, "src/index.ts");
    const untrackedPath = path.join(repositoryRoot, "src/untracked.ts");
    const intentToAddPath = path.join(
      repositoryRoot,
      "src/intent-to-add.ts",
    );
    mcp = spawn(managedWrapper, ["--root", repositoryRoot], {
      cwd: installDirectory,
      env: lifecycleEnv,
      stdio: ["pipe", "pipe", "pipe"],
    });
    output = collectMessages(mcp);
    await initializeMcp(
      mcp,
      output,
      "preview-workbench-browser-untracked",
      baseVersion,
    );
    requestId = 2;
    const untrackedInitialRefresh = await callTool(
      mcp,
      output,
      requestId++,
      "refresh_index",
      {
        mode: "full",
        idempotencyKey: "preview-workbench-browser-untracked-initial-refresh",
        actor,
      },
      RefreshIndexOutputV1Schema,
    );
    const untrackedInitialSnapshotId =
      untrackedInitialRefresh.structuredContent.meta.sourceSnapshotId;
    const untrackedBuilt = await callTool(
      mcp,
      output,
      requestId++,
      "build_task_brief",
      {
        task: "Change the foo function behavior.",
        expectedRevision: 0,
        idempotencyKey: "preview-workbench-browser-untracked-brief",
        actor,
        scope: ["src/index.ts"],
        maxCandidates: 1,
      },
      BuildTaskBriefOutputV1Schema,
    );
    const untrackedTaskId = untrackedBuilt.structuredContent.result.task.taskId;
    const untrackedBrief = untrackedBuilt.structuredContent.result.brief;
    assert.equal(untrackedBrief.plannedChanges.length, 1);
    const untrackedFooPlan = untrackedBrief.plannedChanges[0];
    assert.equal(untrackedFooPlan.filePath, "src/index.ts");
    assert.equal(untrackedFooPlan.symbolId, FOO_NODE_ID);
    assert.equal(
      untrackedBrief.plannedChanges.some(
        (change) =>
          change.filePath === "src/untracked.ts" ||
          change.filePath === "src/intent-to-add.ts",
      ),
      false,
      "the Brief must not plan either file that does not exist yet",
    );
    let untrackedRevision =
      untrackedBuilt.structuredContent.result.task.revision;
    const updateUntrackedTask = async (action, idempotencyKey) => {
      const updated = await callTool(
        mcp,
        output,
        requestId++,
        "update_task",
        {
          taskId: untrackedTaskId,
          action,
          expectedRevision: untrackedRevision,
          idempotencyKey,
          actor,
        },
        UpdateTaskOutputV1Schema,
      );
      untrackedRevision = updated.structuredContent.result.mutation.revision;
      return updated;
    };
    await updateUntrackedTask(
      { type: "confirm_goal", claimId: untrackedBrief.goalClaimId },
      "preview-workbench-browser-untracked-confirm-goal",
    );
    await updateUntrackedTask(
      {
        type: "confirm_acceptance_criteria",
        claimIds: untrackedBrief.acceptanceClaimIds,
      },
      "preview-workbench-browser-untracked-confirm-acceptance",
    );
    await updateUntrackedTask(
      {
        type: "confirm_plan",
        plannedChangeIds: untrackedBrief.plannedChanges.map(
          (change) => change.id,
        ),
      },
      "preview-workbench-browser-untracked-confirm-plan",
    );
    await updateUntrackedTask(
      { type: "transition_status", to: "planned" },
      "preview-workbench-browser-untracked-planned",
    );
    await updateUntrackedTask(
      { type: "transition_status", to: "in_progress" },
      "preview-workbench-browser-untracked-in-progress",
    );

    await Promise.all([
      writeFile(sourcePath, FOO_ONLY_SOURCE, "utf8"),
      writeFile(untrackedPath, UNTRACKED_SOURCE, "utf8"),
      writeFile(intentToAddPath, INTENT_TO_ADD_SOURCE, "utf8"),
    ]);
    await git(repositoryRoot, ["add", "-N", "--", "src/intent-to-add.ts"]);
    assert.equal(
      (await git(repositoryRoot, ["diff", "--cached", "--name-only"]))
        .stdout,
      "",
      "intent-to-add must not introduce cached content for any changed path",
    );
    assert.equal(
      (await git(repositoryRoot, [
        "diff",
        "--cached",
        "--name-only",
        "--",
        "src/intent-to-add.ts",
      ])).stdout,
      "",
      "the intent-to-add path must have no staged content",
    );
    assert.equal(
      (await git(repositoryRoot, ["status", "--porcelain", "--untracked-files=all"]))
        .stdout,
      " M src/index.ts\n A src/intent-to-add.ts\n?? src/untracked.ts\n",
      "the real repository must contain exactly one unstaged edit, one intent-to-add, and one untracked add",
    );
    const untrackedChangedRefresh = await callTool(
      mcp,
      output,
      requestId++,
      "refresh_index",
      {
        mode: "full",
        expectedSourceSnapshotId: untrackedInitialSnapshotId,
        idempotencyKey: "preview-workbench-browser-untracked-changed-refresh",
        actor,
      },
      RefreshIndexOutputV1Schema,
    );
    const untrackedChangedSnapshotId =
      untrackedChangedRefresh.structuredContent.meta.sourceSnapshotId;
    const untrackedSnapshotArtifact =
      RepositorySnapshotArtifactV1Schema.parse(JSON.parse(await readFile(
        path.join(
          repositoryRoot,
          ".understand-code",
          "snapshots",
          `${untrackedChangedSnapshotId}.json`,
        ),
        "utf8",
      )));
    assert.equal(untrackedSnapshotArtifact.payload.captureStatus, "complete");
    assert.equal(untrackedSnapshotArtifact.payload.changes.length, 3);
    const untrackedFooChange =
      untrackedSnapshotArtifact.payload.changes.find(
        (change) => change.path === "src/index.ts",
      );
    const untrackedAddedChange =
      untrackedSnapshotArtifact.payload.changes.find(
        (change) => change.path === "src/untracked.ts",
      );
    const intentToAddChange =
      untrackedSnapshotArtifact.payload.changes.find(
        (change) => change.path === "src/intent-to-add.ts",
      );
    assert.deepEqual(untrackedFooChange, {
      id: untrackedFooChange?.id,
      path: "src/index.ts",
      source: "unstaged",
      kind: "modified",
      contentDigest: contentDigest(Buffer.from(FOO_ONLY_SOURCE, "utf8")),
    });
    assert.deepEqual(untrackedAddedChange, {
      id: untrackedAddedChange?.id,
      path: "src/untracked.ts",
      source: "untracked",
      kind: "added",
      contentDigest: contentDigest(Buffer.from(UNTRACKED_SOURCE, "utf8")),
    });
    assert.deepEqual(intentToAddChange, {
      id: intentToAddChange?.id,
      path: "src/intent-to-add.ts",
      source: "unstaged",
      kind: "added",
      contentDigest: contentDigest(Buffer.from(INTENT_TO_ADD_SOURCE, "utf8")),
    });
    assert.equal(
      untrackedSnapshotArtifact.payload.changes.filter(
        (change) => change.path === "src/intent-to-add.ts",
      ).length,
      1,
      "intent-to-add must publish one change without a staged duplicate",
    );

    await updateUntrackedTask(
      { type: "transition_status", to: "check_required" },
      "preview-workbench-browser-untracked-check-required",
    );
    const untrackedChecked = await callTool(
      mcp,
      output,
      requestId++,
      "check_change",
      {
        taskId: untrackedTaskId,
        actualSnapshotId: untrackedChangedSnapshotId,
        includeWorktree: true,
        expectedRevision: untrackedRevision,
        idempotencyKey: "preview-workbench-browser-untracked-check",
        actor,
      },
      CheckChangeOutputV1Schema,
    );
    untrackedRevision =
      untrackedChecked.structuredContent.result.mutation.revision;
    const untrackedFindings =
      untrackedChecked.structuredContent.result.changeCheck.findings;
    const untrackedCompleted = untrackedFindings.filter(
      (finding) => finding.type === "planned_completed",
    );
    const untrackedUnplanned = untrackedFindings.filter(
      (finding) => finding.type === "unplanned_change",
    );
    assert.equal(untrackedCompleted.length, 1);
    assert.equal(untrackedUnplanned.length, 2);
    assert.equal(untrackedFindings.length, 3);
    const untrackedFooFinding = untrackedCompleted[0];
    const untrackedAddedFinding = untrackedUnplanned.find((finding) =>
      finding.actualChangeIds.includes(untrackedAddedChange.id),
    );
    const intentToAddFinding = untrackedUnplanned.find((finding) =>
      finding.actualChangeIds.includes(intentToAddChange.id),
    );
    assert.ok(untrackedAddedFinding, "the untracked add must be unplanned");
    assert.ok(intentToAddFinding, "the intent-to-add path must be unplanned");
    assert.deepEqual(untrackedFooFinding.plannedChangeIds, [untrackedFooPlan.id]);
    assert.deepEqual(untrackedFooFinding.actualChangeIds, [untrackedFooChange.id]);
    assert.equal(untrackedFooFinding.blocking, false);
    assert.deepEqual(untrackedAddedFinding.plannedChangeIds, []);
    assert.deepEqual(
      untrackedAddedFinding.actualChangeIds,
      [untrackedAddedChange.id],
    );
    assert.equal(untrackedAddedFinding.blocking, true);
    assert.deepEqual(intentToAddFinding.plannedChangeIds, []);
    assert.deepEqual(
      intentToAddFinding.actualChangeIds,
      [intentToAddChange.id],
    );
    assert.equal(intentToAddFinding.blocking, true);
    assert.equal(
      untrackedFindings.some((finding) => finding.type === "cannot_determine"),
      false,
      `the exact unstaged+intent-to-add+untracked bytes must be fully classified: ${JSON.stringify(untrackedFindings)}`,
    );
    const untrackedEvidenceRead = await callTool(
      mcp,
      output,
      requestId++,
      "get_evidence",
      {
        taskId: untrackedTaskId,
        evidenceIds: [
          ...untrackedFooFinding.evidenceIds,
          ...untrackedAddedFinding.evidenceIds,
          ...intentToAddFinding.evidenceIds,
        ],
        maxExcerptChars: 8_192,
        pageSize:
          untrackedFooFinding.evidenceIds.length +
          untrackedAddedFinding.evidenceIds.length +
          intentToAddFinding.evidenceIds.length,
      },
      GetEvidenceOutputV1Schema,
    );
    const untrackedFooEvidence =
      untrackedEvidenceRead.structuredContent.result.evidence.find(
        (evidence) =>
          "filePath" in evidence && evidence.filePath === "src/index.ts",
      );
    const untrackedAddedEvidence =
      untrackedEvidenceRead.structuredContent.result.evidence.find(
        (evidence) =>
          "filePath" in evidence && evidence.filePath === "src/untracked.ts",
      );
    const intentToAddEvidence =
      untrackedEvidenceRead.structuredContent.result.evidence.find(
        (evidence) =>
          "filePath" in evidence &&
          evidence.filePath === "src/intent-to-add.ts",
      );
    assert.ok(
      untrackedFooEvidence && "filePath" in untrackedFooEvidence,
      "the planned unstaged edit must have exact Source Evidence",
    );
    assert.deepEqual(untrackedFooEvidence.lineRange, [1, 1]);
    assert.deepEqual(untrackedFooEvidence.nodeIds, [FOO_NODE_ID]);
    assert.equal(
      untrackedFooEvidence.contentHash,
      contentDigest(Buffer.from(FOO_ONLY_SOURCE, "utf8")),
    );
    assert.equal(
      untrackedFooEvidence.observedAtSnapshotId,
      untrackedChangedSnapshotId,
    );
    assert.deepEqual(
      untrackedFooFinding.evidenceIds,
      [untrackedFooEvidence.id],
    );
    assert.ok(
      untrackedAddedEvidence && "filePath" in untrackedAddedEvidence,
      "the untracked add must have exact Source Evidence",
    );
    assert.deepEqual(untrackedAddedEvidence.lineRange, [1, 1]);
    assert.deepEqual(untrackedAddedEvidence.nodeIds, [UNTRACKED_NODE_ID]);
    assert.equal(
      untrackedAddedEvidence.contentHash,
      contentDigest(Buffer.from(UNTRACKED_SOURCE, "utf8")),
    );
    assert.equal(
      untrackedAddedEvidence.observedAtSnapshotId,
      untrackedChangedSnapshotId,
    );
    assert.deepEqual(
      untrackedAddedFinding.evidenceIds,
      [untrackedAddedEvidence.id],
    );
    assert.ok(
      intentToAddEvidence && "filePath" in intentToAddEvidence,
      "the intent-to-add file must have exact Source Evidence",
    );
    assert.deepEqual(intentToAddEvidence.lineRange, [1, 1]);
    assert.deepEqual(intentToAddEvidence.nodeIds, [INTENT_TO_ADD_NODE_ID]);
    assert.equal(
      intentToAddEvidence.contentHash,
      contentDigest(Buffer.from(INTENT_TO_ADD_SOURCE, "utf8")),
    );
    assert.equal(
      intentToAddEvidence.observedAtSnapshotId,
      untrackedChangedSnapshotId,
    );
    assert.deepEqual(
      intentToAddFinding.evidenceIds,
      [intentToAddEvidence.id],
    );

    await updateUntrackedTask(
      {
        type: "accept_finding",
        findingId: untrackedAddedFinding.id,
        reason:
          "The untracked source file is intentional and explicitly accepted for this Alpha flow.",
      },
      "preview-workbench-browser-untracked-accept-added",
    );
    await updateUntrackedTask(
      {
        type: "accept_finding",
        findingId: intentToAddFinding.id,
        reason:
          "The intent-to-add source file is intentional and explicitly accepted for this Alpha flow.",
      },
      "preview-workbench-browser-untracked-accept-intent-to-add",
    );
    await updateUntrackedTask(
      { type: "transition_status", to: "verification_required" },
      "preview-workbench-browser-untracked-verification-required",
    );
    const untrackedVerificationEntries =
      untrackedBrief.verificationPlan.filter((entry) => entry.required);
    assert.ok(
      untrackedVerificationEntries.length > 0,
      "the untracked Task must carry a required Verification entry",
    );
    const untrackedVerificationProgram = [
      "const { foo } = await import('./src/index.ts');",
      "const { untrackedAdded } = await import('./src/untracked.ts');",
      "const { intentToAdd } = await import('./src/intent-to-add.ts');",
      "if (foo() !== 'browser-ready') throw new Error('unexpected foo result');",
      "if (untrackedAdded() !== 'untracked-ready') throw new Error('unexpected untracked result');",
      "if (intentToAdd() !== 'intent-ready') throw new Error('unexpected intent-to-add result');",
    ].join(" ");
    const untrackedVerificationStartedAt = Date.now();
    const untrackedVerificationExecution = await execBounded(
      process.execPath,
      ["--input-type=module", "--eval", untrackedVerificationProgram],
      { cwd: repositoryRoot, encoding: "utf8" },
    );
    assert.equal(untrackedVerificationExecution.stderr, "");
    const untrackedVerificationDurationMs =
      Date.now() - untrackedVerificationStartedAt;
    for (const [index, planEntry] of untrackedVerificationEntries.entries()) {
      const recorded = await callTool(
        mcp,
        output,
        requestId++,
        "record_verification",
        {
          taskId: untrackedTaskId,
          record: {
            verificationPlanEntryId: planEntry.id,
            kind: planEntry.method,
            status: "passed",
            command:
              `node --input-type=module --eval ${JSON.stringify(untrackedVerificationProgram)}`,
            exitCode: 0,
            durationMs: untrackedVerificationDurationMs,
            outputDigest: contentDigest(Buffer.from(
              `${untrackedVerificationExecution.stdout}${untrackedVerificationExecution.stderr}`,
              "utf8",
            )),
            summary:
              "The external unstaged, intent-to-add, and untracked verification completed successfully.",
            claimIds: planEntry.acceptanceClaimIds,
            snapshotId: untrackedChangedSnapshotId,
          },
          expectedRevision: untrackedRevision,
          idempotencyKey:
            `preview-workbench-browser-untracked-verification-${index}`,
          actor,
        },
        RecordVerificationOutputV1Schema,
      );
      assert.equal(
        recorded.structuredContent.result.verification.status,
        "passed",
      );
      assert.equal(
        recorded.structuredContent.result.verification.snapshotId,
        untrackedChangedSnapshotId,
      );
      untrackedRevision =
        recorded.structuredContent.result.mutation.revision;
    }
    const untrackedVerified = await updateUntrackedTask(
      { type: "transition_status", to: "verified" },
      "preview-workbench-browser-untracked-verified",
    );
    assert.equal(
      untrackedVerified.structuredContent.result.task.status,
      "verified",
    );

    mcp.stdin.end();
    assert.deepEqual(
      await waitForExit(mcp, "untracked repository MCP EOF"),
      [0, null],
    );
    assert.equal(output.stderr.join(""), "");
    mcp = null;

    repositoryRoot = await createRepositoryFixture();
    repositoryRoots.push(repositoryRoot);
    lifecycleEnv = cleanMcpEnvironment(home, repositoryRoot);
    sourcePath = path.join(repositoryRoot, "src/index.ts");
    const addedPath = path.join(repositoryRoot, "src/added.ts");
    const happyDeletedPath = path.join(repositoryRoot, "src/extra.ts");
    mcp = spawn(managedWrapper, ["--root", repositoryRoot], {
      cwd: installDirectory,
      env: lifecycleEnv,
      stdio: ["pipe", "pipe", "pipe"],
    });
    output = collectMessages(mcp);
    await initializeMcp(mcp, output, "preview-workbench-browser-happy", baseVersion);
    requestId = 2;
    const initialRefresh = await callTool(mcp, output, requestId++, "refresh_index", {
      mode: "full",
      idempotencyKey: "preview-workbench-browser-happy-initial-refresh",
      actor,
    }, RefreshIndexOutputV1Schema);
    assert.equal(initialRefresh.structuredContent.result.operation.status, "completed");
    const initialSnapshotId = initialRefresh.structuredContent.meta.sourceSnapshotId;

    const built = await callTool(mcp, output, requestId++, "build_task_brief", {
      task: "Change the foo function behavior.",
      expectedRevision: 0,
      idempotencyKey: "preview-workbench-browser-brief",
      actor,
      scope: ["src/index.ts"],
      maxCandidates: 1,
    }, BuildTaskBriefOutputV1Schema);
    const taskId = built.structuredContent.result.task.taskId;
    const baselineSnapshotId = built.structuredContent.result.task.baselineSnapshotId;
    const brief = built.structuredContent.result.brief;
    assert.equal(brief.plannedChanges.length, 1);
    const initialFooPlan = brief.plannedChanges.find((change) => change.filePath === "src/index.ts");
    assert.ok(initialFooPlan, `the Brief must plan src/index.ts: ${JSON.stringify(brief.plannedChanges)}`);
    assert.equal(initialFooPlan.symbolId, FOO_NODE_ID);
    assert.equal(
      brief.plannedChanges.some((change) => change.filePath === "src/added.ts"),
      false,
      "the Brief created before src/added.ts exists must not plan that later-added file",
    );

    let taskRevision = built.structuredContent.result.task.revision;
    const updateTask = async (action, idempotencyKey) => {
      const updated = await callTool(mcp, output, requestId++, "update_task", {
        taskId,
        action,
        expectedRevision: taskRevision,
        idempotencyKey,
        actor,
      }, UpdateTaskOutputV1Schema);
      taskRevision = updated.structuredContent.result.mutation.revision;
      return updated;
    };
    await updateTask({ type: "confirm_goal", claimId: brief.goalClaimId }, "preview-workbench-browser-confirm-goal");
    await updateTask(
      { type: "confirm_acceptance_criteria", claimIds: brief.acceptanceClaimIds },
      "preview-workbench-browser-confirm-acceptance",
    );
    await updateTask(
      { type: "confirm_plan", plannedChangeIds: brief.plannedChanges.map((change) => change.id) },
      "preview-workbench-browser-confirm-plan",
    );
    await updateTask({ type: "transition_status", to: "planned" }, "preview-workbench-browser-planned");
    await updateTask({ type: "transition_status", to: "in_progress" }, "preview-workbench-browser-in-progress");

    await Promise.all([
      writeFile(sourcePath, FOO_ONLY_SOURCE, "utf8"),
      writeFile(addedPath, ADDED_SOURCE, "utf8"),
      rm(happyDeletedPath),
    ]);
    await git(repositoryRoot, [
      "add",
      "--",
      "src/added.ts",
      "src/extra.ts",
      "src/index.ts",
    ]);
    assert.equal(
      (await git(repositoryRoot, [
        "ls-files",
        "--stage",
        "--",
        "src/extra.ts",
      ])).stdout,
      "",
      "the all-staged happy path must remove the deleted file from Index stage-0",
    );
    assert.deepEqual(
      (await git(repositoryRoot, ["diff", "--cached", "--name-only"]))
        .stdout.trim().split("\n").filter(Boolean),
      ["src/added.ts", "src/extra.ts", "src/index.ts"],
      "the happy Change Check must bind exactly the staged add, delete, and planned edit",
    );
    assert.equal(
      (await git(repositoryRoot, ["diff", "--name-only"])).stdout,
      "",
      "the staged bytes must have no same-path worktree divergence",
    );
    const changedRefresh = await callTool(mcp, output, requestId++, "refresh_index", {
      mode: "full",
      expectedSourceSnapshotId: initialSnapshotId,
      idempotencyKey: "preview-workbench-browser-changed-refresh",
      actor,
    }, RefreshIndexOutputV1Schema);
    const changedSnapshotId = changedRefresh.structuredContent.meta.sourceSnapshotId;
    assert.notEqual(changedSnapshotId, initialSnapshotId);
    const changedSnapshotArtifact = RepositorySnapshotArtifactV1Schema.parse(JSON.parse(await readFile(
      path.join(repositoryRoot, ".understand-code", "snapshots", `${changedSnapshotId}.json`),
      "utf8",
    )));
    assert.equal(changedSnapshotArtifact.payload.captureStatus, "complete");
    assert.equal(changedSnapshotArtifact.payload.changes.length, 3);
    const addedSnapshotChange = changedSnapshotArtifact.payload.changes.find((change) =>
      change.path === "src/added.ts",
    );
    const fooSnapshotChange = changedSnapshotArtifact.payload.changes.find((change) =>
      change.path === "src/index.ts",
    );
    const happyDeletedSnapshotChange = changedSnapshotArtifact.payload.changes.find((change) =>
      change.path === "src/extra.ts",
    );
    assert.deepEqual(addedSnapshotChange, {
      id: addedSnapshotChange?.id,
      path: "src/added.ts",
      source: "staged",
      kind: "added",
      contentDigest: contentDigest(Buffer.from(ADDED_SOURCE, "utf8")),
    });
    assert.deepEqual(fooSnapshotChange, {
      id: fooSnapshotChange?.id,
      path: "src/index.ts",
      source: "staged",
      kind: "modified",
      contentDigest: contentDigest(Buffer.from(FOO_ONLY_SOURCE, "utf8")),
    });
    assert.deepEqual(happyDeletedSnapshotChange, {
      id: happyDeletedSnapshotChange?.id,
      path: "src/extra.ts",
      source: "staged",
      kind: "deleted",
    });

    await updateTask(
      { type: "transition_status", to: "check_required" },
      "preview-workbench-browser-check-required",
    );
    const checked = await callTool(mcp, output, requestId++, "check_change", {
      taskId,
      actualSnapshotId: changedSnapshotId,
      includeWorktree: true,
      expectedRevision: taskRevision,
      idempotencyKey: "preview-workbench-browser-check",
      actor,
    }, CheckChangeOutputV1Schema);
    taskRevision = checked.structuredContent.result.mutation.revision;
    assert.deepEqual(checked.structuredContent.result.changeCheckClassification, {
      profile: "legacy_summary",
      emptyFindingsAreClean: false,
    });
    assert.deepEqual(checked.content, [{
      type: "text",
      text: "Change Check recorded as a legacy summary; empty findings are not clean evidence.",
    }]);
    const findingDiagnostics = checked.structuredContent.result.changeCheck.findings.map((candidate) => ({
      type: candidate.type,
      blocking: candidate.blocking,
      plannedChangeIds: candidate.plannedChangeIds,
      actualChangeIds: candidate.actualChangeIds,
      summary: candidate.summary,
    }));
    const completedFindings = checked.structuredContent.result.changeCheck.findings.filter(
      (candidate) => candidate.type === "planned_completed",
    );
    assert.equal(completedFindings.length, 1, "the public Check must complete only the planned foo symbol");
    const unplannedFindings = checked.structuredContent.result.changeCheck.findings.filter(
      (candidate) => candidate.type === "unplanned_change",
    );
    assert.equal(
      unplannedFindings.length,
      2,
      `the public Check must publish exact independent unplanned add/delete Findings: ${JSON.stringify(findingDiagnostics)}`,
    );
    assert.equal(
      checked.structuredContent.result.changeCheck.findings.length,
      3,
      `the exact three-path change must publish one completed foo and two unplanned Findings: ${JSON.stringify(findingDiagnostics)}`,
    );
    const fooPlannedChange = brief.plannedChanges.find((change) =>
      change.filePath === "src/index.ts" && change.symbolId === FOO_NODE_ID,
    );
    assert.ok(fooPlannedChange, "the exact foo planned change must remain addressable");
    const finding = completedFindings.find((candidate) =>
      candidate.plannedChangeIds.includes(fooPlannedChange.id),
    );
    const addedFinding = unplannedFindings.find((candidate) =>
      candidate.actualChangeIds.includes(addedSnapshotChange.id),
    );
    const happyDeletedFinding = unplannedFindings.find((candidate) =>
      candidate.actualChangeIds.includes(happyDeletedSnapshotChange.id),
    );
    assert.ok(finding, "the public Check must publish a source-backed completed foo Finding");
    assert.ok(
      addedFinding,
      `the public Check must publish the later-added file as unplanned: ${JSON.stringify(findingDiagnostics)}`,
    );
    assert.ok(
      happyDeletedFinding,
      `the public Check must publish the removed baseline file as unplanned: ${JSON.stringify(findingDiagnostics)}`,
    );
    assert.deepEqual(finding.plannedChangeIds, [fooPlannedChange.id]);
    assert.deepEqual(addedFinding.plannedChangeIds, []);
    assert.equal(addedFinding.blocking, true);
    assert.deepEqual(finding.actualChangeIds, [fooSnapshotChange.id]);
    assert.deepEqual(addedFinding.actualChangeIds, [addedSnapshotChange.id]);
    assert.deepEqual(happyDeletedFinding.plannedChangeIds, []);
    assert.equal(happyDeletedFinding.blocking, true);
    assert.deepEqual(happyDeletedFinding.actualChangeIds, [happyDeletedSnapshotChange.id]);
    assert.equal(finding.evidenceIds.length, 1);
    assert.equal(addedFinding.evidenceIds.length, 1);
    assert.equal(happyDeletedFinding.evidenceIds.length, 1);
    assert.equal(
      checked.structuredContent.result.changeCheck.findings.some((candidate) =>
        candidate.type === "cannot_determine" ||
        (candidate.blocking &&
          candidate.id !== addedFinding.id &&
          candidate.id !== happyDeletedFinding.id)
      ),
      false,
      `the exact staged bytes must leave only the added/deleted Findings blocking: ${JSON.stringify(findingDiagnostics)}`,
    );
    const evidenceRead = await callTool(mcp, output, requestId++, "get_evidence", {
      taskId,
      evidenceIds: [
        ...finding.evidenceIds,
        ...addedFinding.evidenceIds,
        ...happyDeletedFinding.evidenceIds,
      ],
      maxExcerptChars: 8_192,
      pageSize:
        finding.evidenceIds.length +
        addedFinding.evidenceIds.length +
        happyDeletedFinding.evidenceIds.length,
    }, GetEvidenceOutputV1Schema);
    const expectedEvidence = evidenceRead.structuredContent.result.evidence.find((evidence) =>
      "filePath" in evidence && evidence.filePath === "src/index.ts",
    );
    assert.ok(expectedEvidence && "filePath" in expectedEvidence, "the finding must resolve to the edited source file");
    assert.equal(expectedEvidence.freshness, "current");
    assert.deepEqual(expectedEvidence.lineRange, [1, 1]);
    assert.deepEqual(expectedEvidence.nodeIds, [FOO_NODE_ID]);
    assert.equal(expectedEvidence.contentHash, contentDigest(Buffer.from(FOO_ONLY_SOURCE, "utf8")));
    assert.equal(expectedEvidence.observedAtSnapshotId, changedSnapshotId);
    assert.deepEqual(finding.evidenceIds, [expectedEvidence.id]);
    const addedEvidence = evidenceRead.structuredContent.result.evidence.find((evidence) =>
      "filePath" in evidence && evidence.filePath === "src/added.ts",
    );
    assert.ok(addedEvidence && "filePath" in addedEvidence, "the unplanned Finding must resolve to the added source file");
    assert.equal(addedEvidence.freshness, "current");
    assert.deepEqual(addedEvidence.lineRange, [1, 1]);
    assert.deepEqual(addedEvidence.nodeIds, [ADDED_NODE_ID]);
    assert.equal(addedEvidence.contentHash, contentDigest(Buffer.from(ADDED_SOURCE, "utf8")));
    assert.equal(addedEvidence.observedAtSnapshotId, changedSnapshotId);
    assert.deepEqual(addedFinding.evidenceIds, [addedEvidence.id]);
    const happyDeletedEvidence = evidenceRead.structuredContent.result.evidence.find((evidence) =>
      "filePath" in evidence && evidence.filePath === "src/extra.ts",
    );
    assert.ok(happyDeletedEvidence && "filePath" in happyDeletedEvidence, "the deletion Finding must resolve to baseline Source Evidence");
    assert.equal(happyDeletedEvidence.freshness, "changed");
    assert.deepEqual(happyDeletedEvidence.lineRange, [1, 1]);
    assert.deepEqual(happyDeletedEvidence.nodeIds, []);
    assert.equal(
      happyDeletedEvidence.contentHash,
      contentDigest(Buffer.from(INITIAL_EXTRA_SOURCE, "utf8")),
    );
    assert.equal(happyDeletedEvidence.observedAtSnapshotId, initialSnapshotId);
    assert.deepEqual(happyDeletedFinding.evidenceIds, [happyDeletedEvidence.id]);

    await updateTask(
      {
        type: "accept_finding",
        findingId: addedFinding.id,
        reason: "The added source file is intentional and is explicitly accepted for this Alpha flow.",
      },
      "preview-workbench-browser-accept-added-file-finding",
    );
    await updateTask(
      {
        type: "accept_finding",
        findingId: happyDeletedFinding.id,
        reason: "The staged source deletion is intentional and explicitly accepted for this Alpha flow.",
      },
      "preview-workbench-browser-accept-deleted-file-finding",
    );

    await updateTask(
      { type: "transition_status", to: "verification_required" },
      "preview-workbench-browser-verification-required",
    );
    const requiredVerificationEntries = brief.verificationPlan.filter((entry) => entry.required);
    assert.ok(requiredVerificationEntries.length > 0, "the Task must carry a required Verification entry");
    const firstRequiredVerificationEntry = requiredVerificationEntries[0];
    const failedVerificationProgram = [
      "const { foo } = await import('./src/index.ts');",
      "if (foo() !== 'foo-before') throw new Error('expected the pre-change foo result');",
    ].join(" ");
    const failedVerificationStartedAt = Date.now();
    let failedVerificationExecution;
    try {
      await execBounded(
        process.execPath,
        ["--input-type=module", "--eval", failedVerificationProgram],
        { cwd: repositoryRoot, encoding: "utf8" },
      );
      assert.fail("the first required Verification attempt must fail before the corrected retry");
    } catch (error) {
      assert.equal(error?.code, 1, "the first required Verification command must exit 1");
      failedVerificationExecution = {
        stdout: error?.stdout ?? "",
        stderr: error?.stderr ?? "",
      };
    }
    assert.match(failedVerificationExecution.stderr, /expected the pre-change foo result/u);
    const failedVerification = await callTool(mcp, output, requestId++, "record_verification", {
      taskId,
      record: {
        verificationPlanEntryId: firstRequiredVerificationEntry.id,
        kind: firstRequiredVerificationEntry.method,
        status: "failed",
        command: `node --input-type=module --eval ${JSON.stringify(failedVerificationProgram)}`,
        exitCode: 1,
        durationMs: Date.now() - failedVerificationStartedAt,
        outputDigest: contentDigest(Buffer.from(
          `${failedVerificationExecution.stdout}${failedVerificationExecution.stderr}`,
          "utf8",
        )),
        summary: "The first external foo verification attempt failed as expected.",
        claimIds: firstRequiredVerificationEntry.acceptanceClaimIds,
        snapshotId: changedSnapshotId,
      },
      expectedRevision: taskRevision,
      idempotencyKey: "preview-workbench-browser-verification-failed-first-attempt",
      actor,
    }, RecordVerificationOutputV1Schema);
    assert.equal(failedVerification.structuredContent.result.verification.status, "failed");
    assert.equal(failedVerification.structuredContent.result.verification.attempt, 1);
    taskRevision = failedVerification.structuredContent.result.mutation.revision;

    const verificationProgram = [
      "const { foo } = await import('./src/index.ts');",
      "const { added } = await import('./src/added.ts');",
      "if (foo() !== 'browser-ready') throw new Error('unexpected foo result');",
      "if (added() !== 'added-unplanned') throw new Error('unexpected added result');",
      "const { access } = await import('node:fs/promises');",
      "await access('./src/extra.ts').then(() => { throw new Error('deleted source still exists'); }, (error) => { if (error?.code !== 'ENOENT') throw error; });",
    ].join(" ");
    const verificationStartedAt = Date.now();
    const verificationExecution = await execBounded(
      process.execPath,
      ["--input-type=module", "--eval", verificationProgram],
      { cwd: repositoryRoot, encoding: "utf8" },
    );
    assert.equal(verificationExecution.stderr, "");
    const verificationDurationMs = Date.now() - verificationStartedAt;
    for (const [index, planEntry] of requiredVerificationEntries.entries()) {
      const recorded = await callTool(mcp, output, requestId++, "record_verification", {
        taskId,
        record: {
          verificationPlanEntryId: planEntry.id,
          ...(index === 0 ? {
            supersedesVerificationRecordId:
              failedVerification.structuredContent.result.verification.id,
          } : {}),
          kind: planEntry.method,
          status: "passed",
          command: `node --input-type=module --eval ${JSON.stringify(verificationProgram)}`,
          exitCode: 0,
          durationMs: verificationDurationMs,
          outputDigest: contentDigest(Buffer.from(`${verificationExecution.stdout}${verificationExecution.stderr}`, "utf8")),
          summary: "The external add, modify, and delete verification command completed successfully.",
          claimIds: planEntry.acceptanceClaimIds,
          snapshotId: changedSnapshotId,
        },
        expectedRevision: taskRevision,
        idempotencyKey: `preview-workbench-browser-verification-${index}`,
        actor,
      }, RecordVerificationOutputV1Schema);
      assert.equal(recorded.structuredContent.result.verification.status, "passed");
      assert.equal(recorded.structuredContent.result.verification.snapshotId, changedSnapshotId);
      assert.equal(recorded.structuredContent.result.verification.attempt, index === 0 ? 2 : 1);
      taskRevision = recorded.structuredContent.result.mutation.revision;
    }
    const verified = await updateTask(
      { type: "transition_status", to: "verified" },
      "preview-workbench-browser-verified",
    );
    assert.equal(verified.structuredContent.result.task.status, "verified");
    const verifiedRevision = verified.structuredContent.result.task.revision;
    assert.equal(verifiedRevision, taskRevision);

    const opened = await callTool(mcp, output, requestId++, "open_workbench", {
      route: { view: "tasks", taskId, section: "planned_changes" },
      openBrowser: false,
    }, OpenWorkbenchOutputV1Schema);
    const deepLink = opened.structuredContent.result.deepLink;
    assert.equal(opened.structuredContent.meta.sourceSnapshotId, changedSnapshotId);
    const workbenchUrl = new URL(deepLink);
    assert.equal(workbenchUrl.hostname, "127.0.0.1");

    browser = await launchBrowser({
      executable: browserExecutable,
      userDataDir: browserProfile,
      timeoutMs: 30_000,
    });
    await browser.navigate(deepLink);
    await browser.waitFor(
      "document.querySelector('[data-testid=\"task-first-workbench\"]') !== null",
      "React Task Workbench",
      30_000,
    );
    const loadedReactEntry = browser.networkResponses.find((response) => {
      try {
        return new URL(response.url).pathname === reactEntry && response.status === 200;
      } catch {
        return false;
      }
    });
    assert.ok(loadedReactEntry, `open_workbench must load the installed React entry ${reactEntry}`);
    assert.equal(
      browser.networkResponses.some((response) => new URL(response.url).pathname === "/__workbench/app.js"),
      false,
      "the installed gate must not fall back to the legacy embedded Workbench app",
    );

    const happyDeletedWorkbenchEvidence = await browser.evaluate(`fetch(
      '/__workbench/evidence?taskId=' + encodeURIComponent(${JSON.stringify(taskId)})
        + '&evidenceId=' + encodeURIComponent(${JSON.stringify(happyDeletedEvidence.id)}),
      { credentials: 'same-origin', headers: { accept: 'application/json' } },
    ).then(async (response) => ({ statusCode: response.status, payload: await response.json() }))`);
    assert.equal(happyDeletedWorkbenchEvidence.statusCode, 200);
    assert.deepEqual(
      {
        status: happyDeletedWorkbenchEvidence.payload.status,
        reason: happyDeletedWorkbenchEvidence.payload.reason,
        observedSnapshotId: happyDeletedWorkbenchEvidence.payload.observedSnapshotId,
      },
      {
        status: "stale",
        reason: "evidence_stale",
        observedSnapshotId: initialSnapshotId,
      },
    );
    assert.equal(
      Object.hasOwn(happyDeletedWorkbenchEvidence.payload, "source"),
      false,
      "the all-staged Workbench must never return source bytes for the deleted file",
    );
    await browser.waitFor(bodyContains(happyDeletedFinding.summary), "unplanned staged deletion Finding");
    await browser.click(`[data-testid="task-finding-open"][data-finding-id="${happyDeletedFinding.id}"]`);
    await browser.waitFor(
      `document.querySelector('[data-testid="task-evidence-open"][data-evidence-id="${happyDeletedEvidence.id}"]') !== null`,
      "staged deletion Evidence action",
    );
    await browser.click(`[data-testid="task-evidence-open"][data-evidence-id="${happyDeletedEvidence.id}"]`);
    await browser.waitFor(
      `document.querySelector('[data-testid="task-evidence-view"][data-evidence-id="${happyDeletedEvidence.id}"]') !== null`,
      "staged deletion stale Evidence view",
    );
    assert.equal(
      await browser.evaluate(
        "document.querySelector('[aria-label=\"证据源码行\"]') !== null",
      ),
      false,
      "the staged deletion Evidence must not render guarded source lines",
    );
    assert.equal(
      await browser.evaluate(
        "document.querySelector('[data-testid=\"task-evidence-open-graph\"]') !== null",
      ),
      false,
      "the staged deletion Evidence has no current Graph navigation",
    );
    await browser.navigate(deepLink);
    await browser.waitFor(
      "document.querySelector('[data-testid=\"task-first-workbench\"]') !== null",
      "Task Workbench after staged deletion Evidence",
      30_000,
    );

    await browser.waitFor(bodyContains(addedFinding.summary), "unplanned staged addition Finding");
    await browser.click(`[data-testid="task-finding-open"][data-finding-id="${addedFinding.id}"]`);
    await browser.waitFor(
      `document.querySelector('[data-testid="task-evidence-open"][data-evidence-id="${addedEvidence.id}"]') !== null`,
      "staged addition Evidence action",
    );
    await browser.click(`[data-testid="task-evidence-open"][data-evidence-id="${addedEvidence.id}"]`);
    await browser.waitFor(
      `document.querySelector('[data-testid="task-evidence-view"][data-evidence-id="${addedEvidence.id}"]')?.textContent?.includes('added-unplanned') === true`,
      "staged addition current Source projection",
    );
    await browser.click(`[data-testid="task-evidence-open-graph"][data-node-id="${ADDED_NODE_ID}"]`);
    await browser.waitFor(
      `document.querySelector('[data-graph-node-id="${ADDED_NODE_ID}"][data-selected="true"]') !== null`,
      "staged addition exact Graph focus",
      30_000,
    );
    await browser.navigate(deepLink);
    await browser.waitFor(
      "document.querySelector('[data-testid=\"task-first-workbench\"]') !== null",
      "Task Workbench after staged addition Graph",
      30_000,
    );

    await browser.waitFor(bodyContains(finding.summary), "published Change Check finding");
    assert.deepEqual(
      await browser.evaluate(`(() => {
        const marker = document.querySelector('[data-testid="task-change-check-classification"]');
        return marker === null ? null : {
          profile: marker.getAttribute('data-profile'),
          emptyFindingsAreClean: marker.getAttribute('data-empty-findings-are-clean'),
          text: marker.textContent,
        };
      })()`),
      {
        profile: "legacy_summary",
        emptyFindingsAreClean: "false",
        text: "Legacy summary / 旧版摘要。 Empty findings are not clean evidence. / 空 findings 不代表变更已被完整证明为 clean。",
      },
      "the React Workbench must not present a legacy summary as clean evidence",
    );
    assert.equal(
      await browser.evaluate(bodyContains(changedSnapshotId)),
      true,
      "the ready Task surface must expose its pinned source Snapshot",
    );
    await browser.click(`[data-testid="task-finding-open"][data-finding-id="${finding.id}"]`);
    await browser.waitFor(
      `document.querySelector('[data-testid="task-evidence-open"][data-evidence-id="${expectedEvidence.id}"]') !== null`,
      "Finding Evidence action",
    );
    await browser.click(`[data-testid="task-evidence-open"][data-evidence-id="${expectedEvidence.id}"]`);
    await browser.waitFor(
      `(() => {
        const view = document.querySelector('[data-testid="task-evidence-view"], [data-workbench-view="evidence"]');
        return view?.textContent?.includes(${JSON.stringify(expectedEvidence.id)}) === true
          && view.textContent.includes(${JSON.stringify(expectedEvidence.filePath)})
          && view.textContent.includes('browser-ready');
      })()`,
      "finding Evidence and source projection",
    );
    const workbenchEvidence = await browser.evaluate(`fetch(
      '/__workbench/evidence?taskId=' + encodeURIComponent(${JSON.stringify(taskId)})
        + '&evidenceId=' + encodeURIComponent(${JSON.stringify(expectedEvidence.id)}),
      { credentials: 'same-origin', headers: { accept: 'application/json' } },
    ).then(async (response) => ({ statusCode: response.status, payload: await response.json() }))`);
    assert.equal(workbenchEvidence.statusCode, 200);
    assert.equal(workbenchEvidence.payload.status, "ready");
    assert.equal(workbenchEvidence.payload.evidence.id, expectedEvidence.id);
    assert.equal(workbenchEvidence.payload.source.filePath, expectedEvidence.filePath);
    assert.deepEqual(workbenchEvidence.payload.evidence.lineRange, [1, 1]);
    assert.deepEqual(workbenchEvidence.payload.source.lineRange, [1, 1]);
    assert.equal(workbenchEvidence.payload.source.content, "export function foo() { return 'browser-ready'; }");
    assert.doesNotMatch(workbenchEvidence.payload.source.content, /bar/u);
    assert.deepEqual(
      workbenchEvidence.payload.evidence.nodeIds,
      [FOO_NODE_ID],
      "the session-bound Evidence projection must retain the exact foo Graph node binding",
    );
    for (const nodeId of workbenchEvidence.payload.evidence.nodeIds) {
      assert.equal(await browser.evaluate(bodyContains(nodeId)), true, `Evidence must expose node ${nodeId}`);
    }

    const workbenchTrace = await browser.evaluate(`fetch(
      '/__workbench/trace?taskId=' + encodeURIComponent(${JSON.stringify(taskId)}),
      { credentials: 'same-origin', headers: { accept: 'application/json' } },
    ).then(async (response) => ({ statusCode: response.status, payload: await response.json() }))`);
    assert.equal(workbenchTrace.statusCode, 200);
    assert.equal(workbenchTrace.payload.status, "ready");
    assert.equal(workbenchTrace.payload.snapshotId, changedSnapshotId);
    assert.deepEqual(workbenchTrace.payload.changeCheckClassification, {
      profile: "legacy_summary",
      emptyFindingsAreClean: false,
    });
    assert.equal(workbenchTrace.payload.verification.disposition, "externally_reported");
    assert.equal(workbenchTrace.payload.verification.requiredCount, requiredVerificationEntries.length);
    assert.equal(workbenchTrace.payload.verification.passedCount, requiredVerificationEntries.length);
    assert.equal(workbenchTrace.payload.verification.failedCount, 0);
    assert.equal(workbenchTrace.payload.verification.pendingCount, 0);
    assert.equal(workbenchTrace.payload.verification.records.length, requiredVerificationEntries.length + 1);
    const firstRequiredAttempts = workbenchTrace.payload.verification.records.filter(
      (record) => record.verificationPlanEntryId === firstRequiredVerificationEntry.id,
    );
    assert.deepEqual(
      firstRequiredAttempts.map((record) => ({
        attempt: record.attempt,
        status: record.status,
        supersedesVerificationRecordId: record.supersedesVerificationRecordId,
      })),
      [
        { attempt: 1, status: "failed", supersedesVerificationRecordId: undefined },
        {
          attempt: 2,
          status: "passed",
          supersedesVerificationRecordId:
            failedVerification.structuredContent.result.verification.id,
        },
      ],
      "Workbench trace must retain both attempts while summarizing only the current retry",
    );

    let stableLifecycleProjection = null;
    const assertLifecycleContinuity = async (label) => {
      const projection = await browser.evaluate(`Promise.all([
        fetch('/tasks/' + encodeURIComponent(${JSON.stringify(taskId)}) + '/brief.json?section=summary', {
          credentials: 'same-origin', headers: { accept: 'application/json' },
        }),
        fetch('/tasks/' + encodeURIComponent(${JSON.stringify(taskId)}) + '/change-check.json', {
          credentials: 'same-origin', headers: { accept: 'application/json' },
        }),
        fetch('/tasks/' + encodeURIComponent(${JSON.stringify(taskId)}) + '/verification.json', {
          credentials: 'same-origin', headers: { accept: 'application/json' },
        }),
        fetch('/__workbench/trace?taskId=' + encodeURIComponent(${JSON.stringify(taskId)}), {
          credentials: 'same-origin', headers: { accept: 'application/json' },
        }),
        fetch('/__workbench/evidence?taskId=' + encodeURIComponent(${JSON.stringify(taskId)})
          + '&evidenceId=' + encodeURIComponent(${JSON.stringify(expectedEvidence.id)}), {
          credentials: 'same-origin', headers: { accept: 'application/json' },
        }),
      ]).then(async ([briefResponse, checkResponse, verificationResponse, traceResponse, evidenceResponse]) => ({
        statuses: [
          briefResponse.status,
          checkResponse.status,
          verificationResponse.status,
          traceResponse.status,
          evidenceResponse.status,
        ],
        brief: await briefResponse.json(),
        check: await checkResponse.json(),
        verification: await verificationResponse.json(),
        trace: await traceResponse.json(),
        evidence: await evidenceResponse.json(),
      }))`);
      assert.deepEqual(projection.statuses, [200, 200, 200, 200, 200], `${label} continuity HTTP status`);
      assert.deepEqual(
        {
          taskId: projection.brief.task.taskId,
          status: projection.brief.task.status,
          revision: projection.brief.task.revision,
          baselineSnapshotId: projection.brief.task.baselineSnapshotId,
          latestSnapshotId: projection.brief.task.latestSnapshotId,
        },
        {
          taskId,
          status: "verified",
          revision: verifiedRevision,
          baselineSnapshotId,
          latestSnapshotId: changedSnapshotId,
        },
        `${label} Task identity`,
      );
      assert.equal(projection.check.task.taskId, taskId, `${label} Change Check Task`);
      assert.equal(projection.check.artifact.sourceSnapshotId, changedSnapshotId, `${label} Change Check Snapshot`);
      const projectedFinding = projection.check.artifact.payload.findings.find(
        (candidate) => candidate.id === finding.id,
      );
      assert.ok(projectedFinding, `${label} exact Finding`);
      assert.deepEqual(projectedFinding.evidenceIds, finding.evidenceIds, `${label} Finding Evidence links`);
      assert.equal(projection.trace.snapshotId, changedSnapshotId, `${label} Verification Snapshot`);
      assert.equal(projection.trace.verification.disposition, "externally_reported", `${label} Verification disposition`);
      assert.deepEqual(
        {
          requiredCount: projection.trace.verification.requiredCount,
          passedCount: projection.trace.verification.passedCount,
          failedCount: projection.trace.verification.failedCount,
          pendingCount: projection.trace.verification.pendingCount,
          records: projection.trace.verification.records.map((record) => ({
            id: record.id,
            attempt: record.attempt,
            status: record.status,
            snapshotId: record.snapshotId,
            verificationPlanEntryId: record.verificationPlanEntryId,
            supersedesVerificationRecordId: record.supersedesVerificationRecordId,
          })),
        },
        {
          requiredCount: workbenchTrace.payload.verification.requiredCount,
          passedCount: workbenchTrace.payload.verification.passedCount,
          failedCount: workbenchTrace.payload.verification.failedCount,
          pendingCount: workbenchTrace.payload.verification.pendingCount,
          records: workbenchTrace.payload.verification.records.map((record) => ({
            id: record.id,
            attempt: record.attempt,
            status: record.status,
            snapshotId: record.snapshotId,
            verificationPlanEntryId: record.verificationPlanEntryId,
            supersedesVerificationRecordId: record.supersedesVerificationRecordId,
          })),
        },
        `${label} Verification trace`,
      );
      assert.equal(projection.evidence.status, "ready", `${label} Evidence status`);
      assert.equal(projection.evidence.snapshotId, changedSnapshotId, `${label} Evidence Snapshot`);
      assert.equal(projection.evidence.evidence.id, expectedEvidence.id, `${label} Evidence identity`);
      assert.equal(projection.evidence.evidence.contentHash, expectedEvidence.contentHash, `${label} Evidence hash`);
      assert.deepEqual(projection.evidence.evidence.nodeIds, expectedEvidence.nodeIds, `${label} Evidence nodes`);
      const completeProjection = {
        brief: projection.brief,
        check: projection.check,
        verification: projection.verification,
        trace: projection.trace,
        evidence: projection.evidence,
      };
      if (stableLifecycleProjection === null) {
        stableLifecycleProjection = completeProjection;
      } else {
        assert.deepEqual(
          completeProjection,
          stableLifecycleProjection,
          `${label} must preserve the complete Task/Check/Verification/Trace/Evidence projection`,
        );
      }
    };
    await assertLifecycleContinuity("v1 candidate");

    const focusedNodeId = workbenchEvidence.payload.evidence.nodeIds[0];
    await browser.click(`[data-testid="task-evidence-open-graph"][data-node-id="${focusedNodeId}"]`);
    await browser.waitFor(
      "document.querySelector('[aria-label=\"项目图谱\"]') !== null",
      "Graph surface",
      30_000,
    );
    await browser.waitFor(
      `(() => {
        const expected = ${JSON.stringify(focusedNodeId)};
        return new URL(location.href).searchParams.get('focus') === expected
          && [...document.querySelectorAll('[data-graph-node-id]')]
            .some((node) => node.getAttribute('data-graph-node-id') === expected && node.getAttribute('data-selected') === 'true');
      })()`,
      "exact Evidence Graph node focus",
      30_000,
    );
    await browser.clickText('nav[aria-label="主要界面"] button', "知识库");
    await browser.waitFor(
      "document.querySelector('[aria-label=\"理解项目的五个阶段\"], [aria-label=\"文档正文\"]') !== null",
      "Wiki surface",
      30_000,
    );
    await browser.evaluate(`(() => {
      const explicit = document.querySelector('[data-testid="workbench-back-to-task"]');
      const byText = [...document.querySelectorAll('button, a')]
        .find((candidate) => /Back to Task|返回任务/u.test(candidate.textContent ?? ''));
      const action = explicit ?? byText;
      if (!(action instanceof HTMLElement)) throw new Error('Workbench has no return-to-Task action');
      action.click();
      return true;
    })()`);
    await browser.waitFor(
      `document.querySelector('[data-testid="task-first-workbench"]')?.textContent?.includes(${JSON.stringify(finding.summary)}) === true`,
      "Task context after Graph and Wiki",
      30_000,
    );
    await browser.click(`[data-testid="task-evidence-open"][data-evidence-id="${expectedEvidence.id}"]`);
    await browser.waitFor(
      `document.querySelector('[data-testid="task-evidence-view"][data-evidence-id="${expectedEvidence.id}"]') !== null`,
      "restored finding Evidence context",
    );
    let pinnedPage = new URL(await browser.evaluate("location.href"));
    assert.equal(pinnedPage.pathname, "/workbench");
    assert.equal(pinnedPage.searchParams.get("taskId"), taskId);
    assert.equal(pinnedPage.searchParams.get("findingId"), finding.id);
    assert.equal(pinnedPage.searchParams.get("evidenceId"), expectedEvidence.id);

    await browser.navigate("about:blank");
    await stopChild(mcp);
    assert.equal(output.stderr.join(""), "");
    mcp = null;

    const upgradedDashboard = await dashboardInventory(path.join(upgradeInstalled.packageRoot, "dist/dashboard"));
    assert.notEqual(
      upgradedDashboard.inventorySha256,
      initialManagedDashboard.inventorySha256,
      "the real v2 candidate must carry different Dashboard bytes",
    );
    assert.equal(
      (await realpath(upgradeInstalled.cliBin)).startsWith(`${await realpath(upgradeInstalled.packageRoot)}${path.sep}`),
      true,
      "upgrade must execute the CLI installed from the real v2 candidate tgz",
    );
    const upgraded = await runCliJson(
      upgradeInstalled.cliBin,
      ["upgrade", "--root", managedInstallRoot, "--host", "codex"],
      upgradeInstallDirectory,
      lifecycleEnv,
    );
    assert.deepEqual(
      {
        ok: upgraded.ok,
        status: upgraded.status,
        fromVersion: upgraded.fromVersion,
        version: upgraded.version,
        rollbackAvailable: upgraded.rollbackAvailable,
      },
      {
        ok: true,
        status: "updated",
        fromVersion: baseVersion,
        version: upgradedVersion,
        rollbackAvailable: true,
      },
    );
    assert.deepEqual(
      await readFile(managedBundle),
      v2Bindings.cliBytes,
      "upgrade must copy the exact CLI bytes from the real v2 tgz",
    );
    assert.deepEqual(
      await readFile(managedNative),
      v2Bindings.nativeBytes,
      "upgrade must copy the exact native bytes named by the v2 release manifest",
    );
    assert.deepEqual(
      await dashboardInventory(managedDashboardRoot),
      upgradedDashboard,
      "upgrade must install the exact v2 Dashboard inventory",
    );
    assert.deepEqual(
      await readFile(managedDashboardManifestPath),
      await readFile(path.join(upgradeInstalled.packageRoot, "dist/dashboard-manifest.json")),
    );
    const upgradedDoctor = await runCliJson(
      managedBundle,
      ["doctor", "--root", managedInstallRoot],
      installDirectory,
      lifecycleEnv,
    );
    assert.deepEqual(
      { ok: upgradedDoctor.ok, status: upgradedDoctor.status, version: upgradedDoctor.version },
      { ok: true, status: "healthy", version: upgradedVersion },
    );

    mcp = spawn(managedWrapper, ["--root", repositoryRoot], {
      cwd: installDirectory,
      env: lifecycleEnv,
      stdio: ["pipe", "pipe", "pipe"],
    });
    output = collectMessages(mcp);
    await initializeMcp(
      mcp,
      output,
      "preview-managed-dashboard-upgrade",
      upgradedVersion,
    );
    let upgradedRequestId = 2;
    const upgradedBrief = await callTool(
      mcp,
      output,
      upgradedRequestId++,
      "get_task_brief",
      { taskId, section: "summary" },
      GetTaskBriefOutputV1Schema,
    );
    assert.equal(upgradedBrief.structuredContent.result.task.taskId, taskId);
    const upgradedWorkbench = await callTool(
      mcp,
      output,
      upgradedRequestId++,
      "open_workbench",
      {
        route: {
          view: "tasks",
          taskId,
          section: "planned_changes",
          findingId: finding.id,
          evidenceId: expectedEvidence.id,
        },
        openBrowser: false,
      },
      OpenWorkbenchOutputV1Schema,
    );
    const upgradedIndexHtml = await readFile(
      path.join(upgradeInstalled.packageRoot, "dist/dashboard/index.html"),
      "utf8",
    );
    const upgradedReactEntry = expectedReactEntry(upgradedIndexHtml);
    const upgradedReactDigest = contentDigest(await readFile(
      path.join(upgradeInstalled.packageRoot, "dist/dashboard", upgradedReactEntry.slice(1)),
    ));
    await browser.navigate(upgradedWorkbench.structuredContent.result.deepLink);
    await browser.waitFor(
      "document.querySelector('[data-testid=\"task-first-workbench\"]') !== null",
      "upgraded managed React Task Workbench",
      30_000,
    );
    await browser.waitFor(bodyContains(finding.summary), "same Task through upgraded Dashboard");
    await browser.waitFor(
      `document.querySelector('meta[name="understand-code-lifecycle-release"][content="${upgradedVersion}"]') !== null`,
      "v2 Dashboard marker",
    );
    assert.ok(
      browser.networkResponses.some((response) => {
        try {
          return new URL(response.url).pathname === upgradedReactEntry && response.status === 200;
        } catch {
          return false;
        }
      }),
      `the upgraded Workbench must load the v2 candidate React entry ${upgradedReactEntry}`,
    );
    assert.equal(
      await browser.evaluate(`fetch(${JSON.stringify(upgradedReactEntry)}, {
        credentials: 'same-origin', cache: 'no-store',
      }).then(async (response) => {
        if (!response.ok) throw new Error('v2 React asset fetch failed: ' + response.status);
        const value = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
        return 'sha256:' + [...new Uint8Array(value)]
          .map((byte) => byte.toString(16).padStart(2, '0')).join('');
      })`),
      upgradedReactDigest,
      "Chrome must receive the exact React bytes installed from the real v2 tgz",
    );
    await assertLifecycleContinuity("v2 candidate");
    await browser.navigate("about:blank");
    await stopChild(mcp);
    assert.equal(output.stderr.join(""), "");
    mcp = null;

    const rolledBack = await runCliJson(
      managedBundle,
      ["rollback", "--root", managedInstallRoot],
      installDirectory,
      lifecycleEnv,
    );
    assert.deepEqual(
      { ok: rolledBack.ok, status: rolledBack.status, version: rolledBack.version },
      { ok: true, status: "rolled_back", version: baseVersion },
    );
    assert.deepEqual(await readFile(managedBundle), initialManagedBundle);
    assert.deepEqual(
      await readFile(managedBundle),
      v1Bindings.cliBytes,
      "rollback must restore the exact CLI bytes from the real v1 tgz",
    );
    assert.deepEqual(
      await readFile(managedNative),
      v1Bindings.nativeBytes,
      "rollback must restore the exact native bytes named by the v1 release manifest",
    );
    assert.deepEqual(
      await readFile(managedDashboardManifestPath),
      initialManagedDashboardManifest,
    );
    assert.deepEqual(
      await readFile(managedManifestPath),
      initialManagedManifestBytes,
      "rollback must restore the exact v1 installation manifest bytes",
    );
    assert.deepEqual(
      await dashboardInventory(managedDashboardRoot),
      initialManagedDashboard,
    );
    for (const [relativePath, expectedBytes] of initialOwnedBytes) {
      assert.deepEqual(
        await readFile(path.join(managedInstallRoot, relativePath)),
        expectedBytes,
        `rollback must restore the exact v1 owned bytes for ${relativePath}`,
      );
    }
    await assert.rejects(stat(rollbackPath), (error) => error?.code === "ENOENT");

    mcp = spawn(managedWrapper, ["--root", repositoryRoot], {
      cwd: installDirectory,
      env: lifecycleEnv,
      stdio: ["pipe", "pipe", "pipe"],
    });
    output = collectMessages(mcp);
    await initializeMcp(mcp, output, "preview-managed-dashboard-rollback", baseVersion);
    requestId = 2;
    const restoredBrief = await callTool(
      mcp,
      output,
      requestId++,
      "get_task_brief",
      { taskId, section: "summary" },
      GetTaskBriefOutputV1Schema,
    );
    assert.equal(restoredBrief.structuredContent.result.task.taskId, taskId);
    const restoredWorkbench = await callTool(
      mcp,
      output,
      requestId++,
      "open_workbench",
      {
        route: {
          view: "tasks",
          taskId,
          section: "planned_changes",
          findingId: finding.id,
          evidenceId: expectedEvidence.id,
        },
        openBrowser: false,
      },
      OpenWorkbenchOutputV1Schema,
    );
    await browser.navigate(restoredWorkbench.structuredContent.result.deepLink);
    await browser.waitFor(
      "document.querySelector('[data-testid=\"task-first-workbench\"]') !== null",
      "rolled-back managed React Task Workbench",
      30_000,
    );
    await browser.waitFor(bodyContains(finding.summary), "same Task after Dashboard rollback");
    assert.equal(
      await browser.evaluate(
        "document.querySelector('meta[name=\"understand-code-lifecycle-release\"]') === null",
      ),
      true,
    );
    assert.equal(
      await browser.evaluate(`fetch(${JSON.stringify(reactEntry)}, {
        credentials: 'same-origin', cache: 'no-store',
      }).then(async (response) => {
        if (!response.ok) throw new Error('v1 rollback React asset fetch failed: ' + response.status);
        const value = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
        return 'sha256:' + [...new Uint8Array(value)]
          .map((byte) => byte.toString(16).padStart(2, '0')).join('');
      })`),
      initialReactDigest,
      "Chrome must receive the exact React bytes restored from the real v1 tgz",
    );
    await assertLifecycleContinuity("v1 rollback");
    pinnedPage = new URL(await browser.evaluate("location.href"));
    assert.equal(pinnedPage.searchParams.get("taskId"), taskId);
    assert.equal(pinnedPage.searchParams.get("findingId"), finding.id);
    assert.equal(pinnedPage.searchParams.get("evidenceId"), expectedEvidence.id);
    const restoredDoctor = await runCliJson(
      managedBundle,
      ["doctor", "--root", managedInstallRoot],
      installDirectory,
      lifecycleEnv,
    );
    assert.deepEqual(
      { ok: restoredDoctor.ok, status: restoredDoctor.status, version: restoredDoctor.version },
      { ok: true, status: "healthy", version: baseVersion },
    );

    await writeFile(
      sourcePath,
      [
        "export function foo() { return 'newer-snapshot'; }",
        "export function bar() { return 'bar-before'; }",
        "",
      ].join("\n"),
      "utf8",
    );
    const staleRefresh = await callTool(mcp, output, requestId++, "refresh_index", {
      mode: "full",
      expectedSourceSnapshotId: changedSnapshotId,
      idempotencyKey: "preview-workbench-browser-stale-refresh",
      actor,
    }, RefreshIndexOutputV1Schema);
    const observedSnapshotId = staleRefresh.structuredContent.meta.sourceSnapshotId;
    assert.notEqual(observedSnapshotId, changedSnapshotId);
    await browser.navigate(pinnedPage.toString());
    await browser.waitFor(
      "document.querySelector('[data-testid=\"task-first-stale\"]') !== null",
      "old Workbench snapshot stale projection",
      30_000,
    );
    const staleProjection = await browser.evaluate(`(() => ({
      url: location.href,
      text: document.querySelector('[data-testid="task-first-stale"]')?.textContent ?? '',
      sourceVisible: document.querySelector('[data-testid="task-evidence-view"] [aria-label="证据源码行"]') !== null,
      graphActionVisible: document.querySelector('[data-testid="task-evidence-open-graph"]') !== null,
      taskOverlayVisible: document.querySelector('[data-testid="task-context-overlay"]') !== null,
    }))()`);
    assert.equal(staleProjection.url, pinnedPage.toString(), "stale reload must preserve the original Task/Finding/Evidence URL");
    assert.match(staleProjection.text, /stale|过期/iu);
    assert.equal(staleProjection.sourceVisible, false, "stale Evidence must hide source bytes");
    assert.equal(staleProjection.graphActionVisible, false, "stale Evidence must hide Graph navigation");
    assert.equal(staleProjection.taskOverlayVisible, false, "stale Task must not render a fresh Graph/Wiki overlay");
    assert.deepEqual(browser.pageErrors, [], "the installed React Workbench must not throw a page exception");
    assert.deepEqual(await readFile(tarballPath), tarballBefore, "the v1 candidate tgz must remain unchanged");
    assert.deepEqual(await readFile(upgradeTarballPath), upgradeTarballBefore, "the v2 candidate tgz must remain unchanged");

    const restoredInstallationManifest = JSON.parse(
      await readFile(managedManifestPath, "utf8"),
    );
    await browser.close();
    browser = null;
    mcp.stdin.end();
    assert.deepEqual(await waitForExit(mcp, "MCP EOF"), [0, null]);
    assert.equal(output.stderr.join(""), "");
    mcp = null;
    const uninstalled = await runCliJson(
      installed.cliBin,
      ["uninstall", "--root", managedInstallRoot],
      installDirectory,
      lifecycleEnv,
    );
    assert.deepEqual(
      { ok: uninstalled.ok, status: uninstalled.status, refusedPaths: uninstalled.refusedPaths },
      { ok: true, status: "removed", refusedPaths: [] },
    );
    for (const file of restoredInstallationManifest.files) {
      await assert.rejects(
        stat(path.join(managedInstallRoot, file.path)),
        (error) => error?.code === "ENOENT",
        `uninstall must remove owned path ${file.path}`,
      );
    }
    for (const ownedMetadataPath of [managedManifestPath, rollbackPath]) {
      await assert.rejects(
        stat(ownedMetadataPath),
        (error) => error?.code === "ENOENT",
      );
    }
    assert.equal(await readFile(sentinelPath, "utf8"), "preserve user bytes\n");
    assert.equal((await stat(tarballPath)).isFile(), true, "logged v1 candidate tgz must exist");
    assert.equal((await stat(upgradeTarballPath)).isFile(), true, "logged v2 candidate tgz must exist");
    console.log(`WORKBENCH_BROWSER_TARBALL ${JSON.stringify({
      path: tarballPath,
      sha256: `sha256:${digest(tarballBefore)}`,
      entryCount,
    })}`);
    console.log(`WORKBENCH_BROWSER_UPGRADE_TARBALL ${JSON.stringify({
      path: upgradeTarballPath,
      sha256: `sha256:${digest(upgradeTarballBefore)}`,
      entryCount: upgradeEntryCount,
    })}`);
    retainLifecycleCandidates = true;
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    await stopChild(mcp);
    if (lifecycleCandidates !== null) {
      await rm(lifecycleCandidates.cloneRoot, { recursive: true, force: true });
      if (!retainLifecycleCandidates) {
        await rm(lifecycleCandidates.parent, { recursive: true, force: true });
      }
    }
    await Promise.all([
      rm(installDirectory, { recursive: true, force: true }),
      rm(upgradeInstallDirectory, { recursive: true, force: true }),
      rm(browserProfile, { recursive: true, force: true }),
      rm(deletionBrowserProfile, { recursive: true, force: true }),
      rm(home, { recursive: true, force: true }),
      ...repositoryRoots.map((root) => rm(root, { recursive: true, force: true })),
    ]);
  }
});
