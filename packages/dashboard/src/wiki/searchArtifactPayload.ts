import type {
  DocumentationRelation,
  WikiDocumentCategory,
  WikiDocumentRole,
  WikiSearchRecordV2,
} from "@understand-code/core/knowledge-base";
import { normalizeLegacySearchArtifactBranding } from "../legacyBranding";

import type { SearchArtifactLoadResult } from "./wikiArtifacts";

const ROLES = new Set<WikiDocumentRole>(["featured", "reference", "maintenance"]);
const CATEGORIES = new Set<WikiDocumentCategory>([
  "overview",
  "capability",
  "flow",
  "module",
  "topic",
  "file",
  "quality",
  "coverage",
  "other",
]);
const RELATIONS = new Set<DocumentationRelation>(["direct", "context", "none"]);

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function optionalStrings(item: Record<string, unknown>, fields: readonly string[]): boolean {
  return fields.every((field) => item[field] === undefined || typeof item[field] === "string");
}

function searchRecord(value: unknown, contentLines?: readonly string[]): value is WikiSearchRecordV2 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string"
    || (item.kind !== "page" && item.kind !== "symbol")
    || typeof item.title !== "string"
    || typeof item.pageId !== "string"
    || typeof item.role !== "string"
    || !ROLES.has(item.role as WikiDocumentRole)
    || typeof item.category !== "string"
    || !CATEGORIES.has(item.category as WikiDocumentCategory)
    || typeof item.relation !== "string"
    || !RELATIONS.has(item.relation as DocumentationRelation)
    || !strings(item.terms)
    || !strings(item.businessTerms)
    || !optionalStrings(item, ["summary", "content", "anchor", "nodeId", "filePath"])
  ) return false;
  if (item.contentLineIds !== undefined && (item.content !== undefined || contentLines === undefined
    || !Array.isArray(item.contentLineIds) || !item.contentLineIds.every((id) => Number.isInteger(id) && id >= 0 && id < contentLines.length))) return false;

  return item.kind !== "symbol"
    || (
      typeof item.anchor === "string"
      && item.anchor.trim().length > 0
      && typeof item.nodeId === "string"
      && item.nodeId.trim().length > 0
      && item.content === undefined
      && item.contentLineIds === undefined
      && item.businessTerms.length === 0
    );
}

export function parseSearchArtifact(value: unknown): SearchArtifactLoadResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { status: "invalid", records: [] };
  }
  const payload = value as { version?: unknown; records?: unknown; contentLines?: unknown };
  if (payload.contentLines !== undefined && !strings(payload.contentLines)) return { status: "invalid", records: [] };
  const contentLines = payload.contentLines as string[] | undefined;
  if (
    payload.version !== 2
    || !Array.isArray(payload.records)
    || !payload.records.every((record) => searchRecord(record, contentLines))
  ) {
    return { status: "invalid", records: [] };
  }
  return {
    status: "ready",
    ...normalizeLegacySearchArtifactBranding(payload.records, contentLines),
  };
}
