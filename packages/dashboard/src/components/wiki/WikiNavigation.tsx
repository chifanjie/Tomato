import type { WikiTreeSection } from "../../wiki/wikiIndex";

interface WikiNavigationProps {
  projectName: string;
  sections: WikiTreeSection[];
  activePageId: string | null;
  emptyReason: string | null;
  onSelectPage: (pageId: string) => void;
}

export default function WikiNavigation({ projectName, sections, activePageId, emptyReason, onSelectPage }: WikiNavigationProps) {
  return (
    <nav aria-label="知识库目录" className="flex h-full w-[280px] shrink-0 flex-col border-r border-border-subtle bg-surface max-lg:h-auto max-lg:w-full max-lg:border-b max-lg:border-r-0">
      <div className="border-b border-border-subtle px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">项目知识库</p>
        <h2 className="mt-1 truncate text-base font-semibold text-text-primary">{projectName}</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
        {sections.length === 0 ? (
          <p className="uc-panel-muted p-3 text-sm text-text-muted">
            {emptyReason ?? "还没有生成可阅读的知识库内容。"}
          </p>
        ) : (
          <div className="space-y-5">
            {sections.map((section) => (
              <section key={section.category}>
                <h3 className="px-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">{section.title}</h3>
                <div className="mt-2 space-y-1">
                  {section.pages.map((page) => (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => onSelectPage(page.id)}
                      aria-current={activePageId === page.id ? "page" : undefined}
                      className={`block w-full rounded-md px-2 py-2 text-left text-sm transition-colors ${
                        activePageId === page.id
                          ? "bg-accent/12 text-text-primary"
                          : "text-text-secondary hover:bg-elevated hover:text-text-primary"
                      }`}
                    >
                      <span className="block truncate font-medium">{page.title}</span>
                      <span className="mt-0.5 block line-clamp-2 text-xs text-text-muted">{page.summary}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
