import { Socket } from "node:net";

export const PROVIDER_RUNTIME_KERNEL_PEER_REQUIRED_NEXT_V1 =
  "acceptance_identity_token_gate" as const;

export type ProviderRuntimeKernelPeerCredentialPlatformV1 = "darwin" | "linux";

export type ProviderRuntimeKernelPeerCredentialMechanismV1 =
  | "darwin_getpeereid_local_peercred_peerpid"
  | "linux_so_peercred";

export interface ProviderRuntimeKernelPeerCredentialsV1 {
  readonly uid: number;
  readonly gid: number;
  readonly pid: number;
}

export interface ProviderRuntimeKernelPeerCredentialReaderV1 {
  readonly platform: ProviderRuntimeKernelPeerCredentialPlatformV1;
  readonly mechanism: ProviderRuntimeKernelPeerCredentialMechanismV1;
  /** Must obtain credentials from the kernel for this exact connected socket. */
  readonly readPeerCredentials: (
    socket: Socket,
  ) => Promise<unknown> | unknown;
}

declare const trustedKernelPeerCredentialHelperBrandV1: unique symbol;

/**
 * Opaque, process-local capability. JSON/request data cannot manufacture one:
 * verification also requires membership in this module's private WeakMap.
 */
export interface TrustedProviderRuntimeKernelPeerCredentialHelperV1 {
  readonly [trustedKernelPeerCredentialHelperBrandV1]: true;
}

interface SealedKernelPeerCredentialReaderV1 {
  readonly platform: ProviderRuntimeKernelPeerCredentialPlatformV1;
  readonly mechanism: ProviderRuntimeKernelPeerCredentialMechanismV1;
  readonly readPeerCredentials: (
    socket: Socket,
  ) => Promise<unknown> | unknown;
}

const trustedReadersV1 = new WeakMap<
  TrustedProviderRuntimeKernelPeerCredentialHelperV1,
  SealedKernelPeerCredentialReaderV1
>();

export interface VerifyProviderRuntimeKernelPeerCredentialsOptionsV1 {
  /** The live accepted/connected Unix-domain socket whose peer is being checked. */
  readonly socket: Socket;
  /** Expected identity comes from signed/trusted service configuration, not IPC. */
  readonly expected: ProviderRuntimeKernelPeerCredentialsV1;
  /** Sealed once by the trusted composition root around a native kernel helper. */
  readonly helper: TrustedProviderRuntimeKernelPeerCredentialHelperV1;
}

export interface ProviderRuntimeKernelPeerCandidateV1 {
  readonly status: "kernel_os_peer_candidate";
  readonly authority: "none";
  readonly accessMode: "read_only";
  readonly strongWriteStatus: "locked";
  readonly requiredNext: typeof PROVIDER_RUNTIME_KERNEL_PEER_REQUIRED_NEXT_V1;
  readonly bindings: Readonly<{
    readonly platform: ProviderRuntimeKernelPeerCredentialPlatformV1;
    readonly mechanism: ProviderRuntimeKernelPeerCredentialMechanismV1;
    readonly uid: number;
    readonly gid: number;
    readonly pid: number;
  }>;
}

export interface ProviderRuntimeKernelPeerUnavailableV1 {
  readonly status: "unavailable";
  readonly authority: "none";
  readonly accessMode: "read_only";
  readonly strongWriteStatus: "locked";
  readonly reason:
    | "identity_mismatch"
    | "kernel_helper_invalid"
    | "kernel_helper_unavailable";
}

export type ProviderRuntimeKernelPeerCredentialResultV1 =
  | ProviderRuntimeKernelPeerCandidateV1
  | ProviderRuntimeKernelPeerUnavailableV1;

function unavailableV1(
  reason: ProviderRuntimeKernelPeerUnavailableV1["reason"],
): ProviderRuntimeKernelPeerUnavailableV1 {
  return Object.freeze({
    status: "unavailable" as const,
    authority: "none" as const,
    accessMode: "read_only" as const,
    strongWriteStatus: "locked" as const,
    reason,
  });
}

function isPlatformMechanismPairV1(
  platform: ProviderRuntimeKernelPeerCredentialPlatformV1,
  mechanism: ProviderRuntimeKernelPeerCredentialMechanismV1,
): boolean {
  return (
    (platform === "linux" && mechanism === "linux_so_peercred") ||
    (platform === "darwin" &&
      mechanism === "darwin_getpeereid_local_peercred_peerpid")
  );
}

function kernelIdV1(value: number, label: "gid" | "pid" | "uid"): number {
  const minimum = label === "pid" ? 1 : 0;
  const maximum = label === "pid" ? 0x7fff_ffff : 0xffff_ffff;
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`kernel peer ${label} is invalid`);
  }
  return value;
}

function parseCredentialsV1(value: unknown): ProviderRuntimeKernelPeerCredentialsV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("kernel peer credentials are invalid");
  }
  const candidate = value as Record<string, unknown>;
  if (
    Object.keys(candidate).some(
      (key) => key !== "uid" && key !== "gid" && key !== "pid",
    )
  ) {
    throw new TypeError("kernel peer credentials contain unknown fields");
  }
  return Object.freeze({
    uid: kernelIdV1(candidate.uid as number, "uid"),
    gid: kernelIdV1(candidate.gid as number, "gid"),
    pid: kernelIdV1(candidate.pid as number, "pid"),
  });
}

/**
 * Trust-boundary operation: call only while assembling the provider process
 * around a pinned native helper that uses SO_PEERCRED or
 * getpeereid/LOCAL_PEERCRED plus LOCAL_PEERPID.
 * Never expose this operation through an IPC/request-data adapter.
 */
export function sealTrustedProviderRuntimeKernelPeerCredentialHelperV1(
  reader: ProviderRuntimeKernelPeerCredentialReaderV1,
): TrustedProviderRuntimeKernelPeerCredentialHelperV1 {
  if (
    (reader.platform !== "darwin" && reader.platform !== "linux") ||
    !isPlatformMechanismPairV1(reader.platform, reader.mechanism) ||
    reader.platform !== process.platform ||
    typeof reader.readPeerCredentials !== "function"
  ) {
    throw new TypeError("kernel peer credential reader is invalid");
  }

  const capability = Object.freeze(
    Object.create(null),
  ) as TrustedProviderRuntimeKernelPeerCredentialHelperV1;
  trustedReadersV1.set(
    capability,
    Object.freeze({
      platform: reader.platform,
      mechanism: reader.mechanism,
      readPeerCredentials: reader.readPeerCredentials,
    }),
  );
  return capability;
}

export async function verifyProviderRuntimeKernelPeerCredentialsV1(
  options: VerifyProviderRuntimeKernelPeerCredentialsOptionsV1,
): Promise<ProviderRuntimeKernelPeerCredentialResultV1> {
  const expected = parseCredentialsV1(options.expected);
  const reader = trustedReadersV1.get(options.helper);
  if (reader === undefined) {
    return unavailableV1("kernel_helper_unavailable");
  }
  if (!(options.socket instanceof Socket) || options.socket.destroyed) {
    return unavailableV1("kernel_helper_unavailable");
  }

  const observed = await Promise.resolve()
    .then(() => reader.readPeerCredentials(options.socket))
    .then(
      (value) => {
        try {
          return parseCredentialsV1(value);
        } catch {
          return undefined;
        }
      },
      () => undefined,
    );
  if (observed === undefined) {
    return unavailableV1("kernel_helper_invalid");
  }
  if (
    observed.uid !== expected.uid ||
    observed.gid !== expected.gid ||
    observed.pid !== expected.pid
  ) {
    return unavailableV1("identity_mismatch");
  }

  return Object.freeze({
    status: "kernel_os_peer_candidate" as const,
    authority: "none" as const,
    accessMode: "read_only" as const,
    strongWriteStatus: "locked" as const,
    requiredNext: PROVIDER_RUNTIME_KERNEL_PEER_REQUIRED_NEXT_V1,
    bindings: Object.freeze({
      platform: reader.platform,
      mechanism: reader.mechanism,
      uid: observed.uid,
      gid: observed.gid,
      pid: observed.pid,
    }),
  });
}
