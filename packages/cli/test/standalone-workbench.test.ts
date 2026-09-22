import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { callImplementedTool } from "../src/handlers/tools.js";
import { cleanupTemporaryDirectories, createGitRepository } from "./helpers.js";

const require = createRequire(import.meta.url);
const viteNode = require.resolve("vite-node/vite-node.mjs", { paths: [require.resolve("vitest/package.json")] });
const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceBin = path.join(packageRoot, "src/bin.ts");
const children = new Set<ChildProcessWithoutNullStreams>();

afterEach(async () => {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      const closed = once(child, "close");
      child.kill("SIGKILL");
      await closed;
    }
  }
  children.clear();
  await cleanupTemporaryDirectories();
});

function startCli(args: string[]) {
  const child = spawn(process.execPath, [viteNode, "--script", sourceBin, ...args], {
    cwd: packageRoot, env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" }, stdio: ["pipe", "pipe", "pipe"],
  });
  children.add(child);
  const messages: any[] = [];
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  createInterface({ input: child.stdout }).on("line", (line) => {
    try { messages.push(JSON.parse(line)); } catch { /* only protocol/CLI JSON is consumed */ }
  });
  return { child, messages, get stderr() { return stderr; },
    send(message: object) { child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`); },
    async next(predicate: (value: any) => boolean) {
      await vi.waitFor(() => expect(messages.some(predicate) || child.exitCode !== null || child.signalCode !== null, stderr).toBe(true), { timeout: 45_000 });
      const found = messages.find(predicate);
      expect(found, stderr).toBeDefined();
      return found;
    },
  };
}

async function authenticate(url: URL): Promise<string> {
  const launch = await fetch(new URL("/__workbench/launch", url), { method: "POST", headers: {
    "content-type": "application/json", origin: url.origin,
  }, body: JSON.stringify({ token: url.hash.slice(1) }) });
  expect(launch.status).toBeLessThan(400);
  const cookie = launch.headers.get("set-cookie")?.split(";", 1)[0];
  expect(cookie).toBeTruthy();
  return cookie!;
}

describe("standalone Workbench source CLI", () => {
  it("reports a known knowledge root error with a safe recovery command", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    const command = startCli(["knowledge", "--root", path.join(root, "src"), "--task-id", "01ARZ3NDEKTSV4RRFFQ69G5FAV", "--guide"]);
    const closed = once(command.child, "close");
    command.child.stdin.end();
    expect((await closed)[0]).toBe(1);
    expect(command.stderr).toContain("knowledge_root_unavailable");
    expect(command.stderr).toContain("git rev-parse --show-toplevel");
    expect(command.stderr).not.toContain(root);
  });

  it("reopens the same persisted Task after its MCP Host exits and keeps Task data authenticated", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    // This source-runner test exercises reopening an already indexed Task. Cold MCP launches are tested with the installed bundle.
    await callImplementedTool("refresh_index", { mode: "full", actor: "codex", idempotencyKey: "standalone-baseline" }, root, { runtimeProfile: "local_durable_v1" });
    const host = startCli(["mcp", "--stdio", "--root", root]);
    host.send({ id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "standalone-test", version: "1" } } });
    await host.next((value) => value.id === 1);
    host.send({ method: "notifications/initialized" });
    host.send({ id: 2, method: "tools/call", params: { name: "build_task_brief", arguments: {
      task: "Explain the task function", expectedRevision: 0, actor: "codex", idempotencyKey: "standalone-task",
    } } });
    const created = await host.next((value) => value.id === 2);
    expect(created.result?.isError, JSON.stringify(created)).toBe(false);
    const task = created.result.structuredContent.result.task;
    host.send({ id: 3, method: "tools/call", params: { name: "open_workbench", arguments: {
      route: { view: "tasks", taskId: task.taskId, section: "summary" },
    } } });
    const opened = await host.next((value) => value.id === 3);
    expect(opened.result?.isError, JSON.stringify(opened)).not.toBe(true);
    const originalUrl = new URL(opened.result.structuredContent.result.deepLink);
    const originalCookie = await authenticate(originalUrl);
    const originalBrief = await fetch(new URL(`/tasks/${task.taskId}/brief.json?section=summary`, originalUrl), { headers: { cookie: originalCookie } });
    expect(originalBrief.status).toBe(200);
    const before = await originalBrief.json();
    const hostClosed = once(host.child, "close");
    host.child.stdin.end();
    expect((await hostClosed)[0], host.stderr).toBe(0);
    await expect(fetch(new URL("/__workbench/tasks", originalUrl), { signal: AbortSignal.timeout(2_000) })).rejects.toThrow();

    const reader = startCli(["workbench", "--root", root, "--task-id", task.taskId, "--no-open"]);
    // A reader's HTTP lifetime must not depend on keeping a chat/stdin open.
    reader.child.stdin.end();
    const restored = await reader.next((value) => typeof value.url === "string");
    expect(restored.taskId).toBe(task.taskId);
    const restoredUrl = new URL(restored.url);
    const briefPath = `/tasks/${task.taskId}/brief.json?section=summary`;
    const denied = await fetch(new URL(briefPath, restoredUrl));
    expect([401, 403]).toContain(denied.status);
    const deniedText = await denied.text();
    expect(deniedText).not.toContain("Explain the task function");
    const cookie = await authenticate(restoredUrl);
    const brief = await fetch(new URL(briefPath, restoredUrl), { headers: { cookie } });
    expect(brief.status).toBe(200);
    expect(await brief.json()).toEqual(before);
    const discovery = await fetch(new URL("/__workbench/tasks", restoredUrl), { headers: { cookie } });
    expect(discovery.status).toBe(200);
    expect((await discovery.json() as { tasks: Array<{ taskId: string }> }).tasks.some((entry) => entry.taskId === task.taskId)).toBe(true);
    const readerClosed = once(reader.child, "close");
    reader.child.kill("SIGTERM");
    expect((await readerClosed)[0], reader.stderr).toBe(0);
  }, 120_000);
});
