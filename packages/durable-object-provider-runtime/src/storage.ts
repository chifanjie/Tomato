import { createHash, randomBytes } from "node:crypto";
import {
  chmod,
  link,
  lstat,
  mkdir,
  open,
  readFile,
  rename,
  unlink,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import {
  PROVIDER_RUNTIME_IPC_STORAGE_DIRECTORY_MODE_V1,
  PROVIDER_RUNTIME_IPC_STORAGE_FILE_MODE_V1,
  ProviderRuntimeIpcFixedObjectLocatorV1Schema,
  ProviderRuntimeIpcJournalStateV1Schema,
  type ProviderRuntimeIpcFixedObjectLocatorV1,
  type ProviderRuntimeIpcJournalStateV1,
  type ProviderRuntimeIpcJsonValueV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";
import { DurableObjectIdentityProviderIdV1Schema } from "@understand-code/durable-object-provider-contracts/primitives";

const JOURNAL_DISK_PROFILE_V1 =
  "provider_runtime_durable_operation_journal_v1" as const;
const JOURNAL_STATE_PROFILE_V1 =
  "provider_runtime_durable_journal_state_v1" as const;
const CONTENT_DIGEST_PREFIX = "sha256:";
const OPERATION_NONCE_PATTERN = /^[0-9a-f]{32}$/u;
const DEFAULT_MAX_OBJECT_BYTES = 6 * 1024 * 1024;
const DEFAULT_MAX_JOURNAL_BYTES = 8 * 1024 * 1024;

type JsonObjectV1 = Readonly<Record<string, ProviderRuntimeIpcJsonValueV1>>;

export type ProviderRuntimeStorageErrorCodeV1 =
  | "invalid_input"
  | "journal_corrupt"
  | "object_digest_mismatch"
  | "object_length_mismatch"
  | "object_not_found"
  | "operation_nonce_conflict"
  | "provider_mismatch"
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

  readonly #maxObjectBytes: number;
  readonly #maxJournalBytes: number;
  #state: ProviderRuntimeIpcJournalStateV1 = createInitialStateV1();
  #records: readonly DurableOperationJournalRecordDiskV1[] = [];
  #initialized = false;
  #mutationTail: Promise<void> = Promise.resolve();

  constructor(options: DurableObjectProviderRuntimeStoreOptionsV1) {
    this.rootPath = resolve(options.rootPath);
    this.providerId = DurableObjectIdentityProviderIdV1Schema.parse(
      options.providerId,
    );
    this.objectsPath = join(this.rootPath, "objects");
    this.journalPath = join(this.rootPath, "journal");
    this.journalStatePath = join(this.journalPath, "state.json");
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

  inspectState(): ProviderRuntimeIpcJournalStateV1 {
    this.#assertInitialized();
    return canonicalCloneV1(this.#state);
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
          state: canonicalCloneV1(this.#state),
        };
      }
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

  async #objectPath(
    locator: ProviderRuntimeIpcFixedObjectLocatorV1,
  ): Promise<string> {
    if (locator.providerId !== this.providerId) {
      throw new ProviderRuntimeStorageErrorV1(
        "provider_mismatch",
        "fixed object locator does not belong to this runtime provider",
      );
    }
    const providerDirectory = join(
      this.objectsPath,
      encodeURIComponent(this.providerId),
    );
    await ensurePrivateDirectoryV1(providerDirectory);
    return join(
      providerDirectory,
      `${locator.contentDigest.slice(CONTENT_DIGEST_PREFIX.length)}.blob`,
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
    await atomicReplacePrivateFileV1(this.journalStatePath, serialized);
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
}
