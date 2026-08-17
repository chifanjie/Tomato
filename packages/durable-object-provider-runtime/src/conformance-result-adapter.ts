import { createHash } from "node:crypto";

import {
  ProviderFeasibilityTargetV1Schema,
  diagnoseProviderTargetDiscoveryPointClosureV1,
  type ProviderFeasibilityTargetV1,
  type ProviderTargetDiscoveryPointClosureValidationV1,
  type ValidateProviderTargetDiscoveryPointClosureV1Input,
} from "@understand-code/durable-object-provider-contracts/provider-target-discovery-point";
import {
  ProviderRealFilesystemConformanceResultEnvelopeV1Schema,
  ProviderRealFilesystemConformanceResultLocatorV1Schema,
  ProviderRealFilesystemConformanceResultPinV1Schema,
  ProviderRealFilesystemConformanceResultV1Schema,
  deriveProviderRealFilesystemConformanceResultContentDigestV1,
  deriveProviderRealFilesystemConformanceResultIdV1,
  diagnoseProviderRealFilesystemConformanceResultClosureV1,
  projectProviderRealFilesystemConformanceResultIdFieldsV1,
  type ProviderRealFilesystemConformanceResultEnvelopeV1,
  type ProviderRealFilesystemConformanceResultLocatorV1,
  type ProviderRealFilesystemConformanceResultPinV1,
  type ProviderRealFilesystemConformanceResultClosureValidationV1,
  type ValidateProviderRealFilesystemConformanceResultClosureV1Input,
} from "@understand-code/durable-object-provider-contracts/provider-real-filesystem-conformance-result";
import {
  ProviderRealFilesystemSuiteManifestEnvelopeV1Schema,
  type ProviderRealFilesystemSuiteManifestEnvelopeV1,
} from "@understand-code/durable-object-provider-contracts/provider-real-filesystem-source";
import {
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  type ContentDigestV1,
} from "@understand-code/durable-object-provider-contracts/primitives";
import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";

import {
  PROVIDER_RUNTIME_REAL_FILESYSTEM_CONFORMANCE_CANDIDATE_PROFILE_V1,
  type ProviderRuntimeRealFilesystemConformanceCandidateV1,
  type ProviderRuntimeRealFilesystemConformanceCaseIdV1,
  type ProviderRuntimeRealFilesystemConformanceCaseResultV1,
} from "./conformance-runner.js";

/**
 * The runtime runner intentionally emits an unsigned observation with private
 * target details removed.  This adapter is the only bridge into the strict
 * contracts result envelope.  It therefore requires the complete, caller-
 * supplied discovery closure and an explicit mapping from runtime cases to
 * signed-suite case cuts; it never invents a discovery or suite record.
 */
export interface ProviderRuntimeRealFilesystemConformanceResultContextV1 {
  readonly target: ProviderFeasibilityTargetV1;
  readonly targetDiscoveryPointInput: ValidateProviderTargetDiscoveryPointClosureV1Input;
  readonly verifiedTargetDiscoveryPoint: ProviderTargetDiscoveryPointClosureValidationV1;
  readonly caseBindings: readonly ProviderRuntimeRealFilesystemConformanceCaseBindingV1[];
}

export interface ProviderRuntimeRealFilesystemConformanceCaseBindingV1 {
  readonly candidateCaseId: ProviderRuntimeRealFilesystemConformanceCaseIdV1;
  readonly caseId: string;
  readonly crashCutId: string;
}

export interface AdaptProviderRuntimeRealFilesystemConformanceResultOptionsV1 {
  readonly candidate: ProviderRuntimeRealFilesystemConformanceCandidateV1;
  readonly context: ProviderRuntimeRealFilesystemConformanceResultContextV1;
}

export interface ProviderRuntimeRealFilesystemConformanceResultAdapterValueV1 {
  readonly envelope: ProviderRealFilesystemConformanceResultEnvelopeV1;
  readonly locator: ProviderRealFilesystemConformanceResultLocatorV1;
  readonly pin: ProviderRealFilesystemConformanceResultPinV1;
  readonly closure: ProviderRealFilesystemConformanceResultClosureValidationV1;
}

export type ProviderRuntimeRealFilesystemConformanceResultAdapterDiagnosticV1 =
  | { readonly ok: true; readonly value: ProviderRuntimeRealFilesystemConformanceResultAdapterValueV1 }
  | {
      readonly ok: false;
      readonly code: "provider_unavailable";
      readonly reason: "attestation_invalid";
    };

export class ProviderRuntimeRealFilesystemConformanceResultAdapterErrorV1 extends Error {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super("Provider runtime conformance result adapter rejected input");
    this.name = "ProviderRuntimeRealFilesystemConformanceResultAdapterErrorV1";
  }
}

const RESULT_DIGEST_DOMAIN_V1 =
  "understand-code-provider-runtime-real-filesystem-conformance-candidate-v1" as const;

const CANDIDATE_CASE_IDS_V1: readonly ProviderRuntimeRealFilesystemConformanceCaseIdV1[] = [
  "exact_object_write_read",
  "immutable_no_replace_replay",
  "external_compare_and_set",
  "restart_recovery",
  "target_continuity",
];

const STRICT_FAILURE_CODES_V1 = new Set([
  "assertion_failed",
  "provider_rejected",
  "crash_recovery_failed",
  "identity_discontinuity",
  "containment_violation",
] as const);

function digestCandidatePayloadV1(
  candidate: ProviderRuntimeRealFilesystemConformanceCandidateV1,
): ContentDigestV1 {
  const { resultDigest: _resultDigest, ...payload } = candidate;
  return ContentDigestV1Schema.parse(
    `sha256:${createHash("sha256")
      .update(canonicalizeJcsSafeIntegerV1({ domain: RESULT_DIGEST_DOMAIN_V1, value: payload }))
      .digest("hex")}`,
  );
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  const leftBytes = new TextEncoder().encode(canonicalizeJcsSafeIntegerV1(left));
  const rightBytes = new TextEncoder().encode(canonicalizeJcsSafeIntegerV1(right));
  return leftBytes.byteLength === rightBytes.byteLength &&
    leftBytes.every((value, index) => value === rightBytes[index]);
}

function strictCandidateCaseV1(
  candidate: ProviderRuntimeRealFilesystemConformanceCandidateV1,
  caseId: ProviderRuntimeRealFilesystemConformanceCaseIdV1,
): ProviderRuntimeRealFilesystemConformanceCaseResultV1 {
  const entry = candidate.cases.find((item) => item.caseId === caseId);
  if (entry === undefined) throw new TypeError("candidate case missing");
  return entry;
}

function mapCaseV1(
  entry: ProviderRuntimeRealFilesystemConformanceCaseResultV1,
): "passed" | "failed" | "unsupported" {
  if (entry.outcome === "passed" && entry.resultCode === "passed") return "passed";
  if (entry.outcome === "not_run" || entry.resultCode === "not_run") return "unsupported";
  if ((entry.resultCode as string) === "unsupported_by_target_profile") return "unsupported";
  return "failed";
}

function mapResultCodeV1(
  entry: ProviderRuntimeRealFilesystemConformanceCaseResultV1,
): "passed" | "assertion_failed" | "provider_rejected" | "crash_recovery_failed" | "identity_discontinuity" | "containment_violation" | "unsupported_by_target_profile" {
  const outcome = mapCaseV1(entry);
  if (outcome === "passed") return "passed";
  if (outcome === "unsupported") return "unsupported_by_target_profile";
  return STRICT_FAILURE_CODES_V1.has(entry.resultCode as never)
    ? (entry.resultCode as "assertion_failed" | "provider_rejected" | "crash_recovery_failed" | "identity_discontinuity" | "containment_violation")
    : "assertion_failed";
}

function requiredCaseCutKeysV1(
  suite: ProviderRealFilesystemSuiteManifestEnvelopeV1,
): string[] {
  return suite.payload.cases.flatMap((suiteCase) =>
    suiteCase.requiredCrashCuts.map((cut) => `${suiteCase.caseId}\u0000${cut.crashCutId}`),
  );
}

function validateCandidateShapeV1(
  candidate: ProviderRuntimeRealFilesystemConformanceCandidateV1,
): void {
  if (
    candidate.schemaVersion !== 1 ||
    candidate.profile !== PROVIDER_RUNTIME_REAL_FILESYSTEM_CONFORMANCE_CANDIDATE_PROFILE_V1 ||
    (candidate.status !== "candidate_passed" && candidate.status !== "candidate_failed") ||
    candidate.authority !== "none" ||
    candidate.strongWriteStatus !== "locked" ||
    candidate.registryEvidenceStatus !== "pending_signed_registry_evidence" ||
    candidate.cases.length !== CANDIDATE_CASE_IDS_V1.length ||
    !CANDIDATE_CASE_IDS_V1.every((caseId, index) => candidate.cases[index]?.caseId === caseId) ||
    candidate.resultDigest !== digestCandidatePayloadV1(candidate)
  ) {
    throw new TypeError("candidate mismatch");
  }
  for (const entry of candidate.cases) {
    if (
      (entry.outcome === "passed" && entry.resultCode !== "passed") ||
      (entry.outcome === "not_run" && entry.resultCode !== "not_run") ||
      (entry.outcome === "failed" && (entry.resultCode === "passed" || entry.resultCode === "not_run"))
    ) {
      throw new TypeError("candidate case outcome mismatch");
    }
  }
  if (candidate.status === "candidate_failed" && candidate.cases.every((entry) => entry.outcome === "passed")) {
    throw new TypeError("candidate status mismatch");
  }
  DurableObjectIdentityProviderIdV1Schema.parse(candidate.bindings.providerId);
  ContentDigestV1Schema.parse(candidate.bindings.targetFingerprintDigest);
  ContentDigestV1Schema.parse(candidate.bindings.binaryDigest);
  ContentDigestV1Schema.parse(candidate.bindings.policyDigest);
  ContentDigestV1Schema.parse(candidate.bindings.capabilityDigest);
  ContentDigestV1Schema.parse(candidate.executionDigest);
  ContentDigestV1Schema.parse(candidate.fixtureObjectDigest);
  if (candidate.status === "candidate_passed" && candidate.cases.some((entry) => entry.outcome !== "passed")) {
    throw new TypeError("candidate status mismatch");
  }
}

function buildClosureInputV1(
  context: ProviderRuntimeRealFilesystemConformanceResultContextV1,
  envelope: ProviderRealFilesystemConformanceResultEnvelopeV1,
  locator: ProviderRealFilesystemConformanceResultLocatorV1,
  pin: ProviderRealFilesystemConformanceResultPinV1,
): ValidateProviderRealFilesystemConformanceResultClosureV1Input {
  return {
    ...context.targetDiscoveryPointInput,
    realFilesystemConformanceResult: envelope,
    realFilesystemConformanceResultLocator: locator,
    realFilesystemConformanceResultPin: pin,
  };
}

export async function diagnoseProviderRuntimeRealFilesystemConformanceResultAdapterV1(
  options: AdaptProviderRuntimeRealFilesystemConformanceResultOptionsV1,
): Promise<ProviderRuntimeRealFilesystemConformanceResultAdapterDiagnosticV1> {
  try {
    validateCandidateShapeV1(options.candidate);
    const context = options.context;
    const target = ProviderFeasibilityTargetV1Schema.parse(context.target);
    const suite = ProviderRealFilesystemSuiteManifestEnvelopeV1Schema.parse(
      context.targetDiscoveryPointInput.suiteManifest,
    );
    const targetPointDiagnostic = await diagnoseProviderTargetDiscoveryPointClosureV1(
      context.targetDiscoveryPointInput,
    );
    if (!targetPointDiagnostic.ok ||
      !canonicalEqualV1(targetPointDiagnostic.value, context.verifiedTargetDiscoveryPoint)) {
      throw new TypeError("target discovery context mismatch");
    }
    const discovered = context.targetDiscoveryPointInput.targetDiscoveryResult.payload.targets
      .filter((entry) => entry.target.targetProfileId === target.targetProfileId);
    if (discovered.length !== 1 || !canonicalEqualV1(discovered[0]!.target, target)) {
      throw new TypeError("target membership mismatch");
    }

    const requiredKeys = requiredCaseCutKeysV1(suite);
    const bindings = context.caseBindings;
    const boundKeys = bindings.map((binding) => `${binding.caseId}\u0000${binding.crashCutId}`);
    if (
      bindings.length !== requiredKeys.length ||
      new Set(boundKeys).size !== boundKeys.length ||
      !requiredKeys.every((key) => boundKeys.includes(key)) ||
      !bindings.every((binding) => CANDIDATE_CASE_IDS_V1.includes(binding.candidateCaseId))
    ) {
      throw new TypeError("case mapping mismatch");
    }
    const caseResults = bindings.map((binding) => {
      const candidateCase = strictCandidateCaseV1(options.candidate, binding.candidateCaseId);
      return {
        caseId: binding.caseId,
        crashCutId: binding.crashCutId,
        outcome: mapCaseV1(candidateCase),
        resultCode: mapResultCodeV1(candidateCase),
      } as const;
    });
    const result = ProviderRealFilesystemConformanceResultV1Schema.parse({
      profile: "provider_real_fs_conformance_result_v1",
      resultId: "provider-real-fs-result:0000000000000000000000",
      providerId: options.candidate.bindings.providerId,
      semanticProviderPolicyDigest: options.candidate.bindings.policyDigest,
      implementationDigest: options.candidate.bindings.binaryDigest,
      binaryAttestationDigest: options.candidate.bindings.binaryDigest,
      target,
      targetDiscoveryResult: targetPointDiagnostic.value.targetDiscoveryResult,
      targetDiscoveryInputBundleContentDigest:
        targetPointDiagnostic.value.targetDiscoveryInputBundleContentDigest,
      realFilesystemSuiteManifest: targetPointDiagnostic.value.realFilesystemSuiteManifest,
      suiteDigest: suite.payload.suiteDigest,
      fixtureManifestDigest: suite.payload.fixtureCorpusManifest.fixtureManifestDigest,
      runnerProfileDigest: suite.payload.runnerProfileDigest,
      crashCutCoverageDigest: suite.payload.requiredCaseCutSetDigest,
      caseResults,
      result: caseResults.some((entry) => entry.outcome === "failed")
        ? "failed"
        : caseResults.some((entry) => entry.outcome === "unsupported")
          ? "unsupported"
          : "passed",
      completedAt: options.candidate.completedAt,
    });
    const resultId = deriveProviderRealFilesystemConformanceResultIdV1(
      projectProviderRealFilesystemConformanceResultIdFieldsV1(result),
    );
    const payload = ProviderRealFilesystemConformanceResultV1Schema.parse({ ...result, resultId });
    const contentDigest = deriveProviderRealFilesystemConformanceResultContentDigestV1(payload);
    const envelope = ProviderRealFilesystemConformanceResultEnvelopeV1Schema.parse({
      schemaVersion: 1,
      recordType: "provider_real_fs_conformance_result",
      resultId,
      contentDigest,
      payload,
    });
    const locator = ProviderRealFilesystemConformanceResultLocatorV1Schema.parse({
      locatorProfile: "installation_provider_real_fs_conformance_result_v1",
      resultId,
    });
    const pin = ProviderRealFilesystemConformanceResultPinV1Schema.parse({
      ...locator,
      contentDigest,
    });
    const closureDiagnostic = await diagnoseProviderRealFilesystemConformanceResultClosureV1(
      buildClosureInputV1(context, envelope, locator, pin),
    );
    if (!closureDiagnostic.ok) throw new TypeError("result closure mismatch");
    return { ok: true, value: { envelope, locator, pin, closure: closureDiagnostic.value } };
  } catch {
    return { ok: false, code: "provider_unavailable", reason: "attestation_invalid" };
  }
}

export async function adaptProviderRuntimeRealFilesystemConformanceResultV1(
  options: AdaptProviderRuntimeRealFilesystemConformanceResultOptionsV1,
): Promise<ProviderRuntimeRealFilesystemConformanceResultAdapterValueV1> {
  const diagnostic = await diagnoseProviderRuntimeRealFilesystemConformanceResultAdapterV1(options);
  if (!diagnostic.ok) throw new ProviderRuntimeRealFilesystemConformanceResultAdapterErrorV1();
  return diagnostic.value;
}
