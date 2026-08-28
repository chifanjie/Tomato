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
  createProviderAcceptanceAuthorityTestLayoutCapabilityInternalV1,
  createProviderProductionStrongAuthorityServiceForTestInternalV1,
  exportProviderProductionStrongAuthorityResolvedReceiptBundlesForTestInternalV1,
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
  brokerResolveRequestV1,
  currentAcceptanceIdentityV1,
  strongMutationPrincipalAttestationV1,
  strongMutationRequestV1,
  strongMutationResponseV1,
  strongMutationTrustVerifierV1,
  strongMutationTrustedConfigurationV1,
} from "./strong-mutation-broker-fixtures.js";

const fixtureRoots = new Set<string>();

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
        return input.request.bindingDigest === request.bindingDigest &&
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
    lifecycle,
  );
  return {
    broker,
    principalAttestation,
    request,
    holdNextFenceRevalidation,
    ...opened,
  };
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
