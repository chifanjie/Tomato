import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { isAbsolute, join, normalize } from "node:path";

import { digestDomainInternalV1 } from "./crypto-internal.js";
import { ProviderAcceptanceAuthorityErrorV1 } from "./errors.js";
import {
  canonicalAuthorityBytesInternalV1,
  ensureProviderAcceptanceAuthorityDirectoriesInternalV1,
  isMissingFileInternalV1,
  parseCanonicalAuthorityBytesInternalV1,
  publishPreparedAuthorityStageInternalV1,
  readCheckedAuthorityFileInternalV1,
  replaceDurableAuthoritySnapshotInternalV1,
  type ProviderAcceptanceAuthorityDurablePhaseInternalV1,
} from "./filesystem-internal.js";
import type {
  ProviderAcceptanceAuthorityLayoutInternalV1,
} from "./platform-layout.js";

export const STEP16_RECEIPT_BINDING_JOURNAL_LOGICAL_LOCATOR_INTERNAL_V1 =
  "runtime-state/private/step16-receipt-binding-v1.journal.json" as const;
export const STEP16_RECEIPT_BINDING_JOURNAL_STAGE_LOGICAL_LOCATOR_INTERNAL_V1 =
  "runtime-state/private/.step16-receipt-binding-v1.journal.stage" as const;
export const STEP16_RECEIPT_BINDING_MAX_OPERATIONS_INTERNAL_V1 = 4_096;

const MAX_JOURNAL_BYTES_V1 = 32 * 1024 * 1024;
const MAX_LEDGER_ENTRIES_V1 = 1_000_000;
const STATE_DIGEST_DOMAIN_V1 =
  "provider-step16-receipt-binding-durable-journal-state-v1";
const PREFIX_DIGEST_DOMAIN_V1 =
  "provider-step16-receipt-binding-ordered-ledger-prefix-v1";

type DigestV1 = `sha256:${string}`;

export interface Step16ReceiptBindingJournalBaselineInternalV1 {
  readonly intentCount: number;
  readonly orderedPrefixDigest: DigestV1;
}

export interface Step16ReceiptBindingJournalExpectedOperationInternalV1 {
  readonly operation: "write_object" | "compare_commit";
  readonly operationNonce: string;
  readonly requestDigest: DigestV1;
}

export interface Step16ReceiptBindingJournalCompletionInternalV1 {
  readonly sessionIdDigest: DigestV1;
  readonly callIdDigest: DigestV1;
  readonly publicBindings: readonly Readonly<Record<string, unknown>>[];
}

export interface Step16ReceiptBindingJournalCallIdentityInternalV1 {
  readonly runNonce: string;
  readonly closingPlanDigest: DigestV1;
  readonly callOrdinal: number;
  readonly eventOrdinal: number;
  readonly tool: string;
  readonly argumentsDigest: DigestV1;
  readonly sessionIdDigest: DigestV1;
  readonly callIdDigest: DigestV1;
}

export interface Step16ReceiptBindingJournalArmInternalV1 {
  readonly host: "codex" | "claude";
  readonly baseline: Step16ReceiptBindingJournalBaselineInternalV1;
  readonly callIdentity: Step16ReceiptBindingJournalCallIdentityInternalV1;
}

export interface Step16ReceiptBindingJournalStateInternalV1 {
  readonly profile: "step16_receipt_binding_durable_journal_v1";
  readonly revision: number;
  readonly previousStateDigest: DigestV1 | "none";
  readonly phase: "armed" | "host_completed" | "finalized" | "aborted";
  readonly host: "codex" | "claude";
  /** Cumulative across every arm, including aborted calls; never reset. */
  readonly totalOperationCount: number;
  readonly callIdentity: Step16ReceiptBindingJournalCallIdentityInternalV1;
  readonly baseline: Step16ReceiptBindingJournalBaselineInternalV1;
  readonly expectedProviderOperations:
    readonly Step16ReceiptBindingJournalExpectedOperationInternalV1[];
  readonly completion: Step16ReceiptBindingJournalCompletionInternalV1 | null;
  readonly stateDigest: DigestV1;
}

export interface Step16ReceiptBindingBrokerLedgerEntryInternalV1 {
  readonly bundleDigest: DigestV1;
  readonly operation: "write_object" | "compare_commit";
  readonly operationNonce: string;
  readonly requestDigest: DigestV1;
}

export interface Step16ReceiptBindingBrokerLedgerViewInternalV1 {
  readonly pendingCount: number;
  readonly intentCount: number;
  readonly bundles: readonly Step16ReceiptBindingBrokerLedgerEntryInternalV1[];
}

export type Step16ReceiptBindingJournalDurablePhaseInternalV1 =
  | "stage_file_fsynced"
  | "canonical_renamed"
  | "directory_fsynced";

export interface Step16ReceiptBindingJournalDurabilityHooksInternalV1 {
  readonly afterDurablePhase?: (
    phase: Step16ReceiptBindingJournalDurablePhaseInternalV1,
  ) => void | Promise<void>;
}

declare const step16ReceiptBindingJournalCapabilityBrandInternalV1:
  unique symbol;
export interface Step16ReceiptBindingJournalCapabilityInternalV1 {
  readonly [step16ReceiptBindingJournalCapabilityBrandInternalV1]: true;
}

interface JournalCapabilityStateV1 {
  readonly layout: ProviderAcceptanceAuthorityLayoutInternalV1;
  readonly canonicalPath: string;
  readonly stagePath: string;
  readonly hooks: Step16ReceiptBindingJournalDurabilityHooksInternalV1;
  current: Step16ReceiptBindingJournalStateInternalV1 | undefined;
}

const CAPABILITY_STATES_V1 = new WeakMap<object, JournalCapabilityStateV1>();
// The production owner must also hold its cross-process authority lease. This
// queue prevents distinct capabilities in that owner from racing one stage.
const PATH_TAILS_V1 = new Map<string, Promise<void>>();
const PROCESS_HIGH_WATER_V1 = new Map<
  string,
  Step16ReceiptBindingJournalStateInternalV1
>();

function rejectInvalidRequestV1(): never {
  throw new ProviderAcceptanceAuthorityErrorV1("invalid_request");
}

function rejectIntegrityV1(): never {
  throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
}

function exactRecordKeysV1(
  value: unknown,
  expected: readonly string[],
): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const actual = Reflect.ownKeys(value);
    return actual.length === expected.length && actual.every((key) => {
      if (typeof key !== "string" || !expected.includes(key)) return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor !== undefined && "value" in descriptor &&
        descriptor.enumerable === true;
    });
  } catch {
    return false;
  }
}

function isDigestV1(value: unknown): value is DigestV1 {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);
}

function safeCountV1(value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    value >= 0 && value <= maximum;
}

function freezeJsonV1(value: unknown): unknown {
  if (Array.isArray(value)) {
    for (const entry of value) freezeJsonV1(entry);
    return Object.freeze(value);
  }
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      freezeJsonV1(entry);
    }
    return Object.freeze(value);
  }
  return value;
}

function canonicalCloneV1(value: unknown): unknown {
  try {
    const bytes = canonicalAuthorityBytesInternalV1(value);
    if (bytes.byteLength > MAX_JOURNAL_BYTES_V1) {
      throw new ProviderAcceptanceAuthorityErrorV1("capacity_exhausted");
    }
    return freezeJsonV1(parseCanonicalAuthorityBytesInternalV1(bytes));
  } catch (error) {
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    return rejectInvalidRequestV1();
  }
}

function parseBaselineV1(
  value: unknown,
  disk: boolean,
): Step16ReceiptBindingJournalBaselineInternalV1 {
  if (
    !exactRecordKeysV1(value, ["intentCount", "orderedPrefixDigest"]) ||
    !safeCountV1(value.intentCount, MAX_LEDGER_ENTRIES_V1) ||
    !isDigestV1(value.orderedPrefixDigest)
  ) {
    return disk ? rejectIntegrityV1() : rejectInvalidRequestV1();
  }
  return Object.freeze({
    intentCount: value.intentCount,
    orderedPrefixDigest: value.orderedPrefixDigest,
  });
}

function parseCallIdentityV1(
  value: unknown,
  disk: boolean,
): Step16ReceiptBindingJournalCallIdentityInternalV1 {
  if (!exactRecordKeysV1(value, [
    "runNonce", "closingPlanDigest", "callOrdinal", "eventOrdinal", "tool",
    "argumentsDigest", "sessionIdDigest", "callIdDigest",
  ]) || typeof value.runNonce !== "string" || !/^[0-9a-f]{64}$/u.test(value.runNonce) ||
    !isDigestV1(value.closingPlanDigest) || !safeCountV1(value.callOrdinal, 256) ||
    value.callOrdinal < 1 || !safeCountV1(value.eventOrdinal, 4_096) ||
    value.eventOrdinal < 1 || typeof value.tool !== "string" ||
    !/^[A-Za-z0-9_.:-]{1,128}$/u.test(value.tool) ||
    !isDigestV1(value.argumentsDigest) || !isDigestV1(value.sessionIdDigest) ||
    !isDigestV1(value.callIdDigest)) {
    return disk ? rejectIntegrityV1() : rejectInvalidRequestV1();
  }
  return Object.freeze({
    runNonce: value.runNonce, closingPlanDigest: value.closingPlanDigest,
    callOrdinal: value.callOrdinal, eventOrdinal: value.eventOrdinal,
    tool: value.tool, argumentsDigest: value.argumentsDigest,
    sessionIdDigest: value.sessionIdDigest, callIdDigest: value.callIdDigest,
  });
}

function parseOperationV1(
  value: unknown,
  disk: boolean,
): Step16ReceiptBindingJournalExpectedOperationInternalV1 {
  if (
    !exactRecordKeysV1(value, [
      "operation",
      "operationNonce",
      "requestDigest",
    ]) ||
    (value.operation !== "write_object" &&
      value.operation !== "compare_commit") ||
    typeof value.operationNonce !== "string" ||
    !/^[0-9a-f]{32}$/u.test(value.operationNonce) ||
    !isDigestV1(value.requestDigest)
  ) {
    return disk ? rejectIntegrityV1() : rejectInvalidRequestV1();
  }
  return Object.freeze({
    operation: value.operation,
    operationNonce: value.operationNonce,
    requestDigest: value.requestDigest,
  });
}

function parseOperationsV1(
  value: unknown,
  disk: boolean,
): readonly Step16ReceiptBindingJournalExpectedOperationInternalV1[] {
  if (
    !Array.isArray(value) ||
    value.length > STEP16_RECEIPT_BINDING_MAX_OPERATIONS_INTERNAL_V1
  ) return disk ? rejectIntegrityV1() : rejectInvalidRequestV1();
  const operations = value.map((entry) => parseOperationV1(entry, disk));
  if (
    new Set(operations.map((entry) => entry.operationNonce)).size !==
      operations.length
  ) return disk ? rejectIntegrityV1() : rejectInvalidRequestV1();
  return Object.freeze(operations);
}

function parsePublicBindingsV1(
  value: unknown,
  host: "codex" | "claude",
  sessionIdDigest: DigestV1,
  callIdDigest: DigestV1,
  operations:
    readonly Step16ReceiptBindingJournalExpectedOperationInternalV1[],
  disk: boolean,
): readonly Readonly<Record<string, unknown>>[] {
  if (!Array.isArray(value) || value.length !== operations.length) {
    return disk ? rejectIntegrityV1() : rejectInvalidRequestV1();
  }
  const cloned = disk ? value : canonicalCloneV1(value);
  if (!Array.isArray(cloned) || cloned.length !== operations.length) {
    return disk ? rejectIntegrityV1() : rejectInvalidRequestV1();
  }
  const bindings = cloned.map((entry, index) => {
    const operation = operations[index]!;
    if (!exactRecordKeysV1(entry, [
      "schemaVersion", "profile", "host", "sessionIdDigest", "callIdDigest",
      "providerIdentityDigest", "receiptLedger", "providerOperation",
      "componentDigests", "privateBundleVerification",
    ])) return disk ? rejectIntegrityV1() : rejectInvalidRequestV1();
    const binding = entry as Record<string, unknown>;
    const providerOperation = binding.providerOperation;
    const ledger = binding.receiptLedger;
    const components = binding.componentDigests;
    const verification = binding.privateBundleVerification;
    const verifiedBindings = [
      "request_digest", "session_binding", "authority_grant_signature",
      "response_signature", "principal_attestation_signature",
    ];
    if (
      binding.schemaVersion !== 1 ||
      binding.profile !== "step16_provider_receipt_binding_v1" ||
      binding.host !== host ||
      binding.sessionIdDigest !== sessionIdDigest ||
      binding.callIdDigest !== callIdDigest ||
      !isDigestV1(binding.providerIdentityDigest) ||
      !exactRecordKeysV1(ledger, [
        "authority", "locatorPolicy", "receiptBundleDigest",
      ]) ||
      ledger.authority !== "root_owned_private_provider_receipt_ledger" ||
      ledger.locatorPolicy !== "fixed_locator_component_nofollow" ||
      !isDigestV1(ledger.receiptBundleDigest) ||
      !exactRecordKeysV1(providerOperation, [
        "operation", "operationNonce", "requestDigest", "sessionBindingDigest",
        "principalAttestationDigest", "authorityGrantContentDigest",
        "responseResolution",
      ]) ||
      providerOperation.operation !== operation.operation ||
      providerOperation.operationNonce !== operation.operationNonce ||
      providerOperation.requestDigest !== operation.requestDigest ||
      !isDigestV1(providerOperation.sessionBindingDigest) ||
      !isDigestV1(providerOperation.principalAttestationDigest) ||
      !isDigestV1(providerOperation.authorityGrantContentDigest) ||
      (providerOperation.responseResolution !== "committed" &&
        providerOperation.responseResolution !== "replayed") ||
      !exactRecordKeysV1(components, [
        "strongMutationRequest", "strongMutationResponse", "principalAttestation",
        "authorityGrantEnvelope", "authorityGrantSignature", "responseSignature",
        "principalAttestationSignature",
      ]) || !Object.values(components).every(isDigestV1) ||
      !exactRecordKeysV1(verification, [
        "status", "verifierProfile", "verifiedBindings",
      ]) || verification.status !== "verified" ||
      verification.verifierProfile !==
        "provider_runtime_ipc_full_private_bundle_verifier_v1" ||
      !Array.isArray(verification.verifiedBindings) ||
      verification.verifiedBindings.length !== verifiedBindings.length ||
      !verification.verifiedBindings.every((value, index) =>
        value === verifiedBindings[index]
      )
    ) return disk ? rejectIntegrityV1() : rejectInvalidRequestV1();
    return Object.freeze(binding);
  });
  return Object.freeze(bindings);
}

function parseCompletionV1(
  value: unknown,
  host: "codex" | "claude",
  operations:
    readonly Step16ReceiptBindingJournalExpectedOperationInternalV1[],
  disk: boolean,
): Step16ReceiptBindingJournalCompletionInternalV1 {
  if (
    !exactRecordKeysV1(value, [
      "callIdDigest",
      "publicBindings",
      "sessionIdDigest",
    ]) ||
    !isDigestV1(value.sessionIdDigest) ||
    !isDigestV1(value.callIdDigest)
  ) return disk ? rejectIntegrityV1() : rejectInvalidRequestV1();
  return Object.freeze({
    sessionIdDigest: value.sessionIdDigest,
    callIdDigest: value.callIdDigest,
    publicBindings: parsePublicBindingsV1(
      value.publicBindings,
      host,
      value.sessionIdDigest,
      value.callIdDigest,
      operations,
      disk,
    ),
  });
}

type UnsignedStateV1 = Omit<
  Step16ReceiptBindingJournalStateInternalV1,
  "stateDigest"
>;

function stateDigestV1(value: UnsignedStateV1): DigestV1 {
  return digestDomainInternalV1(STATE_DIGEST_DOMAIN_V1, value);
}

function sameCanonicalV1(left: unknown, right: unknown): boolean {
  return canonicalAuthorityBytesInternalV1(left).equals(canonicalAuthorityBytesInternalV1(right));
}

function validRearmIdentityV1(
  prior: Step16ReceiptBindingJournalStateInternalV1,
  host: "codex" | "claude",
  identity: Step16ReceiptBindingJournalCallIdentityInternalV1,
  baseline: Step16ReceiptBindingJournalBaselineInternalV1,
): boolean {
  return host === prior.host && identity.runNonce === prior.callIdentity.runNonce &&
    identity.closingPlanDigest === prior.callIdentity.closingPlanDigest &&
    identity.sessionIdDigest === prior.callIdentity.sessionIdDigest &&
    identity.callOrdinal === prior.callIdentity.callOrdinal + 1 &&
    identity.eventOrdinal > prior.callIdentity.eventOrdinal &&
    identity.callIdDigest !== prior.callIdentity.callIdDigest &&
    baseline.intentCount >= prior.baseline.intentCount;
}

function assertStateTransitionV1(
  prior: Step16ReceiptBindingJournalStateInternalV1 | undefined,
  next: Step16ReceiptBindingJournalStateInternalV1,
): void {
  if (prior === undefined) {
    if (next.revision !== 1 || next.previousStateDigest !== "none" ||
      next.phase !== "armed" || next.totalOperationCount !== 0 ||
      next.callIdentity.callOrdinal !== 1) return rejectIntegrityV1();
    return;
  }
  if (next.revision !== prior.revision + 1 ||
    next.previousStateDigest !== prior.stateDigest) return rejectIntegrityV1();
  if ((prior.phase === "finalized" || prior.phase === "aborted") && next.phase === "armed") {
    if (!validRearmIdentityV1(prior, next.host, next.callIdentity, next.baseline) ||
      next.totalOperationCount !== prior.totalOperationCount ||
      next.expectedProviderOperations.length !== 0) return rejectIntegrityV1();
    return;
  }
  if (next.host !== prior.host || !sameCanonicalV1(next.callIdentity, prior.callIdentity) ||
    !sameCanonicalV1(next.baseline, prior.baseline)) return rejectIntegrityV1();
  if (prior.phase === "armed" && next.phase === "armed") {
    if (next.totalOperationCount !== prior.totalOperationCount + 1 ||
      next.expectedProviderOperations.length !== prior.expectedProviderOperations.length + 1 ||
      !sameCanonicalV1(next.expectedProviderOperations.slice(0, -1), prior.expectedProviderOperations)) {
      return rejectIntegrityV1();
    }
    return;
  }
  if (!((prior.phase === "armed" && (next.phase === "host_completed" || next.phase === "aborted")) ||
    (prior.phase === "host_completed" && next.phase === "finalized")) ||
    next.totalOperationCount !== prior.totalOperationCount ||
    !sameCanonicalV1(next.expectedProviderOperations, prior.expectedProviderOperations) ||
    (next.phase === "finalized" && !sameCanonicalV1(next.completion, prior.completion))) {
    return rejectIntegrityV1();
  }
}

function materializeStateV1(value: UnsignedStateV1): Step16ReceiptBindingJournalStateInternalV1 {
  const stateDigest = stateDigestV1(value);
  return Object.freeze({ ...value, stateDigest });
}

function parseStateV1(bytes: Uint8Array): Step16ReceiptBindingJournalStateInternalV1 {
  let value: unknown;
  try {
    value = freezeJsonV1(parseCanonicalAuthorityBytesInternalV1(bytes));
  } catch {
    return rejectIntegrityV1();
  }
  if (
    !exactRecordKeysV1(value, [
      "baseline",
      "callIdentity",
      "completion",
      "expectedProviderOperations",
      "host",
      "phase",
      "previousStateDigest",
      "profile",
      "revision",
      "stateDigest",
      "totalOperationCount",
    ]) ||
    value.profile !== "step16_receipt_binding_durable_journal_v1" ||
    !safeCountV1(value.revision, 0x7fff_ffff) || value.revision < 1 ||
    !safeCountV1(value.totalOperationCount,
      STEP16_RECEIPT_BINDING_MAX_OPERATIONS_INTERNAL_V1) ||
    (value.previousStateDigest !== "none" &&
      !isDigestV1(value.previousStateDigest)) ||
    (value.phase !== "armed" && value.phase !== "host_completed" &&
      value.phase !== "finalized" && value.phase !== "aborted") ||
    (value.host !== "codex" && value.host !== "claude") ||
    !isDigestV1(value.stateDigest)
  ) return rejectIntegrityV1();
  const baseline = parseBaselineV1(value.baseline, true);
  const callIdentity = parseCallIdentityV1(value.callIdentity, true);
  const expectedProviderOperations = parseOperationsV1(
    value.expectedProviderOperations,
    true,
  );
  if (
    value.totalOperationCount < expectedProviderOperations.length ||
    (value.revision === 1 && (value.previousStateDigest !== "none" ||
      value.totalOperationCount !== 0 || value.phase !== "armed")) ||
    (value.revision > 1 && value.previousStateDigest === "none")
  ) return rejectIntegrityV1();
  const completion = value.completion === null
    ? null
    : parseCompletionV1(
        value.completion,
        value.host,
        expectedProviderOperations,
        true,
      );
  if (
    (value.phase === "armed" && completion !== null) ||
    (value.phase === "aborted" && completion !== null) ||
    ((value.phase === "host_completed" || value.phase === "finalized") &&
      (completion === null || expectedProviderOperations.length < 1)) ||
    (completion !== null && (completion.sessionIdDigest !== callIdentity.sessionIdDigest ||
      completion.callIdDigest !== callIdentity.callIdDigest))
  ) return rejectIntegrityV1();
  const unsigned = Object.freeze({
    profile: "step16_receipt_binding_durable_journal_v1" as const,
    revision: value.revision,
    previousStateDigest: value.previousStateDigest,
    phase: value.phase,
    host: value.host,
    totalOperationCount: value.totalOperationCount,
    callIdentity,
    baseline,
    expectedProviderOperations,
    completion,
  });
  if (stateDigestV1(unsigned) !== value.stateDigest) return rejectIntegrityV1();
  return Object.freeze({ ...unsigned, stateDigest: value.stateDigest });
}

async function readOptionalStateV1(
  path: string,
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
): Promise<Step16ReceiptBindingJournalStateInternalV1 | undefined> {
  try {
    const checked = await readCheckedAuthorityFileInternalV1({
      path,
      layout,
      maximumBytes: MAX_JOURNAL_BYTES_V1,
    });
    return parseStateV1(checked.bytes);
  } catch (error) {
    if (isMissingFileInternalV1(error)) return undefined;
    throw error;
  }
}

async function assertPreparationAbsentV1(stagePath: string): Promise<void> {
  try {
    await lstat(`${stagePath}.prepare`);
  } catch (error) {
    if (isMissingFileInternalV1(error)) return;
    return rejectIntegrityV1();
  }
  return rejectIntegrityV1();
}

function observeProcessHighWaterV1(
  path: string,
  state: Step16ReceiptBindingJournalStateInternalV1 | undefined,
): void {
  const previous = PROCESS_HIGH_WATER_V1.get(path);
  if (previous === undefined) {
    if (state !== undefined) {
      PROCESS_HIGH_WATER_V1.set(path, state);
    }
    return;
  }
  if (
    state === undefined || state.revision < previous.revision ||
    (state.revision === previous.revision &&
      state.stateDigest !== previous.stateDigest) ||
    (state.revision > previous.revision &&
      (state.revision !== previous.revision + 1 ||
        state.previousStateDigest !== previous.stateDigest))
  ) return rejectIntegrityV1();
  if (state.revision > previous.revision) assertStateTransitionV1(previous, state);
  PROCESS_HIGH_WATER_V1.set(path, state);
}

async function recoverStateV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  canonicalPath: string,
  stagePath: string,
): Promise<Step16ReceiptBindingJournalStateInternalV1 | undefined> {
  await assertPreparationAbsentV1(stagePath);
  const canonical = await readOptionalStateV1(canonicalPath, layout);
  const staged = await readOptionalStateV1(stagePath, layout);
  if (staged === undefined) return canonical;
  assertStateTransitionV1(canonical, staged);
  await publishPreparedAuthorityStageInternalV1({
    stagePath,
    canonicalPath,
    layout,
    afterCanonicalRename: "snapshot_canonical_renamed_before_directory_fsync",
    afterDirectoryFsync: "snapshot_directory_fsynced_before_publication",
  });
  const published = await readOptionalStateV1(canonicalPath, layout);
  if (published?.stateDigest !== staged.stateDigest) return rejectIntegrityV1();
  return published;
}

function durableHookAdapterV1(
  hooks: Step16ReceiptBindingJournalDurabilityHooksInternalV1,
): Readonly<{
  afterDurablePhase: (
    phase: ProviderAcceptanceAuthorityDurablePhaseInternalV1,
  ) => void | Promise<void>;
}> {
  return Object.freeze({
    afterDurablePhase(phase) {
      if (phase === "snapshot_stage_file_fsynced") {
        return hooks.afterDurablePhase?.("stage_file_fsynced");
      }
      if (phase === "snapshot_canonical_renamed_before_directory_fsync") {
        return hooks.afterDurablePhase?.("canonical_renamed");
      }
      if (phase === "snapshot_directory_fsynced_before_publication") {
        return hooks.afterDurablePhase?.("directory_fsynced");
      }
    },
  });
}

async function persistStateV1(
  capability: JournalCapabilityStateV1,
  next: Step16ReceiptBindingJournalStateInternalV1,
): Promise<void> {
  assertStateTransitionV1(capability.current, next);
  await assertPreparationAbsentV1(capability.stagePath);
  const unexpectedStage = await readOptionalStateV1(
    capability.stagePath,
    capability.layout,
  );
  if (unexpectedStage !== undefined) return rejectIntegrityV1();
  const disk = await readOptionalStateV1(
    capability.canonicalPath,
    capability.layout,
  );
  if (
    (capability.current === undefined && disk !== undefined) ||
    (capability.current !== undefined &&
      disk?.stateDigest !== capability.current.stateDigest)
  ) return rejectIntegrityV1();
  const bytes = canonicalAuthorityBytesInternalV1(next);
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_JOURNAL_BYTES_V1) {
    throw new ProviderAcceptanceAuthorityErrorV1("capacity_exhausted");
  }
  await replaceDurableAuthoritySnapshotInternalV1({
    canonicalPath: capability.canonicalPath,
    stagePath: capability.stagePath,
    bytes,
    layout: capability.layout,
    hooks: durableHookAdapterV1(capability.hooks),
    phases: Object.freeze({
      afterStageFileFsync: "snapshot_stage_file_fsynced",
      afterCanonicalRename:
        "snapshot_canonical_renamed_before_directory_fsync",
      afterDirectoryFsync: "snapshot_directory_fsynced_before_publication",
    }),
  });
  const verified = await readOptionalStateV1(
    capability.canonicalPath,
    capability.layout,
  );
  if (verified?.stateDigest !== next.stateDigest) return rejectIntegrityV1();
  capability.current = verified;
  observeProcessHighWaterV1(capability.canonicalPath, verified);
}

function requireCapabilityStateV1(
  capability: Step16ReceiptBindingJournalCapabilityInternalV1,
): JournalCapabilityStateV1 {
  const state = CAPABILITY_STATES_V1.get(capability as object);
  if (state === undefined) return rejectInvalidRequestV1();
  return state;
}

function runExclusiveV1<T>(
  capability: Step16ReceiptBindingJournalCapabilityInternalV1,
  operation: (state: JournalCapabilityStateV1) => Promise<T>,
): Promise<T> {
  let state: JournalCapabilityStateV1;
  try {
    state = requireCapabilityStateV1(capability);
  } catch (error) {
    return Promise.reject(error);
  }
  return runPathExclusiveV1(state.canonicalPath, async () => {
    await assertPrivateNamespaceV1(state.layout);
    await assertPreparationAbsentV1(state.stagePath);
    if (await readOptionalStateV1(state.stagePath, state.layout) !== undefined) {
      return rejectIntegrityV1();
    }
    const disk = await readOptionalStateV1(state.canonicalPath, state.layout);
    if (disk?.stateDigest !== state.current?.stateDigest) return rejectIntegrityV1();
    observeProcessHighWaterV1(state.canonicalPath, disk);
    return operation(state);
  });
}

function runPathExclusiveV1<T>(path: string, operation: () => Promise<T>): Promise<T> {
  const result = (PATH_TAILS_V1.get(path) ?? Promise.resolve()).then(operation);
  const tail = result.then(() => undefined, () => undefined);
  PATH_TAILS_V1.set(path, tail);
  void tail.then(() => {
    if (PATH_TAILS_V1.get(path) === tail) PATH_TAILS_V1.delete(path);
  });
  return result;
}

function runWithSnapshotV1<T, I>(
  capability: Step16ReceiptBindingJournalCapabilityInternalV1,
  input: I,
  operation: (state: JournalCapabilityStateV1, snapshot: I) => Promise<T>,
): Promise<T> {
  let snapshot: I;
  try {
    snapshot = canonicalCloneV1(input) as I;
  } catch (error) {
    return Promise.reject(error);
  }
  return runExclusiveV1(capability, (state) => operation(state, snapshot));
}

function nextUnsignedStateV1(
  current: Step16ReceiptBindingJournalStateInternalV1 | undefined,
  value: Omit<UnsignedStateV1, "revision" | "previousStateDigest" | "profile">,
): UnsignedStateV1 {
  return Object.freeze({
    profile: "step16_receipt_binding_durable_journal_v1" as const,
    revision: (current?.revision ?? 0) + 1,
    previousStateDigest: current?.stateDigest ?? "none",
    ...value,
  });
}

function assertProductionOrSealedTestLayoutV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
): void {
  const testLayout = layout.authorityResolverId ===
    "test-explicit-temporary-root-v1" && process.env.NODE_ENV === "test";
  if (
    (!testLayout && layout.authorityUid !== 0) ||
    layout.authorityUid !== (process.geteuid?.() ?? process.getuid?.()) ||
    layout.authorityGid !== (process.getegid?.() ?? process.getgid?.()) ||
    !isAbsolute(layout.authorityRoot) ||
    normalize(layout.authorityRoot) !== layout.authorityRoot ||
    layout.authorityRoot === "/" || layout.authorityRoot.includes("\0")
  ) {
    throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
  }
}

async function assertPrivateNamespaceV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
): Promise<void> {
  assertProductionOrSealedTestLayoutV1(layout);
  await ensureProviderAcceptanceAuthorityDirectoriesInternalV1(layout, false);
  for (const path of [layout.authorityRoot,
    join(layout.authorityRoot, "runtime-state"),
    join(layout.authorityRoot, "runtime-state/private")]) {
    let handle;
    try {
      if (!constants.O_NOFOLLOW || !constants.O_DIRECTORY) throw new Error();
      const before = await lstat(path, { bigint: true });
      handle = await open(path,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY);
      const opened = await handle.stat({ bigint: true });
      const after = await lstat(path, { bigint: true });
      if (!before.isDirectory() || !opened.isDirectory() || !after.isDirectory() ||
        opened.uid !== BigInt(layout.authorityUid) ||
        opened.gid !== BigInt(layout.authorityGid) ||
        (opened.mode & 0o777n) !== 0o700n || before.dev !== opened.dev ||
        before.ino !== opened.ino || after.dev !== opened.dev ||
        after.ino !== opened.ino || before.mode !== opened.mode ||
        after.mode !== opened.mode || before.uid !== opened.uid ||
        after.uid !== opened.uid || before.gid !== opened.gid ||
        after.gid !== opened.gid) throw new Error();
    } catch {
      throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
    } finally {
      await handle?.close().catch(() => undefined);
    }
  }
}

export async function openStep16ReceiptBindingDurableJournalWithLayoutCoreInternalV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  hooks: Step16ReceiptBindingJournalDurabilityHooksInternalV1 = {},
): Promise<Step16ReceiptBindingJournalCapabilityInternalV1> {
  assertProductionOrSealedTestLayoutV1(layout);
  await ensureProviderAcceptanceAuthorityDirectoriesInternalV1(layout, true);
  const canonicalPath = join(
    layout.authorityRoot,
    STEP16_RECEIPT_BINDING_JOURNAL_LOGICAL_LOCATOR_INTERNAL_V1,
  );
  const stagePath = join(
    layout.authorityRoot,
    STEP16_RECEIPT_BINDING_JOURNAL_STAGE_LOGICAL_LOCATOR_INTERNAL_V1,
  );
  return runPathExclusiveV1(canonicalPath, async () => {
    await assertPrivateNamespaceV1(layout);
    const current = await recoverStateV1(layout, canonicalPath, stagePath);
    observeProcessHighWaterV1(canonicalPath, current);
    const capability = Object.freeze(Object.create(null)) as
      Step16ReceiptBindingJournalCapabilityInternalV1;
    CAPABILITY_STATES_V1.set(capability, {
      layout, canonicalPath, stagePath,
      hooks: Object.freeze({ ...hooks }), current,
    });
    return capability;
  });
}

export function inspectStep16ReceiptBindingDurableJournalInternalV1(
  capability: Step16ReceiptBindingJournalCapabilityInternalV1,
): Promise<Step16ReceiptBindingJournalStateInternalV1 | undefined> {
  return runExclusiveV1(capability, async (state) => state.current);
}

export function armStep16ReceiptBindingDurableJournalInternalV1(
  capability: Step16ReceiptBindingJournalCapabilityInternalV1,
  input: Step16ReceiptBindingJournalArmInternalV1,
): Promise<void> {
  return runWithSnapshotV1(capability, input, async (state, input) => {
    if (
      !exactRecordKeysV1(input, ["baseline", "host", "callIdentity"]) ||
      (input.host !== "codex" && input.host !== "claude") ||
      (state.current !== undefined && state.current.phase !== "finalized" &&
        state.current.phase !== "aborted")
    ) return rejectInvalidRequestV1();
    const baseline = parseBaselineV1(input.baseline, false);
    const callIdentity = parseCallIdentityV1(input.callIdentity, false);
    const prior = state.current;
    // One fixed journal belongs to one run/plan/session. No public reset can
    // turn abort/re-arm into a new operation budget or retarget a completed run.
    if (prior === undefined ? callIdentity.callOrdinal !== 1 :
      !validRearmIdentityV1(prior, input.host, callIdentity, baseline)) return rejectInvalidRequestV1();
    const next = materializeStateV1(nextUnsignedStateV1(state.current, {
      phase: "armed",
      host: input.host,
      totalOperationCount: state.current?.totalOperationCount ?? 0,
      callIdentity,
      baseline,
      expectedProviderOperations: Object.freeze([]),
      completion: null,
    }));
    await persistStateV1(state, next);
  });
}

export function appendStep16ReceiptBindingExpectedOperationDurableInternalV1(
  capability: Step16ReceiptBindingJournalCapabilityInternalV1,
  input: Step16ReceiptBindingJournalExpectedOperationInternalV1,
): Promise<void> {
  return runWithSnapshotV1(capability, input, async (state, input) => {
    const current = state.current;
    if (current?.phase !== "armed") return rejectInvalidRequestV1();
    const operation = parseOperationV1(input, false);
    if (
      current.totalOperationCount >=
        STEP16_RECEIPT_BINDING_MAX_OPERATIONS_INTERNAL_V1
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1("capacity_exhausted");
    }
    if (
      current.expectedProviderOperations.some((entry) =>
        entry.operationNonce === operation.operationNonce
      )
    ) return rejectInvalidRequestV1();
    const next = materializeStateV1(nextUnsignedStateV1(current, {
      phase: "armed",
      host: current.host,
      totalOperationCount: current.totalOperationCount + 1,
      callIdentity: current.callIdentity,
      baseline: current.baseline,
      expectedProviderOperations: Object.freeze([
        ...current.expectedProviderOperations,
        operation,
      ]),
      completion: null,
    }));
    await persistStateV1(state, next);
  });
}

export function completeStep16ReceiptBindingDurableJournalInternalV1(
  capability: Step16ReceiptBindingJournalCapabilityInternalV1,
  input: Step16ReceiptBindingJournalCompletionInternalV1,
): Promise<void> {
  return runWithSnapshotV1(capability, input, async (state, input) => {
    const current = state.current;
    if (
      current?.phase !== "armed" ||
      current.expectedProviderOperations.length < 1
    ) return rejectInvalidRequestV1();
    const completion = parseCompletionV1(
      input,
      current.host,
      current.expectedProviderOperations,
      false,
    );
    if (completion.sessionIdDigest !== current.callIdentity.sessionIdDigest ||
      completion.callIdDigest !== current.callIdentity.callIdDigest) {
      return rejectInvalidRequestV1();
    }
    const next = materializeStateV1(nextUnsignedStateV1(current, {
      phase: "host_completed",
      host: current.host,
      totalOperationCount: current.totalOperationCount,
      callIdentity: current.callIdentity,
      baseline: current.baseline,
      expectedProviderOperations: current.expectedProviderOperations,
      completion,
    }));
    await persistStateV1(state, next);
  });
}

export function finalizeStep16ReceiptBindingDurableJournalInternalV1(
  capability: Step16ReceiptBindingJournalCapabilityInternalV1,
): Promise<void> {
  return runExclusiveV1(capability, async (state) => {
    const current = state.current;
    if (current?.phase !== "host_completed" || current.completion === null) {
      return rejectInvalidRequestV1();
    }
    const next = materializeStateV1(nextUnsignedStateV1(current, {
      phase: "finalized",
      host: current.host,
      totalOperationCount: current.totalOperationCount,
      callIdentity: current.callIdentity,
      baseline: current.baseline,
      expectedProviderOperations: current.expectedProviderOperations,
      completion: current.completion,
    }));
    await persistStateV1(state, next);
  });
}

export function abortStep16ReceiptBindingDurableJournalInternalV1(
  capability: Step16ReceiptBindingJournalCapabilityInternalV1,
): Promise<void> {
  return runExclusiveV1(capability, async (state) => {
    const current = state.current;
    if (current?.phase !== "armed") return rejectInvalidRequestV1();
    const next = materializeStateV1(nextUnsignedStateV1(current, {
      phase: "aborted",
      host: current.host,
      totalOperationCount: current.totalOperationCount,
      callIdentity: current.callIdentity,
      baseline: current.baseline,
      expectedProviderOperations: current.expectedProviderOperations,
      completion: null,
    }));
    await persistStateV1(state, next);
  });
}

function parseLedgerEntryV1(
  value: unknown,
): Step16ReceiptBindingBrokerLedgerEntryInternalV1 {
  if (
    !exactRecordKeysV1(value, [
      "bundleDigest",
      "operation",
      "operationNonce",
      "requestDigest",
    ]) ||
    !isDigestV1(value.bundleDigest)
  ) return rejectInvalidRequestV1();
  const operation = parseOperationV1({
    operation: value.operation,
    operationNonce: value.operationNonce,
    requestDigest: value.requestDigest,
  }, false);
  return Object.freeze({ bundleDigest: value.bundleDigest, ...operation });
}

export function deriveStep16ReceiptBindingOrderedPrefixDigestInternalV1(
  entries: readonly Step16ReceiptBindingBrokerLedgerEntryInternalV1[],
): DigestV1 {
  if (!Array.isArray(entries) || entries.length > MAX_LEDGER_ENTRIES_V1) {
    return rejectInvalidRequestV1();
  }
  const snapshot = canonicalCloneV1(entries) as readonly unknown[];
  const parsed = snapshot.map(parseLedgerEntryV1);
  return digestDomainInternalV1(
    PREFIX_DIGEST_DOMAIN_V1,
    parsed.map((entry) => entry.bundleDigest),
  );
}

export function verifyStep16ReceiptBindingDurableJournalAgainstBrokerLedgerInternalV1(
  capability: Step16ReceiptBindingJournalCapabilityInternalV1,
  input: Step16ReceiptBindingBrokerLedgerViewInternalV1,
): Promise<void> {
  return runWithSnapshotV1(capability, input, async (state, input) => {
    const current = state.current;
    if (current === undefined) return rejectInvalidRequestV1();
    if (
      !exactRecordKeysV1(input, ["bundles", "intentCount", "pendingCount"]) ||
      input.pendingCount !== 0 ||
      !safeCountV1(input.intentCount, MAX_LEDGER_ENTRIES_V1) ||
      !Array.isArray(input.bundles) ||
      input.bundles.length !== input.intentCount ||
      input.intentCount < current.baseline.intentCount
    ) return rejectIntegrityV1();
    const bundles = input.bundles.map(parseLedgerEntryV1);
    if (new Set(bundles.map((entry) => entry.operationNonce)).size !== bundles.length ||
      new Set(bundles.map((entry) => entry.bundleDigest)).size !== bundles.length) {
      return rejectIntegrityV1();
    }
    const prefix = bundles.slice(0, current.baseline.intentCount);
    if (
      deriveStep16ReceiptBindingOrderedPrefixDigestInternalV1(prefix) !==
        current.baseline.orderedPrefixDigest
    ) return rejectIntegrityV1();
    const suffix = bundles.slice(current.baseline.intentCount);
    const exactCompletionRequired = current.phase === "host_completed" ||
      current.phase === "finalized";
    if (
      suffix.length > current.expectedProviderOperations.length ||
      (exactCompletionRequired &&
        suffix.length !== current.expectedProviderOperations.length)
    ) return rejectIntegrityV1();
    for (let index = 0; index < suffix.length; index += 1) {
      const actual = suffix[index]!;
      const expected = current.expectedProviderOperations[index]!;
      if (
        actual.operation !== expected.operation ||
        actual.operationNonce !== expected.operationNonce ||
        actual.requestDigest !== expected.requestDigest
      ) return rejectIntegrityV1();
      if (current.completion !== null) {
        const binding = current.completion.publicBindings[index]!;
        const ledger = binding.receiptLedger as Record<string, unknown>;
        if (ledger.receiptBundleDigest !== actual.bundleDigest) return rejectIntegrityV1();
      }
    }
  });
}
