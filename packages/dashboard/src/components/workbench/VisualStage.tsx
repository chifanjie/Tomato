import type { ReactNode } from "react";
import type { JourneyStep } from "../../workbench/journeyRoute";

interface VisualStageProps {
  activeStep: JourneyStep | null;
  children: ReactNode;
}

export default function VisualStage({ activeStep, children }: VisualStageProps) {
  const kindLabel = activeStep?.kind ?? "project";

  return (
    <section aria-label="Visual workbench stage" className="flex h-full min-w-0 flex-1 flex-col bg-root">
      <header className="shrink-0 border-b border-border-subtle bg-surface/95 px-5 py-4">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 rounded border border-border-subtle bg-elevated px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                {activeStep?.section ?? "Workbench"}
              </span>
              <span className="shrink-0 rounded bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                {kindLabel}
              </span>
            </div>
            <h1 className="mt-2 truncate font-heading text-xl text-text-primary" title={activeStep?.title}>
              {activeStep?.title ?? "Structure"}
            </h1>
            {activeStep?.subtitle && (
              <p className="mt-1 truncate font-mono text-xs text-text-muted" title={activeStep.subtitle}>
                {activeStep.subtitle}
              </p>
            )}
          </div>
          {activeStep?.reason && (
            <p className="hidden max-w-[360px] shrink-0 text-right text-xs leading-relaxed text-text-secondary xl:block">
              {activeStep.reason}
            </p>
          )}
        </div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
