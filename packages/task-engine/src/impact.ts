import type { GraphEdge } from "@understand-code/core";
import { validateRankingGraph } from "./ranking.js";
import { compareUnicodeCodeUnits } from "./stable-order.js";
import type {
  EdgeEvidenceLike,
  ImpactBoundary,
  ImpactClassification,
  ImpactDirection,
  ImpactPath,
  ImpactStep,
  ImpactTraceResult,
  ImpactTruncationReason,
  RankingDiagnostic,
  RepoPulseLike,
  TraceImpactInput,
  ValidatedGraphView,
} from "./types.js";

const DEFAULT_MAX_DEPTH = 4;
const DEFAULT_NODE_BUDGET = 500;
const DEFAULT_MAX_PATHS = 100;
const MAX_DEPTH = 64;
const MAX_NODE_BUDGET = 100_000;
const MAX_PATHS = 10_000;

interface LogicalArc {
  fromNodeId: string;
  toNodeId: string;
  edge: GraphEdge;
}

interface TraversalArc extends LogicalArc {
  traversalDirection: Exclude<ImpactDirection, "both">;
}

interface QueueItem {
  nodeId: string;
  startNodeId: string;
  nodeIds: string[];
  steps: ImpactStep[];
}

interface GraphAssessment {
  graphFresh: boolean;
  callGraphStatus: "complete" | "partial" | "unknown" | "unsupported";
  diagnostics: RankingDiagnostic[];
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUnicodeCodeUnits);
}

function positiveInteger(
  value: number | undefined,
  fallback: number,
  name: string,
  maximum: number,
): number {
  const resolved = value ?? fallback;
  if (
    !Number.isSafeInteger(resolved) ||
    resolved <= 0 ||
    resolved > maximum
  ) {
    throw new RangeError(
      `${name} must be a positive integer and at most ${maximum}`,
    );
  }
  return resolved;
}

function depthLimit(value: number | undefined): number {
  const resolved = value ?? DEFAULT_MAX_DEPTH;
  if (
    !Number.isSafeInteger(resolved) ||
    resolved < 0 ||
    resolved > MAX_DEPTH
  ) {
    throw new RangeError(
      `maxDepth must be a non-negative integer and at most ${MAX_DEPTH}`,
    );
  }
  return resolved;
}

function assessGraph(
  view: ValidatedGraphView,
  pulse: RepoPulseLike | undefined,
): GraphAssessment {
  const diagnostics = [...view.diagnostics];
  const graphFreshness = pulse?.artifactFreshness.graph;
  const pulseAllowsGraph =
    pulse !== undefined &&
    !["not_ready", "unknown", "rebuilding", "error"].includes(pulse.status);
  const graphFresh =
    graphFreshness === "fresh" && pulseAllowsGraph && view.valid;
  if (pulse === undefined) {
    diagnostics.push({
      code: "repo_pulse_missing",
      source: "repo_pulse",
      message:
        "Repo Pulse was not supplied; impact traversal has an unknown Graph freshness boundary",
    });
  } else if (graphFreshness !== "fresh") {
    diagnostics.push({
      code: "graph_not_fresh",
      source: "repo_pulse",
      message: `Graph artifact is ${graphFreshness ?? "unknown"}; impact conclusions cannot be fresh`,
    });
  } else if (!pulseAllowsGraph) {
    diagnostics.push({
      code: "repo_pulse_not_usable",
      source: "repo_pulse",
      message: `Repo Pulse status ${pulse.status} cannot support a fresh impact conclusion`,
    });
  }
  const callGraphStatus = pulse?.completeness?.callGraph.status ?? "unknown";
  if (callGraphStatus !== "complete") {
    diagnostics.push({
      code: "call_graph_incomplete",
      source: "repo_pulse",
      message:
        `Call Graph completeness is ${callGraphStatus}; absence of additional impacts must not be treated as proof`,
    });
  }
  diagnostics.sort((left, right) =>
    compareUnicodeCodeUnits(
      `${left.code}\0${left.message}`,
      `${right.code}\0${right.message}`,
    ),
  );
  return { graphFresh, callGraphStatus, diagnostics };
}

function logicalArcs(edge: GraphEdge): LogicalArc[] {
  if (edge.direction === "forward") {
    return [
      { fromNodeId: edge.source, toNodeId: edge.target, edge },
    ];
  }
  if (edge.direction === "backward") {
    return [
      { fromNodeId: edge.target, toNodeId: edge.source, edge },
    ];
  }
  return [
    { fromNodeId: edge.source, toNodeId: edge.target, edge },
    { fromNodeId: edge.target, toNodeId: edge.source, edge },
  ];
}

function buildTraversalAdjacency(
  view: ValidatedGraphView,
  direction: ImpactDirection,
): Map<string, TraversalArc[]> {
  const adjacency = new Map<string, TraversalArc[]>(
    view.nodes.map((node) => [node.id, []]),
  );
  for (const edge of view.edges) {
    const arcs = logicalArcs(edge);
    if (direction === "downstream" || direction === "both") {
      for (const arc of arcs) {
        adjacency.get(arc.fromNodeId)?.push({
          ...arc,
          traversalDirection: "downstream",
        });
      }
    }
    if (direction === "upstream" || direction === "both") {
      for (const arc of arcs) {
        adjacency.get(arc.toNodeId)?.push({
          fromNodeId: arc.toNodeId,
          toNodeId: arc.fromNodeId,
          edge,
          traversalDirection: "upstream",
        });
      }
    }
  }

  for (const [nodeId, arcs] of adjacency) {
    const unique = new Map<string, TraversalArc>();
    for (const arc of arcs.sort(compareArc)) {
      const key = [
        arc.toNodeId,
        arc.edge.source,
        arc.edge.target,
        arc.edge.type,
        arc.edge.direction,
      ].join("\0");
      if (!unique.has(key)) unique.set(key, arc);
    }
    adjacency.set(nodeId, [...unique.values()]);
  }
  return adjacency;
}

function compareArc(left: TraversalArc, right: TraversalArc): number {
  return (
    compareUnicodeCodeUnits(left.toNodeId, right.toNodeId) ||
    compareUnicodeCodeUnits(left.edge.type, right.edge.type) ||
    compareUnicodeCodeUnits(left.edge.source, right.edge.source) ||
    compareUnicodeCodeUnits(left.edge.target, right.edge.target) ||
    compareUnicodeCodeUnits(
      left.traversalDirection,
      right.traversalDirection,
    )
  );
}

function evidenceKey(
  source: string,
  target: string,
  edgeType: GraphEdge["type"],
): string {
  return `${source}\0${target}\0${edgeType}`;
}

function evidencePreference(
  left: EdgeEvidenceLike,
  right: EdgeEvidenceLike,
): number {
  const freshnessRank = {
    fresh: 0,
    partial: 1,
    stale: 2,
    missing: 3,
    error: 4,
  } as const;
  const classificationRank = {
    observed: 0,
    inferred: 1,
    unknown_boundary: 2,
  } as const;
  return (
    freshnessRank[left.freshness] - freshnessRank[right.freshness] ||
    classificationRank[left.classification] -
      classificationRank[right.classification] ||
    compareUnicodeCodeUnits(
      left.evidenceId ?? "",
      right.evidenceId ?? "",
    )
  );
}

function buildEvidenceIndex(
  evidence: readonly EdgeEvidenceLike[],
): Map<string, EdgeEvidenceLike[]> {
  const index = new Map<string, EdgeEvidenceLike[]>();
  for (const item of evidence) {
    const key = evidenceKey(item.source, item.target, item.edgeType);
    const existing = index.get(key) ?? [];
    existing.push(item);
    index.set(key, existing);
  }
  for (const [key, values] of index) {
    index.set(key, values.sort(evidencePreference));
  }
  return index;
}

function classifyStep(
  arc: TraversalArc,
  graphFresh: boolean,
  evidenceIndex: ReadonlyMap<string, readonly EdgeEvidenceLike[]>,
  diagnostics: RankingDiagnostic[],
): ImpactStep {
  const evidence = evidenceIndex.get(
    evidenceKey(arc.edge.source, arc.edge.target, arc.edge.type),
  )?.[0];
  let classification: ImpactClassification;
  let reason: string;
  if (!graphFresh) {
    classification = "unknown_boundary";
    reason = "Graph freshness is unknown or degraded";
  } else if (evidence === undefined) {
    classification = "inferred";
    reason = "Graph relation has no fresh observed Evidence record";
  } else if (evidence.freshness !== "fresh") {
    classification = "unknown_boundary";
    reason =
      `Edge Evidence ${evidence.evidenceId ?? "(unidentified)"} is ${evidence.freshness}`;
    diagnostics.push({
      code: "edge_evidence_not_fresh",
      source: "graph",
      message:
        `Edge evidence ${evidence.evidenceId ?? "(unidentified)"} is ${evidence.freshness}: ` +
        `${arc.edge.source} -> ${arc.edge.target}`,
    });
  } else if (
    evidence.classification === "observed" &&
    evidence.evidenceId === undefined
  ) {
    classification = "inferred";
    reason = "Observed classification lacked the required evidenceId";
    diagnostics.push({
      code: "observed_evidence_missing_id",
      source: "graph",
      message:
        `Observed edge evidence without an evidenceId was downgraded to inferred: ` +
        `${arc.edge.source} -> ${arc.edge.target}`,
    });
  } else {
    classification = evidence.classification;
    reason =
      `Fresh Evidence ${evidence.evidenceId ?? "(unidentified)"} classifies this edge as ${evidence.classification}`;
  }

  return {
    fromNodeId: arc.fromNodeId,
    toNodeId: arc.toNodeId,
    edgeSourceId: arc.edge.source,
    edgeTargetId: arc.edge.target,
    edgeType: arc.edge.type,
    direction: arc.traversalDirection,
    classification,
    reason,
    ...(evidence?.evidenceId === undefined
      ? {}
      : { evidenceId: evidence.evidenceId }),
    ...(arc.edge.provenance === undefined
      ? {}
      : { provenance: arc.edge.provenance }),
  };
}

function worstClassification(
  values: readonly ImpactClassification[],
): ImpactClassification {
  if (values.includes("unknown_boundary")) return "unknown_boundary";
  if (values.includes("inferred")) return "inferred";
  return "observed";
}

function pathFromQueue(item: QueueItem): ImpactPath {
  return {
    startNodeId: item.startNodeId,
    endNodeId: item.nodeId,
    nodeIds: item.nodeIds,
    steps: item.steps,
    depth: item.steps.length,
    classification: worstClassification(
      item.steps.map((step) => step.classification),
    ),
    reasons: sortedUnique(item.steps.map((step) => step.reason)),
    evidenceIds: sortedUnique(
      item.steps.flatMap((step) =>
        step.evidenceId === undefined ? [] : [step.evidenceId]
      ),
    ),
  };
}

function addReason(
  reasons: Set<ImpactTruncationReason>,
  boundaries: ImpactBoundary[],
  reason: ImpactTruncationReason,
  message: string,
  nodeId?: string,
): void {
  reasons.add(reason);
  const key = `${reason}\0${nodeId ?? ""}\0${message}`;
  if (
    boundaries.some(
      (boundary) =>
        `${boundary.reason}\0${boundary.nodeId ?? ""}\0${boundary.message}` ===
        key,
    )
  ) {
    return;
  }
  boundaries.push({
    reason,
    message,
    ...(nodeId === undefined ? {} : { nodeId }),
  });
}

function traceCompleteness(
  graphFresh: boolean,
  graphValid: boolean,
  callGraphStatus: GraphAssessment["callGraphStatus"],
  reasons: ReadonlySet<ImpactTruncationReason>,
): "complete" | "partial" | "unknown" {
  if (
    !graphFresh ||
    !graphValid ||
    callGraphStatus === "unknown" ||
    callGraphStatus === "unsupported"
  ) {
    return "unknown";
  }
  if (callGraphStatus !== "complete" || reasons.size > 0) return "partial";
  return "complete";
}

/**
 * Performs deterministic, directional BFS over the current Knowledge Graph.
 * The result distinguishes known paths from inference and from explicit
 * unknown boundaries; it never equates an incomplete Call Graph with proof
 * that no additional impact exists.
 */
export function traceImpact(input: TraceImpactInput): ImpactTraceResult {
  const direction = input.options?.direction ?? "both";
  if (!["downstream", "upstream", "both"].includes(direction)) {
    throw new RangeError("direction must be downstream, upstream, or both");
  }
  const maxDepth = depthLimit(input.options?.maxDepth);
  const nodeBudget = positiveInteger(
    input.options?.nodeBudget,
    DEFAULT_NODE_BUDGET,
    "nodeBudget",
    MAX_NODE_BUDGET,
  );
  const maxPaths = positiveInteger(
    input.options?.maxPaths,
    DEFAULT_MAX_PATHS,
    "maxPaths",
    MAX_PATHS,
  );
  const startNodeIds = sortedUnique(input.startNodeIds);
  if (startNodeIds.length === 0) {
    throw new RangeError("startNodeIds must contain at least one node ID");
  }
  if (startNodeIds.length > nodeBudget) {
    throw new RangeError(
      "nodeBudget must be at least the number of unique startNodeIds",
    );
  }

  const view = validateRankingGraph(input.graph);
  const nodeIds = new Set(view.nodes.map((node) => node.id));
  const missingStarts = startNodeIds.filter((nodeId) => !nodeIds.has(nodeId));
  if (missingStarts.length > 0) {
    throw new RangeError(
      `Unknown impact start node ID${missingStarts.length === 1 ? "" : "s"}: ${missingStarts.join(", ")}`,
    );
  }

  const assessment = assessGraph(view, input.repoPulse);
  const diagnostics = [...assessment.diagnostics];
  const adjacency = buildTraversalAdjacency(view, direction);
  const evidenceIndex = buildEvidenceIndex(input.edgeEvidence ?? []);
  // The node budget is repository-wide and therefore counts unique Graph
  // nodes. Traversal deduplication is start-specific so two roots retain
  // their own shortest path when they converge on a shared downstream node.
  const visited = new Set(startNodeIds);
  const seenByStart = new Set(
    startNodeIds.map((nodeId) => `${nodeId}\0${nodeId}`),
  );
  const visitOrder = [...startNodeIds];
  const queue: QueueItem[] = startNodeIds.map((nodeId) => ({
    nodeId,
    startNodeId: nodeId,
    nodeIds: [nodeId],
    steps: [],
  }));
  const allPaths: ImpactPath[] = [];
  const hiddenNodeIds = new Set<string>();
  const reasons = new Set<ImpactTruncationReason>();
  const boundaries: ImpactBoundary[] = [];

  if (!view.valid) {
    addReason(
      reasons,
      boundaries,
      "invalid_graph",
      "Malformed or dangling Graph data was excluded from impact traversal",
    );
  }
  if (!assessment.graphFresh) {
    addReason(
      reasons,
      boundaries,
      "graph_not_fresh",
      "The Graph cannot support a fresh impact conclusion",
    );
  }
  if (assessment.callGraphStatus !== "complete") {
    const suppliedReasons =
      input.repoPulse?.completeness?.callGraph.reasons?.join("; ");
    addReason(
      reasons,
      boundaries,
      "call_graph_incomplete",
      suppliedReasons === undefined || suppliedReasons.length === 0
        ? `Call Graph completeness is ${assessment.callGraphStatus}; additional impacts may be hidden`
        : `Call Graph is incomplete: ${suppliedReasons}`,
    );
  }

  traversal:
  for (let offset = 0; offset < queue.length; offset += 1) {
    const current = queue[offset];
    if (current === undefined) continue;
    const arcs = adjacency.get(current.nodeId) ?? [];
    if (current.steps.length >= maxDepth) {
      const hidden = arcs
        .map((arc) => arc.toNodeId)
        .filter(
          (nodeId) =>
            !current.nodeIds.includes(nodeId) &&
            !seenByStart.has(`${current.startNodeId}\0${nodeId}`),
        );
      if (hidden.length > 0) {
        for (const nodeId of hidden) hiddenNodeIds.add(nodeId);
        addReason(
          reasons,
          boundaries,
          "max_depth",
          `Traversal stopped at maxDepth ${maxDepth}`,
          current.nodeId,
        );
      }
      continue;
    }

    for (const arc of arcs) {
      if (current.nodeIds.includes(arc.toNodeId)) continue;
      const startVisitKey = `${current.startNodeId}\0${arc.toNodeId}`;
      if (seenByStart.has(startVisitKey)) continue;
      if (allPaths.length >= maxPaths) {
        hiddenNodeIds.add(arc.toNodeId);
        addReason(
          reasons,
          boundaries,
          "max_paths",
          `Traversal stopped at maxPaths ${maxPaths}; additional paths were not materialized`,
          current.nodeId,
        );
        break traversal;
      }
      const isNewRepositoryNode = !visited.has(arc.toNodeId);
      if (isNewRepositoryNode && visited.size >= nodeBudget) {
        hiddenNodeIds.add(arc.toNodeId);
        addReason(
          reasons,
          boundaries,
          "node_budget",
          `Traversal stopped at nodeBudget ${nodeBudget}`,
          current.nodeId,
        );
        continue;
      }
      const step = classifyStep(
        arc,
        assessment.graphFresh,
        evidenceIndex,
        diagnostics,
      );
      const next: QueueItem = {
        nodeId: arc.toNodeId,
        startNodeId: current.startNodeId,
        nodeIds: [...current.nodeIds, arc.toNodeId],
        steps: [...current.steps, step],
      };
      seenByStart.add(startVisitKey);
      if (isNewRepositoryNode) {
        visited.add(arc.toNodeId);
        visitOrder.push(arc.toNodeId);
      }
      queue.push(next);
      allPaths.push(pathFromQueue(next));
    }
  }

  const paths = allPaths;

  diagnostics.sort((left, right) =>
    compareUnicodeCodeUnits(
      `${left.code}\0${left.message}`,
      `${right.code}\0${right.message}`,
    ),
  );
  boundaries.sort((left, right) =>
    compareUnicodeCodeUnits(
      `${left.reason}\0${left.nodeId ?? ""}\0${left.message}`,
      `${right.reason}\0${right.nodeId ?? ""}\0${right.message}`,
    ),
  );
  const orderedReasons = [...reasons].sort(compareUnicodeCodeUnits);
  const completeness = traceCompleteness(
    assessment.graphFresh,
    view.valid,
    assessment.callGraphStatus,
    reasons,
  );
  const pathClassification =
    paths.length === 0
      ? "observed"
      : worstClassification(paths.map((path) => path.classification));
  const classification =
    completeness === "complete"
      ? pathClassification
      : ("unknown_boundary" as const);
  const lowerBoundReasons: readonly ImpactTruncationReason[] = [
    "max_depth",
    "node_budget",
    "max_paths",
    "call_graph_incomplete",
    "graph_not_fresh",
    "invalid_graph",
  ];

  return {
    direction,
    startNodeIds,
    paths,
    visitedNodeIds: visitOrder,
    classification,
    completeness,
    truncation: {
      truncated: orderedReasons.length > 0,
      reasons: orderedReasons,
      hiddenCount: hiddenNodeIds.size,
      hiddenCountIsLowerBound: orderedReasons.some((reason) =>
        lowerBoundReasons.includes(reason)
      ),
    },
    boundaries,
    diagnostics,
  };
}
