import { once } from "node:events";
import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { spawn } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories = [];
const activeChildren = new Set();
const scriptPath = resolve("scripts/host-binding-probe.mjs");
const safeEnvironmentKeys = [
  "PLUGIN_ROOT",
  "PLUGIN_DATA",
  "CLAUDE_PLUGIN_ROOT",
  "CLAUDE_PLUGIN_DATA",
  "CLAUDE_PROJECT_DIR",
];

afterEach(async () => {
  for (const child of activeChildren) {
    if (child.exitCode === null) child.kill();
  }
  activeChildren.clear();
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("host binding probe", () => {
  it("records only sanitized host evidence and writes a private artifact", async () => {
    const directory = await createTemporaryDirectory();
    const outputPath = join(directory, "probe.json");
    await writeFile(outputPath, "old world-readable artifact", { mode: 0o644 });
    await chmod(outputPath, 0o644);

    const { child, messages, stderr } = spawnProbe(
      ["--output", outputPath, "--root", "."],
      {
        cwd: process.cwd(),
        env: createProbeEnvironment({
          PLUGIN_ROOT: "/safe/plugin",
          CLAUDE_PROJECT_DIR: "/safe/project",
          SECRET_SHOULD_NOT_LEAK: "env-secret-never-record",
        }),
      },
    );

    writeMessage(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {
          roots: { listChanged: true },
          elicitation: {},
          experimental: { token: "capability-secret-never-record" },
        },
        clientInfo: {
          name: "test-host",
          title: "Test Host",
          version: "1.0.0",
          _meta: { token: "client-secret-never-record" },
        },
      },
    });
    child.stdin.write("malformed-secret-never-record\n");
    writeMessage(child, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    });

    await waitFor(() => messages.some((message) => message.method === "roots/list"));
    const rootsRequest = messages.find((message) => message.method === "roots/list");
    writeMessage(child, {
      jsonrpc: "2.0",
      id: rootsRequest.id,
      result: {
        roots: [
          {
            uri: "file:///safe/project",
            name: "project",
            _meta: { token: "root-secret-never-record" },
          },
        ],
      },
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "report_host_binding", arguments: {} },
    });

    await waitFor(() => messages.some((message) => message.id === 2));
    child.stdin.end();
    const [exitCode] = await once(child, "close");

    const persistedText = await readFile(outputPath, "utf8");
    const persisted = JSON.parse(persistedText);
    const structured = messages.find((message) => message.id === 2).result
      .structuredContent;

    expect(exitCode).toBe(0);
    expect(stderr.join("")).toBe("");
    expect(structured).toMatchObject({
      explicitRoot: process.cwd(),
      clientInfo: {
        name: "test-host",
        title: "Test Host",
        version: "1.0.0",
      },
      protocolVersion: "2025-06-18",
      roots: {
        advertisedByClient: true,
        requested: true,
        result: [{ uri: "file:///safe/project", name: "project" }],
        error: null,
      },
    });
    expect(structured.environment).toEqual({
      PLUGIN_ROOT: "/safe/plugin",
      CLAUDE_PROJECT_DIR: "/safe/project",
    });
    expect(persisted.initialize.capabilities).toEqual({
      roots: true,
      rootsListChanged: true,
      elicitation: true,
      sampling: false,
    });
    expect(persisted.invocation).toEqual({
      outputConfigured: true,
      explicitRootConfigured: true,
    });
    expect(persisted).not.toHaveProperty("argv");
    expect(persistedText).not.toContain("never-record");
    expect(persisted.protocolErrors).toEqual([
      expect.objectContaining({
        kind: "parse_error",
        rawLength: Buffer.byteLength("malformed-secret-never-record"),
      }),
    ]);
    expect(messages).toContainEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
    expect(persisted.calls.map(({ method }) => method)).toEqual([
      "initialize",
      "notifications/initialized",
      "tools/call",
    ]);
    expect((await stat(outputPath)).mode & 0o777).toBe(0o600);
  });

  it("rejects unknown arguments without persisting their values", async () => {
    const directory = await createTemporaryDirectory();
    const outputPath = join(directory, "probe.json");
    const { child, stderr } = spawnProbe([
      "--output",
      outputPath,
      "--token",
      "argv-secret-never-record",
    ]);

    const [exitCode] = await once(child, "close");

    expect(exitCode).toBe(2);
    await expect(readFile(outputPath, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(stderr.join("")).not.toContain("argv-secret-never-record");
  });

  it.each([
    ["positional", ["argument-secret-never-record"]],
    ["equals form", ["--root=argument-secret-never-record"]],
    ["duplicate flag", ["--root", ".", "--root", "argument-secret-never-record"]],
    ["missing value", ["--root"]],
    ["control character", ["--root", "argument-secret-never-record\npath"]],
  ])("rejects %s CLI input with a fixed diagnostic", async (_name, args) => {
    const { child, stderr } = spawnProbe(args);

    const [exitCode] = await once(child, "close");

    expect(exitCode).toBe(2);
    expect(stderr.join("")).toBe("host-binding-probe: configuration error\n");
    expect(stderr.join("")).not.toContain("argument-secret-never-record");
  });

  it("does not echo a secret-bearing output path after a filesystem failure", async () => {
    const directory = await createTemporaryDirectory();
    const outputPath = join(
      directory,
      "missing-secret-never-record",
      "probe.json",
    );
    const { child, stderr } = spawnProbe(["--output", outputPath]);

    const [exitCode] = await once(child, "close");

    expect(exitCode).toBe(2);
    expect(stderr.join("")).toBe("host-binding-probe: artifact error\n");
    expect(stderr.join("")).not.toContain("secret-never-record");
  });

  it("rejects malformed initialize identity without storing it", async () => {
    const directory = await createTemporaryDirectory();
    const outputPath = join(directory, "probe.json");
    const { child, messages } = spawnProbe(["--output", outputPath]);

    writeMessage(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "version-secret-never-record",
        capabilities: {},
        clientInfo: {
          name: "invalid-host",
          version: "1.0.0",
          _meta: { token: "identity-secret-never-record" },
        },
      },
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 2,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: { roots: "capability-secret-never-record" },
        clientInfo: { name: "valid-host", version: "1.0.0" },
      },
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "report_host_binding", arguments: {} },
    });

    await waitFor(() => messages.some((message) => message.id === 3));
    child.stdin.end();
    const [exitCode] = await once(child, "close");
    const persistedText = await readFile(outputPath, "utf8");
    const persisted = JSON.parse(persistedText);

    expect(exitCode).toBe(0);
    expect(messages.find((message) => message.id === 1)).toEqual({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32602, message: "Invalid initialize parameters" },
    });
    expect(messages.find((message) => message.id === 2)).toEqual({
      jsonrpc: "2.0",
      id: 2,
      error: { code: -32602, message: "Invalid initialize parameters" },
    });
    expect(persisted.initialize).toBeNull();
    expect(messages.some((message) => message.method === "roots/list")).toBe(false);
    expect(persistedText).not.toContain("version-secret-never-record");
    expect(persistedText).not.toContain("identity-secret-never-record");
    expect(persistedText).not.toContain("capability-secret-never-record");
  });

  it("returns JSON-RPC errors and negotiates an explicit supported MCP version", async () => {
    const directory = await createTemporaryDirectory();
    const outputPath = join(directory, "probe.json");
    const { child, messages } = spawnProbe(["--output", outputPath]);

    writeMessage(child, {
      jsonrpc: "1.0",
      id: 7,
      method: "ping",
    });
    child.stdin.write("[]\n");
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2099-01-01",
        capabilities: {},
        clientInfo: {
          name: "future-host",
          version: "9.0.0",
          _meta: { token: "initialize-secret-never-record" },
        },
      },
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 8,
      method: "ping",
      result: { should: "not coexist with method" },
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 998,
      result: {},
      error: { code: -32603, message: "malformed response" },
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 999,
      result: {},
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 3,
      method: "ping",
      params: {},
    });

    await waitFor(() => messages.some((message) => message.id === 3));
    child.stdin.end();
    const [exitCode] = await once(child, "close");
    const persistedText = await readFile(outputPath, "utf8");
    const persisted = JSON.parse(persistedText);

    expect(exitCode).toBe(0);
    expect(messages).toContainEqual({
      jsonrpc: "2.0",
      id: 7,
      error: { code: -32600, message: "Invalid Request" },
    });
    expect(messages).toContainEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Invalid Request" },
    });
    expect(messages.find((message) => message.id === 1).result.protocolVersion).toBe(
      "2025-11-25",
    );
    expect(messages.find((message) => message.id === 8)).toEqual({
      jsonrpc: "2.0",
      id: 8,
      error: { code: -32600, message: "Invalid Request" },
    });
    expect(messages.some((message) => message.id === 998)).toBe(false);
    expect(messages.some((message) => message.id === 999)).toBe(false);
    expect(persisted.initialize).toMatchObject({
      requestedProtocolVersion: "unsupported",
      protocolVersion: "2025-11-25",
      clientInfo: { name: "future-host", version: "9.0.0" },
    });
    expect(persistedText).not.toContain("2099-01-01");
    expect(persistedText).not.toContain("initialize-secret-never-record");
    expect(persisted.protocolErrors.map(({ kind }) => kind)).toEqual([
      "invalid_request",
      "invalid_request",
      "invalid_request",
      "invalid_response",
      "unexpected_response",
    ]);
  });

  it.each([
    ["null", null],
    ["fractional", 1.5],
  ])("rejects an MCP request with a %s id", async (_name, invalidId) => {
    const directory = await createTemporaryDirectory();
    const outputPath = join(directory, "probe.json");
    const { child, messages } = spawnProbe(["--output", outputPath]);

    writeMessage(child, {
      jsonrpc: "2.0",
      id: invalidId,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "invalid-id-host", version: "1.0.0" },
      },
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "valid-id-host", version: "1.0.0" },
      },
    });

    await waitFor(() => messages.some((message) => message.id === 1));
    child.stdin.end();
    const [exitCode] = await once(child, "close");
    const persisted = JSON.parse(await readFile(outputPath, "utf8"));

    expect(exitCode).toBe(0);
    expect(messages).toContainEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Invalid Request" },
    });
    expect(persisted.initialize.clientInfo.name).toBe("valid-id-host");
    expect(persisted.protocolErrors.map(({ kind }) => kind)).toContain(
      "invalid_request",
    );
  });

  it("accepts an omitted arguments object for the no-argument tool", async () => {
    const directory = await createTemporaryDirectory();
    const outputPath = join(directory, "probe.json");
    const { child, messages } = spawnProbe(["--output", outputPath]);

    writeMessage(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "no-arguments-host", version: "1.0.0" },
      },
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "report_host_binding" },
    });

    await waitFor(() => messages.some((message) => message.id === 2));
    child.stdin.end();
    const [exitCode] = await once(child, "close");

    expect(exitCode).toBe(0);
    expect(messages.find((message) => message.id === 2)).toMatchObject({
      result: { isError: false },
    });
  });

  it("rejects extra arguments that violate the published tool schema", async () => {
    const directory = await createTemporaryDirectory();
    const outputPath = join(directory, "probe.json");
    const { child, messages } = spawnProbe(["--output", outputPath]);

    writeMessage(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "extra-arguments-host", version: "1.0.0" },
      },
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "report_host_binding",
        arguments: { token: "tool-argument-secret-never-record" },
      },
    });

    await waitFor(() => messages.some((message) => message.id === 2));
    child.stdin.end();
    const [exitCode] = await once(child, "close");
    const persistedText = await readFile(outputPath, "utf8");

    expect(exitCode).toBe(0);
    expect(messages.find((message) => message.id === 2)).toEqual({
      jsonrpc: "2.0",
      id: 2,
      error: { code: -32602, message: "Invalid tool arguments" },
    });
    expect(persistedText).not.toContain("tool-argument-secret-never-record");
  });

  it("handles a closed stdout transport without leaking a stack or source path", async () => {
    const { child, stderr } = spawnProbe([]);
    child.stdin.on("error", () => {});
    child.stdout.destroy();

    writeMessage(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "closed-transport-host", version: "1.0.0" },
      },
    });
    child.stdin.end();
    const [exitCode] = await once(child, "close");
    const diagnostic = stderr.join("");

    expect(exitCode).not.toBe(0);
    expect(diagnostic).not.toContain(scriptPath);
    expect(diagnostic).not.toContain("EPIPE");
    expect(diagnostic).not.toContain(" at ");
  });

  it("bounds an oversized frame and resumes at the next newline", async () => {
    const directory = await createTemporaryDirectory();
    const outputPath = join(directory, "probe.json");
    const { child, messages } = spawnProbe(["--output", outputPath]);

    writeMessage(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "frame-host", version: "1.0.0" },
      },
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    });
    child.stdin.write("x".repeat(1024 * 1024 + 1));
    child.stdin.write("\n");
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 2,
      method: "ping",
      params: {},
    });

    await waitFor(() => messages.some((message) => message.id === 2), 5_000);
    child.stdin.end();
    const [exitCode] = await once(child, "close");
    const persisted = JSON.parse(await readFile(outputPath, "utf8"));

    expect(exitCode).toBe(0);
    expect(messages).toContainEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
    expect(messages).toContainEqual({ jsonrpc: "2.0", id: 2, result: {} });
    expect(persisted.protocolErrors.map(({ kind }) => kind)).toContain(
      "frame_too_large",
    );
  });

  it("serializes roots refreshes and atomically replaces success and error state", async () => {
    const directory = await createTemporaryDirectory();
    const outputPath = join(directory, "probe.json");
    const { child, messages } = spawnProbe(["--output", outputPath]);

    writeMessage(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: { roots: { listChanged: true } },
        clientInfo: { name: "changing-host", version: "1.0.0" },
      },
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      method: "notifications/roots/list_changed",
      params: {},
    });

    await waitFor(
      () => messages.filter((message) => message.method === "roots/list").length === 1,
    );
    const firstRequest = messages.find((message) => message.method === "roots/list");
    writeMessage(child, {
      jsonrpc: "2.0",
      id: firstRequest.id,
      result: { roots: [{ uri: "file:///first" }] },
    });

    await waitFor(
      () => messages.filter((message) => message.method === "roots/list").length === 2,
    );
    const secondRequest = messages.filter(
      (message) => message.method === "roots/list",
    )[1];
    writeMessage(child, {
      jsonrpc: "2.0",
      id: secondRequest.id,
      error: {
        code: -32_003,
        message: "temporary roots failure",
        data: { token: "roots-error-secret-never-record" },
      },
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 20,
      method: "tools/call",
      params: { name: "report_host_binding", arguments: {} },
    });

    await waitFor(() => messages.some((message) => message.id === 20));
    expect(
      messages.find((message) => message.id === 20).result.structuredContent.roots,
    ).toMatchObject({
      result: [{ uri: "file:///first" }],
      error: { code: -32_003, message: "roots/list failed" },
      pending: false,
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      method: "notifications/roots/list_changed",
      params: {},
    });

    await waitFor(
      () => messages.filter((message) => message.method === "roots/list").length === 3,
    );
    const rootsRequests = messages.filter(
      (message) => message.method === "roots/list",
    );
    const thirdRequest = rootsRequests[2];
    writeMessage(child, {
      jsonrpc: "2.0",
      id: thirdRequest.id,
      result: {
        roots: [
          {
            uri: "https://user:roots-result-secret-never-record@example.test",
          },
        ],
      },
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 21,
      method: "tools/call",
      params: { name: "report_host_binding", arguments: {} },
    });

    await waitFor(() => messages.some((message) => message.id === 21));
    expect(
      messages.find((message) => message.id === 21).result.structuredContent.roots,
    ).toMatchObject({
      result: [{ uri: "file:///first" }],
      error: { code: -32602, message: "invalid_roots_result" },
      pending: false,
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      method: "notifications/roots/list_changed",
      params: {},
    });

    await waitFor(
      () => messages.filter((message) => message.method === "roots/list").length === 4,
    );
    const allRootsRequests = messages.filter(
      (message) => message.method === "roots/list",
    );
    const fourthRequest = allRootsRequests[3];
    writeMessage(child, {
      jsonrpc: "2.0",
      id: fourthRequest.id,
      result: {
        roots: [
          {
            uri: "file:///second",
            name: "second",
            token: "roots-extra-secret-never-record",
          },
        ],
      },
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "report_host_binding", arguments: {} },
    });

    await waitFor(() => messages.some((message) => message.id === 2));
    child.stdin.end();
    const [exitCode] = await once(child, "close");
    const persistedText = await readFile(outputPath, "utf8");
    const structured = messages.find((message) => message.id === 2).result
      .structuredContent;

    expect(exitCode).toBe(0);
    expect(new Set(allRootsRequests.map(({ id }) => id)).size).toBe(4);
    expect(structured.roots).toEqual({
      advertisedByClient: true,
      listChanged: true,
      requested: true,
      pending: false,
      result: [{ uri: "file:///second", name: "second" }],
      error: null,
    });
    expect(persistedText).not.toContain("roots-error-secret-never-record");
    expect(persistedText).not.toContain("roots-result-secret-never-record");
    expect(persistedText).not.toContain("roots-extra-secret-never-record");
  });

  it("does not invent roots when the client omits the capability", async () => {
    const directory = await createTemporaryDirectory();
    const outputPath = join(directory, "probe.json");
    const { child, messages } = spawnProbe(["--output", outputPath]);

    writeMessage(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "rootless-host", version: "1.0.0" },
      },
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "report_host_binding", arguments: {} },
    });

    await waitFor(() => messages.some((message) => message.id === 2));
    child.stdin.end();
    const [exitCode] = await once(child, "close");

    const structured = messages.find((message) => message.id === 2).result
      .structuredContent;
    expect(exitCode).toBe(0);
    expect(messages.some((message) => message.method === "roots/list")).toBe(false);
    expect(structured.roots).toEqual({
      advertisedByClient: false,
      listChanged: false,
      requested: false,
      pending: false,
      result: null,
      error: null,
    });
  });

  it("rejects roots change notifications when listChanged was not advertised", async () => {
    const directory = await createTemporaryDirectory();
    const outputPath = join(directory, "probe.json");
    const { child, messages } = spawnProbe(["--output", outputPath]);

    writeMessage(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: { roots: { listChanged: false } },
        clientInfo: { name: "static-roots-host", version: "1.0.0" },
      },
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    });
    await waitFor(() => messages.some((message) => message.method === "roots/list"));
    const initialRequest = messages.find(
      (message) => message.method === "roots/list",
    );
    writeMessage(child, {
      jsonrpc: "2.0",
      id: initialRequest.id,
      result: { roots: [{ uri: "file:///primary" }] },
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      method: "notifications/roots/list_changed",
      params: {},
    });

    await waitFor(async () => {
      try {
        const persisted = JSON.parse(await readFile(outputPath, "utf8"));
        return persisted.protocolErrors.some(
          ({ kind }) => kind === "invalid_roots_changed_notification",
        );
      } catch {
        return false;
      }
    });
    child.stdin.end();
    const [exitCode] = await once(child, "close");
    const persisted = JSON.parse(await readFile(outputPath, "utf8"));

    expect(exitCode).toBe(0);
    expect(messages.filter((message) => message.method === "roots/list")).toHaveLength(
      1,
    );
    expect(persisted.roots.result).toEqual([{ uri: "file:///primary" }]);
  });

  it("times out an unanswered roots request without losing the last result", async () => {
    const directory = await createTemporaryDirectory();
    const outputPath = join(directory, "probe.json");
    const { child, messages } = spawnProbe(["--output", outputPath]);

    writeMessage(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: { roots: { listChanged: true } },
        clientInfo: { name: "roots-timeout-host", version: "1.0.0" },
      },
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    });
    await waitFor(() => messages.some((message) => message.method === "roots/list"));
    const initialRequest = messages.find(
      (message) => message.method === "roots/list",
    );
    writeMessage(child, {
      jsonrpc: "2.0",
      id: initialRequest.id,
      result: { roots: [{ uri: "file:///primary" }] },
    });
    writeMessage(child, {
      jsonrpc: "2.0",
      method: "notifications/roots/list_changed",
      params: {},
    });

    await waitFor(async () => {
      try {
        const persisted = JSON.parse(await readFile(outputPath, "utf8"));
        return persisted.roots.error?.code === -32_001;
      } catch {
        return false;
      }
    }, 3_000);
    child.stdin.end();
    const [exitCode] = await once(child, "close");
    const persisted = JSON.parse(await readFile(outputPath, "utf8"));

    expect(exitCode).toBe(0);
    expect(persisted.roots).toMatchObject({
      pending: false,
      result: [{ uri: "file:///primary" }],
      error: { code: -32_001, message: "roots/list timed out" },
    });
  });

  it("refuses a symlink artifact target instead of following it", async () => {
    const directory = await createTemporaryDirectory();
    const targetPath = join(directory, "target.json");
    const outputPath = join(directory, "probe.json");
    await writeFile(targetPath, "do not overwrite");
    await symlink(targetPath, outputPath);
    const { child, stderr } = spawnProbe(["--output", outputPath]);

    const [exitCode] = await once(child, "close");

    expect(exitCode).toBe(2);
    expect(stderr.join("")).toBe("host-binding-probe: artifact error\n");
    expect(await readFile(targetPath, "utf8")).toBe("do not overwrite");
  });

  it("refuses a non-regular artifact target", async () => {
    const directory = await createTemporaryDirectory();
    const { child, stderr } = spawnProbe(["--output", directory]);

    const [exitCode] = await once(child, "close");

    expect(exitCode).toBe(2);
    expect(stderr.join("")).toBe("host-binding-probe: artifact error\n");
  });
});

async function createTemporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "understand-code-host-probe-"));
  temporaryDirectories.push(directory);
  return directory;
}

function spawnProbe(args, options = {}) {
  const child = spawn(process.execPath, [scriptPath, ...args], {
    ...options,
    env: options.env ?? createProbeEnvironment(),
    stdio: ["pipe", "pipe", "pipe"],
  });
  activeChildren.add(child);
  child.once("close", () => activeChildren.delete(child));
  const messages = [];
  const stderr = [];
  createInterface({ input: child.stdout }).on("line", (line) => {
    messages.push(JSON.parse(line));
  });
  child.stderr.on("data", (chunk) => stderr.push(String(chunk)));
  return { child, messages, stderr };
}

function createProbeEnvironment(overrides = {}) {
  const environment = { ...process.env };
  for (const key of safeEnvironmentKeys) delete environment[key];
  return { ...environment, ...overrides };
}

function writeMessage(child, message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

async function waitFor(predicate, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
  }
  throw new Error("Timed out waiting for probe output");
}
