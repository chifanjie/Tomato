import { PassThrough } from "node:stream";
import { readFile, stat, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  BuildTaskBriefOutputV1Schema,
  CheckChangeOutputV1Schema,
  GetRepoPulseOutputV1Schema,
  GetTaskBriefOutputV1Schema,
  McpToolErrorResultV1Schema,
  RecordVerificationOutputV1Schema,
  RefreshIndexOutputV1Schema,
  UpdateTaskOutputV1Schema,
} from "@understand-code/contracts/mcp";
import { afterEach, describe, expect, it } from "vitest";

import { resolveInitialBinding } from "../src/binding/root-binding.js";
import { McpStdioServer } from "../src/mcp/server.js";
import { openRuntime } from "../src/runtime/context.js";
import {
  cleanupTemporaryDirectories,
  createGitRepository,
  git,
  readSourceFixture,
  snapshotRepositoryFiles,
} from "./helpers.js";

afterEach(cleanupTemporaryDirectories);

function testServer(initialBinding: Awaited<ReturnType<typeof resolveInitialBinding>>) {
  const output = new PassThrough();
  const chunks: string[] = [];
  output.setEncoding("utf8");
  output.on("data", (chunk: string) => chunks.push(chunk));
  const server = new McpStdioServer(initialBinding, output);
  return {
    server,
    messages(): any[] {
      return chunks
        .join("")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    },
    response(id: string | number): any {
      return this.messages().find((message) => message.id === id);
    },
  };
}

async function initialize(
  server: McpStdioServer,
  capabilities: Record<string, unknown> = {},
): Promise<void> {
  await server.handleValue({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities,
      clientInfo: { name: "cli-test", version: "1.0.0" },
    },
  });
  await server.handleValue({
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {},
  });
}

describe("MCP lifecycle and real handlers", () => {
  it("initializes, lists the implemented tools, and runs the Pulse/Brief vertical slice", async () => {
    const root = await createGitRepository();
    const sourceBefore = await readSourceFixture(root);
    const repositoryBefore = await snapshotRepositoryFiles(root);
    const harness = testServer(await resolveInitialBinding([root]));
    await initialize(harness.server);

    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });
    expect(harness.response(2).result.tools.map((tool: any) => tool.name)).toEqual([
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
    expect(
      harness.response(2).result.tools.every(
        (tool: any) => tool.inputSchema && tool.outputSchema,
      ),
    ).toBe(true);

    const sourcePath = path.join(root, "src/task.ts");
    const indexPath = path.join(root, ".git/index");
    const sourceMetadata = await stat(sourcePath);
    await utimes(
      sourcePath,
      sourceMetadata.atime,
      new Date(sourceMetadata.mtimeMs + 5_000),
    );
    const indexBeforeReadTool = await readFile(indexPath);
    const previousGitDirectory = process.env.GIT_DIR;
    const previousOptionalLocks = process.env.GIT_OPTIONAL_LOCKS;
    const ambientGitDirectory = `${root}/ambient-git-dir-must-not-be-authority`;
    process.env.GIT_DIR = ambientGitDirectory;
    process.env.GIT_OPTIONAL_LOCKS = "1";
    try {
      await harness.server.handleValue({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "get_repo_pulse", arguments: {} },
      });
      expect(process.env.GIT_DIR).toBe(ambientGitDirectory);
      expect(process.env.GIT_OPTIONAL_LOCKS).toBe("1");
    } finally {
      if (previousGitDirectory === undefined) delete process.env.GIT_DIR;
      else process.env.GIT_DIR = previousGitDirectory;
      if (previousOptionalLocks === undefined) {
        delete process.env.GIT_OPTIONAL_LOCKS;
      } else {
        process.env.GIT_OPTIONAL_LOCKS = previousOptionalLocks;
      }
    }
    expect(await readFile(indexPath)).toEqual(indexBeforeReadTool);
    const pulse = GetRepoPulseOutputV1Schema.parse(harness.response(3).result);
    expect(pulse.structuredContent.meta.sourceSnapshotId).toBe(
      pulse.structuredContent.result.pulse.evaluatedSnapshotId,
    );

    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "build_task_brief",
        arguments: {
          task: "Change the task result while preserving its public behavior.",
          expectedRevision: 0,
          idempotencyKey: "cli-integration-brief",
          actor: "agent:cli-test",
          scope: ["src/task.ts"],
        },
      },
    });
    const built = BuildTaskBriefOutputV1Schema.parse(harness.response(4).result);
    expect(built.structuredContent.result.task.status).toBe("context_ready");

    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "get_task_brief",
        arguments: {
          taskId: built.structuredContent.result.task.taskId,
          section: "summary",
          pageSize: 10,
        },
      },
    });
    const read = GetTaskBriefOutputV1Schema.parse(harness.response(5).result);
    expect(read.structuredContent.result.task.taskId).toBe(
      built.structuredContent.result.task.taskId,
    );
    expect(read.structuredContent.result.items).toHaveLength(1);
    expect(await readSourceFixture(root)).toBe(sourceBefore);
    expect(await snapshotRepositoryFiles(root)).toEqual(repositoryBefore);
    expect(await git(root, ["diff", "--", "src/task.ts"])).toBe("");

    // The MCP surface is intentionally read/record-only for this slice; use
    // the same bound Task Engine to advance the fixture into its check gate,
    // then exercise the real public check_change and record_verification
    // handlers through JSON-RPC.
    const runtime = await openRuntime(root);
    const taskId = built.structuredContent.result.task.taskId;
    const actor = "agent:cli-test";
    const taskAuth = {
      actor,
      repositoryId: runtime.store.repositoryId,
      worktreeId: runtime.store.worktreeId,
      capabilities: [
        "task:update",
        "task:confirm",
        "task:accept",
      ] as const,
    };
    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: {
        name: "update_task",
        arguments: {
          taskId,
          action: {
            type: "confirm_goal",
            claimId: built.structuredContent.result.brief.goalClaimId,
          },
          expectedRevision: built.structuredContent.result.task.revision,
          idempotencyKey: "cli-public-confirm-goal",
          actor,
        },
      },
    });
    const publicUpdate = UpdateTaskOutputV1Schema.parse(
      harness.response(10).result,
    );
    expect(publicUpdate.structuredContent.result.task.status).toBe(
      "context_ready",
    );
    expect(publicUpdate.structuredContent.result.mutation.idempotentReplay).toBe(
      false,
    );

    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: {
        name: "update_task",
        arguments: {
          taskId,
          action: { type: "transition_status", to: "planned" },
          expectedRevision:
            publicUpdate.structuredContent.result.mutation.revision,
          idempotencyKey: "cli-public-premature-planned",
          actor,
        },
      },
    });
    const publicGate = McpToolErrorResultV1Schema.parse(
      harness.response(11).result,
    );
    expect(publicGate.structuredContent.error).toMatchObject({
      code: "task_gate_unsatisfied",
      details: {
        taskId,
        targetStatus: "planned",
        failedGuards: expect.arrayContaining([
          expect.objectContaining({ code: "acceptance_not_confirmed" }),
          expect.objectContaining({ code: "plan_not_confirmed" }),
        ]),
      },
    });

    let taskRevision = publicUpdate.structuredContent.result.mutation.revision;
    const transitions = [
      {
        action: {
          type: "confirm_acceptance_criteria" as const,
          claimIds: built.structuredContent.result.brief.acceptanceClaimIds,
        },
        key: "cli-ci-confirm-acceptance",
      },
      {
        action: {
          type: "confirm_plan" as const,
          plannedChangeIds: built.structuredContent.result.brief.plannedChanges.map(
            (change) => change.id,
          ),
        },
        key: "cli-ci-confirm-plan",
      },
      {
        action: { type: "transition_status" as const, to: "planned" as const },
        key: "cli-ci-planned",
      },
      {
        action: {
          type: "transition_status" as const,
          to: "in_progress" as const,
        },
        key: "cli-ci-progress",
      },
      {
        action: {
          type: "transition_status" as const,
          to: "check_required" as const,
        },
        key: "cli-ci-check-required",
      },
    ];
    for (const transition of transitions) {
      const mutation = await runtime.taskEngine.updateTask(
        {
          taskId,
          action: transition.action,
          expectedRevision: taskRevision,
          idempotencyKey: transition.key,
          actor,
        },
        taskAuth,
      );
      taskRevision = mutation.task.revision;
    }
    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "check_change",
        arguments: {
          taskId,
          includeWorktree: true,
          expectedRevision: taskRevision,
          idempotencyKey: "cli-ci-check",
          actor,
        },
      },
    });
    const checked = CheckChangeOutputV1Schema.parse(harness.response(7).result);
    expect(checked.structuredContent.result.changeCheck.taskId).toBe(taskId);
    expect(checked.structuredContent.result.changeCheck.taskRevision).toBe(
      checked.structuredContent.result.mutation.revision,
    );
    taskRevision = checked.structuredContent.result.mutation.revision;
    for (const finding of checked.structuredContent.result.changeCheck.findings.filter(
      (candidate) => candidate.blocking,
    )) {
      const accepted = await runtime.taskEngine.updateTask(
        {
          taskId,
          action: {
            type: "accept_finding",
            findingId: finding.id,
            reason: "CLI Change Intelligence focused fixture.",
          },
          expectedRevision: taskRevision,
          idempotencyKey: `cli-ci-accept-${finding.id}`,
          actor,
        },
        taskAuth,
      );
      taskRevision = accepted.task.revision;
    }
    const verificationGate = await runtime.taskEngine.updateTask(
      {
        taskId,
        action: {
          type: "transition_status",
          to: "verification_required",
        },
        expectedRevision: taskRevision,
        idempotencyKey: "cli-ci-verification-required",
        actor,
      },
      taskAuth,
    );
    const planEntry = built.structuredContent.result.brief.verificationPlan[0]!;
    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: {
        name: "record_verification",
        arguments: {
          taskId,
          record: {
            verificationPlanEntryId: planEntry.id,
            kind: planEntry.method,
            status: "failed",
            command: "pnpm test",
            exitCode: 1,
            summary: "CLI focused verification failure.",
            claimIds: planEntry.acceptanceClaimIds,
            snapshotId: checked.structuredContent.meta.sourceSnapshotId,
          },
          expectedRevision: verificationGate.task.revision,
          idempotencyKey: "cli-ci-verification",
          actor,
        },
      },
    });
    const recorded = RecordVerificationOutputV1Schema.parse(
      harness.response(8).result,
    );
    expect(recorded.structuredContent.result.verification.status).toBe("failed");
    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: {
        name: "record_verification",
        arguments: {
          taskId,
          record: {
            verificationPlanEntryId: planEntry.id,
            kind: planEntry.method,
            status: "failed",
            command: "pnpm test",
            exitCode: 1,
            summary: "Duplicate verification should be gated.",
            claimIds: planEntry.acceptanceClaimIds,
            snapshotId: checked.structuredContent.meta.sourceSnapshotId,
          },
          expectedRevision: recorded.structuredContent.result.mutation.revision,
          idempotencyKey: "cli-ci-verification-duplicate",
          actor,
        },
      },
    });
    expect(
      McpToolErrorResultV1Schema.parse(harness.response(9).result).isError,
    ).toBe(true);

    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "refresh_index", arguments: {} },
    });
    const invalidRefresh = McpToolErrorResultV1Schema.parse(
      harness.response(6).result,
    );
    expect(invalidRefresh.structuredContent.error.code).toBe(
      "invalid_arguments",
    );
  });

  it("keeps initialize and tools/list available in permanent binding_error", async () => {
    const harness = testServer(await resolveInitialBinding([]));
    await initialize(harness.server);
    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });
    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "get_repo_pulse", arguments: {} },
    });

    expect(harness.response(2).result.tools).toHaveLength(11);
    const failure = McpToolErrorResultV1Schema.parse(harness.response(3).result);
    expect(failure.structuredContent.error).toEqual({
      schemaVersion: 1,
      code: "workspace_binding_required",
      details: { reason: "root_missing" },
    });
  });

  it("bootstraps a cold repository with a real Snapshot/Pulse refresh", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    const harness = testServer(await resolveInitialBinding([root]));
    await initialize(harness.server);

    const previousGitDirectory = process.env.GIT_DIR;
    process.env.GIT_DIR = path.join(root, "ambient-refresh-git-dir");
    try {
      await harness.server.handleValue({
        jsonrpc: "2.0",
        id: 20,
        method: "tools/call",
        params: {
          name: "refresh_index",
          arguments: {
            mode: "incremental",
            idempotencyKey: "cold-refresh-index",
            actor: "agent:cli-test",
          },
        },
      });
    } finally {
      if (previousGitDirectory === undefined) delete process.env.GIT_DIR;
      else process.env.GIT_DIR = previousGitDirectory;
    }
    const refreshed = RefreshIndexOutputV1Schema.parse(
      harness.response(20).result,
    );
    expect(refreshed.structuredContent.result.operation.status).toBe(
      "completed",
    );
    expect(
      refreshed.structuredContent.result.operation.finalSnapshotId,
    ).toBe(refreshed.structuredContent.meta.sourceSnapshotId);
    expect(refreshed.structuredContent.meta.freshness).toBe("not_ready");

    await writeFile(
      path.join(root, "src/task.ts"),
      "export function task(): boolean { return false; }\n",
      "utf8",
    );
    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 22,
      method: "tools/call",
      params: {
        name: "refresh_index",
        arguments: {
          mode: "incremental",
          expectedSourceSnapshotId: refreshed.structuredContent.meta.sourceSnapshotId,
          idempotencyKey: "cold-refresh-index-after-change",
          actor: "agent:cli-test",
        },
      },
    });
    const changed = RefreshIndexOutputV1Schema.parse(
      harness.response(22).result,
    );
    expect(
      changed.structuredContent.result.operation.finalSnapshotId,
    ).not.toBe(refreshed.structuredContent.meta.sourceSnapshotId);

    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 21,
      method: "tools/call",
      params: {
        name: "refresh_index",
        arguments: {
          mode: "incremental",
          expectedSourceSnapshotId: "snapshot:does-not-match",
          idempotencyKey: "cold-refresh-index-mismatch",
          actor: "agent:cli-test",
        },
      },
    });
    const mismatch = McpToolErrorResultV1Schema.parse(
      harness.response(21).result,
    );
    expect(mismatch.structuredContent.error.code).toBe(
      "artifact_unavailable",
    );
  });

  it("enforces the lifecycle and separates protocol errors from tool errors", async () => {
    const root = await createGitRepository();
    const harness = testServer(await resolveInitialBinding([root]));
    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    });
    await harness.server.processFrame("malformed");
    expect(harness.response(1).error.code).toBe(-32_002);
    expect(harness.messages()).toContainEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32_700, message: "Parse error" },
    });
  });
});

describe("MCP Roots membership timing", () => {
  it("fails closed while initial and refreshed membership are pending, then recovers", async () => {
    const root = await createGitRepository();
    const harness = testServer(await resolveInitialBinding([root]));
    await initialize(harness.server, { roots: { listChanged: true } });
    const firstRootsRequest = harness
      .messages()
      .find((message) => message.method === "roots/list");
    expect(firstRootsRequest).toBeDefined();

    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "get_repo_pulse", arguments: {} },
    });
    expect(
      McpToolErrorResultV1Schema.parse(harness.response(2).result).structuredContent
        .error,
    ).toMatchObject({
      code: "workspace_binding_required",
      details: { reason: "root_unavailable" },
    });

    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: firstRootsRequest.id,
      result: { roots: [{ uri: pathToFileURL(root).href }] },
    });
    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "get_repo_pulse", arguments: {} },
    });
    expect(GetRepoPulseOutputV1Schema.parse(harness.response(3).result).isError).toBe(
      false,
    );

    await harness.server.handleValue({
      jsonrpc: "2.0",
      method: "notifications/roots/list_changed",
      params: {},
    });
    const rootsRequests = harness
      .messages()
      .filter((message) => message.method === "roots/list");
    const refreshedRequest = rootsRequests.at(-1);
    expect(refreshedRequest.id).not.toBe(firstRootsRequest.id);
    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "get_repo_pulse", arguments: {} },
    });
    expect(
      McpToolErrorResultV1Schema.parse(harness.response(4).result).structuredContent
        .error,
    ).toMatchObject({ details: { reason: "root_unavailable" } });

    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: refreshedRequest.id,
      result: { roots: [{ uri: pathToFileURL(root).href }] },
    });
    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "get_repo_pulse", arguments: {} },
    });
    expect(GetRepoPulseOutputV1Schema.parse(harness.response(5).result).isError).toBe(
      false,
    );
  });
});
