export type KnowledgeMatchKind = "direct-trace" | "filename-path" | "related-document" | "graph-only";

export interface KnowledgeSourceAnchor {
  label: string;
  filePath?: string;
  lineRange?: readonly [number, number];
  url?: string;
}

export interface KnowledgeTraceRecord {
  nodeId?: string;
  filePath?: string;
  title: string;
  summary: string;
  businessMeaning?: string;
  changeRisk?: string;
  anchors?: readonly KnowledgeSourceAnchor[];
}

export interface KnowledgeDocumentSummary {
  id: string;
  title: string;
  summary: string;
  filePath?: string;
  relatedPaths?: readonly string[];
  anchors?: readonly KnowledgeSourceAnchor[];
}

export interface BuildKnowledgeContextIndexInput {
  traces: readonly KnowledgeTraceRecord[];
  documents: readonly KnowledgeDocumentSummary[];
}

export interface KnowledgeContextIndex {
  traces: readonly KnowledgeTraceRecord[];
  documents: readonly KnowledgeDocumentSummary[];
  traceCount: number;
  documentCount: number;
  tracesByNodeId: ReadonlyMap<string, readonly KnowledgeTraceRecord[]>;
  tracesByFilePath: ReadonlyMap<string, readonly KnowledgeTraceRecord[]>;
  documentsByFilePath: ReadonlyMap<string, readonly KnowledgeDocumentSummary[]>;
  documentsByRelatedPath: ReadonlyMap<string, readonly KnowledgeDocumentSummary[]>;
}

export interface WorkbenchSelection {
  nodeId: string;
  filePath?: string;
  title: string;
  summary: string;
  kind: string;
}

export interface KnowledgeContext {
  matchKind: KnowledgeMatchKind;
  title: string;
  summary: string;
  businessMeaning: string;
  changeRisk: string;
  evidence: KnowledgeSourceAnchor[];
  documents: KnowledgeDocumentSummary[];
  loadedTraceCount: number;
  loadedDocumentCount: number;
}

function normalizedPath(value: string | undefined): string | null {
  const normalized = value?.trim().replace(/\\/g, "/").replace(/^\.\//, "");
  return normalized ? normalized.toLowerCase() : null;
}

function normalizedId(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function pushIndexedValue<T>(index: Map<string, T[]>, key: string | null, value: T): void {
  if (!key) return;
  const current = index.get(key);
  if (current) {
    current.push(value);
    return;
  }
  index.set(key, [value]);
}

function snapshotIndex<T>(index: Map<string, T[]>): ReadonlyMap<string, readonly T[]> {
  return new Map([...index.entries()].map(([key, values]) => [key, Object.freeze([...values])]));
}

function formattedAnchor(anchor: KnowledgeSourceAnchor): KnowledgeSourceAnchor {
  const parts: string[] = [];
  if (anchor.filePath) {
    parts.push(anchor.filePath);
  }
  if (anchor.lineRange) {
    parts.push(`L${anchor.lineRange[0]}-${anchor.lineRange[1]}`);
  }

  if (parts.length === 0) return { ...anchor };

  return {
    ...anchor,
    label: `${anchor.label} - ${parts.join(" ")}`,
  };
}

function formattedAnchors(anchors: readonly KnowledgeSourceAnchor[] | undefined): KnowledgeSourceAnchor[] {
  return (anchors ?? []).map(formattedAnchor);
}

function uniqueDocuments(documents: readonly KnowledgeDocumentSummary[]): KnowledgeDocumentSummary[] {
  const seen = new Set<string>();
  const unique: KnowledgeDocumentSummary[] = [];
  for (const document of documents) {
    if (seen.has(document.id)) continue;
    seen.add(document.id);
    unique.push(document);
  }
  return unique;
}

function documentsForSelection(
  index: KnowledgeContextIndex,
  selection: WorkbenchSelection,
): { exact: KnowledgeDocumentSummary[]; related: KnowledgeDocumentSummary[] } {
  const path = normalizedPath(selection.filePath);
  if (!path) return { exact: [], related: [] };

  return {
    exact: [...(index.documentsByFilePath.get(path) ?? [])],
    related: uniqueDocuments(index.documentsByRelatedPath.get(path) ?? []),
  };
}

function nodeTraceForSelection(index: KnowledgeContextIndex, selection: WorkbenchSelection): KnowledgeTraceRecord | undefined {
  return index.tracesByNodeId.get(selection.nodeId)?.[0];
}

function fileTraceForSelection(index: KnowledgeContextIndex, selection: WorkbenchSelection): KnowledgeTraceRecord | undefined {
  const path = normalizedPath(selection.filePath);
  return path ? index.tracesByFilePath.get(path)?.[0] : undefined;
}

function fallbackTitle(selection: WorkbenchSelection): string {
  return selection.title || selection.filePath || selection.nodeId;
}

export function buildKnowledgeContextIndex({
  traces,
  documents,
}: BuildKnowledgeContextIndexInput): KnowledgeContextIndex {
  const tracesByNodeId = new Map<string, KnowledgeTraceRecord[]>();
  const tracesByFilePath = new Map<string, KnowledgeTraceRecord[]>();
  const documentsByFilePath = new Map<string, KnowledgeDocumentSummary[]>();
  const documentsByRelatedPath = new Map<string, KnowledgeDocumentSummary[]>();
  const traceSnapshot = Object.freeze([...traces]);
  const documentSnapshot = Object.freeze([...documents]);

  for (const trace of traceSnapshot) {
    pushIndexedValue(tracesByNodeId, normalizedId(trace.nodeId), trace);
    pushIndexedValue(tracesByFilePath, normalizedPath(trace.filePath), trace);
  }

  for (const document of documentSnapshot) {
    pushIndexedValue(documentsByFilePath, normalizedPath(document.filePath), document);
    for (const relatedPath of document.relatedPaths ?? []) {
      pushIndexedValue(documentsByRelatedPath, normalizedPath(relatedPath), document);
    }
  }

  return {
    traces: traceSnapshot,
    documents: documentSnapshot,
    traceCount: traceSnapshot.length,
    documentCount: documentSnapshot.length,
    tracesByNodeId: snapshotIndex(tracesByNodeId),
    tracesByFilePath: snapshotIndex(tracesByFilePath),
    documentsByFilePath: snapshotIndex(documentsByFilePath),
    documentsByRelatedPath: snapshotIndex(documentsByRelatedPath),
  };
}

function withLoadCounts(index: KnowledgeContextIndex, context: Omit<KnowledgeContext, "loadedTraceCount" | "loadedDocumentCount">): KnowledgeContext {
  return {
    ...context,
    loadedTraceCount: index.traceCount,
    loadedDocumentCount: index.documentCount,
  };
}

export function resolveKnowledgeContext(
  index: KnowledgeContextIndex,
  selection: WorkbenchSelection | null | undefined,
): KnowledgeContext {
  if (!selection) {
    return withLoadCounts(index, {
      matchKind: "graph-only",
      title: "选择一个节点",
      summary: "选择图谱节点后，这里会展示生成知识库线索、相关文档和代码证据。",
      businessMeaning: "工作台选中节点后，会在这里汇总它对应的业务含义。",
      changeRisk: "当前还没有选中的代码路径。",
      evidence: [],
      documents: [],
    });
  }

  const nodeTrace = nodeTraceForSelection(index, selection);
  const documents = documentsForSelection(index, selection);
  const supportingDocuments = uniqueDocuments([...documents.exact, ...documents.related]);

  if (nodeTrace) {
    return withLoadCounts(index, {
      matchKind: "direct-trace",
      title: nodeTrace.title,
      summary: nodeTrace.summary,
      businessMeaning: nodeTrace.businessMeaning ?? "这条知识库线索还没有生成更细的业务含义。",
      changeRisk: nodeTrace.changeRisk ?? "修改这段代码前，先核对下方关联证据和生成文档。",
      evidence: formattedAnchors(nodeTrace.anchors),
      documents: supportingDocuments,
    });
  }

  const fileTrace = fileTraceForSelection(index, selection);
  if (fileTrace) {
    return withLoadCounts(index, {
      matchKind: "filename-path",
      title: fileTrace.title,
      summary: fileTrace.summary,
      businessMeaning: fileTrace.businessMeaning ?? "这条文件级知识库线索还没有生成更细的业务含义。",
      changeRisk: fileTrace.changeRisk ?? "修改这段代码前，先核对下方关联证据和生成文档。",
      evidence: formattedAnchors(fileTrace.anchors),
      documents: supportingDocuments,
    });
  }

  const exactDocument = documents.exact[0];
  if (exactDocument) {
    return withLoadCounts(index, {
      matchKind: "filename-path",
      title: exactDocument.title,
      summary: exactDocument.summary,
      businessMeaning: `这段上下文来自直接关联到 ${selection.filePath ?? selection.nodeId} 的知识库文档。`,
      changeRisk: "根据关联证据和文档摘要判断修改影响范围。",
      evidence: formattedAnchors(exactDocument.anchors),
      documents: documents.exact,
    });
  }

  const relatedDocument = documents.related[0];
  if (relatedDocument) {
    return withLoadCounts(index, {
      matchKind: "related-document",
      title: relatedDocument.title,
      summary: relatedDocument.summary,
      businessMeaning: `这段上下文来自与 ${selection.filePath ?? selection.nodeId} 相关的更大范围知识库文档。`,
      changeRisk: "使用这份文档判断改动前，先确认当前节点仍符合文档描述的链路。",
      evidence: formattedAnchors(relatedDocument.anchors),
      documents: documents.related,
    });
  }

  return withLoadCounts(index, {
    matchKind: "graph-only",
    title: fallbackTitle(selection),
    summary: selection.summary || "当前图谱节点还没有生成知识库摘要。",
    businessMeaning: "没有生成知识库线索或相关文档命中当前选择。",
    changeRisk: "先结合图谱关系和源代码，再判断这块区域的修改影响。",
    evidence: [],
    documents: [],
  });
}
