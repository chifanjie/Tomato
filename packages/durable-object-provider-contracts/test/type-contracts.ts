import type {
  CanonicalByteStringV1,
  CanonicalPublicKeyBytes32V1,
  ContentDigestV1,
  Ed25519PublicKeyDigestV1,
  InstallationIdentityGenerationFieldsV1,
  InstallationIdentityGenerationIdV1,
  InstallationIdentityKeyCheckFieldsV1,
  KeyedStateTokenV1,
  LowerHex22V1,
  ProviderFeasibilityApproverKeyIdV1,
  ProviderFeasibilityApproverPublicKeyV1,
  ProviderFeasibilityEvidencePinV1,
  ProviderMigrationIdV1,
  ProviderRegistryManifestGenerationIdV1,
  ProviderRegistryManifestHistoryValidationV1,
  ProviderRegistryManifestMemberV1,
  ProviderRegistryManifestRelativePathV1,
  ProviderRegistryManifestRoutingV1,
  ProviderRegistryManifestSignatureV1,
  ProviderRegistryRootMetadataPinV1,
  ProviderCryptoHostV1,
  ProviderCapabilityFailureReasonV1,
  ProviderBootstrapTrustBundlePinV1,
  ProviderBootstrapTrustBundleStructureValidationV1,
  ProviderBootstrapTrustBundleV1,
  ProviderBootstrapTrustGoldenManifestV1,
  ProviderRegistryRecoveryKeyIdV1,
  ProviderRegistryRecoveryPublicKeyV1,
  ProviderUnavailableToolErrorV1,
  ProviderRegistryRootKeyIdFieldsV1,
  ProviderRegistryRootKeyIdV1,
  ProviderSignedDistributionRootBindingV1,
  ProviderStrictEd25519CryptoHostV1,
  ProviderStrictEd25519OpaqueCapabilityV1,
  InstallationBootstrapTrustUseStructureAssessmentV1,
  InstallationIdentityRetainedTrustStructureValidationV1,
  HashedStoreFilenameKeyV1,
  ProviderRegistryRootHistoryGoldenManifestV1,
  ProviderRegistryRootHistoryInvalidManifestV1,
  ProviderRegistryRootMetadataHistoryValidationV1,
  ShortStoreFilenameKeyV1,
  StoreDurableObjectProviderRuntimeAttestationPinV1,
  StoreFilenameKeyV1,
  StoreProviderRegistrySignatureV1,
  StoreProviderVerificationKeyIdV1,
} from "../src/index.js";
import {
  encodeStoreFilenameKeyV1,
  deriveInstallationIdentityGenerationIdV1,
  deriveInstallationIdentityKeyCheckTokenV1,
  deriveProviderRegistryRootKeyIdV1,
  createProviderUnavailableToolErrorV1,
} from "../src/index.js";

declare const lowerHex22: LowerHex22V1;
declare const rootKeyId: ProviderRegistryRootKeyIdV1;
declare const contentDigest: ContentDigestV1;
declare const publicKeyDigest: Ed25519PublicKeyDigestV1;
declare const keyedStateToken: KeyedStateTokenV1;
declare const canonicalBytes: CanonicalByteStringV1;
declare const publicKeyBytes: CanonicalPublicKeyBytes32V1;
declare const generationFields: InstallationIdentityGenerationFieldsV1;
declare const keyCheckFields: InstallationIdentityKeyCheckFieldsV1;
declare const rootKeyFields: ProviderRegistryRootKeyIdFieldsV1;
declare const cryptoHost: ProviderCryptoHostV1;
declare const installationKey: Uint8Array;
declare const providerFailureReason: ProviderCapabilityFailureReasonV1;
declare const strictCryptoHost: ProviderStrictEd25519CryptoHostV1;
declare const strictCapability: ProviderStrictEd25519OpaqueCapabilityV1;
declare const recoveryKeyId: ProviderRegistryRecoveryKeyIdV1;
declare const recoveryPublicKey: ProviderRegistryRecoveryPublicKeyV1;
declare const bootstrapTrustBundlePin: ProviderBootstrapTrustBundlePinV1;
declare const distributionRootBinding: ProviderSignedDistributionRootBindingV1;
declare const bundleStructure:
  ProviderBootstrapTrustBundleStructureValidationV1;
declare const retainedStructure:
  InstallationIdentityRetainedTrustStructureValidationV1;
declare const trustUseAssessment:
  InstallationBootstrapTrustUseStructureAssessmentV1;
declare const bootstrapTrustGolden:
  ProviderBootstrapTrustGoldenManifestV1;
declare const recoveryGolden0:
  ProviderBootstrapTrustGoldenManifestV1["vectors"]["recoveryKeyIds"][0];
declare const recoveryGolden1:
  ProviderBootstrapTrustGoldenManifestV1["vectors"]["recoveryKeyIds"][1];
declare const recoveryGolden2:
  ProviderBootstrapTrustGoldenManifestV1["vectors"]["recoveryKeyIds"][2];
declare const shortFilenameKey: ShortStoreFilenameKeyV1;
declare const hashedFilenameKey: HashedStoreFilenameKeyV1;
declare const rootHistory:
  ProviderRegistryRootMetadataHistoryValidationV1;
declare const rootHistoryGolden:
  ProviderRegistryRootHistoryGoldenManifestV1;
declare const rootHistoryInvalid:
  ProviderRegistryRootHistoryInvalidManifestV1;
declare const manifestGenerationId:
  ProviderRegistryManifestGenerationIdV1;
declare const installationGenerationId:
  InstallationIdentityGenerationIdV1;
declare const providerVerificationKeyId:
  StoreProviderVerificationKeyIdV1;
declare const approverKeyId:
  ProviderFeasibilityApproverKeyIdV1;
declare const registrySignature:
  StoreProviderRegistrySignatureV1;
declare const manifestSignature:
  ProviderRegistryManifestSignatureV1;
declare const evidencePin: ProviderFeasibilityEvidencePinV1;
declare const runtimePin:
  StoreDurableObjectProviderRuntimeAttestationPinV1;
declare const rootMetadataPin: ProviderRegistryRootMetadataPinV1;
declare const manifestMember: ProviderRegistryManifestMemberV1;
declare const migrationId: ProviderMigrationIdV1;
declare const registryManifestHistory:
  ProviderRegistryManifestHistoryValidationV1;
const storeFilenameFromShort: StoreFilenameKeyV1 = shortFilenameKey;
const storeFilenameFromHash: StoreFilenameKeyV1 = hashedFilenameKey;

// @ts-expect-error semantic brands with the same wire shape are not interchangeable
const rootKeyFromGenericHex: ProviderRegistryRootKeyIdV1 = lowerHex22;
// @ts-expect-error semantic brands with the same wire shape are not interchangeable
const genericHexFromRootKey: LowerHex22V1 = rootKeyId;
// @ts-expect-error root and recovery key IDs use independent semantic domains
const rootKeyFromRecoveryKey: ProviderRegistryRootKeyIdV1 = recoveryKeyId;
// @ts-expect-error root and recovery key IDs use independent semantic domains
const recoveryKeyFromRootKey: ProviderRegistryRecoveryKeyIdV1 = rootKeyId;
const recoveryKeyTriple:
  ProviderBootstrapTrustBundleV1["providerRegistryRecoveryKeys"] = [
    recoveryPublicKey,
    recoveryPublicKey,
    recoveryPublicKey,
  ];
// @ts-expect-error the Bundle contract requires exactly three recovery keys
const recoveryKeyPair:
  ProviderBootstrapTrustBundleV1["providerRegistryRecoveryKeys"] = [
    recoveryPublicKey,
    recoveryPublicKey,
  ];
// @ts-expect-error the Bundle contract rejects a fourth recovery key
const recoveryKeyQuad:
  ProviderBootstrapTrustBundleV1["providerRegistryRecoveryKeys"] = [
    recoveryPublicKey,
    recoveryPublicKey,
    recoveryPublicKey,
    recoveryPublicKey,
  ];
const recoveryGoldenTriple:
  ProviderBootstrapTrustGoldenManifestV1["vectors"]["recoveryKeyIds"] = [
    recoveryGolden0,
    recoveryGolden1,
    recoveryGolden2,
  ];
// @ts-expect-error the golden contract exact-covers all three recovery keys
const recoveryGoldenPair:
  ProviderBootstrapTrustGoldenManifestV1["vectors"]["recoveryKeyIds"] = [
    recoveryGolden0,
    recoveryGolden1,
  ];
// @ts-expect-error the golden contract rejects a fourth recovery vector
const recoveryGoldenQuad:
  ProviderBootstrapTrustGoldenManifestV1["vectors"]["recoveryKeyIds"] = [
    recoveryGolden0,
    recoveryGolden1,
    recoveryGolden2,
    recoveryGolden2,
  ];
// @ts-expect-error digest and keyed-token brands are not interchangeable
const tokenFromDigest: KeyedStateTokenV1 = contentDigest;
// @ts-expect-error digest and keyed-token brands are not interchangeable
const digestFromToken: ContentDigestV1 = keyedStateToken;
// @ts-expect-error a raw public-key digest is not a generic content digest
const contentDigestFromPublicKeyDigest: ContentDigestV1 = publicKeyDigest;
// @ts-expect-error a generic content digest is not a raw public-key digest
const publicKeyDigestFromContentDigest: Ed25519PublicKeyDigestV1 =
  contentDigest;
// @ts-expect-error a generic canonical byte string is not an exact public key
const publicKeyFromCanonicalBytes: CanonicalPublicKeyBytes32V1 = canonicalBytes;
// @ts-expect-error domain field brands cannot cross domains
const generationFromKeyCheck: InstallationIdentityGenerationFieldsV1 =
  keyCheckFields;
// @ts-expect-error domain field brands cannot cross domains
const keyCheckFromRootKey: InstallationIdentityKeyCheckFieldsV1 =
  rootKeyFields;
// @ts-expect-error domain field brands cannot cross domains
const rootKeyFromGeneration: ProviderRegistryRootKeyIdFieldsV1 =
  generationFields;
// @ts-expect-error reversible short and non-reversible hashed keys are distinct
const hashedFromShort: HashedStoreFilenameKeyV1 = shortFilenameKey;
// @ts-expect-error reversible short and non-reversible hashed keys are distinct
const shortFromHashed: ShortStoreFilenameKeyV1 = hashedFilenameKey;
const encodedFilenameKey: StoreFilenameKeyV1 =
  encodeStoreFilenameKeyV1("provider-registry-manifest:fixture");
const historyAuthority:
  "none_structure_and_history_only" = rootHistory.authority;
// @ts-expect-error validated root history is deliberately not strong-ready authority
const strongHistoryAuthority: "strong_ready" = rootHistory.authority;
// @ts-expect-error the golden fixture has no production authority
const productionGoldenAuthority: "strong_ready" =
  rootHistoryGolden.fixtureAuthority;
const rejectionOnlyAuthority: "none_rejection_only" =
  rootHistoryInvalid.fixtureAuthority;
const registryHistoryAuthority:
  "none_registry_structure_and_history_only" =
    registryManifestHistory.authority;
// @ts-expect-error Registry history validation is not strong I/O authority
const strongRegistryHistoryAuthority: "strong_ready" =
  registryManifestHistory.authority;
// @ts-expect-error Manifest and Installation Identity IDs use separate domains
const installationIdFromManifest:
  InstallationIdentityGenerationIdV1 = manifestGenerationId;
// @ts-expect-error Installation Identity and Manifest IDs use separate domains
const manifestIdFromInstallation:
  ProviderRegistryManifestGenerationIdV1 = installationGenerationId;
// @ts-expect-error provider and approver key IDs are separate semantic brands
const approverIdFromProvider:
  ProviderFeasibilityApproverKeyIdV1 = providerVerificationKeyId;
// @ts-expect-error approver and provider key IDs are separate semantic brands
const providerIdFromApprover:
  StoreProviderVerificationKeyIdV1 = approverKeyId;
// @ts-expect-error Entry/nested registry and Manifest signatures cannot mix
const manifestSignatureFromRegistry:
  ProviderRegistryManifestSignatureV1 = registrySignature;
// @ts-expect-error Manifest and registry signatures cannot mix
const registrySignatureFromManifest:
  StoreProviderRegistrySignatureV1 = manifestSignature;
// @ts-expect-error Evidence, Runtime and Root Pins are independent contracts
const runtimePinFromEvidence:
  StoreDurableObjectProviderRuntimeAttestationPinV1 = evidencePin;
// @ts-expect-error Runtime and Root Pins are independent contracts
const rootPinFromRuntime: ProviderRegistryRootMetadataPinV1 =
  runtimePin;
// @ts-expect-error callers cannot forge the canonical fixed path brand
const rawManifestPath: ProviderRegistryManifestRelativePathV1 =
  "provider/registry-manifests/latest.json";

function narrowRegistryMember(
  member: ProviderRegistryManifestMemberV1,
): string {
  if (member.disposition === "enabled") {
    return member.registryEntry.providerId;
  }
  return member.reason;
}

// @ts-expect-error migration routing requires its complete atomic branch
const missingMigrationPhase: ProviderRegistryManifestRoutingV1 = {
  state: "migration",
  migrationId,
  sourceProviderId: manifestMember.providerId,
  destinationProviderId: manifestMember.providerId,
  activeForMigrationWrites: manifestMember.providerId,
};
// @ts-expect-error approver role is a closed qa/release union
const invalidApproverRole:
  ProviderFeasibilityApproverPublicKeyV1["role"] = "security";

const generationResult: Promise<InstallationIdentityGenerationIdV1> =
  deriveInstallationIdentityGenerationIdV1(generationFields, cryptoHost);
const rootKeyResult: Promise<ProviderRegistryRootKeyIdV1> =
  deriveProviderRegistryRootKeyIdV1(rootKeyFields, cryptoHost);
const keyCheckResult: Promise<KeyedStateTokenV1> =
  deriveInstallationIdentityKeyCheckTokenV1(
    keyCheckFields,
    installationKey,
    cryptoHost,
  );
const providerError: ProviderUnavailableToolErrorV1 =
  createProviderUnavailableToolErrorV1(providerFailureReason);
const unavailableProviderError: ProviderUnavailableToolErrorV1 =
  createProviderUnavailableToolErrorV1("unavailable");
// @ts-expect-error provider failure reasons are a closed public allowlist
createProviderUnavailableToolErrorV1("network_error");
// @ts-expect-error the public error contract cannot carry retry metadata
const providerErrorWithRetry: ProviderUnavailableToolErrorV1 = { schemaVersion: 1, code: "provider_unavailable", details: { reason: "unavailable" }, retryable: true };
const structureAuthority: "none_structure_only" = bundleStructure.authority;
const retainedAuthority: "none_structure_only" = retainedStructure.authority;
// @ts-expect-error structure validation deliberately carries no write authority
const strongAuthority: "strong_ready" = bundleStructure.authority;
// @ts-expect-error the structure result cannot leak the live opaque capability
const leakedCapability = bundleStructure.strictCryptoCapability;

void [
  rootKeyFromGenericHex,
  genericHexFromRootKey,
  rootKeyFromRecoveryKey,
  recoveryKeyFromRootKey,
  recoveryKeyTriple,
  recoveryKeyPair,
  recoveryKeyQuad,
  recoveryGoldenTriple,
  recoveryGoldenPair,
  recoveryGoldenQuad,
  tokenFromDigest,
  digestFromToken,
  contentDigestFromPublicKeyDigest,
  publicKeyDigestFromContentDigest,
  publicKeyFromCanonicalBytes,
  publicKeyBytes,
  generationFromKeyCheck,
  keyCheckFromRootKey,
  rootKeyFromGeneration,
  hashedFromShort,
  shortFromHashed,
  encodedFilenameKey,
  historyAuthority,
  strongHistoryAuthority,
  productionGoldenAuthority,
  rejectionOnlyAuthority,
  registryHistoryAuthority,
  strongRegistryHistoryAuthority,
  installationIdFromManifest,
  manifestIdFromInstallation,
  approverIdFromProvider,
  providerIdFromApprover,
  manifestSignatureFromRegistry,
  registrySignatureFromManifest,
  runtimePinFromEvidence,
  rootPinFromRuntime,
  rootMetadataPin,
  rawManifestPath,
  narrowRegistryMember(manifestMember),
  missingMigrationPhase,
  invalidApproverRole,
  storeFilenameFromShort,
  storeFilenameFromHash,
  generationResult,
  rootKeyResult,
  keyCheckResult,
  providerError,
  unavailableProviderError,
  providerErrorWithRetry,
  strictCryptoHost,
  strictCapability,
  bootstrapTrustBundlePin,
  distributionRootBinding,
  structureAuthority,
  retainedAuthority,
  strongAuthority,
  leakedCapability,
  trustUseAssessment,
  bootstrapTrustGolden,
];
