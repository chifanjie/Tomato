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
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
} from "@understand-code/durable-object-provider-contracts/primitives";

import {
  providerProductionStrongBusinessCompareInputInternalV1,
  providerProductionStrongAcceptanceLimitsInternalV1,
  providerProductionStrongAcceptanceHistoryInternalV1,
  providerProductionStrongAcceptanceCanonicalBytesInternalV1,
  providerProductionStrongIndexPublicationAuthorityInternalV1,
  providerProductionStrongIndexPublicationCompareInputInternalV1,
  providerProductionStrongIndexPublicationLaneInternalV1,
  providerProductionStrongRefreshAuthorityInternalV1,
  providerProductionStrongRefreshAuthorityLaneInternalV1,
  providerProductionStrongRefreshAuthoritySetInternalV1,
  providerProductionStrongRefreshPublicationCompareInputInternalV1,
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

describe("production strong reserved index publication authority", () => {
  const authority = providerProductionStrongIndexPublicationAuthorityInternalV1({
    profile: "provider_production_strong_index_publication_authority_v1",
    finalizedProviderRevision: 8,
    generationId: `generation-${"a".repeat(64)}`,
    generationManifestDigest: digest("b"),
    sourceInventoryDigest: digest("c"),
    sourceSnapshotId: "snapshot:step16-index-publication",
  });
  const compareInput = {
    expectedRevision: 7,
    operationNonce: "d".repeat(32),
    phase: "strong_refresh_index_v1",
    artifacts: { operation: "refresh_index", cut: "published" },
    authority: {
      profile: authority.profile,
      generationId: authority.generationId,
      generationManifestDigest: authority.generationManifestDigest,
      sourceInventoryDigest: authority.sourceInventoryDigest,
      sourceSnapshotId: authority.sourceSnapshotId,
    },
  } as const;

  it("strictly parses the dedicated compare input and derives revision expected+1", () => {
    expect(
      providerProductionStrongIndexPublicationCompareInputInternalV1(
        compareInput,
      ),
    ).toEqual(compareInput);
    expect(() =>
      providerProductionStrongIndexPublicationCompareInputInternalV1({
        ...compareInput,
        unexpected: true,
      })
    ).toThrow(/index publication compare input is invalid/u);
    expect(() =>
      providerProductionStrongIndexPublicationCompareInputInternalV1({
        ...compareInput,
        authority: { ...compareInput.authority, unexpected: true },
      })
    ).toThrow(/index publication authority input is invalid/u);
    expect(() =>
      providerProductionStrongIndexPublicationCompareInputInternalV1({
        ...compareInput,
        authority: { ...compareInput.authority, sourceSnapshotId: " padded " },
      })
    ).toThrow(/index publication authority is invalid/u);
  });

  it("sets the lane, strips it publicly, and carries it through ordinary commits", () => {
    const first = providerProductionStrongIndexPublicationLaneInternalV1({
      publicArtifacts: compareInput.artifacts,
      replacementAuthority: authority,
      currentRevision: 8,
    });
    expect(first.authority).toEqual(authority);
    expect(first.publicArtifacts).toEqual(compareInput.artifacts);
    expect(Object.keys(first.durableArtifacts).length).toBe(
      Object.keys(compareInput.artifacts).length + 1,
    );

    const nextPublicArtifacts = { operation: "task_update", taskRevision: 9 };
    const carried = providerProductionStrongIndexPublicationLaneInternalV1({
      currentArtifacts: first.durableArtifacts,
      publicArtifacts: nextPublicArtifacts,
      currentRevision: 9,
    });
    expect(carried.authority).toEqual(authority);
    expect(carried.publicArtifacts).toEqual(nextPublicArtifacts);
  });

  it("does not let an ordinary compare create the reserved lane", () => {
    const ordinary = providerProductionStrongBusinessCompareInputInternalV1({
      expectedRevision: 0,
      operationNonce: "f".repeat(32),
      phase: "strong_verification_v1",
      artifacts: { operation: "verification", status: "passed" },
    });
    const projected = providerProductionStrongIndexPublicationLaneInternalV1({
      publicArtifacts: ordinary.artifacts,
      currentRevision: 1,
    });
    expect(projected.authority).toBeUndefined();
    expect(projected.durableArtifacts).toEqual(ordinary.artifacts);
    expect(projected.publicArtifacts).toEqual(ordinary.artifacts);
  });

  it("rejects ordinary reserved-key injection and fails closed on stale or tampered lanes", () => {
    const first = providerProductionStrongIndexPublicationLaneInternalV1({
      publicArtifacts: compareInput.artifacts,
      replacementAuthority: authority,
      currentRevision: 8,
    });
    const reservedKey = Object.keys(first.durableArtifacts).find(
      (key) => !Object.hasOwn(compareInput.artifacts, key),
    );
    expect(reservedKey).toBeDefined();
    expect(() => providerProductionStrongBusinessCompareInputInternalV1({
      expectedRevision: 8,
      operationNonce: "e".repeat(32),
      phase: "strong_verification_v1",
      artifacts: { [reservedKey!]: authority },
    })).toThrow(/reserved authority is invalid/u);

    expect(() => providerProductionStrongIndexPublicationLaneInternalV1({
      currentArtifacts: first.durableArtifacts,
      publicArtifacts: { operation: "stale_retry" },
      currentRevision: 7,
    })).toThrow(/authority revision is invalid/u);

    const tampered = structuredClone(first.durableArtifacts) as Record<
      string,
      unknown
    >;
    tampered[reservedKey!] = { ...authority, unexpected: true };
    expect(() => providerProductionStrongIndexPublicationLaneInternalV1({
      currentArtifacts: tampered as never,
      publicArtifacts: { operation: "tampered_retry" },
      currentRevision: 9,
    })).toThrow(/authority is invalid/u);
  });

  it("reconstructs an exact lane for idempotent replay", () => {
    const first = providerProductionStrongIndexPublicationLaneInternalV1({
      publicArtifacts: compareInput.artifacts,
      replacementAuthority: authority,
      currentRevision: 8,
    });
    const replay = providerProductionStrongIndexPublicationLaneInternalV1({
      publicArtifacts: compareInput.artifacts,
      replacementAuthority: authority,
      currentRevision: 8,
    });
    expect(replay.durableArtifacts).toEqual(first.durableArtifacts);
    expect(replay.publicArtifacts).toEqual(compareInput.artifacts);
  });
});

describe("production strong monotonic latest-refresh authority", () => {
  const repositoryA = `repo-hmac-${"2".repeat(64)}` as const;
  const repositoryB = `repo-hmac-${"1".repeat(64)}` as const;
  const worktreeA = `worktree-hmac-${"4".repeat(64)}` as const;
  const worktreeB = `worktree-hmac-${"3".repeat(64)}` as const;
  const snapshotId = (digit: string) =>
    `snapshot-${digit.repeat(64)}` as `snapshot-${string}`;
  const strongDigest = (digit: string) =>
    ContentDigestV1Schema.parse(digest(digit));
  const strongProviderId =
    DurableObjectIdentityProviderIdV1Schema.parse(PROVIDER_ID);

  function refreshCompareV1(input: Readonly<{
    expectedRevision: number;
    nonceDigit: string;
    repositoryId: `repo-hmac-${string}`;
    worktreeId: `worktree-hmac-${string}`;
    snapshotDigit: string;
    mode: "incremental" | "full";
    previous: null | Readonly<{
      finalizedProviderRevision: number;
      snapshotId: `snapshot-${string}`;
    }>;
  }>) {
    const currentSnapshotId = snapshotId(input.snapshotDigit);
    const cutObject = {
      providerId: strongProviderId,
      contentDigest: strongDigest(input.snapshotDigit),
    } as const;
    const refreshAuthority = {
      profile: "provider_production_strong_refresh_authority_v1" as const,
      repositoryId: input.repositoryId,
      worktreeId: input.worktreeId,
      mode: input.mode,
      snapshotId: currentSnapshotId,
      snapshotContentDigest: strongDigest("8"),
      pulseContentDigest: strongDigest("9"),
      cutObject,
      previous: input.previous,
    };
    const commonArtifacts = {
      schemaVersion: 1 as const,
      operation: "refresh_index" as const,
      requestDigest: strongDigest("d"),
      idempotencyKeyDigest: strongDigest("e"),
      semanticDigest: strongDigest("f"),
      mode: input.mode,
      snapshotId: currentSnapshotId,
      snapshotContentDigest: refreshAuthority.snapshotContentDigest,
      pulseContentDigest: refreshAuthority.pulseContentDigest,
      cutObject,
    };
    const common = {
      expectedRevision: input.expectedRevision,
      operationNonce: input.nonceDigit.repeat(32),
      phase: "strong_refresh_index_v1" as const,
      refreshAuthority,
    };
    if (input.mode === "incremental") {
      return { ...common, artifacts: commonArtifacts } as const;
    }
    const indexPublicationAuthority = {
      profile:
        "provider_production_strong_index_publication_authority_v1" as const,
      generationId: `generation-${"a".repeat(64)}` as const,
      generationManifestDigest: strongDigest("b"),
      sourceInventoryDigest: strongDigest("c"),
      sourceSnapshotId: currentSnapshotId,
    };
    return {
      ...common,
      artifacts: {
        ...commonArtifacts,
        indexGenerationId: indexPublicationAuthority.generationId,
        indexGenerationManifestDigest:
          indexPublicationAuthority.generationManifestDigest,
        indexSourceInventoryDigest:
          indexPublicationAuthority.sourceInventoryDigest,
      },
      indexPublicationAuthority,
    } as const;
  }

  function preparedArtifactsV1(
    compare: ReturnType<typeof refreshCompareV1>,
  ) {
    return { ...compare.artifacts, operation: "refresh_index_prepared" };
  }

  it("strictly parses the public CAS input and rejects unbound authority fields", () => {
    const compare = refreshCompareV1({
      expectedRevision: 0,
      nonceDigit: "1",
      repositoryId: repositoryA,
      worktreeId: worktreeA,
      snapshotDigit: "5",
      mode: "incremental",
      previous: null,
    });
    expect(
      providerProductionStrongRefreshPublicationCompareInputInternalV1(
        compare,
      ),
    ).toEqual(compare);
    expect(() =>
      providerProductionStrongRefreshPublicationCompareInputInternalV1({
        ...compare,
        refreshAuthority: {
          ...compare.refreshAuthority,
          snapshotContentDigest: strongDigest("7"),
        },
      })
    ).toThrow(/artifacts are not bound/u);
    expect(() =>
      providerProductionStrongRefreshPublicationCompareInputInternalV1({
        ...compare,
        refreshAuthority: {
          ...compare.refreshAuthority,
          unexpected: true,
        },
      })
    ).toThrow(/authority input is invalid/u);
    expect(() =>
      providerProductionStrongRefreshPublicationCompareInputInternalV1({
        ...compare,
        artifacts: { ...compare.artifacts, unexpected: true },
      })
    ).toThrow(/artifacts are not bound/u);
    expect(() =>
      providerProductionStrongRefreshPublicationCompareInputInternalV1({
        ...compare,
        phase: "strong_verification_v1",
      })
    ).toThrow(/phase is invalid/u);
  });

  it("publishes cold only at exact revision zero and permits exact old replay", () => {
    const compare = refreshCompareV1({
      expectedRevision: 0,
      nonceDigit: "2",
      repositoryId: repositoryA,
      worktreeId: worktreeA,
      snapshotDigit: "5",
      mode: "incremental",
      previous: null,
    });
    const first = providerProductionStrongRefreshAuthorityLaneInternalV1({
      currentProviderRevision: 0,
      currentBusinessUninitialized: true,
      compareInput: compare,
    });
    expect(first.refreshAuthority.finalizedProviderRevision).toBe(1);

    const carried = providerProductionStrongIndexPublicationLaneInternalV1({
      currentArtifacts: first.durableArtifacts,
      publicArtifacts: { operation: "task_update", revision: 2 },
      currentRevision: 2,
    });
    const replay = providerProductionStrongRefreshAuthorityLaneInternalV1({
      currentArtifacts: carried.durableArtifacts,
      currentProviderRevision: 2,
      currentBusinessUninitialized: false,
      compareInput: compare,
    });
    expect(replay.refreshAuthority).toEqual(first.refreshAuthority);
    expect(replay.refreshAuthorities).toEqual(first.refreshAuthorities);

    expect(() => providerProductionStrongRefreshAuthorityLaneInternalV1({
      currentProviderRevision: 1,
      currentBusinessUninitialized: false,
      compareInput: refreshCompareV1({
        expectedRevision: 1,
        nonceDigit: "3",
        repositoryId: repositoryA,
        worktreeId: worktreeA,
        snapshotDigit: "5",
        mode: "incremental",
        previous: null,
      }),
    })).toThrow(/cold publication is invalid/u);
  });

  it("carries the sorted bounded set through ordinary compare and isolates keys", () => {
    const firstCompare = refreshCompareV1({
      expectedRevision: 0,
      nonceDigit: "4",
      repositoryId: repositoryA,
      worktreeId: worktreeA,
      snapshotDigit: "5",
      mode: "incremental",
      previous: null,
    });
    const first = providerProductionStrongRefreshAuthorityLaneInternalV1({
      currentProviderRevision: 0,
      currentBusinessUninitialized: true,
      compareInput: firstCompare,
    });
    const secondCompare = refreshCompareV1({
      expectedRevision: 1,
      nonceDigit: "5",
      repositoryId: repositoryB,
      worktreeId: worktreeB,
      snapshotDigit: "6",
      mode: "incremental",
      previous: null,
    });
    const second = providerProductionStrongRefreshAuthorityLaneInternalV1({
      currentArtifacts: first.durableArtifacts,
      currentProviderRevision: 1,
      currentBusinessUninitialized: false,
      compareInput: secondCompare,
    });
    expect(second.refreshAuthorities.map((authority) => [
      authority.repositoryId,
      authority.worktreeId,
    ])).toEqual([
      [repositoryB, worktreeB],
      [repositoryA, worktreeA],
    ]);

    const ordinary = providerProductionStrongIndexPublicationLaneInternalV1({
      currentArtifacts: second.durableArtifacts,
      publicArtifacts: { operation: "verification", status: "passed" },
      currentRevision: 3,
    });
    const reservedSet = Object.values(ordinary.durableArtifacts).find(
      (value) =>
        typeof value === "object" && value !== null && !Array.isArray(value) &&
        (value as Record<string, unknown>)["profile"] ===
          "provider_production_strong_refresh_authority_set_v1",
    );
    expect(
      providerProductionStrongRefreshAuthoritySetInternalV1(reservedSet),
    ).toEqual(second.refreshAuthorities);
    expect(() => providerProductionStrongRefreshAuthoritySetInternalV1({
      profile: "provider_production_strong_refresh_authority_set_v1",
      authorities: Array.from(
        { length: 4_097 },
        () => second.refreshAuthorities[0],
      ),
    })).toThrow(/set is invalid/u);
  });

  it("rejects stale CAS and a wrong exact previous tuple", () => {
    const firstCompare = refreshCompareV1({
      expectedRevision: 0,
      nonceDigit: "6",
      repositoryId: repositoryA,
      worktreeId: worktreeA,
      snapshotDigit: "5",
      mode: "incremental",
      previous: null,
    });
    const first = providerProductionStrongRefreshAuthorityLaneInternalV1({
      currentProviderRevision: 0,
      currentBusinessUninitialized: true,
      compareInput: firstCompare,
    });
    const next = refreshCompareV1({
      expectedRevision: 1,
      nonceDigit: "7",
      repositoryId: repositoryA,
      worktreeId: worktreeA,
      snapshotDigit: "6",
      mode: "incremental",
      previous: {
        finalizedProviderRevision: 1,
        snapshotId: snapshotId("5"),
      },
    });
    expect(() => providerProductionStrongRefreshAuthorityLaneInternalV1({
      currentArtifacts: first.durableArtifacts,
      currentProviderRevision: 2,
      currentBusinessUninitialized: false,
      compareInput: next,
    })).toThrow(/compare is stale/u);
    expect(() => providerProductionStrongRefreshAuthorityLaneInternalV1({
      currentArtifacts: first.durableArtifacts,
      currentProviderRevision: 1,
      currentBusinessUninitialized: false,
      compareInput: {
        ...next,
        refreshAuthority: {
          ...next.refreshAuthority,
          previous: {
            finalizedProviderRevision: 1,
            snapshotId: snapshotId("7"),
          },
        },
      },
    })).toThrow(/previous authority is stale/u);
  });

  it("atomically finalizes one exact prepared full cut and both authorities", () => {
    const full = refreshCompareV1({
      expectedRevision: 1,
      nonceDigit: "8",
      repositoryId: repositoryA,
      worktreeId: worktreeA,
      snapshotDigit: "6",
      mode: "full",
      previous: null,
    });
    const finalized = providerProductionStrongRefreshAuthorityLaneInternalV1({
      currentArtifacts: preparedArtifactsV1(full),
      currentProviderRevision: 1,
      currentBusinessUninitialized: false,
      compareInput: full,
    });
    expect(finalized.refreshAuthority.finalizedProviderRevision).toBe(2);
    expect(finalized.indexPublicationAuthority).toMatchObject({
      finalizedProviderRevision: 2,
      sourceSnapshotId: full.refreshAuthority.snapshotId,
    });
    expect(finalized.publicArtifacts).toEqual(full.artifacts);
    expect(Object.keys(finalized.durableArtifacts)).toHaveLength(
      Object.keys(full.artifacts).length + 2,
    );

    expect(() => providerProductionStrongRefreshAuthorityLaneInternalV1({
      currentArtifacts: {
        ...preparedArtifactsV1(full),
        snapshotContentDigest: strongDigest("0"),
      },
      currentProviderRevision: 1,
      currentBusinessUninitialized: false,
      compareInput: full,
    })).toThrow(/no exact prepared head/u);
    expect(() => providerProductionStrongRefreshAuthorityLaneInternalV1({
      currentArtifacts: {
        ...preparedArtifactsV1(full),
        requestDigest: strongDigest("0"),
      },
      currentProviderRevision: 1,
      currentBusinessUninitialized: false,
      compareInput: full,
    })).toThrow(/no exact prepared head/u);
    expect(() => providerProductionStrongRefreshAuthorityLaneInternalV1({
      currentArtifacts: {
        ...preparedArtifactsV1(full),
        unexpected: "prepared-only",
      },
      currentProviderRevision: 1,
      currentBusinessUninitialized: false,
      compareInput: full,
    })).toThrow(/no exact prepared head/u);
  });

  it("rejects malformed stored authorities independently of the public head", () => {
    const authority = providerProductionStrongRefreshAuthorityInternalV1({
      ...refreshCompareV1({
        expectedRevision: 0,
        nonceDigit: "9",
        repositoryId: repositoryA,
        worktreeId: worktreeA,
        snapshotDigit: "5",
        mode: "incremental",
        previous: null,
      }).refreshAuthority,
      finalizedProviderRevision: 1,
    });
    expect(authority.finalizedProviderRevision).toBe(1);
    expect(() => providerProductionStrongRefreshAuthorityInternalV1({
      ...authority,
      finalizedProviderRevision: 1,
      previous: {
        finalizedProviderRevision: 1,
        snapshotId: authority.snapshotId,
      },
    })).toThrow(/not monotonic/u);
  });
});
