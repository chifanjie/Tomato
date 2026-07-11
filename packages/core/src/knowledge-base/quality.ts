import type {
  KnowledgeDocumentCategory,
  KnowledgeDocumentRole,
  ReferenceTemplateKind,
  SourceEvidence,
  SymbolAnchor,
} from "./types.js";
import {
  containsGenericPublicationPhrase,
  evaluatePublicationCorpus,
  isValidPublicationEvidence,
  maskMarkdownCode,
  type PublicationCorpusEntry,
  type PublicationEvidence,
} from "./publication-quality.js";

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
  role?: KnowledgeDocumentRole;
  referenceKind?: ReferenceTemplateKind;
  directNodeIds?: string[];
  representedEdgeIds?: string[];
  symbolAnchors?: SymbolAnchor[];
  sourceEvidence?: SourceEvidence[];
  quality?: "verified" | "generated" | "needs-review" | "failed";
  qualityIssues?: string[];
}

const MIN_SECTION_BODY_CHARS = 16;
const PLACEHOLDER_PROSE_RE = /\b(TBD|TODO|FIXME)\b|待\s*定|占\s*位|后续\s*补充|这里\s*填写/i;

export function containsPlaceholderProse(markdown: string): boolean {
  const proseOnly = maskMarkdownCode(markdown);
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

  if (containsGenericPublicationPhrase(markdown)) {
    errors.push(`${options.path} has too much generic filler text`);
  }

  for (const section of options.sections) {
    if (!hasSubstantiveSectionBody(sectionBody(markdown, section))) {
      errors.push(`${options.path} section has too little detail: ${section}`);
    }
  }

  const sourceEvidenceRefs = options.sourceEvidenceRefs ?? [];
  if (sourceEvidenceRefs.length > 0) {
    const evidenceSection = /^## 源码证据\s*$/m.test(markdown) ? "## 源码证据" : "## 代码证据";
    const evidenceBody = sectionBody(markdown, evidenceSection);
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

  const alreadyEvaluated = documents.every((document, index) => {
    const path = document.path ?? `documents[${index}]`;
    return isSideChannelDocument(document, path) || typeof document.quality === "string";
  });
  if (alreadyEvaluated) {
    documents.forEach((document, index) => {
      summary.checked += 1;
      const path = document.path ?? `documents[${index}]`;
      if (isSideChannelDocument(document, path)) return;
      const issues = document.qualityIssues ?? [];
      if (issues.includes("正文包含空泛模板语句")) {
        appendWarning(summary, `document has generic filler text: ${path}`);
      }
      if (issues.includes("正文包含跨文档重复模板语句")) {
        appendWarning(summary, `document contains repeated boilerplate across corpus: ${path}`);
      }
      if (document.quality === "failed" || document.quality === "needs-review") {
        summary.failed.push(path);
        appendWarning(summary, `document failed quality validation: ${path}`);
      }
    });
    return summary;
  }

  const categoryValues = new Set<KnowledgeDocumentCategory>([
    "overview", "capability", "flow", "module", "topic", "file", "quality", "coverage", "other",
  ]);
  const proseDocuments = documents.flatMap((document, index) => {
    const path = document.path ?? `documents[${index}]`;
    summary.checked += 1;
    if (isSideChannelDocument(document, path)) return [];
    const markdown = document.content ?? document.markdown ?? "";
    const category = categoryValues.has(document.category as KnowledgeDocumentCategory)
      ? document.category as KnowledgeDocumentCategory
      : "other";
    const evidence = publicationEvidenceForCompatibility(document, markdown, path);
    const entry: PublicationCorpusEntry = {
      document: {
        path,
        title: markdown.match(/^#\s+(.+)$/m)?.[1] ?? path,
        category,
        role: document.role ?? "reference",
        content: markdown,
        directNodeIds: document.directNodeIds ?? [],
        representedEdgeIds: document.representedEdgeIds ?? [],
        symbolAnchors: document.symbolAnchors ?? [],
        ...(document.referenceKind ? { referenceKind: document.referenceKind } : {}),
      },
      evidence,
    };
    return [{ document, path, markdown, entry }];
  });

  const corpusResults = evaluatePublicationCorpus(proseDocuments.map((item) => item.entry));
  corpusResults.forEach((result, index) => {
    const source = proseDocuments[index];
    const sections = source.document.sections ?? options.sections ?? markdownSections(source.markdown);
    const structuralErrors = validateMarkdownQuality(source.markdown, {
      path: source.path,
      sections,
      sourceEvidenceRefs: source.document.sourceEvidenceRefs,
      coveredFunctionNodeIds: source.document.coveredFunctionNodeIds,
      coveredClassNodeIds: source.document.coveredClassNodeIds,
    });
    if (sections.length === 0) structuralErrors.push(`${source.path} has no substantive markdown sections`);
    if (result.decision.issues.includes("正文包含空泛模板语句")) {
      appendWarning(summary, `document has generic filler text: ${source.path}`);
    }
    if (result.decision.issues.includes("正文包含跨文档重复模板语句")) {
      appendWarning(summary, `document contains repeated boilerplate across corpus: ${source.path}`);
    }
    if (result.decision.quality !== "generated" || structuralErrors.length > 0) {
      summary.failed.push(source.path);
      appendWarning(summary, `document failed quality validation: ${source.path}`);
    }
  });

  return summary;
}

function publicationEvidenceForCompatibility(
  document: MarkdownQualityDocument,
  markdown: string,
  path: string,
): PublicationEvidence[] {
  const direct = (document.sourceEvidence ?? []).flatMap((item) => {
    const candidate = item as PublicationEvidence;
    return isValidPublicationEvidence(candidate) ? [candidate] : [];
  });
  if (direct.length > 0) return direct;
  const ref = document.sourceEvidenceRefs?.[0]?.replace(/`/g, "").split(":", 1)[0];
  const excerpt = markdown.split(/\r?\n/).find((line) => line.trim() && !line.startsWith("#"))?.trim();
  if (!ref || !excerpt) return [];
  return [{
    nodeId: `compat:${path}`,
    filePath: ref,
    lineRange: [1, 1],
    excerpt,
    claim: `来源“${ref}:1”记录兼容质量检查使用的实际正文摘录。`,
  }];
}
