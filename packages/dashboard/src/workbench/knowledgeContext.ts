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
    tracesByNodeId: snapshotIndex(tracesByNodeId),
    tracesByFilePath: snapshotIndex(tracesByFilePath),
    documentsByFilePath: snapshotIndex(documentsByFilePath),
    documentsByRelatedPath: snapshotIndex(documentsByRelatedPath),
  };
}

export function resolveKnowledgeContext(
  index: KnowledgeContextIndex,
  selection: WorkbenchSelection | null | undefined,
): KnowledgeContext {
  if (!selection) {
    return {
      matchKind: "graph-only",
      title: "Select a node",
      summary: "Choose a graph node to see generated knowledge traces and related documents.",
      businessMeaning: "Knowledge context appears here after a workbench selection is active.",
      changeRisk: "No selected code path yet.",
      evidence: [],
      documents: [],
    };
  }

  const nodeTrace = nodeTraceForSelection(index, selection);
  const documents = documentsForSelection(index, selection);
  const supportingDocuments = uniqueDocuments([...documents.exact, ...documents.related]);

  if (nodeTrace) {
    return {
      matchKind: "direct-trace",
      title: nodeTrace.title,
      summary: nodeTrace.summary,
      businessMeaning: nodeTrace.businessMeaning ?? "No generated business meaning is available for this trace yet.",
      changeRisk: nodeTrace.changeRisk ?? "Review the linked evidence before changing this code path.",
      evidence: formattedAnchors(nodeTrace.anchors),
      documents: supportingDocuments,
    };
  }

  const fileTrace = fileTraceForSelection(index, selection);
  if (fileTrace) {
    return {
      matchKind: "filename-path",
      title: fileTrace.title,
      summary: fileTrace.summary,
      businessMeaning: fileTrace.businessMeaning ?? "No generated business meaning is available for this trace yet.",
      changeRisk: fileTrace.changeRisk ?? "Review the linked evidence before changing this code path.",
      evidence: formattedAnchors(fileTrace.anchors),
      documents: supportingDocuments,
    };
  }

  const exactDocument = documents.exact[0];
  if (exactDocument) {
    return {
      matchKind: "filename-path",
      title: exactDocument.title,
      summary: exactDocument.summary,
      businessMeaning: `This context comes from a knowledge document linked to ${selection.filePath ?? selection.nodeId}.`,
      changeRisk: "Use the linked evidence and document summary to understand likely change impact.",
      evidence: formattedAnchors(exactDocument.anchors),
      documents: documents.exact,
    };
  }

  const relatedDocument = documents.related[0];
  if (relatedDocument) {
    return {
      matchKind: "related-document",
      title: relatedDocument.title,
      summary: relatedDocument.summary,
      businessMeaning: `This context comes from a broader knowledge document related to ${selection.filePath ?? selection.nodeId}.`,
      changeRisk: "Confirm the selected node still follows the related document before relying on it for changes.",
      evidence: formattedAnchors(relatedDocument.anchors),
      documents: documents.related,
    };
  }

  return {
    matchKind: "graph-only",
    title: fallbackTitle(selection),
    summary: selection.summary || "No generated knowledge summary is available for this graph selection yet.",
    businessMeaning: "No generated knowledge trace or related document is available for this selection yet.",
    changeRisk: "Use the graph relationships and source code before changing this area.",
    evidence: [],
    documents: [],
  };
}
