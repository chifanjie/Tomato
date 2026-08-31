import {
  ContentDigestSchema,
  TaskIdSchema,
  canonicalizeJson,
  type ContentDigest,
} from "@understand-code/contracts";

import { sha256Bytes, sha256CanonicalJson } from "./digest.js";
import { StrongChangeAuthorityErrorV1 } from "./strong-change-authority.js";
import {
  parseStrongCanonicalTaskProjectionInternalV1,
  type StrongCanonicalTaskProjectionV1,
} from "./strong-canonical-task-projection-internal.js";

/** The actual production provider's read-only port; not a Host result port. */
export interface CommittedStrongTaskProjectionProviderInternalV1 {
  inspectBusinessHead(): Promise<unknown>;
  readExactObject(locator: Readonly<{
    providerId: string;
    contentDigest: ContentDigest;
  }>): Promise<unknown>;
}

export interface CommittedStrongTaskProjectionExpectedInternalV1 {
  readonly taskId: string;
  readonly operation: StrongCanonicalTaskProjectionV1["operation"];
  readonly requestDigest?: ContentDigest;
  readonly committedRevision?: number;
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("expected a JSON object");
  }
  return value as Record<string, unknown>;
}

function safeRevision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("invalid revision");
  }
  return value;
}

function freezeDeep<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

/**
 * INTERNAL: call only on the root-owned provider client. No caller-supplied
 * outcome is authoritative. A moving business head invalidates the read.
 */
export async function readCommittedStrongTaskProjectionInternalV1(
  provider: CommittedStrongTaskProjectionProviderInternalV1,
  expected: CommittedStrongTaskProjectionExpectedInternalV1,
): Promise<StrongCanonicalTaskProjectionV1> {
  try {
    // Snapshot caller pins before the first await, and the head before reading
    // bytes, so mutation of either aliased object cannot change this read.
    const taskId = TaskIdSchema.parse(expected.taskId);
    const operation = expected.operation;
    if (operation !== "check_change" && operation !== "record_verification") {
      throw new TypeError("invalid projection operation");
    }
    const expectedRequestDigest = expected.requestDigest === undefined
      ? undefined : ContentDigestSchema.parse(expected.requestDigest);
    const expectedRevision = expected.committedRevision === undefined
      ? undefined : safeRevision(expected.committedRevision);
    const headIdentity = canonicalizeJson(await provider.inspectBusinessHead());
    const head = record(JSON.parse(headIdentity));
    const phase = operation === "check_change"
      ? "strong_change_check_v1" : "strong_verification_v1";
    if (
      Object.keys(head).sort().join(",") !==
        "artifacts,mutationDigest,operationNonce,phase,profile,revision" ||
      head.profile !== "provider_runtime_durable_journal_state_v1" ||
      head.phase !== phase ||
      typeof head.operationNonce !== "string" ||
      !/^[a-f0-9]{32}$/u.test(head.operationNonce)
    ) throw new TypeError("invalid business head");
    ContentDigestSchema.parse(head.mutationDigest);
    const providerRevision = safeRevision(head.revision);
    const descriptor = record(head.artifacts);
    const contentDigest = ContentDigestSchema.parse(descriptor.projectionContentDigest);
    const requestDigest = ContentDigestSchema.parse(descriptor.requestDigest);
    const logicalBytes = safeRevision(descriptor.projectionLogicalBytes);
    const taskExpectedRevision = safeRevision(descriptor.taskExpectedRevision);
    const providerExpectedRevision = safeRevision(descriptor.providerExpectedRevision);
    if (
      typeof descriptor.projectionProviderId !== "string" ||
      descriptor.projectionProviderId.length === 0 ||
      typeof descriptor.idempotencyKey !== "string" ||
      descriptor.idempotencyKey.length === 0 ||
      providerExpectedRevision >= providerRevision ||
      (expectedRequestDigest !== undefined && requestDigest !== expectedRequestDigest)
    ) throw new TypeError("invalid projection descriptor");
    const locator = Object.freeze({
      providerId: descriptor.projectionProviderId,
      contentDigest,
    });
    const read = record(await provider.readExactObject(locator));
    if (
      read.operation !== "read_object" ||
      canonicalizeJson(read.locator) !== canonicalizeJson(locator) ||
      read.verifiedContentDigest !== contentDigest ||
      read.logicalBytes !== logicalBytes ||
      typeof read.bytes !== "string" ||
      !/^base64url:[A-Za-z0-9_-]*$/u.test(read.bytes)
    ) throw new TypeError("invalid exact projection object");
    const encoded = read.bytes.slice("base64url:".length);
    const bytes = Buffer.from(encoded, "base64url");
    if (
      bytes.toString("base64url") !== encoded ||
      bytes.length !== logicalBytes ||
      sha256Bytes(bytes) !== contentDigest
    ) throw new TypeError("projection byte identity mismatch");
    const json = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    const projection = parseStrongCanonicalTaskProjectionInternalV1(
      JSON.parse(json), operation, requestDigest,
    );
    if (canonicalizeJson(projection) !== json) {
      throw new TypeError("projection is not canonical JSON");
    }
    const { bundle, outcome, receipts } = projection;
    const revision = bundle.manifest.revision;
    const event = bundle.events.at(-1);
    const currentReceipts = receipts.filter((receipt) => receipt.eventId === event?.eventId);
    const currentRecords = bundle.idempotencyRecords.filter((entry) => entry.eventId === event?.eventId);
    const receipt = currentReceipts[0];
    const entry = currentRecords[0];
    if (
      bundle.manifest.taskId !== taskId ||
      bundle.manifest.taskProfile !== "agent_task_v1" ||
      !("impactConclusion" in bundle) ||
      taskExpectedRevision !== revision - 1 ||
      (expectedRevision !== undefined && revision !== expectedRevision) ||
      event === undefined || event.taskId !== taskId || event.revision !== revision ||
      event.repositoryId !== bundle.manifest.repositoryId ||
      event.worktreeId !== bundle.manifest.worktreeId ||
      event.sourceSnapshotId !== bundle.manifest.latestSnapshotId ||
      event.previousRevision !== taskExpectedRevision || event.requestDigest !== requestDigest ||
      event.idempotencyKey !== descriptor.idempotencyKey ||
      currentReceipts.length !== 1 || receipt === undefined ||
      receipt.operation !== operation || receipt.taskId !== taskId ||
      receipt.result.mutation.revision !== revision ||
      !("strongOutcome" in receipt.result) ||
      canonicalizeJson(receipt.result.strongOutcome) !== canonicalizeJson(outcome) ||
      receipt.resultDigest !== sha256CanonicalJson(receipt.result) ||
      currentRecords.length !== 1 || entry === undefined ||
      entry.taskId !== taskId || entry.resultRevision !== revision ||
      entry.worktreeId !== bundle.manifest.worktreeId || entry.actor !== event.actor ||
      entry.scope.kind !== "task" || entry.scope.taskId !== taskId ||
      entry.requestDigest !== requestDigest || entry.idempotencyKey !== descriptor.idempotencyKey ||
      entry.resultDigest !== receipt.resultDigest ||
      receipts.some((item) => item.taskId !== taskId)
    ) throw new TypeError("committed projection identity mismatch");
    if (outcome.profile === "strong_change_check_outcome_v1") {
      if (
        event.action.type !== "change_checked" ||
        event.action.changeCheckId !== outcome.changeCheck.id ||
        receipt.operation !== "check_change" ||
        canonicalizeJson(receipt.result.changeCheck) !== canonicalizeJson(outcome.changeCheck) ||
        outcome.changeCheck.taskId !== taskId || outcome.changeCheck.taskRevision !== revision ||
        !bundle.changeChecks.some((check) => canonicalizeJson(check) === canonicalizeJson(outcome.changeCheck))
      ) throw new TypeError("committed check identity mismatch");
    } else if (
      event.action.type !== "verification_recorded" ||
      event.action.verificationRecordId !== outcome.verification.id ||
      receipt.operation !== "record_verification" ||
      canonicalizeJson(receipt.result.verification) !== canonicalizeJson(outcome.verification) ||
      outcome.verification.taskId !== taskId ||
      !bundle.verificationRecords.some((item) => canonicalizeJson(item) === canonicalizeJson(outcome.verification))
    ) throw new TypeError("committed verification identity mismatch");
    if (canonicalizeJson(await provider.inspectBusinessHead()) !== headIdentity) {
      throw new TypeError("business head changed while reading projection");
    }
    return freezeDeep(projection);
  } catch {
    throw new StrongChangeAuthorityErrorV1("strong_change_provider_invalid");
  }
}
