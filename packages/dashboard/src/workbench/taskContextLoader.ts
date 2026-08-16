import {
  RepoPulseV1Schema,
  TaskBriefPageItemV1Schema,
  TaskBriefSectionV1Schema,
  TaskBriefV1Schema,
  TaskManifestV1Schema,
  type RepoPulseV1,
  type TaskBriefPageItemV1,
  type TaskBriefSectionV1,
  type TaskBriefV1,
  type TaskManifestV1,
  type WorkbenchRouteV1,
} from "@understand-code/contracts";

export type TaskWorkbenchLoadStatus =
  | "ready"
  | "missing"
  | "forbidden"
  | "stale"
  | "invalid"
  | "error";

export interface TaskWorkbenchPayload {
  readonly task: TaskManifestV1;
  readonly brief: TaskBriefV1;
  readonly section: TaskBriefSectionV1;
  readonly items: readonly TaskBriefPageItemV1[];
  readonly pulse: RepoPulseV1 | null;
  readonly freshness: {
    readonly sourceSnapshotId: string;
    readonly current: boolean;
  };
}

export interface TaskWorkbenchLoadResult {
  readonly status: TaskWorkbenchLoadStatus;
  readonly payload?: TaskWorkbenchPayload;
  readonly message?: string;
}

type Fetcher = typeof fetch;

function endpointUrl(route: WorkbenchRouteV1, token: string): string | null {
  if (!route.taskId) return null;
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const section = route.section ?? "summary";
  return `${normalizedBase}tasks/${encodeURIComponent(route.taskId)}/brief.json?section=${encodeURIComponent(section)}&token=${encodeURIComponent(token)}`;
}

function responseMessage(status: TaskWorkbenchLoadStatus): string {
  switch (status) {
    case "missing":
      return "No persisted Task Brief was found for this Task. / 未找到已发布的任务简报。";
    case "forbidden":
      return "The local Task session is no longer valid. / 本地任务会话已失效。";
    case "stale":
      return "The Task Brief no longer matches the current repository Snapshot. / 任务简报与当前仓库快照不一致。";
    case "invalid":
      return "The persisted Task Brief failed contract validation. / 已发布任务简报未通过契约校验。";
    case "error":
      return "The local Preview could not read this Task Brief. / 本地 Preview 无法读取任务简报。";
    case "ready":
      return "";
  }
}

function statusForResponse(status: number): TaskWorkbenchLoadStatus {
  if (status === 404) return "missing";
  if (status === 403) return "forbidden";
  if (status === 409) return "stale";
  if (status === 422) return "invalid";
  return "error";
}

function parsePayload(value: unknown): TaskWorkbenchPayload | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const taskResult = TaskManifestV1Schema.safeParse(record.task);
  const briefResult = TaskBriefV1Schema.safeParse(record.brief);
  const sectionResult = TaskBriefSectionV1Schema.safeParse(record.section);
  const itemsValue = Array.isArray(record.items) ? record.items : null;
  const items = itemsValue?.map((item) => TaskBriefPageItemV1Schema.safeParse(item)) ?? null;
  const freshness = record.freshness;
  if (!taskResult.success || !briefResult.success || !sectionResult.success
    || items === null || items.some((item) => !item.success)
    || freshness === null || typeof freshness !== "object" || Array.isArray(freshness)) {
    return null;
  }
  const freshnessRecord = freshness as Record<string, unknown>;
  if (typeof freshnessRecord.sourceSnapshotId !== "string" || typeof freshnessRecord.current !== "boolean") return null;
  const pulseResult = record.pulse === null || record.pulse === undefined
    ? null
    : RepoPulseV1Schema.safeParse(record.pulse);
  if (pulseResult !== null && !pulseResult.success) return null;
  const parsedItems: TaskBriefPageItemV1[] = [];
  for (const item of items) {
    if (!item.success) return null;
    parsedItems.push(item.data);
  }
  return {
    task: taskResult.data,
    brief: briefResult.data,
    section: sectionResult.data,
    items: parsedItems,
    pulse: pulseResult === null ? null : pulseResult.data,
    freshness: {
      sourceSnapshotId: freshnessRecord.sourceSnapshotId,
      current: freshnessRecord.current,
    },
  };
}

/** Read one authenticated, read-only Task Brief projection from Preview. */
export async function loadTaskWorkbench(
  route: WorkbenchRouteV1,
  accessToken: string,
  fetcher: Fetcher = fetch,
): Promise<TaskWorkbenchLoadResult> {
  const url = endpointUrl(route, accessToken);
  if (url === null) return { status: "missing", message: responseMessage("missing") };
  try {
    const response = await fetcher(url, { headers: { accept: "application/json" } });
    if (!response.ok) {
      const status = statusForResponse(response.status);
      return { status, message: responseMessage(status) };
    }
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      return { status: "invalid", message: responseMessage("invalid") };
    }
    const payload = parsePayload(value);
    return payload
      ? { status: "ready", payload }
      : { status: "invalid", message: responseMessage("invalid") };
  } catch {
    return { status: "error", message: responseMessage("error") };
  }
}
