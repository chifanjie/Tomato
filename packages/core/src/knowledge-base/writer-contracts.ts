import type {
  FileWriterBatchOutput,
  FileWriterDocument,
  TopicWriterBatchOutput,
  TopicWriterDocument,
} from "./types.js";
import { validateMarkdownQuality } from "./quality.js";

export type ContractParseResult<T> =
  | { ok: true; value: T; errors: [] }
  | { ok: false; value?: undefined; errors: string[] };

export const FILE_WRITER_REQUIRED_SECTIONS = [
  "## 非技术同学速读",
  "## 文件职责",
  "## 业务问题与影响对象",
  "## 所属位置",
  "## 文件内结构",
  "## 关键规则、输入输出与兜底",
  "## 函数卡片",
  "## 类卡片",
  "## 调用关系",
  "## 风险点与待确认项",
  "## 代码证据",
  "## AI 检索词",
] as const;

export const TOPIC_WRITER_REQUIRED_SECTIONS = [
  "## 非技术同学速读",
  "## 为什么关键",
  "## 在业务流程中的位置",
  "## 主要输入、输出、副作用",
  "## 关键分支和算法",
  "## 配置和外部依赖",
  "## 上游调用者",
  "## 下游调用对象",
  "## 修改风险",
  "## 测试证据",
  "## 代码证据",
  "## AI 检索词",
] as const;

const PLACEHOLDER_RE = /\b(T[B]D|TO[D]O|FIX[M]E)\b|待\s*定|占\s*位|后续\s*补充|这里\s*填写/i;

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

function validateNoPlaceholderText(value: unknown, path: string, errors: string[]): void {
  if (typeof value === "string" && PLACEHOLDER_RE.test(value)) {
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
  }
}

function validateSourceEvidence(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  requireString(value, "filePath", path, errors);
  if ("nodeId" in value && typeof value.nodeId !== "string") {
    errors.push(`${path}.nodeId must be a string`);
  }
  if ("excerpt" in value && typeof value.excerpt !== "string") {
    errors.push(`${path}.excerpt must be a string`);
  }
  if ("lineRange" in value) {
    validateLineRange(value.lineRange, `${path}.lineRange`, errors);
  }
}

function validStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function sourceEvidenceRefs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.filePath !== "string") return [];

    const refs: string[] = [];
    if (typeof item.nodeId === "string") {
      refs.push(item.nodeId);
    }
    if (
      Array.isArray(item.lineRange)
      && item.lineRange.length === 2
      && item.lineRange.every((line) => typeof line === "number" && Number.isFinite(line))
    ) {
      refs.push(`${item.filePath}:${item.lineRange[0]}-${item.lineRange[1]}`);
    }
    if (refs.length === 0) {
      refs.push(item.filePath);
    }
    return refs;
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
  requireString(value, "title", path, errors);
  requireStringArray(value, "coveredFunctionNodeIds", path, errors);
  requireStringArray(value, "coveredClassNodeIds", path, errors);
  requireStringArray(value, "representedEdgeIds", path, errors);
  const sourceEvidence = requireArray(value, "sourceEvidence", path, errors);
  sourceEvidence?.forEach((item, evidenceIndex) => {
    validateSourceEvidence(item, `${path}.sourceEvidence[${evidenceIndex}]`, errors);
  });
  requireStringArray(value, "importantNodeIds", path, errors);
  requireString(value, "markdown", path, errors);
  requireSections(value.markdown, FILE_WRITER_REQUIRED_SECTIONS, `${path}.markdown`, errors);
  validateNoPlaceholderText(value.markdown, `${path}.markdown`, errors);
  if (typeof value.markdown === "string") {
    errors.push(
      ...validateMarkdownQuality(value.markdown, {
        path: `${path}.markdown`,
        sections: FILE_WRITER_REQUIRED_SECTIONS,
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
  const evidence = requireArray(value, "evidence", path, errors);
  evidence?.forEach((item, evidenceIndex) => {
    validateSourceEvidence(item, `${path}.evidence[${evidenceIndex}]`, errors);
  });
  requireString(value, "markdown", path, errors);
  requireSections(value.markdown, TOPIC_WRITER_REQUIRED_SECTIONS, `${path}.markdown`, errors);
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
