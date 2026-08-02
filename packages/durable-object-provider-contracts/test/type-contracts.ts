import type {
  CanonicalByteStringV1,
  CanonicalPublicKeyBytes32V1,
  ContentDigestV1,
  InstallationIdentityGenerationFieldsV1,
  InstallationIdentityGenerationIdV1,
  InstallationIdentityKeyCheckFieldsV1,
  KeyedStateTokenV1,
  LowerHex22V1,
  ProviderCryptoHostV1,
  ProviderRegistryRootKeyIdFieldsV1,
  ProviderRegistryRootKeyIdV1,
} from "../src/index.js";
import {
  deriveInstallationIdentityGenerationIdV1,
  deriveInstallationIdentityKeyCheckTokenV1,
  deriveProviderRegistryRootKeyIdV1,
} from "../src/index.js";

declare const lowerHex22: LowerHex22V1;
declare const rootKeyId: ProviderRegistryRootKeyIdV1;
declare const contentDigest: ContentDigestV1;
declare const keyedStateToken: KeyedStateTokenV1;
declare const canonicalBytes: CanonicalByteStringV1;
declare const publicKeyBytes: CanonicalPublicKeyBytes32V1;
declare const generationFields: InstallationIdentityGenerationFieldsV1;
declare const keyCheckFields: InstallationIdentityKeyCheckFieldsV1;
declare const rootKeyFields: ProviderRegistryRootKeyIdFieldsV1;
declare const cryptoHost: ProviderCryptoHostV1;
declare const installationKey: Uint8Array;

// @ts-expect-error semantic brands with the same wire shape are not interchangeable
const rootKeyFromGenericHex: ProviderRegistryRootKeyIdV1 = lowerHex22;
// @ts-expect-error semantic brands with the same wire shape are not interchangeable
const genericHexFromRootKey: LowerHex22V1 = rootKeyId;
// @ts-expect-error digest and keyed-token brands are not interchangeable
const tokenFromDigest: KeyedStateTokenV1 = contentDigest;
// @ts-expect-error digest and keyed-token brands are not interchangeable
const digestFromToken: ContentDigestV1 = keyedStateToken;
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

void [
  rootKeyFromGenericHex,
  genericHexFromRootKey,
  tokenFromDigest,
  digestFromToken,
  publicKeyFromCanonicalBytes,
  publicKeyBytes,
  generationFromKeyCheck,
  keyCheckFromRootKey,
  rootKeyFromGeneration,
  generationResult,
  rootKeyResult,
  keyCheckResult,
];
