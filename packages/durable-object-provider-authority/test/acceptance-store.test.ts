import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ProviderAcceptanceCompareAppendRequestV1Schema,
  ProviderAcceptanceCompareAppendResultV1Schema,
  ProviderAcceptanceCurrentReadV1Schema,
  ProviderAcceptanceStateEnvelopeV1Schema,
  createProviderAcceptanceCompareAppendReceiptTokenMessageV1,
  createProviderAcceptanceCurrentVersionTokenMessageV1,
  createProviderAcceptanceStateTokenMessageV1,
  deriveProviderAcceptanceStateContentDigestV1,
  type ProviderAcceptanceCompareAppendResultV1,
  type ProviderAcceptanceCurrentReadV1,
} from "@understand-code/durable-object-provider-contracts/provider-acceptance";
import { afterEach, describe, expect, it } from "vitest";

import {
  createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  inspectProviderAcceptanceAuthoritySnapshotForTestInternalV1,
  openProviderAcceptanceAuthorityStoreForTestInternalV1,
  provisionProviderAcceptanceAuthorityForTestInternalV1,
} from "../src/test-seam-internal.js";
import {
  TEST_INSTALLATION_IDENTITY_GENERATION_ID,
  TEST_INSTALLATION_IDENTITY_KEY,
  TEST_OTHER_INSTALLATION_IDENTITY_KEY,
  acceptanceEnvelopeV1,
  cloneJsonV1,
  genesisRequestV1,
  hmacTokenOracleV1,
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

async function authorityFixtureV1() {
  const root = await mkdtemp(join(tmpdir(), "provider-acceptance-authority-"));
  fixtureRoots.add(root);
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

function resolvedReceiptV1(result: ProviderAcceptanceCompareAppendResultV1) {
  expect(result.resolution).toBe("resolved");
  if (result.resolution !== "resolved") throw new Error("expected receipt");
  return result.receipt;
}

function committedCurrentV1(
  current: Awaited<
    ReturnType<
      Awaited<
        ReturnType<
          typeof openProviderAcceptanceAuthorityStoreForTestInternalV1
        >
      >["readCurrent"]
    >
  >,
): ProviderAcceptanceCurrentReadV1 {
  expect(current.state).toBe("current");
  if (current.state !== "current") throw new Error("expected current");
  return ProviderAcceptanceCurrentReadV1Schema.parse(current.current);
}

function expectIndependentTokensV1(
  result: ProviderAcceptanceCompareAppendResultV1,
): void {
  const receipt = resolvedReceiptV1(result);
  expect(receipt.payload.receiptToken).toBe(
    hmacTokenOracleV1(
      TEST_INSTALLATION_IDENTITY_KEY,
      createProviderAcceptanceCompareAppendReceiptTokenMessageV1(
        receipt.payload,
      ),
    ),
  );
  if (receipt.payload.durableOutcome.outcome === "committed") {
    const highWater = receipt.payload.durableOutcome.committedHighWater;
    expect(highWater.currentVersionToken).toBe(
      hmacTokenOracleV1(
        TEST_INSTALLATION_IDENTITY_KEY,
        createProviderAcceptanceCurrentVersionTokenMessageV1(highWater),
      ),
    );
  }
}

describe("provider Acceptance authority compare-append closure", () => {
  it("commits formal G1, G2, and G3 with a complete authenticated current closure", async () => {
    const { capability, store } = await authorityFixtureV1();
    expect(store.authority).toBe("installation_owner_candidate");
    expect(store.strongWrites).toBe("locked");
    await expect(store.readCurrent()).resolves.toEqual({ state: "absent" });

    const g1Request = genesisRequestV1();
    const g1 = ProviderAcceptanceCompareAppendResultV1Schema.parse(
      await store.compareAppend(g1Request),
    );
    expect(resolvedReceiptV1(g1).payload.durableOutcome.outcome).toBe(
      "committed",
    );
    expectIndependentTokensV1(g1);

    const current1 = committedCurrentV1(await store.readCurrent());
    const g2Request = successorRequestV1({
      current: current1,
      operationNonce: operationNonceV1(2),
      floors: {
        rootMetadataGeneration: 2,
        registryManifestGeneration: 2,
        supportCatalogGeneration: 2,
      },
    });
    const g2 = ProviderAcceptanceCompareAppendResultV1Schema.parse(
      await store.compareAppend(g2Request),
    );
    expect(resolvedReceiptV1(g2).payload.durableOutcome.outcome).toBe(
      "committed",
    );
    expectIndependentTokensV1(g2);

    const current2 = committedCurrentV1(await store.readCurrent());
    const g3Request = successorRequestV1({
      current: current2,
      operationNonce: operationNonceV1(3),
      floors: {
        rootMetadataGeneration: 3,
        registryManifestGeneration: 3,
        supportCatalogGeneration: 3,
      },
    });
    const g3 = ProviderAcceptanceCompareAppendResultV1Schema.parse(
      await store.compareAppend(g3Request),
    );
    expect(resolvedReceiptV1(g3).payload.durableOutcome.outcome).toBe(
      "committed",
    );
    expectIndependentTokensV1(g3);

    const current3 = committedCurrentV1(await store.readCurrent());
    expect(current3.enumeration.entries).toHaveLength(3);
    expect(current3.enumeration.entries.map((entry) => ({
      ordinal: entry.acceptanceOrdinal,
      nonce: entry.commitOperationNonce,
    }))).toEqual([
      { ordinal: 1, nonce: operationNonceV1(1) },
      { ordinal: 2, nonce: operationNonceV1(2) },
      { ordinal: 3, nonce: operationNonceV1(3) },
    ]);
    expect(current3.highWater.payload).toMatchObject({
      highWaterRevision: 3,
      generationCount: 3,
      operationNonce: operationNonceV1(3),
      acceptedGenerationFloors: {
        rootMetadataGeneration: 3,
        registryManifestGeneration: 3,
        supportCatalogGeneration: 3,
      },
    });
    expect(current3.highWater.payload.generationSetDigest).toBe(
      current3.enumeration.generationSetDigest,
    );
    expect(current3.highWater.currentVersionToken).toBe(
      hmacTokenOracleV1(
        TEST_INSTALLATION_IDENTITY_KEY,
        createProviderAcceptanceCurrentVersionTokenMessageV1(
          current3.highWater,
        ),
      ),
    );
    await expect(
      inspectProviderAcceptanceAuthoritySnapshotForTestInternalV1(capability),
    ).resolves.toMatchObject({
      generationCount: 3,
      receiptCount: 3,
      transactionCount: 3,
    });
  });

  it("returns the original receipt byte-for-byte for a replay after restart and head advancement", async () => {
    const { capability, store } = await authorityFixtureV1();
    const originalRequest = genesisRequestV1();
    const original = ProviderAcceptanceCompareAppendResultV1Schema.parse(
      await store.compareAppend(originalRequest),
    );
    const originalBytes = JSON.stringify(original);

    const restarted =
      await openProviderAcceptanceAuthorityStoreForTestInternalV1(capability, {
        clock: testAuthorityClockV1,
      });
    const current1 = committedCurrentV1(await restarted.readCurrent());
    await restarted.compareAppend(successorRequestV1({
      current: current1,
      operationNonce: operationNonceV1(2),
    }));

    const restartedAgain =
      await openProviderAcceptanceAuthorityStoreForTestInternalV1(capability, {
        clock: testAuthorityClockV1,
      });
    const replay = ProviderAcceptanceCompareAppendResultV1Schema.parse(
      await restartedAgain.compareAppend(cloneJsonV1(originalRequest)),
    );
    expect(JSON.stringify(replay)).toBe(originalBytes);
    await expect(
      inspectProviderAcceptanceAuthoritySnapshotForTestInternalV1(capability),
    ).resolves.toMatchObject({
      generationCount: 2,
      receiptCount: 2,
      transactionCount: 2,
    });
  });

  it("rejects nonce reuse with a different canonical request without any write", async () => {
    const { capability, store } = await authorityFixtureV1();
    const original = ProviderAcceptanceCompareAppendResultV1Schema.parse(
      await store.compareAppend(genesisRequestV1()),
    );
    const before =
      await inspectProviderAcceptanceAuthoritySnapshotForTestInternalV1(
        capability,
      );
    const mismatch = ProviderAcceptanceCompareAppendResultV1Schema.parse(
      await store.compareAppend(genesisRequestV1({
        operationNonce: operationNonceV1(1),
        floors: {
          rootMetadataGeneration: 2,
          registryManifestGeneration: 2,
          supportCatalogGeneration: 2,
        },
      })),
    );
    expect(mismatch).toEqual({
      resolution: "request_rejected",
      reason: "operation_nonce_request_mismatch",
      existingReceipt: resolvedReceiptV1(original),
    });
    expect(
      await inspectProviderAcceptanceAuthoritySnapshotForTestInternalV1(
        capability,
      ),
    ).toEqual(before);
  });

  it("fails wrong-key, wrong-domain, and stale-payload candidate tokens closed as durable candidate_invalid outcomes", async () => {
    const { capability, store } = await authorityFixtureV1();
    const wrongKey = genesisRequestV1({
      operationNonce: operationNonceV1(11),
      key: TEST_OTHER_INSTALLATION_IDENTITY_KEY,
    });

    const wrongDomain: any = cloneJsonV1(genesisRequestV1({
      operationNonce: operationNonceV1(12),
    }));
    wrongDomain.candidate.payload.acceptanceToken = hmacTokenOracleV1(
      TEST_INSTALLATION_IDENTITY_KEY,
      new TextEncoder().encode("provider-acceptance-wrong-domain-v1\0{}"),
    );

    const stalePayload: any = cloneJsonV1(genesisRequestV1({
      operationNonce: operationNonceV1(13),
    }));
    stalePayload.candidate.acceptedAt = "2026-08-20T00:01:13Z";
    stalePayload.candidate.payload.acceptedAt = stalePayload.candidate.acceptedAt;
    stalePayload.candidate.contentDigest =
      deriveProviderAcceptanceStateContentDigestV1(
        stalePayload.candidate.payload,
      );

    for (const request of [wrongKey, wrongDomain, stalePayload]) {
      const structurallyValid = ProviderAcceptanceCompareAppendRequestV1Schema
        .parse(request);
      const receipt = resolvedReceiptV1(
        ProviderAcceptanceCompareAppendResultV1Schema.parse(
          await store.compareAppend(structurallyValid),
        ),
      );
      expect(receipt.payload.durableOutcome).toMatchObject({
        outcome: "not_committed",
        reason: "candidate_invalid",
        observedHighWater: { state: "absent" },
      });
      expectIndependentTokensV1({ resolution: "resolved", receipt });
    }

    await expect(store.readCurrent()).resolves.toEqual({ state: "absent" });
    await expect(
      inspectProviderAcceptanceAuthoritySnapshotForTestInternalV1(capability),
    ).resolves.toMatchObject({
      generationCount: 0,
      receiptCount: 3,
      transactionCount: 3,
    });
  });

  it("durably rejects a generation-floor regression without appending a sibling", async () => {
    const { capability, store } = await authorityFixtureV1();
    await store.compareAppend(genesisRequestV1({
      floors: {
        rootMetadataGeneration: 2,
        registryManifestGeneration: 2,
        supportCatalogGeneration: 2,
      },
    }));
    const current = committedCurrentV1(await store.readCurrent());
    const regressed = resolvedReceiptV1(
      ProviderAcceptanceCompareAppendResultV1Schema.parse(
        await store.compareAppend(successorRequestV1({
          current,
          operationNonce: operationNonceV1(14),
          floors: {
            rootMetadataGeneration: 1,
            registryManifestGeneration: 1,
            supportCatalogGeneration: 1,
          },
        })),
      ),
    );
    expect(regressed.payload.durableOutcome).toMatchObject({
      outcome: "not_committed",
      reason: "generation_floor_regressed",
      observedHighWater: { state: "trusted" },
    });
    expect(
      committedCurrentV1(await store.readCurrent()).enumeration.entries,
    ).toHaveLength(1);
    await expect(
      inspectProviderAcceptanceAuthoritySnapshotForTestInternalV1(capability),
    ).resolves.toMatchObject({
      generationCount: 1,
      receiptCount: 2,
      transactionCount: 2,
    });
  });

  it("rejects a structurally invalid request before any durable write", async () => {
    const { capability, store } = await authorityFixtureV1();
    const before =
      await inspectProviderAcceptanceAuthoritySnapshotForTestInternalV1(
        capability,
      );
    await expect(store.compareAppend({
      ...genesisRequestV1(),
      profile: "provider_acceptance_unknown_request_v1",
    })).rejects.toMatchObject({
      name: "ProviderAcceptanceAuthorityErrorV1",
      code: "invalid_request",
    });
    expect(
      await inspectProviderAcceptanceAuthoritySnapshotForTestInternalV1(
        capability,
      ),
    ).toEqual(before);
  });

  it("binds every accepted candidate token to the independent HMAC oracle", () => {
    const candidate = acceptanceEnvelopeV1({
      acceptanceOrdinal: 1,
      predecessor: { state: "genesis" },
    });
    expect(candidate.payload.acceptanceToken).toBe(
      hmacTokenOracleV1(
        TEST_INSTALLATION_IDENTITY_KEY,
        createProviderAcceptanceStateTokenMessageV1(candidate.payload),
      ),
    );
    expect(
      ProviderAcceptanceStateEnvelopeV1Schema.parse(candidate),
    ).toEqual(candidate);
  });
});
