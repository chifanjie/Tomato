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

  const footerCopy = hasFatal
    ? "复制这些问题并在 GitHub 提交问题报告"
    : "复制这些问题，并让智能体修复 knowledge-graph.json";

  return (
    <div className="uc-status-banner" data-severity={hasFatal ? "problem" : "context"}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="graph-issue-details"
        onClick={() => setExpanded((prev) => !prev)}
        className="uc-status-banner-toggle"
      >
        <span className="uc-status-badge">{hasFatal ? "致命" : "生成提示"}</span>
        <span className="uc-status-summary">{summary}</span>
        <span className="uc-status-disclosure">
          {expanded ? "点击收起" : "点击展开"}
        </span>
      </button>

      {expanded && (
        <div id="graph-issue-details" className="uc-status-banner-details">
          <div>
            {fatal.length > 0 && (
              <div className="uc-status-group">
                <h4>
                  致命（{fatal.length}）
                </h4>
                {fatal.map((issue, i) => (
                  <p key={`ft-${i}`}>{issueDisplayText(issue)}</p>
                ))}
              </div>
            )}

            {autoCorrected.length > 0 && (
              <div className="uc-status-group">
                <h4>
                  自动修正（{autoCorrected.length}）
                </h4>
                {autoCorrected.map((issue, i) => (
                  <p key={`ac-${i}`}>{issueDisplayText(issue)}</p>
                ))}
              </div>
            )}

            {dropped.length > 0 && (
              <div className="uc-status-group">
                <h4>
                  已忽略（{dropped.length}）
                </h4>
                {dropped.map((issue, i) => (
                  <p key={`dr-${i}`}>{issueDisplayText(issue)}</p>
                ))}
              </div>
            )}
          </div>

          <div className="uc-status-banner-footer">
            <p>{footerCopy}</p>
            <button
              type="button"
              onClick={handleCopy}
              className="uc-status-copy"
            >
              {copied ? "已复制" : "复制问题"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
