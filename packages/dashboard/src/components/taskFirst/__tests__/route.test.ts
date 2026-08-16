import { describe, expect, it } from "vitest";
import { taskFirstRouteFromLocation } from "../route";

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
});
