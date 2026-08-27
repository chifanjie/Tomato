import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  access,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const PROCESS_TIMEOUT_MS = 20_000;
const EXTERNAL_TIMEOUT_MS = 60_000;
const PLUGIN_NAME = "understand-code";
const MARKETPLACE_NAME = "understand-code-alpha";
const NATIVE_TUPLE = `${process.platform}-${process.arch}`;
const LIFECYCLE_V2_VERSION = "0.1.0-preview.2+codex.lifecycle-v2";
const INITIAL_SOURCE = "export function alpha() { return true; }\n";
const HOST_DOCTOR_CHECK_IDS = [
  "host_cli",
  "plugin_registration",
  "plugin_version",
  "plugin_enabled",
  "plugin_mcp",
];
const EXPECTED_TOOL_NAMES = [
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
];
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
const CANDIDATE_MANIFEST_FILE = "understand-code-alpha-candidate.json";
const CANDIDATE_SCHEMA_FILE = "understand-code-alpha-candidate-v1.schema.json";
const CANDIDATE_CHECKSUM_FILE = "SHA256SUMS";

function contentDigest(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function verifiedCandidateSubject(candidateDirectory) {
  assert.equal(
    path.isAbsolute(candidateDirectory) &&
      path.normalize(candidateDirectory) === candidateDirectory,
    true,
    "verified candidate directory must be canonical and absolute",
  );
  const [candidateRoot, candidateMetadata] = await Promise.all([
    realpath(candidateDirectory),
    lstat(candidateDirectory),
  ]);
  assert.equal(candidateRoot, candidateDirectory);
  assert.equal(candidateMetadata.isDirectory(), true);
  assert.equal(candidateMetadata.isSymbolicLink(), false);
  const names = (await readdir(candidateRoot)).sort();
  const tarballs = names.filter((name) => name.endsWith(".tgz"));
  assert.equal(tarballs.length, 1, "verified candidate must contain one tgz");
  assert.deepEqual(
    names,
    [
      CANDIDATE_CHECKSUM_FILE,
      CANDIDATE_MANIFEST_FILE,
      CANDIDATE_SCHEMA_FILE,
      tarballs[0],
    ].sort(),
  );
  const tarballPath = path.join(candidateRoot, tarballs[0]);
  const [tarballMetadata, tarballBytes, manifestBytes, schemaBytes, checksumBytes] =
    await Promise.all([
      lstat(tarballPath),
      readFile(tarballPath),
      readFile(path.join(candidateRoot, CANDIDATE_MANIFEST_FILE)),
      readFile(path.join(candidateRoot, CANDIDATE_SCHEMA_FILE)),
      readFile(path.join(candidateRoot, CANDIDATE_CHECKSUM_FILE)),
    ]);
  assert.equal(tarballMetadata.isFile(), true);
  assert.equal(tarballMetadata.isSymbolicLink(), false);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  assert.equal(manifest.schemaVersion, "understand-code-alpha-candidate-v1");
  assert.equal(manifest.disposition, "unsigned_alpha_candidate");
  assert.equal(manifest.releaseReady, false);
  assert.equal(manifest.package?.name, "@understand-code/preview");
  assert.match(manifest.package?.version ?? "", /^[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}$/u);
  assert.equal(manifest.source?.clean, true);
  assert.match(manifest.source?.commit ?? "", /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u);
  assert.match(manifest.source?.tree ?? "", /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u);
  if (process.env.UNDERSTAND_CODE_EXPECTED_CANDIDATE_COMMIT !== undefined) {
    assert.equal(
      manifest.source.commit,
      process.env.UNDERSTAND_CODE_EXPECTED_CANDIDATE_COMMIT,
    );
  }
  if (process.env.UNDERSTAND_CODE_EXPECTED_CANDIDATE_TREE !== undefined) {
    assert.equal(
      manifest.source.tree,
      process.env.UNDERSTAND_CODE_EXPECTED_CANDIDATE_TREE,
    );
  }
  assert.deepEqual(manifest.subject, {
    file: tarballs[0],
    mediaType: "application/vnd.npm.package+gzip",
    bytes: tarballBytes.byteLength,
    sha256: contentDigest(tarballBytes),
  });
  const checksumLines = [
    [CANDIDATE_MANIFEST_FILE, manifestBytes],
    [CANDIDATE_SCHEMA_FILE, schemaBytes],
    [tarballs[0], tarballBytes],
  ]
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([name, bytes]) => `${contentDigest(bytes).slice("sha256:".length)}  ${name}`);
  assert.deepEqual(
    checksumBytes.toString("utf8").trimEnd().split("\n"),
    checksumLines,
  );
  return { manifest, tarballPath };
}

function execBounded(command, args, options = {}) {
  return execFileAsync(command, args, {
    ...options,
    timeout: options.timeout ?? EXTERNAL_TIMEOUT_MS,
    killSignal: "SIGKILL",
    maxBuffer: 8 * 1024 * 1024,
  });
}

async function isExecutable(candidate) {
  if (!candidate) return false;
  try {
    await access(candidate, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findExecutable(explicit, candidates, name) {
  if (explicit !== undefined) {
    const resolved = path.resolve(explicit);
    assert.equal(
      await isExecutable(resolved),
      true,
      `${name} override must name an executable`,
    );
    return resolved;
  }
  for (const candidate of candidates) {
    if (await isExecutable(candidate)) return realpath(candidate);
  }
  try {
    const located = await execBounded("sh", ["-c", `command -v ${name}`], {
      encoding: "utf8",
      timeout: 5_000,
    });
    const resolved = located.stdout.trim();
    if (await isExecutable(resolved)) return realpath(resolved);
  } catch {
    // The release gate explicitly requires Host CLIs; ordinary package CI may not.
  }
  return null;
}

function cleanHostEnvironment(home, extra = {}) {
  return {
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    TMPDIR: process.env.TMPDIR ?? tmpdir(),
    LANG: process.env.LANG ?? "C.UTF-8",
    HOME: home,
    USERPROFILE: home,
    USER: "understand-code-e2e",
    LOGNAME: "understand-code-e2e",
    XDG_CACHE_HOME: path.join(home, ".cache"),
    XDG_CONFIG_HOME: path.join(home, ".config"),
    XDG_DATA_HOME: path.join(home, ".local/share"),
    CI: "1",
    NO_COLOR: "1",
    DISABLE_AUTOUPDATER: "1",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    ...extra,
  };
}

async function runInstalledHostDoctor({
  installedPackageRoot,
  host,
  version,
  cwd,
  env,
  expectedStatus,
}) {
  const executable = path.join(installedPackageRoot, "dist/understand-code.mjs");
  let stdout;
  let exitCode = 0;
  try {
    stdout = (await execBounded(
      process.execPath,
      [executable, "doctor", "--host", host],
      { cwd, env, encoding: "utf8" },
    )).stdout;
  } catch (error) {
    exitCode = error?.code;
    stdout = error?.stdout;
  }
  assert.equal(
    exitCode,
    expectedStatus === "healthy" ? 0 : 1,
    `${host} Doctor exit code`,
  );
  assert.equal(typeof stdout, "string", `${host} Doctor must emit one JSON result`);
  const result = JSON.parse(stdout);
  assert.deepEqual(
    {
      schemaVersion: result.schemaVersion,
      product: result.product,
      version: result.version,
      readiness: result.readiness,
      releaseReady: result.releaseReady,
      strongWrites: result.strongWrites,
      host: result.host,
      status: result.status,
      ok: result.ok,
    },
    {
      schemaVersion: "understand-code-host-registration-doctor-v1",
      product: "understand-code",
      version,
      readiness: "alpha",
      releaseReady: false,
      strongWrites: "locked",
      host,
      status: expectedStatus,
      ok: expectedStatus === "healthy",
    },
    `${host} Doctor must preserve the Alpha safety envelope`,
  );
  assert.deepEqual(result.checks.map(({ id }) => id), HOST_DOCTOR_CHECK_IDS);
  if (expectedStatus === "healthy") {
    assert.equal(result.hostRegistration, "registered");
    assert.equal(
      result.checks.every(
        ({ status: checkStatus, code }) =>
          checkStatus === "pass" && code === "ok",
      ),
      true,
    );
  } else {
    assert.equal(result.hostRegistration, "not_registered");
    assert.deepEqual(
      result.checks.map(({ status: checkStatus, code }) => ({
        status: checkStatus,
        code,
      })),
      [
        { status: "pass", code: "ok" },
        { status: "fail", code: "plugin_not_registered" },
        { status: "not_checked", code: "not_checked" },
        { status: "not_checked", code: "not_checked" },
        { status: "not_checked", code: "not_checked" },
      ],
    );
  }
  return result;
}

function withTimeout(promise, label, timeoutMs = PROCESS_TIMEOUT_MS) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
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
  child.kill("SIGTERM");
  try {
    await waitForExit(child, "MCP graceful stop", 2_000);
  } catch {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await waitForExit(child, "MCP forced stop", 2_000);
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
      terminalError = new Error(`MCP emitted invalid JSON: ${line}`, {
        cause: error,
      });
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
    const stderrText = stderr.join("");
    terminalError = new Error(
      `MCP exited before the expected response (code=${code}, signal=${signal}, stderr=${JSON.stringify(stderrText)})`,
    );
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

async function callToolResult(child, output, id, name, argumentsValue) {
  writeMessage(child, {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: argumentsValue },
  });
  const message = await output.waitFor(
    (candidate) => candidate.id === id,
    `${name} response`,
  );
  assert.equal(message.jsonrpc, "2.0");
  assert.equal(
    Object.hasOwn(message, "error"),
    false,
    `${name} must return an MCP tool result`,
  );
  return message.result;
}

async function createRepository(root, source = INITIAL_SOURCE) {
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(path.join(root, "src/index.ts"), source);
  const gitEnv = {
    ...repositoryGitEnvironment(),
    GIT_AUTHOR_NAME: "Understand Code Plugin E2E",
    GIT_AUTHOR_EMAIL: "plugin-e2e@example.invalid",
    GIT_COMMITTER_NAME: "Understand Code Plugin E2E",
    GIT_COMMITTER_EMAIL: "plugin-e2e@example.invalid",
  };
  await execBounded("git", ["init", "-q"], { cwd: root, env: gitEnv });
  await execBounded("git", ["add", "src/index.ts"], { cwd: root, env: gitEnv });
  await execBounded("git", ["commit", "-q", "-m", "initial"], {
    cwd: root,
    env: gitEnv,
  });
  return realpath(root);
}

function repositoryGitEnvironment() {
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    if (name.toUpperCase().startsWith("GIT_")) delete environment[name];
  }
  return {
    ...environment,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_TERMINAL_PROMPT: "0",
    LC_ALL: "C",
  };
}

async function repositoryGit(root, args) {
  return execBounded("git", ["-C", root, ...args], {
    env: repositoryGitEnvironment(),
    encoding: "utf8",
  });
}

async function absoluteGitPath(root, name) {
  const value = (await repositoryGit(
    root,
    ["rev-parse", "--path-format=absolute", "--git-path", name],
  )).stdout.trim();
  assert.equal(path.isAbsolute(value), true, `Git ${name} path must be absolute`);
  assert.doesNotMatch(value, /[\u0000\r\n]/u);
  return realpath(value);
}

async function createLinkedWorktree(primaryRoot, linkedRoot) {
  await repositoryGit(
    primaryRoot,
    ["worktree", "add", "--detach", linkedRoot, "HEAD"],
  );
  return realpath(linkedRoot);
}

async function resolveMcpServer(installedRoot, host) {
  const config = JSON.parse(
    await readFile(path.join(installedRoot, ".mcp.json"), "utf8"),
  );
  assert.equal(
    Object.hasOwn(config, "mcpServers"),
    false,
    "plugin MCP config must use the official direct server map",
  );
  assert.equal(
    Object.hasOwn(config, "mcp_servers"),
    false,
    "plugin MCP config must use the official direct server map",
  );
  assert.deepEqual(Object.keys(config), [PLUGIN_NAME]);
  const server = config[PLUGIN_NAME];
  assert.equal(typeof server, "object");
  assert.deepEqual(server.args, ["--host", host]);
  let command = server.command;
  if (host === "claude") {
    assert.match(
      command,
      /^\$\{CLAUDE_PLUGIN_ROOT\}\/[A-Za-z0-9_./-]+$/u,
    );
    command = command.replace("${CLAUDE_PLUGIN_ROOT}", installedRoot);
  } else {
    assert.match(
      command,
      /^\.\/[A-Za-z0-9_./-]+$/u,
      "Codex bundled command must be plugin-root relative",
    );
  }
  assert.doesNotMatch(
    command,
    /\$\{[^}]+\}/u,
    "bundled MCP command must not retain an unknown Host placeholder",
  );
  const executable = await realpath(path.resolve(installedRoot, command));
  const canonicalRoot = `${await realpath(installedRoot)}${path.sep}`;
  assert.equal(
    executable.startsWith(canonicalRoot),
    true,
    "bundled command must resolve inside the installed cache root",
  );
  assert.equal((await stat(executable)).isFile(), true);
  await access(executable, fsConstants.X_OK);
  return { executable, args: server.args ?? [] };
}

async function withInstalledMcp(
  { host, installedRoot, version, repositoryRoot, cwd, env, clientName },
  exercise,
) {
  const server = await resolveMcpServer(installedRoot, host);
  const child = spawn(server.executable, server.args, {
    cwd,
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const output = collectMessages(child);
  try {
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
    const initialized = await output.waitFor(
      (message) => message.id === 1,
      `${clientName} initialize`,
    );
    assert.equal(initialized.result.serverInfo.name, "understand-code");
    assert.equal(initialized.result.serverInfo.version, version);
    writeMessage(child, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });
    const listed = await output.waitFor(
      (message) => message.id === 2,
      `${clientName} tools/list`,
    );
    assert.equal(Object.hasOwn(listed, "error"), false);
    assert.deepEqual(
      listed.result.tools.map((tool) => tool.name),
      EXPECTED_TOOL_NAMES,
    );
    assert.equal(await realpath(repositoryRoot), repositoryRoot);
    const result = await exercise({ child, output, server });
    child.stdin.end();
    assert.deepEqual(
      await waitForExit(child, `${clientName} clean exit`),
      [0, null],
    );
    assert.equal(output.stderr.join(""), "");
    return { server, result };
  } finally {
    await stopChild(child);
  }
}

async function recursiveByteInventory(root) {
  const inventory = [];
  async function visit(directory, relativeDirectory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0
    );
    for (const entry of entries) {
      const relativePath = relativeDirectory === ""
        ? entry.name
        : `${relativeDirectory}/${entry.name}`;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        inventory.push({
          relativePath,
          type: "directory",
          bytes: null,
          contentDigest: null,
        });
        await visit(absolutePath, relativePath);
        continue;
      }
      assert.equal(
        entry.isFile(),
        true,
        `managed artifact inventory rejects ${relativePath}`,
      );
      const bytes = await readFile(absolutePath);
      inventory.push({
        relativePath,
        type: "file",
        bytes: bytes.length,
        contentDigest: contentDigest(bytes),
      });
    }
  }
  await visit(root, "");
  return inventory;
}

async function snapshotManagedArtifactTree(repositoryRoot) {
  const artifactRoot = path.join(repositoryRoot, ".understand-code");
  let metadata;
  try {
    metadata = await stat(artifactRoot);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  assert.equal(metadata.isDirectory(), true, "managed artifact root must be a directory");
  return recursiveByteInventory(artifactRoot);
}

async function exerciseInstalledMutationLocks(options) {
  const { repositoryRoot, clientName, expectedIndexPath } = options;
  const sourcePath = path.join(repositoryRoot, "src/index.ts");
  const indexPath = await absoluteGitPath(repositoryRoot, "index");
  assert.equal(
    indexPath,
    expectedIndexPath,
    "the installed plugin must use the pre-audited linked-worktree index",
  );
  const [sourceBefore, indexBefore, artifactTreeBefore] = await Promise.all([
    readFile(sourcePath),
    readFile(indexPath),
    snapshotManagedArtifactTree(repositoryRoot),
  ]);
  const execution = await withInstalledMcp(
    options,
    async ({ child, output }) => {
      const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
      const snapshotId = `snapshot:${clientName}:strong-store-unavailable`;
      const baselineSnapshotId =
        `snapshot:${clientName}:rebase-baseline-strong-store-unavailable`;
      const publicMutations = [
        {
          name: "refresh_index",
          arguments: {
            mode: "full",
            idempotencyKey: `${clientName}-refresh-locked`,
            actor: `agent:${clientName}`,
          },
        },
        {
          name: "build_task_brief",
          arguments: {
            task: "Prepare an installed plugin mutation that must remain locked.",
            expectedRevision: 0,
            idempotencyKey: `${clientName}-build-locked`,
            actor: `agent:${clientName}`,
            scope: ["src/index.ts"],
          },
        },
        {
          name: "update_task",
          arguments: {
            taskId,
            action: { type: "transition_status", to: "planned" },
            expectedRevision: 0,
            idempotencyKey: `${clientName}-update-locked`,
            actor: `agent:${clientName}`,
          },
        },
        {
          label: "update_task refresh_task_context",
          name: "update_task",
          arguments: {
            taskId,
            action: {
              type: "refresh_task_context",
              targetSnapshotId: snapshotId,
            },
            expectedRevision: 0,
            idempotencyKey: `${clientName}-context-refresh-locked`,
            actor: `agent:${clientName}`,
          },
        },
        {
          label: "update_task rebase_task",
          name: "update_task",
          arguments: {
            taskId,
            action: {
              type: "rebase_task",
              targetSnapshotId: snapshotId,
              newBaselineSnapshotId: baselineSnapshotId,
              reason: "Strong Store authority is unavailable.",
            },
            expectedRevision: 0,
            idempotencyKey: `${clientName}-context-rebase-locked`,
            actor: `agent:${clientName}`,
          },
        },
        {
          name: "check_change",
          arguments: {
            taskId,
            actualSnapshotId: snapshotId,
            includeWorktree: true,
            expectedRevision: 0,
            idempotencyKey: `${clientName}-check-locked`,
            actor: `agent:${clientName}`,
          },
        },
        {
          name: "record_verification",
          arguments: {
            taskId,
            record: {
              verificationPlanEntryId: `verification-plan:${clientName}:locked`,
              kind: "manual",
              status: "blocked",
              summary: "Strong Store authority is unavailable.",
              claimIds: [],
              snapshotId,
            },
            expectedRevision: 0,
            idempotencyKey: `${clientName}-verification-locked`,
            actor: `agent:${clientName}`,
          },
        },
      ];
      let requestId = 3;
      for (const mutation of publicMutations) {
        const mutationLabel = mutation.label ?? mutation.name;
        const [mutationSourceBefore, mutationIndexBefore, mutationTreeBefore] =
          await Promise.all([
            readFile(sourcePath),
            readFile(indexPath),
            snapshotManagedArtifactTree(repositoryRoot),
          ]);
        const failure = await callToolResult(
          child,
          output,
          requestId++,
          mutation.name,
          mutation.arguments,
        );
        assert.deepEqual(
          failure,
          EXPECTED_PUBLIC_MUTATION_FAILURE,
          `${mutationLabel} must remain locked behind the unavailable strong Store`,
        );
        assert.deepEqual(
          await readFile(sourcePath),
          mutationSourceBefore,
          `${mutationLabel} must not mutate source bytes`,
        );
        assert.deepEqual(
          await readFile(indexPath),
          mutationIndexBefore,
          `${mutationLabel} must not mutate Git index bytes`,
        );
        assert.deepEqual(
          await snapshotManagedArtifactTree(repositoryRoot),
          mutationTreeBefore,
          `${mutationLabel} must leave the managed artifact tree byte-identical`,
        );
      }
    },
  );
  assert.deepEqual(
    await readFile(sourcePath),
    sourceBefore,
    "failed public mutations must not mutate source bytes",
  );
  assert.deepEqual(
    await readFile(indexPath),
    indexBefore,
    "failed public mutations must not mutate Git index bytes",
  );
  assert.deepEqual(
    await snapshotManagedArtifactTree(repositoryRoot),
    artifactTreeBefore,
    "failed public mutations must leave the managed artifact tree byte-identical",
  );
  return execution;
}

async function expectCacheBindingFailure({
  server,
  version,
  cwd,
  env,
  clientName,
  reason,
  artifactRoots,
}) {
  const child = spawn(server.executable, server.args, {
    cwd,
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const output = collectMessages(child);
  const expectedFailure = {
    isError: true,
    content: [{ type: "text", text: "Workspace binding is required." }],
    structuredContent: {
      error: {
        schemaVersion: 1,
        code: "workspace_binding_required",
        details: { reason },
      },
    },
  };
  try {
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
    const initialized = await output.waitFor(
      (message) => message.id === 1,
      `${clientName} binding-error initialize`,
    );
    assert.equal(initialized.result.serverInfo.name, "understand-code");
    assert.equal(initialized.result.serverInfo.version, version);
    writeMessage(child, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });
    const listed = await output.waitFor(
      (message) => message.id === 2,
      `${clientName} binding-error tools/list`,
    );
    assert.equal(Object.hasOwn(listed, "error"), false);
    assert.deepEqual(
      listed.result.tools.map((tool) => tool.name),
      EXPECTED_TOOL_NAMES,
    );
    const pulseFailure = await callToolResult(
      child,
      output,
      3,
      "get_repo_pulse",
      {},
    );
    assert.deepEqual(pulseFailure, expectedFailure);
    child.stdin.end();
    assert.deepEqual(
      await waitForExit(child, `${clientName} binding-error clean exit`),
      [0, null],
    );
    assert.equal(output.stderr.join(""), "");
    for (const artifactRoot of artifactRoots) {
      await assertMissing(
        path.join(artifactRoot, ".understand-code"),
        `${clientName} binding-error session must not create repository artifacts`,
      );
    }
  } finally {
    await stopChild(child);
  }
}

async function expectUnsafeWrapperRootFailure(server, cwd, env, label) {
  const child = spawn(server.executable, server.args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = [];
  const stderr = [];
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  try {
    assert.deepEqual(await waitForExit(child, label, 5_000), [2, null]);
    assert.equal(stdout.join(""), "");
    assert.equal(stderr.join(""), "workspace_root_required\n");
  } finally {
    await stopChild(child);
  }
}

async function findClaudeInstalledRoot(claudeConfig, version) {
  const cacheRoot = path.join(claudeConfig, "plugins/cache");
  const candidates = [];
  async function visit(directory, depth) {
    if (depth > 6) return;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const child = path.join(directory, entry.name);
      const manifestPath = path.join(child, ".claude-plugin/plugin.json");
      try {
        const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
        if (manifest.name === PLUGIN_NAME && manifest.version === version) {
          candidates.push(child);
        }
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      await visit(child, depth + 1);
    }
  }
  await visit(cacheRoot, 0);
  assert.equal(
    candidates.length,
    1,
    "Claude CLI must install exactly one versioned plugin cache root",
  );
  return realpath(candidates[0]);
}

async function writeJson(target, value) {
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function requiredStep16EvidencePath() {
  const value = process.env.UNDERSTAND_CODE_STEP16_EVIDENCE_PATH;
  assert.equal(
    typeof value === "string" &&
      path.isAbsolute(value) &&
      !/[\u0000-\u001f\u007f]/u.test(value),
    true,
    "UNDERSTAND_CODE_STEP16_EVIDENCE_PATH must be an absolute safe path",
  );
  return value;
}

async function updateJson(target, update) {
  const value = JSON.parse(await readFile(target, "utf8"));
  update(value);
  await writeJson(target, value);
}

async function fileSha256(target) {
  return contentDigest(await readFile(target));
}

function releasePluginRoot(releaseRoot, host) {
  return path.join(releaseRoot, "dist/plugin-roots", host);
}

async function assertReleaseVersion(releaseRoot, version) {
  const topLevelCli = path.join(releaseRoot, "dist/understand-code.mjs");
  const topLevelNative = path.join(
    releaseRoot,
    `dist/native/${NATIVE_TUPLE}/provider_kernel_peer.node`,
  );
  const hostCliPaths = ["codex", "claude"].map((host) =>
    path.join(
      releasePluginRoot(releaseRoot, host),
      "plugins/understand-code/bin/understand-code.mjs",
    )
  );
  for (const hostCliPath of hostCliPaths) {
    assert.deepEqual(
      await readFile(hostCliPath),
      await readFile(topLevelCli),
      "both Host plugin payloads must embed the exact release CLI bytes",
    );
  }
  for (const host of ["codex", "claude"]) {
    assert.deepEqual(
      await readFile(path.join(
        releasePluginRoot(releaseRoot, host),
        `plugins/understand-code/bin/native/${NATIVE_TUPLE}/provider_kernel_peer.node`,
      )),
      await readFile(topLevelNative),
      "both Host plugin payloads must embed the exact release native peer bytes",
    );
  }
  const codexManifest = JSON.parse(await readFile(
    path.join(
      releasePluginRoot(releaseRoot, "codex"),
      "plugins/understand-code/.codex-plugin/plugin.json",
    ),
    "utf8",
  ));
  const claudeManifest = JSON.parse(await readFile(
    path.join(
      releasePluginRoot(releaseRoot, "claude"),
      "plugins/understand-code/.claude-plugin/plugin.json",
    ),
    "utf8",
  ));
  const claudeMarketplace = JSON.parse(await readFile(
    path.join(
      releasePluginRoot(releaseRoot, "claude"),
      ".claude-plugin/marketplace.json",
    ),
    "utf8",
  ));
  assert.equal(codexManifest.version, version);
  assert.equal(claudeManifest.version, version);
  assert.equal(claudeMarketplace.plugins[0].version, version);
  for (const manifestPath of [
    path.join(releaseRoot, "dist/dashboard-manifest.json"),
    ...["codex", "claude"].map((host) =>
      path.join(
        releasePluginRoot(releaseRoot, host),
        "plugins/understand-code/bin/dashboard-manifest.json",
      )
    ),
  ]) {
    assert.equal(
      JSON.parse(await readFile(manifestPath, "utf8")).productVersion,
      version,
    );
  }
  const versionResult = await execBounded(
    process.execPath,
    [topLevelCli, "--version"],
    { encoding: "utf8" },
  );
  assert.equal(versionResult.stdout, `${version}\n`);
  assert.equal(versionResult.stderr, "");
  return {
    topLevelCli,
    cliSha256: await fileSha256(topLevelCli),
  };
}

async function createLifecycleReleases(
  installedPackageRoot,
  releasesRoot,
  v1Version,
) {
  const v1Root = path.join(releasesRoot, "v1");
  const v2Root = path.join(releasesRoot, "v2");
  await cp(installedPackageRoot, v1Root, { recursive: true });
  await cp(v1Root, v2Root, { recursive: true });

  const v2Cli = path.join(v2Root, "dist/understand-code.mjs");
  await execBounded(
    process.execPath,
    [
      path.resolve(packageRoot, "../cli/scripts/build-bundle.mjs"),
      "--output",
      v2Cli,
      "--product-version",
      LIFECYCLE_V2_VERSION,
    ],
    { cwd: packageRoot, encoding: "utf8", timeout: 120_000 },
  );
  for (const host of ["codex", "claude"]) {
    await cp(
      v2Cli,
      path.join(
        releasePluginRoot(v2Root, host),
        "plugins/understand-code/bin/understand-code.mjs",
      ),
    );
  }
  await updateJson(path.join(v2Root, "package.json"), (manifest) => {
    manifest.version = LIFECYCLE_V2_VERSION;
  });
  await updateJson(
    path.join(
      releasePluginRoot(v2Root, "codex"),
      "plugins/understand-code/.codex-plugin/plugin.json",
    ),
    (manifest) => {
      manifest.version = LIFECYCLE_V2_VERSION;
    },
  );
  await updateJson(
    path.join(
      releasePluginRoot(v2Root, "claude"),
      "plugins/understand-code/.claude-plugin/plugin.json",
    ),
    (manifest) => {
      manifest.version = LIFECYCLE_V2_VERSION;
    },
  );
  await updateJson(
    path.join(
      releasePluginRoot(v2Root, "claude"),
      ".claude-plugin/marketplace.json",
    ),
    (marketplace) => {
      marketplace.plugins[0].version = LIFECYCLE_V2_VERSION;
    },
  );
  for (const manifestPath of [
    path.join(v2Root, "dist/dashboard-manifest.json"),
    ...["codex", "claude"].map((host) =>
      path.join(
        releasePluginRoot(v2Root, host),
        "plugins/understand-code/bin/dashboard-manifest.json",
      )
    ),
  ]) {
    await updateJson(manifestPath, (manifest) => {
      manifest.productVersion = LIFECYCLE_V2_VERSION;
    });
  }

  const v1 = {
    root: v1Root,
    version: v1Version,
    ...(await assertReleaseVersion(v1Root, v1Version)),
  };
  const v2 = {
    root: v2Root,
    version: LIFECYCLE_V2_VERSION,
    ...(await assertReleaseVersion(v2Root, LIFECYCLE_V2_VERSION)),
  };
  assert.notEqual(
    v2.cliSha256,
    v1.cliSha256,
    "v2 must contain genuinely version-distinct CLI bytes",
  );
  for (const host of ["codex", "claude"]) {
    const manifest = host === "codex"
      ? "plugins/understand-code/.codex-plugin/plugin.json"
      : "plugins/understand-code/.claude-plugin/plugin.json";
    for (const relativePath of [
      manifest,
      "plugins/understand-code/.mcp.json",
      "plugins/understand-code/bin/understand-code.mjs",
      `plugins/understand-code/bin/native/${NATIVE_TUPLE}/provider_kernel_peer.node`,
    ]) {
      assert.deepEqual(
        await readFile(path.join(releasePluginRoot(v1Root, host), relativePath)),
        await readFile(
          path.join(releasePluginRoot(installedPackageRoot, host), relativePath),
        ),
        `v1 ${host} ${relativePath} must be the exact tgz plugin payload`,
      );
    }
  }
  return { v1, v2 };
}

async function activateMarketplaceFacade(facadeRoot, release) {
  for (const host of ["codex", "claude"]) {
    const target = path.join(facadeRoot, host);
    await rm(target, { recursive: true, force: true });
    await cp(releasePluginRoot(release.root, host), target, { recursive: true });
  }
}

async function activeCodexPlugin(codexCli, cwd, env, version) {
  const value = JSON.parse((await execBounded(
    codexCli,
    ["plugin", "list", "--json"],
    { cwd, env, encoding: "utf8" },
  )).stdout);
  assert.equal(Array.isArray(value.installed), true);
  const entries = value.installed.filter(
    (entry) => entry.pluginId === `${PLUGIN_NAME}@${MARKETPLACE_NAME}`,
  );
  assert.equal(
    entries.length,
    1,
    "Codex plugin list must expose one canonical active installation",
  );
  const entry = entries[0];
  assert.deepEqual(
    { version: entry.version, installed: entry.installed, enabled: entry.enabled },
    { version, installed: true, enabled: true },
  );
  return entry;
}

async function activeClaudePlugin(claudeCli, cwd, env, version) {
  const value = JSON.parse((await execBounded(
    claudeCli,
    ["plugin", "list", "--json"],
    { cwd, env, encoding: "utf8" },
  )).stdout);
  assert.equal(Array.isArray(value), true);
  const entries = value.filter(
    (entry) => entry.id === `${PLUGIN_NAME}@${MARKETPLACE_NAME}`,
  );
  assert.equal(
    entries.length,
    1,
    "Claude plugin list must expose one canonical active installation",
  );
  const entry = entries[0];
  assert.deepEqual(
    { version: entry.version, scope: entry.scope, enabled: entry.enabled },
    { version, scope: "user", enabled: true },
  );
  assert.equal(typeof entry.installPath, "string");
  return {
    entry,
    installedRoot: await realpath(entry.installPath),
  };
}

async function assertMissing(target, label) {
  await assert.rejects(
    access(target),
    (error) => error?.code === "ENOENT",
    label,
  );
}

async function installPluginHostActivation({
  installedRoot,
  host,
  providerInstallationRoot,
  version,
  cwd,
  env,
}) {
  const installedCli = path.join(installedRoot, "bin/understand-code.mjs");
  const activationRoot = path.join(installedRoot, ".understand-code-host");
  const result = JSON.parse((await execBounded(
    process.execPath,
    [
      installedCli,
      "install",
      "--root",
      activationRoot,
      "--host",
      host,
      "--provider-installation-root",
      providerInstallationRoot,
    ],
    { cwd, env, encoding: "utf8" },
  )).stdout);
  assert.equal(result.ok, true, `${host} activation install must succeed`);
  assert.match(
    result.status,
    /^(?:installed|already_installed|updated)$/u,
    `${host} activation install must converge`,
  );
  const manifest = JSON.parse(await readFile(
    path.join(activationRoot, "installation-manifest.json"),
    "utf8",
  ));
  assert.deepEqual(
    {
      version: manifest.version,
      root: manifest.root,
      host: manifest.host,
      providerInstallationRoot: manifest.providerInstallationRoot,
    },
    { version, root: activationRoot, host, providerInstallationRoot },
    `${host} activation must bind the installed cache to the selected Provider`,
  );
  return activationRoot;
}

test(
  "marketplace wrapper binds Provider only through its fixed owned activation",
  async () => {
    const sandbox = await realpath(
      await mkdtemp(path.join(tmpdir(), "understand-code-plugin-activation-")),
    );
    try {
      const poisonBin = path.join(sandbox, "poison-bin");
      const poisonGitMarker = path.join(sandbox, "ambient-git-was-used");
      await mkdir(poisonBin);
      await writeFile(
        path.join(poisonBin, "git"),
        '#!/bin/sh\ntouch "$POISON_GIT_MARKER"\nexit 99\n',
        { mode: 0o755 },
      );
      const { sanitizeEnvironment } = await import(
        "../src/codex-plugin-bin.mjs"
      );
      const sanitized = sanitizeEnvironment({
        PATH: poisonBin,
        NODE_OPTIONS: "--require=/ambient/node-loader.cjs",
        NODE_PATH: "/ambient/node-path",
        LD_PRELOAD: "/ambient/ld-preload.so",
        DYLD_INSERT_LIBRARIES: "/ambient/dyld-insert.dylib",
        GIT_CONFIG_GLOBAL: "/ambient/gitconfig",
        UNDERSTAND_CODE_HOST_INSTALLATION_ROOT: "/ambient/install-root",
      });
      for (const name of [
        "NODE_OPTIONS",
        "NODE_PATH",
        "LD_PRELOAD",
        "DYLD_INSERT_LIBRARIES",
        "GIT_CONFIG_GLOBAL",
        "UNDERSTAND_CODE_HOST_INSTALLATION_ROOT",
      ]) {
        assert.equal(Object.hasOwn(sanitized, name), false, `${name} must be removed`);
      }
      assert.equal(sanitized.PATH.includes(poisonBin), false);

      const sourcePluginRoot = path.join(
        packageRoot,
        "dist/plugin-roots/codex/plugins/understand-code",
      );
      const installedRoot = path.join(sandbox, "codex-installed-plugin");
      await cp(sourcePluginRoot, installedRoot, { recursive: true });
      const installedCli = path.join(
        installedRoot,
        "bin/understand-code.mjs",
      );
      const activationRoot = path.join(
        installedRoot,
        ".understand-code-host",
      );
      const poisonActivationRoot = path.join(sandbox, "poison-activation");
      const providerRoot = path.join(sandbox, "provider");
      const poisonProviderRoot = path.join(sandbox, "poison-provider");
      const repositoryRoot = await createRepository(
        path.join(sandbox, "repository"),
      );
      await Promise.all([
        mkdir(providerRoot),
        mkdir(poisonProviderRoot),
      ]);
      for (const [root, selectedProviderRoot] of [
        [activationRoot, providerRoot],
        [poisonActivationRoot, poisonProviderRoot],
      ]) {
        const installed = JSON.parse((await execBounded(
          process.execPath,
          [
            installedCli,
            "install",
            "--root",
            root,
            "--host",
            "codex",
            "--provider-installation-root",
            selectedProviderRoot,
          ],
          { cwd: sandbox, encoding: "utf8" },
        )).stdout);
        assert.deepEqual(
          { ok: installed.ok, status: installed.status },
          { ok: true, status: "installed" },
        );
      }

      const packageVersion = JSON.parse(
        await readFile(path.join(packageRoot, "package.json"), "utf8"),
      ).version;
      const poisonedEnvironment = cleanHostEnvironment(
        path.join(sandbox, "home"),
        {
          PATH: `${path.dirname(await realpath(process.execPath))}${path.delimiter}${poisonBin}`,
          NODE_OPTIONS: "--no-warnings",
          NODE_PATH: path.join(sandbox, "poison-node-path"),
          GIT_CONFIG_GLOBAL: path.join(sandbox, "poison-gitconfig"),
          POISON_GIT_MARKER: poisonGitMarker,
          UNDERSTAND_CODE_CLI: path.join(sandbox, "poison-cli"),
          UNDERSTAND_CODE_HOME: path.join(sandbox, "poison-home"),
          UNDERSTAND_CODE_HOST_INSTALLATION_ROOT: poisonActivationRoot,
          UNDERSTAND_CODE_INSTALL_ROOT: poisonActivationRoot,
          UNDERSTAND_CODE_PROVIDER_INSTALLATION_ROOT: poisonProviderRoot,
        },
      );
      const successful = await withInstalledMcp(
        {
          host: "codex",
          installedRoot,
          version: packageVersion,
          repositoryRoot,
          cwd: repositoryRoot,
          env: poisonedEnvironment,
          clientName: "codex-fixed-provider-activation",
        },
        async () => "initialized",
      );
      assert.equal(successful.result, "initialized");
      await assert.rejects(access(poisonGitMarker), { code: "ENOENT" });

      const activationConfigPath = path.join(
        activationRoot,
        "config/mcp.json",
      );
      const activationConfigBytes = await readFile(activationConfigPath);
      const activationConfig = JSON.parse(
        activationConfigBytes.toString("utf8"),
      );
      const server = await resolveMcpServer(installedRoot, "codex");
      const assertActivationRejected = async (label) => {
        const child = spawn(server.executable, server.args, {
          cwd: repositoryRoot,
          env: poisonedEnvironment,
          stdio: ["ignore", "pipe", "pipe"],
        });
        const stdout = [];
        const stderr = [];
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk) => stdout.push(chunk));
        child.stderr.on("data", (chunk) => stderr.push(chunk));
        assert.deepEqual(await waitForExit(child, label, 10_000), [1, null]);
        assert.equal(stdout.join(""), "");
        assert.equal(
          stderr.join(""),
          "understand-code: internal_error\n",
        );
      };

      activationConfig.providerInstallationRoot = poisonProviderRoot;
      await writeJson(activationConfigPath, activationConfig);
      await assertActivationRejected("tampered fixed activation config");
      await writeFile(activationConfigPath, activationConfigBytes);

      const activationManifestPath = path.join(
        activationRoot,
        "installation-manifest.json",
      );
      const activationManifest = JSON.parse(
        await readFile(activationManifestPath, "utf8"),
      );
      activationManifest.providerInstallationRoot = poisonProviderRoot;
      await writeJson(activationManifestPath, activationManifest);
      await assertActivationRejected("tampered fixed activation manifest");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  },
);

test(
  "real Codex and Claude plugin lifecycles preserve the public strong-writer lock",
  async (t) => {
    const originalHome = process.env.HOME ?? "";
    const codexCli = await findExecutable(
      process.env.UNDERSTAND_CODE_CODEX_CLI,
      [
        "/Applications/ChatGPT.app/Contents/Resources/codex",
        path.join(originalHome, ".local/bin/codex"),
      ],
      "codex",
    );
    const claudeCli = await findExecutable(
      process.env.UNDERSTAND_CODE_CLAUDE_CLI,
      [path.join(originalHome, ".local/bin/claude")],
      "claude",
    );
    if (codexCli === null || claudeCli === null) {
      const message =
        `real Host CLIs unavailable (codex=${codexCli !== null}, claude=${claudeCli !== null})`;
      if (process.env.UNDERSTAND_CODE_REQUIRE_PLUGIN_HOSTS === "1") {
        assert.fail(message);
      }
      t.skip(message);
      return;
    }

    const sandbox = await realpath(
      await mkdtemp(path.join(tmpdir(), "understand-code-plugin-e2e-")),
    );
    const packDirectory = path.join(sandbox, "pack");
    const installDirectory = path.join(sandbox, "npm-prefix");
    const codexHome = path.join(sandbox, "codex-home");
    const codexUserHome = path.join(sandbox, "codex-user");
    const claudeConfig = path.join(sandbox, "claude-config");
    const claudeUserHome = path.join(sandbox, "claude-user");
    const releasesRoot = path.join(sandbox, "releases");
    const marketplaceFacadeRoot = path.join(sandbox, "marketplace-facade");
    const differentCwd = path.join(sandbox, "not-the-repository");
    const unavailableProviderRoot = path.join(sandbox, "provider-unavailable");
    let codexInstalledRoot = null;
    let claudeInstalledRoot = null;
    let step16Evidence = null;
    try {
      const primaryRepositoryRoot = await createRepository(
        path.join(sandbox, "主仓库 primary with space"),
      );
      const repositoryRoot = await createLinkedWorktree(
        primaryRepositoryRoot,
        path.join(sandbox, "链接工作树 linked with space"),
      );
      const nestedCwd = path.join(repositoryRoot, "src", "嵌套 目录");
      await mkdir(nestedCwd, { recursive: true });
      assert.equal(await realpath(nestedCwd), nestedCwd);
      for (const candidate of [
        primaryRepositoryRoot,
        repositoryRoot,
        nestedCwd,
      ]) {
        assert.match(candidate, / /u, "Root fixture must retain a path-space boundary");
        assert.match(
          candidate,
          /\p{Script=Han}/u,
          "Root fixture must retain a Chinese path boundary",
        );
      }
      assert.equal((await stat(path.join(repositoryRoot, ".git"))).isFile(), true);
      assert.equal(
        await realpath((await repositoryGit(
          repositoryRoot,
          ["rev-parse", "--show-toplevel"],
        )).stdout.trim()),
        repositoryRoot,
      );
      assert.equal(
        (await repositoryGit(
          repositoryRoot,
          ["rev-parse", "--abbrev-ref", "HEAD"],
        )).stdout.trim(),
        "HEAD",
        "Root fixture must be a detached linked worktree",
      );
      const primarySourcePath = path.join(primaryRepositoryRoot, "src/index.ts");
      const linkedSourcePath = path.join(repositoryRoot, "src/index.ts");
      const primaryIndexPath = await absoluteGitPath(primaryRepositoryRoot, "index");
      const linkedIndexPath = await absoluteGitPath(repositoryRoot, "index");
      assert.notEqual(linkedIndexPath, primaryIndexPath);
      const [
        primarySourceBefore,
        primaryIndexBefore,
        linkedSourceBefore,
        linkedIndexBefore,
      ] = await Promise.all([
        readFile(primarySourcePath),
        readFile(primaryIndexPath),
        readFile(linkedSourcePath),
        readFile(linkedIndexPath),
      ]);
      const ambientRepositoryRoot = await createRepository(
        path.join(sandbox, "ambient-repository"),
        "export function ambient() { return 'poison-authority'; }\n",
      );
      const ambientIndexPath = await absoluteGitPath(
        ambientRepositoryRoot,
        "index",
      );
      assert.notEqual(
        contentDigest(await readFile(ambientIndexPath)),
        contentDigest(await readFile(linkedIndexPath)),
        "poisoned ambient repository must have unrelated index bytes",
      );
      const ambientObjectsPath = path.join(
        ambientRepositoryRoot,
        ".git",
        "objects",
      );
      const poisonGitAuthority = Object.freeze({
        GIT_DIR: path.join(ambientRepositoryRoot, ".git"),
        GIT_WORK_TREE: ambientRepositoryRoot,
        GIT_COMMON_DIR: path.join(ambientRepositoryRoot, ".git"),
        GIT_INDEX_FILE: ambientIndexPath,
        GIT_OBJECT_DIRECTORY: ambientObjectsPath,
        GIT_ALTERNATE_OBJECT_DIRECTORIES: ambientObjectsPath,
      });
      await Promise.all([
        mkdir(packDirectory, { recursive: true }),
        mkdir(installDirectory, { recursive: true }),
        mkdir(codexHome, { recursive: true }),
        mkdir(codexUserHome, { recursive: true }),
        mkdir(claudeConfig, { recursive: true }),
        mkdir(claudeUserHome, { recursive: true }),
        mkdir(releasesRoot, { recursive: true }),
        mkdir(marketplaceFacadeRoot, { recursive: true }),
        mkdir(differentCwd, { recursive: true }),
        mkdir(unavailableProviderRoot, { recursive: true }),
      ]);
      const activationProviderRoot =
        process.env.RUN_STEP16_DUAL_HOST_E2E === "1"
          ? process.env.UNDERSTAND_CODE_STEP16_PROVIDER_INSTALLATION_ROOT
          : unavailableProviderRoot;
      assert.equal(
        typeof activationProviderRoot === "string" &&
          path.isAbsolute(activationProviderRoot) &&
          !/[\u0000-\u001f\u007f]/u.test(activationProviderRoot),
        true,
        "plugin activation requires one explicit Provider installation root",
      );
      assert.equal(
        await realpath(activationProviderRoot),
        activationProviderRoot,
        "plugin activation Provider root must be canonical",
      );

      assert.equal(
        process.env.UNDERSTAND_CODE_PREVIEW_TARBALL,
        undefined,
        "arbitrary tarball overrides are forbidden; provide a verified candidate directory",
      );
      let tarballPath;
      let verifiedCandidate = null;
      if (process.env.UNDERSTAND_CODE_PREVIEW_CANDIDATE_DIR !== undefined) {
        verifiedCandidate = await verifiedCandidateSubject(
          process.env.UNDERSTAND_CODE_PREVIEW_CANDIDATE_DIR,
        );
        tarballPath = verifiedCandidate.tarballPath;
      } else {
        assert.notEqual(
          process.env.UNDERSTAND_CODE_REQUIRE_VERIFIED_CANDIDATE,
          "1",
          "the release Surface gate requires the Browser-verified candidate directory",
        );
        const packed = await execBounded(
          "npm",
          [
            "pack",
            ".",
            "--ignore-scripts",
            "--pack-destination",
            packDirectory,
            "--json",
          ],
          { cwd: packageRoot, encoding: "utf8", timeout: 120_000 },
        );
        const records = JSON.parse(packed.stdout);
        assert.equal(records.length, 1);
        tarballPath = path.join(packDirectory, records[0].filename);
      }
      await execBounded(
        "npm",
        [
          "install",
          "--global",
          "--prefix",
          installDirectory,
          "--ignore-scripts",
          "--no-package-lock",
          "--no-audit",
          "--no-fund",
          tarballPath,
        ],
        { cwd: installDirectory, encoding: "utf8", timeout: 120_000 },
      );
      const installedPackageRoot = path.join(
        installDirectory,
        process.platform === "win32" ? "node_modules" : "lib/node_modules",
        "@understand-code/preview",
      );
      const packageManifest = JSON.parse(
        await readFile(path.join(installedPackageRoot, "package.json"), "utf8"),
      );
      if (verifiedCandidate !== null) {
        assert.deepEqual(
          { name: packageManifest.name, version: packageManifest.version },
          verifiedCandidate.manifest.package,
          "Host lifecycle must install the exact candidate package identity",
        );
        const installedReleaseManifestBytes = await readFile(
          path.join(installedPackageRoot, "dist", "release-manifest.json"),
        );
        assert.equal(
          contentDigest(installedReleaseManifestBytes),
          verifiedCandidate.manifest.embeddedReleaseManifest.sha256,
          "installed release manifest must match the candidate binding",
        );
        const installedReleaseManifest = JSON.parse(
          installedReleaseManifestBytes.toString("utf8"),
        );
        assert.equal(installedReleaseManifest.schemaVersion, "understand-code-alpha-release-v1");
        assert.equal(
          contentDigest(
            await readFile(
              path.join(installedPackageRoot, installedReleaseManifest.cli.path),
            ),
          ),
          installedReleaseManifest.cli.sha256,
          "installed CLI bytes must match the embedded release manifest",
        );
      }
      const v1Version = packageManifest.version;
      const releases = await createLifecycleReleases(
        installedPackageRoot,
        releasesRoot,
        v1Version,
      );
      await activateMarketplaceFacade(marketplaceFacadeRoot, releases.v1);
      const codexMarketplaceRoot = path.join(marketplaceFacadeRoot, "codex");
      const claudeMarketplaceRoot = path.join(marketplaceFacadeRoot, "claude");

      const codexEnv = cleanHostEnvironment(codexUserHome, {
        CODEX_HOME: codexHome,
        PATH: `${path.dirname(codexCli)}${path.delimiter}${process.env.PATH ?? "/usr/bin:/bin"}`,
      });
      const codexMarketplace = JSON.parse(
        (await execBounded(
          codexCli,
          ["plugin", "marketplace", "add", codexMarketplaceRoot, "--json"],
          { cwd: differentCwd, env: codexEnv, encoding: "utf8" },
        )).stdout,
      );
      assert.equal(codexMarketplace.marketplaceName, MARKETPLACE_NAME);
      const codexInstall = JSON.parse(
        (await execBounded(
          codexCli,
          ["plugin", "add", `${PLUGIN_NAME}@${MARKETPLACE_NAME}`, "--json"],
          { cwd: differentCwd, env: codexEnv, encoding: "utf8" },
        )).stdout,
      );
      assert.equal(codexInstall.pluginId, `${PLUGIN_NAME}@${MARKETPLACE_NAME}`);
      assert.equal(codexInstall.version, v1Version);
      await activeCodexPlugin(codexCli, differentCwd, codexEnv, v1Version);
      codexInstalledRoot = await realpath(codexInstall.installedPath);
      assert.equal(
        codexInstalledRoot.startsWith(`${await realpath(codexHome)}${path.sep}`),
        true,
      );
      assert.equal(
        await fileSha256(
          path.join(codexInstalledRoot, "bin/understand-code.mjs"),
        ),
        releases.v1.cliSha256,
        "official Codex cache must contain exact v1 CLI bytes",
      );
      assert.deepEqual(
        await readFile(
          path.join(codexInstalledRoot, "bin/dashboard-manifest.json"),
        ),
        await readFile(path.join(
          releasePluginRoot(releases.v1.root, "codex"),
          "plugins/understand-code/bin/dashboard-manifest.json",
        )),
        "official Codex cache must contain exact v1 Dashboard manifest",
      );
      assert.match(
        (await execBounded(codexCli, ["plugin", "list"], {
          cwd: differentCwd,
          env: codexEnv,
          encoding: "utf8",
        })).stdout,
        /understand-code@understand-code-alpha\s+installed, enabled/u,
      );
      const codexMcpList = JSON.parse(
        (await execBounded(codexCli, ["mcp", "list", "--json"], {
          cwd: differentCwd,
          env: codexEnv,
          encoding: "utf8",
        })).stdout,
      );
      const registeredCodexMcp = codexMcpList.find(
        (server) => server.name === PLUGIN_NAME,
      );
      assert.ok(registeredCodexMcp, "Codex CLI must register the plugin MCP server");
      assert.equal(registeredCodexMcp.enabled, true);
      assert.equal(registeredCodexMcp.transport.type, "stdio");
      assert.equal(
        registeredCodexMcp.transport.command,
        "./bin/understand-code-plugin.mjs",
      );
      assert.deepEqual(
        registeredCodexMcp.transport.args,
        ["--host", "codex"],
      );
      const registeredCodexMcpDetail = JSON.parse(
        (await execBounded(
          codexCli,
          ["mcp", "get", PLUGIN_NAME, "--json"],
          { cwd: differentCwd, env: codexEnv, encoding: "utf8" },
        )).stdout,
      );
      assert.equal(registeredCodexMcpDetail.name, PLUGIN_NAME);
      assert.equal(registeredCodexMcpDetail.enabled, true);
      assert.deepEqual(
        registeredCodexMcpDetail.transport,
        registeredCodexMcp.transport,
      );
      await installPluginHostActivation({
        installedRoot: codexInstalledRoot,
        host: "codex",
        providerInstallationRoot: activationProviderRoot,
        version: v1Version,
        cwd: differentCwd,
        env: codexEnv,
      });
      await runInstalledHostDoctor({
        installedPackageRoot: releases.v1.root,
        host: "codex",
        version: v1Version,
        cwd: differentCwd,
        env: codexEnv,
        expectedStatus: "healthy",
      });
      const codexV1 = await exerciseInstalledMutationLocks({
        host: "codex",
        installedRoot: codexInstalledRoot,
        version: v1Version,
        repositoryRoot,
        expectedIndexPath: linkedIndexPath,
        cwd: nestedCwd,
        env: cleanHostEnvironment(codexUserHome, {
          CODEX_HOME: codexHome,
          ...poisonGitAuthority,
        }),
        clientName: "codex-plugin-e2e-v1",
      });
      await expectCacheBindingFailure({
        server: codexV1.server,
        version: v1Version,
        cwd: differentCwd,
        env: cleanHostEnvironment(codexUserHome, { CODEX_HOME: codexHome }),
        clientName: "codex-plugin-e2e-root-unavailable",
        reason: "root_unavailable",
        artifactRoots: [differentCwd],
      });

      const claudeEnv = cleanHostEnvironment(claudeUserHome, {
        CLAUDE_CONFIG_DIR: claudeConfig,
        PATH: `${path.dirname(claudeCli)}${path.delimiter}${process.env.PATH ?? "/usr/bin:/bin"}`,
      });
      await execBounded(
        claudeCli,
        ["plugin", "validate", "--strict", claudeMarketplaceRoot],
        { cwd: differentCwd, env: claudeEnv, encoding: "utf8" },
      );
      await execBounded(
        claudeCli,
        [
          "plugin",
          "marketplace",
          "add",
          claudeMarketplaceRoot,
          "--scope",
          "user",
        ],
        { cwd: differentCwd, env: claudeEnv, encoding: "utf8" },
      );
      const claudeMarketplaces = JSON.parse(
        (await execBounded(
          claudeCli,
          ["plugin", "marketplace", "list", "--json"],
          { cwd: differentCwd, env: claudeEnv, encoding: "utf8" },
        )).stdout,
      );
      assert.match(
        JSON.stringify(claudeMarketplaces),
        new RegExp(MARKETPLACE_NAME, "u"),
      );
      await execBounded(
        claudeCli,
        [
          "plugin",
          "install",
          `${PLUGIN_NAME}@${MARKETPLACE_NAME}`,
          "--scope",
          "user",
        ],
        { cwd: differentCwd, env: claudeEnv, encoding: "utf8" },
      );
      const activeClaudeV1 = await activeClaudePlugin(
        claudeCli,
        differentCwd,
        claudeEnv,
        v1Version,
      );
      claudeInstalledRoot = activeClaudeV1.installedRoot;
      assert.equal(
        claudeInstalledRoot.startsWith(
          `${await realpath(claudeConfig)}${path.sep}`,
        ),
        true,
      );
      assert.deepEqual(
        await readFile(
          path.join(claudeInstalledRoot, "bin/dashboard-manifest.json"),
        ),
        await readFile(path.join(
          releasePluginRoot(releases.v1.root, "claude"),
          "plugins/understand-code/bin/dashboard-manifest.json",
        )),
        "authoritative Claude cache must contain exact v1 Dashboard manifest",
      );
      await installPluginHostActivation({
        installedRoot: claudeInstalledRoot,
        host: "claude",
        providerInstallationRoot: activationProviderRoot,
        version: v1Version,
        cwd: differentCwd,
        env: claudeEnv,
      });
      await runInstalledHostDoctor({
        installedPackageRoot: releases.v1.root,
        host: "claude",
        version: v1Version,
        cwd: differentCwd,
        env: claudeEnv,
        expectedStatus: "healthy",
      });
      const claudeV1 = await exerciseInstalledMutationLocks({
        host: "claude",
        installedRoot: claudeInstalledRoot,
        version: v1Version,
        repositoryRoot,
        expectedIndexPath: linkedIndexPath,
        cwd: differentCwd,
        env: cleanHostEnvironment(claudeUserHome, {
          CLAUDE_CONFIG_DIR: claudeConfig,
          CLAUDE_PROJECT_DIR: nestedCwd,
          ...poisonGitAuthority,
        }),
        clientName: "claude-plugin-e2e-v1",
      });
      const claudeBindingEnvironment = cleanHostEnvironment(claudeUserHome, {
        CLAUDE_CONFIG_DIR: claudeConfig,
      });
      await expectCacheBindingFailure({
        server: claudeV1.server,
        version: v1Version,
        cwd: differentCwd,
        env: claudeBindingEnvironment,
        clientName: "claude-plugin-e2e-root-missing",
        reason: "root_missing",
        artifactRoots: [differentCwd],
      });
      const invalidRootContainer = path.join(
        sandbox,
        "invalid-root-file-container",
      );
      const invalidRootFile = path.join(
        invalidRootContainer,
        "not-a-directory.ts",
      );
      const invalidRootBytes = Buffer.from(
        "export const notARepository = true;\n",
        "utf8",
      );
      await mkdir(invalidRootContainer, { recursive: true });
      await writeFile(invalidRootFile, invalidRootBytes);
      await expectCacheBindingFailure({
        server: claudeV1.server,
        version: v1Version,
        cwd: differentCwd,
        env: {
          ...claudeBindingEnvironment,
          CLAUDE_PROJECT_DIR: invalidRootFile,
        },
        clientName: "claude-plugin-e2e-root-not-directory",
        reason: "root_not_directory",
        artifactRoots: [invalidRootContainer],
      });
      assert.deepEqual(await readFile(invalidRootFile), invalidRootBytes);
      for (const [unsafeRoot, label] of [
        ["relative/repository", "relative"],
        ["${CLAUDE_PROJECT_DIR}", "unexpanded placeholder"],
      ]) {
        await expectUnsafeWrapperRootFailure(
          claudeV1.server,
          differentCwd,
          {
            ...claudeBindingEnvironment,
            CLAUDE_PROJECT_DIR: unsafeRoot,
          },
          `Claude plugin must reject an unsafe ${label} Root before MCP`,
        );
      }
      assert.deepEqual(
        await readFile(
          path.join(codexInstalledRoot, "bin/understand-code.mjs"),
        ),
        await readFile(
          path.join(claudeInstalledRoot, "bin/understand-code.mjs"),
        ),
        "both v1 Host installations must execute exact same bundle bytes",
      );

      if (process.env.RUN_STEP16_DUAL_HOST_E2E === "1") {
        const required = (name) => {
          const value = process.env[name];
          assert.equal(
            typeof value === "string" && path.isAbsolute(value),
            true,
            `${name} must be an absolute path for the Step16 Host gate`,
          );
          return value;
        };
        const { runStep16DualHostStrongAlphaV1 } = await import(
          "../../durable-object-provider-runtime/test/step16-dual-host-strong-alpha-linux.mjs"
        );
        const poisonedProviderSelection = {
          UNDERSTAND_CODE_CLI: path.join(sandbox, "poison-cli"),
          UNDERSTAND_CODE_HOME: path.join(sandbox, "poison-home"),
          UNDERSTAND_CODE_HOST_INSTALLATION_ROOT: path.join(
            sandbox,
            "poison-host-installation",
          ),
          UNDERSTAND_CODE_INSTALL_ROOT: path.join(
            sandbox,
            "poison-installation",
          ),
          UNDERSTAND_CODE_PROVIDER_INSTALLATION_ROOT: path.join(
            sandbox,
            "poison-provider",
          ),
        };
        step16Evidence = await runStep16DualHostStrongAlphaV1({
          callerUid: process.geteuid?.(),
          providerInstallationRoot: required(
            "UNDERSTAND_CODE_STEP16_PROVIDER_INSTALLATION_ROOT",
          ),
          repositoryRoot: required("UNDERSTAND_CODE_STEP16_REPOSITORY_ROOT"),
          invalidRoot: required("UNDERSTAND_CODE_STEP16_INVALID_ROOT"),
          corpusPath: required("UNDERSTAND_CODE_STEP16_CORPUS_PATH"),
          actualHostPlugins: {
            codex: {
              ...codexV1.server,
              cliPath: path.join(
                codexInstalledRoot,
                "bin/understand-code.mjs",
              ),
              installedRoot: codexInstalledRoot,
              cwd: nestedCwd,
              env: cleanHostEnvironment(codexUserHome, {
                CODEX_HOME: codexHome,
                ...poisonGitAuthority,
                ...poisonedProviderSelection,
              }),
            },
            claude: {
              ...claudeV1.server,
              cliPath: path.join(
                claudeInstalledRoot,
                "bin/understand-code.mjs",
              ),
              installedRoot: claudeInstalledRoot,
              cwd: differentCwd,
              env: cleanHostEnvironment(claudeUserHome, {
                CLAUDE_CONFIG_DIR: claudeConfig,
                ...poisonGitAuthority,
                ...poisonedProviderSelection,
              }),
            },
          },
        });
      }

      const claudeV1InstalledRoot = claudeInstalledRoot;
      await activateMarketplaceFacade(marketplaceFacadeRoot, releases.v2);
      const codexV2Reinstall = JSON.parse(
        (await execBounded(
          codexCli,
          ["plugin", "add", `${PLUGIN_NAME}@${MARKETPLACE_NAME}`, "--json"],
          { cwd: differentCwd, env: codexEnv, encoding: "utf8" },
        )).stdout,
      );
      assert.equal(codexV2Reinstall.version, releases.v2.version);
      await activeCodexPlugin(
        codexCli,
        differentCwd,
        codexEnv,
        releases.v2.version,
      );
      codexInstalledRoot = await realpath(codexV2Reinstall.installedPath);
      assert.equal(
        await fileSha256(
          path.join(codexInstalledRoot, "bin/understand-code.mjs"),
        ),
        releases.v2.cliSha256,
      );
      await installPluginHostActivation({
        installedRoot: codexInstalledRoot,
        host: "codex",
        providerInstallationRoot: activationProviderRoot,
        version: releases.v2.version,
        cwd: differentCwd,
        env: codexEnv,
      });
      await runInstalledHostDoctor({
        installedPackageRoot: releases.v2.root,
        host: "codex",
        version: releases.v2.version,
        cwd: differentCwd,
        env: codexEnv,
        expectedStatus: "healthy",
      });
      await exerciseInstalledMutationLocks({
        host: "codex",
        installedRoot: codexInstalledRoot,
        version: releases.v2.version,
        repositoryRoot,
        expectedIndexPath: linkedIndexPath,
        cwd: nestedCwd,
        env: cleanHostEnvironment(codexUserHome, {
          CODEX_HOME: codexHome,
          ...poisonGitAuthority,
        }),
        clientName: "codex-plugin-e2e-v2",
      });

      await execBounded(
        claudeCli,
        ["plugin", "marketplace", "update", MARKETPLACE_NAME],
        { cwd: differentCwd, env: claudeEnv, encoding: "utf8" },
      );
      await execBounded(
        claudeCli,
        [
          "plugin",
          "update",
          `${PLUGIN_NAME}@${MARKETPLACE_NAME}`,
          "--scope",
          "user",
        ],
        { cwd: differentCwd, env: claudeEnv, encoding: "utf8" },
      );
      const activeClaudeV2 = await activeClaudePlugin(
        claudeCli,
        differentCwd,
        claudeEnv,
        releases.v2.version,
      );
      claudeInstalledRoot = activeClaudeV2.installedRoot;
      assert.notEqual(claudeInstalledRoot, claudeV1InstalledRoot);
      assert.equal(
        await fileSha256(
          path.join(claudeInstalledRoot, "bin/understand-code.mjs"),
        ),
        releases.v2.cliSha256,
      );
      assert.equal(
        await findClaudeInstalledRoot(claudeConfig, v1Version),
        claudeV1InstalledRoot,
        "Claude v1 cache may remain only as inert non-authoritative residual",
      );
      await installPluginHostActivation({
        installedRoot: claudeInstalledRoot,
        host: "claude",
        providerInstallationRoot: activationProviderRoot,
        version: releases.v2.version,
        cwd: differentCwd,
        env: claudeEnv,
      });
      await runInstalledHostDoctor({
        installedPackageRoot: releases.v2.root,
        host: "claude",
        version: releases.v2.version,
        cwd: differentCwd,
        env: claudeEnv,
        expectedStatus: "healthy",
      });
      await exerciseInstalledMutationLocks({
        host: "claude",
        installedRoot: claudeInstalledRoot,
        version: releases.v2.version,
        repositoryRoot,
        expectedIndexPath: linkedIndexPath,
        cwd: differentCwd,
        env: cleanHostEnvironment(claudeUserHome, {
          CLAUDE_CONFIG_DIR: claudeConfig,
          CLAUDE_PROJECT_DIR: nestedCwd,
          ...poisonGitAuthority,
        }),
        clientName: "claude-plugin-e2e-v2",
      });
      assert.deepEqual(
        await readFile(
          path.join(codexInstalledRoot, "bin/understand-code.mjs"),
        ),
        await readFile(
          path.join(claudeInstalledRoot, "bin/understand-code.mjs"),
        ),
        "both active v2 Host installations must execute same bundle bytes",
      );

      await execBounded(
        codexCli,
        [
          "plugin",
          "remove",
          `${PLUGIN_NAME}@${MARKETPLACE_NAME}`,
          "--json",
        ],
        { cwd: differentCwd, env: codexEnv, encoding: "utf8" },
      );
      await assertMissing(
        codexInstalledRoot,
        "Codex remove must delete active v2 official installedPath",
      );
      await activateMarketplaceFacade(marketplaceFacadeRoot, releases.v1);
      const codexPinnedV1Install = JSON.parse(
        (await execBounded(
          codexCli,
          ["plugin", "add", `${PLUGIN_NAME}@${MARKETPLACE_NAME}`, "--json"],
          { cwd: differentCwd, env: codexEnv, encoding: "utf8" },
        )).stdout,
      );
      assert.equal(codexPinnedV1Install.version, v1Version);
      await activeCodexPlugin(codexCli, differentCwd, codexEnv, v1Version);
      codexInstalledRoot = await realpath(codexPinnedV1Install.installedPath);
      assert.equal(
        await fileSha256(
          path.join(codexInstalledRoot, "bin/understand-code.mjs"),
        ),
        releases.v1.cliSha256,
      );
      await installPluginHostActivation({
        installedRoot: codexInstalledRoot,
        host: "codex",
        providerInstallationRoot: activationProviderRoot,
        version: v1Version,
        cwd: differentCwd,
        env: codexEnv,
      });
      await runInstalledHostDoctor({
        installedPackageRoot: releases.v1.root,
        host: "codex",
        version: v1Version,
        cwd: differentCwd,
        env: codexEnv,
        expectedStatus: "healthy",
      });
      await exerciseInstalledMutationLocks({
        host: "codex",
        installedRoot: codexInstalledRoot,
        version: v1Version,
        repositoryRoot,
        expectedIndexPath: linkedIndexPath,
        cwd: nestedCwd,
        env: cleanHostEnvironment(codexUserHome, {
          CODEX_HOME: codexHome,
          ...poisonGitAuthority,
        }),
        clientName: "codex-plugin-e2e-pinned-v1",
      });

      await execBounded(
        claudeCli,
        [
          "plugin",
          "uninstall",
          `${PLUGIN_NAME}@${MARKETPLACE_NAME}`,
          "--scope",
          "user",
          "--yes",
        ],
        { cwd: differentCwd, env: claudeEnv, encoding: "utf8" },
      );
      assert.deepEqual(
        JSON.parse((await execBounded(
          claudeCli,
          ["plugin", "list", "--json"],
          { cwd: differentCwd, env: claudeEnv, encoding: "utf8" },
        )).stdout),
        [],
        "Claude uninstall must clear active registration before rollback",
      );
      await execBounded(
        claudeCli,
        ["plugin", "marketplace", "update", MARKETPLACE_NAME],
        { cwd: differentCwd, env: claudeEnv, encoding: "utf8" },
      );
      await execBounded(
        claudeCli,
        [
          "plugin",
          "install",
          `${PLUGIN_NAME}@${MARKETPLACE_NAME}`,
          "--scope",
          "user",
        ],
        { cwd: differentCwd, env: claudeEnv, encoding: "utf8" },
      );
      const activeClaudePinnedV1 = await activeClaudePlugin(
        claudeCli,
        differentCwd,
        claudeEnv,
        v1Version,
      );
      claudeInstalledRoot = activeClaudePinnedV1.installedRoot;
      assert.equal(
        await fileSha256(
          path.join(claudeInstalledRoot, "bin/understand-code.mjs"),
        ),
        releases.v1.cliSha256,
      );
      await installPluginHostActivation({
        installedRoot: claudeInstalledRoot,
        host: "claude",
        providerInstallationRoot: activationProviderRoot,
        version: v1Version,
        cwd: differentCwd,
        env: claudeEnv,
      });
      await runInstalledHostDoctor({
        installedPackageRoot: releases.v1.root,
        host: "claude",
        version: v1Version,
        cwd: differentCwd,
        env: claudeEnv,
        expectedStatus: "healthy",
      });
      await exerciseInstalledMutationLocks({
        host: "claude",
        installedRoot: claudeInstalledRoot,
        version: v1Version,
        repositoryRoot,
        expectedIndexPath: linkedIndexPath,
        cwd: differentCwd,
        env: cleanHostEnvironment(claudeUserHome, {
          CLAUDE_CONFIG_DIR: claudeConfig,
          CLAUDE_PROJECT_DIR: nestedCwd,
          ...poisonGitAuthority,
        }),
        clientName: "claude-plugin-e2e-pinned-v1",
      });
      assert.deepEqual(
        await readFile(
          path.join(codexInstalledRoot, "bin/understand-code.mjs"),
        ),
        await readFile(
          path.join(claudeInstalledRoot, "bin/understand-code.mjs"),
        ),
        "both pinned-v1 Host reinstalls must execute exact same bundle bytes",
      );

      await execBounded(
        codexCli,
        [
          "plugin",
          "remove",
          `${PLUGIN_NAME}@${MARKETPLACE_NAME}`,
          "--json",
        ],
        { cwd: differentCwd, env: codexEnv, encoding: "utf8" },
      );
      await execBounded(
        codexCli,
        ["plugin", "marketplace", "remove", MARKETPLACE_NAME],
        { cwd: differentCwd, env: codexEnv, encoding: "utf8" },
      );
      await assertMissing(
        codexInstalledRoot,
        "Codex remove must clean installed plugin cache",
      );
      codexInstalledRoot = null;
      await runInstalledHostDoctor({
        installedPackageRoot: releases.v1.root,
        host: "codex",
        version: v1Version,
        cwd: differentCwd,
        env: codexEnv,
        expectedStatus: "not_registered",
      });
      assert.match(
        (await execBounded(
          codexCli,
          ["plugin", "marketplace", "list"],
          { env: codexEnv, encoding: "utf8" },
        )).stdout,
        /No plugin marketplaces in scope\./u,
      );

      await execBounded(
        claudeCli,
        [
          "plugin",
          "uninstall",
          `${PLUGIN_NAME}@${MARKETPLACE_NAME}`,
          "--scope",
          "user",
          "--yes",
        ],
        { cwd: differentCwd, env: claudeEnv, encoding: "utf8" },
      );
      await execBounded(
        claudeCli,
        [
          "plugin",
          "marketplace",
          "remove",
          MARKETPLACE_NAME,
          "--scope",
          "user",
        ],
        { cwd: differentCwd, env: claudeEnv, encoding: "utf8" },
      );
      assert.deepEqual(
        JSON.parse((await execBounded(
          claudeCli,
          ["plugin", "list", "--json"],
          { env: claudeEnv, encoding: "utf8" },
        )).stdout),
        [],
      );
      assert.deepEqual(
        JSON.parse((await execBounded(
          claudeCli,
          ["plugin", "marketplace", "list", "--json"],
          { env: claudeEnv, encoding: "utf8" },
        )).stdout),
        [],
      );
      await runInstalledHostDoctor({
        installedPackageRoot: releases.v1.root,
        host: "claude",
        version: v1Version,
        cwd: differentCwd,
        env: claudeEnv,
        expectedStatus: "not_registered",
      });
      claudeInstalledRoot = null;

      if (step16Evidence !== null) {
        const { Step16DualHostEvidenceV1Schema } = await import(
          "../../contracts/dist/alpha-gold.js"
        );
        await writeJson(
          requiredStep16EvidencePath(),
          Step16DualHostEvidenceV1Schema.parse({
            ...step16Evidence,
            lifecycle:
              "marketplace_install_upgrade_reinstall_remove_doctor_clean_close",
          }),
        );
      }

      for (const root of [
        primaryRepositoryRoot,
        repositoryRoot,
        ambientRepositoryRoot,
      ]) {
        assert.equal(
          await snapshotManagedArtifactTree(root),
          null,
          "locked public mutations must not create a managed Store in any repository",
        );
      }
      assert.equal(
        (await repositoryGit(
          primaryRepositoryRoot,
          ["status", "--porcelain=v1", "--untracked-files=all"],
        )).stdout,
        "",
        "primary worktree must remain completely clean",
      );
      assert.equal(
        (await repositoryGit(
          repositoryRoot,
          ["status", "--porcelain=v1", "--untracked-files=all"],
        )).stdout,
        "",
        "linked worktree must remain completely clean",
      );
      assert.deepEqual(await readFile(primarySourcePath), primarySourceBefore);
      assert.deepEqual(await readFile(primaryIndexPath), primaryIndexBefore);
      assert.deepEqual(await readFile(linkedSourcePath), linkedSourceBefore);
      assert.deepEqual(await readFile(linkedIndexPath), linkedIndexBefore);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  },
);
