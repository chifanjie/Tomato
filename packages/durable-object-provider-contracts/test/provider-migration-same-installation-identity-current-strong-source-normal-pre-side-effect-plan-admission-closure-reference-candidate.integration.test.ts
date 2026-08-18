import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it, vi } from "vitest";

const planEnvelopeActualBytesOverrideV1 = vi.hoisted(() => ({
  value: undefined as number | undefined,
}));

vi.mock("../src/jcs.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/jcs.js")>();
  return {
    ...actual,
    canonicalizeJcsSafeIntegerUtf8V1(value: unknown): Uint8Array {
      const override = planEnvelopeActualBytesOverrideV1.value;
      if (
        override !== undefined &&
        value !== null &&
        typeof value === "object" &&
        (value as { readonly recordType?: unknown }).recordType ===
          "provider_migration_same_installation_identity_current_strong_source_normal_plan_reference_candidate"
      ) {
        planEnvelopeActualBytesOverrideV1.value = undefined;
        return new Uint8Array(override);
      }
      return actual.canonicalizeJcsSafeIntegerUtf8V1(value);
    },
  };
});

import type { ProviderCryptoHostV1 } from "../src/domain-crypto.js";
import { canonicalizeJcsSafeIntegerV1 } from "../src/jcs.js";
import {
  CanonicalByteStringV1Schema,
  ContentDigestV1Schema,
  LowerHex32V1Schema,
  type ContentDigestV1,
} from "../src/primitives.js";
import {
  deriveInstallationIdentityKeyCheckTokenV1,
} from "../src/provider-foundation.js";
import {
  ProviderRegistryIsoTimestampV1Schema,
} from "../src/provider-registry-trust.js";
import {
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1,
} from "../src/provider-registry-manifest-fixtures.js";
import {
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
} from "../src/provider-registry-root-history-fixtures.js";
import {
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_PATH_V1,
} from "../src/provider-real-filesystem-source-fixtures.js";
import {
  deriveProviderStrongReadyAcceptanceStateContentDigestV1,
  deriveProviderStrongReadyAcceptanceStateGenerationIdV1,
} from "../src/provider-strong-ready-acceptance-candidate.js";
import {
  createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1,
} from "../src/provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-closure-reference-candidate.js";
import type {
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1,
} from "../src/provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-reference-candidate-wire.js";
import {
  deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1,
  mintProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1,
} from "../src/provider-strong-ready-bootstrap-or-steady-acceptance-identity-verification-capability-internal.js";
import {
  createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerCandidateInternalV1,
  executeProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1,
  mintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1,
  type ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1,
} from "../src/provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-reference-machine-internal.js";
import {
  deriveProviderTrustedLocalStrongWriterSelectionCandidateInternalV1,
} from "../src/provider-trusted-local-strong-writer-selection-candidate-internal.js";
import {
  selectProviderTrustedLocalPhysicalTargetCandidateV1,
  type ProviderTrustedLocalPhysicalTargetObservationCapabilityV1,
} from "../src/provider-trusted-local-physical-target-selection-candidate.js";
import {
  mintProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1,
} from "../src/provider-trusted-local-physical-target-observation-capability-internal.js";
import {
  PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  attestProviderStrictEd25519CryptoHostV1,
  type ProviderStrictEd25519OpaqueCapabilityV1,
} from "../src/strict-ed25519-conformance.js";
import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
  verifyRawEd25519,
} from "../src/strict-ed25519.js";
import {
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_ACCOUNT_STATE_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_EVENT_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_HIGH_WATER_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_HIGH_WATER_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_LEDGER_RECORD_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RECEIPT_ENVELOPE_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RECEIPT_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RESERVATION_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalInitialDestinationNamespaceReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceCandidateV1Schema,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountSetDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountStateContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageFromAccountsReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestAbsenceReferenceDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceDigestReferenceCandidateV1,
  verifyProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidatePublicHashDagAndEqualityV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-reference-candidate-wire.js";
import {
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateDiagnosticResultInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectAuditObserverInternalV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-pre-plan-reference-capability-internal.js";
import {
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedCatalogSourceCapabilityInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCapabilityInternalV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-prepared-catalog-successor-reference-capability-internal.js";
import {
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceCandidateInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceCapabilityInternalV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-formal-plan-publication-reference-capability-internal.js";
import {
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceCandidateInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceCapabilityInternalV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-migration-only-acceptance-reference-capability-internal.js";
import {
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedRebindingRegistryManifestSourceCapabilityInternalV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-rebinding-registry-successor-validator-internal.js";
import {
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSourceDrainedRegistryManifestSourceCapabilityInternalV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-source-drained-registry-successor-validator-internal.js";
import {
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSteadyRegistryManifestSourceCapabilityInternalV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-steady-registry-successor-validator-internal.js";
import {
  diagnoseProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveLifecycleReferenceOrchestratorInternalV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-zero-live-lifecycle-reference-orchestrator-internal.js";
import {
  type ProviderMigrationDurableExecutionHostCapabilityInternalV1,
} from "../src/provider-migration-durable-execution-orchestrator-internal.js";
import {
  runProviderMigrationDurableExecutionV1,
} from "../src/provider-migration-durable-execution-entrypoint.js";
import type {
  ProviderRuntimeIpcCompareCommitResultV1,
  ProviderRuntimeIpcFixedObjectLocatorV1,
  ProviderRuntimeIpcJsonValueV1,
  ProviderRuntimeIpcReadObjectResultV1,
  ProviderRuntimeIpcWriteObjectResultV1,
} from "../src/provider-runtime-ipc-v1.js";
import {
  takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalDestinationStrongWriterContinuationInternalV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-final-strong-ready-acceptance-reference-capability-internal.js";
import {
  createProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationEmptyStateInternalV1,
  inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-compound-publication-reference-machine-internal.js";
import {
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateV1,
  validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-formal-plan-reference-candidate-wire.js";
import {
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorRequestReferenceCandidateV1Schema,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1Schema,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-prepared-catalog-successor-reference-candidate-wire.js";
import {
  diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedRegistryManifestSourceCapabilityInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorSideEffectAuditObserverInternalV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-reference-capability-internal.js";
import {
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalMigrationIdMappingV1,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1Schema,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-reference-candidate-wire.js";
import {
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointCutCapabilityInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationPreparedSourceCapabilityInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointObservationHostInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationPreparedSourceCapabilityInternalV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-endpoint-trust-capability-internal.js";
import {
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCapabilityInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRetainedArtifactUpperBoundsCapabilityInternalV1,
  ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-history-quota-reference-machine-internal.js";
import {
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceEofStreamEventCapabilityInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamRecordEventCapabilityInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventMintCapabilityInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrivateLocatorReferenceInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceObjectStreamRecordInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceRootStreamRecordInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamHostInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamRecordInternalV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-source-reference-machine-internal.js";
import {
  buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-closure-reference-candidate.js";
import {
  deriveProviderFeasibilitySupportCatalogPinV1,
} from "../src/provider-feasibility-support-catalog-point.js";
import {
  deriveProviderReleaseTargetUniverseContentDigestV1,
} from "../src/provider-release-target-universe-point.js";
import {
  buildProviderStrongReadyAcceptanceMultiTargetRawRequestFixture,
  type ProviderStrongReadyAcceptanceMultiTargetRawRequestFixtureV1,
} from "../scripts/lib/provider-strong-ready-acceptance-candidate-fixture.mjs";
import {
  buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSignedProspectiveDestinationFixture,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSignedProspectiveDestinationFixtureV1,
} from "../scripts/lib/provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-closure-reference-candidate-fixture.mjs";
import {
  buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedCatalogSuccessorFixture,
  buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedRegistrySuccessorFixture,
  buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedRebindingRegistrySuccessorFixture,
  buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSourceDrainedRegistrySuccessorFixture,
  buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSteadyRegistrySuccessorFixture,
} from "../scripts/lib/provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-reference-candidate-fixture.mjs";

function resourceBytes(relativePath: string): Uint8Array {
  return new Uint8Array(
    readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url))),
  );
}

function resourceJson(relativePath: string): unknown {
  return JSON.parse(new TextDecoder().decode(resourceBytes(relativePath)));
}

function cloneJsonV1<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

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
const initializationNonce = LowerHex32V1Schema.parse("a1".repeat(16));
const installationIdentityKey = new Uint8Array(
  Array.from({ length: 32 }, (_value, index) => index),
);
const acceptedAt = ProviderRegistryIsoTimestampV1Schema.parse(
  "2026-08-15T01:00:00Z",
);
const resolvedAt = ProviderRegistryIsoTimestampV1Schema.parse(
  "2026-08-15T01:00:01Z",
);
const liveReferenceSchemaDigest = ContentDigestV1Schema.parse(
  `sha256:${"a7".repeat(32)}`,
);
const migrationProtocolDigest = ContentDigestV1Schema.parse(
  `sha256:${"a8".repeat(32)}`,
);
const quotaHmacKey = Buffer.from(
  "d41-real-signed-integration-quota-key-v1",
  "utf8",
);

let strictCryptoCapability: ProviderStrictEd25519OpaqueCapabilityV1;
let distributionRawRequest:
  ProviderStrongReadyAcceptanceMultiTargetRawRequestFixtureV1;
let currentFixture: any;

function distributionInputV1() {
  return {
    ...cloneJsonV1(distributionRawRequest),
    strictCryptoCapability,
  };
}

function mintObservationCapabilityV1(
  target: unknown,
  witnessByte: number,
): Promise<ProviderTrustedLocalPhysicalTargetObservationCapabilityV1> {
  return mintProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1(
    {
      openedRootAuthority: Object.freeze({}),
      physicalTargetObservationHost: Object.freeze({
        observeOpenedRootPhysicalTargetV1() {
          return {
            target,
            rootVolumeContinuityWitness: new Uint8Array([witnessByte]),
          };
        },
      }),
    },
  ) as Promise<ProviderTrustedLocalPhysicalTargetObservationCapabilityV1>;
}

async function buildCurrentD39D40FixtureV1() {
  const distributionForDerivation = distributionInputV1();
  const observedTarget = structuredClone(
    distributionForDerivation.releaseTargetUniverseHistory.at(-1)!
      .payload.targets[1]!.target,
  );
  const derivedD39 =
    await selectProviderTrustedLocalPhysicalTargetCandidateV1({
      distributionHistoryCandidate: distributionForDerivation,
      physicalTargetObservationCapability:
        await mintObservationCapabilityV1(observedTarget, 0x51),
    });
  const selectedWriter =
    deriveProviderTrustedLocalStrongWriterSelectionCandidateInternalV1(
      derivedD39,
    ).selectedActiveWriter;
  const registryClosure = derivedD39.distributionHistoryCandidate
    .catalogPointClosure.registryManifestHistoryClosure;
  const installationIdentityGenerationId =
    registryClosure.installationIdentityGenerationId;
  const identityCapability =
    await mintProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1({
      initializationNonce,
      installationIdentityGenerationId,
      keyCheckToken:
        await deriveInstallationIdentityKeyCheckTokenV1(
          {
            generationId: installationIdentityGenerationId,
            initializationNonce,
          },
          installationIdentityKey,
          cryptoHost,
        ),
      installationIdentityKey: installationIdentityKey.slice(),
      cryptoHost,
    });
  const referenceMachineCapability =
    await mintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1({
      identityVerificationCapability: identityCapability,
      initialState: {
        namespace: { state: "absent" },
        receiptLedger:
          createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptLedgerCandidateInternalV1(
            { installationIdentityGenerationId, receipts: [] },
          ),
      },
      retainedNonAcceptanceTrustHistoryLogicalBytes: 0,
    });
  const configuration = {
    state: "strong_ready" as const,
    core: {
      activeRootMetadata: registryClosure.currentRootMetadata,
      providerRegistryManifest: registryClosure.currentRegistryManifest,
      providerSupportCatalog:
        derivedD39.providerFeasibilitySupportCatalogPin,
      activeWriterSelector: {
        profile: "provider_active_writer_selector_v1" as const,
        selections: [selectedWriter],
      },
    },
    activation: { origin: "bootstrap_or_steady_successor" as const },
  };
  const generationId =
    deriveProviderStrongReadyAcceptanceStateGenerationIdV1({
      installationIdentityGenerationId,
      acceptanceOrdinal: 1,
      predecessor: { state: "genesis" },
      configuration,
    });
  const unsigned = {
    profile: "provider_acceptance_state_v1" as const,
    generationId,
    installationIdentityGenerationId,
    acceptanceOrdinal: 1,
    predecessor: { state: "genesis" as const },
    configuration,
    acceptedAt,
  };
  const payload = {
    ...unsigned,
    acceptanceToken:
      await deriveProviderAcceptanceStateTokenWithIdentityCapabilityInternalV1(
        identityCapability,
        installationIdentityGenerationId,
        unsigned,
      ),
  };
  const candidate = {
    schemaVersion: 1 as const,
    recordType: "provider_acceptance_state" as const,
    generationId,
    installationIdentityGenerationId,
    acceptedAt,
    contentDigest:
      deriveProviderStrongReadyAcceptanceStateContentDigestV1(payload),
    payload,
  };
  const request: ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1 = {
    profile:
      "provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_request_reference_candidate_v1",
    operationNonce: LowerHex32V1Schema.parse("51".repeat(16)),
    installationIdentityGenerationId,
    expected: { state: "genesis", expectedNamespaceState: "absent" },
    candidate,
  };
  const d40 =
    await createProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendClosureReferenceCandidateV1({
      distributionHistoryCandidate: distributionInputV1(),
      physicalTargetObservationCapability:
        await mintObservationCapabilityV1(observedTarget, 0x52),
      acceptanceCompareAppendRequest: request,
      resolvedAt,
      identityVerificationCapability: identityCapability,
      referenceMachineCapability,
    });
  if (d40.referenceState.namespace.state !== "current") {
    throw new TypeError("D-40 integration fixture did not commit current state");
  }
  return {
    d40,
    derivedD39,
    observedTarget,
    selectedWriter,
    registryClosure,
    installationIdentityGenerationId,
    identityCapability,
    referenceMachineCapability,
  };
}

beforeAll(async () => {
  const strictManifestBytes = resourceBytes(
    PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  );
  strictCryptoCapability = await attestProviderStrictEd25519CryptoHostV1({
    host: Object.freeze({
      verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
      validatePrimeSubgroupPoint,
      verifyRawEd25519,
    }),
    resourceHost: Object.freeze({
      readFixedSignedPackageResource(path: string, maxBytes: number) {
        expect(path).toBe(PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1);
        expect(maxBytes).toBe(PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1);
        return strictManifestBytes.slice();
      },
    }),
  });
  distributionRawRequest =
    buildProviderStrongReadyAcceptanceMultiTargetRawRequestFixture({
      rootGolden: resourceJson(
        PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
      ),
      registryGolden: resourceJson(
        PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1,
      ),
      sourceGolden: resourceJson(
        PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_PATH_V1,
      ),
    });
});

function digestV1(character: string): ContentDigestV1 {
  return ContentDigestV1Schema.parse(`sha256:${character.repeat(64)}`);
}

function domainDigestV1(domain: string, fields: unknown): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${createHash("sha256")
      .update(canonicalizeJcsSafeIntegerV1([domain, fields]), "utf8")
      .digest("hex")}`,
  );
}

function keyedTokenV1(domain: string, fields: unknown): string {
  return `hmac-sha256:${createHmac("sha256", quotaHmacKey)
    .update(canonicalizeJcsSafeIntegerV1([domain, fields]), "utf8")
    .digest("hex")}`;
}

function canonicalByteStringV1(value: unknown): string {
  return `base64url:${Buffer.from(
    canonicalizeJcsSafeIntegerV1(value),
    "utf8",
  ).toString("base64url")}`;
}

function flipLastLowerHexV1(value: string): string {
  const last = value.at(-1);
  return `${value.slice(0, -1)}${last === "0" ? "1" : "0"}`;
}

function migrationBudgetsV1(): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1 {
  return ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1Schema.parse({
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_budgets_reference_candidate_v1",
    maxRootEntries: 6,
    maxLiveObjects: 4,
    maxReferenceEdges: 4,
    maxRewriteObjects: 4,
    maxRewriteReferenceMappings: 4,
    maxRewriteSccs: 4,
    maxLogicalObjectBytesTotal: 100,
    maxProgressRecords: 15,
    maxProgressOperationReceipts: 4,
    maxCanonicalUniverseBytes: 1_000_000,
    maxCanonicalReferenceSetBytes: 1_000_000,
    maxCanonicalRewritePlanBytes: 1,
    maxCanonicalRewrittenReferenceSetBytesTotal: 1,
    maxCanonicalSemanticEquivalenceProofBytesTotal: 1,
    maxCanonicalRootRewriteProofSetBytes: 1,
    maxCanonicalZeroLiveProofBytes: 1,
    maxCanonicalReceiptBytesTotal: 1,
    maxCanonicalProgressRecordSetBytes: 1,
    maxCanonicalProgressOperationReceiptBytesTotal: 1,
    maxCanonicalMigrationBytesTotal: 4_194_304,
    maxRetainedMigrationHistoryLogicalBytesTotal: 4_194_304,
    maxRetainedMigrationHistoryProviderAllocatedBytesTotal: 4_194_304,
    maxSingleRecordBytes: 4_194_304,
  });
}

function endpointProjectionV1(
  prospective: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSignedProspectiveDestinationFixtureV1,
  currentD40Fixture: Awaited<ReturnType<typeof buildCurrentD39D40FixtureV1>>,
  destinationState: "absent" | "current" = "absent",
) {
  const namespaceState = currentD40Fixture.d40.referenceState.namespace;
  if (namespaceState.state !== "current") {
    throw new TypeError("D-40 current namespace disappeared");
  }
  const manifestEnvelope = cloneJsonV1(
    distributionRawRequest.registryManifestHistory.at(-1)!,
  );
  const catalogEnvelope = cloneJsonV1(
    distributionRawRequest.providerFeasibilitySupportCatalogHistory.at(-1)!,
  );
  const universeEnvelope = cloneJsonV1(
    distributionRawRequest.releaseTargetUniverseHistory.at(-1)!,
  );
  const universePin = {
    locatorProfile:
      "distribution_provider_release_target_universe_v1" as const,
    universeGeneration: universeEnvelope.universeGeneration,
    contentDigest:
      deriveProviderReleaseTargetUniverseContentDigestV1(
        universeEnvelope.payload,
      ),
  };
  const prospectiveCutUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_prospective_destination_cut_reference_candidate_v1" as const,
    activeRootMetadata: cloneJsonV1(
      manifestEnvelope.payload.activeRootMetadata,
    ),
    currentSteadyRegistryManifestPin:
      currentD40Fixture.registryClosure.currentRegistryManifest,
    currentSteadyRegistryManifestEnvelope: manifestEnvelope,
    currentSupportCatalog:
      deriveProviderFeasibilitySupportCatalogPinV1(catalogEnvelope),
    currentSupportCatalogEnvelope: catalogEnvelope,
    currentReleaseTargetUniverse: universePin,
    currentReleaseTargetUniverseEnvelope: universeEnvelope,
    prospectiveRegistryEntryContentDigest:
      prospective.prospectiveRegistryEntryContentDigest,
    prospectiveRegistryEntry: prospective.prospectiveRegistryEntry,
    releaseTargetUniverseTargetOrdinal: prospective.targetOrdinal,
    target: prospective.target,
    prospectiveSupportCandidate: prospective.prospectiveSupportCandidate,
    evidenceEnvelope: prospective.evidenceEnvelope,
    supportAdmission:
      "not_yet_catalog_signed_or_registry_bound" as const,
    registryMembership: "none" as const,
    migrationPreparedManifest: "none" as const,
    selectorDisposition:
      "outside_current_accepted_steady_selector_cut" as const,
  };
  const prospectiveDestinationCut =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutReferenceCandidateV1Schema.parse({
      ...prospectiveCutUnsigned,
      cutContentDigest:
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationCutContentDigestReferenceCandidateV1(
          prospectiveCutUnsigned,
        ),
    });
  const sourceTrustUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_endpoint_trust_reference_candidate_v1" as const,
    installationIdentityGenerationId:
      currentD40Fixture.installationIdentityGenerationId,
    currentAcceptanceRead: namespaceState.currentRead,
    retainedAcceptanceGenerations: namespaceState.generations,
    targetProfileId: currentD40Fixture.selectedWriter.targetProfileId,
    role: "source_current_strong_writer" as const,
    currentWriterSelection: currentD40Fixture.selectedWriter,
    authorization: {
      kind: "current_strong_writer_reference_candidate" as const,
      selectorOrdinal: 0,
    },
  };
  const sourceTrust =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1Schema.parse({
      ...sourceTrustUnsigned,
      trustClosureContentDigest:
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustContentDigestReferenceCandidateV1({
          ...sourceTrustUnsigned,
          trustClosureContentDigest: digestV1("0"),
        }),
    });
  if (sourceTrust.role !== "source_current_strong_writer") {
    throw new TypeError("source trust branch changed");
  }
  const prospectiveWriterProjection = {
    targetProfileId: prospective.target.targetProfileId,
    providerId: prospective.providerId,
    registryEntryContentDigest:
      prospective.prospectiveRegistryEntryContentDigest,
    semanticProviderPolicyDigest:
      prospective.prospectiveRegistryEntry.semanticProviderPolicyDigest,
    providerFeasibilityEvidence:
      prospective.prospectiveRegistryEntry.providerFeasibilityEvidence,
    runtimeAttestationContentDigest:
      prospective.prospectiveRegistryEntry.runtimeAttestation.contentDigest,
    bindingDerivationKeyGeneration:
      prospective.prospectiveRegistryEntry.verificationKeys
        .activeBindingDerivationKeyGeneration,
  };
  const destinationTrustUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_endpoint_trust_reference_candidate_v1" as const,
    installationIdentityGenerationId:
      currentD40Fixture.installationIdentityGenerationId,
    currentAcceptanceRead: namespaceState.currentRead,
    retainedAcceptanceGenerations: namespaceState.generations,
    targetProfileId: prospective.target.targetProfileId,
    role: "destination_prospective_not_selected" as const,
    prospectiveWriterProjection,
    authorization: {
      kind: "prospective_migration_destination_reference_candidate" as const,
      prospectiveDestinationCut,
    },
  };
  const destinationTrust =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustReferenceCandidateV1Schema.parse({
      ...destinationTrustUnsigned,
      trustClosureContentDigest:
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustContentDigestReferenceCandidateV1({
          ...destinationTrustUnsigned,
          trustClosureContentDigest: digestV1("0"),
        }),
    });
  if (destinationTrust.role !== "destination_prospective_not_selected") {
    throw new TypeError("destination trust branch changed");
  }
  const namespace = {
    installationIdentityGenerationId:
      currentD40Fixture.installationIdentityGenerationId,
    repositoryId:
      `provider-migration-same-installation-identity-current-strong-source-normal-repository-reference-candidate:${"71".repeat(32)}`,
    worktreeId:
      `provider-migration-same-installation-identity-current-strong-source-normal-worktree-reference-candidate:${"72".repeat(32)}`,
  };
  const sourceProviderBinding =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceCandidateV1Schema.parse({
      ...currentD40Fixture.selectedWriter,
      bindingReferenceDigest:
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceDigestReferenceCandidateV1(
          currentD40Fixture.selectedWriter,
        ),
    });
  const sourceStoreUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_store_manifest_current_cut_reference_candidate_v1" as const,
    namespace,
    providerBinding: sourceProviderBinding,
    namespaceRevision: 1,
    headContentDigest: digestV1("1"),
    currentVersionReferenceDigest: digestV1("2"),
    generationCount: 1,
    generationSetDigest: digestV1("3"),
    currentGeneration: {
      generationOrdinal: 1,
      generationReferenceId:
        `provider-migration-same-installation-identity-current-strong-source-normal-store-manifest-generation-reference-candidate:${"73".repeat(11)}`,
      contentDigest: digestV1("1"),
    },
  };
  const initialSourceStoreManifest =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1Schema.parse({
      ...sourceStoreUnsigned,
      cutContentDigest:
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutContentDigestReferenceCandidateV1(
          sourceStoreUnsigned,
        ),
    });
  const destinationProviderBinding =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceCandidateV1Schema.parse({
      ...prospectiveWriterProjection,
      bindingReferenceDigest:
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceDigestReferenceCandidateV1(
          prospectiveWriterProjection,
        ),
    });
  const initialDestinationUnsigned = {
    state: "absent" as const,
    namespace: cloneJsonV1(namespace),
    providerBinding: destinationProviderBinding,
  };
  const absentInitialDestinationNamespace =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalInitialDestinationNamespaceReferenceCandidateV1Schema.parse({
      ...initialDestinationUnsigned,
      absenceReferenceDigest:
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestAbsenceReferenceDigestReferenceCandidateV1(
          initialDestinationUnsigned,
        ),
    });
  const destinationStoreUnsigned = {
    ...sourceStoreUnsigned,
    namespace: cloneJsonV1(namespace),
    providerBinding: destinationProviderBinding,
  };
  const currentInitialDestinationNamespace =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalInitialDestinationNamespaceReferenceCandidateV1Schema.parse({
      state: "current",
      current: {
        ...destinationStoreUnsigned,
        cutContentDigest:
          deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutContentDigestReferenceCandidateV1(
            destinationStoreUnsigned,
          ),
      },
    });
  const initialDestinationNamespace = destinationState === "absent"
    ? absentInitialDestinationNamespace
    : currentInitialDestinationNamespace;
  const oppositeInitialDestinationNamespace = destinationState === "absent"
    ? currentInitialDestinationNamespace
    : absentInitialDestinationNamespace;
  const translationUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_namespace_translation_reference_candidate_v1" as const,
    mode: "same_installation_identity" as const,
    relationship:
      "same_identity_repository_and_worktree_exact_equal" as const,
    sourceNamespace: cloneJsonV1(namespace),
    destinationNamespace: cloneJsonV1(namespace),
    journalAuthorityInstallationIdentityGenerationId:
      currentD40Fixture.installationIdentityGenerationId,
  };
  const namespaceTranslation =
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceCandidateV1Schema.parse({
      ...translationUnsigned,
      translationReferenceDigest:
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalNamespaceTranslationReferenceDigestReferenceCandidateV1(
          translationUnsigned,
        ),
    });
  return {
    sourceTrust,
    destinationTrust,
    namespaceTranslation,
    initialSourceStoreManifest,
    initialDestinationNamespace,
    oppositeInitialDestinationNamespace,
  };
}

function privateLocatorV1(
  label: string,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrivateLocatorReferenceInternalV1 {
  return Object.freeze({ label }) as unknown as
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrivateLocatorReferenceInternalV1;
}

function sourceHostV1(
  manifest: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutReferenceCandidateV1,
  options: {
    readonly postContinuityDrift?: boolean;
    readonly trace?: string[];
  } = {},
) {
  const calls = { open: 0, read: 0, eof: 0, locator: 0, slots: 0, continuity: 0 };
  const locators = ["a", "b", "c", "d"].map(privateLocatorV1);
  const objects: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceObjectStreamRecordInternalV1[] = [
    { recordKind: "object", objectKind: "store_manifest_generation", locatorNamespace: "store", privateLocator: locators[0]!, contentDigest: digestV1("4"), logicalBytes: 10, providerBindingReferenceDigest: manifest.providerBinding.bindingReferenceDigest },
    { recordKind: "object", objectKind: "committed_private_blob", locatorNamespace: "store", privateLocator: locators[1]!, contentDigest: digestV1("5"), logicalBytes: 20, providerBindingReferenceDigest: manifest.providerBinding.bindingReferenceDigest },
    { recordKind: "object", objectKind: "store_manifest_compare_append_receipt", locatorNamespace: "provider_isolated_store_manifest_receipt_ledger", privateLocator: locators[2]!, contentDigest: digestV1("6"), logicalBytes: 30, providerBindingReferenceDigest: manifest.providerBinding.bindingReferenceDigest },
    { recordKind: "object", objectKind: "control_state", locatorNamespace: "store", privateLocator: locators[3]!, contentDigest: digestV1("7"), logicalBytes: 40, providerBindingReferenceDigest: manifest.providerBinding.bindingReferenceDigest },
  ];
  const roots: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceRootStreamRecordInternalV1[] = [
    { recordKind: "root", root: { rootKind: "store_manifest_complete_set", current: manifest } },
    { recordKind: "root", root: { rootKind: "quota_index_and_transition_chain", currentQuotaIndexRootContentDigest: digestV1("8"), transitionHead: { state: "genesis" } } },
    { recordKind: "root", root: { rootKind: "artifact_descriptor_history_closure", rootCount: 1, rootSetDigest: digestV1("9") } },
    { recordKind: "root", root: { rootKind: "initialization_terminal", terminalHeadReferenceDigest: digestV1("a") } },
    { recordKind: "root", root: { rootKind: "store_manifest_compare_append_receipt_ledger", providerId: manifest.providerBinding.providerId, providerPolicyDigest: manifest.providerBinding.semanticProviderPolicyDigest, receiptCount: 0, receiptSetDigest: digestV1("b"), receiptLogicalBytes: 0 } },
    { recordKind: "root", root: { rootKind: "active_recovery_control", activeTransactionCount: 0, controlUniverseDigest: digestV1("c") } },
  ];
  const slotPath = (index: number) =>
    `base64url:${Buffer.from(`/slot/${index}`, "utf8").toString("base64url")}`;
  const slots = new Map<string, readonly any[]>();
  slots.set("root:store_manifest_complete_set", [{ schemaFieldPath: slotPath(0), occurrenceOrdinal: 0, referenceSlotReferenceDigest: digestV1("d"), targetPrivateLocator: locators[0]! }]);
  slots.set(`object:${objects[0]!.contentDigest}`, [{ schemaFieldPath: slotPath(1), occurrenceOrdinal: 0, referenceSlotReferenceDigest: digestV1("e"), targetPrivateLocator: locators[1]! }]);
  slots.set("root:store_manifest_compare_append_receipt_ledger", [{ schemaFieldPath: slotPath(2), occurrenceOrdinal: 0, referenceSlotReferenceDigest: digestV1("f"), targetPrivateLocator: locators[2]! }]);
  slots.set(`object:${objects[2]!.contentDigest}`, [{ schemaFieldPath: slotPath(3), occurrenceOrdinal: 0, referenceSlotReferenceDigest: digestV1("0"), targetPrivateLocator: locators[3]! }]);
  const records: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamRecordInternalV1[] = [objects[2]!, roots[4]!, roots[1]!, objects[0]!, roots[0]!, objects[3]!, roots[5]!, roots[3]!, objects[1]!, roots[2]!];
  const freezeToken = Object.freeze(Object.create(null));
  const freezeDigest = digestV1("1");
  let index = 0;
  const host: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamHostInternalV1 = Object.freeze({
    openSourceFreeze() {
      calls.open += 1;
      options.trace?.push("source:open");
      return Object.freeze({ freezeToken, sourceFreezeStateReferenceDigest: freezeDigest });
    },
    readNext(
      actual: object,
      eventMintCapability: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamEventMintCapabilityInternalV1,
    ) {
      expect(actual).toBe(freezeToken);
      calls.read += 1;
      const record = records[index++];
      if (record === undefined) {
        calls.eof += 1;
        options.trace?.push("source:eof");
        return mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceEofStreamEventCapabilityInternalV1(
          eventMintCapability,
        );
      }
      return mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamRecordEventCapabilityInternalV1(
        eventMintCapability,
        record,
      );
    },
    deriveLocatorCommitment(actual: object, schemaDigest: ContentDigestV1, locator: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPrivateLocatorReferenceInternalV1) {
      expect(actual).toBe(freezeToken);
      expect(schemaDigest).toBe(liveReferenceSchemaDigest);
      calls.locator += 1;
      const locatorIndex = locators.indexOf(locator);
      if (locatorIndex < 0) throw new TypeError("unknown private locator");
      return Object.freeze({ logicalLocatorReferenceDigest: digestV1(["2", "3", "4", "5"][locatorIndex]!), semanticLocatorDigest: digestV1(["6", "7", "8", "9"][locatorIndex]!) });
    },
    enumerateReferenceSlots(actual: object, schemaDigest: ContentDigestV1, source: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceStreamRecordInternalV1) {
      expect(actual).toBe(freezeToken);
      expect(schemaDigest).toBe(liveReferenceSchemaDigest);
      calls.slots += 1;
      const sourceKey = source.recordKind === "root"
        ? `root:${source.root.rootKind}`
        : `object:${source.contentDigest}`;
      return Object.freeze(slots.get(sourceKey) ?? []);
    },
    observeSourceContinuity(actual: object) {
      expect(actual).toBe(freezeToken);
      calls.continuity += 1;
      options.trace?.push(`source:continuity:${calls.continuity}`);
      return Object.freeze({
        sourceFreezeStateReferenceDigest: options.postContinuityDrift
            && calls.continuity === 2
          ? digestV1("f")
          : freezeDigest,
      });
    },
  });
  return { host, calls };
}

const artifactKinds = ["canonical_rewrite_plan", "destination_universe", "migration_plan", "object_receipt", "progress_operation_receipt", "progress_record", "sealed_progress_head", "semantic_equivalence_proof", "source_tombstone", "source_universe", "zero_live_proof"] as const;

function loadedQuotaEnvelopeV1(
  envelope: Record<string, unknown>,
  locatorReferenceDigest: ContentDigestV1,
) {
  const canonical = canonicalizeJcsSafeIntegerV1(envelope);
  return {
    locatorReferenceDigest,
    canonicalEnvelopeBytes: canonicalByteStringV1(envelope),
    canonicalLogicalBytes: Buffer.byteLength(canonical, "utf8"),
    decodedEnvelope: cloneJsonV1(envelope),
  };
}

function notCommittedQuotaDriftCutV1(
  baseCut: any,
  installationIdentityGenerationId: string,
) {
  const operationNonce = "61".repeat(16);
  const requestContentDigest = digestV1("c");
  const accountReferenceDigest =
    deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceDigestReferenceCandidateV1(
      {
        installationIdentityGenerationId,
        reservationOrdinal: 1,
        createdByOperationNonce: operationNonce,
      },
    );
  const receiptLocator = digestV1("d");
  const receiptPayload = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_quota_receipt_payload_reference_candidate_v1" as const,
    installationIdentityGenerationId,
    receiptOrdinal: 1,
    operationNonce,
    requestContentDigest,
    accountReferenceDigest,
    observedPreHighWaterContentDigest:
      baseCut.highWater.decodedEnvelope.contentDigest,
    outcome: {
      state: "not_committed_reference_candidate" as const,
      reason: "expected_changed" as const,
      observedAccountStateContentDigest: baseCut.accountState.contentDigest,
    },
  };
  const receiptUnsigned = {
    schemaVersion: 1 as const,
    recordType:
      "provider_migration_same_installation_identity_current_strong_source_normal_quota_receipt_reference_candidate" as const,
    installationIdentityGenerationId,
    receiptOrdinal: 1,
    payload: receiptPayload,
  };
  const receiptContentDigest = domainDigestV1(
    PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RECEIPT_ENVELOPE_REFERENCE_CANDIDATE_DOMAIN_V1,
    {
      installationIdentityGenerationId,
      receiptOrdinal: 1,
      payload: receiptPayload,
    },
  );
  const receiptEnvelope = {
    ...receiptUnsigned,
    contentDigest: receiptContentDigest,
    recordToken: keyedTokenV1(
      PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_LEDGER_RECORD_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
      {
        recordType: receiptUnsigned.recordType,
        installationIdentityGenerationId,
        ordinal: 1,
        locatorReferenceDigest: receiptLocator,
        contentDigest: receiptContentDigest,
      },
    ),
  };
  const receipt = loadedQuotaEnvelopeV1(
    receiptEnvelope,
    receiptLocator,
  );
  const highWaterPayload = {
    ...baseCut.highWater.decodedEnvelope.payload,
    ledgerRevision: 1,
    receiptCount: 1,
    receiptSetDigest: domainDigestV1(
      PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RECEIPT_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
      {
        entries: [
          {
            ordinal: 1,
            locatorReferenceDigest: receiptLocator,
            contentDigest: receiptContentDigest,
          },
        ],
      },
    ),
    operationReceiptLogicalBytes: receipt.canonicalLogicalBytes,
  };
  const highWaterContentDigest = domainDigestV1(
    PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_HIGH_WATER_REFERENCE_CANDIDATE_DOMAIN_V1,
    highWaterPayload,
  );
  const highWaterEnvelope = {
    schemaVersion: 1 as const,
    recordType:
      "provider_migration_same_installation_identity_current_strong_source_normal_quota_high_water_reference_candidate" as const,
    installationIdentityGenerationId,
    contentDigest: highWaterContentDigest,
    payload: highWaterPayload,
    quotaStateVersionToken: keyedTokenV1(
      PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_HIGH_WATER_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
      {
        installationIdentityGenerationId,
        payload: highWaterPayload,
        outerContentDigest: highWaterContentDigest,
      },
    ),
  };
  return {
    reservations: [],
    events: [],
    receipts: [receipt],
    accountState: cloneJsonV1(baseCut.accountState),
    highWater: loadedQuotaEnvelopeV1(
      highWaterEnvelope,
      baseCut.highWater.locatorReferenceDigest,
    ),
  };
}

function quotaHostV1(
  installationIdentityGenerationId: string,
  options: {
    readonly postContinuityDrift?: boolean;
    readonly trace?: string[];
  } = {},
) {
  const accounts: [] = [];
  const usage = deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageFromAccountsReferenceCandidateV1(accounts);
  const accountStateUnsigned = {
    profile: "provider_migration_same_installation_identity_current_strong_source_normal_quota_account_state_reference_candidate_v1" as const,
    installationIdentityGenerationId,
    accounts,
    accountCount: 0,
    accountSetDigest: deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountSetDigestReferenceCandidateV1({ entries: accounts }),
    usage,
    futureTerminalTransitionEscrowCount: 0,
    eventEscrowLogicalBytes: 0,
    receiptEscrowLogicalBytes: 0,
  };
  const accountState = {
    ...accountStateUnsigned,
    contentDigest: deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountStateContentDigestReferenceCandidateV1(accountStateUnsigned),
  };
  const highWaterPayload = {
    profile: "provider_migration_same_installation_identity_current_strong_source_normal_quota_high_water_payload_reference_candidate_v1",
    installationIdentityGenerationId,
    stateRevision: 0,
    ledgerRevision: 0,
    currentEvent: { state: "genesis" },
    reservationRecordCount: 0,
    reservationRecordSetDigest: domainDigestV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RESERVATION_SET_REFERENCE_CANDIDATE_DOMAIN_V1, { entries: [] }),
    reservationRecordLogicalBytes: 0,
    eventCount: 0,
    eventSetDigest: domainDigestV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_EVENT_SET_REFERENCE_CANDIDATE_DOMAIN_V1, { entries: [] }),
    ledgerEventLogicalBytes: 0,
    receiptCount: 0,
    receiptSetDigest: domainDigestV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RECEIPT_SET_REFERENCE_CANDIDATE_DOMAIN_V1, { entries: [] }),
    operationReceiptLogicalBytes: 0,
    accountCount: 0,
    accountSetDigest: accountState.accountSetDigest,
    accountStateContentDigest: accountState.contentDigest,
    usage,
    futureTerminalTransitionEscrowCount: 0,
    eventEscrowLogicalBytes: 0,
    receiptEscrowLogicalBytes: 0,
  };
  const contentDigest = domainDigestV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_HIGH_WATER_REFERENCE_CANDIDATE_DOMAIN_V1, highWaterPayload);
  const highWaterEnvelope = {
    schemaVersion: 1,
    recordType: "provider_migration_same_installation_identity_current_strong_source_normal_quota_high_water_reference_candidate",
    installationIdentityGenerationId,
    contentDigest,
    payload: highWaterPayload,
    quotaStateVersionToken: keyedTokenV1(PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_HIGH_WATER_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1, { installationIdentityGenerationId, payload: highWaterPayload, outerContentDigest: contentDigest }),
  };
  const canonical = canonicalizeJcsSafeIntegerV1(highWaterEnvelope);
  const cut = {
    reservations: [],
    events: [],
    receipts: [],
    accountState,
    highWater: {
      locatorReferenceDigest: digestV1("a"),
      canonicalEnvelopeBytes: canonicalByteStringV1(highWaterEnvelope),
      canonicalLogicalBytes: Buffer.byteLength(canonical, "utf8"),
      decodedEnvelope: highWaterEnvelope,
    },
  };
  const postCut = options.postContinuityDrift
    ? notCommittedQuotaDriftCutV1(cut, installationIdentityGenerationId)
    : cut;
  const calls = { cuts: [] as string[], artifacts: 0, recordTokens: 0, highWaterTokens: 0 };
  const host: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1 = {
    captureCompleteQuotaCut({
      phase,
      installationIdentityGenerationId: actualIdentity,
      completeQuotaCutMintChallenge,
      deliverCompleteQuotaCutCapability,
    }) {
      expect(actualIdentity).toBe(installationIdentityGenerationId);
      calls.cuts.push(phase);
      options.trace?.push(`quota:${phase}`);
      deliverCompleteQuotaCutCapability(
        mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCapabilityInternalV1(
          completeQuotaCutMintChallenge,
          cloneJsonV1(phase === "post" ? postCut : cut),
        ),
      );
    },
    captureRetainedArtifactUpperBounds({
      installationIdentityGenerationId: actualIdentity,
      retainedArtifactUpperBoundsMintChallenge,
      deliverRetainedArtifactUpperBoundsCapability,
    }) {
      expect(actualIdentity).toBe(installationIdentityGenerationId);
      calls.artifacts += 1;
      options.trace?.push("quota:upper-bounds");
      deliverRetainedArtifactUpperBoundsCapability(
        mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRetainedArtifactUpperBoundsCapabilityInternalV1(
          retainedArtifactUpperBoundsMintChallenge,
          {
            policyDigest: digestV1("b"),
            retainedArtifactUpperBounds: artifactKinds.map((artifactKind) => artifactKind === "migration_plan" ? { artifactKind, artifactCount: 1, canonicalEnvelopeBytesUpperBoundTotal: 4_194_304, providerAllocatedBytesUpperBoundTotal: 4_194_304 } : { artifactKind, artifactCount: 0, canonicalEnvelopeBytesUpperBoundTotal: 0, providerAllocatedBytesUpperBoundTotal: 0 }),
          },
        ),
      );
    },
    verifyQuotaLedgerRecordToken(input) {
      calls.recordTokens += 1;
      const { tokenDomain, token, ...fields } = input;
      return token === keyedTokenV1(tokenDomain, fields);
    },
    verifyQuotaHighWaterToken(input) {
      calls.highWaterTokens += 1;
      const { tokenDomain, token, ...fields } = input;
      return token === keyedTokenV1(tokenDomain, fields);
    },
  };
  return { host, calls };
}

const sinkNames = ["acceptanceAppends", "destinationObjectAllocations", "emergencyReserveConsumptions", "operationReceiptWrites", "pendingIntents", "planPublications", "progressAppends", "quotaConsumptions", "reservationWrites"] as const;

function auditObserverV1(options: {
  readonly trace?: string[];
  readonly throwOnObservation?: number;
} = {}) {
  const calls = { observations: 0 };
  const snapshot = Object.fromEntries(sinkNames.map((name, index) => [name, { revision: 0, count: 0, contentDigest: digestV1(index.toString(16)) }])) as Record<(typeof sinkNames)[number], { revision: number; count: number; contentDigest: ContentDigestV1 }>;
  const observer: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSideEffectAuditObserverInternalV1 = {
    observeSideEffectSinks() {
      calls.observations += 1;
      options.trace?.push(`audit:${calls.observations}`);
      if (calls.observations === options.throwOnObservation) {
        throw new TypeError("injected audit cleanup failure");
      }
      return cloneJsonV1(snapshot);
    },
  };
  return { observer, snapshot, calls };
}

const d42SinkNames = [
  ...sinkNames,
  "rootSigningRequests",
  "registryManifestPublications",
  "catalogPublications",
] as const;

function d42AuditObserverV1(options: {
  readonly mutateOnObservation?: number;
  readonly mutateSink?: (typeof d42SinkNames)[number];
  readonly throwOnObservation?: number;
} = {}) {
  const calls = { observations: 0 };
  const snapshot = Object.fromEntries(
    d42SinkNames.map((name, index) => [
      name,
      {
        revision: 0,
        count: 0,
        contentDigest: digestV1(((index + 1) % 16).toString(16)),
      },
    ]),
  ) as Record<
    (typeof d42SinkNames)[number],
    { revision: number; count: number; contentDigest: ContentDigestV1 }
  >;
  const observer: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorSideEffectAuditObserverInternalV1 = {
    observeSideEffectSinks() {
      calls.observations += 1;
      if (calls.observations === options.throwOnObservation) {
        throw new TypeError("injected D-42 audit failure");
      }
      if (calls.observations === options.mutateOnObservation) {
        const sinkName = options.mutateSink ?? "registryManifestPublications";
        snapshot[sinkName] = {
          revision: 1,
          count: 1,
          contentDigest: digestV1("f"),
        };
      }
      return cloneJsonV1(snapshot);
    },
  };
  return { observer, snapshot, calls };
}

async function withThrowingObjectPrototypeThenV1<T>(
  reads: { count: number },
  operation: () => Promise<T>,
): Promise<T> {
  const original = Object.getOwnPropertyDescriptor(Object.prototype, "then");
  Object.defineProperty(Object.prototype, "then", {
    configurable: true,
    get() {
      reads.count += 1;
      throw new TypeError("Object.prototype.then must remain unreachable");
    },
  });
  try {
    return await operation();
  } finally {
    if (original === undefined) {
      delete (Object.prototype as { then?: unknown }).then;
    } else {
      Object.defineProperty(Object.prototype, "then", original);
    }
  }
}

interface OperationFixtureOptionsV1 {
  readonly aliasMaterial?: boolean;
  readonly materialAliasPublicKeyBytes?: string;
  readonly sourcePostDrift?: boolean;
  readonly quotaPostDrift?: boolean;
  readonly endpointPostDrift?: boolean;
  readonly endpointPostDestinationBranchDrift?: boolean;
  readonly endpointCapabilityProxy?: boolean;
  readonly initialDestinationState?: "absent" | "current";
  readonly providerId?: string;
  readonly createdAt?: string;
  readonly migrationBudgets?:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1;
  readonly requestLiveReferenceSchemaDigest?: ContentDigestV1;
  readonly requestMigrationProtocolDigest?: ContentDigestV1;
  readonly verifiedLiveReferenceSchemaDigest?: ContentDigestV1;
  readonly verifiedMigrationProtocolDigest?: ContentDigestV1;
  readonly currentD40Fixture?: Awaited<ReturnType<typeof buildCurrentD39D40FixtureV1>>;
  readonly prospectiveDestinationPreparedSourceCapability?:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationPreparedSourceCapabilityInternalV1;
  readonly onPrePlanMintFailure?: (state: Readonly<{
    source: ReturnType<typeof sourceHostV1>;
    audit: ReturnType<typeof auditObserverV1>;
  }>) => void;
  readonly objectPrototypeThenReads?: { count: number };
  readonly trace?: string[];
  readonly auditThrowOnObservation?: number;
}

async function operationInputsV1(options: OperationFixtureOptionsV1 = {}) {
  // Every operation receives a new committed D-40 identity because the
  // endpoint-trust handoff is exact-once.
  currentFixture = options.currentD40Fixture ??
    await buildCurrentD39D40FixtureV1();
  const sourceMember = distributionRawRequest.registryManifestHistory.at(-1)!
    .payload.members.find((member) =>
      member.disposition === "enabled" &&
      member.providerId === currentFixture.selectedWriter.providerId
    );
  if (sourceMember === undefined || sourceMember.disposition !== "enabled") {
    throw new TypeError("current source Registry Entry disappeared");
  }
  const sourceEntry = sourceMember.registryEntry;
  const prospective = buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSignedProspectiveDestinationFixture({
    distributionRawRequest,
    providerId: options.providerId as any,
    materialAliasPublicKeyBytes:
      options.materialAliasPublicKeyBytes ??
      (options.aliasMaterial
        ? sourceEntry.verificationKeys.publicKeyRecords[0]!.publicKeyBytes
        : undefined),
  });
  const projection = endpointProjectionV1(
    prospective,
    currentFixture,
    options.initialDestinationState,
  );
  const source = sourceHostV1(projection.initialSourceStoreManifest, {
    postContinuityDrift: options.sourcePostDrift,
    trace: options.trace,
  });
  const quota = quotaHostV1(currentFixture.installationIdentityGenerationId, {
    postContinuityDrift: options.quotaPostDrift,
    trace: options.trace,
  });
  const audit = auditObserverV1({
    trace: options.trace,
    throwOnObservation: options.auditThrowOnObservation,
  });
  const endpointCalls: string[] = [];
  const endpointTraps = { ownKeys: 0, returnedGet: 0, deliveredGet: 0 };
  let driftedDestination = projection.initialDestinationNamespace;
  if (options.endpointPostDrift) {
    if (projection.initialDestinationNamespace.state !== "absent") {
      throw new TypeError("endpoint drift fixture requires absent destination");
    }
    const driftUnsigned = {
      state: "absent" as const,
      namespace: {
        ...projection.initialDestinationNamespace.namespace,
        repositoryId:
          `provider-migration-same-installation-identity-current-strong-source-normal-repository-reference-candidate:${"74".repeat(32)}`,
      },
      providerBinding:
        projection.initialDestinationNamespace.providerBinding,
    };
    driftedDestination =
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalInitialDestinationNamespaceReferenceCandidateV1Schema.parse({
        ...driftUnsigned,
        absenceReferenceDigest:
          deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestAbsenceReferenceDigestReferenceCandidateV1(
            driftUnsigned,
          ),
      });
  }
  const endpointObservationHost: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointObservationHostInternalV1 = {
    captureEndpointObservation({
      phase,
      endpointCutMintChallenge,
      deliverEndpointCutCapability,
    }) {
      endpointCalls.push(phase);
      options.trace?.push(`endpoint:${phase}`);
      const cutInput = new Proxy(
        {
          sourceStoreManifest: projection.initialSourceStoreManifest,
          initialDestinationNamespace:
            phase === "post" && options.endpointPostDestinationBranchDrift
              ? projection.oppositeInitialDestinationNamespace
              : phase === "post"
                ? driftedDestination
                : projection.initialDestinationNamespace,
        },
        {
          ownKeys() {
            endpointTraps.ownKeys += 1;
            throw new TypeError("endpoint cut ownKeys must not run");
          },
        },
      );
      const capability =
        mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointCutCapabilityInternalV1(
          endpointCutMintChallenge,
          cutInput,
        );
      const delivered = options.endpointCapabilityProxy
        ? new Proxy(capability, {
            get() {
              endpointTraps.deliveredGet += 1;
              throw new TypeError("delivered cap properties must not be read");
            },
          })
        : capability;
      deliverEndpointCutCapability(delivered);
      return new Proxy(Object.create(null), {
        get() {
          endpointTraps.returnedGet += 1;
          throw new TypeError("endpoint host return thenable must be ignored");
        },
      });
    },
  };
  const prospectiveDestinationPreparedSourceCapability =
    options.prospectiveDestinationPreparedSourceCapability ??
    mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationPreparedSourceCapabilityInternalV1(
      {
        acceptanceClosureIdentity: currentFixture.d40,
        endpointProjectionClaims: {
          sourceTrust: projection.sourceTrust,
          destinationTrust: projection.destinationTrust,
          namespaceTranslation: projection.namespaceTranslation,
        },
        evidenceValidationSource: prospective.evidenceValidationSource,
      },
    );
  const request = {
    profile: "provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_request_reference_candidate_v1" as const,
    mode: "same_installation_identity" as const,
    reason: "provider_decommission" as const,
    admissionClass: "normal" as const,
    createdAt: options.createdAt ?? "2026-08-15T01:00:02.000Z",
    migrationBudgets: options.migrationBudgets ?? migrationBudgetsV1(),
    liveReferenceSchemaDigest:
      options.requestLiveReferenceSchemaDigest ?? liveReferenceSchemaDigest,
    migrationProtocolDigest:
      options.requestMigrationProtocolDigest ?? migrationProtocolDigest,
  };
  const prePlanMintInput = {
    acceptanceClosureIdentity: currentFixture.d40,
    endpointObservationHost,
    prospectiveDestinationPreparedSourceCapability,
    request,
    verifiedLiveReferenceSchemaDigest:
      options.verifiedLiveReferenceSchemaDigest ?? liveReferenceSchemaDigest,
    verifiedMigrationProtocolDigest:
      options.verifiedMigrationProtocolDigest ?? migrationProtocolDigest,
    sourceStreamHost: source.host,
    quotaObservationHost: quota.host,
    sideEffectAuditObserver: audit.observer,
  };
  return {
    prospective,
    projection,
    source,
    quota,
    audit,
    endpointCalls,
    endpointTraps,
    request,
    prePlanMintInput,
  };
}

async function operationFixtureV1(options: OperationFixtureOptionsV1 = {}) {
  const inputs = await operationInputsV1(options);
  let ready: Awaited<ReturnType<
    typeof mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityInternalV1
  >>;
  try {
    const mint = () =>
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityInternalV1(
        inputs.prePlanMintInput,
      );
    ready = options.objectPrototypeThenReads === undefined
      ? await mint()
      : await withThrowingObjectPrototypeThenV1(
          options.objectPrototypeThenReads,
          mint,
        );
  } catch (error) {
    options.onPrePlanMintFailure?.({
      source: inputs.source,
      audit: inputs.audit,
    });
    throw error;
  }
  return {
    ...inputs,
    ready,
  };
}

function expectZeroSinkSnapshotV1(snapshot: Record<string, { revision: number; count: number }>) {
  expect(Object.keys(snapshot).sort()).toEqual([...sinkNames].sort());
  for (const sink of Object.values(snapshot)) {
    expect(sink).toMatchObject({ revision: 0, count: 0 });
  }
}

describe("D-41 test-only signed pre-side-effect integration", () => {
  it("builds a distinct signed prospective gen1 Entry with current approvals and no current membership", async () => {
    const fixture = await operationFixtureV1();
    const tip = distributionRawRequest.registryManifestHistory.at(-1)!;
    const catalog = distributionRawRequest.providerFeasibilitySupportCatalogHistory.at(-1)!;
    expect(fixture.prospective.prospectiveRegistryEntry.registryGeneration).toBe(1);
    expect(fixture.prospective.prospectiveRegistryEntry.providerId).not.toBe(currentFixture.selectedWriter.providerId);
    expect(fixture.prospective.evidenceEnvelope.payload.result).toBe("passed");
    expect(fixture.prospective.prospectiveRegistryEntry.feasibilityApprovalKeys).toEqual(catalog.payload.feasibilityApprovalKeys);
    expect(tip.payload.members.some((member) => member.providerId === fixture.prospective.providerId)).toBe(false);
    expect(catalog.payload.targets.some((target) => target.candidates.some((candidate) => candidate.providerId === fixture.prospective.providerId))).toBe(false);
    expect(fixture.prospective.prospectiveRegistryEntry.registrySignature).toMatch(/^provider-registry-ed25519:/u);
    expect(fixture.source.calls.open).toBe(0);
    expect(fixture.endpointTraps).toEqual({
      ownKeys: 0,
      returnedGet: 0,
      deliveredGet: 0,
    });
    expectZeroSinkSnapshotV1(fixture.audit.snapshot);
  });

  it("does not burn either committed D-40 identity or its owner prepared-source capability on a foreign pairing", async () => {
    const ownerD40 = await buildCurrentD39D40FixtureV1();
    const ownerProspective =
      buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSignedProspectiveDestinationFixture({
        distributionRawRequest,
      });
    const ownerProjection = endpointProjectionV1(
      ownerProspective,
      ownerD40,
    );
    const ownerPreparedSource =
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationPreparedSourceCapabilityInternalV1(
        {
          acceptanceClosureIdentity: ownerD40.d40,
          endpointProjectionClaims: {
            sourceTrust: ownerProjection.sourceTrust,
            destinationTrust: ownerProjection.destinationTrust,
            namespaceTranslation: ownerProjection.namespaceTranslation,
          },
          evidenceValidationSource: ownerProspective.evidenceValidationSource,
        },
      );
    const foreignD40 = await buildCurrentD39D40FixtureV1();

    await expect(
      operationFixtureV1({
        currentD40Fixture: foreignD40,
        prospectiveDestinationPreparedSourceCapability: ownerPreparedSource,
      }),
    ).rejects.toThrow();

    const foreignOwner = await operationFixtureV1({
      currentD40Fixture: foreignD40,
    });
    const owner = await operationFixtureV1({
      currentD40Fixture: ownerD40,
      prospectiveDestinationPreparedSourceCapability: ownerPreparedSource,
    });
    expect(foreignOwner.source.calls.open).toBe(0);
    expect(owner.source.calls.open).toBe(0);
    expectZeroSinkSnapshotV1(foreignOwner.audit.snapshot);
    expectZeroSinkSnapshotV1(owner.audit.snapshot);
  }, 20_000);

  it("closes the public none-authority candidate once under a concurrent replay, including hash-DAG, 4 MiB cap, and exact zero writes", async () => {
    const fixture = await operationFixtureV1();
    const input = fixture.ready.buildInput;
    expect(Object.getPrototypeOf(input)).toBeNull();
    expect(Object.isFrozen(input)).toBe(true);
    expect(Reflect.ownKeys(input).sort()).toEqual([
      "prePlanReferenceCapability",
      "request",
    ]);
    await expect(
      buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1(
        { ...input },
      ),
    ).rejects.toMatchObject({
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });
    await expect(
      buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1(
        { ...input, unexpected: true },
      ),
    ).rejects.toMatchObject({
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });
    const [first, concurrentReplay] = await Promise.allSettled([
      buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1(input),
      buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1(input),
    ]);
    if (first.status !== "fulfilled") {
      throw new TypeError("expected first public D-41 integration build to succeed");
    }
    if (concurrentReplay.status !== "rejected") {
      throw new TypeError("expected concurrent public D-41 replay to fail");
    }
    expect(first.status).toBe("fulfilled");
    expect(concurrentReplay.status).toBe("rejected");
    expect(concurrentReplay.reason).toMatchObject({
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });
    await expect(
      buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1(input),
    ).rejects.toMatchObject({
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });
    const result = first.value;
    expect(result.authority).toBe("none_provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_plan_admission_closure_reference_candidate_only");
    expect(result.stopPoint).toBe("before_same_installation_identity_migration_history_quota_reservation_write");
    expect(verifyProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidatePublicHashDagAndEqualityV1(result).closureContentDigest).toBe(result.closureContentDigest);
    expect(Buffer.byteLength(canonicalizeJcsSafeIntegerV1(result.planCandidate), "utf8")).toBeLessThanOrEqual(4_194_304);
    expect(result.completeSourceReadClosure).toMatchObject({ rootCount: 6, objectCount: 4, referenceCount: 4, logicalObjectBytesTotal: 100 });
    expect(result.sideEffectBoundary).toMatchObject(Object.fromEntries(sinkNames.map((name) => [name, 0])));
    expect(fixture.source.calls).toMatchObject({ open: 1, read: 11, eof: 1, locator: 4, slots: 10, continuity: 2 });
    expect(fixture.quota.calls.cuts).toEqual(["pre", "post"]);
    expect(fixture.quota.calls.highWaterTokens).toBe(2);
    expect(fixture.endpointCalls).toEqual(["pre", "post"]);
    expect(fixture.endpointTraps).toEqual({
      ownKeys: 0,
      returnedGet: 0,
      deliveredGet: 0,
    });
    expectZeroSinkSnapshotV1(fixture.audit.snapshot);
  });

  it("does not consult Object.prototype.then across endpoint preparation, pre-plan mint, or public success fulfillment", async () => {
    const thenReads = { count: 0 };
    const fixture = await operationFixtureV1({
      objectPrototypeThenReads: thenReads,
    });
    const result = await withThrowingObjectPrototypeThenV1(
      thenReads,
      () =>
        buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1(
          fixture.ready.buildInput,
        ),
    );
    expect(result.authority).toBe(
      "none_provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_plan_admission_closure_reference_candidate_only",
    );
    expect(thenReads.count).toBe(0);
    expectZeroSinkSnapshotV1(fixture.audit.snapshot);
  }, 20_000);

  it("rejects single and double request digest substitution against the cohort-verified schema/protocol constants before the source stream", async () => {
    const substitutions = [
      {
        label: "live-reference schema only",
        options: {
          requestLiveReferenceSchemaDigest: digestV1("d"),
        },
      },
      {
        label: "migration protocol only",
        options: {
          requestMigrationProtocolDigest: digestV1("e"),
        },
      },
      {
        label: "internally self-consistent request-side double substitution",
        options: {
          requestLiveReferenceSchemaDigest: digestV1("d"),
          requestMigrationProtocolDigest: digestV1("e"),
        },
      },
    ] as const;

    for (const substitution of substitutions) {
      const fixture = await operationFixtureV1(substitution.options);
      await expect(
        diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1(
          fixture.ready.buildInput,
        ),
        substitution.label,
      ).resolves.toEqual({
        ok: false,
        stage: "current_strong_source",
        reason: "source_invalid",
      });
      expect(fixture.source.calls.open, substitution.label).toBe(0);
      expect(fixture.source.calls.read, substitution.label).toBe(0);
      expect(fixture.quota.calls.cuts, substitution.label).toEqual([]);
      expect(fixture.quota.calls.artifacts, substitution.label).toBe(0);
      expectZeroSinkSnapshotV1(fixture.audit.snapshot);
    }
  }, 45_000);

  it("enforces canonical Plan Envelope actual bytes at 4_194_303/4_194_304/4_194_305", async () => {
    const cases = [
      { actualBytes: 4_194_303, accepted: true },
      { actualBytes: 4_194_304, accepted: true },
      { actualBytes: 4_194_305, accepted: false },
    ] as const;

    for (const boundaryCase of cases) {
      const fixture = await operationFixtureV1();
      planEnvelopeActualBytesOverrideV1.value = boundaryCase.actualBytes;
      try {
        const result =
          await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1(
            fixture.ready.buildInput,
          );
        if (boundaryCase.accepted) {
          expect(result.ok, `${boundaryCase.actualBytes}`).toBe(true);
        } else {
          expect(result, `${boundaryCase.actualBytes}`).toEqual({
            ok: false,
            stage: "plan_envelope_actual_size",
            reason: "budget_exceeded",
          });
          expect(fixture.endpointCalls).toEqual(["pre"]);
        }
        expectZeroSinkSnapshotV1(fixture.audit.snapshot);
      } finally {
        planEnvelopeActualBytesOverrideV1.value = undefined;
      }
    }
  }, 45_000);

  it("reports the migration_budgets stage and rejects an impossible six-root cap before opening the source stream", async () => {
    const tooSmallForExactRootCover =
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1Schema.parse({
        ...migrationBudgetsV1(),
        maxRootEntries: 5,
      });
    const fixture = await operationFixtureV1({
      migrationBudgets: tooSmallForExactRootCover,
    });
    await expect(
      diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1(
        fixture.ready.buildInput,
      ),
    ).resolves.toEqual({
      ok: false,
      stage: "migration_budgets",
      reason: "budget_exceeded",
    });
    expect(fixture.endpointCalls).toEqual(["pre"]);
    expect(fixture.source.calls.open).toBe(0);
    expect(fixture.source.calls.read).toBe(0);
    expect(fixture.quota.calls.cuts).toEqual([]);
    expect(fixture.quota.calls.artifacts).toBe(0);
    expectZeroSinkSnapshotV1(fixture.audit.snapshot);
  }, 20_000);

  it("rejects prospective verification-material alias and an already-current provider before any source read", async () => {
    const currentManifest = distributionRawRequest.registryManifestHistory.at(-1)!;
    const currentSourceMember = currentManifest.payload.members.find(
      (member) => member.disposition === "enabled",
    );
    if (currentSourceMember === undefined || currentSourceMember.disposition !== "enabled") {
      throw new TypeError("alias matrix lost the current source Entry");
    }
    const aliasCases = [
      {
        label: "current provider",
        publicKeyBytes:
          currentSourceMember.registryEntry.verificationKeys.publicKeyRecords[0]!
            .publicKeyBytes,
      },
      {
        label: "current Registry Root",
        publicKeyBytes:
          distributionRawRequest.rootMetadataHistory.at(-1)!.payload.activeRoot
            .publicKeyBytes,
      },
      {
        label: "recovery key",
        publicKeyBytes:
          distributionRawRequest.bootstrapTrustBundle
            .providerRegistryRecoveryKeys[0]!.publicKeyBytes,
      },
      {
        label: "feasibility approver used in the provider-key role",
        publicKeyBytes:
          distributionRawRequest.providerFeasibilitySupportCatalogHistory.at(-1)!
            .payload.feasibilityApprovalKeys.publicKeyRecords[0]!.publicKeyBytes,
      },
    ] as const;
    for (const aliasCase of aliasCases) {
      const aliasFailure: {
        state?: Readonly<{
          source: ReturnType<typeof sourceHostV1>;
          audit: ReturnType<typeof auditObserverV1>;
        }>;
      } = {};
      await expect(
        operationFixtureV1({
          materialAliasPublicKeyBytes: aliasCase.publicKeyBytes,
          onPrePlanMintFailure(state) {
            aliasFailure.state = state;
          },
        }),
        aliasCase.label,
      ).rejects.toThrow();
      if (aliasFailure.state === undefined) {
        throw new TypeError(
          `${aliasCase.label} failure did not expose its zero-read audit state`,
        );
      }
      expect(aliasFailure.state.source.calls.open, aliasCase.label).toBe(0);
      expectZeroSinkSnapshotV1(aliasFailure.state.audit.snapshot);
    }

    await expect(
      operationFixtureV1({
        providerId: currentSourceMember.providerId,
      }),
    ).rejects.toThrow();
  }, 45_000);

  it("locks the global read-only stage order and preserves the first stage/reason boundary", async () => {
    const trace: string[] = [];
    const success = await operationFixtureV1({ trace });
    const successResult =
      await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1(
        success.ready.buildInput,
      );
    expect(successResult.ok).toBe(true);
    expect(trace).toEqual([
      "audit:1",
      "endpoint:pre",
      "source:open",
      "source:eof",
      "source:continuity:1",
      "quota:upper-bounds",
      "quota:pre",
      "source:continuity:2",
      "quota:post",
      "endpoint:post",
      "audit:2",
      "audit:3",
    ]);

    const cases = [
      {
        label: "verified source constants",
        options: { requestLiveReferenceSchemaDigest: digestV1("d") },
        expected: { stage: "current_strong_source", reason: "source_invalid" },
        expectedTrace: ["audit:2"],
      },
      {
        label: "migration budget precheck",
        options: {
          migrationBudgets:
            ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1Schema.parse({
              ...migrationBudgetsV1(),
              maxRootEntries: 5,
            }),
        },
        expected: { stage: "migration_budgets", reason: "budget_exceeded" },
        expectedTrace: ["audit:2"],
      },
    ] as const;
    for (const testCase of cases) {
      const failureTrace: string[] = [];
      const failure = await operationFixtureV1({
        ...testCase.options,
        trace: failureTrace,
      });
      await expect(
        diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1(
          failure.ready.buildInput,
        ),
        testCase.label,
      ).resolves.toMatchObject({ ok: false, ...testCase.expected });
      expect(failureTrace, testCase.label).toEqual([
        "audit:1",
        "endpoint:pre",
        ...testCase.expectedTrace,
      ]);
      expectZeroSinkSnapshotV1(failure.audit.snapshot);
    }
  }, 60_000);

  it("accepts absent/current initial destinations but rejects zero, multiple, and cross-branch observations", async () => {
    const absent = await operationFixtureV1({
      initialDestinationState: "absent",
    });
    const current = await operationFixtureV1({
      initialDestinationState: "current",
    });
    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalInitialDestinationNamespaceReferenceCandidateV1Schema.safeParse({
        state: "absent",
      }).success,
    ).toBe(false);
    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalInitialDestinationNamespaceReferenceCandidateV1Schema.safeParse({
        ...absent.projection.initialDestinationNamespace,
        current: current.projection.initialDestinationNamespace.state === "current"
          ? current.projection.initialDestinationNamespace.current
          : undefined,
      }).success,
    ).toBe(false);
    await expect(
      diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1(
        absent.ready.buildInput,
      ),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1(
        current.ready.buildInput,
      ),
    ).resolves.toMatchObject({ ok: true });

    for (const initialDestinationState of ["absent", "current"] as const) {
      const drift = await operationFixtureV1({
        initialDestinationState,
        endpointPostDestinationBranchDrift: true,
      });
      await expect(
        diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1(
          drift.ready.buildInput,
        ),
        initialDestinationState,
      ).resolves.toEqual({
        ok: false,
        stage: "post_observation",
        reason: "snapshot_changed",
      });
      expectZeroSinkSnapshotV1(drift.audit.snapshot);
    }
  }, 60_000);

  it("runs consume POST in fulfill/reject/cleanup paths for all nine sinks and keeps upper bounds cycle-free", async () => {
    async function successfulValueV1(options: Parameters<typeof operationFixtureV1>[0] = {}) {
      const fixture = await operationFixtureV1(options);
      const result =
        await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1(
          fixture.ready.buildInput,
        );
      if (!result.ok) {
        throw new TypeError(`expected success, got ${result.stage}/${result.reason}`);
      }
      return { fixture, value: result.value };
    }
    function expectSamePrePlanDigestsV1(
      left: Awaited<ReturnType<typeof successfulValueV1>>["value"],
      right: Awaited<ReturnType<typeof successfulValueV1>>["value"],
    ) {
      expect(right.completeSourceReadClosure).toEqual(left.completeSourceReadClosure);
      expect(right.sourceDryRunCut).toEqual(left.sourceDryRunCut);
      expect(right.historyQuotaSizing).toEqual(left.historyQuotaSizing);
      expect(right.historyQuotaSizingDigest).toBe(left.historyQuotaSizingDigest);
      expect(right.historyQuotaAdmission).toEqual(left.historyQuotaAdmission);
      expect(right.admissionVectorDigest).toBe(left.admissionVectorDigest);
    }

    const baseline = await successfulValueV1();
    expect(baseline.fixture.audit.calls.observations).toBe(3);
    const changedIdentity = await successfulValueV1({
      providerId: "durable-object-provider:d41-prospective-cycle-free",
    });
    expectSamePrePlanDigestsV1(baseline.value, changedIdentity.value);
    expect(changedIdentity.value.migrationId).not.toBe(baseline.value.migrationId);
    expect(changedIdentity.value.reservationDescriptors).not.toEqual(
      baseline.value.reservationDescriptors,
    );
    expect(changedIdentity.value.planCandidate.contentDigest).not.toBe(
      baseline.value.planCandidate.contentDigest,
    );

    const changedPlanOnly = await successfulValueV1({
      createdAt: "2026-08-15T01:00:03.000Z",
    });
    expectSamePrePlanDigestsV1(baseline.value, changedPlanOnly.value);
    expect(changedPlanOnly.value.migrationId).toBe(baseline.value.migrationId);
    expect(changedPlanOnly.value.reservationDescriptors).toEqual(
      baseline.value.reservationDescriptors,
    );
    expect(changedPlanOnly.value.planCandidate.contentDigest).not.toBe(
      baseline.value.planCandidate.contentDigest,
    );

    planEnvelopeActualBytesOverrideV1.value = 4_194_304;
    try {
      const changedActualBytes = await successfulValueV1();
      expectSamePrePlanDigestsV1(baseline.value, changedActualBytes.value);
      expect(changedActualBytes.value.migrationId).toBe(baseline.value.migrationId);
      expect(changedActualBytes.value.reservationDescriptors).toEqual(
        baseline.value.reservationDescriptors,
      );
      expect(changedActualBytes.value.planCandidate.contentDigest).toBe(
        baseline.value.planCandidate.contentDigest,
      );
    } finally {
      planEnvelopeActualBytesOverrideV1.value = undefined;
    }

    const zeroDeltaReject = await operationFixtureV1({
      requestLiveReferenceSchemaDigest: digestV1("d"),
    });
    await expect(
      diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1(
        zeroDeltaReject.ready.buildInput,
      ),
    ).resolves.toEqual({
      ok: false,
      stage: "current_strong_source",
      reason: "source_invalid",
    });
    expect(zeroDeltaReject.audit.calls.observations).toBe(2);

    const cleanupReject = await operationFixtureV1({
      requestLiveReferenceSchemaDigest: digestV1("d"),
      auditThrowOnObservation: 2,
    });
    await expect(
      diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1(
        cleanupReject.ready.buildInput,
      ),
    ).resolves.toEqual({
      ok: false,
      stage: "side_effect_boundary",
      reason: "side_effect_detected",
    });
    expect(cleanupReject.audit.calls.observations).toBe(2);

    for (const sinkName of sinkNames) {
      const delta = await operationFixtureV1({
        requestLiveReferenceSchemaDigest: digestV1("d"),
      });
      delta.audit.snapshot[sinkName] = {
        ...delta.audit.snapshot[sinkName],
        count: 1,
      };
      await expect(
        diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1(
          delta.ready.buildInput,
        ),
        sinkName,
      ).resolves.toEqual({
        ok: false,
        stage: "side_effect_boundary",
        reason: "side_effect_detected",
      });
      expect(delta.audit.calls.observations, sinkName).toBe(2);
    }
  }, 120_000);

  it.each([
    {
      label: "source freeze",
      options: { sourcePostDrift: true },
      expectedQuotaCuts: ["pre"],
      expectedEndpointCalls: ["pre"],
    },
    {
      label: "authenticated quota high-water",
      options: { quotaPostDrift: true },
      expectedQuotaCuts: ["pre", "post"],
      expectedEndpointCalls: ["pre"],
    },
    {
      label: "endpoint",
      options: { endpointPostDrift: true },
      expectedQuotaCuts: ["pre", "post"],
      expectedEndpointCalls: ["pre", "post"],
    },
  ])("rejects late $label drift after the complete read while all nine write sinks remain zero", async ({
    options,
    expectedQuotaCuts,
    expectedEndpointCalls,
  }) => {
    const drift = await operationFixtureV1(options);
    await expect(
      buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1(
        drift.ready.buildInput,
      ),
    ).rejects.toMatchObject({
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });
    expect(drift.source.calls.eof).toBe(1);
    expect(drift.source.calls.continuity).toBe(2);
    expect(drift.quota.calls.cuts).toEqual(expectedQuotaCuts);
    expect(drift.endpointCalls).toEqual(expectedEndpointCalls);
    expectZeroSinkSnapshotV1(drift.audit.snapshot);
  });
});

let d42BaselineCandidatePromise:
  | Promise<
      Extract<
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateDiagnosticResultInternalV1,
        { readonly ok: true }
      >["value"]
    >
  | undefined;

function d42BaselineCandidateV1() {
  d42BaselineCandidatePromise ??= (async () => {
    const fixture = await operationFixtureV1();
    const result =
      await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateInternalV1(
        fixture.ready.buildInput,
      );
    if (!result.ok) {
      throw new TypeError("D-42 baseline D-41 candidate failed");
    }
    return result.value;
  })();
  return d42BaselineCandidatePromise;
}

async function d42MintFixtureV1(options: {
  readonly invalidSignature?: boolean;
  readonly mutateAuditOnObservation?: number;
  readonly mutateAuditSink?: (typeof d42SinkNames)[number];
  readonly throwAuditOnObservation?: number;
} = {}) {
  const expectedD41 = await d42BaselineCandidateV1();
  const mapping =
    deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalMigrationIdMappingV1(
      expectedD41.migrationId,
    );
  const inputs = await operationInputsV1();
  const signed =
    buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedRegistrySuccessorFixture({
      distributionRawRequest,
      prospectiveDestination: inputs.prospective,
      formalMigrationId: mapping.formalMigrationId,
      invalidSignature: options.invalidSignature,
    });
  const signedSourceCapability =
    mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedRegistryManifestSourceCapabilityInternalV1(
      { externallySignedManifestEnvelope: signed.envelope },
    );
  const audit = d42AuditObserverV1({
    mutateOnObservation: options.mutateAuditOnObservation,
    mutateSink: options.mutateAuditSink,
    throwOnObservation: options.throwAuditOnObservation,
  });
  const request = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_prepared_registry_successor_request_reference_candidate_v1" as const,
    preSideEffectRequest: inputs.request,
    expectedCandidateMigrationId: expectedD41.migrationId,
    expectedPreparedRegistryManifestPin: signed.pin,
  };
  const mintInput = {
    acceptanceClosureIdentity:
      inputs.prePlanMintInput.acceptanceClosureIdentity,
    endpointObservationHost:
      inputs.prePlanMintInput.endpointObservationHost,
    externallySignedPreparedRegistryManifestSourceCapability:
      signedSourceCapability,
    prospectiveDestinationPreparedSourceCapability:
      inputs.prePlanMintInput.prospectiveDestinationPreparedSourceCapability,
    quotaObservationHost: inputs.prePlanMintInput.quotaObservationHost,
    request,
    sideEffectAuditObserver: audit.observer,
    sourceStreamHost: inputs.prePlanMintInput.sourceStreamHost,
    verifiedLiveReferenceSchemaDigest:
      inputs.prePlanMintInput.verifiedLiveReferenceSchemaDigest,
    verifiedMigrationProtocolDigest:
      inputs.prePlanMintInput.verifiedMigrationProtocolDigest,
  };
  return {
    expectedD41,
    mapping,
    inputs,
    signed,
    signedSourceCapability,
    audit,
    request,
    mintInput,
  };
}

async function d42OperationFixtureV1(options: {
  readonly invalidSignature?: boolean;
  readonly mutateAuditOnObservation?: number;
  readonly mutateAuditSink?: (typeof d42SinkNames)[number];
  readonly throwAuditOnObservation?: number;
} = {}) {
  const fixture = await d42MintFixtureV1(options);
  const ready =
    await mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityInternalV1(
      fixture.mintInput,
    );
  return { ...fixture, ready };
}

describe("D-42 same-cohort prepared Registry successor integration", () => {
  it("validates one externally root-signed direct prepared successor while all twelve sinks stay zero", async () => {
    const fixture = await d42OperationFixtureV1();
    const result =
      await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateInternalV1(
        fixture.ready.buildInput,
      );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1Schema.parse(
        result.value,
      ),
    ).toEqual(result.value);
    expect(result.value.preSideEffectPlanAdmissionClosure.migrationId).toBe(
      fixture.expectedD41.migrationId,
    );
    expect(result.value.formalMigrationIdMapping).toEqual(fixture.mapping);
    expect(result.value.preparedRegistryManifestPin).toEqual(
      fixture.signed.pin,
    );
    expect(result.value.preparedRegistryManifestEnvelope).toEqual(
      fixture.signed.envelope,
    );
    expect(result.value.preparedRegistryManifestEnvelope.payload.routing).toEqual({
      state: "migration",
      migrationId: fixture.mapping.formalMigrationId,
      sourceProviderId: fixture.signed.sourceProviderId,
      destinationProviderId: fixture.signed.destinationProviderId,
      activeForMigrationWrites: fixture.signed.sourceProviderId,
      phase: "prepared",
    });
    expect(result.value.publicationGate).toMatchObject({
      state: "locked_awaiting_formal_catalog_direct_successor",
      preparedRegistryDirectSuccessor: "verified_not_published",
      formalCatalogDirectSuccessor: "none",
      formalDestinationTrust: "none",
      formalPlan: "none",
      reservationRecords: "none",
      planPublication: "none",
    });
    expect(result.value.verificationBoundary).toMatchObject({
      preparedRegistryRelationship:
        "root_signed_direct_successor_of_same_cohort_retained_steady_tip_candidate_not_current_or_published_v1",
      rootSigningAuthority:
        "external_signature_verification_only_no_signer_capability_v1",
      providerAuthority: "none",
      durability: "none",
      migrationExecution: "none",
    });
    expect(
      distributionRawRequest.registryManifestHistory.some(
        (entry) => entry.generationId === fixture.signed.envelope.generationId,
      ),
    ).toBe(false);
    expect(Object.keys(result.value.sideEffectBoundary).sort()).toEqual(
      ["policy", ...d42SinkNames].sort(),
    );
    for (const sinkName of d42SinkNames) {
      expect(result.value.sideEffectBoundary[sinkName], sinkName).toBe(0);
      expect(fixture.audit.snapshot[sinkName].count, sinkName).toBe(0);
    }
    expect(fixture.audit.calls.observations).toBe(6);
  }, 120_000);

  it("rejects a valid-but-different expected candidate ID only after fresh D-41 succeeds and keeps all sinks zero", async () => {
    const fixture = await d42MintFixtureV1();
    const differentCandidateMigrationId = flipLastLowerHexV1(
      fixture.request.expectedCandidateMigrationId,
    ) as typeof fixture.request.expectedCandidateMigrationId;
    await expect(
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityInternalV1(
        {
          ...fixture.mintInput,
          request: {
            ...fixture.request,
            expectedCandidateMigrationId: differentCandidateMigrationId,
          },
        },
      ),
    ).rejects.toMatchObject({
      stage: "candidate_identity",
      reason: "candidate_invalid",
    });
    expect(fixture.inputs.source.calls.open).toBe(1);
    for (const sinkName of d42SinkNames) {
      expect(fixture.audit.snapshot[sinkName].count, sinkName).toBe(0);
    }
  }, 120_000);

  it("rejects an expected prepared Pin mismatch before fresh D-41 reads source", async () => {
    const fixture = await d42MintFixtureV1();
    await expect(
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityInternalV1(
        {
          ...fixture.mintInput,
          request: {
            ...fixture.request,
            expectedPreparedRegistryManifestPin: {
              ...fixture.request.expectedPreparedRegistryManifestPin,
              contentDigest: flipLastLowerHexV1(
                fixture.request.expectedPreparedRegistryManifestPin
                  .contentDigest,
              ) as typeof fixture.request.expectedPreparedRegistryManifestPin.contentDigest,
            },
          },
        },
      ),
    ).rejects.toMatchObject({
      stage: "prepared_registry_manifest",
      reason: "successor_invalid",
    });
    expect(fixture.inputs.source.calls.open).toBe(0);
    expect(fixture.audit.calls.observations).toBe(2);
    for (const sinkName of d42SinkNames) {
      expect(fixture.audit.snapshot[sinkName].count, sinkName).toBe(0);
    }
  }, 120_000);

  it("does not let copied, extended, or literal exact2 inputs burn the registered owner", async () => {
    const fixture = await d42OperationFixtureV1();
    const copied = { ...fixture.ready.buildInput };
    const extended = { ...fixture.ready.buildInput, unexpected: true };
    const literal = {
      request: fixture.ready.request,
      preparedRegistrySuccessorReferenceCapability:
        fixture.ready.preparedRegistrySuccessorReferenceCapability,
    };
    for (const forged of [copied, extended, literal]) {
      await expect(
        diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateInternalV1(
          forged,
        ),
      ).resolves.toEqual({
        ok: false,
        stage: "input",
        reason: "schema_invalid",
      });
    }
    const owner =
      await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateInternalV1(
        fixture.ready.buildInput,
      );
    expect(owner.ok).toBe(true);
  }, 120_000);

  it("lets only one concurrent exact owner claim succeed", async () => {
    const fixture = await d42OperationFixtureV1();
    const [left, right] = await Promise.all([
      diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateInternalV1(
        fixture.ready.buildInput,
      ),
      diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateInternalV1(
        fixture.ready.buildInput,
      ),
    ]);
    expect([left.ok, right.ok].sort()).toEqual([false, true]);
    expect([left, right].find((entry) => !entry.ok)).toEqual({
      ok: false,
      stage: "input",
      reason: "schema_invalid",
    });
  }, 120_000);

  it("burns the exact final continuation after a correct claim reaches an invalid external signature", async () => {
    const fixture = await d42OperationFixtureV1({ invalidSignature: true });
    const first =
      await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateInternalV1(
        fixture.ready.buildInput,
      );
    expect(first).toEqual({
      ok: false,
      stage: "prepared_registry_manifest",
      reason: "signature_invalid",
    });
    await expect(
      diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateInternalV1(
        fixture.ready.buildInput,
      ),
    ).resolves.toEqual({
      ok: false,
      stage: "input",
      reason: "schema_invalid",
    });
    expect(fixture.audit.calls.observations).toBe(5);
    for (const sinkName of d42SinkNames) {
      expect(fixture.audit.snapshot[sinkName].count, sinkName).toBe(0);
    }
  }, 120_000);

  it("keeps the trusted signed-source and public-build capabilities zero-key and exact-once", async () => {
    const fixture = await d42OperationFixtureV1();
    expect(Object.isFrozen(fixture.signedSourceCapability)).toBe(true);
    expect(Reflect.ownKeys(fixture.signedSourceCapability)).toEqual([]);
    expect(
      Object.isFrozen(
        fixture.ready.preparedRegistrySuccessorReferenceCapability,
      ),
    ).toBe(true);
    expect(
      Reflect.ownKeys(
        fixture.ready.preparedRegistrySuccessorReferenceCapability,
      ),
    ).toEqual([]);

    const replayAudit = d42AuditObserverV1();
    await expect(
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityInternalV1({
        acceptanceClosureIdentity:
          fixture.inputs.prePlanMintInput.acceptanceClosureIdentity,
        endpointObservationHost:
          fixture.inputs.prePlanMintInput.endpointObservationHost,
        externallySignedPreparedRegistryManifestSourceCapability:
          fixture.signedSourceCapability,
        prospectiveDestinationPreparedSourceCapability:
          fixture.inputs.prePlanMintInput
            .prospectiveDestinationPreparedSourceCapability,
        quotaObservationHost:
          fixture.inputs.prePlanMintInput.quotaObservationHost,
        request: fixture.request,
        sideEffectAuditObserver: replayAudit.observer,
        sourceStreamHost: fixture.inputs.prePlanMintInput.sourceStreamHost,
        verifiedLiveReferenceSchemaDigest:
          fixture.inputs.prePlanMintInput.verifiedLiveReferenceSchemaDigest,
        verifiedMigrationProtocolDigest:
          fixture.inputs.prePlanMintInput.verifiedMigrationProtocolDigest,
      }),
    ).rejects.toMatchObject({
      stage: "prepared_registry_manifest",
      reason: "capability_invalid",
    });
    expect(replayAudit.calls.observations).toBe(2);

    const owner =
      await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateInternalV1(
        fixture.ready.buildInput,
      );
    expect(owner.ok).toBe(true);
  }, 120_000);

  it("classifies a PRE audit observer failure as a side-effect-boundary failure without burning the operation inputs", async () => {
    const fixture = await d42MintFixtureV1({
      throwAuditOnObservation: 1,
    });
    await expect(
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityInternalV1(
        fixture.mintInput,
      ),
    ).rejects.toMatchObject({
      stage: "side_effect_boundary",
      reason: "side_effect_detected",
    });
    expect(fixture.audit.calls.observations).toBe(1);

    const retryAudit = d42AuditObserverV1();
    const ready =
      await mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityInternalV1(
        {
          ...fixture.mintInput,
          sideEffectAuditObserver: retryAudit.observer,
        },
      );
    const owner =
      await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateInternalV1(
        ready.buildInput,
      );
    expect(owner.ok).toBe(true);
  }, 120_000);

  it("preserves the side-effect-boundary diagnostic when the nested fresh D-41 PRE audit observer fails", async () => {
    const fixture = await d42MintFixtureV1({
      throwAuditOnObservation: 2,
    });
    await expect(
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityInternalV1(
        fixture.mintInput,
      ),
    ).rejects.toMatchObject({
      stage: "side_effect_boundary",
      reason: "side_effect_detected",
    });
    expect(fixture.audit.calls.observations).toBe(3);
    for (const sinkName of d42SinkNames) {
      expect(fixture.audit.snapshot[sinkName].count, sinkName).toBe(0);
    }
  }, 120_000);

  it("lets the true-final audit preserve an intermediate observer failure as side-effect-boundary", async () => {
    const fixture = await d42OperationFixtureV1({
      throwAuditOnObservation: 5,
    });
    await expect(
      diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateInternalV1(
        fixture.ready.buildInput,
      ),
    ).resolves.toEqual({
      ok: false,
      stage: "side_effect_boundary",
      reason: "side_effect_detected",
    });
    expect(fixture.audit.calls.observations).toBe(6);
    for (const sinkName of d42SinkNames) {
      expect(fixture.audit.snapshot[sinkName].count, sinkName).toBe(0);
    }
  }, 120_000);

  it("rejects accessor, extra-field, and Proxy request topology before consuming the trusted signed source", async () => {
    const fixture = await d42MintFixtureV1();
    let getterReads = 0;
    const accessorRequest = {
      profile: fixture.request.profile,
      preSideEffectRequest: fixture.request.preSideEffectRequest,
      get expectedCandidateMigrationId() {
        getterReads += 1;
        return fixture.request.expectedCandidateMigrationId;
      },
      expectedPreparedRegistryManifestPin:
        fixture.request.expectedPreparedRegistryManifestPin,
    };
    await expect(
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityInternalV1({
        ...fixture.mintInput,
        request: accessorRequest,
      }),
    ).rejects.toMatchObject({ stage: "input", reason: "schema_invalid" });
    expect(getterReads).toBe(0);

    await expect(
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityInternalV1({
        ...fixture.mintInput,
        request: { ...fixture.request, unexpected: true },
      }),
    ).rejects.toMatchObject({ stage: "input", reason: "schema_invalid" });

    let ownKeyTraps = 0;
    const proxyRequest = new Proxy(fixture.request, {
      ownKeys() {
        ownKeyTraps += 1;
        throw new TypeError("request ownKeys trap");
      },
    });
    await expect(
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityInternalV1({
        ...fixture.mintInput,
        request: proxyRequest,
      }),
    ).rejects.toMatchObject({ stage: "input", reason: "schema_invalid" });
    expect(ownKeyTraps).toBe(1);

    const ready =
      await mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityInternalV1(
        fixture.mintInput,
      );
    const owner =
      await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateInternalV1(
        ready.buildInput,
      );
    expect(owner.ok).toBe(true);
  }, 120_000);

  it("rejects the complete D-42 cross-field tamper matrix even when every non-closure edit is rehashed", async () => {
    const fixture = await d42OperationFixtureV1();
    const result =
      await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateInternalV1(
        fixture.ready.buildInput,
      );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const rehash = (candidate: any) => {
      const { closureContentDigest: _old, ...projection } = candidate;
      candidate.closureContentDigest = domainDigestV1(
        "provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-reference-candidate-v1",
        projection,
      );
    };
    const matrix: ReadonlyArray<{
      readonly label: string;
      readonly rehash: boolean;
      readonly mutate: (candidate: any) => void;
    }> = [
      {
        label: "mapping candidate",
        rehash: true,
        mutate(candidate) {
          candidate.formalMigrationIdMapping.candidateMigrationId =
            flipLastLowerHexV1(
              candidate.formalMigrationIdMapping.candidateMigrationId,
            );
        },
      },
      {
        label: "mapping formal",
        rehash: true,
        mutate(candidate) {
          candidate.formalMigrationIdMapping.formalMigrationId =
            flipLastLowerHexV1(
              candidate.formalMigrationIdMapping.formalMigrationId,
            );
        },
      },
      {
        label: "current steady pin",
        rehash: true,
        mutate(candidate) {
          candidate.currentSteadyRegistryManifestPin.contentDigest =
            flipLastLowerHexV1(
              candidate.currentSteadyRegistryManifestPin.contentDigest,
            );
        },
      },
      {
        label: "prepared predecessor",
        rehash: true,
        mutate(candidate) {
          candidate.preparedRegistryManifestEnvelope.payload.predecessor.contentDigest =
            flipLastLowerHexV1(
              candidate.preparedRegistryManifestEnvelope.payload.predecessor
                .contentDigest,
            );
        },
      },
      {
        label: "prepared generation",
        rehash: true,
        mutate(candidate) {
          candidate.preparedRegistryManifestEnvelope.payload.manifestGeneration += 1;
        },
      },
      {
        label: "prepared Identity",
        rehash: true,
        mutate(candidate) {
          candidate.preparedRegistryManifestEnvelope.payload.installationIdentityGenerationId =
            flipLastLowerHexV1(
              candidate.preparedRegistryManifestEnvelope.payload
                .installationIdentityGenerationId,
            );
        },
      },
      {
        label: "prepared Root",
        rehash: true,
        mutate(candidate) {
          candidate.preparedRegistryManifestEnvelope.payload.activeRootMetadata.contentDigest =
            flipLastLowerHexV1(
              candidate.preparedRegistryManifestEnvelope.payload
                .activeRootMetadata.contentDigest,
            );
        },
      },
      {
        label: "prepared destination member",
        rehash: true,
        mutate(candidate) {
          const member =
            candidate.preparedRegistryManifestEnvelope.payload.members.find(
              (entry: any) =>
                entry.providerId === fixture.signed.destinationProviderId,
            );
          member.registryEntryContentDigest = flipLastLowerHexV1(
            member.registryEntryContentDigest,
          );
        },
      },
      {
        label: "prepared routing",
        rehash: true,
        mutate(candidate) {
          candidate.preparedRegistryManifestEnvelope.payload.routing.phase =
            "rebinding";
        },
      },
      {
        label: "prepared Pin",
        rehash: true,
        mutate(candidate) {
          candidate.preparedRegistryManifestPin.contentDigest =
            flipLastLowerHexV1(
              candidate.preparedRegistryManifestPin.contentDigest,
            );
        },
      },
      {
        label: "publication prerequisite",
        rehash: true,
        mutate(candidate) {
          candidate.publicationPrerequisite.candidatePlanContentDigest =
            flipLastLowerHexV1(
              candidate.publicationPrerequisite.candidatePlanContentDigest,
            );
        },
      },
      {
        label: "publication gate",
        rehash: true,
        mutate(candidate) {
          candidate.publicationGate.state = "open";
        },
      },
      {
        label: "side-effect boundary",
        rehash: true,
        mutate(candidate) {
          candidate.sideEffectBoundary.rootSigningRequests = 1;
        },
      },
      {
        label: "closure digest",
        rehash: false,
        mutate(candidate) {
          candidate.closureContentDigest = flipLastLowerHexV1(
            candidate.closureContentDigest,
          );
        },
      },
    ];
    for (const row of matrix) {
      const candidate = cloneJsonV1(result.value) as any;
      row.mutate(candidate);
      if (row.rehash) rehash(candidate);
      expect(
        ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1Schema.safeParse(
          candidate,
        ).success,
        row.label,
      ).toBe(false);
    }
  }, 120_000);

  it.each(d42SinkNames)("overrides an otherwise valid successor when final %s drifts", async (mutateAuditSink) => {
    const fixture = await d42OperationFixtureV1({
      mutateAuditOnObservation: 6,
      mutateAuditSink,
    });
    await expect(
      diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateInternalV1(
        fixture.ready.buildInput,
      ),
    ).resolves.toEqual({
      ok: false,
      stage: "side_effect_boundary",
      reason: "side_effect_detected",
    });
    expect(fixture.audit.calls.observations).toBe(6);
    expect(fixture.audit.snapshot[mutateAuditSink]).toMatchObject({
      revision: 1,
      count: 1,
    });
    for (const sinkName of d42SinkNames) {
      if (sinkName === mutateAuditSink) continue;
      expect(fixture.audit.snapshot[sinkName].count, sinkName).toBe(0);
    }
  }, 120_000);

  it("lets final sink drift override an invalid external signature diagnostic", async () => {
    const fixture = await d42OperationFixtureV1({
      invalidSignature: true,
      mutateAuditOnObservation: 5,
      mutateAuditSink: "rootSigningRequests",
    });
    await expect(
      diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateInternalV1(
        fixture.ready.buildInput,
      ),
    ).resolves.toEqual({
      ok: false,
      stage: "side_effect_boundary",
      reason: "side_effect_detected",
    });
    expect(fixture.audit.calls.observations).toBe(5);
    expect(fixture.audit.snapshot.rootSigningRequests).toMatchObject({
      revision: 1,
      count: 1,
    });
  }, 120_000);
});

async function d43MintFixtureV1(options: {
  readonly invalidCatalogSignature?: boolean;
} = {}) {
  const expectedD41 = await d42BaselineCandidateV1();
  const mapping =
    deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalMigrationIdMappingV1(
      expectedD41.migrationId,
    );
  const inputs = await operationInputsV1();
  const signedRegistry =
    buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedRegistrySuccessorFixture({
      distributionRawRequest,
      prospectiveDestination: inputs.prospective,
      formalMigrationId: mapping.formalMigrationId,
    });
  const signedCatalog =
    buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedCatalogSuccessorFixture({
      distributionRawRequest,
      prospectiveDestination: inputs.prospective,
      invalidSignature: options.invalidCatalogSignature,
    });
  const signedRegistrySourceCapability =
    mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedRegistryManifestSourceCapabilityInternalV1({
      externallySignedManifestEnvelope: signedRegistry.envelope,
    });
  const signedCatalogSourceCapability =
    mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedPreparedCatalogSourceCapabilityInternalV1({
      externallySignedCatalogEnvelope: signedCatalog.envelope,
    });
  const audit = d42AuditObserverV1();
  const preparedRegistrySuccessorRequest = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_prepared_registry_successor_request_reference_candidate_v1" as const,
    preSideEffectRequest: inputs.request,
    expectedCandidateMigrationId: expectedD41.migrationId,
    expectedPreparedRegistryManifestPin: signedRegistry.pin,
  };
  const request = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_prepared_catalog_successor_request_reference_candidate_v1" as const,
    preparedRegistrySuccessorRequest,
    expectedPreparedCatalogPin: signedCatalog.pin,
  };
  const mintInput = {
    acceptanceClosureIdentity:
      inputs.prePlanMintInput.acceptanceClosureIdentity,
    endpointObservationHost:
      inputs.prePlanMintInput.endpointObservationHost,
    externallySignedPreparedCatalogSourceCapability:
      signedCatalogSourceCapability,
    externallySignedPreparedRegistryManifestSourceCapability:
      signedRegistrySourceCapability,
    prospectiveDestinationPreparedSourceCapability:
      inputs.prePlanMintInput.prospectiveDestinationPreparedSourceCapability,
    quotaObservationHost: inputs.prePlanMintInput.quotaObservationHost,
    request,
    sideEffectAuditObserver: audit.observer,
    sourceStreamHost: inputs.prePlanMintInput.sourceStreamHost,
    verifiedLiveReferenceSchemaDigest:
      inputs.prePlanMintInput.verifiedLiveReferenceSchemaDigest,
    verifiedMigrationProtocolDigest:
      inputs.prePlanMintInput.verifiedMigrationProtocolDigest,
  };
  return {
    expectedD41,
    mapping,
    inputs,
    signedRegistry,
    signedCatalog,
    signedRegistrySourceCapability,
    signedCatalogSourceCapability,
    audit,
    request,
    mintInput,
  };
}

async function d43OperationFixtureV1(options: {
  readonly invalidCatalogSignature?: boolean;
} = {}) {
  const fixture = await d43MintFixtureV1(options);
  const ready =
    await mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCapabilityInternalV1(
      fixture.mintInput,
    );
  return { ...fixture, ready };
}

describe("D-43 same-cohort prepared Catalog successor integration", () => {
  it("validates one externally root-signed Catalog successor after a fresh D-42 while all twelve sinks stay zero", async () => {
    const fixture = await d43OperationFixtureV1();
    const result =
      await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateInternalV1(
        fixture.ready.buildInput,
      );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateValidationV1Schema.parse(
        result.value,
      ),
    ).toEqual(result.value);
    expect(result.value.preparedRegistrySuccessorClosure.preparedRegistryManifestPin).toEqual(
      fixture.signedRegistry.pin,
    );
    expect(result.value.preparedSupportCatalogPin).toEqual(
      fixture.signedCatalog.pin,
    );
    expect(result.value.preparedSupportCatalogEnvelope).toEqual(
      fixture.signedCatalog.envelope,
    );
    expect(result.value.publicationGate).toMatchObject({
      state: "locked_awaiting_formal_destination_trust_and_plan",
      preparedRegistryDirectSuccessor: "verified_not_published",
      formalCatalogDirectSuccessor: "verified_not_published",
      formalDestinationTrust: "none",
      requiredNext: "formal_destination_trust_and_plan",
      formalPlan: "none",
      reservationRecords: "none",
      registryManifestPublication: "none",
      catalogPublication: "none",
      migrationOnlyAcceptance: "none",
    });
    expect(
      distributionRawRequest.providerFeasibilitySupportCatalogHistory.some(
        (entry) =>
          entry.contentDigest === fixture.signedCatalog.envelope.contentDigest,
      ),
    ).toBe(false);
    for (const sinkName of d42SinkNames) {
      expect(result.value.sideEffectBoundary[sinkName], sinkName).toBe(0);
      expect(fixture.audit.snapshot[sinkName].count, sinkName).toBe(0);
    }
  }, 120_000);

  it("burns a signed Catalog source after an expected Pin mismatch before fresh D-42", async () => {
    const fixture = await d43MintFixtureV1();
    await expect(
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCapabilityInternalV1({
        ...fixture.mintInput,
        request: {
          ...fixture.request,
          expectedPreparedCatalogPin: {
            ...fixture.request.expectedPreparedCatalogPin,
            contentDigest: flipLastLowerHexV1(
              fixture.request.expectedPreparedCatalogPin.contentDigest,
            ),
          },
        },
      }),
    ).rejects.toMatchObject({
      stage: "prepared_catalog_successor",
      reason: "successor_invalid",
    });
    await expect(
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCapabilityInternalV1(
        fixture.mintInput,
      ),
    ).rejects.toMatchObject({
      stage: "prepared_catalog_successor",
      reason: "capability_invalid",
    });
    expect(fixture.inputs.source.calls.open).toBe(0);
    for (const sinkName of d42SinkNames) {
      expect(fixture.audit.snapshot[sinkName].count, sinkName).toBe(0);
    }
  }, 120_000);

  it("lets only one concurrent exact D-43 build owner claim succeed", async () => {
    const fixture = await d43OperationFixtureV1();
    const [left, right] = await Promise.all([
      diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateInternalV1(
        fixture.ready.buildInput,
      ),
      diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorReferenceCandidateInternalV1(
        fixture.ready.buildInput,
      ),
    ]);
    expect([left.ok, right.ok].sort()).toEqual([false, true]);
    expect([left, right].find((entry) => !entry.ok)).toEqual({
      ok: false,
      stage: "input",
      reason: "schema_invalid",
    });
  }, 120_000);
});

function d44CompoundPublicationMachineV1(
  fixture: Awaited<ReturnType<typeof d43MintFixtureV1>>,
): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1 {
  const currentCut =
    fixture.expectedD41.destinationTrust.authorization
      .prospectiveDestinationCut;
  return mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
    {
      currentRegistryManifestEnvelope:
        currentCut.currentSteadyRegistryManifestEnvelope,
      currentRegistryManifestPin:
        currentCut.currentSteadyRegistryManifestPin,
      currentSupportCatalogEnvelope:
        currentCut.currentSupportCatalogEnvelope,
      currentSupportCatalogPin: currentCut.currentSupportCatalog,
      migrationPublicationState:
        createProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationEmptyStateInternalV1(),
    },
  );
}

async function d44OperationFixtureV1(options: {
  readonly compoundPublicationReferenceMachineCapability?:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1;
  readonly operationNonce?: string;
}) {
  const fixture = await d43MintFixtureV1();
  const currentCut =
    fixture.expectedD41.destinationTrust.authorization
      .prospectiveDestinationCut;
  const compoundPublicationReferenceMachineCapability =
    options.compoundPublicationReferenceMachineCapability ??
    d44CompoundPublicationMachineV1(fixture);
  const ready =
    await mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceCapabilityInternalV1(
      {
        ...fixture.mintInput,
        compoundPublicationReferenceMachineCapability,
        request: {
          profile:
            "provider_migration_same_installation_identity_current_strong_source_normal_formal_plan_publication_reference_request_v1",
          preparedCatalogSuccessorRequest: fixture.request,
          operationNonce:
            options.operationNonce ?? LowerHex32V1Schema.parse("d4".repeat(16)),
          expectedCurrentRegistryManifestPin:
            currentCut.currentSteadyRegistryManifestPin,
          expectedCurrentSupportCatalogPin:
            currentCut.currentSupportCatalog,
        },
      },
    );
  return {
    ...fixture,
    compoundPublicationReferenceMachineCapability,
    ready,
  };
}

describe("D-44 formal Plan and compound publication reference integration", () => {
  it("derives the formal Plan from a fresh D-43 and commits, then replays the same nonce byte-identically", async () => {
    const operationNonce = LowerHex32V1Schema.parse("d4".repeat(16));
    const firstFixture = await d43MintFixtureV1();
    const machine = d44CompoundPublicationMachineV1(firstFixture);
    const first = await d44OperationFixtureV1({
      compoundPublicationReferenceMachineCapability: machine,
      operationNonce,
    });
    const firstResult =
      await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceCandidateInternalV1(
        first.ready.buildInput,
      );
    expect(firstResult).toMatchObject({ ok: true });
    if (!firstResult.ok) return;

    const value = firstResult.value;
    const independentlyDerived =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateV1(
        value.preparedCatalogSuccessorClosure,
      );
    expect(independentlyDerived).toEqual(value.formalPlanClosure);
    expect(value).toMatchObject({
      authority:
        "in_memory_reference_machine_only_no_production_provider_authority_v1",
      durability: "in_memory_reference_only_not_a_durable_provider_v1",
      replay: false,
      stateRevision: 1,
    });
    expect(
      value.formalPlanEnvelope.payload.candidateToFormalMigrationIdMapping,
    ).toEqual(
      value.preparedCatalogSuccessorClosure.preparedRegistrySuccessorClosure
        .formalMigrationIdMapping,
    );
    expect(
      value.formalPlanClosure.formalDestinationTrust
        .preparedRegistryMemberOrdinal,
    ).toBeGreaterThanOrEqual(0);
    expect(
      value.formalPlanClosure.formalDestinationTrust
        .preparedSupportCatalogTargetOrdinal,
    ).toBeGreaterThanOrEqual(0);
    expect(
      value.formalPlanClosure.formalDestinationTrust
        .preparedSupportCatalogCandidateOrdinal,
    ).toBeGreaterThanOrEqual(0);
    expect(value.formalPlanClosure.formalDestinationTrust.candidate.providerId).toBe(
      first.signedCatalog.destinationProviderId,
    );
    expect(value.formalReservationDescriptor).toEqual(
      value.formalPlanEnvelope.payload.migrationHistoryQuotaReservations
        .journal,
    );
    expect(value.formalPlanPin.contentDigest).toBe(
      value.formalPlanEnvelope.contentDigest,
    );
    expect(value.formalPlanClosure.publicationState).toMatchObject({
      state: "constructed_not_published_or_reserved",
      reservationRecord: "none",
      reservationToken: "none",
      registryManifestPublication: "none",
      catalogPublication: "none",
      planPublication: "none",
    });
    expect(value.reservationRecord.descriptor).toEqual(
      value.formalReservationDescriptor,
    );
    expect(value.currentRegistryManifestPin).toEqual(
      first.signedRegistry.pin,
    );
    expect(value.currentSupportCatalogPin).toEqual(first.signedCatalog.pin);
    expect(value.committedReceipt).toMatchObject({
      status: "committed",
      operationNonce,
      publishedRegistryManifestPin: first.signedRegistry.pin,
      publishedSupportCatalogPin: first.signedCatalog.pin,
      publishedFormalPlanPin: value.formalPlanPin,
    });

    const replay = await d44OperationFixtureV1({
      compoundPublicationReferenceMachineCapability: machine,
      operationNonce,
    });
    const replayResult =
      await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceCandidateInternalV1(
        replay.ready.buildInput,
      );
    expect(replayResult.ok).toBe(true);
    if (!replayResult.ok) return;
    expect(replayResult.value.replay).toBe(true);
    expect(replayResult.value.committedReceipt).toBe(value.committedReceipt);
    expect(
      canonicalizeJcsSafeIntegerV1(replayResult.value.committedReceipt),
    ).toBe(canonicalizeJcsSafeIntegerV1(value.committedReceipt));
  }, 180_000);

  it("rejects a tampered formal Plan content digest derived from the fresh D-43 closure", async () => {
    const operation = await d44OperationFixtureV1({});
    const result =
      await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanPublicationReferenceCandidateInternalV1(
        operation.ready.buildInput,
      );
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    const tampered = cloneJsonV1(result.value.formalPlanClosure) as any;
    tampered.formalPlanEnvelope.contentDigest = flipLastLowerHexV1(
      tampered.formalPlanEnvelope.contentDigest,
    );
    expect(() =>
      validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalPlanReferenceCandidateV1(
        tampered,
      ),
    ).toThrow();
  }, 120_000);
});

function d45AcceptanceMachineV1(): Promise<
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1
> {
  return mintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(
    {
      identityVerificationCapability: currentFixture.identityCapability,
      initialState: currentFixture.d40.referenceState,
      retainedNonAcceptanceTrustHistoryLogicalBytes: 0,
    },
  );
}

async function d45OperationFixtureV1(options: {
  readonly compoundPublicationReferenceMachineCapability?:
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineCapabilityInternalV1;
  readonly acceptanceReferenceMachineCapability?:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineCapabilityInternalV1;
  readonly acceptanceIdentityVerificationCapability?:
    ProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityV1;
  readonly publicationOperationNonce?: ReturnType<typeof LowerHex32V1Schema.parse>;
  readonly acceptanceOperationNonce?: ReturnType<typeof LowerHex32V1Schema.parse>;
}) {
  const fixture = await d43MintFixtureV1();
  const currentCut =
    fixture.expectedD41.destinationTrust.authorization
      .prospectiveDestinationCut;
  const compoundPublicationReferenceMachineCapability =
    options.compoundPublicationReferenceMachineCapability ??
    d44CompoundPublicationMachineV1(fixture);
  const acceptanceReferenceMachineCapability =
    options.acceptanceReferenceMachineCapability ??
    await d45AcceptanceMachineV1();
  const acceptanceIdentityVerificationCapability =
    options.acceptanceIdentityVerificationCapability ??
    currentFixture.identityCapability;
  const ready =
    await mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceCapabilityInternalV1(
      {
        ...fixture.mintInput,
        acceptanceIdentityVerificationCapability:
          acceptanceIdentityVerificationCapability,
        acceptanceReferenceMachineCapability,
        compoundPublicationReferenceMachineCapability,
        request: {
          profile:
            "provider_migration_same_installation_identity_current_strong_source_normal_migration_only_acceptance_reference_request_v1",
          formalPlanPublicationRequest: {
            profile:
              "provider_migration_same_installation_identity_current_strong_source_normal_formal_plan_publication_reference_request_v1",
            preparedCatalogSuccessorRequest:
              ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedCatalogSuccessorRequestReferenceCandidateV1Schema.parse(
                fixture.request,
              ),
            operationNonce:
              options.publicationOperationNonce ??
              LowerHex32V1Schema.parse("f4".repeat(16)),
            expectedCurrentRegistryManifestPin:
              currentCut.currentSteadyRegistryManifestPin,
            expectedCurrentSupportCatalogPin:
              currentCut.currentSupportCatalog,
          },
          acceptanceOperationNonce:
            options.acceptanceOperationNonce ??
            LowerHex32V1Schema.parse("a5".repeat(16)),
          acceptedAt: ProviderRegistryIsoTimestampV1Schema.parse(
            "2026-08-15T01:00:02Z",
          ),
          resolvedAt: ProviderRegistryIsoTimestampV1Schema.parse(
            "2026-08-15T01:00:03Z",
          ),
        },
      },
    );
  return {
    ...fixture,
    compoundPublicationReferenceMachineCapability,
    acceptanceReferenceMachineCapability,
    acceptanceIdentityVerificationCapability,
    ready,
  };
}

async function endToEndRebindingExecutionFixtureV1(options: {
  readonly invalidRebindingSignature?: boolean;
  readonly invalidSourceDrainedSignature?: boolean;
  readonly invalidSteadySignature?: boolean;
} = {}) {
  const fixture = await d45OperationFixtureV1({});
  const signedRebinding =
    buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedRebindingRegistrySuccessorFixture(
      {
        currentPreparedRegistryManifestEnvelope: fixture.signedRegistry.envelope,
        invalidSignature: options.invalidRebindingSignature,
      },
    );
  const activeRootKeyId =
    fixture.signedRegistry.envelope.payload.activeRootMetadata.rootKeyId;
  const activeRoot = distributionRawRequest.rootMetadataHistory.find(
    (entry) => entry.payload.activeRoot.rootKeyId === activeRootKeyId,
  )?.payload.activeRoot;
  if (activeRoot === undefined) {
    throw new TypeError("rebinding fixture requires the current active Root");
  }
  const externallySignedRebindingRegistryManifestSourceCapability =
    mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedRebindingRegistryManifestSourceCapabilityInternalV1(
      {
        externallySignedManifestEnvelope: signedRebinding.envelope,
        activeRoot,
        strictCryptoCapability,
      },
    );
  const signedSourceDrained =
    buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSourceDrainedRegistrySuccessorFixture(
      {
        currentRebindingRegistryManifestEnvelope: signedRebinding.envelope,
        invalidSignature: options.invalidSourceDrainedSignature,
      },
    );
  const externallySignedSourceDrainedRegistryManifestSourceCapability =
    mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSourceDrainedRegistryManifestSourceCapabilityInternalV1(
      {
        externallySignedManifestEnvelope: signedSourceDrained.envelope,
        activeRoot,
        strictCryptoCapability,
      },
    );
  const signedSteady =
    buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSteadyRegistrySuccessorFixture(
      {
        currentSourceDrainedRegistryManifestEnvelope:
          signedSourceDrained.envelope,
        invalidSignature: options.invalidSteadySignature,
      },
    );
  const externallySignedSteadyRegistryManifestSourceCapability =
    mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalExternallySignedSteadyRegistryManifestSourceCapabilityInternalV1(
      {
        externallySignedManifestEnvelope: signedSteady.envelope,
        activeRoot,
        strictCryptoCapability,
      },
    );
  return {
    ...fixture,
    signedRebinding,
    externallySignedRebindingRegistryManifestSourceCapability,
    signedSourceDrained,
    externallySignedSourceDrainedRegistryManifestSourceCapability,
    signedSteady,
    externallySignedSteadyRegistryManifestSourceCapability,
  };
}

describe("D-45 migration-only Acceptance compare-append reference integration", () => {
  it("appends one strict identity-keyed migration-only Acceptance after D-44 and irreversibly retires the D-40 writer", async () => {
    const fixture = await d45OperationFixtureV1({});
    const result =
      await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceCandidateInternalV1(
        fixture.ready.buildInput,
      );
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    const value = result.value;
    const sourceReadClosure =
      value.formalPlanPublicationClosure.formalPlanEnvelope.payload
        .completeSourceReadClosure;
    expect(value).toMatchObject({
      authority:
        "in_memory_reference_machine_only_no_production_provider_authority_v1",
      durability: "in_memory_reference_only_not_a_durable_provider_v1",
      relationship:
        "committed_d44_publication_strict_migration_only_acceptance_compare_appended_v1",
      acceptedRegistryManifestPin: fixture.signedRegistry.pin,
      acceptedSupportCatalogPin: fixture.signedCatalog.pin,
      sourceObjectCount: sourceReadClosure.objectCount,
      sourceLogicalBytes: sourceReadClosure.logicalObjectBytesTotal,
    });
    expect(value.sourceObjectCount).toBeGreaterThanOrEqual(1);
    expect(value.sourceLogicalBytes).toBeGreaterThanOrEqual(0);
    expect(
      value.migrationOnlyAcceptanceEnvelope.payload.configuration
        .publishedTrustPins.registryManifest,
    ).toEqual(fixture.signedRegistry.pin);
    expect(
      value.migrationOnlyAcceptanceEnvelope.payload.configuration
        .publishedTrustPins.supportCatalog,
    ).toEqual(fixture.signedCatalog.pin);
    expect(value.configuration).toMatchObject({
      state: "migration_only",
      reason: "provider_decommission",
      publicStrongWriter: { state: "disabled" },
      formalPlanPin: value.formalPlanPublicationClosure.formalPlanPin,
      executor: {
        state: "enabled_for_plan_only",
        formalMigrationId:
          value.formalPlanPublicationClosure.formalPlanPin.formalMigrationId,
      },
    });
    expect(value.migrationOnlyAcceptanceEnvelope.payload.acceptanceToken)
      .toMatch(/^hmac-sha256:[0-9a-f]{64}$/);
    expect(
      value.configuration.publicStrongWriter.previousActiveWriterSelector
        .selections.some(
        (selection) =>
          selection.providerId === fixture.signedCatalog.destinationProviderId,
      ),
    ).toBe(false);
    expect(value.acceptanceCompareAppendReceipt).toMatchObject({
      outcome: { state: "committed" },
    });
    expect(value.acceptanceReferenceState.migrationOnlyGenerations.at(-1)).toEqual(
      value.migrationOnlyAcceptanceEnvelope,
    );
    expect(value.acceptanceReferenceState.currentAcceptance).toEqual(
      value.migrationOnlyAcceptancePin,
    );

    const retiredTransaction = vi.fn(() => ({
      classification: "candidate_invalid" as const,
    }));
    await expect(
      executeProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1(
        {
          identityVerificationCapability:
            fixture.acceptanceIdentityVerificationCapability,
          referenceMachineCapability:
            fixture.acceptanceReferenceMachineCapability,
          request: {
            ...currentFixture.d40.acceptanceCompareAppendRequest,
            operationNonce: LowerHex32V1Schema.parse("b8".repeat(16)),
          },
          resolvedAt: ProviderRegistryIsoTimestampV1Schema.parse(
            "2026-08-15T01:00:04Z",
          ),
          transaction: retiredTransaction,
        },
      ),
    ).rejects.toMatchObject({
      stage: "reference_machine_capability",
      reason: "capability_invalid",
    });
    expect(retiredTransaction).not.toHaveBeenCalled();
  }, 180_000);

  it("fails stale when another D-45 operation wins the irreversible D-40 handoff", async () => {
    const base = await d43MintFixtureV1();
    const compoundPublicationReferenceMachineCapability =
      d44CompoundPublicationMachineV1(base);
    const acceptanceReferenceMachineCapability =
      await d45AcceptanceMachineV1();
    const acceptanceIdentityVerificationCapability =
      currentFixture.identityCapability;
    const publicationOperationNonce = LowerHex32V1Schema.parse(
      "f5".repeat(16),
    );
    const first = await d45OperationFixtureV1({
      compoundPublicationReferenceMachineCapability,
      acceptanceReferenceMachineCapability,
      acceptanceIdentityVerificationCapability,
      publicationOperationNonce,
      acceptanceOperationNonce: LowerHex32V1Schema.parse("a6".repeat(16)),
    });
    const stale = await d45OperationFixtureV1({
      compoundPublicationReferenceMachineCapability,
      acceptanceReferenceMachineCapability,
      acceptanceIdentityVerificationCapability,
      publicationOperationNonce,
      acceptanceOperationNonce: LowerHex32V1Schema.parse("a7".repeat(16)),
    });
    const firstResult =
      await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceCandidateInternalV1(
        first.ready.buildInput,
      );
    if (!firstResult.ok) {
      throw new TypeError(
        `first D-45 failed: ${firstResult.stage}/${firstResult.reason}`,
      );
    }
    const staleResult =
      await diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationOnlyAcceptanceReferenceCandidateInternalV1(
        stale.ready.buildInput,
      );
    expect(staleResult).toMatchObject({
      ok: false,
      stage: "acceptance_handoff",
      reason: "stale_expected_acceptance",
    });
  }, 300_000);
});

describe("same-Identity migration through final destination strong-ready", () => {
  it("executes every exact formal-Plan object, seals terminal metadata, and activates only the destination strong writer", async () => {
    const fixture = await endToEndRebindingExecutionFixtureV1();
    const result =
      await diagnoseProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveLifecycleReferenceOrchestratorInternalV1(
        {
          migrationOnlyAcceptanceBuildInput: fixture.ready.buildInput,
          externallySignedRebindingRegistryManifestSourceCapability:
            fixture.externallySignedRebindingRegistryManifestSourceCapability,
          rebindingRegistryOperationNonce: LowerHex32V1Schema.parse(
            "e4".repeat(16),
          ),
          executionOperationNonceSeed: LowerHex32V1Schema.parse(
            "e5".repeat(16),
          ),
          externallySignedSourceDrainedRegistryManifestSourceCapability:
            fixture.externallySignedSourceDrainedRegistryManifestSourceCapability,
          sourceDrainedRegistryOperationNonce: LowerHex32V1Schema.parse(
            "e8".repeat(16),
          ),
          externallySignedSteadyRegistryManifestSourceCapability:
            fixture.externallySignedSteadyRegistryManifestSourceCapability,
          steadyRegistryOperationNonce: LowerHex32V1Schema.parse(
            "ea".repeat(16),
          ),
          terminalJournalOperationNonce: LowerHex32V1Schema.parse(
            "ec".repeat(16),
          ),
          finalStrongReadyAcceptanceOperationNonce: LowerHex32V1Schema.parse(
            "ee".repeat(16),
          ),
          finalStrongReadyAcceptedAt: ProviderRegistryIsoTimestampV1Schema.parse(
            "2026-08-15T01:00:04Z",
          ),
          finalStrongReadyResolvedAt: ProviderRegistryIsoTimestampV1Schema.parse(
            "2026-08-15T01:00:05Z",
          ),
        },
      );
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;

    const lifecycle = result.value;
    const value = lifecycle.endToEndExecutionClosure;
    const zeroLive = lifecycle.zeroLiveClosure;
    const sourceDrained = lifecycle.sourceDrainedRegistrySuccessorClosure;
    const steady = lifecycle.steadyRegistryCompletionClosure;
    const sealed = lifecycle.terminalJournalSealedClosure;
    const finalStrongReady = lifecycle.finalStrongReadyAcceptanceClosure;
    const acceptance = value.migrationOnlyAcceptanceClosure;
    const state = value.executionProgressState;
    const plan = acceptance.formalPlanPublicationClosure.formalPlanEnvelope;
    const objects = plan.payload.completeSourceReadClosure.objects;
    const destinationEndpoint =
      plan.payload.formalDestinationTrust.destinationEndpointTrust;
    expect(destinationEndpoint.role).toBe(
      "destination_prospective_not_selected",
    );
    if (destinationEndpoint.role !== "destination_prospective_not_selected") {
      return;
    }
    const destination = destinationEndpoint.prospectiveWriterProjection;
    expect(value).toMatchObject({
      authority:
        "in_memory_reference_machine_only_no_production_provider_authority_v1",
      durability: "in_memory_reference_only_not_a_durable_provider_v1",
      relationship:
        "fresh_d43_committed_d44_strict_migration_only_d45_root_signed_rebinding_registry_plan_only_execution_completed_v1",
    });
    expect(value.rebindingRegistrySuccessorClosure).toMatchObject({
      relationship:
        "externally_root_signed_rebinding_registry_direct_successor_compound_cas_published_current_v1",
      rebindingRegistryManifestEnvelope: fixture.signedRebinding.envelope,
      rebindingRegistryManifestPin: fixture.signedRebinding.pin,
      currentRegistryManifestEnvelope: fixture.signedRebinding.envelope,
      currentRegistryManifestPin: fixture.signedRebinding.pin,
      registryManifestPublicationCount: 1,
      registryPublicationReceipt: {
        routingPhase: "rebinding",
        activeForMigrationWrites:
          fixture.signedRebinding.destinationProviderId,
      },
    });
    expect(
      acceptance.migrationOnlyAcceptanceEnvelope.payload.configuration,
    ).toMatchObject({
      state: "migration_only",
      publicStrongWriter: { state: "disabled" },
      formalPlanPin: acceptance.formalPlanPublicationClosure.formalPlanPin,
      executor: {
        state: "enabled_for_plan_only",
        formalMigrationId:
          acceptance.formalPlanPublicationClosure.formalPlanPin
            .formalMigrationId,
      },
    });
    expect(
      acceptance.migrationOnlyAcceptanceEnvelope.payload.acceptanceToken,
    ).toMatch(/^hmac-sha256:[0-9a-f]{64}$/);
    expect(objects.length).toBeGreaterThanOrEqual(1);
    expect(state.highWater).toMatchObject({
      phase: "completed",
      progressRevision: objects.length + 3,
      sourceObjectCount: objects.length,
      copiedObjectCount: objects.length,
      remainingSourceObjectCount: 0,
      sourceLogicalBytes: acceptance.sourceLogicalBytes,
      copiedLogicalBytes: acceptance.sourceLogicalBytes,
      destinationObjectPublicationCount: objects.length,
    });
    expect(state.destinationPublicationMode).toBe(
      "metadata_only_in_memory_reference_no_external_destination_write_v1",
    );
    expect(state.destinationObjectPublications).toHaveLength(objects.length);
    for (let ordinal = 0; ordinal < objects.length; ordinal += 1) {
      const source = objects[ordinal]!;
      const publication = state.destinationObjectPublications[ordinal]!;
      expect(publication).toMatchObject({
        resolution: "committed",
        publicationOrdinal: ordinal,
        sourceObjectOrdinal: ordinal,
        sourceContentDigest: source.contentDigest,
        sourceSemanticLocatorDigest: source.semanticLocatorDigest,
        sourceLogicalLocatorReferenceDigest:
          source.logicalLocatorReferenceDigest,
        sourceProviderBindingReferenceDigest:
          source.providerBindingReferenceDigest,
        sourceLogicalBytes: source.logicalBytes,
        destinationProviderId: destination.providerId,
        destinationProviderBinding: {
          targetProfileId: destination.targetProfileId,
          providerId: destination.providerId,
          registryEntryContentDigest:
            destination.registryEntryContentDigest,
          semanticProviderPolicyDigest:
            destination.semanticProviderPolicyDigest,
        },
        formalMigrationId: plan.payload.migrationId,
        formalPlanPin: acceptance.formalPlanPublicationClosure.formalPlanPin,
      });
    }
    expect(value.terminalReceipt).toBe(state.receipts.at(-1));
    expect(value.terminalReceipt).toMatchObject({
      progressRecord: {
        transition: "complete_execution",
        phase: "completed",
      },
      destinationObjectPublication: "none",
    });
    expect(lifecycle).toMatchObject({
      authority:
        "in_memory_reference_machine_only_no_production_provider_authority_v1",
      durability: "in_memory_reference_only_not_a_durable_provider_v1",
      relationship:
        "fresh_d43_d44_strict_d45_root_signed_rebinding_execution_completed_destination_universe_zero_live_root_signed_source_drained_root_signed_steady_registry_terminal_journal_sealed_final_destination_strong_ready_v1",
    });
    expect(zeroLive).toMatchObject({
      relationship:
        "exact_completed_execution_forms_destination_universe_and_zero_live_metadata_proof_v1",
      currentRegistryManifestEnvelope: fixture.signedRebinding.envelope,
      currentRegistryManifestPin: fixture.signedRebinding.pin,
      sourceProviderId: fixture.signedRebinding.sourceProviderId,
      destinationProviderId: fixture.signedRebinding.destinationProviderId,
      remainingSourceLiveOrdinals: [],
      completeDestinationPublicationReceiptSet: {
        receiptCount: objects.length,
      },
      destinationUniverseMetadata: {
        destinationProviderId: fixture.signedRebinding.destinationProviderId,
        objectCount: objects.length,
        logicalObjectBytesTotal: acceptance.sourceLogicalBytes,
      },
      zeroLiveReferenceProof: {
        sourceObjectCount: objects.length,
        migratedObjectCount: objects.length,
        remainingSourceLiveObjectCount: 0,
        remainingSourceLiveOrdinals: [],
        remainingSourceLiveReferenceCount: 0,
      },
    });
    expect(zeroLive.executionCompletedState).toBe(state);
    expect(zeroLive.terminalProgressReceipt).toBe(value.terminalReceipt);
    expect(zeroLive.completeDestinationPublicationReceiptSet.receipts).toBe(
      state.destinationObjectPublications,
    );
    expect(sourceDrained).toMatchObject({
      relationship:
        "exact_zero_live_externally_root_signed_source_drained_registry_direct_successor_compound_cas_published_current_v1",
      sourceDrainedRegistryManifestEnvelope:
        fixture.signedSourceDrained.envelope,
      sourceDrainedRegistryManifestPin: fixture.signedSourceDrained.pin,
      currentRegistryManifestEnvelope: fixture.signedSourceDrained.envelope,
      currentRegistryManifestPin: fixture.signedSourceDrained.pin,
      registryManifestPublicationCount: 1,
      registryPublicationReceipt: {
        routingPhase: "source_drained",
        activeForMigrationWrites:
          fixture.signedSourceDrained.destinationProviderId,
      },
    });
    expect(sourceDrained.zeroLiveClosure).toBe(zeroLive);
    expect(steady).toMatchObject({
      relationship:
        "exact_source_drained_externally_root_signed_steady_registry_direct_successor_compound_cas_published_current_v1",
      sourceDrainedRegistrySuccessorClosure: sourceDrained,
      candidateValidation: {
        sourceMemberTombstoneDisposition: "revoked_migration_completed",
        destinationOnlyEnabledMember: true,
        registryManifestPublicationCount: 0,
      },
      steadyRegistryManifestEnvelope: fixture.signedSteady.envelope,
      steadyRegistryManifestPin: fixture.signedSteady.pin,
      currentRegistryManifestEnvelope: fixture.signedSteady.envelope,
      currentRegistryManifestPin: fixture.signedSteady.pin,
      currentSupportCatalogPin: zeroLive.currentSupportCatalogPin,
      formalPlanPin: zeroLive.formalPlanPin,
      terminalProgressReceipt: value.terminalReceipt,
      sourceMemberTombstoneDisposition: "revoked_migration_completed",
      destinationOnlyEnabledMember: true,
      registryManifestPublicationCount: 1,
      registryPublicationReceipt: {
        routingPhase: "steady",
        activeForMigrationWrites: fixture.signedSteady.destinationProviderId,
      },
    });
    expect(steady.sourceDrainedRegistrySuccessorClosure).toBe(sourceDrained);
    const compoundState =
      inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
        fixture.compoundPublicationReferenceMachineCapability,
      );
    expect(compoundState.currentRegistryManifestEnvelope).toStrictEqual(
      fixture.signedSteady.envelope,
    );
    expect(compoundState.currentRegistryManifestPin).toStrictEqual(
      fixture.signedSteady.pin,
    );
    expect(compoundState.currentRegistryManifestEnvelope.payload.routing).toEqual({
      state: "steady",
    });
    expect(compoundState.registrySuccessorPublicationReceipts).toHaveLength(3);
    expect(sealed).toMatchObject({
      authority:
        "in_memory_metadata_reference_only_no_real_provider_bytes_or_io_proof_v1",
      durability:
        "in_memory_terminal_journal_reference_only_not_a_durable_provider_v1",
      relationship:
        "exact_steady_registry_source_tombstone_ready_to_activate_and_progress_head_atomically_sealed_v1",
      steadyRegistryCompletion: steady,
      sourceTombstoneRecord: {
        journalOrdinal: 1,
        sourceProviderId: fixture.signedSteady.sourceProviderId,
        steadyRegistryManifestPin: fixture.signedSteady.pin,
        reason: "migration_completed",
      },
      readyToActivateRecord: {
        journalOrdinal: 2,
        state: "ready_to_activate",
        destinationProviderId: fixture.signedSteady.destinationProviderId,
        steadyRegistryManifestPin: fixture.signedSteady.pin,
        formalPlanPin: zeroLive.formalPlanPin,
      },
      sealedProgressHead: {
        journalOrdinal: 3,
        state: "sealed",
        journalRevision: 1,
        steadyRegistryManifestPin: fixture.signedSteady.pin,
        formalPlanPin: zeroLive.formalPlanPin,
      },
      terminalJournalReceipt: {
        status: "committed",
        operationNonce: LowerHex32V1Schema.parse("ec".repeat(16)),
        previousJournalRevision: 0,
        committedJournalRevision: 1,
      },
      currentRegistryManifestEnvelope: fixture.signedSteady.envelope,
      currentRegistryManifestPin: fixture.signedSteady.pin,
      currentSupportCatalogPin: zeroLive.currentSupportCatalogPin,
      formalPlanPin: zeroLive.formalPlanPin,
      terminalProgressReceipt: value.terminalReceipt,
      journalRevision: 1,
      strongWriterPublicationCount: 0,
      acceptancePublicationCount: 0,
    });
    expect(sealed.steadyRegistryCompletion).toBe(steady);
    expect(finalStrongReady).toMatchObject({
      relationship:
        "exact_terminal_sealed_new_destination_writer_final_strong_ready_acceptance_compare_appended_v1",
      sealedTerminalJournal: sealed,
      destinationProviderId: fixture.signedSteady.destinationProviderId,
      sourceWriterRetired: true,
      migrationOnlyWriterRetired: true,
      destinationOnlyPublicStrongWriter: true,
      finalSteadyRegistryAndCatalogBound: true,
      formalPlanAndTerminalSealBound: true,
      acceptancePublicationCount: 1,
      publicStrongWriterPublicationCount: 1,
      finalStrongReadyAcceptanceEnvelope: {
        payload: {
          configuration: {
            state: "strong_ready",
            core: {
              providerRegistryManifest: fixture.signedSteady.pin,
              providerSupportCatalog: zeroLive.currentSupportCatalogPin,
              activeWriterSelector: {
                selections: [
                  {
                    providerId: fixture.signedSteady.destinationProviderId,
                  },
                ],
              },
            },
            activation: {
              origin: "provider_migration_terminal_sealed_success_v1",
              formalMigrationId: sealed.formalMigrationId,
              formalPlanPin: sealed.formalPlanPin,
              terminalProgressReceiptContentDigest:
                sealed.terminalProgressReceipt.receiptContentDigest,
              terminalJournalReceiptContentDigest:
                sealed.terminalJournalReceiptContentDigest,
              sourceTombstoneRecordContentDigest:
                sealed.sourceTombstoneRecord.contentDigest,
              readyToActivateRecordContentDigest:
                sealed.readyToActivateRecord.contentDigest,
              sealedProgressHeadContentDigest:
                sealed.sealedProgressHead.contentDigest,
            },
          },
        },
      },
      acceptanceCompareAppendReceipt: {
        operationNonce: LowerHex32V1Schema.parse("ee".repeat(16)),
        resolvedAt: ProviderRegistryIsoTimestampV1Schema.parse(
          "2026-08-15T01:00:05Z",
        ),
        outcome: {
          state: "committed",
        },
      },
      acceptanceReferenceState: {
        acceptancePublicationCount: 1,
      },
    });
    expect(finalStrongReady.sealedTerminalJournal).toBe(sealed);
    expect(
      finalStrongReady.acceptanceCompareAppendReceipt.outcome.state,
    ).toBe("committed");
    const destinationWriterContinuation =
      takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalDestinationStrongWriterContinuationInternalV1(
        finalStrongReady,
      );
    expect(destinationWriterContinuation).toMatchObject({
      finalStrongReadyAcceptance: finalStrongReady,
      acceptanceStateEnvelope:
        finalStrongReady.finalStrongReadyAcceptanceEnvelope,
      acceptanceGenerationPin: finalStrongReady.finalStrongReadyAcceptancePin,
      destinationProviderId: fixture.signedSteady.destinationProviderId,
    });
    expect(
      takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFinalDestinationStrongWriterContinuationInternalV1(
        finalStrongReady,
      ),
    ).toBeUndefined();
  }, 300_000);

  it("rejects an invalid steady Root signature while the source-drained Registry tip remains current", async () => {
    const fixture = await endToEndRebindingExecutionFixtureV1({
      invalidSteadySignature: true,
    });
    const result =
      await diagnoseProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalZeroLiveLifecycleReferenceOrchestratorInternalV1(
        {
          migrationOnlyAcceptanceBuildInput: fixture.ready.buildInput,
          externallySignedRebindingRegistryManifestSourceCapability:
            fixture.externallySignedRebindingRegistryManifestSourceCapability,
          rebindingRegistryOperationNonce: LowerHex32V1Schema.parse(
            "e6".repeat(16),
          ),
          executionOperationNonceSeed: LowerHex32V1Schema.parse(
            "e7".repeat(16),
          ),
          externallySignedSourceDrainedRegistryManifestSourceCapability:
            fixture.externallySignedSourceDrainedRegistryManifestSourceCapability,
          sourceDrainedRegistryOperationNonce: LowerHex32V1Schema.parse(
            "e9".repeat(16),
          ),
          externallySignedSteadyRegistryManifestSourceCapability:
            fixture.externallySignedSteadyRegistryManifestSourceCapability,
          steadyRegistryOperationNonce: LowerHex32V1Schema.parse(
            "eb".repeat(16),
          ),
          terminalJournalOperationNonce: LowerHex32V1Schema.parse(
            "ed".repeat(16),
          ),
          finalStrongReadyAcceptanceOperationNonce: LowerHex32V1Schema.parse(
            "ef".repeat(16),
          ),
          finalStrongReadyAcceptedAt: ProviderRegistryIsoTimestampV1Schema.parse(
            "2026-08-15T01:00:06Z",
          ),
          finalStrongReadyResolvedAt: ProviderRegistryIsoTimestampV1Schema.parse(
            "2026-08-15T01:00:07Z",
          ),
        },
      );
    expect(result).toEqual({
      ok: false,
      stage: "steady_registry",
      reason: "signature_invalid",
      upstreamStage: "steady_candidate",
    });
    const compoundState =
      inspectProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompoundPublicationReferenceMachineInternalV1(
        fixture.compoundPublicationReferenceMachineCapability,
      );
    expect(compoundState.currentRegistryManifestEnvelope).toStrictEqual(
      fixture.signedSourceDrained.envelope,
    );
    expect(compoundState.currentRegistryManifestPin).toStrictEqual(
      fixture.signedSourceDrained.pin,
    );
    expect(compoundState.currentRegistryManifestEnvelope.payload.routing)
      .toMatchObject({
        state: "migration",
        phase: "source_drained",
        activeForMigrationWrites:
          fixture.signedSourceDrained.destinationProviderId,
      });
    expect(compoundState.registrySuccessorPublicationReceipts).toHaveLength(2);
  }, 300_000);
});

/**
 * Minimal contracts-side seam smoke for the first durable vertical slice.
 * The host below deliberately keeps object bytes in-memory; the runtime/client
 * package tests cover the separate-process filesystem implementation. This
 * test proves that the lifecycle result itself drives object reads/writes and
 * all four durable CAS phases, including a real stale revision rejection.
 */
function durableExecutionSmokeHostV1(input: {
  readonly sourceProviderId: string;
  readonly destinationProviderId: string;
  readonly initialRevision?: number;
}): {
  readonly host: ProviderMigrationDurableExecutionHostCapabilityInternalV1;
  readonly phases: string[];
  readonly reads: ProviderRuntimeIpcFixedObjectLocatorV1[];
  readonly writes: Array<{
    readonly locator: ProviderRuntimeIpcFixedObjectLocatorV1;
    readonly logicalBytes: number;
    readonly bytes: string;
  }>;
} {
  let revision = input.initialRevision ?? 0;
  let currentPhase = "uninitialized";
  let currentOperationNonce: string | "none" = "none";
  let currentArtifacts: Record<string, ProviderRuntimeIpcJsonValueV1> = {};
  const phases: string[] = [];
  const reads: ProviderRuntimeIpcFixedObjectLocatorV1[] = [];
  const writes: Array<{
    readonly locator: ProviderRuntimeIpcFixedObjectLocatorV1;
    readonly logicalBytes: number;
    readonly bytes: string;
  }> = [];
  const logicalBytesByDigestSuffix: Readonly<Record<string, number>> = {
    "4": 10,
    "5": 20,
    "6": 30,
    "7": 40,
  };
  const state = (): ProviderRuntimeIpcCompareCommitResultV1["state"] => ({
    profile: "provider_runtime_durable_journal_state_v1",
    revision,
    phase: currentPhase,
    operationNonce: currentOperationNonce as never,
    mutationDigest:
      revision === (input.initialRevision ?? 0)
        ? "none"
        : digestV1("d"),
    artifacts: currentArtifacts,
  });
  const host: ProviderMigrationDurableExecutionHostCapabilityInternalV1 = {
    profile: "provider_migration_durable_execution_host_capability_v1",
    sourceProviderId: input.sourceProviderId,
    destinationProviderId: input.destinationProviderId,
    async readSourceObject(locator) {
      expect(locator.providerId).toBe(input.sourceProviderId);
      reads.push(locator);
      const suffix = locator.contentDigest.slice(-1);
      const logicalBytes = logicalBytesByDigestSuffix[suffix] ?? 0;
      const bytes = Buffer.alloc(logicalBytes, suffix.charCodeAt(0));
      const encodedBytes = CanonicalByteStringV1Schema.parse(
        `base64url:${bytes.toString("base64url")}`,
      );
      return {
        operation: "read_object" as const,
        locator,
        logicalBytes,
        bytes: encodedBytes,
        // The contracts orchestrator delegates byte/digest verification to the
        // selected Provider host; the runtime integration tests exercise the
        // cryptographic verification in the real host.
        verifiedContentDigest: locator.contentDigest,
      } satisfies ProviderRuntimeIpcReadObjectResultV1;
    },
    async writeDestinationObject(value) {
      expect(value.locator.providerId).toBe(input.destinationProviderId);
      writes.push(value);
      return {
        operation: "write_object" as const,
        resolution: "committed" as const,
        locator: value.locator,
        logicalBytes: value.logicalBytes,
        verifiedContentDigest: value.locator.contentDigest,
      } satisfies ProviderRuntimeIpcWriteObjectResultV1;
    },
    async compareCommitDestinationJournal(value) {
      phases.push(value.phase);
      if (value.expectedRevision !== revision) {
        return {
          operation: "compare_commit" as const,
          resolution: "stale" as const,
          state: state(),
        } satisfies ProviderRuntimeIpcCompareCommitResultV1;
      }
      revision += 1;
      currentPhase = value.phase;
      currentOperationNonce = value.operationNonce;
      currentArtifacts = value.artifacts;
      return {
        operation: "compare_commit" as const,
        resolution: "committed" as const,
        state: state(),
      } satisfies ProviderRuntimeIpcCompareCommitResultV1;
    },
  };
  return { host, phases, reads, writes };
}

describe("durable migration orchestrator vertical smoke", () => {
  it("runs lifecycle, copies the formal-Plan objects, and commits four durable phases", async () => {
    const fixture = await endToEndRebindingExecutionFixtureV1();
    const smoke = durableExecutionSmokeHostV1({
      sourceProviderId: fixture.signedRebinding.sourceProviderId,
      destinationProviderId: fixture.signedRebinding.destinationProviderId,
    });
    const result = await runProviderMigrationDurableExecutionV1({
      lifecycleInput: {
        migrationOnlyAcceptanceBuildInput: fixture.ready.buildInput,
        externallySignedRebindingRegistryManifestSourceCapability:
          fixture.externallySignedRebindingRegistryManifestSourceCapability,
        rebindingRegistryOperationNonce: LowerHex32V1Schema.parse(
          "31".repeat(16),
        ),
        executionOperationNonceSeed: LowerHex32V1Schema.parse("32".repeat(16)),
        externallySignedSourceDrainedRegistryManifestSourceCapability:
          fixture.externallySignedSourceDrainedRegistryManifestSourceCapability,
        sourceDrainedRegistryOperationNonce: LowerHex32V1Schema.parse(
          "33".repeat(16),
        ),
        externallySignedSteadyRegistryManifestSourceCapability:
          fixture.externallySignedSteadyRegistryManifestSourceCapability,
        steadyRegistryOperationNonce: LowerHex32V1Schema.parse("34".repeat(16)),
        terminalJournalOperationNonce: LowerHex32V1Schema.parse("35".repeat(16)),
        finalStrongReadyAcceptanceOperationNonce: LowerHex32V1Schema.parse(
          "36".repeat(16),
        ),
        finalStrongReadyAcceptedAt: ProviderRegistryIsoTimestampV1Schema.parse(
          "2026-08-15T01:01:04Z",
        ),
        finalStrongReadyResolvedAt: ProviderRegistryIsoTimestampV1Schema.parse(
          "2026-08-15T01:01:05Z",
        ),
      },
      durableHost: smoke.host,
      expectedDurableJournalRevision: 0,
      durableOperationNonceSeed: LowerHex32V1Schema.parse("37".repeat(16)),
    });
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(smoke.phases).toEqual([
      "migration_only_rebinding_prepared",
      "execution_completed",
      "terminal_journal_sealed",
      "final_strong_ready",
    ]);
    expect(smoke.reads.length).toBeGreaterThanOrEqual(1);
    expect(smoke.writes.length).toBe(smoke.reads.length);
    expect(result.value.copiedObjectCount).toBe(smoke.writes.length);
    expect(result.value.finalJournalRevision).toBe(4);
    expect(result.value.finalJournalPhase).toBe("final_strong_ready");
    expect(result.value.finalJournalMutationDigest).toBe(digestV1("d"));
    expect(result.value.finalStrongReadyAcceptancePin).toMatchObject({
      locatorProfile: "installation_provider_acceptance_state_v1",
      acceptanceOrdinal: 3,
    });
  }, 300_000);

  it("returns a durable stale result before copying when the journal revision moved", async () => {
    const fixture = await endToEndRebindingExecutionFixtureV1();
    const smoke = durableExecutionSmokeHostV1({
      sourceProviderId: fixture.signedRebinding.sourceProviderId,
      destinationProviderId: fixture.signedRebinding.destinationProviderId,
      initialRevision: 1,
    });
    const result = await runProviderMigrationDurableExecutionV1({
      lifecycleInput: {
        migrationOnlyAcceptanceBuildInput: fixture.ready.buildInput,
        externallySignedRebindingRegistryManifestSourceCapability:
          fixture.externallySignedRebindingRegistryManifestSourceCapability,
        rebindingRegistryOperationNonce: LowerHex32V1Schema.parse(
          "41".repeat(16),
        ),
        executionOperationNonceSeed: LowerHex32V1Schema.parse("42".repeat(16)),
        externallySignedSourceDrainedRegistryManifestSourceCapability:
          fixture.externallySignedSourceDrainedRegistryManifestSourceCapability,
        sourceDrainedRegistryOperationNonce: LowerHex32V1Schema.parse(
          "43".repeat(16),
        ),
        externallySignedSteadyRegistryManifestSourceCapability:
          fixture.externallySignedSteadyRegistryManifestSourceCapability,
        steadyRegistryOperationNonce: LowerHex32V1Schema.parse("44".repeat(16)),
        terminalJournalOperationNonce: LowerHex32V1Schema.parse("45".repeat(16)),
        finalStrongReadyAcceptanceOperationNonce: LowerHex32V1Schema.parse(
          "46".repeat(16),
        ),
        finalStrongReadyAcceptedAt: ProviderRegistryIsoTimestampV1Schema.parse(
          "2026-08-15T01:02:04Z",
        ),
        finalStrongReadyResolvedAt: ProviderRegistryIsoTimestampV1Schema.parse(
          "2026-08-15T01:02:05Z",
        ),
      },
      durableHost: smoke.host,
      expectedDurableJournalRevision: 0,
      durableOperationNonceSeed: LowerHex32V1Schema.parse("47".repeat(16)),
    });
    expect(result).toMatchObject({
      ok: false,
      stage: "journal_compare_commit",
      reason: "stale_expected_journal",
      observedJournalRevision: 1,
    });
    expect(smoke.phases).toEqual(["migration_only_rebinding_prepared"]);
    expect(smoke.reads).toHaveLength(0);
    expect(smoke.writes).toHaveLength(0);
  }, 300_000);
});
