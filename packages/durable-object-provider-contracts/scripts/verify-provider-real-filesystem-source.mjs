import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "../dist/jcs.js";
import {
  ProviderRealFilesystemSourceClosureValidationError,
  diagnoseProviderRealFilesystemSourceClosureV1,
  validateProviderRealFilesystemSourceClosureV1,
} from "../dist/provider-real-filesystem-source.js";
import {
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
  PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_RESOURCE_PATH_V1,
  verifyProviderRealFilesystemSourceGoldenResourceV1,
  verifyProviderRealFilesystemSourceInvalidResourceV1,
} from "../dist/provider-real-filesystem-source-fixtures.js";
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
  materializeInvalidRequest,
} from "./lib/provider-real-filesystem-source-fixture.mjs";

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
      ) {
        throw new Error("unexpected strict manifest request");
      }
      return strictManifestBytes;
    },
  }),
});
const goldenBytes = new Uint8Array(
  await readResource(PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_PATH_V1),
);
const invalidBytes = new Uint8Array(
  await readResource(PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_RESOURCE_PATH_V1),
);
const goldenValidation =
  await verifyProviderRealFilesystemSourceGoldenResourceV1(
    goldenBytes,
    capability,
  );
const invalidManifest =
  verifyProviderRealFilesystemSourceInvalidResourceV1(invalidBytes);

function semanticDigest(domain, value) {
  return `sha256:${createHash("sha256")
    .update(canonicalizeJcsSafeIntegerUtf8V1([domain, value]))
    .digest("hex")}`;
}

for (const invalidCase of invalidManifest.cases) {
  const request = materializeInvalidRequest(
    goldenValidation.manifest,
    invalidCase.caseId,
    capability,
  );
  const diagnostic = await diagnoseProviderRealFilesystemSourceClosureV1(
    request,
  );
  if (
    diagnostic.ok ||
    diagnostic.stage !== invalidCase.expected.stage ||
    diagnostic.reason !== invalidCase.expected.reason
  ) {
    throw new Error(
      `${invalidCase.caseId} diagnostic drift: ${JSON.stringify(diagnostic)}`,
    );
  }
  const materialized = {
    caseId: invalidCase.caseId,
    distributionRootBinding: request.distributionRootBinding,
    activeRootMetadata: request.activeRootMetadata,
    activeRoot: request.activeRoot,
    fixtureCorpusManifest: request.fixtureCorpusManifest,
    ...(request.suiteManifest === undefined
      ? {}
      : { suiteManifest: request.suiteManifest }),
  };
  if (
    semanticDigest(
      PROVIDER_REAL_FILESYSTEM_SOURCE_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
      materialized,
    ) !== invalidCase.expected.materializedRequestSemanticDigest
  ) {
    throw new Error(`${invalidCase.caseId} materialized request drift`);
  }
  try {
    await validateProviderRealFilesystemSourceClosureV1(request);
  } catch (error) {
    if (
      error instanceof ProviderRealFilesystemSourceClosureValidationError &&
      error.code === "provider_unavailable" &&
      error.reason === invalidCase.expected.publicFailureReason
    ) {
      continue;
    }
    throw new Error(`${invalidCase.caseId} public rejection drift`, {
      cause: error,
    });
  }
  throw new Error(`${invalidCase.caseId} was unexpectedly accepted`);
}

process.stdout.write(
  `Verified signed real filesystem source golden (${goldenValidation.sourceClosure.recordCount} records/${goldenValidation.sourceClosure.caseCount} cases/${goldenValidation.sourceClosure.requiredCaseCutCount} cuts) and ${invalidManifest.caseCount} invalid cases with none-only authority.\n`,
);
