import { describe, expect, it, vi } from "vitest";

const stageMocks = vi.hoisted(() => ({
  conformance: vi.fn(),
  evidence: vi.fn(),
  registry: vi.fn(),
  catalog: vi.fn(),
  liveGate: vi.fn(),
  acceptanceIdentity: vi.fn(),
  principalKey: vi.fn(),
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
vi.mock("../src/live-gate-binding.js", () => ({
  diagnoseProviderRuntimeLiveGateBindingV1: stageMocks.liveGate,
}));
vi.mock("../src/acceptance-identity-token-current.js", () => ({
  diagnoseProviderRuntimeAcceptanceIdentityTokenCurrentV1:
    stageMocks.acceptanceIdentity,
}));
vi.mock("../src/live-principal-challenge.js", () => ({
  verifyProviderRuntimeLivePrincipalChallengeV1: stageMocks.principalKey,
}));

import {
  runProviderRuntimeGateCandidateV1,
  runProviderRuntimeIdentityPrincipalAcceptanceCandidateV1,
  runProviderRuntimeLiveGateCandidateV1,
} from "../src/gate-candidate-runtime.js";
import { ContentDigestV1Schema } from "@understand-code/durable-object-provider-contracts/primitives";

const providerId = "durable-object-provider:local-helper";
const targetProfileId = "provider-target-profile:target";
const resultId = "provider-real-fs-result:result";
const resultDigest = `sha256:${"1".repeat(64)}`;
const evidenceId = "provider-feasibility-evidence:evidence";
const evidenceDigest = `sha256:${"2".repeat(64)}`;
const catalogDigest = `sha256:${"3".repeat(64)}`;
const digestV1 = (hex: string) => ContentDigestV1Schema.parse(`sha256:${hex.repeat(64)}`);

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

  it("runs live binding only after all structure stages succeed", async () => {
    const values = installSuccessfulStagesV1();
    stageMocks.liveGate.mockResolvedValueOnce({
      ok: true,
      value: {
        status: "live_activation_candidate",
        authority: "none",
        accessMode: "read_only",
        strongWriteStatus: "locked",
        requiredNext: "provider_acceptance_current_and_os_peer_gate",
        bindings: { providerId },
      },
    });
    const diagnostic = await runProviderRuntimeLiveGateCandidateV1({
      conformanceResult: {} as never,
      feasibilityEvidenceContext: {} as never,
      registryEvidenceBindingContext: {} as never,
      supportCatalogContext: {} as never,
      config: {} as never,
      targetBaseline: {} as never,
      expectedInstallationIdentityDigest: digestV1("4"),
      expectedBinaryDigest: digestV1("5"),
      expectedCapabilityDigest: digestV1("6"),
      expectedTargetFingerprintDigest: digestV1("7"),
    });
    expect(diagnostic).toMatchObject({ ok: true, value: { status: "live_activation_candidate" } });
    expect(stageMocks.liveGate).toHaveBeenCalledWith(expect.objectContaining({
      gateValues: values,
    }));
  });

  it("keeps a live binding failure opaque", async () => {
    installSuccessfulStagesV1();
    stageMocks.liveGate.mockResolvedValueOnce({
      ok: false,
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });
    const diagnostic = await runProviderRuntimeLiveGateCandidateV1({
      conformanceResult: {} as never,
      feasibilityEvidenceContext: {} as never,
      registryEvidenceBindingContext: {} as never,
      supportCatalogContext: {} as never,
      config: {} as never,
      targetBaseline: {} as never,
      expectedInstallationIdentityDigest: digestV1("4"),
      expectedBinaryDigest: digestV1("5"),
      expectedCapabilityDigest: digestV1("6"),
      expectedTargetFingerprintDigest: digestV1("7"),
    });
    expect(diagnostic).toEqual({
      ok: false,
      code: "provider_unavailable",
      reason: "attestation_invalid",
      stage: "live_gate_binding",
    });
  });

  it("joins the Installation Identity token and live principal at one durable head", async () => {
    installSuccessfulStagesV1();
    const capabilityDigest = digestV1("6");
    const journalMutationDigest = digestV1("8");
    stageMocks.acceptanceIdentity.mockResolvedValueOnce({
      ok: true,
      value: {
        status: "acceptance_identity_token_current_candidate",
        authority: "none",
        accessMode: "read_only",
        strongWriteStatus: "locked",
        acceptanceTokenStatus:
          "verified_with_installation_identity_capability",
        requiredNext: "kernel_os_peer_gate",
        bindings: {
          providerId,
          journalRevision: 7,
          journalMutationDigest,
        },
      },
    });
    stageMocks.principalKey.mockResolvedValueOnce({
      status: "principal_key_live_candidate",
      authority: "none",
      accessMode: "read_only",
      strongWriteStatus: "locked",
      bindings: {
        providerId,
        capabilityDigest,
        journalRevision: 7,
        journalPhase: "final_strong_ready",
        journalMutationDigest,
      },
    });

    await expect(
      runProviderRuntimeIdentityPrincipalAcceptanceCandidateV1({
        conformanceResult: {} as never,
        feasibilityEvidenceContext: {} as never,
        registryEvidenceBindingContext: {} as never,
        supportCatalogContext: {} as never,
        config: {} as never,
        targetBaseline: {} as never,
        authKey: new Uint8Array(32),
        identityVerificationCapability: Object.freeze({}) as never,
        expectedInstallationIdentityDigest: digestV1("4"),
        expectedBinaryDigest: digestV1("5"),
        expectedCapabilityDigest: capabilityDigest,
        expectedTargetFingerprintDigest: digestV1("7"),
      }),
    ).resolves.toMatchObject({
      ok: true,
      value: {
        status:
          "identity_token_principal_and_durable_acceptance_candidate",
        authority: "none",
        strongWriteStatus: "locked",
        requiredNext: "kernel_os_peer_gate",
      },
    });
  });

  it("fails closed when the principal answers for a different journal head", async () => {
    installSuccessfulStagesV1();
    const capabilityDigest = digestV1("6");
    stageMocks.acceptanceIdentity.mockResolvedValueOnce({
      ok: true,
      value: {
        bindings: {
          providerId,
          journalRevision: 7,
          journalMutationDigest: digestV1("8"),
        },
      },
    });
    stageMocks.principalKey.mockResolvedValueOnce({
      status: "principal_key_live_candidate",
      bindings: {
        providerId,
        capabilityDigest,
        journalRevision: 8,
        journalPhase: "final_strong_ready",
        journalMutationDigest: digestV1("9"),
      },
    });

    await expect(
      runProviderRuntimeIdentityPrincipalAcceptanceCandidateV1({
        conformanceResult: {} as never,
        feasibilityEvidenceContext: {} as never,
        registryEvidenceBindingContext: {} as never,
        supportCatalogContext: {} as never,
        config: {} as never,
        targetBaseline: {} as never,
        authKey: new Uint8Array(32),
        identityVerificationCapability: Object.freeze({}) as never,
        expectedInstallationIdentityDigest: digestV1("4"),
        expectedBinaryDigest: digestV1("5"),
        expectedCapabilityDigest: capabilityDigest,
        expectedTargetFingerprintDigest: digestV1("7"),
      }),
    ).resolves.toEqual({
      ok: false,
      code: "provider_unavailable",
      reason: "attestation_invalid",
      stage: "principal_key_live",
    });
  });
});
