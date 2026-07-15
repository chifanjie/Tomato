import type { KnowledgeGraph } from "@understand-code/core/types";
import type {
  WikiIndexV2,
  WikiSearchRecordV2,
} from "@understand-code/core/knowledge-base";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

const LEGACY_BRAND = "understand-anything";
const ESCAPED_LEGACY_BRAND = "understand\\-anything";
const CURRENT_BRAND = "Understand Code";

interface MarkdownNode {
  type: string;
  value?: string;
  url?: string;
  alt?: string | null;
  title?: string | null;
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

function normalizeLegacyBrandSource(value: string): string {
  return normalizeLegacyBrandText(value)
    .split(ESCAPED_LEGACY_BRAND).join(CURRENT_BRAND);
}

function isEscaped(source: string, index: number): boolean {
  let backslashes = 0;
  for (let position = index - 1; position >= 0 && source[position] === "\\"; position -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function previousNonWhitespace(source: string, index: number): number {
  let position = index;
  while (position >= 0 && /\s/.test(source[position]!)) position -= 1;
  return position;
}

function markdownImageAltRange(
  node: MarkdownNode,
  markdown: string,
): TextRange | undefined {
  if (
    (node.type !== "image" && node.type !== "imageReference")
    || typeof node.alt !== "string"
    || !node.alt.includes(LEGACY_BRAND)
  ) return undefined;

  const start = node.position?.start?.offset;
  const end = node.position?.end?.offset;
  if (typeof start !== "number" || typeof end !== "number") return undefined;
  const source = markdown.slice(start, end);
  if (!source.startsWith("![")) return undefined;

  let nestedBrackets = 0;
  for (let position = 2; position < source.length; position += 1) {
    const character = source[position];
    if (isEscaped(source, position)) continue;
    if (character === "[") {
      nestedBrackets += 1;
    } else if (character === "]") {
      if (nestedBrackets === 0) return { start: start + 2, end: start + position };
      nestedBrackets -= 1;
    }
  }
  return undefined;
}

function markdownTitleRange(
  node: MarkdownNode,
  markdown: string,
): TextRange | undefined {
  if (
    (node.type !== "link" && node.type !== "image" && node.type !== "definition")
    || typeof node.title !== "string"
    || !node.title.includes(LEGACY_BRAND)
  ) return undefined;

  const start = node.position?.start?.offset;
  const end = node.position?.end?.offset;
  if (typeof start !== "number" || typeof end !== "number") return undefined;
  const source = markdown.slice(start, end);
  let closePosition = previousNonWhitespace(source, source.length - 1);
  if (node.type !== "definition") {
    if (source[closePosition] !== ")" || isEscaped(source, closePosition)) return undefined;
    closePosition = previousNonWhitespace(source, closePosition - 1);
  }

  const closeDelimiter = source[closePosition];
  const openDelimiter = closeDelimiter === ")" ? "(" : closeDelimiter;
  if (openDelimiter !== "(" && openDelimiter !== "\"" && openDelimiter !== "'") {
    return undefined;
  }

  for (let position = closePosition - 1; position >= 0; position -= 1) {
    if (source[position] !== openDelimiter || isEscaped(source, position)) continue;
    if (position > 0 && !/\s/.test(source[position - 1]!)) return undefined;
    return { start: start + position + 1, end: start + closePosition };
  }
  return undefined;
}

function collectMarkdownTextRanges(
  node: MarkdownNode,
  markdown: string,
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

  const imageAltRange = markdownImageAltRange(node, markdown);
  if (imageAltRange !== undefined) ranges.push(imageAltRange);
  const titleRange = markdownTitleRange(node, markdown);
  if (titleRange !== undefined) ranges.push(titleRange);

  for (const child of node.children ?? []) {
    collectMarkdownTextRanges(child, markdown, ranges, currentLinkUrl);
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
  collectMarkdownTextRanges(tree, markdown, ranges);
  let result = markdown;
  for (const { start, end } of ranges.sort((left, right) => right.start - left.start)) {
    const original = result.slice(start, end);
    result = `${result.slice(0, start)}${normalizeLegacyBrandSource(original)}${result.slice(end)}`;
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
