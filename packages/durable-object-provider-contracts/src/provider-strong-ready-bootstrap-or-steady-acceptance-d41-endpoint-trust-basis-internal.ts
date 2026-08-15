/**
 * Package-private one-shot handoff from the successful D-40 transaction to
 * D-41.  This module intentionally has no D-41 runtime dependency, so the
 * public D-40 closure module can register its exact transaction-local D-39
 * selection without creating a public-module cycle.
 */

import type {
  ProviderDistributionHistoryCurrentCandidatePointValidationV1,
  ValidateProviderDistributionHistoryCurrentCandidatePointV1Input,
} from "./provider-distribution-history-current-candidate-point.js";
import type {
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureValidationReferenceCandidateV1,
} from "./provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-closure-reference-candidate.js";
import type {
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReadOnlyContinuityHandleInternalV1,
} from "./provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-reference-machine-internal.js";
import type {
  ProviderTrustedLocalPhysicalTargetSelectionCandidateValidationV1,
} from "./provider-trusted-local-physical-target-selection-candidate.js";
import type {
  ProviderStrictEd25519OpaqueCapabilityV1,
} from "./strict-ed25519-conformance.js";

const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
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
) as <K extends object, V>(map: WeakMap<K, V>, key: K) => boolean;
const weakMapGetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeGetV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K) => V | undefined;
const weakMapHasV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeHasV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K) => boolean;
const weakMapSetV1 = bindUncurriedAtBootstrapV1(
  CapturedWeakMapPrototypeSetV1,
) as <K extends object, V>(map: WeakMap<K, V>, key: K, value: V) => void;

export interface ProviderStrongReadyBootstrapOrSteadyAcceptanceD41EndpointTrustBasisInternalV1 {
  readonly acceptanceClosureIdentity:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureValidationReferenceCandidateV1;
  readonly distributionHistoryInput:
    ValidateProviderDistributionHistoryCurrentCandidatePointV1Input;
  readonly distributionHistoryClosure:
    ProviderDistributionHistoryCurrentCandidatePointValidationV1;
  readonly physicalTargetSelection:
    ProviderTrustedLocalPhysicalTargetSelectionCandidateValidationV1;
  readonly readOnlyContinuityHandle:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReadOnlyContinuityHandleInternalV1;
  readonly strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
}

const pendingD41EndpointTrustBasesInternalV1 = new CapturedWeakMapV1<
  object,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceD41EndpointTrustBasisInternalV1
>();

/** Register only an already-built committed D-40 validation identity. */
export function registerProviderStrongReadyBootstrapOrSteadyAcceptanceD41EndpointTrustBasisInternalV1(
  basis: ProviderStrongReadyBootstrapOrSteadyAcceptanceD41EndpointTrustBasisInternalV1,
): void {
  const validation = basis.acceptanceClosureIdentity;
  const result = validation.compareAppendResult;
  const receipt = result.resolution === "resolved" ? result.receipt : undefined;
  if (
    receipt === undefined ||
    receipt.payload.referenceOutcome.outcome !== "committed" ||
    validation.referenceState.namespace.state !== "current" ||
    basis.physicalTargetSelection.distributionHistoryCandidate !==
      basis.distributionHistoryClosure ||
    basis.distributionHistoryInput.strictCryptoCapability !==
      basis.strictCryptoCapability ||
    basis.distributionHistoryClosure.catalogPointClosure
        .registryManifestHistoryClosure.installationIdentityGenerationId !==
      validation.acceptanceCompareAppendRequest
        .installationIdentityGenerationId ||
    weakMapHasV1(pendingD41EndpointTrustBasesInternalV1, validation)
  ) {
    throw new CapturedTypeErrorV1(
      "D-40 endpoint-trust basis is not one committed exact transaction closure",
    );
  }
  weakMapSetV1(
    pendingD41EndpointTrustBasesInternalV1,
    validation,
    CapturedObjectFreezeV1({ ...basis }),
  );
}

/** Atomically claim and permanently burn the D-40 success identity. */
export function takeProviderStrongReadyBootstrapOrSteadyAcceptanceD41EndpointTrustBasisInternalV1(
  acceptanceClosureIdentity: unknown,
): ProviderStrongReadyBootstrapOrSteadyAcceptanceD41EndpointTrustBasisInternalV1 {
  if (
    acceptanceClosureIdentity === null ||
    (typeof acceptanceClosureIdentity !== "object" &&
      typeof acceptanceClosureIdentity !== "function")
  ) {
    throw new CapturedTypeErrorV1("D-40 endpoint-trust identity is unavailable");
  }
  const basis = weakMapGetV1(
    pendingD41EndpointTrustBasesInternalV1,
    acceptanceClosureIdentity,
  );
  if (
    basis === undefined ||
    !weakMapDeleteV1(
      pendingD41EndpointTrustBasesInternalV1,
      acceptanceClosureIdentity,
    )
  ) {
    throw new CapturedTypeErrorV1("D-40 endpoint-trust identity is unavailable");
  }
  return basis;
}

CapturedObjectFreezeV1(
  registerProviderStrongReadyBootstrapOrSteadyAcceptanceD41EndpointTrustBasisInternalV1,
);
CapturedObjectFreezeV1(
  takeProviderStrongReadyBootstrapOrSteadyAcceptanceD41EndpointTrustBasisInternalV1,
);
