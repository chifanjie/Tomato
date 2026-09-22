// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import KnowledgeCandidateReview from "../KnowledgeCandidateReview";
import type { TaskFirstRoute } from "../route";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const taskId = "task:demo";
const currentGeneration = `generation-${"a".repeat(64)}`;
const staleGeneration = `generation-${"b".repeat(64)}`;
const route: TaskFirstRoute = { view: "tasks", taskId, section: "planned_changes" };

function result() {
  return {
    status: "ready" as const,
    value: {
      schemaVersion: 1 as const,
      taskId,
      currentTaskRevision: 4,
      currentSnapshotId: "snapshot:current",
      candidates: [
        {
          candidateGenerationId: currentGeneration,
          taskRevision: 4,
          sourceSnapshotId: "snapshot:current",
          sourceSnapshotMatchesCurrent: true,
        },
        {
          candidateGenerationId: staleGeneration,
          taskRevision: 3,
          sourceSnapshotId: "snapshot:old",
          sourceSnapshotMatchesCurrent: false,
        },
      ],
    },
  };
}

describe("KnowledgeCandidateReview", () => {
  it("renders read-only provenance and disables stale candidate navigation", () => {
    const html = renderToStaticMarkup(createElement(KnowledgeCandidateReview, {
      route,
      result: result(),
      onOpenKnowledge: vi.fn(),
      onOpenGraph: vi.fn(),
    }));
    expect(html).toContain("待审知识候选");
    expect(html).toContain("不能作为当前任务证据");
    expect(html).toContain(currentGeneration.slice(0, 18));
    expect(html).toContain('data-snapshot-current="false"');
    expect(html).toMatch(/disabled=""[^>]*data-testid="task-knowledge-candidate-open-wiki"/);
  });

  it("opens only the current candidate with a pending route selection", async () => {
    const onOpenKnowledge = vi.fn();
    const onOpenGraph = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(createElement(KnowledgeCandidateReview, {
      route,
      result: result(),
      onOpenKnowledge,
      onOpenGraph,
    })));
    const currentCard = container.querySelector<HTMLElement>(`[data-generation-id="${currentGeneration}"]`)!;
    await act(async () => currentCard.querySelector<HTMLButtonElement>("[data-testid=task-knowledge-candidate-open-wiki]")?.click());
    await act(async () => currentCard.querySelector<HTMLButtonElement>("[data-testid=task-knowledge-candidate-open-graph]")?.click());
    expect(onOpenKnowledge).toHaveBeenCalledWith(expect.objectContaining({
      view: "tasks", taskId, section: "planned_changes",
      knowledgeVersion: "pending", knowledgeGenerationId: currentGeneration,
    }));
    expect(onOpenGraph).toHaveBeenCalledWith(expect.objectContaining({
      knowledgeVersion: "pending", knowledgeGenerationId: currentGeneration,
    }));
    const staleCard = container.querySelector<HTMLElement>(`[data-generation-id="${staleGeneration}"]`)!;
    expect(staleCard.querySelector<HTMLButtonElement>("[data-testid=task-knowledge-candidate-open-wiki]")?.disabled).toBe(true);
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });
});

it("includes the exact candidate and task in the prepared host feedback", () => {
  const html = renderToStaticMarkup(createElement(KnowledgeCandidateReview, { route, result: result() }));
  expect(html).toContain(`taskId: ${taskId}`);
  expect(html).toContain(`generationId: ${currentGeneration}`);
  expect(html).toContain("sourceSnapshotId: snapshot:current");
  expect(html).toContain("未经我明确确认不要发布");
});
