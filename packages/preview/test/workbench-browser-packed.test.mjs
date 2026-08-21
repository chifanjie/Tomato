import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { chmod, cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
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
  UpdateTaskOutputV1Schema,
} from "../../contracts/dist/index.js";
import { launchBrowser, resolveBrowserExecutable } from "./browser-harness.mjs";

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
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
const FOO_NODE_ID = "function:src/index.ts:foo";
const BAR_NODE_ID = "function:src/index.ts:bar";

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
  await git(root, ["init", "-q"]);
  await git(root, ["add", ".gitignore", "README.md", "src/index.ts"]);
  await git(root, ["commit", "-q", "-m", "Workbench browser fixture"]);
  return root;
}

async function resolveTarball(packDirectory) {
  const supplied = process.env.UNDERSTAND_CODE_PREVIEW_TARBALL;
  if (supplied !== undefined) return { path: path.resolve(supplied), supplied: true };
  const packed = await execBounded(
    "npm",
    ["pack", ".", "--ignore-scripts", "--pack-destination", packDirectory, "--json"],
    { cwd: packageRoot, encoding: "utf8" },
  );
  const records = JSON.parse(packed.stdout);
  assert.equal(records.length, 1, "npm pack must produce one Preview tgz");
  const tarballs = (await readdir(packDirectory)).filter((entry) => entry.endsWith(".tgz"));
  assert.deepEqual(tarballs, [records[0].filename]);
  return { path: path.join(packDirectory, tarballs[0]), supplied: false, entryCount: records[0].entryCount };
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

async function createUpgradeRelease(installedPackageRoot, baseVersion) {
  const releaseRoot = await realpath(await mkdtemp(path.join(tmpdir(), "uc-managed-dashboard-upgrade-")));
  const upgradedVersion = "9.9.9-managed-lifecycle.2";
  assert.notEqual(upgradedVersion, baseVersion);
  const sourceRoot = path.join(installedPackageRoot, "dist");
  const bundlePath = path.join(releaseRoot, "understand-code.mjs");
  const dashboardRoot = path.join(releaseRoot, "dashboard");
  await Promise.all([
    cp(path.join(sourceRoot, "understand-code.mjs"), bundlePath),
    cp(path.join(sourceRoot, "native"), path.join(releaseRoot, "native"), { recursive: true }),
    cp(path.join(sourceRoot, "dashboard"), dashboardRoot, { recursive: true }),
  ]);
  const bundle = await readFile(bundlePath, "utf8");
  const versionOccurrences = bundle.split(baseVersion).length - 1;
  assert.ok(versionOccurrences > 0, "the packed CLI must carry its product version literal");
  await writeFile(bundlePath, bundle.replaceAll(baseVersion, upgradedVersion), "utf8");
  await chmod(bundlePath, 0o755);

  const indexPath = path.join(dashboardRoot, "index.html");
  const index = await readFile(indexPath, "utf8");
  const marker = `<meta name="understand-code-lifecycle-release" content="${upgradedVersion}">`;
  assert.match(index, /<\/head>/iu);
  await writeFile(indexPath, index.replace(/<\/head>/iu, `${marker}</head>`), "utf8");
  const descriptor = await dashboardInventory(dashboardRoot);
  await writeFile(
    path.join(releaseRoot, "dashboard-manifest.json"),
    `${JSON.stringify({
      schemaVersion: "understand-code-dashboard-bundle-v1",
      productVersion: upgradedVersion,
      root: "dashboard",
      fileCount: descriptor.fileCount,
      inventorySha256: descriptor.inventorySha256,
    }, null, 2)}\n`,
    "utf8",
  );
  return { releaseRoot, bundlePath, upgradedVersion, descriptor };
}

function expectedReactEntry(indexHtml) {
  const match = indexHtml.match(/<script\b[^>]*\bsrc=["'](?<source>\/assets\/index-[A-Za-z0-9_-]+\.js)["'][^>]*>/iu);
  assert.ok(match?.groups?.source, "the installed Dashboard must name one hashed React entry asset");
  return match.groups.source;
}

function bodyContains(value) {
  return `document.body?.innerText?.includes(${JSON.stringify(value)}) === true`;
}

test("installed tgz opens the React Workbench and preserves snapshot-bound Task evidence", { timeout: 240_000 }, async (t) => {
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

  const packDirectory = await mkdtemp(path.join(tmpdir(), "uc-workbench-browser-pack-"));
  const installDirectory = await mkdtemp(path.join(tmpdir(), "uc-workbench-browser-install-"));
  const browserProfile = await mkdtemp(path.join(tmpdir(), "uc-workbench-browser-profile-"));
  const home = await mkdtemp(path.join(tmpdir(), "uc-workbench-browser-home-"));
  let repositoryRoot = await createRepositoryFixture();
  const repositoryRoots = [repositoryRoot];
  let browser = null;
  let mcp = null;
  let upgradeReleaseRoot = null;
  let retainPackDirectory = false;
  try {
    const tarball = await resolveTarball(packDirectory);
    const tarballPath = tarball.path;
    const tarballBefore = await readFile(tarballPath);
    const entryCount = packedRegularFileCount(tarballBefore);
    if (tarball.entryCount !== undefined) assert.equal(entryCount, tarball.entryCount);
    await execBounded(
      "npm",
      ["install", "--global", "--prefix", installDirectory, "--ignore-scripts", "--no-package-lock", "--no-audit", "--no-fund", tarballPath],
      { cwd: installDirectory, encoding: "utf8" },
    );
    const installed = installedLocations(installDirectory);
    const packageManifest = JSON.parse(
      await readFile(path.join(installed.packageRoot, "package.json"), "utf8"),
    );
    const baseVersion = packageManifest.version;
    assert.equal(typeof baseVersion, "string");
    const installedIndexHtml = await readFile(path.join(installed.packageRoot, "dist/dashboard/index.html"), "utf8");
    const reactEntry = expectedReactEntry(installedIndexHtml);
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
    const managedDashboardRoot = path.join(managedInstallRoot, "lib/dashboard");
    const managedDashboardManifestPath = path.join(managedInstallRoot, "lib/dashboard-manifest.json");
    const managedManifestPath = path.join(managedInstallRoot, "installation-manifest.json");
    const rollbackPath = path.join(managedInstallRoot, "installation-rollback.json");
    const sentinelPath = path.join(managedInstallRoot, "user-owned.txt");
    await writeFile(sentinelPath, "preserve user bytes\n", "utf8");
    const initialManagedBundle = await readFile(managedBundle);
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
    const initialManagedManifest = JSON.parse(await readFile(managedManifestPath, "utf8"));
    assert.equal(initialManagedManifest.workbenchUi, "react_dashboard_v1");
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
    sourcePath = path.join(repositoryRoot, "src/index.ts");
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
      task: "Change the foo function and verify its observable behavior.",
      expectedRevision: 0,
      idempotencyKey: "preview-workbench-browser-brief",
      actor,
      scope: ["src/index.ts"],
      maxCandidates: 1,
    }, BuildTaskBriefOutputV1Schema);
    const taskId = built.structuredContent.result.task.taskId;
    const brief = built.structuredContent.result.brief;
    assert.deepEqual(
      brief.plannedChanges.map((change) => change.symbolId),
      [FOO_NODE_ID],
      "the happy path must carry one confirmed foo-symbol obligation",
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

    await writeFile(sourcePath, FOO_ONLY_SOURCE, "utf8");
    const changedRefresh = await callTool(mcp, output, requestId++, "refresh_index", {
      mode: "full",
      expectedSourceSnapshotId: initialSnapshotId,
      idempotencyKey: "preview-workbench-browser-changed-refresh",
      actor,
    }, RefreshIndexOutputV1Schema);
    const changedSnapshotId = changedRefresh.structuredContent.meta.sourceSnapshotId;
    assert.notEqual(changedSnapshotId, initialSnapshotId);

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
    assert.equal(
      checked.structuredContent.result.changeCheck.findings.some((candidate) => candidate.blocking),
      false,
      "the exact foo hunk must not leave a blocking Change Finding",
    );
    assert.equal(
      checked.structuredContent.result.changeCheck.findings.some((candidate) => candidate.type === "unplanned_change"),
      false,
      "the exact foo-only edit must not be classified as unplanned",
    );
    const finding = checked.structuredContent.result.changeCheck.findings.find((candidate) =>
      candidate.type === "planned_completed" &&
      candidate.actualChangeIds.length > 0 &&
      candidate.evidenceIds.length > 0,
    );
    assert.ok(finding, "the public Check must publish one source-backed completed foo Finding");
    const evidenceRead = await callTool(mcp, output, requestId++, "get_evidence", {
      taskId,
      evidenceIds: finding.evidenceIds,
      maxExcerptChars: 8_192,
      pageSize: finding.evidenceIds.length,
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

    await updateTask(
      { type: "transition_status", to: "verification_required" },
      "preview-workbench-browser-verification-required",
    );
    const verificationProgram = [
      "const { foo } = await import('./src/index.ts');",
      "if (foo() !== 'browser-ready') throw new Error('unexpected foo result');",
    ].join(" ");
    const verificationStartedAt = Date.now();
    const verificationExecution = await execBounded(
      process.execPath,
      ["--input-type=module", "--eval", verificationProgram],
      { cwd: repositoryRoot, encoding: "utf8" },
    );
    assert.equal(verificationExecution.stderr, "");
    const verificationDurationMs = Date.now() - verificationStartedAt;
    const requiredVerificationEntries = brief.verificationPlan.filter((entry) => entry.required);
    assert.ok(requiredVerificationEntries.length > 0, "the Task must carry a required Verification entry");
    for (const [index, planEntry] of requiredVerificationEntries.entries()) {
      const recorded = await callTool(mcp, output, requestId++, "record_verification", {
        taskId,
        record: {
          verificationPlanEntryId: planEntry.id,
          kind: planEntry.method,
          status: "passed",
          command: `node --input-type=module --eval ${JSON.stringify(verificationProgram)}`,
          exitCode: 0,
          durationMs: verificationDurationMs,
          outputDigest: contentDigest(Buffer.from(`${verificationExecution.stdout}${verificationExecution.stderr}`, "utf8")),
          summary: "The external foo verification command completed successfully.",
          claimIds: planEntry.acceptanceClaimIds,
          snapshotId: changedSnapshotId,
        },
        expectedRevision: taskRevision,
        idempotencyKey: `preview-workbench-browser-verification-${index}`,
        actor,
      }, RecordVerificationOutputV1Schema);
      assert.equal(recorded.structuredContent.result.verification.status, "passed");
      assert.equal(recorded.structuredContent.result.verification.snapshotId, changedSnapshotId);
      taskRevision = recorded.structuredContent.result.mutation.revision;
    }
    const verified = await updateTask(
      { type: "transition_status", to: "verified" },
      "preview-workbench-browser-verified",
    );
    assert.equal(verified.structuredContent.result.task.status, "verified");

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

    await browser.waitFor(bodyContains(finding.summary), "published Change Check finding");
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
    assert.equal(workbenchTrace.payload.verification.disposition, "externally_reported");
    assert.equal(workbenchTrace.payload.verification.requiredCount, requiredVerificationEntries.length);
    assert.equal(workbenchTrace.payload.verification.passedCount, requiredVerificationEntries.length);
    assert.equal(workbenchTrace.payload.verification.failedCount, 0);
    assert.equal(workbenchTrace.payload.verification.pendingCount, 0);
    assert.equal(workbenchTrace.payload.verification.records.length, requiredVerificationEntries.length);

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

    const upgradeRelease = await createUpgradeRelease(installed.packageRoot, baseVersion);
    upgradeReleaseRoot = upgradeRelease.releaseRoot;
    assert.notEqual(
      upgradeRelease.descriptor.inventorySha256,
      initialManagedDashboard.inventorySha256,
      "the upgrade fixture must carry different Dashboard bytes",
    );
    const upgraded = await runCliJson(
      upgradeRelease.bundlePath,
      ["upgrade", "--root", managedInstallRoot, "--host", "codex"],
      installDirectory,
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
        version: upgradeRelease.upgradedVersion,
        rollbackAvailable: true,
      },
    );
    assert.notDeepEqual(await readFile(managedBundle), initialManagedBundle);
    assert.deepEqual(
      await dashboardInventory(managedDashboardRoot),
      upgradeRelease.descriptor,
      "upgrade must install the exact v2 Dashboard inventory",
    );
    assert.deepEqual(
      await readFile(managedDashboardManifestPath),
      await readFile(path.join(upgradeRelease.releaseRoot, "dashboard-manifest.json")),
    );
    const upgradedDoctor = await runCliJson(
      managedBundle,
      ["doctor", "--root", managedInstallRoot],
      installDirectory,
      lifecycleEnv,
    );
    assert.deepEqual(
      { ok: upgradedDoctor.ok, status: upgradedDoctor.status, version: upgradedDoctor.version },
      { ok: true, status: "healthy", version: upgradeRelease.upgradedVersion },
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
      upgradeRelease.upgradedVersion,
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
    await browser.navigate(upgradedWorkbench.structuredContent.result.deepLink);
    await browser.waitFor(
      "document.querySelector('[data-testid=\"task-first-workbench\"]') !== null",
      "upgraded managed React Task Workbench",
      30_000,
    );
    await browser.waitFor(bodyContains(finding.summary), "same Task through upgraded Dashboard");
    await browser.waitFor(
      `document.querySelector('meta[name="understand-code-lifecycle-release"][content="${upgradeRelease.upgradedVersion}"]') !== null`,
      "v2 Dashboard marker",
    );
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
      await readFile(managedDashboardManifestPath),
      initialManagedDashboardManifest,
    );
    assert.deepEqual(
      await dashboardInventory(managedDashboardRoot),
      initialManagedDashboard,
    );
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
    assert.equal(digest(await readFile(tarballPath)), digest(tarballBefore), "the supplied tgz must remain unchanged");
    retainPackDirectory = !tarball.supplied;
    console.log(`WORKBENCH_BROWSER_TARBALL ${JSON.stringify({
      path: tarballPath,
      sha256: `sha256:${digest(tarballBefore)}`,
      entryCount,
    })}`);

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
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    await stopChild(mcp);
    await Promise.all([
      ...(retainPackDirectory ? [] : [rm(packDirectory, { recursive: true, force: true })]),
      rm(installDirectory, { recursive: true, force: true }),
      rm(browserProfile, { recursive: true, force: true }),
      rm(home, { recursive: true, force: true }),
      ...repositoryRoots.map((root) => rm(root, { recursive: true, force: true })),
      ...(upgradeReleaseRoot === null
        ? []
        : [rm(upgradeReleaseRoot, { recursive: true, force: true })]),
    ]);
  }
});
