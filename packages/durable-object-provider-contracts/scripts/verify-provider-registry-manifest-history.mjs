import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalizeJcsSafeIntegerUtf8V1,
} from "../dist/jcs.js";
import {
  validateProviderRegistryManifestHistoryV1,
} from "../dist/provider-registry-manifest-history.js";
import {
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1,
  verifyProviderRegistryManifestHistoryGoldenResourceV1,
} from "../dist/provider-registry-manifest-fixtures.js";
import {
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
  verifyProviderRegistryRootHistoryGoldenManifestResourceV1,
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

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function readPackageResource(relativePath) {
  return new Uint8Array(
    await readFile(join(packageRoot, ...relativePath.split("/"))),
  );
}

function canonicalJsonEqual(left, right) {
  return Buffer.from(
    canonicalizeJcsSafeIntegerUtf8V1(left),
  ).equals(Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(right)));
}

const [strictManifestBytes, rootHistoryBytes, registryHistoryBytes] =
  await Promise.all([
    readPackageResource(
      PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
    ),
    readPackageResource(
      PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
    ),
    readPackageResource(
      PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1,
    ),
  ]);

const rootGolden =
  verifyProviderRegistryRootHistoryGoldenManifestResourceV1(
    rootHistoryBytes,
  );
const registryGolden =
  verifyProviderRegistryManifestHistoryGoldenResourceV1(
    registryHistoryBytes,
  );
if (
  registryGolden.rootHistoryDependency.resourcePath !==
    PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1 ||
  !canonicalJsonEqual(
    registryGolden.bootstrapTrustBundle,
    rootGolden.bootstrapTrustBundle,
  ) ||
  !canonicalJsonEqual(
    registryGolden.rootMetadataHistory,
    rootGolden.rootMetadataHistory,
  ) ||
  !canonicalJsonEqual(
    registryGolden.expected.currentRootMetadata,
    rootGolden.expected.currentRootMetadata,
  )
) {
  throw new Error("Registry fixture root-history dependency mismatch");
}

let pointCalls = 0;
let signatureCalls = 0;
const strictCryptoCapability =
  await attestProviderStrictEd25519CryptoHostV1({
    host: Object.freeze({
      verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
      validatePrimeSubgroupPoint(point) {
        pointCalls += 1;
        return validatePrimeSubgroupPoint(point);
      },
      verifyRawEd25519(publicKey, message, signature) {
        signatureCalls += 1;
        return verifyRawEd25519(publicKey, message, signature);
      },
    }),
    resourceHost: Object.freeze({
      readFixedSignedPackageResource(resourcePath, maxBytes) {
        if (
          resourcePath !==
            PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 ||
          maxBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
        ) {
          throw new Error("unexpected strict Ed25519 manifest request");
        }
        return strictManifestBytes.slice();
      },
    }),
  });

pointCalls = 0;
signatureCalls = 0;
const validation = await validateProviderRegistryManifestHistoryV1({
  installationIdentityGenerationId:
    registryGolden.installationIdentityGenerationId,
  bootstrapTrustBundle: registryGolden.bootstrapTrustBundle,
  rootMetadataHistory: registryGolden.rootMetadataHistory,
  registryManifestHistory: registryGolden.registryManifestHistory,
  strictCryptoCapability,
});
if (
  validation.authority !==
    "none_registry_structure_and_history_only" ||
  validation.authority !== registryGolden.fixtureAuthority ||
  validation.installationIdentityGenerationId !==
    registryGolden.installationIdentityGenerationId ||
  validation.retainedRootMetadataGenerationCount !== 3 ||
  validation.retainedRegistryManifestGenerationCount !==
    registryGolden.expected.registryManifestCount ||
  validation.retainedRootMetadataCanonicalBytes !==
    registryGolden.expected.retainedRootMetadataCanonicalBytes ||
  validation.retainedRegistryManifestCanonicalBytes !==
    registryGolden.expected.retainedRegistryManifestCanonicalBytes ||
  validation.retainedTrustHistoryCanonicalBytes !==
    registryGolden.expected.retainedTrustHistoryCanonicalBytes ||
  !canonicalJsonEqual(
    validation.currentRootMetadata,
    registryGolden.expected.currentRootMetadata,
  ) ||
  !canonicalJsonEqual(
    validation.currentRegistryManifest,
    registryGolden.expected.currentRegistryManifest,
  ) ||
  !canonicalJsonEqual(
    validation.rootMetadataHistory,
    registryGolden.rootMetadataHistory,
  ) ||
  !canonicalJsonEqual(
    validation.registryManifestHistory,
    registryGolden.registryManifestHistory,
  ) ||
  pointCalls !==
    registryGolden.expected.cryptoClosure.postAttestationPointCalls ||
  signatureCalls !==
    registryGolden.expected.cryptoClosure.postAttestationSignatureCalls ||
  pointCalls !== 24 ||
  signatureCalls !== 38
) {
  throw new Error("Registry Manifest history end-to-end verification mismatch");
}

process.stdout.write(
  "Verified 7-generation provider Registry Manifest history, exact root dependency, 24 point admissions, and 38 strict signatures.\n",
);
