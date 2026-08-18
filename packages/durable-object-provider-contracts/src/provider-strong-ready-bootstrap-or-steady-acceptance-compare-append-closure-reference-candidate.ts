/**
 * D-40 Acceptance compare-append closure/reference candidate.
 *
 * This public seam connects the D-39 trusted opened-root target selection to
 * the package-private in-memory reference machine.  It intentionally grants
 * no write authority and performs no filesystem or IPC operation.
 */

export * from "./provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-reference-candidate-wire.js";

import { z } from "./zod-runtime.js";

import {
  assertDataObjectDescriptorsBeforeSchemaV1,
  assertJsonDataTreeBeforeSchemaV1,
} from "./domain-crypto.js";
import { canonicalizeJcsSafeIntegerV1 } from "./jcs.js";
import { ContentDigestV1Schema } from "./primitives.js";
import { PROVIDER_TRUST_HISTORY_POLICY_V1 } from "./provider-trust-policy.js";
import {
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentReadReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendResultReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptPinReferenceCandidateV1Schema,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationEntryReferenceCandidateV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptPinReferenceCandidateV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationSetDigestReferenceCandidateV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendResultReferenceCandidateV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptPinReferenceCandidateV1,
} from "./provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-reference-candidate-wire.js";
import {
  deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1,
  isProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityErrorInternalV1,
  verifyProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
} from "./provider-strong-ready-bootstrap-or-steady-acceptance-identity-verification-capability-internal.js";
import {
  captureProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineStateAfterPendingInternalV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptSetDigestCandidateInternalV1,
  executeProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1,
  isProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineErrorInternalV1,
  mintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReadOnlyContinuityHandleInternalV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceTransactionDecisionInternalV1,
} from "./provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-reference-machine-internal.js";
import {
  createProviderPointRawAdmissionBudgetForSessionV1,
  captureProviderPointRawExactTopLevelV1,
  captureProviderPointDetachedExactDataObjectV1,
  cloneProviderPointRawAdmissionCapsuleV1,
  createProviderPointRawAdmissionSessionV1,
  deepFreezeProviderPointDetachedDataTreeV1,
  walkProviderPointRawJsonIdentityTreeV1,
} from "./provider-point-raw-admission-internal.js";
import {
  createProviderNonThenableFrozenRecordV1,
  createProviderPointFulfilledPromiseV1,
  createProviderPointRejectedPromiseV1,
  hardenProviderPointPromiseV1,
} from "./provider-point-runtime-internal.js";
import {
  ProviderRegistryIsoTimestampV1Schema,
} from "./provider-registry-trust.js";
import {
  ProviderActiveWriterSelectorV1Schema,
  ProviderStrongReadyAcceptedConfigurationCandidateV1Schema,
  ProviderStrongReadyAcceptanceStateCandidateV1Schema,
  ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema,
  ProviderStrongReadyAcceptanceStateUnsignedCandidateV1Schema,
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
  type ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1,
} from "./provider-strong-ready-acceptance-candidate.js";
import {
  diagnoseProviderTrustedLocalPhysicalTargetCandidateV1,
  type ProviderTrustedLocalPhysicalTargetObservationCapabilityV1,
  type ProviderTrustedLocalPhysicalTargetSelectionCandidateValidationV1,
} from "./provider-trusted-local-physical-target-selection-candidate.js";
import {
  deriveProviderTrustedLocalStrongWriterSelectionCandidateInternalV1,
  isProviderTrustedLocalStrongWriterSelectionCandidateErrorInternalV1,
} from "./provider-trusted-local-strong-writer-selection-candidate-internal.js";
import {
  registerProviderStrongReadyBootstrapOrSteadyAcceptanceD41EndpointTrustBasisInternalV1,
} from "./provider-strong-ready-bootstrap-or-steady-acceptance-d41-endpoint-trust-basis-internal.js";
import type {
  ValidateProviderDistributionHistoryCurrentCandidatePointV1Input,
} from "./provider-distribution-history-current-candidate-point.js";
import type {
  ProviderStrictEd25519OpaqueCapabilityV1,
} from "./strict-ed25519-conformance.js";

const CapturedObjectFreezeV1 = Object.freeze;
const CapturedArrayPrototypeSliceV1 = Array.prototype.slice;
const CapturedTypeErrorV1 = TypeError;
const CapturedWeakSetV1 = WeakSet;
const CapturedWeakSetPrototypeAddV1 = WeakSet.prototype.add;
const CapturedWeakSetPrototypeHasV1 = WeakSet.prototype.has;
const CapturedReflectApplyV1 = Reflect.apply;
const CapturedMathMaxV1 = Math.max;
const CapturedTextEncoderV1 = TextEncoder;
const CapturedTextEncoderPrototypeEncodeV1 = TextEncoder.prototype.encode;
const CapturedObjectGetOwnPropertyDescriptorV1 =
  Object.getOwnPropertyDescriptor;
const CapturedObjectGetPrototypeOfV1 = Object.getPrototypeOf;
const CapturedMapV1 = Map;
const CapturedMapPrototypeHasV1 = Map.prototype.has;
const CapturedMapPrototypeSetV1 = Map.prototype.set;
const CapturedUint8ArrayV1 = Uint8Array;
const CapturedTypedArrayByteLengthGetterV1 =
  CapturedObjectGetOwnPropertyDescriptorV1(
    CapturedObjectGetPrototypeOfV1(CapturedUint8ArrayV1.prototype),
    "byteLength",
  )!.get!;
const CapturedUtf8EncoderV1 = CapturedObjectFreezeV1(
  new CapturedTextEncoderV1(),
);

function weakSetAddV1<T extends object>(
  set: WeakSet<T>,
  value: T,
): void {
  CapturedReflectApplyV1(CapturedWeakSetPrototypeAddV1, set, [value]);
}

function weakSetHasV1<T extends object>(
  set: WeakSet<T>,
  value: T,
): boolean {
  return CapturedReflectApplyV1(CapturedWeakSetPrototypeHasV1, set, [
    value,
  ]) as boolean;
}

function canonicalLogicalBytesV1(value: object): number {
  const encoded = CapturedReflectApplyV1(
    CapturedTextEncoderPrototypeEncodeV1,
    CapturedUtf8EncoderV1,
    [canonicalizeJcsSafeIntegerV1(value)],
  ) as Uint8Array;
  return CapturedReflectApplyV1(
    CapturedTypedArrayByteLengthGetterV1,
    encoded,
    [],
  ) as number;
}

function arraySliceV1<T>(value: readonly T[]): T[] {
  return CapturedReflectApplyV1(CapturedArrayPrototypeSliceV1, value, []) as
    T[];
}

function mapHasV1<K>(map: Map<K, unknown>, key: K): boolean {
  return CapturedReflectApplyV1(CapturedMapPrototypeHasV1, map, [
    key,
  ]) as boolean;
}

function mapSetV1<K, V>(map: Map<K, V>, key: K, value: V): void {
  CapturedReflectApplyV1(CapturedMapPrototypeSetV1, map, [key, value]);
}

export const PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_COMPARE_APPEND_CLOSURE_REFERENCE_CANDIDATE_AUTHORITY_V1 =
  "none_provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_closure_reference_candidate_only" as const;

export const ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureInvalidStageReferenceCandidateV1Schema =
  z.enum([
    "input",
    "identity_verification_capability",
    "reference_machine_capability",
    "acceptance_compare_append_request",
    "acceptance_receipt_ledger",
    "acceptance_capacity",
    "acceptance_namespace",
    "expected_current",
    "physical_target_selection",
    "candidate",
    "generation_floors",
    "acceptance_receipt",
    "atomic_resolution",
    "post_state_closure",
  ]);
export type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureInvalidStageReferenceCandidateV1 =
  z.infer<
    typeof ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureInvalidStageReferenceCandidateV1Schema
  >;

export const ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureInvalidReasonReferenceCandidateV1Schema =
  z.enum([
    "schema_invalid",
    "capability_invalid",
    "source_invalid",
    "ledger_integrity_failed",
    "receipt_capacity_exhausted",
    "namespace_integrity_failed",
    "expected_current_changed",
    "candidate_invalid",
    "generation_floor_regressed",
    "operation_nonce_request_mismatch",
    "post_state_invalid",
  ]);
export type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureInvalidReasonReferenceCandidateV1 =
  z.infer<
    typeof ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureInvalidReasonReferenceCandidateV1Schema
  >;

function canonicalEqualV1(left: unknown, right: unknown): boolean {
  return canonicalizeJcsSafeIntegerV1(left) ===
    canonicalizeJcsSafeIntegerV1(right);
}

function resultReceiptV1(
  result: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendResultReferenceCandidateV1,
): ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1 {
  return result.resolution === "resolved"
    ? result.receipt
    : result.existingReceipt;
}

const ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateNamespaceAbsentV1Schema =
  z.strictObject({ state: z.literal("absent") });
const ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateNamespaceCurrentV1Schema =
  z.strictObject({
    state: z.literal("current"),
    currentRead: ProviderStrongReadyBootstrapOrSteadyAcceptanceCurrentReadReferenceCandidateV1Schema,
    generations: z
      .array(ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema)
      .min(1)
      .max(
        PROVIDER_TRUST_HISTORY_POLICY_V1
          .maxAcceptanceGenerationCountPerInstallationIdentity,
      ),
  });
const ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateNamespaceIntegrityFailedV1Schema =
  z.strictObject({
    state: z.literal("integrity_failed"),
    evidenceDigest: ContentDigestV1Schema,
  });

function addClosureIssueV1(
  context: z.RefinementCtx,
  path: (string | number)[],
  message: string,
): void {
  context.addIssue({ code: "custom", path, message });
}

/**
 * Detached reference-machine snapshot.  This is deliberately a public
 * value schema rather than an alias of the package-private machine state
 * type, so the candidate ABI does not expose or authorize the machine seam.
 * It independently rechecks the public structural/digest/cross-reference
 * closure. Secret-key Acceptance/high-water/receipt token verification stays
 * inside the identity-bound machine and is completed before the adjacent
 * barrier publishes this snapshot.
 */
export const ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureStateReferenceCandidateV1Schema =
  z
    .strictObject({
      namespace: z.discriminatedUnion("state", [
        ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateNamespaceAbsentV1Schema,
        ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateNamespaceCurrentV1Schema,
        ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateNamespaceIntegrityFailedV1Schema,
      ]),
      receiptLedger: z.strictObject({
        profile: z.literal(
          "provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_receipt_ledger_reference_candidate_v1",
        ),
        installationIdentityGenerationId:
          ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1Schema.shape
            .installationIdentityGenerationId,
        entries: z
          .array(z.strictObject({
            linearizationOrdinal: z.number().int().min(1).max(
              PROVIDER_TRUST_HISTORY_POLICY_V1
                .maxAcceptanceCompareAppendReceiptCountPerInstallationIdentity,
            ),
            operationNonce:
              ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1Schema
                .shape.operationNonce,
            contentDigest: ContentDigestV1Schema,
            receipt:
              ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1Schema,
          }))
          .max(
            PROVIDER_TRUST_HISTORY_POLICY_V1
              .maxAcceptanceCompareAppendReceiptCountPerInstallationIdentity,
          ),
        receiptCount: z.number().int().min(0).max(
          PROVIDER_TRUST_HISTORY_POLICY_V1
            .maxAcceptanceCompareAppendReceiptCountPerInstallationIdentity,
        ),
        receiptSetDigest: ContentDigestV1Schema,
        receiptLogicalBytes: z.number().int().min(0).max(
          PROVIDER_TRUST_HISTORY_POLICY_V1
            .maxAcceptanceCompareAppendReceiptLogicalBytesPerInstallationIdentity,
        ),
      }),
    })
    .superRefine((state, context) => {
      const ledgerIdentity =
        state.receiptLedger.installationIdentityGenerationId;
      const receiptsByNonce = new CapturedMapV1<string, true>();
      let receiptLogicalBytes = 0;
      const ledgerEntries = state.receiptLedger.entries;
      const receiptDigestEntries: Readonly<{
        readonly linearizationOrdinal: number;
        readonly operationNonce: string;
        readonly contentDigest: string;
      }>[] = [];
      for (let index = 0; index < ledgerEntries.length; index += 1) {
        const entry = ledgerEntries[index]!;
        const receipt = entry.receipt;
        const request = receipt.payload.requestReferenceProjection;
        const candidate = request.candidate;
        if (
          entry.linearizationOrdinal !== index + 1 ||
          entry.linearizationOrdinal !== receipt.payload.linearizationOrdinal ||
          entry.operationNonce !== receipt.operationNonce ||
          entry.contentDigest !== receipt.contentDigest
        ) {
          addClosureIssueV1(
            context,
            ["receiptLedger", "entries", index],
            "receipt ledger entries must be sorted and exact-bind each receipt",
          );
        }
        const receiptBytes = canonicalLogicalBytesV1(receipt);
        receiptLogicalBytes += receiptBytes;
        if (
          receiptBytes >
            PROVIDER_TRUST_HISTORY_POLICY_V1
              .maxSingleAcceptanceCompareAppendReceiptLogicalBytes
        ) {
          addClosureIssueV1(
            context,
            ["receiptLedger", "entries", index, "receipt"],
            "each receipt must fit the reference policy's single-receipt bound",
          );
        }
        receiptDigestEntries[index] = {
          linearizationOrdinal: entry.linearizationOrdinal,
          operationNonce: entry.operationNonce,
          contentDigest: entry.contentDigest,
        };
        if (mapHasV1(receiptsByNonce, receipt.operationNonce)) {
          addClosureIssueV1(
            context,
            ["receiptLedger", "entries", index, "operationNonce"],
            "reference receipt nonces must be unique",
          );
        } else {
          mapSetV1(receiptsByNonce, receipt.operationNonce, true);
        }
        if (
          receipt.installationIdentityGenerationId !== ledgerIdentity ||
          receipt.payload.installationIdentityGenerationId !== ledgerIdentity ||
          request.installationIdentityGenerationId !== ledgerIdentity ||
          candidate.installationIdentityGenerationId !== ledgerIdentity ||
          candidate.payload.installationIdentityGenerationId !== ledgerIdentity
        ) {
          addClosureIssueV1(
            context,
            ["receiptLedger", "entries", index, "receipt"],
            "each receipt outer value, payload, request, and candidate must belong to the ledger Installation Identity",
          );
        }
        const outcome = receipt.payload.referenceOutcome;
        if (
          outcome.outcome === "committed" &&
          outcome.committedHighWater.payload
              .installationIdentityGenerationId !== ledgerIdentity
        ) {
          addClosureIssueV1(
            context,
            ["receiptLedger", "entries", index, "receipt", "payload", "referenceOutcome", "committedHighWater"],
            "each committed high-water must belong to the ledger Installation Identity",
          );
        }
        if (
          outcome.outcome === "not_committed" &&
          outcome.observedHighWater.state === "trusted" &&
          outcome.observedHighWater.highWater.payload
              .installationIdentityGenerationId !== ledgerIdentity
        ) {
          addClosureIssueV1(
            context,
            ["receiptLedger", "entries", index, "receipt", "payload", "referenceOutcome", "observedHighWater"],
            "each observed high-water must belong to the ledger Installation Identity",
          );
        }
      }
      if (
        state.receiptLedger.receiptCount !== ledgerEntries.length ||
        state.receiptLedger.receiptLogicalBytes !== receiptLogicalBytes ||
        state.receiptLedger.receiptSetDigest !==
          deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptSetDigestCandidateInternalV1(
            {
              installationIdentityGenerationId:
                state.receiptLedger.installationIdentityGenerationId,
              entries: receiptDigestEntries,
            },
          )
      ) {
        addClosureIssueV1(
          context,
          ["receiptLedger"],
          "receipt ledger count, set digest, and logical bytes must bind the exact entries",
        );
      }

      // An explicitly integrity-failed namespace is a bounded observation of
      // state that cannot be reconstructed as a trusted Acceptance history.
      // The enclosing validation below binds the returned failure receipt to
      // this exact evidence digest. Trusted absent/current snapshots continue
      // through the independent ordinal replay below.
      if (state.namespace.state === "integrity_failed") return;

      let reconstructedHighWater:
        ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1 | undefined;
      const reconstructedEntries:
        ProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationEnumerationEntryReferenceCandidateV1[] = [];
      const reconstructedGenerations:
        ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1[] = [];
      let rootMetadataGenerationFloor = 0;
      let registryManifestGenerationFloor = 0;
      let supportCatalogGenerationFloor = 0;
      for (let index = 0; index < ledgerEntries.length; index += 1) {
        const receipt = ledgerEntries[index]!.receipt;
        const outcome = receipt.payload.referenceOutcome;
        const expectedObservation = reconstructedHighWater === undefined
          ? { state: "absent" as const }
          : {
            state: "trusted" as const,
            highWater: reconstructedHighWater,
          };
        if (outcome.outcome === "not_committed") {
          if (
            !canonicalEqualV1(
              outcome.observedHighWater,
              expectedObservation,
            )
          ) {
            addClosureIssueV1(
              context,
              ["receiptLedger", "entries", index, "receipt", "payload", "referenceOutcome", "observedHighWater"],
              "a non-commit must observe the exact reconstructed pre-state high-water and must not advance it",
            );
          }
          continue;
        }

        const request = receipt.payload.requestReferenceProjection;
        const generation = request.candidate;
        const expectedRequestCurrent = reconstructedHighWater === undefined
          ? {
            state: "genesis" as const,
            expectedNamespaceState: "absent" as const,
          }
          : {
            state: "current" as const,
            highWaterRevision:
              reconstructedHighWater.payload.highWaterRevision,
            highWaterContentDigest: reconstructedHighWater.contentDigest,
            currentVersionToken:
              reconstructedHighWater.currentVersionToken,
            generationCount:
              reconstructedHighWater.payload.generationCount,
            generationSetDigest:
              reconstructedHighWater.payload.generationSetDigest,
          };
        const expectedGenerationPredecessor = reconstructedHighWater === undefined
          ? { state: "genesis" as const }
          : {
            state: "acceptance" as const,
            generationId:
              reconstructedHighWater.payload.currentAcceptance.generationId,
            contentDigest:
              reconstructedHighWater.payload.currentAcceptance.contentDigest,
          };
        const expectedAppendedGeneration = {
          locatorProfile: "installation_provider_acceptance_state_v1" as const,
          acceptanceOrdinal: reconstructedEntries.length + 1,
          generationId: generation.generationId,
          contentDigest: generation.contentDigest,
          commitOperationNonce: receipt.operationNonce,
          predecessor: expectedGenerationPredecessor,
        };
        const nextEntries = arraySliceV1(reconstructedEntries);
        nextEntries[nextEntries.length] = expectedAppendedGeneration;
        const highWater = outcome.committedHighWater;
        const core = generation.payload.configuration.core;
        rootMetadataGenerationFloor = CapturedReflectApplyV1(
          CapturedMathMaxV1,
          undefined,
          [
          rootMetadataGenerationFloor,
          core.activeRootMetadata.rootGeneration,
          ],
        ) as number;
        registryManifestGenerationFloor = CapturedReflectApplyV1(
          CapturedMathMaxV1,
          undefined,
          [
          registryManifestGenerationFloor,
          core.providerRegistryManifest.manifestGeneration,
          ],
        ) as number;
        supportCatalogGenerationFloor = CapturedReflectApplyV1(
          CapturedMathMaxV1,
          undefined,
          [
          supportCatalogGenerationFloor,
          core.providerSupportCatalog.catalogGeneration,
          ],
        ) as number;
        const expectedFloors = {
          rootMetadataGeneration: rootMetadataGenerationFloor,
          registryManifestGeneration: registryManifestGenerationFloor,
          supportCatalogGeneration: supportCatalogGenerationFloor,
        };
        const expectedHighWaterPredecessor =
          reconstructedHighWater === undefined
            ? {
              state: "genesis" as const,
              expectedNamespaceState: "absent" as const,
            }
            : {
              state: "version" as const,
              highWaterRevision:
                reconstructedHighWater.payload.highWaterRevision,
              contentDigest: reconstructedHighWater.contentDigest,
              currentVersionToken:
                reconstructedHighWater.currentVersionToken,
            };
        const expectedHighWaterPayload = {
          profile:
            "provider_strong_ready_bootstrap_or_steady_acceptance_high_water_reference_candidate_v1" as const,
          installationIdentityGenerationId: ledgerIdentity,
          highWaterRevision: nextEntries.length,
          operationNonce: receipt.operationNonce,
          predecessor: expectedHighWaterPredecessor,
          currentAcceptance: {
            locatorProfile:
              "installation_provider_acceptance_state_v1" as const,
            acceptanceOrdinal: nextEntries.length,
            generationId: generation.generationId,
            contentDigest: generation.contentDigest,
          },
          generationCount: nextEntries.length,
          generationSetDigest:
            deriveProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationSetDigestReferenceCandidateV1({
              entries: nextEntries,
            }),
          acceptedGenerationFloors: expectedFloors,
        };
        if (
          !canonicalEqualV1(request.expected, expectedRequestCurrent) ||
          !canonicalEqualV1(
            generation.payload.predecessor,
            expectedGenerationPredecessor,
          ) ||
          generation.payload.acceptanceOrdinal !== nextEntries.length ||
          !canonicalEqualV1(
            outcome.appendedGeneration,
            expectedAppendedGeneration,
          ) ||
          !canonicalEqualV1(highWater.payload, expectedHighWaterPayload)
        ) {
          addClosureIssueV1(
            context,
            ["receiptLedger", "entries", index, "receipt", "payload", "referenceOutcome"],
            "a commit must exactly advance the reconstructed expected current, generation predecessor, enumeration entry, and high-water",
          );
        }
        reconstructedEntries[reconstructedEntries.length] =
          outcome.appendedGeneration;
        reconstructedGenerations[reconstructedGenerations.length] = generation;
        reconstructedHighWater = highWater;
      }

      if (state.namespace.state === "current") {
        if (
          state.namespace.currentRead.enumeration
              .installationIdentityGenerationId !== ledgerIdentity ||
          state.namespace.currentRead.highWater.payload
              .installationIdentityGenerationId !== ledgerIdentity
        ) {
          addClosureIssueV1(
            context,
            ["namespace", "currentRead"],
            "the current enumeration and high-water must belong to the ledger Installation Identity",
          );
        }
        for (
          let index = 0;
          index < state.namespace.generations.length;
          index += 1
        ) {
          const generation = state.namespace.generations[index]!;
          if (
            generation.installationIdentityGenerationId !== ledgerIdentity ||
            generation.payload.installationIdentityGenerationId !==
              ledgerIdentity
          ) {
            addClosureIssueV1(
              context,
              ["namespace", "generations", index],
              "each retained generation must belong to the ledger Installation Identity",
            );
          }
        }
      }

      const expectedNamespace = reconstructedHighWater === undefined
        ? { state: "absent" as const }
        : {
          state: "current" as const,
          currentRead: {
            profile:
              "provider_strong_ready_bootstrap_or_steady_acceptance_current_read_reference_candidate_v1" as const,
            highWater: reconstructedHighWater,
            enumeration: {
              profile:
                "provider_strong_ready_bootstrap_or_steady_acceptance_generation_enumeration_reference_candidate_v1" as const,
              installationIdentityGenerationId: ledgerIdentity,
              namespaceRevision: reconstructedEntries.length,
              entries: reconstructedEntries,
              generationCount: reconstructedEntries.length,
              generationSetDigest:
                deriveProviderStrongReadyBootstrapOrSteadyAcceptanceGenerationSetDigestReferenceCandidateV1({
                  entries: reconstructedEntries,
                }),
            },
          },
          generations: reconstructedGenerations,
        };
      if (!canonicalEqualV1(state.namespace, expectedNamespace)) {
        addClosureIssueV1(
          context,
          ["namespace"],
          "the final namespace snapshot must exactly equal the ordinal receipt replay",
        );
      }
    });
export type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureStateReferenceCandidateV1 =
  z.infer<
    typeof ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureStateReferenceCandidateV1Schema
  >;

export const ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureValidationReferenceCandidateV1Schema =
  z
    .strictObject({
      authority: z.literal(
        PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_COMPARE_APPEND_CLOSURE_REFERENCE_CANDIDATE_AUTHORITY_V1,
      ),
      acceptanceCompareAppendRequest:
        ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1Schema,
      requestContentDigest:
        ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptPinReferenceCandidateV1Schema.shape
          .contentDigest,
      compareAppendResult:
        ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendResultReferenceCandidateV1Schema,
      compareAppendReceiptPin:
        ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptPinReferenceCandidateV1Schema,
      referenceState:
        ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureStateReferenceCandidateV1Schema,
    })
    .superRefine((validation, context) => {
      const expectedRequestDigest =
        deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1(
          validation.acceptanceCompareAppendRequest,
        );
      if (validation.requestContentDigest !== expectedRequestDigest) {
        context.addIssue({
          code: "custom",
          path: ["requestContentDigest"],
          message: "requestContentDigest must bind the retained reference request",
        });
      }
      const receipt = resultReceiptV1(validation.compareAppendResult);
      if (validation.compareAppendResult.resolution === "resolved") {
        if (
          !canonicalEqualV1(
            validation.acceptanceCompareAppendRequest,
            receipt.payload.requestReferenceProjection,
          ) ||
          validation.requestContentDigest !==
            receipt.payload.requestContentDigest
        ) {
          context.addIssue({
            code: "custom",
            path: ["compareAppendResult"],
            message:
              "resolved receipt must close over the submitted reference request",
          });
        }
      } else if (
        validation.acceptanceCompareAppendRequest.operationNonce !==
          receipt.operationNonce ||
        validation.acceptanceCompareAppendRequest
            .installationIdentityGenerationId !==
          receipt.installationIdentityGenerationId ||
        validation.requestContentDigest ===
          receipt.payload.requestContentDigest
      ) {
        context.addIssue({
          code: "custom",
          path: ["compareAppendResult"],
          message:
            "nonce-mismatch rejection must retain a different submitted request and the existing receipt",
        });
      }
      const expectedReceiptPin =
        deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptPinReferenceCandidateV1(receipt);
      if (
        !canonicalEqualV1(
          validation.compareAppendReceiptPin,
          expectedReceiptPin,
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["compareAppendReceiptPin"],
          message: "receipt Pin must bind the returned immutable receipt",
        });
      }
      let matchingReceiptCount = 0;
      for (
        let index = 0;
        index < validation.referenceState.receiptLedger.entries.length;
        index += 1
      ) {
        const retained =
          validation.referenceState.receiptLedger.entries[index]!.receipt;
        if (
          retained.operationNonce === receipt.operationNonce &&
          canonicalEqualV1(retained, receipt)
        ) {
          matchingReceiptCount += 1;
        }
      }
      if (matchingReceiptCount !== 1) {
        context.addIssue({
          code: "custom",
          path: ["referenceState", "receiptLedger"],
          message:
            "the returned receipt must occur exactly once in the retained reference ledger",
        });
      }
      if (
        validation.referenceState.receiptLedger
          .installationIdentityGenerationId !==
          validation.acceptanceCompareAppendRequest
            .installationIdentityGenerationId
      ) {
        context.addIssue({
          code: "custom",
          path: ["referenceState", "receiptLedger"],
          message:
            "the reference receipt ledger must belong to the submitted Installation Identity",
        });
      }
      const namespace = validation.referenceState.namespace;
      if (
        namespace.state === "current" &&
        namespace.currentRead.enumeration.installationIdentityGenerationId !==
          validation.acceptanceCompareAppendRequest
            .installationIdentityGenerationId
      ) {
        context.addIssue({
          code: "custom",
          path: ["referenceState", "namespace"],
          message:
            "the reference namespace must belong to the submitted Installation Identity",
        });
      }
      if (namespace.state === "integrity_failed") {
        const outcome = receipt.payload.referenceOutcome;
        if (
          validation.compareAppendResult.resolution !== "resolved" ||
          outcome.outcome !== "not_committed" ||
          outcome.reason !== "namespace_integrity_failed" ||
          outcome.observedHighWater.state !== "integrity_failed" ||
          outcome.observedHighWater.evidenceDigest !==
            namespace.evidenceDigest
        ) {
          context.addIssue({
            code: "custom",
            path: ["referenceState", "namespace"],
            message:
              "an integrity-failed snapshot requires its exact reference namespace-failure receipt",
          });
        }
      }
    });
export type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureValidationReferenceCandidateV1 =
  z.infer<
    typeof ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureValidationReferenceCandidateV1Schema
  >;

export interface CreateProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1Input {
  readonly distributionHistoryCandidate: unknown;
  readonly physicalTargetObservationCapability:
    ProviderTrustedLocalPhysicalTargetObservationCapabilityV1;
  readonly acceptanceCompareAppendRequest:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1;
  readonly resolvedAt: ReturnType<
    typeof ProviderRegistryIsoTimestampV1Schema.parse
  >;
  readonly identityVerificationCapability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
  readonly referenceMachineCapability:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1;
}

/**
 * Consume an already-minted, package-authentic Installation Identity
 * capability to verify one exact strong-ready Acceptance envelope.  The
 * capability remains opaque: this seam neither serializes nor mints it and
 * grants no provider or compare-append authority.
 */
export async function verifyProviderStrongReadyAcceptanceEnvelopeTokenWithIdentityCapabilityV1(
  identityVerificationCapability: ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
  acceptanceStateEnvelope: unknown,
): Promise<boolean> {
  try {
    const envelope =
      ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema.parse(
        acceptanceStateEnvelope,
      );
    if (
      envelope.generationId !== envelope.payload.generationId ||
      envelope.installationIdentityGenerationId !==
        envelope.payload.installationIdentityGenerationId ||
      envelope.acceptedAt !== envelope.payload.acceptedAt ||
      envelope.contentDigest !==
        deriveProviderStrongReadyAcceptanceStateContentDigestV1(
          envelope.payload,
        )
    ) {
      return false;
    }
    return await verifyProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
      identityVerificationCapability,
      envelope.installationIdentityGenerationId,
      envelope.payload,
      envelope.payload.acceptanceToken,
    );
  } catch {
    return false;
  }
}

interface AcceptanceCompareAppendClosureDiagnosticFailureV1 {
  readonly ok: false;
  readonly stage:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureInvalidStageReferenceCandidateV1;
  readonly reason:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureInvalidReasonReferenceCandidateV1;
}

interface AcceptanceCompareAppendClosureDiagnosticSuccessV1 {
  readonly ok: true;
  readonly value:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureValidationReferenceCandidateV1;
}

export type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureDiagnosticResultReferenceCandidateV1 =
  | AcceptanceCompareAppendClosureDiagnosticFailureV1
  | AcceptanceCompareAppendClosureDiagnosticSuccessV1;

export class ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateValidationError
  extends CapturedTypeErrorV1 {
  readonly code = "provider_unavailable" as const;
  readonly reason = "attestation_invalid" as const;

  constructor() {
    super("Provider Acceptance compare-append closure/reference candidate failed");
    this.name =
      "ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateValidationError";
    CapturedObjectFreezeV1(this);
  }
}

class AcceptanceCompareAppendClosureDiagnosticSignalV1 extends CapturedTypeErrorV1 {
  constructor(
    readonly stage:
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureInvalidStageReferenceCandidateV1,
    readonly reason:
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureInvalidReasonReferenceCandidateV1,
  ) {
    super("provider Acceptance compare-append closure diagnostic");
    weakSetAddV1(acceptanceCompareAppendClosureDiagnosticSignalsV1, this);
    CapturedObjectFreezeV1(this);
  }
}

const acceptanceCompareAppendClosureDiagnosticSignalsV1 =
  new CapturedWeakSetV1<object>();

function isDiagnosticSignalV1(
  value: unknown,
): value is AcceptanceCompareAppendClosureDiagnosticSignalV1 {
  return typeof value === "object" && value !== null &&
    weakSetHasV1(acceptanceCompareAppendClosureDiagnosticSignalsV1, value);
}

function failV1(
  stage: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureInvalidStageReferenceCandidateV1,
  reason:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureInvalidReasonReferenceCandidateV1,
): never {
  throw new AcceptanceCompareAppendClosureDiagnosticSignalV1(stage, reason);
}

const CREATE_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "acceptanceCompareAppendRequest",
  "distributionHistoryCandidate",
  "identityVerificationCapability",
  "physicalTargetObservationCapability",
  "referenceMachineCapability",
  "resolvedAt",
] as const);

const DISTRIBUTION_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "bootstrapTrustBundle",
  "distributionRootBinding",
  "installationIdentityGenerationId",
  "rootMetadataHistory",
  "registryManifestHistory",
  "publicSupportTaxonomyHistory",
  "releaseMatrixHistory",
  "targetDiscoveryResultHistory",
  "releaseTargetUniverseHistory",
  "providerFeasibilitySupportCatalogHistory",
  "targetDiscoveryFixtureManifests",
  "targetDiscoveryRunnerRuns",
  "realFilesystemSuiteManifests",
  "realFilesystemFixtureCorpusManifests",
  "providerFeasibilitySupportCandidateArtifacts",
  "strictCryptoCapability",
] as const);
const REQUEST_INPUT_KEYS_V1 = CapturedObjectFreezeV1([
  "candidate",
  "expected",
  "installationIdentityGenerationId",
  "operationNonce",
  "profile",
] as const);

const MAX_D40_DISTRIBUTION_OBSERVED_IDENTITIES_V1 = 4_194_304;
const MAX_D40_DISTRIBUTION_PRECLONE_WORK_UNITS_V1 = 268_435_456;
const MAX_D40_DISTRIBUTION_DEPTH_V1 = 64;
const MAX_D40_DISTRIBUTION_BRANCH_UNITS_V1 = 268_435_456;

function freezeDetachedDistributionBranchV1(value: unknown): unknown {
  return value !== null && typeof value === "object"
    ? deepFreezeProviderPointDetachedDataTreeV1(value)
    : value;
}

/**
 * Captures the full C09-1N request before the machine queue is claimed.  The
 * opaque strict-crypto handle is retained by identity; every serializable
 * branch is traversed without getters, cloned once, and recursively frozen.
 */
function captureDistributionHistoryCandidateV1(input: unknown): unknown {
  const admission = createProviderPointRawAdmissionSessionV1(input, {
    maxObservedIdentities:
      MAX_D40_DISTRIBUTION_OBSERVED_IDENTITIES_V1,
    maxPrecloneAllocationWorkUnits:
      MAX_D40_DISTRIBUTION_PRECLONE_WORK_UNITS_V1,
  });
  const captured = captureProviderPointRawExactTopLevelV1(
    admission,
    DISTRIBUTION_INPUT_KEYS_V1,
  );
  const strictCryptoCapability = captured.strictCryptoCapability;
  for (let index = 0; index < DISTRIBUTION_INPUT_KEYS_V1.length; index += 1) {
    const key = DISTRIBUTION_INPUT_KEYS_V1[index]!;
    if (key === "strictCryptoCapability") continue;
    const value = captured[key];
    if (value === null || typeof value !== "object") continue;
    const budget = createProviderPointRawAdmissionBudgetForSessionV1(
      admission,
      MAX_D40_DISTRIBUTION_DEPTH_V1,
      MAX_D40_DISTRIBUTION_BRANCH_UNITS_V1,
      MAX_D40_DISTRIBUTION_BRANCH_UNITS_V1,
      MAX_D40_DISTRIBUTION_BRANCH_UNITS_V1,
    );
    walkProviderPointRawJsonIdentityTreeV1(admission, value, budget);
  }
  const detached = captureProviderPointDetachedExactDataObjectV1(
    cloneProviderPointRawAdmissionCapsuleV1(admission),
    DISTRIBUTION_INPUT_KEYS_V1,
  );
  return createProviderNonThenableFrozenRecordV1({
    bootstrapTrustBundle:
      freezeDetachedDistributionBranchV1(detached.bootstrapTrustBundle),
    distributionRootBinding:
      freezeDetachedDistributionBranchV1(detached.distributionRootBinding),
    installationIdentityGenerationId:
      detached.installationIdentityGenerationId,
    rootMetadataHistory:
      freezeDetachedDistributionBranchV1(detached.rootMetadataHistory),
    registryManifestHistory:
      freezeDetachedDistributionBranchV1(detached.registryManifestHistory),
    publicSupportTaxonomyHistory:
      freezeDetachedDistributionBranchV1(
        detached.publicSupportTaxonomyHistory,
      ),
    releaseMatrixHistory:
      freezeDetachedDistributionBranchV1(detached.releaseMatrixHistory),
    targetDiscoveryResultHistory:
      freezeDetachedDistributionBranchV1(
        detached.targetDiscoveryResultHistory,
      ),
    releaseTargetUniverseHistory:
      freezeDetachedDistributionBranchV1(
        detached.releaseTargetUniverseHistory,
      ),
    providerFeasibilitySupportCatalogHistory:
      freezeDetachedDistributionBranchV1(
        detached.providerFeasibilitySupportCatalogHistory,
      ),
    targetDiscoveryFixtureManifests:
      freezeDetachedDistributionBranchV1(
        detached.targetDiscoveryFixtureManifests,
      ),
    targetDiscoveryRunnerRuns:
      freezeDetachedDistributionBranchV1(detached.targetDiscoveryRunnerRuns),
    realFilesystemSuiteManifests:
      freezeDetachedDistributionBranchV1(
        detached.realFilesystemSuiteManifests,
      ),
    realFilesystemFixtureCorpusManifests:
      freezeDetachedDistributionBranchV1(
        detached.realFilesystemFixtureCorpusManifests,
      ),
    providerFeasibilitySupportCandidateArtifacts:
      freezeDetachedDistributionBranchV1(
        detached.providerFeasibilitySupportCandidateArtifacts,
      ),
    strictCryptoCapability,
  });
}

function captureAcceptanceCompareAppendRequestV1(input: unknown): unknown {
  const admission = createProviderPointRawAdmissionSessionV1(input, {
    maxObservedIdentities: 1_048_576,
    maxPrecloneAllocationWorkUnits: 16_777_216,
  });
  const captured = captureProviderPointRawExactTopLevelV1(
    admission,
    REQUEST_INPUT_KEYS_V1,
  );
  for (let index = 0; index < REQUEST_INPUT_KEYS_V1.length; index += 1) {
    const value = captured[REQUEST_INPUT_KEYS_V1[index]!];
    if (value === null || typeof value !== "object") continue;
    const budget = createProviderPointRawAdmissionBudgetForSessionV1(
      admission,
      64,
      16_777_216,
      16_777_216,
      16_777_216,
    );
    walkProviderPointRawJsonIdentityTreeV1(admission, value, budget);
  }
  return deepFreezeProviderPointDetachedDataTreeV1(
    captureProviderPointDetachedExactDataObjectV1(
      cloneProviderPointRawAdmissionCapsuleV1(admission),
      REQUEST_INPUT_KEYS_V1,
    ),
  );
}

function captureCreateInputV1(
  input: unknown,
): Readonly<Record<(typeof CREATE_INPUT_KEYS_V1)[number], unknown>> {
  try {
    return captureProviderPointDetachedExactDataObjectV1(
      input,
      CREATE_INPUT_KEYS_V1,
    ) as Readonly<Record<(typeof CREATE_INPUT_KEYS_V1)[number], unknown>>;
  } catch {
    return failV1("input", "schema_invalid");
  }
}

async function deriveTransactionDecisionV1(
  fields: Readonly<Record<(typeof CREATE_INPUT_KEYS_V1)[number], unknown>>,
  request: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1,
  captureCommittedSelection: (
    selection: ProviderTrustedLocalPhysicalTargetSelectionCandidateValidationV1,
  ) => void,
): Promise<ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceTransactionDecisionInternalV1> {
  const selectionDiagnostic =
    await diagnoseProviderTrustedLocalPhysicalTargetCandidateV1({
      distributionHistoryCandidate: fields.distributionHistoryCandidate,
      physicalTargetObservationCapability:
        fields.physicalTargetObservationCapability as
          ProviderTrustedLocalPhysicalTargetObservationCapabilityV1,
    });
  if (!selectionDiagnostic.ok) {
    return failV1(
      "physical_target_selection",
      selectionDiagnostic.reason === "capability_invalid"
        ? "capability_invalid"
        : "source_invalid",
    );
  }

  let selectedActiveWriter;
  try {
    selectedActiveWriter =
      deriveProviderTrustedLocalStrongWriterSelectionCandidateInternalV1(
        selectionDiagnostic.value,
      ).selectedActiveWriter;
  } catch (error) {
    if (
      isProviderTrustedLocalStrongWriterSelectionCandidateErrorInternalV1(
        error,
      )
    ) {
      return createProviderNonThenableFrozenRecordV1({
        classification: "candidate_invalid" as const,
      });
    }
    return failV1("candidate", "source_invalid");
  }

  const registryClosure = selectionDiagnostic.value
    .distributionHistoryCandidate.catalogPointClosure
    .registryManifestHistoryClosure;
  if (
    registryClosure.installationIdentityGenerationId !==
      request.installationIdentityGenerationId
  ) {
    return createProviderNonThenableFrozenRecordV1({
      classification: "candidate_invalid" as const,
    });
  }

  try {
    const activeWriterSelector = ProviderActiveWriterSelectorV1Schema.parse({
      profile: "provider_active_writer_selector_v1",
      selections: [selectedActiveWriter],
    });
    const configuration =
      ProviderStrongReadyAcceptedConfigurationCandidateV1Schema.parse({
        state: "strong_ready",
        core: {
          activeRootMetadata: registryClosure.currentRootMetadata,
          providerRegistryManifest: registryClosure.currentRegistryManifest,
          providerSupportCatalog:
            selectionDiagnostic.value.providerFeasibilitySupportCatalogPin,
          activeWriterSelector,
        },
        activation: { origin: "bootstrap_or_steady_successor" },
      });
    const submitted = request.candidate;
    const generationId =
      deriveProviderStrongReadyAcceptanceStateGenerationIdV1({
        installationIdentityGenerationId:
          request.installationIdentityGenerationId,
        acceptanceOrdinal: submitted.payload.acceptanceOrdinal,
        predecessor: submitted.payload.predecessor,
        configuration,
      });
    const unsigned =
      ProviderStrongReadyAcceptanceStateUnsignedCandidateV1Schema.parse({
        profile: "provider_acceptance_state_v1",
        generationId,
        installationIdentityGenerationId:
          request.installationIdentityGenerationId,
        acceptanceOrdinal: submitted.payload.acceptanceOrdinal,
        predecessor: submitted.payload.predecessor,
        configuration,
        acceptedAt: submitted.acceptedAt,
      });
    const acceptanceToken =
      await deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
        fields.identityVerificationCapability,
        request.installationIdentityGenerationId,
        unsigned,
      );
    const state = ProviderStrongReadyAcceptanceStateCandidateV1Schema.parse({
      ...unsigned,
      acceptanceToken,
    });
    const contentDigest =
      deriveProviderStrongReadyAcceptanceStateContentDigestV1(state);
    const expected =
      ProviderStrongReadyAcceptanceStateEnvelopeCandidateV1Schema.parse({
        schemaVersion: 1,
        recordType: "provider_acceptance_state",
        generationId,
        installationIdentityGenerationId:
          request.installationIdentityGenerationId,
        acceptedAt: submitted.acceptedAt,
        contentDigest,
        payload: state,
      });
    deepFreezeProviderPointDetachedDataTreeV1(expected);
    if (!canonicalEqualV1(expected, submitted)) {
      return createProviderNonThenableFrozenRecordV1({
        classification: "candidate_invalid" as const,
      });
    }
    // Preserve the exact D-39 validation identity produced inside this D-40
    // transaction. Registration for D-41 happens only after the machine and
    // final public D-40 Validation have both succeeded.
    captureCommittedSelection(selectionDiagnostic.value);
    return createProviderNonThenableFrozenRecordV1({
      classification: "committed" as const,
      candidate: expected,
      acceptedGenerationFloors: createProviderNonThenableFrozenRecordV1({
        rootMetadataGeneration:
          configuration.core.activeRootMetadata.rootGeneration,
        registryManifestGeneration:
          configuration.core.providerRegistryManifest.manifestGeneration,
        supportCatalogGeneration:
          configuration.core.providerSupportCatalog.catalogGeneration,
      }),
    });
  } catch (error) {
    if (
      isProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityErrorInternalV1(error)
    ) {
      return failV1("identity_verification_capability", "capability_invalid");
    }
    return createProviderNonThenableFrozenRecordV1({
      classification: "candidate_invalid" as const,
    });
  }
}

function buildValidationV1(
  result: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendResultReferenceCandidateV1,
  submittedRequest: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1,
  referenceState: unknown,
): ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureValidationReferenceCandidateV1 {
  try {
    const receipt = resultReceiptV1(result);
    const validation =
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureValidationReferenceCandidateV1Schema
        .parse({
          authority:
            PROVIDER_STRONG_READY_BOOTSTRAP_OR_STEADY_ACCEPTANCE_COMPARE_APPEND_CLOSURE_REFERENCE_CANDIDATE_AUTHORITY_V1,
          acceptanceCompareAppendRequest: submittedRequest,
          requestContentDigest:
            deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1(
              submittedRequest,
            ),
          compareAppendResult: result,
          compareAppendReceiptPin:
            deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptPinReferenceCandidateV1(
              receipt,
            ),
          referenceState,
        });
    return deepFreezeProviderPointDetachedDataTreeV1(validation);
  } catch {
    return failV1("post_state_closure", "post_state_invalid");
  }
}

async function createInternalV1(
  input: unknown,
): Promise<ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureValidationReferenceCandidateV1> {
  const fields = captureCreateInputV1(input);
  let distributionHistoryCandidate: unknown;
  let acceptanceCompareAppendRequest: unknown;
  try {
    distributionHistoryCandidate = captureDistributionHistoryCandidateV1(
      fields.distributionHistoryCandidate,
    );
    acceptanceCompareAppendRequest =
      captureAcceptanceCompareAppendRequestV1(
        fields.acceptanceCompareAppendRequest,
      );
  } catch {
    return failV1("input", "schema_invalid");
  }
  const capturedFields = createProviderNonThenableFrozenRecordV1({
    ...fields,
    acceptanceCompareAppendRequest,
    distributionHistoryCandidate,
  }) as Readonly<Record<(typeof CREATE_INPUT_KEYS_V1)[number], unknown>>;
  let committedSelection:
    | ProviderTrustedLocalPhysicalTargetSelectionCandidateValidationV1
    | undefined;
  let transactionInvoked = false;
  const operation =
    executeProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1({
      identityVerificationCapability:
        fields.identityVerificationCapability as
          ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
      referenceMachineCapability:
        fields.referenceMachineCapability as
          ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1,
      request: capturedFields.acceptanceCompareAppendRequest as
        ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1,
      resolvedAt: fields.resolvedAt as ReturnType<
        typeof ProviderRegistryIsoTimestampV1Schema.parse
      >,
      transaction: ({ request }) => {
        transactionInvoked = true;
        return deriveTransactionDecisionV1(
          capturedFields,
          request,
          (selection) => {
            if (committedSelection !== undefined) {
              return failV1("candidate", "source_invalid");
            }
            committedSelection = selection;
          },
        );
      },
    });
  let referenceStateOperation: Promise<unknown>;
  try {
    referenceStateOperation =
      captureProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineStateAfterPendingInternalV1(
        fields.referenceMachineCapability as
          ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1,
      );
  } catch (error) {
    // Observe the machine operation as well; both failures are mapped through
    // the staged diagnostic/public opaque boundary below.
    await operation;
    throw error;
  }
  // Attach a rejection observer immediately. A wrong/cross-machine handle may
  // reject this barrier synchronously while the caller awaits the machine's
  // own rejection, and must never surface as an unhandled rejection.
  referenceStateOperation.catch(() => undefined);
  // `execute` synchronously validates both capabilities and captures the
  // reference request before returning its hardened Promise. Snapshotting the
  // public projection here therefore preserves the frozen security order and
  // cannot race an after-return caller mutation.
  let submittedRequest: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1;
  try {
    assertDataObjectDescriptorsBeforeSchemaV1(
      fields.acceptanceCompareAppendRequest,
    );
    assertJsonDataTreeBeforeSchemaV1(
      fields.acceptanceCompareAppendRequest,
    );
    submittedRequest = deepFreezeProviderPointDetachedDataTreeV1(
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1Schema.parse(
        capturedFields.acceptanceCompareAppendRequest,
      ),
    );
  } catch {
    // Prefer the machine's own staged rejection over a second parser's error.
    await operation;
    return failV1("acceptance_compare_append_request", "schema_invalid");
  }
  const result = await operation;
  const referenceState = await referenceStateOperation;
  const validation = buildValidationV1(
    result,
    submittedRequest,
    referenceState,
  );
  const receipt = resultReceiptV1(result);
  if (
    result.resolution === "resolved" &&
    receipt.payload.referenceOutcome.outcome === "committed"
  ) {
    if (committedSelection === undefined) {
      // Existing-nonce replay returns its original committed receipt without
      // invoking this call's transaction. It therefore has no new D-39
      // selection to register as a D-41 one-shot endpoint-trust basis.
      if (transactionInvoked) {
        return failV1("post_state_closure", "post_state_invalid");
      }
      return validation;
    }
    const distributionHistoryInput =
      capturedFields.distributionHistoryCandidate as
        ValidateProviderDistributionHistoryCurrentCandidatePointV1Input;
    try {
      const readOnlyContinuityHandle =
        mintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReadOnlyContinuityHandleInternalV1(
          fields.referenceMachineCapability as
            ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1,
          validation.referenceState,
        );
      registerProviderStrongReadyBootstrapOrSteadyAcceptanceD41EndpointTrustBasisInternalV1({
        acceptanceClosureIdentity: validation,
        distributionHistoryInput,
        distributionHistoryClosure:
          committedSelection.distributionHistoryCandidate,
        physicalTargetSelection: committedSelection,
        readOnlyContinuityHandle,
        strictCryptoCapability:
          distributionHistoryInput.strictCryptoCapability as
            ProviderStrictEd25519OpaqueCapabilityV1,
      });
    } catch {
      return failV1("post_state_closure", "post_state_invalid");
    }
  }
  return validation;
}

function diagnosticFailureV1(
  stage: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureInvalidStageReferenceCandidateV1,
  reason: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureInvalidReasonReferenceCandidateV1,
): AcceptanceCompareAppendClosureDiagnosticFailureV1 {
  return createProviderNonThenableFrozenRecordV1({
    ok: false as const,
    stage,
    reason,
  });
}

function diagnosticFailureFromErrorV1(
  error: unknown,
): AcceptanceCompareAppendClosureDiagnosticFailureV1 {
  if (isDiagnosticSignalV1(error)) {
    return diagnosticFailureV1(error.stage, error.reason);
  }
  if (isProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityErrorInternalV1(error)) {
    return diagnosticFailureV1(
      "identity_verification_capability",
      "capability_invalid",
    );
  }
  if (isProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineErrorInternalV1(error)) {
    return diagnosticFailureV1(error.stage, error.reason);
  }
  return diagnosticFailureV1("input", "source_invalid");
}

export function diagnoseCreateProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1(
  input: unknown,
): Promise<ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureDiagnosticResultReferenceCandidateV1> {
  let operation: Promise<
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureValidationReferenceCandidateV1
  >;
  try {
    operation = hardenProviderPointPromiseV1(createInternalV1(input));
  } catch (error) {
    return createProviderPointFulfilledPromiseV1(
      diagnosticFailureFromErrorV1(error),
    );
  }
  return operation.then(
    (value) =>
      createProviderNonThenableFrozenRecordV1({ ok: true as const, value }),
    (error) => diagnosticFailureFromErrorV1(error),
  );
}

export function createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1(
  input: CreateProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1Input,
): Promise<ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureValidationReferenceCandidateV1> {
  let operation: Promise<
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureValidationReferenceCandidateV1
  >;
  try {
    operation = hardenProviderPointPromiseV1(createInternalV1(input));
  } catch {
    return createProviderPointRejectedPromiseV1(
      new ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateValidationError(),
    );
  }
  return operation.then(
    (value) => value,
    () => {
      throw new ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateValidationError();
    },
  );
}

CapturedObjectFreezeV1(
  diagnoseCreateProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1,
);
CapturedObjectFreezeV1(
  createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1,
);
CapturedObjectFreezeV1(
  verifyProviderStrongReadyAcceptanceEnvelopeTokenWithIdentityCapabilityV1,
);
