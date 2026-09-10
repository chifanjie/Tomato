import { TaskManifestV1Schema, type TaskManifestV1 } from "@understand-code/contracts";
import { dashboardFetchInit, withDashboardAccess } from "./transport";

export interface TaskDiscovery {
  readonly schemaVersion: 1;
  readonly repository: { readonly repoId: string; readonly name?: string; readonly snapshotId?: string; readonly status: string; readonly reason?: string };
  readonly runtime: { readonly kind: string; readonly ready: boolean; readonly reason?: string; readonly nextAction?: string };
  readonly tasks: readonly TaskManifestV1[];
}

export function parseTaskDiscovery(value: unknown): TaskDiscovery | null {
  if (!value || typeof value !== "object") return null;
  const result = value as Record<string, unknown>;
  const repository = result.repository as TaskDiscovery["repository"] | undefined;
  const runtime = result.runtime as TaskDiscovery["runtime"] | undefined;
  if (result.schemaVersion !== 1 || !repository || typeof repository.repoId !== "string" || typeof repository.status !== "string"
    || !runtime || typeof runtime.kind !== "string" || typeof runtime.ready !== "boolean" || !Array.isArray(result.tasks)) return null;
  for (const field of [repository.name, repository.snapshotId, repository.reason, runtime.reason, runtime.nextAction]) {
    if (field !== undefined && typeof field !== "string") return null;
  }
  const tasks = result.tasks.map((task) => TaskManifestV1Schema.safeParse(task));
  if (tasks.some((task) => !task.success || task.data.repositoryId !== repository.repoId)) return null;
  return { schemaVersion: 1, repository, runtime, tasks: tasks.flatMap((task) => task.success ? [task.data] : []) };
}

export async function loadTaskDiscovery(access: string, fetcher: typeof fetch = fetch): Promise<{ status: "ready" | "forbidden" | "unavailable"; value?: TaskDiscovery; message?: string }> {
  try {
    const response = await fetcher(withDashboardAccess("/__workbench/tasks", access), { ...dashboardFetchInit(access), headers: { accept: "application/json" }, cache: "no-store" });
    if (response.status === 401 || response.status === 403) return { status: "forbidden", message: "工作台会话已失效，请从宿主重新打开。" };
    if (!response.ok) return { status: "unavailable", message: "此服务尚未提供任务发现接口。请使用支持本地任务的安装版本，并从 Codex 打开工作台。" };
    const value = parseTaskDiscovery(await response.json());
    return value ? { status: "ready", value } : { status: "unavailable", message: "任务列表未通过校验；仓库连接与任务能力暂时无法确认。" };
  } catch {
    return { status: "unavailable", message: "无法连接任务服务；请检查本地服务并重新打开工作台。开发版图谱可用不代表任务服务已连接。" };
  }
}

/** Mint a link only after selection; listing history must not create sessions. */
export async function launchTaskWorkbench(taskId: string, access: string, origin: string, fetcher: typeof fetch = fetch): Promise<{ status: "ready" | "forbidden" | "unavailable"; url?: string }> {
  try {
    const response = await fetcher(withDashboardAccess(`/__workbench/tasks/${encodeURIComponent(taskId)}/open`, access), { ...dashboardFetchInit(access), headers: { accept: "application/json" }, cache: "no-store" });
    if (response.status === 401 || response.status === 403) return { status: "forbidden" };
    if (!response.ok) return { status: "unavailable" };
    const result = await response.json() as { deepLink?: unknown };
    if (typeof result.deepLink !== "string") return { status: "unavailable" };
    const target = new URL(result.deepLink, origin);
    if (target.protocol !== "http:" || target.hostname !== "127.0.0.1" || target.pathname !== "/workbench" || target.username || target.password) return { status: "unavailable" };
    return { status: "ready", url: target.toString() };
  } catch {
    return { status: "unavailable" };
  }
}
