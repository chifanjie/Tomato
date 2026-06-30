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
  content?: string;
  markdown?: string;
  sections?: readonly string[];
  sourceEvidenceRefs?: string[];
  coveredFunctionNodeIds?: string[];
  coveredClassNodeIds?: string[];
}

const GENERIC_FILLER = [
  "承担核心逻辑",
  "处理相关能力",
  "本地代码事实",
  "未在图谱中识别",
  "根据代码推断，需线上配置确认",
] as const;

const MIN_SECTION_BODY_CHARS = 12;
const MAX_UNIQUE_GENERIC_FILLER = 3;
const MAX_TOTAL_GENERIC_FILLER_OCCURRENCES = 4;

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
    const errors = validateMarkdownQuality(markdown, {
      path,
      sections: document.sections ?? options.sections ?? markdownSections(markdown),
      sourceEvidenceRefs: document.sourceEvidenceRefs,
      coveredFunctionNodeIds: document.coveredFunctionNodeIds,
      coveredClassNodeIds: document.coveredClassNodeIds,
    });
    if (hasGenericFillerText(markdown)) {
      summary.warnings.push(`document has generic filler text: ${path}`);
    }
    if (errors.length > 0) {
      summary.failed.push(path);
      summary.warnings.push(`document failed quality validation: ${path}`);
    }
  });

  return summary;
}
