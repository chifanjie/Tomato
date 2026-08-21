import { PassThrough } from "node:stream";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

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
  seedPublishedContext,
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
    const root = await createGitRepository({ seedArtifacts: false });
    // Seed the published snapshot after a concrete worktree edit so the
    // fixture carries a trusted file digest and can produce source Evidence.
    await writeFile(
      path.join(root, "src/task.ts"),
      "export function task(): boolean { return true; }\n// evidence anchor\n",
      "utf8",
    );
    await seedPublishedContext(root);
    await mkdir(path.join(root, ".understand-code/knowledge-base"), { recursive: true });
    await writeFile(
      path.join(root, ".understand-code/knowledge-base/wiki-index.json"),
      `${JSON.stringify({
        version: 2,
        generatedAt: "2026-08-03T00:00:00.000Z",
        projectName: "cli-fixture",
        source: { outputLanguage: "en", generationMode: "fixture" },
        mainReadiness: { status: "ready", reasons: [], routePageIds: [] },
        referenceCoverage: {
          status: "complete",
          files: { covered: 0, total: 0, missingIds: [] },
          functions: { covered: 0, total: 0, missingIds: [] },
          types: { covered: 0, total: 0, missingIds: [] },
        },
        pages: [],
        nodeDocumentation: [],
        evidence: [],
      })}\n`,
      "utf8",
    );
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
      id: 4,
      method: "tools/call",
      params: {
        name: "get_evidence",
        arguments: {
          taskId,
          evidenceIds: built.structuredContent.result.evidenceIds,
        },
      },
    });
    const evidenceLookup = harness.response(4).result.structuredContent.result.evidence as readonly Record<string, unknown>[];
    const sourceEvidence = evidenceLookup.find((item) => typeof item.filePath === "string");
    expect(sourceEvidence).toBeDefined();

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
      {
        headers: {
          accept: "application/json",
          connection: "close",
          cookie: cookie!,
        },
      },
    );
    expect(taskResponse.status).toBe(200);
    await expect(taskResponse.json()).resolves.toMatchObject({
      route: { view: "tasks", taskId, section: "summary" },
    });
    const htmlResponse = await fetch(new URL("/workbench", deepLink), {
      headers: { connection: "close", cookie: cookie! },
    });
    expect(htmlResponse.status).toBe(200);
    expect(htmlResponse.headers.get("content-type")).toContain("text/html");
    const workbenchHtml = await htmlResponse.text();
    expect(workbenchHtml).toContain("/assets/");
    expect(workbenchHtml).not.toContain("/__workbench/app.js");
    const reactTaskResponse = await fetch(
      new URL(`/tasks/${encodeURIComponent(taskId)}`, deepLink),
      { headers: { connection: "close", cookie: cookie! } },
    );
    expect(reactTaskResponse.status).toBe(200);
    expect(reactTaskResponse.headers.get("content-type")).toContain("text/html");
    expect(await reactTaskResponse.text()).toBe(workbenchHtml);
    const dashboardGraphResponse = await fetch(
      new URL("/knowledge-graph.json", deepLink),
      { headers: { connection: "close", cookie: cookie! } },
    );
    expect(dashboardGraphResponse.status).toBe(200);
    await expect(dashboardGraphResponse.json()).resolves.toMatchObject({
      nodes: expect.any(Array),
      edges: expect.any(Array),
    });
    const briefResponse = await fetch(
      new URL("/__workbench/task-brief?section=summary", deepLink),
      { headers: { connection: "close", cookie: cookie! } },
    );
    expect(briefResponse.status).toBe(200);
    await expect(briefResponse.json()).resolves.toMatchObject({
      result: { task: { taskId }, section: "summary" },
    });
    const graphResponse = await fetch(
      new URL("/__workbench/context?surface=graph", deepLink),
      { headers: { connection: "close", cookie: cookie! } },
    );
    expect(graphResponse.status).toBe(200);
    await expect(graphResponse.json()).resolves.toMatchObject({
      surface: "graph",
      status: "ready",
      artifact: { counts: { nodes: 1, edges: 0 } },
    });
    const knowledgeResponse = await fetch(
      new URL("/__workbench/context?surface=knowledge", deepLink),
      { headers: { connection: "close", cookie: cookie! } },
    );
    expect(knowledgeResponse.status).toBe(200);
    await expect(knowledgeResponse.json()).resolves.toMatchObject({
      surface: "knowledge",
      status: "ready",
      artifact: {
        counts: {
          pages: 0,
          evidence: 0,
        },
      },
    });
    const evidenceId = sourceEvidence!.id as string;
    expect(evidenceId).toBeDefined();
    const evidenceResponse = await fetch(
      new URL(
        `/__workbench/evidence?taskId=${encodeURIComponent(taskId)}&evidenceId=${encodeURIComponent(evidenceId!)}`,
        deepLink,
      ),
      { headers: { connection: "close", cookie: cookie! } },
    );
    expect(evidenceResponse.status).toBe(200);
    const evidenceProjection = await evidenceResponse.json();
    expect(evidenceProjection).toMatchObject({
      schemaVersion: 1,
      surface: "evidence",
      taskId,
      evidenceId,
      status: "ready",
      evidence: {
        id: evidenceId,
        filePath: "src/task.ts",
        lineRange: [1, 1],
        observedAtSnapshotId: opened.structuredContent.meta.sourceSnapshotId,
      },
      source: {
        filePath: "src/task.ts",
        lineRange: [1, 1],
        content: expect.stringContaining("task"),
        truncated: false,
      },
    });
    expect(JSON.stringify(evidenceProjection)).not.toContain(root);
    const missingEvidenceResponse = await fetch(
      new URL(
        `/__workbench/evidence?taskId=${encodeURIComponent(taskId)}&evidenceId=${encodeURIComponent("01ARZ3NDEKTSV4RRFFQ69G5FBZ")}`,
        deepLink,
      ),
      { headers: { connection: "close", cookie: cookie! } },
    );
    expect(missingEvidenceResponse.status).toBe(200);
    await expect(missingEvidenceResponse.json()).resolves.toMatchObject({
      surface: "evidence",
      status: "unavailable",
      reason: "not_found",
    });
    const unauthenticatedEvidence = await fetch(
      new URL(
        `/__workbench/evidence?taskId=${encodeURIComponent(taskId)}&evidenceId=${encodeURIComponent(evidenceId!)}`,
        deepLink,
      ),
      { headers: { connection: "close" } },
    );
    expect(unauthenticatedEvidence.status).toBe(401);
    const unauthenticatedContext = await fetch(
      new URL("/__workbench/context?surface=graph", deepLink),
      { headers: { connection: "close" } },
    );
    expect(unauthenticatedContext.status).toBe(401);
    const mismatchedContext = await fetch(
      new URL(`/__workbench/context?surface=graph&taskId=${encodeURIComponent("01ARZ3NDEKTSV4RRFFQ69G5FAW")}`, deepLink),
      { headers: { connection: "close", cookie: cookie! } },
    );
    expect(mismatchedContext.status).toBe(409);
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
