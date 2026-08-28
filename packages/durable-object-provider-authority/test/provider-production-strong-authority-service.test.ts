import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ProviderAcceptanceCurrentReadV1Schema,
  ProviderAcceptedConfigurationV1Schema,
} from "@understand-code/durable-object-provider-contracts/provider-acceptance";

import * as publicAuthorityApi from "../src/index.js";
import {
  assertProviderProductionCompletedStrongReadyConfigurationInternalV1,
} from "../src/provider-production-strong-authority-service.js";
import {
  Step16ProviderReceiptBindingV1Schema,
} from "../../contracts/dist/step16-host-receipts.js";

import {
  abortProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1,
  appendExpectedOperationProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1,
  beginCollectingProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1,
  createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  beginProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1,
  completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1,
  createProviderProductionStrongAuthorityServiceForTestInternalV1,
  exportProviderProductionStrongAuthorityResolvedReceiptBundlesForTestInternalV1,
  mintProviderProductionStrongAuthorityTrustedHostCallWitnessForTestInternalV1,
  openProviderAcceptanceAuthorityStoreForTestInternalV1,
  openProviderStrongMutationExecutionBrokerStoreForTestInternalV1,
  provisionProviderAcceptanceAuthorityForTestInternalV1,
  registerProviderStrongMutationLinuxExt4ExecutionFenceTestCapabilityInternalV1,
} from "../src/test-seam-internal.js";
import {
  TEST_INSTALLATION_IDENTITY_KEY,
  genesisRequestV1,
  testAuthorityClockV1,
} from "./acceptance-store-fixtures.js";
import {
  TEST_BROKER_INSTALLATION_IDENTITY_GENERATION_ID,
  TEST_BROKER_PROVIDER_ID,
  brokerResolveRequestV1,
  canonicalDigestOracleV1,
  currentAcceptanceIdentityV1,
  strongMutationPrincipalAttestationV1,
  strongMutationRequestV1,
  strongMutationResponseV1,
  strongMutationTrustVerifierV1,
  strongMutationTrustedConfigurationV1,
} from "./strong-mutation-broker-fixtures.js";

const fixtureRoots = new Set<string>();
const STEP16_INSTALLATION_IDENTITY_DIGEST = `sha256:${"e".repeat(64)}`;
const STEP16_CODEX_SESSION_ID_DIGEST = `sha256:${"1".repeat(64)}`;
const STEP16_CODEX_CALL_ID_DIGEST = `sha256:${"2".repeat(64)}`;

afterEach(async () => {
  await Promise.all(
    [...fixtureRoots].map((root) => rm(root, { recursive: true, force: true })),
  );
  fixtureRoots.clear();
});

async function liveStrongAuthorityServiceFixtureV1(
  lifecycle: Readonly<{
    readonly closeServer?: () => Promise<void>;
    readonly closeExactObjectAuthority?: () => Promise<void>;
    readonly enableTrustedHostCallWitnesses?: boolean;
  }> = {},
) {
  const parent = await mkdtemp(join(tmpdir(), "production-strong-authority-"));
  fixtureRoots.add(parent);
  const capability =
    createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1(
      join(parent, "authority"),
    );
  const verifier = await strongMutationTrustVerifierV1();
  await provisionProviderAcceptanceAuthorityForTestInternalV1(capability, {
    installationIdentityGenerationId:
      TEST_BROKER_INSTALLATION_IDENTITY_GENERATION_ID,
    installationIdentityKey: TEST_INSTALLATION_IDENTITY_KEY,
  });
  const acceptance =
    await openProviderAcceptanceAuthorityStoreForTestInternalV1(capability, {
      clock: testAuthorityClockV1,
    });
  await acceptance.compareAppend(genesisRequestV1({
    installationIdentityGenerationId:
      TEST_BROKER_INSTALLATION_IDENTITY_GENERATION_ID,
    configuration: strongMutationTrustedConfigurationV1(),
  }));
  const read = await acceptance.readCurrent();
  if (read.state !== "current") throw new Error("expected Acceptance current");
  const current = ProviderAcceptanceCurrentReadV1Schema.parse(read.current);
  const principalAttestation = strongMutationPrincipalAttestationV1(
    currentAcceptanceIdentityV1(current),
  );
  const request = strongMutationRequestV1(current, { principalAttestation });
  const grant = request.authorityGrant.payload;
  let nextFenceGate: Readonly<{
    entered: () => void;
    released: Promise<void>;
  }> | undefined;
  const holdNextFenceRevalidation = () => {
    let markEntered!: () => void;
    let release!: () => void;
    const entered = new Promise<void>((resolvePromise) => {
      markEntered = resolvePromise;
    });
    const released = new Promise<void>((resolvePromise) => {
      release = resolvePromise;
    });
    nextFenceGate = Object.freeze({ entered: markEntered, released });
    return Object.freeze({ entered, release });
  };
  const executionFence =
    registerProviderStrongMutationLinuxExt4ExecutionFenceTestCapabilityInternalV1({
      profile: "linux_ext4_exact_object_dedicated_os_principal_v1",
      providerId: grant.providerId,
      targetProfileId: grant.targetProfileId,
      targetFingerprintDigest: grant.targetFingerprintDigest,
      capabilityDigest: grant.capabilityDigest,
      installationIdentityGenerationId:
        grant.acceptanceIdentity.installationIdentityGenerationId,
      principal: {
        uid: 501,
        gid: 20,
        handoffPayloadDigest: principalAttestation.handoffPayloadDigest,
      },
      async revalidateExactObjectAuthority(input) {
        const gate = nextFenceGate;
        nextFenceGate = undefined;
        if (gate !== undefined) {
          gate.entered();
          await gate.released;
        }
        return input.request.authorityGrant.payload.providerId ===
            TEST_BROKER_PROVIDER_ID &&
          input.principalAttestation.handoffPayloadDigest ===
            principalAttestation.handoffPayloadDigest;
      },
    });
  const broker =
    await openProviderStrongMutationExecutionBrokerStoreForTestInternalV1(
      capability,
      verifier,
      executionFence,
      { clock: testAuthorityClockV1 },
    );
  const opened = createProviderProductionStrongAuthorityServiceForTestInternalV1(
    broker,
    Object.freeze({
      providerId: TEST_BROKER_PROVIDER_ID,
      installationIdentityDigest: STEP16_INSTALLATION_IDENTITY_DIGEST,
    }),
    lifecycle,
  );
  return {
    broker,
    current,
    principalAttestation,
    request,
    holdNextFenceRevalidation,
    ...opened,
  };
}

function step16ExpectedOperationV1(
  request: ReturnType<typeof strongMutationRequestV1>,
) {
  return Object.freeze({
    operation: request.operation,
    operationNonce: request.operationNonce,
    requestDigest: request.requestDigest,
  });
}

function step16TrustedHostCallWitnessV1(
  expectedProviderOperations: readonly Readonly<{
    readonly operation: "write_object" | "compare_commit";
    readonly operationNonce: string;
    readonly requestDigest: string;
  }>[],
  host: "codex" | "claude" = "codex",
) {
  return mintProviderProductionStrongAuthorityTrustedHostCallWitnessForTestInternalV1({
    host,
    sessionIdDigest: STEP16_CODEX_SESSION_ID_DIGEST,
    callIdDigest: STEP16_CODEX_CALL_ID_DIGEST,
    expectedProviderOperations,
  });
}

async function resolveStrongMutationV1(
  fixture: Awaited<ReturnType<typeof liveStrongAuthorityServiceFixtureV1>>,
  request: ReturnType<typeof strongMutationRequestV1>,
) {
  const begun = await fixture.broker.begin(
    request,
    fixture.principalAttestation,
  );
  if (begun.resolution !== "recorded") throw new Error("expected recorded");
  await fixture.broker.resolve(
    brokerResolveRequestV1(
      begun.intent,
      strongMutationResponseV1(request),
    ),
  );
}

describe("production strong authority Acceptance", () => {
  it("rejects bootstrap or steady strong-ready activation", () => {
    expect(() =>
      assertProviderProductionCompletedStrongReadyConfigurationInternalV1(
        strongMutationTrustedConfigurationV1(),
      )
    ).toThrow("provider strong authority writer is unavailable");
  });

  it("accepts completed-migration strong-ready activation", () => {
    const bootstrap = strongMutationTrustedConfigurationV1();
    if (bootstrap.state !== "strong_ready") throw new Error("fixture invalid");
    const migrationId = `provider-migration:${"b".repeat(22)}`;
    const contentDigest = `sha256:${"9".repeat(64)}`;
    const configuration = ProviderAcceptedConfigurationV1Schema.parse({
      ...bootstrap,
      activation: {
        origin: "completed_provider_migration",
        migrationPlan: {
          locatorProfile: "installation_provider_migration_plan_v1",
          migrationId,
          mode: "same_installation_identity",
          contentDigest,
        },
        sealedProgressHead: {
          locatorProfile: "installation_provider_migration_progress_head_v1",
          migrationId,
          versionOrdinal: 2,
          headContentDigest: `sha256:${"a".repeat(64)}`,
          currentVersionToken: `hmac-sha256:${"a".repeat(64)}`,
          readyToActivateRecord: {
            locatorProfile:
              "installation_provider_migration_progress_record_v1",
            migrationId,
            recordOrdinal: 2,
            recordId: `provider-migration-progress:${"c".repeat(22)}`,
            contentDigest: `sha256:${"c".repeat(64)}`,
          },
        },
        migrationHistoryQuotaCommits: {
          mode: "same_installation_identity",
          journalCommit: {
            locatorProfile:
              "installation_provider_migration_history_quota_operation_receipt_v1",
            installationIdentityGenerationId:
              `installation-identity-generation:${"a".repeat(22)}`,
            operationNonce: "c".repeat(32),
            contentDigest: `sha256:${"c".repeat(64)}`,
            receiptToken: `hmac-sha256:${"c".repeat(64)}`,
            migrationId,
            reservationId:
              `provider-migration-history-reservation:${"c".repeat(22)}`,
            migrationPlanContentDigest: contentDigest,
            operation: "compare_commit",
            outcome: "committed",
            role: "same_identity_journal",
            commitKind: "commit_retained_history",
          },
        },
      },
    });

    expect(() =>
      assertProviderProductionCompletedStrongReadyConfigurationInternalV1(
        configuration,
      )
    ).not.toThrow();
  });
});

describe("production strong authority resolved receipt capability", () => {
  it("exports only live resolved broker bundles and closes fail-closed", async () => {
    const {
      broker,
      principalAttestation,
      receiptExportCapability,
      request,
      service,
    } =
      await liveStrongAuthorityServiceFixtureV1();

    expect(service).not.toHaveProperty("exportResolvedReceiptBundles");
    await expect(
      exportProviderProductionStrongAuthorityResolvedReceiptBundlesForTestInternalV1(
        receiptExportCapability,
      ),
    ).resolves.toEqual([]);
    const begun = await broker.begin(request, principalAttestation);
    expect(begun.resolution).toBe("recorded");
    if (begun.resolution !== "recorded") {
      throw new Error("expected recorded broker intent");
    }
    await expect(
      exportProviderProductionStrongAuthorityResolvedReceiptBundlesForTestInternalV1(
        receiptExportCapability,
      ),
    ).resolves.toEqual([]);

    const response = strongMutationResponseV1(request);
    await expect(
      broker.resolve(brokerResolveRequestV1(begun.intent, response)),
    ).resolves.toMatchObject({ resolution: "resolved" });
    await expect(
      exportProviderProductionStrongAuthorityResolvedReceiptBundlesForTestInternalV1(
        receiptExportCapability,
      ),
    ).resolves.toMatchObject([{
      intentOrdinal: 1,
      executionFence:
        "established_linux_ext4_exact_object_dedicated_os_principal_v1",
      strongWrites: "unlocked",
      request,
      response,
    }]);

    await service.close();
    await expect(
      exportProviderProductionStrongAuthorityResolvedReceiptBundlesForTestInternalV1(
        receiptExportCapability,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
  });

  it("drains an admitted receipt export behind one shared close barrier", async () => {
    const lifecycle: string[] = [];
    const fixture = await liveStrongAuthorityServiceFixtureV1({
      async closeServer() {
        lifecycle.push("server");
      },
      async closeExactObjectAuthority() {
        lifecycle.push("exact-object-authority");
      },
    });
    const begun = await fixture.broker.begin(
      fixture.request,
      fixture.principalAttestation,
    );
    if (begun.resolution !== "recorded") throw new Error("expected recorded");
    await fixture.broker.resolve(
      brokerResolveRequestV1(
        begun.intent,
        strongMutationResponseV1(fixture.request),
      ),
    );

    const gate = fixture.holdNextFenceRevalidation();
    const exporting =
      exportProviderProductionStrongAuthorityResolvedReceiptBundlesForTestInternalV1(
        fixture.receiptExportCapability,
      );
    await gate.entered;
    const firstClose = fixture.service.close();
    const secondClose = fixture.service.close();
    expect(secondClose).toBe(firstClose);
    await Promise.resolve();
    expect(lifecycle).toEqual(["server"]);
    await expect(
      exportProviderProductionStrongAuthorityResolvedReceiptBundlesForTestInternalV1(
        fixture.receiptExportCapability,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });

    gate.release();
    await expect(exporting).resolves.toHaveLength(1);
    await Promise.all([firstClose, secondClose]);
    expect(lifecycle).toEqual(["server", "exact-object-authority"]);
  });

  it("does not project the private receipt capability into the public doctor", async () => {
    const doctor = await publicAuthorityApi
      .inspectProviderAcceptanceAuthorityCandidateV1();
    expect(doctor).not.toHaveProperty("exportResolvedReceiptBundles");
    expect(doctor).not.toHaveProperty("resolvedReceiptBundles");
    expect(doctor).not.toHaveProperty("receiptBundles");
    expect(publicAuthorityApi).not.toHaveProperty(
      "exportProviderProductionStrongAuthorityResolvedReceiptBundlesInternalV1",
    );
    const forgedCapability = Object.freeze({
      __providerProductionStrongAuthorityReceiptExportCapabilityInternalV1:
        true as const,
    });
    await expect(
      exportProviderProductionStrongAuthorityResolvedReceiptBundlesForTestInternalV1(
        forgedCapability,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
  });
});

describe("production Step16 Provider receipt binding window", () => {
  it("collects three operations before their side effects and binds the exact suffix", async () => {
    const fixture = await liveStrongAuthorityServiceFixtureV1();
    const requests = [
      fixture.request,
      strongMutationRequestV1(fixture.current, {
        nonceDigit: "4",
        principalAttestation: fixture.principalAttestation,
      }),
      strongMutationRequestV1(fixture.current, {
        nonceDigit: "5",
        principalAttestation: fixture.principalAttestation,
      }),
    ];
    const expectedOperations = requests.map(step16ExpectedOperationV1);
    const window =
      await beginCollectingProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        fixture.receiptExportCapability,
        { host: "codex" },
      );

    for (let index = 0; index < requests.length; index += 1) {
      await appendExpectedOperationProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        window,
        expectedOperations[index]!,
      );
      await resolveStrongMutationV1(fixture, requests[index]!);
    }
    const bindings =
      await completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        window,
        step16TrustedHostCallWitnessV1(expectedOperations),
      );

    expect(bindings).toHaveLength(3);
    expect(bindings.map((binding) => binding.providerOperation)).toMatchObject(
      expectedOperations,
    );
  });

  it("rejects both side effects beyond appends and appends beyond side effects", async () => {
    const extraSideEffectFixture = await liveStrongAuthorityServiceFixtureV1();
    const expected = extraSideEffectFixture.request;
    const inserted = strongMutationRequestV1(extraSideEffectFixture.current, {
      nonceDigit: "4",
      principalAttestation: extraSideEffectFixture.principalAttestation,
    });
    const shortWindow =
      await beginCollectingProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        extraSideEffectFixture.receiptExportCapability,
        { host: "codex" },
      );
    await appendExpectedOperationProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
      shortWindow,
      step16ExpectedOperationV1(expected),
    );
    await resolveStrongMutationV1(extraSideEffectFixture, expected);
    await resolveStrongMutationV1(extraSideEffectFixture, inserted);
    await expect(
      completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        shortWindow,
        step16TrustedHostCallWitnessV1([
          step16ExpectedOperationV1(expected),
        ]),
      ),
    ).rejects.toMatchObject({ code: "namespace_integrity_failed" });

    const missingSideEffectFixture = await liveStrongAuthorityServiceFixtureV1();
    const first = missingSideEffectFixture.request;
    const absent = strongMutationRequestV1(missingSideEffectFixture.current, {
      nonceDigit: "4",
      principalAttestation: missingSideEffectFixture.principalAttestation,
    });
    const longWindow =
      await beginCollectingProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        missingSideEffectFixture.receiptExportCapability,
        { host: "codex" },
      );
    const longPlan = [
      step16ExpectedOperationV1(first),
      step16ExpectedOperationV1(absent),
    ];
    for (const operation of longPlan) {
      await appendExpectedOperationProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        longWindow,
        operation,
      );
    }
    await resolveStrongMutationV1(missingSideEffectFixture, first);
    await expect(
      completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        longWindow,
        step16TrustedHostCallWitnessV1(longPlan),
      ),
    ).rejects.toMatchObject({ code: "namespace_integrity_failed" });
  });

  it("rejects zero operations and poisons duplicate append until explicit abort", async () => {
    const zeroFixture = await liveStrongAuthorityServiceFixtureV1();
    const zeroWindow =
      await beginCollectingProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        zeroFixture.receiptExportCapability,
        { host: "codex" },
      );
    await expect(
      completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        zeroWindow,
        step16TrustedHostCallWitnessV1([]),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });

    const duplicateFixture = await liveStrongAuthorityServiceFixtureV1();
    const duplicateWindow =
      await beginCollectingProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        duplicateFixture.receiptExportCapability,
        { host: "codex" },
      );
    const operation = step16ExpectedOperationV1(duplicateFixture.request);
    await appendExpectedOperationProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
      duplicateWindow,
      operation,
    );
    await expect(
      appendExpectedOperationProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        duplicateWindow,
        operation,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      appendExpectedOperationProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        duplicateWindow,
        {
          ...operation,
          operationNonce: "f".repeat(32),
        },
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await abortProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
      duplicateWindow,
    );
    const replacement =
      await beginCollectingProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        duplicateFixture.receiptExportCapability,
        { host: "codex" },
      );
    await abortProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
      replacement,
    );
  });

  it("rejects append after either abort or successful completion", async () => {
    const abortedFixture = await liveStrongAuthorityServiceFixtureV1();
    const abortedWindow =
      await beginCollectingProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        abortedFixture.receiptExportCapability,
        { host: "codex" },
      );
    await abortProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
      abortedWindow,
    );
    await expect(
      appendExpectedOperationProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        abortedWindow,
        step16ExpectedOperationV1(abortedFixture.request),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });

    const completedFixture = await liveStrongAuthorityServiceFixtureV1();
    const completedWindow =
      await beginCollectingProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        completedFixture.receiptExportCapability,
        { host: "codex" },
      );
    const completedOperation = step16ExpectedOperationV1(
      completedFixture.request,
    );
    await appendExpectedOperationProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
      completedWindow,
      completedOperation,
    );
    await resolveStrongMutationV1(completedFixture, completedFixture.request);
    const completing =
      completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
      completedWindow,
      step16TrustedHostCallWitnessV1([completedOperation]),
    );
    await expect(
      appendExpectedOperationProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        completedWindow,
        completedOperation,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      abortProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        completedWindow,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(completing).resolves.toHaveLength(1);
  });

  it("aborts a window once, releases exclusivity, and rejects terminal races", async () => {
    const abortedFixture = await liveStrongAuthorityServiceFixtureV1();
    const beginInput = Object.freeze({
      host: "codex" as const,
      expectedProviderOperations: Object.freeze([
        step16ExpectedOperationV1(abortedFixture.request),
      ]),
    });
    const abortedWindow =
      await beginProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        abortedFixture.receiptExportCapability,
        beginInput,
      );

    await expect(
      abortProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        abortedWindow,
      ),
    ).resolves.toBeUndefined();
    await expect(
      abortProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        abortedWindow,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        abortedWindow,
        step16TrustedHostCallWitnessV1(
          beginInput.expectedProviderOperations,
        ),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });

    const replacement =
      await beginProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        abortedFixture.receiptExportCapability,
        beginInput,
      );
    await abortProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
      replacement,
    );

    const completedFixture = await liveStrongAuthorityServiceFixtureV1();
    const completedInput = Object.freeze({
      host: "codex" as const,
      expectedProviderOperations: Object.freeze([
        step16ExpectedOperationV1(completedFixture.request),
      ]),
    });
    const completedWindow =
      await beginProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        completedFixture.receiptExportCapability,
        completedInput,
      );
    await resolveStrongMutationV1(completedFixture, completedFixture.request);
    await completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
      completedWindow,
      step16TrustedHostCallWitnessV1(
        completedInput.expectedProviderOperations,
      ),
    );
    await expect(
      abortProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        completedWindow,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
  });

  it("maps one exact nonempty ledger suffix to frozen contract-safe digests", async () => {
    const fixture = await liveStrongAuthorityServiceFixtureV1();
    await resolveStrongMutationV1(fixture, fixture.request);
    const observedRequest = strongMutationRequestV1(fixture.current, {
      requestId: "9".repeat(32),
      nonceDigit: "4",
      principalAttestation: fixture.principalAttestation,
    });
    const beginInput = Object.freeze({
      host: "codex" as const,
      expectedProviderOperations: Object.freeze([
        step16ExpectedOperationV1(observedRequest),
      ]),
    });
    const window =
      await beginProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        fixture.receiptExportCapability,
        beginInput,
      );
    expect(Object.keys(window)).toEqual([]);
    await expect(
      beginProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        fixture.receiptExportCapability,
        beginInput,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });

    await resolveStrongMutationV1(fixture, observedRequest);
    const trustedWitness = step16TrustedHostCallWitnessV1(
      beginInput.expectedProviderOperations,
    );
    const bindings =
      await completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        window,
        trustedWitness,
      );
    expect(bindings).toHaveLength(1);
    const binding = bindings[0]!;
    expect(Step16ProviderReceiptBindingV1Schema.parse(binding)).toEqual(
      binding,
    );
    expect(binding).toMatchObject({
      host: "codex",
      sessionIdDigest: STEP16_CODEX_SESSION_ID_DIGEST,
      callIdDigest: STEP16_CODEX_CALL_ID_DIGEST,
      providerIdentityDigest: STEP16_INSTALLATION_IDENTITY_DIGEST,
      providerOperation: {
        operation: observedRequest.operation,
        operationNonce: observedRequest.operationNonce,
        requestDigest: observedRequest.requestDigest,
        sessionBindingDigest: observedRequest.bindingDigest,
        principalAttestationDigest:
          observedRequest.principalAttestationDigest,
        authorityGrantContentDigest:
          observedRequest.authorityGrant.contentDigest,
        responseResolution: "committed",
      },
      privateBundleVerification: {
        status: "verified",
        verifierProfile:
          "provider_runtime_ipc_full_private_bundle_verifier_v1",
      },
    });
    const response = strongMutationResponseV1(observedRequest);
    expect(binding.componentDigests).toMatchObject({
      authorityGrantSignature: canonicalDigestOracleV1(
        observedRequest.authorityGrant.payload.signature,
      ),
      responseSignature: canonicalDigestOracleV1(response.signature),
      principalAttestationSignature: canonicalDigestOracleV1(
        fixture.principalAttestation.signature,
      ),
    });
    expect(Object.isFrozen(bindings)).toBe(true);
    expect(Object.isFrozen(binding)).toBe(true);
    expect(Object.isFrozen(binding.componentDigests)).toBe(true);
    const safeJson = JSON.stringify(binding);
    for (const privateValue of [
      observedRequest.requestId,
      observedRequest.authorityGrant.payload.signature,
      response.signature,
      fixture.principalAttestation.signature,
      ...(observedRequest.operation === "write_object"
        ? [observedRequest.payload.bytes]
        : []),
    ]) {
      expect(safeJson).not.toContain(privateValue);
    }
    const replayWindow =
      await beginProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        fixture.receiptExportCapability,
        beginInput,
      );
    await expect(
      completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        replayWindow,
        trustedWitness,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
  });

  it("requires an opened one-shot Host witness with the exact operation plan", async () => {
    const noOpenerFixture = await liveStrongAuthorityServiceFixtureV1({
      enableTrustedHostCallWitnesses: false,
    });
    await expect(
      beginProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        noOpenerFixture.receiptExportCapability,
        {
          host: "codex",
          expectedProviderOperations: [
            step16ExpectedOperationV1(noOpenerFixture.request),
          ],
        },
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });

    const forgedFixture = await liveStrongAuthorityServiceFixtureV1();
    const forgedWindow =
      await beginProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        forgedFixture.receiptExportCapability,
        {
          host: "codex",
          expectedProviderOperations: [
            step16ExpectedOperationV1(forgedFixture.request),
          ],
        },
      );
    await resolveStrongMutationV1(forgedFixture, forgedFixture.request);
    const forgedWitness = Object.freeze(Object.create(null)) as Parameters<
      typeof completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1
    >[1];
    await expect(
      completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        forgedWindow,
        forgedWitness,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        forgedWindow,
        step16TrustedHostCallWitnessV1([
          step16ExpectedOperationV1(forgedFixture.request),
        ]),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });

    const mismatchFixture = await liveStrongAuthorityServiceFixtureV1();
    const expectedOperation = step16ExpectedOperationV1(
      mismatchFixture.request,
    );
    const mismatchWindow =
      await beginProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        mismatchFixture.receiptExportCapability,
        {
          host: "codex",
          expectedProviderOperations: [expectedOperation],
        },
      );
    await resolveStrongMutationV1(mismatchFixture, mismatchFixture.request);
    await expect(
      completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        mismatchWindow,
        step16TrustedHostCallWitnessV1([
          {
            ...expectedOperation,
            requestDigest: `sha256:${"f".repeat(64)}`,
          },
        ]),
      ),
    ).rejects.toMatchObject({ code: "namespace_integrity_failed" });
  });

  it("rejects pending, extra insertion, reordered suffix, and mismatched operation claims", async () => {
    const pendingFixture = await liveStrongAuthorityServiceFixtureV1();
    await pendingFixture.broker.begin(
      pendingFixture.request,
      pendingFixture.principalAttestation,
    );
    await expect(
      beginProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        pendingFixture.receiptExportCapability,
        {
          host: "codex",
          expectedProviderOperations: [
            step16ExpectedOperationV1(pendingFixture.request),
          ],
        },
      ),
    ).rejects.toMatchObject({ code: "namespace_integrity_failed" });

    const insertionFixture = await liveStrongAuthorityServiceFixtureV1();
    const inserted = insertionFixture.request;
    const expected = strongMutationRequestV1(insertionFixture.current, {
      nonceDigit: "4",
      principalAttestation: insertionFixture.principalAttestation,
    });
    const insertionWindow =
      await beginProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        insertionFixture.receiptExportCapability,
        {
          host: "codex",
          expectedProviderOperations: [step16ExpectedOperationV1(expected)],
        },
      );
    await resolveStrongMutationV1(insertionFixture, inserted);
    await resolveStrongMutationV1(insertionFixture, expected);
    await expect(
      completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        insertionWindow,
        step16TrustedHostCallWitnessV1([
          step16ExpectedOperationV1(expected),
        ]),
      ),
    ).rejects.toMatchObject({ code: "namespace_integrity_failed" });

    const reorderFixture = await liveStrongAuthorityServiceFixtureV1();
    const first = reorderFixture.request;
    const second = strongMutationRequestV1(reorderFixture.current, {
      nonceDigit: "4",
      principalAttestation: reorderFixture.principalAttestation,
    });
    const reorderWindow =
      await beginProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        reorderFixture.receiptExportCapability,
        {
          host: "codex",
          expectedProviderOperations: [
            step16ExpectedOperationV1(first),
            step16ExpectedOperationV1(second),
          ],
        },
      );
    await resolveStrongMutationV1(reorderFixture, second);
    await resolveStrongMutationV1(reorderFixture, first);
    await expect(
      completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        reorderWindow,
        step16TrustedHostCallWitnessV1([
          step16ExpectedOperationV1(first),
          step16ExpectedOperationV1(second),
        ]),
      ),
    ).rejects.toMatchObject({ code: "namespace_integrity_failed" });

    for (const expectedOperation of [
      {
        ...step16ExpectedOperationV1(first),
        operation: "compare_commit" as const,
      },
      {
        ...step16ExpectedOperationV1(first),
        operationNonce: "f".repeat(32),
      },
      {
        ...step16ExpectedOperationV1(first),
        requestDigest: `sha256:${"f".repeat(64)}`,
      },
    ]) {
      const fixture = await liveStrongAuthorityServiceFixtureV1();
      const window =
        await beginProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
          fixture.receiptExportCapability,
          {
            host: "codex",
            expectedProviderOperations: [expectedOperation],
          },
        );
      await resolveStrongMutationV1(fixture, fixture.request);
      await expect(
        completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
          window,
          step16TrustedHostCallWitnessV1([expectedOperation]),
        ),
      ).rejects.toMatchObject({ code: "namespace_integrity_failed" });
    }
  });

  it("burns the window on Host mismatch and rejects completion after close", async () => {
    const hostFixture = await liveStrongAuthorityServiceFixtureV1();
    const hostWindow =
      await beginProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        hostFixture.receiptExportCapability,
        {
          host: "codex",
          expectedProviderOperations: [
            step16ExpectedOperationV1(hostFixture.request),
          ],
        },
      );
    await resolveStrongMutationV1(hostFixture, hostFixture.request);
    await expect(
      completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        hostWindow,
        step16TrustedHostCallWitnessV1(
          [step16ExpectedOperationV1(hostFixture.request)],
          "claude",
        ),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        hostWindow,
        step16TrustedHostCallWitnessV1([
          step16ExpectedOperationV1(hostFixture.request),
        ]),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });

    const closeFixture = await liveStrongAuthorityServiceFixtureV1();
    const abandonedWindow =
      await beginProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        closeFixture.receiptExportCapability,
        {
          host: "codex",
          expectedProviderOperations: [
            step16ExpectedOperationV1(closeFixture.request),
          ],
        },
      );
    await closeFixture.service.close();
    await expect(
      completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        abandonedWindow,
        step16TrustedHostCallWitnessV1([
          step16ExpectedOperationV1(closeFixture.request),
        ]),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
  });

  it("never projects a bundle unless all three private signatures verify", async () => {
    const fixture = await liveStrongAuthorityServiceFixtureV1();
    const badGrantRequest = strongMutationRequestV1(fixture.current, {
      nonceDigit: "6",
      principalAttestation: fixture.principalAttestation,
      grantSignatureBitFlip: true,
    });
    await expect(
      fixture.broker.begin(
        badGrantRequest,
        fixture.principalAttestation,
      ),
    ).rejects.toBeDefined();

    const badAttestation = strongMutationPrincipalAttestationV1(
      currentAcceptanceIdentityV1(fixture.current),
      { signatureBitFlip: true },
    );
    const badAttestationRequest = strongMutationRequestV1(fixture.current, {
      nonceDigit: "7",
      principalAttestation: badAttestation,
    });
    await expect(
      fixture.broker.begin(badAttestationRequest, badAttestation),
    ).rejects.toBeDefined();

    const window =
      await beginProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        fixture.receiptExportCapability,
        {
          host: "codex",
          expectedProviderOperations: [
            step16ExpectedOperationV1(fixture.request),
          ],
        },
      );
    const begun = await fixture.broker.begin(
      fixture.request,
      fixture.principalAttestation,
    );
    if (begun.resolution !== "recorded") throw new Error("expected recorded");
    await expect(
      fixture.broker.resolve(
        brokerResolveRequestV1(
          begun.intent,
          strongMutationResponseV1(fixture.request, {
            signatureBitFlip: true,
          }),
        ),
      ),
    ).rejects.toBeDefined();
    await expect(
      completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowForTestInternalV1(
        window,
        step16TrustedHostCallWitnessV1([
          step16ExpectedOperationV1(fixture.request),
        ]),
      ),
    ).rejects.toMatchObject({ code: "namespace_integrity_failed" });
  });

  it("keeps every Step16 receipt-binding capability off the public index", () => {
    for (const name of [
      "beginProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1",
      "beginCollectingProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1",
      "appendExpectedOperationProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1",
      "completeProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1",
      "abortProviderProductionStrongAuthorityStep16ReceiptBindingWindowInternalV1",
      "exportProviderProductionStrongAuthorityResolvedReceiptBundlesInternalV1",
    ]) {
      expect(publicAuthorityApi).not.toHaveProperty(name);
    }
  });
});
