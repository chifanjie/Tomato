/**
 * Package-private D-42 -> D-43 continuation handoff.
 *
 * Serialized D-42 candidates carry no authority.  The D-43 orchestrator
 * registers one intent on the exact fresh D-42 capability; D-42 claims that
 * intent synchronously and, only after its final zero-write audit succeeds,
 * moves the prepared Catalog seed through cohort to the exact D-42 candidate.
 */

import {
  bindProviderFeasibilitySupportCatalogPreparedSuccessorCohortToFinalCandidateInternalV1,
  bindProviderFeasibilitySupportCatalogPreparedSuccessorSeedToCohortInternalV1,
  discardProviderFeasibilitySupportCatalogPreparedSuccessorCohortInternalV1,
  discardProviderFeasibilitySupportCatalogPreparedSuccessorFinalInternalV1,
  type ProviderFeasibilitySupportCatalogPreparedSuccessorFinalCapabilityInternalV1,
  type ProviderFeasibilitySupportCatalogPreparedSuccessorSeedInternalV1,
} from "./provider-feasibility-support-catalog-prepared-successor-handle-internal.js";

const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedObjectCreateV1 = Object.create;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedTypeErrorV1 = TypeError;
const CapturedWeakMapV1 = WeakMap;
const CapturedWeakMapPrototypeDeleteV1 = WeakMap.prototype.delete;
const CapturedWeakMapPrototypeGetV1 = WeakMap.prototype.get;
const CapturedWeakMapPrototypeHasV1 = WeakMap.prototype.has;
const CapturedWeakMapPrototypeSetV1 = WeakMap.prototype.set;

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
  CapturedWeakMapPrototypeDeleteV1,
) as <K extends object>(map: WeakMap<K, unknown>, key: K) => boolean;
const weakMapGetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeGetV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K) => V | undefined;
const weakMapHasV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeHasV1,
) as <K extends object>(map: WeakMap<K, unknown>, key: K) => boolean;
const weakMapSetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeSetV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K, value: V) => void;

declare const preparedCatalogSuccessorContinuationIntentBrandInternalV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationIntentInternalV1 {
  readonly [preparedCatalogSuccessorContinuationIntentBrandInternalV1]: true;
}

type IntentStageInternalV1 =
  | "fresh"
  | "registered"
  | "claimed"
  | "final"
  | "taken"
  | "discarded";

interface IntentContextInternalV1 {
  stage: IntentStageInternalV1;
  preparedRegistrySuccessorCapability?: object;
  finalCandidateIdentity?: object;
  finalCapability?: ProviderFeasibilitySupportCatalogPreparedSuccessorFinalCapabilityInternalV1;
}

const intentContextsInternalV1 = new CapturedWeakMapV1<
  object,
  IntentContextInternalV1
>();
const intentsByPreparedRegistrySuccessorCapabilityInternalV1 =
  new CapturedWeakMapV1<
    object,
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationIntentInternalV1
  >();

function isObjectIdentityV1(value: unknown): value is object {
  return value !== null &&
    (typeof value === "object" || typeof value === "function");
}

function requireIntentContextV1(
  intent: unknown,
): IntentContextInternalV1 {
  if (!isObjectIdentityV1(intent)) {
    throw new CapturedTypeErrorV1("prepared Catalog continuation intent invalid");
  }
  const context = weakMapGetV1(intentContextsInternalV1, intent);
  if (context === undefined) {
    throw new CapturedTypeErrorV1("prepared Catalog continuation intent invalid");
  }
  return context;
}

export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationIntentInternalV1(): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationIntentInternalV1 {
  const intent = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationIntentInternalV1;
  weakMapSetV1(intentContextsInternalV1, intent, { stage: "fresh" });
  return intent;
}

export function registerProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationIntentInternalV1(
  preparedRegistrySuccessorCapability: object,
  intent: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationIntentInternalV1,
): void {
  if (!isObjectIdentityV1(preparedRegistrySuccessorCapability)) {
    throw new CapturedTypeErrorV1("D-42 capability identity invalid");
  }
  const context = requireIntentContextV1(intent);
  if (
    context.stage !== "fresh" ||
    weakMapHasV1(
      intentsByPreparedRegistrySuccessorCapabilityInternalV1,
      preparedRegistrySuccessorCapability,
    )
  ) {
    throw new CapturedTypeErrorV1("prepared Catalog continuation intent already registered");
  }
  context.stage = "registered";
  context.preparedRegistrySuccessorCapability = preparedRegistrySuccessorCapability;
  weakMapSetV1(
    intentsByPreparedRegistrySuccessorCapabilityInternalV1,
    preparedRegistrySuccessorCapability,
    intent,
  );
}

/** Foreign capability identities do not consume the owner's intent. */
export function takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationIntentInternalV1(
  preparedRegistrySuccessorCapability: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationIntentInternalV1 | undefined {
  if (!isObjectIdentityV1(preparedRegistrySuccessorCapability)) return undefined;
  const intent = weakMapGetV1(
    intentsByPreparedRegistrySuccessorCapabilityInternalV1,
    preparedRegistrySuccessorCapability,
  );
  if (intent === undefined) return undefined;
  const context = requireIntentContextV1(intent);
  if (
    context.stage !== "registered" ||
    context.preparedRegistrySuccessorCapability !==
      preparedRegistrySuccessorCapability ||
    !weakMapDeleteV1(
      intentsByPreparedRegistrySuccessorCapabilityInternalV1,
      preparedRegistrySuccessorCapability,
    )
  ) {
    throw new CapturedTypeErrorV1("prepared Catalog continuation intent state invalid");
  }
  context.stage = "claimed";
  context.preparedRegistrySuccessorCapability = undefined;
  return intent;
}

export function bindProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationToFinalCandidateInternalV1(
  intent: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationIntentInternalV1,
  seed: ProviderFeasibilitySupportCatalogPreparedSuccessorSeedInternalV1,
  cohortIdentity: object,
  exactD42CandidateIdentity: object,
): void {
  const context = requireIntentContextV1(intent);
  if (context.stage !== "claimed") {
    throw new CapturedTypeErrorV1("prepared Catalog continuation intent is not claimed");
  }
  const cohortCapability =
    bindProviderFeasibilitySupportCatalogPreparedSuccessorSeedToCohortInternalV1(
      seed,
      cohortIdentity,
    );
  try {
    const finalCapability =
      bindProviderFeasibilitySupportCatalogPreparedSuccessorCohortToFinalCandidateInternalV1(
        cohortIdentity,
        cohortCapability,
        exactD42CandidateIdentity,
      );
    context.stage = "final";
    context.finalCandidateIdentity = exactD42CandidateIdentity;
    context.finalCapability = finalCapability;
  } catch (error) {
    discardProviderFeasibilitySupportCatalogPreparedSuccessorCohortInternalV1(
      cohortIdentity,
      cohortCapability,
    );
    throw error;
  }
}

/** Foreign candidate identities do not burn the owner's final capability. */
export function takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorFinalCapabilityInternalV1(
  intent: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationIntentInternalV1,
  exactD42CandidateIdentity: object,
): ProviderFeasibilitySupportCatalogPreparedSuccessorFinalCapabilityInternalV1 | undefined {
  const context = requireIntentContextV1(intent);
  if (
    context.stage !== "final" ||
    context.finalCandidateIdentity !== exactD42CandidateIdentity ||
    context.finalCapability === undefined
  ) {
    return undefined;
  }
  const capability = context.finalCapability;
  context.stage = "taken";
  context.finalCandidateIdentity = undefined;
  context.finalCapability = undefined;
  return capability;
}

export function discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationIntentInternalV1(
  intent: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationIntentInternalV1,
): boolean {
  const context = requireIntentContextV1(intent);
  if (context.stage === "discarded" || context.stage === "taken") return false;
  if (
    context.stage === "registered" &&
    context.preparedRegistrySuccessorCapability !== undefined
  ) {
    weakMapDeleteV1(
      intentsByPreparedRegistrySuccessorCapabilityInternalV1,
      context.preparedRegistrySuccessorCapability,
    );
  }
  if (
    context.stage === "final" &&
    context.finalCandidateIdentity !== undefined &&
    context.finalCapability !== undefined
  ) {
    discardProviderFeasibilitySupportCatalogPreparedSuccessorFinalInternalV1(
      context.finalCandidateIdentity,
      context.finalCapability,
    );
  }
  context.stage = "discarded";
  context.preparedRegistrySuccessorCapability = undefined;
  context.finalCandidateIdentity = undefined;
  context.finalCapability = undefined;
  return true;
}

CapturedObjectFreezeV1(
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationIntentInternalV1,
);
CapturedObjectFreezeV1(
  registerProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationIntentInternalV1,
);
CapturedObjectFreezeV1(
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationIntentInternalV1,
);
CapturedObjectFreezeV1(
  bindProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationToFinalCandidateInternalV1,
);
CapturedObjectFreezeV1(
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorFinalCapabilityInternalV1,
);
CapturedObjectFreezeV1(
  discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorContinuationIntentInternalV1,
);
