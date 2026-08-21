import { describe, expect, it } from "vitest";
import {
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
});
