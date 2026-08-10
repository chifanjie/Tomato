import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ProviderFeasibilitySupportCatalogPointClosureValidationError,
  createProviderFeasibilitySupportCatalogSignatureMessageV1,
  deriveProviderFeasibilitySupportCatalogContentDigestV1,
  diagnoseProviderFeasibilitySupportCatalogPointClosureV1,
  validateProviderFeasibilitySupportCatalogPointClosureV1,
} from "../dist/provider-feasibility-support-catalog-point.js";
import {
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_SEMANTIC_DOMAIN_V1,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_RESOURCE_PATH_V1,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_SEMANTIC_DOMAIN_V1,
  deriveProviderFeasibilitySupportCatalogPointFixtureSemanticContentDigestV1,
  projectProviderFeasibilitySupportCatalogPointFixtureClosureV1,
} from "../dist/provider-feasibility-support-catalog-point-fixtures.js";
import {
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
} from "../dist/provider-real-filesystem-source-fixtures.js";
import {
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
} from "../dist/provider-registry-manifest-fixtures.js";
import {
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
} from "../dist/provider-registry-root-history-fixtures.js";
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
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_INVALID_MATERIALIZED_CASE_IDS,
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POSITIVE_VECTOR_IDS,
  buildGoldenProviderFeasibilitySupportCatalogPointFixture,
  buildProviderFeasibilitySupportCatalogInvalidMaterializedRequestCasesFixture,
  jsonClone,
  requestFromGoldenProviderFeasibilitySupportCatalogPositiveVectorFixture,
} from "./lib/provider-feasibility-support-catalog-point-fixture.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.slice(2).includes("--check");

function resourcePath(relativePath) {
  return join(packageRoot, ...relativePath.split("/"));
}

function prettyBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function rawSha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
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

async function readJsonResource(relativePath) {
  const bytes = await readFile(resourcePath(relativePath));
  return {
    bytes,
    value: JSON.parse(bytes.toString("utf8")),
  };
}

async function dependencyAnchor(
  resource,
  expectedByteLength,
  expectedSha256Hex,
  expectedSemanticContentDigest,
) {
  const actualSha256Hex = await rawSha256Hex(resource.bytes);
  if (
    resource.bytes.byteLength !== expectedByteLength ||
    actualSha256Hex !== expectedSha256Hex
  ) {
    throw new Error("Catalog generator dependency anchor drift");
  }
  return {
    resourceByteLength: resource.bytes.byteLength,
    resourceSha256Hex: actualSha256Hex,
    semanticContentDigest: expectedSemanticContentDigest,
  };
}

function requestWithoutCapability(golden, vectorId) {
  const request =
    requestFromGoldenProviderFeasibilitySupportCatalogPositiveVectorFixture(
      golden,
      vectorId,
      undefined,
    );
  delete request.strictCryptoCapability;
  if (Object.keys(request).length !== 17) {
    throw new Error(`${vectorId} did not materialize an exact 17-key request`);
  }
  return jsonClone(request);
}

function requestWithCapability(request, capability) {
  const detached = jsonClone(request);
  detached.strictCryptoCapability = capability;
  if (Object.keys(detached).length !== 18) {
    throw new Error("Catalog generator runtime request is not 18-key exact");
  }
  return detached;
}

function decodeBase64UrlBody(value) {
  if (!value.startsWith("base64url:")) {
    throw new Error("Catalog active root public key encoding drift");
  }
  return new Uint8Array(Buffer.from(value.slice("base64url:".length), "base64url"));
}

function verifyCatalogSignature(envelope, activeRoot) {
  if (
    deriveProviderFeasibilitySupportCatalogContentDigestV1(envelope.payload) !==
    envelope.contentDigest
  ) {
    throw new Error("Catalog envelope content digest drift");
  }
  const parts = envelope.payload.catalogSignature.split(":");
  if (
    parts.length !== 3 ||
    parts[0] !== "provider-support-catalog-ed25519" ||
    parts[1] !== activeRoot.rootKeyId
  ) {
    throw new Error("Catalog signature binding drift");
  }
  const publicKey = decodeBase64UrlBody(activeRoot.publicKeyBytes);
  const signature = new Uint8Array(Buffer.from(parts[2], "hex"));
  const message = createProviderFeasibilitySupportCatalogSignatureMessageV1(
    envelope.payload,
    activeRoot.rootKeyId,
  );
  if (
    !validatePrimeSubgroupPoint(publicKey) ||
    !verifyRawEd25519(publicKey, message, signature)
  ) {
    throw new Error("Catalog signature did not pass strict verification");
  }
}

const rootHistory = await readJsonResource(
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
);
const registryManifest = await readJsonResource(
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1,
);
const realFilesystemSource = await readJsonResource(
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_PATH_V1,
);
const rootAnchor = await dependencyAnchor(
  rootHistory,
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
);
const registryAnchor = await dependencyAnchor(
  registryManifest,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
);
const sourceAnchor = await dependencyAnchor(
  realFilesystemSource,
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_SHA256_HEX_V1,
  PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_SEMANTIC_CONTENT_DIGEST_V1,
);

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

const builtGolden =
  buildGoldenProviderFeasibilitySupportCatalogPointFixture({
    rootGolden: rootHistory.value,
    registryGolden: registryManifest.value,
    sourceGolden: realFilesystemSource.value,
  });
if (
  builtGolden.releaseTargetUniverse.payload.targets.length !== 2 ||
  builtGolden.releaseTargetUniverse.payload.buckets.length !== 1 ||
  builtGolden.positiveVectors.length !== 4
) {
  throw new Error("Catalog generator golden cardinality drift");
}

const positiveVectors = [];
for (const vectorId of PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POSITIVE_VECTOR_IDS) {
  const builtVector = builtGolden.positiveVectors.find(
    (candidate) => candidate.vectorId === vectorId,
  );
  if (builtVector === undefined) {
    throw new Error(`missing built Catalog vector ${vectorId}`);
  }
  const request = requestWithoutCapability(builtGolden, vectorId);
  verifyCatalogSignature(
    request.providerFeasibilitySupportCatalog,
    request.activeRoot,
  );
  const beforePoint = pointAdmissionCount;
  const beforeSignature = signatureVerificationCount;
  const closure =
    await validateProviderFeasibilitySupportCatalogPointClosureV1(
      requestWithCapability(request, capability),
    );
  const cryptoCounts = {
    pointAdmissionCount: pointAdmissionCount - beforePoint,
    signatureVerificationCount:
      signatureVerificationCount - beforeSignature,
  };
  const projection =
    projectProviderFeasibilitySupportCatalogPointFixtureClosureV1(closure);
  if (
    closure.authority !==
      "none_provider_feasibility_support_catalog_structure_only" ||
    closure.targetCount !== 2 ||
    closure.candidateCount !== 2 ||
    closure.publicSupportRowCount !== 1 ||
    JSON.stringify(projection.ownerTargetCapabilities) !==
      JSON.stringify(builtVector.expected.ownerTargetCapabilities) ||
    JSON.stringify(projection.publicSupport) !==
      JSON.stringify(builtVector.expected.publicSupport)
  ) {
    throw new Error(`${vectorId} positive projection drift`);
  }
  positiveVectors.push({
    vectorId,
    request,
    expected: {
      projection,
      cryptoCounts,
    },
  });
}

const goldenWithoutDigest = {
  schemaVersion: 1,
  profile: "provider_feasibility_support_catalog_point_golden_v1",
  fixtureAuthority:
    "none_provider_feasibility_support_catalog_structure_only",
  canonicalizationProfile: "rfc8785-jcs-safe-integer-v1",
  verificationProfile:
    "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
  positiveVectors,
  semanticDomain:
    PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_SEMANTIC_DOMAIN_V1,
  dependencies: {
    rootHistoryGolden: {
      resourcePath: PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
      ...rootAnchor,
    },
    registryManifestGolden: {
      resourcePath:
        PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1,
      ...registryAnchor,
    },
    realFilesystemSourceGolden: {
      resourcePath: PROVIDER_REAL_FILESYSTEM_SOURCE_GOLDEN_RESOURCE_PATH_V1,
      ...sourceAnchor,
    },
  },
};
const golden = {
  ...goldenWithoutDigest,
  semanticContentDigest:
    deriveProviderFeasibilitySupportCatalogPointFixtureSemanticContentDigestV1(
      PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_SEMANTIC_DOMAIN_V1,
      goldenWithoutDigest,
    ),
};
const goldenBytes = prettyBytes(golden);
const goldenSha256Hex = await rawSha256Hex(goldenBytes);

const builtInvalidCases =
  buildProviderFeasibilitySupportCatalogInvalidMaterializedRequestCasesFixture(
    builtGolden,
  );
if (
  builtInvalidCases.length !== 7 ||
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_INVALID_MATERIALIZED_CASE_IDS.length !==
    7
) {
  throw new Error("Catalog invalid case inventory drift");
}
const invalidCases = [];
for (let index = 0; index < builtInvalidCases.length; index += 1) {
  const builtCase = builtInvalidCases[index];
  const expectedCaseId =
    PROVIDER_FEASIBILITY_SUPPORT_CATALOG_INVALID_MATERIALIZED_CASE_IDS[index];
  if (builtCase.caseId !== expectedCaseId) {
    throw new Error(`Catalog invalid case order drift at ${index}`);
  }
  verifyCatalogSignature(
    builtCase.request.providerFeasibilitySupportCatalog,
    builtCase.request.activeRoot,
  );
  const materializedRequestSemanticDigest =
    deriveProviderFeasibilitySupportCatalogPointFixtureSemanticContentDigestV1(
      PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
      builtCase.request,
    );
  const beforePoint = pointAdmissionCount;
  const beforeSignature = signatureVerificationCount;
  const diagnostic =
    await diagnoseProviderFeasibilitySupportCatalogPointClosureV1(
      requestWithCapability(builtCase.request, capability),
    );
  if (
    diagnostic.ok ||
    diagnostic.stage !== builtCase.expected.stage ||
    diagnostic.reason !== builtCase.expected.reason
  ) {
    throw new Error(`${builtCase.caseId} diagnostic drift`);
  }
  let publicError;
  try {
    await validateProviderFeasibilitySupportCatalogPointClosureV1(
      requestWithCapability(builtCase.request, capability),
    );
  } catch (error) {
    publicError = error;
  }
  if (
    !(publicError instanceof
      ProviderFeasibilitySupportCatalogPointClosureValidationError) ||
    publicError.name !==
      "ProviderFeasibilitySupportCatalogPointClosureValidationError" ||
    publicError.code !== "provider_unavailable" ||
    publicError.reason !== "attestation_invalid"
  ) {
    throw new Error(`${builtCase.caseId} public rejection drift`);
  }
  invalidCases.push({
    caseId: builtCase.caseId,
    request: jsonClone(builtCase.request),
    expected: {
      stage: diagnostic.stage,
      reason: diagnostic.reason,
      publicFailure: {
        errorName: publicError.name,
        code: publicError.code,
        reason: publicError.reason,
      },
      cryptoCounts: {
        pointAdmissionCount: pointAdmissionCount - beforePoint,
        signatureVerificationCount:
          signatureVerificationCount - beforeSignature,
      },
      materializedRequestSemanticDigest,
    },
  });
}

const invalidWithoutDigest = {
  schemaVersion: 1,
  profile: "provider_feasibility_support_catalog_point_invalid_v1",
  fixtureAuthority:
    "none_provider_feasibility_support_catalog_structure_only",
  canonicalizationProfile: "rfc8785-jcs-safe-integer-v1",
  verificationProfile:
    "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
  cases: invalidCases,
  semanticDomain:
    PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_SEMANTIC_DOMAIN_V1,
  dependencies: {
    goldenResourcePath:
      PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_PATH_V1,
    goldenResourceByteLength: goldenBytes.byteLength,
    goldenResourceSha256Hex: goldenSha256Hex,
    goldenSemanticContentDigest: golden.semanticContentDigest,
  },
  materializedRequestDomain:
    PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_MATERIALIZED_REQUEST_DOMAIN_V1,
};
const invalid = {
  ...invalidWithoutDigest,
  semanticContentDigest:
    deriveProviderFeasibilitySupportCatalogPointFixtureSemanticContentDigestV1(
      PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_SEMANTIC_DOMAIN_V1,
      invalidWithoutDigest,
    ),
};
const invalidBytes = prettyBytes(invalid);

await writeOrCheck(
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_GOLDEN_RESOURCE_PATH_V1,
  goldenBytes,
);
await writeOrCheck(
  PROVIDER_FEASIBILITY_SUPPORT_CATALOG_POINT_INVALID_RESOURCE_PATH_V1,
  invalidBytes,
);

process.stdout.write(
  `${check ? "verified" : "generated"} Catalog point fixtures ` +
    `(golden=${goldenBytes.byteLength}/${goldenSha256Hex}, ` +
    `invalid=${invalidBytes.byteLength}/${await rawSha256Hex(invalidBytes)}, ` +
    `positiveCounts=${JSON.stringify(
      positiveVectors.map((vector) => vector.expected.cryptoCounts),
    )}, invalidCounts=${JSON.stringify(
      invalidCases.map((invalidCase) => invalidCase.expected.cryptoCounts),
    )})\n`,
);
