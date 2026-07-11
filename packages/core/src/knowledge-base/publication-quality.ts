import type {
  KnowledgeDocumentCategory,
  KnowledgeDocumentRole,
  ReferenceTemplateKind,
  SymbolAnchor,
} from "./types.js";

export interface PublicationDocument {
  path: string;
  title: string;
  category: KnowledgeDocumentCategory;
  role: KnowledgeDocumentRole;
  content: string;
  directNodeIds: string[];
  representedEdgeIds: string[];
  symbolAnchors: SymbolAnchor[];
  referenceKind?: ReferenceTemplateKind;
}

export interface PublicationEvidence {
  nodeId: string;
  filePath: string;
  lineRange: [number, number];
  excerpt: string;
  claim: string;
}

export interface PublicationDecision {
  quality: "generated" | "needs-review" | "failed";
  publishAsFeatured: boolean;
  issues: string[];
}

export interface PublicationCorpusEntry {
  document: PublicationDocument;
  evidence: PublicationEvidence[];
}

export interface PublicationCorpusResult extends PublicationCorpusEntry {
  decision: PublicationDecision;
}

export const REQUIRED_SECTIONS = {
  overview: ["项目目标与边界", "完整生命周期", "核心模块", "配置、依赖与测试", "推荐阅读路线", "源码证据"],
  capability: ["业务场景与触发", "规则与分支", "输入输出与状态变化", "异常与降级", "模块实现", "源码证据"],
  flow: ["目标与触发", "排除条件", "执行阶段", "规则、分支与数据变化", "异常、回退与可观测性", "源码证据"],
  module: ["职责与非职责", "入口、输出与核心文件", "依赖与主要流程", "状态、配置与测试边界", "风险与排查入口", "源码证据"],
  topic: ["为什么关键", "完整条件与跳过规则", "输入输出与状态变化", "算法、分支与降级", "依赖、测试与可观测性", "源码证据"],
  "file:code": ["文件职责", "输入、输出与关键字段", "规则、分支与状态变化", "配置、依赖与副作用", "异常、测试与改动风险", "函数与类型", "源码证据"],
  "file:configuration": ["配置目的与作用域", "配置项、类型与默认值", "读取位置与生效顺序", "缺失、非法值与降级", "测试与改动风险", "源码证据"],
  "file:schema": ["数据模型与边界", "字段、类型与约束", "读写方与生命周期", "校验、迁移与兼容性", "测试与改动风险", "源码证据"],
  "file:documentation": ["文档目的与读者", "关键结论", "链接与外部依赖", "与代码的对应关系", "过期风险与维护入口", "源码证据"],
  "file:test": ["被测行为与范围", "用例、输入与断言", "Fixture、Mock 与外部依赖", "失败分支与回归风险", "尚未覆盖的行为", "与生产代码的对应关系", "源码证据"],
} as const;

export type PublicationSectionKey = keyof typeof REQUIRED_SECTIONS;

const GENERIC_PHRASES = [
  "承担核心逻辑",
  "处理相关能力",
  "接收上游传入的业务上下文",
  "主要把处理结果返回给调用方",
] as const;
const EVIDENCE_ARTIFACT_SUBJECT = /(?:该)?(?:源码(?:摘录|位置)?|代码(?:摘录|片段|位置)?|摘录|证据|来源|节点|文件)/u;
const META_EVIDENCE_PREDICATE = /(?:支持|证明|支撑|表明|说明|佐证|印证|记录|体现|展示|反映|对应)/u;
const GENERIC_PUBLICATION_OBJECT = /(?:本页|本文|当前页面|页面中|页面的|直接讲解的主题入口|结论|(?:相关|独立|相邻|职责|风险|主题)的?说明|主题入口)/u;

const TRADITIONAL_ONLY_CHARACTERS = /[體臺萬與為後發裡這麼說從個還]/u;
const BEHAVIOR_EDGE_TYPES = new Set([
  "calls",
  "routes",
  "flow_step",
  "triggers",
  "transforms",
  "reads_from",
  "writes_to",
  "validates",
  "publishes",
  "subscribes",
  "middleware",
]);
const MIN_HAN_BY_ROLE: Record<KnowledgeDocumentRole, number> = {
  featured: 80,
  reference: 40,
  maintenance: 0,
};
const EVIDENCE_MINIMUM: Partial<Record<KnowledgeDocumentCategory, number>> = {
  overview: 6,
  capability: 3,
  flow: 5,
  module: 5,
  topic: 3,
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function appendIssue(issues: string[], issue: string): void {
  if (!issues.includes(issue)) issues.push(issue);
}

function masked(value: string): string {
  return value.replace(/[^\r\n]/g, " ");
}

function maskFencedCode(markdown: string): string {
  let fence: { marker: "`" | "~"; length: number } | undefined;
  return markdown.split(/(\r?\n)/).map((line) => {
    if (/^\r?\n$/.test(line)) return line;

    if (fence) {
      const closing = line.match(/^ {0,3}(`+|~+)[ \t]*$/)?.[1];
      if (closing?.[0] === fence.marker && closing.length >= fence.length) {
        fence = undefined;
      }
      return masked(line);
    }

    const opening = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (!opening) return line;
    const marker = opening[1][0] as "`" | "~";
    if (marker === "`" && opening[2].includes("`")) return line;
    fence = { marker, length: opening[1].length };
    return masked(line);
  }).join("");
}

function backtickRunLength(value: string, start: number): number {
  let end = start;
  while (value[end] === "`") end += 1;
  return end - start;
}

function isBackslashEscaped(value: string, index: number): boolean {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function maskInlineCode(markdown: string): string {
  let result = "";
  let index = 0;
  while (index < markdown.length) {
    if (markdown[index] !== "`") {
      result += markdown[index];
      index += 1;
      continue;
    }

    const openingLength = backtickRunLength(markdown, index);
    if (isBackslashEscaped(markdown, index)) {
      result += markdown.slice(index, index + openingLength);
      index += openingLength;
      continue;
    }
    let cursor = index + openingLength;
    let closingEnd = -1;
    while (cursor < markdown.length) {
      if (markdown[cursor] !== "`") {
        cursor += 1;
        continue;
      }
      const closingLength = backtickRunLength(markdown, cursor);
      if (closingLength === openingLength) {
        closingEnd = cursor + closingLength;
        break;
      }
      cursor += closingLength;
    }

    if (closingEnd < 0) {
      result += markdown.slice(index, index + openingLength);
      index += openingLength;
      continue;
    }
    result += masked(markdown.slice(index, closingEnd));
    index = closingEnd;
  }
  return result;
}

export function maskMarkdownCode(markdown: string): string {
  return maskInlineCode(maskFencedCode(markdown));
}

function proseWithoutCode(markdown: string): string {
  return maskMarkdownCode(markdown)
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/(?:^|\s)(?:\.{0,2}\/)?(?:[\w.-]+\/)+[\w.-]+(?=\s|$|[,:：，。])/g, " ")
    .replace(/\b[A-Za-z_$][\w$.:/-]*\b/g, " ");
}

export function containsGenericPublicationPhrase(markdown: string): boolean {
  const prose = proseWithoutCode(markdown);
  return GENERIC_PHRASES.some((phrase) => prose.includes(phrase));
}

function proseForCharacterChecks(markdown: string): string {
  return proseWithoutCode(markdown)
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:#|\|)/.test(line))
    .join("\n");
}

function hanCharacterCount(markdown: string): number {
  return proseForCharacterChecks(markdown).match(/\p{Script=Han}/gu)?.length ?? 0;
}

function levelTwoHeadings(markdown: string): Set<string> {
  return new Set(
    [...markdown.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => match[1].trim()),
  );
}

export function requiredSectionsForDocument(document: PublicationDocument): readonly string[] | null {
  if (document.category === "file") {
    if (!document.referenceKind) return null;
    const key = `file:${document.referenceKind}` as PublicationSectionKey;
    return REQUIRED_SECTIONS[key] ?? null;
  }
  if (document.category in REQUIRED_SECTIONS) {
    return REQUIRED_SECTIONS[document.category as PublicationSectionKey];
  }
  return [];
}

export function isValidPublicationEvidence(evidence: PublicationEvidence): boolean {
  const [start, end] = evidence.lineRange ?? [];
  const claim = evidence.claim?.replace(/\s+/g, "") ?? "";
  const nonConcreteClaim = Boolean(
    EVIDENCE_ARTIFACT_SUBJECT.test(claim)
    && META_EVIDENCE_PREDICATE.test(claim)
    && GENERIC_PUBLICATION_OBJECT.test(claim),
  );
  return Boolean(
    evidence.nodeId?.trim()
    && evidence.filePath?.trim()
    && evidence.excerpt?.trim()
    && /\p{Script=Han}/u.test(claim)
    && !nonConcreteClaim
    && Number.isInteger(start)
    && Number.isInteger(end)
    && start > 0
    && end >= start,
  );
}

function distinctEvidenceGroupCount(evidence: readonly PublicationEvidence[]): number {
  return new Set(evidence.map((item) => `${item.filePath}:${item.lineRange[0]}-${item.lineRange[1]}`)).size;
}

function anchorOccurrenceCount(markdown: string, anchor: string): number {
  return markdown.match(new RegExp(`id="${escapeRegExp(anchor)}"`, "g"))?.length ?? 0;
}

function behaviorEdgeCount(edgeIds: readonly string[]): number {
  return edgeIds.filter((edgeId) => BEHAVIOR_EDGE_TYPES.has(edgeId.split(":", 1)[0])).length;
}

export function evaluatePublication(
  document: PublicationDocument,
  sourceEvidence: readonly PublicationEvidence[],
): PublicationDecision {
  const issues: string[] = [];
  const headings = levelTwoHeadings(document.content);
  const requiredSections = requiredSectionsForDocument(document);
  if (requiredSections === null) {
    appendIssue(issues, "文件文档缺少有效 referenceKind");
  } else {
    for (const section of requiredSections) {
      if (!headings.has(section)) appendIssue(issues, `正文缺少必需章节：${section}`);
    }
  }

  const prose = proseWithoutCode(document.content);
  if (containsGenericPublicationPhrase(document.content)) {
    appendIssue(issues, "正文包含空泛模板语句");
  }

  const insufficientProse = hanCharacterCount(document.content) < MIN_HAN_BY_ROLE[document.role];
  if (insufficientProse) appendIssue(issues, "正文有效中文内容不足");
  if (TRADITIONAL_ONLY_CHARACTERS.test(proseForCharacterChecks(document.content))) {
    appendIssue(issues, "正文包含非简体中文用字");
  }

  const validEvidence = sourceEvidence.filter(isValidPublicationEvidence);
  if (validEvidence.length === 0) appendIssue(issues, "正文缺少有效源码证据");
  const evidenceByNodeId = new Set(validEvidence.map((item) => item.nodeId));
  for (const nodeId of [...new Set(document.directNodeIds)]) {
    if (!evidenceByNodeId.has(nodeId)) {
      appendIssue(issues, `源码证据未覆盖直接讲解节点：${nodeId}`);
    }
  }

  const evidenceMinimum = EVIDENCE_MINIMUM[document.category] ?? 0;
  if (evidenceMinimum > 0 && distinctEvidenceGroupCount(validEvidence) < evidenceMinimum) {
    appendIssue(issues, `源码证据数量不足：至少需要 ${evidenceMinimum} 组`);
  }

  if (document.category === "flow") {
    if (new Set(document.directNodeIds).size < 3) {
      appendIssue(issues, "流程缺少至少三个可验证阶段");
    }
    if (behaviorEdgeCount(document.representedEdgeIds) < 2) {
      appendIssue(issues, "流程缺少至少两个可验证行为关系");
    }
  }

  if (document.category === "file") {
    for (const symbol of document.symbolAnchors) {
      if (anchorOccurrenceCount(document.content, symbol.anchor) !== 1) {
        appendIssue(issues, `文件正文缺少唯一符号锚点：${symbol.nodeId}`);
      }
    }
  }

  if (issues.length === 0) {
    return {
      quality: "generated",
      publishAsFeatured: document.role === "featured",
      issues: [],
    };
  }

  const shortReferenceOnly = document.role === "reference"
    && insufficientProse
    && issues.length === 1
    && issues[0] === "正文有效中文内容不足";
  return {
    quality: shortReferenceOnly ? "needs-review" : "failed",
    publishAsFeatured: false,
    issues,
  };
}

function normalizedRepeatedLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || /^(?:#|\||```|~~~)/.test(trimmed)) return null;
  const normalized = trimmed
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[\s`*_#>\-:：,，.。;；、()[\]{}|/\\]/g, "")
    .toLowerCase();
  return normalized.length >= 32 ? normalized : null;
}

export function evaluatePublicationCorpus(
  entries: readonly PublicationCorpusEntry[],
): PublicationCorpusResult[] {
  const results = entries.map((entry) => ({
    document: entry.document,
    evidence: entry.evidence,
    decision: evaluatePublication(entry.document, entry.evidence),
  }));
  const lineDocuments = new Map<string, Set<number>>();
  entries.forEach((entry, index) => {
    const uniqueLines = new Set(
      maskMarkdownCode(entry.document.content)
        .split(/\r?\n/)
        .map(normalizedRepeatedLine)
        .filter((line): line is string => Boolean(line)),
    );
    for (const line of uniqueLines) {
      const documents = lineDocuments.get(line) ?? new Set<number>();
      documents.add(index);
      lineDocuments.set(line, documents);
    }
  });

  const threshold = Math.max(5, Math.ceil(entries.length * 0.2));
  const affected = new Set<number>();
  for (const documentIndexes of lineDocuments.values()) {
    if (documentIndexes.size < threshold) continue;
    for (const index of documentIndexes) affected.add(index);
  }
  for (const index of affected) {
    const result = results[index];
    appendIssue(result.decision.issues, "正文包含跨文档重复模板语句");
    result.decision.quality = "failed";
    result.decision.publishAsFeatured = false;
  }
  return results;
}
