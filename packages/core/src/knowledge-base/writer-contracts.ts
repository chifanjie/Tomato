import type {
  FileWriterBatchOutput,
  FileWriterDocument,
  TopicWriterBatchOutput,
  TopicWriterDocument,
} from "./types.js";
import { REQUIRED_SECTIONS } from "./publication-quality.js";
import { containsPlaceholderProse, sectionBody, validateMarkdownQuality } from "./quality.js";

export type ContractParseResult<T> =
  | { ok: true; value: T; errors: [] }
  | { ok: false; value?: undefined; errors: string[] };

function withHeadingPrefix(sections: readonly string[]): string[] {
  return sections.map((section) => `## ${section}`);
}

export const FILE_WRITER_REQUIRED_SECTIONS_BY_KIND = {
  code: withHeadingPrefix(REQUIRED_SECTIONS["file:code"]),
  configuration: withHeadingPrefix(REQUIRED_SECTIONS["file:configuration"]),
  schema: withHeadingPrefix(REQUIRED_SECTIONS["file:schema"]),
  documentation: withHeadingPrefix(REQUIRED_SECTIONS["file:documentation"]),
  test: withHeadingPrefix(REQUIRED_SECTIONS["file:test"]),
} as const;

export const FILE_WRITER_REQUIRED_SECTIONS = FILE_WRITER_REQUIRED_SECTIONS_BY_KIND.code;

export const TOPIC_WRITER_REQUIRED_SECTIONS = withHeadingPrefix(REQUIRED_SECTIONS.topic);

const REFERENCE_TEMPLATE_KINDS = ["code", "configuration", "schema", "documentation", "test"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fieldPath(parentPath: string, key: string): string {
  return parentPath ? `${parentPath}.${key}` : key;
}

function requireNumber(record: Record<string, unknown>, key: string, path: string, errors: string[]): void {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${fieldPath(path, key)} must be a number`);
  }
}

function requireString(record: Record<string, unknown>, key: string, path: string, errors: string[]): void {
  const value = record[key];
  if (typeof value !== "string") {
    errors.push(`${fieldPath(path, key)} must be a string`);
  }
}

function requireNonEmptyString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  errors: string[],
): void {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${fieldPath(path, key)} must be a non-empty string`);
  }
}

function requireReferenceKind(record: Record<string, unknown>, path: string, errors: string[]): void {
  if (!REFERENCE_TEMPLATE_KINDS.includes(record.referenceKind as (typeof REFERENCE_TEMPLATE_KINDS)[number])) {
    errors.push(`${fieldPath(path, "referenceKind")} must be one of: ${REFERENCE_TEMPLATE_KINDS.join(", ")}`);
  }
}

function requireArray(record: Record<string, unknown>, key: string, path: string, errors: string[]): unknown[] | undefined {
  const value = record[key];
  if (!Array.isArray(value)) {
    errors.push(`${fieldPath(path, key)} must be an array`);
    return undefined;
  }
  return value;
}

function requireNonEmptyArray(
  record: Record<string, unknown>,
  key: string,
  path: string,
  itemName: string,
  errors: string[],
): unknown[] | undefined {
  const value = requireArray(record, key, path, errors);
  if (value && value.length === 0) {
    errors.push(`${fieldPath(path, key)} must contain at least one ${itemName}`);
  }
  return value;
}

function requireStringArray(record: Record<string, unknown>, key: string, path: string, errors: string[]): void {
  const value = record[key];
  const currentPath = fieldPath(path, key);
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    errors.push(`${currentPath} must be an array of strings`);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasExactSection(markdown: string, section: string): boolean {
  return new RegExp(`^${escapeRegExp(section)}\\s*$`, "m").test(markdown);
}

function requireSections(markdown: unknown, sections: readonly string[], path: string, errors: string[]): void {
  if (typeof markdown !== "string") return;
  for (const section of sections) {
    if (!hasExactSection(markdown, section)) {
      errors.push(`${path} missing required section: ${section}`);
    }
  }
}

function requireSectionTerms(
  markdown: string,
  section: string,
  terms: readonly string[],
  path: string,
  errors: string[],
): void {
  const body = sectionBody(markdown, section);
  for (const term of terms) {
    if (!body.includes(term)) {
      errors.push(`${path} section ${section} missing required field: ${term}`);
    }
  }
}

function validateStructuredWriterSections(markdown: unknown, path: string, errors: string[]): void {
  if (typeof markdown !== "string") return;

  requireSectionTerms(markdown, "## 入口条件与处理顺序", ["入口条件", "处理顺序"], path, errors);
  requireSectionTerms(markdown, "## 字段读写与状态变化", ["读取", "写入", "状态变化"], path, errors);
  requireSectionTerms(markdown, "## 证据分级", ["本地代码事实", "代码推断", "外部待核验"], path, errors);

  const verificationBody = sectionBody(markdown, "## 待核验清单");
  if (!/^\s*- \[ \]\s+\S/m.test(verificationBody)) {
    errors.push(`${path} section ## 待核验清单 must contain at least one unchecked verification item`);
  }

  const aiIndexBody = sectionBody(markdown, "## AI 检索索引");
  for (const column of ["检索意图", "关键词", "定位"]) {
    if (!aiIndexBody.includes(column)) {
      errors.push(`${path} section ## AI 检索索引 missing required column: ${column}`);
    }
  }
  const tableRows = aiIndexBody.split(/\r?\n/).filter((line) => /^\s*\|.*\|\s*$/.test(line));
  if (tableRows.length < 3) {
    errors.push(`${path} section ## AI 检索索引 must contain a header and at least one data row`);
  }
}

function validateNoPlaceholderText(value: unknown, path: string, errors: string[]): void {
  if (typeof value === "string" && containsPlaceholderProse(value)) {
    errors.push(`${path} contains placeholder text`);
  }
}

function validateWarningPlaceholders(value: unknown, errors: string[]): void {
  if (!Array.isArray(value)) return;
  value.forEach((warning, index) => validateNoPlaceholderText(warning, `warnings[${index}]`, errors));
}

function validateLineRange(value: unknown, path: string, errors: string[]): void {
  if (
    !Array.isArray(value)
    || value.length !== 2
    || value.some((item) => typeof item !== "number" || !Number.isFinite(item))
  ) {
    errors.push(`${path} must be a tuple of two finite numbers`);
    return;
  }
  const [start, end] = value;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start <= 0 || end < start) {
    errors.push(`${path} must contain positive ordered integers`);
  }
}

function validateSourceEvidence(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  requireNonEmptyString(value, "filePath", path, errors);
  requireNonEmptyString(value, "nodeId", path, errors);
  requireNonEmptyString(value, "excerpt", path, errors);
  if (typeof value.claim !== "string" || !/\p{Script=Han}/u.test(value.claim)) {
    errors.push(`${path}.claim must contain a concrete Chinese conclusion`);
  }
  validateLineRange(value.lineRange, `${path}.lineRange`, errors);
}

function evidenceNodeIds(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.flatMap((item) => isRecord(item) && typeof item.nodeId === "string" ? [item.nodeId] : []));
}

function validateEvidenceCoverage(
  evidence: unknown,
  directNodeIds: readonly string[],
  path: string,
  errors: string[],
): void {
  const coveredNodeIds = evidenceNodeIds(evidence);
  for (const nodeId of new Set(directNodeIds)) {
    if (!coveredNodeIds.has(nodeId)) errors.push(`${path} missing direct node: ${nodeId}`);
  }
}

function distinctEvidenceGroupCount(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return new Set(value.flatMap((item) => {
    if (!isRecord(item) || typeof item.filePath !== "string" || !Array.isArray(item.lineRange)) return [];
    const [start, end] = item.lineRange;
    return [`${item.filePath}:${String(start)}-${String(end)}`];
  })).size;
}

function validStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function sourceEvidenceRefs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.filePath !== "string") return [];

    const refs = [item.filePath, `\`${item.filePath}\``];
    if (typeof item.nodeId === "string") {
      refs.push(item.nodeId);
    }
    if (
      Array.isArray(item.lineRange)
      && item.lineRange.length === 2
      && item.lineRange.every((line) => typeof line === "number" && Number.isFinite(line))
    ) {
      refs.push(`${item.filePath}:${item.lineRange[0]}-${item.lineRange[1]}`);
      refs.push(`\`${item.filePath}\`:${item.lineRange[0]}-${item.lineRange[1]}`);
    }
    return [...new Set(refs)];
  });
}

function validateFileWriterDocument(value: unknown, index: number, errors: string[]): void {
  const path = `documents[${index}]`;
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  requireString(value, "fileNodeId", path, errors);
  requireString(value, "filePath", path, errors);
  requireString(value, "documentPath", path, errors);
  requireReferenceKind(value, path, errors);
  requireString(value, "title", path, errors);
  requireStringArray(value, "coveredFunctionNodeIds", path, errors);
  requireStringArray(value, "coveredClassNodeIds", path, errors);
  requireStringArray(value, "representedEdgeIds", path, errors);
  const sourceEvidence = requireNonEmptyArray(value, "sourceEvidence", path, "evidence item", errors);
  sourceEvidence?.forEach((item, evidenceIndex) => {
    validateSourceEvidence(item, `${path}.sourceEvidence[${evidenceIndex}]`, errors);
  });
  validateEvidenceCoverage(
    value.sourceEvidence,
    [
      ...(typeof value.fileNodeId === "string" ? [value.fileNodeId] : []),
      ...validStringArray(value.coveredFunctionNodeIds),
      ...validStringArray(value.coveredClassNodeIds),
    ],
    `${path}.sourceEvidence`,
    errors,
  );
  requireStringArray(value, "importantNodeIds", path, errors);
  requireString(value, "markdown", path, errors);
  const requiredSections = FILE_WRITER_REQUIRED_SECTIONS_BY_KIND[
    value.referenceKind as keyof typeof FILE_WRITER_REQUIRED_SECTIONS_BY_KIND
  ];
  requireSections(value.markdown, requiredSections ?? [], `${path}.markdown`, errors);
  if (typeof value.markdown === "string" && hasExactSection(value.markdown, "## 待核验清单")) {
    validateStructuredWriterSections(value.markdown, `${path}.markdown`, errors);
  }
  validateNoPlaceholderText(value.markdown, `${path}.markdown`, errors);
  if (typeof value.markdown === "string") {
    errors.push(
      ...validateMarkdownQuality(value.markdown, {
        path: `${path}.markdown`,
        sections: requiredSections ?? [],
        sourceEvidenceRefs: sourceEvidenceRefs(value.sourceEvidence),
        coveredFunctionNodeIds: validStringArray(value.coveredFunctionNodeIds),
        coveredClassNodeIds: validStringArray(value.coveredClassNodeIds),
      }),
    );
  }
}

function validateTopicWriterDocument(value: unknown, index: number, errors: string[]): void {
  const path = `topics[${index}]`;
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  requireString(value, "topicNodeId", path, errors);
  requireString(value, "sourceFileNodeId", path, errors);
  requireString(value, "documentPath", path, errors);
  requireString(value, "title", path, errors);
  requireStringArray(value, "coveredNodeIds", path, errors);
  requireString(value, "linkedFileDocumentPath", path, errors);
  const evidence = requireNonEmptyArray(value, "evidence", path, "evidence item", errors);
  evidence?.forEach((item, evidenceIndex) => {
    validateSourceEvidence(item, `${path}.evidence[${evidenceIndex}]`, errors);
  });
  if (evidence && distinctEvidenceGroupCount(evidence) < 3) {
    errors.push(`${path}.evidence must contain at least three distinct source groups`);
  }
  if (typeof value.topicNodeId === "string" && !evidenceNodeIds(evidence).has(value.topicNodeId)) {
    errors.push(`${path}.evidence must include topic node: ${value.topicNodeId}`);
  }
  requireString(value, "markdown", path, errors);
  requireSections(value.markdown, TOPIC_WRITER_REQUIRED_SECTIONS, `${path}.markdown`, errors);
  if (typeof value.markdown === "string" && hasExactSection(value.markdown, "## 待核验清单")) {
    validateStructuredWriterSections(value.markdown, `${path}.markdown`, errors);
  }
  validateNoPlaceholderText(value.markdown, `${path}.markdown`, errors);
  if (typeof value.markdown === "string") {
    errors.push(
      ...validateMarkdownQuality(value.markdown, {
        path: `${path}.markdown`,
        sections: TOPIC_WRITER_REQUIRED_SECTIONS,
        sourceEvidenceRefs: sourceEvidenceRefs(value.evidence),
      }),
    );
  }
}

function validateCommonBatchShape(value: unknown, warningsPath: string, errors: string[]): value is Record<string, unknown> {
  if (!isRecord(value)) {
    errors.push("value must be an object");
    return false;
  }
  requireNumber(value, "batchIndex", "", errors);
  requireStringArray(value, warningsPath, "", errors);
  return true;
}

export function parseFileWriterBatchOutput(value: unknown): ContractParseResult<FileWriterBatchOutput> {
  const errors: string[] = [];
  if (validateCommonBatchShape(value, "warnings", errors)) {
    validateWarningPlaceholders(value.warnings, errors);
    const documents = requireNonEmptyArray(value, "documents", "", "document", errors);
    documents?.forEach((document, index) => validateFileWriterDocument(document, index, errors));
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: value as FileWriterBatchOutput, errors: [] };
}

export function parseTopicWriterBatchOutput(value: unknown): ContractParseResult<TopicWriterBatchOutput> {
  const errors: string[] = [];
  if (validateCommonBatchShape(value, "warnings", errors)) {
    validateWarningPlaceholders(value.warnings, errors);
    const topics = requireNonEmptyArray(value, "topics", "", "topic", errors);
    topics?.forEach((topic, index) => validateTopicWriterDocument(topic, index, errors));
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: value as TopicWriterBatchOutput, errors: [] };
}

export type { FileWriterBatchOutput, FileWriterDocument, TopicWriterBatchOutput, TopicWriterDocument };
