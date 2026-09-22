import type { WorkbenchRouteV1 } from "@understand-code/contracts";

export type TaskFirstLocation = Pick<Location, "pathname" | "search">;

const KNOWLEDGE_GENERATION_ID = /^generation-[0-9a-f]{64}$/u;

/** Frontend-only selection for inspecting a Task's read-only candidate. */
export interface TaskKnowledgeSelection {
  readonly wikiAnchor?: string;
  readonly knowledgeVersion?: "pending";
  readonly knowledgeGenerationId?: string;
}

export type TaskFirstRoute = WorkbenchRouteV1 & TaskKnowledgeSelection;

export type TaskLocalSurface = "task" | "graph" | "wiki";

export interface TaskFirstLocationState {
  readonly route: TaskFirstRoute;
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
): TaskFirstRoute | null {
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
    pathMode === "check" ? "verification_plan"
      : query.get("impactPathId") !== null ? "planned_changes" : "summary"
  );
  const section = TASK_SECTION_ALIASES[rawSection] ?? rawSection;
  const route: TaskFirstRoute = {
    view: "tasks",
    ...(taskId === undefined ? {} : { taskId }),
    ...(section.length > 0 ? { section } : {}),
  };

  for (const key of ["findingId", "evidenceId", "impactPathId", "focus"] as const) {
    const value = decodeSegment(query.get(key));
    if (value !== undefined) {
      (route as unknown as Record<string, string>)[key] = value;
    }
  }
  // Candidate selection is intentionally an all-or-nothing pair.  Malformed,
  // duplicated, or future selector values are ignored rather than allowing a
  // route to claim knowledge that the Task did not authorize.
  if (
    taskId !== undefined
    && route.view === "tasks"
    && query.getAll("knowledgeVersion").length === 1
    && query.getAll("knowledgeGenerationId").length === 1
    && query.get("knowledgeVersion") === "pending"
    && KNOWLEDGE_GENERATION_ID.test(query.get("knowledgeGenerationId") ?? "")
  ) {
    (route as unknown as Record<string, string>)["knowledgeVersion"] = "pending";
    (route as unknown as Record<string, string>)["knowledgeGenerationId"] = query.get("knowledgeGenerationId") ?? "";
  }
  const surfaceValue = query.get("surface");
  const surface: TaskLocalSurface = surfaceValue === "graph" || surfaceValue === "wiki"
    ? surfaceValue
    : "task";
  const wikiAnchor = decodeSegment(query.get("wikiAnchor"));
  if (surface === "wiki" && route.focus && wikiAnchor) {
    (route as { wikiAnchor?: string }).wikiAnchor = wikiAnchor;
  }
  return { route, surface };
}

export function taskFirstSectionPath(section: string): string {
  return TASK_SECTION_ALIASES[section] ?? section;
}

/** Build a Task route for evidence opened from an Impact Path step. */
export function taskFirstEvidenceRoute(
  route: TaskFirstRoute,
  evidenceId: string,
  findingId?: string,
): TaskFirstRoute {
  return {
    view: "tasks",
    taskId: route.taskId,
    section: "planned_changes",
    ...(findingId === undefined ? {} : { findingId }),
    ...(route.impactPathId === undefined ? {} : { impactPathId: route.impactPathId }),
    evidenceId,
  };
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
  if (surface === "wiki" && route.focus && route.wikiAnchor) params.set("wikiAnchor", route.wikiAnchor);
  if (route.view === "tasks"
    && route.taskId
    && route.knowledgeVersion === "pending"
    && route.knowledgeGenerationId
    && KNOWLEDGE_GENERATION_ID.test(route.knowledgeGenerationId)) {
    params.set("knowledgeVersion", "pending");
    params.set("knowledgeGenerationId", route.knowledgeGenerationId);
  }
  const search = params.toString();
  const pathname = options.workbenchCookieMode
    ? "/workbench"
    : route.taskId
      ? `/tasks/${encodeURIComponent(route.taskId)}`
      : "/tasks";
  return `${pathname}${search ? `?${search}` : ""}`;
}
