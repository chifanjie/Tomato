import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalizeJcsSafeIntegerUtf8V1,
} from "../dist/jcs.js";
import {
  ProviderRegistryManifestHistoryValidationError,
  diagnoseProviderRegistryManifestHistoryInternalV1,
  validateProviderRegistryManifestHistoryV1,
} from "../dist/provider-registry-manifest-history.js";
import {
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
  verifyProviderRegistryManifestHistoryGoldenResourceV1,
} from "../dist/provider-registry-manifest-fixtures.js";
import {
  PROVIDER_REGISTRY_MANIFEST_INVALID_CASE_DEFINITIONS_V1,
  PROVIDER_REGISTRY_MANIFEST_INVALID_RECIPE_DIALECT_V1,
} from "../dist/provider-registry-manifest-invalid-definitions.js";
import {
  PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  attestProviderStrictEd25519CryptoHostV1,
} from "../dist/strict-ed25519-conformance.js";
import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
  verifyRawEd25519,
} from "../dist/strict-ed25519.js";
import {
  materializeProviderRegistryManifestInvalidCandidateV1,
} from "./lib/provider-registry-manifest-invalid-runner.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const invalidRelativePath =
  "fixtures/v1/invalid/provider-registry-entry-manifest-history-v1.json";
const invalidPath = join(packageRoot, ...invalidRelativePath.split("/"));
const goldenPath = join(
  packageRoot,
  ...PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1.split("/"),
);
const strictManifestPath = join(
  packageRoot,
  ...PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1.split("/"),
);
const semanticDomain =
  "provider-registry-manifest-history-invalid-manifest-v1";
const materializedRequestSemanticDomain =
  "provider-registry-manifest-invalid-materialized-request-v1";

const reviewedCryptoCallCountTuple = Object.freeze([
  ["history-empty", 0, 0],
  ["input-extra-field", 0, 0],
  ["input-missing-installation-id", 0, 0],
  ["input-bad-installation-id", 0, 0],
  ["history-not-array", 0, 0],
  ["history-sparse-array", 0, 0],
  ["envelope-null", 11, 9],
  ["envelope-extra-field", 11, 9],
  ["envelope-record-type-malformed", 11, 9],
  ["envelope-generation-id-malformed", 11, 9],
  ["manifest-extra-field", 11, 9],
  ["manifest-profile-malformed", 11, 9],
  ["genesis-predecessor-branch-malformed", 11, 9],
  ["successor-predecessor-branch-malformed", 18, 20],
  ["entry-extra-field", 11, 9],
  ["entry-genesis-predecessor-branch-malformed", 11, 9],
  ["entry-successor-predecessor-branch-malformed", 18, 20],
  ["verification-key-extra-field", 11, 9],
  ["manifest-signature-malformed", 11, 9],
  ["envelope-generation-id-mismatch", 11, 9],
  ["payload-generation-id-mismatch", 11, 9],
  ["envelope-content-digest-mismatch", 11, 9],
  ["manifest-installation-id-mismatch", 11, 9],
  ["manifest-generation-starts-at-two", 11, 9],
  ["manifest-generation-gap", 18, 20],
  ["predecessor-generation-id-mismatch", 18, 20],
  ["predecessor-content-digest-mismatch", 18, 20],
  ["manifest-sibling-generation", 19, 24],
  ["root-generation-rollback", 19, 24],
  ["unknown-root-pin", 11, 9],
  ["member-order-reversed", 19, 24],
  ["member-duplicate", 19, 24],
  ["tombstone-disappears", 24, 38],
  ["enabled-entry-digest-mismatch", 11, 10],
  ["member-entry-provider-mismatch", 11, 10],
  ["entry-generation-jump", 18, 21],
  ["entry-predecessor-digest-mismatch", 18, 21],
  ["same-entry-digest-different-bytes", 18, 21],
  ["runtime-pin-digest-mismatch", 11, 10],
  ["runtime-provider-mismatch", 11, 10],
  ["provider-key-id-mismatch", 11, 11],
  ["provider-key-raw-digest-mismatch", 11, 11],
  ["provider-key-order-reversed", 11, 9],
  ["active-key-missing", 11, 10],
  ["active-key-wrong-usage", 11, 10],
  ["active-key-revoked", 18, 21],
  ["revoked-key-unknown", 18, 21],
  ["rotated-key-backdated", 18, 22],
  ["key-history-removal", 18, 21],
  ["retained-key-bytes-changed", 18, 21],
  ["public-key-material-alias-root", 13, 13],
  ["provider-key-cap-exceeded", 11, 10],
  ["per-usage-key-cap-exceeded", 11, 10],
  ["manifest-signature-bitflip", 11, 10],
  ["manifest-signature-wrong-signer", 19, 24],
  ["manifest-signature-wrong-domain", 11, 10],
  ["manifest-signature-wrong-prefix", 11, 9],
  ["runtime-signature-bitflip", 11, 11],
  ["runtime-signature-wrong-signer", 18, 21],
  ["runtime-signature-wrong-domain", 11, 11],
  ["key-signature-bitflip", 12, 12],
  ["key-signature-wrong-domain", 12, 12],
  ["entry-signature-bitflip", 18, 20],
  ["entry-signature-wrong-domain", 18, 20],
  ["public-key-small-order", 14, 13],
  ["steady-two-enabled-bypass", 19, 25],
  ["migration-missing-member", 19, 25],
  ["migration-source-equals-destination", 19, 25],
  ["migration-active-outsider", 19, 25],
  ["migration-phase-skip", 24, 35],
  ["migration-id-switch", 24, 35],
  ["tombstone-generation-wrong", 24, 37],
  ["tombstone-digest-wrong", 24, 37],
  ["tombstone-mutated-after-retention", 24, 38],
  ["provider-resurrection", 24, 38],
  ["early-steady-before-drained", 24, 36],
  ["locator-alias-extra-field", 11, 9],
  ["locator-path-extra-field", 11, 9],
  ["locator-filename-key-extra-field", 11, 9],
  ["history-count-cap-4097", 0, 0],
  ["single-envelope-byte-cap", 0, 0],
  ["total-history-byte-cap", 0, 0],
  ["approval-snapshot-diverges", 19, 25],
  ["binding-active-missing", 11, 10],
  ["binding-revocation-unknown", 18, 21],
  ["approver-active-role-mismatch", 11, 10],
  ["approver-revocation-unknown", 11, 10],
  ["binding-record-duplicate", 11, 9],
  ["approver-record-order-reversed", 11, 9],
].map((row) => Object.freeze(row)));

function semanticDigest(domain, value) {
  return `sha256:${createHash("sha256")
    .update(canonicalizeJcsSafeIntegerUtf8V1([domain, value]))
    .digest("hex")}`;
}

function snapshotMaterializedRequestValue(value, ancestors = new WeakSet()) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new TypeError("materialized request contains a non-JCS number");
    }
    return value;
  }
  if (typeof value !== "object" || ancestors.has(value)) {
    throw new TypeError("materialized request is not an acyclic data graph");
  }
  const isArray = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (
    (isArray && prototype !== Array.prototype) ||
    (!isArray && prototype !== Object.prototype && prototype !== null)
  ) {
    throw new TypeError("materialized request contains a non-JSON prototype");
  }
  ancestors.add(value);
  try {
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError("materialized request contains symbols");
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (isArray) {
      const length = descriptors.length?.value;
      if (
        !Number.isSafeInteger(length) ||
        length < 0 ||
        descriptors.length.enumerable !== false
      ) {
        throw new TypeError("materialized request array length is invalid");
      }
      for (const key of Object.keys(descriptors)) {
        if (key === "length") continue;
        const index = Number(key);
        const descriptor = descriptors[key];
        if (
          !Number.isSafeInteger(index) ||
          index < 0 ||
          index >= length ||
          String(index) !== key ||
          descriptor === undefined ||
          !("value" in descriptor) ||
          descriptor.enumerable !== true
        ) {
          throw new TypeError(
            "materialized request array contains a non-index data property",
          );
        }
      }
      const output = new Array(length);
      for (let index = 0; index < length; index += 1) {
        const descriptor = descriptors[String(index)];
        output[index] =
          descriptor === undefined
            ? { fixtureInvalidArrayHole: true }
            : snapshotMaterializedRequestValue(
                descriptor.value,
                ancestors,
              );
      }
      return output;
    }
    const output = {};
    for (const key of Object.keys(descriptors).sort()) {
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        throw new TypeError(
          "materialized request must use enumerable data properties",
        );
      }
      output[key] = snapshotMaterializedRequestValue(
        descriptor.value,
        ancestors,
      );
    }
    return output;
  } finally {
    ancestors.delete(value);
  }
}

function materializedRequestSemanticDigest(request) {
  if (
    request === null ||
    typeof request !== "object" ||
    Array.isArray(request) ||
    Object.getPrototypeOf(request) !== Object.prototype ||
    Object.getOwnPropertySymbols(request).length !== 0
  ) {
    throw new TypeError("materialized request input is not a plain data object");
  }
  const descriptors = Object.getOwnPropertyDescriptors(request);
  const projected = {};
  for (const key of Object.keys(descriptors).sort()) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new TypeError("materialized request input shape is not data-only");
    }
    projected[key] =
      key === "strictCryptoCapability"
        ? {
            profile:
              "provider_registry_manifest_invalid_attested_capability_sentinel_v1",
          }
        : snapshotMaterializedRequestValue(descriptor.value);
  }
  return semanticDigest(materializedRequestSemanticDomain, {
    profile:
      "provider_registry_manifest_invalid_materialized_request_projection_v1",
    request: projected,
  });
}

function publicFailureExpected(definition) {
  return {
    errorName: "ProviderRegistryManifestHistoryValidationError",
    code: "provider_unavailable",
    reason: definition.expected.publicFailureReason,
  };
}

const [goldenBytes, strictManifestBytes] = await Promise.all([
  readFile(goldenPath),
  readFile(strictManifestPath),
]);
const golden = verifyProviderRegistryManifestHistoryGoldenResourceV1(
  new Uint8Array(goldenBytes),
);

let pointCalls = 0;
let signatureCalls = 0;
const strictCryptoCapability = await attestProviderStrictEd25519CryptoHostV1({
  host: Object.freeze({
    verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
    validatePrimeSubgroupPoint(point) {
      pointCalls += 1;
      return validatePrimeSubgroupPoint(point);
    },
    verifyRawEd25519(publicKey, message, signature) {
      signatureCalls += 1;
      return verifyRawEd25519(publicKey, message, signature);
    },
  }),
  resourceHost: Object.freeze({
    readFixedSignedPackageResource(resourcePath, maxBytes) {
      if (
        resourcePath !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 ||
        maxBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
      ) {
        throw new Error("unexpected strict Ed25519 manifest request");
      }
      return new Uint8Array(strictManifestBytes);
    },
  }),
});

const caseIds = PROVIDER_REGISTRY_MANIFEST_INVALID_CASE_DEFINITIONS_V1.map(
  ({ caseId }) => caseId,
);
if (
  caseIds.length < 50 ||
  new Set(caseIds).size !== caseIds.length ||
  caseIds.some((caseId) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(caseId))
) {
  throw new Error("invalid manifest corpus case IDs must be unique ordered slugs");
}
if (
  reviewedCryptoCallCountTuple.length !== caseIds.length ||
  reviewedCryptoCallCountTuple.some(
    ([caseId], index) => caseId !== caseIds[index],
  )
) {
  throw new Error("reviewed crypto call-count tuple is stale or reordered");
}

const cases = [];
const mismatches = [];
for (
  let definitionIndex = 0;
  definitionIndex <
  PROVIDER_REGISTRY_MANIFEST_INVALID_CASE_DEFINITIONS_V1.length;
  definitionIndex += 1
) {
  const definition =
    PROVIDER_REGISTRY_MANIFEST_INVALID_CASE_DEFINITIONS_V1[definitionIndex];
  const reviewedCounts = reviewedCryptoCallCountTuple[definitionIndex];
  if (definition === undefined || reviewedCounts === undefined) {
    throw new Error("invalid definition/reviewed-count tuple closure");
  }
  const { request, wrongDomainProofs } =
    materializeProviderRegistryManifestInvalidCandidateV1(
      golden,
      definition,
      strictCryptoCapability,
    );
  const requestSemanticDigest =
    materializedRequestSemanticDigest(request);
  for (const proof of wrongDomainProofs) {
    if (
      !(await verifyRawEd25519(
        proof.publicKeyBytes,
        proof.messageBytes,
        proof.signatureBytes,
      ))
    ) {
      throw new Error(
        `wrong-domain proof is not valid on its alternate message: ${definition.caseId}`,
      );
    }
  }

  pointCalls = 0;
  signatureCalls = 0;
  const diagnostic =
    await diagnoseProviderRegistryManifestHistoryInternalV1(request);
  const observedPointCalls = pointCalls;
  const observedSignatureCalls = signatureCalls;
  if (
    diagnostic.ok ||
    diagnostic.stage !== definition.expected.stage ||
    diagnostic.reason !== definition.expected.reason
  ) {
    mismatches.push({
      caseId: definition.caseId,
      expected: {
        stage: definition.expected.stage,
        reason: definition.expected.reason,
      },
      observed: diagnostic,
      pointCalls: observedPointCalls,
      signatureCalls: observedSignatureCalls,
    });
    continue;
  }
  if (
    observedPointCalls !== reviewedCounts[1] ||
    observedSignatureCalls !== reviewedCounts[2]
  ) {
    throw new Error(
      `reviewed crypto call-count mismatch ${definition.caseId}: ${observedPointCalls}/${observedSignatureCalls}`,
    );
  }

  let publicError;
  try {
    await validateProviderRegistryManifestHistoryV1(request);
  } catch (error) {
    publicError = error;
  }
  const publicExpected = publicFailureExpected(definition);
  if (
    !(publicError instanceof ProviderRegistryManifestHistoryValidationError) ||
    publicError.name !== publicExpected.errorName ||
    publicError.code !== publicExpected.code ||
    publicError.reason !== publicExpected.reason ||
    publicError.message !== "Provider registry manifest history validation failed"
  ) {
    throw new Error(
      `invalid case did not fail through the exact opaque public error: ${definition.caseId}`,
    );
  }

  cases.push({
    caseId: definition.caseId,
    mutation: definition.mutation,
    expected: {
      boundary: definition.expected.boundary,
      stage: definition.expected.stage,
      reason: definition.expected.reason,
      publicFailure: publicExpected,
      postAttestationPointCalls: reviewedCounts[1],
      postAttestationSignatureCalls: reviewedCounts[2],
      wrongDomainProofCount: wrongDomainProofs.length,
      materializedRequestSemanticDigest: requestSemanticDigest,
    },
  });
}

if (mismatches.length !== 0) {
  process.stderr.write(`${JSON.stringify(mismatches, null, 2)}\n`);
  throw new Error(`${mismatches.length} invalid manifest cases missed their boundary`);
}
if (
  new Set(
    cases.map(
      ({ expected }) => expected.materializedRequestSemanticDigest,
    ),
  ).size !== cases.length
) {
  throw new Error("materialized request semantic digests must be unique");
}

const resource = {
  schemaVersion: 1,
  profile: "provider_registry_manifest_history_invalid_manifest_v1",
  fixtureAuthority: "none_rejection_only",
  verificationProfile: golden.verificationProfile,
  canonicalizationProfile: golden.canonicalizationProfile,
  semanticDomain,
  materializedRequestSemanticDomain,
  goldenDependency: {
    resourcePath: PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1,
    resourceByteLength:
      PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
    resourceSha256Hex:
      PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
    semanticContentDigest:
      PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
  },
  mutationRecipeDialect:
    PROVIDER_REGISTRY_MANIFEST_INVALID_RECIPE_DIALECT_V1,
  caseCount: cases.length,
  caseIds,
  cases,
};

const output = `${JSON.stringify(resource, null, 2)}\n`;
if (process.argv.includes("--report-counts")) {
  process.stdout.write(
    `${JSON.stringify(
      cases.map(({ caseId, expected }) => ({
        caseId,
        pointCalls: expected.postAttestationPointCalls,
        signatureCalls: expected.postAttestationSignatureCalls,
      })),
      null,
      2,
    )}\n`,
  );
}
if (process.argv.includes("--check")) {
  let existing;
  try {
    existing = await readFile(invalidPath, "utf8");
  } catch {
    throw new Error(`${invalidRelativePath} is missing`);
  }
  if (existing !== output) {
    throw new Error(`${invalidRelativePath} is stale`);
  }
  process.stdout.write(
    `verified ${invalidRelativePath}: ${cases.length} executable invalid cases, ${semanticDigest(
      semanticDomain,
      resource,
    )}\n`,
  );
} else {
  await mkdir(dirname(invalidPath), { recursive: true });
  await writeFile(invalidPath, output, "utf8");
  process.stdout.write(
    `wrote ${invalidRelativePath}: ${Buffer.byteLength(output)} bytes, ${cases.length} executable invalid cases, ${semanticDigest(
      semanticDomain,
      resource,
    )}\n`,
  );
}
