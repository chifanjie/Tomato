import { constants, promises as fs } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const READ_CHUNK_BYTES = 1024 * 1024;

type BigIntFileStat = Awaited<ReturnType<typeof bigintLstat>>;

async function bigintLstat(path: string) {
  return fs.lstat(path, { bigint: true });
}

export type StableFileReadErrorCode =
  | "changed_during_read"
  | "not_regular_file"
  | "outside_repository"
  | "symlink_path"
  | "too_large";

export class StableFileReadError extends Error {
  readonly code: StableFileReadErrorCode;

  constructor(code: StableFileReadErrorCode, message: string) {
    super(message);
    this.name = "StableFileReadError";
    this.code = code;
  }
}

export interface StableFileReadHooks {
  /** Test-only fault injection after path resolution and before opening. */
  afterResolve?: () => void | Promise<void>;
  /** Test-only fault injection after a chunk has been consumed. */
  afterChunk?: (chunkIndex: number) => void | Promise<void>;
}

interface StableReadOptions {
  maxBytes?: number;
  hooks?: StableFileReadHooks;
}

interface ParentPathState {
  path: string;
  stat: BigIntFileStat;
}

function isContainedPath(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate);
  return (
    relativePath !== "" &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  );
}

function sameIdentity(left: BigIntFileStat, right: BigIntFileStat): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function sameFileState(left: BigIntFileStat, right: BigIntFileStat): boolean {
  return (
    sameIdentity(left, right) &&
    left.mode === right.mode &&
    left.nlink === right.nlink &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

async function captureParentPathStates(
  canonicalRoot: string,
  requestedPath: string,
): Promise<ParentPathState[]> {
  if (!isContainedPath(canonicalRoot, requestedPath)) {
    throw new StableFileReadError(
      "outside_repository",
      "File path is outside the canonical repository root",
    );
  }
  const relativePath = relative(canonicalRoot, requestedPath);
  const segments = relativePath.split(sep);
  const states: ParentPathState[] = [];
  let cursor = canonicalRoot;
  for (const segment of segments.slice(0, -1)) {
    cursor = resolve(cursor, segment);
    const stat = await bigintLstat(cursor);
    if (stat.isSymbolicLink()) {
      throw new StableFileReadError(
        "symlink_path",
        "Repository file traverses a symbolic-link parent",
      );
    }
    if (!stat.isDirectory()) {
      throw new StableFileReadError(
        "not_regular_file",
        "Repository file parent is not a directory",
      );
    }
    states.push({ path: cursor, stat });
  }
  return states;
}

async function assertParentPathStates(
  states: readonly ParentPathState[],
): Promise<void> {
  for (const state of states) {
    const current = await bigintLstat(state.path);
    if (
      current.isSymbolicLink() ||
      !current.isDirectory() ||
      !sameIdentity(state.stat, current) ||
      state.stat.mode !== current.mode
    ) {
      throw new StableFileReadError(
        "changed_during_read",
        "Repository file parent changed while content was being read",
      );
    }
  }
}

async function assertRegularFile(
  path: string,
  expected: BigIntFileStat,
): Promise<void> {
  const current = await bigintLstat(path);
  if (!current.isFile() || !sameFileState(expected, current)) {
    throw new StableFileReadError(
      "changed_during_read",
      "File path changed while its content was being read",
    );
  }
}

async function consumeStableFile(
  requestedPath: string,
  allowedRoot: string | undefined,
  consume: (chunk: Buffer) => void,
  options: StableReadOptions = {},
): Promise<void> {
  const resolvedRequestedPath = resolve(requestedPath);
  const resolvedRoot =
    allowedRoot === undefined ? undefined : await fs.realpath(resolve(allowedRoot));
  const parentPathStates =
    resolvedRoot === undefined
      ? []
      : await captureParentPathStates(resolvedRoot, resolvedRequestedPath);
  const realPath = await fs.realpath(resolvedRequestedPath);
  if (
    resolvedRoot !== undefined &&
    !isContainedPath(resolvedRoot, realPath)
  ) {
    throw new StableFileReadError(
      "outside_repository",
      "File resolves outside the canonical repository root",
    );
  }

  const requestedStat = await bigintLstat(resolvedRequestedPath);
  if (requestedStat.isSymbolicLink()) {
    throw new StableFileReadError(
      "symlink_path",
      "Symbolic-link files are not read as regular repository content",
    );
  }
  const resolvedStat = await bigintLstat(realPath);
  if (!resolvedStat.isFile()) {
    throw new StableFileReadError(
      "not_regular_file",
      "Path is not a regular file",
    );
  }
  if (!sameIdentity(requestedStat, resolvedStat)) {
    throw new StableFileReadError(
      "changed_during_read",
      "File path changed before its content could be opened",
    );
  }
  if (
    options.maxBytes !== undefined &&
    resolvedStat.size > BigInt(options.maxBytes)
  ) {
    throw new StableFileReadError(
      "too_large",
      `File exceeds the ${options.maxBytes}-byte inspection limit`,
    );
  }

  await options.hooks?.afterResolve?.();
  await assertParentPathStates(parentPathStates);

  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    handle = await fs.open(
      resolvedRequestedPath,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
    );
    const openedStat = await handle.stat({ bigint: true });
    if (!openedStat.isFile() || !sameFileState(resolvedStat, openedStat)) {
      throw new StableFileReadError(
        "changed_during_read",
        "File path changed before its content could be read",
      );
    }

    const chunk = Buffer.allocUnsafe(READ_CHUNK_BYTES);
    let position = 0;
    let chunkIndex = 0;
    while (true) {
      const { bytesRead } = await handle.read(
        chunk,
        0,
        chunk.length,
        position,
      );
      if (bytesRead === 0) break;
      consume(chunk.subarray(0, bytesRead));
      position += bytesRead;
      await options.hooks?.afterChunk?.(chunkIndex);
      chunkIndex += 1;
    }

    const finalDescriptorStat = await handle.stat({ bigint: true });
    if (
      BigInt(position) !== openedStat.size ||
      !sameFileState(openedStat, finalDescriptorStat)
    ) {
      throw new StableFileReadError(
        "changed_during_read",
        "File content changed while it was being read",
      );
    }
    await assertRegularFile(resolvedRequestedPath, openedStat);
    await assertParentPathStates(parentPathStates);
    const finalRealPath = await fs.realpath(resolvedRequestedPath);
    if (finalRealPath !== realPath) {
      throw new StableFileReadError(
        "changed_during_read",
        "File path resolved to a different target after it was read",
      );
    }
  } finally {
    await handle?.close();
  }
}

export async function hashStableRepositoryFile(
  canonicalRoot: string,
  repositoryPath: string,
  updateHash: (chunk: Buffer) => void,
  hooks?: StableFileReadHooks,
): Promise<void> {
  await consumeStableFile(
    resolve(canonicalRoot, ...repositoryPath.split("/")),
    canonicalRoot,
    updateHash,
    { ...(hooks === undefined ? {} : { hooks }) },
  );
}

export async function readStableRepositoryFile(
  canonicalRoot: string,
  repositoryPath: string,
  maxBytes: number,
  hooks?: StableFileReadHooks,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  await consumeStableFile(
    resolve(canonicalRoot, ...repositoryPath.split("/")),
    canonicalRoot,
    (chunk) => chunks.push(Buffer.from(chunk)),
    { maxBytes, ...(hooks === undefined ? {} : { hooks }) },
  );
  return Buffer.concat(chunks);
}

export async function hashStableAbsoluteFile(
  path: string,
  updateHash: (chunk: Buffer) => void,
): Promise<void> {
  await consumeStableFile(path, undefined, updateHash);
}
