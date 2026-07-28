import { describe, expect, it } from "vitest";
import {
  LARGE_REPOSITORY_BENCHMARK_PROTOCOL,
  percentileNearestRank,
  runLargeRepositoryBenchmark,
  summarizeBenchmarkSamples,
} from "../largeRepositoryBenchmark.js";
import {
  createLargeRepositoryPerformanceFixture,
  SELF_HOST_SHAPE_CORPUS,
  SYNTHETIC_10K_CORPUS,
  type LargeRepositoryCorpus,
} from "../largeRepositoryPerformanceFixture.js";

function frequencies<T extends string>(values: readonly T[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function createSmokeCorpus(): LargeRepositoryCorpus {
  const draft: LargeRepositoryCorpus = {
    ...SELF_HOST_SHAPE_CORPUS,
    id: "self-host-shape",
    label: "Benchmark smoke",
    scopeCount: 2,
    nodeTypeCounts: {
      file: 8,
      function: 16,
      class: 4,
      config: 2,
      document: 4,
      service: 1,
    },
    edgeTypeCounts: {
      contains: 20,
      calls: 8,
      exports: 8,
      imports: 4,
      tested_by: 2,
      documents: 2,
      related: 2,
      configures: 1,
      depends_on: 1,
    },
    expectedIntegrity: {
      hierarchyClusterCount: 13,
      quickJumpItemCount: 52,
      minimumRenderedNodeCount: 1,
      maximumRenderedNodeCount: 7,
      maximumRenderedEdgeCount: 14,
      workloadChecksum: 5_166,
    },
    budgetsMs: {
      coldCacheBootstrapP95: 60_000,
      warmViewProjectionP95: 60_000,
      warmLayoutP95: 60_000,
    },
  };
  return {
    ...draft,
    expectedChecksum: createLargeRepositoryPerformanceFixture(draft).checksum,
  };
}

describe("large repository performance fixture", () => {
  it("locks the self-host snapshot dimensions and topology deterministically", () => {
    const first = createLargeRepositoryPerformanceFixture(SELF_HOST_SHAPE_CORPUS);
    const second = createLargeRepositoryPerformanceFixture(SELF_HOST_SHAPE_CORPUS);

    expect(first.graph.nodes).toHaveLength(1_264);
    expect(first.graph.edges).toHaveLength(2_299);
    expect(first.graph.layers).toHaveLength(9);
    expect(frequencies(first.graph.nodes.map((node) => node.type))).toEqual(
      SELF_HOST_SHAPE_CORPUS.nodeTypeCounts,
    );
    expect(frequencies(first.graph.edges.map((edge) => edge.type))).toEqual(
      SELF_HOST_SHAPE_CORPUS.edgeTypeCounts,
    );
    expect(second.graph).toEqual(first.graph);
    expect(first.checksum).toBe(SELF_HOST_SHAPE_CORPUS.expectedChecksum);
  });

  it("builds the exact 10k corpus with valid edge endpoints", () => {
    const { graph } = createLargeRepositoryPerformanceFixture(SYNTHETIC_10K_CORPUS);
    const nodeIds = new Set(graph.nodes.map((node) => node.id));

    expect(graph.nodes).toHaveLength(10_000);
    expect(graph.edges).toHaveLength(18_188);
    expect(graph.layers).toHaveLength(16);
    expect(frequencies(graph.nodes.map((node) => node.type))).toEqual(
      SYNTHETIC_10K_CORPUS.nodeTypeCounts,
    );
    expect(frequencies(graph.edges.map((edge) => edge.type))).toEqual(
      SYNTHETIC_10K_CORPUS.edgeTypeCounts,
    );
    expect(graph.edges.every((edge) =>
      nodeIds.has(edge.source) && nodeIds.has(edge.target))).toBe(true);
    expect(createLargeRepositoryPerformanceFixture(SYNTHETIC_10K_CORPUS).checksum)
      .toBe(SYNTHETIC_10K_CORPUS.expectedChecksum);
  });
});

describe("large repository benchmark statistics", () => {
  it("uses nearest-rank p50 and p95 without mutating samples", () => {
    const samples = [10, 1, 9, 2, 8, 3, 7, 4, 6, 5, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

    expect(percentileNearestRank(samples, 0.5)).toBe(10);
    expect(percentileNearestRank(samples, 0.95)).toBe(19);
    expect(samples).toEqual([10, 1, 9, 2, 8, 3, 7, 4, 6, 5, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(summarizeBenchmarkSamples(samples)).toEqual({
      minimumMs: 1,
      p50Ms: 10,
      p95Ms: 19,
      maximumMs: 20,
    });
  });

  it("rejects invalid samples and protocol counts", () => {
    expect(() => summarizeBenchmarkSamples([])).toThrow("at least one sample");
    expect(() => summarizeBenchmarkSamples([Number.NaN])).toThrow("finite");
    expect(() => percentileNearestRank([1], 0)).toThrow("greater than zero");
    expect(() => runLargeRepositoryBenchmark({
      corpora: [],
      protocol: { coldSamples: 0, warmupSamples: 0, warmSamples: 1 },
    })).toThrow("positive sample counts");
  });

  it("runs the real graph model with a small deterministic smoke corpus", () => {
    const smokeCorpus = createSmokeCorpus();

    const result = runLargeRepositoryBenchmark({
      corpora: [smokeCorpus],
      protocol: { coldSamples: 2, warmupSamples: 1, warmSamples: 3 },
    });

    expect(result.passed).toBe(true);
    expect(result.corpora).toHaveLength(1);
    expect(result.corpora[0]?.measurements.map((measurement) => ({
      cacheState: measurement.cacheState,
      samples: measurement.sampleCount,
      warmups: measurement.warmupSamples,
    }))).toEqual([
      { cacheState: "cold", samples: 2, warmups: 0 },
      { cacheState: "warm", samples: 3, warmups: 1 },
      { cacheState: "warm", samples: 3, warmups: 1 },
    ]);
    expect(result.corpora[0]?.integrity.quickJumpItemCount).toBeGreaterThan(0);
    expect(result.corpora[0]?.integrity.workloadChecksum).toBeGreaterThan(0);
    expect(result.corpora[0]?.integrity.workloadChecksumMatches).toBe(true);
    expect(result.corpora[0]?.integrity.renderedNodeRangeMatches).toBe(true);
    expect(result.corpora[0]?.integrity.renderedEdgeCountMatches).toBe(true);
    expect(result.corpora[0]?.integrity.layoutResultsValid).toBe(true);
    expect(result.corpora[0]?.integrity.passed).toBe(true);
  });

  it("fails the gate when the frozen workload signature does not match", () => {
    const smokeCorpus = createSmokeCorpus();
    const result = runLargeRepositoryBenchmark({
      corpora: [{
        ...smokeCorpus,
        expectedIntegrity: {
          ...smokeCorpus.expectedIntegrity,
          workloadChecksum: smokeCorpus.expectedIntegrity.workloadChecksum + 1,
        },
      }],
      protocol: { coldSamples: 2, warmupSamples: 1, warmSamples: 3 },
    });

    expect(result.corpora[0]?.measurements.every((measurement) => measurement.passed)).toBe(true);
    expect(result.corpora[0]?.integrity.workloadChecksumMatches).toBe(false);
    expect(result.corpora[0]?.integrity.passed).toBe(false);
    expect(result.passed).toBe(false);
  });

  it("fails the gate when corpus integrity does not match", () => {
    const tamperedCorpus = {
      ...SELF_HOST_SHAPE_CORPUS,
      expectedChecksum: "fnv1a32:00000000",
    };
    const result = runLargeRepositoryBenchmark({
      corpora: [tamperedCorpus],
      protocol: { coldSamples: 1, warmupSamples: 0, warmSamples: 1 },
    });

    expect(result.corpora[0]?.measurements.every((measurement) => measurement.passed)).toBe(true);
    expect(result.corpora[0]?.integrity.fixtureChecksumMatches).toBe(false);
    expect(result.corpora[0]?.integrity.passed).toBe(false);
    expect(result.passed).toBe(false);
  });

  it("keeps the release protocol at five warmups and thirty warm samples", () => {
    expect(LARGE_REPOSITORY_BENCHMARK_PROTOCOL).toEqual({
      version: 2,
      coldSamples: 10,
      warmupSamples: 5,
      warmSamples: 30,
    });
  });
});
