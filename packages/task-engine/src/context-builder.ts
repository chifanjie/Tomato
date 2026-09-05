import {
  ClaimV1Schema,
  EvidenceV1Schema,
  ImpactPathV1Schema,
  RepositoryRelativePathSchema,
  TaskBriefV1Schema,
  type ClaimV1,
  type EvidenceFreshnessV1,
  type EvidenceV1,
  type ImpactPathV1,
  type RepoPulsePersistedPayloadV1,
  type RepositorySnapshotPersistedPayloadV1,
} from "@understand-code/contracts";

import type {
  BuiltTaskContext,
  SourceEvidenceRecord,
  TaskContextData,
} from "./engine-types.js";
import { sha256CanonicalJson, stableId } from "./ids.js";
import { traceImpact } from "./impact.js";
import { rankCandidates } from "./ranking.js";
import { compareUnicodeCodeUnits } from "./stable-order.js";

export interface BuildContextDraftInput {
  taskId: string;
  intent: string;
  snapshotId: string;
  createdAt: string;
  pulse: RepoPulsePersistedPayloadV1;
  repositorySnapshot: RepositorySnapshotPersistedPayloadV1;
  context: TaskContextData;
  contextGenerationId?: string;
  scope?: readonly string[];
  tokenBudget?: number;
  maxCandidates?: number;
  maxImpactDepth?: number;
}

function claim(
  input: BuildContextDraftInput,
  value: Omit<ClaimV1, "taskId" | "sourceSnapshotId" | "findingIds" |
    "verificationRecordIds" | "createdAt" | "updatedAt">,
): ClaimV1 {
  return ClaimV1Schema.parse({
    ...value,
    taskId: input.taskId,
    sourceSnapshotId: input.snapshotId,
    findingIds: [],
    verificationRecordIds: [],
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

function evidenceFreshness(
  pulse: RepoPulsePersistedPayloadV1,
  freshConclusion: boolean,
): EvidenceFreshnessV1 {
  return pulse.status === "stale" || !freshConclusion
    ? "stale"
    : "current";
}

function evidenceForCandidate(
  input: BuildContextDraftInput,
  candidate: ReturnType<typeof rankCandidates>["candidates"][number],
  claimId: string,
  supplied: SourceEvidenceRecord | undefined,
): EvidenceV1 {
  const freshness = evidenceFreshness(
    input.pulse,
    candidate.freshConclusion,
  );
  const common = {
    id: stableId("evidence", {
      taskId: input.taskId,
      nodeId: candidate.nodeId,
      snapshotId: input.snapshotId,
    }),
    freshness,
    ...(freshness === "stale"
      ? {
          freshnessReason:
            "The ranking conclusion is degraded because Graph, Pulse, or repository context is not fully fresh.",
        }
      : {}),
    claimIds: [claimId],
    nodeIds: [candidate.nodeId],
    producedBy: "task-engine",
    createdAt: input.createdAt,
    observedAtSnapshotId: input.snapshotId,
  };
  if (supplied !== undefined) {
    return EvidenceV1Schema.parse({
      ...common,
      kind: supplied.kind ?? "source",
      epistemicStatus: "observed",
      filePath: supplied.filePath,
      ...(supplied.lineRange === undefined
        ? {}
        : { lineRange: [...supplied.lineRange] }),
      ...(supplied.excerpt === undefined
        ? {}
        : { excerpt: supplied.excerpt }),
      ...(supplied.commit === undefined
        ? {}
        : { commit: supplied.commit }),
      contentHash: supplied.contentHash,
    });
  }
  return EvidenceV1Schema.parse({
    ...common,
    kind: "graph_path",
    epistemicStatus: "inferred",
    relationPath: [candidate.nodeId],
    derivationPath: [
      {
        kind: "graph_relation",
        relationId: candidate.nodeId,
        description:
          "Candidate was inferred from deterministic lexical and Graph ranking.",
      },
    ],
  });
}

function unknownBoundaryEvidence(
  input: BuildContextDraftInput,
  claimId: string,
  reason: string,
): EvidenceV1 {
  return EvidenceV1Schema.parse({
    id: stableId("evidence", {
      taskId: input.taskId,
      claimId,
      reason,
      snapshotId: input.snapshotId,
    }),
    kind: "analysis_boundary",
    epistemicStatus: "unknown",
    freshness: "current",
    claimIds: [claimId],
    nodeIds: [],
    producedBy: "task-engine",
    createdAt: input.createdAt,
    observedAtSnapshotId: input.snapshotId,
    boundaryReason: reason,
    relationPath: [],
  });
}

function candidateLevel(
  rank: number,
  filePath: string,
  freshConclusion: boolean,
): "must_inspect" | "likely_change" | "possible_change" |
  "test_or_verify" | "context_only" {
  if (!freshConclusion) return "context_only";
  if (
    /(?:^|\/)(?:test|tests|__tests__)(?:\/|$)|(?:\.test|_test)\.[^/]+$/iu.test(
      filePath,
    )
  ) {
    return "test_or_verify";
  }
  if (rank === 1) return "must_inspect";
  if (rank <= 4) return "likely_change";
  if (rank <= 10) return "possible_change";
  return "context_only";
}

function plannedChangeExpectation(
  level: ReturnType<typeof candidateLevel>,
): "required_change" | "optional_change" | "inspect_only" |
  "verification_only" {
  switch (level) {
    case "likely_change":
      return "required_change";
    case "possible_change":
      return "optional_change";
    case "must_inspect":
    case "context_only":
      return "inspect_only";
    case "test_or_verify":
      return "verification_only";
  }
}

function truncationForContract(
  reasons: readonly string[],
  hiddenCount: number,
): { reason: "depth" | "node_budget" | "unsupported_dynamic_edge"; hiddenCount: number } | undefined {
  if (reasons.includes("call_graph_incomplete")) {
    return { reason: "unsupported_dynamic_edge", hiddenCount };
  }
  if (reasons.includes("node_budget")) {
    return { reason: "node_budget", hiddenCount };
  }
  if (reasons.includes("max_depth")) {
    return { reason: "depth", hiddenCount };
  }
  return undefined;
}

export function buildContextDraft(
  input: BuildContextDraftInput,
): BuiltTaskContext {
  const contextBoundaryReasons: string[] = [];
  const existingFilePaths = new Set<string>();
  for (
    const [index, filePath] of [...input.context.existingFilePaths]
      .sort(compareUnicodeCodeUnits)
      .entries()
  ) {
    const parsed = RepositoryRelativePathSchema.safeParse(filePath);
    if (parsed.success) {
      existingFilePaths.add(parsed.data);
    } else {
      contextBoundaryReasons.push(
        `Host existingFilePaths entry ${index + 1} was not a valid repository-relative path and was ignored.`,
      );
    }
  }
  const candidateFilePaths = new Map<string, string>();
  const excludedWithoutPath: string[] = [];
  const excludedInvalidPath: string[] = [];
  const excludedUnverifiedPath: string[] = [];
  const runtimeGraph = input.context.graph as unknown as {
    nodes?: unknown;
  } | null;
  const graphNodes = Array.isArray(runtimeGraph?.nodes)
    ? runtimeGraph.nodes
    : [];
  for (const rawNode of graphNodes) {
    if (
      typeof rawNode !== "object" ||
      rawNode === null ||
      !("id" in rawNode) ||
      typeof rawNode.id !== "string"
    ) {
      continue;
    }
    const nodeId = rawNode.id;
    if (!("filePath" in rawNode) || rawNode.filePath === undefined) {
      excludedWithoutPath.push(nodeId);
      continue;
    }
    const parsed = RepositoryRelativePathSchema.safeParse(rawNode.filePath);
    if (!parsed.success) {
      excludedInvalidPath.push(nodeId);
      continue;
    }
    if (!existingFilePaths.has(parsed.data)) {
      excludedUnverifiedPath.push(nodeId);
      continue;
    }
    candidateFilePaths.set(nodeId, parsed.data);
  }
  const hostBoundary = (
    nodeIds: readonly string[],
    reason: string,
  ): void => {
    if (nodeIds.length === 0) return;
    const ordered = [...nodeIds].sort(compareUnicodeCodeUnits);
    const preview = ordered.slice(0, 5).join(", ");
    const hidden = ordered.length - Math.min(ordered.length, 5);
    contextBoundaryReasons.push(
      `Host eligibility excluded ${ordered.length} Graph node${ordered.length === 1 ? "" : "s"} before ranking because ${reason}: ${preview}${hidden === 0 ? "" : `, and ${hidden} more`}.`,
    );
  };
  hostBoundary(
    excludedWithoutPath,
    "no repository file path was available",
  );
  hostBoundary(
    excludedInvalidPath,
    "the repository file path was invalid",
  );
  hostBoundary(
    excludedUnverifiedPath,
    "file existence was not verified for this Snapshot",
  );
  const ranking = rankCandidates({
    query: input.intent,
    graph: input.context.graph,
    repoPulse: input.pulse,
    repositorySnapshot:
      input.context.repositorySnapshot ?? input.repositorySnapshot,
    wiki: input.context.wiki,
    options: {
      scope: {
        nodeIds: [...candidateFilePaths.keys()].sort(compareUnicodeCodeUnits),
        ...(input.scope === undefined
          ? {}
          : { pathPrefixes: input.scope }),
      },
      maxCandidates: input.maxCandidates ?? 20,
      tokenBudget: input.tokenBudget ?? 8_000,
    },
  });
  const verifiedCandidates = ranking.candidates;

  const goalClaimId = stableId("claim:goal", {
    taskId: input.taskId,
    intent: input.intent,
  });
  const acceptanceClaimId = stableId("claim:acceptance", {
    taskId: input.taskId,
    intent: input.intent,
  });
  const claims: ClaimV1[] = [
    claim(input, {
      id: goalClaimId,
      kind: "goal",
      statement: input.intent,
      epistemicStatus: "unknown",
      lifecycleStatus: "draft",
      freshness: "current",
      evidenceIds: [],
      boundaryReason: "Goal awaits explicit Agent-user confirmation.",
    }),
    claim(input, {
      id: acceptanceClaimId,
      kind: "acceptance",
      statement:
        `The requested change satisfies the confirmed intent: ${input.intent}`,
      epistemicStatus: "unknown",
      lifecycleStatus: "draft",
      freshness: "current",
      evidenceIds: [],
      boundaryReason:
        "Acceptance criteria are a draft until explicitly confirmed.",
    }),
  ];
  const evidence: EvidenceV1[] = [];
  const assumptionStatement =
    "Planning assumes that no runtime-only dependency outside the current Graph and Host-verified file boundary must be modified to satisfy this Task.";
  const assumptionBoundaryReason =
    "The static Graph and Snapshot-bound Source Evidence cannot prove the absence of runtime-only dependencies; confirm or revise this assumption before implementation.";
  const assumptionClaimId = stableId("claim:assumption", {
    taskId: input.taskId,
    snapshotId: input.snapshotId,
    boundary: "runtime-dependencies-outside-verified-context",
  });
  const assumptionEvidence = unknownBoundaryEvidence(
    input,
    assumptionClaimId,
    assumptionBoundaryReason,
  );
  claims.push(
    claim(input, {
      id: assumptionClaimId,
      kind: "assumption",
      statement: assumptionStatement,
      epistemicStatus: "unknown",
      lifecycleStatus: "draft",
      freshness: "current",
      evidenceIds: [assumptionEvidence.id],
      boundaryReason: assumptionBoundaryReason,
    }),
  );
  evidence.push(assumptionEvidence);
  const recommendationByNode = new Map<string, string>();
  const evidenceByNode = new Map<string, string>();
  const sourceEvidence = new Map(
    (input.context.sourceEvidence ?? []).map((item) => [item.nodeId, item]),
  );

  for (const candidate of verifiedCandidates) {
    const claimId = stableId("claim:recommendation", {
      taskId: input.taskId,
      nodeId: candidate.nodeId,
      snapshotId: input.snapshotId,
    });
    const candidateFilePath = candidateFilePaths.get(candidate.nodeId)!;
    const suppliedEvidence = sourceEvidence.get(candidate.nodeId);
    const suppliedEvidencePath =
      suppliedEvidence === undefined
        ? undefined
        : RepositoryRelativePathSchema.safeParse(suppliedEvidence.filePath);
    const verifiedSuppliedEvidence =
      suppliedEvidence !== undefined &&
      suppliedEvidencePath?.success === true &&
      suppliedEvidencePath.data === candidateFilePath &&
      existingFilePaths.has(suppliedEvidencePath.data)
        ? suppliedEvidence
        : undefined;
    if (
      suppliedEvidence !== undefined &&
      verifiedSuppliedEvidence === undefined
    ) {
      contextBoundaryReasons.push(
        `Source Evidence for ranked node ${candidate.nodeId} was not aligned to its Host-verified file and was downgraded to inference.`,
      );
    }
    const itemEvidence = evidenceForCandidate(
      input,
      candidate,
      claimId,
      verifiedSuppliedEvidence,
    );
    const freshness = itemEvidence.freshness;
    claims.push(
      claim(input, {
        id: claimId,
        kind: "recommendation",
        statement:
          `Inspect ${candidateFilePath}: ${candidate.reasons.join("; ")}`,
        epistemicStatus:
          itemEvidence.epistemicStatus === "observed" ? "observed" : "inferred",
        lifecycleStatus: "supported",
        freshness,
        evidenceIds: [itemEvidence.id],
        ...(itemEvidence.epistemicStatus === "inferred"
          ? {
              derivationPath: [
                {
                  kind: "evidence",
                  evidenceId: itemEvidence.id,
                  description:
                    "Recommendation is derived from explainable deterministic ranking.",
                },
              ],
            }
          : {}),
      }),
    );
    evidence.push(itemEvidence);
    recommendationByNode.set(candidate.nodeId, claimId);
    evidenceByNode.set(candidate.nodeId, itemEvidence.id);
  }

  const unknownClaimIds: string[] = [];
  const riskClaimIds: string[] = [];
  const boundaryReasons = [
    ...new Set([
      ...contextBoundaryReasons,
      ...ranking.diagnostics.map((diagnostic) => diagnostic.message),
      ...(ranking.truncation.truncated
        ? [
            `${ranking.truncation.hiddenCount} ranked candidates were truncated by ${ranking.truncation.reason}.`,
          ]
        : []),
    ]),
  ].sort(compareUnicodeCodeUnits);
  if (ranking.candidates.length === 0 || boundaryReasons.length > 0) {
    const reason =
      boundaryReasons.join(" ") ||
      "No repository-backed candidate matched the task within the current scope.";
    const unknownClaimId = stableId("claim:unknown", {
      taskId: input.taskId,
      reason,
    });
    const boundaryEvidence = unknownBoundaryEvidence(
      input,
      unknownClaimId,
      reason,
    );
    claims.push(
      claim(input, {
        id: unknownClaimId,
        kind: "unknown",
        statement: "Candidate coverage has an explicit analysis boundary.",
        epistemicStatus: "unknown",
        lifecycleStatus: "supported",
        freshness: "current",
        evidenceIds: [boundaryEvidence.id],
        boundaryReason: reason,
      }),
    );
    evidence.push(boundaryEvidence);
    unknownClaimIds.push(unknownClaimId);
  }
  if (input.pulse.status !== "fresh") {
    const reason =
      `Repo Pulse status is ${input.pulse.status}; conclusions may require an explicit refresh.`;
    const riskClaimId = stableId("claim:risk", {
      taskId: input.taskId,
      reason,
    });
    const boundaryEvidence = unknownBoundaryEvidence(
      input,
      riskClaimId,
      reason,
    );
    claims.push(
      claim(input, {
        id: riskClaimId,
        kind: "risk",
        statement: reason,
        epistemicStatus: "unknown",
        lifecycleStatus: "supported",
        freshness: "current",
        evidenceIds: [boundaryEvidence.id],
        boundaryReason: reason,
      }),
    );
    evidence.push(boundaryEvidence);
    riskClaimIds.push(riskClaimId);
  }

  const startNodeIds = verifiedCandidates
    .slice(0, Math.min(3, verifiedCandidates.length))
    .map((candidate) => candidate.nodeId);
  const traced =
    startNodeIds.length === 0
      ? undefined
      : traceImpact({
          graph: input.context.graph,
          startNodeIds,
          repoPulse: input.pulse,
          options: {
            direction: "both",
            maxDepth: input.maxImpactDepth ?? 4,
            nodeBudget: Math.max(50, (input.maxCandidates ?? 20) * 10),
            maxPaths: Math.max(20, input.maxCandidates ?? 20),
          },
        });
  const impactBoundaryReasons = [
    ...(traced?.boundaries.map((boundary) => boundary.message) ?? []),
    ...(traced?.truncation.truncated === true &&
    traced.boundaries.length === 0
      ? [
          `Impact traversal was truncated by ${traced.truncation.reasons.join(", ")}; hidden count ${traced.truncation.hiddenCount}${traced.truncation.hiddenCountIsLowerBound ? " or more" : ""}.`,
        ]
      : []),
  ];
  if (impactBoundaryReasons.length > 0) {
    const reason = [...new Set(impactBoundaryReasons)].join(" ");
    const unknownClaimId = stableId("claim:impact-unknown", {
      taskId: input.taskId,
      reason,
      snapshotId: input.snapshotId,
    });
    const boundaryEvidence = unknownBoundaryEvidence(
      input,
      unknownClaimId,
      reason,
    );
    claims.push(
      claim(input, {
        id: unknownClaimId,
        kind: "unknown",
        statement: "Impact coverage has an explicit analysis boundary.",
        epistemicStatus: "unknown",
        lifecycleStatus: "supported",
        freshness: "current",
        evidenceIds: [boundaryEvidence.id],
        boundaryReason: reason,
      }),
    );
    evidence.push(boundaryEvidence);
    unknownClaimIds.push(unknownClaimId);
  }
  const impactPaths: ImpactPathV1[] = [];
  for (const path of traced?.paths ?? []) {
    const claimId = recommendationByNode.get(path.startNodeId);
    if (claimId === undefined) continue;
    const truncation = truncationForContract(
      traced?.truncation.reasons ?? [],
      traced?.truncation.hiddenCount ?? 0,
    );
    impactPaths.push(
      ImpactPathV1Schema.parse({
        id: stableId("impact", {
          taskId: input.taskId,
          nodes: path.nodeIds,
          snapshotId: input.snapshotId,
        }),
        sourceNodeId: path.startNodeId,
        targetNodeId: path.endNodeId,
        classification:
          traced?.classification === "unknown_boundary"
            ? "unknown_boundary"
            : path.classification,
        claimIds: [claimId],
        steps: path.steps.map((step) => ({
          source: step.fromNodeId,
          edgeType: step.edgeType,
          target: step.toNodeId,
          direction: step.direction,
          ...(step.evidenceId === undefined
            ? {}
            : { evidenceId: step.evidenceId }),
          ...(step.provenance === undefined
            ? {}
            : { provenance: step.provenance }),
          confidence:
            step.classification === "observed" ? "exact" : "heuristic",
        })),
        ...(traced?.classification === "unknown_boundary" ||
        path.classification === "unknown_boundary"
          ? {
              boundaryReason:
                [
                  ...path.reasons,
                  ...(traced?.boundaries.map(
                    (boundary) => boundary.message,
                  ) ?? []),
                ].join("; ") ||
                "Impact traversal reached an explicit unknown boundary.",
            }
          : {}),
        ...(truncation === undefined ? {} : { truncatedAt: truncation }),
      }),
    );
  }
  const impactIdsByStart = new Map<string, string[]>();
  for (const path of impactPaths) {
    const current = impactIdsByStart.get(path.sourceNodeId) ?? [];
    current.push(path.id);
    impactIdsByStart.set(path.sourceNodeId, current);
  }

  const readingPath = verifiedCandidates
    .map((candidate, index) => ({
      id: stableId("reading", {
        taskId: input.taskId,
        nodeId: candidate.nodeId,
      }),
      order: index,
      kind:
        candidate.node.type === "file" ? ("file" as const) : ("symbol" as const),
      filePath: candidateFilePaths.get(candidate.nodeId)!,
      ...(candidate.node.type === "file"
        ? {}
        : { symbolId: candidate.nodeId }),
      claimIds: [recommendationByNode.get(candidate.nodeId)!],
      evidenceIds: [evidenceByNode.get(candidate.nodeId)!],
    }));
  const plannedChanges = verifiedCandidates
    .map((candidate) => {
      const level = candidateLevel(
        candidate.rank,
        candidateFilePaths.get(candidate.nodeId)!,
        candidate.freshConclusion,
      );
      const expectation = plannedChangeExpectation(level);
      const filePath = candidateFilePaths.get(candidate.nodeId)!;
      const symbolId = candidate.node.type === "file"
        ? undefined
        : candidate.nodeId;
      const intent =
        `Inspect and, if confirmed, update ${candidate.node.name} for the requested task.`;
      const claimIds = [recommendationByNode.get(candidate.nodeId)!];
      const impactPathIds = impactIdsByStart.get(candidate.nodeId) ?? [];
      const intentDigest = sha256CanonicalJson([
        "planned-change-intent-v1",
        { intent },
      ]);
      return {
        id: input.contextGenerationId === undefined
          ? stableId("planned-change", {
              taskId: input.taskId,
              nodeId: candidate.nodeId,
            })
          : stableId("planned-change", [
              "planned-change-v1",
              {
                taskId: input.taskId,
                contextGenerationId: input.contextGenerationId,
                filePath,
                ...(symbolId === undefined ? {} : { symbolId }),
                expectation,
                intentDigest,
                claimIds,
                impactPathIds,
              },
            ]),
        expectation,
        candidateLevel: level,
        filePath,
        ...(symbolId === undefined ? {} : { symbolId }),
        intent,
        claimIds,
        impactPathIds,
      };
    });

  const brief = TaskBriefV1Schema.parse({
    ...(input.contextGenerationId === undefined
      ? {}
      : { contextGenerationId: input.contextGenerationId }),
    originalIntent: input.intent,
    goalClaimId,
    nonGoalClaimIds: [],
    acceptanceClaimIds: [acceptanceClaimId],
    readingPath,
    plannedChanges,
    assumptionClaimIds: [assumptionClaimId],
    riskClaimIds,
    unknownClaimIds,
    verificationPlan: [
      {
        id: input.contextGenerationId === undefined
          ? stableId("verification-plan", {
              taskId: input.taskId,
              acceptanceClaimId,
            })
          : stableId("verification-plan", [
              "verification-plan-v1",
              {
                taskId: input.taskId,
                contextGenerationId: input.contextGenerationId,
                acceptanceClaimIds: [acceptanceClaimId],
                method: "test",
                required: true,
              },
            ]),
        acceptanceClaimIds: [acceptanceClaimId],
        method: "test",
        description:
          "Run the repository test/build checks that cover the confirmed change.",
        required: true,
      },
    ],
  });
  return { brief, claims, evidence, impactPaths };
}
