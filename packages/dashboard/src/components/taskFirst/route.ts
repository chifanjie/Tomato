import type { WorkbenchRouteV1 } from "@understand-code/contracts";

export type TaskFirstLocation = Pick<Location, "pathname" | "search">;

const TASK_SECTION_ALIASES: Readonly<Record<string, string>> = {
  summary: "summary",
  goals: "goals",
  reading: "reading_path",
  reading_path: "reading_path",
  changes: "planned_changes",
  planned_changes: "planned_changes",
  verification: "verification_plan",
  verification_plan: "verification_plan",
};

function decodeSegment(value: string | null): string | undefined {
  if (value === null || value.length === 0) return undefined;
  try {
    const decoded = decodeURIComponent(value);
    return decoded.length > 0 && !decoded.includes("\0") ? decoded : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve the stable Task-first URL shapes used by the local Workbench:
 * `/tasks/:taskId/...` and `/workbench?view=tasks&taskId=...`.
 *
 * This helper is deliberately side-effect free so the existing Wiki/Graph
 * router can continue to own hash navigation while the Task surface observes
 * browser history independently.
 */
export function taskFirstRouteFromLocation(
  location: TaskFirstLocation,
): WorkbenchRouteV1 | null {
  const query = new URLSearchParams(location.search);
  const pathMatch = /^\/(?:workbench\/)?tasks(?:\/([^/]+)(?:\/(brief|check|evidence)(?:\/[^/]+)?)?)?\/?$/u.exec(location.pathname);
  const isWorkbenchQuery = location.pathname === "/workbench" && query.get("view") === "tasks";
  if (!pathMatch && !isWorkbenchQuery) return null;

  const taskId = decodeSegment(pathMatch?.[1] ?? query.get("taskId"));
  const pathMode = pathMatch?.[2];
  const rawSection = query.get("section") ?? (
    pathMode === "check" ? "verification_plan" : "summary"
  );
  const section = TASK_SECTION_ALIASES[rawSection] ?? rawSection;
  const route: WorkbenchRouteV1 = {
    view: "tasks",
    ...(taskId === undefined ? {} : { taskId }),
    ...(section.length > 0 ? { section } : {}),
  };

  for (const key of ["findingId", "evidenceId", "impactPathId", "focus"] as const) {
    const value = decodeSegment(query.get(key));
    if (value !== undefined) {
      (route as Record<string, string>)[key] = value;
    }
  }
  return route;
}

export function taskFirstSectionPath(section: string): string {
  return TASK_SECTION_ALIASES[section] ?? section;
}
