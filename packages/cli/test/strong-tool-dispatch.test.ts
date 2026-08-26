import {
  StrongRepoPulseV1Schema,
  StrongRepositorySnapshotV1Schema,
} from "@understand-code/contracts";
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
      readArtifact: vi.fn(async (artifactType: string) => ({
        artifact: {
          artifactType,
          payload: {},
        },
      })),
    },
    taskEngine: {
      buildTaskBrief: vi.fn(async () => { throw buildError; }),
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
  };
});

vi.mock("../src/runtime/context.js", () => ({
  openProductionRuntime: fakes.openProductionRuntime,
  openRuntime: vi.fn(),
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
    vi.spyOn(StrongRepositorySnapshotV1Schema, "parse").mockReturnValue({} as never);
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
});
