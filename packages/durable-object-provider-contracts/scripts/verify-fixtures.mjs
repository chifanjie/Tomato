import Ajv2020 from "ajv/dist/2020.js";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PROVIDER_CAPABILITY_FAILURE_REASONS_V1,
  ProviderUnavailableToolErrorV1Schema,
} from "../dist/provider-error.js";

const scriptPath = fileURLToPath(import.meta.url);
const packageRoot = resolve(dirname(scriptPath), "..");

const INVALID_CASE_IDS = [
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
];

async function readJson(relativePath) {
  return JSON.parse(await readFile(join(packageRoot, relativePath), "utf8"));
}

function assertRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function assertExactKeys(value, expectedKeys, label) {
  const actualKeys = Object.keys(assertRecord(value, label)).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(sortedExpectedKeys)) {
    throw new Error(
      `${label} keys must be ${sortedExpectedKeys.join(", ")}; found ${actualKeys.join(", ")}`,
    );
  }
}

function fixtureCases(manifest, label, includeExpectedFailure) {
  assertExactKeys(manifest, ["schemaVersion", "cases"], label);
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.cases)) {
    throw new Error(`${label} must contain a version 1 cases array`);
  }
  for (const [index, fixtureCase] of manifest.cases.entries()) {
    assertExactKeys(
      fixtureCase,
      includeExpectedFailure
        ? ["caseId", "expectedFailure", "value"]
        : ["caseId", "value"],
      `${label}.cases[${index}]`,
    );
    if (typeof fixtureCase.caseId !== "string" || fixtureCase.caseId.length === 0) {
      throw new Error(`${label}.cases[${index}].caseId must be non-empty`);
    }
    if (includeExpectedFailure) {
      const failure = assertRecord(
        fixtureCase.expectedFailure,
        `${label}.cases[${index}].expectedFailure`,
      );
      const keys = Object.keys(failure);
      if (
        !keys.includes("keyword") ||
        !keys.includes("instancePath") ||
        keys.some(
          (key) =>
            ![
              "keyword",
              "instancePath",
              "additionalProperty",
              "missingProperty",
            ].includes(key),
        ) ||
        typeof failure.keyword !== "string" ||
        typeof failure.instancePath !== "string" ||
        (failure.additionalProperty !== undefined &&
          typeof failure.additionalProperty !== "string") ||
        (failure.missingProperty !== undefined &&
          typeof failure.missingProperty !== "string") ||
        (failure.additionalProperty !== undefined &&
          failure.missingProperty !== undefined)
      ) {
        throw new Error(
          `${label}.cases[${index}].expectedFailure is not an exact rejection descriptor`,
        );
      }
    }
  }
  return manifest.cases;
}

function assertExactCaseIds(cases, expectedIds, label) {
  const actualIds = cases.map((fixtureCase) => fixtureCase.caseId);
  if (new Set(actualIds).size !== actualIds.length) {
    throw new Error(`${label} contains duplicate case IDs`);
  }
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    throw new Error(
      `${label} case IDs/order differ: ${JSON.stringify(actualIds)}`,
    );
  }
}

const [referenceManifest, invalidManifest, errorJsonSchema] = await Promise.all([
  readJson("fixtures/v1/reference/provider-unavailable-tool-errors.json"),
  readJson("fixtures/v1/invalid/provider-unavailable-tool-errors.json"),
  readJson("schemas/v1/provider-unavailable-tool-error.schema.json"),
]);

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateJsonSchema = ajv.compile(errorJsonSchema);
const referenceCases = fixtureCases(
  referenceManifest,
  "reference fixture",
  false,
);
const invalidCases = fixtureCases(invalidManifest, "invalid fixture", true);

assertExactCaseIds(
  referenceCases,
  [
    "unavailable",
    "unsupported-filesystem-profile",
    "attestation-invalid",
    "revoked",
    "migration-required",
    "initialization-not-terminalized",
  ],
  "reference fixture",
);

const referenceReasons = referenceCases.map(
  (fixtureCase) =>
    assertRecord(
      assertRecord(fixtureCase.value, `${fixtureCase.caseId}.value`).details,
      `${fixtureCase.caseId}.value.details`,
    ).reason,
);
if (
  JSON.stringify(referenceReasons) !==
  JSON.stringify(PROVIDER_CAPABILITY_FAILURE_REASONS_V1)
) {
  throw new Error(
    `reference fixture reasons/order differ: ${JSON.stringify(referenceReasons)}`,
  );
}

for (const fixtureCase of referenceCases) {
  const zodResult = ProviderUnavailableToolErrorV1Schema.safeParse(
    fixtureCase.value,
  );
  if (!zodResult.success) {
    throw new Error(
      `Zod rejected reference case ${fixtureCase.caseId}: ${zodResult.error.message}`,
    );
  }
  if (!validateJsonSchema(fixtureCase.value)) {
    throw new Error(
      `JSON Schema rejected reference case ${fixtureCase.caseId}: ${ajv.errorsText(validateJsonSchema.errors)}`,
    );
  }
}

assertExactCaseIds(invalidCases, INVALID_CASE_IDS, "invalid fixture");
for (const fixtureCase of invalidCases) {
  if (ProviderUnavailableToolErrorV1Schema.safeParse(fixtureCase.value).success) {
    throw new Error(`Zod accepted invalid case ${fixtureCase.caseId}`);
  }
  if (validateJsonSchema(fixtureCase.value)) {
    throw new Error(`JSON Schema accepted invalid case ${fixtureCase.caseId}`);
  }
  const expectedFailure = fixtureCase.expectedFailure;
  const matchedExpectedFailure = validateJsonSchema.errors?.some((error) => {
    if (
      error.keyword !== expectedFailure.keyword ||
      error.instancePath !== expectedFailure.instancePath
    ) {
      return false;
    }
    return (
      (expectedFailure.additionalProperty === undefined ||
        error.params.additionalProperty ===
          expectedFailure.additionalProperty) &&
      (expectedFailure.missingProperty === undefined ||
        error.params.missingProperty === expectedFailure.missingProperty)
    );
  });
  if (!matchedExpectedFailure) {
    throw new Error(
      `Invalid case ${fixtureCase.caseId} failed for the wrong reason: ${JSON.stringify(validateJsonSchema.errors)}`,
    );
  }
}

process.stdout.write(
  `Verified ${referenceCases.length} reference and ${invalidCases.length} invalid provider-error fixtures with Zod and JSON Schema.\n`,
);
