import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

const liveVerifier = vi.hoisted(() => vi.fn());
vi.mock("../src/live-service-readiness.js", () => ({
  verifyProviderRuntimeLiveServiceReadinessV1: liveVerifier,
}));

import {
  createProviderServiceHandoffConfigV1,
  type ProviderServiceHandoffConfigV1,
} from "../src/service-handoff.js";
import {
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
} from "@understand-code/durable-object-provider-contracts/primitives";
import {
  diagnoseProviderRuntimeLiveGateBindingV1,
  evaluateProviderRuntimeLiveGateBindingV1,
  type ProviderRuntimeLiveGateBindingGateValuesV1,
} from "../src/live-gate-binding.js";

const providerId = DurableObjectIdentityProviderIdV1Schema.parse(
  "durable-object-provider:local-helper",
);
const targetProfileId = "provider-target-profile:target";
const resultId = "provider-real-fs-result:result";
const resultDigest = ContentDigestV1Schema.parse(`sha256:${"1".repeat(64)}`);
const evidenceId = "provider-feasibility-evidence:evidence";
const evidenceDigest = ContentDigestV1Schema.parse(`sha256:${"2".repeat(64)}`);
const catalogDigest = ContentDigestV1Schema.parse(`sha256:${"3".repeat(64)}`);
const installationDigest = ContentDigestV1Schema.parse(`sha256:${"4".repeat(64)}`);
const binaryDigest = ContentDigestV1Schema.parse(`sha256:${"5".repeat(64)}`);
const capabilityDigest = ContentDigestV1Schema.parse(`sha256:${"6".repeat(64)}`);
const targetFingerprintDigest = ContentDigestV1Schema.parse(`sha256:${"7".repeat(64)}`);

function configV1(): ProviderServiceHandoffConfigV1 {
  const { privateKey } = generateKeyPairSync("ed25519");
  const root = "/tmp/understand-code-live-gate-binding";
  return createProviderServiceHandoffConfigV1({
    privateKey,
    payload: {
      schemaVersion: 1,
      profile: "understand_code_provider_service_handoff_payload_v1",
      platform: "linux",
      serviceLabel: "local-helper",
      providerId,
      principal: { kind: "dedicated_os_principal", name: "uc_provider", uid: 1234, gid: 1234 },
      runtimeRoot: root,
      socketPath: `${root}/runtime.sock`,
      executablePath: `${root}/provider`,
      configPath: `${root}/service.json`,
      authKeyPath: `${root}/auth.key`,
      readinessPath: `${root}/readiness.json`,
      signingKeyPath: `${root}/signing.key`,
      installationIdentityDigest: installationDigest,
      binaryDigest,
      capabilityDigest,
    },
  });
}

function gateValuesV1(): ProviderRuntimeLiveGateBindingGateValuesV1 {
  const conformance = {
    envelope: {
      resultId,
      contentDigest: resultDigest,
      payload: {
        providerId,
        implementationDigest: binaryDigest,
        binaryAttestationDigest: binaryDigest,
        target: { targetProfileId },
      },
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
        implementationDigest: binaryDigest,
        binaryAttestationDigest: binaryDigest,
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
        evidencePointClosure: { providerFeasibilityEvidence: { evidenceId } },
      }],
      providerFeasibilitySupportCatalogPin: { contentDigest: catalogDigest },
    },
  } as any;
  return { conformance, evidence, registry, catalog };
}

function liveV1() {
  return {
    status: "live_candidate" as const,
    authority: "read_only" as const,
    strongWrites: "locked" as const,
    providerId,
    targetFingerprintDigest,
    binaryDigest,
    binaryIdentity: "verified" as const,
    inspectedRevision: 9,
  };
}

function optionsV1() {
  return {
    config: configV1(),
    liveReadiness: liveV1(),
    targetBaseline: {} as never,
    gateValues: gateValuesV1(),
    conformanceBindings: {
      providerId,
      targetFingerprintDigest,
      binaryDigest,
      policyDigest: ContentDigestV1Schema.parse(`sha256:${"8".repeat(64)}`),
      capabilityDigest,
    },
    expectedInstallationIdentityDigest: installationDigest,
    expectedBinaryDigest: binaryDigest,
    expectedCapabilityDigest: capabilityDigest,
    expectedTargetFingerprintDigest: targetFingerprintDigest,
  };
}

describe("runtime live Gate binding", () => {
  it("recomputes the Gate projection and returns a locked activation candidate", async () => {
    liveVerifier.mockResolvedValueOnce(liveV1());
    const diagnostic = await diagnoseProviderRuntimeLiveGateBindingV1(optionsV1());
    expect(diagnostic).toMatchObject({ ok: true });
    if (diagnostic.ok) {
      expect(diagnostic.value).toMatchObject({
        status: "live_activation_candidate",
        authority: "none",
        accessMode: "read_only",
        strongWriteStatus: "locked",
        requiredNext: "provider_acceptance_current_and_os_peer_gate",
        bindings: {
          providerId,
          installationIdentityDigest: installationDigest,
          binaryDigest,
          capabilityDigest,
          targetFingerprintDigest,
          liveStatus: "live_candidate",
        },
      });
    }
  });

  it("rejects a forged projection status and an unavailable live result", async () => {
    const options = optionsV1();
    const projection = {
      status: "blocked",
      authority: "none",
      accessMode: "read_only",
      strongWriteStatus: "locked",
      requiredNext: "none_structure_only_candidate",
      blockers: ["service_readiness_unavailable"],
      bindings: {},
    } as never;
    expect(
      await diagnoseProviderRuntimeLiveGateBindingV1({ ...options, untrustedProjection: projection }),
    ).toEqual({ ok: false, code: "provider_unavailable", reason: "attestation_invalid" });

    liveVerifier.mockResolvedValueOnce({
      status: "unavailable",
      authority: "read_only",
      strongWrites: "locked",
      reason: "readiness_unavailable",
    });
    expect(
      await evaluateProviderRuntimeLiveGateBindingV1({
        ...options,
        liveReadiness: undefined,
      }),
    ).toEqual({
      status: "unavailable",
      authority: "none",
      accessMode: "read_only",
      strongWriteStatus: "locked",
      reason: "attestation_invalid",
    });
  });
});
