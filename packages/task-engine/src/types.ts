import type {
  GraphEdge,
  GraphNode,
  KnowledgeGraph,
} from "@understand-code/core";

/**
 * The task engine intentionally accepts structural projections of Repo Pulse,
 * Repository Snapshot, and Wiki artifacts.  This keeps the ranking/traversal
 * algorithms pure and makes adapters responsible for contract validation.
 */
export type ArtifactFreshnessLike =
  | "fresh"
  | "partial"
  | "stale"
  | "missing"
  | "error";

export type RepoPulseStatusLike =
  | "not_ready"
  | "fresh"
  | "partial"
  | "stale"
  | "unknown"
  | "rebuilding"
  | "error";

export type CompletenessStatusLike =
  | "complete"
  | "partial"
  | "unknown"
  | "unsupported";

export interface RepoPulseLike {
  evaluatedSnapshotId?: string;
  status: RepoPulseStatusLike;
  artifactFreshness: Readonly<Record<string, ArtifactFreshnessLike>>;
  completeness?: {
    callGraph: {
      status: CompletenessStatusLike;
      reasons?: readonly string[];
    };
  };
  reasons?: readonly string[];
}

export interface RepositoryChangeLike {
  path: string;
  oldPath?: string;
  source?: string;
  kind?: string;
}

export interface RepositorySnapshotLike {
  snapshotId: string;
  headCommit?: string;
  captureStatus: "complete" | "partial" | "error";
  limitations?: readonly string[];
  changes: readonly RepositoryChangeLike[];
}

export interface WikiRecordLike {
  id: string;
  nodeId?: string;
  pageId?: string;
  title: string;
  summary?: string;
  content?: string;
  filePath?: string;
  terms?: readonly string[];
  businessTerms?: readonly string[];
  evidenceIds?: readonly string[];
}

export interface WikiIndexLike {
  generatedAt?: string;
  freshness?: ArtifactFreshnessLike;
  valid?: boolean;
  records: readonly WikiRecordLike[];
}

export interface RankingScope {
  nodeIds?: readonly string[];
  nodeTypes?: readonly GraphNode["type"][];
  pathPrefixes?: readonly string[];
  excludePathPrefixes?: readonly string[];
}

export interface CandidateRankingOptions {
  scope?: RankingScope;
  maxCandidates?: number;
  tokenBudget?: number;
  cursor?: string;
  /**
   * Maximum undirected distance from a direct lexical/Wiki/change anchor that
   * may contribute a graph-proximity signal.
   */
  proximityDepth?: number;
}

export type CandidateSignalKind =
  | "exact_symbol"
  | "lexical"
  | "graph_degree"
  | "graph_proximity"
  | "entry_point"
  | "test"
  | "wiki"
  | "recent_change";

export interface CandidateSignal {
  kind: CandidateSignalKind;
  score: number;
  reason: string;
  evidenceIds: readonly string[];
}

export interface RankingDiagnostic {
  code: string;
  message: string;
  source:
    | "graph"
    | "repo_pulse"
    | "repository_snapshot"
    | "wiki"
    | "cursor"
    | "budget";
}

export interface RankedCandidate {
  rank: number;
  nodeId: string;
  node: GraphNode;
  score: number;
  epistemicStatus: "inferred" | "unknown_boundary";
  freshConclusion: boolean;
  signals: readonly CandidateSignal[];
  reasons: readonly string[];
  evidenceIds: readonly string[];
  estimatedTokens: number;
}

export interface CandidateRankingPage {
  queryDigest: string;
  candidates: readonly RankedCandidate[];
  nextCursor?: string;
  consumedTokens: number;
  totalCandidates: number;
  freshness: {
    graph: ArtifactFreshnessLike | "unknown";
    wiki: ArtifactFreshnessLike | "unknown" | "not_supplied" | "invalid";
    repositorySnapshot:
      | "fresh"
      | "partial"
      | "stale"
      | "error"
      | "not_supplied";
    freshConclusionEligible: boolean;
  };
  truncation: {
    truncated: boolean;
    reason?: "max_candidates" | "token_budget";
    hiddenCount: number;
  };
  diagnostics: readonly RankingDiagnostic[];
}

export interface RankCandidatesInput {
  query: string;
  graph: KnowledgeGraph;
  repoPulse?: RepoPulseLike;
  repositorySnapshot?: RepositorySnapshotLike;
  wiki?: WikiIndexLike;
  options?: CandidateRankingOptions;
}

export type ImpactDirection = "downstream" | "upstream" | "both";
export type ImpactClassification =
  | "observed"
  | "inferred"
  | "unknown_boundary";

export interface EdgeEvidenceLike {
  source: string;
  target: string;
  edgeType: GraphEdge["type"];
  evidenceId?: string;
  classification: ImpactClassification;
  freshness: ArtifactFreshnessLike;
}

export interface ImpactTraceOptions {
  direction?: ImpactDirection;
  maxDepth?: number;
  nodeBudget?: number;
  maxPaths?: number;
}

export interface ImpactStep {
  fromNodeId: string;
  toNodeId: string;
  edgeSourceId: string;
  edgeTargetId: string;
  edgeType: GraphEdge["type"];
  direction: Exclude<ImpactDirection, "both">;
  classification: ImpactClassification;
  reason: string;
  evidenceId?: string;
}

export interface ImpactPath {
  startNodeId: string;
  endNodeId: string;
  nodeIds: readonly string[];
  steps: readonly ImpactStep[];
  depth: number;
  classification: ImpactClassification;
  reasons: readonly string[];
  evidenceIds: readonly string[];
}

export type ImpactTruncationReason =
  | "max_depth"
  | "node_budget"
  | "max_paths"
  | "call_graph_incomplete"
  | "graph_not_fresh"
  | "invalid_graph";

export interface ImpactBoundary {
  reason: ImpactTruncationReason;
  message: string;
  nodeId?: string;
}

export interface ImpactTraceResult {
  direction: ImpactDirection;
  startNodeIds: readonly string[];
  paths: readonly ImpactPath[];
  visitedNodeIds: readonly string[];
  classification: ImpactClassification;
  completeness: "complete" | "partial" | "unknown";
  truncation: {
    truncated: boolean;
    reasons: readonly ImpactTruncationReason[];
    hiddenCount: number;
    hiddenCountIsLowerBound: boolean;
  };
  boundaries: readonly ImpactBoundary[];
  diagnostics: readonly RankingDiagnostic[];
}

export interface TraceImpactInput {
  graph: KnowledgeGraph;
  startNodeIds: readonly string[];
  repoPulse?: RepoPulseLike;
  edgeEvidence?: readonly EdgeEvidenceLike[];
  options?: ImpactTraceOptions;
}

export interface ValidatedGraphView {
  graph: KnowledgeGraph;
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
  valid: boolean;
  diagnostics: readonly RankingDiagnostic[];
}
