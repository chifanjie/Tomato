import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import {
  ArtifactManifestV1Schema,
  validateArtifactDependencyDagV1,
  type ArtifactDescriptorV1,
  type ArtifactFreshnessV1,
  type ArtifactManifestV1,
  type RepositorySnapshotV1,
} from "@understand-code/contracts";
import {
  StableFileReadError,
  readStableRepositoryFile,
} from "./safe-file.js";

export const ARTIFACT_FAMILIES_V1 = Object.freeze([
  "graph",
  "wiki",
  "evidence",
  "diff",
  "task",
] as const);

export type ArtifactFamilyV1 = (typeof ARTIFACT_FAMILIES_V1)[number];

export type ArtifactFamilyFreshnessV1 = Readonly<
  Record<ArtifactFamilyV1, ArtifactFreshnessV1>
>;

export interface ArtifactFreshnessNodeInput {
  id: string;
  intrinsicStatus: ArtifactFreshnessV1;
  dependencies?: readonly string[];
  sourceSnapshotId?: string;
  reasons?: readonly string[];
}

export interface ArtifactFreshnessNodeResult {
  id: string;
  intrinsicStatus: ArtifactFreshnessV1;
  status: ArtifactFreshnessV1;
  dependencies: string[];
  sourceSnapshotId?: string;
  reasons: string[];
}

export interface ArtifactFreshnessIssue {
  code:
    | "duplicate_node"
    | "dangling_dependency"
    | "dependency_cycle"
    | "snapshot_mismatch"
    | "dependency_degraded";
  nodeId: string;
  dependencyId?: string;
  message: string;
}

export interface ArtifactFreshnessEvaluation {
  nodes: ArtifactFreshnessNodeResult[];
  issues: ArtifactFreshnessIssue[];
}

export interface ArtifactFreshnessReport {
  artifactFreshness: ArtifactFamilyFreshnessV1;
  reasonsByFamily: Readonly<Record<ArtifactFamilyV1, string[]>>;
  familyRootIds: Readonly<Record<ArtifactFamilyV1, string>>;
  evaluation: ArtifactFreshnessEvaluation;
}

function degradedByDependency(
  current: ArtifactFreshnessV1,
  dependency: ArtifactFreshnessV1,
): ArtifactFreshnessV1 {
  if (current === "error" || current === "missing") return current;
  if (dependency === "error") return "error";
  if (dependency === "stale") return "stale";
  if (dependency === "missing" || dependency === "partial") {
    return current === "stale" ? "stale" : "partial";
  }
  return current;
}

/**
 * Evaluates a deterministic artifact dependency DAG. A node can never remain
 * fresh when a dependency is missing, partial, stale, erroneous, mismatched,
 * dangling, or cyclic.
 */
export function evaluateArtifactFreshnessDag(
  inputNodes: readonly ArtifactFreshnessNodeInput[],
  options: { currentSnapshotId?: string } = {},
): ArtifactFreshnessEvaluation {
  const issues: ArtifactFreshnessIssue[] = [];
  const byId = new Map<string, ArtifactFreshnessNodeInput>();
  const duplicateIds = new Set<string>();

  for (const node of inputNodes) {
    if (byId.has(node.id)) {
      duplicateIds.add(node.id);
      issues.push({
        code: "duplicate_node",
        nodeId: node.id,
        message: `Duplicate artifact freshness node: ${node.id}`,
      });
      continue;
    }
    byId.set(node.id, node);
  }

  const memo = new Map<string, ArtifactFreshnessNodeResult>();
  const visiting: string[] = [];
  const cycleMembers = new Set<string>();

  const visit = (id: string): ArtifactFreshnessNodeResult => {
    const remembered = memo.get(id);
    if (remembered !== undefined) return remembered;
    const cycleIndex = visiting.indexOf(id);
    if (cycleIndex >= 0) {
      const cycle = [...visiting.slice(cycleIndex), id];
      for (const member of cycle) cycleMembers.add(member);
      issues.push({
        code: "dependency_cycle",
        nodeId: id,
        message: `Artifact freshness dependency cycle: ${cycle.join(" -> ")}`,
      });
      return {
        id,
        intrinsicStatus: "error",
        status: "error",
        dependencies: [],
        reasons: ["Artifact freshness dependency cycle"],
      };
    }

    const input = byId.get(id);
    if (input === undefined) {
      return {
        id,
        intrinsicStatus: "missing",
        status: "missing",
        dependencies: [],
        reasons: ["Artifact freshness node is missing"],
      };
    }
    visiting.push(id);
    let status = input.intrinsicStatus;
    const reasons = [...(input.reasons ?? [])];
    const dependencies = [...(input.dependencies ?? [])].sort();
    if (duplicateIds.has(id)) {
      status = "error";
      reasons.push("Artifact freshness node ID is duplicated");
    }

    if (
      options.currentSnapshotId !== undefined &&
      input.sourceSnapshotId !== undefined &&
      input.sourceSnapshotId !== options.currentSnapshotId &&
      status !== "missing" &&
      status !== "error"
    ) {
      status = "stale";
      reasons.push("Artifact source snapshot does not match the current snapshot");
      issues.push({
        code: "snapshot_mismatch",
        nodeId: id,
        message: `${id} targets a different repository snapshot`,
      });
    }

    for (const dependencyId of dependencies) {
      if (!byId.has(dependencyId)) {
        status = degradedByDependency(status, "missing");
        reasons.push(`Required artifact ${dependencyId} is missing`);
        issues.push({
          code: "dangling_dependency",
          nodeId: id,
          dependencyId,
          message: `${id} depends on missing ${dependencyId}`,
        });
        continue;
      }
      const dependency = visit(dependencyId);
      const nextStatus = degradedByDependency(status, dependency.status);
      if (nextStatus !== status) {
        reasons.push(
          `Dependency ${dependencyId} is ${dependency.status}`,
        );
        issues.push({
          code: "dependency_degraded",
          nodeId: id,
          dependencyId,
          message: `${id} is degraded by ${dependencyId}`,
        });
      }
      status = nextStatus;
    }
    visiting.pop();
    if (cycleMembers.has(id)) {
      status = "error";
      reasons.push("Artifact participates in a dependency cycle");
    }
    const result: ArtifactFreshnessNodeResult = {
      id,
      intrinsicStatus: input.intrinsicStatus,
      status,
      dependencies,
      ...(input.sourceSnapshotId === undefined
        ? {}
        : { sourceSnapshotId: input.sourceSnapshotId }),
      reasons: [...new Set(reasons)].sort(),
    };
    memo.set(id, result);
    return result;
  };

  for (const id of [...byId.keys()].sort()) visit(id);
  for (const duplicateId of duplicateIds) {
    const result = memo.get(duplicateId);
    if (result !== undefined) {
      memo.set(duplicateId, {
        ...result,
        status: "error",
        reasons: [
          ...new Set([
            ...result.reasons,
            "Artifact freshness node ID is duplicated",
          ]),
        ].sort(),
      });
    }
  }
  for (const cycleMember of cycleMembers) {
    const result = memo.get(cycleMember);
    if (result !== undefined && result.status !== "error") {
      memo.set(cycleMember, {
        ...result,
        status: "error",
        reasons: [
          ...new Set([
            ...result.reasons,
            "Artifact participates in a dependency cycle",
          ]),
        ].sort(),
      });
    }
  }

  return {
    nodes: [...memo.values()].sort((left, right) =>
      left.id.localeCompare(right.id, "en"),
    ),
    issues,
  };
}

interface JsonArtifactRead {
  status: "present" | "missing" | "error";
  value?: Record<string, unknown>;
  digest?: string;
  reason?: string;
}

export interface LegacyArtifactInspectionOptions {
  maxArtifactBytes?: number;
  /** Untrusted persisted input; validation is fail-closed. */
  manifest?: unknown;
  /**
   * Optional Core-owned deep verifiers. Built-in V1/V2 structural verifiers
   * always run first; a provided verifier can only narrow acceptance.
   */
  legacyVerifiers?: Partial<
    Record<LegacyArtifactKindV1, LegacyArtifactVerifier>
  >;
}

export type LegacyArtifactKindV1 =
  | "graph"
  | "meta"
  | "fingerprints"
  | "wiki_index"
  | "wiki_search"
  | "wiki_document_traces"
  | "wiki_generation_report"
  | "diff_overlay";

export interface LegacyArtifactVerifierResult {
  valid: boolean;
  reasons?: readonly string[];
}

export type LegacyArtifactVerifier = (
  value: unknown,
) => boolean | LegacyArtifactVerifierResult;

const DEFAULT_MAX_ARTIFACT_BYTES = 128 * 1024 * 1024;

async function readJsonArtifact(
  canonicalRoot: string,
  repositoryPath: string,
  maxArtifactBytes: number,
): Promise<JsonArtifactRead> {
  try {
    const bytes = await readStableRepositoryFile(
      canonicalRoot,
      repositoryPath,
      maxArtifactBytes,
    );
    const parsed = JSON.parse(bytes.toString("utf8")) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { status: "error", reason: "Artifact root must be a JSON object" };
    }
    return {
      status: "present",
      value: parsed as Record<string, unknown>,
      digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { status: "missing" };
    }
    if (error instanceof StableFileReadError) {
      const reasonByCode: Record<
        StableFileReadError["code"],
        string
      > = {
        changed_during_read: "Artifact changed while it was being read",
        not_regular_file: "Artifact path is not a regular file",
        outside_repository:
          "Artifact resolves outside the canonical repository root",
        symlink_path: "Artifact path must not be a symbolic link",
        too_large: `Artifact exceeds the ${maxArtifactBytes}-byte inspection limit`,
      };
      return { status: "error", reason: reasonByCode[error.code] };
    }
    return {
      status: "error",
      reason: "Artifact could not be read or parsed as JSON",
    };
  }
}

function stringField(
  value: Record<string, unknown> | undefined,
  field: string,
): string | undefined {
  const candidate = value?.[field];
  return typeof candidate === "string" ? candidate : undefined;
}

function objectField(
  value: Record<string, unknown> | undefined,
  field: string,
): Record<string, unknown> | undefined {
  const candidate = value?.[field];
  return typeof candidate === "object" &&
    candidate !== null &&
    !Array.isArray(candidate)
    ? (candidate as Record<string, unknown>)
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasString(
  value: Record<string, unknown>,
  field: string,
): boolean {
  return typeof value[field] === "string";
}

function hasArray(value: Record<string, unknown>, field: string): boolean {
  return Array.isArray(value[field]);
}

function validGraphShape(value: Record<string, unknown>): boolean {
  const project = objectField(value, "project");
  if (
    value.version !== "1.0.0" ||
    project === undefined ||
    !hasString(project, "name") ||
    !hasString(project, "description") ||
    !hasString(project, "analyzedAt") ||
    !hasString(project, "gitCommitHash") ||
    !hasArray(project, "languages") ||
    !hasArray(project, "frameworks") ||
    !hasArray(value, "nodes") ||
    !hasArray(value, "edges") ||
    !hasArray(value, "layers") ||
    !hasArray(value, "tour")
  ) {
    return false;
  }
  return (
    (value.nodes as unknown[]).every(
      (node) =>
        isRecord(node) &&
        hasString(node, "id") &&
        hasString(node, "type") &&
        hasString(node, "name") &&
        hasString(node, "summary") &&
        hasString(node, "complexity") &&
        hasArray(node, "tags"),
    ) &&
    (value.edges as unknown[]).every(
      (edge) =>
        isRecord(edge) &&
        hasString(edge, "source") &&
        hasString(edge, "target") &&
        hasString(edge, "type") &&
        hasString(edge, "direction") &&
        typeof edge.weight === "number",
    )
  );
}

function validLegacyShape(
  kind: LegacyArtifactKindV1,
  value: Record<string, unknown>,
): boolean {
  switch (kind) {
    case "graph":
      return validGraphShape(value);
    case "meta":
      return (
        hasString(value, "lastAnalyzedAt") &&
        hasString(value, "gitCommitHash") &&
        value.version === "1.0.0" &&
        typeof value.analyzedFiles === "number" &&
        Number.isInteger(value.analyzedFiles) &&
        value.analyzedFiles >= 0
      );
    case "fingerprints":
      return (
        value.version === "1.0.0" &&
        hasString(value, "gitCommitHash") &&
        hasString(value, "generatedAt") &&
        isRecord(value.files)
      );
    case "wiki_index": {
      const source = objectField(value, "source");
      if (
        (value.version !== 1 && value.version !== 2) ||
        !hasString(value, "generatedAt") ||
        !hasString(value, "projectName") ||
        source === undefined ||
        !hasArray(value, "pages") ||
        !hasArray(value, "evidence")
      ) {
        return false;
      }
      return value.version === 1 || hasArray(value, "nodeDocumentation");
    }
    case "wiki_search":
      return (
        value.version === 2 &&
        hasString(value, "generatedAt") &&
        hasArray(value, "records")
      );
    case "wiki_document_traces":
      return (
        value.version === 2 &&
        hasString(value, "generatedAt") &&
        hasArray(value, "traces")
      );
    case "wiki_generation_report":
      return (
        value.version === 2 &&
        hasString(value, "generatedAt") &&
        hasString(value, "generationMode") &&
        isRecord(value.source) &&
        hasArray(value, "warnings") &&
        hasArray(value, "errors")
      );
    case "diff_overlay":
      return (
        value.version === "1.0.0" &&
        (hasString(value, "baseCommit") || hasString(value, "baseBranch")) &&
        (hasArray(value, "files") || hasArray(value, "changedFiles"))
      );
  }
}

function validateLegacyRead(
  read: JsonArtifactRead,
  kind: LegacyArtifactKindV1,
  verifier: LegacyArtifactVerifier | undefined,
): JsonArtifactRead {
  if (read.status !== "present" || read.value === undefined) return read;
  if (!validLegacyShape(kind, read.value)) {
    return {
      status: "error",
      reason: `Legacy ${kind} artifact failed its built-in V1/V2 structural verifier`,
    };
  }
  if (verifier === undefined) return read;
  try {
    const result = verifier(read.value);
    const valid = typeof result === "boolean" ? result : result.valid;
    if (valid) return read;
    const reasons =
      typeof result === "boolean" ? [] : [...(result.reasons ?? [])];
    return {
      status: "error",
      reason:
        reasons.length === 0
          ? `Legacy ${kind} artifact failed the host typed verifier`
          : `Legacy ${kind} artifact failed the host typed verifier: ${reasons.join("; ")}`,
    };
  } catch {
    return {
      status: "error",
      reason: `Legacy ${kind} host typed verifier threw an error`,
    };
  }
}

function readToNode(
  id: string,
  read: JsonArtifactRead,
  options: {
    commit?: string | undefined;
    expectedCommit?: string | undefined;
    reasons?: string[];
  } = {},
): ArtifactFreshnessNodeInput {
  if (read.status === "missing") {
    return {
      id,
      intrinsicStatus: "missing",
      reasons: ["Artifact file is missing"],
    };
  }
  if (read.status === "error") {
    return {
      id,
      intrinsicStatus: "error",
      reasons: [read.reason ?? "Artifact could not be inspected"],
    };
  }
  const reasons = [...(options.reasons ?? [])];
  let intrinsicStatus: ArtifactFreshnessV1 = "fresh";
  if (
    options.expectedCommit !== undefined &&
    options.commit !== undefined &&
    options.commit !== options.expectedCommit
  ) {
    intrinsicStatus = "stale";
    reasons.push("Artifact commit does not match current HEAD");
  } else if (
    options.expectedCommit !== undefined &&
    options.commit === undefined
  ) {
    intrinsicStatus = "partial";
    reasons.push("Artifact does not declare its source commit");
  }
  return { id, intrinsicStatus, reasons };
}

function descriptorFamily(
  descriptor: ArtifactDescriptorV1,
): ArtifactFamilyV1 | undefined {
  switch (descriptor.artifactType) {
    case "graph":
    case "graph_meta":
    case "fingerprint":
      return "graph";
    case "wiki_index":
    case "wiki_search_index":
    case "wiki_document_traces":
    case "wiki_generation_report":
      return "wiki";
    case "claim_ledger":
    case "evidence_ledger":
      return "evidence";
    case "diff_overlay":
    case "impact":
    case "change_check":
      return "diff";
    case "task_manifest":
    case "task_brief":
    case "verification":
    case "task_event_log":
      return "task";
    default:
      return undefined;
  }
}

function descriptorStatus(
  descriptor: ArtifactDescriptorV1,
): ArtifactFreshnessV1 {
  if (descriptor.state === "corrupt" || descriptor.freshness === "invalid") {
    return "error";
  }
  if (descriptor.state !== "current") return "stale";
  return descriptor.freshness;
}

function manifestNodes(
  manifest: ArtifactManifestV1,
): {
  nodes: ArtifactFreshnessNodeInput[];
  descriptorIdsByFamily: Record<ArtifactFamilyV1, string[]>;
  currentDescriptorIdsByFamily: Record<ArtifactFamilyV1, string[]>;
} {
  const parsed = ArtifactManifestV1Schema.parse(manifest);
  const nodes: ArtifactFreshnessNodeInput[] = [];
  const descriptorIdsByFamily: Record<ArtifactFamilyV1, string[]> = {
    graph: [],
    wiki: [],
    evidence: [],
    diff: [],
    task: [],
  };
  const currentDescriptorIdsByFamily: Record<ArtifactFamilyV1, string[]> = {
    graph: [],
    wiki: [],
    evidence: [],
    diff: [],
    task: [],
  };

  for (const descriptor of parsed.artifacts) {
    const family = descriptorFamily(descriptor);
    const id = `manifest:${descriptor.artifactId}`;
    if (family !== undefined) {
      descriptorIdsByFamily[family].push(id);
      if (descriptor.state === "current") {
        currentDescriptorIdsByFamily[family].push(id);
      }
    }
    nodes.push({
      id,
      intrinsicStatus: descriptorStatus(descriptor),
      dependencies: descriptor.dependencies
        .map((dependency) => `manifest:${dependency.artifactId}`),
      ...(descriptor.sourceSnapshotId === undefined
        ? {}
        : { sourceSnapshotId: descriptor.sourceSnapshotId }),
      reasons:
        descriptor.state === "current"
          ? []
          : [`Artifact descriptor state is ${descriptor.state}`],
    });
  }
  return { nodes, descriptorIdsByFamily, currentDescriptorIdsByFamily };
}

function selectedWikiSupportPath(
  preferred: JsonArtifactRead,
  fallback: JsonArtifactRead,
): JsonArtifactRead {
  return preferred.status === "missing" ? fallback : preferred;
}

/**
 * Inspects the real legacy Graph/Meta/Fingerprint, Wiki V1/V2 support set and
 * Diff Overlay, then overlays any current manifest-managed artifacts.
 */
export async function inspectArtifactFreshness(
  canonicalRoot: string,
  snapshot: RepositorySnapshotV1,
  options: LegacyArtifactInspectionOptions = {},
): Promise<ArtifactFreshnessReport> {
  const realRoot = await fs.realpath(canonicalRoot);
  const maxArtifactBytes =
    options.maxArtifactBytes ?? DEFAULT_MAX_ARTIFACT_BYTES;
  const [
    graphRead,
    metaRead,
    fingerprintsRead,
    wikiIndexRead,
    wikiSearchRead,
    wikiTracesRootRead,
    wikiTracesTraceRead,
    wikiReportRootRead,
    wikiReportTraceRead,
    diffOverlayRead,
  ] = await Promise.all([
    readJsonArtifact(realRoot, ".understand-code/knowledge-graph.json", maxArtifactBytes),
    readJsonArtifact(realRoot, ".understand-code/meta.json", maxArtifactBytes),
    readJsonArtifact(realRoot, ".understand-code/fingerprints.json", maxArtifactBytes),
    readJsonArtifact(realRoot, ".understand-code/knowledge-base/wiki-index.json", maxArtifactBytes),
    readJsonArtifact(realRoot, ".understand-code/knowledge-base/search-index.json", maxArtifactBytes),
    readJsonArtifact(realRoot, ".understand-code/knowledge-base/document-traces.json", maxArtifactBytes),
    readJsonArtifact(realRoot, ".understand-code/knowledge-base/.trace/document-traces.json", maxArtifactBytes),
    readJsonArtifact(realRoot, ".understand-code/knowledge-base/generation-report.json", maxArtifactBytes),
    readJsonArtifact(realRoot, ".understand-code/knowledge-base/.trace/generation-report.json", maxArtifactBytes),
    readJsonArtifact(realRoot, ".understand-code/diff-overlay.json", maxArtifactBytes),
  ]);
  const verifiers = options.legacyVerifiers ?? {};
  const graph = validateLegacyRead(graphRead, "graph", verifiers.graph);
  const meta = validateLegacyRead(metaRead, "meta", verifiers.meta);
  const fingerprints = validateLegacyRead(
    fingerprintsRead,
    "fingerprints",
    verifiers.fingerprints,
  );
  const wikiIndex = validateLegacyRead(
    wikiIndexRead,
    "wiki_index",
    verifiers.wiki_index,
  );
  const wikiSearch = validateLegacyRead(
    wikiSearchRead,
    "wiki_search",
    verifiers.wiki_search,
  );
  const wikiTracesRoot = validateLegacyRead(
    wikiTracesRootRead,
    "wiki_document_traces",
    verifiers.wiki_document_traces,
  );
  const wikiTracesTrace = validateLegacyRead(
    wikiTracesTraceRead,
    "wiki_document_traces",
    verifiers.wiki_document_traces,
  );
  const wikiReportRoot = validateLegacyRead(
    wikiReportRootRead,
    "wiki_generation_report",
    verifiers.wiki_generation_report,
  );
  const wikiReportTrace = validateLegacyRead(
    wikiReportTraceRead,
    "wiki_generation_report",
    verifiers.wiki_generation_report,
  );
  const diffOverlay = validateLegacyRead(
    diffOverlayRead,
    "diff_overlay",
    verifiers.diff_overlay,
  );

  const expectedCommit = snapshot.headCommit;
  const graphProject = objectField(graph.value, "project");
  const graphCommit = stringField(graphProject, "gitCommitHash");
  const graphNode = readToNode("legacy:graph", graph, {
    commit: graphCommit,
    expectedCommit,
  });
  if (
    graphNode.intrinsicStatus === "fresh" &&
    snapshot.changes.some((change) => change.source !== "committed")
  ) {
    graphNode.intrinsicStatus = "stale";
    graphNode.reasons = [
      ...(graphNode.reasons ?? []),
      "Legacy graph is commit-based while the current worktree has changes",
    ];
  }
  const metaNode = readToNode("legacy:graph-meta", meta, {
    commit: stringField(meta.value, "gitCommitHash"),
    expectedCommit,
  });
  const fingerprintsNode = readToNode(
    "legacy:fingerprints",
    fingerprints,
    {
      commit: stringField(fingerprints.value, "gitCommitHash"),
      expectedCommit,
    },
  );
  const legacyGraphRoot: ArtifactFreshnessNodeInput = {
    id: "family:legacy-graph",
    intrinsicStatus:
      graph.status === "missing"
        ? "missing"
        : graph.status === "error"
          ? "error"
          : "fresh",
    dependencies: ["legacy:graph", "legacy:graph-meta", "legacy:fingerprints"],
    reasons: [],
  };

  const traces = selectedWikiSupportPath(wikiTracesRoot, wikiTracesTrace);
  const report = selectedWikiSupportPath(wikiReportRoot, wikiReportTrace);
  const wikiVersion = wikiIndex.value?.version;
  const wikiSource = objectField(wikiIndex.value, "source");
  const wikiCommit = stringField(wikiSource, "gitCommitHash");
  const wikiIndexNode = readToNode("legacy:wiki-index", wikiIndex, {
    commit: wikiCommit,
    expectedCommit,
    reasons:
      wikiIndex.status === "present" &&
      wikiVersion !== 1 &&
      wikiVersion !== 2
        ? ["Wiki index has an unsupported version"]
        : [],
  });
  if (
    wikiIndex.status === "present" &&
    wikiVersion !== 1 &&
    wikiVersion !== 2
  ) {
    wikiIndexNode.intrinsicStatus = "error";
  }
  const reportSource = objectField(report.value, "source");
  const reportCommit = stringField(reportSource, "gitCommitHash");
  const wikiReportNode = readToNode("legacy:wiki-generation-report", report, {
    commit: reportCommit,
    expectedCommit,
  });
  const wikiSearchNode = readToNode("legacy:wiki-search-index", wikiSearch);
  const wikiTracesNode = readToNode("legacy:wiki-document-traces", traces);
  const wikiGenerationIds = [
    stringField(wikiIndex.value, "generatedAt"),
    stringField(wikiSearch.value, "generatedAt"),
    stringField(traces.value, "generatedAt"),
    stringField(report.value, "generatedAt"),
  ];
  const wikiGenerationMismatch =
    wikiVersion === 2 &&
    wikiGenerationIds.every((generatedAt) => generatedAt !== undefined) &&
    new Set(wikiGenerationIds).size !== 1;

  const wikiGraphDigest = stringField(wikiSource, "graphDigest");
  const reportGraphDigest = stringField(reportSource, "graphDigest");
  const validLegacyGraphDigest = (digest: string | undefined): boolean =>
    digest !== undefined &&
    /^(?:sha256:)?[0-9a-f]{64}$/u.test(digest);
  if (wikiIndex.status === "present" && !validLegacyGraphDigest(wikiGraphDigest)) {
    wikiIndexNode.intrinsicStatus =
      wikiGraphDigest === undefined ? "partial" : "error";
    wikiIndexNode.reasons = [
      ...(wikiIndexNode.reasons ?? []),
      wikiGraphDigest === undefined
        ? "Wiki index does not bind to a graph digest"
        : "Wiki index graph digest has an unsupported format",
    ];
  }
  if (
    wikiVersion === 2 &&
    report.status === "present" &&
    !validLegacyGraphDigest(reportGraphDigest)
  ) {
    wikiReportNode.intrinsicStatus =
      reportGraphDigest === undefined ? "partial" : "error";
    wikiReportNode.reasons = [
      ...(wikiReportNode.reasons ?? []),
      reportGraphDigest === undefined
        ? "Wiki generation report does not bind to a graph digest"
        : "Wiki generation report graph digest has an unsupported format",
    ];
  }
  if (
    wikiGraphDigest !== undefined &&
    reportGraphDigest !== undefined &&
    wikiGraphDigest.replace(/^sha256:/u, "") !==
      reportGraphDigest.replace(/^sha256:/u, "")
  ) {
    wikiReportNode.intrinsicStatus = "stale";
    wikiReportNode.reasons = [
      ...(wikiReportNode.reasons ?? []),
      "Wiki index and generation report reference different graph digests",
    ];
  }
  const graphSemanticDigest =
    graph.value === undefined
      ? undefined
      : createHash("sha256")
          .update(JSON.stringify(graph.value))
          .digest("hex");
  const normalizedWikiGraphDigest = wikiGraphDigest?.replace(/^sha256:/u, "");
  if (
    normalizedWikiGraphDigest !== undefined &&
    /^[0-9a-f]{64}$/u.test(normalizedWikiGraphDigest) &&
    graphSemanticDigest !== undefined &&
    normalizedWikiGraphDigest !== graphSemanticDigest
  ) {
    wikiIndexNode.intrinsicStatus = "stale";
    wikiIndexNode.reasons = [
      ...(wikiIndexNode.reasons ?? []),
      "Wiki graph digest does not match the current legacy graph bytes",
    ];
  }

  const wikiDependencies = ["legacy:wiki-index", "family:legacy-graph"];
  if (wikiVersion === 2) {
    wikiDependencies.push(
      "legacy:wiki-search-index",
      "legacy:wiki-document-traces",
      "legacy:wiki-generation-report",
    );
  }
  const legacyWikiRoot: ArtifactFreshnessNodeInput = {
    id: "family:legacy-wiki",
    intrinsicStatus:
      wikiIndex.status === "missing"
        ? "missing"
        : wikiIndex.status === "error"
          ? "error"
          : wikiGenerationMismatch
            ? "stale"
            : "fresh",
    dependencies: wikiDependencies,
    reasons: wikiGenerationMismatch
      ? ["Wiki V2 artifact files belong to different generations"]
      : [],
  };

  const diffBaseCommit =
    stringField(diffOverlay.value, "baseCommit") ??
    stringField(diffOverlay.value, "baseBranch");
  const diffTargetCommit = stringField(diffOverlay.value, "targetCommit");
  const diffNode = readToNode("legacy:diff-overlay", diffOverlay);
  if (diffOverlay.status === "present") {
    if (
      diffTargetCommit === undefined ||
      expectedCommit === undefined ||
      diffTargetCommit !== expectedCommit
    ) {
      diffNode.intrinsicStatus = "stale";
      diffNode.reasons = [
        ...(diffNode.reasons ?? []),
        "Legacy Diff Overlay does not target current HEAD",
      ];
    }
    if (
      snapshot.baseCommit !== undefined &&
      diffBaseCommit !== undefined &&
      diffBaseCommit !== snapshot.baseCommit
    ) {
      diffNode.intrinsicStatus = "stale";
      diffNode.reasons = [
        ...(diffNode.reasons ?? []),
        "Legacy Diff Overlay baseline does not match the snapshot baseline",
      ];
    }
    if (snapshot.changes.some((change) => change.source !== "committed")) {
      diffNode.intrinsicStatus = "stale";
      diffNode.reasons = [
        ...(diffNode.reasons ?? []),
        "Legacy Diff Overlay is commit-based while the current worktree has changes",
      ];
    }
  }
  const legacyDiffRoot: ArtifactFreshnessNodeInput = {
    id: "family:legacy-diff",
    intrinsicStatus: diffNode.intrinsicStatus,
    dependencies: ["legacy:diff-overlay"],
    reasons: [...(diffNode.reasons ?? [])],
  };

  const nodes: ArtifactFreshnessNodeInput[] = [
    graphNode,
    metaNode,
    fingerprintsNode,
    legacyGraphRoot,
    wikiIndexNode,
    wikiSearchNode,
    wikiTracesNode,
    wikiReportNode,
    legacyWikiRoot,
    diffNode,
    legacyDiffRoot,
  ];
  const familyRootIds: Record<ArtifactFamilyV1, string> = {
    graph: legacyGraphRoot.id,
    wiki: legacyWikiRoot.id,
    evidence: "family:evidence",
    diff: legacyDiffRoot.id,
    task: "family:task",
  };

  const manifest = options.manifest;
  if (manifest !== undefined) {
    const manifestResult = ArtifactManifestV1Schema.safeParse(manifest);
    if (!manifestResult.success) {
      for (const family of ARTIFACT_FAMILIES_V1) {
        const rootId = `family:invalid-manifest-${family}`;
        nodes.push({
          id: rootId,
          intrinsicStatus: "error",
          reasons: [
            "Artifact Manifest failed Contracts validation",
            ...manifestResult.error.issues
              .slice(0, 5)
              .map((issue) => issue.message),
          ],
        });
        familyRootIds[family] = rootId;
      }
    } else {
      const parsedManifest = manifestResult.data;
      const managed = manifestNodes(parsedManifest);
      nodes.push(...managed.nodes);
      for (const family of ARTIFACT_FAMILIES_V1) {
        const currentDescriptorIds =
          managed.currentDescriptorIdsByFamily[family];
        const descriptorIds =
          currentDescriptorIds.length > 0
            ? currentDescriptorIds
            : managed.descriptorIdsByFamily[family];
        if (descriptorIds.length === 0) continue;
        const rootId = `family:manifest-${family}`;
        nodes.push({
          id: rootId,
          intrinsicStatus: "fresh",
          dependencies: descriptorIds,
          reasons:
            currentDescriptorIds.length > 0
              ? []
              : ["No current descriptor is available for this artifact family"],
        });
        familyRootIds[family] = rootId;
      }
      const contractDagIssues = validateArtifactDependencyDagV1(
        parsedManifest.artifacts,
        parsedManifest.latestSnapshotId === undefined
          ? {}
          : { latestSnapshotId: parsedManifest.latestSnapshotId },
      );
      if (contractDagIssues.length > 0) {
        for (const issue of contractDagIssues) {
          const descriptorNode = nodes.find(
            (node) => node.id === `manifest:${issue.artifactId}`,
          );
          if (descriptorNode !== undefined) {
            descriptorNode.intrinsicStatus = "error";
            descriptorNode.reasons = [
              ...(descriptorNode.reasons ?? []),
              `${issue.code}: ${issue.message}`,
            ];
          }
        }
      }
    }
  }

  if (!nodes.some((node) => node.id === familyRootIds.evidence)) {
    nodes.push({
      id: familyRootIds.evidence,
      intrinsicStatus: "missing",
      reasons: ["No Evidence artifact is available"],
    });
  }
  if (!nodes.some((node) => node.id === familyRootIds.task)) {
    nodes.push({
      id: familyRootIds.task,
      intrinsicStatus: "missing",
      reasons: ["No Task artifact is available"],
    });
  }

  const evaluation = evaluateArtifactFreshnessDag(nodes, {
    currentSnapshotId: snapshot.snapshotId,
  });
  const evaluatedById = new Map(
    evaluation.nodes.map((node) => [node.id, node]),
  );
  const artifactFreshness = Object.fromEntries(
    ARTIFACT_FAMILIES_V1.map((family) => [
      family,
      evaluatedById.get(familyRootIds[family])?.status ?? "error",
    ]),
  ) as Record<ArtifactFamilyV1, ArtifactFreshnessV1>;
  const reasonsByFamily = Object.fromEntries(
    ARTIFACT_FAMILIES_V1.map((family) => [
      family,
      evaluatedById.get(familyRootIds[family])?.reasons ?? [
        "Family root could not be evaluated",
      ],
    ]),
  ) as Record<ArtifactFamilyV1, string[]>;

  return {
    artifactFreshness,
    reasonsByFamily,
    familyRootIds,
    evaluation,
  };
}
