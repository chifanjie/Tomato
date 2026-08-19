import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import * as publicApi from "../src/index.js";
import * as providerAcceptance from "../src/provider-acceptance.js";
import * as providerMigrationPreSideEffectPlanAdmissionClosureReferenceCandidate from "../src/provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-closure-reference-candidate.js";
import * as providerMigrationPreparedRegistrySuccessorReferenceCandidate from "../src/provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-reference-candidate.js";

const sourceRoot = fileURLToPath(new URL("../src", import.meta.url));
const packageManifest = JSON.parse(
  readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
) as { exports: Record<string, unknown> };

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolutePath);
    return entry.isFile() && entry.name.endsWith(".ts") ? [absolutePath] : [];
  });
}

describe("provider contract runtime boundary", () => {
  it("exposes the formal Provider Acceptance wire from root and its public subpath without a raw-key mint", () => {
    const runtimeExportNames = [
      "InstallationIdentityStatePinV1Schema",
      "PROVIDER_ACCEPTANCE_COMPARE_APPEND_RECEIPT_DOMAIN_V1",
      "PROVIDER_ACCEPTANCE_COMPARE_APPEND_RECEIPT_TOKEN_DOMAIN_V1",
      "PROVIDER_ACCEPTANCE_COMPARE_APPEND_REQUEST_DOMAIN_V1",
      "PROVIDER_ACCEPTANCE_CURRENT_VERSION_TOKEN_DOMAIN_V1",
      "PROVIDER_ACCEPTANCE_GENERATION_SET_DOMAIN_V1",
      "PROVIDER_ACCEPTANCE_HIGH_WATER_DOMAIN_V1",
      "PROVIDER_ACCEPTANCE_STATE_DOMAIN_V1",
      "PROVIDER_ACCEPTANCE_STATE_GENERATION_ID_DOMAIN_V1",
      "PROVIDER_ACCEPTANCE_STATE_TOKEN_DOMAIN_V1",
      "ProviderAcceptanceCompareAppendDurableOutcomeV1Schema",
      "ProviderAcceptanceCompareAppendReceiptEnvelopeV1Schema",
      "ProviderAcceptanceCompareAppendReceiptPinV1Schema",
      "ProviderAcceptanceCompareAppendReceiptUnsignedV1Schema",
      "ProviderAcceptanceCompareAppendReceiptV1Schema",
      "ProviderAcceptanceCompareAppendRequestV1Schema",
      "ProviderAcceptanceCompareAppendResultV1Schema",
      "ProviderAcceptanceCurrentPinV1Schema",
      "ProviderAcceptanceCurrentReadV1Schema",
      "ProviderAcceptanceCurrentVersionTokenFieldsV1Schema",
      "ProviderAcceptanceGenerationEnumerationEntryV1Schema",
      "ProviderAcceptanceGenerationEnumerationV1Schema",
      "ProviderAcceptanceGenerationPinV1Schema",
      "ProviderAcceptanceGenerationSetFieldsV1Schema",
      "ProviderAcceptanceHighWaterEnvelopeV1Schema",
      "ProviderAcceptanceHighWaterV1Schema",
      "ProviderAcceptanceObservedHighWaterV1Schema",
      "ProviderAcceptanceStateEnvelopeV1Schema",
      "ProviderAcceptanceStateGenerationIdFieldsV1Schema",
      "ProviderAcceptanceStateUnsignedV1Schema",
      "ProviderAcceptanceStateV1Schema",
      "ProviderAcceptanceStrongReadyActivationV1Schema",
      "ProviderAcceptedConfigurationV1Schema",
      "ProviderMigrationHistoryQuotaCommittedReceiptSetV1Schema",
      "ProviderMigrationPlanPinV1Schema",
      "ProviderMigrationProgressRecordPinV1Schema",
      "ProviderMigrationSealedProgressHeadPinV1Schema",
      "createProviderAcceptanceCompareAppendReceiptTokenMessageV1",
      "createProviderAcceptanceCurrentVersionTokenMessageV1",
      "createProviderAcceptanceStateTokenMessageV1",
      "deriveProviderAcceptanceCompareAppendReceiptContentDigestV1",
      "deriveProviderAcceptanceCompareAppendReceiptPinV1",
      "deriveProviderAcceptanceCompareAppendRequestContentDigestV1",
      "deriveProviderAcceptanceCurrentPinV1",
      "deriveProviderAcceptanceGenerationSetDigestV1",
      "deriveProviderAcceptanceHighWaterContentDigestV1",
      "deriveProviderAcceptanceStateContentDigestV1",
      "deriveProviderAcceptanceStateGenerationIdV1",
      "projectProviderAcceptanceCompareAppendReceiptUnsignedV1",
      "projectProviderAcceptanceCurrentVersionTokenFieldsV1",
      "projectProviderAcceptanceStateUnsignedV1",
    ] as const;
    expect(packageManifest.exports).toHaveProperty("./provider-acceptance");
    expect(Object.keys(providerAcceptance).sort()).toEqual(runtimeExportNames);
    for (const runtimeExportName of runtimeExportNames) {
      expect(publicApi[runtimeExportName]).toBe(
        providerAcceptance[runtimeExportName],
      );
    }
    expect(
      providerAcceptance.PROVIDER_ACCEPTANCE_COMPARE_APPEND_REQUEST_DOMAIN_V1,
    ).toBe("provider-acceptance-compare-append-request-v1");
    expect(providerAcceptance).not.toHaveProperty(
      "deriveKeyedStateTokenForDomainV1",
    );
  });

  it("exposes the single D-41 none-authority public seam from root and subpath only", () => {
    const publicSubpath =
      "./provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-closure-reference-candidate";
    const authority =
      "none_provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_plan_admission_closure_reference_candidate_only";
    const runtimeExportNames = [
      "ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationError",
      "ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1Schema",
      "buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1",
    ];
    expect(packageManifest.exports).toHaveProperty(publicSubpath);
    expect(
      Object.keys(
        providerMigrationPreSideEffectPlanAdmissionClosureReferenceCandidate,
      ).sort(),
    ).toEqual(runtimeExportNames);
    expect(
      publicApi.buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1,
    ).toBe(
      providerMigrationPreSideEffectPlanAdmissionClosureReferenceCandidate.buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1,
    );
    expect(
      publicApi.ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationError,
    ).toBe(
      providerMigrationPreSideEffectPlanAdmissionClosureReferenceCandidate.ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationError,
    );
    expect(
      publicApi.ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1Schema,
    ).toBe(
      providerMigrationPreSideEffectPlanAdmissionClosureReferenceCandidate.ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1Schema,
    );
    const validationSchema =
      providerMigrationPreSideEffectPlanAdmissionClosureReferenceCandidate.ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationV1Schema as unknown as {
        readonly shape: {
          readonly authority: { parse(input: unknown): unknown };
        };
      };
    expect(validationSchema.shape.authority.parse(authority)).toBe(authority);
    const validationError =
      new providerMigrationPreSideEffectPlanAdmissionClosureReferenceCandidate.ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateValidationError();
    expect(validationError).toMatchObject({
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });
    expect(Object.isFrozen(validationError)).toBe(true);
  });

  it("exposes the single D-42 none-authority public seam from root and subpath only", () => {
    const publicSubpath =
      "./provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-reference-candidate";
    const authority =
      "none_provider_migration_same_installation_identity_current_strong_source_normal_prepared_registry_successor_reference_candidate_only";
    const runtimeExportNames = [
      "ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationError",
      "ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1Schema",
      "buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateV1",
    ];
    expect(packageManifest.exports).toHaveProperty(publicSubpath);
    expect(
      Object.keys(
        providerMigrationPreparedRegistrySuccessorReferenceCandidate,
      ).sort(),
    ).toEqual(runtimeExportNames);
    expect(
      publicApi.buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateV1,
    ).toBe(
      providerMigrationPreparedRegistrySuccessorReferenceCandidate.buildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateV1,
    );
    expect(
      publicApi.ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationError,
    ).toBe(
      providerMigrationPreparedRegistrySuccessorReferenceCandidate.ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationError,
    );
    expect(
      publicApi.ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1Schema,
    ).toBe(
      providerMigrationPreparedRegistrySuccessorReferenceCandidate.ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1Schema,
    );
    const validationSchema =
      providerMigrationPreparedRegistrySuccessorReferenceCandidate.ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationV1Schema as unknown as {
        readonly shape: {
          readonly authority: { parse(input: unknown): unknown };
          readonly stopPoint: { parse(input: unknown): unknown };
        };
      };
    expect(validationSchema.shape.authority.parse(authority)).toBe(authority);
    const stopPoint =
      "after_external_root_signed_prepared_registry_direct_successor_validation_before_registry_manifest_publication";
    expect(validationSchema.shape.stopPoint.parse(stopPoint)).toBe(stopPoint);
    const validationError =
      new providerMigrationPreparedRegistrySuccessorReferenceCandidate.ProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateValidationError();
    expect(validationError).toMatchObject({
      code: "provider_unavailable",
      reason: "attestation_invalid",
    });
    expect(Object.isFrozen(validationError)).toBe(true);
  });

  it("has no Node, filesystem, process, Buffer, or host crypto dependencies", () => {
    const forbiddenImport =
      /(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)["'](?:node:|fs(?:\/|["'])|path(?:\/|["'])|crypto(?:\/|["'])|child_process(?:\/|["']))/u;
    const forbiddenHostGlobal =
      /(?:^|[^\w$])(?:process|Buffer)(?:\s*[.([]|\s*$)/mu;
    for (const filePath of sourceFiles(sourceRoot)) {
      const source = readFileSync(filePath, "utf8");
      expect(source, filePath).not.toMatch(forbiddenImport);
      expect(source, filePath).not.toMatch(forbiddenHostGlobal);
    }
  });

  it("does not expose arbitrary domain or prefix derivation helpers", () => {
    expect(publicApi).not.toHaveProperty("createDomainPreimageBytesV1");
    expect(publicApi).not.toHaveProperty("deriveSemanticHashV1");
    expect(publicApi).not.toHaveProperty("deriveKeyedStateTokenForDomainV1");
    expect(publicApi).not.toHaveProperty(
      "deriveProviderStrongReadyActiveWriterSelectionsInternalV1",
    );
    expect(publicApi).not.toHaveProperty(
      "classifyProviderStrongReadyActiveWriterMatchCountInternalV1",
    );
    expect(packageManifest.exports).not.toHaveProperty("./domain-crypto");
    expect(packageManifest.exports).not.toHaveProperty("./provider-foundation");
    expect(packageManifest.exports).not.toHaveProperty(
      "./provider-strong-ready-acceptance-candidate-internal",
    );
    expect(packageManifest.exports).not.toHaveProperty(
      "./provider-trusted-local-physical-target-observation-capability-internal",
    );
    expect(packageManifest.exports).not.toHaveProperty(
      "./provider-trusted-local-physical-target-selection-candidate-internal",
    );
    expect(packageManifest.exports).not.toHaveProperty(
      "./provider-strong-ready-bootstrap-or-steady-acceptance-identity-verification-capability-internal",
    );
    expect(packageManifest.exports).not.toHaveProperty(
      "./provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-reference-machine-internal",
    );
    expect(packageManifest.exports).not.toHaveProperty(
      "./provider-trusted-local-strong-writer-selection-candidate-internal",
    );
    expect(packageManifest.exports).not.toHaveProperty(
      "./provider-migration-same-installation-identity-current-strong-source-normal-source-reference-machine-internal",
    );
    expect(packageManifest.exports).not.toHaveProperty(
      "./provider-migration-same-installation-identity-current-strong-source-normal-history-quota-reference-machine-internal",
    );
    expect(packageManifest.exports).not.toHaveProperty(
      "./provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-pre-plan-reference-capability-internal",
    );
    expect(packageManifest.exports).not.toHaveProperty(
      "./provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-reference-candidate-wire",
    );
    expect(packageManifest.exports).not.toHaveProperty(
      "./provider-migration-same-installation-identity-current-strong-source-normal-endpoint-trust-capability-internal",
    );
    expect(packageManifest.exports).not.toHaveProperty(
      "./provider-strong-ready-bootstrap-or-steady-acceptance-d41-endpoint-trust-basis-internal",
    );
    expect(packageManifest.exports).not.toHaveProperty(
      "./provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-reference-candidate-wire",
    );
    expect(packageManifest.exports).not.toHaveProperty(
      "./provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-continuation-internal",
    );
    expect(packageManifest.exports).not.toHaveProperty(
      "./provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-reference-capability-internal",
    );
    expect(packageManifest.exports).not.toHaveProperty(
      "./provider-registry-history-prepared-successor-handle-internal",
    );
    expect(publicApi).not.toHaveProperty(
      "mintProviderTrustedLocalPhysicalTargetObservationCapabilityInternalV1",
    );
    expect(publicApi).not.toHaveProperty(
      "deriveProviderTrustedLocalPhysicalTargetSelectionInternalV1",
    );
    expect(publicApi).not.toHaveProperty(
      "mintProviderStrongReadyBootstrapOrSteadyAcceptanceIdentityVerificationCapabilityInternalV1",
    );
    expect(publicApi).not.toHaveProperty(
      "mintProviderStrongReadyBootstrapOrSteadyAcceptanceCompareAppendReferenceMachineInternalV1",
    );
    expect(publicApi).not.toHaveProperty(
      "deriveProviderTrustedLocalStrongWriterSelectionCandidateInternalV1",
    );
    expect(publicApi).not.toHaveProperty(
      "mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalSourceReferenceMachineInternalV1",
    );
    expect(publicApi).not.toHaveProperty(
      "mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalHistoryQuotaReferenceMachineInternalV1",
    );
    expect(publicApi).not.toHaveProperty(
      "mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPrePlanReferenceCapabilityInternalV1",
    );
    expect(publicApi).not.toHaveProperty(
      "PROVIDER_MIGRATION_SAME_INSTALLATION_IDENTITY_CURRENT_STRONG_SOURCE_NORMAL_PRE_SIDE_EFFECT_REQUEST_REFERENCE_CANDIDATE_DOMAIN_V1",
    );
    expect(publicApi).not.toHaveProperty(
      "deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalClosureContentDigestReferenceCandidateV1",
    );
    expect(publicApi).not.toHaveProperty(
      "validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidateV1",
    );
    expect(publicApi).not.toHaveProperty(
      "verifyProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreSideEffectPlanAdmissionClosureReferenceCandidatePublicHashDagAndEqualityV1",
    );
    expect(publicApi).not.toHaveProperty(
      "mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointCutCapabilityInternalV1",
    );
    expect(publicApi).not.toHaveProperty(
      "mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalProspectiveDestinationPreparedSourceCapabilityInternalV1",
    );
    expect(publicApi).not.toHaveProperty(
      "prepareProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalEndpointTrustInternalV1",
    );
    expect(publicApi).not.toHaveProperty(
      "registerProviderStrongReadyBootstrapOrSteadyAcceptanceD41EndpointTrustBasisInternalV1",
    );
    expect(publicApi).not.toHaveProperty(
      "takeProviderStrongReadyBootstrapOrSteadyAcceptanceD41EndpointTrustBasisInternalV1",
    );
    expect(publicApi).not.toHaveProperty(
      "deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalFormalMigrationIdMappingV1",
    );
    expect(publicApi).not.toHaveProperty(
      "deriveProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorClosureContentDigestV1",
    );
    expect(publicApi).not.toHaveProperty(
      "validateProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateV1",
    );
    expect(publicApi).not.toHaveProperty(
      "mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCapabilityInternalV1",
    );
    expect(publicApi).not.toHaveProperty(
      "diagnoseBuildProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorReferenceCandidateInternalV1",
    );
    expect(publicApi).not.toHaveProperty(
      "mintProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorContinuationIntentInternalV1",
    );
    expect(publicApi).not.toHaveProperty(
      "takeProviderMigrationSameInstallationIdentityCurrentStrongSourceNormalPreparedRegistrySuccessorFinalCapabilityInternalV1",
    );
    expect(publicApi).not.toHaveProperty(
      "diagnoseProviderRegistryPreparedDirectSuccessorInternalV1",
    );
    expect(publicApi).not.toHaveProperty(
      "takeProviderRegistryPreparedSuccessorFinalCandidateInternalV1",
    );
  });

  it("uses strict object schemas rather than silent unknown-field stripping", () => {
    for (const filePath of sourceFiles(sourceRoot)) {
      const source = readFileSync(filePath, "utf8");
      expect(source, filePath).not.toMatch(/\bz\.object\s*\(/u);
      expect(source, filePath).not.toMatch(/\.passthrough\s*\(/u);
    }
  });
});
