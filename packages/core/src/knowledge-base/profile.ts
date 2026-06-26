import type { EdgeType, GraphEdge, GraphNode, KnowledgeGraph, NodeType } from "../types.js";
import type {
  EntryCandidate,
  EvidenceGap,
  GraphIndexes,
  LayerProfile,
  NodeDegree,
  ProjectProfile,
} from "./types.js";

const NODE_TYPES: NodeType[] = [
  "file",
  "function",
  "class",
  "module",
  "concept",
  "config",
  "document",
  "service",
  "table",
  "endpoint",
  "pipeline",
  "schema",
  "resource",
  "domain",
  "flow",
  "step",
  "article",
  "entity",
  "topic",
  "claim",
  "source",
];

const EDGE_TYPES: EdgeType[] = [
  "imports",
  "exports",
  "contains",
  "inherits",
  "implements",
  "calls",
  "subscribes",
  "publishes",
  "middleware",
  "reads_from",
  "writes_to",
  "transforms",
  "validates",
  "depends_on",
  "tested_by",
  "configures",
  "related",
  "similar_to",
  "deploys",
  "serves",
  "provisions",
  "triggers",
  "migrates",
  "documents",
  "routes",
  "defines_schema",
  "contains_flow",
  "flow_step",
  "cross_domain",
  "cites",
  "contradicts",
  "builds_on",
  "exemplifies",
  "categorized_under",
  "authored_by",
];

const ENTRY_WORDS = [
  "handler",
  "handle",
  "route",
  "controller",
  "endpoint",
  "consumer",
  "subscriber",
  "job",
  "cron",
  "command",
  "main",
  "run",
  "start",
  "bootstrap",
  "execute",
];

const BUSINESS_WORDS = [
  "business",
  "domain",
  "flow",
  "workflow",
  "process",
  "strategy",
  "rule",
  "policy",
  "decision",
  "score",
  "rank",
  "ranking",
  "recommend",
  "feed",
  "candidate",
  "order",
  "payment",
  "user",
  "product",
  "config",
  "experiment",
];

const EXTERNAL_NODE_TYPES = new Set<NodeType>([
  "config",
  "service",
  "table",
  "endpoint",
  "pipeline",
  "schema",
  "resource",
]);

function emptyNodeCounts(): Record<NodeType, number> {
  return Object.fromEntries(NODE_TYPES.map((type) => [type, 0])) as Record<NodeType, number>;
}

function emptyEdgeCounts(): Record<EdgeType, number> {
  return Object.fromEntries(EDGE_TYPES.map((type) => [type, 0])) as Record<EdgeType, number>;
}

function addToMapList<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key) ?? [];
  list.push(value);
  map.set(key, list);
}

function textForNode(node: GraphNode): string {
  return [node.id, node.name, node.filePath ?? "", node.summary, ...node.tags]
    .join(" ")
    .toLowerCase();
}

function containsAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function entryTypeFor(text: string): EntryCandidate["entryType"] {
  if (text.includes("route") || text.includes("handler") || text.includes("controller") || text.includes("endpoint")) return "api";
  if (text.includes("consumer") || text.includes("subscriber")) return "event";
  if (text.includes("job") || text.includes("cron")) return "job";
  if (text.includes("command") || text.includes("cli")) return "cli";
  if (text.includes("main") || text.includes("bootstrap") || text.includes("start")) return "lifecycle";
  return "generic";
}

export function buildGraphIndexes(graph: KnowledgeGraph): GraphIndexes {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const nodeToLayerId = new Map<string, string>();
  const fileToChildIds = new Map<string, string[]>();
  const fileToFunctionIds = new Map<string, string[]>();
  const fileToClassIds = new Map<string, string[]>();
  const functionToFileId = new Map<string, string>();
  const classToFileId = new Map<string, string>();
  const incomingEdgesByNode = new Map<string, GraphEdge[]>();
  const outgoingEdgesByNode = new Map<string, GraphEdge[]>();
  const edgesByType = new Map<EdgeType, GraphEdge[]>();

  for (const layer of graph.layers) {
    for (const nodeId of layer.nodeIds) {
      if (!nodeToLayerId.has(nodeId)) nodeToLayerId.set(nodeId, layer.id);
    }
  }

  for (const edge of graph.edges) {
    addToMapList(outgoingEdgesByNode, edge.source, edge);
    addToMapList(incomingEdgesByNode, edge.target, edge);
    const edgesOfType = edgesByType.get(edge.type) ?? [];
    edgesOfType.push(edge);
    edgesByType.set(edge.type, edgesOfType);

    if (edge.type === "contains") {
      const child = nodesById.get(edge.target);
      addToMapList(fileToChildIds, edge.source, edge.target);
      if (child?.type === "function") {
        addToMapList(fileToFunctionIds, edge.source, edge.target);
        functionToFileId.set(edge.target, edge.source);
        if (!nodeToLayerId.has(edge.target) && nodeToLayerId.has(edge.source)) {
          nodeToLayerId.set(edge.target, nodeToLayerId.get(edge.source)!);
        }
      }
      if (child?.type === "class") {
        addToMapList(fileToClassIds, edge.source, edge.target);
        classToFileId.set(edge.target, edge.source);
        if (!nodeToLayerId.has(edge.target) && nodeToLayerId.has(edge.source)) {
          nodeToLayerId.set(edge.target, nodeToLayerId.get(edge.source)!);
        }
      }
    }
  }

  return {
    nodesById,
    nodeToLayerId,
    fileToChildIds,
    fileToFunctionIds,
    fileToClassIds,
    functionToFileId,
    classToFileId,
    incomingEdgesByNode,
    outgoingEdgesByNode,
    edgesByType,
  };
}

function buildNodeDegrees(graph: KnowledgeGraph, indexes: GraphIndexes): Map<string, NodeDegree> {
  const degrees = new Map<string, NodeDegree>();
  for (const node of graph.nodes) {
    const incoming = indexes.incomingEdgesByNode.get(node.id) ?? [];
    const outgoing = indexes.outgoingEdgesByNode.get(node.id) ?? [];
    degrees.set(node.id, {
      nodeId: node.id,
      incoming: incoming.length,
      outgoing: outgoing.length,
      incomingCalls: incoming.filter((edge) => edge.type === "calls").length,
      outgoingCalls: outgoing.filter((edge) => edge.type === "calls").length,
      total: incoming.length + outgoing.length,
    });
  }
  return degrees;
}

function buildLayerProfiles(graph: KnowledgeGraph, indexes: GraphIndexes): LayerProfile[] {
  return graph.layers.map((layer) => {
    const nodeCounts: Partial<Record<NodeType, number>> = {};
    const complexityCounts: Record<GraphNode["complexity"], number> = {
      simple: 0,
      moderate: 0,
      complex: 0,
    };
    const inboundLayerIds = new Set<string>();
    const outboundLayerIds = new Set<string>();

    for (const nodeId of layer.nodeIds) {
      const node = indexes.nodesById.get(nodeId);
      if (!node) continue;
      nodeCounts[node.type] = (nodeCounts[node.type] ?? 0) + 1;
      complexityCounts[node.complexity] += 1;
    }

    for (const edge of graph.edges) {
      const sourceLayer = indexes.nodeToLayerId.get(edge.source);
      const targetLayer = indexes.nodeToLayerId.get(edge.target);
      if (!sourceLayer || !targetLayer || sourceLayer === targetLayer) continue;
      if (sourceLayer === layer.id) outboundLayerIds.add(targetLayer);
      if (targetLayer === layer.id) inboundLayerIds.add(sourceLayer);
    }

    return {
      id: layer.id,
      name: layer.name,
      description: layer.description,
      nodeIds: [...layer.nodeIds],
      nodeCounts,
      fileCount: nodeCounts.file ?? 0,
      functionCount: nodeCounts.function ?? 0,
      classCount: nodeCounts.class ?? 0,
      complexityCounts,
      inboundLayerIds: [...inboundLayerIds].sort(),
      outboundLayerIds: [...outboundLayerIds].sort(),
    };
  });
}

function detectEntryCandidates(graph: KnowledgeGraph): EntryCandidate[] {
  const entries: EntryCandidate[] = [];
  for (const node of graph.nodes) {
    const text = textForNode(node);
    const typeEligible = node.type === "function" || node.type === "endpoint" || node.type === "pipeline";
    const tagEntry = node.tags.some((tag) => ["entry", "handler", "route", "endpoint", "consumer", "job"].includes(tag.toLowerCase()));
    if (typeEligible && (tagEntry || containsAny(text, ENTRY_WORDS))) {
      entries.push({
        nodeId: node.id,
        reason: tagEntry ? "entry-like tag" : "entry-like name or summary",
        entryType: entryTypeFor(text),
      });
    }
  }
  return entries.sort((a, b) => a.nodeId.localeCompare(b.nodeId));
}

function detectBusinessSignals(graph: KnowledgeGraph): Set<string> {
  const result = new Set<string>();
  for (const node of graph.nodes) {
    if (containsAny(textForNode(node), BUSINESS_WORDS)) {
      result.add(node.id);
    }
  }
  return result;
}

function detectExternalNodes(graph: KnowledgeGraph): Set<string> {
  const result = new Set<string>();
  for (const node of graph.nodes) {
    if (EXTERNAL_NODE_TYPES.has(node.type)) result.add(node.id);
  }
  return result;
}

function collectEvidenceGaps(graph: KnowledgeGraph, indexes: GraphIndexes): EvidenceGap[] {
  const gaps: EvidenceGap[] = [];
  for (const node of graph.nodes) {
    if (!node.summary.trim()) {
      gaps.push({ kind: "missing-summary", nodeId: node.id, message: `${node.id} has an empty summary` });
    }
    if ((node.type === "function" || node.type === "class") && !node.lineRange) {
      gaps.push({ kind: "missing-line-range", nodeId: node.id, message: `${node.id} has no line range` });
    }
    if (node.type === "file" && !indexes.nodeToLayerId.has(node.id)) {
      gaps.push({ kind: "missing-layer", nodeId: node.id, message: `${node.id} is not assigned to a layer` });
    }
  }
  if (graph.nodes.some((node) => node.type === "function") && !indexes.edgesByType.has("calls")) {
    gaps.push({
      kind: "missing-calls",
      message: "Graph has function nodes but no calls edges; function linkage will be estimated from imports and summaries",
    });
  }
  return gaps;
}

export function buildKnowledgeBaseProfile(graph: KnowledgeGraph): ProjectProfile {
  const indexes = buildGraphIndexes(graph);
  const nodeCounts = emptyNodeCounts();
  const edgeCounts = emptyEdgeCounts();

  for (const node of graph.nodes) nodeCounts[node.type] += 1;
  for (const edge of graph.edges) edgeCounts[edge.type] += 1;

  return {
    graph,
    indexes,
    nodeCounts,
    edgeCounts,
    layerProfiles: buildLayerProfiles(graph, indexes),
    nodeDegrees: buildNodeDegrees(graph, indexes),
    entryCandidates: detectEntryCandidates(graph),
    businessSignalNodeIds: detectBusinessSignals(graph),
    externalNodeIds: detectExternalNodes(graph),
    evidenceGaps: collectEvidenceGaps(graph, indexes),
  };
}

