import { z } from "zod";

import {
  InstallationIdentityGenerationFieldsV1Schema,
  InstallationIdentityKeyCheckFieldsV1Schema,
  ProviderRegistryRootKeyIdFieldsV1Schema,
} from "./provider-foundation.js";
import {
  CanonicalByteStringV1Schema,
  CanonicalPublicKeyBytes32V1Schema,
  ContentDigestV1Schema,
  DurableObjectIdentityProviderIdV1Schema,
  DurableObjectIdentityProviderSlugV1Schema,
  Ed25519PublicKeyDigestV1Schema,
  InstallationIdentityGenerationIdV1Schema,
  KeyedStateTokenV1Schema,
  LowerHex22V1Schema,
  LowerHex32V1Schema,
  LowerHex64V1Schema,
  ProviderFeasibilityApproverKeyIdV1Schema,
  ProviderFeasibilityEvidenceIdV1Schema,
  ProviderFilesystemProfileCodeV1Schema,
  ProviderMigrationIdV1Schema,
  ProviderOsReleaseFamilyCodeV1Schema,
  ProviderPublicSupportProfileIdV1Schema,
  ProviderPublicSupportTaxonomySignatureV1Schema,
  ProviderRealFilesystemConformanceResultIdV1Schema,
  ProviderRealFilesystemCaseIdV1Schema,
  ProviderRealFilesystemCaseKeyV1Schema,
  ProviderRealFilesystemCrashCutIdV1Schema,
  ProviderRealFilesystemFixtureCorpusManifestSignatureV1Schema,
  ProviderRealFilesystemSuiteManifestSignatureV1Schema,
  ProviderReleaseMatrixSignatureV1Schema,
  ProviderRegistryManifestGenerationIdV1Schema,
  ProviderRegistryManifestSignatureV1Schema,
  ProviderRegistryRootKeyIdV1Schema,
  ProviderTargetDiscoveryInputBundleSignatureV1Schema,
  ProviderTargetDiscoveryResultSignatureV1Schema,
  ProviderTargetProfileIdV1Schema,
  StoreProviderRegistrySignatureV1Schema,
  StoreProviderVerificationKeyIdV1Schema,
} from "./primitives.js";
import {
  ProviderCapabilityFailureReasonV1Schema,
  ProviderUnavailableToolErrorV1Schema,
} from "./provider-error.js";
import {
  ProviderBootstrapTrustBundleEnvelopeV1Schema,
  ProviderBootstrapTrustBundleV1Schema,
} from "./bootstrap-trust-bundle.js";
import {
  ProviderBootstrapTrustGoldenManifestV1Schema,
} from "./bootstrap-trust-golden.js";
import {
  ProviderBootstrapTrustInvalidManifestV1Schema,
} from "./bootstrap-trust-invalid.js";
import {
  InstallationIdentityBootstrapTrustFieldsV1Schema,
} from "./installation-bootstrap-trust.js";
import {
  ProviderBootstrapTrustBundlePinV1Schema,
  ProviderSignedDistributionRootBindingV1Schema,
  ProviderSignedPackageIdentityFieldsV1Schema,
} from "./provider-distribution-trust.js";
import {
  ProviderRegistryIsoTimestampV1Schema,
  ProviderRegistryRecoveryKeyIdFieldsV1Schema,
  ProviderRegistryRecoveryKeyIdV1Schema,
  ProviderRegistryRecoveryPublicKeyV1Schema,
  ProviderRegistryRootCrossSignatureV1Schema,
  ProviderRegistryRootMetadataEnvelopeV1Schema,
  ProviderRegistryRootMetadataPinV1Schema,
  ProviderRegistryRootMetadataUnsignedClaimsV1Schema,
  ProviderRegistryRootMetadataV1Schema,
  ProviderRegistryRootPublicKeyV1Schema,
  ProviderRegistryRootRecoverySignatureV1Schema,
  ProviderRegistryRootSelfSignatureV1Schema,
  ProviderRegistryRootSelfSignatureWrapperV1Schema,
} from "./provider-registry-trust.js";
import {
  ProviderDistributionHistoryPolicyV1Schema,
  ProviderMigrationHistoryQuotaPolicyV1Schema,
  ProviderTrustHistoryPolicyV1Schema,
} from "./provider-trust-policy.js";
import {
  HashedStoreFilenameKeyV1Schema,
  ProviderRegistryManifestLocatorV1Schema,
  ProviderRegistryRootMetadataLocatorV1Schema,
  ProviderRealFilesystemFixtureCorpusManifestLocatorV1Schema,
  ProviderRealFilesystemSuiteManifestLocatorV1Schema,
  ShortStoreFilenameKeySyntaxV1Schema,
  StoreFilenameKeySyntaxV1Schema,
} from "./provider-fixed-locator.js";
import {
  ProviderRealFilesystemCaseIdFieldsV1Schema,
  ProviderRealFilesystemCrashCutIdFieldsV1Schema,
  ProviderRealFilesystemFixtureCaseRecordSetFieldsV1Schema,
  ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema,
  ProviderRealFilesystemFixtureCorpusManifestPinV1Schema,
  ProviderRealFilesystemFixtureCorpusManifestSignatureWrapperV1Schema,
  ProviderRealFilesystemFixtureCorpusManifestUnsignedClaimsV1Schema,
  ProviderRealFilesystemFixtureCorpusManifestV1Schema,
  ProviderRealFilesystemFixtureCorpusRecordSetFieldsV1Schema,
  ProviderRealFilesystemFixtureCorpusRecordV1Schema,
  ProviderRealFilesystemFixtureManifestFieldsV1Schema,
  ProviderRealFilesystemFixtureProgramFieldsV1Schema,
  ProviderRealFilesystemRecoveryAssertionFieldsV1Schema,
  ProviderRealFilesystemRequiredCaseCutEntryV1Schema,
  ProviderRealFilesystemRequiredCaseCutSetFieldsV1Schema,
  ProviderRealFilesystemRunnerProfileV1Schema,
  ProviderRealFilesystemSuiteCaseSetFieldsV1Schema,
  ProviderRealFilesystemSuiteCaseV1Schema,
  ProviderRealFilesystemSuiteCrashCutV1Schema,
  ProviderRealFilesystemSuiteDefinitionFieldsV1Schema,
  ProviderRealFilesystemSuiteManifestEnvelopeV1Schema,
  ProviderRealFilesystemSuiteManifestPinV1Schema,
  ProviderRealFilesystemSuiteManifestSignatureWrapperV1Schema,
  ProviderRealFilesystemSuiteManifestUnsignedClaimsV1Schema,
  ProviderRealFilesystemSuiteManifestV1Schema,
} from "./provider-real-filesystem-source.js";
import {
  ProviderRealFilesystemSourceGoldenManifestV1Schema,
  ProviderRealFilesystemSourceInvalidManifestV1Schema,
  ProviderRealFilesystemSourceInvalidReasonV1Schema,
  ProviderRealFilesystemSourceInvalidStageV1Schema,
} from "./provider-real-filesystem-source-fixtures.js";
import {
  ProviderRealFilesystemConformanceCaseOutcomeV1Schema,
  ProviderRealFilesystemConformanceCaseResultV1Schema,
  ProviderRealFilesystemConformanceResultCodeV1Schema,
  ProviderRealFilesystemConformanceResultEnvelopeV1Schema,
  ProviderRealFilesystemConformanceResultIdFieldsV1Schema,
  ProviderRealFilesystemConformanceResultInvalidReasonV1Schema,
  ProviderRealFilesystemConformanceResultInvalidStageV1Schema,
  ProviderRealFilesystemConformanceResultLocatorV1Schema,
  ProviderRealFilesystemConformanceResultPinV1Schema,
  ProviderRealFilesystemConformanceResultV1Schema,
} from "./provider-real-filesystem-conformance-result.js";
import {
  ProviderRealFilesystemConformanceResultGoldenManifestV1Schema,
  ProviderRealFilesystemConformanceResultInvalidManifestV1Schema,
} from "./provider-real-filesystem-conformance-result-fixtures.js";
import {
  ProviderFeasibilityTargetFieldsV1Schema,
  ProviderFeasibilityTargetV1Schema,
  ProviderPublicFilesystemDescriptorV1Schema,
  ProviderPublicFilesystemProfileCodeFieldsV1Schema,
  ProviderPublicFilesystemTaxonomyRecordV1Schema,
  ProviderPublicLinuxDistributionIdV1Schema,
  ProviderPublicOsReleaseFamilyCodeFieldsV1Schema,
  ProviderPublicOsReleaseFamilyDescriptorV1Schema,
  ProviderPublicOsReleaseFamilyTaxonomyRecordV1Schema,
  ProviderPublicSupportProfileFieldsV1Schema,
  ProviderPublicSupportTaxonomyEnvelopeV1Schema,
  ProviderPublicSupportTaxonomyLocatorV1Schema,
  ProviderPublicSupportTaxonomyPinV1Schema,
  ProviderPublicSupportTaxonomySignatureWrapperV1Schema,
  ProviderPublicSupportTaxonomyUnsignedClaimsV1Schema,
  ProviderPublicSupportTaxonomyV1Schema,
  ProviderReleaseCoverageArtifactLimitsV1Schema,
  ProviderReleaseMatrixEnvelopeV1Schema,
  ProviderReleaseMatrixLocatorV1Schema,
  ProviderReleaseMatrixPinV1Schema,
  ProviderReleaseMatrixSignatureWrapperV1Schema,
  ProviderReleaseMatrixUnsignedClaimsV1Schema,
  ProviderReleaseMatrixV1Schema,
  ProviderReleaseTargetEntrySetFieldsV1Schema,
  ProviderReleaseTargetUniverseTargetEntryV1Schema,
  ProviderTargetDiscoveryFixtureManifestEnvelopeV1Schema,
  ProviderTargetDiscoveryFixtureManifestLocatorV1Schema,
  ProviderTargetDiscoveryFixtureManifestPinV1Schema,
  ProviderTargetDiscoveryFixtureManifestV1Schema,
  ProviderTargetDiscoveryInputBundleSignatureWrapperV1Schema,
  ProviderTargetDiscoveryInputBundleUnsignedClaimsV1Schema,
  ProviderTargetDiscoveryInputBundleV1Schema,
  ProviderTargetDiscoveryInputObservationSetFieldsV1Schema,
  ProviderTargetDiscoveryInputObservationV1Schema,
  ProviderTargetDiscoveryObservationCutV1Schema,
  ProviderTargetDiscoveryObservationKeyFieldsV1Schema,
  ProviderTargetDiscoveryObservationSourceV1Schema,
  ProviderTargetDiscoveryObservationSourcesV1Schema,
  ProviderTargetDiscoveryPointInvalidReasonV1Schema,
  ProviderTargetDiscoveryPointInvalidStageV1Schema,
  ProviderTargetDiscoveryRequiredDimensionsV1Schema,
  ProviderTargetDiscoveryResultEnvelopeV1Schema,
  ProviderTargetDiscoveryResultLocatorV1Schema,
  ProviderTargetDiscoveryResultPinV1Schema,
  ProviderTargetDiscoveryResultSignatureWrapperV1Schema,
  ProviderTargetDiscoveryResultUnsignedClaimsV1Schema,
  ProviderTargetDiscoveryResultV1Schema,
  ProviderTargetDiscoveryRunnerInstancePinV1Schema,
  ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema,
  ProviderTargetDiscoveryRunnerRunLocatorV1Schema,
  ProviderTargetDiscoveryRunnerRunManifestV1Schema,
  ProviderTargetDiscoverySourceManifestRecordSetFieldsV1Schema,
  ProviderTargetDiscoverySourceManifestRecordV1Schema,
  ProviderTargetDiscoverySourceObservationSetFieldsV1Schema,
  ProviderTargetDiscoverySourceObservationSetSummaryV1Schema,
  ProviderTargetDiscoverySourceRecordOutcomeV1Schema,
  ProviderTargetDiscoverySourceRecordProjectionV1Schema,
  ProviderTargetDiscoveryUnresolvedObservationV1Schema,
  ProviderTargetDiscoveryUnresolvedReasonV1Schema,
} from "./provider-target-discovery-point.js";
import {
  ProviderTargetDiscoveryPointGoldenManifestV1Schema,
  ProviderTargetDiscoveryPointInvalidManifestV1Schema,
} from "./provider-target-discovery-point-fixtures.js";
import {
  ProviderFeasibilityApprovalKeysV1Schema,
  ProviderFeasibilityApproverKeyIdFieldsV1Schema,
  ProviderFeasibilityApproverPublicKeySignatureWrapperV1Schema,
  ProviderFeasibilityApproverPublicKeyUnsignedClaimsV1Schema,
  ProviderFeasibilityApproverPublicKeyV1Schema,
  ProviderFeasibilityEvidencePinV1Schema,
  ProviderRegistryManifestEnabledMemberV1Schema,
  ProviderRegistryManifestEnvelopeV1Schema,
  ProviderRegistryManifestGenesisIdFieldsV1Schema,
  ProviderRegistryManifestGenesisPredecessorV1Schema,
  ProviderRegistryManifestGenesisUnsignedClaimsV1Schema,
  ProviderRegistryManifestGenesisV1Schema,
  ProviderRegistryManifestIdFieldsV1Schema,
  ProviderRegistryManifestMemberV1Schema,
  ProviderRegistryManifestPinV1Schema,
  ProviderRegistryManifestRevokedMemberV1Schema,
  ProviderRegistryManifestRoutingV1Schema,
  ProviderRegistryManifestSignatureWrapperV1Schema,
  ProviderRegistryManifestSuccessorIdFieldsV1Schema,
  ProviderRegistryManifestSuccessorPredecessorV1Schema,
  ProviderRegistryManifestSuccessorUnsignedClaimsV1Schema,
  ProviderRegistryManifestSuccessorV1Schema,
  ProviderRegistryManifestUnsignedClaimsV1Schema,
  ProviderRegistryManifestV1Schema,
  StoreDurableObjectProviderBindingDerivationGenerationSignatureWrapperV1Schema,
  StoreDurableObjectProviderBindingDerivationGenerationUnsignedClaimsV1Schema,
  StoreDurableObjectProviderBindingDerivationGenerationV1Schema,
  StoreDurableObjectProviderRegistryEntryGenesisUnsignedClaimsV1Schema,
  StoreDurableObjectProviderRegistryEntryGenesisV1Schema,
  StoreDurableObjectProviderRegistryEntrySignatureWrapperV1Schema,
  StoreDurableObjectProviderRegistryEntrySuccessorUnsignedClaimsV1Schema,
  StoreDurableObjectProviderRegistryEntrySuccessorV1Schema,
  StoreDurableObjectProviderRegistryEntryUnsignedClaimsV1Schema,
  StoreDurableObjectProviderRegistryEntryV1Schema,
  StoreDurableObjectProviderRuntimeAttestationPinV1Schema,
  StoreDurableObjectProviderRuntimeAttestationSignatureWrapperV1Schema,
  StoreDurableObjectProviderRuntimeAttestationUnsignedClaimsV1Schema,
  StoreDurableObjectProviderRuntimeAttestationV1Schema,
  StoreDurableObjectProviderVerificationKeysV1Schema,
  StoreDurableObjectProviderVerificationKeyUsageV1Schema,
  StoreDurableObjectProviderVerificationPublicKeySignatureWrapperV1Schema,
  StoreDurableObjectProviderVerificationPublicKeyUnsignedClaimsV1Schema,
  StoreDurableObjectProviderVerificationPublicKeyV1Schema,
  StoreProviderVerificationKeyIdFieldsV1Schema,
} from "./provider-registry-records.js";
import {
  ProviderRegistryRootCrossSignatureWrapperV1Schema,
  ProviderRegistryRootRecoverySignatureWrapperV1Schema,
} from "./provider-registry-root-history.js";
import {
  ProviderRegistryRootHistoryGoldenManifestV1Schema,
  ProviderRegistryRootHistoryInvalidManifestV1Schema,
  ProviderRegistryRootHistoryInvalidReasonV1Schema,
  ProviderRegistryRootHistoryInvalidStageV1Schema,
} from "./provider-registry-root-history-fixtures.js";
import {
  ProviderRegistryManifestHistoryGoldenManifestV1Schema,
  ProviderRegistryManifestHistoryInvalidManifestV1Schema,
  ProviderRegistryManifestHistoryInvalidReasonV1Schema,
  ProviderRegistryManifestHistoryInvalidStageV1Schema,
} from "./provider-registry-manifest-fixtures.js";
import {
  ProviderEd25519PublicKeyDigestGoldenCaseV1Schema,
  ProviderEd25519PublicKeyDigestGoldenManifestV1Schema,
} from "./public-key-digest.js";
import {
  ProviderEd25519VerificationProfileV1Schema,
  ProviderStrictEd25519AdversarialCaseV1Schema,
  ProviderStrictEd25519AdversarialManifestEnvelopeV1Schema,
  ProviderStrictEd25519AdversarialManifestPinV1Schema,
  ProviderStrictEd25519AdversarialManifestV1Schema,
  ProviderStrictEd25519CryptoCapabilityV1Schema,
} from "./strict-ed25519-conformance.js";

function defineProviderContractJsonSchemaSourcesV1<
  const T extends Record<string, z.ZodType>,
>(sources: T): { readonly [K in keyof T]: z.ZodType } {
  return sources;
}

export const PROVIDER_CONTRACT_JSON_SCHEMA_SOURCES_V1 =
  defineProviderContractJsonSchemaSourcesV1({
  "canonical-byte-string": CanonicalByteStringV1Schema,
  "canonical-public-key-bytes-32": CanonicalPublicKeyBytes32V1Schema,
  "content-digest": ContentDigestV1Schema,
  "durable-object-identity-provider-id":
    DurableObjectIdentityProviderIdV1Schema,
  "durable-object-identity-provider-slug":
    DurableObjectIdentityProviderSlugV1Schema,
  "ed25519-public-key-digest": Ed25519PublicKeyDigestV1Schema,
  "ed25519-public-key-digest-golden-case":
    ProviderEd25519PublicKeyDigestGoldenCaseV1Schema,
  "ed25519-public-key-digest-golden-manifest":
    ProviderEd25519PublicKeyDigestGoldenManifestV1Schema,
  "installation-identity-generation-fields":
    InstallationIdentityGenerationFieldsV1Schema,
  "installation-identity-generation-id":
    InstallationIdentityGenerationIdV1Schema,
  "installation-identity-key-check-fields":
    InstallationIdentityKeyCheckFieldsV1Schema,
  "keyed-state-token": KeyedStateTokenV1Schema,
  "lower-hex-22": LowerHex22V1Schema,
  "lower-hex-32": LowerHex32V1Schema,
  "lower-hex-64": LowerHex64V1Schema,
  "provider-registry-root-key-id": ProviderRegistryRootKeyIdV1Schema,
  "provider-registry-manifest-generation-id":
    ProviderRegistryManifestGenerationIdV1Schema,
  "provider-migration-id": ProviderMigrationIdV1Schema,
  "provider-feasibility-evidence-id":
    ProviderFeasibilityEvidenceIdV1Schema,
  "store-provider-verification-key-id":
    StoreProviderVerificationKeyIdV1Schema,
  "provider-feasibility-approver-key-id":
    ProviderFeasibilityApproverKeyIdV1Schema,
  "provider-os-release-family-code":
    ProviderOsReleaseFamilyCodeV1Schema,
  "provider-filesystem-profile-code":
    ProviderFilesystemProfileCodeV1Schema,
  "provider-target-profile-id": ProviderTargetProfileIdV1Schema,
  "provider-public-support-profile-id":
    ProviderPublicSupportProfileIdV1Schema,
  "provider-real-filesystem-case-id":
    ProviderRealFilesystemCaseIdV1Schema,
  "provider-real-filesystem-case-key":
    ProviderRealFilesystemCaseKeyV1Schema,
  "provider-real-filesystem-crash-cut-id":
    ProviderRealFilesystemCrashCutIdV1Schema,
  "provider-real-filesystem-fixture-corpus-manifest-signature":
    ProviderRealFilesystemFixtureCorpusManifestSignatureV1Schema,
  "provider-real-filesystem-suite-manifest-signature":
    ProviderRealFilesystemSuiteManifestSignatureV1Schema,
  "provider-public-support-taxonomy-signature":
    ProviderPublicSupportTaxonomySignatureV1Schema,
  "provider-release-matrix-signature":
    ProviderReleaseMatrixSignatureV1Schema,
  "provider-target-discovery-input-bundle-signature":
    ProviderTargetDiscoveryInputBundleSignatureV1Schema,
  "provider-target-discovery-result-signature":
    ProviderTargetDiscoveryResultSignatureV1Schema,
  "store-provider-registry-signature":
    StoreProviderRegistrySignatureV1Schema,
  "provider-registry-manifest-signature":
    ProviderRegistryManifestSignatureV1Schema,
  "provider-registry-root-key-id-fields":
    ProviderRegistryRootKeyIdFieldsV1Schema,
  "provider-capability-failure-reason":
    ProviderCapabilityFailureReasonV1Schema,
  "provider-unavailable-tool-error": ProviderUnavailableToolErrorV1Schema,
  "provider-ed25519-verification-profile":
    ProviderEd25519VerificationProfileV1Schema,
  "provider-strict-ed25519-adversarial-case":
    ProviderStrictEd25519AdversarialCaseV1Schema,
  "provider-strict-ed25519-adversarial-manifest":
    ProviderStrictEd25519AdversarialManifestV1Schema,
  "provider-strict-ed25519-adversarial-manifest-envelope":
    ProviderStrictEd25519AdversarialManifestEnvelopeV1Schema,
  "provider-strict-ed25519-adversarial-manifest-pin":
    ProviderStrictEd25519AdversarialManifestPinV1Schema,
  "provider-strict-ed25519-crypto-capability":
    ProviderStrictEd25519CryptoCapabilityV1Schema,
  "provider-migration-history-quota-policy":
    ProviderMigrationHistoryQuotaPolicyV1Schema,
  "provider-trust-history-policy": ProviderTrustHistoryPolicyV1Schema,
  "provider-distribution-history-policy":
    ProviderDistributionHistoryPolicyV1Schema,
  "provider-bootstrap-trust-bundle-pin":
    ProviderBootstrapTrustBundlePinV1Schema,
  "provider-signed-package-identity-fields":
    ProviderSignedPackageIdentityFieldsV1Schema,
  "provider-signed-distribution-root-binding":
    ProviderSignedDistributionRootBindingV1Schema,
  "provider-registry-iso-timestamp":
    ProviderRegistryIsoTimestampV1Schema,
  "provider-registry-recovery-key-id":
    ProviderRegistryRecoveryKeyIdV1Schema,
  "provider-registry-recovery-key-id-fields":
    ProviderRegistryRecoveryKeyIdFieldsV1Schema,
  "provider-registry-root-self-signature":
    ProviderRegistryRootSelfSignatureV1Schema,
  "provider-registry-root-cross-signature":
    ProviderRegistryRootCrossSignatureV1Schema,
  "provider-registry-root-recovery-signature":
    ProviderRegistryRootRecoverySignatureV1Schema,
  "provider-registry-root-public-key":
    ProviderRegistryRootPublicKeyV1Schema,
  "provider-registry-recovery-public-key":
    ProviderRegistryRecoveryPublicKeyV1Schema,
  "provider-registry-root-metadata":
    ProviderRegistryRootMetadataV1Schema,
  "provider-registry-root-metadata-unsigned-claims":
    ProviderRegistryRootMetadataUnsignedClaimsV1Schema,
  "provider-registry-root-metadata-envelope":
    ProviderRegistryRootMetadataEnvelopeV1Schema,
  "provider-registry-root-metadata-pin":
    ProviderRegistryRootMetadataPinV1Schema,
  "provider-registry-root-self-signature-wrapper":
    ProviderRegistryRootSelfSignatureWrapperV1Schema,
  "provider-registry-root-cross-signature-wrapper":
    ProviderRegistryRootCrossSignatureWrapperV1Schema,
  "provider-registry-root-recovery-signature-wrapper":
    ProviderRegistryRootRecoverySignatureWrapperV1Schema,
  "store-filename-key-syntax": StoreFilenameKeySyntaxV1Schema,
  "short-store-filename-key-syntax":
    ShortStoreFilenameKeySyntaxV1Schema,
  "hashed-store-filename-key": HashedStoreFilenameKeyV1Schema,
  "provider-registry-root-metadata-locator":
    ProviderRegistryRootMetadataLocatorV1Schema,
  "provider-registry-manifest-locator":
    ProviderRegistryManifestLocatorV1Schema,
  "provider-real-filesystem-fixture-corpus-manifest-locator":
    ProviderRealFilesystemFixtureCorpusManifestLocatorV1Schema,
  "provider-real-filesystem-suite-manifest-locator":
    ProviderRealFilesystemSuiteManifestLocatorV1Schema,
  "store-durable-object-provider-verification-key-usage":
    StoreDurableObjectProviderVerificationKeyUsageV1Schema,
  "store-provider-verification-key-id-fields":
    StoreProviderVerificationKeyIdFieldsV1Schema,
  "provider-feasibility-approver-key-id-fields":
    ProviderFeasibilityApproverKeyIdFieldsV1Schema,
  "store-durable-object-provider-runtime-attestation-unsigned-claims":
    StoreDurableObjectProviderRuntimeAttestationUnsignedClaimsV1Schema,
  "store-durable-object-provider-runtime-attestation":
    StoreDurableObjectProviderRuntimeAttestationV1Schema,
  "store-durable-object-provider-runtime-attestation-pin":
    StoreDurableObjectProviderRuntimeAttestationPinV1Schema,
  "store-durable-object-provider-verification-public-key-unsigned-claims":
    StoreDurableObjectProviderVerificationPublicKeyUnsignedClaimsV1Schema,
  "store-durable-object-provider-verification-public-key":
    StoreDurableObjectProviderVerificationPublicKeyV1Schema,
  "store-durable-object-provider-binding-derivation-generation-unsigned-claims":
    StoreDurableObjectProviderBindingDerivationGenerationUnsignedClaimsV1Schema,
  "store-durable-object-provider-binding-derivation-generation":
    StoreDurableObjectProviderBindingDerivationGenerationV1Schema,
  "provider-feasibility-approver-public-key-unsigned-claims":
    ProviderFeasibilityApproverPublicKeyUnsignedClaimsV1Schema,
  "provider-feasibility-approver-public-key":
    ProviderFeasibilityApproverPublicKeyV1Schema,
  "provider-feasibility-evidence-pin":
    ProviderFeasibilityEvidencePinV1Schema,
  "provider-feasibility-approval-keys":
    ProviderFeasibilityApprovalKeysV1Schema,
  "store-durable-object-provider-verification-keys":
    StoreDurableObjectProviderVerificationKeysV1Schema,
  "store-durable-object-provider-registry-entry-genesis-unsigned-claims":
    StoreDurableObjectProviderRegistryEntryGenesisUnsignedClaimsV1Schema,
  "store-durable-object-provider-registry-entry-successor-unsigned-claims":
    StoreDurableObjectProviderRegistryEntrySuccessorUnsignedClaimsV1Schema,
  "store-durable-object-provider-registry-entry-unsigned-claims":
    StoreDurableObjectProviderRegistryEntryUnsignedClaimsV1Schema,
  "store-durable-object-provider-registry-entry-genesis":
    StoreDurableObjectProviderRegistryEntryGenesisV1Schema,
  "store-durable-object-provider-registry-entry-successor":
    StoreDurableObjectProviderRegistryEntrySuccessorV1Schema,
  "store-durable-object-provider-registry-entry":
    StoreDurableObjectProviderRegistryEntryV1Schema,
  "provider-registry-manifest-enabled-member":
    ProviderRegistryManifestEnabledMemberV1Schema,
  "provider-registry-manifest-revoked-member":
    ProviderRegistryManifestRevokedMemberV1Schema,
  "provider-registry-manifest-member":
    ProviderRegistryManifestMemberV1Schema,
  "provider-registry-manifest-routing":
    ProviderRegistryManifestRoutingV1Schema,
  "provider-registry-manifest-genesis-predecessor":
    ProviderRegistryManifestGenesisPredecessorV1Schema,
  "provider-registry-manifest-successor-predecessor":
    ProviderRegistryManifestSuccessorPredecessorV1Schema,
  "provider-registry-manifest-genesis-id-fields":
    ProviderRegistryManifestGenesisIdFieldsV1Schema,
  "provider-registry-manifest-successor-id-fields":
    ProviderRegistryManifestSuccessorIdFieldsV1Schema,
  "provider-registry-manifest-id-fields":
    ProviderRegistryManifestIdFieldsV1Schema,
  "provider-registry-manifest-genesis-unsigned-claims":
    ProviderRegistryManifestGenesisUnsignedClaimsV1Schema,
  "provider-registry-manifest-successor-unsigned-claims":
    ProviderRegistryManifestSuccessorUnsignedClaimsV1Schema,
  "provider-registry-manifest-unsigned-claims":
    ProviderRegistryManifestUnsignedClaimsV1Schema,
  "provider-registry-manifest-genesis":
    ProviderRegistryManifestGenesisV1Schema,
  "provider-registry-manifest-successor":
    ProviderRegistryManifestSuccessorV1Schema,
  "provider-registry-manifest": ProviderRegistryManifestV1Schema,
  "provider-registry-manifest-envelope":
    ProviderRegistryManifestEnvelopeV1Schema,
  "provider-registry-manifest-pin": ProviderRegistryManifestPinV1Schema,
  "store-durable-object-provider-runtime-attestation-signature-wrapper":
    StoreDurableObjectProviderRuntimeAttestationSignatureWrapperV1Schema,
  "store-durable-object-provider-verification-public-key-signature-wrapper":
    StoreDurableObjectProviderVerificationPublicKeySignatureWrapperV1Schema,
  "store-durable-object-provider-binding-derivation-generation-signature-wrapper":
    StoreDurableObjectProviderBindingDerivationGenerationSignatureWrapperV1Schema,
  "provider-feasibility-approver-public-key-signature-wrapper":
    ProviderFeasibilityApproverPublicKeySignatureWrapperV1Schema,
  "store-durable-object-provider-registry-entry-signature-wrapper":
    StoreDurableObjectProviderRegistryEntrySignatureWrapperV1Schema,
  "provider-registry-manifest-signature-wrapper":
    ProviderRegistryManifestSignatureWrapperV1Schema,
  "provider-registry-root-history-golden-manifest":
    ProviderRegistryRootHistoryGoldenManifestV1Schema,
  "provider-registry-root-history-invalid-manifest":
    ProviderRegistryRootHistoryInvalidManifestV1Schema,
  "provider-registry-root-history-invalid-stage":
    ProviderRegistryRootHistoryInvalidStageV1Schema,
  "provider-registry-root-history-invalid-reason":
    ProviderRegistryRootHistoryInvalidReasonV1Schema,
  "provider-registry-manifest-history-golden-manifest":
    ProviderRegistryManifestHistoryGoldenManifestV1Schema,
  "provider-registry-manifest-history-invalid-manifest":
    ProviderRegistryManifestHistoryInvalidManifestV1Schema,
  "provider-registry-manifest-history-invalid-stage":
    ProviderRegistryManifestHistoryInvalidStageV1Schema,
  "provider-registry-manifest-history-invalid-reason":
    ProviderRegistryManifestHistoryInvalidReasonV1Schema,
  "provider-bootstrap-trust-bundle":
    ProviderBootstrapTrustBundleV1Schema,
  "provider-bootstrap-trust-bundle-envelope":
    ProviderBootstrapTrustBundleEnvelopeV1Schema,
  "provider-bootstrap-trust-golden-manifest":
    ProviderBootstrapTrustGoldenManifestV1Schema,
  "provider-bootstrap-trust-invalid-manifest":
    ProviderBootstrapTrustInvalidManifestV1Schema,
  "installation-identity-bootstrap-trust-fields":
    InstallationIdentityBootstrapTrustFieldsV1Schema,
  "provider-real-filesystem-fixture-program-fields":
    ProviderRealFilesystemFixtureProgramFieldsV1Schema,
  "provider-real-filesystem-fixture-corpus-record":
    ProviderRealFilesystemFixtureCorpusRecordV1Schema,
  "provider-real-filesystem-fixture-corpus-record-set-fields":
    ProviderRealFilesystemFixtureCorpusRecordSetFieldsV1Schema,
  "provider-real-filesystem-fixture-case-record-set-fields":
    ProviderRealFilesystemFixtureCaseRecordSetFieldsV1Schema,
  "provider-real-filesystem-fixture-manifest-fields":
    ProviderRealFilesystemFixtureManifestFieldsV1Schema,
  "provider-real-filesystem-fixture-corpus-manifest-unsigned-claims":
    ProviderRealFilesystemFixtureCorpusManifestUnsignedClaimsV1Schema,
  "provider-real-filesystem-fixture-corpus-manifest":
    ProviderRealFilesystemFixtureCorpusManifestV1Schema,
  "provider-real-filesystem-fixture-corpus-manifest-envelope":
    ProviderRealFilesystemFixtureCorpusManifestEnvelopeV1Schema,
  "provider-real-filesystem-fixture-corpus-manifest-pin":
    ProviderRealFilesystemFixtureCorpusManifestPinV1Schema,
  "provider-real-filesystem-fixture-corpus-manifest-signature-wrapper":
    ProviderRealFilesystemFixtureCorpusManifestSignatureWrapperV1Schema,
  "provider-real-filesystem-runner-profile":
    ProviderRealFilesystemRunnerProfileV1Schema,
  "provider-real-filesystem-suite-crash-cut":
    ProviderRealFilesystemSuiteCrashCutV1Schema,
  "provider-real-filesystem-suite-case":
    ProviderRealFilesystemSuiteCaseV1Schema,
  "provider-real-filesystem-case-id-fields":
    ProviderRealFilesystemCaseIdFieldsV1Schema,
  "provider-real-filesystem-crash-cut-id-fields":
    ProviderRealFilesystemCrashCutIdFieldsV1Schema,
  "provider-real-filesystem-recovery-assertion-fields":
    ProviderRealFilesystemRecoveryAssertionFieldsV1Schema,
  "provider-real-filesystem-suite-case-set-fields":
    ProviderRealFilesystemSuiteCaseSetFieldsV1Schema,
  "provider-real-filesystem-required-case-cut-entry":
    ProviderRealFilesystemRequiredCaseCutEntryV1Schema,
  "provider-real-filesystem-required-case-cut-set-fields":
    ProviderRealFilesystemRequiredCaseCutSetFieldsV1Schema,
  "provider-real-filesystem-suite-definition-fields":
    ProviderRealFilesystemSuiteDefinitionFieldsV1Schema,
  "provider-real-filesystem-suite-manifest-unsigned-claims":
    ProviderRealFilesystemSuiteManifestUnsignedClaimsV1Schema,
  "provider-real-filesystem-suite-manifest":
    ProviderRealFilesystemSuiteManifestV1Schema,
  "provider-real-filesystem-suite-manifest-envelope":
    ProviderRealFilesystemSuiteManifestEnvelopeV1Schema,
  "provider-real-filesystem-suite-manifest-pin":
    ProviderRealFilesystemSuiteManifestPinV1Schema,
  "provider-real-filesystem-suite-manifest-signature-wrapper":
    ProviderRealFilesystemSuiteManifestSignatureWrapperV1Schema,
  "provider-real-filesystem-source-golden-manifest":
    ProviderRealFilesystemSourceGoldenManifestV1Schema,
  "provider-real-filesystem-source-invalid-manifest":
    ProviderRealFilesystemSourceInvalidManifestV1Schema,
  "provider-real-filesystem-source-invalid-stage":
    ProviderRealFilesystemSourceInvalidStageV1Schema,
  "provider-real-filesystem-source-invalid-reason":
    ProviderRealFilesystemSourceInvalidReasonV1Schema,
  "provider-real-filesystem-conformance-result-id":
    ProviderRealFilesystemConformanceResultIdV1Schema,
  "provider-real-filesystem-conformance-case-outcome":
    ProviderRealFilesystemConformanceCaseOutcomeV1Schema,
  "provider-real-filesystem-conformance-result-code":
    ProviderRealFilesystemConformanceResultCodeV1Schema,
  "provider-real-filesystem-conformance-case-result":
    ProviderRealFilesystemConformanceCaseResultV1Schema,
  "provider-real-filesystem-conformance-result-id-fields":
    ProviderRealFilesystemConformanceResultIdFieldsV1Schema,
  "provider-real-filesystem-conformance-result":
    ProviderRealFilesystemConformanceResultV1Schema,
  "provider-real-filesystem-conformance-result-envelope":
    ProviderRealFilesystemConformanceResultEnvelopeV1Schema,
  "provider-real-filesystem-conformance-result-locator":
    ProviderRealFilesystemConformanceResultLocatorV1Schema,
  "provider-real-filesystem-conformance-result-pin":
    ProviderRealFilesystemConformanceResultPinV1Schema,
  "provider-real-filesystem-conformance-result-invalid-stage":
    ProviderRealFilesystemConformanceResultInvalidStageV1Schema,
  "provider-real-filesystem-conformance-result-invalid-reason":
    ProviderRealFilesystemConformanceResultInvalidReasonV1Schema,
  "provider-real-filesystem-conformance-result-golden-manifest":
    ProviderRealFilesystemConformanceResultGoldenManifestV1Schema,
  "provider-real-filesystem-conformance-result-invalid-manifest":
    ProviderRealFilesystemConformanceResultInvalidManifestV1Schema,
  "provider-public-linux-distribution-id":
    ProviderPublicLinuxDistributionIdV1Schema,
  "provider-public-os-release-family-descriptor":
    ProviderPublicOsReleaseFamilyDescriptorV1Schema,
  "provider-public-filesystem-descriptor":
    ProviderPublicFilesystemDescriptorV1Schema,
  "provider-public-os-release-family-code-fields":
    ProviderPublicOsReleaseFamilyCodeFieldsV1Schema,
  "provider-public-filesystem-profile-code-fields":
    ProviderPublicFilesystemProfileCodeFieldsV1Schema,
  "provider-public-os-release-family-taxonomy-record":
    ProviderPublicOsReleaseFamilyTaxonomyRecordV1Schema,
  "provider-public-filesystem-taxonomy-record":
    ProviderPublicFilesystemTaxonomyRecordV1Schema,
  "provider-public-support-taxonomy-unsigned-claims":
    ProviderPublicSupportTaxonomyUnsignedClaimsV1Schema,
  "provider-public-support-taxonomy":
    ProviderPublicSupportTaxonomyV1Schema,
  "provider-public-support-taxonomy-envelope":
    ProviderPublicSupportTaxonomyEnvelopeV1Schema,
  "provider-public-support-taxonomy-pin":
    ProviderPublicSupportTaxonomyPinV1Schema,
  "provider-public-support-taxonomy-locator":
    ProviderPublicSupportTaxonomyLocatorV1Schema,
  "provider-public-support-taxonomy-signature-wrapper":
    ProviderPublicSupportTaxonomySignatureWrapperV1Schema,
  "provider-feasibility-target-fields":
    ProviderFeasibilityTargetFieldsV1Schema,
  "provider-feasibility-target": ProviderFeasibilityTargetV1Schema,
  "provider-public-support-profile-fields":
    ProviderPublicSupportProfileFieldsV1Schema,
  "provider-release-target-universe-target-entry":
    ProviderReleaseTargetUniverseTargetEntryV1Schema,
  "provider-release-target-entry-set-fields":
    ProviderReleaseTargetEntrySetFieldsV1Schema,
  "provider-release-coverage-artifact-limits":
    ProviderReleaseCoverageArtifactLimitsV1Schema,
  "provider-release-matrix-unsigned-claims":
    ProviderReleaseMatrixUnsignedClaimsV1Schema,
  "provider-release-matrix": ProviderReleaseMatrixV1Schema,
  "provider-release-matrix-envelope": ProviderReleaseMatrixEnvelopeV1Schema,
  "provider-release-matrix-pin": ProviderReleaseMatrixPinV1Schema,
  "provider-release-matrix-locator": ProviderReleaseMatrixLocatorV1Schema,
  "provider-release-matrix-signature-wrapper":
    ProviderReleaseMatrixSignatureWrapperV1Schema,
  "provider-target-discovery-observation-source":
    ProviderTargetDiscoveryObservationSourceV1Schema,
  "provider-target-discovery-required-dimensions":
    ProviderTargetDiscoveryRequiredDimensionsV1Schema,
  "provider-target-discovery-observation-sources":
    ProviderTargetDiscoveryObservationSourcesV1Schema,
  "provider-target-discovery-unresolved-reason":
    ProviderTargetDiscoveryUnresolvedReasonV1Schema,
  "provider-target-discovery-source-record-outcome":
    ProviderTargetDiscoverySourceRecordOutcomeV1Schema,
  "provider-target-discovery-source-manifest-record":
    ProviderTargetDiscoverySourceManifestRecordV1Schema,
  "provider-target-discovery-source-manifest-record-set-fields":
    ProviderTargetDiscoverySourceManifestRecordSetFieldsV1Schema,
  "provider-target-discovery-fixture-manifest-pin":
    ProviderTargetDiscoveryFixtureManifestPinV1Schema,
  "provider-target-discovery-fixture-manifest":
    ProviderTargetDiscoveryFixtureManifestV1Schema,
  "provider-target-discovery-fixture-manifest-envelope":
    ProviderTargetDiscoveryFixtureManifestEnvelopeV1Schema,
  "provider-target-discovery-fixture-manifest-locator":
    ProviderTargetDiscoveryFixtureManifestLocatorV1Schema,
  "provider-target-discovery-runner-instance-pin":
    ProviderTargetDiscoveryRunnerInstancePinV1Schema,
  "provider-target-discovery-runner-run-manifest":
    ProviderTargetDiscoveryRunnerRunManifestV1Schema,
  "provider-target-discovery-runner-run-envelope":
    ProviderTargetDiscoveryRunnerRunEnvelopeV1Schema,
  "provider-target-discovery-runner-run-locator":
    ProviderTargetDiscoveryRunnerRunLocatorV1Schema,
  "provider-target-discovery-observation-cut":
    ProviderTargetDiscoveryObservationCutV1Schema,
  "provider-target-discovery-source-record-projection":
    ProviderTargetDiscoverySourceRecordProjectionV1Schema,
  "provider-target-discovery-input-observation":
    ProviderTargetDiscoveryInputObservationV1Schema,
  "provider-target-discovery-observation-key-fields":
    ProviderTargetDiscoveryObservationKeyFieldsV1Schema,
  "provider-target-discovery-source-observation-set-fields":
    ProviderTargetDiscoverySourceObservationSetFieldsV1Schema,
  "provider-target-discovery-input-observation-set-fields":
    ProviderTargetDiscoveryInputObservationSetFieldsV1Schema,
  "provider-target-discovery-source-observation-set-summary":
    ProviderTargetDiscoverySourceObservationSetSummaryV1Schema,
  "provider-target-discovery-input-bundle-unsigned-claims":
    ProviderTargetDiscoveryInputBundleUnsignedClaimsV1Schema,
  "provider-target-discovery-input-bundle":
    ProviderTargetDiscoveryInputBundleV1Schema,
  "provider-target-discovery-input-bundle-signature-wrapper":
    ProviderTargetDiscoveryInputBundleSignatureWrapperV1Schema,
  "provider-target-discovery-unresolved-observation":
    ProviderTargetDiscoveryUnresolvedObservationV1Schema,
  "provider-target-discovery-result-unsigned-claims":
    ProviderTargetDiscoveryResultUnsignedClaimsV1Schema,
  "provider-target-discovery-result": ProviderTargetDiscoveryResultV1Schema,
  "provider-target-discovery-result-envelope":
    ProviderTargetDiscoveryResultEnvelopeV1Schema,
  "provider-target-discovery-result-pin":
    ProviderTargetDiscoveryResultPinV1Schema,
  "provider-target-discovery-result-locator":
    ProviderTargetDiscoveryResultLocatorV1Schema,
  "provider-target-discovery-result-signature-wrapper":
    ProviderTargetDiscoveryResultSignatureWrapperV1Schema,
  "provider-target-discovery-point-invalid-stage":
    ProviderTargetDiscoveryPointInvalidStageV1Schema,
  "provider-target-discovery-point-invalid-reason":
    ProviderTargetDiscoveryPointInvalidReasonV1Schema,
  "provider-target-discovery-point-golden-manifest":
    ProviderTargetDiscoveryPointGoldenManifestV1Schema,
  "provider-target-discovery-point-invalid-manifest":
    ProviderTargetDiscoveryPointInvalidManifestV1Schema,
  });

export type ProviderContractJsonSchemaNameV1 =
  keyof typeof PROVIDER_CONTRACT_JSON_SCHEMA_SOURCES_V1;

export interface ProviderContractJsonSchemaDocumentV1 {
  $id: string;
  $schema?: string;
  [keyword: string]: unknown;
}

function closeExactTupleKeywords(value: unknown): void {
  if (Array.isArray(value)) {
    for (const child of value) closeExactTupleKeywords(child);
    return;
  }
  if (value === null || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (
    Array.isArray(record.prefixItems) &&
    record.items === undefined
  ) {
    record.minItems = record.prefixItems.length;
    record.maxItems = record.prefixItems.length;
    record.items = false;
  }
  for (const child of Object.values(record)) {
    closeExactTupleKeywords(child);
  }
}

function schemaDocument(
  name: ProviderContractJsonSchemaNameV1,
  schema: z.ZodType,
): ProviderContractJsonSchemaDocumentV1 {
  const generated = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    unrepresentable: "any",
  }) as unknown as Record<string, unknown>;
  closeExactTupleKeywords(generated);
  return {
    $id: `urn:understand-code:provider-contract:schema:v1:${name}`,
    ...generated,
  };
}

export function generateProviderContractJsonSchemasV1(): Record<
  ProviderContractJsonSchemaNameV1,
  ProviderContractJsonSchemaDocumentV1
> {
  const generated: Partial<
    Record<
      ProviderContractJsonSchemaNameV1,
      ProviderContractJsonSchemaDocumentV1
    >
  > = {};
  for (const [name, schema] of Object.entries(
    PROVIDER_CONTRACT_JSON_SCHEMA_SOURCES_V1,
  ) as Array<[ProviderContractJsonSchemaNameV1, z.ZodType]>) {
    generated[name] = schemaDocument(name, schema);
  }
  return generated as Record<
    ProviderContractJsonSchemaNameV1,
    ProviderContractJsonSchemaDocumentV1
  >;
}
