import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "../dist/jcs.js";
import {
  createProviderReleaseTargetUniverseSignatureMessageV1,
  projectProviderReleaseTargetUniverseUnsignedClaimsV1,
  validateProviderReleaseTargetUniversePointClosureV1,
} from "../dist/provider-release-target-universe-point.js";
import {
  PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INHERITED_CASE_IDS_V1,
  PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_SPECIFIC_CASE_IDS_V1,
  executeProviderReleaseTargetUniversePointInvalidCaseV1,
  materializeProviderReleaseTargetUniversePointInvalidCaseWitnessV1,
} from "../dist/provider-release-target-universe-point-fixtures.js";
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
  INVALID_MATERIALIZED_REQUEST_DOMAIN,
  INVALID_RECIPE_DIALECT,
  INVALID_RESOURCE_PATH,
  INVALID_SEMANTIC_DOMAIN,
  POSITIVE_VECTOR_IDS,
  buildInheritedReplayRecipes,
  buildPointReplayRecipes,
  buildPositiveVector,
  prettyBytes,
  projectAcceptedSnapshot,
  requestFromSourceAndUniverse,
  semanticDigest,
  sha256Hex,
  verifyInheritedReplayRecipesByteIdentical,
} from "./lib/provider-release-target-universe-point-fixture.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const targetDiscoveryGoldenPath =
  "fixtures/v1/golden/provider-target-discovery-point-v1.json";
const targetDiscoveryInvalidPath =
  "fixtures/v1/invalid/provider-target-discovery-point-v1.json";

function resourcePath(relativePath) {
  return join(packageRoot, ...relativePath.split("/"));
}

async function writeOrCheck(relativePath, value, check) {
  const filePath = resourcePath(relativePath);
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

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hex(bytes) {
  return Buffer.from(bytes).toString("hex");
}

function sourceExpectedProjection(sourceCase) {
  const expected = sourceCase.expected;
  if (expected.boundary === "snapshot_stability") {
    return {
      boundary: expected.boundary,
      outcome: expected.outcome,
    };
  }
  return {
    boundary: expected.boundary,
    stage: expected.stage,
    reason: expected.reason,
  };
}

function expectedFromOutcome(caseId, outcome, materializedRequestSemanticDigest) {
  if (outcome.kind === "unexpected_acceptance") {
    throw new Error(`${caseId} was unexpectedly accepted`);
  }
  if (outcome.kind === "snapshot_acceptance") {
    if (
      outcome.authority !==
      "none_release_target_universe_structure_only"
    ) {
      throw new Error(`${caseId} snapshot authority drift`);
    }
    return {
      boundary: "snapshot_stability",
      outcome: "accepted_frozen_snapshot",
      authority: outcome.authority,
      snapshotProjection: outcome.snapshotProjection,
      pointAdmissionCount: outcome.pointAdmissionCount,
      signatureVerificationCount: outcome.signatureVerificationCount,
      materializedRequestSemanticDigest,
    };
  }
  if (outcome.boundary === "locator_builder") {
    return {
      boundary: "locator_builder",
      stage: outcome.stage,
      reason: outcome.reason,
      pointAdmissionCount: outcome.pointAdmissionCount,
      signatureVerificationCount: outcome.signatureVerificationCount,
      materializedRequestSemanticDigest,
    };
  }
  const publicFailure = outcome.publicFailure;
  if (
    publicFailure?.errorName !==
      "ProviderReleaseTargetUniversePointClosureValidationError" ||
    publicFailure.code !== "provider_unavailable" ||
    publicFailure.reason !== "attestation_invalid"
  ) {
    throw new Error(`${caseId} public rejection drift`);
  }
  return {
    boundary: "internal_diagnostic",
    stage: outcome.stage,
    reason: outcome.reason,
    publicFailureReason: "attestation_invalid",
    publicFailure,
    pointAdmissionCount: outcome.pointAdmissionCount,
    signatureVerificationCount: outcome.signatureVerificationCount,
    materializedRequestSemanticDigest,
  };
}

const strictManifestBytes = new Uint8Array(
  await readFile(resourcePath(PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1)),
);
let pointAdmissionCount = 0;
let signatureVerificationCount = 0;
let nextSignatureMutation;
const capability = await attestProviderStrictEd25519CryptoHostV1({
  host: Object.freeze({
    verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
    validatePrimeSubgroupPoint(encodedPoint) {
      pointAdmissionCount += 1;
      return validatePrimeSubgroupPoint(encodedPoint);
    },
    async verifyRawEd25519(publicKey, message, signature) {
      signatureVerificationCount += 1;
      const mutation = nextSignatureMutation;
      nextSignatureMutation = undefined;
      mutation?.();
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
      return strictManifestBytes;
    },
  }),
});
pointAdmissionCount = 0;
signatureVerificationCount = 0;
const executionCounter = Object.freeze({
  pointAdmissionCount() {
    return pointAdmissionCount;
  },
  signatureVerificationCount() {
    return signatureVerificationCount;
  },
  mutateDuringNextSignature(mutation) {
    if (nextSignatureMutation !== undefined) {
      throw new Error("a signature-time mutation is already registered");
    }
    nextSignatureMutation = mutation;
  },
});

const targetDiscoveryGoldenBytes = await readFile(
  resourcePath(targetDiscoveryGoldenPath),
);
const targetDiscoveryInvalidBytes = await readFile(
  resourcePath(targetDiscoveryInvalidPath),
);
const targetDiscoveryGolden = JSON.parse(
  targetDiscoveryGoldenBytes.toString("utf8"),
);
const targetDiscoveryInvalid = JSON.parse(
  targetDiscoveryInvalidBytes.toString("utf8"),
);

const builtPositiveVectors = POSITIVE_VECTOR_IDS.map((vectorId) =>
  buildPositiveVector(targetDiscoveryGolden, vectorId),
);
const positiveVectors = [];
for (const built of builtPositiveVectors) {
  const request = requestFromSourceAndUniverse(
    built.targetDiscoveryPoint,
    built.releaseTargetUniverse,
  );
  const beforePoint = pointAdmissionCount;
  const beforeSignature = signatureVerificationCount;
  const closure = await validateProviderReleaseTargetUniversePointClosureV1({
    ...jsonClone(request),
    strictCryptoCapability: capability,
  });
  const pointDelta = pointAdmissionCount - beforePoint;
  const signatureDelta = signatureVerificationCount - beforeSignature;
  if (pointDelta !== 1 || signatureDelta !== 7) {
    throw new Error(
      `${built.vectorId} verification count drift (${pointDelta}/${signatureDelta})`,
    );
  }
  const snapshotProjection = projectAcceptedSnapshot(closure);
  if (
    JSON.stringify(snapshotProjection.coverageResolution) !==
      JSON.stringify(built.expected.coverageResolution) ||
    snapshotProjection.universeContentDigest !==
      built.expected.universeContentDigest ||
    snapshotProjection.universeRelativePath !==
      built.expected.universeRelativePath ||
    snapshotProjection.universeTargetCount !==
      built.expected.universeTargetCount ||
    snapshotProjection.universeBucketCount !==
      built.expected.universeBucketCount
  ) {
    throw new Error(`${built.vectorId} positive projection drift`);
  }
  positiveVectors.push({
    vectorId: built.vectorId,
    request,
    expected: {
      snapshotProjection,
      pointAdmissionCount: pointDelta,
      signatureVerificationCount: signatureDelta,
    },
  });
}

const baseline = builtPositiveVectors[0];
const baselineVector = positiveVectors[0];
const unsignedClaims =
  projectProviderReleaseTargetUniverseUnsignedClaimsV1(
    baseline.releaseTargetUniverse.payload,
  );
const goldenWithoutDigest = {
  schemaVersion: 1,
  profile: "provider_release_target_universe_point_golden_v1",
  fixtureAuthority: "none_release_target_universe_structure_only",
  canonicalizationProfile: "rfc8785-jcs-safe-integer-v1",
  verificationProfile: "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
  deterministicRootSeedHex: targetDiscoveryGolden.deterministicRootSeedHex,
  targetDiscoveryPointGolden: targetDiscoveryGolden,
  releaseTargetUniverse: baseline.releaseTargetUniverse,
  positiveVectors,
  expected: {
    universeUnsignedClaimsCanonicalUtf8Hex: hex(
      canonicalizeJcsSafeIntegerUtf8V1(unsignedClaims),
    ),
    universeSignatureMessageUtf8Hex: hex(
      createProviderReleaseTargetUniverseSignatureMessageV1(
        baseline.releaseTargetUniverse.payload,
      ),
    ),
    snapshotProjection: baselineVector.expected.snapshotProjection,
    pointAdmissionCount: 1,
    signatureVerificationCount: 7,
  },
  semanticDomain: GOLDEN_SEMANTIC_DOMAIN,
  dependencies: {
    targetDiscoveryGoldenResourcePath: targetDiscoveryGoldenPath,
    targetDiscoveryGoldenResourceByteLength:
      targetDiscoveryGoldenBytes.byteLength,
    targetDiscoveryGoldenResourceSha256Hex: sha256Hex(
      targetDiscoveryGoldenBytes,
    ),
    targetDiscoveryGoldenSemanticContentDigest:
      targetDiscoveryGolden.semanticContentDigest,
  },
};
const golden = {
  ...goldenWithoutDigest,
  semanticContentDigest: semanticDigest(
    GOLDEN_SEMANTIC_DOMAIN,
    goldenWithoutDigest,
  ),
};

const inheritedReplayRecipes = buildInheritedReplayRecipes(
  targetDiscoveryGolden,
);
verifyInheritedReplayRecipesByteIdentical(
  targetDiscoveryGolden,
  inheritedReplayRecipes,
);
if (
  inheritedReplayRecipes.length !==
  PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INHERITED_CASE_IDS_V1.length
) {
  throw new Error("inherited replay count drift");
}
const inheritedReplayRecords = inheritedReplayRecipes.map((replay, index) => {
  const caseId =
    PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INHERITED_CASE_IDS_V1[index];
  const sourceCase = targetDiscoveryInvalid.cases[index];
  const sourceOperation = caseId.slice("discovery-".length);
  if (
    sourceCase.caseId !== sourceOperation ||
    targetDiscoveryInvalid.caseIds[index] !== sourceOperation
  ) {
    throw new Error(`inherited source order drift at ${caseId}`);
  }
  return {
    caseId,
    sourceOperation,
    sourceExpected: sourceExpectedProjection(sourceCase),
    replay,
  };
});

const inheritedCaseSkeletons =
  PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INHERITED_CASE_IDS_V1.map(
    (caseId, index) => {
      const sourceOperation = caseId.slice("discovery-".length);
      return {
        caseId,
        group: "target_discovery_point",
        mutation: {
          dialect: INVALID_RECIPE_DIALECT,
          goldenResourcePath: GOLDEN_RESOURCE_PATH,
          baseVectorId: "taxonomy-mapping-unresolved",
          operation: caseId,
          recipe: {
            kind:
              index >= 95 && index <= 105
                ? "target_discovery_locator_builder"
                : "target_discovery_point",
            sourceOperation,
          },
        },
      };
    },
  );
const pointReplayRecords = buildPointReplayRecipes(
  golden,
  PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_SPECIFIC_CASE_IDS_V1,
);
const pointCaseSkeletons = pointReplayRecords.map(
  ({ caseId, baseVectorId, recipe }) => ({
    caseId,
    group: "release_target_universe_point",
    mutation: {
      dialect: INVALID_RECIPE_DIALECT,
      goldenResourcePath: GOLDEN_RESOURCE_PATH,
      baseVectorId,
      operation: caseId,
      recipe,
    },
  }),
);
const caseSkeletons = [...inheritedCaseSkeletons, ...pointCaseSkeletons];
const caseIds = caseSkeletons.map((invalidCase) => invalidCase.caseId);
const invalidDraft = {
  schemaVersion: 1,
  profile: "provider_release_target_universe_point_invalid_v1",
  fixtureAuthority: "none_rejection_only",
  canonicalizationProfile: "rfc8785-jcs-safe-integer-v1",
  verificationProfile: "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
  semanticDomain: INVALID_SEMANTIC_DOMAIN,
  materializedRequestSemanticDomain: INVALID_MATERIALIZED_REQUEST_DOMAIN,
  goldenDependency: undefined,
  targetDiscoveryInvalidDependency: undefined,
  mutationRecipeDialect: INVALID_RECIPE_DIALECT,
  inheritedCaseCount: inheritedCaseSkeletons.length,
  pointCaseCount: pointCaseSkeletons.length,
  caseCount: caseSkeletons.length,
  caseIds,
  inheritedReplayRecipes: inheritedReplayRecords,
  cases: caseSkeletons,
};

const invalidCases = [];
for (const invalidCase of caseSkeletons) {
  const witness =
    materializeProviderReleaseTargetUniversePointInvalidCaseWitnessV1(
      golden,
      invalidDraft,
      invalidCase,
    );
  const materializedRequestSemanticDigest = semanticDigest(
    INVALID_MATERIALIZED_REQUEST_DOMAIN,
    witness,
  );
  const outcome =
    await executeProviderReleaseTargetUniversePointInvalidCaseV1(
      golden,
      invalidDraft,
      invalidCase,
      capability,
      executionCounter,
    );
  if (nextSignatureMutation !== undefined) {
    throw new Error(
      `${invalidCase.caseId} left a signature-time mutation registered`,
    );
  }
  invalidCases.push({
    ...invalidCase,
    expected: expectedFromOutcome(
      invalidCase.caseId,
      outcome,
      materializedRequestSemanticDigest,
    ),
  });
}

const goldenBytes = prettyBytes(golden);
const invalidWithoutDigest = {
  schemaVersion: 1,
  profile: "provider_release_target_universe_point_invalid_v1",
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
  targetDiscoveryInvalidDependency: {
    resourcePath: targetDiscoveryInvalidPath,
    resourceByteLength: targetDiscoveryInvalidBytes.byteLength,
    resourceSha256Hex: sha256Hex(targetDiscoveryInvalidBytes),
    semanticContentDigest: targetDiscoveryInvalid.semanticContentDigest,
    manifest: targetDiscoveryInvalid,
  },
  mutationRecipeDialect: INVALID_RECIPE_DIALECT,
  inheritedCaseCount: inheritedCaseSkeletons.length,
  pointCaseCount: pointCaseSkeletons.length,
  caseCount: invalidCases.length,
  caseIds,
  inheritedReplayRecipes: inheritedReplayRecords,
  cases: invalidCases,
};
const invalid = {
  ...invalidWithoutDigest,
  semanticContentDigest: semanticDigest(
    INVALID_SEMANTIC_DOMAIN,
    invalidWithoutDigest,
  ),
};

if (
  invalid.inheritedCaseCount !==
    PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INHERITED_CASE_IDS_V1.length ||
  invalid.pointCaseCount !==
    PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_SPECIFIC_CASE_IDS_V1.length ||
  invalid.caseCount !== caseIds.length
) {
  throw new Error("Universe invalid case counts are not length-derived");
}

const check = process.argv.includes("--check");
await writeOrCheck(GOLDEN_RESOURCE_PATH, golden, check);
await writeOrCheck(INVALID_RESOURCE_PATH, invalid, check);
process.stdout.write(
  `${check ? "Verified" : "Generated"} release target Universe point golden (${positiveVectors.length} positive vectors) + ${invalid.inheritedCaseCount} inherited + ${invalid.pointCaseCount} point-specific invalid cases (${invalid.caseCount} total).\n`,
);
