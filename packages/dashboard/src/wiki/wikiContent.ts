import { normalizeLegacyMarkdownBranding } from "../legacyBranding";
import { isCookieWorkbenchLocation } from "../workbench/transport";

const TOKEN_STORAGE_KEY = "understand-code-token";
const LEGACY_WIKI_PAGE_HASH_PREFIX = "#wiki-page=";

export interface WikiTarget {
  pageId: string;
  anchor?: string;
}

export interface WikiMarkdownLoadOptions {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  search?: string;
  storedToken?: string | null;
  baseUrl?: string;
}

/** Only messages produced by the Markdown loader are safe to show verbatim. */
export class WikiMarkdownLoadError extends Error {}

export function wikiMarkdownErrorMessage(error: unknown): string {
  return error instanceof WikiMarkdownLoadError
    ? error.message
    : "文档加载失败，请检查网络后重试。";
}

export function wikiPageHash(pageId: string): string {
  return wikiTargetHash({ pageId });
}

export function wikiPageIdFromHash(hash: string): string | null {
  return wikiTargetFromHash(hash)?.pageId ?? null;
}

function validDecodedValue(value: string): boolean {
  return value.length > 0 && !value.includes("\0") && !value.includes("\uFFFD");
}

export function wikiTargetHash(target: WikiTarget): string {
  const params = new URLSearchParams({ wiki: target.pageId });
  if (target.anchor) params.set("anchor", target.anchor);
  return `#${params.toString()}`;
}

export function wikiTargetFromHash(hash: string): WikiTarget | null {
  if (hash.startsWith(LEGACY_WIKI_PAGE_HASH_PREFIX)) {
    const legacy = hash.slice(LEGACY_WIKI_PAGE_HASH_PREFIX.length);
    if (!legacy) return null;
    try {
      const pageId = decodeURIComponent(legacy);
      return validDecodedValue(pageId) ? { pageId } : null;
    } catch {
      return null;
    }
  }

  const raw = hash.replace(/^#/, "");
  try {
    decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return null;
  }
  const params = new URLSearchParams(raw);
  const pageId = params.get("wiki");
  if (!pageId || !validDecodedValue(pageId)) return null;
  const anchor = params.get("anchor");
  if (anchor !== null && !validDecodedValue(anchor)) return null;
  return { pageId, ...(anchor ? { anchor } : {}) };
}

function browserSearch(): string {
  return typeof window === "undefined" ? "" : window.location.search;
}

function browserStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      window.localStorage.getItem(TOKEN_STORAGE_KEY) ??
      window.sessionStorage.getItem(TOKEN_STORAGE_KEY)
    );
  } catch {
    try {
      return window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }
}

function decodePath(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    return decoded.includes("\uFFFD") ? null : decoded;
  } catch {
    return null;
  }
}

export function normalizeWikiVirtualPath(value: string): string | null {
  const decoded = decodePath(value);
  if (decoded === null) return null;
  const raw = decoded
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^\.understand-code\//, "");
  const inputSegments = raw.split("/");
  const result: string[] = inputSegments[0] === "knowledge-base" ? [] : ["knowledge-base"];
  for (const segment of raw.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (result.length <= 1) return null;
      result.pop();
      continue;
    }
    if (segment.includes("\0")) return null;
    result.push(segment);
  }
  return result.length > 1 && result[0] === "knowledge-base" ? result.join("/") : null;
}

function normalizedMarkdownPath(markdownPath: string): string {
  const path = normalizeWikiVirtualPath(markdownPath) ?? "";
  const segments = path.split("/").filter(Boolean);

  if (
    segments.length < 2 ||
    segments.some((segment) => segment === "." || segment === ".." || segment.includes("\0"))
  ) {
    throw new Error("知识库文档路径无效");
  }
  return segments.map((segment) => encodeURIComponent(segment)).join("/");
}

export function resolveWikiMarkdownPageId(
  currentMarkdownPath: string,
  href: string | undefined,
  pageIdByMarkdownPath: ReadonlyMap<string, string>,
): string | null {
  return resolveWikiMarkdownTarget(currentMarkdownPath, href, pageIdByMarkdownPath)?.pageId ?? null;
}

export function resolveRelativeMarkdownPath(
  currentMarkdownPath: string,
  relativePath: string,
): string | null {
  const current = normalizeWikiVirtualPath(currentMarkdownPath);
  const decodedRelative = decodePath(relativePath);
  if (!current || decodedRelative === null) return null;
  const currentDirectory = current.slice(0, current.lastIndexOf("/"));
  const rootRelative = /^(?:\/?(?:\.understand-code\/)?knowledge-base\/)/u.test(decodedRelative);
  return normalizeWikiVirtualPath(
    rootRelative ? decodedRelative : `${currentDirectory}/${decodedRelative}`,
  );
}

const SAFE_ANCHOR = /^[\p{L}\p{N}_.:-]+$/u;

function decodedAnchor(value: string | undefined): string | null | undefined {
  if (value === undefined || value === "") return undefined;
  const decoded = decodePath(value);
  return decoded !== null && SAFE_ANCHOR.test(decoded) ? decoded : null;
}

export function resolveWikiMarkdownTarget(
  currentMarkdownPath: string,
  href: string | undefined,
  pageIdByMarkdownPath: ReadonlyMap<string, string>,
): WikiTarget | null {
  if (!href || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(href)) return null;
  const fragmentIndex = href.indexOf("#");
  const rawPathAndQuery = fragmentIndex >= 0 ? href.slice(0, fragmentIndex) : href;
  const rawFragment = fragmentIndex >= 0 ? href.slice(fragmentIndex + 1) : undefined;
  const anchor = decodedAnchor(rawFragment);
  if (anchor === null) return null;

  if (!rawPathAndQuery) {
    if (!anchor) return null;
    const currentPath = normalizeWikiVirtualPath(currentMarkdownPath);
    const pageId = currentPath ? pageIdByMarkdownPath.get(currentPath) : undefined;
    return pageId ? { pageId, anchor } : null;
  }

  const rawPath = rawPathAndQuery.split("?", 1)[0] ?? "";
  if (!/\.md$/iu.test(rawPath)) return null;
  const targetPath = resolveRelativeMarkdownPath(currentMarkdownPath, rawPath);
  const pageId = targetPath ? pageIdByMarkdownPath.get(targetPath) : undefined;
  if (!pageId) return null;
  return { pageId, ...(anchor ? { anchor } : {}) };
}

export function buildWikiMarkdownPageLookup(
  pages: readonly { id: string; markdownPath: string }[],
): ReadonlyMap<string, string> {
  const lookup = new Map<string, string>();
  for (const page of pages) {
    const path = normalizeWikiVirtualPath(page.markdownPath);
    if (path) lookup.set(path, page.id);
  }
  return lookup;
}

export function wikiMarkdownUrl(
  markdownPath: string,
  options: Pick<WikiMarkdownLoadOptions, "search" | "storedToken" | "baseUrl"> = {},
): string {
  const encodedPath = normalizedMarkdownPath(markdownPath);
  const base = options.baseUrl ?? import.meta.env.BASE_URL ?? "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const url = `${normalizedBase}${encodedPath}`;

  if (import.meta.env.VITE_DEMO_MODE === "true") return url;

  if (typeof window !== "undefined" && isCookieWorkbenchLocation(window.location)) return url;
  const search = options.search ?? browserSearch();
  const queryToken = new URLSearchParams(search).get("token");
  const token = queryToken ?? options.storedToken ?? browserStoredToken();
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
}

export async function loadWikiMarkdown(
  markdownPath: string,
  options: WikiMarkdownLoadOptions = {},
): Promise<string> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(wikiMarkdownUrl(markdownPath, options), {
    signal: options.signal,
    headers: { Accept: "text/markdown, text/plain;q=0.9" },
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new WikiMarkdownLoadError("没有读取这篇文档的权限，请重新打开知识库链接");
    }
    if (response.status === 404) {
      throw new WikiMarkdownLoadError("找不到这篇 Markdown 文档，可能尚未生成或索引已过期");
    }
    throw new WikiMarkdownLoadError(`文档加载失败（HTTP ${response.status}）`);
  }

  const markdown = await response.text();
  if (/\btext\/html\b/iu.test(response.headers.get("content-type") ?? "")
    || /^\s*(?:<!doctype\s+html\b|<html\b)/iu.test(markdown)) {
    throw new WikiMarkdownLoadError("文档地址返回了网页而非 Markdown，请检查知识库发布状态后重试");
  }
  if (!markdown.trim()) throw new WikiMarkdownLoadError("这篇文档目前没有正文内容");
  return normalizeLegacyMarkdownBranding(markdown);
}

function normalizedTitle(value: string): string {
  return value
    .trim()
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("zh-CN");
}

/** Avoid showing the same title twice when both wiki metadata and Markdown contain it. */
export function markdownWithoutDuplicateTitle(markdown: string, pageTitle: string): string {
  const match = markdown.match(/^\uFEFF?\s*#\s+(.+?)\s*(?:\r?\n|$)/);
  if (!match || normalizedTitle(match[1] ?? "") !== normalizedTitle(pageTitle)) return markdown;
  return markdown.slice(match[0].length).replace(/^\s+/, "");
}

const EXPLICIT_ANCHOR = /^\s*<a id="([\p{L}\p{N}_.:-]+)"><\/a>\s*$/u;

export interface MarkdownFenceState {
  character: "`" | "~";
  length: number;
}

/** Advance CommonMark fenced-code state for one source line. */
export function nextMarkdownFenceState(
  current: MarkdownFenceState | null,
  line: string,
): MarkdownFenceState | null {
  const match = line.match(/^( {0,3})(`{3,}|~{3,})(.*)$/u);
  const marker = match?.[2];
  if (!marker) return current;

  const character = marker[0] as MarkdownFenceState["character"];
  const suffix = match?.[3] ?? "";
  if (current) {
    const isClosingFence = character === current.character
      && marker.length >= current.length
      && /^[\t ]*$/u.test(suffix);
    return isClosingFence ? null : current;
  }

  // CommonMark forbids backticks in an opening backtick fence's info string.
  if (character === "`" && suffix.includes("`")) return null;
  return { character, length: marker.length };
}

export function extractExplicitAnchors(markdown: string): ReadonlyMap<number, string> {
  const result = new Map<number, string>();
  let fence: MarkdownFenceState | null = null;
  let pending: string | null = null;

  markdown.split(/\r?\n/u).forEach((line, index) => {
    const wasFenced = fence !== null;
    const updatedFence = nextMarkdownFenceState(fence, line);
    if (updatedFence !== fence || wasFenced) {
      fence = updatedFence;
      if (!wasFenced && fence !== null && line.trim()) pending = null;
      return;
    }
    const marker = line.match(EXPLICIT_ANCHOR);
    if (marker) {
      pending = marker[1] ?? null;
      return;
    }
    if (!line.trim()) return;
    if (pending && /^\s*#{2,4}(?!#)\s+/u.test(line)) result.set(index + 1, pending);
    pending = null;
  });
  return result;
}

export function markdownWithoutExplicitAnchors(markdown: string): string {
  let fence: MarkdownFenceState | null = null;
  return markdown.split(/\r?\n/u).map((line) => {
    const wasFenced = fence !== null;
    const updatedFence = nextMarkdownFenceState(fence, line);
    if (updatedFence !== fence || wasFenced) {
      fence = updatedFence;
      return line;
    }
    return EXPLICIT_ANCHOR.test(line) ? "" : line;
  }).join("\n");
}
