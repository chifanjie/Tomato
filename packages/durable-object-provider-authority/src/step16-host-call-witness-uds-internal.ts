import {
  readProviderRuntimeNativeKernelPeerCredentialsV1,
  type ProviderRuntimeNativeKernelPeerCredentialsV1,
} from "@understand-code/native-kernel-bridge";
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  fsyncSync,
  lstatSync,
  openSync,
  type Stats,
  unlinkSync,
} from "node:fs";
import { dirname, isAbsolute, normalize, resolve } from "node:path";
import {
  createServer,
  type Server as NetServer,
  type Socket,
} from "node:net";
import { TextDecoder } from "node:util";

import {
  createStep16HostCallWitnessServerCoreInternalV1,
  type Step16HostCallWitnessAuthorityCallbacksInternalV1,
  type Step16HostCallWitnessClosingPlanInternalV1,
  type Step16HostCallWitnessConnectionInternalV1,
  type Step16HostCallWitnessServerCoreInternalV1,
} from "./step16-host-call-witness-server-internal.js";
import type { ProviderProductionStrongAuthorityStep16ProviderReceiptBindingInternalV1 } from "./provider-production-strong-authority-service.js";

export const STEP16_HOST_CALL_WITNESS_UDS_PROFILE_INTERNAL_V1 =
  "step16_host_call_witness_uds_v1" as const;

export const STEP16_HOST_CALL_WITNESS_UDS_LIMITS_INTERNAL_V1 = Object.freeze({
  maxConnectionBytes: 32 * 1024 * 1024,
  maxFrameBytes: 64 * 1024,
  maxFrames: 8192,
  maxResponseBytes: 32 * 1024 * 1024,
  defaultTimeoutMs: 5000,
  maxTimeoutMs: 60_000,
});

export interface Step16HostCallWitnessUdsServerInternalV1 {
  readonly profile: typeof STEP16_HOST_CALL_WITNESS_UDS_PROFILE_INTERNAL_V1;
  readonly socketPath: string;
  close(): Promise<void>;
}

export interface Step16HostCallWitnessUdsCompletionInternalV1 {
  readonly strongCallProviderReceipts: readonly Readonly<{
    readonly callIdDigest: string;
    readonly receiptBundleDigests: readonly string[];
  }>[];
  readonly providerBindings:
    readonly ProviderProductionStrongAuthorityStep16ProviderReceiptBindingInternalV1[];
}

export interface StartStep16HostCallWitnessUdsServerInternalV1Options {
  readonly socketPath: string;
  readonly directSupervisorPid: number;
  readonly closingPlan: Step16HostCallWitnessClosingPlanInternalV1;
  readonly authority: Step16HostCallWitnessAuthorityCallbacksInternalV1;
  readonly timeoutMs?: number;
}

export interface Step16HostCallWitnessUdsServerDependenciesInternalV1 {
  readonly filesystemOwnerUid: number;
  readonly filesystemOwnerGid: number;
  readonly readPeerCredentials: (
    socket: Socket,
  ) => ProviderRuntimeNativeKernelPeerCredentialsV1;
}

type WireRequest = Readonly<Record<string, unknown>>;

interface FileIdentity {
  readonly dev: number;
  readonly ino: number;
}

interface LeaseState {
  socket: Socket | undefined;
  live: boolean;
}

interface ObservedProviderOperation {
  readonly operation: "write_object" | "compare_commit";
  readonly operationNonce: string;
  readonly requestDigest: string;
}

const REQUEST_KEYS = Object.freeze({
  hello: Object.freeze([
    "profile",
    "kind",
    "sequence",
    "closingPlanDigest",
    "runNonce",
  ]),
  arm: Object.freeze(["profile", "kind", "sequence", "callOrdinal"]),
  observe_provider_operation: Object.freeze([
    "profile",
    "kind",
    "sequence",
    "token",
    "operation",
    "operationNonce",
    "requestDigest",
  ]),
  complete: Object.freeze([
    "profile",
    "kind",
    "sequence",
    "token",
    "sessionIdDigest",
    "callIdDigest",
  ]),
  abort: Object.freeze([
    "profile",
    "kind",
    "sequence",
    "token",
  ]),
  finalize: Object.freeze(["profile", "kind", "sequence"]),
});

const SAFE_FAILURE_MESSAGE = "step16 witness transport unavailable";
const SHA256_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const OPERATION_NONCE_PATTERN = /^[0-9a-f]{32}$/u;

function safeFailure(): Error {
  return new Error(SAFE_FAILURE_MESSAGE);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  return (
    actual.length === required.length &&
    actual.every((key, index) => key === required[index])
  );
}

function requireSafePositiveInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw safeFailure();
  }
  return value as number;
}

function requireDigest(value: unknown): string {
  if (typeof value !== "string" || !SHA256_DIGEST_PATTERN.test(value)) {
    throw safeFailure();
  }
  return value;
}

function requireOperationNonce(value: unknown): string {
  if (typeof value !== "string" || !OPERATION_NONCE_PATTERN.test(value)) {
    throw safeFailure();
  }
  return value;
}

function requireLiteral<T extends string>(value: unknown, expected: T): T {
  if (value !== expected) {
    throw safeFailure();
  }
  return expected;
}

function requireOneOf<T extends string>(
  value: unknown,
  expected: readonly T[],
): T {
  if (typeof value !== "string" || !expected.includes(value as T)) {
    throw safeFailure();
  }
  return value as T;
}

function requireExactRecord(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> {
  if (!isRecord(value) || !hasExactKeys(value, keys)) {
    throw safeFailure();
  }
  return value;
}

function projectPublicProviderBinding(
  value: unknown,
): ProviderProductionStrongAuthorityStep16ProviderReceiptBindingInternalV1 {
  const binding = requireExactRecord(value, [
    "schemaVersion",
    "profile",
    "host",
    "sessionIdDigest",
    "callIdDigest",
    "providerIdentityDigest",
    "receiptLedger",
    "providerOperation",
    "componentDigests",
    "privateBundleVerification",
  ]);
  if (binding.schemaVersion !== 1) {
    throw safeFailure();
  }
  const receiptLedger = requireExactRecord(binding.receiptLedger, [
    "authority",
    "locatorPolicy",
    "receiptBundleDigest",
  ]);
  const providerOperation = requireExactRecord(binding.providerOperation, [
    "operation",
    "operationNonce",
    "requestDigest",
    "sessionBindingDigest",
    "principalAttestationDigest",
    "authorityGrantContentDigest",
    "responseResolution",
  ]);
  const componentDigests = requireExactRecord(binding.componentDigests, [
    "strongMutationRequest",
    "strongMutationResponse",
    "principalAttestation",
    "authorityGrantEnvelope",
    "authorityGrantSignature",
    "responseSignature",
    "principalAttestationSignature",
  ]);
  const privateBundleVerification = requireExactRecord(
    binding.privateBundleVerification,
    ["status", "verifierProfile", "verifiedBindings"],
  );
  const verifiedBindings = privateBundleVerification.verifiedBindings;
  if (
    !Array.isArray(verifiedBindings) ||
    verifiedBindings.length !== 5 ||
    verifiedBindings[0] !== "request_digest" ||
    verifiedBindings[1] !== "session_binding" ||
    verifiedBindings[2] !== "authority_grant_signature" ||
    verifiedBindings[3] !== "response_signature" ||
    verifiedBindings[4] !== "principal_attestation_signature"
  ) {
    throw safeFailure();
  }
  const operationNonce = providerOperation.operationNonce;
  if (
    typeof operationNonce !== "string" ||
    !OPERATION_NONCE_PATTERN.test(operationNonce)
  ) {
    throw safeFailure();
  }

  return Object.freeze({
    schemaVersion: 1 as const,
    profile: requireLiteral(binding.profile, "step16_provider_receipt_binding_v1"),
    host: requireOneOf(binding.host, ["codex", "claude"] as const),
    sessionIdDigest: requireDigest(binding.sessionIdDigest),
    callIdDigest: requireDigest(binding.callIdDigest),
    providerIdentityDigest: requireDigest(binding.providerIdentityDigest),
    receiptLedger: Object.freeze({
      authority: requireLiteral(
        receiptLedger.authority,
        "root_owned_private_provider_receipt_ledger",
      ),
      locatorPolicy: requireLiteral(
        receiptLedger.locatorPolicy,
        "fixed_locator_component_nofollow",
      ),
      receiptBundleDigest: requireDigest(receiptLedger.receiptBundleDigest),
    }),
    providerOperation: Object.freeze({
      operation: requireOneOf(providerOperation.operation, [
        "write_object",
        "compare_commit",
      ] as const),
      operationNonce,
      requestDigest: requireDigest(providerOperation.requestDigest),
      sessionBindingDigest: requireDigest(
        providerOperation.sessionBindingDigest,
      ),
      principalAttestationDigest: requireDigest(
        providerOperation.principalAttestationDigest,
      ),
      authorityGrantContentDigest: requireDigest(
        providerOperation.authorityGrantContentDigest,
      ),
      responseResolution: requireOneOf(providerOperation.responseResolution, [
        "committed",
        "replayed",
      ] as const),
    }),
    componentDigests: Object.freeze({
      strongMutationRequest: requireDigest(
        componentDigests.strongMutationRequest,
      ),
      strongMutationResponse: requireDigest(
        componentDigests.strongMutationResponse,
      ),
      principalAttestation: requireDigest(
        componentDigests.principalAttestation,
      ),
      authorityGrantEnvelope: requireDigest(
        componentDigests.authorityGrantEnvelope,
      ),
      authorityGrantSignature: requireDigest(
        componentDigests.authorityGrantSignature,
      ),
      responseSignature: requireDigest(componentDigests.responseSignature),
      principalAttestationSignature: requireDigest(
        componentDigests.principalAttestationSignature,
      ),
    }),
    privateBundleVerification: Object.freeze({
      status: requireLiteral(privateBundleVerification.status, "verified"),
      verifierProfile: requireLiteral(
        privateBundleVerification.verifierProfile,
        "provider_runtime_ipc_full_private_bundle_verifier_v1",
      ),
      verifiedBindings: Object.freeze([
        "request_digest",
        "session_binding",
        "authority_grant_signature",
        "response_signature",
        "principal_attestation_signature",
      ] as const),
    }),
  });
}

function normalizeSocketPath(value: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\0") ||
    !isAbsolute(value)
  ) {
    throw safeFailure();
  }
  const canonical = resolve(normalize(value));
  if (canonical !== value || dirname(canonical) === canonical) {
    throw safeFailure();
  }
  return canonical;
}

function requireTimeoutMs(value: number | undefined): number {
  const timeoutMs =
    value ?? STEP16_HOST_CALL_WITNESS_UDS_LIMITS_INTERNAL_V1.defaultTimeoutMs;
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > STEP16_HOST_CALL_WITNESS_UDS_LIMITS_INTERNAL_V1.maxTimeoutMs
  ) {
    throw safeFailure();
  }
  return timeoutMs;
}

function fileIdentity(stats: Stats): FileIdentity {
  return Object.freeze({ dev: stats.dev, ino: stats.ino });
}

function sameIdentity(stats: Stats, expected: FileIdentity): boolean {
  return stats.dev === expected.dev && stats.ino === expected.ino;
}

function requireSecureParent(
  parentPath: string,
  ownerUid: number,
  ownerGid: number,
  expectedIdentity?: FileIdentity,
): FileIdentity {
  let stats: Stats;
  try {
    stats = lstatSync(parentPath);
  } catch {
    throw safeFailure();
  }
  if (
    !stats.isDirectory() ||
    stats.isSymbolicLink() ||
    stats.uid !== ownerUid ||
    stats.gid !== ownerGid ||
    (stats.mode & 0o7777) !== 0o700 ||
    (expectedIdentity !== undefined && !sameIdentity(stats, expectedIdentity))
  ) {
    throw safeFailure();
  }
  return fileIdentity(stats);
}

function requireMissingSocketPath(socketPath: string): void {
  try {
    lstatSync(socketPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw safeFailure();
  }
  throw safeFailure();
}

function requireSecureSocket(
  socketPath: string,
  ownerUid: number,
  ownerGid: number,
  expectedIdentity?: FileIdentity,
): FileIdentity {
  let stats: Stats;
  try {
    stats = lstatSync(socketPath);
  } catch {
    throw safeFailure();
  }
  if (
    !stats.isSocket() ||
    stats.isSymbolicLink() ||
    stats.uid !== ownerUid ||
    stats.gid !== ownerGid ||
    (stats.mode & 0o7777) !== 0o600 ||
    (expectedIdentity !== undefined && !sameIdentity(stats, expectedIdentity))
  ) {
    throw safeFailure();
  }
  return fileIdentity(stats);
}

function syncDirectory(path: string): void {
  const flags =
    fsConstants.O_RDONLY |
    fsConstants.O_DIRECTORY |
    fsConstants.O_NOFOLLOW;
  let descriptor: number | undefined;
  try {
    descriptor = openSync(path, flags);
    fsyncSync(descriptor);
  } catch {
    throw safeFailure();
  } finally {
    if (descriptor !== undefined) {
      closeSync(descriptor);
    }
  }
}

function unlinkOwnedSocket(
  socketPath: string,
  socketIdentity: FileIdentity | undefined,
  parentPath: string,
  parentIdentity: FileIdentity,
  ownerUid: number,
  ownerGid: number,
): void {
  if (socketIdentity === undefined) {
    return;
  }
  try {
    lstatSync(socketPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw safeFailure();
  }
  try {
    const parent = requireSecureParent(
      parentPath,
      ownerUid,
      ownerGid,
      parentIdentity,
    );
    requireSecureSocket(socketPath, ownerUid, ownerGid, socketIdentity);
    unlinkSync(socketPath);
    requireSecureParent(parentPath, ownerUid, ownerGid, parent);
    syncDirectory(parentPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw safeFailure();
  }
}

function parseWireRequest(line: Buffer): WireRequest {
  if (line.length === 0 || line.includes(0x0d)) {
    throw safeFailure();
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(line);
  } catch {
    throw safeFailure();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw safeFailure();
  }
  if (!isRecord(parsed)) {
    throw safeFailure();
  }
  if (
    parsed.profile !== STEP16_HOST_CALL_WITNESS_UDS_PROFILE_INTERNAL_V1 ||
    typeof parsed.kind !== "string" ||
    !(parsed.kind in REQUEST_KEYS)
  ) {
    throw safeFailure();
  }
  const expected = REQUEST_KEYS[parsed.kind as keyof typeof REQUEST_KEYS];
  if (!hasExactKeys(parsed, expected)) {
    throw safeFailure();
  }
  return parsed;
}

function projectCoreFrame(request: WireRequest): Readonly<Record<string, unknown>> {
  const projected = Object.create(null) as Record<string, unknown>;
  for (const [key, value] of Object.entries(request)) {
    if (key !== "profile") {
      projected[key] = value;
    }
  }
  return Object.freeze(projected);
}

function listen(server: NetServer, socketPath: string): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const onError = (): void => {
      server.off("listening", onListening);
      rejectPromise(safeFailure());
    };
    const onListening = (): void => {
      server.off("error", onError);
      resolvePromise();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(socketPath);
  });
}

function closeListener(server: NetServer): Promise<void> {
  if (!server.listening) {
    return Promise.resolve();
  }
  return new Promise((resolvePromise) => {
    server.close(() => resolvePromise());
  });
}

function settlesWithinV1(promise: Promise<unknown>, timeoutMs: number): Promise<boolean> {
  return new Promise((resolvePromise) => {
    let settled = false;
    const finish = (value: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise(value);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    void promise.then(
      () => finish(true),
      () => finish(true),
    );
  });
}

function writeJsonLine(socket: Socket, value: unknown): Promise<void> {
  let payload: string;
  try {
    payload = `${JSON.stringify(value)}\n`;
  } catch {
    throw safeFailure();
  }
  if (
    Buffer.byteLength(payload, "utf8") >
    STEP16_HOST_CALL_WITNESS_UDS_LIMITS_INTERNAL_V1.maxResponseBytes
  ) {
    throw safeFailure();
  }
  return new Promise((resolvePromise, rejectPromise) => {
    socket.write(payload, "utf8", (error) => {
      if (error != null) {
        rejectPromise(safeFailure());
        return;
      }
      resolvePromise();
    });
  });
}

class Step16HostCallWitnessUdsServerImplementationInternalV1
  implements Step16HostCallWitnessUdsServerInternalV1
{
  readonly profile = STEP16_HOST_CALL_WITNESS_UDS_PROFILE_INTERNAL_V1;
  readonly socketPath: string;

  readonly #parentPath: string;
  readonly #parentIdentity: FileIdentity;
  readonly #ownerUid: number;
  readonly #ownerGid: number;
  readonly #directSupervisorPid: number;
  readonly #timeoutMs: number;
  readonly #readPeerCredentials: (
    socket: Socket,
  ) => ProviderRuntimeNativeKernelPeerCredentialsV1;
  readonly #leaseState: LeaseState;
  readonly #core: Step16HostCallWitnessServerCoreInternalV1;
  readonly #plannedHostByCallOrdinal: ReadonlyMap<number, "codex" | "claude">;
  readonly #server: NetServer;
  readonly #sockets = new Set<Socket>();
  readonly #tasks = new Set<Promise<void>>();
  readonly #strongCallProviderReceipts: Array<Readonly<{
    readonly callIdDigest: string;
    readonly receiptBundleDigests: readonly string[];
  }>> = [];
  readonly #providerBindings:
    ProviderProductionStrongAuthorityStep16ProviderReceiptBindingInternalV1[] = [];
  readonly #seenReceiptBundleDigests = new Set<string>();

  #socketIdentity: FileIdentity | undefined;
  #connection: Step16HostCallWitnessConnectionInternalV1 | undefined;
  #pendingProviderBindings:
    | readonly ProviderProductionStrongAuthorityStep16ProviderReceiptBindingInternalV1[]
    | undefined;
  #activeHost: "codex" | "claude" | undefined;
  #observedProviderOperations: ObservedProviderOperation[] = [];
  #accepted = false;
  #active = false;
  #finalized = false;
  #nextSequence = 1;
  #closePromise: Promise<void> | undefined;

  constructor(
    options: StartStep16HostCallWitnessUdsServerInternalV1Options,
    dependencies: Step16HostCallWitnessUdsServerDependenciesInternalV1,
    socketPath: string,
    parentIdentity: FileIdentity,
    timeoutMs: number,
  ) {
    this.socketPath = socketPath;
    this.#parentPath = dirname(socketPath);
    this.#parentIdentity = parentIdentity;
    this.#ownerUid = dependencies.filesystemOwnerUid;
    this.#ownerGid = dependencies.filesystemOwnerGid;
    this.#directSupervisorPid = options.directSupervisorPid;
    this.#timeoutMs = timeoutMs;
    this.#readPeerCredentials = dependencies.readPeerCredentials;
    this.#leaseState = { socket: undefined, live: false };
    const authority: Step16HostCallWitnessAuthorityCallbacksInternalV1 = {
      beginCollecting: async (input) => options.authority.beginCollecting(input),
      appendExpectedOperation: async (window, operation) =>
        options.authority.appendExpectedOperation(window, operation),
      complete: async (window, witness) => {
        this.#pendingProviderBindings = undefined;
        const completion = await options.authority.complete(window, witness);
        if (!Array.isArray(completion)) {
          throw safeFailure();
        }
        const projected = Object.freeze(
          completion.map((binding) => projectPublicProviderBinding(binding)),
        );
        this.#pendingProviderBindings = projected;
        return projected;
      },
      abort: async (window) => options.authority.abort(window),
    };
    this.#core = createStep16HostCallWitnessServerCoreInternalV1({
      directSupervisorPid: options.directSupervisorPid,
      closingPlan: options.closingPlan,
      authority,
      supervisorLease: {
        held: () =>
          this.#leaseState.live &&
          this.#leaseState.socket !== undefined &&
          !this.#leaseState.socket.destroyed,
      },
    });
    this.#plannedHostByCallOrdinal = new Map(
      options.closingPlan.calls.map((call) => [call.callOrdinal, call.host]),
    );
    this.#server = createServer((socket) => this.#acceptSocket(socket));
  }

  async start(): Promise<void> {
    let listeningSucceeded = false;
    try {
      await listen(this.#server, this.socketPath);
      listeningSucceeded = true;
      const initialStats = lstatSync(this.socketPath);
      if (
        !initialStats.isSocket() ||
        initialStats.isSymbolicLink() ||
        initialStats.uid !== this.#ownerUid ||
        initialStats.gid !== this.#ownerGid
      ) {
        throw safeFailure();
      }
      const initialIdentity = fileIdentity(initialStats);
      chmodSync(this.socketPath, 0o600);
      requireSecureParent(
        this.#parentPath,
        this.#ownerUid,
        this.#ownerGid,
        this.#parentIdentity,
      );
      this.#socketIdentity = requireSecureSocket(
        this.socketPath,
        this.#ownerUid,
        this.#ownerGid,
        initialIdentity,
      );
      syncDirectory(this.#parentPath);
      this.#active = true;
    } catch {
      this.#active = false;
      await closeListener(this.#server);
      if (listeningSucceeded && this.#socketIdentity !== undefined) {
        try {
          unlinkOwnedSocket(
            this.socketPath,
            this.#socketIdentity,
            this.#parentPath,
            this.#parentIdentity,
            this.#ownerUid,
            this.#ownerGid,
          );
        } catch {
          // Never remove a path that cannot be re-attested as our socket.
        }
      }
      throw safeFailure();
    }
  }

  close(): Promise<void> {
    this.#closePromise ??= this.#closeOnce();
    return this.#closePromise;
  }

  #acceptSocket(socket: Socket): void {
    if (!this.#active || this.#accepted) {
      socket.destroy();
      return;
    }

    let peer: ProviderRuntimeNativeKernelPeerCredentialsV1;
    try {
      peer = this.#readPeerCredentials(socket);
    } catch {
      socket.destroy();
      return;
    }
    if (
      peer.uid !== 0 ||
      peer.gid !== 0 ||
      peer.pid !== this.#directSupervisorPid
    ) {
      socket.destroy();
      return;
    }

    this.#accepted = true;
    this.#leaseState.socket = socket;
    this.#leaseState.live = true;
    try {
      this.#connection = this.#core.accept({ uid: peer.uid, pid: peer.pid });
    } catch {
      this.#leaseState.live = false;
      this.#leaseState.socket = undefined;
      socket.destroy();
      return;
    }

    this.#sockets.add(socket);
    const task = this.#serve(socket);
    this.#tasks.add(task);
    void task
      .catch(() => undefined)
      .finally(() => {
        this.#tasks.delete(task);
        this.#sockets.delete(socket);
      });
  }

  async #serve(socket: Socket): Promise<void> {
    let buffered = Buffer.alloc(0);
    let totalBytes = 0;
    let frameCount = 0;
    let timedOut = false;
    let terminalFailure: Promise<void> | undefined;
    const failTransport = (kind: "disconnect" | "timeout"): Promise<void> => {
      if (this.#finalized || this.#connection === undefined) {
        return Promise.resolve();
      }
      this.#leaseState.live = false;
      terminalFailure ??= (
        kind === "timeout"
          ? this.#connection.timeout()
          : this.#connection.disconnect()
      ).catch(() => undefined);
      return terminalFailure;
    };
    socket.once("close", () => {
      void failTransport(timedOut ? "timeout" : "disconnect");
    });
    socket.setTimeout(this.#timeoutMs, () => {
      timedOut = true;
      void failTransport("timeout");
      socket.destroy(safeFailure());
    });

    try {
      for await (const value of socket) {
        const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
        totalBytes += chunk.length;
        if (
          totalBytes >
          STEP16_HOST_CALL_WITNESS_UDS_LIMITS_INTERNAL_V1.maxConnectionBytes
        ) {
          throw safeFailure();
        }
        buffered = Buffer.concat([buffered, chunk]);

        for (;;) {
          const newline = buffered.indexOf(0x0a);
          if (newline < 0) {
            if (
              buffered.length >
              STEP16_HOST_CALL_WITNESS_UDS_LIMITS_INTERNAL_V1.maxFrameBytes
            ) {
              throw safeFailure();
            }
            break;
          }
          if (
            newline >
            STEP16_HOST_CALL_WITNESS_UDS_LIMITS_INTERNAL_V1.maxFrameBytes
          ) {
            throw safeFailure();
          }
          const line = buffered.subarray(0, newline);
          buffered = buffered.subarray(newline + 1);
          frameCount += 1;
          if (
            frameCount >
            STEP16_HOST_CALL_WITNESS_UDS_LIMITS_INTERNAL_V1.maxFrames
          ) {
            throw safeFailure();
          }

          // Explicitly pause kernel reads while an authority callback is awaited.
          socket.pause();
          try {
            const shouldStop = await this.#dispatch(socket, parseWireRequest(line));
            if (shouldStop) {
              return;
            }
          } finally {
            if (!socket.destroyed) {
              socket.resume();
            }
          }
        }
      }
      if (buffered.length !== 0) {
        throw safeFailure();
      }
    } catch {
      socket.destroy();
    } finally {
      socket.setTimeout(0);
      this.#leaseState.live = false;
      if (!this.#finalized) {
        await failTransport(timedOut ? "timeout" : "disconnect");
      }
    }
  }

  async #dispatch(socket: Socket, request: WireRequest): Promise<boolean> {
    const sequence = requireSafePositiveInteger(request.sequence);
    if (sequence !== this.#nextSequence) {
      throw safeFailure();
    }
    this.#nextSequence += 1;

    if (request.kind === "finalize") {
      await this.#core.close();
      if (!this.#active || !this.#leaseState.live || socket.destroyed) {
        throw safeFailure();
      }
      const completion: Step16HostCallWitnessUdsCompletionInternalV1 =
        Object.freeze({
          strongCallProviderReceipts: Object.freeze([
            ...this.#strongCallProviderReceipts,
          ]),
          providerBindings: Object.freeze([...this.#providerBindings]),
        });
      await writeJsonLine(socket, {
        profile: this.profile,
        sequence,
        status: "finalized",
        result: completion,
      });
      if (!this.#active || !this.#leaseState.live || socket.destroyed) {
        throw safeFailure();
      }
      this.#finalized = true;
      socket.end();
      return true;
    }

    if (this.#connection === undefined) {
      throw safeFailure();
    }
    const frame = projectCoreFrame(request);
    let result: unknown;
    switch (request.kind) {
      case "hello":
        result = await this.#connection.hello(frame as never);
        break;
      case "arm":
        result = await this.#connection.arm(frame as never);
        this.#activeHost = this.#plannedHostByCallOrdinal.get(
          requireSafePositiveInteger(request.callOrdinal),
        );
        if (this.#activeHost === undefined) {
          throw safeFailure();
        }
        this.#observedProviderOperations = [];
        break;
      case "observe_provider_operation":
        result = await this.#connection.observeProviderOperation(frame as never);
        this.#observedProviderOperations.push(Object.freeze({
          operation: requireOneOf(request.operation, [
            "write_object",
            "compare_commit",
          ] as const),
          operationNonce: requireOperationNonce(request.operationNonce),
          requestDigest: requireDigest(request.requestDigest),
        }));
        break;
      case "complete":
        this.#pendingProviderBindings = undefined;
        try {
          result = await this.#connection.complete(frame as never);
          this.#commitProviderBindings(request, result);
          this.#activeHost = undefined;
          this.#observedProviderOperations = [];
        } finally {
          this.#pendingProviderBindings = undefined;
        }
        break;
      case "abort":
        result = await this.#connection.abort(frame as never);
        break;
      default:
        throw safeFailure();
    }
    await writeJsonLine(socket, {
      profile: this.profile,
      sequence,
      status: "ok",
      result,
    });
    if (request.kind === "abort") {
      socket.end();
      return true;
    }
    return false;
  }

  #commitProviderBindings(request: WireRequest, result: unknown): void {
    const callIdDigest = requireDigest(request.callIdDigest);
    const sessionIdDigest = requireDigest(request.sessionIdDigest);
    const completion = requireExactRecord(result, [
      "status",
      "receiptBundleDigests",
    ]);
    requireLiteral(completion.status, "completed");
    if (!Array.isArray(completion.receiptBundleDigests)) {
      throw safeFailure();
    }
    const receiptBundleDigests = completion.receiptBundleDigests.map((digest) =>
      requireDigest(digest),
    );
    const bindings = this.#pendingProviderBindings;
    if (
      bindings === undefined ||
      this.#activeHost === undefined ||
      bindings.length !== receiptBundleDigests.length ||
      bindings.length !== this.#observedProviderOperations.length ||
      bindings.some(
        (binding, index) =>
          binding.host !== this.#activeHost ||
          binding.sessionIdDigest !== sessionIdDigest ||
          binding.callIdDigest !== callIdDigest ||
          binding.receiptLedger.receiptBundleDigest !==
            receiptBundleDigests[index] ||
          binding.providerOperation.operation !==
            this.#observedProviderOperations[index]?.operation ||
          binding.providerOperation.operationNonce !==
            this.#observedProviderOperations[index]?.operationNonce ||
          binding.providerOperation.requestDigest !==
            this.#observedProviderOperations[index]?.requestDigest,
      ) ||
      receiptBundleDigests.some((digest) =>
        this.#seenReceiptBundleDigests.has(digest),
      )
    ) {
      throw safeFailure();
    }
    const frozenDigests = Object.freeze([...receiptBundleDigests]);
    this.#strongCallProviderReceipts.push(
      Object.freeze({ callIdDigest, receiptBundleDigests: frozenDigests }),
    );
    for (const binding of bindings) {
      this.#seenReceiptBundleDigests.add(
        binding.receiptLedger.receiptBundleDigest,
      );
      this.#providerBindings.push(binding);
    }
  }

  async #closeOnce(): Promise<void> {
    this.#active = false;
    // A closed authority core is not proof that the final result was delivered.
    // Capture this before awaiting any in-flight transport work so a concurrent
    // finalize cannot turn cancellation into a successful close.
    let firstError: unknown = this.#finalized ? undefined : safeFailure();
    const listenerClosing = closeListener(this.#server);
    this.#leaseState.live = false;
    for (const socket of this.#sockets) {
      socket.destroy();
    }
    const draining: Promise<unknown>[] = [
      listenerClosing,
      ...this.#tasks,
    ];
    if (!this.#finalized && this.#connection !== undefined) {
      draining.push(this.#connection.disconnect().catch(() => undefined));
    }
    if (!this.#finalized) {
      draining.push(this.#core.close().catch(() => undefined));
    }
    if (!await settlesWithinV1(Promise.allSettled(draining), this.#timeoutMs)) {
      firstError ??= safeFailure();
    }
    try {
      unlinkOwnedSocket(
        this.socketPath,
        this.#socketIdentity,
        this.#parentPath,
        this.#parentIdentity,
        this.#ownerUid,
        this.#ownerGid,
      );
    } catch (error) {
      firstError ??= error;
    }
    if (firstError !== undefined) {
      throw safeFailure();
    }
  }
}

export async function startStep16HostCallWitnessUdsServerCoreInternalV1(
  options: StartStep16HostCallWitnessUdsServerInternalV1Options,
  dependencies: Step16HostCallWitnessUdsServerDependenciesInternalV1,
): Promise<Step16HostCallWitnessUdsServerInternalV1> {
  const socketPath = normalizeSocketPath(options.socketPath);
  const parentPath = dirname(socketPath);
  const timeoutMs = requireTimeoutMs(options.timeoutMs);
  if (
    !Number.isSafeInteger(dependencies.filesystemOwnerUid) ||
    dependencies.filesystemOwnerUid < 0 ||
    !Number.isSafeInteger(dependencies.filesystemOwnerGid) ||
    dependencies.filesystemOwnerGid < 0 ||
    typeof dependencies.readPeerCredentials !== "function"
  ) {
    throw safeFailure();
  }
  const parentIdentity = requireSecureParent(
    parentPath,
    dependencies.filesystemOwnerUid,
    dependencies.filesystemOwnerGid,
  );
  requireMissingSocketPath(socketPath);

  const implementation =
    new Step16HostCallWitnessUdsServerImplementationInternalV1(
      options,
      dependencies,
      socketPath,
      parentIdentity,
      timeoutMs,
    );
  await implementation.start();
  return implementation;
}

export async function startStep16HostCallWitnessUdsServerInternalV1(
  options: StartStep16HostCallWitnessUdsServerInternalV1Options,
): Promise<Step16HostCallWitnessUdsServerInternalV1> {
  if (
    process.platform !== "linux" ||
    typeof process.geteuid !== "function" ||
    typeof process.getegid !== "function" ||
    process.geteuid() !== 0 ||
    process.getegid() !== 0
  ) {
    throw safeFailure();
  }
  return startStep16HostCallWitnessUdsServerCoreInternalV1(options, {
    filesystemOwnerUid: 0,
    filesystemOwnerGid: 0,
    readPeerCredentials: readProviderRuntimeNativeKernelPeerCredentialsV1,
  });
}
