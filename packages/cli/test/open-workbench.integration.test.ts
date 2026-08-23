import { access } from "node:fs/promises";
import path from "node:path";
import { PassThrough } from "node:stream";

import { McpToolErrorResultV1Schema } from "@understand-code/contracts/mcp";
import { closeAllWorkbenchSessionsV1 } from "@understand-code/workbench-runtime";
import { afterEach, describe, expect, it } from "vitest";

import { resolveInitialBinding } from "../src/binding/root-binding.js";
import { McpStdioServer } from "../src/mcp/server.js";
import {
  cleanupTemporaryDirectories,
  createGitRepository,
  git,
  snapshotRepositoryFiles,
} from "./helpers.js";

afterEach(async () => {
  await closeAllWorkbenchSessionsV1();
  await cleanupTemporaryDirectories();
});

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
      clientInfo: { name: "workbench-test", version: "1.0.0" },
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

describe("open_workbench MCP capability lock", () => {
  it("fails before opening legacy Task state or starting a loopback session", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    const sourceBefore = await snapshotRepositoryFiles(root);
    const indexBefore = await git(root, ["write-tree"]);
    const harness = testServer(await resolveInitialBinding([root]));
    await initialize(harness.server);

    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "open_workbench",
        arguments: {
          route: {
            view: "tasks",
            taskId: "00000000000000000000000000",
            section: "summary",
          },
        },
      },
    });

    const failure = McpToolErrorResultV1Schema.parse(
      harness.response(2).result,
    );
    expect(failure).toEqual(PROVIDER_UNAVAILABLE);
    expect(await snapshotRepositoryFiles(root)).toEqual(sourceBefore);
    expect(await git(root, ["write-tree"])).toBe(indexBefore);
    await expect(
      access(path.join(root, ".understand-code")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("still validates public arguments before applying the capability lock", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    const harness = testServer(await resolveInitialBinding([root]));
    await initialize(harness.server);

    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "open_workbench",
        arguments: {
          route: { view: "tasks" },
          openBrowser: true,
        },
      },
    });

    const failure = McpToolErrorResultV1Schema.parse(
      harness.response(3).result,
    );
    expect(failure.structuredContent.error).toEqual({
      schemaVersion: 1,
      code: "invalid_arguments",
      details: {
        issues: [
          {
            path: ["openBrowser"],
            code: "browser_launch_not_supported",
            message: "Invalid tool argument.",
          },
        ],
      },
    });
  });
});
