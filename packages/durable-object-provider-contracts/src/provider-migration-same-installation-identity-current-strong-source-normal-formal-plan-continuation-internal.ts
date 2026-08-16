/**
 * Package-private D-43 -> D-44 continuation handoff.
 *
 * A serialized D-43 candidate carries no publication authority.  A D-44
 * orchestrator registers one intent on the exact fresh D-43 capability. D-43
 * claims it synchronously and binds a one-shot final capability only after its
 * true-final zero-side-effect audit succeeds.  The handoff retains the exact
 * D-43, D-42, and D-41 identities plus the prepared Registry and Catalog
 * envelopes; foreign identities do not consume the owner and replay cannot
 * recover an already-taken handoff.
 */

import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-prepared-catalog-successor-reference-candidate-wire.js";

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

type D43CandidateInternalV1 =
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1;
type D42CandidateInternalV1 =
  D43CandidateInternalV1["preparedRegistrySuccessorClosure"];
type D41CandidateInternalV1 =
  D42CandidateInternalV1["preSideEffectPlanAdmissionClosure"];

declare const formalPlanContinuationIntentBrandInternalV1: unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1 {
  readonly [formalPlanContinuationIntentBrandInternalV1]: true;
}

declare const formalPlanContinuationFinalBrandInternalV1: unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationFinalCapabilityInternalV1 {
  readonly [formalPlanContinuationFinalBrandInternalV1]: true;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationPayloadInternalV1 {
  readonly exactD43Candidate: D43CandidateInternalV1;
  readonly exactD42Candidate: D42CandidateInternalV1;
  readonly exactD41Candidate: D41CandidateInternalV1;
  readonly preparedRegistryManifestEnvelope:
    D42CandidateInternalV1["preparedRegistryManifestEnvelope"];
  readonly preparedRegistryManifestPin:
    D42CandidateInternalV1["preparedRegistryManifestPin"];
  readonly preparedSupportCatalogEnvelope:
    D43CandidateInternalV1["preparedSupportCatalogEnvelope"];
  readonly preparedSupportCatalogPin:
    D43CandidateInternalV1["preparedSupportCatalogPin"];
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
  preparedCatalogSuccessorCapability?: object;
  finalCandidateIdentity?: object;
  finalCapability?: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationFinalCapabilityInternalV1;
}

interface FinalContextInternalV1 {
  readonly exactD43Candidate: D43CandidateInternalV1;
  readonly payload:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationPayloadInternalV1;
}

const intentContextsInternalV1 = new CapturedWeakMapV1<
  object,
  IntentContextInternalV1
>();
const intentsByPreparedCatalogSuccessorCapabilityInternalV1 =
  new CapturedWeakMapV1<
    object,
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1
  >();
const finalContextsInternalV1 = new CapturedWeakMapV1<
  object,
  FinalContextInternalV1
>();

function isObjectIdentityV1(value: unknown): value is object {
  return value !== null &&
    (typeof value === "object" || typeof value === "function");
}

function requireIntentContextV1(intent: unknown): IntentContextInternalV1 {
  if (!isObjectIdentityV1(intent)) {
    throw new CapturedTypeErrorV1("formal Plan continuation intent invalid");
  }
  const context = weakMapGetV1(intentContextsInternalV1, intent);
  if (context === undefined) {
    throw new CapturedTypeErrorV1("formal Plan continuation intent invalid");
  }
  return context;
}

export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1(): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1 {
  const intent = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1;
  weakMapSetV1(intentContextsInternalV1, intent, { stage: "fresh" });
  return intent;
}

export function registerProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1(
  preparedCatalogSuccessorCapability: object,
  intent: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1,
): void {
  if (!isObjectIdentityV1(preparedCatalogSuccessorCapability)) {
    throw new CapturedTypeErrorV1("D-43 capability identity invalid");
  }
  const context = requireIntentContextV1(intent);
  if (
    context.stage !== "fresh" ||
    weakMapHasV1(
      intentsByPreparedCatalogSuccessorCapabilityInternalV1,
      preparedCatalogSuccessorCapability,
    )
  ) {
    throw new CapturedTypeErrorV1("formal Plan continuation intent already registered");
  }
  context.stage = "registered";
  context.preparedCatalogSuccessorCapability =
    preparedCatalogSuccessorCapability;
  weakMapSetV1(
    intentsByPreparedCatalogSuccessorCapabilityInternalV1,
    preparedCatalogSuccessorCapability,
    intent,
  );
}

/** Foreign capability identities do not consume the owner's intent. */
export function takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1(
  preparedCatalogSuccessorCapability: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1 | undefined {
  if (!isObjectIdentityV1(preparedCatalogSuccessorCapability)) return undefined;
  const intent = weakMapGetV1(
    intentsByPreparedCatalogSuccessorCapabilityInternalV1,
    preparedCatalogSuccessorCapability,
  );
  if (intent === undefined) return undefined;
  const context = requireIntentContextV1(intent);
  if (
    context.stage !== "registered" ||
    context.preparedCatalogSuccessorCapability !==
      preparedCatalogSuccessorCapability ||
    !weakMapDeleteV1(
      intentsByPreparedCatalogSuccessorCapabilityInternalV1,
      preparedCatalogSuccessorCapability,
    )
  ) {
    throw new CapturedTypeErrorV1("formal Plan continuation intent state invalid");
  }
  context.stage = "claimed";
  context.preparedCatalogSuccessorCapability = undefined;
  return intent;
}

export function bindProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationToFinalCandidateInternalV1(
  intent: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1,
  payload: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationPayloadInternalV1,
): void {
  const context = requireIntentContextV1(intent);
  if (
    context.stage !== "claimed" ||
    !isObjectIdentityV1(payload.exactD43Candidate) ||
    !isObjectIdentityV1(payload.exactD42Candidate) ||
    !isObjectIdentityV1(payload.exactD41Candidate) ||
    payload.exactD42Candidate.preSideEffectPlanAdmissionClosure !==
      payload.exactD41Candidate ||
    payload.exactD42Candidate.preparedRegistryManifestEnvelope !==
      payload.preparedRegistryManifestEnvelope ||
    payload.exactD42Candidate.preparedRegistryManifestPin !==
      payload.preparedRegistryManifestPin ||
    payload.exactD43Candidate.preparedSupportCatalogEnvelope !==
      payload.preparedSupportCatalogEnvelope ||
    payload.exactD43Candidate.preparedSupportCatalogPin !==
      payload.preparedSupportCatalogPin
  ) {
    throw new CapturedTypeErrorV1("formal Plan continuation binding invalid");
  }
  const finalCapability = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationFinalCapabilityInternalV1;
  const retainedPayload = CapturedObjectFreezeV1({
    exactD43Candidate: payload.exactD43Candidate,
    exactD42Candidate: payload.exactD42Candidate,
    exactD41Candidate: payload.exactD41Candidate,
    preparedRegistryManifestEnvelope:
      payload.preparedRegistryManifestEnvelope,
    preparedRegistryManifestPin: payload.preparedRegistryManifestPin,
    preparedSupportCatalogEnvelope:
      payload.preparedSupportCatalogEnvelope,
    preparedSupportCatalogPin: payload.preparedSupportCatalogPin,
  });
  weakMapSetV1(finalContextsInternalV1, finalCapability, {
    exactD43Candidate: payload.exactD43Candidate,
    payload: retainedPayload,
  });
  context.stage = "final";
  context.finalCandidateIdentity = payload.exactD43Candidate;
  context.finalCapability = finalCapability;
}

/** Foreign D-43 identities do not burn the owner's final capability. */
export function takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationFinalCapabilityInternalV1(
  intent: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1,
  exactD43CandidateIdentity: object,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationFinalCapabilityInternalV1 | undefined {
  const context = requireIntentContextV1(intent);
  if (
    context.stage !== "final" ||
    context.finalCandidateIdentity !== exactD43CandidateIdentity ||
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

/** The exact D-43 identity may consume a final handoff only once. */
export function takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationPayloadInternalV1(
  exactD43CandidateIdentity: object,
  finalCapability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationFinalCapabilityInternalV1,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationPayloadInternalV1 | undefined {
  if (!isObjectIdentityV1(finalCapability)) return undefined;
  const context = weakMapGetV1(finalContextsInternalV1, finalCapability);
  if (
    context === undefined ||
    context.exactD43Candidate !== exactD43CandidateIdentity
  ) {
    return undefined;
  }
  if (!weakMapDeleteV1(finalContextsInternalV1, finalCapability)) {
    throw new CapturedTypeErrorV1("formal Plan continuation final state invalid");
  }
  return context.payload;
}

export function discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationFinalInternalV1(
  exactD43CandidateIdentity: object,
  finalCapability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationFinalCapabilityInternalV1,
): boolean {
  if (!isObjectIdentityV1(finalCapability)) return false;
  const context = weakMapGetV1(finalContextsInternalV1, finalCapability);
  if (
    context === undefined ||
    context.exactD43Candidate !== exactD43CandidateIdentity
  ) {
    return false;
  }
  return weakMapDeleteV1(finalContextsInternalV1, finalCapability);
}

export function discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1(
  intent: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1,
): boolean {
  const context = requireIntentContextV1(intent);
  if (context.stage === "discarded" || context.stage === "taken") return false;
  if (
    context.stage === "registered" &&
    context.preparedCatalogSuccessorCapability !== undefined
  ) {
    weakMapDeleteV1(
      intentsByPreparedCatalogSuccessorCapabilityInternalV1,
      context.preparedCatalogSuccessorCapability,
    );
  }
  if (
    context.stage === "final" &&
    context.finalCandidateIdentity !== undefined &&
    context.finalCapability !== undefined
  ) {
    discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationFinalInternalV1(
      context.finalCandidateIdentity,
      context.finalCapability,
    );
  }
  context.stage = "discarded";
  context.preparedCatalogSuccessorCapability = undefined;
  context.finalCandidateIdentity = undefined;
  context.finalCapability = undefined;
  return true;
}

CapturedObjectFreezeV1(
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1,
);
CapturedObjectFreezeV1(
  registerProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1,
);
CapturedObjectFreezeV1(
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1,
);
CapturedObjectFreezeV1(
  bindProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationToFinalCandidateInternalV1,
);
CapturedObjectFreezeV1(
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationFinalCapabilityInternalV1,
);
CapturedObjectFreezeV1(
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationPayloadInternalV1,
);
CapturedObjectFreezeV1(
  discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationFinalInternalV1,
);
CapturedObjectFreezeV1(
  discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanContinuationIntentInternalV1,
);
