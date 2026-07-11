import { parseWikiIndex } from "@understand-code/core/knowledge-base";
import {
  buildWikiRuntimeIndex,
  type WikiRuntimeIndex,
} from "../wiki/wikiIndex";
import {
  buildKnowledgeContextIndex,
  type KnowledgeContextIndex,
  type KnowledgeDocumentSummary,
  type KnowledgeTraceRecord,
} from "./knowledgeContext";

type Fetcher = typeof fetch;

export type DashboardKnowledge =
  | {
      wikiIndex: WikiRuntimeIndex;
      wikiStatus: "ready";
      sourceVersion: 1 | 2;
    }
  | {
      wikiIndex: WikiRuntimeIndex;
      wikiStatus: "missing" | "invalid" | "forbidden" | "error";
      sourceVersion: null;
    };

interface JsonLoadResult {
  status: "ok" | "missing" | "invalid" | "forbidden" | "error";
  value: unknown;
}

function optionalDataUrl(path: string, token: string | null): string {
  const normalizedPath = path.replace(/^\/+/, "");
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const url = `${normalizedBase}${normalizedPath}`;
  if (import.meta.env.VITE_DEMO_MODE === "true") return url;
  return token ? `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : url;
}

async function fetchOptionalJson<T>(url: string, fetcher: Fetcher = fetch): Promise<T | null> {
  try {
    const res = await fetcher(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchJsonWithStatus(url: string, fetcher: Fetcher): Promise<JsonLoadResult> {
  try {
    const response = await fetcher(url);
    if (response.status === 404) return { status: "missing", value: null };
    if (response.status === 403) return { status: "forbidden", value: null };
    if (!response.ok) return { status: "error", value: null };
    try {
      return { status: "ok", value: await response.json() };
    } catch {
      return { status: "invalid", value: null };
    }
  } catch {
    return { status: "error", value: null };
  }
}

async function fetchOptionalText(url: string, fetcher: Fetcher = fetch): Promise<string | null> {
  try {
    const res = await fetcher(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function decodedMarkdownPath(path: string): string {
  const withoutWrapper = path.trim().replace(/^<(.+)>$/, "$1");
  const withoutTitle = withoutWrapper.replace(/\s+["'][^"']*["']\s*$/, "");
  const withoutFragment = withoutTitle.split("#")[0]?.split("?")[0] ?? "";
  const normalized = withoutFragment.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
  try {
    return decodeURIComponent(normalized);
  } catch {
    return normalized;
  }
}

function knowledgeDocumentId(title: string, path: string): string {
  const source = (path || title).trim().toLowerCase();
  const normalized = source
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/[^a-z0-9\u4e00-\u9fff/._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `knowledge-doc:${normalized || "untitled"}`;
}

function documentsFromMarkdownIndex(markdown: string | null): KnowledgeDocumentSummary[] {
  if (!markdown) return [];
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  const documents: KnowledgeDocumentSummary[] = [];
  const seen = new Set<string>();

  for (const match of markdown.matchAll(linkPattern)) {
    if (match.index !== undefined && markdown[match.index - 1] === "!") continue;

    const title = match[1]?.trim();
    const path = decodedMarkdownPath(match[2] ?? "");
    if (!title || !path || /^https?:\/\//i.test(path) || path.startsWith("mailto:")) continue;

    const id = knowledgeDocumentId(title, path);
    if (seen.has(id)) continue;
    seen.add(id);

    documents.push({
      id,
      title,
      summary: `从生成知识库索引中发现的文档：${title}。`,
      ...(path.endsWith(".md") ? { filePath: path } : { relatedPaths: [path] }),
    });
  }

  return documents;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function traceRoleLabel(role: string | undefined): string | undefined {
  if (role === "structural") return "结构证据";
  if (role === "business") return "业务证据";
  if (role === "implementation") return "实现证据";
  if (role === "configuration") return "配置证据";
  if (role === "test") return "测试证据";
  return role;
}

function titleFromDocumentPath(path: string | undefined): string {
  if (!path) return "生成知识库线索";
  const fileName = path.split("/").pop() ?? path;
  return fileName.replace(/\.md$/i, "") || path;
}

function filePathFromNodeId(nodeId: string): string | undefined {
  const firstColon = nodeId.indexOf(":");
  if (firstColon === -1) return undefined;
  const kind = nodeId.slice(0, firstColon);
  const rest = nodeId.slice(firstColon + 1);
  if (kind === "file" || kind === "document" || kind === "config") return rest;
  const lastColon = rest.lastIndexOf(":");
  return lastColon > 0 ? rest.slice(0, lastColon) : undefined;
}

function normalizeTraceAnchors(value: unknown): NonNullable<KnowledgeTraceRecord["anchors"]> {
  if (!Array.isArray(value)) return [];

  return value.flatMap((anchor) => {
    if (!isRecord(anchor)) return [];
    const filePath = stringValue(anchor.filePath);
    const role = stringValue(anchor.role);
    const nodeId = stringValue(anchor.nodeId);
    const lineRangeValue = anchor.lineRange;
    const lineRange =
      Array.isArray(lineRangeValue) &&
      typeof lineRangeValue[0] === "number" &&
      typeof lineRangeValue[1] === "number"
        ? ([lineRangeValue[0], lineRangeValue[1]] as [number, number])
        : undefined;
    const label = stringValue(anchor.label) ?? role ?? nodeId ?? filePath ?? "知识库线索";
    return [{ label: traceRoleLabel(label) ?? label, filePath, lineRange }];
  });
}

function normalizeTraceRecord(value: unknown): KnowledgeTraceRecord[] {
  if (!isRecord(value)) return [];

  const documentPath = stringValue(value.documentPath) ?? stringValue(value.filePath);
  const title = stringValue(value.title) ?? titleFromDocumentPath(documentPath);
  const summary =
    stringValue(value.summary) ??
    (documentPath
      ? `生成知识库文档 ${documentPath} 已关联到这段代码路径。`
      : "生成知识库线索已关联到这段代码路径。");
  const businessMeaning = stringValue(value.businessMeaning);
  const changeRisk =
    stringValue(value.changeRisk) ??
    (stringArray(value.lowConfidenceClaims).length > 0
      ? "部分关联知识断言可信度偏低，使用前需要人工确认。"
      : undefined);
  const anchors = normalizeTraceAnchors(value.anchors ?? value.sourceAnchors);
  const coveredNodeIds = stringArray(value.coveredNodeIds);
  const coveredFilePaths = stringArray(value.coveredFilePaths);

  if (coveredNodeIds.length === 0 && coveredFilePaths.length === 0) {
    return [
      {
        nodeId: stringValue(value.nodeId),
        filePath: stringValue(value.filePath),
        title,
        summary,
        businessMeaning,
        changeRisk,
        anchors,
      },
    ];
  }

  const traces: KnowledgeTraceRecord[] = [];
  for (const nodeId of coveredNodeIds) {
    traces.push({
      nodeId,
      filePath: filePathFromNodeId(nodeId) ?? coveredFilePaths[0],
      title,
      summary,
      businessMeaning,
      changeRisk,
      anchors,
    });
  }
  for (const filePath of coveredFilePaths) {
    traces.push({ filePath, title, summary, businessMeaning, changeRisk, anchors });
  }
  return traces;
}

function normalizeTracePayload(payload: unknown): KnowledgeTraceRecord[] {
  const records = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.traces)
      ? payload.traces
      : isRecord(payload) && Array.isArray(payload.documents)
        ? payload.documents
        : [];

  return records.flatMap(normalizeTraceRecord);
}

export async function loadKnowledgeContextIndex(
  accessToken: string,
  fetcher: Fetcher = fetch,
): Promise<KnowledgeContextIndex> {
  const [tracePayload, capabilityIndex, flowIndex] = await Promise.all([
    fetchOptionalJson<unknown>(
      optionalDataUrl("knowledge-base/.trace/document-traces.json", accessToken),
      fetcher,
    ),
    fetchOptionalText(optionalDataUrl("knowledge-base/业务能力索引.md", accessToken), fetcher),
    fetchOptionalText(optionalDataUrl("knowledge-base/业务流程地图.md", accessToken), fetcher),
  ]);

  return buildKnowledgeContextIndex({
    traces: normalizeTracePayload(tracePayload),
    documents: [
      ...documentsFromMarkdownIndex(capabilityIndex),
      ...documentsFromMarkdownIndex(flowIndex),
    ],
  });
}

export async function loadDashboardKnowledge(
  accessToken: string,
  fetcher: Fetcher = fetch,
): Promise<DashboardKnowledge> {
  const wikiLoad = await fetchJsonWithStatus(
    optionalDataUrl("knowledge-base/wiki-index.json", accessToken),
    fetcher,
  );
  if (wikiLoad.status !== "ok") {
    return {
      wikiIndex: buildWikiRuntimeIndex(null),
      wikiStatus: wikiLoad.status,
      sourceVersion: null,
    };
  }

  const parsed = parseWikiIndex(wikiLoad.value);
  if (!parsed.ok || !parsed.sourceVersion) {
    return {
      wikiIndex: buildWikiRuntimeIndex(null),
      wikiStatus: "invalid",
      sourceVersion: null,
    };
  }

  return {
    wikiIndex: buildWikiRuntimeIndex(parsed.value),
    wikiStatus: "ready",
    sourceVersion: parsed.sourceVersion,
  };
}

export function shouldRetryWikiLoad(
  status: DashboardKnowledge["wikiStatus"],
  attempts: number,
  maxAttempts: number,
): boolean {
  return status !== "ready" && status !== "forbidden" && attempts < maxAttempts;
}

/** @deprecated Legacy workbench-only retry helper. Wiki-first App uses shouldRetryWikiLoad. */
export function shouldRetryKnowledgeContextLoad(
  index: Pick<KnowledgeContextIndex, "traceCount" | "documentCount">,
  attempts: number,
  maxAttempts: number,
): boolean {
  return index.traceCount === 0 && index.documentCount === 0 && attempts < maxAttempts;
}
