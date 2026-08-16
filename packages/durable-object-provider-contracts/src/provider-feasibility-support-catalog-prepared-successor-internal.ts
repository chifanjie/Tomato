/**
 * Package-private D43 verifier for one externally Root-signed Catalog direct
 * successor. The exact D42 claim is consumed before any signed input is read.
 */

import {
  assertDataObjectDescriptorsBeforeSchemaV1,
  assertJsonDataTreeBeforeSchemaV1,
} from "./domain-crypto.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import {
  ProviderFeasibilitySupportCatalogEnvelopeV1Schema,
  createProviderFeasibilitySupportCatalogSignatureMessageV1,
  deriveProviderFeasibilitySupportCatalogContentDigestV1,
  deriveProviderFeasibilitySupportCatalogPinV1,
  type ProviderFeasibilitySupportCandidateV1,
  type ProviderFeasibilitySupportCatalogEnvelopeV1,
  type ProviderFeasibilitySupportCatalogPinV1,
} from "./provider-feasibility-support-catalog-point.js";
import {
  takeProviderFeasibilitySupportCatalogPreparedSuccessorFinalCandidateInternalV1,
  type ProviderFeasibilitySupportCatalogPreparedSuccessorFinalCapabilityInternalV1,
  type ProviderFeasibilitySupportCatalogPreparedSuccessorRetainedPayloadInternalV1,
} from "./provider-feasibility-support-catalog-prepared-successor-handle-internal.js";
import type { ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1 } from "./provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-reference-candidate-wire.js";
import type {
  ProviderRegistryManifestEnvelopeV1,
  ProviderRegistryManifestPinV1,
  StoreDurableObjectProviderRegistryEntryV1,
} from "./provider-registry-records.js";
import {
  createProviderNonThenableFrozenRecordV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import {
  verifyRawEd25519WithCapabilityV1,
} from "./strict-ed25519-conformance.js";

const CapturedArrayIsArrayV1 = Array.isArray;
const CapturedNumberIsSafeIntegerV1 = Number.isSafeInteger;
const CapturedNumberParseIntV1 = Number.parseInt;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 = Object.getOwnPropertyDescriptor;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedObjectIsFrozenV1 = Object.isFrozen;
const CapturedObjectPrototypeV1 = Object.prototype;
const CapturedReflectOwnKeysV1 = Reflect.ownKeys;
const CapturedTextEncoderV1 = TextEncoder;
const CapturedTextEncoderPrototypeEncodeV1 = TextEncoder.prototype.encode;
const CapturedUint8ArrayV1 = Uint8Array;
const CapturedUtf8EncoderV1 = CapturedObjectFreezeV1(
  new CapturedTextEncoderV1(),
);

const CATALOG_SIGNATURE_PATTERN_V1 =
  /^provider-support-catalog-ed25519:([0-9a-f]{22}):([0-9a-f]{128})$/u;

export interface ProviderFeasibilitySupportCatalogPreparedDirectSuccessorInputInternalV1 {
  readonly externallySignedCatalogEnvelope: ProviderFeasibilitySupportCatalogEnvelopeV1;
}

export type ProviderFeasibilitySupportCatalogPreparedDirectSuccessorDiagnosticStageInternalV1 =
  | "input"
  | "catalog_generation"
  | "catalog_predecessor"
  | "catalog_stable_projection"
  | "catalog_candidate_binding"
  | "catalog_signature"
  | "catalog_history_limit";

export type ProviderFeasibilitySupportCatalogPreparedDirectSuccessorDiagnosticReasonInternalV1 =
  | "schema_invalid"
  | "capability_invalid"
  | "generation_not_contiguous"
  | "predecessor_pin_mismatch"
  | "binding_mismatch"
  | "signature_invalid"
  | "history_generation_limit_exceeded"
  | "envelope_byte_limit_exceeded"
  | "history_total_byte_limit_exceeded";

export interface ProviderFeasibilitySupportCatalogPreparedDirectSuccessorValidationInternalV1 {
  readonly authority: "none";
  readonly relationship: "root_signed_direct_successor_of_same_cohort_retained_current_catalog_candidate_not_current_or_published_v1";
  readonly installationIdentityGenerationId: ProviderFeasibilitySupportCatalogPreparedSuccessorRetainedPayloadInternalV1["installationIdentityGenerationId"];
  readonly formalMigrationId: ProviderFeasibilitySupportCatalogPreparedSuccessorRetainedPayloadInternalV1["formalMigrationId"];
  readonly sourceProviderId: StoreDurableObjectProviderRegistryEntryV1["providerId"];
  readonly destinationProviderId: StoreDurableObjectProviderRegistryEntryV1["providerId"];
  readonly exactD41CandidateIdentityPreserved: true;
  readonly preparedRegistryManifestEnvelope: ProviderRegistryManifestEnvelopeV1;
  readonly preparedRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly preparedRegistryRelationship: ProviderFeasibilitySupportCatalogPreparedSuccessorRetainedPayloadInternalV1["preparedRegistryRelationship"];
  readonly currentSupportCatalogEnvelope: ProviderFeasibilitySupportCatalogEnvelopeV1;
  readonly currentSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1;
  readonly preparedSupportCatalogEnvelope: ProviderFeasibilitySupportCatalogEnvelopeV1;
  readonly preparedSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1;
  readonly externallySignedEnvelopeIdentityPreserved: true;
  readonly retainedTargetGroupsPreserved: true;
  readonly insertedProspectiveCandidateCount: 1;
  readonly catalogSignatureVerificationCount: 1;
  readonly registryManifestPublicationCount: 0;
  readonly catalogPublicationCount: 0;
  readonly preparedCatalogCanonicalBytes: number;
  readonly retainedTrustHistoryCanonicalBytesIncludingDirectSuccessors: number;
  readonly validatedRegistryManifestGenerationCountIncludingPreparedRegistry: number;
  readonly validatedCatalogGenerationCountIncludingDirectSuccessor: number;
}

export type ProviderFeasibilitySupportCatalogPreparedDirectSuccessorDiagnosticResultInternalV1 =
  | Readonly<{
      readonly ok: true;
      readonly value: ProviderFeasibilitySupportCatalogPreparedDirectSuccessorValidationInternalV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly stage: ProviderFeasibilitySupportCatalogPreparedDirectSuccessorDiagnosticStageInternalV1;
      readonly reason: ProviderFeasibilitySupportCatalogPreparedDirectSuccessorDiagnosticReasonInternalV1;
    }>;

function failureV1(
  stage: ProviderFeasibilitySupportCatalogPreparedDirectSuccessorDiagnosticStageInternalV1,
  reason: ProviderFeasibilitySupportCatalogPreparedDirectSuccessorDiagnosticReasonInternalV1,
): ProviderFeasibilitySupportCatalogPreparedDirectSuccessorDiagnosticResultInternalV1 {
  return createProviderNonThenableFrozenRecordV1({ ok: false, stage, reason });
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  const leftBytes = canonicalizeJcsSafeIntegerUtf8V1(left);
  const rightBytes = canonicalizeJcsSafeIntegerUtf8V1(right);
  if (leftBytes.byteLength !== rightBytes.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.byteLength; index += 1) {
    difference |= leftBytes[index]! ^ rightBytes[index]!;
  }
  return difference === 0;
}

function compareUtf8V1(left: string, right: string): number {
  const leftBytes = Reflect.apply(
    CapturedTextEncoderPrototypeEncodeV1,
    CapturedUtf8EncoderV1,
    [left],
  ) as Uint8Array;
  const rightBytes = Reflect.apply(
    CapturedTextEncoderPrototypeEncodeV1,
    CapturedUtf8EncoderV1,
    [right],
  ) as Uint8Array;
  const limit = leftBytes.byteLength < rightBytes.byteLength
    ? leftBytes.byteLength
    : rightBytes.byteLength;
  for (let index = 0; index < limit; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!;
    if (difference !== 0) return difference;
  }
  return leftBytes.byteLength - rightBytes.byteLength;
}

function assertExactDeepFrozenJsonTreeV1(value: unknown): void {
  assertJsonDataTreeBeforeSchemaV1(value);
  const pending: object[] = [value as object];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (!CapturedObjectIsFrozenV1(current)) {
      throw new TypeError("prepared Catalog input must be deeply frozen");
    }
    const keys = CapturedReflectOwnKeysV1(current);
    for (let index = 0; index < keys.length; index += 1) {
      const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(
        current,
        keys[index]!,
      );
      if (descriptor !== undefined && "value" in descriptor) {
        const child = descriptor.value;
        if (child !== null && typeof child === "object") pending.push(child);
      }
    }
  }
}

function readInputV1(
  input: unknown,
): ProviderFeasibilitySupportCatalogPreparedDirectSuccessorInputInternalV1 | undefined {
  try {
    assertDataObjectDescriptorsBeforeSchemaV1(input);
    if (
      CapturedObjectGetPrototypeOfV1(input) !== CapturedObjectPrototypeV1 &&
      CapturedObjectGetPrototypeOfV1(input) !== null
    ) return undefined;
    const keys = CapturedReflectOwnKeysV1(input);
    if (keys.length !== 1 || keys[0] !== "externallySignedCatalogEnvelope") {
      return undefined;
    }
    const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(
      input,
      "externallySignedCatalogEnvelope",
    );
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) return undefined;
    assertExactDeepFrozenJsonTreeV1(descriptor.value);
    return CapturedObjectFreezeV1({
      externallySignedCatalogEnvelope:
        descriptor.value as ProviderFeasibilitySupportCatalogEnvelopeV1,
    });
  } catch {
    return undefined;
  }
}

function lowerHexToBytesV1(value: string): Uint8Array {
  const output = new CapturedUint8ArrayV1(value.length / 2);
  for (let index = 0; index < output.byteLength; index += 1) {
    output[index] = CapturedNumberParseIntV1(
      value.slice(index * 2, index * 2 + 2),
      16,
    );
  }
  return output;
}

function decodeCanonicalPublicKeyBytes32V1(value: string): Uint8Array {
  if (!value.startsWith("base64url:")) throw new TypeError("root key invalid");
  const encoded = value.slice("base64url:".length);
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  if (encoded.length !== 43) throw new TypeError("root key invalid");
  const output = new CapturedUint8ArrayV1(32);
  let accumulator = 0;
  let availableBits = 0;
  let offset = 0;
  for (let index = 0; index < encoded.length; index += 1) {
    const digit = alphabet.indexOf(encoded[index]!);
    if (digit < 0) throw new TypeError("root key invalid");
    accumulator = (accumulator << 6) | digit;
    availableBits += 6;
    while (availableBits >= 8 && offset < output.length) {
      availableBits -= 8;
      output[offset] = (accumulator >>> availableBits) & 255;
      offset += 1;
    }
  }
  if (offset !== 32) throw new TypeError("root key invalid");
  return output;
}

function hasExactProspectiveInsertionV1(
  currentCandidates: readonly ProviderFeasibilitySupportCandidateV1[],
  preparedCandidates: readonly ProviderFeasibilitySupportCandidateV1[],
  prospectiveCandidate: ProviderFeasibilitySupportCandidateV1,
): boolean {
  if (preparedCandidates.length !== currentCandidates.length + 1) return false;
  let currentIndex = 0;
  let inserted = false;
  for (let preparedIndex = 0; preparedIndex < preparedCandidates.length; preparedIndex += 1) {
    const prepared = preparedCandidates[preparedIndex]!;
    const current = currentCandidates[currentIndex];
    if (!inserted && prepared.providerId === prospectiveCandidate.providerId) {
      if (!canonicalEqualV1(prepared, prospectiveCandidate)) return false;
      if (
        (currentIndex > 0 &&
          compareUtf8V1(
            currentCandidates[currentIndex - 1]!.providerId,
            prospectiveCandidate.providerId,
          ) >= 0) ||
        (current !== undefined &&
          compareUtf8V1(prospectiveCandidate.providerId, current.providerId) >= 0)
      ) return false;
      inserted = true;
      continue;
    }
    if (
      current === undefined ||
      current.providerId === prospectiveCandidate.providerId ||
      !canonicalEqualV1(prepared, current)
    ) return false;
    currentIndex += 1;
  }
  return inserted && currentIndex === currentCandidates.length;
}

function catalogCandidatesAreExactDirectSuccessorV1(
  payload: ProviderFeasibilitySupportCatalogPreparedSuccessorRetainedPayloadInternalV1,
  preparedEnvelope: ProviderFeasibilitySupportCatalogEnvelopeV1,
): boolean {
  const currentTargets = payload.currentSupportCatalogEnvelope.payload.targets;
  const preparedTargets = preparedEnvelope.payload.targets;
  if (preparedTargets.length !== currentTargets.length) return false;
  const cut = payload.exactD41CandidateIdentity.destinationTrust.authorization
    .prospectiveDestinationCut;
  let insertionTargetCount = 0;
  for (let index = 0; index < currentTargets.length; index += 1) {
    const current = currentTargets[index]!;
    const prepared = preparedTargets[index]!;
    if (!canonicalEqualV1(current.target, prepared.target)) return false;
    if (canonicalEqualV1(current.target, cut.target)) {
      insertionTargetCount += 1;
      if (!hasExactProspectiveInsertionV1(
        current.candidates,
        prepared.candidates,
        cut.prospectiveSupportCandidate,
      )) return false;
    } else if (!canonicalEqualV1(current.candidates, prepared.candidates)) {
      return false;
    }
  }
  return insertionTargetCount === 1;
}

function stableCatalogProjectionMatchesV1(
  currentEnvelope: ProviderFeasibilitySupportCatalogEnvelopeV1,
  preparedEnvelope: ProviderFeasibilitySupportCatalogEnvelopeV1,
): boolean {
  const current = currentEnvelope.payload;
  const prepared = preparedEnvelope.payload;
  return current.profile === prepared.profile &&
    canonicalEqualV1(current.distributionRootBinding, prepared.distributionRootBinding) &&
    canonicalEqualV1(current.activeRootMetadata, prepared.activeRootMetadata) &&
    current.registryRootKeyId === prepared.registryRootKeyId &&
    canonicalEqualV1(current.feasibilityApprovalKeys, prepared.feasibilityApprovalKeys) &&
    canonicalEqualV1(current.publicSupportTaxonomy, prepared.publicSupportTaxonomy) &&
    canonicalEqualV1(current.releaseTargetUniverse, prepared.releaseTargetUniverse);
}

function d42CrossBindingMatchesV1(
  payload: ProviderFeasibilitySupportCatalogPreparedSuccessorRetainedPayloadInternalV1,
  exactD42: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1,
): boolean {
  return CapturedObjectIsFrozenV1(exactD42) &&
    canonicalEqualV1(
      exactD42.preSideEffectPlanAdmissionClosure,
      payload.exactD41CandidateIdentity,
    ) &&
    exactD42.formalMigrationIdMapping.formalMigrationId === payload.formalMigrationId &&
    canonicalEqualV1(
      exactD42.preparedRegistryManifestEnvelope,
      payload.preparedRegistryManifestEnvelope,
    ) &&
    canonicalEqualV1(
      exactD42.preparedRegistryManifestPin,
      payload.preparedRegistryManifestPin,
    ) &&
    exactD42.verificationBoundary.preparedRegistryRelationship ===
      payload.preparedRegistryRelationship;
}

async function validateV1(
  payload: ProviderFeasibilitySupportCatalogPreparedSuccessorRetainedPayloadInternalV1,
  exactD42: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1,
  input: unknown,
): Promise<ProviderFeasibilitySupportCatalogPreparedDirectSuccessorDiagnosticResultInternalV1> {
  if (!d42CrossBindingMatchesV1(payload, exactD42)) {
    return failureV1("catalog_candidate_binding", "binding_mismatch");
  }
  const exactInput = readInputV1(input);
  if (exactInput === undefined) return failureV1("input", "schema_invalid");
  const envelope = exactInput.externallySignedCatalogEnvelope;
  try {
    if (!ProviderFeasibilitySupportCatalogEnvelopeV1Schema.safeParse(envelope).success) {
      return failureV1("input", "schema_invalid");
    }
  } catch {
    return failureV1("input", "schema_invalid");
  }
  const currentEnvelope = payload.currentSupportCatalogEnvelope;
  const current = currentEnvelope.payload;
  const prepared = envelope.payload;
  if (
    !CapturedNumberIsSafeIntegerV1(current.catalogGeneration) ||
    current.catalogGeneration >= Number.MAX_SAFE_INTEGER ||
    prepared.catalogGeneration !== current.catalogGeneration + 1 ||
    envelope.catalogGeneration !== prepared.catalogGeneration
  ) return failureV1("catalog_generation", "generation_not_contiguous");
  if (
    prepared.predecessorCatalogContentDigest !== currentEnvelope.contentDigest
  ) return failureV1("catalog_predecessor", "predecessor_pin_mismatch");

  let currentPin: ProviderFeasibilitySupportCatalogPinV1;
  let preparedPin: ProviderFeasibilitySupportCatalogPinV1;
  let envelopeCanonicalBytes: number;
  try {
    currentPin = CapturedObjectFreezeV1(
      deriveProviderFeasibilitySupportCatalogPinV1(currentEnvelope),
    );
    preparedPin = CapturedObjectFreezeV1(
      deriveProviderFeasibilitySupportCatalogPinV1(envelope),
    );
    envelopeCanonicalBytes = canonicalizeJcsSafeIntegerUtf8V1(envelope).byteLength;
  } catch {
    return failureV1("catalog_stable_projection", "binding_mismatch");
  }
  if (
    !canonicalEqualV1(currentPin, payload.currentSupportCatalogPin) ||
    !stableCatalogProjectionMatchesV1(currentEnvelope, envelope) ||
    prepared.registryRootKeyId !== payload.currentRoot.rootKeyId ||
    prepared.activeRootMetadata.rootKeyId !== payload.currentRoot.rootKeyId
  ) return failureV1("catalog_stable_projection", "binding_mismatch");
  if (!catalogCandidatesAreExactDirectSuccessorV1(payload, envelope)) {
    return failureV1("catalog_candidate_binding", "binding_mismatch");
  }

  const cut = payload.exactD41CandidateIdentity.destinationTrust.authorization
    .prospectiveDestinationCut;
  const preparedRegistry = payload.preparedRegistryManifestEnvelope.payload;
  if (
    cut.prospectiveSupportCandidate.providerId !== payload.destinationProviderId ||
    cut.prospectiveRegistryEntry.providerId !== payload.destinationProviderId ||
    preparedRegistry.routing.state !== "migration" ||
    preparedRegistry.routing.migrationId !== payload.formalMigrationId ||
    preparedRegistry.routing.sourceProviderId !== payload.sourceProviderId ||
    preparedRegistry.routing.destinationProviderId !== payload.destinationProviderId
  ) return failureV1("catalog_candidate_binding", "binding_mismatch");

  if (
    prepared.catalogGeneration >
      payload.policy.maxSupportCatalogGenerationCountPerInstallationIdentity
  ) {
    return failureV1(
      "catalog_history_limit",
      "history_generation_limit_exceeded",
    );
  }
  if (envelopeCanonicalBytes > payload.policy.maxSingleTrustEnvelopeLogicalBytes) {
    return failureV1("catalog_history_limit", "envelope_byte_limit_exceeded");
  }
  const retainedBytes =
    payload.retainedTrustHistoryCanonicalBytesIncludingPreparedRegistry;
  if (
    !CapturedNumberIsSafeIntegerV1(retainedBytes) ||
    retainedBytes >
      payload.policy.maxTotalTrustHistoryLogicalBytesPerInstallationIdentity -
        envelopeCanonicalBytes
  ) {
    return failureV1(
      "catalog_history_limit",
      "history_total_byte_limit_exceeded",
    );
  }

  const signatureMatch = CATALOG_SIGNATURE_PATTERN_V1.exec(
    prepared.catalogSignature,
  );
  if (
    signatureMatch?.[1] !== payload.currentRoot.rootKeyId ||
    signatureMatch[2] === undefined
  ) return failureV1("catalog_signature", "signature_invalid");
  try {
    const accepted = await hardenProviderPointPromiseV1(
      verifyRawEd25519WithCapabilityV1(
        payload.strictCryptoCapability,
        decodeCanonicalPublicKeyBytes32V1(payload.currentRoot.publicKeyBytes),
        createProviderFeasibilitySupportCatalogSignatureMessageV1(
          prepared,
          payload.currentRoot.rootKeyId,
        ),
        lowerHexToBytesV1(signatureMatch[2]),
      ),
    );
    if (!accepted) return failureV1("catalog_signature", "signature_invalid");
  } catch {
    return failureV1("catalog_signature", "signature_invalid");
  }
  if (
    envelope.contentDigest !==
      deriveProviderFeasibilitySupportCatalogContentDigestV1(prepared)
  ) return failureV1("catalog_stable_projection", "binding_mismatch");

  return createProviderNonThenableFrozenRecordV1({
    ok: true,
    value: createProviderNonThenableFrozenRecordV1<ProviderFeasibilitySupportCatalogPreparedDirectSuccessorValidationInternalV1>({
      authority: "none",
      relationship:
        "root_signed_direct_successor_of_same_cohort_retained_current_catalog_candidate_not_current_or_published_v1",
      installationIdentityGenerationId: payload.installationIdentityGenerationId,
      formalMigrationId: payload.formalMigrationId,
      sourceProviderId: payload.sourceProviderId,
      destinationProviderId: payload.destinationProviderId,
      exactD41CandidateIdentityPreserved: true,
      preparedRegistryManifestEnvelope: payload.preparedRegistryManifestEnvelope,
      preparedRegistryManifestPin: payload.preparedRegistryManifestPin,
      preparedRegistryRelationship: payload.preparedRegistryRelationship,
      currentSupportCatalogEnvelope: currentEnvelope,
      currentSupportCatalogPin: currentPin,
      preparedSupportCatalogEnvelope: envelope,
      preparedSupportCatalogPin: preparedPin,
      externallySignedEnvelopeIdentityPreserved: true,
      retainedTargetGroupsPreserved: true,
      insertedProspectiveCandidateCount: 1,
      catalogSignatureVerificationCount: 1,
      registryManifestPublicationCount: 0,
      catalogPublicationCount: 0,
      preparedCatalogCanonicalBytes: envelopeCanonicalBytes,
      retainedTrustHistoryCanonicalBytesIncludingDirectSuccessors:
        retainedBytes + envelopeCanonicalBytes,
      validatedRegistryManifestGenerationCountIncludingPreparedRegistry:
        payload.validatedRegistryManifestGenerationCountIncludingPreparedRegistry,
      validatedCatalogGenerationCountIncludingDirectSuccessor:
        prepared.catalogGeneration,
    }),
  });
}

/** Consume an exact D42-bound claim, then verify one prepared Catalog. @internal */
export async function diagnoseProviderFeasibilitySupportCatalogPreparedDirectSuccessorInternalV1(
  exactD42CandidateIdentity: unknown,
  finalCapability: ProviderFeasibilitySupportCatalogPreparedSuccessorFinalCapabilityInternalV1,
  input: unknown,
): Promise<ProviderFeasibilitySupportCatalogPreparedDirectSuccessorDiagnosticResultInternalV1> {
  const payload =
    takeProviderFeasibilitySupportCatalogPreparedSuccessorFinalCandidateInternalV1(
      exactD42CandidateIdentity,
      finalCapability,
    );
  if (payload === undefined) return failureV1("input", "capability_invalid");
  if (
    exactD42CandidateIdentity === null ||
    typeof exactD42CandidateIdentity !== "object" ||
    CapturedArrayIsArrayV1(exactD42CandidateIdentity)
  ) return failureV1("input", "capability_invalid");
  try {
    return await hardenProviderPointPromiseV1(
      validateV1(
        payload,
        exactD42CandidateIdentity as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1,
        input,
      ),
    );
  } catch {
    return failureV1("input", "schema_invalid");
  }
}

CapturedObjectFreezeV1(
  diagnoseProviderFeasibilitySupportCatalogPreparedDirectSuccessorInternalV1,
);
