import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ProviderDistributionHistoryCurrentCandidatePointValidationError,
  diagnoseProviderDistributionHistoryCurrentCandidatePointV1,
  validateProviderDistributionHistoryCurrentCandidatePointV1,
} from "../dist/provider-distribution-history-current-candidate-point.js";
import {
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
  projectProviderFeasibilitySupportCatalogPointFixtureClosureV1,
} from "../dist/provider-feasibility-support-catalog-point-fixtures.js";
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
  GOLDEN_RESOURCE_PATH,
  GOLDEN_SEMANTIC_DOMAIN,
  INVALID_CASE_DEFINITIONS,
  INVALID_CASE_IDS,
  INVALID_MATERIALIZED_REQUEST_DOMAIN,
  INVALID_RECIPE_DIALECT,
  INVALID_RESOURCE_PATH,
  INVALID_SEMANTIC_DOMAIN,
  POSITIVE_VECTOR_IDS,
  buildInvalidCase,
  buildPositiveRawRequest,
  jsonClone,
  prettyBytes,
  semanticDigest,
  sha256Hex,
} from "./lib/provider-distribution-history-current-candidate-point-fixture.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const allowedArguments = new Set(["--check"]);
for (const argument of process.argv.slice(2)) {
  if (!allowedArguments.has(argument)) {
    throw new Error(`unknown argument: ${argument}`);
  }
}

function resourcePath(relativePath) {
  return join(packageRoot, ...relativePath.split("/"));
}

async function writeOrCheck(relativePath, bytes) {
  const filePath = resourcePath(relativePath);
  if (check) {
    const current = await readFile(filePath);
    if (!current.equals(bytes)) {
      throw new Error(`${relativePath} is stale; regenerate fixtures`);
    }
    return;
  }
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
}

function recursivelyFreeze(value, seen = new Set()) {
  if (
    value === null ||
    (typeof value !== "object" && typeof value !== "function") ||
    seen.has(value)
  ) {
    return value;
  }
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      recursivelyFreeze(descriptor.value, seen);
    }
  }
  return Object.freeze(value);
}

function runtimeRequest(rawRequest, capability) {
  const request = jsonClone(rawRequest);
  for (const key of Reflect.ownKeys(request)) {
    const descriptor = Object.getOwnPropertyDescriptor(request, key);
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new Error("fixture request has a non-data field");
    }
    recursivelyFreeze(descriptor.value);
  }
  Object.defineProperty(request, "strictCryptoCapability", {
    value: capability,
    enumerable: true,
    configurable: false,
    writable: false,
  });
  return Object.freeze(request);
}

function canonicalEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function cryptoDelta(before) {
  return {
    pointAdmissionCount: pointAdmissionCount - before.pointAdmissionCount,
    signatureVerificationCount:
      signatureVerificationCount - before.signatureVerificationCount,
  };
}

function currentCounts() {
  return { pointAdmissionCount, signatureVerificationCount };
}

function assertPublicFailure(error, caseId) {
  if (
    !(error instanceof
      ProviderDistributionHistoryCurrentCandidatePointValidationError) ||
    error.name !==
      "ProviderDistributionHistoryCurrentCandidatePointValidationError" ||
    error.code !== "provider_unavailable" ||
    error.reason !== "attestation_invalid" ||
    !Object.isFrozen(error)
  ) {
    throw new Error(`${caseId} public rejection drift`);
  }
  return {
    errorName: error.name,
    code: error.code,
    reason: error.reason,
  };
}

const catalogGoldenBytes = await readFile(
  resourcePath(PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_PATH_V1),
);
if (
  catalogGoldenBytes.byteLength !==
    PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1 ||
  sha256Hex(catalogGoldenBytes) !==
    PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1
) {
  throw new Error("Catalog golden dependency anchor drift");
}
const catalogGolden = JSON.parse(catalogGoldenBytes.toString("utf8"));
if (
  catalogGolden.semanticContentDigest !==
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1
) {
  throw new Error("Catalog golden dependency semantic digest drift");
}

const strictManifestBytes = new Uint8Array(
  await readFile(resourcePath(PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1)),
);
let pointAdmissionCount = 0;
let signatureVerificationCount = 0;
const capability = await attestProviderStrictEd25519CryptoHostV1({
  host: Object.freeze({
    verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
    validatePrimeSubgroupPoint(encodedPoint) {
      pointAdmissionCount += 1;
      return validatePrimeSubgroupPoint(encodedPoint);
    },
    async verifyRawEd25519(publicKey, message, signature) {
      signatureVerificationCount += 1;
      return verifyRawEd25519(publicKey, message, signature);
    },
  }),
  resourceHost: Object.freeze({
    readFixedSignedPackageResource(path, maxBytes) {
      if (
        path !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 ||
        maxBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
      ) {
        throw new Error("unexpected strict Ed25519 manifest request");
      }
      return strictManifestBytes.slice();
    },
  }),
});
pointAdmissionCount = 0;
signatureVerificationCount = 0;

const expectedPositiveCounts = Object.freeze({
  genesis: Object.freeze({
    pointAdmissionCount: 31,
    signatureVerificationCount: 64,
  }),
  "two-generation-shared": Object.freeze({
    pointAdmissionCount: 31,
    signatureVerificationCount: 70,
  }),
  "two-generation-distinct": Object.freeze({
    pointAdmissionCount: 31,
    signatureVerificationCount: 72,
  }),
});
const successKeys = Object.freeze([
  "authority",
  "catalogPointClosure",
  "currentCatalogProjection",
  "providerFeasibilitySupportCatalogTip",
  "publicSupportTaxonomyTip",
  "releaseMatrixTip",
  "releaseTargetUniverseTip",
  "targetDiscoveryResultTip",
]);

const positiveVectors = [];
let aggregatePointAdmissionCount = 0;
let aggregateSignatureVerificationCount = 0;
for (const vectorId of POSITIVE_VECTOR_IDS) {
  const request = buildPositiveRawRequest(catalogGolden, vectorId);
  if (Reflect.ownKeys(request).length !== 15) {
    throw new Error(`${vectorId} raw request is not exact 15`);
  }
  const before = currentCounts();
  const value = await validateProviderDistributionHistoryCurrentCandidatePointV1(
    runtimeRequest(request, capability),
  );
  const counts = cryptoDelta(before);
  if (!canonicalEqual(counts, expectedPositiveCounts[vectorId])) {
    throw new Error(`${vectorId} crypto count drift`);
  }
  if (
    !canonicalEqual(Object.keys(value).sort(), successKeys) ||
    value.authority !==
      "none_provider_distribution_history_current_candidate_structure_only" ||
    !canonicalEqual(
      projectProviderFeasibilitySupportCatalogPointFixtureClosureV1(
        value.catalogPointClosure,
      ),
      value.currentCatalogProjection,
    )
  ) {
    throw new Error(`${vectorId} success projection drift`);
  }
  recursivelyFreeze(value);
  aggregatePointAdmissionCount += counts.pointAdmissionCount;
  aggregateSignatureVerificationCount += counts.signatureVerificationCount;
  positiveVectors.push({
    vectorId,
    request,
    expected: {
      authority:
        "none_provider_distribution_history_current_candidate_structure_only",
      successKeys,
      currentCatalogProjection: jsonClone(value.currentCatalogProjection),
      cryptoCounts: counts,
    },
  });
}
if (
  aggregatePointAdmissionCount !== 93 ||
  aggregateSignatureVerificationCount !== 206
) {
  throw new Error("positive aggregate crypto count drift");
}

const goldenWithoutDigest = {
  schemaVersion: 1,
  profile:
    "provider_distribution_history_current_candidate_point_golden_v1",
  fixtureAuthority:
    "none_provider_distribution_history_current_candidate_structure_only",
  canonicalizationProfile: "rfc8785-jcs-safe-integer-v1",
  verificationProfile:
    "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
  dependencies: {
    catalogPointGolden: {
      resourcePath:
        PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_PATH_V1,
      resourceByteLength:
        PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
      resourceSha256Hex:
        PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_SHA256_HEX_V1,
      semanticContentDigest:
        PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
    },
  },
  positiveVectorCount: 3,
  positiveVectorIds: POSITIVE_VECTOR_IDS,
  positiveVectors,
  aggregateCryptoCounts: {
    pointAdmissionCount: aggregatePointAdmissionCount,
    signatureVerificationCount: aggregateSignatureVerificationCount,
  },
  semanticDomain: GOLDEN_SEMANTIC_DOMAIN,
};
const golden = {
  ...goldenWithoutDigest,
  semanticContentDigest: semanticDigest(
    GOLDEN_SEMANTIC_DOMAIN,
    goldenWithoutDigest,
  ),
};
const goldenBytes = prettyBytes(golden);
const goldenAnchor = {
  resourcePath: GOLDEN_RESOURCE_PATH,
  resourceByteLength: goldenBytes.byteLength,
  resourceSha256Hex: sha256Hex(goldenBytes),
  semanticContentDigest: golden.semanticContentDigest,
};

const invalidCases = [];
for (const definition of INVALID_CASE_DEFINITIONS) {
  const built = buildInvalidCase(catalogGolden, definition.caseId);
  const materializedRequestSemanticDigest = semanticDigest(
    INVALID_MATERIALIZED_REQUEST_DOMAIN,
    built.request,
  );
  const before = currentCounts();
  const diagnostic =
    await diagnoseProviderDistributionHistoryCurrentCandidatePointV1(
      runtimeRequest(built.request, capability),
    );
  if (
    diagnostic.ok ||
    diagnostic.stage !== built.expected.stage ||
    diagnostic.reason !== built.expected.reason
  ) {
    throw new Error(`${definition.caseId} diagnostic drift`);
  }
  let publicFailure;
  try {
    await validateProviderDistributionHistoryCurrentCandidatePointV1(
      runtimeRequest(built.request, capability),
    );
  } catch (error) {
    publicFailure = assertPublicFailure(error, definition.caseId);
  }
  if (publicFailure === undefined) {
    throw new Error(`${definition.caseId} public validator accepted`);
  }
  const counts = cryptoDelta(before);
  invalidCases.push({
    caseId: built.caseId,
    group: built.group,
    mutation: {
      dialect: INVALID_RECIPE_DIALECT,
      goldenResourcePath: GOLDEN_RESOURCE_PATH,
      baseVectorId: built.baseVectorId,
      operations: built.recipe.operations,
    },
    expected: {
      stage: built.expected.stage,
      reason: built.expected.reason,
      publicFailure,
      cryptoCounts: counts,
      materializedRequestSemanticDigest,
    },
  });
}
if (
  invalidCases.length !== 39 ||
  !canonicalEqual(
    invalidCases.map(({ caseId }) => caseId),
    INVALID_CASE_IDS,
  )
) {
  throw new Error("invalid inventory drift");
}

const invalidWithoutDigest = {
  schemaVersion: 1,
  profile:
    "provider_distribution_history_current_candidate_point_invalid_v1",
  fixtureAuthority: "none_rejection_only",
  canonicalizationProfile: "rfc8785-jcs-safe-integer-v1",
  verificationProfile:
    "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
  goldenDependency: goldenAnchor,
  mutationRecipeDialect: INVALID_RECIPE_DIALECT,
  materializedRequestDomain: INVALID_MATERIALIZED_REQUEST_DOMAIN,
  historicalSignatureCaseCount: 3,
  historicalSemanticCaseCount: 5,
  forbiddenExtraKeyCaseCount: 3,
  fiveChainStructuralCaseCount: 15,
  retainedExactCoverCaseCount: 12,
  catalogCrossPinCaseCount: 1,
  caseCount: 39,
  caseIds: INVALID_CASE_IDS,
  cases: invalidCases,
  semanticDomain: INVALID_SEMANTIC_DOMAIN,
};
const invalid = {
  ...invalidWithoutDigest,
  semanticContentDigest: semanticDigest(
    INVALID_SEMANTIC_DOMAIN,
    invalidWithoutDigest,
  ),
};
const invalidBytes = prettyBytes(invalid);
const invalidAnchor = {
  resourcePath: INVALID_RESOURCE_PATH,
  resourceByteLength: invalidBytes.byteLength,
  resourceSha256Hex: sha256Hex(invalidBytes),
  semanticContentDigest: invalid.semanticContentDigest,
};

await writeOrCheck(GOLDEN_RESOURCE_PATH, goldenBytes);
await writeOrCheck(INVALID_RESOURCE_PATH, invalidBytes);

console.log(JSON.stringify({ golden: goldenAnchor, invalid: invalidAnchor }));
