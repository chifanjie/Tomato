import { PROVIDER_TRUST_HISTORY_POLICY_V1 } from "@understand-code/durable-object-provider-contracts";
import { describe, expect, it } from "vitest";

import {
  classifyProviderAcceptanceAuthorityAdmissionForTestInternalV1,
  type ProviderAcceptanceAuthorityAdmissionInputInternalV1,
} from "../src/test-seam-internal.js";

const policy = PROVIDER_TRUST_HISTORY_POLICY_V1;

function classifyV1(
  overrides: Partial<ProviderAcceptanceAuthorityAdmissionInputInternalV1>,
) {
  return classifyProviderAcceptanceAuthorityAdmissionForTestInternalV1({
    generationCount: 1,
    receiptCount: 1,
    receiptLogicalBytes: 1,
    requestLogicalBytes: 1,
    acceptanceLocalContributionLogicalBytes: 1,
    admissionClass: "emergency",
    isExistingReplay: false,
    ...overrides,
  });
}

describe("provider Acceptance authority literal capacity boundaries", () => {
  it.each([
    {
      name: "generation count",
      field: "generationCount" as const,
      maximum: policy.maxAcceptanceGenerationCountPerInstallationIdentity,
      reason: "generation_count",
    },
    {
      name: "receipt count",
      field: "receiptCount" as const,
      maximum:
        policy.maxAcceptanceCompareAppendReceiptCountPerInstallationIdentity,
      reason: "receipt_count",
    },
    {
      name: "single receipt bytes",
      field: "requestLogicalBytes" as const,
      maximum: policy.maxSingleAcceptanceCompareAppendReceiptLogicalBytes,
      reason: "single_receipt_bytes",
    },
    {
      name: "receipt total bytes",
      field: "receiptLogicalBytes" as const,
      maximum:
        policy.maxAcceptanceCompareAppendReceiptLogicalBytesPerInstallationIdentity,
      reason: "receipt_bytes",
    },
    {
      name: "Acceptance-local contribution bytes",
      field: "acceptanceLocalContributionLogicalBytes" as const,
      maximum:
        policy.maxTotalTrustHistoryLogicalBytesPerInstallationIdentity,
      reason: "acceptance_local_contribution_bytes",
    },
  ])("admits emergency $name at N and rejects N+1", (testCase) => {
    expect(classifyV1({ [testCase.field]: testCase.maximum })).toEqual({
      admitted: true,
    });
    expect(classifyV1({ [testCase.field]: testCase.maximum + 1 })).toEqual({
      admitted: false,
      reason: testCase.reason,
    });
  });

  it.each([
    {
      name: "generation count reserve",
      field: "generationCount" as const,
      maximum:
        policy.maxAcceptanceGenerationCountPerInstallationIdentity -
        policy.normalUpdateEmergencyGenerationReserve,
      reason: "generation_count",
    },
    {
      name: "receipt count reserve",
      field: "receiptCount" as const,
      maximum:
        policy.maxAcceptanceCompareAppendReceiptCountPerInstallationIdentity -
        policy.normalUpdateEmergencyAcceptanceReceiptReserve,
      reason: "receipt_count",
    },
    {
      name: "receipt byte reserve",
      field: "receiptLogicalBytes" as const,
      maximum:
        policy.maxAcceptanceCompareAppendReceiptLogicalBytesPerInstallationIdentity -
        policy.normalUpdateEmergencyLogicalBytesReserve,
      reason: "receipt_bytes",
    },
    {
      name: "Acceptance-local contribution reserve",
      field: "acceptanceLocalContributionLogicalBytes" as const,
      maximum:
        policy.maxTotalTrustHistoryLogicalBytesPerInstallationIdentity -
        policy.normalUpdateEmergencyLogicalBytesReserve,
      reason: "acceptance_local_contribution_bytes",
    },
  ])("admits normal $name at N and rejects N+1", (testCase) => {
    expect(classifyV1({
      admissionClass: "normal",
      [testCase.field]: testCase.maximum,
    })).toEqual({ admitted: true });
    expect(classifyV1({
      admissionClass: "normal",
      [testCase.field]: testCase.maximum + 1,
    })).toEqual({
      admitted: false,
      reason: testCase.reason,
    });
  });

  it("bypasses new admission for an exact existing replay at every exhausted boundary", () => {
    expect(classifyV1({
      generationCount:
        policy.maxAcceptanceGenerationCountPerInstallationIdentity + 1,
      receiptCount:
        policy.maxAcceptanceCompareAppendReceiptCountPerInstallationIdentity +
        1,
      requestLogicalBytes:
        policy.maxSingleAcceptanceCompareAppendReceiptLogicalBytes + 1,
      receiptLogicalBytes:
        policy.maxAcceptanceCompareAppendReceiptLogicalBytesPerInstallationIdentity +
        1,
      acceptanceLocalContributionLogicalBytes:
        policy.maxTotalTrustHistoryLogicalBytesPerInstallationIdentity + 1,
      isExistingReplay: true,
    })).toEqual({ admitted: true });
  });

  it("pins the formal literal caps and emergency reserves", () => {
    expect({
      generationCount: policy.maxAcceptanceGenerationCountPerInstallationIdentity,
      receiptCount:
        policy.maxAcceptanceCompareAppendReceiptCountPerInstallationIdentity,
      receiptBytes:
        policy.maxAcceptanceCompareAppendReceiptLogicalBytesPerInstallationIdentity,
      singleReceiptBytes:
        policy.maxSingleAcceptanceCompareAppendReceiptLogicalBytes,
      totalTrustHistoryBytes:
        policy.maxTotalTrustHistoryLogicalBytesPerInstallationIdentity,
      emergencyGenerationReserve:
        policy.normalUpdateEmergencyGenerationReserve,
      emergencyReceiptReserve:
        policy.normalUpdateEmergencyAcceptanceReceiptReserve,
      emergencyBytesReserve:
        policy.normalUpdateEmergencyLogicalBytesReserve,
    }).toEqual({
      generationCount: 4_096,
      receiptCount: 4_096,
      receiptBytes: 67_108_864,
      singleReceiptBytes: 1_048_576,
      totalTrustHistoryBytes: 268_435_456,
      emergencyGenerationReserve: 8,
      emergencyReceiptReserve: 8,
      emergencyBytesReserve: 4_194_304,
    });
  });
});
