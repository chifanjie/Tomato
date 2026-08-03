import { z } from "zod";

const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function isCanonicalBase64UrlBody(body: string): boolean {
  if (!/^[A-Za-z0-9_-]*$/u.test(body) || body.length % 4 === 1) return false;
  if (body.length === 0 || body.length % 4 === 0) return true;
  const finalValue = BASE64URL_ALPHABET.indexOf(body.at(-1)!);
  if (body.length % 4 === 2) return (finalValue & 0x0f) === 0;
  return (finalValue & 0x03) === 0;
}

export const LowerHex22V1Schema = z
  .string()
  .regex(/^[0-9a-f]{22}$/u)
  .brand<"LowerHex22V1">();
export type LowerHex22V1 = z.infer<typeof LowerHex22V1Schema>;

export const LowerHex32V1Schema = z
  .string()
  .regex(/^[0-9a-f]{32}$/u)
  .brand<"LowerHex32V1">();
export type LowerHex32V1 = z.infer<typeof LowerHex32V1Schema>;

export const LowerHex64V1Schema = z
  .string()
  .regex(/^[0-9a-f]{64}$/u)
  .brand<"LowerHex64V1">();
export type LowerHex64V1 = z.infer<typeof LowerHex64V1Schema>;

export const ContentDigestV1Schema = z
  .string()
  .regex(/^sha256:[0-9a-f]{64}$/u)
  .brand<"ContentDigestV1">();
export type ContentDigestV1 = z.infer<typeof ContentDigestV1Schema>;

export const Ed25519PublicKeyDigestV1Schema = z
  .string()
  .regex(/^sha256:[0-9a-f]{64}$/u)
  .brand<"Ed25519PublicKeyDigestV1">();
export type Ed25519PublicKeyDigestV1 = z.infer<
  typeof Ed25519PublicKeyDigestV1Schema
>;

export const KeyedStateTokenV1Schema = z
  .string()
  .regex(/^hmac-sha256:[0-9a-f]{64}$/u)
  .brand<"KeyedStateTokenV1">();
export type KeyedStateTokenV1 = z.infer<typeof KeyedStateTokenV1Schema>;

export const CanonicalByteStringV1Schema = z
  .string()
  .regex(
    /^base64url:(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-][AQgw]|[A-Za-z0-9_-]{2}[AEIMQUYcgkosw048])?$/u,
  )
  .refine((value) => isCanonicalBase64UrlBody(value.slice("base64url:".length)), {
    message: "must contain canonical unpadded base64url bytes",
  })
  .brand<"CanonicalByteStringV1">();
export type CanonicalByteStringV1 = z.infer<
  typeof CanonicalByteStringV1Schema
>;

export const CanonicalPublicKeyBytes32V1Schema = z
  .string()
  .regex(/^base64url:[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u)
  .brand<"CanonicalPublicKeyBytes32V1">();
export type CanonicalPublicKeyBytes32V1 = z.infer<
  typeof CanonicalPublicKeyBytes32V1Schema
>;

export const DurableObjectIdentityProviderSlugV1Schema = z
  .string()
  .regex(/^(?!.*\.\.)[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/u)
  .brand<"DurableObjectIdentityProviderSlugV1">();
export type DurableObjectIdentityProviderSlugV1 = z.infer<
  typeof DurableObjectIdentityProviderSlugV1Schema
>;

export const DurableObjectIdentityProviderIdV1Schema = z
  .string()
  .regex(
    /^durable-object-provider:(?!.*\.\.)[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/u,
  )
  .brand<"DurableObjectIdentityProviderIdV1">();
export type DurableObjectIdentityProviderIdV1 = z.infer<
  typeof DurableObjectIdentityProviderIdV1Schema
>;

export const ProviderRegistryRootKeyIdV1Schema = z
  .string()
  .regex(/^[0-9a-f]{22}$/u)
  .brand<"ProviderRegistryRootKeyIdV1">();
export type ProviderRegistryRootKeyIdV1 = z.infer<
  typeof ProviderRegistryRootKeyIdV1Schema
>;

export const InstallationIdentityGenerationIdV1Schema = z
  .string()
  .regex(/^installation-identity-generation:[0-9a-f]{22}$/u)
  .brand<"InstallationIdentityGenerationIdV1">();
export type InstallationIdentityGenerationIdV1 = z.infer<
  typeof InstallationIdentityGenerationIdV1Schema
>;

export const ProviderRegistryManifestGenerationIdV1Schema = z
  .string()
  .regex(/^provider-registry-manifest:[0-9a-f]{22}$/u)
  .brand<"ProviderRegistryManifestGenerationIdV1">();
export type ProviderRegistryManifestGenerationIdV1 = z.infer<
  typeof ProviderRegistryManifestGenerationIdV1Schema
>;

export const ProviderMigrationIdV1Schema = z
  .string()
  .regex(/^provider-migration:[0-9a-f]{22}$/u)
  .brand<"ProviderMigrationIdV1">();
export type ProviderMigrationIdV1 = z.infer<
  typeof ProviderMigrationIdV1Schema
>;

export const ProviderFeasibilityEvidenceIdV1Schema = z
  .string()
  .regex(/^provider-feasibility-evidence:[0-9a-f]{22}$/u)
  .brand<"ProviderFeasibilityEvidenceIdV1">();
export type ProviderFeasibilityEvidenceIdV1 = z.infer<
  typeof ProviderFeasibilityEvidenceIdV1Schema
>;

export const StoreProviderVerificationKeyIdV1Schema = z
  .string()
  .regex(/^[0-9a-f]{22}$/u)
  .brand<"StoreProviderVerificationKeyIdV1">();
export type StoreProviderVerificationKeyIdV1 = z.infer<
  typeof StoreProviderVerificationKeyIdV1Schema
>;

export const ProviderFeasibilityApproverKeyIdV1Schema = z
  .string()
  .regex(/^[0-9a-f]{22}$/u)
  .brand<"ProviderFeasibilityApproverKeyIdV1">();
export type ProviderFeasibilityApproverKeyIdV1 = z.infer<
  typeof ProviderFeasibilityApproverKeyIdV1Schema
>;

export const ProviderOsReleaseFamilyCodeV1Schema = z
  .string()
  .regex(/^provider-os-family:[0-9a-f]{22}$/u)
  .brand<"ProviderOsReleaseFamilyCodeV1">();
export type ProviderOsReleaseFamilyCodeV1 = z.infer<
  typeof ProviderOsReleaseFamilyCodeV1Schema
>;

export const StoreProviderRegistrySignatureV1Schema = z
  .string()
  .regex(/^provider-registry-ed25519:[0-9a-f]{22}:[0-9a-f]{128}$/u)
  .brand<"StoreProviderRegistrySignatureV1">();
export type StoreProviderRegistrySignatureV1 = z.infer<
  typeof StoreProviderRegistrySignatureV1Schema
>;

export const ProviderRegistryManifestSignatureV1Schema = z
  .string()
  .regex(/^provider-registry-manifest-ed25519:[0-9a-f]{22}:[0-9a-f]{128}$/u)
  .brand<"ProviderRegistryManifestSignatureV1">();
export type ProviderRegistryManifestSignatureV1 = z.infer<
  typeof ProviderRegistryManifestSignatureV1Schema
>;

export function createDurableObjectIdentityProviderIdV1(
  slug: DurableObjectIdentityProviderSlugV1,
): DurableObjectIdentityProviderIdV1 {
  const validatedSlug = DurableObjectIdentityProviderSlugV1Schema.parse(slug);
  return DurableObjectIdentityProviderIdV1Schema.parse(
    `durable-object-provider:${validatedSlug}`,
  );
}
