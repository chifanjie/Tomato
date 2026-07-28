import type {
  EdgeType,
  GraphEdge,
  GraphNode,
  KnowledgeGraph,
  NodeType,
} from "@understand-code/core/types";

type FixtureNodeType =
  | "file"
  | "function"
  | "class"
  | "config"
  | "document"
  | "service";

type FixtureEdgeType =
  | "contains"
  | "calls"
  | "exports"
  | "imports"
  | "tested_by"
  | "documents"
  | "related"
  | "configures"
  | "depends_on";

export interface LargeRepositoryCorpus {
  id: "self-host-shape" | "synthetic-10k";
  label: string;
  fixtureVersion: "large-repository-v1";
  source: {
    kind: "self-host-snapshot" | "synthetic";
    graphCommit: string;
    capturedAt: string;
  };
  expectedChecksum: string;
  expectedIntegrity: {
    hierarchyClusterCount: number;
    quickJumpItemCount: number;
    minimumRenderedNodeCount: number;
    maximumRenderedNodeCount: number;
    maximumRenderedEdgeCount: number;
    workloadChecksum: number;
  };
  scopeCount: number;
  nodeTypeCounts: Readonly<Record<FixtureNodeType, number>>;
  edgeTypeCounts: Readonly<Record<FixtureEdgeType, number>>;
  budgetsMs: {
    coldCacheBootstrapP95: number;
    warmViewProjectionP95: number;
    warmLayoutP95: number;
  };
}

export interface LargeRepositoryPerformanceFixture {
  corpus: LargeRepositoryCorpus;
  graph: KnowledgeGraph;
  checksum: string;
}

const EMPTY_TAGS: string[] = [];
const ANALYZED_AT = "2026-07-24T02:59:07.611Z";

/**
 * This corpus locks the public shape of the self-host graph captured for WP0:
 * 1,264 nodes, 2,299 edges and nine product scopes. It deliberately contains
 * no source text or ignored local artifacts.
 */
export const SELF_HOST_SHAPE_CORPUS: LargeRepositoryCorpus = {
  id: "self-host-shape",
  label: "Understand Code self-host shape",
  fixtureVersion: "large-repository-v1",
  source: {
    kind: "self-host-snapshot",
    graphCommit: "1bd770581e16db58e763216bfeff2db34dd29711",
    capturedAt: ANALYZED_AT,
  },
  expectedChecksum: "fnv1a32:df6768af",
  expectedIntegrity: {
    hierarchyClusterCount: 307,
    quickJumpItemCount: 1_652,
    minimumRenderedNodeCount: 1,
    maximumRenderedNodeCount: 33,
    maximumRenderedEdgeCount: 100,
    workloadChecksum: 176_581,
  },
  scopeCount: 9,
  nodeTypeCounts: {
    file: 325,
    function: 795,
    class: 33,
    config: 12,
    document: 98,
    service: 1,
  },
  edgeTypeCounts: {
    contains: 828,
    calls: 614,
    exports: 414,
    imports: 215,
    tested_by: 119,
    documents: 79,
    related: 20,
    configures: 8,
    depends_on: 2,
  },
  budgetsMs: {
    coldCacheBootstrapP95: 2_000,
    warmViewProjectionP95: 500,
    warmLayoutP95: 500,
  },
};

/**
 * The 10k corpus preserves the self-host node/edge density and type mix while
 * scaling to the P0 large-graph boundary. Counts are explicit so a benchmark
 * cannot silently change its workload after an implementation refactor.
 */
export const SYNTHETIC_10K_CORPUS: LargeRepositoryCorpus = {
  id: "synthetic-10k",
  label: "Deterministic 10k-node graph",
  fixtureVersion: "large-repository-v1",
  source: {
    kind: "synthetic",
    graphCommit: "fixture:large-repository-v1",
    capturedAt: ANALYZED_AT,
  },
  expectedChecksum: "fnv1a32:21f92de3",
  expectedIntegrity: {
    hierarchyClusterCount: 552,
    quickJumpItemCount: 10_808,
    minimumRenderedNodeCount: 6,
    maximumRenderedNodeCount: 33,
    maximumRenderedEdgeCount: 100,
    workloadChecksum: 305_843,
  },
  scopeCount: 16,
  nodeTypeCounts: {
    file: 2_571,
    function: 6_290,
    class: 261,
    config: 95,
    document: 775,
    service: 8,
  },
  edgeTypeCounts: {
    contains: 6_551,
    calls: 4_858,
    exports: 3_275,
    imports: 1_701,
    tested_by: 941,
    documents: 625,
    related: 158,
    configures: 63,
    depends_on: 16,
  },
  budgetsMs: {
    coldCacheBootstrapP95: 4_000,
    warmViewProjectionP95: 500,
    warmLayoutP95: 500,
  },
};

export const LARGE_REPOSITORY_CORPORA = [
  SELF_HOST_SHAPE_CORPUS,
  SYNTHETIC_10K_CORPUS,
] as const;

function sumCounts<T extends string>(counts: Readonly<Record<T, number>>): number {
  return Object.values(counts as Readonly<Record<string, number>>)
    .reduce<number>((total, count) => total + count, 0);
}

function filePathFor(fileIndex: number, scopeCount: number): string {
  const scope = fileIndex % scopeCount;
  const module = Math.floor(fileIndex / scopeCount) % 32;
  return `packages/scope-${scope}/module-${module}/file-${fileIndex}.ts`;
}

function commonNode(
  id: string,
  type: NodeType,
  name: string,
  filePath: string,
  index: number,
): GraphNode {
  return {
    id,
    type,
    name,
    filePath,
    summary: `Deterministic ${type} ${index}.`,
    tags: EMPTY_TAGS,
    complexity: ["simple", "moderate", "complex"][index % 3] as GraphNode["complexity"],
  };
}

function buildNodes(corpus: LargeRepositoryCorpus): {
  nodes: GraphNode[];
  byType: Record<FixtureNodeType, GraphNode[]>;
} {
  const byType: Record<FixtureNodeType, GraphNode[]> = {
    file: [],
    function: [],
    class: [],
    config: [],
    document: [],
    service: [],
  };
  const fileCount = corpus.nodeTypeCounts.file;

  for (let index = 0; index < fileCount; index += 1) {
    const filePath = filePathFor(index, corpus.scopeCount);
    byType.file.push(commonNode(
      `file:${filePath}`,
      "file",
      `file-${index}.ts`,
      filePath,
      index,
    ));
  }

  const symbolTypes = ["function", "class"] as const;
  for (const type of symbolTypes) {
    for (let index = 0; index < corpus.nodeTypeCounts[type]; index += 1) {
      const fileIndex = index % fileCount;
      const filePath = filePathFor(fileIndex, corpus.scopeCount);
      const name = type === "function" ? `run${index}` : `Type${index}`;
      byType[type].push({
        ...commonNode(`${type}:${filePath}:${name}`, type, name, filePath, index),
        lineRange: [index * 3 + 1, index * 3 + 3],
      });
    }
  }

  for (let index = 0; index < corpus.nodeTypeCounts.config; index += 1) {
    const scope = index % corpus.scopeCount;
    const filePath = `config/scope-${scope}/config-${index}.json`;
    byType.config.push(commonNode(
      `config:${filePath}`,
      "config",
      `config-${index}.json`,
      filePath,
      index,
    ));
  }
  for (let index = 0; index < corpus.nodeTypeCounts.document; index += 1) {
    const scope = index % corpus.scopeCount;
    const filePath = `docs/scope-${scope}/topic-${index}.md`;
    byType.document.push(commonNode(
      `document:${filePath}`,
      "document",
      `topic-${index}.md`,
      filePath,
      index,
    ));
  }
  for (let index = 0; index < corpus.nodeTypeCounts.service; index += 1) {
    const scope = index % corpus.scopeCount;
    const filePath = `services/scope-${scope}/service-${index}.ts`;
    byType.service.push(commonNode(
      `service:${filePath}`,
      "service",
      `service-${index}`,
      filePath,
      index,
    ));
  }

  const nodes = [
    ...byType.file,
    ...byType.function,
    ...byType.class,
    ...byType.config,
    ...byType.document,
    ...byType.service,
  ];
  if (nodes.length !== sumCounts(corpus.nodeTypeCounts)) {
    throw new Error(`node count mismatch for ${corpus.id}`);
  }
  return { nodes, byType };
}

function edge(
  source: GraphNode,
  target: GraphNode,
  type: EdgeType,
  index: number,
): GraphEdge {
  return {
    source: source.id,
    target: target.id,
    type,
    direction: index % 11 === 0 ? "backward" : "forward",
    weight: 1,
  };
}

function cycleAt(nodes: readonly GraphNode[], index: number, offset = 0): GraphNode {
  const node = nodes[(index + offset) % nodes.length];
  if (!node) throw new Error("fixture edge requested an empty node group");
  return node;
}

function buildEdges(
  corpus: LargeRepositoryCorpus,
  byType: Record<FixtureNodeType, GraphNode[]>,
  nodes: readonly GraphNode[],
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const symbols = [...byType.function, ...byType.class];

  for (let index = 0; index < corpus.edgeTypeCounts.contains; index += 1) {
    edges.push(edge(
      cycleAt(byType.file, index),
      cycleAt(symbols, index),
      "contains",
      index,
    ));
  }
  for (let index = 0; index < corpus.edgeTypeCounts.calls; index += 1) {
    edges.push(edge(
      cycleAt(byType.function, index),
      cycleAt(byType.function, index * 17, 31),
      "calls",
      index,
    ));
  }
  for (let index = 0; index < corpus.edgeTypeCounts.exports; index += 1) {
    edges.push(edge(
      cycleAt(byType.file, index),
      cycleAt(symbols, index * 13, 7),
      "exports",
      index,
    ));
  }
  for (let index = 0; index < corpus.edgeTypeCounts.imports; index += 1) {
    edges.push(edge(
      cycleAt(byType.file, index),
      cycleAt(byType.file, index * 19, 1),
      "imports",
      index,
    ));
  }
  for (let index = 0; index < corpus.edgeTypeCounts.tested_by; index += 1) {
    edges.push(edge(
      cycleAt(byType.file, index * 7),
      cycleAt(byType.file, index * 23, 3),
      "tested_by",
      index,
    ));
  }
  for (let index = 0; index < corpus.edgeTypeCounts.documents; index += 1) {
    edges.push(edge(
      cycleAt(byType.document, index),
      cycleAt(byType.file, index * 29),
      "documents",
      index,
    ));
  }
  for (let index = 0; index < corpus.edgeTypeCounts.related; index += 1) {
    edges.push(edge(
      cycleAt(nodes, index * 31),
      cycleAt(nodes, index * 37, 5),
      "related",
      index,
    ));
  }
  for (let index = 0; index < corpus.edgeTypeCounts.configures; index += 1) {
    const targets = byType.service.length > 0 ? byType.service : byType.file;
    edges.push(edge(
      cycleAt(byType.config, index),
      cycleAt(targets, index),
      "configures",
      index,
    ));
  }
  for (let index = 0; index < corpus.edgeTypeCounts.depends_on; index += 1) {
    const sources = byType.service.length > 0 ? byType.service : byType.file;
    edges.push(edge(
      cycleAt(sources, index),
      cycleAt(byType.config, index * 3),
      "depends_on",
      index,
    ));
  }

  if (edges.length !== sumCounts(corpus.edgeTypeCounts)) {
    throw new Error(`edge count mismatch for ${corpus.id}`);
  }
  return edges;
}

function scopeForNode(node: GraphNode, scopeCount: number): number {
  const match = node.filePath?.match(/scope-(\d+)/);
  if (match) return Number(match[1]) % scopeCount;
  let hash = 0;
  for (let index = 0; index < node.id.length; index += 1) {
    hash = (hash * 31 + node.id.charCodeAt(index)) >>> 0;
  }
  return hash % scopeCount;
}

export function createLargeRepositoryPerformanceFixture(
  corpus: LargeRepositoryCorpus,
): LargeRepositoryPerformanceFixture {
  const { nodes, byType } = buildNodes(corpus);
  const edges = buildEdges(corpus, byType, nodes);
  const nodeIdsByScope = Array.from({ length: corpus.scopeCount }, () => [] as string[]);
  for (const node of nodes) {
    nodeIdsByScope[scopeForNode(node, corpus.scopeCount)]!.push(node.id);
  }
  const graph: KnowledgeGraph = {
    version: "1.0",
    project: {
      name: corpus.id,
      languages: ["TypeScript"],
      frameworks: ["React"],
      description: corpus.label,
      analyzedAt: corpus.source.capturedAt,
      gitCommitHash: corpus.source.graphCommit,
    },
    layers: nodeIdsByScope.map((nodeIds, index) => ({
      id: `benchmark-scope-${index}`,
      name: `Benchmark scope ${index}`,
      description: `Deterministic benchmark scope ${index}.`,
      nodeIds,
    })),
    nodes,
    edges,
    tour: [],
  };
  return {
    corpus,
    graph,
    checksum: largeRepositoryFixtureChecksum(graph),
  };
}

export function largeRepositoryFixtureChecksum(graph: KnowledgeGraph): string {
  const canonical = JSON.stringify(graph);
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a32:${hash.toString(16).padStart(8, "0")}`;
}
