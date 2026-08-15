import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import * as publicApi from "../src/index.js";
import * as providerMigrationPreSideEffectPlanAdmissionClosureReferenceCandidate from "../src/provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-closure-reference-candidate.js";

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
  });

  it("uses strict object schemas rather than silent unknown-field stripping", () => {
    for (const filePath of sourceFiles(sourceRoot)) {
      const source = readFileSync(filePath, "utf8");
      expect(source, filePath).not.toMatch(/\bz\.object\s*\(/u);
      expect(source, filePath).not.toMatch(/\.passthrough\s*\(/u);
    }
  });
});
