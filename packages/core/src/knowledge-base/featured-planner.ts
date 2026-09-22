import type { GraphEdge, GraphNode, KnowledgeBaseProjectConfig } from "../types.js";
import { buildUniqueLabels } from "./display-label.js";
import { edgeId } from "./file-doc-planner.js";
import {
  KB_PATHS,
  businessCapabilityDocumentPath,
  businessFlowDocumentPath,
  moduleDocumentPath,
  slugPath,
} from "./paths.js";
import { applyRouteOverrides, type RoutePageInput } from "./route-overrides.js";
import type {
  BusinessCapability,
  BusinessCapabilityProfile,
  DocumentRoute,
  FeaturedPlan,
  FileDocPlan,
  FileDocTask,
  PlannedDocument,
  ProjectProfile,
  SymbolAnchor,
  TopicPlan,
} from "./types.js";

const BEHAVIOR_EDGE_TYPES = new Set([
  "calls",
  "triggers",
  "reads_from",
  "writes_to",
  "transforms",
  "validates",
  "configures",
]);

const ENTRY_TYPE_RANK = new Map([
  "api",
  "event",
  "job",
  "cli",
  "lifecycle",
  "generic",
].map((entryType, index) => [entryType, index]));

/**
 * Directories that hold a repository's own maintenance and build tooling.
 *
 * Deliberately narrow: "bin", "cmd" and "cli" are excluded because those
 * usually are the product's entry points, not tooling around it.
 */
const TOOLING_PATH_SEGMENTS = new Set([
  ".github",
  "build",
  "config",
  "scripts",
  "tools",
]);

/**
 * Whether a flow starts in the repository's own tooling rather than in the
 * product.
 *
 * A reader opening the knowledge base wants the system's main flows first. A
 * build script satisfies every structural test a real entry point does — it is
 * a CLI with a traversable call chain — so without this it can outrank the
 * product purely on entry type and id ordering.
 */
function startsInRepositoryTooling(node: GraphNode): boolean {
  if (node.filePath === undefined) return false;
  return node.filePath.replace(/\\/g, "/").split("/")
    .some((segment) => TOOLING_PATH_SEGMENTS.has(segment));
}

const ROUTE_STAGE_ORDER: Array<DocumentRoute["stage"]> = [
  "purpose",
  "flow",
  "rule",
  "implementation",
  "evidence",
];

interface PlannedEntry {
  nodeId: string;
  entryType: "api" | "job" | "event" | "cli" | "lifecycle" | "generic";
}

interface FlowTraversal {
  nodeIds: string[];
  edgeIds: string[];
}

interface PublishableFlow extends PlannedEntry, FlowTraversal {
  node: GraphNode;
}

export interface BuildFeaturedPlanInput {
  profile: ProjectProfile;
  businessProfile: BusinessCapabilityProfile;
  fileDocPlan: FileDocPlan;
  topicPlan: TopicPlan;
  config: KnowledgeBaseProjectConfig;
}

export function pageId(path: string): string {
  return `page:${encodeURIComponent(path.replace(/\\/g, "/"))}`;
}

function unique(values: Iterable<string>): string[] {
  return [...new Set(values)];
}

function sortedUnique(values: Iterable<string>): string[] {
  return unique(values).sort((left, right) => left.localeCompare(right));
}

function concreteSummary(value: string | undefined, documentTitle: string): string {
  const summary = value?.trim();
  return summary || `本页说明“${documentTitle}”的可验证代码事实、边界与证据入口。`;
}

function plannedDocument(
  input: Omit<PlannedDocument, "id">,
): PlannedDocument {
  return {
    id: pageId(input.path),
    ...input,
    directNodeIds: unique(input.directNodeIds),
    contextNodeIds: unique(input.contextNodeIds).filter((nodeId) => !input.directNodeIds.includes(nodeId)),
    symbolAnchors: [...input.symbolAnchors],
    representedEdgeIds: unique(input.representedEdgeIds),
  };
}

function normalizedPagePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function pathWithSuffix(path: string, suffix: string): string {
  const extension = path.match(/\.md$/i)?.[0] ?? "";
  const stem = extension ? path.slice(0, -extension.length) : path;
  return `${stem}-${suffix}${extension}`;
}

function encodedPathSuffix(stableId: string): string {
  return encodeURIComponent(stableId).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function plannerPathAllocator(exactPaths: readonly string[]): (path: string, stableId: string) => string {
  const used = new Set<string>();
  for (const path of exactPaths) {
    const normalized = normalizedPagePath(path);
    if (used.has(normalized)) {
      throw new Error(`知识库规划路径冲突：${path}`);
    }
    used.add(normalized);
  }

  return (path, stableId) => {
    if (!used.has(normalizedPagePath(path))) {
      used.add(normalizedPagePath(path));
      return path;
    }

    const suffix = encodedPathSuffix(stableId);
    let attempt = 1;
    let candidate = pathWithSuffix(path, suffix);
    while (used.has(normalizedPagePath(candidate))) {
      attempt += 1;
      candidate = pathWithSuffix(path, `${suffix}-${attempt}`);
    }
    used.add(normalizedPagePath(candidate));
    return candidate;
  };
}

function assertUniqueDocumentPaths(documents: readonly PlannedDocument[]): void {
  const paths = new Set<string>();
  const ids = new Set<string>();
  for (const document of documents) {
    const normalizedPath = normalizedPagePath(document.path);
    if (paths.has(normalizedPath) || ids.has(document.id)) {
      throw new Error(`知识库规划生成了重复页面：${document.path}`);
    }
    paths.add(normalizedPath);
    ids.add(document.id);
  }
}

function symbolAnchors(task: FileDocTask, profile: ProjectProfile): SymbolAnchor[] {
  const counts = new Map<string, number>();
  return sortedUnique([...task.functionNodeIds, ...task.classNodeIds]).map((nodeId) => {
    const base = slugPath(profile.indexes.nodesById.get(nodeId)?.name ?? nodeId);
    const count = (counts.get(base) ?? 0) + 1;
    counts.set(base, count);
    return { nodeId, anchor: count === 1 ? base : `${base}-${count}` };
  });
}

function traverseFlow(profile: ProjectProfile, entryId: string): FlowTraversal {
  const nodeIds = [entryId];
  const visited = new Set(nodeIds);
  const traversedEdgeIds = new Set<string>();
  let frontier = [entryId];

  for (let depth = 0; depth < 4 && frontier.length > 0; depth += 1) {
    const next: string[] = [];
    for (const nodeId of frontier) {
      const outgoing = profile.indexes.outgoingEdgesByNode.get(nodeId) ?? [];
      for (const edge of outgoing) {
        if (!BEHAVIOR_EDGE_TYPES.has(edge.type) || !profile.indexes.nodesById.has(edge.target)) continue;
        if (!visited.has(edge.target)) {
          if (nodeIds.length >= 32) continue;
          visited.add(edge.target);
          nodeIds.push(edge.target);
          next.push(edge.target);
        }
        if (visited.has(edge.target)) traversedEdgeIds.add(edgeId(edge));
      }
    }
    frontier = next;
  }

  return { nodeIds, edgeIds: [...traversedEdgeIds] };
}

export function flowStages(profile: ProjectProfile, entryId: string): string[] {
  return traverseFlow(profile, entryId).nodeIds;
}

function entryCandidates(
  profile: ProjectProfile,
  config: KnowledgeBaseProjectConfig,
  warnings: string[],
): PlannedEntry[] {
  const detected = new Map(profile.entryCandidates.map((entry) => [entry.nodeId, entry]));
  const entries = new Map<string, PlannedEntry>();
  for (const entry of profile.entryCandidates) {
    if (profile.indexes.nodesById.has(entry.nodeId)) {
      entries.set(entry.nodeId, { nodeId: entry.nodeId, entryType: entry.entryType });
    }
  }

  for (const nodeId of unique(config.entryNodeIds ?? [])) {
    const node = profile.indexes.nodesById.get(nodeId);
    if (!node) {
      warnings.push(`配置入口不存在：${nodeId}`);
      continue;
    }
    if (detected.has(nodeId)) continue;
    if (node.type !== "function" && node.type !== "class") {
      warnings.push(`配置入口类型不支持：${nodeId}`);
      continue;
    }
    entries.set(nodeId, { nodeId, entryType: "generic" });
  }

  return [...entries.values()].sort((left, right) =>
    (ENTRY_TYPE_RANK.get(left.entryType) ?? Number.MAX_SAFE_INTEGER)
      - (ENTRY_TYPE_RANK.get(right.entryType) ?? Number.MAX_SAFE_INTEGER)
    || left.nodeId.localeCompare(right.nodeId));
}

function fileNodeIdForNode(profile: ProjectProfile, nodeId: string): string | undefined {
  const node = profile.indexes.nodesById.get(nodeId);
  if (!node) return undefined;
  if (node.type === "file") return node.id;
  const owner = profile.indexes.functionToFileId.get(nodeId) ?? profile.indexes.classToFileId.get(nodeId);
  if (owner) return owner;
  if (!node.filePath) return undefined;
  return profile.graph.nodes.find((candidate) =>
    candidate.type === "file" && candidate.filePath?.replace(/\\/g, "/") === node.filePath?.replace(/\\/g, "/"))?.id;
}

function immediateNeighbors(profile: ProjectProfile, nodeIds: Iterable<string>): string[] {
  const included = new Set(nodeIds);
  const neighbors = new Set<string>();
  for (const nodeId of included) {
    for (const edge of [
      ...(profile.indexes.incomingEdgesByNode.get(nodeId) ?? []),
      ...(profile.indexes.outgoingEdgesByNode.get(nodeId) ?? []),
    ]) {
      if (!included.has(edge.source)) neighbors.add(edge.source);
      if (!included.has(edge.target)) neighbors.add(edge.target);
    }
  }
  return sortedUnique([...neighbors].filter((nodeId) => profile.indexes.nodesById.has(nodeId)));
}

function behaviorEdgesAmong(profile: ProjectProfile, nodeIds: Iterable<string>): string[] {
  const included = new Set(nodeIds);
  return profile.graph.edges
    .filter((edge) => BEHAVIOR_EDGE_TYPES.has(edge.type) && included.has(edge.source) && included.has(edge.target))
    .map(edgeId);
}

function capabilitySummary(
  businessProfile: BusinessCapabilityProfile,
  capability: BusinessCapability,
): string | undefined {
  const factById = new Map(businessProfile.facts.map((fact) => [fact.id, fact]));
  return capability.primaryFactIds
    .map((factId) => factById.get(factId)?.businessMeaning || factById.get(factId)?.summary)
    .find((summary): summary is string => Boolean(summary?.trim()));
}

function rankedCapabilities(businessProfile: BusinessCapabilityProfile): BusinessCapability[] {
  const confidenceRank = { high: 0, medium: 1, low: 2 } as const;
  return businessProfile.capabilities
    .filter((capability) => capability.evidenceRole === "primary"
      && capability.primaryFactIds.length >= 2
      && /\p{Script=Han}/u.test(capability.title)
      && !/[`(){}\[\];=]/u.test(capability.title)
      && !/^\s*(?:[-#]|if\b|for\b|while\b|return\b|const\b|let\b|function\b)/iu.test(capability.title))
    .sort((left, right) => confidenceRank[left.confidence] - confidenceRank[right.confidence]
      || right.score - left.score
      || left.id.localeCompare(right.id))
    .slice(0, 6);
}

function rankedLayers(profile: ProjectProfile): ProjectProfile["layerProfiles"] {
  const layerRank = (layer: ProjectProfile["layerProfiles"][number]): number => {
    const label = `${layer.id} ${layer.name}`.toLowerCase();
    if (/(?:界面|ui|view|presentation)/u.test(label)) return 0;
    if (/(?:核心|core|service|domain)/u.test(label)) return 1;
    if (/(?:配置|config)/u.test(label)) return 2;
    if (/(?:工具|utility|shared)/u.test(label)) return 3;
    if (/(?:测试|test|fixture)/u.test(label)) return 9;
    return 4;
  };
  return [...profile.layerProfiles].sort((left, right) => layerRank(left) - layerRank(right)
    || right.nodeIds.length - left.nodeIds.length
    || left.id.localeCompare(right.id));
}

function fileIdsInLayer(profile: ProjectProfile, layerId: string): string[] {
  return profile.graph.nodes
    .filter((node) => node.type === "file" && profile.indexes.nodeToLayerId.get(node.id) === layerId)
    .map((node) => node.id)
    .sort();
}

function crossFileLayerEdges(profile: ProjectProfile, layerId: string): string[] {
  const layerFiles = new Set(fileIdsInLayer(profile, layerId));
  return profile.graph.edges.filter((edge) => {
    const sourceFile = fileNodeIdForNode(profile, edge.source);
    const targetFile = fileNodeIdForNode(profile, edge.target);
    return sourceFile !== undefined
      && targetFile !== undefined
      && sourceFile !== targetFile
      && layerFiles.has(sourceFile)
      && layerFiles.has(targetFile);
  }).map(edgeId);
}

function capFeaturedDocuments(documents: PlannedDocument[]): PlannedDocument[] {
  const featured = documents.filter((document) => document.role === "featured");
  const supporting = documents.filter((document) => document.role !== "featured");
  if (featured.length <= 40) return documents;

  const kept = [...featured];
  const dropLowest = (category: PlannedDocument["category"], keepAtLeast: number): void => {
    while (kept.length > 40) {
      const candidates = kept
        .map((document, index) => ({ document, index }))
        .filter(({ document }) => document.category === category);
      if (candidates.length <= keepAtLeast) return;
      kept.splice(candidates[candidates.length - 1].index, 1);
    }
  };

  dropLowest("topic", 0);
  dropLowest("module", 1);
  dropLowest("capability", 1);
  return [...kept, ...supporting];
}

function assignRoutes(documents: PlannedDocument[]): PlannedDocument[] {
  let order = 0;
  const byCategory = ["overview", "capability", "flow", "module", "topic"] as const;
  const sourceEntryId = pageId(KB_PATHS.sourceEntry);
  const result: PlannedDocument[] = [];

  for (const category of byCategory) {
    for (const document of documents) {
      if (document.role !== "featured" || document.category !== category || document.id === sourceEntryId) continue;
      result.push({ ...document, route: { ...(document.route ?? { stage: "implementation", order }), order: order++ } });
    }
  }
  const sourceEntry = documents.find((document) => document.id === sourceEntryId);
  if (sourceEntry) {
    result.push({ ...sourceEntry, route: { ...(sourceEntry.route ?? { stage: "evidence", order }), order: order++ } });
  }
  result.push(...documents.filter((document) => document.role !== "featured"));
  return result;
}

function applyConfiguredRoutes(
  documents: PlannedDocument[],
  config: KnowledgeBaseProjectConfig,
  warnings: string[],
): PlannedDocument[] {
  const routeInput: RoutePageInput[] = documents.map((document) => ({
    id: document.id,
    role: document.role,
    ...(document.route ? { route: { ...document.route } } : {}),
  }));
  const overridden = applyRouteOverrides(routeInput, config);
  warnings.push(...overridden.warnings);
  const overriddenById = new Map(overridden.pages.map((page) => [page.id, page]));
  return documents.map((document) => {
    if (document.role === "maintenance") {
      const maintained: PlannedDocument = { ...document, role: "maintenance" };
      delete maintained.route;
      return maintained;
    }
    const page = overriddenById.get(document.id);
    if (!page) return document;
    const merged: PlannedDocument = { ...document, role: page.role };
    if (page.route) merged.route = { ...page.route };
    else delete merged.route;
    return merged;
  });
}

function sortDocuments(documents: PlannedDocument[]): PlannedDocument[] {
  const roleRank = { featured: 0, reference: 1, maintenance: 2 } as const;
  return [...documents].sort((left, right) => roleRank[left.role] - roleRank[right.role]
    || (left.role === "featured" ? (left.route?.order ?? Number.MAX_SAFE_INTEGER) - (right.route?.order ?? Number.MAX_SAFE_INTEGER) : 0)
    || left.path.localeCompare(right.path)
    || left.id.localeCompare(right.id));
}

function enforceFinalFeaturedLimit(
  documents: PlannedDocument[],
  originallyFeaturedIds: Set<string>,
  warnings: string[],
): PlannedDocument[] {
  const originalFeatured = documents.filter((document) =>
    document.role === "featured" && originallyFeaturedIds.has(document.id));
  const pinnedReferences = documents
    .filter((document) => document.role === "featured" && !originallyFeaturedIds.has(document.id))
    .sort((left, right) => (left.route?.order ?? Number.MAX_SAFE_INTEGER) - (right.route?.order ?? Number.MAX_SAFE_INTEGER));
  const allowedPinnedIds = new Set(pinnedReferences
    .slice(0, Math.max(0, 40 - originalFeatured.length))
    .map((document) => document.id));
  const limited = documents.map((document) => {
    if (document.role !== "featured" || originallyFeaturedIds.has(document.id) || allowedPinnedIds.has(document.id)) {
      return document;
    }
    const demoted: PlannedDocument = { ...document, role: "reference" };
    delete demoted.route;
    warnings.push(`页面 ${document.id} 因主阅读页面上限四十页未被置顶`);
    return demoted;
  });
  const finalOrderById = new Map(limited
    .filter((document) => document.role === "featured")
    .sort((left, right) => (left.route?.order ?? Number.MAX_SAFE_INTEGER)
      - (right.route?.order ?? Number.MAX_SAFE_INTEGER)
      || left.id.localeCompare(right.id))
    .map((document, order) => [document.id, order]));
  return limited.map((document) => document.role === "featured" && document.route
    ? { ...document, route: { ...document.route, order: finalOrderById.get(document.id)! } }
    : document);
}

export function buildFeaturedPlan(input: BuildFeaturedPlanInput): FeaturedPlan {
  const { profile, businessProfile, fileDocPlan, topicPlan, config } = input;
  const warnings: string[] = [];
  const entries = entryCandidates(profile, config, warnings);
  const publishableFlows: PublishableFlow[] = [];

  for (const entry of entries) {
    const node = profile.indexes.nodesById.get(entry.nodeId);
    if (!node) continue;
    const traversal = traverseFlow(profile, entry.nodeId);
    if (traversal.nodeIds.length < 3 || traversal.edgeIds.length < 2) {
      warnings.push(`${node.name}没有至少三个可验证行为阶段，已移入待分析状态`);
      continue;
    }
    publishableFlows.push({ ...entry, ...traversal, node });
  }

  // Product before tooling, then entry type, then the flow that actually
  // covers more of the system. The id comparison stays last so the whole
  // ordering remains deterministic for identical inputs.
  publishableFlows.sort((left, right) =>
    Number(startsInRepositoryTooling(left.node)) - Number(startsInRepositoryTooling(right.node))
    || (ENTRY_TYPE_RANK.get(left.entryType) ?? Number.MAX_SAFE_INTEGER)
      - (ENTRY_TYPE_RANK.get(right.entryType) ?? Number.MAX_SAFE_INTEGER)
    || right.nodeIds.length - left.nodeIds.length
    || right.edgeIds.length - left.edgeIds.length
    || left.nodeId.localeCompare(right.nodeId));
  publishableFlows.splice(12);

  const publishableEntryIds = publishableFlows.map((flow) => flow.nodeId);
  const publishableEntryFileIds = sortedUnique(publishableEntryIds.flatMap((nodeId) => {
    const fileId = fileNodeIdForNode(profile, nodeId);
    return fileId ? [fileId] : [];
  }));
  const sourceEntryNodeIds = entries.map((entry) => entry.nodeId);
  const sourceEntryFileIds = sortedUnique(sourceEntryNodeIds.flatMap((nodeId) => {
    const fileId = fileNodeIdForNode(profile, nodeId);
    return fileId ? [fileId] : [];
  }));
  // Repositories without inferred layers or entry candidates still have real
  // source files. Keep both mandatory reading pages anchored to those files.
  const fallbackSourceFileIds = fileDocPlan.tasks.filter((task) => task.sourceSnapshot.exists)
    .map((task) => task.fileNodeId).sort().slice(0, 6);
  if (sourceEntryFileIds.length === 0) sourceEntryFileIds.push(...fallbackSourceFileIds);
  const layerFileIds = sortedUnique(profile.layerProfiles.flatMap((layer) => fileIdsInLayer(profile, layer.id)));
  const fallbackOverviewNodeIds = rankedLayers(profile)
    .flatMap((layer) => fileIdsInLayer(profile, layer.id))
    .sort((left, right) => (profile.nodeDegrees.get(right)?.total ?? 0) - (profile.nodeDegrees.get(left)?.total ?? 0)
      || left.localeCompare(right))
    .slice(0, 6);
  const overviewDirectNodeIds = publishableEntryIds.length > 0 ? publishableEntryIds
    : fallbackOverviewNodeIds.length > 0 ? fallbackOverviewNodeIds : fallbackSourceFileIds;
  const exactPaths = [
    KB_PATHS.projectOverview,
    KB_PATHS.sourceEntry,
    KB_PATHS.qualityStatus,
    KB_PATHS.referenceCoverage,
    ...fileDocPlan.tasks.map((task) => task.documentPath),
    ...topicPlan.topics.filter((topic) => topic.tier === "required").map((topic) => topic.documentPath),
  ];
  const allocateGeneratedPath = plannerPathAllocator(exactPaths);
  const documents: PlannedDocument[] = [];

  documents.push(plannedDocument({
    path: KB_PATHS.projectOverview,
    title: "项目总览",
    summary: concreteSummary(profile.graph.project.description, "项目总览"),
    category: "overview",
    role: "featured",
    directNodeIds: overviewDirectNodeIds,
    contextNodeIds: sortedUnique([...publishableEntryFileIds, ...layerFileIds])
      .filter((nodeId) => !overviewDirectNodeIds.includes(nodeId)),
    symbolAnchors: [],
    route: { order: 0, stage: "purpose" },
    representedEdgeIds: behaviorEdgesAmong(profile, [...publishableEntryIds, ...publishableEntryFileIds, ...layerFileIds]),
    reason: "项目总览固定承载项目目的、边界与主要入口",
  }));

  for (const capability of rankedCapabilities(businessProfile).slice(0, 3)) {
    const directNodeIds = sortedUnique(capability.evidence.flatMap((evidence) => evidence.nodeId ? [evidence.nodeId] : []));
    const contextNodeIds = sortedUnique(capability.relatedNodeIds.filter((nodeId) => !directNodeIds.includes(nodeId)));
    const path = allocateGeneratedPath(
      businessCapabilityDocumentPath(capability.title, capability.id),
      capability.id,
    );
    documents.push(plannedDocument({
      path,
      title: capability.title,
      summary: concreteSummary(capabilitySummary(businessProfile, capability), capability.title),
      category: "capability",
      role: "featured",
      directNodeIds,
      contextNodeIds,
      symbolAnchors: [],
      route: { order: 0, stage: "rule" },
      representedEdgeIds: behaviorEdgesAmong(profile, [...directNodeIds, ...contextNodeIds]),
      reason: `至少两条生产事实且标题可读的核心能力进入主阅读路径；能力 ${capability.id}`,
    }));
  }

  const flowNameCounts = new Map<string, number>();
  for (const flow of publishableFlows.slice(0, 3)) {
    const key = slugPath(flow.node.name);
    flowNameCounts.set(key, (flowNameCounts.get(key) ?? 0) + 1);
  }
  // The document path was already disambiguated here, but the title was not, so
  // two flows named `main` produced two sidebar entries reading "main 业务流程".
  const flowLabels = buildUniqueLabels(publishableFlows.slice(0, 3).map((flow) => ({
    id: flow.nodeId,
    name: flow.node.name,
    filePath: flow.node.filePath ?? flow.node.id,
  })));
  for (const flow of publishableFlows.slice(0, 3)) {
    const disambiguator = (flowNameCounts.get(slugPath(flow.node.name)) ?? 0) > 1
      ? flow.node.filePath ?? flow.node.id
      : undefined;
    const title = `${flowLabels.get(flow.nodeId) ?? flow.node.name} 业务流程`;
    documents.push(plannedDocument({
      path: allocateGeneratedPath(
        businessFlowDocumentPath(flow.node.name, disambiguator),
        flow.nodeId,
      ),
      title,
      summary: concreteSummary(flow.node.summary, title),
      category: "flow",
      role: "featured",
      directNodeIds: flow.nodeIds,
      contextNodeIds: immediateNeighbors(profile, flow.nodeIds),
      symbolAnchors: [],
      route: { order: 0, stage: "flow" },
      representedEdgeIds: flow.edgeIds,
      reason: `入口 ${flow.nodeId} 具有至少三个阶段和两条可验证行为边`,
    }));
  }

  for (const layer of rankedLayers(profile).slice(0, 3)) {
    const layerSourceNodeIds = sortedUnique(fileDocPlan.tasks
      .filter((task) => profile.indexes.nodeToLayerId.get(task.fileNodeId) === layer.id && task.sourceSnapshot.exists)
      .map((task) => task.fileNodeId));
    const rankedLayerSourceNodeIds = [...layerSourceNodeIds].sort((left, right) =>
      (profile.nodeDegrees.get(right)?.total ?? 0) - (profile.nodeDegrees.get(left)?.total ?? 0)
      || left.localeCompare(right));
    const directModule = layer.nodeIds
      .map((nodeId) => profile.indexes.nodesById.get(nodeId))
      .find((node) => node?.type === "module");
    const directNodeIds = rankedLayerSourceNodeIds.slice(0, 5);
    if (directNodeIds.length === 0 && directModule) directNodeIds.push(directModule.id);
    const symbolContextNodeIds = directNodeIds.flatMap((nodeId) => [
      ...(profile.indexes.fileToFunctionIds.get(nodeId) ?? []),
      ...(profile.indexes.fileToClassIds.get(nodeId) ?? []),
    ]);
    const title = `${layer.name} 模块概览`;
    documents.push(plannedDocument({
      path: allocateGeneratedPath(moduleDocumentPath(layer.name), layer.id),
      title,
      summary: concreteSummary(layer.description, title),
      category: "module",
      role: "featured",
      directNodeIds,
      contextNodeIds: sortedUnique([
        ...layer.nodeIds.filter((nodeId) => !directNodeIds.includes(nodeId)),
        ...symbolContextNodeIds,
      ]),
      symbolAnchors: [],
      route: { order: 0, stage: "implementation" },
      representedEdgeIds: crossFileLayerEdges(profile, layer.id),
      reason: `按层 ${layer.id} 生成模块职责与边界概览`,
    }));
  }

  const rankedTopics = topicPlan.topics
    .filter((topic) => topic.tier === "required")
    .sort((left, right) => {
      const routeRank = (topic: TopicPlan["topics"][number]): number => {
        const node = profile.indexes.nodesById.get(topic.topicNodeId);
        const entryBoost = topic.reasons.some((reason) => reason.includes("entry candidate")) ? 30 : 0;
        const testPenalty = /(?:^|\/)(?:__tests__|tests?|fixtures?|examples?)(?:\/|$)|\.(?:test|spec)\./iu
          .test(node?.filePath ?? "") ? 50 : 0;
        return topic.reasons.length * 10
          + (profile.nodeDegrees.get(topic.topicNodeId)?.total ?? 0)
          + entryBoost
          - testPenalty;
      };
      const leftRank = routeRank(left);
      const rightRank = routeRank(right);
      return rightRank - leftRank || left.topicNodeId.localeCompare(right.topicNodeId);
    });
  for (const [topicIndex, topic] of rankedTopics.entries()) {
    const coveredNodeIds = unique(topic.coveredNodeIds);
    const topicNode = profile.indexes.nodesById.get(topic.topicNodeId);
    const featured = topicIndex < 2;
    documents.push(plannedDocument({
      path: topic.documentPath,
      title: topic.title,
      summary: concreteSummary(topicNode?.summary, topic.title),
      category: "topic",
      role: featured ? "featured" : "reference",
      directNodeIds: [topic.topicNodeId],
      contextNodeIds: coveredNodeIds.filter((nodeId) => nodeId !== topic.topicNodeId),
      symbolAnchors: [],
      ...(featured ? { route: { order: 0, stage: "implementation" as const } } : {}),
      representedEdgeIds: behaviorEdgesAmong(profile, coveredNodeIds),
      reason: featured ? "最高优先级必需专题进入主阅读路径" : "其余必需专题保留在可搜索参考区",
    }));
  }

  documents.push(plannedDocument({
    path: KB_PATHS.sourceEntry,
    title: "源码入口",
    summary: concreteSummary("从入口文件、函数与配置边界回到可核对源码。", "源码入口"),
    category: "overview",
    role: "featured",
    directNodeIds: sourceEntryFileIds,
    contextNodeIds: sourceEntryNodeIds,
    symbolAnchors: [],
    route: { order: 0, stage: "evidence" },
    representedEdgeIds: profile.graph.edges
      .filter((edge) => (edge.type === "contains" && sourceEntryFileIds.includes(edge.source) && sourceEntryNodeIds.includes(edge.target))
        || (BEHAVIOR_EDGE_TYPES.has(edge.type) && sourceEntryNodeIds.includes(edge.source)))
      .map(edgeId),
    reason: "主阅读路径必须提供从业务结论返回源码的证据入口",
  }));

  // Ten `index.ts` files would otherwise all be titled "index.ts 文件参考".
  const fileLabels = buildUniqueLabels(fileDocPlan.tasks.map((task) => ({
    id: task.fileNodeId,
    name: profile.indexes.nodesById.get(task.fileNodeId)?.name ?? task.filePath,
    filePath: task.filePath,
  })));

  for (const task of fileDocPlan.tasks) {
    const directNodeIds = sortedUnique([...task.sourceNodeIds, ...task.functionNodeIds, ...task.classNodeIds]);
    const owner = profile.indexes.nodesById.get(task.fileNodeId);
    const label = fileLabels.get(task.fileNodeId) ?? owner?.name ?? task.filePath;
    const title = `${label} 文件参考`;
    documents.push(plannedDocument({
      path: task.documentPath,
      title,
      summary: concreteSummary(owner?.summary, title),
      category: "file",
      role: "reference",
      directNodeIds,
      contextNodeIds: task.neighborNodeIds.filter((nodeId) => !directNodeIds.includes(nodeId)),
      symbolAnchors: symbolAnchors(task, profile),
      referenceKind: task.referenceKind,
      representedEdgeIds: [...task.incomingEdgeIds, ...task.outgoingEdgeIds],
      reason: `路径 ${task.filePath} 仅生成一个分层引用任务`,
    }));
  }

  documents.push(plannedDocument({
    path: KB_PATHS.qualityStatus,
    title: "质量状态",
    summary: concreteSummary("汇总生成失败、证据缺口、重试批次与恢复步骤。", "质量状态"),
    category: "quality",
    role: "maintenance",
    directNodeIds: [],
    contextNodeIds: [],
    symbolAnchors: [],
    representedEdgeIds: [],
    reason: "质量状态只在语料发布评估完成后生成",
  }));
  documents.push(plannedDocument({
    path: KB_PATHS.referenceCoverage,
    title: "引用覆盖",
    summary: concreteSummary("汇总文件、函数、类型与关系引用覆盖。", "引用覆盖"),
    category: "coverage",
    role: "maintenance",
    directNodeIds: [],
    contextNodeIds: [],
    symbolAnchors: [],
    representedEdgeIds: [],
    reason: "引用覆盖只诊断已物化语料，不参与主阅读状态判断",
  }));

  assertUniqueDocumentPaths(documents);

  let routed = assignRoutes(capFeaturedDocuments(documents));
  const originallyFeaturedIds = new Set(routed
    .filter((document) => document.role === "featured")
    .map((document) => document.id));
  routed = applyConfiguredRoutes(routed, config, warnings);
  routed = enforceFinalFeaturedLimit(routed, originallyFeaturedIds, warnings);

  const requiredPageIds = [pageId(KB_PATHS.projectOverview), pageId(KB_PATHS.sourceEntry)];
  for (const requiredPageId of requiredPageIds) {
    const document = routed.find((candidate) => candidate.id === requiredPageId);
    if (document?.role !== "featured") {
      warnings.push(`主阅读必需页面 ${requiredPageId} 被隐藏，主阅读状态将被阻塞`);
    }
  }

  const requiredRouteStages = ROUTE_STAGE_ORDER.filter((stage) =>
    routed.some((document) => document.role === "featured" && document.route?.stage === stage));

  return {
    documents: sortDocuments(routed),
    warnings: unique(warnings),
    requiredRouteStages,
  };
}
