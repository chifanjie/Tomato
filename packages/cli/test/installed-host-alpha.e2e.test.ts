import { execFile as execFileCallback, spawn } from "node:child_process";
import { once } from "node:events";
import {
  chmod,
  cp,
  lstat,
  readFile,
  realpath,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { McpToolErrorResultV1Schema } from "@understand-code/contracts/mcp";
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
  providerInstallationRoot?: string,
): Promise<Record<string, any>> {
  const args = [operation, "--root", root];
  if (host !== undefined) args.push("--host", host);
  if (providerInstallationRoot !== undefined) {
    args.push("--provider-installation-root", providerInstallationRoot);
  }
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

function expectStrongWriterLocked(result: unknown): void {
  expect(McpToolErrorResultV1Schema.parse(result)).toEqual({
    isError: true,
    content: [{
      type: "text",
      text: "The strong Store is unavailable. Run Doctor for details.",
    }],
    structuredContent: {
      error: {
        schemaVersion: 1,
        code: "provider_unavailable",
        details: { reason: "unavailable" },
      },
    },
  });
}

async function expectLegacyStoreAbsent(repositoryRoot: string): Promise<void> {
  await expect(
    lstat(path.join(repositoryRoot, ".understand-code")),
  ).rejects.toMatchObject({ code: "ENOENT" });
}

async function exerciseInstalledMutationLock(
  host: ReturnType<typeof startInstalledHost>,
  repositoryRoot: string,
  actor: string,
  keyPrefix: string,
): Promise<void> {
  const sourcePath = path.join(repositoryRoot, "src/task.ts");
  const indexPath = path.join(repositoryRoot, ".git/index");
  const before = await Promise.all([readFile(sourcePath), readFile(indexPath)]);
  const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
  const calls = [
    ["build_task_brief", {
      task: "Capability lock fixture.",
      expectedRevision: 0,
      idempotencyKey: `${keyPrefix}-build`,
      actor,
      scope: ["src/task.ts"],
    }],
    ["update_task", {
      taskId,
      action: { type: "transition_status", to: "planned" },
      expectedRevision: 0,
      idempotencyKey: `${keyPrefix}-update`,
      actor,
    }],
    ["update_task", {
      taskId,
      action: {
        type: "refresh_task_context",
        targetSnapshotId: "snapshot:locked",
      },
      expectedRevision: 0,
      idempotencyKey: `${keyPrefix}-context-refresh`,
      actor,
    }],
    ["update_task", {
      taskId,
      action: {
        type: "rebase_task",
        targetSnapshotId: "snapshot:locked",
        newBaselineSnapshotId: "snapshot:locked",
        reason: "Strong Store authority is unavailable.",
      },
      expectedRevision: 0,
      idempotencyKey: `${keyPrefix}-context-rebase`,
      actor,
    }],
    ["check_change", {
      taskId,
      actualSnapshotId: "snapshot:locked",
      includeWorktree: true,
      expectedRevision: 0,
      idempotencyKey: `${keyPrefix}-check`,
      actor,
    }],
    ["record_verification", {
      taskId,
      record: {
        verificationPlanEntryId: "verification-plan:locked",
        kind: "test",
        status: "passed",
        command: "pnpm test",
        exitCode: 0,
        summary: "Capability lock fixture.",
        claimIds: [],
        snapshotId: "snapshot:locked",
      },
      expectedRevision: 0,
      idempotencyKey: `${keyPrefix}-verification`,
      actor,
    }],
    ["refresh_index", {
      mode: "full",
      idempotencyKey: `${keyPrefix}-refresh`,
      actor,
    }],
  ] as const;
  for (const [index, [name, argumentsValue]] of calls.entries()) {
    const id = 2 + index;
    writeMessage(host.child as any, {
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: argumentsValue },
    });
    expectStrongWriterLocked(
      (await host.output.waitFor((message) => message.id === id)).result,
    );
    await expectLegacyStoreAbsent(repositoryRoot);
    expect(await Promise.all([readFile(sourcePath), readFile(indexPath)])).toEqual(
      before,
    );
  }
}

describe("installed dual-host alpha", () => {
  it("resolves a production Provider selector only through the healthy installed Host", async () => {
    const releases = await makeReleaseCopies();
    const providerRoot = await createTemporaryDirectory(
      "understand-code-provider-selector-",
    );
    const alternateProviderRoot = await createTemporaryDirectory(
      "understand-code-alternate-provider-selector-",
    );
    const installRoot = path.join(
      await createTemporaryDirectory("understand-code-strong-host-home-"),
      "install",
    );
    const canonicalProviderRoot = await realpath(providerRoot);
    const canonicalAlternateProviderRoot = await realpath(
      alternateProviderRoot,
    );

    await expect(
      runLifecycle(
        releases.initial,
        "install",
        installRoot,
        "codex",
        providerRoot,
      ),
    ).resolves.toMatchObject({ ok: true, status: "installed" });
    const installedCli = path.join(
      installRoot,
      INSTALLATION_CLI_BUNDLE_FILE,
    );
    const selectorArgs = [
      "__host-provider-selector",
      "--installation-root",
      installRoot,
    ];
    const selected = await execFile(installedCli, selectorArgs, {
      cwd: alternateProviderRoot,
      encoding: "utf8",
      env: {
        PATH: coldPath,
        NODE_PATH: "",
        UNDERSTAND_CODE_CLI: "/untrusted/provider-selector",
        UNDERSTAND_CODE_HOME: alternateProviderRoot,
        UNDERSTAND_CODE_INSTALL_ROOT: alternateProviderRoot,
      },
    });
    expect(selected).toEqual({
      stdout: `${canonicalProviderRoot}\n`,
      stderr: "",
    });

    const manifest = JSON.parse(
      await readFile(
        path.join(installRoot, INSTALLATION_MANIFEST_FILE),
        "utf8",
      ),
    ) as { providerInstallationRoot?: string };
    const configPath = path.join(installRoot, INSTALLATION_CONFIG_FILE);
    const originalConfigBytes = await readFile(configPath);
    const config = JSON.parse(originalConfigBytes.toString("utf8")) as {
      providerInstallationRoot?: string;
    };
    expect(manifest.providerInstallationRoot).toBe(canonicalProviderRoot);
    expect(config.providerInstallationRoot).toBe(canonicalProviderRoot);

    await writeFile(
      configPath,
      `${JSON.stringify({
        ...config,
        providerInstallationRoot: canonicalAlternateProviderRoot,
      })}\n`,
      { mode: 0o600 },
    );
    await expect(
      execFile(installedCli, selectorArgs, {
        encoding: "utf8",
        env: { PATH: coldPath, NODE_PATH: "" },
      }),
    ).rejects.toMatchObject({
      code: 2,
      stderr: "understand-code: configuration_error\n",
    });

    await writeFile(configPath, originalConfigBytes, { mode: 0o600 });
    await expect(
      runLifecycle(installedCli, "doctor", installRoot),
    ).resolves.toMatchObject({ ok: true, status: "healthy" });
    await expect(
      runLifecycle(installedCli, "uninstall", installRoot),
    ).resolves.toMatchObject({ ok: true, status: "removed" });
    expect(await lstat(providerRoot)).toBeDefined();
    expect(await lstat(alternateProviderRoot)).toBeDefined();
  });

  it(
    "preserves the strong-writer lock across bundled hosts and lifecycle operations",
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

      await expectLegacyStoreAbsent(repositoryRoot);
      const codex = startInstalledHost(codexRoot, repositoryRoot);
      const codexInitialization = await codex.output.waitFor((message) => message.id === 1);
      expect(codexInitialization.result.instructions).toContain("knowledge.action=stage");
      expect(codexInitialization.result.instructions).toContain("provider_unavailable");
      await exerciseInstalledMutationLock(
        codex,
        repositoryRoot,
        "agent:codex-alpha",
        "installed-codex",
      );
      await stopInstalledHost(codex.child, codex.output.stderr);
      await expectLegacyStoreAbsent(repositoryRoot);

      const claude = startInstalledHost(claudeRoot, repositoryRoot);
      const claudeInitialization = await claude.output.waitFor((message) => message.id === 1);
      expect(claudeInitialization.result.instructions).toBe(codexInitialization.result.instructions);
      await exerciseInstalledMutationLock(
        claude,
        repositoryRoot,
        "agent:claude-alpha",
        "installed-claude",
      );
      await stopInstalledHost(claude.child, claude.output.stderr);
      await expectLegacyStoreAbsent(repositoryRoot);

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

      const rolledBackCodex = startInstalledHost(codexRoot, repositoryRoot);
      await rolledBackCodex.output.waitFor((message) => message.id === 1);
      await exerciseInstalledMutationLock(
        rolledBackCodex,
        repositoryRoot,
        "agent:codex-alpha",
        "rolled-back-codex",
      );
      await stopInstalledHost(
        rolledBackCodex.child,
        rolledBackCodex.output.stderr,
      );
      await expectLegacyStoreAbsent(repositoryRoot);

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
