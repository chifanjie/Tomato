import { useState, useCallback } from "react";
import type { GraphIssue } from "@understand-code/core/schema";

interface WarningBannerProps {
  issues: GraphIssue[];
}

const ISSUE_CATEGORY_COPY: Record<string, string> = {
  "missing-field": "缺少字段，已补充默认值",
  alias: "使用了别名，已映射为标准值",
  "type-coercion": "字段类型已自动转换",
  "out-of-range": "数值超出范围，已调整到有效范围",
  "invalid-collection": "顶层集合格式无效",
  "invalid-node": "节点校验失败，已忽略",
  "invalid-edge": "连接线校验失败，已忽略",
  "invalid-reference": "连接线引用不存在的节点，已忽略",
  "invalid-layer": "层级定义无效，已忽略",
  "invalid-tour-step": "导览步骤无效，已忽略",
  "elk-layout-failed": "图谱布局计算失败",
};

function issueDisplayText(issue: GraphIssue): string {
  const knownCopy = ISSUE_CATEGORY_COPY[issue.category];
  const summary = knownCopy ?? "发现未分类的知识图谱问题";
  return issue.path ? `${summary}（位置：${issue.path}）` : summary;
}

function buildCopyText(issues: GraphIssue[]): string {
  const hasFatal = issues.some((i) => i.level === "fatal");
  const lines = hasFatal
    ? [
        "部分问题可能来自知识图谱界面渲染。",
        "请携带以下内容前往 github.com/Lum1104/Understand-Anything/issues 提交问题。",
        "",
      ]
    : [
        "knowledge-graph.json 中发现以下问题。",
        "这些问题来自知识生成过程，并非系统故障。",
        "你可以让智能体修复 knowledge-graph.json 中的这些具体问题：",
        "",
      ];

  const sorted = [...issues].sort((a, b) => {
    const order: Record<string, number> = { fatal: 0, dropped: 1, "auto-corrected": 2 };
    return (order[a.level] ?? 3) - (order[b.level] ?? 3);
  });

  for (const issue of sorted) {
    const label =
      issue.level === "auto-corrected"
        ? "自动修正"
        : issue.level === "dropped"
          ? "已忽略"
          : "致命";
    lines.push(`[${label}] ${issueDisplayText(issue)}`);
  }

  return lines.join("\n");
}

export default function WarningBanner({ issues }: WarningBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const fatal = issues.filter((i) => i.level === "fatal");
  const autoCorrected = issues.filter((i) => i.level === "auto-corrected");
  const dropped = issues.filter((i) => i.level === "dropped");
  const hasFatal = fatal.length > 0;

  const parts: string[] = [];
  if (fatal.length > 0) {
    parts.push(`${fatal.length} 个致命错误`);
  }
  if (autoCorrected.length > 0) {
    parts.push(`${autoCorrected.length} 项自动修正`);
  }
  if (dropped.length > 0) {
    parts.push(`${dropped.length} 个已忽略项`);
  }
  const summary = hasFatal
    ? `界面遇到：${parts.join("、")}`
    : `知识图谱已载入：${parts.join("、")}`;

  const handleCopy = useCallback(async () => {
    const text = buildCopyText(issues);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.warn("写入剪贴板失败，请从展开的问题列表中手动复制");
    }
  }, [issues]);

  if (issues.length === 0) return null;

  const containerClasses = hasFatal
    ? "bg-red-900/25 border-b border-red-700 text-red-200 text-sm"
    : "bg-amber-900/20 border-b border-amber-700 text-amber-200 text-sm";
  const hoverClasses = hasFatal
    ? "hover:bg-red-900/15"
    : "hover:bg-amber-900/10";
  const iconClasses = hasFatal ? "text-red-400" : "text-amber-400";
  const hintClasses = hasFatal ? "text-red-400/60" : "text-amber-400/60";
  const dividerClasses = hasFatal ? "border-red-700/50" : "border-amber-700/50";
  const footerTextClasses = hasFatal ? "text-red-200/70" : "text-amber-200/60";
  const buttonClasses = hasFatal
    ? "bg-red-800/40 text-red-200 hover:bg-red-800/60"
    : "bg-amber-800/40 text-amber-200 hover:bg-amber-800/60";
  const footerCopy = hasFatal
    ? "复制这些问题并在 GitHub 提交问题报告"
    : "复制这些问题，并让智能体修复 knowledge-graph.json";

  return (
    <div className={containerClasses}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="graph-issue-details"
        onClick={() => setExpanded((prev) => !prev)}
        className={`w-full flex items-center gap-2 px-5 py-3 text-left transition-colors ${hoverClasses}`}
      >
        <svg
          aria-hidden="true"
          className={`w-4 h-4 shrink-0 ${iconClasses} transition-transform duration-200 ${
            expanded ? "rotate-90" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>

        <svg
          aria-hidden="true"
          className={`w-4 h-4 shrink-0 ${iconClasses}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>

        <span className="flex-1">{summary}</span>

        <span className={`text-xs shrink-0 ${hintClasses}`}>
          {expanded ? "点击收起" : "点击展开"}
        </span>
      </button>

      {expanded && (
        <div id="graph-issue-details" className="px-5 pb-4">
          <div className="space-y-1 mb-3">
            {fatal.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold tracking-wider text-red-400 mb-1">
                  致命（{fatal.length}）
                </h4>
                {fatal.map((issue, i) => (
                  <div
                    key={`ft-${i}`}
                    className="flex items-start gap-2 py-0.5 pl-2 text-red-200"
                  >
                    <span className="text-red-400 shrink-0 mt-0.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                      </svg>
                    </span>
                    <span className="text-xs">{issueDisplayText(issue)}</span>
                  </div>
                ))}
              </div>
            )}

            {autoCorrected.length > 0 && (
              <div className={fatal.length > 0 ? "mt-2" : ""}>
                <h4 className="text-xs font-semibold tracking-wider text-amber-400 mb-1">
                  自动修正（{autoCorrected.length}）
                </h4>
                {autoCorrected.map((issue, i) => (
                  <div key={`ac-${i}`} className="flex items-start gap-2 py-0.5 pl-2 text-amber-200/80">
                    <span className="text-amber-400 shrink-0 mt-0.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span className="text-xs">{issueDisplayText(issue)}</span>
                  </div>
                ))}
              </div>
            )}

            {dropped.length > 0 && (
              <div className={fatal.length > 0 || autoCorrected.length > 0 ? "mt-2" : ""}>
                <h4 className="text-xs font-semibold tracking-wider text-orange-400 mb-1">
                  已忽略（{dropped.length}）
                </h4>
                {dropped.map((issue, i) => (
                  <div key={`dr-${i}`} className="flex items-start gap-2 py-0.5 pl-2 text-orange-300/80">
                    <span className="text-orange-400 shrink-0 mt-0.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </span>
                    <span className="text-xs">{issueDisplayText(issue)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`flex items-center justify-between pt-2 border-t ${dividerClasses}`}>
            <p className={`text-xs ${footerTextClasses}`}>{footerCopy}</p>
            <button
              type="button"
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors shrink-0 ml-4 ${buttonClasses}`}
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  已复制
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  复制问题
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
