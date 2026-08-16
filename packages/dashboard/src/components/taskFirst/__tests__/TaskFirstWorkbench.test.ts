// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import TaskFirstWorkbench, {
  type TaskBriefPageResult,
  type TaskFirstRoute,
} from "../TaskFirstWorkbench";
import type { TaskManifestV1 } from "@understand-code/contracts";

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

afterEach(() => document.body.replaceChildren());

describe("TaskFirstWorkbench", () => {
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

    expect(html).toContain("Task / 任务");
    expect(html).toContain("Pulse / 仓库状态");
    for (const label of ["Summary", "Goals", "Reading", "Changes", "Verification", "Knowledge", "Graph"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("The source snapshot changed.");
    expect(html).toContain("Read-only");

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
    buttons.find((button) => button.textContent?.includes("Knowledge"))?.click();
    buttons.find((button) => button.textContent?.includes("Graph"))?.click();
    buttons.find((button) => button.textContent?.includes("Goals"))?.click();

    expect(onOpenKnowledge).toHaveBeenCalledWith({ ...route, view: "knowledge" });
    expect(onOpenGraph).toHaveBeenCalledWith({ ...route, view: "graph" });
    expect(onSelectSection).toHaveBeenCalledWith("goals");
    await act(async () => root.unmount());
  });
});
