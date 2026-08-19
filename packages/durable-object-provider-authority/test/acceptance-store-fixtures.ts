import { createHmac } from "node:crypto";

import {
  ProviderAcceptanceCompareAppendRequestV1Schema,
  ProviderAcceptanceCurrentReadV1Schema,
  ProviderAcceptanceStateEnvelopeV1Schema,
  createProviderAcceptanceStateTokenMessageV1,
  deriveProviderAcceptanceStateContentDigestV1,
  deriveProviderAcceptanceStateGenerationIdV1,
  type ProviderAcceptanceCompareAppendRequestV1,
  type ProviderAcceptanceCurrentReadV1,
  type ProviderAcceptanceStateEnvelopeV1,
  type ProviderAcceptedConfigurationV1,
} from "@understand-code/durable-object-provider-contracts/provider-acceptance";

export const TEST_INSTALLATION_IDENTITY_GENERATION_ID =
  "installation-identity-generation:4fe634940e20afac35e02d" as const;

export const TEST_INSTALLATION_IDENTITY_KEY = new Uint8Array(
  Array.from({ length: 32 }, (_unused, index) => index),
);

export const TEST_OTHER_INSTALLATION_IDENTITY_KEY = new Uint8Array(
  Array.from({ length: 32 }, (_unused, index) => 255 - index),
);

export function testAuthorityClockV1(): Date {
  return new Date("2026-08-20T00:10:00.000Z");
}

export type AcceptanceGenerationFloorsV1 = Readonly<{
  rootMetadataGeneration: number;
  registryManifestGeneration: number;
  supportCatalogGeneration: number;
}>;

export const TEST_GENESIS_FLOORS: AcceptanceGenerationFloorsV1 =
  Object.freeze({
    rootMetadataGeneration: 1,
    registryManifestGeneration: 1,
    supportCatalogGeneration: 1,
  });

function digestV1(character: string): `sha256:${string}` {
  return `sha256:${character.repeat(64)}`;
}

export function operationNonceV1(index: number): string {
  return index.toString(16).padStart(32, "0");
}

export function hmacTokenOracleV1(
  key: Uint8Array,
  message: Uint8Array,
): `hmac-sha256:${string}` {
  return `hmac-sha256:${createHmac("sha256", key).update(message).digest("hex")}`;
}

export function cloneJsonV1<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function acceptanceEnvelopeV1(options: Readonly<{
  acceptanceOrdinal: number;
  predecessor: ProviderAcceptanceStateEnvelopeV1["payload"]["predecessor"];
  key?: Uint8Array;
  floors?: AcceptanceGenerationFloorsV1;
  acceptedAt?: string;
  configuration?: ProviderAcceptedConfigurationV1;
}>): ProviderAcceptanceStateEnvelopeV1 {
  const floors = options.floors ?? TEST_GENESIS_FLOORS;
  const configuration = options.configuration ?? {
    state: "recovery_only" as const,
    reason: "root_compromise_pending_resign_or_migration" as const,
    activeRootMetadata: {
      locatorProfile:
        "installation_provider_registry_root_metadata_v1" as const,
      rootGeneration: floors.rootMetadataGeneration,
      rootKeyId: "1".repeat(22),
      contentDigest: digestV1("2"),
    },
    lastAcceptedProviderRegistryManifest: {
      locatorProfile:
        "installation_provider_registry_manifest_v1" as const,
      manifestGeneration: floors.registryManifestGeneration,
      generationId: `provider-registry-manifest:${"3".repeat(22)}`,
      contentDigest: digestV1("4"),
    },
    lastAcceptedProviderSupportCatalog: {
      locatorProfile:
        "distribution_provider_feasibility_support_catalog_v1" as const,
      catalogGeneration: floors.supportCatalogGeneration,
      contentDigest: digestV1("5"),
    },
    publicStrongWriter: { state: "disabled" as const },
  };
  const generationId = deriveProviderAcceptanceStateGenerationIdV1({
    installationIdentityGenerationId:
      TEST_INSTALLATION_IDENTITY_GENERATION_ID,
    acceptanceOrdinal: options.acceptanceOrdinal,
    predecessor: options.predecessor,
    configuration,
  });
  const unsigned = {
    profile: "provider_acceptance_state_v1" as const,
    generationId,
    installationIdentityGenerationId:
      TEST_INSTALLATION_IDENTITY_GENERATION_ID,
    acceptanceOrdinal: options.acceptanceOrdinal,
    predecessor: options.predecessor,
    configuration,
    acceptedAt: options.acceptedAt ??
      `2026-08-20T00:00:${String(options.acceptanceOrdinal).padStart(2, "0")}Z`,
  };
  const payload = {
    ...unsigned,
    acceptanceToken: hmacTokenOracleV1(
      options.key ?? TEST_INSTALLATION_IDENTITY_KEY,
      createProviderAcceptanceStateTokenMessageV1(unsigned),
    ),
  };
  return ProviderAcceptanceStateEnvelopeV1Schema.parse({
    schemaVersion: 1,
    recordType: "provider_acceptance_state",
    generationId,
    installationIdentityGenerationId:
      TEST_INSTALLATION_IDENTITY_GENERATION_ID,
    acceptedAt: payload.acceptedAt,
    contentDigest: deriveProviderAcceptanceStateContentDigestV1(payload),
    payload,
  });
}

export function genesisRequestV1(options: Readonly<{
  operationNonce?: string;
  key?: Uint8Array;
  floors?: AcceptanceGenerationFloorsV1;
}> = {}): ProviderAcceptanceCompareAppendRequestV1 {
  return ProviderAcceptanceCompareAppendRequestV1Schema.parse({
    profile: "provider_acceptance_compare_append_request_v1",
    operationNonce: options.operationNonce ?? operationNonceV1(1),
    installationIdentityGenerationId:
      TEST_INSTALLATION_IDENTITY_GENERATION_ID,
    expected: { state: "genesis", expectedNamespaceState: "absent" },
    candidate: acceptanceEnvelopeV1({
      acceptanceOrdinal: 1,
      predecessor: { state: "genesis" },
      key: options.key,
      floors: options.floors,
    }),
  });
}

export function successorRequestV1(options: Readonly<{
  current: ProviderAcceptanceCurrentReadV1;
  operationNonce: string;
  key?: Uint8Array;
  floors?: AcceptanceGenerationFloorsV1;
}>): ProviderAcceptanceCompareAppendRequestV1 {
  const current = ProviderAcceptanceCurrentReadV1Schema.parse(options.current);
  const previous = current.enumeration.entries.at(-1)!;
  const highWater = current.highWater;
  return ProviderAcceptanceCompareAppendRequestV1Schema.parse({
    profile: "provider_acceptance_compare_append_request_v1",
    operationNonce: options.operationNonce,
    installationIdentityGenerationId:
      TEST_INSTALLATION_IDENTITY_GENERATION_ID,
    expected: {
      state: "current",
      highWaterRevision: highWater.payload.highWaterRevision,
      highWaterContentDigest: highWater.contentDigest,
      currentVersionToken: highWater.currentVersionToken,
      generationCount: highWater.payload.generationCount,
      generationSetDigest: highWater.payload.generationSetDigest,
    },
    candidate: acceptanceEnvelopeV1({
      acceptanceOrdinal: previous.acceptanceOrdinal + 1,
      predecessor: {
        state: "acceptance",
        generationId: previous.generationId,
        contentDigest: previous.contentDigest,
      },
      key: options.key,
      floors: options.floors,
    }),
  });
}
