import { PassThrough } from "node:stream";
import { readFile, stat, utimes } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  BuildTaskBriefOutputV1Schema,
  GetRepoPulseOutputV1Schema,
  GetTaskBriefOutputV1Schema,
  McpToolErrorResultV1Schema,
} from "@understand-code/contracts/mcp";
import { afterEach, describe, expect, it } from "vitest";

import { resolveInitialBinding } from "../src/binding/root-binding.js";
import { McpStdioServer } from "../src/mcp/server.js";
import {
  cleanupTemporaryDirectories,
  createGitRepository,
  git,
  readSourceFixture,
  snapshotRepositoryFiles,
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
    messages(): any[] {
      return chunks
        .join("")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    },
    response(id: string | number): any {
      return this.messages().find((message) => message.id === id);
    },
  };
}

async function initialize(
  server: McpStdioServer,
  capabilities: Record<string, unknown> = {},
): Promise<void> {
  await server.handleValue({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities,
      clientInfo: { name: "cli-test", version: "1.0.0" },
    },
  });
  await server.handleValue({
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {},
  });
}

describe("MCP lifecycle and real handlers", () => {
  it("initializes, lists only three tools, and runs the Pulse/Brief vertical slice", async () => {
    const root = await createGitRepository();
    const sourceBefore = await readSourceFixture(root);
    const repositoryBefore = await snapshotRepositoryFiles(root);
    const harness = testServer(await resolveInitialBinding([root]));
    await initialize(harness.server);

    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });
    expect(harness.response(2).result.tools.map((tool: any) => tool.name)).toEqual([
      "get_repo_pulse",
      "build_task_brief",
      "get_task_brief",
    ]);
    expect(
      harness.response(2).result.tools.every(
        (tool: any) => tool.inputSchema && tool.outputSchema,
      ),
    ).toBe(true);

    const sourcePath = path.join(root, "src/task.ts");
    const indexPath = path.join(root, ".git/index");
    const sourceMetadata = await stat(sourcePath);
    await utimes(
      sourcePath,
      sourceMetadata.atime,
      new Date(sourceMetadata.mtimeMs + 5_000),
    );
    const indexBeforeReadTool = await readFile(indexPath);
    const previousGitDirectory = process.env.GIT_DIR;
    const previousOptionalLocks = process.env.GIT_OPTIONAL_LOCKS;
    const ambientGitDirectory = `${root}/ambient-git-dir-must-not-be-authority`;
    process.env.GIT_DIR = ambientGitDirectory;
    process.env.GIT_OPTIONAL_LOCKS = "1";
    try {
      await harness.server.handleValue({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "get_repo_pulse", arguments: {} },
      });
      expect(process.env.GIT_DIR).toBe(ambientGitDirectory);
      expect(process.env.GIT_OPTIONAL_LOCKS).toBe("1");
    } finally {
      if (previousGitDirectory === undefined) delete process.env.GIT_DIR;
      else process.env.GIT_DIR = previousGitDirectory;
      if (previousOptionalLocks === undefined) {
        delete process.env.GIT_OPTIONAL_LOCKS;
      } else {
        process.env.GIT_OPTIONAL_LOCKS = previousOptionalLocks;
      }
    }
    expect(await readFile(indexPath)).toEqual(indexBeforeReadTool);
    const pulse = GetRepoPulseOutputV1Schema.parse(harness.response(3).result);
    expect(pulse.structuredContent.meta.sourceSnapshotId).toBe(
      pulse.structuredContent.result.pulse.evaluatedSnapshotId,
    );

    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "build_task_brief",
        arguments: {
          task: "Change the task result while preserving its public behavior.",
          expectedRevision: 0,
          idempotencyKey: "cli-integration-brief",
          actor: "agent:cli-test",
          scope: ["src/task.ts"],
        },
      },
    });
    const built = BuildTaskBriefOutputV1Schema.parse(harness.response(4).result);
    expect(built.structuredContent.result.task.status).toBe("context_ready");

    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "get_task_brief",
        arguments: {
          taskId: built.structuredContent.result.task.taskId,
          section: "summary",
          pageSize: 10,
        },
      },
    });
    const read = GetTaskBriefOutputV1Schema.parse(harness.response(5).result);
    expect(read.structuredContent.result.task.taskId).toBe(
      built.structuredContent.result.task.taskId,
    );
    expect(read.structuredContent.result.items).toHaveLength(1);
    expect(await readSourceFixture(root)).toBe(sourceBefore);
    expect(await snapshotRepositoryFiles(root)).toEqual(repositoryBefore);
    expect(await git(root, ["diff", "--", "src/task.ts"])).toBe("");

    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "refresh_index", arguments: {} },
    });
    expect(harness.response(6).error).toEqual({
      code: -32_602,
      message: "Invalid tool arguments",
    });
  });

  it("keeps initialize and tools/list available in permanent binding_error", async () => {
    const harness = testServer(await resolveInitialBinding([]));
    await initialize(harness.server);
    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });
    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "get_repo_pulse", arguments: {} },
    });

    expect(harness.response(2).result.tools).toHaveLength(3);
    const failure = McpToolErrorResultV1Schema.parse(harness.response(3).result);
    expect(failure.structuredContent.error).toEqual({
      schemaVersion: 1,
      code: "workspace_binding_required",
      details: { reason: "root_missing" },
    });
  });

  it("enforces the lifecycle and separates protocol errors from tool errors", async () => {
    const root = await createGitRepository();
    const harness = testServer(await resolveInitialBinding([root]));
    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    });
    await harness.server.processFrame("malformed");
    expect(harness.response(1).error.code).toBe(-32_002);
    expect(harness.messages()).toContainEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32_700, message: "Parse error" },
    });
  });
});

describe("MCP Roots membership timing", () => {
  it("fails closed while initial and refreshed membership are pending, then recovers", async () => {
    const root = await createGitRepository();
    const harness = testServer(await resolveInitialBinding([root]));
    await initialize(harness.server, { roots: { listChanged: true } });
    const firstRootsRequest = harness
      .messages()
      .find((message) => message.method === "roots/list");
    expect(firstRootsRequest).toBeDefined();

    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "get_repo_pulse", arguments: {} },
    });
    expect(
      McpToolErrorResultV1Schema.parse(harness.response(2).result).structuredContent
        .error,
    ).toMatchObject({
      code: "workspace_binding_required",
      details: { reason: "root_unavailable" },
    });

    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: firstRootsRequest.id,
      result: { roots: [{ uri: pathToFileURL(root).href }] },
    });
    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "get_repo_pulse", arguments: {} },
    });
    expect(GetRepoPulseOutputV1Schema.parse(harness.response(3).result).isError).toBe(
      false,
    );

    await harness.server.handleValue({
      jsonrpc: "2.0",
      method: "notifications/roots/list_changed",
      params: {},
    });
    const rootsRequests = harness
      .messages()
      .filter((message) => message.method === "roots/list");
    const refreshedRequest = rootsRequests.at(-1);
    expect(refreshedRequest.id).not.toBe(firstRootsRequest.id);
    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "get_repo_pulse", arguments: {} },
    });
    expect(
      McpToolErrorResultV1Schema.parse(harness.response(4).result).structuredContent
        .error,
    ).toMatchObject({ details: { reason: "root_unavailable" } });

    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: refreshedRequest.id,
      result: { roots: [{ uri: pathToFileURL(root).href }] },
    });
    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "get_repo_pulse", arguments: {} },
    });
    expect(GetRepoPulseOutputV1Schema.parse(harness.response(5).result).isError).toBe(
      false,
    );
  });
});
