import {
  createHash,
  createPublicKey,
  createHmac,
  randomBytes,
  sign,
  timingSafeEqual,
  type KeyObject,
} from "node:crypto";
import {
  chmod,
  lstat,
  unlink,
} from "node:fs/promises";
import {
  createConnection,
  createServer,
  type Server,
  type Socket,
} from "node:net";
import { dirname, relative, resolve } from "node:path";
import { TextDecoder } from "node:util";

import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";

import {
  PROVIDER_RUNTIME_IPC_MAX_FRAME_BYTES_V1,
  PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
  PROVIDER_RUNTIME_IPC_SOCKET_MODE_V1,
  ProviderRuntimeIpcAcceptanceIdentityProofV1Schema,
  ProviderRuntimeIpcClientHelloV1Schema,
  ProviderRuntimeIpcPrincipalAttestationV1Schema,
  ProviderRuntimeIpcPrincipalAttestationClaimsV1Schema,
  ProviderRuntimeIpcPrincipalChallengeV1Schema,
  ProviderRuntimeIpcRequestV1Schema,
  ProviderRuntimeIpcResponseV1Schema,
  ProviderRuntimeIpcServerHelloV1Schema,
  ProviderRuntimeIpcStrongMutationRequestV1Schema,
  ProviderRuntimeIpcStrongMutationRequestClaimsV1Schema,
  ProviderRuntimeIpcStrongMutationResponseV1Schema,
  canonicalizeProviderRuntimeIpcAuthenticatedClaimsV1,
  canonicalizeProviderRuntimeIpcPrincipalAttestationClaimsV1,
  canonicalizeProviderRuntimeIpcPrincipalAttestationTranscriptV1,
  canonicalizeProviderRuntimeIpcStrongMutationRequestV1,
  canonicalizeProviderRuntimeIpcStrongMutationResponseClaimsV1,
  canonicalizeProviderRuntimeIpcStrongMutationSessionBindingV1,
  type ProviderRuntimeIpcAcceptanceIdentityProofV1,
  type ProviderRuntimeIpcClientHelloV1,
  type ProviderRuntimeIpcJournalStateV1,
  type ProviderRuntimeIpcPrincipalAttestationV1,
  type ProviderRuntimeIpcPrincipalChallengeV1,
  type ProviderRuntimeIpcRequestV1,
  type ProviderRuntimeIpcResponseV1,
  type ProviderRuntimeIpcServerHelloV1,
  type ProviderRuntimeIpcStrongMutationRequestV1,
  type ProviderRuntimeIpcStrongMutationResponseV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import {
  verifyProviderServiceFormalAcceptanceEnvelopeWithIdentityCapabilityInternalV1,
  type ProviderServiceInstallationIdentityVerificationCapabilityInternalV1,
} from "@understand-code/durable-object-provider-contracts/provider-service-installation-identity-custody-internal";
import {
  ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
} from "@understand-code/durable-object-provider-contracts/provider-strong-ready-acceptance-candidate";
import {
  verifyProviderStrongReadyAcceptanceEnvelopeTokenWithIdentityCapabilityV1,
} from "@understand-code/durable-object-provider-contracts/provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-closure-reference-candidate";
import {
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  type ContentDigestV1,
} from "@understand-code/durable-object-provider-contracts/primitives";

import {
  DurableObjectProviderRuntimeStoreV1,
  ProviderRuntimeStrongMutationDurabilityIndeterminateErrorV1,
  ProviderRuntimeStorageErrorV1,
  type DurableObjectProviderRuntimeStoreOptionsV1,
} from "./storage.js";
import {
  consumeProviderRuntimeStrongMutationSessionCapabilityInternalV1,
  consumeProviderRuntimeStrongMutationAuthorityGrantInternalV1,
  hasProviderRuntimeCurrentFormalAcceptanceResolverInternalV1,
  inspectProviderRuntimeStrongMutationLegacyOutcomeAuthorityInternalV1,
  resolveProviderRuntimeCurrentFormalAcceptanceInternalV1,
  resolveProviderRuntimeStrongMutationSessionCapabilityInternalV1,
  takeProviderRuntimeStrongMutationExecutionAuthorizationInternalV1,
  type ProviderRuntimeStrongMutationSessionCapabilityInternalV1,
  type ProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1,
} from "./strong-mutation-session-authority-internal.js";
import {
  projectProviderRuntimeDurableLifecycleArtifactsV1,
} from "./durable-acceptance-current.js";

const ZERO_AUTH_TAG_V1 = `hmac-sha256:${"0".repeat(64)}` as const;
const ZERO_REQUEST_ID_V1 = "0".repeat(32);
const DEFAULT_REQUEST_TIMEOUT_MS_V1 = 5_000;
const DEFAULT_MAX_CONNECTIONS_V1 = 64;

type AuthenticatedWireV1 =
  | ProviderRuntimeIpcClientHelloV1
  | ProviderRuntimeIpcServerHelloV1
  | ProviderRuntimeIpcRequestV1
  | ProviderRuntimeIpcResponseV1;

type ErrorCodeV1 = Extract<
  ProviderRuntimeIpcResponseV1,
  { readonly ok: false }
>["error"]["code"];

type StrongMutationResponseResultV1 =
  | { readonly ok: true; readonly payload: unknown }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: ErrorCodeV1;
        readonly message: string;
      };
    };

interface ProviderRuntimePrincipalContinuationV1 {
  readonly state: ProviderRuntimeIpcJournalStateV1;
  readonly attestation: ProviderRuntimeIpcPrincipalAttestationV1;
  readonly connectionNonce:
    ProviderRuntimeIpcPrincipalAttestationV1["connectionNonce"];
  readonly principalAttestationDigest: ContentDigestV1;
  readonly acceptanceIdentity:
    | ProviderRuntimeIpcAcceptanceIdentityProofV1
    | undefined;
}

export interface DurableObjectProviderRuntimeServerOptionsV1 {
  readonly rootPath: string;
  readonly socketPath: string;
  readonly providerId: string;
  readonly authKey: Uint8Array;
  readonly authorizedCapabilityDigest: string;
  readonly requestTimeoutMs?: number;
  readonly maxConnections?: number;
  readonly principalAttestation?: {
    readonly privateKey: KeyObject;
    readonly handoffPayloadDigest: string;
    readonly publicKey: string;
  };
  /** Opaque, consume-only proof capability retained by the service process. */
  readonly acceptanceIdentityVerificationCapability?:
    ProviderServiceInstallationIdentityVerificationCapabilityInternalV1;
  /**
   * Plain/reference runtimes retain the existing HMAC candidate behavior.
   * Production service handoffs select the locked policy until a future
   * same-connection Acceptance authority session is implemented.
   */
  readonly mutationPolicy?:
    | "hmac_candidate"
    | "acceptance_authority_session_required";
  /** Runtime-private verifier; an unregistered structural object has no authority. */
  readonly strongMutationAuthorityVerifier?:
    ProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1;
  readonly storeOptions?: Omit<
    DurableObjectProviderRuntimeStoreOptionsV1,
    "rootPath" | "providerId"
  >;
}

export interface DurableObjectProviderRuntimeServerAddressV1 {
  readonly protocol: typeof PROVIDER_RUNTIME_IPC_PROTOCOL_V1;
  readonly socketPath: string;
}

export class ProviderRuntimeServerErrorV1 extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderRuntimeServerErrorV1";
  }
}

class ProviderRuntimeMutationCapabilityUnavailableErrorV1 extends Error {
  constructor() {
    super("runtime mutation capability is unavailable");
    this.name = "ProviderRuntimeMutationCapabilityUnavailableErrorV1";
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

function safeErrorMessageV1(message: string): string {
  const normalized = message.trim();
  if (normalized.length === 0) return "durable provider runtime request failed";
  return normalized.slice(0, 1024);
}

function computeAuthTagV1(
  key: Uint8Array,
  wire: AuthenticatedWireV1,
): string {
  return `hmac-sha256:${createHmac("sha256", key)
    .update(canonicalizeProviderRuntimeIpcAuthenticatedClaimsV1(wire))
    .digest("hex")}`;
}

function signWireV1<T extends AuthenticatedWireV1>(
  key: Uint8Array,
  wire: T,
): T {
  return {
    ...wire,
    authTag: computeAuthTagV1(key, wire),
  } as T;
}

function verifyAuthTagV1(
  key: Uint8Array,
  wire: AuthenticatedWireV1,
): boolean {
  const actualHex = wire.authTag.slice("hmac-sha256:".length);
  const expectedHex = computeAuthTagV1(key, wire).slice(
    "hmac-sha256:".length,
  );
  const actual = Buffer.from(actualHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  return actual.byteLength === expected.byteLength && timingSafeEqual(actual, expected);
}

function sha256DigestV1(bytes: Uint8Array): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
  );
}

function exactJournalHeadV1(
  left: ProviderRuntimeIpcJournalStateV1,
  right: ProviderRuntimeIpcJournalStateV1,
): boolean {
  return left.revision === right.revision &&
    left.phase === right.phase &&
    left.mutationDigest === right.mutationDigest;
}

function assertPositiveSafeIntegerV1(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new ProviderRuntimeServerErrorV1(
      `${label} must be a positive safe integer`,
    );
  }
}

class NdjsonSocketReaderV1 {
  readonly #socket: Socket;
  readonly #maxFrameBytes: number;
  readonly #decoder = new TextDecoder("utf-8", { fatal: true });
  #buffer = Buffer.alloc(0);
  #frames: string[] = [];
  #waiters: Array<{
    readonly resolve: (frame: string) => void;
    readonly reject: (error: Error) => void;
  }> = [];
  #terminalError: Error | undefined;

  constructor(socket: Socket, maxFrameBytes: number) {
    this.#socket = socket;
    this.#maxFrameBytes = maxFrameBytes;
    socket.on("data", this.#onData);
    socket.once("end", this.#onEnd);
    socket.once("error", this.#onError);
  }

  readFrame(): Promise<string> {
    const frame = this.#frames.shift();
    if (frame !== undefined) return Promise.resolve(frame);
    if (this.#terminalError !== undefined) {
      return Promise.reject(this.#terminalError);
    }
    return new Promise<string>((resolvePromise, rejectPromise) => {
      this.#waiters.push({ resolve: resolvePromise, reject: rejectPromise });
    });
  }

  close(): void {
    this.#socket.off("data", this.#onData);
    this.#socket.off("end", this.#onEnd);
    this.#socket.off("error", this.#onError);
  }

  readonly #onData = (chunk: Buffer): void => {
    if (this.#terminalError !== undefined) return;
    this.#buffer = Buffer.concat([this.#buffer, chunk]);
    for (;;) {
      const newline = this.#buffer.indexOf(0x0a);
      if (newline < 0) break;
      if (newline > this.#maxFrameBytes) {
        this.#fail(new ProviderRuntimeServerErrorV1("IPC frame exceeds limit"));
        return;
      }
      let frameBytes = this.#buffer.subarray(0, newline);
      this.#buffer = this.#buffer.subarray(newline + 1);
      if (frameBytes.at(-1) === 0x0d) frameBytes = frameBytes.subarray(0, -1);
      if (frameBytes.byteLength === 0) {
        this.#fail(new ProviderRuntimeServerErrorV1("IPC frame is empty"));
        return;
      }
      let frame: string;
      try {
        frame = this.#decoder.decode(frameBytes);
      } catch {
        this.#fail(new ProviderRuntimeServerErrorV1("IPC frame is not UTF-8"));
        return;
      }
      const waiter = this.#waiters.shift();
      if (waiter !== undefined) waiter.resolve(frame);
      else this.#frames.push(frame);
      if (this.#frames.length > 2) {
        this.#fail(
          new ProviderRuntimeServerErrorV1("too many pipelined IPC frames"),
        );
        return;
      }
    }
    if (this.#buffer.byteLength > this.#maxFrameBytes) {
      this.#fail(new ProviderRuntimeServerErrorV1("IPC frame exceeds limit"));
    }
  };

  readonly #onEnd = (): void => {
    this.#fail(new ProviderRuntimeServerErrorV1("IPC peer ended the connection"));
  };

  readonly #onError = (error: Error): void => {
    this.#fail(error);
  };

  #fail(error: Error): void {
    if (this.#terminalError !== undefined) return;
    this.#terminalError = error;
    for (const waiter of this.#waiters.splice(0)) waiter.reject(error);
  }
}

async function writeFrameV1(socket: Socket, wire: unknown): Promise<void> {
  const frame = `${JSON.stringify(wire)}\n`;
  if (Buffer.byteLength(frame, "utf8") > PROVIDER_RUNTIME_IPC_MAX_FRAME_BYTES_V1) {
    throw new ProviderRuntimeServerErrorV1("IPC response frame exceeds limit");
  }
  await new Promise<void>((resolvePromise, rejectPromise) => {
    socket.write(frame, "utf8", (error) => {
      if (error !== undefined && error !== null) rejectPromise(error);
      else resolvePromise();
    });
  });
}

async function probeSocketIsLiveV1(socketPath: string): Promise<boolean> {
  return new Promise<boolean>((resolvePromise, rejectPromise) => {
    const socket = createConnection(socketPath);
    const timer = setTimeout(() => {
      socket.destroy();
      rejectPromise(
        new ProviderRuntimeServerErrorV1(
          "timed out while checking an existing runtime socket",
        ),
      );
    }, 500);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolvePromise(true);
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      socket.destroy();
      if (isErrnoV1(error, "ECONNREFUSED") || isErrnoV1(error, "ENOENT")) {
        resolvePromise(false);
      } else {
        rejectPromise(error);
      }
    });
  });
}

export class DurableObjectProviderRuntimeServerV1 {
  readonly store: DurableObjectProviderRuntimeStoreV1;
  readonly rootPath: string;
  readonly socketPath: string;
  readonly providerId: string;

  readonly #authKey: Uint8Array;
  readonly #authorizedCapabilityDigest: string;
  readonly #requestTimeoutMs: number;
  readonly #maxConnections: number;
  readonly #principalAttestation:
    | {
        readonly privateKey: KeyObject;
        readonly handoffPayloadDigest: string;
        readonly publicKey: string;
      }
    | undefined;
  readonly #acceptanceIdentityVerificationCapability:
    | ProviderServiceInstallationIdentityVerificationCapabilityInternalV1
    | undefined;
  readonly #mutationPolicy:
    | "hmac_candidate"
    | "acceptance_authority_session_required";
  readonly #strongMutationAuthorityVerifier:
    | ProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1
    | undefined;
  readonly #connections = new Set<Socket>();
  readonly #activeStrongMutations = new Set<Promise<void>>();
  readonly #mutationQueueWaiters: Array<() => void> = [];
  #mutationQueueActive = false;
  #server: Server | undefined;
  #startPromise: Promise<DurableObjectProviderRuntimeServerAddressV1> | undefined;
  #closePromise: Promise<void> | undefined;
  #socketIdentity: { readonly dev: number; readonly ino: number } | undefined;

  constructor(options: DurableObjectProviderRuntimeServerOptionsV1) {
    this.rootPath = resolve(options.rootPath);
    this.socketPath = resolve(options.socketPath);
    this.providerId = DurableObjectIdentityProviderIdV1Schema.parse(
      options.providerId,
    );
    const relativeSocket = relative(this.rootPath, this.socketPath);
    if (
      relativeSocket.length === 0 ||
      relativeSocket.startsWith("..") ||
      relativeSocket.includes("/") ||
      relativeSocket.includes("\\")
    ) {
      throw new ProviderRuntimeServerErrorV1(
        "runtime socket must be a direct child of the private runtime root",
      );
    }
    if (!(options.authKey instanceof Uint8Array) || options.authKey.byteLength < 32) {
      throw new ProviderRuntimeServerErrorV1(
        "runtime HMAC key must contain at least 32 bytes",
      );
    }
    this.#authKey = Uint8Array.from(options.authKey);
    this.#authorizedCapabilityDigest = ContentDigestV1Schema.parse(
      options.authorizedCapabilityDigest,
    );
    this.#requestTimeoutMs =
      options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS_V1;
    this.#maxConnections = options.maxConnections ?? DEFAULT_MAX_CONNECTIONS_V1;
    assertPositiveSafeIntegerV1(this.#requestTimeoutMs, "requestTimeoutMs");
    assertPositiveSafeIntegerV1(this.#maxConnections, "maxConnections");
    if (options.principalAttestation === undefined) {
      this.#principalAttestation = undefined;
    } else {
      const { privateKey } = options.principalAttestation;
      if (
        privateKey.type !== "private" ||
        privateKey.asymmetricKeyType !== "ed25519"
      ) {
        throw new ProviderRuntimeServerErrorV1(
          "principal attestation key must be an Ed25519 private key",
        );
      }
      const handoffPayloadDigest = ContentDigestV1Schema.parse(
        options.principalAttestation.handoffPayloadDigest,
      );
      const publicKey = `base64url:${createPublicKey(privateKey)
        .export({ format: "der", type: "spki" })
        .toString("base64url")}`;
      if (publicKey !== options.principalAttestation.publicKey) {
        throw new ProviderRuntimeServerErrorV1(
          "principal attestation public key does not match its private key",
        );
      }
      this.#principalAttestation = {
        privateKey,
        handoffPayloadDigest,
        publicKey,
      };
    }
    this.#acceptanceIdentityVerificationCapability =
      options.acceptanceIdentityVerificationCapability;
    this.#mutationPolicy = options.mutationPolicy ?? "hmac_candidate";
    if (
      this.#mutationPolicy !== "hmac_candidate" &&
      this.#mutationPolicy !== "acceptance_authority_session_required"
    ) {
      throw new ProviderRuntimeServerErrorV1(
        "runtime mutation policy is invalid",
      );
    }
    this.#strongMutationAuthorityVerifier =
      options.strongMutationAuthorityVerifier;
    this.store = new DurableObjectProviderRuntimeStoreV1({
      ...options.storeOptions,
      rootPath: this.rootPath,
      providerId: this.providerId,
    });
  }

  get listening(): boolean {
    return this.#server?.listening === true;
  }

  async start(): Promise<DurableObjectProviderRuntimeServerAddressV1> {
    if (this.#server !== undefined) {
      throw new ProviderRuntimeServerErrorV1("runtime server was already started");
    }
    if (this.#closePromise !== undefined) {
      throw new ProviderRuntimeServerErrorV1("runtime server is closing");
    }
    if (this.#startPromise !== undefined) {
      throw new ProviderRuntimeServerErrorV1("runtime server is starting");
    }
    const startup = this.#startInternalV1();
    this.#startPromise = startup;
    try {
      return await startup;
    } finally {
      if (this.#startPromise === startup) this.#startPromise = undefined;
    }
  }

  async #startInternalV1(): Promise<DurableObjectProviderRuntimeServerAddressV1> {
    if (process.platform === "win32") {
      throw new ProviderRuntimeServerErrorV1(
        "durable provider runtime v1 requires a Unix-domain socket host",
      );
    }
    await this.store.initialize();
    try {
      if (this.#closePromise !== undefined) {
        throw new ProviderRuntimeServerErrorV1("runtime server is closing");
      }
      if (this.#strongMutationAuthorityVerifier !== undefined) {
        await this.store.establishStrongMutationExactObjectAuthorityV1();
        if (this.#closePromise !== undefined) {
          throw new ProviderRuntimeServerErrorV1("runtime server is closing");
        }
        await this.#recoverDurableStrongMutationOutcomesV1();
      }
      if (this.#closePromise !== undefined) {
        throw new ProviderRuntimeServerErrorV1("runtime server is closing");
      }
      if (dirname(this.socketPath) !== this.rootPath) {
        throw new ProviderRuntimeServerErrorV1(
          "runtime socket escaped the private runtime root",
        );
      }
      await this.#prepareSocketPath();
      if (this.#closePromise !== undefined) {
        throw new ProviderRuntimeServerErrorV1("runtime server is closing");
      }

      const server = createServer((socket) => {
        if (this.#connections.size >= this.#maxConnections) {
          socket.destroy();
          return;
        }
        this.#connections.add(socket);
        socket.once("close", () => this.#connections.delete(socket));
        void this.#serveConnection(socket);
      });
      this.#server = server;
      await new Promise<void>((resolvePromise, rejectPromise) => {
        const onError = (error: Error): void => {
          server.off("listening", onListening);
          rejectPromise(error);
        };
        const onListening = (): void => {
          server.off("error", onError);
          resolvePromise();
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(this.socketPath);
      });
      const created = await lstat(this.socketPath);
      if (!created.isSocket() || created.isSymbolicLink()) {
        throw new ProviderRuntimeServerErrorV1(
          "runtime socket path is not a real Unix-domain socket",
        );
      }
      this.#socketIdentity = { dev: created.dev, ino: created.ino };
      await chmod(this.socketPath, PROVIDER_RUNTIME_IPC_SOCKET_MODE_V1);
      const metadata = await lstat(this.socketPath);
      if (
        !metadata.isSocket() || metadata.isSymbolicLink() ||
        metadata.dev !== created.dev || metadata.ino !== created.ino
      ) {
        throw new ProviderRuntimeServerErrorV1(
          "runtime socket path is not a real Unix-domain socket",
        );
      }
      if ((metadata.mode & 0o077) !== 0) {
        throw new ProviderRuntimeServerErrorV1(
          "runtime socket grants group or other access",
        );
      }
      return {
        protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
        socketPath: this.socketPath,
      };
    } catch (error) {
      // A concurrent close waits for this startup promise.  Calling the
      // public close() here would form a cycle, so only perform local cleanup
      // when no external close already owns the lifecycle transition.
      if (this.#closePromise === undefined) {
        await this.#closeInternalV1();
      }
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.#closePromise !== undefined) return this.#closePromise;
    const startup = this.#startPromise;
    this.#closePromise = (async () => {
      // Do not let close race the asynchronous initialization/authority
      // bootstrap.  Once startup settles, #closeInternalV1 observes the
      // final server/FD state and can close it exactly once.
      if (startup !== undefined) await startup.catch(() => undefined);
      await this.#closeInternalV1();
    })();
    return this.#closePromise;
  }

  async #closeInternalV1(): Promise<void> {
    const server = this.#server;
    this.#server = undefined;
    let serverClosed = Promise.resolve();
    if (server !== undefined) {
      serverClosed = new Promise<void>((resolvePromise) => {
        if (!server.listening) {
          resolvePromise();
          return;
        }
        server.close(() => resolvePromise());
      });
    }
    // Stop admission first, but retain live sockets until every authorized
    // mutation has durably resolved (or failed).  Destroying them earlier can
    // strand a broker intent after its first side effect.
    await Promise.allSettled([...this.#activeStrongMutations]);
    for (const connection of this.#connections) connection.destroy();
    this.#connections.clear();
    await serverClosed;
    await this.store.closeStrongMutationExactObjectAuthorityV1();
    const identity = this.#socketIdentity;
    this.#socketIdentity = undefined;
    if (identity !== undefined) {
      try {
        const metadata = await lstat(this.socketPath);
        if (
          metadata.isSocket() &&
          metadata.dev === identity.dev &&
          metadata.ino === identity.ino
        ) {
          await unlink(this.socketPath);
        }
      } catch (error) {
        if (!isErrnoV1(error, "ENOENT")) throw error;
      }
    }
  }

  async #prepareSocketPath(): Promise<void> {
    let metadata;
    try {
      metadata = await lstat(this.socketPath);
    } catch (error) {
      if (isErrnoV1(error, "ENOENT")) return;
      throw error;
    }
    if (!metadata.isSocket() || metadata.isSymbolicLink()) {
      throw new ProviderRuntimeServerErrorV1(
        "runtime socket path already exists and is not a socket",
      );
    }
    if (typeof process.getuid === "function" && metadata.uid !== process.getuid()) {
      throw new ProviderRuntimeServerErrorV1(
        "existing runtime socket is not owned by the current user",
      );
    }
    if (await probeSocketIsLiveV1(this.socketPath)) {
      throw new ProviderRuntimeServerErrorV1(
        "another durable provider runtime is already listening",
      );
    }
    await unlink(this.socketPath);
  }

  async #serveConnection(socket: Socket): Promise<void> {
    const reader = new NdjsonSocketReaderV1(
      socket,
      PROVIDER_RUNTIME_IPC_MAX_FRAME_BYTES_V1,
    );
    socket.setTimeout(this.#requestTimeoutMs, () => socket.destroy());
    socket.setNoDelay(true);
    try {
      const firstFrame = await reader.readFrame();
      const principalChallenge = this.#parsePrincipalChallenge(firstFrame);
      if (principalChallenge !== undefined) {
        const principalContinuation = await this.#servePrincipalChallenge(
          socket,
          principalChallenge,
        );
        if (principalChallenge.sessionContinuationRequested !== true) return;
        const strongMutationRequest = this.#parseStrongMutationRequest(
          await reader.readFrame(),
        );
        await this.#serveStrongMutationRequestV1(
          socket,
          strongMutationRequest,
          principalContinuation,
        );
        return;
      }
      const hello = this.#parseClientHello(firstFrame);
      if (
        !verifyAuthTagV1(this.#authKey, hello) ||
        hello.capabilityDigest !== this.#authorizedCapabilityDigest
      ) {
        socket.destroy();
        return;
      }
      const sessionId = randomBytes(16).toString("hex");
      const serverHello = signWireV1(
        this.#authKey,
        ProviderRuntimeIpcServerHelloV1Schema.parse({
          protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
          kind: "server_hello",
          clientNonce: hello.clientNonce,
          serverNonce: randomBytes(32).toString("hex"),
          sessionId,
          authTag: ZERO_AUTH_TAG_V1,
        }),
      );
      await writeFrameV1(socket, serverHello);

      let request: ProviderRuntimeIpcRequestV1;
      try {
        request = this.#parseRequest(await reader.readFrame());
      } catch {
        await this.#writeError(
          socket,
          sessionId,
          ZERO_REQUEST_ID_V1,
          "frame_invalid",
          "runtime request frame is invalid",
        );
        return;
      }
      if (
        request.sessionId !== sessionId ||
        request.sequence !== 1 ||
        !verifyAuthTagV1(this.#authKey, request)
      ) {
        await this.#writeError(
          socket,
          sessionId,
          request.requestId,
          "authentication_failed",
          "runtime request authentication failed",
        );
        return;
      }
      if (request.capabilityDigest !== this.#authorizedCapabilityDigest) {
        await this.#writeError(
          socket,
          sessionId,
          request.requestId,
          "capability_mismatch",
          "runtime request capability does not match this process",
        );
        return;
      }
      let payload: unknown;
      try {
        payload = await this.#dispatch(request);
      } catch (error) {
        const mapped = this.#mapError(error);
        await this.#writeError(
          socket,
          sessionId,
          request.requestId,
          mapped.code,
          mapped.message,
        );
        return;
      }
      const response = signWireV1(
        this.#authKey,
        ProviderRuntimeIpcResponseV1Schema.parse({
          protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
          kind: "response",
          sessionId,
          requestId: request.requestId,
          sequence: request.sequence,
          ok: true,
          payload,
          authTag: ZERO_AUTH_TAG_V1,
        }),
      );
      await writeFrameV1(socket, response);
    } catch {
      // A failure outside an authenticated request has no safe response channel.
      if (!socket.destroyed) socket.destroy();
    } finally {
      reader.close();
      if (!socket.destroyed) socket.end();
    }
  }

  #parseClientHello(frame: string): ProviderRuntimeIpcClientHelloV1 {
    let parsed: unknown;
    try {
      parsed = JSON.parse(frame) as unknown;
    } catch {
      throw new ProviderRuntimeServerErrorV1("client hello is not JSON");
    }
    const result = ProviderRuntimeIpcClientHelloV1Schema.safeParse(parsed);
    if (!result.success) {
      throw new ProviderRuntimeServerErrorV1("client hello is invalid");
    }
    return result.data;
  }

  #parsePrincipalChallenge(
    frame: string,
  ): ProviderRuntimeIpcPrincipalChallengeV1 | undefined {
    let parsed: unknown;
    try {
      parsed = JSON.parse(frame) as unknown;
    } catch {
      return undefined;
    }
    const result = ProviderRuntimeIpcPrincipalChallengeV1Schema.safeParse(parsed);
    return result.success ? result.data : undefined;
  }

  #parseStrongMutationRequest(
    frame: string,
  ): ProviderRuntimeIpcStrongMutationRequestV1 {
    let parsed: unknown;
    try {
      parsed = JSON.parse(frame) as unknown;
    } catch {
      throw new ProviderRuntimeServerErrorV1(
        "strong mutation request is not JSON",
      );
    }
    const result =
      ProviderRuntimeIpcStrongMutationRequestV1Schema.safeParse(parsed);
    if (!result.success) {
      throw new ProviderRuntimeServerErrorV1(
        "strong mutation request is invalid",
      );
    }
    return result.data;
  }

  async #servePrincipalChallenge(
    socket: Socket,
    request: ProviderRuntimeIpcPrincipalChallengeV1,
  ): Promise<ProviderRuntimePrincipalContinuationV1 | undefined> {
    const principalAttestation = this.#principalAttestation;
    if (principalAttestation === undefined) return undefined;
    const state = this.store.inspectState();
    const acceptanceIdentity = request.acceptanceIdentityProofRequested === true
      ? await this.#deriveAcceptanceIdentityProofV1(state)
      : undefined;
    const connectionNonce = request.sessionContinuationRequested === true
      ? randomBytes(32).toString("hex")
      : undefined;
    const claims = ProviderRuntimeIpcPrincipalAttestationClaimsV1Schema.parse({
      providerId: this.providerId,
      capabilityDigest: this.#authorizedCapabilityDigest,
      challenge: request.challenge,
      ...(connectionNonce === undefined ? {} : { connectionNonce }),
      processId: process.pid,
      revision: state.revision,
      phase: state.phase,
      mutationDigest: state.mutationDigest,
      handoffPayloadDigest: principalAttestation.handoffPayloadDigest,
      publicKey: principalAttestation.publicKey,
      ...(acceptanceIdentity === undefined
        ? {}
        : { acceptanceIdentity }),
    });
    const signature = sign(
      null,
      canonicalizeProviderRuntimeIpcPrincipalAttestationClaimsV1(claims),
      principalAttestation.privateKey,
    );
    const response = ProviderRuntimeIpcPrincipalAttestationV1Schema.parse({
      protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
      kind: "principal_attestation",
      ...claims,
      signature: `base64url:${signature.toString("base64url")}`,
    });
    await writeFrameV1(socket, response);
    return Object.freeze({
      state,
      attestation: response,
      connectionNonce: response.connectionNonce,
      principalAttestationDigest: sha256DigestV1(
        canonicalizeProviderRuntimeIpcPrincipalAttestationTranscriptV1(
          response,
        ),
      ),
      acceptanceIdentity,
    });
  }

  async #deriveAcceptanceIdentityProofV1(
    state: ReturnType<DurableObjectProviderRuntimeStoreV1["inspectState"]>,
  ) {
    const capability = this.#acceptanceIdentityVerificationCapability;
    if (capability === undefined || state.phase !== "final_strong_ready") {
      return undefined;
    }
    const verifier = this.#strongMutationAuthorityVerifier;
    if (
      this.#mutationPolicy !== "acceptance_authority_session_required" ||
      verifier === undefined ||
      !hasProviderRuntimeCurrentFormalAcceptanceResolverInternalV1(verifier)
    ) {
      try {
        const closure = state.artifacts.finalStrongReadyAcceptance;
        if (
          closure === null ||
          typeof closure !== "object" ||
          Array.isArray(closure)
        ) return undefined;
        const envelope =
          ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema.parse(
            (closure as Record<string, unknown>)
              .finalStrongReadyAcceptanceEnvelope,
          );
        if (
          !(await verifyProviderStrongReadyAcceptanceEnvelopeTokenWithIdentityCapabilityV1(
            capability,
            envelope,
          ))
        ) return undefined;
        return ProviderRuntimeIpcAcceptanceIdentityProofV1Schema.parse({
          generationId: envelope.generationId,
          contentDigest: envelope.contentDigest,
          acceptanceOrdinal: envelope.payload.acceptanceOrdinal,
          installationIdentityGenerationId:
            envelope.installationIdentityGenerationId,
        });
      } catch {
        return undefined;
      }
    }
    try {
      const binding =
        await resolveProviderRuntimeCurrentFormalAcceptanceInternalV1(
          verifier,
        );
      if (binding === undefined) return undefined;
      const verified =
        await verifyProviderServiceFormalAcceptanceEnvelopeWithIdentityCapabilityInternalV1(
          capability,
          binding.envelope,
        );
      if (!verified) return undefined;
      projectProviderRuntimeDurableLifecycleArtifactsV1({
        journalState: state,
        expectedAcceptanceEnvelope: binding.envelope,
        expectedAcceptancePin: binding.pin,
      });
      const envelope = binding.envelope;
      return ProviderRuntimeIpcAcceptanceIdentityProofV1Schema.parse({
        generationId: envelope.generationId,
        contentDigest: envelope.contentDigest,
        acceptanceOrdinal: envelope.payload.acceptanceOrdinal,
        installationIdentityGenerationId:
          envelope.installationIdentityGenerationId,
      });
    } catch {
      return undefined;
    }
  }

  async #serveStrongMutationRequestV1(
    socket: Socket,
    request: ProviderRuntimeIpcStrongMutationRequestV1,
    principal: ProviderRuntimePrincipalContinuationV1 | undefined,
  ): Promise<void> {
    // Preserve the same-socket head observation before waiting for another
    // mutation already holding the local queue.  Authorization is repeated
    // inside the queue, so this observation can never grant a stale request.
    try {
      this.#assertStrongMutationRequestPreconditionsV1(request, principal);
    } catch (error) {
      await writeFrameV1(
        socket,
        this.#createStrongMutationResponseV1(request, {
          ok: false,
          error: this.#mapError(error),
        }),
      );
      return;
    }
    const active = this.#withMutationQueueV1(async () => {
      let capability:
        | ProviderRuntimeStrongMutationSessionCapabilityInternalV1
        | undefined;
      let response: ProviderRuntimeIpcStrongMutationResponseV1;
      try {
        capability = await this.#authorizeStrongMutationRequestV1(
          request,
          principal,
        );
        const transfer =
          await takeProviderRuntimeStrongMutationExecutionAuthorizationInternalV1(
            capability,
            request.bindingDigest,
          );
        if (transfer === undefined) {
          throw new ProviderRuntimeMutationCapabilityUnavailableErrorV1();
        }
        if (transfer.decision.disposition === "resolved") {
          response = transfer.decision.response;
        } else {
          const authorization = transfer.authorization;
          if (authorization === undefined) {
            throw new ProviderRuntimeMutationCapabilityUnavailableErrorV1();
          }
          response = transfer.decision.disposition === "execute"
            ? await this.store.executeStrongMutationDurablyV1(
              request,
              authorization,
              (payload) => this.#createStrongMutationResponseV1(request, {
                ok: true,
                payload,
              }),
            )
            : await this.store.recoverStrongMutationOutcomeV1(
              request,
              authorization,
              (payload) => this.#createStrongMutationResponseV1(request, {
                ok: true,
                payload,
              }),
            );
        }
      } catch (error) {
        if (
          error instanceof
            ProviderRuntimeStrongMutationDurabilityIndeterminateErrorV1
        ) {
          // No response is terminally signed or resolved across the post-link
          // fsync cut.  Closing the transport forces the same binding through
          // broker recovery, where EEXIST + parent fsync + exact read-back can
          // establish a durable replay without executing a second namespace
          // mutation.
          socket.destroy();
          return;
        }
        response = this.#createStrongMutationResponseV1(request, {
          ok: false,
          error: this.#mapError(error),
        });
      }

      if (capability !== undefined) {
        const resolved =
          await resolveProviderRuntimeStrongMutationSessionCapabilityInternalV1(
            capability,
            request.bindingDigest,
            response,
          );
        if (!resolved) {
          // The durable prepared response remains the sole outcome authority.
          // Failed broker resolution stays pending for exact recovery; an
          // alternate signed failure would create a split-brain outcome.
          socket.destroy();
          return;
        }
      }
      await writeFrameV1(socket, response);
    });
    this.#activeStrongMutations.add(active);
    try {
      await active;
    } finally {
      this.#activeStrongMutations.delete(active);
    }
  }

  async #authorizeStrongMutationRequestV1(
    request: ProviderRuntimeIpcStrongMutationRequestV1,
    principal: ProviderRuntimePrincipalContinuationV1 | undefined,
  ): Promise<ProviderRuntimeStrongMutationSessionCapabilityInternalV1> {
    const { verifier, acceptanceIdentity, continuation } =
      this.#assertStrongMutationRequestPreconditionsV1(request, principal);
    const capability =
      await consumeProviderRuntimeStrongMutationAuthorityGrantInternalV1(
        verifier,
        {
          request,
          providerId: DurableObjectIdentityProviderIdV1Schema.parse(
            this.providerId,
          ),
          capabilityDigest: ContentDigestV1Schema.parse(
            this.#authorizedCapabilityDigest,
          ),
          principalAttestationDigest: request.principalAttestationDigest,
          bindingDigest: request.bindingDigest,
          operation: request.operation,
          operationNonce: request.operationNonce,
          requestDigest: request.requestDigest,
          authorityGrant: request.authorityGrant,
          journalHead: {
            revision: continuation.state.revision,
            phase: continuation.state.phase,
            mutationDigest: continuation.state.mutationDigest,
          },
          acceptanceIdentity,
          principalAttestation: continuation.attestation,
        },
      );
    if (
      capability === undefined ||
      !exactJournalHeadV1(continuation.state, this.store.inspectState()) ||
      !consumeProviderRuntimeStrongMutationSessionCapabilityInternalV1(
        capability,
        request.bindingDigest,
      )
    ) {
      throw new ProviderRuntimeMutationCapabilityUnavailableErrorV1();
    }
    return capability;
  }

  async #recoverDurableStrongMutationOutcomesV1(): Promise<void> {
    const verifier = this.#strongMutationAuthorityVerifier;
    if (verifier === undefined) return;
    const migrationRequired =
      await this.store.strongMutationNonceReceiptMigrationRequiredV1();
    const outcomes = await this.store.inspectStrongMutationOutcomesForRecoveryV1();
    const migrationSelections = new Map<
      string,
      Readonly<{
        readonly bindingDigest: string;
        readonly intentOrdinal: number;
        readonly firstIntentOrdinal: number;
        readonly firstBindingDigest: string;
      }>
    >();
    if (migrationRequired) {
      for (const outcome of outcomes) {
        const authority =
          await inspectProviderRuntimeStrongMutationLegacyOutcomeAuthorityInternalV1(
            verifier,
            { request: outcome.request, response: outcome.response },
          );
        if (authority === undefined) {
          throw new ProviderRuntimeMutationCapabilityUnavailableErrorV1();
        }
        const prior = migrationSelections.get(outcome.request.operationNonce);
        if (
          prior !== undefined &&
          (prior.firstBindingDigest !== authority.firstBindingDigest ||
            prior.firstIntentOrdinal !== authority.firstIntentOrdinal)
        ) {
          throw new ProviderRuntimeMutationCapabilityUnavailableErrorV1();
        }
        if (prior === undefined || authority.intentOrdinal < prior.intentOrdinal) {
          migrationSelections.set(
            outcome.request.operationNonce,
            Object.freeze({
              bindingDigest: outcome.request.bindingDigest,
              intentOrdinal: authority.intentOrdinal,
              firstIntentOrdinal: authority.firstIntentOrdinal,
              firstBindingDigest: authority.firstBindingDigest,
            }),
          );
        }
      }
    }
    for (const outcome of outcomes) {
      const request = outcome.request;
      const grant = request.authorityGrant.payload;
      const capability =
        await consumeProviderRuntimeStrongMutationAuthorityGrantInternalV1(
          verifier,
          {
            request,
            providerId: DurableObjectIdentityProviderIdV1Schema.parse(
              this.providerId,
            ),
            capabilityDigest: ContentDigestV1Schema.parse(
              this.#authorizedCapabilityDigest,
            ),
            principalAttestationDigest: request.principalAttestationDigest,
            bindingDigest: request.bindingDigest,
            operation: request.operation,
            operationNonce: request.operationNonce,
            requestDigest: request.requestDigest,
            authorityGrant: request.authorityGrant,
            journalHead: Object.freeze({ ...grant.journalHead }),
            acceptanceIdentity: grant.acceptanceIdentity,
          },
        );
      if (
        capability === undefined ||
        !consumeProviderRuntimeStrongMutationSessionCapabilityInternalV1(
          capability,
          request.bindingDigest,
        )
      ) throw new ProviderRuntimeMutationCapabilityUnavailableErrorV1();
      const transfer =
        await takeProviderRuntimeStrongMutationExecutionAuthorizationInternalV1(
          capability,
          request.bindingDigest,
        );
      if (transfer === undefined) {
        throw new ProviderRuntimeMutationCapabilityUnavailableErrorV1();
      }
      let response: ProviderRuntimeIpcStrongMutationResponseV1;
      if (transfer.decision.disposition === "resolved") {
        response = transfer.decision.response;
      } else {
        if (
          transfer.decision.disposition !== "recover" ||
          transfer.authorization === undefined
        ) throw new ProviderRuntimeMutationCapabilityUnavailableErrorV1();
        response = await this.store.recoverStrongMutationOutcomeV1(
          request,
          transfer.authorization,
          (payload) => this.#createStrongMutationResponseV1(request, {
            ok: true,
            payload,
          }),
        );
      }
      if (
        canonicalizeJcsSafeIntegerV1(response) !==
          canonicalizeJcsSafeIntegerV1(outcome.response) ||
        !await resolveProviderRuntimeStrongMutationSessionCapabilityInternalV1(
          capability,
          request.bindingDigest,
          response,
        )
      ) throw new ProviderRuntimeMutationCapabilityUnavailableErrorV1();
    }
    if (migrationRequired) {
      await this.store.finalizeStrongMutationNonceReceiptMigrationV1(
        [...migrationSelections].map(([operationNonce, selection]) =>
          Object.freeze({
            operationNonce,
            bindingDigest: selection.bindingDigest,
          })
        ),
      );
    }
  }

  #assertStrongMutationRequestPreconditionsV1(
    request: ProviderRuntimeIpcStrongMutationRequestV1,
    principal: ProviderRuntimePrincipalContinuationV1 | undefined,
  ): Readonly<{
    readonly verifier: ProviderRuntimeStrongMutationAuthorityVerifierCapabilityInternalV1;
    readonly acceptanceIdentity: ProviderRuntimeIpcAcceptanceIdentityProofV1;
    readonly continuation: ProviderRuntimePrincipalContinuationV1;
  }> {
    const verifier = this.#strongMutationAuthorityVerifier;
    const acceptanceIdentity = principal?.acceptanceIdentity;
    if (
      verifier === undefined ||
      principal === undefined ||
      principal.connectionNonce === undefined ||
      principal.attestation.connectionNonce !== principal.connectionNonce ||
      acceptanceIdentity === undefined ||
      request.principalAttestationDigest !==
        principal.principalAttestationDigest
    ) {
      throw new ProviderRuntimeMutationCapabilityUnavailableErrorV1();
    }
    const requestDigest = sha256DigestV1(
      canonicalizeProviderRuntimeIpcStrongMutationRequestV1(
        ProviderRuntimeIpcStrongMutationRequestClaimsV1Schema.parse({
          operation: request.operation,
          operationNonce: request.operationNonce,
          payload: request.payload,
        }),
      ),
    );
    const bindingDigest = sha256DigestV1(
      canonicalizeProviderRuntimeIpcStrongMutationSessionBindingV1({
        principalAttestationDigest: request.principalAttestationDigest,
        operation: request.operation,
        operationNonce: request.operationNonce,
        requestDigest: request.requestDigest,
        authorityGrant: request.authorityGrant,
      }),
    );
    if (
      request.requestDigest !== requestDigest ||
      request.bindingDigest !== bindingDigest ||
      !exactJournalHeadV1(principal.state, this.store.inspectState())
    ) {
      throw new ProviderRuntimeMutationCapabilityUnavailableErrorV1();
    }

    return Object.freeze({
      verifier,
      acceptanceIdentity,
      continuation: principal,
    });
  }

  #createStrongMutationResponseV1(
    request: ProviderRuntimeIpcStrongMutationRequestV1,
    result: StrongMutationResponseResultV1,
  ): ProviderRuntimeIpcStrongMutationResponseV1 {
    const principalAttestation = this.#principalAttestation;
    if (principalAttestation === undefined) {
      throw new ProviderRuntimeMutationCapabilityUnavailableErrorV1();
    }
    const unsigned = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse({
      protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
      kind: "strong_mutation_response",
      requestId: request.requestId,
      principalAttestationDigest: request.principalAttestationDigest,
      bindingDigest: request.bindingDigest,
      operation: request.operation,
      operationNonce: request.operationNonce,
      requestDigest: request.requestDigest,
      ...result,
      signature: `base64url:${Buffer.alloc(64).toString("base64url")}`,
    });
    const signature = sign(
      null,
      canonicalizeProviderRuntimeIpcStrongMutationResponseClaimsV1(unsigned),
      principalAttestation.privateKey,
    );
    const response: ProviderRuntimeIpcStrongMutationResponseV1 =
      ProviderRuntimeIpcStrongMutationResponseV1Schema.parse({
        ...unsigned,
        signature: `base64url:${signature.toString("base64url")}`,
      });
    return response;
  }

  #parseRequest(frame: string): ProviderRuntimeIpcRequestV1 {
    let parsed: unknown;
    try {
      parsed = JSON.parse(frame) as unknown;
    } catch {
      throw new ProviderRuntimeServerErrorV1("runtime request is not JSON");
    }
    const result = ProviderRuntimeIpcRequestV1Schema.safeParse(parsed);
    if (!result.success) {
      throw new ProviderRuntimeServerErrorV1("runtime request is invalid");
    }
    return result.data;
  }

  async #dispatch(
    request: ProviderRuntimeIpcRequestV1,
  ): Promise<unknown> {
    switch (request.operation) {
      case "inspect_state":
        return {
          operation: "inspect_state",
          state: this.store.inspectState(),
        };
      case "read_object": {
        const result = await this.store.readFixedObject(request.payload.locator);
        return { operation: "read_object", ...result };
      }
      case "write_object": {
        return this.#withMutationQueueV1(async () => {
          this.#assertHmacMutationAllowedV1();
          const result = await this.store.writeFixedObject(
            request.payload.locator,
            request.payload.logicalBytes,
            request.payload.bytes,
          );
          return { operation: "write_object", ...result };
        });
      }
      case "compare_commit": {
        return this.#withMutationQueueV1(async () => {
          this.#assertHmacMutationAllowedV1();
          const result = await this.store.compareCommit(request.payload);
          return { operation: "compare_commit", ...result };
        });
      }
      default:
        throw new ProviderRuntimeServerErrorV1("unsupported runtime operation");
    }
  }

  async #withMutationQueueV1<T>(operation: () => Promise<T>): Promise<T> {
    if (this.#mutationQueueActive) {
      await new Promise<void>((resolvePromise) => {
        this.#mutationQueueWaiters.push(resolvePromise);
      });
    } else {
      this.#mutationQueueActive = true;
    }
    try {
      return await operation();
    } finally {
      const next = this.#mutationQueueWaiters.shift();
      if (next === undefined) {
        this.#mutationQueueActive = false;
      } else {
        next();
      }
    }
  }

  #assertHmacMutationAllowedV1(): void {
    if (this.#mutationPolicy === "acceptance_authority_session_required") {
      // The production service never upgrades shared-HMAC possession into a
      // mutation capability. Its only mutation path is the signed-principal
      // continuation handled separately above.
      throw new ProviderRuntimeMutationCapabilityUnavailableErrorV1();
    }
  }

  async #writeError(
    socket: Socket,
    sessionId: string,
    requestId: string,
    code: ErrorCodeV1,
    message: string,
  ): Promise<void> {
    const response = signWireV1(
      this.#authKey,
      ProviderRuntimeIpcResponseV1Schema.parse({
        protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
        kind: "response",
        sessionId,
        requestId,
        sequence: 1,
        ok: false,
        error: { code, message: safeErrorMessageV1(message) },
        authTag: ZERO_AUTH_TAG_V1,
      }),
    );
    await writeFrameV1(socket, response);
  }

  #mapError(error: unknown): { readonly code: ErrorCodeV1; readonly message: string } {
    if (error instanceof ProviderRuntimeMutationCapabilityUnavailableErrorV1) {
      return {
        code: "capability_mismatch",
        message: "runtime mutation capability is unavailable",
      };
    }
    if (error instanceof ProviderRuntimeStorageErrorV1) {
      switch (error.code) {
        case "object_not_found":
          return { code: "object_not_found", message: error.message };
        case "object_digest_mismatch":
          return { code: "object_digest_mismatch", message: error.message };
        case "object_length_mismatch":
          return { code: "object_length_mismatch", message: error.message };
        case "operation_nonce_conflict":
          return { code: "operation_nonce_conflict", message: error.message };
        case "provider_mismatch":
          return { code: "capability_mismatch", message: error.message };
        case "invalid_input":
          return { code: "frame_invalid", message: error.message };
        default:
          return {
            code: "storage_failure",
            message: "durable provider storage operation failed",
          };
      }
    }
    return {
      code: "frame_invalid",
      message:
        error instanceof Error
          ? safeErrorMessageV1(error.message)
          : "durable provider runtime request failed",
    };
  }
}
