import type { WorkbenchRouteV1 } from "@understand-code/contracts";

export type TaskFirstLocation = Pick<Location, "pathname" | "search">;

export type TaskLocalSurface = "task" | "graph" | "wiki";

export interface TaskFirstLocationState {
  readonly route: WorkbenchRouteV1;
  readonly surface: TaskLocalSurface;
}

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
  return taskFirstLocationStateFromLocation(location)?.route ?? null;
}

export function taskFirstLocationStateFromLocation(
  location: TaskFirstLocation,
): TaskFirstLocationState | null {
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
  const surfaceValue = query.get("surface");
  const surface: TaskLocalSurface = surfaceValue === "graph" || surfaceValue === "wiki"
    ? surfaceValue
    : "task";
  return { route, surface };
}

export function taskFirstSectionPath(section: string): string {
  return TASK_SECTION_ALIASES[section] ?? section;
}

export function taskFirstLocationUrl(
  state: TaskFirstLocationState,
  options: { readonly workbenchCookieMode?: boolean } = {},
): string {
  const { route, surface } = state;
  const params = new URLSearchParams();
  if (options.workbenchCookieMode) {
    params.set("view", "tasks");
    if (route.taskId) params.set("taskId", route.taskId);
  }
  if (route.section) params.set("section", taskFirstSectionPath(route.section));
  if (route.findingId) params.set("findingId", route.findingId);
  if (route.evidenceId) params.set("evidenceId", route.evidenceId);
  if (route.impactPathId) params.set("impactPathId", route.impactPathId);
  if (surface !== "task") params.set("surface", surface);
  if (surface !== "task" && route.focus) params.set("focus", route.focus);
  const search = params.toString();
  const pathname = options.workbenchCookieMode
    ? "/workbench"
    : route.taskId
      ? `/tasks/${encodeURIComponent(route.taskId)}`
      : "/tasks";
  return `${pathname}${search ? `?${search}` : ""}`;
}
