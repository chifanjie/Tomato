import { describe, expect, it, vi } from "vitest";

const stageMocks = vi.hoisted(() => ({
  conformance: vi.fn(),
  evidence: vi.fn(),
  registry: vi.fn(),
  catalog: vi.fn(),
}));

vi.mock("../src/conformance-result-adapter.js", () => ({
  adaptProviderRuntimeRealFilesystemConformanceResultV1: stageMocks.conformance,
}));
vi.mock("../src/feasibility-evidence-adapter.js", () => ({
  adaptProviderRuntimeFeasibilityEvidenceV1: stageMocks.evidence,
}));
vi.mock("../src/registry-evidence-binding-adapter.js", () => ({
  adaptProviderRuntimeRegistryEvidenceBindingV1: stageMocks.registry,
}));
vi.mock("../src/feasibility-support-catalog-adapter.js", () => ({
  adaptProviderRuntimeFeasibilitySupportCatalogV1: stageMocks.catalog,
}));

import { runProviderRuntimeGateCandidateV1 } from "../src/gate-candidate-runtime.js";

const providerId = "durable-object-provider:local-helper";
const targetProfileId = "provider-target-profile:target";
const resultId = "provider-real-fs-result:result";
const resultDigest = `sha256:${"1".repeat(64)}`;
const evidenceId = "provider-feasibility-evidence:evidence";
const evidenceDigest = `sha256:${"2".repeat(64)}`;
const catalogDigest = `sha256:${"3".repeat(64)}`;

function stageValuesV1() {
  const conformance = {
    envelope: {
      resultId,
      contentDigest: resultDigest,
      payload: { providerId, target: { targetProfileId } },
    },
    locator: { resultId },
    pin: { resultId, contentDigest: resultDigest },
    closure: { authority: "none_real_fs_conformance_result_structure_only" },
  } as any;
  const evidence = {
    evidence: {
      evidenceId,
      contentDigest: evidenceDigest,
      payload: {
        providerId,
        realFilesystemConformanceResult: { resultId, contentDigest: resultDigest },
        realFilesystemConformanceResultDigest: resultDigest,
      },
    },
    pin: { evidenceId, contentDigest: evidenceDigest },
    closure: { authority: "none_provider_feasibility_evidence_structure_only" },
  } as any;
  const registry = {
    authority: "none_registry_entry_evidence_binding_structure_only",
    accessMode: "read_only",
    strongWriteStatus: "locked",
    closure: {
      candidateRegistryEntry: { providerId },
      providerFeasibilityEvidence: evidence.evidence,
      providerFeasibilityEvidencePin: evidence.pin,
    },
  } as any;
  const catalog = {
    authority: "none_provider_feasibility_support_catalog_structure_only",
    accessMode: "read_only",
    strongWriteStatus: "locked",
    closure: {
      targetCount: 1,
      candidateCount: 1,
      candidateDeepClosures: [{
        catalogTarget: { targetProfileId },
        evidencePointClosure: {
          providerFeasibilityEvidence: { evidenceId },
        },
      }],
      providerFeasibilitySupportCatalogPin: { contentDigest: catalogDigest },
    },
  } as any;
  return { conformance, evidence, registry, catalog };
}

function installSuccessfulStagesV1() {
  const values = stageValuesV1();
  stageMocks.conformance.mockResolvedValue(values.conformance);
  stageMocks.evidence.mockResolvedValue(values.evidence);
  stageMocks.registry.mockResolvedValue(values.registry);
  stageMocks.catalog.mockResolvedValue(values.catalog);
  return values;
}

describe("runtime Gate candidate composition", () => {
  it("runs the strict stages and returns a locked structure-only candidate", async () => {
    const values = installSuccessfulStagesV1();
    const diagnostic = await runProviderRuntimeGateCandidateV1({
      conformanceResult: {} as never,
      feasibilityEvidenceContext: {} as never,
      registryEvidenceBindingContext: {} as never,
      supportCatalogContext: {} as never,
      serviceReadiness: {
        providerId,
        status: "signed_candidate",
        authority: "read_only",
        strongWrites: "locked",
      } as never,
    });

    expect(diagnostic).toEqual({
      ok: true,
      value: expect.objectContaining({
        status: "candidate_ready",
        authority: "none",
        accessMode: "read_only",
        strongWriteStatus: "locked",
        requiredNext: "signed_registry_qa_release_os_principal_gate",
      }),
    });
    expect(stageMocks.conformance).toHaveBeenCalledTimes(1);
    expect(stageMocks.evidence).toHaveBeenCalledWith(expect.objectContaining({
      conformanceResult: expect.objectContaining({ envelope: values.conformance.envelope }),
    }));
    expect(stageMocks.registry).toHaveBeenCalledTimes(1);
    expect(stageMocks.catalog).toHaveBeenCalledTimes(1);
  });

  it("returns an opaque support-catalog stage failure", async () => {
    installSuccessfulStagesV1();
    stageMocks.catalog.mockRejectedValueOnce(new Error("catalog unavailable"));
    const diagnostic = await runProviderRuntimeGateCandidateV1({
      conformanceResult: {} as never,
      feasibilityEvidenceContext: {} as never,
      registryEvidenceBindingContext: {} as never,
      supportCatalogContext: {} as never,
    });
    expect(diagnostic).toEqual({
      ok: false,
      code: "provider_unavailable",
      reason: "attestation_invalid",
      stage: "support_catalog",
    });
  });
});
