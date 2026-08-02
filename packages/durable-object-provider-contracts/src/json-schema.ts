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

export const PROVIDER_CONTRACT_JSON_SCHEMA_SOURCES_V1 = {
  "canonical-byte-string": CanonicalByteStringV1Schema,
  "canonical-public-key-bytes-32": CanonicalPublicKeyBytes32V1Schema,
  "content-digest": ContentDigestV1Schema,
  "durable-object-identity-provider-id":
    DurableObjectIdentityProviderIdV1Schema,
  "durable-object-identity-provider-slug":
    DurableObjectIdentityProviderSlugV1Schema,
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
} as const satisfies Record<string, z.ZodType>;

export type ProviderContractJsonSchemaNameV1 =
  keyof typeof PROVIDER_CONTRACT_JSON_SCHEMA_SOURCES_V1;

export interface ProviderContractJsonSchemaDocumentV1 {
  $id: string;
  $schema?: string;
  [keyword: string]: unknown;
}

function schemaDocument(
  name: ProviderContractJsonSchemaNameV1,
  schema: z.ZodType,
): ProviderContractJsonSchemaDocumentV1 {
  const generated = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    unrepresentable: "any",
  }) as unknown as Record<string, unknown>;
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
