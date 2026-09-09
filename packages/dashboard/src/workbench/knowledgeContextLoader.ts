import { parseWikiIndexV2 } from "@understand-code/core/knowledge-base";
import {
  buildWikiRuntimeIndex,
  type WikiRuntimeIndex,
} from "../wiki/wikiIndex";
import { normalizeLegacyWikiIndexBranding } from "../legacyBranding";
import { dashboardFetchInit, withDashboardAccess } from "./transport";

type Fetcher = typeof fetch;

export type DashboardKnowledge =
  | {
      wikiIndex: WikiRuntimeIndex;
      wikiStatus: "ready";
      sourceVersion: 2;
    }
  | {
      wikiIndex: WikiRuntimeIndex;
      wikiStatus: "missing" | "legacy" | "invalid" | "forbidden" | "error";
      sourceVersion: null;
    };

interface JsonLoadResult {
  status: "ok" | "missing" | "legacy" | "invalid" | "forbidden" | "error";
  value: unknown;
}

export function optionalDataUrl(path: string, token: string | null): string {
  const normalizedPath = path.replace(/^\/+/, "");
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const url = `${normalizedBase}${normalizedPath}`;
  if (import.meta.env.VITE_DEMO_MODE === "true") return url;
  return withDashboardAccess(url, token);
}

async function fetchJsonWithStatus(
  url: string,
  accessToken: string,
  fetcher: Fetcher,
): Promise<JsonLoadResult> {
  try {
    const response = await fetcher(url, dashboardFetchInit(accessToken));
    if (response.status === 404) {
      // The server tells us whether a knowledge base exists in an older layout,
      // so the reader is not told to generate one that is already on disk.
      const body: unknown = await response.json().catch(() => null);
      const kind = (body as { knowledgeBase?: unknown } | null)?.knowledgeBase;
      return { status: kind === "legacy" ? "legacy" : "missing", value: null };
    }
    if (response.status === 401 || response.status === 403) return { status: "forbidden", value: null };
    if (!response.ok) return { status: "error", value: null };
    try {
      return { status: "ok", value: await response.json() };
    } catch {
      return { status: "invalid", value: null };
    }
  } catch {
    return { status: "error", value: null };
  }
}

export async function loadDashboardKnowledge(
  accessToken: string,
  fetcher: Fetcher = fetch,
): Promise<DashboardKnowledge> {
  const wikiLoad = await fetchJsonWithStatus(
    optionalDataUrl("knowledge-base/wiki-index.json", accessToken),
    accessToken,
    fetcher,
  );
  if (wikiLoad.status !== "ok") {
    return {
      wikiIndex: buildWikiRuntimeIndex(null),
      wikiStatus: wikiLoad.status,
      sourceVersion: null,
    };
  }

  const parsed = parseWikiIndexV2(wikiLoad.value);
  if (!parsed.ok) {
    return {
      wikiIndex: buildWikiRuntimeIndex(null),
      wikiStatus: "invalid",
      sourceVersion: null,
    };
  }

  return {
    wikiIndex: buildWikiRuntimeIndex(normalizeLegacyWikiIndexBranding(parsed.value)),
    wikiStatus: "ready",
    sourceVersion: 2,
  };
}

export function shouldRetryWikiLoad(
  status: DashboardKnowledge["wikiStatus"],
  attempts: number,
  maxAttempts: number,
): boolean {
  return status !== "ready" && status !== "forbidden" && attempts < maxAttempts;
}
