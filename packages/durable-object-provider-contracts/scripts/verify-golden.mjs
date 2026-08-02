import {
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  sign,
} from "node:crypto";
import { open, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  verifyProviderContractGoldenManifestV1,
  verifyProviderContractNegativeManifestV1,
} from "../dist/golden-vectors.js";
import {
  PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_MAX_BYTES_V1,
  PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_PATH_V1,
  verifyProviderBootstrapTrustGoldenManifestResourceV1,
} from "../dist/bootstrap-trust-golden.js";
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

const scriptPath = fileURLToPath(import.meta.url);
const packageRoot = resolve(dirname(scriptPath), "..");

const cryptoHost = Object.freeze({
  sha256(message) {
    return new Uint8Array(createHash("sha256").update(message).digest());
  },
  hmacSha256(key, message) {
    return new Uint8Array(
      createHmac("sha256", key).update(message).digest(),
    );
  },
});

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readBoundedResource(relativePath, maxBytes) {
  const absolutePath = join(packageRoot, ...relativePath.split("/"));
  const handle = await open(absolutePath, "r");
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile() || metadata.size > maxBytes) {
      throw new Error(`golden resource violates byte cap: ${relativePath}`);
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
      throw new Error(`golden resource violates byte cap: ${relativePath}`);
    }
    return bounded.slice(0, offset);
  } finally {
    await handle.close();
  }
}

const golden = await readJson(
  join(packageRoot, "fixtures", "v1", "golden", "manifest.json"),
);
const negative = await readJson(
  join(packageRoot, "fixtures", "v1", "invalid", "manifest.json"),
);
const [bootstrapTrustGoldenBytes, strictManifestEnvelopeBytes] =
  await Promise.all([
    readBoundedResource(
      PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_RESOURCE_PATH_V1,
      PROVIDER_BOOTSTRAP_TRUST_GOLDEN_MANIFEST_MAX_BYTES_V1,
    ),
    readBoundedResource(
      PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
      PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
    ),
  ]);
const verifiedGolden = await verifyProviderContractGoldenManifestV1(
  golden,
  cryptoHost,
);
const verifiedNegative = await verifyProviderContractNegativeManifestV1(
  negative,
  verifiedGolden,
  cryptoHost,
);
let pointCalls = 0;
let verifyCalls = 0;
const strictCryptoCapability =
  await attestProviderStrictEd25519CryptoHostV1({
    host: Object.freeze({
      verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
      validatePrimeSubgroupPoint(point) {
        pointCalls += 1;
        return validatePrimeSubgroupPoint(point);
      },
      verifyRawEd25519(publicKey, message, signature) {
        verifyCalls += 1;
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
          throw new Error("unexpected strict manifest resource request");
        }
        return strictManifestEnvelopeBytes;
      },
    }),
  });
const verifiedBootstrapTrust =
  await verifyProviderBootstrapTrustGoldenManifestResourceV1(
    bootstrapTrustGoldenBytes,
    strictCryptoCapability,
  );
if (pointCalls !== 58 || verifyCalls !== 30) {
  throw new Error(
    `bootstrap golden strict crypto call mismatch: ${pointCalls}/${verifyCalls}`,
  );
}
const deterministicVector =
  verifiedBootstrapTrust.manifest.vectors
    .deterministicRootSelfSignatureSigning;
const deterministicPrivateKey = createPrivateKey({
  key: Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    Buffer.from(deterministicVector.rfc8032TestSeedHex, "hex"),
  ]),
  format: "der",
  type: "pkcs8",
});
const deterministicSpki = createPublicKey(
  deterministicPrivateKey,
).export({
  format: "der",
  type: "spki",
});
if (
  deterministicSpki.subarray(-32).toString("hex") !==
    deterministicVector.expected.rawPublicKeyHex ||
  sign(
    null,
    Buffer.from(
      deterministicVector.expected.canonicalMessageUtf8Hex,
      "hex",
    ),
    deterministicPrivateKey,
  ).toString("hex") !== deterministicVector.expected.rawSignatureHex
) {
  throw new Error("bootstrap trust deterministic signing golden mismatch");
}

process.stdout.write(
  `Verified ${
    verifiedGolden.stableIdVectors.length +
    verifiedGolden.hmacVectors.length +
    verifiedGolden.canonicalJsonVectors.length
  } provider foundation golden vectors, 8 bootstrap trust vectors, and ${
    verifiedNegative.cases.length
  } negative cases.\n`,
);
