import {
  buildWikiIndex,
  emptyWikiIndex,
  type WikiIndex,
  type WikiIndexPayload,
} from "../wiki/wikiIndex";
import {
  buildKnowledgeContextIndex,
  type KnowledgeContextIndex,
  type KnowledgeDocumentSummary,
  type KnowledgeTraceRecord,
} from "./knowledgeContext";

type Fetcher = typeof fetch;

export interface DashboardKnowledge {
  contextIndex: KnowledgeContextIndex;
  wikiIndex: WikiIndex;
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

function documentsFromWikiIndexPayload(payload: WikiIndexPayload | null): KnowledgeDocumentSummary[] {
  if (!payload) return [];
  return payload.pages.map((page) => ({
    id: page.id,
    title: page.title,
    summary: page.summary,
    filePath: page.markdownPath,
    relatedPaths: wikiPageRelatedPaths(payload, page),
    anchors: payload.evidence
      .filter((item) => page.evidenceIds.includes(item.id))
      .map((item) => ({
        label: item.label,
        filePath: item.filePath,
        lineRange: item.lineRange,
      })),
  }));
}

function wikiPageEvidence(payload: WikiIndexPayload, page: WikiIndexPayload["pages"][number]): WikiIndexPayload["evidence"] {
  const evidenceIds = new Set(page.evidenceIds);
  return payload.evidence.filter((item) => evidenceIds.has(item.id));
}

function wikiPageAnchors(
  payload: WikiIndexPayload,
  page: WikiIndexPayload["pages"][number],
): NonNullable<KnowledgeTraceRecord["anchors"]> {
  return wikiPageEvidence(payload, page).map((item) => ({
    label: item.label,
    filePath: item.filePath,
    lineRange: item.lineRange,
  }));
}

function uniqueStrings(values: readonly (string | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function wikiPageRelatedPaths(payload: WikiIndexPayload, page: WikiIndexPayload["pages"][number]): string[] {
  const evidence = wikiPageEvidence(payload, page);
  const nodeIds = uniqueStrings([
    ...page.explainedNodeIds,
    ...page.relatedNodeIds,
    ...evidence.flatMap((item) => item.nodeIds),
  ]);
  return uniqueStrings([
    ...nodeIds,
    ...nodeIds.map(filePathFromNodeId),
    ...evidence.map((item) => item.filePath),
  ]);
}

function tracesFromWikiIndexPayload(payload: WikiIndexPayload | null): KnowledgeTraceRecord[] {
  if (!payload) return [];

  return payload.pages.flatMap((page) => {
    const evidence = wikiPageEvidence(payload, page);
    const anchors = wikiPageAnchors(payload, page);
    const nodeIds = uniqueStrings([
      ...page.explainedNodeIds,
      ...page.relatedNodeIds,
      ...evidence.flatMap((item) => item.nodeIds),
    ]);
    const evidenceFilePaths = uniqueStrings(evidence.map((item) => item.filePath));
    const sourceFilePaths = uniqueStrings([...nodeIds.map(filePathFromNodeId), ...evidenceFilePaths]);
    const firstEvidenceFilePath = evidenceFilePaths[0];
    const baseTrace = {
      title: page.title,
      summary: page.summary,
      businessMeaning: `这段上下文来自 wiki 页面 ${page.markdownPath}。`,
      changeRisk: "修改这段代码前，先核对 wiki 页面和下方代码证据。",
      anchors,
    };

    return [
      ...nodeIds.map((nodeId) => ({
        ...baseTrace,
        nodeId,
        filePath: filePathFromNodeId(nodeId) ?? firstEvidenceFilePath,
      })),
      ...sourceFilePaths.map((filePath) => ({
        ...baseTrace,
        filePath,
      })),
    ];
  });
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

function isStringArrayValue(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isLineRangeValue(value: unknown): value is [number, number] | undefined {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length === 2 &&
      typeof value[0] === "number" &&
      typeof value[1] === "number")
  );
}

function isWikiPageRecord(value: unknown): value is WikiIndexPayload["pages"][number] {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.category === "string" &&
    typeof value.summary === "string" &&
    typeof value.markdownPath === "string" &&
    isStringArrayValue(value.explainedNodeIds) &&
    isStringArrayValue(value.relatedNodeIds) &&
    isStringArrayValue(value.evidenceIds) &&
    typeof value.coverage === "string" &&
    typeof value.quality === "string"
  );
}

function isWikiEvidenceRecord(value: unknown): value is WikiIndexPayload["evidence"][number] {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    isOptionalString(value.filePath) &&
    isLineRangeValue(value.lineRange) &&
    isStringArrayValue(value.nodeIds)
  );
}

function isWikiGapRecord(value: unknown): value is WikiIndexPayload["gaps"][number] {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.nodeId === "string" &&
    typeof value.reason === "string" &&
    typeof value.severity === "string"
  );
}

function isWikiIndexPayload(value: unknown): value is WikiIndexPayload {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.generatedAt === "string" &&
    typeof value.projectName === "string" &&
    Array.isArray(value.pages) &&
    value.pages.every(isWikiPageRecord) &&
    Array.isArray(value.evidence) &&
    value.evidence.every(isWikiEvidenceRecord) &&
    Array.isArray(value.gaps) &&
    value.gaps.every(isWikiGapRecord)
  );
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
  const wikiPayloadValue = await fetchOptionalJson<unknown>(
    optionalDataUrl("knowledge-base/wiki-index.json", accessToken),
    fetcher,
  );
  const wikiPayload = isWikiIndexPayload(wikiPayloadValue) ? wikiPayloadValue : null;

  if (wikiPayload) {
    const wikiIndex = buildWikiIndex(wikiPayload);
    return {
      wikiIndex,
      contextIndex: buildKnowledgeContextIndex({
        traces: tracesFromWikiIndexPayload(wikiPayload),
        documents: documentsFromWikiIndexPayload(wikiPayload),
      }),
    };
  }

  return {
    wikiIndex: emptyWikiIndex(),
    contextIndex: await loadKnowledgeContextIndex(accessToken, fetcher),
  };
}

export function shouldRetryKnowledgeContextLoad(
  index: Pick<KnowledgeContextIndex, "traceCount" | "documentCount">,
  attempts: number,
  maxAttempts: number,
): boolean {
  return index.traceCount === 0 && index.documentCount === 0 && attempts < maxAttempts;
}
