import { createHash, createHmac } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_CONTENT_DIGEST_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1,
  PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1,
  attestProviderStrictEd25519CryptoHostV1,
  getProviderStrictEd25519CryptoCapabilityBytesV1,
} from "../dist/strict-ed25519-conformance.js";
import {
  STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
  verifyRawEd25519,
} from "../dist/strict-ed25519.js";
import {
  verifyProviderEd25519PublicKeyDigestGoldenManifestV1,
} from "../dist/public-key-digest.js";

const scriptPath = fileURLToPath(import.meta.url);
const packageRoot = resolve(dirname(scriptPath), "..");

const host = Object.freeze({
  verificationProfile: STRICT_ED25519_VERIFICATION_PROFILE_V1,
  validatePrimeSubgroupPoint,
  verifyRawEd25519,
});

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

const resourceHost = Object.freeze({
  async readFixedSignedPackageResource(resourcePath, maxBytes) {
    if (
      resourcePath !== PROVIDER_STRICT_ED25519_MANIFEST_RESOURCE_PATH_V1 ||
      maxBytes !== PROVIDER_STRICT_ED25519_MANIFEST_MAX_BYTES_V1
    ) {
      throw new Error("unexpected strict Ed25519 resource request");
    }
    const absolutePath = join(packageRoot, ...resourcePath.split("/"));
    const metadata = await stat(absolutePath);
    if (!metadata.isFile() || metadata.size > maxBytes) {
      throw new Error("strict Ed25519 resource violates the fixed byte cap");
    }
    return new Uint8Array(await readFile(absolutePath));
  },
});

const capability = await attestProviderStrictEd25519CryptoHostV1({
  host,
  resourceHost,
});
const capabilityBytes =
  getProviderStrictEd25519CryptoCapabilityBytesV1(capability);
if (capabilityBytes.byteLength === 0) {
  throw new Error("strict Ed25519 attestation returned empty capability bytes");
}
const publicKeyDigestGolden = JSON.parse(
  await readFile(
    join(
      packageRoot,
      "fixtures",
      "v1",
      "golden",
      "ed25519-public-key-digest-v1.json",
    ),
    "utf8",
  ),
);
await verifyProviderEd25519PublicKeyDigestGoldenManifestV1(
  publicKeyDigestGolden,
  cryptoHost,
);

process.stdout.write(
  `Verified strict Ed25519 host manifest ${PROVIDER_STRICT_ED25519_ADVERSARIAL_MANIFEST_CONTENT_DIGEST_V1} and raw-key digest golden.\n`,
);
