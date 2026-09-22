import { describe, expect, it } from "vitest";
import {
  taskFirstEvidenceRoute,
  taskFirstLocationStateFromLocation,
  taskFirstLocationUrl,
  taskFirstRouteFromLocation,
} from "../route";

describe("taskFirstRouteFromLocation", () => {
  it("resolves task brief deep links without changing Wiki/Graph hash routing", () => {
    expect(taskFirstRouteFromLocation({
      pathname: "/tasks/task%3Ademo/brief",
      search: "?section=reading",
    })).toEqual({
      view: "tasks",
      taskId: "task:demo",
      section: "reading_path",
    });
    expect(taskFirstRouteFromLocation({
      pathname: "/workbench",
      search: "?view=tasks&taskId=task%3Ademo&section=verification",
    })).toEqual({
      view: "tasks",
      taskId: "task:demo",
      section: "verification_plan",
    });
    expect(taskFirstRouteFromLocation({ pathname: "/", search: "#graph" })).toBeNull();
  });

  it("opens an Impact deep link on the planned changes surface by default", () => {
    expect(taskFirstRouteFromLocation({
      pathname: "/workbench",
      search: "?view=tasks&taskId=task%3Ademo&impactPathId=impact%3Aone",
    })).toEqual({
      view: "tasks",
      taskId: "task:demo",
      section: "planned_changes",
      impactPathId: "impact:one",
    });
  });

  it("round-trips Task-local Graph and Wiki surfaces without changing the Task authority view", () => {
    const graph = taskFirstLocationStateFromLocation({
      pathname: "/workbench",
      search: "?view=tasks&taskId=task%3Ademo&section=planned_changes&findingId=finding%3Aone&evidenceId=evidence%3Aone&surface=graph&focus=function%3Asrc%2Fa.ts%3Arun",
    });
    expect(graph).toEqual({
      route: {
        view: "tasks",
        taskId: "task:demo",
        section: "planned_changes",
        findingId: "finding:one",
        evidenceId: "evidence:one",
        focus: "function:src/a.ts:run",
      },
      surface: "graph",
    });
    expect(taskFirstLocationUrl(graph!, { workbenchCookieMode: true })).toBe(
      "/workbench?view=tasks&taskId=task%3Ademo&section=planned_changes&findingId=finding%3Aone&evidenceId=evidence%3Aone&surface=graph&focus=function%3Asrc%2Fa.ts%3Arun",
    );

    expect(taskFirstLocationUrl({
      route: { ...graph!.route, focus: "page:run" },
      surface: "wiki",
    }, { workbenchCookieMode: true })).toContain("surface=wiki&focus=page%3Arun");
  });

  it("returns to the exact finding route without persisting local surface focus", () => {
    expect(taskFirstLocationUrl({
      route: {
        view: "tasks",
        taskId: "task:demo",
        section: "planned_changes",
        findingId: "finding:one",
        focus: "function:stale",
      },
      surface: "task",
    }, { workbenchCookieMode: true })).toBe(
      "/workbench?view=tasks&taskId=task%3Ademo&section=planned_changes&findingId=finding%3Aone",
    );
  });

  it("keeps the selected Impact Path when opening its evidence", () => {
    const route = taskFirstEvidenceRoute({
      view: "tasks",
      taskId: "task:demo",
      section: "planned_changes",
      impactPathId: "impact:one",
    }, "evidence:one");
    expect(route).toEqual({
      view: "tasks",
      taskId: "task:demo",
      section: "planned_changes",
      impactPathId: "impact:one",
      evidenceId: "evidence:one",
    });
    expect(taskFirstLocationUrl({ route, surface: "task" })).toBe(
      "/tasks/task%3Ademo?section=planned_changes&evidenceId=evidence%3Aone&impactPathId=impact%3Aone",
    );
  });

  it("round-trips an exact pending knowledge selection and fails closed for malformed selectors", () => {
    const generationId = `generation-${"c".repeat(64)}`;
    const state = taskFirstLocationStateFromLocation({
      pathname: "/workbench",
      search: `?view=tasks&taskId=task%3Ademo&section=planned_changes&surface=wiki&knowledgeVersion=pending&knowledgeGenerationId=${generationId}`,
    });
    expect(state?.route).toMatchObject({
      taskId: "task:demo",
      section: "planned_changes",
      knowledgeVersion: "pending",
      knowledgeGenerationId: generationId,
    });
    expect(taskFirstLocationUrl(state!, { workbenchCookieMode: true })).toContain(
      `knowledgeVersion=pending&knowledgeGenerationId=${generationId}`,
    );

    for (const search of [
      "?view=tasks&taskId=task%3Ademo&knowledgeVersion=published&knowledgeGenerationId=" + generationId,
      "?view=tasks&taskId=task%3Ademo&knowledgeVersion=pending&knowledgeGenerationId=bad",
      `?view=tasks&taskId=task%3Ademo&knowledgeVersion=pending&knowledgeGenerationId=${generationId}&knowledgeGenerationId=${generationId}`,
    ]) {
      expect(taskFirstLocationStateFromLocation({ pathname: "/workbench", search })?.route).not.toHaveProperty("knowledgeVersion");
    }
    expect(taskFirstLocationStateFromLocation({
      pathname: "/workbench",
      search: `?view=tasks&knowledgeVersion=pending&knowledgeGenerationId=${generationId}`,
    })?.route).not.toHaveProperty("knowledgeVersion");
  });
});

it("preserves exact Wiki sections only on the Wiki surface", () => {
  const route = { view: "tasks" as const, taskId: "task:demo", focus: "page:run", wikiAnchor: "校验与解析" };
  const url = new URL(taskFirstLocationUrl({ route, surface: "wiki" }, { workbenchCookieMode: true }), "http://localhost");
  expect(taskFirstLocationStateFromLocation(url)?.route).toMatchObject(route);
  expect(taskFirstLocationUrl({ route, surface: "graph" })).not.toContain("wikiAnchor");
  expect(taskFirstLocationUrl({ route, surface: "task" })).not.toContain("wikiAnchor");
});
