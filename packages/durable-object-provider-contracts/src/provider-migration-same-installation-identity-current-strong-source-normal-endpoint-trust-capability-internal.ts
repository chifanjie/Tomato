/**
 * Package-private D-41 endpoint-trust preparation.
 *
 * This module mints no externally retainable intermediate capability. The
 * final pre-plan mint calls `prepare...` inside its side-effect audit interval;
 * preparation atomically consumes one committed D-40 identity, verifies the
 * retained D-39 trust closure, performs real Registry/Evidence checks, and
 * returns only a detached projection plus narrow read-only observation seams.
 */

import { canonicalizeJcsSafeIntegerV1 } from "./jcs.js";
import type { ContentDigestV1 } from "./primitives.js";
import {
  discardProviderFeasibilityEvidenceRegistryTrustedApproversInternalV1,
  diagnoseProviderFeasibilityEvidencePointRegistryTrustedPreparedInternalV1,
  registerProviderFeasibilityEvidenceRegistryTrustedApproversInternalV1,
  type ProviderFeasibilityEvidenceRegistryTrustedApproverHandleV1,
} from "./provider-feasibility-evidence-point-prepared-internal.js";
import type {
  ValidateProviderFeasibilityEvidencePointClosureV1Input,
} from "./provider-feasibility-evidence-point.js";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceCandidateV1Schema,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalInitialDestinationNamespaceReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-reference-candidate-wire.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamHostInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-source-reference-machine-internal.js";
import {
  deepFreezeProviderPointDetachedDataTreeV1,
} from "./provider-point-raw-admission-internal.js";
import {
  createProviderNonThenableFrozenRecordV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import {
  diagnoseProviderRegistryProspectiveEntryTemporaryAdmissionInternalV1,
  mintProviderRegistryProspectiveEntryTemporaryAdmissionCapabilityInternalV1,
} from "./provider-registry-history-prepared-internal.js";
import type {
  ProviderFeasibilityApproverPublicKeyV1,
} from "./provider-registry-records.js";
import {
  captureProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReadOnlyContinuityInternalV1,
} from "./provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-reference-machine-internal.js";
import {
  takeProviderStrongReadyBootstrapOrSteadyAcceptanceD41EndpointTrustBasisInternalV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceD41EndpointTrustBasisInternalV1,
} from "./provider-strong-ready-bootstrap-or-steady-acceptance-d41-endpoint-trust-basis-internal.js";
import {
  deriveProviderTrustedLocalStrongWriterSelectionCandidateInternalV1,
} from "./provider-trusted-local-strong-writer-selection-candidate-internal.js";

const CapturedObjectCreateV1 = Object.create;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedPromiseV1 = Promise;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedTypeErrorV1 = TypeError;
const CapturedWeakMapV1 = WeakMap;
const CapturedWeakMapPrototypeDeleteV1 = WeakMap.prototype.delete;
const CapturedWeakMapPrototypeGetV1 = WeakMap.prototype.get;
const CapturedWeakMapPrototypeSetV1 = WeakMap.prototype.set;
const CapturedWeakSetV1 = WeakSet;
const CapturedWeakSetPrototypeAddV1 = WeakSet.prototype.add;
const CapturedWeakSetPrototypeHasV1 = WeakSet.prototype.has;

const PREPARE_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "acceptanceClosureIdentity",
  "endpointObservationHost",
  "prospectiveDestinationPreparedSourceCapability",
  "sourceStreamHost",
] as const);
const PREPARED_SOURCE_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "acceptanceClosureIdentity",
  "endpointProjectionClaims",
  "evidenceValidationSource",
] as const);
const PROJECTION_CLAIM_KEYS_V1 = CapturedObjectFreezeV1([
  "destinationTrust",
  "namespaceTranslation",
  "sourceTrust",
] as const);
const ENDPOINT_HOST_KEYS_V1 = CapturedObjectFreezeV1([
  "captureEndpointObservation",
] as const);
const ENDPOINT_OBSERVATION_KEYS_V1 = CapturedObjectFreezeV1([
  "initialDestinationNamespace",
  "sourceStoreManifest",
] as const);
const EVIDENCE_SOURCE_KEYS_V1 = CapturedObjectFreezeV1([
  "activeRoot",
  "activeRootMetadata",
  "distributionRootBinding",
  "fixtureCorpusManifest",
  "providerFeasibilityEvidence",
  "providerFeasibilityEvidencePin",
  "publicSupportTaxonomy",
  "realFilesystemConformanceResult",
  "realFilesystemConformanceResultLocator",
  "realFilesystemConformanceResultPin",
  "releaseMatrix",
  "runtimeAttestation",
  "semanticProviderPolicy",
  "suiteManifest",
  "targetDiscoveryFixtureManifest",
  "targetDiscoveryResult",
  "targetDiscoveryRunnerRun",
] as const);

type SourceEndpointTrustV1 = Extract<
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1,
  { role: "source_current_strong_writer" }
>;
type DestinationEndpointTrustV1 = Extract<
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1,
  { role: "destination_prospective_not_selected" }
>;

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalVerifiedEndpointProjectionInternalV1 {
  readonly sourceTrust: SourceEndpointTrustV1;
  readonly destinationTrust: DestinationEndpointTrustV1;
  readonly namespaceTranslation: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceCandidateV1;
  readonly initialSourceStoreManifest: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1;
  readonly initialDestinationNamespace: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalInitialDestinationNamespaceReferenceCandidateV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointObservationInternalV1 {
  readonly sourceStoreCutContentDigest: ContentDigestV1;
  readonly sourceTrustClosureContentDigest: ContentDigestV1;
  readonly destinationTrustClosureContentDigest: ContentDigestV1;
  readonly destinationNamespaceObservationDigest: ContentDigestV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointObservationHostInternalV1 {
  readonly captureEndpointObservation: (input: Readonly<{
    readonly phase: "pre" | "post";
    readonly endpointCutMintChallenge:
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointCutMintChallengeInternalV1;
    readonly deliverEndpointCutCapability: (
      capability: unknown,
    ) => void;
    readonly rejectEndpointObservation: () => void;
  }>) => unknown;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointProjectionClaimsInternalV1 {
  readonly sourceTrust: SourceEndpointTrustV1;
  readonly destinationTrust: DestinationEndpointTrustV1;
  readonly namespaceTranslation: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceCandidateV1;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationEvidenceValidationSourceInternalV1 =
  Omit<
    ValidateProviderFeasibilityEvidencePointClosureV1Input,
    | "qaApproverPublicKey"
    | "releaseApproverPublicKey"
    | "strictCryptoCapability"
  >;

declare const providerMigrationProspectiveDestinationPreparedSourceCapabilityBrandInternalV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationPreparedSourceCapabilityInternalV1 {
  readonly [providerMigrationProspectiveDestinationPreparedSourceCapabilityBrandInternalV1]: true;
}

export interface MintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationPreparedSourceCapabilityInternalV1Input {
  /** Exact committed D-40 validation identity this source may accompany. */
  readonly acceptanceClosureIdentity: object;
  /** Trusted-decoded and transport-prelimited before entering this adapter. */
  readonly endpointProjectionClaims:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointProjectionClaimsInternalV1;
  /** Trusted-decoded and transport-prelimited before entering this adapter. */
  readonly evidenceValidationSource:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationEvidenceValidationSourceInternalV1;
}

export interface PrepareProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustInternalV1Input {
  readonly acceptanceClosureIdentity: object;
  readonly endpointObservationHost:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointObservationHostInternalV1;
  readonly prospectiveDestinationPreparedSourceCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationPreparedSourceCapabilityInternalV1;
  readonly sourceStreamHost:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamHostInternalV1;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedEndpointTrustInternalV1 {
  readonly verifiedEndpointProjection:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalVerifiedEndpointProjectionInternalV1;
  readonly sourceStreamHost:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamHostInternalV1;
  readonly captureEndpointObservation: (
    phase: "pre" | "post",
  ) => Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointObservationInternalV1>;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTrustedDecodedEndpointCutInternalV1 {
  readonly sourceStoreManifest:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1;
  readonly initialDestinationNamespace:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalInitialDestinationNamespaceReferenceCandidateV1;
}

interface DeliveredEndpointCutEnvelopeInternalV1 {
  readonly cut:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTrustedDecodedEndpointCutInternalV1;
}

declare const providerMigrationEndpointCutMintChallengeBrandInternalV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointCutMintChallengeInternalV1 {
  readonly [providerMigrationEndpointCutMintChallengeBrandInternalV1]: true;
}

declare const providerMigrationEndpointCutCapabilityBrandInternalV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointCutCapabilityInternalV1 {
  readonly [providerMigrationEndpointCutCapabilityBrandInternalV1]: true;
}

interface EndpointCutChallengeBindingInternalV1 {
  readonly endpointContextIdentity: object;
  readonly acceptanceClosureIdentity: object;
  readonly endpointObservationHostIdentity: object;
  readonly phase: "pre" | "post";
  readonly sequence: 1 | 2;
  readonly sourceStreamHostIdentity: object;
}

interface EndpointCutCapabilityContextInternalV1 {
  readonly challenge:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointCutMintChallengeInternalV1;
  readonly binding: EndpointCutChallengeBindingInternalV1;
  readonly cut:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTrustedDecodedEndpointCutInternalV1;
}

interface ProspectiveDestinationPreparedSourceContextInternalV1 {
  readonly acceptanceClosureIdentity: object;
  readonly endpointProjectionClaims:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointProjectionClaimsInternalV1;
  readonly evidenceValidationSource:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationEvidenceValidationSourceInternalV1;
}

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointPreparationDiagnosticStageInternalV1 =
  | "pre_observation"
  | "current_strong_source"
  | "prospective_destination_evidence"
  | "endpoint_trust"
  | "post_observation";

export type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointPreparationDiagnosticReasonInternalV1 =
  | "snapshot_changed"
  | "trust_closure_invalid"
  | "source_not_current_strong_writer"
  | "source_invalid"
  | "destination_evidence_invalid";

const endpointPreparationDiagnosticErrorsInternalV1 = new CapturedWeakSetV1<object>();
const prospectiveDestinationPreparedSourceContextsInternalV1 =
  new CapturedWeakMapV1<
    object,
    ProspectiveDestinationPreparedSourceContextInternalV1
  >();
const endpointCutChallengeBindingsInternalV1 = new CapturedWeakMapV1<
  object,
  EndpointCutChallengeBindingInternalV1
>();
const endpointCutCapabilityContextsInternalV1 = new CapturedWeakMapV1<
  object,
  EndpointCutCapabilityContextInternalV1
>();
const endpointCutMintedCapabilitiesByChallengeInternalV1 =
  new CapturedWeakMapV1<
    object,
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointCutCapabilityInternalV1
  >();

export class ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointPreparationDiagnosticErrorInternalV1
  extends CapturedTypeErrorV1 {
  readonly stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointPreparationDiagnosticStageInternalV1;
  readonly reason: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointPreparationDiagnosticReasonInternalV1;

  constructor(
    stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointPreparationDiagnosticStageInternalV1,
    reason: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointPreparationDiagnosticReasonInternalV1,
  ) {
    super("provider migration endpoint preparation failed");
    this.name = "ProviderMigrationEndpointPreparationDiagnosticErrorInternalV1";
    this.stage = stage;
    this.reason = reason;
    CapturedReflectApplyV1(
      CapturedWeakSetPrototypeAddV1,
      endpointPreparationDiagnosticErrorsInternalV1,
      CapturedObjectFreezeV1([this]),
    );
    CapturedObjectFreezeV1(this);
  }
}

export function isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointPreparationDiagnosticErrorInternalV1(
  value: unknown,
): value is ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointPreparationDiagnosticErrorInternalV1 {
  return value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    CapturedReflectApplyV1(
      CapturedWeakSetPrototypeHasV1,
      endpointPreparationDiagnosticErrorsInternalV1,
      CapturedObjectFreezeV1([value]),
    ) === true;
}

function endpointPreparationFailV1(
  stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointPreparationDiagnosticStageInternalV1,
  reason: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointPreparationDiagnosticReasonInternalV1,
): never {
  throw new ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointPreparationDiagnosticErrorInternalV1(
    stage,
    reason,
  );
}

function rethrowEndpointPreparationOrFailV1(
  error: unknown,
  stage: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointPreparationDiagnosticStageInternalV1,
  reason: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointPreparationDiagnosticReasonInternalV1,
): never {
  if (
    isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointPreparationDiagnosticErrorInternalV1(
      error,
    )
  ) {
    throw error;
  }
  return endpointPreparationFailV1(stage, reason);
}

function isObjectIdentityV1(value: unknown): value is object {
  return value !== null &&
    (typeof value === "object" || typeof value === "function");
}

function weakMapGetV1<K extends object, V>(
  map: WeakMap<K, V>,
  key: K,
): V | undefined {
  return CapturedReflectApplyV1(
    CapturedWeakMapPrototypeGetV1,
    map,
    CapturedObjectFreezeV1([key]),
  ) as V | undefined;
}

function weakMapDeleteV1<K extends object>(
  map: WeakMap<K, unknown>,
  key: K,
): boolean {
  return CapturedReflectApplyV1(
    CapturedWeakMapPrototypeDeleteV1,
    map,
    CapturedObjectFreezeV1([key]),
  ) as boolean;
}

function weakMapSetV1<K extends object, V>(
  map: WeakMap<K, V>,
  key: K,
  value: V,
): void {
  CapturedReflectApplyV1(
    CapturedWeakMapPrototypeSetV1,
    map,
    CapturedObjectFreezeV1([key, value]),
  );
}

/** Read only known own-data descriptors; never enumerate an untrusted object. */
function readKnownOwnDataFieldsV1(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  if (!isObjectIdentityV1(value)) return undefined;
  const output = CapturedObjectCreateV1(null) as Record<string, unknown>;
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]!;
    const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(value, key);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      return undefined;
    }
    output[key] = descriptor.value;
  }
  return CapturedObjectFreezeV1(output);
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  return canonicalizeJcsSafeIntegerV1(left) ===
    canonicalizeJcsSafeIntegerV1(right);
}

function parseProjectionClaimsV1(
  value: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointProjectionClaimsInternalV1 {
  const fields = readKnownOwnDataFieldsV1(
    value,
    PROJECTION_CLAIM_KEYS_V1,
  );
  if (fields === undefined) {
    return endpointPreparationFailV1(
      "endpoint_trust",
      "trust_closure_invalid",
    );
  }
  let source: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1;
  try {
    source =
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1Schema.parse(
        fields.sourceTrust,
      );
  } catch {
    return endpointPreparationFailV1(
      "endpoint_trust",
      "trust_closure_invalid",
    );
  }
  let destination: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1;
  try {
    destination =
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1Schema.parse(
        fields.destinationTrust,
      );
  } catch {
    return endpointPreparationFailV1(
      "prospective_destination_evidence",
      "destination_evidence_invalid",
    );
  }
  if (
    source.role !== "source_current_strong_writer" ||
    destination.role !== "destination_prospective_not_selected"
  ) {
    return endpointPreparationFailV1(
      "endpoint_trust",
      "trust_closure_invalid",
    );
  }
  let namespaceTranslation:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceCandidateV1;
  try {
    namespaceTranslation =
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceCandidateV1Schema.parse(
        fields.namespaceTranslation,
      );
  } catch {
    return endpointPreparationFailV1(
      "endpoint_trust",
      "trust_closure_invalid",
    );
  }
  return deepFreezeProviderPointDetachedDataTreeV1({
    sourceTrust: source,
    destinationTrust: destination,
    namespaceTranslation,
  }) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointProjectionClaimsInternalV1;
}

/**
 * Trusted transport adapter for an already decoded, prelimited and detached
 * endpoint cut.  The one-shot challenge is the authority; this function is
 * intentionally not a raw DTO or hostile-bytes parser.
 */
export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointCutCapabilityInternalV1(
  challenge: unknown,
  input: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointCutCapabilityInternalV1 {
  if (!isObjectIdentityV1(challenge)) {
    throw new CapturedTypeErrorV1("endpoint cut challenge invalid");
  }
  const binding = weakMapGetV1(
    endpointCutChallengeBindingsInternalV1,
    challenge,
  );
  if (
    binding === undefined ||
    !weakMapDeleteV1(endpointCutChallengeBindingsInternalV1, challenge)
  ) {
    throw new CapturedTypeErrorV1("endpoint cut challenge unavailable");
  }
  const fields = readKnownOwnDataFieldsV1(
    input,
    ENDPOINT_OBSERVATION_KEYS_V1,
  );
  if (
    fields === undefined ||
    !isObjectIdentityV1(fields.sourceStoreManifest) ||
    !isObjectIdentityV1(fields.initialDestinationNamespace)
  ) {
    throw new CapturedTypeErrorV1("trusted endpoint cut invalid");
  }
  const cut = deepFreezeProviderPointDetachedDataTreeV1({
    sourceStoreManifest: fields.sourceStoreManifest,
    initialDestinationNamespace: fields.initialDestinationNamespace,
  }) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTrustedDecodedEndpointCutInternalV1;
  const capability = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointCutCapabilityInternalV1;
  weakMapSetV1(
    endpointCutCapabilityContextsInternalV1,
    capability,
    CapturedObjectFreezeV1({ challenge, binding, cut }),
  );
  weakMapSetV1(
    endpointCutMintedCapabilitiesByChallengeInternalV1,
    challenge,
    capability,
  );
  return capability;
}

function invalidateEndpointCutChallengeV1(
  challenge: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointCutMintChallengeInternalV1,
): void {
  weakMapDeleteV1(endpointCutChallengeBindingsInternalV1, challenge);
  const minted = weakMapGetV1(
    endpointCutMintedCapabilitiesByChallengeInternalV1,
    challenge,
  );
  weakMapDeleteV1(
    endpointCutMintedCapabilitiesByChallengeInternalV1,
    challenge,
  );
  if (minted !== undefined) {
    weakMapDeleteV1(endpointCutCapabilityContextsInternalV1, minted);
  }
}

function takeEndpointCutCapabilityV1(
  value: unknown,
  challenge: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointCutMintChallengeInternalV1,
  expectedBinding: EndpointCutChallengeBindingInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTrustedDecodedEndpointCutInternalV1 {
  if (!isObjectIdentityV1(value)) {
    return endpointPreparationFailV1(
      expectedBinding.phase === "pre" ? "pre_observation" : "post_observation",
      "snapshot_changed",
    );
  }
  const context = weakMapGetV1(endpointCutCapabilityContextsInternalV1, value);
  if (
    context === undefined ||
    context.challenge !== challenge ||
    context.binding !== expectedBinding ||
    !weakMapDeleteV1(endpointCutCapabilityContextsInternalV1, value)
  ) {
    return endpointPreparationFailV1(
      expectedBinding.phase === "pre" ? "pre_observation" : "post_observation",
      "snapshot_changed",
    );
  }
  weakMapDeleteV1(
    endpointCutMintedCapabilitiesByChallengeInternalV1,
    challenge,
  );
  return context.cut;
}

async function captureTrustedEndpointCutV1(
  captureHost: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointObservationHostInternalV1["captureEndpointObservation"],
  endpointObservationHostIdentity: object,
  endpointContextIdentity: object,
  acceptanceClosureIdentity: object,
  sourceStreamHostIdentity: object,
  phase: "pre" | "post",
  sequence: 1 | 2,
): Promise<DeliveredEndpointCutEnvelopeInternalV1> {
  const binding = CapturedObjectFreezeV1({
    endpointContextIdentity,
    acceptanceClosureIdentity,
    endpointObservationHostIdentity,
    phase,
    sequence,
    sourceStreamHostIdentity,
  });
  const challenge = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointCutMintChallengeInternalV1;
  weakMapSetV1(endpointCutChallengeBindingsInternalV1, challenge, binding);
  let resolveDelivery!: (value: DeliveredEndpointCutEnvelopeInternalV1) => void;
  let rejectDelivery!: (reason: unknown) => void;
  const delivery = new CapturedPromiseV1<DeliveredEndpointCutEnvelopeInternalV1>(
    (resolve, reject) => {
      resolveDelivery = resolve;
      rejectDelivery = reject;
    },
  );
  let hostReturned = false;
  let terminal = false;
  let delivered: DeliveredEndpointCutEnvelopeInternalV1 | undefined;
  const deliverEndpointCutCapability = CapturedObjectFreezeV1(
    (value: unknown): void => {
      if (terminal || delivered !== undefined) {
        throw new CapturedTypeErrorV1("endpoint cut delivery replayed");
      }
      let cut: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTrustedDecodedEndpointCutInternalV1;
      try {
        // Identity lookup/delete occurs synchronously inside the callback;
        // Promise/thenable assimilation never observes the delivered value.
        cut = takeEndpointCutCapabilityV1(value, challenge, binding);
      } catch (error) {
        terminal = true;
        rejectDelivery(error);
        throw error;
      }
      delivered = createProviderNonThenableFrozenRecordV1({ cut });
      if (hostReturned) {
        terminal = true;
        resolveDelivery(delivered);
      }
    },
  );
  const rejectEndpointObservation = CapturedObjectFreezeV1((): void => {
    if (terminal) return;
    terminal = true;
    rejectDelivery(new CapturedTypeErrorV1("endpoint observation rejected"));
  });
  try {
    try {
      // The host return value is deliberately ignored.  Only callback
      // delivery can cross this boundary, so a hostile returned thenable is
      // never inspected.
      captureHost(
        CapturedObjectFreezeV1({
          phase,
          endpointCutMintChallenge: challenge,
          deliverEndpointCutCapability,
          rejectEndpointObservation,
        }),
      );
      hostReturned = true;
      if (delivered !== undefined && !terminal) {
        terminal = true;
        resolveDelivery(delivered);
      }
    } catch (error) {
      if (!terminal) {
        terminal = true;
        rejectDelivery(error);
      }
    }
    return await delivery;
  } finally {
    invalidateEndpointCutChallengeV1(challenge);
  }
}

function findActiveApproverRecordsV1(
  destination: DestinationEndpointTrustV1,
): Readonly<{
  qa: ProviderFeasibilityApproverPublicKeyV1;
  release: ProviderFeasibilityApproverPublicKeyV1;
}> {
  const keys = destination.authorization.prospectiveDestinationCut
    .prospectiveRegistryEntry.feasibilityApprovalKeys;
  let qa: ProviderFeasibilityApproverPublicKeyV1 | undefined;
  let release: ProviderFeasibilityApproverPublicKeyV1 | undefined;
  for (let index = 0; index < keys.publicKeyRecords.length; index += 1) {
    const record = keys.publicKeyRecords[index]!;
    if (record.role === "qa" && record.keyId === keys.activeKeyIds.qa) {
      if (qa !== undefined) throw new CapturedTypeErrorV1("duplicate QA key");
      qa = record;
    }
    if (
      record.role === "release" &&
      record.keyId === keys.activeKeyIds.release
    ) {
      if (release !== undefined) {
        throw new CapturedTypeErrorV1("duplicate release key");
      }
      release = record;
    }
  }
  for (let index = 0; index < keys.compromisedRevokedKeyIds.length; index += 1) {
    const revoked = keys.compromisedRevokedKeyIds[index]!;
    if (revoked === keys.activeKeyIds.qa || revoked === keys.activeKeyIds.release) {
      throw new CapturedTypeErrorV1("active approver key revoked");
    }
  }
  if (qa === undefined || release === undefined) {
    throw new CapturedTypeErrorV1("active approver key missing");
  }
  return CapturedObjectFreezeV1({ qa, release });
}

function assertProjectionAgainstD40AndD39V1(
  basis: ProviderStrongReadyBootstrapOrSteadyAcceptanceD41EndpointTrustBasisInternalV1,
  projection: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalVerifiedEndpointProjectionInternalV1,
): void {
  const validation = basis.acceptanceClosureIdentity;
  const namespace = validation.referenceState.namespace;
  if (namespace.state !== "current") {
    return endpointPreparationFailV1(
      "current_strong_source",
      "source_not_current_strong_writer",
    );
  }
  const source = projection.sourceTrust;
  const destination = projection.destinationTrust;
  const identity = validation.acceptanceCompareAppendRequest
    .installationIdentityGenerationId;
  if (
    source.installationIdentityGenerationId !== identity ||
    destination.installationIdentityGenerationId !== identity ||
    !canonicalEqualV1(source.currentAcceptanceRead, namespace.currentRead) ||
    !canonicalEqualV1(destination.currentAcceptanceRead, namespace.currentRead) ||
    !canonicalEqualV1(source.retainedAcceptanceGenerations, namespace.generations) ||
    !canonicalEqualV1(destination.retainedAcceptanceGenerations, namespace.generations)
  ) {
    return endpointPreparationFailV1(
      "endpoint_trust",
      "trust_closure_invalid",
    );
  }
  const selected =
    deriveProviderTrustedLocalStrongWriterSelectionCandidateInternalV1(
      basis.physicalTargetSelection,
    ).selectedActiveWriter;
  if (!canonicalEqualV1(source.currentWriterSelection, selected)) {
    return endpointPreparationFailV1(
      "current_strong_source",
      "source_not_current_strong_writer",
    );
  }
  const acceptedCore = validation.acceptanceCompareAppendRequest.candidate
    .payload.configuration.core;
  const registryClosure = basis.distributionHistoryClosure.catalogPointClosure
    .registryManifestHistoryClosure;
  if (
    !canonicalEqualV1(acceptedCore.activeRootMetadata, registryClosure.currentRootMetadata) ||
    !canonicalEqualV1(acceptedCore.providerRegistryManifest, registryClosure.currentRegistryManifest) ||
    !canonicalEqualV1(
      acceptedCore.providerSupportCatalog,
      basis.physicalTargetSelection.providerFeasibilitySupportCatalogPin,
    )
  ) {
    return endpointPreparationFailV1(
      "endpoint_trust",
      "trust_closure_invalid",
    );
  }
  const cut = destination.authorization.prospectiveDestinationCut;
  const currentManifest =
    registryClosure.registryManifestHistory[
      registryClosure.registryManifestHistory.length - 1
    ];
  const currentCatalog = basis.distributionHistoryClosure.catalogPointClosure
    .providerFeasibilitySupportCatalog;
  const currentUniverse = basis.distributionHistoryClosure.catalogPointClosure
    .releaseTargetUniversePointClosure.releaseTargetUniverse;
  if (
    currentManifest === undefined ||
    !canonicalEqualV1(cut.activeRootMetadata, registryClosure.currentRootMetadata) ||
    !canonicalEqualV1(cut.currentSteadyRegistryManifestEnvelope, currentManifest) ||
    !canonicalEqualV1(cut.currentSupportCatalogEnvelope, currentCatalog) ||
    !canonicalEqualV1(cut.currentReleaseTargetUniverseEnvelope, currentUniverse)
  ) {
    return endpointPreparationFailV1(
      "prospective_destination_evidence",
      "destination_evidence_invalid",
    );
  }
  const sourceBinding = projection.initialSourceStoreManifest.providerBinding;
  if (
    sourceBinding.targetProfileId !== selected.targetProfileId ||
    sourceBinding.providerId !== selected.providerId ||
    sourceBinding.registryEntryContentDigest !== selected.registryEntryContentDigest ||
    sourceBinding.semanticProviderPolicyDigest !== selected.semanticProviderPolicyDigest ||
    !canonicalEqualV1(sourceBinding.providerFeasibilityEvidence, selected.providerFeasibilityEvidence) ||
    sourceBinding.runtimeAttestationContentDigest !== selected.runtimeAttestationContentDigest ||
    sourceBinding.bindingDerivationKeyGeneration !== selected.bindingDerivationKeyGeneration ||
    projection.initialSourceStoreManifest.namespace.installationIdentityGenerationId !== identity ||
    !canonicalEqualV1(
      projection.namespaceTranslation.sourceNamespace,
      projection.initialSourceStoreManifest.namespace,
    )
  ) {
    return endpointPreparationFailV1(
      "current_strong_source",
      "source_invalid",
    );
  }
}

function destinationObservationDigestV1(
  destination: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalInitialDestinationNamespaceReferenceCandidateV1,
): ContentDigestV1 {
  return destination.state === "absent"
    ? destination.absenceReferenceDigest
    : destination.current.cutContentDigest;
}

function endpointObservationV1(
  projection: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalVerifiedEndpointProjectionInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointObservationInternalV1 {
  return createProviderNonThenableFrozenRecordV1({
    sourceStoreCutContentDigest: projection.initialSourceStoreManifest.cutContentDigest,
    sourceTrustClosureContentDigest: projection.sourceTrust.trustClosureContentDigest,
    destinationTrustClosureContentDigest: projection.destinationTrust.trustClosureContentDigest,
    destinationNamespaceObservationDigest:
      destinationObservationDigestV1(projection.initialDestinationNamespace),
  });
}

function buildEvidenceInputV1(
  rawSource: unknown,
  qa: ProviderFeasibilityApproverPublicKeyV1,
  release: ProviderFeasibilityApproverPublicKeyV1,
  strictCryptoCapability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceD41EndpointTrustBasisInternalV1["strictCryptoCapability"],
): ValidateProviderFeasibilityEvidencePointClosureV1Input {
  const fields = readKnownOwnDataFieldsV1(rawSource, EVIDENCE_SOURCE_KEYS_V1);
  if (fields === undefined) throw new CapturedTypeErrorV1("Evidence source invalid");
  return CapturedObjectFreezeV1({
    activeRoot: fields.activeRoot,
    activeRootMetadata: fields.activeRootMetadata,
    distributionRootBinding: fields.distributionRootBinding,
    fixtureCorpusManifest: fields.fixtureCorpusManifest,
    providerFeasibilityEvidence: fields.providerFeasibilityEvidence,
    providerFeasibilityEvidencePin: fields.providerFeasibilityEvidencePin,
    publicSupportTaxonomy: fields.publicSupportTaxonomy,
    qaApproverPublicKey: qa,
    realFilesystemConformanceResult: fields.realFilesystemConformanceResult,
    realFilesystemConformanceResultLocator:
      fields.realFilesystemConformanceResultLocator,
    realFilesystemConformanceResultPin:
      fields.realFilesystemConformanceResultPin,
    releaseApproverPublicKey: release,
    releaseMatrix: fields.releaseMatrix,
    runtimeAttestation: fields.runtimeAttestation,
    semanticProviderPolicy: fields.semanticProviderPolicy,
    strictCryptoCapability,
    suiteManifest: fields.suiteManifest,
    targetDiscoveryFixtureManifest: fields.targetDiscoveryFixtureManifest,
    targetDiscoveryResult: fields.targetDiscoveryResult,
    targetDiscoveryRunnerRun: fields.targetDiscoveryRunnerRun,
  }) as ValidateProviderFeasibilityEvidencePointClosureV1Input;
}

/**
 * Package-private adapter for data that has already crossed a bounded
 * transport decoder.  It deliberately is not a hostile-bytes parser.  The
 * resulting zero-key identity is the only prospective DTO source accepted by
 * the audited pre-plan mint.
 */
export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationPreparedSourceCapabilityInternalV1(
  input: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationPreparedSourceCapabilityInternalV1 {
  const fields = readKnownOwnDataFieldsV1(
    input,
    PREPARED_SOURCE_INPUT_KEYS_V1,
  );
  if (fields === undefined) {
    throw new CapturedTypeErrorV1("prepared destination source input invalid");
  }
  if (!isObjectIdentityV1(fields.acceptanceClosureIdentity)) {
    throw new CapturedTypeErrorV1("prepared destination source identity invalid");
  }
  const endpointProjectionClaims = parseProjectionClaimsV1(
    fields.endpointProjectionClaims,
  );
  const evidenceFields = readKnownOwnDataFieldsV1(
    fields.evidenceValidationSource,
    EVIDENCE_SOURCE_KEYS_V1,
  );
  if (evidenceFields === undefined) {
    throw new CapturedTypeErrorV1("prepared Evidence source input invalid");
  }
  const exactEvidenceSource = CapturedObjectCreateV1(null) as Record<
    string,
    unknown
  >;
  for (let index = 0; index < EVIDENCE_SOURCE_KEYS_V1.length; index += 1) {
    const key = EVIDENCE_SOURCE_KEYS_V1[index]!;
    exactEvidenceSource[key] = evidenceFields[key];
  }
  const evidenceValidationSource =
    deepFreezeProviderPointDetachedDataTreeV1(
      CapturedObjectFreezeV1(exactEvidenceSource),
    ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalDestinationEvidenceValidationSourceInternalV1;
  const capability = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationPreparedSourceCapabilityInternalV1;
  weakMapSetV1(
    prospectiveDestinationPreparedSourceContextsInternalV1,
    capability,
    CapturedObjectFreezeV1({
      acceptanceClosureIdentity: fields.acceptanceClosureIdentity,
      endpointProjectionClaims,
      evidenceValidationSource,
    }),
  );
  return capability;
}

function takeProspectiveDestinationPreparedSourceV1(
  capability: unknown,
  acceptanceClosureIdentity: unknown,
): ProspectiveDestinationPreparedSourceContextInternalV1 {
  if (!isObjectIdentityV1(capability)) {
    return endpointPreparationFailV1(
      "prospective_destination_evidence",
      "destination_evidence_invalid",
    );
  }
  const context = weakMapGetV1(
    prospectiveDestinationPreparedSourceContextsInternalV1,
    capability,
  );
  if (
    context === undefined ||
    context.acceptanceClosureIdentity !== acceptanceClosureIdentity ||
    !weakMapDeleteV1(
      prospectiveDestinationPreparedSourceContextsInternalV1,
      capability,
    )
  ) {
    return endpointPreparationFailV1(
      "prospective_destination_evidence",
      "destination_evidence_invalid",
    );
  }
  return context;
}

async function prepareEndpointTrustInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedEndpointTrustInternalV1> {
  const fields = readKnownOwnDataFieldsV1(input, PREPARE_INPUT_KEYS_V1);
  if (fields === undefined) {
    return endpointPreparationFailV1(
      "endpoint_trust",
      "trust_closure_invalid",
    );
  }
  const hostFields = readKnownOwnDataFieldsV1(
    fields.endpointObservationHost,
    ENDPOINT_HOST_KEYS_V1,
  );
  if (
    hostFields === undefined ||
    typeof hostFields.captureEndpointObservation !== "function" ||
    !isObjectIdentityV1(fields.sourceStreamHost)
  ) {
    return endpointPreparationFailV1(
      "endpoint_trust",
      "trust_closure_invalid",
    );
  }
  const captureHost = hostFields.captureEndpointObservation as
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointObservationHostInternalV1["captureEndpointObservation"];
  const endpointObservationHostIdentity =
    fields.endpointObservationHost as object;
  const sourceStreamHostIdentity = fields.sourceStreamHost as object;
  const endpointContextIdentity = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  );

  // A foreign D-40 pairing must not burn either nominal identity.  Once the
  // binding matches, burn both synchronously before any await or validation.
  const preparedSource = takeProspectiveDestinationPreparedSourceV1(
    fields.prospectiveDestinationPreparedSourceCapability,
    fields.acceptanceClosureIdentity,
  );
  let basis: ProviderStrongReadyBootstrapOrSteadyAcceptanceD41EndpointTrustBasisInternalV1;
  try {
    basis =
      takeProviderStrongReadyBootstrapOrSteadyAcceptanceD41EndpointTrustBasisInternalV1(
        fields.acceptanceClosureIdentity,
      );
  } catch (error) {
    return rethrowEndpointPreparationOrFailV1(
      error,
      "current_strong_source",
      "source_not_current_strong_writer",
    );
  }
  const claims = preparedSource.endpointProjectionClaims;
  let approvers: ReturnType<typeof findActiveApproverRecordsV1>;
  let evidenceInput: ValidateProviderFeasibilityEvidencePointClosureV1Input;
  let registryCapability: ReturnType<
    typeof mintProviderRegistryProspectiveEntryTemporaryAdmissionCapabilityInternalV1
  >;
  let evidenceHandle:
    ProviderFeasibilityEvidenceRegistryTrustedApproverHandleV1 | undefined;
  let evidenceConsumed = false;
  try {
    approvers = findActiveApproverRecordsV1(claims.destinationTrust);
    evidenceInput = buildEvidenceInputV1(
      preparedSource.evidenceValidationSource,
      approvers.qa,
      approvers.release,
      basis.strictCryptoCapability,
    );
    registryCapability =
      mintProviderRegistryProspectiveEntryTemporaryAdmissionCapabilityInternalV1(
        basis.distributionHistoryClosure.catalogPointClosure
          .registryManifestHistoryClosure,
        basis.strictCryptoCapability,
      );
    evidenceHandle =
      registerProviderFeasibilityEvidenceRegistryTrustedApproversInternalV1(
        evidenceInput,
        approvers.qa,
        approvers.release,
        basis.strictCryptoCapability,
      );
  } catch (error) {
    return rethrowEndpointPreparationOrFailV1(
      error,
      "prospective_destination_evidence",
      "destination_evidence_invalid",
    );
  }

  try {
    try {
      await captureProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReadOnlyContinuityInternalV1(
        basis.readOnlyContinuityHandle,
        "endpoint_claim",
      );
    } catch (error) {
      return rethrowEndpointPreparationOrFailV1(
        error,
        "endpoint_trust",
        "snapshot_changed",
      );
    }
    let preCut: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTrustedDecodedEndpointCutInternalV1;
    try {
      preCut = (await captureTrustedEndpointCutV1(
        captureHost,
        endpointObservationHostIdentity,
        endpointContextIdentity,
        basis.acceptanceClosureIdentity,
        sourceStreamHostIdentity,
        "pre",
        1,
      )).cut;
    } catch (error) {
      return rethrowEndpointPreparationOrFailV1(
        error,
        "pre_observation",
        "snapshot_changed",
      );
    }
    let projection: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalVerifiedEndpointProjectionInternalV1;
    try {
      projection = deepFreezeProviderPointDetachedDataTreeV1({
        ...claims,
        initialSourceStoreManifest: preCut.sourceStoreManifest,
        initialDestinationNamespace: preCut.initialDestinationNamespace,
      }) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalVerifiedEndpointProjectionInternalV1;
      assertProjectionAgainstD40AndD39V1(basis, projection);
    } catch (error) {
      return rethrowEndpointPreparationOrFailV1(
        error,
        "endpoint_trust",
        "trust_closure_invalid",
      );
    }

    const cut = claims.destinationTrust.authorization.prospectiveDestinationCut;
    let registry: Awaited<ReturnType<
      typeof diagnoseProviderRegistryProspectiveEntryTemporaryAdmissionInternalV1
    >>;
    try {
      registry =
        await diagnoseProviderRegistryProspectiveEntryTemporaryAdmissionInternalV1(
          registryCapability,
          {
            prospectiveRegistryEntryContentDigest:
              cut.prospectiveRegistryEntryContentDigest,
            prospectiveRegistryEntry: cut.prospectiveRegistryEntry,
          },
        );
    } catch (error) {
      return rethrowEndpointPreparationOrFailV1(
        error,
        "prospective_destination_evidence",
        "destination_evidence_invalid",
      );
    }
    if (
      !registry.ok ||
      registry.value.installationIdentityGenerationId !==
        claims.destinationTrust.installationIdentityGenerationId ||
      registry.value.providerId !==
        claims.destinationTrust.prospectiveWriterProjection.providerId ||
      registry.value.registryEntryContentDigest !==
        cut.prospectiveRegistryEntryContentDigest ||
      registry.value.registryGeneration !== 1 ||
      registry.value.copiedRetainedStateCollectionCount !== 7 ||
      registry.value.retainedStateMutationCount !== 0
    ) {
      return endpointPreparationFailV1(
        "prospective_destination_evidence",
        "destination_evidence_invalid",
      );
    }

    evidenceConsumed = true;
    let evidence: Awaited<ReturnType<
      typeof diagnoseProviderFeasibilityEvidencePointRegistryTrustedPreparedInternalV1
    >>;
    try {
      evidence =
        await diagnoseProviderFeasibilityEvidencePointRegistryTrustedPreparedInternalV1(
          evidenceInput,
          evidenceHandle,
          basis.strictCryptoCapability,
        );
    } catch (error) {
      return rethrowEndpointPreparationOrFailV1(
        error,
        "prospective_destination_evidence",
        "destination_evidence_invalid",
      );
    }
    const retainedTargetDiscovery = basis.distributionHistoryClosure
      .catalogPointClosure.releaseTargetUniversePointClosure
      .targetDiscoveryPointClosure;
    if (
      !evidence.ok ||
      !canonicalEqualV1(evidence.value.providerFeasibilityEvidence, cut.evidenceEnvelope) ||
      !canonicalEqualV1(
        evidence.value.providerFeasibilityEvidencePin,
        cut.prospectiveRegistryEntry.providerFeasibilityEvidence,
      ) ||
      !canonicalEqualV1(
        evidence.value.runtimeAttestationPointClosure.runtimeAttestation,
        cut.prospectiveSupportCandidate.runtimeAttestation,
      ) ||
      !canonicalEqualV1(
        evidence.value.runtimeAttestationPointClosure.semanticProviderPolicy,
        cut.prospectiveSupportCandidate.semanticProviderPolicy,
      ) ||
      !canonicalEqualV1(
        evidence.value.runtimeAttestationPointClosure.conformanceResultClosure
          .targetDiscoveryPoint,
        retainedTargetDiscovery,
      ) ||
      !canonicalEqualV1(
        evidence.value.runtimeAttestationPointClosure.conformanceResultClosure.target,
        cut.target,
      )
    ) {
      return endpointPreparationFailV1(
        "prospective_destination_evidence",
        "destination_evidence_invalid",
      );
    }

    const readOnlyContinuityHandle = basis.readOnlyContinuityHandle;
    let nextPhase: "pre" | "post" | "done" = "pre";
    const preObservation = endpointObservationV1(projection);
    const captureEndpointObservation = CapturedObjectFreezeV1(async (
      phase: "pre" | "post",
    ) => {
      if (phase !== nextPhase) {
        throw new CapturedTypeErrorV1("endpoint observation phase invalid");
      }
      if (phase === "pre") {
        nextPhase = "post";
        try {
          await captureProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReadOnlyContinuityInternalV1(
            readOnlyContinuityHandle,
            "pre",
          );
        } catch (error) {
          return rethrowEndpointPreparationOrFailV1(
            error,
            "endpoint_trust",
            "snapshot_changed",
          );
        }
        return preObservation;
      }
      nextPhase = "done";
      let postCut: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalTrustedDecodedEndpointCutInternalV1;
      try {
        postCut = (await captureTrustedEndpointCutV1(
          captureHost,
          endpointObservationHostIdentity,
          endpointContextIdentity,
          basis.acceptanceClosureIdentity,
          sourceStreamHostIdentity,
          "post",
          2,
        )).cut;
      } catch (error) {
        return rethrowEndpointPreparationOrFailV1(
          error,
          "post_observation",
          "snapshot_changed",
        );
      }
      if (!canonicalEqualV1(preCut, postCut)) {
        return endpointPreparationFailV1(
          "post_observation",
          "snapshot_changed",
        );
      }
      // The D-40 continuity observation is the final await and therefore the
      // linearization point.  A writer mutation while the real endpoint host
      // POST capture is pending cannot slip behind this barrier.
      try {
        await captureProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReadOnlyContinuityInternalV1(
          readOnlyContinuityHandle,
          "post",
        );
      } catch (error) {
        return rethrowEndpointPreparationOrFailV1(
          error,
          "endpoint_trust",
          "snapshot_changed",
        );
      }
      return endpointObservationV1(projection);
    });
    return createProviderNonThenableFrozenRecordV1({
      verifiedEndpointProjection: projection,
      sourceStreamHost:
        fields.sourceStreamHost as
          ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamHostInternalV1,
      captureEndpointObservation,
    });
  } finally {
    if (!evidenceConsumed && evidenceHandle !== undefined) {
      try {
        discardProviderFeasibilityEvidenceRegistryTrustedApproversInternalV1(
          evidenceInput,
          evidenceHandle,
          basis.strictCryptoCapability,
        );
      } catch (error) {
        return rethrowEndpointPreparationOrFailV1(
          error,
          "prospective_destination_evidence",
          "destination_evidence_invalid",
        );
      }
    }
  }
}

export function prepareProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustInternalV1(
  input: unknown,
): Promise<ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedEndpointTrustInternalV1> {
  return hardenProviderPointPromiseV1(prepareEndpointTrustInternalV1(input));
}

CapturedObjectFreezeV1(
  prepareProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustInternalV1,
);
CapturedObjectFreezeV1(
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationPreparedSourceCapabilityInternalV1,
);
CapturedObjectFreezeV1(
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointCutCapabilityInternalV1,
);
CapturedObjectFreezeV1(
  isProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointPreparationDiagnosticErrorInternalV1,
);
CapturedObjectFreezeV1(
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointPreparationDiagnosticErrorInternalV1,
);
