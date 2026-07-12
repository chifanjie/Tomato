import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { WikiDocumentCategory, WikiPageV2 } from "@understand-code/core/knowledge-base";
import { useDashboardStore } from "../../store";
import {
  buildWikiMarkdownPageLookup,
  extractExplicitAnchors,
  loadWikiMarkdown,
  markdownWithoutDuplicateTitle,
  markdownWithoutExplicitAnchors,
  resolveWikiMarkdownTarget,
  wikiTargetHash,
  type WikiTarget,
} from "../../wiki/wikiContent";

interface WikiPageViewProps {
  page: WikiPageV2 | null;
  pages?: readonly WikiPageV2[];
  onSelectPage?: (pageId: string) => void;
  onHeadingsChange?: (headings: WikiOutlineHeading[]) => void;
  emptyReason?: string | null;
}

export interface WikiOutlineHeading {
  id: string;
  text: string;
  level: 2 | 3 | 4;
}

const HEADING_SOURCE_LINES = new WeakMap<WikiOutlineHeading, number>();

type MarkdownState =
  | { pageId: string; status: "loading"; markdown: ""; error: null }
  | { pageId: string; status: "ready"; markdown: string; error: null }
  | { pageId: string; status: "error"; markdown: ""; error: string };

const CATEGORY_LABELS: Record<WikiDocumentCategory, string> = {
  overview: "项目概览",
  capability: "业务能力",
  flow: "业务流程",
  module: "核心模块",
  topic: "函数与类型",
  file: "文件说明",
  quality: "质量报告",
  coverage: "覆盖情况",
  other: "其他文档",
};

const GENERATION_STATUS_LABELS: Record<WikiPageV2["generationStatus"], string> = {
  complete: "生成完成",
  partial: "部分生成",
  failed: "生成失败",
};

const QUALITY_LABELS: Record<WikiPageV2["quality"], string> = {
  verified: "已经核验",
  generated: "自动生成",
  "needs-review": "等待核验",
  failed: "质量失败",
};

function outlineHeadingId(line: number, _text: string): string {
  return `wiki-heading-${line}`;
}

export function extractWikiOutline(markdown: string): WikiOutlineHeading[] {
  const headings: WikiOutlineHeading[] = [];
  const explicitAnchors = extractExplicitAnchors(markdown);
  let fence: { character: "`" | "~"; length: number } | null = null;
  markdown.split(/\r?\n/).forEach((line, index) => {
    const fenceMarker = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
    if (fenceMarker) {
      const marker = {
        character: fenceMarker[0] as "`" | "~",
        length: fenceMarker.length,
      };
      if (!fence) fence = marker;
      else if (marker.character === fence.character && marker.length >= fence.length) fence = null;
      return;
    }
    if (fence) return;
    const match = line.match(/^\s*(#{2,4})(?!#)\s+(.+?)\s*#*\s*$/);
    if (!match) return;
    const level = match[1]?.length as 2 | 3 | 4;
    const text = (match[2] ?? "").replace(/[`*_~]/g, "").trim();
    if (!text) return;
    const heading = {
      id: explicitAnchors.get(index + 1) ?? outlineHeadingId(index + 1, text),
      text,
      level,
    };
    HEADING_SOURCE_LINES.set(heading, index + 1);
    headings.push(heading);
  });
  return headings;
}

function headingIdAt(
  headings: readonly WikiOutlineHeading[],
  line: number,
  level: WikiOutlineHeading["level"],
  text: string,
): string {
  return headings.find((heading) =>
    heading.level === level && HEADING_SOURCE_LINES.get(heading) === line)?.id
    ?? outlineHeadingId(line, text);
}

export function resolveWikiPageViewLinkTarget(
  currentMarkdownPath: string,
  href: string | undefined,
  pageIdByMarkdownPath: ReadonlyMap<string, string>,
): WikiTarget | null {
  return resolveWikiMarkdownTarget(currentMarkdownPath, href, pageIdByMarkdownPath);
}

export function findWikiAnchorTarget(
  article: Pick<HTMLElement, "querySelectorAll">,
  anchor: string,
): HTMLElement | null {
  return [...article.querySelectorAll<HTMLElement>("[id]")]
    .find((element) => element.id === anchor) ?? null;
}

export function scrollWikiAnchor(
  article: Pick<HTMLElement, "querySelectorAll">,
  anchor: string,
): boolean {
  const target = findWikiAnchorTarget(article, anchor);
  if (!target) return false;
  target.scrollIntoView({ block: "start" });
  return true;
}

function reactNodeText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(reactNodeText).join("");
  if (value && typeof value === "object" && "props" in value) {
    return reactNodeText((value as { props?: { children?: unknown } }).props?.children);
  }
  return "";
}

function chineseSummary(value: string): string {
  return /\p{Script=Han}/u.test(value)
    ? value
    : "这篇页面的摘要尚待中文化，请以正文和代码证据为准。";
}

function LoadingDocument() {
  return (
    <div role="status" className="space-y-4 py-9" aria-label="正在加载文档正文">
      <div className="h-4 w-4/5 animate-pulse rounded bg-elevated" />
      <div className="h-4 w-full animate-pulse rounded bg-elevated" />
      <div className="h-4 w-11/12 animate-pulse rounded bg-elevated" />
      <div className="mt-8 h-6 w-2/5 animate-pulse rounded bg-elevated" />
      <div className="h-4 w-full animate-pulse rounded bg-elevated" />
      <span className="sr-only">正在加载文档正文</span>
    </div>
  );
}

export function WikiMarkdownDocument({
  markdown,
  currentMarkdownPath,
  pageIdByMarkdownPath,
  headings,
  onSelectTarget,
}: {
  markdown: string;
  currentMarkdownPath: string;
  pageIdByMarkdownPath: ReadonlyMap<string, string>;
  headings: WikiOutlineHeading[];
  onSelectTarget: (target: WikiTarget) => void;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="mb-5 mt-10 text-2xl font-semibold tracking-tight text-text-primary first:mt-0">{children}</h1>,
        h2: ({ node, children }) => {
          const text = reactNodeText(children);
          const line = node?.position?.start.line ?? 0;
          const id = headingIdAt(headings, line, 2, text);
          return <h2 id={id} className="mb-4 mt-10 scroll-mt-4 border-b border-border-subtle pb-2 text-xl font-semibold tracking-tight text-text-primary">{children}</h2>;
        },
        h3: ({ node, children }) => {
          const text = reactNodeText(children);
          const line = node?.position?.start.line ?? 0;
          const id = headingIdAt(headings, line, 3, text);
          return <h3 id={id} className="mb-3 mt-8 scroll-mt-4 text-lg font-semibold text-text-primary">{children}</h3>;
        },
        h4: ({ node, children }) => {
          const text = reactNodeText(children);
          const line = node?.position?.start.line ?? 0;
          const id = headingIdAt(headings, line, 4, text);
          return <h4 id={id} className="mb-2 mt-6 scroll-mt-4 text-base font-semibold text-text-primary">{children}</h4>;
        },
        p: ({ children }) => <p className="my-4 break-words text-[15px] leading-7 text-text-secondary [overflow-wrap:anywhere]">{children}</p>,
        a: ({ href, children }) => {
          const external = /^(?:https?:)?\/\//i.test(href ?? "");
          const target = resolveWikiPageViewLinkTarget(currentMarkdownPath, href, pageIdByMarkdownPath);
          return (
            <a
              href={target ? wikiTargetHash(target) : href}
              onClick={target ? (event) => {
                event.preventDefault();
                onSelectTarget(target);
              } : undefined}
              target={external ? "_blank" : undefined}
              rel={external ? "noreferrer" : undefined}
              className="font-medium text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent"
            >
              {children}
            </a>
          );
        },
        strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>,
        ul: ({ children }) => <ul className="my-4 list-disc space-y-2 pl-6 text-[15px] leading-7 text-text-secondary">{children}</ul>,
        ol: ({ children }) => <ol className="my-4 list-decimal space-y-2 pl-6 text-[15px] leading-7 text-text-secondary">{children}</ol>,
        li: ({ children }) => <li className="pl-1 marker:text-text-muted">{children}</li>,
        blockquote: ({ children }) => <blockquote className="my-6 border-l-2 border-accent/50 bg-accent/5 px-5 py-1 text-text-secondary">{children}</blockquote>,
        hr: () => <hr className="my-9 border-border-subtle" />,
        pre: ({ children }) => <pre className="my-5 overflow-x-auto rounded-lg border border-border-subtle bg-elevated p-4 text-[13px] leading-6 text-text-primary">{children}</pre>,
        code: ({ className, children }) => className ? (
          <code className={`${className} font-mono text-[13px]`}>{children}</code>
        ) : (
          <code className="break-words rounded bg-elevated px-1.5 py-0.5 font-mono text-[0.9em] text-text-primary [overflow-wrap:anywhere]">{children}</code>
        ),
        table: ({ children }) => (
          <div className="my-6 overflow-x-auto rounded-lg border border-border-subtle">
            <table className="w-full border-collapse text-left text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-elevated text-text-primary">{children}</thead>,
        th: ({ children }) => <th className="border-b border-r border-border-subtle px-4 py-3 font-semibold last:border-r-0">{children}</th>,
        td: ({ children }) => <td className="border-b border-r border-border-subtle px-4 py-3 align-top leading-6 text-text-secondary last:border-r-0">{children}</td>,
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}

function LoadedWikiPageView({
  page,
  pages,
  onHeadingsChange,
}: {
  page: WikiPageV2;
  pages: readonly WikiPageV2[];
  onHeadingsChange: (headings: WikiOutlineHeading[]) => void;
}) {
  const scrollContainerRef = useRef<HTMLElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const pendingWikiAnchor = useDashboardStore((store) => store.pendingWikiAnchor);
  const openWikiTarget = useDashboardStore((store) => store.openWikiTarget);
  const consumePendingWikiAnchor = useDashboardStore((store) => store.consumePendingWikiAnchor);
  const pageIdByMarkdownPath = useMemo(
    () => buildWikiMarkdownPageLookup(pages),
    [pages],
  );
  const [retryKey, setRetryKey] = useState(0);
  const [anchorRetryKey, setAnchorRetryKey] = useState(0);
  const [anchorError, setAnchorError] = useState<string | null>(null);
  const [state, setState] = useState<MarkdownState>({
    pageId: page.id,
    status: "loading",
    markdown: "",
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    setState({ pageId: page.id, status: "loading", markdown: "", error: null });
    onHeadingsChange([]);
    loadWikiMarkdown(page.markdownPath, { signal: controller.signal })
      .then((markdown) => {
        const content = markdownWithoutDuplicateTitle(markdown, page.title);
        const headings = extractWikiOutline(content);
        setState({
          pageId: page.id,
          status: "ready",
          markdown: content,
          error: null,
        });
        onHeadingsChange(headings);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          pageId: page.id,
          status: "error",
          markdown: "",
          error: error instanceof Error ? error.message : "文档加载失败，请稍后重试",
        });
      });

    return () => controller.abort();
  }, [onHeadingsChange, page, retryKey]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(max-width: 1024px)").matches) {
      container.scrollIntoView({ block: "start" });
    } else {
      container.scrollTo({ top: 0 });
    }
  }, [page.id]);

  useEffect(() => {
    setAnchorError(null);
  }, [page.id, pendingWikiAnchor]);

  const currentState: MarkdownState = state.pageId === page.id
    ? state
    : { pageId: page.id, status: "loading", markdown: "", error: null };
  const currentOutline = currentState.status === "ready"
    ? extractWikiOutline(currentState.markdown)
    : [];

  useEffect(() => {
    if (
      currentState.status !== "ready"
      || !pendingWikiAnchor
      || currentState.pageId !== page.id
    ) return;
    const frame = requestAnimationFrame(() => {
      const article = articleRef.current;
      if (!article || !scrollWikiAnchor(article, pendingWikiAnchor)) {
        setAnchorError("未找到目标章节，可以重试定位或从本文目录继续阅读。");
        return;
      }
      setAnchorError(null);
      consumePendingWikiAnchor(pendingWikiAnchor);
    });
    return () => cancelAnimationFrame(frame);
  }, [
    anchorRetryKey,
    consumePendingWikiAnchor,
    currentState,
    page.id,
    pendingWikiAnchor,
  ]);

  const selectMarkdownTarget = (target: WikiTarget) => {
    openWikiTarget(target);
    if (typeof window !== "undefined") {
      window.history.pushState(
        null,
        "",
        `${window.location.pathname}${window.location.search}${wikiTargetHash(target)}`,
      );
    }
  };

  return (
    <section
      ref={scrollContainerRef}
      className="uc-doc-surface min-h-0 min-w-0 flex-1 overflow-auto max-lg:flex-none max-lg:overflow-visible"
    >
      <article ref={articleRef} aria-label={page.title} className="mx-auto min-w-0 max-w-4xl px-10 py-10 max-lg:px-5 max-lg:py-6">
        <header className="border-b border-border-subtle pb-7">
          <p className="text-xs font-semibold tracking-[0.16em] text-accent">{CATEGORY_LABELS[page.category]}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">{page.title}</h1>
          <p className="mt-4 max-w-3xl break-words text-base leading-7 text-text-secondary [overflow-wrap:anywhere]">{chineseSummary(page.summary)}</p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-text-muted">
            <span className="rounded-full border border-border-subtle px-2.5 py-1">{GENERATION_STATUS_LABELS[page.generationStatus]}</span>
            <span className="rounded-full border border-border-subtle px-2.5 py-1">{QUALITY_LABELS[page.quality]}</span>
          </div>
          {currentOutline.length > 0 && (
            <details className="mt-5 hidden rounded-lg border border-border-subtle bg-elevated max-lg:block">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-text-primary">
                本文目录（{currentOutline.length} 节）
              </summary>
              <nav aria-label="移动端本文目录" className="border-t border-border-subtle px-3 py-2">
                {currentOutline.map((heading) => (
                  <button
                    key={heading.id}
                    type="button"
                    onClick={() => articleRef.current && scrollWikiAnchor(articleRef.current, heading.id)}
                    className={`block w-full rounded px-2 py-1.5 text-left text-xs leading-5 text-text-muted hover:bg-surface hover:text-text-primary ${heading.level === 3 ? "pl-5" : heading.level === 4 ? "pl-8" : "font-medium"}`}
                  >
                    {heading.text}
                  </button>
                ))}
              </nav>
            </details>
          )}
        </header>

        <section className="py-1" aria-label="文档正文">
          {anchorError && (
            <div role="alert" className="mt-5 flex items-center justify-between gap-4 rounded-lg border border-amber-400/30 bg-amber-500/5 px-4 py-3 text-sm text-text-secondary">
              <span>{anchorError}</span>
              <button
                type="button"
                onClick={() => setAnchorRetryKey((value) => value + 1)}
                className="shrink-0 rounded border border-border-medium px-2.5 py-1 font-medium text-accent hover:bg-accent/10"
              >
                重试定位
              </button>
            </div>
          )}
          {currentState.status === "loading" && <LoadingDocument />}
          {currentState.status === "error" && (
            <div role="alert" className="my-9 rounded-xl border border-red-400/25 bg-red-500/5 p-5">
              <h2 className="text-base font-semibold text-text-primary">正文暂时无法显示</h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{currentState.error}</p>
              <button
                type="button"
                onClick={() => setRetryKey((value) => value + 1)}
                className="mt-4 rounded-md border border-border-medium px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/10"
              >
                重新加载
              </button>
            </div>
          )}
          {currentState.status === "ready" && (
            <WikiMarkdownDocument
              markdown={markdownWithoutExplicitAnchors(currentState.markdown)}
              currentMarkdownPath={page.markdownPath}
              pageIdByMarkdownPath={pageIdByMarkdownPath}
              headings={currentOutline}
              onSelectTarget={selectMarkdownTarget}
            />
          )}
        </section>
      </article>
    </section>
  );
}

const IGNORE_HEADINGS = () => {};

export default function WikiPageView({
  page,
  pages,
  onHeadingsChange,
  emptyReason,
}: WikiPageViewProps) {
  const indexedPages = useDashboardStore((store) => store.wikiIndex.pages);
  if (!page) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center bg-root max-lg:min-h-[240px] max-lg:flex-none">
        <div className="uc-panel max-w-md p-6 text-center">
          <h2 className="text-lg font-semibold text-text-primary">尚未选择知识库页面</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            {emptyReason ?? "请从左侧目录选择一篇文档。"}
          </p>
        </div>
      </main>
    );
  }
  return (
    <LoadedWikiPageView
      page={page}
      pages={pages ?? indexedPages}
      onHeadingsChange={onHeadingsChange ?? IGNORE_HEADINGS}
    />
  );
}
