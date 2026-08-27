import { createHash, randomBytes } from "node:crypto";
import {
  chmod,
  link,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  statfs,
  unlink,
} from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import {
  PROVIDER_RUNTIME_IPC_STORAGE_DIRECTORY_MODE_V1,
  PROVIDER_RUNTIME_IPC_STORAGE_FILE_MODE_V1,
  ProviderRuntimeIpcFixedObjectLocatorV1Schema,
  ProviderRuntimeIpcJournalStateV1Schema,
  ProviderRuntimeIpcCompareCommitResultV1Schema,
  ProviderRuntimeIpcStrongMutationRequestV1Schema,
  ProviderRuntimeIpcStrongMutationResponseV1Schema,
  ProviderRuntimeIpcWriteObjectResultV1Schema,
  type ProviderRuntimeIpcFixedObjectLocatorV1,
  type ProviderRuntimeIpcJournalStateV1,
  type ProviderRuntimeIpcJsonValueV1,
  type ProviderRuntimeIpcStrongMutationRequestV1,
  type ProviderRuntimeIpcStrongMutationResponseV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";
import { DurableObjectIdentityProviderIdV1Schema } from "@understand-code/durable-object-provider-contracts/primitives";
import {
  assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1,
  closeProviderRuntimeNativeExactObjectPublisherV1,
  closeProviderRuntimeNativeExactObjectSourceV1,
  commitProviderRuntimeNativeExactObjectV1,
  openProviderRuntimeNativeExactObjectPublisherV1,
  revalidateProviderRuntimeNativeExactObjectPublisherV1,
  stageProviderRuntimeNativeExactObjectV1,
  type ProviderRuntimeNativeExactObjectPublisherV1,
  type ProviderRuntimeNativeExactObjectSourceV1,
} from "@understand-code/native-kernel-bridge";

import {
  consumeProviderRuntimeStrongMutationExecutionAuthorizationInternalV1,
  type ProviderRuntimeStrongMutationExecutionAuthorizationInternalV1,
} from "./strong-mutation-session-authority-internal.js";
import { projectProviderRuntimeDurableLifecycleArtifactSetV1 } from "./durable-lifecycle-artifacts.js";

const JOURNAL_DISK_PROFILE_V1 =
  "provider_runtime_durable_operation_journal_v1" as const;
const JOURNAL_STATE_PROFILE_V1 =
  "provider_runtime_durable_journal_state_v1" as const;
const CONTENT_DIGEST_PREFIX = "sha256:";
const OPERATION_NONCE_PATTERN = /^[0-9a-f]{32}$/u;
const DEFAULT_MAX_OBJECT_BYTES = 6 * 1024 * 1024;
const DEFAULT_MAX_JOURNAL_BYTES = 8 * 1024 * 1024;
const STRONG_MUTATION_OUTCOME_PROFILE_V1 =
  "provider_runtime_strong_mutation_outcome_v1" as const;
const STRONG_MUTATION_NONCE_RECEIPT_PROFILE_V1 =
  "provider_runtime_strong_mutation_nonce_receipt_v1" as const;
const STRONG_MUTATION_NONCE_RECEIPT_ERA_PROFILE_V1 =
  "provider_runtime_strong_mutation_nonce_receipt_era_v1" as const;
const STRONG_MUTATION_NONCE_RECEIPT_ERA_NAME_V1 =
  "nonce-receipt-era-v1.json" as const;
const STRONG_MUTATION_NONCE_RECEIPT_NAME_V1 =
  /^nonce-([0-9a-f]{32})\.json$/u;
const STRONG_MUTATION_ABANDONED_TEMP_NAME_V1 =
  /^\.(?:nonce-[0-9a-f]{32}|nonce-receipt-era-v1|[0-9a-f]{64})\.json\.[0-9]+\.[0-9a-f]{24}\.tmp$/u;

type JsonObjectV1 = Readonly<Record<string, ProviderRuntimeIpcJsonValueV1>>;

export type ProviderRuntimeStorageErrorCodeV1 =
  | "invalid_input"
  | "journal_corrupt"
  | "object_digest_mismatch"
  | "object_length_mismatch"
  | "object_not_found"
  | "operation_nonce_conflict"
  | "provider_mismatch"
  | "strong_mutation_outcome_missing"
  | "storage_failure"
  | "storage_security_violation";

export class ProviderRuntimeStorageErrorV1 extends Error {
  readonly code: ProviderRuntimeStorageErrorCodeV1;

  constructor(code: ProviderRuntimeStorageErrorCodeV1, message: string) {
    super(message);
    this.name = "ProviderRuntimeStorageErrorV1";
    this.code = code;
  }
}

function durableLifecycleBaseCanonicalV1(
  phase: string,
  artifacts: JsonObjectV1,
  errorCode: "invalid_input" | "journal_corrupt",
): string | undefined {
  if (phase !== "final_strong_ready") return undefined;
  try {
    return canonicalizeJcsSafeIntegerV1(
      projectProviderRuntimeDurableLifecycleArtifactSetV1(artifacts)
        .lifecycleArtifacts,
    );
  } catch (cause) {
    throw new ProviderRuntimeStorageErrorV1(
      errorCode,
      errorCode === "journal_corrupt"
        ? "durable final_strong_ready lifecycle artifacts are corrupt"
        : "final_strong_ready requires the exact durable lifecycle artifact set",
    );
  }
}

/**
 * The namespace link may exist, but the held parent directory has not yet
 * acknowledged durability.  Callers must preserve the prepared outcome and
 * retry recovery; this is never a terminal failed mutation response.
 */
export class ProviderRuntimeStrongMutationDurabilityIndeterminateErrorV1
  extends Error {
  constructor(options?: ErrorOptions) {
    super("strong mutation durability is indeterminate", options);
    this.name = "ProviderRuntimeStrongMutationDurabilityIndeterminateErrorV1";
  }
}

export interface DurableObjectProviderRuntimeStoreOptionsV1 {
  readonly rootPath: string;
  readonly providerId: string;
  readonly maxObjectBytes?: number;
  readonly maxJournalBytes?: number;
}

interface DurableOperationJournalRecordDiskV1 {
  readonly ordinal: number;
  readonly expectedRevision: number;
  readonly revision: number;
  readonly operationNonce: string;
  readonly mutationDigest: string;
  readonly phase: string;
  readonly artifacts: JsonObjectV1;
  readonly previousReceiptDigest: string | "none";
  readonly receiptDigest: string;
}

interface DurableOperationJournalDiskV1 {
  readonly profile: typeof JOURNAL_DISK_PROFILE_V1;
  readonly providerId: string;
  readonly state: ProviderRuntimeIpcJournalStateV1;
  readonly records: readonly DurableOperationJournalRecordDiskV1[];
}

function journalStateFromRecordV1(
  record: DurableOperationJournalRecordDiskV1,
): ProviderRuntimeIpcJournalStateV1 {
  return ProviderRuntimeIpcJournalStateV1Schema.parse({
    profile: JOURNAL_STATE_PROFILE_V1,
    revision: record.revision,
    phase: record.phase,
    operationNonce: record.operationNonce,
    mutationDigest: record.mutationDigest,
    artifacts: record.artifacts,
  });
}

export interface WriteFixedObjectResultV1 {
  readonly resolution: "committed" | "replayed";
  readonly locator: ProviderRuntimeIpcFixedObjectLocatorV1;
  readonly logicalBytes: number;
  readonly verifiedContentDigest: string;
}

export interface ReadFixedObjectResultV1 {
  readonly locator: ProviderRuntimeIpcFixedObjectLocatorV1;
  readonly logicalBytes: number;
  readonly bytes: string;
  readonly verifiedContentDigest: string;
}

export interface CompareCommitInputV1 {
  readonly expectedRevision: number;
  readonly operationNonce: string;
  readonly phase: string;
  readonly artifacts: JsonObjectV1;
}

export interface CompareCommitResultV1 {
  readonly resolution: "committed" | "replayed" | "stale";
  readonly state: ProviderRuntimeIpcJournalStateV1;
}

interface DurableStrongMutationOutcomeDiskV1 {
  readonly profile: typeof STRONG_MUTATION_OUTCOME_PROFILE_V1;
  readonly providerId: string;
  readonly bindingDigest: string;
  readonly request: ProviderRuntimeIpcStrongMutationRequestV1;
  readonly response: ProviderRuntimeIpcStrongMutationResponseV1;
  readonly phase: "prepared" | "completed";
  readonly outcomeDigest: string;
}

type SuccessfulStrongMutationResponseV1 = Extract<
  ProviderRuntimeIpcStrongMutationResponseV1,
  { readonly ok: true }
>;

interface DurableStrongMutationNonceReceiptDiskV1 {
  readonly profile: typeof STRONG_MUTATION_NONCE_RECEIPT_PROFILE_V1;
  readonly providerId: string;
  readonly operationNonce: string;
  readonly operation: ProviderRuntimeIpcStrongMutationRequestV1["operation"];
  readonly requestDigest: string;
  readonly request: ProviderRuntimeIpcStrongMutationRequestV1;
  readonly response: SuccessfulStrongMutationResponseV1;
  readonly receiptDigest: string;
}

interface DurableStrongMutationNonceReceiptEraDiskV1 {
  readonly profile: typeof STRONG_MUTATION_NONCE_RECEIPT_ERA_PROFILE_V1;
  readonly providerId: string;
  readonly outcomeProfile: typeof STRONG_MUTATION_OUTCOME_PROFILE_V1;
  readonly nonceReceiptProfile: typeof STRONG_MUTATION_NONCE_RECEIPT_PROFILE_V1;
  readonly markerDigest: string;
}

interface ScannedStrongMutationStateV1 {
  readonly outcomes: readonly DurableStrongMutationOutcomeDiskV1[];
  readonly nonceReceipts: readonly DurableStrongMutationNonceReceiptDiskV1[];
  readonly nonceReceiptEraEstablished: boolean;
}

export interface ProviderRuntimeStrongMutationNonceReceiptMigrationSelectionV1 {
  readonly operationNonce: string;
  readonly bindingDigest: string;
}

interface RetainedStrongMutationDirectoryV1 {
  readonly handle: FileHandle;
  readonly dev: bigint;
  readonly ino: bigint;
}

interface RetainedStrongMutationExactObjectAuthorityV1 {
  readonly providerObjects: RetainedStrongMutationDirectoryV1;
  readonly journal: RetainedStrongMutationDirectoryV1;
  readonly outcomes: RetainedStrongMutationDirectoryV1;
  /** Present for every production strong writer; absent only in test fixtures. */
  readonly nativePublisher?: ProviderRuntimeNativeExactObjectPublisherV1;
}

export type CreateProviderRuntimeStrongMutationResponseV1 = (
  payload: unknown,
) => ProviderRuntimeIpcStrongMutationResponseV1;

export interface ProviderRuntimeDurableStrongMutationOutcomeInspectionV1 {
  readonly phase: "prepared" | "completed";
  readonly request: ProviderRuntimeIpcStrongMutationRequestV1;
  readonly response: ProviderRuntimeIpcStrongMutationResponseV1;
}

function sha256DigestV1(bytes: string | Uint8Array): string {
  return `${CONTENT_DIGEST_PREFIX}${createHash("sha256").update(bytes).digest("hex")}`;
}

function canonicalCloneV1<T>(value: T): T {
  return JSON.parse(canonicalizeJcsSafeIntegerV1(value)) as T;
}

function isErrnoV1(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}

function assertSafeBoundV1(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ProviderRuntimeStorageErrorV1(
      "invalid_input",
      `${name} must be a nonnegative safe integer`,
    );
  }
}

function isValidPhaseV1(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 128;
}

function parseCanonicalBytesV1(
  value: string,
  maxObjectBytes: number,
): Uint8Array {
  if (!value.startsWith("base64url:")) {
    throw new ProviderRuntimeStorageErrorV1(
      "invalid_input",
      "object bytes must use the canonical base64url: encoding",
    );
  }
  const body = value.slice("base64url:".length);
  const bytes = Buffer.from(body, "base64url");
  if (bytes.toString("base64url") !== body) {
    throw new ProviderRuntimeStorageErrorV1(
      "invalid_input",
      "object bytes are not canonical base64url",
    );
  }
  if (bytes.byteLength > maxObjectBytes) {
    throw new ProviderRuntimeStorageErrorV1(
      "invalid_input",
      `object exceeds the ${maxObjectBytes}-byte runtime limit`,
    );
  }
  return bytes;
}

function createInitialStateV1(): ProviderRuntimeIpcJournalStateV1 {
  return ProviderRuntimeIpcJournalStateV1Schema.parse({
    profile: JOURNAL_STATE_PROFILE_V1,
    revision: 0,
    phase: "uninitialized",
    operationNonce: "none",
    mutationDigest: "none",
    artifacts: {},
  });
}

function receiptClaimsV1(
  record: Omit<DurableOperationJournalRecordDiskV1, "receiptDigest">,
): object {
  return {
    domain: "understand-code-durable-provider-operation-receipt-v1",
    record,
  };
}

function mutationDigestV1(input: CompareCommitInputV1): string {
  return sha256DigestV1(
    canonicalizeJcsSafeIntegerV1({
      domain: "understand-code-durable-provider-operation-mutation-v1",
      expectedRevision: input.expectedRevision,
      operationNonce: input.operationNonce,
      phase: input.phase,
      artifacts: input.artifacts,
    }),
  );
}

function strongMutationOutcomeDigestV1(
  input: Omit<DurableStrongMutationOutcomeDiskV1, "outcomeDigest">,
): string {
  return sha256DigestV1(
    canonicalizeJcsSafeIntegerV1({
      domain: "understand-code-provider-runtime-strong-mutation-outcome-v1",
      outcome: input,
    }),
  );
}

function strongMutationNonceReceiptDigestV1(
  input: Omit<DurableStrongMutationNonceReceiptDiskV1, "receiptDigest">,
): string {
  return sha256DigestV1(
    canonicalizeJcsSafeIntegerV1({
      domain: "understand-code-provider-runtime-strong-mutation-nonce-receipt-v1",
      receipt: input,
    }),
  );
}

function strongMutationNonceReceiptEraDigestV1(
  input: Omit<DurableStrongMutationNonceReceiptEraDiskV1, "markerDigest">,
): string {
  return sha256DigestV1(
    canonicalizeJcsSafeIntegerV1({
      domain: "understand-code-provider-runtime-strong-mutation-nonce-receipt-era-v1",
      marker: input,
    }),
  );
}

function exactCanonicalV1(left: unknown, right: unknown): boolean {
  try {
    return canonicalizeJcsSafeIntegerV1(left) ===
      canonicalizeJcsSafeIntegerV1(right);
  } catch {
    return false;
  }
}

function exactObjectKeysV1(value: object, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function asRecordV1(value: unknown, label: string): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new ProviderRuntimeStorageErrorV1(
      "journal_corrupt",
      `${label} must be a JSON object`,
    );
  }
  return value as Record<string, unknown>;
}

async function syncDirectoryV1(path: string): Promise<void> {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function ensurePrivateDirectoryV1(path: string): Promise<void> {
  try {
    await mkdir(path, {
      recursive: true,
      mode: PROVIDER_RUNTIME_IPC_STORAGE_DIRECTORY_MODE_V1,
    });
  } catch (error) {
    throw new ProviderRuntimeStorageErrorV1(
      "storage_failure",
      `could not create private runtime directory: ${String(error)}`,
    );
  }

  const metadata = await lstat(path);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new ProviderRuntimeStorageErrorV1(
      "storage_security_violation",
      "runtime storage path must be a real directory",
    );
  }
  if (typeof process.getuid === "function" && metadata.uid !== process.getuid()) {
    throw new ProviderRuntimeStorageErrorV1(
      "storage_security_violation",
      "runtime storage directory is not owned by the current user",
    );
  }
  if ((metadata.mode & 0o077) !== 0) {
    throw new ProviderRuntimeStorageErrorV1(
      "storage_security_violation",
      "runtime storage directory grants group or other access",
    );
  }
  await chmod(path, PROVIDER_RUNTIME_IPC_STORAGE_DIRECTORY_MODE_V1);
}

async function assertPrivateRegularFileV1(path: string): Promise<void> {
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new ProviderRuntimeStorageErrorV1(
      "storage_security_violation",
      "runtime storage file must be a real regular file",
    );
  }
  if (typeof process.getuid === "function" && metadata.uid !== process.getuid()) {
    throw new ProviderRuntimeStorageErrorV1(
      "storage_security_violation",
      "runtime storage file is not owned by the current user",
    );
  }
  if ((metadata.mode & 0o077) !== 0) {
    throw new ProviderRuntimeStorageErrorV1(
      "storage_security_violation",
      "runtime storage file grants group or other access",
    );
  }
}

async function atomicReplacePrivateFileV1(
  targetPath: string,
  bytes: string | Uint8Array,
): Promise<void> {
  const parent = dirname(targetPath);
  const temporaryPath = join(
    parent,
    `.${basename(targetPath)}.${process.pid}.${randomBytes(12).toString("hex")}.tmp`,
  );
  const handle = await open(
    temporaryPath,
    "wx",
    PROVIDER_RUNTIME_IPC_STORAGE_FILE_MODE_V1,
  );
  let renamed = false;
  try {
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    await rename(temporaryPath, targetPath);
    renamed = true;
    await chmod(targetPath, PROVIDER_RUNTIME_IPC_STORAGE_FILE_MODE_V1);
    await syncDirectoryV1(parent);
  } finally {
    try {
      await handle.close();
    } catch {
      // The handle is already closed on the successful path.
    }
    if (!renamed) {
      try {
        await unlink(temporaryPath);
      } catch (error) {
        if (!isErrnoV1(error, "ENOENT")) throw error;
      }
    }
  }
}

export class DurableObjectProviderRuntimeStoreV1 {
  readonly rootPath: string;
  readonly providerId: string;
  readonly objectsPath: string;
  readonly journalPath: string;
  readonly journalStatePath: string;
  readonly strongMutationOutcomesPath: string;

  readonly #maxObjectBytes: number;
  readonly #maxJournalBytes: number;
  #state: ProviderRuntimeIpcJournalStateV1 = createInitialStateV1();
  #records: readonly DurableOperationJournalRecordDiskV1[] = [];
  #initialized = false;
  #mutationTail: Promise<void> = Promise.resolve();
  #strongMutationTail: Promise<void> = Promise.resolve();
  #strongMutationExactObjectAuthority:
    | RetainedStrongMutationExactObjectAuthorityV1
    | undefined;
  #testCompletedOutcomePersistFailureArmed = false;
  #testNonceReceiptPersistCutArmed = false;
  #testNonceReceiptMigrationBackfillCutArmed = false;

  constructor(options: DurableObjectProviderRuntimeStoreOptionsV1) {
    this.rootPath = resolve(options.rootPath);
    this.providerId = DurableObjectIdentityProviderIdV1Schema.parse(
      options.providerId,
    );
    this.objectsPath = join(this.rootPath, "objects");
    this.journalPath = join(this.rootPath, "journal");
    this.journalStatePath = join(this.journalPath, "state.json");
    this.strongMutationOutcomesPath = join(
      this.rootPath,
      "strong-mutation-outcomes",
    );
    this.#maxObjectBytes = options.maxObjectBytes ?? DEFAULT_MAX_OBJECT_BYTES;
    this.#maxJournalBytes = options.maxJournalBytes ?? DEFAULT_MAX_JOURNAL_BYTES;
    assertSafeBoundV1(this.#maxObjectBytes, "maxObjectBytes");
    assertSafeBoundV1(this.#maxJournalBytes, "maxJournalBytes");
  }

  async initialize(): Promise<void> {
    if (this.#initialized) return;
    await ensurePrivateDirectoryV1(this.rootPath);
    await ensurePrivateDirectoryV1(this.objectsPath);
    await ensurePrivateDirectoryV1(this.journalPath);
    await ensurePrivateDirectoryV1(this.strongMutationOutcomesPath);
    await ensurePrivateDirectoryV1(join(
      this.objectsPath,
      encodeURIComponent(this.providerId),
    ));

    try {
      await assertPrivateRegularFileV1(this.journalStatePath);
      const serialized = await readFile(this.journalStatePath, "utf8");
      if (Buffer.byteLength(serialized, "utf8") > this.#maxJournalBytes) {
        throw new ProviderRuntimeStorageErrorV1(
          "journal_corrupt",
          "durable operation journal exceeds its configured byte limit",
        );
      }
      const disk = this.#parseAndVerifyJournal(serialized);
      this.#state = disk.state;
      this.#records = disk.records;
    } catch (error) {
      if (!isErrnoV1(error, "ENOENT")) throw error;
      const disk: DurableOperationJournalDiskV1 = {
        profile: JOURNAL_DISK_PROFILE_V1,
        providerId: this.providerId,
        state: createInitialStateV1(),
        records: [],
      };
      await this.#persistJournal(disk);
      this.#state = disk.state;
      this.#records = disk.records;
    }
    this.#initialized = true;
  }

  /** Retain the exact native Linux/ext4 publication and private-state roots. */
  async establishStrongMutationExactObjectAuthorityV1(): Promise<void> {
    this.#assertInitialized();
    if (this.#strongMutationExactObjectAuthority !== undefined) return;
    const testing = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
    if (process.platform !== "linux" && !testing) {
      throw new ProviderRuntimeStorageErrorV1(
        "storage_security_violation",
        "strong mutation exact-object authority requires Linux",
      );
    }
    const opened: FileHandle[] = [];
    let nativePublisher: ProviderRuntimeNativeExactObjectPublisherV1 | undefined;
    try {
      const retain = async (path: string): Promise<RetainedStrongMutationDirectoryV1> => {
        const handle = await open(path, "r");
        opened.push(handle);
        const metadata = await handle.stat({ bigint: true });
        if (
          !metadata.isDirectory() ||
          (typeof process.getuid === "function" &&
            metadata.uid !== BigInt(process.getuid())) ||
          (metadata.mode & 0o777n) !== 0o700n
        ) {
          throw new ProviderRuntimeStorageErrorV1(
            "storage_security_violation",
            "strong mutation directory authority is invalid",
          );
        }
        if (!testing) {
          const filesystem = await statfs(`/proc/self/fd/${handle.fd}`, {
            bigint: true,
          });
          if (filesystem.type !== 0xef53n) {
            throw new ProviderRuntimeStorageErrorV1(
              "storage_security_violation",
              "strong mutation exact-object authority requires ext4",
            );
          }
          assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1(
            handle.fd,
            { expectedKind: "directory" },
          );
        }
        return Object.freeze({
          handle,
          dev: metadata.dev,
          ino: metadata.ino,
        });
      };
      const providerObjectsPath = join(
        this.objectsPath,
        encodeURIComponent(this.providerId),
      );
      const providerObjects = await retain(providerObjectsPath);
      nativePublisher = testing
        ? undefined
        : openProviderRuntimeNativeExactObjectPublisherV1(
          providerObjectsPath,
          {
            expectedOwnerUid: process.geteuid?.() ?? process.getuid!(),
            expectedOwnerGid: process.getegid?.() ?? process.getgid!(),
          },
        );
      const authority = Object.freeze({
        providerObjects,
        journal: await retain(this.journalPath),
        outcomes: await retain(this.strongMutationOutcomesPath),
        ...(nativePublisher === undefined ? {} : { nativePublisher }),
      });
      this.#strongMutationExactObjectAuthority = authority;
      nativePublisher = undefined;
      opened.length = 0;
    } finally {
      if (nativePublisher !== undefined) {
        try {
          closeProviderRuntimeNativeExactObjectPublisherV1(nativePublisher);
        } catch {
          // Preserve the original admission failure.
        }
      }
      await Promise.allSettled(opened.map((handle) => handle.close()));
    }
  }

  async closeStrongMutationExactObjectAuthorityV1(): Promise<void> {
    const authority = this.#strongMutationExactObjectAuthority;
    this.#strongMutationExactObjectAuthority = undefined;
    if (authority === undefined) return;
    let nativeCloseError: unknown;
    if (authority.nativePublisher !== undefined) {
      try {
        closeProviderRuntimeNativeExactObjectPublisherV1(
          authority.nativePublisher,
        );
      } catch (error) {
        nativeCloseError = error;
      }
    }
    await Promise.allSettled([
      authority.providerObjects.handle.close(),
      authority.journal.handle.close(),
      authority.outcomes.handle.close(),
    ]);
    if (nativeCloseError !== undefined) throw nativeCloseError;
  }

  inspectState(): ProviderRuntimeIpcJournalStateV1 {
    this.#assertInitialized();
    return canonicalCloneV1(this.#state);
  }

  /** Test-only one-shot cut after execution but before completed persistence. */
  armTestStrongMutationCompletedOutcomePersistFailureOnceV1(): void {
    if (
      (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") ||
      this.#testCompletedOutcomePersistFailureArmed
    ) {
      throw new ProviderRuntimeStorageErrorV1(
        "storage_security_violation",
        "strong mutation persistence fault seam is unavailable",
      );
    }
    this.#testCompletedOutcomePersistFailureArmed = true;
  }

  /** Test-only crash cut after the global receipt fsync and before binding WAL. */
  armTestStrongMutationNonceReceiptPersistCutOnceV1(): void {
    if (
      (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") ||
      this.#testNonceReceiptPersistCutArmed
    ) {
      throw new ProviderRuntimeStorageErrorV1(
        "storage_security_violation",
        "strong mutation nonce-receipt fault seam is unavailable",
      );
    }
    this.#testNonceReceiptPersistCutArmed = true;
  }

  /** Test-only crash cut after one legacy receipt backfill and before the era marker. */
  armTestStrongMutationNonceReceiptMigrationBackfillCutOnceV1(): void {
    if (
      (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") ||
      this.#testNonceReceiptMigrationBackfillCutArmed
    ) {
      throw new ProviderRuntimeStorageErrorV1(
        "storage_security_violation",
        "strong mutation nonce-receipt migration fault seam is unavailable",
      );
    }
    this.#testNonceReceiptMigrationBackfillCutArmed = true;
  }

  /**
   * Write-ahead strong-mutation execution.  The exact principal-signed result
   * is fsynced before the first storage side effect.  A crash may therefore
   * leave only `prepared`; recovery applies the same idempotent plan and
   * returns the byte-identical response instead of authorizing a new plan.
   */
  async executeStrongMutationDurablyV1(
    requestInput: ProviderRuntimeIpcStrongMutationRequestV1,
    authorization:
      ProviderRuntimeStrongMutationExecutionAuthorizationInternalV1,
    createResponse: CreateProviderRuntimeStrongMutationResponseV1,
  ): Promise<ProviderRuntimeIpcStrongMutationResponseV1> {
    this.#assertInitialized();
    return this.#strongMutationExclusive(async () => {
      const request = ProviderRuntimeIpcStrongMutationRequestV1Schema.parse(
        requestInput,
      );
      await this.#assertRetainedStrongMutationExactObjectAuthorityV1();
      if (!consumeProviderRuntimeStrongMutationExecutionAuthorizationInternalV1(
        authorization,
        {
          bindingDigest: request.bindingDigest,
          requestDigest: request.requestDigest,
          disposition: "execute",
        },
      )) {
        throw new ProviderRuntimeStorageErrorV1(
          "storage_security_violation",
          "strong mutation execution authorization is unavailable",
        );
      }
      const scanned = await this.#scanStrongMutationStateV1();
      if (!scanned.nonceReceiptEraEstablished) {
        throw new ProviderRuntimeStorageErrorV1(
          "journal_corrupt",
          "strong mutation nonce-receipt migration is incomplete",
        );
      }
      this.#assertStrongMutationOperationNonceAvailableV1(
        scanned.nonceReceipts,
        request,
      );
      const existing = this.#findStrongMutationOutcomeV1(
        scanned.outcomes,
        request,
      );
      if (existing !== undefined) {
        return this.#resumePreparedStrongMutationV1(existing);
      }
      let nonceReceipt = this.#findStrongMutationNonceReceiptV1(
        scanned.nonceReceipts,
        request,
      );
      if (nonceReceipt === undefined) {
        const plannedPayload = await this.#planStrongMutationPayloadV1(request);
        const response = this.#createPreparedStrongMutationResponseV1(
          request,
          plannedPayload,
          createResponse,
        );
        nonceReceipt = this.#strongMutationNonceReceiptV1(
          request,
          response,
        );
        await this.#persistStrongMutationNonceReceiptV1(nonceReceipt);
        if (this.#testNonceReceiptPersistCutArmed) {
          this.#testNonceReceiptPersistCutArmed = false;
          throw new ProviderRuntimeStrongMutationDurabilityIndeterminateErrorV1();
        }
      }
      if (!exactCanonicalV1(nonceReceipt.request, request)) {
        await this.#resumeNonceReceiptFirstOutcomeV1(
          nonceReceipt,
          scanned.outcomes,
        );
        return this.#createPreparedStrongMutationResponseV1(
          request,
          nonceReceipt.response.payload,
          createResponse,
        );
      }
      return this.#resumeNonceReceiptFirstOutcomeV1(
        nonceReceipt,
        scanned.outcomes,
      );
    });
  }

  /** Recovery-only: absence of a previously fsynced outcome fails closed. */
  async recoverStrongMutationOutcomeV1(
    requestInput: ProviderRuntimeIpcStrongMutationRequestV1,
    authorization:
      ProviderRuntimeStrongMutationExecutionAuthorizationInternalV1,
    createResponse: CreateProviderRuntimeStrongMutationResponseV1,
  ): Promise<ProviderRuntimeIpcStrongMutationResponseV1> {
    this.#assertInitialized();
    return this.#strongMutationExclusive(async () => {
      const request = ProviderRuntimeIpcStrongMutationRequestV1Schema.parse(
        requestInput,
      );
      await this.#assertRetainedStrongMutationExactObjectAuthorityV1();
      if (!consumeProviderRuntimeStrongMutationExecutionAuthorizationInternalV1(
        authorization,
        {
          bindingDigest: request.bindingDigest,
          requestDigest: request.requestDigest,
          disposition: "recover",
        },
      )) {
        throw new ProviderRuntimeStorageErrorV1(
          "storage_security_violation",
          "strong mutation recovery authorization is unavailable",
        );
      }
      const scanned = await this.#scanStrongMutationStateV1();
      this.#assertStrongMutationOperationNonceAvailableV1(
        scanned.nonceReceipts,
        request,
      );
      const existing = this.#findStrongMutationOutcomeV1(
        scanned.outcomes,
        request,
      );
      if (existing === undefined) {
        const nonceReceipt = this.#findStrongMutationNonceReceiptV1(
          scanned.nonceReceipts,
          request,
        );
        if (nonceReceipt === undefined) {
          throw new ProviderRuntimeStorageErrorV1(
            "strong_mutation_outcome_missing",
            "durable strong mutation outcome is unavailable",
          );
        }
        if (!exactCanonicalV1(nonceReceipt.request, request)) {
          await this.#resumeNonceReceiptFirstOutcomeV1(
            nonceReceipt,
            scanned.outcomes,
          );
          return this.#createPreparedStrongMutationResponseV1(
            request,
            nonceReceipt.response.payload,
            createResponse,
          );
        }
        return this.#resumeNonceReceiptFirstOutcomeV1(
          nonceReceipt,
          scanned.outcomes,
        );
      }
      return this.#resumePreparedStrongMutationV1(existing);
    });
  }

  async inspectStrongMutationOutcomesForRecoveryV1(): Promise<
    readonly ProviderRuntimeDurableStrongMutationOutcomeInspectionV1[]
  > {
    this.#assertInitialized();
    return this.#strongMutationExclusive(async () => {
      const scanned = await this.#scanStrongMutationStateV1();
      const outcomes = [...scanned.outcomes];
      for (const receipt of scanned.nonceReceipts) {
        if (!outcomes.some(
          (outcome) => outcome.bindingDigest === receipt.request.bindingDigest,
        )) {
          outcomes.push(this.#strongMutationOutcomeV1(
            receipt.request,
            receipt.response,
            "prepared",
          ));
        }
      }
      return Object.freeze(outcomes.map((outcome) => Object.freeze({
        phase: outcome.phase,
        request: outcome.request,
        response: outcome.response,
      })));
    });
  }

  async strongMutationNonceReceiptMigrationRequiredV1(): Promise<boolean> {
    this.#assertInitialized();
    return this.#strongMutationExclusive(async () =>
      !(await this.#scanStrongMutationStateV1()).nonceReceiptEraEstablished
    );
  }

  async finalizeStrongMutationNonceReceiptMigrationV1(
    selections: readonly ProviderRuntimeStrongMutationNonceReceiptMigrationSelectionV1[],
  ): Promise<void> {
    this.#assertInitialized();
    await this.#strongMutationExclusive(async () => {
      const scanned = await this.#scanStrongMutationStateV1();
      if (scanned.nonceReceiptEraEstablished) return;
      const selectedByNonce = new Map(selections.map((selection) => [
        selection.operationNonce,
        selection.bindingDigest,
      ]));
      const outcomesByNonce = new Map<
        string,
        DurableStrongMutationOutcomeDiskV1[]
      >();
      for (const outcome of scanned.outcomes) {
        const group = outcomesByNonce.get(outcome.request.operationNonce) ?? [];
        group.push(outcome);
        outcomesByNonce.set(outcome.request.operationNonce, group);
      }
      if (
        selectedByNonce.size !== selections.length ||
        selectedByNonce.size !== outcomesByNonce.size
      ) {
        throw new ProviderRuntimeStorageErrorV1(
          "journal_corrupt",
          "legacy nonce-receipt authority selection is incomplete",
        );
      }
      for (const [operationNonce, outcomes] of outcomesByNonce) {
        const selectedBinding = selectedByNonce.get(operationNonce);
        const selected = outcomes.find(
          (outcome) => outcome.bindingDigest === selectedBinding,
        );
        if (selected === undefined || !selected.response.ok) {
          throw new ProviderRuntimeStorageErrorV1(
            "journal_corrupt",
            "legacy nonce-receipt authority selection is invalid",
          );
        }
        const receipt = this.#strongMutationNonceReceiptV1(
          selected.request,
          selected.response,
        );
        const existing = scanned.nonceReceipts.find(
          (candidate) => candidate.operationNonce === operationNonce,
        );
        if (existing !== undefined) {
          if (!exactCanonicalV1(existing, receipt)) {
            throw new ProviderRuntimeStorageErrorV1(
              "journal_corrupt",
              "partial legacy nonce-receipt backfill conflicts with authority",
            );
          }
          continue;
        }
        await this.#persistStrongMutationNonceReceiptV1(receipt);
        if (this.#testNonceReceiptMigrationBackfillCutArmed) {
          this.#testNonceReceiptMigrationBackfillCutArmed = false;
          throw new ProviderRuntimeStorageErrorV1(
            "storage_failure",
            "injected strong mutation nonce-receipt migration backfill cut",
          );
        }
      }
      await this.#persistStrongMutationNonceReceiptEraV1();
    });
  }

  async #planStrongMutationPayloadV1(
    request: ProviderRuntimeIpcStrongMutationRequestV1,
  ): Promise<unknown> {
    if (request.operation === "write_object") {
      let resolution: "committed" | "replayed" = "committed";
      try {
        const existing = await this.readFixedObject(request.payload.locator);
        if (
          existing.logicalBytes !== request.payload.logicalBytes ||
          existing.verifiedContentDigest !==
            request.payload.locator.contentDigest
        ) {
          throw new ProviderRuntimeStorageErrorV1(
            "object_digest_mismatch",
            "existing fixed object conflicts with strong mutation",
          );
        }
        resolution = "replayed";
      } catch (error) {
        if (
          !(error instanceof ProviderRuntimeStorageErrorV1) ||
          error.code !== "object_not_found"
        ) throw error;
      }
      return {
        operation: "write_object" as const,
        resolution,
        locator: request.payload.locator,
        logicalBytes: request.payload.logicalBytes,
        verifiedContentDigest: request.payload.locator.contentDigest,
      };
    }

    const input = request.payload;
    assertSafeBoundV1(input.expectedRevision, "expectedRevision");
    const artifacts = canonicalCloneV1(input.artifacts);
    const normalized: CompareCommitInputV1 = {
      expectedRevision: input.expectedRevision,
      operationNonce: input.operationNonce,
      phase: input.phase,
      artifacts,
    };
    const digest = mutationDigestV1(normalized);
    const prior = this.#records.find(
      (record) => record.operationNonce === input.operationNonce,
    );
    if (prior !== undefined && prior.mutationDigest !== digest) {
      throw new ProviderRuntimeStorageErrorV1(
        "operation_nonce_conflict",
        "operationNonce was already committed for a different mutation",
      );
    }
    if (prior !== undefined) {
      return {
        operation: "compare_commit" as const,
        resolution: "replayed" as const,
        state: canonicalCloneV1(journalStateFromRecordV1(prior)),
      };
    }
    this.#assertDurableLifecycleTransitionV1(input.phase, artifacts);
    if (input.expectedRevision !== this.#state.revision) {
      return {
        operation: "compare_commit" as const,
        resolution: "stale" as const,
        state: canonicalCloneV1(this.#state),
      };
    }
    return {
      operation: "compare_commit" as const,
      resolution: "committed" as const,
      state: ProviderRuntimeIpcJournalStateV1Schema.parse({
        profile: JOURNAL_STATE_PROFILE_V1,
        revision: input.expectedRevision + 1,
        phase: input.phase,
        operationNonce: input.operationNonce,
        mutationDigest: digest,
        artifacts,
      }),
    };
  }

  async #completePreparedStrongMutationV1(
    outcome: DurableStrongMutationOutcomeDiskV1,
  ): Promise<ProviderRuntimeIpcStrongMutationResponseV1> {
    if (outcome.phase === "completed") return outcome.response;
    if (!outcome.response.ok) {
      throw new ProviderRuntimeStorageErrorV1(
        "journal_corrupt",
        "prepared strong mutation outcome is not successful",
      );
    }
    const request = outcome.request;
    const expected = outcome.response.payload;
    // This is the last asynchronous admission cut before the native source is
    // staged. The production write below never accepts a source pathname/name.
    await this.#assertRetainedStrongMutationExactObjectAuthorityV1();
    if (request.operation === "write_object") {
      if (expected.operation !== "write_object") {
        throw new ProviderRuntimeStorageErrorV1(
          "journal_corrupt",
          "prepared strong write outcome has the wrong operation",
        );
      }
      const actual = await this.#writeStrongFixedObjectExactV1(
        request.payload.locator,
        request.payload.logicalBytes,
        request.payload.bytes,
        expected.resolution === "committed",
      );
      if (
        actual.verifiedContentDigest !== expected.verifiedContentDigest ||
        actual.logicalBytes !== expected.logicalBytes ||
        !exactCanonicalV1(actual.locator, expected.locator) ||
        (expected.resolution === "replayed" && actual.resolution !== "replayed")
      ) {
        throw new ProviderRuntimeStorageErrorV1(
          "storage_security_violation",
          "strong write result diverged from its durable plan",
        );
      }
    } else {
      if (
        expected.operation !== "compare_commit" ||
        expected.resolution === "stale"
      ) {
        if (expected.operation !== "compare_commit") {
          throw new ProviderRuntimeStorageErrorV1(
            "journal_corrupt",
            "prepared strong compare outcome has the wrong operation",
          );
        }
        // A signed prepared stale decision is immutable and has no side
        // effect. Never re-run CAS after the head later reaches its expected
        // revision, or a stale response could become an unintended commit.
      } else {
        const actual = await this.compareCommit(request.payload);
        if (
          !exactCanonicalV1(actual.state, expected.state) ||
          (expected.resolution === "replayed"
            ? actual.resolution !== "replayed"
            : actual.resolution !== "committed" &&
              actual.resolution !== "replayed")
        ) {
          throw new ProviderRuntimeStorageErrorV1(
            "storage_security_violation",
            "strong compare-commit result diverged from its durable plan",
          );
        }
      }
    }
    const completed = this.#strongMutationOutcomeV1(
      outcome.request,
      outcome.response,
      "completed",
    );
    await this.#persistStrongMutationOutcomeV1(completed);
    return completed.response;
  }

  async #resumeNonceReceiptFirstOutcomeV1(
    receipt: DurableStrongMutationNonceReceiptDiskV1,
    outcomes: readonly DurableStrongMutationOutcomeDiskV1[],
  ): Promise<ProviderRuntimeIpcStrongMutationResponseV1> {
    const existing = this.#findStrongMutationOutcomeV1(
      outcomes,
      receipt.request,
    );
    if (existing !== undefined) {
      return this.#resumePreparedStrongMutationV1(existing);
    }
    const prepared = this.#strongMutationOutcomeV1(
      receipt.request,
      receipt.response,
      "prepared",
    );
    await this.#persistStrongMutationOutcomeV1(prepared);
    return this.#resumePreparedStrongMutationV1(prepared);
  }

  async #resumePreparedStrongMutationV1(
    outcome: DurableStrongMutationOutcomeDiskV1,
  ): Promise<ProviderRuntimeIpcStrongMutationResponseV1> {
    try {
      return await this.#completePreparedStrongMutationV1(outcome);
    } catch (error) {
      if (
        error instanceof
          ProviderRuntimeStrongMutationDurabilityIndeterminateErrorV1
      ) throw error;
      // Once the successful principal-signed prepared outcome is durable, no
      // later failure may be resolved as a conflicting terminal error. Keep
      // the broker binding pending and retry only this exact prepared plan.
      throw new ProviderRuntimeStrongMutationDurabilityIndeterminateErrorV1({
        cause: error,
      });
    }
  }

  async #writeStrongFixedObjectExactV1(
    locatorInput: ProviderRuntimeIpcFixedObjectLocatorV1,
    logicalBytes: number,
    canonicalBytes: string,
    requireDurablePublicationAttempt: boolean,
  ): Promise<WriteFixedObjectResultV1> {
    const authority = this.#strongMutationExactObjectAuthority;
    if (authority === undefined) {
      throw new ProviderRuntimeStorageErrorV1(
        "storage_security_violation",
        "strong mutation exact-object authority is unavailable",
      );
    }
    // Cross-platform protocol tests cannot register a production provider.
    // The production CLI never takes this branch.
    if (authority.nativePublisher === undefined) {
      if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
        throw new ProviderRuntimeStorageErrorV1(
          "storage_security_violation",
          "native exact-object publication is unavailable",
        );
      }
      return this.writeFixedObject(locatorInput, logicalBytes, canonicalBytes);
    }

    const locator = ProviderRuntimeIpcFixedObjectLocatorV1Schema.parse(
      locatorInput,
    );
    assertSafeBoundV1(logicalBytes, "logicalBytes");
    const bytes = parseCanonicalBytesV1(canonicalBytes, this.#maxObjectBytes);
    if (bytes.byteLength !== logicalBytes) {
      throw new ProviderRuntimeStorageErrorV1(
        "object_length_mismatch",
        "logicalBytes does not match the decoded object byte length",
      );
    }
    const verifiedContentDigest = sha256DigestV1(bytes);
    if (verifiedContentDigest !== locator.contentDigest) {
      throw new ProviderRuntimeStorageErrorV1(
        "object_digest_mismatch",
        "object bytes do not match the fixed locator content digest",
      );
    }
    if (!requireDurablePublicationAttempt) {
      try {
        const existing = await this.readFixedObject(locator);
        if (
          existing.logicalBytes !== logicalBytes ||
          existing.verifiedContentDigest !== verifiedContentDigest
        ) {
          throw new ProviderRuntimeStorageErrorV1(
            "object_digest_mismatch",
            "existing fixed object conflicts with the strong write",
          );
        }
        return {
          resolution: "replayed",
          locator,
          logicalBytes,
          verifiedContentDigest,
        };
      } catch (error) {
        if (
          !(error instanceof ProviderRuntimeStorageErrorV1) ||
          error.code !== "object_not_found"
        ) throw error;
      }
    }

    let source: ProviderRuntimeNativeExactObjectSourceV1 | undefined;
    try {
      revalidateProviderRuntimeNativeExactObjectPublisherV1(
        authority.nativePublisher,
      );
      source = stageProviderRuntimeNativeExactObjectV1(
        authority.nativePublisher,
        bytes,
      );
      const result = commitProviderRuntimeNativeExactObjectV1(
        authority.nativePublisher,
        source,
        `${locator.contentDigest.slice(CONTENT_DIGEST_PREFIX.length)}.blob`,
      );
      source = undefined;
      if (result.status === "durability_indeterminate") {
        throw new ProviderRuntimeStrongMutationDurabilityIndeterminateErrorV1();
      }
      if (result.status === "committed") {
        return {
          resolution: "committed",
          locator,
          logicalBytes,
          verifiedContentDigest,
        };
      }
      if (result.reason === "final_collision") {
        const existing = await this.readFixedObject(locator);
        if (
          existing.logicalBytes === logicalBytes &&
          existing.verifiedContentDigest === verifiedContentDigest
        ) {
          return {
            resolution: "replayed",
            locator,
            logicalBytes,
            verifiedContentDigest,
          };
        }
      }
      throw new ProviderRuntimeStorageErrorV1(
        "storage_security_violation",
        `native exact-object publication rejected: ${result.reason}`,
      );
    } catch (error) {
      if (
        error instanceof ProviderRuntimeStorageErrorV1 ||
        error instanceof
          ProviderRuntimeStrongMutationDurabilityIndeterminateErrorV1
      ) throw error;
      throw new ProviderRuntimeStorageErrorV1(
        "storage_security_violation",
        "native exact-object publication is unavailable",
      );
    } finally {
      if (source !== undefined) {
        try {
          closeProviderRuntimeNativeExactObjectSourceV1(source);
        } catch {
          // The publication failure remains fail-closed.
        }
      }
    }
  }

  async writeFixedObject(
    locatorInput: ProviderRuntimeIpcFixedObjectLocatorV1,
    logicalBytes: number,
    canonicalBytes: string,
  ): Promise<WriteFixedObjectResultV1> {
    this.#assertInitialized();
    return this.#exclusive(async () => {
      const locator = ProviderRuntimeIpcFixedObjectLocatorV1Schema.parse(locatorInput);
      assertSafeBoundV1(logicalBytes, "logicalBytes");
      const bytes = parseCanonicalBytesV1(canonicalBytes, this.#maxObjectBytes);
      if (bytes.byteLength !== logicalBytes) {
        throw new ProviderRuntimeStorageErrorV1(
          "object_length_mismatch",
          "logicalBytes does not match the decoded object byte length",
        );
      }
      const verifiedContentDigest = sha256DigestV1(bytes);
      if (verifiedContentDigest !== locator.contentDigest) {
        throw new ProviderRuntimeStorageErrorV1(
          "object_digest_mismatch",
          "object bytes do not match the fixed locator content digest",
        );
      }

      const targetPath = await this.#objectPath(locator);
      try {
        await assertPrivateRegularFileV1(targetPath);
        const existing = await readFile(targetPath);
        const existingDigest = sha256DigestV1(existing);
        if (
          existingDigest !== locator.contentDigest ||
          existing.byteLength !== logicalBytes
        ) {
          throw new ProviderRuntimeStorageErrorV1(
            "object_digest_mismatch",
            "existing fixed-locator object failed immutable replay verification",
          );
        }
        return {
          resolution: "replayed",
          locator,
          logicalBytes,
          verifiedContentDigest,
        };
      } catch (error) {
        if (!isErrnoV1(error, "ENOENT")) throw error;
      }

      const parent = dirname(targetPath);
      const temporaryPath = join(
        parent,
        `.${basename(targetPath)}.${process.pid}.${randomBytes(12).toString("hex")}.tmp`,
      );
      const handle = await open(
        temporaryPath,
        "wx",
        PROVIDER_RUNTIME_IPC_STORAGE_FILE_MODE_V1,
      );
      let linked = false;
      try {
        await handle.writeFile(bytes);
        await handle.sync();
        await handle.close();
        try {
          await link(temporaryPath, targetPath);
          linked = true;
          await syncDirectoryV1(parent);
        } catch (error) {
          if (!isErrnoV1(error, "EEXIST")) throw error;
          await assertPrivateRegularFileV1(targetPath);
          const existing = await readFile(targetPath);
          if (
            sha256DigestV1(existing) !== locator.contentDigest ||
            existing.byteLength !== logicalBytes
          ) {
            throw new ProviderRuntimeStorageErrorV1(
              "object_digest_mismatch",
              "concurrent fixed-locator object conflicts with the supplied bytes",
            );
          }
        }
      } finally {
        try {
          await handle.close();
        } catch {
          // The handle is already closed on the successful path.
        }
        try {
          await unlink(temporaryPath);
        } catch (error) {
          if (!isErrnoV1(error, "ENOENT")) throw error;
        }
      }

      return {
        resolution: linked ? "committed" : "replayed",
        locator,
        logicalBytes,
        verifiedContentDigest,
      };
    });
  }

  async readFixedObject(
    locatorInput: ProviderRuntimeIpcFixedObjectLocatorV1,
  ): Promise<ReadFixedObjectResultV1> {
    this.#assertInitialized();
    const locator = ProviderRuntimeIpcFixedObjectLocatorV1Schema.parse(locatorInput);
    const targetPath = await this.#objectPath(locator);
    let bytes: Buffer;
    try {
      await assertPrivateRegularFileV1(targetPath);
      bytes = await readFile(targetPath);
    } catch (error) {
      if (isErrnoV1(error, "ENOENT")) {
        throw new ProviderRuntimeStorageErrorV1(
          "object_not_found",
          "fixed-locator object was not found",
        );
      }
      throw error;
    }
    const verifiedContentDigest = sha256DigestV1(bytes);
    if (verifiedContentDigest !== locator.contentDigest) {
      throw new ProviderRuntimeStorageErrorV1(
        "object_digest_mismatch",
        "stored object bytes do not match the fixed locator content digest",
      );
    }
    return {
      locator,
      logicalBytes: bytes.byteLength,
      bytes: `base64url:${bytes.toString("base64url")}`,
      verifiedContentDigest,
    };
  }

  async compareCommit(input: CompareCommitInputV1): Promise<CompareCommitResultV1> {
    this.#assertInitialized();
    return this.#exclusive(async () => {
      assertSafeBoundV1(input.expectedRevision, "expectedRevision");
      if (!OPERATION_NONCE_PATTERN.test(input.operationNonce)) {
        throw new ProviderRuntimeStorageErrorV1(
          "invalid_input",
          "operationNonce must be 32 lowercase hexadecimal characters",
        );
      }
      if (!isValidPhaseV1(input.phase)) {
        throw new ProviderRuntimeStorageErrorV1(
          "invalid_input",
          "phase must contain between 1 and 128 characters",
        );
      }
      const artifacts = canonicalCloneV1(input.artifacts);
      const normalizedInput: CompareCommitInputV1 = {
        expectedRevision: input.expectedRevision,
        operationNonce: input.operationNonce,
        phase: input.phase,
        artifacts,
      };
      const mutationDigest = mutationDigestV1(normalizedInput);
      const prior = this.#records.find(
        (record) => record.operationNonce === input.operationNonce,
      );
      if (prior !== undefined) {
        if (prior.mutationDigest !== mutationDigest) {
          throw new ProviderRuntimeStorageErrorV1(
            "operation_nonce_conflict",
            "operationNonce was already committed for a different mutation",
          );
        }
        return {
          resolution: "replayed",
          state: canonicalCloneV1(journalStateFromRecordV1(prior)),
        };
      }
      this.#assertDurableLifecycleTransitionV1(input.phase, artifacts);
      if (input.expectedRevision !== this.#state.revision) {
        return {
          resolution: "stale",
          state: canonicalCloneV1(this.#state),
        };
      }

      const previousReceiptDigest =
        this.#records.at(-1)?.receiptDigest ?? "none";
      const recordWithoutReceipt = {
        ordinal: this.#records.length + 1,
        expectedRevision: input.expectedRevision,
        revision: input.expectedRevision + 1,
        operationNonce: input.operationNonce,
        mutationDigest,
        phase: input.phase,
        artifacts,
        previousReceiptDigest,
      } satisfies Omit<DurableOperationJournalRecordDiskV1, "receiptDigest">;
      const record: DurableOperationJournalRecordDiskV1 = {
        ...recordWithoutReceipt,
        receiptDigest: sha256DigestV1(
          canonicalizeJcsSafeIntegerV1(receiptClaimsV1(recordWithoutReceipt)),
        ),
      };
      const state = ProviderRuntimeIpcJournalStateV1Schema.parse({
        profile: JOURNAL_STATE_PROFILE_V1,
        revision: record.revision,
        phase: record.phase,
        operationNonce: record.operationNonce,
        mutationDigest: record.mutationDigest,
        artifacts: record.artifacts,
      });
      const records = [...this.#records, record];
      await this.#persistJournal({
        profile: JOURNAL_DISK_PROFILE_V1,
        providerId: this.providerId,
        state,
        records,
      });
      this.#state = state;
      this.#records = records;
      return {
        resolution: "committed",
        state: canonicalCloneV1(state),
      };
    });
  }

  #assertDurableLifecycleTransitionV1(
    phase: string,
    artifacts: JsonObjectV1,
  ): void {
    const currentLifecycleBase = durableLifecycleBaseCanonicalV1(
      this.#state.phase,
      this.#state.artifacts,
      "journal_corrupt",
    );
    if (currentLifecycleBase !== undefined && phase !== "final_strong_ready") {
      throw new ProviderRuntimeStorageErrorV1(
        "invalid_input",
        "a final_strong_ready journal cannot leave its terminal lifecycle phase",
      );
    }
    const candidateLifecycleBase = durableLifecycleBaseCanonicalV1(
      phase,
      artifacts,
      "invalid_input",
    );
    if (
      currentLifecycleBase !== undefined &&
      candidateLifecycleBase !== currentLifecycleBase
    ) {
      throw new ProviderRuntimeStorageErrorV1(
        "invalid_input",
        "the durable final_strong_ready lifecycle artifact set is immutable",
      );
    }
  }

  async #objectPath(
    locator: ProviderRuntimeIpcFixedObjectLocatorV1,
  ): Promise<string> {
    if (locator.providerId !== this.providerId) {
      throw new ProviderRuntimeStorageErrorV1(
        "provider_mismatch",
        "fixed object locator does not belong to this runtime provider",
      );
    }
    const authority = this.#strongMutationExactObjectAuthority;
    const providerDirectory = authority !== undefined && process.platform === "linux"
      ? `/proc/self/fd/${authority.providerObjects.handle.fd}`
      : join(this.objectsPath, encodeURIComponent(this.providerId));
    if (authority === undefined) await ensurePrivateDirectoryV1(providerDirectory);
    return join(
      providerDirectory,
      `${locator.contentDigest.slice(CONTENT_DIGEST_PREFIX.length)}.blob`,
    );
  }

  #strongMutationOutcomePathV1(bindingDigest: string): string {
    if (!/^sha256:[0-9a-f]{64}$/u.test(bindingDigest)) {
      throw new ProviderRuntimeStorageErrorV1(
        "invalid_input",
        "strong mutation binding digest is invalid",
      );
    }
    const authority = this.#strongMutationExactObjectAuthority;
    const parent = authority !== undefined && process.platform === "linux"
      ? `/proc/self/fd/${authority.outcomes.handle.fd}`
      : this.strongMutationOutcomesPath;
    return join(
      parent,
      `${bindingDigest.slice(CONTENT_DIGEST_PREFIX.length)}.json`,
    );
  }

  #strongMutationNonceReceiptPathV1(operationNonce: string): string {
    if (!OPERATION_NONCE_PATTERN.test(operationNonce)) {
      throw new ProviderRuntimeStorageErrorV1(
        "invalid_input",
        "strong mutation operation nonce is invalid",
      );
    }
    const authority = this.#strongMutationExactObjectAuthority;
    const parent = authority !== undefined && process.platform === "linux"
      ? `/proc/self/fd/${authority.outcomes.handle.fd}`
      : this.strongMutationOutcomesPath;
    return join(parent, `nonce-${operationNonce}.json`);
  }

  #strongMutationNonceReceiptEraPathV1(): string {
    const authority = this.#strongMutationExactObjectAuthority;
    const parent = authority !== undefined && process.platform === "linux"
      ? `/proc/self/fd/${authority.outcomes.handle.fd}`
      : this.strongMutationOutcomesPath;
    return join(parent, STRONG_MUTATION_NONCE_RECEIPT_ERA_NAME_V1);
  }

  async #removeExactAbandonedStrongMutationTempV1(
    parent: string,
    name: string,
  ): Promise<void> {
    if (!STRONG_MUTATION_ABANDONED_TEMP_NAME_V1.test(name)) {
      throw new ProviderRuntimeStorageErrorV1(
        "journal_corrupt",
        "strong mutation temporary outcome name is invalid",
      );
    }
    const path = join(parent, name);
    const observed = await lstat(path);
    if (
      !observed.isFile() || observed.isSymbolicLink() ||
      observed.nlink !== 1 || (observed.mode & 0o777) !== 0o600 ||
      (typeof process.getuid === "function" && observed.uid !== process.getuid()) ||
      (typeof process.getgid === "function" && observed.gid !== process.getgid())
    ) {
      throw new ProviderRuntimeStorageErrorV1(
        "storage_security_violation",
        "abandoned strong mutation temporary outcome is not exact",
      );
    }
    const projected = await lstat(path);
    if (
      projected.isSymbolicLink() || !projected.isFile() ||
      projected.dev !== observed.dev || projected.ino !== observed.ino ||
      projected.mode !== observed.mode || projected.uid !== observed.uid ||
      projected.gid !== observed.gid || projected.nlink !== observed.nlink ||
      projected.size !== observed.size || projected.mtimeMs !== observed.mtimeMs ||
      projected.ctimeMs !== observed.ctimeMs
    ) {
      throw new ProviderRuntimeStorageErrorV1(
        "storage_security_violation",
        "abandoned strong mutation temporary outcome changed during cleanup",
      );
    }
    await unlink(path);
    await syncDirectoryV1(parent);
  }

  async #readStrongMutationNonceReceiptV1(
    operationNonce: string,
  ): Promise<DurableStrongMutationNonceReceiptDiskV1 | undefined> {
    const path = this.#strongMutationNonceReceiptPathV1(operationNonce);
    let serialized: string;
    try {
      await assertPrivateRegularFileV1(path);
      serialized = await readFile(path, "utf8");
    } catch (error) {
      if (isErrnoV1(error, "ENOENT")) return undefined;
      throw error;
    }
    if (Buffer.byteLength(serialized, "utf8") > this.#maxJournalBytes) {
      throw new ProviderRuntimeStorageErrorV1(
        "journal_corrupt",
        "durable strong mutation nonce receipt exceeds its byte limit",
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized) as unknown;
    } catch {
      throw new ProviderRuntimeStorageErrorV1(
        "journal_corrupt",
        "durable strong mutation nonce receipt is not JSON",
      );
    }
    const disk = asRecordV1(parsed, "strong mutation nonce receipt");
    if (
      !exactObjectKeysV1(disk, [
        "profile",
        "providerId",
        "operationNonce",
        "operation",
        "requestDigest",
        "request",
        "response",
        "receiptDigest",
      ]) ||
      disk.profile !== STRONG_MUTATION_NONCE_RECEIPT_PROFILE_V1 ||
      disk.providerId !== this.providerId ||
      disk.operationNonce !== operationNonce ||
      (disk.operation !== "write_object" &&
        disk.operation !== "compare_commit") ||
      typeof disk.requestDigest !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(disk.requestDigest) ||
      typeof disk.receiptDigest !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(disk.receiptDigest)
    ) {
      throw new ProviderRuntimeStorageErrorV1(
        "journal_corrupt",
        "durable strong mutation nonce receipt fields are invalid",
      );
    }
    const request = ProviderRuntimeIpcStrongMutationRequestV1Schema.parse(
      disk.request,
    );
    const response = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
      disk.response,
    );
    this.#assertStrongMutationResponseContextV1(request, response);
    if (
      request.operationNonce !== operationNonce ||
      request.operation !== disk.operation ||
      request.requestDigest !== disk.requestDigest ||
      !response.ok
    ) {
      throw new ProviderRuntimeStorageErrorV1(
        "journal_corrupt",
        "durable strong mutation nonce receipt authority is invalid",
      );
    }
    if (request.operation === "write_object") {
      ProviderRuntimeIpcWriteObjectResultV1Schema.parse(response.payload);
    } else {
      ProviderRuntimeIpcCompareCommitResultV1Schema.parse(response.payload);
    }
    const withoutDigest = {
      profile: STRONG_MUTATION_NONCE_RECEIPT_PROFILE_V1,
      providerId: this.providerId,
      operationNonce,
      operation: disk.operation,
      requestDigest: disk.requestDigest,
      request,
      response,
    } satisfies Omit<
      DurableStrongMutationNonceReceiptDiskV1,
      "receiptDigest"
    >;
    if (
      disk.receiptDigest !== strongMutationNonceReceiptDigestV1(withoutDigest)
    ) {
      throw new ProviderRuntimeStorageErrorV1(
        "journal_corrupt",
        "durable strong mutation nonce receipt digest is invalid",
      );
    }
    return Object.freeze({ ...withoutDigest, receiptDigest: disk.receiptDigest });
  }

  async #readStrongMutationNonceReceiptEraV1(): Promise<
    DurableStrongMutationNonceReceiptEraDiskV1 | undefined
  > {
    const path = this.#strongMutationNonceReceiptEraPathV1();
    let serialized: string;
    try {
      await assertPrivateRegularFileV1(path);
      serialized = await readFile(path, "utf8");
    } catch (error) {
      if (isErrnoV1(error, "ENOENT")) return undefined;
      throw error;
    }
    if (Buffer.byteLength(serialized, "utf8") > this.#maxJournalBytes) {
      throw new ProviderRuntimeStorageErrorV1(
        "journal_corrupt",
        "strong mutation nonce-receipt era marker exceeds its byte limit",
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized) as unknown;
    } catch {
      throw new ProviderRuntimeStorageErrorV1(
        "journal_corrupt",
        "strong mutation nonce-receipt era marker is not JSON",
      );
    }
    const disk = asRecordV1(parsed, "strong mutation nonce-receipt era marker");
    if (
      !exactObjectKeysV1(disk, [
        "profile",
        "providerId",
        "outcomeProfile",
        "nonceReceiptProfile",
        "markerDigest",
      ]) ||
      disk.profile !== STRONG_MUTATION_NONCE_RECEIPT_ERA_PROFILE_V1 ||
      disk.providerId !== this.providerId ||
      disk.outcomeProfile !== STRONG_MUTATION_OUTCOME_PROFILE_V1 ||
      disk.nonceReceiptProfile !== STRONG_MUTATION_NONCE_RECEIPT_PROFILE_V1 ||
      typeof disk.markerDigest !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(disk.markerDigest)
    ) {
      throw new ProviderRuntimeStorageErrorV1(
        "journal_corrupt",
        "strong mutation nonce-receipt era marker fields are invalid",
      );
    }
    const withoutDigest = {
      profile: STRONG_MUTATION_NONCE_RECEIPT_ERA_PROFILE_V1,
      providerId: this.providerId,
      outcomeProfile: STRONG_MUTATION_OUTCOME_PROFILE_V1,
      nonceReceiptProfile: STRONG_MUTATION_NONCE_RECEIPT_PROFILE_V1,
    } satisfies Omit<
      DurableStrongMutationNonceReceiptEraDiskV1,
      "markerDigest"
    >;
    if (
      disk.markerDigest !== strongMutationNonceReceiptEraDigestV1(withoutDigest)
    ) {
      throw new ProviderRuntimeStorageErrorV1(
        "journal_corrupt",
        "strong mutation nonce-receipt era marker digest is invalid",
      );
    }
    return Object.freeze({ ...withoutDigest, markerDigest: disk.markerDigest });
  }

  async #scanStrongMutationStateV1(): Promise<ScannedStrongMutationStateV1> {
    const authority = this.#strongMutationExactObjectAuthority;
    const parent = authority !== undefined && process.platform === "linux"
      ? `/proc/self/fd/${authority.outcomes.handle.fd}`
      : this.strongMutationOutcomesPath;
    for (const name of (await readdir(parent)).sort()) {
      if (STRONG_MUTATION_ABANDONED_TEMP_NAME_V1.test(name)) {
        await this.#removeExactAbandonedStrongMutationTempV1(parent, name);
      }
    }
    const outcomes: DurableStrongMutationOutcomeDiskV1[] = [];
    const nonceReceipts: DurableStrongMutationNonceReceiptDiskV1[] = [];
    let receiptEra: DurableStrongMutationNonceReceiptEraDiskV1 | undefined;
    for (const name of (await readdir(parent)).sort()) {
      if (name === STRONG_MUTATION_NONCE_RECEIPT_ERA_NAME_V1) {
        receiptEra = await this.#readStrongMutationNonceReceiptEraV1();
        if (receiptEra === undefined) {
          throw new ProviderRuntimeStorageErrorV1(
            "journal_corrupt",
            "strong mutation nonce-receipt era marker disappeared during recovery scan",
          );
        }
        continue;
      }
      const nonceReceiptName = STRONG_MUTATION_NONCE_RECEIPT_NAME_V1.exec(name);
      if (nonceReceiptName !== null) {
        const receipt = await this.#readStrongMutationNonceReceiptV1(
          nonceReceiptName[1]!,
        );
        if (receipt === undefined) {
          throw new ProviderRuntimeStorageErrorV1(
            "journal_corrupt",
            "strong mutation nonce receipt disappeared during recovery scan",
          );
        }
        nonceReceipts.push(receipt);
        continue;
      }
      if (!/^[0-9a-f]{64}\.json$/u.test(name)) {
        throw new ProviderRuntimeStorageErrorV1(
          "journal_corrupt",
          "strong mutation outcome directory contains an unknown entry",
        );
      }
      const candidatePath = join(parent, name);
      await assertPrivateRegularFileV1(candidatePath);
      const serialized = await readFile(candidatePath, "utf8");
      if (Buffer.byteLength(serialized, "utf8") > this.#maxJournalBytes) {
        throw new ProviderRuntimeStorageErrorV1(
          "journal_corrupt",
          "durable strong mutation outcome exceeds its byte limit",
        );
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(serialized) as unknown;
      } catch {
        throw new ProviderRuntimeStorageErrorV1(
          "journal_corrupt",
          "durable strong mutation outcome is not JSON",
        );
      }
      const candidate = asRecordV1(parsed, "strong mutation outcome");
      const request = ProviderRuntimeIpcStrongMutationRequestV1Schema.parse(
        candidate.request,
      );
      if (
        request.bindingDigest.slice(CONTENT_DIGEST_PREFIX.length) !==
          name.slice(0, -".json".length)
      ) {
        throw new ProviderRuntimeStorageErrorV1(
          "journal_corrupt",
          "strong mutation outcome filename is not bound to its request",
        );
      }
      const outcome = await this.#readStrongMutationOutcomeV1(request);
      if (outcome === undefined) {
        throw new ProviderRuntimeStorageErrorV1(
          "journal_corrupt",
          "strong mutation outcome disappeared during recovery scan",
        );
      }
      outcomes.push(outcome);
    }

    const receiptsByNonce = new Map<
      string,
      DurableStrongMutationNonceReceiptDiskV1
    >();
    for (const receipt of nonceReceipts) {
      if (receiptsByNonce.has(receipt.operationNonce)) {
        throw new ProviderRuntimeStorageErrorV1(
          "journal_corrupt",
          "durable strong mutation nonce receipt is duplicated",
        );
      }
      receiptsByNonce.set(receipt.operationNonce, receipt);
    }
    const outcomesByNonce = new Map<
      string,
      DurableStrongMutationOutcomeDiskV1[]
    >();
    for (const outcome of outcomes) {
      const operationNonce = outcome.request.operationNonce;
      if (!outcome.response.ok) {
        throw new ProviderRuntimeStorageErrorV1(
          "journal_corrupt",
          "durable strong mutation outcome is not successful",
        );
      }
      const group = outcomesByNonce.get(operationNonce) ?? [];
      const first = group[0];
      if (
        first !== undefined &&
        (first.request.operation !== outcome.request.operation ||
          first.request.requestDigest !== outcome.request.requestDigest)
      ) {
        throw new ProviderRuntimeStorageErrorV1(
          "journal_corrupt",
          "durable strong mutation operation nonce binds different requests",
        );
      }
      group.push(outcome);
      outcomesByNonce.set(operationNonce, group);
      const receipt = receiptsByNonce.get(operationNonce);
      if (receipt === undefined) {
        if (receiptEra !== undefined) {
          throw new ProviderRuntimeStorageErrorV1(
            "journal_corrupt",
            "receipt-era strong mutation outcome is missing its nonce receipt",
          );
        }
        continue;
      }
      if (
        receipt.operation !== outcome.request.operation ||
        receipt.requestDigest !== outcome.request.requestDigest
      ) {
        throw new ProviderRuntimeStorageErrorV1(
          "journal_corrupt",
          "durable strong mutation outcome conflicts with its nonce authority",
        );
      }
    }

    for (const receipt of nonceReceipts) {
      const group = outcomesByNonce.get(receipt.operationNonce);
      if (group === undefined) {
        if (receiptEra === undefined) {
          throw new ProviderRuntimeStorageErrorV1(
            "journal_corrupt",
            "partial legacy nonce receipt has no retained outcome",
          );
        }
        continue;
      }
      if (!group.some((outcome) =>
        outcome.bindingDigest === receipt.request.bindingDigest &&
        exactCanonicalV1(outcome.request, receipt.request) &&
        exactCanonicalV1(outcome.response, receipt.response)
      )) {
        throw new ProviderRuntimeStorageErrorV1(
          "journal_corrupt",
          "durable nonce authority has no exact retained first outcome",
        );
      }
    }
    return Object.freeze({
      outcomes: Object.freeze(outcomes),
      nonceReceipts: Object.freeze(nonceReceipts),
      nonceReceiptEraEstablished: receiptEra !== undefined,
    });
  }

  #assertStrongMutationOperationNonceAvailableV1(
    receipts: readonly DurableStrongMutationNonceReceiptDiskV1[],
    request: ProviderRuntimeIpcStrongMutationRequestV1,
  ): void {
    const prior = receipts.find(
      (receipt) => receipt.operationNonce === request.operationNonce,
    );
    if (
      prior !== undefined &&
      (prior.operation !== request.operation ||
        prior.requestDigest !== request.requestDigest)
    ) {
      throw new ProviderRuntimeStorageErrorV1(
        "operation_nonce_conflict",
        "strong mutation operation nonce was already bound to another request",
      );
    }
  }

  #findStrongMutationOutcomeV1(
    outcomes: readonly DurableStrongMutationOutcomeDiskV1[],
    request: ProviderRuntimeIpcStrongMutationRequestV1,
  ): DurableStrongMutationOutcomeDiskV1 | undefined {
    const outcome = outcomes.find(
      (candidate) => candidate.bindingDigest === request.bindingDigest,
    );
    if (outcome !== undefined && !exactCanonicalV1(outcome.request, request)) {
      throw new ProviderRuntimeStorageErrorV1(
        "operation_nonce_conflict",
        "strong mutation binding was already used for another request",
      );
    }
    return outcome;
  }

  #findStrongMutationNonceReceiptV1(
    receipts: readonly DurableStrongMutationNonceReceiptDiskV1[],
    request: ProviderRuntimeIpcStrongMutationRequestV1,
  ): DurableStrongMutationNonceReceiptDiskV1 | undefined {
    return receipts.find((receipt) =>
      receipt.operationNonce === request.operationNonce &&
      receipt.operation === request.operation &&
      receipt.requestDigest === request.requestDigest
    );
  }

  #strongMutationNonceReceiptV1(
    request: ProviderRuntimeIpcStrongMutationRequestV1,
    responseInput: ProviderRuntimeIpcStrongMutationResponseV1,
  ): DurableStrongMutationNonceReceiptDiskV1 {
    const response = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
      responseInput,
    );
    this.#assertStrongMutationResponseContextV1(request, response);
    if (!response.ok) {
      throw new ProviderRuntimeStorageErrorV1(
        "storage_security_violation",
        "strong mutation nonce receipt requires a successful authority",
      );
    }
    const withoutDigest = {
      profile: STRONG_MUTATION_NONCE_RECEIPT_PROFILE_V1,
      providerId: this.providerId,
      operationNonce: request.operationNonce,
      operation: request.operation,
      requestDigest: request.requestDigest,
      request,
      response,
    } satisfies Omit<
      DurableStrongMutationNonceReceiptDiskV1,
      "receiptDigest"
    >;
    return Object.freeze({
      ...withoutDigest,
      receiptDigest: strongMutationNonceReceiptDigestV1(withoutDigest),
    });
  }

  async #persistStrongMutationNonceReceiptV1(
    receipt: DurableStrongMutationNonceReceiptDiskV1,
  ): Promise<void> {
    const serialized = `${canonicalizeJcsSafeIntegerV1(receipt)}\n`;
    if (Buffer.byteLength(serialized, "utf8") > this.#maxJournalBytes) {
      throw new ProviderRuntimeStorageErrorV1(
        "storage_failure",
        "durable strong mutation nonce receipt exceeds its byte limit",
      );
    }
    await atomicReplacePrivateFileV1(
      this.#strongMutationNonceReceiptPathV1(receipt.operationNonce),
      serialized,
    );
  }

  async #persistStrongMutationNonceReceiptEraV1(): Promise<void> {
    const withoutDigest = {
      profile: STRONG_MUTATION_NONCE_RECEIPT_ERA_PROFILE_V1,
      providerId: this.providerId,
      outcomeProfile: STRONG_MUTATION_OUTCOME_PROFILE_V1,
      nonceReceiptProfile: STRONG_MUTATION_NONCE_RECEIPT_PROFILE_V1,
    } satisfies Omit<
      DurableStrongMutationNonceReceiptEraDiskV1,
      "markerDigest"
    >;
    const marker: DurableStrongMutationNonceReceiptEraDiskV1 = Object.freeze({
      ...withoutDigest,
      markerDigest: strongMutationNonceReceiptEraDigestV1(withoutDigest),
    });
    const serialized = `${canonicalizeJcsSafeIntegerV1(marker)}\n`;
    if (Buffer.byteLength(serialized, "utf8") > this.#maxJournalBytes) {
      throw new ProviderRuntimeStorageErrorV1(
        "storage_failure",
        "strong mutation nonce-receipt era marker exceeds its byte limit",
      );
    }
    await atomicReplacePrivateFileV1(
      this.#strongMutationNonceReceiptEraPathV1(),
      serialized,
    );
  }

  #createPreparedStrongMutationResponseV1(
    request: ProviderRuntimeIpcStrongMutationRequestV1,
    payloadInput: unknown,
    createResponse: CreateProviderRuntimeStrongMutationResponseV1,
  ): ProviderRuntimeIpcStrongMutationResponseV1 {
    const payload = request.operation === "write_object"
      ? ProviderRuntimeIpcWriteObjectResultV1Schema.parse(payloadInput)
      : ProviderRuntimeIpcCompareCommitResultV1Schema.parse(payloadInput);
    const response = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
      createResponse(payload),
    );
    this.#assertStrongMutationResponseContextV1(request, response);
    if (!response.ok || !exactCanonicalV1(response.payload, payload)) {
      throw new ProviderRuntimeStorageErrorV1(
        "storage_security_violation",
        "strong mutation signer changed the prepared result",
      );
    }
    return response;
  }

  #assertStrongMutationResponseContextV1(
    request: ProviderRuntimeIpcStrongMutationRequestV1,
    response: ProviderRuntimeIpcStrongMutationResponseV1,
  ): void {
    if (
      response.requestId !== request.requestId ||
      response.principalAttestationDigest !==
        request.principalAttestationDigest ||
      response.bindingDigest !== request.bindingDigest ||
      response.operation !== request.operation ||
      response.operationNonce !== request.operationNonce ||
      response.requestDigest !== request.requestDigest
    ) {
      throw new ProviderRuntimeStorageErrorV1(
        "storage_security_violation",
        "strong mutation response does not bind its request",
      );
    }
  }

  #strongMutationOutcomeV1(
    request: ProviderRuntimeIpcStrongMutationRequestV1,
    response: ProviderRuntimeIpcStrongMutationResponseV1,
    phase: DurableStrongMutationOutcomeDiskV1["phase"],
  ): DurableStrongMutationOutcomeDiskV1 {
    const withoutDigest = {
      profile: STRONG_MUTATION_OUTCOME_PROFILE_V1,
      providerId: this.providerId,
      bindingDigest: request.bindingDigest,
      request: canonicalCloneV1(request),
      response: canonicalCloneV1(response),
      phase,
    } satisfies Omit<DurableStrongMutationOutcomeDiskV1, "outcomeDigest">;
    return Object.freeze({
      ...withoutDigest,
      outcomeDigest: strongMutationOutcomeDigestV1(withoutDigest),
    });
  }

  async #readStrongMutationOutcomeV1(
    request: ProviderRuntimeIpcStrongMutationRequestV1,
  ): Promise<DurableStrongMutationOutcomeDiskV1 | undefined> {
    const path = this.#strongMutationOutcomePathV1(request.bindingDigest);
    let serialized: string;
    try {
      await assertPrivateRegularFileV1(path);
      serialized = await readFile(path, "utf8");
    } catch (error) {
      if (isErrnoV1(error, "ENOENT")) return undefined;
      throw error;
    }
    if (Buffer.byteLength(serialized, "utf8") > this.#maxJournalBytes) {
      throw new ProviderRuntimeStorageErrorV1(
        "journal_corrupt",
        "durable strong mutation outcome exceeds its byte limit",
      );
    }
    let unknownDisk: unknown;
    try {
      unknownDisk = JSON.parse(serialized) as unknown;
    } catch {
      throw new ProviderRuntimeStorageErrorV1(
        "journal_corrupt",
        "durable strong mutation outcome is not JSON",
      );
    }
    const disk = asRecordV1(unknownDisk, "strong mutation outcome");
    if (
      !exactObjectKeysV1(disk, [
        "profile",
        "providerId",
        "bindingDigest",
        "request",
        "response",
        "phase",
        "outcomeDigest",
      ]) ||
      disk.profile !== STRONG_MUTATION_OUTCOME_PROFILE_V1 ||
      disk.providerId !== this.providerId ||
      disk.bindingDigest !== request.bindingDigest ||
      (disk.phase !== "prepared" && disk.phase !== "completed") ||
      typeof disk.outcomeDigest !== "string"
    ) {
      throw new ProviderRuntimeStorageErrorV1(
        "journal_corrupt",
        "durable strong mutation outcome fields are invalid",
      );
    }
    const storedRequest = ProviderRuntimeIpcStrongMutationRequestV1Schema.parse(
      disk.request,
    );
    const response = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
      disk.response,
    );
    this.#assertStrongMutationResponseContextV1(storedRequest, response);
    if (!exactCanonicalV1(storedRequest, request)) {
      throw new ProviderRuntimeStorageErrorV1(
        "operation_nonce_conflict",
        "strong mutation binding was already used for another request",
      );
    }
    const withoutDigest = {
      profile: STRONG_MUTATION_OUTCOME_PROFILE_V1,
      providerId: this.providerId,
      bindingDigest: request.bindingDigest,
      request: storedRequest,
      response,
      phase: disk.phase,
    } satisfies Omit<DurableStrongMutationOutcomeDiskV1, "outcomeDigest">;
    if (disk.outcomeDigest !== strongMutationOutcomeDigestV1(withoutDigest)) {
      throw new ProviderRuntimeStorageErrorV1(
        "journal_corrupt",
        "durable strong mutation outcome digest is invalid",
      );
    }
    return Object.freeze({ ...withoutDigest, outcomeDigest: disk.outcomeDigest });
  }

  async #persistStrongMutationOutcomeV1(
    outcome: DurableStrongMutationOutcomeDiskV1,
  ): Promise<void> {
    if (
      outcome.phase === "completed" &&
      this.#testCompletedOutcomePersistFailureArmed
    ) {
      this.#testCompletedOutcomePersistFailureArmed = false;
      throw new ProviderRuntimeStorageErrorV1(
        "storage_failure",
        "injected completed strong mutation outcome persistence failure",
      );
    }
    const serialized = `${canonicalizeJcsSafeIntegerV1(outcome)}\n`;
    if (Buffer.byteLength(serialized, "utf8") > this.#maxJournalBytes) {
      throw new ProviderRuntimeStorageErrorV1(
        "storage_failure",
        "durable strong mutation outcome exceeds its byte limit",
      );
    }
    await atomicReplacePrivateFileV1(
      this.#strongMutationOutcomePathV1(outcome.bindingDigest),
      serialized,
    );
  }

  #parseAndVerifyJournal(serialized: string): DurableOperationJournalDiskV1 {
    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized) as unknown;
    } catch {
      throw new ProviderRuntimeStorageErrorV1(
        "journal_corrupt",
        "durable operation journal is not valid JSON",
      );
    }
    const disk = asRecordV1(parsed, "journal");
    if (!exactObjectKeysV1(disk, ["profile", "providerId", "state", "records"])) {
      throw new ProviderRuntimeStorageErrorV1(
        "journal_corrupt",
        "durable operation journal has unexpected fields",
      );
    }
    if (
      disk.profile !== JOURNAL_DISK_PROFILE_V1 ||
      disk.providerId !== this.providerId ||
      !Array.isArray(disk.records)
    ) {
      throw new ProviderRuntimeStorageErrorV1(
        "journal_corrupt",
        "durable operation journal profile or records are invalid",
      );
    }
    const stateResult = ProviderRuntimeIpcJournalStateV1Schema.safeParse(disk.state);
    if (!stateResult.success) {
      throw new ProviderRuntimeStorageErrorV1(
        "journal_corrupt",
        "durable operation journal state is invalid",
      );
    }
    const records: DurableOperationJournalRecordDiskV1[] = [];
    const nonces = new Set<string>();
    let terminalLifecycleBase: string | undefined;
    for (const [index, candidate] of disk.records.entries()) {
      const record = asRecordV1(candidate, `journal record ${index + 1}`);
      if (
        !exactObjectKeysV1(record, [
          "ordinal",
          "expectedRevision",
          "revision",
          "operationNonce",
          "mutationDigest",
          "phase",
          "artifacts",
          "previousReceiptDigest",
          "receiptDigest",
        ])
      ) {
        throw new ProviderRuntimeStorageErrorV1(
          "journal_corrupt",
          "durable operation journal record has unexpected fields",
        );
      }
      const previousReceiptDigest = record.previousReceiptDigest;
      const receiptDigest = record.receiptDigest;
      assertSafeBoundV1(record.ordinal as number, "journal record ordinal");
      assertSafeBoundV1(
        record.expectedRevision as number,
        "journal record expectedRevision",
      );
      assertSafeBoundV1(record.revision as number, "journal record revision");
      if (
        record.ordinal !== index + 1 ||
        record.expectedRevision !== index ||
        record.revision !== index + 1 ||
        typeof record.operationNonce !== "string" ||
        !OPERATION_NONCE_PATTERN.test(record.operationNonce) ||
        typeof record.mutationDigest !== "string" ||
        !/^sha256:[0-9a-f]{64}$/u.test(record.mutationDigest) ||
        !isValidPhaseV1(record.phase) ||
        (previousReceiptDigest !== "none" &&
          (typeof previousReceiptDigest !== "string" ||
            !/^sha256:[0-9a-f]{64}$/u.test(previousReceiptDigest))) ||
        typeof receiptDigest !== "string" ||
        !/^sha256:[0-9a-f]{64}$/u.test(receiptDigest)
      ) {
        throw new ProviderRuntimeStorageErrorV1(
          "journal_corrupt",
          "durable operation journal record sequencing or syntax is invalid",
        );
      }
      if (nonces.has(record.operationNonce)) {
        throw new ProviderRuntimeStorageErrorV1(
          "journal_corrupt",
          "durable operation journal repeats an operation nonce",
        );
      }
      nonces.add(record.operationNonce);
      const artifacts = canonicalCloneV1(
        asRecordV1(record.artifacts, "journal record artifacts") as JsonObjectV1,
      );
      if (
        terminalLifecycleBase !== undefined &&
        record.phase !== "final_strong_ready"
      ) {
        throw new ProviderRuntimeStorageErrorV1(
          "journal_corrupt",
          "durable journal history leaves final_strong_ready",
        );
      }
      const candidateLifecycleBase = durableLifecycleBaseCanonicalV1(
        record.phase as string,
        artifacts,
        "journal_corrupt",
      );
      if (
        terminalLifecycleBase !== undefined &&
        candidateLifecycleBase !== terminalLifecycleBase
      ) {
        throw new ProviderRuntimeStorageErrorV1(
          "journal_corrupt",
          "durable final_strong_ready lifecycle history was rewritten",
        );
      }
      terminalLifecycleBase ??= candidateLifecycleBase;
      const normalizedInput: CompareCommitInputV1 = {
        expectedRevision: record.expectedRevision,
        operationNonce: record.operationNonce,
        phase: record.phase,
        artifacts,
      };
      const expectedPrevious = records.at(-1)?.receiptDigest ?? "none";
      const normalizedWithoutReceipt = {
        ordinal: record.ordinal,
        expectedRevision: record.expectedRevision,
        revision: record.revision,
        operationNonce: record.operationNonce,
        mutationDigest: record.mutationDigest,
        phase: record.phase,
        artifacts,
        previousReceiptDigest,
      } satisfies Omit<DurableOperationJournalRecordDiskV1, "receiptDigest">;
      const expectedReceipt = sha256DigestV1(
        canonicalizeJcsSafeIntegerV1(receiptClaimsV1(normalizedWithoutReceipt)),
      );
      if (
        record.mutationDigest !== mutationDigestV1(normalizedInput) ||
        previousReceiptDigest !== expectedPrevious ||
        receiptDigest !== expectedReceipt
      ) {
        throw new ProviderRuntimeStorageErrorV1(
          "journal_corrupt",
          "durable operation journal digest chain is invalid",
        );
      }
      records.push({
        ...normalizedWithoutReceipt,
        receiptDigest,
      });
    }
    const state = stateResult.data;
    const last = records.at(-1);
    if (last === undefined) {
      if (
        state.revision !== 0 ||
        state.phase !== "uninitialized" ||
        state.operationNonce !== "none" ||
        state.mutationDigest !== "none" ||
        Object.keys(state.artifacts).length !== 0
      ) {
        throw new ProviderRuntimeStorageErrorV1(
          "journal_corrupt",
          "empty durable operation journal has a non-initial state",
        );
      }
    } else if (
      state.revision !== last.revision ||
      state.phase !== last.phase ||
      state.operationNonce !== last.operationNonce ||
      state.mutationDigest !== last.mutationDigest ||
      canonicalizeJcsSafeIntegerV1(state.artifacts) !==
        canonicalizeJcsSafeIntegerV1(last.artifacts)
    ) {
      throw new ProviderRuntimeStorageErrorV1(
        "journal_corrupt",
        "durable operation journal head does not match its latest record",
      );
    }
    return {
      profile: JOURNAL_DISK_PROFILE_V1,
      providerId: this.providerId,
      state: canonicalCloneV1(state),
      records,
    };
  }

  async #persistJournal(disk: DurableOperationJournalDiskV1): Promise<void> {
    const serialized = `${canonicalizeJcsSafeIntegerV1(disk)}\n`;
    if (Buffer.byteLength(serialized, "utf8") > this.#maxJournalBytes) {
      throw new ProviderRuntimeStorageErrorV1(
        "storage_failure",
        "durable operation journal exceeds its configured byte limit",
      );
    }
    const authority = this.#strongMutationExactObjectAuthority;
    const path = authority !== undefined && process.platform === "linux"
      ? join(`/proc/self/fd/${authority.journal.handle.fd}`, "state.json")
      : this.journalStatePath;
    await atomicReplacePrivateFileV1(path, serialized);
  }

  async #assertRetainedStrongMutationExactObjectAuthorityV1(): Promise<void> {
    const authority = this.#strongMutationExactObjectAuthority;
    if (authority === undefined) {
      throw new ProviderRuntimeStorageErrorV1(
        "storage_security_violation",
        "strong mutation exact-object authority is unavailable",
      );
    }
    for (const retained of [
      authority.providerObjects,
      authority.journal,
      authority.outcomes,
    ]) {
      const current = await retained.handle.stat({ bigint: true });
      if (
        !current.isDirectory() ||
        current.dev !== retained.dev ||
        current.ino !== retained.ino ||
        (current.mode & 0o777n) !== 0o700n ||
        (typeof process.getuid === "function" &&
          current.uid !== BigInt(process.getuid()))
      ) {
        throw new ProviderRuntimeStorageErrorV1(
          "storage_security_violation",
          "retained strong mutation directory authority changed",
        );
      }
    }
    if (authority.nativePublisher !== undefined) {
      try {
        revalidateProviderRuntimeNativeExactObjectPublisherV1(
          authority.nativePublisher,
        );
      } catch {
        throw new ProviderRuntimeStorageErrorV1(
          "storage_security_violation",
          "retained native exact-object authority changed",
        );
      }
    }
  }

  #assertInitialized(): void {
    if (!this.#initialized) {
      throw new ProviderRuntimeStorageErrorV1(
        "storage_failure",
        "durable provider runtime store is not initialized",
      );
    }
  }

  async #exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const prior = this.#mutationTail;
    let release!: () => void;
    this.#mutationTail = new Promise<void>((resolvePromise) => {
      release = resolvePromise;
    });
    await prior;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  async #strongMutationExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const prior = this.#strongMutationTail;
    let release!: () => void;
    this.#strongMutationTail = new Promise<void>((resolvePromise) => {
      release = resolvePromise;
    });
    await prior;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}
