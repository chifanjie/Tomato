import { createHash } from "node:crypto";

import {
  ArtifactStore,
  type ProviderPinnedTaskBaselineAuthorityV1,
  type StrongChangeMaterialAuthorityV1,
  type StrongChangeProviderAuthorityV1,
} from "@understand-code/artifact-store";
import {
  AnalysisBoundaryV1Schema,
  ChangeAnalysisBudgetV1Schema,
  ChangeAnalysisUsageV1Schema,
  ContentDigestSchema,
  DiffHunkV1Schema,
  InternalTaskBaselineV1Schema,
  PathSafeRepositoryChangeIdV1Schema,
  RepositoryBasisProofV1Schema,
  RepositoryDeltaV1Schema,
  SourceSymbolRefV1Schema,
  StrongAnalyzedHunkV1Schema,
  StrongChangeCheckPreparationV1Schema,
  StrongTaskBaselineCaptureOutcomeV1Schema,
  StrongRepositorySnapshotV1Schema,
  StrongVerificationPreparationV1Schema,
  canonicalizeJson,
  type ContentDigest,
  type InternalTaskBaselineV1,
  type StrongChangeCheckPreparationV1,
  type StrongRecordVerificationInputV1,
  type StrongRepositorySnapshotV1,
  type StrongTaskBaselineCaptureOutcomeV1,
  type StrongVerificationPreparationV1,
} from "@understand-code/contracts";
import type { GraphNode } from "@understand-code/core";

import { deterministicLineDiff } from "./change-analysis.js";
import { sha256CanonicalJson } from "./ids.js";
import { RepositoryTaskContextProvider } from "./repository-context-provider.js";
import {
  deriveStrongBoundaryIdV1,
  deriveStrongDiffHunkIdentityV1,
  deriveStrongEffectiveRepositoryChangeIdV1,
  deriveStrongRepositoryDeltaSegmentIdV1,
  deriveStrongRepositoryPathDeltaIdV1,
  deriveStrongSourceSymbolRefIdV1,
} from "./strong-change-intelligence.js";
import {
  scanStrongVerificationDetailV1,
  type StrongVerificationOwnerKeyAuthorityV1,
} from "./strong-verification-detail.js";
import type {
  StrongRepositoryAnalysisMaterialV1,
  StrongRepositoryChangeMaterialV1,
  StrongRepositoryContentMaterialV1,
  StrongRepositoryGraphPinV1,
} from "./engine-types.js";

const RULESET_VERSION = "1.0.0" as const;
const BASELINE_MATERIALIZATION_VERSION = 1;
const BUDGET = ChangeAnalysisBudgetV1Schema.parse({
  version: "change-analysis-budget-v1",
  maxChangedFiles: 4_096,
  maxBytesPerFile: 8 * 1024 * 1024,
  maxTotalBytes: 64 * 1024 * 1024,
  maxLinesPerFile: 2_000,
  maxTotalLines: 100_000,
  maxEditWorkUnits: 2_000_000,
  maxHunksPerFile: 1_024,
  maxTotalHunks: 4_096,
  maxParserNodesPerFile: 100_000,
  maxTotalParserNodes: 1_000_000,
  maxMatchingWorkUnits: 2_000_000,
  maxImpactNodes: 100_000,
  maxImpactEdges: 500_000,
  maxImpactTraversalWorkUnits: 2_000_000,
  maxImpactPaths: 10_000,
  maxExcerptCharsPerEvidence: 1,
  maxTotalExcerptChars: 1,
  maxActualChanges: 10_000,
  maxEvidenceItems: 20_000,
  maxSymbolRefs: 50_000,
  maxSerializedArtifactBytes: 64 * 1024 * 1024,
});

function digest(value: unknown): ContentDigest {
  return `sha256:${createHash("sha256")
    .update(canonicalizeJson(value), "utf8")
    .digest("hex")}`;
}

function nonce(domain: string, value: unknown): string {
  return createHash("sha256")
    .update(canonicalizeJson([domain, value]), "utf8")
    .digest("hex")
    .slice(0, 32);
}

function bytesDigest(bytes: Buffer): ContentDigest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function publicState(material: StrongRepositoryContentMaterialV1) {
  if (material.status === "absent") {
    return { status: "absent" as const, path: material.path };
  }
  if (
    material.bytes === undefined || material.domain === undefined ||
    material.mode === undefined || material.contentDigest === undefined
  ) throw new TypeError("strong repository content material is incomplete");
  return {
    status: "content" as const,
    path: material.path,
    domain: material.domain,
    ...(material.objectId === undefined ? {} : { objectId: material.objectId }),
    contentDigest: material.contentDigest,
    mode: material.mode,
    size: material.bytes.byteLength,
  };
}

function materialStateEqual(
  left: StrongRepositoryContentMaterialV1,
  right: StrongRepositoryContentMaterialV1,
): boolean {
  return left.status === right.status && (
    left.status === "absent" || (
      right.status === "content" &&
      left.contentDigest === right.contentDigest &&
      left.mode === right.mode
    )
  );
}

function changeKindForStates(
  before: StrongRepositoryContentMaterialV1,
  after: StrongRepositoryContentMaterialV1,
): "added" | "modified" | "deleted" {
  if (before.status === "absent" && after.status === "content") return "added";
  if (before.status === "content" && after.status === "absent") return "deleted";
  return "modified";
}

function languageForPath(path: string): string {
  const extension = path.split(".").at(-1)?.toLowerCase();
  return ({ ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript", py: "python", go: "go", rs: "rust" } as Record<string, string>)[extension ?? ""] ?? "text";
}

function sourceSpan(bytes: Buffer, range: readonly [number, number]) {
  const lines = bytes.toString("utf8").match(/[^\r\n]*(?:\r\n|\r|\n)|[^\r\n]+$/gu) ?? [];
  const before = lines.slice(0, Math.max(0, range[0] - 1)).join("");
  const selected = lines.slice(range[0] - 1, range[1]).join("");
  return {
    start: { line: range[0], column: 0, byteOffset: Buffer.byteLength(before, "utf8") },
    endExclusive: {
      line: range[1] + 1,
      column: 0,
      byteOffset: Buffer.byteLength(before + selected, "utf8"),
    },
  };
}

function symbolsForRange(input: Readonly<{
  snapshotId: StrongRepositorySnapshotV1["snapshotId"];
  path: string;
  bytes: Buffer;
  graphNodes: readonly GraphNode[];
  range?: readonly [number, number];
}>) {
  if (input.range === undefined) return [];
  return input.graphNodes
    .filter((node) =>
      node.filePath === input.path && node.lineRange !== undefined &&
      node.lineRange[0] <= input.range![1] && node.lineRange[1] >= input.range![0] &&
      ["function", "class", "module"].includes(node.type)
    )
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((node) => {
      const span = sourceSpan(input.bytes, node.lineRange!);
      const fields = {
        snapshotId: input.snapshotId,
        path: input.path,
        language: languageForPath(input.path),
        parserVersion: "core-graph-v1",
        kind: node.type as "function" | "class" | "module",
        qualifiedName: node.name,
        fullSpan: span,
        signatureSpan: span,
        bodySpan: span,
        declarationDigest: bytesDigest(
          input.bytes.subarray(span.start.byteOffset, span.endExclusive.byteOffset),
        ),
        graphNodeId: node.id,
      };
      return SourceSymbolRefV1Schema.parse({
        id: deriveStrongSourceSymbolRefIdV1(fields),
        ...fields,
      });
    });
}

function baselineBoundary(
  code: "unpinned_git_object" | "unavailable_content" = "unpinned_git_object",
  scope: { readonly kind: "repository" } | { readonly kind: "path"; readonly path: string } = { kind: "repository" },
) {
  const fields = {
    stage: "baseline_capture" as const,
    code,
    scope,
    recovery: "restore_artifact" as const,
  };
  return AnalysisBoundaryV1Schema.parse({
    id: deriveStrongBoundaryIdV1(fields),
    ...fields,
  });
}

const BASELINE_LAYER_ORDER: Readonly<Record<string, number>> = Object.freeze({
  committed: 0,
  staged: 1,
  unstaged: 2,
  untracked: 3,
  conflict: 4,
});

interface BaselinePrivateObjectV1 {
  readonly privateBlobId: string;
  readonly contentDigest: ContentDigest;
  readonly bytes: Buffer;
  readonly operationNonce: string;
  readonly logicalBytes: number;
}

interface BaselineOverlayV1 {
  readonly paths: readonly {
    readonly path: string;
    readonly finalKind: "file" | "absent";
    readonly capture: InternalTaskBaselineV1["paths"][number]["capture"];
  }[];
  readonly privateObjects: readonly BaselinePrivateObjectV1[];
  readonly boundaries: readonly ReturnType<typeof baselineBoundary>[];
  readonly complete: boolean;
}

export interface RepositoryStrongChangeMaterialAuthorityOptionsV1 {
  readonly store: ArtifactStore;
  readonly repositoryContextProvider: RepositoryTaskContextProvider;
  readonly provider: StrongChangeProviderAuthorityV1;
  readonly providerId: string;
  readonly ownerKeyAuthority: StrongVerificationOwnerKeyAuthorityV1;
}

/** Production local analyzer; Provider remains exact-object/CAS only. */
export class RepositoryStrongChangeMaterialAuthorityV1
implements StrongChangeMaterialAuthorityV1 {
  readonly #store: ArtifactStore;
  readonly #repository: RepositoryTaskContextProvider;
  readonly #provider: StrongChangeProviderAuthorityV1;
  readonly #providerId: string;
  readonly #ownerKey: StrongVerificationOwnerKeyAuthorityV1;

  constructor(options: RepositoryStrongChangeMaterialAuthorityOptionsV1) {
    this.#store = options.store;
    this.#repository = options.repositoryContextProvider;
    this.#provider = options.provider;
    this.#providerId = options.providerId;
    this.#ownerKey = options.ownerKeyAuthority;
  }

  async #material(
    baseline: StrongRepositorySnapshotV1,
    actual: StrongRepositorySnapshotV1,
  ): Promise<StrongRepositoryAnalysisMaterialV1> {
    const pin = await this.#graphPin(actual.snapshotId);
    const material = await this.#repository.readStrongRepositoryAnalysisMaterial(
      baseline,
      actual,
      pin,
    );
    const finalPin = await this.#graphPin(actual.snapshotId);
    if (canonicalizeJson(finalPin) !== canonicalizeJson(pin)) {
      throw new Error("Knowledge Graph authority drifted during strong analysis");
    }
    return material;
  }

  async #baselinePathMaterial(
    baseline: ProviderPinnedTaskBaselineAuthorityV1,
    entry: InternalTaskBaselineV1["paths"][number],
  ): Promise<StrongRepositoryContentMaterialV1> {
    if (entry.capture.status === "absent") {
      return { status: "absent", path: entry.path };
    }
    if (entry.capture.status === "private_blob") {
      const exact = await this.#provider.readExactObject({
        locator: {
          providerId: this.#providerId,
          contentDigest: entry.capture.privateContentDigest,
        },
      });
      if (!exact.bytes.startsWith("base64url:")) {
        throw new Error("baseline private blob encoding is invalid");
      }
      const bytes = Buffer.from(exact.bytes.slice("base64url:".length), "base64url");
      if (
        exact.verifiedContentDigest !== entry.capture.privateContentDigest ||
        bytesDigest(bytes) !== entry.capture.privateContentDigest ||
        bytes.byteLength !== entry.capture.size
      ) throw new Error("baseline private blob read-back mismatch");
      return {
        status: "content",
        path: entry.path,
        domain: "baseline_private_blob",
        bytes,
        contentDigest: entry.capture.privateContentDigest,
        mode: entry.capture.mode === "100755" ? "100755" : "100644",
      };
    }
    if (entry.capture.status === "git_object") {
      const material = await this.#repository.readStrongBaselinePathMaterial(
        baseline.snapshot,
        entry.path,
      );
      if (
        material.status !== "content" ||
        material.objectId !== entry.capture.objectId ||
        material.contentDigest !== entry.capture.contentDigest
      ) throw new Error("baseline Git object pin mismatch");
      return material;
    }
    throw new Error("baseline path has no analyzable exact bytes");
  }

  async #materialWithBaseline(
    baseline: ProviderPinnedTaskBaselineAuthorityV1,
    actual: StrongRepositorySnapshotV1,
  ): Promise<StrongRepositoryAnalysisMaterialV1> {
    const material = await this.#material(baseline.snapshot, actual);
    if (baseline.baseline.paths.length === 0) return material;
    const reconciliation: StrongRepositoryChangeMaterialV1[] = [];
    const actualChanges: StrongRepositoryChangeMaterialV1[] = [...material.changes];
    const actualPathItems = new Set(actualChanges.map((item) => item.change.path));
    for (const entry of baseline.baseline.paths) {
      const before = await this.#baselinePathMaterial(baseline, entry);
      const baselineHead = await this.#repository.readStrongBaselinePathMaterial(
        baseline.snapshot,
        entry.path,
      );
      const actualFinal = await this.#repository.readStrongActualPathMaterial(
        actual,
        entry.path,
      );
      const existingPathItems = actualChanges.filter((item) => item.change.path === entry.path);
      if (existingPathItems.length > 0) {
        const sourceOrder: Readonly<Record<string, number>> = {
          baseline_reconciliation: 0,
          committed: 1,
          staged: 2,
          unstaged: 3,
          untracked: 4,
          conflict: 5,
        };
        const last = [...existingPathItems].sort(
          (left, right) => (sourceOrder[left.change.source] ?? -1) - (sourceOrder[right.change.source] ?? -1),
        ).at(-1)!;
        if (!materialStateEqual(last.after, actualFinal)) {
          throw new Error("actual Snapshot path material drifted during strong analysis");
        }
      }
      if (!materialStateEqual(actualFinal, baselineHead) && !actualPathItems.has(entry.path)) {
        const actualSourceOrder: Readonly<Record<string, number>> = {
          committed: 0,
          staged: 1,
          unstaged: 2,
          untracked: 3,
          conflict: 4,
        };
        const selected = actual.changes
          .filter((change) => change.path === entry.path)
          .sort((left, right) => (actualSourceOrder[left.source] ?? -1) - (actualSourceOrder[right.source] ?? -1)).at(-1);
        if (selected !== undefined) {
          actualChanges.push({
            change: {
              ...selected,
              source: selected.source,
            },
            before: baselineHead,
            after: actualFinal,
          });
          actualPathItems.add(entry.path);
        }
      }
      if (materialStateEqual(before, baselineHead)) continue;
      const kind = changeKindForStates(before, baselineHead);
      const change = {
        id: PathSafeRepositoryChangeIdV1Schema.parse(`baseline-reconciliation:${digest({
          taskId: baseline.baseline.taskId,
          path: entry.path,
          before: publicState(before),
          after: publicState(baselineHead),
        }).slice("sha256:".length, 29)}`),
        path: entry.path,
        source: "baseline_reconciliation" as const,
        kind,
        ...(before.contentDigest === undefined ? {} : { previousContentDigest: before.contentDigest }),
        ...(baselineHead.contentDigest === undefined ? {} : { contentDigest: baselineHead.contentDigest }),
      } satisfies StrongRepositoryChangeMaterialV1["change"];
      reconciliation.push({ change, before, after: baselineHead });
    }
    return {
      ...material,
      changes: [...reconciliation, ...actualChanges],
    };
  }

  async #graphPin(snapshotId: string): Promise<StrongRepositoryGraphPinV1> {
    const manifest = await this.#store.readManifest({ verifyArtifacts: false });
    const matches = manifest.artifacts.filter((descriptor) =>
      descriptor.artifactType === "graph" &&
      descriptor.state === "current" &&
      descriptor.freshness !== "invalid" &&
      descriptor.sourceSnapshotId === snapshotId &&
      descriptor.contentDigest !== undefined
    );
    if (matches.length !== 1) {
      throw new Error("one exact current Graph artifact pin is required");
    }
    const descriptor = matches[0]!;
    return {
      artifactId: descriptor.artifactId,
      contentDigest: ContentDigestSchema.parse(descriptor.contentDigest) as ContentDigest,
      sourceSnapshotId: snapshotId,
    };
  }

  /**
   * Materialize the dirty/staged/untracked overlay at the baseline cut.  The
   * Snapshot only carries digests; bytes are read through the descriptor-bound
   * SafeGit session and copied to Provider-private exact objects before the
   * baseline envelope is committed.  This lets later checks reconcile
   * baseline B→HEAD A before applying actual A→C layers without consulting a
   * drifting worktree.
   */
  async #baselineOverlay(
    taskId: string,
    snapshot: StrongRepositorySnapshotV1,
  ): Promise<BaselineOverlayV1> {
    if (
      snapshot.captureStatus !== "complete" ||
      snapshot.headState.kind !== "commit" ||
      snapshot.redactedChanges.length !== 0 ||
      snapshot.unknownStates.length !== 0 ||
      snapshot.changes.every((change) => change.source === "committed")
    ) {
      return { paths: [], privateObjects: [], boundaries: [], complete: true };
    }
    let material: StrongRepositoryAnalysisMaterialV1;
    try {
      const graphPin = await this.#graphPin(snapshot.snapshotId);
      material = await this.#repository.readStrongRepositoryAnalysisMaterial(
        snapshot,
        snapshot,
        graphPin,
      );
    } catch {
      const boundary = baselineBoundary("unavailable_content");
      return { paths: [], privateObjects: [], boundaries: [boundary], complete: false };
    }
    const byPath = new Map<string, StrongRepositoryChangeMaterialV1>();
    const oldPaths = new Set<string>();
    for (const item of material.changes) {
      // A committed source describes the HEAD delta (baseRef→HEAD), not a
      // dirty overlay over the baseline HEAD; it must not overwrite baseline
      // bytes.  Dirty layers are applied in the frozen source order.
      if (item.change.source === "committed") continue;
      const previous = byPath.get(item.change.path);
      if (
        previous === undefined ||
        (BASELINE_LAYER_ORDER[item.change.source] ?? -1) >=
          (BASELINE_LAYER_ORDER[previous.change.source] ?? -1)
      ) byPath.set(item.change.path, item);
      if (item.change.oldPath !== undefined) oldPaths.add(item.change.oldPath);
    }
    const paths: BaselineOverlayV1["paths"][number][] = [];
    const privateObjects: BaselinePrivateObjectV1[] = [];
    for (const oldPath of oldPaths) {
      if (!byPath.has(oldPath)) {
        paths.push({ path: oldPath, finalKind: "absent", capture: { status: "absent" } });
      }
    }
    for (const [path, item] of [...byPath.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      const after = item.after;
      if (after.status === "absent") {
        paths.push({ path, finalKind: "absent", capture: { status: "absent" } });
        continue;
      }
      if (
        after.bytes === undefined || after.mode === undefined ||
        after.contentDigest === undefined
      ) {
        const boundary = baselineBoundary("unavailable_content", { kind: "path", path });
        return { paths: [], privateObjects: [], boundaries: [boundary], complete: false };
      }
      const privateBlobId = `baseline-private-blob:${taskId}:${digest({ path, contentDigest: after.contentDigest }).slice("sha256:".length, 22)}`;
      const operationNonce = nonce("task-baseline-private-blob-v1", {
        taskId,
        path,
        contentDigest: after.contentDigest,
      });
      privateObjects.push({
        privateBlobId,
        contentDigest: after.contentDigest as ContentDigest,
        bytes: after.bytes,
        operationNonce,
        logicalBytes: after.bytes.byteLength,
      });
      paths.push({
        path,
        finalKind: "file",
        capture: {
          status: "private_blob",
          privateBlobId,
          privateContentDigest: after.contentDigest as ContentDigest,
          mode: after.mode === "100755" ? "100755" : "100644",
          size: after.bytes.byteLength,
        },
      });
    }
    return { paths, privateObjects, boundaries: [], complete: true };
  }

  async #baseline(
    taskId: string,
    snapshot: StrongRepositorySnapshotV1,
    leaseIntent?: ReturnType<RepositoryTaskContextProvider["createStrongBaselineLeaseIntent"]>,
    overlay: BaselineOverlayV1 = { paths: [], privateObjects: [], boundaries: [], complete: true },
  ): Promise<InternalTaskBaselineV1> {
    const baselineTreeObjectId = snapshot.headState.kind === "commit"
      ? await this.#repository.readStrongBaselineTreeObjectId(snapshot)
      : snapshot.headState.emptyTreeObjectId;
    const boundary = baselineBoundary();
    const completePinned = leaseIntent !== undefined &&
      snapshot.headState.kind === "commit" &&
      snapshot.redactedChanges.length === 0 &&
      snapshot.unknownStates.length === 0 &&
      overlay.complete;
    const semanticBase = {
      materializationVersion: BASELINE_MATERIALIZATION_VERSION,
      taskId,
      repositoryId: snapshot.repositoryId,
      worktreeId: snapshot.worktreeId,
      captureSnapshotId: snapshot.snapshotId,
      baselineHead: snapshot.headState.kind === "unborn"
        ? { status: "unborn" as const, emptyTreeObjectId: snapshot.headState.emptyTreeObjectId }
        : {
            status: "present" as const,
            commit: snapshot.headState.commit,
            treeObjectId: baselineTreeObjectId,
            gitLease: completePinned
              ? {
                  status: "pinned" as const,
                  leaseId: leaseIntent.leaseId,
                  refName: leaseIntent.refName,
                  objectId: leaseIntent.objectId,
                }
              : { status: "unpinned" as const, boundaryId: boundary.id },
          },
      repositoryStateToken: snapshot.repositoryStateToken,
      attributesDigest: digest(["attributes-v1", snapshot.repositoryStateToken]),
      scannerPolicyDigest: snapshot.securityScanPolicyDigest,
      repositoryPolicyDigest: digest(["repository-policy-v1"]),
      safeGitExecutionDigest: snapshot.safeGitExecutionDigest,
      baselineMaterializationBudgetDigest: digest(BUDGET),
      privateStoreQuotaPolicyDigest: digest(["private-store-quota-v1", BUDGET.maxTotalBytes]),
      captureStatus: completePinned ? "complete" as const : "partial" as const,
      paths: [...overlay.paths],
      redactedUnits: { count: 0, boundaryIds: [] },
      boundaries: completePinned ? [] : [boundary, ...overlay.boundaries],
    };
    const { materializationVersion: _materializationVersion, ...semanticFields } = semanticBase;
    const semanticDigest = digest(["task-baseline-semantic-v1", semanticFields]);
    const artifactId = `task-baseline:${digest([
      "task-baseline-v1",
      {
        taskId,
        captureSnapshotId: snapshot.snapshotId,
        materializationVersion: BASELINE_MATERIALIZATION_VERSION,
        baselineSemanticDigest: semanticDigest,
      },
    ]).slice("sha256:".length, 29)}`;
    return InternalTaskBaselineV1Schema.parse({
      profile: "task_baseline_v1",
      artifactId,
      ...semanticBase,
    });
  }

  async captureTaskBaseline(input: Parameters<StrongChangeMaterialAuthorityV1["captureTaskBaseline"]>[0]): Promise<StrongTaskBaselineCaptureOutcomeV1> {
    const canAttemptPin = input.snapshot.headState.kind === "commit" &&
      input.snapshot.captureStatus === "complete" &&
      input.snapshot.redactedChanges.length === 0 &&
      input.snapshot.unknownStates.length === 0;
    const markerNonce = nonce("task-baseline-cut-v1", {
      taskId: input.operation.taskId,
      snapshotId: input.snapshot.snapshotId,
      commit: input.snapshot.headState.kind === "commit"
        ? input.snapshot.headState.commit
        : null,
    });
    const overlay = canAttemptPin
      ? await this.#baselineOverlay(input.operation.taskId, input.snapshot)
      : { paths: [], privateObjects: [], boundaries: [baselineBoundary()], complete: false };
    const canPin = canAttemptPin && overlay.complete;
    const leaseIntent = canPin && input.snapshot.headState.kind === "commit"
      ? this.#repository.createStrongBaselineLeaseIntent({
          repositoryId: input.snapshot.repositoryId,
          worktreeId: input.snapshot.worktreeId,
          taskId: input.operation.taskId,
          baselineSnapshotId: input.snapshot.snapshotId,
          objectFormat: input.snapshot.objectFormat,
          commit: input.snapshot.headState.commit,
          markerNonce,
        })
      : undefined;
    const baseline = await this.#baseline(
      input.operation.taskId,
      input.snapshot,
      leaseIntent,
      overlay,
    );
    const canonical = canonicalizeJson(baseline);
    const contentDigest = digest(baseline);
    const locator = { providerId: this.#providerId, contentDigest };
    const bytes = `base64url:${Buffer.from(canonical, "utf8").toString("base64url")}`;
    const providerPlan = {
      baselineContentDigest: contentDigest,
      baselineLogicalBytes: Buffer.byteLength(canonical, "utf8"),
      operation: "capture_task_baseline_v1",
      operationNonce: nonce("task-baseline-exact-object-v1", {
        taskId: input.operation.taskId,
        snapshotId: input.snapshot.snapshotId,
      }),
      providerId: this.#providerId,
      locatorContentDigest: contentDigest,
      privateObjects: overlay.privateObjects.map((privateObject) => ({
        privateBlobId: privateObject.privateBlobId,
        contentDigest: privateObject.contentDigest,
        logicalBytes: privateObject.logicalBytes,
        operationNonce: privateObject.operationNonce,
      })),
    };
    const transactionGitLease = leaseIntent?.gitLease ?? {
      status: "none",
      baselineSnapshotId: input.snapshot.snapshotId,
    };
    const expectedMarker = {
      gitLease: transactionGitLease,
      profile: "task_baseline_transaction_intent_v1",
      providerPlan,
      schemaVersion: 1,
    };
    const existingMarker =
      await this.#store.readStrongBaselineTransactionIntent({
        taskId: input.operation.taskId,
        markerNonce,
      });
    const marker = existingMarker === undefined
      ? await this.#store.persistStrongBaselineTransactionIntent({
          taskId: input.operation.taskId,
          markerNonce,
          gitLease: transactionGitLease,
          providerPlan,
        })
      : {
          markerContentDigest: digest(existingMarker),
          markerRelativePath: "",
          marker: existingMarker,
        };
    if (
      existingMarker !== undefined &&
      canonicalizeJson(existingMarker) !== canonicalizeJson(expectedMarker)
    ) {
      throw new Error("Strong baseline transaction marker does not match the requested cut");
    }
    if (
      leaseIntent !== undefined &&
      input.snapshot.headState.kind === "commit"
    ) {
      const lease = existingMarker === undefined
        ? await this.#repository.createStrongBaselineLease({
            taskId: input.operation.taskId,
            baselineSnapshotId: input.snapshot.snapshotId,
            commit: input.snapshot.headState.commit,
            expectedAbsent: true,
            markerNonce,
            markerContentDigest: ContentDigestSchema.parse(
              marker.markerContentDigest,
            ) as Parameters<
              RepositoryTaskContextProvider["createStrongBaselineLease"]
            >[0]["markerContentDigest"],
          })
        : await this.#repository.recoverStrongBaselineLease({
            taskId: input.operation.taskId,
            baselineSnapshotId: input.snapshot.snapshotId,
            commit: input.snapshot.headState.commit,
            expectedAbsent: true,
            markerNonce,
            markerContentDigest: ContentDigestSchema.parse(
              marker.markerContentDigest,
            ) as Parameters<
              RepositoryTaskContextProvider["recoverStrongBaselineLease"]
            >[0]["markerContentDigest"],
          });
      if (
        lease.leaseId !== leaseIntent.leaseId ||
        lease.refName !== leaseIntent.refName ||
        lease.objectId !== leaseIntent.objectId
      ) throw new Error("SafeGit baseline lease identity mismatch");
    }
    for (const privateObject of overlay.privateObjects) {
      const privateLocator = {
        providerId: this.#providerId,
        contentDigest: privateObject.contentDigest,
      };
      const privateBytes = `base64url:${privateObject.bytes.toString("base64url")}`;
      const writtenPrivate = await this.#provider.writeExactObject({
        operationNonce: privateObject.operationNonce,
        locator: privateLocator,
        logicalBytes: privateObject.logicalBytes,
        bytes: privateBytes,
      });
      const readPrivate = await this.#provider.readExactObject({ locator: privateLocator });
      if (
        writtenPrivate.verifiedContentDigest !== privateObject.contentDigest ||
        readPrivate.verifiedContentDigest !== privateObject.contentDigest ||
        readPrivate.bytes !== privateBytes
      ) throw new Error("Provider baseline private overlay read-back failed");
    }
    const written = await this.#provider.writeExactObject({
      operationNonce: nonce("task-baseline-exact-object-v1", {
        taskId: input.operation.taskId,
        snapshotId: input.snapshot.snapshotId,
      }),
      locator,
      logicalBytes: Buffer.byteLength(canonical, "utf8"),
      bytes,
    });
    const read = await this.#provider.readExactObject({ locator });
    if (
      written.verifiedContentDigest !== contentDigest ||
      read.verifiedContentDigest !== contentDigest || read.bytes !== bytes
    ) throw new Error("Provider baseline exact read-back failed");
    const {
      profile: _profile,
      artifactId: _artifactId,
      materializationVersion: _materializationVersion,
      ...semanticFields
    } = baseline;
    const semanticDigest = digest(["task-baseline-semantic-v1", semanticFields]);
    return StrongTaskBaselineCaptureOutcomeV1Schema.parse({
      profile: "task_baseline_capture_outcome_v1",
      baseline,
      baselineSemanticDigest: semanticDigest,
      baselineContentDigest: contentDigest,
      snapshot: input.snapshot,
      snapshotArtifactId: input.snapshotArtifactId,
      snapshotContentDigest: input.snapshotContentDigest,
      idempotentReplay: written.resolution === "replayed",
    });
  }

  async readPinnedTaskBaseline(input: Parameters<StrongChangeMaterialAuthorityV1["readPinnedTaskBaseline"]>[0]): Promise<ProviderPinnedTaskBaselineAuthorityV1> {
    const read = await this.#store.readArtifact("repository_snapshot", {
      snapshotId: input.baselineSnapshotId,
    });
    if (
      read.artifact.artifactType !== "repository_snapshot" ||
      !("profile" in read.artifact.payload) ||
      read.artifact.payload.profile !== "repository_snapshot_path_safe_v1"
    ) throw new Error("strong baseline Snapshot is unavailable");
    const markerNonce = nonce("task-baseline-cut-v1", {
      taskId: input.taskId,
      snapshotId: read.artifact.payload.snapshotId,
      commit: read.artifact.payload.headState.kind === "commit"
        ? read.artifact.payload.headState.commit
        : null,
    });
    const marker = await this.#store.readStrongBaselineTransactionIntent({
      taskId: input.taskId,
      markerNonce,
    });
    let baseline: InternalTaskBaselineV1;
    let baselineContentDigest: ContentDigest;
    if (marker !== undefined) {
      const plan = marker.providerPlan as Record<string, unknown>;
      const markerDigest = ContentDigestSchema.parse(plan.baselineContentDigest);
      const providerId = typeof plan.providerId === "string" ? plan.providerId : this.#providerId;
      const exact = await this.#provider.readExactObject({
        locator: { providerId, contentDigest: markerDigest },
      });
      if (!exact.bytes.startsWith("base64url:")) throw new Error("strong baseline Provider encoding is invalid");
      const decoded = Buffer.from(exact.bytes.slice("base64url:".length), "base64url");
      baseline = InternalTaskBaselineV1Schema.parse(JSON.parse(decoded.toString("utf8")));
      baselineContentDigest = markerDigest;
      if (
        exact.verifiedContentDigest !== baselineContentDigest ||
        digest(baseline) !== baselineContentDigest ||
        baseline.artifactId !== input.taskBaselineArtifactId ||
        baseline.captureSnapshotId !== read.artifact.payload.snapshotId
      ) throw new Error("strong baseline Provider object mismatch");
    } else {
      const canPin = read.artifact.payload.headState.kind === "commit" &&
        read.artifact.payload.captureStatus === "complete" &&
        read.artifact.payload.redactedChanges.length === 0 &&
        read.artifact.payload.unknownStates.length === 0;
      const leaseIntent = canPin && read.artifact.payload.headState.kind === "commit"
        ? this.#repository.createStrongBaselineLeaseIntent({
            repositoryId: read.artifact.payload.repositoryId,
            worktreeId: read.artifact.payload.worktreeId,
            taskId: input.taskId,
            baselineSnapshotId: read.artifact.payload.snapshotId,
            objectFormat: read.artifact.payload.objectFormat,
            commit: read.artifact.payload.headState.commit,
            markerNonce,
          })
        : undefined;
      baseline = await this.#baseline(input.taskId, read.artifact.payload, leaseIntent);
      if (baseline.artifactId !== input.taskBaselineArtifactId) {
        throw new Error("strong baseline authority pin mismatch");
      }
      baselineContentDigest = digest(baseline);
      const locator = { providerId: this.#providerId, contentDigest: baselineContentDigest };
      const exact = await this.#provider.readExactObject({ locator });
      if (
        exact.verifiedContentDigest !== baselineContentDigest ||
        Buffer.from(exact.bytes.slice("base64url:".length), "base64url").toString("utf8") !== canonicalizeJson(baseline)
      ) throw new Error("strong baseline Provider object mismatch");
    }
    return {
      baseline,
      baselineContentDigest,
      snapshot: read.artifact.payload,
      snapshotArtifactId: read.artifact.artifactId,
      snapshotContentDigest: read.artifact.contentDigest,
    };
  }

  async buildCheckPreparation(input: Parameters<StrongChangeMaterialAuthorityV1["buildCheckPreparation"]>[0]): Promise<StrongChangeCheckPreparationV1> {
    if (input.baseline.baseline.captureStatus !== "complete") {
      const boundaries = input.baseline.baseline.boundaries;
      const graphPin = await this.#graphPin(input.actualSnapshot.snapshotId);
      const repositoryDelta = RepositoryDeltaV1Schema.parse({
        profile: "final-tree-delta-v1",
        taskId: input.task.manifest.taskId,
        baselineSnapshotId: input.baseline.snapshot.snapshotId,
        actualSnapshotId: input.actualSnapshot.snapshotId,
        paths: [],
        redactedAggregates: [],
        status: "unknown",
        boundaryIds: boundaries.map((boundary) => boundary.id),
      });
      const basisFields = {
        baselineSnapshotArtifactId: input.baseline.snapshotArtifactId,
        baselineSnapshotContentDigest: input.baseline.snapshotContentDigest,
        actualSnapshotArtifactId: input.actualSnapshotArtifactId,
        actualSnapshotContentDigest: input.actualSnapshotContentDigest,
        graphArtifactId: graphPin.artifactId,
        graphContentDigest: graphPin.contentDigest,
        graphSourceSnapshotId: graphPin.sourceSnapshotId,
        taskBaselineArtifactId: input.baseline.baseline.artifactId,
        taskBaselineContentDigest: input.baseline.baselineContentDigest,
      };
      const basisDigest = digest(["repository-basis-v1", basisFields]);
      const readSetDigest = digest(["repository-read-set-v1", basisFields, repositoryDelta]);
      const recordId = `repository-basis-record:${digest(["repository-basis-record-v1", basisDigest, readSetDigest]).slice("sha256:".length, 29)}`;
      const basis = RepositoryBasisProofV1Schema.parse({
        recordId,
        recordContentDigest: digest([recordId, basisDigest, readSetDigest]),
        basisDigest,
        readSetDigest,
        ...basisFields,
      });
      const usage = ChangeAnalysisUsageV1Schema.parse({
        changedFiles: 0,
        analyzedFiles: 0,
        bytes: 0,
        lines: 0,
        editWorkUnits: 0,
        hunks: 0,
        parserNodes: 0,
        matchingWorkUnits: 0,
        impactNodes: 0,
        impactEdges: 0,
        impactTraversalWorkUnits: 0,
        impactPaths: input.task.impactPathIds.length,
        excerptChars: 0,
        actualChanges: 0,
        evidenceItems: 0,
        symbolRefs: 0,
        serializedArtifactBytes: Buffer.byteLength(canonicalizeJson(repositoryDelta), "utf8"),
      });
      return StrongChangeCheckPreparationV1Schema.parse({
        profile: "strong_change_check_preparation_v1",
        task: input.task,
        baseline: input.baseline.baseline,
        baselineSnapshot: input.baseline.snapshot,
        actualSnapshot: input.actualSnapshot,
        basis,
        rulesetVersion: RULESET_VERSION,
        budget: BUDGET,
        usage,
        repositoryDelta,
        analyzedHunks: [],
        boundaries,
        authorityToken: input.actualSnapshot.repositoryStateToken,
      });
    }
    const material = await this.#materialWithBaseline(input.baseline, input.actualSnapshot);
    const paths = [];
    const analyzedHunks = [];
    const segmentsByPath = new Map<string, Array<{
      readonly item: StrongRepositoryChangeMaterialV1;
      readonly segment: {
        readonly id: string;
        readonly source: StrongRepositoryChangeMaterialV1["change"]["source"];
        readonly before: ReturnType<typeof publicState>;
        readonly after: ReturnType<typeof publicState>;
        readonly status: "complete";
        readonly boundaryIds: readonly string[];
      };
    }>>();
    for (const item of material.changes) {
      const before = publicState(item.before);
      const after = publicState(item.after);
      const segmentFields = {
        baselineSnapshotId: input.baseline.snapshot.snapshotId,
        actualSnapshotId: input.actualSnapshot.snapshotId,
        path: item.change.path,
        source: item.change.source,
        before,
        after,
      };
      const segment = {
        id: deriveStrongRepositoryDeltaSegmentIdV1(segmentFields),
        source: item.change.source,
        before,
        after,
        status: "complete" as const,
        boundaryIds: [],
      };
      const grouped = segmentsByPath.get(item.change.path) ?? [];
      grouped.push({ item, segment });
      segmentsByPath.set(item.change.path, grouped);
      const beforeBytes = item.before.bytes ?? Buffer.alloc(0);
      const afterBytes = item.after.bytes ?? Buffer.alloc(0);
      const diff = deterministicLineDiff({
        baselineSnapshotId: input.baseline.snapshot.snapshotId,
        actualSnapshotId: input.actualSnapshot.snapshotId,
        filePath: item.change.path,
        before: beforeBytes,
        after: afterBytes,
      });
      if (!diff.ok) throw new Error(`strong deterministic diff failed: ${diff.code}`);
      for (const raw of diff.hunks) {
        const hunkFields = {
          algorithm: "diff-lines-v1" as const,
          baselineSnapshotId: input.baseline.snapshot.snapshotId,
          actualSnapshotId: input.actualSnapshot.snapshotId,
          path: item.change.path,
          ...(item.change.oldPath === undefined ? {} : { oldPath: item.change.oldPath }),
          beforeContent: item.before.status === "absent"
            ? { status: "absent" as const }
            : { status: "content" as const, contentDigest: item.before.contentDigest! },
          afterContent: item.after.status === "absent"
            ? { status: "absent" as const }
            : { status: "content" as const, contentDigest: item.after.contentDigest! },
          oldSpan: raw.oldLineRange === undefined
            ? { startLine: 0, lineCount: 0 }
            : { startLine: raw.oldLineRange[0], lineCount: raw.oldLineRange[1] - raw.oldLineRange[0] + 1 },
          newSpan: raw.newLineRange === undefined
            ? { startLine: 0, lineCount: 0 }
            : { startLine: raw.newLineRange[0], lineCount: raw.newLineRange[1] - raw.newLineRange[0] + 1 },
          sourceLayers: [item.change.source],
          operations: raw.operations,
        };
        const identity = deriveStrongDiffHunkIdentityV1({
          ...hunkFields,
          operations: [...hunkFields.operations],
        });
        const hunk = DiffHunkV1Schema.parse({ ...hunkFields, ...identity });
        const oldSymbols = item.before.status === "content"
          ? symbolsForRange({
              snapshotId: input.baseline.snapshot.snapshotId,
              path: item.before.path,
              bytes: beforeBytes,
              graphNodes: material.graph.nodes,
              range: raw.oldLineRange,
            })
          : [];
        const newSymbols = item.after.status === "content"
          ? symbolsForRange({
              snapshotId: input.actualSnapshot.snapshotId,
              path: item.after.path,
              bytes: afterBytes,
              graphNodes: material.graph.nodes,
              range: raw.newLineRange,
            })
          : [];
        analyzedHunks.push(StrongAnalyzedHunkV1Schema.parse({
          hunk,
          oldSymbolRefs: oldSymbols,
          newSymbolRefs: newSymbols,
          pairingStatus: oldSymbols.length > 0 && newSymbols.length > 0
            ? (item.change.oldPath === undefined ? "exact" : "renamed")
            : oldSymbols.length > 0 ? "old_only"
              : newSymbols.length > 0 ? "new_only" : "file_only",
          semanticFacets: [/(?:^|\/)(?:test|tests|__tests__)(?:\/|$)|\.(?:test|spec)\./u.test(item.change.path) ? "TEST" : "BODY_LOGIC"],
          status: "complete",
          boundaryIds: [],
        }));
      }
    }
    for (const [path, grouped] of [...segmentsByPath.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      grouped.sort((left, right) => {
        const sourceOrder = (left.item.change.source === "baseline_reconciliation" ? 0 :
          left.item.change.source === "committed" ? 1 : left.item.change.source === "staged" ? 2 :
            left.item.change.source === "unstaged" ? 3 : left.item.change.source === "untracked" ? 4 : 5) -
          (right.item.change.source === "baseline_reconciliation" ? 0 :
            right.item.change.source === "committed" ? 1 : right.item.change.source === "staged" ? 2 :
              right.item.change.source === "unstaged" ? 3 : right.item.change.source === "untracked" ? 4 : 5);
        return sourceOrder || left.segment.id.localeCompare(right.segment.id);
      });
      const first = grouped[0]!;
      const last = grouped.at(-1)!;
      const segments = grouped.map((entry) => entry.segment);
      const effective = canonicalizeJson(first.segment.before) === canonicalizeJson(last.segment.after)
        ? undefined
        : (() => {
            const effectiveFields = {
              baselineSnapshotId: input.baseline.snapshot.snapshotId,
              actualSnapshotId: input.actualSnapshot.snapshotId,
              path,
              ...(first.item.change.oldPath === undefined ? {} : { oldPath: first.item.change.oldPath }),
              kind: changeKindForStates(first.item.before, last.item.after),
              before: first.segment.before,
              after: last.segment.after,
              sourceSegmentIds: segments.map((segment) => segment.id),
            };
            return {
              id: deriveStrongEffectiveRepositoryChangeIdV1(effectiveFields),
              kind: effectiveFields.kind,
              before: first.segment.before,
              after: last.segment.after,
              sourceSegmentIds: segments.map((segment) => segment.id),
              status: "complete" as const,
              boundaryIds: [],
            };
          })();
      const pathFields = {
        baselineSnapshotId: input.baseline.snapshot.snapshotId,
        actualSnapshotId: input.actualSnapshot.snapshotId,
        path,
        ...(first.item.change.oldPath === undefined ? {} : { oldPath: first.item.change.oldPath }),
        segmentIds: segments.map((segment) => segment.id),
        ...(effective === undefined ? {} : { effectiveChangeId: effective.id }),
      };
      paths.push({
        id: deriveStrongRepositoryPathDeltaIdV1(pathFields),
        path,
        ...(first.item.change.oldPath === undefined ? {} : { oldPath: first.item.change.oldPath }),
        segments,
        ...(effective === undefined ? {} : { effectiveChange: effective }),
      });
    }
    const repositoryDelta = RepositoryDeltaV1Schema.parse({
      profile: "final-tree-delta-v1",
      taskId: input.task.manifest.taskId,
      baselineSnapshotId: input.baseline.snapshot.snapshotId,
      actualSnapshotId: input.actualSnapshot.snapshotId,
      paths,
      redactedAggregates: [],
      status: "complete",
      boundaryIds: [],
    });
    const basisFields = {
      baselineSnapshotArtifactId: input.baseline.snapshotArtifactId,
      baselineSnapshotContentDigest: input.baseline.snapshotContentDigest,
      actualSnapshotArtifactId: input.actualSnapshotArtifactId,
      actualSnapshotContentDigest: input.actualSnapshotContentDigest,
      graphArtifactId: material.graphPin.artifactId,
      graphContentDigest: material.graphPin.contentDigest,
      graphSourceSnapshotId: material.graphPin.sourceSnapshotId,
      taskBaselineArtifactId: input.baseline.baseline.artifactId,
      taskBaselineContentDigest: input.baseline.baselineContentDigest,
    };
    const basisDigest = digest(["repository-basis-v1", basisFields]);
    const readSetDigest = digest(["repository-read-set-v1", basisFields, repositoryDelta]);
    const recordId = `repository-basis-record:${digest(["repository-basis-record-v1", basisDigest, readSetDigest]).slice("sha256:".length, 29)}`;
    const basis = RepositoryBasisProofV1Schema.parse({
      recordId,
      recordContentDigest: digest([recordId, basisDigest, readSetDigest]),
      basisDigest,
      readSetDigest,
      ...basisFields,
    });
    const symbolIds = new Set(analyzedHunks.flatMap((entry) => [
      ...entry.oldSymbolRefs.map((symbol) => symbol.id),
      ...entry.newSymbolRefs.map((symbol) => symbol.id),
    ]));
    const usage = ChangeAnalysisUsageV1Schema.parse({
      changedFiles: paths.length,
      analyzedFiles: paths.length,
      bytes: material.changes.reduce((total, entry) => total + (entry.before.bytes?.byteLength ?? 0) + (entry.after.bytes?.byteLength ?? 0), 0),
      lines: material.changes.reduce((total, entry) => total + (entry.before.bytes?.toString("utf8").split(/\r?\n/u).length ?? 0) + (entry.after.bytes?.toString("utf8").split(/\r?\n/u).length ?? 0), 0),
      editWorkUnits: analyzedHunks.reduce((total, entry) => total + entry.hunk.operations.length, 0),
      hunks: analyzedHunks.length,
      parserNodes: material.graph.nodes.length,
      matchingWorkUnits: analyzedHunks.length,
      impactNodes: 0,
      impactEdges: 0,
      impactTraversalWorkUnits: 0,
      impactPaths: input.task.impactPathIds.length,
      excerptChars: 0,
      actualChanges: paths.length,
      evidenceItems: analyzedHunks.length,
      symbolRefs: symbolIds.size,
      serializedArtifactBytes: Buffer.byteLength(canonicalizeJson({ repositoryDelta, analyzedHunks }), "utf8"),
    });
    return StrongChangeCheckPreparationV1Schema.parse({
      profile: "strong_change_check_preparation_v1",
      task: input.task,
      baseline: input.baseline.baseline,
      baselineSnapshot: input.baseline.snapshot,
      actualSnapshot: input.actualSnapshot,
      basis,
      rulesetVersion: RULESET_VERSION,
      budget: BUDGET,
      usage,
      repositoryDelta,
      analyzedHunks,
      boundaries: [],
      authorityToken: input.actualSnapshot.repositoryStateToken,
    });
  }

  async scanVerificationInput(input: StrongRecordVerificationInputV1) {
    return scanStrongVerificationDetailV1(input, this.#ownerKey);
  }

  async buildVerificationPreparation(input: Parameters<StrongChangeMaterialAuthorityV1["buildVerificationPreparation"]>[0]): Promise<StrongVerificationPreparationV1> {
    const current = await this.#store.readTaskBundle(input.operation.taskId);
    if (
      !("brief" in current.bundle) || current.bundle.changeChecks.length !== 1 ||
      current.bundle.manifest.taskBaselineArtifactId === undefined
    ) throw new Error("strong verification Task projection is incomplete");
    const planEntry = input.task.verificationPlan.find(
      (entry) => entry.verificationPlanEntryId === input.operation.verificationPlanEntryId,
    );
    if (planEntry === undefined) throw new Error("verification plan entry is missing");
    const check = current.bundle.changeChecks[0]!;
    if (!("analysis" in check) || check.analysis.profile !== "evidence_backed_v1") {
      throw new Error("strong Change Check is missing");
    }
    const snapshotRead = await this.#store.readArtifact("repository_snapshot", {
      snapshotId: input.operation.snapshotId,
    });
    if (snapshotRead.artifact.artifactType !== "repository_snapshot") {
      throw new Error("strong Verification Snapshot artifact is invalid");
    }
    const actualSnapshot = StrongRepositorySnapshotV1Schema.parse(
      snapshotRead.artifact.payload,
    );
    const baselineRead = await this.readPinnedTaskBaseline({
      taskId: input.operation.taskId,
      taskBaselineArtifactId: current.bundle.manifest.taskBaselineArtifactId,
      baselineSnapshotId: current.bundle.manifest.baselineSnapshotId,
    });
    const scanned = input.security ??
      await this.scanVerificationInput(input.operation);
    return StrongVerificationPreparationV1Schema.parse({
      profile: "strong_verification_preparation_v1",
      task: input.task,
      planEntry,
      changeCheckArtifactId: `artifact:change_check:${input.operation.taskId}`,
      changeCheckContentDigest: digest(check),
      changeCheck: check,
      priorRecords: current.bundle.verificationRecords.filter(
        (record) => "profile" in record && record.profile === "verification_record_strong_v1",
      ),
      basis: {
        recordId: check.analysis.basisRecordId,
        recordContentDigest: check.analysis.basisRecordContentDigest,
        basisDigest: check.analysis.repositoryBasisDigest,
        readSetDigest: check.analysis.repositoryReadSetDigest,
        baselineSnapshotArtifactId: baselineRead.snapshotArtifactId,
        baselineSnapshotContentDigest: baselineRead.snapshotContentDigest,
        actualSnapshotArtifactId: snapshotRead.artifact.artifactId,
        actualSnapshotContentDigest: snapshotRead.artifact.contentDigest,
        graphArtifactId: check.analysis.graphArtifactId,
        graphContentDigest: check.analysis.graphContentDigest,
        graphSourceSnapshotId: check.analysis.graphSourceSnapshotId,
        taskBaselineArtifactId: baselineRead.baseline.artifactId,
        taskBaselineContentDigest: baselineRead.baselineContentDigest,
      },
      ...scanned,
      authorityToken: actualSnapshot.repositoryStateToken,
    });
  }
}
