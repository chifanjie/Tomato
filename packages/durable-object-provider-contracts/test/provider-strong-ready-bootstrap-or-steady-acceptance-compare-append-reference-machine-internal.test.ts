import { createHash, createHmac } from "node:crypto";

import { beforeAll, describe, expect, it, vi } from "vitest";

import type { ProviderCryptoHostV1 } from "../src/domain-crypto.js";
import {
  ContentDigestV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  KeyedStateTokenV1Schema,
  LowerHex32V1Schema,
} from "../src/primitives.js";
import {
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptContentDigestReferenceCandidateV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterContentDigestReferenceCandidateV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1,
} from "../src/provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-reference-candidate-wire.js";
import {
  ProviderRegistryIsoTimestampV1Schema,
} from "../src/provider-registry-trust.js";
import {
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptTokenWithIdentityCapabilityInternalV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenWithIdentityCapabilityInternalV1,
  deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1,
  mintProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
} from "../src/provider-strong-ready-bootstrap-or-steady-acceptance-identity-verification-capability-internal.js";
import {
  captureProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineStateAfterPendingInternalV1,
  classifyProviderStrongReadyBootstrapOrSteadyAcceptanceAdmissionScalarsInternalV1,
  createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerCandidateInternalV1,
  executeProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1,
  inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1,
  mintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1,
} from "../src/provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-reference-machine-internal.js";
import {
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
  type ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
} from "../src/provider-strong-ready-acceptance-candidate.js";

const CapturedMapV1 = Map;
const CapturedSetV1 = Set;
const cryptoHost: ProviderCryptoHostV1 = Object.freeze({
  sha256(message: Uint8Array) {
    return new Uint8Array(createHash("sha256").update(message).digest());
  },
  hmacSha256(key: Uint8Array, message: Uint8Array) {
    return new Uint8Array(createHmac("sha256", key).update(message).digest());
  },
});
const identityKey = new Uint8Array(
  Array.from({ length: 32 }, (_, index) => index),
);
const installationIdentityGenerationId =
  InstallationIdentityGenerationIdV1Schema.parse(
    "installation-identity-generation:4fe634940e20afac35e02d",
  );
const digest = (character: string) =>
  `sha256:${character.repeat(64)}` as const;
const floors: Readonly<{
  rootMetadataGeneration: number;
  registryManifestGeneration: number;
  supportCatalogGeneration: number;
}> = Object.freeze({
  rootMetadataGeneration: 1,
  registryManifestGeneration: 1,
  supportCatalogGeneration: 1,
});

let identityCapability:
  ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;

beforeAll(async () => {
  identityCapability =
    await mintProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1({
      initializationNonce: LowerHex32V1Schema.parse(
        "000102030405060708090a0b0c0d0e0f",
      ),
      installationIdentityGenerationId,
      keyCheckToken: KeyedStateTokenV1Schema.parse(
        "hmac-sha256:9b585cbb13d23ae739df3988278dfdc09ed612ccd8af853ac26f570bc8ce2eef",
      ),
      installationIdentityKey: identityKey,
      cryptoHost,
    });
});

async function candidateV1(
  acceptanceOrdinal = 1,
  predecessor: { state: "genesis" } | {
    state: "acceptance";
    generationId: string;
    contentDigest: string;
  } = { state: "genesis" },
  generationFloors: Readonly<{
    rootMetadataGeneration: number;
    registryManifestGeneration: number;
    supportCatalogGeneration: number;
  }> = floors,
): Promise<ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1> {
  const configuration = {
    state: "strong_ready" as const,
    core: {
      activeRootMetadata: {
        locatorProfile:
          "installation_provider_registry_root_metadata_v1" as const,
        rootGeneration: generationFloors.rootMetadataGeneration,
        rootKeyId: "1".repeat(22),
        contentDigest: digest("2"),
      },
      providerRegistryManifest: {
        locatorProfile:
          "installation_provider_registry_manifest_v1" as const,
        manifestGeneration: generationFloors.registryManifestGeneration,
        generationId: `provider-registry-manifest:${"3".repeat(22)}`,
        contentDigest: digest("4"),
      },
      providerSupportCatalog: {
        locatorProfile:
          "distribution_provider_feasibility_support_catalog_v1" as const,
        catalogGeneration: generationFloors.supportCatalogGeneration,
        contentDigest: digest("5"),
      },
      activeWriterSelector: {
        profile: "provider_active_writer_selector_v1" as const,
        selections: [{
          targetProfileId: `provider-target-profile:${"6".repeat(64)}`,
          providerId: "durable-object-provider:native-b",
          registryEntryContentDigest: digest("7"),
          semanticProviderPolicyDigest: digest("8"),
          providerFeasibilityEvidence: {
            locatorProfile:
              "installation_provider_feasibility_evidence_v1" as const,
            evidenceId: `provider-feasibility-evidence:${"9".repeat(22)}`,
            contentDigest: digest("a"),
          },
          runtimeAttestationContentDigest: digest("b"),
          bindingDerivationKeyGeneration: 1,
        }],
      },
    },
    activation: { origin: "bootstrap_or_steady_successor" as const },
  };
  const generationId = deriveProviderStrongReadyAcceptanceStateGenerationIdV1(
    {
      installationIdentityGenerationId,
      acceptanceOrdinal,
      predecessor,
      configuration,
    },
  );
  const unsigned = {
    profile: "provider_acceptance_state_v1" as const,
    generationId,
    installationIdentityGenerationId,
    acceptanceOrdinal,
    predecessor,
    configuration,
    acceptedAt: `2026-08-13T00:00:0${acceptanceOrdinal}Z`,
  };
  const acceptanceToken =
    await deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
      identityCapability,
      installationIdentityGenerationId,
      unsigned,
    );
  const payload = { ...unsigned, acceptanceToken };
  return {
    schemaVersion: 1,
    recordType: "provider_acceptance_state",
    generationId,
    installationIdentityGenerationId,
    acceptedAt: unsigned.acceptedAt,
    contentDigest:
      deriveProviderStrongReadyAcceptanceStateContentDigestV1(payload),
    payload,
  } as ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1;
}

async function requestV1(
  operationNonce: string,
): Promise<ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1> {
  return {
    profile: "provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_request_reference_candidate_v1",
    operationNonce,
    installationIdentityGenerationId,
    expected: { state: "genesis", expectedNamespaceState: "absent" },
    candidate: await candidateV1(),
  } as ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1;
}

async function successorRequestV1(
  state: ReturnType<
    typeof inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1
  >,
  operationNonce: string,
  generationFloors: typeof floors = floors,
): Promise<ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1> {
  if (state.namespace.state !== "current") throw new Error("expected current");
  const previous = state.namespace.generations[
    state.namespace.generations.length - 1
  ]!;
  const highWater = state.namespace.currentRead.highWater;
  return {
    profile: "provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_request_reference_candidate_v1",
    operationNonce,
    installationIdentityGenerationId,
    expected: {
      state: "current",
      highWaterRevision: highWater.payload.highWaterRevision,
      highWaterContentDigest: highWater.contentDigest,
      currentVersionToken: highWater.currentVersionToken,
      generationCount: highWater.payload.generationCount,
      generationSetDigest: highWater.payload.generationSetDigest,
    },
    candidate: await candidateV1(
      previous.payload.acceptanceOrdinal + 1,
      {
        state: "acceptance",
        generationId: previous.generationId,
        contentDigest: previous.contentDigest,
      },
      generationFloors,
    ),
  } as ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1;
}

async function machineV1(): Promise<
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1
> {
  return mintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1({
    identityVerificationCapability: identityCapability,
    initialState: {
      namespace: { state: "absent" },
      receiptLedger:
        createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerCandidateInternalV1({
          installationIdentityGenerationId,
          receipts: [],
        }),
    },
    retainedNonAcceptanceTrustHistoryLogicalBytes: 0,
  });
}

function commitDecisionV1(
  request: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1,
) {
  return {
    classification: "committed" as const,
    candidate: request.candidate,
    acceptedGenerationFloors: floors,
  };
}

function executeV1(
  machine:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1,
  request: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1,
  transaction: Parameters<
    typeof executeProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1
  >[0]["transaction"] = vi.fn(async () => commitDecisionV1(request)),
  resolvedAt = "2026-08-13T01:00:00Z",
) {
  return executeProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1({
    identityVerificationCapability: identityCapability,
    referenceMachineCapability: machine,
    request,
    resolvedAt: ProviderRegistryIsoTimestampV1Schema.parse(resolvedAt),
    transaction,
  });
}

async function resignCommittedReceiptFloorsV1(
  receipt: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1,
  acceptedGenerationFloors: typeof floors,
): Promise<ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1> {
  if (receipt.payload.referenceOutcome.outcome !== "committed") {
    throw new Error("expected committed receipt");
  }
  const previousHighWater = receipt.payload.referenceOutcome.committedHighWater;
  const highWaterPayload = {
    ...previousHighWater.payload,
    acceptedGenerationFloors,
  };
  const provisionalHighWater = {
    ...previousHighWater,
    contentDigest:
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterContentDigestReferenceCandidateV1(
        highWaterPayload,
      ),
    currentVersionToken: `hmac-sha256:${"0".repeat(64)}` as const,
    payload: highWaterPayload,
  };
  const committedHighWater = {
    ...provisionalHighWater,
    currentVersionToken:
      await deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenWithIdentityCapabilityInternalV1(
        identityCapability,
        installationIdentityGenerationId,
        provisionalHighWater,
      ),
  };
  const unsignedPayload = {
    profile: receipt.payload.profile,
    installationIdentityGenerationId:
      receipt.payload.installationIdentityGenerationId,
    operationNonce: receipt.payload.operationNonce,
    requestContentDigest: receipt.payload.requestContentDigest,
    linearizationOrdinal: receipt.payload.linearizationOrdinal,
    requestReferenceProjection: receipt.payload.requestReferenceProjection,
    referenceOutcome: {
      ...receipt.payload.referenceOutcome,
      committedHighWater,
    },
    resolvedAt: receipt.payload.resolvedAt,
  };
  const payload = {
    ...unsignedPayload,
    receiptToken:
      await deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptTokenWithIdentityCapabilityInternalV1(
        identityCapability,
        installationIdentityGenerationId,
        unsignedPayload,
      ),
  };
  return {
    ...receipt,
    contentDigest:
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptContentDigestReferenceCandidateV1(
        payload,
      ),
    payload,
  } as ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1;
}

type ReceiptReferenceOutcomeV1 =
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1[
    "payload"
  ]["referenceOutcome"];
type NotCommittedObservedHighWaterV1 = Extract<
  ReceiptReferenceOutcomeV1,
  { readonly outcome: "not_committed" }
>["observedHighWater"];

async function resignNotCommittedReceiptV1(
  receipt: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1,
  changes: Readonly<{
    readonly linearizationOrdinal?: number;
    readonly observedHighWater?: NotCommittedObservedHighWaterV1;
  }>,
): Promise<ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1> {
  if (receipt.payload.referenceOutcome.outcome !== "not_committed") {
    throw new Error("expected not-committed receipt");
  }
  const unsignedPayload = {
    profile: receipt.payload.profile,
    installationIdentityGenerationId:
      receipt.payload.installationIdentityGenerationId,
    operationNonce: receipt.payload.operationNonce,
    requestContentDigest: receipt.payload.requestContentDigest,
    linearizationOrdinal: changes.linearizationOrdinal ??
      receipt.payload.linearizationOrdinal,
    requestReferenceProjection: receipt.payload.requestReferenceProjection,
    referenceOutcome: {
      ...receipt.payload.referenceOutcome,
      observedHighWater: changes.observedHighWater ??
        receipt.payload.referenceOutcome.observedHighWater,
    },
    resolvedAt: receipt.payload.resolvedAt,
  };
  const payload = {
    ...unsignedPayload,
    receiptToken:
      await deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptTokenWithIdentityCapabilityInternalV1(
        identityCapability,
        installationIdentityGenerationId,
        unsignedPayload,
      ),
  };
  return {
    ...receipt,
    contentDigest:
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptContentDigestReferenceCandidateV1(
        payload,
      ),
    payload,
  } as ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1;
}

async function expectFloorCorruptionRejectedV1(
  state: ReturnType<
    typeof inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1
  >,
  receiptIndex: number,
  corruptedFloors: typeof floors,
): Promise<void> {
  if (state.namespace.state !== "current") throw new Error("unreachable");
  const receipts:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1[] = [];
  for (
    let index = 0;
    index < state.receiptLedger.entries.length;
    index += 1
  ) {
    receipts[index] = state.receiptLedger.entries[index]!.receipt;
  }
  const resigned = await resignCommittedReceiptFloorsV1(
    receipts[receiptIndex]!,
    corruptedFloors,
  );
  receipts[receiptIndex] = resigned;
  const currentHighWater = receiptIndex === receipts.length - 1
    ? resigned.payload.referenceOutcome.outcome === "committed"
      ? resigned.payload.referenceOutcome.committedHighWater
      : state.namespace.currentRead.highWater
    : state.namespace.currentRead.highWater;
  const corruptedState = {
    namespace: {
      ...state.namespace,
      currentRead: {
        ...state.namespace.currentRead,
        highWater: currentHighWater,
      },
    },
    receiptLedger:
      createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerCandidateInternalV1({
        installationIdentityGenerationId,
        receipts,
      }),
  };
  await expect(
    mintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1({
      identityVerificationCapability: identityCapability,
      initialState: corruptedState,
      retainedNonAcceptanceTrustHistoryLogicalBytes: 0,
    }),
  ).rejects.toMatchObject({
    stage: "acceptance_namespace",
    reason: "namespace_integrity_failed",
  });
}

describe("D-40 Acceptance compare-append private reference machine", () => {
  it("classifies every normal-update admission scalar at B-1/B/B+1", () => {
    const receiptCountBoundary = 4_096 - 8;
    const generationCountBoundary = 4_096 - 8;
    const receiptTotalBoundary = 67_108_864 - 4_194_304;
    const totalTrustBoundary = 268_435_456 - 4_194_304;
    const base = {
      acceptanceGenerationCount: 0,
      acceptanceReceiptCount: 0,
      acceptanceReceiptLogicalBytes: 0,
      singleAcceptanceReceiptLogicalBytes: 0,
      singleAcceptanceGenerationLogicalBytes: 0,
      singleAcceptanceHighWaterLogicalBytes: 0,
      totalTrustHistoryLogicalBytes: 0,
    };
    const vectors = [
      ["acceptanceReceiptCount", receiptCountBoundary,
        "acceptance_receipt_count_exhausted"],
      ["acceptanceGenerationCount", generationCountBoundary,
        "acceptance_generation_count_exhausted"],
      ["acceptanceReceiptLogicalBytes", receiptTotalBoundary,
        "acceptance_receipt_logical_bytes_exhausted"],
      ["singleAcceptanceReceiptLogicalBytes", 1_048_576,
        "single_acceptance_receipt_too_large"],
      ["singleAcceptanceGenerationLogicalBytes", 4_194_304,
        "single_acceptance_generation_too_large"],
      ["singleAcceptanceHighWaterLogicalBytes", 4_194_304,
        "single_acceptance_high_water_too_large"],
      ["totalTrustHistoryLogicalBytes", totalTrustBoundary,
        "total_trust_history_logical_bytes_exhausted"],
    ] as const;
    for (let index = 0; index < vectors.length; index += 1) {
      const [key, boundary, exhausted] = vectors[index]!;
      expect(classifyProviderStrongReadyBootstrapOrSteadyAcceptanceAdmissionScalarsInternalV1({
        ...base,
        [key]: boundary - 1,
      })).toBe("admitted");
      expect(classifyProviderStrongReadyBootstrapOrSteadyAcceptanceAdmissionScalarsInternalV1({
        ...base,
        [key]: boundary,
      })).toBe("admitted");
      expect(classifyProviderStrongReadyBootstrapOrSteadyAcceptanceAdmissionScalarsInternalV1({
        ...base,
        [key]: boundary + 1,
      })).toBe(exhausted);
    }
  });

  it("mints a null-prototype frozen zero-key capability and commits one atomic genesis closure", async () => {
    const machine = await machineV1();
    expect(Object.getPrototypeOf(machine)).toBeNull();
    expect(Object.isFrozen(machine)).toBe(true);
    expect(Reflect.ownKeys(machine)).toEqual([]);

    const request = await requestV1("1".repeat(32));
    const result = await executeV1(machine, request);
    expect(result).toMatchObject({
      resolution: "resolved",
      receipt: {
        payload: { referenceOutcome: { outcome: "committed" } },
      },
    });
    const state = inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(
      machine,
    );
    expect(state.namespace.state).toBe("current");
    expect(state.receiptLedger.entries).toHaveLength(1);
    expect(state.receiptLedger).toMatchObject({
      profile:
        "provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_receipt_ledger_reference_candidate_v1",
      installationIdentityGenerationId,
      receiptCount: 1,
    });
    if (state.namespace.state !== "current") throw new Error("unreachable");
    expect(state.namespace.generations).toHaveLength(1);
    expect(state.namespace.currentRead.enumeration.entries).toHaveLength(1);
    expect(state.namespace.currentRead.highWater.payload.highWaterRevision)
      .toBe(1);
    expect(Object.isFrozen(state)).toBe(true);
  });

  it("replays same-nonce same-request byte-equivalently and rejects different digest without calling the transaction", async () => {
    const machine = await machineV1();
    const request = await requestV1("2".repeat(32));
    const firstTransaction = vi.fn(async () => commitDecisionV1(request));
    const first = await executeV1(machine, request, firstTransaction);

    const replayTransaction = vi.fn(() => {
      throw new Error("existing nonce must short-circuit");
    });
    const replay = await executeV1(
      machine,
      request,
      replayTransaction,
      "2026-08-13T02:00:00Z",
    );
    expect(JSON.stringify(replay)).toBe(JSON.stringify(first));
    expect(replayTransaction).not.toHaveBeenCalled();

    const changed = {
      ...request,
      expected: {
        state: "genesis" as const,
        expectedNamespaceState: "absent" as const,
      },
      candidate: await candidateV1(),
    };
    changed.candidate = {
      ...changed.candidate,
      acceptedAt: "2026-08-13T00:00:09Z",
      payload: {
        ...changed.candidate.payload,
        acceptedAt: "2026-08-13T00:00:09Z",
      },
    } as ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1;
    changed.candidate.payload.acceptanceToken =
      await deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
        identityCapability,
        installationIdentityGenerationId,
        changed.candidate.payload,
      );
    changed.candidate.contentDigest =
      deriveProviderStrongReadyAcceptanceStateContentDigestV1(
        changed.candidate.payload,
      );
    expect(
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1(
        changed,
      ),
    ).not.toBe(
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1(
        request,
      ),
    );
    const mismatchTransaction = vi.fn(() => {
      throw new Error("mismatch must short-circuit");
    });
    const mismatch = await executeV1(
      machine,
      changed,
      mismatchTransaction,
    );
    expect(mismatch).toMatchObject({
      resolution: "request_rejected",
      reason: "operation_nonce_request_mismatch",
    });
    expect(mismatchTransaction).not.toHaveBeenCalled();
    expect(
      inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(machine)
        .receiptLedger.entries,
    ).toHaveLength(1);
  });

  it("linearizes two new nonces with the same expected absent state so exactly one commits", async () => {
    const machine = await machineV1();
    const firstRequest = await requestV1("3".repeat(32));
    const secondRequest = {
      ...firstRequest,
      operationNonce: "4".repeat(32),
    } as ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1;
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstTransaction = vi.fn(async () => {
      await firstGate;
      return commitDecisionV1(firstRequest);
    });
    const secondTransaction = vi.fn(async () => commitDecisionV1(secondRequest));

    const first = executeV1(machine, firstRequest, firstTransaction);
    const second = executeV1(machine, secondRequest, secondTransaction);
    await Promise.resolve();
    expect(secondTransaction).not.toHaveBeenCalled();
    releaseFirst();

    await expect(first).resolves.toMatchObject({
      receipt: { payload: { referenceOutcome: { outcome: "committed" } } },
    });
    await expect(second).resolves.toMatchObject({
      receipt: {
        payload: {
          referenceOutcome: {
            outcome: "not_committed",
            reason: "expected_current_changed",
          },
        },
      },
    });
    expect(secondTransaction).not.toHaveBeenCalled();
    const state = inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(
      machine,
    );
    expect(state.receiptLedger.entries).toHaveLength(2);
    if (state.namespace.state !== "current") throw new Error("unreachable");
    expect(state.namespace.generations).toHaveLength(1);
  });

  it("replays signed receipt ordinals and rejects a not-committed receipt that caches a later high-water", async () => {
    const machine = await machineV1();
    const firstRequest = await requestV1("31".repeat(16));
    await executeV1(machine, firstRequest);
    const afterCommit =
      inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(
        machine,
      );
    const staleRequest = {
      ...firstRequest,
      operationNonce: "32".repeat(16),
    } as ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1;
    await executeV1(machine, staleRequest);
    const afterNotCommitted =
      inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(
        machine,
      );
    const successorRequest = await successorRequestV1(
      afterNotCommitted,
      "33".repeat(16),
    );
    await executeV1(machine, successorRequest);
    const finalState =
      inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(
        machine,
      );
    expect(finalState.receiptLedger.entries.map((entry) =>
      entry.receipt.payload.referenceOutcome.outcome)).toEqual([
      "committed",
      "not_committed",
      "committed",
    ]);
    if (
      afterCommit.namespace.state !== "current" ||
      finalState.namespace.state !== "current"
    ) throw new Error("unreachable");
    expect(finalState.namespace.generations).toHaveLength(2);
    expect(finalState.namespace.currentRead.highWater.payload.highWaterRevision)
      .toBe(2);
    const reconstructedMachine =
      await mintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1({
        identityVerificationCapability: identityCapability,
        initialState: finalState,
        retainedNonAcceptanceTrustHistoryLogicalBytes: 0,
      });
    expect(
      inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(
        reconstructedMachine,
      ),
    ).toEqual(finalState);

    const receipts = finalState.receiptLedger.entries.map((entry) =>
      entry.receipt);
    receipts[1] = await resignNotCommittedReceiptV1(receipts[1]!, {
      observedHighWater: {
        state: "trusted",
        highWater: finalState.namespace.currentRead.highWater,
      },
    });
    const laterObservedState = {
      ...finalState,
      receiptLedger:
        createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerCandidateInternalV1({
          installationIdentityGenerationId,
          receipts,
        }),
    };
    await expect(
      mintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1({
        identityVerificationCapability: identityCapability,
        initialState: laterObservedState,
        retainedNonAcceptanceTrustHistoryLogicalBytes: 0,
      }),
    ).rejects.toMatchObject({
      stage: "acceptance_namespace",
      reason: "namespace_integrity_failed",
    });

    receipts[1] = await resignNotCommittedReceiptV1(
      finalState.receiptLedger.entries[1]!.receipt,
      { linearizationOrdinal: 3 },
    );
    const wrongOrdinalState = {
      ...finalState,
      receiptLedger:
        createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerCandidateInternalV1({
          installationIdentityGenerationId,
          receipts,
        }),
    };
    await expect(
      mintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1({
        identityVerificationCapability: identityCapability,
        initialState: wrongOrdinalState,
        retainedNonAcceptanceTrustHistoryLogicalBytes: 0,
      }),
    ).rejects.toMatchObject({
      stage: "acceptance_receipt_ledger",
      reason: "ledger_integrity_failed",
    });
  });

  it("captures the full state adjacent to already-pending work before a later execute", async () => {
    const machine = await machineV1();
    const firstRequest = await requestV1("a".repeat(32));
    const secondRequest = {
      ...firstRequest,
      operationNonce: "b".repeat(32),
    } as ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1;
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = executeV1(machine, firstRequest, vi.fn(async () => {
      await firstGate;
      return commitDecisionV1(firstRequest);
    }));
    const adjacentState =
      captureProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineStateAfterPendingInternalV1(
        machine,
      );
    const second = executeV1(
      machine,
      secondRequest,
      vi.fn(async () => commitDecisionV1(secondRequest)),
    );
    releaseFirst();

    await expect(first).resolves.toMatchObject({ resolution: "resolved" });
    await expect(adjacentState).resolves.toMatchObject({
      receiptLedger: { receiptCount: 1 },
    });
    await expect(second).resolves.toMatchObject({
      receipt: {
        payload: {
          referenceOutcome: {
            outcome: "not_committed",
            reason: "expected_current_changed",
          },
        },
      },
    });
    const captured = await adjacentState;
    expect(captured.receiptLedger.entries[0]!.operationNonce)
      .toBe(firstRequest.operationNonce);
    expect(
      inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(machine)
        .receiptLedger.receiptCount,
    ).toBe(2);
  });

  it("rejects signed high-water floor overstatement and prefix rollback", async () => {
    const machine = await machineV1();
    const firstRequest = await requestV1("c".repeat(32));
    await executeV1(machine, firstRequest);
    const firstState =
      inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(machine);
    await expectFloorCorruptionRejectedV1(firstState, 0, {
      rootMetadataGeneration: 2,
      registryManifestGeneration: 1,
      supportCatalogGeneration: 1,
    });

    if (firstState.namespace.state !== "current") throw new Error("unreachable");
    const previous = firstState.namespace.generations[0]!;
    const candidate = await candidateV1(
      2,
      {
        state: "acceptance",
        generationId: previous.generationId,
        contentDigest: previous.contentDigest,
      },
      floors,
    );
    const current = firstState.namespace.currentRead.highWater;
    const secondRequest = {
      profile: "provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_request_reference_candidate_v1",
      operationNonce: "d".repeat(32),
      installationIdentityGenerationId,
      expected: {
        state: "current",
        highWaterRevision: current.payload.highWaterRevision,
        highWaterContentDigest: current.contentDigest,
        currentVersionToken: current.currentVersionToken,
        generationCount: current.payload.generationCount,
        generationSetDigest: current.payload.generationSetDigest,
      },
      candidate,
    } as ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1;
    await executeV1(
      machine,
      secondRequest,
      vi.fn(async () => ({
        classification: "committed" as const,
        candidate,
        acceptedGenerationFloors: {
          rootMetadataGeneration: 1,
          registryManifestGeneration: 1,
          supportCatalogGeneration: 1,
        },
      })),
    );
    const secondState =
      inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(machine);
    await expectFloorCorruptionRejectedV1(secondState, 1, {
      rootMetadataGeneration: 2,
      registryManifestGeneration: 1,
      supportCatalogGeneration: 1,
    });
  });

  it("persists candidate_invalid as receipt-only and leaves the namespace exactly unchanged", async () => {
    const machine = await machineV1();
    const before = inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(
      machine,
    );
    const request = await requestV1("5".repeat(32));
    const result = await executeV1(
      machine,
      request,
      vi.fn(async () => ({ classification: "candidate_invalid" as const })),
    );
    expect(result).toMatchObject({
      receipt: {
        payload: {
          referenceOutcome: {
            outcome: "not_committed",
            reason: "candidate_invalid",
            observedHighWater: { state: "absent" },
          },
        },
      },
    });
    const after = inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(
      machine,
    );
    expect(after.namespace).toEqual(before.namespace);
    expect(after.receiptLedger.entries).toHaveLength(1);
  });

  it("freezes all four compound not-committed precedence vectors", async () => {
    const integrityMachine = await mintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1({
      identityVerificationCapability: identityCapability,
      initialState: {
        namespace: {
          state: "integrity_failed",
          evidenceDigest: ContentDigestV1Schema.parse(digest("0")),
        },
        receiptLedger:
          createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerCandidateInternalV1({
            installationIdentityGenerationId,
            receipts: [],
          }),
      },
      retainedNonAcceptanceTrustHistoryLogicalBytes: 0,
    });
    const integrityRequest = await requestV1("51".repeat(16));
    const integrityCallback = vi.fn(async () => ({
      classification: "candidate_invalid" as const,
    }));
    await expect(executeV1(
      integrityMachine,
      integrityRequest,
      integrityCallback,
    )).resolves.toMatchObject({
      receipt: { payload: { referenceOutcome: {
        outcome: "not_committed",
        reason: "namespace_integrity_failed",
      } } },
    });
    expect(integrityCallback).not.toHaveBeenCalled();

    const expectedMachine = await machineV1();
    const committedRequest = await requestV1("52".repeat(16));
    await executeV1(expectedMachine, committedRequest);
    const staleRequest = {
      ...committedRequest,
      operationNonce: "53".repeat(16),
    } as ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1;
    const expectedCallback = vi.fn(async () => ({
      classification: "candidate_invalid" as const,
    }));
    await expect(executeV1(
      expectedMachine,
      staleRequest,
      expectedCallback,
    )).resolves.toMatchObject({
      receipt: { payload: { referenceOutcome: {
        outcome: "not_committed",
        reason: "expected_current_changed",
      } } },
    });
    expect(expectedCallback).not.toHaveBeenCalled();

    const highFloors = {
      rootMetadataGeneration: 2,
      registryManifestGeneration: 2,
      supportCatalogGeneration: 2,
    } as const;
    const highFloorMachine = await machineV1();
    const highFloorRequest = {
      ...(await requestV1("54".repeat(16))),
      candidate: await candidateV1(1, { state: "genesis" }, highFloors),
    } as ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1;
    await executeV1(highFloorMachine, highFloorRequest, vi.fn(async () => ({
      classification: "committed" as const,
      candidate: highFloorRequest.candidate,
      acceptedGenerationFloors: highFloors,
    })));
    const highFloorState =
      inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(
        highFloorMachine,
      );
    const regressedRequest = await successorRequestV1(
      highFloorState,
      "55".repeat(16),
      floors,
    );
    await expect(executeV1(
      highFloorMachine,
      regressedRequest,
      vi.fn(async () => ({ classification: "candidate_invalid" as const })),
    )).resolves.toMatchObject({
      receipt: { payload: { referenceOutcome: {
        outcome: "not_committed",
        reason: "candidate_invalid",
      } } },
    });

    const floorMachine = await mintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1({
      identityVerificationCapability: identityCapability,
      initialState: highFloorState,
      retainedNonAcceptanceTrustHistoryLogicalBytes: 0,
    });
    await expect(executeV1(
      floorMachine,
      regressedRequest,
      vi.fn(async () => ({
        classification: "committed" as const,
        candidate: regressedRequest.candidate,
        acceptedGenerationFloors: floors,
      })),
    )).resolves.toMatchObject({
      receipt: { payload: { referenceOutcome: {
        outcome: "not_committed",
        reason: "generation_floor_regressed",
      } } },
    });
  });

  it("rejects tampered sealed-set commitment without invoking a transaction", async () => {
    const machine = await machineV1();
    const request = await requestV1("e".repeat(32));
    await executeV1(machine, request);
    const state =
      inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(machine);
    const callback = vi.fn(async () => commitDecisionV1(request));
    await expect(
      mintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1({
        identityVerificationCapability: identityCapability,
        initialState: {
          ...state,
          receiptLedger: {
            ...state.receiptLedger,
            receiptSetDigest: ContentDigestV1Schema.parse(digest("f")),
          },
        },
        retainedNonAcceptanceTrustHistoryLogicalBytes: 0,
      }),
    ).rejects.toMatchObject({
      stage: "acceptance_receipt_ledger",
      reason: "ledger_integrity_failed",
    });
    expect(callback).not.toHaveBeenCalled();
  });

  it("publishes no partial state when the callback fails operationally", async () => {
    const machine = await machineV1();
    const request = await requestV1("6".repeat(32));
    const before = inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(
      machine,
    );
    await expect(
      executeV1(machine, request, vi.fn(async () => {
        throw new Error("transaction unavailable");
      })),
    ).rejects.toThrow("transaction unavailable");
    expect(
      inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(machine),
    ).toEqual(before);
  });

  it("rejects cross-machine capability substitution before invoking a callback", async () => {
    const first = await machineV1();
    const second = await machineV1();
    const request = await requestV1("7".repeat(32));
    const callback = vi.fn(async () => commitDecisionV1(request));
    await expect(
      executeProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1({
        identityVerificationCapability: identityCapability,
        referenceMachineCapability: Object.freeze(Object.create(null)),
        request,
        resolvedAt: "2026-08-13T01:00:00Z",
        transaction: callback,
      } as never),
    ).rejects.toMatchObject({
      stage: "reference_machine_capability",
      reason: "capability_invalid",
    });
    expect(callback).not.toHaveBeenCalled();
    expect(
      inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(first),
    ).toEqual(
      inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(second),
    );
  });

  it("does not late-bind poisoned Map or Set constructors during replay", async () => {
    const machine = await machineV1();
    const request = await requestV1("8".repeat(32));
    const first = await executeV1(machine, request);
    const originalMap = globalThis.Map;
    const originalSet = globalThis.Set;
    let poisonHits = 0;
    let callbackHits = 0;
    let replay: Awaited<ReturnType<typeof executeV1>> | undefined;
    try {
      Object.defineProperty(globalThis, "Map", {
        configurable: true,
        writable: true,
        value: class PoisonedMap extends CapturedMapV1 {
          constructor() {
            super();
            poisonHits += 1;
            throw new Error("poisoned Map");
          }
        },
      });
      Object.defineProperty(globalThis, "Set", {
        configurable: true,
        writable: true,
        value: class PoisonedSet extends CapturedSetV1 {
          constructor() {
            super();
            poisonHits += 1;
            throw new Error("poisoned Set");
          }
        },
      });
      const callback = () => {
        callbackHits += 1;
        throw new Error("replay must not call transaction");
      };
      replay = await executeV1(machine, request, callback);
    } finally {
      Object.defineProperty(globalThis, "Map", {
        configurable: true,
        writable: true,
        value: originalMap,
      });
      Object.defineProperty(globalThis, "Set", {
        configurable: true,
        writable: true,
        value: originalSet,
      });
    }
    expect(replay).toEqual(first);
    expect(callbackHits).toBe(0);
    expect(poisonHits).toBe(0);
  });

  it("commits without consulting a poisoned Array iterator", async () => {
    const machine = await machineV1();
    const firstRequest = await requestV1("81".repeat(16));
    await executeV1(machine, firstRequest);
    const preState =
      inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(
        machine,
      );
    const request = await successorRequestV1(preState, "82".repeat(16));
    let armed = false;
    const transaction = vi.fn(async () => {
      armed = true;
      return commitDecisionV1(request);
    });
    const resolvedAt = ProviderRegistryIsoTimestampV1Schema.parse(
      "2026-08-13T01:00:00Z",
    );
    const descriptor = Object.getOwnPropertyDescriptor(
      Array.prototype,
      Symbol.iterator,
    );
    if (descriptor === undefined) throw new Error("missing Array iterator");
    let poisonHits = 0;
    let result: Awaited<ReturnType<typeof executeV1>> | undefined;
    try {
      Object.defineProperty(Array.prototype, Symbol.iterator, {
        configurable: true,
        writable: true,
        value(this: readonly unknown[]) {
          const first = this[0] as Readonly<Record<string, unknown>> | undefined;
          if (
            armed &&
            this.length === 1 &&
            (first?.recordType === "provider_acceptance_state" ||
              first?.locatorProfile ===
                "installation_provider_acceptance_state_v1")
          ) {
            poisonHits += 1;
            throw new Error("poisoned retained Array iterator");
          }
          return Reflect.apply(descriptor.value as Function, this, []);
        },
      });
      result = await executeProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1({
        identityVerificationCapability: identityCapability,
        referenceMachineCapability: machine,
        request,
        resolvedAt,
        transaction,
      });
    } finally {
      Object.defineProperty(Array.prototype, Symbol.iterator, descriptor);
    }
    expect(result).toMatchObject({
      receipt: { payload: { referenceOutcome: { outcome: "committed" } } },
    });
    expect(poisonHits).toBe(0);
    expect(transaction).toHaveBeenCalledOnce();
    expect(
      inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(
        machine,
      ).receiptLedger.receiptCount,
    ).toBe(2);
  });

  it("accounts retained generation, high-water, and enumeration bytes against the total reserve", async () => {
    const sourceMachine = await machineV1();
    const request = await requestV1("1f".repeat(16));
    await executeV1(sourceMachine, request);
    const retainedState =
      inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(
        sourceMachine,
      );
    if (retainedState.namespace.state !== "current") {
      throw new Error("unreachable");
    }
    const encoder = new TextEncoder();
    const canonicalBytes = (value: object) =>
      encoder.encode(JSON.stringify(value)).byteLength;
    const acceptanceBytes = retainedState.receiptLedger.receiptLogicalBytes +
      canonicalBytes(retainedState.namespace.generations[0]!) +
      canonicalBytes(retainedState.namespace.currentRead.highWater) +
      canonicalBytes(retainedState.namespace.currentRead.enumeration);
    const machine = await mintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(
      {
        identityVerificationCapability: identityCapability,
        initialState: retainedState,
        retainedNonAcceptanceTrustHistoryLogicalBytes:
          268_435_456 - 4_194_304 - acceptanceBytes,
      },
    );
    const nextRequest = {
      ...request,
      operationNonce: "2f".repeat(16),
    } as ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1;
    const callback = vi.fn(async () => commitDecisionV1(nextRequest));
    await expect(executeV1(machine, nextRequest, callback)).rejects.toMatchObject({
      stage: "acceptance_capacity",
      reason: "receipt_capacity_exhausted",
    });
    expect(callback).not.toHaveBeenCalled();
  });

  it("binds non-Acceptance history accounting into the private machine and preserves the 4 MiB total-history reserve", async () => {
    const machine = await mintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(
      {
        identityVerificationCapability: identityCapability,
        initialState: {
          namespace: { state: "absent" },
          receiptLedger:
            createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerCandidateInternalV1({
              installationIdentityGenerationId,
              receipts: [],
            }),
        },
        retainedNonAcceptanceTrustHistoryLogicalBytes:
          268_435_456 - 4_194_304,
      },
    );
    const request = await requestV1("9".repeat(32));
    const callback = vi.fn(async () => commitDecisionV1(request));
    await expect(executeV1(machine, request, callback)).rejects.toMatchObject({
      stage: "acceptance_capacity",
      reason: "receipt_capacity_exhausted",
    });
    expect(callback).not.toHaveBeenCalled();
    expect(
      inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(
        machine,
      ),
    ).toEqual({
      namespace: { state: "absent" },
      receiptLedger:
        createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerCandidateInternalV1({
          installationIdentityGenerationId,
          receipts: [],
        }),
    });
  });
});
