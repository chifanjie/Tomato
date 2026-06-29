import type { GraphNode } from "../types.js";
import type {
  CoverageLevel,
  DocumentPlan,
  FileDocPlan,
  FileWriterDocument,
  KnowledgeBaseDocumentCategory,
  PlannedDocument,
  ProjectProfile,
  TopicBatch,
  TopicPlan,
  TopicPlanItem,
  TopicCandidate,
  TopicTier,
} from "./types.js";
import { KB_PATHS, indexDocumentPath, moduleDocumentPath, slugPath, topicDocumentPath } from "./paths.js";

function addReason(map: Map<string, Set<string>>, nodeId: string, reason: string): void {
  const reasons = map.get(nodeId) ?? new Set<string>();
  reasons.add(reason);
  map.set(nodeId, reasons);
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return Number.POSITIVE_INFINITY;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function nodeLayer(profile: ProjectProfile, nodeId: string): string | null {
  const direct = profile.indexes.nodeToLayerId.get(nodeId);
  if (direct) return direct;
  const fileId = profile.indexes.functionToFileId.get(nodeId) ?? profile.indexes.classToFileId.get(nodeId);
  return fileId ? profile.indexes.nodeToLayerId.get(fileId) ?? null : null;
}

function relevantTopicNodes(profile: ProjectProfile): GraphNode[] {
  return profile.graph.nodes.filter((node) => node.type === "function" || node.type === "class");
}

function topicTierForCandidate(profile: ProjectProfile, candidate: TopicCandidate): TopicTier {
  const reasons = new Set(candidate.reasons);
  if ([...reasons].some((reason) => reason.startsWith("entry candidate:"))) return "required";
  if (reasons.has("cross-layer call bridge")) return "required";
  if (reasons.has("complex business-relevant node")) return "required";

  const node = profile.indexes.nodesById.get(candidate.nodeId);
  const summary = [node?.name ?? "", node?.summary ?? "", ...(node?.tags ?? [])].join(" ").toLowerCase();
  if (/(business|feed|strategy|rule|quota|scene|experiment|表单|导流|召回|推荐|降级)/.test(summary)) {
    return "required";
  }

  return "extended";
}

export function selectTopicCandidates(profile: ProjectProfile): TopicCandidate[] {
  const reasonsByNode = new Map<string, Set<string>>();

  for (const entry of profile.entryCandidates) {
    addReason(reasonsByNode, entry.nodeId, `entry candidate: ${entry.reason}`);
  }

  for (const node of relevantTopicNodes(profile)) {
    if (node.complexity === "complex" && profile.businessSignalNodeIds.has(node.id)) {
      addReason(reasonsByNode, node.id, "complex business-relevant node");
    }
  }

  for (const edge of profile.indexes.edgesByType.get("calls") ?? []) {
    const sourceLayer = nodeLayer(profile, edge.source);
    const targetLayer = nodeLayer(profile, edge.target);
    if (sourceLayer && targetLayer && sourceLayer !== targetLayer) {
      addReason(reasonsByNode, edge.source, "cross-layer call bridge");
    }
  }

  const degreeValues = relevantTopicNodes(profile)
    .map((node) => profile.nodeDegrees.get(node.id)?.total ?? 0)
    .filter((value) => value > 0);
  const degreeThreshold = percentile(degreeValues, 0.85);
  for (const node of relevantTopicNodes(profile)) {
    const degree = profile.nodeDegrees.get(node.id);
    if (degree && degree.total >= degreeThreshold && degree.total > 1) {
      addReason(reasonsByNode, node.id, `project-relative high degree (${degree.total})`);
    }
  }

  for (const node of relevantTopicNodes(profile)) {
    const connected = [
      ...(profile.indexes.incomingEdgesByNode.get(node.id) ?? []),
      ...(profile.indexes.outgoingEdgesByNode.get(node.id) ?? []),
    ];
    if (connected.some((edge) => profile.externalNodeIds.has(edge.source) || profile.externalNodeIds.has(edge.target))) {
      addReason(reasonsByNode, node.id, "connected to config/data/external dependency");
    }
  }

  return [...reasonsByNode.entries()]
    .map(([nodeId, reasons]) => {
      const degree = profile.nodeDegrees.get(nodeId)?.total ?? 0;
      return {
        nodeId,
        reasons: [...reasons].sort(),
        score: reasons.size * 10 + degree,
      };
    })
    .sort((a, b) => b.score - a.score || a.nodeId.localeCompare(b.nodeId));
}

function addCoverage(
  coverage: Map<string, CoverageLevel>,
  reasons: Map<string, string[]>,
  nodeIds: string[],
  level: CoverageLevel,
  reason: string,
): void {
  const rank: Record<CoverageLevel, number> = {
    none: 0,
    index: 1,
    overview: 2,
    "pending-verification": 2,
    topic: 3,
  };
  for (const nodeId of nodeIds) {
    const current = coverage.get(nodeId) ?? "none";
    if (rank[level] >= rank[current]) {
      coverage.set(nodeId, level);
    }
    const list = reasons.get(nodeId) ?? [];
    list.push(reason);
    reasons.set(nodeId, list);
  }
}

function plannedDoc(
  path: string,
  title: string,
  category: KnowledgeBaseDocumentCategory,
  coveredNodeIds: string[],
  coverageLevel: CoverageLevel,
  reason: string,
): PlannedDocument {
  return {
    path,
    title,
    category,
    coveredNodeIds: [...new Set(coveredNodeIds)].sort(),
    coverageLevel,
    reason,
  };
}

function collectFlowNodeIds(profile: ProjectProfile, entryNodeId: string): string[] {
  const visited = new Set<string>([entryNodeId]);
  let frontier = [entryNodeId];
  for (let depth = 0; depth < 4; depth += 1) {
    const next: string[] = [];
    for (const nodeId of frontier) {
      for (const edge of profile.indexes.outgoingEdgesByNode.get(nodeId) ?? []) {
        if (edge.type !== "calls" && edge.type !== "configures" && edge.type !== "reads_from" && edge.type !== "writes_to") continue;
        if (!visited.has(edge.target)) {
          visited.add(edge.target);
          next.push(edge.target);
        }
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return [...visited];
}

export function buildDocumentPlan(profile: ProjectProfile): DocumentPlan {
  const documents: PlannedDocument[] = [];
  const nodeCoverage = new Map<string, CoverageLevel>();
  const coverageReasons = new Map<string, string[]>();
  const topicCandidates = selectTopicCandidates(profile);

  const topLevelDocs: Array<[string, string, KnowledgeBaseDocumentCategory]> = [
    [KB_PATHS.inventory, "目录", "top-level"],
    [KB_PATHS.projectOverview, "项目总览", "top-level"],
    [KB_PATHS.architectureMap, "架构地图", "top-level"],
    [KB_PATHS.businessFlowMap, "业务流程地图", "top-level"],
    [KB_PATHS.pendingItems, "待确认项", "top-level"],
    [KB_PATHS.coverageReport, "覆盖报告", "report"],
    [indexDocumentPath("文件索引"), "文件索引", "index"],
    [indexDocumentPath("函数索引"), "函数索引", "index"],
    [indexDocumentPath("类索引"), "类索引", "index"],
    [indexDocumentPath("调用关系索引"), "调用关系索引", "index"],
    [indexDocumentPath("AI检索索引"), "AI检索索引", "index"],
  ];

  for (const [path, title, category] of topLevelDocs) {
    documents.push(plannedDoc(path, title, category, [], "overview", "stable knowledge-base navigation document"));
  }

  const fileIds = profile.graph.nodes.filter((node) => node.type === "file").map((node) => node.id);
  const functionIds = profile.graph.nodes.filter((node) => node.type === "function").map((node) => node.id);
  const classIds = profile.graph.nodes.filter((node) => node.type === "class").map((node) => node.id);
  addCoverage(nodeCoverage, coverageReasons, fileIds, "index", "listed in file index");
  addCoverage(nodeCoverage, coverageReasons, functionIds, "index", "listed in function index");
  addCoverage(nodeCoverage, coverageReasons, classIds, "index", "listed in class index");

  for (const layer of profile.layerProfiles) {
    const doc = plannedDoc(
      moduleDocumentPath(layer.name),
      `${layer.name} 模块概览`,
      "module",
      layer.nodeIds,
      "overview",
      "one module overview per graph layer",
    );
    documents.push(doc);
    addCoverage(nodeCoverage, coverageReasons, doc.coveredNodeIds, "overview", doc.reason);
  }

  for (const entry of profile.entryCandidates) {
    const node = profile.indexes.nodesById.get(entry.nodeId);
    const title = `${node?.name ?? entry.nodeId} 业务流程`;
    const coveredNodeIds = collectFlowNodeIds(profile, entry.nodeId);
    const doc = plannedDoc(
      `业务流程/${slugPath(node?.name ?? entry.nodeId)}.md`,
      title,
      "flow",
      coveredNodeIds,
      "topic",
      `entry flow for ${entry.entryType}`,
    );
    documents.push(doc);
    addCoverage(nodeCoverage, coverageReasons, doc.coveredNodeIds, "topic", doc.reason);
  }

  for (const candidate of topicCandidates) {
    const node = profile.indexes.nodesById.get(candidate.nodeId);
    const fileId = profile.indexes.functionToFileId.get(candidate.nodeId) ?? profile.indexes.classToFileId.get(candidate.nodeId);
    const file = fileId ? profile.indexes.nodesById.get(fileId) : null;
    const title = `${node?.name ?? candidate.nodeId} 关键函数专题`;
    const doc = plannedDoc(
      topicDocumentPath(file?.filePath ?? candidate.nodeId, node?.name ?? candidate.nodeId),
      title,
      "topic",
      [candidate.nodeId],
      "topic",
      candidate.reasons.join("; "),
    );
    documents.push(doc);
    addCoverage(nodeCoverage, coverageReasons, doc.coveredNodeIds, "topic", doc.reason);
  }

  return {
    documents,
    topicCandidates,
    nodeCoverage,
    coverageReasons,
  };
}

function sourceFileIdForTopic(profile: ProjectProfile, nodeId: string): string | null {
  return profile.indexes.functionToFileId.get(nodeId) ?? profile.indexes.classToFileId.get(nodeId) ?? null;
}

function topicCoveredNodeIds(profile: ProjectProfile, nodeId: string): string[] {
  const related = new Set<string>([nodeId]);
  for (const edge of [
    ...(profile.indexes.incomingEdgesByNode.get(nodeId) ?? []),
    ...(profile.indexes.outgoingEdgesByNode.get(nodeId) ?? []),
  ]) {
    if (edge.type === "calls" || edge.type === "configures" || edge.type === "reads_from" || edge.type === "writes_to") {
      related.add(edge.source);
      related.add(edge.target);
    }
  }
  return [...related].filter((id) => profile.indexes.nodesById.has(id)).sort();
}

export function buildTopicPlan(
  profile: ProjectProfile,
  fileDocPlan: FileDocPlan,
  acceptedFileWriterDocuments: FileWriterDocument[],
): TopicPlan {
  const acceptedFileIds = new Set(acceptedFileWriterDocuments.map((document) => document.fileNodeId));
  const acceptedFileDocsById = new Map(acceptedFileWriterDocuments.map((document) => [document.fileNodeId, document]));
  const selectedCandidates = selectTopicCandidates(profile);
  const candidateByNodeId = new Map(selectedCandidates.map((candidate) => [candidate.nodeId, candidate]));
  const importantFromFiles = new Map<string, string[]>();
  const warnings: string[] = [];
  const reasonsByNode = new Map<string, string[]>();

  for (const fileDoc of acceptedFileWriterDocuments) {
    for (const nodeId of fileDoc.importantNodeIds) {
      const reasons = importantFromFiles.get(nodeId) ?? [];
      reasons.push(`file-writer marked important in ${fileDoc.documentPath}`);
      importantFromFiles.set(nodeId, reasons);
    }
  }

  for (const candidate of selectedCandidates) {
    reasonsByNode.set(candidate.nodeId, [...candidate.reasons]);
  }
  for (const [nodeId, reasons] of importantFromFiles) {
    reasonsByNode.set(nodeId, [...(reasonsByNode.get(nodeId) ?? []), ...reasons]);
  }

  const pendingTopics: TopicPlanItem[] = [];
  for (const [nodeId, reasons] of reasonsByNode) {
    const node = profile.indexes.nodesById.get(nodeId);
    const sourceFileNodeId = sourceFileIdForTopic(profile, nodeId);
    if (!node || !sourceFileNodeId) {
      warnings.push(`topic candidate missing source file: ${nodeId}`);
      continue;
    }
    if (!acceptedFileIds.has(sourceFileNodeId)) {
      warnings.push(`topic candidate source file document not accepted: ${nodeId}`);
      continue;
    }
    const fileTask = fileDocPlan.tasks.find((task) => task.fileNodeId === sourceFileNodeId);
    const candidate = candidateByNodeId.get(nodeId);
    const tier = candidate ? topicTierForCandidate(profile, candidate) : "extended";
    pendingTopics.push({
      batchIndex: 0,
      topicNodeId: nodeId,
      sourceFileNodeId,
      documentPath: topicDocumentPath(node.filePath ?? sourceFileNodeId, node.name),
      title: `${node.name} 关键函数专题`,
      reasons: [...new Set(reasons)].sort(),
      coveredNodeIds: topicCoveredNodeIds(profile, nodeId),
      linkedFileDocumentPath: fileTask?.documentPath ?? acceptedFileDocsById.get(sourceFileNodeId)?.documentPath ?? "",
      tier,
    });
  }

  const batches: TopicBatch[] = pendingTopics
    .sort((a, b) => a.documentPath.localeCompare(b.documentPath) || a.topicNodeId.localeCompare(b.topicNodeId))
    .map((topic, index) => {
      const tier = topic.tier;
      return {
        batchIndex: index + 1,
        topics: [{ ...topic, batchIndex: index + 1, tier }],
        reason: tier === "required"
          ? "required topic for default high-quality run"
          : "extended topic for optional continuation",
        tier,
      };
    });

  return {
    topics: batches.flatMap((batch) => batch.topics),
    batches,
    warnings,
  };
}
