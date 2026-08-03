import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "../dist/jcs.js";
import { validateProviderTargetDiscoveryPointClosureV1 } from "../dist/provider-target-discovery-point.js";
import {
  PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_TARGET_DISCOVERY_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
  PROVIDER_TARGET_DISCOVERY_POINT_INVALID_RESOURCE_PATH_V1,
  verifyProviderTargetDiscoveryPointGoldenResourceV1,
  verifyProviderTargetDiscoveryPointInvalidResourceV1,
} from "../dist/provider-target-discovery-point-fixtures.js";
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
  buildGoldenTargetDiscoveryPointFixture,
  executeProviderTargetDiscoveryInvalidCase,
  materializeInvalidRequestWitness,
} from "./lib/provider-target-discovery-point-fixture.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readResource = (relativePath) =>
  readFile(join(packageRoot, ...relativePath.split("/")));
const strictManifestBytes = new Uint8Array(
  await readResource(PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1),
);
const capability = await attestProviderStrictEd25519CryptoHostV1({
  host: Object.freeze({
    verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
    validatePrimeSubgroupPoint,
    verifyRawEd25519,
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
const goldenValidation = await verifyProviderTargetDiscoveryPointGoldenResourceV1(
  new Uint8Array(await readResource(PROVIDER_TARGET_DISCOVERY_POINT_GOLDEN_RESOURCE_PATH_V1)),
  capability,
);
const invalidManifest = verifyProviderTargetDiscoveryPointInvalidResourceV1(
  new Uint8Array(await readResource(PROVIDER_TARGET_DISCOVERY_POINT_INVALID_RESOURCE_PATH_V1)),
);
function semanticDigest(domain, value) {
  return `sha256:${createHash("sha256")
    .update(canonicalizeJcsSafeIntegerUtf8V1([domain, value]))
    .digest("hex")}`;
}
for (const invalidCase of invalidManifest.cases) {
  const materialized = materializeInvalidRequestWitness(
    goldenValidation.manifest,
    invalidCase.caseId,
  );
  if (
    semanticDigest(
      PROVIDER_TARGET_DISCOVERY_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
      materialized,
    ) !== invalidCase.expected.materializedRequestSemanticDigest
  ) throw new Error(`${invalidCase.caseId} materialized request drift`);
  const outcome = await executeProviderTargetDiscoveryInvalidCase(
    goldenValidation.manifest,
    invalidCase.caseId,
    capability,
  );
  if (invalidCase.expected.boundary === "snapshot_stability") {
    if (
      outcome.kind !== "snapshot_acceptance" ||
      outcome.authority !== invalidCase.expected.authority ||
      outcome.observationCount !== invalidCase.expected.observationCount ||
      outcome.targetCount !== invalidCase.expected.targetCount ||
      outcome.unresolvedObservationCount !== invalidCase.expected.unresolvedObservationCount
    ) throw new Error(`${invalidCase.caseId} snapshot drift: ${JSON.stringify(outcome)}`);
    continue;
  }
  if (
    outcome.kind !== "rejection" ||
    outcome.boundary !== invalidCase.expected.boundary ||
    outcome.stage !== invalidCase.expected.stage ||
    outcome.reason !== invalidCase.expected.reason
  ) throw new Error(`${invalidCase.caseId} rejection drift: ${JSON.stringify(outcome)}`);
  if (
    invalidCase.expected.boundary === "internal_diagnostic" &&
    (
      outcome.publicFailure?.errorName !== invalidCase.expected.publicFailure.errorName ||
      outcome.publicFailure.code !== invalidCase.expected.publicFailure.code ||
      outcome.publicFailure.reason !== invalidCase.expected.publicFailure.reason
    )
  ) throw new Error(`${invalidCase.caseId} public rejection drift`);
}

const typedUnresolvedReasons = goldenValidation.manifest.targetDiscoveryResult.payload
  .unresolvedObservations.map((entry) => entry.reason);
if (
  typedUnresolvedReasons.length !== 2 ||
  !typedUnresolvedReasons.includes("taxonomy_mapping_unresolved") ||
  !typedUnresolvedReasons.includes("observation_source_unavailable")
) throw new Error("typed unresolved golden projection drift");

const emptySourceFixture = buildGoldenTargetDiscoveryPointFixture(
  goldenValidation.manifest,
  { emptyObservationManifests: true },
);
const emptyClosure = await validateProviderTargetDiscoveryPointClosureV1({
  distributionRootBinding: emptySourceFixture.distributionRootBinding,
  activeRootMetadata: emptySourceFixture.activeRootMetadata,
  activeRoot: emptySourceFixture.activeRoot,
  fixtureCorpusManifest: emptySourceFixture.fixtureCorpusManifest,
  suiteManifest: emptySourceFixture.suiteManifest,
  publicSupportTaxonomy: emptySourceFixture.publicSupportTaxonomy,
  releaseMatrix: emptySourceFixture.releaseMatrix,
  targetDiscoveryFixtureManifest: emptySourceFixture.targetDiscoveryFixtureManifest,
  targetDiscoveryRunnerRun: emptySourceFixture.targetDiscoveryRunnerRun,
  targetDiscoveryResult: emptySourceFixture.targetDiscoveryResult,
  strictCryptoCapability: capability,
});
if (
  emptySourceFixture.targetDiscoveryFixtureManifest.payload.targetRecordCount !== 0 ||
  emptySourceFixture.targetDiscoveryRunnerRun.payload.targetRecordCount !== 0 ||
  emptyClosure.authority !== "none_target_discovery_point_structure_only" ||
  emptyClosure.observationCount !== 2 ||
  emptyClosure.targetCount !== 2 ||
  emptyClosure.unresolvedObservationCount !== 0
) throw new Error("canonical empty Fixture/Runner observation closure drift");
process.stdout.write(
  `Verified target discovery point golden (${goldenValidation.pointClosure.observationCount} observations/${goldenValidation.pointClosure.targetCount} targets/${goldenValidation.pointClosure.unresolvedObservationCount} unresolved, exact five locators/six signatures), canonical empty Fixture/Runner closure, and ${invalidManifest.caseCount} ordered invalid/executable cases with none-only authority.\n`,
);
