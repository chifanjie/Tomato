import { createHash, createHmac } from "node:crypto";
import {
  chmod,
  chown,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "@understand-code/durable-object-provider-contracts/jcs";
import { PROVIDER_TRUST_HISTORY_POLICY_V1 } from "@understand-code/durable-object-provider-contracts";
import {
  ProviderAcceptanceCompareAppendReceiptEnvelopeV1Schema,
  ProviderAcceptanceCompareAppendRequestV1Schema,
  ProviderAcceptedConfigurationV1Schema,
  type ProviderAcceptedConfigurationV1,
} from "@understand-code/durable-object-provider-contracts/provider-acceptance";
import { afterEach, describe, expect, it } from "vitest";

import {
  createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  openProviderAcceptanceAuthorityStoreForTestInternalV1,
  provisionProviderAcceptanceAuthorityForTestInternalV1,
} from "../src/test-seam-internal.js";
import {
  PROVIDER_ACCEPTANCE_AUTHORITY_LOGICAL_LOCATORS_V1,
} from "../src/platform-layout.js";
import {
  TEST_INSTALLATION_IDENTITY_GENERATION_ID,
  TEST_INSTALLATION_IDENTITY_KEY,
  acceptanceEnvelopeV1,
  cloneJsonV1,
  genesisRequestV1,
  operationNonceV1,
  successorRequestV1,
  testAuthorityClockV1,
} from "./acceptance-store-fixtures.js";

const fixtureRoots = new Set<string>();

afterEach(async () => {
  await Promise.all(
    [...fixtureRoots].map((root) => rm(root, { recursive: true, force: true })),
  );
  fixtureRoots.clear();
});

async function fixtureV1() {
  const parent = await mkdtemp(join(tmpdir(), "provider-authority-integrity-"));
  const root = join(parent, "authority");
  fixtureRoots.add(parent);
  const capability =
    createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1(root);
  await provisionProviderAcceptanceAuthorityForTestInternalV1(capability, {
    installationIdentityGenerationId:
      TEST_INSTALLATION_IDENTITY_GENERATION_ID,
    installationIdentityKey: TEST_INSTALLATION_IDENTITY_KEY,
  });
  const store =
    await openProviderAcceptanceAuthorityStoreForTestInternalV1(capability, {
      clock: testAuthorityClockV1,
    });
  return { root, capability, store };
}

function locatorV1(
  root: string,
  locator: keyof typeof PROVIDER_ACCEPTANCE_AUTHORITY_LOGICAL_LOCATORS_V1,
): string {
  return join(root, PROVIDER_ACCEPTANCE_AUTHORITY_LOGICAL_LOCATORS_V1[locator]);
}

async function commitThreeV1(
  store: Awaited<
    ReturnType<typeof openProviderAcceptanceAuthorityStoreForTestInternalV1>
  >,
): Promise<void> {
  await store.compareAppend(genesisRequestV1());
  const first = await store.readCurrent();
  if (first.state !== "current") throw new Error("expected G1");
  await store.compareAppend(successorRequestV1({
    current: first.current,
    operationNonce: operationNonceV1(2),
  }));
  const second = await store.readCurrent();
  if (second.state !== "current") throw new Error("expected G2");
  await store.compareAppend(successorRequestV1({
    current: second.current,
    operationNonce: operationNonceV1(3),
  }));
}

function expectRedactedAuthorityErrorV1(
  action: Promise<unknown>,
  root: string,
  expectedCodes: readonly string[],
): Promise<void> {
  return action.then(
    () => {
      throw new Error("expected authority operation to fail closed");
    },
    (error: unknown) => {
      expect(error).toMatchObject({
        name: "ProviderAcceptanceAuthorityErrorV1",
      });
      const code = error !== null && typeof error === "object" &&
          "code" in error
        ? String(error.code)
        : "";
      expect(expectedCodes).toContain(code);
      const publicText = `${String(error)} ${JSON.stringify(error)}`;
      expect(publicText).not.toContain(root);
      expect(publicText).not.toContain(
        Buffer.from(TEST_INSTALLATION_IDENTITY_KEY).toString("hex"),
      );
    },
  );
}

async function writeCanonicalJsonV1(path: string, value: unknown): Promise<void> {
  await writeFile(path, canonicalizeJcsSafeIntegerUtf8V1(value), {
    mode: 0o600,
  });
}

const SNAPSHOT_DIGEST_DOMAIN_ORACLE_V1 =
  "understand-code-provider-acceptance-authority-snapshot-v1";
const SNAPSHOT_TOKEN_DOMAIN_ORACLE_V1 =
  "understand-code-provider-acceptance-authority-snapshot-token-v1";
const PUBLICATION_DIGEST_DOMAIN_ORACLE_V1 =
  "understand-code-provider-acceptance-authority-publication-pin-v1";
const PUBLICATION_TOKEN_DOMAIN_ORACLE_V1 =
  "understand-code-provider-acceptance-authority-publication-pin-token-v1";
const HIGH_WATER_DIGEST_DOMAIN_ORACLE_V1 =
  "provider-acceptance-high-water-v1";
const CURRENT_VERSION_TOKEN_DOMAIN_ORACLE_V1 =
  "provider-acceptance-current-version-v1";
const RECEIPT_DIGEST_DOMAIN_ORACLE_V1 =
  "provider-acceptance-compare-append-receipt-v1";
const RECEIPT_TOKEN_DOMAIN_ORACLE_V1 =
  "provider-acceptance-compare-append-receipt-token-v1";
const GENERATION_SET_DIGEST_DOMAIN_ORACLE_V1 =
  "provider-acceptance-generation-set-v1";
const TRANSACTION_DIGEST_DOMAIN_ORACLE_V1 =
  "understand-code-provider-acceptance-authority-transaction-event-v1";
const TRANSACTION_TOKEN_DOMAIN_ORACLE_V1 =
  "understand-code-provider-acceptance-authority-transaction-event-token-v1";

function canonicalBytesOracleV1(value: unknown): Uint8Array {
  return canonicalizeJcsSafeIntegerUtf8V1(value);
}

function sha256BytesOracleV1(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function digestDomainOracleV1(
  domain: string,
  value: unknown,
): `sha256:${string}` {
  return sha256BytesOracleV1(canonicalBytesOracleV1([domain, value]));
}

function hmacDomainOracleV1(
  domain: string,
  value: unknown,
): `hmac-sha256:${string}` {
  return `hmac-sha256:${createHmac(
    "sha256",
    TEST_INSTALLATION_IDENTITY_KEY,
  ).update(canonicalBytesOracleV1([domain, value])).digest("hex")}`;
}

function resignHighWaterOracleV1(highWater: any): void {
  highWater.contentDigest = digestDomainOracleV1(
    HIGH_WATER_DIGEST_DOMAIN_ORACLE_V1,
    highWater.payload,
  );
  highWater.currentVersionToken = hmacDomainOracleV1(
    CURRENT_VERSION_TOKEN_DOMAIN_ORACLE_V1,
    {
      locatorProfile: highWater.locatorProfile,
      installationIdentityGenerationId:
        highWater.payload.installationIdentityGenerationId,
      highWaterRevision: highWater.payload.highWaterRevision,
      highWaterContentDigest: highWater.contentDigest,
      currentAcceptance: highWater.payload.currentAcceptance,
      generationCount: highWater.payload.generationCount,
      generationSetDigest: highWater.payload.generationSetDigest,
    },
  );
}

function resignReceiptOracleV1(snapshot: any, index: number): void {
  const record = snapshot.payload.receipts[index];
  const receipt = record.envelope;
  const { receiptToken: _oldReceiptToken, ...unsigned } = receipt.payload;
  receipt.payload.receiptToken = hmacDomainOracleV1(
    RECEIPT_TOKEN_DOMAIN_ORACLE_V1,
    unsigned,
  );
  receipt.contentDigest = digestDomainOracleV1(
    RECEIPT_DIGEST_DOMAIN_ORACLE_V1,
    unsigned,
  );
  record.logicalBytes = canonicalBytesOracleV1(receipt).byteLength;
}

function resignTransactionChainOracleV1(snapshot: any): void {
  let previousEventDigest: string = "genesis";
  for (const transaction of snapshot.payload.transactions) {
    transaction.previousEventDigest = previousEventDigest;
    const fields = {
      transactionRevision: transaction.transactionRevision,
      previousEventDigest: transaction.previousEventDigest,
      operationNonce: transaction.operationNonce,
      requestContentDigest: transaction.requestContentDigest,
      receiptContentDigest: transaction.receiptContentDigest,
      resultingHighWaterContentDigest:
        transaction.resultingHighWaterContentDigest,
    };
    transaction.eventDigest = digestDomainOracleV1(
      TRANSACTION_DIGEST_DOMAIN_ORACLE_V1,
      fields,
    );
    transaction.eventToken = hmacDomainOracleV1(
      TRANSACTION_TOKEN_DOMAIN_ORACLE_V1,
      { ...fields, eventDigest: transaction.eventDigest },
    );
    previousEventDigest = transaction.eventDigest;
  }
}

function maximumStrongReadyConfigurationOracleV1(): ProviderAcceptedConfigurationV1 {
  const digest = (character: string): `sha256:${string}` =>
    `sha256:${character.repeat(64)}`;
  const selections = Array.from({ length: 4_096 }, (_unused, index) => ({
    targetProfileId:
      `provider-target-profile:${index.toString(16).padStart(64, "0")}`,
    providerId: `durable-object-provider:${"p".repeat(64)}`,
    registryEntryContentDigest: digest("1"),
    semanticProviderPolicyDigest: digest("2"),
    providerFeasibilityEvidence: {
      locatorProfile: "installation_provider_feasibility_evidence_v1" as const,
      evidenceId: `provider-feasibility-evidence:${"3".repeat(22)}`,
      contentDigest: digest("3"),
    },
    runtimeAttestationContentDigest: digest("4"),
    bindingDerivationKeyGeneration: Number.MAX_SAFE_INTEGER,
  }));
  return ProviderAcceptedConfigurationV1Schema.parse({
    state: "strong_ready",
    core: {
      activeRootMetadata: {
        locatorProfile:
          "installation_provider_registry_root_metadata_v1",
        rootGeneration: 1,
        rootKeyId: "5".repeat(22),
        contentDigest: digest("5"),
      },
      providerRegistryManifest: {
        locatorProfile: "installation_provider_registry_manifest_v1",
        manifestGeneration: 1,
        generationId: `provider-registry-manifest:${"6".repeat(22)}`,
        contentDigest: digest("6"),
      },
      providerSupportCatalog: {
        locatorProfile:
          "distribution_provider_feasibility_support_catalog_v1",
        catalogGeneration: 1,
        contentDigest: digest("7"),
      },
      activeWriterSelector: {
        profile: "provider_active_writer_selector_v1",
        selections,
      },
    },
    activation: { origin: "bootstrap_or_steady_successor" },
  });
}

function recalculateSnapshotAccountingOracleV1(snapshot: any): void {
  for (const record of snapshot.payload.generations) {
    record.logicalBytes = canonicalBytesOracleV1(record.envelope).byteLength;
  }
  for (const record of snapshot.payload.receipts) {
    record.logicalBytes = canonicalBytesOracleV1(record.envelope).byteLength;
  }
  const generationLogicalBytes = snapshot.payload.generations.reduce(
    (sum: number, record: any) => sum + record.logicalBytes,
    0,
  );
  const receiptLogicalBytes = snapshot.payload.receipts.reduce(
    (sum: number, record: any) => sum + record.logicalBytes,
    0,
  );
  const currentLogicalBytes = snapshot.payload.current === null
    ? 0
    : canonicalBytesOracleV1(snapshot.payload.current).byteLength;
  snapshot.payload.accounting = {
    generationCount: snapshot.payload.generations.length,
    receiptCount: snapshot.payload.receipts.length,
    generationLogicalBytes,
    receiptLogicalBytes,
    currentLogicalBytes,
    acceptanceLocalContributionLogicalBytes:
      generationLogicalBytes + receiptLogicalBytes + currentLogicalBytes,
  };
}

async function rewriteAuthenticatedSnapshotAndPublicationOracleV1(
  root: string,
  mutate: (snapshot: any) => void = () => undefined,
): Promise<void> {
  const snapshotPath = locatorV1(root, "canonicalSnapshot");
  const publicationPath = locatorV1(root, "canonicalPublicationPin");
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  const publication = JSON.parse(await readFile(publicationPath, "utf8"));
  const previousPublicationContentDigest =
    publication.publicationContentDigest;
  const priorPublicationRevision = publication.payload.publicationRevision;
  mutate(snapshot);
  recalculateSnapshotAccountingOracleV1(snapshot);
  snapshot.snapshotContentDigest = digestDomainOracleV1(
    SNAPSHOT_DIGEST_DOMAIN_ORACLE_V1,
    snapshot.payload,
  );
  snapshot.snapshotToken = hmacDomainOracleV1(
    SNAPSHOT_TOKEN_DOMAIN_ORACLE_V1,
    {
      payload: snapshot.payload,
      snapshotContentDigest: snapshot.snapshotContentDigest,
    },
  );
  publication.payload.publicationRevision = snapshot.payload.snapshotRevision;
  publication.payload.snapshotRevision = snapshot.payload.snapshotRevision;
  if (snapshot.payload.snapshotRevision !== priorPublicationRevision) {
    publication.payload.previousPublicationContentDigest =
      previousPublicationContentDigest;
  }
  publication.payload.snapshotContentDigest = snapshot.snapshotContentDigest;
  publication.payload.snapshotTokenDigest = sha256BytesOracleV1(
    canonicalBytesOracleV1(snapshot.snapshotToken),
  );
  publication.publicationContentDigest = digestDomainOracleV1(
    PUBLICATION_DIGEST_DOMAIN_ORACLE_V1,
    publication.payload,
  );
  publication.publicationToken = hmacDomainOracleV1(
    PUBLICATION_TOKEN_DOMAIN_ORACLE_V1,
    {
      payload: publication.payload,
      publicationContentDigest: publication.publicationContentDigest,
    },
  );
  await writeCanonicalJsonV1(snapshotPath, snapshot);
  await writeCanonicalJsonV1(publicationPath, publication);
}

async function openAndReadCurrentV1(
  capability: Parameters<
    typeof openProviderAcceptanceAuthorityStoreForTestInternalV1
  >[0],
) {
  const store =
    await openProviderAcceptanceAuthorityStoreForTestInternalV1(capability, {
      clock: testAuthorityClockV1,
    });
  return store.readCurrent();
}

describe("provider Acceptance authority authenticated closure", () => {
  const semanticTamperCases = [
    {
      name: "missing generation",
      mutate(snapshot: any) {
        snapshot.payload.generations.splice(1, 1);
      },
    },
    {
      name: "reordered generations",
      mutate(snapshot: any) {
        snapshot.payload.generations.reverse();
      },
    },
    {
      name: "duplicate generation",
      mutate(snapshot: any) {
        snapshot.payload.generations[1] = cloneJsonV1(
          snapshot.payload.generations[0],
        );
      },
    },
    {
      name: "enumeration ordinal gap",
      mutate(snapshot: any) {
        snapshot.payload.current.enumeration.entries.splice(1, 1);
      },
    },
    {
      name: "missing receipt",
      mutate(snapshot: any) {
        snapshot.payload.receipts.pop();
      },
    },
    {
      name: "reordered receipts",
      mutate(snapshot: any) {
        snapshot.payload.receipts.reverse();
      },
    },
    {
      name: "duplicate receipt",
      mutate(snapshot: any) {
        snapshot.payload.receipts[1] = cloneJsonV1(
          snapshot.payload.receipts[0],
        );
      },
    },
    {
      name: "transaction revision gap",
      mutate(snapshot: any) {
        snapshot.payload.transactions[1].transactionRevision = 4;
      },
    },
    {
      name: "rolled-back current projection",
      mutate(snapshot: any) {
        snapshot.payload.current.highWater = cloneJsonV1(
          snapshot.payload.receipts[0].envelope.payload.durableOutcome
            .committedHighWater,
        );
        snapshot.payload.current.enumeration.entries.splice(1);
      },
    },
  ] as const;

  for (const testCase of semanticTamperCases) {
    it(`fails closed for ${testCase.name}`, async () => {
      const { root, capability, store } = await fixtureV1();
      await commitThreeV1(store);
      const snapshotPath = locatorV1(root, "canonicalSnapshot");
      const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
      testCase.mutate(snapshot);
      await writeCanonicalJsonV1(snapshotPath, snapshot);
      await expectRedactedAuthorityErrorV1(
        openAndReadCurrentV1(capability),
        root,
        ["namespace_integrity_failed"],
      );
    });
  }

  it("accepts snapshot and publication authenticators rebuilt by the independent oracle", async () => {
    const { root, capability, store } = await fixtureV1();
    await commitThreeV1(store);
    const snapshotPath = locatorV1(root, "canonicalSnapshot");
    const publicationPath = locatorV1(root, "canonicalPublicationPin");
    const originalSnapshot = await readFile(snapshotPath);
    const originalPublication = await readFile(publicationPath);

    await rewriteAuthenticatedSnapshotAndPublicationOracleV1(root);

    expect(await readFile(snapshotPath)).toEqual(originalSnapshot);
    expect(await readFile(publicationPath)).toEqual(originalPublication);
    const reopened =
      await openProviderAcceptanceAuthorityStoreForTestInternalV1(capability, {
        clock: testAuthorityClockV1,
      });
    const current = await reopened.readCurrent();
    expect(current.state).toBe("current");
    if (current.state === "current") {
      expect(current.current.enumeration.entries).toHaveLength(3);
    }
  });

  const authenticatedSemanticTamperCases = [
    {
      name: "missing committed generation",
      mutate(snapshot: any) {
        snapshot.payload.generations.splice(1, 1);
      },
    },
    {
      name: "reordered committed generations",
      mutate(snapshot: any) {
        snapshot.payload.generations.reverse();
      },
    },
    {
      name: "historical high-water generation-set prefix",
      mutate(snapshot: any) {
        const historical = snapshot.payload.receipts[1].envelope.payload
          .durableOutcome.committedHighWater;
        const later = snapshot.payload.receipts[2].envelope.payload
          .durableOutcome.committedHighWater;
        historical.payload.generationSetDigest =
          later.payload.generationSetDigest;
        resignHighWaterOracleV1(historical);
        resignReceiptOracleV1(snapshot, 1);
        snapshot.payload.transactions[1].receiptContentDigest =
          snapshot.payload.receipts[1].envelope.contentDigest;
        snapshot.payload.transactions[1].resultingHighWaterContentDigest =
          historical.contentDigest;
        resignTransactionChainOracleV1(snapshot);
      },
    },
    {
      name: "historical high-water accepted floors",
      mutate(snapshot: any) {
        const historical = snapshot.payload.receipts[1].envelope.payload
          .durableOutcome.committedHighWater;
        historical.payload.acceptedGenerationFloors = {
          rootMetadataGeneration: 99,
          registryManifestGeneration: 99,
          supportCatalogGeneration: 99,
        };
        resignHighWaterOracleV1(historical);
        resignReceiptOracleV1(snapshot, 1);
        snapshot.payload.transactions[1].receiptContentDigest =
          snapshot.payload.receipts[1].envelope.contentDigest;
        snapshot.payload.transactions[1].resultingHighWaterContentDigest =
          historical.contentDigest;
        resignTransactionChainOracleV1(snapshot);
      },
    },
    {
      name: "current Installation Identity join",
      mutate(snapshot: any) {
        const otherIdentity =
          `installation-identity-generation:${"a".repeat(22)}`;
        snapshot.payload.current.highWater.payload
          .installationIdentityGenerationId = otherIdentity;
        snapshot.payload.current.enumeration
          .installationIdentityGenerationId = otherIdentity;
        resignHighWaterOracleV1(snapshot.payload.current.highWater);
      },
    },
    {
      name: "transaction commit nonce join",
      mutate(snapshot: any) {
        snapshot.payload.transactions[1].operationNonce =
          operationNonceV1(63);
        resignTransactionChainOracleV1(snapshot);
      },
    },
    {
      name: "transaction request-to-receipt join",
      mutate(snapshot: any) {
        snapshot.payload.transactions[1].requestContentDigest =
          snapshot.payload.receipts[0].envelope.payload.requestContentDigest;
        resignTransactionChainOracleV1(snapshot);
      },
    },
    {
      name: "transaction receipt digest join",
      mutate(snapshot: any) {
        snapshot.payload.transactions[1].receiptContentDigest =
          snapshot.payload.receipts[0].envelope.contentDigest;
        resignTransactionChainOracleV1(snapshot);
      },
    },
    {
      name: "rolled-back full current projection",
      mutate(snapshot: any) {
        const historical = snapshot.payload.receipts[1].envelope.payload
          .durableOutcome.committedHighWater;
        snapshot.payload.current.highWater = cloneJsonV1(historical);
        snapshot.payload.current.enumeration.entries.splice(2);
        snapshot.payload.current.enumeration.namespaceRevision = 2;
        snapshot.payload.current.enumeration.generationCount = 2;
        snapshot.payload.current.enumeration.generationSetDigest =
          digestDomainOracleV1(GENERATION_SET_DIGEST_DOMAIN_ORACLE_V1, {
            entries: snapshot.payload.current.enumeration.entries,
          });
      },
    },
  ] as const;

  for (const testCase of authenticatedSemanticTamperCases) {
    it(`fails closure verification for independently authenticated ${testCase.name}`, async () => {
      const { root, capability, store } = await fixtureV1();
      await commitThreeV1(store);
      await rewriteAuthenticatedSnapshotAndPublicationOracleV1(
        root,
        testCase.mutate,
      );
      await expectRedactedAuthorityErrorV1(
        openAndReadCurrentV1(capability),
        root,
        ["namespace_integrity_failed"],
      );
    });
  }

  it("rejects an independently authenticated formal receipt above the 1 MiB per-record load cap", async () => {
    const { root, capability, store } = await fixtureV1();
    await store.compareAppend(genesisRequestV1());
    const currentResult = await store.readCurrent();
    if (currentResult.state !== "current") throw new Error("expected G1");
    const current = currentResult.current;
    const previous = current.enumeration.entries.at(-1)!;
    const candidate = acceptanceEnvelopeV1({
      acceptanceOrdinal: 2,
      predecessor: {
        state: "acceptance",
        generationId: previous.generationId,
        contentDigest: previous.contentDigest,
      },
      configuration: maximumStrongReadyConfigurationOracleV1(),
    });
    const request = ProviderAcceptanceCompareAppendRequestV1Schema.parse({
      ...successorRequestV1({
        current,
        operationNonce: operationNonceV1(62),
      }),
      candidate,
    });
    const requestContentDigest = digestDomainOracleV1(
      "provider-acceptance-compare-append-request-v1",
      request,
    );
    const unsignedReceipt = {
      profile: "provider_acceptance_compare_append_receipt_v1" as const,
      installationIdentityGenerationId:
        TEST_INSTALLATION_IDENTITY_GENERATION_ID,
      operationNonce: request.operationNonce,
      requestContentDigest,
      requestDurableProjection: request,
      durableOutcome: {
        outcome: "not_committed" as const,
        reason: "candidate_invalid" as const,
        observedHighWater: {
          state: "trusted" as const,
          highWater: current.highWater,
        },
      },
      resolvedAt: testAuthorityClockV1().toISOString(),
    };
    const receiptPayload = {
      ...unsignedReceipt,
      receiptToken: hmacDomainOracleV1(
        RECEIPT_TOKEN_DOMAIN_ORACLE_V1,
        unsignedReceipt,
      ),
    };
    const receipt =
      ProviderAcceptanceCompareAppendReceiptEnvelopeV1Schema.parse({
        schemaVersion: 1,
        recordType: "provider_acceptance_compare_append_receipt",
        locatorProfile:
          "installation_provider_acceptance_compare_append_receipt_v1",
        installationIdentityGenerationId:
          TEST_INSTALLATION_IDENTITY_GENERATION_ID,
        operationNonce: request.operationNonce,
        resolvedAt: unsignedReceipt.resolvedAt,
        contentDigest: digestDomainOracleV1(
          RECEIPT_DIGEST_DOMAIN_ORACLE_V1,
          unsignedReceipt,
        ),
        payload: receiptPayload,
      });
    const receiptLogicalBytes = canonicalBytesOracleV1(receipt).byteLength;
    expect(receiptLogicalBytes).toBeGreaterThan(
      PROVIDER_TRUST_HISTORY_POLICY_V1
        .maxSingleAcceptanceCompareAppendReceiptLogicalBytes,
    );
    expect(canonicalBytesOracleV1(candidate).byteLength).toBeLessThanOrEqual(
      PROVIDER_TRUST_HISTORY_POLICY_V1.maxSingleTrustEnvelopeLogicalBytes,
    );

    await rewriteAuthenticatedSnapshotAndPublicationOracleV1(
      root,
      (snapshot) => {
        const previousSnapshotContentDigest = snapshot.snapshotContentDigest;
        snapshot.payload.snapshotRevision = 2;
        snapshot.payload.previousSnapshotContentDigest =
          previousSnapshotContentDigest;
        snapshot.payload.receipts.push({
          logicalLocator:
            `provider/acceptance/compare-append-receipts/${request.operationNonce}.json`,
          logicalBytes: receiptLogicalBytes,
          envelope: receipt,
        });
        snapshot.payload.transactions.push({
          transactionRevision: 2,
          previousEventDigest: snapshot.payload.transactions[0].eventDigest,
          operationNonce: request.operationNonce,
          requestContentDigest,
          receiptContentDigest: receipt.contentDigest,
          resultingHighWaterContentDigest: current.highWater.contentDigest,
          eventDigest: `sha256:${"0".repeat(64)}`,
          eventToken: `hmac-sha256:${"0".repeat(64)}`,
        });
        resignTransactionChainOracleV1(snapshot);
      },
    );
    await expectRedactedAuthorityErrorV1(
      openAndReadCurrentV1(capability),
      root,
      ["namespace_integrity_failed"],
    );
  });

  it("rejects byte-exact replay of an older valid canonical snapshot", async () => {
    const { root, capability, store } = await fixtureV1();
    await store.compareAppend(genesisRequestV1());
    const snapshotPath = locatorV1(root, "canonicalSnapshot");
    const validG1Bytes = await readFile(snapshotPath);
    const g1 = await store.readCurrent();
    if (g1.state !== "current") throw new Error("expected G1");
    await store.compareAppend(successorRequestV1({
      current: g1.current,
      operationNonce: operationNonceV1(2),
    }));

    await writeFile(snapshotPath, validG1Bytes, { mode: 0o600 });
    await expectRedactedAuthorityErrorV1(
      openAndReadCurrentV1(capability),
      root,
      ["namespace_integrity_failed"],
    );
  });

  it("rejects byte-exact replay of an older valid publication pin without authenticated intent", async () => {
    const { root, capability, store } = await fixtureV1();
    await store.compareAppend(genesisRequestV1());
    const publicationPath = locatorV1(root, "canonicalPublicationPin");
    const validG1PublicationBytes = await readFile(publicationPath);
    const g1 = await store.readCurrent();
    if (g1.state !== "current") throw new Error("expected G1");
    await store.compareAppend(successorRequestV1({
      current: g1.current,
      operationNonce: operationNonceV1(2),
    }));

    await writeFile(publicationPath, validG1PublicationBytes, { mode: 0o600 });
    await expectRedactedAuthorityErrorV1(
      openAndReadCurrentV1(capability),
      root,
      ["namespace_integrity_failed"],
    );
  });

  it("rejects a missing canonical snapshot when a publication pin exists", async () => {
    const { root, capability, store } = await fixtureV1();
    await store.compareAppend(genesisRequestV1());
    await unlink(locatorV1(root, "canonicalSnapshot"));
    await expectRedactedAuthorityErrorV1(
      openAndReadCurrentV1(capability),
      root,
      ["namespace_integrity_failed"],
    );
  });

  it("rejects a missing publication pin after a non-genesis publication", async () => {
    const { root, capability, store } = await fixtureV1();
    await commitThreeV1(store);
    await unlink(locatorV1(root, "canonicalPublicationPin"));
    await expectRedactedAuthorityErrorV1(
      openAndReadCurrentV1(capability),
      root,
      ["namespace_integrity_failed"],
    );
  });
});

describe("provider Acceptance authority filesystem object checks", () => {
  const fileTamperCases = [
    {
      name: "symlink",
      async apply(path: string) {
        const saved = `${path}.saved`;
        await rename(path, saved);
        await symlink(saved, path);
      },
    },
    {
      name: "hardlink",
      async apply(path: string) {
        await link(path, `${path}.second-link`);
      },
    },
    {
      name: "mode",
      async apply(path: string) {
        await chmod(path, 0o640);
      },
    },
    {
      name: "type",
      async apply(path: string) {
        await unlink(path);
        await mkdir(path, { mode: 0o700 });
      },
    },
  ] as const;

  it("materializes every authority file as owner-bound mode 0600 with nlink one", async () => {
    const { root, store } = await fixtureV1();
    await store.compareAppend(genesisRequestV1());
    const uid = process.geteuid!();
    const gid = process.getegid!();
    for (const locator of [
      "installationIdentityKey",
      "installationIdentityInitializationMarker",
      "installationIdentityState",
      "canonicalSnapshot",
      "canonicalPublicationPin",
    ] as const) {
      const metadata = await lstat(locatorV1(root, locator));
      expect({
        file: metadata.isFile(),
        symlink: metadata.isSymbolicLink(),
        uid: metadata.uid,
        gid: metadata.gid,
        mode: metadata.mode & 0o777,
        nlink: metadata.nlink,
      }).toEqual({
        file: true,
        symlink: false,
        uid,
        gid,
        mode: 0o600,
        nlink: 1,
      });
    }
  });

  for (const testCase of fileTamperCases) {
    it(`rejects identity-key ${testCase.name} tamper`, async () => {
      const { root, capability } = await fixtureV1();
      await testCase.apply(locatorV1(root, "installationIdentityKey"));
      await expectRedactedAuthorityErrorV1(
        openProviderAcceptanceAuthorityStoreForTestInternalV1(capability),
        root,
        ["identity_key_invalid", "namespace_integrity_failed"],
      );
    });

    it(`rejects canonical-snapshot ${testCase.name} tamper`, async () => {
      const { root, capability, store } = await fixtureV1();
      await store.compareAppend(genesisRequestV1());
      await testCase.apply(locatorV1(root, "canonicalSnapshot"));
      await expectRedactedAuthorityErrorV1(
        openAndReadCurrentV1(capability),
        root,
        ["namespace_integrity_failed"],
      );
    });

    it(`rejects publication-pin ${testCase.name} tamper`, async () => {
      const { root, capability, store } = await fixtureV1();
      await store.compareAppend(genesisRequestV1());
      await testCase.apply(locatorV1(root, "canonicalPublicationPin"));
      await expectRedactedAuthorityErrorV1(
        openAndReadCurrentV1(capability),
        root,
        ["namespace_integrity_failed"],
      );
    });
  }

  for (const locator of [
    "installationIdentityKey",
    "canonicalSnapshot",
    "canonicalPublicationPin",
  ] as const) {
    it.runIf(typeof process.geteuid === "function" && process.geteuid() === 0)(
      `rejects ${locator} owner mismatch`,
      async () => {
        const { root, capability, store } = await fixtureV1();
        await store.compareAppend(genesisRequestV1());
        const uid = process.geteuid!();
        const gid = process.getegid!();
        await chown(locatorV1(root, locator), uid + 1, gid);
        await expectRedactedAuthorityErrorV1(
          locator === "installationIdentityKey"
            ? openProviderAcceptanceAuthorityStoreForTestInternalV1(capability)
            : openAndReadCurrentV1(capability),
          root,
          ["identity_key_invalid", "namespace_integrity_failed"],
        );
      },
    );
  }

  for (const locator of [
    "deterministicSnapshotStage",
    "deterministicPublicationPinStage",
    "transactionLock",
  ] as const) {
    for (const testCase of fileTamperCases) {
      it(`rejects ${locator} ${testCase.name} tamper`, async () => {
        const { root, store } = await fixtureV1();
        await store.compareAppend(genesisRequestV1());
        const current = await store.readCurrent();
        if (current.state !== "current") throw new Error("expected current");
        const path = locatorV1(root, locator);
        await writeFile(path, "{}", { mode: 0o600 });
        await testCase.apply(path);
        await expectRedactedAuthorityErrorV1(
          store.compareAppend(successorRequestV1({
            current: current.current,
            operationNonce: operationNonceV1(41),
          })),
          root,
          locator === "transactionLock"
            ? ["authority_busy"]
            : ["namespace_integrity_failed"],
        );
      });
    }
  }
});

describe("provider Acceptance authority observable health surface", () => {
  it("reports locked candidate state without paths, keys, or trust tokens", async () => {
    const { root, store } = await fixtureV1();
    await store.compareAppend(genesisRequestV1());
    const doctor = await store.doctor();
    expect(doctor).toMatchObject({
      status: "ready",
      authority: "installation_owner_candidate",
      strongWrites: "locked",
      namespace: "current",
      generationCount: 1,
      receiptCount: 1,
    });
    const visible = JSON.stringify(doctor);
    expect(visible).not.toContain(root);
    expect(visible).not.toContain("hmac-sha256:");
    expect(visible).not.toContain(
      Buffer.from(TEST_INSTALLATION_IDENTITY_KEY).toString("hex"),
    );
  });
});
