import type { GraphNode } from "../types.js";
import type {
  BusinessCapability,
  BusinessCapabilityProfile,
  BusinessEvidenceConfidence,
  BusinessEvidenceRole,
  BusinessEvidenceSourceKind,
  BusinessFact,
  BusinessFactKind,
  FileDocPlan,
  FileDocTask,
  ProjectProfile,
  SourceEvidence,
} from "./types.js";

const MAX_FACTS_PER_FILE = 80;
const MAX_EXCERPT_LENGTH = 220;

const BUSINESS_LEXICON = [
  "业务",
  "表单",
  "注册表单",
  "导流",
  "订单",
  "策略",
  "规则",
  "实验",
  "配额",
  "命中",
  "场景",
  "召回",
  "推荐",
  "降级",
  "文案",
  "过滤",
  "准入",
  "表单校验",
  "默认选项",
  "form",
  "formtype",
  "strategy",
  "rule",
  "quota",
  "scene",
  "experiment",
  "ranking",
] as const;

const HIGH_SIGNAL_WORDS = [
  "注册表单",
  "表单校验",
  "默认选项",
  "表单",
  "form",
  "formtype",
  "strategy",
  "quota",
  "experiment",
  "策略",
  "规则",
  "实验",
  "配额",
] as const;

const GENERIC_PATH_KEYWORD_FALLBACKS = new Set(["test", "type"]);

function stableSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "fact";
}

function capExcerpt(value: string): string {
  const compact = value.trim().replace(/\s+/g, " ");
  return compact.length <= MAX_EXCERPT_LENGTH
    ? compact
    : `${compact.slice(0, MAX_EXCERPT_LENGTH - 1)}…`;
}

function containsBusinessSignal(text: string): boolean {
  const lower = text.toLowerCase();
  return BUSINESS_LEXICON.some((word) => lower.includes(word.toLowerCase()));
}

function keywordsFromText(text: string, filePath = ""): string[] {
  const lower = `${text} ${filePath}`.toLowerCase();
  const keywords = new Set<string>();
  for (const word of BUSINESS_LEXICON) {
    if (lower.includes(word.toLowerCase())) keywords.add(word);
  }
  if (/注册表单|registration[_\s-]*form|sign[_\s-]*up[_\s-]*form/i.test(text)) {
    keywords.add("注册表单");
  }
  if (/form[_-]?type|formtype/i.test(`${text} ${filePath}`)) keywords.add("formtype");
  for (const segment of filePath.split(/[/.\\_-]+/)) {
    const normalizedSegment = segment.toLowerCase();
    if (
      normalizedSegment.length >= 4 &&
      /[a-z]/i.test(normalizedSegment) &&
      !GENERIC_PATH_KEYWORD_FALLBACKS.has(normalizedSegment)
    ) {
      keywords.add(normalizedSegment);
    }
  }
  return [...keywords].sort();
}

function titleFromLine(line: string): string {
  return line
    .replace(/^\s*(\/\/|\/\*+|\*+\/?)/, "")
    .replace(/\*\/\s*$/, "")
    .trim()
    .slice(0, 120);
}

function matchingNodeIdsForLine(profile: ProjectProfile, task: FileDocTask, lineNumber: number): string[] {
  const related = new Set<string>([task.fileNodeId]);
  for (const nodeId of [...task.functionNodeIds, ...task.classNodeIds]) {
    const node = profile.indexes.nodesById.get(nodeId);
    const range = node?.lineRange;
    if (range && lineNumber >= range[0] && lineNumber <= range[1]) {
      related.add(nodeId);
    }
  }
  return [...related].sort();
}

function sourceEvidence(task: FileDocTask, lineNumber: number, line: string, nodeId?: string): SourceEvidence {
  return {
    filePath: task.filePath,
    lineRange: [lineNumber, lineNumber],
    nodeId: nodeId ?? task.fileNodeId,
    excerpt: capExcerpt(line),
  };
}

function isTestPath(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, "/");
  if (/(^|\/)(__tests__|test|tests)(\/|$)/i.test(normalizedPath)) return true;
  const fileName = normalizedPath.split("/").pop() ?? normalizedPath;
  return /(?:^|[._-])(?:test|spec)\.[cm]?[jt]sx?$/i.test(fileName);
}

function isDocumentationPath(filePath: string): boolean {
  return /(^|[/\\])(docs?|design|adr|review)([/\\]|$)|\.(md|mdx|txt)$/i.test(filePath);
}

function isPromptOrToolingPath(filePath: string): boolean {
  return /(^|[/\\])(agents|skills|prompts|fixtures)([/\\]|$)|generate-knowledge-base\.mjs$|business-facts\.ts$/i.test(filePath);
}

function sourceKindFor(filePath: string, kind: BusinessFactKind): BusinessEvidenceSourceKind {
  if (kind === "config") return "configuration";
  if (kind === "document") return "documentation";
  if (kind === "graph-node") return "graph-structure";
  if (isPromptOrToolingPath(filePath)) return "prompt-or-tooling-example";
  if (isTestPath(filePath) || kind === "test") return "test";
  if (isDocumentationPath(filePath)) return "documentation";
  if (kind === "comment") return "comment";
  if (kind === "constant" || kind === "branch") return "production-logic";
  return "graph-structure";
}

function roleForSourceKind(sourceKind: BusinessEvidenceSourceKind): BusinessEvidenceRole {
  if (sourceKind === "production-logic" || sourceKind === "configuration") return "primary";
  if (sourceKind === "prompt-or-tooling-example") return "example-only";
  return "supporting";
}

function confidenceForSourceKind(sourceKind: BusinessEvidenceSourceKind): BusinessEvidenceConfidence {
  if (sourceKind === "production-logic" || sourceKind === "configuration") return "high";
  if (sourceKind === "comment" || sourceKind === "test" || sourceKind === "documentation") return "medium";
  return "low";
}

function riskFlagsForSourceKind(sourceKind: BusinessEvidenceSourceKind): string[] {
  if (sourceKind === "test") return ["test-only"];
  if (sourceKind === "prompt-or-tooling-example") return ["prompt-only"];
  if (sourceKind === "comment") return ["comment-only"];
  if (sourceKind === "graph-structure") return ["graph-only"];
  return [];
}

function businessMeaningFor(kind: BusinessFactKind, line: string, sourceKind: BusinessEvidenceSourceKind): string {
  const title = titleFromLine(line);
  if (sourceKind === "production-logic") return `生产代码中出现的业务规则或分支：${title}`;
  if (sourceKind === "configuration") return `配置或常量证据描述了可调整的业务规则：${title}`;
  if (sourceKind === "test") return `测试样例覆盖了该业务场景，但仍需生产代码共同确认：${title}`;
  if (sourceKind === "prompt-or-tooling-example") return `工具或提示词中的示例业务词，只能作为抽取样例：${title}`;
  if (kind === "comment") return `代码注释说明了业务意图：${title}`;
  return `图谱或文档中出现的业务线索：${title}`;
}

function factKindForLine(filePath: string, line: string): BusinessFactKind | null {
  const trimmed = line.trim();
  const hasBusinessSignal = containsBusinessSignal(trimmed);
  const isTestFile = isTestPath(filePath);
  const isPromptOrToolingFile = isPromptOrToolingPath(filePath);
  const isDocumentationFile = isDocumentationPath(filePath);
  if (isPromptOrToolingFile && hasBusinessSignal) return "comment";
  if (/^(\/\/|\/\*|\*)/.test(trimmed) && containsBusinessSignal(trimmed)) return "comment";
  if (isTestFile && /\b(it|test|describe)\s*\(/.test(trimmed) && containsBusinessSignal(trimmed)) return "test";
  if (isDocumentationFile && hasBusinessSignal) return "document";
  if (/\b(const|let|var)\s+[A-Za-z0-9_]*|\benum\s+[A-Za-z0-9_]+/.test(trimmed) && containsBusinessSignal(trimmed)) return "constant";
  if (/\bcase\s+['"`]?[A-Za-z0-9_.-]+['"`]?\s*:|\bif\s*\(|\bswitch\s*\(/.test(trimmed) && containsBusinessSignal(trimmed)) return "branch";
  return null;
}

function scoreForKind(kind: BusinessFactKind): number {
  if (kind === "test") return 16;
  if (kind === "comment") return 14;
  if (kind === "constant") return 12;
  if (kind === "branch") return 10;
  if (kind === "document") return 9;
  if (kind === "config") return 8;
  return 5;
}

function makeFact(
  profile: ProjectProfile,
  task: FileDocTask,
  kind: BusinessFactKind,
  lineNumber: number,
  line: string,
): BusinessFact {
  const relatedNodeIds = matchingNodeIdsForLine(profile, task, lineNumber);
  const title = titleFromLine(line);
  const sourceKind = sourceKindFor(task.filePath, kind);
  const evidenceRole = roleForSourceKind(sourceKind);
  const confidence = confidenceForSourceKind(sourceKind);
  const riskFlags = riskFlagsForSourceKind(sourceKind);
  return {
    id: `business-fact:${task.filePath}:${lineNumber}:${kind}:${stableSlug(title)}`,
    kind,
    title,
    summary: title,
    keywords: keywordsFromText(line, task.filePath),
    relatedNodeIds,
    evidence: [sourceEvidence(task, lineNumber, line, relatedNodeIds[0])],
    score: scoreForKind(kind),
    sourceKind,
    evidenceRole,
    confidence,
    businessMeaning: businessMeaningFor(kind, line, sourceKind),
    riskFlags,
  };
}

export function extractBusinessFactsFromFileTask(
  profile: ProjectProfile,
  task: FileDocTask,
): BusinessFact[] {
  if (!task.sourceSnapshot.exists || task.sourceSnapshot.text.length === 0) return [];

  const facts: BusinessFact[] = [];
  const lines = task.sourceSnapshot.text.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const kind = factKindForLine(task.filePath, line);
    if (!kind) continue;
    facts.push(makeFact(profile, task, kind, index + 1, line));
    if (facts.length >= MAX_FACTS_PER_FILE) break;
  }

  return facts;
}

function nodeFactKind(node: GraphNode): BusinessFactKind {
  if (node.type === "config") return "config";
  if (node.type === "document") return "document";
  return "graph-node";
}

function factFromNode(node: GraphNode): BusinessFact | null {
  const text = [node.name, node.filePath ?? "", node.summary, ...node.tags].join(" ");
  if (!containsBusinessSignal(text)) return null;
  const kind = nodeFactKind(node);
  const sourcePath = node.filePath ?? node.name;
  const sourceKind = sourceKindFor(sourcePath, kind);
  const evidenceRole = roleForSourceKind(sourceKind);
  const confidence = confidenceForSourceKind(sourceKind);
  const evidence: SourceEvidence = {
    filePath: sourcePath,
    nodeId: node.id,
    excerpt: capExcerpt(node.summary || node.name),
  };
  return {
    id: `business-fact:${node.id}`,
    kind,
    title: node.name,
    summary: node.summary,
    keywords: keywordsFromText(text, node.filePath ?? node.name),
    relatedNodeIds: [node.id],
    evidence: [evidence],
    score: scoreForKind(kind),
    sourceKind,
    evidenceRole,
    confidence,
    businessMeaning: businessMeaningFor(kind, node.summary || node.name, sourceKind),
    riskFlags: riskFlagsForSourceKind(sourceKind),
  };
}

function capabilityKeyForFact(fact: BusinessFact): string {
  if (fact.keywords.includes("注册表单")) return "注册表单";
  if (fact.keywords.includes("formtype")) return "formtype";
  const highSignal = fact.keywords.find((keyword) => (HIGH_SIGNAL_WORDS as readonly string[]).includes(keyword));
  return highSignal ?? fact.keywords[0] ?? stableSlug(fact.title);
}

function capabilityTitle(key: string, facts: BusinessFact[]): string {
  if (key === "注册表单") return "注册表单";
  const factWithChineseTitle = facts.find((fact) => /[\u4e00-\u9fff]/.test(fact.title));
  if (factWithChineseTitle && key !== "formtype") return factWithChineseTitle.title.slice(0, 40);
  if (key === "formtype") return "FormType / 表单类型";
  return key;
}

function capabilityRoleForFacts(facts: BusinessFact[]): BusinessEvidenceRole {
  if (facts.some((fact) => fact.evidenceRole === "primary")) return "primary";
  if (facts.some((fact) => fact.evidenceRole === "supporting")) return "supporting";
  return "example-only";
}

function capabilityConfidenceForFacts(facts: BusinessFact[]): BusinessEvidenceConfidence {
  if (facts.some((fact) => fact.confidence === "high")) return "high";
  if (facts.some((fact) => fact.confidence === "medium")) return "medium";
  return "low";
}

function sourceKindCountsForFacts(facts: BusinessFact[]): Partial<Record<BusinessEvidenceSourceKind, number>> {
  const counts: Partial<Record<BusinessEvidenceSourceKind, number>> = {};
  for (const fact of facts) {
    counts[fact.sourceKind] = (counts[fact.sourceKind] ?? 0) + 1;
  }
  return counts;
}

function capabilityRoleRank(role: BusinessEvidenceRole): number {
  if (role === "primary") return 3;
  if (role === "supporting") return 2;
  return 1;
}

function buildCapabilities(facts: BusinessFact[]): BusinessCapability[] {
  const grouped = new Map<string, BusinessFact[]>();
  for (const fact of facts) {
    const key = capabilityKeyForFact(fact);
    const group = grouped.get(key) ?? [];
    group.push(fact);
    grouped.set(key, group);
  }

  return [...grouped.entries()]
    .filter(([key, group]) => group.length >= 2 || (HIGH_SIGNAL_WORDS as readonly string[]).includes(key))
    .map(([key, group]) => {
      const keywords = [...new Set(group.flatMap((fact) => fact.keywords))].sort();
      const relatedNodeIds = [...new Set(group.flatMap((fact) => fact.relatedNodeIds))].sort();
      const evidence = group.flatMap((fact) => fact.evidence).slice(0, 20);
      const evidenceRole = capabilityRoleForFacts(group);
      const confidence = capabilityConfidenceForFacts(group);
      const roleBoost = evidenceRole === "primary"
        ? 50
        : evidenceRole === "supporting"
          ? 20
          : 0;
      const score = group.reduce((sum, fact) => sum + fact.score, 0) + group.length * 3 + roleBoost;
      const primaryFactIds = group.filter((fact) => fact.evidenceRole === "primary").map((fact) => fact.id).sort();
      const supportingFactIds = group.filter((fact) => fact.evidenceRole === "supporting").map((fact) => fact.id).sort();
      const exampleOnlyFactIds = group.filter((fact) => fact.evidenceRole === "example-only").map((fact) => fact.id).sort();
      return {
        id: `business-capability:${stableSlug(key)}`,
        title: capabilityTitle(key, group),
        keywords,
        factIds: group.map((fact) => fact.id).sort(),
        relatedNodeIds,
        evidence,
        score,
        evidenceRole,
        confidence,
        sourceKindCounts: sourceKindCountsForFacts(group),
        primaryFactIds,
        supportingFactIds,
        exampleOnlyFactIds,
      };
    })
    .sort((a, b) =>
      capabilityRoleRank(b.evidenceRole) - capabilityRoleRank(a.evidenceRole) ||
      b.score - a.score ||
      a.id.localeCompare(b.id) ||
      a.title.localeCompare(b.title)
    );
}

export function buildBusinessCapabilityProfile(
  profile: ProjectProfile,
  fileDocPlan: FileDocPlan,
): BusinessCapabilityProfile {
  const sourceFacts = fileDocPlan.tasks.flatMap((task) => extractBusinessFactsFromFileTask(profile, task));
  const graphFacts = profile.graph.nodes
    .filter((node) => node.type === "config" || node.type === "document")
    .map(factFromNode)
    .filter((fact): fact is BusinessFact => Boolean(fact));
  const facts = [...sourceFacts, ...graphFacts].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const sourceBackedFacts = facts.filter((fact) =>
    fact.evidence.some((item) => item.lineRange && item.filePath)
  ).length;

  return {
    facts,
    capabilities: buildCapabilities(facts),
    totalFacts: facts.length,
    sourceBackedFacts,
  };
}
