import { access } from "node:fs/promises";
import path from "node:path";
import { PassThrough } from "node:stream";

import { McpToolErrorResultV1Schema } from "@understand-code/contracts/mcp";
import { afterEach, describe, expect, it } from "vitest";

import { resolveInitialBinding } from "../src/binding/root-binding.js";
import { McpStdioServer } from "../src/mcp/server.js";
import {
  cleanupTemporaryDirectories,
  createGitRepository,
  git,
  snapshotRepositoryFiles,
} from "./helpers.js";

afterEach(cleanupTemporaryDirectories);

function testServer(
  initialBinding: Awaited<ReturnType<typeof resolveInitialBinding>>,
) {
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

const PROVIDER_UNAVAILABLE = Object.freeze({
  isError: true,
  content: [
    {
      type: "text",
      text: "The strong Store is unavailable. Run Doctor for details.",
    },
  ],
  structuredContent: {
    error: {
      schemaVersion: 1,
      code: "provider_unavailable",
      details: { reason: "unavailable" },
    },
  },
});

describe("managed Task read capability lock", () => {
  it("locks Evidence, search, and impact reads before private Store access", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    const sourceBefore = await snapshotRepositoryFiles(root);
    const indexBefore = await git(root, ["write-tree"]);
    const harness = testServer(await resolveInitialBinding([root]));
    await initialize(harness.server);

    const calls = [
      {
        name: "get_evidence",
        arguments: {
          taskId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
          evidenceIds: ["evidence:any"],
          pageSize: 2,
        },
      },
      {
        name: "search_context",
        arguments: {
          taskId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
          query: "task",
          pageSize: 10,
        },
      },
      {
        name: "trace_impact",
        arguments: {
          taskId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
          sourceNodeIds: ["function:task"],
          direction: "downstream",
          pageSize: 10,
        },
      },
      {
        name: "search_context",
        arguments: { query: "task" },
      },
      {
        name: "trace_impact",
        arguments: {
          sourceNodeIds: ["function:task"],
          direction: "both",
        },
      },
    ] as const;

    for (const [offset, call] of calls.entries()) {
      const id = offset + 2;
      await harness.server.handleValue({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name: call.name, arguments: call.arguments },
      });
      const failure = McpToolErrorResultV1Schema.parse(
        harness.response(id).result,
      );
      expect(failure).toEqual(PROVIDER_UNAVAILABLE);
      expect(await snapshotRepositoryFiles(root)).toEqual(sourceBefore);
      expect(await git(root, ["write-tree"])).toBe(indexBefore);
      await expect(
        access(path.join(root, ".understand-code")),
      ).rejects.toMatchObject({ code: "ENOENT" });
    }
  });
});
