import { PassThrough } from "node:stream";
import { readFile, stat, utimes } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  GetRepoPulseOutputV1Schema,
  McpToolErrorResultV1Schema,
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
  snapshotManagedStoreTree,
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
  for (const client of ["codex", "claude-code"]) {
    it(`gives ${client} the gated Task knowledge workflow without reading repository state`, async () => {
      const root = await createGitRepository({ seedArtifacts: false });
      const before = await snapshotRepositoryFiles(root);
      const harness = testServer(await resolveInitialBinding([root]));
      await harness.server.handleValue({
        jsonrpc: "2.0", id: 1, method: "initialize",
        params: {
          protocolVersion: "2025-11-25", capabilities: {},
          clientInfo: { name: client, version: "1.0.0" },
        },
      });
      const result = harness.response(1).result;
      expect(result.capabilities).toEqual({ tools: { listChanged: false } });
      expect(result.instructions).toEqual(expect.any(String));
      const instructions: string = result.instructions;
      for (const phrase of ["provider_unavailable", "get_repo_pulse", "build_task_brief",
        "check_change", "knowledge.action=stage", "candidateGenerationId",
        "read-only", "not current Task evidence", "record_verification",
        "update_task", "verified", "knowledge.action=publish", "expectedTaskRevision",
        "expectedSourceSnapshotId", "open_workbench", "KnowledgeCandidateReview",
        "planned-changes", "pending Graph/Wiki", "stale"]) {
        expect(instructions).toContain(phrase);
      }
      expect(instructions).not.toContain("not yet available");
      expect(instructions.indexOf("knowledge.action=stage")).toBeLessThan(instructions.indexOf("knowledge.action=publish"));
      expect(instructions).not.toContain(root);
      expect(await snapshotRepositoryFiles(root)).toEqual(before);
      await expect(stat(path.join(root, ".understand-code"))).rejects.toMatchObject({ code: "ENOENT" });
    });
  }

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
      "index_job",
    ]);
    expect(
      harness.response(2).result.tools.every(
        (tool: any) => tool.inputSchema && tool.outputSchema,
      ),
    ).toBe(true);

    const runtime = await openRuntime(root);
    const persistedPulse = await runtime.store.readArtifact("repo_pulse");
    if (persistedPulse.artifact.artifactType !== "repo_pulse") {
      throw new TypeError("The Pulse fixture resolved another Artifact type.");
    }
    const persistedPulsePayload = persistedPulse.artifact.payload;
    if ("profile" in persistedPulsePayload) {
      throw new TypeError("The Pulse canary requires a legacy fixture.");
    }

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

    const publicPulseJson = JSON.stringify(harness.response(3).result);
    expect(publicPulseJson).not.toMatch(
      /"[^"]*(?:repository|worktree|snapshot|root|branch|path|oid|digest|diagnostic)[^"]*"\s*:/iu,
    );
    const legacyState = persistedPulsePayload.repositoryState;
    const legacyDiagnostics = [
      ...(persistedPulsePayload.errors ?? []),
      ...(persistedPulsePayload.unknowns ?? []),
    ].flatMap((diagnostic) => [
      diagnostic.code,
      diagnostic.scope,
      diagnostic.message,
    ]);
    const forbiddenLegacyValues = [
      root,
      "src/task.ts",
      runtime.store.repositoryId,
      runtime.store.worktreeId,
      persistedPulse.artifact.sourceSnapshotId,
      persistedPulse.artifact.contentDigest,
      persistedPulsePayload.evaluatedSnapshotId,
      persistedPulsePayload.baselineSnapshotId,
      legacyState?.rootIdentity,
      legacyState?.branch,
      legacyState?.baselineCommit,
      legacyState?.headCommit,
      legacyState?.mergeBase,
      ...legacyDiagnostics,
    ].filter(
      (value): value is string =>
        typeof value === "string" && value.length > 0,
    );
    for (const forbiddenValue of forbiddenLegacyValues) {
      expect(publicPulseJson).not.toContain(forbiddenValue);
    }

    const built = {
      structuredContent: {
        result: await runtime.taskEngine.buildTaskBrief(
          {
            task: "Change the task result while preserving its public behavior.",
            expectedRevision: 0,
            idempotencyKey: "cli-integration-brief",
            actor: "agent:cli-test",
            scope: ["src/task.ts"],
          },
          {
            actor: "agent:cli-test",
            repositoryId: runtime.store.repositoryId,
            worktreeId: runtime.store.worktreeId,
            capabilities: ["task:create"],
          },
        ),
      },
    };
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
    const lockedRead = McpToolErrorResultV1Schema.parse(
      harness.response(5).result,
    );
    expect(lockedRead).toEqual({
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
    expect(await readSourceFixture(root)).toBe(sourceBefore);
    expect(await snapshotRepositoryFiles(root)).toEqual(repositoryBefore);
    expect(await git(root, ["diff", "--", "src/task.ts"])).toBe("");

    // Public Task reads and mutations are capability-locked. The owner fixture
    // uses the production TaskEngine directly to retain legacy lifecycle
    // integrity coverage without a shipped public bypass.
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
    const publicUpdate = {
      structuredContent: {
        result: await runtime.taskEngine.updateTask(
          {
          taskId,
          action: {
            type: "confirm_goal",
            claimId: built.structuredContent.result.brief.goalClaimId,
          },
          expectedRevision: built.structuredContent.result.task.revision,
          idempotencyKey: "cli-public-confirm-goal",
          actor,
          },
          taskAuth,
        ),
      },
    };
    expect(publicUpdate.structuredContent.result.task.status).toBe(
      "context_ready",
    );
    expect(publicUpdate.structuredContent.result.mutation.idempotentReplay).toBe(
      false,
    );

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
    const actualSnapshotId = built.structuredContent.result.task.latestSnapshotId;
    const checked = {
      content: [{
        type: "text" as const,
        text: "Change Check recorded as a legacy summary; empty findings are not clean evidence.",
      }],
      structuredContent: {
        meta: { sourceSnapshotId: actualSnapshotId },
        result: await runtime.taskEngine.checkChange(
          {
          taskId,
          actualSnapshotId,
          includeWorktree: true,
          expectedRevision: taskRevision,
          idempotencyKey: "cli-ci-check",
          actor,
          },
          taskAuth,
        ),
      },
    };
    expect(checked.structuredContent.result.changeCheckClassification).toEqual({
      profile: "legacy_summary",
      emptyFindingsAreClean: false,
    });
    expect(checked.content).toEqual([{
      type: "text",
      text: "Change Check recorded as a legacy summary; empty findings are not clean evidence.",
    }]);
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
    const recorded = {
      structuredContent: {
        result: await runtime.taskEngine.recordVerification(
          {
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
          taskAuth,
        ),
      },
    };
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

    const retried = {
      structuredContent: {
        result: await runtime.taskEngine.recordVerification(
          {
          taskId,
          record: {
            verificationPlanEntryId: planEntry.id,
            supersedesVerificationRecordId:
              recorded.structuredContent.result.verification.id,
            kind: planEntry.method,
            status: "passed",
            command: "pnpm test",
            exitCode: 0,
            summary: "CLI focused verification retry passed.",
            claimIds: planEntry.acceptanceClaimIds,
            snapshotId: checked.structuredContent.meta.sourceSnapshotId,
          },
          expectedRevision: recorded.structuredContent.result.mutation.revision,
          idempotencyKey: "cli-ci-verification-retry",
          actor,
          },
          taskAuth,
        ),
      },
    };
    expect(retried.structuredContent.result.verification).toMatchObject({
      attempt: 2,
      supersedesVerificationRecordId:
        recorded.structuredContent.result.verification.id,
      status: "passed",
    });
    const verified = await runtime.taskEngine.updateTask(
      {
        taskId,
        action: { type: "transition_status", to: "verified" },
        expectedRevision: retried.structuredContent.result.mutation.revision,
        idempotencyKey: "cli-ci-verified",
        actor,
      },
      taskAuth,
    );
    expect(verified.task.status).toBe("verified");

    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 31,
      method: "tools/call",
      params: {
        name: "open_workbench",
        arguments: {
          route: { view: "tasks", taskId },
        },
      },
    });
    const workbenchResponse = harness.response(31).result;
    const workbenchFailure = McpToolErrorResultV1Schema.parse(
      workbenchResponse,
    );
    expect(workbenchFailure).toEqual({
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

    expect(harness.response(2).result.tools).toHaveLength(12);
    const failure = McpToolErrorResultV1Schema.parse(harness.response(3).result);
    expect(failure.structuredContent.error).toEqual({
      schemaVersion: 1,
      code: "workspace_binding_required",
      details: { reason: "root_missing" },
    });
    await harness.server.enqueueFrame(JSON.stringify({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "index_job", arguments: { action: "cancel" } } }));
    expect(McpToolErrorResultV1Schema.parse(harness.response(4).result).structuredContent.error).toEqual(failure.structuredContent.error);
  });

  it("fails cold Repository reads and refresh closed without bootstrapping a legacy Store", async () => {
    const root = await createGitRepository({ seedArtifacts: false });
    const harness = testServer(await resolveInitialBinding([root]));
    await initialize(harness.server);
    await expect(
      stat(path.join(root, ".understand-code")),
    ).rejects.toMatchObject({ code: "ENOENT" });

    await harness.server.handleValue({
      jsonrpc: "2.0",
      id: 19,
      method: "tools/call",
      params: { name: "get_repo_pulse", arguments: {} },
    });

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
    const failure = McpToolErrorResultV1Schema.parse(
      harness.response(20).result,
    );
    const expectedFailure = {
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
    };
    expect(
      McpToolErrorResultV1Schema.parse(harness.response(19).result),
    ).toEqual(expectedFailure);
    expect(failure).toEqual(expectedFailure);
    await expect(
      stat(path.join(root, ".understand-code")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("locks every public mutation before reading or changing a seeded legacy Store", async () => {
    const root = await createGitRepository();
    const harness = testServer(await resolveInitialBinding([root]));
    await initialize(harness.server);
    const sourcePath = path.join(root, "src/task.ts");
    const indexPath = path.join(root, ".git/index");
    const before = await Promise.all([
      readFile(sourcePath),
      readFile(indexPath),
      snapshotManagedStoreTree(root),
    ]);
    const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const actor = "agent:cli-test";
    const calls = [
      [
        "build_task_brief",
        {
          task: "Capability lock fixture.",
          expectedRevision: 0,
          idempotencyKey: "locked-build",
          actor,
          scope: ["src/task.ts"],
        },
      ],
      [
        "update_task",
        {
          taskId,
          action: { type: "transition_status", to: "planned" },
          expectedRevision: 0,
          idempotencyKey: "locked-update",
          actor,
        },
      ],
      [
        "update_task",
        {
          taskId,
          action: {
            type: "refresh_task_context",
            targetSnapshotId: "snapshot:locked",
          },
          expectedRevision: 0,
          idempotencyKey: "locked-context-refresh",
          actor,
        },
      ],
      [
        "update_task",
        {
          taskId,
          action: {
            type: "rebase_task",
            targetSnapshotId: "snapshot:locked",
            newBaselineSnapshotId: "snapshot:locked",
            reason: "Capability lock fixture.",
          },
          expectedRevision: 0,
          idempotencyKey: "locked-context-rebase",
          actor,
        },
      ],
      [
        "check_change",
        {
          taskId,
          actualSnapshotId: "snapshot:locked",
          includeWorktree: true,
          expectedRevision: 0,
          idempotencyKey: "locked-check",
          actor,
        },
      ],
      [
        "record_verification",
        {
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
          idempotencyKey: "locked-verification",
          actor,
        },
      ],
      [
        "refresh_index",
        {
          mode: "full",
          idempotencyKey: "locked-refresh",
          actor,
        },
      ],
    ] as const;
    const expected = {
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
    for (const [index, [name, argumentsValue]] of calls.entries()) {
      const id = 25 + index;
      await harness.server.handleValue({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name, arguments: argumentsValue },
      });
      expect(McpToolErrorResultV1Schema.parse(harness.response(id).result)).toEqual(
        expected,
      );
      expect(await Promise.all([
        readFile(sourcePath),
        readFile(indexPath),
        snapshotManagedStoreTree(root),
      ])).toEqual(before);
    }
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
