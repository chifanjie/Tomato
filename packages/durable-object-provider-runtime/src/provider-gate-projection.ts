import type { ProviderServiceHandoffInspectionV1 } from "./service-handoff.js";
import type {
  ProviderRuntimeRealFilesystemConformanceResultAdapterValueV1,
} from "./conformance-result-adapter.js";
import type {
  ProviderRuntimeFeasibilityEvidenceAdapterValueV1,
} from "./feasibility-evidence-adapter.js";
import type {
  ProviderRuntimeRegistryEvidenceBindingAdapterValueV1,
} from "./registry-evidence-binding-adapter.js";
import type {
  ProviderRuntimeFeasibilitySupportCatalogAdapterValueV1,
} from "./feasibility-support-catalog-adapter.js";
import { canonicalizeJcsSafeIntegerV1 } from "@understand-code/durable-object-provider-contracts/jcs";

export type ProviderRuntimeProviderGateProjectionBlockerV1 =
  | "service_readiness_missing"
  | "service_readiness_unavailable"
  | "authority_not_structure_only"
  | "strong_write_not_locked"
  | "provider_identity_mismatch"
  | "conformance_binding_mismatch"
  | "evidence_binding_mismatch"
  | "registry_binding_mismatch"
  | "catalog_binding_mismatch"
  | "catalog_empty";

export interface ProviderRuntimeProviderGateProjectionInputV1 {
  readonly conformance: ProviderRuntimeRealFilesystemConformanceResultAdapterValueV1;
  readonly evidence: ProviderRuntimeFeasibilityEvidenceAdapterValueV1;
  readonly registry: ProviderRuntimeRegistryEvidenceBindingAdapterValueV1;
  readonly catalog: ProviderRuntimeFeasibilitySupportCatalogAdapterValueV1;
  readonly serviceReadiness?: ProviderServiceHandoffInspectionV1;
}

export interface ProviderRuntimeProviderGateProjectionValueV1 {
  readonly status: "candidate_ready" | "blocked";
  readonly authority: "none";
  readonly accessMode: "read_only";
  readonly strongWriteStatus: "locked";
  readonly requiredNext:
    | "signed_registry_qa_release_os_principal_gate"
    | "none_structure_only_candidate";
  readonly blockers: readonly ProviderRuntimeProviderGateProjectionBlockerV1[];
  readonly bindings: Readonly<{
    readonly providerId: string;
    readonly targetProfileId: string;
    readonly conformanceResultId: string;
    readonly conformanceContentDigest: string;
    readonly evidenceId: string;
    readonly evidenceContentDigest: string;
    readonly catalogContentDigest: string;
  }>;
}

export type ProviderRuntimeProviderGateProjectionDiagnosticV1 =
  | { readonly ok: true; readonly value: ProviderRuntimeProviderGateProjectionValueV1 }
  | { readonly ok: false; readonly code: "provider_unavailable"; readonly reason: "attestation_invalid" };

export class ProviderRuntimeProviderGateProjectionErrorV1 extends Error {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super("Provider runtime Gate projection rejected input");
    this.name = "ProviderRuntimeProviderGateProjectionErrorV1";
  }
}

function sameV1(left: unknown, right: unknown): boolean {
  return canonicalizeJcsSafeIntegerV1(left) === canonicalizeJcsSafeIntegerV1(right);
}

function pushUniqueV1(
  blockers: ProviderRuntimeProviderGateProjectionBlockerV1[],
  blocker: ProviderRuntimeProviderGateProjectionBlockerV1,
): void {
  if (!blockers.includes(blocker)) blockers.push(blocker);
}

function validateInputV1(input: ProviderRuntimeProviderGateProjectionInputV1):
  ProviderRuntimeProviderGateProjectionValueV1 {
  const blockers: ProviderRuntimeProviderGateProjectionBlockerV1[] = [];
  const conformancePayload = input.conformance.envelope.payload;
  const evidencePayload = input.evidence.evidence.payload;
  const registryClosure = input.registry.closure;
  const catalogClosure = input.catalog.closure;

  if (input.conformance.closure.authority !== "none_real_fs_conformance_result_structure_only" ||
      input.evidence.closure.authority !== "none_provider_feasibility_evidence_structure_only" ||
      input.registry.authority !== "none_registry_entry_evidence_binding_structure_only" ||
      input.catalog.authority !== "none_provider_feasibility_support_catalog_structure_only") {
    pushUniqueV1(blockers, "authority_not_structure_only");
  }
  for (const value of [input.registry, input.catalog]) {
    if (value.accessMode !== "read_only") pushUniqueV1(blockers, "strong_write_not_locked");
    if (value.strongWriteStatus !== "locked") pushUniqueV1(blockers, "strong_write_not_locked");
  }

  const providerId = conformancePayload.providerId;
  const targetProfileId = conformancePayload.target.targetProfileId;
  if (evidencePayload.providerId !== providerId ||
      registryClosure.candidateRegistryEntry.providerId !== providerId) {
    pushUniqueV1(blockers, "provider_identity_mismatch");
  }
  if (evidencePayload.realFilesystemConformanceResult.resultId !== input.conformance.pin.resultId ||
      evidencePayload.realFilesystemConformanceResult.contentDigest !== input.conformance.pin.contentDigest ||
      evidencePayload.realFilesystemConformanceResultDigest !== input.conformance.envelope.contentDigest) {
    pushUniqueV1(blockers, "conformance_binding_mismatch");
  }
  if (!sameV1(registryClosure.providerFeasibilityEvidence, input.evidence.evidence) ||
      !sameV1(registryClosure.providerFeasibilityEvidencePin, input.evidence.pin)) {
    pushUniqueV1(blockers, "registry_binding_mismatch");
  }
  const catalogCandidates = catalogClosure.candidateDeepClosures;
  if (catalogClosure.targetCount < 1 || catalogClosure.candidateCount < 1 || catalogCandidates.length < 1) {
    pushUniqueV1(blockers, "catalog_empty");
  }
  if (catalogCandidates.length > 0 && catalogCandidates.some((candidate) =>
    candidate.evidencePointClosure.providerFeasibilityEvidence.evidenceId !== input.evidence.evidence.evidenceId ||
    candidate.catalogTarget.targetProfileId !== targetProfileId)) {
    pushUniqueV1(blockers, "catalog_binding_mismatch");
  }
  if (input.serviceReadiness === undefined) {
    pushUniqueV1(blockers, "service_readiness_missing");
  } else if (input.serviceReadiness.status !== "signed_candidate" ||
      input.serviceReadiness.authority !== "read_only" ||
      input.serviceReadiness.strongWrites !== "locked") {
    pushUniqueV1(blockers, "service_readiness_unavailable");
  }

  const status = blockers.length === 0 ? "candidate_ready" : "blocked";
  return Object.freeze({
    status,
    authority: "none" as const,
    accessMode: "read_only" as const,
    strongWriteStatus: "locked" as const,
    requiredNext: status === "candidate_ready"
      ? "signed_registry_qa_release_os_principal_gate" as const
      : "none_structure_only_candidate" as const,
    blockers: Object.freeze(blockers),
    bindings: Object.freeze({
      providerId,
      targetProfileId,
      conformanceResultId: input.conformance.pin.resultId,
      conformanceContentDigest: input.conformance.pin.contentDigest,
      evidenceId: input.evidence.pin.evidenceId,
      evidenceContentDigest: input.evidence.pin.contentDigest,
      catalogContentDigest: catalogClosure.providerFeasibilitySupportCatalogPin.contentDigest,
    }),
  });
}

export function diagnoseProviderRuntimeProviderGateProjectionV1(
  input: ProviderRuntimeProviderGateProjectionInputV1,
): ProviderRuntimeProviderGateProjectionDiagnosticV1 {
  try {
    return { ok: true, value: validateInputV1(input) };
  } catch {
    return { ok: false, code: "provider_unavailable", reason: "attestation_invalid" };
  }
}

export function projectProviderRuntimeProviderGateV1(
  input: ProviderRuntimeProviderGateProjectionInputV1,
): ProviderRuntimeProviderGateProjectionValueV1 {
  const diagnostic = diagnoseProviderRuntimeProviderGateProjectionV1(input);
  if (!diagnostic.ok) throw new ProviderRuntimeProviderGateProjectionErrorV1();
  return diagnostic.value;
}
