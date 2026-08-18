import { beforeEach, describe, expect, it, vi } from "vitest";

const durableCurrentMock = vi.hoisted(() => vi.fn());
const inspectStateMock = vi.hoisted(() => vi.fn());
const verifyTokenMock = vi.hoisted(() => vi.fn());

vi.mock("../src/durable-acceptance-current.js", () => ({
  diagnoseProviderRuntimeDurableAcceptanceCurrentV1: durableCurrentMock,
}));
vi.mock("../src/live-service-readiness.js", () => ({
  inspectProviderRuntimeAuthenticatedJournalStateV1: inspectStateMock,
}));
vi.mock(
  "@understand-code/durable-object-provider-contracts/provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-closure-reference-candidate",
  () => ({
    verifyProviderStrongReadyAcceptanceEnvelopeTokenWithIdentityCapabilityV1:
      verifyTokenMock,
  }),
);

import {
  ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
} from "@understand-code/durable-object-provider-contracts/provider-strong-ready-acceptance-candidate";

import { diagnoseProviderRuntimeAcceptanceIdentityTokenCurrentV1 } from "../src/acceptance-identity-token-current.js";

const digestV1 = (nibble: string) =>
  `sha256:${nibble.repeat(64)}` as const;
const INSTALLATION_IDENTITY =
  `installation-identity-generation:${"a".repeat(22)}` as const;
const PROVIDER_ID = "durable-object-provider:token-current-test";
const TARGET_PROFILE_ID = `provider-target-profile:${"4".repeat(64)}`;
const JOURNAL_MUTATION_DIGEST = digestV1("f");
const VALID_TOKEN = `hmac-sha256:${"a".repeat(64)}`;

function envelopeV1(token = VALID_TOKEN) {
  const configuration = {
    state: "strong_ready" as const,
    core: {
      activeRootMetadata: {
        locatorProfile:
          "installation_provider_registry_root_metadata_v1" as const,
        rootGeneration: 1,
        rootKeyId: "1".repeat(22),
        contentDigest: digestV1("1"),
      },
      providerRegistryManifest: {
        locatorProfile:
          "installation_provider_registry_manifest_v1" as const,
        manifestGeneration: 1,
        generationId: `provider-registry-manifest:${"2".repeat(22)}`,
        contentDigest: digestV1("2"),
      },
      providerSupportCatalog: {
        locatorProfile:
          "distribution_provider_feasibility_support_catalog_v1" as const,
        catalogGeneration: 1,
        contentDigest: digestV1("3"),
      },
      activeWriterSelector: {
        profile: "provider_active_writer_selector_v1" as const,
        selections: [{
          targetProfileId: TARGET_PROFILE_ID,
          providerId: PROVIDER_ID,
          registryEntryContentDigest: digestV1("5"),
          semanticProviderPolicyDigest: digestV1("6"),
          providerFeasibilityEvidence: {
            locatorProfile:
              "installation_provider_feasibility_evidence_v1" as const,
            evidenceId: `provider-feasibility-evidence:${"7".repeat(22)}`,
            contentDigest: digestV1("7"),
          },
          runtimeAttestationContentDigest: digestV1("8"),
          bindingDerivationKeyGeneration: 1,
        }],
      },
    },
    activation: { origin: "bootstrap_or_steady_successor" as const },
  };
  const predecessor = { state: "genesis" as const };
  const generationId = deriveProviderStrongReadyAcceptanceStateGenerationIdV1({
    installationIdentityGenerationId: INSTALLATION_IDENTITY,
    acceptanceOrdinal: 1,
    predecessor,
    configuration,
  });
  const payload = {
    profile: "provider_acceptance_state_v1" as const,
    generationId,
    installationIdentityGenerationId: INSTALLATION_IDENTITY,
    acceptanceOrdinal: 1,
    predecessor,
    configuration,
    acceptedAt: "2026-08-18T09:00:00Z",
    acceptanceToken: token,
  };
  return ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_acceptance_state",
    generationId,
    installationIdentityGenerationId: INSTALLATION_IDENTITY,
    acceptedAt: payload.acceptedAt,
    contentDigest: deriveProviderStrongReadyAcceptanceStateContentDigestV1(
      payload,
    ),
    payload,
  });
}

function durableCandidateV1() {
  const envelope = envelopeV1();
  return {
    status: "durable_acceptance_current_candidate" as const,
    authority: "none" as const,
    accessMode: "read_only" as const,
    strongWriteStatus: "locked" as const,
    acceptanceTokenStatus:
      "not_verified_external_identity_capability_required" as const,
    requiredNext: "acceptance_identity_token_and_os_peer_gate" as const,
    bindings: Object.freeze({
      providerId: PROVIDER_ID,
      targetProfileId: TARGET_PROFILE_ID,
      installationIdentityGenerationId: INSTALLATION_IDENTITY,
      acceptanceOrdinal: 1,
      acceptanceGenerationId: envelope.generationId,
      acceptanceContentDigest: envelope.contentDigest,
      registryManifestContentDigest: digestV1("9"),
      supportCatalogContentDigest: digestV1("a"),
      formalPlanContentDigest: digestV1("b"),
      journalRevision: 7,
      journalMutationDigest: JOURNAL_MUTATION_DIGEST,
      liveInspectedRevision: 6,
    }),
  };
}

function journalStateV1(token = VALID_TOKEN) {
  return {
    profile: "provider_runtime_durable_journal_state_v1" as const,
    revision: 7,
    phase: "final_strong_ready",
    operationNonce: "1".repeat(32),
    mutationDigest: JOURNAL_MUTATION_DIGEST,
    artifacts: {
      finalStrongReadyAcceptance: {
        finalStrongReadyAcceptanceEnvelope: envelopeV1(token),
      },
    },
  };
}

const identityVerificationCapabilityV1 = Object.freeze(Object.create(null));
const inputV1 = {
  liveGateBinding: {
    config: {},
    authKey: new Uint8Array(32),
  },
  identityVerificationCapability: identityVerificationCapabilityV1,
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  durableCurrentMock.mockResolvedValue({
    ok: true,
    value: durableCandidateV1(),
  });
  inspectStateMock.mockResolvedValue(journalStateV1());
  verifyTokenMock.mockImplementation(
    async (_capability, envelope) =>
      envelope.payload.acceptanceToken === VALID_TOKEN,
  );
});

describe("runtime current Acceptance identity-token join", () => {
  it("freshly verifies the stored exact token and remains read-only/locked", async () => {
    await expect(
      diagnoseProviderRuntimeAcceptanceIdentityTokenCurrentV1(inputV1),
    ).resolves.toMatchObject({
      ok: true,
      value: {
        status: "acceptance_identity_token_current_candidate",
        authority: "none",
        accessMode: "read_only",
        strongWriteStatus: "locked",
        acceptanceTokenStatus:
          "verified_with_installation_identity_capability",
        requiredNext: "kernel_os_peer_gate",
      },
    });
    expect(verifyTokenMock).toHaveBeenCalledWith(
      identityVerificationCapabilityV1,
      expect.objectContaining({
        contentDigest: durableCandidateV1().bindings.acceptanceContentDigest,
      }),
    );
  });

  it("returns one opaque failure for a tampered stored Acceptance token", async () => {
    inspectStateMock.mockResolvedValueOnce(
      journalStateV1(`hmac-sha256:${"0".repeat(64)}`),
    );

    await expect(
      diagnoseProviderRuntimeAcceptanceIdentityTokenCurrentV1(inputV1),
    ).resolves.toEqual({
      ok: false,
      code: "provider_unavailable",
      reason: "attestation_invalid",
      stage: "acceptance_identity_token",
    });
  });
});
