import { PassThrough } from "node:stream";

import {
  BuildTaskBriefOutputV1Schema,
  McpToolErrorResultV1Schema,
  OpenWorkbenchOutputV1Schema,
} from "@understand-code/contracts/mcp";
import { closeAllWorkbenchSessionsV1 } from "@understand-code/workbench-runtime";
import { afterEach, describe, expect, it } from "vitest";

import { resolveInitialBinding } from "../src/binding/root-binding.js";
import { McpStdioServer } from "../src/mcp/server.js";
import {
  cleanupTemporaryDirectories,
  createGitRepository,
} from "./helpers.js";

afterEach(async () => {
  await closeAllWorkbenchSessionsV1();
  await cleanupTemporaryDirectories();
});

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
      clientInfo: { name: "workbench-test", version: "1.0.0" },
    },
  });
  await server.handleValue({
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {},
  });
}

describe("open_workbench MCP vertical", () => {
  it("opens a Task deep link bound to the published snapshot and serves its loopback route", async () => {
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
          task: "Open this Task in the local Workbench.",
          expectedRevision: 0,
          idempotencyKey: "open-workbench-task",
          actor: "agent:workbench-test",
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
        name: "open_workbench",
        arguments: { route: { view: "tasks", taskId, section: "summary" } },
      },
    });
    const opened = OpenWorkbenchOutputV1Schema.parse(harness.response(3).result);
    expect(opened.structuredContent.result.route).toEqual({
      view: "tasks",
      taskId,
      section: "summary",
    });
    expect(opened.structuredContent.result.runtime.identity.worktreeId).toBe(
      opened.structuredContent.meta.worktreeId,
    );

    const deepLink = new URL(opened.structuredContent.result.deepLink);
    expect(deepLink.hostname).toBe("127.0.0.1");
    expect(deepLink.hash.length).toBeGreaterThan(32);
    const healthResponse = await fetch(new URL("/healthz", deepLink), {
      headers: { connection: "close" },
    });
    expect(healthResponse.status).toBe(200);
    await expect(healthResponse.json()).resolves.toMatchObject({
      ok: true,
      runtime: opened.structuredContent.result.runtime.identity,
    });

    const exchangeResponse = await fetch(
      new URL("/__workbench/launch", deepLink),
      {
        method: "POST",
        headers: {
          connection: "close",
          "content-type": "application/json",
        },
        body: JSON.stringify({ token: deepLink.hash.slice(1) }),
      },
    );
    expect(exchangeResponse.status).toBe(200);
    const cookie = exchangeResponse.headers.get("set-cookie");
    expect(cookie).toContain("workbench_session=");
    const taskResponse = await fetch(
      new URL(`/tasks/${encodeURIComponent(taskId)}`, deepLink),
      { headers: { connection: "close", cookie: cookie! } },
    );
    expect(taskResponse.status).toBe(200);
    await expect(taskResponse.json()).resolves.toMatchObject({
      route: { view: "tasks", taskId, section: "summary" },
    });
  });

  it("rejects a deep link to an unknown Task before starting a Workbench", async () => {
    const root = await createGitRepository();
    const harness = testServer(await resolveInitialBinding([root]));
    await initialize(harness.server);

    const missingTaskId = "00000000000000000000000000";
    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "open_workbench",
        arguments: { route: { view: "tasks", taskId: missingTaskId } },
      },
    });
    const failure = McpToolErrorResultV1Schema.parse(harness.response(2).result);
    expect(failure.structuredContent.error).toEqual({
      schemaVersion: 1,
      code: "resource_not_found",
      details: { resourceKind: "task", resourceId: missingTaskId },
    });
  });
});
