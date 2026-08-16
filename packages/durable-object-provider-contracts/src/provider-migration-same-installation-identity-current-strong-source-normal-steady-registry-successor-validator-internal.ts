/**
 * Package-private validator for an externally Root-signed source_drained ->
 * steady Registry direct successor. Validation does not publish the candidate.
 */

import { canonicalizeJcsSafeIntegerV1 } from "./jcs.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistryTerminalContinuationInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-source-drained-registry-successor-reference-capability-internal.js";
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

declare const externallySignedSteadyRegistrySourceBrandInternalV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSteadyRegistryManifestSourceCapabilityInternalV1 {
  readonly [externallySignedSteadyRegistrySourceBrandInternalV1]: true;
}

export interface MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSteadyRegistryManifestSourceCapabilityInternalV1Input {
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

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistrySuccessorCandidateValidationInternalV1 {
  readonly authority: "none";
  readonly durability: "none";
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_steady_registry_successor_candidate_validation_v1";
  readonly relationship: "externally_root_signed_direct_successor_of_published_source_drained_registry_tip_steady_candidate_source_tombstoned_destination_only_enabled_not_current_or_published_v1";
  readonly installationIdentityGenerationId: string;
  readonly formalMigrationId: string;
  readonly sourceProviderId: string;
  readonly destinationProviderId: string;
  readonly currentSourceDrainedRegistryManifestEnvelope:
    ProviderRegistryManifestEnvelopeV1;
  readonly currentSourceDrainedRegistryManifestPin:
    ProviderRegistryManifestPinV1;
  readonly steadyRegistryManifestEnvelope: ProviderRegistryManifestEnvelopeV1;
  readonly steadyRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly rootSignatureVerificationCount: 1;
  readonly sourceMemberTombstoneDisposition: "revoked_migration_completed";
  readonly destinationOnlyEnabledMember: true;
  readonly otherMemberHistoryPreserved: true;
  readonly registryManifestPublicationCount: 0;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistrySuccessorCandidateDiagnosticInternalV1 =
  | Readonly<{
      readonly ok: true;
      readonly value:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistrySuccessorCandidateValidationInternalV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage:
        | "input"
        | "current_registry"
        | "manifest_envelope"
        | "manifest_predecessor"
        | "routing"
        | "member_completion"
        | "manifest_signature";
      readonly reason:
        | "capability_invalid"
        | "current_not_source_drained"
        | "generation_not_contiguous"
        | "predecessor_pin_mismatch"
        | "envelope_mismatch"
        | "routing_invalid"
        | "source_tombstone_invalid"
        | "signature_invalid";
    }>;

function failureV1(
  stage: Extract<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistrySuccessorCandidateDiagnosticInternalV1,
    { readonly ok: false }
  >["stage"],
  reason: Extract<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistrySuccessorCandidateDiagnosticInternalV1,
    { readonly ok: false }
  >["reason"],
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistrySuccessorCandidateDiagnosticInternalV1 {
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

export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSteadyRegistryManifestSourceCapabilityInternalV1(
  input: MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSteadyRegistryManifestSourceCapabilityInternalV1Input,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSteadyRegistryManifestSourceCapabilityInternalV1 {
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
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSteadyRegistryManifestSourceCapabilityInternalV1;
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
  const source = signedSourceContextsInternalV1.get(capability);
  if (source === undefined || !signedSourceContextsInternalV1.delete(capability)) {
    return undefined;
  }
  return source;
}

function memberCompletionIsExactV1(
  currentEnvelope: ProviderRegistryManifestEnvelopeV1,
  successorEnvelope: ProviderRegistryManifestEnvelopeV1,
  sourceProviderId: string,
  destinationProviderId: string,
): boolean {
  const currentMembers = currentEnvelope.payload.members;
  const successorMembers = successorEnvelope.payload.members;
  if (currentMembers.length !== successorMembers.length) return false;
  let currentEnabledCount = 0;
  let successorEnabledCount = 0;
  let sourceCompleted = false;
  let destinationEnabled = false;
  for (let index = 0; index < currentMembers.length; index += 1) {
    const currentMember = currentMembers[index]!;
    const successorMember = successorMembers[index]!;
    if (currentMember.providerId !== successorMember.providerId) return false;
    if (currentMember.disposition === "enabled") currentEnabledCount += 1;
    if (successorMember.disposition === "enabled") {
      successorEnabledCount += 1;
    }
    if (currentMember.providerId === sourceProviderId) {
      if (
        currentMember.disposition !== "enabled" ||
        successorMember.disposition !== "revoked" ||
        successorMember.lastEnabledRegistryEntryContentDigest !==
          currentMember.registryEntryContentDigest ||
        successorMember.revokedAtManifestGeneration !==
          successorEnvelope.payload.manifestGeneration ||
        successorMember.reason !== "migration_completed"
      ) return false;
      sourceCompleted = true;
      continue;
    }
    if (!canonicalEqualV1(currentMember, successorMember)) return false;
    if (
      currentMember.providerId === destinationProviderId &&
      currentMember.disposition === "enabled"
    ) destinationEnabled = true;
  }
  return currentEnabledCount === 2 &&
    successorEnabledCount === 1 &&
    sourceCompleted &&
    destinationEnabled;
}

export async function diagnoseProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistrySuccessorCandidateInternalV1(
  continuation:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDrainedRegistryTerminalContinuationInternalV1,
  signedSourceCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSteadyRegistryManifestSourceCapabilityInternalV1,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistrySuccessorCandidateDiagnosticInternalV1> {
  const signedSource = takeSignedSourceV1(signedSourceCapability);
  if (
    signedSource === undefined ||
    continuation === null ||
    typeof continuation !== "object"
  ) return failureV1("input", "capability_invalid");
  const sourceDrained = continuation.sourceDrainedRegistrySuccessor;
  const zeroLive = continuation.zeroLiveClosure;
  const currentEnvelope = sourceDrained.currentRegistryManifestEnvelope;
  const currentPin = pinV1(currentEnvelope);
  const current = currentEnvelope.payload;
  if (
    sourceDrained.zeroLiveClosure !== zeroLive ||
    sourceDrained.sourceDrainedRegistryManifestEnvelope !== currentEnvelope ||
    !canonicalEqualV1(
      sourceDrained.currentRegistryManifestPin,
      currentPin,
    ) ||
    current.routing.state !== "migration" ||
    current.routing.phase !== "source_drained" ||
    current.routing.activeForMigrationWrites !==
      current.routing.destinationProviderId ||
    current.routing.migrationId !== zeroLive.formalMigrationId ||
    current.routing.sourceProviderId !== zeroLive.sourceProviderId ||
    current.routing.destinationProviderId !== zeroLive.destinationProviderId
  ) return failureV1("current_registry", "current_not_source_drained");

  const envelope = signedSource.envelope;
  const manifest = envelope.payload;
  if (manifest.manifestGeneration !== current.manifestGeneration + 1) {
    return failureV1("manifest_predecessor", "generation_not_contiguous");
  }
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
    !canonicalEqualV1(manifest.activeRootMetadata, current.activeRootMetadata) ||
    envelope.generationId !== manifest.generationId ||
    envelope.generationId !==
      deriveProviderRegistryManifestGenerationIdV1(
        projectProviderRegistryManifestIdFieldsV1(manifest),
      ) ||
    envelope.contentDigest !==
      deriveProviderRegistryManifestContentDigestV1(manifest)
  ) return failureV1("manifest_envelope", "envelope_mismatch");
  if (manifest.routing.state !== "steady") {
    return failureV1("routing", "routing_invalid");
  }
  if (!memberCompletionIsExactV1(
    currentEnvelope,
    envelope,
    zeroLive.sourceProviderId,
    zeroLive.destinationProviderId,
  )) return failureV1("member_completion", "source_tombstone_invalid");
  if (
    !(await verifyProviderMigrationExternallyRootSignedRegistryManifestEnvelopeInternalV1(
      envelope,
      signedSource.activeRoot,
      signedSource.strictCryptoCapability,
    ))
  ) return failureV1("manifest_signature", "signature_invalid");

  return CapturedObjectFreezeV1({
    ok: true as const,
    value: CapturedObjectFreezeV1({
      authority: "none" as const,
      durability: "none" as const,
      profile:
        "provider_migration_same_installation_identity_current_strong_source_normal_steady_registry_successor_candidate_validation_v1" as const,
      relationship:
        "externally_root_signed_direct_successor_of_published_source_drained_registry_tip_steady_candidate_source_tombstoned_destination_only_enabled_not_current_or_published_v1" as const,
      installationIdentityGenerationId:
        manifest.installationIdentityGenerationId,
      formalMigrationId: zeroLive.formalMigrationId,
      sourceProviderId: zeroLive.sourceProviderId,
      destinationProviderId: zeroLive.destinationProviderId,
      currentSourceDrainedRegistryManifestEnvelope: currentEnvelope,
      currentSourceDrainedRegistryManifestPin: currentPin,
      steadyRegistryManifestEnvelope: envelope,
      steadyRegistryManifestPin: pinV1(envelope),
      rootSignatureVerificationCount: 1 as const,
      sourceMemberTombstoneDisposition:
        "revoked_migration_completed" as const,
      destinationOnlyEnabledMember: true as const,
      otherMemberHistoryPreserved: true as const,
      registryManifestPublicationCount: 0 as const,
    }),
  });
}

for (const exportedFunctionV1 of [
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSteadyRegistryManifestSourceCapabilityInternalV1,
  diagnoseProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSteadyRegistrySuccessorCandidateInternalV1,
]) CapturedObjectFreezeV1(exportedFunctionV1);
