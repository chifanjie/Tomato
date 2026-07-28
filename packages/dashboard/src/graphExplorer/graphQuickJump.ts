import type { GraphNode, KnowledgeGraph } from "@understand-code/core/types";
import { graphNodeTypeLabel } from "../components/graphExplorer/semanticGraphCanvasModel.js";
import { semanticGroupForNode } from "./semanticGraph.js";
import {
  boundaryNodeId,
  graphNodePlacementClass,
  normalizeGraphFilePath,
  scopeNodeId,
  type GraphExplorerNavigation,
  type GraphHierarchyCluster,
  type GraphHierarchyIndex,
  type GraphHierarchyScope,
} from "./hierarchicalGraph.js";

export type GraphQuickJumpKind =
  | "capability"
  | "flow"
  | "scope"
  | "boundary"
  | "cluster"
  | "file"
  | "symbol"
  | "raw";

export interface GraphNavigationIntent {
  source: "quick-jump" | "wiki-focus";
  navigation: GraphExplorerNavigation;
  materializedNodeId: string;
  selectionId: string;
}

export interface GraphQuickJumpItem {
  id: string;
  kind: GraphQuickJumpKind;
  label: string;
  path: string | null;
  typeLabel: string;
  intent: GraphNavigationIntent;
}

export interface GraphQuickJumpIndex {
  items: readonly GraphQuickJumpItem[];
  resolve(input: {
    objectId: string;
    source: GraphNavigationIntent["source"];
  }): GraphNavigationIntent | null;
}

interface BoundaryDescriptor {
  currentScopeId: string;
  targetScopeId: string;
}

interface QuickJumpContext {
  graphNodeById: ReadonlyMap<string, GraphNode>;
  scopeByRenderedId: ReadonlyMap<string, GraphHierarchyScope>;
  validScopeById: ReadonlyMap<string, GraphHierarchyScope>;
  validClusterById: ReadonlyMap<string, GraphHierarchyCluster>;
  scopeNodeIdsById: ReadonlyMap<string, ReadonlySet<string>>;
  clusterNodeIdsById: ReadonlyMap<string, ReadonlySet<string>>;
  clusterFileIdsById: ReadonlyMap<string, ReadonlySet<string>>;
  boundariesById: ReadonlyMap<string, BoundaryDescriptor>;
}

const CLUSTER_TYPE_LABEL = {
  package: "包",
  directory: "目录",
  unlocated: "未定位结构",
} as const;

function compareItems(left: GraphQuickJumpItem, right: GraphQuickJumpItem): number {
  return left.label.localeCompare(right.label, "zh-CN") || left.id.localeCompare(right.id);
}

function buildQuickJumpContext(
  graph: KnowledgeGraph,
  hierarchyIndex: GraphHierarchyIndex,
): QuickJumpContext {
  const graphNodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const scopeByRenderedId = new Map<string, GraphHierarchyScope>();
  const validScopeById = new Map<string, GraphHierarchyScope>();
  const scopeClusterIdsById = new Map<string, ReadonlySet<string>>();
  const scopeNodeIdsById = new Map<string, ReadonlySet<string>>();
  for (const scope of hierarchyIndex.scopes) {
    if (!hierarchyIndex.scopeById.has(scope.id)) continue;
    validScopeById.set(scope.id, scope);
    scopeByRenderedId.set(scopeNodeId(scope.id), scope);
    scopeClusterIdsById.set(scope.id, new Set(scope.clusterIds));
    scopeNodeIdsById.set(scope.id, new Set(scope.nodeIds));
  }
  const validClusterById = new Map<string, GraphHierarchyCluster>();
  const clusterNodeIdsById = new Map<string, ReadonlySet<string>>();
  const clusterFileIdsById = new Map<string, ReadonlySet<string>>();
  for (const cluster of hierarchyIndex.clusterById.values()) {
    if (!validScopeById.has(cluster.scopeId)
      || !scopeClusterIdsById.get(cluster.scopeId)?.has(cluster.id)) continue;
    validClusterById.set(cluster.id, cluster);
    clusterNodeIdsById.set(cluster.id, new Set(cluster.nodeIds));
    clusterFileIdsById.set(cluster.id, new Set(cluster.fileIds));
  }
  const boundariesById = new Map<string, BoundaryDescriptor>();
  for (const edge of graph.edges) {
    if (!graphNodeById.has(edge.source)
      || !graphNodeById.has(edge.target)
      || !hierarchyIndex.nodeById.has(edge.source)
      || !hierarchyIndex.nodeById.has(edge.target)) continue;
    const sourceScopeId = hierarchyIndex.nodeLocationById.get(edge.source)?.scopeId;
    const targetScopeId = hierarchyIndex.nodeLocationById.get(edge.target)?.scopeId;
    if (!sourceScopeId || !targetScopeId || sourceScopeId === targetScopeId) continue;
    if (!validScopeById.has(sourceScopeId)
      || !validScopeById.has(targetScopeId)
      || !scopeNodeIdsById.get(sourceScopeId)?.has(edge.source)
      || !scopeNodeIdsById.get(targetScopeId)?.has(edge.target)) continue;
    boundariesById.set(boundaryNodeId(sourceScopeId, targetScopeId), {
      currentScopeId: sourceScopeId,
      targetScopeId,
    });
    boundariesById.set(boundaryNodeId(targetScopeId, sourceScopeId), {
      currentScopeId: targetScopeId,
      targetScopeId: sourceScopeId,
    });
  }
  return {
    graphNodeById,
    scopeByRenderedId,
    validScopeById,
    validClusterById,
    scopeNodeIdsById,
    clusterNodeIdsById,
    clusterFileIdsById,
    boundariesById,
  };
}

function intentForObject(
  objectId: string,
  source: GraphNavigationIntent["source"],
  hierarchyIndex: GraphHierarchyIndex,
  context: QuickJumpContext,
): GraphNavigationIntent | null {
  const scope = context.scopeByRenderedId.get(objectId);
  if (scope) {
    return {
      source,
      navigation: { level: "overview" },
      materializedNodeId: objectId,
      selectionId: objectId,
    };
  }

  const cluster = context.validClusterById.get(objectId);
  if (cluster) {
    return {
      source,
      navigation: { level: "scope", scopeId: cluster.scopeId },
      materializedNodeId: objectId,
      selectionId: objectId,
    };
  }

  const boundary = context.boundariesById.get(objectId);
  if (boundary
    && context.validScopeById.has(boundary.currentScopeId)
    && context.validScopeById.has(boundary.targetScopeId)) {
    return {
      source,
      navigation: { level: "scope", scopeId: boundary.currentScopeId },
      materializedNodeId: objectId,
      selectionId: objectId,
    };
  }

  const node = context.graphNodeById.get(objectId);
  if (!node || !hierarchyIndex.nodeById.has(objectId)) return null;
  const location = hierarchyIndex.nodeLocationById.get(objectId);
  const parentScope = location ? context.validScopeById.get(location.scopeId) : null;
  if (!location || !parentScope || !context.scopeNodeIdsById.get(location.scopeId)?.has(objectId)) return null;

  if (node.type === "file") {
    const fileLocation = hierarchyIndex.fileLocationById.get(objectId);
    const parentCluster = fileLocation ? context.validClusterById.get(fileLocation.clusterId) : null;
    if (!fileLocation
      || fileLocation.fileId !== objectId
      || fileLocation.scopeId !== location.scopeId
      || fileLocation.clusterId !== location.clusterId
      || !parentCluster
      || !context.clusterFileIdsById.get(parentCluster.id)?.has(objectId)
      || !context.clusterNodeIdsById.get(parentCluster.id)?.has(objectId)) return null;
    return {
      source,
      navigation: {
        level: "cluster",
        scopeId: fileLocation.scopeId,
        clusterId: fileLocation.clusterId,
      },
      materializedNodeId: objectId,
      selectionId: objectId,
    };
  }

  if (location.fileId) {
    const canonicalFile = context.graphNodeById.get(location.fileId);
    const fileLocation = hierarchyIndex.fileLocationById.get(location.fileId);
    const parentCluster = fileLocation ? context.validClusterById.get(fileLocation.clusterId) : null;
    if (canonicalFile?.type !== "file"
      || !fileLocation
      || fileLocation.scopeId !== location.scopeId
      || fileLocation.clusterId !== location.clusterId
      || fileLocation.fileId !== location.fileId
      || !parentCluster
      || !context.clusterFileIdsById.get(parentCluster.id)?.has(location.fileId)
      || !context.clusterNodeIdsById.get(parentCluster.id)?.has(objectId)) return null;
    return {
      source,
      navigation: {
        level: "file",
        scopeId: fileLocation.scopeId,
        clusterId: fileLocation.clusterId,
        fileId: fileLocation.fileId,
      },
      materializedNodeId: objectId,
      selectionId: objectId,
    };
  }

  if (location.clusterId) {
    const parentCluster = context.validClusterById.get(location.clusterId);
    if (!parentCluster
      || parentCluster.scopeId !== location.scopeId
      || !context.clusterNodeIdsById.get(parentCluster.id)?.has(objectId)) return null;
    return {
      source,
      navigation: {
        level: "cluster",
        scopeId: location.scopeId,
        clusterId: location.clusterId,
      },
      materializedNodeId: objectId,
      selectionId: objectId,
    };
  }

  if (graphNodePlacementClass(node.type) !== "architecture-context") return null;
  return {
    source,
    navigation: { level: "scope", scopeId: location.scopeId },
    materializedNodeId: objectId,
    selectionId: objectId,
  };
}

export function resolveGraphNavigationIntent(input: {
  objectId: string;
  source: GraphNavigationIntent["source"];
  graph: KnowledgeGraph;
  hierarchyIndex: GraphHierarchyIndex;
}): GraphNavigationIntent | null {
  return intentForObject(
    input.objectId,
    input.source,
    input.hierarchyIndex,
    buildQuickJumpContext(input.graph, input.hierarchyIndex),
  );
}

function rawKind(node: GraphNode): GraphQuickJumpKind {
  if (node.type === "file") return "file";
  if (node.type === "function" || node.type === "class") return "symbol";
  const group = semanticGroupForNode(node);
  if (group === "flow") return "flow";
  if (group === "capability") return "capability";
  return "raw";
}

function buildGraphQuickJumpItemsFromContext(input: {
  graph: KnowledgeGraph;
  hierarchyIndex: GraphHierarchyIndex;
  context: QuickJumpContext;
}): GraphQuickJumpItem[] {
  const { graph, hierarchyIndex, context } = input;
  const items: GraphQuickJumpItem[] = [];
  const push = (
    item: Omit<GraphQuickJumpItem, "intent">,
  ): void => {
    const intent = intentForObject(item.id, "quick-jump", hierarchyIndex, context);
    if (intent) items.push({ ...item, intent });
  };

  for (const scope of hierarchyIndex.scopes) {
    push({
      id: scopeNodeId(scope.id),
      kind: "scope",
      label: scope.label,
      path: scope.normalizedRoot || null,
      typeLabel: "模块",
    });
  }
  for (const cluster of hierarchyIndex.clusterById.values()) {
    push({
      id: cluster.id,
      kind: "cluster",
      label: cluster.label,
      path: cluster.normalizedRelativePath,
      typeLabel: CLUSTER_TYPE_LABEL[cluster.kind],
    });
  }
  for (const [id, boundary] of context.boundariesById) {
    const current = hierarchyIndex.scopeById.get(boundary.currentScopeId);
    const target = hierarchyIndex.scopeById.get(boundary.targetScopeId);
    if (!current || !target) continue;
    push({
      id,
      kind: "boundary",
      label: `${current.label} → ${target.label}`,
      path: null,
      typeLabel: "外部边界",
    });
  }
  for (const node of graph.nodes) {
    push({
      id: node.id,
      kind: rawKind(node),
      label: node.name,
      path: node.filePath ? normalizeGraphFilePath(node.filePath) : null,
      typeLabel: graphNodeTypeLabel(node.type),
    });
  }

  const unique = new Map<string, GraphQuickJumpItem>();
  for (const item of items) if (!unique.has(item.id)) unique.set(item.id, item);
  return [...unique.values()].sort(compareItems);
}

export function buildGraphQuickJumpIndex(input: {
  graph: KnowledgeGraph;
  hierarchyIndex: GraphHierarchyIndex;
}): GraphQuickJumpIndex {
  const { graph, hierarchyIndex } = input;
  const context = buildQuickJumpContext(graph, hierarchyIndex);
  return {
    items: buildGraphQuickJumpItemsFromContext({ graph, hierarchyIndex, context }),
    resolve: ({ objectId, source }) =>
      intentForObject(objectId, source, hierarchyIndex, context),
  };
}

export function buildGraphQuickJumpItems(input: {
  graph: KnowledgeGraph;
  hierarchyIndex: GraphHierarchyIndex;
}): GraphQuickJumpItem[] {
  return [...buildGraphQuickJumpIndex(input).items];
}

function normalizeSearchValue(value: string): string {
  return value
    .replace(/\\/g, "/")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");
}

export function searchGraphQuickJump(
  items: readonly GraphQuickJumpItem[],
  query: string,
  limit = 30,
): GraphQuickJumpItem[] {
  const normalizedQuery = normalizeSearchValue(query);
  const stable = [...items].sort(compareItems);
  if (!normalizedQuery) return stable.slice(0, Math.max(0, limit));
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  return stable
    .map((item) => {
      const fields = [item.id, item.label, item.path ?? "", item.typeLabel].map(normalizeSearchValue);
      const combined = fields.join(" ");
      const score = fields.includes(normalizedQuery)
        ? 0
        : fields.some((field) => field.startsWith(normalizedQuery))
          ? 1
          : tokens.every((token) => combined.includes(token))
            ? 2
            : null;
      return { item, score };
    })
    .filter((entry): entry is { item: GraphQuickJumpItem; score: number } => entry.score !== null)
    .sort((left, right) => left.score - right.score || compareItems(left.item, right.item))
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.item);
}
