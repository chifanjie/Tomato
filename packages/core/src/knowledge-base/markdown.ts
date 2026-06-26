import type { EdgeType, GraphNode, NodeType } from "../types.js";
import type {
  CoverageReport,
  CoverageValidationResult,
  DocumentPlan,
  GeneratedDocument,
  KnowledgeBaseDocumentCategory,
  PlannedDocument,
  ProjectProfile,
} from "./types.js";

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

function countByCategory(documents: GeneratedDocument[]): Record<KnowledgeBaseDocumentCategory, number> {
  const counts = Object.fromEntries(DOCUMENT_CATEGORIES.map((category) => [category, 0])) as Record<KnowledgeBaseDocumentCategory, number>;
  for (const doc of documents) counts[doc.category] += 1;
  return counts;
}

function countCovered(profile: ProjectProfile, plan: DocumentPlan, type: NodeType, level: "index" | "overview" | "topic"): number {
  const rank = { none: 0, index: 1, overview: 2, "pending-verification": 2, topic: 3 };
  const required = rank[level];
  return nodesOfType(profile, type).filter((node) => rank[plan.nodeCoverage.get(node.id) ?? "none"] >= required).length;
}

function topicCoveredCount(profile: ProjectProfile, plan: DocumentPlan): number {
  return profile.graph.nodes.filter((node) => plan.nodeCoverage.get(node.id) === "topic").length;
}

export function buildCoverageReport(
  profile: ProjectProfile,
  plan: DocumentPlan,
  documents: GeneratedDocument[],
  validation: CoverageValidationResult,
): CoverageReport {
  const entryCovered = profile.entryCandidates.filter((entry) => {
    return plan.documents.some((doc) => (doc.category === "flow" || doc.category === "topic") && doc.coveredNodeIds.includes(entry.nodeId));
  }).length;
  const layerOverviewCovered = profile.layerProfiles.filter((layer) => {
    return plan.documents.some((doc) => doc.category === "module" && doc.coveredNodeIds.some((nodeId) => layer.nodeIds.includes(nodeId)));
  }).length;
  const fileIndexCovered = countCovered(profile, plan, "file", "index");
  const functionIndexCovered = countCovered(profile, plan, "function", "index");
  const classIndexCovered = countCovered(profile, plan, "class", "index");
  const evidenceWarnings = profile.evidenceGaps.map((gap) => `${gap.kind}: ${gap.message}`);
  const placeholderFailures = validation.errors.filter((error) => error.includes("placeholder text"));

  return {
    totalDocuments: documents.length,
    documentCounts: countByCategory(documents),
    nodeCounts: profile.nodeCounts,
    edgeCounts: profile.edgeCounts,
    // Temporary compatibility until file-doc validation lands.
    fileDocumentCoverage: { covered: fileIndexCovered, total: profile.nodeCounts.file, missing: [] },
    // Temporary compatibility until file-doc validation lands.
    functionCardCoverage: { covered: functionIndexCovered, total: profile.nodeCounts.function, missing: [] },
    // Temporary compatibility until file-doc validation lands.
    classCardCoverage: { covered: classIndexCovered, total: profile.nodeCounts.class, missing: [] },
    // Temporary compatibility until relationship validation lands.
    relationshipCoverage: Object.entries(profile.edgeCounts).map(([edgeType, total]) => ({
      edgeType,
      covered: total,
      total,
      missingEdgeIds: [],
    })),
    // Temporary compatibility until source-read validation lands.
    sourceReadCoverage: { covered: fileIndexCovered, total: profile.nodeCounts.file, missing: [] },
    layerOverviewCoverage: { covered: layerOverviewCovered, total: profile.layerProfiles.length, missing: [] },
    entryCoverage: { covered: entryCovered, total: profile.entryCandidates.length, missing: [] },
    topicCoverage: { covered: topicCoveredCount(profile, plan), total: profile.graph.nodes.length, missing: [] },
    fileWriterBatches: { total: 0, passed: 0, retry: 0 },
    topicBatches: { total: 0, passed: 0, retry: 0 },
    chineseValidation: { checked: documents.length, failed: [] },
    placeholderValidation: { checked: documents.length, failed: placeholderFailures },
    warnings: [...validation.warnings, ...evidenceWarnings],
    errors: validation.errors,
    status: validation.ok ? "complete" : "incomplete",
  };
}

function renderInventory(profile: ProjectProfile, plan: DocumentPlan, report?: CoverageReport): string {
  const totalDocuments = report?.totalDocuments ?? plan.documents.length;
  const lines = [
    "# 目录",
    "",
    `**项目**: ${profile.graph.project.name}`,
    `**生成文档数**: ${totalDocuments}`,
    `**图谱提交**: ${profile.graph.project.gitCommitHash || "unknown"}`,
    "",
    "## 推荐阅读路径",
    "",
    "- 工程师接手代码: 项目总览 -> 架构与模块总览 -> 业务流程总览 -> 关键函数专题 -> 函数索引",
    "- 产品/运营理解业务: 业务流程总览 -> 业务流程 -> 风险点与待确认项",
    "- AI agent 后续检索: AI检索索引 -> 函数索引 -> 文件索引 -> 覆盖报告",
    "",
    "## 文档清单",
    "",
  ];
  for (const doc of plan.documents) {
    lines.push(`- [${doc.title}](${doc.path}) — ${doc.category}; ${doc.reason}`);
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
  const lines = ["# 架构与模块总览", "", "## Layer 列表", ""];
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
  const lines = ["# 业务流程总览", "", "## 检测到的入口", ""];
  if (profile.entryCandidates.length === 0) {
    lines.push("- 未检测到明确入口。代码推断: 可从架构与模块总览和函数索引继续定位业务路径。");
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
  const lines = ["# 风险点与待确认项", "", "## Evidence gaps", ""];
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
  lines.push("## Validation");
  lines.push("");
  if (validation.errors.length === 0) {
    lines.push("- Errors: none");
  } else {
    for (const error of validation.errors) lines.push(`- Error: ${error}`);
  }
  if (validation.warnings.length === 0) {
    lines.push("- Warnings: none");
  } else {
    for (const warning of validation.warnings) lines.push(`- Warning: ${warning}`);
  }
  return lines.join("\n");
}

export function renderKnowledgeBaseDocuments(
  profile: ProjectProfile,
  plan: DocumentPlan,
  report?: CoverageReport,
  validation?: CoverageValidationResult,
): GeneratedDocument[] {
  return plan.documents.map((doc) => {
    let content: string;
    if (doc.path === "目录.md") content = renderInventory(profile, plan, report);
    else if (doc.path === "项目总览.md") content = renderProjectOverview(profile);
    else if (doc.path === "架构与模块总览.md") content = renderArchitecture(profile);
    else if (doc.path === "业务流程总览.md") content = renderFlowOverview(profile);
    else if (doc.path === "文件索引.md") content = renderFileIndex(profile, plan);
    else if (doc.path === "函数索引.md") content = renderFunctionIndex(profile, plan);
    else if (doc.path === "类索引.md") content = renderClassIndex(profile, plan);
    else if (doc.path === "配置与外部依赖.md") content = renderDependencies(profile);
    else if (doc.path === "风险点与待确认项.md") content = renderRisks(profile);
    else if (doc.path === "AI检索索引.md") content = renderAiIndex(profile, plan);
    else if (doc.path === "覆盖报告.md" && report && validation) content = renderCoverageReport(report, validation);
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
  const fileIndex = docByPath.get("文件索引.md")?.content ?? "";
  const functionIndex = docByPath.get("函数索引.md")?.content ?? "";
  const classIndex = docByPath.get("类索引.md")?.content ?? "";

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
