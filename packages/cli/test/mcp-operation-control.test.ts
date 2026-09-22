import { PassThrough } from "node:stream";
import { readFile, writeFile, stat, readdir } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveInitialBinding } from "../src/binding/root-binding.js";
import { runStdioServer } from "../src/mcp/server.js";
import { callImplementedTool } from "../src/handlers/tools.js";
import { cleanupTemporaryDirectories, createGitRepository } from "./helpers.js";

afterEach(cleanupTemporaryDirectories);

async function transport(root: string) {
  const input = new PassThrough();
  const output = new PassThrough();
  const messages: any[] = [];
  let buffer = "";
  let progressListener: ((message: any) => void) | undefined;
  output.setEncoding("utf8");
  output.on("data", (chunk: string) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const frame = JSON.parse(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      messages.push(frame);
      if (frame.method === "notifications/progress") progressListener?.(frame);
    }
  });
  const running = runStdioServer({ initialBinding: await resolveInitialBinding([root]), input, output });
  const send = (message: object) => input.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
  const response = async (id: number) => {
    await vi.waitFor(() => expect(messages.find((message) => message.id === id)).toBeDefined(), { timeout: 30_000 });
    return messages.find((message) => message.id === id);
  };
  send({ id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "cancel-test", version: "1" } } });
  await response(1);
  send({ method: "notifications/initialized" });
  return { send, response, messages, onProgress(listener: (message: any) => void) { progressListener = listener; },
    async close() { input.end(); await running; } };
}

describe("responsive MCP operations", () => {
  it("keeps job control behind the initialized notification before enabling its fast path", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    const host = await transport(root);
    try {
      host.send({ id: 2, method: "tools/call", params: { name: "index_job", arguments: { action: "status" } } });
      expect(await host.response(2)).toMatchObject({ result: { isError: false, structuredContent: { result: { job: null } } } });
    } finally { await host.close(); }
  });

  it("cancels explicit cold refresh, answers ping while the tool is active, and permits a clean retry", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    const host = await transport(root);
    try {
      host.onProgress((message) => {
        if (message.params.message !== "Capturing the current repository snapshot.") return;
        host.send({ id: 10, method: "tools/call", params: { name: "build_task_brief", arguments: {
          task: "This queued task must never be created", expectedRevision: 0, actor: "codex", idempotencyKey: "queued-cancel",
        } } });
        host.send({ method: "notifications/cancelled", params: { requestId: 10 } });
        host.send({ id: 9, method: "ping" });
        host.send({ id: 11, method: "tools/call", params: { name: "index_job", arguments: { action: "status" } } });
        // Wait for job control before cancelling the refresh: queuing it behind
        // the refresh would prevent this independent response.
        void host.response(11).then(() => host.send({ method: "notifications/cancelled", params: { requestId: 2, reason: "private-user-secret" } }));
      });
      const args = { mode: "full", actor: "codex", idempotencyKey: "cold-cancel" };
      host.send({ id: 2, method: "tools/call", params: { name: "refresh_index", arguments: args, _meta: { progressToken: "cold-index" } } });
      expect(await host.response(9)).toMatchObject({ result: {} });
      expect(await host.response(2)).toMatchObject({ error: { code: -32800 } });
      expect(await host.response(10)).toMatchObject({ error: { code: -32800 } });
      expect(await host.response(11)).toMatchObject({ result: { isError: false, structuredContent: { result: { job: null } } } });
      expect(host.messages.findIndex((message) => message.id === 11)).toBeLessThan(host.messages.findIndex((message) => message.id === 2));
      expect(host.messages.findIndex((message) => message.id === 9)).toBeLessThan(host.messages.findIndex((message) => message.id === 2));
      await expect(stat(path.join(root, ".understand-code/index-active-v1.json"))).rejects.toMatchObject({ code: "ENOENT" });
      const progressCount = host.messages.filter((message) => message.method === "notifications/progress").length;
      expect(progressCount).toBeGreaterThan(0);
      expect(host.messages.filter((message) => message.method === "notifications/progress").map((message) => message.params.progress))
        .toEqual(Array.from({ length: progressCount }, (_, index) => index + 1));
      host.send({ id: 3, method: "tools/call", params: { name: "refresh_index", arguments: args } });
      expect(await host.response(3)).toMatchObject({ result: { isError: false } });
      expect(host.messages.filter((message) => message.method === "notifications/progress")).toHaveLength(progressCount);
      expect(JSON.stringify(host.messages)).not.toContain("private-user-secret");
    } finally { await host.close(); }
  }, 120_000);

  it.each(["Analyzing source structure", "Publishing the completed repository snapshot."])("cancellation at %s preserves the exact prior active index", async (stage) => {
    const root = await createGitRepository({ seedArtifacts: false });
    const local = { runtimeProfile: "local_durable_v1" as const };
    const before: any = await callImplementedTool("refresh_index", { mode: "full", actor: "codex", idempotencyKey: "baseline" }, root, local);
    expect(before.isError).toBe(false);
    const activePath = path.join(root, ".understand-code/index-active-v1.json");
    const activeBefore = await readFile(activePath);
    await writeFile(path.join(root, "src/task.ts"), "export function task() { return false; }\n");
    const host = await transport(root);
    try {
      host.onProgress((message) => {
        if (message.params.message === stage) {
          host.send({ method: "notifications/cancelled", params: { requestId: 2 } });
        }
      });
      host.send({ id: 2, method: "tools/call", params: { name: "refresh_index", arguments: { mode: "full", actor: "codex", idempotencyKey: "cancel-publication" }, _meta: { progressToken: 7 } } });
      expect(await host.response(2)).toMatchObject({ error: { code: -32800 } });
      expect(await readFile(activePath)).toEqual(activeBefore);
      expect(await readdir(path.join(root, ".understand-code/.refresh-index-staging-v1"))).toEqual([]);
    } finally { await host.close(); }
  }, 120_000);
});
