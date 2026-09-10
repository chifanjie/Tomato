import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { launchBrowser, resolveBrowserExecutable } from "./browser-harness.mjs";

const execute = promisify(execFile);
const hostAdapter = fileURLToPath(new URL("../dist/host-bin.mjs", import.meta.url));
const before = "export function task(): boolean { return true; }\n";
const after = "export function task(): boolean { return false; }\n";

function startHost(root) {
  const child = spawn(process.execPath, [hostAdapter, "--root", root], {
    cwd: root,
    env: { PATH: process.env.PATH, TMPDIR: process.env.TMPDIR, LANG: "C.UTF-8" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let nextId = 0;
  const pending = new Map();
  const stderr = [];
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  const fail = (error) => {
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(error); }
    pending.clear();
  };
  createInterface({ input: child.stdout }).on("line", (line) => {
    try {
      const message = JSON.parse(line);
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      clearTimeout(entry.timer);
      if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
      else entry.resolve(message.result);
    } catch (error) { fail(error); }
  });
  child.once("error", fail);
  child.once("exit", (code) => fail(new Error(`MCP exited ${code}: ${stderr.join("")}`)));
  function request(method, params) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`MCP ${method} timed out`)); }, 60_000);
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }
  return {
    child,
    request,
    notify(method) { child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params: {} })}\n`); },
    async tool(name, args) {
      const response = await request("tools/call", { name, arguments: args });
      assert.notEqual(response.isError, true, `${name}: ${JSON.stringify(response)}`);
      assert.ok(response.structuredContent?.result, `${name} must return a structured result`);
      return response.structuredContent;
    },
    async close() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.stdin.end();
      const timer = setTimeout(() => child.kill("SIGTERM"), 3_000);
      try { await once(child, "exit"); } finally { clearTimeout(timer); }
    },
  };
}

// This exercises the built local distribution, independently of candidate Git
// provenance. The packed negative test remains the release/canary security gate.
test("local Preview MCP renders a real Task home, persisted Claim evidence and checked source diff in Chrome", { timeout: 240_000 }, async (t) => {
  const executable = await resolveBrowserExecutable();
  if (!executable) {
    assert.notEqual(process.env.UNDERSTAND_CODE_REQUIRE_REAL_BROWSER, "1", "real browser required but Chrome/Chromium is unavailable");
    t.skip("Chrome/Chromium unavailable");
    return;
  }
  const temporary = await realpath(await mkdtemp(path.join(tmpdir(), "uc-local-browser-")));
  const root = path.join(temporary, "example-repository");
  let host;
  let browser;
  const artifactDirectory = process.env.UNDERSTAND_CODE_BROWSER_ARTIFACT_DIR;
  async function capture(name) {
    if (!artifactDirectory || !browser) return;
    assert.ok(path.isAbsolute(artifactDirectory), "browser artifact directory must be absolute");
    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(path.join(artifactDirectory, `${name}.png`), await browser.screenshot());
  }
  try {
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(path.join(root, "src/task.ts"), before);
    for (const args of [["init", "-q"], ["add", "src/task.ts"], ["-c", "user.name=Browser Fixture", "-c", "user.email=browser@example.invalid", "commit", "-qm", "baseline"]]) {
      await execute("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd: root, timeout: 30_000, env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" } });
    }
    host = startHost(root);
    const initialized = await host.request("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "local-browser-acceptance", version: "1" } });
    assert.match(initialized.instructions, /local_durable_v1/u);
    host.notify("notifications/initialized");
    const created = (await host.tool("build_task_brief", { task: "Explain and change the task function return value", expectedRevision: 0, actor: "browser-acceptance", idempotencyKey: "browser-create" })).result;
    const task = created.task;
    let revision = task.revision;
    const evidence = (await host.tool("get_evidence", { taskId: task.taskId, evidenceIds: created.evidenceIds })).result.evidence;
    const source = evidence.find((item) => item.kind === "source" && item.filePath === "src/task.ts");
    assert.ok(source, `auto initialization must provide actual source evidence: ${JSON.stringify(evidence)}`);
    const statement = "The task function currently returns true.";
    async function mutate(action, key) {
      const result = (await host.tool("update_task", { taskId: task.taskId, expectedRevision: revision, actor: "browser-acceptance", idempotencyKey: key, action })).result;
      revision = result.mutation.revision;
      return result;
    }
    await mutate({ type: "record_analysis", sourceSnapshotId: task.latestSnapshotId, conclusions: [{ kind: "conclusion", statement, evidenceIds: [source.id], reasoning: "The indexed source declaration contains return true." }] }, "browser-analysis");
    const open = async (route) => (await host.tool("open_workbench", { route: { view: "tasks", taskId: task.taskId, ...route } })).result.deepLink;
    browser = await launchBrowser({ executable, userDataDir: path.join(temporary, "chrome"), timeoutMs: 30_000 });
    await browser.navigate(await open({ section: "summary" }));
    await browser.waitFor(`document.querySelector('[data-testid="task-first-workbench"]')?.getAttribute('data-state') === 'ready' && document.body.innerText.includes(${JSON.stringify(statement)})`, "persisted conclusion");
    assert.match(await browser.evaluate("document.body.innerText"), new RegExp(`修订版 ${revision}`));
    await browser.click(`[data-testid="task-claim"] button[data-evidence-id="${source.id}"]`);
    await browser.waitFor(`document.querySelector('[data-testid="task-evidence-view"]')?.getAttribute('data-state') === 'ready'`, "Claim source evidence");
    assert.match(await browser.evaluate("document.querySelector('[data-testid=task-evidence-view]').innerText"), /return true/u);
    await capture("task-claim-evidence");
    const otherTask = (await host.tool("build_task_brief", { task: "Inspect the unchanged task declaration as a separate task", expectedRevision: 0, actor: "browser-acceptance", idempotencyKey: "browser-second-task" })).result.task;
    await browser.clickText("button", "任务历史");
    await browser.waitFor(`document.querySelector('[data-testid="task-home"]')?.innerText.includes(${JSON.stringify(task.title)})`, "Task discovery");
    const homeText = await browser.evaluate("document.querySelector('[data-testid=task-home]').innerText");
    assert.ok(homeText.includes(path.basename(root)) && homeText.includes(task.repositoryId));
    assert.equal(homeText.includes(root), false, "home must not expose the canonical root");
    await capture("task-home");
    await browser.clickText("[data-testid=task-home] li button", otherTask.title);
    await browser.waitFor(`document.querySelector('[data-testid="task-first-workbench"]')?.getAttribute('data-state') === 'ready' && new URL(location.href).searchParams.get('taskId') === ${JSON.stringify(otherTask.taskId)}`, "different Task launch with existing cookie");
    await browser.clickText("button", "任务历史");
    await browser.waitFor(`document.querySelector('[data-testid="task-home"]')?.innerText.includes(${JSON.stringify(task.title)})`, "return to Task history");
    await browser.clickText("[data-testid=task-home] li button", task.title);
    await browser.waitFor(`document.querySelector('[data-testid="task-first-workbench"]')?.getAttribute('data-state') === 'ready' && document.body.innerText.includes(${JSON.stringify(statement)})`, "lazy Task history launch");
    const brief = created.brief;
    for (const [action, key] of [
      [{ type: "confirm_goal", claimId: brief.goalClaimId }, "goal"],
      [{ type: "confirm_acceptance_criteria", claimIds: brief.acceptanceClaimIds }, "acceptance"],
      [{ type: "confirm_plan", plannedChangeIds: brief.plannedChanges.map((entry) => entry.id) }, "plan"],
      [{ type: "transition_status", to: "planned" }, "planned"],
      [{ type: "transition_status", to: "in_progress" }, "progress"],
    ]) await mutate(action, `browser-${key}`);
    await writeFile(path.join(root, "src/task.ts"), after);
    const refreshed = await host.tool("refresh_index", { mode: "incremental", expectedSourceSnapshotId: task.latestSnapshotId, actor: "browser-acceptance", idempotencyKey: "browser-refresh" });
    const currentSnapshotId = refreshed.meta.sourceSnapshotId;
    await mutate({ type: "transition_status", to: "check_required" }, "browser-check-required");
    const checked = (await host.tool("check_change", { taskId: task.taskId, actualSnapshotId: currentSnapshotId, includeWorktree: true, expectedRevision: revision, actor: "browser-acceptance", idempotencyKey: "browser-check" })).result;
    revision = checked.mutation.revision;
    const findings = checked.changeCheck.findings;
    const checkedEvidence = (await host.tool("get_evidence", { taskId: task.taskId, evidenceIds: [...new Set(findings.flatMap((item) => item.evidenceIds))] })).result.evidence;
    const diffEvidence = checkedEvidence.find((item) => item.kind === "diff_hunk" && item.filePath === "src/task.ts") ?? checkedEvidence.find((item) => item.kind === "source" && item.filePath === "src/task.ts");
    assert.ok(diffEvidence, "Check must bind source/diff evidence to the changed file");
    const finding = findings.find((item) => item.evidenceIds.includes(diffEvidence.id));
    await browser.navigate(await open({ section: "changes", findingId: finding.id, evidenceId: diffEvidence.id }));
    await browser.waitFor(`document.querySelector('[aria-label="基线与当前完整差异"] pre')?.innerText.includes('+export function task')`, "checked baseline/current diff");
    const diff = await browser.evaluate("document.querySelector('[aria-label=\"基线与当前完整差异\"] pre').innerText");
    assert.match(diff, /-export function task\(\): boolean \{ return true; \}/u);
    assert.match(diff, /\+export function task\(\): boolean \{ return false; \}/u);
    await browser.evaluate("document.querySelector('[aria-label=\"基线与当前完整差异\"]').scrollIntoView({block: 'center'})");
    await capture("task-diff");
    assert.deepEqual(browser.pageErrors, []);
    t.diagnostic(JSON.stringify({ taskId: task.taskId, revision, baselineSnapshotId: task.latestSnapshotId, currentSnapshotId, evidenceId: diffEvidence.id, verification: "not executed or claimed" }));
  } catch (error) {
    await capture("task-failure").catch(() => undefined);
    throw error;
  } finally {
    if (browser) await browser.close();
    if (host) await host.close();
    await rm(temporary, { recursive: true, force: true });
  }
});
