import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "../dist/jcs.js";
import {
  PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_MAX_CANONICAL_BYTES_V1,
} from "../dist/provider-real-filesystem-conformance-result.js";
import {
  PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
  PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_RESOURCE_PATH_V1,
  verifyProviderRealFilesystemConformanceResultGoldenResourceV1,
  verifyProviderRealFilesystemConformanceResultInvalidResourceV1,
} from "../dist/provider-real-filesystem-conformance-result-fixtures.js";
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
  executeProviderRealFilesystemConformanceResultInvalidCase,
  materializeInvalidRequestWitness,
} from "./lib/provider-real-filesystem-conformance-result-fixture.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readResource = (relativePath) =>
  readFile(join(packageRoot, ...relativePath.split("/")));
const strictManifestBytes = new Uint8Array(
  await readResource(PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1),
);
let pointCalls = 0;
let verifyCalls = 0;
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
const goldenValidation =
  await verifyProviderRealFilesystemConformanceResultGoldenResourceV1(
    new Uint8Array(
      await readResource(
        PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_GOLDEN_RESOURCE_PATH_V1,
      ),
    ),
    capability,
  );
if (
  pointCalls !== goldenValidation.manifest.expected.activeRootPointAdmissionCount ||
  verifyCalls !== goldenValidation.manifest.expected.signatureVerificationCount
) throw new Error("conformance result golden crypto operation count drift");

const invalidManifest =
  verifyProviderRealFilesystemConformanceResultInvalidResourceV1(
    new Uint8Array(
      await readResource(
        PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_RESOURCE_PATH_V1,
      ),
    ),
  );
function semanticDigest(domain, value) {
  return `sha256:${createHash("sha256")
    .update(canonicalizeJcsSafeIntegerUtf8V1([domain, value]))
    .digest("hex")}`;
}
for (const [index, invalidCase] of invalidManifest.cases.entries()) {
  if (
    invalidCase.caseId !== invalidManifest.caseIds[index] ||
    invalidCase.mutation.operation !== invalidCase.caseId
  ) throw new Error(`${invalidCase.caseId} mutation operation or inventory order drift`);
  const materialized = materializeInvalidRequestWitness(
    goldenValidation.manifest,
    invalidCase.mutation.operation,
  );
  if (invalidCase.caseId === "result-envelope-16mib-plus-one") {
    const byteLength = canonicalizeJcsSafeIntegerUtf8V1(
      materialized?.request?.realFilesystemConformanceResult,
    ).byteLength;
    if (
      byteLength !==
      PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_MAX_CANONICAL_BYTES_V1 + 1
    ) throw new Error(`${invalidCase.caseId} is ${byteLength} bytes instead of exact MAX+1`);
  }
  if (
    semanticDigest(
      PROVIDER_REAL_FILESYSTEM_CONFORMANCE_RESULT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
      materialized,
    ) !== invalidCase.expected.materializedRequestSemanticDigest
  ) throw new Error(`${invalidCase.caseId} materialized request drift`);
  const outcome =
    await executeProviderRealFilesystemConformanceResultInvalidCase(
      goldenValidation.manifest,
      invalidCase.mutation.operation,
      capability,
    );
  if (invalidCase.expected.boundary === "snapshot_stability") {
    if (
      outcome.kind !== "snapshot_acceptance" ||
      outcome.authority !== invalidCase.expected.authority ||
      outcome.caseResultCount !== invalidCase.expected.caseResultCount ||
      outcome.passedCaseResultCount !== invalidCase.expected.passedCaseResultCount
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

if (
  goldenValidation.resultClosure.authority !==
    "none_real_fs_conformance_result_structure_only" ||
  goldenValidation.manifest.expected.resultSignatureCount !== 0 ||
  goldenValidation.resultClosure.targetDiscoveryPoint.authority !==
    "none_target_discovery_point_structure_only"
) throw new Error("conformance result authority widened");
process.stdout.write(
  `Verified real filesystem conformance result golden (${goldenValidation.resultClosure.caseResultCount} case/cut results, exact one point/six signatures/no seventh signature/Locator-only path) and ${invalidManifest.caseCount} ordered executable cases with none-only authority.\n`,
);
