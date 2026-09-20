import type { WikiEvidenceV2 } from "@understand-code/core/knowledge-base";
import {
  nextMarkdownFenceState,
  resolveWikiMarkdownTarget,
  type MarkdownFenceState,
  type WikiTarget,
} from "./wikiContent";

export type WikiResourceTarget =
  | { kind: "wiki"; target: WikiTarget }
  | { kind: "external"; href: string; newTab: boolean }
  | { kind: "source"; filePath: string; line?: number; evidence: WikiEvidenceV2 }
  | { kind: "unavailable"; path: string };

interface WikiResourceContext {
  currentMarkdownPath: string;
  pageIdByMarkdownPath: ReadonlyMap<string, string>;
  repositoryRoot?: string;
  evidence?: readonly WikiEvidenceV2[];
}

function safePath(value: string): string | undefined {
  const path = value.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!path || /[\u0000-\u001f\u007f\uFFFD]/u.test(path) || path.split("/").includes("..")) return undefined;
  return path.replace(/(^|\/)\.\//g, "$1");
}

function absolutePath(value: string): boolean {
  return value.startsWith("/") || /^[a-z]:\//iu.test(value);
}

/** Use an explicit source-root declaration; never guess from a filename suffix. */
export function inferWikiRepositoryRoot(markdown: string, boundFilePaths: readonly string[] = []): string | undefined {
  const files = [...new Set(boundFilePaths.map(safePath))];
  const boundFile = files.length === 1 && files[0] && !absolutePath(files[0]) ? files[0] : undefined;
  const declaredRoots = new Set<string>();
  let sourceLocationSection = false;
  let fence: MarkdownFenceState | null = null;
  for (const line of markdown.split(/\r?\n/u)) {
    const wasFenced = fence !== null;
    const nextFence = nextMarkdownFenceState(fence, line);
    if (nextFence !== fence || wasFenced) {
      fence = nextFence;
      continue;
    }
    const match = line.match(/^\s*(?:[-*]\s+)?(?:\*\*)?(?:代码根目录|源码根目录)(?:\*\*)?\s*[：:]\s*(.+?)\s*$/u);
    if (match) {
      const path = safePath((match[1] ?? "").replace(/^`([^`]+)`$/u, "$1").trim());
      if (path && absolutePath(path)) return path;
    }
    const heading = line.match(/^\s*#{1,6}\s+(.+?)\s*#*\s*$/u);
    if (heading) sourceLocationSection = heading[1] === "源码位置";
    if (!sourceLocationSection || !boundFile) continue;
    const declaration = line.match(/^\s*\[查看源文件\]\(([^)]+)\)/u);
    if (!declaration?.[1]) continue;
    let decoded: string;
    try { decoded = decodeURIComponent(declaration[1]); } catch { continue; }
    const authoredPath = safePath(decoded.replace(/(?::[1-9]\d*(?:-[1-9]\d*)?|#L[1-9]\d*(?:-L?[1-9]\d*)?)$/u, ""));
    const suffix = `/${boundFile}`;
    if (!authoredPath || !absolutePath(authoredPath) || !authoredPath.endsWith(suffix)) continue;
    const declaredRoot = authoredPath.slice(0, -suffix.length);
    if (declaredRoot && absolutePath(declaredRoot)) declaredRoots.add(declaredRoot);
  }
  return declaredRoots.size === 1 ? [...declaredRoots][0] : undefined;
}

/** Narrow exceptions to Markdown's URL scheme filter, handled as resources only. */
export function isWikiLocalResourceHref(href: string): boolean {
  return /^[^\s/:?#]+\.[a-z0-9]+:[1-9]\d*(?:-[1-9]\d*)?$/iu.test(href)
    || /^[a-z]:[\\/][^?#\u0000-\u001f\u007f]+\.[a-z0-9]+(?::[1-9]\d*(?:-[1-9]\d*)?)?$/iu.test(href);
}

export function resolveWikiResourceLink(
  href: string | undefined,
  context: WikiResourceContext,
): WikiResourceTarget {
  const value = href?.trim() ?? "";
  const unavailable: WikiResourceTarget = { kind: "unavailable", path: value };
  if (!value || /[\u0000-\u001f\u007f]/u.test(value)) return unavailable;
  if (/^(?:https?:\/\/|\/\/)/iu.test(value)) return { kind: "external", href: value, newTab: true };
  if (/^mailto:/iu.test(value)) return { kind: "external", href: value, newTab: false };
  if (/^[a-z][a-z0-9+.-]*:/iu.test(value)
    && !/^[a-z]:[\\/]/iu.test(value)
    && !/^[^/:]+\.[a-z0-9]+:[1-9]\d*(?:-[1-9]\d*)?$/iu.test(value)) return unavailable;

  const wiki = resolveWikiMarkdownTarget(context.currentMarkdownPath, value, context.pageIdByMarkdownPath);
  if (wiki) return { kind: "wiki", target: wiki };

  let decoded: string;
  try { decoded = decodeURIComponent(value); } catch { return unavailable; }
  if (/[\u0000-\u001f\u007f\uFFFD]/u.test(decoded)) return unavailable;
  const location = decoded.match(/^(.*?)(?::([1-9]\d*)(?:-[1-9]\d*)?|#L([1-9]\d*)(?:-L?[1-9]\d*)?)?$/u);
  const path = safePath(location?.[1] ?? "");
  if (!path) return unavailable;
  const rawLine = location?.[2] ?? location?.[3];
  const line = rawLine ? Number(rawLine) : undefined;
  if (line !== undefined && !Number.isSafeInteger(line)) return unavailable;

  const root = context.repositoryRoot ? safePath(context.repositoryRoot) : undefined;
  let relative = path;
  if (absolutePath(path)) {
    if (!root || !absolutePath(root) || !path.startsWith(`${root}/`)) return unavailable;
    relative = path.slice(root.length + 1);
  }

  // Imported wiki documents may retain absolute authoring paths. Only map the
  // known wiki directories beneath the declared root, and only to indexed pages.
  if (line === undefined && absolutePath(path)) {
    const wikiRelative = relative.replace(/^(?:docs\/wiki|\.understand-code\/knowledge-base)\//u, "");
    if (wikiRelative !== relative) {
      const target = resolveWikiMarkdownTarget("knowledge-base/目录.md", wikiRelative, context.pageIdByMarkdownPath);
      if (target) return { kind: "wiki", target };
    }
  }

  const candidates = (context.evidence ?? []).filter((item) => {
    const itemPath = safePath(item.filePath);
    return (itemPath === relative || itemPath === path)
      && (line === undefined || (item.lineRange[0] <= line && line <= item.lineRange[1]));
  }).sort((a, b) => (a.lineRange[1] - a.lineRange[0]) - (b.lineRange[1] - b.lineRange[0]));
  const evidence = candidates[0];
  return evidence
    ? { kind: "source", filePath: evidence.filePath, ...(line === undefined ? {} : { line }), evidence }
    : unavailable;
}
