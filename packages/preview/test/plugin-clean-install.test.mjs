import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { createInterface } from "node:readline";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";

import { launchBrowser, resolveBrowserExecutable } from "./browser-harness.mjs";

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const PROCESS_TIMEOUT_MS = 20_000;
const EXTERNAL_TIMEOUT_MS = 60_000;
const PLUGIN_NAME = "understand-code";
const MARKETPLACE_NAME = "understand-code-alpha";
const LIFECYCLE_V2_VERSION = "0.1.0-preview.2+codex.lifecycle-v2";
const INITIAL_SOURCE = "export function alpha() { return true; }\n";
const VERIFIED_SOURCE = "export function alpha() { return 'verified'; }\n";
const ALPHA_NODE_ID = "function:src/index.ts:alpha";
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

function contentDigest(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function bodyContains(value) {
  return `document.body?.innerText?.includes(${JSON.stringify(value)}) === true`;
}

function expectedReactEntry(indexHtml) {
  const match = indexHtml.match(/<script\b[^>]*\bsrc=["'](?<source>\/assets\/index-[A-Za-z0-9_-]+\.js)["'][^>]*>/iu);
  assert.ok(match?.groups?.source, "the active Host cache Dashboard must name one hashed React entry asset");
  return match.groups.source;
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
    assert.equal(await isExecutable(resolved), true, `${name} override must name an executable`);
    return resolved;
  }
  for (const candidate of candidates) {
    if (await isExecutable(candidate)) return await realpath(candidate);
  }
  try {
    const located = await execBounded("sh", ["-c", `command -v ${name}`], {
      encoding: "utf8",
      timeout: 5_000,
    });
    const resolved = located.stdout.trim();
    if (await isExecutable(resolved)) return await realpath(resolved);
  } catch {
    // The release gate can explicitly require Host CLIs; ordinary package CI may not carry them.
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

async function runInstalledHostDoctor({ installedPackageRoot, host, version, cwd, env, expectedStatus }) {
  const executable = path.join(installedPackageRoot, "dist/understand-code.mjs");
  let stdout;
  let exitCode = 0;
  try {
    stdout = (await execBounded(process.execPath, [executable, "doctor", "--host", host], {
      cwd,
      env,
      encoding: "utf8",
    })).stdout;
  } catch (error) {
    exitCode = error?.code;
    stdout = error?.stdout;
  }
  assert.equal(exitCode, expectedStatus === "healthy" ? 0 : 1, `${host} Doctor exit code`);
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
    assert.equal(result.checks.every(({ status, code }) => status === "pass" && code === "ok"), true);
  } else {
    assert.equal(result.hostRegistration, "not_registered");
    assert.deepEqual(
      result.checks.map(({ status, code }) => ({ status, code })),
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
    terminalError = new Error(`MCP exited before the expected response (code=${code}, signal=${signal})`);
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

async function callTool(child, output, id, name, argumentsValue) {
  writeMessage(child, {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: argumentsValue },
  });
  const message = await output.waitFor((candidate) => candidate.id === id, `${name} response`);
  assert.equal(message.jsonrpc, "2.0");
  assert.equal(Object.hasOwn(message, "error"), false, `${name} must return an MCP tool result`);
  assert.notEqual(message.result.isError, true, `${name} must report success`);
  assert.equal(message.result.structuredContent.schemaVersion, 1);
  return message.result;
}

async function createRepository(root, source = INITIAL_SOURCE) {
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(
    path.join(root, "src/index.ts"),
    source,
  );
  const gitEnv = {
    ...repositoryGitEnvironment(),
    GIT_AUTHOR_NAME: "Understand Code Plugin E2E",
    GIT_AUTHOR_EMAIL: "plugin-e2e@example.invalid",
    GIT_COMMITTER_NAME: "Understand Code Plugin E2E",
    GIT_COMMITTER_EMAIL: "plugin-e2e@example.invalid",
  };
  await execBounded("git", ["init", "-q"], { cwd: root, env: gitEnv });
  await execBounded("git", ["add", "src/index.ts"], { cwd: root, env: gitEnv });
  await execBounded("git", ["commit", "-q", "-m", "initial"], { cwd: root, env: gitEnv });
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
  await repositoryGit(primaryRoot, ["worktree", "add", "--detach", linkedRoot, "HEAD"]);
  return realpath(linkedRoot);
}

async function resolveMcpServer(installedRoot, host) {
  const config = JSON.parse(await readFile(path.join(installedRoot, ".mcp.json"), "utf8"));
  assert.equal(Object.hasOwn(config, "mcpServers"), false, "plugin MCP config must use the official direct server map");
  assert.equal(Object.hasOwn(config, "mcp_servers"), false, "plugin MCP config must use the official direct server map");
  assert.deepEqual(Object.keys(config), [PLUGIN_NAME]);
  const server = config[PLUGIN_NAME];
  assert.equal(typeof server, "object");
  assert.deepEqual(server.args, ["--host", host]);
  let command = server.command;
  if (host === "claude") {
    assert.match(command, /^\$\{CLAUDE_PLUGIN_ROOT\}\/[A-Za-z0-9_./-]+$/u);
    command = command.replace("${CLAUDE_PLUGIN_ROOT}", installedRoot);
  } else {
    assert.match(command, /^\.\/[A-Za-z0-9_./-]+$/u, "Codex bundled command must be plugin-root relative");
  }
  assert.doesNotMatch(command, /\$\{[^}]+\}/u, "bundled MCP command must not retain an unknown Host placeholder");
  const executable = await realpath(path.resolve(installedRoot, command));
  const canonicalRoot = `${await realpath(installedRoot)}${path.sep}`;
  assert.equal(executable.startsWith(canonicalRoot), true, "bundled command must resolve inside the installed cache root");
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
    const initialized = await output.waitFor((message) => message.id === 1, `${clientName} initialize`);
    assert.equal(initialized.result.serverInfo.name, "understand-code");
    assert.equal(initialized.result.serverInfo.version, version);
    writeMessage(child, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });
    writeMessage(child, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const listed = await output.waitFor((message) => message.id === 2, `${clientName} tools/list`);
    assert.equal(Object.hasOwn(listed, "error"), false);
    assert.deepEqual(listed.result.tools.map((tool) => tool.name), EXPECTED_TOOL_NAMES);
    assert.equal(await realpath(repositoryRoot), repositoryRoot);
    const result = await exercise({ child, output, server });
    child.stdin.end();
    assert.deepEqual(await waitForExit(child, `${clientName} clean exit`), [0, null]);
    assert.equal(output.stderr.join(""), "");
    return { server, result };
  } finally {
    await stopChild(child);
  }
}

async function exerciseInstalledAlpha(options) {
  const { repositoryRoot, clientName, expectedIndexPath } = options;
  const sourcePath = path.join(repositoryRoot, "src/index.ts");
  const sourceBefore = await readFile(sourcePath);
  const indexPath = await absoluteGitPath(repositoryRoot, "index");
  assert.equal(indexPath, expectedIndexPath, "Alpha must use the pre-audited linked-worktree index");
  const indexBefore = createHash("sha256")
    .update(await readFile(indexPath))
    .digest("hex");
  return withInstalledMcp(options, async ({ child, output }) => {
    const actor = `agent:${clientName}`;
    let requestId = 3;
    const initialRefresh = await callTool(child, output, requestId++, "refresh_index", {
      mode: "full",
      idempotencyKey: `${clientName}-initial-refresh`,
      actor,
    });
    assert.equal(initialRefresh.structuredContent.result.operation.status, "completed");
    const initialSnapshotId = initialRefresh.structuredContent.meta.sourceSnapshotId;
    const repositoryId = initialRefresh.structuredContent.meta.repositoryId;
    const worktreeId = initialRefresh.structuredContent.meta.worktreeId;
    for (const [label, value] of [["repositoryId", repositoryId], ["worktreeId", worktreeId]]) {
      assert.equal(typeof value, "string", `${label} must be a string`);
      assert.ok(value.length > 0, `${label} must be nonempty`);
    }
    const pulse = await callTool(child, output, requestId++, "get_repo_pulse", {});
    assert.equal(
      pulse.structuredContent.meta.sourceSnapshotId,
      initialSnapshotId,
      "the installed Host plugin must read the exact snapshot it created for the bound repository",
    );
    assert.deepEqual(
      {
        repositoryId: pulse.structuredContent.meta.repositoryId,
        worktreeId: pulse.structuredContent.meta.worktreeId,
      },
      { repositoryId, worktreeId },
      "Pulse must retain the exact linked-worktree identity selected during refresh",
    );

    const built = await callTool(child, output, requestId++, "build_task_brief", {
      task: "Change the alpha function in src/index.ts and verify its observable behavior.",
      expectedRevision: 0,
      idempotencyKey: `${clientName}-brief`,
      actor,
      scope: ["src/index.ts"],
      maxCandidates: 1,
    });
    const taskId = built.structuredContent.result.task.taskId;
    assert.deepEqual(
      {
        repositoryId: built.structuredContent.result.task.repositoryId,
        worktreeId: built.structuredContent.result.task.worktreeId,
      },
      { repositoryId, worktreeId },
      "the Task must bind the exact linked-worktree identity",
    );
    const brief = built.structuredContent.result.brief;
    const readBrief = await callTool(child, output, requestId++, "get_task_brief", {
      taskId,
      section: "summary",
    });
    assert.equal(readBrief.structuredContent.result.task.taskId, taskId);

    let taskRevision = built.structuredContent.result.task.revision;
    const updateTask = async (action, idempotencyKey) => {
      const updated = await callTool(child, output, requestId++, "update_task", {
        taskId,
        action,
        expectedRevision: taskRevision,
        idempotencyKey,
        actor,
      });
      taskRevision = updated.structuredContent.result.mutation.revision;
      return updated;
    };
    await updateTask(
      { type: "confirm_goal", claimId: brief.goalClaimId },
      `${clientName}-confirm-goal`,
    );
    await updateTask(
      { type: "confirm_acceptance_criteria", claimIds: brief.acceptanceClaimIds },
      `${clientName}-confirm-acceptance`,
    );
    assert.equal(brief.plannedChanges.length, 1, "the Brief must contain only the exact alpha plan");
    assert.deepEqual(
      {
        filePath: brief.plannedChanges[0].filePath,
        symbolId: brief.plannedChanges[0].symbolId,
      },
      { filePath: "src/index.ts", symbolId: ALPHA_NODE_ID },
    );
    await updateTask(
      { type: "confirm_plan", plannedChangeIds: brief.plannedChanges.map((change) => change.id) },
      `${clientName}-confirm-plan`,
    );
    await updateTask({ type: "transition_status", to: "planned" }, `${clientName}-planned`);
    await updateTask({ type: "transition_status", to: "in_progress" }, `${clientName}-in-progress`);

    await writeFile(
      sourcePath,
      VERIFIED_SOURCE,
      "utf8",
    );
    assert.notDeepEqual(await readFile(sourcePath), sourceBefore);
    assert.equal(
      createHash("sha256")
        .update(await readFile(indexPath))
        .digest("hex"),
      indexBefore,
      "the external source edit must not mutate the Git index",
    );
    const changedRefresh = await callTool(child, output, requestId++, "refresh_index", {
      mode: "full",
      expectedSourceSnapshotId: initialSnapshotId,
      idempotencyKey: `${clientName}-changed-refresh`,
      actor,
    });
    assert.equal(changedRefresh.structuredContent.result.operation.status, "completed");
    const changedSnapshotId = changedRefresh.structuredContent.meta.sourceSnapshotId;
    assert.notEqual(changedSnapshotId, initialSnapshotId);
    assert.deepEqual(
      {
        repositoryId: changedRefresh.structuredContent.meta.repositoryId,
        worktreeId: changedRefresh.structuredContent.meta.worktreeId,
      },
      { repositoryId, worktreeId },
      "the changed Snapshot must retain the exact linked-worktree identity",
    );

    await updateTask(
      { type: "transition_status", to: "check_required" },
      `${clientName}-check-required`,
    );
    const checked = await callTool(child, output, requestId++, "check_change", {
      taskId,
      actualSnapshotId: changedSnapshotId,
      includeWorktree: true,
      expectedRevision: taskRevision,
      idempotencyKey: `${clientName}-check`,
      actor,
    });
    taskRevision = checked.structuredContent.result.mutation.revision;
    const changeCheck = checked.structuredContent.result.changeCheck;
    assert.equal(changeCheck.actualSnapshotId, changedSnapshotId);
    const plannedChange = brief.plannedChanges[0];
    const finding = changeCheck.findings.find(
      (candidate) =>
        candidate.plannedChangeIds.includes(plannedChange.id) &&
        candidate.actualChangeIds.length > 0,
    );
    assert.ok(finding, `the Check must link actual change evidence to ${plannedChange.id}`);
    assert.equal(finding.type, "planned_completed");
    assert.equal(finding.blocking, false);
    assert.deepEqual(finding.plannedChangeIds, [plannedChange.id]);
    assert.equal(finding.actualChangeIds.length, 1);
    assert.equal(finding.evidenceIds.length, 1);
    assert.deepEqual(
      changeCheck.findings.filter((finding) => finding.blocking && finding.resolution === undefined),
      [],
      "the exact single-file happy path must not auto-accept an unexpected blocking finding",
    );
    await updateTask(
      { type: "transition_status", to: "verification_required" },
      `${clientName}-verification-required`,
    );

    const requiredPlanEntries = brief.verificationPlan.filter((entry) => entry.required);
    assert.ok(requiredPlanEntries.length > 0, "the Brief must require external verification");
    for (const planEntry of requiredPlanEntries) {
      assert.equal(
        planEntry.method,
        "test",
        "the Node behavior assertion must only satisfy a test verification plan entry",
      );
    }
    const verificationProgram = [
      "const { alpha } = await import('./src/index.ts');",
      "if (alpha() !== 'verified') throw new Error('unexpected alpha result');",
    ].join(" ");
    const verificationArgs = ["--input-type=module", "--eval", verificationProgram];
    const verificationCommand = `node --input-type=module --eval ${JSON.stringify(verificationProgram)}`;
    const verificationStartedAt = Date.now();
    const verificationExecution = await execBounded("node", verificationArgs, {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    const verificationDurationMs = Date.now() - verificationStartedAt;
    assert.equal(verificationExecution.stderr, "");
    const outputDigest = `sha256:${createHash("sha256")
      .update(`${verificationExecution.stdout}${verificationExecution.stderr}`, "utf8")
      .digest("hex")}`;
    const verificationRequests = [];
    const verificationResults = [];
    for (const [index, planEntry] of requiredPlanEntries.entries()) {
      const request = {
        taskId,
        record: {
          verificationPlanEntryId: planEntry.id,
          kind: "test",
          status: "passed",
          command: verificationCommand,
          exitCode: 0,
          durationMs: verificationDurationMs,
          outputDigest,
          summary: "The installed-Host Node behavior assertion completed successfully.",
          claimIds: planEntry.acceptanceClaimIds,
          snapshotId: changedSnapshotId,
        },
        expectedRevision: taskRevision,
        idempotencyKey: `${clientName}-verification-${index}`,
        actor,
      };
      assert.equal(request.record.kind, planEntry.method);
      assert.equal(request.record.command, verificationCommand);
      const recorded = await callTool(child, output, requestId++, "record_verification", request);
      assert.equal(recorded.structuredContent.result.verification.status, "passed");
      assert.equal(recorded.structuredContent.result.verification.snapshotId, changedSnapshotId);
      assert.equal(recorded.structuredContent.result.mutation.idempotentReplay, false);
      taskRevision = recorded.structuredContent.result.mutation.revision;
      verificationRequests.push(request);
      verificationResults.push(recorded);
    }
    const verified = await updateTask(
      { type: "transition_status", to: "verified" },
      `${clientName}-verified`,
    );
    assert.equal(verified.structuredContent.result.task.status, "verified");
    return {
      taskId,
      repositoryId,
      worktreeId,
      baselineSnapshotId: built.structuredContent.result.task.baselineSnapshotId,
      changedSnapshotId,
      verifiedRevision: verified.structuredContent.result.task.revision,
      finding: {
        id: finding.id,
        summary: finding.summary,
        evidenceId: finding.evidenceIds[0],
      },
      verificationRequests,
      verificationResults,
    };
  });
}

async function resumeInstalledAlpha(options, alpha, workbenchSurface) {
  return withInstalledMcp(options, async ({ child, output, server }) => {
    let requestId = 3;
    const resumed = await callTool(child, output, requestId++, "get_task_brief", {
      taskId: alpha.taskId,
      section: "summary",
    });
    assert.deepEqual(
      {
        taskId: resumed.structuredContent.result.task.taskId,
        repositoryId: resumed.structuredContent.result.task.repositoryId,
        worktreeId: resumed.structuredContent.result.task.worktreeId,
        status: resumed.structuredContent.result.task.status,
        revision: resumed.structuredContent.result.task.revision,
        baselineSnapshotId: resumed.structuredContent.result.task.baselineSnapshotId,
        sourceSnapshotId: resumed.structuredContent.meta.sourceSnapshotId,
      },
      {
        taskId: alpha.taskId,
        repositoryId: alpha.repositoryId,
        worktreeId: alpha.worktreeId,
        status: "verified",
        revision: alpha.verifiedRevision,
        baselineSnapshotId: alpha.baselineSnapshotId,
        sourceSnapshotId: alpha.changedSnapshotId,
      },
      "every fresh active-cache MCP must resume the exact linked-worktree Task and Snapshot",
    );
    for (const [index, request] of alpha.verificationRequests.entries()) {
      const replayed = await callTool(
        child,
        output,
        requestId++,
        "record_verification",
        request,
      );
      const original = alpha.verificationResults[index];
      assert.equal(replayed.structuredContent.result.mutation.idempotentReplay, true);
      assert.deepEqual(
        replayed.structuredContent.result.verification,
        original.structuredContent.result.verification,
        "an exact replay must return the original Verification record",
      );
      assert.deepEqual(
        replayed.structuredContent.result.mutation,
        {
          ...original.structuredContent.result.mutation,
          idempotentReplay: true,
        },
        "an exact replay must not append another Task mutation",
      );
    }
    const afterReplay = await callTool(
      child,
      output,
      requestId++,
      "get_task_brief",
      { taskId: alpha.taskId, section: "summary" },
    );
    assert.equal(afterReplay.structuredContent.result.task.revision, alpha.verifiedRevision);
    if (workbenchSurface === undefined) return;
    const hostLabel = options.host === "codex" ? "Codex" : "Claude";
    const activeRoot = await realpath(options.installedRoot);
    assert.equal(
      server.executable.startsWith(`${activeRoot}${path.sep}`),
      true,
      "the Workbench Surface MCP executable must come from the authoritative active Host cache",
    );
    const cachedDashboardIndex = await readFile(path.join(activeRoot, "bin/dashboard/index.html"), "utf8");
    const reactEntry = expectedReactEntry(cachedDashboardIndex);
    const cachedReactDigest = contentDigest(await readFile(
      path.join(activeRoot, "bin/dashboard", reactEntry.slice(1)),
    ));

    const evidenceRead = await callTool(child, output, requestId++, "get_evidence", {
      taskId: alpha.taskId,
      evidenceIds: [alpha.finding.evidenceId],
      maxExcerptChars: 8_192,
      pageSize: 1,
    });
    assert.deepEqual(evidenceRead.structuredContent.result.missingEvidenceIds, []);
    assert.equal(evidenceRead.structuredContent.result.evidence.length, 1);
    const evidence = evidenceRead.structuredContent.result.evidence[0];
    assert.deepEqual(
      {
        id: evidence.id,
        kind: evidence.kind,
        freshness: evidence.freshness,
        filePath: evidence.filePath,
        lineRange: evidence.lineRange,
        contentHash: evidence.contentHash,
        nodeIds: evidence.nodeIds,
        observedAtSnapshotId: evidence.observedAtSnapshotId,
      },
      {
        id: alpha.finding.evidenceId,
        kind: "source",
        freshness: "current",
        filePath: "src/index.ts",
        lineRange: [1, 1],
        contentHash: contentDigest(Buffer.from(VERIFIED_SOURCE, "utf8")),
        nodeIds: [ALPHA_NODE_ID],
        observedAtSnapshotId: alpha.changedSnapshotId,
      },
      `the fresh ${hostLabel} cache must read the exact source Evidence created through Codex`,
    );

    const opened = await callTool(child, output, requestId++, "open_workbench", {
      route: {
        view: "tasks",
        taskId: alpha.taskId,
        section: "planned_changes",
      },
      openBrowser: false,
    });
    assert.equal(opened.structuredContent.meta.sourceSnapshotId, alpha.changedSnapshotId);
    const deepLink = opened.structuredContent.result.deepLink;
    const deepLinkUrl = new URL(deepLink);
    assert.deepEqual(
      {
        protocol: deepLinkUrl.protocol,
        hostname: deepLinkUrl.hostname,
        pathname: deepLinkUrl.pathname,
        view: deepLinkUrl.searchParams.get("view"),
        taskId: deepLinkUrl.searchParams.get("taskId"),
        section: deepLinkUrl.searchParams.get("section"),
      },
      {
        protocol: "http:",
        hostname: "127.0.0.1",
        pathname: "/workbench",
        view: "tasks",
        taskId: alpha.taskId,
        section: "planned_changes",
      },
      "the Host cache must expose the exact loopback Task Workbench route",
    );
    assert.equal(
      /^[1-9][0-9]{0,4}$/u.test(deepLinkUrl.port) && Number(deepLinkUrl.port) <= 65_535,
      true,
      "the Workbench deep link must contain a bounded loopback port",
    );
    const launchToken = deepLinkUrl.hash.slice(1);
    assert.equal(
      launchToken.length >= 32 && launchToken.length <= 256,
      true,
      "the Workbench launch fragment must be nonempty and bounded",
    );
    assert.equal(
      /^[A-Za-z0-9_-]+$/u.test(launchToken),
      true,
      "the Workbench launch fragment must be base64url",
    );

    let browser;
    try {
      browser = await launchBrowser({
        executable: workbenchSurface.browserExecutable,
        userDataDir: workbenchSurface.browserProfile,
        timeoutMs: 30_000,
      });
      await browser.navigate(deepLink);
      await browser.waitFor(
        "document.querySelector('[data-testid=\"task-first-workbench\"]') !== null",
        `${hostLabel} cache React Task Workbench`,
        30_000,
      );
      assert.equal(child.exitCode, null, `the active ${hostLabel} cache MCP must remain alive for the Browser session`);
      assert.equal(await browser.evaluate("location.hash"), "", "the launch fragment token must be cleared");
      assert.equal(
        await browser.evaluate(`document.cookie.split(';').some((part) =>
          part.trimStart().startsWith('workbench_session='))`),
        false,
        "the Workbench session cookie must remain HttpOnly",
      );
      const cookieScopeUrl = `${deepLinkUrl.origin}${deepLinkUrl.pathname}${deepLinkUrl.search}`;
      const sessionCookies = (await browser.getCookies([cookieScopeUrl]))
        .filter((cookie) => cookie.name === "workbench_session");
      assert.equal(sessionCookies.length, 1, "the loopback Workbench must set exactly one session cookie");
      const [sessionCookie] = sessionCookies;
      assert.deepEqual(
        {
          name: sessionCookie.name,
          domain: sessionCookie.domain,
          path: sessionCookie.path,
          httpOnly: sessionCookie.httpOnly,
          secure: sessionCookie.secure,
          session: sessionCookie.session,
          sameSite: sessionCookie.sameSite,
        },
        {
          name: "workbench_session",
          domain: "127.0.0.1",
          path: "/",
          httpOnly: true,
          secure: false,
          session: true,
          sameSite: "Strict",
        },
        "Chrome must retain the exact loopback HttpOnly Workbench session policy",
      );
      assert.equal(
        sessionCookie.valueLength >= 32 && sessionCookie.valueLength <= 256,
        true,
        "the Workbench session cookie value must be nonempty and bounded",
      );
      const loadedReactEntry = browser.networkResponses.find((response) => {
        try {
          return new URL(response.url).pathname === reactEntry && response.status === 200;
        } catch {
          return false;
        }
      });
      assert.ok(loadedReactEntry, `the active ${hostLabel} cache must serve its hashed React entry ${reactEntry}`);
      const servedReactDigest = await browser.evaluate(`fetch(${JSON.stringify(reactEntry)}, {
        credentials: 'same-origin',
      }).then(async (response) => {
        if (!response.ok) throw new Error('React asset fetch failed: ' + response.status);
        const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
        return 'sha256:' + [...new Uint8Array(digest)]
          .map((byte) => byte.toString(16).padStart(2, '0')).join('');
      })`);
      assert.equal(servedReactDigest, cachedReactDigest, "Chrome must execute the exact active-cache React bytes");
      await browser.waitFor(bodyContains(alpha.finding.summary), `Codex-created Finding through ${hostLabel} cache`);
      assert.equal(await browser.evaluate(bodyContains(alpha.changedSnapshotId)), true);
      const taskArtifacts = await browser.evaluate(`Promise.all([
        fetch('/tasks/' + encodeURIComponent(${JSON.stringify(alpha.taskId)}) + '/brief.json?section=summary', {
          credentials: 'same-origin', headers: { accept: 'application/json' },
        }),
        fetch('/tasks/' + encodeURIComponent(${JSON.stringify(alpha.taskId)}) + '/change-check.json', {
          credentials: 'same-origin', headers: { accept: 'application/json' },
        }),
      ]).then(async ([brief, check]) => ({
        brief: { statusCode: brief.status, payload: await brief.json() },
        check: { statusCode: check.status, payload: await check.json() },
      }))`);
      assert.equal(taskArtifacts.brief.statusCode, 200);
      assert.equal(taskArtifacts.check.statusCode, 200);
      assert.deepEqual(
        {
          taskId: taskArtifacts.brief.payload.task.taskId,
          status: taskArtifacts.brief.payload.task.status,
          revision: taskArtifacts.brief.payload.task.revision,
          latestSnapshotId: taskArtifacts.brief.payload.task.latestSnapshotId,
          sourceSnapshotId: taskArtifacts.brief.payload.freshness.sourceSnapshotId,
          current: taskArtifacts.brief.payload.freshness.current,
        },
        {
          taskId: alpha.taskId,
          status: "verified",
          revision: alpha.verifiedRevision,
          latestSnapshotId: alpha.changedSnapshotId,
          sourceSnapshotId: alpha.changedSnapshotId,
          current: true,
        },
      );
      assert.equal(taskArtifacts.check.payload.task.taskId, alpha.taskId);
      assert.deepEqual(taskArtifacts.check.payload.freshness, {
        sourceSnapshotId: alpha.changedSnapshotId,
        current: true,
      });
      const projectedCheckArtifact = taskArtifacts.check.payload.artifact;
      assert.equal(projectedCheckArtifact.taskId, alpha.taskId);
      assert.equal(projectedCheckArtifact.revision, alpha.verifiedRevision);
      assert.equal(projectedCheckArtifact.sourceSnapshotId, alpha.changedSnapshotId);
      const projectedFinding = projectedCheckArtifact.payload.findings.find((candidate) =>
        candidate.id === alpha.finding.id,
      );
      assert.ok(projectedFinding, "the cookie-auth Change Check must retain the exact Finding");
      assert.deepEqual(projectedFinding.evidenceIds, [alpha.finding.evidenceId]);

      await browser.click(`[data-testid="task-finding-open"][data-finding-id="${alpha.finding.id}"]`);
      await browser.waitFor(
        `document.querySelector('[data-testid="task-evidence-open"][data-evidence-id="${evidence.id}"]') !== null`,
        "cross-Host Finding Evidence action",
      );
      await browser.click(`[data-testid="task-evidence-open"][data-evidence-id="${evidence.id}"]`);
      await browser.waitFor(
        `(() => {
          const view = document.querySelector('[data-testid="task-evidence-view"], [data-workbench-view="evidence"]');
          return view?.textContent?.includes(${JSON.stringify(evidence.id)}) === true
            && view.textContent.includes('src/index.ts')
            && view.textContent.includes("return 'verified'")
            && view.textContent.includes(${JSON.stringify(ALPHA_NODE_ID)});
        })()`,
        "exact cross-Host Evidence projection",
        30_000,
      );
      const projected = await browser.evaluate(`fetch(
        '/__workbench/evidence?taskId=' + encodeURIComponent(${JSON.stringify(alpha.taskId)})
          + '&evidenceId=' + encodeURIComponent(${JSON.stringify(evidence.id)}),
        { credentials: 'same-origin', headers: { accept: 'application/json' } },
      ).then(async (response) => ({ statusCode: response.status, payload: await response.json() }))`);
      assert.equal(projected.statusCode, 200);
      assert.equal(projected.payload.status, "ready");
      assert.equal(projected.payload.taskId, alpha.taskId);
      assert.equal(projected.payload.snapshotId, alpha.changedSnapshotId);
      assert.equal(projected.payload.evidence.observedAtSnapshotId, alpha.changedSnapshotId);
      assert.deepEqual(
        {
          id: projected.payload.evidence.id,
          filePath: projected.payload.source.filePath,
          evidenceLineRange: projected.payload.evidence.lineRange,
          sourceLineRange: projected.payload.source.lineRange,
          contentHash: projected.payload.evidence.contentHash,
          nodeIds: projected.payload.evidence.nodeIds,
          content: projected.payload.source.content,
        },
        {
          id: evidence.id,
          filePath: "src/index.ts",
          evidenceLineRange: [1, 1],
          sourceLineRange: [1, 1],
          contentHash: contentDigest(Buffer.from(VERIFIED_SOURCE, "utf8")),
          nodeIds: [ALPHA_NODE_ID],
          content: VERIFIED_SOURCE.trimEnd(),
        },
      );

      await browser.click(`[data-testid="task-evidence-open-graph"][data-node-id="${ALPHA_NODE_ID}"]`);
      await browser.waitFor(
        "document.querySelector('[aria-label=\"项目图谱\"]') !== null",
        `${hostLabel} cache Graph surface`,
        30_000,
      );
      await browser.waitFor(
        `(() => {
          const expected = ${JSON.stringify(ALPHA_NODE_ID)};
          return new URL(location.href).searchParams.get('focus') === expected
            && [...document.querySelectorAll('[data-graph-node-id]')]
              .some((node) => node.getAttribute('data-graph-node-id') === expected
                && node.getAttribute('data-selected') === 'true');
        })()`,
        `exact alpha Graph focus through ${hostLabel} cache`,
        30_000,
      );
      await browser.clickText('nav[aria-label="主要界面"] button', "知识库");
      await browser.waitFor(
        "document.querySelector('[aria-label=\"理解项目的五个阶段\"], [aria-label=\"文档正文\"]') !== null",
        `${hostLabel} cache Wiki surface`,
        30_000,
      );
      await browser.evaluate(`(() => {
        const action = document.querySelector('[data-testid="workbench-back-to-task"]');
        if (!(action instanceof HTMLElement)) throw new Error('Workbench has no return-to-Task action');
        action.click();
        return true;
      })()`);
      await browser.waitFor(
        `document.querySelector('[data-testid="task-first-workbench"]')?.textContent?.includes(${JSON.stringify(alpha.finding.summary)}) === true`,
        `Codex-created Task after ${hostLabel} Graph and Wiki`,
        30_000,
      );
      const returnedRoute = new URL(await browser.evaluate("location.href"));
      assert.equal(returnedRoute.searchParams.get("taskId"), alpha.taskId);
      assert.equal(returnedRoute.searchParams.get("findingId"), alpha.finding.id);
      assert.equal(
        returnedRoute.searchParams.get("evidenceId"),
        null,
        "returning to the Finding must leave the Evidence subview",
      );
    } finally {
      await browser?.close();
    }
  });
}

async function expectRootFailure(server, cwd, env, label) {
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
        if (manifest.name === PLUGIN_NAME && manifest.version === version) candidates.push(child);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      await visit(child, depth + 1);
    }
  }
  await visit(cacheRoot, 0);
  assert.equal(candidates.length, 1, "Claude CLI must install exactly one versioned plugin cache root");
  return realpath(candidates[0]);
}

async function writeJson(target, value) {
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function updateJson(target, update) {
  const value = JSON.parse(await readFile(target, "utf8"));
  update(value);
  await writeJson(target, value);
}

async function fileSha256(target) {
  return `sha256:${createHash("sha256").update(await readFile(target)).digest("hex")}`;
}

function releasePluginRoot(releaseRoot, host) {
  return path.join(releaseRoot, "dist/plugin-roots", host);
}

async function assertReleaseVersion(releaseRoot, version) {
  const topLevelCli = path.join(releaseRoot, "dist/understand-code.mjs");
  const hostCliPaths = ["codex", "claude"].map((host) =>
    path.join(releasePluginRoot(releaseRoot, host), "plugins/understand-code/bin/understand-code.mjs")
  );
  for (const hostCliPath of hostCliPaths) {
    assert.deepEqual(
      await readFile(hostCliPath),
      await readFile(topLevelCli),
      "both Host plugin payloads must embed the exact release CLI bytes",
    );
  }
  const codexManifest = JSON.parse(await readFile(
    path.join(releasePluginRoot(releaseRoot, "codex"), "plugins/understand-code/.codex-plugin/plugin.json"),
    "utf8",
  ));
  const claudeManifest = JSON.parse(await readFile(
    path.join(releasePluginRoot(releaseRoot, "claude"), "plugins/understand-code/.claude-plugin/plugin.json"),
    "utf8",
  ));
  const claudeMarketplace = JSON.parse(await readFile(
    path.join(releasePluginRoot(releaseRoot, "claude"), ".claude-plugin/marketplace.json"),
    "utf8",
  ));
  assert.equal(codexManifest.version, version);
  assert.equal(claudeManifest.version, version);
  assert.equal(claudeMarketplace.plugins[0].version, version);
  for (const manifestPath of [
    path.join(releaseRoot, "dist/dashboard-manifest.json"),
    ...["codex", "claude"].map((host) =>
      path.join(releasePluginRoot(releaseRoot, host), "plugins/understand-code/bin/dashboard-manifest.json")
    ),
  ]) {
    assert.equal(JSON.parse(await readFile(manifestPath, "utf8")).productVersion, version);
  }
  const versionResult = await execBounded(process.execPath, [topLevelCli, "--version"], {
    encoding: "utf8",
  });
  assert.equal(versionResult.stdout, `${version}\n`);
  assert.equal(versionResult.stderr, "");
  return { topLevelCli, cliSha256: await fileSha256(topLevelCli) };
}

async function createLifecycleReleases(installedPackageRoot, releasesRoot, v1Version) {
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
      path.join(releasePluginRoot(v2Root, host), "plugins/understand-code/bin/understand-code.mjs"),
    );
  }
  await updateJson(path.join(v2Root, "package.json"), (manifest) => {
    manifest.version = LIFECYCLE_V2_VERSION;
  });
  await updateJson(
    path.join(releasePluginRoot(v2Root, "codex"), "plugins/understand-code/.codex-plugin/plugin.json"),
    (manifest) => {
      manifest.version = LIFECYCLE_V2_VERSION;
    },
  );
  await updateJson(
    path.join(releasePluginRoot(v2Root, "claude"), "plugins/understand-code/.claude-plugin/plugin.json"),
    (manifest) => {
      manifest.version = LIFECYCLE_V2_VERSION;
    },
  );
  await updateJson(
    path.join(releasePluginRoot(v2Root, "claude"), ".claude-plugin/marketplace.json"),
    (marketplace) => {
      marketplace.plugins[0].version = LIFECYCLE_V2_VERSION;
    },
  );
  for (const manifestPath of [
    path.join(v2Root, "dist/dashboard-manifest.json"),
    ...["codex", "claude"].map((host) =>
      path.join(releasePluginRoot(v2Root, host), "plugins/understand-code/bin/dashboard-manifest.json")
    ),
  ]) {
    await updateJson(manifestPath, (manifest) => {
      manifest.productVersion = LIFECYCLE_V2_VERSION;
    });
  }

  const v1 = { root: v1Root, version: v1Version, ...(await assertReleaseVersion(v1Root, v1Version)) };
  const v2 = {
    root: v2Root,
    version: LIFECYCLE_V2_VERSION,
    ...(await assertReleaseVersion(v2Root, LIFECYCLE_V2_VERSION)),
  };
  assert.notEqual(v2.cliSha256, v1.cliSha256, "v2 must contain genuinely version-distinct CLI bytes");
  for (const host of ["codex", "claude"]) {
    const manifest = host === "codex"
      ? "plugins/understand-code/.codex-plugin/plugin.json"
      : "plugins/understand-code/.claude-plugin/plugin.json";
    for (const relativePath of [manifest, "plugins/understand-code/.mcp.json", "plugins/understand-code/bin/understand-code.mjs"]) {
      assert.deepEqual(
        await readFile(path.join(releasePluginRoot(v1Root, host), relativePath)),
        await readFile(path.join(releasePluginRoot(installedPackageRoot, host), relativePath)),
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
  const value = JSON.parse((await execBounded(codexCli, ["plugin", "list", "--json"], {
    cwd,
    env,
    encoding: "utf8",
  })).stdout);
  assert.equal(Array.isArray(value.installed), true);
  const entries = value.installed.filter((entry) => entry.pluginId === `${PLUGIN_NAME}@${MARKETPLACE_NAME}`);
  assert.equal(entries.length, 1, "Codex plugin list must expose one canonical active installation");
  const entry = entries[0];
  assert.deepEqual(
    { version: entry.version, installed: entry.installed, enabled: entry.enabled },
    { version, installed: true, enabled: true },
  );
  return entry;
}

async function activeClaudePlugin(claudeCli, cwd, env, version) {
  const value = JSON.parse((await execBounded(claudeCli, ["plugin", "list", "--json"], {
    cwd,
    env,
    encoding: "utf8",
  })).stdout);
  assert.equal(Array.isArray(value), true);
  const entries = value.filter((entry) => entry.id === `${PLUGIN_NAME}@${MARKETPLACE_NAME}`);
  assert.equal(entries.length, 1, "Claude plugin list must expose one canonical active installation");
  const entry = entries[0];
  assert.deepEqual(
    { version: entry.version, scope: entry.scope, enabled: entry.enabled },
    { version, scope: "user", enabled: true },
  );
  assert.equal(typeof entry.installPath, "string");
  return { entry, installedRoot: await realpath(entry.installPath) };
}

async function assertMissing(target, label) {
  await assert.rejects(access(target), (error) => error?.code === "ENOENT", label);
}

test("real Codex and Claude CLI lifecycles yield cached plugins that execute the packed MCP", async (t) => {
  const originalHome = process.env.HOME ?? "";
  const codexCli = await findExecutable(
    process.env.UNDERSTAND_CODE_CODEX_CLI,
    ["/Applications/ChatGPT.app/Contents/Resources/codex", path.join(originalHome, ".local/bin/codex")],
    "codex",
  );
  const claudeCli = await findExecutable(
    process.env.UNDERSTAND_CODE_CLAUDE_CLI,
    [path.join(originalHome, ".local/bin/claude")],
    "claude",
  );
  if (codexCli === null || claudeCli === null) {
    const message = `real Host CLIs unavailable (codex=${codexCli !== null}, claude=${claudeCli !== null})`;
    if (process.env.UNDERSTAND_CODE_REQUIRE_PLUGIN_HOSTS === "1") assert.fail(message);
    t.skip(message);
    return;
  }
  const browserExecutable = await resolveBrowserExecutable();
  assert.equal(
    process.env.UNDERSTAND_CODE_REQUIRE_REAL_BROWSER === "1" && browserExecutable === null,
    false,
    "UNDERSTAND_CODE_REQUIRE_REAL_BROWSER=1 requires an installed Chrome/Chromium",
  );

  const sandbox = await realpath(await mkdtemp(path.join(tmpdir(), "understand-code-plugin-e2e-")));
  const packDirectory = path.join(sandbox, "pack");
  const installDirectory = path.join(sandbox, "npm-prefix");
  const codexHome = path.join(sandbox, "codex-home");
  const codexUserHome = path.join(sandbox, "codex-user");
  const claudeConfig = path.join(sandbox, "claude-config");
  const claudeUserHome = path.join(sandbox, "claude-user");
  const releasesRoot = path.join(sandbox, "releases");
  const marketplaceFacadeRoot = path.join(sandbox, "marketplace-facade");
  const codexBrowserProfile = path.join(sandbox, "chrome-profile-codex");
  const claudeBrowserProfile = path.join(sandbox, "chrome-profile-claude");
  const differentCwd = path.join(sandbox, "not-the-repository");
  let codexInstalledRoot = null;
  let claudeInstalledRoot = null;
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
    for (const candidate of [primaryRepositoryRoot, repositoryRoot, nestedCwd]) {
      assert.match(candidate, / /u, "the Root fixture must retain a path-space boundary");
      assert.match(candidate, /\p{Script=Han}/u, "the Root fixture must retain a Chinese path boundary");
    }
    assert.equal((await stat(path.join(repositoryRoot, ".git"))).isFile(), true);
    const linkedTopLevel = await realpath((await repositoryGit(
      repositoryRoot,
      ["rev-parse", "--show-toplevel"],
    )).stdout.trim());
    assert.equal(linkedTopLevel, repositoryRoot);
    assert.equal(
      (await repositoryGit(repositoryRoot, ["rev-parse", "--abbrev-ref", "HEAD"])).stdout.trim(),
      "HEAD",
      "the Root fixture must be a detached linked worktree",
    );
    const linkedGitDirRaw = (await repositoryGit(
      repositoryRoot,
      ["rev-parse", "--path-format=absolute", "--git-dir"],
    )).stdout.trim();
    const linkedCommonDirRaw = (await repositoryGit(
      repositoryRoot,
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    )).stdout.trim();
    assert.equal(path.isAbsolute(linkedGitDirRaw), true);
    assert.equal(path.isAbsolute(linkedCommonDirRaw), true);
    const linkedGitDir = await realpath(linkedGitDirRaw);
    const linkedCommonDir = await realpath(linkedCommonDirRaw);
    assert.notEqual(linkedGitDir, linkedCommonDir);
    assert.equal(linkedCommonDir, await realpath(path.join(primaryRepositoryRoot, ".git")));
    const linkedGitFile = await readFile(path.join(repositoryRoot, ".git"), "utf8");
    assert.match(linkedGitFile, /^gitdir: [^\u0000\r\n]+\n$/u);
    assert.equal(
      await realpath(linkedGitFile.slice("gitdir: ".length).trimEnd()),
      linkedGitDir,
    );
    const primarySourcePath = path.join(primaryRepositoryRoot, "src/index.ts");
    const linkedSourcePath = path.join(repositoryRoot, "src/index.ts");
    const primaryIndexPath = await absoluteGitPath(primaryRepositoryRoot, "index");
    const linkedIndexPath = await absoluteGitPath(repositoryRoot, "index");
    assert.equal(linkedIndexPath, await realpath(path.join(linkedGitDir, "index")));
    assert.notEqual(linkedIndexPath, primaryIndexPath);
    const [primarySourceBefore, primaryIndexBefore, linkedSourceBefore] = await Promise.all([
      readFile(primarySourcePath),
      readFile(primaryIndexPath),
      readFile(linkedSourcePath),
    ]);
    const ambientRepositoryRoot = await createRepository(
      path.join(sandbox, "ambient-repository"),
      "export function ambient() { return 'poison-authority'; }\n",
    );
    assert.notEqual(
      (await repositoryGit(ambientRepositoryRoot, ["rev-parse", "HEAD"])).stdout.trim(),
      (await repositoryGit(repositoryRoot, ["rev-parse", "HEAD"])).stdout.trim(),
      "the poisoned ambient repository must have an unrelated commit authority",
    );
    const ambientIndexPath = await absoluteGitPath(ambientRepositoryRoot, "index");
    assert.notEqual(
      contentDigest(await readFile(ambientIndexPath)),
      contentDigest(await readFile(linkedIndexPath)),
      "the poisoned ambient repository must have unrelated index bytes",
    );
    const ambientObjectsPath = path.join(ambientRepositoryRoot, ".git", "objects");
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
      mkdir(codexBrowserProfile, { recursive: true }),
      mkdir(claudeBrowserProfile, { recursive: true }),
      mkdir(differentCwd, { recursive: true }),
    ]);
    let tarballPath;
    if (process.env.UNDERSTAND_CODE_PREVIEW_TARBALL !== undefined) {
      tarballPath = await realpath(path.resolve(process.env.UNDERSTAND_CODE_PREVIEW_TARBALL));
    } else {
      const packed = await execBounded(
        "npm",
        ["pack", ".", "--ignore-scripts", "--pack-destination", packDirectory, "--json"],
        { cwd: packageRoot, encoding: "utf8", timeout: 120_000 },
      );
      const records = JSON.parse(packed.stdout);
      assert.equal(records.length, 1);
      tarballPath = path.join(packDirectory, records[0].filename);
    }
    await execBounded(
      "npm",
      ["install", "--global", "--prefix", installDirectory, "--ignore-scripts", "--no-package-lock", "--no-audit", "--no-fund", tarballPath],
      { cwd: installDirectory, encoding: "utf8", timeout: 120_000 },
    );
    const installedPackageRoot = path.join(
      installDirectory,
      process.platform === "win32" ? "node_modules" : "lib/node_modules",
      "@understand-code/preview",
    );
    const packageManifest = JSON.parse(await readFile(path.join(installedPackageRoot, "package.json"), "utf8"));
    const v1Version = packageManifest.version;
    const releases = await createLifecycleReleases(installedPackageRoot, releasesRoot, v1Version);
    await activateMarketplaceFacade(marketplaceFacadeRoot, releases.v1);
    const codexMarketplaceRoot = path.join(marketplaceFacadeRoot, "codex");
    const claudeMarketplaceRoot = path.join(marketplaceFacadeRoot, "claude");

    const codexEnv = cleanHostEnvironment(codexUserHome, {
      CODEX_HOME: codexHome,
      PATH: `${path.dirname(codexCli)}${path.delimiter}${process.env.PATH ?? "/usr/bin:/bin"}`,
    });
    const codexMarketplace = JSON.parse(
      (await execBounded(codexCli, ["plugin", "marketplace", "add", codexMarketplaceRoot, "--json"], {
        cwd: differentCwd,
        env: codexEnv,
        encoding: "utf8",
      })).stdout,
    );
    assert.equal(codexMarketplace.marketplaceName, MARKETPLACE_NAME);
    const codexInstall = JSON.parse(
      (await execBounded(codexCli, ["plugin", "add", `${PLUGIN_NAME}@${MARKETPLACE_NAME}`, "--json"], {
        cwd: differentCwd,
        env: codexEnv,
        encoding: "utf8",
      })).stdout,
    );
    assert.equal(codexInstall.pluginId, `${PLUGIN_NAME}@${MARKETPLACE_NAME}`);
    assert.equal(codexInstall.version, v1Version);
    await activeCodexPlugin(codexCli, differentCwd, codexEnv, v1Version);
    codexInstalledRoot = await realpath(codexInstall.installedPath);
    assert.equal(codexInstalledRoot.startsWith(`${await realpath(codexHome)}${path.sep}`), true);
    assert.equal(
      await fileSha256(path.join(codexInstalledRoot, "bin/understand-code.mjs")),
      releases.v1.cliSha256,
      "the official Codex add installedPath must contain the exact v1 bundled CLI bytes",
    );
    assert.deepEqual(
      await readFile(path.join(codexInstalledRoot, "bin/dashboard-manifest.json")),
      await readFile(path.join(
        releasePluginRoot(releases.v1.root, "codex"),
        "plugins/understand-code/bin/dashboard-manifest.json",
      )),
      "the official Codex add installedPath must contain the exact v1 Dashboard manifest",
    );
    const codexList = await execBounded(codexCli, ["plugin", "list"], {
      cwd: differentCwd,
      env: codexEnv,
      encoding: "utf8",
    });
    assert.match(codexList.stdout, /understand-code@understand-code-alpha\s+installed, enabled/u);
    const codexMcpList = JSON.parse(
      (await execBounded(codexCli, ["mcp", "list", "--json"], {
        cwd: differentCwd,
        env: codexEnv,
        encoding: "utf8",
      })).stdout,
    );
    const registeredCodexMcp = codexMcpList.find((server) => server.name === PLUGIN_NAME);
    assert.ok(registeredCodexMcp, "Codex CLI must register the installed plugin MCP server");
    assert.equal(registeredCodexMcp.enabled, true);
    assert.equal(registeredCodexMcp.transport.type, "stdio");
    assert.equal(registeredCodexMcp.transport.command, "./bin/understand-code-plugin.mjs");
    assert.deepEqual(registeredCodexMcp.transport.args, ["--host", "codex"]);
    const registeredCodexMcpDetail = JSON.parse(
      (await execBounded(codexCli, ["mcp", "get", PLUGIN_NAME, "--json"], {
        cwd: differentCwd,
        env: codexEnv,
        encoding: "utf8",
      })).stdout,
    );
    assert.equal(registeredCodexMcpDetail.name, PLUGIN_NAME);
    assert.equal(registeredCodexMcpDetail.enabled, true);
    assert.deepEqual(registeredCodexMcpDetail.transport, registeredCodexMcp.transport);
    await runInstalledHostDoctor({
      installedPackageRoot: releases.v1.root,
      host: "codex",
      version: v1Version,
      cwd: differentCwd,
      env: codexEnv,
      expectedStatus: "healthy",
    });
    const codexAlpha = await exerciseInstalledAlpha({
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
      clientName: "codex-plugin-e2e",
    });
    await resumeInstalledAlpha(
      {
        host: "codex",
        installedRoot: codexInstalledRoot,
        version: v1Version,
        repositoryRoot,
        cwd: nestedCwd,
        env: cleanHostEnvironment(codexUserHome, {
          CODEX_HOME: codexHome,
          ...poisonGitAuthority,
        }),
        clientName: "codex-plugin-e2e-workbench",
      },
      codexAlpha.result,
      browserExecutable === null
        ? undefined
        : { browserExecutable, browserProfile: codexBrowserProfile },
    );
    await expectRootFailure(
      codexAlpha.server,
      differentCwd,
      cleanHostEnvironment(codexUserHome, { CODEX_HOME: codexHome }),
      "Codex plugin must reject a non-repository working root",
    );

    const claudeEnv = cleanHostEnvironment(claudeUserHome, {
      CLAUDE_CONFIG_DIR: claudeConfig,
      PATH: `${path.dirname(claudeCli)}${path.delimiter}${process.env.PATH ?? "/usr/bin:/bin"}`,
    });
    await execBounded(claudeCli, ["plugin", "validate", "--strict", claudeMarketplaceRoot], {
      cwd: differentCwd,
      env: claudeEnv,
      encoding: "utf8",
    });
    await execBounded(claudeCli, ["plugin", "marketplace", "add", claudeMarketplaceRoot, "--scope", "user"], {
      cwd: differentCwd,
      env: claudeEnv,
      encoding: "utf8",
    });
    const claudeMarketplaces = JSON.parse(
      (await execBounded(claudeCli, ["plugin", "marketplace", "list", "--json"], {
        cwd: differentCwd,
        env: claudeEnv,
        encoding: "utf8",
      })).stdout,
    );
    assert.match(JSON.stringify(claudeMarketplaces), new RegExp(MARKETPLACE_NAME, "u"));
    await execBounded(claudeCli, ["plugin", "install", `${PLUGIN_NAME}@${MARKETPLACE_NAME}`, "--scope", "user"], {
      cwd: differentCwd,
      env: claudeEnv,
      encoding: "utf8",
    });
    const activeClaudeV1 = await activeClaudePlugin(
      claudeCli,
      differentCwd,
      claudeEnv,
      v1Version,
    );
    claudeInstalledRoot = activeClaudeV1.installedRoot;
    assert.equal(claudeInstalledRoot.startsWith(`${await realpath(claudeConfig)}${path.sep}`), true);
    assert.deepEqual(
      await readFile(path.join(claudeInstalledRoot, "bin/dashboard-manifest.json")),
      await readFile(path.join(
        releasePluginRoot(releases.v1.root, "claude"),
        "plugins/understand-code/bin/dashboard-manifest.json",
      )),
      "the authoritative Claude cache must contain the exact v1 Dashboard manifest",
    );
    await runInstalledHostDoctor({
      installedPackageRoot: releases.v1.root,
      host: "claude",
      version: v1Version,
      cwd: differentCwd,
      env: claudeEnv,
      expectedStatus: "healthy",
    });
    const claudeAlpha = await resumeInstalledAlpha(
      {
        host: "claude",
        installedRoot: claudeInstalledRoot,
        version: v1Version,
        repositoryRoot,
        cwd: differentCwd,
        env: cleanHostEnvironment(claudeUserHome, {
          CLAUDE_CONFIG_DIR: claudeConfig,
          CLAUDE_PROJECT_DIR: nestedCwd,
          ...poisonGitAuthority,
        }),
        clientName: "claude-plugin-e2e",
      },
      codexAlpha.result,
      browserExecutable === null
        ? undefined
        : { browserExecutable, browserProfile: claudeBrowserProfile },
    );
    assert.equal(
      (await stat(path.join(repositoryRoot, ".understand-code"))).isDirectory(),
      true,
      "both cached MCP launches must publish only inside the explicitly selected repository",
    );
    await assertMissing(
      path.join(ambientRepositoryRoot, ".understand-code"),
      "ambient Git authority must not redirect artifacts into another real repository",
    );
    await assertMissing(
      path.join(primaryRepositoryRoot, ".understand-code"),
      "the linked-worktree session must not publish into the primary worktree",
    );
    await expectRootFailure(
      claudeAlpha.server,
      differentCwd,
      cleanHostEnvironment(claudeUserHome, { CLAUDE_CONFIG_DIR: claudeConfig }),
      "Claude plugin must reject a missing CLAUDE_PROJECT_DIR",
    );

    assert.deepEqual(
      await readFile(path.join(codexInstalledRoot, "bin/understand-code.mjs")),
      await readFile(path.join(claudeInstalledRoot, "bin/understand-code.mjs")),
      "both mandatory Host plugins must install the same-version bundled MCP executable",
    );

    const claudeV1InstalledRoot = claudeInstalledRoot;
    await activateMarketplaceFacade(marketplaceFacadeRoot, releases.v2);

    const codexV2Reinstall = JSON.parse(
      (await execBounded(codexCli, ["plugin", "add", `${PLUGIN_NAME}@${MARKETPLACE_NAME}`, "--json"], {
        cwd: differentCwd,
        env: codexEnv,
        encoding: "utf8",
      })).stdout,
    );
    assert.equal(codexV2Reinstall.pluginId, `${PLUGIN_NAME}@${MARKETPLACE_NAME}`);
    assert.equal(codexV2Reinstall.version, releases.v2.version);
    await activeCodexPlugin(
      codexCli,
      differentCwd,
      codexEnv,
      releases.v2.version,
    );
    codexInstalledRoot = await realpath(codexV2Reinstall.installedPath);
    assert.equal(
      await fileSha256(path.join(codexInstalledRoot, "bin/understand-code.mjs")),
      releases.v2.cliSha256,
    );
    await runInstalledHostDoctor({
      installedPackageRoot: releases.v2.root,
      host: "codex",
      version: releases.v2.version,
      cwd: differentCwd,
      env: codexEnv,
      expectedStatus: "healthy",
    });
    await resumeInstalledAlpha(
      {
        host: "codex",
        installedRoot: codexInstalledRoot,
        version: releases.v2.version,
        repositoryRoot,
        cwd: nestedCwd,
        env: cleanHostEnvironment(codexUserHome, {
          CODEX_HOME: codexHome,
          ...poisonGitAuthority,
        }),
        clientName: "codex-plugin-e2e-lifecycle-v2",
      },
      codexAlpha.result,
    );

    await execBounded(claudeCli, ["plugin", "marketplace", "update", MARKETPLACE_NAME], {
      cwd: differentCwd,
      env: claudeEnv,
      encoding: "utf8",
    });
    await execBounded(
      claudeCli,
      ["plugin", "update", `${PLUGIN_NAME}@${MARKETPLACE_NAME}`, "--scope", "user"],
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
      await fileSha256(path.join(claudeInstalledRoot, "bin/understand-code.mjs")),
      releases.v2.cliSha256,
    );
    assert.equal(
      await findClaudeInstalledRoot(claudeConfig, v1Version),
      claudeV1InstalledRoot,
      "Claude v1 cache may remain only as an inert non-authoritative residual",
    );
    await runInstalledHostDoctor({
      installedPackageRoot: releases.v2.root,
      host: "claude",
      version: releases.v2.version,
      cwd: differentCwd,
      env: claudeEnv,
      expectedStatus: "healthy",
    });
    await resumeInstalledAlpha(
      {
        host: "claude",
        installedRoot: claudeInstalledRoot,
        version: releases.v2.version,
        repositoryRoot,
        cwd: differentCwd,
        env: cleanHostEnvironment(claudeUserHome, {
          CLAUDE_CONFIG_DIR: claudeConfig,
          CLAUDE_PROJECT_DIR: nestedCwd,
          ...poisonGitAuthority,
        }),
        clientName: "claude-plugin-e2e-lifecycle-v2",
      },
      codexAlpha.result,
    );
    assert.deepEqual(
      await readFile(path.join(codexInstalledRoot, "bin/understand-code.mjs")),
      await readFile(path.join(claudeInstalledRoot, "bin/understand-code.mjs")),
      "both active v2 Host installations must execute the exact same bundle bytes",
    );

    await execBounded(codexCli, ["plugin", "remove", `${PLUGIN_NAME}@${MARKETPLACE_NAME}`, "--json"], {
      cwd: differentCwd,
      env: codexEnv,
      encoding: "utf8",
    });
    await assertMissing(codexInstalledRoot, "Codex remove must delete the active v2 official installedPath");
    await activateMarketplaceFacade(marketplaceFacadeRoot, releases.v1);
    const codexPinnedV1Install = JSON.parse(
      (await execBounded(codexCli, ["plugin", "add", `${PLUGIN_NAME}@${MARKETPLACE_NAME}`, "--json"], {
        cwd: differentCwd,
        env: codexEnv,
        encoding: "utf8",
      })).stdout,
    );
    assert.equal(codexPinnedV1Install.version, v1Version);
    await activeCodexPlugin(
      codexCli,
      differentCwd,
      codexEnv,
      v1Version,
    );
    codexInstalledRoot = await realpath(codexPinnedV1Install.installedPath);
    assert.equal(
      await fileSha256(path.join(codexInstalledRoot, "bin/understand-code.mjs")),
      releases.v1.cliSha256,
    );
    await runInstalledHostDoctor({
      installedPackageRoot: releases.v1.root,
      host: "codex",
      version: v1Version,
      cwd: differentCwd,
      env: codexEnv,
      expectedStatus: "healthy",
    });
    await resumeInstalledAlpha(
      {
        host: "codex",
        installedRoot: codexInstalledRoot,
        version: v1Version,
        repositoryRoot,
        cwd: nestedCwd,
        env: cleanHostEnvironment(codexUserHome, {
          CODEX_HOME: codexHome,
          ...poisonGitAuthority,
        }),
        clientName: "codex-plugin-e2e-pinned-v1-reinstall",
      },
      codexAlpha.result,
    );

    await execBounded(
      claudeCli,
      ["plugin", "uninstall", `${PLUGIN_NAME}@${MARKETPLACE_NAME}`, "--scope", "user", "--yes"],
      { cwd: differentCwd, env: claudeEnv, encoding: "utf8" },
    );
    assert.deepEqual(
      JSON.parse((await execBounded(claudeCli, ["plugin", "list", "--json"], {
        cwd: differentCwd,
        env: claudeEnv,
        encoding: "utf8",
      })).stdout),
      [],
      "Claude uninstall must clear the authoritative active registration before pinned-v1 reinstall",
    );
    await execBounded(claudeCli, ["plugin", "marketplace", "update", MARKETPLACE_NAME], {
      cwd: differentCwd,
      env: claudeEnv,
      encoding: "utf8",
    });
    await execBounded(
      claudeCli,
      ["plugin", "install", `${PLUGIN_NAME}@${MARKETPLACE_NAME}`, "--scope", "user"],
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
      await fileSha256(path.join(claudeInstalledRoot, "bin/understand-code.mjs")),
      releases.v1.cliSha256,
    );
    await runInstalledHostDoctor({
      installedPackageRoot: releases.v1.root,
      host: "claude",
      version: v1Version,
      cwd: differentCwd,
      env: claudeEnv,
      expectedStatus: "healthy",
    });
    await resumeInstalledAlpha(
      {
        host: "claude",
        installedRoot: claudeInstalledRoot,
        version: v1Version,
        repositoryRoot,
        cwd: differentCwd,
        env: cleanHostEnvironment(claudeUserHome, {
          CLAUDE_CONFIG_DIR: claudeConfig,
          CLAUDE_PROJECT_DIR: nestedCwd,
          ...poisonGitAuthority,
        }),
        clientName: "claude-plugin-e2e-pinned-v1-reinstall",
      },
      codexAlpha.result,
    );
    assert.deepEqual(
      await readFile(path.join(codexInstalledRoot, "bin/understand-code.mjs")),
      await readFile(path.join(claudeInstalledRoot, "bin/understand-code.mjs")),
      "both pinned-v1 Host reinstalls must execute the exact v1 bundle bytes",
    );

    await execBounded(codexCli, ["plugin", "remove", `${PLUGIN_NAME}@${MARKETPLACE_NAME}`, "--json"], {
      cwd: differentCwd,
      env: codexEnv,
      encoding: "utf8",
    });
    await execBounded(codexCli, ["plugin", "marketplace", "remove", MARKETPLACE_NAME], {
      cwd: differentCwd,
      env: codexEnv,
      encoding: "utf8",
    });
    await assertMissing(codexInstalledRoot, "Codex remove must clean the installed plugin cache");
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
      (await execBounded(codexCli, ["plugin", "marketplace", "list"], { env: codexEnv, encoding: "utf8" })).stdout,
      /No plugin marketplaces in scope\./u,
    );

    await execBounded(claudeCli, ["plugin", "uninstall", `${PLUGIN_NAME}@${MARKETPLACE_NAME}`, "--scope", "user", "--yes"], {
      cwd: differentCwd,
      env: claudeEnv,
      encoding: "utf8",
    });
    await execBounded(claudeCli, ["plugin", "marketplace", "remove", MARKETPLACE_NAME, "--scope", "user"], {
      cwd: differentCwd,
      env: claudeEnv,
      encoding: "utf8",
    });
    const claudeAfter = JSON.parse(
      (await execBounded(claudeCli, ["plugin", "list", "--json"], { env: claudeEnv, encoding: "utf8" })).stdout,
    );
    assert.deepEqual(claudeAfter, []);
    const claudeMarketplacesAfter = JSON.parse(
      (await execBounded(claudeCli, ["plugin", "marketplace", "list", "--json"], {
        env: claudeEnv,
        encoding: "utf8",
      })).stdout,
    );
    assert.deepEqual(claudeMarketplacesAfter, []);
    await runInstalledHostDoctor({
      installedPackageRoot: releases.v1.root,
      host: "claude",
      version: v1Version,
      cwd: differentCwd,
      env: claudeEnv,
      expectedStatus: "not_registered",
    });
    // Claude Code keeps an inert version cache after uninstall; the isolated config sandbox below
    // is the cleanup boundary, while plugin list is the authoritative installation state.
    claudeInstalledRoot = null;
    assert.equal(
      (await stat(path.join(repositoryRoot, ".understand-code"))).isDirectory(),
      true,
      "the complete Host lifecycle must retain its Task artifacts only in the linked worktree",
    );
    await Promise.all([
      assertMissing(
        path.join(primaryRepositoryRoot, ".understand-code"),
        "the primary worktree must remain free of linked-worktree artifacts",
      ),
      assertMissing(
        path.join(ambientRepositoryRoot, ".understand-code"),
        "the poisoned ambient repository must remain free of artifacts",
      ),
    ]);
    assert.equal(
      (await repositoryGit(
        primaryRepositoryRoot,
        ["status", "--porcelain=v1", "--untracked-files=all"],
      )).stdout,
      "",
      "the primary worktree must remain completely clean",
    );
    assert.deepEqual(await readFile(primarySourcePath), primarySourceBefore);
    assert.deepEqual(await readFile(primaryIndexPath), primaryIndexBefore);
    assert.notDeepEqual(await readFile(linkedSourcePath), linkedSourceBefore);
    assert.deepEqual(await readFile(linkedSourcePath), Buffer.from(VERIFIED_SOURCE, "utf8"));
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});
