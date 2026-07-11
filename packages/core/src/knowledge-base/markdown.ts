import type { EdgeType, GraphNode, NodeType } from "../types.js";
import type {
  CoverageReport,
  CoverageRatio,
  CoverageValidationResult,
  BusinessCapabilityProfile,
  BusinessEvidenceRole,
  BusinessFact,
  DirectSourceEvidence,
  FeaturedPlan,
  FileDocPlan,
  FileDocTask,
  FileWriterDocument,
  GeneratedDocument,
  KnowledgeBaseStatus,
  KnowledgeDocumentCategory,
  RetryPlan,
  PlannedDocument,
  ProjectProfile,
  SourceEvidence,
  TopicPlanItem,
  TopicPlan,
  TopicWriterDocument,
} from "./types.js";
import {
  KB_PATHS,
  businessCapabilityDocumentPath as sharedBusinessCapabilityDocumentPath,
  normalizeKnowledgeSourcePath,
  slugPath,
} from "./paths.js";
import { stableSymbolAnchors, type MergeKnowledgeBaseWriterOutputsResult } from "./merge.js";
import { TOPIC_WRITER_REQUIRED_SECTIONS } from "./writer-contracts.js";
import { containsPlaceholderProse, summarizeMarkdownQuality } from "./quality.js";
import type { MarkdownQualitySummary } from "./quality.js";
import { excerptForLineRange } from "./source-snapshot.js";
import { evaluatePublicationCorpus, type PublicationEvidence } from "./publication-quality.js";

type DocumentPlan = FeaturedPlan;

const DOCUMENT_CATEGORIES: KnowledgeDocumentCategory[] = [
  "overview",
  "capability",
  "flow",
  "module",
  "file",
  "topic",
  "quality",
  "coverage",
  "other",
];

const RELATIONSHIP_COVERAGE_EDGE_TYPES: EdgeType[] = ["calls", "imports", "contains"];
const CATEGORY_LABELS: Record<KnowledgeDocumentCategory, string> = {
  overview: "阅读总览",
  capability: "业务能力",
  flow: "业务流程",
  module: "模块总览",
  file: "文件文档",
  topic: "关键专题",
  quality: "质量状态",
  coverage: "引用覆盖",
  other: "其他",
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
  return `本地代码事实: 图谱记录了 ${node.name} 节点；根据名称、标签和关系推断，它与 ${tagText(node)} 相关，运行时配置和线上数据需要结合环境核对。`;
}

function layerDescription(description: string, layerName: string): string {
  if (hasChinese(description)) return description;
  return `本地代码事实: 图谱将该层命名为 ${layerName}；该层职责需要结合文件和函数索引确认，运行时边界需要结合部署环境核对。`;
}

function projectDescription(profile: ProjectProfile): string {
  const description = profile.graph.project.description;
  if (hasChinese(description)) return description;
  return `${profile.graph.project.name} 的代码结构知识库。`;
}

function coverageLevelLabel(plan: FeaturedPlan, nodeId: string): string {
  if (plan.documents.some((document) => document.directNodeIds.includes(nodeId))) return "已直接说明";
  if (plan.documents.some((document) => document.contextNodeIds.includes(nodeId))) return "已作为上下文";
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

function categoryLabel(category: KnowledgeDocumentCategory): string {
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

function evidenceRoleLabel(role: string): string {
  if (role === "primary") return "primary / 生产或配置主证据";
  if (role === "supporting") return "supporting / 支撑证据";
  if (role === "example-only") return "example-only / 示例证据";
  return role;
}

function confidenceLabel(confidence: string): string {
  if (confidence === "high") return "高";
  if (confidence === "medium") return "中";
  if (confidence === "low") return "低";
  return confidence;
}

function reasonText(reason: string): string {
  if (reason === "stable knowledge-base navigation document") return "稳定的知识库导航文档";
  if (reason.startsWith("entry flow for ")) {
    const [entryType, entryNode] = reason.replace("entry flow for ", "").split("; entry node ");
    return `入口流程：${entryType}${entryNode ? `；入口节点 ${entryNode}` : ""}`;
  }
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

function countByCategory(documents: GeneratedDocument[]): Record<KnowledgeDocumentCategory, number> {
  const counts = Object.fromEntries(DOCUMENT_CATEGORIES.map((category) => [category, 0])) as Record<KnowledgeDocumentCategory, number>;
  for (const doc of documents) counts[doc.category] += 1;
  return counts;
}

function lineRef(node: { filePath?: string; lineRange?: [number, number] }, fallbackFilePath: string): string {
  return `\`${node.filePath ?? fallbackFilePath}\`${node.lineRange ? `:${node.lineRange.join("-")}` : ""}`;
}

function representedEdgesForTask(profile: ProjectProfile, task: FileDocTask): string[] {
  const localNodeIds = new Set([...task.sourceNodeIds, ...task.functionNodeIds, ...task.classNodeIds]);
  const represented = new Set<string>();
  for (const edge of profile.graph.edges) {
    if (localNodeIds.has(edge.source) || localNodeIds.has(edge.target)) {
      represented.add(edgeId(edge));
    }
  }
  return [...represented].sort();
}

function renderFunctionCard(profile: ProjectProfile, task: FileDocTask, nodeId: string, anchor: string): string {
  const node = nodeOf(profile, nodeId);
  const symbolFact = nodeSummary(node);
  const outgoing = profile.indexes.outgoingEdgesByNode.get(nodeId) ?? [];
  const incoming = profile.indexes.incomingEdgesByNode.get(nodeId) ?? [];
  const reads = outgoing.filter((edge) => edge.type === "reads_from");
  const writes = outgoing.filter((edge) => edge.type === "writes_to");
  const stateRelations = outgoing.filter((edge) => edge.type === "transforms" || edge.type === "validates");
  return [
    `<a id="${anchor}"></a>`,
    `### ${node?.name ?? nodeId}`,
    `- 节点 ID: \`${nodeId}\``,
    `- 位置: ${lineRef(node ?? {}, task.filePath)}`,
    `- 职责: ${nodeSummary(node)}`,
    `- 输入/依赖: ${incoming.map((edge) => nodeLabel(profile, edge.source)).join(", ") || `${symbolFact}；图谱未记录明确输入依赖，需结合源码调用点核对。`}`,
    `- 输出/副作用: ${outgoing.map((edge) => nodeLabel(profile, edge.target)).join(", ") || `${symbolFact}；图谱未记录明确输出对象，需结合返回值和副作用核对。`}`,
    `- 上游调用: ${incoming.filter((edge) => edge.type === "calls").map((edge) => nodeLabel(profile, edge.source)).join(", ") || "无"}`,
    `- 下游调用: ${outgoing.filter((edge) => edge.type === "calls").map((edge) => nodeLabel(profile, edge.target)).join(", ") || "无"}`,
    `- 入口条件: ${incoming.filter((edge) => edge.type === "calls" || edge.type === "triggers").map((edge) => `${nodeLabel(profile, edge.source)} 通过 ${edgeTypeLabel(edge.type)} 进入`).join("；") || `${symbolFact}；图谱未记录明确入口条件，需从调用点或触发器核对。`}`,
    `- 字段/资源读取: ${reads.map((edge) => nodeLabel(profile, edge.target)).join(", ") || `${symbolFact}；图谱未记录 reads_from 关系。`}`,
    `- 字段/资源写入: ${writes.map((edge) => nodeLabel(profile, edge.target)).join(", ") || `${symbolFact}；图谱未记录 writes_to 关系。`}`,
    `- 状态变化/校验: ${stateRelations.map((edge) => `${edgeTypeLabel(edge.type)} ${nodeLabel(profile, edge.target)}`).join("；") || `${symbolFact}；图谱未记录 transforms 或 validates 关系。`}`,
    `- 业务含义: ${symbolFact}；名称、标签和调用关系只用于定位影响范围，真实业务口径需要结合调用场景确认。`,
    `- 注意事项: 围绕“${symbolFact}”修改实现前，检查调用关系索引和相关测试。`,
    `- 代码证据: ${lineRef(node ?? {}, task.filePath)}`,
  ].join("\n");
}

function renderClassCard(profile: ProjectProfile, task: FileDocTask, nodeId: string, anchor: string): string {
  const node = nodeOf(profile, nodeId);
  const symbolFact = nodeSummary(node);
  const outgoing = profile.indexes.outgoingEdgesByNode.get(nodeId) ?? [];
  const incoming = profile.indexes.incomingEdgesByNode.get(nodeId) ?? [];
  return [
    `<a id="${anchor}"></a>`,
    `### ${node?.name ?? nodeId}`,
    `- 节点 ID: \`${nodeId}\``,
    `- 位置: ${lineRef(node ?? {}, task.filePath)}`,
    `- 职责: ${nodeSummary(node)}`,
    `- 关联入口/依赖: ${[...incoming, ...outgoing].map((edge) => edge.source === nodeId ? nodeLabel(profile, edge.target) : nodeLabel(profile, edge.source)).join(", ") || `${symbolFact}；图谱未记录明确关联对象，需结合构造和调用位置核对。`}`,
    `- 代码证据: ${lineRef(node ?? {}, task.filePath)}`,
  ].join("\n");
}

function sourceRangeForNode(task: FileDocTask, node: GraphNode | undefined): [number, number] {
  if (!task.sourceSnapshot.exists || task.sourceSnapshot.totalLines <= 0) return [1, 1];
  if (
    node?.lineRange
    && node.lineRange[0] > 0
    && node.lineRange[1] >= node.lineRange[0]
    && node.lineRange[1] <= task.sourceSnapshot.totalLines
    && excerptForLineRange(task.sourceSnapshot, node.lineRange).trim()
  ) {
    return node.lineRange;
  }
  if (node?.name) {
    const lineIndex = task.sourceSnapshot.text.split(/\r?\n/).findIndex((line) => line.includes(node.name));
    if (lineIndex >= 0) return [lineIndex + 1, lineIndex + 1];
  }
  return [1, task.sourceSnapshot.totalLines];
}

function concreteSourceClaim(
  node: GraphNode | undefined,
  filePath: string,
  lineRange: [number, number],
): string {
  const subject = node?.type === "file"
    ? `文件“${filePath}”`
    : `${node ? NODE_TYPE_LABELS[node.type] : "节点"}“${node?.name ?? "未命名"}”`;
  return `源码范围“${filePath}:${lineRange.join("-")}”记录${subject}的实际内容；${nodeSummary(node, "源码快照保留了该节点的实际内容，但图谱没有提供职责摘要。")}`;
}

function directEvidenceForTask(profile: ProjectProfile, task: FileDocTask): DirectSourceEvidence[] {
  if (!task.sourceSnapshot.exists || !task.sourceSnapshot.text.trim()) return [];
  return [task.fileNodeId, ...task.functionNodeIds, ...task.classNodeIds].map((nodeId, index) => {
    const node = nodeOf(profile, nodeId);
    const lineRange = index === 0
      ? [1, task.sourceSnapshot.totalLines] as [number, number]
      : sourceRangeForNode(task, node);
    return {
      filePath: task.filePath,
      nodeId,
      lineRange,
      excerpt: excerptForLineRange(task.sourceSnapshot, lineRange),
      claim: concreteSourceClaim(node, task.filePath, lineRange),
    };
  });
}

function specializedFileSections(task: FileDocTask, fileFact: string): string[] {
  const evidence = `源码范围“${task.filePath}:1-${Math.max(1, task.sourceSnapshot.totalLines)}”记录该文件的实际内容；${fileFact}`;
  const sections = task.referenceKind === "configuration"
    ? ["配置目的与作用域", "配置项、类型与默认值", "读取位置与生效顺序", "缺失、非法值与降级", "测试与改动风险", "源码证据"]
    : task.referenceKind === "schema"
      ? ["数据模型与边界", "字段、类型与约束", "读写方与生命周期", "校验、迁移与兼容性", "测试与改动风险", "源码证据"]
      : task.referenceKind === "documentation"
        ? ["文档目的与读者", "关键结论", "链接与外部依赖", "与代码的对应关系", "过期风险与维护入口", "源码证据"]
        : ["被测行为与范围", "用例、输入与断言", "Fixture、Mock 与外部依赖", "失败分支与回归风险", "尚未覆盖的行为", "与生产代码的对应关系", "源码证据"];
  return sections.flatMap((section) => [
    `## ${section}`,
    section === "源码证据"
      ? evidence
      : `${section}围绕“${fileFact}”核对源码结构、读取位置、失败边界和改动影响；未出现在快照中的运行时值保留为该文件的外部验证项。`,
    "",
  ]);
}

export function renderDeterministicFileWriterDocument(profile: ProjectProfile, task: FileDocTask): FileWriterDocument {
  const fileFact = nodeSummary(nodeOf(profile, task.fileNodeId), "图谱中存在该文件，但没有摘要。");
  const primarySymbolFact = nodeSummary(
    nodeOf(profile, task.functionNodeIds[0] ?? task.classNodeIds[0] ?? task.fileNodeId),
    fileFact,
  );
  const representedEdgeIds = representedEdgesForTask(profile, task);
  const localNodeIds = new Set([...task.sourceNodeIds, ...task.functionNodeIds, ...task.classNodeIds]);
  const relatedEdges = profile.graph.edges.filter((edge) => localNodeIds.has(edge.source) || localNodeIds.has(edge.target));
  const incomingRelations = relatedEdges.filter((edge) => !localNodeIds.has(edge.source) && localNodeIds.has(edge.target));
  const outgoingRelations = relatedEdges.filter((edge) => localNodeIds.has(edge.source));
  const readRelations = outgoingRelations.filter((edge) => edge.type === "reads_from");
  const writeRelations = outgoingRelations.filter((edge) => edge.type === "writes_to");
  const stateRelations = outgoingRelations.filter((edge) => edge.type === "transforms" || edge.type === "validates");
  const importantNodeIds = [...task.functionNodeIds, ...task.classNodeIds]
    .filter((nodeId) => nodeOf(profile, nodeId)?.complexity === "complex")
    .sort();
  const anchorByNodeId = new Map(stableSymbolAnchors(profile, task).map((item) => [item.nodeId, item.anchor]));
  const functionCards = task.functionNodeIds.map((nodeId) =>
    renderFunctionCard(profile, task, nodeId, anchorByNodeId.get(nodeId) ?? slugPath(nodeId)));
  const classCards = task.classNodeIds.map((nodeId) =>
    renderClassCard(profile, task, nodeId, anchorByNodeId.get(nodeId) ?? slugPath(nodeId)));
  const codeEvidenceLines = [
    `- 文件证据: 源码快照记录 \`${task.filePath}\`；${fileFact}`,
    ...task.functionNodeIds.map((nodeId) => {
      const node = nodeOf(profile, nodeId);
      return `- 函数证据: \`${nodeId}\` 位于 ${lineRef(node ?? {}, task.filePath)}；${nodeSummary(node)}。`;
    }),
    ...task.classNodeIds.map((nodeId) => {
      const node = nodeOf(profile, nodeId);
      return `- 类证据: \`${nodeId}\` 位于 ${lineRef(node ?? {}, task.filePath)}；${nodeSummary(node)}。`;
    }),
  ];
  const sourceEvidence = directEvidenceForTask(profile, task);
  const publicationSections = task.referenceKind === "code"
    ? [
        "## 输入、输出与关键字段",
        `- ${primarySymbolFact}；其输入由 ${task.incomingEdgeIds.length} 条入站关系和源码参数定位，输出由 ${task.outgoingEdgeIds.length} 条出站关系及返回对象定位。`,
        `- ${fileFact}；关键字段以该文件源码摘录为准，图谱未记录的字段保留为未确认项。`,
        "",
        "## 规则、分支与状态变化",
        `- ${fileFact}；文件内 ${task.functionNodeIds.length} 个函数和 ${task.classNodeIds.length} 个类型的分支、校验与状态变化需回到各自源码范围核对。`,
        `- ${primarySymbolFact}；没有显式关系的步骤保留证据缺口，不把静态邻接顺序解释为运行时严格顺序。`,
        "",
        "## 配置、依赖与副作用",
        `- ${fileFact}；当前记录入站关系 ${task.incomingEdgeIds.length} 条、出站关系 ${task.outgoingEdgeIds.length} 条，读写、配置和外部副作用仅按这些关系陈述。`,
        `- ${primarySymbolFact}；数据库、缓存、消息和线上配置没有直接证据时，保留为该符号的待核验项。`,
        "",
        "## 异常、测试与改动风险",
        `- 围绕“${fileFact}”修改前，运行正常、边界和异常用例，并核对调用方契约、返回字段和配置默认值。`,
        task.sourceSnapshot.exists
          ? `- “${primarySymbolFact}”已有可读取源码快照；动态分支仍需由对应测试或运行时记录验证。`
          : `- “${fileFact}”缺少源码快照；当前输出保留为失败质量并等待重新生成。`,
        "",
        "## 函数与类型",
        ...[...task.functionNodeIds, ...task.classNodeIds].map((nodeId) => {
          const node = nodeOf(profile, nodeId);
          return `- \`${nodeId}\`：${nodeSummary(node)}，定位 ${lineRef(node ?? {}, task.filePath)}。`;
        }),
        ...([ ...task.functionNodeIds, ...task.classNodeIds ].length === 0
          ? ["- 当前图谱没有解析出函数或类型节点，需核对源码解析范围。"]
          : []),
        "",
        "## 源码证据",
        ...sourceEvidence.map((item) => `- ${item.claim} \`${item.filePath}:${item.lineRange.join("-")}\`；摘录：\`${item.excerpt}\``),
        ...(sourceEvidence.length === 0 ? ["- 源码快照缺失，当前没有可发布的精确摘录。"] : []),
        "",
      ]
    : specializedFileSections(task, fileFact);

  return {
    fileNodeId: task.fileNodeId,
    filePath: task.filePath,
    documentPath: task.documentPath,
    referenceKind: task.referenceKind,
    title: `${task.filePath} 文件知识文档`,
    coveredFunctionNodeIds: [...task.functionNodeIds],
    coveredClassNodeIds: [...task.classNodeIds],
    representedEdgeIds,
    sourceEvidence,
    importantNodeIds,
    markdown: [
      `# ${task.filePath} 文件知识文档`,
      "",
      "## 非技术同学速读",
      `快速理解: ${fileFact} 本页据此定位 ${task.functionNodeIds.length} 个函数、${task.classNodeIds.length} 个类及其相邻调用关系。`,
      "",
      "## 文件职责",
      fileFact,
      "",
      "## 业务问题与影响对象",
      `- 业务问题: \`${task.filePath}\` 的源码事实为“${fileFact}”，用于界定文件职责、结构边界和调用影响。`,
      `- 影响对象: ${[...task.functionNodeIds, ...task.classNodeIds].map((nodeId) => nodeOf(profile, nodeId)?.name ?? nodeId).join(", ") || "当前文件自身和相关调用方"}`,
      `- 调用影响: ${primarySymbolFact} 当前连接 ${task.incomingEdgeIds.length} 个上游关系和 ${task.outgoingEdgeIds.length} 个下游关系，修改时逐条核对这些关系。`,
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
      "## 关键规则、输入输出与兜底",
      `- 输入: ${fileFact} 当前有 ${task.incomingEdgeIds.length} 条上游调用、导入或包含关系可用于定位请求、数据对象和模块依赖。`,
      `- 输出: ${primarySymbolFact} 当前有 ${task.outgoingEdgeIds.length} 条下游关系可用于定位返回对象或导出能力。`,
      task.sourceSnapshot.exists
        ? `- 兜底: ${fileFact} 已有源码快照；函数卡片和类卡片用于核对静态事实，线上数据、配置和运行时参数保留为外部验证项。`
        : `- 兜底: ${fileFact} 对应源文件缺失，当前只保留图谱事实并等待源码恢复后重新生成。`,
      "",
      "## 入口条件与处理顺序",
      `- 入口条件: ${incomingRelations.map((edge) => `${nodeLabel(profile, edge.source)} --[${edgeTypeLabel(edge.type)}]--> ${nodeLabel(profile, edge.target)}`).join("；") || `${fileFact} 图谱没有记录显式调用或触发关系，需从该文件导出点和运行时入口核对。`}`,
      `- 处理顺序: ${outgoingRelations.slice(0, 12).map((edge) => `${nodeLabel(profile, edge.source)} --[${edgeTypeLabel(edge.type)}]--> ${nodeLabel(profile, edge.target)}`).join("；") || `图谱没有记录 \`${task.filePath}\` 的下游关系。`}`,
      `- 顺序边界: ${primarySymbolFact} 上述顺序仅来自静态关系图，不能单独证明异步、并行或条件分支的严格运行时先后。`,
      "",
      "## 字段读写与状态变化",
      `- 读取: ${readRelations.map((edge) => `${nodeLabel(profile, edge.source)} 读取 ${nodeLabel(profile, edge.target)}`).join("；") || `${fileFact} 未检测到 reads_from 关系；函数参数和对象字段仍需结合该文件源码核对。`}`,
      `- 写入: ${writeRelations.map((edge) => `${nodeLabel(profile, edge.source)} 写入 ${nodeLabel(profile, edge.target)}`).join("；") || `${fileFact} 未检测到 writes_to 关系，不能据此断言没有缓存、数据库或内存写入。`}`,
      `- 状态变化: ${stateRelations.map((edge) => `${nodeLabel(profile, edge.source)} 通过 ${edgeTypeLabel(edge.type)} 作用于 ${nodeLabel(profile, edge.target)}`).join("；") || `${primarySymbolFact} 未检测到 transforms/validates 关系；返回对象变更和校验失败路径需从源码确认。`}`,
      "",
      "## 函数卡片",
      functionCards.join("\n\n") || `${fileFact} 当前没有图谱函数节点；结合文件职责、类卡片和调用关系核对是否存在未被解析的导出函数或动态定义。`,
      "",
      "## 类卡片",
      classCards.join("\n\n") || `${fileFact} 当前没有图谱类节点；结合函数卡片和源码导出核对是否存在未被解析的类或构造对象。`,
      "",
      "## 调用关系",
      representedEdgeIds.map((id) => `- ${id}`).join("\n") || "- 图谱未记录调用、导入或包含关系。",
      "",
      "## 风险点与待确认项",
      task.sourceSnapshot.exists
        ? `- ${fileFact} 的运行时配置、数据内容和线上流量路径不会完全体现在本地图谱中，修改前结合部署环境、调用方和测试结果确认。`
        : `- ${fileFact} 对应源文件缺失，当前文档只基于图谱生成并保持不完整状态。`,
      "",
      "## 证据分级",
      `- 本地代码事实: ${fileFact}；另有 ${task.functionNodeIds.length} 个函数节点、${task.classNodeIds.length} 个类节点和 ${representedEdgeIds.length} 条相邻关系来自源码快照或图谱。`,
      `- 代码推断: ${primarySymbolFact}；入口、下游影响和状态变化由该节点摘要及关系类型归纳，不等同于运行时观测。`,
      `- 外部待核验: 围绕“${fileFact}”使用的真实配置值、数据库内容、流量分支和发布效果需通过配置平台、日志、指标或调用方契约确认。`,
      "",
      "## 待核验清单",
      `- [ ] 围绕“${fileFact}”核对真实入口是否与 ${incomingRelations.length} 条入站关系一致，并补充动态调用或反射入口。`,
      `- [ ] 围绕“${primarySymbolFact}”核对读取、写入和状态变化是否遗漏未建图的字段、缓存、数据库或消息副作用。`,
      `- [ ] 为“${primarySymbolFact}”运行相关单元测试和集成测试，确认兜底、错误路径及关键分支。`,
      "",
      "## 代码证据",
      codeEvidenceLines.join("\n"),
      "",
      "## AI 检索索引",
      "| 检索意图 | 关键词 | 定位 |",
      "|---|---|---|",
      `| 理解文件职责 | ${task.filePath}, ${task.fileNodeId} | 本文“文件职责”“入口条件与处理顺序” |`,
      `| 定位函数与类 | ${[...task.functionNodeIds, ...task.classNodeIds].join(", ") || task.fileNodeId} | 本文“函数卡片”“类卡片” |`,
      `| 评估改动风险 | ${representedEdgeIds.slice(0, 8).join(", ") || task.filePath} | 本文“字段读写与状态变化”“待核验清单”“代码证据” |`,
      "",
      ...publicationSections,
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
  fileDocPlan?: FileDocPlan,
): TopicWriterDocument {
  const node = nodeOf(profile, topic.topicNodeId);
  const sourceFile = nodeOf(profile, topic.sourceFileNodeId);
  const { incoming, outgoing } = edgesForNode(profile, topic.topicNodeId);
  const incomingEdges = profile.indexes.incomingEdgesByNode.get(topic.topicNodeId) ?? [];
  const outgoingEdges = profile.indexes.outgoingEdgesByNode.get(topic.topicNodeId) ?? [];
  const entryEdges = incomingEdges.filter((edge) => edge.type === "calls" || edge.type === "triggers" || edge.type === "routes");
  const readEdges = outgoingEdges.filter((edge) => edge.type === "reads_from");
  const writeEdges = outgoingEdges.filter((edge) => edge.type === "writes_to");
  const stateEdges = outgoingEdges.filter((edge) => edge.type === "transforms" || edge.type === "validates");
  const dependencyEdges = [...incomingEdges, ...outgoingEdges]
    .filter((edge) => ["configures", "reads_from", "writes_to", "depends_on", "transforms", "validates"].includes(edge.type));
  const testEdges = [...incomingEdges, ...outgoingEdges].filter((edge) => edge.type === "tested_by");
  const evidenceCandidates = [
    topic.topicNodeId,
    ...topic.coveredNodeIds,
    topic.sourceFileNodeId,
    ...incomingEdges.flatMap((edge) => [edge.source, edge.target]),
    ...outgoingEdges.flatMap((edge) => [edge.source, edge.target]),
  ];
  const evidence: DirectSourceEvidence[] = [];
  const evidenceGroups = new Set<string>();
  for (const nodeId of [...new Set(evidenceCandidates)]) {
    const item = nodeOf(profile, nodeId);
    if (!item) continue;
    const task = item.filePath
      ? fileDocPlan?.tasks.find((candidate) => candidate.filePath === normalizeKnowledgeSourcePath(item.filePath!))
      : undefined;
    const lineRange = task ? sourceRangeForNode(task, item) : item.lineRange ?? [1, 1];
    const excerpt = task
      ? excerptForLineRange(task.sourceSnapshot, lineRange)
      : item.summary.trim() || item.name;
    const filePath = item.filePath ?? sourceFile?.filePath ?? topic.sourceFileNodeId;
    const group = `${filePath}:${lineRange.join("-")}`;
    if (!excerpt.trim() || evidenceGroups.has(group)) continue;
    evidenceGroups.add(group);
    evidence.push({
      filePath,
      lineRange,
      nodeId: item.id,
      excerpt,
      claim: concreteSourceClaim(item, filePath, lineRange),
    });
  }
  const sections: Record<string, string> = {
    "## 非技术同学速读": [
      `这个主题用于说明 \`${topic.title}\` 在代码中的业务作用和改动影响。`,
      `优先关注它覆盖的 ${topic.coveredNodeIds.length} 个代码节点、所在文件 \`${sourceFile?.filePath ?? node?.filePath ?? topic.sourceFileNodeId}\`，以及上下游调用变化对业务流程的影响。`,
    ].join("\n"),
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
    "## 入口条件与处理顺序": [
      `- 入口条件: ${entryEdges.map((edge) => `${nodeLabel(profile, edge.source)} 通过 ${edgeTypeLabel(edge.type)} 到达 ${nodeLabel(profile, edge.target)}`).join("；") || `图谱没有记录 \`${topic.topicNodeId}\` 的显式调用、触发或路由入口，需从所属文件的导出点继续核对。`}`,
      `- 处理顺序: ${outgoingEdges.slice(0, 12).map((edge) => `${nodeLabel(profile, edge.source)} --[${edgeTypeLabel(edge.type)}]--> ${nodeLabel(profile, edge.target)}`).join("；") || `图谱没有记录 \`${topic.topicNodeId}\` 的下游处理关系。`}`,
      `- 顺序边界: 上述处理顺序是静态关系展开，不证明异步任务、并行调用和条件分支的严格运行时先后；严格顺序需由控制流、源码分支或 trace 证据确认。`,
    ].join("\n"),
    "## 字段读写与状态变化": [
      `- 读取: ${readEdges.map((edge) => nodeLabel(profile, edge.target)).join("；") || `\`${topic.topicNodeId}\` 未记录 reads_from 关系，参数字段和隐式上下文需从源码核对。`}`,
      `- 写入: ${writeEdges.map((edge) => nodeLabel(profile, edge.target)).join("；") || `\`${topic.topicNodeId}\` 未记录 writes_to 关系，不能据此排除缓存、存储或内存写入。`}`,
      `- 状态变化: ${stateEdges.map((edge) => `${edgeTypeLabel(edge.type)} ${nodeLabel(profile, edge.target)}`).join("；") || `\`${topic.topicNodeId}\` 未记录 transforms/validates 关系，返回对象变化和校验失败路径需工程核验。`}`,
    ].join("\n"),
    "## 配置和外部依赖": dependencyEdges.length > 0
      ? dependencyEdges.map((edge) => `- ${nodeLabel(profile, edge.source)} --[${edgeTypeLabel(edge.type)}]--> ${nodeLabel(profile, edge.target)}`).join("\n")
      : "- 图谱未记录直接配置或外部依赖。",
    "## 上游调用者": incoming.join("\n") || "- 无",
    "## 下游调用对象": outgoing.join("\n") || "- 无",
    "## 修改风险": [
      "- 修改前需要检查上游调用、下游依赖、单测覆盖和运行时配置。",
      "- 业务口径、实验策略和数据状态需要外部确认。根据代码推断，需线上配置确认",
    ].join("\n"),
    "## 测试证据": testEdges.length > 0
      ? testEdges.map((edge) => `- ${nodeLabel(profile, edge.source)} --[${edgeTypeLabel(edge.type)}]--> ${nodeLabel(profile, edge.target)}`).join("\n")
      : `- 图谱没有为 \`${topic.topicNodeId}\` 记录 tested_by 关系；自动化测试是否覆盖入口条件、分支、读写副作用和异常路径需要工程侧核验。`,
    "## 证据分级": [
      `- 本地代码事实: \`${topic.topicNodeId}\`、所属文件 \`${sourceFile?.filePath ?? node?.filePath ?? topic.sourceFileNodeId}\`、${incomingEdges.length} 条入站关系和 ${outgoingEdges.length} 条出站关系来自图谱与源码定位。`,
      `- 代码推断: 业务作用、处理顺序和影响范围由节点摘要、关系类型及上下游名称归纳，不等同于运行时观测。`,
      `- 外部待核验: \`${topic.topicNodeId}\` 的真实配置值、数据内容、流量命中条件和线上指标需通过配置平台、日志、trace 或业务 owner 确认。`,
    ].join("\n"),
    "## 待核验清单": [
      `- [ ] 核对 \`${topic.topicNodeId}\` 的真实入口条件以及 ${entryEdges.length} 条入口关系是否覆盖动态调用。`,
      `- [ ] 核对 \`${topic.topicNodeId}\` 的读取、写入、转换和校验关系是否完整，并记录关键字段前后值。`,
      `- [ ] 运行或补充 \`${topic.topicNodeId}\` 的正常、边界、异常与回归测试，确认线上配置差异。`,
    ].join("\n"),
    "## 代码证据": [
      "| 节点 | 文件 | 行号 |",
      "|---|---|---|",
      ...evidence.map((item) => `| \`${item.nodeId}\` | \`${item.filePath}\` | ${item.lineRange?.join("-") ?? ""} |`),
    ].join("\n"),
    "## AI 检索索引": [
      "| 检索意图 | 关键词 | 定位 |",
      "|---|---|---|",
      `| 理解业务作用 | ${[node?.name, topic.topicNodeId, ...(node?.tags ?? [])].filter(Boolean).join(", ")} | 本文“为什么关键”“在业务流程中的位置” |`,
      `| 追踪关系与状态 | ${topic.coveredNodeIds.join(", ")} | 本文“入口条件与处理顺序”“字段读写与状态变化” |`,
      `| 评估变更与验证 | ${[node?.filePath, topic.linkedFileDocumentPath, ...testEdges.map((edge) => edgeId(edge))].filter(Boolean).join(", ")} | 本文“修改风险”“测试证据”“待核验清单”“代码证据” |`,
    ].join("\n"),
    "## 完整条件与跳过规则": [
      `- 进入条件：${entryEdges.map((edge) => `${nodeLabel(profile, edge.source)} 通过 ${edgeTypeLabel(edge.type)} 进入`).join("；") || "静态图谱没有显式入口，需从所属文件导出点核对。"}`,
      `- 跳过规则：没有控制流或源码分支证据时，不推测 \`${topic.topicNodeId}\` 的运行时跳过条件。`,
    ].join("\n"),
    "## 输入输出与状态变化": [
      `- 输入：${incoming.join("；") || "图谱未记录显式上游输入。"}`,
      `- 输出：${outgoing.join("；") || "图谱未记录显式下游输出。"}`,
      `- 状态变化：${stateEdges.map((edge) => `${edgeTypeLabel(edge.type)} ${nodeLabel(profile, edge.target)}`).join("；") || "未记录转换或校验关系，需从源码返回对象核对。"}`,
    ].join("\n"),
    "## 算法、分支与降级": [
      nodeSummary(node, "图谱没有提供算法摘要。"),
      "只有源码分支、配置读取或测试断言能够证明具体规则；证据不足时保留降级和异常路径为待核验项。",
    ].join("\n"),
    "## 依赖、测试与可观测性": [
      dependencyEdges.length > 0
        ? dependencyEdges.map((edge) => `- 依赖：${nodeLabel(profile, edge.source)} --[${edgeTypeLabel(edge.type)}]--> ${nodeLabel(profile, edge.target)}`).join("\n")
        : "- 依赖：图谱未记录直接配置或外部依赖。",
      testEdges.length > 0
        ? testEdges.map((edge) => `- 测试：${nodeLabel(profile, edge.source)} --[${edgeTypeLabel(edge.type)}]--> ${nodeLabel(profile, edge.target)}`).join("\n")
        : "- 测试：未记录 tested_by 关系，需补充单元或集成测试证据。",
      "- 可观测性：静态图谱不能证明线上日志、指标或 trace，发布前需要外部验证。",
    ].join("\n"),
    "## 源码证据": evidence.length > 0
      ? evidence.map((item) => `- ${item.claim} \`${item.filePath}:${item.lineRange.join("-")}\`；摘录：\`${item.excerpt}\``).join("\n")
      : "- 当前没有三组可核对的源码证据，不能发布该主题。",
  };

  const legacySections = [
    "## 非技术同学速读",
    "## 在业务流程中的位置",
    "## 主要输入、输出、副作用",
    "## 关键分支和算法",
    "## 入口条件与处理顺序",
    "## 字段读写与状态变化",
    "## 配置和外部依赖",
    "## 上游调用者",
    "## 下游调用对象",
    "## 修改风险",
    "## 测试证据",
    "## 证据分级",
    "## 待核验清单",
    "## 代码证据",
    "## AI 检索索引",
  ];

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
      ...legacySections.flatMap((section) => [section, sections[section], ""]),
      ...TOPIC_WRITER_REQUIRED_SECTIONS.flatMap((section) => [section, sections[section], ""]),
    ].join("\n").trimEnd(),
  };
}

function businessCapabilityDocumentPath(title: string, id: string): string {
  return sharedBusinessCapabilityDocumentPath(title, id);
}

const EVIDENCE_SUMMARY_GROUPS: Array<{
  role: BusinessEvidenceRole;
  title: string;
  path: string;
  readerSummary: string;
  usage: string;
}> = [
  {
    role: "primary",
    title: "生产主证据汇总",
    path: "业务能力/生产主证据汇总.md",
    readerSummary: "这一页汇总 production-logic 和 configuration 等主证据，帮助读者优先确认哪些业务能力真正落在生产逻辑或配置里。",
    usage: "主证据最适合用于判断线上规则、修改风险和回归测试优先级。",
  },
  {
    role: "supporting",
    title: "支撑证据汇总",
    path: "业务能力/支撑证据汇总.md",
    readerSummary: "这一页汇总代码注释、测试样例、设计文档等支撑证据，帮助读者理解业务术语和规则意图。",
    usage: "支撑证据可以辅助解释业务含义，但需要结合生产逻辑或配置才能确认线上行为。",
  },
  {
    role: "example-only",
    title: "示例证据汇总",
    path: "业务能力/示例证据汇总.md",
    readerSummary: "这一页汇总只出现在 Prompt、工具样例或抽取示例里的业务词，避免这些词被误认为已经有生产规则支撑。",
    usage: "示例证据适合保留业务词汇线索，但不能单独作为上线规则或产品策略依据。",
  },
];

function evidenceLocationText(evidence: { filePath: string; lineRange?: [number, number]; nodeId?: string }): string {
  const line = evidence.lineRange ? `:${evidence.lineRange.join("-")}` : "";
  const node = evidence.nodeId ? `（${evidence.nodeId}）` : "";
  return `\`${evidence.filePath}\`${line}${node}`;
}

function renderEvidenceSummaryDocument(
  group: (typeof EVIDENCE_SUMMARY_GROUPS)[number],
  facts: BusinessFact[],
): any {
  const roleFacts = facts.filter((fact) => fact.evidenceRole === group.role);
  const keywords = [...new Set(roleFacts.flatMap((fact) => fact.keywords))].sort();
  const directNodeIds = [...new Set(roleFacts.flatMap((fact) => fact.relatedNodeIds))].sort();
  const sourceKindCounts = roleFacts.reduce((counts, fact) => {
    counts.set(fact.sourceKind, (counts.get(fact.sourceKind) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const sourceKindText = [...sourceKindCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([kind, count]) => `${kind}: ${count}`)
    .join("；") || "当前没有该等级证据";
  const representativeFacts = roleFacts.slice(0, 20);
  const lines = [
    `# ${group.title}`,
    "",
    "## 非技术同学速读",
    "",
    group.readerSummary,
    `当前共识别 ${roleFacts.length} 条 ${evidenceRoleLabel(group.role)}，覆盖 ${directNodeIds.length} 个图谱节点。${group.usage}`,
    "",
    "## 包含哪些证据",
    "",
    `- 证据等级: ${evidenceRoleLabel(group.role)}`,
    `- 来源类型分布: ${sourceKindText}`,
    `- 代表性关键词: ${keywords.slice(0, 30).join("、") || "当前没有关键词"}`,
    "",
    "## 代表性证据",
    "",
    "| 来源类型 | 事实 | 证据位置 | 业务含义 |",
    "|---|---|---|---|",
  ];

  for (const fact of representativeFacts) {
    lines.push(
      `| ${fact.sourceKind} | ${fact.title} | ${fact.evidence.map(evidenceLocationText).join("<br>") || "未记录源码位置"} | ${fact.businessMeaning || fact.summary} |`,
    );
  }
  if (representativeFacts.length === 0) {
    lines.push("| 无 | 当前没有这一证据等级的事实 | 无 | 该页仍保留，用于说明本次知识库没有识别到对应证据等级，避免读者误判证据缺口。 |");
  }

  lines.push("");
  lines.push("## 阅读建议");
  lines.push("");
  lines.push(group.usage);
  lines.push(group.role === "primary"
    ? "阅读业务能力时应优先查看这一组证据，因为它最接近真实执行路径。"
    : "阅读业务能力时应把这一组证据作为解释材料，再回到生产逻辑、配置和运行数据中确认。");
  lines.push("");
  lines.push("## 代码证据");
  lines.push("");
  const evidenceItems = roleFacts.flatMap((fact) => fact.evidence).slice(0, 30);
  for (const evidence of evidenceItems) {
    lines.push(`- ${evidenceLocationText(evidence)}${evidence.excerpt ? `：${evidence.excerpt}` : ""}`);
  }
  if (evidenceItems.length === 0) {
    lines.push("- 当前没有可列出的源码位置；这说明对应证据等级在本次图谱和源码快照中没有命中。");
  }

  return {
    path: group.path,
    title: group.title,
    category: "capability",
    directNodeIds,
    representedEdgeIds: [],
    content: lines.join("\n"),
  };
}

export function renderBusinessCapabilityInventoryDocuments(
  profile: ProjectProfile,
  businessCapabilityProfile: BusinessCapabilityProfile,
): any[] {
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
  indexLines.push("");
  indexLines.push("## 证据分组");
  indexLines.push("");
  for (const group of EVIDENCE_SUMMARY_GROUPS) {
    indexLines.push(`- [${group.title}](${group.path}): ${group.readerSummary}`);
  }
  indexLines.push("");
  indexLines.push("| 业务能力 | 证据等级 | 可信度 | 主证据数 | 支撑证据数 | 示例证据数 | 关键词 |");
  indexLines.push("|---|---|---|---:|---:|---:|---|");
  for (const capability of businessCapabilityProfile.capabilities) {
    indexLines.push(
      `| [${capability.title}](${businessCapabilityDocumentPath(capability.title, capability.id)}) | ${evidenceRoleLabel(capability.evidenceRole)} | ${capability.confidence} / ${confidenceLabel(capability.confidence)} | ${capability.primaryFactIds.length} | ${capability.supportingFactIds.length} | ${capability.exampleOnlyFactIds.length} | ${capability.keywords.join("、")} |`,
    );
  }
  if (businessCapabilityProfile.capabilities.length === 0) {
    indexLines.push("| 未识别到高信号业务能力 | 无 | 无 | 0 | 0 | 0 | 无 |");
  }

  const factsById = new Map(businessCapabilityProfile.facts.map((fact) => [fact.id, fact]));
  const documents: any[] = [
    {
      path: "业务能力索引.md",
      title: "业务能力索引",
      category: "capability",
      directNodeIds: [...new Set(businessCapabilityProfile.facts.flatMap((fact) => fact.relatedNodeIds))].sort(),
      representedEdgeIds: [],
      content: indexLines.join("\n"),
    },
    ...EVIDENCE_SUMMARY_GROUPS.map((group) =>
      renderEvidenceSummaryDocument(group, businessCapabilityProfile.facts)
    ),
  ];

  for (const capability of businessCapabilityProfile.capabilities) {
    const facts = capability.factIds
      .map((factId) => factsById.get(factId))
      .filter((fact): fact is NonNullable<typeof fact> => Boolean(fact));
    const relatedNodes = capability.relatedNodeIds
      .map((nodeId) => nodeOf(profile, nodeId))
      .filter((node): node is GraphNode => Boolean(node));
    const primaryFacts = facts.filter((fact) => fact.evidenceRole === "primary");
    const supportingFacts = facts.filter((fact) => fact.evidenceRole === "supporting");
    const exampleFacts = facts.filter((fact) => fact.evidenceRole === "example-only");
    const ruleFacts = facts.filter((fact) => fact.evidenceRole === "primary" || fact.evidenceRole === "supporting");
    const triggerFacts = ruleFacts.filter((fact) => fact.kind === "branch" || fact.kind === "constant" || fact.kind === "config");
    const testFacts = facts.filter((fact) => fact.kind === "test");
    const firstEvidence = facts.flatMap((fact) => fact.evidence)[0];
    const sourceKinds = Object.entries(capability.sourceKindCounts)
      .filter(([, count]) => (count ?? 0) > 0)
      .map(([kind, count]) => `${kind}: ${count}`)
      .join("；") || "未识别";
    const lines = [
      `# ${capability.title}`,
      "",
      "## 非技术同学速读",
      "",
      `这份文档说明“${capability.title}”这项业务能力在本地代码、配置、测试或文档中有哪些证据，以及这些证据是否足以支撑生产规则判断。`,
      `证据等级: ${evidenceRoleLabel(capability.evidenceRole)}；可信度: ${capability.confidence} / ${confidenceLabel(capability.confidence)}；主证据 ${primaryFacts.length} 条，支撑证据 ${supportingFacts.length} 条，示例证据 ${exampleFacts.length} 条。`,
      capability.evidenceRole === "example-only" || primaryFacts.length === 0
        ? "当前没有 production-logic 或 configuration 主证据，不能仅凭示例或提示词内容确认线上规则。"
        : `主证据来自生产逻辑或配置，首个证据位置是 ${firstEvidence ? evidenceLocationText(firstEvidence) : "未记录具体位置"}。`,
      "",
      "## 业务结论",
      "",
      `- 该能力由 ${facts.length} 条业务事实聚合而来，覆盖 ${capability.relatedNodeIds.length} 个代码、配置、测试或文档节点。`,
      `- 主要关键词: ${capability.keywords.join("、") || "未识别"}`,
      `- 证据来源类型: ${sourceKinds}`,
      `- 修改前优先核对主证据和支撑证据，示例证据只用于理解语义，不应单独作为上线依据。`,
      "",
      "## 业务问题与影响对象",
      "",
      `- 业务问题: ${capability.title} 需要说明哪些条件会命中、命中后影响什么对象，以及证据是否来自可执行生产逻辑。`,
      `- 影响对象: ${relatedNodes.map((node) => `${node.name}（${NODE_TYPE_LABELS[node.type]}）`).join("、") || "当前未关联到明确图谱对象"}`,
      `- 覆盖范围: ${capability.keywords.join("、") || capability.title} 等关键词，以及相关代码、配置、测试和设计文档。`,
      "",
      "## 关键规则与触发条件",
      "",
      primaryFacts.length > 0
        ? `主证据规则: ${primaryFacts.map((fact) => `${fact.title}（${fact.sourceKind}）`).join("；")}。`
        : "主证据规则: 当前没有 production-logic 或 configuration 主证据。",
      supportingFacts.length > 0
        ? `支撑规则: ${supportingFacts.map((fact) => `${fact.title}（${fact.sourceKind}）`).join("；")}。`
        : "支撑规则: 当前没有测试、注释或文档支撑证据。",
      triggerFacts.length > 0
        ? `明确触发条件: ${triggerFacts.map((fact) => `${fact.title}: ${fact.summary}`).join("；")}。`
        : "明确触发条件: 未从源码分支、常量或配置中识别到可直接复核的触发条件。",
      "",
      "## 输入、输出与兜底",
      "",
      `- 输入: 由 ${capability.relatedNodeIds.length} 个相关节点和 ${facts.length} 条事实提供上下文，主要证据位置包括 ${facts.flatMap((fact) => fact.evidence).slice(0, 4).map(evidenceLocationText).join("、") || "暂无源码位置"}。`,
      `- 输出: 命中后影响 ${capability.title} 对应的业务判断、导流、配置解释或测试样例说明。`,
      capability.evidenceRole === "example-only"
        ? "- 兜底: 该能力只有 example-only 示例证据，必须回到生产代码或配置中补证后才能判断线上行为。"
        : "- 兜底: 若线上配置、实验状态或真实流量与本地证据不一致，应以生产配置和运行时观测为准。",
      "",
      "## 证据分级",
      "",
      "| 证据等级 | 可信度 | 来源类型 | 事实 | 证据位置 | 业务含义 |",
      "|---|---|---|---|---|---|",
    ];

    for (const fact of facts) {
      lines.push(
        `| ${evidenceRoleLabel(fact.evidenceRole)} | ${fact.confidence} / ${confidenceLabel(fact.confidence)} | ${fact.sourceKind} | ${fact.title} | ${fact.evidence.map(evidenceLocationText).join("<br>") || "无"} | ${fact.businessMeaning || fact.summary} |`,
      );
    }
    if (facts.length === 0) lines.push("| 无 | 无 | 无 | 未找到事实 | 无 | 无 |");

    lines.push("");
    lines.push("## 事实证据");
    lines.push("");
    lines.push("| 类型 | 事实 | 来源类型 | 证据位置 | 摘录 |");
    lines.push("|---|---|---|---|---|");
    for (const fact of facts) {
      lines.push(
        `| ${fact.kind} | ${fact.title} | ${fact.sourceKind} | ${fact.evidence.map(evidenceLocationText).join("<br>") || "无"} | ${fact.evidence.map((item) => item.excerpt).filter(Boolean).join("<br>") || fact.summary} |`,
      );
    }
    if (facts.length === 0) lines.push("| 无 | 未找到事实 | 无 | 无 | 无 |");

    lines.push("");
    lines.push("## 修改风险");
    lines.push("");
    lines.push(primaryFacts.length > 0
      ? "- 修改主证据对应的生产逻辑或配置会直接改变该业务能力的命中、导流或解释结果，需要同步回归相关测试和配置核对。"
      : "- 当前缺少主证据，直接修改文档或示例不能证明线上行为变化；应先补充生产逻辑或配置证据。");
    lines.push(supportingFacts.length > 0
      ? "- 支撑证据来自测试、注释或文档，能辅助理解规则，但上线风险仍要回到生产路径核对。"
      : "- 支撑证据不足，变更前需要补充测试样例或业务文档确认。");
    for (const flag of [...new Set(facts.flatMap((fact) => fact.riskFlags))].sort()) {
      lines.push(`- 风险标记: ${flag}`);
    }

    lines.push("");
    lines.push("## 关联对象");
    lines.push("");
    for (const node of relatedNodes) {
      lines.push(`- \`${node.id}\`（${NODE_TYPE_LABELS[node.type]}）${node.name}: ${nodeSummary(node)}`);
    }
    if (relatedNodes.length === 0) lines.push("- 未关联到图谱节点。");

    lines.push("");
    lines.push("## 测试与样例");
    lines.push("");
    for (const fact of testFacts) {
      const evidence = fact.evidence[0];
      lines.push(`- ${fact.title}（${evidence ? evidenceLocationText(evidence) : "无具体位置"}）：${fact.summary}`);
    }
    for (const fact of exampleFacts) {
      const evidence = fact.evidence[0];
      lines.push(`- 示例证据: ${fact.title}（${evidence ? evidenceLocationText(evidence) : "无具体位置"}），只用于理解术语，不代表线上规则。`);
    }
    if (testFacts.length === 0 && exampleFacts.length === 0) lines.push("- 未从测试文件或示例材料中识别到直接样例。");

    lines.push("");
    lines.push("## 待确认项");
    lines.push("");
    lines.push("- 业务命名、线上配置值、实验状态和真实流量命中比例需要业务或平台侧确认。");
    lines.push("- 如果证据等级不是 primary / 生产或配置主证据，需要补充 production-logic 或 configuration 证据后再确认线上规则。");

    documents.push({
      path: businessCapabilityDocumentPath(capability.title, capability.id),
      title: capability.title,
      category: "capability",
      directNodeIds: [...capability.relatedNodeIds],
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
  plan: FeaturedPlan,
  documents: GeneratedDocument[],
  validation: CoverageValidationResult,
  retryPlan: RetryPlan,
  businessCapabilityProfile?: BusinessCapabilityProfile,
  evaluatedQuality?: MarkdownQualitySummary,
): CoverageReport {
  const coverageDocuments = documents.filter((document) =>
    document.role !== "maintenance"
    && (document.quality === "generated" || document.quality === "verified"));
  const docsByCategory = coverageDocuments.reduce((map, doc) => {
    const list = map.get(doc.category) ?? [];
    list.push(doc);
    map.set(doc.category, list);
    return map;
  }, new Map<KnowledgeDocumentCategory, GeneratedDocument[]>());
  const directNodeIdsByCategory = (category: KnowledgeDocumentCategory): Set<string> => {
    return new Set((docsByCategory.get(category) ?? []).flatMap((doc) => doc.directNodeIds));
  };
  const fileDocCovered = directNodeIdsByCategory("file");
  const fileSymbolAnchors = (docsByCategory.get("file") ?? []).flatMap((doc) => doc.symbolAnchors);
  const functionCardCovered = new Set(fileSymbolAnchors
    .filter((anchor) => profile.indexes.nodesById.get(anchor.nodeId)?.type === "function")
    .map((anchor) => anchor.nodeId));
  const classCardCovered = new Set(fileSymbolAnchors
    .filter((anchor) => profile.indexes.nodesById.get(anchor.nodeId)?.type === "class")
    .map((anchor) => anchor.nodeId));
  const representedEdges = new Set(coverageDocuments.flatMap((doc) => doc.representedEdgeIds));
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
  const capabilityDocs = docsByCategory.get("capability") ?? [];
  const plannedCapabilityDocs = plan.documents.filter((document) => document.category === "capability");
  const expectedCapabilityDocPaths = new Set(plannedCapabilityDocs.map((document) => document.path));
  const capabilityDocPaths = new Set(capabilityDocs.map((doc) => doc.path));
  const missingCapabilityDocs = [...expectedCapabilityDocPaths]
    .filter((path) => !capabilityDocPaths.has(path))
    .sort();
  const layerDocs = docsByCategory.get("module") ?? [];
  const flowAndTopicNodeIds = new Set([
    ...(docsByCategory.get("flow") ?? []).flatMap((doc) => doc.directNodeIds),
    ...(docsByCategory.get("topic") ?? []).flatMap((doc) => doc.directNodeIds),
  ]);
  const layerOverviewMissing = profile.layerProfiles
    .filter((layer) => !layerDocs.some((doc) => [...doc.directNodeIds, ...doc.contextNodeIds].some((nodeId) => layer.nodeIds.includes(nodeId))))
    .map((layer) => layer.id)
    .sort();
  const entryMissing = profile.entryCandidates
    .filter((entry) => !flowAndTopicNodeIds.has(entry.nodeId))
    .map((entry) => entry.nodeId)
    .sort();
  const generatedTopicNodeIds = directNodeIdsByCategory("topic");
  const requiredTopics = topicPlan.topics.filter((topic) => topic.tier === "required");
  const extendedTopics = topicPlan.topics.filter((topic) => topic.tier === "extended");
  const topicCoverage = {
    covered: topicPlan.topics.filter((topic) => generatedTopicNodeIds.has(topic.topicNodeId)).length,
    total: topicPlan.topics.length,
    missing: topicPlan.topics
      .filter((topic) => !generatedTopicNodeIds.has(topic.topicNodeId))
      .map((topic) => topic.topicNodeId),
  };
  const requiredTopicCoverage = {
    covered: requiredTopics.filter((topic) => generatedTopicNodeIds.has(topic.topicNodeId)).length,
    total: requiredTopics.length,
    missing: requiredTopics
      .filter((topic) => !generatedTopicNodeIds.has(topic.topicNodeId))
      .map((topic) => topic.topicNodeId),
  };
  const extendedTopicCoverage = {
    covered: extendedTopics.filter((topic) => generatedTopicNodeIds.has(topic.topicNodeId)).length,
    total: extendedTopics.length,
    missing: extendedTopics
      .filter((topic) => !generatedTopicNodeIds.has(topic.topicNodeId))
      .map((topic) => topic.topicNodeId),
  };
  const evidenceWarnings = profile.evidenceGaps.map((gap) => `${gap.kind}: ${gap.message}`);
  const chineseFailures = coverageDocuments.filter((doc) => !/[\u4e00-\u9fff]/.test(doc.content)).map((doc) => doc.path).sort();
  const placeholderFailures = coverageDocuments.filter((doc) => containsPlaceholderProse(doc.content)).map((doc) => doc.path).sort();
  const qualityValidation = evaluatedQuality ?? summarizeMarkdownQuality(documents);
  const structuralErrors = [
    ...validation.errors,
    ...placeholderFailures.map((path) => `document contains placeholder text: ${path}`),
  ];
  const warnings = [...new Set([...validation.warnings, ...evidenceWarnings, ...qualityValidation.warnings])].sort();
  const hasMissingRequiredTopics = requiredTopicCoverage.covered < requiredTopicCoverage.total;
  const status: KnowledgeBaseStatus = structuralErrors.length > 0 || hasMissingRequiredTopics
    ? "incomplete"
    : warnings.length > 0
      ? "complete-with-warnings"
      : "complete";

  return {
    totalDocuments: coverageDocuments.length,
    documentCounts: countByCategory(coverageDocuments),
    nodeCounts: profile.nodeCounts,
    edgeCounts: profile.edgeCounts,
    fileDocumentCoverage: ratio(fileDocCovered, expectedIds("file")),
    functionCardCoverage: ratio(functionCardCovered, expectedIds("function")),
    classCardCoverage: ratio(classCardCovered, expectedIds("class")),
    relationshipCoverage: RELATIONSHIP_COVERAGE_EDGE_TYPES.map((edgeType) => relationshipRatio(edgeType)),
    sourceReadCoverage,
    businessFactCoverage: {
      covered: businessCapabilityProfile?.sourceBackedFacts ?? 0,
      total: businessCapabilityProfile?.totalFacts ?? 0,
      missing: highSignalFilesWithoutFacts,
    },
    businessCapabilityCoverage: {
      covered: plannedCapabilityDocs.length - missingCapabilityDocs.length,
      total: plannedCapabilityDocs.length,
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
    topicCoverage,
    requiredTopicCoverage,
    extendedTopicCoverage,
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
    chineseValidation: { checked: coverageDocuments.length, failed: chineseFailures },
    placeholderValidation: { checked: coverageDocuments.length, failed: placeholderFailures },
    qualityValidation,
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
    "## 覆盖状态与清单",
    "",
    `- 当前状态: ${report ? STATUS_LABELS[report.status] : "生成中，覆盖报告尚未汇总"}`,
    `- [${report && report.fileDocumentCoverage.covered === report.fileDocumentCoverage.total ? "x" : " "}] 文件文档: ${report?.fileDocumentCoverage.covered ?? 0} / ${report?.fileDocumentCoverage.total ?? fileDocPlan?.tasks.length ?? 0}`,
    `- [${report && report.functionCardCoverage.covered === report.functionCardCoverage.total ? "x" : " "}] 函数卡片: ${report?.functionCardCoverage.covered ?? 0} / ${report?.functionCardCoverage.total ?? profile.nodeCounts.function}`,
    `- [${report && report.classCardCoverage.covered === report.classCardCoverage.total ? "x" : " "}] 类卡片: ${report?.classCardCoverage.covered ?? 0} / ${report?.classCardCoverage.total ?? profile.nodeCounts.class}`,
    `- [${report && report.requiredTopicCoverage.covered === report.requiredTopicCoverage.total ? "x" : " "}] 必需专题: ${report?.requiredTopicCoverage.covered ?? 0} / ${report?.requiredTopicCoverage.total ?? topicPlan?.topics.filter((topic) => topic.tier === "required").length ?? 0}`,
    `- [${report && report.sourceReadCoverage.covered === report.sourceReadCoverage.total ? "x" : " "}] 源码读取: ${report?.sourceReadCoverage.covered ?? 0} / ${report?.sourceReadCoverage.total ?? fileDocPlan?.tasks.length ?? 0}`,
    "- 详细缺口、失败批次和质量问题见 [覆盖报告](覆盖报告.md) 与 [待确认项](待确认项.md)。",
    "",
    "## 证据分级怎么读",
    "",
    "- 本地代码事实 / primary: 源码、配置或明确图谱关系直接支持，可作为定位和修改的第一入口。",
    "- 代码推断 / supporting: 由名称、摘要、调用或测试归纳，用来解释上下文，但仍要回到代码证据核对。",
    "- 外部待核验 / example-only: 线上配置、数据、指标或仅出现在示例中的信息，不能单独作为生产结论。",
    "",
    "## 配置、依赖、测试与核验入口",
    "",
    "- [配置与外部依赖](配置与外部依赖.md): 查看配置、服务、数据表、端点、schema 和资源节点。",
    `- 测试关系: 图谱记录 ${(profile.indexes.edgesByType.get("tested_by") ?? []).length} 条 tested_by 关系；未建图的测试需在源码和 CI 中继续检索。`,
    "- [调用关系索引](索引/调用关系索引.md): 核对静态调用；业务流程文档中的关系路径不代表严格运行时顺序。",
    "- [待确认项](待确认项.md): 汇总证据缺口和必须由配置、日志、trace、指标或业务 owner 核验的事项。",
    "",
    "## AI 使用指南",
    "",
    "1. 先读取项目总览、覆盖报告和待确认项，确认回答可依赖的证据范围。",
    "2. 再从 AI检索索引定位节点，回到专题或文件文档中的代码证据，不要只根据摘要作结论。",
    "3. 回答时区分本地代码事实、代码推断和外部待核验；关系路径不可改写为未被证明的执行时序。",
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

function renderProjectOverview(
  profile: ProjectProfile,
  plan: DocumentPlan,
  fileDocPlan?: FileDocPlan,
  topicPlan?: TopicPlan,
  report?: CoverageReport,
): string {
  const externalNodes = profile.graph.nodes.filter((node) => profile.externalNodeIds.has(node.id));
  const testedByCount = profile.indexes.edgesByType.get("tested_by")?.length ?? 0;
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
    "## 推荐阅读",
    "",
    "1. 先读架构地图理解分层，再读业务流程地图定位入口。",
    "2. 沿业务流程中的关系路径进入关键函数专题，最后回到文件文档和代码证据。",
    "3. 改代码前查看配置与外部依赖、测试证据、覆盖报告和待确认项。",
    "",
    "## 覆盖状态与清单",
    "",
    `- 当前状态: ${report ? STATUS_LABELS[report.status] : "生成中，覆盖报告尚未汇总"}`,
    `- [${report && report.fileDocumentCoverage.covered === report.fileDocumentCoverage.total ? "x" : " "}] 文件文档 ${report?.fileDocumentCoverage.covered ?? 0} / ${report?.fileDocumentCoverage.total ?? fileDocPlan?.tasks.length ?? 0}`,
    `- [${report && report.requiredTopicCoverage.covered === report.requiredTopicCoverage.total ? "x" : " "}] 必需专题 ${report?.requiredTopicCoverage.covered ?? 0} / ${report?.requiredTopicCoverage.total ?? topicPlan?.topics.filter((topic) => topic.tier === "required").length ?? 0}`,
    `- [${report && report.sourceReadCoverage.covered === report.sourceReadCoverage.total ? "x" : " "}] 源码读取 ${report?.sourceReadCoverage.covered ?? 0} / ${report?.sourceReadCoverage.total ?? fileDocPlan?.tasks.length ?? 0}`,
    `- 计划内文档: ${plan.documents.length}；证据缺口: ${profile.evidenceGaps.length}；详细状态见 [覆盖报告](覆盖报告.md)。`,
    "",
    "## 证据分级",
    "",
    "- 本地代码事实: 源码位置、节点、边和配置文件等可直接核对的信息。",
    "- 代码推断: 由静态结构归纳的职责、路径和影响范围，需用分支、测试或 trace 加强。",
    "- 外部待核验: 线上配置值、真实数据、流量比例、指标和业务口径，不能由本地图谱独立确认。",
    "",
    "## 配置、依赖与测试",
    "",
    `- 配置与外部依赖节点: ${externalNodes.length} 个，详见 [配置与外部依赖](配置与外部依赖.md)。`,
    `- tested_by 关系: ${testedByCount} 条；没有关系不等于没有测试，仍需在测试目录和 CI 中核验。`,
    "- 流程页面展示静态关系路径；只有源码控制流、分支条件或运行时 trace 才能证明严格执行顺序。",
    "",
    "## 核验与 AI 使用指南",
    "",
    "- 人工核验: 从待确认项逐条补配置、日志、trace、指标、调用方契约和测试结果。",
    "- AI 检索: 先用 AI检索索引定位节点，再引用专题或文件文档中的代码证据，并显式标注证据等级。",
    "- 回答约束: 未获得控制流或运行时证据时，应写“关系路径”，不得声称为严格执行顺序。",
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
  lines.push("## 阅读边界");
  lines.push("");
  lines.push("- 每个流程页面从入口候选沿静态关系向外展开，展示的是可达关系路径，不是经过运行时 trace 证明的严格执行顺序。");
  lines.push("- calls、reads_from、writes_to、configures 等边类型会保留；分叉只表示一个节点存在多个相邻关系，是否互斥、并行或有先后仍需源码和运行数据确认。");
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
      `| \`${node.id}\` | \`${node.filePath ?? node.name}\` | ${layerNameForNode(profile, node.id)} | ${nodeSummary(node)} | ${complexityLabel(node.complexity)} | ${profile.indexes.fileToFunctionIds.get(node.id)?.length ?? 0} | ${profile.indexes.fileToClassIds.get(node.id)?.length ?? 0} | ${coverageLevelLabel(plan, node.id)} |`,
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
      `| \`${node.id}\` | ${node.name} | \`${node.filePath ?? ""}\` | ${node.lineRange?.join("-") ?? ""} | ${layerNameForNode(profile, node.id)} | ${nodeSummary(node)} | ${degree?.incomingCalls ?? 0} | ${degree?.outgoingCalls ?? 0} | ${booleanLabel(entryIds.has(node.id))} | ${booleanLabel(plan.documents.some((document) => document.category === "topic" && document.directNodeIds.includes(node.id)))} |`,
    );
  }
  return lines.join("\n");
}

function renderClassIndex(profile: ProjectProfile, plan: DocumentPlan): string {
  const lines = ["# 类索引", "", "| 节点 ID | 类 | 文件 | 行号 | 所属层 | 摘要 | 覆盖状态 |", "|---|---|---|---|---|---|---|"];
  for (const node of nodesOfType(profile, "class")) {
    lines.push(
      `| \`${node.id}\` | ${node.name} | \`${node.filePath ?? ""}\` | ${node.lineRange?.join("-") ?? ""} | ${layerNameForNode(profile, node.id)} | ${nodeSummary(node)} | ${coverageLevelLabel(plan, node.id)} |`,
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
    lines.push(`- \`${node.id}\` | ${node.name} | ${NODE_TYPE_LABELS[node.type]} | ${node.filePath ?? ""} | ${tags} | 覆盖=${coverageLevelLabel(plan, node.id)}`);
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
  lines.push([...planDoc.directNodeIds, ...planDoc.contextNodeIds].map((nodeId) => nodeOf(profile, nodeId)?.name).filter(Boolean).join(", ") || "无");
  return lines.join("\n");
}

function renderFlowDoc(profile: ProjectProfile, planDoc: PlannedDocument): string {
  const coveredNodeIds = new Set(planDoc.directNodeIds);
  const flowEdgeTypes = new Set<EdgeType>([
    "calls",
    "configures",
    "reads_from",
    "writes_to",
    "depends_on",
    "transforms",
    "validates",
    "triggers",
    "routes",
  ]);
  const representedEdgeIds = new Set(planDoc.representedEdgeIds);
  const relationshipEdges = profile.graph.edges.filter((edge) =>
    representedEdgeIds.has(edgeId(edge)) && flowEdgeTypes.has(edge.type)
  );
  const entryNodeId = planDoc.reason.match(/^入口 (.+?) 具有/)?.[1]
    ?? profile.entryCandidates.find((entry) => coveredNodeIds.has(entry.nodeId))?.nodeId
    ?? planDoc.directNodeIds[0];
  const entryNode = nodeOf(profile, entryNodeId);
  const branches = [...new Set(relationshipEdges.map((edge) => edge.source))]
    .map((source) => ({ source, edges: relationshipEdges.filter((edge) => edge.source === source) }))
    .filter((item) => item.edges.length > 1);
  const lines = [
    `# ${planDoc.title}`,
    "",
    "## 流程结论",
    "",
    `代码推断: 本页从入口候选 \`${entryNodeId}\` 沿静态关系展开，覆盖 ${planDoc.directNodeIds.length} 个相关节点和 ${relationshipEdges.length} 条关系边。`,
    "本页只说明“哪些节点通过什么关系可达”，不把广度优先遍历得到的列表宣称为严格执行顺序；严格时序必须由源码控制流、分支条件或运行时 trace 证明。",
    "",
    "## 入口与边界",
    "",
    `- 入口候选: \`${entryNodeId}\`${entryNode ? `（${NODE_TYPE_LABELS[entryNode.type]}）${entryNode.name}` : ""}`,
    `- 入口证据: ${entryNode ? `${lineRef(entryNode, entryNode.filePath ?? "未记录文件")}；${nodeSummary(entryNode)}` : "图谱未保留入口节点详情，需回到业务流程地图核对。"}`,
    `- 展开边类型: ${[...new Set(relationshipEdges.map((edge) => edgeTypeLabel(edge.type)))].join("、") || "当前没有可展示的行为、数据或依赖关系边"}`,
    "- 边界说明: 配置取值、动态调用、异步调度、异常跳转和真实流量条件可能未进入静态图谱。",
    "",
    "## 关系路径（非严格执行顺序）",
    "",
  ];
  if (relationshipEdges.length === 0) {
    lines.push("- 图谱未记录入口到下游的关系边；当前只能确认入口候选本身，不能推导处理时序。");
  } else {
    for (const edge of relationshipEdges) {
      const source = nodeOf(profile, edge.source);
      const target = nodeOf(profile, edge.target);
      lines.push(
        `- \`${edge.source}\` --[${edgeTypeLabel(edge.type)} / ${edge.type}]--> \`${edge.target}\`${edge.description ? `：${edge.description}` : ""}；证据 ${source ? lineRef(source, source.filePath ?? "未记录文件") : "未记录来源位置"} -> ${target ? lineRef(target, target.filePath ?? "未记录文件") : "未记录目标位置"}`,
      );
    }
  }
  lines.push("");
  lines.push("## 分支证据");
  lines.push("");
  if (branches.length === 0) {
    lines.push("- 当前关系子图没有一个节点连接多个下游的分叉候选；这不等于源码不存在条件分支。 ");
  } else {
    for (const branch of branches) {
      lines.push(`- 分叉候选 \`${branch.source}\` 连接 ${branch.edges.length} 个下游：${branch.edges.map((edge) => `${edge.type}->${edge.target}`).join("；")}。这些边只能证明相邻关系，是否互斥、并行、兜底或有先后需要源码分支和 trace 核验。`);
    }
  }
  lines.push("");
  lines.push("## 代码证据");
  lines.push("");
  lines.push("| 节点 | 文件 | 行号 |");
  lines.push("|---|---|---|");
  for (const nodeId of planDoc.directNodeIds) {
    const node = nodeOf(profile, nodeId);
    if (node) lines.push(`| \`${node.id}\` | \`${node.filePath ?? ""}\` | ${node.lineRange?.join("-") ?? ""} |`);
  }
  lines.push("");
  lines.push("## 待核验项");
  lines.push("");
  lines.push(`- [ ] 核对入口 \`${entryNodeId}\` 的真实触发条件、鉴权、参数前置条件和失败返回。`);
  lines.push("- [ ] 用源码控制流或运行时 trace 核对关系路径的真实先后、异步边界和分支命中条件。");
  lines.push("- [ ] 核对配置取值、读写副作用、测试覆盖和业务命名；根据代码推断，需线上配置确认。");
  lines.push("");
  lines.push("## 目标与触发");
  lines.push("");
  lines.push(`- 目标：从入口 \`${entryNodeId}\` 展示可由静态关系验证的调用、依赖和数据路径。`);
  lines.push(`- 触发：${entryNode ? `${lineRef(entryNode, entryNode.filePath ?? "未记录文件")} 定义入口候选；真实请求或任务触发仍需运行时验证。` : "入口源码位置缺失，当前不能确认真实触发。"}`);
  lines.push("");
  lines.push("## 排除条件");
  lines.push("");
  lines.push("- 静态图谱未覆盖的动态调用、反射、异步调度和配置分支不进入可发布路径；这些缺口不能被解释为业务上不存在。");
  lines.push("");
  lines.push("## 执行阶段");
  lines.push("");
  for (const [index, nodeId] of planDoc.directNodeIds.entries()) {
    lines.push(`- 阶段 ${index + 1}：\`${nodeId}\`，${nodeSummary(nodeOf(profile, nodeId))}`);
  }
  lines.push("");
  lines.push("## 规则、分支与数据变化");
  lines.push("");
  lines.push(relationshipEdges.length > 0
    ? relationshipEdges.map((edge) => `- \`${edge.source}\` 通过 ${edgeTypeLabel(edge.type)} 关联 \`${edge.target}\`；边只证明关系，不证明互斥或时序。`).join("\n")
    : "- 当前没有两条可验证行为关系，不能把本页作为完整业务流程发布。");
  lines.push("");
  lines.push("## 异常、回退与可观测性");
  lines.push("");
  lines.push("- 异常与回退必须由源码分支、错误返回或测试断言证明；静态关系图本身不补写兜底策略。");
  lines.push("- 日志、指标和 trace 不在当前静态快照中，需在运行环境补充验证后才能确认命中条件和阶段时延。");
  lines.push("");
  lines.push("## 源码证据");
  lines.push("");
  for (const nodeId of planDoc.directNodeIds) {
    const node = nodeOf(profile, nodeId);
    lines.push(`- \`${nodeId}\`：${node ? lineRef(node, node.filePath ?? "未记录文件") : "未记录源码位置"}，支持该阶段的静态关系结论。`);
  }
  return lines.join("\n");
}

function renderTopicDoc(profile: ProjectProfile, planDoc: PlannedDocument): string {
  const nodeId = planDoc.directNodeIds[0];
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
  lines.push(`- 必需专题覆盖: ${report.requiredTopicCoverage.covered} / ${report.requiredTopicCoverage.total}`);
  lines.push(`- 扩展专题覆盖: ${report.extendedTopicCoverage.covered} / ${report.extendedTopicCoverage.total}`);
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
    lines.push("- 读取结论: 所有计划内源码任务均有快照，可用于后续文件文档和证据核对。");
  } else {
    lines.push(`- 读取结论: ${report.sourceReadCoverage.missing.length} 个源码任务缺失快照，相关文档只能依赖图谱结构。`);
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
  if (report.errors.length === 0 && report.warnings.length === 0) {
    lines.push("- 校验结论: 结构校验没有发现错误或警告，覆盖状态可按当前指标继续复核。");
  }
  lines.push("");
  lines.push("## 质量校验");
  lines.push("");
  lines.push(`- 已检查文档: ${report.qualityValidation.checked}`);
  lines.push(`- 质量失败文档: ${report.qualityValidation.failed.length}`);
  for (const path of report.qualityValidation.failed) {
    lines.push(`  - ${path}`);
  }
  return lines.join("\n");
}

export interface MaterializeKnowledgeBaseDocumentsInput {
  profile: ProjectProfile;
  plan: FeaturedPlan;
  fileDocPlan: FileDocPlan;
  businessCapabilityProfile: BusinessCapabilityProfile;
  topicPlan: TopicPlan;
  merged: MergeKnowledgeBaseWriterOutputsResult;
}

export interface MaterializeKnowledgeBaseDocumentsResult {
  documents: GeneratedDocument[];
  errors: string[];
}

function evidenceForNode(
  profile: ProjectProfile,
  fileDocPlan: FileDocPlan,
  nodeId: string,
): SourceEvidence | undefined {
  const node = nodeOf(profile, nodeId);
  if (!node?.filePath) return undefined;
  const normalizedPath = normalizeKnowledgeSourcePath(node.filePath);
  const task = fileDocPlan.tasks.find((candidate) => candidate.filePath === normalizedPath);
  if (!task?.sourceSnapshot.exists || !task.sourceSnapshot.text.trim()) return undefined;
  const lineRange = sourceRangeForNode(task, node);
  const excerpt = excerptForLineRange(task.sourceSnapshot, lineRange);
  if (!excerpt.trim()) return undefined;
  const typeLabel = NODE_TYPE_LABELS[node.type];
  const subject = node.type === "file"
    ? `文件“${normalizedPath}”`
    : `${typeLabel}“${node.name}”`;
  return {
    filePath: normalizedPath,
    lineRange,
    nodeId,
    excerpt,
    claim: `源码快照在“${normalizedPath}:${lineRange.join("-")}”记录了${subject}的实际内容，该摘录给出该节点的源码位置和静态内容。`,
  };
}

function supportEvidence(
  profile: ProjectProfile,
  fileDocPlan: FileDocPlan,
  planned: PlannedDocument,
  minimum = 0,
): SourceEvidence[] {
  const representedEdgeIds = new Set(planned.representedEdgeIds);
  const representedNodeIds = profile.graph.edges
    .filter((edge) => representedEdgeIds.has(edgeId(edge)))
    .flatMap((edge) => [edge.source, edge.target]);
  const candidates = [...planned.directNodeIds, ...planned.contextNodeIds, ...representedNodeIds];
  const evidence: SourceEvidence[] = [];
  const seen = new Set<string>();
  const evidenceGroups = new Set<string>();
  const requiredDirectNodeIds = new Set(planned.directNodeIds);
  const coveredDirectNodeIds = new Set<string>();
  for (const nodeId of candidates) {
    const item = evidenceForNode(profile, fileDocPlan, nodeId);
    if (!item) continue;
    const key = `${item.filePath}:${item.lineRange?.join("-") ?? "file"}:${item.nodeId ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    evidence.push(item);
    evidenceGroups.add(`${item.filePath}:${item.lineRange?.join("-") ?? "file"}`);
    if (requiredDirectNodeIds.has(nodeId)) coveredDirectNodeIds.add(nodeId);
    if (
      minimum > 0
      && evidenceGroups.size >= minimum
      && [...requiredDirectNodeIds].every((directNodeId) => coveredDirectNodeIds.has(directNodeId))
    ) break;
  }
  return evidence;
}

function sourceEvidenceMarkdown(evidence: SourceEvidence[]): string {
  if (evidence.length === 0) return "- 证据不足：当前源码快照没有可引用的精确位置。";
  return evidence.map((item) =>
    `- ${item.claim ?? "该源码位置记录可核对的静态内容"} 证据：\`${item.filePath}\`${item.lineRange ? `:${item.lineRange.join("-")}` : ""}${item.excerpt ? `；摘录：\`${item.excerpt}\`` : ""}`,
  ).join("\n");
}

function generatedFromPlan(
  planned: PlannedDocument,
  content: string,
  sourceEvidence: SourceEvidence[],
  profile: ProjectProfile,
): GeneratedDocument {
  const nodeTerms = [...planned.directNodeIds, ...planned.contextNodeIds]
    .flatMap((nodeId) => {
      const node = nodeOf(profile, nodeId);
      return [nodeId, node?.name, node?.filePath, ...(node?.tags ?? [])];
    })
    .filter((term): term is string => Boolean(term));
  return {
    ...planned,
    content,
    sourceEvidence,
    searchTerms: [...new Set([planned.title, planned.summary, planned.path, ...nodeTerms])],
    quality: "generated",
    generationStatus: "complete",
    qualityIssues: [],
  };
}

function renderFeaturedProjectOverview(
  profile: ProjectProfile,
  plan: FeaturedPlan,
  fileDocPlan: FileDocPlan,
  planned: PlannedDocument,
): GeneratedDocument {
  const flowPages = plan.documents.filter((document) => document.role === "featured" && document.category === "flow");
  const modulePages = plan.documents.filter((document) => document.role === "featured" && document.category === "module");
  const configurationNodes = profile.graph.nodes.filter((node) => node.type === "config" || node.type === "schema");
  const testTasks = fileDocPlan.tasks.filter((task) => task.referenceKind === "test");
  const evidence = supportEvidence(profile, fileDocPlan, planned, 6);
  const routePages = plan.documents.filter((document) => document.role === "featured" && document.route)
    .sort((left, right) => (left.route?.order ?? 0) - (right.route?.order ?? 0));
  const content = [
    "# 项目总览",
    "",
    "## 项目目的与边界",
    "",
    `- 项目：${profile.graph.project.name}。${projectDescription(profile)}`,
    `- 技术边界：${profile.graph.project.languages.join("、") || "证据不足：未记录语言"}；框架：${profile.graph.project.frameworks.join("、") || "证据不足：未记录框架"}。`,
    "- 运行时边界：静态图谱只能证明源码结构和可达关系，不能独立证明线上流量、配置值、异步时序或业务口径。",
    "",
    "## 生命周期与可发布流程",
    "",
    flowPages.length > 0
      ? flowPages.map((flow) => `- [${flow.title}](${flow.path})：${flow.summary}`).join("\n")
      : "- 证据不足：没有入口达到三个阶段和两条行为边，当前不发布业务流程。",
    "",
    "## 模块与职责入口",
    "",
    modulePages.length > 0
      ? modulePages.map((module) => `- [${module.title}](${module.path})：${module.summary}`).join("\n")
      : "- 证据不足：图谱没有可发布模块层。",
    "",
    "## 配置、结构与测试边界",
    "",
    `- 配置或结构定义节点：${configurationNodes.length} 个；文件引用任务：${fileDocPlan.tasks.length} 个。`,
    `- 测试引用任务：${testTasks.length} 个；没有测试任务不等于没有运行时验证，需要继续核对 CI 与集成环境。`,
    "",
    "## 推荐阅读",
    "",
    routePages.map((page) => `${(page.route?.order ?? 0) + 1}. [${page.title}](${page.path})（${page.route?.stage}）`).join("\n")
      || "1. 证据不足：主阅读路径为空。",
    "",
    "## 代码证据",
    "",
    sourceEvidenceMarkdown(evidence),
    "",
    "## 项目目标与边界",
    "",
    `本项目“${profile.graph.project.name}”的静态知识库用于解释源码结构、可达关系和改动入口；线上配置、数据内容与实际流量不在静态证明范围内。`,
    "",
    "## 完整生命周期",
    "",
    flowPages.length > 0
      ? flowPages.map((flow) => `- [${flow.title}](${flow.path})：从触发、阶段、分支到异常边界逐页核对。`).join("\n")
      : "- 当前没有满足三阶段和两条行为边的流程，生命周期保持为证据缺口。",
    "",
    "## 核心模块",
    "",
    modulePages.length > 0
      ? modulePages.map((module) => `- [${module.title}](${module.path})：${module.summary}`).join("\n")
      : "- 当前图谱没有可发布模块，需先补充分层与源码关系证据。",
    "",
    "## 配置、依赖与测试",
    "",
    `配置或结构节点 ${configurationNodes.length} 个，测试引用任务 ${testTasks.length} 个；依赖可用性、默认值和回归结果仍需外部验证。`,
    "",
    "## 推荐阅读路线",
    "",
    routePages.map((page) => `${(page.route?.order ?? 0) + 1}. [${page.title}](${page.path})（${page.route?.stage}）`).join("\n")
      || "1. 当前主阅读路径为空，先从源码入口和引用覆盖页补证据。",
    "",
    "## 源码证据",
    "",
    sourceEvidenceMarkdown(evidence),
  ].join("\n");
  return generatedFromPlan(planned, content, evidence, profile);
}

export function renderBusinessCapabilityDocuments(
  profile: ProjectProfile,
  fileDocPlan: FileDocPlan,
  businessProfile: BusinessCapabilityProfile,
  planned: PlannedDocument,
): GeneratedDocument {
  const capabilityId = planned.reason.match(/；能力 (.+)$/)?.[1];
  const capability = businessProfile.capabilities.find((candidate) => candidate.id === capabilityId)
    ?? businessProfile.capabilities.find((candidate) => candidate.title === planned.title);
  if (!capability) {
    const evidence = supportEvidence(profile, fileDocPlan, planned, 3);
    const content = [
      `# ${planned.title}`,
      "",
      "## 业务场景与触发",
      "证据不足：找不到与计划页面匹配的业务能力，当前不能确认真实业务触发条件。",
      "## 规则与分支",
      "证据不足：没有可核对的生产规则或配置分支。",
      "## 输入输出与状态变化",
      "证据不足：输入、输出和状态变化需要从直接节点源码补充。",
      "## 异常与降级",
      "证据不足：当前不推测异常返回和降级策略。",
      "## 模块实现",
      planned.summary,
      "## 源码证据",
      sourceEvidenceMarkdown(evidence),
    ].join("\n\n");
    return generatedFromPlan(planned, content, evidence, profile);
  }
  const factsById = new Map(businessProfile.facts.map((fact) => [fact.id, fact]));
  const facts = capability.factIds.map((factId) => factsById.get(factId)).filter((fact): fact is BusinessFact => Boolean(fact));
  const primary = facts.filter((fact) => fact.evidenceRole === "primary");
  const supporting = facts.filter((fact) => fact.evidenceRole === "supporting");
  const examples = facts.filter((fact) => fact.evidenceRole === "example-only");
  const triggers = [...primary, ...supporting].filter((fact) => ["branch", "constant", "config"].includes(fact.kind));
  const evidence = [
    ...facts.flatMap((fact) => fact.evidence.map((item) => ({
    ...item,
    claim: `事实“${fact.title}”支持能力“${capability.title}”中的${fact.businessMeaning || fact.summary}`,
    }))),
    ...supportEvidence(profile, fileDocPlan, planned, 3),
  ];
  const factsTable = (items: BusinessFact[], empty: string): string => items.length > 0
    ? items.map((fact) => `- ${fact.title}（${fact.kind} / ${fact.sourceKind}）：${fact.summary}`).join("\n")
    : `- 证据不足：${empty}`;
  const content = [
    `# ${planned.title}`,
    "",
    "## 非技术同学速读",
    "",
    `本页只使用 primary 与 supporting 事实解释“${capability.title}”；example-only 内容单列为语义上下文，不能当作生产规则。`,
    "",
    "## 业务结论",
    "",
    planned.summary,
    "",
    "## 关键规则与触发条件",
    "",
    factsTable(triggers, "没有从分支、常量或配置中提取到明确触发条件、字段或规则。"),
    "",
    "## 主证据事实",
    "",
    factsTable(primary, "没有 production-logic 或 configuration 主证据。"),
    "",
    "## 支撑证据事实",
    "",
    factsTable(supporting, "没有测试、注释或文档支撑事实。"),
    "",
    "## 示例上下文（不代表线上规则）",
    "",
    factsTable(examples, "没有 example-only 事实。"),
    "",
    "## 事实证据",
    "",
    sourceEvidenceMarkdown(evidence),
    "",
    "## 修改风险与待核验",
    "",
    "- 修改前核对触发字段、分支条件、配置默认值与回归测试；静态事实不能替代线上配置和运行时数据。",
    "",
    "## 业务场景与触发",
    "",
    factsTable(triggers, "当前没有源码或配置证据证明业务触发条件。"),
    "",
    "## 规则与分支",
    "",
    factsTable([...primary, ...supporting], "当前没有可发布规则、条件或分支证据。"),
    "",
    "## 输入输出与状态变化",
    "",
    `能力“${capability.title}”关联 ${planned.directNodeIds.length} 个直接节点；输入输出和状态变化只按这些节点的源码与关系证据陈述。`,
    "",
    "## 异常与降级",
    "",
    "异常返回、跳过条件和降级行为必须由源码分支或测试断言支持；缺少证据时保留为待核验项。",
    "",
    "## 模块实现",
    "",
    planned.directNodeIds.map((nodeId) => `- \`${nodeId}\`：${nodeSummary(nodeOf(profile, nodeId))}`).join("\n") || "- 当前没有直接实现节点。",
    "",
    "## 源码证据",
    "",
    sourceEvidenceMarkdown(evidence),
  ].join("\n");
  return generatedFromPlan(planned, content, evidence, profile);
}

function renderPlannedModule(
  profile: ProjectProfile,
  fileDocPlan: FileDocPlan,
  planned: PlannedDocument,
): GeneratedDocument {
  const layerId = planned.reason.match(/^按层 (.+?) 生成/)?.[1];
  const layer = profile.layerProfiles.find((candidate) => candidate.id === layerId);
  const coreFiles = planned.contextNodeIds
    .map((nodeId) => nodeOf(profile, nodeId))
    .filter((node): node is GraphNode => node?.type === "file")
    .sort((left, right) => (profile.nodeDegrees.get(right.id)?.total ?? 0) - (profile.nodeDegrees.get(left.id)?.total ?? 0) || left.id.localeCompare(right.id))
    .slice(0, 15);
  const represented = new Set(planned.representedEdgeIds);
  const edges = profile.graph.edges.filter((edge) => represented.has(edgeId(edge)));
  const configTasks = fileDocPlan.tasks.filter((task) => task.layerId === layerId && ["configuration", "schema"].includes(task.referenceKind));
  const testTasks = fileDocPlan.tasks.filter((task) => task.layerId === layerId && task.referenceKind === "test");
  const evidence = supportEvidence(profile, fileDocPlan, planned, 5);
  const content = [
    `# ${planned.title}`,
    "",
    "## 责任与非责任",
    "",
    `- 责任：${layer ? layerDescription(layer.description, layer.name) : planned.summary}`,
    "- 非责任：静态分层不证明部署边界、事务边界、调用时序或业务归属；这些结论需要运行环境证据。",
    "",
    "## 入口与输出关系",
    "",
    edges.length > 0 ? edges.map((edge) => `- ${edge.source} --[${edgeTypeLabel(edge.type)}]--> ${edge.target}`).join("\n") : "- 证据不足：没有跨文件关系边。",
    "",
    "## 核心文件（按关系度，最多十五个）",
    "",
    coreFiles.length > 0 ? coreFiles.map((file) => `- \`${file.id}\` ${file.name}：${nodeSummary(file)}`).join("\n") : "- 证据不足：该层没有文件节点。",
    "",
    "## 依赖层与边界",
    "",
    `- 入站依赖层：${layer?.inboundLayerIds.join("、") || "无显式入站层"}；出站依赖层：${layer?.outboundLayerIds.join("、") || "无显式出站层"}。`,
    `- 配置或结构定义引用：${configTasks.length} 个；测试引用：${testTasks.length} 个。`,
    "",
    "## 代码证据",
    "",
    sourceEvidenceMarkdown(evidence),
    "",
    "## 职责与非职责",
    "",
    `- 职责：${layer ? layerDescription(layer.description, layer.name) : planned.summary}`,
    "- 非职责：静态分层不证明部署、事务、运行时顺序或团队归属，相关结论必须由外部证据确认。",
    "",
    "## 入口、输出与核心文件",
    "",
    edges.length > 0 ? edges.map((edge) => `- ${edge.source} --[${edgeTypeLabel(edge.type)}]--> ${edge.target}`).join("\n") : "- 当前没有可核对的入口或输出关系。",
    coreFiles.length > 0 ? coreFiles.map((file) => `- 核心文件 \`${file.id}\`：${nodeSummary(file)}`).join("\n") : "- 当前没有核心文件证据。",
    "",
    "## 依赖与主要流程",
    "",
    `- 入站依赖层：${layer?.inboundLayerIds.join("、") || "无显式入站层"}；出站依赖层：${layer?.outboundLayerIds.join("、") || "无显式出站层"}。`,
    "- 主要流程只引用已发布流程页和图谱关系，不把静态相邻节点补写为严格时序。",
    "",
    "## 状态、配置与测试边界",
    "",
    `- 配置或结构引用 ${configTasks.length} 个，测试引用 ${testTasks.length} 个；未建图的状态变化、默认值与测试结果保留为证据缺口。`,
    "",
    "## 风险与排查入口",
    "",
    "- 修改核心文件前核对入站调用、出站依赖、配置默认值、错误路径和回归测试；运行时问题需结合日志、指标或 trace 排查。",
    "",
    "## 源码证据",
    "",
    sourceEvidenceMarkdown(evidence),
  ].join("\n");
  return generatedFromPlan(planned, content, evidence, profile);
}

function renderSourceEntry(
  profile: ProjectProfile,
  plan: FeaturedPlan,
  fileDocPlan: FileDocPlan,
  planned: PlannedDocument,
): GeneratedDocument {
  const evidence = supportEvidence(profile, fileDocPlan, planned, 6);
  const entryNodes = planned.contextNodeIds.map((nodeId) => nodeOf(profile, nodeId)).filter((node): node is GraphNode => Boolean(node));
  const configTasks = fileDocPlan.tasks.filter((task) => task.referenceKind === "configuration");
  const testTasks = fileDocPlan.tasks.filter((task) => task.referenceKind === "test");
  const nextPages = plan.documents.filter((document) => document.role === "featured" && document.id !== planned.id).slice(0, 8);
  const content = [
    "# 源码入口",
    "",
    "## 入口文件与函数",
    "",
    planned.directNodeIds.map((nodeId) => `- 文件：\`${nodeId}\` ${nodeSummary(nodeOf(profile, nodeId))}`).join("\n") || "- 证据不足：没有可发布入口文件。",
    entryNodes.map((node) => `- 入口节点：\`${node.id}\` ${node.name}，位置 ${lineRef(node, node.filePath ?? "未记录文件")}`).join("\n"),
    "",
    "## 启动或请求路径",
    "",
    plan.documents.filter((document) => document.category === "flow" && document.role === "featured")
      .map((flow) => `- [${flow.title}](${flow.path})：${flow.summary}`).join("\n") || "- 证据不足：没有满足发布阈值的静态路径。",
    "",
    "## 配置与测试入口",
    "",
    `- 配置引用：${configTasks.map((task) => `\`${task.filePath}\``).join("、") || "证据不足：没有配置引用任务"}。`,
    `- 测试引用：${testTasks.map((task) => `\`${task.filePath}\``).join("、") || "证据不足：没有测试引用任务"}。`,
    "",
    "## 推荐下一页",
    "",
    nextPages.map((page) => `- [${page.title}](${page.path})`).join("\n") || "- 证据不足：没有其他 featured 页面。",
    "",
    "## 代码证据",
    "",
    sourceEvidenceMarkdown(evidence),
    "",
    "## 项目目标与边界",
    "",
    "本页限定为源码导航入口，只证明入口文件、入口节点和静态可达关系；不把静态关系解释为线上请求量或严格执行时序。",
    "",
    "## 完整生命周期",
    "",
    plan.documents.filter((document) => document.category === "flow" && document.role === "featured")
      .map((flow) => `- [${flow.title}](${flow.path})：继续核对触发、阶段、分支与异常边界。`).join("\n")
      || "- 当前没有满足发布阈值的完整流程，需从入口源码补充阶段与关系证据。",
    "",
    "## 核心模块",
    "",
    plan.documents.filter((document) => document.category === "module" && document.role === "featured")
      .map((module) => `- [${module.title}](${module.path})：${module.summary}`).join("\n")
      || "- 当前没有可发布模块入口。",
    "",
    "## 配置、依赖与测试",
    "",
    `配置引用 ${configTasks.length} 个，测试引用 ${testTasks.length} 个；依赖可用性和测试结果需要在实际环境验证。`,
    "",
    "## 推荐阅读路线",
    "",
    nextPages.map((page, index) => `${index + 1}. [${page.title}](${page.path})`).join("\n")
      || "1. 当前没有后续页面，先补齐入口与模块证据。",
    "",
    "## 源码证据",
    "",
    sourceEvidenceMarkdown(evidence),
  ].join("\n");
  return generatedFromPlan(planned, content, evidence, profile);
}

export function materializeKnowledgeBaseDocuments(
  input: MaterializeKnowledgeBaseDocumentsInput,
): MaterializeKnowledgeBaseDocumentsResult {
  const { profile, plan, fileDocPlan, businessCapabilityProfile, topicPlan, merged } = input;
  const documents: GeneratedDocument[] = [];
  const errors: string[] = [];
  const fileWriterByOwner = new Map(merged.acceptedFileWriterDocuments.map((document) => [document.fileNodeId, document]));
  const maintenanceFileWriterByOwner = new Map(
    (merged.maintenanceFileWriterDocuments ?? []).map((document) => [document.fileNodeId, document]),
  );
  const topicWriterByNode = new Map(merged.acceptedTopicWriterDocuments.map((document) => [document.topicNodeId, document]));

  for (const planned of plan.documents) {
    if (planned.role === "maintenance") continue;

    if (planned.category === "file") {
      const task = fileDocPlan.tasks.find((candidate) => candidate.documentPath === planned.path);
      const writer = task ? fileWriterByOwner.get(task.fileNodeId) : undefined;
      const maintenanceWriter = task ? maintenanceFileWriterByOwner.get(task.fileNodeId) : undefined;
      if (!task || (!writer && !maintenanceWriter)) {
        errors.push(`计划文件缺少已接受写作者输出：${planned.path}`);
        continue;
      }
      if (writer) {
        documents.push(generatedFromPlan(planned, writer.markdown, writer.sourceEvidence, profile));
      } else if (maintenanceWriter) {
        const generated = generatedFromPlan(
          planned,
          maintenanceWriter.markdown,
          maintenanceWriter.sourceEvidence,
          profile,
        );
        const { route: _route, ...withoutRoute } = generated;
        documents.push({
          ...withoutRoute,
          role: "maintenance",
          quality: "failed",
          generationStatus: "partial",
          qualityIssues: ["源码快照缺失，无法生成可发布的精确证据"],
        });
      }
      continue;
    }

    if (planned.category === "topic") {
      const topic = topicPlan.topics.find((candidate) => candidate.documentPath === planned.path);
      const writer = topic ? topicWriterByNode.get(topic.topicNodeId) : undefined;
      if (!topic || !writer) {
        errors.push(`计划专题缺少已接受写作者输出：${planned.path}`);
        continue;
      }
      documents.push(generatedFromPlan(planned, writer.markdown, writer.evidence, profile));
      continue;
    }

    if (planned.path === KB_PATHS.projectOverview) {
      documents.push(renderFeaturedProjectOverview(profile, plan, fileDocPlan, planned));
    } else if (planned.path === KB_PATHS.sourceEntry) {
      documents.push(renderSourceEntry(profile, plan, fileDocPlan, planned));
    } else if (planned.category === "capability") {
      documents.push(renderBusinessCapabilityDocuments(profile, fileDocPlan, businessCapabilityProfile, planned));
    } else if (planned.category === "flow") {
      const evidence = supportEvidence(profile, fileDocPlan, planned, 5);
      documents.push(generatedFromPlan(planned, renderFlowDoc(profile, planned), evidence, profile));
    } else if (planned.category === "module") {
      documents.push(renderPlannedModule(profile, fileDocPlan, planned));
    } else {
      errors.push(`计划页面没有专用渲染器：${planned.path}`);
    }
  }

  const evaluated = evaluatePublicationCorpus(documents.map((document) => ({
    document: {
      path: document.path,
      title: document.title,
      category: document.category,
      role: document.role,
      content: document.content,
      directNodeIds: [...document.directNodeIds],
      representedEdgeIds: [...document.representedEdgeIds],
      symbolAnchors: [...document.symbolAnchors],
      ...(document.referenceKind ? { referenceKind: document.referenceKind } : {}),
    },
    evidence: document.sourceEvidence as PublicationEvidence[],
  })));
  const evaluatedDocuments = evaluated.map((result, index) => {
    const document = documents[index];
    const verification = document.verification;
    const explicitlyVerified = result.decision.quality === "generated"
      && (verification?.method === "human" || verification?.method === "external")
      && Boolean(verification.verifiedAt?.trim());
    if (result.decision.quality === "generated") {
      return {
        ...document,
        quality: explicitlyVerified ? "verified" as const : "generated" as const,
        qualityIssues: [],
      };
    }
    const { route: _route, ...withoutRoute } = document;
    return {
      ...withoutRoute,
      role: "maintenance" as const,
      quality: result.decision.quality,
      generationStatus: document.generationStatus === "partial"
        ? "partial" as const
        : result.decision.quality === "failed"
          ? "failed" as const
          : "partial" as const,
      qualityIssues: [...new Set([...document.qualityIssues, ...result.decision.issues])],
    };
  });

  return { documents: evaluatedDocuments, errors };
}

export function renderKnowledgeBaseStatusDocuments(
  profile: ProjectProfile,
  plan: FeaturedPlan,
  report: CoverageReport,
  validation: CoverageValidationResult,
  retryPlan: RetryPlan,
): GeneratedDocument[] {
  return plan.documents.filter((planned) => planned.role === "maintenance").map((planned) => {
    const content = planned.path === KB_PATHS.qualityStatus
      ? [
          "# 质量状态",
          "",
          "## 发布状态",
          "",
          `- 状态：${STATUS_LABELS[report.status]}。`,
          `- 结构错误：${report.errors.length} 个；质量失败：${report.qualityValidation.failed.length} 个；警告：${report.warnings.length} 个。`,
          "",
          "## 失败与缺失",
          "",
          [...report.errors, ...validation.errors].map((message) => `- ${diagnosticText(message)}`).join("\n") || "- 没有结构失败。",
          report.qualityValidation.failed.map((path) => `- 质量失败：${path}`).join("\n") || "- 没有质量失败页面。",
          "",
          "## 重试与恢复步骤",
          "",
          `- 文件批次重试：${retryPlan.fileBatchIndexes.join("、") || "无"}；专题批次重试：${retryPlan.topicBatchIndexes.join("、") || "无"}。`,
          "- 恢复步骤：补齐缺失源码或 writer 输出，重新运行生成，再核对质量失败页面和引用覆盖。",
        ].join("\n")
      : [
          "# 引用覆盖",
          "",
          "## 文件与符号覆盖",
          "",
          `- 文件：${report.fileDocumentCoverage.covered} / ${report.fileDocumentCoverage.total}；缺失 ${report.fileDocumentCoverage.missing.join("、") || "无"}。`,
          `- 函数锚点：${report.functionCardCoverage.covered} / ${report.functionCardCoverage.total}；缺失 ${report.functionCardCoverage.missing.join("、") || "无"}。`,
          `- 类型锚点：${report.classCardCoverage.covered} / ${report.classCardCoverage.total}；缺失 ${report.classCardCoverage.missing.join("、") || "无"}。`,
          "",
          "## 关系与专题覆盖",
          "",
          report.relationshipCoverage.map((item) => `- ${edgeTypeLabel(item.edgeType)}：${item.covered} / ${item.total}；缺失 ${item.missingEdgeIds.join("、") || "无"}。`).join("\n"),
          `- 必需专题：${report.requiredTopicCoverage.covered} / ${report.requiredTopicCoverage.total}。`,
          "",
          "## 业务证据覆盖",
          "",
          `- 业务事实：${report.businessFactCoverage.covered} / ${report.businessFactCoverage.total}；缺失 ${report.businessFactCoverage.missing.join("、") || "无"}。`,
          `- 业务能力：${report.businessCapabilityCoverage.covered} / ${report.businessCapabilityCoverage.total}；缺失 ${report.businessCapabilityCoverage.missing.join("、") || "无"}。`,
          "",
          "## 恢复步骤",
          "",
          "- 为缺失文件补源码快照，为函数和类型补文件内锚点，为缺失关系补可核对的 representedEdgeIds 后重新生成。",
        ].join("\n");
    return generatedFromPlan(planned, content, [], profile);
  });
}
