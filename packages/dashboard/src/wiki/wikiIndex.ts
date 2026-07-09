export type WikiPageCategory =
  | "overview"
  | "capability"
  | "flow"
  | "module"
  | "file"
  | "symbol"
  | "gap"
  | "quality"
  | "other";

export type WikiCoverageStatus = "complete" | "partial" | "gap" | "unknown";
export type WikiQualityStatus = "verified" | "generated" | "low-confidence";
export type GapSeverity = "low" | "medium" | "high";

export interface WikiPageRecord {
  id: string;
  title: string;
  category: WikiPageCategory;
  summary: string;
  markdownPath: string;
  explainedNodeIds: string[];
  relatedNodeIds: string[];
  evidenceIds: string[];
  coverage: Exclude<WikiCoverageStatus, "gap" | "unknown">;
  quality: WikiQualityStatus;
}

export interface WikiEvidenceRecord {
  id: string;
  label: string;
  filePath?: string;
  lineRange?: [number, number];
  nodeIds: string[];
}

export interface WikiGapRecord {
  id: string;
  nodeId: string;
  reason: string;
  severity: GapSeverity;
}

export interface WikiIndexPayload {
  version: 1;
  generatedAt: string;
  projectName: string;
  pages: WikiPageRecord[];
  evidence: WikiEvidenceRecord[];
  gaps: WikiGapRecord[];
}

export interface WikiCoverageResult {
  status: WikiCoverageStatus;
  pages: WikiPageRecord[];
  gaps: WikiGapRecord[];
}

export interface WikiTreeSection {
  category: WikiPageCategory;
  title: string;
  pages: WikiPageRecord[];
}

export interface WikiIndex {
  payload: WikiIndexPayload | null;
  pages: readonly WikiPageRecord[];
  evidence: readonly WikiEvidenceRecord[];
  gaps: readonly WikiGapRecord[];
  pageCount: number;
  evidenceCount: number;
  gapCount: number;
  pagesById: ReadonlyMap<string, WikiPageRecord>;
  evidenceById: ReadonlyMap<string, WikiEvidenceRecord>;
  gapsByNodeId: ReadonlyMap<string, readonly WikiGapRecord[]>;
  pagesByExplainedNodeId: ReadonlyMap<string, readonly WikiPageRecord[]>;
  pagesByRelatedNodeId: ReadonlyMap<string, readonly WikiPageRecord[]>;
}

const SECTION_TITLES: Record<WikiPageCategory, string> = {
  overview: "Project Overview",
  capability: "Business Capabilities",
  flow: "Business Flows",
  module: "Modules",
  file: "Files",
  symbol: "Functions and Classes",
  gap: "Gaps",
  quality: "Quality Report",
  other: "Other",
};

const CATEGORY_ORDER: WikiPageCategory[] = [
  "overview",
  "capability",
  "flow",
  "module",
  "file",
  "symbol",
  "gap",
  "quality",
  "other",
];

function pushMapValue<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key) ?? [];
  list.push(value);
  map.set(key, list);
}

function readonlyListMap<T>(map: Map<string, T[]>): ReadonlyMap<string, readonly T[]> {
  return new Map([...map.entries()].map(([key, value]) => [key, Object.freeze([...value])]));
}

export function emptyWikiIndex(): WikiIndex {
  return buildWikiIndex(null);
}

export function buildWikiIndex(payload: WikiIndexPayload | null | undefined): WikiIndex {
  const pages = Object.freeze([...(payload?.pages ?? [])]);
  const evidence = Object.freeze([...(payload?.evidence ?? [])]);
  const gaps = Object.freeze([...(payload?.gaps ?? [])]);
  const pagesById = new Map<string, WikiPageRecord>();
  const evidenceById = new Map<string, WikiEvidenceRecord>();
  const gapsByNodeId = new Map<string, WikiGapRecord[]>();
  const pagesByExplainedNodeId = new Map<string, WikiPageRecord[]>();
  const pagesByRelatedNodeId = new Map<string, WikiPageRecord[]>();

  for (const page of pages) {
    pagesById.set(page.id, page);
    for (const nodeId of page.explainedNodeIds) pushMapValue(pagesByExplainedNodeId, nodeId, page);
    for (const nodeId of page.relatedNodeIds) pushMapValue(pagesByRelatedNodeId, nodeId, page);
  }

  for (const item of evidence) evidenceById.set(item.id, item);
  for (const gap of gaps) pushMapValue(gapsByNodeId, gap.nodeId, gap);

  return {
    payload: payload ?? null,
    pages,
    evidence,
    gaps,
    pageCount: pages.length,
    evidenceCount: evidence.length,
    gapCount: gaps.length,
    pagesById,
    evidenceById,
    gapsByNodeId: readonlyListMap(gapsByNodeId),
    pagesByExplainedNodeId: readonlyListMap(pagesByExplainedNodeId),
    pagesByRelatedNodeId: readonlyListMap(pagesByRelatedNodeId),
  };
}

export function pagesForNode(index: WikiIndex, nodeId: string): WikiPageRecord[] {
  const explained = index.pagesByExplainedNodeId.get(nodeId) ?? [];
  const related = index.pagesByRelatedNodeId.get(nodeId) ?? [];
  const seen = new Set<string>();
  const result: WikiPageRecord[] = [];
  for (const page of [...explained, ...related]) {
    if (seen.has(page.id)) continue;
    seen.add(page.id);
    result.push(page);
  }
  return result;
}

export function primaryPageForNode(index: WikiIndex, nodeId: string): WikiPageRecord | null {
  return index.pagesByExplainedNodeId.get(nodeId)?.[0] ?? index.pagesByRelatedNodeId.get(nodeId)?.[0] ?? null;
}

export function evidenceForPage(index: WikiIndex, pageId: string): WikiEvidenceRecord[] {
  const page = index.pagesById.get(pageId);
  if (!page) return [];
  return page.evidenceIds
    .map((id) => index.evidenceById.get(id))
    .filter((item): item is WikiEvidenceRecord => Boolean(item));
}

export function coverageForNode(index: WikiIndex, nodeId: string): WikiCoverageResult {
  const explainedPages = [...(index.pagesByExplainedNodeId.get(nodeId) ?? [])];
  const gaps = [...(index.gapsByNodeId.get(nodeId) ?? [])];
  if (gaps.length > 0) return { status: "gap", pages: pagesForNode(index, nodeId), gaps };
  if (explainedPages.some((page) => page.coverage === "complete")) {
    return { status: "complete", pages: pagesForNode(index, nodeId), gaps: [] };
  }
  if (explainedPages.length > 0) return { status: "partial", pages: pagesForNode(index, nodeId), gaps: [] };
  return { status: "unknown", pages: pagesForNode(index, nodeId), gaps: [] };
}

export function pageTree(index: WikiIndex): WikiTreeSection[] {
  const sections = new Map<WikiPageCategory, WikiPageRecord[]>();
  for (const page of index.pages) {
    const list = sections.get(page.category) ?? [];
    list.push(page);
    sections.set(page.category, list);
  }
  return CATEGORY_ORDER.flatMap((category) => {
    const pages = sections.get(category);
    if (!pages || pages.length === 0) return [];
    return [{
      category,
      title: SECTION_TITLES[category],
      pages: [...pages].sort((a, b) => a.title.localeCompare(b.title)),
    }];
  });
}
