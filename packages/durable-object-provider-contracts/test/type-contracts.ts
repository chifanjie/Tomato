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
} from "../src/index.js";
import {
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
