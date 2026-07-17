import {
  parseWikiIndexV2,
  type RouteStage,
  type WikiEvidenceV2,
  type WikiIndexV2,
  type WikiNodeDocumentationV2,
  type WikiPageV2,
} from "@understand-code/core/knowledge-base";
import { validateGraph } from "@understand-code/core/schema";
import type { GraphEdge, GraphNode, KnowledgeGraph } from "@understand-code/core/types";
import { buildWikiRuntimeIndex, type WikiRuntimeIndex } from "../../wiki/wikiIndex";
import type {
  SemanticGraph,
  SemanticGraphDocMetadataV2,
  SemanticGraphNode,
} from "../semanticGraph";

const GENERATED_AT = "2026-07-11T00:00:00.000Z";
const ROUTE_STAGE_ORDER: readonly RouteStage[] = ["purpose", "flow", "rule", "implementation", "evidence"];

function compareStable(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertUnique(label: string, values: readonly string[]): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`${label} 冲突：${value}`);
    seen.add(value);
  }
}

function sortedUnique(label: string, values: readonly string[]): string[] {
  assertUnique(label, values);
  return [...values].sort(compareStable);
}

function fileNode(id: string, filePath: string): GraphNode {
  return {
    id,
    type: "file",
    name: filePath.split("/").at(-1) ?? filePath,
    filePath,
    summary: `${filePath} 的职责说明。`,
    tags: [],
    complexity: "simple",
  };
}

function functionNode(id: string, filePath: string, name: string, line: number): GraphNode {
  return {
    id,
    type: "function",
    name,
    filePath,
    lineRange: [line, line + 4],
    summary: `${name} 的执行说明。`,
    tags: [],
    complexity: "simple",
  };
}

function page(
  overrides: Partial<WikiPageV2> & Pick<WikiPageV2, "id" | "title" | "markdownPath">,
): WikiPageV2 {
  return {
    summary: `${overrides.title} 的中文摘要。`,
    role: "featured",
    category: "topic",
    quality: "generated",
    generationStatus: "complete",
    directNodeIds: [],
    contextNodeIds: [],
    evidenceIds: [],
    searchTerms: [],
    ...overrides,
  };
}

function nodeDocumentation(
  nodeId: string,
  overrides: Partial<Omit<WikiNodeDocumentationV2, "nodeId">> = {},
): WikiNodeDocumentationV2 {
  return {
    nodeId,
    relation: "none",
    quality: "needs-review",
    evidenceHealth: "missing",
    generationStatus: "partial",
    referenceCoverage: "unanchored",
    directPageIds: [],
    contextPageIds: [],
    evidenceIds: [],
    ...overrides,
  };
}

function edgeIdentity(edge: GraphEdge): string {
  return `${edge.source}\u0000${edge.type}\u0000${edge.target}\u0000${edge.direction}`;
}

function finalizeGraph(graph: KnowledgeGraph): KnowledgeGraph {
  const nodes = [...graph.nodes].sort((left, right) => compareStable(left.id, right.id));
  const edges = [...graph.edges].sort((left, right) =>
    compareStable(edgeIdentity(left), edgeIdentity(right)) || left.weight - right.weight);
  const layers = graph.layers
    .map((layer) => ({ ...layer, nodeIds: sortedUnique(`层 ${layer.id} 的节点 ID`, layer.nodeIds) }))
    .sort((left, right) => compareStable(left.id, right.id));
  const tour = [...graph.tour].sort((left, right) => left.order - right.order || compareStable(left.title, right.title));

  assertUnique("节点 ID", nodes.map((node) => node.id));
  assertUnique("边标识", edges.map(edgeIdentity));
  assertUnique("层 ID", layers.map((layer) => layer.id));

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const layerByNodeId = new Map<string, string>();
  for (const layer of layers) {
    for (const nodeId of layer.nodeIds) {
      const node = nodesById.get(nodeId);
      if (!node) throw new Error(`层 ${layer.id} 引用了不存在的节点：${nodeId}`);
      if (node.type !== "file") throw new Error(`层 ${layer.id} 只能包含文件节点：${nodeId}`);
      const previousLayer = layerByNodeId.get(nodeId);
      if (previousLayer) throw new Error(`节点 ${nodeId} 同时属于层 ${previousLayer} 与 ${layer.id}`);
      layerByNodeId.set(nodeId, layer.id);
    }
  }
  for (const edge of edges) {
    if (!nodesById.has(edge.source)) throw new Error(`边引用了不存在的起点：${edge.source}`);
    if (!nodesById.has(edge.target)) throw new Error(`边引用了不存在的终点：${edge.target}`);
  }

  const stableGraph: KnowledgeGraph = { ...graph, nodes, edges, layers, tour };
  const validation = validateGraph(stableGraph);
  if (!validation.success || validation.fatal || validation.issues.length > 0) {
    const diagnostics = [validation.fatal, ...validation.issues.map((issue) => issue.message)].filter(Boolean);
    throw new Error(`图谱夹具未通过零问题校验：\n${diagnostics.join("\n")}`);
  }
  return stableGraph;
}

function stablePage(input: WikiPageV2): WikiPageV2 {
  return {
    ...input,
    directNodeIds: sortedUnique(`页面 ${input.id} 的 directNodeIds`, input.directNodeIds),
    contextNodeIds: sortedUnique(`页面 ${input.id} 的 contextNodeIds`, input.contextNodeIds),
    evidenceIds: sortedUnique(`页面 ${input.id} 的 evidenceIds`, input.evidenceIds),
    searchTerms: sortedUnique(`页面 ${input.id} 的 searchTerms`, input.searchTerms),
  };
}

function stableDocumentation(input: WikiNodeDocumentationV2): WikiNodeDocumentationV2 {
  return {
    ...input,
    directPageIds: sortedUnique(`节点 ${input.nodeId} 的 directPageIds`, input.directPageIds),
    contextPageIds: sortedUnique(`节点 ${input.nodeId} 的 contextPageIds`, input.contextPageIds),
    evidenceIds: sortedUnique(`节点 ${input.nodeId} 的 evidenceIds`, input.evidenceIds),
  };
}

function stableEvidence(input: WikiEvidenceV2): WikiEvidenceV2 {
  return {
    ...input,
    nodeIds: sortedUnique(`证据 ${input.id} 的 nodeIds`, input.nodeIds),
  };
}

function coverageFor(
  graph: KnowledgeGraph,
  documentationByNodeId: ReadonlyMap<string, WikiNodeDocumentationV2>,
  nodeType: "file" | "function" | "class",
): { covered: number; total: number; missingIds: string[] } {
  const applicableIds = graph.nodes
    .filter((node) => node.type === nodeType)
    .map((node) => node.id)
    .sort(compareStable);
  const missingIds = applicableIds.filter((nodeId) =>
    documentationByNodeId.get(nodeId)?.referenceCoverage !== "anchored");
  return { covered: applicableIds.length - missingIds.length, total: applicableIds.length, missingIds };
}

function assertReadyFixture(
  pages: readonly WikiPageV2[],
  documentation: readonly WikiNodeDocumentationV2[],
  evidence: readonly WikiEvidenceV2[],
  requiredRouteStages: readonly RouteStage[],
): string[] {
  assertUnique("页面 ID", pages.map((item) => item.id));
  assertUnique("节点文档 ID", documentation.map((item) => item.nodeId));
  assertUnique("证据 ID", evidence.map((item) => item.id));
  assertUnique("必需路由阶段", requiredRouteStages);

  const documentationByNodeId = new Map(documentation.map((record) => [record.nodeId, record]));
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const routePages = pages
    .filter((item) => item.route)
    .sort((left, right) => left.route!.order - right.route!.order || compareStable(left.id, right.id));
  assertUnique("路由顺序", routePages.map((item) => String(item.route!.order)));
  const routeStages = new Set(routePages.map((item) => item.route!.stage));
  for (const stage of requiredRouteStages) {
    if (!routeStages.has(stage)) throw new Error(`ready Wiki 夹具缺少必需路由阶段：${stage}`);
  }

  for (const routePage of routePages) {
    if (routePage.role !== "featured" || !routePage.route) {
      throw new Error(`ready 路由页面必须是 featured 且具有 route：${routePage.id}`);
    }
    if (routePage.directNodeIds.length === 0) {
      throw new Error(`ready 路由页面必须直接解释节点：${routePage.id}`);
    }
    if (!(["generated", "verified"] as const).includes(routePage.quality as "generated" | "verified")
      || routePage.generationStatus !== "complete") {
      throw new Error(`ready 路由页面质量不可用：${routePage.id}`);
    }
    for (const nodeId of routePage.directNodeIds) {
      const hasExactEvidence = routePage.evidenceIds.some((evidenceId) =>
        evidenceById.get(evidenceId)?.nodeIds.includes(nodeId));
      if (!hasExactEvidence) throw new Error(`ready 路由页面缺少直接节点证据：${routePage.id} -> ${nodeId}`);
    }
  }

  for (const currentPage of pages) {
    for (const nodeId of currentPage.directNodeIds) {
      if (!documentationByNodeId.get(nodeId)?.directPageIds.includes(currentPage.id)) {
        throw new Error(`页面与节点缺少 direct 双向映射：${currentPage.id} -> ${nodeId}`);
      }
    }
    for (const nodeId of currentPage.contextNodeIds) {
      if (!documentationByNodeId.get(nodeId)?.contextPageIds.includes(currentPage.id)) {
        throw new Error(`页面与节点缺少 context 双向映射：${currentPage.id} -> ${nodeId}`);
      }
    }
  }

  for (const record of documentation) {
    if (!record.anchor) continue;
    const primaryPage = pages.find((item) => item.id === record.primaryPageId);
    if (!primaryPage || primaryPage.category !== "file" || !primaryPage.directNodeIds.includes(record.nodeId)) {
      throw new Error(`节点 anchor 必须属于其 file 类直接主页面：${record.nodeId}`);
    }
  }
  return routePages.map((item) => item.id);
}

function runtimeIndex(input: {
  graph: KnowledgeGraph;
  pages: WikiPageV2[];
  nodeDocumentation: WikiNodeDocumentationV2[];
  evidence: WikiEvidenceV2[];
  requiredRouteStages: RouteStage[];
}): WikiRuntimeIndex {
  const graph = finalizeGraph(input.graph);
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const pages = input.pages.map(stablePage).sort((left, right) => compareStable(left.id, right.id));
  const documentation = input.nodeDocumentation
    .map(stableDocumentation)
    .sort((left, right) => compareStable(left.nodeId, right.nodeId));
  const evidence = input.evidence.map(stableEvidence).sort((left, right) => compareStable(left.id, right.id));

  for (const record of documentation) {
    if (!nodesById.has(record.nodeId)) throw new Error(`节点文档引用了图中不存在的节点：${record.nodeId}`);
  }
  for (const item of evidence) {
    for (const nodeId of item.nodeIds) {
      if (!nodesById.has(nodeId)) throw new Error(`证据引用了图中不存在的节点：${item.id} -> ${nodeId}`);
    }
  }
  for (const currentPage of pages) {
    for (const nodeId of [...currentPage.directNodeIds, ...currentPage.contextNodeIds]) {
      if (!nodesById.has(nodeId)) throw new Error(`页面引用了图中不存在的节点：${currentPage.id} -> ${nodeId}`);
    }
  }

  const requiredRouteStages = [...input.requiredRouteStages].sort((left, right) =>
    ROUTE_STAGE_ORDER.indexOf(left) - ROUTE_STAGE_ORDER.indexOf(right));
  const routePageIds = assertReadyFixture(pages, documentation, evidence, requiredRouteStages);
  const documentationByNodeId = new Map(documentation.map((record) => [record.nodeId, record]));
  const files = coverageFor(graph, documentationByNodeId, "file");
  const functions = coverageFor(graph, documentationByNodeId, "function");
  const types = coverageFor(graph, documentationByNodeId, "class");

  const payload: WikiIndexV2 = {
    version: 2,
    generatedAt: GENERATED_AT,
    projectName: graph.project.name,
    source: { outputLanguage: "zh-CN", generationMode: "writer" },
    mainReadiness: { status: "ready", reasons: [], routePageIds },
    referenceCoverage: {
      status: [...files.missingIds, ...functions.missingIds, ...types.missingIds].length === 0
        ? "complete"
        : "partial",
      files,
      functions,
      types,
    },
    pages,
    nodeDocumentation: documentation,
    evidence,
  };

  const parsed = parseWikiIndexV2(payload);
  if (!parsed.ok) throw new Error(`Wiki V2 夹具未通过契约校验：\n${parsed.errors.join("\n")}`);
  return buildWikiRuntimeIndex(parsed.value);
}

export function graphFixture(): KnowledgeGraph {
  return finalizeGraph({
    version: "1.0.0",
    project: {
      name: "fixture",
      languages: ["typescript"],
      frameworks: [],
      description: "图谱夹具。",
      analyzedAt: GENERATED_AT,
      gitCommitHash: "fixture",
    },
    nodes: [
      fileNode("file:src/a.ts", "src/a.ts"),
      functionNode("function:src/a.ts:run", "src/a.ts", "run", 10),
      fileNode("file:context-only.ts", "context-only.ts"),
    ],
    edges: [
      {
        source: "file:src/a.ts",
        target: "function:src/a.ts:run",
        type: "contains",
        direction: "forward",
        weight: 1,
      },
    ],
    layers: [{
      id: "core",
      name: "核心模块",
      description: "负责核心执行。",
      nodeIds: ["file:src/a.ts", "file:context-only.ts"],
    }],
    tour: [],
  });
}

export function workspaceHierarchyFixture(): KnowledgeGraph {
  const paths = [
    "package.json",
    "pnpm-workspace.yaml",
    "packages/api/package.json",
    "packages/api/src/index.ts",
    "packages/api/src/routes/user.ts",
    "packages/shared/package.json",
    "packages/shared/src/id.ts",
    "scripts/release.ts",
  ] as const;
  const files = paths.map((filePath) => fileNode(`file:${filePath}`, filePath));
  const loadUser = functionNode(
    "function:packages/api/src/routes/user.ts:loadUser",
    "packages/api/src/routes/user.ts",
    "loadUser",
    10,
  );
  const containedWithoutPath: GraphNode = {
    id: "function:contained-without-path",
    type: "function",
    name: "containedWithoutPath",
    summary: "仅通过包含关系定位的函数。",
    tags: [],
    complexity: "simple",
  };
  const pathfulWithoutFile: GraphNode = {
    id: "config:pathful-without-file",
    type: "config",
    name: "feature.flags.ts",
    filePath: "packages/api/src/feature.flags.ts",
    summary: "没有规范文件节点的配置对象。",
    tags: [],
    complexity: "simple",
  };
  const gateway: GraphNode = {
    id: "service:gateway",
    type: "service",
    name: "gateway",
    summary: "API 网关架构对象。",
    tags: [],
    complexity: "simple",
  };
  const detached: GraphNode = {
    id: "function:detached",
    type: "function",
    name: "detached",
    summary: "没有文件归属的结构对象。",
    tags: [],
    complexity: "simple",
  };

  return finalizeGraph({
    version: "1.0.0",
    project: {
      name: "workspace-hierarchy",
      languages: ["typescript"],
      frameworks: [],
      description: "工作区层级夹具。",
      analyzedAt: GENERATED_AT,
      gitCommitHash: "fixture",
    },
    nodes: [
      ...files,
      loadUser,
      containedWithoutPath,
      pathfulWithoutFile,
      gateway,
      detached,
    ],
    edges: [
      {
        source: "file:packages/api/src/routes/user.ts",
        target: loadUser.id,
        type: "contains",
        direction: "forward",
        weight: 1,
      },
      {
        source: "file:packages/api/src/routes/user.ts",
        target: containedWithoutPath.id,
        type: "contains",
        direction: "forward",
        weight: 1,
      },
      {
        source: "file:packages/api/src/index.ts",
        target: gateway.id,
        type: "contains",
        direction: "forward",
        weight: 1,
      },
      {
        source: gateway.id,
        target: detached.id,
        type: "contains",
        direction: "forward",
        weight: 1,
      },
      {
        source: "file:packages/api/src/index.ts",
        target: "file:packages/shared/src/id.ts",
        type: "imports",
        direction: "forward",
        weight: 1,
      },
    ],
    layers: [{
      id: "workspace",
      name: "工作区",
      description: "单仓库工作区。",
      nodeIds: files.map((node) => node.id),
    }],
    tour: [],
  });
}

export function wikiRuntimeFixture(): WikiRuntimeIndex {
  const graph = graphFixture();
  const runEvidence: WikiEvidenceV2 = {
    id: "evidence:run",
    nodeIds: ["function:src/a.ts:run"],
    filePath: "src/a.ts",
    lineRange: [10, 14],
    excerpt: "export function run() {}",
    evidenceType: "production",
  };
  const overviewEvidence: WikiEvidenceV2 = {
    id: "evidence:overview-only",
    nodeIds: ["file:src/a.ts"],
    filePath: "src/a.ts",
    lineRange: [1, 5],
    excerpt: "// overview",
    evidenceType: "documentation",
  };
  const overview = page({
    id: "page:overview",
    title: "项目总览",
    markdownPath: "knowledge-base/README.md",
    category: "overview",
    directNodeIds: ["file:src/a.ts"],
    contextNodeIds: ["function:src/a.ts:run", "file:context-only.ts"],
    evidenceIds: [overviewEvidence.id],
    route: { order: 0, stage: "purpose" },
  });
  const runPage = page({
    id: "page:run",
    title: "运行流程",
    markdownPath: "knowledge-base/files/src-a.ts.md",
    category: "file",
    directNodeIds: ["file:src/a.ts", "function:src/a.ts:run"],
    evidenceIds: [overviewEvidence.id, runEvidence.id],
    route: { order: 1, stage: "implementation" },
  });

  return runtimeIndex({
    graph,
    requiredRouteStages: ["purpose", "implementation"],
    pages: [overview, runPage],
    nodeDocumentation: [
      nodeDocumentation("file:src/a.ts", {
        relation: "direct",
        quality: "generated",
        evidenceHealth: "source-linked",
        generationStatus: "complete",
        referenceCoverage: "anchored",
        directPageIds: [overview.id, runPage.id],
        evidenceIds: [overviewEvidence.id],
        primaryPageId: runPage.id,
      }),
      nodeDocumentation("function:src/a.ts:run", {
        relation: "direct",
        quality: "generated",
        evidenceHealth: "source-linked",
        generationStatus: "complete",
        referenceCoverage: "anchored",
        directPageIds: [runPage.id],
        contextPageIds: [overview.id],
        evidenceIds: [runEvidence.id],
        primaryPageId: runPage.id,
        anchor: "run",
      }),
      nodeDocumentation("file:context-only.ts", {
        relation: "context",
        quality: "generated",
        evidenceHealth: "weak",
        generationStatus: "complete",
        referenceCoverage: "unanchored",
        contextPageIds: [overview.id],
      }),
    ],
    evidence: [runEvidence, overviewEvidence],
  });
}

export function aggregateCoverageFixture(): { graph: KnowledgeGraph; wikiIndex: WikiRuntimeIndex } {
  const graph = finalizeGraph({
    version: "1.0.0",
    project: {
      name: "coverage",
      languages: ["typescript"],
      frameworks: [],
      description: "覆盖夹具。",
      analyzedAt: GENERATED_AT,
      gitCommitHash: "fixture",
    },
    nodes: Array.from({ length: 10 }, (_, index) =>
      fileNode(`file:coverage/${index}.ts`, `coverage/${index}.ts`)),
    edges: [],
    layers: [{
      id: "core",
      name: "核心模块",
      description: "核心模块包含十个关键文件。",
      nodeIds: Array.from({ length: 10 }, (_, index) => `file:coverage/${index}.ts`),
    }],
    tour: [],
  });
  const nodes = graph.nodes;
  const directEvidence = nodes.slice(0, 8).map((node, index): WikiEvidenceV2 => ({
    id: `evidence:coverage:${index}`,
    nodeIds: [node.id],
    filePath: node.filePath!,
    lineRange: [1, 2],
    excerpt: `export const value${index} = ${index};`,
    evidenceType: "production",
  }));
  const directPages = nodes.slice(0, 8).map((node, index) => page({
    id: `page:coverage:${index}`,
    title: `文件 ${index}`,
    markdownPath: `knowledge-base/files/${index}.md`,
    role: "reference",
    category: "file",
    directNodeIds: [node.id],
    evidenceIds: [directEvidence[index].id],
  }));
  const contextPage = page({
    id: "page:coverage:overview",
    title: "覆盖总览",
    markdownPath: "knowledge-base/coverage-overview.md",
    category: "overview",
    directNodeIds: [nodes[0].id],
    contextNodeIds: [nodes[8].id],
    evidenceIds: [directEvidence[0].id],
    route: { order: 0, stage: "purpose" },
  });
  const documentation = [
    ...nodes.slice(0, 8).map((node, index) => nodeDocumentation(node.id, {
      relation: "direct",
      quality: "generated",
      evidenceHealth: "source-linked",
      generationStatus: "complete",
      referenceCoverage: "anchored",
      directPageIds: index === 0 ? [directPages[index].id, contextPage.id] : [directPages[index].id],
      evidenceIds: [directEvidence[index].id],
      primaryPageId: directPages[index].id,
    })),
    nodeDocumentation(nodes[8].id, {
      relation: "context",
      quality: "generated",
      evidenceHealth: "weak",
      generationStatus: "complete",
      referenceCoverage: "unanchored",
      contextPageIds: [contextPage.id],
    }),
    nodeDocumentation(nodes[9].id),
  ];

  return {
    graph,
    wikiIndex: runtimeIndex({
      graph,
      requiredRouteStages: ["purpose"],
      pages: [...directPages, contextPage],
      nodeDocumentation: documentation,
      evidence: directEvidence,
    }),
  };
}

export function graphWithFiftyNodes(
  selectedId = "function:src/large.ts:selected",
): KnowledgeGraph {
  const file = fileNode("file:src/large.ts", "src/large.ts");
  const generatedIds = Array.from(
    { length: 48 },
    (_, index) => `function:src/large.ts:fn-${String(index + 1).padStart(2, "0")}`,
  );
  if (!selectedId.trim() || selectedId === file.id || generatedIds.includes(selectedId)) {
    throw new Error(`节点 ID 冲突：${selectedId}`);
  }
  const symbols = [
    functionNode(selectedId, "src/large.ts", "selected", 10),
    ...generatedIds.map((id, index) =>
      functionNode(id, "src/large.ts", `fn${index + 1}`, 20 + index * 5)),
  ];
  const [n1, n2, n3] = symbols.slice(-3).map((node) => node.id);
  return finalizeGraph({
    version: "1.0.0",
    project: {
      name: "large",
      languages: ["typescript"],
      frameworks: [],
      description: "大范围夹具。",
      analyzedAt: GENERATED_AT,
      gitCommitHash: "fixture",
    },
    nodes: [file, ...symbols],
    edges: [
      ...symbols.map((node): GraphEdge => ({
        source: file.id,
        target: node.id,
        type: "contains",
        direction: "forward",
        weight: 1,
      })),
      { source: selectedId, target: n1, type: "calls", direction: "forward", weight: 1 },
      { source: n2, target: selectedId, type: "calls", direction: "forward", weight: 1 },
      { source: selectedId, target: n3, type: "calls", direction: "forward", weight: 1 },
    ],
    layers: [{
      id: "core",
      name: "核心模块",
      description: "大型作用域。",
      nodeIds: [file.id],
    }],
    tour: [],
  });
}

export function graphWithDenseSelection(edgeCount = 110): KnowledgeGraph {
  if (!Number.isSafeInteger(edgeCount) || edgeCount < 1) {
    throw new Error(`密集关系数量必须是正安全整数：${edgeCount}`);
  }
  const selected = functionNode("function:dense:selected", "src/dense.ts", "selected", 1);
  const neighbors = Array.from({ length: edgeCount }, (_, index) =>
    functionNode(`function:dense:n-${index}`, "src/dense.ts", `n${index}`, 10 + index * 5));
  return finalizeGraph({
    version: "1.0.0",
    project: {
      name: "dense",
      languages: ["typescript"],
      frameworks: [],
      description: "密集选中夹具。",
      analyzedAt: GENERATED_AT,
      gitCommitHash: "fixture",
    },
    nodes: [selected, ...neighbors],
    edges: neighbors.map((node): GraphEdge => ({
      source: selected.id,
      target: node.id,
      type: "calls",
      direction: "forward",
      weight: 1,
    })),
    layers: [],
    tour: [],
  });
}

export function oneHopIds(graph: KnowledgeGraph, selectedId: string): string[] {
  const ids = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.source === selectedId) ids.add(edge.target);
    if (edge.target === selectedId) ids.add(edge.source);
  }
  return [...ids].sort(compareStable);
}

export function importsOnlyGraphFixture(): KnowledgeGraph {
  const a = fileNode("file:src/a.ts", "src/a.ts");
  const b = fileNode("file:lib/b.ts", "lib/b.ts");
  return finalizeGraph({
    version: "1.0.0",
    project: {
      name: "imports",
      languages: ["typescript"],
      frameworks: [],
      description: "导入夹具。",
      analyzedAt: GENERATED_AT,
      gitCommitHash: "fixture",
    },
    nodes: [a, b],
    edges: [{ source: a.id, target: b.id, type: "imports", direction: "forward", weight: 1 }],
    layers: [
      { id: "app", name: "应用", description: "应用层。", nodeIds: [a.id] },
      { id: "lib", name: "库", description: "库层。", nodeIds: [b.id] },
    ],
    tour: [],
  });
}

export function graphWithStructuralOnly(): KnowledgeGraph {
  const file = fileNode("file:src/a.ts", "src/a.ts");
  const run = functionNode("function:src/a.ts:run", "src/a.ts", "run", 10);
  return finalizeGraph({
    version: "1.0.0",
    project: {
      name: "structural",
      languages: ["typescript"],
      frameworks: [],
      description: "结构夹具。",
      analyzedAt: GENERATED_AT,
      gitCommitHash: "fixture",
    },
    nodes: [file, run],
    edges: [{ source: file.id, target: run.id, type: "contains", direction: "forward", weight: 1 }],
    layers: [{ id: "core", name: "核心模块", description: "结构层。", nodeIds: [file.id] }],
    tour: [],
  });
}

function emptySemanticDocs(): SemanticGraphDocMetadataV2 {
  return {
    relation: "none",
    quality: "needs-review",
    evidenceHealth: "missing",
    generationStatus: "partial",
    referenceCoverage: "unanchored",
    directPageIds: [],
    contextPageIds: [],
    directPages: [],
    contextPages: [],
    evidenceIds: [],
    evidence: [],
  };
}

function scopeSemanticNode(scopeId: string, label: string): SemanticGraphNode {
  return {
    id: `scope:layer:${scopeId}`,
    label,
    group: "module",
    category: "module",
    cluster: label,
    importance: 0.85,
    rawType: "module",
    summary: `${label}的职责。`,
    docs: emptySemanticDocs(),
    documentationCounts: { direct: 0, context: 0, none: 0, problem: 0, total: 0 },
  };
}

export function semanticSelectionFixture(): SemanticGraph {
  const nodes = [
    scopeSemanticNode("core", "核心模块"),
    scopeSemanticNode("api", "接口模块"),
    scopeSemanticNode("data", "数据模块"),
    scopeSemanticNode("unrelated", "无关模块"),
  ];
  const edge = (
    source: string,
    target: string,
    direction: "forward" | "backward" | "bidirectional",
  ): SemanticGraph["edges"][number] => ({
    id: `${source}->${target}`,
    source,
    target,
    type: "depends_on",
    direction,
    edgeTypes: ["depends_on"],
    directions: [direction],
    weight: 1,
    bundledCount: 1,
    members: [{ id: `${source}->${target}:0`, source, target, type: "depends_on", direction, weight: 1 }],
  });
  return {
    nodes,
    edges: [
      edge("scope:layer:api", "scope:layer:core", "forward"),
      edge("scope:layer:core", "scope:layer:data", "backward"),
      edge("scope:layer:unrelated", "scope:layer:data", "bidirectional"),
    ],
  };
}
