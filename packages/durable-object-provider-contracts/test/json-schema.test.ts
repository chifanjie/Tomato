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
});
