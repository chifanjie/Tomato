import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PROVIDER_BOOTSTRAP_TRUST_BUNDLE_CONTENT_DIGEST_V1,
  PROVIDER_BOOTSTRAP_TRUST_BUNDLE_MAX_BYTES_V1,
  PROVIDER_BOOTSTRAP_TRUST_BUNDLE_PIN_V1,
  PROVIDER_BOOTSTRAP_TRUST_BUNDLE_RESOURCE_PATH_V1,
  createProviderBootstrapTrustBundlePinV1,
  validateProviderBootstrapTrustBundleStructureV1,
} from "../dist/bootstrap-trust-bundle.js";
import {
  PROVIDER_BOOTSTRAP_TRUST_BUNDLE_GOLDEN_RESOURCE_PATH_V1,
  PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_MAX_BYTES_V1,
  PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_PATH_V1,
  verifyProviderBootstrapTrustGoldenManifestResourceV1,
} from "../dist/bootstrap-trust-golden.js";
import {
  canonicalizeJcsSafeIntegerUtf8V1,
  parseCanonicalJcsSafeIntegerUtf8V1,
} from "../dist/jcs.js";
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

const packageRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);

async function readBoundedResource(relativePath, maxBytes) {
  const absolutePath = join(packageRoot, ...relativePath.split("/"));
  const handle = await open(absolutePath, "r");
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile() || metadata.size > maxBytes) {
      throw new Error(`fixed resource violates its byte cap: ${relativePath}`);
    }
    const bounded = new Uint8Array(maxBytes + 1);
    let offset = 0;
    while (offset < bounded.byteLength) {
      const { bytesRead } = await handle.read(
        bounded,
        offset,
        bounded.byteLength - offset,
        offset,
      );
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset > maxBytes) {
      throw new Error(`fixed resource violates its byte cap: ${relativePath}`);
    }
    return bounded.slice(0, offset);
  } finally {
    await handle.close();
  }
}

const [
  bundleEnvelopeBytes,
  strictManifestEnvelopeBytes,
  goldenBytes,
  bootstrapTrustGoldenBytes,
] =
  await Promise.all([
    readBoundedResource(
      PROVIDER_BOOTSTRAP_TRUST_BUNDLE_RESOURCE_PATH_V1,
      PROVIDER_BOOTSTRAP_TRUST_BUNDLE_MAX_BYTES_V1,
    ),
    readBoundedResource(
      PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
      PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
    ),
    readBoundedResource(
      PROVIDER_BOOTSTRAP_TRUST_BUNDLE_GOLDEN_RESOURCE_PATH_V1,
      PROVIDER_BOOTSTRAP_TRUST_BUNDLE_MAX_BYTES_V1,
    ),
    readBoundedResource(
      PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_PATH_V1,
      PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_MAX_BYTES_V1,
    ),
  ]);
if (!Buffer.from(bundleEnvelopeBytes).equals(Buffer.from(goldenBytes))) {
  throw new Error("bootstrap trust resource and golden bytes differ");
}
let pointCalls = 0;
let verifyCalls = 0;
const host = Object.freeze({
  verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint(point) {
    pointCalls += 1;
    return validatePrimeSubgroupPoint(point);
  },
  verifyRawEd25519(publicKey, message, signature) {
    verifyCalls += 1;
    return verifyRawEd25519(publicKey, message, signature);
  },
});
const resourceHost = Object.freeze({
  readFixedSignedPackageResource(resourcePath, maxBytes) {
    if (
      resourcePath !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 ||
      maxBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
    ) {
      throw new Error("unexpected strict manifest resource request");
    }
    return strictManifestEnvelopeBytes;
  },
});
const strictCryptoCapability =
  await attestProviderStrictEd25519CryptoHostV1({
    host,
    resourceHost,
  });
const goldenValidation =
  await verifyProviderBootstrapTrustGoldenManifestResourceV1(
    bootstrapTrustGoldenBytes,
    strictCryptoCapability,
  );
if (
  goldenValidation.authority !== "none_structure_only" ||
  goldenValidation.manifest.fixedBundleResource.resourceByteLength !==
    bundleEnvelopeBytes.byteLength ||
  goldenValidation.manifest.fixedBundleResource
    .resourceBytesSha256Hex !==
    createHash("sha256").update(bundleEnvelopeBytes).digest("hex")
) {
  throw new Error("bootstrap trust resource byte anchor mismatch");
}
const validation =
  await validateProviderBootstrapTrustBundleStructureV1({
    bundleEnvelopeBytes,
    strictManifestEnvelopeBytes,
    strictCryptoCapability,
  });
if (
  validation.authority !== "none_structure_only" ||
  validation.bundleEnvelope.contentDigest !==
    PROVIDER_BOOTSTRAP_TRUST_BUNDLE_CONTENT_DIGEST_V1 ||
  pointCalls !== 62 ||
  verifyCalls !== 31
) {
  throw new Error("bootstrap trust structure verification count mismatch");
}
const parsedBundle = parseCanonicalJcsSafeIntegerUtf8V1(
  bundleEnvelopeBytes,
);
if (
  canonicalizeJcsSafeIntegerUtf8V1(parsedBundle).byteLength !==
  bundleEnvelopeBytes.byteLength
) {
  throw new Error("bootstrap trust resource is not canonical");
}
if (
  Buffer.from(
    canonicalizeJcsSafeIntegerUtf8V1(parsedBundle.payload),
  ).toString("hex") !==
  Buffer.from(
    canonicalizeJcsSafeIntegerUtf8V1(
      goldenValidation.manifest.vectors.bootstrapTrustBundleDigest
        .fields,
    ),
  ).toString("hex")
) {
  throw new Error("bootstrap trust resource payload differs from golden");
}
const derivedPin = createProviderBootstrapTrustBundlePinV1(parsedBundle);
if (
  JSON.stringify(derivedPin) !==
  JSON.stringify(PROVIDER_BOOTSTRAP_TRUST_BUNDLE_PIN_V1)
) {
  throw new Error("compiled bootstrap trust pin differs from fixed resource");
}

process.stdout.write(
  `Verified structure-only bootstrap trust resource ${PROVIDER_BOOTSTRAP_TRUST_BUNDLE_CONTENT_DIGEST_V1}, 8 immutable vectors, and 62 point plus 31 signature checks.\n`,
);
