import type { GraphNode, KnowledgeGraph, NodeType } from "@understand-code/core/types";
import type { WikiRuntimeIndex } from "../wiki/wikiIndex";
import {
  buildSemanticGraph,
  semanticGroupForNode,
  type DocumentationCounts,
  type GraphExplorerMode,
  type SemanticGraph,
  type SemanticGraphDocMetadataV2,
  type SemanticGraphEdge,
  type SemanticGraphEdgeMember,
  type SemanticGraphNode,
  type SemanticNodeGroup,
} from "./semanticGraph";

export type GraphExplorerDisplayMode = "architecture" | "call" | "coverage";
export type GraphRelationshipSource = "calls" | "imports" | "dependencies";
export type GraphNavigationLevel = "overview" | "scope" | "cluster" | "file";

export interface GraphExplorerNavigation {
  level: GraphNavigationLevel;
  scopeId?: string;
  clusterId?: string;
  fileId?: string;
}

export type GraphClusterKind = "directory" | "package" | "unlocated";
export type GraphNodePlacementClass = "file" | "file-leaf" | "architecture-context";

export interface GraphProtectedRoot {
  kind: "package" | "workspace";
  normalizedPath: string;
  manifestNodeId: string;
}

export interface GraphHierarchyScope {
  id: string;
  label: string;
  description: string;
  normalizedRoot: string;
  protectedRoots: readonly GraphProtectedRoot[];
  clusterIds: readonly string[];
  nodeIds: readonly string[];
  order: number;
}

export interface GraphHierarchyCluster {
  id: string;
  scopeId: string;
  kind: GraphClusterKind;
  normalizedRelativePath: string | null;
  label: string;
  fileIds: readonly string[];
  nodeIds: readonly string[];
}

export interface GraphHierarchyLocation {
  scopeId: string;
  clusterId?: string;
  fileId?: string;
}

export interface GraphHierarchyIndex {
  scopes: readonly GraphHierarchyScope[];
  scopeById: ReadonlyMap<string, GraphHierarchyScope>;
  clusterById: ReadonlyMap<string, GraphHierarchyCluster>;
  nodeLocationById: ReadonlyMap<string, GraphHierarchyLocation>;
  fileLocationById: ReadonlyMap<string, GraphHierarchyLocation & { clusterId: string; fileId: string }>;
  symbolLocationById: ReadonlyMap<string, GraphHierarchyLocation>;
  fileIdByNormalizedPath: ReadonlyMap<string, string>;
  nodeById: ReadonlyMap<string, GraphNode>;
}

export interface GraphScopeOption {
  id: string;
  label: string;
  description: string;
  nodeCount: number;
  fileCount: number;
  documentationCounts: DocumentationCounts;
}

export interface GraphBreadcrumbItem {
  level: GraphNavigationLevel;
  label: string;
  scopeId?: string;
  clusterId?: string;
  fileId?: string;
}

export interface HierarchicalGraphPresentation {
  displayMode: GraphExplorerDisplayMode;
  level: GraphNavigationLevel;
  relationshipSource: GraphRelationshipSource;
  scopeId: string | null;
  clusterId: string | null;
  fileId: string | null;
  scopeOptions: GraphScopeOption[];
  breadcrumbs: GraphBreadcrumbItem[];
  totalNodeCount: number;
  hiddenNodeCount: number;
  focusApplied: boolean;
  notice: string | null;
}

export interface HierarchicalSemanticGraphNode extends SemanticGraphNode {
  kind?: "node" | "scope" | "boundary" | "cluster";
  scopeId?: string;
  clusterId?: string;
  clusterKind?: GraphClusterKind;
  containedNodeIds?: string[];
  childCount?: number;
  fileCount?: number;
  relationCount?: number;
  canDrillDown?: boolean;
}

export interface HierarchicalSemanticGraphEdge extends SemanticGraphEdge {
  boundaryContext?: {
    currentScopeId: string;
    targetScopeId: string;
  };
}

export interface HierarchicalSemanticGraph extends Omit<SemanticGraph, "nodes" | "edges"> {
  nodes: HierarchicalSemanticGraphNode[];
  edges: HierarchicalSemanticGraphEdge[];
  presentation: HierarchicalGraphPresentation;
}

export interface HierarchicalGraphSelectionExpansion {
  nodes: HierarchicalSemanticGraphNode[];
  edges: HierarchicalSemanticGraphEdge[];
}

export interface BuildHierarchicalGraphInput {
  graph: KnowledgeGraph;
  hierarchyIndex: GraphHierarchyIndex;
  wikiIndex?: WikiRuntimeIndex;
  mode: GraphExplorerMode;
  navigation: GraphExplorerNavigation;
  materializedNodeId: string | null;
}

interface InternalScope {
  id: string;
  label: string;
  description: string;
  nodeIds: string[];
  order: number;
}

const MAX_OVERVIEW_SCOPES = 16;
const MAX_OVERVIEW_ARCHITECTURE = 24;
const MAX_SCOPE_CLUSTERS = 24;
const MAX_CLUSTER_FILES = 30;
const MAX_CLUSTER_FILELESS_LEAVES = 12;
const MAX_FILE_NODES = 38;
const MAX_BOUNDARY_SCOPES = 8;
const MAX_VISIBLE_EDGES = 100;

const DEPENDENCY_EDGE_TYPES = new Set<SemanticGraphEdgeMember["type"]>([
  "imports",
  "exports",
  "inherits",
  "implements",
  "depends_on",
  "reads_from",
  "writes_to",
  "transforms",
  "validates",
  "subscribes",
  "publishes",
  "middleware",
  "configures",
  "deploys",
  "serves",
  "provisions",
  "triggers",
  "migrates",
  "routes",
  "defines_schema",
  "contains_flow",
  "flow_step",
  "cross_domain",
]);

const GROUP_LABELS: Record<SemanticNodeGroup, string> = {
  capability: "业务能力",
  flow: "业务流程",
  module: "模块",
  file: "代码文件",
  symbol: "函数与类型",
  document: "知识文档",
  data: "数据模型",
  infra: "服务与基础设施",
  other: "其他",
};

const NODE_PLACEMENT_CLASS = {
  file: "file",
  function: "file-leaf",
  class: "file-leaf",
  config: "file-leaf",
  module: "architecture-context",
  concept: "architecture-context",
  document: "architecture-context",
  service: "architecture-context",
  table: "architecture-context",
  endpoint: "architecture-context",
  pipeline: "architecture-context",
  schema: "architecture-context",
  resource: "architecture-context",
  domain: "architecture-context",
  flow: "architecture-context",
  step: "architecture-context",
  article: "architecture-context",
  entity: "architecture-context",
  topic: "architecture-context",
  claim: "architecture-context",
  source: "architecture-context",
} as const satisfies Record<NodeType, GraphNodePlacementClass>;

const PACKAGE_MANIFEST_NAMES = [
  "package.json",
  "go.mod",
  "Cargo.toml",
  "pyproject.toml",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
] as const;
const PACKAGE_MANIFEST_PRIORITY = new Map<string, number>(
  PACKAGE_MANIFEST_NAMES.map((name, index) => [name, index]),
);
const WORKSPACE_MANIFEST_NAMES = new Set([
  "pnpm-workspace.yaml",
  "pnpm-workspace.yml",
  "lerna.json",
  "rush.json",
  "nx.json",
]);

interface MutableHierarchyCluster {
  id: string;
  scopeId: string;
  kind: GraphClusterKind;
  normalizedRelativePath: string | null;
  label: string;
  fileIds: Set<string>;
  nodeIds: Set<string>;
}

function compareStable(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function normalizeGraphFilePath(filePath: string): string {
  const segments: string[] = [];
  for (const segment of filePath.replace(/\\/g, "/").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (segments.length > 0) segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join("/");
}

export function graphNodePlacementClass(type: NodeType): GraphNodePlacementClass {
  return NODE_PLACEMENT_CLASS[type];
}

export function scopeNodeId(scopeId: string): string {
  return `scope:${encodeURIComponent(scopeId)}`;
}

export function clusterNodeId(
  scopeId: string,
  relativePath: string | null,
  kind: GraphClusterKind,
): string {
  if (relativePath === null) {
    if (kind === "package") throw new Error("package cluster requires a normalized path");
    return `cluster:${encodeURIComponent(scopeId)}:${kind === "directory" ? "__root__" : "__unlocated__"}`;
  }
  return `cluster:${encodeURIComponent(scopeId)}:${encodeURIComponent(normalizeGraphFilePath(relativePath))}`;
}

export function boundaryNodeId(currentScopeId: string, targetScopeId: string): string {
  return `boundary:${encodeURIComponent(currentScopeId)}:${encodeURIComponent(targetScopeId)}`;
}

function normalizedDirname(filePath: string): string {
  const normalized = normalizeGraphFilePath(filePath);
  const separator = normalized.lastIndexOf("/");
  return separator < 0 ? "" : normalized.slice(0, separator);
}

function normalizedBasename(filePath: string): string {
  const normalized = normalizeGraphFilePath(filePath);
  const separator = normalized.lastIndexOf("/");
  return separator < 0 ? normalized : normalized.slice(separator + 1);
}

function isAtOrBelowPath(filePath: string, rootPath: string): boolean {
  return rootPath === "" || filePath === rootPath || filePath.startsWith(`${rootPath}/`);
}

function commonPathSegmentCount(left: string, right: string): number {
  const leftSegments = left.split("/").filter(Boolean);
  const rightSegments = right.split("/").filter(Boolean);
  let index = 0;
  while (index < leftSegments.length && leftSegments[index] === rightSegments[index]) index += 1;
  return index;
}

function commonDirectoryRoot(filePaths: readonly string[], protectedRoots: readonly GraphProtectedRoot[]): string {
  if (filePaths.length === 0) return "";
  const directories = filePaths.map(normalizedDirname);
  const first = directories[0].split("/").filter(Boolean);
  let prefixLength = first.length;
  for (const directory of directories.slice(1)) {
    const segments = directory.split("/").filter(Boolean);
    prefixLength = Math.min(prefixLength, commonPathSegmentCount(first.join("/"), segments.join("/")));
  }
  let root = first.slice(0, prefixLength).join("/");
  const containingPackage = protectedRoots
    .filter((item) => item.kind === "package" && isAtOrBelowPath(root, item.normalizedPath))
    .sort((left, right) => left.normalizedPath.length - right.normalizedPath.length
      || compareStable(left.normalizedPath, right.normalizedPath))[0];
  if (containingPackage) root = normalizedDirname(containingPackage.normalizedPath);
  return root;
}

function protectedRootsForNodes(nodes: readonly GraphNode[]): GraphProtectedRoot[] {
  const evidence = nodes
    .filter((node) => node.filePath !== undefined)
    .map((node) => ({
      nodeId: node.id,
      path: normalizeGraphFilePath(node.filePath!),
      dirname: normalizedDirname(node.filePath!),
      basename: normalizedBasename(node.filePath!),
    }));
  const explicitWorkspace = evidence
    .filter((item) => WORKSPACE_MANIFEST_NAMES.has(item.basename))
    .sort((left, right) => compareStable(left.nodeId, right.nodeId))[0];
  const rootPackage = evidence
    .filter((item) => item.dirname === "" && PACKAGE_MANIFEST_PRIORITY.has(item.basename))
    .sort((left, right) => compareStable(left.nodeId, right.nodeId))[0];
  const roots: GraphProtectedRoot[] = [];
  const workspaceEvidence = explicitWorkspace ?? rootPackage;
  if (workspaceEvidence) {
    roots.push({ kind: "workspace", normalizedPath: "", manifestNodeId: workspaceEvidence.nodeId });
  }

  const packages = new Map<string, typeof evidence>();
  for (const item of evidence) {
    if (item.dirname === "" || !PACKAGE_MANIFEST_PRIORITY.has(item.basename)) continue;
    const current = packages.get(item.dirname) ?? [];
    current.push(item);
    packages.set(item.dirname, current);
  }
  for (const [normalizedPath, candidates] of [...packages.entries()].sort(([left], [right]) => compareStable(left, right))) {
    const manifest = candidates.sort((left, right) =>
      (PACKAGE_MANIFEST_PRIORITY.get(left.basename) ?? Number.MAX_SAFE_INTEGER)
      - (PACKAGE_MANIFEST_PRIORITY.get(right.basename) ?? Number.MAX_SAFE_INTEGER)
      || compareStable(left.nodeId, right.nodeId))[0];
    roots.push({ kind: "package", normalizedPath, manifestNodeId: manifest.nodeId });
  }
  return roots;
}

function stableHierarchyInput(graph: KnowledgeGraph): KnowledgeGraph {
  return {
    ...graph,
    nodes: [...graph.nodes].sort((left, right) => compareStable(left.id, right.id)),
    edges: [...graph.edges].sort((left, right) =>
      compareStable(`${left.source}\u0000${left.type}\u0000${left.target}`, `${right.source}\u0000${right.type}\u0000${right.target}`)),
    layers: graph.layers.map((layer) => ({
      ...layer,
      nodeIds: [...layer.nodeIds].sort(compareStable),
    })),
  };
}

function bestScopeForPath(
  filePath: string,
  scopes: readonly InternalScope[],
  filePathsByScope: ReadonlyMap<string, readonly string[]>,
): string | null {
  const directory = normalizedDirname(filePath);
  const ranked = scopes.map((scope) => ({
    scope,
    score: Math.max(0, ...(filePathsByScope.get(scope.id) ?? []).map((path) =>
      normalizedDirname(path) === "" ? 0.5 : commonPathSegmentCount(directory, normalizedDirname(path)))),
  })).sort((left, right) => right.score - left.score
    || left.scope.order - right.scope.order
    || compareStable(left.scope.id, right.scope.id));
  return ranked[0] && ranked[0].score > 0 ? ranked[0].scope.id : null;
}

function clusterPathForFile(
  filePath: string,
  scopeRoot: string,
  protectedRoots: readonly GraphProtectedRoot[],
): { kind: "directory" | "package"; relativePath: string | null } {
  const packageRoot = protectedRoots
    .filter((root) => root.kind === "package" && isAtOrBelowPath(filePath, root.normalizedPath))
    .sort((left, right) => right.normalizedPath.length - left.normalizedPath.length
      || compareStable(left.normalizedPath, right.normalizedPath))[0];
  if (packageRoot) return { kind: "package", relativePath: packageRoot.normalizedPath };

  const directory = normalizedDirname(filePath);
  if (directory === scopeRoot) return { kind: "directory", relativePath: null };
  const rootSegments = scopeRoot.split("/").filter(Boolean);
  const directorySegments = directory.split("/").filter(Boolean);
  const child = directorySegments.slice(0, rootSegments.length + 1).join("/");
  return { kind: "directory", relativePath: child || null };
}

function hierarchyClusterLabel(kind: GraphClusterKind, relativePath: string | null): string {
  if (kind === "unlocated") return "未定位结构对象";
  if (relativePath === null) return "根目录文件";
  return normalizedBasename(relativePath);
}

function compareHierarchyClusters(left: MutableHierarchyCluster, right: MutableHierarchyCluster): number {
  const rank = (cluster: MutableHierarchyCluster): number => {
    if (cluster.kind === "directory" && cluster.normalizedRelativePath === null) return 0;
    if (cluster.kind === "package") return 1;
    if (cluster.kind === "directory") return 2;
    return 3;
  };
  return rank(left) - rank(right)
    || compareStable(left.normalizedRelativePath ?? "", right.normalizedRelativePath ?? "")
    || compareStable(left.id, right.id);
}

export function buildGraphHierarchyIndex(graph: KnowledgeGraph): GraphHierarchyIndex {
  const stableGraph = stableHierarchyInput(graph);
  const nodeById = new Map(stableGraph.nodes.map((node) => [node.id, node]));
  const fileNodes = stableGraph.nodes.filter((node) => node.type === "file");
  const fileNodeIds = new Set(fileNodes.map((node) => node.id));
  const fileIdByNormalizedPath = new Map<string, string>();
  for (const file of fileNodes) {
    if (file.filePath === undefined) continue;
    const path = normalizeGraphFilePath(file.filePath);
    if (!fileIdByNormalizedPath.has(path)) fileIdByNormalizedPath.set(path, file.id);
  }

  const { scopes: derivedScopes, nodeToScopeId: derivedNodeToScopeId } = deriveScopes(stableGraph);
  const scopes = [...derivedScopes].sort((left, right) => left.order - right.order || compareStable(left.id, right.id));
  const filePathsByScope = new Map<string, string[]>();
  for (const file of fileNodes) {
    const scopeId = derivedNodeToScopeId.get(file.id);
    if (!scopeId || file.filePath === undefined) continue;
    const paths = filePathsByScope.get(scopeId) ?? [];
    paths.push(normalizeGraphFilePath(file.filePath));
    filePathsByScope.set(scopeId, paths);
  }

  const nodeScopeId = new Map(derivedNodeToScopeId);
  const layerScopeOrder = new Map(
    stableGraph.layers.map((layer, order) => [`layer:${layer.id}`, order]),
  );
  const explicitlyLayeredNodeIds = new Set(stableGraph.layers.flatMap((layer) => layer.nodeIds));
  const containingSourceIdsByNode = new Map<string, string[]>();
  const containingFileIdByNode = new Map<string, string>();
  for (const edge of stableGraph.edges) {
    if (edge.type !== "contains") continue;
    const sources = containingSourceIdsByNode.get(edge.target) ?? [];
    sources.push(edge.source);
    containingSourceIdsByNode.set(edge.target, sources);
    if (!fileNodeIds.has(edge.source)) continue;
    const currentFileId = containingFileIdByNode.get(edge.target);
    if (!currentFileId || compareStable(edge.source, currentFileId) < 0) {
      containingFileIdByNode.set(edge.target, edge.source);
    }
  }
  const compareLayerScopes = (left: string, right: string): number =>
    (layerScopeOrder.get(left) ?? Number.MAX_SAFE_INTEGER)
      - (layerScopeOrder.get(right) ?? Number.MAX_SAFE_INTEGER)
    || compareStable(left, right);
  for (const node of stableGraph.nodes) {
    if (node.filePath !== undefined
      || explicitlyLayeredNodeIds.has(node.id)
      || graphNodePlacementClass(node.type) !== "architecture-context") continue;
    let containingLayerScope: string | undefined;
    for (const sourceId of containingSourceIdsByNode.get(node.id) ?? []) {
      const scopeId = nodeScopeId.get(sourceId);
      if (!scopeId || !layerScopeOrder.has(scopeId)) continue;
      if (!containingLayerScope || compareLayerScopes(scopeId, containingLayerScope) < 0) {
        containingLayerScope = scopeId;
      }
    }
    if (containingLayerScope) nodeScopeId.set(node.id, containingLayerScope);
  }
  for (const node of stableGraph.nodes) {
    if (node.type === "file" || node.filePath === undefined) continue;
    const currentScopeId = nodeScopeId.get(node.id);
    if (currentScopeId && layerScopeOrder.has(currentScopeId)) continue;
    const normalizedPath = normalizeGraphFilePath(node.filePath);
    const matchingFileId = fileIdByNormalizedPath.get(normalizedPath);
    const matchingFileScope = matchingFileId ? nodeScopeId.get(matchingFileId) : null;
    const pathScope = matchingFileScope
      ?? bestScopeForPath(normalizedPath, scopes, filePathsByScope);
    if (pathScope) nodeScopeId.set(node.id, pathScope);
  }

  const scopeNodes = new Map<string, GraphNode[]>();
  for (const node of stableGraph.nodes) {
    const scopeId = nodeScopeId.get(node.id);
    if (!scopeId) continue;
    const nodes = scopeNodes.get(scopeId) ?? [];
    nodes.push(node);
    scopeNodes.set(scopeId, nodes);
  }
  const rootsByScope = new Map<string, GraphProtectedRoot[]>();
  const rootPathByScope = new Map<string, string>();
  const graphProtectedRoots = protectedRootsForNodes(stableGraph.nodes);
  for (const scope of scopes) {
    const nodes = scopeNodes.get(scope.id) ?? [];
    const filePaths = nodes
      .filter((node) => node.type === "file" && node.filePath !== undefined)
      .map((node) => normalizeGraphFilePath(node.filePath!));
    const protectedRoots = graphProtectedRoots.filter((root) => root.kind === "workspace"
      ? filePaths.length > 0
      : filePaths.some((filePath) => isAtOrBelowPath(filePath, root.normalizedPath)));
    rootsByScope.set(scope.id, protectedRoots);
    rootPathByScope.set(scope.id, commonDirectoryRoot(filePaths, protectedRoots));
  }

  const mutableClusters = new Map<string, MutableHierarchyCluster>();
  const clusterForPath = (scopeId: string, filePath: string): MutableHierarchyCluster => {
    const placement = clusterPathForFile(
      normalizeGraphFilePath(filePath),
      rootPathByScope.get(scopeId) ?? "",
      rootsByScope.get(scopeId) ?? [],
    );
    const id = clusterNodeId(scopeId, placement.relativePath, placement.kind);
    let cluster = mutableClusters.get(id);
    if (!cluster) {
      cluster = {
        id,
        scopeId,
        kind: placement.kind,
        normalizedRelativePath: placement.relativePath,
        label: hierarchyClusterLabel(placement.kind, placement.relativePath),
        fileIds: new Set(),
        nodeIds: new Set(),
      };
      mutableClusters.set(id, cluster);
    }
    return cluster;
  };
  const unlocatedCluster = (scopeId: string): MutableHierarchyCluster => {
    const id = clusterNodeId(scopeId, null, "unlocated");
    let cluster = mutableClusters.get(id);
    if (!cluster) {
      cluster = {
        id,
        scopeId,
        kind: "unlocated",
        normalizedRelativePath: null,
        label: hierarchyClusterLabel("unlocated", null),
        fileIds: new Set(),
        nodeIds: new Set(),
      };
      mutableClusters.set(id, cluster);
    }
    return cluster;
  };

  const nodeLocationById = new Map<string, GraphHierarchyLocation>();
  const fileLocationById = new Map<string, GraphHierarchyLocation & { clusterId: string; fileId: string }>();
  const symbolLocationById = new Map<string, GraphHierarchyLocation>();
  const placementNodes = [
    ...fileNodes,
    ...stableGraph.nodes.filter((node) => node.type !== "file"),
  ];
  for (const node of placementNodes) {
    let scopeId = nodeScopeId.get(node.id) ?? scopes[0]?.id;
    if (!scopeId) continue;
    if (node.type === "file") {
      const cluster = clusterForPath(scopeId, node.filePath ?? "");
      const location = { scopeId, clusterId: cluster.id, fileId: node.id };
      cluster.fileIds.add(node.id);
      cluster.nodeIds.add(node.id);
      nodeLocationById.set(node.id, location);
      fileLocationById.set(node.id, location);
      continue;
    }

    const placement = graphNodePlacementClass(node.type);
    if (node.filePath !== undefined) {
      const normalizedPath = normalizeGraphFilePath(node.filePath);
      const fileId = fileIdByNormalizedPath.get(normalizedPath);
      const canonicalFileLocation = fileId ? fileLocationById.get(fileId) : undefined;
      const containingFileId = containingFileIdByNode.get(node.id);
      const fileLocation = canonicalFileLocation
        ?? (containingFileId ? fileLocationById.get(containingFileId) : undefined);
      if (fileLocation) {
        scopeId = fileLocation.scopeId;
        const location = { ...fileLocation };
        nodeLocationById.set(node.id, location);
        mutableClusters.get(fileLocation.clusterId)?.nodeIds.add(node.id);
        if (node.type === "function" || node.type === "class") symbolLocationById.set(node.id, location);
      } else {
        const cluster = clusterForPath(scopeId, normalizedPath);
        const location = { scopeId, clusterId: cluster.id };
        cluster.nodeIds.add(node.id);
        nodeLocationById.set(node.id, location);
      }
      continue;
    }

    if (placement === "architecture-context") {
      nodeLocationById.set(node.id, { scopeId });
      continue;
    }
    const containingFileId = containingFileIdByNode.get(node.id);
    const fileLocation = containingFileId ? fileLocationById.get(containingFileId) : undefined;
    if (fileLocation) {
      scopeId = fileLocation.scopeId;
      const location = { ...fileLocation };
      nodeLocationById.set(node.id, location);
      mutableClusters.get(fileLocation.clusterId)?.nodeIds.add(node.id);
      if (node.type === "function" || node.type === "class") symbolLocationById.set(node.id, location);
    } else {
      const cluster = unlocatedCluster(scopeId);
      cluster.nodeIds.add(node.id);
      nodeLocationById.set(node.id, { scopeId, clusterId: cluster.id });
    }
  }

  const orderedMutableClusters = [...mutableClusters.values()].sort((left, right) => {
    const leftScope = scopes.findIndex((scope) => scope.id === left.scopeId);
    const rightScope = scopes.findIndex((scope) => scope.id === right.scopeId);
    return leftScope - rightScope || compareHierarchyClusters(left, right);
  });
  const clusterById = new Map<string, GraphHierarchyCluster>(orderedMutableClusters.map((cluster) => [
    cluster.id,
    {
      id: cluster.id,
      scopeId: cluster.scopeId,
      kind: cluster.kind,
      normalizedRelativePath: cluster.normalizedRelativePath,
      label: cluster.label,
      fileIds: [...cluster.fileIds].sort(compareStable),
      nodeIds: [...cluster.nodeIds].sort(compareStable),
    },
  ]));

  const hierarchyScopes = scopes.map((scope): GraphHierarchyScope => {
    const nodeIds = [...nodeLocationById.entries()]
      .filter(([, location]) => location.scopeId === scope.id)
      .map(([nodeId]) => nodeId)
      .sort(compareStable);
    const clusterIds = orderedMutableClusters
      .filter((cluster) => cluster.scopeId === scope.id)
      .sort(compareHierarchyClusters)
      .map((cluster) => cluster.id);
    return {
      id: scope.id,
      label: scope.label,
      description: scope.description,
      normalizedRoot: rootPathByScope.get(scope.id) ?? "",
      protectedRoots: rootsByScope.get(scope.id) ?? [],
      clusterIds,
      nodeIds,
      order: scope.order,
    };
  }).filter((scope) => scope.nodeIds.length > 0);

  return {
    scopes: hierarchyScopes,
    scopeById: new Map(hierarchyScopes.map((scope) => [scope.id, scope])),
    clusterById,
    nodeLocationById: new Map([...nodeLocationById.entries()].sort(([left], [right]) => compareStable(left, right))),
    fileLocationById: new Map([...fileLocationById.entries()].sort(([left], [right]) => compareStable(left, right))),
    symbolLocationById: new Map([...symbolLocationById.entries()].sort(([left], [right]) => compareStable(left, right))),
    fileIdByNormalizedPath: new Map([...fileIdByNormalizedPath.entries()].sort(([left], [right]) => compareStable(left, right))),
    nodeById,
  };
}

export function normalizeGraphExplorerMode(mode: GraphExplorerMode): GraphExplorerDisplayMode {
  if (mode === "call") return "call";
  if (mode === "coverage" || mode === "evidence") return "coverage";
  return "architecture";
}

export function resolveGraphRelationshipSource(graph: KnowledgeGraph): GraphRelationshipSource {
  if (graph.edges.some((edge) => edge.type === "calls")) return "calls";
  if (graph.edges.some((edge) => edge.type === "imports")) return "imports";
  return "dependencies";
}

function uniqueById<T extends { id: string }>(values: T[]): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value.id)) return false;
    seen.add(value.id);
    return true;
  });
}

function topPathSegment(node: GraphNode): string | null {
  const path = node.filePath?.replace(/^\.\//, "");
  if (!path) return null;
  const [segment] = path.split("/").filter(Boolean);
  return segment || null;
}

function deriveScopes(graph: KnowledgeGraph): {
  scopes: InternalScope[];
  nodeToScopeId: Map<string, string>;
} {
  const graphNodeIds = new Set(graph.nodes.map((node) => node.id));
  const nodeToScopeId = new Map<string, string>();
  const scopes: InternalScope[] = [];

  for (const [order, layer] of graph.layers.entries()) {
    const id = `layer:${layer.id}`;
    const nodeIds = layer.nodeIds.filter((nodeId) => graphNodeIds.has(nodeId) && !nodeToScopeId.has(nodeId));
    if (nodeIds.length === 0) continue;
    for (const nodeId of nodeIds) nodeToScopeId.set(nodeId, id);
    scopes.push({
      id,
      label: layer.name,
      description: layer.description || `代码分层：${layer.name}`,
      nodeIds,
      order,
    });
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of graph.edges) {
      if (edge.type !== "contains") continue;
      const sourceScope = nodeToScopeId.get(edge.source);
      const targetScope = nodeToScopeId.get(edge.target);
      if (sourceScope && !targetScope) {
        nodeToScopeId.set(edge.target, sourceScope);
        changed = true;
      } else if (!sourceScope && targetScope) {
        nodeToScopeId.set(edge.source, targetScope);
        changed = true;
      }
    }
  }

  const fallback = new Map<string, InternalScope>();
  for (const node of graph.nodes) {
    if (nodeToScopeId.has(node.id)) continue;
    const pathSegment = topPathSegment(node);
    const group = pathSegment ? null : semanticGroupForNode(node);
    const key = pathSegment ? `path:${pathSegment}` : `group:${group}`;
    let scope = fallback.get(key);
    if (!scope) {
      scope = {
        id: key,
        label: pathSegment ?? GROUP_LABELS[group ?? "other"],
        description: pathSegment ? `${pathSegment} 路径下尚未归入代码分层的内容` : "尚未归入代码分层的内容",
        nodeIds: [],
        order: graph.layers.length + fallback.size,
      };
      fallback.set(key, scope);
    }
    scope.nodeIds.push(node.id);
    nodeToScopeId.set(node.id, scope.id);
  }

  scopes.push(...fallback.values());
  for (const scope of scopes) {
    scope.nodeIds = graph.nodes
      .filter((node) => nodeToScopeId.get(node.id) === scope.id)
      .map((node) => node.id);
  }
  return { scopes: scopes.filter((scope) => scope.nodeIds.length > 0), nodeToScopeId };
}

function graphMembers(graph: SemanticGraph): SemanticGraphEdgeMember[] {
  return graph.edges.flatMap((edge) => edge.members);
}

function documentationSubjects(
  nodes: SemanticGraphNode[],
  mode: GraphExplorerDisplayMode,
): SemanticGraphNode[] {
  if (mode === "coverage") return nodes;
  const keyObjects = nodes.filter((node) => (
    node.group !== "symbol"
    || node.docs.directPages.some((page) => page.role === "featured")
  ));
  return keyObjects.length > 0 ? keyObjects : nodes;
}

export function hasDocumentationProblem(docs: SemanticGraphDocMetadataV2): boolean {
  const documentedWithoutEvidence = docs.relation !== "none" && docs.evidenceHealth === "missing";
  return docs.quality === "failed"
    || docs.generationStatus === "failed"
    || docs.evidenceHealth === "unreadable"
    || documentedWithoutEvidence;
}

function documentationCounts(nodes: SemanticGraphNode[]): DocumentationCounts {
  return nodes.reduce((counts, node) => {
    counts[node.docs.relation] += 1;
    if (hasDocumentationProblem(node.docs)) counts.problem += 1;
    counts.total += 1;
    return counts;
  }, { direct: 0, context: 0, none: 0, problem: 0, total: 0 });
}

function aggregateDocumentation(
  nodes: SemanticGraphNode[],
  displayMode: GraphExplorerDisplayMode,
): { docs: SemanticGraphDocMetadataV2; documentationCounts: DocumentationCounts } {
  const subjects = documentationSubjects(nodes, displayMode);
  const counts = documentationCounts(subjects);
  const directPages = uniqueById(subjects.flatMap((node) => node.docs.directPages));
  const directPageIds = new Set(directPages.map((page) => page.id));
  const contextPages = uniqueById(subjects.flatMap((node) => node.docs.contextPages))
    .filter((page) => !directPageIds.has(page.id));
  const evidence = uniqueById(subjects.flatMap((node) => node.docs.evidence));
  const documented = subjects.filter((node) => node.docs.relation !== "none");
  const primaryPageId = subjects
    .map((node) => node.docs.primaryPageId)
    .find((pageId): pageId is string => Boolean(pageId && directPageIds.has(pageId)));
  const relation = counts.direct > 0 ? "direct" : counts.context > 0 ? "context" : "none";
  return {
    documentationCounts: counts,
    docs: {
      relation,
      quality: documented.length > 0 && documented.every((node) => node.docs.quality === "failed")
        ? "failed"
        : "needs-review",
      evidenceHealth: documented.length > 0 && documented.every((node) => node.docs.evidenceHealth === "unreadable")
        ? "unreadable"
        : evidence.length > 0 ? "weak" : "missing",
      generationStatus: documented.length > 0 && documented.every((node) => node.docs.generationStatus === "failed")
        ? "failed"
        : "partial",
      referenceCoverage: subjects.length > 0 && subjects.every((node) => node.docs.referenceCoverage === "anchored")
        ? "anchored"
        : subjects.length > 0 && subjects.every((node) => node.docs.referenceCoverage === "not-applicable")
          ? "not-applicable"
          : "unanchored",
      ...(primaryPageId ? { primaryPageId } : {}),
      directPageIds: directPages.map((page) => page.id),
      contextPageIds: contextPages.map((page) => page.id),
      directPages,
      contextPages,
      evidenceIds: evidence.map((item) => item.id),
      evidence,
    },
  };
}


function fallbackNotice(source: GraphRelationshipSource, mode: GraphExplorerDisplayMode): string | null {
  if (mode !== "call") return null;
  if (source === "imports") return "当前图谱没有函数调用边，已自动降级为文件导入关系。";
  if (source === "dependencies") return "当前图谱没有函数调用或文件导入边，已展示可用的结构依赖关系。";
  return null;
}

function presentation(
  displayMode: GraphExplorerDisplayMode,
  relationshipSource: GraphRelationshipSource,
  level: GraphNavigationLevel,
  options: GraphScopeOption[],
  breadcrumbs: GraphBreadcrumbItem[],
  totalNodeCount: number,
  hiddenNodeCount: number,
  focusApplied: boolean,
  scopeId: string | null = null,
  clusterId: string | null = null,
  fileId: string | null = null,
  notice: string | null = null,
): HierarchicalGraphPresentation {
  return {
    displayMode,
    level,
    relationshipSource,
    scopeId,
    clusterId,
    fileId,
    scopeOptions: options,
    breadcrumbs,
    totalNodeCount,
    hiddenNodeCount,
    focusApplied,
    notice: notice ?? fallbackNotice(relationshipSource, displayMode),
  };
}

interface ProjectedEdgeMember {
  source: string;
  target: string;
  member: SemanticGraphEdgeMember;
  boundaryContext?: HierarchicalSemanticGraphEdge["boundaryContext"];
}

function aggregateEdgeKey(
  source: string,
  target: string,
  member: SemanticGraphEdgeMember,
): string {
  return [source, target, member.type, member.direction].join("\u0000");
}

function bundleProjectedMembers(
  projected: ProjectedEdgeMember[],
  limit: number | null = MAX_VISIBLE_EDGES,
): HierarchicalSemanticGraphEdge[] {
  const bundled = new Map<string, HierarchicalSemanticGraphEdge>();
  for (const projection of projected) {
    if (projection.source === projection.target) continue;
    const key = aggregateEdgeKey(projection.source, projection.target, projection.member);
    const current = bundled.get(key);
    if (current) {
      current.weight = Math.max(current.weight, projection.member.weight);
      current.members.push(projection.member);
      current.bundledCount = current.members.length;
      continue;
    }
    bundled.set(key, {
      id: key,
      source: projection.source,
      target: projection.target,
      type: projection.member.type,
      direction: projection.member.direction,
      edgeTypes: [projection.member.type],
      directions: [projection.member.direction],
      weight: projection.member.weight,
      bundledCount: 1,
      members: [projection.member],
      ...(projection.boundaryContext ? { boundaryContext: projection.boundaryContext } : {}),
    });
  }
  const ordered = [...bundled.values()]
    .sort((left, right) => right.bundledCount - left.bundledCount
      || right.weight - left.weight
      || compareStable(left.id, right.id))
    .map((edge) => ({ ...edge, bundledCount: edge.members.length }));
  return limit === null ? ordered : ordered.slice(0, limit);
}

function progressiveMemberAllowed(
  member: SemanticGraphEdgeMember,
  mode: GraphExplorerDisplayMode,
  relationshipSource: GraphRelationshipSource,
  includeContainment: boolean,
): boolean {
  if (member.type === "contains") return includeContainment;
  if (mode === "coverage") return true;
  if (mode === "call") {
    if (relationshipSource === "calls") return member.type === "calls";
    if (relationshipSource === "imports") return member.type === "imports";
    return DEPENDENCY_EDGE_TYPES.has(member.type);
  }
  return member.type !== "calls";
}

function cappedWithMaterialized<T extends { id: string }>(
  values: readonly T[],
  limit: number,
  materializedId: string | null,
): T[] {
  const base = values.slice(0, limit);
  if (!materializedId || base.some((value) => value.id === materializedId)) return [...base];
  const materialized = values.find((value) => value.id === materializedId);
  if (!materialized) return [...base];
  return [...values.slice(0, Math.max(0, limit - 1)), materialized];
}

function progressiveScopeOptions(
  hierarchyIndex: GraphHierarchyIndex,
  rawNodesById: ReadonlyMap<string, SemanticGraphNode>,
  displayMode: GraphExplorerDisplayMode,
): GraphScopeOption[] {
  return hierarchyIndex.scopes.map((scope) => {
    const nodes = scope.nodeIds
      .map((nodeId) => rawNodesById.get(nodeId))
      .filter((node): node is SemanticGraphNode => Boolean(node));
    return {
      id: scope.id,
      label: scope.label,
      description: scope.description,
      nodeCount: nodes.length,
      fileCount: nodes.filter((node) => node.rawType === "file").length,
      documentationCounts: aggregateDocumentation(nodes, displayMode).documentationCounts,
    };
  });
}

function hierarchyScopeNode(
  scope: GraphHierarchyScope,
  rawNodesById: ReadonlyMap<string, SemanticGraphNode>,
  relationCount: number,
  displayMode: GraphExplorerDisplayMode,
): HierarchicalSemanticGraphNode {
  const children = scope.nodeIds
    .map((nodeId) => rawNodesById.get(nodeId))
    .filter((node): node is SemanticGraphNode => Boolean(node));
  const { docs, documentationCounts: counts } = aggregateDocumentation(children, displayMode);
  const fileCount = children.filter((node) => node.rawType === "file").length;
  return {
    id: scopeNodeId(scope.id),
    kind: "scope",
    label: scope.label,
    group: "module",
    category: "module",
    cluster: scope.label,
    importance: 0.85,
    rawType: "module",
    summary: `${scope.description}。包含 ${children.length} 个节点、${fileCount} 个文件、${relationCount} 条跨范围关系。`,
    docs,
    documentationCounts: counts,
    scopeId: scope.id,
    containedNodeIds: [...scope.nodeIds],
    childCount: children.length,
    fileCount,
    relationCount,
    canDrillDown: true,
  };
}

function hierarchyBoundaryNode(
  currentScopeId: string,
  targetScope: GraphHierarchyScope,
  rawNodesById: ReadonlyMap<string, SemanticGraphNode>,
  relationCount: number,
  displayMode: GraphExplorerDisplayMode,
): HierarchicalSemanticGraphNode {
  const children = targetScope.nodeIds
    .map((nodeId) => rawNodesById.get(nodeId))
    .filter((node): node is SemanticGraphNode => Boolean(node));
  const { docs, documentationCounts: counts } = aggregateDocumentation(children, displayMode);
  const fileCount = children.filter((node) => node.rawType === "file").length;
  return {
    id: boundaryNodeId(currentScopeId, targetScope.id),
    kind: "boundary",
    label: targetScope.label,
    group: "other",
    category: "other",
    cluster: targetScope.label,
    importance: 0.5,
    rawType: "module",
    summary: `${targetScope.description}。通过 ${relationCount} 条关系连接当前范围。`,
    docs,
    documentationCounts: counts,
    scopeId: targetScope.id,
    containedNodeIds: [...targetScope.nodeIds],
    childCount: children.length,
    fileCount,
    relationCount,
    canDrillDown: true,
  };
}

function hierarchyClusterNode(
  cluster: GraphHierarchyCluster,
  rawNodesById: ReadonlyMap<string, SemanticGraphNode>,
  relationCount: number,
  displayMode: GraphExplorerDisplayMode,
): HierarchicalSemanticGraphNode {
  const children = cluster.nodeIds
    .map((nodeId) => rawNodesById.get(nodeId))
    .filter((node): node is SemanticGraphNode => Boolean(node));
  const { docs, documentationCounts: counts } = aggregateDocumentation(children, displayMode);
  return {
    id: cluster.id,
    kind: "cluster",
    label: cluster.label,
    group: "module",
    category: "module",
    cluster: cluster.label,
    importance: 0.75,
    rawType: "module",
    summary: `${cluster.label}。包含 ${children.length} 个节点、${cluster.fileIds.length} 个文件、${relationCount} 条关系。`,
    docs,
    documentationCounts: counts,
    scopeId: cluster.scopeId,
    clusterId: cluster.id,
    clusterKind: cluster.kind,
    containedNodeIds: [...cluster.nodeIds],
    childCount: children.length,
    fileCount: cluster.fileIds.length,
    relationCount,
    canDrillDown: true,
  };
}

interface HierarchyRelationCounts {
  scopeById: ReadonlyMap<string, number>;
  clusterById: ReadonlyMap<string, number>;
}

function hierarchyRelationCounts(
  members: readonly SemanticGraphEdgeMember[],
  hierarchyIndex: GraphHierarchyIndex,
): HierarchyRelationCounts {
  const scopeById = new Map<string, number>();
  const clusterById = new Map<string, number>();
  const increment = (counts: Map<string, number>, id: string | undefined) => {
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  };
  for (const member of members) {
    const sourceLocation = hierarchyIndex.nodeLocationById.get(member.source);
    const targetLocation = hierarchyIndex.nodeLocationById.get(member.target);
    if (sourceLocation?.scopeId !== targetLocation?.scopeId) {
      increment(scopeById, sourceLocation?.scopeId);
      increment(scopeById, targetLocation?.scopeId);
    }
    increment(clusterById, sourceLocation?.clusterId);
    if (targetLocation?.clusterId !== sourceLocation?.clusterId) {
      increment(clusterById, targetLocation?.clusterId);
    }
  }
  return { scopeById, clusterById };
}

function progressiveRawNode(
  node: SemanticGraphNode,
  hierarchyIndex: GraphHierarchyIndex,
  canDrillDown = false,
): HierarchicalSemanticGraphNode {
  const location = hierarchyIndex.nodeLocationById.get(node.id);
  return {
    ...node,
    kind: "node",
    ...(location?.scopeId ? { scopeId: location.scopeId } : {}),
    ...(location?.clusterId ? { clusterId: location.clusterId } : {}),
    canDrillDown,
  };
}

function materializedScopeId(
  materializedNodeId: string | null,
  hierarchyIndex: GraphHierarchyIndex,
): string | null {
  if (!materializedNodeId) return null;
  const exact = hierarchyIndex.scopes.find((scope) => scopeNodeId(scope.id) === materializedNodeId);
  return exact?.id ?? hierarchyIndex.nodeLocationById.get(materializedNodeId)?.scopeId ?? null;
}

function materializedClusterId(
  materializedNodeId: string | null,
  hierarchyIndex: GraphHierarchyIndex,
): string | null {
  if (!materializedNodeId) return null;
  if (hierarchyIndex.clusterById.has(materializedNodeId)) return materializedNodeId;
  const node = hierarchyIndex.nodeById.get(materializedNodeId);
  if (node && graphNodePlacementClass(node.type) === "architecture-context") return null;
  return hierarchyIndex.nodeLocationById.get(materializedNodeId)?.clusterId ?? null;
}

interface OverviewBoundaryFacts {
  currentScopeId: string;
  targetScopeId: string;
  members: SemanticGraphEdgeMember[];
}

function overviewBoundaryFacts(
  members: readonly SemanticGraphEdgeMember[],
  hierarchyIndex: GraphHierarchyIndex,
): Map<string, OverviewBoundaryFacts> {
  const factsById = new Map<string, OverviewBoundaryFacts>();
  const append = (
    currentScopeId: string,
    targetScopeId: string,
    member: SemanticGraphEdgeMember,
  ) => {
    const id = boundaryNodeId(currentScopeId, targetScopeId);
    const current = factsById.get(id);
    if (current) current.members.push(member);
    else factsById.set(id, { currentScopeId, targetScopeId, members: [member] });
  };
  for (const member of members) {
    const sourceScopeId = hierarchyIndex.nodeLocationById.get(member.source)?.scopeId;
    const targetScopeId = hierarchyIndex.nodeLocationById.get(member.target)?.scopeId;
    if (!sourceScopeId || !targetScopeId || sourceScopeId === targetScopeId) continue;
    append(sourceScopeId, targetScopeId, member);
    append(targetScopeId, sourceScopeId, member);
  }
  return factsById;
}

function progressiveOverview(input: {
  hierarchyIndex: GraphHierarchyIndex;
  rawNodes: SemanticGraphNode[];
  members: SemanticGraphEdgeMember[];
  displayMode: GraphExplorerDisplayMode;
  relationshipSource: GraphRelationshipSource;
  options: GraphScopeOption[];
  materializedNodeId: string | null;
}): HierarchicalSemanticGraph {
  const {
    hierarchyIndex, rawNodes, members, displayMode, relationshipSource, options, materializedNodeId,
  } = input;
  const rawNodesById = new Map(rawNodes.map((node) => [node.id, node]));
  const allowedMembers = members.filter((member) =>
    progressiveMemberAllowed(member, displayMode, relationshipSource, true));
  const relationCounts = hierarchyRelationCounts(members, hierarchyIndex);
  const displayBoundaryFacts = overviewBoundaryFacts(allowedMembers, hierarchyIndex);
  const rawBoundaryFacts = overviewBoundaryFacts(members, hierarchyIndex);
  const materializedBoundary = materializedNodeId ? rawBoundaryFacts.get(materializedNodeId) : undefined;
  const visibleScopes = cappedWithMaterialized(
    hierarchyIndex.scopes,
    MAX_OVERVIEW_SCOPES,
    materializedBoundary?.currentScopeId ?? materializedScopeId(materializedNodeId, hierarchyIndex),
  );
  const architecture = rawNodes
    .filter((node) => graphNodePlacementClass(node.rawType) === "architecture-context")
    .sort((left, right) => compareStable(left.id, right.id));
  const visibleArchitecture = cappedWithMaterialized(
    architecture,
    MAX_OVERVIEW_ARCHITECTURE,
    architecture.some((node) => node.id === materializedNodeId) ? materializedNodeId : null,
  );
  const visibleScopeIds = new Set(visibleScopes.map((scope) => scope.id));
  const boundaryCandidates = [...displayBoundaryFacts.entries()]
    .filter(([, boundary]) => visibleScopeIds.has(boundary.currentScopeId))
    .sort((left, right) => right[1].members.length - left[1].members.length
      || compareStable(left[0], right[0]));
  const boundaryCandidateIds = boundaryCandidates.map(([id]) => ({ id }));
  if (materializedBoundary
    && visibleScopeIds.has(materializedBoundary.currentScopeId)
    && !displayBoundaryFacts.has(materializedNodeId!)) {
    boundaryCandidateIds.push({ id: materializedNodeId! });
  }
  const visibleBoundaryIdsInOrder = cappedWithMaterialized(
    boundaryCandidateIds,
    MAX_BOUNDARY_SCOPES,
    materializedBoundary ? materializedNodeId : null,
  ).map(({ id }) => id);
  const visibleBoundaries = visibleBoundaryIdsInOrder
    .map((id) => rawBoundaryFacts.get(id))
    .filter((boundary): boundary is OverviewBoundaryFacts => Boolean(boundary));
  const nodes: HierarchicalSemanticGraphNode[] = [
    ...visibleScopes.map((scope) => hierarchyScopeNode(
      scope,
      rawNodesById,
      relationCounts.scopeById.get(scope.id) ?? 0,
      displayMode,
    )),
    ...visibleArchitecture.map((node) => progressiveRawNode(node, hierarchyIndex)),
    ...visibleBoundaries.flatMap((boundary) => {
      const target = hierarchyIndex.scopeById.get(boundary.targetScopeId);
      return target ? [hierarchyBoundaryNode(
        boundary.currentScopeId,
        target,
        rawNodesById,
        boundary.members.length,
        displayMode,
      )] : [];
    }),
  ];
  const visibleIds = new Set(nodes.map((node) => node.id));
  const visibleArchitectureIds = new Set(visibleArchitecture.map((node) => node.id));
  const mappedEndpoint = (nodeId: string): string | null => {
    const node = rawNodesById.get(nodeId);
    const location = hierarchyIndex.nodeLocationById.get(nodeId);
    if (!node || !location) return null;
    if (graphNodePlacementClass(node.rawType) === "architecture-context" && visibleArchitectureIds.has(nodeId)) {
      return nodeId;
    }
    const scopeId = scopeNodeId(location.scopeId);
    return visibleIds.has(scopeId) ? scopeId : null;
  };
  const visibleBoundaryIds = new Set(visibleBoundaries.map((boundary) =>
    boundaryNodeId(boundary.currentScopeId, boundary.targetScopeId)));
  const projected = allowedMembers.flatMap((member): ProjectedEdgeMember[] => {
    const sourceScopeId = hierarchyIndex.nodeLocationById.get(member.source)?.scopeId;
    const targetScopeId = hierarchyIndex.nodeLocationById.get(member.target)?.scopeId;
    if (!sourceScopeId || !targetScopeId) return [];
    if (sourceScopeId !== targetScopeId) {
      const contextual: ProjectedEdgeMember[] = [];
      const outgoingBoundaryId = boundaryNodeId(sourceScopeId, targetScopeId);
      if (visibleBoundaryIds.has(outgoingBoundaryId)) {
        const source = mappedEndpoint(member.source);
        if (source) contextual.push({
          source,
          target: outgoingBoundaryId,
          member,
          boundaryContext: { currentScopeId: sourceScopeId, targetScopeId },
        });
      }
      const incomingBoundaryId = boundaryNodeId(targetScopeId, sourceScopeId);
      if (visibleBoundaryIds.has(incomingBoundaryId)) {
        const target = mappedEndpoint(member.target);
        if (target) contextual.push({
          source: incomingBoundaryId,
          target,
          member,
          boundaryContext: { currentScopeId: targetScopeId, targetScopeId: sourceScopeId },
        });
      }
      return contextual;
    }
    const source = mappedEndpoint(member.source);
    const target = mappedEndpoint(member.target);
    return source && target ? [{ source, target, member }] : [];
  });
  const totalBoundaryIds = new Set([...displayBoundaryFacts.keys(), ...visibleBoundaryIdsInOrder]);
  const hidden = (hierarchyIndex.scopes.length - visibleScopes.length)
    + (architecture.length - visibleArchitecture.length)
    + (totalBoundaryIds.size - visibleBoundaries.length);
  const empty = nodes.length === 0 ? "当前图谱没有可展示的范围或架构对象。" : null;
  return {
    nodes,
    edges: bundleProjectedMembers(projected),
    presentation: presentation(
      displayMode,
      relationshipSource,
      "overview",
      options,
      [{ level: "overview", label: "全局概览" }],
      hierarchyIndex.scopes.length + architecture.length + totalBoundaryIds.size,
      hidden,
      Boolean(materializedNodeId && (hierarchyIndex.nodeById.has(materializedNodeId)
        || hierarchyIndex.clusterById.has(materializedNodeId)
        || rawBoundaryFacts.has(materializedNodeId))),
      null,
      null,
      null,
      empty,
    ),
  };
}

function contextualBoundaryMembers(input: {
  currentScopeId: string;
  members: readonly SemanticGraphEdgeMember[];
  hierarchyIndex: GraphHierarchyIndex;
  ownsInternal: (nodeId: string) => boolean;
}): Map<string, SemanticGraphEdgeMember[]> {
  const { currentScopeId, members, hierarchyIndex, ownsInternal } = input;
  const membersByScopeId = new Map<string, SemanticGraphEdgeMember[]>();
  for (const member of members) {
    const sourceScope = hierarchyIndex.nodeLocationById.get(member.source)?.scopeId;
    const targetScope = hierarchyIndex.nodeLocationById.get(member.target)?.scopeId;
    if (!sourceScope || !targetScope || sourceScope === targetScope) continue;
    let boundaryScopeId: string | null = null;
    if (sourceScope === currentScopeId && ownsInternal(member.source)) {
      boundaryScopeId = targetScope;
    } else if (targetScope === currentScopeId && ownsInternal(member.target)) {
      boundaryScopeId = sourceScope;
    }
    if (!boundaryScopeId) continue;
    const contextual = membersByScopeId.get(boundaryScopeId) ?? [];
    contextual.push(member);
    membersByScopeId.set(boundaryScopeId, contextual);
  }
  return membersByScopeId;
}

function clusterOwnsContextNode(
  hierarchyIndex: GraphHierarchyIndex,
  clusterId: string,
  nodeId: string,
): boolean {
  const node = hierarchyIndex.nodeById.get(nodeId);
  const location = hierarchyIndex.nodeLocationById.get(nodeId);
  return Boolean(node && location?.clusterId === clusterId
    && (node.type === "file" || graphNodePlacementClass(node.type) === "file-leaf"));
}

function boundaryScopeIdsForView(input: {
  currentScopeId: string;
  displayMembers: readonly SemanticGraphEdgeMember[];
  rawMembers: readonly SemanticGraphEdgeMember[];
  hierarchyIndex: GraphHierarchyIndex;
  ownsInternal: (nodeId: string) => boolean;
  materializedNodeId: string | null;
}): { visible: string[]; counts: Map<string, number>; rawCounts: Map<string, number> } {
  const {
    currentScopeId, displayMembers, rawMembers, hierarchyIndex, ownsInternal, materializedNodeId,
  } = input;
  const displayContext = contextualBoundaryMembers({
    currentScopeId,
    members: displayMembers,
    hierarchyIndex,
    ownsInternal,
  });
  const rawContext = contextualBoundaryMembers({
    currentScopeId,
    members: rawMembers,
    hierarchyIndex,
    ownsInternal,
  });
  const counts = new Map([...displayContext].map(([scopeId, contextual]) => [scopeId, contextual.length]));
  const rawCounts = new Map([...rawContext].map(([scopeId, contextual]) => [scopeId, contextual.length]));
  const materializedScopeId = [...rawContext.keys()].find((scopeId) =>
    boundaryNodeId(currentScopeId, scopeId) === materializedNodeId) ?? null;
  const ordered = [...counts].sort((left, right) => right[1] - left[1]
    || compareStable(left[0], right[0])).map(([scopeId]) => scopeId);
  if (materializedScopeId && !counts.has(materializedScopeId)) ordered.push(materializedScopeId);
  const visible = cappedWithMaterialized(
    ordered.map((id) => ({ id })),
    MAX_BOUNDARY_SCOPES,
    materializedScopeId,
  ).map(({ id }) => id);
  return { visible, counts, rawCounts };
}

function projectContextualMembers(input: {
  currentScopeId: string;
  members: readonly SemanticGraphEdgeMember[];
  hierarchyIndex: GraphHierarchyIndex;
  mapInternal: (nodeId: string) => string | null;
  boundaryScopeIds: ReadonlySet<string>;
}): ProjectedEdgeMember[] {
  const { currentScopeId, members, hierarchyIndex, mapInternal, boundaryScopeIds } = input;
  return members.flatMap((member): ProjectedEdgeMember[] => {
    const sourceScope = hierarchyIndex.nodeLocationById.get(member.source)?.scopeId;
    const targetScope = hierarchyIndex.nodeLocationById.get(member.target)?.scopeId;
    if (!sourceScope || !targetScope) return [];
    if (sourceScope === currentScopeId && targetScope === currentScopeId) {
      const source = mapInternal(member.source);
      const target = mapInternal(member.target);
      return source && target ? [{ source, target, member }] : [];
    }
    if (sourceScope === currentScopeId && boundaryScopeIds.has(targetScope)) {
      const source = mapInternal(member.source);
      if (!source) return [];
      return [{
        source,
        target: boundaryNodeId(currentScopeId, targetScope),
        member,
        boundaryContext: { currentScopeId, targetScopeId: targetScope },
      }];
    }
    if (targetScope === currentScopeId && boundaryScopeIds.has(sourceScope)) {
      const target = mapInternal(member.target);
      if (!target) return [];
      return [{
        source: boundaryNodeId(currentScopeId, sourceScope),
        target,
        member,
        boundaryContext: { currentScopeId, targetScopeId: sourceScope },
      }];
    }
    return [];
  });
}

function progressiveScope(input: {
  hierarchyIndex: GraphHierarchyIndex;
  scope: GraphHierarchyScope;
  rawNodes: SemanticGraphNode[];
  members: SemanticGraphEdgeMember[];
  displayMode: GraphExplorerDisplayMode;
  relationshipSource: GraphRelationshipSource;
  options: GraphScopeOption[];
  materializedNodeId: string | null;
}): HierarchicalSemanticGraph {
  const {
    hierarchyIndex, scope, rawNodes, members, displayMode, relationshipSource, options, materializedNodeId,
  } = input;
  const rawNodesById = new Map(rawNodes.map((node) => [node.id, node]));
  const clusters = scope.clusterIds
    .map((clusterId) => hierarchyIndex.clusterById.get(clusterId))
    .filter((cluster): cluster is GraphHierarchyCluster => Boolean(cluster));
  const architecture = scope.nodeIds
    .map((nodeId) => rawNodesById.get(nodeId))
    .filter((node): node is SemanticGraphNode =>
      Boolean(node && graphNodePlacementClass(node.rawType) === "architecture-context"))
    .sort((left, right) => compareStable(left.id, right.id));
  const visibleArchitecture = architecture;
  const allowedMembers = members.filter((member) =>
    progressiveMemberAllowed(member, displayMode, relationshipSource, true));
  const relationCounts = hierarchyRelationCounts(allowedMembers, hierarchyIndex);
  const materializedBoundaryTarget = hierarchyIndex.scopes.find((target) =>
    target.id !== scope.id && boundaryNodeId(scope.id, target.id) === materializedNodeId)?.id;
  const connectingClusterId = materializedBoundaryTarget
    ? members.flatMap((member): string[] => {
      const sourceLocation = hierarchyIndex.nodeLocationById.get(member.source);
      const targetLocation = hierarchyIndex.nodeLocationById.get(member.target);
      const internalNodeId = sourceLocation?.scopeId === scope.id
        && targetLocation?.scopeId === materializedBoundaryTarget
        ? member.source
        : targetLocation?.scopeId === scope.id
          && sourceLocation?.scopeId === materializedBoundaryTarget
          ? member.target
          : null;
      if (!internalNodeId) return [];
      const internalNode = hierarchyIndex.nodeById.get(internalNodeId);
      if (!internalNode || graphNodePlacementClass(internalNode.type) === "architecture-context") return [];
      const clusterId = hierarchyIndex.nodeLocationById.get(internalNodeId)?.clusterId;
      return clusterId ? [clusterId] : [];
    }).sort(compareStable)[0] ?? null
    : null;
  const visibleClusters = cappedWithMaterialized(
    clusters,
    MAX_SCOPE_CLUSTERS,
    materializedClusterId(materializedNodeId, hierarchyIndex) ?? connectingClusterId,
  );
  const clusterIds = new Set(visibleClusters.map((cluster) => cluster.id));
  const architectureIds = new Set(visibleArchitecture.map((node) => node.id));
  const mapInternal = (nodeId: string): string | null => {
    const node = rawNodesById.get(nodeId);
    const location = hierarchyIndex.nodeLocationById.get(nodeId);
    if (!node || location?.scopeId !== scope.id) return null;
    if (graphNodePlacementClass(node.rawType) === "architecture-context") {
      return architectureIds.has(nodeId) ? nodeId : null;
    }
    return location.clusterId && clusterIds.has(location.clusterId) ? location.clusterId : null;
  };
  const boundaries = boundaryScopeIdsForView({
    currentScopeId: scope.id,
    displayMembers: allowedMembers,
    rawMembers: members,
    hierarchyIndex,
    ownsInternal: (nodeId) => hierarchyIndex.nodeLocationById.get(nodeId)?.scopeId === scope.id,
    materializedNodeId,
  });
  const boundaryIds = new Set(boundaries.visible);
  const nodes: HierarchicalSemanticGraphNode[] = [
    ...visibleClusters.map((cluster) => hierarchyClusterNode(
      cluster,
      rawNodesById,
      relationCounts.clusterById.get(cluster.id) ?? 0,
      displayMode,
    )),
    ...visibleArchitecture.map((node) => progressiveRawNode(node, hierarchyIndex)),
    ...boundaries.visible.flatMap((scopeId) => {
      const target = hierarchyIndex.scopeById.get(scopeId);
      return target ? [hierarchyBoundaryNode(
        scope.id,
        target,
        rawNodesById,
        boundaries.rawCounts.get(scopeId) ?? 0,
        displayMode,
      )] : [];
    }),
  ];
  const projected = projectContextualMembers({
    currentScopeId: scope.id,
    members: allowedMembers,
    hierarchyIndex,
    mapInternal,
    boundaryScopeIds: boundaryIds,
  });
  const totalBoundaryCount = new Set([...boundaries.counts.keys(), ...boundaries.visible]).size;
  const total = clusters.length + architecture.length + totalBoundaryCount;
  const empty = nodes.length === 0 ? "当前范围没有可展示的聚类或架构对象。" : null;
  return {
    nodes,
    edges: bundleProjectedMembers(projected),
    presentation: presentation(
      displayMode,
      relationshipSource,
      "scope",
      options,
      [
        { level: "overview", label: "全局概览" },
        { level: "scope", label: scope.label, scopeId: scope.id },
      ],
      total,
      total - nodes.length,
      Boolean(materializedNodeId),
      scope.id,
      null,
      null,
      empty,
    ),
  };
}

function progressiveCluster(input: {
  hierarchyIndex: GraphHierarchyIndex;
  scope: GraphHierarchyScope;
  cluster: GraphHierarchyCluster;
  rawNodes: SemanticGraphNode[];
  members: SemanticGraphEdgeMember[];
  displayMode: GraphExplorerDisplayMode;
  relationshipSource: GraphRelationshipSource;
  options: GraphScopeOption[];
  materializedNodeId: string | null;
}): HierarchicalSemanticGraph {
  const {
    hierarchyIndex, scope, cluster, rawNodes, members, displayMode, relationshipSource, options, materializedNodeId,
  } = input;
  const rawNodesById = new Map(rawNodes.map((node) => [node.id, node]));
  const files = cluster.fileIds
    .map((fileId) => rawNodesById.get(fileId))
    .filter((node): node is SemanticGraphNode => Boolean(node));
  const allowedMembers = members.filter((member) =>
    progressiveMemberAllowed(member, displayMode, relationshipSource, true));
  const materializedLocation = materializedNodeId
    ? hierarchyIndex.nodeLocationById.get(materializedNodeId)
    : undefined;
  const directMaterializedNode = materializedNodeId
    ? hierarchyIndex.nodeById.get(materializedNodeId)
    : undefined;
  const directMaterializedFileId = materializedNodeId
    && directMaterializedNode
    && clusterOwnsContextNode(hierarchyIndex, cluster.id, materializedNodeId)
    ? directMaterializedNode.type === "file"
      ? directMaterializedNode.id
      : materializedLocation?.fileId ?? null
    : null;
  const materializedBoundaryTarget = hierarchyIndex.scopes.find((target) =>
    target.id !== scope.id && boundaryNodeId(scope.id, target.id) === materializedNodeId)?.id;
  const boundaryInternalNodeId = materializedBoundaryTarget
    ? members.flatMap((member): string[] => {
      const sourceLocation = hierarchyIndex.nodeLocationById.get(member.source);
      const targetLocation = hierarchyIndex.nodeLocationById.get(member.target);
      if (sourceLocation?.scopeId === scope.id && sourceLocation.clusterId === cluster.id
        && targetLocation?.scopeId === materializedBoundaryTarget
        && clusterOwnsContextNode(hierarchyIndex, cluster.id, member.source)) return [member.source];
      if (targetLocation?.scopeId === scope.id && targetLocation.clusterId === cluster.id
        && sourceLocation?.scopeId === materializedBoundaryTarget
        && clusterOwnsContextNode(hierarchyIndex, cluster.id, member.target)) return [member.target];
      return [];
    }).sort(compareStable)[0]
    : undefined;
  const boundaryInternalLocation = boundaryInternalNodeId
    ? hierarchyIndex.nodeLocationById.get(boundaryInternalNodeId)
    : undefined;
  const boundaryInternalNode = boundaryInternalNodeId
    ? hierarchyIndex.nodeById.get(boundaryInternalNodeId)
    : undefined;
  const connectingFileId = boundaryInternalNode?.type === "file"
    ? boundaryInternalNode.id
    : boundaryInternalLocation?.fileId ?? null;
  const visibleFiles = cappedWithMaterialized(
    files,
    MAX_CLUSTER_FILES,
    directMaterializedFileId ?? connectingFileId,
  );
  const directLeaves = cluster.nodeIds
    .map((nodeId) => rawNodesById.get(nodeId))
    .filter((node): node is SemanticGraphNode => {
      if (!node || graphNodePlacementClass(node.rawType) !== "file-leaf") return false;
      const location = hierarchyIndex.nodeLocationById.get(node.id);
      return location?.clusterId === cluster.id && !location.fileId;
    })
    .sort((left, right) => compareStable(left.id, right.id));
  const visibleLeaves = cappedWithMaterialized(
    directLeaves,
    MAX_CLUSTER_FILELESS_LEAVES,
    materializedLocation?.clusterId === cluster.id && !materializedLocation.fileId
      ? materializedNodeId
      : boundaryInternalLocation?.clusterId === cluster.id && !boundaryInternalLocation.fileId
        ? boundaryInternalNodeId ?? null
        : null,
  );
  const fileIds = new Set(visibleFiles.map((node) => node.id));
  const leafIds = new Set(visibleLeaves.map((node) => node.id));
  const mapInternal = (nodeId: string): string | null => {
    const node = rawNodesById.get(nodeId);
    const location = hierarchyIndex.nodeLocationById.get(nodeId);
    if (!node || location?.scopeId !== scope.id || location.clusterId !== cluster.id) return null;
    if (node.rawType === "file") return fileIds.has(nodeId) ? nodeId : null;
    if (graphNodePlacementClass(node.rawType) === "file-leaf") {
      if (location.fileId) return fileIds.has(location.fileId) ? location.fileId : null;
      return leafIds.has(nodeId) ? nodeId : null;
    }
    return null;
  };
  const boundaries = boundaryScopeIdsForView({
    currentScopeId: scope.id,
    displayMembers: allowedMembers,
    rawMembers: members,
    hierarchyIndex,
    ownsInternal: (nodeId) => clusterOwnsContextNode(hierarchyIndex, cluster.id, nodeId),
    materializedNodeId,
  });
  const nodes: HierarchicalSemanticGraphNode[] = [
    ...visibleFiles.map((node) => progressiveRawNode(node, hierarchyIndex, true)),
    ...visibleLeaves.map((node) => progressiveRawNode(node, hierarchyIndex)),
    ...boundaries.visible.flatMap((scopeId) => {
      const target = hierarchyIndex.scopeById.get(scopeId);
      return target ? [hierarchyBoundaryNode(
        scope.id,
        target,
        rawNodesById,
        boundaries.rawCounts.get(scopeId) ?? 0,
        displayMode,
      )] : [];
    }),
  ];
  const projected = projectContextualMembers({
    currentScopeId: scope.id,
    members: allowedMembers,
    hierarchyIndex,
    mapInternal,
    boundaryScopeIds: new Set(boundaries.visible),
  });
  const totalBoundaryCount = new Set([...boundaries.counts.keys(), ...boundaries.visible]).size;
  const total = files.length + directLeaves.length + totalBoundaryCount;
  const empty = nodes.length === 0 ? "当前聚类没有可展示的文件或结构对象。" : null;
  return {
    nodes,
    edges: bundleProjectedMembers(projected),
    presentation: presentation(
      displayMode,
      relationshipSource,
      "cluster",
      options,
      [
        { level: "overview", label: "全局概览" },
        { level: "scope", label: scope.label, scopeId: scope.id },
        { level: "cluster", label: cluster.label, scopeId: scope.id, clusterId: cluster.id },
      ],
      total,
      total - nodes.length,
      Boolean(materializedNodeId),
      scope.id,
      cluster.id,
      null,
      empty,
    ),
  };
}

function progressiveFile(input: {
  hierarchyIndex: GraphHierarchyIndex;
  scope: GraphHierarchyScope;
  cluster: GraphHierarchyCluster;
  fileId: string;
  rawNodes: SemanticGraphNode[];
  members: SemanticGraphEdgeMember[];
  displayMode: GraphExplorerDisplayMode;
  relationshipSource: GraphRelationshipSource;
  options: GraphScopeOption[];
  materializedNodeId: string | null;
}): HierarchicalSemanticGraph | null {
  const {
    hierarchyIndex, scope, cluster, fileId, rawNodes, members, displayMode, relationshipSource, options,
    materializedNodeId,
  } = input;
  const rawNodesById = new Map(rawNodes.map((node) => [node.id, node]));
  const file = rawNodesById.get(fileId);
  const fileLocation = hierarchyIndex.fileLocationById.get(fileId);
  if (!file || file.rawType !== "file"
    || fileLocation?.scopeId !== scope.id
    || fileLocation.clusterId !== cluster.id) return null;
  const ownedLeaves = rawNodes
    .filter((node) => hierarchyIndex.nodeLocationById.get(node.id)?.fileId === fileId
      && graphNodePlacementClass(node.rawType) === "file-leaf")
    .sort((left, right) => compareStable(left.id, right.id));
  const ownedIds = new Set([fileId, ...ownedLeaves.map((node) => node.id)]);
  const allowedMembers = members.filter((member) =>
    progressiveMemberAllowed(member, displayMode, relationshipSource, true));
  const relatedIds = new Set<string>();
  for (const member of allowedMembers) {
    if (ownedIds.has(member.source) && !ownedIds.has(member.target)) relatedIds.add(member.target);
    if (ownedIds.has(member.target) && !ownedIds.has(member.source)) relatedIds.add(member.source);
  }
  const related = [...relatedIds]
    .map((nodeId) => rawNodesById.get(nodeId))
    .filter((node): node is SemanticGraphNode => Boolean(node))
    .sort((left, right) => compareStable(left.id, right.id));
  const candidates = [...ownedLeaves, ...related.filter((node) => !ownedIds.has(node.id))];
  const visibleRest = cappedWithMaterialized(candidates, MAX_FILE_NODES - 1, materializedNodeId);
  const nodes = [file, ...visibleRest].map((node) => progressiveRawNode(node, hierarchyIndex));
  const visibleIds = new Set(nodes.map((node) => node.id));
  const projected = allowedMembers.flatMap((member): ProjectedEdgeMember[] =>
    visibleIds.has(member.source) && visibleIds.has(member.target)
      ? [{ source: member.source, target: member.target, member }]
      : []);
  const empty = ownedLeaves.length === 0 ? "当前文件没有可展示的符号。" : null;
  return {
    nodes,
    edges: bundleProjectedMembers(projected),
    presentation: presentation(
      displayMode,
      relationshipSource,
      "file",
      options,
      [
        { level: "overview", label: "全局概览" },
        { level: "scope", label: scope.label, scopeId: scope.id },
        { level: "cluster", label: cluster.label, scopeId: scope.id, clusterId: cluster.id },
        { level: "file", label: file.label, scopeId: scope.id, clusterId: cluster.id, fileId },
      ],
      1 + candidates.length,
      Math.max(0, 1 + candidates.length - nodes.length),
      Boolean(materializedNodeId),
      scope.id,
      cluster.id,
      fileId,
      empty,
    ),
  };
}

function buildProgressiveHierarchicalSemanticGraph(input: BuildHierarchicalGraphInput & {
  hierarchyIndex: GraphHierarchyIndex;
}): HierarchicalSemanticGraph {
  const {
    graph, hierarchyIndex, wikiIndex, mode, navigation, materializedNodeId = null,
  } = input;
  const displayMode = normalizeGraphExplorerMode(mode);
  const relationshipSource = resolveGraphRelationshipSource(graph);
  const raw = buildSemanticGraph({ graph, wikiIndex, mode: "global", focusNodeIds: [] });
  const members = graphMembers(raw);
  const options = progressiveScopeOptions(hierarchyIndex, new Map(raw.nodes.map((node) => [node.id, node])), displayMode);
  const scope = navigation.scopeId ? hierarchyIndex.scopeById.get(navigation.scopeId) : undefined;
  const cluster = navigation.clusterId ? hierarchyIndex.clusterById.get(navigation.clusterId) : undefined;

  if (navigation.level === "file" && scope && cluster && cluster.scopeId === scope.id && navigation.fileId) {
    const file = progressiveFile({
      hierarchyIndex,
      scope,
      cluster,
      fileId: navigation.fileId,
      rawNodes: raw.nodes,
      members,
      displayMode,
      relationshipSource,
      options,
      materializedNodeId,
    });
    if (file) return file;
  }
  if (navigation.level === "cluster" && scope && cluster && cluster.scopeId === scope.id) {
    return progressiveCluster({
      hierarchyIndex,
      scope,
      cluster,
      rawNodes: raw.nodes,
      members,
      displayMode,
      relationshipSource,
      options,
      materializedNodeId,
    });
  }
  if ((navigation.level === "scope" || navigation.level === "cluster" || navigation.level === "file") && scope) {
    return progressiveScope({
      hierarchyIndex,
      scope,
      rawNodes: raw.nodes,
      members,
      displayMode,
      relationshipSource,
      options,
      materializedNodeId,
    });
  }
  return progressiveOverview({
    hierarchyIndex,
    rawNodes: raw.nodes,
    members,
    displayMode,
    relationshipSource,
    options,
    materializedNodeId,
  });
}

export function buildHierarchicalSemanticGraph({
  graph,
  hierarchyIndex,
  wikiIndex,
  mode,
  navigation,
  materializedNodeId,
}: BuildHierarchicalGraphInput): HierarchicalSemanticGraph {
  return buildProgressiveHierarchicalSemanticGraph({
    graph,
    hierarchyIndex,
    wikiIndex,
    mode,
    navigation,
    materializedNodeId,
  });
}

function semanticMemberIdentity(member: SemanticGraphEdgeMember): string {
  return member.id || [member.source, member.target, member.type, member.direction, member.weight].join("\u0000");
}

export function buildHierarchySelectionExpansion(input: {
  graph: KnowledgeGraph;
  hierarchyIndex: GraphHierarchyIndex;
  baseGraph: HierarchicalSemanticGraph;
  wikiIndex?: WikiRuntimeIndex;
  mode: GraphExplorerMode;
  selectedNodeId: string | null;
  selectedNodeWasVisible?: boolean;
}): HierarchicalGraphSelectionExpansion {
  const {
    graph,
    hierarchyIndex,
    baseGraph,
    wikiIndex,
    mode,
    selectedNodeId,
    selectedNodeWasVisible = false,
  } = input;
  if (!selectedNodeId) return { nodes: [], edges: [] };

  const raw = buildSemanticGraph({ graph, wikiIndex, mode: "global", focusNodeIds: [] });
  const rawNodesById = new Map(raw.nodes.map((node) => [node.id, node]));
  const displayMode = normalizeGraphExplorerMode(mode);
  const relationshipSource = baseGraph.presentation.relationshipSource;
  const rawMembers = graphMembers(raw);
  const members = rawMembers.filter((member) =>
    progressiveMemberAllowed(member, displayMode, relationshipSource, true));
  const level = baseGraph.presentation.level;
  const currentScopeId = baseGraph.presentation.scopeId;
  const currentClusterId = baseGraph.presentation.clusterId;
  const currentFileId = baseGraph.presentation.fileId;
  const contextualFactsByScopeId = new Map<string, Map<string, SemanticGraphEdgeMember[]>>();
  const contextualFactsForScope = (scopeId: string) => {
    const cached = contextualFactsByScopeId.get(scopeId);
    if (cached) return cached;
    const ownsInternal = level === "overview"
      ? (nodeId: string) => hierarchyIndex.nodeLocationById.get(nodeId)?.scopeId === scopeId
      : level === "scope" && scopeId === currentScopeId
        ? (nodeId: string) => hierarchyIndex.nodeLocationById.get(nodeId)?.scopeId === scopeId
        : level === "cluster" && scopeId === currentScopeId && currentClusterId
          ? (nodeId: string) => clusterOwnsContextNode(hierarchyIndex, currentClusterId, nodeId)
          : () => false;
    const facts = contextualBoundaryMembers({
      currentScopeId: scopeId,
      members: rawMembers,
      hierarchyIndex,
      ownsInternal,
    });
    contextualFactsByScopeId.set(scopeId, facts);
    return facts;
  };
  const portalDescriptors = new Map<string, { currentScopeId: string; targetScopeId: string }>();
  for (const member of rawMembers) {
    const sourceScopeId = hierarchyIndex.nodeLocationById.get(member.source)?.scopeId;
    const targetScopeId = hierarchyIndex.nodeLocationById.get(member.target)?.scopeId;
    if (!sourceScopeId || !targetScopeId || sourceScopeId === targetScopeId) continue;
    portalDescriptors.set(boundaryNodeId(sourceScopeId, targetScopeId), {
      currentScopeId: sourceScopeId,
      targetScopeId,
    });
    portalDescriptors.set(boundaryNodeId(targetScopeId, sourceScopeId), {
      currentScopeId: targetScopeId,
      targetScopeId: sourceScopeId,
    });
  }

  const mapOverviewEndpoint = (nodeId: string): string | null => {
    const node = rawNodesById.get(nodeId);
    const location = hierarchyIndex.nodeLocationById.get(nodeId);
    if (!node || !location) return null;
    return graphNodePlacementClass(node.rawType) === "architecture-context"
      ? nodeId
      : scopeNodeId(location.scopeId);
  };
  const mapScopeEndpoint = (nodeId: string): string | null => {
    const node = rawNodesById.get(nodeId);
    const location = hierarchyIndex.nodeLocationById.get(nodeId);
    if (!node || !currentScopeId || location?.scopeId !== currentScopeId) return null;
    if (graphNodePlacementClass(node.rawType) === "architecture-context") return nodeId;
    return location.clusterId ?? null;
  };
  const mapClusterEndpoint = (nodeId: string): string | null => {
    const node = rawNodesById.get(nodeId);
    const location = hierarchyIndex.nodeLocationById.get(nodeId);
    if (!node || !currentScopeId || !currentClusterId
      || location?.scopeId !== currentScopeId || location.clusterId !== currentClusterId) return null;
    if (node.rawType === "file") return node.id;
    if (graphNodePlacementClass(node.rawType) !== "file-leaf") return null;
    return location.fileId ?? node.id;
  };
  const projectMember = (member: SemanticGraphEdgeMember): ProjectedEdgeMember[] => {
    const sourceLocation = hierarchyIndex.nodeLocationById.get(member.source);
    const targetLocation = hierarchyIndex.nodeLocationById.get(member.target);
    if (level === "file") {
      return rawNodesById.has(member.source) && rawNodesById.has(member.target)
        ? [{ source: member.source, target: member.target, member }]
        : [];
    }
    if (!sourceLocation?.scopeId || !targetLocation?.scopeId) return [];
    if (level === "overview") {
      if (sourceLocation.scopeId !== targetLocation.scopeId) {
        const source = mapOverviewEndpoint(member.source);
        const target = mapOverviewEndpoint(member.target);
        const outgoingPortal = boundaryNodeId(sourceLocation.scopeId, targetLocation.scopeId);
        const incomingPortal = boundaryNodeId(targetLocation.scopeId, sourceLocation.scopeId);
        return [
          ...(source ? [{
            source,
            target: outgoingPortal,
            member,
            boundaryContext: {
              currentScopeId: sourceLocation.scopeId,
              targetScopeId: targetLocation.scopeId,
            },
          }] : []),
          ...(target ? [{
            source: incomingPortal,
            target,
            member,
            boundaryContext: {
              currentScopeId: targetLocation.scopeId,
              targetScopeId: sourceLocation.scopeId,
            },
          }] : []),
        ];
      }
      const source = mapOverviewEndpoint(member.source);
      const target = mapOverviewEndpoint(member.target);
      return source && target ? [{ source, target, member }] : [];
    }
    if (!currentScopeId) return [];
    const mapInternal = level === "scope" ? mapScopeEndpoint : mapClusterEndpoint;
    if (sourceLocation.scopeId === currentScopeId && targetLocation.scopeId === currentScopeId) {
      const source = mapInternal(member.source);
      const target = mapInternal(member.target);
      return source && target ? [{ source, target, member }] : [];
    }
    if (sourceLocation.scopeId === currentScopeId) {
      const source = mapInternal(member.source);
      return source ? [{
        source,
        target: boundaryNodeId(currentScopeId, targetLocation.scopeId),
        member,
        boundaryContext: { currentScopeId, targetScopeId: targetLocation.scopeId },
      }] : [];
    }
    if (targetLocation.scopeId === currentScopeId) {
      const target = mapInternal(member.target);
      return target ? [{
        source: boundaryNodeId(currentScopeId, sourceLocation.scopeId),
        target,
        member,
        boundaryContext: { currentScopeId, targetScopeId: sourceLocation.scopeId },
      }] : [];
    }
    return [];
  };

  const projected = members.flatMap(projectMember).filter(({ source, target }) => source !== target);
  const baseNodeById = new Map(baseGraph.nodes.map((node) => [node.id, node]));
  const scopeByRenderedNodeId = new Map(
    hierarchyIndex.scopes.map((scope) => [scopeNodeId(scope.id), scope]),
  );
  const rawSelected = rawNodesById.get(selectedNodeId);
  const selectedLocation = hierarchyIndex.nodeLocationById.get(selectedNodeId);
  const selectedBoundaryCandidate = portalDescriptors.get(selectedNodeId);
  const boundaryHasCurrentContext = (boundary: { currentScopeId: string; targetScopeId: string }): boolean => {
    if (level === "file") return false;
    if (level !== "overview" && boundary.currentScopeId !== currentScopeId) return false;
    return contextualFactsForScope(boundary.currentScopeId).has(boundary.targetScopeId);
  };
  const selectedBoundary = selectedBoundaryCandidate
    && boundaryHasCurrentContext(selectedBoundaryCandidate)
    ? selectedBoundaryCandidate
    : null;
  const selectedScope = scopeByRenderedNodeId.get(selectedNodeId);
  const selectedCluster = hierarchyIndex.clusterById.get(selectedNodeId);
  const fileOwnedIds = new Set(level === "file" && currentFileId
    ? raw.nodes.filter((node) => {
      const location = hierarchyIndex.nodeLocationById.get(node.id);
      return node.id === currentFileId
        || (graphNodePlacementClass(node.rawType) === "file-leaf"
          && location?.fileId === currentFileId);
    }).map((node) => node.id)
    : []);
  const fileCandidateIds = new Set(fileOwnedIds);
  if (level === "file") {
    for (const member of members) {
      if (fileOwnedIds.has(member.source)) fileCandidateIds.add(member.target);
      if (fileOwnedIds.has(member.target)) fileCandidateIds.add(member.source);
    }
  }
  const selectedIsRepresentableRaw = Boolean(rawSelected && (
    selectedNodeWasVisible
    || baseNodeById.has(selectedNodeId)
    || (level === "overview" && graphNodePlacementClass(rawSelected.rawType) === "architecture-context")
    || (level === "scope" && selectedLocation?.scopeId === currentScopeId
      && graphNodePlacementClass(rawSelected.rawType) === "architecture-context")
    || (level === "cluster" && selectedLocation?.clusterId === currentClusterId
      && (rawSelected.rawType === "file"
        || (graphNodePlacementClass(rawSelected.rawType) === "file-leaf" && !selectedLocation.fileId)))
    || (level === "file" && fileCandidateIds.has(selectedNodeId))
  ));
  const selectedIsRepresentableAggregate = Boolean(
    (selectedScope && level === "overview")
    || (selectedCluster && level === "scope" && selectedCluster.scopeId === currentScopeId)
    || selectedBoundary,
  );
  if (!selectedIsRepresentableRaw && !selectedIsRepresentableAggregate) {
    return { nodes: [], edges: [] };
  }

  const incidentProjected = selectedIsRepresentableRaw
    ? members.flatMap((member): ProjectedEdgeMember[] =>
      member.source === selectedNodeId || member.target === selectedNodeId
        ? [{ source: member.source, target: member.target, member }]
        : [])
    : projected.filter(({ source, target }) => source === selectedNodeId || target === selectedNodeId);
  const requiredIds = new Set<string>([
    selectedNodeId,
    ...incidentProjected.flatMap(({ source, target }) => [source, target]),
  ]);
  let rawRelationCounts: HierarchyRelationCounts | null = null;
  let displayRelationCounts: HierarchyRelationCounts | null = null;
  const rawRelationCountForScope = (scopeId: string): number => {
    rawRelationCounts ??= hierarchyRelationCounts(rawMembers, hierarchyIndex);
    return rawRelationCounts.scopeById.get(scopeId) ?? 0;
  };
  const displayRelationCountForCluster = (clusterId: string): number => {
    displayRelationCounts ??= hierarchyRelationCounts(members, hierarchyIndex);
    return displayRelationCounts.clusterById.get(clusterId) ?? 0;
  };
  const nodeForId = (id: string): HierarchicalSemanticGraphNode | null => {
    const base = baseNodeById.get(id);
    if (base) return base;
    const rawNode = rawNodesById.get(id);
    if (rawNode) return progressiveRawNode(rawNode, hierarchyIndex, rawNode.rawType === "file");
    const scope = scopeByRenderedNodeId.get(id);
    if (scope) return hierarchyScopeNode(
      scope,
      rawNodesById,
      rawRelationCountForScope(scope.id),
      displayMode,
    );
    const cluster = hierarchyIndex.clusterById.get(id);
    if (cluster) return hierarchyClusterNode(
      cluster,
      rawNodesById,
      displayRelationCountForCluster(cluster.id),
      displayMode,
    );
    const boundaryCandidate = portalDescriptors.get(id);
    const boundary = boundaryCandidate
      && boundaryHasCurrentContext(boundaryCandidate)
      ? boundaryCandidate
      : null;
    const targetScope = boundary ? hierarchyIndex.scopeById.get(boundary.targetScopeId) : undefined;
    if (!boundary || !targetScope) return null;
    const relationCount = contextualFactsForScope(boundary.currentScopeId)
      .get(boundary.targetScopeId)?.length ?? 0;
    return hierarchyBoundaryNode(
      boundary.currentScopeId,
      targetScope,
      rawNodesById,
      relationCount,
      displayMode,
    );
  };
  const nodes = [...requiredIds]
    .sort(compareStable)
    .map(nodeForId)
    .filter((node): node is HierarchicalSemanticGraphNode => Boolean(node));
  const edges = bundleProjectedMembers(incidentProjected, null);
  return { nodes, edges };
}

export function mergeHierarchySelectionExpansion(
  baseGraph: HierarchicalSemanticGraph,
  expansion: HierarchicalGraphSelectionExpansion,
): HierarchicalSemanticGraph {
  const baseNodeIds = new Set(baseGraph.nodes.map((node) => node.id));
  const missingNodes = expansion.nodes
    .filter((node) => !baseNodeIds.has(node.id))
    .sort((left, right) => compareStable(left.id, right.id));
  const edgesById = new Map(baseGraph.edges.map((edge) => [edge.id, edge]));
  const appendedEdges: HierarchicalSemanticGraphEdge[] = [];
  for (const expansionEdge of expansion.edges) {
    const baseEdge = edgesById.get(expansionEdge.id);
    if (!baseEdge) {
      appendedEdges.push(expansionEdge);
      edgesById.set(expansionEdge.id, expansionEdge);
      continue;
    }
    const membersById = new Map(baseEdge.members.map((member) => [semanticMemberIdentity(member), member]));
    for (const member of expansionEdge.members) {
      const identity = semanticMemberIdentity(member);
      if (!membersById.has(identity)) membersById.set(identity, member);
    }
    const members = [...membersById.values()];
    const merged: HierarchicalSemanticGraphEdge = {
      ...baseEdge,
      weight: Math.max(baseEdge.weight, expansionEdge.weight, ...members.map((member) => member.weight)),
      bundledCount: members.length,
      members,
      edgeTypes: [...new Set(members.map((member) => member.type))],
      directions: [...new Set(members.map((member) => member.direction))],
      ...(baseEdge.boundaryContext || expansionEdge.boundaryContext
        ? { boundaryContext: baseEdge.boundaryContext ?? expansionEdge.boundaryContext }
        : {}),
    };
    edgesById.set(merged.id, merged);
  }
  const edges = [
    ...baseGraph.edges.map((edge) => edgesById.get(edge.id)!),
    ...appendedEdges.sort((left, right) => compareStable(left.id, right.id)),
  ];
  return {
    ...baseGraph,
    nodes: [...baseGraph.nodes, ...missingNodes],
    edges,
    presentation: baseGraph.presentation,
  };
}
