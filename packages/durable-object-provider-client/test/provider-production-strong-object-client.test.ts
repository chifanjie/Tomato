import { describe, expect, it } from "vitest";

import {
  PROVIDER_TRUST_HISTORY_POLICY_V1,
} from "@understand-code/durable-object-provider-contracts";
import {
  ProviderAcceptanceStateEnvelopeV1Schema,
  deriveProviderAcceptanceStateContentDigestV1,
  deriveProviderAcceptanceStateGenerationIdV1,
} from "@understand-code/durable-object-provider-contracts/provider-acceptance";

import {
  providerProductionStrongAcceptanceLimitsInternalV1,
  providerProductionStrongAcceptanceHistoryInternalV1,
  providerProductionStrongAcceptanceCanonicalBytesInternalV1,
  providerProductionStrongRetainedTrustBudgetInternalV1,
} from "../src/provider-production-strong-object-client.js";

const INSTALLATION_ID =
  `installation-identity-generation:${"a".repeat(22)}`;
const PROVIDER_ID = "durable-object-provider:acceptance-history";
const TARGET_PROFILE_ID = `provider-target-profile:${"1".repeat(64)}`;
const digest = (digit: string) => `sha256:${digit.repeat(64)}` as const;

function configurationV1() {
  return {
    state: "strong_ready" as const,
    core: {
      activeRootMetadata: {
        locatorProfile:
          "installation_provider_registry_root_metadata_v1" as const,
        rootGeneration: 1,
        rootKeyId: "1".repeat(22),
        contentDigest: digest("1"),
      },
      providerRegistryManifest: {
        locatorProfile:
          "installation_provider_registry_manifest_v1" as const,
        manifestGeneration: 1,
        generationId: `provider-registry-manifest:${"2".repeat(22)}`,
        contentDigest: digest("2"),
      },
      providerSupportCatalog: {
        locatorProfile:
          "distribution_provider_feasibility_support_catalog_v1" as const,
        catalogGeneration: 1,
        contentDigest: digest("3"),
      },
      activeWriterSelector: {
        profile: "provider_active_writer_selector_v1" as const,
        selections: [{
          targetProfileId: TARGET_PROFILE_ID,
          providerId: PROVIDER_ID,
          registryEntryContentDigest: digest("4"),
          semanticProviderPolicyDigest: digest("5"),
          providerFeasibilityEvidence: {
            locatorProfile:
              "installation_provider_feasibility_evidence_v1" as const,
            evidenceId: `provider-feasibility-evidence:${"6".repeat(22)}`,
            contentDigest: digest("6"),
          },
          runtimeAttestationContentDigest: digest("7"),
          bindingDerivationKeyGeneration: 1,
        }],
      },
    },
    activation: { origin: "bootstrap_or_steady_successor" as const },
  };
}

function acceptanceV1(input: Readonly<{
  ordinal: number;
  predecessor:
    | Readonly<{ state: "genesis" }>
    | Readonly<{
        state: "acceptance";
        generationId: string;
        contentDigest: string;
      }>;
  acceptedAt: string;
}>) {
  const configuration = configurationV1();
  const generationId = deriveProviderAcceptanceStateGenerationIdV1({
    installationIdentityGenerationId: INSTALLATION_ID,
    acceptanceOrdinal: input.ordinal,
    predecessor: input.predecessor as never,
    configuration,
  });
  const payload = {
    profile: "provider_acceptance_state_v1" as const,
    generationId,
    installationIdentityGenerationId: INSTALLATION_ID,
    acceptanceOrdinal: input.ordinal,
    predecessor: input.predecessor,
    configuration,
    acceptedAt: input.acceptedAt,
    acceptanceToken: `hmac-sha256:${"8".repeat(64)}` as const,
  };
  return ProviderAcceptanceStateEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_acceptance_state",
    generationId,
    installationIdentityGenerationId: INSTALLATION_ID,
    acceptedAt: input.acceptedAt,
    contentDigest: deriveProviderAcceptanceStateContentDigestV1(
      payload as never,
    ),
    payload,
  });
}

function currentV1(
  envelope: ReturnType<typeof acceptanceV1>,
) {
  return {
    generationId: envelope.generationId,
    contentDigest: envelope.contentDigest,
    acceptanceOrdinal: envelope.payload.acceptanceOrdinal,
    installationIdentityGenerationId:
      envelope.installationIdentityGenerationId,
  };
}

function acceptanceHistoryV1(count: number) {
  const history: ReturnType<typeof acceptanceV1>[] = [];
  for (let ordinal = 1; ordinal <= count; ordinal += 1) {
    const previous = history.at(-1);
    history.push(acceptanceV1({
      ordinal,
      predecessor: previous === undefined
        ? { state: "genesis" }
        : {
            state: "acceptance",
            generationId: previous.generationId,
            contentDigest: previous.contentDigest,
          },
      acceptedAt: new Date(
        Date.UTC(2026, 7, 26, 0, 0, ordinal),
      ).toISOString(),
    }));
  }
  return history;
}

describe("production strong retained Acceptance history", () => {
  const first = acceptanceV1({
    ordinal: 1,
    predecessor: { state: "genesis" },
    acceptedAt: "2026-08-26T00:00:00Z",
  });
  const second = acceptanceV1({
    ordinal: 2,
    predecessor: {
      state: "acceptance",
      generationId: first.generationId,
      contentDigest: first.contentDigest,
    },
    acceptedAt: "2026-08-26T00:00:01Z",
  });

  it("retains the complete monotonic chain and exact current tip", () => {
    expect(providerProductionStrongAcceptanceHistoryInternalV1({
      history: [first, second],
      current: currentV1(second),
    })).toEqual({
      generationIds: [first.generationId, second.generationId],
      tipGenerationId: second.generationId,
    });
  });

  it("rejects a truncated or A-B-A/non-monotonic retained chain", () => {
    expect(() => providerProductionStrongAcceptanceHistoryInternalV1({
      history: [second],
      current: currentV1(second),
    })).toThrow(/Acceptance history is invalid/u);
    expect(() => providerProductionStrongAcceptanceHistoryInternalV1({
      history: [first, second, first],
      current: currentV1(first),
    })).toThrow(/Acceptance history is invalid/u);
  });

  it("accepts the formal bootstrap/steady origin and rejects the retired reference-only origin", () => {
    expect(providerProductionStrongAcceptanceHistoryInternalV1({
      history: [first],
      current: currentV1(first),
    }).tipGenerationId).toBe(first.generationId);
    const retired = structuredClone(first) as Record<string, any>;
    retired.payload.configuration.activation = {
      origin: "provider_migration_terminal_sealed_success_v1",
      formalMigrationId: `provider-migration:${"b".repeat(22)}`,
    };
    expect(() => providerProductionStrongAcceptanceHistoryInternalV1({
      history: [retired],
      current: currentV1(first),
    })).toThrow();
  });

  it("enforces the 4 MiB envelope and combined 256 MiB retained-history budgets", () => {
    const limits = providerProductionStrongAcceptanceLimitsInternalV1();
    const acceptanceBytes =
      providerProductionStrongAcceptanceCanonicalBytesInternalV1(first);
    expect(acceptanceBytes).toBeLessThanOrEqual(
      limits.maxSingleTrustEnvelopeLogicalBytes,
    );
    expect(() => providerProductionStrongAcceptanceCanonicalBytesInternalV1({
      oversized: "x".repeat(limits.maxSingleTrustEnvelopeLogicalBytes),
    })).toThrow(/Acceptance envelope exceeds the logical byte budget/u);

    const registryAtBoundary =
      limits.maxTotalTrustHistoryLogicalBytes - acceptanceBytes;
    expect(providerProductionStrongRetainedTrustBudgetInternalV1({
      registryCanonicalBytes: registryAtBoundary,
      acceptanceCanonicalBytes: acceptanceBytes,
    })).toBe(true);
    expect(() => providerProductionStrongRetainedTrustBudgetInternalV1({
      registryCanonicalBytes: registryAtBoundary + 1,
      acceptanceCanonicalBytes: acceptanceBytes,
    })).toThrow(/retained trust history exceeds the logical byte budget/u);
  });

  it("accepts 129 and the frozen 4096-generation limit, then rejects 4097", () => {
    const first4096 = acceptanceHistoryV1(4_096);
    const first129 = first4096.slice(0, 129);
    const overLimit = [...first4096, first4096.at(-1)!];
    expect(providerProductionStrongAcceptanceHistoryInternalV1({
      history: first129,
      current: currentV1(first129.at(-1)!),
    }).generationIds).toHaveLength(129);
    expect(providerProductionStrongAcceptanceHistoryInternalV1({
      history: first4096,
      current: currentV1(first4096.at(-1)!),
    }).generationIds).toHaveLength(4_096);
    expect(() => providerProductionStrongAcceptanceHistoryInternalV1({
      history: overLimit,
      current: currentV1(overLimit.at(-1)!),
    })).toThrow(/Acceptance history is invalid/u);

    const limits = providerProductionStrongAcceptanceLimitsInternalV1();
    expect(limits.maxAcceptanceHistoryGenerations).toBe(
      PROVIDER_TRUST_HISTORY_POLICY_V1
        .maxAcceptanceGenerationCountPerInstallationIdentity,
    );
    expect(limits.maxTotalTrustHistoryLogicalBytes).toBe(
      PROVIDER_TRUST_HISTORY_POLICY_V1
        .maxTotalTrustHistoryLogicalBytesPerInstallationIdentity,
    );
    expect(limits.maxSingleTrustEnvelopeLogicalBytes).toBe(
      PROVIDER_TRUST_HISTORY_POLICY_V1.maxSingleTrustEnvelopeLogicalBytes,
    );
    expect(limits.maxTrustSnapshotBytes).toBe(300 * 1024 * 1024);
    expect(limits.maxTrustSnapshotBytes).toBeGreaterThan(
      limits.maxTotalTrustHistoryLogicalBytes +
        limits.maxSingleTrustEnvelopeLogicalBytes,
    );
    expect(Buffer.byteLength(JSON.stringify({
      acceptanceHistory: first4096,
      currentAcceptance: currentV1(first4096.at(-1)!),
    }), "utf8")).toBeLessThan(limits.maxTrustSnapshotBytes);
  }, 30_000);
});
