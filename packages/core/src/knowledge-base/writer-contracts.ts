import type {
  FileWriterBatchOutput,
  FileWriterDocument,
  TopicWriterBatchOutput,
  TopicWriterDocument,
} from "./types.js";

export type ContractParseResult<T> =
  | { ok: true; value: T; errors: [] }
  | { ok: false; value?: undefined; errors: string[] };

export const FILE_WRITER_REQUIRED_SECTIONS = [
  "## 文件职责",
  "## 所属位置",
  "## 文件内结构",
  "## 函数卡片",
  "## 类卡片",
  "## 调用关系",
  "## 风险点与待确认项",
  "## AI 检索词",
] as const;

export const TOPIC_WRITER_REQUIRED_SECTIONS = [
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

function collectPlaceholderErrors(value: unknown, path: string, errors: string[]): void {
  if (typeof value === "string") {
    if (PLACEHOLDER_RE.test(value)) {
      errors.push(`${path || "value"} contains placeholder text`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectPlaceholderErrors(item, `${path}[${index}]`, errors));
    return;
  }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      collectPlaceholderErrors(child, fieldPath(path, key), errors);
    }
  }
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
  requireArray(value, "sourceEvidence", path, errors);
  requireStringArray(value, "importantNodeIds", path, errors);
  requireString(value, "markdown", path, errors);
  requireSections(value.markdown, FILE_WRITER_REQUIRED_SECTIONS, `${path}.markdown`, errors);
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
  requireArray(value, "evidence", path, errors);
  requireString(value, "markdown", path, errors);
  requireSections(value.markdown, TOPIC_WRITER_REQUIRED_SECTIONS, `${path}.markdown`, errors);
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
    const documents = requireArray(value, "documents", "", errors);
    documents?.forEach((document, index) => validateFileWriterDocument(document, index, errors));
  }
  collectPlaceholderErrors(value, "", errors);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: value as FileWriterBatchOutput, errors: [] };
}

export function parseTopicWriterBatchOutput(value: unknown): ContractParseResult<TopicWriterBatchOutput> {
  const errors: string[] = [];
  if (validateCommonBatchShape(value, "warnings", errors)) {
    const topics = requireArray(value, "topics", "", errors);
    topics?.forEach((topic, index) => validateTopicWriterDocument(topic, index, errors));
  }
  collectPlaceholderErrors(value, "", errors);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: value as TopicWriterBatchOutput, errors: [] };
}

export type { FileWriterBatchOutput, FileWriterDocument, TopicWriterBatchOutput, TopicWriterDocument };
