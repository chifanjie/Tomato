import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "../dist/jcs.js";
import { validateProviderRuntimeAttestationPointClosureV1 } from "../dist/provider-runtime-attestation-point.js";
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
  buildGoldenProviderRuntimeAttestationPointFixture,
  buildInvalidMutation,
  executeProviderRuntimeAttestationPointInvalidCase,
  materializeInvalidRequestWitness,
  requestFromGolden,
} from "./lib/provider-runtime-attestation-point-fixture.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const conformanceGoldenPath =
  "fixtures/v1/golden/provider-real-filesystem-conformance-result-v1.json";
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
    if (!current.equals(bytes)) {
      throw new Error(`${relativePath} is stale; regenerate fixtures`);
    }
    return;
  }
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
}

const conformanceGoldenBytes = await readFile(
  join(packageRoot, ...conformanceGoldenPath.split("/")),
);
const conformanceGolden = JSON.parse(conformanceGoldenBytes.toString("utf8"));
const discoveryGolden = JSON.parse(
  await readFile(join(packageRoot, ...discoveryGoldenPath.split("/")), "utf8"),
);
const rootSeedHex = discoveryGolden.deterministicRootSeedHex;
if (
  typeof rootSeedHex !== "string" ||
  !/^[0-9a-f]{64}$/u.test(rootSeedHex) ||
  conformanceGolden.dependencies.targetDiscoveryGoldenSemanticContentDigest !==
    discoveryGolden.semanticContentDigest
) {
  throw new Error("conformance-result golden does not close its signing fixture source");
}

const goldenPayload = buildGoldenProviderRuntimeAttestationPointFixture(
  conformanceGolden,
  rootSeedHex,
);
const goldenWithoutDigest = {
  ...goldenPayload,
  semanticDomain: GOLDEN_SEMANTIC_DOMAIN,
  dependencies: {
    conformanceResultGoldenResourcePath: conformanceGoldenPath,
    conformanceResultGoldenResourceByteLength: conformanceGoldenBytes.byteLength,
    conformanceResultGoldenResourceSha256Hex: sha256Hex(conformanceGoldenBytes),
    conformanceResultGoldenSemanticContentDigest:
      conformanceGolden.semanticContentDigest,
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
    join(
      packageRoot,
      ...PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1.split("/"),
    ),
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
      ) {
        throw new Error("unexpected strict manifest request");
      }
      return strictManifestBytes;
    },
  }),
});

pointCalls = 0;
verifyCalls = 0;
const validation = await validateProviderRuntimeAttestationPointClosureV1(
  requestFromGolden(golden, capability),
);
if (
  validation.authority !== "none_provider_runtime_attestation_structure_only" ||
  validation.semanticProviderPolicyDigest !==
    golden.expected.semanticProviderPolicyDigest ||
  validation.filesystemProfileDigest !== golden.expected.filesystemProfileDigest ||
  validation.runtimeAttestation.contentDigest !==
    golden.expected.runtimeAttestationContentDigest ||
  pointCalls !== golden.expected.activeRootPointAdmissionCount ||
  verifyCalls !== golden.expected.signatureVerificationCount
) {
  throw new Error(
    `generated runtime attestation point golden failed self-validation: ${pointCalls}/${verifyCalls}`,
  );
}
const frozenSnapshotProjection = {
  runtimeAttestationContentDigest:
    golden.expected.runtimeAttestationContentDigest,
  runtimeAttestationGeneration:
    golden.runtimeAttestation.payload.attestationGeneration,
  runtimeIssuedAt: golden.runtimeAttestation.payload.issuedAt,
  runtimeIpcEndpointAttestationDigest:
    golden.runtimeAttestation.payload.ipcEndpointAttestationDigest,
  semanticProviderPolicyDigest: golden.expected.semanticProviderPolicyDigest,
  filesystemProfileDigest: golden.expected.filesystemProfileDigest,
  realFilesystemConformanceResultContentDigest:
    golden.expected.realFilesystemConformanceResultContentDigest,
  conformanceCaseResultCount:
    validation.conformanceResultClosure.caseResultCount,
  conformancePassedCaseResultCount:
    validation.conformanceResultClosure.passedCaseResultCount,
  conformanceFailedCaseResultCount:
    validation.conformanceResultClosure.failedCaseResultCount,
  conformanceUnsupportedCaseResultCount:
    validation.conformanceResultClosure.unsupportedCaseResultCount,
};
if (
  frozenSnapshotProjection.conformancePassedCaseResultCount +
    frozenSnapshotProjection.conformanceFailedCaseResultCount +
    frozenSnapshotProjection.conformanceUnsupportedCaseResultCount !==
  frozenSnapshotProjection.conformanceCaseResultCount
) {
  throw new Error("golden snapshot result-count projection is inconsistent");
}

const invalidCases = [];
for (const caseId of INVALID_CASE_IDS) {
  const mutation = buildInvalidMutation(golden, caseId, rootSeedHex);
  const draftCase = {
    caseId,
    group: caseId.startsWith("inner-")
      ? "inner_conformance_result"
      : "runtime_attestation_point",
    mutation,
    expected: {},
  };
  pointCalls = 0;
  verifyCalls = 0;
  const outcome = await executeProviderRuntimeAttestationPointInvalidCase(
    golden,
    draftCase,
    capability,
  );
  const observedPointCalls = pointCalls;
  const observedVerifyCalls = verifyCalls;
  if (outcome.kind === "unexpected_acceptance") {
    throw new Error(`${caseId} was unexpectedly accepted`);
  }
  const materializedRequestWitness = materializeInvalidRequestWitness(
    golden,
    draftCase,
  );
  const materializedRequestSemanticDigest = semanticDigest(
    INVALID_MATERIALIZED_REQUEST_DOMAIN,
    materializedRequestWitness,
  );
  let expected;
  if (outcome.kind === "snapshot_acceptance") {
    if (
      outcome.authority !== "none_provider_runtime_attestation_structure_only" ||
      JSON.stringify(outcome.snapshotProjection) !==
        JSON.stringify(frozenSnapshotProjection) ||
      observedPointCalls !== 1 ||
      observedVerifyCalls !== 7
    ) {
      throw new Error(`${caseId} snapshot authority or crypto count drift`);
    }
    expected = {
      boundary: "snapshot_stability",
      outcome: "accepted_frozen_snapshot",
      authority: outcome.authority,
      snapshotProjection: frozenSnapshotProjection,
      pointAdmissionCount: observedPointCalls,
      signatureVerificationCount: observedVerifyCalls,
      materializedRequestSemanticDigest,
    };
  } else {
    if (
      outcome.publicFailure?.errorName !==
        "ProviderRuntimeAttestationPointClosureValidationError" ||
      outcome.publicFailure.code !== "provider_unavailable" ||
      outcome.publicFailure.reason !== "attestation_invalid"
    ) {
      throw new Error(`${caseId} public rejection drift`);
    }
    expected = {
      boundary: "internal_diagnostic",
      stage: outcome.stage,
      reason: outcome.reason,
      publicFailureReason: "attestation_invalid",
      publicFailure: outcome.publicFailure,
      pointAdmissionCount: observedPointCalls,
      signatureVerificationCount: observedVerifyCalls,
      materializedRequestSemanticDigest,
    };
  }
  invalidCases.push({
    caseId,
    group: draftCase.group,
    mutation,
    expected,
  });
}

const goldenBytes = prettyBytes(golden);
const innerCaseCount = invalidCases.filter(
  (invalidCase) => invalidCase.group === "inner_conformance_result",
).length;
const pointCaseCount = invalidCases.length - innerCaseCount;
const invalidWithoutDigest = {
  schemaVersion: 1,
  profile: "provider_runtime_attestation_point_invalid_v1",
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
  innerCaseCount,
  pointCaseCount,
  caseCount: invalidCases.length,
  caseIds: [...INVALID_CASE_IDS],
  cases: invalidCases,
};
const invalid = {
  ...invalidWithoutDigest,
  semanticContentDigest: semanticDigest(
    INVALID_SEMANTIC_DOMAIN,
    invalidWithoutDigest,
  ),
};

const check = process.argv.includes("--check");
await writeOrCheck(GOLDEN_RESOURCE_PATH, golden, check);
await writeOrCheck(INVALID_RESOURCE_PATH, invalid, check);
process.stdout.write(
  `${check ? "Verified" : "Generated"} provider runtime attestation point golden + ${invalid.innerCaseCount} inner / ${invalid.pointCaseCount} point invalid cases.\n`,
);
