/**
 * Client-private, one-connection strong-mutation wire exchange.
 *
 * This module proves the configured service signing key, an exact journal
 * head, and an exact Installation Acceptance identity before asking the
 * caller's opaque signer to mint one grant. It deliberately makes no kernel
 * peer, local-target-currentness, Registry-currentness, or Store-authority
 * claim. Those production authorities do not exist in this package yet, so
 * this seam is intentionally absent from the public package index.
 */

import {
  createHash,
  createPublicKey,
  randomBytes,
  verify,
  type KeyObject,
} from "node:crypto";
import { createConnection, type Socket } from "node:net";

import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";
import {
  CanonicalByteStringV1Schema,
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  type ContentDigestV1,
} from "@understand-code/durable-object-provider-contracts/primitives";
import {
  PROVIDER_RUNTIME_IPC_MAX_FRAME_BYTES_V1,
  PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
  ProviderRuntimeIpcAcceptanceIdentityProofV1Schema,
  ProviderRuntimeIpcPrincipalAttestationClaimsV1Schema,
  ProviderRuntimeIpcPrincipalAttestationV1Schema,
  ProviderRuntimeIpcPrincipalChallengeV1Schema,
  ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1Schema,
  ProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsV1Schema,
  ProviderRuntimeIpcStrongMutationRequestClaimsV1Schema,
  ProviderRuntimeIpcStrongMutationRequestV1Schema,
  ProviderRuntimeIpcStrongMutationResponseV1Schema,
  canonicalizeProviderRuntimeIpcPrincipalAttestationClaimsV1,
  canonicalizeProviderRuntimeIpcPrincipalAttestationTranscriptV1,
  canonicalizeProviderRuntimeIpcStrongMutationRequestV1,
  canonicalizeProviderRuntimeIpcStrongMutationResponseClaimsV1,
  canonicalizeProviderRuntimeIpcStrongMutationSessionBindingV1,
  deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1,
  projectProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsV1,
  type ProviderRuntimeIpcAcceptanceIdentityProofV1,
  type ProviderRuntimeIpcPrincipalAttestationV1,
  type ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1,
  type ProviderRuntimeIpcStrongMutationRequestClaimsV1,
  type ProviderRuntimeIpcStrongMutationResponseV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";

import {
  consumeProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1,
  type ProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1,
} from "./provider-runtime-strong-mutation-authority-grant-signer-internal.js";
import {
  encodeProviderRuntimeIpcFrameV1,
} from "./ipc-auth.js";

const DEFAULT_TIMEOUT_MS_V1 = 5_000;
const MAXIMUM_TIMEOUT_MS_V1 = 60_000;
const ED25519_SIGNATURE_BYTES_V1 = 64;

export type ProviderRuntimeStrongMutationGrantStaticFieldsInternalV1 = Pick<
  ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1,
  | "signerKeyId"
  | "targetProfileId"
  | "targetFingerprintDigest"
  | "registryManifest"
>;

export interface ProviderRuntimeStrongMutationExpectedPrincipalInternalV1 {
  readonly providerId:
    ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1["providerId"];
  readonly capabilityDigest: ContentDigestV1;
  readonly handoffPayloadDigest: ContentDigestV1;
  /** Exact Ed25519 SPKI named by an already verified service handoff. */
  readonly servicePublicKey: ProviderRuntimeIpcPrincipalAttestationV1["publicKey"];
  readonly journalHead:
    ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1["journalHead"];
  readonly acceptanceIdentity: ProviderRuntimeIpcAcceptanceIdentityProofV1;
}

export interface ProviderRuntimeStrongMutationOperationPlanInternalV1 {
  readonly operation:
    ProviderRuntimeIpcStrongMutationRequestClaimsV1["operation"];
  readonly operationNonce:
    ProviderRuntimeIpcStrongMutationRequestClaimsV1["operationNonce"];
  readonly requestDigest: ContentDigestV1;
}

export interface ExchangeProviderRuntimeStrongMutationSameSocketInternalV1Input {
  readonly socketPath: string;
  readonly timeoutMs?: number;
  readonly expectedPrincipal:
    ProviderRuntimeStrongMutationExpectedPrincipalInternalV1;
  /**
   * Exact target/Registry binding supplied by the future Trust Verifier's
   * opaque verified selection. This internal substrate only binds these
   * fields into the grant; accepting this DTO does not establish their
   * authority, currentness, or local-target provenance.
   */
  readonly grantStaticFields:
    ProviderRuntimeStrongMutationGrantStaticFieldsInternalV1;
  readonly request: ProviderRuntimeIpcStrongMutationRequestClaimsV1;
  /**
   * Optional private composition hook for binding one exact Provider operation
   * before any connection, signing, or mutation side effect is attempted.
   */
  readonly observeProviderOperationPlan?: (
    plan: ProviderRuntimeStrongMutationOperationPlanInternalV1,
  ) => void | Promise<void>;
  /**
   * Invoked exactly once, only after the signed principal and Acceptance are
   * verified. The returned opaque signer is consumed delete-before-sign.
   */
  readonly mintSigner: (
    grantFields: ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1,
  ) =>
    | ProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1
    | Promise<ProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1>;
}

type StrongMutationSuccessPayloadInternalV1 = Extract<
  ProviderRuntimeIpcStrongMutationResponseV1,
  { readonly ok: true }
>["payload"];

export type ProviderRuntimeStrongMutationClientErrorCodeInternalV1 =
  | "invalid_input"
  | "operation_plan_rejected"
  | "transport_unavailable"
  | "principal_invalid"
  | "signer_unavailable"
  | "response_invalid"
  | "runtime_rejected";

export class ProviderRuntimeStrongMutationClientErrorInternalV1 extends Error {
  readonly code: ProviderRuntimeStrongMutationClientErrorCodeInternalV1;
  readonly runtimeCode?: string;

  constructor(
    code: ProviderRuntimeStrongMutationClientErrorCodeInternalV1,
    message: string,
    options?: ErrorOptions & { readonly runtimeCode?: string },
  ) {
    super(message, options);
    this.name = "ProviderRuntimeStrongMutationClientErrorInternalV1";
    this.code = code;
    this.runtimeCode = options?.runtimeCode;
  }
}

interface ParsedExpectedPrincipalInternalV1 {
  readonly providerId:
    ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1["providerId"];
  readonly capabilityDigest: ContentDigestV1;
  readonly handoffPayloadDigest: ContentDigestV1;
  readonly servicePublicKey: ProviderRuntimeIpcPrincipalAttestationV1["publicKey"];
  readonly serviceVerificationKey: KeyObject;
  readonly journalHead:
    ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1["journalHead"];
  readonly acceptanceIdentity: ProviderRuntimeIpcAcceptanceIdentityProofV1;
}

function failV1(
  code: ProviderRuntimeStrongMutationClientErrorCodeInternalV1,
  message: string,
  options?: ErrorOptions & { readonly runtimeCode?: string },
): never {
  throw new ProviderRuntimeStrongMutationClientErrorInternalV1(
    code,
    message,
    options,
  );
}

function snapshotOperationPlanObserverV1(
  input: object,
): ExchangeProviderRuntimeStrongMutationSameSocketInternalV1Input[
  "observeProviderOperationPlan"
] {
  let hasOwnObserver: boolean;
  try {
    hasOwnObserver = Object.hasOwn(input, "observeProviderOperationPlan");
  } catch {
    return failV1("invalid_input", "strong mutation exchange input is invalid");
  }
  if (!hasOwnObserver) return undefined;
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(
      input,
      "observeProviderOperationPlan",
    );
  } catch {
    return failV1("invalid_input", "strong mutation exchange input is invalid");
  }
  if (
    descriptor === undefined ||
    !Object.hasOwn(descriptor, "value") ||
    (descriptor.value !== undefined &&
      typeof descriptor.value !== "function")
  ) {
    return failV1(
      "invalid_input",
      "strong mutation exchange input is invalid",
    );
  }
  return descriptor.value as
    ExchangeProviderRuntimeStrongMutationSameSocketInternalV1Input[
      "observeProviderOperationPlan"
    ];
}

function exactCanonicalEqualV1(left: unknown, right: unknown): boolean {
  try {
    return canonicalizeJcsSafeIntegerV1(left) ===
      canonicalizeJcsSafeIntegerV1(right);
  } catch {
    return false;
  }
}

function positiveTimeoutV1(value: number | undefined): number {
  const timeout = value ?? DEFAULT_TIMEOUT_MS_V1;
  if (
    !Number.isSafeInteger(timeout) ||
    timeout < 1 ||
    timeout > MAXIMUM_TIMEOUT_MS_V1
  ) {
    return failV1("invalid_input", "strong mutation timeout is invalid");
  }
  return timeout;
}

function exactEd25519PublicKeyV1(value: unknown): {
  readonly encoded: ProviderRuntimeIpcPrincipalAttestationV1["publicKey"];
  readonly key: KeyObject;
} {
  try {
    const encoded = CanonicalByteStringV1Schema.parse(value);
    const bytes = Buffer.from(
      encoded.slice("base64url:".length),
      "base64url",
    );
    const key = createPublicKey({ key: bytes, format: "der", type: "spki" });
    const canonical = Buffer.from(
      key.export({ format: "der", type: "spki" }),
    );
    if (
      key.type !== "public" ||
      key.asymmetricKeyType !== "ed25519" ||
      !canonical.equals(bytes)
    ) {
      return failV1(
        "invalid_input",
        "strong mutation service public key is invalid",
      );
    }
    return { encoded, key };
  } catch (error) {
    if (error instanceof ProviderRuntimeStrongMutationClientErrorInternalV1) {
      throw error;
    }
    return failV1(
      "invalid_input",
      "strong mutation service public key is invalid",
    );
  }
}

function parseExpectedPrincipalV1(
  input: ProviderRuntimeStrongMutationExpectedPrincipalInternalV1,
): ParsedExpectedPrincipalInternalV1 {
  try {
    const publicKey = exactEd25519PublicKeyV1(input.servicePublicKey);
    const journalHead =
      ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1Schema.shape
        .journalHead.parse(input.journalHead);
    const acceptanceIdentity =
      ProviderRuntimeIpcAcceptanceIdentityProofV1Schema.parse(
        input.acceptanceIdentity,
      );
    return Object.freeze({
      providerId: DurableObjectIdentityProviderIdV1Schema.parse(
        input.providerId,
      ),
      capabilityDigest: ContentDigestV1Schema.parse(input.capabilityDigest),
      handoffPayloadDigest: ContentDigestV1Schema.parse(
        input.handoffPayloadDigest,
      ),
      servicePublicKey: publicKey.encoded,
      serviceVerificationKey: publicKey.key,
      journalHead: Object.freeze({ ...journalHead }),
      acceptanceIdentity: Object.freeze({ ...acceptanceIdentity }),
    });
  } catch (error) {
    if (error instanceof ProviderRuntimeStrongMutationClientErrorInternalV1) {
      throw error;
    }
    return failV1("invalid_input", "expected strong principal is invalid");
  }
}

function decodeExactSignatureV1(value: string): Uint8Array | undefined {
  try {
    const encoded = CanonicalByteStringV1Schema.parse(value);
    const bytes = Uint8Array.from(
      Buffer.from(encoded.slice("base64url:".length), "base64url"),
    );
    return bytes.byteLength === ED25519_SIGNATURE_BYTES_V1
      ? bytes
      : undefined;
  } catch {
    return undefined;
  }
}

function verifyPrincipalAttestationV1(
  response: ProviderRuntimeIpcPrincipalAttestationV1,
  challenge: string,
  expected: ParsedExpectedPrincipalInternalV1,
): void {
  const signature = decodeExactSignatureV1(response.signature);
  const {
    protocol: _protocol,
    kind: _kind,
    signature: _signature,
    ...claimFields
  } = response;
  const claims =
    ProviderRuntimeIpcPrincipalAttestationClaimsV1Schema.parse(claimFields);
  if (
    response.challenge !== challenge ||
    response.connectionNonce === undefined ||
    response.providerId !== expected.providerId ||
    response.capabilityDigest !== expected.capabilityDigest ||
    response.handoffPayloadDigest !== expected.handoffPayloadDigest ||
    response.publicKey !== expected.servicePublicKey ||
    response.revision !== expected.journalHead.revision ||
    response.phase !== expected.journalHead.phase ||
    response.mutationDigest !== expected.journalHead.mutationDigest ||
    response.acceptanceIdentity === undefined ||
    !exactCanonicalEqualV1(
      response.acceptanceIdentity,
      expected.acceptanceIdentity,
    ) ||
    signature === undefined ||
    !verify(
      null,
      canonicalizeProviderRuntimeIpcPrincipalAttestationClaimsV1(claims),
      expected.serviceVerificationKey,
      signature,
    )
  ) {
    return failV1(
      "principal_invalid",
      "strong mutation principal attestation is invalid",
    );
  }
}

function sha256DigestV1(bytes: Uint8Array): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
  );
}

function parseGrantStaticFieldsV1(
  input: ProviderRuntimeStrongMutationGrantStaticFieldsInternalV1,
  expected: ParsedExpectedPrincipalInternalV1,
  request: ProviderRuntimeIpcStrongMutationRequestClaimsV1,
): Omit<
  ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1,
  | "acceptanceIdentity"
  | "principalAttestationDigest"
  | "journalHead"
  | "operation"
  | "operationNonce"
  | "requestDigest"
> {
  try {
    const placeholder = ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1Schema.parse({
      ...input,
      providerId: expected.providerId,
      capabilityDigest: expected.capabilityDigest,
      acceptanceIdentity: expected.acceptanceIdentity,
      principalAttestationDigest: `sha256:${"0".repeat(64)}`,
      journalHead: expected.journalHead,
      operation: request.operation,
      operationNonce: request.operationNonce,
      requestDigest: `sha256:${"0".repeat(64)}`,
    });
    const {
      acceptanceIdentity: _acceptanceIdentity,
      principalAttestationDigest: _principalAttestationDigest,
      journalHead: _journalHead,
      operation: _operation,
      operationNonce: _operationNonce,
      requestDigest: _requestDigest,
      ...staticFields
    } = placeholder;
    return staticFields;
  } catch {
    return failV1("invalid_input", "strong mutation grant fields are invalid");
  }
}

function verifyStrongResponseV1(
  response: ProviderRuntimeIpcStrongMutationResponseV1,
  request: ReturnType<typeof ProviderRuntimeIpcStrongMutationRequestV1Schema.parse>,
  expected: ParsedExpectedPrincipalInternalV1,
): StrongMutationSuccessPayloadInternalV1 {
  const signature = decodeExactSignatureV1(response.signature);
  if (
    response.requestId !== request.requestId ||
    response.principalAttestationDigest !==
      request.principalAttestationDigest ||
    response.bindingDigest !== request.bindingDigest ||
    response.operation !== request.operation ||
    response.operationNonce !== request.operationNonce ||
    response.requestDigest !== request.requestDigest ||
    signature === undefined ||
    !verify(
      null,
      canonicalizeProviderRuntimeIpcStrongMutationResponseClaimsV1(response),
      expected.serviceVerificationKey,
      signature,
    )
  ) {
    return failV1(
      "response_invalid",
      "strong mutation response is invalid",
    );
  }
  if (!response.ok) {
    return failV1(
      "runtime_rejected",
      "provider runtime rejected the strong mutation",
      { runtimeCode: response.error.code },
    );
  }
  return response.payload;
}

interface PendingFrameReadInternalV1 {
  readonly closedMessage: string;
  readonly chunks: Buffer[];
  totalBytes: number;
  readonly resolve: (frame: string) => void;
  readonly reject: (error: Error) => void;
}

interface PendingWriteInternalV1 {
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
}

interface PendingFinalCloseInternalV1 {
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
}

/**
 * One-socket, one-frame-at-a-time transport. The persistent listeners remain
 * attached through destroy so late timeout/EPIPE events can never escape as
 * process-level errors.
 */
class ProviderRuntimeStrongMutationSocketTransportInternalV1 {
  readonly #socket: Socket;
  readonly #timeoutMs: number;
  readonly #connected: Promise<void>;
  #resolveConnected!: () => void;
  #rejectConnected!: (error: Error) => void;
  #connectTimer: ReturnType<typeof setTimeout> | undefined;
  #connectSettled = false;
  #disposed = false;
  #terminalError:
    | ProviderRuntimeStrongMutationClientErrorInternalV1
    | undefined;
  #frameRead: PendingFrameReadInternalV1 | undefined;
  #write: PendingWriteInternalV1 | undefined;
  #completedFrames = 0;
  #peerClosedAfterFinalFrame = false;
  #finalClose: PendingFinalCloseInternalV1 | undefined;

  constructor(socket: Socket, timeoutMs: number) {
    this.#socket = socket;
    this.#timeoutMs = timeoutMs;
    this.#connected = new Promise<void>((resolvePromise, rejectPromise) => {
      this.#resolveConnected = resolvePromise;
      this.#rejectConnected = rejectPromise;
    });
    socket.on("data", this.#onData);
    socket.on("error", this.#onError);
    socket.on("end", this.#onEnd);
    socket.on("close", this.#onClose);
    socket.on("timeout", this.#onTimeout);
    socket.once("connect", this.#onConnect);
    this.#connectTimer = setTimeout(() => {
      this.#fail(
        "provider runtime connection timed out",
      );
    }, timeoutMs);
  }

  async waitUntilConnected(): Promise<void> {
    return this.#connected;
  }

  async exchangeFrame(
    wire: unknown,
    closedMessage: string,
  ): Promise<string> {
    const encoded = encodeProviderRuntimeIpcFrameV1(wire);
    const response = this.#readFrame(closedMessage);
    const written = this.#writeFrame(encoded);
    const [, frame] = await Promise.all([written, response]);
    return frame;
  }

  waitForFinalPeerClose(): Promise<void> {
    if (this.#terminalError !== undefined) {
      return Promise.reject(this.#terminalError);
    }
    if (this.#completedFrames !== 2) {
      return Promise.reject(
        new ProviderRuntimeStrongMutationClientErrorInternalV1(
          "transport_unavailable",
          "provider runtime final IPC frame count is invalid",
        ),
      );
    }
    if (this.#peerClosedAfterFinalFrame) return Promise.resolve();
    if (this.#finalClose !== undefined) {
      return Promise.reject(
        new ProviderRuntimeStrongMutationClientErrorInternalV1(
          "transport_unavailable",
          "provider runtime final close wait overlapped",
        ),
      );
    }
    return new Promise<void>((resolvePromise, rejectPromise) => {
      this.#finalClose = {
        resolve: resolvePromise,
        reject: rejectPromise,
      };
    });
  }

  close(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#connectTimer !== undefined) {
      clearTimeout(this.#connectTimer);
      this.#connectTimer = undefined;
    }
    this.#socket.setTimeout(0);
    if (!this.#socket.destroyed) this.#socket.destroy();
  }

  readonly #onConnect = (): void => {
    if (this.#disposed || this.#terminalError !== undefined) return;
    if (this.#connectTimer !== undefined) {
      clearTimeout(this.#connectTimer);
      this.#connectTimer = undefined;
    }
    this.#socket.setNoDelay(true);
    this.#socket.setTimeout(this.#timeoutMs);
    if (!this.#connectSettled) {
      this.#connectSettled = true;
      this.#resolveConnected();
    }
  };

  readonly #onData = (chunk: Buffer): void => {
    if (this.#disposed || this.#terminalError !== undefined) return;
    const pending = this.#frameRead;
    if (pending === undefined) {
      this.#fail("provider runtime sent an unexpected trailing IPC frame");
      return;
    }

    const newline = chunk.indexOf(0x0a);
    const frameChunk = newline === -1 ? chunk : chunk.subarray(0, newline);
    const nextTotal = pending.totalBytes + frameChunk.byteLength;
    const completeBytes = nextTotal + (newline === -1 ? 0 : 1);
    if (
      completeBytes > PROVIDER_RUNTIME_IPC_MAX_FRAME_BYTES_V1 ||
      (newline === -1 &&
        nextTotal >= PROVIDER_RUNTIME_IPC_MAX_FRAME_BYTES_V1)
    ) {
      this.#fail("provider runtime IPC frame exceeds the frozen limit");
      return;
    }
    if (newline !== -1 && newline !== chunk.byteLength - 1) {
      this.#fail(
        "provider runtime sent trailing bytes or multiple IPC frames",
      );
      return;
    }

    pending.chunks.push(frameChunk);
    pending.totalBytes = nextTotal;
    if (newline === -1) return;

    let bytes = Buffer.concat(pending.chunks, pending.totalBytes);
    if (bytes.at(-1) === 0x0d) bytes = bytes.subarray(0, -1);
    if (bytes.byteLength === 0) {
      this.#fail("provider runtime IPC frame is empty");
      return;
    }
    let frame: string;
    try {
      frame = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (error) {
      this.#fail("provider runtime IPC frame is not UTF-8", error);
      return;
    }
    this.#frameRead = undefined;
    this.#completedFrames += 1;
    pending.resolve(frame);
  };

  readonly #onError = (error: Error): void => {
    if (this.#disposed) return;
    this.#fail(
      this.#connectSettled
        ? "provider runtime socket failed"
        : "provider runtime connection failed",
      error,
    );
  };

  readonly #onEnd = (): void => {
    if (this.#disposed) return;
    if (this.#acceptFinalPeerClose()) return;
    this.#fail(
      this.#frameRead?.closedMessage ??
        "provider runtime ended the strong mutation connection",
    );
  };

  readonly #onClose = (): void => {
    if (this.#disposed) return;
    if (this.#acceptFinalPeerClose()) return;
    this.#fail(
      this.#frameRead?.closedMessage ??
        "provider runtime closed the strong mutation connection",
    );
  };

  readonly #onTimeout = (): void => {
    if (this.#disposed) return;
    this.#fail("provider runtime strong mutation IPC timed out");
  };

  #readFrame(closedMessage: string): Promise<string> {
    if (this.#terminalError !== undefined) {
      return Promise.reject(this.#terminalError);
    }
    if (this.#frameRead !== undefined) {
      return Promise.reject(
        new ProviderRuntimeStrongMutationClientErrorInternalV1(
          "transport_unavailable",
          "provider runtime IPC frame read overlapped",
        ),
      );
    }
    return new Promise<string>((resolvePromise, rejectPromise) => {
      this.#frameRead = {
        closedMessage,
        chunks: [],
        totalBytes: 0,
        resolve: resolvePromise,
        reject: rejectPromise,
      };
    });
  }

  #acceptFinalPeerClose(): boolean {
    if (this.#completedFrames !== 2 || this.#frameRead !== undefined) {
      return false;
    }
    this.#peerClosedAfterFinalFrame = true;
    const finalClose = this.#finalClose;
    this.#finalClose = undefined;
    finalClose?.resolve();
    return true;
  }

  #writeFrame(frame: string): Promise<void> {
    if (this.#terminalError !== undefined) {
      return Promise.reject(this.#terminalError);
    }
    if (this.#write !== undefined) {
      return Promise.reject(
        new ProviderRuntimeStrongMutationClientErrorInternalV1(
          "transport_unavailable",
          "provider runtime IPC frame write overlapped",
        ),
      );
    }
    return new Promise<void>((resolvePromise, rejectPromise) => {
      const pending: PendingWriteInternalV1 = {
        resolve: resolvePromise,
        reject: rejectPromise,
      };
      this.#write = pending;
      try {
        this.#socket.write(frame, "utf8", (error) => {
          if (this.#write !== pending) return;
          if (error !== undefined && error !== null) {
            this.#fail("provider runtime IPC frame write failed", error);
            return;
          }
          this.#write = undefined;
          pending.resolve();
        });
      } catch (error) {
        this.#fail("provider runtime IPC frame write failed", error);
      }
    });
  }

  #fail(message: string, cause?: unknown): void {
    if (this.#terminalError !== undefined || this.#disposed) return;
    const error = new ProviderRuntimeStrongMutationClientErrorInternalV1(
      "transport_unavailable",
      message,
      { cause },
    );
    this.#terminalError = error;
    if (this.#connectTimer !== undefined) {
      clearTimeout(this.#connectTimer);
      this.#connectTimer = undefined;
    }
    if (!this.#connectSettled) {
      this.#connectSettled = true;
      this.#rejectConnected(error);
    }
    const frameRead = this.#frameRead;
    this.#frameRead = undefined;
    frameRead?.reject(error);
    const write = this.#write;
    this.#write = undefined;
    write?.reject(error);
    const finalClose = this.#finalClose;
    this.#finalClose = undefined;
    finalClose?.reject(error);
    if (!this.#socket.destroyed) this.#socket.destroy();
  }
}

async function connectStrongMutationTransportV1(
  path: string,
  timeoutMs: number,
): Promise<ProviderRuntimeStrongMutationSocketTransportInternalV1> {
  let socket: Socket;
  try {
    socket = createConnection({ path });
  } catch (error) {
    return failV1(
      "transport_unavailable",
      "provider runtime connection failed",
      { cause: error },
    );
  }
  const transport =
    new ProviderRuntimeStrongMutationSocketTransportInternalV1(
      socket,
      timeoutMs,
    );
  try {
    await transport.waitUntilConnected();
    return transport;
  } catch (error) {
    transport.close();
    throw error;
  }
}

/**
 * Perform one non-retryable strong exchange. Once `mintSigner` is invoked,
 * every failure is terminal for that exchange and the consumed grant is never
 * recreated or automatically resent.
 */
export async function exchangeProviderRuntimeStrongMutationSameSocketInternalV1(
  input: ExchangeProviderRuntimeStrongMutationSameSocketInternalV1Input,
): Promise<StrongMutationSuccessPayloadInternalV1> {
  if (input === null || typeof input !== "object") {
    return failV1("invalid_input", "strong mutation exchange input is invalid");
  }
  const observeProviderOperationPlan = snapshotOperationPlanObserverV1(input);
  if (
    typeof input.socketPath !== "string" ||
    input.socketPath.length === 0 ||
    typeof input.mintSigner !== "function"
  ) {
    return failV1("invalid_input", "strong mutation exchange input is invalid");
  }
  const timeoutMs = positiveTimeoutV1(input.timeoutMs);
  const expected = parseExpectedPrincipalV1(input.expectedPrincipal);
  let requestClaims: ProviderRuntimeIpcStrongMutationRequestClaimsV1;
  try {
    requestClaims =
      ProviderRuntimeIpcStrongMutationRequestClaimsV1Schema.parse(
        input.request,
      );
  } catch {
    return failV1("invalid_input", "strong mutation request is invalid");
  }
  const staticFields = parseGrantStaticFieldsV1(
    input.grantStaticFields,
    expected,
    requestClaims,
  );
  const requestDigest = sha256DigestV1(
    canonicalizeProviderRuntimeIpcStrongMutationRequestV1(requestClaims),
  );
  if (observeProviderOperationPlan !== undefined) {
    const plan = Object.freeze({
      operation: requestClaims.operation,
      operationNonce: requestClaims.operationNonce,
      requestDigest,
    });
    try {
      await Reflect.apply(observeProviderOperationPlan, undefined, [plan]);
    } catch {
      return failV1(
        "operation_plan_rejected",
        "strong mutation operation plan was rejected",
      );
    }
  }

  let transport: ProviderRuntimeStrongMutationSocketTransportInternalV1;
  try {
    transport = await connectStrongMutationTransportV1(
      input.socketPath,
      timeoutMs,
    );
  } catch (error) {
    if (error instanceof ProviderRuntimeStrongMutationClientErrorInternalV1) {
      throw error;
    }
    return failV1(
      "transport_unavailable",
      "provider runtime connection failed",
      { cause: error },
    );
  }
  try {
    const challenge = randomBytes(32).toString("hex");
    const challengeRequest =
      ProviderRuntimeIpcPrincipalChallengeV1Schema.parse({
        protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
        kind: "principal_challenge",
        challenge,
        acceptanceIdentityProofRequested: true,
        sessionContinuationRequested: true,
      });
    let attestation: ProviderRuntimeIpcPrincipalAttestationV1;
    try {
      const frame = await transport.exchangeFrame(
        challengeRequest,
        "provider runtime closed before principal attestation",
      );
      attestation = ProviderRuntimeIpcPrincipalAttestationV1Schema.parse(
        JSON.parse(frame),
      );
    } catch (error) {
      if (error instanceof ProviderRuntimeStrongMutationClientErrorInternalV1) {
        throw error;
      }
      return failV1(
        "principal_invalid",
        "strong mutation principal attestation is invalid",
      );
    }
    verifyPrincipalAttestationV1(attestation, challenge, expected);

    const principalAttestationDigest = sha256DigestV1(
      canonicalizeProviderRuntimeIpcPrincipalAttestationTranscriptV1(
        attestation,
      ),
    );
    const grantFields =
      ProviderRuntimeIpcStrongMutationAuthorityGrantIdFieldsV1Schema.parse({
        ...staticFields,
        acceptanceIdentity: expected.acceptanceIdentity,
        principalAttestationDigest,
        journalHead: expected.journalHead,
        operation: requestClaims.operation,
        operationNonce: requestClaims.operationNonce,
        requestDigest,
      });

    let signer:
      | ProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1
      | undefined;
    try {
      signer = await Reflect.apply(input.mintSigner, undefined, [
        Object.freeze({
          ...grantFields,
          registryManifest: Object.freeze({
            ...grantFields.registryManifest,
          }),
          acceptanceIdentity: Object.freeze({
            ...grantFields.acceptanceIdentity,
          }),
          journalHead: Object.freeze({ ...grantFields.journalHead }),
        }),
      ]);
    } catch {
      return failV1("signer_unavailable", "strong mutation signer is unavailable");
    }
    const authorityGrant =
      consumeProviderRuntimeStrongMutationAuthorityGrantSignerCapabilityInternalV1(
        signer,
      );
    if (authorityGrant === undefined) {
      return failV1("signer_unavailable", "strong mutation signer is unavailable");
    }
    const expectedGrantId =
      deriveProviderRuntimeIpcStrongMutationAuthorityGrantIdV1(grantFields);
    const expectedUnsignedClaims =
      ProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsV1Schema.parse({
        profile:
          "provider_runtime_ipc_strong_mutation_authority_grant_v1",
        grantId: expectedGrantId,
        ...grantFields,
      });
    const actualUnsignedClaims =
      projectProviderRuntimeIpcStrongMutationAuthorityGrantUnsignedClaimsV1(
        authorityGrant.payload,
      );
    if (
      authorityGrant.grantId !== expectedGrantId ||
      !exactCanonicalEqualV1(actualUnsignedClaims, expectedUnsignedClaims)
    ) {
      return failV1(
        "signer_unavailable",
        "strong mutation signer returned a mismatched grant",
      );
    }

    const bindingDigest = sha256DigestV1(
      canonicalizeProviderRuntimeIpcStrongMutationSessionBindingV1({
        principalAttestationDigest,
        operation: requestClaims.operation,
        operationNonce: requestClaims.operationNonce,
        requestDigest,
        authorityGrant,
      }),
    );
    const request = ProviderRuntimeIpcStrongMutationRequestV1Schema.parse({
      protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
      kind: "strong_mutation_request",
      requestId: randomBytes(16).toString("hex"),
      principalAttestationDigest,
      bindingDigest,
      requestDigest,
      authorityGrant,
      ...requestClaims,
    });
    let response: ProviderRuntimeIpcStrongMutationResponseV1;
    try {
      const frame = await transport.exchangeFrame(
        request,
        "provider runtime closed before strong mutation response",
      );
      response = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
        JSON.parse(frame),
      );
      await transport.waitForFinalPeerClose();
    } catch (error) {
      if (error instanceof ProviderRuntimeStrongMutationClientErrorInternalV1) {
        throw error;
      }
      return failV1(
        "response_invalid",
        "strong mutation response is invalid",
      );
    }
    return verifyStrongResponseV1(response, request, expected);
  } catch (error) {
    if (error instanceof ProviderRuntimeStrongMutationClientErrorInternalV1) {
      throw error;
    }
    return failV1(
      "transport_unavailable",
      "strong mutation exchange failed",
      { cause: error },
    );
  } finally {
    transport.close();
  }
}
