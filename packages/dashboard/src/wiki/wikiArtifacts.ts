import type {
  DocumentationRelation,
  WikiDocumentCategory,
  WikiDocumentRole,
  WikiSearchRecordV2,
} from "@understand-code/core/knowledge-base";
import { normalizeLegacySearchArtifactBranding } from "../legacyBranding";
import { dashboardFetchInit, withDashboardAccess } from "../workbench/transport";

export type SearchLoadStatus = "idle" | "loading" | "ready" | "fallback";

export type SearchArtifactLoadResult =
  | { status: "ready"; records: WikiSearchRecordV2[]; contentLines?: readonly string[] }
  | { status: "missing" | "invalid" | "forbidden" | "error"; records: [] };

export interface SearchArtifactRequestSnapshot {
  token: string | null;
  result: SearchArtifactLoadResult | null;
}

export interface SearchArtifactRequestController {
  open(token: string): Promise<SearchArtifactLoadResult>;
  close(): void;
  reset(token?: string): void;
  isCurrent(token: string): boolean;
  snapshot(): SearchArtifactRequestSnapshot;
}

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

function searchUrl(token: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const path = `${normalizedBase}knowledge-base/search-index.json`;
  if (import.meta.env.VITE_DEMO_MODE === "true") return path;
  return withDashboardAccess(path, token);
}

export async function loadSearchArtifact(
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<SearchArtifactLoadResult> {
  try {
    const response = await fetcher(searchUrl(accessToken), dashboardFetchInit(accessToken));
    if (response.status === 404) return { status: "missing", records: [] };
    if (response.status === 401 || response.status === 403) return { status: "forbidden", records: [] };
    if (!response.ok) return { status: "error", records: [] };

    let value: unknown;
    try {
      value = await response.json();
    } catch {
      return { status: "invalid", records: [] };
    }
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
  } catch {
    return { status: "error", records: [] };
  }
}

export function createSearchArtifactRequestController(
  fetcher: typeof fetch = fetch,
): SearchArtifactRequestController {
  let activeToken: string | null = null;
  let currentResult: SearchArtifactLoadResult | null = null;
  let request: Promise<SearchArtifactLoadResult> | null = null;

  return {
    open(token) {
      if (activeToken !== token) {
        activeToken = token;
        currentResult = null;
        request = null;
      }
      if (!request) {
        const requestedToken = token;
        request = loadSearchArtifact(token, fetcher).then((result) => {
          if (activeToken === requestedToken) currentResult = result;
          return result;
        });
      }
      return request;
    },
    close() {
      // Closing only hides the dialog. Keeping the request alive avoids a duplicate fetch on reopen.
    },
    reset(token) {
      activeToken = token ?? null;
      currentResult = null;
      request = null;
    },
    isCurrent(token) {
      return activeToken === token;
    },
    snapshot() {
      return { token: activeToken, result: currentResult };
    },
  };
}
