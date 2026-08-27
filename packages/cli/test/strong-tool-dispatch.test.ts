import {
  StrongRepoPulseV1Schema,
  StrongRepositorySnapshotV1Schema,
} from "@understand-code/contracts";
import {
  ProviderProductionStrongObjectUnavailableErrorV1,
} from "@understand-code/durable-object-provider-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const snapshotId = `snapshot-${"a".repeat(64)}`;
const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const installationRoot = "/var/lib/understand-code/provider-authority";

const fakes = vi.hoisted(() => {
  const checkError = new Error("check-dispatch-sentinel");
  const verificationError = new Error("verification-dispatch-sentinel");
  const buildError = new Error("build-dispatch-sentinel");
  const runtime = {
    store: {
      repositoryId: "repo-1",
      worktreeId: "worktree-1",
      readManifest: vi.fn(),
      readArtifact: vi.fn(async (artifactType: string) => ({
        artifact: {
          artifactType,
          payload: {},
        },
      })),
    },
    taskEngine: {
      buildTaskBrief: vi.fn(async () => { throw buildError; }),
      getTaskBrief: vi.fn(),
      updateTask: vi.fn(),
      checkChanges: vi.fn(async () => { throw checkError; }),
      recordVerification: vi.fn(async () => { throw verificationError; }),
    },
    close: vi.fn(async () => undefined),
  };
  return {
    buildError,
    checkError,
    verificationError,
    runtime,
    openProductionRuntime: vi.fn(async () => runtime),
    openRuntime: vi.fn(),
  };
});

vi.mock("../src/runtime/context.js", () => ({
  openProductionRuntime: fakes.openProductionRuntime,
  openRuntime: fakes.openRuntime,
  readPublishedPulse: vi.fn(),
  readPublishedSnapshot: vi.fn(),
}));

import { callImplementedTool } from "../src/handlers/tools.js";

describe("strong MCP tool dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(StrongRepoPulseV1Schema, "parse").mockReturnValue({
      evaluatedSnapshotId: snapshotId,
    } as never);
    vi.spyOn(StrongRepositorySnapshotV1Schema, "parse").mockReturnValue({
      repositoryStateToken: "state-token",
    } as never);
  });

  it("opens the explicit production runtime before strong Task creation", async () => {
    await expect(callImplementedTool(
      "build_task_brief",
      {
        task: "Implement the requested change.",
        expectedRevision: 0,
        idempotencyKey: "strong-build-once",
        actor: "codex",
      },
      "/srv/repository",
      { canonicalInstallationRoot: installationRoot },
    )).rejects.toBe(fakes.buildError);
    expect(fakes.openProductionRuntime).toHaveBeenCalledWith(
      "/srv/repository",
      installationRoot,
    );
    expect(fakes.runtime.taskEngine.buildTaskBrief).toHaveBeenCalledOnce();
    expect(fakes.runtime.close).toHaveBeenCalledOnce();
  });

  it("maps Provider loss after runtime opening to the public locked Store failure", async () => {
    fakes.runtime.taskEngine.buildTaskBrief.mockRejectedValueOnce(
      new ProviderProductionStrongObjectUnavailableErrorV1(),
    );

    const result = await callImplementedTool(
      "build_task_brief",
      {
        task: "Implement the requested change.",
        expectedRevision: 0,
        idempotencyKey: "provider-loss-after-open",
        actor: "codex",
      },
      "/srv/repository",
      { canonicalInstallationRoot: installationRoot },
    );

    expect(result).toMatchObject({
      isError: true,
      structuredContent: {
        error: {
          code: "provider_unavailable",
          details: { reason: "unavailable" },
        },
      },
    });
    expect(fakes.runtime.close).toHaveBeenCalledOnce();
  });

  it("dispatches the strong Check profile only to TaskEngine.checkChanges", async () => {
    const input = {
      profile: "check_changes_strong_v1",
      taskId,
      actualSnapshotId: snapshotId,
      includeWorktree: true,
      expectedRevision: 5,
      idempotencyKey: "strong-check-once",
      actor: "codex",
    } as const;
    await expect(callImplementedTool(
      "check_change",
      input,
      "/srv/repository",
      { canonicalInstallationRoot: installationRoot },
    )).rejects.toBe(fakes.checkError);
    expect(fakes.runtime.taskEngine.checkChanges).toHaveBeenCalledWith(
      input,
      expect.objectContaining({ capabilities: ["task:update"] }),
    );
    expect(fakes.runtime.close).toHaveBeenCalledOnce();
  });

  it("dispatches the strong Verification profile without a legacy fallback", async () => {
    const input = {
      profile: "record_verification_strong_v1",
      taskId,
      snapshotId,
      verificationPlanEntryId: `verification-plan:${"b".repeat(22)}`,
      method: "test",
      status: "passed",
      claimIds: ["claim:acceptance"],
      command: {
        executable: "pnpm",
        arguments: ["test"],
        workingDirectory: "repository_root",
        environmentKeys: [],
      },
      exitCode: 0,
      expectedRevision: 6,
      idempotencyKey: "strong-verification-once",
      actor: "codex",
    } as const;
    await expect(callImplementedTool(
      "record_verification",
      input,
      "/srv/repository",
      { canonicalInstallationRoot: installationRoot },
    )).rejects.toBe(fakes.verificationError);
    expect(fakes.runtime.taskEngine.recordVerification).toHaveBeenCalledWith(
      input,
      expect.objectContaining({ capabilities: ["task:update"] }),
    );
    expect(fakes.runtime.close).toHaveBeenCalledOnce();
  });

  it("routes every remaining selected Tool through one closed production runtime", async () => {
    const routes = [
      {
        toolName: "get_repo_pulse" as const,
        argumentsValue: {},
        reject: (error: Error) =>
          fakes.runtime.store.readArtifact.mockRejectedValueOnce(error),
      },
      {
        toolName: "get_task_brief" as const,
        argumentsValue: { taskId, section: "summary" },
        reject: (error: Error) =>
          fakes.runtime.store.readManifest.mockRejectedValueOnce(error),
      },
      {
        toolName: "update_task" as const,
        argumentsValue: {
          taskId,
          action: { type: "transition_status", to: "planned" },
          expectedRevision: 0,
          idempotencyKey: "strong-update-route",
          actor: "codex",
        },
        reject: (error: Error) =>
          fakes.runtime.taskEngine.updateTask.mockRejectedValueOnce(error),
      },
      {
        toolName: "search_context" as const,
        argumentsValue: { taskId, query: "task" },
        reject: (error: Error) =>
          fakes.runtime.store.readManifest.mockRejectedValueOnce(error),
      },
      {
        toolName: "get_evidence" as const,
        argumentsValue: { taskId, evidenceIds: ["evidence:any"] },
        reject: (error: Error) =>
          fakes.runtime.store.readManifest.mockRejectedValueOnce(error),
      },
      {
        toolName: "trace_impact" as const,
        argumentsValue: {
          taskId,
          sourceNodeIds: ["function:task"],
          direction: "downstream",
        },
        reject: (error: Error) =>
          fakes.runtime.store.readManifest.mockRejectedValueOnce(error),
      },
      {
        toolName: "open_workbench" as const,
        argumentsValue: {
          route: { view: "tasks", taskId, section: "summary" },
        },
        reject: (error: Error) =>
          fakes.runtime.store.readManifest.mockRejectedValueOnce(error),
      },
    ];

    for (const route of routes) {
      vi.clearAllMocks();
      const routeError = new Error(`${route.toolName}-route-sentinel`);
      route.reject(routeError);

      await expect(callImplementedTool(
        route.toolName,
        route.argumentsValue,
        "/srv/repository",
        { canonicalInstallationRoot: installationRoot },
      )).rejects.toBe(routeError);
      expect(fakes.openProductionRuntime).toHaveBeenCalledExactlyOnceWith(
        "/srv/repository",
        installationRoot,
      );
      expect(fakes.openRuntime).not.toHaveBeenCalled();
      expect(fakes.runtime.close).toHaveBeenCalledOnce();
    }
  });

  it("passes selected refresh_index to its dedicated Provider composition", async () => {
    const result = await callImplementedTool(
      "refresh_index",
      {
        mode: "full",
        idempotencyKey: "locked-refresh-route",
        actor: "codex",
      },
      "/srv/repository",
      { canonicalInstallationRoot: installationRoot },
    );

    expect(result).toMatchObject({
      isError: true,
      structuredContent: {
        error: { code: "provider_unavailable" },
      },
    });
    // refresh_index owns a cold-bootstrap composition because the generic
    // runtime requires an already-published manifest. It must not use either
    // generic runtime while its selected Provider admission fails closed.
    expect(fakes.openProductionRuntime).not.toHaveBeenCalled();
    expect(fakes.openRuntime).not.toHaveBeenCalled();
  });
});
