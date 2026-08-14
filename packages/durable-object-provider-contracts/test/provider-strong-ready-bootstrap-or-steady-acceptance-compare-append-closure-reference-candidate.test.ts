import { createHash, createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

const d39SeamV1 = vi.hoisted(() => ({
  diagnose: vi.fn(),
  selections: new WeakMap<object, unknown>(),
  consumed: new WeakMap<object, () => void>(),
}));

vi.mock(
  "../src/provider-trusted-local-physical-target-selection-candidate.js",
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import("../src/provider-trusted-local-physical-target-selection-candidate.js")
    >();
    d39SeamV1.diagnose.mockImplementation(async (input: {
      physicalTargetObservationCapability: object;
    }) => {
      const capability = input.physicalTargetObservationCapability;
      d39SeamV1.consumed.get(capability)?.();
      const value = d39SeamV1.selections.get(capability);
      return value === undefined
        ? { ok: false, stage: "physical_target_selection", reason: "capability_invalid" }
        : { ok: true, value };
    });
    return {
      ...actual,
      diagnoseProviderTrustedLocalPhysicalTargetCandidateV1:
        d39SeamV1.diagnose,
    };
  },
);

import type { ProviderCryptoHostV1 } from "../src/domain-crypto.js";
import {
  InstallationIdentityGenerationIdV1Schema,
  KeyedStateTokenV1Schema,
  LowerHex32V1Schema,
} from "../src/primitives.js";
import {
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureInvalidReasonReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureInvalidStageReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateValidationError,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureValidationReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureStateReferenceCandidateV1Schema,
  createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1,
  diagnoseCreateProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1,
  type CreateProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1Input,
} from "../src/provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-closure-reference-candidate.js";
import type {
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1,
} from "../src/provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-reference-candidate-wire.js";
import {
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptContentDigestReferenceCandidateV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptPinReferenceCandidateV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationSetDigestReferenceCandidateV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterContentDigestReferenceCandidateV1,
} from "../src/provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-reference-candidate-wire.js";
import {
  deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptTokenWithIdentityCapabilityInternalV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenWithIdentityCapabilityInternalV1,
  mintProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
} from "../src/provider-strong-ready-bootstrap-or-steady-acceptance-identity-verification-capability-internal.js";
import {
  createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerCandidateInternalV1,
  inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1,
  mintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1,
} from "../src/provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-reference-machine-internal.js";
import {
  deriveInstallationIdentityGenerationIdV1,
  deriveInstallationIdentityKeyCheckTokenV1,
} from "../src/provider-foundation.js";
import {
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
  type ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
} from "../src/provider-strong-ready-acceptance-candidate.js";
import {
  deriveStoreDurableObjectProviderPolicyDigestV1,
  StoreDurableObjectProviderPolicyV1Schema,
} from "../src/provider-runtime-attestation-point.js";
import {
  ProviderRegistryIsoTimestampV1Schema,
} from "../src/provider-registry-trust.js";
import {
  type ProviderTrustedLocalPhysicalTargetObservationCapabilityV1,
  type ProviderTrustedLocalPhysicalTargetSelectionCandidateValidationV1,
} from "../src/provider-trusted-local-physical-target-selection-candidate.js";

const cryptoHost: ProviderCryptoHostV1 = Object.freeze({
  sha256(message: Uint8Array) {
    return new Uint8Array(createHash("sha256").update(message).digest());
  },
  hmacSha256(key: Uint8Array, message: Uint8Array) {
    return new Uint8Array(
      createHmac("sha256", key).update(message).digest(),
    );
  },
});
const initializationNonce = LowerHex32V1Schema.parse(
  "000102030405060708090a0b0c0d0e0f",
);
const installationIdentityGenerationId =
  InstallationIdentityGenerationIdV1Schema.parse(
    "installation-identity-generation:4fe634940e20afac35e02d",
  );
const keyCheckToken = KeyedStateTokenV1Schema.parse(
  "hmac-sha256:9b585cbb13d23ae739df3988278dfdc09ed612ccd8af853ac26f570bc8ce2eef",
);
const identityKey = new Uint8Array(
  Array.from({ length: 32 }, (_value, index) => index),
);
const digest = (nibble: string) => `sha256:${nibble.repeat(64)}` as const;
const providerId = "durable-object-provider:native-b";
const target = Object.freeze({
  targetProfileId: `provider-target-profile:${"1".repeat(64)}`,
  osPlatform: "linux" as const,
  osReleaseFamilyCode: `provider-os-family:${"2".repeat(22)}`,
  osBuildDigest: digest("3"),
  architecture: "x86_64" as const,
  filesystemProfileCode: `provider-fs-profile:${"4".repeat(22)}`,
  filesystemFeatureProfileDigest: digest("5"),
  mountOptionProfileDigest: digest("6"),
});
const rootPin = Object.freeze({
  locatorProfile: "installation_provider_registry_root_metadata_v1" as const,
  rootGeneration: 2,
  rootKeyId: "7".repeat(22),
  contentDigest: digest("8"),
});
const registryPin = Object.freeze({
  locatorProfile: "installation_provider_registry_manifest_v1" as const,
  manifestGeneration: 3,
  generationId: `provider-registry-manifest:${"9".repeat(22)}`,
  contentDigest: digest("a"),
});
const catalogPin = Object.freeze({
  locatorProfile:
    "distribution_provider_feasibility_support_catalog_v1" as const,
  catalogGeneration: 4,
  contentDigest: digest("b"),
});
const evidencePin = Object.freeze({
  locatorProfile: "installation_provider_feasibility_evidence_v1" as const,
  evidenceId: `provider-feasibility-evidence:${"c".repeat(22)}`,
  contentDigest: digest("d"),
});
const policy = StoreDurableObjectProviderPolicyV1Schema.parse({
  profile: "store_durable_object_provider_policy_v1",
  protocolVersion: 1,
  providerId,
  ipcPeerAuthenticationPolicyDigest: digest("0"),
  isolation: {
    kind: "separate_os_principal",
    securityBoundaryProfileDigest: digest("1"),
  },
  sourceNamespaceVisibility: "inaccessible_to_workspace_writer",
  supportedStagingObjectKinds: ["regular", "directory"],
  stagingRecovery:
    "opaque_locator_idempotent_allocate_or_reopen_exact_unpublished_object_across_restart",
  durableIdentity: "same_object_stable_aba_recreate_distinct_across_restart",
  publishSemantics:
    "exact_opened_object_no_replace_with_atomic_bound_root_containment",
  externalIntentStateSemantics:
    "atomic_monotonic_compare_replace_with_restart_receipt_and_handoff_cut",
  handoffJournalSemantics:
    "immutable_no_replace_compare_tip_complete_enumeration_prospective_sealed_version_atomic_seal",
  storeManifestCompareAppendReceiptLedger: {
    profile: "store_manifest_compare_append_receipt_ledger_policy_v1",
    locatorProfile: "store_manifest_compare_append_receipt_v1",
    storageBoundary: "provider_isolated_non_store_namespace",
    appendSemantics:
      "immutable_no_replace_by_repository_worktree_operation_nonce",
    maxReceiptCountPerRepositoryWorktree: 16_384,
    maxReceiptLogicalBytesPerRepositoryWorktree: 67_108_864,
    maxSingleReceiptLogicalBytes: 1_048_576,
    admission:
      "freeze_resolved_at_and_complete_signed_receipt_then_reserve_exact_count_and_canonical_bytes_before_atomic_namespace_commit",
    quotaAccounting: "excluded_from_private_store_quota_root",
  },
  deleteSemantics:
    "exact_opened_object_atomic_compare_delete_with_containment",
  stockSameUidFilesystemFallback: "forbidden",
  realFilesystemConformanceSuiteDigest: digest("2"),
});
const policyDigest = deriveStoreDurableObjectProviderPolicyDigestV1(policy);
const runtimePin = Object.freeze({
  profile: "store_durable_object_provider_runtime_attestation_pin_v1" as const,
  contentDigest: digest("3"),
  payload: Object.freeze({ providerId }),
});
const catalogCandidate = Object.freeze({
  providerId,
  providerFeasibilityEvidence: evidencePin,
  semanticProviderPolicy: policy,
  runtimeAttestation: runtimePin,
  releaseDisposition: "strong_read_write" as const,
});
const evidence = Object.freeze({
  payload: Object.freeze({
    result: "passed" as const,
    providerId,
    semanticProviderPolicyDigest: policyDigest,
    runtimeAttestationContentDigest: runtimePin.contentDigest,
  }),
});
const candidateClosure = Object.freeze({
  catalogTarget: target,
  catalogCandidate,
  evidencePointClosure: Object.freeze({
    providerFeasibilityEvidence: evidence,
    providerFeasibilityEvidencePin: evidencePin,
    runtimeAttestationPointClosure: Object.freeze({
      semanticProviderPolicyDigest: policyDigest,
      runtimeAttestation: runtimePin,
    }),
  }),
});
const registryEntry = Object.freeze({
  providerId,
  semanticProviderPolicyDigest: policyDigest,
  providerFeasibilityEvidence: evidencePin,
  runtimeAttestation: runtimePin,
  verificationKeys: Object.freeze({
    activeBindingDerivationKeyGeneration: 5,
  }),
});
const writer = Object.freeze({
  targetProfileId: target.targetProfileId,
  providerId,
  registryEntryContentDigest: digest("e"),
  semanticProviderPolicyDigest: policyDigest,
  providerFeasibilityEvidence: evidencePin,
  runtimeAttestationContentDigest: runtimePin.contentDigest,
  bindingDerivationKeyGeneration: 5,
});

let identityCapability: ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
let machineCapability:
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1;

async function resetCapabilitiesV1(): Promise<void> {
  identityCapability =
    await mintProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1({
      initializationNonce,
      installationIdentityGenerationId,
      keyCheckToken,
      installationIdentityKey: identityKey.slice(),
      cryptoHost,
    });
  machineCapability =
    await mintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1({
      identityVerificationCapability: identityCapability,
      initialState: {
        namespace: { state: "absent" },
        receiptLedger:
          createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerCandidateInternalV1(
            {
              installationIdentityGenerationId,
              receipts: [],
            },
          ),
      },
      retainedNonAcceptanceTrustHistoryLogicalBytes: 0,
    });
}

function d39ValidationV1(
  capability: "strong_read_write" | "legacy_redacted_read_only" =
    "strong_read_write",
): ProviderTrustedLocalPhysicalTargetSelectionCandidateValidationV1 {
  return {
    authority:
      "none_provider_trusted_local_physical_target_selection_candidate_only",
    selectedOwnerTargetCapability: { target, capability },
    providerFeasibilitySupportCatalogPin: catalogPin,
    distributionHistoryCandidate: {
      catalogPointClosure: {
        providerFeasibilitySupportCatalogPin: catalogPin,
        providerFeasibilitySupportCatalog: {
          payload: {
            targets: [
              {
                target: {
                  ...target,
                  targetProfileId:
                    `provider-target-profile:${"0".repeat(64)}`,
                },
                candidates: [],
              },
              { target, candidates: [catalogCandidate] },
            ],
          },
        },
        candidateDeepClosures: [candidateClosure],
        registryManifestHistoryClosure: {
          installationIdentityGenerationId,
          currentRootMetadata: rootPin,
          currentRegistryManifest: registryPin,
          registryManifestHistory: [{
            payload: {
              routing: { state: "steady" },
              members: [{
                disposition: "enabled",
                providerId,
                registryEntryContentDigest:
                  writer.registryEntryContentDigest,
                registryEntry,
              }],
            },
          }],
        },
      },
    },
  } as never;
}

function observationCapabilityV1(
  selection = d39ValidationV1(),
  consumed = vi.fn(),
): Promise<ProviderTrustedLocalPhysicalTargetObservationCapabilityV1> {
  const capability = Object.freeze(Object.create(null)) as
    ProviderTrustedLocalPhysicalTargetObservationCapabilityV1;
  d39SeamV1.selections.set(capability as object, selection);
  d39SeamV1.consumed.set(capability as object, consumed);
  return Promise.resolve(capability);
}

async function candidateV1(
  mutateConfiguration?: (configuration: any) => void,
): Promise<ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1> {
  const configuration = {
    state: "strong_ready" as const,
    core: {
      activeRootMetadata: rootPin,
      providerRegistryManifest: registryPin,
      providerSupportCatalog: catalogPin,
      activeWriterSelector: {
        profile: "provider_active_writer_selector_v1" as const,
        selections: [writer],
      },
    },
    activation: { origin: "bootstrap_or_steady_successor" as const },
  };
  mutateConfiguration?.(configuration);
  const generationId = deriveProviderStrongReadyAcceptanceStateGenerationIdV1(
    {
      installationIdentityGenerationId,
      acceptanceOrdinal: 1,
      predecessor: { state: "genesis" },
      configuration,
    },
  );
  const unsigned = {
    profile: "provider_acceptance_state_v1" as const,
    generationId,
    installationIdentityGenerationId,
    acceptanceOrdinal: 1,
    predecessor: { state: "genesis" as const },
    configuration,
    acceptedAt: "2026-08-13T00:00:00Z",
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
  mutateConfiguration?: (configuration: any) => void,
): Promise<ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1> {
  return {
    profile: "provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_request_reference_candidate_v1",
    operationNonce: LowerHex32V1Schema.parse(operationNonce),
    installationIdentityGenerationId,
    expected: { state: "genesis", expectedNamespaceState: "absent" },
    candidate: await candidateV1(mutateConfiguration),
  };
}

function cloneJsonV1<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function rebuildReceiptEnvelopeV1(
  receipt: any,
  capability = identityCapability,
  identity = receipt.installationIdentityGenerationId,
): Promise<void> {
  receipt.payload.receiptToken =
    await deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptTokenWithIdentityCapabilityInternalV1(
      capability,
      identity,
      receipt.payload,
    );
  receipt.contentDigest =
    deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptContentDigestReferenceCandidateV1(
      receipt.payload,
    );
}

async function inputV1(
  request: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1,
  physicalTargetObservationCapability?:
    ProviderTrustedLocalPhysicalTargetObservationCapabilityV1,
): Promise<CreateProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1Input> {
  return {
    distributionHistoryCandidate: {
      bootstrapTrustBundle: {},
      distributionRootBinding: {},
      installationIdentityGenerationId,
      rootMetadataHistory: [],
      registryManifestHistory: [],
      publicSupportTaxonomyHistory: [],
      releaseMatrixHistory: [],
      targetDiscoveryResultHistory: [],
      releaseTargetUniverseHistory: [],
      providerFeasibilitySupportCatalogHistory: [],
      targetDiscoveryFixtureManifests: [],
      targetDiscoveryRunnerRuns: [],
      realFilesystemSuiteManifests: [],
      realFilesystemFixtureCorpusManifests: [],
      providerFeasibilitySupportCandidateArtifacts: [],
      strictCryptoCapability: Object.freeze(Object.create(null)),
    },
    physicalTargetObservationCapability:
      physicalTargetObservationCapability ?? await observationCapabilityV1(),
    acceptanceCompareAppendRequest: request,
    resolvedAt: ProviderRegistryIsoTimestampV1Schema.parse(
      "2026-08-13T01:00:00Z",
    ),
    identityVerificationCapability: identityCapability,
    referenceMachineCapability: machineCapability,
  };
}

describe("D-40 public Acceptance compare-append closure/reference candidate", () => {
  it("commits the exact singleton local writer and returns the exact6 reference closure", async () => {
    await resetCapabilitiesV1();
    const submittedRequest = await requestV1("1".repeat(32));
    const result =
      await diagnoseCreateProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1(
        await inputV1(submittedRequest),
      );
    if (!result.ok) {
      throw new Error(`diagnostic ${result.stage}/${result.reason}`);
    }
    const value = result.value;
    expect(Object.keys(value).sort()).toEqual([
      "acceptanceCompareAppendRequest",
      "authority",
      "compareAppendReceiptPin",
      "compareAppendResult",
      "referenceState",
      "requestContentDigest",
    ]);
    expect(value.authority).toBe(
      "none_provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_closure_reference_candidate_only",
    );
    expect(value.compareAppendResult).toMatchObject({
      resolution: "resolved",
      receipt: {
        payload: { referenceOutcome: { outcome: "committed" } },
      },
    });
    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureValidationReferenceCandidateV1Schema
        .safeParse(value).success,
    ).toBe(true);
    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureStateReferenceCandidateV1Schema
        .safeParse(value.referenceState).success,
    ).toBe(true);
    expect(value.referenceState.namespace).toMatchObject({
      state: "current",
      currentRead: {
        enumeration: { generationCount: 1, namespaceRevision: 1 },
        highWater: { payload: { highWaterRevision: 1 } },
      },
      generations: [value.acceptanceCompareAppendRequest.candidate],
    });
    expect(value.referenceState.receiptLedger).toMatchObject({
      receiptCount: 1,
      entries: [{
        receipt: value.compareAppendResult.resolution === "resolved"
          ? value.compareAppendResult.receipt
          : value.compareAppendResult.existingReceipt,
      }],
    });
    const detached = JSON.parse(JSON.stringify(value));
    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureValidationReferenceCandidateV1Schema
        .safeParse(detached).success,
    ).toBe(true);
    if (detached.referenceState.namespace.state === "current") {
      detached.referenceState.namespace.generations = [];
    }
    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureValidationReferenceCandidateV1Schema
        .safeParse(detached).success,
    ).toBe(false);

    const floorDrift = JSON.parse(JSON.stringify(value));
    const floorDriftNamespace = floorDrift.referenceState.namespace;
    const floorDriftReceipt =
      floorDrift.referenceState.receiptLedger.entries[0].receipt;
    if (
      floorDriftNamespace.state !== "current" ||
      floorDriftReceipt.payload.referenceOutcome.outcome !== "committed"
    ) {
      throw new Error("committed reference fixture lost its current closure");
    }
    const floorDriftHighWater =
      floorDriftReceipt.payload.referenceOutcome.committedHighWater;
    floorDriftHighWater.payload.acceptedGenerationFloors
      .rootMetadataGeneration += 1;
    floorDriftHighWater.contentDigest =
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterContentDigestReferenceCandidateV1(
        floorDriftHighWater.payload,
      );
    floorDriftNamespace.currentRead.highWater =
      JSON.parse(JSON.stringify(floorDriftHighWater));
    floorDriftReceipt.contentDigest =
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptContentDigestReferenceCandidateV1(
        floorDriftReceipt.payload,
      );
    floorDrift.referenceState.receiptLedger =
      createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerCandidateInternalV1({
        installationIdentityGenerationId,
        receipts: [floorDriftReceipt],
      });
    floorDrift.compareAppendResult.receipt = floorDriftReceipt;
    floorDrift.compareAppendReceiptPin =
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptPinReferenceCandidateV1(
        floorDriftReceipt,
      );
    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureValidationReferenceCandidateV1Schema
        .safeParse(floorDrift).success,
    ).toBe(false);
    expect(Object.isFrozen(value)).toBe(true);
  });

  it("rejects a fully rebuilt cross-identity receipt/current closure", async () => {
    await resetCapabilitiesV1();
    const result =
      await createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1(
        await inputV1(await requestV1("8".repeat(32))),
      );
    const rebuilt = cloneJsonV1(result);
    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureStateReferenceCandidateV1Schema
        .safeParse(rebuilt.referenceState).success,
    ).toBe(true);
    const foreignInitializationNonce = LowerHex32V1Schema.parse(
      "f0".repeat(16),
    );
    const foreignIdentity = await deriveInstallationIdentityGenerationIdV1(
      { initializationNonce: foreignInitializationNonce },
      cryptoHost,
    );
    const foreignIdentityKey = new Uint8Array(
      Array.from({ length: 32 }, (_value, index) => 255 - index),
    );
    const foreignCapability =
      await mintProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1({
        initializationNonce: foreignInitializationNonce,
        installationIdentityGenerationId: foreignIdentity,
        keyCheckToken: await deriveInstallationIdentityKeyCheckTokenV1(
          {
            generationId: foreignIdentity,
            initializationNonce: foreignInitializationNonce,
          },
          foreignIdentityKey,
          cryptoHost,
        ),
        installationIdentityKey: foreignIdentityKey,
        cryptoHost,
      });
    if (
      rebuilt.compareAppendResult.resolution !== "resolved" ||
      rebuilt.referenceState.namespace.state !== "current"
    ) {
      throw new Error("committed fixture lost its current reference closure");
    }
    const receipt = rebuilt.compareAppendResult.receipt;
    const request = receipt.payload.requestReferenceProjection;
    const generation = request.candidate;
    const outcome = receipt.payload.referenceOutcome;
    if (outcome.outcome !== "committed") {
      throw new Error("committed fixture lost its committed outcome");
    }

    request.installationIdentityGenerationId = foreignIdentity;
    generation.installationIdentityGenerationId = foreignIdentity;
    generation.payload.installationIdentityGenerationId = foreignIdentity;
    generation.generationId =
      deriveProviderStrongReadyAcceptanceStateGenerationIdV1({
        installationIdentityGenerationId: foreignIdentity,
        acceptanceOrdinal: generation.payload.acceptanceOrdinal,
        predecessor: generation.payload.predecessor,
        configuration: generation.payload.configuration,
      });
    generation.payload.generationId = generation.generationId;
    generation.payload.acceptanceToken =
      await deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
        foreignCapability,
        foreignIdentity,
        generation.payload,
      );
    generation.contentDigest =
      deriveProviderStrongReadyAcceptanceStateContentDigestV1(
        generation.payload,
      );
    outcome.appendedGeneration.generationId = generation.generationId;
    outcome.appendedGeneration.contentDigest = generation.contentDigest;
    outcome.committedHighWater.payload.installationIdentityGenerationId =
      foreignIdentity;
    outcome.committedHighWater.payload.currentAcceptance.generationId =
      generation.generationId;
    outcome.committedHighWater.payload.currentAcceptance.contentDigest =
      generation.contentDigest;
    outcome.committedHighWater.payload.generationSetDigest =
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationSetDigestReferenceCandidateV1({
        entries: [outcome.appendedGeneration],
      });
    outcome.committedHighWater.contentDigest =
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterContentDigestReferenceCandidateV1(
        outcome.committedHighWater.payload,
      );
    outcome.committedHighWater.currentVersionToken =
      await deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentVersionTokenWithIdentityCapabilityInternalV1(
        foreignCapability,
        foreignIdentity,
        outcome.committedHighWater,
      );
    receipt.installationIdentityGenerationId = foreignIdentity;
    receipt.payload.installationIdentityGenerationId = foreignIdentity;
    receipt.payload.requestContentDigest =
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1(
        request,
      );
    await rebuildReceiptEnvelopeV1(
      receipt,
      foreignCapability,
      foreignIdentity,
    );
    rebuilt.referenceState.namespace.currentRead.highWater =
      cloneJsonV1(outcome.committedHighWater);
    rebuilt.referenceState.namespace.currentRead.enumeration
      .installationIdentityGenerationId = foreignIdentity;
    rebuilt.referenceState.namespace.currentRead.enumeration.entries = [
      cloneJsonV1(outcome.appendedGeneration),
    ];
    rebuilt.referenceState.namespace.currentRead.enumeration
      .generationSetDigest = outcome.committedHighWater.payload
        .generationSetDigest;
    rebuilt.referenceState.namespace.generations = [cloneJsonV1(generation)];
    rebuilt.referenceState.receiptLedger =
      createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerCandidateInternalV1({
        installationIdentityGenerationId,
        receipts: [receipt],
      });

    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureStateReferenceCandidateV1Schema
        .safeParse(rebuilt.referenceState).success,
    ).toBe(false);
  });

  it("rejects a non-commit whose rebuilt observation substitutes a later committed high-water", async () => {
    await resetCapabilitiesV1();
    const nonCommit =
      await createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1(
        await inputV1(
          await requestV1("9".repeat(32)),
          await observationCapabilityV1(
            d39ValidationV1("legacy_redacted_read_only"),
          ),
        ),
      );
    const committed =
      await createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1(
        await inputV1(await requestV1("a".repeat(32))),
      );
    if (
      nonCommit.compareAppendResult.resolution !== "resolved" ||
      committed.compareAppendResult.resolution !== "resolved" ||
      committed.referenceState.namespace.state !== "current"
    ) {
      throw new Error("mixed replay fixture lost its resolved current closure");
    }
    const rebuilt = cloneJsonV1(committed);
    if (rebuilt.compareAppendResult.resolution !== "resolved") {
      throw new Error("cloned committed fixture lost its resolved result");
    }
    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureStateReferenceCandidateV1Schema
        .safeParse(rebuilt.referenceState).success,
    ).toBe(true);
    const firstReceipt = cloneJsonV1(nonCommit.compareAppendResult.receipt);
    if (firstReceipt.payload.referenceOutcome.outcome !== "not_committed") {
      throw new Error("first fixture lost its non-commit outcome");
    }
    firstReceipt.payload.referenceOutcome.observedHighWater = {
      state: "trusted",
      highWater: cloneJsonV1(
        committed.referenceState.namespace.currentRead.highWater,
      ),
    };
    await rebuildReceiptEnvelopeV1(firstReceipt);
    const secondReceipt = rebuilt.compareAppendResult.receipt;
    secondReceipt.payload.linearizationOrdinal = 2;
    await rebuildReceiptEnvelopeV1(secondReceipt);
    rebuilt.compareAppendReceiptPin =
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptPinReferenceCandidateV1(
        secondReceipt,
      );
    rebuilt.referenceState.receiptLedger =
      createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerCandidateInternalV1({
        installationIdentityGenerationId,
        receipts: [firstReceipt, secondReceipt],
      });

    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureStateReferenceCandidateV1Schema
        .safeParse(rebuilt.referenceState).success,
    ).toBe(false);
  });

  it("snapshots nested Distribution input before a queued operation starts", async () => {
    await resetCapabilitiesV1();
    let resolveFirstGate!: () => void;
    let resolveFirstStarted!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      resolveFirstGate = resolve;
    });
    const firstStarted = new Promise<void>((resolve) => {
      resolveFirstStarted = resolve;
    });
    const firstCapability = await observationCapabilityV1(
      d39ValidationV1("legacy_redacted_read_only"),
    );
    d39SeamV1.diagnose.mockImplementationOnce(async (input: {
      physicalTargetObservationCapability: object;
    }) => {
      const capability = input.physicalTargetObservationCapability;
      d39SeamV1.consumed.get(capability)?.();
      resolveFirstStarted();
      await firstGate;
      return { ok: true as const, value: d39SeamV1.selections.get(capability)! };
    });
    const first =
      createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1(
        await inputV1(await requestV1("6".repeat(32)), firstCapability),
      );
    await firstStarted;

    const nestedDistribution = {
      bootstrapTrustBundle: { marker: "before" },
      distributionRootBinding: {},
      installationIdentityGenerationId,
      rootMetadataHistory: [],
      registryManifestHistory: [],
      publicSupportTaxonomyHistory: [],
      releaseMatrixHistory: [],
      targetDiscoveryResultHistory: [],
      releaseTargetUniverseHistory: [],
      providerFeasibilitySupportCatalogHistory: [],
      targetDiscoveryFixtureManifests: [],
      targetDiscoveryRunnerRuns: [],
      realFilesystemSuiteManifests: [],
      realFilesystemFixtureCorpusManifests: [],
      providerFeasibilitySupportCandidateArtifacts: [],
      strictCryptoCapability: Object.freeze(Object.create(null)),
    };
    const secondCapability = await observationCapabilityV1();
    const secondRequest = await requestV1("7".repeat(32));
    const secondInput = await inputV1(
      secondRequest,
      secondCapability,
    );
    (secondInput as { distributionHistoryCandidate: unknown })
      .distributionHistoryCandidate = nestedDistribution;
    const second =
      createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1(
        secondInput,
      );
    nestedDistribution.bootstrapTrustBundle.marker = "after";
    (secondRequest.candidate.payload.configuration.core.activeWriterSelector
      .selections as unknown as Array<{ providerId: string }>)[0] = {
        ...writer,
        providerId: "durable-object-provider:mutated-after-start",
      };
    resolveFirstGate();
    await first;
    const secondResult = await second;
    expect(secondResult.compareAppendResult).toMatchObject({
      resolution: "resolved",
      receipt: {
        payload: {
          referenceOutcome: {
            outcome: "committed",
          },
        },
      },
    });
    const secondSelectionInput = d39SeamV1.diagnose.mock.calls.at(-1)![0] as {
      distributionHistoryCandidate: {
        bootstrapTrustBundle: { marker: string };
      };
    };
    expect(
      secondSelectionInput.distributionHistoryCandidate.bootstrapTrustBundle
        .marker,
    ).toBe("before");
    expect(
      secondResult.acceptanceCompareAppendRequest.candidate.payload
        .configuration.core.activeWriterSelector.selections[0],
    ).toEqual(writer);
  });

  it("records read-only and exact-candidate drift as reference candidate_invalid receipts", async () => {
    await resetCapabilitiesV1();
    const readOnly = d39ValidationV1("legacy_redacted_read_only");
    const readOnlyResult =
      await createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1(
        await inputV1(
          await requestV1("2".repeat(32)),
          await observationCapabilityV1(readOnly),
        ),
      );
    expect(readOnlyResult.compareAppendResult).toMatchObject({
      receipt: {
        payload: {
          referenceOutcome: {
            outcome: "not_committed",
            reason: "candidate_invalid",
          },
        },
      },
    });

    await resetCapabilitiesV1();
    const drifted = await requestV1("3".repeat(32), (configuration) => {
      configuration.core.activeWriterSelector.selections[0] = {
        ...writer,
        registryEntryContentDigest: digest("1"),
      };
    });
    const driftResult =
      await createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1(
        await inputV1(drifted),
      );
    expect(driftResult.compareAppendResult).toMatchObject({
      receipt: {
        payload: {
          referenceOutcome: {
            outcome: "not_committed",
            reason: "candidate_invalid",
          },
        },
      },
    });
  });

  it("replay and nonce mismatch finish before consuming the supplied D-39 one-shot capability", async () => {
    await resetCapabilitiesV1();
    const request = await requestV1("4".repeat(32));
    await createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1(
      await inputV1(request),
    );

    const replayObserved = vi.fn();
    const replayCapability = await observationCapabilityV1(
      d39ValidationV1(),
      replayObserved,
    );
    const replay =
      await createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1(
        await inputV1(request, replayCapability),
      );
    expect(replay.compareAppendResult.resolution).toBe("resolved");
    expect(replayObserved).not.toHaveBeenCalled();

    const changed = await requestV1("4".repeat(32), (configuration) => {
      configuration.core.activeRootMetadata = {
        ...rootPin,
        rootGeneration: rootPin.rootGeneration + 1,
      };
    });
    const mismatchObserved = vi.fn();
    const mismatchCapability = await observationCapabilityV1(
      d39ValidationV1(),
      mismatchObserved,
    );
    const mismatch =
      await createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1(
        await inputV1(changed, mismatchCapability),
      );
    expect(mismatch.compareAppendResult).toMatchObject({
      resolution: "request_rejected",
      reason: "operation_nonce_request_mismatch",
    });
    expect(mismatch.acceptanceCompareAppendRequest).toEqual(changed);
    expect(mismatchObserved).not.toHaveBeenCalled();
    expect(
      inspectProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(
        machineCapability,
      ).receiptLedger.entries,
    ).toHaveLength(1);
  });

  it("rejects exact6 violations/capability substitution and exposes only opaque public failure", async () => {
    await resetCapabilitiesV1();
    const request = await requestV1("5".repeat(32));
    const extra = { ...(await inputV1(request)), extra: true };
    await expect(
      createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1(
        extra as never,
      ),
    ).rejects.toBeInstanceOf(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateValidationError,
    );
    const diagnostic =
      await diagnoseCreateProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1(
        extra,
      );
    expect(diagnostic).toEqual({
      ok: false,
      stage: "input",
      reason: "schema_invalid",
    });

    const wrongCapability = Object.freeze(Object.create(null));
    await expect(
      createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1({
        ...(await inputV1(request)),
        referenceMachineCapability: wrongCapability,
      } as never),
    ).rejects.toMatchObject({
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });
    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureInvalidStageReferenceCandidateV1Schema
        .options,
    ).toHaveLength(14);
    expect(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureInvalidReasonReferenceCandidateV1Schema
        .options,
    ).toHaveLength(11);
  });
});
