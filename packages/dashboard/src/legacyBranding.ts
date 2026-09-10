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
const LEGACY_BRAND_SOURCE_PATTERN = /understand(?:-|\\-|&#0*45;|&#[xX]0*2[dD];)anything/g;
const HAS_LEGACY_BRAND_SOURCE_PATTERN = /understand(?:-|\\-|&#0*45;|&#[xX]0*2[dD];)anything/;

interface MarkdownNode {
  type: string;
  value?: string;
  url?: string;
  alt?: string | null;
  title?: string | null;
  identifier?: string;
  referenceType?: "shortcut" | "collapsed" | "full";
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

interface TextEdit extends TextRange {
  replacement: string;
}

export function normalizeLegacyBrandText(value: string): string {
  return value.includes(LEGACY_BRAND)
    ? value.split(LEGACY_BRAND).join(CURRENT_BRAND)
    : value;
}

function legacyBrandTermsWithAlias(values: string[]): string[] {
  if (!values.includes(LEGACY_BRAND) || values.includes(CURRENT_BRAND)) return values;
  return [...values, CURRENT_BRAND];
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

function isAsciiTokenCharacter(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z0-9_/@\\?&=#%+~-]/.test(character);
}

function isTechnicalBrandOccurrence(
  source: string,
  start: number,
  end: number,
): boolean {
  const before = source[start - 1];
  const after = source[end];
  if (isAsciiTokenCharacter(before) || isAsciiTokenCharacter(after)) return true;
  if (
    before === "."
    && /[A-Za-z0-9]/.test(source[start - 2] ?? "")
  ) return true;
  if (
    after === "."
    && /[A-Za-z0-9]/.test(source[end + 1] ?? "")
  ) return true;
  if (
    before === ":"
    && /[A-Za-z0-9]/.test(source[start - 2] ?? "")
  ) return true;
  return after === ":" && /[A-Za-z0-9]/.test(source[end + 1] ?? "");
}

function collectLegacyBrandSourceEdits(
  source: string,
  sourceOffset: number,
  edits: TextEdit[],
): void {
  for (const match of source.matchAll(LEGACY_BRAND_SOURCE_PATTERN)) {
    const start = match.index;
    const end = start + match[0].length;
    if (isTechnicalBrandOccurrence(source, start, end)) continue;
    edits.push({
      start: sourceOffset + start,
      end: sourceOffset + end,
      replacement: CURRENT_BRAND,
    });
  }
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

function parseMarkdown(markdown: string): MarkdownNode | undefined {
  try {
    return unified()
      .use(remarkParse)
      .use(remarkGfm)
      .parse(markdown) as unknown as MarkdownNode;
  } catch {
    return undefined;
  }
}

function collectMarkdownTextEdits(
  node: MarkdownNode,
  markdown: string,
  edits: TextEdit[],
  sourceOffset = 0,
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
    && !isDisplayedUrl
    && typeof start === "number"
    && typeof end === "number"
  ) {
    collectLegacyBrandSourceEdits(
      markdown.slice(start, end),
      start + sourceOffset,
      edits,
    );
  }

  for (const child of node.children ?? []) {
    collectMarkdownTextEdits(
      child,
      markdown,
      edits,
      sourceOffset,
      currentLinkUrl,
    );
  }
}

function markdownReferenceLabelRange(
  node: MarkdownNode,
  markdown: string,
): TextRange | undefined {
  if (node.type !== "linkReference" && node.type !== "imageReference") {
    return undefined;
  }
  const start = node.position?.start?.offset;
  const end = node.position?.end?.offset;
  if (typeof start !== "number" || typeof end !== "number") return undefined;
  const source = markdown.slice(start, end);
  const labelStart = node.type === "imageReference" ? 2 : 1;
  if (!source.startsWith(node.type === "imageReference" ? "![" : "[")) {
    return undefined;
  }

  let nestedBrackets = 0;
  for (let position = labelStart; position < source.length; position += 1) {
    const character = source[position];
    if (isEscaped(source, position)) continue;
    if (character === "[") {
      nestedBrackets += 1;
    } else if (character === "]") {
      if (nestedBrackets === 0) {
        return { start: start + labelStart, end: start + position };
      }
      nestedBrackets -= 1;
    }
  }
  return undefined;
}

function collectMarkdownReferenceExpansionEdit(
  node: MarkdownNode,
  markdown: string,
  edits: TextEdit[],
): void {
  if (node.referenceType !== "shortcut" && node.referenceType !== "collapsed") return;
  const labelRange = markdownReferenceLabelRange(node, markdown);
  const end = node.position?.end?.offset;
  if (labelRange === undefined || typeof end !== "number") return;
  const labelChanges = edits.some((edit) =>
    edit.start >= labelRange.start
    && edit.end <= labelRange.end
    && edit.replacement === CURRENT_BRAND);
  if (!labelChanges) return;

  const explicitIdentifier = `[${markdown.slice(labelRange.start, labelRange.end)}]`;
  if (node.referenceType === "shortcut") {
    edits.push({ start: end, end, replacement: explicitIdentifier });
    return;
  }
  if (markdown.slice(end - 2, end) === "[]") {
    edits.push({ start: end - 2, end, replacement: explicitIdentifier });
  }
}

function collectMarkdownMetadataEdits(
  node: MarkdownNode,
  markdown: string,
  edits: TextEdit[],
): void {
  const imageAltRange = markdownImageAltRange(node, markdown);
  if (imageAltRange !== undefined) {
    const altSource = markdown.slice(imageAltRange.start, imageAltRange.end);
    const altTree = parseMarkdown(altSource);
    if (altTree !== undefined) {
      collectMarkdownTextEdits(altTree, altSource, edits, imageAltRange.start);
    }
  }

  const titleRange = markdownTitleRange(node, markdown);
  if (titleRange !== undefined) {
    collectLegacyBrandSourceEdits(
      markdown.slice(titleRange.start, titleRange.end),
      titleRange.start,
      edits,
    );
  }

  collectMarkdownReferenceExpansionEdit(node, markdown, edits);

  for (const child of node.children ?? []) {
    collectMarkdownMetadataEdits(child, markdown, edits);
  }
}

export function normalizeLegacyMarkdownBranding(markdown: string): string {
  if (
    !HAS_LEGACY_BRAND_SOURCE_PATTERN.test(markdown)
  ) return markdown;

  const tree = parseMarkdown(markdown);
  if (tree === undefined) return markdown;

  const edits: TextEdit[] = [];
  collectMarkdownTextEdits(tree, markdown, edits);
  collectMarkdownMetadataEdits(tree, markdown, edits);
  let result = markdown;
  for (const { start, end, replacement } of edits.sort((left, right) =>
    right.start - left.start || right.end - left.end)) {
    result = `${result.slice(0, start)}${replacement}${result.slice(end)}`;
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
    const searchTerms = legacyBrandTermsWithAlias(page.searchTerms);
    const changed = title !== page.title
      || summary !== page.summary
      || searchTerms !== page.searchTerms;
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
  return records.map((record) => {
    if (record.kind === "symbol") return record;
    return {
      ...record,
      title: normalizeLegacyBrandText(record.title),
      ...(record.summary === undefined
        ? {}
        : { summary: normalizeLegacyBrandText(record.summary) }),
      ...(record.content === undefined
        ? {}
        : { content: normalizeLegacyMarkdownBranding(record.content) }),
      terms: legacyBrandTermsWithAlias(record.terms),
      businessTerms: record.businessTerms.map((term) =>
        term === LEGACY_BRAND ? CURRENT_BRAND : term),
    };
  });
}

/** Preserve shared bodies; only pages with historical prose need Markdown rewriting. */
export function normalizeLegacySearchArtifactBranding(
  records: readonly WikiSearchRecordV2[],
  contentLines?: readonly string[],
): { records: WikiSearchRecordV2[]; contentLines?: readonly string[] } {
  const normalized = normalizeLegacySearchRecordsBranding(records);
  if (contentLines === undefined) return { records: normalized };
  const legacyLineIds = new Set<number>();
  contentLines.forEach((line, id) => { if (HAS_LEGACY_BRAND_SOURCE_PATTERN.test(line)) legacyLineIds.add(id); });
  if (legacyLineIds.size === 0) return { records: normalized, contentLines };
  let updatedLines: string[] | undefined;
  let lineIds: Map<string, number> | undefined;
  const rewritten = normalized.map((record) => {
    if (record.contentLineIds === undefined || !record.contentLineIds.some((id) => legacyLineIds.has(id))) return record;
    // Markdown context (including code fences) belongs to a page, not a shared
    // line. Materialize only this historical page and immediately re-intern it.
    const original = record.contentLineIds.map((id) => contentLines[id]!).join("\n");
    const content = normalizeLegacyMarkdownBranding(original);
    if (content === original) return record;
    updatedLines ??= [...contentLines];
    lineIds ??= new Map(updatedLines.map((line, id) => [line, id]));
    return { ...record, contentLineIds: content.split("\n").map((line) => {
      let id = lineIds!.get(line);
      if (id === undefined) { id = updatedLines!.length; updatedLines!.push(line); lineIds!.set(line, id); }
      return id;
    }) };
  });
  return { records: rewritten, contentLines: updatedLines ?? contentLines };
}
