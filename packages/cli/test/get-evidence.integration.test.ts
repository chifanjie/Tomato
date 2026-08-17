import { PassThrough } from "node:stream";

import {
  BuildTaskBriefOutputV1Schema,
  GetEvidenceOutputV1Schema,
  McpToolErrorResultV1Schema,
  SearchContextOutputV1Schema,
  TraceImpactOutputV1Schema,
} from "@understand-code/contracts/mcp";
import { afterEach, describe, expect, it } from "vitest";

import { resolveInitialBinding } from "../src/binding/root-binding.js";
import { McpStdioServer } from "../src/mcp/server.js";
import {
  cleanupTemporaryDirectories,
  createGitRepository,
} from "./helpers.js";

afterEach(cleanupTemporaryDirectories);

function testServer(initialBinding: Awaited<ReturnType<typeof resolveInitialBinding>>) {
  const output = new PassThrough();
  const chunks: string[] = [];
  output.setEncoding("utf8");
  output.on("data", (chunk: string) => chunks.push(chunk));
  const server = new McpStdioServer(initialBinding, output);
  return {
    server,
    response(id: string | number): any {
      return chunks
        .join("")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .find((message) => message.id === id);
    },
  };
}

async function initialize(server: McpStdioServer): Promise<void> {
  await server.handleValue({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "evidence-test", version: "1.0.0" },
    },
  });
  await server.handleValue({
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {},
  });
}

describe("get_evidence MCP vertical", () => {
  it("reads exact Task evidence with bounded pagination and reports missing IDs", async () => {
    const root = await createGitRepository();
    const harness = testServer(await resolveInitialBinding([root]));
    await initialize(harness.server);

    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "build_task_brief",
        arguments: {
          task: "Read evidence for this task.",
          expectedRevision: 0,
          idempotencyKey: "get-evidence-build",
          actor: "agent:evidence-test",
          scope: ["src/task.ts"],
        },
      },
    });
    const built = BuildTaskBriefOutputV1Schema.parse(harness.response(2).result);
    const { task, evidenceIds } = built.structuredContent.result;
    expect(evidenceIds.length).toBeGreaterThan(0);

    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "get_evidence",
        arguments: {
          taskId: task.taskId,
          evidenceIds: [evidenceIds[0], "evidence:missing"],
          pageSize: 2,
          maxExcerptChars: 32,
        },
      },
    });
    const result = GetEvidenceOutputV1Schema.parse(harness.response(3).result);
    expect(result.structuredContent.page.returned).toBe(2);
    expect(result.structuredContent.result.evidence).toHaveLength(1);
    expect(result.structuredContent.result.missingEvidenceIds).toEqual([
      "evidence:missing",
    ]);
    expect(result.structuredContent.meta.repositoryId).toBe(
      task.repositoryId,
    );
    expect(result.structuredContent.meta.worktreeId).toBe(task.worktreeId);
  });

  it("fails closed for an invalid cursor and an unknown Task", async () => {
    const root = await createGitRepository();
    const harness = testServer(await resolveInitialBinding([root]));
    await initialize(harness.server);

    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "get_evidence",
        arguments: {
          taskId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
          evidenceIds: ["evidence:any"],
          cursor: "not-a-valid-cursor",
        },
      },
    });
    const invalid = McpToolErrorResultV1Schema.parse(harness.response(2).result);
    expect(invalid.structuredContent.error.code).toBe("resource_not_found");
  });

  it("searches persisted Task context and traces bounded impact paths", async () => {
    const root = await createGitRepository();
    const harness = testServer(await resolveInitialBinding([root]));
    await initialize(harness.server);
    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "build_task_brief",
        arguments: {
          task: "Search and trace this task context.",
          expectedRevision: 0,
          idempotencyKey: "context-tools-build",
          actor: "agent:context-tools-test",
          scope: ["src/task.ts"],
        },
      },
    });
    const built = BuildTaskBriefOutputV1Schema.parse(harness.response(2).result);
    const taskId = built.structuredContent.result.task.taskId;

    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "search_context",
        arguments: { taskId, query: "task", pageSize: 10 },
      },
    });
    const search = SearchContextOutputV1Schema.parse(harness.response(3).result);
    expect(search.structuredContent.meta.sourceSnapshotId).toBe(
      built.structuredContent.result.task.latestSnapshotId,
    );
    expect(search.structuredContent.page.returned).toBeGreaterThan(0);

    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "trace_impact",
        arguments: {
          taskId,
          sourceNodeIds: ["function:task"],
          direction: "downstream",
          pageSize: 10,
        },
      },
    });
    const trace = TraceImpactOutputV1Schema.parse(harness.response(4).result);
    expect(trace.structuredContent.meta.worktreeId).toBe(
      built.structuredContent.result.task.worktreeId,
    );
  });

  it("rejects unscoped context search and impact tracing", async () => {
    const root = await createGitRepository();
    const harness = testServer(await resolveInitialBinding([root]));
    await initialize(harness.server);
    for (const [id, name, argumentsValue] of [
      [2, "search_context", { query: "task" }],
      [3, "trace_impact", { sourceNodeIds: ["function:task"], direction: "both" }],
    ] as const) {
      await harness.server.handleValue({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name, arguments: argumentsValue },
      });
      const failure = McpToolErrorResultV1Schema.parse(harness.response(id).result);
      expect(failure.structuredContent.error.code).toBe("artifact_unavailable");
    }
  });
});
