export interface MarkdownQualityOptions {
  path: string;
  sections: readonly string[];
  sourceEvidenceRefs?: string[];
  coveredFunctionNodeIds?: string[];
  coveredClassNodeIds?: string[];
}

export interface MarkdownQualitySummary {
  checked: number;
  failed: string[];
  warnings: string[];
}

export interface MarkdownQualitySummaryOptions {
  sections?: readonly string[];
}

export interface MarkdownQualityDocument {
  path?: string;
  category?: string;
  content?: string;
  markdown?: string;
  sections?: readonly string[];
  sourceEvidenceRefs?: string[];
  coveredFunctionNodeIds?: string[];
  coveredClassNodeIds?: string[];
}

const GENERIC_FILLER = [
  "承担核心逻辑",
  "承担该文件中的一段核心逻辑",
  "处理相关能力",
  "未在图谱中识别",
  "接收上游传入的业务上下文",
  "同文件内的协作单元",
  "主要把处理结果返回给调用方",
  "候选数据为空、配置缺失",
  "需要重点检查条件分支、排序或过滤规则",
] as const;

const MIN_SECTION_BODY_CHARS = 16;
const MAX_UNIQUE_GENERIC_FILLER = 3;
const MAX_TOTAL_GENERIC_FILLER_OCCURRENCES = 4;
const MIN_REPEATED_LINE_CHARS = 32;
const MIN_REPEATED_DOCUMENTS = 5;
const REPEATED_DOCUMENT_RATIO = 0.2;
const MAX_REPEATED_LINES_BEFORE_FAILURE = 3;
const PLACEHOLDER_PROSE_RE = /\b(TBD|TODO|FIXME)\b|待\s*定|占\s*位|后续\s*补充|这里\s*填写/i;

export function containsPlaceholderProse(markdown: string): boolean {
  const proseOnly = markdown
    .replace(/```[\s\S]*?(?:```|$)/g, "")
    .replace(/`[^`\n]*`/g, "");
  return PLACEHOLDER_PROSE_RE.test(proseOnly);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function sectionBody(markdown: string, section: string): string {
  const heading = new RegExp(`^${escapeRegExp(section)}\\s*$`, "m");
  const match = heading.exec(markdown);
  if (!match) return "";
  const rest = markdown.slice(match.index + match[0].length);
  const nextHeadingIndex = rest.search(/^##\s/m);
  return (nextHeadingIndex >= 0 ? rest.slice(0, nextHeadingIndex) : rest).trim();
}

function genericFillerOccurrences(markdown: string): { unique: number; total: number } {
  let unique = 0;
  let total = 0;
  for (const phrase of GENERIC_FILLER) {
    const matches = markdown.match(new RegExp(escapeRegExp(phrase), "g")) ?? [];
    if (matches.length > 0) unique += 1;
    total += matches.length;
  }
  return { unique, total };
}

function hasGenericFillerText(markdown: string): boolean {
  return genericFillerOccurrences(markdown).total > 0;
}

function hasTooMuchGenericFiller(markdown: string): boolean {
  const occurrences = genericFillerOccurrences(markdown);
  return occurrences.unique >= MAX_UNIQUE_GENERIC_FILLER || occurrences.total >= MAX_TOTAL_GENERIC_FILLER_OCCURRENCES;
}

function meaningfulCharacterCount(body: string): number {
  return body.replace(/[`*_#>\-\s|:：,，.。;；、()[\]{}]/g, "").length;
}

function hasSubstantiveSectionBody(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return false;
  if (meaningfulCharacterCount(trimmed) < MIN_SECTION_BODY_CHARS) return false;

  const hasChineseText = /\p{Script=Han}/u.test(trimmed);
  const tokens = trimmed.split(/[\s`*_#>\-:：,，.。;；、()[\]{}|/\\]+/).filter(Boolean);
  return hasChineseText || tokens.length > 1;
}

function normalizeEvidenceText(value: string): string {
  return value.replace(/`/g, "");
}

function isSourceFilePathRef(ref: string): boolean {
  const normalized = normalizeEvidenceText(ref);
  return !/^(?:function|class|method|file|topic):/.test(normalized) && /[/\\]/.test(normalized);
}

function includesSourceEvidencePath(markdown: string, refs: readonly string[]): boolean {
  const normalizedMarkdown = normalizeEvidenceText(markdown);
  const filePathRefs = refs.map(normalizeEvidenceText).filter(isSourceFilePathRef);
  const refsToCheck = filePathRefs.length > 0 ? filePathRefs : refs.map(normalizeEvidenceText);
  return refsToCheck.some((ref) => normalizedMarkdown.includes(ref));
}

function hasEvidenceExplanation(markdown: string, refs: readonly string[]): boolean {
  let remaining = normalizeEvidenceText(markdown);
  const refsByLength = [...new Set(refs.map(normalizeEvidenceText))].sort((a, b) => b.length - a.length);
  for (const ref of refsByLength) {
    remaining = remaining.replace(new RegExp(escapeRegExp(ref), "g"), "");
  }
  return meaningfulCharacterCount(remaining) >= MIN_SECTION_BODY_CHARS;
}

function validateCoveredIds(
  body: string,
  nodeIds: readonly string[] | undefined,
  path: string,
  label: "function" | "class",
  errors: string[],
): void {
  for (const nodeId of nodeIds ?? []) {
    if (!body.includes(nodeId)) {
      errors.push(`${path} missing covered ${label} id: ${nodeId}`);
    }
  }
}

export function validateMarkdownQuality(markdown: string, options: MarkdownQualityOptions): string[] {
  const errors: string[] = [];

  if (hasTooMuchGenericFiller(markdown)) {
    errors.push(`${options.path} has too much generic filler text`);
  }

  for (const section of options.sections) {
    if (!hasSubstantiveSectionBody(sectionBody(markdown, section))) {
      errors.push(`${options.path} section has too little detail: ${section}`);
    }
  }

  const sourceEvidenceRefs = options.sourceEvidenceRefs ?? [];
  if (sourceEvidenceRefs.length > 0) {
    const evidenceBody = sectionBody(markdown, "## 代码证据");
    if (!includesSourceEvidencePath(evidenceBody, sourceEvidenceRefs) || !hasEvidenceExplanation(evidenceBody, sourceEvidenceRefs)) {
      errors.push(`${options.path} does not explain enough source evidence`);
    }
  }

  if (options.sections.includes("## 函数卡片")) {
    validateCoveredIds(sectionBody(markdown, "## 函数卡片"), options.coveredFunctionNodeIds, options.path, "function", errors);
  }
  if (options.sections.includes("## 类卡片")) {
    validateCoveredIds(sectionBody(markdown, "## 类卡片"), options.coveredClassNodeIds, options.path, "class", errors);
  }

  return errors;
}

function markdownSections(markdown: string): string[] {
  return [...markdown.matchAll(/^##\s+.+$/gm)].map((match) => match[0].trim());
}

function repeatedLineCandidates(markdown: string): string[] {
  const candidates = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line || line.startsWith("#") || line.startsWith("|") || line.startsWith("```")) return false;
      return meaningfulCharacterCount(line) >= MIN_REPEATED_LINE_CHARS;
    });
  return [...new Set(candidates)];
}

function appendWarning(summary: MarkdownQualitySummary, warning: string): void {
  if (!summary.warnings.includes(warning)) summary.warnings.push(warning);
}

function isSideChannelDocument(document: MarkdownQualityDocument, path: string): boolean {
  return document.category === "index"
    || document.category === "report"
    || path === "目录.md"
    || path === "覆盖报告.md"
    || path === "质量报告.md"
    || path.startsWith("索引/");
}

export function summarizeMarkdownQuality(
  documents: readonly MarkdownQualityDocument[],
  options: MarkdownQualitySummaryOptions = {},
): MarkdownQualitySummary {
  const summary: MarkdownQualitySummary = {
    checked: 0,
    failed: [],
    warnings: [],
  };

  documents.forEach((document, index) => {
    summary.checked += 1;
    const path = document.path ?? `documents[${index}]`;
    const markdown = document.content ?? document.markdown ?? "";
    const sections = document.sections ?? options.sections ?? markdownSections(markdown);
    const sideChannel = isSideChannelDocument(document, path);
    const errors = sideChannel
      ? []
      : validateMarkdownQuality(markdown, {
          path,
          sections,
          sourceEvidenceRefs: document.sourceEvidenceRefs,
          coveredFunctionNodeIds: document.coveredFunctionNodeIds,
          coveredClassNodeIds: document.coveredClassNodeIds,
        });
    if (!sideChannel && sections.length === 0) {
      errors.push(`${path} has no substantive markdown sections`);
    }
    if (!sideChannel && hasGenericFillerText(markdown)) {
      appendWarning(summary, `document has generic filler text: ${path}`);
    }
    if (errors.length > 0) {
      summary.failed.push(path);
      appendWarning(summary, `document failed quality validation: ${path}`);
    }
  });

  const repeatedLineDocuments = new Map<string, Set<number>>();
  documents.forEach((document, index) => {
    const path = document.path ?? `documents[${index}]`;
    if (isSideChannelDocument(document, path)) return;
    const markdown = document.content ?? document.markdown ?? "";
    for (const line of repeatedLineCandidates(markdown)) {
      const indexes = repeatedLineDocuments.get(line) ?? new Set<number>();
      indexes.add(index);
      repeatedLineDocuments.set(line, indexes);
    }
  });

  const proseDocumentCount = documents.filter((document, index) => {
    const path = document.path ?? `documents[${index}]`;
    return !isSideChannelDocument(document, path);
  }).length;
  const repeatedThreshold = Math.max(
    MIN_REPEATED_DOCUMENTS,
    Math.ceil(proseDocumentCount * REPEATED_DOCUMENT_RATIO),
  );
  const repeatedLinesByDocument = new Map<number, number>();
  for (const indexes of repeatedLineDocuments.values()) {
    if (indexes.size < repeatedThreshold) continue;
    for (const index of indexes) {
      repeatedLinesByDocument.set(index, (repeatedLinesByDocument.get(index) ?? 0) + 1);
    }
  }

  for (const [index, repeatedLines] of repeatedLinesByDocument) {
    const path = documents[index]?.path ?? `documents[${index}]`;
    appendWarning(summary, `document repeats ${repeatedLines} boilerplate lines across corpus: ${path}`);
    if (repeatedLines < MAX_REPEATED_LINES_BEFORE_FAILURE) continue;
    if (!summary.failed.includes(path)) summary.failed.push(path);
    appendWarning(summary, `document failed quality validation: ${path}`);
  }

  return summary;
}
