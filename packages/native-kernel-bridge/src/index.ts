import { createRequire } from "node:module";
import { Socket } from "node:net";
import { isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

export interface ProviderRuntimeNativeKernelPeerCredentialsV1 {
  readonly uid: number;
  readonly gid: number;
  readonly pid: number;
}

export interface ProviderRuntimeNativeFdAccessControlOptionsV1 {
  readonly expectedKind: "directory" | "regular-file";
}

export type NativeSafeGitDescriptorLayoutV1 =
  | "ordinary"
  | "linked_worktree";

declare const nativeSafeGitDescriptorBindingBrandV1: unique symbol;

/**
 * Process-local authority over native-owned repository descriptors. The value
 * cannot be constructed from paths, descriptors, or serialized request data.
 */
export interface NativeSafeGitDescriptorBindingV1 {
  readonly [nativeSafeGitDescriptorBindingBrandV1]: true;
}

export interface NativeSafeGitDescriptorBootstrapResultV1 {
  readonly binding: NativeSafeGitDescriptorBindingV1;
  readonly layout: NativeSafeGitDescriptorLayoutV1;
}

export interface NativeSafeGitRepositoryControlInspectionV1 {
  readonly profile: "native_safe_git_repository_control_v1";
  readonly objectFormat: "sha1" | "sha256";
  readonly objectDatabase: "local_only_verified";
  readonly refBackend: "files_verified";
  readonly repositoryConfig: "verified";
  readonly worktreeConfig: "absent" | "verified";
}

export type NativeSafeGitRepositoryIdV1 = `repo-hmac-${string}`;
export type NativeSafeGitWorktreeIdV1 = `worktree-hmac-${string}`;
export type NativeSafeGitRootIdentityV1 = `root-hmac-${string}`;

export interface NativeSafeGitPathIdentityV1 {
  readonly profile: "native_safe_git_path_identity_v1";
  readonly repositoryId: NativeSafeGitRepositoryIdV1;
  readonly worktreeId: NativeSafeGitWorktreeIdV1;
  readonly rootIdentity: NativeSafeGitRootIdentityV1;
}

export interface NativeInstallationStateRootV1 {
  readonly profile: "native_installation_state_resolver_v1";
  readonly resolverId:
    | "darwin-user-domain-application-support-v1"
    | "linux-getpwuid-effective-user-state-v1";
  /** Internal trusted locator; callers must not project or log this value. */
  readonly root: string;
  readonly uid: number;
  readonly gid: number;
}

export type NativeInstallationIdentityArtifactV1 =
  | "key"
  | "state"
  | "init"
  | "init_stage";

export interface NativeInstallationStateRootIdentityV1 {
  readonly platform: "posix";
  readonly device: string;
  readonly inode: string;
}

export interface NativeInstallationEmptyHooksDirectoryInspectionV1 {
  readonly profile: "native_installation_empty_hooks_directory_v1";
  readonly directoryIdentity: NativeInstallationStateRootIdentityV1;
}

export type NativeSafeGitEmptyHooksDirectoryTokenV1 =
  `hmac-sha256:${string}`;

export interface NativeSafeGitEmptyHooksDirectoryBindingV1 {
  readonly profile: "native_safe_git_empty_hooks_binding_v1";
  readonly directoryIdentity: NativeInstallationStateRootIdentityV1;
  readonly emptyHooksDirectoryToken: NativeSafeGitEmptyHooksDirectoryTokenV1;
}

export interface NativeSafeGitExecutableBindingInspectionV1 {
  readonly profile: "native_safe_git_executable_binding_v1";
  readonly executableBinding: "verified";
}

declare const nativeInstallationStateAuthorityBrandV1: unique symbol;
export interface NativeInstallationStateAuthorityV1 {
  readonly [nativeInstallationStateAuthorityBrandV1]: true;
}

declare const nativeInstallationInitializationLockBrandV1: unique symbol;
export interface NativeInstallationInitializationLockV1 {
  readonly [nativeInstallationInitializationLockBrandV1]: true;
}

export interface NativeInstallationStateAuthorityOpenOptionsV1 {
  readonly create: boolean;
}

export type NativeTestInstallationStateAuthorityNamespaceRaceV1 =
  | "static_shape"
  | "fresh_shape";

export interface NativeInstallationStateAuthorityOpenResultV1 {
  readonly profile: "native_installation_state_authority_v1";
  readonly authority: NativeInstallationStateAuthorityV1;
  readonly resolverId:
    | "darwin-user-domain-application-support-v1"
    | "linux-getpwuid-effective-user-state-v1"
    | "test-explicit-temporary-root-v1";
  readonly rootCreated: boolean;
  readonly rootIdentity: NativeInstallationStateRootIdentityV1;
  /** Internal HMAC preimage material; never project or log. */
  readonly canonicalStateRootBytes: `base64url:${string}`;
  /** Internal HMAC preimage material for `posix-uid:<euid>`. */
  readonly ownerIdentity: `base64url:${string}`;
}

interface NativeKernelBridgeAddonV1 {
  readonly armTestSafeGitEmptyHooksRace: (binding: object) => unknown;
  readonly armTestSafeGitExecutableOwnerAdmission: (
    binding: object,
    authority: object,
  ) => unknown;
  readonly armTestInstallationStateAuthorityNamespaceRace: (
    authority: object,
    phase: NativeTestInstallationStateAuthorityNamespaceRaceV1,
  ) => unknown;
  readonly acquireInstallationIdentityInitializationLock: (
    authority: object,
  ) => unknown;
  readonly assertInstallationStateAuthorityFresh: (
    authority: object,
  ) => unknown;
  readonly assertInstallationStateAuthoritySeparatedFromSafeGit: (
    authority: object,
    binding: object,
  ) => unknown;
  readonly assertResolvedInstallationStateRootSeparatedFromSafeGit: (
    binding: object,
  ) => unknown;
  readonly assertFdHasNoExtendedAccessControl: (
    fileDescriptor: number,
    expectedKind: ProviderRuntimeNativeFdAccessControlOptionsV1["expectedKind"],
  ) => unknown;
  readonly bindSafeGitRepositoryControl: (binding: object) => unknown;
  readonly bindSafeGitEmptyHooksDirectory: (
    binding: object,
    authority: object,
    key: Buffer,
  ) => unknown;
  readonly bindSafeGitExecutable: (
    binding: object,
    authority: object,
    key: Buffer,
    absoluteExecutablePath: string,
  ) => unknown;
  readonly deriveSafeGitPathIdentity: (
    binding: object,
    key: Buffer,
  ) => unknown;
  readonly closeSafeGitDescriptorBootstrap: (binding: object) => unknown;
  readonly closeInstallationStateAuthority: (authority: object) => unknown;
  readonly createInstallationIdentityArtifact: (
    authority: object,
    artifact: string,
    bytes: Buffer,
  ) => unknown;
  readonly getKernelBridgeProfile: () => unknown;
  readonly openSafeGitDescriptorBootstrap: (root: string) => unknown;
  readonly openInstallationStateAuthority: (create: boolean) => unknown;
  readonly openTestInstallationStateAuthority: (
    root: string,
    create: boolean,
  ) => unknown;
  readonly inspectInstallationEmptyHooksDirectory: (
    authority: object,
  ) => unknown;
  readonly readInstallationIdentityArtifact: (
    authority: object,
    artifact: string,
  ) => unknown;
  readonly readPeerCredentials: (fileDescriptor: number) => unknown;
  readonly resolveInstallationStateRoot: () => unknown;
  readonly revalidateSafeGitDescriptorBootstrap: (binding: object) => unknown;
  readonly revalidateInstallationStateAuthority: (authority: object) => unknown;
  readonly releaseInstallationIdentityInitializationLock: (
    lock: object,
  ) => unknown;
  readonly replaceInstallationIdentityInitStage: (
    authority: object,
  ) => unknown;
}

interface SocketHandleV1 {
  readonly fd?: unknown;
}

interface NativeSafeGitBindingStateV1 {
  closed: boolean;
  readonly layout: NativeSafeGitDescriptorLayoutV1;
  emptyHooksBound: boolean;
  executableBound: boolean;
}

interface NativeInstallationStateAuthorityStateV1 {
  closed: boolean;
  readonly resolverId: NativeInstallationStateAuthorityOpenResultV1["resolverId"];
  readonly rootIdentity: NativeInstallationStateRootIdentityV1;
  readonly canonicalStateRootBytes: `base64url:${string}`;
  readonly ownerIdentity: `base64url:${string}`;
}

interface NativeInstallationInitializationLockStateV1 {
  released: boolean;
}

const requireV1 = createRequire(import.meta.url);
const nativeAddonPathsV1 = [
  fileURLToPath(
    new URL(
      `./native/${process.platform}-${process.arch}/provider_kernel_peer.node`,
      import.meta.url,
    ),
  ),
  fileURLToPath(
    new URL(
      `../dist/native/${process.platform}-${process.arch}/provider_kernel_peer.node`,
      import.meta.url,
    ),
  ),
];
const nativeSafeGitBindingsV1 = new WeakMap<
  object,
  NativeSafeGitBindingStateV1
>();
const nativeInstallationStateAuthoritiesV1 = new WeakMap<
  object,
  NativeInstallationStateAuthorityStateV1
>();
const nativeInstallationInitializationLocksV1 = new WeakMap<
  object,
  NativeInstallationInitializationLockStateV1
>();
let loadedAddonV1: NativeKernelBridgeAddonV1 | undefined;

function codedErrorV1(code: string, message: string): Error {
  const error = new Error(message);
  Object.defineProperty(error, "code", {
    configurable: false,
    enumerable: true,
    value: code,
    writable: false,
  });
  return error;
}

function unavailableV1(): Error {
  return codedErrorV1(
    "ERR_PROVIDER_KERNEL_PEER_CREDENTIALS_UNAVAILABLE",
    "kernel peer credentials are unavailable",
  );
}

function fdAccessControlUnavailableV1(): Error {
  return codedErrorV1(
    "ERR_PROVIDER_RUNTIME_NATIVE_FD_ACCESS_CONTROL_UNAVAILABLE",
    "native file-descriptor access-control admission is unavailable",
  );
}

function safeGitUnavailableV1(): Error {
  return codedErrorV1(
    "ERR_NATIVE_KERNEL_BRIDGE_SAFE_GIT_UNAVAILABLE",
    "native SafeGit descriptor binding is unavailable",
  );
}

function installationStateRootUnavailableV1(): Error {
  return codedErrorV1(
    "ERR_NATIVE_KERNEL_BRIDGE_INSTALLATION_STATE_ROOT_UNAVAILABLE",
    "native installation state root is unavailable",
  );
}

function installationStateAuthorityUnavailableV1(): Error {
  return codedErrorV1(
    "ERR_NATIVE_KERNEL_BRIDGE_INSTALLATION_STATE_AUTHORITY_UNAVAILABLE",
    "native installation state authority is unavailable",
  );
}

function loadNativeAddonV1(): NativeKernelBridgeAddonV1 {
  if (process.platform !== "darwin" && process.platform !== "linux") {
    throw unavailableV1();
  }
  if (loadedAddonV1 !== undefined) {
    return loadedAddonV1;
  }

  for (const nativeAddonPath of new Set(nativeAddonPathsV1)) {
    try {
      const candidate = requireV1(
        nativeAddonPath,
      ) as Partial<NativeKernelBridgeAddonV1>;
      if (
        typeof candidate.armTestSafeGitEmptyHooksRace !== "function" ||
        typeof candidate.armTestSafeGitExecutableOwnerAdmission !== "function" ||
        typeof candidate.armTestInstallationStateAuthorityNamespaceRace !== "function" ||
        typeof candidate.acquireInstallationIdentityInitializationLock !== "function" ||
        typeof candidate.assertInstallationStateAuthorityFresh !== "function" ||
        typeof candidate.assertInstallationStateAuthoritySeparatedFromSafeGit !== "function" ||
        typeof candidate.assertResolvedInstallationStateRootSeparatedFromSafeGit !== "function" ||
        typeof candidate.readPeerCredentials !== "function" ||
        typeof candidate.resolveInstallationStateRoot !== "function" ||
        typeof candidate.assertFdHasNoExtendedAccessControl !== "function" ||
        typeof candidate.getKernelBridgeProfile !== "function" ||
        typeof candidate.bindSafeGitEmptyHooksDirectory !== "function" ||
        typeof candidate.bindSafeGitExecutable !== "function" ||
        typeof candidate.bindSafeGitRepositoryControl !== "function" ||
        typeof candidate.closeInstallationStateAuthority !== "function" ||
        typeof candidate.createInstallationIdentityArtifact !== "function" ||
        typeof candidate.deriveSafeGitPathIdentity !== "function" ||
        typeof candidate.openSafeGitDescriptorBootstrap !== "function" ||
        typeof candidate.openInstallationStateAuthority !== "function" ||
        typeof candidate.openTestInstallationStateAuthority !== "function" ||
        typeof candidate.inspectInstallationEmptyHooksDirectory !== "function" ||
        typeof candidate.readInstallationIdentityArtifact !== "function" ||
        typeof candidate.revalidateSafeGitDescriptorBootstrap !== "function" ||
        typeof candidate.revalidateInstallationStateAuthority !== "function" ||
        typeof candidate.releaseInstallationIdentityInitializationLock !== "function" ||
        typeof candidate.replaceInstallationIdentityInitStage !== "function" ||
        typeof candidate.closeSafeGitDescriptorBootstrap !== "function"
      ) {
        continue;
      }
      if (candidate.getKernelBridgeProfile() !== "native_kernel_bridge_v1") {
        continue;
      }
      loadedAddonV1 = Object.freeze({
        armTestSafeGitEmptyHooksRace:
          candidate.armTestSafeGitEmptyHooksRace,
        armTestSafeGitExecutableOwnerAdmission:
          candidate.armTestSafeGitExecutableOwnerAdmission,
        armTestInstallationStateAuthorityNamespaceRace:
          candidate.armTestInstallationStateAuthorityNamespaceRace,
        acquireInstallationIdentityInitializationLock:
          candidate.acquireInstallationIdentityInitializationLock,
        assertInstallationStateAuthorityFresh:
          candidate.assertInstallationStateAuthorityFresh,
        assertInstallationStateAuthoritySeparatedFromSafeGit:
          candidate.assertInstallationStateAuthoritySeparatedFromSafeGit,
        assertResolvedInstallationStateRootSeparatedFromSafeGit:
          candidate.assertResolvedInstallationStateRootSeparatedFromSafeGit,
        assertFdHasNoExtendedAccessControl:
          candidate.assertFdHasNoExtendedAccessControl,
        bindSafeGitRepositoryControl:
          candidate.bindSafeGitRepositoryControl,
        bindSafeGitEmptyHooksDirectory:
          candidate.bindSafeGitEmptyHooksDirectory,
        bindSafeGitExecutable: candidate.bindSafeGitExecutable,
        closeSafeGitDescriptorBootstrap:
          candidate.closeSafeGitDescriptorBootstrap,
        closeInstallationStateAuthority:
          candidate.closeInstallationStateAuthority,
        createInstallationIdentityArtifact:
          candidate.createInstallationIdentityArtifact,
        deriveSafeGitPathIdentity: candidate.deriveSafeGitPathIdentity,
        getKernelBridgeProfile: candidate.getKernelBridgeProfile,
        openSafeGitDescriptorBootstrap:
          candidate.openSafeGitDescriptorBootstrap,
        openInstallationStateAuthority:
          candidate.openInstallationStateAuthority,
        openTestInstallationStateAuthority:
          candidate.openTestInstallationStateAuthority,
        inspectInstallationEmptyHooksDirectory:
          candidate.inspectInstallationEmptyHooksDirectory,
        readInstallationIdentityArtifact:
          candidate.readInstallationIdentityArtifact,
        readPeerCredentials: candidate.readPeerCredentials,
        resolveInstallationStateRoot: candidate.resolveInstallationStateRoot,
        revalidateSafeGitDescriptorBootstrap:
          candidate.revalidateSafeGitDescriptorBootstrap,
        revalidateInstallationStateAuthority:
          candidate.revalidateInstallationStateAuthority,
        releaseInstallationIdentityInitializationLock:
          candidate.releaseInstallationIdentityInitializationLock,
        replaceInstallationIdentityInitStage:
          candidate.replaceInstallationIdentityInitStage,
      });
      return loadedAddonV1;
    } catch {
      // Try the source/Vitest layout after the adjacent published layout.
    }
  }
  throw unavailableV1();
}

function accessControlFileDescriptorV1(fileDescriptor: unknown): number {
  if (
    typeof fileDescriptor !== "number" ||
    !Number.isSafeInteger(fileDescriptor) ||
    fileDescriptor < 0 ||
    fileDescriptor > 0x7fff_ffff
  ) {
    throw fdAccessControlUnavailableV1();
  }
  return fileDescriptor;
}

function accessControlExpectedKindV1(
  options: unknown,
): ProviderRuntimeNativeFdAccessControlOptionsV1["expectedKind"] {
  if (typeof options !== "object" || options === null || Array.isArray(options)) {
    throw fdAccessControlUnavailableV1();
  }
  const candidate = options as Record<string, unknown>;
  const keys = Object.keys(candidate);
  if (
    keys.length !== 1 ||
    keys[0] !== "expectedKind" ||
    (candidate.expectedKind !== "directory" &&
      candidate.expectedKind !== "regular-file")
  ) {
    throw fdAccessControlUnavailableV1();
  }
  return candidate.expectedKind;
}

function connectedSocketFileDescriptorV1(socket: Socket): number {
  if (
    !(socket instanceof Socket) ||
    socket.destroyed ||
    socket.connecting ||
    socket.pending
  ) {
    throw unavailableV1();
  }

  let handle: SocketHandleV1 | undefined;
  try {
    const candidate = Reflect.get(socket, "_handle") as unknown;
    if (typeof candidate === "object" && candidate !== null) {
      handle = candidate as SocketHandleV1;
    }
  } catch {
    throw unavailableV1();
  }
  const fileDescriptor = handle?.fd;
  if (
    typeof fileDescriptor !== "number" ||
    !Number.isSafeInteger(fileDescriptor) ||
    fileDescriptor < 0 ||
    fileDescriptor > 0x7fff_ffff
  ) {
    throw unavailableV1();
  }
  return fileDescriptor;
}

function kernelIdentifierV1(
  value: unknown,
  minimum: 0 | 1,
  maximum: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw unavailableV1();
  }
  return value;
}

function parseCredentialsV1(
  value: unknown,
): ProviderRuntimeNativeKernelPeerCredentialsV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw unavailableV1();
  }
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate);
  if (
    keys.length !== 3 ||
    !keys.includes("uid") ||
    !keys.includes("gid") ||
    !keys.includes("pid")
  ) {
    throw unavailableV1();
  }
  return Object.freeze({
    uid: kernelIdentifierV1(candidate.uid, 0, 0xffff_ffff),
    gid: kernelIdentifierV1(candidate.gid, 0, 0xffff_ffff),
    pid: kernelIdentifierV1(candidate.pid, 1, 0x7fff_ffff),
  });
}

function parseSafeGitLayoutV1(value: unknown): NativeSafeGitDescriptorLayoutV1 {
  if (value !== "ordinary" && value !== "linked_worktree") {
    throw safeGitUnavailableV1();
  }
  return value;
}

function safeGitRootV1(value: unknown): string {
  if (
    typeof value !== "string" ||
    !isAbsolute(value) ||
    value.includes("\0") ||
    Buffer.byteLength(value, "utf8") > 4096
  ) {
    throw safeGitUnavailableV1();
  }
  return value;
}

function parseSafeGitOpenResultV1(
  value: unknown,
): NativeSafeGitDescriptorBootstrapResultV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw safeGitUnavailableV1();
  }
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate);
  if (
    keys.length !== 2 ||
    !keys.includes("binding") ||
    !keys.includes("layout") ||
    typeof candidate.binding !== "object" ||
    candidate.binding === null ||
    Array.isArray(candidate.binding) ||
    nativeSafeGitBindingsV1.has(candidate.binding)
  ) {
    throw safeGitUnavailableV1();
  }
  const layout = parseSafeGitLayoutV1(candidate.layout);
  Object.freeze(candidate.binding);
  nativeSafeGitBindingsV1.set(candidate.binding, {
    closed: false,
    layout,
    emptyHooksBound: false,
    executableBound: false,
  });
  return Object.freeze({
    binding: candidate.binding as NativeSafeGitDescriptorBindingV1,
    layout,
  });
}

function safeGitBindingStateV1(
  value: NativeSafeGitDescriptorBindingV1,
): readonly [object, NativeSafeGitBindingStateV1] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw safeGitUnavailableV1();
  }
  const state = nativeSafeGitBindingsV1.get(value);
  if (state === undefined) {
    throw safeGitUnavailableV1();
  }
  return [value, state] as const;
}

function poisonSafeGitBindingV1(
  nativeBinding: object,
  state: NativeSafeGitBindingStateV1,
): void {
  state.closed = true;
  try {
    loadNativeAddonV1().closeSafeGitDescriptorBootstrap(nativeBinding);
  } catch {
    // The strict wrapper remains poisoned even if native cleanup reports drift.
  }
}

function parseSafeGitRepositoryControlV1(
  value: unknown,
): NativeSafeGitRepositoryControlInspectionV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw safeGitUnavailableV1();
  }
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate).sort();
  if (
    keys.length !== 6 ||
    keys.join("\0") !==
      [
        "objectDatabase",
        "objectFormat",
        "profile",
        "refBackend",
        "repositoryConfig",
        "worktreeConfig",
      ].join("\0") ||
    candidate.profile !== "native_safe_git_repository_control_v1" ||
    (candidate.objectFormat !== "sha1" &&
      candidate.objectFormat !== "sha256") ||
    candidate.objectDatabase !== "local_only_verified" ||
    candidate.refBackend !== "files_verified" ||
    candidate.repositoryConfig !== "verified" ||
    (candidate.worktreeConfig !== "absent" &&
      candidate.worktreeConfig !== "verified")
  ) {
    throw safeGitUnavailableV1();
  }
  return Object.freeze({
    profile: candidate.profile,
    objectFormat: candidate.objectFormat,
    objectDatabase: candidate.objectDatabase,
    refBackend: candidate.refBackend,
    repositoryConfig: candidate.repositoryConfig,
    worktreeConfig: candidate.worktreeConfig,
  });
}

const SAFE_GIT_PATH_IDENTITY_PATTERN_V1 = /^[0-9a-f]{64}$/u;

function parseSafeGitPathIdentityV1(value: unknown): NativeSafeGitPathIdentityV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw safeGitUnavailableV1();
  }
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate).sort();
  if (
    keys.length !== 4 ||
    keys.join("\0") !==
      ["profile", "repositoryId", "rootIdentity", "worktreeId"].join("\0") ||
    candidate.profile !== "native_safe_git_path_identity_v1" ||
    typeof candidate.repositoryId !== "string" ||
    !candidate.repositoryId.startsWith("repo-hmac-") ||
    !SAFE_GIT_PATH_IDENTITY_PATTERN_V1.test(candidate.repositoryId.slice(10)) ||
    typeof candidate.worktreeId !== "string" ||
    !candidate.worktreeId.startsWith("worktree-hmac-") ||
    !SAFE_GIT_PATH_IDENTITY_PATTERN_V1.test(candidate.worktreeId.slice(14)) ||
    typeof candidate.rootIdentity !== "string" ||
    !candidate.rootIdentity.startsWith("root-hmac-") ||
    !SAFE_GIT_PATH_IDENTITY_PATTERN_V1.test(candidate.rootIdentity.slice(10))
  ) {
    throw safeGitUnavailableV1();
  }
  return Object.freeze({
    profile: candidate.profile,
    repositoryId: candidate.repositoryId as NativeSafeGitRepositoryIdV1,
    worktreeId: candidate.worktreeId as NativeSafeGitWorktreeIdV1,
    rootIdentity: candidate.rootIdentity as NativeSafeGitRootIdentityV1,
  });
}

function parseInstallationStateRootV1(
  value: unknown,
): NativeInstallationStateRootV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw installationStateRootUnavailableV1();
  }
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate).sort();
  const expectedResolverId =
    process.platform === "darwin"
      ? "darwin-user-domain-application-support-v1"
      : "linux-getpwuid-effective-user-state-v1";
  if (
    keys.length !== 5 ||
    keys.join("\0") !== ["gid", "profile", "resolverId", "root", "uid"].join("\0") ||
    candidate.profile !== "native_installation_state_resolver_v1" ||
    candidate.resolverId !== expectedResolverId ||
    typeof candidate.root !== "string" ||
    !isAbsolute(candidate.root) ||
    candidate.root.includes("\0") ||
    Buffer.byteLength(candidate.root, "utf8") > 4096 ||
    typeof candidate.uid !== "number" ||
    !Number.isSafeInteger(candidate.uid) ||
    candidate.uid < 0 ||
    candidate.uid > 0xffff_ffff ||
    typeof candidate.gid !== "number" ||
    !Number.isSafeInteger(candidate.gid) ||
    candidate.gid < 0 ||
    candidate.gid > 0xffff_ffff
  ) {
    throw installationStateRootUnavailableV1();
  }
  return Object.freeze({
    profile: "native_installation_state_resolver_v1" as const,
    resolverId: expectedResolverId,
    root: candidate.root,
    uid: candidate.uid,
    gid: candidate.gid,
  });
}

function parseInstallationStateRootIdentityV1(
  value: unknown,
): NativeInstallationStateRootIdentityV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw installationStateAuthorityUnavailableV1();
  }
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate).sort();
  if (
    keys.join("\0") !== ["device", "inode", "platform"].join("\0") ||
    candidate.platform !== "posix" ||
    typeof candidate.device !== "string" ||
    !/^(0|[1-9][0-9]*)$/u.test(candidate.device) ||
    typeof candidate.inode !== "string" ||
    !/^(0|[1-9][0-9]*)$/u.test(candidate.inode)
  ) {
    throw installationStateAuthorityUnavailableV1();
  }
  return Object.freeze({
    platform: "posix",
    device: candidate.device,
    inode: candidate.inode,
  });
}

function parseInstallationEmptyHooksDirectoryV1(
  value: unknown,
): NativeInstallationEmptyHooksDirectoryInspectionV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw installationStateAuthorityUnavailableV1();
  }
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate).sort();
  if (
    keys.join("\0") !== ["directoryIdentity", "profile"].join("\0") ||
    candidate.profile !== "native_installation_empty_hooks_directory_v1"
  ) {
    throw installationStateAuthorityUnavailableV1();
  }
  return Object.freeze({
    profile: "native_installation_empty_hooks_directory_v1",
    directoryIdentity: parseInstallationStateRootIdentityV1(
      candidate.directoryIdentity,
    ),
  });
}

function parseSafeGitEmptyHooksDirectoryBindingV1(
  value: unknown,
): NativeSafeGitEmptyHooksDirectoryBindingV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw safeGitUnavailableV1();
  }
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate).sort();
  if (
    keys.join("\0") !==
      ["directoryIdentity", "emptyHooksDirectoryToken", "profile"].join("\0") ||
    candidate.profile !== "native_safe_git_empty_hooks_binding_v1" ||
    typeof candidate.emptyHooksDirectoryToken !== "string" ||
    !/^hmac-sha256:[0-9a-f]{64}$/u.test(
      candidate.emptyHooksDirectoryToken,
    )
  ) {
    throw safeGitUnavailableV1();
  }
  let directoryIdentity: NativeInstallationStateRootIdentityV1;
  try {
    directoryIdentity = parseInstallationStateRootIdentityV1(
      candidate.directoryIdentity,
    );
  } catch {
    throw safeGitUnavailableV1();
  }
  return Object.freeze({
    profile: "native_safe_git_empty_hooks_binding_v1",
    directoryIdentity,
    emptyHooksDirectoryToken:
      candidate.emptyHooksDirectoryToken as NativeSafeGitEmptyHooksDirectoryTokenV1,
  });
}

function parseSafeGitExecutableBindingV1(
  value: unknown,
): NativeSafeGitExecutableBindingInspectionV1 {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw safeGitUnavailableV1();
  }
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate).sort();
  if (
    keys.join("\0") !== ["executableBinding", "profile"].join("\0") ||
    candidate.profile !== "native_safe_git_executable_binding_v1" ||
    candidate.executableBinding !== "verified"
  ) {
    throw safeGitUnavailableV1();
  }
  return Object.freeze({
    profile: "native_safe_git_executable_binding_v1",
    executableBinding: "verified",
  });
}

function parseInstallationStateAuthorityOpenResultV1(
  value: unknown,
): NativeInstallationStateAuthorityOpenResultV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw installationStateAuthorityUnavailableV1();
  }
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate).sort();
  if (
    keys.join("\0") !==
      ["authority", "canonicalStateRootBytes", "ownerIdentity", "profile", "resolverId", "rootCreated", "rootIdentity"].join("\0") ||
    candidate.profile !== "native_installation_state_authority_v1" ||
    ![
      "darwin-user-domain-application-support-v1",
      "linux-getpwuid-effective-user-state-v1",
      "test-explicit-temporary-root-v1",
    ].includes(candidate.resolverId as string) ||
    typeof candidate.rootCreated !== "boolean" ||
    typeof candidate.authority !== "object" ||
    candidate.authority === null ||
    Array.isArray(candidate.authority) ||
    nativeInstallationStateAuthoritiesV1.has(candidate.authority) ||
    typeof candidate.canonicalStateRootBytes !== "string" ||
    !/^base64url:[A-Za-z0-9_-]+$/u.test(candidate.canonicalStateRootBytes) ||
    typeof candidate.ownerIdentity !== "string" ||
    !/^base64url:[A-Za-z0-9_-]+$/u.test(candidate.ownerIdentity)
  ) {
    throw installationStateAuthorityUnavailableV1();
  }
  const resolverId = candidate.resolverId as NativeInstallationStateAuthorityOpenResultV1["resolverId"];
  const rootIdentity = parseInstallationStateRootIdentityV1(candidate.rootIdentity);
  const canonicalStateRootBytes = candidate.canonicalStateRootBytes as `base64url:${string}`;
  const ownerIdentity = candidate.ownerIdentity as `base64url:${string}`;
  Object.freeze(candidate.authority);
  nativeInstallationStateAuthoritiesV1.set(candidate.authority, {
    closed: false,
    resolverId,
    rootIdentity,
    canonicalStateRootBytes,
    ownerIdentity,
  });
  return Object.freeze({
    profile: "native_installation_state_authority_v1",
    authority: candidate.authority as NativeInstallationStateAuthorityV1,
    resolverId,
    rootCreated: candidate.rootCreated,
    rootIdentity,
    canonicalStateRootBytes,
    ownerIdentity,
  });
}

function installationStateAuthorityStateV1(
  authority: NativeInstallationStateAuthorityV1,
): readonly [object, NativeInstallationStateAuthorityStateV1] {
  if (typeof authority !== "object" || authority === null || Array.isArray(authority)) {
    throw installationStateAuthorityUnavailableV1();
  }
  const state = nativeInstallationStateAuthoritiesV1.get(authority);
  if (state === undefined || state.closed) {
    throw installationStateAuthorityUnavailableV1();
  }
  return [authority, state] as const;
}

function installationStateAuthorityOptionsV1(
  options: unknown,
): NativeInstallationStateAuthorityOpenOptionsV1 {
  if (typeof options !== "object" || options === null || Array.isArray(options)) {
    throw installationStateAuthorityUnavailableV1();
  }
  const candidate = options as Record<string, unknown>;
  if (Object.keys(candidate).length !== 1 || typeof candidate.create !== "boolean") {
    throw installationStateAuthorityUnavailableV1();
  }
  return { create: candidate.create };
}

function installationIdentityArtifactV1(
  artifact: unknown,
): NativeInstallationIdentityArtifactV1 {
  if (artifact !== "key" && artifact !== "state" && artifact !== "init" && artifact !== "init_stage") {
    throw installationStateAuthorityUnavailableV1();
  }
  return artifact;
}

function installationIdentityArtifactBytesV1(
  artifact: NativeInstallationIdentityArtifactV1,
  bytes: unknown,
): Buffer {
  const maximum = artifact === "key" ? 32 : 16 * 1024;
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.byteLength === 0 ||
    bytes.byteLength > maximum ||
    (artifact === "key" && bytes.byteLength !== 32)
  ) {
    throw installationStateAuthorityUnavailableV1();
  }
  return bytes;
}

/**
 * Reads credentials for this exact live connected Unix-domain socket from the
 * kernel. Addon load, descriptor, socket-family, and syscall failures are all
 * fail-closed.
 */
export function readProviderRuntimeNativeKernelPeerCredentialsV1(
  socket: Socket,
): ProviderRuntimeNativeKernelPeerCredentialsV1 {
  const addon = loadNativeAddonV1();
  const fileDescriptor = connectedSocketFileDescriptorV1(socket);
  try {
    return parseCredentialsV1(addon.readPeerCredentials(fileDescriptor));
  } catch {
    throw unavailableV1();
  }
}

/** Admits access control for the exact already-open descriptor only. */
export function assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1(
  fileDescriptor: number,
  options: ProviderRuntimeNativeFdAccessControlOptionsV1,
): void {
  try {
    const addon = loadNativeAddonV1();
    const validatedFileDescriptor = accessControlFileDescriptorV1(fileDescriptor);
    const expectedKind = accessControlExpectedKindV1(options);
    if (
      addon.assertFdHasNoExtendedAccessControl(
        validatedFileDescriptor,
        expectedKind,
      ) !== true
    ) {
      throw fdAccessControlUnavailableV1();
    }
  } catch {
    throw fdAccessControlUnavailableV1();
  }
}

/** Resolves the current account's production state root without environment input. */
export function resolveNativeInstallationStateRootV1(): NativeInstallationStateRootV1 {
  try {
    return parseInstallationStateRootV1(
      loadNativeAddonV1().resolveInstallationStateRoot(),
    );
  } catch {
    throw installationStateRootUnavailableV1();
  }
}

/** Opens the OS-resolved descriptor authority; creation is always explicit. */
export function openNativeInstallationStateAuthorityV1(
  options: NativeInstallationStateAuthorityOpenOptionsV1,
): NativeInstallationStateAuthorityOpenResultV1 {
  try {
    const parsed = installationStateAuthorityOptionsV1(options);
    return parseInstallationStateAuthorityOpenResultV1(
      loadNativeAddonV1().openInstallationStateAuthority(parsed.create),
    );
  } catch {
    throw installationStateAuthorityUnavailableV1();
  }
}

/** Test-only explicit-root authority; production callers must use the OS resolver. */
export function openNativeTestInstallationStateAuthorityV1(
  root: string,
  options: NativeInstallationStateAuthorityOpenOptionsV1,
): NativeInstallationStateAuthorityOpenResultV1 {
  try {
    const parsedRoot = safeGitRootV1(root);
    const parsed = installationStateAuthorityOptionsV1(options);
    const opened = parseInstallationStateAuthorityOpenResultV1(
      loadNativeAddonV1().openTestInstallationStateAuthority(
        parsedRoot,
        parsed.create,
      ),
    );
    if (opened.resolverId !== "test-explicit-temporary-root-v1") {
      throw installationStateAuthorityUnavailableV1();
    }
    return opened;
  } catch {
    throw installationStateAuthorityUnavailableV1();
  }
}

/** Returns only the pinned POSIX identity of the native-owned empty hooks directory. */
export function inspectNativeInstallationEmptyHooksDirectoryV1(
  authority: NativeInstallationStateAuthorityV1,
): NativeInstallationEmptyHooksDirectoryInspectionV1 {
  try {
    const [nativeAuthority] = installationStateAuthorityStateV1(authority);
    return parseInstallationEmptyHooksDirectoryV1(
      loadNativeAddonV1().inspectInstallationEmptyHooksDirectory(
        nativeAuthority,
      ),
    );
  } catch {
    throw installationStateAuthorityUnavailableV1();
  }
}

export function revalidateNativeInstallationStateAuthorityV1(
  authority: NativeInstallationStateAuthorityV1,
): void {
  try {
    const [nativeAuthority, state] = installationStateAuthorityStateV1(authority);
    const value = loadNativeAddonV1().revalidateInstallationStateAuthority(nativeAuthority);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw installationStateAuthorityUnavailableV1();
    }
    const candidate = value as Record<string, unknown>;
    if (
      Object.keys(candidate).sort().join("\0") !==
        ["canonicalStateRootBytes", "ownerIdentity", "profile", "resolverId", "rootIdentity"].join("\0") ||
      candidate.profile !== "native_installation_state_authority_v1" ||
      candidate.resolverId !== state.resolverId ||
      candidate.canonicalStateRootBytes !== state.canonicalStateRootBytes ||
      candidate.ownerIdentity !== state.ownerIdentity
    ) {
      throw installationStateAuthorityUnavailableV1();
    }
    const identity = parseInstallationStateRootIdentityV1(candidate.rootIdentity);
    if (
      identity.device !== state.rootIdentity.device ||
      identity.inode !== state.rootIdentity.inode
    ) {
      throw installationStateAuthorityUnavailableV1();
    }
  } catch {
    throw installationStateAuthorityUnavailableV1();
  }
}

export function closeNativeInstallationStateAuthorityV1(
  authority: NativeInstallationStateAuthorityV1,
): void {
  try {
    if (typeof authority !== "object" || authority === null || Array.isArray(authority)) {
      throw installationStateAuthorityUnavailableV1();
    }
    const state = nativeInstallationStateAuthoritiesV1.get(authority);
    if (state === undefined) throw installationStateAuthorityUnavailableV1();
    if (state.closed) return;
    if (loadNativeAddonV1().closeInstallationStateAuthority(authority) !== true) {
      throw installationStateAuthorityUnavailableV1();
    }
    state.closed = true;
  } catch {
    throw installationStateAuthorityUnavailableV1();
  }
}

export function readNativeInstallationIdentityArtifactV1(
  authority: NativeInstallationStateAuthorityV1,
  artifact: NativeInstallationIdentityArtifactV1,
): Buffer | undefined {
  try {
    const [nativeAuthority] = installationStateAuthorityStateV1(authority);
    const parsedArtifact = installationIdentityArtifactV1(artifact);
    const value = loadNativeAddonV1().readInstallationIdentityArtifact(
      nativeAuthority,
      parsedArtifact,
    );
    if (value === null) return undefined;
    return installationIdentityArtifactBytesV1(parsedArtifact, value);
  } catch {
    throw installationStateAuthorityUnavailableV1();
  }
}

export function createNativeInstallationIdentityArtifactV1(
  authority: NativeInstallationStateAuthorityV1,
  artifact: NativeInstallationIdentityArtifactV1,
  bytes: Buffer,
): void {
  try {
    const [nativeAuthority] = installationStateAuthorityStateV1(authority);
    const parsedArtifact = installationIdentityArtifactV1(artifact);
    const parsedBytes = installationIdentityArtifactBytesV1(parsedArtifact, bytes);
    if (
      loadNativeAddonV1().createInstallationIdentityArtifact(
        nativeAuthority,
        parsedArtifact,
        parsedBytes,
      ) !== true
    ) {
      throw installationStateAuthorityUnavailableV1();
    }
  } catch {
    throw installationStateAuthorityUnavailableV1();
  }
}

export function replaceNativeInstallationIdentityInitStageV1(
  authority: NativeInstallationStateAuthorityV1,
): void {
  try {
    const [nativeAuthority] = installationStateAuthorityStateV1(authority);
    if (loadNativeAddonV1().replaceInstallationIdentityInitStage(nativeAuthority) !== true) {
      throw installationStateAuthorityUnavailableV1();
    }
  } catch {
    throw installationStateAuthorityUnavailableV1();
  }
}

export function acquireNativeInstallationIdentityInitializationLockV1(
  authority: NativeInstallationStateAuthorityV1,
): NativeInstallationInitializationLockV1 | undefined {
  try {
    const [nativeAuthority] = installationStateAuthorityStateV1(authority);
    const value = loadNativeAddonV1().acquireInstallationIdentityInitializationLock(
      nativeAuthority,
    );
    if (value === null) return undefined;
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value) ||
      nativeInstallationInitializationLocksV1.has(value)
    ) {
      throw installationStateAuthorityUnavailableV1();
    }
    Object.freeze(value);
    nativeInstallationInitializationLocksV1.set(value, { released: false });
    return value as NativeInstallationInitializationLockV1;
  } catch {
    throw installationStateAuthorityUnavailableV1();
  }
}

export function releaseNativeInstallationIdentityInitializationLockV1(
  lock: NativeInstallationInitializationLockV1,
): void {
  try {
    if (typeof lock !== "object" || lock === null || Array.isArray(lock)) {
      throw installationStateAuthorityUnavailableV1();
    }
    const state = nativeInstallationInitializationLocksV1.get(lock);
    if (state === undefined) throw installationStateAuthorityUnavailableV1();
    if (state.released) return;
    if (loadNativeAddonV1().releaseInstallationIdentityInitializationLock(lock) !== true) {
      throw installationStateAuthorityUnavailableV1();
    }
    state.released = true;
  } catch {
    throw installationStateAuthorityUnavailableV1();
  }
}

export function assertNativeInstallationStateAuthorityFreshV1(
  authority: NativeInstallationStateAuthorityV1,
): void {
  try {
    const [nativeAuthority] = installationStateAuthorityStateV1(authority);
    if (loadNativeAddonV1().assertInstallationStateAuthorityFresh(nativeAuthority) !== true) {
      throw installationStateAuthorityUnavailableV1();
    }
  } catch {
    throw installationStateAuthorityUnavailableV1();
  }
}

/** Test-authority-only deterministic namespace race seam. */
export function armNativeTestInstallationStateAuthorityNamespaceRaceV1(
  authority: NativeInstallationStateAuthorityV1,
  phase: NativeTestInstallationStateAuthorityNamespaceRaceV1,
): void {
  try {
    const [nativeAuthority] = installationStateAuthorityStateV1(authority);
    if (phase !== "static_shape" && phase !== "fresh_shape") {
      throw installationStateAuthorityUnavailableV1();
    }
    if (
      loadNativeAddonV1().armTestInstallationStateAuthorityNamespaceRace(
        nativeAuthority,
        phase,
      ) !== true
    ) {
      throw installationStateAuthorityUnavailableV1();
    }
  } catch {
    throw installationStateAuthorityUnavailableV1();
  }
}

export function assertNativeInstallationStateAuthoritySeparatedFromSafeGitV1(
  authority: NativeInstallationStateAuthorityV1,
  binding: NativeSafeGitDescriptorBindingV1,
): void {
  try {
    const [nativeAuthority] = installationStateAuthorityStateV1(authority);
    const [nativeBinding, bindingState] = safeGitBindingStateV1(binding);
    if (
      bindingState.closed ||
      loadNativeAddonV1().assertInstallationStateAuthoritySeparatedFromSafeGit(
        nativeAuthority,
        nativeBinding,
      ) !== true
    ) {
      throw installationStateAuthorityUnavailableV1();
    }
  } catch {
    throw installationStateAuthorityUnavailableV1();
  }
}

export function assertNativeResolvedInstallationStateRootSeparatedFromSafeGitV1(
  binding: NativeSafeGitDescriptorBindingV1,
): void {
  try {
    const [nativeBinding, bindingState] = safeGitBindingStateV1(binding);
    if (
      bindingState.closed ||
      loadNativeAddonV1().assertResolvedInstallationStateRootSeparatedFromSafeGit(
        nativeBinding,
      ) !== true
    ) {
      throw installationStateAuthorityUnavailableV1();
    }
  } catch {
    throw installationStateAuthorityUnavailableV1();
  }
}

/** Opens and retains native-owned, descriptor-relative repository authority. */
export function openNativeSafeGitDescriptorBootstrapV1(
  root: string,
): NativeSafeGitDescriptorBootstrapResultV1 {
  try {
    const validatedRoot = safeGitRootV1(root);
    return parseSafeGitOpenResultV1(
      loadNativeAddonV1().openSafeGitDescriptorBootstrap(validatedRoot),
    );
  } catch {
    throw safeGitUnavailableV1();
  }
}

/** Revalidates retained identities, pointer bytes, and descriptor-relative edges. */
export function revalidateNativeSafeGitDescriptorBootstrapV1(
  binding: NativeSafeGitDescriptorBindingV1,
): NativeSafeGitDescriptorLayoutV1 {
  let nativeBinding: object | undefined;
  let bindingState: NativeSafeGitBindingStateV1 | undefined;
  try {
    [nativeBinding, bindingState] = safeGitBindingStateV1(binding);
    if (bindingState.closed) {
      throw safeGitUnavailableV1();
    }
    const value = loadNativeAddonV1().revalidateSafeGitDescriptorBootstrap(
      nativeBinding,
    );
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw safeGitUnavailableV1();
    }
    const candidate = value as Record<string, unknown>;
    const keys = Object.keys(candidate);
    const layout = parseSafeGitLayoutV1(candidate.layout);
    if (
      keys.length !== 1 ||
      keys[0] !== "layout" ||
      layout !== bindingState.layout
    ) {
      throw safeGitUnavailableV1();
    }
    return layout;
  } catch {
    if (nativeBinding !== undefined && bindingState !== undefined) {
      poisonSafeGitBindingV1(nativeBinding, bindingState);
    }
    throw safeGitUnavailableV1();
  }
}

/**
 * Promotes an existing descriptor bootstrap into a descriptor-relative,
 * read-only repository control authority. No path, descriptor, config bytes,
 * or filesystem identity crosses this boundary.
 */
export function bindNativeSafeGitRepositoryControlV1(
  binding: NativeSafeGitDescriptorBindingV1,
): NativeSafeGitRepositoryControlInspectionV1 {
  try {
    const [nativeBinding, state] = safeGitBindingStateV1(binding);
    if (state.closed) {
      throw safeGitUnavailableV1();
    }
    return parseSafeGitRepositoryControlV1(
      loadNativeAddonV1().bindSafeGitRepositoryControl(nativeBinding),
    );
  } catch {
    throw safeGitUnavailableV1();
  }
}

/**
 * Binds the installation-owned empty hooks directory into the repository
 * descriptor authority and derives its installation-keyed frozen token.
 */
export function bindNativeSafeGitEmptyHooksDirectoryV1(
  binding: NativeSafeGitDescriptorBindingV1,
  authority: NativeInstallationStateAuthorityV1,
  installationIdentityKey: Buffer,
): NativeSafeGitEmptyHooksDirectoryBindingV1 {
  let nativeBinding: object | undefined;
  let bindingState: NativeSafeGitBindingStateV1 | undefined;
  try {
    [nativeBinding, bindingState] = safeGitBindingStateV1(binding);
    const [nativeAuthority] = installationStateAuthorityStateV1(authority);
    if (bindingState.closed) {
      throw safeGitUnavailableV1();
    }
    const result = parseSafeGitEmptyHooksDirectoryBindingV1(
      loadNativeAddonV1().bindSafeGitEmptyHooksDirectory(
        nativeBinding,
        nativeAuthority,
        installationIdentityKey,
      ),
    );
    bindingState.emptyHooksBound = true;
    return result;
  } catch {
    if (nativeBinding !== undefined && bindingState !== undefined) {
      poisonSafeGitBindingV1(nativeBinding, bindingState);
    }
    throw safeGitUnavailableV1();
  }
}

/**
 * Pins one explicit Git executable into the retained descriptor authority.
 * The executable path, identity, digest, and keyed token remain native-private.
 */
export function bindNativeSafeGitExecutableV1(
  binding: NativeSafeGitDescriptorBindingV1,
  authority: NativeInstallationStateAuthorityV1,
  installationIdentityKey: Buffer,
  absoluteExecutablePath: string,
): NativeSafeGitExecutableBindingInspectionV1 {
  let nativeBinding: object | undefined;
  let bindingState: NativeSafeGitBindingStateV1 | undefined;
  try {
    [nativeBinding, bindingState] = safeGitBindingStateV1(binding);
    const [nativeAuthority, authorityState] =
      installationStateAuthorityStateV1(authority);
    if (
      bindingState.closed ||
      authorityState.closed ||
      !bindingState.emptyHooksBound ||
      !Buffer.isBuffer(installationIdentityKey) ||
      installationIdentityKey.byteLength !== 32 ||
      typeof absoluteExecutablePath !== "string" ||
      !isAbsolute(absoluteExecutablePath) ||
      absoluteExecutablePath.includes("\0") ||
      Buffer.byteLength(absoluteExecutablePath, "utf8") > 4096
    ) {
      throw safeGitUnavailableV1();
    }
    const result = parseSafeGitExecutableBindingV1(
      loadNativeAddonV1().bindSafeGitExecutable(
        nativeBinding,
        nativeAuthority,
        installationIdentityKey,
        absoluteExecutablePath,
      ),
    );
    bindingState.executableBound = true;
    return result;
  } catch {
    if (nativeBinding !== undefined && bindingState !== undefined) {
      poisonSafeGitBindingV1(nativeBinding, bindingState);
    }
    throw safeGitUnavailableV1();
  }
}

/** Test-authority-only deterministic post-scan empty-hooks race seam. */
export function armNativeTestSafeGitEmptyHooksDirectoryRaceV1(
  binding: NativeSafeGitDescriptorBindingV1,
): void {
  try {
    const [nativeBinding, state] = safeGitBindingStateV1(binding);
    if (
      state.closed ||
      !state.emptyHooksBound ||
      loadNativeAddonV1().armTestSafeGitEmptyHooksRace(nativeBinding) !== true
    ) {
      throw safeGitUnavailableV1();
    }
  } catch {
    throw safeGitUnavailableV1();
  }
}

/** Test-only one-shot admission for current-owner temporary executable files. */
export function armNativeTestSafeGitExecutableOwnerAdmissionV1(
  binding: NativeSafeGitDescriptorBindingV1,
  authority: NativeInstallationStateAuthorityV1,
): void {
  try {
    const [nativeBinding, bindingState] = safeGitBindingStateV1(binding);
    const [nativeAuthority, authorityState] =
      installationStateAuthorityStateV1(authority);
    if (
      bindingState.closed ||
      authorityState.closed ||
      !bindingState.emptyHooksBound ||
      bindingState.executableBound ||
      authorityState.resolverId !== "test-explicit-temporary-root-v1" ||
      loadNativeAddonV1().armTestSafeGitExecutableOwnerAdmission(
          nativeBinding,
          nativeAuthority,
        ) !== true
    ) {
      throw safeGitUnavailableV1();
    }
  } catch {
    throw safeGitUnavailableV1();
  }
}

/**
 * Derives installation-keyed, path-redacted repository identities wholly
 * inside the descriptor authority. The exact 32-byte key and canonical
 * locator bytes never cross the native result boundary.
 */
export function deriveNativeSafeGitPathIdentityV1(
  binding: NativeSafeGitDescriptorBindingV1,
  installationIdentityKey: Buffer,
): NativeSafeGitPathIdentityV1 {
  try {
    const [nativeBinding, state] = safeGitBindingStateV1(binding);
    if (
      state.closed ||
      !Buffer.isBuffer(installationIdentityKey) ||
      installationIdentityKey.byteLength !== 32
    ) {
      throw safeGitUnavailableV1();
    }
    return parseSafeGitPathIdentityV1(
      loadNativeAddonV1().deriveSafeGitPathIdentity(
        nativeBinding,
        installationIdentityKey,
      ),
    );
  } catch {
    throw safeGitUnavailableV1();
  }
}

/** Closes the bound descriptors. Repeated close calls are idempotent. */
export function closeNativeSafeGitDescriptorBootstrapV1(
  binding: NativeSafeGitDescriptorBindingV1,
): void {
  try {
    const [nativeBinding, state] = safeGitBindingStateV1(binding);
    if (state.closed) {
      return;
    }
    if (
      loadNativeAddonV1().closeSafeGitDescriptorBootstrap(nativeBinding) !== true
    ) {
      throw safeGitUnavailableV1();
    }
    state.closed = true;
  } catch {
    throw safeGitUnavailableV1();
  }
}
