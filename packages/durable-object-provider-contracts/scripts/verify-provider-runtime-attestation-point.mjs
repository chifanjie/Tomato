import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "../dist/jcs.js";
import {
  PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
  PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RESOURCE_PATH_V1,
  executeProviderRuntimeAttestationPointInvalidCaseV1,
  materializeProviderRuntimeAttestationPointInvalidRequestWitnessV1,
  verifyProviderRuntimeAttestationPointGoldenResourceV1,
  verifyProviderRuntimeAttestationPointInvalidResourceV1,
} from "../dist/provider-runtime-attestation-point-fixtures.js";
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
      ) {
        throw new Error("unexpected strict manifest request");
      }
      return strictManifestBytes;
    },
  }),
});

pointCalls = 0;
verifyCalls = 0;
const goldenValidation =
  await verifyProviderRuntimeAttestationPointGoldenResourceV1(
    new Uint8Array(
      await readResource(
        PROVIDER_RUNTIME_ATTESTATION_POINT_GOLDEN_RESOURCE_PATH_V1,
      ),
    ),
    capability,
  );
if (
  pointCalls !==
    goldenValidation.manifest.expected.activeRootPointAdmissionCount ||
  verifyCalls !== goldenValidation.manifest.expected.signatureVerificationCount
) {
  throw new Error(
    `runtime attestation point golden crypto count drift: ${pointCalls}/${verifyCalls}`,
  );
}

const invalid = verifyProviderRuntimeAttestationPointInvalidResourceV1(
  new Uint8Array(
    await readResource(
      PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_RESOURCE_PATH_V1,
    ),
  ),
);

function semanticDigest(domain, value) {
  return `sha256:${createHash("sha256")
    .update(canonicalizeJcsSafeIntegerUtf8V1([domain, value]))
    .digest("hex")}`;
}

for (const [index, invalidCase] of invalid.cases.entries()) {
  if (
    invalidCase.caseId !== invalid.caseIds[index] ||
    invalidCase.mutation.operation !== invalidCase.caseId
  ) {
    throw new Error(`${invalidCase.caseId} mutation operation or inventory order drift`);
  }
  const materialized =
    materializeProviderRuntimeAttestationPointInvalidRequestWitnessV1(
      goldenValidation.manifest,
      invalidCase,
    );
  if (
    semanticDigest(
      PROVIDER_RUNTIME_ATTESTATION_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
      materialized,
    ) !== invalidCase.expected.materializedRequestSemanticDigest
  ) {
    throw new Error(`${invalidCase.caseId} materialized request drift`);
  }
  pointCalls = 0;
  verifyCalls = 0;
  const outcome = await executeProviderRuntimeAttestationPointInvalidCaseV1(
    goldenValidation.manifest,
    invalidCase,
    capability,
  );
  if (
    pointCalls !== invalidCase.expected.pointAdmissionCount ||
    verifyCalls !== invalidCase.expected.signatureVerificationCount
  ) {
    throw new Error(
      `${invalidCase.caseId} crypto count drift: ${pointCalls}/${verifyCalls}`,
    );
  }
  if (invalidCase.expected.boundary === "snapshot_stability") {
    if (
      outcome.kind !== "snapshot_acceptance" ||
      outcome.authority !== invalidCase.expected.authority ||
      JSON.stringify(outcome.snapshotProjection) !==
        JSON.stringify(invalidCase.expected.snapshotProjection)
    ) {
      throw new Error(
        `${invalidCase.caseId} snapshot drift: ${JSON.stringify(outcome)}`,
      );
    }
    continue;
  }
  if (
    outcome.kind !== "rejection" ||
    outcome.boundary !== "internal_diagnostic" ||
    outcome.stage !== invalidCase.expected.stage ||
    outcome.reason !== invalidCase.expected.reason ||
    outcome.publicFailure?.errorName !==
      invalidCase.expected.publicFailure.errorName ||
    outcome.publicFailure.code !== invalidCase.expected.publicFailure.code ||
    outcome.publicFailure.reason !== invalidCase.expected.publicFailure.reason
  ) {
    throw new Error(
      `${invalidCase.caseId} rejection drift: ${JSON.stringify(outcome)}`,
    );
  }
}

if (
  goldenValidation.authority !==
    "none_provider_runtime_attestation_structure_only" ||
  goldenValidation.pointClosure.conformanceResultClosure.authority !==
    "none_real_fs_conformance_result_structure_only" ||
  invalid.innerCaseCount !== 50 ||
  invalid.innerCaseCount + invalid.pointCaseCount !== invalid.caseCount
) {
  throw new Error("runtime attestation point authority or inventory widened");
}

process.stdout.write(
  `Verified provider runtime attestation point golden (exact one point/seven signatures) and ${invalid.caseCount} ordered executable cases (${invalid.innerCaseCount} inherited + ${invalid.pointCaseCount} point-specific) with none-only authority.\n`,
);
