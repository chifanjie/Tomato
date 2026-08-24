import { constants } from "node:fs";
import {
  lstat,
  link,
  mkdir,
  open,
  rename,
  unlink,
  type FileHandle,
} from "node:fs/promises";
import { dirname } from "node:path";

import {
  canonicalizeJcsSafeIntegerUtf8V1,
  parseCanonicalJcsSafeIntegerUtf8V1,
} from "@understand-code/durable-object-provider-contracts/jcs";

import { ProviderAcceptanceAuthorityErrorV1 } from "./errors.js";
import type { ProviderAcceptanceAuthorityLayoutInternalV1 } from "./platform-layout.js";

const FILE_MODE_V1 = 0o600;
const DIRECTORY_MODE_V1 = 0o700;
const NOFOLLOW_V1 = typeof constants.O_NOFOLLOW === "number"
  ? constants.O_NOFOLLOW
  : 0;
// Node opens descriptors close-on-exec; @types/node intentionally omits the
// platform-specific O_CLOEXEC constant from this portable surface.
const CLOEXEC_V1 = 0;

export interface CheckedFileInternalV1 {
  readonly bytes: Buffer;
  readonly dev: number;
  readonly ino: number;
  readonly nlink: number;
}

function isErrnoV1(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error &&
    (error as { readonly code?: unknown }).code === code;
}

export function isMissingFileInternalV1(error: unknown): boolean {
  return isErrnoV1(error, "ENOENT");
}

function exactModeV1(mode: number): number {
  return mode & 0o777;
}

async function syncDirectoryV1(path: string): Promise<void> {
  let handle: FileHandle | undefined;
  try {
    if (
      NOFOLLOW_V1 === 0 || typeof constants.O_DIRECTORY !== "number" ||
      constants.O_DIRECTORY === 0
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
    }
    handle = await open(
      path,
      constants.O_RDONLY | NOFOLLOW_V1 | constants.O_DIRECTORY | CLOEXEC_V1,
    );
    const metadata = await handle.stat();
    if (!metadata.isDirectory()) {
      throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
    }
    await handle.sync();
  } catch (error) {
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1("io_error");
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

export async function syncParentDirectoryInternalV1(path: string): Promise<void> {
  await syncDirectoryV1(dirname(path));
}

async function verifyTrustedParentDirectoryInternalV1(
  path: string,
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
): Promise<void> {
  let handle: FileHandle | undefined;
  try {
    const before = await lstat(path, { bigint: true });
    if (
      before.isSymbolicLink() || !before.isDirectory() ||
      before.uid !== BigInt(layout.authorityUid) ||
      (before.mode & 0o022n) !== 0n
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
    }
    handle = await open(
      path,
      constants.O_RDONLY | NOFOLLOW_V1 |
        (typeof constants.O_DIRECTORY === "number" ? constants.O_DIRECTORY : 0) |
        CLOEXEC_V1,
    );
    const opened = await handle.stat({ bigint: true });
    const after = await lstat(path, { bigint: true });
    if (
      !opened.isDirectory() || opened.dev !== before.dev ||
      opened.ino !== before.ino || after.dev !== opened.dev ||
      after.ino !== opened.ino || after.uid !== opened.uid ||
      after.gid !== opened.gid || after.mode !== opened.mode ||
      (opened.mode & 0o022n) !== 0n
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
    }
  } catch (error) {
    if (isMissingFileInternalV1(error)) throw error;
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

export async function ensureProviderAcceptanceAuthorityDirectoriesInternalV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  create: boolean,
): Promise<Readonly<{
  complete: boolean;
  privateNamespaceAvailable: boolean;
}>> {
  if (
    NOFOLLOW_V1 === 0 || typeof constants.O_DIRECTORY !== "number" ||
    constants.O_DIRECTORY === 0
  ) {
    throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
  }
  for (
    let index = 0;
    index < layout.trustedParentDirectories.length;
    index += 1
  ) {
      const path = layout.trustedParentDirectories[index]!;
      try {
        try {
          await verifyTrustedParentDirectoryInternalV1(path, layout);
        } catch (error) {
          if (
            !isMissingFileInternalV1(error) || !create || index === 0
          ) throw error;
          await mkdir(path, { mode: DIRECTORY_MODE_V1 });
          await verifyTrustedParentDirectoryInternalV1(path, layout);
          await syncParentDirectoryInternalV1(path);
        }
      } catch (error) {
        if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
        throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
      }
  }
  let complete = true;
  for (let index = 0; index < layout.directories.length; index += 1) {
    const path = layout.directories[index]!;
    try {
      if (create) {
        try {
          await mkdir(path, { mode: DIRECTORY_MODE_V1 });
        } catch (error) {
          if (!isErrnoV1(error, "EEXIST")) throw error;
        }
      }
      const metadata = await lstat(path);
      if (
        metadata.isSymbolicLink() ||
        !metadata.isDirectory() ||
        metadata.uid !== layout.authorityUid ||
        metadata.gid !== layout.authorityGid ||
        exactModeV1(metadata.mode) !== DIRECTORY_MODE_V1
      ) {
        throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
      }
    } catch (error) {
      if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
      if (!create && isMissingFileInternalV1(error)) {
        if (index === 0) {
          return Object.freeze({
            complete: false,
            privateNamespaceAvailable: false,
          });
        }
        throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout");
      }
      throw new ProviderAcceptanceAuthorityErrorV1("invalid_layout", {
        cause: error,
      });
    }
  }
  return Object.freeze({
    complete,
    privateNamespaceAvailable: true,
  });
}

export async function readCheckedAuthorityFileInternalV1(input: Readonly<{
  path: string;
  layout: ProviderAcceptanceAuthorityLayoutInternalV1;
  maximumBytes: number;
  allowedLinkCounts?: readonly number[];
}>): Promise<CheckedFileInternalV1> {
  let handle: FileHandle | undefined;
  try {
    const before = await lstat(input.path);
    const allowed = input.allowedLinkCounts ?? [1];
    if (
      before.isSymbolicLink() ||
      !before.isFile() ||
      before.uid !== input.layout.authorityUid ||
      before.gid !== input.layout.authorityGid ||
      exactModeV1(before.mode) !== FILE_MODE_V1 ||
      !allowed.includes(before.nlink) ||
      before.size < 0 ||
      before.size > input.maximumBytes
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1(
        "namespace_integrity_failed",
      );
    }
    handle = await open(
      input.path,
      constants.O_RDONLY | NOFOLLOW_V1 | CLOEXEC_V1,
    );
    const opened = await handle.stat();
    if (
      !opened.isFile() ||
      opened.uid !== input.layout.authorityUid ||
      opened.gid !== input.layout.authorityGid ||
      exactModeV1(opened.mode) !== FILE_MODE_V1 ||
      !allowed.includes(opened.nlink) ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.size !== before.size
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1(
        "namespace_integrity_failed",
      );
    }
    const bytes = await handle.readFile();
    if (bytes.byteLength !== opened.size || bytes.byteLength > input.maximumBytes) {
      throw new ProviderAcceptanceAuthorityErrorV1(
        "namespace_integrity_failed",
      );
    }
    const after = await lstat(input.path);
    if (
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== opened.size ||
      after.nlink !== opened.nlink ||
      after.uid !== opened.uid ||
      after.gid !== opened.gid ||
      exactModeV1(after.mode) !== FILE_MODE_V1
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1(
        "namespace_integrity_failed",
      );
    }
    return Object.freeze({
      bytes,
      dev: opened.dev,
      ino: opened.ino,
      nlink: opened.nlink,
    });
  } catch (error) {
    if (isMissingFileInternalV1(error)) throw error;
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1(
      "namespace_integrity_failed",
      { cause: error },
    );
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

export function canonicalAuthorityBytesInternalV1(value: unknown): Buffer {
  return Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(value));
}

export function parseCanonicalAuthorityBytesInternalV1(bytes: Uint8Array): unknown {
  return parseCanonicalJcsSafeIntegerUtf8V1(bytes);
}

export async function createDurableAuthorityFileInternalV1(input: Readonly<{
  path: string;
  bytes: Uint8Array;
  layout: ProviderAcceptanceAuthorityLayoutInternalV1;
}>): Promise<void> {
  let handle: FileHandle | undefined;
  let created = false;
  try {
    handle = await open(
      input.path,
      constants.O_CREAT |
        constants.O_EXCL |
        constants.O_WRONLY |
        NOFOLLOW_V1 |
        CLOEXEC_V1,
      FILE_MODE_V1,
    );
    created = true;
    await handle.chmod(FILE_MODE_V1);
    await handle.writeFile(input.bytes);
    await handle.sync();
    const metadata = await handle.stat();
    if (
      !metadata.isFile() ||
      metadata.uid !== input.layout.authorityUid ||
      metadata.gid !== input.layout.authorityGid ||
      exactModeV1(metadata.mode) !== FILE_MODE_V1 ||
      metadata.nlink !== 1 ||
      metadata.size !== input.bytes.byteLength
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1("io_error");
    }
    await handle.close();
    handle = undefined;
    await syncParentDirectoryInternalV1(input.path);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (created) await unlink(input.path).catch(() => undefined);
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1("io_error", { cause: error });
  }
}

export type ProviderAcceptanceAuthorityDurablePhaseInternalV1 =
  | "lock_preparation_file_fsynced"
  | "lock_stage_linked_before_preparation_unlink"
  | "lock_canonical_linked_before_stage_unlink"
  | "lock_canonical_nlink2_observed_before_stage_observe"
  | "recovery_preparation_file_fsynced"
  | "recovery_claim_linked_before_preparation_unlink"
  | "recovery_quarantine_linked_before_canonical_unlink"
  | "recovery_canonical_unlinked_before_quarantine_unlink"
  | "recovery_quarantine_unlinked_before_claim_retire"
  | "snapshot_stage_preparation_opened_before_complete_write"
  | "snapshot_stage_file_fsynced"
  | "snapshot_canonical_renamed_before_directory_fsync"
  | "snapshot_directory_fsynced_before_publication"
  | "publication_stage_preparation_opened_before_complete_write"
  | "publication_stage_file_fsynced"
  | "publication_canonical_renamed_before_directory_fsync"
  | "publication_directory_fsynced"
  | "broker_snapshot_stage_preparation_opened_before_complete_write"
  | "broker_snapshot_stage_file_fsynced"
  | "broker_snapshot_canonical_renamed_before_directory_fsync"
  | "broker_snapshot_directory_fsynced_before_publication"
  | "broker_publication_stage_preparation_opened_before_complete_write"
  | "broker_publication_stage_file_fsynced"
  | "broker_publication_canonical_renamed_before_directory_fsync"
  | "broker_publication_directory_fsynced"
  | "broker_snapshot_directory_fsynced_before_response"
  | "snapshot_directory_fsynced_before_response";

export interface ProviderAcceptanceAuthorityDurabilityHooksInternalV1 {
  readonly afterDurablePhase?: (
    phase: ProviderAcceptanceAuthorityDurablePhaseInternalV1,
  ) => void | Promise<void>;
}

export async function prepareDurableAuthorityStageInternalV1(input: Readonly<{
  stagePath: string;
  bytes: Uint8Array;
  layout: ProviderAcceptanceAuthorityLayoutInternalV1;
  hooks?: ProviderAcceptanceAuthorityDurabilityHooksInternalV1;
  beforeCompleteWritePhase?:
    ProviderAcceptanceAuthorityDurablePhaseInternalV1;
  phase: ProviderAcceptanceAuthorityDurablePhaseInternalV1;
}>): Promise<void> {
  const preparationPath = `${input.stagePath}.prepare`;
  await discardDeterministicAuthorityStageInternalV1({
    path: input.stagePath,
    layout: input.layout,
  });
  await discardDeterministicAuthorityStageInternalV1({
    path: preparationPath,
    layout: input.layout,
  });
  let handle: FileHandle | undefined;
  let preparationExists = false;
  try {
    handle = await open(
      preparationPath,
      constants.O_CREAT |
        constants.O_EXCL |
        constants.O_WRONLY |
        NOFOLLOW_V1 |
        CLOEXEC_V1,
      FILE_MODE_V1,
    );
    preparationExists = true;
    await handle.chmod(FILE_MODE_V1);
    await input.hooks?.afterDurablePhase?.(
      input.beforeCompleteWritePhase ??
        "snapshot_stage_preparation_opened_before_complete_write",
    );
    await handle.writeFile(input.bytes);
    await handle.sync();
    const staged = await handle.stat();
    if (
      !staged.isFile() ||
      staged.uid !== input.layout.authorityUid ||
      staged.gid !== input.layout.authorityGid ||
      exactModeV1(staged.mode) !== FILE_MODE_V1 ||
      staged.nlink !== 1 ||
      staged.size !== input.bytes.byteLength
    ) throw new ProviderAcceptanceAuthorityErrorV1("io_error");
    await input.hooks?.afterDurablePhase?.(input.phase);
    await handle.close();
    handle = undefined;
    await link(preparationPath, input.stagePath);
    await syncParentDirectoryInternalV1(input.stagePath);
    await unlink(preparationPath);
    preparationExists = false;
    await syncParentDirectoryInternalV1(preparationPath);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (preparationExists) {
      await unlink(preparationPath).catch(() => undefined);
      await syncParentDirectoryInternalV1(preparationPath).catch(
        () => undefined,
      );
    }
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1("io_error");
  }
}

export async function normalizeDurableAuthorityStagePreparationInternalV1(
  input: Readonly<{
    stagePath: string;
    layout: ProviderAcceptanceAuthorityLayoutInternalV1;
    maximumBytes: number;
  }>,
): Promise<void> {
  const preparationPath = `${input.stagePath}.prepare`;
  let staged: CheckedFileInternalV1 | undefined;
  try {
    staged = await readCheckedAuthorityFileInternalV1({
      path: input.stagePath,
      layout: input.layout,
      maximumBytes: input.maximumBytes,
      allowedLinkCounts: [1, 2],
    });
  } catch (error) {
    if (!isMissingFileInternalV1(error)) throw error;
  }
  let preparation: CheckedFileInternalV1 | undefined;
  try {
    preparation = await readCheckedAuthorityFileInternalV1({
      path: preparationPath,
      layout: input.layout,
      maximumBytes: input.maximumBytes,
      allowedLinkCounts: [1, 2],
    });
  } catch (error) {
    if (!isMissingFileInternalV1(error)) throw error;
  }
  if (staged === undefined) {
    if (preparation !== undefined) {
      await removeCheckedAuthorityFileInternalV1({
        path: preparationPath,
        layout: input.layout,
        expectedDev: preparation.dev,
        expectedIno: preparation.ino,
        allowedLinkCounts: [1],
        maximumBytes: input.maximumBytes,
      });
    }
    return;
  }
  if (staged.nlink === 2) {
    if (
      preparation === undefined ||
      preparation.nlink !== 2 ||
      preparation.dev !== staged.dev ||
      preparation.ino !== staged.ino
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1(
        "namespace_integrity_failed",
      );
    }
    await removeCheckedAuthorityFileInternalV1({
      path: preparationPath,
      layout: input.layout,
      expectedDev: preparation.dev,
      expectedIno: preparation.ino,
      allowedLinkCounts: [2],
      maximumBytes: input.maximumBytes,
    });
    return;
  }
  if (preparation !== undefined) {
    if (preparation.nlink !== 1) {
      throw new ProviderAcceptanceAuthorityErrorV1(
        "namespace_integrity_failed",
      );
    }
    await removeCheckedAuthorityFileInternalV1({
      path: preparationPath,
      layout: input.layout,
      expectedDev: preparation.dev,
      expectedIno: preparation.ino,
      maximumBytes: input.maximumBytes,
    });
  }
}

export async function publishPreparedAuthorityStageInternalV1(input: Readonly<{
  stagePath: string;
  canonicalPath: string;
  layout: ProviderAcceptanceAuthorityLayoutInternalV1;
  hooks?: ProviderAcceptanceAuthorityDurabilityHooksInternalV1;
  afterCanonicalRename: ProviderAcceptanceAuthorityDurablePhaseInternalV1;
  afterDirectoryFsync: ProviderAcceptanceAuthorityDurablePhaseInternalV1;
}>): Promise<void> {
  try {
    await rename(input.stagePath, input.canonicalPath);
    await input.hooks?.afterDurablePhase?.(input.afterCanonicalRename);
    await syncParentDirectoryInternalV1(input.canonicalPath);
    await input.hooks?.afterDurablePhase?.(input.afterDirectoryFsync);
  } catch (error) {
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1("io_error");
  }
}

export async function discardDeterministicAuthorityStageInternalV1(input: Readonly<{
  path: string;
  layout: ProviderAcceptanceAuthorityLayoutInternalV1;
}>): Promise<void> {
  let metadata: Awaited<ReturnType<typeof lstat>>;
  try {
    metadata = await lstat(input.path);
  } catch (error) {
    if (isMissingFileInternalV1(error)) return;
    throw new ProviderAcceptanceAuthorityErrorV1(
      "namespace_integrity_failed",
      { cause: error },
    );
  }
  if (
    metadata.isSymbolicLink() ||
    !metadata.isFile() ||
    metadata.uid !== input.layout.authorityUid ||
    metadata.gid !== input.layout.authorityGid ||
    exactModeV1(metadata.mode) !== FILE_MODE_V1 ||
    metadata.nlink !== 1
  ) {
    throw new ProviderAcceptanceAuthorityErrorV1(
      "namespace_integrity_failed",
    );
  }
  try {
    await unlink(input.path);
    await syncParentDirectoryInternalV1(input.path);
  } catch (error) {
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1(
      isMissingFileInternalV1(error)
        ? "namespace_integrity_failed"
        : "io_error",
    );
  }
}

export async function replaceDurableAuthoritySnapshotInternalV1(input: Readonly<{
  canonicalPath: string;
  stagePath: string;
  bytes: Uint8Array;
  layout: ProviderAcceptanceAuthorityLayoutInternalV1;
  hooks?: ProviderAcceptanceAuthorityDurabilityHooksInternalV1;
  phases?: Readonly<{
    afterPreparationOpen?:
      ProviderAcceptanceAuthorityDurablePhaseInternalV1;
    afterStageFileFsync: ProviderAcceptanceAuthorityDurablePhaseInternalV1;
    afterCanonicalRename: ProviderAcceptanceAuthorityDurablePhaseInternalV1;
    afterDirectoryFsync: ProviderAcceptanceAuthorityDurablePhaseInternalV1;
  }>;
}>): Promise<void> {
  await prepareDurableAuthorityStageInternalV1({
    stagePath: input.stagePath,
    bytes: input.bytes,
    layout: input.layout,
    hooks: input.hooks,
    beforeCompleteWritePhase: input.phases?.afterPreparationOpen ??
      "snapshot_stage_preparation_opened_before_complete_write",
    phase: input.phases?.afterStageFileFsync ??
      "snapshot_stage_file_fsynced",
  });
  await publishPreparedAuthorityStageInternalV1({
    stagePath: input.stagePath,
    canonicalPath: input.canonicalPath,
    layout: input.layout,
    hooks: input.hooks,
    afterCanonicalRename: input.phases?.afterCanonicalRename ??
      "snapshot_canonical_renamed_before_directory_fsync",
    afterDirectoryFsync: input.phases?.afterDirectoryFsync ??
      "snapshot_directory_fsynced_before_publication",
  });
}

export async function removeCheckedAuthorityFileInternalV1(input: Readonly<{
  path: string;
  layout: ProviderAcceptanceAuthorityLayoutInternalV1;
  expectedDev: number;
  expectedIno: number;
  allowedLinkCounts?: readonly number[];
  maximumBytes?: number;
}>): Promise<void> {
  let observed: CheckedFileInternalV1;
  try {
    observed = await readCheckedAuthorityFileInternalV1({
      path: input.path,
      layout: input.layout,
      maximumBytes: input.maximumBytes ?? 64 * 1024,
      allowedLinkCounts: input.allowedLinkCounts,
    });
  } catch (error) {
    if (isMissingFileInternalV1(error)) {
      throw new ProviderAcceptanceAuthorityErrorV1(
        "namespace_integrity_failed",
      );
    }
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1("io_error");
  }
  if (observed.dev !== input.expectedDev || observed.ino !== input.expectedIno) {
    throw new ProviderAcceptanceAuthorityErrorV1(
      "namespace_integrity_failed",
    );
  }
  try {
    await unlink(input.path);
    await syncParentDirectoryInternalV1(input.path);
  } catch (error) {
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1(
      isMissingFileInternalV1(error)
        ? "namespace_integrity_failed"
        : "io_error",
    );
  }
}
