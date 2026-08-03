import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalizeJcsSafeIntegerUtf8V1,
} from "../dist/jcs.js";
import {
  ProviderRegistryManifestHistoryValidationError,
  diagnoseProviderRegistryManifestHistoryInternalV1,
  validateProviderRegistryManifestHistoryV1,
} from "../dist/provider-registry-manifest-history.js";
import {
  PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_CASE_IDS_V1,
  PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_PATH_V1,
  verifyProviderRegistryManifestHistoryGoldenResourceV1,
  verifyProviderRegistryManifestHistoryInvalidResourceV1,
} from "../dist/provider-registry-manifest-fixtures.js";
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
  materializeProviderRegistryManifestInvalidCandidateV1,
} from "./lib/provider-registry-manifest-invalid-runner.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const materializedRequestSemanticDomain =
  "provider-registry-manifest-invalid-materialized-request-v1";

async function readResource(relativePath) {
  return new Uint8Array(
    await readFile(join(packageRoot, ...relativePath.split("/"))),
  );
}

function canonicalEqual(left, right) {
  return Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(left)).equals(
    Buffer.from(canonicalizeJcsSafeIntegerUtf8V1(right)),
  );
}

function sha256Semantic(domain, value) {
  return `sha256:${createHash("sha256")
    .update(canonicalizeJcsSafeIntegerUtf8V1([domain, value]))
    .digest("hex")}`;
}

function independentRequestSnapshot(value, recursion = new WeakSet()) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new TypeError("request digest encountered a non-JCS number");
    }
    return value;
  }
  if (typeof value !== "object" || recursion.has(value)) {
    throw new TypeError("request digest encountered a non-data cycle");
  }
  const arrayValue = Array.isArray(value);
  const prototype = Reflect.getPrototypeOf(value);
  if (
    (arrayValue && prototype !== Array.prototype) ||
    (!arrayValue && prototype !== Object.prototype && prototype !== null)
  ) {
    throw new TypeError("request digest encountered a non-data prototype");
  }
  recursion.add(value);
  try {
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError("request digest encountered a symbol");
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (arrayValue) {
      const length = descriptors.length?.value;
      if (
        !Number.isSafeInteger(length) ||
        length < 0 ||
        descriptors.length.enumerable !== false
      ) {
        throw new TypeError("request digest encountered an invalid array");
      }
      const arrayKeys = Object.keys(descriptors).filter(
        (key) => key !== "length",
      );
      if (
        arrayKeys.some((key) => {
          const index = Number(key);
          const descriptor = descriptors[key];
          return (
            !Number.isSafeInteger(index) ||
            index < 0 ||
            index >= length ||
            `${index}` !== key ||
            descriptor === undefined ||
            !("value" in descriptor) ||
            descriptor.enumerable !== true
          );
        })
      ) {
        throw new TypeError("request digest array has an extra property");
      }
      return Array.from({ length }, (_, index) => {
        const descriptor = descriptors[String(index)];
        return descriptor === undefined
          ? { fixtureInvalidArrayHole: true }
          : independentRequestSnapshot(descriptor.value, recursion);
      });
    }
    const output = {};
    for (const key of Object.keys(descriptors).sort()) {
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        throw new TypeError("request digest requires data properties");
      }
      output[key] = independentRequestSnapshot(
        descriptor.value,
        recursion,
      );
    }
    return output;
  } finally {
    recursion.delete(value);
  }
}

function independentlyDeriveMaterializedRequestDigest(request) {
  if (
    request === null ||
    typeof request !== "object" ||
    Array.isArray(request) ||
    Reflect.getPrototypeOf(request) !== Object.prototype ||
    Reflect.ownKeys(request).some((key) => typeof key !== "string")
  ) {
    throw new TypeError("request digest input must be a plain data object");
  }
  const descriptors = Object.getOwnPropertyDescriptors(request);
  const projectedRequest = {};
  for (const key of Object.keys(descriptors).sort()) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new TypeError("request digest input must be data-only");
    }
    projectedRequest[key] =
      key === "strictCryptoCapability"
        ? {
            profile:
              "provider_registry_manifest_invalid_attested_capability_sentinel_v1",
          }
        : independentRequestSnapshot(descriptor.value);
  }
  return sha256Semantic(materializedRequestSemanticDomain, {
    profile:
      "provider_registry_manifest_invalid_materialized_request_projection_v1",
    request: projectedRequest,
  });
}

const [goldenBytes, invalidBytes, strictManifestBytes] = await Promise.all([
  readResource(PROVIDER_REGISTRY_MANIFEST_HISTORY_GOLDEN_RESOURCE_PATH_V1),
  readResource(PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_RESOURCE_PATH_V1),
  readResource(PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1),
]);
const golden =
  verifyProviderRegistryManifestHistoryGoldenResourceV1(goldenBytes);
const invalid =
  verifyProviderRegistryManifestHistoryInvalidResourceV1(invalidBytes);

if (
  invalid.fixtureAuthority !== "none_rejection_only" ||
  invalid.materializedRequestSemanticDomain !==
    materializedRequestSemanticDomain ||
  invalid.caseCount !== 89 ||
  invalid.cases.length !== invalid.caseCount ||
  !canonicalEqual(invalid.caseIds, PROVIDER_REGISTRY_MANIFEST_HISTORY_INVALID_CASE_IDS_V1) ||
  new Set(
    invalid.cases.map(
      ({ expected }) => expected.materializedRequestSemanticDigest,
    ),
  ).size !== invalid.caseCount
) {
  throw new Error("invalid manifest corpus coverage closure mismatch");
}

let pointCalls = 0;
let signatureCalls = 0;
const strictCryptoCapability = await attestProviderStrictEd25519CryptoHostV1({
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
        resourcePath !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 ||
        maxBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
      ) {
        throw new Error("unexpected strict Ed25519 manifest request");
      }
      return strictManifestBytes.slice();
    },
  }),
});

for (const invalidCase of invalid.cases) {
  const { request, wrongDomainProofs } =
    materializeProviderRegistryManifestInvalidCandidateV1(
      golden,
      invalidCase,
      strictCryptoCapability,
    );
  const observedRequestSemanticDigest =
    independentlyDeriveMaterializedRequestDigest(request);
  if (
    observedRequestSemanticDigest !==
    invalidCase.expected.materializedRequestSemanticDigest
  ) {
    throw new Error(
      `materialized request semantic digest mismatch: ${invalidCase.caseId}`,
    );
  }
  if (
    wrongDomainProofs.length !== invalidCase.expected.wrongDomainProofCount
  ) {
    throw new Error(
      `wrong-domain proof count mismatch: ${invalidCase.caseId}`,
    );
  }
  for (const proof of wrongDomainProofs) {
    if (
      !(await verifyRawEd25519(
        proof.publicKeyBytes,
        proof.messageBytes,
        proof.signatureBytes,
      ))
    ) {
      throw new Error(
        `wrong-domain signature was not valid first: ${invalidCase.caseId}`,
      );
    }
  }

  pointCalls = 0;
  signatureCalls = 0;
  const diagnostic =
    await diagnoseProviderRegistryManifestHistoryInternalV1(request);
  if (
    !canonicalEqual(diagnostic, {
      ok: false,
      stage: invalidCase.expected.stage,
      reason: invalidCase.expected.reason,
    }) ||
    pointCalls !== invalidCase.expected.postAttestationPointCalls ||
    signatureCalls !== invalidCase.expected.postAttestationSignatureCalls
  ) {
    throw new Error(
      `invalid case diagnostic mismatch ${invalidCase.caseId}: ${JSON.stringify({
        diagnostic,
        pointCalls,
        signatureCalls,
      })}`,
    );
  }

  let publicError;
  try {
    await validateProviderRegistryManifestHistoryV1(request);
  } catch (error) {
    publicError = error;
  }
  if (
    !(publicError instanceof ProviderRegistryManifestHistoryValidationError) ||
    publicError.name !== invalidCase.expected.publicFailure.errorName ||
    publicError.code !== invalidCase.expected.publicFailure.code ||
    publicError.reason !== invalidCase.expected.publicFailure.reason ||
    publicError.message !== "Provider registry manifest history validation failed" ||
    "stage" in publicError ||
    JSON.stringify(publicError).includes("registryManifestHistory") ||
    JSON.stringify(publicError).includes("provider/registry-manifests")
  ) {
    throw new Error(
      `invalid case public failure mismatch: ${invalidCase.caseId}`,
    );
  }
}

process.stdout.write(
  `verified ${invalid.caseCount} provider Registry Manifest invalid cases with exact diagnostics, opaque public failures, and crypto call counts\n`,
);
