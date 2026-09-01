import {
  ChangeCheckArtifactV1Schema,
  RepoPulseSurfaceResponseV1Schema,
  TaskBriefPageItemV1Schema,
  TaskBriefSectionV1Schema,
  TaskBriefV1Schema,
  TaskManifestV1Schema,
  VerificationArtifactV1Schema,
  type RepoPulseSurfaceResponseV1,
  type ChangeCheckV1,
  type TaskBriefPageItemV1,
  type TaskBriefSectionV1,
  type TaskBriefV1,
  type TaskManifestV1,
  type VerificationRecordV1,
  type WorkbenchRouteV1,
} from "@understand-code/contracts";
import {
  dashboardFetchInit,
  isCookieWorkbenchAccess,
  withDashboardAccess,
} from "./transport";

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

/**
 * A Task-scoped knowledge generation waiting for review.  This is deliberately
 * a dashboard-local projection: the authoritative candidate and its lineage
 * remain owned by the Workbench/Provider reader.
 */
export interface TaskKnowledgeCandidateV1 {
  readonly candidateGenerationId: string;
  readonly taskRevision: number;
  readonly sourceSnapshotId: string;
  readonly predecessorGenerationId?: string;
  readonly sourceSnapshotMatchesCurrent: boolean;
  readonly publishedGenerationId?: string;
}

export interface TaskKnowledgeCandidatesPayloadV1 {
  readonly schemaVersion: 1;
  readonly taskId: string;
  readonly currentTaskRevision: number;
  readonly currentSnapshotId: string;
  readonly candidates: readonly TaskKnowledgeCandidateV1[];
}

export type TaskKnowledgeCandidate = TaskKnowledgeCandidateV1;
export type TaskKnowledgeCandidatesPayload = TaskKnowledgeCandidatesPayloadV1;

export interface TaskEvidenceRecord {
  readonly id: string;
  readonly kind: "source" | "config" | "test" | "document";
  readonly epistemicStatus: "observed" | "inferred";
  readonly freshness: "current" | "changed" | "stale" | "invalid";
  readonly filePath: string;
  readonly lineRange: readonly [number, number];
  readonly contentHash: string;
  readonly observedAtSnapshotId: string;
  readonly nodeIds: readonly string[];
}

export interface TaskEvidenceSource {
  readonly filePath: string;
  readonly lineRange: readonly [number, number];
  readonly content: string;
  readonly sizeBytes: number;
  readonly lineCount: number;
  readonly truncated: false;
}

export type TaskEvidenceProjection =
  | {
      readonly status: "ready";
      readonly taskId: string;
      readonly evidenceId: string;
      readonly evidence: TaskEvidenceRecord;
      readonly source: TaskEvidenceSource;
    }
  | {
      readonly status: "stale" | "invalid" | "unavailable" | "redacted";
      readonly taskId: string;
      readonly evidenceId: string;
      readonly reason: string;
      readonly observedSnapshotId?: string;
      readonly evidence?: TaskEvidenceRecord;
    };

export interface TaskWorkbenchPayload {
  readonly task: TaskManifestV1;
  readonly brief: TaskBriefV1;
  readonly section: TaskBriefSectionV1;
  readonly items: readonly TaskBriefPageItemV1[];
  readonly pulse: RepoPulseSurfaceResponseV1 | null;
  readonly freshness: {
    readonly sourceSnapshotId: string;
    readonly current: boolean;
  };
  readonly changeCheck: TaskArtifactLoadResult<ChangeCheckV1>;
  readonly verification: TaskArtifactLoadResult<readonly VerificationRecordV1[]>;
  readonly evidence: TaskArtifactLoadResult<TaskEvidenceProjection>;
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
  return withDashboardAccess(
    `${normalizedBase}tasks/${encodeURIComponent(route.taskId)}/brief.json?section=${encodeURIComponent(section)}`,
    token,
  );
}

function artifactEndpointUrl(
  route: WorkbenchRouteV1,
  token: string,
  kind: "change-check" | "verification",
): string | null {
  if (!route.taskId) return null;
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return withDashboardAccess(
    `${normalizedBase}tasks/${encodeURIComponent(route.taskId)}/${kind}.json`,
    token,
  );
}

function knowledgeCandidatesEndpointUrl(route: WorkbenchRouteV1, token: string): string | null {
  if (!route.taskId) return null;
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return withDashboardAccess(
    `${normalizedBase}tasks/${encodeURIComponent(route.taskId)}/knowledge-candidates.json`,
    token,
  );
}

function evidenceEndpointUrl(route: WorkbenchRouteV1): string | null {
  if (!route.taskId || !route.evidenceId) return null;
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const query = new URLSearchParams({ taskId: route.taskId, evidenceId: route.evidenceId });
  return `${normalizedBase}__workbench/evidence?${query.toString()}`;
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
  if (status === 401 || status === 403) return "forbidden";
  if (status === 409) return "stale";
  if (status === 422) return "invalid";
  return "error";
}

function artifactStatusForResponse(status: number): TaskArtifactLoadStatus {
  if (status === 404) return "missing";
  if (status === 401 || status === 403) return "forbidden";
  if (status === 409) return "stale";
  if (status === 422) return "invalid";
  return "error";
}

function knowledgeCandidateString(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 256
    && !/[\s\u0000-\u001f\u007f]/u.test(value);
}

const KNOWLEDGE_GENERATION_ID = /^generation-[0-9a-f]{64}$/u;

function knowledgeCandidateGeneration(value: unknown): value is string {
  return typeof value === "string" && KNOWLEDGE_GENERATION_ID.test(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

/** Strictly parse the list response; malformed/future revisions fail closed. */
export function parseTaskKnowledgeCandidates(
  value: unknown,
  expectedTaskId: string,
): TaskKnowledgeCandidatesPayloadV1 | null {
  if (!knowledgeCandidateString(expectedTaskId)
    || value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!exactKeys(record, ["schemaVersion", "taskId", "currentTaskRevision", "currentSnapshotId", "candidates"])) return null;
  if (record.schemaVersion !== 1 || record.taskId !== expectedTaskId
    || !Number.isSafeInteger(record.currentTaskRevision)
    || (record.currentTaskRevision as number) < 0
    || !knowledgeCandidateString(record.currentSnapshotId)
    || !Array.isArray(record.candidates) || record.candidates.length > 32) return null;

  const seen = new Set<string>();
  const candidates: TaskKnowledgeCandidateV1[] = [];
  for (const candidateValue of record.candidates) {
    if (candidateValue === null || typeof candidateValue !== "object" || Array.isArray(candidateValue)) return null;
    const candidate = candidateValue as Record<string, unknown>;
    if (!exactKeys(candidate, [
      "candidateGenerationId", "taskRevision", "sourceSnapshotId", "predecessorGenerationId",
      "sourceSnapshotMatchesCurrent", "publishedGenerationId",
    ])) return null;
    if (!knowledgeCandidateGeneration(candidate.candidateGenerationId)
      || seen.has(candidate.candidateGenerationId)
      || !Number.isSafeInteger(candidate.taskRevision)
      || (candidate.taskRevision as number) < 0
      || (candidate.taskRevision as number) > (record.currentTaskRevision as number)
      || !knowledgeCandidateString(candidate.sourceSnapshotId)
      || typeof candidate.sourceSnapshotMatchesCurrent !== "boolean"
      || candidate.sourceSnapshotMatchesCurrent !== (candidate.sourceSnapshotId === record.currentSnapshotId)) return null;
    if (candidate.predecessorGenerationId !== undefined
      && (!knowledgeCandidateGeneration(candidate.predecessorGenerationId)
        || candidate.predecessorGenerationId === candidate.candidateGenerationId)) return null;
    if (candidate.publishedGenerationId !== undefined
      && !knowledgeCandidateGeneration(candidate.publishedGenerationId)) return null;
    seen.add(candidate.candidateGenerationId);
    candidates.push({
      candidateGenerationId: candidate.candidateGenerationId,
      taskRevision: candidate.taskRevision as number,
      sourceSnapshotId: candidate.sourceSnapshotId,
      ...(candidate.predecessorGenerationId === undefined ? {} : {
        predecessorGenerationId: candidate.predecessorGenerationId,
      }),
      sourceSnapshotMatchesCurrent: candidate.sourceSnapshotMatchesCurrent,
      ...(candidate.publishedGenerationId === undefined ? {} : {
        publishedGenerationId: candidate.publishedGenerationId,
      }),
    });
  }
  return {
    schemaVersion: 1,
    taskId: expectedTaskId,
    currentTaskRevision: record.currentTaskRevision as number,
    currentSnapshotId: record.currentSnapshotId,
    candidates,
  };
}

function knowledgeCandidatesResponseMessage(status: TaskArtifactLoadStatus): string {
  switch (status) {
    case "missing":
      return "当前任务尚未生成待审知识候选。 / No pending knowledge candidate was found for this Task.";
    case "forbidden":
      return "本地任务会话已失效，无法读取待审知识候选。 / The local Task session is no longer valid.";
    case "stale":
      return "待审知识候选与当前仓库 Snapshot 不一致。 / The pending knowledge candidate is stale.";
    case "invalid":
      return "待审知识候选未通过严格契约校验。 / The pending knowledge candidate failed validation.";
    case "error":
      return "本地 Preview 无法读取待审知识候选。 / The local Preview could not read pending knowledge.";
    case "ready":
      return "";
  }
}

/** Lazily read the current Task's pending knowledge candidates. */
export async function loadTaskKnowledgeCandidates(
  route: WorkbenchRouteV1,
  accessToken: string,
  fetcher: Fetcher = fetch,
): Promise<TaskArtifactLoadResult<TaskKnowledgeCandidatesPayloadV1>> {
  const url = knowledgeCandidatesEndpointUrl(route, accessToken);
  if (url === null || route.taskId === undefined) {
    return { status: "missing", message: knowledgeCandidatesResponseMessage("missing") };
  }
  try {
    const response = await fetcher(url, {
      ...dashboardFetchInit(accessToken),
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      const status = artifactStatusForResponse(response.status);
      return { status, message: knowledgeCandidatesResponseMessage(status) };
    }
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      return { status: "invalid", message: knowledgeCandidatesResponseMessage("invalid") };
    }
    const parsed = parseTaskKnowledgeCandidates(value, route.taskId);
    return parsed === null
      ? { status: "invalid", message: knowledgeCandidatesResponseMessage("invalid") }
      : { status: "ready", value: parsed };
  } catch {
    return { status: "error", message: knowledgeCandidatesResponseMessage("error") };
  }
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
    : RepoPulseSurfaceResponseV1Schema.safeParse(record.pulse);
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
    evidence: { status: "missing", message: "No Task Evidence is selected. / 尚未选择任务证据。" },
  };
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !value.includes("\0");
}

function lineRange(value: unknown): value is readonly [number, number] {
  return Array.isArray(value) && value.length === 2
    && Number.isInteger(value[0]) && Number.isInteger(value[1])
    && (value[0] as number) >= 1 && (value[1] as number) >= (value[0] as number);
}

function parseEvidenceRecord(value: unknown): TaskEvidenceRecord | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const kinds = new Set(["source", "config", "test", "document"]);
  const epistemicStatuses = new Set(["observed", "inferred"]);
  const freshness = new Set(["current", "changed", "stale", "invalid"]);
  if (!nonEmptyString(record.id) || !kinds.has(String(record.kind))
    || !epistemicStatuses.has(String(record.epistemicStatus))
    || !freshness.has(String(record.freshness)) || !nonEmptyString(record.filePath)
    || !lineRange(record.lineRange) || !nonEmptyString(record.contentHash)
    || !nonEmptyString(record.observedAtSnapshotId)
    || !Array.isArray(record.nodeIds) || !record.nodeIds.every(nonEmptyString)) return null;
  return {
    id: record.id,
    kind: record.kind as TaskEvidenceRecord["kind"],
    epistemicStatus: record.epistemicStatus as TaskEvidenceRecord["epistemicStatus"],
    freshness: record.freshness as TaskEvidenceRecord["freshness"],
    filePath: record.filePath,
    lineRange: record.lineRange,
    contentHash: record.contentHash,
    observedAtSnapshotId: record.observedAtSnapshotId,
    nodeIds: [...new Set(record.nodeIds)],
  };
}

function parseEvidenceProjection(
  value: unknown,
  route: WorkbenchRouteV1,
): TaskEvidenceProjection | null {
  if (!route.taskId || !route.evidenceId || value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.taskId !== route.taskId || record.evidenceId !== route.evidenceId || !nonEmptyString(record.status)) return null;
  if (record.status === "ready") {
    const evidence = parseEvidenceRecord(record.evidence);
    const sourceValue = record.source;
    if (!evidence || sourceValue === null || typeof sourceValue !== "object" || Array.isArray(sourceValue)) return null;
    const source = sourceValue as Record<string, unknown>;
    if (source.filePath !== evidence.filePath || !lineRange(source.lineRange)
      || source.lineRange[0] !== evidence.lineRange[0] || source.lineRange[1] !== evidence.lineRange[1]
      || typeof source.content !== "string" || !Number.isInteger(source.sizeBytes)
      || !Number.isInteger(source.lineCount) || source.truncated !== false) return null;
    return {
      status: "ready",
      taskId: route.taskId,
      evidenceId: route.evidenceId,
      evidence,
      source: {
        filePath: evidence.filePath,
        lineRange: evidence.lineRange,
        content: source.content,
        sizeBytes: source.sizeBytes as number,
        lineCount: source.lineCount as number,
        truncated: false,
      },
    };
  }
  if (!["stale", "invalid", "unavailable", "redacted"].includes(record.status) || !nonEmptyString(record.reason)) return null;
  const evidence = record.evidence === undefined ? undefined : parseEvidenceRecord(record.evidence);
  if (record.evidence !== undefined && !evidence) return null;
  return {
    status: record.status as "stale" | "invalid" | "unavailable" | "redacted",
    taskId: route.taskId,
    evidenceId: route.evidenceId,
    reason: record.reason,
    ...(nonEmptyString(record.observedSnapshotId) ? { observedSnapshotId: record.observedSnapshotId } : {}),
    ...(evidence ? { evidence } : {}),
  };
}

async function loadTaskEvidence(
  route: WorkbenchRouteV1,
  accessToken: string,
  fetcher: Fetcher,
): Promise<TaskArtifactLoadResult<TaskEvidenceProjection>> {
  if (!isCookieWorkbenchAccess(accessToken) || !route.evidenceId) {
    return { status: "missing", message: "No Task Evidence is selected. / 尚未选择任务证据。" };
  }
  const url = evidenceEndpointUrl(route);
  if (!url) return { status: "missing", message: "No Task Evidence is selected. / 尚未选择任务证据。" };
  try {
    const response = await fetcher(url, {
      ...dashboardFetchInit(accessToken),
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      const status = artifactStatusForResponse(response.status);
      return { status, message: "Task Evidence is unavailable for this Workbench session. / 当前工作台会话无法读取任务证据。" };
    }
    const parsed = parseEvidenceProjection(await response.json(), route);
    if (!parsed) return { status: "invalid", message: "Task Evidence failed projection validation. / 任务证据投影无效。" };
    if (parsed.status === "ready") return { status: "ready", value: parsed };
    if (parsed.status === "stale") return { status: "stale", value: parsed, message: "Task Evidence belongs to a stale Snapshot. / 任务证据属于过期快照。" };
    if (parsed.status === "invalid") return { status: "invalid", value: parsed, message: "Task Evidence is invalid. / 任务证据无效。" };
    return { status: "missing", value: parsed, message: "Task Evidence source is unavailable or redacted. / 任务证据源码不可用或已隐藏。" };
  } catch {
    return { status: "error", message: "Task Evidence could not be read. / 无法读取任务证据。" };
  }
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
    const response = await fetcher(url, {
      ...dashboardFetchInit(accessToken),
      headers: { accept: "application/json" },
    });
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
    const response = await fetcher(url, {
      ...dashboardFetchInit(accessToken),
      headers: { accept: "application/json" },
    });
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

    const [changeCheck, verification, evidence] = await Promise.all([
      loadTaskArtifact<ChangeCheckV1>(route, accessToken, "change-check", fetcher),
      loadTaskArtifact<readonly VerificationRecordV1[]>(route, accessToken, "verification", fetcher),
      loadTaskEvidence(route, accessToken, fetcher),
    ]);
    if (changeCheck.status === "forbidden" || verification.status === "forbidden" || evidence.status === "forbidden") {
      return { status: "forbidden", message: "The local Task session is no longer valid. / 本地任务会话已失效。" };
    }
    return {
      status: "ready",
      payload: {
        ...payload,
        changeCheck,
        verification,
        evidence,
      },
    };
  } catch {
    return { status: "error", message: responseMessage("error") };
  }
}
