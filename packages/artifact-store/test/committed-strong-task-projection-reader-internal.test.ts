import { describe, expect, it, vi } from "vitest";
import {
  TaskEventV1Schema,
  canonicalTaskEventDigestJsonV1,
  canonicalizeJson,
  type TaskEventActionV1,
  type TaskEventV1,
  type TaskStatusV1,
  UpdateTaskInputV1Schema,
} from "@understand-code/contracts";
import { ArtifactStoreStrongChangeAuthorityV1 } from "../src/strong-change-authority.js";
import type { ArtifactStore } from "../src/store.js";
import * as publicApi from "../src/index.js";
import { sha256Bytes, sha256CanonicalJson } from "../src/digest.js";
import {
  readCommittedStrongTaskProjectionInternalV1 as readProjection,
} from "../src/committed-strong-task-projection-reader-internal.js";
import {
  parseStrongCanonicalTaskProjectionInternalV1,
  type StrongCanonicalTaskProjectionV1,
} from "../src/strong-canonical-task-projection-internal.js";

const taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const d = (char: string) => `sha256:${char.repeat(64)}`;
const baselineSnapshotId = `snapshot-${"a".repeat(64)}`;
const actualSnapshotId = `snapshot-${"b".repeat(64)}`;
const contextGenerationId = `context-generation:${"1".repeat(22)}`;
const taskBaselineArtifactId = `task-baseline:${"2".repeat(22)}`;
const verificationPlanEntryId = `verification-plan:${"3".repeat(22)}`;
const recordedAt = "2026-08-25T00:00:08.000Z";
const identity = { repositoryId: "repository:fixture", worktreeId: "worktree:fixture", taskId };

function projectionFixture(operation: StrongCanonicalTaskProjectionV1["operation"]) {
  const events: TaskEventV1[] = [];
  function event(action: TaskEventActionV1, resultingStatus: TaskStatusV1) {
    const previous = events.at(-1);
    const draft = TaskEventV1Schema.parse({
      schemaVersion: 1, ...identity, eventId: `event:${events.length + 1}`,
      previousRevision: events.length, revision: events.length + 1,
      actor: "codex", idempotencyKey: `request-${events.length + 1}`,
      requestDigest: d("8"), sourceSnapshotId: actualSnapshotId,
      occurredAt: recordedAt, resultingStatus, action, eventDigest: d("0"),
      ...(previous === undefined ? {} : {
        previousStatus: previous.resultingStatus, previousEventDigest: previous.eventDigest,
      }),
    });
    events.push({ ...draft, eventDigest: sha256Bytes(canonicalTaskEventDigestJsonV1(draft)) });
  }
  event({ type: "task_created" }, "created");
  for (const status of ["context_ready", "planned", "in_progress", "check_required"] as const) {
    event({ type: "transition_status", to: status }, status);
  }
  event({ type: "change_checked", changeCheckArtifactId: "artifact:check", changeCheckId: "change-check:fixture" }, "check_required");
  const check = {
    schemaVersion: 1, id: "change-check:fixture", taskId, taskRevision: 6,
    baselineSnapshotId, actualSnapshotId, findings: [], generatedAt: recordedAt,
    analysis: {
      profile: "evidence_backed_v1", rulesetVersion: "1.0.0",
      budget: {
        version: "change-analysis-budget-v1", maxChangedFiles: 1, maxBytesPerFile: 1,
        maxTotalBytes: 1, maxLinesPerFile: 1, maxTotalLines: 1, maxEditWorkUnits: 1,
        maxHunksPerFile: 1, maxTotalHunks: 1, maxParserNodesPerFile: 1,
        maxTotalParserNodes: 1, maxMatchingWorkUnits: 1, maxImpactNodes: 1,
        maxImpactEdges: 1, maxImpactTraversalWorkUnits: 1, maxImpactPaths: 1,
        maxExcerptCharsPerEvidence: 1, maxTotalExcerptChars: 1, maxActualChanges: 1,
        maxEvidenceItems: 1, maxSymbolRefs: 1, maxSerializedArtifactBytes: 1,
      },
      usage: {
        changedFiles: 0, analyzedFiles: 0, bytes: 0, lines: 0, editWorkUnits: 0,
        hunks: 0, parserNodes: 0, matchingWorkUnits: 0, impactNodes: 0,
        impactEdges: 0, impactTraversalWorkUnits: 0, impactPaths: 0,
        excerptChars: 0, actualChanges: 0, evidenceItems: 0, symbolRefs: 0,
        serializedArtifactBytes: 0,
      },
      basisRecordId: `repository-basis-record:${"3".repeat(22)}`,
      basisRecordContentDigest: d("3"), repositoryBasisDigest: d("4"),
      repositoryReadSetDigest: d("5"), graphArtifactId: "artifact:graph",
      graphContentDigest: d("d"), graphSourceSnapshotId: baselineSnapshotId,
      analysisInputDigest: d("6"), semanticDigest: d("7"),
      repositoryDelta: {
        profile: "final-tree-delta-v1", taskId, baselineSnapshotId, actualSnapshotId,
        paths: [], redactedAggregates: [], status: "complete", boundaryIds: [],
      },
      actualChanges: [],
      completeness: {
        overall: "complete",
        dimensions: ["repository_delta", "semantic_classification", "planned_matching", "impact_analysis", "verification_coverage"].map((dimension) => ({
          dimension, status: "complete", boundaryEvidenceIds: [],
          units: dimension === "verification_coverage" ? [{
            unitKind: "acceptance_claim", unitId: "claim:acceptance", status: "complete", boundaryEvidenceIds: [],
          }] : [],
        })),
      },
    },
  };
  const verification = {
    profile: "verification_record_strong_v1", id: `verification-record:${"4".repeat(22)}`,
    taskId, verificationPlanEntryId, contextGenerationId, attempt: 1,
    method: "manual", status: "passed", publicResultCode: "verification_passed",
    claimIds: ["claim:acceptance"], snapshotId: actualSnapshotId,
    changeCheckArtifactId: "artifact:check", changeCheckContentDigest: sha256CanonicalJson(check),
    detail: { status: "none" }, recordedAt,
  };
  if (operation !== "check_change") {
    event({ type: "transition_status", to: "verification_required" }, "verification_required");
    event({ type: "verification_recorded", verificationRecordId: verification.id }, "verification_required");
    if (operation === "update_task") event({ type: "transition_status", to: "verified" }, "verified");
  }
  const latest = events.at(-1)!;
  const readSet = {
    basisRecordId: `repository-basis-record:${"3".repeat(22)}`, basisDigest: d("4"),
    readSetDigest: d("5"), finalValidation: "provider_exact_cut_v1",
  };
  const impactConclusion = { status: "none_observed", impactPathIds: [], boundaryEvidenceIds: [] };
  const outcome = operation === "check_change" ? {
    profile: "strong_change_check_outcome_v1", changeCheck: check, findingClaims: [],
    evidence: [], impactConclusion, committedRevision: latest.revision, idempotentReplay: false,
    commitEvidence: {
      profile: "strong_change_commit_evidence_v1", recovery: { markerFirst: true, idempotencyReplaySafe: true },
      security: { scannerPolicyDigest: d("a"), safeGitExecutionDigest: d("b"), persistedExcerptChars: 0 },
      readSet, provenance: { taskBaselineArtifactId, baselineSnapshotId, actualSnapshotId, analysisInputDigest: d("6"), semanticDigest: d("7") },
    },
  } : {
    profile: "strong_verification_outcome_v1", verification,
    committedRevision: latest.revision, idempotentReplay: false,
    commitEvidence: {
      profile: "strong_verification_commit_evidence_v1",
      recovery: { attemptChainValidated: true, idempotencyReplaySafe: true },
      security: { detailPolicy: "scanned_or_keyed_commitment_v1", rawExecutionPersisted: false },
      readSet, provenance: { taskBaselineArtifactId, contextGenerationId, snapshotId: actualSnapshotId,
        changeCheckArtifactId: "artifact:check", changeCheckContentDigest: sha256CanonicalJson(check) },
    },
  };
  const result = {
    ...(operation === "check_change" ? { changeCheck: check } : { verification }),
    mutation: { taskId, revision: latest.revision, eventId: latest.eventId, artifactIds: ["artifact:check"], idempotentReplay: false },
    strongOutcome: outcome,
  };
  const manifest = {
    schemaVersion: 1, ...identity, title: "Exact committed projection", originalIntent: "Read committed results",
    status: latest.resultingStatus, baselineSnapshotId, latestSnapshotId: actualSnapshotId,
    taskProfile: "agent_task_v1", taskBaselineArtifactId, contextGenerationId,
    contextBuildSpec: { version: "context-build-spec-v1", scope: [], tokenBudget: 8_000, maxCandidates: 20, maxImpactDepth: 4 },
    createdAt: recordedAt, updatedAt: recordedAt, producerVersion: "1.0.0", revision: latest.revision,
    ...(operation !== "check_change"
      ? { currentChangeCheckId: check.id, currentChangeCheckRevision: check.taskRevision }
      : {}),
  };
  const finalOutcome = operation === "update_task" ? { task: manifest, mutation: result.mutation } : outcome;
  const finalResult = operation === "update_task" ? finalOutcome : result;
  const projection = {
    profile: "strong_canonical_task_projection_v1", operation, requestDigest: latest.requestDigest,
    bundle: {
      manifest,
      brief: { contextGenerationId, originalIntent: manifest.originalIntent, goalClaimId: "claim:goal",
        nonGoalClaimIds: [], acceptanceClaimIds: ["claim:acceptance"], readingPath: [], plannedChanges: [],
        assumptionClaimIds: [], riskClaimIds: [], unknownClaimIds: [],
        verificationPlan: [{ id: verificationPlanEntryId, acceptanceClaimIds: ["claim:acceptance"], method: "manual", description: "Inspect result", required: true }] },
      claims: [], evidence: [], impactPaths: [], impactConclusion, changeChecks: [check],
      verificationRecords: operation !== "check_change" ? [verification] : [], events,
      idempotencyRecords: [{ schemaVersion: 1, worktreeId: identity.worktreeId, scope: { kind: "task", taskId },
        idempotencyKey: latest.idempotencyKey, actor: latest.actor, requestDigest: latest.requestDigest,
        taskId, resultRevision: latest.revision, eventId: latest.eventId, resultDigest: sha256CanonicalJson(finalResult), createdAt: recordedAt }],
    },
    artifacts: [{ schemaVersion: 1, ...identity, artifactType: "change_check", artifactId: "artifact:check",
      sourceSnapshotId: actualSnapshotId, revision: latest.revision, producerVersion: "1.0.0", createdAt: recordedAt,
      contentDigest: sha256CanonicalJson(check), payload: check }],
    receipts: [{ schemaVersion: 1, operation, taskId, eventId: latest.eventId, resultDigest: sha256CanonicalJson(finalResult), result: finalResult }],
    outcome: finalOutcome,
  };
  return parseStrongCanonicalTaskProjectionInternalV1(projection, operation, latest.requestDigest);
}

function fixture(operation: StrongCanonicalTaskProjectionV1["operation"] = "check_change") {
  const projection = projectionFixture(operation);
  const head = {
    profile: "provider_runtime_durable_journal_state_v1", revision: 42,
    phase: operation === "check_change" ? "strong_change_check_v1" : operation === "record_verification" ? "strong_verification_v1" : "strong_task_verified_v1",
    operationNonce: "1".repeat(32), mutationDigest: d("2"),
    artifacts: {
      projectionProviderId: "provider:fixture", projectionContentDigest: "", projectionLogicalBytes: 0,
      requestDigest: projection.requestDigest, idempotencyKey: projection.bundle.events.at(-1)!.idempotencyKey,
      taskExpectedRevision: projection.bundle.manifest.revision - 1, providerExpectedRevision: 40,
    },
  };
  const read = { operation: "read_object", locator: { providerId: "provider:fixture", contentDigest: "" },
    logicalBytes: 0, bytes: "", verifiedContentDigest: "" };
  function setBytes(bytes: Uint8Array) {
    const contentDigest = sha256Bytes(bytes);
    head.artifacts.projectionContentDigest = contentDigest;
    head.artifacts.projectionLogicalBytes = bytes.length;
    Object.assign(read, { locator: { providerId: "provider:fixture", contentDigest }, logicalBytes: bytes.length,
      bytes: `base64url:${Buffer.from(bytes).toString("base64url")}`, verifiedContentDigest: contentDigest });
  }
  function setProjection(value: unknown) { setBytes(Buffer.from(canonicalizeJson(value))); }
  setProjection(projection);
  const provider = { inspectBusinessHead: vi.fn(async () => head), readExactObject: vi.fn(async () => read) };
  const expected = { taskId, operation, requestDigest: projection.requestDigest, committedRevision: projection.bundle.manifest.revision };
  return { projection, head, read, provider, expected, setProjection, setBytes };
}

const rejected = { code: "strong_change_provider_invalid" };

function authorityFixture(f: ReturnType<typeof fixture>, initial = f.projection) {
  let local = { ...initial, freshness: "fresh", latestSnapshotId: actualSnapshotId };
  let written: StrongCanonicalTaskProjectionV1 | undefined;
  const objects = new Map([[f.read.locator.contentDigest, structuredClone(f.read)]]);
  const store = {
    readTaskBundle: vi.fn(async () => local),
    reserveStrongOperationIntent: vi.fn(async (input: { proposedAt: string }) => input.proposedAt),
    readActiveStrongOperationBindingInternalV1: vi.fn(async () => undefined),
    resolveStrongOperationProviderRevision: vi.fn(async () => 42),
    advanceStrongOperationProviderRevision: vi.fn(async () => 43),
    abortReservedStrongOperationIntent: vi.fn(async () => false),
    persistTaskBundle: vi.fn(async () => {
      local = { ...written!, freshness: "fresh", latestSnapshotId: actualSnapshotId };
      return { replayed: false };
    }),
  };
  const provider = {
    inspectBusinessHead: f.provider.inspectBusinessHead,
    inspectState: vi.fn(async () => ({ revision: 42 })),
    readExactObject: vi.fn(async ({ locator }: { locator: { contentDigest: string } }) => objects.get(locator.contentDigest)!),
    writeExactObject: vi.fn(async (input: { locator: { providerId: string; contentDigest: string }; logicalBytes: number; bytes: string }) => {
      written = JSON.parse(Buffer.from(input.bytes.slice(10), "base64url").toString("utf8"));
      objects.set(input.locator.contentDigest, { operation: "read_object", ...input, verifiedContentDigest: input.locator.contentDigest });
      return { resolution: "committed" as const, verifiedContentDigest: input.locator.contentDigest };
    }),
    compareCommit: vi.fn(async (input: { artifacts: Readonly<Record<string, unknown>> }) => ({
      resolution: "committed" as "committed" | "stale", committedRevision: 43, artifacts: input.artifacts,
    })),
  };
  const authority = new ArtifactStoreStrongChangeAuthorityV1(store as unknown as ArtifactStore, { provider, providerId: "provider:fixture" });
  const input = UpdateTaskInputV1Schema.parse({ taskId, expectedRevision: initial.bundle.manifest.revision,
    actor: "codex", idempotencyKey: "verified-now", action: { type: "transition_status", to: "verified" } });
  return { authority, provider, store, input };
}

function noRequiredPredecessor(f: ReturnType<typeof fixture>): StrongCanonicalTaskProjectionV1 {
  const prior = f.projection.bundle;
  if (!("brief" in prior)) throw new Error("fixture requires full Task");
  const source = { ...f.projection, bundle: { ...prior,
    brief: { ...prior.brief, verificationPlan: prior.brief.verificationPlan.map((entry) => ({ ...entry, required: false })) } } };
  f.setProjection(source);
  const at = "2026-08-25T00:00:09.000Z";
  const action = { type: "transition_status", to: "verification_required" } as const;
  const input = UpdateTaskInputV1Schema.parse({ taskId, action, expectedRevision: prior.manifest.revision,
    actor: "codex", idempotencyKey: "verification-required" });
  const manifest = { ...prior.manifest, status: "verification_required" as const, revision: prior.manifest.revision + 1,
    currentChangeCheckId: prior.changeChecks[0]!.id, currentChangeCheckRevision: prior.changeChecks[0]!.taskRevision, updatedAt: at };
  const draft = TaskEventV1Schema.parse({ ...identity, schemaVersion: 1,
    eventId: `event:${taskId}:${manifest.revision}`, previousRevision: prior.manifest.revision, revision: manifest.revision,
    actor: input.actor, idempotencyKey: input.idempotencyKey, requestDigest: sha256CanonicalJson(input),
    sourceSnapshotId: actualSnapshotId, occurredAt: at, previousStatus: prior.manifest.status, resultingStatus: manifest.status,
    previousContextGenerationId: contextGenerationId, resultingContextGenerationId: contextGenerationId,
    action, previousEventDigest: prior.events.at(-1)!.eventDigest, eventDigest: d("0") });
  const event = { ...draft, eventDigest: sha256Bytes(canonicalTaskEventDigestJsonV1(draft)) };
  const result = { task: manifest, mutation: { taskId, revision: manifest.revision, eventId: event.eventId,
    artifactIds: source.artifacts.map((artifact) => artifact.artifactId), idempotentReplay: false } };
  const receipt = { schemaVersion: 1 as const, operation: "update_task" as const, taskId, eventId: event.eventId,
    resultDigest: sha256CanonicalJson(result), result };
  const entry = { ...prior.idempotencyRecords.at(-1)!, idempotencyKey: input.idempotencyKey,
    requestDigest: event.requestDigest, resultRevision: manifest.revision, eventId: event.eventId,
    resultDigest: receipt.resultDigest, createdAt: at };
  return { ...source, bundle: { ...source.bundle, manifest, events: [...prior.events, event],
    idempotencyRecords: [...prior.idempotencyRecords, entry] },
    receipts: [...source.receipts, receipt], artifacts: source.artifacts.map((artifact) => ({ ...artifact, revision: manifest.revision, createdAt: at })) };
}

describe("Provider verified Task commit boundaries", () => {
  it("rejects Provider drift after the exact source read and before intent activation", async () => {
    const f = authorityFixture(fixture("record_verification"));
    f.provider.inspectState.mockResolvedValue({ revision: 43 });
    await expect(f.authority.commitTaskVerified(f.input, "2026-08-25T00:00:10.000Z"))
      .rejects.toMatchObject({ code: "repository_cas_conflict" });
    expect(f.provider.writeExactObject).not.toHaveBeenCalled();
    expect(f.store.persistTaskBundle).not.toHaveBeenCalled();
  });
  it("rejects drift at CAS without rebasing the verified Task onto another Provider head", async () => {
    const f = authorityFixture(fixture("record_verification"));
    f.provider.compareCommit.mockImplementation(async (input) => ({ resolution: "stale", committedRevision: 43, artifacts: input.artifacts }));
    await expect(f.authority.commitTaskVerified(f.input, "2026-08-25T00:00:10.000Z"))
      .rejects.toMatchObject({ code: "repository_cas_conflict" });
    expect(f.provider.compareCommit).toHaveBeenCalledTimes(1);
    expect(f.store.advanceStrongOperationProviderRevision).not.toHaveBeenCalled();
    expect(f.store.persistTaskBundle).not.toHaveBeenCalled();
  });
  it("allows no-required verification only after the exact reconstructed ordinary transition", async () => {
    const source = fixture("check_change");
    const local = noRequiredPredecessor(source);
    const f = authorityFixture(source, local);
    const result = await f.authority.commitTaskVerified(f.input, "2026-08-25T00:00:10.000Z");
    expect(result.task.status).toBe("verified");
    expect(result.mutation.idempotentReplay).toBe(false);
    expect(f.provider.compareCommit).toHaveBeenCalledTimes(1);
  });
  it("does not authenticate an extra local semantic delta on the no-required path", async () => {
    const source = fixture("check_change");
    const local = noRequiredPredecessor(source);
    const f = authorityFixture(source, { ...local, bundle: { ...local.bundle,
      manifest: { ...local.bundle.manifest, title: "unauthenticated local edit" } } });
    await expect(f.authority.commitTaskVerified(f.input, "2026-08-25T00:00:10.000Z"))
      .rejects.toMatchObject({ code: "repository_read_set_conflict" });
    expect(f.provider.compareCommit).not.toHaveBeenCalled();
  });
});

describe("internal committed strong task projection reader", () => {
  it.each(["check_change", "record_verification", "update_task"] as const)("reads and deeply freezes the exact committed %s projection", async (operation) => {
    const f = fixture(operation);
    const result = await readProjection(f.provider, f.expected);
    expect(result).toEqual(f.projection);
    expect(f.provider.readExactObject).toHaveBeenCalledExactlyOnceWith(f.read.locator);
    expect(f.provider.inspectBusinessHead).toHaveBeenCalledTimes(2);
    function frozen(value: unknown): void {
      if (typeof value === "object" && value !== null) {
        expect(Object.isFrozen(value)).toBe(true);
        Object.values(value).forEach(frozen);
      }
    }
    frozen(result);
    expect(Object.isFrozen(f.projection)).toBe(false);
  });

  it("stays outside the public barrel", () => {
    expect("readCommittedStrongTaskProjectionInternalV1" in publicApi).toBe(false);
    expect("parseStrongCanonicalTaskProjectionInternalV1" in publicApi).toBe(false);
  });

  it.each(["revision", "phase", "operationNonce", "mutationDigest", "artifacts"] as const)("rejects an in-place %s change while reading", async (field) => {
    const f = fixture();
    f.provider.readExactObject.mockImplementationOnce(async () => {
      if (field === "revision") f.head.revision++;
      else if (field === "artifacts") f.head.artifacts.idempotencyKey = "another";
      else f.head[field] = "changed";
      return f.read;
    });
    await expect(readProjection(f.provider, f.expected)).rejects.toMatchObject(rejected);
  });

  it.each(["task", "operation", "request", "revision"])("rejects a mismatched expected %s pin", async (pin) => {
    const f = fixture();
    if (pin === "task") f.expected.taskId = "01ARZ3NDEKTSV4RRFFQ69G5FAW";
    if (pin === "operation") f.expected.operation = "record_verification";
    if (pin === "request") f.expected.requestDigest = d("9");
    if (pin === "revision") f.expected.committedRevision++;
    await expect(readProjection(f.provider, f.expected)).rejects.toMatchObject(rejected);
  });

  it("allows omitted optional pins but snapshots supplied pins before awaiting", async () => {
    const f = fixture();
    await expect(readProjection(f.provider, { taskId, operation: "check_change" })).resolves.toEqual(f.projection);
    f.provider.inspectBusinessHead.mockImplementationOnce(async () => {
      f.expected.requestDigest = d("9"); f.expected.committedRevision++;
      return f.head;
    });
    await expect(readProjection(f.provider, f.expected)).resolves.toEqual(f.projection);
  });

  it.each(["descriptor digest", "descriptor bytes", "task revision", "provider revision", "request digest", "key", "phase", "head profile", "response digest", "response locator", "response length", "response operation", "padding", "raw corruption"])("rejects %s mismatch", async (kind) => {
    const f = fixture();
    if (kind === "descriptor digest") f.head.artifacts.projectionContentDigest = d("9");
    if (kind === "descriptor bytes") f.head.artifacts.projectionLogicalBytes++;
    if (kind === "task revision") f.head.artifacts.taskExpectedRevision++;
    if (kind === "provider revision") f.head.artifacts.providerExpectedRevision = f.head.revision;
    if (kind === "request digest") f.head.artifacts.requestDigest = d("9");
    if (kind === "key") f.head.artifacts.idempotencyKey = "wrong-key";
    if (kind === "phase") f.head.phase = "uninitialized";
    if (kind === "head profile") f.head.profile = "wrong";
    if (kind === "response digest") f.read.verifiedContentDigest = d("9");
    if (kind === "response locator") f.read.locator.providerId = "provider:other";
    if (kind === "response length") f.read.logicalBytes++;
    if (kind === "response operation") f.read.operation = "write_object";
    if (kind === "padding") f.read.bytes += "=";
    if (kind === "raw corruption") f.read.bytes = f.read.bytes.slice(0, -4) + "AAAA";
    await expect(readProjection(f.provider, f.expected)).rejects.toMatchObject(rejected);
  });

  it.each(["whitespace", "BOM", "invalid UTF8", "invalid JSON"])("rejects digest-valid noncanonical %s bytes", async (kind) => {
    const f = fixture();
    const json = canonicalizeJson(f.projection);
    f.setBytes(kind === "invalid UTF8" ? Buffer.from([0xff]) : Buffer.from(
      kind === "whitespace" ? `${json}\n` : kind === "BOM" ? `\uFEFF${json}` : "{",
    ));
    await expect(readProjection(f.provider, f.expected)).rejects.toMatchObject(rejected);
  });

  const projectionMutations: [string, (p: StrongCanonicalTaskProjectionV1) => unknown][] = [
    ["replayed outcome", (p) => ({ ...p, outcome: { ...p.outcome, idempotentReplay: true } })],
    ["foreign operation", (p) => ({ ...p, operation: "record_verification" })],
    ["foreign request", (p) => ({ ...p, requestDigest: d("9") })],
    ["foreign artifact", (p) => ({ ...p, artifacts: p.artifacts.map((a) => ({ ...a, taskId: "01ARZ3NDEKTSV4RRFFQ69G5FAW" })) })],
    ["outcome revision", (p) => ({ ...p, outcome: { ...p.outcome, committedRevision: 99 } })],
    ["missing receipt", (p) => ({ ...p, receipts: [] })],
    ["duplicate receipt", (p) => ({ ...p, receipts: [...p.receipts, ...p.receipts] })],
    ["receipt digest", (p) => ({ ...p, receipts: p.receipts.map((r) => ({ ...r, resultDigest: d("9") })) })],
    ["event request", (p) => ({ ...p, bundle: { ...p.bundle, events: p.bundle.events.map((e, i) => i === p.bundle.events.length - 1 ? { ...e, requestDigest: d("9") } : e) } })],
    ["idempotency revision", (p) => ({ ...p, bundle: { ...p.bundle, idempotencyRecords: p.bundle.idempotencyRecords.map((r) => ({ ...r, resultRevision: 99 })) } })],
    ["invalid schema", (p) => ({ ...p, outcome: { ...p.outcome, profile: "invalid" } })],
    ["extra canonical field", (p) => ({ ...p, hostSaidSuccess: true })],
  ];
  it.each(projectionMutations)("rejects digest-valid %s projection", async (_name, mutate) => {
    const f = fixture(); f.setProjection(mutate(f.projection));
    await expect(readProjection(f.provider, f.expected)).rejects.toMatchObject(rejected);
  });

  it.each(["first head", "object", "second head"])("fails closed on %s provider failure", async (stage) => {
    const f = fixture();
    if (stage === "object") f.provider.readExactObject.mockRejectedValueOnce(new Error("unavailable"));
    else if (stage === "first head") f.provider.inspectBusinessHead.mockRejectedValueOnce(new Error("unavailable"));
    else f.provider.inspectBusinessHead.mockResolvedValueOnce(f.head).mockRejectedValueOnce(new Error("unavailable"));
    await expect(readProjection(f.provider, f.expected)).rejects.toMatchObject(rejected);
  });
});
