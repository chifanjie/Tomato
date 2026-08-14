import { describe, expect, it } from "vitest";

import {
  deriveStoreDurableObjectProviderPolicyDigestV1,
  StoreDurableObjectProviderPolicyV1Schema,
} from "../src/provider-runtime-attestation-point.js";
import {
  deriveProviderTrustedLocalStrongWriterSelectionCandidateInternalV1,
} from "../src/provider-trusted-local-strong-writer-selection-candidate-internal.js";

const digest = (value: string) => `sha256:${value.repeat(64)}`;
const providerId = "durable-object-provider:native-b";
const target = Object.freeze({
  targetProfileId: `provider-target-profile:${"1".repeat(64)}`,
  osPlatform: "linux",
  osReleaseFamilyCode: `provider-os-family:${"2".repeat(22)}`,
  osBuildDigest: digest("3"),
  architecture: "x86_64",
  filesystemProfileCode: `provider-fs-profile:${"4".repeat(22)}`,
  filesystemFeatureProfileDigest: digest("5"),
  mountOptionProfileDigest: digest("6"),
});
const catalogPin = Object.freeze({
  locatorProfile: "distribution_provider_feasibility_support_catalog_v1",
  catalogGeneration: 1,
  contentDigest: digest("7"),
});
const evidencePin = Object.freeze({
  locatorProfile: "installation_provider_feasibility_evidence_v1",
  evidenceId: `provider-feasibility-evidence:${"8".repeat(22)}`,
  contentDigest: digest("9"),
});

const policy = StoreDurableObjectProviderPolicyV1Schema.parse({
  profile: "store_durable_object_provider_policy_v1",
  protocolVersion: 1,
  providerId,
  ipcPeerAuthenticationPolicyDigest: digest("a"),
  isolation: {
    kind: "separate_os_principal",
    securityBoundaryProfileDigest: digest("b"),
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
  realFilesystemConformanceSuiteDigest: digest("c"),
});
const policyDigest = deriveStoreDurableObjectProviderPolicyDigestV1(policy);
const runtimePin = Object.freeze({
  profile: "store_durable_object_provider_runtime_attestation_pin_v1",
  contentDigest: digest("d"),
  payload: Object.freeze({ providerId }),
});
const candidate = Object.freeze({
  providerId,
  providerFeasibilityEvidence: evidencePin,
  semanticProviderPolicy: policy,
  runtimeAttestation: runtimePin,
  releaseDisposition: "strong_read_write",
});
const evidence = Object.freeze({
  payload: Object.freeze({
    result: "passed",
    providerId,
    semanticProviderPolicyDigest: policyDigest,
    runtimeAttestationContentDigest: runtimePin.contentDigest,
  }),
});
const candidateClosure = Object.freeze({
  catalogTarget: target,
  catalogCandidate: candidate,
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
    activeBindingDerivationKeyGeneration: 7,
  }),
});

function validationV1(
  overrides: Readonly<Record<string, unknown>> = {},
) {
  const closure = {
    providerFeasibilitySupportCatalogPin: catalogPin,
    providerFeasibilitySupportCatalog: {
      payload: { targets: [{ target, candidates: [candidate] }] },
    },
    candidateDeepClosures: [candidateClosure],
    registryManifestHistoryClosure: {
      registryManifestHistory: [{
        payload: {
          routing: { state: "steady" },
          members: [{
            disposition: "enabled",
            providerId,
            registryEntryContentDigest: digest("e"),
            registryEntry,
          }],
        },
      }],
    },
  };
  return {
    authority:
      "none_provider_trusted_local_physical_target_selection_candidate_only",
    selectedOwnerTargetCapability: {
      target,
      capability: "strong_read_write",
    },
    providerFeasibilitySupportCatalogPin: catalogPin,
    distributionHistoryCandidate: {
      catalogPointClosure: closure,
    },
    ...overrides,
  } as any;
}

describe("trusted local strong-writer Candidate private seam", () => {
  it("derives exactly one Registry-exact writer for only the selected local target", () => {
    expect(
      deriveProviderTrustedLocalStrongWriterSelectionCandidateInternalV1(
        validationV1(),
      ),
    ).toEqual({
      selectedActiveWriter: {
        targetProfileId: target.targetProfileId,
        providerId,
        registryEntryContentDigest: digest("e"),
        semanticProviderPolicyDigest: policyDigest,
        providerFeasibilityEvidence: evidencePin,
        runtimeAttestationContentDigest: runtimePin.contentDigest,
        bindingDerivationKeyGeneration: 7,
      },
    });
  });

  it("preserves D-39 read-only truth by refusing to derive a writer", () => {
    const validation = validationV1();
    validation.selectedOwnerTargetCapability.capability =
      "legacy_redacted_read_only";
    expect(() =>
      deriveProviderTrustedLocalStrongWriterSelectionCandidateInternalV1(
        validation,
      )
    ).toThrowError(expect.objectContaining({
      reason: "selected_target_read_only",
    }));
  });

  it("rejects a signed-but-different Registry Evidence pin as zero match", () => {
    const validation = validationV1();
    const historyClosure = validation.distributionHistoryCandidate
      .catalogPointClosure.registryManifestHistoryClosure;
    const registryTip = historyClosure.registryManifestHistory[0];
    const member = registryTip.payload.members[0];
    historyClosure.registryManifestHistory = [{
      ...registryTip,
      payload: {
        ...registryTip.payload,
        members: [{
          ...member,
          registryEntry: {
            ...member.registryEntry,
            providerFeasibilityEvidence: {
              ...evidencePin,
              contentDigest: digest("f"),
            },
          },
        }],
      },
    }];
    expect(() =>
      deriveProviderTrustedLocalStrongWriterSelectionCandidateInternalV1(
        validation,
      )
    ).toThrowError(expect.objectContaining({ reason: "writer_zero_match" }));
  });

  it("rejects duplicate exact candidates instead of choosing by order", () => {
    const validation = validationV1();
    const group = validation.distributionHistoryCandidate.catalogPointClosure
      .providerFeasibilitySupportCatalog.payload.targets[0];
    group.candidates = [candidate, candidate];
    validation.distributionHistoryCandidate.catalogPointClosure
      .candidateDeepClosures = [candidateClosure, candidateClosure];
    expect(() =>
      deriveProviderTrustedLocalStrongWriterSelectionCandidateInternalV1(
        validation,
      )
    ).toThrowError(expect.objectContaining({
      reason: "writer_ambiguous_match",
    }));
  });

  it("rejects candidate-closure alignment drift", () => {
    const validation = validationV1();
    validation.distributionHistoryCandidate.catalogPointClosure
      .candidateDeepClosures[0] = {
        ...candidateClosure,
        catalogTarget: { ...target, osBuildDigest: digest("f") },
      };
    expect(() =>
      deriveProviderTrustedLocalStrongWriterSelectionCandidateInternalV1(
        validation,
      )
    ).toThrowError(expect.objectContaining({
      reason: "writer_projection_mismatch",
    }));
  });

  it("does not late-bind a poisoned global TextEncoder for target equality", () => {
    const original = globalThis.TextEncoder;
    class PoisonedTextEncoder {
      encode(): Uint8Array {
        return new Uint8Array(0);
      }
    }
    try {
      Object.defineProperty(globalThis, "TextEncoder", {
        configurable: true,
        writable: true,
        value: PoisonedTextEncoder,
      });
      const validation = validationV1();
      validation.selectedOwnerTargetCapability.target = {
        ...target,
        osBuildDigest: digest("f"),
      };
      expect(() =>
        deriveProviderTrustedLocalStrongWriterSelectionCandidateInternalV1(
          validation,
        )
      ).toThrowError(expect.objectContaining({
        reason: "writer_projection_mismatch",
      }));
    } finally {
      Object.defineProperty(globalThis, "TextEncoder", {
        configurable: true,
        writable: true,
        value: original,
      });
    }
  });
});
