import type { GraphEdge, GraphNode } from "../types.js";
import type { FileDocBatch, FileDocPlan, FileDocTask, KnowledgeBaseOptions, ProjectProfile, ReferenceTemplateKind } from "./types.js";
import { fileDocumentPath, normalizeKnowledgeSourcePath } from "./paths.js";
import { buildSourceSnapshot } from "./source-snapshot.js";

const MAX_BATCH_LINES = 1_600;
const MAX_BATCH_GRAPH_ITEMS = 120;
const PENDING_BATCH_INDEX = -1;

export function edgeId(edge: GraphEdge): string {
  return `${edge.type}:${edge.source}->${edge.target}`;
}

function sortedIds(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort();
}

function directSourceEdges(profile: ProjectProfile, sourceNodeIds: string[]): {
  incoming: GraphEdge[];
  outgoing: GraphEdge[];
} {
  const sourceIds = new Set(sourceNodeIds);
  return {
    incoming: profile.graph.edges.filter((edge) => sourceIds.has(edge.target)),
    outgoing: profile.graph.edges.filter((edge) => sourceIds.has(edge.source)),
  };
}

function collectNeighborNodeIds(profile: ProjectProfile, sourceNodeIds: string[], childNodeIds: string[]): string[] {
  const neighbors = new Set<string>();
  const sourceIds = new Set(sourceNodeIds);

  for (const sourceNodeId of sourceNodeIds) {
    for (const edge of [
      ...(profile.indexes.incomingEdgesByNode.get(sourceNodeId) ?? []),
      ...(profile.indexes.outgoingEdgesByNode.get(sourceNodeId) ?? []),
    ]) {
      if (!sourceIds.has(edge.source)) neighbors.add(edge.source);
      if (!sourceIds.has(edge.target)) neighbors.add(edge.target);
    }
  }

  for (const childNodeId of childNodeIds) {
    for (const edge of [
      ...(profile.indexes.incomingEdgesByNode.get(childNodeId) ?? []),
      ...(profile.indexes.outgoingEdgesByNode.get(childNodeId) ?? []),
    ]) {
      if (!sourceIds.has(edge.source) && edge.source !== childNodeId) neighbors.add(edge.source);
      if (!sourceIds.has(edge.target) && edge.target !== childNodeId) neighbors.add(edge.target);
    }
  }

  return sortedIds(neighbors);
}

function taskGraphItemCount(task: FileDocTask): number {
  return (
    task.sourceNodeIds.length +
    task.functionNodeIds.length +
    task.classNodeIds.length +
    task.incomingEdgeIds.length +
    task.outgoingEdgeIds.length +
    task.neighborNodeIds.length
  );
}

const SOURCE_NODE_TYPES = new Set(["file", "config", "schema", "document"]);
const OWNER_TYPE_RANK = new Map(["file", "config", "schema", "document"].map((type, index) => [type, index]));

function referenceKindFor(path: string, nodes: GraphNode[], owner: GraphNode): ReferenceTemplateKind {
  const normalized = path.toLowerCase();
  if (/(^|[._/-])(tests?|specs?|fixtures?)([._/-]|$)/.test(normalized)) return "test";
  if (/(^|\/)(config|configs)(\/|$)/.test(normalized)
    || /(^|[._/-])env([._/-]|$)/.test(normalized)
    || /\.(?:ya?ml|json|toml)$/.test(normalized)
    || owner.type === "config"
    || nodes.some((node) => node.type === "config")) return "configuration";
  if (owner.type === "schema" || nodes.some((node) => node.type === "schema")) return "schema";
  if (owner.type === "document" || nodes.some((node) => node.type === "document") || /\.md(?:own)?$/.test(normalized)) {
    return "documentation";
  }
  return "code";
}

function childrenForSources(profile: ProjectProfile, sourceNodeIds: string[], filePath: string): GraphNode[] {
  return sortedIds(sourceNodeIds.flatMap((sourceNodeId) => profile.indexes.fileToChildIds.get(sourceNodeId) ?? []))
    .map((nodeId) => profile.indexes.nodesById.get(nodeId))
    .filter((node): node is GraphNode => Boolean(
      node
      && (node.type === "function" || node.type === "class")
      && node.filePath
      && normalizeKnowledgeSourcePath(node.filePath) === filePath,
    ));
}

function finalizeBatch(batchIndex: number, tasks: FileDocTask[], reason: string): FileDocBatch {
  return {
    batchIndex,
    tasks,
    estimatedLines: tasks.reduce((sum, task) => sum + task.sourceSnapshot.totalLines, 0),
    estimatedGraphItems: tasks.reduce((sum, task) => sum + taskGraphItemCount(task), 0),
    reason,
  };
}

function assignBatch(tasks: FileDocTask[], batchIndex: number, reason: string): FileDocBatch {
  for (const task of tasks) {
    task.batchIndex = batchIndex;
    task.batchingReason = reason;
  }
  return finalizeBatch(batchIndex, tasks, reason);
}

function buildBatches(tasks: FileDocTask[]): FileDocBatch[] {
  const batches: FileDocBatch[] = [];
  let current: FileDocTask[] = [];
  let currentLines = 0;
  let currentGraphItems = 0;

  function flushCurrent(): void {
    if (current.length === 0) return;
    const batchIndex = batches.length + 1;
    batches.push(assignBatch(current, batchIndex, "dynamic batch sized by source lines and graph relationships"));
    current = [];
    currentLines = 0;
    currentGraphItems = 0;
  }

  for (const task of tasks) {
    if (task.sourceReadMode === "missing") {
      flushCurrent();
      const batchIndex = batches.length + 1;
      batches.push(assignBatch([task], batchIndex, "missing source isolated for explicit follow-up"));
      continue;
    }

    const taskLines = task.sourceSnapshot.totalLines;
    const taskGraphItems = taskGraphItemCount(task);
    const wouldExceedLines = current.length > 0 && currentLines + taskLines > MAX_BATCH_LINES;
    const wouldExceedGraphItems = current.length > 0 && currentGraphItems + taskGraphItems > MAX_BATCH_GRAPH_ITEMS;
    if (wouldExceedLines || wouldExceedGraphItems) {
      flushCurrent();
    }

    current.push(task);
    currentLines += taskLines;
    currentGraphItems += taskGraphItems;
  }

  flushCurrent();
  return batches;
}

export function buildFileDocPlan(profile: ProjectProfile, options: KnowledgeBaseOptions = {}): FileDocPlan {
  const sourceFiles = Object.fromEntries(Object.entries(options.sourceFiles ?? {}).map(([path, content]) => [
    normalizeKnowledgeSourcePath(path),
    content,
  ]));
  const nodesByPath = new Map<string, GraphNode[]>();
  for (const node of profile.graph.nodes) {
    if (!SOURCE_NODE_TYPES.has(node.type) || !node.filePath) continue;
    const filePath = normalizeKnowledgeSourcePath(node.filePath);
    const nodes = nodesByPath.get(filePath) ?? [];
    nodes.push(node);
    nodesByPath.set(filePath, nodes);
  }

  const pathGroups = [...nodesByPath.entries()].sort(([left], [right]) => left.localeCompare(right));
  const tasks: FileDocTask[] = pathGroups.map(([filePath, sourceNodes], taskIndex) => {
    sourceNodes.sort((left, right) =>
      (OWNER_TYPE_RANK.get(left.type) ?? Number.MAX_SAFE_INTEGER) - (OWNER_TYPE_RANK.get(right.type) ?? Number.MAX_SAFE_INTEGER)
      || left.id.localeCompare(right.id));
    const owner = sourceNodes[0];
    const sourceNodeIds = sortedIds(sourceNodes.map((node) => node.id));
    const sourceSnapshot = buildSourceSnapshot(filePath, sourceFiles);
    const sourceEdges = directSourceEdges(profile, sourceNodeIds);
    const children = childrenForSources(profile, sourceNodeIds, filePath);
    const childNodeIds = children.map((node) => node.id);

    return {
      batchIndex: PENDING_BATCH_INDEX,
      taskIndex,
      fileNodeId: owner.id,
      filePath,
      layerId: sourceNodeIds
        .map((nodeId) => profile.indexes.nodeToLayerId.get(nodeId))
        .find((layerId): layerId is string => Boolean(layerId)) ?? null,
      documentPath: fileDocumentPath(filePath),
      sourceNodeIds,
      referenceKind: referenceKindFor(filePath, sourceNodes, owner),
      functionNodeIds: children.filter((node) => node.type === "function").map((node) => node.id).sort(),
      classNodeIds: children.filter((node) => node.type === "class").map((node) => node.id).sort(),
      incomingEdgeIds: sourceEdges.incoming.map(edgeId).sort(),
      outgoingEdgeIds: sourceEdges.outgoing.map(edgeId).sort(),
      neighborNodeIds: collectNeighborNodeIds(profile, sourceNodeIds, childNodeIds),
      sourceSnapshot,
      sourceReadMode: sourceSnapshot.exists ? "full" : "missing",
      batchingReason: "pending batch assignment",
    };
  });

  return {
    tasks,
    batches: buildBatches(tasks),
    warnings: tasks
      .filter((task) => task.sourceReadMode === "missing")
      .map((task) => `${task.filePath}: ${task.sourceSnapshot.missingReason ?? "source file missing"}`),
  };
}
