import type { ReactNode } from "react";
import type { JourneyStep } from "../../workbench/journeyRoute";

interface VisualStageProps {
  activeStep: JourneyStep | null;
  children: ReactNode;
}

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
};

const reasonLabels: Record<string, string> = {
  "Entry points are the fastest way to orient in the product journey.": "入口文件能最快帮助你建立项目主链路。",
  "Flow and service files show how product behavior moves through the system.": "流程和服务文件展示产品行为如何在系统中流转。",
  "This file is a useful supporting stop in the codebase.": "这是理解代码库时值得停留的关键支撑文件。",
  "Data model and schema nodes explain the product concepts being moved around.": "数据模型和 Schema 说明系统中流转的核心产品概念。",
  "Strategy and ranking logic usually encode the product decisions.": "策略、排序和过滤逻辑通常承载产品决策。",
  "Tests show the expected behavior and edge cases.": "测试能说明预期行为和边界条件。",
  "Configuration controls runtime behavior and environment choices.": "配置决定运行时行为和环境选择。",
  "Operations files affect deployment, reliability, or production risk.": "运维相关文件会影响发布、稳定性或生产风险。",
  "This node does not fit a stronger journey section yet.": "这个节点暂时没有更明确的路线归类。",
};

function sectionLabel(section: string | undefined): string {
  return section ? sectionLabels[section] ?? section : "工作台";
}

function kindLabel(kind: string | undefined): string {
  const normalized = kind ?? "project";
  return kindLabels[normalized] ?? normalized;
}

function reasonLabel(reason: string): string {
  return reasonLabels[reason] ?? reason;
}

export default function VisualStage({ activeStep, children }: VisualStageProps) {
  const activeKindLabel = kindLabel(activeStep?.kind);

  return (
    <section aria-label="图谱工作台" className="flex h-full min-w-0 flex-1 flex-col bg-root">
      <header className="shrink-0 border-b border-border-subtle bg-surface/95 px-5 py-4">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 rounded border border-border-subtle bg-elevated px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                {sectionLabel(activeStep?.section)}
              </span>
              <span className="shrink-0 rounded bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                {activeKindLabel}
              </span>
            </div>
            <h1 className="mt-2 truncate font-heading text-xl text-text-primary" title={activeStep?.title}>
              {activeStep?.title ?? "图谱总览"}
            </h1>
            {activeStep?.subtitle && (
              <p className="mt-1 truncate font-mono text-xs text-text-muted" title={activeStep.subtitle}>
                {activeStep.subtitle}
              </p>
            )}
          </div>
          {activeStep?.reason && (
            <p className="hidden max-w-[360px] shrink-0 text-right text-xs leading-relaxed text-text-secondary xl:block">
              {reasonLabel(activeStep.reason)}
            </p>
          )}
        </div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
