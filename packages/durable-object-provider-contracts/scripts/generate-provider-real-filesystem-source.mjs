import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalizeJcsSafeIntegerUtf8V1 } from "../dist/jcs.js";
import {
  diagnoseProviderRealFilesystemSourceClosureV1,
  validateProviderRealFilesystemSourceClosureV1,
} from "../dist/provider-real-filesystem-source.js";
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
  INVALID_DEFINITIONS,
  INVALID_RECIPE_DIALECT,
  INVALID_RESOURCE_PATH,
  INVALID_SEMANTIC_DOMAIN,
  buildGoldenSourceFixture,
  jsonClone,
  materializeInvalidRequest,
} from "./lib/provider-real-filesystem-source-fixture.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registryGoldenResourcePath =
  "fixtures/v1/golden/provider-registry-entry-manifest-history-v1.json";
const bootstrapGoldenResourcePath =
  "fixtures/v1/golden/provider-bootstrap-structure-crypto-v1.json";
const strictManifestPath = join(
  packageRoot,
  ...PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1.split("/"),
);

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function semanticDigest(domain, value) {
  return `sha256:${sha256Hex(
    canonicalizeJcsSafeIntegerUtf8V1([domain, value]),
  )}`;
}

function canonicalJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(
    await readFile(join(packageRoot, ...relativePath.split("/")), "utf8"),
  );
}

async function writeOrCheck(relativePath, value, check) {
  const path = join(packageRoot, ...relativePath.split("/"));
  const bytes = canonicalJsonBytes(value);
  if (check) {
    const existing = await readFile(path);
    if (!existing.equals(bytes)) {
      throw new Error(`${relativePath} is stale; regenerate fixtures`);
    }
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}

const registryGoldenBytes = await readFile(
  join(packageRoot, ...registryGoldenResourcePath.split("/")),
);
const registryGolden = JSON.parse(registryGoldenBytes.toString("utf8"));
const bootstrapGoldenBytes = await readFile(
  join(packageRoot, ...bootstrapGoldenResourcePath.split("/")),
);
const bootstrapGolden = JSON.parse(bootstrapGoldenBytes.toString("utf8"));
const rootMetadataEnvelope = registryGolden.rootMetadataHistory.at(-1);
const rootSeedHex =
  registryGolden.deterministicSeeds.rootHistoryDependencySeeds
    .compromiseRootSeedHex;
if (rootMetadataEnvelope === undefined || typeof rootSeedHex !== "string") {
  throw new Error("Registry golden is missing current root dependency");
}
const signedPackageVector =
  bootstrapGolden.vectors.signedPackageIdentityDigest;
const distributionRootBinding = {
  profile: "provider_signed_distribution_root_binding_v1",
  signedPackageIdentityDigest: signedPackageVector.expected.contentDigest,
  ...jsonClone(signedPackageVector.fields),
};
const goldenPayload = buildGoldenSourceFixture({
  distributionRootBinding,
  rootMetadataEnvelope,
  rootSeedHex,
});
const goldenWithoutDigest = {
  ...goldenPayload,
  semanticDomain: GOLDEN_SEMANTIC_DOMAIN,
  dependencies: {
    registryGoldenResourcePath,
    registryGoldenResourceByteLength: registryGoldenBytes.byteLength,
    registryGoldenResourceSha256Hex: sha256Hex(registryGoldenBytes),
    bootstrapGoldenResourcePath,
    bootstrapGoldenResourceByteLength: bootstrapGoldenBytes.byteLength,
    bootstrapGoldenResourceSha256Hex: sha256Hex(bootstrapGoldenBytes),
  },
};
const golden = {
  ...goldenWithoutDigest,
  semanticContentDigest: semanticDigest(
    GOLDEN_SEMANTIC_DOMAIN,
    goldenWithoutDigest,
  ),
};

const strictManifestBytes = new Uint8Array(await readFile(strictManifestPath));
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
const goldenValidation = await validateProviderRealFilesystemSourceClosureV1({
  distributionRootBinding: golden.distributionRootBinding,
  activeRootMetadata: golden.activeRootMetadata,
  activeRoot: golden.activeRoot,
  fixtureCorpusManifest: golden.fixtureCorpusManifest,
  suiteManifest: golden.suiteManifest,
  strictCryptoCapability: capability,
});
if (
  goldenValidation.authority !== "none_real_fs_source_structure_only" ||
  goldenValidation.recordCount !== golden.expected.recordCount ||
  goldenValidation.caseCount !== golden.expected.caseCount ||
  goldenValidation.requiredCaseCutCount !==
    golden.expected.requiredCaseCutCount
) {
  throw new Error("generated real filesystem golden failed self-validation");
}

const invalidCases = [];
for (const definition of INVALID_DEFINITIONS) {
  const request = materializeInvalidRequest(
    golden,
    definition.caseId,
    capability,
  );
  const diagnostic = await diagnoseProviderRealFilesystemSourceClosureV1(
    request,
  );
  if (
    diagnostic.ok ||
    diagnostic.stage !== definition.expected.stage ||
    diagnostic.reason !== definition.expected.reason
  ) {
    throw new Error(
      `${definition.caseId} expected ${definition.expected.stage}/${definition.expected.reason}, got ${JSON.stringify(diagnostic)}`,
    );
  }
  const materialized = {
    caseId: definition.caseId,
    distributionRootBinding: request.distributionRootBinding,
    activeRootMetadata: request.activeRootMetadata,
    activeRoot: request.activeRoot,
    fixtureCorpusManifest: request.fixtureCorpusManifest,
    ...(request.suiteManifest === undefined
      ? {}
      : { suiteManifest: request.suiteManifest }),
  };
  invalidCases.push({
    ...definition,
    expected: {
      ...definition.expected,
      publicFailure: {
        errorName:
          "ProviderRealFilesystemSourceClosureValidationError",
        code: "provider_unavailable",
        reason: "attestation_invalid",
      },
      materializedRequestSemanticDigest: semanticDigest(
        "provider-real-fs-source-invalid-materialized-request-v1",
        materialized,
      ),
    },
  });
}
const goldenBytes = canonicalJsonBytes(golden);
const invalidWithoutDigest = {
  schemaVersion: 1,
  profile: "provider_real_fs_source_invalid_v1",
  fixtureAuthority: "none_rejection_only",
  canonicalizationProfile: "rfc8785-jcs-safe-integer-v1",
  verificationProfile: "ed25519-rfc8032-cofactorless-prime-subgroup-v1",
  semanticDomain: INVALID_SEMANTIC_DOMAIN,
  materializedRequestSemanticDomain:
    "provider-real-fs-source-invalid-materialized-request-v1",
  goldenDependency: {
    resourcePath: GOLDEN_RESOURCE_PATH,
    resourceByteLength: goldenBytes.byteLength,
    resourceSha256Hex: sha256Hex(goldenBytes),
    semanticContentDigest: golden.semanticContentDigest,
  },
  mutationRecipeDialect: INVALID_RECIPE_DIALECT,
  caseCount: invalidCases.length,
  caseIds: invalidCases.map(({ caseId }) => caseId),
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
  `${check ? "Verified" : "Generated"} real filesystem source golden + ${invalid.caseCount} invalid cases.\n`,
);
