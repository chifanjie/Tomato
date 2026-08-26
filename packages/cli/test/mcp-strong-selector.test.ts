import { PassThrough } from "node:stream";

import { describe, expect, it, vi } from "vitest";

const fakes = vi.hoisted(() => ({
  callImplementedTool: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../src/handlers/tools.js", () => ({
  callImplementedTool: fakes.callImplementedTool,
}));

vi.mock("../src/mcp/tool-registry.js", () => ({
  IMPLEMENTED_TOOLS: [],
  isImplementedToolName: (value: unknown) => value === "build_task_brief",
}));

import { McpStdioServer } from "../src/mcp/server.js";

async function initialize(server: McpStdioServer): Promise<void> {
  await server.handleValue({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "selector-test", version: "1.0.0" },
    },
  });
  await server.handleValue({
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {},
  });
}

describe("MCP production strong selector", () => {
  it("passes the explicit Provider installation root to the exact tool dispatch", async () => {
    const output = new PassThrough();
    const server = new McpStdioServer(
      { kind: "bound", canonicalRoot: "/srv/repository" },
      output,
      "/var/lib/understand-code/provider-authority",
    );
    await initialize(server);
    await server.handleValue({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "build_task_brief",
        arguments: { task: "test" },
      },
    });

    expect(fakes.callImplementedTool).toHaveBeenCalledExactlyOnceWith(
      "build_task_brief",
      { task: "test" },
      "/srv/repository",
      {
        canonicalInstallationRoot:
          "/var/lib/understand-code/provider-authority",
      },
    );
  });
});
