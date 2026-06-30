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

interface MarkdownQualityDocument {
  markdown: string;
  path?: string;
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

function uniqueGenericFillerCount(markdown: string): number {
  return GENERIC_FILLER.filter((phrase) => markdown.includes(phrase)).length;
}

function includesAnyEvidenceRef(markdown: string, refs: readonly string[]): boolean {
  return refs.some((ref) => markdown.includes(ref));
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

  if (uniqueGenericFillerCount(markdown) >= 3) {
    errors.push(`${options.path} has too much generic filler text`);
  }

  const sourceEvidenceRefs = options.sourceEvidenceRefs ?? [];
  if (sourceEvidenceRefs.length > 0) {
    const evidenceBody = sectionBody(markdown, "## 代码证据");
    if (!includesAnyEvidenceRef(evidenceBody, sourceEvidenceRefs)) {
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

export function summarizeMarkdownQuality(documents: readonly MarkdownQualityDocument[]): MarkdownQualitySummary {
  const summary: MarkdownQualitySummary = {
    checked: 0,
    failed: [],
    warnings: [],
  };

  documents.forEach((document, index) => {
    summary.checked += 1;
    const path = document.path ?? `documents[${index}].markdown`;
    const errors = validateMarkdownQuality(document.markdown, {
      path,
      sections: document.sections ?? [],
      sourceEvidenceRefs: document.sourceEvidenceRefs,
      coveredFunctionNodeIds: document.coveredFunctionNodeIds,
      coveredClassNodeIds: document.coveredClassNodeIds,
    });
    summary.failed.push(...errors);
  });

  return summary;
}
