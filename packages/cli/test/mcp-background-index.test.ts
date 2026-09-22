import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import Ajv2020 from "ajv/dist/2020.js";
import { BuildTaskBriefOutputV1Schema, BuildTaskBriefPendingOutputV1Schema, IndexJobOutputV1Schema } from "@understand-code/contracts/mcp";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { controlIndexJobV1 } from "../src/index-job-command.js";
import { callImplementedTool } from "../src/handlers/tools.js";
import { cleanupTemporaryDirectories, createGitRepository } from "./helpers.js";

const exec = promisify(execFile);
const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const bin = path.join(packageRoot, "dist/understand-code.mjs");
const hosts = new Set<ChildProcessWithoutNullStreams>();
const jobs: Array<{ root: string; jobId: string }> = [];
const original = { task: "Explain the task function", expectedRevision: 0, actor: "codex", idempotencyKey: "background-task", scope: ["src/task.ts"] };

async function host(root: string) {
  const child = spawn(process.execPath, [bin, "mcp", "--stdio", "--root", root], { cwd: packageRoot, stdio: ["pipe", "pipe", "pipe"] });
  hosts.add(child);
  const messages = new Map<number, any>();
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += String(chunk); });
  createInterface({ input: child.stdout }).on("line", (line) => {
    const frame = JSON.parse(line);
    if (frame.id !== undefined) messages.set(frame.id, frame);
  });
  let id = 0;
  const send = (value: object) => child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...value })}\n`);
  const rpc = async (method: string, params?: object) => {
    const requestId = ++id;
    send({ id: requestId, method, ...(params ? { params } : {}) });
    await vi.waitFor(() => expect(messages.has(requestId), stderr).toBe(true), { timeout: 30_000, interval: 20 });
    const response = messages.get(requestId)!;
    expect(response.error, JSON.stringify(response)).toBeUndefined();
    return response.result;
  };
  const initialized = await rpc("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "background-test", version: "1" } });
  expect(initialized.instructions).toContain("waiting_for_index");
  send({ method: "notifications/initialized" });
  return {
    rpc,
    call: (name: string, args: object) => rpc("tools/call", { name, arguments: args }),
    async close() { if (child.exitCode !== null) return; const closed = once(child, "close"); child.stdin.end(); expect((await closed)[0], stderr).toBe(0); hosts.delete(child); },
  };
}

async function completed(client: Awaited<ReturnType<typeof host>>, jobId: string) {
  let result: any;
  const deadline = Date.now() + 60_000;
  do {
    result = IndexJobOutputV1Schema.parse(await client.call("index_job", { action: "status", jobId })).structuredContent.result;
    if (!["queued", "running"].includes(result.job?.status)) return result;
    await delay(100);
  } while (Date.now() < deadline);
  throw new Error(`Background job did not settle: ${JSON.stringify(result)}`);
}

async function manySources(root: string) {
  await Promise.all(Array.from({ length: 450 }, (_, n) => writeFile(path.join(root, `src/generated-${n}.ts`),
    Array.from({ length: 15 }, (_, k) => `export function task${k}() { return ${n + k}; }`).join("\n"))));
}

beforeAll(async () => { await exec(process.execPath, ["scripts/build-bundle.mjs"], { cwd: packageRoot, timeout: 120_000 }); }, 120_000);
afterEach(async () => {
  for (const child of hosts) { const closed = once(child, "close"); child.kill("SIGKILL"); await closed; }
  hosts.clear();
  for (const job of jobs.splice(0)) {
    await controlIndexJobV1(job.root, "cancel", job.jobId);
    await vi.waitFor(async () => expect(["queued", "running"]).not.toContain((await controlIndexJobV1(job.root, "status", job.jobId))?.status), { timeout: 60_000, interval: 100 });
  }
  await cleanupTemporaryDirectories();
}, 90_000);

describe("installed MCP background first index", () => {
  it("returns a schema-valid job promptly, reuses it across Hosts, survives exit and creates exactly one idempotent Task on resume", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    await manySources(root);
    const first = await host(root);
    const second = await host(root);
    const inventory = await first.rpc("tools/list");
    const start = performance.now();
    const [pending, duplicate] = await Promise.all([first.call("build_task_brief", original), second.call("build_task_brief", original)]);
    expect(performance.now() - start).toBeLessThan(5_000);
    const result = BuildTaskBriefPendingOutputV1Schema.parse(pending).structuredContent.result;
    jobs.push({ root, jobId: result.job.jobId });
    expect(BuildTaskBriefPendingOutputV1Schema.parse(duplicate).structuredContent.result.job.jobId).toBe(result.job.jobId);
    expect(result.status).toBe("waiting_for_index");
    expect(pending.structuredContent.result).not.toHaveProperty("task");
    const ajv = new Ajv2020({ strict: false, validateFormats: false });
    const validate = ajv.compile(inventory.tools.find((tool: any) => tool.name === "build_task_brief").outputSchema);
    expect(validate(pending.structuredContent), JSON.stringify(validate.errors)).toBe(true);
    expect(JSON.stringify(pending)).not.toMatch(/"(?:pid|token)"/u);
    expect(JSON.stringify(pending)).not.toContain(root);
    await first.close(); await second.close();
    const resumed = await host(root);
    const done = await completed(resumed, result.job.jobId);
    expect(done.job?.status, JSON.stringify(done)).toBe("completed");
    const built = BuildTaskBriefOutputV1Schema.parse(await resumed.call("build_task_brief", original));
    const replay = BuildTaskBriefOutputV1Schema.parse(await resumed.call("build_task_brief", original));
    expect(built.structuredContent.result.task.latestSnapshotId).toBe(done.job.snapshotId);
    expect(replay.structuredContent.result.task.taskId).toBe(built.structuredContent.result.task.taskId);
    expect(replay.structuredContent.result.mutation.idempotentReplay).toBe(true);
    expect((await readdir(path.join(root, ".understand-code/tasks"))).filter((name) => /^[0-9A-HJKMNP-TV-Z]{26}$/u.test(name))).toHaveLength(1);
    await resumed.close();
  }, 120_000);

  it("cancels through MCP without changing a previous published cut, then retries cleanly", async () => {
    const root = await createGitRepository();
    const prior = await readFile(path.join(root, ".understand-code/knowledge-graph.json"));
    await manySources(root);
    const client = await host(root);
    const pending = BuildTaskBriefPendingOutputV1Schema.parse(await client.call("build_task_brief", original)).structuredContent.result;
    jobs.push({ root, jobId: pending.job.jobId });
    const cancellation = IndexJobOutputV1Schema.parse(await client.call("index_job", { action: "cancel", jobId: pending.job.jobId }));
    expect(cancellation.structuredContent.result.job?.cancellationRequested).toBe(true);
    expect((await completed(client, pending.job.jobId)).job.status).toBe("cancelled");
    expect(await readFile(path.join(root, ".understand-code/knowledge-graph.json"))).toEqual(prior);
    expect(existsSync(path.join(root, ".understand-code/index-active-v1.json"))).toBe(false);
    await Promise.all((await readdir(path.join(root, "src"))).filter((name) => name.startsWith("generated-")).map((name) => rm(path.join(root, "src", name))));
    const retry = BuildTaskBriefPendingOutputV1Schema.parse(await client.call("build_task_brief", original)).structuredContent.result;
    jobs.push({ root, jobId: retry.job.jobId });
    expect(retry.job.jobId).not.toBe(pending.job.jobId);
    const retried = await completed(client, retry.job.jobId);
    expect(retried.job.status, JSON.stringify(retried)).toBe("completed");
    expect(BuildTaskBriefOutputV1Schema.parse(await client.call("build_task_brief", original)).structuredContent.result.task.taskId).toBeTruthy();
    await client.close();
  }, 120_000);

  it("reports a failed worker safely and permits retry after repair, while preserving root and Provider boundaries", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    const managed = path.join(root, ".understand-code");
    await mkdir(managed, { mode: 0o700 });
    const blocker = path.join(managed, "index-generations-v1");
    await writeFile(blocker, "private-credential-must-not-leak");
    const client = await host(root);
    const pending = BuildTaskBriefPendingOutputV1Schema.parse(await client.call("build_task_brief", original)).structuredContent.result;
    jobs.push({ root, jobId: pending.job.jobId });
    const failure = await completed(client, pending.job.jobId);
    expect(failure.job.status, JSON.stringify(failure)).toBe("failed");
    expect(failure.nextStep).toContain("repeat build_task_brief");
    expect(JSON.stringify(failure)).not.toContain(root);
    expect(JSON.stringify(failure)).not.toContain("private-credential");
    const otherRoot = await createGitRepository({ seedArtifacts: false });
    const other = await host(otherRoot);
    const missing = IndexJobOutputV1Schema.parse(await other.call("index_job", { action: "cancel", jobId: pending.job.jobId }));
    expect(missing.structuredContent.result.job).toBeNull();
    const invalid: any = await other.call("index_job", { action: "cancel", jobId: "../../active.lock" });
    expect(invalid.isError).toBe(true);
    const strong: any = await callImplementedTool("index_job", { action: "status" }, root);
    expect(strong.structuredContent.error.code).toBe("provider_unavailable");
    await other.close();
    await rm(blocker);
    const retry = BuildTaskBriefPendingOutputV1Schema.parse(await client.call("build_task_brief", original)).structuredContent.result;
    jobs.push({ root, jobId: retry.job.jobId });
    const retried = await completed(client, retry.job.jobId);
    expect(retried.job.status, JSON.stringify(retried)).toBe("completed");
    expect(BuildTaskBriefOutputV1Schema.parse(await client.call("build_task_brief", original)).structuredContent.result.task.taskId).toBeTruthy();
    await client.close();
  }, 120_000);
});
