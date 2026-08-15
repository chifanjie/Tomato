import { createHash, createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { canonicalizeJcsSafeIntegerV1 } from "../src/jcs.js";
import {
  ContentDigestV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  type ContentDigestV1,
} from "../src/primitives.js";
import {
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_ACCOUNT_STATE_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_EVENT_ENVELOPE_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_EVENT_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_HIGH_WATER_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_HIGH_WATER_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_LEDGER_RECORD_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RECEIPT_ENVELOPE_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RECEIPT_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RESERVATION_ENVELOPE_REFERENCE_CANDIDATE_DOMAIN_V1,
  PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RESERVATION_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
  checkedSumProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLogicalObjectBytesReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalObjectSetBytesReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalReferenceSetBytesReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalRootSetBytesReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalUniverseBytesReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectSetDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceSetDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootSetDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationBudgetsDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountSetDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountStateContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageFromAccountsReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutContentDigestReferenceCandidateV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceDigestReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-reference-candidate-wire.js";
import {
  assertProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineCapabilityInternalV1,
  captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutInternalV1,
  captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostQuotaContinuityInternalV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionInternalV1,
  deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunAndHistoryQuotaSizingInternalV1,
  getProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaCanonicalDecodeCountForTestInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCapabilityInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineInternalV1,
  mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRetainedArtifactUpperBoundsCapabilityInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1,
  type ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineCapabilityInternalV1,
} from "../src/provider-migration-same-installation-identity-current-strong-source-normal-history-quota-reference-machine-internal.js";

const installationIdentityGenerationId =
  InstallationIdentityGenerationIdV1Schema.parse(
    "installation-identity-generation:0123456789abcdef012345",
  );
const hmacKey = Buffer.from(
  "d41-history-quota-reference-machine-focused-key-v1",
  "utf8",
);
const digest = (character: string): ContentDigestV1 =>
  ContentDigestV1Schema.parse(`sha256:${character.repeat(64)}`);

function domainDigestV1(domain: string, fields: unknown): ContentDigestV1 {
  return ContentDigestV1Schema.parse(
    `sha256:${createHash("sha256")
      .update(canonicalizeJcsSafeIntegerV1([domain, fields]), "utf8")
      .digest("hex")}`,
  );
}

function keyedTokenV1(domain: string, fields: unknown): string {
  return `hmac-sha256:${createHmac("sha256", hmacKey)
    .update(canonicalizeJcsSafeIntegerV1([domain, fields]), "utf8")
    .digest("hex")}`;
}

function canonicalByteStringV1(value: unknown): string {
  return `base64url:${Buffer.from(
    canonicalizeJcsSafeIntegerV1(value),
    "utf8",
  ).toString("base64url")}`;
}

function decodedCanonicalEnvelopeV1<T>(shell: {
  readonly canonicalEnvelopeBytes: string;
}): T {
  return JSON.parse(
    Buffer.from(
      shell.canonicalEnvelopeBytes.slice("base64url:".length),
      "base64url",
    ).toString("utf8"),
  ) as T;
}

function emptyAccountStateV1() {
  const accounts: [] = [];
  const usage =
    deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageFromAccountsReferenceCandidateV1(
      accounts,
    );
  const unsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_quota_account_state_reference_candidate_v1" as const,
    installationIdentityGenerationId,
    accounts,
    accountCount: 0,
    accountSetDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountSetDigestReferenceCandidateV1(
        { entries: accounts },
      ),
    usage,
    futureTerminalTransitionEscrowCount: 0,
    eventEscrowLogicalBytes: 0,
    receiptEscrowLogicalBytes: 0,
  };
  return {
    ...unsigned,
    contentDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountStateContentDigestReferenceCandidateV1(
        unsigned,
      ),
  };
}

function emptyQuotaCutV1(
  mutatePayload?: (payload: Record<string, unknown>) => void,
) {
  const accountState = emptyAccountStateV1();
  const payload: Record<string, unknown> = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_quota_high_water_payload_reference_candidate_v1",
    installationIdentityGenerationId,
    stateRevision: 0,
    ledgerRevision: 0,
    currentEvent: { state: "genesis" },
    reservationRecordCount: 0,
    reservationRecordSetDigest: domainDigestV1(
      PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RESERVATION_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
      { entries: [] },
    ),
    reservationRecordLogicalBytes: 0,
    eventCount: 0,
    eventSetDigest: domainDigestV1(
      PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_EVENT_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
      { entries: [] },
    ),
    ledgerEventLogicalBytes: 0,
    receiptCount: 0,
    receiptSetDigest: domainDigestV1(
      PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RECEIPT_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
      { entries: [] },
    ),
    operationReceiptLogicalBytes: 0,
    accountCount: 0,
    accountSetDigest: accountState.accountSetDigest,
    accountStateContentDigest: accountState.contentDigest,
    usage: accountState.usage,
    futureTerminalTransitionEscrowCount: 0,
    eventEscrowLogicalBytes: 0,
    receiptEscrowLogicalBytes: 0,
  };
  mutatePayload?.(payload);
  const contentDigest = domainDigestV1(
    PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_HIGH_WATER_REFERENCE_CANDIDATE_DOMAIN_V1,
    payload,
  );
  const tokenFields = {
    installationIdentityGenerationId,
    payload,
    outerContentDigest: contentDigest,
  };
  const envelope = {
    schemaVersion: 1,
    recordType:
      "provider_migration_same_installation_identity_current_strong_source_normal_quota_high_water_reference_candidate",
    installationIdentityGenerationId,
    contentDigest,
    payload,
    quotaStateVersionToken: keyedTokenV1(
      PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_HIGH_WATER_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
      tokenFields,
    ),
  };
  const encoded = canonicalByteStringV1(envelope);
  return {
    reservations: [],
    events: [],
    receipts: [],
    highWater: {
      locatorReferenceDigest: digest("d"),
      canonicalEnvelopeBytes: encoded,
      canonicalLogicalBytes: Buffer.byteLength(
        canonicalizeJcsSafeIntegerV1(envelope),
        "utf8",
      ),
    },
  };
}

function accountStateV1(accounts: readonly Record<string, unknown>[]) {
  const usage =
    deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaUsageFromAccountsReferenceCandidateV1(
      accounts,
    );
  const futureTerminalTransitionEscrowCount =
    usage.reservedAccountCount * 3 + usage.retainedAccountCount;
  const unsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_quota_account_state_reference_candidate_v1" as const,
    installationIdentityGenerationId,
    accounts,
    accountCount: accounts.length,
    accountSetDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountSetDigestReferenceCandidateV1(
        { entries: accounts },
      ),
    usage,
    futureTerminalTransitionEscrowCount,
    eventEscrowLogicalBytes:
      futureTerminalTransitionEscrowCount * 262_144,
    receiptEscrowLogicalBytes:
      futureTerminalTransitionEscrowCount * 1_048_576,
  };
  return {
    ...unsigned,
    contentDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountStateContentDigestReferenceCandidateV1(
        unsigned,
      ),
  };
}

function loadedEnvelopeV1(
  envelope: Record<string, unknown>,
  locatorReferenceDigest: ContentDigestV1,
) {
  const canonical = canonicalizeJcsSafeIntegerV1(envelope);
  return {
    locatorReferenceDigest,
    canonicalEnvelopeBytes: canonicalByteStringV1(envelope),
    canonicalLogicalBytes: Buffer.byteLength(canonical, "utf8"),
  };
}

function recordTokenV1(
  recordType: string,
  ordinal: number,
  locatorReferenceDigest: ContentDigestV1,
  contentDigest: ContentDigestV1,
) {
  return keyedTokenV1(
    PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_LEDGER_RECORD_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
    {
      recordType,
      installationIdentityGenerationId,
      ordinal,
      locatorReferenceDigest,
      contentDigest,
    },
  );
}

function singleReservedQuotaCutV1(options: {
  wrongPredecessor?: boolean;
  wrongReceiptNonce?: boolean;
  wrongReceiptAccountReference?: boolean;
} = {}) {
  const operationNonce = "00112233445566778899aabbccddeeff";
  const accountReferenceDigest =
    deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceDigestReferenceCandidateV1(
      {
        installationIdentityGenerationId,
        reservationOrdinal: 1,
        createdByOperationNonce: operationNonce,
      },
    );
  const account = {
    accountOrdinal: 0,
    reservationOrdinal: 1,
    createdByOperationNonce: operationNonce,
    accountReferenceDigest,
    state: "reserved" as const,
    migrationSlotCount: 1 as const,
    contribution: {
      historyLogicalBytes: 10,
      historyProviderAllocatedBytes: 20,
      objectReceiptCount: 1,
      objectReceiptLogicalBytes: 30,
      semanticRootZeroProofCount: 2,
      semanticRootZeroProofLogicalBytes: 40,
      progressRecordCount: 3,
      progressRecordLogicalBytes: 50,
      progressOperationReceiptCount: 4,
      progressOperationReceiptLogicalBytes: 60,
    },
  };
  const beforeAccountState = emptyAccountStateV1();
  const afterAccountState = accountStateV1([account]);
  const requestContentDigest = digest("a");

  const reservationLocator = digest("1");
  const reservationUnsigned = {
    schemaVersion: 1 as const,
    recordType:
      "provider_migration_same_installation_identity_current_strong_source_normal_quota_reservation_reference_candidate" as const,
    installationIdentityGenerationId,
    reservationOrdinal: 1,
    payload: {
      profile:
        "provider_migration_same_installation_identity_current_strong_source_normal_quota_reservation_payload_reference_candidate_v1" as const,
      installationIdentityGenerationId,
      reservationOrdinal: 1,
      createdByOperationNonce: operationNonce,
      account,
    },
  };
  const reservationContentDigest = domainDigestV1(
    PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RESERVATION_ENVELOPE_REFERENCE_CANDIDATE_DOMAIN_V1,
    {
      installationIdentityGenerationId,
      reservationOrdinal: reservationUnsigned.reservationOrdinal,
      payload: reservationUnsigned.payload,
    },
  );
  const reservationEnvelope = {
    ...reservationUnsigned,
    contentDigest: reservationContentDigest,
    recordToken: recordTokenV1(
      reservationUnsigned.recordType,
      1,
      reservationLocator,
      reservationContentDigest,
    ),
  };
  const reservation = loadedEnvelopeV1(
    reservationEnvelope,
    reservationLocator,
  );

  const eventLocator = digest("2");
  const eventPayload = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_quota_event_payload_reference_candidate_v1" as const,
    installationIdentityGenerationId,
    eventOrdinal: 1,
    predecessor: options.wrongPredecessor
      ? {
          state: "event" as const,
          eventOrdinal: 1,
          contentDigest: digest("b"),
        }
      : { state: "genesis" as const },
    operationNonce,
    requestContentDigest,
    transition: {
      kind: "reserve_reference_candidate" as const,
      before: { state: "absent" as const },
      after: { state: "account" as const, account },
    },
    beforeAccountStateContentDigest: beforeAccountState.contentDigest,
    afterAccountStateContentDigest: afterAccountState.contentDigest,
  };
  const eventUnsigned = {
    schemaVersion: 1 as const,
    recordType:
      "provider_migration_same_installation_identity_current_strong_source_normal_quota_event_reference_candidate" as const,
    installationIdentityGenerationId,
    eventOrdinal: 1,
    payload: eventPayload,
  };
  const eventContentDigest = domainDigestV1(
    PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_EVENT_ENVELOPE_REFERENCE_CANDIDATE_DOMAIN_V1,
    {
      installationIdentityGenerationId,
      eventOrdinal: eventUnsigned.eventOrdinal,
      payload: eventUnsigned.payload,
    },
  );
  const eventEnvelope = {
    ...eventUnsigned,
    contentDigest: eventContentDigest,
    recordToken: recordTokenV1(
      eventUnsigned.recordType,
      1,
      eventLocator,
      eventContentDigest,
    ),
  };
  const event = loadedEnvelopeV1(eventEnvelope, eventLocator);

  const receiptLocator = digest("3");
  const receiptOperationNonce = options.wrongReceiptNonce
    ? "ffeeddccbbaa99887766554433221100"
    : operationNonce;
  const receiptPayload = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_quota_receipt_payload_reference_candidate_v1" as const,
    installationIdentityGenerationId,
    receiptOrdinal: 1,
    operationNonce: receiptOperationNonce,
    requestContentDigest,
    accountReferenceDigest: options.wrongReceiptAccountReference
      ? digest("f")
      : accountReferenceDigest,
    observedPreHighWaterContentDigest:
      decodedCanonicalEnvelopeV1<{ contentDigest: ContentDigestV1 }>(
        emptyQuotaCutV1().highWater,
      ).contentDigest,
    outcome: {
      state: "committed_reference_candidate" as const,
      eventOrdinal: 1,
      eventContentDigest,
      postAccountStateContentDigest: afterAccountState.contentDigest,
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
      receiptOrdinal: receiptUnsigned.receiptOrdinal,
      payload: receiptUnsigned.payload,
    },
  );
  const receiptEnvelope = {
    ...receiptUnsigned,
    contentDigest: receiptContentDigest,
    recordToken: recordTokenV1(
      receiptUnsigned.recordType,
      1,
      receiptLocator,
      receiptContentDigest,
    ),
  };
  const receipt = loadedEnvelopeV1(receiptEnvelope, receiptLocator);

  const reservationEntries = [{
    ordinal: 1,
    locatorReferenceDigest: reservationLocator,
    contentDigest: reservationContentDigest,
  }];
  const eventEntries = [{
    ordinal: 1,
    locatorReferenceDigest: eventLocator,
    contentDigest: eventContentDigest,
  }];
  const receiptEntries = [{
    ordinal: 1,
    locatorReferenceDigest: receiptLocator,
    contentDigest: receiptContentDigest,
  }];
  const highWaterPayload = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_quota_high_water_payload_reference_candidate_v1" as const,
    installationIdentityGenerationId,
    stateRevision: 1,
    ledgerRevision: 1,
    currentEvent: {
      state: "event" as const,
      eventOrdinal: 1,
      contentDigest: eventContentDigest,
    },
    reservationRecordCount: 1,
    reservationRecordSetDigest: domainDigestV1(
      PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RESERVATION_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
      { entries: reservationEntries },
    ),
    reservationRecordLogicalBytes: reservation.canonicalLogicalBytes,
    eventCount: 1,
    eventSetDigest: domainDigestV1(
      PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_EVENT_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
      { entries: eventEntries },
    ),
    ledgerEventLogicalBytes: event.canonicalLogicalBytes,
    receiptCount: 1,
    receiptSetDigest: domainDigestV1(
      PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RECEIPT_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
      { entries: receiptEntries },
    ),
    operationReceiptLogicalBytes: receipt.canonicalLogicalBytes,
    accountCount: afterAccountState.accountCount,
    accountSetDigest: afterAccountState.accountSetDigest,
    accountStateContentDigest: afterAccountState.contentDigest,
    usage: afterAccountState.usage,
    futureTerminalTransitionEscrowCount:
      afterAccountState.futureTerminalTransitionEscrowCount,
    eventEscrowLogicalBytes: afterAccountState.eventEscrowLogicalBytes,
    receiptEscrowLogicalBytes: afterAccountState.receiptEscrowLogicalBytes,
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
    reservations: [reservation],
    events: [event],
    receipts: [receipt],
    highWater: loadedEnvelopeV1(highWaterEnvelope, digest("4")),
  };
}

type QuotaEnvelopeKindV1 =
  | "reservation"
  | "event"
  | "receipt"
  | "high_water";

function rebuildQuotaLoadedEnvelopeV1(
  shell: ReturnType<typeof loadedEnvelopeV1>,
  kind: QuotaEnvelopeKindV1,
  mutate: (envelope: Record<string, unknown>) => void = () => {},
  locatorReferenceDigest = shell.locatorReferenceDigest,
) {
  const envelope = structuredClone(
    decodedCanonicalEnvelopeV1<Record<string, unknown>>(shell),
  );
  mutate(envelope);
  const payload = envelope.payload;
  const contentDigest = kind === "high_water"
    ? domainDigestV1(
        PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_HIGH_WATER_REFERENCE_CANDIDATE_DOMAIN_V1,
        payload,
      )
    : domainDigestV1(
        kind === "reservation"
          ? PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RESERVATION_ENVELOPE_REFERENCE_CANDIDATE_DOMAIN_V1
          : kind === "event"
            ? PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_EVENT_ENVELOPE_REFERENCE_CANDIDATE_DOMAIN_V1
            : PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RECEIPT_ENVELOPE_REFERENCE_CANDIDATE_DOMAIN_V1,
        {
          installationIdentityGenerationId:
            envelope.installationIdentityGenerationId,
          [kind === "reservation"
            ? "reservationOrdinal"
            : kind === "event"
              ? "eventOrdinal"
              : "receiptOrdinal"]:
            envelope[kind === "reservation"
              ? "reservationOrdinal"
              : kind === "event"
                ? "eventOrdinal"
                : "receiptOrdinal"],
          payload,
        },
      );
  envelope.contentDigest = contentDigest;
  if (kind === "high_water") {
    envelope.quotaStateVersionToken = keyedTokenV1(
      PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_HIGH_WATER_TOKEN_REFERENCE_CANDIDATE_DOMAIN_V1,
      {
        installationIdentityGenerationId:
          envelope.installationIdentityGenerationId,
        payload,
        outerContentDigest: contentDigest,
      },
    );
  } else {
    const ordinal = envelope[kind === "reservation"
      ? "reservationOrdinal"
      : kind === "event"
        ? "eventOrdinal"
        : "receiptOrdinal"];
    if (typeof ordinal !== "number" || typeof envelope.recordType !== "string") {
      throw new TypeError("quota fixture ordinal/record type missing");
    }
    envelope.recordToken = recordTokenV1(
      envelope.recordType,
      ordinal,
      locatorReferenceDigest,
      contentDigest,
    );
  }
  return loadedEnvelopeV1(envelope, locatorReferenceDigest);
}

function reservedThenNotCommittedQuotaCutV1(options: {
  prospectiveReservationOrdinal?: number;
  wrongProspectiveDigest?: boolean;
  postAccountLeak?: boolean;
} = {}) {
  const cut = singleReservedQuotaCutV1();
  const firstHighWater =
    decodedCanonicalEnvelopeV1<Record<string, unknown>>(cut.highWater);
  const firstHighWaterPayload = firstHighWater.payload as Record<
    string,
    unknown
  >;
  const operationNonce = "ffeeddccbbaa99887766554433221100";
  const prospectiveReservationOrdinal =
    options.prospectiveReservationOrdinal ?? 2;
  const firstReservation = decodedCanonicalEnvelopeV1<Record<string, unknown>>(
    cut.reservations[0]!,
  );
  const firstAccount = (firstReservation.payload as Record<string, unknown>)
    .account as Record<string, unknown>;
  const accountReferenceDigest = options.postAccountLeak
    ? firstAccount.accountReferenceDigest
    : options.wrongProspectiveDigest
      ? digest("f")
      : deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceDigestReferenceCandidateV1(
          {
            installationIdentityGenerationId,
            reservationOrdinal: prospectiveReservationOrdinal,
            createdByOperationNonce: operationNonce,
          },
        );
  const receiptLocator = digest("5");
  const receiptUnsigned = {
    schemaVersion: 1 as const,
    recordType:
      "provider_migration_same_installation_identity_current_strong_source_normal_quota_receipt_reference_candidate" as const,
    installationIdentityGenerationId,
    receiptOrdinal: 2,
    payload: {
      profile:
        "provider_migration_same_installation_identity_current_strong_source_normal_quota_receipt_payload_reference_candidate_v1" as const,
      installationIdentityGenerationId,
      receiptOrdinal: 2,
      operationNonce,
      requestContentDigest: digest("e"),
      accountReferenceDigest,
      observedPreHighWaterContentDigest: firstHighWater.contentDigest,
      outcome: {
        state: "not_committed_reference_candidate" as const,
        reason: "expected_changed" as const,
        observedAccountStateContentDigest:
          firstHighWaterPayload.accountStateContentDigest,
      },
    },
  };
  const receiptContentDigest = domainDigestV1(
    PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RECEIPT_ENVELOPE_REFERENCE_CANDIDATE_DOMAIN_V1,
    {
      installationIdentityGenerationId,
      receiptOrdinal: receiptUnsigned.receiptOrdinal,
      payload: receiptUnsigned.payload,
    },
  );
  const receipt = loadedEnvelopeV1(
    {
      ...receiptUnsigned,
      contentDigest: receiptContentDigest,
      recordToken: recordTokenV1(
        receiptUnsigned.recordType,
        receiptUnsigned.receiptOrdinal,
        receiptLocator,
        receiptContentDigest,
      ),
    },
    receiptLocator,
  );
  const receipts = [...cut.receipts, receipt];
  const receiptEntries = receipts.map((entry, index) => ({
    ordinal: index + 1,
    locatorReferenceDigest: entry.locatorReferenceDigest,
    contentDigest:
      decodedCanonicalEnvelopeV1<{ contentDigest: ContentDigestV1 }>(entry)
        .contentDigest,
  }));
  const highWater = rebuildQuotaLoadedEnvelopeV1(
    cut.highWater,
    "high_water",
    (envelope) => {
      const payload = envelope.payload as Record<string, unknown>;
      payload.ledgerRevision = 2;
      payload.receiptCount = 2;
      payload.receiptSetDigest = domainDigestV1(
        PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_QUOTA_RECEIPT_SET_REFERENCE_CANDIDATE_DOMAIN_V1,
        { entries: receiptEntries },
      );
      payload.operationReceiptLogicalBytes = receipts.reduce(
        (sum, entry) => sum + entry.canonicalLogicalBytes,
        0,
      );
    },
  );
  return { ...cut, receipts, highWater };
}

function noncanonicalRoundTripShellV1(
  shell: ReturnType<typeof loadedEnvelopeV1>,
) {
  const canonicalText = Buffer.from(
    shell.canonicalEnvelopeBytes.slice("base64url:".length),
    "base64url",
  ).toString("utf8");
  const noncanonicalText = `${canonicalText}\n`;
  return {
    ...shell,
    canonicalEnvelopeBytes: `base64url:${Buffer.from(
      noncanonicalText,
      "utf8",
    ).toString("base64url")}`,
    canonicalLogicalBytes: Buffer.byteLength(noncanonicalText, "utf8"),
  };
}

const artifactKinds = [
  "canonical_rewrite_plan",
  "destination_universe",
  "migration_plan",
  "object_receipt",
  "progress_operation_receipt",
  "progress_record",
  "sealed_progress_head",
  "semantic_equivalence_proof",
  "source_tombstone",
  "source_universe",
  "zero_live_proof",
] as const;

function retainedArtifactProjectionV1() {
  return {
    policyDigest: digest("c"),
    retainedArtifactUpperBounds: artifactKinds.map((artifactKind) =>
      artifactKind === "migration_plan"
        ? {
            artifactKind,
            artifactCount: 1,
            canonicalEnvelopeBytesUpperBoundTotal: 4_194_304,
            providerAllocatedBytesUpperBoundTotal: 4_194_304,
          }
        : {
            artifactKind,
            artifactCount: 0,
            canonicalEnvelopeBytesUpperBoundTotal: 0,
            providerAllocatedBytesUpperBoundTotal: 0,
          },
    ),
  };
}

function historyQuotaHostV1(
  preCut: ReturnType<typeof emptyQuotaCutV1>,
  postCut: ReturnType<typeof emptyQuotaCutV1> = preCut,
  projection: unknown = retainedArtifactProjectionV1(),
) {
  const captureCompleteQuotaCut = vi.fn(
    (input: Parameters<
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1["captureCompleteQuotaCut"]
    >[0]) => {
      input.deliverCompleteQuotaCutCapability(
        mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCapabilityInternalV1(
          input.completeQuotaCutMintChallenge,
          structuredClone(input.phase === "pre" ? preCut : postCut),
        ),
      );
    },
  );
  const captureRetainedArtifactUpperBounds = vi.fn(
    (input: Parameters<
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1["captureRetainedArtifactUpperBounds"]
    >[0]) => {
      input.deliverRetainedArtifactUpperBoundsCapability(
        mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRetainedArtifactUpperBoundsCapabilityInternalV1(
          input.retainedArtifactUpperBoundsMintChallenge,
          structuredClone(projection),
        ),
      );
    },
  );
  const verifyQuotaLedgerRecordToken = vi.fn((input: Parameters<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1["verifyQuotaLedgerRecordToken"]
  >[0]) => {
    const { tokenDomain, token, ...fields } = input;
    return token === keyedTokenV1(tokenDomain, fields);
  });
  const verifyQuotaHighWaterToken = vi.fn((input: Parameters<
    ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1["verifyQuotaHighWaterToken"]
  >[0]) => {
    const { tokenDomain, token, ...fields } = input;
    return token === keyedTokenV1(tokenDomain, fields);
  });
  const host: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1 = {
    captureCompleteQuotaCut,
    captureRetainedArtifactUpperBounds,
    verifyQuotaLedgerRecordToken,
    verifyQuotaHighWaterToken,
  };
  return {
    host,
    captureCompleteQuotaCut,
    captureRetainedArtifactUpperBounds,
    verifyQuotaLedgerRecordToken,
    verifyQuotaHighWaterToken,
  };
}

function canonicalByteStringForLogicalLengthV1(logicalBytes: number): string {
  const completeTriples = Math.floor(logicalBytes / 3);
  const remainder = logicalBytes - completeTriples * 3;
  const bodyLength =
    completeTriples * 4 + (remainder === 0 ? 0 : remainder + 1);
  return `base64url:${"A".repeat(bodyLength)}`;
}

function millionExtraNameFloodV1<T extends object>(target: T) {
  const ownKeys = vi.fn((): (string | symbol)[] =>
    Reflect.ownKeys(target).concat(
      Array.from({ length: 1_000_000 }, (_, index) => `legacy${index}`),
    ));
  return {
    value: new Proxy(target, {
      ownKeys,
    }),
    ownKeys,
  };
}

function hostileThenableReturnV1() {
  const get = vi.fn((_target: object, key: PropertyKey) => {
    if (key === "then") {
      throw new Error("host return then must not be observed");
    }
    return undefined;
  });
  return {
    value: new Proxy(Object.create(null) as object, { get }),
    get,
  };
}

function rawLoadedEnvelopeV1(
  canonicalLogicalBytes: number,
  canonicalEnvelopeBytes: string,
) {
  return {
    locatorReferenceDigest: digest("e"),
    canonicalEnvelopeBytes,
    canonicalLogicalBytes,
  };
}

function historyQuotaRawCutHostV1(rawCut: unknown) {
  const state = historyQuotaHostV1(emptyQuotaCutV1());
  const captureCompleteQuotaCut = vi.fn(
    (input: Parameters<
      ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1["captureCompleteQuotaCut"]
    >[0]) => {
      input.deliverCompleteQuotaCutCapability(
        mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCapabilityInternalV1(
          input.completeQuotaCutMintChallenge,
          rawCut,
        ),
      );
    },
  );
  state.host.captureCompleteQuotaCut = captureCompleteQuotaCut;
  return { ...state, captureCompleteQuotaCut };
}

function machineV1(
  host: ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1,
  options: Readonly<{
    cohortIdentity?: object;
    identity?: typeof installationIdentityGenerationId;
  }> = {},
) {
  const cohortIdentity =
    options.cohortIdentity ?? Object.freeze(Object.create(null)) as object;
  const identity = options.identity ?? installationIdentityGenerationId;
  const capability =
    mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineInternalV1(
      {
        cohortIdentity,
        installationIdentityGenerationId: identity,
        quotaObservationHost: host,
      },
    );
  return { cohortIdentity, identity, capability };
}

async function expectRawQuotaCutPreflightRejectionV1(
  rawCut: unknown,
): Promise<void> {
  const decodeCountBefore =
    getProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaCanonicalDecodeCountForTestInternalV1();
  const hostState = historyQuotaRawCutHostV1(rawCut);
  const { capability } = machineV1(hostState.host);
  await expect(
    captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutInternalV1(
      { quotaMachineCapability: capability, phase: "pre" },
    ),
  ).rejects.toMatchObject({
    stage: "quota_reference_snapshot",
    reason: "quota_ledger_integrity_failed",
  });
  expect(hostState.captureCompleteQuotaCut).toHaveBeenCalledTimes(1);
  expect(
    getProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaCanonicalDecodeCountForTestInternalV1(),
  ).toBe(decodeCountBefore);
  expect(hostState.verifyQuotaLedgerRecordToken).not.toHaveBeenCalled();
  expect(hostState.verifyQuotaHighWaterToken).not.toHaveBeenCalled();
}

function compareCanonicalV1(left: unknown, right: unknown): number {
  return Buffer.compare(
    Buffer.from(canonicalizeJcsSafeIntegerV1(left), "utf8"),
    Buffer.from(canonicalizeJcsSafeIntegerV1(right), "utf8"),
  );
}

function sourceClosureV1(): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1 {
  const bindingUnsigned = {
    targetProfileId: `provider-target-profile:${"1".repeat(64)}`,
    providerId: "durable-object-provider:native-b",
    registryEntryContentDigest: digest("2"),
    semanticProviderPolicyDigest: digest("3"),
    providerFeasibilityEvidence: {
      locatorProfile: "installation_provider_feasibility_evidence_v1",
      evidenceId: `provider-feasibility-evidence:${"4".repeat(22)}`,
      contentDigest: digest("5"),
    },
    runtimeAttestationContentDigest: digest("6"),
    bindingDerivationKeyGeneration: 1,
  };
  const providerBinding = {
    ...bindingUnsigned,
    bindingReferenceDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreProviderBindingReferenceDigestReferenceCandidateV1(
        bindingUnsigned,
      ),
  };
  const storeUnsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_store_manifest_current_cut_reference_candidate_v1" as const,
    namespace: {
      installationIdentityGenerationId,
      repositoryId: `provider-migration-same-installation-identity-current-strong-source-normal-repository-reference-candidate:${"7".repeat(64)}`,
      worktreeId: `provider-migration-same-installation-identity-current-strong-source-normal-worktree-reference-candidate:${"8".repeat(64)}`,
    },
    providerBinding,
    namespaceRevision: 1,
    headContentDigest: digest("9"),
    currentVersionReferenceDigest: digest("a"),
    generationCount: 1,
    generationSetDigest: digest("b"),
    currentGeneration: {
      generationOrdinal: 1,
      generationReferenceId: `provider-migration-same-installation-identity-current-strong-source-normal-store-manifest-generation-reference-candidate:${"c".repeat(22)}`,
      contentDigest: digest("9"),
    },
  };
  const sourceStoreManifest = {
    ...storeUnsigned,
    cutContentDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalStoreManifestCurrentCutContentDigestReferenceCandidateV1(
        storeUnsigned,
      ),
  };
  const rawRoots = [
    {
      rootKind: "store_manifest_complete_set" as const,
      current: structuredClone(sourceStoreManifest),
    },
    {
      rootKind: "quota_index_and_transition_chain" as const,
      currentQuotaIndexRootContentDigest: digest("d"),
      transitionHead: { state: "genesis" as const },
    },
    {
      rootKind: "artifact_descriptor_history_closure" as const,
      rootCount: 0,
      rootSetDigest: digest("e"),
    },
    {
      rootKind: "initialization_terminal" as const,
      terminalHeadReferenceDigest: digest("f"),
    },
    {
      rootKind: "store_manifest_compare_append_receipt_ledger" as const,
      providerId: providerBinding.providerId,
      providerPolicyDigest: providerBinding.semanticProviderPolicyDigest,
      receiptCount: 0,
      receiptSetDigest: digest("0"),
      receiptLogicalBytes: 0,
    },
    {
      rootKind: "active_recovery_control" as const,
      activeTransactionCount: 0 as const,
      controlUniverseDigest: digest("1"),
    },
  ];
  rawRoots.sort((left, right) =>
    compareCanonicalV1({ root: left }, { root: right }),
  );
  const roots = rawRoots.map((root, rootOrdinal) => ({ rootOrdinal, root }));
  const object = {
    objectOrdinal: 0,
    objectKind: "control_state" as const,
    locatorNamespace: "store" as const,
    logicalLocatorReferenceDigest: digest("2"),
    semanticLocatorDigest: digest("3"),
    contentDigest: digest("4"),
    logicalBytes: 1,
    providerBindingReferenceDigest: providerBinding.bindingReferenceDigest,
  };
  const objects = [object];
  const sourceRootOrdinal = roots.findIndex(
    (entry) => entry.root.rootKind === "active_recovery_control",
  );
  const references = [{
    edgeOrdinal: 0,
    from: { sourceKind: "root" as const, rootOrdinal: sourceRootOrdinal },
    referenceSlotReferenceDigest: digest("5"),
    referenceSlotDescriptor: {
      sourceKind: "root" as const,
      rootKind: "active_recovery_control" as const,
      schemaFieldPath: "base64url:eA",
      occurrenceOrdinal: 0,
    },
    toObjectOrdinal: 0,
  }];
  const unsigned = {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_complete_source_read_closure_reference_candidate_v1" as const,
    sourceInstallationIdentityGenerationId: installationIdentityGenerationId,
    sourceTrustClosureContentDigest: digest("6"),
    sourceStoreManifest,
    sourceFreezeStateReferenceDigest: digest("7"),
    liveReferenceSchemaDigest: digest("8"),
    roots,
    objects,
    references,
    rootCount: roots.length,
    rootSetDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveRootSetDigestReferenceCandidateV1(
        { entries: roots },
      ),
    canonicalRootSetBytes:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalRootSetBytesReferenceCandidateV1(
        { entries: roots },
      ),
    objectCount: objects.length,
    objectSetDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveObjectSetDigestReferenceCandidateV1(
        { entries: objects },
      ),
    canonicalObjectSetBytes:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalObjectSetBytesReferenceCandidateV1(
        { entries: objects },
      ),
    logicalObjectBytesTotal:
      checkedSumProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLogicalObjectBytesReferenceCandidateV1(
        objects,
      ),
    referenceCount: references.length,
    referenceSetDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalLiveReferenceSetDigestReferenceCandidateV1(
        { entries: references },
      ),
    canonicalReferenceSetBytes:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalReferenceSetBytesReferenceCandidateV1(
        { entries: references },
      ),
    canonicalUniverseBytes:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCanonicalUniverseBytesReferenceCandidateV1(
        { roots, objects, references },
      ),
    activeTransactions: [] as [],
  };
  return {
    ...unsigned,
    completeReadClosureContentDigest:
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureContentDigestReferenceCandidateV1(
        unsigned,
      ),
  } as ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteSourceReadClosureReferenceCandidateV1;
}

function budgetsV1(): ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectBudgetsReferenceCandidateV1 {
  return {
    profile:
      "provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_budgets_reference_candidate_v1",
    maxRootEntries: 6,
    maxLiveObjects: 1,
    maxReferenceEdges: 1,
    maxRewriteObjects: 1,
    maxRewriteReferenceMappings: 1,
    maxRewriteSccs: 1,
    maxLogicalObjectBytesTotal: 1,
    maxProgressRecords: 9,
    maxProgressOperationReceipts: 1,
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
  };
}

describe("D-41 private migration-history quota reference machine", () => {
  it("binds a frozen zero-key capability to one cohort and Identity", () => {
    const { host } = historyQuotaHostV1(emptyQuotaCutV1());
    const { cohortIdentity, capability } = machineV1(host);
    expect(Object.getPrototypeOf(capability)).toBeNull();
    expect(Object.keys(capability)).toEqual([]);
    expect(Object.isFrozen(capability)).toBe(true);
    expect(() =>
      assertProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineCapabilityInternalV1(
        capability,
        cohortIdentity,
        installationIdentityGenerationId,
      ),
    ).not.toThrow();
    expect(() =>
      assertProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineCapabilityInternalV1(
        capability,
        Object.freeze({}),
        installationIdentityGenerationId,
      ),
    ).toThrow(/capability_invalid/u);
    expect(() =>
      assertProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineCapabilityInternalV1(
        Object.freeze(Object.create(null)),
        cohortIdentity,
        installationIdentityGenerationId,
      ),
    ).toThrow(/capability_invalid/u);
  });

  it.each([
    ["reservations", 1_048_576],
    ["events", 262_144],
    ["receipts", 1_048_576],
    ["highWater", 1_048_576],
  ] as const)(
    "rejects an over-single-cap %s shell before canonical decode or token verification",
    async (field, singleCap) => {
      const shell = rawLoadedEnvelopeV1(
        singleCap + 1,
        "base64url:",
      );
      const rawCut: Record<string, unknown> = { ...emptyQuotaCutV1() };
      rawCut[field] = field === "highWater" ? shell : [shell];
      await expectRawQuotaCutPreflightRejectionV1(rawCut);
    },
  );

  it.each([
    [
      "shared one-MiB wire bound",
      "highWater",
      1,
      1_048_577,
    ],
    ["event wire bound", "events", 262_144, 262_145],
    ["declared byte mismatch", "events", 1, 2],
  ] as const)(
    "rejects a %s before the CanonicalByteString codec",
    async (_label, field, declaredBytes, representedBytes) => {
      const shell = rawLoadedEnvelopeV1(
        declaredBytes,
        canonicalByteStringForLogicalLengthV1(representedBytes),
      );
      const rawCut: Record<string, unknown> = { ...emptyQuotaCutV1() };
      rawCut[field] = field === "highWater" ? shell : [shell];
      await expectRawQuotaCutPreflightRejectionV1(rawCut);
    },
  );

  it.each([
    ["reservations", 65, 1_048_576],
    ["events", 257, 262_144],
    ["receipts", 257, 1_048_576],
  ] as const)(
    "rejects the %s aggregate byte cap before canonical decode or token verification",
    async (field, count, singleBytes) => {
      const canonicalEnvelopeBytes =
        canonicalByteStringForLogicalLengthV1(singleBytes);
      const entries = Array.from({ length: count }, () =>
        rawLoadedEnvelopeV1(
          singleBytes,
          canonicalEnvelopeBytes,
        ),
      );
      const rawCut: Record<string, unknown> = { ...emptyQuotaCutV1() };
      rawCut[field] = entries;
      await expectRawQuotaCutPreflightRejectionV1(rawCut);
    },
  );

  it("rejects an over-count raw array before inspecting any shell", async () => {
    const shell = rawLoadedEnvelopeV1(
      0,
      "base64url:",
    );
    const rawCut: Record<string, unknown> = { ...emptyQuotaCutV1() };
    rawCut.reservations = Array.from({ length: 4_097 }, () => shell);
    await expectRawQuotaCutPreflightRejectionV1(rawCut);
  });

  it("normalizes a raw shell without enumerating its million extra names", async () => {
    const shellFlood = millionExtraNameFloodV1({
      ...rawLoadedEnvelopeV1(1_048_577, "base64url:"),
      decodedEnvelope: Object.freeze({ legacy: true }),
    });
    const rawCut: Record<string, unknown> = { ...emptyQuotaCutV1() };
    rawCut.highWater = shellFlood.value;
    await expectRawQuotaCutPreflightRejectionV1(rawCut);
    expect(shellFlood.ownKeys).not.toHaveBeenCalled();
  });

  it("normalizes a raw cut without enumerating its million extra names", async () => {
    const cutFlood = millionExtraNameFloodV1({
      ...emptyQuotaCutV1(),
      highWater: rawLoadedEnvelopeV1(1_048_577, "base64url:"),
      accountState: Object.freeze({ legacy: true }),
    });
    await expectRawQuotaCutPreflightRejectionV1(cutFlood.value);
    expect(cutFlood.ownKeys).not.toHaveBeenCalled();
  });

  it("snapshots a length-zero raw array without enumerating huge named properties", async () => {
    const arrayFlood = millionExtraNameFloodV1([]);
    const rawCut: Record<string, unknown> = {
      ...emptyQuotaCutV1(),
      events: arrayFlood.value,
      highWater: rawLoadedEnvelopeV1(1_048_577, "base64url:"),
    };
    await expectRawQuotaCutPreflightRejectionV1(rawCut);
    expect(arrayFlood.ownKeys).not.toHaveBeenCalled();
  });

  it("snapshots a length-one raw array without enumerating huge named properties", async () => {
    const arrayFlood = millionExtraNameFloodV1([
      rawLoadedEnvelopeV1(1_048_577, "base64url:"),
    ]);
    const rawCut: Record<string, unknown> = {
      ...emptyQuotaCutV1(),
      reservations: arrayFlood.value,
    };
    await expectRawQuotaCutPreflightRejectionV1(rawCut);
    expect(arrayFlood.ownKeys).not.toHaveBeenCalled();
  });

  it("ignores hostile thenable returns from both observation hosts", async () => {
    const hostState = historyQuotaHostV1(emptyQuotaCutV1());
    const originalCutCapture = hostState.captureCompleteQuotaCut;
    const originalBoundsCapture = hostState.captureRetainedArtifactUpperBounds;
    const cutReturn = hostileThenableReturnV1();
    const boundsReturn = hostileThenableReturnV1();
    hostState.host.captureCompleteQuotaCut = vi.fn((input) => {
      originalCutCapture(input);
      return cutReturn.value;
    });
    hostState.host.captureRetainedArtifactUpperBounds = vi.fn((input) => {
      originalBoundsCapture(input);
      return boundsReturn.value;
    });
    const { capability } = machineV1(hostState.host);
    const closure = sourceClosureV1();
    const budgets = budgetsV1();
    await expect(
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunAndHistoryQuotaSizingInternalV1(
        {
          quotaMachineCapability: capability,
          completeSourceReadClosure: closure,
          migrationBudgets: budgets,
          migrationBudgetsDigest:
            deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationBudgetsDigestReferenceCandidateV1(
              budgets,
            ),
        },
      ),
    ).resolves.toMatchObject({ historyQuotaSizingDigest: expect.any(String) });
    await expect(
      captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutInternalV1(
        { quotaMachineCapability: capability, phase: "pre" },
      ),
    ).resolves.toMatchObject({ phase: "pre" });
    expect(cutReturn.get).not.toHaveBeenCalled();
    expect(boundsReturn.get).not.toHaveBeenCalled();
  });

  it.each(["forged", "copy_with_extra", "proxy"] as const)(
    "rejects a %s quota-cut delivery capability without inspecting it",
    async (variant) => {
      const hostState = historyQuotaHostV1(emptyQuotaCutV1());
      const proxyGet = vi.fn();
      const proxyOwnKeys = vi.fn((): (string | symbol)[] => []);
      hostState.host.captureCompleteQuotaCut = vi.fn((input) => {
        const genuine =
          mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCapabilityInternalV1(
            input.completeQuotaCutMintChallenge,
            emptyQuotaCutV1(),
          );
        const candidate = variant === "forged"
          ? Object.freeze(Object.create(null))
          : variant === "copy_with_extra"
            ? Object.freeze({ ...genuine, legacy: true })
            : new Proxy(genuine, {
                get: proxyGet,
                ownKeys: proxyOwnKeys,
              });
        try {
          input.deliverCompleteQuotaCutCapability(candidate as never);
        } catch {
          // The operation-owned delivery promise carries the same rejection.
        }
      });
      const { capability } = machineV1(hostState.host);
      await expect(
        captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutInternalV1(
          { quotaMachineCapability: capability, phase: "pre" },
        ),
      ).rejects.toMatchObject({ reason: "quota_ledger_integrity_failed" });
      expect(proxyGet).not.toHaveBeenCalled();
      expect(proxyOwnKeys).not.toHaveBeenCalled();
      expect(hostState.verifyQuotaHighWaterToken).not.toHaveBeenCalled();
    },
  );

  it("burns a delivered quota-cut capability before replay", async () => {
    const hostState = historyQuotaHostV1(emptyQuotaCutV1());
    let replayError: unknown;
    hostState.host.captureCompleteQuotaCut = vi.fn((input) => {
      const capability =
        mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCapabilityInternalV1(
          input.completeQuotaCutMintChallenge,
          emptyQuotaCutV1(),
        );
      input.deliverCompleteQuotaCutCapability(capability);
      try {
        input.deliverCompleteQuotaCutCapability(capability);
      } catch (error) {
        replayError = error;
      }
    });
    const { capability } = machineV1(hostState.host);
    await expect(
      captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutInternalV1(
        { quotaMachineCapability: capability, phase: "pre" },
      ),
    ).resolves.toMatchObject({ phase: "pre" });
    expect(replayError).toBeInstanceOf(TypeError);
  });

  it("rejects a quota-cut capability across machine, cohort, and Identity", async () => {
    let pendingInput:
      | Parameters<
          ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1["captureCompleteQuotaCut"]
        >[0]
      | undefined;
    let foreignCapability: unknown;
    const sourceHost = historyQuotaHostV1(emptyQuotaCutV1());
    sourceHost.host.captureCompleteQuotaCut = vi.fn((input) => {
      pendingInput = input;
      foreignCapability =
        mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCapabilityInternalV1(
          input.completeQuotaCutMintChallenge,
          emptyQuotaCutV1(),
        );
    });
    const sourceMachine = machineV1(sourceHost.host);
    const pending =
      captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutInternalV1(
        { quotaMachineCapability: sourceMachine.capability, phase: "pre" },
      );

    const targetHost = historyQuotaHostV1(emptyQuotaCutV1());
    targetHost.host.captureCompleteQuotaCut = vi.fn((input) => {
      input.deliverCompleteQuotaCutCapability(foreignCapability as never);
    });
    const otherIdentity = InstallationIdentityGenerationIdV1Schema.parse(
      "installation-identity-generation:abcdef0123456789abcdef",
    );
    const targetMachine = machineV1(targetHost.host, {
      cohortIdentity: Object.freeze({ cohort: "other" }),
      identity: otherIdentity,
    });
    await expect(
      captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutInternalV1(
        { quotaMachineCapability: targetMachine.capability, phase: "pre" },
      ),
    ).rejects.toMatchObject({ reason: "quota_ledger_integrity_failed" });
    if (pendingInput === undefined) throw new TypeError("missing source callback");
    pendingInput.deliverCompleteQuotaCutCapability(foreignCapability as never);
    await expect(pending).resolves.toMatchObject({ phase: "pre" });
  });

  it("rejects a pre-phase quota-cut capability at a post-phase callback", async () => {
    let foreignCapability: unknown;
    let pendingInput:
      | Parameters<
          ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaObservationHostInternalV1["captureCompleteQuotaCut"]
        >[0]
      | undefined;
    const foreignHost = historyQuotaHostV1(emptyQuotaCutV1());
    foreignHost.host.captureCompleteQuotaCut = vi.fn((input) => {
      pendingInput = input;
      foreignCapability =
        mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCapabilityInternalV1(
          input.completeQuotaCutMintChallenge,
          emptyQuotaCutV1(),
        );
    });
    const foreignMachine = machineV1(foreignHost.host);
    const pending =
      captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutInternalV1(
        { quotaMachineCapability: foreignMachine.capability, phase: "pre" },
      );

    let crossPhase = false;
    const targetHost = historyQuotaHostV1(emptyQuotaCutV1());
    targetHost.host.captureCompleteQuotaCut = vi.fn((input) => {
      if (crossPhase) {
        input.deliverCompleteQuotaCutCapability(foreignCapability as never);
        return;
      }
      input.deliverCompleteQuotaCutCapability(
        mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCapabilityInternalV1(
          input.completeQuotaCutMintChallenge,
          emptyQuotaCutV1(),
        ),
      );
    });
    const targetMachine = machineV1(targetHost.host);
    const pre =
      await captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutInternalV1(
        { quotaMachineCapability: targetMachine.capability, phase: "pre" },
      );
    crossPhase = true;
    await expect(
      captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostQuotaContinuityInternalV1(
        { quotaMachineCapability: targetMachine.capability, preContinuity: pre },
      ),
    ).rejects.toMatchObject({ reason: "quota_ledger_integrity_failed" });
    if (pendingInput === undefined) throw new TypeError("missing foreign callback");
    pendingInput.deliverCompleteQuotaCutCapability(foreignCapability as never);
    await expect(pending).resolves.toMatchObject({ phase: "pre" });
  });

  it("rejects retained bounds accessors without invoking them", async () => {
    const projection = retainedArtifactProjectionV1();
    const getter = vi.fn(() => 0);
    Object.defineProperty(projection.retainedArtifactUpperBounds[0], "artifactCount", {
      enumerable: true,
      configurable: true,
      get: getter,
    });
    const hostState = historyQuotaHostV1(emptyQuotaCutV1());
    hostState.host.captureRetainedArtifactUpperBounds = vi.fn((input) => {
      mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRetainedArtifactUpperBoundsCapabilityInternalV1(
        input.retainedArtifactUpperBoundsMintChallenge,
        projection,
      );
    });
    const { capability } = machineV1(hostState.host);
    const closure = sourceClosureV1();
    const budgets = budgetsV1();
    await expect(
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunAndHistoryQuotaSizingInternalV1(
        {
          quotaMachineCapability: capability,
          completeSourceReadClosure: closure,
          migrationBudgets: budgets,
          migrationBudgetsDigest:
            deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationBudgetsDigestReferenceCandidateV1(
              budgets,
            ),
        },
      ),
    ).rejects.toMatchObject({ reason: "budget_exceeded" });
    expect(getter).not.toHaveBeenCalled();
  });

  it("detaches exact11 bounds while ignoring unreachable extra names", async () => {
    const projection = retainedArtifactProjectionV1();
    const migrationPlan = projection.retainedArtifactUpperBounds[2]!;
    const legacyGetter = vi.fn(() => {
      throw new Error("legacy extra field must not be read");
    });
    Object.defineProperty(migrationPlan, "legacy", {
      enumerable: true,
      configurable: true,
      get: legacyGetter,
    });
    const arrayFlood = millionExtraNameFloodV1(
      projection.retainedArtifactUpperBounds,
    );
    const projectionFlood = millionExtraNameFloodV1({
      ...projection,
      retainedArtifactUpperBounds: arrayFlood.value,
      legacyProjection: true,
    });
    const hostState = historyQuotaHostV1(emptyQuotaCutV1());
    hostState.host.captureRetainedArtifactUpperBounds = vi.fn((input) => {
      const capability =
        mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalRetainedArtifactUpperBoundsCapabilityInternalV1(
          input.retainedArtifactUpperBoundsMintChallenge,
          projectionFlood.value,
        );
      migrationPlan.artifactCount = 9;
      migrationPlan.canonicalEnvelopeBytesUpperBoundTotal = 9;
      input.deliverRetainedArtifactUpperBoundsCapability(capability);
    });
    const { capability } = machineV1(hostState.host);
    const closure = sourceClosureV1();
    const budgets = budgetsV1();
    const sizing =
      await deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunAndHistoryQuotaSizingInternalV1(
        {
          quotaMachineCapability: capability,
          completeSourceReadClosure: closure,
          migrationBudgets: budgets,
          migrationBudgetsDigest:
            deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationBudgetsDigestReferenceCandidateV1(
              budgets,
            ),
        },
      );
    expect(sizing.sourceDryRunCut.retainedArtifactUpperBounds[2]).toMatchObject({
      artifactCount: 1,
      canonicalEnvelopeBytesUpperBoundTotal: 4_194_304,
    });
    expect(projectionFlood.ownKeys).not.toHaveBeenCalled();
    expect(arrayFlood.ownKeys).not.toHaveBeenCalled();
    expect(legacyGetter).not.toHaveBeenCalled();
  });

  it.each(["ledger", "high_water"] as const)(
    "rejects a thenable %s verifier result without reading then",
    async (kind) => {
      const hostile = hostileThenableReturnV1();
      const cut = kind === "ledger" ? singleReservedQuotaCutV1() : emptyQuotaCutV1();
      const hostState = historyQuotaHostV1(cut as never);
      if (kind === "ledger") {
        hostState.host.verifyQuotaLedgerRecordToken = vi.fn(
          () => hostile.value as never,
        );
      } else {
        hostState.host.verifyQuotaHighWaterToken = vi.fn(
          () => hostile.value as never,
        );
      }
      const { capability } = machineV1(hostState.host);
      await expect(
        captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutInternalV1(
          { quotaMachineCapability: capability, phase: "pre" },
        ),
      ).rejects.toMatchObject({ reason: "quota_ledger_integrity_failed" });
      expect(hostile.get).not.toHaveBeenCalled();
    },
  );

  it("keeps every quota Promise fulfillment nonthenable under prototype poisoning", async () => {
    const previousThen = Object.getOwnPropertyDescriptor(Object.prototype, "then");
    let reads = 0;
    const hostState = historyQuotaHostV1(emptyQuotaCutV1());
    const { capability } = machineV1(hostState.host);
    const closure = sourceClosureV1();
    const budgets = budgetsV1();
    try {
      Object.defineProperty(Object.prototype, "then", {
        configurable: true,
        get() {
          reads += 1;
          throw new Error("prototype then must not be read");
        },
      });
      await deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunAndHistoryQuotaSizingInternalV1(
        {
          quotaMachineCapability: capability,
          completeSourceReadClosure: closure,
          migrationBudgets: budgets,
          migrationBudgetsDigest:
            deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationBudgetsDigestReferenceCandidateV1(
              budgets,
            ),
        },
      );
      const pre =
        await captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutInternalV1(
          { quotaMachineCapability: capability, phase: "pre" },
        );
      await captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostQuotaContinuityInternalV1(
        { quotaMachineCapability: capability, preContinuity: pre },
      );
    } finally {
      if (previousThen === undefined) {
        delete (Object.prototype as { then?: unknown }).then;
      } else {
        Object.defineProperty(Object.prototype, "then", previousThen);
      }
    }
    expect(reads).toBe(0);
  });

  it("accepts empty genesis, derives exact11 sizing/normal admission, and proves unchanged post cut", async () => {
    const cut = emptyQuotaCutV1();
    const hostState = historyQuotaHostV1(cut);
    const { capability } = machineV1(hostState.host);
    const closure = sourceClosureV1();
    const budgets = budgetsV1();
    const migrationBudgetsDigest =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationBudgetsDigestReferenceCandidateV1(
        budgets,
      );
    const sizing =
      await deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunAndHistoryQuotaSizingInternalV1(
        {
          quotaMachineCapability: capability,
          completeSourceReadClosure: closure,
          migrationBudgets: budgets,
          migrationBudgetsDigest,
        },
      );
    expect(sizing.sourceDryRunCut.retainedArtifactUpperBounds).toHaveLength(11);
    expect(sizing.sourceDryRunCut.retainedArtifactUpperBounds[2]).toMatchObject({
      artifactKind: "migration_plan",
      artifactCount: 1,
      canonicalEnvelopeBytesUpperBoundTotal: 4_194_304,
    });
    expect(
      sizing.historyQuotaSizing.journalChargeAmounts
        .reservedHistoryLogicalBytes,
    ).toBe(4_194_304);
    const pre =
      await captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutInternalV1(
        { quotaMachineCapability: capability, phase: "pre" },
      );
    expect(pre.quotaSnapshot).toMatchObject({
      accountCount: 0,
      reservationRecordCount: 0,
      eventCount: 0,
      receiptCount: 0,
      futureTerminalTransitionEscrowCount: 0,
    });
    expect(JSON.stringify(pre)).not.toContain("hmac-sha256:");
    expect(JSON.stringify(pre)).not.toContain("base64url:");
    const admission =
      deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaAdmissionInternalV1(
        {
          quotaMachineCapability: capability,
          completeQuotaCut: pre,
          historyQuotaSizing: sizing.historyQuotaSizing,
          historyQuotaSizingDigest: sizing.historyQuotaSizingDigest,
          admissionClass: "normal",
        },
      );
    expect(admission.historyQuotaAdmission).toMatchObject({
      mode: "same_installation_identity",
      admissionClass: "normal",
      decision: "reference_admissible_at_captured_snapshot",
      prospectiveChargedUsage: {
        reservedAccountCount: 1,
        chargedMigrationCount: 1,
      },
      controlUpperBounds: {
        postReserveFutureTerminalTransitionEscrowCount: 3,
        prospectiveEventCountIncludingEscrow: 4,
        prospectiveReceiptCountIncludingEscrow: 4,
        prospectiveReservationRecordCount: 1,
      },
    });
    const continuity =
      await captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPostQuotaContinuityInternalV1(
        { quotaMachineCapability: capability, preContinuity: pre },
      );
    expect(continuity).toMatchObject({
      equality: "exact",
      preSnapshotContentDigest: pre.quotaSnapshot.quotaSnapshotContentDigest,
      postSnapshotContentDigest: pre.quotaSnapshot.quotaSnapshotContentDigest,
    });
    expect(hostState.captureRetainedArtifactUpperBounds).toHaveBeenCalledTimes(1);
    expect(hostState.captureCompleteQuotaCut).toHaveBeenCalledTimes(2);
    expect(hostState.verifyQuotaHighWaterToken).toHaveBeenCalledTimes(2);
    expect(hostState.verifyQuotaLedgerRecordToken).not.toHaveBeenCalled();
  });

  it("claims pre capture before await and rejects a sibling concurrent read", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const cut = emptyQuotaCutV1();
    const hostState = historyQuotaHostV1(cut);
    hostState.host.captureCompleteQuotaCut = vi.fn((input) => {
      void gate.then(() => {
        input.deliverCompleteQuotaCutCapability(
          mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutCapabilityInternalV1(
            input.completeQuotaCutMintChallenge,
            structuredClone(cut),
          ),
        );
      });
    });
    const { capability } = machineV1(hostState.host);
    const first =
      captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutInternalV1(
        { quotaMachineCapability: capability, phase: "pre" },
      );
    const sibling =
      captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutInternalV1(
        { quotaMachineCapability: capability, phase: "pre" },
      );
    await expect(sibling).rejects.toMatchObject({
      reason: "capability_invalid",
    });
    release();
    await expect(first).resolves.toMatchObject({ phase: "pre" });
  });

  it("rejects authenticated high-water claims that do not match the complete empty sets", async () => {
    const cut = emptyQuotaCutV1((payload) => {
      payload.eventSetDigest = digest("f");
    });
    const { host } = historyQuotaHostV1(cut);
    const { capability } = machineV1(host);
    await expect(
      captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutInternalV1(
        { quotaMachineCapability: capability, phase: "pre" },
      ),
    ).rejects.toMatchObject({
      stage: "quota_reference_snapshot",
      reason: "quota_ledger_integrity_failed",
    });
  });

  it("replays one authenticated reserve event/receipt and closes every account anchor", async () => {
    const cut = singleReservedQuotaCutV1();
    const hostState = historyQuotaHostV1(cut as never);
    const { capability } = machineV1(hostState.host);
    const pre =
      await captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutInternalV1(
        { quotaMachineCapability: capability, phase: "pre" },
      );
    expect(pre.quotaSnapshot).toMatchObject({
      accountCount: 1,
      reservationRecordCount: 1,
      eventCount: 1,
      receiptCount: 1,
      futureTerminalTransitionEscrowCount: 3,
      usage: {
        reservedAccountCount: 1,
        chargedMigrationCount: 1,
        reservedHistoryLogicalBytes: 10,
        chargedHistoryLogicalBytes: 10,
      },
    });
    expect(hostState.verifyQuotaLedgerRecordToken).toHaveBeenCalledTimes(3);
    expect(hostState.verifyQuotaHighWaterToken).toHaveBeenCalledTimes(1);
  });

  it("rejects ledger/high-water missing, extra, reorder, duplicate, and sibling variants", async () => {
    const base = reservedThenNotCommittedQuotaCutV1();
    const validHost = historyQuotaHostV1(base as never);
    await expect(
      captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutInternalV1(
        {
          quotaMachineCapability: machineV1(validHost.host).capability,
          phase: "pre",
        },
      ),
    ).resolves.toMatchObject({ quotaSnapshot: { receiptCount: 2 } });

    const thirdReceipt = rebuildQuotaLoadedEnvelopeV1(
      base.receipts[1]!,
      "receipt",
      (envelope) => {
        envelope.receiptOrdinal = 3;
        const payload = envelope.payload as Record<string, unknown>;
        payload.receiptOrdinal = 3;
        payload.operationNonce = "11223344556677889900aabbccddeeff";
        payload.requestContentDigest = digest("0");
        payload.accountReferenceDigest =
          deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceDigestReferenceCandidateV1(
            {
              installationIdentityGenerationId,
              reservationOrdinal: 2,
              createdByOperationNonce: payload.operationNonce,
            },
          );
        payload.observedPreHighWaterContentDigest =
          decodedCanonicalEnvelopeV1<{ contentDigest: ContentDigestV1 }>(
            base.highWater,
          ).contentDigest;
      },
      digest("6"),
    );
    const siblingReceipt = rebuildQuotaLoadedEnvelopeV1(
      base.receipts[1]!,
      "receipt",
      (envelope) => {
        const payload = envelope.payload as Record<string, unknown>;
        payload.requestContentDigest = digest("1");
      },
      digest("7"),
    );
    const variants = [
      ["ledger missing", { ...base, receipts: base.receipts.slice(0, 1) }],
      ["ledger extra", { ...base, receipts: [...base.receipts, thirdReceipt] }],
      ["ledger reorder", { ...base, receipts: [...base.receipts].reverse() }],
      [
        "ledger duplicate",
        {
          ...base,
          receipts: [base.receipts[0]!, structuredClone(base.receipts[0]!)],
        },
      ],
      [
        "ledger sibling",
        { ...base, receipts: [...base.receipts, siblingReceipt] },
      ],
      [
        "high-water missing set member",
        {
          ...base,
          highWater: rebuildQuotaLoadedEnvelopeV1(
            base.highWater,
            "high_water",
            (envelope) => {
              const payload = envelope.payload as Record<string, unknown>;
              payload.reservationRecordCount = 0;
            },
          ),
        },
      ],
      [
        "high-water extra set member",
        {
          ...base,
          highWater: rebuildQuotaLoadedEnvelopeV1(
            base.highWater,
            "high_water",
            (envelope) => {
              const payload = envelope.payload as Record<string, unknown>;
              payload.reservationRecordCount = 2;
            },
          ),
        },
      ],
    ] as const;

    for (const [label, cut] of variants) {
      const { host } = historyQuotaHostV1(cut as never);
      await expect(
        captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutInternalV1(
          {
            quotaMachineCapability: machineV1(host).capability,
            phase: "pre",
          },
        ),
        label,
      ).rejects.toMatchObject({ reason: "quota_ledger_integrity_failed" });
    }
  });

  it("rejects account/reservation anchors, not-committed leakage, and noncanonical raw roundtrips", async () => {
    const committed = singleReservedQuotaCutV1();
    const committedVariants = [
      [
        "account position ordinal",
        (envelope: Record<string, unknown>) => {
          const payload = envelope.payload as Record<string, unknown>;
          const account = payload.account as Record<string, unknown>;
          account.accountOrdinal = 1;
        },
      ],
      [
        "reservation ordinal anchor",
        (envelope: Record<string, unknown>) => {
          const payload = envelope.payload as Record<string, unknown>;
          const account = payload.account as Record<string, unknown>;
          account.reservationOrdinal = 2;
          account.accountReferenceDigest =
            deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceDigestReferenceCandidateV1(
              {
                installationIdentityGenerationId,
                reservationOrdinal: 2,
                createdByOperationNonce: account.createdByOperationNonce,
              },
            );
        },
      ],
      [
        "creation nonce anchor",
        (envelope: Record<string, unknown>) => {
          const payload = envelope.payload as Record<string, unknown>;
          const account = payload.account as Record<string, unknown>;
          account.createdByOperationNonce =
            "1234567890abcdef1234567890abcdef";
          account.accountReferenceDigest =
            deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalQuotaAccountReferenceDigestReferenceCandidateV1(
              {
                installationIdentityGenerationId,
                reservationOrdinal: account.reservationOrdinal,
                createdByOperationNonce: account.createdByOperationNonce,
              },
            );
        },
      ],
      [
        "account reference digest",
        (envelope: Record<string, unknown>) => {
          const payload = envelope.payload as Record<string, unknown>;
          const account = payload.account as Record<string, unknown>;
          account.accountReferenceDigest = digest("f");
        },
      ],
    ] as const;
    const variants: readonly (readonly [string, unknown])[] = [
      ...committedVariants.map(([label, mutate]) => [
        label,
        {
          ...committed,
          reservations: [
            rebuildQuotaLoadedEnvelopeV1(
              committed.reservations[0]!,
              "reservation",
              mutate,
            ),
          ],
        },
      ] as const),
      [
        "committed receipt account-state anchor",
        {
          ...committed,
          receipts: [
            rebuildQuotaLoadedEnvelopeV1(
              committed.receipts[0]!,
              "receipt",
              (envelope) => {
                const payload = envelope.payload as Record<string, unknown>;
                const outcome = payload.outcome as Record<string, unknown>;
                outcome.postAccountStateContentDigest = digest("f");
              },
            ),
          ],
        },
      ],
      [
        "not-committed prospective ordinal",
        reservedThenNotCommittedQuotaCutV1({
          prospectiveReservationOrdinal: 3,
        }),
      ],
      [
        "not-committed prospective digest",
        reservedThenNotCommittedQuotaCutV1({ wrongProspectiveDigest: true }),
      ],
      [
        "not-committed post-account leak",
        reservedThenNotCommittedQuotaCutV1({ postAccountLeak: true }),
      ],
      [
        "raw decoded roundtrip",
        {
          ...committed,
          receipts: [noncanonicalRoundTripShellV1(committed.receipts[0]!)],
        },
      ],
    ];

    for (const [label, cut] of variants) {
      const { host } = historyQuotaHostV1(cut as never);
      await expect(
        captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutInternalV1(
          {
            quotaMachineCapability: machineV1(host).capability,
            phase: "pre",
          },
        ),
        label,
      ).rejects.toMatchObject({ reason: "quota_ledger_integrity_failed" });
    }
  });

  it.each([
    ["wrong predecessor", { wrongPredecessor: true }],
    ["wrong correlated nonce", { wrongReceiptNonce: true }],
    ["wrong account anchor", { wrongReceiptAccountReference: true }],
  ])("rejects a fully re-digested %s", async (_label, mutation) => {
    const cut = singleReservedQuotaCutV1(mutation);
    const { host } = historyQuotaHostV1(cut as never);
    const { capability } = machineV1(host);
    await expect(
      captureProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalCompleteQuotaCutInternalV1(
        { quotaMachineCapability: capability, phase: "pre" },
      ),
    ).rejects.toMatchObject({
      reason: "quota_ledger_integrity_failed",
    });
  });

  it("rejects missing, duplicate, and permuted exact11 retained-artifact projections", async () => {
    const projectionVariants = [
      [
        "missing",
        (entries: ReturnType<typeof retainedArtifactProjectionV1>["retainedArtifactUpperBounds"]) =>
          entries.slice(0, 10),
      ],
      [
        "duplicate",
        (entries: ReturnType<typeof retainedArtifactProjectionV1>["retainedArtifactUpperBounds"]) =>
          [entries[0]!, structuredClone(entries[0]!), ...entries.slice(2)],
      ],
      [
        "permuted",
        (entries: ReturnType<typeof retainedArtifactProjectionV1>["retainedArtifactUpperBounds"]) =>
          [entries[1]!, entries[0]!, ...entries.slice(2)],
      ],
    ] as const;
    const closure = sourceClosureV1();
    const budgets = budgetsV1();
    for (const [label, mutate] of projectionVariants) {
      const projection = retainedArtifactProjectionV1();
      projection.retainedArtifactUpperBounds = mutate(
        projection.retainedArtifactUpperBounds,
      ) as never;
      const { host } = historyQuotaHostV1(
        emptyQuotaCutV1(),
        emptyQuotaCutV1(),
        projection,
      );
      await expect(
        deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceDryRunAndHistoryQuotaSizingInternalV1(
          {
            quotaMachineCapability: machineV1(host).capability,
            completeSourceReadClosure: closure,
            migrationBudgets: budgets,
            migrationBudgetsDigest:
              deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalMigrationBudgetsDigestReferenceCandidateV1(
                budgets,
              ),
          },
        ),
        label,
      ).rejects.toMatchObject({ reason: "budget_exceeded" });
    }
  });
});
