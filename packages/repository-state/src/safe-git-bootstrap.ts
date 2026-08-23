import { constants, promises as fs } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import { userInfo } from "node:os";
import {
  dirname,
  isAbsolute,
  join,
  normalize,
  parse,
  relative,
  resolve,
  sep,
} from "node:path";
import { TextDecoder } from "node:util";

import {
  bindNativeSafeGitRepositoryControlV1,
  closeNativeSafeGitDescriptorBootstrapV1,
  openNativeSafeGitDescriptorBootstrapV1,
  revalidateNativeSafeGitDescriptorBootstrapV1,
  type NativeSafeGitDescriptorBindingV1,
  type NativeSafeGitDescriptorLayoutV1,
  type NativeSafeGitRepositoryControlInspectionV1,
} from "@understand-code/native-kernel-bridge";

import { getSafeGitBootstrapTestHooksInternalV1 } from "./safe-git-bootstrap-testing-internal.js";

const MAX_POINTER_BYTES_V1 = 4_096;
const MAX_BOUND_COMPONENTS_V1 = 256;
const NOFOLLOW_V1 = (constants as unknown as Record<string, number>)[
  "O_NOFOLLOW"
];
const DIRECTORY_V1 = (constants as unknown as Record<string, number>)[
  "O_DIRECTORY"
];
const NONBLOCK_V1 = (constants as unknown as Record<string, number>)[
  "O_NONBLOCK"
];
const NO_CONTROLLING_TERMINAL_V1 = (
  constants as unknown as Record<string, number>
)["O_NOCTTY"];
const FATAL_UTF8_DECODER_V1 = new TextDecoder("utf-8", { fatal: true });

export const SAFE_GIT_DESCRIPTOR_BOOTSTRAP_PROFILE_V1 =
  "descriptor_bound_safe_git_bootstrap_candidate_v1" as const;
export const SAFE_GIT_DESCRIPTOR_BOOTSTRAP_REQUIRED_NEXT_V1 = Object.freeze([
  "repository_control_reader",
  "local_odb_and_ref_backend_verification",
  "handle_bound_execution",
  "os_sandbox",
  "hmac_identity",
  "strong_writer",
] as const);
export const SAFE_GIT_REPOSITORY_CONTROL_PROFILE_V1 =
  "descriptor_bound_safe_git_repository_control_v1" as const;
export const SAFE_GIT_REPOSITORY_CONTROL_REQUIRED_NEXT_V1 = Object.freeze([
  "empty_hooks_directory",
  "handle_bound_execution",
  "os_sandbox",
  "hmac_identity",
  "strong_writer",
] as const);

export type SafeGitBootstrapErrorCodeV1 =
  | "unsupported_platform"
  | "invalid_root"
  | "filesystem_binding_invalid"
  | "symlink_detected"
  | "unsafe_owner"
  | "unsafe_mode"
  | "unsafe_file_kind"
  | "pointer_limit_exceeded"
  | "malformed_git_pointer"
  | "external_git_target"
  | "backpointer_mismatch"
  | "repository_control_invalid"
  | "binding_changed";

const ERROR_MESSAGES_V1: Readonly<Record<SafeGitBootstrapErrorCodeV1, string>> =
  Object.freeze({
    unsupported_platform:
      "filesystem-only SafeGit bootstrap is unavailable on this platform",
    invalid_root: "workspace root is not a valid bootstrap root",
    filesystem_binding_invalid:
      "filesystem bootstrap binding could not be verified",
    symlink_detected: "filesystem bootstrap rejected a symbolic-link binding",
    unsafe_owner: "filesystem bootstrap rejected an untrusted owner",
    unsafe_mode: "filesystem bootstrap rejected writable control metadata",
    unsafe_file_kind: "filesystem bootstrap rejected an unexpected file kind",
    pointer_limit_exceeded: "filesystem bootstrap pointer exceeds its fixed limit",
    malformed_git_pointer: "filesystem bootstrap pointer is malformed",
    external_git_target:
      "filesystem bootstrap target is not a linked-worktree control directory",
    backpointer_mismatch:
      "filesystem bootstrap linked-worktree backpointer does not match",
    repository_control_invalid:
      "repository control metadata is unsupported or could not be verified",
    binding_changed: "filesystem bootstrap binding changed during validation",
  });

/** A path-redacted bootstrap failure suitable for a public diagnostic boundary. */
export class SafeGitBootstrapErrorV1 extends Error {
  readonly code: SafeGitBootstrapErrorCodeV1;

  constructor(code: SafeGitBootstrapErrorCodeV1) {
    super(ERROR_MESSAGES_V1[code]);
    this.name = "SafeGitBootstrapErrorV1";
    this.code = code;
  }
}

export interface SafeGitDescriptorBootstrapInspectionV1 {
  readonly profile: typeof SAFE_GIT_DESCRIPTOR_BOOTSTRAP_PROFILE_V1;
  readonly status: "verified_candidate";
  readonly layout: "ordinary" | "linked_worktree";
  readonly filesystemBinding: "verified";
  readonly linkedWorktreeBackpointer: "not_applicable" | "verified";
  readonly descriptorRelativeTraversal: "verified";
  readonly extendedAccessControl: "verified";
  readonly nativeHandleCustody: "verified";
  readonly repositoryControlShape: "locked";
  readonly repositoryControlReader: "locked";
  readonly localObjectDatabase: "locked";
  readonly refBackend: "locked";
  readonly handleBoundExecution: "locked";
  readonly osSandbox: "locked";
  readonly hmacIdentity: "locked";
  readonly strongWrites: "locked";
  readonly requiredNext: readonly [
    "repository_control_reader",
    "local_odb_and_ref_backend_verification",
    "handle_bound_execution",
    "os_sandbox",
    "hmac_identity",
    "strong_writer",
  ];
}

/** Path-redacted proof that the bound repository has only local, supported control state. */
export interface SafeGitRepositoryControlInspectionV1 {
  readonly profile: typeof SAFE_GIT_REPOSITORY_CONTROL_PROFILE_V1;
  readonly status: "verified_candidate";
  readonly layout: "ordinary" | "linked_worktree";
  readonly filesystemBinding: "verified";
  readonly linkedWorktreeBackpointer: "not_applicable" | "verified";
  readonly descriptorRelativeTraversal: "verified";
  readonly extendedAccessControl: "verified";
  readonly nativeHandleCustody: "verified";
  readonly repositoryControlShape: "verified";
  readonly repositoryControlReader: "verified";
  readonly localObjectDatabase: "verified";
  readonly refBackend: "verified";
  readonly objectFormat: "sha1" | "sha256";
  readonly objectDatabase: "local_only_verified";
  readonly repositoryConfig: "verified";
  readonly worktreeConfig: "absent" | "verified";
  readonly emptyHooksDirectory: "locked";
  readonly handleBoundExecution: "locked";
  readonly osSandbox: "locked";
  readonly hmacIdentity: "locked";
  readonly strongWrites: "locked";
  readonly requiredNext: readonly [
    "empty_hooks_directory",
    "handle_bound_execution",
    "os_sandbox",
    "hmac_identity",
    "strong_writer",
  ];
}

export type SafeGitDescriptorBoundInspectionV1 =
  | SafeGitDescriptorBootstrapInspectionV1
  | SafeGitRepositoryControlInspectionV1;

export interface SafeGitDescriptorBoundCapabilityV1 {
  readonly profile: typeof SAFE_GIT_DESCRIPTOR_BOOTSTRAP_PROFILE_V1;
  readonly closed: boolean;
  bindRepositoryControl(): Promise<SafeGitRepositoryControlInspectionV1>;
  revalidate(): Promise<SafeGitDescriptorBoundInspectionV1>;
  close(): Promise<void>;
}

export interface SafeGitDescriptorBoundBootstrapCandidateV1 {
  readonly capability: SafeGitDescriptorBoundCapabilityV1;
  readonly inspection: SafeGitDescriptorBootstrapInspectionV1;
}

type BigIntStatsV1 = Awaited<ReturnType<typeof lstatBigIntV1>>;

interface BoundNodeV1 {
  readonly path: string;
  readonly kind: "directory" | "file";
  readonly handle: FileHandle;
  readonly opened: BigIntStatsV1;
}

const CAPABILITIES_V1 = new WeakSet<object>();

class SafeGitBootstrapCapabilityInternalV1
  implements SafeGitDescriptorBoundCapabilityV1
{
  readonly profile = SAFE_GIT_DESCRIPTOR_BOOTSTRAP_PROFILE_V1;
  #binding: NativeSafeGitDescriptorBindingV1 | undefined;
  readonly #layout: NativeSafeGitDescriptorLayoutV1;
  #repositoryControl: NativeSafeGitRepositoryControlInspectionV1 | undefined;
  #usable = true;
  #closed = false;
  #closing: Promise<void> | undefined;

  constructor(
    binding: NativeSafeGitDescriptorBindingV1,
    layout: NativeSafeGitDescriptorLayoutV1,
  ) {
    this.#binding = binding;
    this.#layout = layout;
    CAPABILITIES_V1.add(this);
    Object.freeze(this);
  }

  get closed(): boolean {
    return this.#closed;
  }

  async bindRepositoryControl(): Promise<SafeGitRepositoryControlInspectionV1> {
    const binding = this.#binding;
    if (this.#closed || !this.#usable || binding === undefined) {
      throw new SafeGitBootstrapErrorV1("binding_changed");
    }
    try {
      const control = bindNativeSafeGitRepositoryControlV1(binding);
      this.#repositoryControl = control;
      return repositoryControlInspectionV1(this.#layout, control);
    } catch {
      this.#poisonBinding(binding);
      throw new SafeGitBootstrapErrorV1("repository_control_invalid");
    }
  }

  async revalidate(): Promise<SafeGitDescriptorBoundInspectionV1> {
    const binding = this.#binding;
    if (this.#closed || !this.#usable || binding === undefined) {
      throw new SafeGitBootstrapErrorV1("binding_changed");
    }
    try {
      const layout = revalidateNativeSafeGitDescriptorBootstrapV1(binding);
      if (layout !== this.#layout) {
        throw new SafeGitBootstrapErrorV1("binding_changed");
      }
      return this.#repositoryControl === undefined
        ? inspectionV1(layout)
        : repositoryControlInspectionV1(layout, this.#repositoryControl);
    } catch {
      this.#poisonBinding(binding);
      throw new SafeGitBootstrapErrorV1("binding_changed");
    }
  }

  #poisonBinding(binding: NativeSafeGitDescriptorBindingV1): void {
    this.#usable = false;
    try {
      closeNativeSafeGitDescriptorBootstrapV1(binding);
      this.#binding = undefined;
      this.#closed = true;
      CAPABILITIES_V1.delete(this);
    } catch {
      // Keep the genuine capability recognizable so close() can be retried.
    }
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    if (this.#closing !== undefined) return this.#closing;
    const operation = this.#closeHandles();
    this.#closing = operation;
    try {
      await operation;
    } finally {
      if (this.#closing === operation) this.#closing = undefined;
    }
  }

  async #closeHandles(): Promise<void> {
    const binding = this.#binding;
    if (binding === undefined) {
      this.#closed = true;
      this.#usable = false;
      CAPABILITIES_V1.delete(this);
      return;
    }
    try {
      closeNativeSafeGitDescriptorBootstrapV1(binding);
    } catch {
      throw new SafeGitBootstrapErrorV1("filesystem_binding_invalid");
    }
    this.#binding = undefined;
    this.#closed = true;
    this.#usable = false;
    CAPABILITIES_V1.delete(this);
  }
}

/** Runtime authenticity check for the otherwise opaque bootstrap capability. */
export function isSafeGitDescriptorBoundCapabilityV1(
  value: unknown,
): value is SafeGitDescriptorBoundCapabilityV1 {
  return typeof value === "object" && value !== null && CAPABILITIES_V1.has(value);
}

async function lstatBigIntV1(path: string) {
  return fs.lstat(path, { bigint: true });
}

function exactModeV1(mode: bigint): number {
  return Number(mode & 0o7777n);
}

function requiredFilesystemOpenFlagsV1(): Readonly<{
  readonly noFollow: number;
  readonly directory: number;
  readonly nonBlock: number;
  readonly noControllingTerminal: number;
}> {
  const noFollow = NOFOLLOW_V1;
  const directory = DIRECTORY_V1;
  const nonBlock = NONBLOCK_V1;
  const noControllingTerminal = NO_CONTROLLING_TERMINAL_V1;
  if (
    noFollow === undefined ||
    !Number.isSafeInteger(noFollow) ||
    noFollow === 0 ||
    directory === undefined ||
    !Number.isSafeInteger(directory) ||
    directory === 0 ||
    nonBlock === undefined ||
    !Number.isSafeInteger(nonBlock) ||
    nonBlock === 0 ||
    noControllingTerminal === undefined ||
    !Number.isSafeInteger(noControllingTerminal) ||
    noControllingTerminal === 0
  ) {
    throw new SafeGitBootstrapErrorV1("unsupported_platform");
  }
  return { noFollow, directory, nonBlock, noControllingTerminal };
}

function effectiveUidV1(): bigint {
  if (process.platform !== "darwin" && process.platform !== "linux") {
    throw new SafeGitBootstrapErrorV1("unsupported_platform");
  }
  requiredFilesystemOpenFlagsV1();
  const observed =
    typeof process.geteuid === "function"
      ? process.geteuid()
      : typeof process.getuid === "function"
        ? process.getuid()
        : undefined;
  const account = userInfo({ encoding: "utf8" });
  if (
    observed === undefined ||
    !Number.isSafeInteger(observed) ||
    observed < 0 ||
    account.uid !== observed
  ) {
    throw new SafeGitBootstrapErrorV1("unsupported_platform");
  }
  return BigInt(observed);
}

function sameOpenedNodeV1(
  left: BigIntStatsV1,
  right: BigIntStatsV1,
  kind: BoundNodeV1["kind"],
): boolean {
  const correctKind =
    kind === "directory" ? right.isDirectory() : right.isFile();
  return (
    correctKind &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.uid === right.uid &&
    left.gid === right.gid &&
    left.mode === right.mode &&
    (kind === "directory" ||
      (left.nlink === right.nlink &&
        left.size === right.size &&
        left.mtimeNs === right.mtimeNs &&
        left.ctimeNs === right.ctimeNs))
  );
}

function assertOwnerSafeV1(node: BoundNodeV1, uid: bigint): void {
  if (node.opened.uid !== uid) {
    throw new SafeGitBootstrapErrorV1("unsafe_owner");
  }
  if ((exactModeV1(node.opened.mode) & 0o7022) !== 0) {
    throw new SafeGitBootstrapErrorV1("unsafe_mode");
  }
  if (node.kind === "file" && node.opened.nlink !== 1n) {
    throw new SafeGitBootstrapErrorV1("filesystem_binding_invalid");
  }
}

function isErrnoV1(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}

function safeAbsolutePathV1(value: string): string {
  if (!isAbsolute(value)) {
    throw new SafeGitBootstrapErrorV1("invalid_root");
  }
  if (
    value.includes("\0") ||
    Buffer.byteLength(value, "utf8") > MAX_POINTER_BYTES_V1
  ) {
    throw new SafeGitBootstrapErrorV1("pointer_limit_exceeded");
  }
  const normalized = normalize(resolve(value));
  if (!isAbsolute(normalized) || normalized === parse(normalized).root) {
    throw new SafeGitBootstrapErrorV1("invalid_root");
  }
  return normalized;
}

function pathComponentsV1(path: string): string[] {
  const root = parse(path).root;
  const rest = path.slice(root.length).split(sep).filter(Boolean);
  if (rest.length > MAX_BOUND_COMPONENTS_V1) {
    throw new SafeGitBootstrapErrorV1("pointer_limit_exceeded");
  }
  const components = [root];
  let cursor = root;
  for (const segment of rest) {
    cursor = join(cursor, segment);
    components.push(cursor);
  }
  return components;
}

async function openBoundNodeV1(
  path: string,
  kind: BoundNodeV1["kind"],
): Promise<BoundNodeV1> {
  const before = await lstatBigIntV1(path);
  if (before.isSymbolicLink()) {
    throw new SafeGitBootstrapErrorV1("symlink_detected");
  }
  if (
    (kind === "directory" && !before.isDirectory()) ||
    (kind === "file" && !before.isFile())
  ) {
    throw new SafeGitBootstrapErrorV1("unsafe_file_kind");
  }
  let handle: FileHandle | undefined;
  try {
    const openFlags = requiredFilesystemOpenFlagsV1();
    handle = await fs.open(
      path,
      constants.O_RDONLY |
        openFlags.noFollow |
        (kind === "directory"
          ? openFlags.directory
          : openFlags.nonBlock | openFlags.noControllingTerminal),
    );
    const opened = await handle.stat({ bigint: true });
    if (!sameOpenedNodeV1(before, opened, kind)) {
      throw new SafeGitBootstrapErrorV1("binding_changed");
    }
    return { path, kind, handle, opened };
  } catch (error) {
    await handle?.close().catch(() => undefined);
    throw error;
  }
}

async function bindDirectoryChainV1(
  directoryPath: string,
  nodes: Map<string, BoundNodeV1>,
): Promise<BoundNodeV1> {
  for (const component of pathComponentsV1(directoryPath)) {
    if (nodes.has(component)) continue;
    nodes.set(component, await openBoundNodeV1(component, "directory"));
  }
  return nodes.get(directoryPath)!;
}

async function bindFileV1(
  path: string,
  nodes: Map<string, BoundNodeV1>,
): Promise<BoundNodeV1> {
  await bindDirectoryChainV1(dirname(path), nodes);
  const existing = nodes.get(path);
  if (existing !== undefined) {
    if (existing.kind !== "file") {
      throw new SafeGitBootstrapErrorV1("unsafe_file_kind");
    }
    return existing;
  }
  const node = await openBoundNodeV1(path, "file");
  nodes.set(path, node);
  return node;
}

async function readBoundPointerV1(node: BoundNodeV1): Promise<string> {
  if (
    node.kind !== "file" ||
    node.opened.size <= 0n ||
    node.opened.size > BigInt(MAX_POINTER_BYTES_V1)
  ) {
    throw new SafeGitBootstrapErrorV1(
      node.opened.size > BigInt(MAX_POINTER_BYTES_V1)
        ? "pointer_limit_exceeded"
        : "malformed_git_pointer",
    );
  }
  const bytes = await node.handle.readFile();
  const after = await node.handle.stat({ bigint: true });
  if (
    bytes.byteLength !== Number(node.opened.size) ||
    !sameOpenedNodeV1(node.opened, after, "file")
  ) {
    throw new SafeGitBootstrapErrorV1("binding_changed");
  }
  try {
    return FATAL_UTF8_DECODER_V1.decode(bytes);
  } catch {
    throw new SafeGitBootstrapErrorV1("malformed_git_pointer");
  }
}

function strictSingleLineV1(value: string): string {
  const withoutFinalNewline = value.endsWith("\n") ? value.slice(0, -1) : value;
  if (
    withoutFinalNewline.length === 0 ||
    withoutFinalNewline.includes("\n") ||
    /[\u0000-\u001f\u007f]/u.test(withoutFinalNewline) ||
    Buffer.byteLength(withoutFinalNewline, "utf8") > MAX_POINTER_BYTES_V1
  ) {
    throw new SafeGitBootstrapErrorV1("malformed_git_pointer");
  }
  return withoutFinalNewline;
}

function parseDotGitPointerV1(value: string): string {
  const line = strictSingleLineV1(value);
  const prefix = "gitdir: ";
  if (!line.startsWith(prefix) || line.length === prefix.length) {
    throw new SafeGitBootstrapErrorV1("malformed_git_pointer");
  }
  return line.slice(prefix.length);
}

function parsePathPointerV1(value: string): string {
  return strictSingleLineV1(value);
}

function resolvePointerV1(base: string, pointer: string): string {
  return safeAbsolutePathV1(isAbsolute(pointer) ? pointer : resolve(base, pointer));
}

async function assertAbsentV1(path: string): Promise<void> {
  try {
    await fs.lstat(path);
  } catch (error) {
    if (isErrnoV1(error, "ENOENT")) return;
    throw error;
  }
  throw new SafeGitBootstrapErrorV1("external_git_target");
}

async function validateBindingsV1(
  nodes: ReadonlyMap<string, BoundNodeV1>,
  absentPaths: readonly string[],
  requestedRootPath: string,
  openedRoot: BigIntStatsV1,
): Promise<void> {
  for (const node of nodes.values()) {
    const atPath = await lstatBigIntV1(node.path);
    const atHandle = await node.handle.stat({ bigint: true });
    if (
      atPath.isSymbolicLink() ||
      !sameOpenedNodeV1(node.opened, atPath, node.kind) ||
      !sameOpenedNodeV1(node.opened, atHandle, node.kind)
    ) {
      throw new SafeGitBootstrapErrorV1("binding_changed");
    }
  }
  const requestedRoot = await lstatBigIntV1(requestedRootPath);
  if (
    requestedRoot.isSymbolicLink() ||
    !sameOpenedNodeV1(openedRoot, requestedRoot, "directory")
  ) {
    throw new SafeGitBootstrapErrorV1("binding_changed");
  }
  for (const path of absentPaths) await assertAbsentV1(path);
}

function inspectionV1(
  layout: SafeGitDescriptorBootstrapInspectionV1["layout"],
): SafeGitDescriptorBootstrapInspectionV1 {
  return Object.freeze({
    profile: SAFE_GIT_DESCRIPTOR_BOOTSTRAP_PROFILE_V1,
    status: "verified_candidate",
    layout,
    filesystemBinding: "verified",
    linkedWorktreeBackpointer:
      layout === "ordinary" ? "not_applicable" : "verified",
    descriptorRelativeTraversal: "verified",
    extendedAccessControl: "verified",
    nativeHandleCustody: "verified",
    repositoryControlShape: "locked",
    repositoryControlReader: "locked",
    localObjectDatabase: "locked",
    refBackend: "locked",
    handleBoundExecution: "locked",
    osSandbox: "locked",
    hmacIdentity: "locked",
    strongWrites: "locked",
    requiredNext: SAFE_GIT_DESCRIPTOR_BOOTSTRAP_REQUIRED_NEXT_V1,
  });
}

function repositoryControlInspectionV1(
  layout: SafeGitRepositoryControlInspectionV1["layout"],
  control: NativeSafeGitRepositoryControlInspectionV1,
): SafeGitRepositoryControlInspectionV1 {
  return Object.freeze({
    profile: SAFE_GIT_REPOSITORY_CONTROL_PROFILE_V1,
    status: "verified_candidate",
    layout,
    filesystemBinding: "verified",
    linkedWorktreeBackpointer:
      layout === "ordinary" ? "not_applicable" : "verified",
    descriptorRelativeTraversal: "verified",
    extendedAccessControl: "verified",
    nativeHandleCustody: "verified",
    repositoryControlShape: "verified",
    repositoryControlReader: "verified",
    localObjectDatabase: "verified",
    refBackend: "verified",
    objectFormat: control.objectFormat,
    objectDatabase: control.objectDatabase,
    repositoryConfig: control.repositoryConfig,
    worktreeConfig: control.worktreeConfig,
    emptyHooksDirectory: "locked",
    handleBoundExecution: "locked",
    osSandbox: "locked",
    hmacIdentity: "locked",
    strongWrites: "locked",
    requiredNext: SAFE_GIT_REPOSITORY_CONTROL_REQUIRED_NEXT_V1,
  });
}

async function bootstrapSafeGitDescriptorBoundCandidateCoreV1(
  rootInput: string,
): Promise<SafeGitDescriptorBoundBootstrapCandidateV1> {
  const nodes = new Map<string, BoundNodeV1>();
  const absentPaths: string[] = [];
  let nativeBinding: NativeSafeGitDescriptorBindingV1 | undefined;
  let nativeBindingTransferred = false;
  try {
    const uid = effectiveUidV1();
    if (typeof rootInput !== "string" || rootInput.length === 0) {
      throw new SafeGitBootstrapErrorV1("invalid_root");
    }
    const hooks = getSafeGitBootstrapTestHooksInternalV1(rootInput);
    const requestedRoot = safeAbsolutePathV1(rootInput);
    const requestedRootStat = await lstatBigIntV1(requestedRoot);
    if (requestedRootStat.isSymbolicLink()) {
      throw new SafeGitBootstrapErrorV1("symlink_detected");
    }
    if (!requestedRootStat.isDirectory()) {
      throw new SafeGitBootstrapErrorV1("invalid_root");
    }
    await hooks.afterRootObserved?.();
    const canonicalRoot = safeAbsolutePathV1(await fs.realpath(requestedRoot));
    const root = await bindDirectoryChainV1(canonicalRoot, nodes);
    if (!sameOpenedNodeV1(requestedRootStat, root.opened, "directory")) {
      throw new SafeGitBootstrapErrorV1("binding_changed");
    }
    assertOwnerSafeV1(root, uid);

    const dotGitPath = join(canonicalRoot, ".git");
    const dotGitStat = await lstatBigIntV1(dotGitPath);
    if (dotGitStat.isSymbolicLink()) {
      throw new SafeGitBootstrapErrorV1("symlink_detected");
    }
    await hooks.afterDotGitObserved?.();

    let layout: SafeGitDescriptorBootstrapInspectionV1["layout"];
    if (dotGitStat.isDirectory()) {
      const gitDirectory = await bindDirectoryChainV1(dotGitPath, nodes);
      if (!sameOpenedNodeV1(dotGitStat, gitDirectory.opened, "directory")) {
        throw new SafeGitBootstrapErrorV1("binding_changed");
      }
      assertOwnerSafeV1(gitDirectory, uid);
      const commondirPath = join(dotGitPath, "commondir");
      const reverseGitdirPath = join(dotGitPath, "gitdir");
      await assertAbsentV1(commondirPath);
      await assertAbsentV1(reverseGitdirPath);
      absentPaths.push(commondirPath, reverseGitdirPath);
      layout = "ordinary";
    } else if (dotGitStat.isFile()) {
      const dotGitFile = await bindFileV1(dotGitPath, nodes);
      if (!sameOpenedNodeV1(dotGitStat, dotGitFile.opened, "file")) {
        throw new SafeGitBootstrapErrorV1("binding_changed");
      }
      assertOwnerSafeV1(dotGitFile, uid);
      const gitDirectory = resolvePointerV1(
        canonicalRoot,
        parseDotGitPointerV1(await readBoundPointerV1(dotGitFile)),
      );
      let gitDirectoryNode: BoundNodeV1;
      try {
        gitDirectoryNode = await bindDirectoryChainV1(gitDirectory, nodes);
      } catch (error) {
        if (isErrnoV1(error, "ENOENT")) {
          throw new SafeGitBootstrapErrorV1("external_git_target");
        }
        throw error;
      }
      assertOwnerSafeV1(gitDirectoryNode, uid);

      const commonPointerPath = join(gitDirectory, "commondir");
      let commonPointer: BoundNodeV1;
      try {
        commonPointer = await bindFileV1(commonPointerPath, nodes);
      } catch (error) {
        if (isErrnoV1(error, "ENOENT")) {
          throw new SafeGitBootstrapErrorV1("external_git_target");
        }
        throw error;
      }
      assertOwnerSafeV1(commonPointer, uid);
      const commonGitDirectory = resolvePointerV1(
        gitDirectory,
        parsePathPointerV1(await readBoundPointerV1(commonPointer)),
      );
      const commonGitNode = await bindDirectoryChainV1(commonGitDirectory, nodes);
      assertOwnerSafeV1(commonGitNode, uid);

      const gitDirectoryRelative = relative(commonGitDirectory, gitDirectory);
      const gitDirectorySegments = gitDirectoryRelative.split(sep);
      if (
        gitDirectorySegments.length !== 2 ||
        gitDirectorySegments[0] !== "worktrees" ||
        gitDirectorySegments[1] === undefined ||
        gitDirectorySegments[1].length === 0 ||
        gitDirectorySegments[1] === "." ||
        gitDirectorySegments[1] === ".." ||
        Buffer.byteLength(gitDirectorySegments[1], "utf8") > 255
      ) {
        throw new SafeGitBootstrapErrorV1("external_git_target");
      }
      const worktreesNode = await bindDirectoryChainV1(
        join(commonGitDirectory, "worktrees"),
        nodes,
      );
      assertOwnerSafeV1(worktreesNode, uid);

      const reversePointer = await bindFileV1(join(gitDirectory, "gitdir"), nodes);
      assertOwnerSafeV1(reversePointer, uid);
      const reverseDotGitPath = resolvePointerV1(
        gitDirectory,
        parsePathPointerV1(await readBoundPointerV1(reversePointer)),
      );
      if (reverseDotGitPath !== dotGitPath) {
        throw new SafeGitBootstrapErrorV1("backpointer_mismatch");
      }
      layout = "linked_worktree";
    } else {
      throw new SafeGitBootstrapErrorV1("unsafe_file_kind");
    }

    await hooks.afterBindingsOpened?.();
    await validateBindingsV1(
      nodes,
      absentPaths,
      requestedRoot,
      root.opened,
    );
    const nativeBootstrap = openNativeSafeGitDescriptorBootstrapV1(canonicalRoot);
    nativeBinding = nativeBootstrap.binding;
    if (nativeBootstrap.layout !== layout) {
      throw new SafeGitBootstrapErrorV1("binding_changed");
    }
    await hooks.afterNativeBindingOpened?.();
    await validateBindingsV1(
      nodes,
      absentPaths,
      requestedRoot,
      root.opened,
    );
    await Promise.all(
      [...nodes.values()].map(async (node) => node.handle.close()),
    );
    nodes.clear();
    await hooks.afterLegacyBindingsClosed?.();
    try {
      if (
        revalidateNativeSafeGitDescriptorBootstrapV1(nativeBinding) !==
        nativeBootstrap.layout
      ) {
        throw new SafeGitBootstrapErrorV1("binding_changed");
      }
    } catch {
      throw new SafeGitBootstrapErrorV1("binding_changed");
    }
    const capability = new SafeGitBootstrapCapabilityInternalV1(
      nativeBinding,
      nativeBootstrap.layout,
    );
    nativeBindingTransferred = true;
    return Object.freeze({ capability, inspection: inspectionV1(layout) });
  } catch (error) {
    if (nativeBinding !== undefined && !nativeBindingTransferred) {
      try {
        closeNativeSafeGitDescriptorBootstrapV1(nativeBinding);
      } catch {
        // The public failure remains path-redacted and fail-closed.
      }
    }
    await Promise.all(
      [...nodes.values()].map(async (node) => node.handle.close().catch(() => undefined)),
    );
    if (error instanceof SafeGitBootstrapErrorV1) throw error;
    if (isErrnoV1(error, "ENOENT") || isErrnoV1(error, "ENOTDIR")) {
      throw new SafeGitBootstrapErrorV1("filesystem_binding_invalid");
    }
    if (isErrnoV1(error, "ELOOP")) {
      throw new SafeGitBootstrapErrorV1("symlink_detected");
    }
    throw new SafeGitBootstrapErrorV1("filesystem_binding_invalid");
  }
}

/**
 * Verifies only the filesystem bootstrap needed before SafeGit identity exists.
 * It never launches Git and deliberately does not authorize execution or writes.
 */
export async function bootstrapSafeGitDescriptorBoundCandidateV1(
  root: string,
): Promise<SafeGitDescriptorBoundBootstrapCandidateV1> {
  return bootstrapSafeGitDescriptorBoundCandidateCoreV1(root);
}
