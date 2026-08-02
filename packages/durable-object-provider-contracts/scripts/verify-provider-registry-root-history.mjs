import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalizeJcsSafeIntegerUtf8V1,
} from "../dist/jcs.js";
import {
  buildProviderRegistryRootMetadataRelativePathV1,
} from "../dist/provider-fixed-locator.js";
import {
  ProviderRegistryRootHistoryValidationError,
  createProviderRegistryRootCrossSignatureMessageV1,
  createProviderRegistryRootRecoverySignatureMessageV1,
  diagnoseProviderRegistryRootMetadataHistoryInternalV1,
  validateProviderRegistryRootMetadataHistoryV1,
} from "../dist/provider-registry-root-history.js";
import {
  PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_RESOURCE_PATH_V1,
  verifyProviderRegistryRootHistoryGoldenManifestResourceV1,
  verifyProviderRegistryRootHistoryInvalidManifestResourceV1,
} from "../dist/provider-registry-root-history-fixtures.js";
import {
  createProviderRegistryRootSelfSignatureMessageV1,
  deriveProviderRegistryRootMetadataContentDigestV1,
  projectProviderRegistryRootMetadataUnsignedClaimsV1,
} from "../dist/provider-registry-trust.js";
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
  materializeProviderRootHistoryInvalidCandidateV1,
} from "./lib/provider-root-history-invalid-runner.mjs";

const packageRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);

async function readPackageResource(relativePath) {
  return new Uint8Array(
    await readFile(join(packageRoot, ...relativePath.split("/"))),
  );
}

function hex(bytes) {
  return Buffer.from(bytes).toString("hex");
}

function canonicalJsonEqual(left, right) {
  return Buffer.from(
    canonicalizeJcsSafeIntegerUtf8V1(left),
  ).equals(
    Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(right)),
  );
}

const [
  strictManifestBytes,
  goldenBytes,
  invalidBytes,
] = await Promise.all([
  readPackageResource(
    PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  ),
  readPackageResource(
    PROVIDER_REGISTRY_ROOT_HISTORY_GOLDEN_RESOURCE_PATH_V1,
  ),
  readPackageResource(
    PROVIDER_REGISTRY_ROOT_HISTORY_INVALID_RESOURCE_PATH_V1,
  ),
]);

let pointCalls = 0;
let signatureCalls = 0;
const strictCapability =
  await attestProviderStrictEd25519CryptoHostV1({
    host: Object.freeze({
      verificationProfile:
        STRICT_ED25519_VERIFICATION_PROFILE_V1,
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
          maxBytes !==
            PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
        ) {
          throw new Error("unexpected strict manifest request");
        }
        return strictManifestBytes;
      },
    }),
  });

const golden =
  verifyProviderRegistryRootHistoryGoldenManifestResourceV1(
    goldenBytes,
  );
const invalid =
  verifyProviderRegistryRootHistoryInvalidManifestResourceV1(
    invalidBytes,
  );
if (
  golden.rootMetadataHistory.length !== 3 ||
  invalid.cases.length !== 31
) {
  throw new Error("root history fixture coverage mismatch");
}

pointCalls = 0;
signatureCalls = 0;
const validation =
  await validateProviderRegistryRootMetadataHistoryV1({
    bootstrapTrustBundle: golden.bootstrapTrustBundle,
    rootMetadataHistory: golden.rootMetadataHistory,
    strictCryptoCapability: strictCapability,
  });
if (
  validation.authority !==
    "none_structure_and_history_only" ||
  validation.retainedRootMetadataGenerationCount !==
    golden.expected.rootMetadataCount ||
  validation.retainedRootMetadataCanonicalBytes !==
    golden.expected.canonicalEnvelopeLogicalBytes ||
  !canonicalJsonEqual(
    validation.currentRootMetadata,
    golden.expected.currentRootMetadata,
  ) ||
  pointCalls !== 11 ||
  signatureCalls !== 9
) {
  throw new Error("root history chain verification mismatch");
}

for (
  let index = 0;
  index < golden.rootMetadataHistory.length;
  index += 1
) {
  const envelope = golden.rootMetadataHistory[index];
  const vector = golden.expected.vectors[index];
  if (
    envelope === undefined ||
    vector === undefined ||
    envelope.rootGeneration !== vector.rootGeneration ||
    envelope.payload.activation !== vector.activation ||
    deriveProviderRegistryRootMetadataContentDigestV1(
      envelope.payload,
    ) !== vector.contentDigest ||
    hex(canonicalizeJcsSafeIntegerUtf8V1(envelope)) !==
      vector.envelopeCanonicalUtf8Hex ||
    hex(
      canonicalizeJcsSafeIntegerUtf8V1(
        projectProviderRegistryRootMetadataUnsignedClaimsV1(
          envelope.payload,
        ),
      ),
    ) !== vector.unsignedClaimsCanonicalUtf8Hex ||
    hex(
      createProviderRegistryRootSelfSignatureMessageV1(
        envelope.payload,
      ),
    ) !== vector.selfSignatureMessageUtf8Hex ||
    buildProviderRegistryRootMetadataRelativePathV1({
      locatorProfile:
        "installation_provider_registry_root_metadata_v1",
      rootGeneration: envelope.rootGeneration,
      rootKeyId: envelope.rootKeyId,
    }) !== vector.locator
  ) {
    throw new Error(
      `root history generation ${index + 1} golden mismatch`,
    );
  }

  if (envelope.payload.activation === "planned_rollover") {
    if (
      vector.activation !== "planned_rollover" ||
      hex(
        createProviderRegistryRootCrossSignatureMessageV1(
          envelope.payload,
        ),
      ) !== vector.predecessorCrossSignatureMessageUtf8Hex
    ) {
      throw new Error("planned rollover cross message mismatch");
    }
  }
  if (envelope.payload.activation !== "bootstrap") {
    if (
      vector.activation === "bootstrap" ||
      vector.recoverySignatureMessages.length !== 2
    ) {
      throw new Error("root recovery vector branch mismatch");
    }
    for (
      let recoveryIndex = 0;
      recoveryIndex <
      vector.recoverySignatureMessages.length;
      recoveryIndex += 1
    ) {
      const recoveryVector =
        vector.recoverySignatureMessages[recoveryIndex];
      if (
        recoveryVector === undefined ||
        hex(
          createProviderRegistryRootRecoverySignatureMessageV1(
            envelope.payload,
            recoveryVector.recoveryKeyId,
          ),
        ) !== recoveryVector.canonicalMessageUtf8Hex
      ) {
        throw new Error(
          `root recovery message ${index}:${recoveryIndex} mismatch`,
        );
      }
    }
  }
}

const observedInvalidCounts = [];
for (const invalidCase of invalid.cases) {
  const candidate =
    materializeProviderRootHistoryInvalidCandidateV1(
      golden,
      invalidCase,
    );
  const request = {
    ...candidate,
    strictCryptoCapability: strictCapability,
  };
  pointCalls = 0;
  signatureCalls = 0;
  const diagnostic =
    await diagnoseProviderRegistryRootMetadataHistoryInternalV1(
      request,
    );
  const observedPointCalls = pointCalls;
  const observedSignatureCalls = signatureCalls;
  observedInvalidCounts.push({
    caseId: invalidCase.caseId,
    pointCalls: observedPointCalls,
    signatureCalls: observedSignatureCalls,
    diagnostic,
  });
  if (
    diagnostic.ok ||
    diagnostic.stage !== invalidCase.expected.stage ||
    diagnostic.reason !== invalidCase.expected.reason
  ) {
    throw new Error(
      `root history invalid case ${invalidCase.caseId} returned ${JSON.stringify(diagnostic)}`,
    );
  }
  if (
    !process.argv.includes("--report-counts") &&
    (observedPointCalls !==
      invalidCase.expected.postAttestationPointCalls ||
      observedSignatureCalls !==
        invalidCase.expected.postAttestationSignatureCalls)
  ) {
    throw new Error(
      `root history invalid case ${invalidCase.caseId} call count mismatch: ${observedPointCalls}/${observedSignatureCalls}`,
    );
  }

  let publicError;
  try {
    await validateProviderRegistryRootMetadataHistoryV1(request);
  } catch (error) {
    publicError = error;
  }
  if (
    !(publicError instanceof
      ProviderRegistryRootHistoryValidationError) ||
    publicError.code !== "provider_unavailable" ||
    publicError.reason !==
      invalidCase.expected.publicFailureReason ||
    JSON.stringify(publicError).includes("provider/root-metadata") ||
    JSON.stringify(publicError).includes(
      "provider-root-self-ed25519",
    )
  ) {
    throw new Error(
      `root history invalid case ${invalidCase.caseId} leaked or changed its public error`,
    );
  }
}

if (process.argv.includes("--report-counts")) {
  process.stdout.write(
    `${JSON.stringify(observedInvalidCounts, null, 2)}\n`,
  );
  process.exit(0);
}

process.stdout.write(
  "Verified 3-generation provider root history golden, 31 executable rejection recipes, 11 point admissions, and 9 strict signatures.\n",
);
