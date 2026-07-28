import type { KnowledgeGraph } from "@understand-code/core/types";
import {
  buildGraphLayoutMessage,
  graphNodeSize,
} from "../../components/graphExplorer/semanticGraphCanvasModel.js";
import {
  computeLayout,
  isValidLayoutResult,
  quantizeGraphViewport,
  type LayoutMessage,
} from "../../utils/layoutAlgorithm.js";
import {
  buildGraphHierarchyIndex,
  buildHierarchicalSemanticGraph,
  createHierarchicalGraphProjectionContext,
  type GraphExplorerNavigation,
  type GraphHierarchyIndex,
  type HierarchicalGraphProjectionContext,
  type HierarchicalSemanticGraph,
} from "../hierarchicalGraph.js";
import {
  buildGraphQuickJumpIndex,
  type GraphQuickJumpIndex,
} from "../graphQuickJump.js";
import {
  createLargeRepositoryPerformanceFixture,
  LARGE_REPOSITORY_CORPORA,
  type LargeRepositoryCorpus,
} from "./largeRepositoryPerformanceFixture.js";

export const LARGE_REPOSITORY_BENCHMARK_PROTOCOL = Object.freeze({
  version: 2,
  coldSamples: 10,
  warmupSamples: 5,
  warmSamples: 30,
});

export interface BenchmarkStatistics {
  minimumMs: number;
  p50Ms: number;
  p95Ms: number;
  maximumMs: number;
}

export interface BenchmarkMeasurement {
  operation: "graph-model-bootstrap" | "graph-view-projection" | "graph-layout";
  cacheState: "cold" | "warm";
  warmupSamples: number;
  sampleCount: number;
  samplesMs: number[];
  statistics: BenchmarkStatistics;
  budget: {
    percentile: "p95";
    limitMs: number;
    source:
      | "P0 Task Graph initial overlay (Graph pipeline slice)"
      | "WP0 large-repository hard ceiling";
  };
  passed: boolean;
}

export interface CorpusBenchmarkResult {
  corpus: LargeRepositoryCorpus & {
    nodeCount: number;
    edgeCount: number;
  };
  measurements: BenchmarkMeasurement[];
  integrity: {
    fixtureChecksum: string;
    expectedFixtureChecksum: string;
    fixtureChecksumMatches: boolean;
    hierarchyScopeCount: number;
    hierarchyClusterCount: number;
    expectedHierarchyClusterCount: number;
    hierarchyClusterCountMatches: boolean;
    quickJumpItemCount: number;
    expectedQuickJumpItemCount: number;
    quickJumpItemCountMatches: boolean;
    quickJumpCoversEveryGraphNode: boolean;
    minimumRenderedNodeCount: number;
    expectedMinimumRenderedNodeCount: number;
    maximumRenderedNodeCount: number;
    expectedMaximumRenderedNodeCount: number;
    renderedNodeRangeMatches: boolean;
    maximumRenderedEdgeCount: number;
    expectedMaximumRenderedEdgeCount: number;
    renderedEdgeCountMatches: boolean;
    navigationLevelsCovered: GraphExplorerNavigation["level"][];
    navigationCoveragePassed: boolean;
    renderedNodeLimit: number;
    renderedEdgeLimit: number;
    renderedBoundsPassed: boolean;
    layoutResultsValid: boolean;
    workloadChecksum: number;
    expectedWorkloadChecksum: number;
    workloadChecksumMatches: boolean;
    passed: boolean;
  };
  passed: boolean;
}

export interface LargeRepositoryBenchmarkResult {
  schemaVersion: 2;
  protocol: {
    version: 2;
    coldSamples: number;
    warmupSamples: number;
    warmSamples: number;
  };
  corpora: CorpusBenchmarkResult[];
  passed: boolean;
}

export interface BenchmarkClock {
  now(): number;
}

interface PreparedGraphRuntime {
  graph: KnowledgeGraph;
  hierarchyIndex: GraphHierarchyIndex;
  projectionContext: HierarchicalGraphProjectionContext;
  quickJumpIndex: GraphQuickJumpIndex;
  navigations: GraphExplorerNavigation[];
}

function roundMilliseconds(value: number): number {
  return Number(value.toFixed(3));
}

export function percentileNearestRank(
  samples: readonly number[],
  percentile: number,
): number {
  if (samples.length === 0) throw new Error("percentile requires at least one sample");
  if (!(percentile > 0 && percentile <= 1)) {
    throw new Error("percentile must be greater than zero and at most one");
  }
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.ceil(percentile * sorted.length) - 1]!;
}

export function summarizeBenchmarkSamples(
  samples: readonly number[],
): BenchmarkStatistics {
  if (samples.some((sample) => !Number.isFinite(sample) || sample < 0)) {
    throw new Error("benchmark samples must be finite, non-negative milliseconds");
  }
  return {
    minimumMs: roundMilliseconds(Math.min(...samples)),
    p50Ms: roundMilliseconds(percentileNearestRank(samples, 0.5)),
    p95Ms: roundMilliseconds(percentileNearestRank(samples, 0.95)),
    maximumMs: roundMilliseconds(Math.max(...samples)),
  };
}

function measure(
  clock: BenchmarkClock,
  sampleCount: number,
  operation: (index: number) => number,
): { samplesMs: number[]; checksum: number } {
  const samplesMs: number[] = [];
  let checksum = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const startedAt = clock.now();
    checksum = (checksum + operation(index)) >>> 0;
    samplesMs.push(roundMilliseconds(clock.now() - startedAt));
  }
  return { samplesMs, checksum };
}

function prepareRuntime(graph: KnowledgeGraph): PreparedGraphRuntime {
  const hierarchyIndex = buildGraphHierarchyIndex(graph);
  const projectionContext = createHierarchicalGraphProjectionContext({ graph });
  const quickJumpIndex = buildGraphQuickJumpIndex({ graph, hierarchyIndex });
  const navigations: GraphExplorerNavigation[] = [{ level: "overview" }];
  for (const scope of hierarchyIndex.scopes) {
    navigations.push({ level: "scope", scopeId: scope.id });
    const firstClusterId = scope.clusterIds[0];
    const firstFileClusterId = scope.clusterIds.find((clusterId) =>
      (hierarchyIndex.clusterById.get(clusterId)?.fileIds.length ?? 0) > 0);
    const representativeClusterIds = [...new Set([
      firstClusterId,
      firstFileClusterId,
    ].filter((clusterId): clusterId is string => Boolean(clusterId)))];
    for (const clusterId of representativeClusterIds) {
      const cluster = hierarchyIndex.clusterById.get(clusterId);
      if (!cluster) continue;
      navigations.push({ level: "cluster", scopeId: scope.id, clusterId });
      const fileId = cluster.fileIds[0];
      if (fileId) {
        navigations.push({
          level: "file",
          scopeId: scope.id,
          clusterId,
          fileId,
        });
      }
    }
  }
  return {
    graph,
    hierarchyIndex,
    projectionContext,
    quickJumpIndex,
    navigations,
  };
}

function projectView(runtime: PreparedGraphRuntime, index: number): {
  checksum: number;
  nodeCount: number;
  edgeCount: number;
  navigation: GraphExplorerNavigation;
  view: HierarchicalSemanticGraph;
} {
  const navigation = runtime.navigations[
    (index * 17) % runtime.navigations.length
  ]!;
  const view = buildHierarchicalSemanticGraph({
    graph: runtime.graph,
    hierarchyIndex: runtime.hierarchyIndex,
    projectionContext: runtime.projectionContext,
    mode: index % 2 === 0 ? "architecture" : "call",
    navigation,
    materializedNodeId: null,
  });
  const quickItem = runtime.quickJumpIndex.items[
    (index * 97) % runtime.quickJumpIndex.items.length
  ];
  const intent = quickItem
    ? runtime.quickJumpIndex.resolve({ objectId: quickItem.id, source: "quick-jump" })
    : null;
  const checksum = (
    view.nodes.length * 31
    + view.edges.length * 17
    + (intent?.selectionId.length ?? 0)
  ) >>> 0;
  return {
    checksum,
    nodeCount: view.nodes.length,
    edgeCount: view.edges.length,
    navigation,
    view,
  };
}

function layoutInput(
  projection: ReturnType<typeof projectView>,
  requestId: number,
): LayoutMessage {
  const nodeSizeById = new Map(projection.view.nodes.map((node) => [
    node.id,
    graphNodeSize(projection.navigation.level, node),
  ]));
  return buildGraphLayoutMessage({
    requestId,
    structureKey: `benchmark:${requestId}:${projection.navigation.level}`,
    navigation: projection.navigation,
    viewport: quantizeGraphViewport(
      requestId % 2 === 0 ? 1_440 : 960,
      requestId % 3 === 0 ? 800 : 640,
    ),
    baseGraph: projection.view,
    nodeSizeById,
  });
}

function benchmarkCorpus(
  corpus: LargeRepositoryCorpus,
  clock: BenchmarkClock,
  protocol: {
    coldSamples: number;
    warmupSamples: number;
    warmSamples: number;
  },
): CorpusBenchmarkResult {
  const fixture = createLargeRepositoryPerformanceFixture(corpus);
  const { graph } = fixture;
  let hierarchyScopeCount = 0;
  let hierarchyClusterCount = 0;
  let quickJumpItemCount = 0;
  let minimumRenderedNodeCount = Number.POSITIVE_INFINITY;
  let maximumRenderedNodeCount = 0;
  let maximumRenderedEdgeCount = 0;
  const navigationLevelsCovered = new Set<GraphExplorerNavigation["level"]>();
  let layoutResultsValid = true;
  const observeProjection = (projection: ReturnType<typeof projectView>) => {
    minimumRenderedNodeCount = Math.min(minimumRenderedNodeCount, projection.nodeCount);
    maximumRenderedNodeCount = Math.max(maximumRenderedNodeCount, projection.nodeCount);
    maximumRenderedEdgeCount = Math.max(maximumRenderedEdgeCount, projection.edgeCount);
    navigationLevelsCovered.add(projection.navigation.level);
  };

  const cold = measure(clock, protocol.coldSamples, (index) => {
    const runtime = prepareRuntime(graph);
    const projection = projectView(runtime, index);
    hierarchyScopeCount = runtime.hierarchyIndex.scopes.length;
    hierarchyClusterCount = runtime.hierarchyIndex.clusterById.size;
    quickJumpItemCount = runtime.quickJumpIndex.items.length;
    observeProjection(projection);
    return projection.checksum
      + hierarchyScopeCount
      + hierarchyClusterCount
      + quickJumpItemCount;
  });

  const warmRuntime = prepareRuntime(graph);
  for (let index = 0; index < protocol.warmupSamples; index += 1) {
    projectView(warmRuntime, index);
  }
  const warm = measure(clock, protocol.warmSamples, (index) => {
    const projection = projectView(warmRuntime, index + protocol.warmupSamples);
    observeProjection(projection);
    return projection.checksum;
  });

  const layoutInputs = Array.from(
    { length: protocol.warmupSamples + protocol.warmSamples },
    (_, index) => {
      const projection = projectView(warmRuntime, index + protocol.warmupSamples);
      observeProjection(projection);
      return layoutInput(projection, index + 1);
    },
  );
  for (let index = 0; index < protocol.warmupSamples; index += 1) {
    const input = layoutInputs[index]!;
    layoutResultsValid = isValidLayoutResult(input, computeLayout(input))
      && layoutResultsValid;
  }
  const layout = measure(clock, protocol.warmSamples, (index) => {
    const input = layoutInputs[index + protocol.warmupSamples]!;
    const result = computeLayout(input);
    const valid = isValidLayoutResult(input, result);
    layoutResultsValid = valid && layoutResultsValid;
    return (
      Object.keys(result.positions).length * 29
      + Math.round(result.bounds.width)
      + Math.round(result.bounds.height)
    ) >>> 0;
  });

  const coldStats = summarizeBenchmarkSamples(cold.samplesMs);
  const warmStats = summarizeBenchmarkSamples(warm.samplesMs);
  const layoutStats = summarizeBenchmarkSamples(layout.samplesMs);
  const measurements: BenchmarkMeasurement[] = [
    {
      operation: "graph-model-bootstrap",
      cacheState: "cold",
      warmupSamples: 0,
      sampleCount: cold.samplesMs.length,
      samplesMs: cold.samplesMs,
      statistics: coldStats,
      budget: {
        percentile: "p95",
        limitMs: corpus.budgetsMs.coldCacheBootstrapP95,
        source: "P0 Task Graph initial overlay (Graph pipeline slice)",
      },
      passed: coldStats.p95Ms <= corpus.budgetsMs.coldCacheBootstrapP95,
    },
    {
      operation: "graph-view-projection",
      cacheState: "warm",
      warmupSamples: protocol.warmupSamples,
      sampleCount: warm.samplesMs.length,
      samplesMs: warm.samplesMs,
      statistics: warmStats,
      budget: {
        percentile: "p95",
        limitMs: corpus.budgetsMs.warmViewProjectionP95,
        source: "WP0 large-repository hard ceiling",
      },
      passed: warmStats.p95Ms <= corpus.budgetsMs.warmViewProjectionP95,
    },
    {
      operation: "graph-layout",
      cacheState: "warm",
      warmupSamples: protocol.warmupSamples,
      sampleCount: layout.samplesMs.length,
      samplesMs: layout.samplesMs,
      statistics: layoutStats,
      budget: {
        percentile: "p95",
        limitMs: corpus.budgetsMs.warmLayoutP95,
        source: "WP0 large-repository hard ceiling",
      },
      passed: layoutStats.p95Ms <= corpus.budgetsMs.warmLayoutP95,
    },
  ];
  const quickJumpIds = new Set(warmRuntime.quickJumpIndex.items.map((item) => item.id));
  const quickJumpCoversEveryGraphNode = graph.nodes.every((node) => quickJumpIds.has(node.id));
  const renderedNodeLimit = 38;
  const renderedEdgeLimit = 100;
  const renderedBoundsPassed = maximumRenderedNodeCount <= renderedNodeLimit
    && maximumRenderedEdgeCount <= renderedEdgeLimit
    && minimumRenderedNodeCount > 0;
  const fixtureChecksumMatches = fixture.checksum === corpus.expectedChecksum;
  const stableNavigationLevels = [...navigationLevelsCovered].sort();
  const navigationCoveragePassed = stableNavigationLevels.length === 4;
  const hierarchyClusterCountMatches = hierarchyClusterCount
    === corpus.expectedIntegrity.hierarchyClusterCount;
  const quickJumpItemCountMatches = quickJumpItemCount
    === corpus.expectedIntegrity.quickJumpItemCount;
  const renderedNodeRangeMatches = minimumRenderedNodeCount
    === corpus.expectedIntegrity.minimumRenderedNodeCount
    && maximumRenderedNodeCount
      === corpus.expectedIntegrity.maximumRenderedNodeCount;
  const renderedEdgeCountMatches = maximumRenderedEdgeCount
    === corpus.expectedIntegrity.maximumRenderedEdgeCount;
  const workloadChecksum = (cold.checksum + warm.checksum + layout.checksum) >>> 0;
  const workloadChecksumMatches = workloadChecksum
    === corpus.expectedIntegrity.workloadChecksum;
  const integrityPassed = fixtureChecksumMatches
    && hierarchyScopeCount === corpus.scopeCount
    && hierarchyClusterCountMatches
    && quickJumpItemCountMatches
    && quickJumpCoversEveryGraphNode
    && renderedBoundsPassed
    && renderedNodeRangeMatches
    && renderedEdgeCountMatches
    && navigationCoveragePassed
    && layoutResultsValid
    && workloadChecksumMatches;
  const integrity = {
    fixtureChecksum: fixture.checksum,
    expectedFixtureChecksum: corpus.expectedChecksum,
    fixtureChecksumMatches,
    hierarchyScopeCount,
    hierarchyClusterCount,
    expectedHierarchyClusterCount: corpus.expectedIntegrity.hierarchyClusterCount,
    hierarchyClusterCountMatches,
    quickJumpItemCount,
    expectedQuickJumpItemCount: corpus.expectedIntegrity.quickJumpItemCount,
    quickJumpItemCountMatches,
    quickJumpCoversEveryGraphNode,
    minimumRenderedNodeCount,
    expectedMinimumRenderedNodeCount:
      corpus.expectedIntegrity.minimumRenderedNodeCount,
    maximumRenderedNodeCount,
    expectedMaximumRenderedNodeCount:
      corpus.expectedIntegrity.maximumRenderedNodeCount,
    renderedNodeRangeMatches,
    maximumRenderedEdgeCount,
    expectedMaximumRenderedEdgeCount:
      corpus.expectedIntegrity.maximumRenderedEdgeCount,
    renderedEdgeCountMatches,
    navigationLevelsCovered: stableNavigationLevels,
    navigationCoveragePassed,
    renderedNodeLimit,
    renderedEdgeLimit,
    renderedBoundsPassed,
    layoutResultsValid,
    workloadChecksum,
    expectedWorkloadChecksum: corpus.expectedIntegrity.workloadChecksum,
    workloadChecksumMatches,
    passed: integrityPassed,
  };
  return {
    corpus: {
      ...corpus,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
    },
    measurements,
    integrity,
    passed: measurements.every((measurement) => measurement.passed)
      && integrity.passed,
  };
}

export function runLargeRepositoryBenchmark(input: {
  clock?: BenchmarkClock;
  corpora?: readonly LargeRepositoryCorpus[];
  protocol?: {
    coldSamples: number;
    warmupSamples: number;
    warmSamples: number;
  };
} = {}): LargeRepositoryBenchmarkResult {
  const clock = input.clock ?? performance;
  const corpora = input.corpora ?? LARGE_REPOSITORY_CORPORA;
  const protocol = input.protocol ?? LARGE_REPOSITORY_BENCHMARK_PROTOCOL;
  if (protocol.coldSamples < 1 || protocol.warmSamples < 1 || protocol.warmupSamples < 0) {
    throw new Error("benchmark protocol requires positive sample counts and non-negative warmups");
  }
  const results = corpora.map((corpus) => benchmarkCorpus(corpus, clock, protocol));
  return {
    schemaVersion: 2,
    protocol: {
      version: 2,
      coldSamples: protocol.coldSamples,
      warmupSamples: protocol.warmupSamples,
      warmSamples: protocol.warmSamples,
    },
    corpora: results,
    passed: results.every((result) => result.passed),
  };
}
