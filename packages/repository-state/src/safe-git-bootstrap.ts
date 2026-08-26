import { constants, promises as fs } from "node:fs";
import { createHash } from "node:crypto";
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
import { TextDecoder, types as utilTypes } from "node:util";

import {
  bindNativeSafeGitRepositoryControlV1,
  closeNativeSafeGitDescriptorBootstrapV1,
  openNativeSafeGitDescriptorBootstrapV1,
  revalidateNativeSafeGitDescriptorBootstrapV1,
  type NativeSafeGitDescriptorBindingV1,
  type NativeSafeGitDescriptorLayoutV1,
  type NativeSafeGitPathIdentityV1,
  type NativeSafeGitRepositoryControlInspectionV1,
  type NativeSafeGitVersionV1,
} from "@understand-code/native-kernel-bridge";
import {
  PathSafeRepositoryIdV1Schema,
  PathSafeRepositorySnapshotIdV1Schema,
  PathSafeRootIdentityV1Schema,
  PathSafeWorktreeIdV1Schema,
  TaskIdSchema,
  canonicalizeJson,
  type PathSafeRepositoryIdV1,
  type PathSafeRootIdentityV1,
  type PathSafeWorktreeIdV1,
} from "@understand-code/contracts";
import {
  bindProviderAcceptanceSafeGitEmptyHooksDirectoryInternalV1,
  bindProviderAcceptanceSafeGitExecutableInternalV1,
  deriveProviderAcceptanceSafeGitPathIdentityInternalV1,
  executeProviderAcceptanceSafeGitReadInternalV1,
  createProviderAcceptanceSafeGitTaskBaselineLeaseInternalV1,
  recoverProviderAcceptanceSafeGitTaskBaselineLeaseInternalV1,
  rollbackProviderAcceptanceSafeGitTaskBaselineLeaseInternalV1,
  executeProviderAcceptanceSafeGitVersionInternalV1,
} from "@understand-code/durable-object-provider-authority/internal/acceptance-store";

import { getSafeGitBootstrapTestHooksInternalV1 } from "./safe-git-bootstrap-testing-internal.js";
import type {
  SafeGitReadCommandV1,
  SafeGitReadExecutorV1,
  SafeGitReadRequestV1,
} from "./safe-git-read-command.js";
import { classifySafeGitReadCommandV1 } from "./safe-git-read-command.js";

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
export const SAFE_GIT_REPOSITORY_IDENTITY_PROFILE_V1 =
  "descriptor_bound_safe_git_repository_identity_v1" as const;
export const SAFE_GIT_REPOSITORY_IDENTITY_REQUIRED_NEXT_V1 = Object.freeze([
  "empty_hooks_directory",
  "handle_bound_execution",
  "os_sandbox",
  "strong_writer",
] as const);
export const SAFE_GIT_EMPTY_HOOKS_PROFILE_V1 =
  "descriptor_bound_safe_git_empty_hooks_v1" as const;
export const SAFE_GIT_EMPTY_HOOKS_REQUIRED_NEXT_V1 = Object.freeze([
  "handle_bound_execution",
  "os_sandbox",
  "strong_writer",
] as const);
export const SAFE_GIT_EXECUTABLE_BINDING_PROFILE_V1 =
  "descriptor_bound_safe_git_executable_binding_v1" as const;
export const SAFE_GIT_EXECUTABLE_BINDING_REQUIRED_NEXT_V1 = Object.freeze([
  "git_version_diagnostic",
  "handle_bound_execution",
  "os_sandbox",
  "strong_writer",
] as const);
export const SAFE_GIT_VERSION_PROBE_PROFILE_V1 =
  "descriptor_bound_safe_git_version_probe_v1" as const;
export const SAFE_GIT_VERSION_PROBE_REQUIRED_NEXT_V1 = Object.freeze([
  "remaining_safe_git_commands",
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
  | "repository_identity_invalid"
  | "empty_hooks_directory_invalid"
  | "executable_binding_invalid"
  | "version_execution_invalid"
  | "read_execution_invalid"
  | "lease_execution_invalid"
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
    repository_identity_invalid:
      "repository identity authority is unavailable or could not be verified",
    empty_hooks_directory_invalid:
      "SafeGit empty-hooks authority is unavailable or could not be verified",
    executable_binding_invalid:
      "SafeGit executable authority is unavailable or could not be verified",
    version_execution_invalid:
      "SafeGit version execution authority is unavailable or could not be verified",
    read_execution_invalid:
      "SafeGit read execution authority is unavailable or could not be verified",
    lease_execution_invalid:
      "SafeGit Task baseline lease authority is unavailable or could not be verified",
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

/** Descriptor-bound control proof promoted with installation-keyed identities. */
export interface SafeGitRepositoryIdentityInspectionV1
  extends Omit<
    SafeGitRepositoryControlInspectionV1,
    "profile" | "hmacIdentity" | "requiredNext"
  > {
  readonly profile: typeof SAFE_GIT_REPOSITORY_IDENTITY_PROFILE_V1;
  readonly repositoryId: PathSafeRepositoryIdV1;
  readonly worktreeId: PathSafeWorktreeIdV1;
  readonly rootIdentity: PathSafeRootIdentityV1;
  readonly hmacIdentity: "verified";
  readonly requiredNext: readonly [
    "empty_hooks_directory",
    "handle_bound_execution",
    "os_sandbox",
    "strong_writer",
  ];
}

/** Repository identity promoted with an installation-pinned, exactly empty hooks authority. */
export interface SafeGitEmptyHooksInspectionV1
  extends Omit<
    SafeGitRepositoryIdentityInspectionV1,
    "profile" | "emptyHooksDirectory" | "requiredNext"
  > {
  readonly profile: typeof SAFE_GIT_EMPTY_HOOKS_PROFILE_V1;
  readonly emptyHooksDirectory: "verified";
  readonly requiredNext: readonly [
    "handle_bound_execution",
    "os_sandbox",
    "strong_writer",
  ];
}

/** Empty-hooks authority promoted with one native-bound Git executable. */
export interface SafeGitExecutableBindingInspectionV1
  extends Omit<SafeGitEmptyHooksInspectionV1, "profile" | "requiredNext"> {
  readonly profile: typeof SAFE_GIT_EXECUTABLE_BINDING_PROFILE_V1;
  readonly executableBinding: "verified";
  readonly gitVersion: "locked";
  readonly requiredNext: readonly [
    "git_version_diagnostic",
    "handle_bound_execution",
    "os_sandbox",
    "strong_writer",
  ];
}

/** A real, handle-bound and OS-contained execution of the bootstrap version probe. */
export interface SafeGitVersionProbeInspectionV1
  extends Omit<
    SafeGitExecutableBindingInspectionV1,
    | "profile"
    | "gitVersion"
    | "handleBoundExecution"
    | "osSandbox"
    | "requiredNext"
  > {
  readonly profile: typeof SAFE_GIT_VERSION_PROBE_PROFILE_V1;
  readonly gitVersion: NativeSafeGitVersionV1;
  readonly handleBoundExecution: "verified_version_probe";
  readonly osSandbox: "verified_version_probe";
  readonly requiredNext: readonly [
    "remaining_safe_git_commands",
    "strong_writer",
  ];
}

export type SafeGitDescriptorBoundInspectionV1 =
  | SafeGitDescriptorBootstrapInspectionV1
  | SafeGitRepositoryControlInspectionV1
  | SafeGitRepositoryIdentityInspectionV1
  | SafeGitEmptyHooksInspectionV1
  | SafeGitExecutableBindingInspectionV1
  | SafeGitVersionProbeInspectionV1;

export interface SafeGitDescriptorBoundCapabilityV1 {
  readonly profile: typeof SAFE_GIT_DESCRIPTOR_BOOTSTRAP_PROFILE_V1;
  readonly closed: boolean;
  bindRepositoryControl(): Promise<SafeGitRepositoryControlInspectionV1>;
  bindRepositoryIdentity(): Promise<SafeGitRepositoryIdentityInspectionV1>;
  bindEmptyHooksDirectory(): Promise<SafeGitEmptyHooksInspectionV1>;
  bindGitExecutable(
    absoluteExecutablePath: string,
  ): Promise<SafeGitExecutableBindingInspectionV1>;
  executeGitVersion(): Promise<SafeGitVersionProbeInspectionV1>;
  createReadExecutor(): SafeGitReadExecutorV1;
  executeGitObjectType(objectId: string): Promise<"blob" | "tree" | "commit">;
  createTaskBaselineLease(
    request: SafeGitTaskBaselineLeaseCreateRequestV1,
  ): Promise<SafeGitTaskBaselineLeaseV1>;
  recoverTaskBaselineLease(
    request: SafeGitTaskBaselineLeaseCreateRequestV1,
  ): Promise<SafeGitTaskBaselineLeaseV1>;
  rollbackTaskBaselineLease(
    request: SafeGitTaskBaselineLeaseCreateRequestV1,
  ): Promise<SafeGitTaskBaselineLeaseV1>;
  revalidate(): Promise<SafeGitDescriptorBoundInspectionV1>;
  close(): Promise<void>;
}

export interface SafeGitTaskBaselineLeaseCreateRequestV1 {
  readonly taskId: string;
  readonly baselineSnapshotId: string;
  readonly commit: string;
  readonly expectedAbsent: true;
  readonly markerNonce: string;
  readonly markerContentDigest: `sha256:${string}`;
}

export interface SafeGitTaskBaselineLeaseV1 {
  readonly resolution: "created" | "replayed" | "rolled_back";
  readonly leaseId: `git-lease:${string}`;
  readonly refName: `refs/understand-code/task-baselines/${string}`;
  readonly objectId: string;
}

export interface SafeGitTaskBaselineLeaseIntentV1
  extends Omit<SafeGitTaskBaselineLeaseV1, "resolution"> {
  readonly profile: "task_baseline_git_lease_plan_v1";
  readonly repositoryId: PathSafeRepositoryIdV1;
  readonly worktreeId: PathSafeWorktreeIdV1;
  readonly taskId: string;
  readonly baselineSnapshotId: string;
  readonly objectFormat: "sha1" | "sha256";
  readonly markerNonce: string;
  readonly expectedOldObjectId: string;
  readonly refPreexisting: false;
  readonly reflogPreexisting: false;
  readonly reflogRelativePath: string;
  readonly markerRelativePath: string;
  readonly gitLease: Readonly<{
    readonly baselineSnapshotId: string;
    readonly commit: string;
    readonly expectedOldObjectId: string;
    readonly leaseId: `git-lease:${string}`;
    readonly markerNonce: string;
    readonly objectFormat: "sha1" | "sha256";
    readonly profile: "task_baseline_git_lease_plan_v1";
    readonly refName: `refs/understand-code/task-baselines/${string}`;
    readonly refPreexisting: false;
    readonly reflogPreexisting: false;
    readonly reflogRelativePath: string;
    readonly repositoryId: PathSafeRepositoryIdV1;
    readonly taskId: string;
    readonly worktreeId: PathSafeWorktreeIdV1;
  }>;
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

const SAFE_GIT_READ_COMMAND_KEYS_V1 = Object.freeze([
  "acceptedExitCodes",
  "outputFraming",
  "request",
  "stderrLimitBytes",
  "stdoutLimitBytes",
] as const);
const SAFE_GIT_LEASE_REQUEST_KEYS_V1 = Object.freeze([
  "baselineSnapshotId",
  "commit",
  "expectedAbsent",
  "markerContentDigest",
  "markerNonce",
  "taskId",
] as const);
const LOWER_HEX_32_V1 = /^[0-9a-f]{32}$/u;
const LOWER_HEX_40_OR_64_V1 = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const CONTENT_DIGEST_V1 = /^sha256:[0-9a-f]{64}$/u;

function sha256HexV1(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Builds the one canonical marker that Artifact Store must durably publish
 * before asking the descriptor-bound capability to create the Git lease.
 */
export function createSafeGitTaskBaselineLeaseIntentV1(input: Readonly<{
  readonly repositoryId: string;
  readonly worktreeId: string;
  readonly taskId: string;
  readonly baselineSnapshotId: string;
  readonly objectFormat: "sha1" | "sha256";
  readonly commit: string;
  readonly markerNonce: string;
}>): SafeGitTaskBaselineLeaseIntentV1 {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input) ||
    utilTypes.isProxy(input) ||
    (Object.getPrototypeOf(input) !== Object.prototype &&
      Object.getPrototypeOf(input) !== null)
  ) {
    throw new SafeGitBootstrapErrorV1("lease_execution_invalid");
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = Reflect.ownKeys(input);
  const expectedKeys = [
    "baselineSnapshotId",
    "commit",
    "markerNonce",
    "objectFormat",
    "repositoryId",
    "taskId",
    "worktreeId",
  ];
  if (
    keys.some((key) => typeof key !== "string") ||
    (keys as string[]).sort().join("\0") !== expectedKeys.join("\0") ||
    expectedKeys.some((key) => {
      const descriptor = descriptors[key];
      return descriptor === undefined || !("value" in descriptor) ||
        descriptor.get !== undefined || descriptor.set !== undefined;
    })
  ) {
    throw new SafeGitBootstrapErrorV1("lease_execution_invalid");
  }
  try {
    const repositoryId = PathSafeRepositoryIdV1Schema.parse(
      descriptors.repositoryId!.value,
    );
    const worktreeId = PathSafeWorktreeIdV1Schema.parse(
      descriptors.worktreeId!.value,
    );
    const taskId = TaskIdSchema.parse(descriptors.taskId!.value);
    const baselineSnapshotId = PathSafeRepositorySnapshotIdV1Schema.parse(
      descriptors.baselineSnapshotId!.value,
    );
    const objectFormat = descriptors.objectFormat!.value;
    const commit = descriptors.commit!.value;
    const markerNonce = descriptors.markerNonce!.value;
    if (
      (objectFormat !== "sha1" && objectFormat !== "sha256") ||
      typeof commit !== "string" ||
      !LOWER_HEX_40_OR_64_V1.test(commit) ||
      commit.length !== (objectFormat === "sha1" ? 40 : 64) ||
      typeof markerNonce !== "string" ||
      !LOWER_HEX_32_V1.test(markerNonce)
    ) {
      throw new Error("invalid lease identity input");
    }
    const leaseHex = sha256HexV1(
      canonicalizeJson([
        "git-lease-v1",
        {
          baselineSnapshotId,
          commit,
          objectFormat,
          repositoryId,
          taskId,
          worktreeId,
        },
      ]),
    ).slice(0, 22);
    const leaseId = `git-lease:${leaseHex}` as const;
    const refName =
      `refs/understand-code/task-baselines/${leaseHex}-${markerNonce}` as const;
    const expectedOldObjectId = "0".repeat(commit.length);
    const reflogRelativePath = `logs/${refName}`;
    const markerPayload = Object.freeze({
      baselineSnapshotId,
      commit,
      expectedOldObjectId,
      leaseId,
      markerNonce,
      objectFormat,
      profile: "task_baseline_git_lease_plan_v1" as const,
      refName,
      refPreexisting: false as const,
      reflogPreexisting: false as const,
      reflogRelativePath,
      repositoryId,
      taskId,
      worktreeId,
    });
    return Object.freeze({
      ...markerPayload,
      objectId: commit,
      gitLease: markerPayload,
      markerRelativePath:
        `.understand-code/.recovery/task-baseline-transactions/${taskId}-${markerNonce}.json`,
    });
  } catch (error) {
    if (error instanceof SafeGitBootstrapErrorV1) throw error;
    throw new SafeGitBootstrapErrorV1("lease_execution_invalid");
  }
}

function safeGitLeaseRequestV1(
  request: SafeGitTaskBaselineLeaseCreateRequestV1,
): SafeGitTaskBaselineLeaseCreateRequestV1 {
  if (
    typeof request !== "object" ||
    request === null ||
    Array.isArray(request) ||
    utilTypes.isProxy(request) ||
    (Object.getPrototypeOf(request) !== Object.prototype &&
      Object.getPrototypeOf(request) !== null)
  ) {
    throw new SafeGitBootstrapErrorV1("lease_execution_invalid");
  }
  const keys = Reflect.ownKeys(request);
  const descriptors = Object.getOwnPropertyDescriptors(request);
  if (
    keys.some((key) => typeof key !== "string") ||
    (keys as string[]).sort().join("\0") !==
      SAFE_GIT_LEASE_REQUEST_KEYS_V1.join("\0") ||
    SAFE_GIT_LEASE_REQUEST_KEYS_V1.some((key) => {
      const descriptor = descriptors[key];
      return descriptor === undefined || !("value" in descriptor) ||
        descriptor.get !== undefined || descriptor.set !== undefined;
    })
  ) {
    throw new SafeGitBootstrapErrorV1("lease_execution_invalid");
  }
  const taskId = descriptors.taskId!.value;
  const baselineSnapshotId = descriptors.baselineSnapshotId!.value;
  const commit = descriptors.commit!.value;
  const expectedAbsent = descriptors.expectedAbsent!.value;
  const markerNonce = descriptors.markerNonce!.value;
  const markerContentDigest = descriptors.markerContentDigest!.value;
  let parsedTaskId: string;
  let parsedBaselineSnapshotId: string;
  try {
    parsedTaskId = TaskIdSchema.parse(taskId);
    parsedBaselineSnapshotId = PathSafeRepositorySnapshotIdV1Schema.parse(
      baselineSnapshotId,
    );
  } catch {
    throw new SafeGitBootstrapErrorV1("lease_execution_invalid");
  }
  if (
    typeof commit !== "string" ||
    !LOWER_HEX_40_OR_64_V1.test(commit) ||
    expectedAbsent !== true ||
    typeof markerNonce !== "string" ||
    !LOWER_HEX_32_V1.test(markerNonce) ||
    typeof markerContentDigest !== "string" ||
    !CONTENT_DIGEST_V1.test(markerContentDigest)
  ) {
    throw new SafeGitBootstrapErrorV1("lease_execution_invalid");
  }
  return Object.freeze({
    taskId: parsedTaskId!,
    baselineSnapshotId: parsedBaselineSnapshotId!,
    commit,
    expectedAbsent: true,
    markerNonce,
    markerContentDigest,
  });
}

function safeGitReadRequestFromCommandV1(
  command: SafeGitReadCommandV1,
): SafeGitReadRequestV1 {
  if (
    typeof command !== "object" ||
    command === null ||
    Array.isArray(command) ||
    utilTypes.isProxy(command)
  ) {
    throw new SafeGitBootstrapErrorV1("read_execution_invalid");
  }
  const prototype = Object.getPrototypeOf(command);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new SafeGitBootstrapErrorV1("read_execution_invalid");
  }
  const keys = Reflect.ownKeys(command);
  if (
    keys.some((key) => typeof key !== "string") ||
    (keys as string[]).sort().join("\0") !==
      SAFE_GIT_READ_COMMAND_KEYS_V1.join("\0")
  ) {
    throw new SafeGitBootstrapErrorV1("read_execution_invalid");
  }
  const descriptors = Object.getOwnPropertyDescriptors(command);
  for (const key of SAFE_GIT_READ_COMMAND_KEYS_V1) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined
    ) {
      throw new SafeGitBootstrapErrorV1("read_execution_invalid");
    }
  }
  return descriptors.request!.value as SafeGitReadRequestV1;
}

function safeGitReadAbortSignalV1(
  options: Readonly<{ readonly signal?: AbortSignal }> | undefined,
): AbortSignal | undefined {
  if (options === undefined) return undefined;
  if (
    typeof options !== "object" ||
    options === null ||
    Array.isArray(options) ||
    utilTypes.isProxy(options)
  ) {
    throw new SafeGitBootstrapErrorV1("read_execution_invalid");
  }
  const prototype = Object.getPrototypeOf(options);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new SafeGitBootstrapErrorV1("read_execution_invalid");
  }
  const keys = Reflect.ownKeys(options);
  if (
    keys.some((key) => typeof key !== "string") ||
    keys.length > 1 ||
    (keys.length === 1 && keys[0] !== "signal")
  ) {
    throw new SafeGitBootstrapErrorV1("read_execution_invalid");
  }
  if (keys.length === 0) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(options, "signal");
  if (
    descriptor === undefined ||
    !("value" in descriptor) ||
    descriptor.get !== undefined ||
    descriptor.set !== undefined
  ) {
    throw new SafeGitBootstrapErrorV1("read_execution_invalid");
  }
  const signal = descriptor.value;
  if (signal === undefined) return undefined;
  if (
    typeof signal !== "object" ||
    signal === null ||
    utilTypes.isProxy(signal) ||
    Object.getPrototypeOf(signal) !== AbortSignal.prototype
  ) {
    throw new SafeGitBootstrapErrorV1("read_execution_invalid");
  }
  return signal as AbortSignal;
}

function isSafeGitReadAbortedV1(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

class SafeGitBootstrapCapabilityInternalV1
  implements SafeGitDescriptorBoundCapabilityV1
{
  readonly profile = SAFE_GIT_DESCRIPTOR_BOOTSTRAP_PROFILE_V1;
  #binding: NativeSafeGitDescriptorBindingV1 | undefined;
  readonly #layout: NativeSafeGitDescriptorLayoutV1;
  #repositoryControl: NativeSafeGitRepositoryControlInspectionV1 | undefined;
  #pathIdentity: NativeSafeGitPathIdentityV1 | undefined;
  #emptyHooksBinding:
    | Awaited<
      ReturnType<
        typeof bindProviderAcceptanceSafeGitEmptyHooksDirectoryInternalV1
      >
    >
    | undefined;
  #executableBound = false;
  #gitVersion: NativeSafeGitVersionV1 | undefined;
  #readExecutor: SafeGitReadExecutorV1 | undefined;
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

  async bindRepositoryIdentity(): Promise<SafeGitRepositoryIdentityInspectionV1> {
    const binding = this.#binding;
    const control = this.#repositoryControl;
    if (
      this.#closed || !this.#usable || binding === undefined ||
      control === undefined
    ) {
      throw new SafeGitBootstrapErrorV1("repository_identity_invalid");
    }
    try {
      const pathIdentity =
        await deriveProviderAcceptanceSafeGitPathIdentityInternalV1(binding);
      validatePathIdentityV1(pathIdentity);
      this.#pathIdentity = pathIdentity;
      return repositoryIdentityInspectionV1(
        this.#layout,
        control,
        pathIdentity,
      );
    } catch {
      this.#poisonBinding(binding);
      throw new SafeGitBootstrapErrorV1("repository_identity_invalid");
    }
  }

  async bindEmptyHooksDirectory(): Promise<SafeGitEmptyHooksInspectionV1> {
    const binding = this.#binding;
    const control = this.#repositoryControl;
    const pathIdentity = this.#pathIdentity;
    if (
      this.#closed || !this.#usable || binding === undefined ||
      control === undefined || pathIdentity === undefined
    ) {
      throw new SafeGitBootstrapErrorV1("empty_hooks_directory_invalid");
    }
    try {
      if (
        revalidateNativeSafeGitDescriptorBootstrapV1(binding) !== this.#layout
      ) {
        throw new SafeGitBootstrapErrorV1("binding_changed");
      }
      const currentIdentity =
        await deriveProviderAcceptanceSafeGitPathIdentityInternalV1(binding);
      validatePathIdentityV1(currentIdentity);
      if (!samePathIdentityV1(pathIdentity, currentIdentity)) {
        throw new SafeGitBootstrapErrorV1("binding_changed");
      }
      const emptyHooksBinding =
        await bindProviderAcceptanceSafeGitEmptyHooksDirectoryInternalV1(
          binding,
        );
      validateEmptyHooksBindingV1(emptyHooksBinding);
      if (
        this.#emptyHooksBinding !== undefined &&
        !sameEmptyHooksBindingV1(this.#emptyHooksBinding, emptyHooksBinding)
      ) {
        throw new SafeGitBootstrapErrorV1("binding_changed");
      }
      this.#emptyHooksBinding = emptyHooksBinding;
      return emptyHooksInspectionV1(
        this.#layout,
        control,
        pathIdentity,
      );
    } catch {
      this.#poisonBinding(binding);
      throw new SafeGitBootstrapErrorV1("empty_hooks_directory_invalid");
    }
  }

  async bindGitExecutable(
    absoluteExecutablePath: string,
  ): Promise<SafeGitExecutableBindingInspectionV1> {
    const binding = this.#binding;
    const control = this.#repositoryControl;
    const pathIdentity = this.#pathIdentity;
    const emptyHooksBinding = this.#emptyHooksBinding;
    if (
      this.#closed || !this.#usable || binding === undefined ||
      control === undefined || pathIdentity === undefined ||
      emptyHooksBinding === undefined ||
      typeof absoluteExecutablePath !== "string" ||
      !isAbsolute(absoluteExecutablePath)
    ) {
      throw new SafeGitBootstrapErrorV1("executable_binding_invalid");
    }
    try {
      const current = await this.#revalidateThroughEmptyHooks(binding);
      if (current.profile !== SAFE_GIT_EMPTY_HOOKS_PROFILE_V1) {
        throw new SafeGitBootstrapErrorV1("binding_changed");
      }
      const executableBinding =
        await bindProviderAcceptanceSafeGitExecutableInternalV1(
          binding,
          absoluteExecutablePath,
        );
      validateExecutableBindingV1(executableBinding);
      this.#executableBound = true;
      return executableBindingInspectionV1(
        this.#layout,
        control,
        pathIdentity,
      );
    } catch {
      this.#poisonBinding(binding);
      throw new SafeGitBootstrapErrorV1("executable_binding_invalid");
    }
  }

  async executeGitVersion(): Promise<SafeGitVersionProbeInspectionV1> {
    const binding = this.#binding;
    if (
      this.#closed || !this.#usable || binding === undefined ||
      !this.#executableBound || this.#repositoryControl === undefined ||
      this.#pathIdentity === undefined || this.#emptyHooksBinding === undefined
    ) {
      throw new SafeGitBootstrapErrorV1("version_execution_invalid");
    }
    try {
      const version =
        await executeProviderAcceptanceSafeGitVersionInternalV1(binding);
      validateGitVersionV1(version);
      this.#gitVersion = version;
      return versionProbeInspectionV1(
        this.#layout,
        this.#repositoryControl,
        this.#pathIdentity,
        version,
      );
    } catch {
      this.#poisonBinding(binding);
      throw new SafeGitBootstrapErrorV1("version_execution_invalid");
    }
  }

  createReadExecutor(): SafeGitReadExecutorV1 {
    const binding = this.#binding;
    if (
      this.#closed || !this.#usable || binding === undefined ||
      this.#gitVersion === undefined
    ) {
      if (binding !== undefined) this.#poisonBinding(binding);
      throw new SafeGitBootstrapErrorV1("read_execution_invalid");
    }
    if (this.#readExecutor !== undefined) return this.#readExecutor;
    const executor = Object.freeze({
      execute: (
        command: SafeGitReadCommandV1,
        options?: Readonly<{ readonly signal?: AbortSignal }>,
      ) => this.#executeRead(command, options),
    });
    this.#readExecutor = executor;
    return executor;
  }

  async executeGitObjectType(
    objectId: string,
  ): Promise<"blob" | "tree" | "commit"> {
    const binding = this.#binding;
    try {
      if (
        this.#closed || !this.#usable || binding === undefined ||
        this.#gitVersion === undefined ||
        typeof objectId !== "string" || !LOWER_HEX_40_OR_64_V1.test(objectId)
      ) {
        throw new SafeGitBootstrapErrorV1("read_execution_invalid");
      }
      const command = classifySafeGitReadCommandV1([
        "cat-file",
        "-t",
        "--",
        objectId,
      ]);
      const result = await this.#executeRead(command);
      const text = new TextDecoder("utf-8", { fatal: true }).decode(
        result.stdout,
      );
      if (result.exitCode !== 0 || !/^(?:blob|tree|commit)\n$/u.test(text)) {
        throw new SafeGitBootstrapErrorV1("read_execution_invalid");
      }
      return text.slice(0, -1) as "blob" | "tree" | "commit";
    } catch {
      if (binding !== undefined) this.#poisonBinding(binding);
      throw new SafeGitBootstrapErrorV1("read_execution_invalid");
    }
  }

  async createTaskBaselineLease(
    requestValue: SafeGitTaskBaselineLeaseCreateRequestV1,
  ): Promise<SafeGitTaskBaselineLeaseV1> {
    const binding = this.#binding;
    try {
      if (
        this.#closed || !this.#usable || binding === undefined ||
        this.#gitVersion === undefined || this.#repositoryControl === undefined ||
        this.#pathIdentity === undefined
      ) {
        throw new SafeGitBootstrapErrorV1("lease_execution_invalid");
      }
      const request = safeGitLeaseRequestV1(requestValue);
      const intent = createSafeGitTaskBaselineLeaseIntentV1({
        repositoryId: this.#pathIdentity.repositoryId,
        worktreeId: this.#pathIdentity.worktreeId,
        taskId: request.taskId,
        baselineSnapshotId: request.baselineSnapshotId,
        objectFormat: this.#repositoryControl.objectFormat,
        commit: request.commit,
        markerNonce: request.markerNonce,
      });
      const created =
        await createProviderAcceptanceSafeGitTaskBaselineLeaseInternalV1(
          binding,
          request,
        );
      if (
        created.leaseId !== intent.leaseId ||
        created.refName !== intent.refName ||
        created.objectId !== intent.objectId
      ) {
        throw new SafeGitBootstrapErrorV1("lease_execution_invalid");
      }
      return Object.freeze({ ...created });
    } catch {
      if (binding !== undefined) this.#poisonBinding(binding);
      throw new SafeGitBootstrapErrorV1("lease_execution_invalid");
    }
  }

  async recoverTaskBaselineLease(
    requestValue: SafeGitTaskBaselineLeaseCreateRequestV1,
  ): Promise<SafeGitTaskBaselineLeaseV1> {
    const binding = this.#binding;
    try {
      if (
        this.#closed || !this.#usable || binding === undefined ||
        this.#gitVersion === undefined || this.#repositoryControl === undefined ||
        this.#pathIdentity === undefined
      ) {
        throw new SafeGitBootstrapErrorV1("lease_execution_invalid");
      }
      const request = safeGitLeaseRequestV1(requestValue);
      const intent = createSafeGitTaskBaselineLeaseIntentV1({
        repositoryId: this.#pathIdentity.repositoryId,
        worktreeId: this.#pathIdentity.worktreeId,
        taskId: request.taskId,
        baselineSnapshotId: request.baselineSnapshotId,
        objectFormat: this.#repositoryControl.objectFormat,
        commit: request.commit,
        markerNonce: request.markerNonce,
      });
      const recovered =
        await recoverProviderAcceptanceSafeGitTaskBaselineLeaseInternalV1(
          binding,
          request,
        );
      if (
        recovered.leaseId !== intent.leaseId ||
        recovered.refName !== intent.refName ||
        recovered.objectId !== intent.objectId ||
        (recovered.resolution !== "created" &&
          recovered.resolution !== "replayed")
      ) {
        throw new SafeGitBootstrapErrorV1("lease_execution_invalid");
      }
      return Object.freeze({ ...recovered });
    } catch {
      if (binding !== undefined) this.#poisonBinding(binding);
      throw new SafeGitBootstrapErrorV1("lease_execution_invalid");
    }
  }

  async rollbackTaskBaselineLease(
    requestValue: SafeGitTaskBaselineLeaseCreateRequestV1,
  ): Promise<SafeGitTaskBaselineLeaseV1> {
    const binding = this.#binding;
    try {
      if (
        this.#closed || !this.#usable || binding === undefined ||
        this.#gitVersion === undefined || this.#repositoryControl === undefined ||
        this.#pathIdentity === undefined
      ) {
        throw new SafeGitBootstrapErrorV1("lease_execution_invalid");
      }
      const request = safeGitLeaseRequestV1(requestValue);
      const intent = createSafeGitTaskBaselineLeaseIntentV1({
        repositoryId: this.#pathIdentity.repositoryId,
        worktreeId: this.#pathIdentity.worktreeId,
        taskId: request.taskId,
        baselineSnapshotId: request.baselineSnapshotId,
        objectFormat: this.#repositoryControl.objectFormat,
        commit: request.commit,
        markerNonce: request.markerNonce,
      });
      const rolledBack =
        await rollbackProviderAcceptanceSafeGitTaskBaselineLeaseInternalV1(
          binding,
          request,
        );
      if (
        rolledBack.leaseId !== intent.leaseId ||
        rolledBack.refName !== intent.refName ||
        rolledBack.objectId !== intent.objectId ||
        (rolledBack.resolution !== "rolled_back" &&
          rolledBack.resolution !== "replayed")
      ) {
        throw new SafeGitBootstrapErrorV1("lease_execution_invalid");
      }
      return Object.freeze({ ...rolledBack });
    } catch {
      if (binding !== undefined) this.#poisonBinding(binding);
      throw new SafeGitBootstrapErrorV1("lease_execution_invalid");
    }
  }

  async #executeRead(
    command: SafeGitReadCommandV1,
    options?: Readonly<{ readonly signal?: AbortSignal }>,
  ) {
    const binding = this.#binding;
    try {
      if (
        this.#closed || !this.#usable || binding === undefined ||
        this.#gitVersion === undefined
      ) {
        throw new SafeGitBootstrapErrorV1("read_execution_invalid");
      }
      const request = safeGitReadRequestFromCommandV1(command);
      const signal = safeGitReadAbortSignalV1(options);
      if (isSafeGitReadAbortedV1(signal)) {
        throw new SafeGitBootstrapErrorV1("read_execution_invalid");
      }
      const result = await executeProviderAcceptanceSafeGitReadInternalV1(
        binding,
        request,
      );
      if (isSafeGitReadAbortedV1(signal)) {
        throw new SafeGitBootstrapErrorV1("read_execution_invalid");
      }
      return result;
    } catch {
      if (binding !== undefined) this.#poisonBinding(binding);
      throw new SafeGitBootstrapErrorV1("read_execution_invalid");
    }
  }

  async revalidate(): Promise<SafeGitDescriptorBoundInspectionV1> {
    const binding = this.#binding;
    if (this.#closed || !this.#usable || binding === undefined) {
      throw new SafeGitBootstrapErrorV1("binding_changed");
    }
    try {
      const inspection = await this.#revalidateThroughEmptyHooks(binding);
      if (!this.#executableBound) return inspection;
      if (
        inspection.profile !== SAFE_GIT_EMPTY_HOOKS_PROFILE_V1 ||
        this.#repositoryControl === undefined ||
        this.#pathIdentity === undefined ||
        this.#emptyHooksBinding === undefined
      ) {
        throw new SafeGitBootstrapErrorV1("binding_changed");
      }
      const executable = executableBindingInspectionV1(
        this.#layout,
        this.#repositoryControl,
        this.#pathIdentity,
      );
      if (this.#gitVersion === undefined) return executable;
      validateGitVersionV1(this.#gitVersion);
      return versionProbeInspectionV1(
        this.#layout,
        this.#repositoryControl,
        this.#pathIdentity,
        this.#gitVersion,
      );
    } catch {
      this.#poisonBinding(binding);
      throw new SafeGitBootstrapErrorV1("binding_changed");
    }
  }

  async #revalidateThroughEmptyHooks(
    binding: NativeSafeGitDescriptorBindingV1,
  ): Promise<
    | SafeGitDescriptorBootstrapInspectionV1
    | SafeGitRepositoryControlInspectionV1
    | SafeGitRepositoryIdentityInspectionV1
    | SafeGitEmptyHooksInspectionV1
  > {
    const layout = revalidateNativeSafeGitDescriptorBootstrapV1(binding);
    if (layout !== this.#layout) {
      throw new SafeGitBootstrapErrorV1("binding_changed");
    }
    if (this.#repositoryControl === undefined) return inspectionV1(layout);
    const expectedIdentity = this.#pathIdentity;
    if (expectedIdentity === undefined) {
      return repositoryControlInspectionV1(layout, this.#repositoryControl);
    }
    const currentIdentity =
      await deriveProviderAcceptanceSafeGitPathIdentityInternalV1(binding);
    validatePathIdentityV1(currentIdentity);
    if (!samePathIdentityV1(expectedIdentity, currentIdentity)) {
      throw new SafeGitBootstrapErrorV1("binding_changed");
    }
    const expectedEmptyHooksBinding = this.#emptyHooksBinding;
    if (expectedEmptyHooksBinding === undefined) {
      return repositoryIdentityInspectionV1(
        layout,
        this.#repositoryControl,
        expectedIdentity,
      );
    }
    const currentEmptyHooksBinding =
      await bindProviderAcceptanceSafeGitEmptyHooksDirectoryInternalV1(binding);
    validateEmptyHooksBindingV1(currentEmptyHooksBinding);
    if (
      !sameEmptyHooksBindingV1(
        expectedEmptyHooksBinding,
        currentEmptyHooksBinding,
      )
    ) {
      throw new SafeGitBootstrapErrorV1("binding_changed");
    }
    return emptyHooksInspectionV1(
      layout,
      this.#repositoryControl,
      expectedIdentity,
    );
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

function repositoryIdentityInspectionV1(
  layout: SafeGitRepositoryIdentityInspectionV1["layout"],
  control: NativeSafeGitRepositoryControlInspectionV1,
  pathIdentity: NativeSafeGitPathIdentityV1,
): SafeGitRepositoryIdentityInspectionV1 {
  return Object.freeze({
    profile: SAFE_GIT_REPOSITORY_IDENTITY_PROFILE_V1,
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
    repositoryId: PathSafeRepositoryIdV1Schema.parse(pathIdentity.repositoryId),
    worktreeId: PathSafeWorktreeIdV1Schema.parse(pathIdentity.worktreeId),
    rootIdentity: PathSafeRootIdentityV1Schema.parse(pathIdentity.rootIdentity),
    emptyHooksDirectory: "locked",
    handleBoundExecution: "locked",
    osSandbox: "locked",
    hmacIdentity: "verified",
    strongWrites: "locked",
    requiredNext: SAFE_GIT_REPOSITORY_IDENTITY_REQUIRED_NEXT_V1,
  });
}

function emptyHooksInspectionV1(
  layout: SafeGitEmptyHooksInspectionV1["layout"],
  control: NativeSafeGitRepositoryControlInspectionV1,
  pathIdentity: NativeSafeGitPathIdentityV1,
): SafeGitEmptyHooksInspectionV1 {
  const identity = repositoryIdentityInspectionV1(
    layout,
    control,
    pathIdentity,
  );
  return Object.freeze({
    ...identity,
    profile: SAFE_GIT_EMPTY_HOOKS_PROFILE_V1,
    emptyHooksDirectory: "verified",
    requiredNext: SAFE_GIT_EMPTY_HOOKS_REQUIRED_NEXT_V1,
  });
}

function executableBindingInspectionV1(
  layout: SafeGitExecutableBindingInspectionV1["layout"],
  control: NativeSafeGitRepositoryControlInspectionV1,
  pathIdentity: NativeSafeGitPathIdentityV1,
): SafeGitExecutableBindingInspectionV1 {
  const emptyHooks = emptyHooksInspectionV1(layout, control, pathIdentity);
  return Object.freeze({
    ...emptyHooks,
    profile: SAFE_GIT_EXECUTABLE_BINDING_PROFILE_V1,
    executableBinding: "verified",
    gitVersion: "locked",
    requiredNext: SAFE_GIT_EXECUTABLE_BINDING_REQUIRED_NEXT_V1,
  });
}

function versionProbeInspectionV1(
  layout: SafeGitVersionProbeInspectionV1["layout"],
  control: NativeSafeGitRepositoryControlInspectionV1,
  pathIdentity: NativeSafeGitPathIdentityV1,
  gitVersion: NativeSafeGitVersionV1,
): SafeGitVersionProbeInspectionV1 {
  const executable = executableBindingInspectionV1(
    layout,
    control,
    pathIdentity,
  );
  return Object.freeze({
    ...executable,
    profile: SAFE_GIT_VERSION_PROBE_PROFILE_V1,
    gitVersion,
    handleBoundExecution: "verified_version_probe",
    osSandbox: "verified_version_probe",
    requiredNext: SAFE_GIT_VERSION_PROBE_REQUIRED_NEXT_V1,
  });
}

function validateGitVersionV1(version: NativeSafeGitVersionV1): void {
  const keys = Object.keys(version).sort();
  if (
    (keys.join("\0") !== "major\0minor\0patch" &&
      keys.join("\0") !== "major\0minor\0patch\0vendorSuffix") ||
    ![version.major, version.minor, version.patch].every(
      (value) => Number.isSafeInteger(value) && value >= 0,
    ) ||
    (version.vendorSuffix !== undefined &&
      !/^[A-Za-z0-9][A-Za-z0-9 ._()+-]{0,63}$/u.test(version.vendorSuffix))
  ) {
    throw new SafeGitBootstrapErrorV1("version_execution_invalid");
  }
}

function validatePathIdentityV1(
  identity: NativeSafeGitPathIdentityV1,
): void {
  if (
    identity.profile !== "native_safe_git_path_identity_v1" ||
    !PathSafeRepositoryIdV1Schema.safeParse(identity.repositoryId).success ||
    !PathSafeWorktreeIdV1Schema.safeParse(identity.worktreeId).success ||
    !PathSafeRootIdentityV1Schema.safeParse(identity.rootIdentity).success
  ) {
    throw new SafeGitBootstrapErrorV1("repository_identity_invalid");
  }
}

function samePathIdentityV1(
  left: NativeSafeGitPathIdentityV1,
  right: NativeSafeGitPathIdentityV1,
): boolean {
  return left.profile === right.profile &&
    left.repositoryId === right.repositoryId &&
    left.worktreeId === right.worktreeId &&
    left.rootIdentity === right.rootIdentity;
}

type ProviderEmptyHooksBindingV1 = Awaited<
  ReturnType<typeof bindProviderAcceptanceSafeGitEmptyHooksDirectoryInternalV1>
>;

function validateEmptyHooksBindingV1(
  binding: ProviderEmptyHooksBindingV1,
): void {
  if (
    binding.profile !== "native_safe_git_empty_hooks_binding_v1" ||
    binding.directoryIdentity.platform !== "posix" ||
    !/^(0|[1-9][0-9]*)$/u.test(binding.directoryIdentity.device) ||
    !/^(0|[1-9][0-9]*)$/u.test(binding.directoryIdentity.inode) ||
    !/^hmac-sha256:[0-9a-f]{64}$/u.test(
      binding.emptyHooksDirectoryToken,
    )
  ) {
    throw new SafeGitBootstrapErrorV1("empty_hooks_directory_invalid");
  }
}

function sameEmptyHooksBindingV1(
  left: ProviderEmptyHooksBindingV1,
  right: ProviderEmptyHooksBindingV1,
): boolean {
  return left.profile === right.profile &&
    left.directoryIdentity.platform === right.directoryIdentity.platform &&
    left.directoryIdentity.device === right.directoryIdentity.device &&
    left.directoryIdentity.inode === right.directoryIdentity.inode &&
    left.emptyHooksDirectoryToken === right.emptyHooksDirectoryToken;
}

type ProviderExecutableBindingV1 = Awaited<
  ReturnType<typeof bindProviderAcceptanceSafeGitExecutableInternalV1>
>;

function validateExecutableBindingV1(
  binding: ProviderExecutableBindingV1,
): void {
  const keys = Object.keys(binding).sort();
  if (
    keys.length !== 2 ||
    keys[0] !== "executableBinding" ||
    keys[1] !== "profile" ||
    binding.profile !== "native_safe_git_executable_binding_v1" ||
    binding.executableBinding !== "verified"
  ) {
    throw new SafeGitBootstrapErrorV1("executable_binding_invalid");
  }
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
