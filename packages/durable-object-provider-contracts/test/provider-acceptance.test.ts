import { describe, expect, it, vi } from "vitest";

import {
  PROVIDER_ACCEPTANCE_COMPARE_APPEND_RECEIPT_DOMAIN_V1,
  PROVIDER_ACCEPTANCE_COMPARE_APPEND_RECEIPT_TOKEN_DOMAIN_V1,
  PROVIDER_ACCEPTANCE_COMPARE_APPEND_REQUEST_DOMAIN_V1,
  PROVIDER_ACCEPTANCE_CURRENT_VERSION_TOKEN_DOMAIN_V1,
  PROVIDER_ACCEPTANCE_GENERATION_SET_DOMAIN_V1,
  PROVIDER_ACCEPTANCE_HIGH_WATER_DOMAIN_V1,
  PROVIDER_ACCEPTANCE_STATE_TOKEN_DOMAIN_V1,
  ProviderAcceptanceCompareAppendDurableOutcomeV1Schema,
  ProviderAcceptanceCompareAppendReceiptEnvelopeV1Schema,
  ProviderAcceptanceCompareAppendReceiptV1Schema,
  ProviderAcceptanceCompareAppendRequestV1Schema,
  ProviderAcceptanceCompareAppendResultV1Schema,
  ProviderAcceptanceCurrentPinV1Schema,
  ProviderAcceptanceCurrentReadV1Schema,
  ProviderAcceptanceCurrentVersionTokenFieldsV1Schema,
  ProviderAcceptanceGenerationEnumerationEntryV1Schema,
  ProviderAcceptanceGenerationEnumerationV1Schema,
  ProviderAcceptanceHighWaterEnvelopeV1Schema,
  ProviderAcceptanceHighWaterV1Schema,
  ProviderAcceptanceStateEnvelopeV1Schema,
  ProviderAcceptanceStateV1Schema,
  ProviderAcceptedConfigurationV1Schema,
  ProviderMigrationHistoryQuotaCommittedReceiptSetV1Schema,
  ProviderMigrationPlanPinV1Schema,
  ProviderMigrationSealedProgressHeadPinV1Schema,
  createProviderAcceptanceCompareAppendReceiptTokenMessageV1,
  createProviderAcceptanceCurrentVersionTokenMessageV1,
  createProviderAcceptanceStateTokenMessageV1,
  deriveProviderAcceptanceCompareAppendReceiptContentDigestV1,
  deriveProviderAcceptanceCompareAppendReceiptPinV1,
  deriveProviderAcceptanceCompareAppendRequestContentDigestV1,
  deriveProviderAcceptanceCurrentPinV1,
  deriveProviderAcceptanceGenerationSetDigestV1,
  deriveProviderAcceptanceHighWaterContentDigestV1,
  deriveProviderAcceptanceStateContentDigestV1,
  deriveProviderAcceptanceStateGenerationIdV1,
  projectProviderAcceptanceCompareAppendReceiptUnsignedV1,
  projectProviderAcceptanceCurrentVersionTokenFieldsV1,
  projectProviderAcceptanceStateUnsignedV1,
  type ProviderAcceptanceCompareAppendReceiptEnvelopeV1,
  type ProviderAcceptanceCompareAppendRequestV1,
  type ProviderAcceptanceGenerationEnumerationEntryV1,
  type ProviderAcceptanceGenerationEnumerationV1,
  type ProviderAcceptanceHighWaterEnvelopeV1,
  type ProviderAcceptanceStateEnvelopeV1,
  type ProviderAcceptedConfigurationV1,
} from "../src/provider-acceptance.js";
import { createDomainPreimageBytesV1 } from "../src/domain-crypto.js";
import {
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1Schema,
  ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterReferenceCandidateV1Schema,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptContentDigestReferenceCandidateV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1,
  deriveProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterContentDigestReferenceCandidateV1,
} from "../src/provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-reference-candidate-wire.js";

function digestV1(value: string) {
  return `sha256:${value.repeat(64)}`;
}

function tokenV1(value: string) {
  return `hmac-sha256:${value.repeat(64)}`;
}

function cloneJsonV1<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const installationIdentityGenerationIdV1 =
  `installation-identity-generation:${"a".repeat(22)}`;
const migrationIdV1 = `provider-migration:${"b".repeat(22)}`;

function writerV1(suffix = "formal") {
  return {
    targetProfileId: `provider-target-profile:${"4".repeat(64)}`,
    providerId: `durable-object-provider:${suffix}`,
    registryEntryContentDigest: digestV1("5"),
    semanticProviderPolicyDigest: digestV1("6"),
    providerFeasibilityEvidence: {
      locatorProfile: "installation_provider_feasibility_evidence_v1" as const,
      evidenceId: `provider-feasibility-evidence:${"7".repeat(22)}`,
      contentDigest: digestV1("7"),
    },
    runtimeAttestationContentDigest: digestV1("8"),
    bindingDerivationKeyGeneration: 1,
  };
}

function strongReadyCoreV1() {
  return {
    activeRootMetadata: {
      locatorProfile:
        "installation_provider_registry_root_metadata_v1" as const,
      rootGeneration: 1,
      rootKeyId: "1".repeat(22),
      contentDigest: digestV1("1"),
    },
    providerRegistryManifest: {
      locatorProfile: "installation_provider_registry_manifest_v1" as const,
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
      selections: [writerV1()],
    },
  };
}

function planV1(mode: "same_installation_identity" | "cross_installation_rebootstrap" = "same_installation_identity") {
  return ProviderMigrationPlanPinV1Schema.parse({
    locatorProfile: "installation_provider_migration_plan_v1",
    migrationId: migrationIdV1,
    mode,
    contentDigest: digestV1("9"),
  });
}

function sealedProgressV1() {
  return ProviderMigrationSealedProgressHeadPinV1Schema.parse({
    locatorProfile: "installation_provider_migration_progress_head_v1",
    migrationId: migrationIdV1,
    versionOrdinal: 2,
    headContentDigest: digestV1("a"),
    currentVersionToken: tokenV1("a"),
    readyToActivateRecord: {
      locatorProfile: "installation_provider_migration_progress_record_v1",
      migrationId: migrationIdV1,
      recordOrdinal: 2,
      recordId: `provider-migration-progress:${"c".repeat(22)}`,
      contentDigest: digestV1("c"),
    },
  });
}

function quotaCommitV1(
  role: "same_identity_journal" | "cross_destination_journal" | "cross_source_anchor",
) {
  return {
    locatorProfile:
      "installation_provider_migration_history_quota_operation_receipt_v1" as const,
    installationIdentityGenerationId: role === "cross_source_anchor"
      ? `installation-identity-generation:${"d".repeat(22)}`
      : installationIdentityGenerationIdV1,
    operationNonce: role === "cross_source_anchor"
      ? "d".repeat(32)
      : "c".repeat(32),
    contentDigest: digestV1(role === "cross_source_anchor" ? "d" : "c"),
    receiptToken: tokenV1(role === "cross_source_anchor" ? "d" : "c"),
    migrationId: migrationIdV1,
    reservationId:
      `provider-migration-history-reservation:${
        (role === "cross_source_anchor" ? "d" : "c").repeat(22)
      }`,
    migrationPlanContentDigest: digestV1("9"),
    role,
    operation: "compare_commit" as const,
    commitKind: role === "cross_source_anchor"
      ? "commit_cross_source_anchor" as const
      : "commit_retained_history" as const,
    outcome: "committed" as const,
  };
}

function strongReadyConfigurationV1(
  completed = false,
): ProviderAcceptedConfigurationV1 {
  return ProviderAcceptedConfigurationV1Schema.parse({
    state: "strong_ready",
    core: strongReadyCoreV1(),
    activation: completed
      ? {
          origin: "completed_provider_migration",
          migrationPlan: planV1(),
          sealedProgressHead: sealedProgressV1(),
          migrationHistoryQuotaCommits: {
            mode: "same_installation_identity",
            journalCommit: quotaCommitV1("same_identity_journal"),
          },
        }
      : { origin: "bootstrap_or_steady_successor" },
  });
}

function completedCrossStrongReadyConfigurationV1(): ProviderAcceptedConfigurationV1 {
  return ProviderAcceptedConfigurationV1Schema.parse({
    state: "strong_ready",
    core: strongReadyCoreV1(),
    activation: {
      origin: "completed_provider_migration",
      migrationPlan: planV1("cross_installation_rebootstrap"),
      sealedProgressHead: sealedProgressV1(),
      migrationHistoryQuotaCommits: {
        mode: "cross_installation_rebootstrap",
        destinationCommit: quotaCommitV1("cross_destination_journal"),
        sourceCommit: quotaCommitV1("cross_source_anchor"),
      },
    },
  });
}

function migrationOnlyConfigurationV1(): ProviderAcceptedConfigurationV1 {
  return ProviderAcceptedConfigurationV1Schema.parse({
    state: "migration_only",
    reason: "provider_decommission",
    activeRootMetadata: strongReadyCoreV1().activeRootMetadata,
    providerRegistryManifest: strongReadyCoreV1().providerRegistryManifest,
    providerSupportCatalog: strongReadyCoreV1().providerSupportCatalog,
    publicStrongWriter: { state: "disabled" },
    migrationPlan: planV1(),
    migrationExecutor: {
      state: "enabled_for_plan_only",
      journalAuthorityInstallationIdentity: {
        locatorProfile: "installation_identity_state_v1",
        generationId: installationIdentityGenerationIdV1,
        contentDigest: digestV1("e"),
      },
      sourceWriter: writerV1("source"),
      destinationWriter: writerV1("destination"),
    },
  });
}

function recoveryOnlyConfigurationV1(): ProviderAcceptedConfigurationV1 {
  return ProviderAcceptedConfigurationV1Schema.parse({
    state: "recovery_only",
    reason: "root_compromise_pending_resign_or_migration",
    activeRootMetadata: strongReadyCoreV1().activeRootMetadata,
    lastAcceptedProviderRegistryManifest:
      strongReadyCoreV1().providerRegistryManifest,
    lastAcceptedProviderSupportCatalog:
      strongReadyCoreV1().providerSupportCatalog,
    publicStrongWriter: { state: "disabled" },
  });
}

function acceptanceEnvelopeV1(
  configuration: ProviderAcceptedConfigurationV1 = strongReadyConfigurationV1(),
  acceptanceOrdinal = 1,
  predecessor:
    | { state: "genesis" }
    | { state: "acceptance"; generationId: string; contentDigest: string } = {
      state: "genesis",
    },
): ProviderAcceptanceStateEnvelopeV1 {
  const generationId = deriveProviderAcceptanceStateGenerationIdV1({
    installationIdentityGenerationId: installationIdentityGenerationIdV1,
    acceptanceOrdinal,
    predecessor,
    configuration,
  });
  const payload = ProviderAcceptanceStateV1Schema.parse({
    profile: "provider_acceptance_state_v1",
    generationId,
    installationIdentityGenerationId: installationIdentityGenerationIdV1,
    acceptanceOrdinal,
    predecessor,
    configuration,
    acceptedAt: "2026-08-19T03:00:00Z",
    acceptanceToken: tokenV1("e"),
  });
  return ProviderAcceptanceStateEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_acceptance_state",
    generationId,
    installationIdentityGenerationId: installationIdentityGenerationIdV1,
    acceptedAt: payload.acceptedAt,
    contentDigest: deriveProviderAcceptanceStateContentDigestV1(payload),
    payload,
  });
}

function entryV1(
  envelope: ProviderAcceptanceStateEnvelopeV1,
  operationNonce = "f".repeat(32),
): ProviderAcceptanceGenerationEnumerationEntryV1 {
  return ProviderAcceptanceGenerationEnumerationEntryV1Schema.parse({
    locatorProfile: "installation_provider_acceptance_state_v1",
    acceptanceOrdinal: envelope.payload.acceptanceOrdinal,
    generationId: envelope.generationId,
    contentDigest: envelope.contentDigest,
    commitOperationNonce: operationNonce,
    predecessor: envelope.payload.predecessor,
  });
}

function enumerationV1(
  entries: ProviderAcceptanceGenerationEnumerationEntryV1[],
): ProviderAcceptanceGenerationEnumerationV1 {
  return ProviderAcceptanceGenerationEnumerationV1Schema.parse({
    profile: "provider_acceptance_generation_enumeration_v1",
    installationIdentityGenerationId: installationIdentityGenerationIdV1,
    namespaceRevision: entries.length,
    entries,
    generationCount: entries.length,
    generationSetDigest: deriveProviderAcceptanceGenerationSetDigestV1({
      entries,
    }),
  });
}

function highWaterV1(
  envelope: ProviderAcceptanceStateEnvelopeV1,
  generationSetDigest: string,
  operationNonce = "f".repeat(32),
  previous?: ProviderAcceptanceHighWaterEnvelopeV1,
): ProviderAcceptanceHighWaterEnvelopeV1 {
  const payload = ProviderAcceptanceHighWaterV1Schema.parse({
    profile: "provider_acceptance_high_water_v1",
    installationIdentityGenerationId: installationIdentityGenerationIdV1,
    highWaterRevision: envelope.payload.acceptanceOrdinal,
    operationNonce,
    predecessor: previous === undefined
      ? { state: "genesis", expectedNamespaceState: "absent" }
      : {
          state: "version",
          highWaterRevision: previous.payload.highWaterRevision,
          contentDigest: previous.contentDigest,
          currentVersionToken: previous.currentVersionToken,
        },
    currentAcceptance: {
      locatorProfile: "installation_provider_acceptance_state_v1",
      acceptanceOrdinal: envelope.payload.acceptanceOrdinal,
      generationId: envelope.generationId,
      contentDigest: envelope.contentDigest,
    },
    generationCount: envelope.payload.acceptanceOrdinal,
    generationSetDigest,
    acceptedGenerationFloors: {
      rootMetadataGeneration: 1,
      registryManifestGeneration: 1,
      supportCatalogGeneration: 1,
    },
  });
  return ProviderAcceptanceHighWaterEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_acceptance_high_water",
    locatorProfile: "installation_provider_acceptance_high_water_v1",
    contentDigest: deriveProviderAcceptanceHighWaterContentDigestV1(payload),
    currentVersionToken: tokenV1("f"),
    payload,
  });
}

function successorCommittedReceiptV1(): {
  request: ProviderAcceptanceCompareAppendRequestV1;
  entry: ProviderAcceptanceGenerationEnumerationEntryV1;
  enumeration: ProviderAcceptanceGenerationEnumerationV1;
  highWater: ProviderAcceptanceHighWaterEnvelopeV1;
  envelope: ProviderAcceptanceCompareAppendReceiptEnvelopeV1;
} {
  const first = committedReceiptV1();
  const candidate = acceptanceEnvelopeV1(
    strongReadyConfigurationV1(),
    2,
    {
      state: "acceptance",
      generationId: first.entry.generationId,
      contentDigest: first.entry.contentDigest,
    },
  );
  const request = ProviderAcceptanceCompareAppendRequestV1Schema.parse({
    profile: "provider_acceptance_compare_append_request_v1",
    operationNonce: "2".repeat(32),
    installationIdentityGenerationId: installationIdentityGenerationIdV1,
    expected: {
      state: "current",
      highWaterRevision: first.highWater.payload.highWaterRevision,
      highWaterContentDigest: first.highWater.contentDigest,
      currentVersionToken: first.highWater.currentVersionToken,
      generationCount: first.enumeration.generationCount,
      generationSetDigest: first.enumeration.generationSetDigest,
    },
    candidate,
  });
  const entry = entryV1(candidate, request.operationNonce);
  const enumeration = enumerationV1([first.entry, entry]);
  const highWater = highWaterV1(
    candidate,
    enumeration.generationSetDigest,
    request.operationNonce,
    first.highWater,
  );
  const payload = ProviderAcceptanceCompareAppendReceiptV1Schema.parse({
    profile: "provider_acceptance_compare_append_receipt_v1",
    installationIdentityGenerationId: installationIdentityGenerationIdV1,
    operationNonce: request.operationNonce,
    requestContentDigest:
      deriveProviderAcceptanceCompareAppendRequestContentDigestV1(request),
    requestDurableProjection: request,
    durableOutcome: {
      outcome: "committed",
      committedHighWater: highWater,
      appendedGeneration: entry,
    },
    resolvedAt: "2026-08-19T03:00:02Z",
    receiptToken: tokenV1("2"),
  });
  const envelope = ProviderAcceptanceCompareAppendReceiptEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_acceptance_compare_append_receipt",
    locatorProfile:
      "installation_provider_acceptance_compare_append_receipt_v1",
    installationIdentityGenerationId: installationIdentityGenerationIdV1,
    operationNonce: request.operationNonce,
    resolvedAt: payload.resolvedAt,
    contentDigest:
      deriveProviderAcceptanceCompareAppendReceiptContentDigestV1(payload),
    payload,
  });
  return { request, entry, enumeration, highWater, envelope };
}

function genesisRequestV1(
  candidate = acceptanceEnvelopeV1(),
): ProviderAcceptanceCompareAppendRequestV1 {
  return ProviderAcceptanceCompareAppendRequestV1Schema.parse({
    profile: "provider_acceptance_compare_append_request_v1",
    operationNonce: "f".repeat(32),
    installationIdentityGenerationId: installationIdentityGenerationIdV1,
    expected: { state: "genesis", expectedNamespaceState: "absent" },
    candidate,
  });
}

function committedReceiptV1(): {
  request: ProviderAcceptanceCompareAppendRequestV1;
  entry: ProviderAcceptanceGenerationEnumerationEntryV1;
  enumeration: ProviderAcceptanceGenerationEnumerationV1;
  highWater: ProviderAcceptanceHighWaterEnvelopeV1;
  envelope: ProviderAcceptanceCompareAppendReceiptEnvelopeV1;
} {
  const request = genesisRequestV1();
  const entry = entryV1(request.candidate, request.operationNonce);
  const enumeration = enumerationV1([entry]);
  const highWater = highWaterV1(
    request.candidate,
    enumeration.generationSetDigest,
    request.operationNonce,
  );
  const payload = ProviderAcceptanceCompareAppendReceiptV1Schema.parse({
    profile: "provider_acceptance_compare_append_receipt_v1",
    installationIdentityGenerationId: installationIdentityGenerationIdV1,
    operationNonce: request.operationNonce,
    requestContentDigest:
      deriveProviderAcceptanceCompareAppendRequestContentDigestV1(request),
    requestDurableProjection: cloneJsonV1(request),
    durableOutcome: {
      outcome: "committed",
      committedHighWater: cloneJsonV1(highWater),
      appendedGeneration: cloneJsonV1(entry),
    },
    resolvedAt: "2026-08-19T03:00:01Z",
    receiptToken: tokenV1("1"),
  });
  const envelope = ProviderAcceptanceCompareAppendReceiptEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_acceptance_compare_append_receipt",
    locatorProfile:
      "installation_provider_acceptance_compare_append_receipt_v1",
    installationIdentityGenerationId: installationIdentityGenerationIdV1,
    operationNonce: request.operationNonce,
    resolvedAt: payload.resolvedAt,
    contentDigest:
      deriveProviderAcceptanceCompareAppendReceiptContentDigestV1(payload),
    payload,
  });
  return { request, entry, enumeration, highWater, envelope };
}

describe("formal Provider Acceptance production wire", () => {
  it("freezes the exact production digest and owner-HMAC domains", () => {
    expect([
      PROVIDER_ACCEPTANCE_COMPARE_APPEND_REQUEST_DOMAIN_V1,
      PROVIDER_ACCEPTANCE_GENERATION_SET_DOMAIN_V1,
      PROVIDER_ACCEPTANCE_HIGH_WATER_DOMAIN_V1,
      PROVIDER_ACCEPTANCE_CURRENT_VERSION_TOKEN_DOMAIN_V1,
      PROVIDER_ACCEPTANCE_COMPARE_APPEND_RECEIPT_DOMAIN_V1,
      PROVIDER_ACCEPTANCE_COMPARE_APPEND_RECEIPT_TOKEN_DOMAIN_V1,
    ]).toEqual([
      "provider-acceptance-compare-append-request-v1",
      "provider-acceptance-generation-set-v1",
      "provider-acceptance-high-water-v1",
      "provider-acceptance-current-version-v1",
      "provider-acceptance-compare-append-receipt-v1",
      "provider-acceptance-compare-append-receipt-token-v1",
    ]);
    expect(
      [
        PROVIDER_ACCEPTANCE_COMPARE_APPEND_REQUEST_DOMAIN_V1,
        PROVIDER_ACCEPTANCE_GENERATION_SET_DOMAIN_V1,
        PROVIDER_ACCEPTANCE_HIGH_WATER_DOMAIN_V1,
        PROVIDER_ACCEPTANCE_CURRENT_VERSION_TOKEN_DOMAIN_V1,
        PROVIDER_ACCEPTANCE_COMPARE_APPEND_RECEIPT_DOMAIN_V1,
        PROVIDER_ACCEPTANCE_COMPARE_APPEND_RECEIPT_TOKEN_DOMAIN_V1,
      ].every((domain) => !domain.includes("candidate")),
    ).toBe(true);
  });

  it("freezes one deterministic compact formal crypto vector", () => {
    const { request, enumeration, highWater, envelope } = committedReceiptV1();
    const actual = {
      generationId: deriveProviderAcceptanceStateGenerationIdV1(
        {
          installationIdentityGenerationId:
            request.candidate.payload.installationIdentityGenerationId,
          acceptanceOrdinal: request.candidate.payload.acceptanceOrdinal,
          predecessor: request.candidate.payload.predecessor,
          configuration: request.candidate.payload.configuration,
        },
      ),
      stateContentDigest: deriveProviderAcceptanceStateContentDigestV1(
        request.candidate.payload,
      ),
      generationSetDigest: deriveProviderAcceptanceGenerationSetDigestV1({
        entries: enumeration.entries,
      }),
      highWaterContentDigest: deriveProviderAcceptanceHighWaterContentDigestV1(
        highWater.payload,
      ),
      requestContentDigest:
        deriveProviderAcceptanceCompareAppendRequestContentDigestV1(request),
      receiptContentDigest:
        deriveProviderAcceptanceCompareAppendReceiptContentDigestV1(
          envelope.payload,
        ),
      stateTokenMessageHex: Buffer.from(
        createProviderAcceptanceStateTokenMessageV1(request.candidate.payload),
      ).toString("hex"),
      currentVersionTokenMessageHex: Buffer.from(
        createProviderAcceptanceCurrentVersionTokenMessageV1(highWater),
      ).toString("hex"),
      receiptTokenMessageHex: Buffer.from(
        createProviderAcceptanceCompareAppendReceiptTokenMessageV1(
          envelope.payload,
        ),
      ).toString("hex"),
    };
    expect(actual).toEqual({
      generationId: "provider-acceptance-state:0fe14944cc4bc45546c24f",
      stateContentDigest:
        "sha256:22cf41615bce4ab23a5e3f914fe1465f6aa4f168f0a42bbc5c1787ac665c2e22",
      generationSetDigest:
        "sha256:3fa2a2f53186eed3990fe93d0be31e9a6bb1428bc1279c033cbf4477830e63af",
      highWaterContentDigest:
        "sha256:6e13e71c994dff855189eadef23dd994d8d2f08dcb0765932bb17cc6d982e77e",
      requestContentDigest:
        "sha256:e8d5d596cb79ab02d35d34d656d29c8f6222da23751d39f5a3d4eb92d9bec2ac",
      receiptContentDigest:
        "sha256:28449531885c1d5ab72e2c5dbde6c24d1a673aef3e5c6169d88040bc499e9f34",
      stateTokenMessageHex: [
        "5b2270726f76696465722d616363657074616e63652d73746174652d746f6b656e2d7631222c7b22616363657074616e",
        "63654f7264696e616c223a312c2261636365707465644174223a22323032362d30382d31395430333a30303a30305a22",
        "2c22636f6e66696775726174696f6e223a7b2261637469766174696f6e223a7b226f726967696e223a22626f6f747374",
        "7261705f6f725f7374656164795f737563636573736f72227d2c22636f7265223a7b22616374697665526f6f744d6574",
        "6164617461223a7b22636f6e74656e74446967657374223a227368613235363a31313131313131313131313131313131",
        "313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131",
        "222c226c6f6361746f7250726f66696c65223a22696e7374616c6c6174696f6e5f70726f76696465725f726567697374",
        "72795f726f6f745f6d657461646174615f7631222c22726f6f7447656e65726174696f6e223a312c22726f6f744b6579",
        "4964223a2231313131313131313131313131313131313131313131227d2c2261637469766557726974657253656c6563",
        "746f72223a7b2270726f66696c65223a2270726f76696465725f6163746976655f7772697465725f73656c6563746f72",
        "5f7631222c2273656c656374696f6e73223a5b7b2262696e64696e6744657269766174696f6e4b657947656e65726174",
        "696f6e223a312c2270726f7669646572466561736962696c69747945766964656e6365223a7b22636f6e74656e744469",
        "67657374223a227368613235363a37373737373737373737373737373737373737373737373737373737373737373737",
        "373737373737373737373737373737373737373737373737373737373737222c2265766964656e63654964223a227072",
        "6f76696465722d666561736962696c6974792d65766964656e63653a3737373737373737373737373737373737373737",
        "3737222c226c6f6361746f7250726f66696c65223a22696e7374616c6c6174696f6e5f70726f76696465725f66656173",
        "6962696c6974795f65766964656e63655f7631227d2c2270726f76696465724964223a2264757261626c652d6f626a65",
        "63742d70726f76696465723a666f726d616c222c227265676973747279456e747279436f6e74656e7444696765737422",
        "3a227368613235363a353535353535353535353535353535353535353535353535353535353535353535353535353535",
        "35353535353535353535353535353535353535353535353535222c2272756e74696d654174746573746174696f6e436f",
        "6e74656e74446967657374223a227368613235363a383838383838383838383838383838383838383838383838383838",
        "38383838383838383838383838383838383838383838383838383838383838383838383838222c2273656d616e746963",
        "50726f7669646572506f6c696379446967657374223a227368613235363a363636363636363636363636363636363636",
        "36363636363636363636363636363636363636363636363636363636363636363636363636363636363636363636222c",
        "2274617267657450726f66696c654964223a2270726f76696465722d7461726765742d70726f66696c653a3434343434",
        "343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434",
        "3434343434343434343434227d5d7d2c2270726f766964657252656769737472794d616e6966657374223a7b22636f6e",
        "74656e74446967657374223a227368613235363a32323232323232323232323232323232323232323232323232323232",
        "323232323232323232323232323232323232323232323232323232323232323232323232222c2267656e65726174696f",
        "6e4964223a2270726f76696465722d72656769737472792d6d616e69666573743a323232323232323232323232323232",
        "32323232323232222c226c6f6361746f7250726f66696c65223a22696e7374616c6c6174696f6e5f70726f7669646572",
        "5f72656769737472795f6d616e69666573745f7631222c226d616e696665737447656e65726174696f6e223a317d2c22",
        "70726f7669646572537570706f7274436174616c6f67223a7b22636174616c6f6747656e65726174696f6e223a312c22",
        "636f6e74656e74446967657374223a227368613235363a33333333333333333333333333333333333333333333333333",
        "333333333333333333333333333333333333333333333333333333333333333333333333333333222c226c6f6361746f",
        "7250726f66696c65223a22646973747269627574696f6e5f70726f76696465725f666561736962696c6974795f737570",
        "706f72745f636174616c6f675f7631227d7d2c227374617465223a227374726f6e675f7265616479227d2c2267656e65",
        "726174696f6e4964223a2270726f76696465722d616363657074616e63652d73746174653a3066653134393434636334",
        "6263343535343663323466222c22696e7374616c6c6174696f6e4964656e7469747947656e65726174696f6e4964223a",
        "22696e7374616c6c6174696f6e2d6964656e746974792d67656e65726174696f6e3a6161616161616161616161616161",
        "6161616161616161222c227072656465636573736f72223a7b227374617465223a2267656e65736973227d2c2270726f",
        "66696c65223a2270726f76696465725f616363657074616e63655f73746174655f7631227d5d",
      ].join(""),
      currentVersionTokenMessageHex: [
        "5b2270726f76696465722d616363657074616e63652d63757272656e742d76657273696f6e2d7631222c7b2263757272",
        "656e74416363657074616e6365223a7b22616363657074616e63654f7264696e616c223a312c22636f6e74656e744469",
        "67657374223a227368613235363a32326366343136313562636534616232336135653366393134666531343635663661",
        "613466313638663061343262626335633137383761633636356332653232222c2267656e65726174696f6e4964223a22",
        "70726f76696465722d616363657074616e63652d73746174653a30666531343934346363346263343535343663323466",
        "222c226c6f6361746f7250726f66696c65223a22696e7374616c6c6174696f6e5f70726f76696465725f616363657074",
        "616e63655f73746174655f7631227d2c2267656e65726174696f6e436f756e74223a312c2267656e65726174696f6e53",
        "6574446967657374223a227368613235363a336661326132663533313836656564333939306665393364306265333165",
        "39613662623134323862633132373963303333636266343437373833306536336166222c22686967685761746572436f",
        "6e74656e74446967657374223a227368613235363a366531336537316339393464666638353531383965616465663233",
        "64643939346438643266303864636230373635393332626231376363366439383265373765222c226869676857617465",
        "725265766973696f6e223a312c22696e7374616c6c6174696f6e4964656e7469747947656e65726174696f6e4964223a",
        "22696e7374616c6c6174696f6e2d6964656e746974792d67656e65726174696f6e3a6161616161616161616161616161",
        "6161616161616161222c226c6f6361746f7250726f66696c65223a22696e7374616c6c6174696f6e5f70726f76696465",
        "725f616363657074616e63655f686967685f77617465725f7631227d5d",
      ].join(""),
      receiptTokenMessageHex: [
        "5b2270726f76696465722d616363657074616e63652d636f6d706172652d617070656e642d726563656970742d746f6b",
        "656e2d7631222c7b2264757261626c654f7574636f6d65223a7b22617070656e64656447656e65726174696f6e223a7b",
        "22616363657074616e63654f7264696e616c223a312c22636f6d6d69744f7065726174696f6e4e6f6e6365223a226666",
        "666666666666666666666666666666666666666666666666666666666666222c22636f6e74656e74446967657374223a",
        "227368613235363a32326366343136313562636534616232336135653366393134666531343635663661613466313638",
        "663061343262626335633137383761633636356332653232222c2267656e65726174696f6e4964223a2270726f766964",
        "65722d616363657074616e63652d73746174653a30666531343934346363346263343535343663323466222c226c6f63",
        "61746f7250726f66696c65223a22696e7374616c6c6174696f6e5f70726f76696465725f616363657074616e63655f73",
        "746174655f7631222c227072656465636573736f72223a7b227374617465223a2267656e65736973227d7d2c22636f6d",
        "6d6974746564486967685761746572223a7b22636f6e74656e74446967657374223a227368613235363a366531336537",
        "316339393464666638353531383965616465663233646439393464386432663038646362303736353933326262313763",
        "63366439383265373765222c2263757272656e7456657273696f6e546f6b656e223a22686d61632d7368613235363a66",
        "666666666666666666666666666666666666666666666666666666666666666666666666666666666666666666666666",
        "666666666666666666666666666666222c226c6f6361746f7250726f66696c65223a22696e7374616c6c6174696f6e5f",
        "70726f76696465725f616363657074616e63655f686967685f77617465725f7631222c227061796c6f6164223a7b2261",
        "6363657074656447656e65726174696f6e466c6f6f7273223a7b2272656769737472794d616e696665737447656e6572",
        "6174696f6e223a312c22726f6f744d6574616461746147656e65726174696f6e223a312c22737570706f727443617461",
        "6c6f6747656e65726174696f6e223a317d2c2263757272656e74416363657074616e6365223a7b22616363657074616e",
        "63654f7264696e616c223a312c22636f6e74656e74446967657374223a227368613235363a3232636634313631356263",
        "653461623233613565336639313466653134363566366161346631363866306134326262633563313738376163363635",
        "6332653232222c2267656e65726174696f6e4964223a2270726f76696465722d616363657074616e63652d7374617465",
        "3a30666531343934346363346263343535343663323466222c226c6f6361746f7250726f66696c65223a22696e737461",
        "6c6c6174696f6e5f70726f76696465725f616363657074616e63655f73746174655f7631227d2c2267656e6572617469",
        "6f6e436f756e74223a312c2267656e65726174696f6e536574446967657374223a227368613235363a33666132613266",
        "353331383665656433393930666539336430626533316539613662623134323862633132373963303333636266343437",
        "373833306536336166222c226869676857617465725265766973696f6e223a312c22696e7374616c6c6174696f6e4964",
        "656e7469747947656e65726174696f6e4964223a22696e7374616c6c6174696f6e2d6964656e746974792d67656e6572",
        "6174696f6e3a61616161616161616161616161616161616161616161222c226f7065726174696f6e4e6f6e6365223a22",
        "6666666666666666666666666666666666666666666666666666666666666666222c227072656465636573736f72223a",
        "7b2265787065637465644e616d6573706163655374617465223a22616273656e74222c227374617465223a2267656e65",
        "736973227d2c2270726f66696c65223a2270726f76696465725f616363657074616e63655f686967685f77617465725f",
        "7631227d2c227265636f726454797065223a2270726f76696465725f616363657074616e63655f686967685f77617465",
        "72222c22736368656d6156657273696f6e223a317d2c226f7574636f6d65223a22636f6d6d6974746564227d2c22696e",
        "7374616c6c6174696f6e4964656e7469747947656e65726174696f6e4964223a22696e7374616c6c6174696f6e2d6964",
        "656e746974792d67656e65726174696f6e3a61616161616161616161616161616161616161616161222c226f70657261",
        "74696f6e4e6f6e6365223a226666666666666666666666666666666666666666666666666666666666666666222c2270",
        "726f66696c65223a2270726f76696465725f616363657074616e63655f636f6d706172655f617070656e645f72656365",
        "6970745f7631222c2272657175657374436f6e74656e74446967657374223a227368613235363a653864356435393663",
        "623739616230326433356433346436353664323963386636323232646132333735316433396635613364346562393264",
        "39626563326163222c227265717565737444757261626c6550726f6a656374696f6e223a7b2263616e64696461746522",
        "3a7b2261636365707465644174223a22323032362d30382d31395430333a30303a30305a222c22636f6e74656e744469",
        "67657374223a227368613235363a32326366343136313562636534616232336135653366393134666531343635663661",
        "613466313638663061343262626335633137383761633636356332653232222c2267656e65726174696f6e4964223a22",
        "70726f76696465722d616363657074616e63652d73746174653a30666531343934346363346263343535343663323466",
        "222c22696e7374616c6c6174696f6e4964656e7469747947656e65726174696f6e4964223a22696e7374616c6c617469",
        "6f6e2d6964656e746974792d67656e65726174696f6e3a61616161616161616161616161616161616161616161222c22",
        "7061796c6f6164223a7b22616363657074616e63654f7264696e616c223a312c22616363657074616e6365546f6b656e",
        "223a22686d61632d7368613235363a656565656565656565656565656565656565656565656565656565656565656565",
        "65656565656565656565656565656565656565656565656565656565656565222c2261636365707465644174223a2232",
        "3032362d30382d31395430333a30303a30305a222c22636f6e66696775726174696f6e223a7b2261637469766174696f",
        "6e223a7b226f726967696e223a22626f6f7473747261705f6f725f7374656164795f737563636573736f72227d2c2263",
        "6f7265223a7b22616374697665526f6f744d65746164617461223a7b22636f6e74656e74446967657374223a22736861",
        "3235363a3131313131313131313131313131313131313131313131313131313131313131313131313131313131313131",
        "3131313131313131313131313131313131313131222c226c6f6361746f7250726f66696c65223a22696e7374616c6c61",
        "74696f6e5f70726f76696465725f72656769737472795f726f6f745f6d657461646174615f7631222c22726f6f744765",
        "6e65726174696f6e223a312c22726f6f744b65794964223a223131313131313131313131313131313131313131313122",
        "7d2c2261637469766557726974657253656c6563746f72223a7b2270726f66696c65223a2270726f76696465725f6163",
        "746976655f7772697465725f73656c6563746f725f7631222c2273656c656374696f6e73223a5b7b2262696e64696e67",
        "44657269766174696f6e4b657947656e65726174696f6e223a312c2270726f7669646572466561736962696c69747945",
        "766964656e6365223a7b22636f6e74656e74446967657374223a227368613235363a3737373737373737373737373737",
        "373737373737373737373737373737373737373737373737373737373737373737373737373737373737373737373737",
        "3737222c2265766964656e63654964223a2270726f76696465722d666561736962696c6974792d65766964656e63653a",
        "37373737373737373737373737373737373737373737222c226c6f6361746f7250726f66696c65223a22696e7374616c",
        "6c6174696f6e5f70726f76696465725f666561736962696c6974795f65766964656e63655f7631227d2c2270726f7669",
        "6465724964223a2264757261626c652d6f626a6563742d70726f76696465723a666f726d616c222c2272656769737472",
        "79456e747279436f6e74656e74446967657374223a227368613235363a35353535353535353535353535353535353535",
        "353535353535353535353535353535353535353535353535353535353535353535353535353535353535353535222c22",
        "72756e74696d654174746573746174696f6e436f6e74656e74446967657374223a227368613235363a38383838383838",
        "383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838383838",
        "383838383838383838222c2273656d616e74696350726f7669646572506f6c696379446967657374223a227368613235",
        "363a36363636363636363636363636363636363636363636363636363636363636363636363636363636363636363636",
        "363636363636363636363636363636363636222c2274617267657450726f66696c654964223a2270726f76696465722d",
        "7461726765742d70726f66696c653a343434343434343434343434343434343434343434343434343434343434343434",
        "34343434343434343434343434343434343434343434343434343434343434227d5d7d2c2270726f7669646572526567",
        "69737472794d616e6966657374223a7b22636f6e74656e74446967657374223a227368613235363a3232323232323232",
        "323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232",
        "3232323232323232222c2267656e65726174696f6e4964223a2270726f76696465722d72656769737472792d6d616e69",
        "666573743a32323232323232323232323232323232323232323232222c226c6f6361746f7250726f66696c65223a2269",
        "6e7374616c6c6174696f6e5f70726f76696465725f72656769737472795f6d616e69666573745f7631222c226d616e69",
        "6665737447656e65726174696f6e223a317d2c2270726f7669646572537570706f7274436174616c6f67223a7b226361",
        "74616c6f6747656e65726174696f6e223a312c22636f6e74656e74446967657374223a227368613235363a3333333333",
        "333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333",
        "3333333333333333333333222c226c6f6361746f7250726f66696c65223a22646973747269627574696f6e5f70726f76",
        "696465725f666561736962696c6974795f737570706f72745f636174616c6f675f7631227d7d2c227374617465223a22",
        "7374726f6e675f7265616479227d2c2267656e65726174696f6e4964223a2270726f76696465722d616363657074616e",
        "63652d73746174653a30666531343934346363346263343535343663323466222c22696e7374616c6c6174696f6e4964",
        "656e7469747947656e65726174696f6e4964223a22696e7374616c6c6174696f6e2d6964656e746974792d67656e6572",
        "6174696f6e3a61616161616161616161616161616161616161616161222c227072656465636573736f72223a7b227374",
        "617465223a2267656e65736973227d2c2270726f66696c65223a2270726f76696465725f616363657074616e63655f73",
        "746174655f7631227d2c227265636f726454797065223a2270726f76696465725f616363657074616e63655f73746174",
        "65222c22736368656d6156657273696f6e223a317d2c226578706563746564223a7b2265787065637465644e616d6573",
        "706163655374617465223a22616273656e74222c227374617465223a2267656e65736973227d2c22696e7374616c6c61",
        "74696f6e4964656e7469747947656e65726174696f6e4964223a22696e7374616c6c6174696f6e2d6964656e74697479",
        "2d67656e65726174696f6e3a61616161616161616161616161616161616161616161222c226f7065726174696f6e4e6f",
        "6e6365223a226666666666666666666666666666666666666666666666666666666666666666222c2270726f66696c65",
        "223a2270726f76696465725f616363657074616e63655f636f6d706172655f617070656e645f726571756573745f7631",
        "227d2c227265736f6c7665644174223a22323032362d30382d31395430333a30303a30315a227d5d",
      ].join(""),
    });
  });

  it("parses all three formal configuration states and completed-migration pins", () => {
    for (const configuration of [
      strongReadyConfigurationV1(),
      strongReadyConfigurationV1(true),
      completedCrossStrongReadyConfigurationV1(),
      migrationOnlyConfigurationV1(),
      recoveryOnlyConfigurationV1(),
    ]) {
      const parsed = ProviderAcceptedConfigurationV1Schema.parse(configuration);
      expect(parsed.state).toBe(configuration.state);
      expect(acceptanceEnvelopeV1(parsed).payload.configuration.state).toBe(
        configuration.state,
      );
    }

    const crossReceipts =
      ProviderMigrationHistoryQuotaCommittedReceiptSetV1Schema.parse({
        mode: "cross_installation_rebootstrap",
        destinationCommit: quotaCommitV1("cross_destination_journal"),
        sourceCommit: quotaCommitV1("cross_source_anchor"),
      });
    expect(crossReceipts.mode).toBe("cross_installation_rebootstrap");
    if (crossReceipts.mode !== "cross_installation_rebootstrap") {
      throw new TypeError("cross-installation quota fixture did not narrow");
    }
    expect(() =>
      ProviderMigrationHistoryQuotaCommittedReceiptSetV1Schema.parse({
        ...crossReceipts,
        sourceCommit: {
          ...crossReceipts.sourceCommit,
          installationIdentityGenerationId:
            crossReceipts.destinationCommit.installationIdentityGenerationId,
        },
      }),
    ).toThrow();
    expect(() =>
      ProviderMigrationHistoryQuotaCommittedReceiptSetV1Schema.parse({
        ...crossReceipts,
        sourceCommit: {
          ...crossReceipts.sourceCommit,
          reservationId: crossReceipts.destinationCommit.reservationId,
        },
      }),
    ).toThrow();
    expect(() =>
      ProviderMigrationHistoryQuotaCommittedReceiptSetV1Schema.parse({
        ...crossReceipts,
        sourceCommit: {
          ...crossReceipts.sourceCommit,
          migrationId: `provider-migration:${"d".repeat(22)}`,
        },
      }),
    ).toThrow();
    expect(() =>
      ProviderMigrationHistoryQuotaCommittedReceiptSetV1Schema.parse({
        ...crossReceipts,
        sourceCommit: {
          ...crossReceipts.sourceCommit,
          migrationPlanContentDigest: digestV1("d"),
        },
      }),
    ).toThrow();
    const migrationOnly = migrationOnlyConfigurationV1();
    if (migrationOnly.state !== "migration_only") {
      throw new TypeError("migration-only fixture did not narrow");
    }
    expect(() =>
      ProviderAcceptedConfigurationV1Schema.parse({
        ...migrationOnly,
        migrationPlan: planV1("cross_installation_rebootstrap"),
      }),
    ).toThrow();
    expect(() =>
      ProviderAcceptedConfigurationV1Schema.parse({
        ...migrationOnly,
        migrationExecutor: {
          ...migrationOnly.migrationExecutor,
          destinationWriter: {
            ...migrationOnly.migrationExecutor.destinationWriter,
            providerId: migrationOnly.migrationExecutor.sourceWriter.providerId,
            semanticProviderPolicyDigest:
              migrationOnly.migrationExecutor.sourceWriter
                .semanticProviderPolicyDigest,
            bindingDerivationKeyGeneration:
              migrationOnly.migrationExecutor.sourceWriter
                .bindingDerivationKeyGeneration,
            runtimeAttestationContentDigest: digestV1("d"),
          },
        },
      }),
    ).toThrow();
    expect(
      ProviderAcceptedConfigurationV1Schema.parse({
        ...migrationOnly,
        reason: "recovery_key_compromise_rebootstrap",
        migrationPlan: planV1("cross_installation_rebootstrap"),
        migrationExecutor: {
          ...migrationOnly.migrationExecutor,
          destinationWriter: migrationOnly.migrationExecutor.sourceWriter,
        },
      }).state,
    ).toBe("migration_only");
    expect(
      ProviderAcceptedConfigurationV1Schema.parse({
        ...migrationOnly,
        reason: "recovery_key_compromise_rebootstrap",
        migrationPlan: planV1("cross_installation_rebootstrap"),
      }).state,
    ).toBe("migration_only");
    expect(() =>
      ProviderAcceptedConfigurationV1Schema.parse({
        ...migrationOnly,
        reason: "recovery_key_compromise_rebootstrap",
      }),
    ).toThrow();
    expect(() =>
      ProviderAcceptedConfigurationV1Schema.parse({
        ...migrationOnly,
        migrationExecutor: {
          ...migrationOnly.migrationExecutor,
          destinationWriter: {
            ...migrationOnly.migrationExecutor.destinationWriter,
            targetProfileId: `provider-target-profile:${"5".repeat(64)}`,
          },
        },
      }),
    ).toThrow();
    expect(() =>
      ProviderMigrationSealedProgressHeadPinV1Schema.parse({
        ...sealedProgressV1(),
        readyToActivateRecord: {
          ...sealedProgressV1().readyToActivateRecord,
          migrationId: `provider-migration:${"d".repeat(22)}`,
        },
      }),
    ).toThrow();
  });

  it("binds migration custody roles to the Acceptance Installation Identity", () => {
    const mismatchedIdentity =
      `installation-identity-generation:${"c".repeat(22)}`;
    const migrationOnly = migrationOnlyConfigurationV1();
    if (migrationOnly.state !== "migration_only") {
      throw new TypeError("migration-only fixture did not narrow");
    }
    const mismatchedMigrationOnly =
      ProviderAcceptedConfigurationV1Schema.parse({
        ...migrationOnly,
        migrationExecutor: {
          ...migrationOnly.migrationExecutor,
          journalAuthorityInstallationIdentity: {
            ...migrationOnly.migrationExecutor
              .journalAuthorityInstallationIdentity,
            generationId: mismatchedIdentity,
          },
        },
      });

    const sameCompleted = strongReadyConfigurationV1(true);
    if (
      sameCompleted.state !== "strong_ready" ||
      sameCompleted.activation.origin !== "completed_provider_migration" ||
      sameCompleted.activation.migrationHistoryQuotaCommits.mode !==
        "same_installation_identity"
    ) {
      throw new TypeError("same-identity completion fixture did not narrow");
    }
    const mismatchedSameCompleted =
      ProviderAcceptedConfigurationV1Schema.parse({
        ...sameCompleted,
        activation: {
          ...sameCompleted.activation,
          migrationHistoryQuotaCommits: {
            ...sameCompleted.activation.migrationHistoryQuotaCommits,
            journalCommit: {
              ...sameCompleted.activation.migrationHistoryQuotaCommits
                .journalCommit,
              installationIdentityGenerationId: mismatchedIdentity,
            },
          },
        },
      });

    const crossCompleted = completedCrossStrongReadyConfigurationV1();
    if (
      crossCompleted.state !== "strong_ready" ||
      crossCompleted.activation.origin !== "completed_provider_migration" ||
      crossCompleted.activation.migrationHistoryQuotaCommits.mode !==
        "cross_installation_rebootstrap"
    ) {
      throw new TypeError("cross-installation completion fixture did not narrow");
    }
    const mismatchedCrossCompleted =
      ProviderAcceptedConfigurationV1Schema.parse({
        ...crossCompleted,
        activation: {
          ...crossCompleted.activation,
          migrationHistoryQuotaCommits: {
            ...crossCompleted.activation.migrationHistoryQuotaCommits,
            destinationCommit: {
              ...crossCompleted.activation.migrationHistoryQuotaCommits
                .destinationCommit,
              installationIdentityGenerationId: mismatchedIdentity,
            },
          },
        },
      });

    for (const configuration of [
      mismatchedMigrationOnly,
      mismatchedSameCompleted,
      mismatchedCrossCompleted,
    ]) {
      const generationId = deriveProviderAcceptanceStateGenerationIdV1({
        installationIdentityGenerationId: installationIdentityGenerationIdV1,
        acceptanceOrdinal: 1,
        predecessor: { state: "genesis" },
        configuration,
      });
      expect(() =>
        ProviderAcceptanceStateV1Schema.parse({
          profile: "provider_acceptance_state_v1",
          generationId,
          installationIdentityGenerationId:
            installationIdentityGenerationIdV1,
          acceptanceOrdinal: 1,
          predecessor: { state: "genesis" },
          configuration,
          acceptedAt: "2026-08-19T03:00:00Z",
          acceptanceToken: tokenV1("e"),
        }),
      ).toThrow();
    }
  });

  it("binds a real successor current request and committed receipt", () => {
    const { request, entry, enumeration, highWater, envelope } =
      successorCommittedReceiptV1();
    expect(request.expected.state).toBe("current");
    expect(request.candidate.payload.acceptanceOrdinal).toBe(2);
    expect(entry.predecessor.state).toBe("acceptance");
    expect(enumeration.entries).toHaveLength(2);
    expect(highWater.payload.predecessor.state).toBe("version");
    expect(highWater.payload.highWaterRevision).toBe(2);
    expect(
      ProviderAcceptanceCurrentReadV1Schema.parse({
        profile: "provider_acceptance_current_read_v1",
        highWater,
        enumeration,
      }),
    ).toBeDefined();
    expect(
      ProviderAcceptanceCompareAppendReceiptEnvelopeV1Schema.parse(envelope),
    ).toBeDefined();
  });

  it("binds a complete committed current, receipt, projections, pins, and token messages", () => {
    const { request, entry, enumeration, highWater, envelope } =
      committedReceiptV1();
    expect(
      ProviderAcceptanceCurrentReadV1Schema.parse({
        profile: "provider_acceptance_current_read_v1",
        highWater,
        enumeration,
      }),
    ).toBeDefined();
    expect(
      ProviderAcceptanceCompareAppendResultV1Schema.parse({
        resolution: "resolved",
        receipt: envelope,
      }),
    ).toBeDefined();
    expect(deriveProviderAcceptanceCurrentPinV1(highWater)).toEqual({
      highWaterLocatorProfile:
        "installation_provider_acceptance_high_water_v1",
      installationIdentityGenerationId: installationIdentityGenerationIdV1,
      acceptance: highWater.payload.currentAcceptance,
      highWaterRevision: 1,
      highWaterContentDigest: highWater.contentDigest,
      currentVersionToken: highWater.currentVersionToken,
      generationCount: 1,
      generationSetDigest: enumeration.generationSetDigest,
      acceptedGenerationFloors: highWater.payload.acceptedGenerationFloors,
    });
    expect(
      ProviderAcceptanceCurrentPinV1Schema.parse(
        deriveProviderAcceptanceCurrentPinV1(highWater),
      ),
    ).toBeDefined();
    expect(deriveProviderAcceptanceCompareAppendReceiptPinV1(envelope)).toEqual({
      locatorProfile:
        "installation_provider_acceptance_compare_append_receipt_v1",
      installationIdentityGenerationId: installationIdentityGenerationIdV1,
      operationNonce: request.operationNonce,
      contentDigest: envelope.contentDigest,
      receiptToken: envelope.payload.receiptToken,
    });

    const currentTokenFields =
      projectProviderAcceptanceCurrentVersionTokenFieldsV1(highWater);
    expect(
      ProviderAcceptanceCurrentVersionTokenFieldsV1Schema.parse(
        currentTokenFields,
      ),
    ).toBeDefined();
    expect(Object.hasOwn(currentTokenFields, "acceptedGenerationFloors")).toBe(
      false,
    );
    expect(Object.keys(projectProviderAcceptanceStateUnsignedV1(request.candidate.payload)))
      .not.toContain("acceptanceToken");
    expect(Object.keys(projectProviderAcceptanceCompareAppendReceiptUnsignedV1(envelope.payload)))
      .not.toContain("receiptToken");
    const stateMessage = createProviderAcceptanceStateTokenMessageV1(
      request.candidate.payload,
    );
    expect(stateMessage).toEqual(
      createDomainPreimageBytesV1(
        PROVIDER_ACCEPTANCE_STATE_TOKEN_DOMAIN_V1,
        projectProviderAcceptanceStateUnsignedV1(request.candidate.payload),
      ),
    );
    expect(
      createProviderAcceptanceStateTokenMessageV1({
        ...request.candidate.payload,
        acceptanceToken: tokenV1("d"),
      }),
    ).toEqual(stateMessage);
    expect(
      createProviderAcceptanceStateTokenMessageV1({
        ...request.candidate.payload,
        acceptedAt: "2026-08-19T03:00:03Z",
      }),
    ).not.toEqual(stateMessage);

    const currentMessage =
      createProviderAcceptanceCurrentVersionTokenMessageV1(highWater);
    expect(currentMessage).toEqual(
      createDomainPreimageBytesV1(
        PROVIDER_ACCEPTANCE_CURRENT_VERSION_TOKEN_DOMAIN_V1,
        currentTokenFields,
      ),
    );
    expect(
      createProviderAcceptanceCurrentVersionTokenMessageV1({
        ...highWater,
        currentVersionToken: tokenV1("d"),
      }),
    ).toEqual(currentMessage);
    const changedHighWaterPayload = ProviderAcceptanceHighWaterV1Schema.parse({
      ...highWater.payload,
      generationSetDigest: digestV1("d"),
    });
    const changedHighWater = ProviderAcceptanceHighWaterEnvelopeV1Schema.parse({
      ...highWater,
      contentDigest:
        deriveProviderAcceptanceHighWaterContentDigestV1(changedHighWaterPayload),
      payload: changedHighWaterPayload,
    });
    expect(
      createProviderAcceptanceCurrentVersionTokenMessageV1(changedHighWater),
    ).not.toEqual(currentMessage);

    const receiptMessage =
      createProviderAcceptanceCompareAppendReceiptTokenMessageV1(
        envelope.payload,
      );
    expect(receiptMessage).toEqual(
      createDomainPreimageBytesV1(
        PROVIDER_ACCEPTANCE_COMPARE_APPEND_RECEIPT_TOKEN_DOMAIN_V1,
        projectProviderAcceptanceCompareAppendReceiptUnsignedV1(
          envelope.payload,
        ),
      ),
    );
    expect(
      createProviderAcceptanceCompareAppendReceiptTokenMessageV1({
        ...envelope.payload,
        receiptToken: tokenV1("d"),
      }),
    ).toEqual(receiptMessage);
    expect(
      createProviderAcceptanceCompareAppendReceiptTokenMessageV1({
        ...envelope.payload,
        resolvedAt: "2026-08-19T03:00:03Z",
      }),
    ).not.toEqual(receiptMessage);
    expect(entry.generationId).toBe(request.candidate.generationId);
  });

  it("rejects state, current-read, request-digest, and committed publication drift", () => {
    const { request, enumeration, highWater, envelope } = committedReceiptV1();
    expect(() =>
      ProviderAcceptanceStateEnvelopeV1Schema.parse({
        ...request.candidate,
        acceptedAt: "2026-08-19T03:00:02Z",
      }),
    ).toThrow();
    expect(() =>
      ProviderAcceptanceCurrentReadV1Schema.parse({
        profile: "provider_acceptance_current_read_v1",
        highWater,
        enumeration: {
          ...enumeration,
          installationIdentityGenerationId:
            `installation-identity-generation:${"d".repeat(22)}`,
        },
      }),
    ).toThrow();
    const wrongNonceHighWaterPayload =
      ProviderAcceptanceHighWaterV1Schema.parse({
        ...highWater.payload,
        operationNonce: "d".repeat(32),
      });
    const wrongNonceHighWater =
      ProviderAcceptanceHighWaterEnvelopeV1Schema.parse({
        ...highWater,
        contentDigest: deriveProviderAcceptanceHighWaterContentDigestV1(
          wrongNonceHighWaterPayload,
        ),
        payload: wrongNonceHighWaterPayload,
      });
    expect(() =>
      ProviderAcceptanceCurrentReadV1Schema.parse({
        profile: "provider_acceptance_current_read_v1",
        highWater: wrongNonceHighWater,
        enumeration,
      }),
    ).toThrow();
    expect(() =>
      ProviderAcceptanceCompareAppendReceiptV1Schema.parse({
        ...envelope.payload,
        requestContentDigest: digestV1("d"),
      }),
    ).toThrow();
    for (const changedHighWaterPayload of [
      ProviderAcceptanceHighWaterV1Schema.parse({
        ...highWater.payload,
        generationSetDigest: digestV1("d"),
      }),
      ProviderAcceptanceHighWaterV1Schema.parse({
        ...highWater.payload,
        acceptedGenerationFloors: {
          rootMetadataGeneration: 2,
          registryManifestGeneration: 2,
          supportCatalogGeneration: 2,
        },
      }),
    ]) {
      const changedHighWater =
        ProviderAcceptanceHighWaterEnvelopeV1Schema.parse({
          ...highWater,
          contentDigest: deriveProviderAcceptanceHighWaterContentDigestV1(
            changedHighWaterPayload,
          ),
          payload: changedHighWaterPayload,
        });
      expect(() =>
        ProviderAcceptanceCompareAppendReceiptV1Schema.parse({
          ...envelope.payload,
          durableOutcome: {
            outcome: "committed",
            committedHighWater: changedHighWater,
            appendedGeneration: enumeration.entries[0],
          },
        }),
      ).toThrow();
    }
    expect(() =>
      ProviderAcceptanceCompareAppendReceiptV1Schema.parse({
        ...envelope.payload,
        durableOutcome: {
          ...envelope.payload.durableOutcome,
          appendedGeneration: {
            ...(envelope.payload.durableOutcome.outcome === "committed"
              ? envelope.payload.durableOutcome.appendedGeneration
              : {}),
            contentDigest: digestV1("d"),
          },
        },
      }),
    ).toThrow();
    expect(() =>
      ProviderAcceptanceCompareAppendRequestV1Schema.parse({
        ...request,
        expected: {
          state: "current",
          highWaterRevision: 1,
          highWaterContentDigest: highWater.contentDigest,
          currentVersionToken: highWater.currentVersionToken,
          generationCount: 2,
          generationSetDigest: enumeration.generationSetDigest,
        },
      }),
    ).toThrow();
    const currentPin = deriveProviderAcceptanceCurrentPinV1(highWater);
    expect(() =>
      ProviderAcceptanceCurrentPinV1Schema.parse({
        ...currentPin,
        generationCount: currentPin.generationCount + 1,
      }),
    ).toThrow();
    const currentTokenFields =
      projectProviderAcceptanceCurrentVersionTokenFieldsV1(highWater);
    expect(() =>
      ProviderAcceptanceCurrentVersionTokenFieldsV1Schema.parse({
        ...currentTokenFields,
        highWaterRevision: currentTokenFields.highWaterRevision + 1,
      }),
    ).toThrow();
  });

  it("enforces every not-committed reason and observed-state relation without publication fields", () => {
    const request = genesisRequestV1();
    const committed = committedReceiptV1();
    const cases = [
      {
        reason: "expected_current_changed",
        observedHighWater: {
          state: "trusted",
          highWater: committed.highWater,
        },
      },
      {
        reason: "candidate_invalid",
        observedHighWater: { state: "absent" },
      },
      {
        reason: "generation_floor_regressed",
        observedHighWater: {
          state: "trusted",
          highWater: committed.highWater,
        },
      },
      {
        reason: "namespace_integrity_failed",
        observedHighWater: {
          state: "integrity_failed",
          evidenceDigest: digestV1("2"),
        },
      },
    ] as const;
    const outcomes = cases.map((entry) =>
      ProviderAcceptanceCompareAppendDurableOutcomeV1Schema.parse({
        outcome: "not_committed",
        ...entry,
      })
    );
    const outcome = outcomes[1]!;
    const receipt = ProviderAcceptanceCompareAppendReceiptV1Schema.parse({
      profile: "provider_acceptance_compare_append_receipt_v1",
      installationIdentityGenerationId: installationIdentityGenerationIdV1,
      operationNonce: request.operationNonce,
      requestContentDigest:
        deriveProviderAcceptanceCompareAppendRequestContentDigestV1(request),
      requestDurableProjection: request,
      durableOutcome: outcome,
      resolvedAt: "2026-08-19T03:00:01Z",
      receiptToken: tokenV1("1"),
    });
    expect(Object.keys(receipt.durableOutcome).sort()).toEqual([
      "observedHighWater",
      "outcome",
      "reason",
    ]);
    expect(() =>
      ProviderAcceptanceCompareAppendDurableOutcomeV1Schema.parse({
        ...outcome,
        appendedGeneration: entryV1(request.candidate),
      }),
    ).toThrow();
    expect(() =>
      ProviderAcceptanceCompareAppendDurableOutcomeV1Schema.parse({
        outcome: "not_committed",
        reason: "candidate_invalid",
        observedHighWater: {
          state: "integrity_failed",
          evidenceDigest: digestV1("2"),
        },
      }),
    ).toThrow();
    expect(() =>
      ProviderAcceptanceCompareAppendDurableOutcomeV1Schema.parse({
        outcome: "not_committed",
        reason: "namespace_integrity_failed",
        observedHighWater: {
          state: "trusted",
          highWater: committed.highWater,
        },
      }),
    ).toThrow();
  });

  it("requires committed floors to cover all three accepted configuration states", () => {
    const elevatedCore = strongReadyCoreV1();
    elevatedCore.activeRootMetadata.rootGeneration = 2;
    elevatedCore.providerRegistryManifest.manifestGeneration = 2;
    elevatedCore.providerSupportCatalog.catalogGeneration = 2;
    const baseMigration = migrationOnlyConfigurationV1();
    const baseRecovery = recoveryOnlyConfigurationV1();
    const configurations = [
      ProviderAcceptedConfigurationV1Schema.parse({
        state: "strong_ready",
        core: elevatedCore,
        activation: { origin: "bootstrap_or_steady_successor" },
      }),
      ProviderAcceptedConfigurationV1Schema.parse({
        ...baseMigration,
        activeRootMetadata: elevatedCore.activeRootMetadata,
        providerRegistryManifest: elevatedCore.providerRegistryManifest,
        providerSupportCatalog: elevatedCore.providerSupportCatalog,
      }),
      ProviderAcceptedConfigurationV1Schema.parse({
        ...baseRecovery,
        activeRootMetadata: elevatedCore.activeRootMetadata,
        lastAcceptedProviderRegistryManifest:
          elevatedCore.providerRegistryManifest,
        lastAcceptedProviderSupportCatalog:
          elevatedCore.providerSupportCatalog,
      }),
    ];
    for (const configuration of configurations) {
      const request = genesisRequestV1(acceptanceEnvelopeV1(configuration));
      const entry = entryV1(request.candidate, request.operationNonce);
      const enumeration = enumerationV1([entry]);
      const highWater = highWaterV1(
        request.candidate,
        enumeration.generationSetDigest,
        request.operationNonce,
      );
      expect(() =>
        ProviderAcceptanceCompareAppendReceiptV1Schema.parse({
          profile: "provider_acceptance_compare_append_receipt_v1",
          installationIdentityGenerationId:
            installationIdentityGenerationIdV1,
          operationNonce: request.operationNonce,
          requestContentDigest:
            deriveProviderAcceptanceCompareAppendRequestContentDigestV1(
              request,
            ),
          requestDurableProjection: request,
          durableOutcome: {
            outcome: "committed",
            committedHighWater: highWater,
            appendedGeneration: entry,
          },
          resolvedAt: "2026-08-19T03:00:01Z",
          receiptToken: tokenV1("1"),
        }),
      ).toThrow();
    }
  });

  it("rejects strict extra keys at formal transaction boundaries", () => {
    const { request, envelope } = committedReceiptV1();
    expect(() =>
      ProviderAcceptanceCompareAppendRequestV1Schema.parse({
        ...request,
        linearizationOrdinal: 1,
      }),
    ).toThrow();
    expect(() =>
      ProviderAcceptanceCompareAppendReceiptV1Schema.parse({
        ...envelope.payload,
        requestReferenceProjection: request,
      }),
    ).toThrow();
  });

  it("uses bootstrap-captured crypto and collection primordials", () => {
    const { request, enumeration } = committedReceiptV1();
    const expectedDigest =
      deriveProviderAcceptanceCompareAppendRequestContentDigestV1(request);
    const descriptors = [
      { owner: TextEncoder.prototype, key: "encode" },
      { owner: Array.prototype, key: "at" },
      { owner: String.prototype, key: "slice" },
    ].map((entry) => {
      const descriptor = Object.getOwnPropertyDescriptor(
        entry.owner,
        entry.key,
      );
      if (descriptor === undefined) {
        throw new TypeError(`${entry.key} descriptor unavailable`);
      }
      return { ...entry, descriptor };
    });
    const globalSetDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "Set",
    )!;
    const poison = vi.fn(() => {
      throw new TypeError("late-bound formal Acceptance primordial");
    });
    let actualDigest: unknown;
    let parsedEnumeration: unknown;
    try {
      Object.defineProperty(globalThis, "Set", {
        ...globalSetDescriptor,
        value: class PoisonSet {
          constructor() {
            poison();
          }
        },
      });
      for (const entry of descriptors) {
        Object.defineProperty(entry.owner, entry.key, {
          ...entry.descriptor,
          value: poison,
        });
      }
      actualDigest =
        deriveProviderAcceptanceCompareAppendRequestContentDigestV1(request);
      parsedEnumeration =
        ProviderAcceptanceGenerationEnumerationV1Schema.parse(enumeration);
    } finally {
      Object.defineProperty(globalThis, "Set", globalSetDescriptor);
      for (const entry of descriptors) {
        Object.defineProperty(entry.owner, entry.key, entry.descriptor);
      }
    }
    expect(actualDigest).toBe(expectedDigest);
    expect(parsedEnumeration).toEqual(enumeration);
    expect(poison).not.toHaveBeenCalled();
  });

  it("rejects D-40 request, high-water, and receipt bytes in both directions", () => {
    const { request, entry, highWater, envelope } = committedReceiptV1();
    const referenceRequest =
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1Schema.parse({
        ...cloneJsonV1(request),
        profile:
          "provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_request_reference_candidate_v1",
      });
    expect(
      deriveProviderAcceptanceCompareAppendRequestContentDigestV1(request),
    ).not.toBe(
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1(
        referenceRequest,
      ),
    );
    expect(() =>
      ProviderAcceptanceCompareAppendRequestV1Schema.parse(referenceRequest),
    ).toThrow();
    expect(() =>
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestReferenceCandidateV1Schema.parse(
        request,
      ),
    ).toThrow();

    const referenceHighWaterPayload =
      ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterReferenceCandidateV1Schema.parse({
        ...cloneJsonV1(highWater.payload),
        profile:
          "provider_strong_ready_bootstrap_or_steady_acceptance_high_water_reference_candidate_v1",
      });
    const referenceHighWater =
      ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1Schema.parse({
        ...cloneJsonV1(highWater),
        recordType:
          "provider_strong_ready_bootstrap_or_steady_acceptance_high_water_reference_candidate",
        locatorProfile:
          "installation_provider_strong_ready_bootstrap_or_steady_acceptance_high_water_reference_candidate_v1",
        contentDigest:
          deriveProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterContentDigestReferenceCandidateV1(
            referenceHighWaterPayload,
          ),
        payload: referenceHighWaterPayload,
      });
    expect(
      deriveProviderAcceptanceHighWaterContentDigestV1(highWater.payload),
    ).not.toBe(
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterContentDigestReferenceCandidateV1(
        referenceHighWaterPayload,
      ),
    );
    expect(() =>
      ProviderAcceptanceHighWaterEnvelopeV1Schema.parse(referenceHighWater),
    ).toThrow();
    expect(() =>
      ProviderStrongReadyBootstrapOrSteadyAcceptanceHighWaterEnvelopeReferenceCandidateV1Schema.parse(
        highWater,
      ),
    ).toThrow();

    const referenceReceiptPayload =
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptReferenceCandidateV1Schema.parse({
        profile:
          "provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_receipt_reference_candidate_v1",
        installationIdentityGenerationId: installationIdentityGenerationIdV1,
        operationNonce: request.operationNonce,
        linearizationOrdinal: 1,
        requestContentDigest:
          deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendRequestContentDigestReferenceCandidateV1(
            referenceRequest,
          ),
        requestReferenceProjection: referenceRequest,
        referenceOutcome: {
          outcome: "committed",
          committedHighWater: referenceHighWater,
          appendedGeneration: entry,
        },
        resolvedAt: envelope.resolvedAt,
        receiptToken: envelope.payload.receiptToken,
      });
    const referenceReceiptEnvelope =
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1Schema.parse({
        schemaVersion: 1,
        recordType:
          "provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_receipt_reference_candidate",
        locatorProfile:
          "installation_provider_strong_ready_bootstrap_or_steady_acceptance_compare_append_receipt_reference_candidate_v1",
        installationIdentityGenerationId: installationIdentityGenerationIdV1,
        operationNonce: request.operationNonce,
        resolvedAt: envelope.resolvedAt,
        contentDigest:
          deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptContentDigestReferenceCandidateV1(
            referenceReceiptPayload,
          ),
        payload: referenceReceiptPayload,
      });
    expect(
      deriveProviderAcceptanceCompareAppendReceiptContentDigestV1(
        envelope.payload,
      ),
    ).not.toBe(
      deriveProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptContentDigestReferenceCandidateV1(
        referenceReceiptPayload,
      ),
    );
    expect(() =>
      ProviderAcceptanceCompareAppendReceiptEnvelopeV1Schema.parse(
        referenceReceiptEnvelope,
      ),
    ).toThrow();
    expect(() =>
      ProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReceiptEnvelopeReferenceCandidateV1Schema.parse(
        envelope,
      ),
    ).toThrow();
  });
});
