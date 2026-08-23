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

interface NativeKernelBridgeAddonV1 {
  readonly assertFdHasNoExtendedAccessControl: (
    fileDescriptor: number,
    expectedKind: ProviderRuntimeNativeFdAccessControlOptionsV1["expectedKind"],
  ) => unknown;
  readonly bindSafeGitRepositoryControl: (binding: object) => unknown;
  readonly closeSafeGitDescriptorBootstrap: (binding: object) => unknown;
  readonly getKernelBridgeProfile: () => unknown;
  readonly openSafeGitDescriptorBootstrap: (root: string) => unknown;
  readonly readPeerCredentials: (fileDescriptor: number) => unknown;
  readonly revalidateSafeGitDescriptorBootstrap: (binding: object) => unknown;
}

interface SocketHandleV1 {
  readonly fd?: unknown;
}

interface NativeSafeGitBindingStateV1 {
  closed: boolean;
  readonly layout: NativeSafeGitDescriptorLayoutV1;
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
        typeof candidate.readPeerCredentials !== "function" ||
        typeof candidate.assertFdHasNoExtendedAccessControl !== "function" ||
        typeof candidate.getKernelBridgeProfile !== "function" ||
        typeof candidate.bindSafeGitRepositoryControl !== "function" ||
        typeof candidate.openSafeGitDescriptorBootstrap !== "function" ||
        typeof candidate.revalidateSafeGitDescriptorBootstrap !== "function" ||
        typeof candidate.closeSafeGitDescriptorBootstrap !== "function"
      ) {
        continue;
      }
      if (candidate.getKernelBridgeProfile() !== "native_kernel_bridge_v1") {
        continue;
      }
      loadedAddonV1 = Object.freeze({
        assertFdHasNoExtendedAccessControl:
          candidate.assertFdHasNoExtendedAccessControl,
        bindSafeGitRepositoryControl:
          candidate.bindSafeGitRepositoryControl,
        closeSafeGitDescriptorBootstrap:
          candidate.closeSafeGitDescriptorBootstrap,
        getKernelBridgeProfile: candidate.getKernelBridgeProfile,
        openSafeGitDescriptorBootstrap:
          candidate.openSafeGitDescriptorBootstrap,
        readPeerCredentials: candidate.readPeerCredentials,
        revalidateSafeGitDescriptorBootstrap:
          candidate.revalidateSafeGitDescriptorBootstrap,
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
  nativeSafeGitBindingsV1.set(candidate.binding, { closed: false, layout });
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
  try {
    const [nativeBinding, state] = safeGitBindingStateV1(binding);
    if (state.closed) {
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
    if (keys.length !== 1 || keys[0] !== "layout" || layout !== state.layout) {
      throw safeGitUnavailableV1();
    }
    return layout;
  } catch {
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
