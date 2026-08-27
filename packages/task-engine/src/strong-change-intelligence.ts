import {
  ActualChangeV1Schema,
  AnalysisBoundaryV1Schema,
  ChangeCheckAnalysisV1Schema,
  CompletenessDimensionV1Schema,
  DiffHunkEvidenceV1Schema,
  EvidenceBackedChangeCheckV1Schema,
  StrongChangeCheckCommitEvidenceV1Schema,
  StrongChangeCheckCommitRequestV1Schema,
  StrongChangeCheckMutationOutcomeV1Schema,
  StrongChangeCheckPreparationV1Schema,
  StrongChangeFindingV1Schema,
  StrongCheckChangesInputV1Schema,
  StrongFindingClaimV1Schema,
  StrongRecordVerificationInputV1Schema,
  StrongVerificationCommitEvidenceV1Schema,
  StrongVerificationCommitRequestV1Schema,
  StrongVerificationMutationOutcomeV1Schema,
  StrongVerificationPreparationV1Schema,
  StrongVerificationRecordV1Schema,
  StructuredAnalysisBoundaryEvidenceV1Schema,
  canonicalizeJson,
  type ActualChangeV1,
  type AnalysisBoundaryV1,
  type AnalysisStatusV1,
  type ConfirmedObligationProjectionV1,
  type DiffHunkEvidenceV1,
  type DiffHunkV1,
  type EvidenceBackedChangeCheckV1,
  type StrongAnalyzedHunkV1,
  type StrongChangeCheckMutationOutcomeV1,
  type StrongChangeCheckPreparationV1,
  type StrongChangeFindingV1,
  type StrongChangeIntelligenceAuthorityV1,
  type StrongCheckChangesInputV1,
  type StrongFindingClaimV1,
  type StrongRecordVerificationInputV1,
  type StrongVerificationMutationOutcomeV1,
  type StrongVerificationPreparationV1,
  type StrongVerificationRecordV1,
  type StrongVerificationSecurityProjectionV1,
  type SourceSymbolRefV1,
  type StructuredAnalysisBoundaryEvidenceV1,
} from "@understand-code/contracts";

import { TaskEngineError } from "./errors.js";
import { sha256CanonicalJson, stableId } from "./ids.js";

type StrongEvidence =
  | DiffHunkEvidenceV1
  | StructuredAnalysisBoundaryEvidenceV1;

type StrongPathDelta =
  StrongChangeCheckPreparationV1["repositoryDelta"]["paths"][number];
type StrongDeltaSegment = StrongPathDelta["segments"][number];
type StrongEffectiveChange = NonNullable<StrongPathDelta["effectiveChange"]>;

const STATUS_RANK: Readonly<Record<AnalysisStatusV1, number>> = {
  complete: 0,
  partial: 1,
  unknown: 2,
};

const SOURCE_RANK = new Map(
  [
    "baseline_reconciliation",
    "committed",
    "staged",
    "unstaged",
    "untracked",
    "conflict",
  ].map((source, index) => [source, index]),
);

const FINDING_RANK = new Map(
  [
    "planned_completed",
    "planned_partial",
    "unplanned_change",
    "possible_omission",
    "verification_gap",
    "cannot_determine",
  ].map((type, index) => [type, index]),
);

function compareUtf8Bytes(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function worstStatus(values: readonly AnalysisStatusV1[]): AnalysisStatusV1 {
  return values.reduce<AnalysisStatusV1>(
    (worst, current) =>
      STATUS_RANK[current] > STATUS_RANK[worst] ? current : worst,
    "complete",
  );
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUtf8Bytes);
}

function sortedUniqueSources(
  values: readonly ActualChangeV1["sourceLayers"][number][],
): ActualChangeV1["sourceLayers"] {
  return [...new Set(values)].sort(
    (left, right) =>
      (SOURCE_RANK.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (SOURCE_RANK.get(right) ?? Number.MAX_SAFE_INTEGER),
  );
}

function exactEqual(left: unknown, right: unknown): boolean {
  if (left === undefined || right === undefined) return left === right;
  return canonicalizeJson(left) === canonicalizeJson(right);
}

function invalidAuthority(reason: string): never {
  throw new TaskEngineError(
    "artifact_unavailable",
    "Strong Change Intelligence authority returned an invalid projection.",
    { reason },
  );
}

type StrongReservedOperationAbortV1 = Parameters<
  NonNullable<StrongChangeIntelligenceAuthorityV1["abortReservedOperation"]>
>[0];

async function prepareReservedStrongOperationV1<T>(
  authority: StrongChangeIntelligenceAuthorityV1,
  reservedByAuthority: boolean,
  abortInput: StrongReservedOperationAbortV1,
  prepare: () => Promise<T>,
): Promise<T> {
  try {
    return await prepare();
  } catch (error) {
    if (reservedByAuthority) {
      await authority.abortReservedOperation?.(abortInput);
    }
    throw error;
  }
}

export function deriveStrongBoundaryIdV1(
  boundary: Omit<AnalysisBoundaryV1, "id">,
): string {
  return stableId("analysis-boundary", [
    "analysis-boundary-v1",
    boundary,
  ]);
}

export function deriveStrongRepositoryDeltaSegmentIdV1(input: Readonly<{
  baselineSnapshotId: string;
  actualSnapshotId: string;
  path: string;
  source: StrongDeltaSegment["source"];
  before: StrongDeltaSegment["before"];
  after: StrongDeltaSegment["after"];
}>): string {
  return stableId("repository-delta-segment", [
    "repository-delta-segment-v1",
    {
      baselineSnapshotId: input.baselineSnapshotId,
      actualSnapshotId: input.actualSnapshotId,
      path: input.path,
      source: input.source,
      before: input.before,
      after: input.after,
    },
  ]);
}

export function deriveStrongEffectiveRepositoryChangeIdV1(input: Readonly<{
  baselineSnapshotId: string;
  actualSnapshotId: string;
  path: string;
  oldPath?: string;
  kind: StrongEffectiveChange["kind"];
  before: StrongEffectiveChange["before"];
  after: StrongEffectiveChange["after"];
  sourceSegmentIds: readonly string[];
}>): string {
  return stableId("repository-effective-change", [
    "repository-effective-change-v1",
    {
      baselineSnapshotId: input.baselineSnapshotId,
      actualSnapshotId: input.actualSnapshotId,
      path: input.path,
      ...(input.oldPath === undefined ? {} : { oldPath: input.oldPath }),
      kind: input.kind,
      before: input.before,
      after: input.after,
      sourceSegmentIds: input.sourceSegmentIds,
    },
  ]);
}

export function deriveStrongRepositoryPathDeltaIdV1(input: Readonly<{
  baselineSnapshotId: string;
  actualSnapshotId: string;
  path: string;
  oldPath?: string;
  segmentIds: readonly string[];
  effectiveChangeId?: string;
}>): string {
  return stableId("repository-path-delta", [
    "repository-path-delta-v1",
    {
      baselineSnapshotId: input.baselineSnapshotId,
      actualSnapshotId: input.actualSnapshotId,
      path: input.path,
      ...(input.oldPath === undefined ? {} : { oldPath: input.oldPath }),
      segmentIds: input.segmentIds,
      ...(input.effectiveChangeId === undefined
        ? {}
        : { effectiveChangeId: input.effectiveChangeId }),
    },
  ]);
}

export function deriveStrongDiffHunkIdentityV1(
  hunk: Omit<DiffHunkV1, "id" | "operationsDigest" | "patchDigest">,
): Readonly<{ id: string; operationsDigest: string; patchDigest: string }> {
  const operationsDigest = sha256CanonicalJson([
    "diff-operations-v1",
    hunk.operations,
  ]);
  const patchDigest = sha256CanonicalJson([
    "diff-hunk-patch-v1",
    {
      algorithm: hunk.algorithm,
      baselineSnapshotId: hunk.baselineSnapshotId,
      actualSnapshotId: hunk.actualSnapshotId,
      path: hunk.path,
      ...(hunk.oldPath === undefined ? {} : { oldPath: hunk.oldPath }),
      beforeContent: hunk.beforeContent,
      afterContent: hunk.afterContent,
      oldSpan: hunk.oldSpan,
      newSpan: hunk.newSpan,
      sourceLayers: hunk.sourceLayers,
      operationsDigest,
    },
  ]);
  return {
    operationsDigest,
    patchDigest,
    id: stableId("diff-hunk", ["diff-hunk-id-v1", { patchDigest }]),
  };
}

export function deriveStrongSourceSymbolRefIdV1(
  symbol: Omit<SourceSymbolRefV1, "id">,
): string {
  return stableId("source-symbol-ref", [
    "source-symbol-ref-v1",
    {
      snapshotId: symbol.snapshotId,
      path: symbol.path,
      language: symbol.language,
      parserVersion: symbol.parserVersion,
      kind: symbol.kind,
      qualifiedName: symbol.qualifiedName,
      ...(symbol.parentId === undefined ? {} : { parentId: symbol.parentId }),
      fullSpan: symbol.fullSpan,
      signatureSpan: symbol.signatureSpan,
      ...(symbol.bodySpan === undefined ? {} : { bodySpan: symbol.bodySpan }),
      declarationDigest: symbol.declarationDigest,
    },
  ]);
}

export function deriveStrongActualChangeIdV1(input: Readonly<{
  baselineSnapshotId: string;
  actualSnapshotId: string;
  repositoryPathDeltaId: string;
  effectiveChangeId: string;
  diffHunkIds: readonly string[];
  granularity: ActualChangeV1["granularity"];
}>): string {
  return stableId("actual-change", ["actual-change-v1", input]);
}

export function deriveStrongFindingIdV1(input: Readonly<{
  taskId: string;
  baselineSnapshotId: string;
  actualSnapshotId: string;
  type: StrongChangeFindingV1["type"];
  plannedChangeIds: readonly string[];
  actualChangeIds: readonly string[];
  claimIds: readonly string[];
  evidenceIds: readonly string[];
  impactPathIds: readonly string[];
  verificationGap?: StrongChangeFindingV1["verificationGap"];
}>): string {
  return stableId("change-finding", [
    "change-finding-v1",
    {
      taskId: input.taskId,
      baselineSnapshotId: input.baselineSnapshotId,
      actualSnapshotId: input.actualSnapshotId,
      type: input.type,
      plannedChangeIds: input.plannedChangeIds,
      actualChangeIds: input.actualChangeIds,
      claimIds: input.claimIds,
      evidenceIds: input.evidenceIds,
      impactPathIds: input.impactPathIds,
      ...(input.verificationGap === undefined
        ? {}
        : { verificationGap: input.verificationGap }),
    },
  ]);
}

export function deriveStrongVerificationRecordIdV1(input: Readonly<
  Pick<
    StrongVerificationRecordV1,
    | "taskId"
    | "contextGenerationId"
    | "snapshotId"
    | "changeCheckContentDigest"
    | "verificationPlanEntryId"
    | "attempt"
    | "method"
    | "status"
    | "claimIds"
    | "publicResultCode"
    | "detail"
  > & { supersedesVerificationRecordId?: string }
    & { ownerOnlyDetailCommitment?: string }
>): string {
  return stableId("verification-record", [
    "verification-record-v1",
    {
      taskId: input.taskId,
      contextGenerationId: input.contextGenerationId,
      snapshotId: input.snapshotId,
      changeCheckContentDigest: input.changeCheckContentDigest,
      verificationPlanEntryId: input.verificationPlanEntryId,
      attempt: input.attempt,
      ...(input.supersedesVerificationRecordId === undefined
        ? {}
        : {
            supersedesVerificationRecordId:
              input.supersedesVerificationRecordId,
          }),
      method: input.method,
      status: input.status,
      claimIds: input.claimIds,
      publicResultCode: input.publicResultCode,
      detail: input.detail,
      ...(input.ownerOnlyDetailCommitment === undefined
        ? {}
        : { ownerOnlyDetailCommitment: input.ownerOnlyDetailCommitment }),
    },
  ]);
}

function assertStrongPreparationIdentityV1(
  preparation: StrongChangeCheckPreparationV1,
): void {
  for (const boundary of preparation.boundaries) {
    const { id: _id, ...fields } = boundary;
    if (boundary.id !== deriveStrongBoundaryIdV1(fields)) {
      invalidAuthority("boundary_identity_mismatch");
    }
  }

  const boundaryIds = new Set(
    preparation.boundaries.map((boundary) => boundary.id),
  );
  const baselineSnapshotId = preparation.baselineSnapshot.snapshotId;
  const actualSnapshotId = preparation.actualSnapshot.snapshotId;
  for (const pathDelta of preparation.repositoryDelta.paths) {
    for (const segment of pathDelta.segments) {
      const expected = deriveStrongRepositoryDeltaSegmentIdV1({
        baselineSnapshotId,
        actualSnapshotId,
        path: pathDelta.path,
        source: segment.source,
        before: segment.before,
        after: segment.after,
      });
      if (segment.id !== expected) {
        invalidAuthority("repository_delta_segment_identity_mismatch");
      }
      if (segment.boundaryIds.some((id) => !boundaryIds.has(id))) {
        invalidAuthority("repository_delta_boundary_dangling");
      }
    }
    const effective = pathDelta.effectiveChange;
    if (effective !== undefined) {
      const expected = deriveStrongEffectiveRepositoryChangeIdV1({
        baselineSnapshotId,
        actualSnapshotId,
        path: pathDelta.path,
        ...(pathDelta.oldPath === undefined
          ? {}
          : { oldPath: pathDelta.oldPath }),
        kind: effective.kind,
        before: effective.before,
        after: effective.after,
        sourceSegmentIds: effective.sourceSegmentIds,
      });
      if (effective.id !== expected) {
        invalidAuthority("repository_effective_change_identity_mismatch");
      }
    }
    const expectedPathId = deriveStrongRepositoryPathDeltaIdV1({
      baselineSnapshotId,
      actualSnapshotId,
      path: pathDelta.path,
      ...(pathDelta.oldPath === undefined
        ? {}
        : { oldPath: pathDelta.oldPath }),
      segmentIds: pathDelta.segments.map((segment) => segment.id),
      ...(effective === undefined
        ? {}
        : { effectiveChangeId: effective.id }),
    });
    if (pathDelta.id !== expectedPathId) {
      invalidAuthority("repository_path_delta_identity_mismatch");
    }
  }

  for (const analyzed of preparation.analyzedHunks) {
    const hunk = analyzed.hunk;
    const {
      id: expectedHunkId,
      operationsDigest,
      patchDigest,
    } = deriveStrongDiffHunkIdentityV1(hunk);
    if (hunk.operationsDigest !== operationsDigest) {
      invalidAuthority("diff_operations_digest_mismatch");
    }
    if (
      hunk.patchDigest !== patchDigest ||
      hunk.id !== expectedHunkId
    ) {
      invalidAuthority("diff_hunk_identity_mismatch");
    }
    for (const symbol of [
      ...analyzed.oldSymbolRefs,
      ...analyzed.newSymbolRefs,
    ]) {
      if (
        symbol.id !== deriveStrongSourceSymbolRefIdV1(symbol)
      ) {
        invalidAuthority("source_symbol_identity_mismatch");
      }
    }
    if (
      analyzed.boundaryIds.some((id) => !boundaryIds.has(id)) ||
      hunk.baselineSnapshotId !== baselineSnapshotId ||
      hunk.actualSnapshotId !== actualSnapshotId
    ) {
      invalidAuthority("hunk_authority_pin_mismatch");
    }
  }
}

function diffEvidenceId(
  taskId: string,
  actualSnapshotId: string,
  analyzed: StrongAnalyzedHunkV1,
): string {
  const nodeIds = sortedUnique(
    [...analyzed.oldSymbolRefs, ...analyzed.newSymbolRefs]
      .map((symbol) => symbol.graphNodeId)
      .filter((id): id is string => id !== undefined),
  );
  return stableId("diff-evidence", [
    "diff-evidence-v1",
    {
      taskId,
      observedAtSnapshotId: actualSnapshotId,
      hunkId: analyzed.hunk.id,
      claimIds: [],
      nodeIds,
    },
  ]);
}

function boundaryEvidenceId(
  taskId: string,
  actualSnapshotId: string,
  boundary: AnalysisBoundaryV1,
): string {
  return stableId("boundary-evidence", [
    "boundary-evidence-v1",
    {
      taskId,
      observedAtSnapshotId: actualSnapshotId,
      boundaryId: boundary.id,
      claimIds: [],
      nodeIds: [],
    },
  ]);
}

interface ActualDraft {
  readonly id: string;
  readonly pathDelta: StrongChangeCheckPreparationV1["repositoryDelta"]["paths"][number];
  readonly boundaryIds: string[];
  readonly diffEvidenceIds: string[];
  readonly oldSymbolRefs: StrongAnalyzedHunkV1["oldSymbolRefs"];
  readonly newSymbolRefs: StrongAnalyzedHunkV1["newSymbolRefs"];
  readonly pairingStatus: ActualChangeV1["pairingStatus"];
  readonly semanticFacets: ActualChangeV1["semanticFacets"];
  status: AnalysisStatusV1;
  readonly granularity: ActualChangeV1["granularity"];
  readonly hunkIds: string[];
}

function buildActualDrafts(
  preparation: StrongChangeCheckPreparationV1,
): ActualDraft[] {
  const drafts: ActualDraft[] = [];
  const hunksByPath = new Map<string, StrongAnalyzedHunkV1[]>();
  for (const analyzed of preparation.analyzedHunks) {
    const values = hunksByPath.get(analyzed.hunk.path) ?? [];
    values.push(analyzed);
    hunksByPath.set(analyzed.hunk.path, values);
  }
  for (const pathDelta of preparation.repositoryDelta.paths) {
    const effective = pathDelta.effectiveChange;
    if (effective === undefined) continue;
    const analyzedHunks = [...(hunksByPath.get(pathDelta.path) ?? [])].sort(
      (left, right) =>
        left.hunk.oldSpan.startLine - right.hunk.oldSpan.startLine ||
        left.hunk.newSpan.startLine - right.hunk.newSpan.startLine ||
        compareUtf8Bytes(left.hunk.id, right.hunk.id),
    );
    for (const analyzed of analyzedHunks) {
      if (
        analyzed.hunk.oldPath !== pathDelta.oldPath ||
        analyzed.hunk.beforeContent.status !== effective.before.status ||
        analyzed.hunk.afterContent.status !== effective.after.status
      ) {
        invalidAuthority("hunk_path_delta_mismatch");
      }
      if (
        analyzed.hunk.beforeContent.status === "content" &&
        (effective.before.status !== "content" ||
          analyzed.hunk.beforeContent.contentDigest !==
            effective.before.contentDigest)
      ) {
        invalidAuthority("hunk_before_content_mismatch");
      }
      if (
        analyzed.hunk.afterContent.status === "content" &&
        (effective.after.status !== "content" ||
          analyzed.hunk.afterContent.contentDigest !==
            effective.after.contentDigest)
      ) {
        invalidAuthority("hunk_after_content_mismatch");
      }
    }

    const clusters = new Map<string, StrongAnalyzedHunkV1[]>();
    for (const analyzed of analyzedHunks) {
      const oldIds = analyzed.oldSymbolRefs.map((symbol) => symbol.id).sort(compareUtf8Bytes);
      const newIds = analyzed.newSymbolRefs.map((symbol) => symbol.id).sort(compareUtf8Bytes);
      const clusterKey = oldIds.length + newIds.length === 0
        ? "hunk-cluster:file"
        : canonicalizeJson(["hunk-cluster:symbol-v1", {
            oldSymbolRefIds: oldIds,
            newSymbolRefIds: newIds,
            pairingStatus: analyzed.pairingStatus,
          }]);
      const cluster = clusters.get(clusterKey) ?? [];
      cluster.push(analyzed);
      clusters.set(clusterKey, cluster);
    }

    for (const cluster of clusters.values()) {
      const hunkIds = cluster.map((analyzed) => analyzed.hunk.id);
      const oldSymbolRefs = [...new Map(
        cluster.flatMap((analyzed) => analyzed.oldSymbolRefs).map((symbol) => [symbol.id, symbol]),
      ).values()].sort((left, right) => compareUtf8Bytes(left.id, right.id));
      const newSymbolRefs = [...new Map(
        cluster.flatMap((analyzed) => analyzed.newSymbolRefs).map((symbol) => [symbol.id, symbol]),
      ).values()].sort((left, right) => compareUtf8Bytes(left.id, right.id));
      const granularity = oldSymbolRefs.length + newSymbolRefs.length > 0 ? "symbol" : "hunk";
      const pairingStatuses = new Set(cluster.map((analyzed) => analyzed.pairingStatus));
      if (pairingStatuses.size !== 1) invalidAuthority("hunk_cluster_pairing_mismatch");
      const pairingStatus = cluster[0]!.pairingStatus;
      const facetOrder = [
        "BODY_LOGIC", "SIGNATURE", "DEPENDENCY", "TOPOLOGY", "TEST",
        "CONFIG", "SCHEMA", "DOCUMENTATION", "FORMATTING_OR_COMMENT", "UNKNOWN",
      ] as const;
      const semanticFacets = [...new Set(cluster.flatMap((analyzed) => analyzed.semanticFacets))]
        .sort((left, right) => facetOrder.indexOf(left) - facetOrder.indexOf(right));
      const id = deriveStrongActualChangeIdV1({
        baselineSnapshotId: preparation.baselineSnapshot.snapshotId,
        actualSnapshotId: preparation.actualSnapshot.snapshotId,
        repositoryPathDeltaId: pathDelta.id,
        effectiveChangeId: effective.id,
        diffHunkIds: hunkIds,
        granularity,
      });
      drafts.push({
        id,
        pathDelta,
        boundaryIds: sortedUnique([
          ...effective.boundaryIds,
          ...cluster.flatMap((analyzed) => analyzed.boundaryIds),
        ]),
        diffEvidenceIds: cluster.map((analyzed) =>
          diffEvidenceId(
            preparation.task.manifest.taskId,
            preparation.actualSnapshot.snapshotId,
            analyzed,
          ),
        ),
        oldSymbolRefs,
        newSymbolRefs,
        pairingStatus,
        semanticFacets,
        status: worstStatus([effective.status, ...cluster.map((analyzed) => analyzed.status)]),
        granularity,
        hunkIds,
      });
    }
    if (analyzedHunks.length === 0) {
      const id = deriveStrongActualChangeIdV1({
          baselineSnapshotId: preparation.baselineSnapshot.snapshotId,
          actualSnapshotId: preparation.actualSnapshot.snapshotId,
          repositoryPathDeltaId: pathDelta.id,
          effectiveChangeId: effective.id,
          diffHunkIds: [],
          granularity: "file",
      });
      drafts.push({
        id,
        pathDelta,
        boundaryIds: [...effective.boundaryIds],
        diffEvidenceIds: [],
        oldSymbolRefs: [],
        newSymbolRefs: [],
        pairingStatus: "file_only",
        semanticFacets: ["TOPOLOGY"],
        status: effective.status,
        granularity: "file",
        hunkIds: [],
      });
    }
  }
  return drafts.sort((left, right) =>
    compareUtf8Bytes(left.pathDelta.path, right.pathDelta.path) ||
    compareUtf8Bytes(left.id, right.id),
  );
}

function obligationMatchesActual(
  obligation: ConfirmedObligationProjectionV1,
  draft: ActualDraft,
): boolean {
  if (obligation.filePath !== draft.pathDelta.path) return false;
  if (obligation.symbolId === undefined) return true;
  return [...draft.oldSymbolRefs, ...draft.newSymbolRefs].some(
    (symbol) => symbol.graphNodeId === obligation.symbolId,
  );
}

interface FindingDraft {
  type: StrongChangeFindingV1["type"];
  severity: StrongChangeFindingV1["severity"];
  blocking: boolean;
  summary: string;
  plannedChangeIds: string[];
  actualIds: string[];
  baseClaimIds: string[];
  evidenceIds: string[];
  impactPathIds: string[];
  verificationGap?: StrongChangeFindingV1["verificationGap"];
}

function boundaryForAmbiguousMatch(
  _taskId: string,
  path: string,
  _actualId: string,
): AnalysisBoundaryV1 {
  const fields = {
    stage: "planned_matching" as const,
    code: "ambiguous_symbol" as const,
    scope: { kind: "path" as const, path },
    recovery: "manual_inspection" as const,
  };
  return AnalysisBoundaryV1Schema.parse({
    ...fields,
    id: deriveStrongBoundaryIdV1({
      ...fields,
      scope: fields.scope,
    }),
  });
}

function deterministicBoundary(fields: Omit<AnalysisBoundaryV1, "id">): AnalysisBoundaryV1 {
  return AnalysisBoundaryV1Schema.parse({
    ...fields,
    id: deriveStrongBoundaryIdV1(fields),
  });
}

function actualFromDraft(
  draft: ActualDraft,
  boundaryEvidenceById: ReadonlyMap<string, string>,
): ActualChangeV1 {
  const effective = draft.pathDelta.effectiveChange;
  if (effective === undefined) invalidAuthority("missing_effective_change");
  const sourceBySegment = new Map(
    draft.pathDelta.segments.map((segment) => [segment.id, segment.source]),
  );
  return ActualChangeV1Schema.parse({
    id: draft.id,
    repositoryPathDeltaId: draft.pathDelta.id,
    effectiveChangeId: effective.id,
    path: draft.pathDelta.path,
    ...(draft.pathDelta.oldPath === undefined
      ? {}
      : { oldPath: draft.pathDelta.oldPath }),
    kind: effective.kind,
    sourceLayers: sortedUniqueSources(
      effective.sourceSegmentIds.map((id) => sourceBySegment.get(id)!),
    ),
    granularity: draft.granularity,
    oldSymbolRefs: draft.oldSymbolRefs,
    newSymbolRefs: draft.newSymbolRefs,
    pairingStatus: draft.pairingStatus,
    semanticFacets: draft.semanticFacets,
    diffEvidenceIds: draft.diffEvidenceIds,
    boundaryEvidenceIds: sortedUnique(
      draft.boundaryIds.map((id) => boundaryEvidenceById.get(id)!),
    ),
    analysisStatus: draft.status,
  });
}

function requestDigestForCheck(input: StrongCheckChangesInputV1): string {
  return sha256CanonicalJson([
    "operation-safe-request-v1",
    {
      version: "operation-safe-request-v1",
      operation: "check_change",
      actor: input.actor,
      expectedRevision: input.expectedRevision,
      snapshotAssertions: { actualSnapshotId: input.actualSnapshotId },
      safeInput: { taskId: input.taskId, includeWorktree: true },
    },
  ]);
}

function dimension(
  name:
    | "repository_delta"
    | "semantic_classification"
    | "planned_matching"
    | "impact_analysis"
    | "verification_coverage",
  units: Array<{
    unitKind: "repository_path_delta" | "redacted_repository_aggregate" | "actual_change" | "required_planned_change" | "acceptance_claim";
    unitId: string;
    status: AnalysisStatusV1;
    boundaryEvidenceIds: string[];
  }>,
  dimensionBoundaryIds: readonly string[],
  boundaryEvidenceById: ReadonlyMap<string, string>,
) {
  const boundaryEvidenceIds = sortedUnique(
    dimensionBoundaryIds.map((id) => boundaryEvidenceById.get(id)!),
  );
  return CompletenessDimensionV1Schema.parse({
    dimension: name,
    status: worstStatus([
      ...units.map((unit) => unit.status),
      ...(boundaryEvidenceIds.length === 0 ? [] : ["unknown" as const]),
    ]),
    units,
    boundaryEvidenceIds,
  });
}

export async function executeStrongChangeCheckV1(
  authority: StrongChangeIntelligenceAuthorityV1 | undefined,
  inputValue: StrongCheckChangesInputV1,
  clock: () => Date,
): Promise<StrongChangeCheckMutationOutcomeV1> {
  if (authority === undefined) {
    throw new TaskEngineError(
      "capability_unavailable",
      "Strong Change Intelligence requires a real Provider authority.",
      { reason: "strong_write_locked" },
    );
  }
  const input = StrongCheckChangesInputV1Schema.parse(inputValue);
  const requestDigest = requestDigestForCheck(input);
  const replay = await authority.replayCheck?.(input, requestDigest);
  if (replay !== undefined) {
    return StrongChangeCheckMutationOutcomeV1Schema.parse({
      ...replay,
      idempotentReplay: true,
    });
  }
  const reserveOperationTime = authority.reserveOperationTime;
  const reservedByAuthority = reserveOperationTime !== undefined;
  const occurredAt = reserveOperationTime === undefined
    ? clock().toISOString()
    : await reserveOperationTime.call(
        authority,
        {
          taskId: input.taskId,
          expectedRevision: input.expectedRevision,
          operation: "check_change",
          idempotencyKey: input.idempotencyKey,
          actor: input.actor,
          requestDigest,
        },
        clock().toISOString(),
      );
  return prepareReservedStrongOperationV1(
    authority,
    reservedByAuthority,
    {
      taskId: input.taskId,
      expectedRevision: input.expectedRevision,
      operation: "check_change",
      idempotencyKey: input.idempotencyKey,
      actor: input.actor,
      requestDigest,
    },
    async () => {
  const preparation = StrongChangeCheckPreparationV1Schema.parse(
    await authority.prepareCheck(input),
  );
  if (
    preparation.task.manifest.taskId !== input.taskId ||
    preparation.task.manifest.revision !== input.expectedRevision ||
    preparation.task.manifest.status !== "check_required" ||
    preparation.actualSnapshot.snapshotId !== input.actualSnapshotId
  ) {
    invalidAuthority("operation_authority_pin_mismatch");
  }
  assertStrongPreparationIdentityV1(preparation);

  const taskId = input.taskId;
  const actualSnapshotId = preparation.actualSnapshot.snapshotId;
  const boundaries = [...preparation.boundaries];
  const boundaryById = new Map(boundaries.map((boundary) => [boundary.id, boundary]));
  const actualDrafts = buildActualDrafts(preparation);
  const findingDrafts: FindingDraft[] = [];
  const matchedRequired = new Set<string>();
  const impactBoundaryByUnitId = new Map<string, string>();

  for (const draft of actualDrafts) {
    const matches = preparation.task.confirmedObligations.filter((obligation) =>
      obligationMatchesActual(obligation, draft),
    );
    if (matches.length !== 1) {
      const impactBoundary = deterministicBoundary({
        stage: "impact_analysis",
        code: "graph_incomplete",
        scope: { kind: "path", path: draft.pathDelta.path },
        recovery: "retry_after_refresh",
      });
      if (!boundaryById.has(impactBoundary.id)) {
        boundaries.push(impactBoundary);
        boundaryById.set(impactBoundary.id, impactBoundary);
      }
      impactBoundaryByUnitId.set(draft.id, impactBoundary.id);
    }
    if (matches.length > 1) {
      for (const match of matches) {
        if (match.expectation === "required_change") {
          matchedRequired.add(match.plannedChangeId);
        }
      }
      const boundary = boundaryForAmbiguousMatch(taskId, draft.pathDelta.path, draft.id);
      if (!boundaryById.has(boundary.id)) {
        boundaries.push(boundary);
        boundaryById.set(boundary.id, boundary);
      }
      draft.boundaryIds.push(boundary.id);
      draft.status = "unknown";
      findingDrafts.push({
        type: "cannot_determine",
        severity: "error",
        blocking: true,
        summary: "Change Intelligence could not choose one confirmed obligation for an Actual Change.",
        plannedChangeIds: matches.map((entry) => entry.plannedChangeId).sort(),
        actualIds: [draft.id],
        baseClaimIds: sortedUnique(matches.flatMap((entry) => entry.claimIds)),
        evidenceIds: [...draft.diffEvidenceIds],
        impactPathIds: sortedUnique(matches.flatMap((entry) => entry.impactPathIds)),
      });
      continue;
    }
    const match = matches[0];
    if (match !== undefined) {
      if (match.expectation === "required_change") {
        matchedRequired.add(match.plannedChangeId);
      }
      const existing = findingDrafts.find((candidate) =>
        (candidate.type === "planned_completed" || candidate.type === "planned_partial") &&
        candidate.plannedChangeIds.length === 1 &&
        candidate.plannedChangeIds[0] === match.plannedChangeId,
      );
      if (existing === undefined) {
        findingDrafts.push({
          type: draft.status === "complete" ? "planned_completed" : "planned_partial",
          severity: draft.status === "complete" ? "info" : "warning",
          blocking: draft.status !== "complete",
          summary: draft.status === "complete"
            ? "The Actual Changes are mapped to one confirmed Planned Change."
            : "The Actual Changes are only partially mapped to one confirmed Planned Change.",
          plannedChangeIds: [match.plannedChangeId],
          actualIds: [draft.id],
          baseClaimIds: [...match.claimIds],
          evidenceIds: [...draft.diffEvidenceIds],
          impactPathIds: [...match.impactPathIds],
        });
      } else {
        existing.actualIds.push(draft.id);
        existing.evidenceIds.push(...draft.diffEvidenceIds);
        if (draft.status !== "complete") {
          existing.type = "planned_partial";
          existing.severity = "warning";
          existing.blocking = true;
          existing.summary = "The Actual Changes are only partially mapped to one confirmed Planned Change.";
        }
      }
      continue;
    }
    const baseClaim = preparation.task.acceptanceClaimIds[0];
    if (baseClaim === undefined) invalidAuthority("acceptance_claim_unavailable");
    findingDrafts.push({
      type: draft.status === "complete" ? "unplanned_change" : "cannot_determine",
      severity: draft.status === "complete" ? "warning" : "error",
      blocking: true,
      summary: draft.status === "complete"
        ? "An Actual Change is not covered by the confirmed Plan."
        : "Change Intelligence cannot determine the disposition of a partial Actual Change.",
      plannedChangeIds: [],
      actualIds: [draft.id],
      baseClaimIds: [baseClaim],
      evidenceIds: [...draft.diffEvidenceIds],
      impactPathIds: [],
    });
  }

  const requiredObligations = preparation.task.confirmedObligations.filter(
    (entry) => entry.expectation === "required_change",
  );
  for (const obligation of requiredObligations) {
    if (matchedRequired.has(obligation.plannedChangeId)) continue;
    const relatedBoundaries = boundaries.filter(
      (boundary) =>
        boundary.scope.kind === "repository" ||
        (boundary.scope.kind === "path" &&
          boundary.scope.path === obligation.filePath) ||
        (boundary.scope.kind === "symbol" &&
          boundary.scope.symbolRefId === obligation.symbolId),
    );
    for (const boundary of relatedBoundaries) {
      impactBoundaryByUnitId.set(obligation.plannedChangeId, boundary.id);
    }
    findingDrafts.push({
      type: relatedBoundaries.length === 0 ? "possible_omission" : "cannot_determine",
      severity: "error",
      blocking: true,
      summary: relatedBoundaries.length === 0
        ? "A confirmed required change has no matching Actual Change."
        : "A repository analysis boundary prevents an omission decision.",
      plannedChangeIds: [obligation.plannedChangeId],
      actualIds: [],
      baseClaimIds: [...obligation.claimIds],
      evidenceIds: relatedBoundaries.map((boundary) =>
        boundaryEvidenceId(taskId, actualSnapshotId, boundary),
      ),
      impactPathIds: [...obligation.impactPathIds],
    });
  }

  const coveredClaims = new Set(
    preparation.task.verificationPlan.flatMap((entry) => entry.acceptanceClaimIds),
  );
  const uncoveredClaims = preparation.task.acceptanceClaimIds.filter(
    (claimId) => !coveredClaims.has(claimId),
  );
  if (uncoveredClaims.length > 0) {
    const coverageBoundary = deterministicBoundary({
      stage: "verification_coverage",
      code: "policy_error",
      scope: { kind: "claim", claimId: uncoveredClaims[0]! },
      recovery: "manual_inspection",
    });
    if (!boundaryById.has(coverageBoundary.id)) {
      boundaries.push(coverageBoundary);
      boundaryById.set(coverageBoundary.id, coverageBoundary);
    }
    findingDrafts.push({
      type: "verification_gap",
      severity: "error",
      blocking: true,
      summary: "One or more acceptance Claims have no Verification Plan entry.",
      plannedChangeIds: [],
      actualIds: [],
      baseClaimIds: [...uncoveredClaims],
      evidenceIds: [boundaryEvidenceId(taskId, actualSnapshotId, coverageBoundary)],
      impactPathIds: [],
      verificationGap: {
        subtype: "missing_plan_entry",
        uncoveredClaimIds: uncoveredClaims,
        verificationPlanEntryIds: [],
        boundaryEvidenceIds: [],
      },
    });
  }

  const boundaryEvidenceById = new Map<string, string>();
  const evidence: StrongEvidence[] = [];
  for (const analyzed of preparation.analyzedHunks) {
    const nodeIds = sortedUnique(
      [...analyzed.oldSymbolRefs, ...analyzed.newSymbolRefs]
        .map((symbol) => symbol.graphNodeId)
        .filter((id): id is string => id !== undefined),
    );
    evidence.push(DiffHunkEvidenceV1Schema.parse({
      id: diffEvidenceId(taskId, actualSnapshotId, analyzed),
      profile: "evidence_backed_v1",
      kind: "diff_hunk",
      epistemicStatus: "observed",
      freshness: "current",
      claimIds: [],
      nodeIds,
      producedBy: "task-engine/strong-change-intelligence-v1",
      createdAt: occurredAt,
      observedAtSnapshotId: actualSnapshotId,
      filePath: analyzed.hunk.path,
      hunk: analyzed.hunk,
    }));
  }
  for (const boundary of boundaries) {
    const id = boundaryEvidenceId(taskId, actualSnapshotId, boundary);
    boundaryEvidenceById.set(boundary.id, id);
    evidence.push(StructuredAnalysisBoundaryEvidenceV1Schema.parse({
      id,
      profile: "evidence_backed_v1",
      kind: "analysis_boundary",
      epistemicStatus: "unknown",
      freshness: "current",
      claimIds: [],
      nodeIds: [],
      producedBy: "task-engine/strong-change-intelligence-v1",
      createdAt: occurredAt,
      observedAtSnapshotId: actualSnapshotId,
      boundary,
    }));
  }
  const actualChanges = actualDrafts.map((draft) =>
    actualFromDraft(draft, boundaryEvidenceById),
  );
  const actualById = new Map<string, ActualChangeV1>(
    actualChanges.map((actual) => [actual.id, actual]),
  );

  const findings: StrongChangeFindingV1[] = [];
  const findingClaims: StrongFindingClaimV1[] = [];
  for (const draft of findingDrafts) {
    const actualEvidenceIds = draft.actualIds.flatMap((id) => {
      const actual = actualById.get(id);
      return actual === undefined
        ? []
        : [...actual.diffEvidenceIds, ...actual.boundaryEvidenceIds];
    });
    const evidenceIds = sortedUnique([
      ...draft.evidenceIds,
      ...actualEvidenceIds,
    ]);
    if (draft.type === "cannot_determine" && !evidenceIds.some((id) => id.startsWith("boundary-evidence:"))) {
      const actual = draft.actualIds.map((id) => actualDrafts.find((entry) => entry.id === id)).find((entry) => entry !== undefined);
      if (actual !== undefined) {
        const boundary = boundaryForAmbiguousMatch(taskId, actual.pathDelta.path, actual.id);
        const boundaryEvidence = boundaryEvidenceById.get(boundary.id);
        if (boundaryEvidence !== undefined) evidenceIds.push(boundaryEvidence);
      }
    }
    const claimId = stableId("claim:finding", [
      "strong-finding-claim-v1",
      {
        taskId,
        baselineSnapshotId: preparation.baselineSnapshot.snapshotId,
        actualSnapshotId,
        type: draft.type,
        plannedChangeIds: draft.plannedChangeIds,
        actualChangeIds: draft.actualIds,
      },
    ]);
    const claimIds = sortedUnique([...draft.baseClaimIds, claimId]);
    const findingFields = {
      taskId,
      baselineSnapshotId: preparation.baselineSnapshot.snapshotId,
      actualSnapshotId,
      type: draft.type,
      plannedChangeIds: sortedUnique(draft.plannedChangeIds),
      actualChangeIds: sortedUnique(draft.actualIds),
      claimIds,
      evidenceIds: sortedUnique(evidenceIds),
      impactPathIds: sortedUnique(draft.impactPathIds),
      ...(draft.verificationGap === undefined
        ? {}
        : { verificationGap: draft.verificationGap }),
    };
    const findingId = deriveStrongFindingIdV1(findingFields);
    const finding = StrongChangeFindingV1Schema.parse({
      profile: "evidence_backed_v1",
      id: findingId,
      type: draft.type,
      severity: draft.severity,
      blocking: draft.blocking,
      summary: draft.summary,
      claimIds,
      plannedChangeIds: findingFields.plannedChangeIds,
      actualChangeIds: findingFields.actualChangeIds,
      evidenceIds: findingFields.evidenceIds,
      impactPathIds: findingFields.impactPathIds,
      ...(draft.verificationGap === undefined
        ? {}
        : { verificationGap: draft.verificationGap }),
    });
    findings.push(finding);
    findingClaims.push(StrongFindingClaimV1Schema.parse({
      id: claimId,
      taskId,
      kind: "finding",
      statement: draft.summary,
      epistemicStatus: draft.type === "cannot_determine" ? "unknown" : "observed",
      lifecycleStatus: draft.type === "cannot_determine" ? "draft" : "supported",
      freshness: "current",
      sourceSnapshotId: actualSnapshotId,
      evidenceIds: findingFields.evidenceIds.filter(
        (id) => id.startsWith("diff-evidence:") || id.startsWith("boundary-evidence:"),
      ),
      findingIds: [findingId],
      createdAt: occurredAt,
      updatedAt: occurredAt,
    }));
  }
  findings.sort((left, right) =>
    (FINDING_RANK.get(left.type) ?? Number.MAX_SAFE_INTEGER) -
      (FINDING_RANK.get(right.type) ?? Number.MAX_SAFE_INTEGER) ||
    compareUtf8Bytes(left.id, right.id),
  );
  findingClaims.sort((left, right) => compareUtf8Bytes(left.id, right.id));
  evidence.sort((left, right) => compareUtf8Bytes(left.id, right.id));

  const boundaryIdsByStage = (stage: AnalysisBoundaryV1["stage"]) =>
    boundaries.filter((boundary) => boundary.stage === stage).map((boundary) => boundary.id);
  const repositoryUnits = [
    ...preparation.repositoryDelta.paths.map((path) => ({
      unitKind: "repository_path_delta" as const,
      unitId: path.id,
      status: worstStatus(path.segments.map((segment) => segment.status)),
      boundaryEvidenceIds: sortedUnique(path.segments.flatMap((segment) => segment.boundaryIds).map((id) => boundaryEvidenceById.get(id)!)),
    })),
    ...preparation.repositoryDelta.redactedAggregates.map((aggregate) => ({
      unitKind: "redacted_repository_aggregate" as const,
      unitId: aggregate.snapshotRedactionId,
      status: "unknown" as const,
      boundaryEvidenceIds: [boundaryEvidenceById.get(aggregate.boundaryId)!],
    })),
  ];
  const semanticUnits: Parameters<typeof dimension>[1] = [
    ...actualChanges.map((actual) => ({
      unitKind: "actual_change" as const,
      unitId: actual.id,
      status: actual.analysisStatus,
      boundaryEvidenceIds: actual.boundaryEvidenceIds,
    })),
    ...preparation.repositoryDelta.redactedAggregates.map((aggregate) => ({
      unitKind: "redacted_repository_aggregate" as const,
      unitId: aggregate.boundaryId,
      status: "unknown" as const,
      boundaryEvidenceIds: [boundaryEvidenceById.get(aggregate.boundaryId)!],
    })),
  ];
  const plannedUnits = [
    ...semanticUnits,
    ...requiredObligations.map((obligation) => {
      const finding = findings.find((candidate) =>
        candidate.plannedChangeIds.includes(obligation.plannedChangeId),
      );
      const unknown = finding?.type === "cannot_determine";
      return {
        unitKind: "required_planned_change" as const,
        unitId: obligation.plannedChangeId,
        status: unknown ? "unknown" as const : "complete" as const,
        boundaryEvidenceIds: unknown
          ? finding!.evidenceIds.filter((id) => id.startsWith("boundary-evidence:"))
          : [],
      };
    }),
  ];
  const verificationUnits = preparation.task.acceptanceClaimIds.map((claimId) => ({
    unitKind: "acceptance_claim" as const,
    unitId: claimId,
    status: uncoveredClaims.includes(claimId) ? "unknown" as const : "complete" as const,
    boundaryEvidenceIds: uncoveredClaims.includes(claimId)
      ? boundaries
          .filter((boundary) => boundary.stage === "verification_coverage")
          .map((boundary) => boundaryEvidenceById.get(boundary.id)!)
      : [],
  }));
  const impactUnits = [
    ...actualChanges.map((actual) => {
      const boundaryId = impactBoundaryByUnitId.get(actual.id);
      return {
        unitKind: "actual_change" as const,
        unitId: actual.id,
        status: boundaryId === undefined ? "complete" as const : "unknown" as const,
        boundaryEvidenceIds: boundaryId === undefined ? [] : [boundaryEvidenceById.get(boundaryId)!],
      };
    }),
    ...requiredObligations.map((obligation) => {
      const boundaryId = impactBoundaryByUnitId.get(obligation.plannedChangeId);
      return {
        unitKind: "required_planned_change" as const,
        unitId: obligation.plannedChangeId,
        status: boundaryId === undefined ? "complete" as const : "unknown" as const,
        boundaryEvidenceIds: boundaryId === undefined ? [] : [boundaryEvidenceById.get(boundaryId)!],
      };
    }),
  ];
  const dimensions = [
    dimension("repository_delta", repositoryUnits, boundaryIdsByStage("repository_delta"), boundaryEvidenceById),
    dimension("semantic_classification", semanticUnits, [...boundaryIdsByStage("parse"), ...boundaryIdsByStage("symbol_mapping")], boundaryEvidenceById),
    dimension("planned_matching", plannedUnits, boundaryIdsByStage("planned_matching"), boundaryEvidenceById),
    dimension("impact_analysis", impactUnits, boundaryIdsByStage("impact_analysis"), boundaryEvidenceById),
    dimension("verification_coverage", verificationUnits, boundaryIdsByStage("verification_coverage"), boundaryEvidenceById),
  ] as const;
  const overall = worstStatus(dimensions.map((entry) => entry.status));

  const analysisInputDigest = sha256CanonicalJson([
    "change-analysis-input-v1",
    {
      basis: preparation.basis,
      rulesetVersion: preparation.rulesetVersion,
      budget: preparation.budget,
      confirmedObligations: preparation.task.confirmedObligations,
      verificationPlan: preparation.task.verificationPlan,
      repositoryDelta: preparation.repositoryDelta,
    },
  ]);
  const semanticDigest = sha256CanonicalJson([
    "change-analysis-semantic-v1",
    {
      repositoryDelta: preparation.repositoryDelta,
      actualChanges,
      completeness: { overall, dimensions },
      findings: findings.map((finding) => ({
        id: finding.id,
        type: finding.type,
        severity: finding.severity,
        blocking: finding.blocking,
        claimIds: finding.claimIds,
        plannedChangeIds: finding.plannedChangeIds,
        actualChangeIds: finding.actualChangeIds,
        evidenceIds: finding.evidenceIds,
        impactPathIds: finding.impactPathIds,
        ...(finding.verificationGap === undefined ? {} : { verificationGap: finding.verificationGap }),
      })),
    },
  ]);
  const uniqueSymbolIds = new Set(
    actualChanges.flatMap((actual) => [
      ...actual.oldSymbolRefs.map((symbol) => symbol.id),
      ...actual.newSymbolRefs.map((symbol) => symbol.id),
    ]),
  );
  const usage = {
    ...preparation.usage,
    actualChanges: actualChanges.length,
    evidenceItems: evidence.length,
    symbolRefs: uniqueSymbolIds.size,
    excerptChars: 0 as const,
  };
  const analysis = ChangeCheckAnalysisV1Schema.parse({
    profile: "evidence_backed_v1",
    rulesetVersion: preparation.rulesetVersion,
    budget: preparation.budget,
    usage,
    basisRecordId: preparation.basis.recordId,
    basisRecordContentDigest: preparation.basis.recordContentDigest,
    repositoryBasisDigest: preparation.basis.basisDigest,
    repositoryReadSetDigest: preparation.basis.readSetDigest,
    graphArtifactId: preparation.basis.graphArtifactId,
    graphContentDigest: preparation.basis.graphContentDigest,
    graphSourceSnapshotId: preparation.basis.graphSourceSnapshotId,
    analysisInputDigest,
    semanticDigest,
    repositoryDelta: preparation.repositoryDelta,
    actualChanges,
    completeness: { overall, dimensions },
  });
  const nextRevision = input.expectedRevision + 1;
  const changeCheck: EvidenceBackedChangeCheckV1 =
    EvidenceBackedChangeCheckV1Schema.parse({
      schemaVersion: 1,
      id: stableId("change-check", [
        "evidence-backed-change-check-v1",
        { taskId, nextRevision, analysisInputDigest, semanticDigest },
      ]),
      taskId,
      taskRevision: nextRevision,
      baselineSnapshotId: preparation.baselineSnapshot.snapshotId,
      actualSnapshotId,
      findings,
      analysis,
      generatedAt: occurredAt,
    });
  const commitEvidence = StrongChangeCheckCommitEvidenceV1Schema.parse({
    profile: "strong_change_commit_evidence_v1",
    recovery: { markerFirst: true, idempotencyReplaySafe: true },
    security: {
      scannerPolicyDigest: preparation.baseline.scannerPolicyDigest,
      safeGitExecutionDigest: preparation.baseline.safeGitExecutionDigest,
      persistedExcerptChars: 0,
    },
    readSet: {
      basisRecordId: preparation.basis.recordId,
      basisDigest: preparation.basis.basisDigest,
      readSetDigest: preparation.basis.readSetDigest,
      finalValidation: "provider_exact_cut_v1",
    },
    provenance: {
      taskBaselineArtifactId: preparation.baseline.artifactId,
      baselineSnapshotId: preparation.baselineSnapshot.snapshotId,
      actualSnapshotId,
      analysisInputDigest,
      semanticDigest,
    },
  });
  const impactDimension = dimensions[3];
  const impactBoundaryEvidenceIds = sortedUnique([
    ...impactDimension.boundaryEvidenceIds,
    ...impactDimension.units.flatMap((unit) => unit.boundaryEvidenceIds),
  ]);
  const impactPathIds = [...preparation.task.impactPathIds];
  const impactConclusion = impactDimension.status === "complete"
    ? impactPathIds.length === 0
      ? { status: "none_observed" as const, impactPathIds: [] as [], boundaryEvidenceIds: [] as [] }
      : { status: "paths_observed" as const, impactPathIds, boundaryEvidenceIds: [] as [] }
    : impactPathIds.length === 0 && impactDimension.status === "unknown"
      ? { status: "unknown" as const, impactPathIds: [] as [], boundaryEvidenceIds: impactBoundaryEvidenceIds }
      : { status: "partial" as const, impactPathIds, boundaryEvidenceIds: impactBoundaryEvidenceIds };
  const commitRequest = StrongChangeCheckCommitRequestV1Schema.parse({
    profile: "strong_change_check_commit_v1",
    expectedRevision: input.expectedRevision,
    idempotencyKey: input.idempotencyKey,
    actor: input.actor,
    requestDigest,
    authorityToken: preparation.authorityToken,
    changeCheck,
    findingClaims,
    evidence,
    impactConclusion,
    commitEvidence,
  });
  return StrongChangeCheckMutationOutcomeV1Schema.parse(
    await authority.commitCheck(commitRequest),
  );
    },
  );
}

function requestDigestForVerification(
  input: StrongRecordVerificationInputV1,
  security: StrongVerificationSecurityProjectionV1,
): string {
  return sha256CanonicalJson([
    "operation-safe-request-v1",
    {
      version: "operation-safe-request-v1",
      sensitiveRequestScanPolicyDigest: security.sensitiveRequestScanPolicyDigest,
      operation: "record_verification",
      actor: input.actor,
      expectedRevision: input.expectedRevision,
      snapshotAssertions: { snapshotId: input.snapshotId },
      safeInput: {
        taskId: input.taskId,
        verificationPlanEntryId: input.verificationPlanEntryId,
        method: input.method,
        status: input.status,
        claimIds: input.claimIds,
        detailDisposition: security.detail.status,
        detailFields: security.detailFields,
        ...(input.supersedesVerificationRecordId === undefined
          ? {}
          : { supersedesVerificationRecordId: input.supersedesVerificationRecordId }),
      },
    },
  ]);
}

export async function executeStrongVerificationRecordV1(
  authority: StrongChangeIntelligenceAuthorityV1 | undefined,
  inputValue: StrongRecordVerificationInputV1,
  clock: () => Date,
): Promise<StrongVerificationMutationOutcomeV1> {
  if (authority === undefined) {
    throw new TaskEngineError(
      "capability_unavailable",
      "Strong Verification requires a real Provider authority.",
      { reason: "strong_write_locked" },
    );
  }
  const input = StrongRecordVerificationInputV1Schema.parse(inputValue);
  if (authority.scanVerificationInput === undefined) {
    throw new TaskEngineError(
      "capability_unavailable",
      "Strong Verification requires the Provider-owner security scanner.",
      { reason: "strong_write_locked" },
    );
  }
  const security = await authority.scanVerificationInput(input);
  const requestDigest = requestDigestForVerification(input, security);
  const replay = await authority.replayVerification?.(
    input,
    requestDigest,
    security,
  );
  if (replay !== undefined) {
    return StrongVerificationMutationOutcomeV1Schema.parse({
      ...replay,
      idempotentReplay: true,
    });
  }
  const reserveOperationTime = authority.reserveOperationTime;
  const reservedByAuthority = reserveOperationTime !== undefined;
  const recordedAt = reserveOperationTime === undefined
    ? clock().toISOString()
    : await reserveOperationTime.call(
        authority,
        {
          taskId: input.taskId,
          expectedRevision: input.expectedRevision,
          operation: "record_verification",
          idempotencyKey: input.idempotencyKey,
          actor: input.actor,
          requestDigest,
          fullInputEqualityTag: security.fullInputEqualityTag,
        },
        clock().toISOString(),
      );
  return prepareReservedStrongOperationV1(
    authority,
    reservedByAuthority,
    {
      taskId: input.taskId,
      expectedRevision: input.expectedRevision,
      operation: "record_verification",
      idempotencyKey: input.idempotencyKey,
      actor: input.actor,
      requestDigest,
      fullInputEqualityTag: security.fullInputEqualityTag,
    },
    async () => {
  const preparation = StrongVerificationPreparationV1Schema.parse(
    await authority.prepareVerification(input, security),
  );
  if (
    preparation.sensitiveRequestScanPolicyDigest !==
      security.sensitiveRequestScanPolicyDigest ||
    preparation.fullInputEqualityTag !== security.fullInputEqualityTag ||
    preparation.ownerOnlyDetailCommitment !==
      security.ownerOnlyDetailCommitment ||
    !exactEqual(preparation.ownerOnlyDetail, security.ownerOnlyDetail) ||
    !exactEqual(preparation.detail, security.detail) ||
    !exactEqual(preparation.detailFields, security.detailFields)
  ) {
    invalidAuthority("verification_security_projection_mismatch");
  }
  const manifest = preparation.task.manifest;
  if (
    manifest.taskId !== input.taskId ||
    manifest.revision !== input.expectedRevision ||
    manifest.status !== "verification_required" ||
    preparation.planEntry.verificationPlanEntryId !== input.verificationPlanEntryId ||
    preparation.planEntry.method !== input.method ||
    preparation.changeCheck.id !== manifest.currentChangeCheckId ||
    preparation.changeCheck.actualSnapshotId !== manifest.latestSnapshotId ||
    input.snapshotId !== manifest.latestSnapshotId
  ) {
    invalidAuthority("verification_authority_pin_mismatch");
  }
  const records = preparation.priorRecords
    .filter((record) =>
      record.verificationPlanEntryId === input.verificationPlanEntryId &&
      record.contextGenerationId === manifest.contextGenerationId &&
      record.snapshotId === manifest.latestSnapshotId,
    )
    .sort((left, right) => left.attempt - right.attempt);
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]!;
    const prior = records[index - 1];
    if (
      record.attempt !== index + 1 ||
      (prior === undefined
        ? record.supersedesVerificationRecordId !== undefined
        : record.supersedesVerificationRecordId !== prior.id)
    ) {
      invalidAuthority("verification_attempt_chain_invalid");
    }
  }
  const previous = records.at(-1);
  if (
    (previous === undefined) !==
      (input.supersedesVerificationRecordId === undefined) ||
    (previous !== undefined &&
      input.supersedesVerificationRecordId !== previous.id)
  ) {
    throw new TaskEngineError(
      "task_gate_unsatisfied",
      "Verification retry must supersede the current exact attempt leaf.",
      { reason: "verification_attempt_conflict" },
    );
  }
  const attempt = (previous?.attempt ?? 0) + 1;
  const contextGenerationId = manifest.contextGenerationId;
  if (contextGenerationId === undefined) {
    invalidAuthority("verification_context_generation_unavailable");
  }
  const planClaimIds = new Set(preparation.planEntry.acceptanceClaimIds);
  if (input.claimIds.some((claimId) => !planClaimIds.has(claimId))) {
    invalidAuthority("verification_claim_authority_mismatch");
  }
  const expectedDetailFields = [
    ...(input.command === undefined ? [] : ["command" as const]),
    ...(input.exitCode === undefined ? [] : ["exit_code" as const]),
    ...(input.durationMs === undefined ? [] : ["duration_ms" as const]),
    ...(input.summary === undefined ? [] : ["summary" as const]),
    ...(input.rawOutputBase64url === undefined ? [] : ["raw_output" as const]),
  ];
  if (!exactEqual(expectedDetailFields, preparation.detailFields)) {
    invalidAuthority("verification_detail_field_projection_mismatch");
  }
  const hasDetail = expectedDetailFields.length > 0;
  if (
    (!hasDetail && preparation.detail.status !== "none") ||
    (hasDetail && preparation.detail.status === "none") ||
    (input.method !== "manual" && ["passed", "failed", "flaky"].includes(input.status) && preparation.detail.status === "none")
  ) {
    invalidAuthority("verification_detail_disposition_mismatch");
  }
  const publicResultCode = {
    passed: "verification_passed",
    failed: "verification_failed",
    blocked: "verification_blocked",
    flaky: "verification_flaky",
    skipped: "verification_skipped",
  } as const satisfies Readonly<
    Record<
      StrongRecordVerificationInputV1["status"],
      StrongVerificationRecordV1["publicResultCode"]
    >
  >;
  const derivedPublicResultCode = publicResultCode[input.status];
  const claimIds = [...input.claimIds];
  const identityFields = {
    taskId: input.taskId,
    contextGenerationId,
    snapshotId: preparation.changeCheck.actualSnapshotId,
    changeCheckContentDigest: preparation.changeCheckContentDigest,
    verificationPlanEntryId: input.verificationPlanEntryId,
    attempt,
    ...(previous === undefined
      ? {}
      : { supersedesVerificationRecordId: previous.id }),
    method: preparation.planEntry.method,
    status: input.status,
    claimIds,
    publicResultCode: derivedPublicResultCode,
    detail: preparation.detail,
  };
  const verification = StrongVerificationRecordV1Schema.parse({
    profile: "verification_record_strong_v1",
    id: deriveStrongVerificationRecordIdV1({
      ...identityFields,
      ...(preparation.ownerOnlyDetailCommitment === undefined
        ? {}
        : {
            ownerOnlyDetailCommitment:
              preparation.ownerOnlyDetailCommitment,
          }),
    }),
    ...identityFields,
    changeCheckArtifactId: preparation.changeCheckArtifactId,
    recordedAt,
  });
  const commitEvidence = StrongVerificationCommitEvidenceV1Schema.parse({
    profile: "strong_verification_commit_evidence_v1",
    recovery: { attemptChainValidated: true, idempotencyReplaySafe: true },
    security: {
      detailPolicy: "scanned_or_keyed_commitment_v1",
      rawExecutionPersisted: false,
    },
    readSet: {
      basisRecordId: preparation.basis.recordId,
      basisDigest: preparation.basis.basisDigest,
      readSetDigest: preparation.basis.readSetDigest,
      finalValidation: "provider_exact_cut_v1",
    },
    provenance: {
      taskBaselineArtifactId: preparation.basis.taskBaselineArtifactId,
      contextGenerationId: manifest.contextGenerationId,
      snapshotId: manifest.latestSnapshotId,
      changeCheckArtifactId: preparation.changeCheckArtifactId,
      changeCheckContentDigest: preparation.changeCheckContentDigest,
    },
  });
  const request = StrongVerificationCommitRequestV1Schema.parse({
    profile: "strong_verification_commit_v1",
    expectedRevision: input.expectedRevision,
    idempotencyKey: input.idempotencyKey,
    actor: input.actor,
    requestDigest,
    fullInputEqualityTag: preparation.fullInputEqualityTag,
    ...(preparation.ownerOnlyDetailCommitment === undefined
      ? {}
      : { ownerOnlyDetailCommitment: preparation.ownerOnlyDetailCommitment }),
    ...(preparation.ownerOnlyDetail === undefined
      ? {}
      : { ownerOnlyDetail: preparation.ownerOnlyDetail }),
    authorityToken: preparation.authorityToken,
    verification,
    commitEvidence,
  });
  return StrongVerificationMutationOutcomeV1Schema.parse(
    await authority.commitVerification(request),
  );
    },
  );
}
