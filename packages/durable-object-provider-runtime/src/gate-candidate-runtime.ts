import type { ProviderServiceHandoffInspectionV1 } from "./service-handoff.js";
import {
  adaptProviderRuntimeRealFilesystemConformanceResultV1,
  type AdaptProviderRuntimeRealFilesystemConformanceResultOptionsV1,
  type ProviderRuntimeRealFilesystemConformanceResultAdapterValueV1,
} from "./conformance-result-adapter.js";
import {
  adaptProviderRuntimeFeasibilityEvidenceV1,
  type AdaptProviderRuntimeFeasibilityEvidenceOptionsV1,
  type ProviderRuntimeFeasibilityEvidenceAdapterValueV1,
  type ProviderRuntimeFeasibilityEvidenceSourceContextV1,
} from "./feasibility-evidence-adapter.js";
import {
  adaptProviderRuntimeRegistryEvidenceBindingV1,
  type AdaptProviderRuntimeRegistryEvidenceBindingOptionsV1,
  type ProviderRuntimeRegistryEvidenceBindingAdapterValueV1,
  type ProviderRuntimeRegistryEvidenceBindingContextV1,
  type ProviderRuntimeValidatedFeasibilityEvidenceV1,
} from "./registry-evidence-binding-adapter.js";
import {
  adaptProviderRuntimeFeasibilitySupportCatalogV1,
  type AdaptProviderRuntimeFeasibilitySupportCatalogOptionsV1,
  type ProviderRuntimeFeasibilitySupportCatalogAdapterValueV1,
  type ProviderRuntimeFeasibilitySupportCatalogContextV1,
} from "./feasibility-support-catalog-adapter.js";
import {
  projectProviderRuntimeProviderGateV1,
  type ProviderRuntimeProviderGateProjectionValueV1,
} from "./provider-gate-projection.js";
import {
  diagnoseProviderRuntimeLiveGateBindingV1,
  type ProviderRuntimeLiveGateBindingOptionsV1,
  type ProviderRuntimeLiveGateActivationCandidateV1,
} from "./live-gate-binding.js";
import {
  diagnoseProviderRuntimeDurableAcceptanceCurrentV1,
  type ProviderRuntimeDurableAcceptanceCurrentCandidateV1,
} from "./durable-acceptance-current.js";
import {
  verifyProviderRuntimeLivePrincipalChallengeV1,
  type ProviderRuntimePrincipalKeyLiveCandidateV1,
} from "./live-principal-challenge.js";

export type ProviderRuntimeGateCandidateStageV1 =
  | "conformance_result"
  | "feasibility_evidence"
  | "registry_evidence_binding"
  | "support_catalog"
  | "gate_projection"
  | "live_gate_binding"
  | "durable_acceptance_current"
  | "principal_key_live";

export type ProviderRuntimeGateCandidateConformanceInputV1 =
  | {
      readonly conformanceResult: AdaptProviderRuntimeRealFilesystemConformanceResultOptionsV1;
      readonly validatedConformanceResult?: never;
    }
  | {
      readonly validatedConformanceResult: ProviderRuntimeRealFilesystemConformanceResultAdapterValueV1;
      readonly conformanceResult?: never;
    };

export type RunProviderRuntimeGateCandidateOptionsV1 =
  ProviderRuntimeGateCandidateConformanceInputV1 & {
  readonly feasibilityEvidenceContext: ProviderRuntimeFeasibilityEvidenceSourceContextV1;
  readonly registryEvidenceBindingContext: ProviderRuntimeRegistryEvidenceBindingContextV1;
  readonly supportCatalogContext: ProviderRuntimeFeasibilitySupportCatalogContextV1;
  readonly serviceReadiness?: ProviderServiceHandoffInspectionV1;
};

export type ProviderRuntimeGateCandidateDiagnosticV1 =
  | {
      readonly ok: true;
      readonly value: ProviderRuntimeProviderGateProjectionValueV1;
    }
  | {
      readonly ok: false;
      readonly code: "provider_unavailable";
      readonly reason: "attestation_invalid";
      readonly stage: ProviderRuntimeGateCandidateStageV1;
    };

export interface ProviderRuntimeGateCandidateValuesV1 {
  readonly conformance: ProviderRuntimeRealFilesystemConformanceResultAdapterValueV1;
  readonly evidence: ProviderRuntimeFeasibilityEvidenceAdapterValueV1;
  readonly registry: ProviderRuntimeRegistryEvidenceBindingAdapterValueV1;
  readonly catalog: ProviderRuntimeFeasibilitySupportCatalogAdapterValueV1;
}

export type RunProviderRuntimeLiveGateCandidateOptionsV1 =
  Omit<RunProviderRuntimeGateCandidateOptionsV1, "serviceReadiness"> &
  Omit<ProviderRuntimeLiveGateBindingOptionsV1, "gateValues" | "values" | "projectionInput">;

export type ProviderRuntimeLiveGateCandidateDiagnosticV1 =
  | { readonly ok: true; readonly value: ProviderRuntimeLiveGateActivationCandidateV1 }
  | {
      readonly ok: false;
      readonly code: "provider_unavailable";
      readonly reason: "attestation_invalid";
      readonly stage: ProviderRuntimeGateCandidateStageV1;
    };

export type RunProviderRuntimeDurableAcceptanceCandidateOptionsV1 =
  RunProviderRuntimeLiveGateCandidateOptionsV1;

export type ProviderRuntimeDurableAcceptanceCandidateDiagnosticV1 =
  | {
      readonly ok: true;
      readonly value: ProviderRuntimeDurableAcceptanceCurrentCandidateV1;
    }
  | {
      readonly ok: false;
      readonly code: "provider_unavailable";
      readonly reason: "attestation_invalid";
      readonly stage: ProviderRuntimeGateCandidateStageV1;
    };

export type RunProviderRuntimePrincipalAcceptanceCandidateOptionsV1 =
  RunProviderRuntimeDurableAcceptanceCandidateOptionsV1;

export interface ProviderRuntimePrincipalAcceptanceCandidateV1 {
  readonly status: "principal_key_and_durable_acceptance_candidate";
  readonly authority: "none";
  readonly accessMode: "read_only";
  readonly strongWriteStatus: "locked";
  readonly requiredNext: "kernel_os_peer_and_acceptance_token_gate";
  readonly durableAcceptance: ProviderRuntimeDurableAcceptanceCurrentCandidateV1;
  readonly principalKey: ProviderRuntimePrincipalKeyLiveCandidateV1;
}

export type ProviderRuntimePrincipalAcceptanceCandidateDiagnosticV1 =
  | {
      readonly ok: true;
      readonly value: ProviderRuntimePrincipalAcceptanceCandidateV1;
    }
  | {
      readonly ok: false;
      readonly code: "provider_unavailable";
      readonly reason: "attestation_invalid";
      readonly stage: ProviderRuntimeGateCandidateStageV1;
    };

function unavailableV1(
  stage: ProviderRuntimeGateCandidateStageV1,
): ProviderRuntimeGateCandidateDiagnosticV1 {
  return {
    ok: false,
    code: "provider_unavailable",
    reason: "attestation_invalid",
    stage,
  };
}

function unavailableLiveV1(
  stage: ProviderRuntimeGateCandidateStageV1,
): ProviderRuntimeLiveGateCandidateDiagnosticV1 {
  return {
    ok: false,
    code: "provider_unavailable",
    reason: "attestation_invalid",
    stage,
  };
}

function unavailableDurableV1(
  stage: ProviderRuntimeGateCandidateStageV1,
): ProviderRuntimeDurableAcceptanceCandidateDiagnosticV1 {
  return {
    ok: false,
    code: "provider_unavailable",
    reason: "attestation_invalid",
    stage,
  };
}

function unavailablePrincipalV1(
  stage: ProviderRuntimeGateCandidateStageV1,
): ProviderRuntimePrincipalAcceptanceCandidateDiagnosticV1 {
  return {
    ok: false,
    code: "provider_unavailable",
    reason: "attestation_invalid",
    stage,
  };
}

async function runConformanceResultStageV1(
  options: AdaptProviderRuntimeRealFilesystemConformanceResultOptionsV1,
): Promise<ProviderRuntimeRealFilesystemConformanceResultAdapterValueV1 | undefined> {
  const diagnostic = await adaptProviderRuntimeRealFilesystemConformanceResultV1(
    options,
  ).then(
    (value) => ({ ok: true as const, value }),
    () => ({ ok: false as const }),
  );
  return diagnostic.ok ? diagnostic.value : undefined;
}

async function runFeasibilityEvidenceStageV1(
  options: AdaptProviderRuntimeFeasibilityEvidenceOptionsV1,
): Promise<ProviderRuntimeFeasibilityEvidenceAdapterValueV1 | undefined> {
  const diagnostic = await adaptProviderRuntimeFeasibilityEvidenceV1(options).then(
    (value) => ({ ok: true as const, value }),
    () => ({ ok: false as const }),
  );
  return diagnostic.ok ? diagnostic.value : undefined;
}

async function runRegistryStageV1(
  options: AdaptProviderRuntimeRegistryEvidenceBindingOptionsV1,
): Promise<ProviderRuntimeRegistryEvidenceBindingAdapterValueV1 | undefined> {
  const diagnostic = await adaptProviderRuntimeRegistryEvidenceBindingV1(options).then(
    (value) => ({ ok: true as const, value }),
    () => ({ ok: false as const }),
  );
  return diagnostic.ok ? diagnostic.value : undefined;
}

async function runSupportCatalogStageV1(
  options: AdaptProviderRuntimeFeasibilitySupportCatalogOptionsV1,
): Promise<ProviderRuntimeFeasibilitySupportCatalogAdapterValueV1 | undefined> {
  const diagnostic = await adaptProviderRuntimeFeasibilitySupportCatalogV1(options).then(
    (value) => ({ ok: true as const, value }),
    () => ({ ok: false as const }),
  );
  return diagnostic.ok ? diagnostic.value : undefined;
}

async function collectGateCandidateValuesV1(
  options: RunProviderRuntimeGateCandidateOptionsV1,
): Promise<
  | { readonly ok: true; readonly values: ProviderRuntimeGateCandidateValuesV1 }
  | { readonly ok: false; readonly stage: ProviderRuntimeGateCandidateStageV1 }
> {
  const conformanceResult =
    "validatedConformanceResult" in options
      ? options.validatedConformanceResult
      : await runConformanceResultStageV1(options.conformanceResult);
  if (conformanceResult === undefined) {
    return { ok: false, stage: "conformance_result" };
  }

  const feasibilityEvidence = await runFeasibilityEvidenceStageV1({
    conformanceResult: {
      envelope: conformanceResult.envelope,
      locator: conformanceResult.locator,
      pin: conformanceResult.pin,
      closure: conformanceResult.closure,
    },
    context: options.feasibilityEvidenceContext,
  });
  if (feasibilityEvidence === undefined) {
    return { ok: false, stage: "feasibility_evidence" };
  }

  const registryBinding = await runRegistryStageV1({
    feasibilityEvidence: {
      evidence: feasibilityEvidence.evidence,
      pin: feasibilityEvidence.pin,
      closure: feasibilityEvidence.closure,
    } satisfies ProviderRuntimeValidatedFeasibilityEvidenceV1,
    context: options.registryEvidenceBindingContext,
  });
  if (registryBinding === undefined) {
    return { ok: false, stage: "registry_evidence_binding" };
  }

  const supportCatalog = await runSupportCatalogStageV1({
    context: {
      ...options.supportCatalogContext,
      validatedClosure: options.supportCatalogContext.validatedClosure,
    },
  });
  if (supportCatalog === undefined) {
    return { ok: false, stage: "support_catalog" };
  }

  return {
    ok: true,
    values: {
      conformance: conformanceResult,
      evidence: feasibilityEvidence,
      registry: registryBinding,
      catalog: supportCatalog,
    },
  };
}

export async function diagnoseProviderRuntimeGateCandidateV1(
  options: RunProviderRuntimeGateCandidateOptionsV1,
): Promise<ProviderRuntimeGateCandidateDiagnosticV1> {
  try {
    const collected = await collectGateCandidateValuesV1(options);
    if (!collected.ok) return unavailableV1(collected.stage);
    const { conformance, evidence, registry, catalog } = collected.values;

    const projection = projectProviderRuntimeProviderGateV1({
      conformance,
      evidence,
      registry,
      catalog,
      serviceReadiness: options.serviceReadiness,
    });
    return { ok: true, value: projection };
  } catch {
    return unavailableV1("gate_projection");
  }
}

export async function runProviderRuntimeGateCandidateV1(
  options: RunProviderRuntimeGateCandidateOptionsV1,
): Promise<ProviderRuntimeGateCandidateDiagnosticV1> {
  return diagnoseProviderRuntimeGateCandidateV1(options);
}

/**
 * Run the complete structure-only Gate chain and immediately re-probe the
 * signed live service against the same values.  The returned activation
 * candidate remains read-only/locked; current Acceptance and OS-peer proof
 * are intentionally a later gate.
 */
export async function diagnoseProviderRuntimeLiveGateCandidateV1(
  options: RunProviderRuntimeLiveGateCandidateOptionsV1,
): Promise<ProviderRuntimeLiveGateCandidateDiagnosticV1> {
  try {
    const {
      config,
      liveReadiness,
      targetBaseline,
      authKey,
      timeoutMs,
      readinessReader,
      expectedInstallationIdentityDigest,
      expectedBinaryDigest,
      expectedCapabilityDigest,
      expectedTargetFingerprintDigest,
      untrustedProjection,
      projection,
      gateProjection,
      conformanceBindings,
      candidateBindings,
      ...candidateOptions
    } = options;
    const collected = await collectGateCandidateValuesV1(
      candidateOptions as RunProviderRuntimeGateCandidateOptionsV1,
    );
    if (!collected.ok) return unavailableLiveV1(collected.stage);
    const liveDiagnostic = await diagnoseProviderRuntimeLiveGateBindingV1({
      config,
      liveReadiness,
      targetBaseline,
      authKey,
      timeoutMs,
      readinessReader,
      expectedInstallationIdentityDigest,
      expectedBinaryDigest,
      expectedCapabilityDigest,
      expectedTargetFingerprintDigest,
      gateValues: collected.values,
      untrustedProjection,
      projection,
      gateProjection,
      conformanceBindings,
      candidateBindings,
    });
    if (!liveDiagnostic.ok) return unavailableLiveV1("live_gate_binding");
    return { ok: true, value: liveDiagnostic.value };
  } catch {
    return unavailableLiveV1("live_gate_binding");
  }
}

export async function runProviderRuntimeLiveGateCandidateV1(
  options: RunProviderRuntimeLiveGateCandidateOptionsV1,
): Promise<ProviderRuntimeLiveGateCandidateDiagnosticV1> {
  return diagnoseProviderRuntimeLiveGateCandidateV1(options);
}

/**
 * Compose the complete raw Gate adapters with a fresh live probe and the
 * destination provider's authenticated durable final-Acceptance journal.
 * This remains a locked candidate until the keyed Acceptance token and OS
 * peer identity are independently verified.
 */
export async function diagnoseProviderRuntimeDurableAcceptanceCandidateV1(
  options: RunProviderRuntimeDurableAcceptanceCandidateOptionsV1,
): Promise<ProviderRuntimeDurableAcceptanceCandidateDiagnosticV1> {
  try {
    const {
      config,
      liveReadiness,
      targetBaseline,
      authKey,
      timeoutMs,
      readinessReader,
      expectedInstallationIdentityDigest,
      expectedBinaryDigest,
      expectedCapabilityDigest,
      expectedTargetFingerprintDigest,
      untrustedProjection,
      projection,
      gateProjection,
      conformanceBindings,
      candidateBindings,
      ...candidateOptions
    } = options;
    const collected = await collectGateCandidateValuesV1(
      candidateOptions as RunProviderRuntimeGateCandidateOptionsV1,
    );
    if (!collected.ok) return unavailableDurableV1(collected.stage);
    const current = await diagnoseProviderRuntimeDurableAcceptanceCurrentV1({
      liveGateBinding: {
        config,
        liveReadiness,
        targetBaseline,
        authKey,
        timeoutMs,
        readinessReader,
        expectedInstallationIdentityDigest,
        expectedBinaryDigest,
        expectedCapabilityDigest,
        expectedTargetFingerprintDigest,
        gateValues: collected.values,
        untrustedProjection,
        projection,
        gateProjection,
        conformanceBindings,
        candidateBindings,
      },
    });
    if (!current.ok) return unavailableDurableV1("durable_acceptance_current");
    return current;
  } catch {
    return unavailableDurableV1("durable_acceptance_current");
  }
}

export async function runProviderRuntimeDurableAcceptanceCandidateV1(
  options: RunProviderRuntimeDurableAcceptanceCandidateOptionsV1,
): Promise<ProviderRuntimeDurableAcceptanceCandidateDiagnosticV1> {
  return diagnoseProviderRuntimeDurableAcceptanceCandidateV1(options);
}

/**
 * Join the durable Acceptance-current observation to a fresh Ed25519
 * challenge answered by the configured service key.  This removes the need
 * to read the principal-owned HMAC key, but deliberately does not equate key
 * possession with kernel peer identity or verify the keyed Acceptance token.
 */
export async function diagnoseProviderRuntimePrincipalAcceptanceCandidateV1(
  options: RunProviderRuntimePrincipalAcceptanceCandidateOptionsV1,
): Promise<ProviderRuntimePrincipalAcceptanceCandidateDiagnosticV1> {
  const durable = await diagnoseProviderRuntimeDurableAcceptanceCandidateV1(
    options,
  );
  if (!durable.ok) return unavailablePrincipalV1(durable.stage);
  const principal = await verifyProviderRuntimeLivePrincipalChallengeV1({
    config: options.config,
    expectedJournalRevision: durable.value.bindings.journalRevision,
    expectedJournalPhase: "final_strong_ready",
    expectedJournalMutationDigest:
      durable.value.bindings.journalMutationDigest,
    expectedInstallationIdentityDigest:
      options.expectedInstallationIdentityDigest,
    timeoutMs: options.timeoutMs,
  });
  if (
    principal.status !== "principal_key_live_candidate" ||
    principal.bindings.providerId !== durable.value.bindings.providerId ||
    principal.bindings.capabilityDigest !== options.expectedCapabilityDigest ||
    principal.bindings.journalRevision !==
      durable.value.bindings.journalRevision ||
    principal.bindings.journalPhase !== "final_strong_ready" ||
    principal.bindings.journalMutationDigest !==
      durable.value.bindings.journalMutationDigest
  ) {
    return unavailablePrincipalV1("principal_key_live");
  }
  return {
    ok: true,
    value: Object.freeze({
      status: "principal_key_and_durable_acceptance_candidate" as const,
      authority: "none" as const,
      accessMode: "read_only" as const,
      strongWriteStatus: "locked" as const,
      requiredNext: "kernel_os_peer_and_acceptance_token_gate" as const,
      durableAcceptance: durable.value,
      principalKey: principal,
    }),
  };
}

export async function runProviderRuntimePrincipalAcceptanceCandidateV1(
  options: RunProviderRuntimePrincipalAcceptanceCandidateOptionsV1,
): Promise<ProviderRuntimePrincipalAcceptanceCandidateDiagnosticV1> {
  return diagnoseProviderRuntimePrincipalAcceptanceCandidateV1(options);
}
