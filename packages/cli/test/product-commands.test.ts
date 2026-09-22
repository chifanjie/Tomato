import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCliArguments } from "../src/argv.js";
import { runKnowledgeCommand } from "../src/knowledge-command.js";
import { callImplementedTool } from "../src/handlers/tools.js";
import { cleanupTemporaryDirectories, createGitRepository } from "./helpers.js";

afterEach(async () => { vi.restoreAllMocks(); await cleanupTemporaryDirectories(); });

describe("discoverable product commands", () => {
  it("accepts an independent reader and rejects ambiguous writer phases and path overrides", () => {
    expect(parseCliArguments(["workbench", "--root", "/tmp/repo", "--no-open"])).toEqual({ kind: "workbench", root: "/tmp/repo", noOpen: true });
    const prefix = ["knowledge", "--root", "/tmp/repo", "--task-id", "01ARZ3NDEKTSV4RRFFQ69G5FAV"];
    expect(() => parseCliArguments([...prefix, "--prepare-file-docs", "--finalize"])).toThrow();
    expect(() => parseCliArguments([...prefix, "--prepare-file-docs", "--output-root", "/tmp/outside"])).toThrow();
    expect(() => parseCliArguments([...prefix, "--discard-candidate"])).toThrow();
  });

  it("prepares a real Task writer draft, preserves existing work and refuses source drift", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    const created: any = await callImplementedTool("build_task_brief", { task: "Explain the task function", expectedRevision: 0, actor: "codex", idempotencyKey: "writer-command-task" }, root, { runtimeProfile: "local_durable_v1" });
    expect(created.isError, JSON.stringify(created)).toBe(false);
    const task = created.structuredContent.result.task;
    const output = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const prepare = { kind: "knowledge" as const, root, taskId: task.taskId, writerArgs: ["--prepare-file-docs"] };
    await runKnowledgeCommand(prepare);
    const bindingPath = path.join(root, ".understand-code/knowledge-drafts", task.taskId, ".intermediate/source-binding.json");
    const bytes = await readFile(bindingPath, "utf8");
    expect(JSON.parse(bytes)).toMatchObject({ schemaVersion: 1, graphDigest: expect.any(String), sourceInventoryDigest: expect.any(String) });
    await expect(runKnowledgeCommand(prepare)).rejects.toMatchObject({ code: "writer_draft_exists" });
    expect(await readFile(bindingPath, "utf8")).toBe(bytes);
    const topicQueue = path.join(path.dirname(bindingPath), "topic-queue.json");
    await writeFile(topicQueue, '{"userWork":"preserved"}\n');
    await expect(runKnowledgeCommand({ ...prepare, writerArgs: ["--prepare-topics"] })).rejects.toMatchObject({ code: "writer_topics_exist" });
    expect(await readFile(topicQueue, "utf8")).toContain("preserved");
    await writeFile(path.join(root, "src/task.ts"), "export function task() { return false; }\n");
    await expect(runKnowledgeCommand({ ...prepare, writerArgs: ["--merge-file-docs"] })).rejects.toMatchObject({ code: "writer_snapshot_stale" });
    output.mockRestore();
  }, 30_000);
});
