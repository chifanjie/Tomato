import { canonicalizeJcsSafeIntegerV1 } from "./jcs.js";
import type {
  ProviderFeasibilitySupportCatalogCandidateClosureV1,
  ProviderFeasibilitySupportCandidateV1,
} from "./provider-feasibility-support-catalog-point.js";
import {
  deriveStoreDurableObjectProviderPolicyDigestV1,
} from "./provider-runtime-attestation-point.js";
import {
  ProviderActiveWriterSelectionV1Schema,
  type ProviderActiveWriterSelectionV1,
} from "./provider-strong-ready-acceptance-candidate.js";
import {
  PROVIDER_TRUSTED_LOCAL_PHYSICAL_TARGET_SELECTION_CANDIDATE_AUTHORITY_V1,
  type ProviderTrustedLocalPhysicalTargetSelectionCandidateValidationV1,
} from "./provider-trusted-local-physical-target-selection-candidate.js";

const CapturedObjectFreezeV1 = Object.freeze;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedWeakSetV1 = WeakSet;
const CapturedWeakSetPrototypeAddV1 = WeakSet.prototype.add;
const CapturedWeakSetPrototypeHasV1 = WeakSet.prototype.has;

function weakSetAddV1<T extends object>(set: WeakSet<T>, value: T): void {
  CapturedReflectApplyV1(CapturedWeakSetPrototypeAddV1, set, [value]);
}

function weakSetHasV1<T extends object>(set: WeakSet<T>, value: T): boolean {
  return CapturedReflectApplyV1(CapturedWeakSetPrototypeHasV1, set, [
    value,
  ]) as boolean;
}

export type ProviderTrustedLocalStrongWriterSelectionCandidateFailureReasonInternalV1 =
  | "source_invalid"
  | "selected_target_read_only"
  | "routing_not_steady"
  | "writer_zero_match"
  | "writer_ambiguous_match"
  | "writer_projection_mismatch";

export class ProviderTrustedLocalStrongWriterSelectionCandidateErrorInternalV1
  extends Error {
  constructor(
    readonly reason:
      ProviderTrustedLocalStrongWriterSelectionCandidateFailureReasonInternalV1,
  ) {
    super("provider trusted local strong-writer selection failed");
    this.name =
      "ProviderTrustedLocalStrongWriterSelectionCandidateErrorInternalV1";
    weakSetAddV1(localStrongWriterSelectionErrorsV1, this);
    CapturedObjectFreezeV1(this);
  }
}

const localStrongWriterSelectionErrorsV1 = new CapturedWeakSetV1<object>();

export function isProviderTrustedLocalStrongWriterSelectionCandidateErrorInternalV1(
  value: unknown,
): value is ProviderTrustedLocalStrongWriterSelectionCandidateErrorInternalV1 {
  return typeof value === "object" && value !== null &&
    weakSetHasV1(localStrongWriterSelectionErrorsV1, value);
}

export interface ProviderTrustedLocalStrongWriterSelectionCandidateInternalV1 {
  readonly selectedActiveWriter: ProviderActiveWriterSelectionV1;
}

function failV1(
  reason:
    ProviderTrustedLocalStrongWriterSelectionCandidateFailureReasonInternalV1,
): never {
  throw new ProviderTrustedLocalStrongWriterSelectionCandidateErrorInternalV1(
    reason,
  );
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  return canonicalizeJcsSafeIntegerV1(left) ===
    canonicalizeJcsSafeIntegerV1(right);
}

function candidateMatchesRegistryExactV1(
  candidate: ProviderFeasibilitySupportCandidateV1,
  candidateClosure: ProviderFeasibilitySupportCatalogCandidateClosureV1,
  registryTip: ProviderTrustedLocalPhysicalTargetSelectionCandidateValidationV1[
    "distributionHistoryCandidate"
  ]["catalogPointClosure"]["registryManifestHistoryClosure"]["registryManifestHistory"][number],
): ProviderActiveWriterSelectionV1 | undefined {
  if (candidate.releaseDisposition !== "strong_read_write") return undefined;

  const evidenceClosure = candidateClosure.evidencePointClosure;
  const evidence = evidenceClosure.providerFeasibilityEvidence;
  const runtimeClosure = evidenceClosure.runtimeAttestationPointClosure;
  const semanticProviderPolicyDigest =
    deriveStoreDurableObjectProviderPolicyDigestV1(
      candidate.semanticProviderPolicy,
    );
  if (
    evidence.payload.result !== "passed" ||
    evidence.payload.providerId !== candidate.providerId ||
    evidence.payload.semanticProviderPolicyDigest !==
      semanticProviderPolicyDigest ||
    evidence.payload.runtimeAttestationContentDigest !==
      candidate.runtimeAttestation.contentDigest ||
    !canonicalEqualV1(
      evidenceClosure.providerFeasibilityEvidencePin,
      candidate.providerFeasibilityEvidence,
    ) ||
    runtimeClosure.semanticProviderPolicyDigest !==
      semanticProviderPolicyDigest ||
    !canonicalEqualV1(
      runtimeClosure.runtimeAttestation,
      candidate.runtimeAttestation,
    )
  ) {
    return failV1("source_invalid");
  }

  let matchedMember:
    | Extract<
        (typeof registryTip.payload.members)[number],
        { readonly disposition: "enabled" }
      >
    | undefined;
  for (
    let memberIndex = 0;
    memberIndex < registryTip.payload.members.length;
    memberIndex += 1
  ) {
    const member = registryTip.payload.members[memberIndex]!;
    if (
      member.disposition !== "enabled" ||
      member.providerId !== candidate.providerId
    ) {
      continue;
    }
    if (matchedMember !== undefined) return failV1("source_invalid");
    matchedMember = member;
  }
  if (matchedMember === undefined) return undefined;
  if (
    matchedMember.registryEntry.providerId !== candidate.providerId ||
    matchedMember.registryEntry.semanticProviderPolicyDigest !==
      semanticProviderPolicyDigest ||
    !canonicalEqualV1(
      matchedMember.registryEntry.providerFeasibilityEvidence,
      candidate.providerFeasibilityEvidence,
    ) ||
    !canonicalEqualV1(
      matchedMember.registryEntry.runtimeAttestation,
      candidate.runtimeAttestation,
    )
  ) {
    return undefined;
  }

  return ProviderActiveWriterSelectionV1Schema.parse({
    targetProfileId: candidateClosure.catalogTarget.targetProfileId,
    providerId: candidate.providerId,
    registryEntryContentDigest:
      matchedMember.registryEntryContentDigest,
    semanticProviderPolicyDigest,
    providerFeasibilityEvidence: candidate.providerFeasibilityEvidence,
    runtimeAttestationContentDigest:
      candidate.runtimeAttestation.contentDigest,
    bindingDerivationKeyGeneration:
      matchedMember.registryEntry.verificationKeys
        .activeBindingDerivationKeyGeneration,
  });
}

/**
 * Package-private D-40 seam. The input must be the exact value returned by the
 * D-39 one-shot opened-root selector. This function deliberately projects only
 * that selected local target and never runs the C09-1O all-Catalog selector.
 *
 * @internal
 */
export function deriveProviderTrustedLocalStrongWriterSelectionCandidateInternalV1(
  validation:
    ProviderTrustedLocalPhysicalTargetSelectionCandidateValidationV1,
): ProviderTrustedLocalStrongWriterSelectionCandidateInternalV1 {
  try {
    if (
      validation.authority !==
      PROVIDER_TRUSTED_LOCAL_PHYSICAL_TARGET_SELECTION_CANDIDATE_AUTHORITY_V1
    ) {
      return failV1("source_invalid");
    }
    const selectedOwner = validation.selectedOwnerTargetCapability;
    if (selectedOwner.capability !== "strong_read_write") {
      return failV1("selected_target_read_only");
    }

    const distribution = validation.distributionHistoryCandidate;
    const closure = distribution.catalogPointClosure;
    const catalog = closure.providerFeasibilitySupportCatalog.payload;
    const registryHistory =
      closure.registryManifestHistoryClosure.registryManifestHistory;
    const registryTip = registryHistory[registryHistory.length - 1];
    if (registryTip === undefined) return failV1("source_invalid");
    if (registryTip.payload.routing.state !== "steady") {
      return failV1("routing_not_steady");
    }
    if (
      !canonicalEqualV1(
        validation.providerFeasibilitySupportCatalogPin,
        closure.providerFeasibilitySupportCatalogPin,
      )
    ) {
      return failV1("writer_projection_mismatch");
    }

    let selectedTargetGroupIndex = -1;
    let closureIndex = 0;
    const matches: ProviderActiveWriterSelectionV1[] = [];
    for (
      let targetIndex = 0;
      targetIndex < catalog.targets.length;
      targetIndex += 1
    ) {
      const targetGroup = catalog.targets[targetIndex]!;
      const selectedTarget = canonicalEqualV1(
        targetGroup.target,
        selectedOwner.target,
      );
      if (selectedTarget) {
        if (selectedTargetGroupIndex !== -1) {
          return failV1("writer_projection_mismatch");
        }
        selectedTargetGroupIndex = targetIndex;
      }
      for (
        let candidateIndex = 0;
        candidateIndex < targetGroup.candidates.length;
        candidateIndex += 1
      ) {
        const candidate = targetGroup.candidates[candidateIndex]!;
        const candidateClosure = closure.candidateDeepClosures[closureIndex];
        closureIndex += 1;
        if (
          candidateClosure === undefined ||
          !canonicalEqualV1(
            candidateClosure.catalogTarget,
            targetGroup.target,
          ) ||
          !canonicalEqualV1(
            candidateClosure.catalogCandidate,
            candidate,
          )
        ) {
          return failV1("writer_projection_mismatch");
        }
        if (!selectedTarget) continue;
        const match = candidateMatchesRegistryExactV1(
          candidate,
          candidateClosure,
          registryTip,
        );
        if (match !== undefined) matches[matches.length] = match;
      }
    }
    if (
      closureIndex !== closure.candidateDeepClosures.length ||
      selectedTargetGroupIndex === -1
    ) {
      return failV1("writer_projection_mismatch");
    }
    if (matches.length === 0) return failV1("writer_zero_match");
    if (matches.length !== 1) return failV1("writer_ambiguous_match");

    return CapturedObjectFreezeV1({
      selectedActiveWriter: CapturedObjectFreezeV1(matches[0]!),
    });
  } catch (error) {
    if (
      isProviderTrustedLocalStrongWriterSelectionCandidateErrorInternalV1(
        error,
      )
    ) {
      throw error;
    }
    return failV1("source_invalid");
  }
}

CapturedObjectFreezeV1(
  deriveProviderTrustedLocalStrongWriterSelectionCandidateInternalV1,
);
CapturedObjectFreezeV1(
  isProviderTrustedLocalStrongWriterSelectionCandidateErrorInternalV1,
);
