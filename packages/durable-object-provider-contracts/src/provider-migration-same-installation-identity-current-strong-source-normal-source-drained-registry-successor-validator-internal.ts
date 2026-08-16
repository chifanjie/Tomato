/**
 * Package-private verifier for an externally Root-signed rebinding ->
 * source_drained Registry direct successor. The zero-live continuation is the
 * only admissible authority input. This layer validates but does not publish.
 */

import { canonicalizeJcsSafeIntegerV1 } from "./jcs.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveRegistryContinuationInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-destination-universe-zero-live-reference-machine-internal.js";
import {
  verifyProviderMigrationExternallyRootSignedRegistryManifestEnvelopeInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-rebinding-registry-successor-validator-internal.js";
import {
  deepFreezeProviderPointDetachedDataTreeV1,
} from "./provider-point-raw-admission-internal.js";
import {
  ProviderRegistryManifestEnvelopeV1Schema,
  ProviderRegistryManifestPinV1Schema,
  deriveProviderRegistryManifestContentDigestV1,
  deriveProviderRegistryManifestGenerationIdV1,
  projectProviderRegistryManifestIdFieldsV1,
  type ProviderRegistryManifestEnvelopeV1,
  type ProviderRegistryManifestPinV1,
} from "./provider-registry-records.js";
import {
  validateProviderRegistryRootPublicKeyV1,
  type ProviderRegistryRootPublicKeyV1,
} from "./provider-registry-trust.js";
import type {
  ProviderStrictEd25519OpaqueCapabilityV1,
} from "./strict-ed25519-conformance.js";

const CapturedObjectCreateV1 = Object.create;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedWeakMapV1 = WeakMap;

declare const externallySignedSourceDrainedRegistrySourceBrandInternalV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSourceDrainedRegistryManifestSourceCapabilityInternalV1 {
  readonly [externallySignedSourceDrainedRegistrySourceBrandInternalV1]: true;
}

export interface MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSourceDrainedRegistryManifestSourceCapabilityInternalV1Input {
  readonly externallySignedManifestEnvelope:
    ProviderRegistryManifestEnvelopeV1;
  readonly activeRoot: ProviderRegistryRootPublicKeyV1;
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
}

interface SignedSourceContextInternalV1 {
  readonly envelope: ProviderRegistryManifestEnvelopeV1;
  readonly activeRoot: ProviderRegistryRootPublicKeyV1;
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
}

const signedSourceContextsInternalV1 = new CapturedWeakMapV1<
  object,
  SignedSourceContextInternalV1
>();

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorCandidateValidationInternalV1 {
  readonly authority: "none";
  readonly durability: "none";
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_source_drained_registry_successor_candidate_validation_v1";
  readonly relationship: "externally_root_signed_direct_successor_of_published_rebinding_registry_tip_source_drained_candidate_after_exact_zero_live_not_current_or_published_v1";
  readonly installationIdentityGenerationId: string;
  readonly formalMigrationId: string;
  readonly sourceProviderId: string;
  readonly destinationProviderId: string;
  readonly currentRebindingRegistryManifestEnvelope:
    ProviderRegistryManifestEnvelopeV1;
  readonly currentRebindingRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly sourceDrainedRegistryManifestEnvelope:
    ProviderRegistryManifestEnvelopeV1;
  readonly sourceDrainedRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly zeroLiveProofContentDigest: string;
  readonly destinationUniverseContentDigest: string;
  readonly completeDestinationPublicationReceiptSetDigest: string;
  readonly rootSignatureVerificationCount: 1;
  readonly memberSetPreserved: true;
  readonly registryEntryAndKeyMaterialPreserved: true;
  readonly exactZeroLiveClosureVerified: true;
  readonly registryManifestPublicationCount: 0;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorCandidateDiagnosticInternalV1 =
  | Readonly<{
      readonly ok: true;
      readonly value:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorCandidateValidationInternalV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage:
        | "input"
        | "zero_live"
        | "current_registry"
        | "manifest_envelope"
        | "manifest_predecessor"
        | "routing"
        | "member_set"
        | "manifest_signature";
      readonly reason:
        | "capability_invalid"
        | "schema_invalid"
        | "zero_live_invalid"
        | "current_not_rebinding"
        | "generation_not_contiguous"
        | "predecessor_pin_mismatch"
        | "envelope_mismatch"
        | "routing_invalid"
        | "members_changed"
        | "signature_invalid";
    }>;

function failureV1(
  stage: Extract<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorCandidateDiagnosticInternalV1,
    { readonly ok: false }
  >["stage"],
  reason: Extract<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorCandidateDiagnosticInternalV1,
    { readonly ok: false }
  >["reason"],
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorCandidateDiagnosticInternalV1 {
  return CapturedObjectFreezeV1({ ok: false as const, stage, reason });
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  return canonicalizeJcsSafeIntegerV1(left) ===
    canonicalizeJcsSafeIntegerV1(right);
}

function pinV1(
  envelope: ProviderRegistryManifestEnvelopeV1,
): ProviderRegistryManifestPinV1 {
  return deepFreezeProviderPointDetachedDataTreeV1(
    ProviderRegistryManifestPinV1Schema.parse({
      locatorProfile: "installation_provider_registry_manifest_v1",
      manifestGeneration: envelope.payload.manifestGeneration,
      generationId: envelope.generationId,
      contentDigest: envelope.contentDigest,
    }),
  );
}

export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSourceDrainedRegistryManifestSourceCapabilityInternalV1(
  input: MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSourceDrainedRegistryManifestSourceCapabilityInternalV1Input,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSourceDrainedRegistryManifestSourceCapabilityInternalV1 {
  const envelope = deepFreezeProviderPointDetachedDataTreeV1(
    ProviderRegistryManifestEnvelopeV1Schema.parse(
      input.externallySignedManifestEnvelope,
    ),
  );
  const activeRoot = deepFreezeProviderPointDetachedDataTreeV1(
    validateProviderRegistryRootPublicKeyV1(input.activeRoot),
  );
  const capability = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSourceDrainedRegistryManifestSourceCapabilityInternalV1;
  signedSourceContextsInternalV1.set(capability, {
    envelope,
    activeRoot,
    strictCryptoCapability: input.strictCryptoCapability,
  });
  return capability;
}

function takeSignedSourceV1(
  capability: unknown,
): SignedSourceContextInternalV1 | undefined {
  if (capability === null || typeof capability !== "object") return undefined;
  const context = signedSourceContextsInternalV1.get(capability);
  if (
    context === undefined ||
    !signedSourceContextsInternalV1.delete(capability)
  ) return undefined;
  return context;
}

export async function diagnoseProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorCandidateInternalV1(
  continuation:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveRegistryContinuationInternalV1,
  signedSourceCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSourceDrainedRegistryManifestSourceCapabilityInternalV1,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorCandidateDiagnosticInternalV1> {
  const source = takeSignedSourceV1(signedSourceCapability);
  if (
    source === undefined ||
    continuation === null ||
    typeof continuation !== "object"
  ) return failureV1("input", "capability_invalid");

  const zeroLive = continuation.zeroLiveClosure;
  const proof = continuation.zeroLiveReferenceProof;
  const universe = continuation.destinationUniverseMetadata;
  const receiptSet = continuation.completeDestinationPublicationReceiptSet;
  if (
    zeroLive.zeroLiveReferenceProof !== proof ||
    zeroLive.destinationUniverseMetadata !== universe ||
    zeroLive.completeDestinationPublicationReceiptSet !== receiptSet ||
    proof.remainingSourceLiveObjectCount !== 0 ||
    proof.remainingSourceLiveReferenceCount !== 0 ||
    proof.remainingSourceLiveOrdinals.length !== 0 ||
    proof.sourceObjectCount !== proof.migratedObjectCount ||
    proof.migratedObjectCount !== universe.objectCount ||
    receiptSet.receiptCount !== universe.objectCount ||
    proof.destinationUniverseContentDigest !== universe.universeContentDigest ||
    proof.completeReceiptSetDigest !== receiptSet.receiptSetDigest ||
    universe.completeReceiptSetDigest !== receiptSet.receiptSetDigest
  ) return failureV1("zero_live", "zero_live_invalid");

  const currentEnvelope = continuation.currentRegistryManifestEnvelope;
  const currentPin = pinV1(currentEnvelope);
  const current = currentEnvelope.payload;
  if (
    !canonicalEqualV1(currentPin, continuation.currentRegistryManifestPin) ||
    current.routing.state !== "migration" ||
    current.routing.phase !== "rebinding" ||
    current.routing.activeForMigrationWrites !==
      current.routing.destinationProviderId ||
    current.routing.migrationId !== continuation.formalMigrationId ||
    current.routing.sourceProviderId !== continuation.sourceProviderId ||
    current.routing.destinationProviderId !== continuation.destinationProviderId
  ) return failureV1("current_registry", "current_not_rebinding");

  const envelope = source.envelope;
  const manifest = envelope.payload;
  if (
    manifest.manifestGeneration !== current.manifestGeneration + 1
  ) return failureV1("manifest_predecessor", "generation_not_contiguous");
  if (
    manifest.predecessor.state !== "manifest" ||
    manifest.predecessor.generationId !== currentEnvelope.generationId ||
    manifest.predecessor.contentDigest !== currentEnvelope.contentDigest
  ) return failureV1("manifest_predecessor", "predecessor_pin_mismatch");
  if (
    manifest.installationIdentityGenerationId !==
      current.installationIdentityGenerationId ||
    manifest.installationIdentityGenerationId !==
      zeroLive.installationIdentityGenerationId ||
    !canonicalEqualV1(
      manifest.activeRootMetadata,
      current.activeRootMetadata,
    ) ||
    envelope.generationId !== manifest.generationId ||
    envelope.generationId !==
      deriveProviderRegistryManifestGenerationIdV1(
        projectProviderRegistryManifestIdFieldsV1(manifest),
      ) ||
    envelope.contentDigest !==
      deriveProviderRegistryManifestContentDigestV1(manifest)
  ) return failureV1("manifest_envelope", "envelope_mismatch");
  if (!canonicalEqualV1(manifest.members, current.members)) {
    return failureV1("member_set", "members_changed");
  }
  if (
    manifest.routing.state !== "migration" ||
    manifest.routing.migrationId !== continuation.formalMigrationId ||
    manifest.routing.sourceProviderId !== continuation.sourceProviderId ||
    manifest.routing.destinationProviderId !== continuation.destinationProviderId ||
    manifest.routing.phase !== "source_drained" ||
    manifest.routing.activeForMigrationWrites !==
      continuation.destinationProviderId
  ) return failureV1("routing", "routing_invalid");

  if (
    !(await verifyProviderMigrationExternallyRootSignedRegistryManifestEnvelopeInternalV1(
      envelope,
      source.activeRoot,
      source.strictCryptoCapability,
    ))
  ) return failureV1("manifest_signature", "signature_invalid");

  const sourceDrainedPin = pinV1(envelope);
  return CapturedObjectFreezeV1({
    ok: true as const,
    value: CapturedObjectFreezeV1({
      authority: "none" as const,
      durability: "none" as const,
      profile:
        "provider_migration_same_installation_identity_current_strong_source_normal_source_drained_registry_successor_candidate_validation_v1" as const,
      relationship:
        "externally_root_signed_direct_successor_of_published_rebinding_registry_tip_source_drained_candidate_after_exact_zero_live_not_current_or_published_v1" as const,
      installationIdentityGenerationId:
        manifest.installationIdentityGenerationId,
      formalMigrationId: continuation.formalMigrationId,
      sourceProviderId: continuation.sourceProviderId,
      destinationProviderId: continuation.destinationProviderId,
      currentRebindingRegistryManifestEnvelope: currentEnvelope,
      currentRebindingRegistryManifestPin: currentPin,
      sourceDrainedRegistryManifestEnvelope: envelope,
      sourceDrainedRegistryManifestPin: sourceDrainedPin,
      zeroLiveProofContentDigest: proof.proofContentDigest,
      destinationUniverseContentDigest: universe.universeContentDigest,
      completeDestinationPublicationReceiptSetDigest: receiptSet.receiptSetDigest,
      rootSignatureVerificationCount: 1 as const,
      memberSetPreserved: true as const,
      registryEntryAndKeyMaterialPreserved: true as const,
      exactZeroLiveClosureVerified: true as const,
      registryManifestPublicationCount: 0 as const,
    }),
  });
}

for (const exportedFunctionV1 of [
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSourceDrainedRegistryManifestSourceCapabilityInternalV1,
  diagnoseProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistrySuccessorCandidateInternalV1,
]) CapturedObjectFreezeV1(exportedFunctionV1);
