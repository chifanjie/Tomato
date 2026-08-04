import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "../dist/jcs.js";
import {
  PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_MAX_CANONICAL_BYTES_V1,
  validateProviderRealFilesystemConformanceResultClosureV1,
} from "../dist/provider-real-filesystem-conformance-result.js";
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
  INVALID_CASE_IDS,
  INVALID_MATERIALIZED_REQUEST_DOMAIN,
  INVALID_RECIPE_DIALECT,
  INVALID_RESOURCE_PATH,
  INVALID_SEMANTIC_DOMAIN,
  buildGoldenRealFilesystemConformanceResultFixture,
  executeProviderRealFilesystemConformanceResultInvalidCase,
  materializeInvalidRequestWitness,
  requestFromGolden,
} from "./lib/provider-real-filesystem-conformance-result-fixture.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const discoveryGoldenPath =
  "fixtures/v1/golden/provider-target-discovery-point-v1.json";

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function semanticDigest(domain, value) {
  return `sha256:${sha256Hex(canonicalizeJcsSafeIntegerUtf8V1([domain, value]))}`;
}

function prettyBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeOrCheck(relativePath, value, check) {
  const filePath = join(packageRoot, ...relativePath.split("/"));
  const bytes = prettyBytes(value);
  if (check) {
    const current = await readFile(filePath);
    if (!current.equals(bytes)) throw new Error(`${relativePath} is stale; regenerate fixtures`);
    return;
  }
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
}

const discoveryGoldenBytes = await readFile(
  join(packageRoot, ...discoveryGoldenPath.split("/")),
);
const discoveryGolden = JSON.parse(discoveryGoldenBytes.toString("utf8"));
const goldenPayload = buildGoldenRealFilesystemConformanceResultFixture(discoveryGolden);
const goldenWithoutDigest = {
  ...goldenPayload,
  semanticDomain: GOLDEN_SEMANTIC_DOMAIN,
  dependencies: {
    targetDiscoveryGoldenResourcePath: discoveryGoldenPath,
    targetDiscoveryGoldenResourceByteLength: discoveryGoldenBytes.byteLength,
    targetDiscoveryGoldenResourceSha256Hex: sha256Hex(discoveryGoldenBytes),
    targetDiscoveryGoldenSemanticContentDigest: discoveryGolden.semanticContentDigest,
  },
};
const golden = {
  ...goldenWithoutDigest,
  semanticContentDigest: semanticDigest(GOLDEN_SEMANTIC_DOMAIN, goldenWithoutDigest),
};

let pointCalls = 0;
let verifyCalls = 0;
const strictManifestBytes = new Uint8Array(
  await readFile(
    join(packageRoot, ...PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1.split("/")),
  ),
);
const capability = await attestProviderStrictEd25519CryptoHostV1({
  host: Object.freeze({
    verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
    validatePrimeSubgroupPoint(encodedPoint) {
      pointCalls += 1;
      return validatePrimeSubgroupPoint(encodedPoint);
    },
    async verifyRawEd25519(publicKey, message, signature) {
      verifyCalls += 1;
      return verifyRawEd25519(publicKey, message, signature);
    },
  }),
  resourceHost: Object.freeze({
    readFixedSignedPackageResource(path, maxBytes) {
      if (
        path !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 ||
        maxBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
      ) throw new Error("unexpected strict manifest request");
      return strictManifestBytes;
    },
  }),
});
pointCalls = 0;
verifyCalls = 0;
const validation = await validateProviderRealFilesystemConformanceResultClosureV1(
  requestFromGolden(golden, capability),
);
if (
  validation.authority !== "none_real_fs_conformance_result_structure_only" ||
  validation.caseResultCount !== golden.expected.caseResultCount ||
  validation.passedCaseResultCount !== golden.expected.passedCaseResultCount ||
  validation.relativePath !== golden.expected.relativePath ||
  pointCalls !== golden.expected.activeRootPointAdmissionCount ||
  verifyCalls !== golden.expected.signatureVerificationCount ||
  Object.hasOwn(golden.realFilesystemConformanceResult.payload, "signature")
) throw new Error("generated conformance result golden failed self-validation");

const invalidCases = [];
for (const caseId of INVALID_CASE_IDS) {
  const outcome = await executeProviderRealFilesystemConformanceResultInvalidCase(
    golden,
    caseId,
    capability,
  );
  if (outcome.kind === "unexpected_acceptance") {
    throw new Error(`${caseId} was unexpectedly accepted`);
  }
  const materializedRequestWitness = materializeInvalidRequestWitness(golden, caseId);
  if (caseId === "result-envelope-16mib-plus-one") {
    const envelope =
      materializedRequestWitness?.request?.realFilesystemConformanceResult;
    const byteLength = canonicalizeJcsSafeIntegerUtf8V1(envelope).byteLength;
    if (
      byteLength !==
      PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_MAX_CANONICAL_BYTES_V1 + 1
    ) {
      throw new Error(`${caseId} is ${byteLength} bytes instead of exact MAX+1`);
    }
  }
  const materializedRequestSemanticDigest = semanticDigest(
    INVALID_MATERIALIZED_REQUEST_DOMAIN,
    materializedRequestWitness,
  );
  let expected;
  if (outcome.kind === "snapshot_acceptance") {
    expected = {
      boundary: "snapshot_stability",
      outcome: "accepted_frozen_snapshot",
      authority: outcome.authority,
      caseResultCount: outcome.caseResultCount,
      passedCaseResultCount: outcome.passedCaseResultCount,
      materializedRequestSemanticDigest,
    };
  } else if (outcome.boundary === "locator_builder") {
    expected = {
      boundary: "locator_builder",
      stage: outcome.stage,
      reason: outcome.reason,
      materializedRequestSemanticDigest,
    };
  } else {
    if (
      outcome.publicFailure?.errorName !==
        "ProviderRealFilesystemConformanceResultClosureValidationError" ||
      outcome.publicFailure.code !== "provider_unavailable" ||
      outcome.publicFailure.reason !== "attestation_invalid"
    ) throw new Error(`${caseId} public rejection drift`);
    expected = {
      boundary: "internal_diagnostic",
      stage: outcome.stage,
      reason: outcome.reason,
      publicFailureReason: "attestation_invalid",
      publicFailure: outcome.publicFailure,
      materializedRequestSemanticDigest,
    };
  }
  invalidCases.push({
    caseId,
    mutation: {
      dialect: INVALID_RECIPE_DIALECT,
      goldenResourcePath: GOLDEN_RESOURCE_PATH,
      operation: caseId,
    },
    expected,
  });
}

const goldenBytes = prettyBytes(golden);
const invalidWithoutDigest = {
  schemaVersion: 1,
  profile: "provider_real_filesystem_conformance_result_invalid_v1",
  fixtureAuthority: "none_rejection_only",
  canonicalizationProfile: "rfc8785-jcs-safe-integer-v1",
  verificationProfile: "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
  semanticDomain: INVALID_SEMANTIC_DOMAIN,
  materializedRequestSemanticDomain: INVALID_MATERIALIZED_REQUEST_DOMAIN,
  goldenDependency: {
    resourcePath: GOLDEN_RESOURCE_PATH,
    resourceByteLength: goldenBytes.byteLength,
    resourceSha256Hex: sha256Hex(goldenBytes),
    semanticContentDigest: golden.semanticContentDigest,
  },
  mutationRecipeDialect: INVALID_RECIPE_DIALECT,
  caseCount: invalidCases.length,
  caseIds: [...INVALID_CASE_IDS],
  cases: invalidCases,
};
const invalid = {
  ...invalidWithoutDigest,
  semanticContentDigest: semanticDigest(INVALID_SEMANTIC_DOMAIN, invalidWithoutDigest),
};

const check = process.argv.includes("--check");
await writeOrCheck(GOLDEN_RESOURCE_PATH, golden, check);
await writeOrCheck(INVALID_RESOURCE_PATH, invalid, check);
process.stdout.write(
  `${check ? "Verified" : "Generated"} real filesystem conformance result golden + ${invalid.caseCount} invalid cases.\n`,
);
