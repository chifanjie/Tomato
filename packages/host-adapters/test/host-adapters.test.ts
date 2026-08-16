import { execFile, spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildMcpArgv,
  CLAUDE_MANIFEST_V1,
  CODEX_MANIFEST_V1,
  HostAdapterArgumentError,
  isHostAdapterManifestV1,
  parseHostAdapterArguments,
} from "../src/index.js";

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(import.meta.dirname, "..");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("host adapter contract", () => {
  it("keeps both bundled manifests and configs on the one explicit-root argv contract", async () => {
    expect(isHostAdapterManifestV1(CODEX_MANIFEST_V1)).toBe(true);
    expect(isHostAdapterManifestV1(CLAUDE_MANIFEST_V1)).toBe(true);
    expect(buildMcpArgv("/workspace/repository")).toEqual([
      "mcp",
      "--stdio",
      "--root",
      "/workspace/repository",
    ]);

    const codexConfig = JSON.parse(
      await readFile(path.join(packageRoot, "integrations/codex/mcp.json"), "utf8"),
    ) as { mcpServers: Record<string, { command: string; args: string[] }> };
    expect(codexConfig.mcpServers["understand-code"]).toEqual({
      command: "understand-code-codex",
      args: ["--root", "${WORKSPACE_ROOT}"],
    });
    const claudeConfig = JSON.parse(
      await readFile(path.join(packageRoot, "integrations/claude/.mcp.json"), "utf8"),
    ) as { mcpServers: Record<string, { command: string; args: string[] }> };
    expect(claudeConfig.mcpServers["understand-code"]).toEqual({
      command: "understand-code-claude",
      args: ["--root", "${CLAUDE_PROJECT_DIR}"],
    });
    const codexManifest = JSON.parse(
      await readFile(path.join(packageRoot, "integrations/codex/manifest.json"), "utf8"),
    ) as unknown;
    const claudeManifest = JSON.parse(
      await readFile(path.join(packageRoot, "integrations/claude/manifest.json"), "utf8"),
    ) as unknown;
    expect(isHostAdapterManifestV1(codexManifest)).toBe(true);
    expect(isHostAdapterManifestV1(claudeManifest)).toBe(true);
    expect((claudeManifest as { cliArgs: readonly string[] }).cliArgs[3]).toBe(
      "${CLAUDE_PROJECT_DIR}",
    );
  });

  const invalidArguments: readonly (readonly string[])[] = [
    [],
    ["--root"],
    ["--root", "relative/workspace"],
    ["--root", "${WORKSPACE_ROOT}"],
    ["--root", "/workspace/one", "--stdio"],
  ];
  it.each(invalidArguments.map((values) => ({ values })))
  ("fails closed when the wrapper root is missing or unsafe: %j", ({ values }) => {
    expect(() => parseHostAdapterArguments(values)).toThrow(HostAdapterArgumentError);
  });
});

describe("bundled wrappers", () => {
  it("returns a generic configuration error without a root", async () => {
    const wrapper = path.join(packageRoot, "integrations/codex/run.mjs");
    await expect(execFileAsync(process.execPath, [wrapper], { encoding: "utf8" })).rejects.toMatchObject({
      code: 2,
      stderr: "workspace_root_required\n",
    });
  });

  it("passes only the canonical MCP argv to the CLI", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "understand-host-adapter-"));
    temporaryDirectories.push(directory);
    const recordPath = path.join(directory, "argv.json");
    const fakeCli = path.join(directory, "fake-cli.mjs");
    await writeFile(
      fakeCli,
      [
        "#!/usr/bin/env node",
        "import { writeFile } from 'node:fs/promises';",
        `await writeFile(${JSON.stringify(recordPath)}, JSON.stringify(process.argv.slice(2)));`,
      ].join("\n"),
      { mode: 0o755 },
    );

    const wrapper = path.join(packageRoot, "integrations/claude/run.mjs");
    await execFileAsync(
      process.execPath,
      [wrapper, "--root", directory],
      {
        encoding: "utf8",
        env: { ...process.env, UNDERSTAND_CODE_CLI: fakeCli },
      },
    );
    expect(JSON.parse(await readFile(recordPath, "utf8"))).toEqual([
      "mcp",
      "--stdio",
      "--root",
      directory,
    ]);
  });
});
