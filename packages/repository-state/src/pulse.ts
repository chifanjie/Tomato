import {
  RepoPulseV1Schema,
  type ArtifactFreshnessV1,
  type RepoPulseCompletenessV1,
  type RepoPulseDiagnosticV1,
  type RepoPulseRecommendedRefreshV1,
  type RepoPulseStatusV1,
  type RepoPulseV1,
  type RepositoryChangeKindV1,
  type RepositoryChangeSourceV1,
  type RepositorySnapshotV1,
} from "@understand-code/contracts";
import {
  ARTIFACT_FAMILIES_V1,
  type ArtifactFamilyFreshnessV1,
  type ArtifactFreshnessReport,
} from "./freshness.js";
import type { RepositoryGitContext } from "./snapshot.js";
import type { GraphRefreshDecision } from "./taxonomy.js";

export interface BuildRepoPulseInput {
  snapshot: RepositorySnapshotV1;
  artifacts: ArtifactFreshnessReport | ArtifactFamilyFreshnessV1;
  git?: RepositoryGitContext;
  baselineSnapshotId?: string;
  completeness?: RepoPulseCompletenessV1;
  graphRefreshDecision?: GraphRefreshDecision;
  evaluatedAt?: string;
}

const CHANGE_SOURCES: readonly RepositoryChangeSourceV1[] = [
  "committed",
  "staged",
  "unstaged",
  "untracked",
  "conflict",
];
const CHANGE_KINDS: readonly RepositoryChangeKindV1[] = [
  "added",
  "modified",
  "deleted",
  "renamed",
  "copied",
  "type_changed",
];

function isFreshnessReport(
  artifacts: ArtifactFreshnessReport | ArtifactFamilyFreshnessV1,
): artifacts is ArtifactFreshnessReport {
  return "evaluation" in artifacts && "artifactFreshness" in artifacts;
}

function completeArtifactMap(
  artifacts: ArtifactFreshnessReport | ArtifactFamilyFreshnessV1,
): Record<string, ArtifactFreshnessV1> {
  const source = isFreshnessReport(artifacts)
    ? artifacts.artifactFreshness
    : artifacts;
  return Object.fromEntries(
    ARTIFACT_FAMILIES_V1.map((family) => [
      family,
      source[family] ?? "error",
    ]),
  );
}

function defaultCompleteness(
  snapshot: RepositorySnapshotV1,
): RepoPulseCompletenessV1 {
  if (snapshot.captureStatus === "error") {
    return {
      parser: {
        status: "unknown",
        reasons: ["Parser completeness cannot be evaluated without repository state"],
      },
      callGraph: {
        status: "unknown",
        reasons: ["Call graph completeness cannot be evaluated without repository state"],
      },
    };
  }
  return {
    parser: {
      status: "unknown",
      reasons: ["Parser coverage was not supplied by the index producer"],
    },
    callGraph: {
      status: "unknown",
      reasons: ["Call graph coverage was not supplied by the index producer"],
    },
  };
}

function changeSummary(snapshot: RepositorySnapshotV1) {
  const bySource = Object.fromEntries(
    CHANGE_SOURCES.map((source) => [
      source,
      snapshot.changes.filter((change) => change.source === source).length,
    ]),
  ) as Record<RepositoryChangeSourceV1, number>;
  const byKind = Object.fromEntries(
    CHANGE_KINDS.map((kind) => [
      kind,
      snapshot.changes.filter((change) => change.kind === kind).length,
    ]),
  ) as Record<RepositoryChangeKindV1, number>;
  return { total: snapshot.changes.length, bySource, byKind };
}

function recommendedRefresh(
  artifacts: Readonly<Record<string, ArtifactFreshnessV1>>,
  decision: GraphRefreshDecision | undefined,
): RepoPulseRecommendedRefreshV1 {
  let artifactRequired: RepoPulseRecommendedRefreshV1 = "none";
  if (artifacts.graph === "missing" || artifacts.graph === "error") {
    artifactRequired = "full";
  } else if (
    artifacts.graph === "stale" ||
    artifacts.graph === "partial" ||
    artifacts.wiki === "stale" ||
    artifacts.wiki === "partial"
  ) {
    artifactRequired = "incremental";
  }
  const decisionLevel = decision?.level ?? "none";
  const order: Readonly<Record<RepoPulseRecommendedRefreshV1, number>> = {
    none: 0,
    incremental: 1,
    full: 2,
  };
  return order[artifactRequired] >= order[decisionLevel]
    ? artifactRequired
    : decisionLevel;
}

function pulseStatus(
  snapshot: RepositorySnapshotV1,
  artifacts: Readonly<Record<string, ArtifactFreshnessV1>>,
  completeness: RepoPulseCompletenessV1,
  refresh: RepoPulseRecommendedRefreshV1,
): RepoPulseStatusV1 {
  if (snapshot.captureStatus === "error") return "unknown";
  if (artifacts.graph === "missing") return "not_ready";
  if (Object.values(artifacts).includes("error")) return "error";
  if (Object.values(artifacts).includes("stale")) return "stale";
  if (refresh !== "none") return "stale";
  if (
    snapshot.captureStatus === "partial" ||
    Object.values(artifacts).some(
      (status) => status === "missing" || status === "partial",
    ) ||
    completeness.parser.status !== "complete" ||
    completeness.callGraph.status !== "complete"
  ) {
    return "partial";
  }
  return "fresh";
}

function diagnostic(
  code: string,
  scope: RepoPulseDiagnosticV1["scope"],
  message: string,
): RepoPulseDiagnosticV1 {
  return { code, scope, message };
}

function uniqueDiagnostics(
  diagnostics: readonly RepoPulseDiagnosticV1[],
): RepoPulseDiagnosticV1[] {
  const seen = new Set<string>();
  return diagnostics.filter((item) => {
    const key = `${item.code}\0${item.scope}\0${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Builds the exact Contracts RepoPulseV1 payload. Every result reports all five
 * artifact families; Git errors are represented as unknown, never as fresh.
 */
export function buildRepoPulse(input: BuildRepoPulseInput): RepoPulseV1 {
  const suppliedArtifacts = completeArtifactMap(input.artifacts);
  const artifactFreshness =
    input.snapshot.captureStatus === "error"
      ? (Object.fromEntries(
          ARTIFACT_FAMILIES_V1.map((family) => [family, "error"]),
        ) as Record<string, ArtifactFreshnessV1>)
      : suppliedArtifacts;
  const completeness =
    input.completeness ?? defaultCompleteness(input.snapshot);
  const refresh = recommendedRefresh(
    artifactFreshness,
    input.graphRefreshDecision,
  );
  const status = pulseStatus(
    input.snapshot,
    artifactFreshness,
    completeness,
    refresh,
  );
  const errors: RepoPulseDiagnosticV1[] = [];
  const unknowns: RepoPulseDiagnosticV1[] = [];
  const reasons: string[] = [];

  if (input.snapshot.captureStatus === "error") {
    errors.push(
      diagnostic(
        "git_capture_error",
        "git",
        "Git repository state could not be captured; cleanliness is unknown",
      ),
    );
    reasons.push("Git repository state is unknown");
  } else if (input.snapshot.captureStatus === "partial") {
    unknowns.push(
      diagnostic(
        "repository_capture_partial",
        "repository",
        "Repository capture completed with explicit limitations",
      ),
    );
    reasons.push("Repository capture is partial");
  }

  for (const family of ARTIFACT_FAMILIES_V1) {
    const freshness = artifactFreshness[family];
    if (freshness === "fresh") continue;
    reasons.push(`${family} artifact family is ${freshness}`);
    if (freshness === "error") {
      errors.push(
        diagnostic(
          `${family}_artifact_error`,
          "artifact",
          `${family} artifacts could not be validated`,
        ),
      );
    } else if (freshness === "missing") {
      unknowns.push(
        diagnostic(
          `${family}_artifact_missing`,
          "artifact",
          `${family} artifacts are not available`,
        ),
      );
    }
  }
  if (refresh === "none") {
    for (const family of ["evidence", "diff", "task"] as const) {
      if (artifactFreshness[family] !== "stale") continue;
      reasons.push(
        `${family} artifacts require downstream recomputation; repository index refresh is not required`,
      );
    }
  }

  for (const [componentName, component] of [
    ["parser", completeness.parser],
    ["call_graph", completeness.callGraph],
  ] as const) {
    if (component.status === "complete") continue;
    reasons.push(`${componentName} completeness is ${component.status}`);
    unknowns.push(
      diagnostic(
        `${componentName}_completeness_${component.status}`,
        componentName === "parser" ? "parser" : "call_graph",
        component.reasons.join("; "),
      ),
    );
  }

  if (isFreshnessReport(input.artifacts)) {
    for (const issue of input.artifacts.evaluation.issues) {
      reasons.push(issue.message);
    }
  }
  if (refresh !== "none") {
    reasons.push(`Repository state requires a ${refresh} graph refresh`);
  }
  for (const limitation of input.snapshot.limitations) reasons.push(limitation);

  const uniqueReasons =
    status === "fresh" ? [] : [...new Set(reasons)].sort();
  const repositoryState = {
    rootIdentity: input.snapshot.rootIdentity,
    ...(input.snapshot.branch === undefined
      ? {}
      : { branch: input.snapshot.branch }),
    ...(input.snapshot.baseCommit === undefined
      ? {}
      : { baselineCommit: input.snapshot.baseCommit }),
    ...(input.snapshot.headCommit === undefined
      ? {}
      : { headCommit: input.snapshot.headCommit }),
    ...(input.snapshot.mergeBase === undefined
      ? {}
      : { mergeBase: input.snapshot.mergeBase }),
    ...(input.git?.ahead === undefined || input.git.behind === undefined
      ? {}
      : { ahead: input.git.ahead, behind: input.git.behind }),
    captureStatus: input.snapshot.captureStatus,
    limitations: [...input.snapshot.limitations],
  };
  const payload = {
    evaluatedSnapshotId: input.snapshot.snapshotId,
    ...(input.baselineSnapshotId === undefined
      ? {}
      : { baselineSnapshotId: input.baselineSnapshotId }),
    status,
    artifactFreshness,
    repositoryState,
    changeSummary: changeSummary(input.snapshot),
    completeness,
    recommendedRefresh: refresh,
    errors: status === "fresh" ? [] : uniqueDiagnostics(errors),
    unknowns: status === "fresh" ? [] : uniqueDiagnostics(unknowns),
    reasons: uniqueReasons,
    evaluatedAt: input.evaluatedAt ?? new Date().toISOString(),
  };
  return RepoPulseV1Schema.parse(payload);
}

export function serializeRepoPulse(pulse: RepoPulseV1): string {
  return `${JSON.stringify(RepoPulseV1Schema.parse(pulse), null, 2)}\n`;
}
