import {
  constants,
  mkdir,
  lstat,
  open,
  realpath,
  stat,
} from "node:fs/promises";
import path from "node:path";

import { RepositoryRelativePathSchema } from "@understand-code/contracts";

import { ArtifactStoreError } from "./errors.js";

const SENSITIVE_COMPONENTS = new Set([
  ".aws",
  ".git",
  ".gnupg",
  ".netrc",
  ".npmrc",
  ".ssh",
  "credentials",
  "credentials.json",
  "id_dsa",
  "id_ed25519",
  "id_ecdsa",
  "id_rsa",
  "secrets",
  "secrets.json",
]);

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;

function pathIsInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

function assertNotSensitive(relativePath: string): void {
  for (const component of relativePath.split("/")) {
    const lower = component.toLowerCase();
    if (
      SENSITIVE_COMPONENTS.has(lower) ||
      lower === ".env" ||
      lower.startsWith(".env.")
    ) {
      throw new ArtifactStoreError(
        "sensitive_path",
        `Access to sensitive path component "${component}" is denied.`,
        { relativePath },
      );
    }
  }
}

export async function canonicalizeWorktreeRoot(
  worktreeRoot: string,
): Promise<string> {
  if (!path.isAbsolute(worktreeRoot)) {
    throw new ArtifactStoreError(
      "invalid_root",
      "The worktree root must be an absolute path.",
      { worktreeRoot },
    );
  }
  try {
    const resolved = await realpath(worktreeRoot);
    const metadata = await stat(resolved);
    if (!metadata.isDirectory()) {
      throw new ArtifactStoreError(
        "invalid_root",
        "The canonical worktree root is not a directory.",
        { worktreeRoot, canonicalRoot: resolved },
      );
    }
    return resolved;
  } catch (error) {
    if (error instanceof ArtifactStoreError) throw error;
    throw new ArtifactStoreError(
      "invalid_root",
      "The worktree root cannot be canonicalized.",
      { worktreeRoot },
      { cause: error },
    );
  }
}

export interface GuardedPathOptions {
  allowMissing?: boolean;
  allowContainedSymlinks?: boolean;
}

/**
 * Resolves a repository-relative path and validates every existing component.
 *
 * The lexical containment check prevents prefix collisions; component lstat
 * checks reject broken links and managed-path links before they can be
 * followed. Callers performing writes must re-run this guard immediately
 * before each filesystem transition because path validation cannot be cached.
 */
export async function resolveRepositoryPath(
  canonicalWorktreeRoot: string,
  relativePath: string,
  options: GuardedPathOptions = {},
): Promise<string> {
  const parsedRelativePath = RepositoryRelativePathSchema.safeParse(relativePath);
  if (!parsedRelativePath.success) {
    throw new ArtifactStoreError(
      "unsafe_path",
      "Path must be a normalized repository-relative POSIX path.",
      { relativePath },
      { cause: parsedRelativePath.error },
    );
  }
  assertNotSensitive(relativePath);

  const components = relativePath.split("/");
  const candidate = path.resolve(canonicalWorktreeRoot, ...components);
  if (!pathIsInside(canonicalWorktreeRoot, candidate)) {
    throw new ArtifactStoreError(
      "unsafe_path",
      "Resolved path escapes the canonical worktree root.",
      { relativePath },
    );
  }

  let current = canonicalWorktreeRoot;
  for (let index = 0; index < components.length; index += 1) {
    const component = components[index];
    if (component === undefined) continue;
    current = path.join(current, component);
    let metadata;
    try {
      metadata = await lstat(current);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        if (options.allowMissing === true) return candidate;
        throw new ArtifactStoreError(
          "artifact_not_found",
          `Managed path does not exist: ${relativePath}`,
          { relativePath },
          { cause: error },
        );
      }
      throw error;
    }

    if (metadata.isSymbolicLink()) {
      let target: string;
      try {
        target = await realpath(current);
      } catch (error) {
        throw new ArtifactStoreError(
          "symlink_rejected",
          `Broken or cyclic symlink is rejected: ${relativePath}`,
          { relativePath, componentIndex: index },
          { cause: error },
        );
      }
      if (!pathIsInside(canonicalWorktreeRoot, target)) {
        throw new ArtifactStoreError(
          "symlink_rejected",
          `Symlink escapes the canonical worktree root: ${relativePath}`,
          { relativePath, target },
        );
      }
      if (options.allowContainedSymlinks !== true) {
        throw new ArtifactStoreError(
          "symlink_rejected",
          `Symlinks are not allowed in managed paths: ${relativePath}`,
          { relativePath, target },
        );
      }
      current = target;
    }

    if (
      index < components.length - 1 &&
      !metadata.isDirectory() &&
      !metadata.isSymbolicLink()
    ) {
      throw new ArtifactStoreError(
        "unsafe_path",
        `A non-directory component appears before the path leaf: ${relativePath}`,
        { relativePath, componentIndex: index },
      );
    }
  }

  let canonicalCandidate: string;
  try {
    canonicalCandidate = await realpath(candidate);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      if (options.allowMissing === true) return candidate;
      throw new ArtifactStoreError(
        "artifact_not_found",
        `Managed path does not exist: ${relativePath}`,
        { relativePath },
        { cause: error },
      );
    }
    throw error;
  }
  if (!pathIsInside(canonicalWorktreeRoot, canonicalCandidate)) {
    throw new ArtifactStoreError(
      "unsafe_path",
      "Canonical path escapes the canonical worktree root.",
      { relativePath, canonicalCandidate },
    );
  }
  return canonicalCandidate;
}

export async function resolveManagedPath(
  canonicalWorktreeRoot: string,
  storeRelativePath: string,
  options: GuardedPathOptions = {},
): Promise<string> {
  if (
    storeRelativePath !== ".understand-code" &&
    !storeRelativePath.startsWith(".understand-code/")
  ) {
    throw new ArtifactStoreError(
      "unsafe_path",
      "Managed persistence is restricted to .understand-code.",
      { storeRelativePath },
    );
  }
  return resolveRepositoryPath(
    canonicalWorktreeRoot,
    storeRelativePath,
    options,
  );
}

export function assertSafeIdentifierSegment(
  value: string,
  label = "identifier",
): string {
  if (
    value.length === 0 ||
    value === "." ||
    value === ".." ||
    value.includes("/") ||
    value.includes("\\") ||
    CONTROL_CHARACTERS.test(value)
  ) {
    throw new ArtifactStoreError(
      "unsafe_path",
      `${label} cannot be represented as one safe path segment.`,
      { value },
    );
  }
  return value;
}

export function repositoryRelativePathFromAbsolute(
  canonicalWorktreeRoot: string,
  absolutePath: string,
): string {
  if (!pathIsInside(canonicalWorktreeRoot, absolutePath)) {
    throw new ArtifactStoreError(
      "unsafe_path",
      "Absolute path is outside the canonical worktree root.",
      { absolutePath },
    );
  }
  const relative = path
    .relative(canonicalWorktreeRoot, absolutePath)
    .split(path.sep)
    .join("/");
  return RepositoryRelativePathSchema.parse(relative);
}

export async function assertManagedParentStable(
  canonicalWorktreeRoot: string,
  absoluteTargetPath: string,
): Promise<void> {
  const parent = path.dirname(absoluteTargetPath);
  const parentRelative = repositoryRelativePathFromAbsolute(
    canonicalWorktreeRoot,
    parent,
  );
  const guardedParent = await resolveManagedPath(
    canonicalWorktreeRoot,
    parentRelative,
  );
  if (guardedParent !== parent) {
    throw new ArtifactStoreError(
      "unsafe_path",
      "Managed parent changed identity during the filesystem operation.",
      { expectedParent: parent, actualParent: guardedParent },
    );
  }
}

export interface ManagedDirectoryCreationContext {
  readonly directoryPath: string;
  readonly parentDirectoryPath: string;
  readonly relativeDirectoryPath: string;
}

export interface EnsureManagedDirectoryOptions {
  faultInjector?: (
    context: ManagedDirectoryCreationContext,
  ) => void | Promise<void>;
}

function noFollowFlag(): number {
  return typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
}

function directoryOnlyFlag(): number {
  return typeof constants.O_DIRECTORY === "number" ? constants.O_DIRECTORY : 0;
}

async function assertDirectoryParentStable(
  canonicalWorktreeRoot: string,
  directoryPath: string,
): Promise<string> {
  const parentDirectoryPath = path.dirname(directoryPath);
  if (parentDirectoryPath !== canonicalWorktreeRoot) {
    await assertManagedParentStable(canonicalWorktreeRoot, directoryPath);
    return parentDirectoryPath;
  }

  const metadata = await lstat(parentDirectoryPath);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new ArtifactStoreError(
      "symlink_rejected",
      "The canonical worktree root changed identity during directory initialization.",
      { canonicalWorktreeRoot },
    );
  }
  const canonicalParent = await realpath(parentDirectoryPath);
  if (canonicalParent !== canonicalWorktreeRoot) {
    throw new ArtifactStoreError(
      "unsafe_path",
      "The canonical worktree root changed identity during directory initialization.",
      { canonicalWorktreeRoot, canonicalParent },
    );
  }
  return parentDirectoryPath;
}

async function fsyncDirectory(directoryPath: string): Promise<void> {
  const handle = await open(
    directoryPath,
    constants.O_RDONLY | noFollowFlag() | directoryOnlyFlag(),
  );
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function ensureManagedDirectory(
  canonicalWorktreeRoot: string,
  storeRelativeDirectory: string,
  options: EnsureManagedDirectoryOptions = {},
): Promise<string> {
  if (
    storeRelativeDirectory !== ".understand-code" &&
    !storeRelativeDirectory.startsWith(".understand-code/")
  ) {
    throw new ArtifactStoreError(
      "unsafe_path",
      "Directory creation is restricted to .understand-code.",
      { storeRelativeDirectory },
    );
  }
  RepositoryRelativePathSchema.parse(storeRelativeDirectory);
  assertNotSensitive(storeRelativeDirectory);

  let currentRelative = "";
  for (const [index, component] of storeRelativeDirectory
    .split("/")
    .entries()) {
    currentRelative =
      currentRelative.length === 0
        ? component
        : `${currentRelative}/${component}`;
    const currentAbsolute = path.join(
      canonicalWorktreeRoot,
      ...currentRelative.split("/"),
    );
    if (index > 0) {
      const parentRelative = currentRelative.slice(
        0,
        currentRelative.lastIndexOf("/"),
      );
      await resolveManagedPath(canonicalWorktreeRoot, parentRelative);
    }
    let created = false;
    try {
      await mkdir(currentAbsolute, { mode: 0o700 });
      created = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    const guarded = await resolveManagedPath(
      canonicalWorktreeRoot,
      currentRelative,
    );
    if (guarded !== currentAbsolute) {
      throw new ArtifactStoreError(
        "unsafe_path",
        "Managed directory changed identity while being initialized.",
        { expected: currentAbsolute, actual: guarded },
      );
    }
    const metadata = await lstat(guarded);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new ArtifactStoreError(
        "symlink_rejected",
        "Managed directory components must be real directories.",
        { path: currentRelative },
      );
    }
    if (created) {
      const parentDirectoryPath = await assertDirectoryParentStable(
        canonicalWorktreeRoot,
        currentAbsolute,
      );
      try {
        await fsyncDirectory(parentDirectoryPath);
        await options.faultInjector?.({
          directoryPath: currentAbsolute,
          parentDirectoryPath,
          relativeDirectoryPath: currentRelative,
        });
      } catch (error) {
        if (error instanceof ArtifactStoreError) throw error;
        throw new ArtifactStoreError(
          "artifact_corrupt",
          "Managed directory creation completed, but parent-directory durability confirmation failed.",
          {
            directoryPath: currentAbsolute,
            parentDirectoryPath,
            committed: true,
          },
          { cause: error },
        );
      }
    }
  }
  return path.join(
    canonicalWorktreeRoot,
    ...storeRelativeDirectory.split("/"),
  );
}
