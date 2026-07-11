import type {
  WikiDocumentCategory,
  WikiEvidenceV2,
  WikiIndexV2,
  WikiNodeDocumentationV2,
  WikiPageV2,
} from "@understand-code/core/knowledge-base";

export interface WikiRuntimeIndex {
  payload: WikiIndexV2 | null;
  pages: readonly WikiPageV2[];
  pageCount: number;
  pagesById: ReadonlyMap<string, WikiPageV2>;
  nodeDocumentationById: ReadonlyMap<string, WikiNodeDocumentationV2>;
  evidenceById: ReadonlyMap<string, WikiEvidenceV2>;
  directPagesByNodeId: ReadonlyMap<string, readonly WikiPageV2[]>;
  contextPagesByNodeId: ReadonlyMap<string, readonly WikiPageV2[]>;
  evidenceByNodeId: ReadonlyMap<string, readonly WikiEvidenceV2[]>;
  routePages: readonly WikiPageV2[];
}

export interface WikiTreeSection {
  category: WikiDocumentCategory;
  title: string;
  pages: WikiPageV2[];
}

const CATEGORY_TITLES: Record<WikiDocumentCategory, string> = {
  overview: "开始阅读",
  capability: "核心能力",
  flow: "业务流程",
  module: "架构与模块",
  topic: "函数与类型",
  file: "文件参考",
  quality: "知识库质量",
  coverage: "覆盖情况",
  other: "其他",
};

const CATEGORY_ORDER: readonly WikiDocumentCategory[] = [
  "overview",
  "capability",
  "flow",
  "module",
  "topic",
  "file",
  "quality",
  "coverage",
  "other",
];

function append<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  map.set(key, [...(map.get(key) ?? []), value]);
}

function readonlyListMap<K, V>(map: Map<K, V[]>): ReadonlyMap<K, readonly V[]> {
  return new Map(
    [...map.entries()].map(([key, values]) => [key, Object.freeze([...values])]),
  );
}

export function buildWikiRuntimeIndex(
  payload: WikiIndexV2 | null | undefined,
): WikiRuntimeIndex {
  const pages = Object.freeze([...(payload?.pages ?? [])]);
  const pagesById = new Map(pages.map((page) => [page.id, page]));
  const nodeDocumentationById = new Map(
    (payload?.nodeDocumentation ?? []).map((item) => [item.nodeId, item]),
  );
  const evidenceById = new Map(
    (payload?.evidence ?? []).map((item) => [item.id, item]),
  );
  const directPagesByNodeId = new Map<string, WikiPageV2[]>();
  const contextPagesByNodeId = new Map<string, WikiPageV2[]>();
  const evidenceByNodeId = new Map<string, WikiEvidenceV2[]>();

  for (const page of pages) {
    for (const nodeId of page.directNodeIds) append(directPagesByNodeId, nodeId, page);
    for (const nodeId of page.contextNodeIds) append(contextPagesByNodeId, nodeId, page);
  }
  for (const item of payload?.evidence ?? []) {
    for (const nodeId of item.nodeIds) append(evidenceByNodeId, nodeId, item);
  }

  const routePages = Object.freeze(
    (payload?.mainReadiness.routePageIds ?? []).flatMap((pageId) => {
      const page = pagesById.get(pageId);
      return page?.role === "featured" && page.route ? [page] : [];
    }),
  );

  return {
    payload: payload ?? null,
    pages,
    pageCount: pages.length,
    pagesById,
    nodeDocumentationById,
    evidenceById,
    directPagesByNodeId: readonlyListMap(directPagesByNodeId),
    contextPagesByNodeId: readonlyListMap(contextPagesByNodeId),
    evidenceByNodeId: readonlyListMap(evidenceByNodeId),
    routePages,
  };
}

export function emptyWikiRuntimeIndex(): WikiRuntimeIndex {
  return buildWikiRuntimeIndex(null);
}

export function evidenceForPage(
  index: WikiRuntimeIndex,
  pageId: string,
): WikiEvidenceV2[] {
  const page = index.pagesById.get(pageId);
  if (!page) return [];
  return page.evidenceIds.flatMap((evidenceId) => {
    const evidence = index.evidenceById.get(evidenceId);
    return evidence ? [evidence] : [];
  });
}

export function categorySections(index: WikiRuntimeIndex): WikiTreeSection[] {
  const pagesByCategory = new Map<WikiDocumentCategory, WikiPageV2[]>();
  for (const page of index.pages) append(pagesByCategory, page.category, page);

  return CATEGORY_ORDER.flatMap((category) => {
    const pages = pagesByCategory.get(category);
    return pages && pages.length > 0
      ? [{ category, title: CATEGORY_TITLES[category], pages: [...pages] }]
      : [];
  });
}
