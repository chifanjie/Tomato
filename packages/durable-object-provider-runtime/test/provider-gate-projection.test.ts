import { describe, expect, it } from "vitest";

import {
  diagnoseProviderRuntimeProviderGateProjectionV1,
  projectProviderRuntimeProviderGateV1,
  type ProviderRuntimeProviderGateProjectionInputV1,
} from "../src/provider-gate-projection.js";

const providerId = "durable-object-provider:local-helper";
const targetProfileId = "provider-target-profile:target";
const resultId = "provider-real-fs-result:result";
const resultDigest = `sha256:${"1".repeat(64)}`;
const evidenceId = "provider-feasibility-evidence:evidence";
const evidenceDigest = `sha256:${"2".repeat(64)}`;
const catalogDigest = `sha256:${"3".repeat(64)}`;

function inputV1(): ProviderRuntimeProviderGateProjectionInputV1 {
  const conformance = {
    envelope: {
      resultId,
      contentDigest: resultDigest,
      payload: {
        providerId,
        target: { targetProfileId },
      },
    },
    pin: { resultId, contentDigest: resultDigest },
    closure: { authority: "none_real_fs_conformance_result_structure_only", result: { resultId, contentDigest: resultDigest } },
  } as unknown as ProviderRuntimeProviderGateProjectionInputV1["conformance"];
  const evidence = {
    evidence: {
      evidenceId,
      contentDigest: evidenceDigest,
      payload: {
        providerId,
        realFilesystemConformanceResult: { resultId, contentDigest: resultDigest },
        realFilesystemConformanceResultDigest: resultDigest,
        evidenceId,
        contentDigest: evidenceDigest,
      },
    },
    pin: { evidenceId, contentDigest: evidenceDigest },
    closure: {
      authority: "none_provider_feasibility_evidence_structure_only",
      runtimeAttestationPointClosure: {},
      providerFeasibilityEvidence: {},
      providerFeasibilityEvidencePin: {},
      relativePath: "provider/feasibility-evidence/evidence.json",
      qaApproverPublicKey: {},
      releaseApproverPublicKey: {},
    },
  } as unknown as ProviderRuntimeProviderGateProjectionInputV1["evidence"];
  const registry = {
    authority: "none_registry_entry_evidence_binding_structure_only",
    accessMode: "read_only",
    strongWriteStatus: "locked",
    closure: {
      candidateRegistryEntry: { providerId },
      providerFeasibilityEvidence: evidence.evidence,
      providerFeasibilityEvidencePin: evidence.pin,
    },
  } as unknown as ProviderRuntimeProviderGateProjectionInputV1["registry"];
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
  } as unknown as ProviderRuntimeProviderGateProjectionInputV1["catalog"];
  return { conformance, evidence, registry, catalog };
}

describe("runtime Provider Gate projection", () => {
  it("reports a structure-only candidate and requires service readiness", () => {
    const blocked = projectProviderRuntimeProviderGateV1(inputV1());
    expect(blocked.status).toBe("blocked");
    expect(blocked.authority).toBe("none");
    expect(blocked.strongWriteStatus).toBe("locked");
    expect(blocked.blockers).toContain("service_readiness_missing");

    const ready = projectProviderRuntimeProviderGateV1({
      ...inputV1(),
      serviceReadiness: {
        status: "signed_candidate",
        authority: "read_only",
        strongWrites: "locked",
      } as never,
    });
    expect(ready.status).toBe("candidate_ready");
    expect(ready.requiredNext).toBe("signed_registry_qa_release_os_principal_gate");
  });

  it("blocks an identity substitution opaquely", () => {
    const input = inputV1();
    const diagnostic = diagnoseProviderRuntimeProviderGateProjectionV1({
      ...input,
      evidence: {
        ...input.evidence,
        evidence: {
          ...input.evidence.evidence,
          payload: { ...input.evidence.evidence.payload, providerId: "durable-object-provider:other" as never },
        },
      },
      serviceReadiness: { status: "signed_candidate", authority: "read_only", strongWrites: "locked" } as never,
    });
    expect(diagnostic.ok).toBe(true);
    if (diagnostic.ok) expect(diagnostic.value.blockers).toContain("provider_identity_mismatch");
  });
});
