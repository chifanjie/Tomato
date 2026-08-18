/**
 * Runtime-private, read-only verifier for a strong-mutation authority grant.
 *
 * This module deliberately stops at a locked candidate. The available
 * Installation Acceptance filesystem reader has process-observed rollback
 * resistance only and explicitly carries no write authority. Consequently a
 * successful signature/currentness check here MUST NOT mint a mutation
 * session or consume a replay ledger.
 */

import {
  deriveStoreDurableObjectProviderRegistryEntryContentDigestV1,
  validateProviderRegistryManifestHistoryV1,
  type ValidateProviderRegistryManifestHistoryV1Input,
} from "@understand-code/durable-object-provider-contracts";
import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";
import type {
  ContentDigestV1,
  DurableObjectIdentityProviderIdV1,
} from "@understand-code/durable-object-provider-contracts/primitives";
import {
  createProviderRuntimeIpcStrongMutationAuthorityGrantSignatureMessageV1,
  parseProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1,
  type ProviderRuntimeIpcAcceptanceIdentityProofV1,
  type ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-ipc-v1";
import {
  ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
  type ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
} from "@understand-code/durable-object-provider-contracts/provider-strong-ready-acceptance-candidate";
import {
  verifyRawEd25519WithCapabilityV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "@understand-code/durable-object-provider-contracts/strict-ed25519-conformance";

import {
  diagnoseProviderInstallationAcceptanceStoreSubstrateExpectedCurrentV1,
  type ProviderInstallationAcceptanceStoreSubstrateReaderCapabilityV1,
} from "./installation-acceptance-store-substrate.js";

export const PROVIDER_RUNTIME_STRONG_MUTATION_AUTHORITY_GRANT_CANDIDATE_REQUIRED_NEXT_INTERNAL_V1 =
  "root_os_production_current_authority_and_durable_replay_consume" as const;

declare const providerRuntimeStrongMutationAuthorityGrantCandidateResolverBrandV1:
  unique symbol;
export interface ProviderRuntimeStrongMutationAuthorityGrantCandidateResolverCapabilityInternalV1 {
  readonly [providerRuntimeStrongMutationAuthorityGrantCandidateResolverBrandV1]: true;
}

type RegistryHistoryEvidenceInternalV1 = Omit<
  ValidateProviderRegistryManifestHistoryV1Input,
  "strictCryptoCapability"
>;

interface CandidateEvidenceInternalV1 {
  readonly acceptanceEnvelope:
    ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1;
  readonly registryHistory: RegistryHistoryEvidenceInternalV1;
}

export interface MintProviderRuntimeStrongMutationAuthorityGrantCandidateResolverCapabilityInternalV1Input {
  /** Opaque read-only observer; its `authority: none` status is preserved. */
  readonly acceptanceReaderCapability:
    ProviderInstallationAcceptanceStoreSubstrateReaderCapabilityV1;
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
  /**
   * Evidence transport only. Returned JSON is fully re-parsed, hashed, joined
   * to the opaque Acceptance observation, and cryptographically validated; the
   * callback itself is never treated as an authority.
   */
  readonly readUntrustedEvidence: () => unknown | Promise<unknown>;
}

interface CandidateResolverStateInternalV1 {
  readonly acceptanceReaderCapability:
    ProviderInstallationAcceptanceStoreSubstrateReaderCapabilityV1;
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
  readonly readUntrustedEvidence:
    MintProviderRuntimeStrongMutationAuthorityGrantCandidateResolverCapabilityInternalV1Input["readUntrustedEvidence"];
}

const resolverStatesV1 = new WeakMap<
  object,
  CandidateResolverStateInternalV1
>();

export interface ProviderRuntimeStrongMutationAuthorityGrantCandidateContextInternalV1 {
  readonly providerId: DurableObjectIdentityProviderIdV1;
  readonly targetProfileId:
    ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1["payload"]["targetProfileId"];
  readonly targetFingerprintDigest: ContentDigestV1;
  readonly capabilityDigest: ContentDigestV1;
  readonly principalAttestationDigest: ContentDigestV1;
  readonly operation:
    ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1["payload"]["operation"];
  readonly operationNonce: string;
  readonly requestDigest: ContentDigestV1;
  readonly journalHead: Readonly<{
    readonly revision: number;
    readonly phase: string;
    readonly mutationDigest: ContentDigestV1 | "none";
  }>;
  readonly acceptanceIdentity: ProviderRuntimeIpcAcceptanceIdentityProofV1;
  readonly authorityGrant:
    ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1;
}

export interface ProviderRuntimeStrongMutationAuthorityGrantLockedCandidateInternalV1 {
  readonly status:
    "provider_runtime_strong_mutation_authority_grant_candidate";
  readonly authority: "none";
  readonly accessMode: "read_only";
  readonly strongWriteStatus: "locked";
  readonly cryptographicGrantStatus:
    "strict_ed25519_signature_and_exact_claims_verified";
  readonly currentBinding:
    "process_observed_acceptance_and_acceptance_pinned_registry";
  readonly crossRestartRollbackResistance: "not_established";
  readonly replayStatus: "not_consumed";
  readonly grantId:
    ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1["grantId"];
  readonly requiredNext:
    typeof PROVIDER_RUNTIME_STRONG_MUTATION_AUTHORITY_GRANT_CANDIDATE_REQUIRED_NEXT_INTERNAL_V1;
}

export type ProviderRuntimeStrongMutationAuthorityGrantCandidateDiagnosticInternalV1 =
  | Readonly<{
      readonly ok: true;
      readonly value:
        ProviderRuntimeStrongMutationAuthorityGrantLockedCandidateInternalV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly code: "provider_unavailable";
      readonly reason: "attestation_invalid";
      readonly stage:
        | "resolver_capability"
        | "evidence"
        | "server_binding"
        | "acceptance_identity"
        | "acceptance_current"
        | "registry_history"
        | "registry_binding"
        | "active_writer_selection"
        | "active_grant_key"
        | "grant_signature";
    }>;

type CandidateFailureStageInternalV1 = Extract<
  ProviderRuntimeStrongMutationAuthorityGrantCandidateDiagnosticInternalV1,
  { readonly ok: false }
>["stage"];

class CandidateFailureInternalV1 extends Error {
  constructor(readonly stage: CandidateFailureStageInternalV1) {
    super("strong mutation authority grant candidate invalid");
  }
}

function failV1(stage: CandidateFailureStageInternalV1): never {
  throw new CandidateFailureInternalV1(stage);
}

function failureV1(
  stage: CandidateFailureStageInternalV1,
): Extract<
  ProviderRuntimeStrongMutationAuthorityGrantCandidateDiagnosticInternalV1,
  { readonly ok: false }
> {
  return Object.freeze({
    ok: false as const,
    code: "provider_unavailable" as const,
    reason: "attestation_invalid" as const,
    stage,
  });
}

function requireExactDataRecordV1(
  input: unknown,
  keys: readonly string[],
  stage: CandidateFailureStageInternalV1,
): Record<string, unknown> {
  if (
    input === null ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    (Object.getPrototypeOf(input) !== Object.prototype &&
      Object.getPrototypeOf(input) !== null)
  ) failV1(stage);
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const ownKeys = Object.keys(descriptors);
  if (
    Object.getOwnPropertySymbols(input).length !== 0 ||
    ownKeys.length !== keys.length ||
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
  input: unknown,
  stage: CandidateFailureStageInternalV1,
  state: JsonSnapshotStateInternalV1 = { seen: new WeakSet(), nodes: 0 },
  depth = 0,
): unknown {
  state.nodes += 1;
  if (state.nodes > 100_000 || depth > 128) failV1(stage);
  if (
    input === null ||
    typeof input === "string" ||
    typeof input === "boolean"
  ) return input;
  if (typeof input === "number") {
    if (!Number.isSafeInteger(input)) failV1(stage);
    return input;
  }
  if (typeof input !== "object" || state.seen.has(input)) failV1(stage);
  state.seen.add(input);
  if (Object.getOwnPropertySymbols(input).length !== 0) failV1(stage);
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Array.isArray(input)) {
    if (Object.getPrototypeOf(input) !== Array.prototype) failV1(stage);
    const lengthDescriptor = descriptors.length;
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      Object.keys(descriptors).length !== lengthDescriptor.value + 1
    ) failV1(stage);
    const result: unknown[] = [];
    for (let index = 0; index < lengthDescriptor.value; index += 1) {
      const descriptor = descriptors[String(index)];
      if (descriptor === undefined || !("value" in descriptor)) failV1(stage);
      result.push(snapshotJsonDataV1(
        descriptor.value,
        stage,
        state,
        depth + 1,
      ));
    }
    return result;
  }
  if (
    Object.getPrototypeOf(input) !== Object.prototype &&
    Object.getPrototypeOf(input) !== null
  ) failV1(stage);
  const result: Record<string, unknown> = Object.create(null);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!("value" in descriptor)) failV1(stage);
    result[key] = snapshotJsonDataV1(
      descriptor.value,
      stage,
      state,
      depth + 1,
    );
  }
  return result;
}

function parseEvidenceV1(input: unknown): CandidateEvidenceInternalV1 {
  const snapshot = snapshotJsonDataV1(input, "evidence");
  const evidence = requireExactDataRecordV1(
    snapshot,
    ["acceptanceEnvelope", "registryHistory"],
    "evidence",
  );
  const registry = requireExactDataRecordV1(
    evidence.registryHistory,
    [
      "installationIdentityGenerationId",
      "bootstrapTrustBundle",
      "rootMetadataHistory",
      "registryManifestHistory",
    ],
    "evidence",
  );
  return {
    acceptanceEnvelope:
      ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema.parse(
        evidence.acceptanceEnvelope,
      ),
    registryHistory: {
      installationIdentityGenerationId:
        registry.installationIdentityGenerationId as RegistryHistoryEvidenceInternalV1["installationIdentityGenerationId"],
      bootstrapTrustBundle:
        registry.bootstrapTrustBundle as RegistryHistoryEvidenceInternalV1["bootstrapTrustBundle"],
      rootMetadataHistory:
        registry.rootMetadataHistory as RegistryHistoryEvidenceInternalV1["rootMetadataHistory"],
      registryManifestHistory:
        registry.registryManifestHistory as RegistryHistoryEvidenceInternalV1["registryManifestHistory"],
    },
  };
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  return canonicalizeJcsSafeIntegerV1(left) ===
    canonicalizeJcsSafeIntegerV1(right);
}

function acceptanceIdentityMatchesV1(
  envelope: ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
  expected: ProviderRuntimeIpcAcceptanceIdentityProofV1,
): boolean {
  const payload = envelope.payload;
  const generationId = deriveProviderStrongReadyAcceptanceStateGenerationIdV1({
    installationIdentityGenerationId:
      payload.installationIdentityGenerationId,
    acceptanceOrdinal: payload.acceptanceOrdinal,
    predecessor: payload.predecessor,
    configuration: payload.configuration,
  });
  const contentDigest =
    deriveProviderStrongReadyAcceptanceStateContentDigestV1(payload);
  return envelope.generationId === payload.generationId &&
    envelope.installationIdentityGenerationId ===
      payload.installationIdentityGenerationId &&
    envelope.acceptedAt === payload.acceptedAt &&
    envelope.generationId === generationId &&
    envelope.contentDigest === contentDigest &&
    expected.generationId === envelope.generationId &&
    expected.contentDigest === envelope.contentDigest &&
    expected.acceptanceOrdinal === payload.acceptanceOrdinal &&
    expected.installationIdentityGenerationId ===
      envelope.installationIdentityGenerationId;
}

function claimsMatchServerContextV1(
  envelope: ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1,
  context: ProviderRuntimeStrongMutationAuthorityGrantCandidateContextInternalV1,
): boolean {
  const claims = envelope.payload;
  const expectedAcceptance = context.acceptanceIdentity;
  return claims.providerId === context.providerId &&
    claims.targetProfileId === context.targetProfileId &&
    claims.targetFingerprintDigest === context.targetFingerprintDigest &&
    claims.capabilityDigest === context.capabilityDigest &&
    claims.principalAttestationDigest ===
      context.principalAttestationDigest &&
    claims.operation === context.operation &&
    claims.operationNonce === context.operationNonce &&
    claims.requestDigest === context.requestDigest &&
    claims.journalHead.revision === context.journalHead.revision &&
    claims.journalHead.phase === context.journalHead.phase &&
    claims.journalHead.mutationDigest ===
      context.journalHead.mutationDigest &&
    claims.acceptanceIdentity.generationId ===
      expectedAcceptance.generationId &&
    claims.acceptanceIdentity.contentDigest ===
      expectedAcceptance.contentDigest &&
    claims.acceptanceIdentity.acceptanceOrdinal ===
      expectedAcceptance.acceptanceOrdinal &&
    claims.acceptanceIdentity.installationIdentityGenerationId ===
      expectedAcceptance.installationIdentityGenerationId;
}

function decodeCanonicalBytesV1(value: string, expectedLength: number): Uint8Array {
  if (!value.startsWith("base64url:")) failV1("grant_signature");
  const decoded = Uint8Array.from(
    Buffer.from(value.slice("base64url:".length), "base64url"),
  );
  if (decoded.byteLength !== expectedLength) failV1("grant_signature");
  return decoded;
}

/** Internal registration seam; absent from the runtime package exports. */
export function mintProviderRuntimeStrongMutationAuthorityGrantCandidateResolverCapabilityInternalV1(
  input: MintProviderRuntimeStrongMutationAuthorityGrantCandidateResolverCapabilityInternalV1Input,
): ProviderRuntimeStrongMutationAuthorityGrantCandidateResolverCapabilityInternalV1 {
  if (
    input === null ||
    typeof input !== "object" ||
    (typeof input.acceptanceReaderCapability !== "object" &&
      typeof input.acceptanceReaderCapability !== "function") ||
    (typeof input.strictCryptoCapability !== "object" &&
      typeof input.strictCryptoCapability !== "function") ||
    typeof input.readUntrustedEvidence !== "function"
  ) throw new TypeError("strong mutation authority grant candidate resolver invalid");
  const capability = Object.freeze(Object.create(null)) as
    ProviderRuntimeStrongMutationAuthorityGrantCandidateResolverCapabilityInternalV1;
  resolverStatesV1.set(capability, {
    acceptanceReaderCapability: input.acceptanceReaderCapability,
    strictCryptoCapability: input.strictCryptoCapability,
    readUntrustedEvidence: input.readUntrustedEvidence,
  });
  return capability;
}

/**
 * Verify exact claims, current process-observed Acceptance, its exact Registry
 * pin, the complete Root-signed Registry history, the active usage-separated
 * key, and the strict Ed25519 signature. Success remains non-authoritative.
 */
export async function diagnoseProviderRuntimeStrongMutationAuthorityGrantCandidateInternalV1(
  resolver:
    ProviderRuntimeStrongMutationAuthorityGrantCandidateResolverCapabilityInternalV1,
  context: ProviderRuntimeStrongMutationAuthorityGrantCandidateContextInternalV1,
): Promise<ProviderRuntimeStrongMutationAuthorityGrantCandidateDiagnosticInternalV1> {
  const state = resolverStatesV1.get(resolver as object);
  if (state === undefined) return failureV1("resolver_capability");
  try {
    let envelope: ProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1;
    try {
      envelope = parseProviderRuntimeIpcStrongMutationAuthorityGrantEnvelopeV1(
        snapshotJsonDataV1(context.authorityGrant, "server_binding"),
      );
    } catch {
      return failureV1("server_binding");
    }
    if (!claimsMatchServerContextV1(envelope, context)) {
      return failureV1("server_binding");
    }

    let evidence: CandidateEvidenceInternalV1;
    try {
      const transported = Reflect.apply(
        state.readUntrustedEvidence,
        undefined,
        [],
      ) as unknown | Promise<unknown>;
      evidence = parseEvidenceV1(await transported);
    } catch {
      return failureV1("evidence");
    }
    if (
      !acceptanceIdentityMatchesV1(
        evidence.acceptanceEnvelope,
        envelope.payload.acceptanceIdentity,
      )
    ) return failureV1("acceptance_identity");

    const current =
      await diagnoseProviderInstallationAcceptanceStoreSubstrateExpectedCurrentV1(
        state.acceptanceReaderCapability,
        {
          installationIdentityGenerationId:
            envelope.payload.acceptanceIdentity
              .installationIdentityGenerationId,
          acceptanceOrdinal:
            envelope.payload.acceptanceIdentity.acceptanceOrdinal,
          acceptanceGenerationId:
            envelope.payload.acceptanceIdentity.generationId,
          acceptanceContentDigest:
            envelope.payload.acceptanceIdentity.contentDigest,
        },
      );
    if (
      !current.ok ||
      current.value.authority !== "none" ||
      current.value.accessMode !== "read_only" ||
      current.value.strongWriteStatus !== "locked" ||
      current.value.rollbackResistance !==
        "process_observed_high_water_only" ||
      current.value.crossRestartRollbackResistance !== "not_established"
    ) return failureV1("acceptance_current");

    let registryClosure;
    try {
      registryClosure = await validateProviderRegistryManifestHistoryV1({
        ...evidence.registryHistory,
        strictCryptoCapability: state.strictCryptoCapability,
      });
    } catch {
      return failureV1("registry_history");
    }
    const acceptanceCore =
      evidence.acceptanceEnvelope.payload.configuration.core;
    const grantRegistryPin = envelope.payload.registryManifest;
    if (
      registryClosure.authority !==
        "none_registry_structure_and_history_only" ||
      registryClosure.installationIdentityGenerationId !==
        evidence.acceptanceEnvelope.installationIdentityGenerationId ||
      !canonicalEqualV1(
        acceptanceCore.activeRootMetadata,
        registryClosure.currentRootMetadata,
      ) ||
      !canonicalEqualV1(
        acceptanceCore.providerRegistryManifest,
        registryClosure.currentRegistryManifest,
      ) ||
      !canonicalEqualV1(grantRegistryPin, registryClosure.currentRegistryManifest)
    ) return failureV1("registry_binding");

    const currentManifest = registryClosure.registryManifestHistory.at(-1);
    if (
      currentManifest === undefined ||
      currentManifest.generationId !== grantRegistryPin.generationId ||
      currentManifest.contentDigest !== grantRegistryPin.contentDigest ||
      currentManifest.payload.manifestGeneration !==
        grantRegistryPin.manifestGeneration
    ) return failureV1("registry_binding");
    const member = currentManifest.payload.members.find(
      (candidate) => candidate.providerId === envelope.payload.providerId,
    );
    if (member === undefined || member.disposition !== "enabled") {
      return failureV1("active_grant_key");
    }
    const entry = member.registryEntry;
    const entryContentDigest =
      deriveStoreDurableObjectProviderRegistryEntryContentDigestV1(entry);
    const selections = acceptanceCore.activeWriterSelector.selections.filter(
      (selection) =>
        selection.targetProfileId === envelope.payload.targetProfileId,
    );
    if (selections.length !== 1) {
      return failureV1("active_writer_selection");
    }
    const selection = selections[0]!;
    if (
      selection.providerId !== envelope.payload.providerId ||
      selection.registryEntryContentDigest !==
        member.registryEntryContentDigest ||
      selection.registryEntryContentDigest !== entryContentDigest ||
      selection.semanticProviderPolicyDigest !==
        entry.semanticProviderPolicyDigest ||
      !canonicalEqualV1(
        selection.providerFeasibilityEvidence,
        entry.providerFeasibilityEvidence,
      ) ||
      selection.runtimeAttestationContentDigest !==
        entry.runtimeAttestation.contentDigest ||
      selection.bindingDerivationKeyGeneration !==
        entry.verificationKeys.activeBindingDerivationKeyGeneration
    ) return failureV1("active_writer_selection");
    const verificationKeys = entry.verificationKeys;
    const activeKeyId =
      verificationKeys.activeKeyIds.strongMutationAuthorityGrant;
    if (
      entry.providerId !== envelope.payload.providerId ||
      entry.installationIdentityGenerationId !==
        evidence.acceptanceEnvelope.installationIdentityGenerationId ||
      activeKeyId === undefined ||
      activeKeyId !== envelope.payload.signerKeyId ||
      verificationKeys.compromisedRevokedKeyIds.includes(activeKeyId)
    ) return failureV1("active_grant_key");
    const records = verificationKeys.publicKeyRecords.filter(
      (record) =>
        record.providerId === envelope.payload.providerId &&
        record.usage === "strong_mutation_authority_grant" &&
        record.keyId === activeKeyId &&
        record.algorithm === "ed25519",
    );
    if (records.length !== 1) return failureV1("active_grant_key");
    const record = records[0]!;
    let verified: boolean;
    try {
      verified = await verifyRawEd25519WithCapabilityV1(
        state.strictCryptoCapability,
        decodeCanonicalBytesV1(record.publicKeyBytes, 32),
        createProviderRuntimeIpcStrongMutationAuthorityGrantSignatureMessageV1(
          envelope.payload,
        ),
        decodeCanonicalBytesV1(envelope.payload.signature, 64),
      );
    } catch {
      return failureV1("grant_signature");
    }
    if (!verified) return failureV1("grant_signature");

    return Object.freeze({
      ok: true as const,
      value: Object.freeze({
        status:
          "provider_runtime_strong_mutation_authority_grant_candidate" as const,
        authority: "none" as const,
        accessMode: "read_only" as const,
        strongWriteStatus: "locked" as const,
        cryptographicGrantStatus:
          "strict_ed25519_signature_and_exact_claims_verified" as const,
        currentBinding:
          "process_observed_acceptance_and_acceptance_pinned_registry" as const,
        crossRestartRollbackResistance: "not_established" as const,
        replayStatus: "not_consumed" as const,
        grantId: envelope.grantId,
        requiredNext:
          PROVIDER_RUNTIME_STRONG_MUTATION_AUTHORITY_GRANT_CANDIDATE_REQUIRED_NEXT_INTERNAL_V1,
      }),
    });
  } catch (error) {
    return failureV1(
      error instanceof CandidateFailureInternalV1
        ? error.stage
        : "evidence",
    );
  }
}
