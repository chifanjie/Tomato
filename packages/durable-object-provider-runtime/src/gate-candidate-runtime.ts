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

export type ProviderRuntimeGateCandidateStageV1 =
  | "conformance_result"
  | "feasibility_evidence"
  | "registry_evidence_binding"
  | "support_catalog"
  | "gate_projection";

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

export async function diagnoseProviderRuntimeGateCandidateV1(
  options: RunProviderRuntimeGateCandidateOptionsV1,
): Promise<ProviderRuntimeGateCandidateDiagnosticV1> {
  try {
    const conformanceResult =
      "validatedConformanceResult" in options
        ? options.validatedConformanceResult
        : await runConformanceResultStageV1(options.conformanceResult);
    if (conformanceResult === undefined) return unavailableV1("conformance_result");

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
      return unavailableV1("feasibility_evidence");
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
      return unavailableV1("registry_evidence_binding");
    }

    const supportCatalog = await runSupportCatalogStageV1({
      context: {
        ...options.supportCatalogContext,
        validatedClosure: options.supportCatalogContext.validatedClosure,
      },
    });
    if (supportCatalog === undefined) return unavailableV1("support_catalog");

    const projection = projectProviderRuntimeProviderGateV1({
      conformance: conformanceResult,
      evidence: feasibilityEvidence,
      registry: registryBinding,
      catalog: supportCatalog,
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
