import { createPublicKey, randomBytes, verify } from "node:crypto";
import { createConnection, type Socket } from "node:net";
import { TextDecoder } from "node:util";

import {
  PROVIDER_RUNTIME_IPC_MAX_FRAME_BYTES_V1,
  PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
  ProviderRuntimeIpcAcceptanceIdentityProofV1Schema,
  ProviderRuntimeIpcPrincipalAttestationV1Schema,
  ProviderRuntimeIpcPrincipalChallengeV1Schema,
  canonicalizeProviderRuntimeIpcPrincipalAttestationClaimsV1,
  type ProviderRuntimeIpcAcceptanceIdentityProofV1,
  type ProviderRuntimeIpcPrincipalAttestationClaimsV1,
  type ProviderRuntimeIpcPrincipalAttestationV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import {
  CanonicalByteStringV1Schema,
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  type CanonicalByteStringV1,
  type ContentDigestV1,
  type DurableObjectIdentityProviderIdV1,
} from "@understand-code/durable-object-provider-contracts/primitives";

import {
  verifyProviderServiceHandoffConfigV1,
  type ProviderServiceHandoffConfigV1,
} from "./service-handoff.js";
import {
  PROVIDER_RUNTIME_KERNEL_PEER_REQUIRED_NEXT_V1,
  type ProviderRuntimeKernelPeerCandidateV1,
} from "./kernel-peer-credentials.js";
import { readProviderRuntimeNativeKernelPeerCredentialsV1 } from "./native-kernel-peer.js";

export const PROVIDER_RUNTIME_PRINCIPAL_KEY_LIVE_REQUIRED_NEXT_V1 =
  "kernel_os_peer_and_acceptance_token_gate" as const;
export const PROVIDER_RUNTIME_PRINCIPAL_KERNEL_PEER_LIVE_REQUIRED_NEXT_V1 =
  PROVIDER_RUNTIME_KERNEL_PEER_REQUIRED_NEXT_V1;
export const PROVIDER_RUNTIME_PRINCIPAL_KERNEL_ACCEPTANCE_IDENTITY_LIVE_REQUIRED_NEXT_V1 =
  "final_acceptance_authority_closeout" as const;

const DEFAULT_TIMEOUT_MS_V1 = 5_000;

export interface VerifyProviderRuntimeLivePrincipalChallengeOptionsV1 {
  /** Signed handoff whose public key must authenticate the live response. */
  readonly config: ProviderServiceHandoffConfigV1;
  /** Revision observed by the live Gate/Acceptance join that this probe closes over. */
  readonly expectedJournalRevision: number;
  readonly expectedJournalPhase: string;
  readonly expectedJournalMutationDigest: ContentDigestV1 | "none";
  readonly expectedInstallationIdentityDigest?: ContentDigestV1;
  readonly timeoutMs?: number;
}

export interface VerifyProviderRuntimeLivePrincipalKernelAcceptanceIdentityChallengeOptionsV1
  extends VerifyProviderRuntimeLivePrincipalChallengeOptionsV1 {
  /** Exact current Acceptance bindings already closed by the durable Gate. */
  readonly expectedAcceptanceIdentity:
    ProviderRuntimeIpcAcceptanceIdentityProofV1;
}

export interface ProviderRuntimePrincipalKeyLiveCandidateV1 {
  readonly status: "principal_key_live_candidate";
  readonly authority: "none";
  readonly accessMode: "read_only";
  readonly strongWriteStatus: "locked";
  readonly requiredNext: typeof PROVIDER_RUNTIME_PRINCIPAL_KEY_LIVE_REQUIRED_NEXT_V1;
  readonly bindings: Readonly<{
    readonly providerId: DurableObjectIdentityProviderIdV1;
    readonly capabilityDigest: ContentDigestV1;
    readonly handoffPayloadDigest: ContentDigestV1;
    readonly servicePublicKey: CanonicalByteStringV1;
    readonly processId: number;
    readonly journalRevision: number;
    readonly journalPhase: string;
    readonly journalMutationDigest: ContentDigestV1 | "none";
  }>;
}

export interface ProviderRuntimePrincipalKeyLiveUnavailableV1 {
  readonly status: "unavailable";
  readonly authority: "none";
  readonly accessMode: "read_only";
  readonly strongWriteStatus: "locked";
  readonly reason:
    | "invalid_config"
    | "ipc_unavailable"
    | "signature_invalid"
    | "binding_mismatch";
}

export type ProviderRuntimeLivePrincipalChallengeResultV1 =
  | ProviderRuntimePrincipalKeyLiveCandidateV1
  | ProviderRuntimePrincipalKeyLiveUnavailableV1;

export interface ProviderRuntimePrincipalKernelPeerLiveCandidateV1 {
  readonly status: "principal_key_and_kernel_os_peer_live_candidate";
  readonly authority: "none";
  readonly accessMode: "read_only";
  readonly strongWriteStatus: "locked";
  readonly requiredNext:
    typeof PROVIDER_RUNTIME_PRINCIPAL_KERNEL_PEER_LIVE_REQUIRED_NEXT_V1;
  readonly principalKey: ProviderRuntimePrincipalKeyLiveCandidateV1;
  readonly kernelPeer: ProviderRuntimeKernelPeerCandidateV1;
}

export interface ProviderRuntimePrincipalKernelPeerLiveUnavailableV1 {
  readonly status: "unavailable";
  readonly authority: "none";
  readonly accessMode: "read_only";
  readonly strongWriteStatus: "locked";
  readonly reason:
    | ProviderRuntimePrincipalKeyLiveUnavailableV1["reason"]
    | "kernel_peer_identity_mismatch"
    | "kernel_peer_unavailable";
}

export type ProviderRuntimeLivePrincipalKernelPeerChallengeResultV1 =
  | ProviderRuntimePrincipalKernelPeerLiveCandidateV1
  | ProviderRuntimePrincipalKernelPeerLiveUnavailableV1;

export interface ProviderRuntimePrincipalKernelAcceptanceIdentityLiveCandidateV1 {
  readonly status:
    "principal_key_kernel_os_peer_and_acceptance_identity_live_candidate";
  readonly authority: "none";
  readonly accessMode: "read_only";
  readonly strongWriteStatus: "locked";
  readonly requiredNext:
    typeof PROVIDER_RUNTIME_PRINCIPAL_KERNEL_ACCEPTANCE_IDENTITY_LIVE_REQUIRED_NEXT_V1;
  readonly principalKey: ProviderRuntimePrincipalKeyLiveCandidateV1;
  readonly kernelPeer: ProviderRuntimeKernelPeerCandidateV1;
  readonly acceptanceIdentity:
    ProviderRuntimeIpcAcceptanceIdentityProofV1;
}

export interface ProviderRuntimePrincipalKernelAcceptanceIdentityLiveUnavailableV1 {
  readonly status: "unavailable";
  readonly authority: "none";
  readonly accessMode: "read_only";
  readonly strongWriteStatus: "locked";
  readonly reason:
    | ProviderRuntimePrincipalKernelPeerLiveUnavailableV1["reason"]
    | "acceptance_identity_invalid";
}

export type ProviderRuntimeLivePrincipalKernelAcceptanceIdentityChallengeResultV1 =
  | ProviderRuntimePrincipalKernelAcceptanceIdentityLiveCandidateV1
  | ProviderRuntimePrincipalKernelAcceptanceIdentityLiveUnavailableV1;

function unavailableV1(
  reason: ProviderRuntimePrincipalKeyLiveUnavailableV1["reason"],
): ProviderRuntimePrincipalKeyLiveUnavailableV1 {
  return Object.freeze({
    status: "unavailable" as const,
    authority: "none" as const,
    accessMode: "read_only" as const,
    strongWriteStatus: "locked" as const,
    reason,
  });
}

function unavailableKernelPeerV1(
  reason: ProviderRuntimePrincipalKernelPeerLiveUnavailableV1["reason"],
): ProviderRuntimePrincipalKernelPeerLiveUnavailableV1 {
  return Object.freeze({
    status: "unavailable" as const,
    authority: "none" as const,
    accessMode: "read_only" as const,
    strongWriteStatus: "locked" as const,
    reason,
  });
}

function unavailableKernelAcceptanceIdentityV1(
  reason: ProviderRuntimePrincipalKernelAcceptanceIdentityLiveUnavailableV1["reason"],
): ProviderRuntimePrincipalKernelAcceptanceIdentityLiveUnavailableV1 {
  return Object.freeze({
    status: "unavailable" as const,
    authority: "none" as const,
    accessMode: "read_only" as const,
    strongWriteStatus: "locked" as const,
    reason,
  });
}

function positiveTimeoutV1(value: number | undefined): number {
  const timeout = value ?? DEFAULT_TIMEOUT_MS_V1;
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 60_000) {
    throw new TypeError("principal challenge timeout is invalid");
  }
  return timeout;
}

function nonnegativeRevisionV1(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("expected journal revision is invalid");
  }
  return value;
}

function journalPhaseV1(value: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 128) {
    throw new TypeError("expected journal phase is invalid");
  }
  return value;
}

function journalMutationDigestV1(
  value: ContentDigestV1 | "none",
): ContentDigestV1 | "none" {
  return value === "none" ? "none" : ContentDigestV1Schema.parse(value);
}

function frameV1(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

async function connectV1(path: string, timeoutMs: number): Promise<Socket> {
  return new Promise<Socket>((resolvePromise, rejectPromise) => {
    const socket = createConnection({ path });
    let settled = false;
    const timer = setTimeout(() => {
      socket.destroy();
      if (!settled) {
        settled = true;
        rejectPromise(new Error("principal challenge connection timed out"));
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

async function readSingleFrameV1(socket: Socket): Promise<string> {
  return new Promise<string>((resolvePromise, rejectPromise) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;

    const cleanup = (): void => {
      socket.off("data", onData);
      socket.off("end", onEnd);
      socket.off("close", onClose);
      socket.off("error", onError);
      socket.off("timeout", onTimeout);
    };
    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      rejectPromise(error);
    };
    const onError = (error: Error): void => fail(error);
    const onEnd = (): void => fail(new Error("principal challenge response closed"));
    const onClose = (): void => fail(new Error("principal challenge socket closed"));
    const onTimeout = (): void => fail(new Error("principal challenge response timed out"));
    const onData = (chunk: Buffer): void => {
      if (settled) return;
      const newline = chunk.indexOf(0x0a);
      const framed = newline === -1 ? chunk : chunk.subarray(0, newline);
      totalBytes += framed.byteLength;
      if (totalBytes > PROVIDER_RUNTIME_IPC_MAX_FRAME_BYTES_V1) {
        fail(new Error("principal challenge response is too large"));
        return;
      }
      chunks.push(framed);
      if (newline === -1) return;
      if (newline !== chunk.byteLength - 1) {
        fail(new Error("principal challenge returned multiple frames"));
        return;
      }
      settled = true;
      cleanup();
      try {
        resolvePromise(
          new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
        );
      } catch {
        rejectPromise(new Error("principal challenge response is not UTF-8"));
      }
    };

    socket.on("data", onData);
    socket.once("end", onEnd);
    socket.once("close", onClose);
    socket.once("error", onError);
    socket.once("timeout", onTimeout);
  });
}

async function challengeOverIpcV1<T, O>(
  input: {
    readonly socketPath: string;
    readonly challenge: string;
    readonly timeoutMs: number;
    readonly acceptanceIdentityProofRequested?: true;
  },
  observeConnectedSocket: (socket: Socket) => O,
  consume: (
    socket: Socket,
    response: ProviderRuntimeIpcPrincipalAttestationV1,
    observation: O,
  ) => Promise<T> | T,
): Promise<T> {
  const socket = await connectV1(input.socketPath, input.timeoutMs);
  try {
    const observation = observeConnectedSocket(socket);
    const request = ProviderRuntimeIpcPrincipalChallengeV1Schema.parse({
      protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
      kind: "principal_challenge",
      challenge: input.challenge,
      ...(input.acceptanceIdentityProofRequested === true
        ? { acceptanceIdentityProofRequested: true as const }
        : {}),
    });
    socket.write(frameV1(request));
    const response = JSON.parse(await readSingleFrameV1(socket)) as unknown;
    return await consume(
      socket,
      ProviderRuntimeIpcPrincipalAttestationV1Schema.parse(response),
      observation,
    );
  } finally {
    socket.destroy();
  }
}

interface ParsedPrincipalChallengeOptionsV1 {
  readonly config: ProviderServiceHandoffConfigV1;
  readonly expectedRevision: number;
  readonly expectedPhase: string;
  readonly expectedMutationDigest: ContentDigestV1 | "none";
  readonly timeoutMs: number;
}

function parsePrincipalChallengeOptionsV1(
  input: VerifyProviderRuntimeLivePrincipalChallengeOptionsV1,
): ParsedPrincipalChallengeOptionsV1 {
  return Object.freeze({
    config: verifyProviderServiceHandoffConfigV1(
      input.config,
      input.expectedInstallationIdentityDigest,
    ),
    expectedRevision: nonnegativeRevisionV1(input.expectedJournalRevision),
    expectedPhase: journalPhaseV1(input.expectedJournalPhase),
    expectedMutationDigest: journalMutationDigestV1(
      input.expectedJournalMutationDigest,
    ),
    timeoutMs: positiveTimeoutV1(input.timeoutMs),
  });
}

function decodeCanonicalV1(value: CanonicalByteStringV1): Buffer {
  const parsed = CanonicalByteStringV1Schema.parse(value);
  const body = parsed.slice("base64url:".length);
  const bytes = Buffer.from(body, "base64url");
  if (bytes.toString("base64url") !== body) {
    throw new TypeError("principal attestation byte string is not canonical");
  }
  return bytes;
}

function verifySignatureV1(
  response: ProviderRuntimeIpcPrincipalAttestationV1,
): boolean {
  try {
    const publicKey = createPublicKey({
      key: decodeCanonicalV1(response.publicKey),
      format: "der",
      type: "spki",
    });
    if (publicKey.asymmetricKeyType !== "ed25519") return false;
    const {
      protocol: _protocol,
      kind: _kind,
      signature,
      ...claims
    } = response;
    const signatureBytes = decodeCanonicalV1(signature);
    if (signatureBytes.byteLength !== 64) return false;
    return verify(
      null,
      canonicalizeProviderRuntimeIpcPrincipalAttestationClaimsV1(
        claims as ProviderRuntimeIpcPrincipalAttestationClaimsV1,
      ),
      publicKey,
      signatureBytes,
    );
  } catch {
    return false;
  }
}

function verifyPrincipalResponseV1(input: {
  readonly response: ProviderRuntimeIpcPrincipalAttestationV1;
  readonly challenge: string;
  readonly parsed: ParsedPrincipalChallengeOptionsV1;
}): ProviderRuntimeLivePrincipalChallengeResultV1 {
  const { response, challenge, parsed } = input;
  const { config } = parsed;
  if (response.publicKey !== config.publicKey || !verifySignatureV1(response)) {
    return unavailableV1("signature_invalid");
  }
  if (
    response.challenge !== challenge ||
    response.providerId !== config.payload.providerId ||
    response.capabilityDigest !== config.payload.capabilityDigest ||
    response.handoffPayloadDigest !== config.payloadDigest ||
    response.revision !== parsed.expectedRevision ||
    response.phase !== parsed.expectedPhase ||
    response.mutationDigest !== parsed.expectedMutationDigest
  ) {
    return unavailableV1("binding_mismatch");
  }

  return Object.freeze({
    status: "principal_key_live_candidate" as const,
    authority: "none" as const,
    accessMode: "read_only" as const,
    strongWriteStatus: "locked" as const,
    requiredNext: PROVIDER_RUNTIME_PRINCIPAL_KEY_LIVE_REQUIRED_NEXT_V1,
    bindings: Object.freeze({
      providerId: DurableObjectIdentityProviderIdV1Schema.parse(
        response.providerId,
      ),
      capabilityDigest: ContentDigestV1Schema.parse(
        response.capabilityDigest,
      ),
      handoffPayloadDigest: ContentDigestV1Schema.parse(
        response.handoffPayloadDigest,
      ),
      servicePublicKey: CanonicalByteStringV1Schema.parse(response.publicKey),
      processId: response.processId,
      journalRevision: response.revision,
      journalPhase: response.phase,
      journalMutationDigest:
        response.mutationDigest === "none"
          ? "none"
          : ContentDigestV1Schema.parse(response.mutationDigest),
    }),
  });
}

function verifyPrincipalKernelPeerResponseV1(input: {
  readonly response: ProviderRuntimeIpcPrincipalAttestationV1;
  readonly challenge: string;
  readonly parsed: ParsedPrincipalChallengeOptionsV1;
  readonly observed:
    | ReturnType<typeof readProviderRuntimeNativeKernelPeerCredentialsV1>
    | undefined;
}): ProviderRuntimeLivePrincipalKernelPeerChallengeResultV1 {
  const principalKey = verifyPrincipalResponseV1(input);
  if (principalKey.status !== "principal_key_live_candidate") {
    return unavailableKernelPeerV1(principalKey.reason);
  }

  const { observed, parsed } = input;
  if (observed === undefined) {
    return unavailableKernelPeerV1("kernel_peer_unavailable");
  }
  const platform = process.platform;
  if (
    (platform !== "darwin" && platform !== "linux") ||
    parsed.config.payload.platform !== platform ||
    observed.uid !== parsed.config.payload.principal.uid ||
    observed.gid !== parsed.config.payload.principal.gid ||
    observed.pid !== principalKey.bindings.processId
  ) {
    return unavailableKernelPeerV1("kernel_peer_identity_mismatch");
  }
  const kernelPeer: ProviderRuntimeKernelPeerCandidateV1 = Object.freeze({
    status: "kernel_os_peer_candidate" as const,
    authority: "none" as const,
    accessMode: "read_only" as const,
    strongWriteStatus: "locked" as const,
    requiredNext: PROVIDER_RUNTIME_KERNEL_PEER_REQUIRED_NEXT_V1,
    bindings: Object.freeze({
      platform,
      mechanism:
        platform === "linux"
          ? "linux_so_peercred"
          : "darwin_getpeereid_local_peercred_peerpid",
      uid: observed.uid,
      gid: observed.gid,
      pid: observed.pid,
    }),
  });
  return Object.freeze({
    status: "principal_key_and_kernel_os_peer_live_candidate" as const,
    authority: "none" as const,
    accessMode: "read_only" as const,
    strongWriteStatus: "locked" as const,
    requiredNext:
      PROVIDER_RUNTIME_PRINCIPAL_KERNEL_PEER_LIVE_REQUIRED_NEXT_V1,
    principalKey,
    kernelPeer,
  });
}

/**
 * Prove that the private key named by the signed handoff is live on the
 * configured socket. This never reads the principal-owned HMAC key and does
 * not claim kernel peer identity or Acceptance authority.
 */
export async function verifyProviderRuntimeLivePrincipalChallengeV1(
  input: VerifyProviderRuntimeLivePrincipalChallengeOptionsV1,
): Promise<ProviderRuntimeLivePrincipalChallengeResultV1> {
  let parsed: ParsedPrincipalChallengeOptionsV1;
  try {
    parsed = parsePrincipalChallengeOptionsV1(input);
  } catch {
    return unavailableV1("invalid_config");
  }

  const challenge = randomBytes(32).toString("hex");
  try {
    return await challengeOverIpcV1(
      {
        socketPath: parsed.config.payload.socketPath,
        challenge,
        timeoutMs: parsed.timeoutMs,
      },
      () => undefined,
      (_socket, response) =>
        verifyPrincipalResponseV1({ response, challenge, parsed }),
    );
  } catch {
    return unavailableV1("ipc_unavailable");
  }
}

/**
 * Prove the signed service key and kernel peer identity on one connected
 * Unix-domain socket. The socket stays live until the signed PID has been
 * matched to the kernel observation; the result still grants no authority.
 */
export async function verifyProviderRuntimeLivePrincipalKernelPeerChallengeV1(
  input: VerifyProviderRuntimeLivePrincipalChallengeOptionsV1,
): Promise<ProviderRuntimeLivePrincipalKernelPeerChallengeResultV1> {
  let parsed: ParsedPrincipalChallengeOptionsV1;
  try {
    parsed = parsePrincipalChallengeOptionsV1(input);
  } catch {
    return unavailableKernelPeerV1("invalid_config");
  }

  const challenge = randomBytes(32).toString("hex");
  try {
    return await challengeOverIpcV1(
      {
        socketPath: parsed.config.payload.socketPath,
        challenge,
        timeoutMs: parsed.timeoutMs,
      },
      (socket) => {
        try {
          return readProviderRuntimeNativeKernelPeerCredentialsV1(socket);
        } catch {
          return undefined;
        }
      },
      (_socket, response, observed) =>
        verifyPrincipalKernelPeerResponseV1({
          response,
          challenge,
          parsed,
          observed,
        }),
    );
  } catch {
    return unavailableKernelPeerV1("ipc_unavailable");
  }
}

/**
 * Prove the signed service principal, the kernel OS peer, and the exact
 * Installation-Identity-verified Acceptance on one connected socket. The
 * signed proof grants no authority and leaves strong writes locked.
 */
export async function verifyProviderRuntimeLivePrincipalKernelAcceptanceIdentityChallengeV1(
  input: VerifyProviderRuntimeLivePrincipalKernelAcceptanceIdentityChallengeOptionsV1,
): Promise<ProviderRuntimeLivePrincipalKernelAcceptanceIdentityChallengeResultV1> {
  let parsed: ParsedPrincipalChallengeOptionsV1;
  let expectedAcceptanceIdentity:
    ProviderRuntimeIpcAcceptanceIdentityProofV1;
  try {
    parsed = parsePrincipalChallengeOptionsV1(input);
    expectedAcceptanceIdentity =
      ProviderRuntimeIpcAcceptanceIdentityProofV1Schema.parse(
        input.expectedAcceptanceIdentity,
      );
  } catch {
    return unavailableKernelAcceptanceIdentityV1("invalid_config");
  }

  const challenge = randomBytes(32).toString("hex");
  try {
    return await challengeOverIpcV1(
      {
        socketPath: parsed.config.payload.socketPath,
        challenge,
        timeoutMs: parsed.timeoutMs,
        acceptanceIdentityProofRequested: true,
      },
      (socket) => {
        try {
          return readProviderRuntimeNativeKernelPeerCredentialsV1(socket);
        } catch {
          return undefined;
        }
      },
      (_socket, response, observed) => {
        const principalAndKernel = verifyPrincipalKernelPeerResponseV1({
          response,
          challenge,
          parsed,
          observed,
        });
        if (
          principalAndKernel.status !==
          "principal_key_and_kernel_os_peer_live_candidate"
        ) {
          return unavailableKernelAcceptanceIdentityV1(
            principalAndKernel.reason,
          );
        }
        const actual = response.acceptanceIdentity;
        if (
          actual === undefined ||
          actual.generationId !== expectedAcceptanceIdentity.generationId ||
          actual.contentDigest !== expectedAcceptanceIdentity.contentDigest ||
          actual.acceptanceOrdinal !==
            expectedAcceptanceIdentity.acceptanceOrdinal ||
          actual.installationIdentityGenerationId !==
            expectedAcceptanceIdentity.installationIdentityGenerationId
        ) {
          return unavailableKernelAcceptanceIdentityV1(
            "acceptance_identity_invalid",
          );
        }
        return Object.freeze({
          status:
            "principal_key_kernel_os_peer_and_acceptance_identity_live_candidate" as const,
          authority: "none" as const,
          accessMode: "read_only" as const,
          strongWriteStatus: "locked" as const,
          requiredNext:
            PROVIDER_RUNTIME_PRINCIPAL_KERNEL_ACCEPTANCE_IDENTITY_LIVE_REQUIRED_NEXT_V1,
          principalKey: principalAndKernel.principalKey,
          kernelPeer: principalAndKernel.kernelPeer,
          acceptanceIdentity: Object.freeze({ ...actual }),
        });
      },
    );
  } catch {
    return unavailableKernelAcceptanceIdentityV1("ipc_unavailable");
  }
}
