import {
  createProviderAcceptanceCompareAppendReceiptTokenMessageV1,
  createProviderAcceptanceCurrentVersionTokenMessageV1,
  createProviderAcceptanceStateTokenMessageV1,
  deriveProviderAcceptanceCompareAppendReceiptContentDigestV1,
  deriveProviderAcceptanceCompareAppendRequestContentDigestV1,
  deriveProviderAcceptanceGenerationSetDigestV1,
  deriveProviderAcceptanceHighWaterContentDigestV1,
  ProviderAcceptanceCompareAppendReceiptEnvelopeV1Schema,
  ProviderAcceptanceCompareAppendReceiptV1Schema,
  ProviderAcceptanceCompareAppendRequestV1Schema,
  ProviderAcceptanceCompareAppendResultV1Schema,
  ProviderAcceptanceCurrentReadV1Schema,
  ProviderAcceptanceGenerationEnumerationEntryV1Schema,
  ProviderAcceptanceGenerationEnumerationV1Schema,
  ProviderAcceptanceHighWaterEnvelopeV1Schema,
  ProviderAcceptanceStateEnvelopeV1Schema,
  type ProviderAcceptanceCompareAppendReceiptEnvelopeV1,
  type ProviderAcceptanceCompareAppendRequestV1,
  type ProviderAcceptanceCompareAppendResultV1,
  type ProviderAcceptanceCurrentReadV1,
  type ProviderAcceptanceGenerationEnumerationEntryV1,
  type ProviderAcceptanceHighWaterEnvelopeV1,
  type ProviderAcceptanceStateEnvelopeV1,
} from "@understand-code/durable-object-provider-contracts/provider-acceptance";
import type { InstallationIdentityGenerationIdV1 } from "@understand-code/durable-object-provider-contracts/primitives";
import { PROVIDER_TRUST_HISTORY_POLICY_V1 } from "@understand-code/durable-object-provider-contracts";

import { withProviderAcceptanceAuthorityCrossProcessLockInternalV1 } from "./cross-process-lock-internal.js";
import {
  digestDomainInternalV1,
  hmacTokenForDomainInternalV1,
  hmacTokenForMessageInternalV1,
  sha256DigestInternalV1,
  verifyHmacTokenForDomainInternalV1,
  verifyHmacTokenForMessageInternalV1,
} from "./crypto-internal.js";
import { ProviderAcceptanceAuthorityErrorV1 } from "./errors.js";
import {
  canonicalAuthorityBytesInternalV1,
  discardDeterministicAuthorityStageInternalV1,
  isMissingFileInternalV1,
  normalizeDurableAuthorityStagePreparationInternalV1,
  parseCanonicalAuthorityBytesInternalV1,
  prepareDurableAuthorityStageInternalV1,
  publishPreparedAuthorityStageInternalV1,
  readCheckedAuthorityFileInternalV1,
  replaceDurableAuthoritySnapshotInternalV1,
  type ProviderAcceptanceAuthorityDurabilityHooksInternalV1,
} from "./filesystem-internal.js";
import {
  openProviderAcceptanceInstallationIdentityInternalV1,
  type ProviderAcceptanceInstallationIdentityInternalV1,
} from "./key-custody-internal.js";
import {
  PROVIDER_ACCEPTANCE_AUTHORITY_LOGICAL_LOCATORS_V1,
  providerAcceptanceGenerationLogicalLocatorInternalV1,
  providerAcceptanceReceiptLogicalLocatorInternalV1,
  type ProviderAcceptanceAuthorityLayoutInternalV1,
} from "./platform-layout.js";

const SNAPSHOT_PROFILE_V1 =
  "understand_code_provider_acceptance_authority_snapshot_v1";
const SNAPSHOT_DIGEST_DOMAIN_V1 =
  "understand-code-provider-acceptance-authority-snapshot-v1";
const SNAPSHOT_TOKEN_DOMAIN_V1 =
  "understand-code-provider-acceptance-authority-snapshot-token-v1";
const TRANSACTION_EVENT_DIGEST_DOMAIN_V1 =
  "understand-code-provider-acceptance-authority-transaction-event-v1";
const TRANSACTION_EVENT_TOKEN_DOMAIN_V1 =
  "understand-code-provider-acceptance-authority-transaction-event-token-v1";
const MAX_SNAPSHOT_PHYSICAL_BYTES_V1 = 300 * 1024 * 1024;
const GENESIS_CHAIN_V1 = "genesis" as const;

interface StoredGenerationInternalV1 {
  readonly logicalLocator: string;
  readonly logicalBytes: number;
  readonly envelope: ProviderAcceptanceStateEnvelopeV1;
}

interface StoredReceiptInternalV1 {
  readonly logicalLocator: string;
  readonly logicalBytes: number;
  readonly envelope: ProviderAcceptanceCompareAppendReceiptEnvelopeV1;
}

interface TransactionEventFieldsInternalV1 {
  readonly transactionRevision: number;
  readonly previousEventDigest: typeof GENESIS_CHAIN_V1 | string;
  readonly operationNonce: string;
  readonly requestContentDigest: string;
  readonly receiptContentDigest: string;
  readonly resultingHighWaterContentDigest: string | null;
}

interface TransactionEventInternalV1 extends TransactionEventFieldsInternalV1 {
  readonly eventDigest: string;
  readonly eventToken: string;
}

interface SnapshotAccountingInternalV1 {
  readonly generationCount: number;
  readonly receiptCount: number;
  readonly generationLogicalBytes: number;
  readonly receiptLogicalBytes: number;
  readonly currentLogicalBytes: number;
  readonly acceptanceLocalContributionLogicalBytes: number;
}

interface SnapshotPayloadInternalV1 {
  readonly schemaVersion: 1;
  readonly profile: typeof SNAPSHOT_PROFILE_V1;
  readonly installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1;
  readonly snapshotRevision: number;
  readonly previousSnapshotContentDigest: typeof GENESIS_CHAIN_V1 | string;
  readonly generations: readonly StoredGenerationInternalV1[];
  readonly current: ProviderAcceptanceCurrentReadV1 | null;
  readonly receipts: readonly StoredReceiptInternalV1[];
  readonly transactions: readonly TransactionEventInternalV1[];
  readonly accounting: SnapshotAccountingInternalV1;
}

interface SnapshotEnvelopeInternalV1 {
  readonly payload: SnapshotPayloadInternalV1;
  readonly snapshotContentDigest: string;
  readonly snapshotToken: string;
}

interface LoadedSnapshotInternalV1 {
  readonly envelope: SnapshotEnvelopeInternalV1;
  readonly canonicalBytes: Buffer;
}

interface PublicationPinPayloadInternalV1 {
  readonly schemaVersion: 1;
  readonly profile:
    "understand_code_provider_acceptance_authority_publication_pin_v1";
  readonly publicationRevision: number;
  readonly snapshotRevision: number;
  readonly snapshotContentDigest: string;
  readonly snapshotTokenDigest: string;
  readonly previousPublicationContentDigest: typeof GENESIS_CHAIN_V1 | string;
}

interface PublicationPinEnvelopeInternalV1 {
  readonly payload: PublicationPinPayloadInternalV1;
  readonly publicationContentDigest: string;
  readonly publicationToken: string;
}

const PUBLICATION_PIN_PROFILE_V1 =
  "understand_code_provider_acceptance_authority_publication_pin_v1" as const;
const PUBLICATION_PIN_DIGEST_DOMAIN_V1 =
  "understand-code-provider-acceptance-authority-publication-pin-v1";
const PUBLICATION_PIN_TOKEN_DOMAIN_V1 =
  "understand-code-provider-acceptance-authority-publication-pin-token-v1";
const MAX_PUBLICATION_PIN_BYTES_V1 = 16 * 1024;

export type ProviderAcceptanceAuthorityCurrentReadResultInternalV1 =
  | Readonly<{ readonly state: "absent" }>
  | Readonly<{
      readonly state: "current";
      readonly current: ProviderAcceptanceCurrentReadV1;
    }>;

export interface ProviderAcceptanceAuthorityStoreOpenOptionsInternalV1
  extends ProviderAcceptanceAuthorityDurabilityHooksInternalV1 {
  readonly clock?: () => Date;
}

export interface ProviderAcceptanceAuthorityDoctorResultInternalV1 {
  readonly status: "ready" | "unprovisioned" | "integrity_failed";
  readonly authority: "installation_owner_candidate";
  readonly strongWrites: "locked";
  readonly namespace: "absent" | "current" | "unavailable";
  readonly snapshotRevision?: number;
  readonly generationCount?: number;
  readonly receiptCount?: number;
}

export interface ProviderAcceptanceAuthorityStoreInternalV1 {
  readonly authority: "installation_owner_candidate";
  readonly strongWrites: "locked";
  readonly readCurrent: () => Promise<
    ProviderAcceptanceAuthorityCurrentReadResultInternalV1
  >;
  readonly compareAppend: (
    request: unknown,
  ) => Promise<ProviderAcceptanceCompareAppendResultV1>;
  readonly doctor: () => Promise<ProviderAcceptanceAuthorityDoctorResultInternalV1>;
}

export interface ProviderAcceptanceAuthorityLockedCurrentViewCoreInternalV1 {
  readonly installationIdentityGenerationId:
    InstallationIdentityGenerationIdV1;
  readonly key: Uint8Array;
  readonly current: ProviderAcceptanceCurrentReadV1 | null;
  /**
   * Complete generation history after the Acceptance snapshot, chain, HMAC,
   * enumeration, and high-water closure have been verified under this lock.
   * This keyless projection is the only Acceptance material passed to the
   * strong-mutation trust verifier.
   */
  readonly verifiedGenerationEnvelopes:
    readonly ProviderAcceptanceStateEnvelopeV1[];
}

export interface ProviderAcceptanceAuthorityAdmissionInputInternalV1 {
  readonly generationCount: number;
  readonly receiptCount: number;
  readonly receiptLogicalBytes: number;
  readonly requestLogicalBytes: number;
  readonly acceptanceLocalContributionLogicalBytes: number;
  readonly admissionClass: "normal" | "emergency";
  readonly isExistingReplay: boolean;
}

export type ProviderAcceptanceAuthorityAdmissionResultInternalV1 =
  | Readonly<{ readonly admitted: true }>
  | Readonly<{
      readonly admitted: false;
      readonly reason:
        | "generation_count"
        | "receipt_count"
        | "single_receipt_bytes"
        | "receipt_bytes"
        | "acceptance_local_contribution_bytes";
    }>;

function nonNegativeSafeIntegerV1(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * Pure Acceptance-local classifier shared with bounded tests. The local
 * contribution check is necessary but not sufficient for the global 256 MiB
 * trust-history ceiling; this candidate has no authoritative retained-byte
 * source for Root, Registry, or Catalog history.
 */
export function classifyProviderAcceptanceAuthorityAdmissionInternalV1(
  input: ProviderAcceptanceAuthorityAdmissionInputInternalV1,
): ProviderAcceptanceAuthorityAdmissionResultInternalV1 {
  if (input.isExistingReplay) return Object.freeze({ admitted: true as const });
  if (
    !nonNegativeSafeIntegerV1(input.generationCount) ||
    !nonNegativeSafeIntegerV1(input.receiptCount) ||
    !nonNegativeSafeIntegerV1(input.receiptLogicalBytes) ||
    !nonNegativeSafeIntegerV1(input.requestLogicalBytes) ||
    !nonNegativeSafeIntegerV1(
      input.acceptanceLocalContributionLogicalBytes,
    )
  ) {
    return Object.freeze({ admitted: false as const, reason: "acceptance_local_contribution_bytes" as const });
  }
  const policy = PROVIDER_TRUST_HISTORY_POLICY_V1;
  const generationLimit = input.admissionClass === "normal"
    ? policy.maxAcceptanceGenerationCountPerInstallationIdentity -
      policy.normalUpdateEmergencyGenerationReserve
    : policy.maxAcceptanceGenerationCountPerInstallationIdentity;
  const receiptLimit = input.admissionClass === "normal"
    ? policy.maxAcceptanceCompareAppendReceiptCountPerInstallationIdentity -
      policy.normalUpdateEmergencyAcceptanceReceiptReserve
    : policy.maxAcceptanceCompareAppendReceiptCountPerInstallationIdentity;
  const receiptBytesLimit = input.admissionClass === "normal"
    ? policy.maxAcceptanceCompareAppendReceiptLogicalBytesPerInstallationIdentity -
      policy.normalUpdateEmergencyLogicalBytesReserve
    : policy.maxAcceptanceCompareAppendReceiptLogicalBytesPerInstallationIdentity;
  const acceptanceLocalContributionLimit = input.admissionClass === "normal"
    ? policy.maxTotalTrustHistoryLogicalBytesPerInstallationIdentity -
      policy.normalUpdateEmergencyLogicalBytesReserve
    : policy.maxTotalTrustHistoryLogicalBytesPerInstallationIdentity;
  if (input.generationCount > generationLimit) {
    return Object.freeze({ admitted: false as const, reason: "generation_count" as const });
  }
  if (input.receiptCount > receiptLimit) {
    return Object.freeze({ admitted: false as const, reason: "receipt_count" as const });
  }
  if (
    input.requestLogicalBytes >
      policy.maxSingleAcceptanceCompareAppendReceiptLogicalBytes
  ) {
    return Object.freeze({ admitted: false as const, reason: "single_receipt_bytes" as const });
  }
  if (input.receiptLogicalBytes > receiptBytesLimit) {
    return Object.freeze({ admitted: false as const, reason: "receipt_bytes" as const });
  }
  if (
    input.acceptanceLocalContributionLogicalBytes >
      acceptanceLocalContributionLimit
  ) {
    return Object.freeze({ admitted: false as const, reason: "acceptance_local_contribution_bytes" as const });
  }
  return Object.freeze({ admitted: true as const });
}

function exactRecordV1(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function sameJsonV1(left: unknown, right: unknown): boolean {
  return Buffer.compare(
    canonicalAuthorityBytesInternalV1(left),
    canonicalAuthorityBytesInternalV1(right),
  ) === 0;
}

function requiredGenerationFloorsV1(
  configuration: ProviderAcceptanceStateEnvelopeV1["payload"]["configuration"],
): SnapshotAccountingInternalV1 extends never ? never : Readonly<{
  rootMetadataGeneration: number;
  registryManifestGeneration: number;
  supportCatalogGeneration: number;
}> {
  if (configuration.state === "strong_ready") {
    return Object.freeze({
      rootMetadataGeneration:
        configuration.core.activeRootMetadata.rootGeneration,
      registryManifestGeneration:
        configuration.core.providerRegistryManifest.manifestGeneration,
      supportCatalogGeneration:
        configuration.core.providerSupportCatalog.catalogGeneration,
    });
  }
  if (configuration.state === "migration_only") {
    return Object.freeze({
      rootMetadataGeneration: configuration.activeRootMetadata.rootGeneration,
      registryManifestGeneration:
        configuration.providerRegistryManifest.manifestGeneration,
      supportCatalogGeneration:
        configuration.providerSupportCatalog.catalogGeneration,
    });
  }
  return Object.freeze({
    rootMetadataGeneration: configuration.activeRootMetadata.rootGeneration,
    registryManifestGeneration:
      configuration.lastAcceptedProviderRegistryManifest.manifestGeneration,
    supportCatalogGeneration:
      configuration.lastAcceptedProviderSupportCatalog.catalogGeneration,
  });
}

function calculateAccountingV1(input: Readonly<{
  generations: readonly StoredGenerationInternalV1[];
  current: ProviderAcceptanceCurrentReadV1 | null;
  receipts: readonly StoredReceiptInternalV1[];
}>): SnapshotAccountingInternalV1 {
  const generationLogicalBytes = input.generations.reduce(
    (sum, record) => sum + record.logicalBytes,
    0,
  );
  const receiptLogicalBytes = input.receipts.reduce(
    (sum, record) => sum + record.logicalBytes,
    0,
  );
  const currentLogicalBytes = input.current === null
    ? 0
    : canonicalAuthorityBytesInternalV1(input.current).byteLength;
  return Object.freeze({
    generationCount: input.generations.length,
    receiptCount: input.receipts.length,
    generationLogicalBytes,
    receiptLogicalBytes,
    currentLogicalBytes,
    acceptanceLocalContributionLogicalBytes:
      generationLogicalBytes + receiptLogicalBytes + currentLogicalBytes,
  });
}

function snapshotPayloadV1(input: Readonly<{
  identity: InstallationIdentityGenerationIdV1;
  previous: LoadedSnapshotInternalV1 | undefined;
  generations: readonly StoredGenerationInternalV1[];
  current: ProviderAcceptanceCurrentReadV1 | null;
  receipts: readonly StoredReceiptInternalV1[];
  transactions: readonly TransactionEventInternalV1[];
}>): SnapshotPayloadInternalV1 {
  return Object.freeze({
    schemaVersion: 1,
    profile: SNAPSHOT_PROFILE_V1,
    installationIdentityGenerationId: input.identity,
    snapshotRevision: input.receipts.length,
    previousSnapshotContentDigest:
      input.previous?.envelope.snapshotContentDigest ?? GENESIS_CHAIN_V1,
    generations: Object.freeze([...input.generations]),
    current: input.current,
    receipts: Object.freeze([...input.receipts]),
    transactions: Object.freeze([...input.transactions]),
    accounting: calculateAccountingV1(input),
  });
}

function signSnapshotV1(
  key: Uint8Array,
  payload: SnapshotPayloadInternalV1,
): SnapshotEnvelopeInternalV1 {
  const snapshotContentDigest = digestDomainInternalV1(
    SNAPSHOT_DIGEST_DOMAIN_V1,
    payload,
  );
  return Object.freeze({
    payload,
    snapshotContentDigest,
    snapshotToken: hmacTokenForDomainInternalV1(
      key,
      SNAPSHOT_TOKEN_DOMAIN_V1,
      { payload, snapshotContentDigest },
    ),
  });
}

function parseStoredGenerationV1(value: unknown): StoredGenerationInternalV1 {
  if (
    !exactRecordV1(value, ["logicalLocator", "logicalBytes", "envelope"]) ||
    typeof value.logicalLocator !== "string" ||
    !Number.isSafeInteger(value.logicalBytes) ||
    (value.logicalBytes as number) < 1
  ) throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
  const envelope = ProviderAcceptanceStateEnvelopeV1Schema.parse(value.envelope);
  const logicalBytes = canonicalAuthorityBytesInternalV1(envelope).byteLength;
  if (
    value.logicalLocator !==
      providerAcceptanceGenerationLogicalLocatorInternalV1(
        envelope.generationId,
      ) ||
    value.logicalBytes !== logicalBytes
  ) throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
  return Object.freeze({
    logicalLocator: value.logicalLocator,
    logicalBytes,
    envelope,
  });
}

function parseStoredReceiptV1(value: unknown): StoredReceiptInternalV1 {
  if (
    !exactRecordV1(value, ["logicalLocator", "logicalBytes", "envelope"]) ||
    typeof value.logicalLocator !== "string" ||
    !Number.isSafeInteger(value.logicalBytes) ||
    (value.logicalBytes as number) < 1
  ) throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
  const envelope =
    ProviderAcceptanceCompareAppendReceiptEnvelopeV1Schema.parse(value.envelope);
  const logicalBytes = canonicalAuthorityBytesInternalV1(envelope).byteLength;
  if (
    value.logicalLocator !==
      providerAcceptanceReceiptLogicalLocatorInternalV1(
        envelope.operationNonce,
      ) ||
    value.logicalBytes !== logicalBytes
  ) throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
  return Object.freeze({
    logicalLocator: value.logicalLocator,
    logicalBytes,
    envelope,
  });
}

function parseTransactionV1(value: unknown): TransactionEventInternalV1 {
  if (
    !exactRecordV1(value, [
      "transactionRevision",
      "previousEventDigest",
      "operationNonce",
      "requestContentDigest",
      "receiptContentDigest",
      "resultingHighWaterContentDigest",
      "eventDigest",
      "eventToken",
    ]) ||
    !Number.isSafeInteger(value.transactionRevision) ||
    (value.transactionRevision as number) < 1 ||
    typeof value.previousEventDigest !== "string" ||
    typeof value.operationNonce !== "string" ||
    !/^[0-9a-f]{32}$/u.test(value.operationNonce) ||
    typeof value.requestContentDigest !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(value.requestContentDigest) ||
    typeof value.receiptContentDigest !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(value.receiptContentDigest) ||
    !(
      value.resultingHighWaterContentDigest === null ||
      (typeof value.resultingHighWaterContentDigest === "string" &&
        /^sha256:[0-9a-f]{64}$/u.test(value.resultingHighWaterContentDigest))
    ) ||
    typeof value.eventDigest !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(value.eventDigest) ||
    typeof value.eventToken !== "string" ||
    !/^hmac-sha256:[0-9a-f]{64}$/u.test(value.eventToken)
  ) throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
  return Object.freeze(value as unknown as TransactionEventInternalV1);
}

function parseAccountingV1(value: unknown): SnapshotAccountingInternalV1 {
  const keys = [
    "generationCount",
    "receiptCount",
    "generationLogicalBytes",
    "receiptLogicalBytes",
    "currentLogicalBytes",
    "acceptanceLocalContributionLogicalBytes",
  ] as const;
  if (
    !exactRecordV1(value, keys) ||
    keys.some((key) =>
      !Number.isSafeInteger(value[key]) || (value[key] as number) < 0
    )
  ) throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
  return Object.freeze(value as unknown as SnapshotAccountingInternalV1);
}

function parseSnapshotEnvelopeV1(
  value: unknown,
  identity: ProviderAcceptanceInstallationIdentityInternalV1,
  key: Uint8Array,
): SnapshotEnvelopeInternalV1 {
  try {
    if (
      !exactRecordV1(value, [
        "payload",
        "snapshotContentDigest",
        "snapshotToken",
      ]) ||
      typeof value.snapshotContentDigest !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(value.snapshotContentDigest)
    ) throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
    const rawPayload = value.payload;
    if (
      !exactRecordV1(rawPayload, [
        "schemaVersion",
        "profile",
        "installationIdentityGenerationId",
        "snapshotRevision",
        "previousSnapshotContentDigest",
        "generations",
        "current",
        "receipts",
        "transactions",
        "accounting",
      ]) ||
      rawPayload.schemaVersion !== 1 ||
      rawPayload.profile !== SNAPSHOT_PROFILE_V1 ||
      rawPayload.installationIdentityGenerationId !==
        identity.installationIdentityGenerationId ||
      !Number.isSafeInteger(rawPayload.snapshotRevision) ||
      (rawPayload.snapshotRevision as number) < 1 ||
      typeof rawPayload.previousSnapshotContentDigest !== "string" ||
      !(
        rawPayload.previousSnapshotContentDigest === GENESIS_CHAIN_V1 ||
        /^sha256:[0-9a-f]{64}$/u.test(
          rawPayload.previousSnapshotContentDigest,
        )
      ) ||
      !Array.isArray(rawPayload.generations) ||
      !Array.isArray(rawPayload.receipts) ||
      !Array.isArray(rawPayload.transactions)
    ) throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
    const generations = rawPayload.generations.map(parseStoredGenerationV1);
    const receipts = rawPayload.receipts.map(parseStoredReceiptV1);
    const transactions = rawPayload.transactions.map(parseTransactionV1);
    const current = rawPayload.current === null
      ? null
      : ProviderAcceptanceCurrentReadV1Schema.parse(rawPayload.current);
    const payload: SnapshotPayloadInternalV1 = Object.freeze({
      schemaVersion: 1,
      profile: SNAPSHOT_PROFILE_V1,
      installationIdentityGenerationId:
        identity.installationIdentityGenerationId,
      snapshotRevision: rawPayload.snapshotRevision as number,
      previousSnapshotContentDigest:
        rawPayload.previousSnapshotContentDigest,
      generations: Object.freeze(generations),
      current,
      receipts: Object.freeze(receipts),
      transactions: Object.freeze(transactions),
      accounting: parseAccountingV1(rawPayload.accounting),
    });
    const snapshotContentDigest = digestDomainInternalV1(
      SNAPSHOT_DIGEST_DOMAIN_V1,
      payload,
    );
    if (
      value.snapshotContentDigest !== snapshotContentDigest ||
      !verifyHmacTokenForDomainInternalV1(
        key,
        SNAPSHOT_TOKEN_DOMAIN_V1,
        { payload, snapshotContentDigest },
        value.snapshotToken,
      )
    ) throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
    return Object.freeze({
      payload,
      snapshotContentDigest,
      snapshotToken: value.snapshotToken as string,
    });
  } catch (error) {
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1(
      "namespace_integrity_failed",
    );
  }
}

function verifyHighWaterTokenV1(
  key: Uint8Array,
  envelope: ProviderAcceptanceHighWaterEnvelopeV1,
): boolean {
  return verifyHmacTokenForMessageInternalV1(
    key,
    createProviderAcceptanceCurrentVersionTokenMessageV1(envelope),
    envelope.currentVersionToken,
  );
}

function verifySnapshotClosureV1(
  snapshot: SnapshotEnvelopeInternalV1,
  key: Uint8Array,
): void {
  const payload = snapshot.payload;
  if (
    payload.snapshotRevision !== payload.receipts.length ||
    payload.snapshotRevision !== payload.transactions.length ||
    (payload.snapshotRevision === 1) !==
      (payload.previousSnapshotContentDigest === GENESIS_CHAIN_V1)
  ) throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");

  for (const generation of payload.generations) {
    const exactLogicalBytes = canonicalAuthorityBytesInternalV1(
      generation.envelope,
    ).byteLength;
    if (
      generation.logicalBytes !== exactLogicalBytes ||
      exactLogicalBytes >
        PROVIDER_TRUST_HISTORY_POLICY_V1.maxSingleTrustEnvelopeLogicalBytes
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1(
        "namespace_integrity_failed",
      );
    }
  }
  for (const receipt of payload.receipts) {
    const exactLogicalBytes = canonicalAuthorityBytesInternalV1(
      receipt.envelope,
    ).byteLength;
    if (
      receipt.logicalBytes !== exactLogicalBytes ||
      exactLogicalBytes >
        PROVIDER_TRUST_HISTORY_POLICY_V1
          .maxSingleAcceptanceCompareAppendReceiptLogicalBytes
    ) {
      throw new ProviderAcceptanceAuthorityErrorV1(
        "namespace_integrity_failed",
      );
    }
  }

  const accounting = calculateAccountingV1(payload);
  if (!sameJsonV1(accounting, payload.accounting)) {
    throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
  }
  if (
    accounting.generationCount >
      PROVIDER_TRUST_HISTORY_POLICY_V1
        .maxAcceptanceGenerationCountPerInstallationIdentity ||
    accounting.receiptCount >
      PROVIDER_TRUST_HISTORY_POLICY_V1
        .maxAcceptanceCompareAppendReceiptCountPerInstallationIdentity ||
    accounting.receiptLogicalBytes >
      PROVIDER_TRUST_HISTORY_POLICY_V1
        .maxAcceptanceCompareAppendReceiptLogicalBytesPerInstallationIdentity ||
    accounting.acceptanceLocalContributionLogicalBytes >
      PROVIDER_TRUST_HISTORY_POLICY_V1
        .maxTotalTrustHistoryLogicalBytesPerInstallationIdentity
  ) throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");

  let previousEventDigest: typeof GENESIS_CHAIN_V1 | string = GENESIS_CHAIN_V1;
  let lastCommittedHighWater: ProviderAcceptanceHighWaterEnvelopeV1 | null = null;
  let committedGenerationIndex = 0;
  const committedEntries: ProviderAcceptanceGenerationEnumerationEntryV1[] = [];
  const observedReceiptNonces = new Set<string>();
  for (let index = 0; index < payload.receipts.length; index += 1) {
    const receipt = payload.receipts[index]!.envelope;
    const event = payload.transactions[index]!;
    if (
      receipt.installationIdentityGenerationId !==
        payload.installationIdentityGenerationId ||
      receipt.payload.installationIdentityGenerationId !==
        payload.installationIdentityGenerationId ||
      receipt.payload.requestDurableProjection
          .installationIdentityGenerationId !==
        payload.installationIdentityGenerationId ||
      observedReceiptNonces.has(receipt.operationNonce) ||
      event.transactionRevision !== index + 1 ||
      event.previousEventDigest !== previousEventDigest ||
      event.operationNonce !== receipt.operationNonce ||
      event.requestContentDigest !== receipt.payload.requestContentDigest ||
      event.receiptContentDigest !== receipt.contentDigest ||
      !verifyHmacTokenForMessageInternalV1(
        key,
        createProviderAcceptanceCompareAppendReceiptTokenMessageV1(
          receipt.payload,
        ),
        receipt.payload.receiptToken,
      )
    ) throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
    observedReceiptNonces.add(receipt.operationNonce);
    const eventFields: TransactionEventFieldsInternalV1 = Object.freeze({
      transactionRevision: event.transactionRevision,
      previousEventDigest: event.previousEventDigest,
      operationNonce: event.operationNonce,
      requestContentDigest: event.requestContentDigest,
      receiptContentDigest: event.receiptContentDigest,
      resultingHighWaterContentDigest:
        event.resultingHighWaterContentDigest,
    });
    if (
      event.eventDigest !==
        digestDomainInternalV1(
          TRANSACTION_EVENT_DIGEST_DOMAIN_V1,
          eventFields,
        ) ||
      !verifyHmacTokenForDomainInternalV1(
        key,
        TRANSACTION_EVENT_TOKEN_DOMAIN_V1,
        { ...eventFields, eventDigest: event.eventDigest },
        event.eventToken,
      )
    ) throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
    previousEventDigest = event.eventDigest;

    const outcome = receipt.payload.durableOutcome;
    if (outcome.outcome === "committed") {
      if (!verifyHighWaterTokenV1(key, outcome.committedHighWater)) {
        throw new ProviderAcceptanceAuthorityErrorV1(
          "namespace_integrity_failed",
        );
      }
      const generation = payload.generations[committedGenerationIndex];
      const request = receipt.payload.requestDurableProjection;
      const highWater = outcome.committedHighWater;
      const requiredFloors = requiredGenerationFloorsV1(
        request.candidate.payload.configuration,
      );
      const expectedFloors = lastCommittedHighWater === null
        ? requiredFloors
        : {
            rootMetadataGeneration: Math.max(
              lastCommittedHighWater.payload.acceptedGenerationFloors
                .rootMetadataGeneration,
              requiredFloors.rootMetadataGeneration,
            ),
            registryManifestGeneration: Math.max(
              lastCommittedHighWater.payload.acceptedGenerationFloors
                .registryManifestGeneration,
              requiredFloors.registryManifestGeneration,
            ),
            supportCatalogGeneration: Math.max(
              lastCommittedHighWater.payload.acceptedGenerationFloors
                .supportCatalogGeneration,
              requiredFloors.supportCatalogGeneration,
            ),
          };
      const joinsPrior = lastCommittedHighWater === null
        ? request.expected.state === "genesis" &&
          request.expected.expectedNamespaceState === "absent" &&
          request.candidate.payload.predecessor.state === "genesis" &&
          highWater.payload.predecessor.state === "genesis" &&
          highWater.payload.predecessor.expectedNamespaceState === "absent"
        : request.expected.state === "current" &&
          request.expected.highWaterRevision ===
            lastCommittedHighWater.payload.highWaterRevision &&
          request.expected.highWaterContentDigest ===
            lastCommittedHighWater.contentDigest &&
          request.expected.currentVersionToken ===
            lastCommittedHighWater.currentVersionToken &&
          request.expected.generationCount ===
            lastCommittedHighWater.payload.generationCount &&
          request.expected.generationSetDigest ===
            lastCommittedHighWater.payload.generationSetDigest &&
          request.candidate.payload.predecessor.state === "acceptance" &&
          request.candidate.payload.predecessor.generationId ===
            lastCommittedHighWater.payload.currentAcceptance.generationId &&
          request.candidate.payload.predecessor.contentDigest ===
            lastCommittedHighWater.payload.currentAcceptance.contentDigest &&
          highWater.payload.predecessor.state === "version" &&
          highWater.payload.predecessor.highWaterRevision ===
            lastCommittedHighWater.payload.highWaterRevision &&
          highWater.payload.predecessor.contentDigest ===
            lastCommittedHighWater.contentDigest &&
          highWater.payload.predecessor.currentVersionToken ===
            lastCommittedHighWater.currentVersionToken;
      committedEntries.push(outcome.appendedGeneration);
      const expectedGenerationSetDigest =
        deriveProviderAcceptanceGenerationSetDigestV1({
          entries: committedEntries,
        });
      if (
        generation === undefined ||
        generation.envelope.installationIdentityGenerationId !==
          payload.installationIdentityGenerationId ||
        generation.envelope.payload.installationIdentityGenerationId !==
          payload.installationIdentityGenerationId ||
        highWater.payload.installationIdentityGenerationId !==
          payload.installationIdentityGenerationId ||
        outcome.appendedGeneration.commitOperationNonce !==
          receipt.operationNonce ||
        !joinsPrior ||
        !sameJsonV1(generation.envelope, receipt.payload.requestDurableProjection.candidate) ||
        !verifyHmacTokenForMessageInternalV1(
          key,
          createProviderAcceptanceStateTokenMessageV1(
            generation.envelope.payload,
          ),
          generation.envelope.payload.acceptanceToken,
        ) ||
        highWater.payload.highWaterRevision !== committedEntries.length ||
        highWater.payload.generationCount !== committedEntries.length ||
        highWater.payload.generationSetDigest !== expectedGenerationSetDigest ||
        !sameJsonV1(
          highWater.payload.acceptedGenerationFloors,
          expectedFloors,
        ) ||
        event.resultingHighWaterContentDigest !==
          highWater.contentDigest
      ) throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
      lastCommittedHighWater = highWater;
      committedGenerationIndex += 1;
    } else {
      const observationMatchesPrior = lastCommittedHighWater === null
        ? outcome.observedHighWater.state === "absent"
        : outcome.observedHighWater.state === "trusted" &&
          sameJsonV1(
            outcome.observedHighWater.highWater,
            lastCommittedHighWater,
          );
      const expectedResultDigest =
        lastCommittedHighWater?.contentDigest ?? null;
      if (
        !observationMatchesPrior ||
        event.resultingHighWaterContentDigest !== expectedResultDigest
      ) {
        throw new ProviderAcceptanceAuthorityErrorV1(
          "namespace_integrity_failed",
        );
      }
    }
  }
  if (committedGenerationIndex !== payload.generations.length) {
    throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
  }
  if (payload.current === null) {
    if (payload.generations.length !== 0 || lastCommittedHighWater !== null) {
      throw new ProviderAcceptanceAuthorityErrorV1(
        "namespace_integrity_failed",
      );
    }
  } else {
    if (
      lastCommittedHighWater === null ||
      !sameJsonV1(payload.current.highWater, lastCommittedHighWater) ||
      !verifyHighWaterTokenV1(key, payload.current.highWater) ||
      payload.current.highWater.payload.installationIdentityGenerationId !==
        payload.installationIdentityGenerationId ||
      payload.current.enumeration.installationIdentityGenerationId !==
        payload.installationIdentityGenerationId ||
      payload.current.enumeration.entries.length !== payload.generations.length
    ) throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
    for (let index = 0; index < payload.generations.length; index += 1) {
      const generation = payload.generations[index]!.envelope;
      const entry = payload.current.enumeration.entries[index]!;
      if (
        generation.installationIdentityGenerationId !==
          payload.installationIdentityGenerationId ||
        generation.payload.installationIdentityGenerationId !==
          payload.installationIdentityGenerationId ||
        !sameJsonV1(entry, committedEntries[index])
      ) throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
    }
  }
}

async function loadSnapshotV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  identity: ProviderAcceptanceInstallationIdentityInternalV1,
  key: Uint8Array,
): Promise<LoadedSnapshotInternalV1 | undefined> {
  let checked;
  try {
    checked = await readCheckedAuthorityFileInternalV1({
      path: layout.canonicalSnapshotPath,
      layout,
      maximumBytes: MAX_SNAPSHOT_PHYSICAL_BYTES_V1,
    });
  } catch (error) {
    if (isMissingFileInternalV1(error)) return undefined;
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = parseCanonicalAuthorityBytesInternalV1(checked.bytes);
  } catch {
    throw new ProviderAcceptanceAuthorityErrorV1(
      "namespace_integrity_failed",
    );
  }
  const envelope = parseSnapshotEnvelopeV1(parsed, identity, key);
  verifySnapshotClosureV1(envelope, key);
  return Object.freeze({ envelope, canonicalBytes: checked.bytes });
}

function publicationSnapshotTokenDigestV1(
  snapshot: SnapshotEnvelopeInternalV1,
): string {
  return sha256DigestInternalV1(
    canonicalAuthorityBytesInternalV1(snapshot.snapshotToken),
  );
}

function signPublicationPinV1(
  key: Uint8Array,
  snapshot: SnapshotEnvelopeInternalV1,
  previous: PublicationPinEnvelopeInternalV1 | undefined,
): PublicationPinEnvelopeInternalV1 {
  const payload: PublicationPinPayloadInternalV1 = Object.freeze({
    schemaVersion: 1,
    profile: PUBLICATION_PIN_PROFILE_V1,
    publicationRevision: snapshot.payload.snapshotRevision,
    snapshotRevision: snapshot.payload.snapshotRevision,
    snapshotContentDigest: snapshot.snapshotContentDigest,
    snapshotTokenDigest: publicationSnapshotTokenDigestV1(snapshot),
    previousPublicationContentDigest:
      previous?.publicationContentDigest ?? GENESIS_CHAIN_V1,
  });
  const publicationContentDigest = digestDomainInternalV1(
    PUBLICATION_PIN_DIGEST_DOMAIN_V1,
    payload,
  );
  return Object.freeze({
    payload,
    publicationContentDigest,
    publicationToken: hmacTokenForDomainInternalV1(
      key,
      PUBLICATION_PIN_TOKEN_DOMAIN_V1,
      { payload, publicationContentDigest },
    ),
  });
}

function parsePublicationPinV1(
  value: unknown,
  key: Uint8Array,
): PublicationPinEnvelopeInternalV1 {
  try {
    if (
      !exactRecordV1(value, [
        "payload",
        "publicationContentDigest",
        "publicationToken",
      ]) ||
      typeof value.publicationContentDigest !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(value.publicationContentDigest)
    ) throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
    const raw = value.payload;
    if (
      !exactRecordV1(raw, [
        "schemaVersion",
        "profile",
        "publicationRevision",
        "snapshotRevision",
        "snapshotContentDigest",
        "snapshotTokenDigest",
        "previousPublicationContentDigest",
      ]) ||
      raw.schemaVersion !== 1 ||
      raw.profile !== PUBLICATION_PIN_PROFILE_V1 ||
      !Number.isSafeInteger(raw.publicationRevision) ||
      (raw.publicationRevision as number) < 1 ||
      raw.publicationRevision !== raw.snapshotRevision ||
      typeof raw.snapshotContentDigest !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(raw.snapshotContentDigest) ||
      typeof raw.snapshotTokenDigest !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(raw.snapshotTokenDigest) ||
      typeof raw.previousPublicationContentDigest !== "string" ||
      !(
        raw.previousPublicationContentDigest === GENESIS_CHAIN_V1 ||
        /^sha256:[0-9a-f]{64}$/u.test(
          raw.previousPublicationContentDigest,
        )
      ) ||
      ((raw.publicationRevision as number) === 1) !==
        (raw.previousPublicationContentDigest === GENESIS_CHAIN_V1)
    ) throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
    const payload: PublicationPinPayloadInternalV1 = Object.freeze({
      schemaVersion: 1,
      profile: PUBLICATION_PIN_PROFILE_V1,
      publicationRevision: raw.publicationRevision as number,
      snapshotRevision: raw.snapshotRevision as number,
      snapshotContentDigest: raw.snapshotContentDigest,
      snapshotTokenDigest: raw.snapshotTokenDigest,
      previousPublicationContentDigest:
        raw.previousPublicationContentDigest,
    });
    const publicationContentDigest = digestDomainInternalV1(
      PUBLICATION_PIN_DIGEST_DOMAIN_V1,
      payload,
    );
    if (
      value.publicationContentDigest !== publicationContentDigest ||
      !verifyHmacTokenForDomainInternalV1(
        key,
        PUBLICATION_PIN_TOKEN_DOMAIN_V1,
        { payload, publicationContentDigest },
        value.publicationToken,
      )
    ) throw new ProviderAcceptanceAuthorityErrorV1("namespace_integrity_failed");
    return Object.freeze({
      payload,
      publicationContentDigest,
      publicationToken: value.publicationToken as string,
    });
  } catch (error) {
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1(
      "namespace_integrity_failed",
    );
  }
}

async function loadPublicationPinV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  key: Uint8Array,
): Promise<PublicationPinEnvelopeInternalV1 | undefined> {
  try {
    const checked = await readCheckedAuthorityFileInternalV1({
      path: layout.canonicalPublicationPinPath,
      layout,
      maximumBytes: MAX_PUBLICATION_PIN_BYTES_V1,
    });
    return parsePublicationPinV1(
      parseCanonicalAuthorityBytesInternalV1(checked.bytes),
      key,
    );
  } catch (error) {
    if (isMissingFileInternalV1(error)) return undefined;
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1(
      "namespace_integrity_failed",
    );
  }
}

function publicationMatchesSnapshotV1(
  publication: PublicationPinEnvelopeInternalV1,
  snapshot: SnapshotEnvelopeInternalV1,
): boolean {
  return publication.payload.snapshotRevision ===
      snapshot.payload.snapshotRevision &&
    publication.payload.snapshotContentDigest ===
      snapshot.snapshotContentDigest &&
    publication.payload.snapshotTokenDigest ===
      publicationSnapshotTokenDigestV1(snapshot);
}

async function preparePublicationPinV1(input: Readonly<{
  layout: ProviderAcceptanceAuthorityLayoutInternalV1;
  key: Uint8Array;
  snapshot: SnapshotEnvelopeInternalV1;
  previous: PublicationPinEnvelopeInternalV1 | undefined;
  hooks?: ProviderAcceptanceAuthorityDurabilityHooksInternalV1;
}>): Promise<PublicationPinEnvelopeInternalV1> {
  const publication = signPublicationPinV1(
    input.key,
    input.snapshot,
    input.previous,
  );
  await prepareDurableAuthorityStageInternalV1({
    stagePath: input.layout.deterministicPublicationPinStagePath,
    bytes: canonicalAuthorityBytesInternalV1(publication),
    layout: input.layout,
    hooks: input.hooks,
    beforeCompleteWritePhase:
      "publication_stage_preparation_opened_before_complete_write",
    phase: "publication_stage_file_fsynced",
  });
  return publication;
}

async function publishPreparedPublicationPinV1(input: Readonly<{
  layout: ProviderAcceptanceAuthorityLayoutInternalV1;
  hooks?: ProviderAcceptanceAuthorityDurabilityHooksInternalV1;
}>): Promise<void> {
  await publishPreparedAuthorityStageInternalV1({
    stagePath: input.layout.deterministicPublicationPinStagePath,
    canonicalPath: input.layout.canonicalPublicationPinPath,
    layout: input.layout,
    hooks: input.hooks,
    afterCanonicalRename:
      "publication_canonical_renamed_before_directory_fsync",
    afterDirectoryFsync: "publication_directory_fsynced",
  });
}

async function loadPreparedPublicationPinV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  key: Uint8Array,
): Promise<PublicationPinEnvelopeInternalV1 | undefined> {
  try {
    const checked = await readCheckedAuthorityFileInternalV1({
      path: layout.deterministicPublicationPinStagePath,
      layout,
      maximumBytes: MAX_PUBLICATION_PIN_BYTES_V1,
    });
    return parsePublicationPinV1(
      parseCanonicalAuthorityBytesInternalV1(checked.bytes),
      key,
    );
  } catch (error) {
    if (isMissingFileInternalV1(error)) return undefined;
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1(
      "namespace_integrity_failed",
    );
  }
}

/**
 * Validate and converge the two-layer publication protocol while the
 * cross-process authority lock is held. Exactly one state is recoverable:
 * snapshot revision N+1 whose predecessor is the exact pinned snapshot N.
 */
async function loadConvergedSnapshotV1(input: Readonly<{
  layout: ProviderAcceptanceAuthorityLayoutInternalV1;
  identity: ProviderAcceptanceInstallationIdentityInternalV1;
  key: Uint8Array;
}>): Promise<Readonly<{
  snapshot: LoadedSnapshotInternalV1 | undefined;
  publication: PublicationPinEnvelopeInternalV1 | undefined;
}>> {
  await normalizeDurableAuthorityStagePreparationInternalV1({
    stagePath: input.layout.deterministicSnapshotStagePath,
    layout: input.layout,
    maximumBytes: MAX_SNAPSHOT_PHYSICAL_BYTES_V1,
  });
  await normalizeDurableAuthorityStagePreparationInternalV1({
    stagePath: input.layout.deterministicPublicationPinStagePath,
    layout: input.layout,
    maximumBytes: MAX_PUBLICATION_PIN_BYTES_V1,
  });
  await discardDeterministicAuthorityStageInternalV1({
    path: input.layout.deterministicSnapshotStagePath,
    layout: input.layout,
  });
  const snapshot = await loadSnapshotV1(
    input.layout,
    input.identity,
    input.key,
  );
  const publication = await loadPublicationPinV1(input.layout, input.key);
  const prepared = await loadPreparedPublicationPinV1(
    input.layout,
    input.key,
  );
  const exactPublished = snapshot !== undefined && publication !== undefined &&
    publicationMatchesSnapshotV1(publication, snapshot.envelope);
  if (prepared === undefined) {
    if (snapshot === undefined && publication === undefined) {
      return Object.freeze({ snapshot, publication });
    }
    if (exactPublished) return Object.freeze({ snapshot, publication });
    throw new ProviderAcceptanceAuthorityErrorV1(
      "namespace_integrity_failed",
    );
  }

  // A prepared future pin with the old exact snapshot still visible proves
  // the crash happened before snapshot publication. Discard the intent.
  if (
    (snapshot === undefined && publication === undefined &&
      prepared.payload.snapshotRevision === 1 &&
      prepared.payload.previousPublicationContentDigest === GENESIS_CHAIN_V1) ||
    (exactPublished && publication !== undefined &&
      prepared.payload.snapshotRevision ===
        publication.payload.snapshotRevision + 1 &&
      prepared.payload.previousPublicationContentDigest ===
        publication.publicationContentDigest)
  ) {
    await discardDeterministicAuthorityStageInternalV1({
      path: input.layout.deterministicPublicationPinStagePath,
      layout: input.layout,
    });
    return Object.freeze({ snapshot, publication });
  }

  if (snapshot !== undefined) {
    const snapshotPayload = snapshot.envelope.payload;
    const validSnapshotAdvance = publication === undefined
      ? snapshotPayload.snapshotRevision === 1 &&
        snapshotPayload.previousSnapshotContentDigest === GENESIS_CHAIN_V1 &&
        prepared.payload.previousPublicationContentDigest === GENESIS_CHAIN_V1
      : snapshotPayload.snapshotRevision ===
          publication.payload.snapshotRevision + 1 &&
        snapshotPayload.previousSnapshotContentDigest ===
          publication.payload.snapshotContentDigest &&
        prepared.payload.previousPublicationContentDigest ===
          publication.publicationContentDigest;
    if (
      validSnapshotAdvance &&
      publicationMatchesSnapshotV1(prepared, snapshot.envelope)
    ) {
      await publishPreparedPublicationPinV1({ layout: input.layout });
      return Object.freeze({ snapshot, publication: prepared });
    }
  }
  throw new ProviderAcceptanceAuthorityErrorV1(
    "namespace_integrity_failed",
  );
}

/**
 * Package-private composition boundary for stores that must observe the exact
 * authenticated Acceptance current while holding the same authority lock as
 * compareAppend. Only the identity generation scalar is projected; the key
 * reference is zeroed by identity custody after the callback settles.
 */
export async function withProviderAcceptanceAuthorityLockedCurrentViewCoreInternalV1<T>(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  openOptions: ProviderAcceptanceAuthorityStoreOpenOptionsInternalV1,
  callback: (
    view: ProviderAcceptanceAuthorityLockedCurrentViewCoreInternalV1,
  ) => T | Promise<T>,
): Promise<T> {
  const identity =
    await openProviderAcceptanceInstallationIdentityInternalV1(layout);
  return identity.withKey(async (key) =>
    withProviderAcceptanceAuthorityCrossProcessLockInternalV1(
      layout,
      key,
      async () => {
        const { snapshot } = await loadConvergedSnapshotV1({
          layout,
          identity,
          key,
        });
        return callback(Object.freeze({
          installationIdentityGenerationId:
            identity.installationIdentityGenerationId,
          key,
          current: snapshot?.envelope.payload.current ?? null,
          verifiedGenerationEnvelopes: Object.freeze(
            (snapshot?.envelope.payload.generations ?? []).map(
              (generation) => generation.envelope,
            ),
          ),
        }));
      },
      openOptions,
    )
  );
}

function currentObservationV1(
  current: ProviderAcceptanceCurrentReadV1 | null,
): Readonly<
  | { readonly state: "absent" }
  | {
      readonly state: "trusted";
      readonly highWater: ProviderAcceptanceHighWaterEnvelopeV1;
    }
> {
  return current === null
    ? Object.freeze({ state: "absent" as const })
    : Object.freeze({
        state: "trusted" as const,
        highWater: current.highWater,
      });
}

function expectedMatchesCurrentV1(
  request: ProviderAcceptanceCompareAppendRequestV1,
  current: ProviderAcceptanceCurrentReadV1 | null,
): boolean {
  if (request.expected.state === "genesis") return current === null;
  if (current === null) return false;
  const highWater = current.highWater;
  return request.expected.highWaterRevision ===
      highWater.payload.highWaterRevision &&
    request.expected.highWaterContentDigest === highWater.contentDigest &&
    request.expected.currentVersionToken === highWater.currentVersionToken &&
    request.expected.generationCount === highWater.payload.generationCount &&
    request.expected.generationSetDigest ===
      highWater.payload.generationSetDigest;
}

function candidateLinksCurrentV1(
  request: ProviderAcceptanceCompareAppendRequestV1,
  current: ProviderAcceptanceCurrentReadV1 | null,
): boolean {
  const candidate = request.candidate.payload;
  if (current === null) {
    return candidate.acceptanceOrdinal === 1 &&
      candidate.predecessor.state === "genesis";
  }
  const pin = current.highWater.payload.currentAcceptance;
  return candidate.acceptanceOrdinal === pin.acceptanceOrdinal + 1 &&
    candidate.predecessor.state === "acceptance" &&
    candidate.predecessor.generationId === pin.generationId &&
    candidate.predecessor.contentDigest === pin.contentDigest;
}

function candidateTokenValidV1(
  key: Uint8Array,
  request: ProviderAcceptanceCompareAppendRequestV1,
): boolean {
  return verifyHmacTokenForMessageInternalV1(
    key,
    createProviderAcceptanceStateTokenMessageV1(request.candidate.payload),
    request.candidate.payload.acceptanceToken,
  );
}

function floorRegressedV1(
  request: ProviderAcceptanceCompareAppendRequestV1,
  current: ProviderAcceptanceCurrentReadV1 | null,
): boolean {
  if (current === null) return false;
  const required = requiredGenerationFloorsV1(
    request.candidate.payload.configuration,
  );
  const floors = current.highWater.payload.acceptedGenerationFloors;
  return required.rootMetadataGeneration < floors.rootMetadataGeneration ||
    required.registryManifestGeneration < floors.registryManifestGeneration ||
    required.supportCatalogGeneration < floors.supportCatalogGeneration;
}

function makeCommittedCurrentV1(
  key: Uint8Array,
  request: ProviderAcceptanceCompareAppendRequestV1,
  current: ProviderAcceptanceCurrentReadV1 | null,
): Readonly<{
  current: ProviderAcceptanceCurrentReadV1;
  appended: ProviderAcceptanceGenerationEnumerationEntryV1;
}> {
  const candidate = request.candidate;
  const appended = ProviderAcceptanceGenerationEnumerationEntryV1Schema.parse({
    locatorProfile: "installation_provider_acceptance_state_v1",
    acceptanceOrdinal: candidate.payload.acceptanceOrdinal,
    generationId: candidate.generationId,
    contentDigest: candidate.contentDigest,
    commitOperationNonce: request.operationNonce,
    predecessor: candidate.payload.predecessor,
  });
  const entries = Object.freeze([
    ...(current?.enumeration.entries ?? []),
    appended,
  ]);
  const generationSetDigest = deriveProviderAcceptanceGenerationSetDigestV1({
    entries,
  });
  const enumeration = ProviderAcceptanceGenerationEnumerationV1Schema.parse({
    profile: "provider_acceptance_generation_enumeration_v1",
    installationIdentityGenerationId:
      request.installationIdentityGenerationId,
    namespaceRevision: entries.length,
    entries,
    generationCount: entries.length,
    generationSetDigest,
  });
  const required = requiredGenerationFloorsV1(
    candidate.payload.configuration,
  );
  const previousFloors = current?.highWater.payload.acceptedGenerationFloors;
  const acceptedGenerationFloors = previousFloors === undefined
    ? required
    : Object.freeze({
        rootMetadataGeneration: Math.max(
          previousFloors.rootMetadataGeneration,
          required.rootMetadataGeneration,
        ),
        registryManifestGeneration: Math.max(
          previousFloors.registryManifestGeneration,
          required.registryManifestGeneration,
        ),
        supportCatalogGeneration: Math.max(
          previousFloors.supportCatalogGeneration,
          required.supportCatalogGeneration,
        ),
      });
  const highWaterPayload = {
    profile: "provider_acceptance_high_water_v1" as const,
    installationIdentityGenerationId:
      request.installationIdentityGenerationId,
    highWaterRevision: entries.length,
    operationNonce: request.operationNonce,
    predecessor: current === null
      ? {
          state: "genesis" as const,
          expectedNamespaceState: "absent" as const,
        }
      : {
          state: "version" as const,
          highWaterRevision: current.highWater.payload.highWaterRevision,
          contentDigest: current.highWater.contentDigest,
          currentVersionToken: current.highWater.currentVersionToken,
        },
    currentAcceptance: {
      locatorProfile: "installation_provider_acceptance_state_v1" as const,
      acceptanceOrdinal: appended.acceptanceOrdinal,
      generationId: appended.generationId,
      contentDigest: appended.contentDigest,
    },
    generationCount: entries.length,
    generationSetDigest,
    acceptedGenerationFloors,
  };
  const contentDigest =
    deriveProviderAcceptanceHighWaterContentDigestV1(highWaterPayload);
  const unsignedEnvelope = {
    schemaVersion: 1 as const,
    recordType: "provider_acceptance_high_water" as const,
    locatorProfile:
      "installation_provider_acceptance_high_water_v1" as const,
    contentDigest,
    currentVersionToken: `hmac-sha256:${"0".repeat(64)}`,
    payload: highWaterPayload,
  };
  const currentVersionToken = hmacTokenForMessageInternalV1(
    key,
    createProviderAcceptanceCurrentVersionTokenMessageV1(unsignedEnvelope),
  );
  const highWater = ProviderAcceptanceHighWaterEnvelopeV1Schema.parse({
    ...unsignedEnvelope,
    currentVersionToken,
  });
  return Object.freeze({
    current: ProviderAcceptanceCurrentReadV1Schema.parse({
      profile: "provider_acceptance_current_read_v1",
      highWater,
      enumeration,
    }),
    appended,
  });
}

function makeReceiptV1(
  key: Uint8Array,
  request: ProviderAcceptanceCompareAppendRequestV1,
  outcome:
    ProviderAcceptanceCompareAppendReceiptEnvelopeV1["payload"]["durableOutcome"],
  resolvedAt: string,
): ProviderAcceptanceCompareAppendReceiptEnvelopeV1 {
  const unsigned = {
    profile: "provider_acceptance_compare_append_receipt_v1" as const,
    installationIdentityGenerationId:
      request.installationIdentityGenerationId,
    operationNonce: request.operationNonce,
    requestContentDigest:
      deriveProviderAcceptanceCompareAppendRequestContentDigestV1(request),
    requestDurableProjection: request,
    durableOutcome: outcome,
    resolvedAt,
  };
  const receiptToken = hmacTokenForMessageInternalV1(
    key,
    createProviderAcceptanceCompareAppendReceiptTokenMessageV1(unsigned),
  );
  const payload = ProviderAcceptanceCompareAppendReceiptV1Schema.parse({
    ...unsigned,
    receiptToken,
  });
  const contentDigest =
    deriveProviderAcceptanceCompareAppendReceiptContentDigestV1(payload);
  return ProviderAcceptanceCompareAppendReceiptEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_acceptance_compare_append_receipt",
    locatorProfile:
      "installation_provider_acceptance_compare_append_receipt_v1",
    installationIdentityGenerationId:
      request.installationIdentityGenerationId,
    operationNonce: request.operationNonce,
    resolvedAt,
    contentDigest,
    payload,
  });
}

function makeTransactionEventV1(
  key: Uint8Array,
  previous: readonly TransactionEventInternalV1[],
  receipt: ProviderAcceptanceCompareAppendReceiptEnvelopeV1,
  resultingCurrent: ProviderAcceptanceCurrentReadV1 | null,
): TransactionEventInternalV1 {
  const fields: TransactionEventFieldsInternalV1 = Object.freeze({
    transactionRevision: previous.length + 1,
    previousEventDigest:
      previous.at(-1)?.eventDigest ?? GENESIS_CHAIN_V1,
    operationNonce: receipt.operationNonce,
    requestContentDigest: receipt.payload.requestContentDigest,
    receiptContentDigest: receipt.contentDigest,
    resultingHighWaterContentDigest:
      resultingCurrent?.highWater.contentDigest ?? null,
  });
  const eventDigest = digestDomainInternalV1(
    TRANSACTION_EVENT_DIGEST_DOMAIN_V1,
    fields,
  );
  return Object.freeze({
    ...fields,
    eventDigest,
    eventToken: hmacTokenForDomainInternalV1(
      key,
      TRANSACTION_EVENT_TOKEN_DOMAIN_V1,
      { ...fields, eventDigest },
    ),
  });
}

function nowIsoV1(clock: () => Date): string {
  const value = clock();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new ProviderAcceptanceAuthorityErrorV1("io_error");
  }
  return value.toISOString();
}

function parseRequestV1(
  input: unknown,
  identity: ProviderAcceptanceInstallationIdentityInternalV1,
): ProviderAcceptanceCompareAppendRequestV1 {
  try {
    const request = ProviderAcceptanceCompareAppendRequestV1Schema.parse(input);
    if (
      request.installationIdentityGenerationId !==
        identity.installationIdentityGenerationId
    ) throw new ProviderAcceptanceAuthorityErrorV1("invalid_request");
    return request;
  } catch (error) {
    if (error instanceof ProviderAcceptanceAuthorityErrorV1) throw error;
    throw new ProviderAcceptanceAuthorityErrorV1("invalid_request");
  }
}

function findReceiptByNonceV1(
  snapshot: LoadedSnapshotInternalV1 | undefined,
  nonce: string,
): StoredReceiptInternalV1 | undefined {
  return snapshot?.envelope.payload.receipts.find(
    (record) => record.envelope.operationNonce === nonce,
  );
}

function resultForExistingReceiptV1(
  request: ProviderAcceptanceCompareAppendRequestV1,
  existing: StoredReceiptInternalV1,
): ProviderAcceptanceCompareAppendResultV1 {
  const requestDigest =
    deriveProviderAcceptanceCompareAppendRequestContentDigestV1(request);
  return ProviderAcceptanceCompareAppendResultV1Schema.parse(
    requestDigest === existing.envelope.payload.requestContentDigest
      ? { resolution: "resolved", receipt: existing.envelope }
      : {
          resolution: "request_rejected",
          reason: "operation_nonce_request_mismatch",
          existingReceipt: existing.envelope,
        },
  );
}

async function compareAppendUnderLockV1(input: Readonly<{
  layout: ProviderAcceptanceAuthorityLayoutInternalV1;
  identity: ProviderAcceptanceInstallationIdentityInternalV1;
  key: Uint8Array;
  request: ProviderAcceptanceCompareAppendRequestV1;
  openOptions: ProviderAcceptanceAuthorityStoreOpenOptionsInternalV1;
}>): Promise<ProviderAcceptanceCompareAppendResultV1> {
  const converged = await loadConvergedSnapshotV1({
    layout: input.layout,
    identity: input.identity,
    key: input.key,
  });
  const previous = converged.snapshot;
  const existing = findReceiptByNonceV1(previous, input.request.operationNonce);
  if (existing !== undefined) {
    return resultForExistingReceiptV1(input.request, existing);
  }
  const previousPayload = previous?.envelope.payload;
  const priorCurrent = previousPayload?.current ?? null;
  let resultingCurrent = priorCurrent;
  let appended:
    | ProviderAcceptanceGenerationEnumerationEntryV1
    | undefined;
  let outcome:
    ProviderAcceptanceCompareAppendReceiptEnvelopeV1["payload"]["durableOutcome"];

  const candidateEnvelopeBytes = canonicalAuthorityBytesInternalV1(
    input.request.candidate,
  ).byteLength;
  const candidateIntrinsicValid = candidateEnvelopeBytes <=
      PROVIDER_TRUST_HISTORY_POLICY_V1.maxSingleTrustEnvelopeLogicalBytes &&
    candidateTokenValidV1(input.key, input.request);
  if (!candidateIntrinsicValid) {
    outcome = {
      outcome: "not_committed",
      reason: "candidate_invalid",
      observedHighWater: currentObservationV1(priorCurrent),
    };
  } else if (!expectedMatchesCurrentV1(input.request, priorCurrent)) {
    outcome = {
      outcome: "not_committed",
      reason: "expected_current_changed",
      observedHighWater: currentObservationV1(priorCurrent),
    };
  } else if (
    !candidateLinksCurrentV1(input.request, priorCurrent) ||
    (previousPayload?.generations.some(
      (record) =>
        record.envelope.generationId === input.request.candidate.generationId,
    ) ?? false)
  ) {
    outcome = {
      outcome: "not_committed",
      reason: "candidate_invalid",
      observedHighWater: currentObservationV1(priorCurrent),
    };
  } else if (floorRegressedV1(input.request, priorCurrent)) {
    outcome = {
      outcome: "not_committed",
      reason: "generation_floor_regressed",
      observedHighWater: currentObservationV1(priorCurrent),
    };
  } else {
    const committed = makeCommittedCurrentV1(
      input.key,
      input.request,
      priorCurrent,
    );
    resultingCurrent = committed.current;
    appended = committed.appended;
    outcome = {
      outcome: "committed",
      committedHighWater: committed.current.highWater,
      appendedGeneration: committed.appended,
    };
  }

  const receipt = makeReceiptV1(
    input.key,
    input.request,
    outcome,
    nowIsoV1(input.openOptions.clock ?? (() => new Date())),
  );
  const storedReceipt: StoredReceiptInternalV1 = Object.freeze({
    logicalLocator: providerAcceptanceReceiptLogicalLocatorInternalV1(
      receipt.operationNonce,
    ),
    logicalBytes: canonicalAuthorityBytesInternalV1(receipt).byteLength,
    envelope: receipt,
  });
  const generations = appended === undefined
    ? [...(previousPayload?.generations ?? [])]
    : [
        ...(previousPayload?.generations ?? []),
        Object.freeze({
          logicalLocator: providerAcceptanceGenerationLogicalLocatorInternalV1(
            input.request.candidate.generationId,
          ),
          logicalBytes: candidateEnvelopeBytes,
          envelope: input.request.candidate,
        }),
      ];
  const receipts = [...(previousPayload?.receipts ?? []), storedReceipt];
  const transaction = makeTransactionEventV1(
    input.key,
    previousPayload?.transactions ?? [],
    receipt,
    resultingCurrent,
  );
  const transactions = [
    ...(previousPayload?.transactions ?? []),
    transaction,
  ];
  const payload = snapshotPayloadV1({
    identity: input.identity.installationIdentityGenerationId,
    previous,
    generations,
    current: resultingCurrent,
    receipts,
    transactions,
  });
  const admission = classifyProviderAcceptanceAuthorityAdmissionInternalV1({
    generationCount: payload.accounting.generationCount,
    receiptCount: payload.accounting.receiptCount,
    receiptLogicalBytes: payload.accounting.receiptLogicalBytes,
    requestLogicalBytes: storedReceipt.logicalBytes,
    acceptanceLocalContributionLogicalBytes:
      payload.accounting.acceptanceLocalContributionLogicalBytes,
    admissionClass: "normal",
    isExistingReplay: false,
  });
  if (!admission.admitted) {
    throw new ProviderAcceptanceAuthorityErrorV1("capacity_exhausted");
  }
  const envelope = signSnapshotV1(input.key, payload);
  // Verify the exact candidate before the first filesystem side effect.
  verifySnapshotClosureV1(envelope, input.key);
  const bytes = canonicalAuthorityBytesInternalV1(envelope);
  if (bytes.byteLength > MAX_SNAPSHOT_PHYSICAL_BYTES_V1) {
    throw new ProviderAcceptanceAuthorityErrorV1("capacity_exhausted");
  }
  await preparePublicationPinV1({
    layout: input.layout,
    key: input.key,
    snapshot: envelope,
    previous: converged.publication,
    hooks: input.openOptions,
  });
  await replaceDurableAuthoritySnapshotInternalV1({
    canonicalPath: input.layout.canonicalSnapshotPath,
    stagePath: input.layout.deterministicSnapshotStagePath,
    bytes,
    layout: input.layout,
    hooks: input.openOptions,
    phases: {
      afterStageFileFsync: "snapshot_stage_file_fsynced",
      afterCanonicalRename:
        "snapshot_canonical_renamed_before_directory_fsync",
      afterDirectoryFsync: "snapshot_directory_fsynced_before_publication",
    },
  });
  await publishPreparedPublicationPinV1({
    layout: input.layout,
    hooks: input.openOptions,
  });
  await input.openOptions.afterDurablePhase?.(
    "snapshot_directory_fsynced_before_response",
  );
  return ProviderAcceptanceCompareAppendResultV1Schema.parse({
    resolution: "resolved",
    receipt,
  });
}

export async function openProviderAcceptanceAuthorityStoreWithLayoutCoreInternalV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
  openOptions: ProviderAcceptanceAuthorityStoreOpenOptionsInternalV1 = {},
): Promise<ProviderAcceptanceAuthorityStoreInternalV1> {
  const identity =
    await openProviderAcceptanceInstallationIdentityInternalV1(layout);
  // Opening is itself an integrity boundary: callers never receive a handle
  // for a corrupt or rollback-inconsistent snapshot/publication pair.
  await identity.withKey(async (key) =>
    withProviderAcceptanceAuthorityCrossProcessLockInternalV1(
      layout,
      key,
      async () => {
        await loadConvergedSnapshotV1({ layout, identity, key });
      },
      openOptions,
    )
  );

  const readCurrent = async (): Promise<
    ProviderAcceptanceAuthorityCurrentReadResultInternalV1
  > => identity.withKey(async (key) => {
    return withProviderAcceptanceAuthorityCrossProcessLockInternalV1(
      layout,
      key,
      async () => {
        const { snapshot } = await loadConvergedSnapshotV1({
          layout,
          identity,
          key,
        });
        const current = snapshot?.envelope.payload.current ?? null;
        return current === null
          ? Object.freeze({ state: "absent" as const })
          : Object.freeze({ state: "current" as const, current });
      },
      openOptions,
    );
  });

  const compareAppend = async (
    requestInput: unknown,
  ): Promise<ProviderAcceptanceCompareAppendResultV1> => {
    const request = parseRequestV1(requestInput, identity);
    return identity.withKey(async (key) =>
      withProviderAcceptanceAuthorityCrossProcessLockInternalV1(
        layout,
        key,
        () => compareAppendUnderLockV1({
          layout,
          identity,
          key,
          request,
          openOptions,
        }),
        openOptions,
      )
    );
  };

  const doctor = async (): Promise<
    ProviderAcceptanceAuthorityDoctorResultInternalV1
  > => {
    try {
      return await identity.withKey(async (key) => {
        return withProviderAcceptanceAuthorityCrossProcessLockInternalV1(
          layout,
          key,
          async () => {
            const { snapshot } = await loadConvergedSnapshotV1({
              layout,
              identity,
              key,
            });
            return Object.freeze({
              status: "ready" as const,
              authority: "installation_owner_candidate" as const,
              strongWrites: "locked" as const,
              namespace: snapshot?.envelope.payload.current === null ||
                  snapshot === undefined
                ? "absent" as const
                : "current" as const,
              snapshotRevision:
                snapshot?.envelope.payload.snapshotRevision ?? 0,
              generationCount:
                snapshot?.envelope.payload.accounting.generationCount ?? 0,
              receiptCount:
                snapshot?.envelope.payload.accounting.receiptCount ?? 0,
            });
          },
          openOptions,
        );
      });
    } catch (error) {
      if (
        error instanceof ProviderAcceptanceAuthorityErrorV1 &&
        error.code === "not_provisioned"
      ) {
        return Object.freeze({
          status: "unprovisioned" as const,
          authority: "installation_owner_candidate" as const,
          strongWrites: "locked" as const,
          namespace: "unavailable" as const,
        });
      }
      return Object.freeze({
        status: "integrity_failed" as const,
        authority: "installation_owner_candidate" as const,
        strongWrites: "locked" as const,
        namespace: "unavailable" as const,
      });
    }
  };

  return Object.freeze({
    authority: "installation_owner_candidate" as const,
    strongWrites: "locked" as const,
    readCurrent,
    compareAppend,
    doctor,
  });
}

export async function inspectProviderAcceptanceAuthoritySnapshotCoreInternalV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
): Promise<Readonly<{
  snapshotRevision: number;
  generationCount: number;
  receiptCount: number;
  receiptLogicalBytes: number;
  transactionCount: number;
}>> {
  const identity =
    await openProviderAcceptanceInstallationIdentityInternalV1(layout);
  return identity.withKey(async (key) => {
    return withProviderAcceptanceAuthorityCrossProcessLockInternalV1(
      layout,
      key,
      async () => {
        const { snapshot } = await loadConvergedSnapshotV1({
          layout,
          identity,
          key,
        });
        return Object.freeze({
          snapshotRevision: snapshot?.envelope.payload.snapshotRevision ?? 0,
          generationCount:
            snapshot?.envelope.payload.accounting.generationCount ?? 0,
          receiptCount:
            snapshot?.envelope.payload.accounting.receiptCount ?? 0,
          receiptLogicalBytes:
            snapshot?.envelope.payload.accounting.receiptLogicalBytes ?? 0,
          transactionCount:
            snapshot?.envelope.payload.transactions.length ?? 0,
        });
      },
    );
  });
}

/** Shared path-redacted health projection for production and the deep test seam. */
export async function inspectProviderAcceptanceAuthorityCandidateWithLayoutCoreInternalV1(
  layout: ProviderAcceptanceAuthorityLayoutInternalV1,
): Promise<ProviderAcceptanceAuthorityDoctorResultInternalV1> {
  try {
    const store =
      await openProviderAcceptanceAuthorityStoreWithLayoutCoreInternalV1(
        layout,
      );
    return store.doctor();
  } catch (error) {
    return Object.freeze({
      status:
        error instanceof ProviderAcceptanceAuthorityErrorV1 &&
          error.code === "not_provisioned"
          ? "unprovisioned" as const
          : "integrity_failed" as const,
      authority: "installation_owner_candidate" as const,
      strongWrites: "locked" as const,
      namespace: "unavailable" as const,
    });
  }
}

void PROVIDER_ACCEPTANCE_AUTHORITY_LOGICAL_LOCATORS_V1;
