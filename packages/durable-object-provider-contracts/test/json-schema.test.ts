import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

import {
  PROVIDER_CONTRACT_JSON_SCHEMA_SOURCES_V1,
  generateProviderContractJsonSchemasV1,
} from "../src/json-schema.js";
import {
  ShortStoreFilenameKeyV1Schema,
} from "../src/provider-fixed-locator.js";
import {
  deriveProviderRegistryManifestGenerationIdV1,
  projectProviderRegistryManifestIdFieldsV1,
} from "../src/provider-registry-records.js";

const schemaRoot = fileURLToPath(new URL("../schemas/v1", import.meta.url));
const strictEd25519ResourcePath = fileURLToPath(
  new URL(
    "../provider/ed25519-strict-host-conformance-v1.json",
    import.meta.url,
  ),
);
const bootstrapTrustBundleResourcePath = fileURLToPath(
  new URL(
    "../provider/bootstrap-trust-bundle-v1.json",
    import.meta.url,
  ),
);
const publicKeyDigestGoldenPath = fileURLToPath(
  new URL(
    "../fixtures/v1/golden/ed25519-public-key-digest-v1.json",
    import.meta.url,
  ),
);
const bootstrapTrustGoldenPath = fileURLToPath(
  new URL(
    "../fixtures/v1/golden/provider-bootstrap-structure-crypto-v1.json",
    import.meta.url,
  ),
);
const bootstrapTrustInvalidPath = fileURLToPath(
  new URL(
    "../fixtures/v1/invalid/provider-bootstrap-structure-crypto-v1.json",
    import.meta.url,
  ),
);
const providerRootHistoryGoldenPath = fileURLToPath(
  new URL(
    "../fixtures/v1/golden/provider-registry-root-history-v1.json",
    import.meta.url,
  ),
);
const providerRootHistoryInvalidPath = fileURLToPath(
  new URL(
    "../fixtures/v1/invalid/provider-registry-root-history-v1.json",
    import.meta.url,
  ),
);
const providerRegistryManifestHistoryGoldenPath = fileURLToPath(
  new URL(
    "../fixtures/v1/golden/provider-registry-entry-manifest-history-v1.json",
    import.meta.url,
  ),
);
const providerRegistryManifestHistoryInvalidPath = fileURLToPath(
  new URL(
    "../fixtures/v1/invalid/provider-registry-entry-manifest-history-v1.json",
    import.meta.url,
  ),
);

const REGISTRY_SCHEMA_ROOT_KEY_ID = "a".repeat(22);
const REGISTRY_SCHEMA_PROVIDER_ID = "durable-object-provider:schema";
const REGISTRY_SCHEMA_INSTALLATION_ID =
  `installation-identity-generation:${"b".repeat(22)}`;

function schemaDigest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}

function schemaRegistrySignature(): string {
  return `provider-registry-ed25519:${REGISTRY_SCHEMA_ROOT_KEY_ID}:${"0".repeat(128)}`;
}

function registryEntryForJsonSchema(): Record<string, any> {
  const keyId = "c".repeat(22);
  const approverKeyId = "d".repeat(22);
  const publicKeyBytes = `base64url:${"A".repeat(43)}`;
  const rootMetadata = {
    locatorProfile: "installation_provider_registry_root_metadata_v1",
    rootGeneration: 1,
    rootKeyId: REGISTRY_SCHEMA_ROOT_KEY_ID,
    contentDigest: schemaDigest("1"),
  };
  return {
    profile: "store_durable_object_provider_registry_entry_v1",
    installationIdentityGenerationId: REGISTRY_SCHEMA_INSTALLATION_ID,
    activeRootMetadata: rootMetadata,
    registryRootKeyId: REGISTRY_SCHEMA_ROOT_KEY_ID,
    registryGeneration: 1,
    providerId: REGISTRY_SCHEMA_PROVIDER_ID,
    semanticProviderPolicyDigest: schemaDigest("2"),
    providerFeasibilityEvidence: {
      locatorProfile: "installation_provider_feasibility_evidence_v1",
      evidenceId: `provider-feasibility-evidence:${"e".repeat(22)}`,
      contentDigest: schemaDigest("3"),
    },
    runtimeAttestation: {
      profile: "store_durable_object_provider_runtime_attestation_pin_v1",
      contentDigest: schemaDigest("4"),
      payload: {
        profile: "store_durable_object_provider_runtime_attestation_v1",
        providerId: REGISTRY_SCHEMA_PROVIDER_ID,
        semanticProviderPolicyDigest: schemaDigest("2"),
        implementationDigest: schemaDigest("5"),
        binaryAttestationDigest: schemaDigest("6"),
        ipcEndpointAttestationDigest: schemaDigest("7"),
        osPlatform: "linux",
        osReleaseFamilyCode: `provider-os-family:${"f".repeat(22)}`,
        osBuildDigest: schemaDigest("8"),
        architecture: "x86_64",
        filesystemProfileDigest: schemaDigest("9"),
        realFilesystemConformanceResultDigest: schemaDigest("a"),
        attestationGeneration: 1,
        issuedAt: "2026-08-03T01:02:03Z",
        registrySignature: schemaRegistrySignature(),
      },
    },
    verificationKeys: {
      profile: "store_durable_object_provider_verification_keys_v1",
      activeKeyIds: {
        operationReceipt: keyId,
        containmentProof: keyId,
        stateVersion: keyId,
        journalVersion: keyId,
      },
      activeBindingDerivationKeyGeneration: 1,
      publicKeyRecords: [
        {
          profile:
            "store_durable_object_provider_verification_public_key_v1",
          providerId: REGISTRY_SCHEMA_PROVIDER_ID,
          registryGenerationIntroduced: 1,
          keyId,
          usage: "operation_receipt",
          algorithm: "ed25519",
          publicKeyBytes,
          publicKeyDigest: schemaDigest("b"),
          registrySignature: schemaRegistrySignature(),
        },
      ],
      bindingDerivationGenerationRecords: [
        {
          profile:
            "store_durable_object_provider_binding_derivation_generation_v1",
          providerId: REGISTRY_SCHEMA_PROVIDER_ID,
          registryGenerationIntroduced: 1,
          generation: 1,
          algorithm: "hmac_sha256_provider_private",
          keyCommitmentDigest: schemaDigest("c"),
          registrySignature: schemaRegistrySignature(),
        },
      ],
      compromisedRevokedKeyIds: [],
      compromisedRevokedBindingDerivationGenerations: [],
    },
    feasibilityApprovalKeys: {
      profile: "provider_feasibility_approval_keys_v1",
      activeKeyIds: { qa: approverKeyId, release: approverKeyId },
      publicKeyRecords: [
        {
          profile: "provider_feasibility_approver_public_key_v1",
          distributionRegistryGenerationIntroduced: 1,
          role: "qa",
          keyId: approverKeyId,
          algorithm: "ed25519",
          publicKeyBytes,
          publicKeyDigest: schemaDigest("b"),
          registrySignature: schemaRegistrySignature(),
        },
      ],
      compromisedRevokedKeyIds: [],
    },
    status: "enabled",
    registrySignature: schemaRegistrySignature(),
  };
}

function registryManifestForJsonSchema(): Record<string, any> {
  const entry = registryEntryForJsonSchema();
  const manifest = {
    profile: "provider_registry_manifest_v1",
    generationId: `provider-registry-manifest:${"0".repeat(22)}`,
    installationIdentityGenerationId: REGISTRY_SCHEMA_INSTALLATION_ID,
    activeRootMetadata: structuredClone(entry.activeRootMetadata),
    manifestGeneration: 1,
    predecessor: { state: "genesis" },
    members: [
      {
        providerId: REGISTRY_SCHEMA_PROVIDER_ID,
        disposition: "enabled",
        registryEntryContentDigest: schemaDigest("d"),
        registryEntry: entry,
      },
    ],
    routing: { state: "steady" },
    issuedAt: "2026-08-03T01:02:03Z",
    manifestSignature:
      `provider-registry-manifest-ed25519:${REGISTRY_SCHEMA_ROOT_KEY_ID}:${"0".repeat(128)}`,
  };
  manifest.generationId = deriveProviderRegistryManifestGenerationIdV1(
    projectProviderRegistryManifestIdFieldsV1(manifest),
  );
  return manifest;
}

function atomicAlternatives(
  document: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const alternatives = document.oneOf ?? document.anyOf;
  expect(Array.isArray(alternatives)).toBe(true);
  return alternatives as Array<Record<string, unknown>>;
}

function expectEveryJsonSchemaObjectClosed(
  value: unknown,
  path: string,
): void {
  if (Array.isArray(value)) {
    value.forEach((child, index) =>
      expectEveryJsonSchemaObjectClosed(child, `${path}[${index}]`),
    );
    return;
  }
  if (value === null || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (record.type === "object") {
    expect(record.additionalProperties, path).toBe(false);
  }
  for (const [key, child] of Object.entries(record)) {
    expectEveryJsonSchemaObjectClosed(child, `${path}.${key}`);
  }
}

describe("provider contract JSON Schema distribution", () => {
  it("tracks one current document for every registered schema", () => {
    const generated = generateProviderContractJsonSchemasV1();
    const fileNames = readdirSync(schemaRoot)
      .filter((name) => name.endsWith(".schema.json"))
      .sort();
    expect(fileNames).toHaveLength(
      Object.keys(PROVIDER_CONTRACT_JSON_SCHEMA_SOURCES_V1).length,
    );
    for (const [name, document] of Object.entries(generated)) {
      expect(
        JSON.parse(readFileSync(join(schemaRoot, `${name}.schema.json`), "utf8")),
      ).toEqual(document);
      expect(document.$schema).toBe(
        "https://json-schema.org/draft/2020-12/schema",
      );
      expect(document.$id).toBe(
        `urn:understand-code:provider-contract:schema:v1:${name}`,
      );
    }
  });

  it("carries canonical base64 trailing-bit validation into JSON Schema", () => {
    const generated = generateProviderContractJsonSchemasV1();
    const pattern = generated["canonical-byte-string"].pattern;
    expect(typeof pattern).toBe("string");
    const expression = new RegExp(pattern as string, "u");
    for (const value of ["base64url:", "base64url:AA", "base64url:__8", "base64url:AAAA"]) {
      expect(expression.test(value), value).toBe(true);
    }
    for (const value of ["base64url:A", "base64url:AB", "base64url:AAF", "base64url:AA="]) {
      expect(expression.test(value), value).toBe(false);
    }
  });

  it("publishes filename syntax without overstating UTF-8 or semantic-ID binding", () => {
    const generated = generateProviderContractJsonSchemasV1();
    expect(
      "short-store-filename-key" in generated,
    ).toBe(false);
    expect("store-filename-key" in generated).toBe(false);

    const validateShortSyntax = new Ajv2020({
      strict: true,
    }).compile(
      generated["short-store-filename-key-syntax"],
    );
    const validateStoreSyntax = new Ajv2020({
      strict: true,
    }).compile(generated["store-filename-key-syntax"]);
    for (const value of [
      "id-c4",
      "id-vs",
      "id-0000",
      "id-00000",
      "id-0000000",
      "id-00000000",
    ]) {
      expect(validateShortSyntax(value), value).toBe(true);
      expect(validateStoreSyntax(value), value).toBe(true);
    }
    for (const value of [
      "id-0",
      "id-c5",
      "id-000",
      "id-0001",
      "id-0000004",
      "id-C4",
    ]) {
      expect(validateShortSyntax(value), value).toBe(false);
      expect(validateStoreSyntax(value), value).toBe(false);
    }

    expect(ShortStoreFilenameKeyV1Schema.safeParse("id-c4").success).toBe(
      true,
    );
    expect(ShortStoreFilenameKeyV1Schema.safeParse("id-vs").success).toBe(
      false,
    );
    expect(
      validateStoreSyntax(`idh-${"a".repeat(64)}`),
    ).toBe(true);
  });

  it("keeps domain field objects closed to unknown keys", () => {
    const generated = generateProviderContractJsonSchemasV1();
    for (const name of [
      "installation-identity-generation-fields",
      "installation-identity-key-check-fields",
      "provider-registry-root-key-id-fields",
    ] as const) {
      expect(generated[name].additionalProperties).toBe(false);
    }
  });

  it("publishes the ordered provider reason and strict minimal error schemas", () => {
    const generated = generateProviderContractJsonSchemasV1();
    expect(generated["provider-capability-failure-reason"].enum).toEqual([
      "unavailable",
      "unsupported_filesystem_profile",
      "attestation_invalid",
      "revoked",
      "migration_required",
      "initialization_not_terminalized",
    ]);
    expect(generated["provider-unavailable-tool-error"].required).toEqual([
      "schemaVersion",
      "code",
      "details",
    ]);
    expect(
      generated["provider-unavailable-tool-error"].additionalProperties,
    ).toBe(false);
    const details = (
      generated["provider-unavailable-tool-error"].properties as Record<
        string,
        Record<string, unknown>
      >
    ).details;
    expect(details?.additionalProperties).toBe(false);
    expect(details?.required).toEqual(["reason"]);
  });

  it("publishes closed strict-Ed25519 resource and capability schemas", () => {
    const generated = generateProviderContractJsonSchemasV1();
    expect(generated["ed25519-public-key-digest"].pattern).toBe(
      "^sha256:[0-9a-f]{64}$",
    );
    const publicKeyDigestGoldenCases = (
      generated["ed25519-public-key-digest-golden-manifest"]
        .properties as Record<string, Record<string, unknown>>
    ).cases;
    expect(publicKeyDigestGoldenCases).toMatchObject({
      minItems: 1,
      maxItems: 1,
      type: "array",
    });

    const manifestCases = (
      generated["provider-strict-ed25519-adversarial-manifest"]
        .properties as Record<string, Record<string, unknown>>
    ).cases;
    expect(manifestCases).toMatchObject({
      minItems: 28,
      maxItems: 28,
      type: "array",
    });
    expect(
      generated["provider-strict-ed25519-adversarial-manifest"]
        .additionalProperties,
    ).toBe(false);

    const caseProperties = (
      generated["provider-strict-ed25519-adversarial-case"]
        .properties as Record<string, Record<string, unknown>>
    );
    const signaturePattern = new RegExp(
      caseProperties.signatureBytes!.pattern as string,
      "u",
    );
    expect(signaturePattern.test(`base64url:${"A".repeat(43)}`)).toBe(true);
    expect(signaturePattern.test(`base64url:${"A".repeat(42)}`)).toBe(false);
    expect(
      generated["provider-strict-ed25519-adversarial-case"]
        .additionalProperties,
    ).toBe(false);

    const capability =
      generated["provider-strict-ed25519-crypto-capability"];
    expect(capability.additionalProperties).toBe(false);
    const adversarialManifest = (
      capability.properties as Record<string, Record<string, unknown>>
    ).adversarialManifest;
    expect(adversarialManifest?.additionalProperties).toBe(false);
  });

  it("validates the fixed Ed25519 resource with independent draft-2020 JSON Schema", () => {
    const generated = generateProviderContractJsonSchemasV1();
    const validate = new Ajv2020({
      allErrors: true,
      strict: true,
    }).compile(
      generated[
        "provider-strict-ed25519-adversarial-manifest-envelope"
      ],
    );
    const resource = JSON.parse(
      readFileSync(strictEd25519ResourcePath, "utf8"),
    ) as Record<string, unknown>;
    expect(validate(resource), JSON.stringify(validate.errors)).toBe(true);

    const withUnknownField = structuredClone(resource);
    withUnknownField.unexpected = true;
    expect(validate(withUnknownField)).toBe(false);

    const withShortSignature = structuredClone(resource);
    const firstCase = (
      (withShortSignature.payload as Record<string, unknown>).cases as Array<
        Record<string, unknown>
      >
    )[0]!;
    firstCase.signatureBytes = `base64url:${"A".repeat(42)}`;
    expect(validate(withShortSignature)).toBe(false);
  });

  it("validates an exact-one raw-key golden with independent draft-2020 JSON Schema", () => {
    const generated = generateProviderContractJsonSchemasV1();
    const validate = new Ajv2020({
      allErrors: true,
      strict: true,
    }).compile(
      generated["ed25519-public-key-digest-golden-manifest"],
    );
    const fixture = JSON.parse(
      readFileSync(publicKeyDigestGoldenPath, "utf8"),
    ) as Record<string, unknown>;
    expect(validate(fixture), JSON.stringify(validate.errors)).toBe(true);

    const withoutCase = structuredClone(fixture);
    withoutCase.cases = [];
    expect(validate(withoutCase)).toBe(false);

    const withDuplicateCase = structuredClone(fixture);
    const cases = withDuplicateCase.cases as unknown[];
    cases.push(structuredClone(cases[0]));
    expect(validate(withDuplicateCase)).toBe(false);
  });

  it("publishes an exact closed bootstrap trust bundle JSON Schema", () => {
    const generated = generateProviderContractJsonSchemasV1();
    const bundleDocument =
      generated["provider-bootstrap-trust-bundle-envelope"];
    const validate = new Ajv2020({
      allErrors: true,
      strict: true,
    }).compile(bundleDocument);
    const resource = JSON.parse(
      readFileSync(bootstrapTrustBundleResourcePath, "utf8"),
    ) as Record<string, unknown>;
    expect(validate(resource), JSON.stringify(validate.errors)).toBe(true);

    const withoutRecovery = structuredClone(resource);
    const withoutRecoveryPayload = withoutRecovery.payload as Record<
      string,
      unknown
    >;
    (
      withoutRecoveryPayload.providerRegistryRecoveryKeys as unknown[]
    ).pop();
    expect(validate(withoutRecovery)).toBe(false);

    const extraRecovery = structuredClone(resource);
    const extraRecoveryKeys = (
      (extraRecovery.payload as Record<string, unknown>)
        .providerRegistryRecoveryKeys as unknown[]
    );
    extraRecoveryKeys.push(structuredClone(extraRecoveryKeys[0]));
    expect(validate(extraRecovery)).toBe(false);

    const bootstrapRecoverySignature = structuredClone(resource);
    const metadataPayload = (
      (
        bootstrapRecoverySignature.payload as Record<string, unknown>
      ).bootstrapProviderRegistryRootMetadata as Record<string, unknown>
    ).payload as Record<string, unknown>;
    metadataPayload.recoverySignatures = [
      `provider-root-recovery-ed25519:${"0".repeat(22)}:${"0".repeat(128)}`,
    ];
    expect(validate(bootstrapRecoverySignature)).toBe(false);

    const withUnknownField = structuredClone(resource);
    (withUnknownField.payload as Record<string, unknown>).authority =
      "strong_ready";
    expect(validate(withUnknownField)).toBe(false);
  });

  it("publishes an exact eight-case bootstrap trust golden JSON Schema", () => {
    const generated = generateProviderContractJsonSchemasV1();
    const document =
      generated["provider-bootstrap-trust-golden-manifest"];
    const validate = new Ajv2020({
      allErrors: true,
      strict: true,
    }).compile(document);
    const fixture = JSON.parse(
      readFileSync(bootstrapTrustGoldenPath, "utf8"),
    ) as Record<string, unknown>;
    expect(validate(fixture), JSON.stringify(validate.errors)).toBe(true);

    const recoveryKeyIds = (
      (
        document.properties as Record<string, Record<string, unknown>>
      ).vectors?.properties as Record<string, Record<string, unknown>>
    ).recoveryKeyIds;
    expect(recoveryKeyIds).toMatchObject({
      minItems: 3,
      maxItems: 3,
      type: "array",
    });

    const missingRecovery = structuredClone(fixture);
    (
      (
        missingRecovery.vectors as Record<string, unknown>
      ).recoveryKeyIds as unknown[]
    ).pop();
    expect(validate(missingRecovery)).toBe(false);

    const reorderedRecovery = structuredClone(fixture);
    (
      (
        reorderedRecovery.vectors as Record<string, unknown>
      ).recoveryKeyIds as unknown[]
    ).reverse();
    expect(validate(reorderedRecovery)).toBe(false);

    const extraAuthority = structuredClone(fixture);
    extraAuthority.acceptedAuthority = "strong_ready";
    expect(validate(extraAuthority)).toBe(false);
  });

  it("publishes an exact ordered 51-case bootstrap invalid JSON Schema", () => {
    const generated = generateProviderContractJsonSchemasV1();
    const document =
      generated["provider-bootstrap-trust-invalid-manifest"];
    const validate = new Ajv2020({
      allErrors: true,
      strict: true,
    }).compile(document);
    const fixture = JSON.parse(
      readFileSync(bootstrapTrustInvalidPath, "utf8"),
    ) as Record<string, unknown>;
    expect(validate(fixture), JSON.stringify(validate.errors)).toBe(true);

    const cases = (
      document.properties as Record<string, Record<string, unknown>>
    ).cases;
    expect(cases).toMatchObject({
      minItems: 51,
      maxItems: 51,
      type: "array",
      items: false,
    });
    expect(cases?.prefixItems).toHaveLength(51);

    for (const mutate of [
      (items: unknown[]) => items.splice(0, 1),
      (items: unknown[]) => items.push(structuredClone(items.at(-1))),
      (items: unknown[]) => items.reverse(),
    ]) {
      const candidate = structuredClone(fixture);
      mutate(candidate.cases as unknown[]);
      expect(validate(candidate)).toBe(false);
    }
  });

  it("publishes exact root-history golden and 31-case invalid JSON Schemas", () => {
    const generated = generateProviderContractJsonSchemasV1();
    const validateGolden = new Ajv2020({
      allErrors: true,
      strict: true,
    }).compile(
      generated[
        "provider-registry-root-history-golden-manifest"
      ],
    );
    const validateInvalid = new Ajv2020({
      allErrors: true,
      strict: true,
    }).compile(
      generated[
        "provider-registry-root-history-invalid-manifest"
      ],
    );
    const golden = JSON.parse(
      readFileSync(providerRootHistoryGoldenPath, "utf8"),
    ) as Record<string, unknown>;
    const invalid = JSON.parse(
      readFileSync(providerRootHistoryInvalidPath, "utf8"),
    ) as Record<string, unknown>;
    expect(
      validateGolden(golden),
      JSON.stringify(validateGolden.errors),
    ).toBe(true);
    expect(
      validateInvalid(invalid),
      JSON.stringify(validateInvalid.errors),
    ).toBe(true);

    const goldenHistory = (
      generated[
        "provider-registry-root-history-golden-manifest"
      ].properties as Record<string, Record<string, unknown>>
    ).rootMetadataHistory;
    expect(goldenHistory).toMatchObject({
      minItems: 3,
      maxItems: 3,
      items: false,
      type: "array",
    });
    const invalidCases = (
      generated[
        "provider-registry-root-history-invalid-manifest"
      ].properties as Record<string, Record<string, unknown>>
    ).cases;
    expect(invalidCases).toMatchObject({
      minItems: 31,
      maxItems: 31,
      items: false,
      type: "array",
    });
    expect(invalidCases?.prefixItems).toHaveLength(31);

    const reordered = structuredClone(invalid);
    (reordered.cases as unknown[]).reverse();
    expect(validateInvalid(reordered)).toBe(false);

    for (const mutate of [
      (candidate: Record<string, unknown>) => {
        const first = (candidate.cases as Array<Record<string, unknown>>)[0]!;
        (first.mutation as Record<string, unknown>).operation =
          "do_anything";
      },
      (candidate: Record<string, unknown>) => {
        const first = (candidate.cases as Array<Record<string, unknown>>)[0]!;
        (first.mutation as Record<string, unknown>).operands = [
          "unexpected",
        ];
      },
      (candidate: Record<string, unknown>) => {
        const first = (candidate.cases as Array<Record<string, unknown>>)[0]!;
        (first.expected as Record<string, unknown>).stage =
          "history_limit";
      },
      (candidate: Record<string, unknown>) => {
        const first = (candidate.cases as Array<Record<string, unknown>>)[0]!;
        (
          first.expected as Record<string, unknown>
        ).postAttestationPointCalls = 999;
      },
      (candidate: Record<string, unknown>) => {
        const first = (candidate.cases as Array<Record<string, unknown>>)[0]!;
        (first.expected as Record<string, unknown>).boundary =
          "public_provider_error";
      },
    ]) {
      const tampered = structuredClone(invalid);
      mutate(tampered);
      expect(
        validateInvalid(tampered),
        JSON.stringify(validateInvalid.errors),
      ).toBe(false);
    }

    const substitutedGoldenAnchor = structuredClone(invalid);
    (
      substitutedGoldenAnchor.goldenResource as Record<
        string,
        unknown
      >
    ).resourceByteLength = 1;
    expect(validateInvalid(substitutedGoldenAnchor)).toBe(false);

    const leakedPath = structuredClone(golden);
    leakedPath.rootMetadataPath =
      "provider/root-metadata/latest.json";
    expect(validateGolden(leakedPath)).toBe(false);

    const nonCanonicalLocator = structuredClone(golden);
    (
      (
        nonCanonicalLocator.expected as Record<string, unknown>
      ).vectors as Array<Record<string, unknown>>
    )[0]!.locator = "provider/root-metadata/id-A.json";
    expect(validateGolden(nonCanonicalLocator)).toBe(false);
  });

  it("validates the real seven-generation Registry Manifest history fixture with AJV", () => {
    const generated = generateProviderContractJsonSchemasV1();
    const document =
      generated["provider-registry-manifest-history-golden-manifest"];
    const validate = new Ajv2020({
      allErrors: true,
      strict: true,
    }).compile(document);
    const fixture = JSON.parse(
      readFileSync(providerRegistryManifestHistoryGoldenPath, "utf8"),
    ) as Record<string, unknown>;
    expect(validate(fixture), JSON.stringify(validate.errors)).toBe(true);

    const history = (
      document.properties as Record<string, Record<string, unknown>>
    ).registryManifestHistory;
    expect(history).toMatchObject({
      type: "array",
      minItems: 7,
      maxItems: 7,
      items: false,
    });

    const withUnknownAuthority = structuredClone(fixture);
    withUnknownAuthority.runtimeAuthority = "strong_ready";
    expect(validate(withUnknownAuthority)).toBe(false);

    const missingGeneration = structuredClone(fixture);
    (missingGeneration.registryManifestHistory as unknown[]).pop();
    expect(validate(missingGeneration)).toBe(false);
  }, 15_000);

  it("validates the real exact 89-case Registry Manifest invalid fixture with AJV", () => {
    const generated = generateProviderContractJsonSchemasV1();
    const validateManifest = new Ajv2020({
      allErrors: true,
      strict: true,
    }).compile(
      generated["provider-registry-manifest-history-invalid-manifest"],
    );
    const fixture = JSON.parse(
      readFileSync(providerRegistryManifestHistoryInvalidPath, "utf8"),
    ) as Record<string, any>;
    expect(fixture.caseCount).toBe(89);
    expect(fixture.caseIds).toHaveLength(89);
    expect(fixture.cases).toHaveLength(89);
    expect(
      validateManifest(fixture),
      JSON.stringify(validateManifest.errors),
    ).toBe(true);

    const withUnknownField = structuredClone(fixture);
    withUnknownField.runtimeAuthority = "strong_ready";
    expect(validateManifest(withUnknownField)).toBe(false);

    const reorderedCases = structuredClone(fixture);
    [reorderedCases.cases[0], reorderedCases.cases[1]] = [
      reorderedCases.cases[1],
      reorderedCases.cases[0],
    ];
    expect(validateManifest(reorderedCases)).toBe(false);

    const validateStage = new Ajv2020({ strict: true }).compile(
      generated["provider-registry-manifest-history-invalid-stage"],
    );
    const validateReason = new Ajv2020({ strict: true }).compile(
      generated["provider-registry-manifest-history-invalid-reason"],
    );
    expect(validateStage("history_input")).toBe(true);
    expect(validateStage("unknown_stage")).toBe(false);
    expect(validateReason("schema_invalid")).toBe(true);
    expect(validateReason("unknown_reason")).toBe(false);
  }, 15_000);

  it("registers the complete C09-1F primitive, record, wrapper, and locator surface", () => {
    const generated = generateProviderContractJsonSchemasV1();
    const requiredNames = [
      "provider-registry-manifest-generation-id",
      "provider-migration-id",
      "provider-feasibility-evidence-id",
      "store-provider-verification-key-id",
      "provider-feasibility-approver-key-id",
      "provider-os-release-family-code",
      "store-provider-registry-signature",
      "provider-registry-manifest-signature",
      "provider-registry-manifest-locator",
      "store-durable-object-provider-runtime-attestation",
      "store-durable-object-provider-runtime-attestation-pin",
      "store-durable-object-provider-verification-public-key",
      "store-durable-object-provider-binding-derivation-generation",
      "provider-feasibility-approver-public-key",
      "provider-feasibility-evidence-pin",
      "provider-feasibility-approval-keys",
      "store-durable-object-provider-verification-keys",
      "store-durable-object-provider-registry-entry",
      "provider-registry-manifest-member",
      "provider-registry-manifest-routing",
      "provider-registry-manifest",
      "provider-registry-manifest-envelope",
      "provider-registry-manifest-pin",
      "provider-registry-manifest-history-golden-manifest",
      "provider-registry-manifest-history-invalid-manifest",
      "provider-registry-manifest-history-invalid-stage",
      "provider-registry-manifest-history-invalid-reason",
      "store-durable-object-provider-runtime-attestation-signature-wrapper",
      "store-durable-object-provider-verification-public-key-signature-wrapper",
      "store-durable-object-provider-binding-derivation-generation-signature-wrapper",
      "provider-feasibility-approver-public-key-signature-wrapper",
      "store-durable-object-provider-registry-entry-signature-wrapper",
      "provider-registry-manifest-signature-wrapper",
      "provider-real-filesystem-case-id",
      "provider-real-filesystem-crash-cut-id",
      "provider-real-filesystem-case-key",
      "provider-real-filesystem-fixture-corpus-manifest-envelope",
      "provider-real-filesystem-fixture-corpus-manifest-pin",
      "provider-real-filesystem-fixture-corpus-manifest-locator",
      "provider-real-filesystem-fixture-corpus-manifest-signature-wrapper",
      "provider-real-filesystem-suite-manifest-envelope",
      "provider-real-filesystem-suite-manifest-pin",
      "provider-real-filesystem-suite-manifest-locator",
      "provider-real-filesystem-suite-manifest-signature-wrapper",
      "provider-real-filesystem-source-golden-manifest",
      "provider-real-filesystem-source-invalid-manifest",
      "provider-public-support-taxonomy-envelope",
      "provider-public-support-taxonomy-pin",
      "provider-public-support-taxonomy-locator",
      "provider-release-matrix-envelope",
      "provider-release-matrix-pin",
      "provider-release-matrix-locator",
      "provider-target-discovery-fixture-manifest-envelope",
      "provider-target-discovery-fixture-manifest-pin",
      "provider-target-discovery-fixture-manifest-locator",
      "provider-target-discovery-runner-run-envelope",
      "provider-target-discovery-runner-run-locator",
      "provider-target-discovery-input-bundle",
      "provider-target-discovery-result-envelope",
      "provider-target-discovery-result-pin",
      "provider-target-discovery-result-locator",
      "provider-target-discovery-point-golden-manifest",
      "provider-target-discovery-point-invalid-manifest",
      "provider-public-support-taxonomy-signature-wrapper",
      "provider-release-matrix-signature-wrapper",
      "provider-target-discovery-input-bundle-signature-wrapper",
      "provider-target-discovery-result-signature-wrapper",
    ] as const;
    for (const name of requiredNames) {
      expect(generated, name).toHaveProperty(name);
      expectEveryJsonSchemaObjectClosed(generated[name], name);
    }
    expect(Object.keys(generated)).toHaveLength(220);

    for (const name of [
      "store-durable-object-provider-runtime-attestation-signature-wrapper",
      "store-durable-object-provider-verification-public-key-signature-wrapper",
      "store-durable-object-provider-binding-derivation-generation-signature-wrapper",
      "provider-feasibility-approver-public-key-signature-wrapper",
      "store-durable-object-provider-registry-entry-signature-wrapper",
      "provider-registry-manifest-signature-wrapper",
      "provider-real-filesystem-fixture-corpus-manifest-signature-wrapper",
      "provider-real-filesystem-suite-manifest-signature-wrapper",
      "provider-public-support-taxonomy-signature-wrapper",
      "provider-release-matrix-signature-wrapper",
      "provider-target-discovery-input-bundle-signature-wrapper",
      "provider-target-discovery-result-signature-wrapper",
    ] as const) {
      expect(generated[name].additionalProperties, name).toBe(false);
      const claims = (
        generated[name].properties as Record<string, Record<string, unknown>>
      ).claims;
      expect(claims, `${name} claims`).toBeDefined();
      if (claims === undefined) throw new TypeError("wrapper claims missing");
      if (claims.additionalProperties === undefined) {
        for (const alternative of atomicAlternatives(claims)) {
          expect(alternative.additionalProperties, `${name} claims`).toBe(
            false,
          );
        }
      } else {
        expect(claims.additionalProperties, `${name} claims`).toBe(false);
      }
    }
  });

  it("publishes every Registry atomic union as closed alternatives", () => {
    const generated = generateProviderContractJsonSchemasV1();
    for (const name of [
      "store-durable-object-provider-registry-entry-unsigned-claims",
      "store-durable-object-provider-registry-entry",
      "provider-registry-manifest-member",
      "provider-registry-manifest-routing",
      "provider-registry-manifest-id-fields",
      "provider-registry-manifest-unsigned-claims",
      "provider-registry-manifest",
    ] as const) {
      const alternatives = atomicAlternatives(generated[name]);
      expect(alternatives, name).toHaveLength(2);
      for (const alternative of alternatives) {
        expect(alternative.additionalProperties, name).toBe(false);
      }
    }

    for (const name of [
      "store-durable-object-provider-registry-entry-genesis-unsigned-claims",
      "store-durable-object-provider-registry-entry-successor-unsigned-claims",
      "store-durable-object-provider-registry-entry-genesis",
      "store-durable-object-provider-registry-entry-successor",
      "provider-registry-manifest-enabled-member",
      "provider-registry-manifest-revoked-member",
      "provider-registry-manifest-genesis-id-fields",
      "provider-registry-manifest-successor-id-fields",
      "provider-registry-manifest-genesis-unsigned-claims",
      "provider-registry-manifest-successor-unsigned-claims",
      "provider-registry-manifest-genesis",
      "provider-registry-manifest-successor",
    ] as const) {
      expect(generated[name].additionalProperties, name).toBe(false);
    }
  });

  it("rejects unknown fields and genesis/successor cross-branch objects with AJV", () => {
    const generated = generateProviderContractJsonSchemasV1();
    const validateEntry = new Ajv2020({
      allErrors: true,
      strict: true,
    }).compile(generated["store-durable-object-provider-registry-entry"]);
    const entry = registryEntryForJsonSchema();
    expect(validateEntry(entry), JSON.stringify(validateEntry.errors)).toBe(
      true,
    );

    const genesisWithPredecessor = structuredClone(entry);
    genesisWithPredecessor.predecessorRegistryEntryContentDigest =
      schemaDigest("e");
    expect(validateEntry(genesisWithPredecessor)).toBe(false);

    const successorWithoutPredecessor = structuredClone(entry);
    successorWithoutPredecessor.registryGeneration = 2;
    expect(validateEntry(successorWithoutPredecessor)).toBe(false);

    const validSuccessor = structuredClone(successorWithoutPredecessor);
    validSuccessor.predecessorRegistryEntryContentDigest = schemaDigest("e");
    expect(
      validateEntry(validSuccessor),
      JSON.stringify(validateEntry.errors),
    ).toBe(true);

    const nestedUnknown = structuredClone(entry);
    nestedUnknown.runtimeAttestation.payload.rawIpcEndpoint = "/tmp/provider";
    expect(validateEntry(nestedUnknown)).toBe(false);

    const validateManifest = new Ajv2020({
      allErrors: true,
      strict: true,
    }).compile(generated["provider-registry-manifest"]);
    const manifest = registryManifestForJsonSchema();
    expect(
      validateManifest(manifest),
      JSON.stringify(validateManifest.errors),
    ).toBe(true);

    const genesisWithManifestPredecessor = structuredClone(manifest);
    genesisWithManifestPredecessor.predecessor = {
      state: "manifest",
      generationId: manifest.generationId,
      contentDigest: schemaDigest("f"),
    };
    expect(validateManifest(genesisWithManifestPredecessor)).toBe(false);

    const successorWithGenesis = structuredClone(manifest);
    successorWithGenesis.manifestGeneration = 2;
    expect(validateManifest(successorWithGenesis)).toBe(false);

    const manifestUnknown = structuredClone(manifest);
    manifestUnknown.latestAlias = true;
    expect(validateManifest(manifestUnknown)).toBe(false);

    const validateLocator = new Ajv2020({
      allErrors: true,
      strict: true,
    }).compile(generated["provider-registry-manifest-locator"]);
    const locator = {
      locatorProfile: "installation_provider_registry_manifest_v1",
      generationId: manifest.generationId,
    };
    expect(validateLocator(locator), JSON.stringify(validateLocator.errors)).toBe(
      true,
    );
    expect(validateLocator({ ...locator, callerPath: "latest.json" })).toBe(
      false,
    );
  });

  it("rejects enabled/revoked and steady/migration cross-branch fields with AJV", () => {
    const generated = generateProviderContractJsonSchemasV1();
    const validateMember = new Ajv2020({
      allErrors: true,
      strict: true,
    }).compile(generated["provider-registry-manifest-member"]);
    const enabled = registryManifestForJsonSchema().members[0];
    expect(validateMember(enabled), JSON.stringify(validateMember.errors)).toBe(
      true,
    );
    const enabledWithRevokedField = structuredClone(enabled);
    enabledWithRevokedField.reason = "provider_compromised";
    expect(validateMember(enabledWithRevokedField)).toBe(false);

    const revoked = {
      providerId: REGISTRY_SCHEMA_PROVIDER_ID,
      disposition: "revoked",
      lastEnabledRegistryEntryContentDigest: schemaDigest("a"),
      revokedAtManifestGeneration: 2,
      reason: "provider_compromised",
    };
    expect(validateMember(revoked), JSON.stringify(validateMember.errors)).toBe(
      true,
    );
    const revokedWithEnabledField = {
      ...revoked,
      registryEntryContentDigest: schemaDigest("b"),
    };
    expect(validateMember(revokedWithEnabledField)).toBe(false);

    const validateRouting = new Ajv2020({
      allErrors: true,
      strict: true,
    }).compile(generated["provider-registry-manifest-routing"]);
    expect(validateRouting({ state: "steady" })).toBe(true);
    expect(
      validateRouting({
        state: "steady",
        migrationId: `provider-migration:${"c".repeat(22)}`,
      }),
    ).toBe(false);
    const migration = {
      state: "migration",
      migrationId: `provider-migration:${"c".repeat(22)}`,
      sourceProviderId: "durable-object-provider:source",
      destinationProviderId: "durable-object-provider:destination",
      activeForMigrationWrites: "durable-object-provider:destination",
      phase: "prepared",
    };
    expect(
      validateRouting(migration),
      JSON.stringify(validateRouting.errors),
    ).toBe(true);
    expect(validateRouting({ ...migration, phase: "steady" })).toBe(false);
  });

  it("keeps cryptographic/history equality outside JSON Schema authority", () => {
    const generated = generateProviderContractJsonSchemasV1();
    const candidate = registryManifestForJsonSchema();
    const expectedGenerationId = candidate.generationId;
    candidate.generationId =
      `provider-registry-manifest:${"f".repeat(22)}`;
    const envelope = {
      schemaVersion: 1,
      recordType: "provider_registry_manifest",
      generationId: candidate.generationId,
      contentDigest: schemaDigest("f"),
      payload: candidate,
    };
    const validateEnvelope = new Ajv2020({
      allErrors: true,
      strict: true,
    }).compile(generated["provider-registry-manifest-envelope"]);

    // JSON Schema deliberately validates wire shape only. The runtime history
    // validator recomputes this stable ID (plus Envelope/member digests and
    // signatures) and rejects the otherwise well-shaped candidate fail closed.
    expect(
      validateEnvelope(envelope),
      JSON.stringify(validateEnvelope.errors),
    ).toBe(true);
    expect(
      deriveProviderRegistryManifestGenerationIdV1(
        projectProviderRegistryManifestIdFieldsV1(candidate),
      ),
    ).toBe(expectedGenerationId);
    expect(candidate.generationId).not.toBe(expectedGenerationId);
  });
});
