import { canonicalizeJcsSafeIntegerV1 } from "./jcs.js";
import type {
  ProviderDistributionHistoryCurrentCandidatePointValidationV1,
} from "./provider-distribution-history-current-candidate-point.js";
import type {
  ProviderFeasibilityOwnerTargetCapabilityV1,
  ProviderFeasibilitySupportCatalogPinV1,
} from "./provider-feasibility-support-catalog-point.js";
import type {
  ProviderFeasibilityTargetV1,
} from "./provider-target-discovery-point.js";

const CapturedObjectFreezeV1 = Object.freeze;
const CapturedWeakSetV1 = WeakSet;
const CapturedWeakSetAddV1 = CapturedWeakSetV1.prototype.add;
const CapturedWeakSetHasV1 = CapturedWeakSetV1.prototype.has;
const CapturedReflectApplyV1 = Reflect.apply;

export type ProviderTrustedLocalPhysicalTargetSelectionFailureReasonInternalV1 =
  | "source_invalid"
  | "target_zero_match"
  | "target_ambiguous_match"
  | "target_projection_mismatch";

export class ProviderTrustedLocalPhysicalTargetSelectionErrorInternalV1 extends Error {
  constructor(
    readonly reason:
      ProviderTrustedLocalPhysicalTargetSelectionFailureReasonInternalV1,
  ) {
    super("provider trusted local physical-target selection failed");
    this.name =
      "ProviderTrustedLocalPhysicalTargetSelectionErrorInternalV1";
    CapturedReflectApplyV1(
      CapturedWeakSetAddV1,
      localTargetSelectionErrorsV1,
      [this],
    );
    CapturedObjectFreezeV1(this);
  }
}

const localTargetSelectionErrorsV1 = new CapturedWeakSetV1<object>();

export function isProviderTrustedLocalPhysicalTargetSelectionErrorInternalV1(
  value: unknown,
): value is ProviderTrustedLocalPhysicalTargetSelectionErrorInternalV1 {
  return typeof value === "object" && value !== null &&
    CapturedReflectApplyV1(
      CapturedWeakSetHasV1,
      localTargetSelectionErrorsV1,
      [value],
    ) === true;
}

export interface ProviderTrustedLocalPhysicalTargetSelectionInternalV1 {
  readonly selectedOwnerTargetCapability:
    ProviderFeasibilityOwnerTargetCapabilityV1;
  readonly providerFeasibilitySupportCatalogPin:
    ProviderFeasibilitySupportCatalogPinV1;
}

function failV1(
  reason: ProviderTrustedLocalPhysicalTargetSelectionFailureReasonInternalV1,
): never {
  throw new ProviderTrustedLocalPhysicalTargetSelectionErrorInternalV1(
    reason,
  );
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  return canonicalizeJcsSafeIntegerV1(left) ===
    canonicalizeJcsSafeIntegerV1(right);
}

function requireUniqueMatchV1<T>(
  values: readonly T[],
  matches: (value: T) => boolean,
): T {
  let selected: T | undefined;
  let count = 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (!matches(value)) continue;
    count += 1;
    selected = value;
  }
  if (count === 0 || selected === undefined) {
    return failV1("target_zero_match");
  }
  if (count !== 1) return failV1("target_ambiguous_match");
  return selected;
}

/**
 * Package-private pure selector seam.  The caller must supply the detached,
 * recursively frozen result of C09-1N and a target normalized by the private
 * one-shot opened-root observation capability.
 *
 * @internal
 */
export function deriveProviderTrustedLocalPhysicalTargetSelectionInternalV1(
  validation: ProviderDistributionHistoryCurrentCandidatePointValidationV1,
  observedTarget: ProviderFeasibilityTargetV1,
): ProviderTrustedLocalPhysicalTargetSelectionInternalV1 {
  try {
    const universeEntry = requireUniqueMatchV1(
      validation.releaseTargetUniverseTip.payload.targets,
      (entry) => canonicalEqualV1(entry.target, observedTarget),
    );
    const catalogTarget = requireUniqueMatchV1(
      validation.providerFeasibilitySupportCatalogTip.payload.targets,
      (entry) => canonicalEqualV1(entry.target, observedTarget),
    );
    const selectedOwnerTargetCapability = requireUniqueMatchV1(
      validation.currentCatalogProjection.ownerTargetCapabilities,
      (entry) => canonicalEqualV1(entry.target, observedTarget),
    );
    const projectionPin =
      validation.currentCatalogProjection
        .providerFeasibilitySupportCatalogPin;
    const closurePin =
      validation.catalogPointClosure.providerFeasibilitySupportCatalogPin;
    const catalogTip = validation.providerFeasibilitySupportCatalogTip;
    if (
      !canonicalEqualV1(universeEntry.target, catalogTarget.target) ||
      !canonicalEqualV1(
        catalogTarget.target,
        selectedOwnerTargetCapability.target,
      ) ||
      !canonicalEqualV1(projectionPin, closurePin) ||
      projectionPin.catalogGeneration !== catalogTip.catalogGeneration ||
      projectionPin.contentDigest !== catalogTip.contentDigest
    ) {
      return failV1("target_projection_mismatch");
    }
    return CapturedObjectFreezeV1({
      selectedOwnerTargetCapability,
      providerFeasibilitySupportCatalogPin: projectionPin,
    });
  } catch (error) {
    if (isProviderTrustedLocalPhysicalTargetSelectionErrorInternalV1(error)) {
      throw error;
    }
    return failV1("source_invalid");
  }
}

CapturedObjectFreezeV1(
  deriveProviderTrustedLocalPhysicalTargetSelectionInternalV1,
);
CapturedObjectFreezeV1(
  isProviderTrustedLocalPhysicalTargetSelectionErrorInternalV1,
);
