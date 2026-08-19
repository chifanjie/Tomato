import { createRequire } from "node:module";
import { Socket } from "node:net";
import { fileURLToPath } from "node:url";

export interface ProviderRuntimeNativeKernelPeerCredentialsV1 {
  readonly uid: number;
  readonly gid: number;
  readonly pid: number;
}

export interface ProviderRuntimeNativeFdAccessControlOptionsV1 {
  readonly expectedKind: "directory" | "regular-file";
}

interface NativeKernelPeerAddonV1 {
  readonly assertFdHasNoExtendedAccessControl: (
    fileDescriptor: number,
    expectedKind: ProviderRuntimeNativeFdAccessControlOptionsV1["expectedKind"],
  ) => unknown;
  readonly readPeerCredentials: (fileDescriptor: number) => unknown;
}

interface SocketHandleV1 {
  readonly fd?: unknown;
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
let loadedAddonV1: NativeKernelPeerAddonV1 | undefined;

function unavailableV1(): Error {
  const error = new Error("kernel peer credentials are unavailable");
  Object.defineProperty(error, "code", {
    configurable: false,
    enumerable: true,
    value: "ERR_PROVIDER_KERNEL_PEER_CREDENTIALS_UNAVAILABLE",
    writable: false,
  });
  return error;
}

function fdAccessControlUnavailableV1(): Error {
  const error = new Error(
    "native file-descriptor access-control admission is unavailable",
  );
  Object.defineProperty(error, "code", {
    configurable: false,
    enumerable: true,
    value: "ERR_PROVIDER_RUNTIME_NATIVE_FD_ACCESS_CONTROL_UNAVAILABLE",
    writable: false,
  });
  return error;
}

function loadNativeAddonV1(): NativeKernelPeerAddonV1 {
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
      ) as Partial<NativeKernelPeerAddonV1>;
      if (
        typeof candidate.readPeerCredentials !== "function" ||
        typeof candidate.assertFdHasNoExtendedAccessControl !== "function"
      ) {
        continue;
      }
      loadedAddonV1 = Object.freeze({
        assertFdHasNoExtendedAccessControl:
          candidate.assertFdHasNoExtendedAccessControl,
        readPeerCredentials: candidate.readPeerCredentials,
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

/**
 * Reads credentials for this exact live connected Unix-domain socket from the
 * kernel. The file descriptor is never accepted from request data and is used
 * immediately; addon load, descriptor, socket-family, and syscall failures are
 * all fail-closed.
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

/**
 * Admits the exact inode referenced by an already-open descriptor only when
 * the kernel can prove its expected kind, dangerous file flags are absent,
 * and no platform extended access-control entry grants access. No pathname is
 * accepted or resolved here; descriptor provenance and continued custody
 * stay with the caller.
 */
export function assertProviderRuntimeNativeFdHasNoExtendedAccessControlV1(
  fileDescriptor: number,
  options: ProviderRuntimeNativeFdAccessControlOptionsV1,
): void {
  try {
    const addon = loadNativeAddonV1();
    const validatedFileDescriptor =
      accessControlFileDescriptorV1(fileDescriptor);
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
