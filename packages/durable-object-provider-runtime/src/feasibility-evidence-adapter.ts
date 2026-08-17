import {
  ProviderFeasibilityEvidenceEnvelopeV1Schema,
  deriveProviderFeasibilityEvidenceContentDigestV1,
  deriveProviderFeasibilityEvidenceIdV1,
  deriveProviderFeasibilityEvidencePinV1,
  diagnoseProviderFeasibilityEvidencePointClosureV1,
  type ProviderFeasibilityEvidenceEnvelopeV1,
  type ProviderFeasibilityEvidencePointClosureValidationV1,
} from "@understand-code/durable-object-provider-contracts/provider-feasibility-evidence-point";
import {
  ProviderFeasibilityEvidencePinV1Schema,
  type ProviderFeasibilityApproverPublicKeyV1,
  type ProviderFeasibilityEvidencePinV1,
} from "@understand-code/durable-object-provider-contracts";
import {
  ProviderRealFilesystemConformanceResultEnvelopeV1Schema,
  ProviderRealFilesystemConformanceResultLocatorV1Schema,
  ProviderRealFilesystemConformanceResultPinV1Schema,
  deriveProviderRealFilesystemConformanceResultContentDigestV1,
  deriveProviderRealFilesystemConformanceResultIdV1,
  projectProviderRealFilesystemConformanceResultIdFieldsV1,
  type ProviderRealFilesystemConformanceResultEnvelopeV1,
  type ProviderRealFilesystemConformanceResultLocatorV1,
  type ProviderRealFilesystemConformanceResultPinV1,
  type ProviderRealFilesystemConformanceResultClosureValidationV1,
} from "@understand-code/durable-object-provider-contracts/provider-real-filesystem-conformance-result";
import type {
  ValidateProviderRuntimeAttestationPointClosureV1Input,
} from "@understand-code/durable-object-provider-contracts/provider-runtime-attestation-point";
import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";

import type { ProviderRuntimeRealFilesystemConformanceCandidateV1 } from "./conformance-runner.js";

/**
 * Source context needed to validate an externally signed Evidence point.  The
 * caller supplies the signatures, approver records, Runtime Attestation and
 * all distribution source envelopes; this adapter never creates or signs any
 * of them.  The conformance fields are deliberately omitted and injected from
 * the independently validated runtime result supplied to the adapter.
 */
export type ProviderRuntimeFeasibilityEvidenceSourceContextV1 = Omit<
  ValidateProviderRuntimeAttestationPointClosureV1Input,
  | "realFilesystemConformanceResult"
  | "realFilesystemConformanceResultLocator"
  | "realFilesystemConformanceResultPin"
> & {
  readonly providerFeasibilityEvidence: ProviderFeasibilityEvidenceEnvelopeV1;
  readonly providerFeasibilityEvidencePin: ProviderFeasibilityEvidencePinV1;
  readonly qaApproverPublicKey: ProviderFeasibilityApproverPublicKeyV1;
  readonly releaseApproverPublicKey: ProviderFeasibilityApproverPublicKeyV1;
};

export interface ProviderRuntimeFeasibilityEvidenceConformanceInputV1 {
  readonly envelope: ProviderRealFilesystemConformanceResultEnvelopeV1;
  readonly locator: ProviderRealFilesystemConformanceResultLocatorV1;
  readonly pin: ProviderRealFilesystemConformanceResultPinV1;
  readonly closure: ProviderRealFilesystemConformanceResultClosureValidationV1;
}

export interface AdaptProviderRuntimeFeasibilityEvidenceOptionsV1 {
  readonly conformanceResult: ProviderRuntimeFeasibilityEvidenceConformanceInputV1;
  readonly context: ProviderRuntimeFeasibilityEvidenceSourceContextV1;
}

export interface ProviderRuntimeFeasibilityEvidenceAdapterValueV1 {
  readonly evidence: ProviderFeasibilityEvidenceEnvelopeV1;
  readonly pin: ProviderFeasibilityEvidencePinV1;
  readonly closure: ProviderFeasibilityEvidencePointClosureValidationV1;
}

export type ProviderRuntimeFeasibilityEvidenceAdapterDiagnosticV1 =
  | { readonly ok: true; readonly value: ProviderRuntimeFeasibilityEvidenceAdapterValueV1 }
  | {
      readonly ok: false;
      readonly code: "provider_unavailable";
      readonly reason: "attestation_invalid";
    };

export class ProviderRuntimeFeasibilityEvidenceAdapterErrorV1 extends Error {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super("Provider runtime feasibility evidence adapter rejected input");
    this.name = "ProviderRuntimeFeasibilityEvidenceAdapterErrorV1";
  }
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  const leftBytes = new TextEncoder().encode(canonicalizeJcsSafeIntegerV1(left));
  const rightBytes = new TextEncoder().encode(canonicalizeJcsSafeIntegerV1(right));
  return leftBytes.byteLength === rightBytes.byteLength &&
    leftBytes.every((value, index) => value === rightBytes[index]);
}

function validateConformanceBindingV1(
  input: ProviderRuntimeFeasibilityEvidenceConformanceInputV1,
): void {
  const envelope = ProviderRealFilesystemConformanceResultEnvelopeV1Schema.parse(input.envelope);
  const locator = ProviderRealFilesystemConformanceResultLocatorV1Schema.parse(input.locator);
  const pin = ProviderRealFilesystemConformanceResultPinV1Schema.parse(input.pin);
  const payload = envelope.payload;
  const resultId = deriveProviderRealFilesystemConformanceResultIdV1(
    projectProviderRealFilesystemConformanceResultIdFieldsV1(payload),
  );
  const contentDigest = deriveProviderRealFilesystemConformanceResultContentDigestV1(payload);
  if (
    envelope.resultId !== resultId ||
    payload.resultId !== resultId ||
    envelope.contentDigest !== contentDigest ||
    locator.resultId !== resultId ||
    pin.resultId !== resultId ||
    pin.contentDigest !== contentDigest ||
    !canonicalEqualV1(input.closure.result, pin)
  ) {
    throw new TypeError("conformance result binding mismatch");
  }
}

function validateEvidenceIdentityV1(
  envelope: ProviderFeasibilityEvidenceEnvelopeV1,
  pin: ProviderFeasibilityEvidencePinV1,
): void {
  const evidenceId = deriveProviderFeasibilityEvidenceIdV1(envelope.payload);
  const contentDigest = deriveProviderFeasibilityEvidenceContentDigestV1(envelope.payload);
  const derivedPin = deriveProviderFeasibilityEvidencePinV1(envelope);
  if (
    envelope.evidenceId !== evidenceId ||
    envelope.payload.evidenceId !== evidenceId ||
    envelope.contentDigest !== contentDigest ||
    !canonicalEqualV1(derivedPin, pin)
  ) {
    throw new TypeError("evidence identity mismatch");
  }
}

export async function diagnoseProviderRuntimeFeasibilityEvidenceAdapterV1(
  options: AdaptProviderRuntimeFeasibilityEvidenceOptionsV1,
): Promise<ProviderRuntimeFeasibilityEvidenceAdapterDiagnosticV1> {
  try {
    validateConformanceBindingV1(options.conformanceResult);
    const evidence = ProviderFeasibilityEvidenceEnvelopeV1Schema.parse(
      options.context.providerFeasibilityEvidence,
    );
    const pin = ProviderFeasibilityEvidencePinV1Schema.parse(
      options.context.providerFeasibilityEvidencePin,
    );
    validateEvidenceIdentityV1(evidence, pin);
    const runtimePointInput = {
      ...options.context,
      realFilesystemConformanceResult: options.conformanceResult.envelope,
      realFilesystemConformanceResultLocator: options.conformanceResult.locator,
      realFilesystemConformanceResultPin: options.conformanceResult.pin,
    };
    const diagnostic = await diagnoseProviderFeasibilityEvidencePointClosureV1({
      ...runtimePointInput,
      providerFeasibilityEvidence: evidence,
      providerFeasibilityEvidencePin: pin,
    });
    if (!diagnostic.ok) {
      return { ok: false, code: "provider_unavailable", reason: "attestation_invalid" };
    }
    return { ok: true, value: { evidence, pin, closure: diagnostic.value } };
  } catch {
    return { ok: false, code: "provider_unavailable", reason: "attestation_invalid" };
  }
}

export async function adaptProviderRuntimeFeasibilityEvidenceV1(
  options: AdaptProviderRuntimeFeasibilityEvidenceOptionsV1,
): Promise<ProviderRuntimeFeasibilityEvidenceAdapterValueV1> {
  const diagnostic = await diagnoseProviderRuntimeFeasibilityEvidenceAdapterV1(options);
  if (!diagnostic.ok) throw new ProviderRuntimeFeasibilityEvidenceAdapterErrorV1();
  return diagnostic.value;
}
