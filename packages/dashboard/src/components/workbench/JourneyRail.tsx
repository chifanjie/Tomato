import type { JourneyRoute, JourneyStep } from "../../workbench/journeyRoute";

const sectionLabels: Record<string, string> = {
  "Start Here": "入口起点",
  "Product Flow": "业务流程",
  "Key Files": "关键文件",
  "Data Models": "数据模型",
  "Strategy / Logic": "策略逻辑",
  Tests: "测试验证",
  Configuration: "配置项",
  "Risk & Operations": "风险与运维",
  Unmapped: "未归类",
};

const kindLabels: Record<string, string> = {
  project: "项目",
  file: "文件",
  function: "函数",
  class: "类",
  config: "配置",
  document: "文档",
  service: "服务",
  table: "数据表",
  endpoint: "接口",
  pipeline: "管道",
  schema: "Schema",
  resource: "资源",
  domain: "领域",
  flow: "流程",
  step: "步骤",
};

interface JourneyRailProps {
  route: JourneyRoute;
  activeStepId: string | null;
  onSelectStep: (step: JourneyStep) => void;
}

function stepKindLabel(step: JourneyStep): string {
  const kind = step.kind ?? "node";
  return kindLabels[kind] ?? kind;
}

function sectionLabel(section: string): string {
  return sectionLabels[section] ?? section;
}

export default function JourneyRail({ route, activeStepId, onSelectStep }: JourneyRailProps) {
  const activeIndex = route.steps.findIndex((step) => step.id === activeStepId);
  const completedCount = activeIndex >= 0 ? activeIndex + 1 : 0;
  const progress = route.steps.length > 0 ? Math.round((completedCount / route.steps.length) * 100) : 0;
  const visibleSections = route.sections.filter((section) =>
    route.steps.some((step) => step.section === section),
  );

  return (
    <aside
      aria-label="引导路线"
      className="flex h-full w-[248px] shrink-0 flex-col border-r border-border-subtle bg-panel xl:w-[260px]"
    >
      <div className="shrink-0 border-b border-border-subtle px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            引导路线
          </p>
          <h2 className="mt-1 truncate font-heading text-base text-text-primary" title={route.projectName}>
            {route.projectName}
          </h2>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
            <span>{completedCount}/{route.steps.length}</span>
            <span>{progress}%</span>
          </div>
          <div
            aria-label="Guided route progress"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progress}
            className="mt-1 h-1.5 overflow-hidden rounded bg-elevated"
            role="progressbar"
          >
            <div
              className="h-full rounded bg-accent transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
        {visibleSections.map((section) => {
          const steps = route.steps.filter((step) => step.section === section);
          return (
            <section key={section} className="mb-4 last:mb-0">
              <h3 className="mb-1.5 truncate px-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted" title={section}>
                {sectionLabel(section)}
              </h3>
              <div className="space-y-1.5">
                {steps.map((step) => {
                  const index = route.steps.findIndex((item) => item.id === step.id);
                  const active = step.id === activeStepId;
                  const complete = activeIndex >= 0 && index < activeIndex;
                  const kind = stepKindLabel(step);
                  const stepNumber = index + 1;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => onSelectStep(step)}
                      aria-label={`第 ${stepNumber} 步，共 ${route.steps.length} 步。${sectionLabel(step.section)}。${kind}。${step.title}。进度 ${completedCount}/${route.steps.length}，${progress}%。`}
                      className={`grid w-full grid-cols-[20px_minmax(0,1fr)] gap-2 rounded-md border px-2 py-2 text-left transition-colors ${
                        active
                          ? "border-accent/55 bg-accent/10"
                          : "border-border-subtle bg-surface/65 hover:border-accent/35 hover:bg-elevated"
                      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55`}
                      aria-current={active ? "step" : undefined}
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold ${
                          active
                            ? "border-accent bg-accent text-white"
                            : complete
                              ? "border-accent/60 text-accent"
                              : "border-border-medium text-text-muted"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-text-primary" title={step.title}>
                          {step.title}
                        </span>
                        <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
                          <span className="shrink-0 rounded border border-border-subtle px-1.5 py-0.5 text-[9px] uppercase text-text-muted">
                            {kind}
                          </span>
                          <span className="min-w-0 truncate text-[10px] text-text-muted" title={step.subtitle}>
                            {step.subtitle}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
}
