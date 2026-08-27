// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import TaskFirstWorkbench, {
  type TaskBriefPageResult,
  type TaskFirstRoute,
} from "../TaskFirstWorkbench";
import {
  RepoPulseSurfaceResponseV1Schema,
  type RepoPulseSurfaceResponseV1,
  type TaskManifestV1,
} from "@understand-code/contracts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const task = {
  schemaVersion: 1,
  taskId: "task:demo",
  title: "Publish the Task Brief",
  originalIntent: "Show a read-only evidence path to the operator.",
  status: "in_progress",
  repositoryId: "repo:demo",
  worktreeId: "worktree:demo",
  baselineSnapshotId: "snapshot:base",
  latestSnapshotId: "snapshot:latest",
  createdAt: "2026-08-17T00:00:00.000Z",
  updatedAt: "2026-08-17T00:00:01.000Z",
  producerVersion: "0.1.0",
  revision: 1,
} as unknown as TaskManifestV1;

const route: TaskFirstRoute = { view: "tasks", taskId: task.taskId, section: "summary" };
const page: TaskBriefPageResult = {
  task,
  section: "summary",
  items: [{
    kind: "summary",
    originalIntent: task.originalIntent,
    goalClaimId: "claim:goal",
    acceptanceClaimCount: 1,
    plannedChangeCount: 1,
  }],
};

const LEGACY_SNAPSHOT_CANARY = "snapshot:legacy-private-canary";
const LEGACY_BRANCH_CANARY = "legacy/private-branch-canary";
const LEGACY_FREE_TEXT_CANARY = "legacy private diagnostic canary";
const PATH_SAFE_SNAPSHOT_ID = `snapshot-${"a".repeat(64)}`;

const legacyPulse = {
  viewVersion: 1,
  viewKind: "legacy_repo_pulse_redacted",
  status: "partial",
  aggregateChangeCount: 4,
  evaluatedAt: "2026-08-23T12:00:00Z",
  strongOperationSupported: false,
} satisfies RepoPulseSurfaceResponseV1;

const strongPulse = RepoPulseSurfaceResponseV1Schema.parse({
  viewVersion: 1,
  viewKind: "strong_repo_pulse",
  evaluatedSnapshotId: PATH_SAFE_SNAPSHOT_ID,
  status: "partial",
  branchState: {
    status: "safe",
    name: "feature/path-safe-surface",
  },
  safeChangeCount: 7,
  redactedChangeCount: 2,
  unknownStateCount: 3,
  redactionBoundaryCodes: ["secret_content"],
  uncertaintyCodes: ["unreadable"],
  evaluatedAt: "2026-08-23T12:01:00Z",
  strongOperationSupported: true,
});

afterEach(() => document.body.replaceChildren());

describe("TaskFirstWorkbench", () => {
  it("keeps ready, loading, empty, error, and stale states explicit and recoverable", async () => {
    const htmlFor = (props: Record<string, unknown>) => renderToStaticMarkup(
      createElement(TaskFirstWorkbench, { route, ...props }),
    );
    expect(htmlFor({ page })).toContain('data-state="ready"');
    expect(htmlFor({ loading: true })).toContain('data-state="loading"');
    expect(htmlFor({})).toContain('data-state="empty"');
    expect(htmlFor({ error: "temporary failure", onRetry: vi.fn() })).toContain('data-state="error"');
    expect(htmlFor({ page, stale: "snapshot changed", onRetry: vi.fn() })).toContain('data-state="stale"');

    const onRetry = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(createElement(TaskFirstWorkbench, {
      route,
      page,
      stale: "snapshot changed",
      onRetry,
    })));
    const retry = [...container.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "重新加载");
    await act(async () => retry?.click());
    expect(onRetry).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });

  it("renders the read-only Task/Pulse surface and sends typed deep-link callbacks", async () => {
    const onOpenKnowledge = vi.fn();
    const onOpenGraph = vi.fn();
    const onSelectSection = vi.fn();
    const html = renderToStaticMarkup(createElement(TaskFirstWorkbench, {
      route,
      page,
      pulseStatus: "fresh",
      stale: "The source snapshot changed.",
      onOpenKnowledge,
      onOpenGraph,
      onSelectSection,
    }));

    expect(html).toContain("任务");
    expect(html).toContain("仓库状态");
    for (const label of ["摘要", "目标", "阅读", "变更", "验证", "知识库", "关系图谱"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("The source snapshot changed.");
    expect(html).toContain("只读");

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(createElement(TaskFirstWorkbench, {
      route,
      page,
      pulseStatus: "fresh",
      onOpenKnowledge,
      onOpenGraph,
      onSelectSection,
    })));
    const buttons = [...container.querySelectorAll<HTMLButtonElement>("button")];
    await act(async () => {
      buttons.find((button) => button.textContent?.includes("知识库"))?.click();
      buttons.find((button) => button.textContent?.includes("关系图谱"))?.click();
      buttons.find((button) => button.textContent?.includes("目标"))?.click();
    });

    expect(onOpenKnowledge).toHaveBeenCalledWith(route);
    expect(onOpenGraph).toHaveBeenCalledWith(route);
    expect(onSelectSection).toHaveBeenCalledWith("goals");
    await act(async () => root.unmount());
  });

  it("loads a legacy redacted Pulse without rendering private legacy detail", () => {
    const pulseWithLegacyCanaries = Object.assign({}, legacyPulse, {
      evaluatedSnapshotId: LEGACY_SNAPSHOT_CANARY,
      repositoryState: {
        branch: LEGACY_BRANCH_CANARY,
      },
      reasons: [LEGACY_FREE_TEXT_CANARY],
    });

    const html = renderToStaticMarkup(createElement(TaskFirstWorkbench, {
      route,
      page,
      pulse: pulseWithLegacyCanaries,
    }));

    expect(html).toContain("旧版详情已隐藏");
    expect(html).not.toContain("<dt>Snapshot</dt>");
    expect(html).not.toContain("<dt>Branch</dt>");
    expect(html).not.toContain(LEGACY_SNAPSHOT_CANARY);
    expect(html).not.toContain(LEGACY_BRANCH_CANARY);
    expect(html).not.toContain(LEGACY_FREE_TEXT_CANARY);
  });

  it("renders a strong Pulse with its path-safe Snapshot and three counts", () => {
    const html = renderToStaticMarkup(createElement(TaskFirstWorkbench, {
      route,
      page,
      pulse: strongPulse,
    }));

    expect(html).toContain(PATH_SAFE_SNAPSHOT_ID);
    expect(html).toContain("feature/path-safe-surface");
    expect(html).toContain("7 项安全 · 2 项已隐藏 · 3 项未知");
    expect(html).not.toContain("旧版详情已隐藏");
  });

  it("renders persisted Change Check findings and Verification records", () => {
    const html = renderToStaticMarkup(createElement(TaskFirstWorkbench, {
      route: { ...route, section: "planned_changes" },
      page: { ...page, section: "planned_changes" },
      changeCheck: {
        id: "change-check:demo",
        taskId: task.taskId,
        taskRevision: 1,
        baselineSnapshotId: "snapshot:base",
        actualSnapshotId: "snapshot:latest",
        findings: [{
          id: "finding:demo",
          type: "planned_completed",
          severity: "info",
          blocking: false,
          summary: "The planned change is present.",
          claimIds: ["claim:goal"],
          plannedChangeIds: ["planned-change:demo"],
          actualChangeIds: ["change:demo"],
          evidenceIds: ["evidence:demo"],
          impactPathIds: ["impact:demo"],
        }],
        generatedAt: "2026-08-17T00:00:01.000Z",
        schemaVersion: 1,
      },
      changeCheckStatus: "ready",
      verificationRecords: [{
        id: "verification:demo",
        taskId: task.taskId,
        verificationPlanEntryId: "verification-plan:demo",
        attempt: 1,
        kind: "test",
        status: "passed",
        command: "pnpm test",
        exitCode: 0,
        summary: "The focused test passed.",
        claimIds: ["claim:goal"],
        snapshotId: "snapshot:latest",
        recordedAt: "2026-08-17T00:00:01.000Z",
        actor: "developer",
      }],
      verificationStatus: "ready",
    }));

    expect(html).toContain("The planned change is present.");
    expect(html).toContain('data-testid="task-change-check-classification"');
    expect(html).toContain('data-profile="legacy_summary"');
    expect(html).toContain('data-empty-findings-are-clean="false"');
    expect(html).toContain("没有发现项不等于已经获得变更完全安全的证据。");
    const verificationHtml = renderToStaticMarkup(createElement(TaskFirstWorkbench, {
      route: { ...route, section: "verification_plan" },
      page: { ...page, section: "verification_plan" },
      verificationRecords: [{
        id: "verification:demo",
        taskId: task.taskId,
        verificationPlanEntryId: "verification-plan:demo",
        attempt: 1,
        kind: "test",
        status: "passed",
        command: "pnpm test",
        exitCode: 0,
        summary: "The focused test passed.",
        claimIds: ["claim:goal"],
        snapshotId: "snapshot:latest",
        recordedAt: "2026-08-17T00:00:01.000Z",
        actor: "developer",
      }],
      verificationStatus: "ready",
    }));
    expect(verificationHtml).toContain("The focused test passed.");
  });

  it("shows explicit plan obligations while keeping legacy omissions visible", () => {
    const plannedHtml = renderToStaticMarkup(createElement(TaskFirstWorkbench, {
      route: { ...route, section: "planned_changes" },
      page: {
        ...page,
        section: "planned_changes",
        items: [
          {
            kind: "planned_change",
            change: {
              id: "planned-change:required",
              expectation: "required_change",
              candidateLevel: "likely_change",
              filePath: "src/required.ts",
              intent: "Implement the required behavior.",
              claimIds: ["claim:goal"],
              impactPathIds: [],
            },
          },
          {
            kind: "planned_change",
            change: {
              id: "planned-change:legacy",
              candidateLevel: "possible_change",
              filePath: "src/legacy.ts",
              intent: "Read a historical plan without inventing an obligation.",
              claimIds: ["claim:goal"],
              impactPathIds: [],
            },
          },
        ],
      },
    }));
    expect(plannedHtml).toContain("很可能需要变更 · 必须变更");
    expect(plannedHtml).toContain(
      "可能需要变更 · 预期未指定（旧版）",
    );

    const verificationHtml = renderToStaticMarkup(createElement(TaskFirstWorkbench, {
      route: { ...route, section: "verification_plan" },
      page: {
        ...page,
        section: "verification_plan",
        items: [
          {
            kind: "verification_plan",
            entry: {
              id: "verification-plan:explicit",
              acceptanceClaimIds: ["claim:goal"],
              method: "test",
              description: "Run the explicit verification.",
              required: false,
            },
          },
          {
            kind: "verification_plan",
            entry: {
              id: "verification-plan:legacy",
              acceptanceClaimIds: ["claim:goal"],
              method: "manual",
              description: "Read a historical verification entry.",
            },
          },
        ],
      },
    }));
    expect(verificationHtml).toContain("test · 可选");
    expect(verificationHtml).toContain(
      "manual · 要求未指定（旧版；按必需项门禁）",
    );
  });
});
