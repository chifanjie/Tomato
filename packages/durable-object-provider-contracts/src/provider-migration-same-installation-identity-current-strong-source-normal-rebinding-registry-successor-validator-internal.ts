/**
 * Package-private verifier for the externally Root-signed rebinding Registry
 * direct successor. This layer validates a candidate only; it neither makes
 * the candidate current nor grants execution authority.
 */

import { canonicalizeJcsSafeIntegerV1 } from "./jcs.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceExecutionContinuationInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-migration-only-acceptance-reference-capability-internal.js";
import {
  deepFreezeProviderPointDetachedDataTreeV1,
} from "./provider-point-raw-admission-internal.js";
import {
  ProviderRegistryManifestEnvelopeV1Schema,
  ProviderRegistryManifestPinV1Schema,
  createProviderRegistryManifestSignatureMessageV1,
  deriveProviderRegistryManifestContentDigestV1,
  deriveProviderRegistryManifestGenerationIdV1,
  projectProviderRegistryManifestIdFieldsV1,
  projectProviderRegistryManifestUnsignedClaimsV1,
  type ProviderRegistryManifestEnvelopeV1,
  type ProviderRegistryManifestPinV1,
} from "./provider-registry-records.js";
import {
  validateProviderRegistryRootPublicKeyV1,
  type ProviderRegistryRootPublicKeyV1,
} from "./provider-registry-trust.js";
import {
  verifyRawEd25519WithCapabilityV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "./strict-ed25519-conformance.js";

const CapturedObjectCreateV1 = Object.create;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedTypeErrorV1 = TypeError;
const CapturedUint8ArrayV1 = Uint8Array;
const CapturedWeakMapV1 = WeakMap;

declare const externallySignedRebindingRegistrySourceBrandInternalV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedRebindingRegistryManifestSourceCapabilityInternalV1 {
  readonly [externallySignedRebindingRegistrySourceBrandInternalV1]: true;
}

export interface MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedRebindingRegistryManifestSourceCapabilityInternalV1Input {
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

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorCandidateValidationInternalV1 {
  readonly authority: "none";
  readonly durability: "none";
  readonly profile: "provider_migration_same_installation_identity_current_strong_source_normal_rebinding_registry_successor_candidate_validation_v1";
  readonly relationship: "externally_root_signed_direct_successor_of_published_prepared_registry_tip_rebinding_candidate_not_current_or_published_v1";
  readonly installationIdentityGenerationId: string;
  readonly formalMigrationId: string;
  readonly sourceProviderId: string;
  readonly destinationProviderId: string;
  readonly currentPreparedRegistryManifestEnvelope:
    ProviderRegistryManifestEnvelopeV1;
  readonly currentPreparedRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly rebindingRegistryManifestEnvelope:
    ProviderRegistryManifestEnvelopeV1;
  readonly rebindingRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly rootSignatureVerificationCount: 1;
  readonly memberSetPreserved: true;
  readonly registryEntryAndKeyMaterialPreserved: true;
  readonly registryManifestPublicationCount: 0;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorCandidateDiagnosticInternalV1 =
  | Readonly<{
      readonly ok: true;
      readonly value:
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorCandidateValidationInternalV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage:
        | "input"
        | "current_registry"
        | "manifest_envelope"
        | "manifest_predecessor"
        | "routing"
        | "member_set"
        | "manifest_signature";
      readonly reason:
        | "capability_invalid"
        | "schema_invalid"
        | "current_not_prepared"
        | "generation_not_contiguous"
        | "predecessor_pin_mismatch"
        | "envelope_mismatch"
        | "routing_invalid"
        | "members_changed"
        | "signature_invalid";
    }>;

function failureV1(
  stage: Extract<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorCandidateDiagnosticInternalV1,
    { readonly ok: false }
  >["stage"],
  reason: Extract<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorCandidateDiagnosticInternalV1,
    { readonly ok: false }
  >["reason"],
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorCandidateDiagnosticInternalV1 {
  return CapturedObjectFreezeV1({ ok: false as const, stage, reason });
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

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  return canonicalizeJcsSafeIntegerV1(left) ===
    canonicalizeJcsSafeIntegerV1(right);
}

function decodeBase64UrlRaw32V1(value: string): Uint8Array {
  if (!value.startsWith("base64url:")) {
    throw new CapturedTypeErrorV1("root public key wire invalid");
  }
  const encoded = value.slice("base64url:".length);
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  if (encoded.length !== 43) {
    throw new CapturedTypeErrorV1("root public key wire invalid");
  }
  const output = new CapturedUint8ArrayV1(32);
  let accumulator = 0;
  let availableBits = 0;
  let offset = 0;
  for (let index = 0; index < encoded.length; index += 1) {
    const digit = alphabet.indexOf(encoded[index]!);
    if (digit < 0) throw new CapturedTypeErrorV1("root key wire invalid");
    accumulator = (accumulator << 6) | digit;
    availableBits += 6;
    while (availableBits >= 8 && offset < output.length) {
      availableBits -= 8;
      output[offset] = (accumulator >>> availableBits) & 255;
      offset += 1;
      accumulator &= (1 << availableBits) - 1;
    }
  }
  if (offset !== 32 || availableBits !== 2 || accumulator !== 0) {
    throw new CapturedTypeErrorV1("root public key wire invalid");
  }
  return output;
}

function lowerHexToBytesV1(value: string): Uint8Array {
  if (!/^[0-9a-f]{128}$/u.test(value)) {
    throw new CapturedTypeErrorV1("manifest signature wire invalid");
  }
  const output = new CapturedUint8ArrayV1(64);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Number.parseInt(
      value.slice(index * 2, index * 2 + 2),
      16,
    );
  }
  return output;
}

function parseManifestSignatureV1(value: string): Readonly<{
  rootKeyId: string;
  signatureBytes: Uint8Array;
}> {
  const match =
    /^provider-registry-manifest-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u
      .exec(value);
  if (match === null || match[1] === undefined || match[2] === undefined) {
    throw new CapturedTypeErrorV1("manifest signature wire invalid");
  }
  return CapturedObjectFreezeV1({
    rootKeyId: match[1],
    signatureBytes: lowerHexToBytesV1(match[2]),
  });
}

export async function verifyProviderMigrationExternallyRootSignedRegistryManifestEnvelopeInternalV1(
  envelope: ProviderRegistryManifestEnvelopeV1,
  activeRoot: ProviderRegistryRootPublicKeyV1,
  strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1,
): Promise<boolean> {
  try {
    const parsed = parseManifestSignatureV1(
      envelope.payload.manifestSignature,
    );
    if (
      parsed.rootKeyId !== activeRoot.rootKeyId ||
      parsed.rootKeyId !== envelope.payload.activeRootMetadata.rootKeyId
    ) return false;
    return await verifyRawEd25519WithCapabilityV1(
      strictCryptoCapability,
      decodeBase64UrlRaw32V1(activeRoot.publicKeyBytes),
      createProviderRegistryManifestSignatureMessageV1(
        projectProviderRegistryManifestUnsignedClaimsV1(envelope.payload),
        activeRoot.rootKeyId,
      ),
      parsed.signatureBytes,
    );
  } catch {
    return false;
  }
}

export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedRebindingRegistryManifestSourceCapabilityInternalV1(
  input: MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedRebindingRegistryManifestSourceCapabilityInternalV1Input,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedRebindingRegistryManifestSourceCapabilityInternalV1 {
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
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedRebindingRegistryManifestSourceCapabilityInternalV1;
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
  if (context === undefined || !signedSourceContextsInternalV1.delete(capability)) {
    return undefined;
  }
  return context;
}

export async function diagnoseProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorCandidateInternalV1(
  continuation:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceExecutionContinuationInternalV1,
  signedSourceCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedRebindingRegistryManifestSourceCapabilityInternalV1,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorCandidateDiagnosticInternalV1> {
  const source = takeSignedSourceV1(signedSourceCapability);
  if (
    source === undefined ||
    continuation === null ||
    typeof continuation !== "object"
  ) return failureV1("input", "capability_invalid");
  const acceptance = continuation.migrationOnlyAcceptance;
  const d44 = acceptance.formalPlanPublicationClosure;
  const currentEnvelope = d44.currentRegistryManifestEnvelope;
  const currentPin = pinV1(currentEnvelope);
  const current = currentEnvelope.payload;
  const expectedSource = acceptance.configuration.sourceWriter.providerId;
  const expectedDestination =
    acceptance.configuration.destinationWriter.providerId;
  if (
    !canonicalEqualV1(currentPin, d44.currentRegistryManifestPin) ||
    current.routing.state !== "migration" ||
    current.routing.phase !== "prepared" ||
    current.routing.activeForMigrationWrites !== expectedSource ||
    current.routing.sourceProviderId !== expectedSource ||
    current.routing.destinationProviderId !== expectedDestination ||
    current.routing.migrationId !== d44.formalPlanPin.formalMigrationId
  ) return failureV1("current_registry", "current_not_prepared");

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
      acceptance.migrationOnlyAcceptanceEnvelope
        .installationIdentityGenerationId ||
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
    manifest.routing.migrationId !== current.routing.migrationId ||
    manifest.routing.sourceProviderId !== expectedSource ||
    manifest.routing.destinationProviderId !== expectedDestination ||
    manifest.routing.phase !== "rebinding" ||
    manifest.routing.activeForMigrationWrites !== expectedDestination
  ) return failureV1("routing", "routing_invalid");

  const signatureValid =
    await verifyProviderMigrationExternallyRootSignedRegistryManifestEnvelopeInternalV1(
      envelope,
      source.activeRoot,
      source.strictCryptoCapability,
    );
  if (!signatureValid) {
    return failureV1("manifest_signature", "signature_invalid");
  }
  const rebindingPin = pinV1(envelope);
  return CapturedObjectFreezeV1({
    ok: true as const,
    value: CapturedObjectFreezeV1({
      authority: "none" as const,
      durability: "none" as const,
      profile:
        "provider_migration_same_installation_identity_current_strong_source_normal_rebinding_registry_successor_candidate_validation_v1" as const,
      relationship:
        "externally_root_signed_direct_successor_of_published_prepared_registry_tip_rebinding_candidate_not_current_or_published_v1" as const,
      installationIdentityGenerationId:
        manifest.installationIdentityGenerationId,
      formalMigrationId: manifest.routing.migrationId,
      sourceProviderId: expectedSource,
      destinationProviderId: expectedDestination,
      currentPreparedRegistryManifestEnvelope: currentEnvelope,
      currentPreparedRegistryManifestPin: currentPin,
      rebindingRegistryManifestEnvelope: envelope,
      rebindingRegistryManifestPin: rebindingPin,
      rootSignatureVerificationCount: 1 as const,
      memberSetPreserved: true as const,
      registryEntryAndKeyMaterialPreserved: true as const,
      registryManifestPublicationCount: 0 as const,
    }),
  });
}

for (const exportedFunctionV1 of [
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedRebindingRegistryManifestSourceCapabilityInternalV1,
  verifyProviderMigrationExternallyRootSignedRegistryManifestEnvelopeInternalV1,
  diagnoseProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRebindingRegistrySuccessorCandidateInternalV1,
]) CapturedObjectFreezeV1(exportedFunctionV1);
