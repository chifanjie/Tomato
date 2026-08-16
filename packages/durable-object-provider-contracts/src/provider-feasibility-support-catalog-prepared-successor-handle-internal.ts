/**
 * Package-private D42 -> D43 retained Catalog successor authority carriers.
 *
 * Handles have zero own keys.  The payload moves through seed -> cohort ->
 * exact final D42 candidate. Foreign tuples are compared before deletion;
 * exact claims are burned synchronously before validation starts.
 */

import type { ProviderBootstrapTrustBundleV1 } from "./bootstrap-trust-bundle.js";
import type {
  InstallationIdentityGenerationIdV1,
  ProviderMigrationIdV1,
} from "./primitives.js";
import type {
  ProviderFeasibilitySupportCatalogEnvelopeV1,
  ProviderFeasibilitySupportCatalogPinV1,
} from "./provider-feasibility-support-catalog-point.js";
import type { ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1 } from "./provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-reference-candidate-wire.js";
import type {
  ProviderRegistryManifestEnvelopeV1,
  ProviderRegistryManifestPinV1,
  StoreDurableObjectProviderRegistryEntryV1,
} from "./provider-registry-records.js";
import type {
  ProviderRegistryRootPublicKeyV1,
} from "./provider-registry-trust.js";
import type { ProviderReleaseTargetUniverseEnvelopeV1 } from "./provider-release-target-universe-point.js";
import type { ProviderStrictEd25519OpaqueCapabilityV1 } from "./strict-ed25519-conformance.js";

const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedObjectCreateV1 = Object.create;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectIsFrozenV1 = Object.isFrozen;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedTypeErrorV1 = TypeError;
const CapturedWeakMapV1 = WeakMap;
const CapturedWeakMapDeleteV1 = CapturedWeakMapV1.prototype.delete;
const CapturedWeakMapGetV1 = CapturedWeakMapV1.prototype.get;
const CapturedWeakMapSetV1 = CapturedWeakMapV1.prototype.set;

function bindUncurriedAtBootstrapV1(method: Function): Function {
  return CapturedObjectFreezeV1(
    CapturedReflectApplyV1(
      CapturedFunctionPrototypeBindV1,
      CapturedFunctionPrototypeCallV1,
      CapturedObjectFreezeV1([method]),
    ) as Function,
  );
}

const weakMapDeleteV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapDeleteV1,
) as <T>(map: WeakMap<object, T>, key: object) => boolean;
const weakMapGetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapGetV1,
) as <T>(map: WeakMap<object, T>, key: object) => T | undefined;
const weakMapSetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapSetV1,
) as <T>(map: WeakMap<object, T>, key: object, value: T) => void;

declare const ProviderFeasibilitySupportCatalogPreparedSuccessorSeedBrandInternalV1:
  unique symbol;
declare const ProviderFeasibilitySupportCatalogPreparedSuccessorCohortCapabilityBrandInternalV1:
  unique symbol;
declare const ProviderFeasibilitySupportCatalogPreparedSuccessorFinalCapabilityBrandInternalV1:
  unique symbol;

export type ProviderFeasibilitySupportCatalogPreparedSuccessorSeedInternalV1 =
  Readonly<Record<never, never>> & {
    readonly [ProviderFeasibilitySupportCatalogPreparedSuccessorSeedBrandInternalV1]: true;
  };

export type ProviderFeasibilitySupportCatalogPreparedSuccessorCohortCapabilityInternalV1 =
  Readonly<Record<never, never>> & {
    readonly [ProviderFeasibilitySupportCatalogPreparedSuccessorCohortCapabilityBrandInternalV1]: true;
  };

export type ProviderFeasibilitySupportCatalogPreparedSuccessorFinalCapabilityInternalV1 =
  Readonly<Record<never, never>> & {
    readonly [ProviderFeasibilitySupportCatalogPreparedSuccessorFinalCapabilityBrandInternalV1]: true;
  };

export interface ProviderFeasibilitySupportCatalogPreparedSuccessorRetainedPayloadInternalV1 {
  readonly installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  readonly exactD41CandidateIdentity: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1;
  readonly currentRoot: ProviderRegistryRootPublicKeyV1;
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
  readonly policy: ProviderBootstrapTrustBundleV1["providerTrustHistoryPolicy"];
  readonly currentSupportCatalogEnvelope: ProviderFeasibilitySupportCatalogEnvelopeV1;
  readonly currentSupportCatalogPin: ProviderFeasibilitySupportCatalogPinV1;
  readonly currentReleaseTargetUniverseEnvelope: ProviderReleaseTargetUniverseEnvelopeV1;
  readonly preparedRegistryManifestEnvelope: ProviderRegistryManifestEnvelopeV1;
  readonly preparedRegistryManifestPin: ProviderRegistryManifestPinV1;
  readonly preparedRegistryRelationship:
    "root_signed_direct_successor_of_same_cohort_retained_steady_tip_candidate_not_current_or_published_v1";
  readonly formalMigrationId: ProviderMigrationIdV1;
  readonly sourceProviderId: StoreDurableObjectProviderRegistryEntryV1["providerId"];
  readonly destinationProviderId: StoreDurableObjectProviderRegistryEntryV1["providerId"];
  readonly prospectiveRegistryEntry: StoreDurableObjectProviderRegistryEntryV1;
  readonly retainedTrustHistoryCanonicalBytesIncludingPreparedRegistry: number;
  readonly validatedRegistryManifestGenerationCountIncludingPreparedRegistry: number;
}

interface SeedEntryInternalV1 {
  readonly seed: ProviderFeasibilitySupportCatalogPreparedSuccessorSeedInternalV1;
  readonly payload: ProviderFeasibilitySupportCatalogPreparedSuccessorRetainedPayloadInternalV1;
}

interface CohortEntryInternalV1 {
  readonly cohortIdentity: object;
  readonly capability: ProviderFeasibilitySupportCatalogPreparedSuccessorCohortCapabilityInternalV1;
  readonly payload: ProviderFeasibilitySupportCatalogPreparedSuccessorRetainedPayloadInternalV1;
}

interface FinalEntryInternalV1 {
  readonly finalCandidateIdentity: object;
  readonly capability: ProviderFeasibilitySupportCatalogPreparedSuccessorFinalCapabilityInternalV1;
  readonly payload: ProviderFeasibilitySupportCatalogPreparedSuccessorRetainedPayloadInternalV1;
}

const seedEntriesInternalV1 = new CapturedWeakMapV1<object, SeedEntryInternalV1>();
const cohortEntriesInternalV1 = new CapturedWeakMapV1<object, CohortEntryInternalV1>();
const finalEntriesInternalV1 = new CapturedWeakMapV1<object, FinalEntryInternalV1>();

function isObjectIdentityInternalV1(value: unknown): value is object {
  return value !== null &&
    (typeof value === "object" || typeof value === "function");
}

function createOpaqueHandleInternalV1<T extends object>(): T {
  return CapturedObjectFreezeV1(CapturedObjectCreateV1(null)) as T;
}

function burnCohortEntryInternalV1(entry: CohortEntryInternalV1): boolean {
  if (
    weakMapGetV1(cohortEntriesInternalV1, entry.cohortIdentity) !== entry ||
    weakMapGetV1(cohortEntriesInternalV1, entry.capability) !== entry
  ) return false;
  return weakMapDeleteV1(cohortEntriesInternalV1, entry.cohortIdentity) &&
    weakMapDeleteV1(cohortEntriesInternalV1, entry.capability);
}

function burnFinalEntryInternalV1(entry: FinalEntryInternalV1): boolean {
  if (
    weakMapGetV1(finalEntriesInternalV1, entry.finalCandidateIdentity) !== entry ||
    weakMapGetV1(finalEntriesInternalV1, entry.capability) !== entry
  ) return false;
  return weakMapDeleteV1(finalEntriesInternalV1, entry.finalCandidateIdentity) &&
    weakMapDeleteV1(finalEntriesInternalV1, entry.capability);
}

export function registerProviderFeasibilitySupportCatalogPreparedSuccessorSeedInternalV1(
  payload: ProviderFeasibilitySupportCatalogPreparedSuccessorRetainedPayloadInternalV1,
): ProviderFeasibilitySupportCatalogPreparedSuccessorSeedInternalV1 {
  if (
    !CapturedObjectIsFrozenV1(payload) ||
    !CapturedObjectIsFrozenV1(payload.exactD41CandidateIdentity) ||
    !CapturedObjectIsFrozenV1(payload.currentRoot) ||
    !CapturedObjectIsFrozenV1(payload.currentSupportCatalogEnvelope) ||
    !CapturedObjectIsFrozenV1(payload.currentSupportCatalogPin) ||
    !CapturedObjectIsFrozenV1(payload.currentReleaseTargetUniverseEnvelope) ||
    !CapturedObjectIsFrozenV1(payload.preparedRegistryManifestEnvelope) ||
    !CapturedObjectIsFrozenV1(payload.preparedRegistryManifestPin) ||
    !CapturedObjectIsFrozenV1(payload.prospectiveRegistryEntry)
  ) {
    throw new CapturedTypeErrorV1("prepared Catalog successor retained payload is invalid");
  }
  const seed = createOpaqueHandleInternalV1<ProviderFeasibilitySupportCatalogPreparedSuccessorSeedInternalV1>();
  weakMapSetV1(
    seedEntriesInternalV1,
    seed,
    CapturedObjectFreezeV1({ seed, payload }),
  );
  return seed;
}

export function bindProviderFeasibilitySupportCatalogPreparedSuccessorSeedToCohortInternalV1(
  seed: ProviderFeasibilitySupportCatalogPreparedSuccessorSeedInternalV1,
  cohortIdentity: object,
): ProviderFeasibilitySupportCatalogPreparedSuccessorCohortCapabilityInternalV1 {
  if (
    !isObjectIdentityInternalV1(seed) ||
    !isObjectIdentityInternalV1(cohortIdentity) ||
    !CapturedObjectIsFrozenV1(cohortIdentity)
  ) throw new CapturedTypeErrorV1("prepared Catalog successor cohort binding is invalid");
  const entry = weakMapGetV1(seedEntriesInternalV1, seed);
  if (entry === undefined || entry.seed !== seed) {
    throw new CapturedTypeErrorV1("prepared Catalog successor seed is unavailable");
  }
  if (weakMapGetV1(cohortEntriesInternalV1, cohortIdentity) !== undefined) {
    throw new CapturedTypeErrorV1("prepared Catalog successor cohort is already bound");
  }
  if (!weakMapDeleteV1(seedEntriesInternalV1, seed)) {
    throw new CapturedTypeErrorV1("prepared Catalog successor seed state is inconsistent");
  }
  const capability = createOpaqueHandleInternalV1<ProviderFeasibilitySupportCatalogPreparedSuccessorCohortCapabilityInternalV1>();
  const cohortEntry = CapturedObjectFreezeV1({
    cohortIdentity,
    capability,
    payload: entry.payload,
  });
  weakMapSetV1(cohortEntriesInternalV1, cohortIdentity, cohortEntry);
  weakMapSetV1(cohortEntriesInternalV1, capability, cohortEntry);
  return capability;
}

export function bindProviderFeasibilitySupportCatalogPreparedSuccessorCohortToFinalCandidateInternalV1(
  cohortIdentity: object,
  cohortCapability: ProviderFeasibilitySupportCatalogPreparedSuccessorCohortCapabilityInternalV1,
  exactFinalCandidateIdentity: object,
): ProviderFeasibilitySupportCatalogPreparedSuccessorFinalCapabilityInternalV1 {
  if (
    !isObjectIdentityInternalV1(cohortIdentity) ||
    !isObjectIdentityInternalV1(cohortCapability) ||
    !isObjectIdentityInternalV1(exactFinalCandidateIdentity) ||
    !CapturedObjectIsFrozenV1(exactFinalCandidateIdentity)
  ) throw new CapturedTypeErrorV1("prepared Catalog successor final binding is invalid");
  if (weakMapGetV1(finalEntriesInternalV1, exactFinalCandidateIdentity) !== undefined) {
    throw new CapturedTypeErrorV1("prepared Catalog successor final candidate is already bound");
  }
  const entryByIdentity = weakMapGetV1(cohortEntriesInternalV1, cohortIdentity);
  const entryByCapability = weakMapGetV1(cohortEntriesInternalV1, cohortCapability);
  if (
    entryByIdentity === undefined ||
    entryByIdentity !== entryByCapability ||
    entryByIdentity.cohortIdentity !== cohortIdentity ||
    entryByIdentity.capability !== cohortCapability
  ) throw new CapturedTypeErrorV1("prepared Catalog successor cohort is unavailable");
  if (!burnCohortEntryInternalV1(entryByIdentity)) {
    throw new CapturedTypeErrorV1("prepared Catalog successor cohort state is inconsistent");
  }
  const capability = createOpaqueHandleInternalV1<ProviderFeasibilitySupportCatalogPreparedSuccessorFinalCapabilityInternalV1>();
  const finalEntry = CapturedObjectFreezeV1({
    finalCandidateIdentity: exactFinalCandidateIdentity,
    capability,
    payload: entryByIdentity.payload,
  });
  weakMapSetV1(finalEntriesInternalV1, exactFinalCandidateIdentity, finalEntry);
  weakMapSetV1(finalEntriesInternalV1, capability, finalEntry);
  return capability;
}

export function takeProviderFeasibilitySupportCatalogPreparedSuccessorFinalCandidateInternalV1(
  exactFinalCandidateIdentity: unknown,
  finalCapability: ProviderFeasibilitySupportCatalogPreparedSuccessorFinalCapabilityInternalV1,
): ProviderFeasibilitySupportCatalogPreparedSuccessorRetainedPayloadInternalV1 | undefined {
  if (!isObjectIdentityInternalV1(exactFinalCandidateIdentity) || !isObjectIdentityInternalV1(finalCapability)) return undefined;
  const entryByIdentity = weakMapGetV1(finalEntriesInternalV1, exactFinalCandidateIdentity);
  const entryByCapability = weakMapGetV1(finalEntriesInternalV1, finalCapability);
  if (
    entryByIdentity === undefined ||
    entryByIdentity !== entryByCapability ||
    entryByIdentity.finalCandidateIdentity !== exactFinalCandidateIdentity ||
    entryByIdentity.capability !== finalCapability
  ) return undefined;
  if (!burnFinalEntryInternalV1(entryByIdentity)) {
    throw new CapturedTypeErrorV1("prepared Catalog successor final state is inconsistent");
  }
  return entryByIdentity.payload;
}

export function discardProviderFeasibilitySupportCatalogPreparedSuccessorSeedInternalV1(
  seed: ProviderFeasibilitySupportCatalogPreparedSuccessorSeedInternalV1,
): boolean {
  if (!isObjectIdentityInternalV1(seed)) return false;
  const entry = weakMapGetV1(seedEntriesInternalV1, seed);
  return entry !== undefined && entry.seed === seed &&
    weakMapDeleteV1(seedEntriesInternalV1, seed);
}

export function discardProviderFeasibilitySupportCatalogPreparedSuccessorCohortInternalV1(
  cohortIdentity: unknown,
  cohortCapability: ProviderFeasibilitySupportCatalogPreparedSuccessorCohortCapabilityInternalV1,
): boolean {
  if (!isObjectIdentityInternalV1(cohortIdentity) || !isObjectIdentityInternalV1(cohortCapability)) return false;
  const entryByIdentity = weakMapGetV1(cohortEntriesInternalV1, cohortIdentity);
  const entryByCapability = weakMapGetV1(cohortEntriesInternalV1, cohortCapability);
  if (
    entryByIdentity === undefined || entryByIdentity !== entryByCapability ||
    entryByIdentity.cohortIdentity !== cohortIdentity ||
    entryByIdentity.capability !== cohortCapability
  ) return false;
  if (!burnCohortEntryInternalV1(entryByIdentity)) {
    throw new CapturedTypeErrorV1("prepared Catalog successor cohort state is inconsistent");
  }
  return true;
}

export function discardProviderFeasibilitySupportCatalogPreparedSuccessorFinalInternalV1(
  exactFinalCandidateIdentity: unknown,
  finalCapability: ProviderFeasibilitySupportCatalogPreparedSuccessorFinalCapabilityInternalV1,
): boolean {
  if (!isObjectIdentityInternalV1(exactFinalCandidateIdentity) || !isObjectIdentityInternalV1(finalCapability)) return false;
  const entryByIdentity = weakMapGetV1(finalEntriesInternalV1, exactFinalCandidateIdentity);
  const entryByCapability = weakMapGetV1(finalEntriesInternalV1, finalCapability);
  if (
    entryByIdentity === undefined || entryByIdentity !== entryByCapability ||
    entryByIdentity.finalCandidateIdentity !== exactFinalCandidateIdentity ||
    entryByIdentity.capability !== finalCapability
  ) return false;
  if (!burnFinalEntryInternalV1(entryByIdentity)) {
    throw new CapturedTypeErrorV1("prepared Catalog successor final state is inconsistent");
  }
  return true;
}

for (const exportedFunctionV1 of [
  registerProviderFeasibilitySupportCatalogPreparedSuccessorSeedInternalV1,
  bindProviderFeasibilitySupportCatalogPreparedSuccessorSeedToCohortInternalV1,
  bindProviderFeasibilitySupportCatalogPreparedSuccessorCohortToFinalCandidateInternalV1,
  takeProviderFeasibilitySupportCatalogPreparedSuccessorFinalCandidateInternalV1,
  discardProviderFeasibilitySupportCatalogPreparedSuccessorSeedInternalV1,
  discardProviderFeasibilitySupportCatalogPreparedSuccessorCohortInternalV1,
  discardProviderFeasibilitySupportCatalogPreparedSuccessorFinalInternalV1,
]) CapturedObjectFreezeV1(exportedFunctionV1);
