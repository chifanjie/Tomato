import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  BuildTaskBriefOutputV1Schema,
  GetRepoPulseOutputV1Schema,
  GetTaskBriefOutputV1Schema,
  McpToolErrorResultV1Schema,
} from "@understand-code/contracts/mcp";
import { afterEach, describe, expect, it } from "vitest";

import {
  cleanupTemporaryDirectories,
  collectJsonLines,
  createGitRepository,
  createTemporaryDirectory,
  readSourceFixture,
  snapshotRepositoryFiles,
  writeMessage,
} from "./helpers.js";

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

afterEach(cleanupTemporaryDirectories);

async function installPackedCli(): Promise<{
  readonly executable: string;
  readonly packageDirectory: string;
}> {
  const packDirectory = await createTemporaryDirectory("understand-code-pack-");
  await execFileAsync("pnpm", ["pack", "--pack-destination", packDirectory], {
    cwd: packageRoot,
    encoding: "utf8",
  });
  const tarballs = (await readdir(packDirectory)).filter((name) => name.endsWith(".tgz"));
  expect(tarballs).toHaveLength(1);
  const installRoot = await createTemporaryDirectory("understand-code-install-");
  await execFileAsync(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-package-lock",
      "--no-audit",
      "--no-fund",
      path.join(packDirectory, tarballs[0]!),
    ],
    { cwd: installRoot, encoding: "utf8" },
  );
  return {
    executable: path.join(installRoot, "node_modules/.bin/understand-code"),
    packageDirectory: path.join(
      installRoot,
      "node_modules/@understand-code/cli",
    ),
  };
}

function initialize(child: ReturnType<typeof spawn>): void {
  writeMessage(child as any, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "cold-e2e", version: "1.0.0" },
    },
  });
  writeMessage(child as any, {
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {},
  });
}

describe("cold packed CLI", () => {
  it(
    "installs outside the monorepo and executes the complete three-tool stdio slice",
    async () => {
      const root = await createGitRepository();
      const sourceBefore = await readSourceFixture(root);
      const repositoryBefore = await snapshotRepositoryFiles(root);
      const installed = await installPackedCli();
      const version = await execFileAsync(installed.executable, ["--version"], {
        cwd: path.dirname(installed.packageDirectory),
        encoding: "utf8",
      });
      expect(version.stdout).toBe("0.1.0\n");
      const help = await execFileAsync(installed.executable, ["--help"], {
        cwd: path.dirname(installed.packageDirectory),
        encoding: "utf8",
      });
      expect(help.stdout).toContain(
        "understand-code mcp --stdio --root <absolute-worktree-path>",
      );

      const manifest = JSON.parse(
        await readFile(path.join(installed.packageDirectory, "package.json"), "utf8"),
      );
      expect(manifest.dependencies ?? {}).toEqual({});
      const bundle = await readFile(
        path.join(installed.packageDirectory, "dist/understand-code.mjs"),
        "utf8",
      );
      expect(bundle).not.toContain("workspace:*");
      expect(bundle).not.toContain(packageRoot);

      const child = spawn(
        installed.executable,
        ["mcp", "--stdio", "--root", root],
        {
          cwd: path.dirname(installed.packageDirectory),
          env: {
            PATH: process.env.PATH,
            GIT_DIR: path.join(root, "ambient-git-dir-must-not-be-authority"),
          },
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      const collected = collectJsonLines(child);
      initialize(child);
      writeMessage(child, {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      });
      writeMessage(child, {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "get_repo_pulse", arguments: {} },
      });
      writeMessage(child, {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "build_task_brief",
          arguments: {
            task: "Prepare a safe change to the task function.",
            expectedRevision: 0,
            idempotencyKey: "cold-packed-brief",
            actor: "agent:cold-e2e",
            scope: ["src/task.ts"],
          },
        },
      });
      const listResponse = await collected.waitFor((message) => message.id === 2);
      expect(listResponse.result.tools.map((tool: any) => tool.name)).toEqual([
        "get_repo_pulse",
        "build_task_brief",
        "get_task_brief",
      ]);
      const pulseResponse = await collected.waitFor((message) => message.id === 3);
      GetRepoPulseOutputV1Schema.parse(pulseResponse.result);
      const buildResponse = await collected.waitFor((message) => message.id === 4);
      const built = BuildTaskBriefOutputV1Schema.parse(buildResponse.result);
      writeMessage(child, {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "get_task_brief",
          arguments: {
            taskId: built.structuredContent.result.task.taskId,
            section: "summary",
          },
        },
      });
      const getResponse = await collected.waitFor((message) => message.id === 5);
      GetTaskBriefOutputV1Schema.parse(getResponse.result);
      child.stdin.end();
      const [exitCode] = await once(child, "close");
      expect(exitCode).toBe(0);
      expect(collected.stderr.join("")).toBe("");
      expect(await readSourceFixture(root)).toBe(sourceBefore);
      expect(await snapshotRepositoryFiles(root)).toEqual(repositoryBefore);

      const unbound = spawn(installed.executable, ["mcp", "--stdio"], {
        cwd: path.dirname(installed.packageDirectory),
        env: { PATH: process.env.PATH },
        stdio: ["pipe", "pipe", "pipe"],
      });
      const unboundOutput = collectJsonLines(unbound);
      initialize(unbound);
      writeMessage(unbound, {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "get_repo_pulse", arguments: {} },
      });
      const unboundResponse = await unboundOutput.waitFor(
        (message) => message.id === 2,
      );
      expect(
        McpToolErrorResultV1Schema.parse(unboundResponse.result).structuredContent
          .error,
      ).toMatchObject({
        code: "workspace_binding_required",
        details: { reason: "root_missing" },
      });
      unbound.stdin.end();
      await once(unbound, "close");
      expect(unboundOutput.stderr.join("")).toBe("");

      await writeFile(
        path.join(root, ".understand-code/artifact-manifest.json"),
        `{\"canonicalRoot\":${JSON.stringify(root)}}\n`,
        "utf8",
      );
      const corrupt = spawn(
        installed.executable,
        ["mcp", "--stdio", "--root", root],
        {
          cwd: path.dirname(installed.packageDirectory),
          env: { PATH: process.env.PATH },
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      const corruptOutput = collectJsonLines(corrupt);
      initialize(corrupt);
      writeMessage(corrupt, {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "get_repo_pulse", arguments: {} },
      });
      const corruptResponse = await corruptOutput.waitFor(
        (message) => message.id === 2,
      );
      expect(
        McpToolErrorResultV1Schema.parse(corruptResponse.result).structuredContent
          .error,
      ).toMatchObject({
        code: "artifact_unavailable",
        details: { reason: "corrupt" },
      });
      corrupt.stdin.end();
      await once(corrupt, "close");
      expect(corruptOutput.stdout.join("")).not.toContain(root);
      expect(corruptOutput.stderr.join("")).not.toContain(root);
      expect(JSON.stringify(corruptResponse.result)).not.toContain(root);
      expect(await snapshotRepositoryFiles(root)).toEqual(repositoryBefore);

      const invalidCli = spawn(
        installed.executable,
        ["mcp", "--stdio", "--token", `${root}/must-not-leak`],
        {
          cwd: path.dirname(installed.packageDirectory),
          env: { PATH: process.env.PATH },
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      const invalidCliOutput = collectJsonLines(invalidCli);
      const [invalidExitCode] = await once(invalidCli, "close");
      expect(invalidExitCode).toBe(2);
      expect(invalidCliOutput.stdout.join("")).toBe("");
      expect(invalidCliOutput.stderr.join("")).toBe(
        "understand-code: configuration_error\n",
      );
      expect(invalidCliOutput.stderr.join("")).not.toContain(root);
    },
    60_000,
  );
});
