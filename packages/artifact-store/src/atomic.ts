import { randomUUID } from "node:crypto";
import {
  constants,
  open,
  rename,
  unlink,
} from "node:fs/promises";
import path from "node:path";

import { canonicalizeJson } from "@understand-code/contracts";

import { ArtifactStoreError } from "./errors.js";
import {
  assertManagedParentStable,
  repositoryRelativePathFromAbsolute,
  resolveManagedPath,
} from "./path-guard.js";

export type AtomicWriteStage =
  | "before_open"
  | "after_open"
  | "after_write"
  | "after_file_fsync"
  | "before_rename"
  | "after_rename"
  | "after_directory_fsync";

export interface AtomicWriteContext {
  readonly stage: AtomicWriteStage;
  readonly targetPath: string;
  readonly temporaryPath: string;
}

export type AtomicWriteFaultInjector = (
  context: AtomicWriteContext,
) => void | Promise<void>;

export interface AtomicWriteOptions {
  mode?: number;
  faultInjector?: AtomicWriteFaultInjector;
}

async function inject(
  faultInjector: AtomicWriteFaultInjector | undefined,
  stage: AtomicWriteStage,
  targetPath: string,
  temporaryPath: string,
): Promise<void> {
  await faultInjector?.({ stage, targetPath, temporaryPath });
}

export async function fsyncDirectory(directory: string): Promise<void> {
  const handle = await open(directory, constants.O_RDONLY);
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function noFollowFlag(): number {
  return typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
}

export async function atomicWriteFile(
  canonicalWorktreeRoot: string,
  targetPath: string,
  content: string | Uint8Array,
  options: AtomicWriteOptions = {},
): Promise<void> {
  const targetRelative = repositoryRelativePathFromAbsolute(
    canonicalWorktreeRoot,
    targetPath,
  );
  await resolveManagedPath(canonicalWorktreeRoot, targetRelative, {
    allowMissing: true,
  });
  await assertManagedParentStable(canonicalWorktreeRoot, targetPath);

  const temporaryPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.tmp-${process.pid}-${randomUUID()}`,
  );
  let temporaryExists = false;
  let renamed = false;
  let durabilityConfirmed = false;
  let handle;

  try {
    await inject(
      options.faultInjector,
      "before_open",
      targetPath,
      temporaryPath,
    );
    await assertManagedParentStable(canonicalWorktreeRoot, targetPath);
    handle = await open(
      temporaryPath,
      constants.O_CREAT |
        constants.O_EXCL |
        constants.O_WRONLY |
        noFollowFlag(),
      options.mode ?? 0o600,
    );
    temporaryExists = true;
    await inject(
      options.faultInjector,
      "after_open",
      targetPath,
      temporaryPath,
    );
    await handle.writeFile(content);
    await inject(
      options.faultInjector,
      "after_write",
      targetPath,
      temporaryPath,
    );
    await handle.sync();
    await inject(
      options.faultInjector,
      "after_file_fsync",
      targetPath,
      temporaryPath,
    );
    await handle.close();
    handle = undefined;

    await assertManagedParentStable(canonicalWorktreeRoot, targetPath);
    await inject(
      options.faultInjector,
      "before_rename",
      targetPath,
      temporaryPath,
    );
    await assertManagedParentStable(canonicalWorktreeRoot, targetPath);
    await rename(temporaryPath, targetPath);
    renamed = true;
    temporaryExists = false;
    await inject(
      options.faultInjector,
      "after_rename",
      targetPath,
      temporaryPath,
    );
    await assertManagedParentStable(canonicalWorktreeRoot, targetPath);
    await fsyncDirectory(path.dirname(targetPath));
    durabilityConfirmed = true;
    await inject(
      options.faultInjector,
      "after_directory_fsync",
      targetPath,
      temporaryPath,
    );
  } catch (error) {
    if (handle !== undefined) {
      await handle.close().catch(() => undefined);
    }
    if (temporaryExists) {
      await unlink(temporaryPath).catch(() => undefined);
    }
    if (error instanceof ArtifactStoreError) {
      if (!renamed) throw error;
      throw new ArtifactStoreError(
        error.code,
        error.message,
        {
          ...error.details,
          targetPath,
          committed: true,
          durabilityConfirmed,
        },
        { cause: error },
      );
    }
    throw new ArtifactStoreError(
      "artifact_corrupt",
      renamed
        ? durabilityConfirmed
          ? "Atomic write committed a durable file, but a post-commit hook failed."
          : "Atomic write committed a complete file, but durability confirmation failed."
        : "Atomic write failed before the destination was replaced.",
      { targetPath, committed: renamed, durabilityConfirmed },
      { cause: error },
    );
  }
}

export async function atomicWriteJson(
  canonicalWorktreeRoot: string,
  targetPath: string,
  value: unknown,
  options: AtomicWriteOptions = {},
): Promise<void> {
  await atomicWriteFile(
    canonicalWorktreeRoot,
    targetPath,
    `${canonicalizeJson(value)}\n`,
    options,
  );
}

export async function readManagedFile(
  canonicalWorktreeRoot: string,
  targetPath: string,
): Promise<Buffer> {
  const targetRelative = repositoryRelativePathFromAbsolute(
    canonicalWorktreeRoot,
    targetPath,
  );
  const guardedTarget = await resolveManagedPath(
    canonicalWorktreeRoot,
    targetRelative,
  );
  await assertManagedParentStable(canonicalWorktreeRoot, guardedTarget);
  const handle = await open(
    guardedTarget,
    constants.O_RDONLY | noFollowFlag(),
  );
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile()) {
      throw new ArtifactStoreError(
        "unsafe_path",
        "Managed reads require a regular file.",
        { targetPath },
      );
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

export async function readManagedJson(
  canonicalWorktreeRoot: string,
  targetPath: string,
): Promise<unknown> {
  const bytes = await readManagedFile(canonicalWorktreeRoot, targetPath);
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch (error) {
    throw new ArtifactStoreError(
      "artifact_corrupt",
      "Managed JSON is not syntactically valid.",
      { targetPath },
      { cause: error },
    );
  }
}
