import type { GraphEdge, GraphNode } from "../types.js";
import type { FileDocBatch, FileDocPlan, FileDocTask, KnowledgeBaseOptions, ProjectProfile } from "./types.js";
import { fileDocumentPath } from "./paths.js";
import { buildSourceSnapshot } from "./source-snapshot.js";

const MAX_BATCH_LINES = 1_600;
const MAX_BATCH_GRAPH_ITEMS = 120;

export function edgeId(edge: GraphEdge): string {
  return `${edge.type}:${edge.source}->${edge.target}`;
}

function sortedIds(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort();
}

function filePathForNode(node: GraphNode): string {
  return node.filePath ?? node.name ?? node.id;
}

function directFileEdges(profile: ProjectProfile, fileNodeId: string): {
  incoming: GraphEdge[];
  outgoing: GraphEdge[];
} {
  return {
    incoming: profile.indexes.incomingEdgesByNode.get(fileNodeId) ?? [],
    outgoing: profile.indexes.outgoingEdgesByNode.get(fileNodeId) ?? [],
  };
}

function collectNeighborNodeIds(profile: ProjectProfile, fileNodeId: string): string[] {
  const neighbors = new Set<string>();
  const childNodeIds = profile.indexes.fileToChildIds.get(fileNodeId) ?? [];

  for (const edge of [
    ...(profile.indexes.incomingEdgesByNode.get(fileNodeId) ?? []),
    ...(profile.indexes.outgoingEdgesByNode.get(fileNodeId) ?? []),
  ]) {
    if (edge.source !== fileNodeId) neighbors.add(edge.source);
    if (edge.target !== fileNodeId) neighbors.add(edge.target);
  }

  for (const childNodeId of childNodeIds) {
    for (const edge of [
      ...(profile.indexes.incomingEdgesByNode.get(childNodeId) ?? []),
      ...(profile.indexes.outgoingEdgesByNode.get(childNodeId) ?? []),
    ]) {
      if (edge.source !== childNodeId) neighbors.add(edge.source);
      if (edge.target !== childNodeId) neighbors.add(edge.target);
    }
  }

  neighbors.delete(fileNodeId);
  return sortedIds(neighbors);
}

function taskGraphItemCount(task: FileDocTask): number {
  return (
    1 +
    task.functionNodeIds.length +
    task.classNodeIds.length +
    task.incomingEdgeIds.length +
    task.outgoingEdgeIds.length +
    task.neighborNodeIds.length
  );
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
    const batchIndex = batches.length;
    batches.push(assignBatch(current, batchIndex, "dynamic batch sized by source lines and graph relationships"));
    current = [];
    currentLines = 0;
    currentGraphItems = 0;
  }

  for (const task of tasks) {
    if (task.sourceReadMode === "missing") {
      flushCurrent();
      const batchIndex = batches.length;
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
  const sourceFiles = options.sourceFiles ?? {};
  const fileNodes = profile.graph.nodes
    .filter((node) => node.type === "file")
    .sort((a, b) => filePathForNode(a).localeCompare(filePathForNode(b)) || a.id.localeCompare(b.id));

  const tasks: FileDocTask[] = fileNodes.map((fileNode, taskIndex) => {
    const filePath = filePathForNode(fileNode);
    const sourceSnapshot = buildSourceSnapshot(filePath, sourceFiles);
    const fileEdges = directFileEdges(profile, fileNode.id);

    return {
      batchIndex: 0,
      taskIndex,
      fileNodeId: fileNode.id,
      filePath,
      layerId: profile.indexes.nodeToLayerId.get(fileNode.id) ?? null,
      documentPath: fileDocumentPath(filePath),
      functionNodeIds: sortedIds(profile.indexes.fileToFunctionIds.get(fileNode.id) ?? []),
      classNodeIds: sortedIds(profile.indexes.fileToClassIds.get(fileNode.id) ?? []),
      incomingEdgeIds: fileEdges.incoming.map(edgeId).sort(),
      outgoingEdgeIds: fileEdges.outgoing.map(edgeId).sort(),
      neighborNodeIds: collectNeighborNodeIds(profile, fileNode.id),
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
