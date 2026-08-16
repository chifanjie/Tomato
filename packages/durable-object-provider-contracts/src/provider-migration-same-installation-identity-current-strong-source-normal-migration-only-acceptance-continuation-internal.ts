/**
 * Package-private D-44 -> migration-only Acceptance continuation.
 *
 * The exact committed D-44 result is bound to one claimed intent only after
 * the compound reference machine has been inspected at revision 1. Foreign
 * candidate identities do not consume the owner; the correct identity may
 * take the retained publication basis once.
 */

import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-compound-publication-reference-machine-internal.js";
import type {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceValidationInternalV1,
} from "./provider-migration-same-installation-identity-current-strong-source-normal-formal-plan-publication-reference-capability-internal.js";

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

declare const migrationOnlyAcceptanceContinuationIntentBrandInternalV1:
  unique symbol;
export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1 {
  readonly [migrationOnlyAcceptanceContinuationIntentBrandInternalV1]: true;
}

export interface ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationPayloadInternalV1 {
  readonly exactD44Publication:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceValidationInternalV1;
  readonly compoundPublicationReferenceMachineCapability:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1;
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
  formalPlanPublicationCapability?: object;
  exactD44Publication?:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceValidationInternalV1;
  payload?:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationPayloadInternalV1;
}

const intentContextsInternalV1 = new CapturedWeakMapV1<
  object,
  IntentContextInternalV1
>();
const intentsByFormalPlanPublicationCapabilityInternalV1 =
  new CapturedWeakMapV1<
    object,
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1
  >();

function isObjectIdentityV1(value: unknown): value is object {
  return value !== null &&
    (typeof value === "object" || typeof value === "function");
}

function requireIntentContextV1(intent: unknown): IntentContextInternalV1 {
  if (!isObjectIdentityV1(intent)) {
    throw new CapturedTypeErrorV1(
      "migration-only Acceptance continuation intent invalid",
    );
  }
  const context = weakMapGetV1(intentContextsInternalV1, intent);
  if (context === undefined) {
    throw new CapturedTypeErrorV1(
      "migration-only Acceptance continuation intent invalid",
    );
  }
  return context;
}

export function mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1(): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1 {
  const intent = CapturedObjectFreezeV1(
    CapturedObjectCreateV1(null),
  ) as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1;
  weakMapSetV1(intentContextsInternalV1, intent, { stage: "fresh" });
  return intent;
}

export function registerProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1(
  formalPlanPublicationCapability: object,
  intent: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1,
): void {
  if (!isObjectIdentityV1(formalPlanPublicationCapability)) {
    throw new CapturedTypeErrorV1("D-44 capability identity invalid");
  }
  const context = requireIntentContextV1(intent);
  if (
    context.stage !== "fresh" ||
    weakMapHasV1(
      intentsByFormalPlanPublicationCapabilityInternalV1,
      formalPlanPublicationCapability,
    )
  ) {
    throw new CapturedTypeErrorV1(
      "migration-only Acceptance continuation already registered",
    );
  }
  context.stage = "registered";
  context.formalPlanPublicationCapability = formalPlanPublicationCapability;
  weakMapSetV1(
    intentsByFormalPlanPublicationCapabilityInternalV1,
    formalPlanPublicationCapability,
    intent,
  );
}

/** Foreign D-44 capability identities do not consume the owner. */
export function takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1(
  formalPlanPublicationCapability: unknown,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1 | undefined {
  if (!isObjectIdentityV1(formalPlanPublicationCapability)) return undefined;
  const intent = weakMapGetV1(
    intentsByFormalPlanPublicationCapabilityInternalV1,
    formalPlanPublicationCapability,
  );
  if (intent === undefined) return undefined;
  const context = requireIntentContextV1(intent);
  if (
    context.stage !== "registered" ||
    context.formalPlanPublicationCapability !==
      formalPlanPublicationCapability ||
    !weakMapDeleteV1(
      intentsByFormalPlanPublicationCapabilityInternalV1,
      formalPlanPublicationCapability,
    )
  ) {
    throw new CapturedTypeErrorV1(
      "migration-only Acceptance continuation state invalid",
    );
  }
  context.stage = "claimed";
  context.formalPlanPublicationCapability = undefined;
  return intent;
}

export function bindProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationToCommittedPublicationInternalV1(
  intent: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1,
  exactD44Publication: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceValidationInternalV1,
  compoundPublicationReferenceMachineCapability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1,
): void {
  const context = requireIntentContextV1(intent);
  if (
    context.stage !== "claimed" ||
    !isObjectIdentityV1(exactD44Publication) ||
    exactD44Publication.stateRevision !== 1 ||
    exactD44Publication.committedReceipt.status !== "committed"
  ) {
    throw new CapturedTypeErrorV1(
      "migration-only Acceptance continuation binding invalid",
    );
  }
  context.stage = "final";
  context.exactD44Publication = exactD44Publication;
  context.payload = CapturedObjectFreezeV1({
    exactD44Publication,
    compoundPublicationReferenceMachineCapability,
  });
}

/** Foreign D-44 result identities do not burn the final payload. */
export function takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationPayloadInternalV1(
  intent: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1,
  exactD44Publication: object,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationPayloadInternalV1 | undefined {
  const context = requireIntentContextV1(intent);
  if (
    context.stage !== "final" ||
    context.exactD44Publication !== exactD44Publication ||
    context.payload === undefined
  ) {
    return undefined;
  }
  const payload = context.payload;
  context.stage = "taken";
  context.exactD44Publication = undefined;
  context.payload = undefined;
  return payload;
}

export function discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1(
  intent: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1,
): boolean {
  const context = requireIntentContextV1(intent);
  if (context.stage === "discarded" || context.stage === "taken") return false;
  if (
    context.stage === "registered" &&
    context.formalPlanPublicationCapability !== undefined
  ) {
    weakMapDeleteV1(
      intentsByFormalPlanPublicationCapabilityInternalV1,
      context.formalPlanPublicationCapability,
    );
  }
  context.stage = "discarded";
  context.formalPlanPublicationCapability = undefined;
  context.exactD44Publication = undefined;
  context.payload = undefined;
  return true;
}

for (const exportedFunctionV1 of [
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1,
  registerProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1,
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1,
  bindProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationToCommittedPublicationInternalV1,
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationPayloadInternalV1,
  discardProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceContinuationIntentInternalV1,
]) CapturedObjectFreezeV1(exportedFunctionV1);
