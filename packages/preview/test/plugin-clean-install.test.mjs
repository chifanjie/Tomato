import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { createInterface } from "node:readline";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const PROCESS_TIMEOUT_MS = 20_000;
const EXTERNAL_TIMEOUT_MS = 60_000;
const PLUGIN_NAME = "understand-code";
const MARKETPLACE_NAME = "understand-code-alpha";
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
  assert.equal(message.result.isError, false, `${name} must report success`);
  assert.equal(message.result.structuredContent.schemaVersion, 1);
  return message.result;
}

async function createRepository(root) {
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(
    path.join(root, "src/index.ts"),
    "export function alpha() { return true; }\n",
  );
  const gitEnv = {
    ...process.env,
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
    const result = await exercise({ child, output });
    child.stdin.end();
    assert.deepEqual(await waitForExit(child, `${clientName} clean exit`), [0, null]);
    assert.equal(output.stderr.join(""), "");
    return { server, result };
  } finally {
    await stopChild(child);
  }
}

async function exerciseInstalledAlpha(options) {
  const { repositoryRoot, clientName } = options;
  const sourcePath = path.join(repositoryRoot, "src/index.ts");
  const sourceBefore = await readFile(sourcePath);
  const indexBefore = createHash("sha256")
    .update(await readFile(path.join(repositoryRoot, ".git/index")))
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
    const pulse = await callTool(child, output, requestId++, "get_repo_pulse", {});
    assert.equal(
      pulse.structuredContent.meta.sourceSnapshotId,
      initialSnapshotId,
      "the installed Host plugin must read the exact snapshot it created for the bound repository",
    );

    const built = await callTool(child, output, requestId++, "build_task_brief", {
      task: "Change src/index.ts and verify its observable behavior.",
      expectedRevision: 0,
      idempotencyKey: `${clientName}-brief`,
      actor,
      scope: ["src/index.ts"],
    });
    const taskId = built.structuredContent.result.task.taskId;
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
    assert.ok(brief.plannedChanges.length > 0, "the Brief must contain a confirmable plan");
    await updateTask(
      { type: "confirm_plan", plannedChangeIds: brief.plannedChanges.map((change) => change.id) },
      `${clientName}-confirm-plan`,
    );
    await updateTask({ type: "transition_status", to: "planned" }, `${clientName}-planned`);
    await updateTask({ type: "transition_status", to: "in_progress" }, `${clientName}-in-progress`);

    await writeFile(
      sourcePath,
      "export function alpha() { return 'verified'; }\n",
      "utf8",
    );
    assert.notDeepEqual(await readFile(sourcePath), sourceBefore);
    assert.equal(
      createHash("sha256")
        .update(await readFile(path.join(repositoryRoot, ".git/index")))
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
    const targetPlannedChanges = brief.plannedChanges.filter(
      (change) => change.filePath === "src/index.ts",
    );
    assert.ok(targetPlannedChanges.length > 0, "the Brief must plan the edited source file");
    for (const plannedChange of targetPlannedChanges) {
      const finding = changeCheck.findings.find(
        (candidate) =>
          candidate.plannedChangeIds.includes(plannedChange.id) &&
          candidate.actualChangeIds.length > 0,
      );
      assert.ok(finding, `the Check must link actual change evidence to ${plannedChange.id}`);
      assert.ok(
        finding.type === "planned_completed" || finding.type === "planned_partial",
        `the edited planned file must have a reachable planned classification, got ${finding.type}`,
      );
      assert.equal(finding.blocking, false);
    }
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
      baselineSnapshotId: built.structuredContent.result.task.baselineSnapshotId,
      changedSnapshotId,
      verifiedRevision: verified.structuredContent.result.task.revision,
      verificationRequests,
      verificationResults,
    };
  });
}

async function resumeInstalledAlpha(options, alpha) {
  return withInstalledMcp(options, async ({ child, output }) => {
    const resumed = await callTool(child, output, 3, "get_task_brief", {
      taskId: alpha.taskId,
      section: "summary",
    });
    assert.equal(resumed.structuredContent.result.task.taskId, alpha.taskId);
    assert.equal(resumed.structuredContent.result.task.status, "verified");
    assert.equal(resumed.structuredContent.result.task.revision, alpha.verifiedRevision);
    assert.equal(
      resumed.structuredContent.result.task.baselineSnapshotId,
      alpha.baselineSnapshotId,
    );
    assert.equal(resumed.structuredContent.meta.sourceSnapshotId, alpha.changedSnapshotId);
    for (const [index, request] of alpha.verificationRequests.entries()) {
      const replayed = await callTool(
        child,
        output,
        4 + index,
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
      4 + alpha.verificationRequests.length,
      "get_task_brief",
      { taskId: alpha.taskId, section: "summary" },
    );
    assert.equal(afterReplay.structuredContent.result.task.revision, alpha.verifiedRevision);
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

  const sandbox = await realpath(await mkdtemp(path.join(tmpdir(), "understand-code-plugin-e2e-")));
  const packDirectory = path.join(sandbox, "pack");
  const installDirectory = path.join(sandbox, "npm-prefix");
  const codexHome = path.join(sandbox, "codex-home");
  const codexUserHome = path.join(sandbox, "codex-user");
  const claudeConfig = path.join(sandbox, "claude-config");
  const claudeUserHome = path.join(sandbox, "claude-user");
  const repositoryRoot = await createRepository(path.join(sandbox, "repository"));
  const ambientRepositoryRoot = await createRepository(path.join(sandbox, "ambient-repository"));
  const differentCwd = path.join(sandbox, "not-the-repository");
  let codexInstalledRoot = null;
  let claudeInstalledRoot = null;
  try {
    await Promise.all([
      mkdir(packDirectory, { recursive: true }),
      mkdir(installDirectory, { recursive: true }),
      mkdir(codexHome, { recursive: true }),
      mkdir(codexUserHome, { recursive: true }),
      mkdir(claudeConfig, { recursive: true }),
      mkdir(claudeUserHome, { recursive: true }),
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
    const version = packageManifest.version;
    const codexMarketplaceRoot = path.join(installedPackageRoot, "dist/plugin-roots/codex");
    const claudeMarketplaceRoot = path.join(installedPackageRoot, "dist/plugin-roots/claude");

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
    assert.equal(codexInstall.version, version);
    codexInstalledRoot = await realpath(codexInstall.installedPath);
    assert.equal(codexInstalledRoot.startsWith(`${await realpath(codexHome)}${path.sep}`), true);
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
      installedPackageRoot,
      host: "codex",
      version,
      cwd: differentCwd,
      env: codexEnv,
      expectedStatus: "healthy",
    });
    const codexAlpha = await exerciseInstalledAlpha({
      host: "codex",
      installedRoot: codexInstalledRoot,
      version,
      repositoryRoot,
      cwd: repositoryRoot,
      env: cleanHostEnvironment(codexUserHome, {
        CODEX_HOME: codexHome,
        GIT_DIR: path.join(ambientRepositoryRoot, ".git"),
        GIT_WORK_TREE: ambientRepositoryRoot,
      }),
      clientName: "codex-plugin-e2e",
    });
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
    const claudePlugins = JSON.parse(
      (await execBounded(claudeCli, ["plugin", "list", "--json"], {
        cwd: differentCwd,
        env: claudeEnv,
        encoding: "utf8",
      })).stdout,
    );
    assert.match(JSON.stringify(claudePlugins), /understand-code@understand-code-alpha/u);
    claudeInstalledRoot = await findClaudeInstalledRoot(claudeConfig, version);
    assert.equal(claudeInstalledRoot.startsWith(`${await realpath(claudeConfig)}${path.sep}`), true);
    await runInstalledHostDoctor({
      installedPackageRoot,
      host: "claude",
      version,
      cwd: differentCwd,
      env: claudeEnv,
      expectedStatus: "healthy",
    });
    const claudeAlpha = await resumeInstalledAlpha(
      {
        host: "claude",
        installedRoot: claudeInstalledRoot,
        version,
        repositoryRoot,
        cwd: differentCwd,
        env: cleanHostEnvironment(claudeUserHome, {
          CLAUDE_CONFIG_DIR: claudeConfig,
          CLAUDE_PROJECT_DIR: repositoryRoot,
          GIT_DIR: path.join(ambientRepositoryRoot, ".git"),
          GIT_WORK_TREE: ambientRepositoryRoot,
        }),
        clientName: "claude-plugin-e2e",
      },
      codexAlpha.result,
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
      installedPackageRoot,
      host: "codex",
      version,
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
      installedPackageRoot,
      host: "claude",
      version,
      cwd: differentCwd,
      env: claudeEnv,
      expectedStatus: "not_registered",
    });
    // Claude Code keeps an inert version cache after uninstall; the isolated config sandbox below
    // is the cleanup boundary, while plugin list is the authoritative installation state.
    claudeInstalledRoot = null;
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});
