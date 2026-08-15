/**
 * Package-private D-41 -> D-42 continuation handoff.
 *
 * Serialized D-41 candidates carry no authority.  Only an exact capability
 * minted by the D-42 orchestrator may register an intent on an exact D-41
 * pre-plan capability.  A successful D-41 operation can then bind the
 * retained Registry cohort to the exact final candidate identity.  All
 * ownership transitions are synchronous WeakMap operations.
 */

import {
  bindProviderRegistryPreparedSuccessorCohortToFinalCandidateInternalV1,
  discardProviderRegistryPreparedSuccessorFinalInternalV1,
  type ProviderRegistryPreparedSuccessorCohortCapabilityInternalV1,
  type ProviderRegistryPreparedSuccessorFinalCapabilityInternalV1,
} from "./provider-registry-history-prepared-internal.js";

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

declare const providerMigrationPreparedRegistrySuccessorContinuationIntentBrandInternalV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1 {
  readonly [providerMigrationPreparedRegistrySuccessorContinuationIntentBrandInternalV1]: true;
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
  prePlanCapability?: object;
  finalCandidateIdentity?: object;
  finalCapability?: ProviderRegistryPreparedSuccessorFinalCapabilityInternalV1;
}

const intentContextsInternalV1 = new CapturedWeakMapV1<
  object,
  IntentContextInternalV1
>();
const intentsByPrePlanCapabilityInternalV1 = new CapturedWeakMapV1<
  object,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1
>();

function isObjectIdentityV1(value: unknown): value is object {
  return value !== null &&
    (typeof value === "object" || typeof value === "function");
}

function requireIntentContextV1(
  intent: unknown,
): IntentContextInternalV1 {
  if (!isObjectIdentityV1(intent)) {
    throw new CapturedTypeErrorV1("prepared Registry continuation intent invalid");
  }
  const context = weakMapGetV1(intentContextsInternalV1, intent);
  if (context === undefined) {
    throw new CapturedTypeErrorV1("prepared Registry continuation intent invalid");
  }
  return context;
}

export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1(): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1 {
  const intent = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1;
  weakMapSetV1(intentContextsInternalV1, intent, { stage: "fresh" });
  return intent;
}

export function registerProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1(
  prePlanCapability: object,
  intent: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1,
): void {
  if (!isObjectIdentityV1(prePlanCapability)) {
    throw new CapturedTypeErrorV1("D-41 pre-plan capability identity invalid");
  }
  const context = requireIntentContextV1(intent);
  if (
    context.stage !== "fresh" ||
    weakMapHasV1(intentsByPrePlanCapabilityInternalV1, prePlanCapability)
  ) {
    throw new CapturedTypeErrorV1("prepared Registry continuation intent already registered");
  }
  context.stage = "registered";
  context.prePlanCapability = prePlanCapability;
  weakMapSetV1(
    intentsByPrePlanCapabilityInternalV1,
    prePlanCapability,
    intent,
  );
}

/** Foreign identities do not consume the owner's registered intent. */
export function takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1(
  prePlanCapability: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1 | undefined {
  if (!isObjectIdentityV1(prePlanCapability)) return undefined;
  const intent = weakMapGetV1(
    intentsByPrePlanCapabilityInternalV1,
    prePlanCapability,
  );
  if (intent === undefined) return undefined;
  const context = requireIntentContextV1(intent);
  if (
    context.stage !== "registered" ||
    context.prePlanCapability !== prePlanCapability ||
    !weakMapDeleteV1(
      intentsByPrePlanCapabilityInternalV1,
      prePlanCapability,
    )
  ) {
    throw new CapturedTypeErrorV1("prepared Registry continuation intent state invalid");
  }
  context.stage = "claimed";
  context.prePlanCapability = undefined;
  return intent;
}

export function bindProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationToFinalCandidateInternalV1(
  intent: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1,
  cohortIdentity: object,
  cohortCapability: ProviderRegistryPreparedSuccessorCohortCapabilityInternalV1,
  exactFinalCandidateIdentity: object,
): void {
  const context = requireIntentContextV1(intent);
  if (context.stage !== "claimed") {
    throw new CapturedTypeErrorV1("prepared Registry continuation intent is not claimed");
  }
  const finalCapability =
    bindProviderRegistryPreparedSuccessorCohortToFinalCandidateInternalV1(
      cohortIdentity,
      cohortCapability,
      exactFinalCandidateIdentity,
    );
  context.stage = "final";
  context.finalCandidateIdentity = exactFinalCandidateIdentity;
  context.finalCapability = finalCapability;
}

/** Foreign candidate identities do not burn the owner's final capability. */
export function takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorFinalCapabilityInternalV1(
  intent: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1,
  exactFinalCandidateIdentity: object,
): ProviderRegistryPreparedSuccessorFinalCapabilityInternalV1 | undefined {
  const context = requireIntentContextV1(intent);
  if (
    context.stage !== "final" ||
    context.finalCandidateIdentity !== exactFinalCandidateIdentity ||
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

export function discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1(
  intent: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1,
): boolean {
  const context = requireIntentContextV1(intent);
  if (context.stage === "discarded" || context.stage === "taken") return false;
  if (
    context.stage === "registered" &&
    context.prePlanCapability !== undefined
  ) {
    weakMapDeleteV1(
      intentsByPrePlanCapabilityInternalV1,
      context.prePlanCapability,
    );
  }
  if (
    context.stage === "final" &&
    context.finalCandidateIdentity !== undefined &&
    context.finalCapability !== undefined
  ) {
    discardProviderRegistryPreparedSuccessorFinalInternalV1(
      context.finalCandidateIdentity,
      context.finalCapability,
    );
  }
  context.stage = "discarded";
  context.prePlanCapability = undefined;
  context.finalCandidateIdentity = undefined;
  context.finalCapability = undefined;
  return true;
}

CapturedObjectFreezeV1(
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1,
);
CapturedObjectFreezeV1(
  registerProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1,
);
CapturedObjectFreezeV1(
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1,
);
CapturedObjectFreezeV1(
  bindProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationToFinalCandidateInternalV1,
);
CapturedObjectFreezeV1(
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorFinalCapabilityInternalV1,
);
CapturedObjectFreezeV1(
  discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1,
);
