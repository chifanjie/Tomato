import { z } from "./zod-runtime.js";

import {
  assertDataObjectDescriptorsBeforeSchemaV1,
} from "./domain-crypto.js";
import {
  type ProviderDistributionHistoryCurrentCandidatePointValidationV1,
  type ValidateProviderDistributionHistoryCurrentCandidatePointV1Input,
  validateProviderDistributionHistoryCurrentCandidatePointV1,
} from "./provider-distribution-history-current-candidate-point.js";
import {
  type ProviderFeasibilityOwnerTargetCapabilityV1,
  type ProviderFeasibilitySupportCatalogPinV1,
} from "./provider-feasibility-support-catalog-point.js";
import {
  createProviderNonThenableFrozenRecordV1,
  createProviderPointFulfilledPromiseV1,
  createProviderPointRejectedPromiseV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import type {
  ProviderFeasibilityTargetV1,
} from "./provider-target-discovery-point.js";
import {
  consumeProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1,
  isProviderTrustedLocalPhysicalTargetObservationCapabilityErrorInternalV1,
  type ProviderTrustedLocalPhysicalTargetObservationCapabilityErrorInternalV1,
} from "./provider-trusted-local-physical-target-observation-capability-internal.js";
import {
  deriveProviderTrustedLocalPhysicalTargetSelectionInternalV1,
  isProviderTrustedLocalPhysicalTargetSelectionErrorInternalV1,
} from "./provider-trusted-local-physical-target-selection-candidate-internal.js";

const CapturedArrayPrototypeSortV1 = Array.prototype.sort;
const CapturedFunctionPrototypeBindV1 = Function.prototype.bind;
const CapturedFunctionPrototypeCallV1 = Function.prototype.call;
const CapturedObjectCreateV1 = Object.create;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectGetOwnPropertyDescriptorsV1 =
  Object.getOwnPropertyDescriptors;
const CapturedObjectGetOwnPropertySymbolsV1 = Object.getOwnPropertySymbols;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedObjectKeysV1 = Object.keys;
const CapturedObjectPrototypeV1 = Object.prototype;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedTypeErrorV1 = TypeError;
const CapturedWeakSetV1 = WeakSet;
const CapturedWeakSetPrototypeAddV1 = WeakSet.prototype.add;
const CapturedWeakSetPrototypeHasV1 = WeakSet.prototype.has;

function bindUncurriedLocalTargetIntrinsicV1(method: Function): Function {
  return CapturedObjectFreezeV1(
    CapturedReflectApplyV1(
      CapturedFunctionPrototypeBindV1,
      CapturedFunctionPrototypeCallV1,
      CapturedObjectFreezeV1([method]),
    ) as Function,
  );
}

const weakSetAddV1 = bindUncurriedLocalTargetIntrinsicV1(
  CapturedWeakSetPrototypeAddV1,
) as <T extends object>(receiver: WeakSet<T>, value: T) => WeakSet<T>;
const weakSetHasV1 = bindUncurriedLocalTargetIntrinsicV1(
  CapturedWeakSetPrototypeHasV1,
) as <T extends object>(receiver: WeakSet<T>, value: T) => boolean;

export const PROVIDER_TRUSTED_LOCAL_PHYSICAL_TARGET_SELECTION_CANDIDATE_AUTHORITY_V1 =
  "none_provider_trusted_local_physical_target_selection_candidate_only" as const;

export interface ProviderTrustedLocalPhysicalTargetSelectionCandidateValidationV1 {
  readonly authority:
    typeof PROVIDER_TRUSTED_LOCAL_PHYSICAL_TARGET_SELECTION_CANDIDATE_AUTHORITY_V1;
  readonly distributionHistoryCandidate:
    ProviderDistributionHistoryCurrentCandidatePointValidationV1;
  readonly selectedOwnerTargetCapability:
    ProviderFeasibilityOwnerTargetCapabilityV1;
  readonly providerFeasibilitySupportCatalogPin:
    ProviderFeasibilitySupportCatalogPinV1;
}

export const ProviderTrustedLocalPhysicalTargetSelectionCandidateInvalidStageV1Schema =
  z.enum([
    "input",
    "physical_target_observation_capability",
    "physical_target_precheck",
    "distribution_history_candidate",
    "physical_target_postcheck",
    "local_target_selection",
  ]);
export type ProviderTrustedLocalPhysicalTargetSelectionCandidateInvalidStageV1 =
  z.infer<
    typeof ProviderTrustedLocalPhysicalTargetSelectionCandidateInvalidStageV1Schema
  >;

export const ProviderTrustedLocalPhysicalTargetSelectionCandidateInvalidReasonV1Schema =
  z.enum([
    "schema_invalid",
    "capability_invalid",
    "observation_unavailable",
    "observation_invalid",
    "root_volume_changed",
    "observation_changed",
    "source_invalid",
    "target_zero_match",
    "target_ambiguous_match",
    "target_projection_mismatch",
  ]);
export type ProviderTrustedLocalPhysicalTargetSelectionCandidateInvalidReasonV1 =
  z.infer<
    typeof ProviderTrustedLocalPhysicalTargetSelectionCandidateInvalidReasonV1Schema
  >;

declare const providerTrustedLocalPhysicalTargetObservationCapabilityBrandV1:
  unique symbol;
export interface ProviderTrustedLocalPhysicalTargetObservationCapabilityV1 {
  readonly [providerTrustedLocalPhysicalTargetObservationCapabilityBrandV1]: true;
}

export interface SelectProviderTrustedLocalPhysicalTargetCandidateV1Input {
  readonly distributionHistoryCandidate:
    ValidateProviderDistributionHistoryCurrentCandidatePointV1Input;
  readonly physicalTargetObservationCapability:
    ProviderTrustedLocalPhysicalTargetObservationCapabilityV1;
}

interface LocalTargetSelectionDiagnosticFailureV1 {
  readonly ok: false;
  readonly stage:
    ProviderTrustedLocalPhysicalTargetSelectionCandidateInvalidStageV1;
  readonly reason:
    ProviderTrustedLocalPhysicalTargetSelectionCandidateInvalidReasonV1;
}

interface LocalTargetSelectionDiagnosticSuccessV1 {
  readonly ok: true;
  readonly value:
    ProviderTrustedLocalPhysicalTargetSelectionCandidateValidationV1;
}

export type ProviderTrustedLocalPhysicalTargetSelectionCandidateDiagnosticResultV1 =
  | LocalTargetSelectionDiagnosticFailureV1
  | LocalTargetSelectionDiagnosticSuccessV1;

export class ProviderTrustedLocalPhysicalTargetSelectionCandidateValidationError extends Error {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super("Provider trusted local physical-target selection failed");
    this.name =
      "ProviderTrustedLocalPhysicalTargetSelectionCandidateValidationError";
    CapturedObjectFreezeV1(this);
  }
}

class LocalTargetSelectionDiagnosticSignalV1 extends Error {
  constructor(
    readonly stage:
      ProviderTrustedLocalPhysicalTargetSelectionCandidateInvalidStageV1,
    readonly reason:
      ProviderTrustedLocalPhysicalTargetSelectionCandidateInvalidReasonV1,
  ) {
    super("provider trusted local physical-target selection diagnostic");
    weakSetAddV1(LocalTargetSelectionDiagnosticSignalsV1, this);
  }
}

const LocalTargetSelectionDiagnosticSignalsV1 =
  new CapturedWeakSetV1<object>();

function isDiagnosticSignalV1(
  value: unknown,
): value is LocalTargetSelectionDiagnosticSignalV1 {
  return typeof value === "object" && value !== null &&
    weakSetHasV1(LocalTargetSelectionDiagnosticSignalsV1, value);
}

function failV1(
  stage: ProviderTrustedLocalPhysicalTargetSelectionCandidateInvalidStageV1,
  reason: ProviderTrustedLocalPhysicalTargetSelectionCandidateInvalidReasonV1,
): never {
  throw new LocalTargetSelectionDiagnosticSignalV1(stage, reason);
}

const INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "distributionHistoryCandidate",
  "physicalTargetObservationCapability",
] as const);

function sortedKeysV1(value: object): string[] {
  const keys = CapturedObjectKeysV1(value);
  return CapturedReflectApplyV1(CapturedArrayPrototypeSortV1, keys, [
    undefined,
  ]) as string[];
}

function extractSubmittedCapabilityV1(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return undefined;
  const descriptor = CapturedObjectGetOwnPropertyDescriptorV1(
    input,
    "physicalTargetObservationCapability",
  );
  if (descriptor === undefined || !("value" in descriptor)) return undefined;
  return descriptor.value;
}

function captureExactInputAfterClaimV1(
  input: unknown,
): Readonly<Record<(typeof INPUT_KEYS_V1)[number], unknown>> {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  const prototype = CapturedObjectGetPrototypeOfV1(input);
  if (prototype !== CapturedObjectPrototypeV1 && prototype !== null) {
    throw new CapturedTypeErrorV1("selection input must be a plain object");
  }
  if (CapturedObjectGetOwnPropertySymbolsV1(input).length !== 0) {
    throw new CapturedTypeErrorV1("selection input must not contain symbols");
  }
  const descriptors = CapturedObjectGetOwnPropertyDescriptorsV1(input);
  const keys = sortedKeysV1(descriptors);
  if (keys.length !== INPUT_KEYS_V1.length) {
    throw new CapturedTypeErrorV1("selection input key set is invalid");
  }
  const captured = CapturedObjectCreateV1(null) as Record<
    (typeof INPUT_KEYS_V1)[number],
    unknown
  >;
  for (let index = 0; index < INPUT_KEYS_V1.length; index += 1) {
    const key = INPUT_KEYS_V1[index]!;
    const descriptor = descriptors[key];
    if (
      keys[index] !== key ||
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new CapturedTypeErrorV1("selection input key set is invalid");
    }
    captured[key] = descriptor.value;
  }
  return CapturedObjectFreezeV1(captured);
}

function selectTargetFromValidatedClosureV1(
  validation: ProviderDistributionHistoryCurrentCandidatePointValidationV1,
  observedTarget: ProviderFeasibilityTargetV1,
): ProviderTrustedLocalPhysicalTargetSelectionCandidateValidationV1 {
  try {
    const selection =
      deriveProviderTrustedLocalPhysicalTargetSelectionInternalV1(
        validation,
        observedTarget,
      );

    return createProviderNonThenableFrozenRecordV1({
      authority:
        PROVIDER_TRUSTED_LOCAL_PHYSICAL_TARGET_SELECTION_CANDIDATE_AUTHORITY_V1,
      distributionHistoryCandidate: validation,
      selectedOwnerTargetCapability:
        selection.selectedOwnerTargetCapability,
      providerFeasibilitySupportCatalogPin:
        selection.providerFeasibilitySupportCatalogPin,
    }) as ProviderTrustedLocalPhysicalTargetSelectionCandidateValidationV1;
  } catch (error) {
    if (isDiagnosticSignalV1(error)) throw error;
    if (isProviderTrustedLocalPhysicalTargetSelectionErrorInternalV1(error)) {
      return failV1("local_target_selection", error.reason);
    }
    return failV1("local_target_selection", "source_invalid");
  }
}

async function selectInternalV1(
  input: unknown,
): Promise<ProviderTrustedLocalPhysicalTargetSelectionCandidateValidationV1> {
  let submittedCapability: unknown;
  try {
    submittedCapability = extractSubmittedCapabilityV1(input);
  } catch {
    return failV1("input", "schema_invalid");
  }

  const consumed =
    await consumeProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1(
      submittedCapability,
      async (observation) => {
        let fields: Readonly<
          Record<(typeof INPUT_KEYS_V1)[number], unknown>
        >;
        try {
          fields = captureExactInputAfterClaimV1(input);
        } catch {
          return failV1("input", "schema_invalid");
        }
        if (
          fields.physicalTargetObservationCapability !== submittedCapability
        ) {
          return failV1(
            "physical_target_observation_capability",
            "capability_invalid",
          );
        }

        let validation:
          ProviderDistributionHistoryCurrentCandidatePointValidationV1;
        try {
          // This is deliberately the sole C09-1N validation call in D-39.
          validation =
            await validateProviderDistributionHistoryCurrentCandidatePointV1(
              fields.distributionHistoryCandidate as
                ValidateProviderDistributionHistoryCurrentCandidatePointV1Input,
            );
        } catch {
          return failV1(
            "distribution_history_candidate",
            "source_invalid",
          );
        }
        return selectTargetFromValidatedClosureV1(
          validation,
          observation.pre.target,
        );
      },
    );
  return consumed.result;
}

function mapObservationErrorV1(
  error: ProviderTrustedLocalPhysicalTargetObservationCapabilityErrorInternalV1,
): LocalTargetSelectionDiagnosticFailureV1 {
  const stage = error.stage === "physical_target_precheck"
    ? "physical_target_precheck"
    : error.stage === "physical_target_postcheck"
    ? "physical_target_postcheck"
    : "physical_target_observation_capability";
  const reason = error.reason === "capability_invalid"
    ? "capability_invalid"
    : error.reason === "observation_unavailable"
    ? "observation_unavailable"
    : error.reason === "observation_invalid"
    ? "observation_invalid"
    : error.reason === "root_volume_changed"
    ? "root_volume_changed"
    : "observation_changed";
  return diagnosticFailureV1(stage, reason);
}

function diagnosticFailureV1(
  stage: ProviderTrustedLocalPhysicalTargetSelectionCandidateInvalidStageV1,
  reason: ProviderTrustedLocalPhysicalTargetSelectionCandidateInvalidReasonV1,
): LocalTargetSelectionDiagnosticFailureV1 {
  return createProviderNonThenableFrozenRecordV1({
    ok: false as const,
    stage,
    reason,
  });
}

function diagnosticFailureFromErrorV1(
  error: unknown,
): LocalTargetSelectionDiagnosticFailureV1 {
  if (isDiagnosticSignalV1(error)) {
    return diagnosticFailureV1(error.stage, error.reason);
  }
  if (
    isProviderTrustedLocalPhysicalTargetObservationCapabilityErrorInternalV1(
      error,
    )
  ) {
    return mapObservationErrorV1(error);
  }
  return diagnosticFailureV1("local_target_selection", "source_invalid");
}

export function diagnoseProviderTrustedLocalPhysicalTargetCandidateV1(
  input: unknown,
): Promise<ProviderTrustedLocalPhysicalTargetSelectionCandidateDiagnosticResultV1> {
  let operation: Promise<
    ProviderTrustedLocalPhysicalTargetSelectionCandidateValidationV1
  >;
  try {
    operation = hardenProviderPointPromiseV1(selectInternalV1(input));
  } catch (error) {
    return createProviderPointFulfilledPromiseV1(
      diagnosticFailureFromErrorV1(error),
    );
  }
  return operation.then(
    (value) =>
      createProviderNonThenableFrozenRecordV1({ ok: true as const, value }),
    (error) => diagnosticFailureFromErrorV1(error),
  );
}

export function selectProviderTrustedLocalPhysicalTargetCandidateV1(
  input: SelectProviderTrustedLocalPhysicalTargetCandidateV1Input,
): Promise<ProviderTrustedLocalPhysicalTargetSelectionCandidateValidationV1> {
  let operation: Promise<
    ProviderTrustedLocalPhysicalTargetSelectionCandidateValidationV1
  >;
  try {
    operation = hardenProviderPointPromiseV1(selectInternalV1(input));
  } catch {
    return createProviderPointRejectedPromiseV1(
      new ProviderTrustedLocalPhysicalTargetSelectionCandidateValidationError(),
    );
  }
  return operation.then(
    (value) => value,
    () => {
      throw new ProviderTrustedLocalPhysicalTargetSelectionCandidateValidationError();
    },
  );
}

CapturedObjectFreezeV1(
  diagnoseProviderTrustedLocalPhysicalTargetCandidateV1,
);
CapturedObjectFreezeV1(selectProviderTrustedLocalPhysicalTargetCandidateV1);
