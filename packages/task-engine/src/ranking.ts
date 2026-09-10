import { createHash } from "node:crypto";
import type {
  GraphEdge,
  GraphNode,
  KnowledgeGraph,
} from "@understand-code/core";
import {
  GraphEdgeSchema,
  GraphNodeSchema,
  KnowledgeGraphSchema,
} from "@understand-code/core/schema";
import { canonicalizeJson } from "@understand-code/contracts";
import { createWikiSearchContentMatcher } from "@understand-code/core/knowledge-base";
import { compareUnicodeCodeUnits } from "./stable-order.js";
import type {
  ArtifactFreshnessLike,
  CandidateRankingPage,
  CandidateSignal,
  CandidateSignalKind,
  RankCandidatesInput,
  RankedCandidate,
  RankingDiagnostic,
  RankingScope,
  RepositorySnapshotLike,
  RepoPulseLike,
  ValidatedGraphView,
  WikiIndexLike,
  WikiRecordLike,
} from "./types.js";

const DEFAULT_MAX_CANDIDATES = 20;
const DEFAULT_TOKEN_BUDGET = 8_000;
const DEFAULT_PROXIMITY_DEPTH = 2;
const MAX_MAX_CANDIDATES = 1_000;
const MAX_PROXIMITY_DEPTH = 8;
const CURSOR_PREFIX = "uci1_";

const SIGNAL_ORDER: Readonly<Record<CandidateSignalKind, number>> = {
  exact_symbol: 0,
  lexical: 1,
  graph_proximity: 2,
  graph_degree: 3,
  entry_point: 4,
  test: 5,
  wiki: 6,
  recent_change: 7,
};

interface CursorPayload {
  version: 1;
  queryDigest: string;
  offset: number;
}

interface SourceAssessment {
  graphFreshness: ArtifactFreshnessLike | "unknown";
  graphFresh: boolean;
  wikiFreshness:
    | ArtifactFreshnessLike
    | "unknown"
    | "not_supplied"
    | "invalid";
  wikiUsable: boolean;
  snapshotFreshness:
    | "fresh"
    | "partial"
    | "stale"
    | "error"
    | "not_supplied";
  snapshotUsable: boolean;
  diagnostics: RankingDiagnostic[];
}

interface MutableCandidate {
  node: GraphNode;
  exact: number;
  lexical: number;
  wiki: number;
  recent: number;
  directScore: number;
  signals: CandidateSignal[];
  evidenceIds: Set<string>;
}

interface WikiMatch {
  score: number;
  recordIds: string[];
  evidenceIds: string[];
}

/**
 * Cursors are deliberately an implementation detail. Callers should persist
 * and return them verbatim rather than parsing them.
 */
export class CandidateCursorError extends Error {
  readonly code: "invalid_cursor" | "cursor_query_mismatch";

  constructor(
    code: "invalid_cursor" | "cursor_query_mismatch",
    message: string,
  ) {
    super(message);
    this.name = "CandidateCursorError";
    this.code = code;
  }
}

function roundScore(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function hash(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/([\p{Ll}\d])([\p{Lu}])/gu, "$1 $2")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function tokens(value: string): string[] {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  return [...new Set(normalized.split(" "))];
}

function normalizePath(value: string): string {
  return value
    .replaceAll("\\", "/")
    .replace(/^\.\/+/u, "")
    .replace(/\/+/gu, "/")
    .replace(/\/$/u, "");
}

function pathWithin(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUnicodeCodeUnits);
}

function normalizeScope(scope: RankingScope | undefined) {
  return {
    restrictNodeIds: scope?.nodeIds !== undefined,
    nodeIds: sortedUnique(scope?.nodeIds ?? []),
    nodeTypes: sortedUnique(scope?.nodeTypes ?? []),
    pathPrefixes: sortedUnique(
      (scope?.pathPrefixes ?? []).map(normalizePath).filter(Boolean),
    ),
    excludePathPrefixes: sortedUnique(
      (scope?.excludePathPrefixes ?? []).map(normalizePath).filter(Boolean),
    ),
  };
}

function inScope(
  node: GraphNode,
  scope: ReturnType<typeof normalizeScope>,
): boolean {
  if (scope.restrictNodeIds && !scope.nodeIds.includes(node.id)) {
    return false;
  }
  if (scope.nodeTypes.length > 0 && !scope.nodeTypes.includes(node.type)) {
    return false;
  }
  const nodePath = node.filePath === undefined
    ? undefined
    : normalizePath(node.filePath);
  if (
    scope.pathPrefixes.length > 0 &&
    (nodePath === undefined ||
      !scope.pathPrefixes.some((prefix) => pathWithin(nodePath, prefix)))
  ) {
    return false;
  }
  if (
    nodePath !== undefined &&
    scope.excludePathPrefixes.some((prefix) => pathWithin(nodePath, prefix))
  ) {
    return false;
  }
  return true;
}

export function validateRankingGraph(graph: KnowledgeGraph): ValidatedGraphView {
  const diagnostics: RankingDiagnostic[] = [];
  const graphSchemaResult = KnowledgeGraphSchema.safeParse(graph);
  if (!graphSchemaResult.success) {
    diagnostics.push({
      code: "invalid_graph_schema",
      source: "graph",
      message:
        "The Knowledge Graph failed the Core KnowledgeGraphSchema and was downgraded to an unknown boundary",
    });
  }

  const runtimeGraph = graph as unknown as {
    version?: unknown;
    kind?: unknown;
    project?: unknown;
    nodes?: unknown;
    edges?: unknown;
  };
  const rawNodes = Array.isArray(runtimeGraph.nodes)
    ? runtimeGraph.nodes
    : [];
  const rawEdges = Array.isArray(runtimeGraph.edges)
    ? runtimeGraph.edges
    : [];
  const nodes: GraphNode[] = [];
  const seenNodeIds = new Set<string>();
  for (const node of rawNodes) {
    const parsedNode = GraphNodeSchema.safeParse(node);
    if (!parsedNode.success || parsedNode.data.id.length === 0) {
      diagnostics.push({
        code: "invalid_graph_node",
        source: "graph",
        message: "A malformed graph node was excluded from candidate ranking",
      });
      continue;
    }
    const validNode = parsedNode.data as GraphNode;
    if (seenNodeIds.has(validNode.id)) {
      diagnostics.push({
        code: "duplicate_graph_node",
        source: "graph",
        message: `Duplicate graph node ID was excluded: ${validNode.id}`,
      });
      continue;
    }
    seenNodeIds.add(validNode.id);
    nodes.push(validNode);
  }

  const edges: GraphEdge[] = [];
  for (const edge of rawEdges) {
    const parsedEdge = GraphEdgeSchema.safeParse(edge);
    if (!parsedEdge.success) {
      diagnostics.push({
        code: "invalid_graph_edge",
        source: "graph",
        message: "A malformed graph edge was excluded from candidate ranking",
      });
      continue;
    }
    const validEdge = parsedEdge.data as GraphEdge;
    if (
      !seenNodeIds.has(validEdge.source) ||
      !seenNodeIds.has(validEdge.target)
    ) {
      diagnostics.push({
        code: "dangling_graph_edge",
        source: "graph",
        message:
          `Dangling graph edge was excluded: ${validEdge.source} -> ${validEdge.target}`,
      });
      continue;
    }
    edges.push(validEdge);
  }

  nodes.sort((left, right) => compareUnicodeCodeUnits(left.id, right.id));
  edges.sort((left, right) =>
    compareUnicodeCodeUnits(
      `${left.source}\0${left.target}\0${left.type}\0${left.direction}`,
      `${right.source}\0${right.target}\0${right.type}\0${right.direction}`,
    ),
  );
  diagnostics.sort((left, right) =>
    compareUnicodeCodeUnits(
      `${left.code}\0${left.message}`,
      `${right.code}\0${right.message}`,
    ),
  );
  const rawProject =
    typeof runtimeGraph.project === "object" &&
      runtimeGraph.project !== null
      ? runtimeGraph.project as Record<string, unknown>
      : {};
  const stringArray = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  const safeGraph: KnowledgeGraph = {
    version:
      typeof runtimeGraph.version === "string"
        ? runtimeGraph.version
        : "invalid",
    ...(runtimeGraph.kind === "codebase" || runtimeGraph.kind === "knowledge"
      ? { kind: runtimeGraph.kind }
      : {}),
    project: {
      name: typeof rawProject.name === "string" ? rawProject.name : "",
      languages: stringArray(rawProject.languages),
      frameworks: stringArray(rawProject.frameworks),
      description:
        typeof rawProject.description === "string"
          ? rawProject.description
          : "",
      analyzedAt:
        typeof rawProject.analyzedAt === "string"
          ? rawProject.analyzedAt
          : "",
      gitCommitHash:
        typeof rawProject.gitCommitHash === "string"
          ? rawProject.gitCommitHash
          : "",
    },
    nodes,
    edges,
    layers: [],
    tour: [],
  };

  return {
    graph: safeGraph,
    nodes,
    edges,
    valid: diagnostics.length === 0,
    diagnostics,
  };
}

function pulseArtifact(
  pulse: RepoPulseLike | undefined,
  family: string,
): ArtifactFreshnessLike | "unknown" {
  return pulse?.artifactFreshness[family] ?? "unknown";
}

function assessSources(
  graph: KnowledgeGraph,
  view: ValidatedGraphView,
  pulse: RepoPulseLike | undefined,
  snapshot: RepositorySnapshotLike | undefined,
  wiki: WikiIndexLike | undefined,
): SourceAssessment {
  const diagnostics = [...view.diagnostics];
  const graphFreshness = pulseArtifact(pulse, "graph");
  const pulseAllowsGraph =
    pulse !== undefined &&
    !["not_ready", "unknown", "rebuilding", "error"].includes(pulse.status);
  let graphFresh = graphFreshness === "fresh" && pulseAllowsGraph && view.valid;

  if (pulse === undefined) {
    diagnostics.push({
      code: "repo_pulse_missing",
      source: "repo_pulse",
      message:
        "Repo Pulse was not supplied; Graph-based candidates are an explicit unknown boundary",
    });
  } else if (graphFreshness !== "fresh") {
    diagnostics.push({
      code: "graph_not_fresh",
      source: "repo_pulse",
      message: `Graph artifact is ${graphFreshness}; it cannot support a fresh ranking conclusion`,
    });
  } else if (!pulseAllowsGraph) {
    diagnostics.push({
      code: "repo_pulse_not_usable",
      source: "repo_pulse",
      message: `Repo Pulse status ${pulse.status} cannot support a fresh ranking conclusion`,
    });
  }

  let snapshotFreshness: SourceAssessment["snapshotFreshness"] =
    "not_supplied";
  let snapshotUsable = false;
  if (snapshot !== undefined) {
    const snapshotAligned =
      pulse?.evaluatedSnapshotId !== undefined &&
      pulse.evaluatedSnapshotId === snapshot.snapshotId;
    const commitAligned =
      snapshot.headCommit === undefined ||
      graph.project.gitCommitHash.length === 0 ||
      graph.project.gitCommitHash === snapshot.headCommit;
    if (!snapshotAligned) {
      graphFresh = false;
      diagnostics.push({
        code: "snapshot_pulse_mismatch",
        source: "repository_snapshot",
        message:
          "Repository Snapshot does not match the Snapshot evaluated by Repo Pulse; Graph conclusions were downgraded",
      });
    }
    if (!commitAligned) {
      graphFresh = false;
      diagnostics.push({
        code: "graph_snapshot_commit_mismatch",
        source: "repository_snapshot",
        message:
          "Knowledge Graph commit does not match the Repository Snapshot head commit; Graph conclusions were downgraded",
      });
    }
    if (snapshot.captureStatus === "error") {
      snapshotFreshness = "error";
      graphFresh = false;
    } else if (snapshot.captureStatus === "partial") {
      snapshotFreshness = "partial";
    } else {
      const diffFresh = pulseArtifact(pulse, "diff") === "fresh";
      snapshotUsable = snapshotAligned && commitAligned && diffFresh;
      snapshotFreshness = snapshotUsable ? "fresh" : "stale";
    }
    if (!snapshotUsable) {
      diagnostics.push({
        code: "repository_snapshot_not_fresh",
        source: "repository_snapshot",
        message:
          `Repository Snapshot is ${snapshotFreshness}; recent-change signals were ignored`,
      });
    }
  }

  let wikiFreshness: SourceAssessment["wikiFreshness"] = "not_supplied";
  let wikiUsable = false;
  if (wiki !== undefined) {
    if (wiki.valid === false) {
      wikiFreshness = "invalid";
    } else {
      const pulseWiki = pulseArtifact(pulse, "wiki");
      const localWiki = wiki.freshness ?? pulseWiki;
      wikiFreshness = localWiki;
      wikiUsable = localWiki === "fresh" && pulseWiki === "fresh";
    }
    if (!wikiUsable) {
      diagnostics.push({
        code: wikiFreshness === "invalid" ? "wiki_invalid" : "wiki_not_fresh",
        source: "wiki",
        message: `Wiki source is ${wikiFreshness}; Wiki signals were ignored`,
      });
    }
  }

  diagnostics.sort((left, right) =>
    compareUnicodeCodeUnits(
      `${left.code}\0${left.message}`,
      `${right.code}\0${right.message}`,
    ),
  );
  return {
    graphFreshness,
    graphFresh,
    wikiFreshness,
    wikiUsable,
    snapshotFreshness,
    snapshotUsable,
    diagnostics,
  };
}

function fieldMatch(
  queryTokens: readonly string[],
  queryPhrase: string,
  node: GraphNode,
): number {
  if (queryTokens.length === 0) return 0;
  const name = normalizeText(node.name);
  const tags = normalizeText(node.tags.join(" "));
  const path = normalizeText(node.filePath ?? "");
  const summary = normalizeText(node.summary);
  const notes = normalizeText(node.languageNotes ?? "");
  const nameTokens = new Set(tokens(node.name));
  const tagTokens = new Set(tokens(node.tags.join(" ")));
  const pathTokens = new Set(tokens(node.filePath ?? ""));
  const summaryTokens = new Set(tokens(node.summary));
  const noteTokens = new Set(tokens(node.languageNotes ?? ""));

  let total = 0;
  for (const token of queryTokens) {
    let best = 0;
    if (nameTokens.has(token)) best = 1;
    else if (name.includes(token)) best = 0.9;
    if (tagTokens.has(token)) best = Math.max(best, 0.85);
    else if (tags.includes(token)) best = Math.max(best, 0.75);
    if (pathTokens.has(token)) best = Math.max(best, 0.76);
    else if (path.includes(token)) best = Math.max(best, 0.68);
    if (summaryTokens.has(token)) best = Math.max(best, 0.64);
    else if (summary.includes(token)) best = Math.max(best, 0.54);
    if (noteTokens.has(token)) best = Math.max(best, 0.5);
    else if (notes.includes(token)) best = Math.max(best, 0.4);
    total += best;
  }
  const coverage = total / queryTokens.length;
  const phraseBoost =
    queryPhrase.length > 1 &&
    [name, tags, path, summary, notes].some((field) =>
      field.includes(queryPhrase)
    )
      ? 0.12
      : 0;
  return Math.min(1, coverage + phraseBoost);
}

function exactSymbolScore(queryPhrase: string, node: GraphNode): number {
  if (normalizeText(node.name) === queryPhrase) return 48;
  const path = normalizePath(node.filePath ?? "");
  const basename = path.split("/").at(-1) ?? "";
  const basenameWithoutExtension = basename.replace(/\.[^.]+$/u, "");
  if (
    normalizeText(basename) === queryPhrase ||
    normalizeText(basenameWithoutExtension) === queryPhrase
  ) {
    return 42;
  }
  return 0;
}

function textMatchQuality(
  queryTokens: readonly string[],
  queryPhrase: string,
  fields: readonly string[],
  sharedContent?: { hasToken(token: string): boolean; includes(query: string): boolean },
): number {
  if (queryTokens.length === 0) return 0;
  const normalizedFields = fields.map(normalizeText);
  const allTokens = new Set(normalizedFields.flatMap(tokens));
  let matches = 0;
  for (const token of queryTokens) {
    if (allTokens.has(token) || sharedContent?.hasToken(token)) {
      matches += 1;
    } else if (normalizedFields.some((field) => field.includes(token)) || sharedContent?.includes(token)) {
      matches += 0.7;
    }
  }
  const phrase = (normalizedFields.some((field) => field.includes(queryPhrase)) || sharedContent?.includes(queryPhrase))
    ? 0.15
    : 0;
  return Math.min(1, matches / queryTokens.length + phrase);
}

function buildWikiMatches(
  wiki: WikiIndexLike | undefined,
  usable: boolean,
  nodes: readonly GraphNode[],
  queryTokens: readonly string[],
  queryPhrase: string,
): Map<string, WikiMatch> {
  const matches = new Map<string, WikiMatch>();
  if (!usable || wiki === undefined) return matches;
  const contentMatcher = createWikiSearchContentMatcher(wiki.contentLines, {
    normalizeLine: normalizeText, separator: " ", skipEmptyLines: true,
  });
  const tokenMatcher = createWikiSearchContentMatcher(wiki.contentLines, {
    normalizeLine: (line) => { const value = normalizeText(line); return value ? ` ${value} ` : ""; },
    separator: " ", skipEmptyLines: true,
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const nodesByPath = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.filePath === undefined) continue;
    const path = normalizePath(node.filePath);
    const existing = nodesByPath.get(path) ?? [];
    existing.push(node.id);
    nodesByPath.set(path, existing);
  }

  const records = [...wiki.records].sort((left, right) =>
    compareUnicodeCodeUnits(left.id, right.id),
  );
  for (const record of records) {
    const quality = textMatchQuality(queryTokens, queryPhrase, [
      record.title,
      record.summary ?? "",
      record.content ?? "",
      ...(record.terms ?? []),
      ...(record.businessTerms ?? []),
    ], record.contentLineIds === undefined ? undefined : {
      hasToken: (token) => tokenMatcher.includes(record, ` ${token} `),
      includes: (query) => contentMatcher.includes(record, query),
    });
    if (quality <= 0) continue;
    const targets = new Set<string>();
    if (record.nodeId !== undefined && nodeIds.has(record.nodeId)) {
      targets.add(record.nodeId);
    }
    if (record.filePath !== undefined) {
      for (const nodeId of nodesByPath.get(normalizePath(record.filePath)) ?? []) {
        targets.add(nodeId);
      }
    }
    for (const nodeId of [...targets].sort(compareUnicodeCodeUnits)) {
      const previous = matches.get(nodeId) ?? {
        score: 0,
        recordIds: [],
        evidenceIds: [],
      };
      previous.score = Math.min(12, previous.score + quality * 10);
      previous.recordIds.push(record.id);
      previous.evidenceIds.push(...(record.evidenceIds ?? []));
      previous.recordIds = sortedUnique(previous.recordIds);
      previous.evidenceIds = sortedUnique(previous.evidenceIds);
      matches.set(nodeId, previous);
    }
  }
  return matches;
}

function changedPathScore(
  node: GraphNode,
  snapshot: RepositorySnapshotLike | undefined,
  usable: boolean,
): { score: number; paths: string[] } {
  if (!usable || snapshot === undefined || node.filePath === undefined) {
    return { score: 0, paths: [] };
  }
  const nodePath = normalizePath(node.filePath);
  let score = 0;
  const paths: string[] = [];
  for (const change of snapshot.changes) {
    const current = normalizePath(change.path);
    const previous =
      change.oldPath === undefined ? undefined : normalizePath(change.oldPath);
    if (nodePath === current) {
      score = Math.max(score, 10);
      paths.push(current);
    } else if (pathWithin(nodePath, current) || pathWithin(current, nodePath)) {
      score = Math.max(score, 6);
      paths.push(current);
    } else if (
      previous !== undefined &&
      (nodePath === previous ||
        pathWithin(nodePath, previous) ||
        pathWithin(previous, nodePath))
    ) {
      score = Math.max(score, 5);
      paths.push(previous);
    }
  }
  return { score, paths: sortedUnique(paths) };
}

function addSignal(
  candidate: MutableCandidate,
  kind: CandidateSignalKind,
  score: number,
  reason: string,
  evidenceIds: readonly string[] = [],
): void {
  if (score <= 0) return;
  const normalizedScore = roundScore(score);
  candidate.signals.push({
    kind,
    score: normalizedScore,
    reason,
    evidenceIds: sortedUnique(evidenceIds),
  });
  for (const evidenceId of evidenceIds) {
    candidate.evidenceIds.add(evidenceId);
  }
}

function buildUndirectedAdjacency(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): Map<string, string[]> {
  const adjacency = new Map<string, Set<string>>();
  for (const node of nodes) adjacency.set(node.id, new Set());
  for (const edge of edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }
  return new Map(
    [...adjacency].map(([nodeId, neighbors]) => [
      nodeId,
      [...neighbors].sort(compareUnicodeCodeUnits),
    ]),
  );
}

function proximityDistances(
  adjacency: ReadonlyMap<string, readonly string[]>,
  anchors: readonly string[],
  maxDepth: number,
): Map<string, number> {
  const distances = new Map<string, number>();
  const queue: Array<{ nodeId: string; depth: number }> = [];
  for (const nodeId of sortedUnique(anchors)) {
    distances.set(nodeId, 0);
    queue.push({ nodeId, depth: 0 });
  }
  for (let offset = 0; offset < queue.length; offset += 1) {
    const current = queue[offset];
    if (current === undefined || current.depth >= maxDepth) continue;
    for (const neighbor of adjacency.get(current.nodeId) ?? []) {
      if (distances.has(neighbor)) continue;
      const depth = current.depth + 1;
      distances.set(neighbor, depth);
      queue.push({ nodeId: neighbor, depth });
    }
  }
  return distances;
}

function isEntryPoint(node: GraphNode): boolean {
  const terms = normalizeText(
    `${node.name} ${node.tags.join(" ")} ${node.domainMeta?.entryPoint ?? ""}`,
  );
  return (
    node.type === "endpoint" ||
    node.domainMeta?.entryPoint !== undefined ||
    /\b(main|entry|endpoint|route|router|handler|controller|cli|command|consumer|listener)\b/u
      .test(terms)
  );
}

function isTestNode(node: GraphNode): boolean {
  const value = normalizeText(`${node.name} ${node.filePath ?? ""} ${node.tags.join(" ")}`);
  return /\b(test|tests|spec|specs|fixture|fixtures)\b/u.test(value);
}

function hasTestIntent(queryTokens: readonly string[]): boolean {
  const testTerms = new Set([
    "test",
    "tests",
    "testing",
    "spec",
    "verify",
    "verification",
    "regression",
    "测试",
    "验证",
    "回归",
  ]);
  return queryTokens.some((token) => testTerms.has(token));
}

function graphIdentity(view: ValidatedGraphView): object {
  return {
    version: view.graph.version,
    ...(view.graph.kind === undefined ? {} : { kind: view.graph.kind }),
    project: view.graph.project,
    valid: view.valid,
    diagnostics: view.diagnostics.map((diagnostic) => [
      diagnostic.code,
      diagnostic.message,
    ]),
    // Candidate pages return the complete validated node payload. Keep that
    // exact payload, plus complete edges, in the cursor identity so no field
    // can change while an older cursor remains valid.
    nodes: view.nodes,
    edges: view.edges,
  };
}

function rankingQueryDigest(
  queryPhrase: string,
  view: ValidatedGraphView,
  scope: ReturnType<typeof normalizeScope>,
  pulse: RepoPulseLike | undefined,
  snapshot: RepositorySnapshotLike | undefined,
  wiki: WikiIndexLike | undefined,
  proximityDepth: number,
): string {
  const wikiIdentity =
    wiki === undefined
      ? null
      : [...wiki.records]
          .sort((left, right) =>
            compareUnicodeCodeUnits(left.id, right.id)
          )
          .map((record: WikiRecordLike) => [
            record.id,
            record.nodeId ?? "",
            record.filePath ?? "",
            record.title,
            record.summary ?? "",
            record.content ?? "",
            ...(record.contentLineIds === undefined ? [] : [record.contentLineIds]),
            [...(record.terms ?? [])].sort(compareUnicodeCodeUnits),
            [...(record.businessTerms ?? [])].sort(compareUnicodeCodeUnits),
            [...(record.evidenceIds ?? [])].sort(compareUnicodeCodeUnits),
          ]);
  return hash(
    canonicalizeJson({
      query: queryPhrase,
      ...(wiki?.contentLines === undefined ? {} : { wikiContentDigest: hash(canonicalizeJson(wiki.contentLines)) }),
      scope,
      proximityDepth,
      graph: graphIdentity(view),
      pulse: pulse === undefined
        ? null
        : {
            snapshotId: pulse.evaluatedSnapshotId ?? "",
            status: pulse.status,
            freshness: Object.entries(pulse.artifactFreshness).sort(
              ([left], [right]) => compareUnicodeCodeUnits(left, right),
            ),
          },
      snapshot: snapshot === undefined
        ? null
        : {
            snapshotId: snapshot.snapshotId,
            headCommit: snapshot.headCommit ?? "",
            captureStatus: snapshot.captureStatus,
            changes: [...snapshot.changes]
              .map((change) => [
                normalizePath(change.path),
                normalizePath(change.oldPath ?? ""),
                change.source ?? "",
                change.kind ?? "",
              ])
              .sort((left, right) =>
                compareUnicodeCodeUnits(left.join("\0"), right.join("\0"))
              ),
          },
      wiki:
        wiki === undefined
          ? null
          : {
              valid: wiki.valid ?? true,
              freshness: wiki.freshness ?? "unknown",
              generatedAt: wiki.generatedAt ?? "",
              records: wikiIdentity,
            },
    }),
  );
}

function encodeCursor(queryDigest: string, offset: number): string {
  const payload: CursorPayload = { version: 1, queryDigest, offset };
  return `${CURSOR_PREFIX}${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
}

function decodeCursor(cursor: string, queryDigest: string): number {
  if (!cursor.startsWith(CURSOR_PREFIX)) {
    throw new CandidateCursorError(
      "invalid_cursor",
      "Candidate cursor has an unsupported format",
    );
  }
  try {
    const text = Buffer.from(
      cursor.slice(CURSOR_PREFIX.length),
      "base64url",
    ).toString("utf8");
    const payload = JSON.parse(text) as Partial<CursorPayload>;
    if (
      payload.version !== 1 ||
      typeof payload.queryDigest !== "string" ||
      !Number.isSafeInteger(payload.offset) ||
      (payload.offset ?? -1) < 0
    ) {
      throw new Error("invalid payload");
    }
    if (payload.queryDigest !== queryDigest) {
      throw new CandidateCursorError(
        "cursor_query_mismatch",
        "Candidate cursor belongs to a different query, scope, or artifact revision",
      );
    }
    return payload.offset ?? 0;
  } catch (error) {
    if (error instanceof CandidateCursorError) throw error;
    throw new CandidateCursorError(
      "invalid_cursor",
      "Candidate cursor could not be decoded",
    );
  }
}

function positiveInteger(
  value: number | undefined,
  fallback: number,
  name: string,
  maximum?: number,
): number {
  const resolved = value ?? fallback;
  if (
    !Number.isSafeInteger(resolved) ||
    resolved <= 0 ||
    (maximum !== undefined && resolved > maximum)
  ) {
    const suffix = maximum === undefined ? "" : ` and at most ${maximum}`;
    throw new RangeError(`${name} must be a positive integer${suffix}`);
  }
  return resolved;
}

function estimateCandidateTokens(
  node: GraphNode,
  signals: readonly CandidateSignal[],
): number {
  const text = [
    node.id,
    node.name,
    node.filePath ?? "",
    node.summary,
    node.tags.join(" "),
    ...signals.map((signal) => `${signal.kind} ${signal.reason}`),
  ].join("\n");
  let asciiCharacters = 0;
  let nonAsciiCharacters = 0;
  for (const character of text) {
    if ((character.codePointAt(0) ?? 0) <= 0x7f) {
      asciiCharacters += 1;
    } else {
      // CJK and other non-ASCII code points often consume one or more tokens;
      // count each as a whole token to keep the budget conservative.
      nonAsciiCharacters += 1;
    }
  }
  return 24 + Math.ceil(asciiCharacters / 4) + nonAsciiCharacters;
}

function rankAllCandidates(
  input: RankCandidatesInput,
  view: ValidatedGraphView,
  source: SourceAssessment,
  queryPhrase: string,
  queryTokens: readonly string[],
  scope: ReturnType<typeof normalizeScope>,
  proximityDepth: number,
): RankedCandidate[] {
  const wikiMatches = buildWikiMatches(
    input.wiki,
    source.wikiUsable,
    view.nodes,
    queryTokens,
    queryPhrase,
  );
  const mutable = new Map<string, MutableCandidate>();

  for (const node of view.nodes) {
    if (!inScope(node, scope)) continue;
    const exact = exactSymbolScore(queryPhrase, node);
    const lexical = roundScore(fieldMatch(queryTokens, queryPhrase, node) * 32);
    const wikiMatch = wikiMatches.get(node.id);
    const changed = changedPathScore(
      node,
      input.repositorySnapshot,
      source.snapshotUsable,
    );
    const candidate: MutableCandidate = {
      node,
      exact,
      lexical,
      wiki: roundScore(wikiMatch?.score ?? 0),
      recent: changed.score,
      directScore: exact + lexical + (wikiMatch?.score ?? 0) + changed.score,
      signals: [],
      evidenceIds: new Set(),
    };
    addSignal(
      candidate,
      "exact_symbol",
      exact,
      exact === 48
        ? `Query exactly matches symbol ${node.name}`
        : `Query exactly matches file ${node.filePath ?? node.name}`,
    );
    addSignal(
      candidate,
      "lexical",
      lexical,
      `Lexical token coverage matches ${node.name}`,
    );
    if (wikiMatch !== undefined) {
      addSignal(
        candidate,
        "wiki",
        wikiMatch.score,
        `Fresh Wiki records support this candidate: ${wikiMatch.recordIds.join(", ")}`,
        wikiMatch.evidenceIds,
      );
    }
    if (changed.score > 0) {
      addSignal(
        candidate,
        "recent_change",
        changed.score,
        `Fresh Repository Snapshot reports recent change: ${changed.paths.join(", ")}`,
      );
    }
    mutable.set(node.id, candidate);
  }

  const anchors = [...mutable.values()]
    .filter(
      (candidate) =>
        candidate.exact > 0 ||
        candidate.lexical >= 10 ||
        candidate.wiki >= 4 ||
        (candidate.recent > 0 && candidate.lexical > 0),
    )
    .sort(
      (left, right) =>
        right.directScore - left.directScore ||
        compareUnicodeCodeUnits(left.node.id, right.node.id),
    )
    .slice(0, 12)
    .map((candidate) => candidate.node.id);
  const anchorSet = new Set(anchors);
  const scopedNodes = [...mutable.values()].map((candidate) => candidate.node);
  const scopedNodeIds = new Set(scopedNodes.map((node) => node.id));
  const scopedEdges = view.edges.filter(
    (edge) =>
      scopedNodeIds.has(edge.source) && scopedNodeIds.has(edge.target),
  );

  const degrees = new Map<string, number>(
    scopedNodes.map((node) => [node.id, 0]),
  );
  for (const edge of scopedEdges) {
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
  }
  const maxDegree = Math.max(0, ...degrees.values());
  const adjacency = buildUndirectedAdjacency(scopedNodes, scopedEdges);
  const distances = source.graphFresh
    ? proximityDistances(adjacency, anchors, proximityDepth)
    : new Map<string, number>();
  const testIntent = hasTestIntent(queryTokens);

  for (const candidate of mutable.values()) {
    if (source.graphFresh) {
      const degree = degrees.get(candidate.node.id) ?? 0;
      const degreeScore =
        degree === 0 || maxDegree === 0
          ? 0
          : (Math.log1p(degree) / Math.log1p(maxDegree)) * 8;
      addSignal(
        candidate,
        "graph_degree",
        degreeScore,
        `Fresh Graph reports degree ${degree}`,
      );
      const distance = distances.get(candidate.node.id);
      if (distance !== undefined) {
        const proximityScore =
          distance === 0 ? 8 : Math.max(2, 8 - distance * 2.5);
        addSignal(
          candidate,
          "graph_proximity",
          proximityScore,
          distance === 0
            ? "Candidate is a direct query anchor in the fresh Graph"
            : `Candidate is ${distance} Graph hop${distance === 1 ? "" : "s"} from a direct query anchor`,
        );
      }
      if (isEntryPoint(candidate.node)) {
        addSignal(
          candidate,
          "entry_point",
          7,
          "Fresh Graph metadata identifies an entry-point candidate",
        );
      }
      if (isTestNode(candidate.node)) {
        const testedAnchor = scopedEdges.some(
          (edge) =>
            edge.type === "tested_by" &&
            ((edge.source === candidate.node.id && anchorSet.has(edge.target)) ||
              (edge.target === candidate.node.id && anchorSet.has(edge.source))),
        );
        const score = testIntent ? 8 : testedAnchor ? 5 : 0;
        addSignal(
          candidate,
          "test",
          score,
          testIntent
            ? "The task intent asks for testing or verification"
            : "Fresh Graph connects this test to a direct query anchor",
        );
      }
    }
  }

  const ranked = [...mutable.values()]
    .filter((candidate) => {
      const hasRelevantSignal =
        candidate.directScore > 0 ||
        candidate.signals.some((signal) => signal.kind === "graph_proximity");
      return hasRelevantSignal;
    })
    .map((candidate) => {
      candidate.signals.sort(
        (left, right) =>
          SIGNAL_ORDER[left.kind] - SIGNAL_ORDER[right.kind] ||
          right.score - left.score ||
          compareUnicodeCodeUnits(left.reason, right.reason),
      );
      const score = roundScore(
        candidate.signals.reduce((sum, signal) => sum + signal.score, 0),
      );
      const estimatedTokens = estimateCandidateTokens(
        candidate.node,
        candidate.signals,
      );
      return {
        rank: 0,
        nodeId: candidate.node.id,
        node: candidate.node,
        score,
        epistemicStatus: source.graphFresh
          ? ("inferred" as const)
          : ("unknown_boundary" as const),
        freshConclusion: source.graphFresh,
        signals: candidate.signals,
        reasons: candidate.signals.map((signal) => signal.reason),
        evidenceIds: sortedUnique([...candidate.evidenceIds]),
        estimatedTokens,
        exact: candidate.exact,
        lexical: candidate.lexical,
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.exact - left.exact ||
        right.lexical - left.lexical ||
        compareUnicodeCodeUnits(
          left.node.filePath ?? "",
          right.node.filePath ?? "",
        ) ||
        compareUnicodeCodeUnits(left.node.name, right.node.name) ||
        compareUnicodeCodeUnits(left.node.id, right.node.id),
    );

  return ranked.map(({ exact: _exact, lexical: _lexical, ...candidate }, index) => ({
    ...candidate,
    rank: index + 1,
  }));
}

/**
 * Ranks code candidates with deterministic, explainable heuristics only.
 * No embedding provider or network service is consulted.
 */
export function rankCandidates(input: RankCandidatesInput): CandidateRankingPage {
  const queryPhrase = normalizeText(input.query);
  const queryTokens = tokens(input.query);
  if (!queryPhrase || queryTokens.length === 0) {
    throw new RangeError("query must contain at least one letter or number");
  }

  const maxCandidates = positiveInteger(
    input.options?.maxCandidates,
    DEFAULT_MAX_CANDIDATES,
    "maxCandidates",
    MAX_MAX_CANDIDATES,
  );
  const tokenBudget = positiveInteger(
    input.options?.tokenBudget,
    DEFAULT_TOKEN_BUDGET,
    "tokenBudget",
  );
  const proximityDepth = positiveInteger(
    input.options?.proximityDepth,
    DEFAULT_PROXIMITY_DEPTH,
    "proximityDepth",
    MAX_PROXIMITY_DEPTH,
  );
  const scope = normalizeScope(input.options?.scope);
  const view = validateRankingGraph(input.graph);
  const source = assessSources(
    view.graph,
    view,
    input.repoPulse,
    input.repositorySnapshot,
    input.wiki,
  );
  const queryDigest = rankingQueryDigest(
    queryPhrase,
    view,
    scope,
    input.repoPulse,
    input.repositorySnapshot,
    input.wiki,
    proximityDepth,
  );
  const allCandidates = rankAllCandidates(
    input,
    view,
    source,
    queryPhrase,
    queryTokens,
    scope,
    proximityDepth,
  );
  const offset =
    input.options?.cursor === undefined
      ? 0
      : decodeCursor(input.options.cursor, queryDigest);
  if (offset > allCandidates.length) {
    throw new CandidateCursorError(
      "invalid_cursor",
      "Candidate cursor offset is outside the current result set",
    );
  }

  const candidates: RankedCandidate[] = [];
  let consumedTokens = 0;
  for (
    let index = offset;
    index < allCandidates.length && candidates.length < maxCandidates;
    index += 1
  ) {
    const candidate = allCandidates[index];
    if (candidate === undefined) break;
    if (consumedTokens + candidate.estimatedTokens > tokenBudget) break;
    candidates.push(candidate);
    consumedTokens += candidate.estimatedTokens;
  }

  const nextOffset = offset + candidates.length;
  const hiddenCount = allCandidates.length - nextOffset;
  const truncated = hiddenCount > 0;
  let reason: "max_candidates" | "token_budget" | undefined;
  if (truncated) {
    reason =
      candidates.length >= maxCandidates ? "max_candidates" : "token_budget";
  }
  const nextCursor =
    truncated && candidates.length > 0
      ? encodeCursor(queryDigest, nextOffset)
      : undefined;

  return {
    queryDigest,
    candidates,
    ...(nextCursor === undefined ? {} : { nextCursor }),
    consumedTokens,
    totalCandidates: allCandidates.length,
    freshness: {
      graph: source.graphFreshness,
      wiki: source.wikiFreshness,
      repositorySnapshot: source.snapshotFreshness,
      freshConclusionEligible: source.graphFresh,
    },
    truncation: {
      truncated,
      ...(reason === undefined ? {} : { reason }),
      hiddenCount,
    },
    diagnostics: source.diagnostics,
  };
}
