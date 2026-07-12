import type { GraphNode, KnowledgeGraph } from "@understand-code/core/types";
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
export type GraphNavigationLevel = "overview" | "scope" | "file";

export interface GraphExplorerNavigation {
  level: GraphNavigationLevel;
  scopeId?: string;
  fileId?: string;
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
  fileId?: string;
}

export interface HierarchicalGraphPresentation {
  displayMode: GraphExplorerDisplayMode;
  level: GraphNavigationLevel;
  relationshipSource: GraphRelationshipSource;
  scopeId: string | null;
  fileId: string | null;
  scopeOptions: GraphScopeOption[];
  breadcrumbs: GraphBreadcrumbItem[];
  totalNodeCount: number;
  hiddenNodeCount: number;
  focusApplied: boolean;
  notice: string | null;
}

export interface HierarchicalSemanticGraphNode extends SemanticGraphNode {
  kind?: "node" | "scope" | "boundary";
  scopeId?: string;
  containedNodeIds?: string[];
  childCount?: number;
  fileCount?: number;
  relationCount?: number;
  canDrillDown?: boolean;
}

export interface HierarchicalSemanticGraph extends Omit<SemanticGraph, "nodes"> {
  nodes: HierarchicalSemanticGraphNode[];
  presentation: HierarchicalGraphPresentation;
}

export interface BuildHierarchicalGraphInput {
  graph: KnowledgeGraph;
  wikiIndex?: WikiRuntimeIndex;
  mode: GraphExplorerMode;
  focusNodeIds: string[];
  selectedNodeId: string | null;
  navigation: GraphExplorerNavigation;
}

interface InternalScope {
  id: string;
  label: string;
  description: string;
  nodeIds: string[];
  order: number;
}

const MAX_OVERVIEW_SCOPES = 16;
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
  fileId: string | null = null,
): HierarchicalGraphPresentation {
  return {
    displayMode,
    level,
    relationshipSource,
    scopeId,
    fileId,
    scopeOptions: options,
    breadcrumbs,
    totalNodeCount,
    hiddenNodeCount,
    focusApplied,
    notice: fallbackNotice(relationshipSource, displayMode),
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
      fileId,
    ),
  };
}

export function buildHierarchicalSemanticGraph({
  graph,
  wikiIndex,
  mode,
  focusNodeIds,
  selectedNodeId,
  navigation,
}: BuildHierarchicalGraphInput): HierarchicalSemanticGraph {
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
