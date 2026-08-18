import { createPublicKey, randomBytes, verify } from "node:crypto";
import { createConnection, type Socket } from "node:net";
import { TextDecoder } from "node:util";

import {
  PROVIDER_RUNTIME_IPC_MAX_FRAME_BYTES_V1,
  PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
  ProviderRuntimeIpcPrincipalAttestationV1Schema,
  ProviderRuntimeIpcPrincipalChallengeV1Schema,
  canonicalizeProviderRuntimeIpcPrincipalAttestationClaimsV1,
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

export const PROVIDER_RUNTIME_PRINCIPAL_KEY_LIVE_REQUIRED_NEXT_V1 =
  "kernel_os_peer_and_acceptance_token_gate" as const;

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

async function challengeOverIpcV1(input: {
  readonly socketPath: string;
  readonly challenge: string;
  readonly timeoutMs: number;
}): Promise<ProviderRuntimeIpcPrincipalAttestationV1> {
  const socket = await connectV1(input.socketPath, input.timeoutMs);
  try {
    const request = ProviderRuntimeIpcPrincipalChallengeV1Schema.parse({
      protocol: PROVIDER_RUNTIME_IPC_PROTOCOL_V1,
      kind: "principal_challenge",
      challenge: input.challenge,
    });
    socket.write(frameV1(request));
    const response = JSON.parse(await readSingleFrameV1(socket)) as unknown;
    return ProviderRuntimeIpcPrincipalAttestationV1Schema.parse(response);
  } finally {
    socket.destroy();
  }
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

/**
 * Prove that the private key named by the signed handoff is live on the
 * configured socket. This never reads the principal-owned HMAC key and does
 * not claim kernel peer identity or Acceptance authority.
 */
export async function verifyProviderRuntimeLivePrincipalChallengeV1(
  input: VerifyProviderRuntimeLivePrincipalChallengeOptionsV1,
): Promise<ProviderRuntimeLivePrincipalChallengeResultV1> {
  let config: ProviderServiceHandoffConfigV1;
  let expectedRevision: number;
  let expectedPhase: string;
  let expectedMutationDigest: ContentDigestV1 | "none";
  let timeoutMs: number;
  try {
    config = verifyProviderServiceHandoffConfigV1(
      input.config,
      input.expectedInstallationIdentityDigest,
    );
    expectedRevision = nonnegativeRevisionV1(input.expectedJournalRevision);
    expectedPhase = journalPhaseV1(input.expectedJournalPhase);
    expectedMutationDigest = journalMutationDigestV1(
      input.expectedJournalMutationDigest,
    );
    timeoutMs = positiveTimeoutV1(input.timeoutMs);
  } catch {
    return unavailableV1("invalid_config");
  }

  const challenge = randomBytes(32).toString("hex");
  let response: ProviderRuntimeIpcPrincipalAttestationV1;
  try {
    response = await challengeOverIpcV1({
      socketPath: config.payload.socketPath,
      challenge,
      timeoutMs,
    });
  } catch {
    return unavailableV1("ipc_unavailable");
  }

  if (response.publicKey !== config.publicKey || !verifySignatureV1(response)) {
    return unavailableV1("signature_invalid");
  }
  if (
    response.challenge !== challenge ||
    response.providerId !== config.payload.providerId ||
    response.capabilityDigest !== config.payload.capabilityDigest ||
    response.handoffPayloadDigest !== config.payloadDigest ||
    response.revision !== expectedRevision ||
    response.phase !== expectedPhase ||
    response.mutationDigest !== expectedMutationDigest
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
      providerId: DurableObjectIdentityProviderIdV1Schema.parse(response.providerId),
      capabilityDigest: ContentDigestV1Schema.parse(response.capabilityDigest),
      handoffPayloadDigest: ContentDigestV1Schema.parse(
        response.handoffPayloadDigest,
      ),
      servicePublicKey: CanonicalByteStringV1Schema.parse(response.publicKey),
      journalRevision: response.revision,
      journalPhase: response.phase,
      journalMutationDigest:
        response.mutationDigest === "none"
          ? "none"
          : ContentDigestV1Schema.parse(response.mutationDigest),
    }),
  });
}
