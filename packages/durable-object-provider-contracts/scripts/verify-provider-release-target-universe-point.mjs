import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "../dist/jcs.js";
import {
  validateProviderReleaseTargetUniversePointClosureV1,
} from "../dist/provider-release-target-universe-point.js";
import {
  PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
  PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_RESOURCE_PATH_V1,
  executeProviderReleaseTargetUniversePointInvalidCaseV1,
  materializeProviderReleaseTargetUniversePointInvalidCaseWitnessV1,
  verifyProviderReleaseTargetUniversePointGoldenResourceV1,
  verifyProviderReleaseTargetUniversePointInvalidResourceV1,
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
  projectAcceptedSnapshot,
  verifyInheritedReplayRecipesByteIdentical,
} from "./lib/provider-release-target-universe-point-fixture.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readResource = (relativePath) =>
  readFile(join(packageRoot, ...relativePath.split("/")));

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalEqual(left, right) {
  return Buffer.compare(
    Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(left)),
    Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(right)),
  ) === 0;
}

function semanticDigest(domain, value) {
  return `sha256:${createHash("sha256")
    .update(canonicalizeJcsSafeIntegerUtf8V1([domain, value]))
    .digest("hex")}`;
}

function assertOutcome(caseId, expected, outcome) {
  if (outcome.kind === "unexpected_acceptance") {
    throw new Error(`${caseId} was unexpectedly accepted`);
  }
  if (
    outcome.pointAdmissionCount !== expected.pointAdmissionCount ||
    outcome.signatureVerificationCount !== expected.signatureVerificationCount
  ) {
    throw new Error(
      `${caseId} verification count drift: ${JSON.stringify(outcome)}`,
    );
  }
  if (expected.boundary === "snapshot_stability") {
    if (
      outcome.kind !== "snapshot_acceptance" ||
      outcome.authority !== expected.authority ||
      !canonicalEqual(outcome.snapshotProjection, expected.snapshotProjection)
    ) {
      throw new Error(`${caseId} snapshot drift: ${JSON.stringify(outcome)}`);
    }
    return;
  }
  if (
    outcome.kind !== "rejection" ||
    outcome.boundary !== expected.boundary ||
    outcome.stage !== expected.stage ||
    outcome.reason !== expected.reason
  ) {
    throw new Error(`${caseId} rejection drift: ${JSON.stringify(outcome)}`);
  }
  if (
    expected.boundary === "internal_diagnostic" &&
    (
      outcome.publicFailure?.errorName !== expected.publicFailure.errorName ||
      outcome.publicFailure.code !== expected.publicFailure.code ||
      outcome.publicFailure.reason !== expected.publicFailure.reason
    )
  ) {
    throw new Error(`${caseId} public rejection drift`);
  }
}

const strictManifestBytes = new Uint8Array(
  await readResource(PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1),
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

const goldenBytes = new Uint8Array(
  await readResource(
    PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_GOLDEN_RESOURCE_PATH_V1,
  ),
);
const invalidBytes = new Uint8Array(
  await readResource(
    PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_RESOURCE_PATH_V1,
  ),
);
const goldenValidation =
  await verifyProviderReleaseTargetUniversePointGoldenResourceV1(
    goldenBytes,
    capability,
  );
const invalidManifest =
  verifyProviderReleaseTargetUniversePointInvalidResourceV1(invalidBytes);
const goldenManifest = goldenValidation.manifest;

verifyInheritedReplayRecipesByteIdentical(
  goldenManifest.targetDiscoveryPointGolden,
  invalidManifest.inheritedReplayRecipes.map((entry) => entry.replay),
);

for (const vector of goldenManifest.positiveVectors) {
  const beforePoint = pointAdmissionCount;
  const beforeSignature = signatureVerificationCount;
  const closure = await validateProviderReleaseTargetUniversePointClosureV1({
    ...jsonClone(vector.request),
    strictCryptoCapability: capability,
  });
  const pointDelta = pointAdmissionCount - beforePoint;
  const signatureDelta = signatureVerificationCount - beforeSignature;
  if (
    closure.authority !== "none_release_target_universe_structure_only" ||
    pointDelta !== vector.expected.pointAdmissionCount ||
    signatureDelta !== vector.expected.signatureVerificationCount ||
    !canonicalEqual(
      projectAcceptedSnapshot(closure),
      vector.expected.snapshotProjection,
    )
  ) {
    throw new Error(`${vector.vectorId} positive vector drift`);
  }
}

for (const invalidCase of invalidManifest.cases) {
  const witness =
    materializeProviderReleaseTargetUniversePointInvalidCaseWitnessV1(
      goldenManifest,
      invalidManifest,
      invalidCase,
    );
  if (
    semanticDigest(
      PROVIDER_RELEASE_TARGET_UNIVERSE_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
      witness,
    ) !== invalidCase.expected.materializedRequestSemanticDigest
  ) {
    throw new Error(`${invalidCase.caseId} materialized request drift`);
  }
  const outcome =
    await executeProviderReleaseTargetUniversePointInvalidCaseV1(
      goldenManifest,
      invalidManifest,
      invalidCase,
      capability,
      executionCounter,
    );
  if (nextSignatureMutation !== undefined) {
    throw new Error(
      `${invalidCase.caseId} left a signature-time mutation registered`,
    );
  }
  assertOutcome(invalidCase.caseId, invalidCase.expected, outcome);
}

if (
  invalidManifest.caseCount !== invalidManifest.caseIds.length ||
  invalidManifest.caseCount !== invalidManifest.cases.length ||
  invalidManifest.inheritedCaseCount !==
    invalidManifest.inheritedReplayRecipes.length ||
  invalidManifest.inheritedCaseCount + invalidManifest.pointCaseCount !==
    invalidManifest.caseCount
) {
  throw new Error("Universe fixture manifest length-derived counts drift");
}

process.stdout.write(
  `Verified release target Universe point golden (${goldenManifest.positiveVectors.length} genuine Discovery closures, 1 point admission/7 signatures each), exact inherited replay, and ${invalidManifest.caseCount} fresh ordered invalid/executable cases (${invalidManifest.inheritedCaseCount} inherited + ${invalidManifest.pointCaseCount} point-specific) with none-only authority.\n`,
);
