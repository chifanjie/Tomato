import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  lstat,
  readFile,
  realpath,
} from "node:fs/promises";
import { createConnection, type Socket } from "node:net";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";

import {
  PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
  ProviderRuntimeIpcClientHelloV1Schema,
  ProviderRuntimeIpcInspectStateResultV1Schema,
  ProviderRuntimeIpcRequestV1Schema,
  ProviderRuntimeIpcResponseV1Schema,
  ProviderRuntimeIpcServerHelloV1Schema,
  canonicalizeProviderRuntimeIpcAuthenticatedClaimsV1,
  type ProviderRuntimeIpcClientHelloV1,
  type ProviderRuntimeIpcRequestV1,
  type ProviderRuntimeIpcResponseV1,
  type ProviderRuntimeIpcServerHelloV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import {
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  type ContentDigestV1,
  type DurableObjectIdentityProviderIdV1,
} from "@understand-code/durable-object-provider-contracts/primitives";

import {
  readProviderServiceReadinessV1,
  verifyProviderServiceHandoffConfigV1,
  type ProviderServiceHandoffConfigV1,
  type ProviderServiceHandoffInspectionV1,
} from "./service-handoff.js";
import {
  assertProviderRuntimeTargetContinuityV1,
  type ProviderRuntimeTargetInspectionV1,
} from "./target-inspection.js";

/**
 * This verifier is a live candidate probe, not a Store authority.  It proves
 * that an authenticated runtime answered an inspect request and that the
 * signed service receipt still names the same target.  Strong writes remain
 * locked until the independent Registry/OS-principal gate is closed.
 */
export type ProviderRuntimeLiveServiceReadinessResultV1 =
  | Readonly<{
      readonly status: "live_candidate";
      readonly authority: "read_only";
      readonly strongWrites: "locked";
      readonly providerId: DurableObjectIdentityProviderIdV1;
      readonly targetFingerprintDigest: ContentDigestV1;
      readonly inspectedRevision: number;
    }>
  | Readonly<{
      readonly status: "unavailable";
      readonly authority: "read_only";
      readonly strongWrites: "locked";
      readonly reason:
        | "invalid_config"
        | "target_continuity_changed"
        | "runtime_root_mismatch"
        | "socket_identity_mismatch"
        | "auth_identity_mismatch"
        | "authentication_failed"
        | "provider_identity_mismatch"
        | "readiness_unavailable"
        | "readiness_stale"
        | "ipc_unavailable";
    }>;

export interface VerifyProviderRuntimeLiveServiceReadinessOptionsV1 {
  /** Signed handoff config carrying the socket, key, and receipt locators. */
  readonly config: ProviderServiceHandoffConfigV1;
  /** Optional previously redacted Doctor projection to cross-check first. */
  readonly inspection?: ProviderServiceHandoffInspectionV1;
  /** Private target baseline captured before the service was started. */
  readonly targetBaseline: ProviderRuntimeTargetInspectionV1;
  /** Test/privileged caller override; otherwise the signed auth-key path is read. */
  readonly authKey?: Uint8Array;
  readonly expectedInstallationIdentityDigest?: ContentDigestV1;
  readonly timeoutMs?: number;
  /** Narrow transport/readiness seam for host-process tests; production defaults to the signed file reader. */
  readonly readinessReader?: typeof readProviderServiceReadinessV1;
}

type AuthenticatedWireV1 =
  | ProviderRuntimeIpcClientHelloV1
  | ProviderRuntimeIpcServerHelloV1
  | ProviderRuntimeIpcRequestV1
  | ProviderRuntimeIpcResponseV1;

const ZERO_AUTH_TAG_V1 = `hmac-sha256:${"0".repeat(64)}`;
const IPC_TIMEOUT_MS_V1 = 5_000;

function unavailableV1(
  reason: ProviderRuntimeLiveServiceReadinessResultV1 extends infer _T
    ? Exclude<
        ProviderRuntimeLiveServiceReadinessResultV1,
        { readonly status: "live_candidate" }
      >["reason"]
    : never,
): ProviderRuntimeLiveServiceReadinessResultV1 {
  return Object.freeze({
    status: "unavailable" as const,
    authority: "read_only" as const,
    strongWrites: "locked" as const,
    reason,
  });
}

function isErrnoV1(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}

function signWireV1<T extends AuthenticatedWireV1>(
  key: Uint8Array,
  wire: T,
): T {
  const unsigned = { ...wire, authTag: ZERO_AUTH_TAG_V1 } as T;
  const authTag = `hmac-sha256:${createHmac("sha256", key)
    .update(canonicalizeProviderRuntimeIpcAuthenticatedClaimsV1(unsigned))
    .digest("hex")}`;
  return { ...wire, authTag } as T;
}

function verifyWireV1(key: Uint8Array, wire: AuthenticatedWireV1): boolean {
  const expected = signWireV1(key, { ...wire, authTag: ZERO_AUTH_TAG_V1 } as AuthenticatedWireV1)
    .authTag;
  const actualBytes = Buffer.from(wire.authTag, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return (
    actualBytes.byteLength === expectedBytes.byteLength &&
    timingSafeEqual(actualBytes, expectedBytes)
  );
}

function frameV1(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

function positiveTimeoutV1(value: number | undefined): number {
  const timeout = value ?? IPC_TIMEOUT_MS_V1;
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 60_000) {
    throw new Error("live readiness timeout is invalid");
  }
  return timeout;
}

async function connectV1(path: string, timeoutMs: number): Promise<Socket> {
  return new Promise<Socket>((resolvePromise, rejectPromise) => {
    const socket = createConnection({ path });
    let settled = false;
    const timer = setTimeout(() => {
      socket.destroy();
      if (!settled) {
        settled = true;
        rejectPromise(new Error("runtime IPC connection timed out"));
      }
    }, timeoutMs);
    const fail = (error: Error): void => {
      clearTimeout(timer);
      socket.destroy();
      if (!settled) {
        settled = true;
        rejectPromise(error);
      }
    };
    socket.once("error", fail);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.off("error", fail);
      socket.setTimeout(timeoutMs, () => socket.destroy());
      if (!settled) {
        settled = true;
        resolvePromise(socket);
      }
    });
  });
}

async function inspectOverAuthenticatedIpcV1(input: {
  readonly socketPath: string;
  readonly authKey: Uint8Array;
  readonly capabilityDigest: ContentDigestV1;
  readonly timeoutMs: number;
}): Promise<{ readonly revision: number }> {
  const socket = await connectV1(input.socketPath, input.timeoutMs);
  const lines = createInterface({ input: socket, crlfDelay: Infinity });
  const iterator = lines[Symbol.asyncIterator]();
  const clientNonce = randomBytes(32).toString("hex");
  try {
    const hello = ProviderRuntimeIpcClientHelloV1Schema.parse(
      signWireV1(input.authKey, {
        protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
        kind: "client_hello",
        clientNonce: ProviderRuntimeIpcClientHelloV1Schema.shape.clientNonce.parse(clientNonce),
        capabilityDigest: input.capabilityDigest,
        authTag: ZERO_AUTH_TAG_V1,
      }),
    );
    socket.write(frameV1(hello));
    const helloLine = await iterator.next();
    if (helloLine.done) throw new Error("runtime IPC closed before server hello");
    const serverHello = ProviderRuntimeIpcServerHelloV1Schema.parse(
      JSON.parse(helloLine.value),
    );
    if (
      serverHello.clientNonce !== clientNonce ||
      !verifyWireV1(input.authKey, serverHello)
    ) {
      throw new Error("runtime server hello authentication failed");
    }
    const requestId = randomBytes(16).toString("hex");
    const request = ProviderRuntimeIpcRequestV1Schema.parse(
      signWireV1(input.authKey, {
        protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
        kind: "request",
        sessionId: serverHello.sessionId,
        requestId: ProviderRuntimeIpcRequestV1Schema.options[0].shape.requestId.parse(requestId),
        sequence: 1,
        capabilityDigest: input.capabilityDigest,
        operation: "inspect_state",
        payload: {},
        authTag: ZERO_AUTH_TAG_V1,
      }),
    );
    socket.write(frameV1(request));
    const responseLine = await iterator.next();
    if (responseLine.done) throw new Error("runtime IPC closed before response");
    const response = ProviderRuntimeIpcResponseV1Schema.parse(
      JSON.parse(responseLine.value),
    );
    if (
      response.sessionId !== serverHello.sessionId ||
      response.requestId !== requestId ||
      response.sequence !== 1 ||
      !verifyWireV1(input.authKey, response)
    ) {
      throw new Error("runtime response authentication failed");
    }
    if (!response.ok) throw new Error(`runtime inspect failed: ${response.error.code}`);
    const payload = ProviderRuntimeIpcInspectStateResultV1Schema.parse(response.payload);
    return { revision: payload.state.revision };
  } finally {
    lines.close();
    socket.destroy();
  }
}

async function readAuthKeyV1(
  config: ProviderServiceHandoffConfigV1,
  override: Uint8Array | undefined,
): Promise<{ readonly key: Uint8Array; readonly owned: boolean }> {
  const metadata = await lstat(config.payload.authKeyPath);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    (metadata.mode & 0o777) !== 0o600 ||
    metadata.uid !== config.payload.principal.uid ||
    metadata.gid !== config.payload.principal.gid
  ) {
    throw new Error("runtime auth key identity is invalid");
  }
  const key = await readFile(config.payload.authKeyPath);
  if (key.byteLength !== 32) throw new Error("runtime auth key length is invalid");
  if (override !== undefined) {
    if (!(override instanceof Uint8Array) || override.byteLength !== 32) {
      throw new Error("runtime auth key must contain exactly 32 bytes");
    }
    if (!timingSafeEqual(Buffer.from(override), key)) {
      throw new Error("runtime auth key identity does not match signed handoff");
    }
  }
  return { key: Uint8Array.from(key), owned: true };
}

async function verifySocketIdentityV1(
  config: ProviderServiceHandoffConfigV1,
): Promise<void> {
  const metadata = await lstat(config.payload.socketPath);
  if (
    !metadata.isSocket() ||
    metadata.isSymbolicLink() ||
    (metadata.mode & 0o077) !== 0 ||
    metadata.uid !== config.payload.principal.uid ||
    metadata.gid !== config.payload.principal.gid
  ) {
    throw new Error("runtime socket identity is invalid");
  }
}

async function verifyJournalProviderIdentityV1(
  config: ProviderServiceHandoffConfigV1,
): Promise<void> {
  const raw = await readFile(join(config.payload.runtimeRoot, "journal", "state.json"), "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("runtime journal identity is invalid");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    Object.getPrototypeOf(parsed) !== Object.prototype ||
    (parsed as { readonly providerId?: unknown }).providerId !== config.payload.providerId
  ) {
    throw new Error("runtime provider identity does not match handoff");
  }
  DurableObjectIdentityProviderIdV1Schema.parse(
    (parsed as { readonly providerId: unknown }).providerId,
  );
}

function mapFailureV1(error: unknown): Exclude<
  Exclude<ProviderRuntimeLiveServiceReadinessResultV1, { readonly status: "live_candidate" }>,
  never
>["reason"] {
  const message = error instanceof Error ? error.message : String(error);
  if (/target continuity|target changed|baseline/u.test(message)) return "target_continuity_changed";
  if (/runtime provider identity|provider identity/u.test(message)) return "provider_identity_mismatch";
  if (/socket identity/u.test(message)) return "socket_identity_mismatch";
  if (/auth key identity/u.test(message)) return "auth_identity_mismatch";
  if (/authentication/u.test(message)) return "authentication_failed";
  if (/readiness/u.test(message)) return "readiness_unavailable";
  if (/runtime IPC|connect|closed|timed out|inspect failed/u.test(message)) return "ipc_unavailable";
  return "invalid_config";
}

/**
 * Verify a running service against a signed handoff and a target continuity
 * baseline.  Every successful result remains a read-only, strong-write-locked
 * candidate; failures are intentionally reduced to stable reason codes.
 */
export async function verifyProviderRuntimeLiveServiceReadinessV1(
  input: VerifyProviderRuntimeLiveServiceReadinessOptionsV1,
): Promise<ProviderRuntimeLiveServiceReadinessResultV1> {
  let key: Uint8Array | undefined;
  try {
    const config = verifyProviderServiceHandoffConfigV1(
      input.config,
      input.expectedInstallationIdentityDigest,
    );
    const baseline = input.targetBaseline;
    if (
      input.inspection !== undefined &&
      (input.inspection.providerId !== undefined &&
        input.inspection.providerId !== config.payload.providerId)
    ) {
      return unavailableV1("provider_identity_mismatch");
    }
    if (
      input.inspection !== undefined &&
      (input.inspection.status === "unavailable" ||
        input.inspection.status === "valid_unprovisioned" ||
        input.inspection.authority !== "read_only" ||
        input.inspection.strongWrites !== "locked")
    ) {
      return unavailableV1("readiness_unavailable");
    }
    const currentBefore = await assertProviderRuntimeTargetContinuityV1(baseline);
    const canonicalConfigRoot = await realpath(config.payload.runtimeRoot);
    if (canonicalConfigRoot !== currentBefore.canonicalRootPath) {
      return unavailableV1("runtime_root_mismatch");
    }
    const canonicalSocketParent = await realpath(dirname(config.payload.socketPath));
    if (canonicalSocketParent !== canonicalConfigRoot) {
      return unavailableV1("runtime_root_mismatch");
    }
    await verifySocketIdentityV1(config);
    const loaded = await readAuthKeyV1(config, input.authKey);
    key = loaded.key;
    const ipc = await inspectOverAuthenticatedIpcV1({
      socketPath: config.payload.socketPath,
      authKey: key,
      capabilityDigest: config.payload.capabilityDigest,
      timeoutMs: positiveTimeoutV1(input.timeoutMs),
    });
    await verifyJournalProviderIdentityV1(config);
    const readiness = await (input.readinessReader ?? readProviderServiceReadinessV1)({
      config,
      readinessPath: config.payload.readinessPath,
      expectedInstallationIdentityDigest: input.expectedInstallationIdentityDigest,
    });
    if (readiness.status !== "signed_candidate") {
      return unavailableV1("readiness_unavailable");
    }
    if (readiness.providerId !== config.payload.providerId) {
      return unavailableV1("provider_identity_mismatch");
    }
    if (readiness.targetFingerprintDigest !== currentBefore.targetFingerprintDigest) {
      return unavailableV1("readiness_stale");
    }
    const currentAfter = await assertProviderRuntimeTargetContinuityV1(baseline);
    if (currentAfter.targetFingerprintDigest !== readiness.targetFingerprintDigest) {
      return unavailableV1("readiness_stale");
    }
    return Object.freeze({
      status: "live_candidate" as const,
      authority: "read_only" as const,
      strongWrites: "locked" as const,
      providerId: config.payload.providerId,
      targetFingerprintDigest: ContentDigestV1Schema.parse(
        currentAfter.targetFingerprintDigest,
      ),
      inspectedRevision: ipc.revision,
    });
  } catch (error) {
    return unavailableV1(mapFailureV1(error));
  } finally {
    if (key !== undefined) key.fill(0);
  }
}

export const diagnoseProviderRuntimeLiveServiceReadinessV1 =
  verifyProviderRuntimeLiveServiceReadinessV1;
