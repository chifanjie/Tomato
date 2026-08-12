import { canonicalizeJcsSafeIntegerUtf8V1 } from "./jcs.js";
import type {
  ProviderDistributionHistoryCurrentCandidatePointValidationV1,
} from "./provider-distribution-history-current-candidate-point.js";
import {
  deriveStoreDurableObjectProviderPolicyDigestV1,
} from "./provider-runtime-attestation-point.js";
import type {
  ProviderActiveWriterSelectionV1,
} from "./provider-strong-ready-acceptance-candidate.js";

const CapturedArrayPrototypeSortV1 = Array.prototype.sort;
const CapturedMathMinV1 = Math.min;
const CapturedNumberIsSafeIntegerV1 = Number.isSafeInteger;
const CapturedObjectFreezeV1 = Object.freeze;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedTextEncoderV1 = TextEncoder;
const CapturedTextEncoderPrototypeEncodeV1 = TextEncoder.prototype.encode;
const CapturedUtf8EncoderV1 = CapturedObjectFreezeV1(
  new CapturedTextEncoderV1(),
);

function arraySortV1<T>(
  array: T[],
  comparator: (left: T, right: T) => number,
): T[] {
  return CapturedReflectApplyV1(CapturedArrayPrototypeSortV1, array, [
    comparator,
  ]) as T[];
}

function textEncoderEncodeV1(value: string): Uint8Array {
  return CapturedReflectApplyV1(
    CapturedTextEncoderPrototypeEncodeV1,
    CapturedUtf8EncoderV1,
    [value],
  ) as Uint8Array;
}

function compareUtf8V1(left: string, right: string): number {
  const leftBytes = textEncoderEncodeV1(left);
  const rightBytes = textEncoderEncodeV1(right);
  const length = CapturedMathMinV1(
    leftBytes.byteLength,
    rightBytes.byteLength,
  );
  for (let index = 0; index < length; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!;
    if (difference !== 0) return difference;
  }
  return leftBytes.byteLength - rightBytes.byteLength;
}

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  const leftBytes = canonicalizeJcsSafeIntegerUtf8V1(left);
  const rightBytes = canonicalizeJcsSafeIntegerUtf8V1(right);
  if (leftBytes.byteLength !== rightBytes.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.byteLength; index += 1) {
    difference |= leftBytes[index]! ^ rightBytes[index]!;
  }
  return difference === 0;
}

export type ProviderStrongReadyActiveWriterSelectionFailureReasonInternalV1 =
  | "source_invalid"
  | "routing_not_steady"
  | "zero_match"
  | "ambiguous_match";

export class ProviderStrongReadyActiveWriterSelectionErrorInternalV1 extends Error {
  constructor(
    readonly reason:
      ProviderStrongReadyActiveWriterSelectionFailureReasonInternalV1,
  ) {
    super("provider strong-ready active-writer selection failed");
    this.name =
      "ProviderStrongReadyActiveWriterSelectionErrorInternalV1";
    CapturedObjectFreezeV1(this);
  }
}

/** Internal classification seam for focused zero/multiple-match tests. */
export function classifyProviderStrongReadyActiveWriterMatchCountInternalV1(
  matchCount: number,
): "unique" {
  if (!CapturedNumberIsSafeIntegerV1(matchCount) || matchCount < 0) {
    return failV1("source_invalid");
  }
  if (matchCount === 0) return failV1("zero_match");
  if (matchCount !== 1) return failV1("ambiguous_match");
  return "unique";
}

function failV1(
  reason: ProviderStrongReadyActiveWriterSelectionFailureReasonInternalV1,
): never {
  throw new ProviderStrongReadyActiveWriterSelectionErrorInternalV1(reason);
}

/**
 * Package-internal selector derivation.  The input must be the recursively
 * frozen result of the C09-1N validator; this function does not grant trust to
 * caller-authored Catalog/Registry DTOs.
 *
 * @internal
 */
export function deriveProviderStrongReadyActiveWriterSelectionsInternalV1(
  validation:
    ProviderDistributionHistoryCurrentCandidatePointValidationV1,
): readonly ProviderActiveWriterSelectionV1[] {
  const closure = validation.catalogPointClosure;
  const catalog = closure.providerFeasibilitySupportCatalog.payload;
  const registryHistory =
    closure.registryManifestHistoryClosure.registryManifestHistory;
  const registryTip = registryHistory[registryHistory.length - 1];
  if (registryTip === undefined) return failV1("source_invalid");
  if (registryTip.payload.routing.state !== "steady") {
    return failV1("routing_not_steady");
  }

  const selections: ProviderActiveWriterSelectionV1[] = [];
  let closureIndex = 0;
  for (
    let targetIndex = 0;
    targetIndex < catalog.targets.length;
    targetIndex += 1
  ) {
    const targetGroup = catalog.targets[targetIndex]!;
    const matches: ProviderActiveWriterSelectionV1[] = [];
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
        !canonicalEqualV1(candidateClosure.catalogTarget, targetGroup.target) ||
        !canonicalEqualV1(candidateClosure.catalogCandidate, candidate)
      ) {
        return failV1("source_invalid");
      }
      if (candidate.releaseDisposition !== "strong_read_write") continue;

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
      if (matchedMember === undefined) continue;
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
        continue;
      }

      matches.push(
        CapturedObjectFreezeV1({
          targetProfileId: targetGroup.target.targetProfileId,
          providerId: candidate.providerId,
          registryEntryContentDigest:
            matchedMember.registryEntryContentDigest,
          semanticProviderPolicyDigest,
          providerFeasibilityEvidence: CapturedObjectFreezeV1({
            locatorProfile:
              candidate.providerFeasibilityEvidence.locatorProfile,
            evidenceId: candidate.providerFeasibilityEvidence.evidenceId,
            contentDigest:
              candidate.providerFeasibilityEvidence.contentDigest,
          }),
          runtimeAttestationContentDigest:
            candidate.runtimeAttestation.contentDigest,
          bindingDerivationKeyGeneration:
            matchedMember.registryEntry.verificationKeys
              .activeBindingDerivationKeyGeneration,
        }) as ProviderActiveWriterSelectionV1,
      );
    }
    classifyProviderStrongReadyActiveWriterMatchCountInternalV1(
      matches.length,
    );
    selections.push(matches[0]!);
  }
  if (
    closureIndex !== closure.candidateDeepClosures.length ||
    selections.length !== catalog.targets.length ||
    selections.length === 0
  ) {
    return failV1("source_invalid");
  }
  arraySortV1(
    selections,
    (left, right) =>
      compareUtf8V1(left.targetProfileId, right.targetProfileId),
  );
  for (let index = 1; index < selections.length; index += 1) {
    if (
      compareUtf8V1(
        selections[index - 1]!.targetProfileId,
        selections[index]!.targetProfileId,
      ) >= 0
    ) {
      return failV1("source_invalid");
    }
  }
  return CapturedObjectFreezeV1(selections);
}

CapturedObjectFreezeV1(
  deriveProviderStrongReadyActiveWriterSelectionsInternalV1,
);
CapturedObjectFreezeV1(
  classifyProviderStrongReadyActiveWriterMatchCountInternalV1,
);
