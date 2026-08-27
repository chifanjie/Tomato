import {
  ProviderRegistryManifestPinV1Schema,
  ProviderRegistryRootMetadataPinV1Schema,
  deriveStoreDurableObjectProviderRegistryEntryContentDigestV1,
  validateProviderRegistryManifestHistoryV1,
  type ProviderRegistryManifestPinV1,
  type ProviderRegistryManifestHistoryValidationV1,
  type ProviderRegistryRootMetadataPinV1,
  type ValidateProviderRegistryManifestHistoryV1Input,
} from "@understand-code/durable-object-provider-contracts";
import {
  MAX_C09_1L_PRECLONE_ALLOCATION_WORK_UNITS_V1,
  MAX_C09_1L_RAW_DEPTH_V1,
} from "@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point";
import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";
import {
  CanonicalPublicKeyBytes32V1Schema,
  ContentDigestV1Schema,
  Ed25519PublicKeyDigestV1Schema,
  StoreProviderVerificationKeyIdV1Schema,
  type ContentDigestV1,
  type InstallationIdentityGenerationIdV1,
  type StoreProviderVerificationKeyIdV1,
} from "@understand-code/durable-object-provider-contracts/primitives";
import {
  ProviderAcceptanceStateEnvelopeV1Schema,
  type ProviderAcceptanceStateEnvelopeV1,
} from "@understand-code/durable-object-provider-contracts/provider-acceptance";
import {
  ProviderRuntimeIpcAcceptanceIdentityProofV1Schema,
  ProviderRuntimeIpcPrincipalAttestationV1Schema,
  ProviderRuntimeIpcStrongMutationRequestV1Schema,
  ProviderRuntimeIpcStrongMutationResponseV1Schema,
  canonicalizeProviderRuntimeIpcPrincipalAttestationClaimsV1,
  canonicalizeProviderRuntimeIpcPrincipalAttestationTranscriptV1,
  canonicalizeProviderRuntimeIpcStrongMutationRequestV1,
  canonicalizeProviderRuntimeIpcStrongMutationResponseClaimsV1,
  canonicalizeProviderRuntimeIpcStrongMutationSessionBindingV1,
  createProviderRuntimeIpcStrongMutationAuthorityGrantSignatureMessageV1,
  parseProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1,
  type ProviderRuntimeIpcAcceptanceIdentityProofV1,
  type ProviderRuntimeIpcPrincipalAttestationV1,
  type ProviderRuntimeIpcStrongMutationRequestV1,
  type ProviderRuntimeIpcStrongMutationResponseV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import {
  ProviderActiveWriterSelectionV1Schema,
  type ProviderActiveWriterSelectionV1,
} from "@understand-code/durable-object-provider-contracts/provider-strong-ready-acceptance-candidate";
import {
  verifyRawEd25519WithCapabilityV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "@understand-code/durable-object-provider-contracts/strict-ed25519-conformance";

import { sha256DigestInternalV1 } from "./crypto-internal.js";

const EVIDENCE_QUERY_PROFILE_V1 =
  "understand_code_provider_strong_mutation_trust_evidence_query_v1" as const;
const VERIFICATION_CERTIFICATE_PROFILE_V1 =
  "understand_code_provider_strong_mutation_verification_certificate_v1" as const;
const VERIFICATION_ALGORITHM_V1 = "strict_ed25519_v1" as const;
const ED25519_SPKI_DER_PREFIX_V1 = Buffer.from(
  "302a300506032b6570032100",
  "hex",
);

export const PROVIDER_STRONG_MUTATION_TRUST_EVIDENCE_SNAPSHOT_LIMITS_INTERNAL_V1 =
  Object.freeze({
    maxPrecloneAllocationWorkUnits:
      MAX_C09_1L_PRECLONE_ALLOCATION_WORK_UNITS_V1,
    // The evidence wrapper and selected branch root sit outside the formal
    // Registry raw value whose exported maximum depth is preserved exactly.
    maxEvidenceWrapperDepth: MAX_C09_1L_RAW_DEPTH_V1 + 2,
  });

export interface ProviderStrongMutationTrustEvidenceSnapshotAdmissionInputInternalV1 {
  readonly precloneAllocationWorkUnits: number;
  readonly evidenceWrapperDepth: number;
}

export type ProviderStrongMutationTrustEvidenceSnapshotAdmissionResultInternalV1 =
  | Readonly<{ readonly admitted: true }>
  | Readonly<{
      readonly admitted: false;
      readonly reason: "preclone_work_units" | "depth";
    }>;

export function classifyProviderStrongMutationTrustEvidenceSnapshotAdmissionInternalV1(
  input: ProviderStrongMutationTrustEvidenceSnapshotAdmissionInputInternalV1,
): ProviderStrongMutationTrustEvidenceSnapshotAdmissionResultInternalV1 {
  if (
    !Number.isSafeInteger(input.precloneAllocationWorkUnits) ||
    input.precloneAllocationWorkUnits < 0 ||
    input.precloneAllocationWorkUnits >
      PROVIDER_STRONG_MUTATION_TRUST_EVIDENCE_SNAPSHOT_LIMITS_INTERNAL_V1
        .maxPrecloneAllocationWorkUnits
  ) {
    return Object.freeze({
      admitted: false as const,
      reason: "preclone_work_units" as const,
    });
  }
  if (
    !Number.isSafeInteger(input.evidenceWrapperDepth) ||
    input.evidenceWrapperDepth < 0 ||
    input.evidenceWrapperDepth >
      PROVIDER_STRONG_MUTATION_TRUST_EVIDENCE_SNAPSHOT_LIMITS_INTERNAL_V1
        .maxEvidenceWrapperDepth
  ) {
    return Object.freeze({
      admitted: false as const,
      reason: "depth" as const,
    });
  }
  return Object.freeze({ admitted: true as const });
}

export const PROVIDER_STRONG_MUTATION_TRUST_VERIFICATION_MARKERS_INTERNAL_V1 =
  Object.freeze({
    grant:
      "strict_registry_acceptance_grant_bound_principal_self_signature_verified_v1" as const,
    response:
      "strict_grant_bound_principal_response_signature_verified_v1" as const,
  });

export interface ProviderStrongMutationTrustEvidenceQueryInternalV1 {
  readonly profile: typeof EVIDENCE_QUERY_PROFILE_V1;
  readonly grantId: string;
  readonly grantContentDigest: ContentDigestV1;
  readonly acceptanceIdentity: ProviderRuntimeIpcAcceptanceIdentityProofV1;
  readonly registryManifest: ProviderRegistryManifestPinV1;
  readonly principalAttestationDigest: ContentDigestV1;
}

type ProviderStrongMutationRegistryHistoryEvidenceInternalV1 = Omit<
  ValidateProviderRegistryManifestHistoryV1Input,
  "strictCryptoCapability"
>;

export interface ProviderStrongMutationTrustEvidenceInternalV1 {
  readonly bootstrapTrustBundle:
    ProviderStrongMutationRegistryHistoryEvidenceInternalV1["bootstrapTrustBundle"];
  readonly rootMetadataHistory:
    ProviderStrongMutationRegistryHistoryEvidenceInternalV1["rootMetadataHistory"];
  readonly registryManifestHistory:
    ProviderStrongMutationRegistryHistoryEvidenceInternalV1["registryManifestHistory"];
  readonly principalAttestation: ProviderRuntimeIpcPrincipalAttestationV1;
}

interface ParsedProviderStrongMutationTrustEvidenceInternalV1 {
  readonly principalAttestation: ProviderRuntimeIpcPrincipalAttestationV1;
  readonly registryHistory?: Readonly<{
    readonly bootstrapTrustBundle:
      ProviderStrongMutationTrustEvidenceInternalV1["bootstrapTrustBundle"];
    readonly rootMetadataHistory:
      ProviderStrongMutationTrustEvidenceInternalV1["rootMetadataHistory"];
    readonly registryManifestHistory:
      ProviderStrongMutationTrustEvidenceInternalV1["registryManifestHistory"];
  }>;
}

export interface ProviderStrongMutationVerifiedAcceptanceHistoryInternalV1 {
  readonly installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1;
  readonly generationEnvelopes:
    readonly ProviderAcceptanceStateEnvelopeV1[];
}

export interface ProviderStrongMutationVerificationCertificateInternalV1 {
  readonly profile: typeof VERIFICATION_CERTIFICATE_PROFILE_V1;
  readonly verificationAlgorithm: typeof VERIFICATION_ALGORITHM_V1;
  readonly acceptanceIdentity: ProviderRuntimeIpcAcceptanceIdentityProofV1;
  readonly activeRootMetadata: ProviderRegistryRootMetadataPinV1;
  readonly registryManifest: ProviderRegistryManifestPinV1;
  readonly activeWriter: ProviderActiveWriterSelectionV1;
  readonly registryEntryContentDigest: ContentDigestV1;
  readonly grantSigner: Readonly<{
    readonly keyId: StoreProviderVerificationKeyIdV1;
    readonly publicKeyBytes: string;
    readonly publicKeyDigest: string;
  }>;
  readonly grantContentDigest: ContentDigestV1;
  readonly principalAttestationDigest: ContentDigestV1;
  readonly principalPublicKeyRaw32: string;
}

declare const providerStrongMutationTrustVerifierCapabilityBrandInternalV1:
  unique symbol;
export interface ProviderStrongMutationTrustVerifierCapabilityInternalV1 {
  readonly [providerStrongMutationTrustVerifierCapabilityBrandInternalV1]: true;
}

export interface MintProviderStrongMutationTrustVerifierCapabilityInternalV1Input {
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
  /** Evidence transport only; every returned field is detached and verified. */
  readonly readEvidence: (
    query: ProviderStrongMutationTrustEvidenceQueryInternalV1,
  ) => unknown | Promise<unknown>;
}

interface ProviderStrongMutationTrustVerifierStateInternalV1 {
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
  readonly readEvidence:
    MintProviderStrongMutationTrustVerifierCapabilityInternalV1Input["readEvidence"];
}

const verifierStatesV1 = new WeakMap<
  object,
  ProviderStrongMutationTrustVerifierStateInternalV1
>();

declare const providerStrongMutationTrustVerificationSessionBrandInternalV1:
  unique symbol;
export interface ProviderStrongMutationTrustVerificationSessionInternalV1 {
  readonly [providerStrongMutationTrustVerificationSessionBrandInternalV1]: true;
}

interface ProviderStrongMutationTrustVerificationSessionStateInternalV1 {
  readonly verifierCapability:
    ProviderStrongMutationTrustVerifierCapabilityInternalV1;
  readonly registryClosures: Map<
    string,
    ProviderRegistryManifestHistoryValidationV1
  >;
}

const verificationSessionStatesV1 = new WeakMap<
  object,
  ProviderStrongMutationTrustVerificationSessionStateInternalV1
>();

export type ProviderStrongMutationTrustVerificationStageInternalV1 =
  | "verifier_capability"
  | "request"
  | "acceptance_history"
  | "evidence"
  | "registry_history"
  | "registry_binding"
  | "active_writer"
  | "grant_key"
  | "grant_signature"
  | "principal_attestation"
  | "principal_signature"
  | "response_signature";

export class ProviderStrongMutationTrustVerificationErrorInternalV1
  extends Error {
  constructor(
    readonly stage: ProviderStrongMutationTrustVerificationStageInternalV1,
  ) {
    super("provider strong mutation trust verification failed");
    this.name = "ProviderStrongMutationTrustVerificationErrorInternalV1";
  }
}

function failV1(
  stage: ProviderStrongMutationTrustVerificationStageInternalV1,
): never {
  throw new ProviderStrongMutationTrustVerificationErrorInternalV1(stage);
}

function exactDataRecordV1(
  value: unknown,
  keys: readonly string[],
  stage: ProviderStrongMutationTrustVerificationStageInternalV1,
): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) failV1(stage);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    Object.getOwnPropertySymbols(value).length !== 0 ||
    Object.keys(descriptors).length !== keys.length ||
    keys.some((key) => !Object.prototype.hasOwnProperty.call(descriptors, key))
  ) failV1(stage);
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor)) failV1(stage);
    result[key] = descriptor.value;
  }
  return result;
}

interface JsonSnapshotStateInternalV1 {
  readonly seen: WeakSet<object>;
  nodes: number;
}

function snapshotJsonDataV1(
  value: unknown,
  stage: ProviderStrongMutationTrustVerificationStageInternalV1,
  state: JsonSnapshotStateInternalV1 = { seen: new WeakSet(), nodes: 0 },
  depth = 0,
): unknown {
  state.nodes += 1;
  // Match the formal Registry evidence point's exported raw/preclone budget.
  // Two additional levels account for this broker's evidence wrapper and
  // selected branch root; they do not narrow the formal history depth.
  if (!classifyProviderStrongMutationTrustEvidenceSnapshotAdmissionInternalV1({
    precloneAllocationWorkUnits: state.nodes,
    evidenceWrapperDepth: depth,
  }).admitted) failV1(stage);
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) failV1(stage);
    return value;
  }
  if (typeof value !== "object" || state.seen.has(value)) failV1(stage);
  state.seen.add(value);
  if (Object.getOwnPropertySymbols(value).length !== 0) failV1(stage);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) failV1(stage);
    const length = descriptors.length;
    if (
      length === undefined ||
      !("value" in length) ||
      !Number.isSafeInteger(length.value) ||
      length.value < 0 ||
      Object.keys(descriptors).length !== length.value + 1
    ) failV1(stage);
    const result: unknown[] = [];
    for (let index = 0; index < length.value; index += 1) {
      const descriptor = descriptors[String(index)];
      if (descriptor === undefined || !("value" in descriptor)) failV1(stage);
      result.push(snapshotJsonDataV1(descriptor.value, stage, state, depth + 1));
    }
    return result;
  }
  if (
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  ) failV1(stage);
  const result: Record<string, unknown> = Object.create(null);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!("value" in descriptor)) failV1(stage);
    result[key] = snapshotJsonDataV1(descriptor.value, stage, state, depth + 1);
  }
  return result;
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  return canonicalizeJcsSafeIntegerV1(left) === canonicalizeJcsSafeIntegerV1(right);
}

function decodeCanonicalBytesV1(
  value: string,
  expectedLength: number,
  stage: ProviderStrongMutationTrustVerificationStageInternalV1,
): Uint8Array {
  if (!value.startsWith("base64url:")) failV1(stage);
  const body = value.slice("base64url:".length);
  const decoded = Buffer.from(body, "base64url");
  if (
    decoded.byteLength !== expectedLength ||
    decoded.toString("base64url") !== body
  ) failV1(stage);
  return Uint8Array.from(decoded);
}

function canonicalBytesV1(bytes: Uint8Array): string {
  return `base64url:${Buffer.from(bytes).toString("base64url")}`;
}

function exactAcceptanceIdentityV1(
  left: ProviderRuntimeIpcAcceptanceIdentityProofV1,
  right: ProviderRuntimeIpcAcceptanceIdentityProofV1,
): boolean {
  return left.installationIdentityGenerationId ===
      right.installationIdentityGenerationId &&
    left.acceptanceOrdinal === right.acceptanceOrdinal &&
    left.generationId === right.generationId &&
    left.contentDigest === right.contentDigest;
}

function findHistoricalStrongReadyAcceptanceV1(
  history: ProviderStrongMutationVerifiedAcceptanceHistoryInternalV1,
  identity: ProviderRuntimeIpcAcceptanceIdentityProofV1,
): ProviderAcceptanceStateEnvelopeV1 {
  if (
    history.installationIdentityGenerationId !==
      identity.installationIdentityGenerationId
  ) failV1("acceptance_history");
  const matches = history.generationEnvelopes.filter((candidate) =>
    candidate.installationIdentityGenerationId ===
      identity.installationIdentityGenerationId &&
    candidate.payload.acceptanceOrdinal === identity.acceptanceOrdinal &&
    candidate.generationId === identity.generationId &&
    candidate.contentDigest === identity.contentDigest
  );
  if (matches.length !== 1) failV1("acceptance_history");
  try {
    return ProviderAcceptanceStateEnvelopeV1Schema.parse(
      matches[0],
    );
  } catch {
    return failV1("acceptance_history");
  }
}

function parseEvidenceV1(
  value: unknown,
  includeRegistryHistory: boolean,
  principalAttestationInput?: ProviderRuntimeIpcPrincipalAttestationV1,
): ParsedProviderStrongMutationTrustEvidenceInternalV1 {
  const callbackIncludesPrincipal =
    typeof value === "object" && value !== null && !Array.isArray(value) &&
    Object.hasOwn(value, "principalAttestation");
  const raw = exactDataRecordV1(
    value,
    principalAttestationInput === undefined || callbackIncludesPrincipal
      ? [
          "bootstrapTrustBundle",
          "rootMetadataHistory",
          "registryManifestHistory",
          "principalAttestation",
        ]
      : [
          "bootstrapTrustBundle",
          "rootMetadataHistory",
          "registryManifestHistory",
        ],
    "evidence",
  );
  try {
    if (
      principalAttestationInput !== undefined && callbackIncludesPrincipal &&
      canonicalizeJcsSafeIntegerV1(
        ProviderRuntimeIpcPrincipalAttestationV1Schema.parse(
          snapshotJsonDataV1(raw.principalAttestation, "evidence"),
        ),
      ) !== canonicalizeJcsSafeIntegerV1(principalAttestationInput)
    ) return failV1("evidence");
    const principalAttestation =
      ProviderRuntimeIpcPrincipalAttestationV1Schema.parse(
        snapshotJsonDataV1(
          principalAttestationInput ?? raw.principalAttestation,
          "evidence",
        ),
      );
    if (!includeRegistryHistory) {
      return Object.freeze({ principalAttestation });
    }
    const registry = exactDataRecordV1(
      snapshotJsonDataV1({
        bootstrapTrustBundle: raw.bootstrapTrustBundle,
        rootMetadataHistory: raw.rootMetadataHistory,
        registryManifestHistory: raw.registryManifestHistory,
      }, "evidence"),
      [
        "bootstrapTrustBundle",
        "rootMetadataHistory",
        "registryManifestHistory",
      ],
      "evidence",
    );
    return Object.freeze({
      principalAttestation,
      registryHistory: Object.freeze({
        bootstrapTrustBundle:
          registry.bootstrapTrustBundle as ProviderStrongMutationTrustEvidenceInternalV1["bootstrapTrustBundle"],
        rootMetadataHistory:
          registry.rootMetadataHistory as ProviderStrongMutationTrustEvidenceInternalV1["rootMetadataHistory"],
        registryManifestHistory:
          registry.registryManifestHistory as ProviderStrongMutationTrustEvidenceInternalV1["registryManifestHistory"],
      }),
    });
  } catch {
    return failV1("evidence");
  }
}

function principalRawKeyV1(
  attestation: ProviderRuntimeIpcPrincipalAttestationV1,
): Uint8Array {
  const spki = decodeCanonicalBytesV1(
    attestation.publicKey,
    ED25519_SPKI_DER_PREFIX_V1.byteLength + 32,
    "principal_attestation",
  );
  if (
    !Buffer.from(spki.subarray(0, ED25519_SPKI_DER_PREFIX_V1.byteLength)).equals(
      ED25519_SPKI_DER_PREFIX_V1,
    )
  ) failV1("principal_attestation");
  return spki.subarray(ED25519_SPKI_DER_PREFIX_V1.byteLength);
}

function principalClaimsV1(
  attestation: ProviderRuntimeIpcPrincipalAttestationV1,
) {
  const {
    protocol: _protocol,
    kind: _kind,
    signature: _signature,
    ...claims
  } = attestation;
  return claims;
}

export function mintProviderStrongMutationTrustVerifierCapabilityInternalV1(
  input: MintProviderStrongMutationTrustVerifierCapabilityInternalV1Input,
): ProviderStrongMutationTrustVerifierCapabilityInternalV1 {
  if (
    input === null ||
    typeof input !== "object" ||
    (typeof input.strictCryptoCapability !== "object" &&
      typeof input.strictCryptoCapability !== "function") ||
    typeof input.readEvidence !== "function"
  ) throw new TypeError("provider strong mutation trust verifier invalid");
  const capability = Object.freeze(Object.create(null)) as
    ProviderStrongMutationTrustVerifierCapabilityInternalV1;
  verifierStatesV1.set(capability, Object.freeze({
    strictCryptoCapability: input.strictCryptoCapability,
    readEvidence: input.readEvidence,
  }));
  return capability;
}

export function parseProviderStrongMutationVerificationCertificateInternalV1(
  value: unknown,
): ProviderStrongMutationVerificationCertificateInternalV1 {
  const raw = exactDataRecordV1(value, [
    "profile",
    "verificationAlgorithm",
    "acceptanceIdentity",
    "activeRootMetadata",
    "registryManifest",
    "activeWriter",
    "registryEntryContentDigest",
    "grantSigner",
    "grantContentDigest",
    "principalAttestationDigest",
    "principalPublicKeyRaw32",
  ], "evidence");
  const signer = exactDataRecordV1(raw.grantSigner, [
    "keyId",
    "publicKeyBytes",
    "publicKeyDigest",
  ], "evidence");
  try {
    if (
      raw.profile !== VERIFICATION_CERTIFICATE_PROFILE_V1 ||
      raw.verificationAlgorithm !== VERIFICATION_ALGORITHM_V1
    ) failV1("evidence");
    const certificate: ProviderStrongMutationVerificationCertificateInternalV1 =
      Object.freeze({
        profile: VERIFICATION_CERTIFICATE_PROFILE_V1,
        verificationAlgorithm: VERIFICATION_ALGORITHM_V1,
        acceptanceIdentity:
          ProviderRuntimeIpcAcceptanceIdentityProofV1Schema.parse(
            raw.acceptanceIdentity,
          ),
        activeRootMetadata: ProviderRegistryRootMetadataPinV1Schema.parse(
          raw.activeRootMetadata,
        ),
        registryManifest: ProviderRegistryManifestPinV1Schema.parse(
          raw.registryManifest,
        ),
        activeWriter: ProviderActiveWriterSelectionV1Schema.parse(
          raw.activeWriter,
        ),
        registryEntryContentDigest: ContentDigestV1Schema.parse(
          raw.registryEntryContentDigest,
        ),
        grantSigner: Object.freeze({
          keyId: StoreProviderVerificationKeyIdV1Schema.parse(signer.keyId),
          publicKeyBytes: CanonicalPublicKeyBytes32V1Schema.parse(
            signer.publicKeyBytes,
          ),
          publicKeyDigest: Ed25519PublicKeyDigestV1Schema.parse(
            signer.publicKeyDigest,
          ),
        }),
        grantContentDigest: ContentDigestV1Schema.parse(raw.grantContentDigest),
        principalAttestationDigest: ContentDigestV1Schema.parse(
          raw.principalAttestationDigest,
        ),
        principalPublicKeyRaw32: CanonicalPublicKeyBytes32V1Schema.parse(
          raw.principalPublicKeyRaw32,
        ),
      });
    return certificate;
  } catch (error) {
    if (error instanceof ProviderStrongMutationTrustVerificationErrorInternalV1) {
      throw error;
    }
    return failV1("evidence");
  }
}

function requireVerifierStateV1(
  capability: ProviderStrongMutationTrustVerifierCapabilityInternalV1,
): ProviderStrongMutationTrustVerifierStateInternalV1 {
  const state = verifierStatesV1.get(capability as object);
  if (state === undefined) failV1("verifier_capability");
  return state;
}

/** Package-private brand check; no verifier state or crypto capability escapes. */
export function assertProviderStrongMutationTrustVerifierCapabilityInternalV1(
  capability: ProviderStrongMutationTrustVerifierCapabilityInternalV1,
): void {
  requireVerifierStateV1(capability);
}

/** Ephemeral per-lock/load cache; no evidence or result survives the session. */
export function createProviderStrongMutationTrustVerificationSessionInternalV1(
  verifierCapability:
    ProviderStrongMutationTrustVerifierCapabilityInternalV1,
): ProviderStrongMutationTrustVerificationSessionInternalV1 {
  requireVerifierStateV1(verifierCapability);
  const session = Object.freeze(Object.create(null)) as
    ProviderStrongMutationTrustVerificationSessionInternalV1;
  verificationSessionStatesV1.set(session, {
    verifierCapability,
    registryClosures: new Map(),
  });
  return session;
}

function registryClosureCacheKeyV1(input: Readonly<{
  installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  activeRootMetadata: ProviderRegistryRootMetadataPinV1;
  registryManifest: ProviderRegistryManifestPinV1;
}>): string {
  return canonicalizeJcsSafeIntegerV1({
    installationIdentityGenerationId:
      input.installationIdentityGenerationId,
    activeRootMetadata: input.activeRootMetadata,
    registryManifest: input.registryManifest,
  });
}

function requireVerificationSessionStateV1(input: Readonly<{
  verifierCapability:
    ProviderStrongMutationTrustVerifierCapabilityInternalV1;
  verificationSession?:
    ProviderStrongMutationTrustVerificationSessionInternalV1;
}>): ProviderStrongMutationTrustVerificationSessionStateInternalV1 | undefined {
  if (input.verificationSession === undefined) return undefined;
  const sessionState = verificationSessionStatesV1.get(
    input.verificationSession as object,
  );
  if (
    sessionState === undefined ||
    sessionState.verifierCapability !== input.verifierCapability
  ) failV1("verifier_capability");
  return sessionState;
}

export async function verifyProviderStrongMutationBeginTrustInternalV1(
  capability: ProviderStrongMutationTrustVerifierCapabilityInternalV1,
  input: Readonly<{
    readonly acceptanceHistory:
      ProviderStrongMutationVerifiedAcceptanceHistoryInternalV1;
    readonly request: ProviderRuntimeIpcStrongMutationRequestV1;
    /** Kernel-authenticated runtime supplied this exact challenge transcript. */
    readonly principalAttestation?: ProviderRuntimeIpcPrincipalAttestationV1;
    readonly verificationSession?:
      ProviderStrongMutationTrustVerificationSessionInternalV1;
  }>,
): Promise<Readonly<{
  readonly certificate: ProviderStrongMutationVerificationCertificateInternalV1;
  readonly principalAttestation: ProviderRuntimeIpcPrincipalAttestationV1;
}>> {
  const state = requireVerifierStateV1(capability);
  let request: ProviderRuntimeIpcStrongMutationRequestV1;
  try {
    request = ProviderRuntimeIpcStrongMutationRequestV1Schema.parse(
      snapshotJsonDataV1(input.request, "request"),
    );
  } catch {
    return failV1("request");
  }
  const grant = parseProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1(
    request.authorityGrant,
  );
  const requestClaims = request.operation === "write_object"
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
  const computedRequestDigest = ContentDigestV1Schema.parse(
    sha256DigestInternalV1(
      canonicalizeProviderRuntimeIpcStrongMutationRequestV1(requestClaims),
    ),
  );
  const computedBindingDigest = ContentDigestV1Schema.parse(
    sha256DigestInternalV1(
      canonicalizeProviderRuntimeIpcStrongMutationSessionBindingV1({
        principalAttestationDigest: request.principalAttestationDigest,
        operation: request.operation,
        operationNonce: request.operationNonce,
        requestDigest: request.requestDigest,
        authorityGrant: request.authorityGrant,
      }),
    ),
  );
  if (
    request.requestDigest !== computedRequestDigest ||
    request.bindingDigest !== computedBindingDigest ||
    grant.payload.principalAttestationDigest !==
      request.principalAttestationDigest ||
    grant.payload.operation !== request.operation ||
    grant.payload.operationNonce !== request.operationNonce ||
    grant.payload.requestDigest !== request.requestDigest
  ) failV1("request");
  const acceptanceIdentity = grant.payload.acceptanceIdentity;
  const acceptance = findHistoricalStrongReadyAcceptanceV1(
    input.acceptanceHistory,
    acceptanceIdentity,
  );
  if (acceptance.payload.configuration.state !== "strong_ready") {
    failV1("acceptance_history");
  }
  const core = acceptance.payload.configuration.core;
  const sessionState = requireVerificationSessionStateV1({
    verifierCapability: capability,
    verificationSession: input.verificationSession,
  });
  const cacheKey = registryClosureCacheKeyV1({
    installationIdentityGenerationId:
      input.acceptanceHistory.installationIdentityGenerationId,
    activeRootMetadata: core.activeRootMetadata,
    registryManifest: grant.payload.registryManifest,
  });
  const cachedRegistryClosure = sessionState?.registryClosures.get(cacheKey);
  const query: ProviderStrongMutationTrustEvidenceQueryInternalV1 =
    Object.freeze({
      profile: EVIDENCE_QUERY_PROFILE_V1,
      grantId: grant.grantId,
      grantContentDigest: grant.contentDigest,
      // Detached copies prevent the transport callback from retaining and
      // mutating request-owned objects after verification.
      acceptanceIdentity:
        ProviderRuntimeIpcAcceptanceIdentityProofV1Schema.parse(
          snapshotJsonDataV1(acceptanceIdentity, "request"),
        ),
      registryManifest: ProviderRegistryManifestPinV1Schema.parse(
        snapshotJsonDataV1(grant.payload.registryManifest, "request"),
      ),
      principalAttestationDigest: grant.payload.principalAttestationDigest,
    });
  let evidence: ParsedProviderStrongMutationTrustEvidenceInternalV1;
  try {
    evidence = parseEvidenceV1(
      await Reflect.apply(state.readEvidence, undefined, [query]),
      cachedRegistryClosure === undefined,
      input.principalAttestation,
    );
  } catch (error) {
    if (error instanceof ProviderStrongMutationTrustVerificationErrorInternalV1) {
      throw error;
    }
    return failV1("evidence");
  }
  let registryClosure = cachedRegistryClosure;
  if (registryClosure === undefined) {
    const registryHistory = evidence.registryHistory;
    if (registryHistory === undefined) failV1("registry_history");
    try {
      registryClosure = await validateProviderRegistryManifestHistoryV1({
        installationIdentityGenerationId:
          input.acceptanceHistory.installationIdentityGenerationId,
        bootstrapTrustBundle: registryHistory.bootstrapTrustBundle,
        rootMetadataHistory: registryHistory.rootMetadataHistory,
        registryManifestHistory: registryHistory.registryManifestHistory,
        strictCryptoCapability: state.strictCryptoCapability,
      });
    } catch {
      return failV1("registry_history");
    }
  }
  if (
    registryClosure.authority !== "none_registry_structure_and_history_only" ||
    registryClosure.installationIdentityGenerationId !==
      acceptance.installationIdentityGenerationId ||
    !canonicalEqualV1(core.activeRootMetadata, registryClosure.currentRootMetadata) ||
    !canonicalEqualV1(
      core.providerRegistryManifest,
      registryClosure.currentRegistryManifest,
    ) ||
    !canonicalEqualV1(
      grant.payload.registryManifest,
      registryClosure.currentRegistryManifest,
    )
  ) failV1("registry_binding");
  const currentManifest = registryClosure.registryManifestHistory.at(-1);
  if (
    currentManifest === undefined ||
    currentManifest.generationId !== grant.payload.registryManifest.generationId ||
    currentManifest.contentDigest !== grant.payload.registryManifest.contentDigest ||
    currentManifest.payload.manifestGeneration !==
      grant.payload.registryManifest.manifestGeneration
  ) failV1("registry_binding");
  if (cachedRegistryClosure === undefined) {
    sessionState?.registryClosures.set(cacheKey, registryClosure);
  }
  const member = currentManifest.payload.members.find(
    (candidate) => candidate.providerId === grant.payload.providerId,
  );
  if (member === undefined || member.disposition !== "enabled") {
    failV1("grant_key");
  }
  const entry = member.registryEntry;
  const registryEntryContentDigest =
    deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(entry);
  const selections = core.activeWriterSelector.selections.filter(
    (selection) => selection.targetProfileId === grant.payload.targetProfileId,
  );
  if (selections.length !== 1) failV1("active_writer");
  const activeWriter = selections[0]!;
  if (
    activeWriter.providerId !== grant.payload.providerId ||
    activeWriter.registryEntryContentDigest !== member.registryEntryContentDigest ||
    activeWriter.registryEntryContentDigest !== registryEntryContentDigest ||
    activeWriter.semanticProviderPolicyDigest !== entry.semanticProviderPolicyDigest ||
    !canonicalEqualV1(
      activeWriter.providerFeasibilityEvidence,
      entry.providerFeasibilityEvidence,
    ) ||
    activeWriter.runtimeAttestationContentDigest !==
      entry.runtimeAttestation.contentDigest ||
    activeWriter.bindingDerivationKeyGeneration !==
      entry.verificationKeys.activeBindingDerivationKeyGeneration
  ) failV1("active_writer");
  const activeKeyId =
    entry.verificationKeys.activeKeyIds.strongMutationAuthorityGrant;
  if (
    entry.providerId !== grant.payload.providerId ||
    entry.installationIdentityGenerationId !==
      acceptance.installationIdentityGenerationId ||
    activeKeyId === undefined ||
    activeKeyId !== grant.payload.signerKeyId ||
    entry.verificationKeys.compromisedRevokedKeyIds.includes(activeKeyId)
  ) failV1("grant_key");
  const grantKeyRecords = entry.verificationKeys.publicKeyRecords.filter(
    (record) => record.providerId === grant.payload.providerId &&
      record.usage === "strong_mutation_authority_grant" &&
      record.keyId === activeKeyId &&
      record.algorithm === "ed25519",
  );
  if (grantKeyRecords.length !== 1) failV1("grant_key");
  const grantKey = grantKeyRecords[0]!;
  let grantSignatureVerified = false;
  try {
    grantSignatureVerified = await verifyRawEd25519WithCapabilityV1(
      state.strictCryptoCapability,
      decodeCanonicalBytesV1(grantKey.publicKeyBytes, 32, "grant_key"),
      createProviderRuntimeIpcStrongMutationAuthorityGrantSignatureMessageV1(
        grant.payload,
      ),
      decodeCanonicalBytesV1(grant.payload.signature, 64, "grant_signature"),
    );
  } catch {
    return failV1("grant_signature");
  }
  if (!grantSignatureVerified) failV1("grant_signature");

  const attestation = evidence.principalAttestation;
  const transcriptDigest = ContentDigestV1Schema.parse(
    sha256DigestInternalV1(
      canonicalizeProviderRuntimeIpcPrincipalAttestationTranscriptV1(
        attestation,
      ),
    ),
  );
  if (
    transcriptDigest !== grant.payload.principalAttestationDigest ||
    transcriptDigest !== request.principalAttestationDigest ||
    attestation.providerId !== grant.payload.providerId ||
    attestation.capabilityDigest !== grant.payload.capabilityDigest ||
    attestation.connectionNonce === undefined ||
    attestation.revision !== grant.payload.journalHead.revision ||
    attestation.phase !== grant.payload.journalHead.phase ||
    attestation.mutationDigest !== grant.payload.journalHead.mutationDigest ||
    attestation.acceptanceIdentity === undefined ||
    !exactAcceptanceIdentityV1(
      attestation.acceptanceIdentity,
      grant.payload.acceptanceIdentity,
    )
  ) failV1("principal_attestation");
  const principalRawKey = principalRawKeyV1(attestation);
  let principalSignatureVerified = false;
  try {
    principalSignatureVerified = await verifyRawEd25519WithCapabilityV1(
      state.strictCryptoCapability,
      principalRawKey,
      canonicalizeProviderRuntimeIpcPrincipalAttestationClaimsV1(
        principalClaimsV1(attestation),
      ),
      decodeCanonicalBytesV1(
        attestation.signature,
        64,
        "principal_signature",
      ),
    );
  } catch {
    return failV1("principal_signature");
  }
  if (!principalSignatureVerified) failV1("principal_signature");

  const certificate = Object.freeze({
    profile: VERIFICATION_CERTIFICATE_PROFILE_V1,
    verificationAlgorithm: VERIFICATION_ALGORITHM_V1,
    acceptanceIdentity,
    activeRootMetadata: registryClosure.currentRootMetadata,
    registryManifest: registryClosure.currentRegistryManifest,
    activeWriter,
    registryEntryContentDigest,
    grantSigner: Object.freeze({
      keyId: grantKey.keyId,
      publicKeyBytes: grantKey.publicKeyBytes,
      publicKeyDigest: grantKey.publicKeyDigest,
    }),
    grantContentDigest: grant.contentDigest,
    principalAttestationDigest: transcriptDigest,
    principalPublicKeyRaw32: canonicalBytesV1(principalRawKey),
  }) satisfies ProviderStrongMutationVerificationCertificateInternalV1;
  return Object.freeze({ certificate, principalAttestation: attestation });
}

export async function verifyProviderStrongMutationResponseTrustInternalV1(
  capability: ProviderStrongMutationTrustVerifierCapabilityInternalV1,
  input: Readonly<{
    readonly certificate: ProviderStrongMutationVerificationCertificateInternalV1;
    readonly principalAttestation: ProviderRuntimeIpcPrincipalAttestationV1;
    readonly response: ProviderRuntimeIpcStrongMutationResponseV1;
  }>,
): Promise<typeof PROVIDER_STRONG_MUTATION_TRUST_VERIFICATION_MARKERS_INTERNAL_V1.response> {
  const state = requireVerifierStateV1(capability);
  let response: ProviderRuntimeIpcStrongMutationResponseV1;
  let attestation: ProviderRuntimeIpcPrincipalAttestationV1;
  let certificate: ProviderStrongMutationVerificationCertificateInternalV1;
  try {
    response = ProviderRuntimeIpcStrongMutationResponseV1Schema.parse(input.response);
    attestation = ProviderRuntimeIpcPrincipalAttestationV1Schema.parse(
      input.principalAttestation,
    );
    certificate = parseProviderStrongMutationVerificationCertificateInternalV1(
      input.certificate,
    );
  } catch {
    return failV1("response_signature");
  }
  const principalRawKey = principalRawKeyV1(attestation);
  const attestationTranscriptDigest = ContentDigestV1Schema.parse(
    sha256DigestInternalV1(
      canonicalizeProviderRuntimeIpcPrincipalAttestationTranscriptV1(
        attestation,
      ),
    ),
  );
  if (
    canonicalBytesV1(principalRawKey) !== certificate.principalPublicKeyRaw32 ||
    attestationTranscriptDigest !== certificate.principalAttestationDigest ||
    response.principalAttestationDigest !==
      certificate.principalAttestationDigest
  ) failV1("response_signature");
  let verified = false;
  try {
    verified = await verifyRawEd25519WithCapabilityV1(
      state.strictCryptoCapability,
      principalRawKey,
      canonicalizeProviderRuntimeIpcStrongMutationResponseClaimsV1(response),
      decodeCanonicalBytesV1(response.signature, 64, "response_signature"),
    );
  } catch {
    return failV1("response_signature");
  }
  if (!verified) failV1("response_signature");
  return PROVIDER_STRONG_MUTATION_TRUST_VERIFICATION_MARKERS_INTERNAL_V1.response;
}
