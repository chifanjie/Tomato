import type { EdgeType, GraphNode, NodeType } from "../types.js";
import type {
  CoverageReport,
  CoverageRatio,
  CoverageValidationResult,
  BusinessCapabilityProfile,
  DocumentPlan,
  FileDocPlan,
  FileDocTask,
  FileWriterDocument,
  GeneratedDocument,
  KnowledgeBaseStatus,
  KnowledgeBaseDocumentCategory,
  RetryPlan,
  PlannedDocument,
  ProjectProfile,
  TopicPlanItem,
  TopicPlan,
  TopicWriterDocument,
} from "./types.js";
import { KB_PATHS, indexDocumentPath } from "./paths.js";
import type { MergeKnowledgeBaseWriterOutputsResult } from "./merge.js";
import { TOPIC_WRITER_REQUIRED_SECTIONS } from "./writer-contracts.js";

const DOCUMENT_CATEGORIES: KnowledgeBaseDocumentCategory[] = [
  "top-level",
  "index",
  "module",
  "file",
  "flow",
  "topic",
  "business-capability",
  "report",
  "intermediate",
];

const PLACEHOLDER_RE = /\b(TBD|TODO|FIXME)\b|待定|占位|后续补充|这里填写/i;
const LEGACY_PATHS = {
  architectureMap: "架构与模块总览.md",
  businessFlowMap: "业务流程总览.md",
  fileIndex: "文件索引.md",
  functionIndex: "函数索引.md",
  classIndex: "类索引.md",
  pendingItems: "风险点与待确认项.md",
  aiIndex: "AI检索索引.md",
} as const;
const RELATIONSHIP_COVERAGE_EDGE_TYPES: EdgeType[] = ["calls", "imports", "contains"];
const CATEGORY_LABELS: Record<KnowledgeBaseDocumentCategory, string> = {
  "top-level": "顶层导航",
  index: "索引",
  module: "模块总览",
  file: "文件文档",
  flow: "业务流程",
  topic: "关键专题",
  "business-capability": "业务能力",
  report: "报告",
  intermediate: "中间产物",
};
const NODE_TYPE_LABELS: Record<NodeType, string> = {
  file: "文件",
  function: "函数",
  class: "类",
  module: "模块",
  concept: "概念",
  config: "配置",
  document: "文档",
  service: "服务",
  table: "数据表",
  endpoint: "端点",
  pipeline: "管道",
  schema: "结构定义",
  resource: "资源",
  domain: "业务域",
  flow: "流程",
  step: "步骤",
  article: "文章",
  entity: "实体",
  topic: "主题",
  claim: "论断",
  source: "来源",
};
const EDGE_TYPE_LABELS: Partial<Record<EdgeType, string>> = {
  contains: "包含",
  contains_flow: "包含流程",
  flow_step: "流程步骤",
  imports: "导入",
  exports: "导出",
  inherits: "继承",
  implements: "实现",
  calls: "调用",
  subscribes: "订阅",
  publishes: "发布",
  middleware: "中间件",
  configures: "配置",
  reads_from: "读取",
  writes_to: "写入",
  transforms: "转换",
  validates: "校验",
  depends_on: "依赖",
  tested_by: "被测试覆盖",
  related: "相关",
  similar_to: "相似",
  deploys: "部署",
  serves: "服务于",
  provisions: "供应",
  triggers: "触发",
  migrates: "迁移",
  documents: "记录",
  routes: "路由",
  defines_schema: "定义结构",
  cross_domain: "跨业务域",
  cites: "引用",
  contradicts: "矛盾",
  builds_on: "基于",
  exemplifies: "举例说明",
  categorized_under: "归类到",
  authored_by: "作者",
};
const STATUS_LABELS: Record<KnowledgeBaseStatus, string> = {
  complete: "完整",
  "complete-with-warnings": "完整但有警告",
  incomplete: "不完整",
};

function isPath(path: string, currentPath: string, legacyPath?: string): boolean {
  return path === currentPath || path === legacyPath;
}

function nodeOf(profile: ProjectProfile, nodeId: string): GraphNode | undefined {
  return profile.indexes.nodesById.get(nodeId);
}

function nodesOfType(profile: ProjectProfile, type: NodeType): GraphNode[] {
  return profile.graph.nodes
    .filter((node) => node.type === type)
    .sort((a, b) => (a.filePath ?? a.id).localeCompare(b.filePath ?? b.id) || a.name.localeCompare(b.name));
}

function layerNameForNode(profile: ProjectProfile, nodeId: string): string {
  const layerId = profile.indexes.nodeToLayerId.get(nodeId);
  if (!layerId) return "未分层";
  return profile.layerProfiles.find((layer) => layer.id === layerId)?.name ?? layerId;
}

function edgeName(profile: ProjectProfile, nodeId: string): string {
  const node = nodeOf(profile, nodeId);
  return node ? `${node.name} (${NODE_TYPE_LABELS[node.type]})` : nodeId;
}

function edgeId(edge: { type: string; source: string; target: string }): string {
  return `${edge.type}:${edge.source}->${edge.target}`;
}

function nodeLabel(profile: ProjectProfile, nodeId: string): string {
  const node = nodeOf(profile, nodeId);
  return node ? `${node.name} (${NODE_TYPE_LABELS[node.type]})` : nodeId;
}

function hasChinese(text: string | undefined): boolean {
  return Boolean(text && /[\u4e00-\u9fff]/.test(text));
}

function tagText(node: GraphNode | undefined): string {
  return node && node.tags.length > 0 ? node.tags.join("、") : "当前代码职责";
}

function nodeSummary(node: GraphNode | undefined, fallback = "图谱没有提供摘要。"): string {
  if (!node) return `本地代码事实: ${fallback}`;
  if (hasChinese(node.summary)) return node.summary;
  return `本地代码事实: 图谱记录了 ${node.name} 节点；根据名称、标签和关系推断，它与 ${tagText(node)} 相关。根据代码推断，需线上配置确认`;
}

function layerDescription(description: string, layerName: string): string {
  if (hasChinese(description)) return description;
  return `本地代码事实: 图谱将该层命名为 ${layerName}；该层职责需要结合文件和函数索引确认。根据代码推断，需线上配置确认`;
}

function projectDescription(profile: ProjectProfile): string {
  const description = profile.graph.project.description;
  if (hasChinese(description)) return description;
  return `${profile.graph.project.name} 的代码结构知识库。`;
}

function coverageLevelLabel(level: string | undefined): string {
  if (level === "index") return "已进入索引";
  if (level === "overview") return "已进入总览";
  if (level === "topic") return "已生成专题";
  if (level === "pending-verification") return "待核验";
  return "未覆盖";
}

function booleanLabel(value: boolean): string {
  return value ? "是" : "否";
}

function edgeTypeLabel(edgeType: string): string {
  return EDGE_TYPE_LABELS[edgeType as EdgeType] ?? edgeType;
}

function complexityLabel(complexity: GraphNode["complexity"]): string {
  if (complexity === "simple") return "简单";
  if (complexity === "moderate") return "中等";
  if (complexity === "complex") return "复杂";
  return complexity;
}

function entryTypeLabel(entryType: string): string {
  if (entryType === "lifecycle") return "生命周期";
  if (entryType === "api") return "接口";
  if (entryType === "generic") return "通用入口";
  return entryType;
}

function categoryLabel(category: KnowledgeBaseDocumentCategory): string {
  return CATEGORY_LABELS[category];
}

function diagnosticText(message: string): string {
  if (message.startsWith("source file missing for task: ")) {
    return message.replace("source file missing for task: ", "源码文件缺失：");
  }
  if (message.includes(": source file was not provided to knowledge-base generation")) {
    return message.replace(": source file was not provided to knowledge-base generation", "：生成知识库时未提供该源码文件");
  }
  if (message.startsWith("topic candidate source file document not accepted: ")) {
    return message.replace("topic candidate source file document not accepted: ", "专题候选的源文件文档未通过：");
  }
  if (message.startsWith("document contains placeholder text: ")) {
    return message.replace("document contains placeholder text: ", "文档包含占位文本：");
  }
  return message;
}

function evidenceKindLabel(kind: string): string {
  if (kind === "missing-summary") return "缺少摘要";
  if (kind === "missing-line-range") return "缺少行号范围";
  if (kind === "missing-layer") return "缺少分层";
  if (kind === "missing-calls") return "缺少调用关系";
  return kind;
}

function reasonText(reason: string): string {
  if (reason === "stable knowledge-base navigation document") return "稳定的知识库导航文档";
  if (reason.startsWith("entry flow for ")) return `入口流程：${reason.replace("entry flow for ", "")}`;
  if (reason === "one module overview per graph layer") return "每个图谱层对应一个模块总览";
  if (reason === "entry candidate: entry-like name or summary") return "入口候选：名称或摘要呈现入口特征";
  if (reason === "complex business-relevant node") return "复杂且具有业务相关性的节点";
  if (reason === "cross-layer call bridge") return "跨层调用桥接节点";
  if (reason.startsWith("project-relative high degree")) return "项目内连接度较高的节点";
  if (reason === "connected to config/data/external dependency") return "连接配置、数据或外部依赖的节点";
  if (reason.startsWith("file-writer marked important in ")) {
    return `文件文档标记为重要节点：${reason.replace("file-writer marked important in ", "")}`;
  }
  return hasChinese(reason) ? reason : `图谱结构信号：${reason}`;
}

function countByCategory(documents: GeneratedDocument[]): Record<KnowledgeBaseDocumentCategory, number> {
  const counts = Object.fromEntries(DOCUMENT_CATEGORIES.map((category) => [category, 0])) as Record<KnowledgeBaseDocumentCategory, number>;
  for (const doc of documents) counts[doc.category] += 1;
  return counts;
}

function lineRef(node: { filePath?: string; lineRange?: [number, number] }, fallbackFilePath: string): string {
  return `\`${node.filePath ?? fallbackFilePath}\`${node.lineRange ? `:${node.lineRange.join("-")}` : ""}`;
}

function representedEdgesForTask(profile: ProjectProfile, task: FileDocTask): string[] {
  const localNodeIds = new Set([task.fileNodeId, ...task.functionNodeIds, ...task.classNodeIds]);
  const represented = new Set<string>();
  for (const edge of profile.graph.edges) {
    if (localNodeIds.has(edge.source) || localNodeIds.has(edge.target)) {
      represented.add(edgeId(edge));
    }
  }
  return [...represented].sort();
}

function renderFunctionCard(profile: ProjectProfile, task: FileDocTask, nodeId: string): string {
  const node = nodeOf(profile, nodeId);
  const outgoing = profile.indexes.outgoingEdgesByNode.get(nodeId) ?? [];
  const incoming = profile.indexes.incomingEdgesByNode.get(nodeId) ?? [];
  return [
    `### ${node?.name ?? nodeId}`,
    `- 节点 ID: \`${nodeId}\``,
    `- 位置: ${lineRef(node ?? {}, task.filePath)}`,
    `- 职责: ${nodeSummary(node)}`,
    `- 输入/依赖: ${incoming.map((edge) => nodeLabel(profile, edge.source)).join(", ") || "未在图谱中识别"}`,
    `- 输出/副作用: ${outgoing.map((edge) => nodeLabel(profile, edge.target)).join(", ") || "未在图谱中识别"}`,
    `- 上游调用: ${incoming.filter((edge) => edge.type === "calls").map((edge) => nodeLabel(profile, edge.source)).join(", ") || "无"}`,
    `- 下游调用: ${outgoing.filter((edge) => edge.type === "calls").map((edge) => nodeLabel(profile, edge.target)).join(", ") || "无"}`,
    `- 业务含义: 根据名称、标签和调用关系推断，该函数参与 ${node?.tags.join("、") || "当前文件职责"}。根据代码推断，需线上配置确认`,
    "- 注意事项: 修改前检查调用关系索引和相关测试。",
    `- 代码证据: ${lineRef(node ?? {}, task.filePath)}`,
  ].join("\n");
}

function renderClassCard(profile: ProjectProfile, task: FileDocTask, nodeId: string): string {
  const node = nodeOf(profile, nodeId);
  const outgoing = profile.indexes.outgoingEdgesByNode.get(nodeId) ?? [];
  const incoming = profile.indexes.incomingEdgesByNode.get(nodeId) ?? [];
  return [
    `### ${node?.name ?? nodeId}`,
    `- 节点 ID: \`${nodeId}\``,
    `- 位置: ${lineRef(node ?? {}, task.filePath)}`,
    `- 职责: ${nodeSummary(node)}`,
    `- 关联入口/依赖: ${[...incoming, ...outgoing].map((edge) => edge.source === nodeId ? nodeLabel(profile, edge.target) : nodeLabel(profile, edge.source)).join(", ") || "未在图谱中识别"}`,
    `- 代码证据: ${lineRef(node ?? {}, task.filePath)}`,
  ].join("\n");
}

export function renderDeterministicFileWriterDocument(profile: ProjectProfile, task: FileDocTask): FileWriterDocument {
  const representedEdgeIds = representedEdgesForTask(profile, task);
  const importantNodeIds = [...task.functionNodeIds, ...task.classNodeIds]
    .filter((nodeId) => nodeOf(profile, nodeId)?.complexity === "complex")
    .sort();
  const functionCards = task.functionNodeIds.map((nodeId) => renderFunctionCard(profile, task, nodeId));
  const classCards = task.classNodeIds.map((nodeId) => renderClassCard(profile, task, nodeId));

  return {
    fileNodeId: task.fileNodeId,
    filePath: task.filePath,
    documentPath: task.documentPath,
    title: `${task.filePath} 文件知识文档`,
    coveredFunctionNodeIds: [...task.functionNodeIds],
    coveredClassNodeIds: [...task.classNodeIds],
    representedEdgeIds,
    sourceEvidence: [{ filePath: task.filePath, nodeId: task.fileNodeId }],
    importantNodeIds,
    markdown: [
      `# ${task.filePath} 文件知识文档`,
      "",
      "## 文件职责",
      nodeSummary(nodeOf(profile, task.fileNodeId), "图谱中存在该文件，但没有摘要。"),
      "",
      "## 所属位置",
      `- 所属层: ${task.layerId ?? "未分层"}`,
      `- 目录/模块: \`${task.filePath}\``,
      `- 上游文件/函数: ${task.incomingEdgeIds.length}`,
      `- 下游文件/函数: ${task.outgoingEdgeIds.length}`,
      "",
      "## 文件内结构",
      `- 函数总数: ${task.functionNodeIds.length}`,
      `- 类总数: ${task.classNodeIds.length}`,
      `- 关键函数或类: ${importantNodeIds.map((nodeId) => nodeOf(profile, nodeId)?.name ?? nodeId).join(", ") || "无"}`,
      "",
      "## 函数卡片",
      functionCards.join("\n\n") || "本文件没有图谱函数节点。",
      "",
      "## 类卡片",
      classCards.join("\n\n") || "本文件没有图谱类节点。",
      "",
      "## 调用关系",
      representedEdgeIds.map((id) => `- ${id}`).join("\n") || "- 图谱未记录调用、导入或包含关系。",
      "",
      "## 风险点与待确认项",
      task.sourceSnapshot.exists
        ? "- 运行时配置、数据内容和线上流量路径需要外部确认。根据代码推断，需线上配置确认"
        : "- 源文件缺失，当前文档只能基于图谱生成，最终状态必须为不完整。",
      "",
      "## AI 检索词",
      [task.filePath, task.fileNodeId, ...task.functionNodeIds, ...task.classNodeIds].join(", "),
    ].join("\n"),
  };
}

function edgesForNode(profile: ProjectProfile, nodeId: string): { incoming: string[]; outgoing: string[] } {
  const incoming = (profile.indexes.incomingEdgesByNode.get(nodeId) ?? [])
    .map((edge) => `${edgeName(profile, edge.source)} --[${edgeTypeLabel(edge.type)}]--> ${edgeName(profile, edge.target)}`)
    .sort();
  const outgoing = (profile.indexes.outgoingEdgesByNode.get(nodeId) ?? [])
    .map((edge) => `${edgeName(profile, edge.source)} --[${edgeTypeLabel(edge.type)}]--> ${edgeName(profile, edge.target)}`)
    .sort();
  return { incoming, outgoing };
}

export function renderDeterministicTopicWriterDocument(
  profile: ProjectProfile,
  topic: TopicPlanItem,
): TopicWriterDocument {
  const node = nodeOf(profile, topic.topicNodeId);
  const sourceFile = nodeOf(profile, topic.sourceFileNodeId);
  const { incoming, outgoing } = edgesForNode(profile, topic.topicNodeId);
  const configEdges = (profile.indexes.outgoingEdgesByNode.get(topic.topicNodeId) ?? [])
    .filter((edge) => edge.type === "configures" || edge.type === "reads_from" || edge.type === "writes_to")
    .map((edge) => edgeName(profile, edge.target));
  const evidence = topic.coveredNodeIds
    .map((nodeId) => nodeOf(profile, nodeId))
    .filter((item): item is GraphNode => Boolean(item))
    .map((item) => ({ filePath: item.filePath ?? sourceFile?.filePath ?? topic.sourceFileNodeId, lineRange: item.lineRange, nodeId: item.id }));

  const sections: Record<(typeof TOPIC_WRITER_REQUIRED_SECTIONS)[number], string> = {
    "## 为什么关键": [
      `该主题围绕 \`${topic.topicNodeId}\` 展开。`,
      topic.reasons.length > 0 ? `入选原因: ${topic.reasons.map(reasonText).join("；")}。` : "入选原因来自图谱结构和文件文档重要节点标记。",
    ].join("\n"),
    "## 在业务流程中的位置": [
      `- 所属文件: \`${sourceFile?.filePath ?? node?.filePath ?? topic.sourceFileNodeId}\``,
      `- 链接文件文档: \`${topic.linkedFileDocumentPath}\``,
      `- 节点类型: ${node ? NODE_TYPE_LABELS[node.type] : "未识别"}`,
      `- 图谱摘要: ${nodeSummary(node)}`,
    ].join("\n"),
    "## 主要输入、输出、副作用": [
      `- 输入/上游: ${incoming.join("；") || "未在图谱中识别"}`,
      `- 输出/下游: ${outgoing.join("；") || "未在图谱中识别"}`,
      "- 副作用: 根据调用、配置、读写关系推断；根据代码推断，需线上配置确认",
    ].join("\n"),
    "## 关键分支和算法": [
      nodeSummary(node, "图谱未提供算法摘要。"),
      "如果涉及排序、过滤、策略选择或状态变更，需要结合源码和线上配置进一步确认。根据代码推断，需线上配置确认",
    ].join("\n"),
    "## 配置和外部依赖": configEdges.length > 0
      ? configEdges.map((item) => `- ${item}`).join("\n")
      : "- 图谱未记录直接配置或外部依赖。",
    "## 上游调用者": incoming.join("\n") || "- 无",
    "## 下游调用对象": outgoing.join("\n") || "- 无",
    "## 修改风险": [
      "- 修改前需要检查上游调用、下游依赖、单测覆盖和运行时配置。",
      "- 业务口径、实验策略和数据状态需要外部确认。根据代码推断，需线上配置确认",
    ].join("\n"),
    "## 测试证据": "- 当前知识库基于图谱和源码生成；是否已有自动化测试需要工程侧继续核验。",
    "## 代码证据": [
      "| 节点 | 文件 | 行号 |",
      "|---|---|---|",
      ...evidence.map((item) => `| \`${item.nodeId}\` | \`${item.filePath}\` | ${item.lineRange?.join("-") ?? ""} |`),
    ].join("\n"),
    "## AI 检索词": [node?.name, node?.filePath, topic.topicNodeId, ...topic.coveredNodeIds, ...(node?.tags ?? [])].filter(Boolean).join(", "),
  };

  return {
    topicNodeId: topic.topicNodeId,
    sourceFileNodeId: topic.sourceFileNodeId,
    documentPath: topic.documentPath,
    title: topic.title,
    coveredNodeIds: [...topic.coveredNodeIds],
    linkedFileDocumentPath: topic.linkedFileDocumentPath,
    evidence,
    markdown: [
      `# ${topic.title}`,
      "",
      ...TOPIC_WRITER_REQUIRED_SECTIONS.flatMap((section) => [section, sections[section], ""]),
    ].join("\n").trimEnd(),
  };
}

function safeCapabilityPathPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "business-capability";
}

function businessCapabilityDocumentPath(title: string, id: string): string {
  return `业务能力/${safeCapabilityPathPart(title || id)}.md`;
}

export function renderBusinessCapabilityDocuments(
  profile: ProjectProfile,
  businessCapabilityProfile: BusinessCapabilityProfile,
): GeneratedDocument[] {
  const indexLines = [
    "# 业务能力索引",
    "",
    "## 覆盖概览",
    "",
    `- 业务事实总数: ${businessCapabilityProfile.totalFacts}`,
    `- 有源码行号证据的业务事实: ${businessCapabilityProfile.sourceBackedFacts}`,
    `- 业务能力文档: ${businessCapabilityProfile.capabilities.length}`,
    "",
    "## 能力清单",
    "",
    "| 业务能力 | 事实数 | 关联节点数 | 关键词 |",
    "|---|---:|---:|---|",
  ];

  for (const capability of businessCapabilityProfile.capabilities) {
    indexLines.push(
      `| [${capability.title}](${businessCapabilityDocumentPath(capability.title, capability.id)}) | ${capability.factIds.length} | ${capability.relatedNodeIds.length} | ${capability.keywords.join("、")} |`,
    );
  }
  if (businessCapabilityProfile.capabilities.length === 0) {
    indexLines.push("| 未识别到高信号业务能力 | 0 | 0 | 无 |");
  }

  const factsById = new Map(businessCapabilityProfile.facts.map((fact) => [fact.id, fact]));
  const documents: GeneratedDocument[] = [
    {
      path: "业务能力索引.md",
      title: "业务能力索引",
      category: "business-capability",
      coveredNodeIds: [...new Set(businessCapabilityProfile.facts.flatMap((fact) => fact.relatedNodeIds))].sort(),
      representedEdgeIds: [],
      content: indexLines.join("\n"),
    },
  ];

  for (const capability of businessCapabilityProfile.capabilities) {
    const facts = capability.factIds
      .map((factId) => factsById.get(factId))
      .filter((fact): fact is NonNullable<typeof fact> => Boolean(fact));
    const relatedNodes = capability.relatedNodeIds
      .map((nodeId) => nodeOf(profile, nodeId))
      .filter((node): node is GraphNode => Boolean(node));
    const lines = [
      `# ${capability.title}`,
      "",
      "## 业务结论",
      "",
      `- 该能力由 ${facts.length} 条业务事实聚合而来。`,
      `- 主要关键词: ${capability.keywords.join("、") || "未识别"}`,
      `- 关联代码、配置或文档节点: ${capability.relatedNodeIds.length}`,
      "",
      "## 事实证据",
      "",
      "| 类型 | 事实 | 证据位置 | 摘录 |",
      "|---|---|---|---|",
    ];

    for (const fact of facts) {
      const evidence = fact.evidence[0];
      lines.push(
        `| ${fact.kind} | ${fact.title} | \`${evidence?.filePath ?? ""}\`${evidence?.lineRange ? `:${evidence.lineRange.join("-")}` : ""} | ${evidence?.excerpt ?? fact.summary} |`,
      );
    }
    if (facts.length === 0) lines.push("| 无 | 未找到事实 | 无 | 无 |");

    lines.push("");
    lines.push("## 关联对象");
    lines.push("");
    for (const node of relatedNodes) {
      lines.push(`- \`${node.id}\`（${NODE_TYPE_LABELS[node.type]}）${node.name}: ${nodeSummary(node)}`);
    }
    if (relatedNodes.length === 0) lines.push("- 未关联到图谱节点。");

    lines.push("");
    lines.push("## 可能触发条件");
    lines.push("");
    const triggerFacts = facts.filter((fact) => fact.kind === "branch" || fact.kind === "constant" || fact.kind === "config");
    for (const fact of triggerFacts) {
      lines.push(`- ${fact.title}`);
    }
    if (triggerFacts.length === 0) lines.push("- 未从源码分支、常量或配置中识别到明确触发条件。");

    lines.push("");
    lines.push("## 测试与样例");
    lines.push("");
    const testFacts = facts.filter((fact) => fact.kind === "test");
    for (const fact of testFacts) {
      const evidence = fact.evidence[0];
      lines.push(`- ${fact.title}（\`${evidence?.filePath ?? ""}\`${evidence?.lineRange ? `:${evidence.lineRange.join("-")}` : ""}）`);
    }
    if (testFacts.length === 0) lines.push("- 未从测试文件中识别到直接样例。");

    lines.push("");
    lines.push("## 待确认项");
    lines.push("");
    lines.push("- 业务命名、线上配置值、实验状态和真实流量命中比例需要业务或平台侧确认。");

    documents.push({
      path: businessCapabilityDocumentPath(capability.title, capability.id),
      title: capability.title,
      category: "business-capability",
      coveredNodeIds: [...capability.relatedNodeIds],
      representedEdgeIds: [],
      content: lines.join("\n"),
    });
  }

  return documents.sort((a, b) => a.path.localeCompare(b.path) || a.title.localeCompare(b.title));
}

export function buildCoverageReport(
  profile: ProjectProfile,
  fileDocPlan: FileDocPlan,
  topicPlan: TopicPlan,
  documents: GeneratedDocument[],
  validation: CoverageValidationResult,
  retryPlan: RetryPlan,
  businessCapabilityProfile?: BusinessCapabilityProfile,
): CoverageReport {
  const docsByCategory = documents.reduce((map, doc) => {
    const list = map.get(doc.category) ?? [];
    list.push(doc);
    map.set(doc.category, list);
    return map;
  }, new Map<KnowledgeBaseDocumentCategory, GeneratedDocument[]>());
  const coveredNodeIdsByCategory = (category: KnowledgeBaseDocumentCategory): Set<string> => {
    return new Set((docsByCategory.get(category) ?? []).flatMap((doc) => doc.coveredNodeIds));
  };
  const fileDocCovered = coveredNodeIdsByCategory("file");
  const representedEdges = new Set(documents.flatMap((doc) => doc.representedEdgeIds));
  const expectedIds = (type: NodeType): string[] => nodesOfType(profile, type).map((node) => node.id).sort();
  const ratio = (coveredIds: Set<string>, expected: string[]): CoverageRatio => {
    const missing = expected.filter((id) => !coveredIds.has(id)).sort();
    return { covered: expected.length - missing.length, total: expected.length, missing };
  };
  const relationshipRatio = (edgeType: EdgeType) => {
    const edges = (profile.indexes.edgesByType.get(edgeType) ?? []).map(edgeId).sort();
    const missingEdgeIds = edges.filter((id) => !representedEdges.has(id)).sort();
    return { edgeType, covered: edges.length - missingEdgeIds.length, total: edges.length, missingEdgeIds };
  };
  const sourceReadMissing = fileDocPlan.tasks
    .filter((task) => !task.sourceSnapshot.exists)
    .map((task) => task.fileNodeId)
    .sort();
  const sourceReadCoverage = {
    covered: fileDocPlan.tasks.length - sourceReadMissing.length,
    total: fileDocPlan.tasks.length,
    missing: sourceReadMissing,
  };
  const factCoveredNodeIds = new Set((businessCapabilityProfile?.facts ?? []).flatMap((fact) => fact.relatedNodeIds));
  const highSignalFilesWithoutFacts = fileDocPlan.tasks
    .filter((task) => {
      if (!task.sourceSnapshot.exists) return false;
      const taskNodeIds = [task.fileNodeId, ...task.functionNodeIds, ...task.classNodeIds];
      const highSignal = taskNodeIds.some((nodeId) => profile.businessSignalNodeIds.has(nodeId));
      const coveredByFact = taskNodeIds.some((nodeId) => factCoveredNodeIds.has(nodeId));
      return highSignal && !coveredByFact;
    })
    .map((task) => task.fileNodeId)
    .sort();
  const capabilityDocs = docsByCategory.get("business-capability") ?? [];
  const expectedCapabilityDocPaths = new Set(
    (businessCapabilityProfile?.capabilities ?? []).map((capability) =>
      businessCapabilityDocumentPath(capability.title, capability.id)
    ),
  );
  const capabilityDocPaths = new Set(capabilityDocs.map((doc) => doc.path));
  const missingCapabilityDocs = [...expectedCapabilityDocPaths]
    .filter((path) => !capabilityDocPaths.has(path))
    .sort();
  const layerDocs = docsByCategory.get("module") ?? [];
  const flowAndTopicNodeIds = new Set([
    ...(docsByCategory.get("flow") ?? []).flatMap((doc) => doc.coveredNodeIds),
    ...(docsByCategory.get("topic") ?? []).flatMap((doc) => doc.coveredNodeIds),
  ]);
  const layerOverviewMissing = profile.layerProfiles
    .filter((layer) => !layerDocs.some((doc) => doc.coveredNodeIds.some((nodeId) => layer.nodeIds.includes(nodeId))))
    .map((layer) => layer.id)
    .sort();
  const entryMissing = profile.entryCandidates
    .filter((entry) => !flowAndTopicNodeIds.has(entry.nodeId))
    .map((entry) => entry.nodeId)
    .sort();
  const topicExpected = topicPlan.topics.map((topic) => topic.topicNodeId).sort();
  const topicCovered = coveredNodeIdsByCategory("topic");
  const evidenceWarnings = profile.evidenceGaps.map((gap) => `${gap.kind}: ${gap.message}`);
  const chineseFailures = documents.filter((doc) => !/[\u4e00-\u9fff]/.test(doc.content)).map((doc) => doc.path).sort();
  const placeholderFailures = documents.filter((doc) => PLACEHOLDER_RE.test(doc.content)).map((doc) => doc.path).sort();
  const structuralErrors = [
    ...validation.errors,
    ...placeholderFailures.map((path) => `document contains placeholder text: ${path}`),
  ];
  const warnings = [...new Set([...validation.warnings, ...evidenceWarnings])].sort();
  const status: KnowledgeBaseStatus = structuralErrors.length > 0
    ? "incomplete"
    : warnings.length > 0
      ? "complete-with-warnings"
      : "complete";

  return {
    totalDocuments: documents.length,
    documentCounts: countByCategory(documents),
    nodeCounts: profile.nodeCounts,
    edgeCounts: profile.edgeCounts,
    fileDocumentCoverage: ratio(fileDocCovered, expectedIds("file")),
    functionCardCoverage: ratio(fileDocCovered, expectedIds("function")),
    classCardCoverage: ratio(fileDocCovered, expectedIds("class")),
    relationshipCoverage: RELATIONSHIP_COVERAGE_EDGE_TYPES.map((edgeType) => relationshipRatio(edgeType)),
    sourceReadCoverage,
    businessFactCoverage: {
      covered: businessCapabilityProfile?.sourceBackedFacts ?? 0,
      total: businessCapabilityProfile?.totalFacts ?? 0,
      missing: highSignalFilesWithoutFacts,
    },
    businessCapabilityCoverage: {
      covered: (businessCapabilityProfile?.capabilities.length ?? 0) - missingCapabilityDocs.length,
      total: businessCapabilityProfile?.capabilities.length ?? 0,
      missing: missingCapabilityDocs,
    },
    layerOverviewCoverage: {
      covered: profile.layerProfiles.length - layerOverviewMissing.length,
      total: profile.layerProfiles.length,
      missing: layerOverviewMissing,
    },
    entryCoverage: {
      covered: profile.entryCandidates.length - entryMissing.length,
      total: profile.entryCandidates.length,
      missing: entryMissing,
    },
    topicCoverage: ratio(topicCovered, topicExpected),
    fileWriterBatches: {
      total: fileDocPlan.batches.length,
      passed: Math.max(0, fileDocPlan.batches.length - retryPlan.fileBatchIndexes.length),
      retry: retryPlan.fileBatchIndexes.length,
    },
    topicBatches: {
      total: topicPlan.batches.length,
      passed: Math.max(0, topicPlan.batches.length - retryPlan.topicBatchIndexes.length),
      retry: retryPlan.topicBatchIndexes.length,
    },
    chineseValidation: { checked: documents.length, failed: chineseFailures },
    placeholderValidation: { checked: documents.length, failed: placeholderFailures },
    warnings,
    errors: structuralErrors,
    status,
  };
}

function renderInventory(
  profile: ProjectProfile,
  plan: DocumentPlan,
  fileDocPlan?: FileDocPlan,
  topicPlan?: TopicPlan,
  report?: CoverageReport,
): string {
  const totalDocuments = report?.totalDocuments ?? plan.documents.length + (fileDocPlan?.tasks.length ?? 0) + (topicPlan?.topics.length ?? 0);
  const lines = [
    "# 目录",
    "",
    `**项目**: ${profile.graph.project.name}`,
    `**生成文档数**: ${totalDocuments}`,
    `**图谱提交**: ${profile.graph.project.gitCommitHash || "未知"}`,
    "",
    "## 推荐阅读路径",
    "",
    "- 工程师接手代码: 项目总览 -> 架构地图 -> 业务流程地图 -> 关键函数专题 -> 函数索引",
    "- 产品/运营理解业务: 业务流程地图 -> 业务流程 -> 待确认项",
    "- AI 代理后续检索: AI检索索引 -> 函数索引 -> 文件索引 -> 覆盖报告",
    "",
    "## 文档清单",
    "",
  ];
  const listedPlanDocuments = topicPlan ? plan.documents.filter((doc) => doc.category !== "topic") : plan.documents;
  for (const doc of listedPlanDocuments) {
    lines.push(`- [${doc.title}](${doc.path}) — ${categoryLabel(doc.category)}；${reasonText(doc.reason)}`);
  }
  for (const task of fileDocPlan?.tasks ?? []) {
    lines.push(`- [${task.filePath} 文件知识文档](${task.documentPath}) — 文件文档；覆盖该文件内的函数和类卡片`);
  }
  for (const topic of topicPlan?.topics ?? []) {
    lines.push(`- [${topic.title}](${topic.documentPath}) — 关键专题；${topic.reasons.map(reasonText).join("；")}`);
  }
  return lines.join("\n");
}

function renderProjectOverview(profile: ProjectProfile): string {
  return [
    "# 项目总览",
    "",
    `**一句话结论**: ${projectDescription(profile)}`,
    "",
    "## 本地代码事实",
    "",
    `- 项目名称: ${profile.graph.project.name}`,
    `- 语言: ${profile.graph.project.languages.join(", ") || "未识别"}`,
    `- 框架: ${profile.graph.project.frameworks.join(", ") || "未识别"}`,
    `- 文件节点: ${profile.nodeCounts.file}`,
    `- 函数节点: ${profile.nodeCounts.function}`,
    `- 类节点: ${profile.nodeCounts.class}`,
    `- 图谱边: ${profile.graph.edges.length}`,
    "",
    "## 代码推断",
    "",
    profile.entryCandidates.length > 0
      ? `- 检测到 ${profile.entryCandidates.length} 个入口候选，业务流程文档会从这些入口展开。`
      : "- 未检测到明确入口候选，业务流程文档会主要依赖模块和索引。",
    "",
    "## 外部待核验",
    "",
    "- 运行时配置、实验、数据库内容和线上指标需要外部平台确认。根据代码推断，需线上配置确认",
  ].join("\n");
}

function renderArchitecture(profile: ProjectProfile): string {
  const lines = ["# 架构地图", "", "## 分层列表", ""];
  for (const layer of profile.layerProfiles) {
    lines.push(`### ${layer.name}`);
    lines.push("");
    lines.push(layerDescription(layer.description, layer.name));
    lines.push("");
    lines.push(`- 文件数: ${layer.fileCount}`);
    lines.push(`- 函数数: ${layer.functionCount}`);
    lines.push(`- 类数: ${layer.classCount}`);
    lines.push(`- 入站层: ${layer.inboundLayerIds.join(", ") || "无"}`);
    lines.push(`- 出站层: ${layer.outboundLayerIds.join(", ") || "无"}`);
    lines.push("");
  }
  return lines.join("\n");
}

function renderFlowOverview(profile: ProjectProfile): string {
  const lines = ["# 业务流程地图", "", "## 检测到的入口", ""];
  if (profile.entryCandidates.length === 0) {
    lines.push("- 未检测到明确入口。代码推断: 可从架构地图和函数索引继续定位业务路径。");
    return lines.join("\n");
  }
  for (const entry of profile.entryCandidates) {
    const node = nodeOf(profile, entry.nodeId);
    lines.push(`- **${node?.name ?? entry.nodeId}**（入口类型：${entryTypeLabel(entry.entryType)}）— 根据名称、标签和图谱关系识别为入口候选。`);
  }
  lines.push("");
  lines.push("## 外部待核验");
  lines.push("");
  lines.push("- 业务命名来自代码名称、标签和摘要；真实产品口径需要业务 owner 确认。根据代码推断，需线上配置确认");
  return lines.join("\n");
}

function renderFileIndex(profile: ProjectProfile, plan: DocumentPlan): string {
  const lines = ["# 文件索引", "", "| 节点 ID | 路径 | 所属层 | 摘要 | 复杂度 | 函数数 | 类数 | 覆盖状态 |", "|---|---|---|---|---|---:|---:|---|"];
  for (const node of nodesOfType(profile, "file")) {
    lines.push(
      `| \`${node.id}\` | \`${node.filePath ?? node.name}\` | ${layerNameForNode(profile, node.id)} | ${nodeSummary(node)} | ${complexityLabel(node.complexity)} | ${profile.indexes.fileToFunctionIds.get(node.id)?.length ?? 0} | ${profile.indexes.fileToClassIds.get(node.id)?.length ?? 0} | ${coverageLevelLabel(plan.nodeCoverage.get(node.id))} |`,
    );
  }
  return lines.join("\n");
}

function renderFunctionIndex(profile: ProjectProfile, plan: DocumentPlan): string {
  const lines = ["# 函数索引", "", "| 节点 ID | 函数 | 文件 | 行号 | 所属层 | 摘要 | 入站调用 | 出站调用 | 是否入口 | 是否有专题 |", "|---|---|---|---|---|---|---:|---:|---|---|"];
  const entryIds = new Set(profile.entryCandidates.map((entry) => entry.nodeId));
  for (const node of nodesOfType(profile, "function")) {
    const degree = profile.nodeDegrees.get(node.id);
    lines.push(
      `| \`${node.id}\` | ${node.name} | \`${node.filePath ?? ""}\` | ${node.lineRange?.join("-") ?? ""} | ${layerNameForNode(profile, node.id)} | ${nodeSummary(node)} | ${degree?.incomingCalls ?? 0} | ${degree?.outgoingCalls ?? 0} | ${booleanLabel(entryIds.has(node.id))} | ${booleanLabel(plan.nodeCoverage.get(node.id) === "topic")} |`,
    );
  }
  return lines.join("\n");
}

function renderClassIndex(profile: ProjectProfile, plan: DocumentPlan): string {
  const lines = ["# 类索引", "", "| 节点 ID | 类 | 文件 | 行号 | 所属层 | 摘要 | 覆盖状态 |", "|---|---|---|---|---|---|---|"];
  for (const node of nodesOfType(profile, "class")) {
    lines.push(
      `| \`${node.id}\` | ${node.name} | \`${node.filePath ?? ""}\` | ${node.lineRange?.join("-") ?? ""} | ${layerNameForNode(profile, node.id)} | ${nodeSummary(node)} | ${coverageLevelLabel(plan.nodeCoverage.get(node.id))} |`,
    );
  }
  return lines.join("\n");
}

function renderCallIndex(profile: ProjectProfile): string {
  const lines = ["# 调用关系索引", "", "| 来源 | 目标 | 类型 |", "|---|---|---|"];
  for (const edge of profile.graph.edges.filter((item) => item.type === "calls")) {
    lines.push(`| \`${edge.source}\` | \`${edge.target}\` | ${edgeTypeLabel(edge.type)} |`);
  }
  if (lines.length === 4) lines.push("| 无 | 无 | 调用 |");
  return lines.join("\n");
}

function renderDependencies(profile: ProjectProfile): string {
  const externalNodes = profile.graph.nodes.filter((node) => profile.externalNodeIds.has(node.id));
  const lines = ["# 配置与外部依赖", "", "## 本地代码事实", ""];
  for (const node of externalNodes) {
    lines.push(`- \`${node.id}\`（${NODE_TYPE_LABELS[node.type]}）${node.name}: ${nodeSummary(node)}`);
  }
  if (externalNodes.length === 0) lines.push("- 未在图谱中检测到配置、服务、表、端点、管道、schema 或资源节点。");
  lines.push("");
  lines.push("## 外部待核验");
  lines.push("");
  lines.push("- 依赖可用性、真实配置值和数据内容不在本地图谱中。根据代码推断，需线上配置确认");
  return lines.join("\n");
}

function renderRisks(profile: ProjectProfile): string {
  const lines = ["# 待确认项", "", "## 证据缺口", ""];
  for (const gap of profile.evidenceGaps) {
    lines.push(`- **${evidenceKindLabel(gap.kind)}**: ${diagnosticText(gap.message)}`);
  }
  if (profile.evidenceGaps.length === 0) lines.push("- 当前图谱没有检测到结构性证据缺口。");
  lines.push("");
  lines.push("## 外部待核验");
  lines.push("");
  lines.push("- 线上配置、实验策略、数据库记录和真实流量路径需要外部验证。根据代码推断，需线上配置确认");
  return lines.join("\n");
}

function renderAiIndex(profile: ProjectProfile, plan: DocumentPlan): string {
  const lines = ["# AI检索索引", "", "## 核心检索词", ""];
  for (const node of profile.graph.nodes) {
    const tags = node.tags.join(", ");
    lines.push(`- \`${node.id}\` | ${node.name} | ${NODE_TYPE_LABELS[node.type]} | ${node.filePath ?? ""} | ${tags} | 覆盖=${coverageLevelLabel(plan.nodeCoverage.get(node.id))}`);
  }
  return lines.join("\n");
}

function renderModuleDoc(profile: ProjectProfile, planDoc: PlannedDocument): string {
  const layer = profile.layerProfiles.find((item) => `${item.name} 模块概览` === planDoc.title);
  const lines = [`# ${planDoc.title}`, "", "## 本地代码事实", ""];
  if (layer) {
    lines.push(`- 层 ID: \`${layer.id}\``);
    lines.push(`- 描述: ${layerDescription(layer.description, layer.name)}`);
    lines.push(`- 文件数: ${layer.fileCount}`);
    lines.push(`- 函数数: ${layer.functionCount}`);
    lines.push(`- 类数: ${layer.classCount}`);
    lines.push("");
    lines.push("## 重要节点");
    lines.push("");
    for (const nodeId of layer.nodeIds) {
      const node = nodeOf(profile, nodeId);
      if (node) lines.push(`- \`${node.id}\`（${NODE_TYPE_LABELS[node.type]}）${node.name}: ${nodeSummary(node)}`);
    }
  }
  lines.push("");
  lines.push("## AI 检索词");
  lines.push("");
  lines.push(planDoc.coveredNodeIds.map((nodeId) => nodeOf(profile, nodeId)?.name).filter(Boolean).join(", ") || "无");
  return lines.join("\n");
}

function renderFlowDoc(profile: ProjectProfile, planDoc: PlannedDocument): string {
  const lines = [`# ${planDoc.title}`, "", "## 流程结论", "", `代码推断: 该流程从入口节点展开，覆盖 ${planDoc.coveredNodeIds.length} 个相关节点。`, "", "## 执行顺序", ""];
  for (const nodeId of planDoc.coveredNodeIds) {
    const node = nodeOf(profile, nodeId);
    if (node) lines.push(`- \`${node.id}\`（${NODE_TYPE_LABELS[node.type]}）${node.name}: ${nodeSummary(node)}`);
  }
  lines.push("");
  lines.push("## 代码证据");
  lines.push("");
  lines.push("| 节点 | 文件 | 行号 |");
  lines.push("|---|---|---|");
  for (const nodeId of planDoc.coveredNodeIds) {
    const node = nodeOf(profile, nodeId);
    if (node) lines.push(`| \`${node.id}\` | \`${node.filePath ?? ""}\` | ${node.lineRange?.join("-") ?? ""} |`);
  }
  lines.push("");
  lines.push("## 待核验项");
  lines.push("");
  lines.push("- 业务名称和真实运行条件需要业务或线上平台确认。根据代码推断，需线上配置确认");
  return lines.join("\n");
}

function renderTopicDoc(profile: ProjectProfile, planDoc: PlannedDocument): string {
  const nodeId = planDoc.coveredNodeIds[0];
  const node = nodeOf(profile, nodeId);
  const incoming = profile.indexes.incomingEdgesByNode.get(nodeId) ?? [];
  const outgoing = profile.indexes.outgoingEdgesByNode.get(nodeId) ?? [];
  return [
    `# ${planDoc.title}`,
    "",
    `**为什么关键**: ${reasonText(planDoc.reason)}`,
    "",
    "## 本地代码事实",
    "",
    `- 节点 ID: \`${nodeId}\``,
    `- 名称: ${node?.name ?? nodeId}`,
    `- 类型: ${node ? NODE_TYPE_LABELS[node.type] : "未识别"}`,
    `- 文件: \`${node?.filePath ?? ""}\``,
    `- 行号: ${node?.lineRange?.join("-") ?? ""}`,
    `- 摘要: ${nodeSummary(node)}`,
    "",
    "## 上游调用者",
    "",
    incoming.map((edge) => `- ${edgeName(profile, edge.source)} --[${edgeTypeLabel(edge.type)}]--> ${edgeName(profile, edge.target)}`).join("\n") || "- 无",
    "",
    "## 下游调用对象和依赖",
    "",
    outgoing.map((edge) => `- ${edgeName(profile, edge.source)} --[${edgeTypeLabel(edge.type)}]--> ${edgeName(profile, edge.target)}`).join("\n") || "- 无",
    "",
    "## 代码证据",
    "",
    `| 节点 | 文件 | 行号 |`,
    `|---|---|---|`,
    `| \`${nodeId}\` | \`${node?.filePath ?? ""}\` | ${node?.lineRange?.join("-") ?? ""} |`,
    "",
    "## 外部待核验",
    "",
    "- 如该节点依赖运行时配置、实验或数据库内容，需要外部确认。根据代码推断，需线上配置确认",
    "",
    "## AI 检索词",
    "",
    [node?.name, node?.filePath, ...(node?.tags ?? [])].filter(Boolean).join(", "),
  ].join("\n");
}

function renderCoverageReport(report: CoverageReport, validation: CoverageValidationResult): string {
  const lines = [
    "# 覆盖报告",
    "",
    `总文档数: ${report.totalDocuments}`,
    `覆盖状态: ${STATUS_LABELS[report.status]}`,
    "",
    "## 文档数量",
    "",
  ];
  for (const category of DOCUMENT_CATEGORIES) {
    lines.push(`- ${categoryLabel(category)}: ${report.documentCounts[category]}`);
  }
  lines.push("");
  lines.push("## 节点覆盖");
  lines.push("");
  lines.push(`- 文件文档覆盖: ${report.fileDocumentCoverage.covered} / ${report.fileDocumentCoverage.total}`);
  lines.push(`- 函数卡片覆盖: ${report.functionCardCoverage.covered} / ${report.functionCardCoverage.total}`);
  lines.push(`- 类卡片覆盖: ${report.classCardCoverage.covered} / ${report.classCardCoverage.total}`);
  lines.push(`- 模块总览覆盖: ${report.layerOverviewCoverage.covered} / ${report.layerOverviewCoverage.total}`);
  lines.push(`- 入口覆盖: ${report.entryCoverage.covered} / ${report.entryCoverage.total}`);
  lines.push(`- 专题覆盖: ${report.topicCoverage.covered} / ${report.topicCoverage.total}`);
  lines.push(`- 源码读取覆盖: ${report.sourceReadCoverage.covered} / ${report.sourceReadCoverage.total}`);
  lines.push(`- 业务事实覆盖: ${report.businessFactCoverage.covered} / ${report.businessFactCoverage.total}`);
  lines.push(`- 业务能力文档: ${report.businessCapabilityCoverage.covered} / ${report.businessCapabilityCoverage.total}`);
  for (const nodeId of report.businessFactCoverage.missing) {
    lines.push(`  - 业务事实缺失: ${nodeId}`);
  }
  lines.push("");
  lines.push("## 关系覆盖");
  lines.push("");
  for (const item of report.relationshipCoverage) {
    lines.push(`- ${edgeTypeLabel(item.edgeType)}: ${item.covered} / ${item.total}`);
    if (item.missingEdgeIds.length > 0) {
      for (const edgeId of item.missingEdgeIds) lines.push(`  - 缺失: ${edgeId}`);
    }
  }
  lines.push("");
  lines.push("## 批次覆盖");
  lines.push("");
  lines.push(`- 文件写作批次: ${report.fileWriterBatches.passed} 个通过 / 共 ${report.fileWriterBatches.total} 个；需重试 ${report.fileWriterBatches.retry} 个`);
  lines.push(`- 专题写作批次: ${report.topicBatches.passed} 个通过 / 共 ${report.topicBatches.total} 个；需重试 ${report.topicBatches.retry} 个`);
  lines.push("");
  lines.push("## 源码读取覆盖");
  lines.push("");
  if (report.sourceReadCoverage.missing.length === 0) {
    lines.push("- 缺失源码文件: 无");
  } else {
    for (const nodeId of report.sourceReadCoverage.missing) lines.push(`- 缺失源码: ${nodeId}`);
  }
  lines.push("");
  lines.push("## 校验结果");
  lines.push("");
  if (report.errors.length === 0) {
    lines.push("- 错误: 无");
  } else {
    for (const error of report.errors) lines.push(`- 错误: ${diagnosticText(error)}`);
  }
  if (report.warnings.length === 0) {
    lines.push("- 警告: 无");
  } else {
    for (const warning of report.warnings) lines.push(`- 警告: ${diagnosticText(warning)}`);
  }
  return lines.join("\n");
}

export function renderKnowledgeBaseDocuments(
  profile: ProjectProfile,
  plan: DocumentPlan,
  fileDocPlan?: FileDocPlan,
  topicPlan?: TopicPlan,
  _merged?: MergeKnowledgeBaseWriterOutputsResult,
  report?: CoverageReport,
  validation?: CoverageValidationResult,
): GeneratedDocument[] {
  const planDocuments = topicPlan ? plan.documents.filter((doc) => doc.category !== "topic") : plan.documents;
  return planDocuments.map((doc) => {
    let content: string;
    if (doc.path === KB_PATHS.inventory) content = renderInventory(profile, plan, fileDocPlan, topicPlan, report);
    else if (doc.path === KB_PATHS.projectOverview) content = renderProjectOverview(profile);
    else if (isPath(doc.path, KB_PATHS.architectureMap, LEGACY_PATHS.architectureMap)) content = renderArchitecture(profile);
    else if (isPath(doc.path, KB_PATHS.businessFlowMap, LEGACY_PATHS.businessFlowMap)) content = renderFlowOverview(profile);
    else if (isPath(doc.path, indexDocumentPath("文件索引"), LEGACY_PATHS.fileIndex)) content = renderFileIndex(profile, plan);
    else if (isPath(doc.path, indexDocumentPath("函数索引"), LEGACY_PATHS.functionIndex)) content = renderFunctionIndex(profile, plan);
    else if (isPath(doc.path, indexDocumentPath("类索引"), LEGACY_PATHS.classIndex)) content = renderClassIndex(profile, plan);
    else if (doc.path === indexDocumentPath("调用关系索引")) content = renderCallIndex(profile);
    else if (doc.path === "配置与外部依赖.md") content = renderDependencies(profile);
    else if (isPath(doc.path, KB_PATHS.pendingItems, LEGACY_PATHS.pendingItems)) content = renderRisks(profile);
    else if (isPath(doc.path, indexDocumentPath("AI检索索引"), LEGACY_PATHS.aiIndex)) content = renderAiIndex(profile, plan);
    else if (doc.path === KB_PATHS.coverageReport && report && validation) content = renderCoverageReport(report, validation);
    else if (doc.category === "module") content = renderModuleDoc(profile, doc);
    else if (doc.category === "flow") content = renderFlowDoc(profile, doc);
    else if (doc.category === "topic") content = renderTopicDoc(profile, doc);
    else content = `# ${doc.title}\n\n本地代码事实: ${doc.reason}`;

    return {
      path: doc.path,
      title: doc.title,
      category: doc.category,
      coveredNodeIds: doc.coveredNodeIds,
      representedEdgeIds: [],
      content,
    };
  });
}

export function validateKnowledgeBaseCoverage(
  profile: ProjectProfile,
  plan: DocumentPlan,
  documents: GeneratedDocument[],
): CoverageValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const docByPath = new Map(documents.map((doc) => [doc.path, doc]));
  const contentAt = (currentPath: string, legacyPath: string): string => {
    return docByPath.get(currentPath)?.content ?? docByPath.get(legacyPath)?.content ?? "";
  };
  const fileIndex = contentAt(indexDocumentPath("文件索引"), LEGACY_PATHS.fileIndex);
  const functionIndex = contentAt(indexDocumentPath("函数索引"), LEGACY_PATHS.functionIndex);
  const classIndex = contentAt(indexDocumentPath("类索引"), LEGACY_PATHS.classIndex);

  for (const node of nodesOfType(profile, "file")) {
    if (!fileIndex.includes(node.id)) errors.push(`file node missing from file index: ${node.id}`);
  }
  for (const node of nodesOfType(profile, "function")) {
    if (!functionIndex.includes(node.id)) errors.push(`function node missing from function index: ${node.id}`);
  }
  for (const node of nodesOfType(profile, "class")) {
    if (!classIndex.includes(node.id)) errors.push(`class node missing from class index: ${node.id}`);
  }
  for (const layer of profile.layerProfiles) {
    const moduleDoc = documents.find((doc) => doc.category === "module" && doc.content.includes(`层 ID: \`${layer.id}\``));
    if (!moduleDoc) errors.push(`layer missing module overview: ${layer.id}`);
  }
  for (const entry of profile.entryCandidates) {
    const covered = plan.documents.some((doc) => (doc.category === "flow" || doc.category === "topic") && doc.coveredNodeIds.includes(entry.nodeId));
    if (!covered) errors.push(`entry candidate missing flow/topic coverage: ${entry.nodeId}`);
  }
  for (const doc of documents.filter((item) => item.category === "topic")) {
    if (!doc.content.includes("## 代码证据")) errors.push(`topic document lacks code evidence: ${doc.path}`);
  }
  for (const doc of documents) {
    if (PLACEHOLDER_RE.test(doc.content)) errors.push(`document contains placeholder text: ${doc.path}`);
  }
  if (profile.evidenceGaps.some((gap) => gap.kind === "missing-calls")) {
    warnings.push("calls edges are unavailable; some linkage may be estimated");
  }
  return { ok: errors.length === 0, errors, warnings };
}
