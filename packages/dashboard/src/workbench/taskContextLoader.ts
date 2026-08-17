import {
  ChangeCheckArtifactV1Schema,
  RepoPulseV1Schema,
  TaskBriefPageItemV1Schema,
  TaskBriefSectionV1Schema,
  TaskBriefV1Schema,
  TaskManifestV1Schema,
  VerificationArtifactV1Schema,
  type RepoPulseV1,
  type ChangeCheckV1,
  type TaskBriefPageItemV1,
  type TaskBriefSectionV1,
  type TaskBriefV1,
  type TaskManifestV1,
  type VerificationRecordV1,
  type WorkbenchRouteV1,
} from "@understand-code/contracts";

export type TaskWorkbenchLoadStatus =
  | "ready"
  | "missing"
  | "forbidden"
  | "stale"
  | "invalid"
  | "error";

export type TaskArtifactLoadStatus = Exclude<TaskWorkbenchLoadStatus, "ready"> | "ready";

export interface TaskArtifactLoadResult<T> {
  readonly status: TaskArtifactLoadStatus;
  readonly value?: T;
  readonly message?: string;
}

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
  readonly changeCheck: TaskArtifactLoadResult<ChangeCheckV1>;
  readonly verification: TaskArtifactLoadResult<readonly VerificationRecordV1[]>;
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

function artifactEndpointUrl(
  route: WorkbenchRouteV1,
  token: string,
  kind: "change-check" | "verification",
): string | null {
  if (!route.taskId) return null;
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}tasks/${encodeURIComponent(route.taskId)}/${kind}.json?token=${encodeURIComponent(token)}`;
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

function artifactResponseMessage(
  kind: "change-check" | "verification",
  status: TaskArtifactLoadStatus,
): string {
  const label = kind === "change-check" ? "Change Check / 变更检查" : "Verification / 验证记录";
  switch (status) {
    case "missing":
      return `No persisted ${label} was found for this Task. / 当前任务尚未发布${label}。`;
    case "forbidden":
      return `The local ${label} session is no longer valid. / ${label}会话已失效。`;
    case "stale":
      return `The persisted ${label} no longer matches the current repository Snapshot. / 已发布${label}与当前仓库快照不一致。`;
    case "invalid":
      return `The persisted ${label} failed envelope or contract validation. / 已发布${label}未通过信封或契约校验。`;
    case "error":
      return `The local Preview could not read ${label}. / 本地 Preview 无法读取${label}。`;
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

function artifactStatusForResponse(status: number): TaskArtifactLoadStatus {
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
    changeCheck: { status: "missing", message: artifactResponseMessage("change-check", "missing") },
    verification: { status: "missing", message: artifactResponseMessage("verification", "missing") },
  };
}

function parseArtifact<T>(
  value: unknown,
  kind: "change-check" | "verification",
  taskId: string,
): T | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const artifactValue = record.artifact;
  if (kind === "change-check") {
    const result = ChangeCheckArtifactV1Schema.safeParse(artifactValue);
    return result.success && result.data.taskId === taskId ? result.data.payload as T : null;
  }
  const result = VerificationArtifactV1Schema.safeParse(artifactValue);
  return result.success && result.data.taskId === taskId ? result.data.payload.records as T : null;
}

async function loadTaskArtifact<T>(
  route: WorkbenchRouteV1,
  accessToken: string,
  kind: "change-check" | "verification",
  fetcher: Fetcher,
): Promise<TaskArtifactLoadResult<T>> {
  const url = artifactEndpointUrl(route, accessToken, kind);
  if (url === null || route.taskId === undefined) {
    return { status: "missing", message: artifactResponseMessage(kind, "missing") };
  }
  try {
    const response = await fetcher(url, { headers: { accept: "application/json" } });
    if (!response.ok) {
      const status = artifactStatusForResponse(response.status);
      return { status, message: artifactResponseMessage(kind, status) };
    }
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      return { status: "invalid", message: artifactResponseMessage(kind, "invalid") };
    }
    const parsed = parseArtifact<T>(value, kind, route.taskId);
    return parsed === null
      ? { status: "invalid", message: artifactResponseMessage(kind, "invalid") }
      : { status: "ready", value: parsed };
  } catch {
    return { status: "error", message: artifactResponseMessage(kind, "error") };
  }
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
    if (payload === null) return { status: "invalid", message: responseMessage("invalid") };

    const [changeCheck, verification] = await Promise.all([
      loadTaskArtifact<ChangeCheckV1>(route, accessToken, "change-check", fetcher),
      loadTaskArtifact<readonly VerificationRecordV1[]>(route, accessToken, "verification", fetcher),
    ]);
    if (changeCheck.status === "forbidden" || verification.status === "forbidden") {
      return { status: "forbidden", message: "The local Task session is no longer valid. / 本地任务会话已失效。" };
    }
    return {
      status: "ready",
      payload: {
        ...payload,
        changeCheck,
        verification,
      },
    };
  } catch {
    return { status: "error", message: responseMessage("error") };
  }
}
