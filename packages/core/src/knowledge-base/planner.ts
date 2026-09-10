import type { GraphNode } from "../types.js";
import type {
  FileDocPlan,
  FileWriterDocument,
  ProjectProfile,
  TopicBatch,
  TopicPlan,
  TopicPlanItem,
  TopicCandidate,
  TopicTier,
} from "./types.js";
import { buildUniqueLabels } from "./display-label.js";
import { topicDocumentPath } from "./paths.js";

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

function sourceFileIdForTopic(profile: ProjectProfile, nodeId: string): string | null {
  return profile.indexes.functionToFileId.get(nodeId) ?? profile.indexes.classToFileId.get(nodeId) ?? null;
}

function topicCoveredNodeIds(profile: ProjectProfile, nodeId: string): string[] {
  const related = new Set<string>([nodeId]);
  const topicRelationshipTypes = new Set([
    "calls",
    "configures",
    "reads_from",
    "writes_to",
    "tested_by",
    "depends_on",
    "transforms",
    "validates",
  ]);
  for (const edge of [
    ...(profile.indexes.incomingEdgesByNode.get(nodeId) ?? []),
    ...(profile.indexes.outgoingEdgesByNode.get(nodeId) ?? []),
  ]) {
    if (topicRelationshipTypes.has(edge.type)) {
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

  // Filesystems can alias case and canonically equivalent Unicode spellings.
  // Reserve portable natural-path keys, without changing collision-free URLs.
  const portablePathKey = (documentPath: string): string => documentPath.normalize("NFC").toLowerCase().normalize("NFC");
  const pathCounts = new Map<string, number>();
  for (const topic of pendingTopics) {
    const key = portablePathKey(topic.documentPath);
    pathCounts.set(key, (pathCounts.get(key) ?? 0) + 1);
  }
  const reservedPaths = new Set(pathCounts.keys());
  for (const topic of [...pendingTopics].sort((a, b) => a.topicNodeId.localeCompare(b.topicNodeId))) {
    if (pathCounts.get(portablePathKey(topic.documentPath)) === 1) continue;
    const stem = topic.documentPath.slice(0, -3);
    // A portable suffix for filenames, not an integrity digest. The reserved
    // path set below also resolves collisions in this non-cryptographic hash.
    let identity = 2166136261;
    for (let i = 0; i < topic.topicNodeId.length; i++) identity = Math.imul(identity ^ topic.topicNodeId.charCodeAt(i), 16777619) >>> 0;
    const suffix = identity.toString(16).padStart(8, "0");
    let qualified = `${stem}-${suffix}.md`;
    let attempt = 1;
    while (reservedPaths.has(portablePathKey(qualified))) qualified = `${stem}-${suffix}-${++attempt}.md`;
    reservedPaths.add(portablePathKey(qualified));
    topic.documentPath = qualified;
  }

  // Nine functions named `main` would otherwise share one topic title. Qualify
  // only the names that actually collide, once the full set is known.
  const topicLabels = buildUniqueLabels(pendingTopics.map((topic) => {
    const topicNode = profile.indexes.nodesById.get(topic.topicNodeId);
    return {
      id: topic.topicNodeId,
      name: topicNode?.name ?? topic.topicNodeId,
      filePath: topicNode?.filePath ?? topic.sourceFileNodeId,
    };
  }));
  for (const topic of pendingTopics) {
    const label = topicLabels.get(topic.topicNodeId);
    if (label) topic.title = `${label} 关键函数专题`;
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
