import type { KnowledgeGraph } from "@understand-code/core/types";
import type {
  WikiIndexV2,
  WikiSearchRecordV2,
} from "@understand-code/core/knowledge-base";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

const LEGACY_BRAND = "understand-anything";
const CURRENT_BRAND = "Understand Code";

interface MarkdownNode {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
  position?: {
    start?: { offset?: number };
    end?: { offset?: number };
  };
}

interface TextRange {
  start: number;
  end: number;
}

export function normalizeLegacyBrandText(value: string): string {
  return value.includes(LEGACY_BRAND)
    ? value.split(LEGACY_BRAND).join(CURRENT_BRAND)
    : value;
}

function normalizeLegacyBrandTerm(value: string): string {
  return value === LEGACY_BRAND ? CURRENT_BRAND : value;
}

function collectMarkdownTextRanges(
  node: MarkdownNode,
  ranges: TextRange[],
  linkUrl?: string,
): void {
  const currentLinkUrl = node.type === "link" ? node.url : linkUrl;
  const start = node.position?.start?.offset;
  const end = node.position?.end?.offset;
  const isDisplayedUrl = node.type === "text"
    && typeof node.value === "string"
    && typeof currentLinkUrl === "string"
    && node.value === currentLinkUrl;

  if (
    node.type === "text"
    && typeof node.value === "string"
    && node.value.includes(LEGACY_BRAND)
    && !isDisplayedUrl
    && typeof start === "number"
    && typeof end === "number"
  ) {
    ranges.push({ start, end });
  }

  for (const child of node.children ?? []) {
    collectMarkdownTextRanges(child, ranges, currentLinkUrl);
  }
}

export function normalizeLegacyMarkdownBranding(markdown: string): string {
  if (!markdown.includes(LEGACY_BRAND)) return markdown;

  let tree: MarkdownNode;
  try {
    tree = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .parse(markdown) as unknown as MarkdownNode;
  } catch {
    return markdown;
  }

  const ranges: TextRange[] = [];
  collectMarkdownTextRanges(tree, ranges);
  let result = markdown;
  for (const { start, end } of ranges.sort((left, right) => right.start - left.start)) {
    const original = result.slice(start, end);
    result = `${result.slice(0, start)}${normalizeLegacyBrandText(original)}${result.slice(end)}`;
  }
  return result;
}

export function normalizeLegacyGraphBranding(graph: KnowledgeGraph): KnowledgeGraph {
  const name = normalizeLegacyBrandText(graph.project.name);
  const description = normalizeLegacyBrandText(graph.project.description);
  if (name === graph.project.name && description === graph.project.description) return graph;
  return {
    ...graph,
    project: { ...graph.project, name, description },
  };
}

export function normalizeLegacyWikiIndexBranding(index: WikiIndexV2): WikiIndexV2 {
  const projectName = normalizeLegacyBrandText(index.projectName);
  let pagesChanged = false;
  const pages = index.pages.map((page) => {
    const title = normalizeLegacyBrandText(page.title);
    const summary = normalizeLegacyBrandText(page.summary);
    const searchTerms = page.searchTerms.map(normalizeLegacyBrandTerm);
    const changed = title !== page.title
      || summary !== page.summary
      || searchTerms.some((term, position) => term !== page.searchTerms[position]);
    if (!changed) return page;
    pagesChanged = true;
    return { ...page, title, summary, searchTerms };
  });
  if (projectName === index.projectName && !pagesChanged) return index;
  return { ...index, projectName, pages };
}

export function normalizeLegacySearchRecordsBranding(
  records: readonly WikiSearchRecordV2[],
): WikiSearchRecordV2[] {
  return records.map((record) => ({
    ...record,
    title: normalizeLegacyBrandText(record.title),
    ...(record.summary === undefined
      ? {}
      : { summary: normalizeLegacyBrandText(record.summary) }),
    ...(record.content === undefined
      ? {}
      : { content: normalizeLegacyMarkdownBranding(record.content) }),
    terms: record.terms.map(normalizeLegacyBrandTerm),
    businessTerms: record.businessTerms.map(normalizeLegacyBrandTerm),
  }));
}
