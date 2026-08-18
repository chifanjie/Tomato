import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  lstat,
  open,
  readdir,
  realpath,
  type FileHandle,
} from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";
import {
  ProviderRuntimeIpcStrongMutationAuthorityGrantIdV1Schema,
  type ProviderRuntimeIpcStrongMutationAuthorityGrantIdV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import {
  ContentDigestV1Schema,
  type ContentDigestV1,
} from "@understand-code/durable-object-provider-contracts/primitives";

/**
 * Durable replay state only: possession of this object or a committed result
 * grants no mutation authority. A caller must verify every authority claim and
 * burn the GrantId here before performing the separately authorized operation.
 *
 * Immutable, fsynced records survive ordinary process and machine restarts.
 * The private root must be provisioned so no hostile principal can replace or
 * roll back its filesystem. This module detects rollback already observed by
 * the current process, but it does not establish malicious cross-restart
 * filesystem rollback resistance without an independent monotonic anchor.
 */

export const PROVIDER_RUNTIME_STRONG_MUTATION_GRANT_REPLAY_LEDGER_RECORD_PROFILE_INTERNAL_V1 =
  "understand_code_provider_runtime_strong_mutation_grant_replay_ledger_record_v1" as const;
export const PROVIDER_RUNTIME_STRONG_MUTATION_GRANT_REPLAY_LEDGER_RECORD_DOMAIN_INTERNAL_V1 =
  "understand-code-provider-runtime-strong-mutation-grant-replay-ledger-record-v1" as const;

const LEDGER_ROOT_MODE_V1 = 0o700;
const LEDGER_RECORD_MODE_V1 = 0o600;
const DEFAULT_MAXIMUM_ENTRY_COUNT_V1 = 1_000_000;
const DEFAULT_MAXIMUM_LEDGER_BYTES_V1 = 512 * 1024 * 1024;
const MAXIMUM_RECORD_BYTES_V1 = 4 * 1024;
const MAXIMUM_APPEND_CONTENTION_ATTEMPTS_V1 = 8;
const RECORD_FILE_PATTERN_V1 = /^[0-9]{16}\.json$/u;

export type ProviderRuntimeStrongMutationGrantReplayLedgerErrorCodeInternalV1 =
  | "invalid_input"
  | "root_invalid"
  | "ledger_corrupt"
  | "ledger_capacity_exceeded"
  | "rollback_detected"
  | "storage_failure"
  | "storage_security_violation";

export class ProviderRuntimeStrongMutationGrantReplayLedgerErrorInternalV1 extends Error {
  readonly code:
    ProviderRuntimeStrongMutationGrantReplayLedgerErrorCodeInternalV1;

  constructor(
    code: ProviderRuntimeStrongMutationGrantReplayLedgerErrorCodeInternalV1,
    message: string,
  ) {
    super(message);
    this.name =
      "ProviderRuntimeStrongMutationGrantReplayLedgerErrorInternalV1";
    this.code = code;
  }
}

export interface ProviderRuntimeStrongMutationGrantReplayLedgerOptionsInternalV1 {
  /** Pre-provisioned canonical absolute 0700 directory; never created here. */
  readonly ledgerRoot: string;
  readonly expectedUid: number;
  readonly expectedGid: number;
  readonly maximumEntryCount?: number;
  readonly maximumLedgerBytes?: number;
}

export interface ProviderRuntimeStrongMutationGrantReplayLedgerConsumeResultInternalV1 {
  readonly resolution: "committed" | "replayed";
  readonly grantId: ProviderRuntimeIpcStrongMutationAuthorityGrantIdV1;
  readonly ordinal: number;
  readonly recordDigest: ContentDigestV1;
}

interface LedgerRecordUnsignedInternalV1 {
  readonly schemaVersion: 1;
  readonly profile:
    typeof PROVIDER_RUNTIME_STRONG_MUTATION_GRANT_REPLAY_LEDGER_RECORD_PROFILE_INTERNAL_V1;
  readonly ordinal: number;
  readonly grantId: ProviderRuntimeIpcStrongMutationAuthorityGrantIdV1;
  readonly previousRecordDigest: ContentDigestV1 | "none";
}

interface LedgerRecordInternalV1 extends LedgerRecordUnsignedInternalV1 {
  readonly recordDigest: ContentDigestV1;
}

interface CheckedRootInternalV1 {
  readonly path: string;
  readonly dev: number;
  readonly ino: number;
}

interface CheckedRecordBytesInternalV1 {
  readonly bytes: Buffer;
  readonly dev: number;
  readonly ino: number;
  readonly size: number;
}

interface LedgerSnapshotInternalV1 {
  readonly root: CheckedRootInternalV1;
  readonly records: readonly LedgerRecordInternalV1[];
  readonly byGrantId: ReadonlyMap<
    ProviderRuntimeIpcStrongMutationAuthorityGrantIdV1,
    LedgerRecordInternalV1
  >;
  readonly totalBytes: number;
}

interface ObservedHighWaterInternalV1 {
  readonly entryCount: number;
  readonly totalBytes: number;
  readonly headDigest: ContentDigestV1 | "none";
  readonly rootDev: number;
  readonly rootIno: number;
}

interface SharedLedgerStateInternalV1 {
  readonly ledgerRoot: string;
  readonly expectedUid: number;
  readonly expectedGid: number;
  readonly maximumEntryCount: number;
  readonly maximumLedgerBytes: number;
  tail: Promise<void>;
  observed?: ObservedHighWaterInternalV1;
}

const sharedLedgersByCanonicalRootInternalV1 = new Map<
  string,
  SharedLedgerStateInternalV1
>();

function failV1(
  code: ProviderRuntimeStrongMutationGrantReplayLedgerErrorCodeInternalV1,
  message: string,
): never {
  throw new ProviderRuntimeStrongMutationGrantReplayLedgerErrorInternalV1(
    code,
    message,
  );
}

function isErrnoV1(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error &&
    (error as { readonly code?: unknown }).code === code;
}

function exactModeV1(mode: number): number {
  return mode & 0o7777;
}

function requireNonnegativeSafeIntegerV1(
  value: number,
  name: string,
): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    return failV1("invalid_input", `${name} must be a nonnegative safe integer`);
  }
  return value;
}

function requirePositiveSafeIntegerV1(
  value: number,
  name: string,
): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    return failV1("invalid_input", `${name} must be a positive safe integer`);
  }
  return value;
}

function noFollowFlagV1(): number {
  return typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
}

function directoryFlagV1(): number {
  return typeof constants.O_DIRECTORY === "number" ? constants.O_DIRECTORY : 0;
}

function recordFileNameV1(ordinal: number): string {
  return `${String(ordinal).padStart(16, "0")}.json`;
}

function isExactRecordV1(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key));
}

function deriveRecordDigestV1(
  record: LedgerRecordUnsignedInternalV1,
): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${createHash("sha256")
      .update(canonicalizeJcsSafeIntegerV1([
        PROVIDER_RUNTIME_STRONG_MUTATION_GRANT_REPLAY_LEDGER_RECORD_DOMAIN_INTERNAL_V1,
        record,
      ]))
      .digest("hex")}`,
  );
}

function serializeRecordV1(record: LedgerRecordInternalV1): string {
  return `${canonicalizeJcsSafeIntegerV1(record)}\n`;
}

function parseCanonicalRecordV1(
  bytes: Uint8Array,
  expectedOrdinal: number,
  expectedPreviousRecordDigest: ContentDigestV1 | "none",
): LedgerRecordInternalV1 {
  try {
    const serialized = Buffer.from(bytes).toString("utf8");
    if (
      !serialized.endsWith("\n") ||
      serialized.indexOf("\n") !== serialized.length - 1
    ) return failV1("ledger_corrupt", "ledger record is not one canonical line");
    const value = JSON.parse(serialized.slice(0, -1)) as unknown;
    if (`${canonicalizeJcsSafeIntegerV1(value)}\n` !== serialized) {
      return failV1("ledger_corrupt", "ledger record JSON is not canonical");
    }
    if (
      !isExactRecordV1(value, [
        "schemaVersion",
        "profile",
        "ordinal",
        "grantId",
        "previousRecordDigest",
        "recordDigest",
      ]) ||
      value.schemaVersion !== 1 ||
      value.profile !==
        PROVIDER_RUNTIME_STRONG_MUTATION_GRANT_REPLAY_LEDGER_RECORD_PROFILE_INTERNAL_V1 ||
      value.ordinal !== expectedOrdinal ||
      value.previousRecordDigest !== expectedPreviousRecordDigest
    ) return failV1("ledger_corrupt", "ledger record structure or chain is invalid");
    const record: LedgerRecordInternalV1 = Object.freeze({
      schemaVersion: 1 as const,
      profile:
        PROVIDER_RUNTIME_STRONG_MUTATION_GRANT_REPLAY_LEDGER_RECORD_PROFILE_INTERNAL_V1,
      ordinal: expectedOrdinal,
      grantId:
        ProviderRuntimeIpcStrongMutationAuthorityGrantIdV1Schema.parse(
          value.grantId,
        ),
      previousRecordDigest:
        value.previousRecordDigest === "none"
          ? "none"
          : ContentDigestV1Schema.parse(value.previousRecordDigest),
      recordDigest: ContentDigestV1Schema.parse(value.recordDigest),
    });
    const { recordDigest: _recordDigest, ...unsigned } = record;
    if (record.recordDigest !== deriveRecordDigestV1(unsigned)) {
      return failV1("ledger_corrupt", "ledger record digest is invalid");
    }
    return record;
  } catch (error) {
    if (
      error instanceof
        ProviderRuntimeStrongMutationGrantReplayLedgerErrorInternalV1
    ) throw error;
    return failV1("ledger_corrupt", "ledger record cannot be parsed");
  }
}

async function checkedRootV1(
  state: SharedLedgerStateInternalV1,
): Promise<CheckedRootInternalV1> {
  try {
    const metadata = await lstat(state.ledgerRoot);
    if (
      metadata.isSymbolicLink() ||
      !metadata.isDirectory() ||
      !Number.isSafeInteger(metadata.dev) ||
      metadata.dev < 0 ||
      !Number.isSafeInteger(metadata.ino) ||
      metadata.ino < 0 ||
      metadata.uid !== state.expectedUid ||
      metadata.gid !== state.expectedGid ||
      exactModeV1(metadata.mode) !== LEDGER_ROOT_MODE_V1 ||
      await realpath(state.ledgerRoot) !== state.ledgerRoot
    ) return failV1("root_invalid", "ledger root is not the exact private directory");
    return Object.freeze({
      path: state.ledgerRoot,
      dev: metadata.dev,
      ino: metadata.ino,
    });
  } catch (error) {
    if (
      error instanceof
        ProviderRuntimeStrongMutationGrantReplayLedgerErrorInternalV1
    ) throw error;
    return failV1("root_invalid", "ledger root is unavailable");
  }
}

async function assertRootUnchangedV1(
  state: SharedLedgerStateInternalV1,
  root: CheckedRootInternalV1,
): Promise<void> {
  const current = await checkedRootV1(state);
  if (current.dev !== root.dev || current.ino !== root.ino) {
    failV1("storage_security_violation", "ledger root inode changed");
  }
}

async function checkedRecordBytesV1(
  state: SharedLedgerStateInternalV1,
  path: string,
): Promise<CheckedRecordBytesInternalV1> {
  let handle: FileHandle | undefined;
  try {
    const before = await lstat(path);
    if (
      before.isSymbolicLink() ||
      !before.isFile() ||
      !Number.isSafeInteger(before.dev) ||
      before.dev < 0 ||
      !Number.isSafeInteger(before.ino) ||
      before.ino < 0 ||
      before.nlink !== 1
    ) return failV1("storage_security_violation", "ledger record is not a private regular file");
    handle = await open(path, constants.O_RDONLY | noFollowFlagV1());
    const opened = await handle.stat();
    if (
      !opened.isFile() ||
      !Number.isSafeInteger(opened.dev) ||
      opened.dev < 0 ||
      !Number.isSafeInteger(opened.ino) ||
      opened.ino < 0 ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.nlink !== 1 ||
      opened.uid !== state.expectedUid ||
      opened.gid !== state.expectedGid ||
      exactModeV1(opened.mode) !== LEDGER_RECORD_MODE_V1 ||
      opened.size < 1 ||
      opened.size > MAXIMUM_RECORD_BYTES_V1
    ) return failV1("storage_security_violation", "ledger record metadata is invalid");
    const bytes = await handle.readFile();
    const after = await lstat(path);
    if (
      after.isSymbolicLink() ||
      !after.isFile() ||
      !Number.isSafeInteger(after.dev) ||
      after.dev < 0 ||
      !Number.isSafeInteger(after.ino) ||
      after.ino < 0 ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.nlink !== 1 ||
      after.size !== opened.size ||
      after.uid !== state.expectedUid ||
      after.gid !== state.expectedGid ||
      exactModeV1(after.mode) !== LEDGER_RECORD_MODE_V1 ||
      bytes.byteLength !== opened.size
    ) return failV1("storage_security_violation", "ledger record inode changed while reading");
    return Object.freeze({
      bytes,
      dev: opened.dev,
      ino: opened.ino,
      size: opened.size,
    });
  } catch (error) {
    if (
      error instanceof
        ProviderRuntimeStrongMutationGrantReplayLedgerErrorInternalV1
    ) throw error;
    return failV1("storage_failure", "ledger record could not be read");
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function assertRecordUnchangedV1(
  state: SharedLedgerStateInternalV1,
  path: string,
  record: CheckedRecordBytesInternalV1,
): Promise<void> {
  try {
    const current = await lstat(path);
    if (
      current.isSymbolicLink() ||
      !current.isFile() ||
      !Number.isSafeInteger(current.dev) ||
      current.dev < 0 ||
      !Number.isSafeInteger(current.ino) ||
      current.ino < 0 ||
      current.dev !== record.dev ||
      current.ino !== record.ino ||
      current.nlink !== 1 ||
      current.size !== record.size ||
      current.uid !== state.expectedUid ||
      current.gid !== state.expectedGid ||
      exactModeV1(current.mode) !== LEDGER_RECORD_MODE_V1
    ) return failV1("storage_security_violation", "ledger record inode changed after reading");
  } catch (error) {
    if (
      error instanceof
        ProviderRuntimeStrongMutationGrantReplayLedgerErrorInternalV1
    ) throw error;
    return failV1("storage_failure", "ledger record continuity could not be checked");
  }
}

function namesEqualV1(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length &&
    left.every((name, index) => name === right[index]);
}

async function readSnapshotV1(
  state: SharedLedgerStateInternalV1,
): Promise<LedgerSnapshotInternalV1> {
  const root = await checkedRootV1(state);
  let entries;
  try {
    entries = await readdir(root.path, { withFileTypes: true });
  } catch {
    return failV1("storage_failure", "ledger root could not be enumerated");
  }
  const entriesByName = new Map(entries.map((entry) => [entry.name, entry]));
  const names = [...entriesByName.keys()].sort();
  for (let index = 0; index < names.length; index += 1) {
    const expectedName = recordFileNameV1(index + 1);
    if (
      names[index] !== expectedName ||
      !RECORD_FILE_PATTERN_V1.test(names[index]!)
    ) return failV1("ledger_corrupt", "ledger root contains an unexpected entry");
    if (!entriesByName.get(names[index]!)?.isFile()) {
      return failV1(
        "storage_security_violation",
        "ledger record directory entry is not a regular file",
      );
    }
  }
  if (names.length > state.maximumEntryCount) {
    return failV1("ledger_capacity_exceeded", "ledger entry cap is exceeded");
  }

  const records: LedgerRecordInternalV1[] = [];
  const byGrantId = new Map<
    ProviderRuntimeIpcStrongMutationAuthorityGrantIdV1,
    LedgerRecordInternalV1
  >();
  let totalBytes = 0;
  let previousRecordDigest: ContentDigestV1 | "none" = "none";
  const checkedRecords: Readonly<{
    readonly path: string;
    readonly record: CheckedRecordBytesInternalV1;
  }>[] = [];
  for (let index = 0; index < names.length; index += 1) {
    const ordinal = index + 1;
    const path = join(root.path, names[index]!);
    const checked = await checkedRecordBytesV1(
      state,
      path,
    );
    totalBytes += checked.bytes.byteLength;
    if (totalBytes > state.maximumLedgerBytes) {
      return failV1("ledger_capacity_exceeded", "ledger byte cap is exceeded");
    }
    const record = parseCanonicalRecordV1(
      checked.bytes,
      ordinal,
      previousRecordDigest,
    );
    if (byGrantId.has(record.grantId)) {
      return failV1("ledger_corrupt", "ledger contains a duplicate GrantId");
    }
    records.push(record);
    byGrantId.set(record.grantId, record);
    checkedRecords.push(Object.freeze({ path, record: checked }));
    previousRecordDigest = record.recordDigest;
  }

  const secondNames = (await readdir(root.path, { withFileTypes: true })
    .catch(() => failV1("storage_failure", "ledger root could not be re-enumerated")))
    .map((entry) => entry.name)
    .sort();
  if (!namesEqualV1(names, secondNames)) {
    return failV1("storage_failure", "ledger changed during observation");
  }
  for (const checked of checkedRecords) {
    await assertRecordUnchangedV1(state, checked.path, checked.record);
  }
  await assertRootUnchangedV1(state, root);
  return Object.freeze({
    root,
    records: Object.freeze(records),
    byGrantId,
    totalBytes,
  });
}

function assertNoObservedRollbackV1(
  state: SharedLedgerStateInternalV1,
  snapshot: LedgerSnapshotInternalV1,
): void {
  const previous = state.observed;
  if (previous === undefined) return;
  if (
    snapshot.root.dev !== previous.rootDev ||
    snapshot.root.ino !== previous.rootIno
  ) return failV1("storage_security_violation", "ledger root continuity was lost");
  if (snapshot.records.length < previous.entryCount) {
    return failV1("rollback_detected", "ledger lost an observed record");
  }
  if (previous.entryCount > 0) {
    const prefixHead = snapshot.records[previous.entryCount - 1];
    if (prefixHead?.recordDigest !== previous.headDigest) {
      return failV1("rollback_detected", "ledger no longer extends the observed chain");
    }
  }
  if (
    snapshot.records.length === previous.entryCount &&
    snapshot.totalBytes !== previous.totalBytes
  ) return failV1("rollback_detected", "ledger changed below the observed high-water");
}

function observeSnapshotV1(
  state: SharedLedgerStateInternalV1,
  snapshot: LedgerSnapshotInternalV1,
): void {
  assertNoObservedRollbackV1(state, snapshot);
  state.observed = Object.freeze({
    entryCount: snapshot.records.length,
    totalBytes: snapshot.totalBytes,
    headDigest:
      snapshot.records.at(-1)?.recordDigest ?? "none",
    rootDev: snapshot.root.dev,
    rootIno: snapshot.root.ino,
  });
}

async function syncRootDirectoryV1(
  state: SharedLedgerStateInternalV1,
  root: CheckedRootInternalV1,
): Promise<void> {
  let handle: FileHandle | undefined;
  try {
    handle = await open(
      root.path,
      constants.O_RDONLY | directoryFlagV1() | noFollowFlagV1(),
    );
    const opened = await handle.stat();
    if (
      !opened.isDirectory() ||
      !Number.isSafeInteger(opened.dev) ||
      opened.dev < 0 ||
      !Number.isSafeInteger(opened.ino) ||
      opened.ino < 0 ||
      opened.dev !== root.dev ||
      opened.ino !== root.ino ||
      opened.uid !== state.expectedUid ||
      opened.gid !== state.expectedGid ||
      exactModeV1(opened.mode) !== LEDGER_ROOT_MODE_V1
    ) return failV1("storage_security_violation", "ledger root changed before fsync");
    await handle.sync();
  } catch (error) {
    if (
      error instanceof
        ProviderRuntimeStrongMutationGrantReplayLedgerErrorInternalV1
    ) throw error;
    return failV1("storage_failure", "ledger root fsync failed");
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function appendRecordV1(
  state: SharedLedgerStateInternalV1,
  snapshot: LedgerSnapshotInternalV1,
  grantId: ProviderRuntimeIpcStrongMutationAuthorityGrantIdV1,
): Promise<LedgerRecordInternalV1 | "contention"> {
  if (snapshot.records.length >= state.maximumEntryCount) {
    return failV1("ledger_capacity_exceeded", "ledger entry cap is exhausted");
  }
  const ordinal = snapshot.records.length + 1;
  const unsigned: LedgerRecordUnsignedInternalV1 = Object.freeze({
    schemaVersion: 1 as const,
    profile:
      PROVIDER_RUNTIME_STRONG_MUTATION_GRANT_REPLAY_LEDGER_RECORD_PROFILE_INTERNAL_V1,
    ordinal,
    grantId,
    previousRecordDigest:
      snapshot.records.at(-1)?.recordDigest ?? "none",
  });
  const record: LedgerRecordInternalV1 = Object.freeze({
    ...unsigned,
    recordDigest: deriveRecordDigestV1(unsigned),
  });
  const serialized = serializeRecordV1(record);
  if (
    Buffer.byteLength(serialized, "utf8") > MAXIMUM_RECORD_BYTES_V1 ||
    snapshot.totalBytes + Buffer.byteLength(serialized, "utf8") >
      state.maximumLedgerBytes
  ) return failV1("ledger_capacity_exceeded", "ledger byte cap is exhausted");

  await assertRootUnchangedV1(state, snapshot.root);
  const path = join(snapshot.root.path, recordFileNameV1(ordinal));
  let handle: FileHandle | undefined;
  try {
    handle = await open(
      path,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        noFollowFlagV1(),
      LEDGER_RECORD_MODE_V1,
    );
    await handle.writeFile(serialized, "utf8");
    await handle.sync();
  } catch (error) {
    if (isErrnoV1(error, "EEXIST")) return "contention";
    if (
      error instanceof
        ProviderRuntimeStrongMutationGrantReplayLedgerErrorInternalV1
    ) throw error;
    return failV1("storage_failure", "ledger record append failed");
  } finally {
    await handle?.close().catch(() => undefined);
  }

  await syncRootDirectoryV1(state, snapshot.root);
  const checkedPersisted = await checkedRecordBytesV1(state, path);
  const persisted = parseCanonicalRecordV1(
    checkedPersisted.bytes,
    ordinal,
    unsigned.previousRecordDigest,
  );
  if (
    persisted.grantId !== record.grantId ||
    persisted.recordDigest !== record.recordDigest
  ) return failV1("storage_security_violation", "persisted ledger record changed");
  await assertRecordUnchangedV1(state, path, checkedPersisted);
  await assertRootUnchangedV1(state, snapshot.root);
  return record;
}

function sharedStateV1(
  options: ProviderRuntimeStrongMutationGrantReplayLedgerOptionsInternalV1,
): SharedLedgerStateInternalV1 {
  if (
    options === null ||
    typeof options !== "object" ||
    typeof options.ledgerRoot !== "string" ||
    !isAbsolute(options.ledgerRoot) ||
    resolve(options.ledgerRoot) !== options.ledgerRoot
  ) return failV1("invalid_input", "ledgerRoot must be one canonical absolute path");
  const expectedUid = requireNonnegativeSafeIntegerV1(
    options.expectedUid,
    "expectedUid",
  );
  const expectedGid = requireNonnegativeSafeIntegerV1(
    options.expectedGid,
    "expectedGid",
  );
  const maximumEntryCount = requirePositiveSafeIntegerV1(
    options.maximumEntryCount ?? DEFAULT_MAXIMUM_ENTRY_COUNT_V1,
    "maximumEntryCount",
  );
  const maximumLedgerBytes = requirePositiveSafeIntegerV1(
    options.maximumLedgerBytes ?? DEFAULT_MAXIMUM_LEDGER_BYTES_V1,
    "maximumLedgerBytes",
  );
  const existing = sharedLedgersByCanonicalRootInternalV1.get(
    options.ledgerRoot,
  );
  if (existing !== undefined) {
    if (
      existing.expectedUid !== expectedUid ||
      existing.expectedGid !== expectedGid ||
      existing.maximumEntryCount !== maximumEntryCount ||
      existing.maximumLedgerBytes !== maximumLedgerBytes
    ) return failV1("invalid_input", "ledgerRoot was already bound to different options");
    return existing;
  }
  const state: SharedLedgerStateInternalV1 = {
    ledgerRoot: options.ledgerRoot,
    expectedUid,
    expectedGid,
    maximumEntryCount,
    maximumLedgerBytes,
    tail: Promise.resolve(),
  };
  sharedLedgersByCanonicalRootInternalV1.set(options.ledgerRoot, state);
  return state;
}

function enqueueV1<T>(
  state: SharedLedgerStateInternalV1,
  operation: () => Promise<T>,
): Promise<T> {
  const result = state.tail.then(operation, operation);
  state.tail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export class ProviderRuntimeStrongMutationGrantReplayLedgerInternalV1 {
  readonly ledgerRoot: string;
  readonly #state: SharedLedgerStateInternalV1;

  constructor(
    options: ProviderRuntimeStrongMutationGrantReplayLedgerOptionsInternalV1,
  ) {
    this.#state = sharedStateV1(options);
    this.ledgerRoot = this.#state.ledgerRoot;
  }

  /** Validate the complete immutable chain without creating any filesystem entry. */
  async initialize(): Promise<void> {
    return enqueueV1(this.#state, async () => {
      const snapshot = await readSnapshotV1(this.#state);
      observeSnapshotV1(this.#state, snapshot);
    });
  }

  /**
   * Atomically burn one typed GrantId. `committed` is returned only after the
   * immutable record and its containing directory have both been fsynced.
   * `replayed` is a denial signal and must never authorize another operation.
   */
  async consume(
    input: ProviderRuntimeIpcStrongMutationAuthorityGrantIdV1,
  ): Promise<ProviderRuntimeStrongMutationGrantReplayLedgerConsumeResultInternalV1> {
    const parsedGrantId =
      ProviderRuntimeIpcStrongMutationAuthorityGrantIdV1Schema.safeParse(input);
    if (!parsedGrantId.success) {
      return failV1("invalid_input", "grantId is invalid");
    }
    const grantId = parsedGrantId.data;
    return enqueueV1(this.#state, async () => {
      for (
        let attempt = 0;
        attempt < MAXIMUM_APPEND_CONTENTION_ATTEMPTS_V1;
        attempt += 1
      ) {
        const snapshot = await readSnapshotV1(this.#state);
        observeSnapshotV1(this.#state, snapshot);
        const replay = snapshot.byGrantId.get(grantId);
        if (replay !== undefined) {
          return Object.freeze({
            resolution: "replayed" as const,
            grantId,
            ordinal: replay.ordinal,
            recordDigest: replay.recordDigest,
          });
        }
        const appended = await appendRecordV1(this.#state, snapshot, grantId);
        if (appended === "contention") continue;
        const nextSnapshot: LedgerSnapshotInternalV1 = Object.freeze({
          root: snapshot.root,
          records: Object.freeze([...snapshot.records, appended]),
          byGrantId: new Map(snapshot.byGrantId).set(grantId, appended),
          totalBytes:
            snapshot.totalBytes +
            Buffer.byteLength(serializeRecordV1(appended), "utf8"),
        });
        observeSnapshotV1(this.#state, nextSnapshot);
        return Object.freeze({
          resolution: "committed" as const,
          grantId,
          ordinal: appended.ordinal,
          recordDigest: appended.recordDigest,
        });
      }
      return failV1("storage_failure", "ledger append contention did not converge");
    });
  }
}
