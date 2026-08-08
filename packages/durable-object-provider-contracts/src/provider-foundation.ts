import { z } from "./zod-runtime.js";

import {
  assertDataObjectDescriptorsBeforeSchemaV1,
  deriveKeyedStateTokenForDomainV1,
  deriveSemanticHashV1,
  type ProviderCryptoHostV1,
} from "./domain-crypto.js";
import {
  CanonicalPublicKeyBytes32V1Schema,
  InstallationIdentityGenerationIdV1Schema,
  KeyedStateTokenV1Schema,
  LowerHex32V1Schema,
  ProviderRegistryRootKeyIdV1Schema,
} from "./primitives.js";

export const PROVIDER_REGISTRY_ROOT_KEY_ID_DOMAIN_V1 =
  "provider-registry-root-key-id-v1" as const;
export const INSTALLATION_IDENTITY_GENERATION_DOMAIN_V1 =
  "installation-identity-generation-v1" as const;
export const INSTALLATION_IDENTITY_KEY_CHECK_DOMAIN_V1 =
  "installation-identity-key-check-v1" as const;

export const ProviderRegistryRootKeyIdFieldsV1Schema = z
  .strictObject({
    publicKeyBytes: CanonicalPublicKeyBytes32V1Schema,
  })
  .brand<"ProviderRegistryRootKeyIdFieldsV1">();
export type ProviderRegistryRootKeyIdFieldsV1 = z.infer<
  typeof ProviderRegistryRootKeyIdFieldsV1Schema
>;

export const InstallationIdentityGenerationFieldsV1Schema = z
  .strictObject({
    initializationNonce: LowerHex32V1Schema,
  })
  .brand<"InstallationIdentityGenerationFieldsV1">();
export type InstallationIdentityGenerationFieldsV1 = z.infer<
  typeof InstallationIdentityGenerationFieldsV1Schema
>;

export const InstallationIdentityKeyCheckFieldsV1Schema = z
  .strictObject({
    generationId: InstallationIdentityGenerationIdV1Schema,
    initializationNonce: LowerHex32V1Schema,
  })
  .brand<"InstallationIdentityKeyCheckFieldsV1">();
export type InstallationIdentityKeyCheckFieldsV1 = z.infer<
  typeof InstallationIdentityKeyCheckFieldsV1Schema
>;

export async function deriveProviderRegistryRootKeyIdV1(
  input: unknown,
  cryptoHost: ProviderCryptoHostV1,
): Promise<ReturnType<typeof ProviderRegistryRootKeyIdV1Schema.parse>> {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  const fields = ProviderRegistryRootKeyIdFieldsV1Schema.parse(input);
  const derived = await deriveSemanticHashV1(
    cryptoHost,
    PROVIDER_REGISTRY_ROOT_KEY_ID_DOMAIN_V1,
    fields,
  );
  return ProviderRegistryRootKeyIdV1Schema.parse(derived.shortHex22);
}

export async function deriveInstallationIdentityGenerationIdV1(
  input: unknown,
  cryptoHost: ProviderCryptoHostV1,
): Promise<ReturnType<typeof InstallationIdentityGenerationIdV1Schema.parse>> {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  const fields = InstallationIdentityGenerationFieldsV1Schema.parse(input);
  const derived = await deriveSemanticHashV1(
    cryptoHost,
    INSTALLATION_IDENTITY_GENERATION_DOMAIN_V1,
    fields,
  );
  return InstallationIdentityGenerationIdV1Schema.parse(
    `installation-identity-generation:${derived.shortHex22}`,
  );
}

export async function deriveInstallationIdentityKeyCheckTokenV1(
  input: unknown,
  installationIdentityKey: Uint8Array,
  cryptoHost: ProviderCryptoHostV1,
): Promise<ReturnType<typeof KeyedStateTokenV1Schema.parse>> {
  assertDataObjectDescriptorsBeforeSchemaV1(input);
  const fields = InstallationIdentityKeyCheckFieldsV1Schema.parse(input);
  const expectedGenerationId = await deriveInstallationIdentityGenerationIdV1(
    { initializationNonce: fields.initializationNonce },
    cryptoHost,
  );
  if (fields.generationId !== expectedGenerationId) {
    throw new TypeError(
      "generationId must be derived from the exact initializationNonce",
    );
  }
  return deriveKeyedStateTokenForDomainV1(
    cryptoHost,
    installationIdentityKey,
    INSTALLATION_IDENTITY_KEY_CHECK_DOMAIN_V1,
    fields,
  );
}
