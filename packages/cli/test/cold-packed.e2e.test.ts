import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import { lstat, readdir, readFile, realpath, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { connect, createServer, type Socket } from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  GetRepoPulseOutputV1Schema,
  McpToolErrorResultV1Schema,
} from "@understand-code/contracts/mcp";
import { afterEach, describe, expect, it } from "vitest";

import {
  cleanupTemporaryDirectories,
  collectJsonLines,
  createGitRepository,
  createTemporaryDirectory,
  readSourceFixture,
  seedLegacyTask,
  snapshotManagedStoreTree,
  snapshotRepositoryFiles,
  writeMessage,
} from "./helpers.js";

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const requireV1 = createRequire(import.meta.url);

async function assertInstalledNativeKernelPeerV1(
  packageDirectory: string,
  repositoryRoot: string,
): Promise<void> {
  const tuple = `${process.platform}-${process.arch}`;
  const nativeRoot = path.join(packageDirectory, "dist/native");
  const nativeTupleRoot = path.join(nativeRoot, tuple);
  const nativePath = path.join(nativeTupleRoot, "provider_kernel_peer.node");
  expect(await readdir(nativeRoot)).toEqual([tuple]);
  expect(await readdir(nativeTupleRoot)).toEqual(["provider_kernel_peer.node"]);
  const metadata = await lstat(nativePath);
  expect(metadata.isFile()).toBe(true);
  expect(metadata.isSymbolicLink()).toBe(false);
  expect(metadata.mode & 0o777).toBe(0o644);

  const addon = requireV1(nativePath) as {
    readonly bindSafeGitRepositoryControl?: (binding: object) => unknown;
    readonly closeSafeGitDescriptorBootstrap?: (binding: object) => unknown;
    readonly getKernelBridgeProfile?: () => unknown;
    readonly openSafeGitDescriptorBootstrap?: (root: string) => unknown;
    readonly readPeerCredentials?: (fileDescriptor: number) => unknown;
    readonly revalidateSafeGitDescriptorBootstrap?: (binding: object) => unknown;
  };
  expect(addon.getKernelBridgeProfile?.()).toBe("native_kernel_bridge_v1");
  expect(addon.readPeerCredentials).toBeTypeOf("function");
  expect(addon.openSafeGitDescriptorBootstrap).toBeTypeOf("function");
  expect(addon.bindSafeGitRepositoryControl).toBeTypeOf("function");
  expect(addon.revalidateSafeGitDescriptorBootstrap).toBeTypeOf("function");
  expect(addon.closeSafeGitDescriptorBootstrap).toBeTypeOf("function");
  const opened = addon.openSafeGitDescriptorBootstrap!(
    await realpath(repositoryRoot),
  ) as { readonly binding?: unknown; readonly layout?: unknown };
  expect(opened.layout).toBe("ordinary");
  expect(opened.binding).toBeTypeOf("object");
  expect(addon.bindSafeGitRepositoryControl!(opened.binding as object)).toEqual({
    profile: "native_safe_git_repository_control_v1",
    objectFormat: expect.stringMatching(/^(?:sha1|sha256)$/u),
    objectDatabase: "local_only_verified",
    refBackend: "files_verified",
    repositoryConfig: "verified",
    worktreeConfig: "absent",
  });
  expect(addon.revalidateSafeGitDescriptorBootstrap!(opened.binding as object)).toEqual({
    layout: "ordinary",
  });
  expect(addon.closeSafeGitDescriptorBootstrap!(opened.binding as object)).toBe(true);
  const socketRoot = await createTemporaryDirectory("understand-code-native-");
  const socketPath = path.join(socketRoot, "peer.sock");
  const server = createServer();
  let client: Socket | undefined;
  let accepted: Socket | undefined;
  try {
    const acceptedPromise = once(server, "connection").then(
      ([socket]) => socket as Socket,
    );
    server.listen(socketPath);
    await once(server, "listening");
    client = connect(socketPath);
    await once(client, "connect");
    accepted = await acceptedPromise;
    const handle = Reflect.get(accepted, "_handle") as { readonly fd?: unknown };
    expect(handle?.fd).toBeTypeOf("number");
    expect(addon.readPeerCredentials!(handle.fd as number)).toEqual({
      uid: process.getuid?.(),
      gid: process.getgid?.(),
      pid: process.pid,
    });
  } finally {
    client?.destroy();
    accepted?.destroy();
    if (server.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }
}

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
    "installs outside the monorepo and runs the strict Pulse/locked refresh/Task slice",
    async () => {
      const root = await createGitRepository();
      const built = await seedLegacyTask(root, {
        task: "Prepare a safe change to the task function.",
        expectedRevision: 0,
        idempotencyKey: "cold-packed-owner-brief",
        actor: "agent:cold-e2e-owner",
        scope: ["src/task.ts"],
      });
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
      await assertInstalledNativeKernelPeerV1(installed.packageDirectory, root);

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
      const listResponse = await collected.waitFor((message) => message.id === 2);
      expect(listResponse.result.tools.map((tool: any) => tool.name)).toEqual([
        "get_repo_pulse",
        "build_task_brief",
        "get_task_brief",
        "update_task",
        "check_change",
        "record_verification",
        "open_workbench",
        "get_evidence",
        "search_context",
        "trace_impact",
        "refresh_index",
      ]);
      const pulseResponse = await collected.waitFor((message) => message.id === 3);
      const pulse = GetRepoPulseOutputV1Schema.parse(pulseResponse.result);
      expect(pulse.structuredContent.meta).toEqual({
        durationMs: expect.any(Number),
        cacheHit: true,
      });
      expect(pulse.structuredContent.result.pulse).toEqual({
        viewVersion: 1,
        viewKind: "legacy_repo_pulse_redacted",
        status: "fresh",
        aggregateChangeCount: 0,
        evaluatedAt: "2026-08-03T00:00:00.000Z",
        strongOperationSupported: false,
      });
      const publicPulseJson = JSON.stringify(pulseResponse.result);
      expect(publicPulseJson).not.toMatch(
        /"[^"]*(?:repository|worktree|snapshot|root|branch|path|oid|digest|diagnostic)[^"]*"\s*:/iu,
      );
      expect(publicPulseJson).not.toContain(root);
      expect(publicPulseJson).not.toContain("src/task.ts");

      const managedStoreBeforeMutation = await snapshotManagedStoreTree(root);
      const taskId = built.task.taskId;
      const actor = "agent:cold-e2e";
      const mutationCalls = [
        ["build_task_brief", {
          task: "Capability lock fixture.",
          expectedRevision: 0,
          idempotencyKey: "cold-packed-locked-build",
          actor,
          scope: ["src/task.ts"],
        }],
        ["update_task", {
          taskId,
          action: { type: "transition_status", to: "planned" },
          expectedRevision: built.task.revision,
          idempotencyKey: "cold-packed-locked-update",
          actor,
        }],
        ["update_task", {
          taskId,
          action: {
            type: "refresh_task_context",
            targetSnapshotId: built.task.latestSnapshotId,
          },
          expectedRevision: built.task.revision,
          idempotencyKey: "cold-packed-locked-context-refresh",
          actor,
        }],
        ["update_task", {
          taskId,
          action: {
            type: "rebase_task",
            targetSnapshotId: built.task.latestSnapshotId,
            newBaselineSnapshotId: built.task.latestSnapshotId,
            reason: "Strong Store authority is unavailable.",
          },
          expectedRevision: built.task.revision,
          idempotencyKey: "cold-packed-locked-context-rebase",
          actor,
        }],
        ["check_change", {
          taskId,
          actualSnapshotId: built.task.latestSnapshotId,
          includeWorktree: true,
          expectedRevision: built.task.revision,
          idempotencyKey: "cold-packed-locked-check",
          actor,
        }],
        ["record_verification", {
          taskId,
          record: {
            verificationPlanEntryId: built.brief.verificationPlan[0]!.id,
            kind: "test",
            status: "passed",
            command: "pnpm test",
            exitCode: 0,
            summary: "Capability lock fixture.",
            claimIds: [],
            snapshotId: built.task.latestSnapshotId,
          },
          expectedRevision: built.task.revision,
          idempotencyKey: "cold-packed-locked-verification",
          actor,
        }],
        ["refresh_index", {
          mode: "full",
          idempotencyKey: "cold-packed-locked-refresh",
          actor,
        }],
      ] as const;
      const expectedMutationFailure = {
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
      };
      for (const [index, [name, argumentsValue]] of mutationCalls.entries()) {
        const id = 6 + index;
        writeMessage(child, {
          jsonrpc: "2.0",
          id,
          method: "tools/call",
          params: { name, arguments: argumentsValue },
        });
        const response = await collected.waitFor((message) => message.id === id);
        expect(McpToolErrorResultV1Schema.parse(response.result)).toEqual(
          expectedMutationFailure,
        );
        expect(await snapshotManagedStoreTree(root)).toEqual(
          managedStoreBeforeMutation,
        );
      }

      writeMessage(child, {
        jsonrpc: "2.0",
        id: 14,
        method: "tools/call",
        params: {
          name: "get_task_brief",
          arguments: {
            taskId,
            section: "summary",
          },
        },
      });
      const getResponse = await collected.waitFor((message) => message.id === 14);
      expect(McpToolErrorResultV1Schema.parse(getResponse.result)).toEqual(
        expectedMutationFailure,
      );
      expect(await snapshotManagedStoreTree(root)).toEqual(
        managedStoreBeforeMutation,
      );
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
