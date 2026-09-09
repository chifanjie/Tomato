#!/usr/bin/env node
// Reports the health of an Understand Code installation and of one project's
// generated artifacts. Read-only. Exits 0 when healthy, 1 when action is needed.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = resolve(process.argv[2] ?? process.cwd());
const stateDir = join(projectRoot, ".understand-code");
const kbDir = join(stateDir, "knowledge-base");

const checks = [];
const nextSteps = [];

/** @param {"ok"|"warn"|"fail"} level */
function record(level, name, detail) {
  checks.push({ level, name, detail });
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

function version(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function git(args) {
  try {
    return execFileSync("git", args, {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function majorOf(text) {
  const match = /(\d+)\./.exec(text ?? "");
  return match ? Number(match[1]) : null;
}

// --- Installation -----------------------------------------------------------

record("ok", "插件根目录", PLUGIN_ROOT);
record(
  process.env.CLAUDE_PLUGIN_ROOT ? "ok" : "warn",
  "宿主绑定",
  process.env.CLAUDE_PLUGIN_ROOT
    ? `CLAUDE_PLUGIN_ROOT=${process.env.CLAUDE_PLUGIN_ROOT}`
    : "CLAUDE_PLUGIN_ROOT 未设置（非 Claude 宿主或直接运行时属正常）",
);

const nodeMajor = majorOf(process.version);
record(
  nodeMajor !== null && nodeMajor >= 22 ? "ok" : "fail",
  "Node 版本",
  `${process.version}（需要 ≥ 22）`,
);
if (nodeMajor !== null && nodeMajor < 22) nextSteps.push("升级 Node.js 到 22 或更高版本");

const pnpmVersion = version("pnpm", ["--version"]);
const pnpmMajor = majorOf(pnpmVersion);
record(
  pnpmVersion === null ? "fail" : pnpmMajor !== null && pnpmMajor >= 10 ? "ok" : "warn",
  "pnpm 版本",
  pnpmVersion === null ? "未找到 pnpm（构建 core 时需要）" : `${pnpmVersion}（建议 ≥ 10）`,
);
if (pnpmVersion === null) nextSteps.push("安装 pnpm ≥ 10");

const coreDist = join(PLUGIN_ROOT, "packages/core/dist/index.js");
const coreBuilt = existsSync(coreDist);
record(coreBuilt ? "ok" : "fail", "core 构建产物", coreBuilt ? coreDist : "packages/core/dist 缺失");
if (!coreBuilt) {
  nextSteps.push(`cd "${PLUGIN_ROOT}" && pnpm install && pnpm --filter @understand-code/core build`);
}

// --- Project artifacts ------------------------------------------------------

record("ok", "分析目标", projectRoot);

const graphPath = join(stateDir, "knowledge-graph.json");
const graph = existsSync(graphPath) ? readJson(graphPath) : undefined;
if (!existsSync(graphPath)) {
  record("fail", "知识图谱", "未生成 .understand-code/knowledge-graph.json");
  nextSteps.push("运行 /understand 生成知识图谱");
} else if (graph === undefined) {
  record("fail", "知识图谱", "knowledge-graph.json 存在但无法解析");
  nextSteps.push("运行 /understand --full 重新生成知识图谱");
} else {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes.length : 0;
  const edges = Array.isArray(graph.edges) ? graph.edges.length : 0;
  const megabytes = (statSync(graphPath).size / 1024 / 1024).toFixed(1);
  record("ok", "知识图谱", `${nodes} 个节点 / ${edges} 条边（${megabytes} MB）`);
}

// Freshness against the checked-out commit.
const meta = readJson(join(stateDir, "meta.json"));
const recordedCommit = typeof meta?.gitCommitHash === "string" ? meta.gitCommitHash : null;
const headCommit = git(["rev-parse", "HEAD"]);
if (recordedCommit === null || headCommit === null) {
  record("warn", "图谱新鲜度", "无法比较（缺少 meta.json 记录或不在 git 工作区）");
} else if (recordedCommit === headCommit) {
  record("ok", "图谱新鲜度", `与 HEAD 一致（${headCommit.slice(0, 7)}）`);
} else {
  const behind = git(["rev-list", "--count", `${recordedCommit}..${headCommit}`]);
  const distance = behind !== null && /^\d+$/.test(behind) ? `落后 ${behind} 个提交` : "与 HEAD 不一致";
  record("warn", "图谱新鲜度", `${distance}（图谱基于 ${recordedCommit.slice(0, 7)}）`);
  nextSteps.push("运行 /understand 增量更新知识图谱");
}

// Knowledge base format and alignment.
const wikiIndexPath = join(kbDir, "wiki-index.json");
const relativeReportPath = ".understand-code/knowledge-base/.trace/generation-report.json";
const reportPath = join(kbDir, ".trace", "generation-report.json");

/** One line of a report entry, short enough to sit in an aligned column. */
function firstLine(text, limit = 72) {
  const line = String(text ?? "").split("\n")[0].trim();
  return line.length > limit ? `${line.slice(0, limit - 1)}…` : line;
}

if (!existsSync(kbDir)) {
  record("warn", "知识库", "未生成 .understand-code/knowledge-base/");
  nextSteps.push("运行 /understand-kb 生成知识库");
} else if (!existsSync(wikiIndexPath)) {
  // The dashboard reads wiki-index.json; an older layout renders as "尚未生成知识库".
  record("fail", "知识库格式", "缺少 wiki-index.json —— 属于旧版格式，Dashboard 无法读取");
  nextSteps.push("运行 /understand-kb 重新生成知识库（旧格式需要重建）");
} else {
  const wiki = readJson(wikiIndexPath);
  const pages = Array.isArray(wiki?.pages) ? wiki.pages.length : 0;
  const megabytes = (statSync(wikiIndexPath).size / 1024 / 1024).toFixed(1);
  record(
    wiki?.version === 2 ? "ok" : "warn",
    "知识库",
    `${pages} 篇文档，索引版本 ${wiki?.version ?? "未知"}（${megabytes} MB）`,
  );

  const wikiCommit = typeof wiki?.source?.gitCommitHash === "string" ? wiki.source.gitCommitHash : null;
  if (wikiCommit !== null && recordedCommit !== null && wikiCommit !== recordedCommit) {
    record("warn", "知识库与图谱一致性", "知识库基于另一份图谱快照生成，内容可能与图谱矛盾");
    nextSteps.push("运行 /understand-kb 让知识库与当前图谱对齐");
  }

  // The generation report records why a run came out incomplete. Nothing reads
  // it today, so "参考覆盖不完整" reached the reader with no way to act on it.
  const report = readJson(reportPath);
  const coverage = report?.referenceCoverage;
  if (coverage?.status === "partial") {
    const buckets = [["文件", coverage.files], ["函数", coverage.functions], ["类型", coverage.types]]
      .filter(([, bucket]) => bucket && bucket.total > 0)
      .map(([label, bucket]) => `${label} ${bucket.covered}/${bucket.total}`);
    const uncovered = [coverage.files, coverage.functions, coverage.types]
      .reduce((sum, bucket) => sum + (bucket?.missingIds?.length ?? 0), 0);
    record("warn", "参考覆盖", `${buckets.join("、")}；${uncovered} 项未覆盖，Dashboard 的「知识库状态」会逐条列出`);
  }

  const warnings = Array.isArray(report?.warnings) ? report.warnings : [];
  if (warnings.length > 0) {
    record("warn", "生成警告", `${warnings.length} 条，首条：${firstLine(warnings[0])}`);
    nextSteps.push(`查看 ${relativeReportPath} 中的完整警告`);
  }

  const errors = Array.isArray(report?.errors) ? report.errors : [];
  if (errors.length > 0) {
    record("fail", "生成错误", `${errors.length} 条，首条：${firstLine(errors[0])}`);
    nextSteps.push(`修复 ${relativeReportPath} 报告的生成错误后重新运行 /understand-kb`);
  }
}

// --- Report -----------------------------------------------------------------

const ICON = { ok: "✓", warn: "!", fail: "✗" };

/** Terminal columns a string occupies; CJK and full-width forms take two. */
export function displayWidth(text) {
  let width = 0;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    const wide = (code >= 0x1100 && code <= 0x115f)
      || (code >= 0x2e80 && code <= 0xa4cf)
      || (code >= 0xac00 && code <= 0xd7a3)
      || (code >= 0xf900 && code <= 0xfaff)
      || (code >= 0xfe30 && code <= 0xfe6f)
      || (code >= 0xff00 && code <= 0xff60)
      || (code >= 0xffe0 && code <= 0xffe6);
    width += wide ? 2 : 1;
  }
  return width;
}

const width = Math.max(...checks.map((check) => displayWidth(check.name)));

process.stdout.write("\nUnderstand Code 安装诊断\n");
process.stdout.write("─".repeat(56) + "\n");
for (const check of checks) {
  const pad = " ".repeat(Math.max(0, width - displayWidth(check.name)));
  process.stdout.write(`${ICON[check.level]} ${check.name}${pad}  ${check.detail}\n`);
}

const failed = checks.filter((check) => check.level === "fail").length;
const warned = checks.filter((check) => check.level === "warn").length;
process.stdout.write("─".repeat(56) + "\n");
process.stdout.write(`结论: ${failed} 项阻塞、${warned} 项提醒\n`);

if (nextSteps.length > 0) {
  process.stdout.write("\n下一步:\n");
  // Deduplicate while preserving the order checks produced them in.
  for (const step of [...new Set(nextSteps)]) process.stdout.write(`  - ${step}\n`);
} else {
  process.stdout.write("\n下一步: 无，安装与产物均正常。\n");
}

process.exitCode = failed > 0 ? 1 : 0;
