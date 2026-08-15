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
  ProviderFeasibilityEvidencePointSnapshotProjectionV1Schema,
} from "../src/provider-feasibility-evidence-point-fixtures.js";
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
const providerRuntimeAttestationPointGoldenPath = fileURLToPath(
  new URL(
    "../fixtures/v1/golden/provider-runtime-attestation-point-v1.json",
    import.meta.url,
  ),
);
const providerRuntimeAttestationPointInvalidPath = fileURLToPath(
  new URL(
    "../fixtures/v1/invalid/provider-runtime-attestation-point-v1.json",
    import.meta.url,
  ),
);
const providerFeasibilityEvidencePointGoldenPath = fileURLToPath(
  new URL(
    "../fixtures/v1/golden/provider-feasibility-evidence-point-v1.json",
    import.meta.url,
  ),
);
const providerFeasibilityEvidencePointInvalidPath = fileURLToPath(
  new URL(
    "../fixtures/v1/invalid/provider-feasibility-evidence-point-v1.json",
    import.meta.url,
  ),
);
const providerRegistryEvidenceBindingPointGoldenPath = fileURLToPath(
  new URL(
    "../fixtures/v1/golden/provider-registry-evidence-binding-point-v1.json",
    import.meta.url,
  ),
);
const providerRegistryEvidenceBindingPointInvalidPath = fileURLToPath(
  new URL(
    "../fixtures/v1/invalid/provider-registry-evidence-binding-point-v1.json",
    import.meta.url,
  ),
);
const providerRegistryEvidenceBindingTopologyProofPath = fileURLToPath(
  new URL(
    "../fixtures/v1/golden/provider-registry-evidence-binding-topology-proof-v1.json",
    import.meta.url,
  ),
);
const providerReleaseTargetUniversePointGoldenPath = fileURLToPath(
  new URL(
    "../fixtures/v1/golden/provider-release-target-universe-point-v1.json",
    import.meta.url,
  ),
);
const providerReleaseTargetUniversePointInvalidPath = fileURLToPath(
  new URL(
    "../fixtures/v1/invalid/provider-release-target-universe-point-v1.json",
    import.meta.url,
  ),
);
const providerDistributionHistoryCurrentCandidatePointGoldenPath =
  fileURLToPath(
    new URL(
      "../fixtures/v1/golden/provider-distribution-history-current-candidate-point-v1.json",
      import.meta.url,
    ),
  );
const providerDistributionHistoryCurrentCandidatePointInvalidPath =
  fileURLToPath(
    new URL(
      "../fixtures/v1/invalid/provider-distribution-history-current-candidate-point-v1.json",
      import.meta.url,
    ),
  );
const providerFeasibilitySupportCatalogPointGoldenPath = fileURLToPath(
  new URL(
    "../fixtures/v1/golden/provider-feasibility-support-catalog-point-v1.json",
    import.meta.url,
  ),
);
const providerFeasibilitySupportCatalogPointInvalidPath = fileURLToPath(
  new URL(
    "../fixtures/v1/invalid/provider-feasibility-support-catalog-point-v1.json",
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

const D41_PROVIDER_MIGRATION_JSON_SCHEMA_NAMES_V1 = [
  "provider-migration-same-installation-identity-current-strong-source-normal-repository-reference-candidate-id",
  "provider-migration-same-installation-identity-current-strong-source-normal-worktree-reference-candidate-id",
  "provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-request-reference-candidate",
  "provider-migration-same-installation-identity-current-strong-source-normal-namespace-reference-candidate",
  "provider-migration-same-installation-identity-current-strong-source-normal-store-manifest-current-cut-reference-candidate",
  "provider-migration-same-installation-identity-current-strong-source-normal-endpoint-trust-reference-candidate",
  "provider-migration-same-installation-identity-current-strong-source-normal-namespace-translation-reference-candidate",
  "provider-migration-same-installation-identity-current-strong-source-normal-live-root-reference-candidate",
  "provider-migration-same-installation-identity-current-strong-source-normal-live-object-entry-reference-candidate",
  "provider-migration-same-installation-identity-current-strong-source-normal-live-reference-edge-reference-candidate",
  "provider-migration-same-installation-identity-current-strong-source-normal-complete-source-read-closure-reference-candidate",
  "provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-budgets-reference-candidate",
  "provider-migration-same-installation-identity-current-strong-source-normal-history-artifact-upper-bounds-reference-candidate",
  "provider-migration-same-installation-identity-current-strong-source-normal-history-quota-charge-amounts-reference-candidate",
  "provider-migration-same-installation-identity-current-strong-source-normal-source-dry-run-cut-reference-candidate",
  "provider-migration-same-installation-identity-current-strong-source-normal-history-quota-sizing-reference-candidate",
  "provider-migration-same-installation-identity-current-strong-source-normal-quota-usage-reference-candidate",
  "provider-migration-same-installation-identity-current-strong-source-normal-quota-account-reference-candidate",
  "provider-migration-same-installation-identity-current-strong-source-normal-quota-snapshot-reference-candidate",
  "provider-migration-same-installation-identity-current-strong-source-normal-control-upper-bounds-reference-candidate",
  "provider-migration-same-installation-identity-current-strong-source-normal-history-quota-admission-reference-candidate",
  "provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-closure-reference-candidate-id",
  "provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-history-quota-reservation-reference-candidate-id",
  "provider-migration-same-installation-identity-current-strong-source-normal-history-quota-reservation-descriptor-reference-candidate",
  "provider-migration-same-installation-identity-current-strong-source-normal-plan-payload-reference-candidate",
  "provider-migration-same-installation-identity-current-strong-source-normal-plan-envelope-reference-candidate",
  "provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-closure-reference-candidate",
] as const;

const D42_PROVIDER_MIGRATION_JSON_SCHEMA_NAMES_V1 = [
  "provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-request-reference-candidate-v1",
  "provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-reference-candidate-v1",
] as const;

describe("provider contract JSON Schema distribution", () => {
  it("registers the exact 27 D-41 and two D-42 schemas in the 357-document in-memory registry", () => {
    const sourceNames = Object.keys(
      PROVIDER_CONTRACT_JSON_SCHEMA_SOURCES_V1,
    );
    expect(sourceNames).toHaveLength(357);
    expect(
      sourceNames.filter((name) =>
        name.startsWith(
          "provider-migration-same-installation-identity-current-strong-source-normal-",
        ),
      ),
    ).toEqual([
      ...D41_PROVIDER_MIGRATION_JSON_SCHEMA_NAMES_V1,
      ...D42_PROVIDER_MIGRATION_JSON_SCHEMA_NAMES_V1,
    ]);

    const generated = generateProviderContractJsonSchemasV1();
    expect(Object.keys(generated)).toHaveLength(357);
    for (const name of [
      ...D41_PROVIDER_MIGRATION_JSON_SCHEMA_NAMES_V1,
      ...D42_PROVIDER_MIGRATION_JSON_SCHEMA_NAMES_V1,
    ]) {
      expect(generated[name].$id).toBe(
        `urn:understand-code:provider-contract:schema:v1:${name}`,
      );
      expectEveryJsonSchemaObjectClosed(generated[name], name);
    }
    const closure = generated[
      "provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-closure-reference-candidate"
    ] as Record<string, any>;
    expect(closure.properties.authority.const).toBe(
      "none_provider_migration_same_installation_identity_current_strong_source_normal_pre_side_effect_plan_admission_closure_reference_candidate_only",
    );
    const preparedRequest = generated[
      "provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-request-reference-candidate-v1"
    ] as Record<string, any>;
    expect(preparedRequest.properties.profile.const).toBe(
      "provider_migration_same_installation_identity_current_strong_source_normal_prepared_registry_successor_request_reference_candidate_v1",
    );
    const preparedSuccess = generated[
      "provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-reference-candidate-v1"
    ] as Record<string, any>;
    expect(preparedSuccess.properties.authority.const).toBe(
      "none_provider_migration_same_installation_identity_current_strong_source_normal_prepared_registry_successor_reference_candidate_only",
    );
    expect(preparedSuccess.properties.stopPoint.const).toBe(
      "after_external_root_signed_prepared_registry_direct_successor_validation_before_registry_manifest_publication",
    );
  });

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
      "provider-feasibility-qa-signature",
      "provider-feasibility-release-signature",
      "provider-feasibility-evidence-id-fields",
      "provider-feasibility-evidence-unsigned-claims",
      "provider-feasibility-evidence",
      "provider-feasibility-evidence-envelope",
      "provider-feasibility-evidence-qa-signature-wrapper",
      "provider-feasibility-evidence-release-signature-wrapper",
      "provider-feasibility-evidence-point-invalid-stage",
      "provider-feasibility-evidence-point-invalid-reason",
      "provider-feasibility-evidence-point-golden-manifest",
      "provider-feasibility-evidence-point-invalid-manifest",
      "provider-feasibility-release-disposition",
      "provider-feasibility-support-catalog-signature",
      "provider-feasibility-support-candidate",
      "provider-feasibility-support-target-entry",
      "provider-feasibility-support-catalog-unsigned-claims",
      "provider-feasibility-support-catalog",
      "provider-feasibility-support-catalog-envelope",
      "provider-feasibility-support-catalog-pin",
      "provider-feasibility-public-support",
      "provider-feasibility-support-catalog-signature-wrapper",
      "provider-feasibility-support-candidate-artifact",
      "provider-feasibility-support-catalog-point-invalid-stage",
      "provider-feasibility-support-catalog-point-invalid-reason",
      "provider-feasibility-support-catalog-point-golden-manifest",
      "provider-feasibility-support-catalog-point-invalid-manifest",
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
      "provider-real-filesystem-conformance-result-id",
      "provider-real-filesystem-conformance-case-outcome",
      "provider-real-filesystem-conformance-result-code",
      "provider-real-filesystem-conformance-case-result",
      "provider-real-filesystem-conformance-result-id-fields",
      "provider-real-filesystem-conformance-result",
      "provider-real-filesystem-conformance-result-envelope",
      "provider-real-filesystem-conformance-result-locator",
      "provider-real-filesystem-conformance-result-pin",
      "provider-real-filesystem-conformance-result-invalid-stage",
      "provider-real-filesystem-conformance-result-invalid-reason",
      "provider-real-filesystem-conformance-result-golden-manifest",
      "provider-real-filesystem-conformance-result-invalid-manifest",
      "store-durable-object-provider-isolation",
      "store-manifest-compare-append-receipt-ledger-policy",
      "store-durable-object-provider-policy",
      "store-provider-filesystem-profile-fields",
      "provider-runtime-attestation-point-invalid-stage",
      "provider-runtime-attestation-point-invalid-reason",
      "provider-runtime-attestation-point-golden-manifest",
      "provider-runtime-attestation-point-invalid-manifest",
      "provider-registry-evidence-binding-point-invalid-stage",
      "provider-registry-evidence-binding-point-invalid-reason",
      "provider-registry-evidence-binding-point-compatible-base",
      "provider-registry-evidence-binding-point-success-projection",
      "provider-registry-evidence-binding-point-golden-manifest",
      "provider-registry-evidence-binding-point-invalid-manifest",
      "provider-registry-evidence-binding-topology-proof",
      "provider-public-support-taxonomy-signature-wrapper",
      "provider-release-matrix-signature-wrapper",
      "provider-target-discovery-input-bundle-signature-wrapper",
      "provider-target-discovery-result-signature-wrapper",
      "provider-acceptance-generation-predecessor",
      "provider-acceptance-genesis-predecessor",
      "provider-acceptance-predecessor",
      "provider-acceptance-state-generation-id",
      "provider-active-writer-selection",
      "provider-active-writer-selector",
      "provider-migration-strong-ready-core",
      "provider-strong-ready-acceptance-candidate-invalid-reason",
      "provider-strong-ready-acceptance-candidate-invalid-stage",
      "provider-strong-ready-acceptance-candidate-validation",
      "provider-strong-ready-acceptance-generation-pin-candidate",
      "provider-strong-ready-acceptance-state-candidate",
      "provider-strong-ready-acceptance-state-envelope-candidate",
      "provider-strong-ready-acceptance-state-generation-id-fields",
      "provider-strong-ready-acceptance-state-unsigned-candidate",
      "provider-strong-ready-accepted-configuration-candidate",
      "provider-strong-ready-bootstrap-or-steady-activation",
      "provider-trusted-local-physical-target-selection-candidate-invalid-reason",
      "provider-trusted-local-physical-target-selection-candidate-invalid-stage",
      "provider-strong-ready-bootstrap-or-steady-acceptance-generation-enumeration-entry-reference-candidate",
      "provider-strong-ready-bootstrap-or-steady-acceptance-generation-enumeration-reference-candidate",
      "provider-strong-ready-bootstrap-or-steady-acceptance-high-water-reference-candidate",
      "provider-strong-ready-bootstrap-or-steady-acceptance-high-water-envelope-reference-candidate",
      "provider-strong-ready-bootstrap-or-steady-acceptance-current-read-reference-candidate",
      "provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-request-reference-candidate",
      "provider-strong-ready-bootstrap-or-steady-acceptance-observed-high-water-reference-candidate",
      "provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-outcome-reference-candidate",
      "provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-receipt-reference-candidate",
      "provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-receipt-envelope-reference-candidate",
      "provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-receipt-pin-reference-candidate",
      "provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-result-reference-candidate",
      "provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-closure-validation-reference-candidate",
      "provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-closure-invalid-stage-reference-candidate",
      "provider-strong-ready-bootstrap-or-steady-acceptance-compare-append-closure-invalid-reason-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-repository-reference-candidate-id",
      "provider-migration-same-installation-identity-current-strong-source-normal-worktree-reference-candidate-id",
      "provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-request-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-namespace-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-store-manifest-current-cut-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-endpoint-trust-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-namespace-translation-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-live-root-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-live-object-entry-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-live-reference-edge-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-complete-source-read-closure-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-budgets-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-history-artifact-upper-bounds-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-history-quota-charge-amounts-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-source-dry-run-cut-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-history-quota-sizing-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-quota-usage-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-quota-account-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-quota-snapshot-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-control-upper-bounds-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-history-quota-admission-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-closure-reference-candidate-id",
      "provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-history-quota-reservation-reference-candidate-id",
      "provider-migration-same-installation-identity-current-strong-source-normal-history-quota-reservation-descriptor-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-plan-payload-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-plan-envelope-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-pre-side-effect-plan-admission-closure-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-request-reference-candidate-v1",
      "provider-migration-same-installation-identity-current-strong-source-normal-prepared-registry-successor-reference-candidate-v1",
    ] as const;
    for (const name of requiredNames) {
      expect(generated, name).toHaveProperty(name);
      expectEveryJsonSchemaObjectClosed(generated[name], name);
    }
    expect(Object.keys(generated)).toHaveLength(357);
    for (const nestedOnlyName of [
      "provider-migration-same-installation-identity-current-strong-source-normal-created-at-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-quota-account-contribution-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-initial-destination-namespace-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-observation-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-quota-reference-observation-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-pre-post-observation-equality-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-side-effect-boundary-reference-candidate",
      "provider-migration-same-installation-identity-current-strong-source-normal-verification-boundary-reference-candidate",
    ] as const) {
      expect(generated).not.toHaveProperty(nestedOnlyName);
    }

    for (const name of [
      "store-durable-object-provider-runtime-attestation-signature-wrapper",
      "store-durable-object-provider-verification-public-key-signature-wrapper",
      "store-durable-object-provider-binding-derivation-generation-signature-wrapper",
      "provider-feasibility-approver-public-key-signature-wrapper",
      "provider-feasibility-evidence-qa-signature-wrapper",
      "provider-feasibility-evidence-release-signature-wrapper",
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

  it("publishes the closed Release Target Universe wire and exact 4/285 point fixtures", () => {
    const generated = generateProviderContractJsonSchemasV1();
    const universeSchemaNames = [
      "provider-release-target-universe-signature",
      "provider-release-coverage-incomplete-reason",
      "provider-release-target-bucket-coverage",
      "provider-release-target-universe-bucket",
      "provider-release-target-coverage-resolution",
      "provider-release-target-coverage-basis",
      "provider-release-target-universe-unsigned-claims",
      "provider-release-target-universe",
      "provider-release-target-universe-envelope",
      "provider-release-target-universe-pin",
      "provider-release-target-universe-signature-wrapper",
      "provider-release-target-universe-point-invalid-stage",
      "provider-release-target-universe-point-invalid-reason",
      "provider-release-target-universe-point-golden-manifest",
      "provider-release-target-universe-point-invalid-manifest",
    ] as const;

    for (const name of universeSchemaNames) {
      expect(generated, name).toHaveProperty(name);
      expect(generated[name].$id, name).toBe(
        `urn:understand-code:provider-contract:schema:v1:${name}`,
      );
      if (
        name ===
        "provider-release-target-universe-point-invalid-manifest"
      ) {
        // Patch recipe values intentionally admit any JSON data tree. Their
        // recursive object branch therefore needs schema-valued
        // additionalProperties; the fixture/domain objects remain closed.
        expect(generated[name].additionalProperties, name).toBe(false);
      } else {
        expectEveryJsonSchemaObjectClosed(generated[name], name);
      }
    }

    const golden = JSON.parse(
      readFileSync(providerReleaseTargetUniversePointGoldenPath, "utf8"),
    ) as Record<string, any>;
    const invalid = JSON.parse(
      readFileSync(providerReleaseTargetUniversePointInvalidPath, "utf8"),
    ) as Record<string, any>;
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    const validateGolden = ajv.compile(
      generated["provider-release-target-universe-point-golden-manifest"],
    );
    const validateInvalid = ajv.compile(
      generated["provider-release-target-universe-point-invalid-manifest"],
    );
    const validateEnvelope = ajv.compile(
      generated["provider-release-target-universe-envelope"],
    );
    const validateCoverageBasis = ajv.compile(
      generated["provider-release-target-coverage-basis"],
    );

    expect(validateGolden(golden), JSON.stringify(validateGolden.errors)).toBe(
      true,
    );
    expect(validateInvalid(invalid), JSON.stringify(validateInvalid.errors)).toBe(
      true,
    );
    expect(
      validateEnvelope(golden.releaseTargetUniverse),
      JSON.stringify(validateEnvelope.errors),
    ).toBe(true);
    expect(golden.positiveVectors).toHaveLength(4);
    expect(golden.positiveVectors.map((vector: Record<string, unknown>) => vector.vectorId)).toEqual([
      "taxonomy-mapping-unresolved",
      "target-discovery-unresolved",
      "release-matrix-incomplete",
      "closed-world-complete",
    ]);
    expect(invalid).toMatchObject({
      inheritedCaseCount: 116,
      pointCaseCount: 169,
      caseCount: 285,
    });
    expect(invalid.caseIds).toHaveLength(285);
    expect(invalid.inheritedReplayRecipes).toHaveLength(116);
    expect(invalid.cases).toHaveLength(285);

    const goldenProperties = generated[
      "provider-release-target-universe-point-golden-manifest"
    ].properties as Record<string, Record<string, any>>;
    expect(goldenProperties.positiveVectors).toMatchObject({
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: false,
    });
    expect(goldenProperties.positiveVectors?.prefixItems).toHaveLength(4);
    const invalidProperties = generated[
      "provider-release-target-universe-point-invalid-manifest"
    ].properties as Record<string, Record<string, any>>;
    for (const propertyName of ["caseIds", "cases"] as const) {
      expect(invalidProperties[propertyName]).toMatchObject({
        type: "array",
        minItems: 285,
        maxItems: 285,
        items: false,
      });
      expect(invalidProperties[propertyName]?.prefixItems).toHaveLength(285);
    }
    expect(invalidProperties.inheritedReplayRecipes).toMatchObject({
      type: "array",
      minItems: 116,
      maxItems: 116,
      items: false,
    });
    expect(
      invalidProperties.inheritedReplayRecipes?.prefixItems,
    ).toHaveLength(116);

    const caseIdSchemas = invalidProperties.caseIds!
      .prefixItems as Array<Record<string, any>>;
    const caseSchemas = invalidProperties.cases!
      .prefixItems as Array<Record<string, any>>;
    const inheritedReplaySchemas = invalidProperties.inheritedReplayRecipes!
      .prefixItems as Array<Record<string, any>>;
    for (let index = 0; index < invalid.caseIds.length; index += 1) {
      const caseId = invalid.caseIds[index] as string;
      const caseProperties = caseSchemas[index]?.properties as Record<
        string,
        any
      >;
      const mutationProperties = caseProperties.mutation.properties as Record<
        string,
        any
      >;
      expect(caseIdSchemas[index]?.const, `caseIds[${index}]`).toBe(caseId);
      expect(caseProperties.caseId.const, `cases[${index}].caseId`).toBe(
        caseId,
      );
      expect(
        mutationProperties.operation.const,
        `cases[${index}].mutation.operation`,
      ).toBe(caseId);
      expect(caseProperties.group.const, `cases[${index}].group`).toBe(
        index < 116
          ? "target_discovery_point"
          : "release_target_universe_point",
      );
    }
    for (let index = 0; index < 116; index += 1) {
      const replay = invalid.inheritedReplayRecipes[index] as Record<
        string,
        string
      >;
      const replayProperties = inheritedReplaySchemas[index]
        ?.properties as Record<string, any>;
      expect(
        replayProperties.caseId.const,
        `inheritedReplayRecipes[${index}].caseId`,
      ).toBe(replay.caseId);
      expect(
        replayProperties.sourceOperation.const,
        `inheritedReplayRecipes[${index}].sourceOperation`,
      ).toBe(replay.sourceOperation);
    }

    const invalidSchema = generated[
      "provider-release-target-universe-point-invalid-manifest"
    ] as Record<string, any>;
    const definitions = invalidSchema.$defs as Record<string, unknown>;
    const visited = new Set<object>();
    const references: string[] = [];
    const nonClosedObjectSchemas: Array<Record<string, any>> = [];
    let emptySchemaCount = 0;
    const inspectSchema = (value: unknown): void => {
      if (value === null || typeof value !== "object" || visited.has(value)) {
        return;
      }
      visited.add(value);
      if (Array.isArray(value)) {
        for (const entry of value) inspectSchema(entry);
        return;
      }
      const record = value as Record<string, any>;
      if (Object.keys(record).length === 0) emptySchemaCount += 1;
      if (typeof record.$ref === "string") references.push(record.$ref);
      if (record.type === "object" && record.additionalProperties !== false) {
        nonClosedObjectSchemas.push(record);
      }
      for (const child of Object.values(record)) inspectSchema(child);
    };
    inspectSchema(invalidSchema);
    expect(emptySchemaCount).toBe(0);
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) {
      expect(reference).toMatch(/^#\/\$defs\/[^/]+$/u);
      expect(definitions).toHaveProperty(reference.slice("#/$defs/".length));
    }
    expect(nonClosedObjectSchemas).toHaveLength(1);
    expect(nonClosedObjectSchemas[0]).toMatchObject({
      propertyNames: { type: "string" },
      additionalProperties: { $ref: expect.stringMatching(/^#\/\$defs\//u) },
    });

    const structurallyCurrentCoverageBasis = structuredClone(
      golden.releaseTargetUniverse.payload.coverageBasis,
    );
    expect(validateCoverageBasis(structurallyCurrentCoverageBasis)).toBe(true);
    const structurallyValidNoncurrentCoverageBasis = structuredClone(
      structurallyCurrentCoverageBasis,
    );
    structurallyValidNoncurrentCoverageBasis.limits.profile =
      "provider_release_coverage_artifact_limits_v2";
    structurallyValidNoncurrentCoverageBasis.discoveryRulesetVersion =
      "provider_release_target_discovery_v2";
    structurallyValidNoncurrentCoverageBasis.requiredDimensions.reverse();
    structurallyValidNoncurrentCoverageBasis.observationSources.reverse();
    expect(
      validateCoverageBasis(structurallyValidNoncurrentCoverageBasis),
      JSON.stringify(validateCoverageBasis.errors),
    ).toBe(true);
    const malformedCoverageBasis = structuredClone(
      structurallyCurrentCoverageBasis,
    );
    malformedCoverageBasis.limits.profile = "coverage_limits_latest";
    expect(validateCoverageBasis(malformedCoverageBasis)).toBe(false);

    const envelopeWithUnknownPayloadField = structuredClone(
      golden.releaseTargetUniverse,
    );
    envelopeWithUnknownPayloadField.payload.current = true;
    expect(validateEnvelope(envelopeWithUnknownPayloadField)).toBe(false);
    const envelopeWithUnknownCoverageField = structuredClone(
      golden.releaseTargetUniverse,
    );
    envelopeWithUnknownCoverageField.payload.coverageBasis.current = true;
    expect(validateEnvelope(envelopeWithUnknownCoverageField)).toBe(false);

    const reorderedPositiveVectors = structuredClone(golden);
    reorderedPositiveVectors.positiveVectors.reverse();
    expect(validateGolden(reorderedPositiveVectors)).toBe(false);
    const goldenWithUnknownField = structuredClone(golden);
    goldenWithUnknownField.runtimeAuthority = "strong_ready";
    expect(validateGolden(goldenWithUnknownField)).toBe(false);

    const missingInvalidCase = structuredClone(invalid);
    missingInvalidCase.cases.pop();
    expect(validateInvalid(missingInvalidCase)).toBe(false);
    const reorderedInvalidCaseIds = structuredClone(invalid);
    [reorderedInvalidCaseIds.caseIds[0], reorderedInvalidCaseIds.caseIds[1]] = [
      reorderedInvalidCaseIds.caseIds[1],
      reorderedInvalidCaseIds.caseIds[0],
    ];
    expect(validateInvalid(reorderedInvalidCaseIds)).toBe(false);
    const mismatchedInheritedSource = structuredClone(invalid);
    mismatchedInheritedSource.inheritedReplayRecipes[0].sourceOperation =
      invalid.inheritedReplayRecipes[1].sourceOperation;
    expect(validateInvalid(mismatchedInheritedSource)).toBe(false);

    expect(
      generated["provider-release-target-universe-point-invalid-stage"].enum,
    ).toEqual([
      "input",
      "target_discovery_closure",
      "universe_structure",
      "universe_distribution_binding",
      "universe_active_root",
      "universe_taxonomy_pin",
      "universe_coverage_pins",
      "universe_coverage_binding",
      "universe_coverage_counts",
      "universe_target_union",
      "universe_resolution",
      "universe_buckets",
      "universe_signature_binding",
      "universe_signature",
      "universe_digest",
      "universe_envelope",
    ]);
    expect(
      generated["provider-release-target-universe-point-invalid-reason"].enum,
    ).toEqual([
      "schema_invalid",
      "source_invalid",
      "binding_mismatch",
      "pin_mismatch",
      "root_mismatch",
      "count_mismatch",
      "digest_mismatch",
      "ordering_invalid",
      "coverage_mismatch",
      "signature_invalid",
      "envelope_mismatch",
    ]);
  }, 120_000);

  it("publishes the supplied Catalog wire and exact 4-positive/7-invalid point fixtures", () => {
    const generated = generateProviderContractJsonSchemasV1();
    const catalogSchemaNames = [
      "provider-feasibility-release-disposition",
      "provider-feasibility-support-catalog-signature",
      "provider-feasibility-support-candidate",
      "provider-feasibility-support-target-entry",
      "provider-feasibility-support-catalog-unsigned-claims",
      "provider-feasibility-support-catalog",
      "provider-feasibility-support-catalog-envelope",
      "provider-feasibility-support-catalog-pin",
      "provider-feasibility-public-support",
      "provider-feasibility-support-catalog-signature-wrapper",
      "provider-feasibility-support-candidate-artifact",
      "provider-feasibility-support-catalog-point-invalid-stage",
      "provider-feasibility-support-catalog-point-invalid-reason",
      "provider-feasibility-support-catalog-point-golden-manifest",
      "provider-feasibility-support-catalog-point-invalid-manifest",
    ] as const;
    for (const name of catalogSchemaNames) {
      expect(generated, name).toHaveProperty(name);
      expect(generated[name].$id, name).toBe(
        `urn:understand-code:provider-contract:schema:v1:${name}`,
      );
      expectEveryJsonSchemaObjectClosed(generated[name], name);
    }

    const golden = JSON.parse(
      readFileSync(providerFeasibilitySupportCatalogPointGoldenPath, "utf8"),
    ) as Record<string, any>;
    const invalid = JSON.parse(
      readFileSync(providerFeasibilitySupportCatalogPointInvalidPath, "utf8"),
    ) as Record<string, any>;
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    const validateGolden = ajv.compile(
      generated["provider-feasibility-support-catalog-point-golden-manifest"],
    );
    const validateInvalid = ajv.compile(
      generated["provider-feasibility-support-catalog-point-invalid-manifest"],
    );
    const validateEnvelope = ajv.compile(
      generated["provider-feasibility-support-catalog-envelope"],
    );
    const validateStage = ajv.compile(
      generated["provider-feasibility-support-catalog-point-invalid-stage"],
    );
    const validateReason = ajv.compile(
      generated["provider-feasibility-support-catalog-point-invalid-reason"],
    );

    expect(validateGolden(golden), JSON.stringify(validateGolden.errors)).toBe(true);
    expect(validateInvalid(invalid), JSON.stringify(validateInvalid.errors)).toBe(true);
    expect(golden.positiveVectors).toHaveLength(4);
    expect(
      golden.positiveVectors.map((vector: Record<string, unknown>) => vector.vectorId),
    ).toEqual([
      "both-passed-strong",
      "second-passed-read-only",
      "second-failed-read-only",
      "second-unsupported-read-only",
    ]);
    for (const vector of golden.positiveVectors as Array<Record<string, any>>) {
      expect(
        validateEnvelope(vector.request.providerFeasibilitySupportCatalog),
        JSON.stringify(validateEnvelope.errors),
      ).toBe(true);
      expect(vector.expected.projection).toMatchObject({
        targetCount: 2,
        candidateCount: 2,
        publicSupportRowCount: 1,
      });
      expect(vector.expected.projection.ownerTargetCapabilities).toHaveLength(2);
      expect(vector.expected.projection.publicSupport).toHaveLength(1);
    }
    expect(invalid.cases).toHaveLength(7);
    expect(
      invalid.cases.map((entry: Record<string, unknown>) => entry.caseId),
    ).toEqual([
      "catalog-target-missing",
      "catalog-target-extra",
      "catalog-target-duplicate",
      "catalog-provider-duplicate",
      "catalog-evidence-cross-group",
      "catalog-failed-strong",
      "catalog-unsupported-strong",
    ]);
    for (const entry of invalid.cases as Array<Record<string, any>>) {
      expect(validateStage(entry.expected.stage)).toBe(true);
      expect(validateReason(entry.expected.reason)).toBe(true);
    }
  });

  it("publishes the strict distribution-history current-candidate 3-positive/39-invalid fixture schemas", () => {
    const generated = generateProviderContractJsonSchemasV1();
    const schemaNames = [
      "provider-distribution-history-current-candidate-point-invalid-stage",
      "provider-distribution-history-current-candidate-point-invalid-reason",
      "provider-distribution-history-current-candidate-point-golden-manifest",
      "provider-distribution-history-current-candidate-point-invalid-manifest",
    ] as const;
    for (const name of schemaNames) {
      expect(generated, name).toHaveProperty(name);
      expect(generated[name].$id, name).toBe(
        `urn:understand-code:provider-contract:schema:v1:${name}`,
      );
    }
    for (const name of schemaNames.slice(0, 3)) {
      expectEveryJsonSchemaObjectClosed(generated[name], name);
    }

    const golden = JSON.parse(
      readFileSync(
        providerDistributionHistoryCurrentCandidatePointGoldenPath,
        "utf8",
      ),
    ) as Record<string, any>;
    const invalid = JSON.parse(
      readFileSync(
        providerDistributionHistoryCurrentCandidatePointInvalidPath,
        "utf8",
      ),
    ) as Record<string, any>;
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    const validateGolden = ajv.compile(
      generated[
        "provider-distribution-history-current-candidate-point-golden-manifest"
      ],
    );
    const validateInvalid = ajv.compile(
      generated[
        "provider-distribution-history-current-candidate-point-invalid-manifest"
      ],
    );

    expect(validateGolden(golden), JSON.stringify(validateGolden.errors)).toBe(
      true,
    );
    expect(validateInvalid(invalid), JSON.stringify(validateInvalid.errors)).toBe(
      true,
    );

    const expectedPositiveVectorIds = [
      "genesis",
      "two-generation-shared",
      "two-generation-distinct",
    ];
    expect(golden.positiveVectorCount).toBe(3);
    expect(golden.positiveVectorIds).toEqual(expectedPositiveVectorIds);
    expect(
      golden.positiveVectors.map(
        (vector: Record<string, any>) => vector.vectorId,
      ),
    ).toEqual(expectedPositiveVectorIds);
    expect(
      golden.positiveVectors.map((vector: Record<string, any>) => ({
        vectorId: vector.vectorId,
        ...vector.expected.cryptoCounts,
      })),
    ).toEqual([
      {
        vectorId: "genesis",
        pointAdmissionCount: 31,
        signatureVerificationCount: 64,
      },
      {
        vectorId: "two-generation-shared",
        pointAdmissionCount: 31,
        signatureVerificationCount: 70,
      },
      {
        vectorId: "two-generation-distinct",
        pointAdmissionCount: 31,
        signatureVerificationCount: 72,
      },
    ]);

    const expectedInvalidCaseIds = [
      "historical-bundle-signature-bitflip",
      "historical-suite-signature-bitflip",
      "historical-corpus-signature-bitflip",
      "historical-semantic-suite-cases-order",
      "historical-semantic-fixture-record-ordinal",
      "historical-semantic-result-target-count",
      "historical-semantic-universe-discovered-count",
      "historical-semantic-catalog-target-order",
      "input-forbidden-active-root",
      "input-forbidden-current",
      "input-forbidden-path",
      "taxonomy-history-empty",
      "matrix-history-empty",
      "discovery-history-empty",
      "universe-history-empty",
      "catalog-history-empty",
      "taxonomy-history-non-genesis-first",
      "matrix-history-non-genesis-first",
      "discovery-history-non-genesis-first",
      "universe-history-non-genesis-first",
      "catalog-history-non-genesis-first",
      "taxonomy-history-genesis-predecessor",
      "matrix-history-genesis-predecessor",
      "discovery-history-genesis-predecessor",
      "universe-history-genesis-predecessor",
      "catalog-history-genesis-predecessor",
      "retained-fixture-missing",
      "retained-runner-missing",
      "retained-suite-missing",
      "retained-corpus-missing",
      "retained-fixture-duplicate",
      "retained-runner-duplicate",
      "retained-suite-duplicate",
      "retained-corpus-duplicate",
      "retained-fixture-extra",
      "retained-runner-extra",
      "retained-suite-extra",
      "retained-corpus-extra",
      "catalog-cross-pin-universe",
    ];
    expect(invalid).toMatchObject({
      historicalSignatureCaseCount: 3,
      historicalSemanticCaseCount: 5,
      forbiddenExtraKeyCaseCount: 3,
      fiveChainStructuralCaseCount: 15,
      retainedExactCoverCaseCount: 12,
      catalogCrossPinCaseCount: 1,
      caseCount: 39,
    });
    expect(invalid.caseIds).toEqual(expectedInvalidCaseIds);
    expect(
      invalid.cases.map((entry: Record<string, unknown>) => entry.caseId),
    ).toEqual(expectedInvalidCaseIds);

    const invalidSchema = generated[
      "provider-distribution-history-current-candidate-point-invalid-manifest"
    ] as Record<string, any>;
    expect(invalidSchema.additionalProperties).toBe(false);
    const definitions = invalidSchema.$defs as Record<string, unknown>;
    const visited = new Set<object>();
    const references: string[] = [];
    const nonClosedObjectSchemas: Array<Record<string, any>> = [];
    let emptySchemaCount = 0;
    const inspectSchema = (value: unknown): void => {
      if (value === null || typeof value !== "object" || visited.has(value)) {
        return;
      }
      visited.add(value);
      if (Array.isArray(value)) {
        for (const entry of value) inspectSchema(entry);
        return;
      }
      const record = value as Record<string, any>;
      if (Object.keys(record).length === 0) emptySchemaCount += 1;
      if (typeof record.$ref === "string") references.push(record.$ref);
      if (record.type === "object" && record.additionalProperties !== false) {
        nonClosedObjectSchemas.push(record);
      }
      for (const child of Object.values(record)) inspectSchema(child);
    };
    inspectSchema(invalidSchema);
    expect(emptySchemaCount).toBe(0);
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) {
      expect(reference).toMatch(/^#\/\$defs\/[^/]+$/u);
      expect(definitions).toHaveProperty(reference.slice("#/$defs/".length));
    }
    // The replace/add recipe alternatives each own one recursive z.json()
    // value schema. Those are the only intentionally open object branches.
    expect(nonClosedObjectSchemas).toHaveLength(2);
    for (const objectSchema of nonClosedObjectSchemas) {
      expect(objectSchema).toMatchObject({
        propertyNames: { type: "string" },
        additionalProperties: {
          $ref: expect.stringMatching(/^#\/\$defs\//u),
        },
      });
    }

    const invalidProperties = invalidSchema.properties as Record<
      string,
      Record<string, any>
    >;
    for (const propertyName of ["caseIds", "cases"] as const) {
      expect(invalidProperties[propertyName]).toMatchObject({
        type: "array",
        minItems: 39,
        maxItems: 39,
        items: false,
      });
      expect(invalidProperties[propertyName]?.prefixItems).toHaveLength(39);
    }
    const caseIdSchemas = invalidProperties.caseIds!
      .prefixItems as Array<Record<string, any>>;
    const caseSchemas = invalidProperties.cases!
      .prefixItems as Array<Record<string, any>>;
    for (let index = 0; index < expectedInvalidCaseIds.length; index += 1) {
      expect(caseIdSchemas[index]?.const, `caseIds[${index}]`).toBe(
        expectedInvalidCaseIds[index],
      );
      expect(
        caseSchemas[index]?.properties.caseId.const,
        `cases[${index}].caseId`,
      ).toBe(expectedInvalidCaseIds[index]);
    }

    const goldenWithUnknownField = structuredClone(golden);
    goldenWithUnknownField.runtimeAuthority = "strong_ready";
    expect(validateGolden(goldenWithUnknownField)).toBe(false);
    const goldenWithUnknownRequestField = structuredClone(golden);
    goldenWithUnknownRequestField.positiveVectors[0].request.current = true;
    expect(validateGolden(goldenWithUnknownRequestField)).toBe(false);
    const reorderedPositiveVectors = structuredClone(golden);
    reorderedPositiveVectors.positiveVectors.reverse();
    expect(validateGolden(reorderedPositiveVectors)).toBe(false);

    const invalidWithUnknownField = structuredClone(invalid);
    invalidWithUnknownField.runtimeAuthority = "strong_ready";
    expect(validateInvalid(invalidWithUnknownField)).toBe(false);
    const invalidWithUnknownOperationField = structuredClone(invalid);
    invalidWithUnknownOperationField.cases[0].mutation.operations[0].current =
      true;
    expect(validateInvalid(invalidWithUnknownOperationField)).toBe(false);
    const missingInvalidCase = structuredClone(invalid);
    missingInvalidCase.cases.pop();
    expect(validateInvalid(missingInvalidCase)).toBe(false);
    const reorderedInvalidCaseIds = structuredClone(invalid);
    [reorderedInvalidCaseIds.caseIds[0], reorderedInvalidCaseIds.caseIds[1]] = [
      reorderedInvalidCaseIds.caseIds[1],
      reorderedInvalidCaseIds.caseIds[0],
    ];
    expect(validateInvalid(reorderedInvalidCaseIds)).toBe(false);
    const reorderedInvalidCases = structuredClone(invalid);
    [reorderedInvalidCases.cases[0], reorderedInvalidCases.cases[1]] = [
      reorderedInvalidCases.cases[1],
      reorderedInvalidCases.cases[0],
    ];
    expect(validateInvalid(reorderedInvalidCases)).toBe(false);

    expect(
      generated[
        "provider-distribution-history-current-candidate-point-invalid-stage"
      ].enum,
    ).toEqual([
      "input",
      "registry_history_closure",
      "public_support_taxonomy_history",
      "release_matrix_history",
      "target_discovery_result_history",
      "release_target_universe_history",
      "provider_feasibility_support_catalog_history",
      "history_pin_closure",
      "retained_history_accounting",
      "current_source_closure",
      "catalog_point_closure",
    ]);
    expect(
      generated[
        "provider-distribution-history-current-candidate-point-invalid-reason"
      ].enum,
    ).toEqual([
      "schema_invalid",
      "source_invalid",
      "history_empty",
      "history_generation_limit_exceeded",
      "envelope_byte_limit_exceeded",
      "generation_not_contiguous",
      "predecessor_digest_mismatch",
      "digest_mismatch",
      "envelope_mismatch",
      "distribution_binding_mismatch",
      "active_root_mismatch",
      "active_root_rollback",
      "signature_invalid",
      "locator_invalid",
      "pin_mismatch",
      "generation_rollback",
      "count_mismatch",
      "object_invalid",
      "invalid_safe_integer",
      "single_object_byte_limit_exceeded",
      "retained_object_count_limit_exceeded",
      "retained_history_byte_limit_exceeded",
      "normal_update_emergency_generation_reserve_exhausted",
      "normal_update_emergency_logical_bytes_reserve_exhausted",
      "locator_ownership_conflict",
      "retained_object_key_conflict",
      "source_exact_cover_mismatch",
    ]);
  }, 60_000);

  it("publishes strict Runtime point policy/golden/122-case invalid schemas", () => {
    const generated = generateProviderContractJsonSchemasV1();
    const golden = JSON.parse(
      readFileSync(providerRuntimeAttestationPointGoldenPath, "utf8"),
    ) as Record<string, any>;
    const invalid = JSON.parse(
      readFileSync(providerRuntimeAttestationPointInvalidPath, "utf8"),
    ) as Record<string, any>;
    const validateGolden = new Ajv2020({ allErrors: true, strict: true }).compile(
      generated["provider-runtime-attestation-point-golden-manifest"],
    );
    const validateInvalid = new Ajv2020({ allErrors: true, strict: true }).compile(
      generated["provider-runtime-attestation-point-invalid-manifest"],
    );
    const validatePolicy = new Ajv2020({ allErrors: true, strict: true }).compile(
      generated["store-durable-object-provider-policy"],
    );
    expect(validateGolden(golden), JSON.stringify(validateGolden.errors)).toBe(true);
    expect(validateInvalid(invalid), JSON.stringify(validateInvalid.errors)).toBe(true);
    expect(validatePolicy(golden.semanticProviderPolicy)).toBe(true);

    const alternatePolicy = structuredClone(golden.semanticProviderPolicy);
    alternatePolicy.isolation.kind = "kernel_isolated_storage_domain";
    alternatePolicy.deleteSemantics = "disabled";
    expect(validatePolicy(alternatePolicy), JSON.stringify(validatePolicy.errors)).toBe(true);
    const reorderedTuple = structuredClone(golden.semanticProviderPolicy);
    reorderedTuple.supportedStagingObjectKinds.reverse();
    expect(validatePolicy(reorderedTuple)).toBe(false);

    const missingCase = structuredClone(invalid);
    missingCase.cases.pop();
    expect(validateInvalid(missingCase)).toBe(false);
    const invalidProperties = generated[
      "provider-runtime-attestation-point-invalid-manifest"
    ].properties as Record<string, Record<string, any>>;
    for (const propertyName of ["caseIds", "cases"] as const) {
      expect(invalidProperties[propertyName]).toMatchObject({
        type: "array",
        minItems: 122,
        maxItems: 122,
        items: false,
      });
      expect(invalidProperties[propertyName]?.prefixItems).toHaveLength(122);
    }
    const reorderedCaseIds = structuredClone(invalid);
    [reorderedCaseIds.caseIds[0], reorderedCaseIds.caseIds[1]] = [
      reorderedCaseIds.caseIds[1],
      reorderedCaseIds.caseIds[0],
    ];
    expect(
      validateInvalid(reorderedCaseIds),
      JSON.stringify(validateInvalid.errors),
    ).toBe(false);
    const reorderedCases = structuredClone(invalid);
    [reorderedCases.cases[0], reorderedCases.cases[1]] = [
      reorderedCases.cases[1],
      reorderedCases.cases[0],
    ];
    expect(
      validateInvalid(reorderedCases),
      JSON.stringify(validateInvalid.errors),
    ).toBe(false);
    const mismatchedInnerSource = structuredClone(invalid);
    mismatchedInnerSource.cases[0].mutation.recipe.sourceOperation =
      invalid.cases[1].mutation.recipe.sourceOperation;
    expect(
      validateInvalid(mismatchedInnerSource),
      JSON.stringify(validateInvalid.errors),
    ).toBe(false);
    expect(
      generated["provider-runtime-attestation-point-invalid-stage"].enum,
    ).toEqual([
      "input",
      "conformance_result_closure",
      "semantic_policy_structure",
      "semantic_policy_digest",
      "result_policy_binding",
      "runtime_pin",
      "runtime_structure",
      "runtime_result_binding",
      "runtime_root",
      "runtime_signature",
    ]);
    expect(
      generated["provider-runtime-attestation-point-invalid-reason"].enum,
    ).toEqual([
      "schema_invalid",
      "source_invalid",
      "digest_mismatch",
      "binding_mismatch",
      "root_mismatch",
      "signature_invalid",
      "pin_mismatch",
    ]);
  }, 30_000);

  it("publishes strict Evidence point wire/golden/227-case invalid schemas without a second Locator", () => {
    const generated = generateProviderContractJsonSchemasV1();
    const golden = JSON.parse(
      readFileSync(providerFeasibilityEvidencePointGoldenPath, "utf8"),
    ) as Record<string, any>;
    const invalid = JSON.parse(
      readFileSync(providerFeasibilityEvidencePointInvalidPath, "utf8"),
    ) as Record<string, any>;
    const validateGolden = new Ajv2020({ allErrors: true, strict: true }).compile(
      generated["provider-feasibility-evidence-point-golden-manifest"],
    );
    const validateInvalid = new Ajv2020({ allErrors: true, strict: true }).compile(
      generated["provider-feasibility-evidence-point-invalid-manifest"],
    );
    const validateEvidenceEnvelope = new Ajv2020({
      allErrors: true,
      strict: true,
    }).compile(generated["provider-feasibility-evidence-envelope"]);
    expect(validateGolden(golden), JSON.stringify(validateGolden.errors)).toBe(true);
    expect(validateInvalid(invalid), JSON.stringify(validateInvalid.errors)).toBe(true);
    expect(
      validateEvidenceEnvelope(golden.providerFeasibilityEvidence),
      JSON.stringify(validateEvidenceEnvelope.errors),
    ).toBe(true);
    expect(golden.positiveVectors).toHaveLength(3);
    expect(golden.positiveVectors.map((vector: Record<string, unknown>) => vector.result)).toEqual([
      "passed",
      "failed",
      "unsupported",
    ]);
    expect(invalid).toMatchObject({
      runtimeCaseCount: 122,
      pointCaseCount: 105,
      caseCount: 227,
    });

    const invalidProperties = generated[
      "provider-feasibility-evidence-point-invalid-manifest"
    ].properties as Record<string, Record<string, any>>;
    for (const propertyName of ["caseIds", "cases"] as const) {
      expect(invalidProperties[propertyName]).toMatchObject({
        type: "array",
        minItems: 227,
        maxItems: 227,
        items: false,
      });
      expect(invalidProperties[propertyName]?.prefixItems).toHaveLength(227);
    }
    const missingCase = structuredClone(invalid);
    missingCase.cases.pop();
    expect(validateInvalid(missingCase)).toBe(false);
    const reorderedCaseIds = structuredClone(invalid);
    [reorderedCaseIds.caseIds[0], reorderedCaseIds.caseIds[1]] = [
      reorderedCaseIds.caseIds[1],
      reorderedCaseIds.caseIds[0],
    ];
    expect(validateInvalid(reorderedCaseIds)).toBe(false);
    const mismatchedRuntimeSource = structuredClone(invalid);
    mismatchedRuntimeSource.cases[0].mutation.recipe.sourceOperation =
      invalid.cases[1].mutation.recipe.sourceOperation;
    expect(validateInvalid(mismatchedRuntimeSource)).toBe(false);

    expect(
      generated["provider-feasibility-evidence-point-invalid-stage"].enum,
    ).toEqual([
      "input",
      "runtime_attestation_closure",
      "evidence_structure",
      "evidence_pin_structure",
      "qa_approver_key_structure",
      "release_approver_key_structure",
      "qa_approver_key_identity",
      "release_approver_key_identity",
      "approver_key_separation",
      "qa_approver_key_root",
      "release_approver_key_root",
      "qa_approver_key_admission",
      "release_approver_key_admission",
      "qa_approver_key_signature",
      "release_approver_key_signature",
      "evidence_result_binding",
      "evidence_policy_binding",
      "evidence_runtime_binding",
      "evidence_time",
      "evidence_id",
      "evidence_qa_signature_binding",
      "evidence_release_signature_binding",
      "evidence_qa_signature",
      "evidence_release_signature",
      "evidence_digest",
      "evidence_envelope",
      "evidence_pin",
    ]);
    expect(
      generated["provider-feasibility-evidence-point-invalid-reason"].enum,
    ).toEqual([
      "schema_invalid",
      "source_invalid",
      "binding_mismatch",
      "identity_mismatch",
      "digest_mismatch",
      "pin_mismatch",
      "root_mismatch",
      "public_key_invalid",
      "signature_invalid",
      "ordering_invalid",
      "envelope_mismatch",
    ]);
    expect(generated).not.toHaveProperty("provider-feasibility-evidence-locator");
  }, 60_000);

  it("publishes the closed Registry Entry/Evidence candidate, exact 354-case corpus, and topology proof schemas", () => {
    const generated = generateProviderContractJsonSchemasV1();
    const golden = JSON.parse(
      readFileSync(providerRegistryEvidenceBindingPointGoldenPath, "utf8"),
    ) as Record<string, any>;
    const invalid = JSON.parse(
      readFileSync(providerRegistryEvidenceBindingPointInvalidPath, "utf8"),
    ) as Record<string, any>;
    const topologyProof = JSON.parse(
      readFileSync(providerRegistryEvidenceBindingTopologyProofPath, "utf8"),
    ) as Record<string, any>;
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    const validateGolden = ajv.compile(
      generated["provider-registry-evidence-binding-point-golden-manifest"],
    );
    const validateInvalid = ajv.compile(
      generated["provider-registry-evidence-binding-point-invalid-manifest"],
    );
    const validateTopologyProof = ajv.compile(
      generated["provider-registry-evidence-binding-topology-proof"],
    );

    expect(validateGolden(golden), JSON.stringify(validateGolden.errors)).toBe(
      true,
    );
    expect(validateInvalid(invalid), JSON.stringify(validateInvalid.errors)).toBe(
      true,
    );
    expect(
      validateTopologyProof(topologyProof),
      JSON.stringify(validateTopologyProof.errors),
    ).toBe(true);
    expect(golden.expected).toMatchObject({
      registryCryptoClosure: {
        pointAdmissionCount: 24,
        signatureVerificationCount: 38,
      },
      completeCryptoClosure: {
        pointAdmissionCount: 24,
        signatureVerificationCount: 46,
      },
    });
    expect(Object.keys(golden.compatibleBase)).toHaveLength(21);
    expect(invalid).toMatchObject({
      inheritedEvidenceCaseCount: 227,
      inheritedRegistryCaseCount: 89,
      pointSpecificCaseCount: 38,
      caseCount: 354,
      shardSize: 32,
      maxWorkers: 4,
    });
    expect(invalid.caseIds).toHaveLength(354);
    expect(invalid.cases).toHaveLength(354);
    expect(invalid.shards).toHaveLength(12);
    expect(new Set(invalid.caseIds).size).toBe(354);
    const unreachableRejections = invalid.stageCoverage.flatMap(
      (coverage: Record<string, any>) =>
        coverage.unreachableRejections.map(
          (rejection: Record<string, unknown>) => ({
            stage: coverage.stage,
            ...rejection,
          }),
        ),
    );
    expect(
      unreachableRejections.map(
        ({ stage, reason }: Record<string, unknown>) => ({ stage, reason }),
      ),
    ).toEqual([
      { stage: "candidate_root_binding", reason: "identity_mismatch" },
      { stage: "registry_policy_binding", reason: "binding_mismatch" },
    ]);
    for (const rejection of unreachableRejections) {
      expect(rejection.rationale).toEqual(expect.any(String));
      expect(rejection.rationale.length).toBeGreaterThan(40);
    }
    expect(topologyProof).toMatchObject({
      status: "accepted_after_contract_reopen",
      contractReopenRequired: false,
      priorContractReopenRequired: true,
    });
    expect(topologyProof.productionParserBindings).toHaveLength(21);
    expect(topologyProof.capAssessment).toMatchObject({
      adoptedAssessment: { withinSoundUpper: true },
      adoptedFailures: [],
    });
    expect(topologyProof.capAssessment.priorFailures).toHaveLength(2);

    const invalidSchemaDocument = generated[
      "provider-registry-evidence-binding-point-invalid-manifest"
    ] as Record<string, any>;
    const invalidProperties = invalidSchemaDocument.properties as Record<
      string,
      Record<string, any>
    >;
    const resolveInvalidLocalSchema = (
      schema: Record<string, any>,
    ): Record<string, any> => {
      const reference = schema?.$ref;
      if (
        typeof reference !== "string" ||
        !reference.startsWith("#/$defs/")
      ) {
        return schema;
      }
      const resolved = invalidSchemaDocument.$defs?.[
        reference.slice("#/$defs/".length)
      ] as Record<string, any> | undefined;
      if (resolved === undefined) {
        throw new TypeError(`missing local schema reference ${reference}`);
      }
      return resolved;
    };
    const invalidCaseItemSchema =
      invalidProperties.cases?.prefixItems?.[0] ??
      invalidProperties.cases?.items;
    const sourceExpectedJsonSchema = resolveInvalidLocalSchema(
      invalidCaseItemSchema?.properties?.sourceExpected as Record<string, any>,
    );
    const sourceExpectedBranches = sourceExpectedJsonSchema.anyOf as Record<
      string,
      any
    >[];
    const acceptedSourceExpectedBranches = sourceExpectedBranches.filter(
      (branch) => branch.properties?.authority !== undefined,
    );
    expect(acceptedSourceExpectedBranches).toHaveLength(2);
    expect(
      acceptedSourceExpectedBranches.map(
        (branch) => branch.properties.authority.const,
      ),
    ).toEqual([
      "none_provider_feasibility_evidence_structure_only",
      "none_registry_entry_evidence_binding_structure_only",
    ]);
    expect(
      acceptedSourceExpectedBranches.map((branch) => ({
        additionalProperties:
          resolveInvalidLocalSchema(branch.properties.snapshotProjection)
            .additionalProperties,
        requiredFieldCount:
          resolveInvalidLocalSchema(branch.properties.snapshotProjection)
            .required.length,
      })),
    ).toEqual([
      { additionalProperties: false, requiredFieldCount: 20 },
      { additionalProperties: false, requiredFieldCount: 10 },
    ]);

    const evidenceAcceptedSourceExpected = invalid.cases.find(
      (invalidCase: Record<string, any>) =>
        invalidCase.sourceExpected?.authority ===
        "none_provider_feasibility_evidence_structure_only",
    )?.sourceExpected as Record<string, any> | undefined;
    const registryEvidenceAcceptedSourceExpected = invalid.cases.find(
      (invalidCase: Record<string, any>) =>
        invalidCase.sourceExpected?.authority ===
        "none_registry_entry_evidence_binding_structure_only",
    )?.sourceExpected as Record<string, any> | undefined;
    expect(evidenceAcceptedSourceExpected).toBeDefined();
    expect(registryEvidenceAcceptedSourceExpected).toBeDefined();
    if (
      evidenceAcceptedSourceExpected === undefined ||
      registryEvidenceAcceptedSourceExpected === undefined
    ) {
      throw new TypeError("accepted source projection fixtures are incomplete");
    }
    expect(
      ProviderFeasibilityEvidencePointSnapshotProjectionV1Schema.safeParse(
        evidenceAcceptedSourceExpected.snapshotProjection,
      ).success,
    ).toBe(true);
    const evidenceProjectionWithExtra = structuredClone(
      evidenceAcceptedSourceExpected.snapshotProjection,
    );
    evidenceProjectionWithExtra.unreviewed = true;
    expect(
      ProviderFeasibilityEvidencePointSnapshotProjectionV1Schema.safeParse(
        evidenceProjectionWithExtra,
      ).success,
    ).toBe(false);

    const validateSourceExpected = ajv.compile({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $defs: invalidSchemaDocument.$defs,
      ...sourceExpectedJsonSchema,
    });
    expect(validateSourceExpected(evidenceAcceptedSourceExpected)).toBe(true);
    expect(validateSourceExpected(registryEvidenceAcceptedSourceExpected)).toBe(
      true,
    );
    const sourceExpectedWithExtraProjectionField = structuredClone(
      evidenceAcceptedSourceExpected,
    );
    sourceExpectedWithExtraProjectionField.snapshotProjection.unreviewed = true;
    expect(validateSourceExpected(sourceExpectedWithExtraProjectionField)).toBe(
      false,
    );
    const evidenceAuthorityWithRegistryProjection = structuredClone(
      evidenceAcceptedSourceExpected,
    );
    evidenceAuthorityWithRegistryProjection.snapshotProjection =
      registryEvidenceAcceptedSourceExpected.snapshotProjection;
    expect(validateSourceExpected(evidenceAuthorityWithRegistryProjection)).toBe(
      false,
    );
    const registryAuthorityWithEvidenceProjection = structuredClone(
      registryEvidenceAcceptedSourceExpected,
    );
    registryAuthorityWithEvidenceProjection.snapshotProjection =
      evidenceAcceptedSourceExpected.snapshotProjection;
    expect(validateSourceExpected(registryAuthorityWithEvidenceProjection)).toBe(
      false,
    );

    const invalidMutationJsonSchema = resolveInvalidLocalSchema(
      invalidCaseItemSchema?.properties?.mutation as Record<string, any>,
    );
    const sourceRecipeJsonSchema = resolveInvalidLocalSchema(
      invalidMutationJsonSchema.properties.sourceRecipe as Record<string, any>,
    );
    const sourceRecipeBranches = sourceRecipeJsonSchema.anyOf as Record<
      string,
      any
    >[];
    expect(sourceRecipeBranches).toHaveLength(5);
    for (const branch of sourceRecipeBranches) {
      expect(resolveInvalidLocalSchema(branch).additionalProperties).toBe(false);
    }
    const validateSourceRecipe = ajv.compile({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $defs: invalidSchemaDocument.$defs,
      ...sourceRecipeJsonSchema,
    });
    for (const invalidCase of invalid.cases as Record<string, any>[]) {
      expect(
        validateSourceRecipe(invalidCase.mutation.sourceRecipe),
        `${invalidCase.caseId}: ${JSON.stringify(validateSourceRecipe.errors)}`,
      ).toBe(true);
    }
    const sourceRecipeForKind = (kind: string): Record<string, any> => {
      const sourceRecipe = (invalid.cases as Record<string, any>[]).find(
        (invalidCase) => invalidCase.mutation.sourceRecipe.kind === kind,
      )?.mutation.sourceRecipe as Record<string, any> | undefined;
      if (sourceRecipe === undefined) {
        throw new TypeError(`missing source recipe fixture for ${kind}`);
      }
      return sourceRecipe;
    };
    const evidenceSourceRecipe = sourceRecipeForKind("runtime_inherited");
    const pointHostileSourceRecipe = sourceRecipeForKind("point_hostile");
    const registrySourceRecipe = sourceRecipeForKind(
      "registry_manifest_history",
    );
    const pointSpecificSourceRecipe = sourceRecipeForKind("point_specific");
    const pointBudgetSourceRecipe = sourceRecipeForKind(
      "point_symbolic_budget",
    );

    const sourceRecipeWithExtraField = structuredClone(evidenceSourceRecipe);
    sourceRecipeWithExtraField.unreviewed = true;
    expect(validateSourceRecipe(sourceRecipeWithExtraField)).toBe(false);

    const evidenceRecipeWithPointShape = {
      kind: evidenceSourceRecipe.kind,
      profile: pointSpecificSourceRecipe.profile,
    };
    expect(validateSourceRecipe(evidenceRecipeWithPointShape)).toBe(false);
    const registryRecipeWithEvidenceShape = structuredClone(
      evidenceSourceRecipe,
    );
    registryRecipeWithEvidenceShape.kind = registrySourceRecipe.kind;
    expect(validateSourceRecipe(registryRecipeWithEvidenceShape)).toBe(false);

    const pointSpecificWithBudgetProfile = structuredClone(
      pointSpecificSourceRecipe,
    );
    pointSpecificWithBudgetProfile.profile = pointBudgetSourceRecipe.profile;
    expect(validateSourceRecipe(pointSpecificWithBudgetProfile)).toBe(false);
    const pointBudgetWithSpecificProfile = structuredClone(
      pointBudgetSourceRecipe,
    );
    pointBudgetWithSpecificProfile.profile = pointSpecificSourceRecipe.profile;
    expect(validateSourceRecipe(pointBudgetWithSpecificProfile)).toBe(false);

    const pointHostileWithoutProfile = structuredClone(
      pointHostileSourceRecipe,
    );
    delete pointHostileWithoutProfile.adapterProfile;
    expect(validateSourceRecipe(pointHostileWithoutProfile)).toBe(false);

    const topologyProperties = generated[
      "provider-registry-evidence-binding-topology-proof"
    ].properties as Record<string, Record<string, any>>;
    expect(
      topologyProperties.capAssessment?.properties.adoptedFailures,
    ).toEqual({
      minItems: 0,
      maxItems: 0,
      type: "array",
      items: { not: {} },
    });
    const topologyProofWithAdoptedFailure = structuredClone(topologyProof);
    topologyProofWithAdoptedFailure.capAssessment.adoptedFailures = [
      topologyProof.capAssessment.priorFailures[0],
    ];
    expect(validateTopologyProof(topologyProofWithAdoptedFailure)).toBe(false);

    for (const propertyName of ["caseIds", "cases"] as const) {
      expect(invalidProperties[propertyName]).toMatchObject({
        type: "array",
        minItems: 354,
        maxItems: 354,
        items: false,
      });
      expect(invalidProperties[propertyName]?.prefixItems).toHaveLength(354);
    }
    const missingCase = structuredClone(invalid);
    missingCase.cases.pop();
    expect(validateInvalid(missingCase)).toBe(false);
    const reorderedCaseIds = structuredClone(invalid);
    [reorderedCaseIds.caseIds[0], reorderedCaseIds.caseIds[1]] = [
      reorderedCaseIds.caseIds[1],
      reorderedCaseIds.caseIds[0],
    ];
    expect(validateInvalid(reorderedCaseIds)).toBe(false);
  }, 120_000);

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
