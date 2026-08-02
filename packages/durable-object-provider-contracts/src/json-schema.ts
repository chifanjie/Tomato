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
  ProviderRegistryRootKeyIdV1Schema,
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

export const PROVIDER_CONTRACT_JSON_SCHEMA_SOURCES_V1 = {
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
  "provider-bootstrap-trust-bundle":
    ProviderBootstrapTrustBundleV1Schema,
  "provider-bootstrap-trust-bundle-envelope":
    ProviderBootstrapTrustBundleEnvelopeV1Schema,
  "provider-bootstrap-trust-golden-manifest":
    ProviderBootstrapTrustGoldenManifestV1Schema,
  "installation-identity-bootstrap-trust-fields":
    InstallationIdentityBootstrapTrustFieldsV1Schema,
} as const satisfies Record<string, z.ZodType>;

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
