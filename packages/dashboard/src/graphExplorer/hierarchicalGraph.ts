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
  /** Optional only for compatibility with Task 3-owned presentation fixtures. Builders always set it. */
  clusterId?: string | null;
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

export interface BuildHierarchicalGraphInput {
  graph: KnowledgeGraph;
  hierarchyIndex?: GraphHierarchyIndex;
  wikiIndex?: WikiRuntimeIndex;
  mode: GraphExplorerMode;
  navigation: GraphExplorerNavigation;
  materializedNodeId?: string | null;
  /** Compatibility shim for Task 3-owned callers. Ignored by the progressive base builder. */
  focusNodeIds?: string[];
  /** Compatibility shim for Task 3-owned callers. Ignored by the progressive base builder. */
  selectedNodeId?: string | null;
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
const MAX_SCOPE_NODES = 30;
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
  for (const node of stableGraph.nodes) {
    if (node.filePath !== undefined
      || explicitlyLayeredNodeIds.has(node.id)
      || graphNodePlacementClass(node.type) !== "architecture-context") continue;
    const containingLayerScope = stableGraph.edges
      .filter((edge) => edge.type === "contains" && edge.target === node.id)
      .map((edge) => nodeScopeId.get(edge.source))
      .filter((scopeId): scopeId is string => scopeId !== undefined && layerScopeOrder.has(scopeId))
      .sort((left, right) => (layerScopeOrder.get(left) ?? Number.MAX_SAFE_INTEGER)
        - (layerScopeOrder.get(right) ?? Number.MAX_SAFE_INTEGER)
        || compareStable(left, right))[0];
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

  const containingFileIdsByNode = new Map<string, string[]>();
  for (const edge of stableGraph.edges) {
    if (edge.type !== "contains" || !fileNodeIds.has(edge.source)) continue;
    const owners = containingFileIdsByNode.get(edge.target) ?? [];
    owners.push(edge.source);
    containingFileIdsByNode.set(edge.target, owners);
  }
  for (const owners of containingFileIdsByNode.values()) owners.sort(compareStable);

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
      const containingFileId = containingFileIdsByNode.get(node.id)?.[0];
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
    const containingFileId = containingFileIdsByNode.get(node.id)?.[0];
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

function memberAllowed(
  member: SemanticGraphEdgeMember,
  mode: GraphExplorerDisplayMode,
  relationshipSource: GraphRelationshipSource,
  includeContainment: boolean,
): boolean {
  if (includeContainment && member.type === "contains") return true;
  if (mode === "call") {
    if (relationshipSource === "calls") return member.type === "calls";
    if (relationshipSource === "imports") return member.type === "imports";
    return DEPENDENCY_EDGE_TYPES.has(member.type);
  }
  if (mode === "coverage") return member.type !== "calls";
  return member.type !== "calls" && member.type !== "documents";
}

function nodeAllowed(
  node: SemanticGraphNode,
  mode: GraphExplorerDisplayMode,
  relationshipSource: GraphRelationshipSource,
): boolean {
  if (mode === "call") {
    if (relationshipSource === "calls") {
      return node.rawType === "file" || node.rawType === "function" || node.rawType === "class";
    }
    if (relationshipSource === "imports") return node.rawType === "file" || node.rawType === "config";
    return node.group !== "document" && node.group !== "symbol";
  }
  if (mode === "coverage") return true;
  return node.group !== "symbol" && node.group !== "document";
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

function scopeNode(
  scope: InternalScope,
  nodes: SemanticGraphNode[],
  relationCount: number,
  displayMode: GraphExplorerDisplayMode,
  kind: "scope" | "boundary" = "scope",
): HierarchicalSemanticGraphNode {
  const { docs, documentationCounts: counts } = aggregateDocumentation(nodes, displayMode);
  const fileCount = nodes.filter((node) => node.rawType === "file").length;
  return {
    id: `${kind === "boundary" ? "boundary" : "scope"}:${scope.id}`,
    kind,
    label: scope.label,
    group: kind === "boundary" ? "other" : "module",
    category: kind === "boundary" ? "other" : "module",
    cluster: scope.label,
    importance: kind === "boundary" ? 0.5 : 0.85,
    rawType: "module",
    summary: `${scope.description}。包含 ${nodes.length} 个节点、${fileCount} 个文件、${relationCount} 条跨范围关系。`,
    docs,
    documentationCounts: counts,
    scopeId: scope.id,
    containedNodeIds: nodes.map((node) => node.id),
    childCount: nodes.length,
    fileCount,
    relationCount,
    canDrillDown: true,
  };
}

function remapMember(
  member: SemanticGraphEdgeMember,
  source: string,
  target: string,
): SemanticGraphEdgeMember {
  return { ...member, id: `${member.id}:${source}->${target}`, source, target };
}

function bundleMembers(
  members: SemanticGraphEdgeMember[],
  selectedNodeId: string | null,
): SemanticGraphEdge[] {
  const bundled = new Map<string, SemanticGraphEdge>();
  for (const member of members) {
    if (member.source === member.target) continue;
    const key = `${member.source}->${member.target}`;
    const current = bundled.get(key);
    if (current) {
      current.bundledCount += 1;
      current.weight = Math.max(current.weight, member.weight);
      if (!current.edgeTypes.includes(member.type)) current.edgeTypes.push(member.type);
      if (!current.directions.includes(member.direction)) current.directions.push(member.direction);
      current.members.push(member);
      continue;
    }
    bundled.set(key, {
      id: key,
      source: member.source,
      target: member.target,
      type: member.type,
      direction: member.direction,
      edgeTypes: [member.type],
      directions: [member.direction],
      weight: member.weight,
      bundledCount: 1,
      members: [member],
    });
  }
  const ordered = [...bundled.values()]
    .sort((a, b) => b.bundledCount - a.bundledCount || b.weight - a.weight || a.id.localeCompare(b.id));
  if (!selectedNodeId) return ordered.slice(0, MAX_VISIBLE_EDGES);
  const incident = ordered.filter((edge) => edge.source === selectedNodeId || edge.target === selectedNodeId);
  const unrelated = ordered.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId);
  return [...incident, ...unrelated.slice(0, Math.max(0, MAX_VISIBLE_EDGES - incident.length))];
}

function degreeByNode(members: SemanticGraphEdgeMember[]): Map<string, number> {
  const degree = new Map<string, number>();
  for (const member of members) {
    degree.set(member.source, (degree.get(member.source) ?? 0) + 1);
    degree.set(member.target, (degree.get(member.target) ?? 0) + 1);
  }
  return degree;
}

function pinnedNodeIds(
  selectedNodeId: string | null,
  candidates: SemanticGraphNode[],
  members: SemanticGraphEdgeMember[],
): Set<string> {
  const candidateIds = new Set(candidates.map((node) => node.id));
  const pinned = new Set<string>();
  if (!selectedNodeId || !candidateIds.has(selectedNodeId)) return pinned;
  pinned.add(selectedNodeId);
  for (const member of members) {
    if (member.source === selectedNodeId && candidateIds.has(member.target)) pinned.add(member.target);
    if (member.target === selectedNodeId && candidateIds.has(member.source)) pinned.add(member.source);
  }
  return pinned;
}

function rankedNodes(
  nodes: SemanticGraphNode[],
  members: SemanticGraphEdgeMember[],
  limit: number,
  selectedNodeId: string | null,
): SemanticGraphNode[] {
  const pinned = pinnedNodeIds(selectedNodeId, nodes, members);
  const degree = degreeByNode(members);
  const relationScore = (node: SemanticGraphNode): number =>
    node.docs.relation === "direct" ? 2 : node.docs.relation === "context" ? 1 : 0;
  const sortByRank = (a: SemanticGraphNode, b: SemanticGraphNode): number => {
    const problemOrder = Number(hasDocumentationProblem(a.docs)) - Number(hasDocumentationProblem(b.docs));
    if (problemOrder !== 0) return problemOrder;
    const aScore = a.importance * 10 + (degree.get(a.id) ?? 0) + relationScore(a);
    const bScore = b.importance * 10 + (degree.get(b.id) ?? 0) + relationScore(b);
    return bScore - aScore || a.label.localeCompare(b.label) || a.id.localeCompare(b.id);
  };
  const selected = nodes.filter((node) => node.id === selectedNodeId);
  const neighbors = nodes
    .filter((node) => node.id !== selectedNodeId && pinned.has(node.id))
    .sort(sortByRank);
  const required = [...selected, ...neighbors];
  const remaining = nodes.filter((node) => !pinned.has(node.id)).sort(sortByRank);
  return [...required, ...remaining.slice(0, Math.max(0, limit - required.length))];
}

function scopeOptions(
  scopes: InternalScope[],
  rawNodesById: Map<string, SemanticGraphNode>,
  availableNodeIds: Set<string>,
  displayMode: GraphExplorerDisplayMode,
): GraphScopeOption[] {
  return scopes
    .map((scope) => {
      const nodes = scope.nodeIds
        .filter((nodeId) => availableNodeIds.has(nodeId))
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
    })
    .filter((scope) => scope.nodeCount > 0)
    .sort((a, b) => b.nodeCount - a.nodeCount || a.label.localeCompare(b.label));
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

function buildOverview(
  displayMode: GraphExplorerDisplayMode,
  relationshipSource: GraphRelationshipSource,
  scopes: InternalScope[],
  rawNodes: SemanticGraphNode[],
  members: SemanticGraphEdgeMember[],
  nodeToScopeId: Map<string, string>,
  options: GraphScopeOption[],
  focusApplied: boolean,
  selectedNodeId: string | null,
): HierarchicalSemanticGraph {
  const rawNodesById = new Map(rawNodes.map((node) => [node.id, node]));
  const visibleScopeIds = new Set(options.slice(0, MAX_OVERVIEW_SCOPES).map((scope) => scope.id));
  const selectedScope = options.find((scope) => `scope:${scope.id}` === selectedNodeId);
  if (selectedScope) visibleScopeIds.add(selectedScope.id);
  const allowedMembers = members.filter((member) => memberAllowed(member, displayMode, relationshipSource, false));
  const crossCount = new Map<string, number>();
  for (const member of allowedMembers) {
    const sourceScope = nodeToScopeId.get(member.source);
    const targetScope = nodeToScopeId.get(member.target);
    if (!sourceScope || !targetScope || sourceScope === targetScope) continue;
    crossCount.set(sourceScope, (crossCount.get(sourceScope) ?? 0) + 1);
    crossCount.set(targetScope, (crossCount.get(targetScope) ?? 0) + 1);
  }
  const nodes = scopes
    .filter((scope) => visibleScopeIds.has(scope.id))
    .map((scope) => {
      const children = scope.nodeIds
        .map((nodeId) => rawNodesById.get(nodeId))
        .filter((node): node is SemanticGraphNode => Boolean(node));
      return scopeNode(scope, children, crossCount.get(scope.id) ?? 0, displayMode);
    })
    .sort((a, b) => (b.childCount ?? 0) - (a.childCount ?? 0) || a.label.localeCompare(b.label));
  const visibleIds = new Set(nodes.map((node) => node.scopeId));
  const remapped = allowedMembers.flatMap((member) => {
    const sourceScope = nodeToScopeId.get(member.source);
    const targetScope = nodeToScopeId.get(member.target);
    if (!sourceScope || !targetScope || sourceScope === targetScope) return [];
    if (!visibleIds.has(sourceScope) || !visibleIds.has(targetScope)) return [];
    return [remapMember(member, `scope:${sourceScope}`, `scope:${targetScope}`)];
  });
  return {
    nodes,
    edges: bundleMembers(remapped, selectedNodeId),
    presentation: presentation(
      displayMode,
      relationshipSource,
      "overview",
      options,
      [{ level: "overview", label: "全局概览" }],
      options.length,
      Math.max(0, options.length - nodes.length),
      focusApplied,
    ),
  };
}

function buildScopeDetail(
  displayMode: GraphExplorerDisplayMode,
  relationshipSource: GraphRelationshipSource,
  selectedScope: InternalScope,
  scopes: InternalScope[],
  rawNodes: SemanticGraphNode[],
  members: SemanticGraphEdgeMember[],
  nodeToScopeId: Map<string, string>,
  options: GraphScopeOption[],
  focusApplied: boolean,
  selectedNodeId: string | null,
): HierarchicalSemanticGraph {
  const rawNodesById = new Map(rawNodes.map((node) => [node.id, node]));
  const allowedMembers = members.filter((member) => memberAllowed(member, displayMode, relationshipSource, true));
  const candidates = selectedScope.nodeIds
    .map((nodeId) => rawNodesById.get(nodeId))
    .filter((node): node is SemanticGraphNode => Boolean(node))
    .filter((node) => nodeAllowed(node, displayMode, relationshipSource));
  const visibleInternal = rankedNodes(candidates, allowedMembers, MAX_SCOPE_NODES, selectedNodeId).map((node) => ({
    ...node,
    kind: "node" as const,
    scopeId: selectedScope.id,
    canDrillDown: node.rawType === "file",
  }));
  const visibleInternalIds = new Set(visibleInternal.map((node) => node.id));

  const boundaryCounts = new Map<string, number>();
  for (const member of allowedMembers) {
    const sourceInside = visibleInternalIds.has(member.source);
    const targetInside = visibleInternalIds.has(member.target);
    if (sourceInside === targetInside) continue;
    const externalId = sourceInside ? member.target : member.source;
    const boundaryScope = nodeToScopeId.get(externalId);
    if (!boundaryScope || boundaryScope === selectedScope.id) continue;
    boundaryCounts.set(boundaryScope, (boundaryCounts.get(boundaryScope) ?? 0) + 1);
  }
  const orderedBoundaryIds = [...boundaryCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([scopeId]) => scopeId);
  const boundaryScopeIds = new Set(orderedBoundaryIds.slice(0, MAX_BOUNDARY_SCOPES));
  if (selectedNodeId && visibleInternalIds.has(selectedNodeId)) {
    for (const member of allowedMembers) {
      const externalId = member.source === selectedNodeId
        ? member.target
        : member.target === selectedNodeId ? member.source : null;
      if (!externalId) continue;
      const boundaryScopeId = nodeToScopeId.get(externalId);
      if (boundaryScopeId && boundaryScopeId !== selectedScope.id && boundaryCounts.has(boundaryScopeId)) {
        boundaryScopeIds.add(boundaryScopeId);
      }
    }
  }
  const selectedBoundaryId = selectedNodeId?.startsWith("boundary:")
    ? selectedNodeId.slice("boundary:".length)
    : null;
  if (selectedBoundaryId && boundaryCounts.has(selectedBoundaryId)) boundaryScopeIds.add(selectedBoundaryId);
  const boundaries = scopes
    .filter((scope) => boundaryScopeIds.has(scope.id))
    .map((scope) => scopeNode(
      scope,
      scope.nodeIds
        .map((nodeId) => rawNodesById.get(nodeId))
        .filter((node): node is SemanticGraphNode => Boolean(node)),
      boundaryCounts.get(scope.id) ?? 0,
      displayMode,
      "boundary",
    ));

  const remapped = allowedMembers.flatMap((member) => {
    const sourceInside = visibleInternalIds.has(member.source);
    const targetInside = visibleInternalIds.has(member.target);
    if (sourceInside && targetInside) return [member];
    if (sourceInside === targetInside) return [];
    const externalId = sourceInside ? member.target : member.source;
    const boundaryScope = nodeToScopeId.get(externalId);
    if (!boundaryScope || !boundaryScopeIds.has(boundaryScope)) return [];
    return [sourceInside
      ? remapMember(member, member.source, `boundary:${boundaryScope}`)
      : remapMember(member, `boundary:${boundaryScope}`, member.target)];
  });
  return {
    nodes: [...visibleInternal, ...boundaries],
    edges: bundleMembers(remapped, selectedNodeId),
    presentation: presentation(
      displayMode,
      relationshipSource,
      "scope",
      options,
      [
        { level: "overview", label: "全局概览" },
        { level: "scope", label: selectedScope.label, scopeId: selectedScope.id },
      ],
      candidates.length + boundaries.length,
      Math.max(0, candidates.length - visibleInternal.length),
      focusApplied,
      selectedScope.id,
    ),
  };
}

function parentFileId(graph: KnowledgeGraph, nodeId: string): string | null {
  const contains = graph.edges.find((edge) => edge.type === "contains" && edge.target === nodeId);
  return contains?.source ?? null;
}

function buildFileDetail(
  graph: KnowledgeGraph,
  displayMode: GraphExplorerDisplayMode,
  relationshipSource: GraphRelationshipSource,
  selectedScope: InternalScope,
  fileId: string,
  rawNodes: SemanticGraphNode[],
  members: SemanticGraphEdgeMember[],
  options: GraphScopeOption[],
  focusApplied: boolean,
  selectedNodeId: string | null,
): HierarchicalSemanticGraph | null {
  const rawNodesById = new Map(rawNodes.map((node) => [node.id, node]));
  const file = rawNodesById.get(fileId);
  if (!file || file.rawType !== "file") return null;
  const allowedMembers = members.filter((member) => memberAllowed(member, displayMode, relationshipSource, true));
  const candidateIds = new Set<string>([fileId]);
  for (const member of allowedMembers) {
    if (member.type === "contains" && member.source === fileId) candidateIds.add(member.target);
  }

  if (displayMode === "call" && relationshipSource === "calls") {
    const ownedSymbols = new Set(candidateIds);
    for (const member of allowedMembers) {
      if (member.type !== "calls") continue;
      if (ownedSymbols.has(member.source)) candidateIds.add(member.target);
      if (ownedSymbols.has(member.target)) candidateIds.add(member.source);
    }
    for (const nodeId of [...candidateIds]) {
      const parentId = parentFileId(graph, nodeId);
      if (parentId && rawNodesById.has(parentId)) candidateIds.add(parentId);
    }
  } else {
    for (const member of allowedMembers) {
      if (member.source === fileId) candidateIds.add(member.target);
      if (member.target === fileId) candidateIds.add(member.source);
    }
  }

  const candidates = [...candidateIds]
    .map((nodeId) => rawNodesById.get(nodeId))
    .filter((node): node is SemanticGraphNode => Boolean(node));
  const ranked = rankedNodes(candidates, allowedMembers, MAX_FILE_NODES, selectedNodeId);
  const ordered = [file, ...ranked.filter((node) => node.id !== fileId)];
  const nodes: HierarchicalSemanticGraphNode[] = ordered.map((node) => ({
    ...node,
    kind: "node",
    scopeId: selectedScope.id,
    canDrillDown: false,
  }));
  const visibleIds = new Set(nodes.map((node) => node.id));
  const visibleMembers = allowedMembers.filter((member) =>
    visibleIds.has(member.source) && visibleIds.has(member.target));
  return {
    nodes,
    edges: bundleMembers(visibleMembers, selectedNodeId),
    presentation: presentation(
      displayMode,
      relationshipSource,
      "file",
      options,
      [
        { level: "overview", label: "全局概览" },
        { level: "scope", label: selectedScope.label, scopeId: selectedScope.id },
        { level: "file", label: file.label, scopeId: selectedScope.id, fileId },
      ],
      candidates.length,
      Math.max(0, candidates.length - nodes.length),
      focusApplied,
      selectedScope.id,
      null,
      fileId,
    ),
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

function bundleProjectedMembers(projected: ProjectedEdgeMember[]): HierarchicalSemanticGraphEdge[] {
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
  return [...bundled.values()]
    .sort((left, right) => right.bundledCount - left.bundledCount
      || right.weight - left.weight
      || compareStable(left.id, right.id))
    .slice(0, MAX_VISIBLE_EDGES)
    .map((edge) => ({ ...edge, bundledCount: edge.members.length }));
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
  return member.type !== "calls" && member.type !== "documents";
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
  members: readonly SemanticGraphEdgeMember[],
  displayMode: GraphExplorerDisplayMode,
): HierarchicalSemanticGraphNode {
  const children = scope.nodeIds
    .map((nodeId) => rawNodesById.get(nodeId))
    .filter((node): node is SemanticGraphNode => Boolean(node));
  const relationCount = members.filter((member) => {
    const sourceInside = scope.nodeIds.includes(member.source);
    const targetInside = scope.nodeIds.includes(member.target);
    return sourceInside !== targetInside;
  }).length;
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
  members: readonly SemanticGraphEdgeMember[],
  displayMode: GraphExplorerDisplayMode,
): HierarchicalSemanticGraphNode {
  const children = cluster.nodeIds
    .map((nodeId) => rawNodesById.get(nodeId))
    .filter((node): node is SemanticGraphNode => Boolean(node));
  const childIds = new Set(cluster.nodeIds);
  const relationCount = members.filter((member) =>
    childIds.has(member.source) || childIds.has(member.target)).length;
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
  return hierarchyIndex.nodeLocationById.get(materializedNodeId)?.clusterId ?? null;
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
  const visibleScopes = cappedWithMaterialized(
    hierarchyIndex.scopes,
    MAX_OVERVIEW_SCOPES,
    materializedScopeId(materializedNodeId, hierarchyIndex),
  );
  const architecture = rawNodes
    .filter((node) => graphNodePlacementClass(node.rawType) === "architecture-context")
    .sort((left, right) => compareStable(left.id, right.id));
  const visibleArchitecture = cappedWithMaterialized(
    architecture,
    MAX_OVERVIEW_ARCHITECTURE,
    architecture.some((node) => node.id === materializedNodeId) ? materializedNodeId : null,
  );
  const nodes: HierarchicalSemanticGraphNode[] = [
    ...visibleScopes.map((scope) => hierarchyScopeNode(scope, rawNodesById, members, displayMode)),
    ...visibleArchitecture.map((node) => progressiveRawNode(node, hierarchyIndex)),
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
  const projected = members
    .filter((member) => progressiveMemberAllowed(member, displayMode, relationshipSource, false))
    .flatMap((member): ProjectedEdgeMember[] => {
      const source = mappedEndpoint(member.source);
      const target = mappedEndpoint(member.target);
      return source && target ? [{ source, target, member }] : [];
    });
  const hidden = (hierarchyIndex.scopes.length - visibleScopes.length)
    + (architecture.length - visibleArchitecture.length);
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
      hierarchyIndex.scopes.length + architecture.length,
      hidden,
      Boolean(materializedNodeId && (hierarchyIndex.nodeById.has(materializedNodeId)
        || hierarchyIndex.clusterById.has(materializedNodeId))),
      null,
      null,
      null,
      empty,
    ),
  };
}

function boundaryScopeIdsForView(input: {
  currentScopeId: string;
  members: readonly SemanticGraphEdgeMember[];
  hierarchyIndex: GraphHierarchyIndex;
  mapInternal: (nodeId: string) => string | null;
  materializedNodeId: string | null;
}): { visible: string[]; counts: Map<string, number> } {
  const { currentScopeId, members, hierarchyIndex, mapInternal, materializedNodeId } = input;
  const counts = new Map<string, number>();
  for (const member of members) {
    const sourceScope = hierarchyIndex.nodeLocationById.get(member.source)?.scopeId;
    const targetScope = hierarchyIndex.nodeLocationById.get(member.target)?.scopeId;
    if (!sourceScope || !targetScope || sourceScope === targetScope) continue;
    if (sourceScope === currentScopeId && mapInternal(member.source)) {
      counts.set(targetScope, (counts.get(targetScope) ?? 0) + 1);
    } else if (targetScope === currentScopeId && mapInternal(member.target)) {
      counts.set(sourceScope, (counts.get(sourceScope) ?? 0) + 1);
    }
  }
  const ordered = [...counts].sort((left, right) => right[1] - left[1]
    || compareStable(left[0], right[0])).map(([scopeId]) => scopeId);
  const materializedBoundary = ordered.find((scopeId) =>
    boundaryNodeId(currentScopeId, scopeId) === materializedNodeId) ?? null;
  const visible = cappedWithMaterialized(
    ordered.map((id) => ({ id })),
    MAX_BOUNDARY_SCOPES,
    materializedBoundary,
  ).map(({ id }) => id);
  return { visible, counts };
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
  const visibleClusters = cappedWithMaterialized(
    clusters,
    MAX_SCOPE_CLUSTERS,
    materializedClusterId(materializedNodeId, hierarchyIndex),
  );
  const architecture = scope.nodeIds
    .map((nodeId) => rawNodesById.get(nodeId))
    .filter((node): node is SemanticGraphNode =>
      Boolean(node && graphNodePlacementClass(node.rawType) === "architecture-context"))
    .sort((left, right) => compareStable(left.id, right.id));
  const visibleArchitecture = cappedWithMaterialized(
    architecture,
    MAX_OVERVIEW_ARCHITECTURE,
    architecture.some((node) => node.id === materializedNodeId) ? materializedNodeId : null,
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
  const allowedMembers = members.filter((member) =>
    progressiveMemberAllowed(member, displayMode, relationshipSource, true));
  const boundaries = boundaryScopeIdsForView({
    currentScopeId: scope.id,
    members: allowedMembers,
    hierarchyIndex,
    mapInternal,
    materializedNodeId,
  });
  const boundaryIds = new Set(boundaries.visible);
  const nodes: HierarchicalSemanticGraphNode[] = [
    ...visibleClusters.map((cluster) => hierarchyClusterNode(cluster, rawNodesById, allowedMembers, displayMode)),
    ...visibleArchitecture.map((node) => progressiveRawNode(node, hierarchyIndex)),
    ...boundaries.visible.flatMap((scopeId) => {
      const target = hierarchyIndex.scopeById.get(scopeId);
      return target ? [hierarchyBoundaryNode(
        scope.id,
        target,
        rawNodesById,
        boundaries.counts.get(scopeId) ?? 0,
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
  const total = clusters.length + architecture.length + boundaries.counts.size;
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
  const materializedLocation = materializedNodeId
    ? hierarchyIndex.nodeLocationById.get(materializedNodeId)
    : undefined;
  const materializedFileId = materializedLocation?.clusterId === cluster.id
    ? materializedLocation.fileId ?? null
    : null;
  const visibleFiles = cappedWithMaterialized(files, MAX_CLUSTER_FILES, materializedFileId);
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
  const allowedMembers = members.filter((member) =>
    progressiveMemberAllowed(member, displayMode, relationshipSource, true));
  const boundaries = boundaryScopeIdsForView({
    currentScopeId: scope.id,
    members: allowedMembers,
    hierarchyIndex,
    mapInternal,
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
        boundaries.counts.get(scopeId) ?? 0,
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
  const total = files.length + directLeaves.length + boundaries.counts.size;
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
  if (!file || file.rawType !== "file") return null;
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
  focusNodeIds = [],
  selectedNodeId = null,
  navigation,
  materializedNodeId = null,
}: BuildHierarchicalGraphInput): HierarchicalSemanticGraph {
  if (hierarchyIndex) {
    return buildProgressiveHierarchicalSemanticGraph({
      graph,
      hierarchyIndex,
      wikiIndex,
      mode,
      navigation,
      materializedNodeId,
    });
  }
  const displayMode = normalizeGraphExplorerMode(mode);
  const relationshipSource = resolveGraphRelationshipSource(graph);
  const raw = buildSemanticGraph({ graph, wikiIndex, mode: "global", focusNodeIds });
  const rawNodesById = new Map(raw.nodes.map((node) => [node.id, node]));
  const availableNodeIds = new Set(raw.nodes.map((node) => node.id));
  const members = graphMembers(raw);
  const { scopes, nodeToScopeId } = deriveScopes(graph);
  const options = scopeOptions(scopes, rawNodesById, availableNodeIds, displayMode);
  const availableScopeIds = new Set(options.map((scope) => scope.id));
  const focusApplied = focusNodeIds.some((nodeId) => availableNodeIds.has(nodeId));
  const selectedScope = navigation.scopeId && availableScopeIds.has(navigation.scopeId)
    ? scopes.find((scope) => scope.id === navigation.scopeId) ?? null
    : null;

  if (navigation.level === "file" && selectedScope && navigation.fileId) {
    const fileDetail = buildFileDetail(
      graph,
      displayMode,
      relationshipSource,
      selectedScope,
      navigation.fileId,
      raw.nodes,
      members,
      options,
      focusApplied,
      selectedNodeId,
    );
    if (fileDetail) return fileDetail;
  }
  if ((navigation.level === "scope" || navigation.level === "file") && selectedScope) {
    return buildScopeDetail(
      displayMode,
      relationshipSource,
      selectedScope,
      scopes,
      raw.nodes,
      members,
      nodeToScopeId,
      options,
      focusApplied,
      selectedNodeId,
    );
  }
  if (options.length === 0) {
    return {
      nodes: [],
      edges: [],
      presentation: presentation(
        displayMode,
        relationshipSource,
        "overview",
        [],
        [{ level: "overview", label: "全局概览" }],
        0,
        0,
        focusApplied,
      ),
    };
  }
  return buildOverview(
    displayMode,
    relationshipSource,
    scopes,
    raw.nodes,
    members,
    nodeToScopeId,
    options,
    focusApplied,
    selectedNodeId,
  );
}
