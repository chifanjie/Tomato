import { execFile as execFileCallback, spawn } from "node:child_process";
import { once } from "node:events";
import { chmod, cp, readFile, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  BuildTaskBriefOutputV1Schema,
  GetTaskBriefOutputV1Schema,
  OpenWorkbenchOutputV1Schema,
  RefreshIndexOutputV1Schema,
} from "@understand-code/contracts/mcp";
import {
  INSTALLATION_CLI_BUNDLE_FILE,
  INSTALLATION_CONFIG_FILE,
  INSTALLATION_MANIFEST_FILE,
  INSTALLATION_WORKBENCH_UI,
  INSTALLATION_WRAPPER_FILE,
} from "@understand-code/installation-lifecycle";
import { afterEach, describe, expect, it } from "vitest";

import {
  cleanupTemporaryDirectories,
  collectJsonLines,
  createGitRepository,
  createTemporaryDirectory,
  writeMessage,
} from "./helpers.js";

const execFile = promisify(execFileCallback);
const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const coldPath = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(
  path.delimiter,
);
const liveChildren = new Set<ReturnType<typeof spawn>>();

afterEach(async () => {
  await Promise.all(
    [...liveChildren].map(async (child) => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill("SIGTERM");
      await once(child, "close");
    }),
  );
  liveChildren.clear();
  await cleanupTemporaryDirectories();
});

async function loopbackListenIsAvailable(): Promise<boolean> {
  const server = createServer();
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EPERM") return false;
    throw error;
  } finally {
    if (server.listening) {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error === undefined ? resolve() : reject(error))),
      );
    }
  }
}

async function makeReleaseCopies(): Promise<{
  readonly initial: string;
  readonly upgraded: string;
}> {
  const source = path.join(packageRoot, "dist/understand-code.mjs");
  const bytes = await readFile(source);
  const releaseRoot = await createTemporaryDirectory("understand-code-alpha-releases-");
  const initial = path.join(releaseRoot, "understand-code-initial.mjs");
  const upgraded = path.join(releaseRoot, "understand-code-upgraded.mjs");
  await cp(path.join(packageRoot, "dist/native"), path.join(releaseRoot, "native"), {
    recursive: true,
  });
  await writeFile(initial, bytes, { mode: 0o755 });
  await writeFile(
    upgraded,
    Buffer.concat([bytes, Buffer.from("\n// alpha upgrade fixture\n", "utf8")]),
    { mode: 0o755 },
  );
  await Promise.all([chmod(initial, 0o755), chmod(upgraded, 0o755)]);
  return { initial, upgraded };
}

async function runLifecycle(
  executable: string,
  operation: "install" | "upgrade" | "rollback" | "doctor" | "uninstall",
  root: string,
  host?: "codex" | "claude",
): Promise<Record<string, any>> {
  const args = [operation, "--root", root];
  if (host !== undefined) args.push("--host", host);
  const result = await execFile(executable, args, {
    cwd: path.dirname(root),
    encoding: "utf8",
    env: { PATH: coldPath, NODE_PATH: "" },
  });
  expect(result.stderr).toBe("");
  return JSON.parse(result.stdout) as Record<string, any>;
}

function initialize(child: ReturnType<typeof spawn>): void {
  writeMessage(child as any, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "installed-host-alpha", version: "1.0.0" },
    },
  });
  writeMessage(child as any, {
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {},
  });
}

function startInstalledHost(installRoot: string, repositoryRoot: string) {
  const child = spawn(
    path.join(installRoot, INSTALLATION_WRAPPER_FILE),
    ["--root", repositoryRoot],
    {
      cwd: path.dirname(installRoot),
      env: { PATH: coldPath, NODE_PATH: "" },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  liveChildren.add(child);
  child.once("close", () => liveChildren.delete(child));
  const output = collectJsonLines(child);
  initialize(child);
  return { child, output };
}

async function stopInstalledHost(
  child: ReturnType<typeof spawn>,
  stderr: readonly string[],
): Promise<void> {
  child.stdin!.end();
  const [exitCode] = await once(child, "close");
  expect(exitCode).toBe(0);
  expect(stderr.join("")).toBe("");
}

describe("installed dual-host alpha", () => {
  it(
    "runs one shared Task through bundled Codex and Claude wrappers and preserves the bundle across lifecycle operations",
    async () => {
      const repositoryRoot = await createGitRepository({ seedArtifacts: false });
      const releases = await makeReleaseCopies();
      const codexRoot = path.join(
        await createTemporaryDirectory("understand-code-codex-home-"),
        "install",
      );
      const claudeRoot = path.join(
        await createTemporaryDirectory("understand-code-claude-home-"),
        "install",
      );

      await expect(
        runLifecycle(releases.initial, "install", codexRoot, "codex"),
      ).resolves.toMatchObject({ ok: true, status: "installed" });
      await expect(
        runLifecycle(releases.initial, "install", claudeRoot, "claude"),
      ).resolves.toMatchObject({ ok: true, status: "installed" });
      for (const installationRoot of [codexRoot, claudeRoot]) {
        const manifest = JSON.parse(
          await readFile(
            path.join(installationRoot, INSTALLATION_MANIFEST_FILE),
            "utf8",
          ),
        ) as { workbenchUi?: string };
        expect(manifest.workbenchUi).toBe(INSTALLATION_WORKBENCH_UI);
      }
      const initialReleaseBytes = await readFile(releases.initial);
      expect(initialReleaseBytes.toString("utf8")).not.toContain(packageRoot);
      expect(initialReleaseBytes.toString("utf8")).not.toContain("workspace:*");
      expect(
        await readFile(path.join(codexRoot, INSTALLATION_CLI_BUNDLE_FILE)),
      ).toEqual(initialReleaseBytes);
      expect(
        await readFile(path.join(claudeRoot, INSTALLATION_CLI_BUNDLE_FILE)),
      ).toEqual(initialReleaseBytes);
      await unlink(releases.initial);
      await expect(
        runLifecycle(
          path.join(codexRoot, INSTALLATION_CLI_BUNDLE_FILE),
          "doctor",
          codexRoot,
        ),
      ).resolves.toMatchObject({ ok: true, status: "healthy" });
      await expect(
        runLifecycle(
          path.join(claudeRoot, INSTALLATION_CLI_BUNDLE_FILE),
          "doctor",
          claudeRoot,
        ),
      ).resolves.toMatchObject({ ok: true, status: "healthy" });

      const codexConfig = JSON.parse(
        await readFile(path.join(codexRoot, INSTALLATION_CONFIG_FILE), "utf8"),
      ) as { mcpServers: Record<string, { command: string; args: string[] }> };
      const claudeConfig = JSON.parse(
        await readFile(path.join(claudeRoot, INSTALLATION_CONFIG_FILE), "utf8"),
      ) as { mcpServers: Record<string, { command: string; args: string[] }> };
      expect(codexConfig.mcpServers["understand-code"]).toEqual({
        command: path.join(codexRoot, INSTALLATION_WRAPPER_FILE),
        args: ["--root", "${WORKSPACE_ROOT}"],
      });
      expect(claudeConfig.mcpServers["understand-code"]).toEqual({
        command: path.join(claudeRoot, INSTALLATION_WRAPPER_FILE),
        args: ["--root", "${CLAUDE_PROJECT_DIR}"],
      });

      const codex = startInstalledHost(codexRoot, repositoryRoot);
      await codex.output.waitFor((message) => message.id === 1);
      writeMessage(codex.child as any, {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "refresh_index",
          arguments: {
            mode: "full",
            idempotencyKey: "installed-codex-full-refresh",
            actor: "agent:codex-alpha",
          },
        },
      });
      const refreshed = RefreshIndexOutputV1Schema.parse(
        (await codex.output.waitFor((message) => message.id === 2)).result,
      );
      expect(refreshed.structuredContent.result.operation.status).toBe("completed");
      writeMessage(codex.child as any, {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "build_task_brief",
          arguments: {
            task: "Prepare a safe change to the task function.",
            expectedRevision: 0,
            idempotencyKey: "installed-codex-task",
            actor: "agent:codex-alpha",
            scope: ["src/task.ts"],
          },
        },
      });
      const brief = BuildTaskBriefOutputV1Schema.parse(
        (await codex.output.waitFor((message) => message.id === 3)).result,
      );
      await stopInstalledHost(codex.child, codex.output.stderr);

      const claude = startInstalledHost(claudeRoot, repositoryRoot);
      await claude.output.waitFor((message) => message.id === 1);
      writeMessage(claude.child as any, {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "get_task_brief",
          arguments: {
            taskId: brief.structuredContent.result.task.taskId,
            section: "summary",
          },
        },
      });
      const resumed = GetTaskBriefOutputV1Schema.parse(
        (await claude.output.waitFor((message) => message.id === 2)).result,
      );
      expect(resumed.structuredContent.result.task.taskId).toBe(
        brief.structuredContent.result.task.taskId,
      );
      if (await loopbackListenIsAvailable()) {
        writeMessage(claude.child as any, {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: {
            name: "open_workbench",
            arguments: {
              route: {
                view: "tasks",
                taskId: brief.structuredContent.result.task.taskId,
                section: "summary",
              },
              openBrowser: false,
            },
          },
        });
        const workbench = OpenWorkbenchOutputV1Schema.parse(
          (await claude.output.waitFor((message) => message.id === 3)).result,
        );
        expect(workbench.structuredContent.result.runtime.disposition).toBe("started");
        const deepLink = new URL(workbench.structuredContent.result.deepLink);
        expect(deepLink.hostname).toBe("127.0.0.1");
        expect(deepLink.hash.length).toBeGreaterThan(32);
        const health = await fetch(new URL("/healthz", deepLink), {
          headers: { connection: "close" },
        });
        expect(health.status).toBe(200);
        await expect(health.json()).resolves.toMatchObject({
          ok: true,
          runtime: workbench.structuredContent.result.runtime.identity,
        });
      }
      await stopInstalledHost(claude.child, claude.output.stderr);

      const initialInstalledBundle = await readFile(
        path.join(codexRoot, INSTALLATION_CLI_BUNDLE_FILE),
      );
      await expect(
        runLifecycle(releases.upgraded, "upgrade", codexRoot, "codex"),
      ).resolves.toMatchObject({
        ok: true,
        status: "updated",
        rollbackAvailable: true,
      });
      expect(
        await readFile(path.join(codexRoot, INSTALLATION_CLI_BUNDLE_FILE)),
      ).not.toEqual(initialInstalledBundle);
      await expect(
        runLifecycle(
          path.join(codexRoot, INSTALLATION_CLI_BUNDLE_FILE),
          "rollback",
          codexRoot,
        ),
      ).resolves.toMatchObject({ ok: true, status: "rolled_back" });
      expect(
        await readFile(path.join(codexRoot, INSTALLATION_CLI_BUNDLE_FILE)),
      ).toEqual(initialInstalledBundle);

      await expect(
        runLifecycle(
          path.join(codexRoot, INSTALLATION_CLI_BUNDLE_FILE),
          "uninstall",
          codexRoot,
        ),
      ).resolves.toMatchObject({ ok: true, status: "removed" });
      await expect(
        runLifecycle(
          path.join(claudeRoot, INSTALLATION_CLI_BUNDLE_FILE),
          "uninstall",
          claudeRoot,
        ),
      ).resolves.toMatchObject({ ok: true, status: "removed" });
      await expect(
        readFile(path.join(codexRoot, INSTALLATION_CLI_BUNDLE_FILE)),
      ).rejects.toMatchObject({ code: "ENOENT" });
      await expect(
        readFile(path.join(claudeRoot, INSTALLATION_CLI_BUNDLE_FILE)),
      ).rejects.toMatchObject({ code: "ENOENT" });
    },
    90_000,
  );
});
