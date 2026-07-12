import type { WikiSearchRecordV2 } from "@understand-code/core/knowledge-base";
import type { WikiRuntimeIndex } from "./wikiIndex";
import { canonicalReferenceOwnerPath } from "./navigationModel";

export type WikiSearchGroupKind =
  | "direct"
  | "capability-flow"
  | "module-file"
  | "symbol"
  | "context";

export interface PreparedWikiSearchRecord {
  record: WikiSearchRecordV2;
  group: WikiSearchGroupKind;
  title: string;
  summary: string;
  content: string;
  filePath: string;
  terms: readonly string[];
  businessTerms: readonly string[];
  haystack: string;
  sortTitle: string;
}

export interface WikiSearchRuntime {
  records: readonly WikiSearchRecordV2[];
  preparedRecords: readonly PreparedWikiSearchRecord[];
  mode: "full" | "fallback";
}

export interface WikiSearchResults {
  groups: Array<{ kind: WikiSearchGroupKind; items: WikiSearchRecordV2[] }>;
  totalByKind: Record<WikiSearchGroupKind, number>;
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  mode: WikiSearchRuntime["mode"];
}

const GROUP_ORDER: readonly WikiSearchGroupKind[] = [
  "direct",
  "capability-flow",
  "module-file",
  "symbol",
  "context",
];

const SYMBOL_PREFIXES = ["function:", "class:", "method:", "type:", "interface:"] as const;

function groupFor(record: WikiSearchRecordV2): WikiSearchGroupKind {
  if (record.relation === "context") return "context";
  if (record.kind === "symbol") return "symbol";
  if (record.category === "capability" || record.category === "flow") return "capability-flow";
  if (record.category === "module" || record.category === "file") return "module-file";
  return "direct";
}

function normalize(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("zh-CN").trim();
}

function prepareSearchRecord(record: WikiSearchRecordV2): PreparedWikiSearchRecord {
  const title = normalize(record.title);
  const summary = normalize(record.summary ?? "");
  const content = normalize(record.content ?? "");
  const filePath = normalize(record.filePath ?? "");
  const terms = record.terms.map(normalize);
  const businessTerms = record.businessTerms.map(normalize);
  return {
    record,
    group: groupFor(record),
    title,
    summary,
    content,
    filePath,
    terms,
    businessTerms,
    haystack: [title, summary, content, filePath, ...terms, ...businessTerms].join("\n"),
    sortTitle: record.title,
  };
}

function createRuntime(
  records: readonly WikiSearchRecordV2[],
  mode: WikiSearchRuntime["mode"],
): WikiSearchRuntime {
  return {
    records,
    preparedRecords: records.map(prepareSearchRecord),
    mode,
  };
}

function score(
  prepared: PreparedWikiSearchRecord,
  query: string,
  tokens: readonly string[],
): number | null {
  if (!tokens.every((token) => prepared.haystack.includes(token))) return null;

  let result = prepared.title === query
    ? 500
    : prepared.title.startsWith(query)
      ? 350
      : prepared.title.includes(query)
        ? 250
        : 0;
  if (prepared.businessTerms.some((term) => term === query)) result += 220;
  else if (prepared.businessTerms.some((term) => term.includes(query))) result += 180;
  if (prepared.filePath === query) result += 210;
  else if (prepared.filePath.includes(query)) result += 160;
  if (prepared.terms.some((term) => term === query)) result += 150;
  else if (prepared.terms.some((term) => term.includes(query))) result += 100;
  if (prepared.summary.includes(query)) result += 40;
  if (prepared.content.includes(query)) result += 30;
  return result;
}

function ownerPath(nodeIds: readonly string[]): string | undefined {
  for (const nodeId of nodeIds) {
    const path = canonicalReferenceOwnerPath(nodeId);
    if (path) return path;
  }
  return undefined;
}

function symbolParts(nodeId: string): { title: string; filePath: string } | null {
  const prefix = SYMBOL_PREFIXES.find((candidate) => nodeId.startsWith(candidate));
  if (!prefix) return null;
  const body = nodeId.slice(prefix.length);
  const split = body.lastIndexOf(":");
  if (split <= 0 || split === body.length - 1) return null;
  return { filePath: body.slice(0, split), title: body.slice(split + 1) };
}

export function buildFallbackSearchRecords(index: WikiRuntimeIndex): WikiSearchRecordV2[] {
  const pageRecords: WikiSearchRecordV2[] = index.pages.map((page) => ({
    id: `fallback:page:${page.id}`,
    kind: "page",
    title: page.title,
    summary: page.summary,
    pageId: page.id,
    role: page.role,
    category: page.category,
    relation: page.directNodeIds.length > 0
      ? "direct"
      : page.contextNodeIds.length > 0
        ? "context"
        : "none",
    terms: [...page.searchTerms, page.markdownPath],
    businessTerms: [],
    ...(ownerPath(page.directNodeIds) === undefined
      ? {}
      : { filePath: ownerPath(page.directNodeIds) }),
  }));
  const symbolRecords: WikiSearchRecordV2[] = [];

  for (const item of index.nodeDocumentationById.values()) {
    if (!item.primaryPageId || !item.anchor) continue;
    const parts = symbolParts(item.nodeId);
    const page = index.pagesById.get(item.primaryPageId);
    if (!parts || !page) continue;
    symbolRecords.push({
      id: `fallback:symbol:${item.nodeId}`,
      kind: "symbol",
      title: parts.title,
      pageId: page.id,
      anchor: item.anchor,
      nodeId: item.nodeId,
      role: page.role,
      category: page.category,
      relation: item.relation,
      terms: [item.nodeId, parts.title, parts.filePath],
      businessTerms: [],
      filePath: parts.filePath,
    });
  }
  return [...pageRecords, ...symbolRecords];
}

export function buildWikiSearchRuntime(
  records: readonly WikiSearchRecordV2[],
  wikiIndex: WikiRuntimeIndex,
  mode: WikiSearchRuntime["mode"],
): WikiSearchRuntime {
  if (mode === "fallback") {
    return createRuntime(buildFallbackSearchRecords(wikiIndex), mode);
  }

  const seen = new Set<string>();
  const validRecords = records.filter((record) => {
    if (seen.has(record.id) || !wikiIndex.pagesById.has(record.pageId)) return false;
    if (
      record.kind === "symbol"
      && (
        !record.anchor?.trim()
        || !record.nodeId?.trim()
        || record.content !== undefined
        || record.businessTerms.length > 0
      )
    ) return false;
    seen.add(record.id);
    return true;
  });
  return createRuntime(validRecords, mode);
}

function emptyCounts(): Record<WikiSearchGroupKind, number> {
  return {
    direct: 0,
    "capability-flow": 0,
    "module-file": 0,
    symbol: 0,
    context: 0,
  };
}

export function searchWiki(
  runtime: WikiSearchRuntime,
  rawQuery: string,
  page: number,
  pageSize: number,
): WikiSearchResults {
  if (!Number.isInteger(page) || page < 1) throw new RangeError("page must be at least 1");
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new RangeError("pageSize must be at least 1");
  const query = normalize(rawQuery);
  if (!query) {
    return {
      groups: [],
      totalByKind: emptyCounts(),
      total: 0,
      page,
      pageSize,
      hasNextPage: false,
      mode: runtime.mode,
    };
  }

  const tokens = query.split(/\s+/u).filter(Boolean);
  const matches = new Map<WikiSearchGroupKind, Array<{
    prepared: PreparedWikiSearchRecord;
    score: number;
  }>>(GROUP_ORDER.map((kind) => [kind, []]));

  for (const prepared of runtime.preparedRecords) {
    const recordScore = score(prepared, query, tokens);
    if (recordScore !== null) matches.get(prepared.group)!.push({ prepared, score: recordScore });
  }
  for (const items of matches.values()) {
    items.sort((left, right) => right.score - left.score
      || left.prepared.sortTitle.localeCompare(right.prepared.sortTitle, "zh-CN", { numeric: true })
      || left.prepared.record.id.localeCompare(right.prepared.record.id));
  }

  const totalByKind = emptyCounts();
  for (const kind of GROUP_ORDER) totalByKind[kind] = matches.get(kind)!.length;
  const flattened = GROUP_ORDER.flatMap((kind) =>
    matches.get(kind)!.map(({ prepared }) => ({ kind, record: prepared.record })));
  const start = (page - 1) * pageSize;
  const visible = flattened.slice(start, start + pageSize);
  const groups = GROUP_ORDER.flatMap((kind) => {
    const items = visible
      .filter((item) => item.kind === kind)
      .map((item) => item.record);
    return items.length > 0 ? [{ kind, items }] : [];
  });

  return {
    groups,
    totalByKind,
    total: flattened.length,
    page,
    pageSize,
    hasNextPage: start + pageSize < flattened.length,
    mode: runtime.mode,
  };
}
