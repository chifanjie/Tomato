import { describe, expect, it } from "vitest";

import {
  ProviderAcceptedConfigurationV1Schema,
} from "@understand-code/durable-object-provider-contracts/provider-acceptance";

import {
  assertProviderProductionCompletedStrongReadyConfigurationInternalV1,
} from "../src/provider-production-strong-authority-service.js";
import {
  strongMutationTrustedConfigurationV1,
} from "./strong-mutation-broker-fixtures.js";

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
