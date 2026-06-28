import type { EdgeType, GraphNode, NodeType } from "../types.js";
import type {
  CoverageReport,
  CoverageRatio,
  CoverageValidationResult,
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
  return node ? `${node.name} (${node.type})` : nodeId;
}

function edgeId(edge: { type: string; source: string; target: string }): string {
  return `${edge.type}:${edge.source}->${edge.target}`;
}

function nodeLabel(profile: ProjectProfile, nodeId: string): string {
  const node = nodeOf(profile, nodeId);
  return node ? `${node.name} (${node.type})` : nodeId;
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
    `- 职责: ${node?.summary || "本地代码事实: 图谱没有提供摘要。"}`,
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
    `- 职责: ${node?.summary || "本地代码事实: 图谱没有提供摘要。"}`,
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
      nodeOf(profile, task.fileNodeId)?.summary || "本地代码事实: 图谱中存在该文件，但没有摘要。",
      "",
      "## 所属位置",
      `- Layer: ${task.layerId ?? "未分层"}`,
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
        : "- 源文件缺失，当前文档只能基于图谱生成，最终状态必须为 incomplete。",
      "",
      "## AI 检索词",
      [task.filePath, task.fileNodeId, ...task.functionNodeIds, ...task.classNodeIds].join(", "),
    ].join("\n"),
  };
}

function edgesForNode(profile: ProjectProfile, nodeId: string): { incoming: string[]; outgoing: string[] } {
  const incoming = (profile.indexes.incomingEdgesByNode.get(nodeId) ?? [])
    .map((edge) => `${edgeName(profile, edge.source)} --[${edge.type}]--> ${edgeName(profile, edge.target)}`)
    .sort();
  const outgoing = (profile.indexes.outgoingEdgesByNode.get(nodeId) ?? [])
    .map((edge) => `${edgeName(profile, edge.source)} --[${edge.type}]--> ${edgeName(profile, edge.target)}`)
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
      topic.reasons.length > 0 ? `入选原因: ${topic.reasons.join("；")}。` : "入选原因来自图谱结构和文件文档重要节点标记。",
    ].join("\n"),
    "## 在业务流程中的位置": [
      `- 所属文件: \`${sourceFile?.filePath ?? node?.filePath ?? topic.sourceFileNodeId}\``,
      `- 链接文件文档: \`${topic.linkedFileDocumentPath}\``,
      `- 节点类型: ${node?.type ?? "unknown"}`,
      `- 图谱摘要: ${node?.summary || "本地代码事实: 图谱没有提供摘要。"}`,
    ].join("\n"),
    "## 主要输入、输出、副作用": [
      `- 输入/上游: ${incoming.join("；") || "未在图谱中识别"}`,
      `- 输出/下游: ${outgoing.join("；") || "未在图谱中识别"}`,
      "- 副作用: 根据调用、配置、读写关系推断；根据代码推断，需线上配置确认",
    ].join("\n"),
    "## 关键分支和算法": [
      node?.summary || "本地代码事实: 图谱未提供算法摘要。",
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
      "| Node | File | Lines |",
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

export function buildCoverageReport(
  profile: ProjectProfile,
  fileDocPlan: FileDocPlan,
  topicPlan: TopicPlan,
  documents: GeneratedDocument[],
  validation: CoverageValidationResult,
  retryPlan: RetryPlan,
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
    `**图谱提交**: ${profile.graph.project.gitCommitHash || "unknown"}`,
    "",
    "## 推荐阅读路径",
    "",
    "- 工程师接手代码: 项目总览 -> 架构地图 -> 业务流程地图 -> 关键函数专题 -> 函数索引",
    "- 产品/运营理解业务: 业务流程地图 -> 业务流程 -> 待确认项",
    "- AI agent 后续检索: AI检索索引 -> 函数索引 -> 文件索引 -> 覆盖报告",
    "",
    "## 文档清单",
    "",
  ];
  for (const doc of plan.documents) {
    lines.push(`- [${doc.title}](${doc.path}) — ${doc.category}; ${doc.reason}`);
  }
  for (const task of fileDocPlan?.tasks ?? []) {
    lines.push(`- [${task.filePath} 文件知识文档](${task.documentPath}) — file; exhaustive file/function/class coverage`);
  }
  for (const topic of topicPlan?.topics ?? []) {
    lines.push(`- [${topic.title}](${topic.documentPath}) — topic; ${topic.reasons.join("; ")}`);
  }
  return lines.join("\n");
}

function renderProjectOverview(profile: ProjectProfile): string {
  return [
    "# 项目总览",
    "",
    `**一句话结论**: ${profile.graph.project.description || `${profile.graph.project.name} 的代码结构知识库。`}`,
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
  const lines = ["# 架构地图", "", "## Layer 列表", ""];
  for (const layer of profile.layerProfiles) {
    lines.push(`### ${layer.name}`);
    lines.push("");
    lines.push(layer.description || "本地代码事实: 图谱中存在该层，但没有额外描述。");
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
    lines.push(`- **${node?.name ?? entry.nodeId}** (${entry.entryType}) — ${entry.reason}`);
  }
  lines.push("");
  lines.push("## 外部待核验");
  lines.push("");
  lines.push("- 业务命名来自代码名称、标签和摘要；真实产品口径需要业务 owner 确认。根据代码推断，需线上配置确认");
  return lines.join("\n");
}

function renderFileIndex(profile: ProjectProfile, plan: DocumentPlan): string {
  const lines = ["# 文件索引", "", "| Node id | Path | Layer | Summary | Complexity | Functions | Classes | Coverage |", "|---|---|---|---|---|---:|---:|---|"];
  for (const node of nodesOfType(profile, "file")) {
    lines.push(
      `| \`${node.id}\` | \`${node.filePath ?? node.name}\` | ${layerNameForNode(profile, node.id)} | ${node.summary || "本地代码事实: 无摘要"} | ${node.complexity} | ${profile.indexes.fileToFunctionIds.get(node.id)?.length ?? 0} | ${profile.indexes.fileToClassIds.get(node.id)?.length ?? 0} | ${plan.nodeCoverage.get(node.id) ?? "none"} |`,
    );
  }
  return lines.join("\n");
}

function renderFunctionIndex(profile: ProjectProfile, plan: DocumentPlan): string {
  const lines = ["# 函数索引", "", "| Node id | Function | File | Lines | Layer | Summary | Calls in | Calls out | Entry | Topic covered |", "|---|---|---|---|---|---|---:|---:|---|---|"];
  const entryIds = new Set(profile.entryCandidates.map((entry) => entry.nodeId));
  for (const node of nodesOfType(profile, "function")) {
    const degree = profile.nodeDegrees.get(node.id);
    lines.push(
      `| \`${node.id}\` | ${node.name} | \`${node.filePath ?? ""}\` | ${node.lineRange?.join("-") ?? ""} | ${layerNameForNode(profile, node.id)} | ${node.summary || "本地代码事实: 无摘要"} | ${degree?.incomingCalls ?? 0} | ${degree?.outgoingCalls ?? 0} | ${entryIds.has(node.id) ? "yes" : "no"} | ${plan.nodeCoverage.get(node.id) === "topic" ? "yes" : "no"} |`,
    );
  }
  return lines.join("\n");
}

function renderClassIndex(profile: ProjectProfile, plan: DocumentPlan): string {
  const lines = ["# 类索引", "", "| Node id | Class | File | Lines | Layer | Summary | Coverage |", "|---|---|---|---|---|---|---|"];
  for (const node of nodesOfType(profile, "class")) {
    lines.push(
      `| \`${node.id}\` | ${node.name} | \`${node.filePath ?? ""}\` | ${node.lineRange?.join("-") ?? ""} | ${layerNameForNode(profile, node.id)} | ${node.summary || "本地代码事实: 无摘要"} | ${plan.nodeCoverage.get(node.id) ?? "none"} |`,
    );
  }
  return lines.join("\n");
}

function renderCallIndex(profile: ProjectProfile): string {
  const lines = ["# 调用关系索引", "", "| Source | Target | Type |", "|---|---|---|"];
  for (const edge of profile.graph.edges.filter((item) => item.type === "calls")) {
    lines.push(`| \`${edge.source}\` | \`${edge.target}\` | ${edge.type} |`);
  }
  if (lines.length === 4) lines.push("| 无 | 无 | calls |");
  return lines.join("\n");
}

function renderDependencies(profile: ProjectProfile): string {
  const externalNodes = profile.graph.nodes.filter((node) => profile.externalNodeIds.has(node.id));
  const lines = ["# 配置与外部依赖", "", "## 本地代码事实", ""];
  for (const node of externalNodes) {
    lines.push(`- \`${node.id}\` (${node.type}) ${node.name}: ${node.summary || "无摘要"}`);
  }
  if (externalNodes.length === 0) lines.push("- 未在图谱中检测到配置、服务、表、端点、管道、schema 或资源节点。");
  lines.push("");
  lines.push("## 外部待核验");
  lines.push("");
  lines.push("- 依赖可用性、真实配置值和数据内容不在本地图谱中。根据代码推断，需线上配置确认");
  return lines.join("\n");
}

function renderRisks(profile: ProjectProfile): string {
  const lines = ["# 待确认项", "", "## Evidence gaps", ""];
  for (const gap of profile.evidenceGaps) {
    lines.push(`- **${gap.kind}**: ${gap.message}`);
  }
  if (profile.evidenceGaps.length === 0) lines.push("- 当前图谱没有检测到结构性证据缺口。");
  lines.push("");
  lines.push("## 外部待核验");
  lines.push("");
  lines.push("- 线上配置、实验策略、数据库记录和真实流量路径需要外部验证。根据代码推断，需线上配置确认");
  return lines.join("\n");
}

function renderAiIndex(profile: ProjectProfile, plan: DocumentPlan): string {
  const lines = ["# AI检索索引", "", "## Core retrieval terms", ""];
  for (const node of profile.graph.nodes) {
    const tags = node.tags.join(", ");
    lines.push(`- \`${node.id}\` | ${node.name} | ${node.type} | ${node.filePath ?? ""} | ${tags} | coverage=${plan.nodeCoverage.get(node.id) ?? "none"}`);
  }
  return lines.join("\n");
}

function renderModuleDoc(profile: ProjectProfile, planDoc: PlannedDocument): string {
  const layer = profile.layerProfiles.find((item) => `${item.name} 模块概览` === planDoc.title);
  const lines = [`# ${planDoc.title}`, "", "## 本地代码事实", ""];
  if (layer) {
    lines.push(`- Layer id: \`${layer.id}\``);
    lines.push(`- 描述: ${layer.description || "无描述"}`);
    lines.push(`- 文件数: ${layer.fileCount}`);
    lines.push(`- 函数数: ${layer.functionCount}`);
    lines.push(`- 类数: ${layer.classCount}`);
    lines.push("");
    lines.push("## 重要节点");
    lines.push("");
    for (const nodeId of layer.nodeIds) {
      const node = nodeOf(profile, nodeId);
      if (node) lines.push(`- \`${node.id}\` (${node.type}) ${node.name}: ${node.summary || "无摘要"}`);
    }
  }
  lines.push("");
  lines.push("## AI search terms");
  lines.push("");
  lines.push(planDoc.coveredNodeIds.map((nodeId) => nodeOf(profile, nodeId)?.name).filter(Boolean).join(", ") || "无");
  return lines.join("\n");
}

function renderFlowDoc(profile: ProjectProfile, planDoc: PlannedDocument): string {
  const lines = [`# ${planDoc.title}`, "", "## Flow conclusion", "", `代码推断: 该流程从入口节点展开，覆盖 ${planDoc.coveredNodeIds.length} 个相关节点。`, "", "## Execution sequence", ""];
  for (const nodeId of planDoc.coveredNodeIds) {
    const node = nodeOf(profile, nodeId);
    if (node) lines.push(`- \`${node.id}\` (${node.type}) ${node.name}: ${node.summary || "无摘要"}`);
  }
  lines.push("");
  lines.push("## Code evidence");
  lines.push("");
  lines.push("| Node | File | Lines |");
  lines.push("|---|---|---|");
  for (const nodeId of planDoc.coveredNodeIds) {
    const node = nodeOf(profile, nodeId);
    if (node) lines.push(`| \`${node.id}\` | \`${node.filePath ?? ""}\` | ${node.lineRange?.join("-") ?? ""} |`);
  }
  lines.push("");
  lines.push("## Verification gaps");
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
    `**Why it matters**: ${planDoc.reason}`,
    "",
    "## 本地代码事实",
    "",
    `- Node id: \`${nodeId}\``,
    `- Name: ${node?.name ?? nodeId}`,
    `- Type: ${node?.type ?? "unknown"}`,
    `- File: \`${node?.filePath ?? ""}\``,
    `- Lines: ${node?.lineRange?.join("-") ?? ""}`,
    `- Summary: ${node?.summary || "无摘要"}`,
    "",
    "## Upstream callers",
    "",
    incoming.map((edge) => `- ${edgeName(profile, edge.source)} --[${edge.type}]--> ${edgeName(profile, edge.target)}`).join("\n") || "- 无",
    "",
    "## Downstream callees and dependencies",
    "",
    outgoing.map((edge) => `- ${edgeName(profile, edge.source)} --[${edge.type}]--> ${edgeName(profile, edge.target)}`).join("\n") || "- 无",
    "",
    "## 代码证据",
    "",
    `| Node | File | Lines |`,
    `|---|---|---|`,
    `| \`${nodeId}\` | \`${node?.filePath ?? ""}\` | ${node?.lineRange?.join("-") ?? ""} |`,
    "",
    "## 外部待核验",
    "",
    "- 如该节点依赖运行时配置、实验或数据库内容，需要外部确认。根据代码推断，需线上配置确认",
    "",
    "## AI search terms",
    "",
    [node?.name, node?.filePath, ...(node?.tags ?? [])].filter(Boolean).join(", "),
  ].join("\n");
}

function renderCoverageReport(report: CoverageReport, validation: CoverageValidationResult): string {
  const lines = [
    "# 覆盖报告",
    "",
    `总文档数: ${report.totalDocuments}`,
    `Coverage status: ${report.status}`,
    "",
    "## Document counts",
    "",
  ];
  for (const category of DOCUMENT_CATEGORIES) {
    lines.push(`- ${category}: ${report.documentCounts[category]}`);
  }
  lines.push("");
  lines.push("## Node coverage");
  lines.push("");
  lines.push(`- File document coverage: ${report.fileDocumentCoverage.covered} / ${report.fileDocumentCoverage.total}`);
  lines.push(`- Function card coverage: ${report.functionCardCoverage.covered} / ${report.functionCardCoverage.total}`);
  lines.push(`- Class card coverage: ${report.classCardCoverage.covered} / ${report.classCardCoverage.total}`);
  lines.push(`- Layer overview coverage: ${report.layerOverviewCoverage.covered} / ${report.layerOverviewCoverage.total}`);
  lines.push(`- Entry coverage: ${report.entryCoverage.covered} / ${report.entryCoverage.total}`);
  lines.push(`- Topic coverage: ${report.topicCoverage.covered} / ${report.topicCoverage.total}`);
  lines.push(`- Source read coverage: ${report.sourceReadCoverage.covered} / ${report.sourceReadCoverage.total}`);
  lines.push("");
  lines.push("## Relationship coverage");
  lines.push("");
  for (const item of report.relationshipCoverage) {
    lines.push(`- ${item.edgeType}: ${item.covered} / ${item.total}`);
    if (item.missingEdgeIds.length > 0) {
      for (const edgeId of item.missingEdgeIds) lines.push(`  - Missing: ${edgeId}`);
    }
  }
  lines.push("");
  lines.push("## Batch coverage");
  lines.push("");
  lines.push(`- File writer batches: ${report.fileWriterBatches.passed} passed / ${report.fileWriterBatches.total} total; retry ${report.fileWriterBatches.retry}`);
  lines.push(`- Topic batches: ${report.topicBatches.passed} passed / ${report.topicBatches.total} total; retry ${report.topicBatches.retry}`);
  lines.push("");
  lines.push("## Source read coverage");
  lines.push("");
  if (report.sourceReadCoverage.missing.length === 0) {
    lines.push("- Missing source files: none");
  } else {
    for (const nodeId of report.sourceReadCoverage.missing) lines.push(`- Missing source: ${nodeId}`);
  }
  lines.push("");
  lines.push("## Validation");
  lines.push("");
  if (report.errors.length === 0) {
    lines.push("- Errors: none");
  } else {
    for (const error of report.errors) lines.push(`- Error: ${error}`);
  }
  if (report.warnings.length === 0) {
    lines.push("- Warnings: none");
  } else {
    for (const warning of report.warnings) lines.push(`- Warning: ${warning}`);
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
    const moduleDoc = documents.find((doc) => doc.category === "module" && doc.content.includes(`Layer id: \`${layer.id}\``));
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
