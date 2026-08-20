import {
  PROVIDER_RUNTIME_IPC_MAX_FRAME_BYTES_V1,
  ProviderRuntimeIpcAcceptanceIdentityProofV1Schema,
  ProviderRuntimeIpcPrincipalAttestationV1Schema,
  ProviderRuntimeIpcStrongMutationRequestV1Schema,
  ProviderRuntimeIpcStrongMutationResponseV1Schema,
  canonicalizeProviderRuntimeIpcStrongMutationRequestV1,
  canonicalizeProviderRuntimeIpcStrongMutationSessionBindingV1,
  type ProviderRuntimeIpcAcceptanceIdentityProofV1,
  type ProviderRuntimeIpcPrincipalAttestationV1,
  type ProviderRuntimeIpcStrongMutationRequestV1,
  type ProviderRuntimeIpcStrongMutationResponseV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import {
  InstallationIdentityGenerationIdV1Schema,
  type InstallationIdentityGenerationIdV1,
} from "@understand-code/durable-object-provider-contracts/primitives";
import type { ProviderAcceptanceCurrentReadV1 } from "@understand-code/durable-object-provider-contracts/provider-acceptance";

import {
  type ProviderAcceptanceAuthorityLockedCurrentViewCoreInternalV1,
  type ProviderAcceptanceAuthorityStoreOpenOptionsInternalV1,
  withProviderAcceptanceAuthorityLockedCurrentViewCoreInternalV1,
} from "./acceptance-store-core-internal.js";
import {
  digestDomainInternalV1,
  hmacTokenForDomainInternalV1,
  sha256DigestInternalV1,
  verifyHmacTokenForDomainInternalV1,
  type Sha256ContentDigestInternalV1,
} from "./crypto-internal.js";
import { ProviderAcceptanceAuthorityErrorV1 } from "./errors.js";
import {
  canonicalAuthorityBytesInternalV1,
  discardDeterministicAuthorityStageInternalV1,
  isMissingFileInternalV1,
  normalizeDurableAuthorityStagePreparationInternalV1,
  parseCanonicalAuthorityBytesInternalV1,
  prepareDurableAuthorityStageInternalV1,
  publishPreparedAuthorityStageInternalV1,
  readCheckedAuthorityFileInternalV1,
  replaceDurableAuthoritySnapshotInternalV1,
} from "./filesystem-internal.js";
import type { ProviderAcceptanceAuthorityLayoutInternalV1 } from "./platform-layout.js";
import {
  PROVIDER_STRONG_MUTATION_TRUST_VERIFICATION_MARKERS_INTERNAL_V1,
  assertProviderStrongMutationTrustVerifierCapabilityInternalV1,
  createProviderStrongMutationTrustVerificationSessionInternalV1,
  parseProviderStrongMutationVerificationCertificateInternalV1,
  verifyProviderStrongMutationBeginTrustInternalV1,
  verifyProviderStrongMutationResponseTrustInternalV1,
  type ProviderStrongMutationTrustVerifierCapabilityInternalV1,
  type ProviderStrongMutationTrustVerificationSessionInternalV1,
  type ProviderStrongMutationVerificationCertificateInternalV1,
} from "./strong-mutation-trust-verifier-core-internal.js";

const GENESIS_CHAIN_V1 = "genesis" as const;
const BROKER_SNAPSHOT_PROFILE_V1 =
  "understand_code_provider_strong_mutation_broker_snapshot_v1" as const;
const BROKER_SNAPSHOT_DIGEST_DOMAIN_V1 =
  "understand-code-provider-strong-mutation-broker-snapshot-v1";
const BROKER_SNAPSHOT_TOKEN_DOMAIN_V1 =
  "understand-code-provider-strong-mutation-broker-snapshot-token-v1";
const BROKER_PUBLICATION_PIN_PROFILE_V1 =
  "understand_code_provider_strong_mutation_broker_publication_pin_v1" as const;
const BROKER_PUBLICATION_PIN_DIGEST_DOMAIN_V1 =
  "understand-code-provider-strong-mutation-broker-publication-pin-v1";
const BROKER_PUBLICATION_PIN_TOKEN_DOMAIN_V1 =
  "understand-code-provider-strong-mutation-broker-publication-pin-token-v1";
const BROKER_INTENT_PROFILE_V1 =
  "provider_strong_mutation_broker_intent_v1" as const;
const BROKER_RESOLVE_REQUEST_PROFILE_V1 =
  "provider_strong_mutation_broker_resolve_request_v1" as const;
const MAX_BROKER_PUBLICATION_PIN_BYTES_V1 = 16 * 1024;

export const PROVIDER_STRONG_MUTATION_BROKER_DOMAINS_INTERNAL_V1 = Object.freeze({
  requestContentDigest: "plain_sha256_of_canonical_strict_request" as const,
  responseContentDigest: "plain_sha256_of_canonical_strict_response" as const,
  snapshotDigest: BROKER_SNAPSHOT_DIGEST_DOMAIN_V1,
  snapshotToken: BROKER_SNAPSHOT_TOKEN_DOMAIN_V1,
  publicationPinDigest: BROKER_PUBLICATION_PIN_DIGEST_DOMAIN_V1,
  publicationPinToken: BROKER_PUBLICATION_PIN_TOKEN_DOMAIN_V1,
});

export const PROVIDER_STRONG_MUTATION_BROKER_LIMITS_INTERNAL_V1 = Object.freeze({
  maxIntentCount: 4096,
  maxRequestLogicalBytes: PROVIDER_RUNTIME_IPC_MAX_FRAME_BYTES_V1,
  maxResponseLogicalBytes: PROVIDER_RUNTIME_IPC_MAX_FRAME_BYTES_V1,
  maxSnapshotPhysicalBytes: 256 * 1024 * 1024,
});

interface ProviderStrongMutationBrokerIntentCommonInternalV1 {
  readonly profile: typeof BROKER_INTENT_PROFILE_V1;
  readonly grantId: string;
  readonly requestContentDigest: Sha256ContentDigestInternalV1;
  readonly requestDigest: string;
  readonly bindingDigest: string;
  readonly acceptanceIdentity: ProviderRuntimeIpcAcceptanceIdentityProofV1;
  readonly request: ProviderRuntimeIpcStrongMutationRequestV1;
  readonly verificationCertificate:
    ProviderStrongMutationVerificationCertificateInternalV1;
  readonly principalAttestation: ProviderRuntimeIpcPrincipalAttestationV1;
  readonly grantVerification:
    typeof PROVIDER_STRONG_MUTATION_TRUST_VERIFICATION_MARKERS_INTERNAL_V1.grant;
  readonly executionFence: "not_established";
  readonly strongWrites: "locked";
  readonly recordedAt: string;
}

export interface ProviderStrongMutationBrokerPendingIntentInternalV1
  extends ProviderStrongMutationBrokerIntentCommonInternalV1 {
  readonly state: "pending";
}

export interface ProviderStrongMutationBrokerResolvedIntentInternalV1
  extends ProviderStrongMutationBrokerIntentCommonInternalV1 {
  readonly state: "resolved";
  readonly responseContentDigest: Sha256ContentDigestInternalV1;
  readonly response: ProviderRuntimeIpcStrongMutationResponseV1;
  readonly responseVerification:
    typeof PROVIDER_STRONG_MUTATION_TRUST_VERIFICATION_MARKERS_INTERNAL_V1.response;
  readonly resolvedAt: string;
}

export type ProviderStrongMutationBrokerIntentInternalV1 =
  | ProviderStrongMutationBrokerPendingIntentInternalV1
  | ProviderStrongMutationBrokerResolvedIntentInternalV1;

interface ProviderStrongMutationBrokerAccountingInternalV1 {
  readonly intentCount: number;
  readonly pendingCount: number;
  readonly resolvedCount: number;
  readonly intentLogicalBytes: number;
}

interface ProviderStrongMutationBrokerSnapshotPayloadInternalV1 {
  readonly schemaVersion: 1;
  readonly profile: typeof BROKER_SNAPSHOT_PROFILE_V1;
  readonly installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1;
  readonly snapshotRevision: number;
  readonly previousSnapshotContentDigest: typeof GENESIS_CHAIN_V1 | string;
  readonly intents: readonly ProviderStrongMutationBrokerIntentInternalV1[];
  readonly accounting: ProviderStrongMutationBrokerAccountingInternalV1;
}

interface ProviderStrongMutationBrokerSnapshotEnvelopeInternalV1 {
  readonly payload: ProviderStrongMutationBrokerSnapshotPayloadInternalV1;
  readonly snapshotContentDigest: Sha256ContentDigestInternalV1;
  readonly snapshotToken: string;
}

interface LoadedProviderStrongMutationBrokerSnapshotInternalV1 {
  readonly envelope: ProviderStrongMutationBrokerSnapshotEnvelopeInternalV1;
  readonly canonicalBytes: Buffer;
}

interface ProviderStrongMutationBrokerPublicationPinPayloadInternalV1 {
  readonly schemaVersion: 1;
  readonly profile: typeof BROKER_PUBLICATION_PIN_PROFILE_V1;
  readonly publicationRevision: number;
  readonly snapshotRevision: number;
  readonly snapshotContentDigest: Sha256ContentDigestInternalV1;
  readonly snapshotTokenDigest: Sha256ContentDigestInternalV1;
  readonly previousPublicationContentDigest: typeof GENESIS_CHAIN_V1 | string;
}

interface ProviderStrongMutationBrokerPublicationPinEnvelopeInternalV1 {
  readonly payload: ProviderStrongMutationBrokerPublicationPinPayloadInternalV1;
  readonly publicationContentDigest: Sha256ContentDigestInternalV1;
  readonly publicationToken: string;
}

export interface ProviderStrongMutationBrokerAdmissionInputInternalV1 {
  readonly intentCount: number;
  readonly requestLogicalBytes: number;
  readonly responseLogicalBytes: number;
  readonly snapshotPhysicalBytes: number;
  readonly isExistingReplay: boolean;
}

export type ProviderStrongMutationBrokerAdmissionResultInternalV1 =
  | Readonly<{ readonly admitted: true }>
  | Readonly<{
      readonly admitted: false;
      readonly reason:
        | "intent_count"
        | "request_bytes"
        | "response_bytes"
        | "snapshot_bytes";
    }>;

export type ProviderStrongMutationBrokerBeginResultInternalV1 =
  | Readonly<{
      readonly resolution: "recorded";
      readonly disposition: "created" | "replayed";
      readonly intent: ProviderStrongMutationBrokerIntentInternalV1;
    }>
  | Readonly<{
      readonly resolution: "request_rejected";
      readonly reason: "grant_request_mismatch";
      readonly existingIntent: ProviderStrongMutationBrokerIntentInternalV1;
    }>;

export interface ProviderStrongMutationBrokerResolveRequestInternalV1 {
  readonly profile: typeof BROKER_RESOLVE_REQUEST_PROFILE_V1;
  readonly grantId: string;
  readonly requestContentDigest: string;
  readonly requestDigest: string;
  readonly bindingDigest: string;
  readonly response: ProviderRuntimeIpcStrongMutationResponseV1;
}

export type ProviderStrongMutationBrokerResolveResultInternalV1 =
  | Readonly<{
      readonly resolution: "resolved";
      readonly disposition: "created" | "replayed";
      readonly intent: ProviderStrongMutationBrokerResolvedIntentInternalV1;
    }>
  | Readonly<{
      readonly resolution: "request_rejected";
      readonly reason: "response_mismatch";
      readonly existingIntent: ProviderStrongMutationBrokerResolvedIntentInternalV1;
    }>;

export interface ProviderStrongMutationBrokerStoreInternalV1 {
  readonly authority: "installation_owner_candidate";
  readonly strongWrites: "locked";
  readonly grantVerification:
    typeof PROVIDER_STRONG_MUTATION_TRUST_VERIFICATION_MARKERS_INTERNAL_V1.grant;
  readonly executionFence: "not_established";
  readonly begin: (
    request: unknown,
  ) => Promise<ProviderStrongMutationBrokerBeginResultInternalV1>;
  readonly resolve: (
    request: unknown,
  ) => Promise<ProviderStrongMutationBrokerResolveResultInternalV1>;
}

export interface ProviderStrongMutationBrokerSnapshotInspectionInternalV1 {
  readonly snapshotRevision: number;
  readonly intentCount: number;
  readonly pendingCount: number;
  readonly resolvedCount: number;
  readonly intentLogicalBytes: number;
}

function exactRecordV1(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function isDigestV1(value: unknown): value is Sha256ContentDigestInternalV1 {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);
}

function isCanonicalTimestampV1(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function nonNegativeSafeIntegerV1(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function classifyProviderStrongMutationBrokerAdmissionInternalV1(
  input: ProviderStrongMutationBrokerAdmissionInputInternalV1,
): ProviderStrongMutationBrokerAdmissionResultInternalV1 {
  if (input.isExistingReplay) return Object.freeze({ admitted: true as const });
  if (
    !nonNegativeSafeIntegerV1(input.intentCount) ||
    !nonNegativeSafeIntegerV1(input.requestLogicalBytes) ||
    !nonNegativeSafeIntegerV1(input.responseLogicalBytes) ||
    !nonNegativeSafeIntegerV1(input.snapshotPhysicalBytes)
  ) {
    return Object.freeze({ admitted: false as const, reason: "snapshot_bytes" as const });
  }
  const limits = PROVIDER_STRONG_MUTATION_BROKER_LIMITS_INTERNAL_V1;
  if (input.intentCount > limits.maxIntentCount) {
    return Object.freeze({ admitted: false as const, reason: "intent_count" as const });
  }
  if (input.requestLogicalBytes > limits.maxRequestLogicalBytes) {
    return Object.freeze({ admitted: false as const, reason: "request_bytes" as const });
  }
  if (input.responseLogicalBytes > limits.maxResponseLogicalBytes) {
    return Object.freeze({ admitted: false as const, reason: "response_bytes" as const });
  }
  if (input.snapshotPhysicalBytes > limits.maxSnapshotPhysicalBytes) {
    return Object.freeze({ admitted: false as const, reason: "snapshot_bytes" as const });
  }
  return Object.freeze({ admitted: true as const });
}

function requestContentDigestV1(
  request: ProviderRuntimeIpcStrongMutationRequestV1,
): Sha256ContentDigestInternalV1 {
  return sha256DigestInternalV1(canonicalAuthorityBytesInternalV1(request));
}

function requestDigestV1(
  request: ProviderRuntimeIpcStrongMutationRequestV1,
): Sha256ContentDigestInternalV1 {
  const claims = request.operation === "write_object"
    ? {
        operation: request.operation,
        operationNonce: request.operationNonce,
        payload: request.payload,
      }
    : {
        operation: request.operation,
        operationNonce: request.operationNonce,
        payload: request.payload,
      };
  return sha256DigestInternalV1(
    canonicalizeProviderRuntimeIpcStrongMutationRequestV1(claims),
  );
}

function bindingDigestV1(
  request: ProviderRuntimeIpcStrongMutationRequestV1,
): Sha256ContentDigestInternalV1 {
  return sha256DigestInternalV1(
    canonicalizeProviderRuntimeIpcStrongMutationSessionBindingV1({
      principalAttestationDigest: request.principalAttestationDigest,
      operation: request.operation,
      operationNonce: request.operationNonce,
      requestDigest: request.requestDigest,
      authorityGrant: request.authorityGrant,
    }),
  );
}

function responseContentDigestV1(
  response: ProviderRuntimeIpcStrongMutationResponseV1,
): Sha256ContentDigestInternalV1 {
  return sha256DigestInternalV1(canonicalAuthorityBytesInternalV1(response));
}

function sameCanonicalV1(left: unknown, right: unknown): boolean {
  return canonicalAuthorityBytesInternalV1(left).equals(
    canonicalAuthorityBytesInternalV1(right),
  );
}

function parseStrongMutationRequestV1(
  input: unknown,
): ProviderRuntimeIpcStrongMutationRequestV1 {
  try {
    const request = ProviderRuntimeIpcStrongMutationRequestV1Schema.parse(input);
    const grant = request.authorityGrant.payload;
    if (
      request.requestDigest !== requestDigestV1(request) ||
      request.bindingDigest !== bindingDigestV1(request) ||
      grant.principalAttestationDigest !== request.principalAttestationDigest ||
      grant.operation !== request.operation ||
      grant.operationNonce !== request.operationNonce ||
      grant.requestDigest !== request.requestDigest
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1("invalid_request");
    }
    return request;
  } catch (error) {
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1("invalid_request");
  }
}

function currentAcceptanceIdentityV1(
  current: ProviderAcceptanceCurrentReadV1 | null,
): ProviderRuntimeIpcAcceptanceIdentityProofV1 | undefined {
  if (current === null) return undefined;
  const pin = current.highWater.payload.currentAcceptance;
  return ProviderRuntimeIpcAcceptanceIdentityProofV1Schema.parse({
    generationId: pin.generationId,
    contentDigest: pin.contentDigest,
    acceptanceOrdinal: pin.acceptanceOrdinal,
    installationIdentityGenerationId:
      current.highWater.payload.installationIdentityGenerationId,
  });
}

function acceptanceIdentityMatchesV1(
  left: ProviderRuntimeIpcAcceptanceIdentityProofV1,
  right: ProviderRuntimeIpcAcceptanceIdentityProofV1,
): boolean {
  return left.generationId === right.generationId &&
    left.contentDigest === right.contentDigest &&
    left.acceptanceOrdinal === right.acceptanceOrdinal &&
    left.installationIdentityGenerationId ===
      right.installationIdentityGenerationId;
}

function requireFreshCurrentAcceptanceJoinV1(
  request: ProviderRuntimeIpcStrongMutationRequestV1,
  current: ProviderAcceptanceCurrentReadV1 | null,
): ProviderRuntimeIpcAcceptanceIdentityProofV1 {
  const fresh = currentAcceptanceIdentityV1(current);
  if (
    fresh === undefined ||
    !acceptanceIdentityMatchesV1(
      request.authorityGrant.payload.acceptanceIdentity,
      fresh,
    )
  ) {
    throw new ProviderAcceptanceAuthorityErrorV1("invalid_request");
  }
  return fresh;
}

function calculateAccountingV1(
  intents: readonly ProviderStrongMutationBrokerIntentInternalV1[],
): ProviderStrongMutationBrokerAccountingInternalV1 {
  let pendingCount = 0;
  let resolvedCount = 0;
  let intentLogicalBytes = 0;
  for (const intent of intents) {
    if (intent.state === "pending") pendingCount += 1;
    else resolvedCount += 1;
    intentLogicalBytes += canonicalAuthorityBytesInternalV1(intent).byteLength;
    if (!Number.isSafeInteger(intentLogicalBytes)) {
      throw new ProviderAcceptanceAuthorityErrorV1("capacity_exhausted");
    }
  }
  return Object.freeze({
    intentCount: intents.length,
    pendingCount,
    resolvedCount,
    intentLogicalBytes,
  });
}

function parseAccountingV1(
  value: unknown,
): ProviderStrongMutationBrokerAccountingInternalV1 {
  if (
    !exactRecordV1(value, [
      "intentCount",
      "pendingCount",
      "resolvedCount",
      "intentLogicalBytes",
    ]) ||
    typeof value.intentCount !== "number" ||
    typeof value.pendingCount !== "number" ||
    typeof value.resolvedCount !== "number" ||
    typeof value.intentLogicalBytes !== "number" ||
    !nonNegativeSafeIntegerV1(value.intentCount) ||
    !nonNegativeSafeIntegerV1(value.pendingCount) ||
    !nonNegativeSafeIntegerV1(value.resolvedCount) ||
    !nonNegativeSafeIntegerV1(value.intentLogicalBytes)
  ) {
    throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
  }
  return Object.freeze({
    intentCount: value.intentCount,
    pendingCount: value.pendingCount,
    resolvedCount: value.resolvedCount,
    intentLogicalBytes: value.intentLogicalBytes,
  });
}

function verifyIntentRequestBindingsV1(
  intent: ProviderStrongMutationBrokerIntentInternalV1,
): void {
  const request = intent.request;
  const grant = request.authorityGrant.payload;
  if (
    intent.grantId !== request.authorityGrant.grantId ||
    intent.grantId !== grant.grantId ||
    intent.requestContentDigest !== requestContentDigestV1(request) ||
    intent.requestDigest !== request.requestDigest ||
    intent.requestDigest !== requestDigestV1(request) ||
    intent.bindingDigest !== request.bindingDigest ||
    intent.bindingDigest !== bindingDigestV1(request) ||
    !acceptanceIdentityMatchesV1(intent.acceptanceIdentity, grant.acceptanceIdentity) ||
    !acceptanceIdentityMatchesV1(
      intent.verificationCertificate.acceptanceIdentity,
      intent.acceptanceIdentity,
    ) ||
    intent.verificationCertificate.grantContentDigest !==
      request.authorityGrant.contentDigest ||
    intent.verificationCertificate.principalAttestationDigest !==
      request.principalAttestationDigest ||
    grant.principalAttestationDigest !== request.principalAttestationDigest ||
    grant.operation !== request.operation ||
    grant.operationNonce !== request.operationNonce ||
    grant.requestDigest !== request.requestDigest
  ) {
    throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
  }
}

function responseMatchesIntentV1(
  response: ProviderRuntimeIpcStrongMutationResponseV1,
  intent: ProviderStrongMutationBrokerIntentInternalV1,
): boolean {
  const request = intent.request;
  const commonMatches = response.requestId === request.requestId &&
    response.principalAttestationDigest === request.principalAttestationDigest &&
    response.bindingDigest === intent.bindingDigest &&
    response.operation === request.operation &&
    response.operationNonce === request.operationNonce &&
    response.requestDigest === intent.requestDigest;
  if (!commonMatches || !response.ok) return commonMatches;

  if (request.operation === "write_object") {
    if (response.payload.operation !== "write_object") return false;
    return sameCanonicalV1(
      response.payload.locator,
      request.payload.locator,
    ) &&
      response.payload.logicalBytes === request.payload.logicalBytes &&
      response.payload.verifiedContentDigest ===
        request.payload.locator.contentDigest;
  }

  if (
    response.payload.operation !== "compare_commit" ||
    response.payload.resolution !== "committed"
  ) {
    // A replay or stale result reports the provider's current journal head,
    // which need not equal this request's proposed successor.
    return true;
  }
  const state = response.payload.state;
  return request.payload.expectedRevision < Number.MAX_SAFE_INTEGER &&
    state.revision === request.payload.expectedRevision + 1 &&
    state.phase === request.payload.phase &&
    state.operationNonce === request.payload.operationNonce &&
    state.mutationDigest !== "none" &&
    sameCanonicalV1(state.artifacts, request.payload.artifacts);
}

function parseIntentV1(
  value: unknown,
): ProviderStrongMutationBrokerIntentInternalV1 {
  try {
    if (typeof value !== "object" || value === null || !("state" in value)) {
      throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
    }
    const raw = value as Record<string, unknown>;
    const state = raw.state;
    const commonKeys = [
      "profile",
      "grantId",
      "requestContentDigest",
      "requestDigest",
      "bindingDigest",
      "acceptanceIdentity",
      "request",
      "verificationCertificate",
      "principalAttestation",
      "grantVerification",
      "executionFence",
      "strongWrites",
      "recordedAt",
      "state",
    ] as const;
    const keys = state === "pending"
      ? commonKeys
      : [
          ...commonKeys,
          "responseContentDigest",
          "response",
          "responseVerification",
          "resolvedAt",
        ];
    if (
      (state !== "pending" && state !== "resolved") ||
      !exactRecordV1(raw, keys) ||
      raw.profile !== BROKER_INTENT_PROFILE_V1 ||
      !isDigestV1(raw.grantId) ||
      !isDigestV1(raw.requestContentDigest) ||
      !isDigestV1(raw.requestDigest) ||
      !isDigestV1(raw.bindingDigest) ||
      raw.grantVerification !==
        PROVIDER_STRONG_MUTATION_TRUST_VERIFICATION_MARKERS_INTERNAL_V1.grant ||
      raw.executionFence !== "not_established" ||
      raw.strongWrites !== "locked" ||
      !isCanonicalTimestampV1(raw.recordedAt)
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
    }
    const request = ProviderRuntimeIpcStrongMutationRequestV1Schema.parse(
      raw.request,
    );
    const acceptanceIdentity =
      ProviderRuntimeIpcAcceptanceIdentityProofV1Schema.parse(
        raw.acceptanceIdentity,
      );
    const verificationCertificate =
      parseProviderStrongMutationVerificationCertificateInternalV1(
        raw.verificationCertificate,
      );
    const principalAttestation =
      ProviderRuntimeIpcPrincipalAttestationV1Schema.parse(
        raw.principalAttestation,
      );
    const common = {
      profile: BROKER_INTENT_PROFILE_V1,
      grantId: raw.grantId,
      requestContentDigest: raw.requestContentDigest,
      requestDigest: raw.requestDigest,
      bindingDigest: raw.bindingDigest,
      acceptanceIdentity,
      request,
      verificationCertificate,
      principalAttestation,
      grantVerification:
        PROVIDER_STRONG_MUTATION_TRUST_VERIFICATION_MARKERS_INTERNAL_V1.grant,
      executionFence: "not_established" as const,
      strongWrites: "locked" as const,
      recordedAt: raw.recordedAt,
    };
    let intent: ProviderStrongMutationBrokerIntentInternalV1;
    if (state === "pending") {
      intent = Object.freeze({ ...common, state: "pending" as const });
    } else {
      if (
        !isDigestV1(raw.responseContentDigest) ||
        raw.responseVerification !==
          PROVIDER_STRONG_MUTATION_TRUST_VERIFICATION_MARKERS_INTERNAL_V1.response ||
        !isCanonicalTimestampV1(raw.resolvedAt)
      ) {
        throw new ProviderAcceptanceAuthorityErrorV1(
          "namespace_integrity_failed",
        );
      }
      const response = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
        raw.response,
      );
      intent = Object.freeze({
        ...common,
        state: "resolved" as const,
        responseContentDigest: raw.responseContentDigest,
        response,
        responseVerification:
          PROVIDER_STRONG_MUTATION_TRUST_VERIFICATION_MARKERS_INTERNAL_V1.response,
        resolvedAt: raw.resolvedAt,
      });
      if (
        intent.responseContentDigest !== responseContentDigestV1(response) ||
        !responseMatchesIntentV1(response, intent)
      ) {
        throw new ProviderAcceptanceAuthorityErrorV1(
          "namespace_integrity_failed",
        );
      }
    }
    verifyIntentRequestBindingsV1(intent);
    return intent;
  } catch (error) {
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1(
      "namespace_integrity_failed",
    );
  }
}

function snapshotPayloadV1(input: Readonly<{
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  previous: LoadedProviderStrongMutationBrokerSnapshotInternalV1 | undefined;
  intents: readonly ProviderStrongMutationBrokerIntentInternalV1[];
}>): ProviderStrongMutationBrokerSnapshotPayloadInternalV1 {
  return Object.freeze({
    schemaVersion: 1 as const,
    profile: BROKER_SNAPSHOT_PROFILE_V1,
    installationIdentityGenerationId:
      input.installationIdentityGenerationId,
    snapshotRevision:
      (input.previous?.envelope.payload.snapshotRevision ?? 0) + 1,
    previousSnapshotContentDigest:
      input.previous?.envelope.snapshotContentDigest ?? GENESIS_CHAIN_V1,
    intents: Object.freeze([...input.intents]),
    accounting: calculateAccountingV1(input.intents),
  });
}

function signSnapshotV1(
  key: Uint8Array,
  payload: ProviderStrongMutationBrokerSnapshotPayloadInternalV1,
): ProviderStrongMutationBrokerSnapshotEnvelopeInternalV1 {
  const snapshotContentDigest = digestDomainInternalV1(
    BROKER_SNAPSHOT_DIGEST_DOMAIN_V1,
    payload,
  );
  return Object.freeze({
    payload,
    snapshotContentDigest,
    snapshotToken: hmacTokenForDomainInternalV1(
      key,
      BROKER_SNAPSHOT_TOKEN_DOMAIN_V1,
      { payload, snapshotContentDigest },
    ),
  });
}

function parseSnapshotV1(
  value: unknown,
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1,
  key: Uint8Array,
): ProviderStrongMutationBrokerSnapshotEnvelopeInternalV1 {
  try {
    if (
      !exactRecordV1(value, [
        "payload",
        "snapshotContentDigest",
        "snapshotToken",
      ]) ||
      !isDigestV1(value.snapshotContentDigest)
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
    }
    const raw = value.payload;
    if (
      !exactRecordV1(raw, [
        "schemaVersion",
        "profile",
        "installationIdentityGenerationId",
        "snapshotRevision",
        "previousSnapshotContentDigest",
        "intents",
        "accounting",
      ]) ||
      raw.schemaVersion !== 1 ||
      raw.profile !== BROKER_SNAPSHOT_PROFILE_V1 ||
      !Number.isSafeInteger(raw.snapshotRevision) ||
      (raw.snapshotRevision as number) < 1 ||
      typeof raw.previousSnapshotContentDigest !== "string" ||
      !(
        raw.previousSnapshotContentDigest === GENESIS_CHAIN_V1 ||
        isDigestV1(raw.previousSnapshotContentDigest)
      ) ||
      ((raw.snapshotRevision as number) === 1) !==
        (raw.previousSnapshotContentDigest === GENESIS_CHAIN_V1) ||
      !Array.isArray(raw.intents)
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
    }
    const identity = InstallationIdentityGenerationIdV1Schema.parse(
      raw.installationIdentityGenerationId,
    );
    if (identity !== installationIdentityGenerationId) {
      throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
    }
    const intents = Object.freeze(raw.intents.map(parseIntentV1));
    const uniqueGrantIds = new Set(intents.map((intent) => intent.grantId));
    const resolvedCount = intents.reduce(
      (count, intent) => count + (intent.state === "resolved" ? 1 : 0),
      0,
    );
    if (
      uniqueGrantIds.size !== intents.length ||
      (raw.snapshotRevision as number) !== intents.length + resolvedCount
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
    }
    const accounting = parseAccountingV1(raw.accounting);
    const calculatedAccounting = calculateAccountingV1(intents);
    if (!sameCanonicalV1(accounting, calculatedAccounting)) {
      throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
    }
    const payload: ProviderStrongMutationBrokerSnapshotPayloadInternalV1 =
      Object.freeze({
        schemaVersion: 1,
        profile: BROKER_SNAPSHOT_PROFILE_V1,
        installationIdentityGenerationId: identity,
        snapshotRevision: raw.snapshotRevision as number,
        previousSnapshotContentDigest: raw.previousSnapshotContentDigest,
        intents,
        accounting,
      });
    const snapshotContentDigest = digestDomainInternalV1(
      BROKER_SNAPSHOT_DIGEST_DOMAIN_V1,
      payload,
    );
    if (
      value.snapshotContentDigest !== snapshotContentDigest ||
      !verifyHmacTokenForDomainInternalV1(
        key,
        BROKER_SNAPSHOT_TOKEN_DOMAIN_V1,
        { payload, snapshotContentDigest },
        value.snapshotToken,
      )
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
    }
    const snapshotPhysicalBytes = canonicalAuthorityBytesInternalV1(value)
      .byteLength;
    for (const intent of intents) {
      const requestBytes = canonicalAuthorityBytesInternalV1(intent.request)
        .byteLength;
      const responseBytes = intent.state === "resolved"
        ? canonicalAuthorityBytesInternalV1(intent.response).byteLength
        : 0;
      const admission = classifyProviderStrongMutationBrokerAdmissionInternalV1({
        intentCount: intents.length,
        requestLogicalBytes: requestBytes,
        responseLogicalBytes: responseBytes,
        snapshotPhysicalBytes,
        isExistingReplay: false,
      });
      if (!admission.admitted) {
        throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
      }
    }
    return Object.freeze({
      payload,
      snapshotContentDigest,
      snapshotToken: value.snapshotToken as string,
    });
  } catch (error) {
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1(
      "namespace_integrity_failed",
    );
  }
}

async function loadSnapshotV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1,
  key: Uint8Array,
): Promise<LoadedProviderStrongMutationBrokerSnapshotInternalV1 | undefined> {
  try {
    const checked = await readCheckedAuthorityFileInternalV1({
      path: layout.canonicalStrongMutationBrokerSnapshotPath,
      layout,
      maximumBytes:
        PROVIDER_STRONG_MUTATION_BROKER_LIMITS_INTERNAL_V1.maxSnapshotPhysicalBytes,
    });
    const parsed = parseCanonicalAuthorityBytesInternalV1(checked.bytes);
    const envelope = parseSnapshotV1(
      parsed,
      installationIdentityGenerationId,
      key,
    );
    return Object.freeze({ envelope, canonicalBytes: checked.bytes });
  } catch (error) {
    if (isMissingFileInternalV1(error)) return undefined;
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1(
      "namespace_integrity_failed",
    );
  }
}

function snapshotTokenDigestV1(
  snapshot: ProviderStrongMutationBrokerSnapshotEnvelopeInternalV1,
): Sha256ContentDigestInternalV1 {
  return sha256DigestInternalV1(
    canonicalAuthorityBytesInternalV1(snapshot.snapshotToken),
  );
}

function signPublicationPinV1(
  key: Uint8Array,
  snapshot: ProviderStrongMutationBrokerSnapshotEnvelopeInternalV1,
  previous: ProviderStrongMutationBrokerPublicationPinEnvelopeInternalV1 | undefined,
): ProviderStrongMutationBrokerPublicationPinEnvelopeInternalV1 {
  const payload: ProviderStrongMutationBrokerPublicationPinPayloadInternalV1 =
    Object.freeze({
      schemaVersion: 1,
      profile: BROKER_PUBLICATION_PIN_PROFILE_V1,
      publicationRevision: snapshot.payload.snapshotRevision,
      snapshotRevision: snapshot.payload.snapshotRevision,
      snapshotContentDigest: snapshot.snapshotContentDigest,
      snapshotTokenDigest: snapshotTokenDigestV1(snapshot),
      previousPublicationContentDigest:
        previous?.publicationContentDigest ?? GENESIS_CHAIN_V1,
    });
  const publicationContentDigest = digestDomainInternalV1(
    BROKER_PUBLICATION_PIN_DIGEST_DOMAIN_V1,
    payload,
  );
  return Object.freeze({
    payload,
    publicationContentDigest,
    publicationToken: hmacTokenForDomainInternalV1(
      key,
      BROKER_PUBLICATION_PIN_TOKEN_DOMAIN_V1,
      { payload, publicationContentDigest },
    ),
  });
}

function parsePublicationPinV1(
  value: unknown,
  key: Uint8Array,
): ProviderStrongMutationBrokerPublicationPinEnvelopeInternalV1 {
  try {
    if (
      !exactRecordV1(value, [
        "payload",
        "publicationContentDigest",
        "publicationToken",
      ]) ||
      !isDigestV1(value.publicationContentDigest)
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
    }
    const raw = value.payload;
    if (
      !exactRecordV1(raw, [
        "schemaVersion",
        "profile",
        "publicationRevision",
        "snapshotRevision",
        "snapshotContentDigest",
        "snapshotTokenDigest",
        "previousPublicationContentDigest",
      ]) ||
      raw.schemaVersion !== 1 ||
      raw.profile !== BROKER_PUBLICATION_PIN_PROFILE_V1 ||
      !Number.isSafeInteger(raw.publicationRevision) ||
      (raw.publicationRevision as number) < 1 ||
      raw.publicationRevision !== raw.snapshotRevision ||
      !isDigestV1(raw.snapshotContentDigest) ||
      !isDigestV1(raw.snapshotTokenDigest) ||
      typeof raw.previousPublicationContentDigest !== "string" ||
      !(
        raw.previousPublicationContentDigest === GENESIS_CHAIN_V1 ||
        isDigestV1(raw.previousPublicationContentDigest)
      ) ||
      ((raw.publicationRevision as number) === 1) !==
        (raw.previousPublicationContentDigest === GENESIS_CHAIN_V1)
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
    }
    const payload: ProviderStrongMutationBrokerPublicationPinPayloadInternalV1 =
      Object.freeze({
        schemaVersion: 1,
        profile: BROKER_PUBLICATION_PIN_PROFILE_V1,
        publicationRevision: raw.publicationRevision as number,
        snapshotRevision: raw.snapshotRevision as number,
        snapshotContentDigest: raw.snapshotContentDigest,
        snapshotTokenDigest: raw.snapshotTokenDigest,
        previousPublicationContentDigest: raw.previousPublicationContentDigest,
      });
    const publicationContentDigest = digestDomainInternalV1(
      BROKER_PUBLICATION_PIN_DIGEST_DOMAIN_V1,
      payload,
    );
    if (
      value.publicationContentDigest !== publicationContentDigest ||
      !verifyHmacTokenForDomainInternalV1(
        key,
        BROKER_PUBLICATION_PIN_TOKEN_DOMAIN_V1,
        { payload, publicationContentDigest },
        value.publicationToken,
      )
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
    }
    return Object.freeze({
      payload,
      publicationContentDigest,
      publicationToken: value.publicationToken as string,
    });
  } catch (error) {
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1(
      "namespace_integrity_failed",
    );
  }
}

async function loadPublicationPinV1(
  path: string,
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  key: Uint8Array,
): Promise<ProviderStrongMutationBrokerPublicationPinEnvelopeInternalV1 | undefined> {
  try {
    const checked = await readCheckedAuthorityFileInternalV1({
      path,
      layout,
      maximumBytes: MAX_BROKER_PUBLICATION_PIN_BYTES_V1,
    });
    return parsePublicationPinV1(
      parseCanonicalAuthorityBytesInternalV1(checked.bytes),
      key,
    );
  } catch (error) {
    if (isMissingFileInternalV1(error)) return undefined;
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1(
      "namespace_integrity_failed",
    );
  }
}

function publicationMatchesSnapshotV1(
  publication: ProviderStrongMutationBrokerPublicationPinEnvelopeInternalV1,
  snapshot: ProviderStrongMutationBrokerSnapshotEnvelopeInternalV1,
): boolean {
  return publication.payload.snapshotRevision ===
      snapshot.payload.snapshotRevision &&
    publication.payload.snapshotContentDigest ===
      snapshot.snapshotContentDigest &&
    publication.payload.snapshotTokenDigest === snapshotTokenDigestV1(snapshot);
}

async function preparePublicationPinV1(input: Readonly<{
  layout: ProviderAcceptanceAuthorityLayoutInternalV1;
  key: Uint8Array;
  snapshot: ProviderStrongMutationBrokerSnapshotEnvelopeInternalV1;
  previous: ProviderStrongMutationBrokerPublicationPinEnvelopeInternalV1 | undefined;
  options: ProviderAcceptanceAuthorityStoreOpenOptionsInternalV1;
}>): Promise<ProviderStrongMutationBrokerPublicationPinEnvelopeInternalV1> {
  const publication = signPublicationPinV1(
    input.key,
    input.snapshot,
    input.previous,
  );
  await prepareDurableAuthorityStageInternalV1({
    stagePath:
      input.layout.deterministicStrongMutationBrokerPublicationPinStagePath,
    bytes: canonicalAuthorityBytesInternalV1(publication),
    layout: input.layout,
    hooks: input.options,
    beforeCompleteWritePhase:
      "broker_publication_stage_preparation_opened_before_complete_write",
    phase: "broker_publication_stage_file_fsynced",
  });
  return publication;
}

async function publishPreparedPublicationPinV1(input: Readonly<{
  layout: ProviderAcceptanceAuthorityLayoutInternalV1;
  options?: ProviderAcceptanceAuthorityStoreOpenOptionsInternalV1;
}>): Promise<void> {
  await publishPreparedAuthorityStageInternalV1({
    stagePath:
      input.layout.deterministicStrongMutationBrokerPublicationPinStagePath,
    canonicalPath:
      input.layout.canonicalStrongMutationBrokerPublicationPinPath,
    layout: input.layout,
    hooks: input.options,
    afterCanonicalRename:
      "broker_publication_canonical_renamed_before_directory_fsync",
    afterDirectoryFsync: "broker_publication_directory_fsynced",
  });
}

async function loadConvergedBrokerSnapshotV1(input: Readonly<{
  layout: ProviderAcceptanceAuthorityLayoutInternalV1;
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  key: Uint8Array;
}>): Promise<Readonly<{
  snapshot: LoadedProviderStrongMutationBrokerSnapshotInternalV1 | undefined;
  publication: ProviderStrongMutationBrokerPublicationPinEnvelopeInternalV1 | undefined;
}>> {
  const limits = PROVIDER_STRONG_MUTATION_BROKER_LIMITS_INTERNAL_V1;
  await normalizeDurableAuthorityStagePreparationInternalV1({
    stagePath: input.layout.deterministicStrongMutationBrokerSnapshotStagePath,
    layout: input.layout,
    maximumBytes: limits.maxSnapshotPhysicalBytes,
  });
  await normalizeDurableAuthorityStagePreparationInternalV1({
    stagePath:
      input.layout.deterministicStrongMutationBrokerPublicationPinStagePath,
    layout: input.layout,
    maximumBytes: MAX_BROKER_PUBLICATION_PIN_BYTES_V1,
  });
  await discardDeterministicAuthorityStageInternalV1({
    path: input.layout.deterministicStrongMutationBrokerSnapshotStagePath,
    layout: input.layout,
  });
  const snapshot = await loadSnapshotV1(
    input.layout,
    input.installationIdentityGenerationId,
    input.key,
  );
  const publication = await loadPublicationPinV1(
    input.layout.canonicalStrongMutationBrokerPublicationPinPath,
    input.layout,
    input.key,
  );
  const prepared = await loadPublicationPinV1(
    input.layout.deterministicStrongMutationBrokerPublicationPinStagePath,
    input.layout,
    input.key,
  );
  const exactPublished = snapshot !== undefined && publication !== undefined &&
    publicationMatchesSnapshotV1(publication, snapshot.envelope);
  if (prepared === undefined) {
    if (snapshot === undefined && publication === undefined) {
      return Object.freeze({ snapshot, publication });
    }
    if (exactPublished) return Object.freeze({ snapshot, publication });
    throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
  }
  if (
    (snapshot === undefined && publication === undefined &&
      prepared.payload.snapshotRevision === 1 &&
      prepared.payload.previousPublicationContentDigest === GENESIS_CHAIN_V1) ||
    (exactPublished && publication !== undefined &&
      prepared.payload.snapshotRevision ===
        publication.payload.snapshotRevision + 1 &&
      prepared.payload.previousPublicationContentDigest ===
        publication.publicationContentDigest)
  ) {
    await discardDeterministicAuthorityStageInternalV1({
      path:
        input.layout.deterministicStrongMutationBrokerPublicationPinStagePath,
      layout: input.layout,
    });
    return Object.freeze({ snapshot, publication });
  }
  if (snapshot !== undefined) {
    const snapshotPayload = snapshot.envelope.payload;
    const validAdvance = publication === undefined
      ? snapshotPayload.snapshotRevision === 1 &&
        snapshotPayload.previousSnapshotContentDigest === GENESIS_CHAIN_V1 &&
        prepared.payload.previousPublicationContentDigest === GENESIS_CHAIN_V1
      : snapshotPayload.snapshotRevision ===
          publication.payload.snapshotRevision + 1 &&
        snapshotPayload.previousSnapshotContentDigest ===
          publication.payload.snapshotContentDigest &&
        prepared.payload.previousPublicationContentDigest ===
          publication.publicationContentDigest;
    if (
      validAdvance &&
      publicationMatchesSnapshotV1(prepared, snapshot.envelope)
    ) {
      await publishPreparedPublicationPinV1({ layout: input.layout });
      return Object.freeze({ snapshot, publication: prepared });
    }
  }
  throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
}

function verifyAcceptanceHistoryClosureV1(
  snapshot: LoadedProviderStrongMutationBrokerSnapshotInternalV1 | undefined,
  current: ProviderAcceptanceCurrentReadV1 | null,
): void {
  if (snapshot === undefined) return;
  if (current === null) {
    if (snapshot.envelope.payload.intents.length === 0) return;
    throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
  }
  const installationIdentityGenerationId =
    current.highWater.payload.installationIdentityGenerationId;
  for (const intent of snapshot.envelope.payload.intents) {
    const basis = intent.acceptanceIdentity;
    if (
      basis.installationIdentityGenerationId !==
        installationIdentityGenerationId ||
      !current.enumeration.entries.some((entry) =>
        entry.generationId === basis.generationId &&
        entry.contentDigest === basis.contentDigest &&
        entry.acceptanceOrdinal === basis.acceptanceOrdinal
      )
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1(
        "namespace_integrity_failed",
      );
    }
  }
}

async function verifyBrokerTrustClosureV1(
  snapshot: LoadedProviderStrongMutationBrokerSnapshotInternalV1 | undefined,
  view: ProviderAcceptanceAuthorityLockedCurrentViewCoreInternalV1,
  verifierCapability:
    ProviderStrongMutationTrustVerifierCapabilityInternalV1,
  verificationSession:
    ProviderStrongMutationTrustVerificationSessionInternalV1,
): Promise<void> {
  if (snapshot === undefined) return;
  const acceptanceHistory = Object.freeze({
    installationIdentityGenerationId:
      view.installationIdentityGenerationId,
    generationEnvelopes: view.verifiedGenerationEnvelopes,
  });
  try {
    for (const intent of snapshot.envelope.payload.intents) {
      const verified = await verifyProviderStrongMutationBeginTrustInternalV1(
        verifierCapability,
        {
          acceptanceHistory,
          request: intent.request,
          verificationSession,
        },
      );
      if (
        !sameCanonicalV1(
          verified.certificate,
          intent.verificationCertificate,
        ) ||
        !sameCanonicalV1(
          verified.principalAttestation,
          intent.principalAttestation,
        )
      ) {
        throw new ProviderAcceptanceAuthorityErrorV1(
          "namespace_integrity_failed",
        );
      }
      if (intent.state === "resolved") {
        await verifyProviderStrongMutationResponseTrustInternalV1(
          verifierCapability,
          {
            certificate: intent.verificationCertificate,
            principalAttestation: intent.principalAttestation,
            response: intent.response,
          },
        );
      }
    }
  } catch (error) {
    if (
      error instanceof ProviderAcceptanceAuthorityErrorV1 &&
      error.code === "namespace_integrity_failed"
    ) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1(
      "namespace_integrity_failed",
    );
  }
}

function nowIsoV1(clock: (() => Date) | undefined): string {
  const value = (clock ?? (() => new Date()))();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new ProviderAcceptanceAuthorityErrorV1("io_error");
  }
  return value.toISOString();
}

async function publishSnapshotV1(input: Readonly<{
  layout: ProviderAcceptanceAuthorityLayoutInternalV1;
  key: Uint8Array;
  previous: LoadedProviderStrongMutationBrokerSnapshotInternalV1 | undefined;
  publication: ProviderStrongMutationBrokerPublicationPinEnvelopeInternalV1 | undefined;
  payload: ProviderStrongMutationBrokerSnapshotPayloadInternalV1;
  options: ProviderAcceptanceAuthorityStoreOpenOptionsInternalV1;
  requestLogicalBytes: number;
  responseLogicalBytes: number;
}>): Promise<ProviderStrongMutationBrokerSnapshotEnvelopeInternalV1> {
  const envelope = signSnapshotV1(input.key, input.payload);
  const bytes = canonicalAuthorityBytesInternalV1(envelope);
  const admission = classifyProviderStrongMutationBrokerAdmissionInternalV1({
    intentCount: input.payload.accounting.intentCount,
    requestLogicalBytes: input.requestLogicalBytes,
    responseLogicalBytes: input.responseLogicalBytes,
    snapshotPhysicalBytes: bytes.byteLength,
    isExistingReplay: false,
  });
  if (!admission.admitted) {
    throw new ProviderAcceptanceAuthorityErrorV1("capacity_exhausted");
  }
  parseSnapshotV1(
    parseCanonicalAuthorityBytesInternalV1(bytes),
    input.payload.installationIdentityGenerationId,
    input.key,
  );
  await preparePublicationPinV1({
    layout: input.layout,
    key: input.key,
    snapshot: envelope,
    previous: input.publication,
    options: input.options,
  });
  await replaceDurableAuthoritySnapshotInternalV1({
    canonicalPath: input.layout.canonicalStrongMutationBrokerSnapshotPath,
    stagePath: input.layout.deterministicStrongMutationBrokerSnapshotStagePath,
    bytes,
    layout: input.layout,
    hooks: input.options,
    phases: {
      afterPreparationOpen:
        "broker_snapshot_stage_preparation_opened_before_complete_write",
      afterStageFileFsync: "broker_snapshot_stage_file_fsynced",
      afterCanonicalRename:
        "broker_snapshot_canonical_renamed_before_directory_fsync",
      afterDirectoryFsync:
        "broker_snapshot_directory_fsynced_before_publication",
    },
  });
  await publishPreparedPublicationPinV1({
    layout: input.layout,
    options: input.options,
  });
  await input.options.afterDurablePhase?.(
    "broker_snapshot_directory_fsynced_before_response",
  );
  return envelope;
}

function findIntentV1(
  snapshot: LoadedProviderStrongMutationBrokerSnapshotInternalV1 | undefined,
  grantId: string,
): ProviderStrongMutationBrokerIntentInternalV1 | undefined {
  return snapshot?.envelope.payload.intents.find(
    (intent) => intent.grantId === grantId,
  );
}

function sameStoredRequestV1(
  intent: ProviderStrongMutationBrokerIntentInternalV1,
  request: ProviderRuntimeIpcStrongMutationRequestV1,
): boolean {
  return intent.requestContentDigest === requestContentDigestV1(request) &&
    intent.requestDigest === request.requestDigest &&
    intent.bindingDigest === request.bindingDigest &&
    sameCanonicalV1(intent.request, request);
}

function parseResolveRequestV1(
  input: unknown,
): ProviderStrongMutationBrokerResolveRequestInternalV1 {
  try {
    if (
      !exactRecordV1(input, [
        "profile",
        "grantId",
        "requestContentDigest",
        "requestDigest",
        "bindingDigest",
        "response",
      ]) ||
      input.profile !== BROKER_RESOLVE_REQUEST_PROFILE_V1 ||
      !isDigestV1(input.grantId) ||
      !isDigestV1(input.requestContentDigest) ||
      !isDigestV1(input.requestDigest) ||
      !isDigestV1(input.bindingDigest)
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1("invalid_request");
    }
    return Object.freeze({
      profile: BROKER_RESOLVE_REQUEST_PROFILE_V1,
      grantId: input.grantId,
      requestContentDigest: input.requestContentDigest,
      requestDigest: input.requestDigest,
      bindingDigest: input.bindingDigest,
      response: ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(
        input.response,
      ),
    });
  } catch (error) {
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1("invalid_request");
  }
}

async function withBrokerViewV1<T>(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  verifierCapability:
    ProviderStrongMutationTrustVerifierCapabilityInternalV1,
  options: ProviderAcceptanceAuthorityStoreOpenOptionsInternalV1,
  callback: (
    view: ProviderAcceptanceAuthorityLockedCurrentViewCoreInternalV1,
    converged: Readonly<{
      snapshot: LoadedProviderStrongMutationBrokerSnapshotInternalV1 | undefined;
      publication: ProviderStrongMutationBrokerPublicationPinEnvelopeInternalV1 | undefined;
    }>,
    verificationSession:
      ProviderStrongMutationTrustVerificationSessionInternalV1,
  ) => T | Promise<T>,
): Promise<T> {
  return withProviderAcceptanceAuthorityLockedCurrentViewCoreInternalV1(
    layout,
    options,
    async (view) => {
      const converged = await loadConvergedBrokerSnapshotV1({
        layout,
        installationIdentityGenerationId:
          view.installationIdentityGenerationId,
        key: view.key,
      });
      verifyAcceptanceHistoryClosureV1(converged.snapshot, view.current);
      const verificationSession =
        createProviderStrongMutationTrustVerificationSessionInternalV1(
          verifierCapability,
        );
      await verifyBrokerTrustClosureV1(
        converged.snapshot,
        view,
        verifierCapability,
        verificationSession,
      );
      return callback(view, converged, verificationSession);
    },
  );
}

export async function openProviderStrongMutationBrokerStoreWithLayoutCoreInternalV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  verifierCapability:
    ProviderStrongMutationTrustVerifierCapabilityInternalV1,
  options: ProviderAcceptanceAuthorityStoreOpenOptionsInternalV1 = {},
): Promise<ProviderStrongMutationBrokerStoreInternalV1> {
  try {
    assertProviderStrongMutationTrustVerifierCapabilityInternalV1(
      verifierCapability,
    );
  } catch {
    throw new ProviderAcceptanceAuthorityErrorV1("invalid_request");
  }
  await withBrokerViewV1(
    layout,
    verifierCapability,
    options,
    () => undefined,
  );

  const begin = async (
    input: unknown,
  ): Promise<ProviderStrongMutationBrokerBeginResultInternalV1> => {
    const request = parseStrongMutationRequestV1(input);
    const requestBytes = canonicalAuthorityBytesInternalV1(request).byteLength;
    return withBrokerViewV1(
      layout,
      verifierCapability,
      options,
      async (view, converged, verificationSession) => {
        const existing = findIntentV1(
          converged.snapshot,
          request.authorityGrant.grantId,
        );
        if (existing !== undefined) {
          if (!sameStoredRequestV1(existing, request)) {
            return Object.freeze({
              resolution: "request_rejected" as const,
              reason: "grant_request_mismatch" as const,
              existingIntent: existing,
            });
          }
          return Object.freeze({
            resolution: "recorded" as const,
            disposition: "replayed" as const,
            intent: existing,
          });
        }
        const acceptanceIdentity = requireFreshCurrentAcceptanceJoinV1(
          request,
          view.current,
        );
        const admission = classifyProviderStrongMutationBrokerAdmissionInternalV1({
          intentCount:
            (converged.snapshot?.envelope.payload.intents.length ?? 0) + 1,
          requestLogicalBytes: requestBytes,
          responseLogicalBytes: 0,
          snapshotPhysicalBytes: 0,
          isExistingReplay: false,
        });
        if (!admission.admitted) {
          throw new ProviderAcceptanceAuthorityErrorV1("capacity_exhausted");
        }
        let verified;
        try {
          verified = await verifyProviderStrongMutationBeginTrustInternalV1(
            verifierCapability,
            {
              acceptanceHistory: Object.freeze({
                installationIdentityGenerationId:
                  view.installationIdentityGenerationId,
                generationEnvelopes: view.verifiedGenerationEnvelopes,
              }),
              request,
              verificationSession,
            },
          );
        } catch {
          throw new ProviderAcceptanceAuthorityErrorV1("invalid_request");
        }
        const intent: ProviderStrongMutationBrokerPendingIntentInternalV1 =
          Object.freeze({
            profile: BROKER_INTENT_PROFILE_V1,
            grantId: request.authorityGrant.grantId,
            requestContentDigest: requestContentDigestV1(request),
            requestDigest: request.requestDigest,
            bindingDigest: request.bindingDigest,
            acceptanceIdentity,
            request,
            verificationCertificate: verified.certificate,
            principalAttestation: verified.principalAttestation,
            grantVerification:
              PROVIDER_STRONG_MUTATION_TRUST_VERIFICATION_MARKERS_INTERNAL_V1.grant,
            executionFence: "not_established" as const,
            strongWrites: "locked" as const,
            recordedAt: nowIsoV1(options.clock),
            state: "pending" as const,
          });
        verifyIntentRequestBindingsV1(intent);
        const intents = [
          ...(converged.snapshot?.envelope.payload.intents ?? []),
          intent,
        ];
        const payload = snapshotPayloadV1({
          installationIdentityGenerationId:
            view.installationIdentityGenerationId,
          previous: converged.snapshot,
          intents,
        });
        await publishSnapshotV1({
          layout,
          key: view.key,
          previous: converged.snapshot,
          publication: converged.publication,
          payload,
          options,
          requestLogicalBytes: requestBytes,
          responseLogicalBytes: 0,
        });
        return Object.freeze({
          resolution: "recorded" as const,
          disposition: "created" as const,
          intent,
        });
      },
    );
  };

  const resolve = async (
    input: unknown,
  ): Promise<ProviderStrongMutationBrokerResolveResultInternalV1> => {
    const resolution = parseResolveRequestV1(input);
    const responseBytes = canonicalAuthorityBytesInternalV1(
      resolution.response,
    ).byteLength;
    const earlyAdmission = classifyProviderStrongMutationBrokerAdmissionInternalV1({
      intentCount: 0,
      requestLogicalBytes: 0,
      responseLogicalBytes: responseBytes,
      snapshotPhysicalBytes: 0,
      isExistingReplay: false,
    });
    if (!earlyAdmission.admitted) {
      throw new ProviderAcceptanceAuthorityErrorV1("capacity_exhausted");
    }
    return withBrokerViewV1(
      layout,
      verifierCapability,
      options,
      async (view, converged) => {
        const existing = findIntentV1(converged.snapshot, resolution.grantId);
        if (
          existing === undefined ||
          existing.requestContentDigest !== resolution.requestContentDigest ||
          existing.requestDigest !== resolution.requestDigest ||
          existing.bindingDigest !== resolution.bindingDigest ||
          !responseMatchesIntentV1(resolution.response, existing)
        ) {
          throw new ProviderAcceptanceAuthorityErrorV1("invalid_request");
        }
        if (existing.state === "resolved") {
          if (!sameCanonicalV1(existing.response, resolution.response)) {
            return Object.freeze({
              resolution: "request_rejected" as const,
              reason: "response_mismatch" as const,
              existingIntent: existing,
            });
          }
          return Object.freeze({
            resolution: "resolved" as const,
            disposition: "replayed" as const,
            intent: existing,
          });
        }
        let responseVerification;
        try {
          responseVerification =
            await verifyProviderStrongMutationResponseTrustInternalV1(
              verifierCapability,
              {
                certificate: existing.verificationCertificate,
                principalAttestation: existing.principalAttestation,
                response: resolution.response,
              },
            );
        } catch {
          throw new ProviderAcceptanceAuthorityErrorV1("invalid_request");
        }
        const resolved: ProviderStrongMutationBrokerResolvedIntentInternalV1 =
          Object.freeze({
            ...existing,
            state: "resolved" as const,
            responseContentDigest: responseContentDigestV1(
              resolution.response,
            ),
            response: resolution.response,
            responseVerification,
            resolvedAt: nowIsoV1(options.clock),
          });
        verifyIntentRequestBindingsV1(resolved);
        if (!responseMatchesIntentV1(resolved.response, resolved)) {
          throw new ProviderAcceptanceAuthorityErrorV1("invalid_request");
        }
        const intents = converged.snapshot!.envelope.payload.intents.map(
          (intent) => intent.grantId === resolved.grantId ? resolved : intent,
        );
        const payload = snapshotPayloadV1({
          installationIdentityGenerationId:
            view.installationIdentityGenerationId,
          previous: converged.snapshot,
          intents,
        });
        await publishSnapshotV1({
          layout,
          key: view.key,
          previous: converged.snapshot,
          publication: converged.publication,
          payload,
          options,
          requestLogicalBytes: canonicalAuthorityBytesInternalV1(
            existing.request,
          ).byteLength,
          responseLogicalBytes: responseBytes,
        });
        return Object.freeze({
          resolution: "resolved" as const,
          disposition: "created" as const,
          intent: resolved,
        });
      },
    );
  };

  return Object.freeze({
    authority: "installation_owner_candidate" as const,
    strongWrites: "locked" as const,
    grantVerification:
      PROVIDER_STRONG_MUTATION_TRUST_VERIFICATION_MARKERS_INTERNAL_V1.grant,
    executionFence: "not_established" as const,
    begin,
    resolve,
  });
}

export async function inspectProviderStrongMutationBrokerSnapshotWithLayoutCoreInternalV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  verifierCapability:
    ProviderStrongMutationTrustVerifierCapabilityInternalV1,
): Promise<ProviderStrongMutationBrokerSnapshotInspectionInternalV1> {
  try {
    assertProviderStrongMutationTrustVerifierCapabilityInternalV1(
      verifierCapability,
    );
  } catch {
    throw new ProviderAcceptanceAuthorityErrorV1("invalid_request");
  }
  return withBrokerViewV1(
    layout,
    verifierCapability,
    {},
    (_view, converged) => {
      const accounting = converged.snapshot?.envelope.payload.accounting;
      return Object.freeze({
        snapshotRevision:
          converged.snapshot?.envelope.payload.snapshotRevision ?? 0,
        intentCount: accounting?.intentCount ?? 0,
        pendingCount: accounting?.pendingCount ?? 0,
        resolvedCount: accounting?.resolvedCount ?? 0,
        intentLogicalBytes: accounting?.intentLogicalBytes ?? 0,
      });
    },
  );
}
