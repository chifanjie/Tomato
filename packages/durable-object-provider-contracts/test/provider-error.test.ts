import { Ajv2020 } from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  PROVIDER_CAPABILITY_FAILURE_REASONS_V1,
  ProviderCapabilityFailureReasonV1Schema,
  ProviderUnavailableToolErrorV1Schema,
  createProviderUnavailableToolErrorV1,
} from "../src/provider-error.js";

interface ProviderErrorFixtureManifest {
  schemaVersion: 1;
  cases: Array<{
    caseId: string;
    expectedFailure?: {
      keyword: string;
      instancePath: string;
      additionalProperty?: string;
      missingProperty?: string;
    };
    value: unknown;
  }>;
}

function fixture(relativePath: string): ProviderErrorFixtureManifest {
  return JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../fixtures/v1/${relativePath}`, import.meta.url)),
      "utf8",
    ),
  ) as ProviderErrorFixtureManifest;
}

const referenceFixture = fixture(
  "reference/provider-unavailable-tool-errors.json",
);
const invalidFixture = fixture("invalid/provider-unavailable-tool-errors.json");
const jsonSchema = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        "../schemas/v1/provider-unavailable-tool-error.schema.json",
        import.meta.url,
      ),
    ),
    "utf8",
  ),
) as Record<string, unknown>;

describe("public provider failure contract", () => {
  it("freezes the single ordered six-reason authority", () => {
    const expected = [
      "unavailable",
      "unsupported_filesystem_profile",
      "attestation_invalid",
      "revoked",
      "migration_required",
      "initialization_not_terminalized",
    ] as const;

    expect(PROVIDER_CAPABILITY_FAILURE_REASONS_V1).toEqual(expected);
    expect(Object.isFrozen(PROVIDER_CAPABILITY_FAILURE_REASONS_V1)).toBe(true);
    expect(ProviderCapabilityFailureReasonV1Schema.options).toEqual(expected);
    expect(
      referenceFixture.cases.map(
        ({ value }) =>
          (value as { details: { reason: string } }).details.reason,
      ),
    ).toEqual(expected);
  });

  it("accepts every reference fixture with Zod and independent JSON Schema", () => {
    const validate = new Ajv2020({
      allErrors: true,
      strict: true,
    }).compile(jsonSchema);

    expect(referenceFixture.schemaVersion).toBe(1);
    expect(referenceFixture.cases).toHaveLength(6);
    for (const fixtureCase of referenceFixture.cases) {
      expect(
        ProviderUnavailableToolErrorV1Schema.safeParse(fixtureCase.value)
          .success,
        `${fixtureCase.caseId} must pass Zod`,
      ).toBe(true);
      expect(
        validate(fixtureCase.value),
        `${fixtureCase.caseId} must pass JSON Schema: ${JSON.stringify(validate.errors)}`,
      ).toBe(true);
    }
  });

  it("rejects every privacy and shape negative with both validators", () => {
    const validate = new Ajv2020({
      allErrors: true,
      strict: true,
    }).compile(jsonSchema);

    expect(invalidFixture.schemaVersion).toBe(1);
    expect(invalidFixture.cases.map(({ caseId }) => caseId)).toEqual([
      "unknown-reason",
      "missing-reason",
      "wrong-schema-version",
      "wrong-code",
      "top-level-extra",
      "details-extra",
      "retryable-leakage",
      "provider-id-leakage",
      "locator-leakage",
      "ipc-endpoint-leakage",
      "path-leakage",
      "owner-leakage",
      "username-leakage",
      "key-id-leakage",
      "raw-attestation-leakage",
    ]);
    for (const fixtureCase of invalidFixture.cases) {
      expect(
        ProviderUnavailableToolErrorV1Schema.safeParse(fixtureCase.value)
          .success,
        `${fixtureCase.caseId} must fail Zod`,
      ).toBe(false);
      expect(
        validate(fixtureCase.value),
        `${fixtureCase.caseId} must fail JSON Schema`,
      ).toBe(false);
      const expected = fixtureCase.expectedFailure;
      expect(expected, `${fixtureCase.caseId} must name its rejection`).toBeDefined();
      expect(
        validate.errors?.some((error) => {
          if (
            error.keyword !== expected?.keyword ||
            error.instancePath !== expected.instancePath
          ) {
            return false;
          }
          const params = error.params as Record<string, unknown>;
          return (
            (expected.additionalProperty === undefined ||
              params.additionalProperty === expected.additionalProperty) &&
            (expected.missingProperty === undefined ||
              params.missingProperty === expected.missingProperty)
          );
        }),
        `${fixtureCase.caseId} failed for the wrong reason: ${JSON.stringify(validate.errors)}`,
      ).toBe(true);
    }
  });

  it("constructs only the privacy-minimal public projection", () => {
    for (const reason of PROVIDER_CAPABILITY_FAILURE_REASONS_V1) {
      const error = createProviderUnavailableToolErrorV1(reason);
      expect(error).toEqual({
        schemaVersion: 1,
        code: "provider_unavailable",
        details: { reason },
      });
      expect(Object.keys(error)).toEqual([
        "schemaVersion",
        "code",
        "details",
      ]);
      expect(Object.keys(error.details)).toEqual(["reason"]);
      expect(ProviderUnavailableToolErrorV1Schema.parse(error)).toEqual(error);
    }

    expect(() =>
      createProviderUnavailableToolErrorV1(
        "network_error" as never,
      ),
    ).toThrow();
  });
});
