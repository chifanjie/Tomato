import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "@understand-code/durable-object-provider-contracts/jcs";
import {
  ProviderAcceptanceCurrentReadV1Schema,
} from "@understand-code/durable-object-provider-contracts/provider-acceptance";
import { afterEach, describe, expect, it } from "vitest";

import * as publicAuthorityApi from "../src/index.js";
import {
  createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  inspectProviderStrongMutationBrokerSnapshotForTestInternalV1,
  openProviderAcceptanceAuthorityStoreForTestInternalV1,
  openProviderStrongMutationBrokerStoreForTestInternalV1,
  provisionProviderAcceptanceAuthorityForTestInternalV1,
} from "../src/test-seam-internal.js";
import {
  TEST_INSTALLATION_IDENTITY_GENERATION_ID,
  TEST_INSTALLATION_IDENTITY_KEY,
  cloneJsonV1,
  genesisRequestV1,
  operationNonceV1,
  successorRequestV1,
  testAuthorityClockV1,
} from "./acceptance-store-fixtures.js";
import {
  brokerResolveRequestV1,
  canonicalDigestOracleV1,
  currentAcceptanceIdentityV1,
  strongMutationCompareRequestV1,
  strongMutationCompareResponseV1,
  strongMutationBindingDigestOracleV1,
  strongMutationRequestDigestOracleV1,
  strongMutationRequestV1,
  strongMutationResponseV1,
} from "./strong-mutation-broker-fixtures.js";

const fixtureRoots = new Set<string>();

afterEach(async () => {
  await Promise.all(
    [...fixtureRoots].map((root) => rm(root, { recursive: true, force: true })),
  );
  fixtureRoots.clear();
});

async function fixtureV1() {
  const root = await mkdtemp(join(tmpdir(), "strong-mutation-broker-"));
  fixtureRoots.add(root);
  const capability =
    createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1(root);
  await provisionProviderAcceptanceAuthorityForTestInternalV1(capability, {
    installationIdentityGenerationId:
      TEST_INSTALLATION_IDENTITY_GENERATION_ID,
    installationIdentityKey: TEST_INSTALLATION_IDENTITY_KEY,
  });
  const acceptance =
    await openProviderAcceptanceAuthorityStoreForTestInternalV1(capability, {
      clock: testAuthorityClockV1,
    });
  await acceptance.compareAppend(genesisRequestV1());
  const read = await acceptance.readCurrent();
  if (read.state !== "current") throw new Error("expected Acceptance current");
  const current = ProviderAcceptanceCurrentReadV1Schema.parse(read.current);
  const broker =
    await openProviderStrongMutationBrokerStoreForTestInternalV1(capability, {
      clock: testAuthorityClockV1,
    });
  return { root, capability, acceptance, current, broker };
}

async function allFilesV1(root: string): Promise<readonly string[]> {
  const output: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else output.push(relative(root, path));
    }
  };
  await visit(root);
  return output.sort();
}

function expectPendingV1(result: Awaited<ReturnType<
  Awaited<ReturnType<typeof openProviderStrongMutationBrokerStoreForTestInternalV1>>["begin"]
>>) {
  expect(result.resolution).toBe("recorded");
  if (result.resolution !== "recorded") throw new Error("expected recorded");
  expect(result.intent.state).toBe("pending");
  return result.intent;
}

describe("locked strong-mutation broker transaction candidate", () => {
  it("joins the exact fresh Acceptance current and records independently derived bindings without provider I/O", async () => {
    const { root, capability, current, broker } = await fixtureV1();
    expect(broker).toMatchObject({
      authority: "installation_owner_candidate",
      strongWrites: "locked",
      grantVerification: "not_established",
      executionFence: "not_established",
    });
    const request = strongMutationRequestV1(current);
    const result = await broker.begin(request);
    expect(result).toMatchObject({
      resolution: "recorded",
      disposition: "created",
    });
    const intent = expectPendingV1(result);
    expect(intent).toMatchObject({
      grantId: request.authorityGrant.grantId,
      acceptanceIdentity: currentAcceptanceIdentityV1(current),
      requestDigest: request.requestDigest,
      bindingDigest: request.bindingDigest,
      grantVerification: "not_established",
      executionFence: "not_established",
      strongWrites: "locked",
      state: "pending",
    });

    const independentRequestDigest = strongMutationRequestDigestOracleV1({
      operation: request.operation,
      operationNonce: request.operationNonce,
      payload: request.payload,
    });
    const independentBindingDigest = strongMutationBindingDigestOracleV1({
      principalAttestationDigest: request.principalAttestationDigest,
      operation: request.operation,
      operationNonce: request.operationNonce,
      requestDigest: independentRequestDigest,
      authorityGrant: request.authorityGrant,
    });
    expect(intent.requestContentDigest).toBe(canonicalDigestOracleV1(request));
    expect(intent.requestDigest).toBe(independentRequestDigest);
    expect(intent.bindingDigest).toBe(independentBindingDigest);

    // The deliberately synthetic grant signature is only structurally parsed.
    // This slice neither verifies an active Registry key nor authorizes a write.
    expect(intent.request.authorityGrant.payload.signature).toBe(
      `base64url:${Buffer.alloc(64, 7).toString("base64url")}`,
    );
    expect(await allFilesV1(root)).toEqual([
      "runtime-state/private/installation-identity-v1.init",
      "runtime-state/private/installation-identity-v1.json",
      "runtime-state/private/installation-identity-v1.key",
      "runtime-state/private/provider-acceptance-authority-v1.publication.json",
      "runtime-state/private/provider-acceptance-authority-v1.snapshot.json",
      "runtime-state/private/provider-strong-mutation-broker-v1.publication.json",
      "runtime-state/private/provider-strong-mutation-broker-v1.snapshot.json",
    ]);
    await expect(
      inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(capability),
    ).resolves.toMatchObject({
      snapshotRevision: 1,
      intentCount: 1,
      pendingCount: 1,
      resolvedCount: 0,
    });
  });

  it("replays the same grant and exact request byte-for-byte after restart without a write", async () => {
    const { capability, current, broker } = await fixtureV1();
    const request = strongMutationRequestV1(current);
    const created = await broker.begin(request);
    const createdBytes = JSON.stringify(created);
    const before =
      await inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(
        capability,
      );
    const restarted =
      await openProviderStrongMutationBrokerStoreForTestInternalV1(capability, {
        clock: testAuthorityClockV1,
      });
    const replayed = await restarted.begin(cloneJsonV1(request));
    expect(replayed).toMatchObject({
      resolution: "recorded",
      disposition: "replayed",
    });
    if (replayed.resolution !== "recorded") throw new Error("expected replay");
    expect(JSON.stringify({
      ...replayed,
      disposition: "created",
    })).toBe(createdBytes);
    await expect(
      inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(capability),
    ).resolves.toEqual(before);
  });

  it("rejects the same grant with a different full request at zero writes", async () => {
    const { capability, current, broker } = await fixtureV1();
    const original = strongMutationRequestV1(current, {
      requestId: "4".repeat(32),
    });
    const differentRequest = strongMutationRequestV1(current, {
      requestId: "5".repeat(32),
    });
    expect(differentRequest.authorityGrant.grantId).toBe(
      original.authorityGrant.grantId,
    );
    expect(differentRequest.requestDigest).toBe(original.requestDigest);
    expect(differentRequest.bindingDigest).toBe(original.bindingDigest);
    expect(canonicalizeJcsSafeIntegerUtf8V1(differentRequest)).not.toEqual(
      canonicalizeJcsSafeIntegerUtf8V1(original),
    );
    await broker.begin(original);
    const before =
      await inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(
        capability,
      );
    const rejected = await broker.begin(differentRequest);
    expect(rejected).toMatchObject({
      resolution: "request_rejected",
      reason: "grant_request_mismatch",
      existingIntent: { request: original },
    });
    await expect(
      inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(capability),
    ).resolves.toEqual(before);
  });

  it.each([
    ["requestDigest", `sha256:${"e".repeat(64)}`],
    ["bindingDigest", `sha256:${"f".repeat(64)}`],
    ["principalAttestationDigest", `sha256:${"a".repeat(64)}`],
  ] as const)(
    "rejects a structurally valid outer request with a mismatched %s at zero writes",
    async (field, value) => {
      const { capability, current, broker } = await fixtureV1();
      const mutated: any = cloneJsonV1(strongMutationRequestV1(current));
      mutated[field] = value;
      const before =
        await inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(
          capability,
        );
      await expect(broker.begin(mutated)).rejects.toMatchObject({
        code: "invalid_request",
      });
      await expect(
        inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(
          capability,
        ),
      ).resolves.toEqual(before);
    },
  );

  it("serializes duplicate begins into one created intent and one replay", async () => {
    const { capability, current, broker } = await fixtureV1();
    const request = strongMutationRequestV1(current);
    const results = await Promise.all([
      broker.begin(cloneJsonV1(request)),
      broker.begin(cloneJsonV1(request)),
    ]);
    expect(results.map((result) =>
      result.resolution === "recorded" ? result.disposition : result.resolution
    ).sort()).toEqual(["created", "replayed"]);
    await expect(
      inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(capability),
    ).resolves.toMatchObject({
      snapshotRevision: 1,
      intentCount: 1,
    });
  });

  it("fails a stale Acceptance basis closed when current advances before begin", async () => {
    const { capability, acceptance, current, broker } = await fixtureV1();
    const stale = strongMutationRequestV1(current);
    await acceptance.compareAppend(successorRequestV1({
      current,
      operationNonce: operationNonceV1(2),
      floors: {
        rootMetadataGeneration: 2,
        registryManifestGeneration: 2,
        supportCatalogGeneration: 2,
      },
    }));
    const before =
      await inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(
        capability,
      );
    await expect(broker.begin(stale)).rejects.toMatchObject({
      code: "invalid_request",
    });
    await expect(
      inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(capability),
    ).resolves.toEqual(before);
  });

  it("replays historical pending and resolved G1 intents exactly after Acceptance advances to G2", async () => {
    const { capability, acceptance, current, broker } = await fixtureV1();
    const resolvedRequest = strongMutationRequestV1(current, {
      nonceDigit: "6",
      requestId: "6".repeat(32),
    });
    const pendingRequest = strongMutationRequestV1(current, {
      nonceDigit: "7",
      requestId: "7".repeat(32),
    });
    const resolvedPending = expectPendingV1(
      await broker.begin(resolvedRequest),
    );
    const originalResolved = await broker.resolve(
      brokerResolveRequestV1(
        resolvedPending,
        strongMutationResponseV1(resolvedRequest),
      ),
    );
    expect(originalResolved.resolution).toBe("resolved");
    const originalPending = await broker.begin(pendingRequest);
    expect(originalPending).toMatchObject({
      resolution: "recorded",
      disposition: "created",
      intent: { state: "pending" },
    });
    await acceptance.compareAppend(successorRequestV1({
      current,
      operationNonce: operationNonceV1(2),
      floors: {
        rootMetadataGeneration: 2,
        registryManifestGeneration: 2,
        supportCatalogGeneration: 2,
      },
    }));
    const beforeReplay =
      await inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(
        capability,
      );

    const resolvedReplay = await broker.begin(cloneJsonV1(resolvedRequest));
    const pendingReplay = await broker.begin(cloneJsonV1(pendingRequest));
    expect(resolvedReplay).toMatchObject({
      resolution: "recorded",
      disposition: "replayed",
      intent: { state: "resolved" },
    });
    expect(pendingReplay).toMatchObject({
      resolution: "recorded",
      disposition: "replayed",
      intent: { state: "pending" },
    });
    if (
      resolvedReplay.resolution !== "recorded" ||
      pendingReplay.resolution !== "recorded" ||
      originalResolved.resolution !== "resolved" ||
      originalPending.resolution !== "recorded"
    ) {
      throw new Error("expected exact historical replays");
    }
    expect(resolvedReplay.intent).toEqual(originalResolved.intent);
    expect(pendingReplay.intent).toEqual(originalPending.intent);

    const sameGrantDifferentRequest = strongMutationRequestV1(current, {
      nonceDigit: "6",
      requestId: "8".repeat(32),
    });
    await expect(broker.begin(sameGrantDifferentRequest)).resolves.toMatchObject({
      resolution: "request_rejected",
      reason: "grant_request_mismatch",
      existingIntent: originalResolved.intent,
    });
    await expect(
      inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(capability),
    ).resolves.toEqual(beforeReplay);
  });

  it("resolves and replays an exact G1 pending intent after Acceptance advances to G2 while the execution fence remains unestablished", async () => {
    const { capability, acceptance, current, broker } = await fixtureV1();
    const request = strongMutationRequestV1(current, {
      nonceDigit: "9",
      requestId: "9".repeat(32),
    });
    const pending = expectPendingV1(await broker.begin(request));
    await acceptance.compareAppend(successorRequestV1({
      current,
      operationNonce: operationNonceV1(2),
      floors: {
        rootMetadataGeneration: 2,
        registryManifestGeneration: 2,
        supportCatalogGeneration: 2,
      },
    }));

    const resolveRequest = brokerResolveRequestV1(
      pending,
      strongMutationResponseV1(request),
    );
    const resolved = await broker.resolve(resolveRequest);
    expect(resolved).toMatchObject({
      resolution: "resolved",
      disposition: "created",
      intent: {
        state: "resolved",
        acceptanceIdentity: pending.acceptanceIdentity,
        executionFence: "not_established",
        responseVerification: "not_established",
        strongWrites: "locked",
      },
    });
    if (resolved.resolution !== "resolved") throw new Error("expected resolved");
    await expect(
      inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(capability),
    ).resolves.toMatchObject({
      snapshotRevision: 2,
      intentCount: 1,
      pendingCount: 0,
      resolvedCount: 1,
    });

    const restarted =
      await openProviderStrongMutationBrokerStoreForTestInternalV1(capability, {
        clock: testAuthorityClockV1,
      });
    const replay = await restarted.resolve(cloneJsonV1(resolveRequest));
    expect(replay).toMatchObject({
      resolution: "resolved",
      disposition: "replayed",
      intent: { executionFence: "not_established" },
    });
    if (replay.resolution !== "resolved") throw new Error("expected replay");
    expect(replay.intent).toEqual(resolved.intent);
  });

  it("loads and joins a multi-intent snapshot without changing existing records", async () => {
    const { capability, current, broker } = await fixtureV1();
    const requests = [..."0123456789ab"].map((nonceDigit, index) =>
      strongMutationRequestV1(current, {
        nonceDigit,
        requestId: index.toString(16).padStart(32, "0"),
        body: `independent broker intent ${String(index)}`,
      })
    );
    const originals = [];
    for (const request of requests) originals.push(await broker.begin(request));
    const before =
      await inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(
        capability,
      );
    expect(before).toMatchObject({
      snapshotRevision: requests.length,
      intentCount: requests.length,
      pendingCount: requests.length,
      resolvedCount: 0,
    });
    const reopened =
      await openProviderStrongMutationBrokerStoreForTestInternalV1(capability, {
        clock: testAuthorityClockV1,
      });
    for (const [index, request] of requests.entries()) {
      const replay = await reopened.begin(request);
      expect(replay).toMatchObject({
        resolution: "recorded",
        disposition: "replayed",
      });
      if (replay.resolution !== "recorded") throw new Error("expected replay");
      if (originals[index]?.resolution !== "recorded") {
        throw new Error("expected original record");
      }
      expect(replay.intent).toEqual(originals[index].intent);
    }
    await expect(
      inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(capability),
    ).resolves.toEqual(before);
  });

  it("durably resolves pending to resolved, binds every response field, and marks signature verification unestablished", async () => {
    const { capability, current, broker } = await fixtureV1();
    const request = strongMutationRequestV1(current);
    const pending = expectPendingV1(await broker.begin(request));
    const response = strongMutationResponseV1(request);
    const resolved = await broker.resolve(
      brokerResolveRequestV1(pending, response),
    );
    expect(resolved).toMatchObject({
      resolution: "resolved",
      disposition: "created",
      intent: {
        state: "resolved",
        response,
        responseVerification: "not_established",
        grantVerification: "not_established",
        executionFence: "not_established",
        strongWrites: "locked",
      },
    });
    if (resolved.resolution !== "resolved") throw new Error("expected resolved");
    expect(resolved.intent.responseContentDigest).toBe(
      canonicalDigestOracleV1(response),
    );
    await expect(
      inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(capability),
    ).resolves.toMatchObject({
      snapshotRevision: 2,
      intentCount: 1,
      pendingCount: 0,
      resolvedCount: 1,
    });

    const beforeReplay =
      await inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(
        capability,
      );
    const replay = await broker.resolve(
      brokerResolveRequestV1(pending, cloneJsonV1(response)),
    );
    expect(replay).toMatchObject({
      resolution: "resolved",
      disposition: "replayed",
    });
    const differentUnverifiedSignature = strongMutationResponseV1(request, {
      signatureByte: 10,
    });
    await expect(
      broker.resolve(
        brokerResolveRequestV1(pending, differentUnverifiedSignature),
      ),
    ).resolves.toMatchObject({
      resolution: "request_rejected",
      reason: "response_mismatch",
    });
    await expect(
      inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(capability),
    ).resolves.toEqual(beforeReplay);
  });

  it.each([
    {
      name: "locator",
      mutate(response: any) {
        response.payload.locator.providerId =
          "durable-object-provider:wrong-response-object";
      },
    },
    {
      name: "logicalBytes",
      mutate(response: any) {
        response.payload.logicalBytes += 1;
      },
    },
    {
      name: "verifiedContentDigest",
      mutate(response: any) {
        response.payload.verifiedContentDigest = `sha256:${"0".repeat(64)}`;
      },
    },
  ])(
    "rejects a write success with mismatched $name before the pending intent changes",
    async (testCase) => {
      const { capability, current, broker } = await fixtureV1();
      const request = strongMutationRequestV1(current);
      const pending = expectPendingV1(await broker.begin(request));
      const response: any = cloneJsonV1(strongMutationResponseV1(request));
      testCase.mutate(response);
      const before =
        await inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(
          capability,
        );
      await expect(
        broker.resolve(brokerResolveRequestV1(pending, response)),
      ).rejects.toMatchObject({ code: "invalid_request" });
      await expect(
        inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(
          capability,
        ),
      ).resolves.toEqual(before);
    },
  );

  it.each([
    {
      name: "next revision",
      mutate(response: any) {
        response.payload.state.revision += 1;
      },
    },
    {
      name: "phase",
      mutate(response: any) {
        response.payload.state.phase = "wrong-committed-phase";
      },
    },
    {
      name: "operation nonce",
      mutate(response: any) {
        response.payload.state.operationNonce = "f".repeat(32);
      },
    },
    {
      name: "artifacts",
      mutate(response: any) {
        response.payload.state.artifacts = { wrong: true };
      },
    },
    {
      name: "nonempty mutation digest",
      mutate(response: any) {
        response.payload.state.mutationDigest = "none";
      },
    },
  ])(
    "rejects a compare committed response with mismatched $name at zero writes",
    async (testCase) => {
      const { capability, current, broker } = await fixtureV1();
      const request = strongMutationCompareRequestV1(current);
      const pending = expectPendingV1(await broker.begin(request));
      const response: any = cloneJsonV1(
        strongMutationCompareResponseV1(request, "committed"),
      );
      testCase.mutate(response);
      const before =
        await inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(
          capability,
        );
      await expect(
        broker.resolve(brokerResolveRequestV1(pending, response)),
      ).rejects.toMatchObject({ code: "invalid_request" });
      await expect(
        inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(
          capability,
        ),
      ).resolves.toEqual(before);
    },
  );

  it.each(["committed", "replayed", "stale", "error"] as const)(
    "keeps a compare %s outcome reachable without over-constraining its provider head",
    async (resolution) => {
      const { current, broker } = await fixtureV1();
      const request = strongMutationCompareRequestV1(current);
      const pending = expectPendingV1(await broker.begin(request));
      const response = strongMutationCompareResponseV1(request, resolution);
      await expect(
        broker.resolve(brokerResolveRequestV1(pending, response)),
      ).resolves.toMatchObject({
        resolution: "resolved",
        disposition: "created",
        intent: {
          state: "resolved",
          response,
          executionFence: "not_established",
          responseVerification: "not_established",
        },
      });
    },
  );

  it.each([
    ["requestId", "a".repeat(32)],
    ["principalAttestationDigest", `sha256:${"a".repeat(64)}`],
    ["bindingDigest", `sha256:${"b".repeat(64)}`],
    ["operationNonce", "c".repeat(32)],
    ["requestDigest", `sha256:${"d".repeat(64)}`],
  ] as const)(
    "rejects a response with mismatched %s before the pending intent changes",
    async (field, value) => {
      const { capability, current, broker } = await fixtureV1();
      const request = strongMutationRequestV1(current);
      const pending = expectPendingV1(await broker.begin(request));
      const response: any = cloneJsonV1(strongMutationResponseV1(request));
      response[field] = value;
      const before =
        await inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(
          capability,
        );
      await expect(
        broker.resolve(brokerResolveRequestV1(pending, response)),
      ).rejects.toMatchObject({ code: "invalid_request" });
      await expect(
        inspectProviderStrongMutationBrokerSnapshotForTestInternalV1(
          capability,
        ),
      ).resolves.toEqual(before);
    },
  );
});

describe("locked broker public boundary", () => {
  it("does not export begin, resolve, a broker store, or a CLI/package deep API", async () => {
    expect(publicAuthorityApi.PROVIDER_ACCEPTANCE_AUTHORITY_CANDIDATE_STATUS_V1)
      .toEqual({
        authority: "installation_owner_candidate",
        strongWrites: "locked",
      });
    expect(Object.keys(
      publicAuthorityApi.PROVIDER_ACCEPTANCE_AUTHORITY_LOGICAL_LOCATORS_V1,
    )).toEqual([
      "installationIdentityKey",
      "installationIdentityInitializationMarker",
      "installationIdentityState",
      "acceptanceGenerationPrefix",
      "acceptanceCurrent",
      "acceptanceReceiptPrefix",
      "canonicalSnapshot",
      "deterministicSnapshotStage",
      "canonicalPublicationPin",
      "deterministicPublicationPinStage",
      "transactionLock",
      "transactionLockStage",
      "transactionLockRecoveryClaim",
      "transactionLockQuarantine",
    ]);
    expect(
      Object.values(
        publicAuthorityApi.PROVIDER_ACCEPTANCE_AUTHORITY_LOGICAL_LOCATORS_V1,
      ).join("\n"),
    ).not.toMatch(/strong.?mutation|broker/ui);
    for (const name of [
      "begin",
      "resolve",
      "openProviderStrongMutationBrokerStoreWithLayoutCoreInternalV1",
      "openProviderStrongMutationBrokerStoreForTestInternalV1",
    ]) {
      expect(publicAuthorityApi).not.toHaveProperty(name);
    }
    const packageJson = JSON.parse(
      await readFile(
        new URL("../package.json", import.meta.url),
        "utf8",
      ),
    );
    expect(packageJson.exports).toEqual({
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
        default: "./dist/index.js",
      },
      "./internal/acceptance-store": {
        types: "./dist/acceptance-store-internal.d.ts",
        import: "./dist/acceptance-store-internal.js",
        default: "./dist/acceptance-store-internal.js",
      },
    });
    await expect(stat(new URL("../src/cli.ts", import.meta.url))).resolves
      .toMatchObject({ size: expect.any(Number) });
    const cliSource = await readFile(
      new URL("../src/cli.ts", import.meta.url),
      "utf8",
    );
    expect(cliSource).not.toMatch(/strong.?mutation|broker|\bbegin\b|\bresolve\b/ui);
  });
});
