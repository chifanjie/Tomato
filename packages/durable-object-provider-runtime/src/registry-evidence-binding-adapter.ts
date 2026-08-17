import {
  ProviderFeasibilityEvidenceEnvelopeV1Schema,
  buildProviderFeasibilityEvidenceRelativePathV1,
  deriveProviderFeasibilityEvidenceContentDigestV1,
  deriveProviderFeasibilityEvidenceIdV1,
  deriveProviderFeasibilityEvidencePinV1,
  type ProviderFeasibilityEvidenceEnvelopeV1,
  type ProviderFeasibilityEvidencePointClosureValidationV1,
} from "@understand-code/durable-object-provider-contracts/provider-feasibility-evidence-point";
import {
  PROVIDER_REGISTRY_EVIDENCE_BINDING_AUTHORITY_V1,
  diagnoseProviderRegistryEvidenceBindingPointClosureV1,
  type ProviderRegistryEvidenceBindingPointClosureValidationV1,
  type ValidateProviderRegistryEvidenceBindingPointClosureV1Input,
} from "@understand-code/durable-object-provider-contracts/provider-registry-evidence-binding-point";
import {
  ProviderFeasibilityEvidencePinV1Schema,
  type ProviderFeasibilityEvidencePinV1,
} from "@understand-code/durable-object-provider-contracts";
import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";

/**
 * Registry history, trust roots and runtime source artifacts are supplied by
 * the caller. This adapter validates and binds them, but never creates an
 * Evidence signature, Registry record or Registry authority.
 */
export type ProviderRuntimeRegistryEvidenceBindingContextV1 = Omit<
  ValidateProviderRegistryEvidenceBindingPointClosureV1Input,
  "providerFeasibilityEvidence" | "providerFeasibilityEvidencePin"
>;

export interface ProviderRuntimeValidatedFeasibilityEvidenceV1 {
  readonly evidence: ProviderFeasibilityEvidenceEnvelopeV1;
  readonly pin: ProviderFeasibilityEvidencePinV1;
  readonly closure: ProviderFeasibilityEvidencePointClosureValidationV1;
}

export interface AdaptProviderRuntimeRegistryEvidenceBindingOptionsV1 {
  readonly feasibilityEvidence: ProviderRuntimeValidatedFeasibilityEvidenceV1;
  readonly context: ProviderRuntimeRegistryEvidenceBindingContextV1;
}

export interface ProviderRuntimeRegistryEvidenceBindingAdapterValueV1 {
  readonly authority: typeof PROVIDER_REGISTRY_EVIDENCE_BINDING_AUTHORITY_V1;
  readonly accessMode: "read_only";
  readonly strongWriteStatus: "locked";
  readonly closure: ProviderRegistryEvidenceBindingPointClosureValidationV1;
}

export type ProviderRuntimeRegistryEvidenceBindingAdapterDiagnosticV1 =
  | {
      readonly ok: true;
      readonly value: ProviderRuntimeRegistryEvidenceBindingAdapterValueV1;
    }
  | {
      readonly ok: false;
      readonly code: "provider_unavailable";
      readonly reason: "attestation_invalid";
    };

export class ProviderRuntimeRegistryEvidenceBindingAdapterErrorV1 extends Error {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super("Provider runtime Registry/Evidence binding adapter rejected input");
    this.name = "ProviderRuntimeRegistryEvidenceBindingAdapterErrorV1";
  }
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  const leftBytes = new TextEncoder().encode(canonicalizeJcsSafeIntegerV1(left));
  const rightBytes = new TextEncoder().encode(canonicalizeJcsSafeIntegerV1(right));
  return leftBytes.byteLength === rightBytes.byteLength &&
    leftBytes.every((value, index) => value === rightBytes[index]);
}

function validateFeasibilityEvidenceBindingV1(
  input: ProviderRuntimeValidatedFeasibilityEvidenceV1,
): {
  readonly evidence: ProviderFeasibilityEvidenceEnvelopeV1;
  readonly pin: ProviderFeasibilityEvidencePinV1;
} {
  const evidence = ProviderFeasibilityEvidenceEnvelopeV1Schema.parse(input.evidence);
  const pin = ProviderFeasibilityEvidencePinV1Schema.parse(input.pin);
  const evidenceId = deriveProviderFeasibilityEvidenceIdV1(evidence.payload);
  const contentDigest = deriveProviderFeasibilityEvidenceContentDigestV1(evidence.payload);
  const derivedPin = deriveProviderFeasibilityEvidencePinV1(evidence);
  const relativePath = buildProviderFeasibilityEvidenceRelativePathV1(pin);
  const closure = input.closure;
  if (
    evidence.evidenceId !== evidenceId ||
    evidence.payload.evidenceId !== evidenceId ||
    evidence.contentDigest !== contentDigest ||
    !canonicalEqualV1(pin, derivedPin) ||
    closure.authority !== "none_provider_feasibility_evidence_structure_only" ||
    closure.relativePath !== relativePath ||
    !canonicalEqualV1(closure.providerFeasibilityEvidence, evidence) ||
    !canonicalEqualV1(closure.providerFeasibilityEvidencePin, pin)
  ) {
    throw new TypeError("feasibility Evidence binding mismatch");
  }
  return { evidence, pin };
}

function validateClosureBindingV1(
  closure: ProviderRegistryEvidenceBindingPointClosureValidationV1,
  feasibilityClosure: ProviderFeasibilityEvidencePointClosureValidationV1,
): void {
  if (
    closure.authority !== PROVIDER_REGISTRY_EVIDENCE_BINDING_AUTHORITY_V1 ||
    !canonicalEqualV1(
      closure.runtimeAttestationPointClosure,
      feasibilityClosure.runtimeAttestationPointClosure,
    ) ||
    !canonicalEqualV1(
      closure.providerFeasibilityEvidence,
      feasibilityClosure.providerFeasibilityEvidence,
    ) ||
    !canonicalEqualV1(
      closure.providerFeasibilityEvidencePin,
      feasibilityClosure.providerFeasibilityEvidencePin,
    ) ||
    closure.relativePath !== feasibilityClosure.relativePath ||
    !canonicalEqualV1(closure.qaApproverPublicKey, feasibilityClosure.qaApproverPublicKey) ||
    !canonicalEqualV1(
      closure.releaseApproverPublicKey,
      feasibilityClosure.releaseApproverPublicKey,
    )
  ) {
    throw new TypeError("Registry/Evidence closure binding mismatch");
  }
}

export async function diagnoseProviderRuntimeRegistryEvidenceBindingAdapterV1(
  options: AdaptProviderRuntimeRegistryEvidenceBindingOptionsV1,
): Promise<ProviderRuntimeRegistryEvidenceBindingAdapterDiagnosticV1> {
  try {
    const { evidence, pin } = validateFeasibilityEvidenceBindingV1(
      options.feasibilityEvidence,
    );
    const diagnostic = await diagnoseProviderRegistryEvidenceBindingPointClosureV1({
      ...options.context,
      providerFeasibilityEvidence: evidence,
      providerFeasibilityEvidencePin: pin,
    });
    if (!diagnostic.ok) {
      return {
        ok: false,
        code: "provider_unavailable",
        reason: "attestation_invalid",
      };
    }
    validateClosureBindingV1(diagnostic.value, options.feasibilityEvidence.closure);
    return {
      ok: true,
      value: {
        authority: PROVIDER_REGISTRY_EVIDENCE_BINDING_AUTHORITY_V1,
        accessMode: "read_only",
        strongWriteStatus: "locked",
        closure: diagnostic.value,
      },
    };
  } catch {
    return {
      ok: false,
      code: "provider_unavailable",
      reason: "attestation_invalid",
    };
  }
}

export async function adaptProviderRuntimeRegistryEvidenceBindingV1(
  options: AdaptProviderRuntimeRegistryEvidenceBindingOptionsV1,
): Promise<ProviderRuntimeRegistryEvidenceBindingAdapterValueV1> {
  const diagnostic = await diagnoseProviderRuntimeRegistryEvidenceBindingAdapterV1(options);
  if (!diagnostic.ok) {
    throw new ProviderRuntimeRegistryEvidenceBindingAdapterErrorV1();
  }
  return diagnostic.value;
}
