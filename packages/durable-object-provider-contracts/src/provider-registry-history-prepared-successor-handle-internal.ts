/**
 * Package-private, process-local authority carriers for the prepared Registry
 * direct-successor path.
 *
 * The handles intentionally have no own keys.  Retained Registry material is
 * kept only in the private WeakMap entries below and moves through three
 * one-shot states: admission seed -> endpoint cohort -> exact final D41
 * candidate.  A foreign tuple is compared before deletion; an exact claim is
 * deleted synchronously before any caller can start asynchronous validation.
 */

import type { ProviderBootstrapTrustBundleV1 } from "./bootstrap-trust-bundle.js";
import type {
  ContentDigestV1,
  InstallationIdentityGenerationIdV1,
} from "./primitives.js";
import type {
  ProviderRegistryManifestEnvelopeV1,
  StoreDurableObjectProviderRegistryEntryV1,
} from "./provider-registry-records.js";
import type {
  ProviderRegistryRootMetadataEnvelopeV1,
  ProviderRegistryRootPublicKeyV1,
} from "./provider-registry-trust.js";
import type { ProviderStrictEd25519OpaqueCapabilityV1 } from "./strict-ed25519-conformance.js";

const CapturedObjectCreateV1 = Object.create;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectIsFrozenV1 = Object.isFrozen;
const CapturedWeakMapV1 = WeakMap;
const CapturedWeakMapDeleteV1 = CapturedWeakMapV1.prototype.delete;
const CapturedWeakMapGetV1 = CapturedWeakMapV1.prototype.get;
const CapturedWeakMapSetV1 = CapturedWeakMapV1.prototype.set;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedTypeErrorV1 = TypeError;

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

declare const ProviderRegistryPreparedSuccessorSeedBrandInternalV1:
  unique symbol;
declare const ProviderRegistryPreparedSuccessorCohortCapabilityBrandInternalV1:
  unique symbol;
declare const ProviderRegistryPreparedSuccessorFinalCapabilityBrandInternalV1:
  unique symbol;

export type ProviderRegistryPreparedSuccessorSeedInternalV1 = Readonly<
  Record<never, never>
> & {
  readonly [ProviderRegistryPreparedSuccessorSeedBrandInternalV1]: true;
};

export type ProviderRegistryPreparedSuccessorCohortCapabilityInternalV1 =
  Readonly<Record<never, never>> & {
    readonly [ProviderRegistryPreparedSuccessorCohortCapabilityBrandInternalV1]: true;
  };

export type ProviderRegistryPreparedSuccessorFinalCapabilityInternalV1 =
  Readonly<Record<never, never>> & {
    readonly [ProviderRegistryPreparedSuccessorFinalCapabilityBrandInternalV1]: true;
  };

/**
 * The retained-state field deliberately remains opaque here.  Its concrete
 * seven-collection type and every operation over it stay in the ordinary
 * Registry validator module, beside the private transition primitives.
 */
export interface ProviderRegistryPreparedSuccessorRetainedPayloadInternalV1 {
  readonly installationIdentityGenerationId: InstallationIdentityGenerationIdV1;
  readonly manifestHistory: readonly ProviderRegistryManifestEnvelopeV1[];
  readonly currentEnvelope: ProviderRegistryManifestEnvelopeV1;
  readonly currentRoot: ProviderRegistryRootPublicKeyV1;
  readonly rootByKeyId: ReadonlyMap<
    string,
    ProviderRegistryRootMetadataEnvelopeV1
  >;
  readonly policy: ProviderBootstrapTrustBundleV1["providerTrustHistoryPolicy"];
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
  readonly prospectiveRegistryEntry: StoreDurableObjectProviderRegistryEntryV1;
  readonly prospectiveRegistryEntryContentDigest: ContentDigestV1;
  readonly retainedState: unknown;
  readonly retainedRegistryManifestCanonicalBytes: number;
  readonly retainedTrustHistoryCanonicalBytes: number;
  readonly copiedRetainedStateCollectionCount: 7;
  readonly retainedStateCopyOperationCount: 1;
  readonly retainedStateMutationCount: 0;
}

interface SeedEntryInternalV1 {
  readonly seed: ProviderRegistryPreparedSuccessorSeedInternalV1;
  readonly payload: ProviderRegistryPreparedSuccessorRetainedPayloadInternalV1;
}

interface CohortEntryInternalV1 {
  readonly cohortIdentity: object;
  readonly capability: ProviderRegistryPreparedSuccessorCohortCapabilityInternalV1;
  readonly payload: ProviderRegistryPreparedSuccessorRetainedPayloadInternalV1;
}

interface FinalEntryInternalV1 {
  readonly finalCandidateIdentity: object;
  readonly capability: ProviderRegistryPreparedSuccessorFinalCapabilityInternalV1;
  readonly payload: ProviderRegistryPreparedSuccessorRetainedPayloadInternalV1;
}

const seedEntriesInternalV1 = new CapturedWeakMapV1<
  object,
  SeedEntryInternalV1
>();
const cohortEntriesInternalV1 = new CapturedWeakMapV1<
  object,
  CohortEntryInternalV1
>();
const finalEntriesInternalV1 = new CapturedWeakMapV1<
  object,
  FinalEntryInternalV1
>();

function isObjectIdentityInternalV1(value: unknown): value is object {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function")
  );
}

function createOpaqueHandleInternalV1<T extends object>(): T {
  return CapturedObjectFreezeV1(CapturedObjectCreateV1(null)) as T;
}

function burnCohortEntryInternalV1(entry: CohortEntryInternalV1): boolean {
  if (
    weakMapGetV1(cohortEntriesInternalV1, entry.cohortIdentity) !== entry ||
    weakMapGetV1(cohortEntriesInternalV1, entry.capability) !== entry
  ) {
    return false;
  }
  const identityDeleted = weakMapDeleteV1(
    cohortEntriesInternalV1,
    entry.cohortIdentity,
  );
  const capabilityDeleted = weakMapDeleteV1(
    cohortEntriesInternalV1,
    entry.capability,
  );
  return identityDeleted && capabilityDeleted;
}

function burnFinalEntryInternalV1(entry: FinalEntryInternalV1): boolean {
  if (
    weakMapGetV1(finalEntriesInternalV1, entry.finalCandidateIdentity) !==
      entry ||
    weakMapGetV1(finalEntriesInternalV1, entry.capability) !== entry
  ) {
    return false;
  }
  const identityDeleted = weakMapDeleteV1(
    finalEntriesInternalV1,
    entry.finalCandidateIdentity,
  );
  const capabilityDeleted = weakMapDeleteV1(
    finalEntriesInternalV1,
    entry.capability,
  );
  return identityDeleted && capabilityDeleted;
}

export function registerProviderRegistryPreparedSuccessorSeedInternalV1(
  payload: ProviderRegistryPreparedSuccessorRetainedPayloadInternalV1,
): ProviderRegistryPreparedSuccessorSeedInternalV1 {
  if (
    !CapturedObjectIsFrozenV1(payload) ||
    !CapturedObjectIsFrozenV1(payload.manifestHistory) ||
    payload.manifestHistory.length === 0 ||
    payload.currentEnvelope !==
      payload.manifestHistory[payload.manifestHistory.length - 1] ||
    !CapturedObjectIsFrozenV1(payload.currentEnvelope) ||
    !CapturedObjectIsFrozenV1(payload.currentRoot) ||
    !CapturedObjectIsFrozenV1(payload.prospectiveRegistryEntry) ||
    payload.copiedRetainedStateCollectionCount !== 7 ||
    payload.retainedStateCopyOperationCount !== 1 ||
    payload.retainedStateMutationCount !== 0
  ) {
    throw new CapturedTypeErrorV1(
      "prepared Registry successor retained payload is invalid",
    );
  }
  const seed =
    createOpaqueHandleInternalV1<ProviderRegistryPreparedSuccessorSeedInternalV1>();
  const entry = CapturedObjectFreezeV1({ seed, payload });
  weakMapSetV1(seedEntriesInternalV1, seed, entry);
  return seed;
}

export function bindProviderRegistryPreparedSuccessorSeedToCohortInternalV1(
  seed: ProviderRegistryPreparedSuccessorSeedInternalV1,
  cohortIdentity: object,
): ProviderRegistryPreparedSuccessorCohortCapabilityInternalV1 {
  if (
    !isObjectIdentityInternalV1(seed) ||
    !isObjectIdentityInternalV1(cohortIdentity) ||
    !CapturedObjectIsFrozenV1(cohortIdentity)
  ) {
    throw new CapturedTypeErrorV1(
      "prepared Registry successor cohort binding is invalid",
    );
  }
  const entry = weakMapGetV1(seedEntriesInternalV1, seed);
  if (entry === undefined || entry.seed !== seed) {
    throw new CapturedTypeErrorV1(
      "prepared Registry successor seed is unavailable",
    );
  }
  if (weakMapGetV1(cohortEntriesInternalV1, cohortIdentity) !== undefined) {
    throw new CapturedTypeErrorV1(
      "prepared Registry successor cohort identity is already bound",
    );
  }
  if (!weakMapDeleteV1(seedEntriesInternalV1, seed)) {
    throw new CapturedTypeErrorV1(
      "prepared Registry successor seed state is inconsistent",
    );
  }
  const capability =
    createOpaqueHandleInternalV1<ProviderRegistryPreparedSuccessorCohortCapabilityInternalV1>();
  const cohortEntry = CapturedObjectFreezeV1({
    cohortIdentity,
    capability,
    payload: entry.payload,
  });
  weakMapSetV1(cohortEntriesInternalV1, cohortIdentity, cohortEntry);
  weakMapSetV1(cohortEntriesInternalV1, capability, cohortEntry);
  return capability;
}

export function bindProviderRegistryPreparedSuccessorCohortToFinalCandidateInternalV1(
  cohortIdentity: object,
  cohortCapability: ProviderRegistryPreparedSuccessorCohortCapabilityInternalV1,
  exactFinalCandidateIdentity: object,
): ProviderRegistryPreparedSuccessorFinalCapabilityInternalV1 {
  if (
    !isObjectIdentityInternalV1(cohortIdentity) ||
    !isObjectIdentityInternalV1(cohortCapability) ||
    !isObjectIdentityInternalV1(exactFinalCandidateIdentity) ||
    !CapturedObjectIsFrozenV1(exactFinalCandidateIdentity)
  ) {
    throw new CapturedTypeErrorV1(
      "prepared Registry successor final binding is invalid",
    );
  }
  if (
    weakMapGetV1(finalEntriesInternalV1, exactFinalCandidateIdentity) !==
    undefined
  ) {
    throw new CapturedTypeErrorV1(
      "prepared Registry successor final candidate is already bound",
    );
  }
  const entryByIdentity = weakMapGetV1(
    cohortEntriesInternalV1,
    cohortIdentity,
  );
  const entryByCapability = weakMapGetV1(
    cohortEntriesInternalV1,
    cohortCapability,
  );
  if (
    entryByIdentity === undefined ||
    entryByIdentity !== entryByCapability ||
    entryByIdentity.cohortIdentity !== cohortIdentity ||
    entryByIdentity.capability !== cohortCapability
  ) {
    throw new CapturedTypeErrorV1(
      "prepared Registry successor cohort is unavailable",
    );
  }
  if (!burnCohortEntryInternalV1(entryByIdentity)) {
    throw new CapturedTypeErrorV1(
      "prepared Registry successor cohort state is inconsistent",
    );
  }
  const capability =
    createOpaqueHandleInternalV1<ProviderRegistryPreparedSuccessorFinalCapabilityInternalV1>();
  const finalEntry = CapturedObjectFreezeV1({
    finalCandidateIdentity: exactFinalCandidateIdentity,
    capability,
    payload: entryByIdentity.payload,
  });
  weakMapSetV1(finalEntriesInternalV1, exactFinalCandidateIdentity, finalEntry);
  weakMapSetV1(finalEntriesInternalV1, capability, finalEntry);
  return capability;
}

/**
 * Compare both bindings before deletion.  A foreign candidate/capability tuple
 * cannot burn either owner's state.  An exact tuple is deleted synchronously.
 */
export function takeProviderRegistryPreparedSuccessorFinalCandidateInternalV1(
  exactFinalCandidateIdentity: unknown,
  finalCapability: ProviderRegistryPreparedSuccessorFinalCapabilityInternalV1,
): ProviderRegistryPreparedSuccessorRetainedPayloadInternalV1 | undefined {
  if (
    !isObjectIdentityInternalV1(exactFinalCandidateIdentity) ||
    !isObjectIdentityInternalV1(finalCapability)
  ) {
    return undefined;
  }
  const entryByIdentity = weakMapGetV1(
    finalEntriesInternalV1,
    exactFinalCandidateIdentity,
  );
  const entryByCapability = weakMapGetV1(
    finalEntriesInternalV1,
    finalCapability,
  );
  if (
    entryByIdentity === undefined ||
    entryByIdentity !== entryByCapability ||
    entryByIdentity.finalCandidateIdentity !== exactFinalCandidateIdentity ||
    entryByIdentity.capability !== finalCapability
  ) {
    return undefined;
  }
  if (!burnFinalEntryInternalV1(entryByIdentity)) {
    throw new CapturedTypeErrorV1(
      "prepared Registry successor final state is inconsistent",
    );
  }
  return entryByIdentity.payload;
}

export function discardProviderRegistryPreparedSuccessorSeedInternalV1(
  seed: ProviderRegistryPreparedSuccessorSeedInternalV1,
): boolean {
  if (!isObjectIdentityInternalV1(seed)) return false;
  const entry = weakMapGetV1(seedEntriesInternalV1, seed);
  if (entry === undefined || entry.seed !== seed) return false;
  return weakMapDeleteV1(seedEntriesInternalV1, seed);
}

export function discardProviderRegistryPreparedSuccessorCohortInternalV1(
  cohortIdentity: unknown,
  cohortCapability: ProviderRegistryPreparedSuccessorCohortCapabilityInternalV1,
): boolean {
  if (
    !isObjectIdentityInternalV1(cohortIdentity) ||
    !isObjectIdentityInternalV1(cohortCapability)
  ) {
    return false;
  }
  const entryByIdentity = weakMapGetV1(
    cohortEntriesInternalV1,
    cohortIdentity,
  );
  const entryByCapability = weakMapGetV1(
    cohortEntriesInternalV1,
    cohortCapability,
  );
  if (
    entryByIdentity === undefined ||
    entryByIdentity !== entryByCapability ||
    entryByIdentity.cohortIdentity !== cohortIdentity ||
    entryByIdentity.capability !== cohortCapability
  ) {
    return false;
  }
  if (!burnCohortEntryInternalV1(entryByIdentity)) {
    throw new CapturedTypeErrorV1(
      "prepared Registry successor cohort state is inconsistent",
    );
  }
  return true;
}

export function discardProviderRegistryPreparedSuccessorFinalInternalV1(
  exactFinalCandidateIdentity: unknown,
  finalCapability: ProviderRegistryPreparedSuccessorFinalCapabilityInternalV1,
): boolean {
  if (
    !isObjectIdentityInternalV1(exactFinalCandidateIdentity) ||
    !isObjectIdentityInternalV1(finalCapability)
  ) {
    return false;
  }
  const entryByIdentity = weakMapGetV1(
    finalEntriesInternalV1,
    exactFinalCandidateIdentity,
  );
  const entryByCapability = weakMapGetV1(
    finalEntriesInternalV1,
    finalCapability,
  );
  if (
    entryByIdentity === undefined ||
    entryByIdentity !== entryByCapability ||
    entryByIdentity.finalCandidateIdentity !== exactFinalCandidateIdentity ||
    entryByIdentity.capability !== finalCapability
  ) {
    return false;
  }
  if (!burnFinalEntryInternalV1(entryByIdentity)) {
    throw new CapturedTypeErrorV1(
      "prepared Registry successor final state is inconsistent",
    );
  }
  return true;
}

CapturedObjectFreezeV1(registerProviderRegistryPreparedSuccessorSeedInternalV1);
CapturedObjectFreezeV1(
  bindProviderRegistryPreparedSuccessorSeedToCohortInternalV1,
);
CapturedObjectFreezeV1(
  bindProviderRegistryPreparedSuccessorCohortToFinalCandidateInternalV1,
);
CapturedObjectFreezeV1(
  takeProviderRegistryPreparedSuccessorFinalCandidateInternalV1,
);
CapturedObjectFreezeV1(discardProviderRegistryPreparedSuccessorSeedInternalV1);
CapturedObjectFreezeV1(
  discardProviderRegistryPreparedSuccessorCohortInternalV1,
);
CapturedObjectFreezeV1(discardProviderRegistryPreparedSuccessorFinalInternalV1);
