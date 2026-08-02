import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_RESOURCE_BYTE_LENGTH_V1,
  PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_RESOURCE_PATH_V1,
  PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_RESOURCE_SHA256_HEX_V1,
  PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_SEMANTIC_CONTENT_DIGEST_V1,
  serializeProviderBootstrapTrustInvalidManifestFixtureInternalV1,
  verifyProviderBootstrapTrustInvalidManifestResourceV1,
} from "../dist/bootstrap-trust-invalid.js";
import { canonicalizeJcsSafeIntegerUtf8V1 } from "../dist/jcs.js";

const packageRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);
const fixturePath = join(
  packageRoot,
  ...PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_RESOURCE_PATH_V1.split(
    "/",
  ),
);
const serialized =
  serializeProviderBootstrapTrustInvalidManifestFixtureInternalV1();
const serializedBytes = Buffer.from(serialized, "utf8");
const rawSha256Hex = createHash("sha256")
  .update(serializedBytes)
  .digest("hex");
const semanticSha256Hex = createHash("sha256")
  .update(
    canonicalizeJcsSafeIntegerUtf8V1(JSON.parse(serialized)),
  )
  .digest("hex");

if (process.argv.includes("--anchors")) {
  process.stdout.write(
    `${JSON.stringify(
      {
        resourceByteLength: serializedBytes.byteLength,
        resourceSha256Hex: rawSha256Hex,
        semanticContentDigest: `sha256:${semanticSha256Hex}`,
      },
      null,
      2,
    )}\n`,
  );
  process.exit(0);
}

if (process.argv.includes("--check")) {
  const checkedIn = await readFile(fixturePath);
  if (!checkedIn.equals(serializedBytes)) {
    throw new Error(
      "bootstrap trust invalid manifest differs from the compiled exact case catalog",
    );
  }
  if (
    checkedIn.byteLength !==
      PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_RESOURCE_BYTE_LENGTH_V1 ||
    rawSha256Hex !==
      PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_RESOURCE_SHA256_HEX_V1 ||
    `sha256:${semanticSha256Hex}` !==
      PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_SEMANTIC_CONTENT_DIGEST_V1
  ) {
    throw new Error(
      "bootstrap trust invalid manifest compiled anchors are stale",
    );
  }
  const validation =
    verifyProviderBootstrapTrustInvalidManifestResourceV1(
      new Uint8Array(checkedIn),
    );
  if (
    validation.authority !== "none_rejection_only" ||
    validation.manifest.cases.length !== 51
  ) {
    throw new Error(
      "bootstrap trust invalid manifest validation lost its exact case contract",
    );
  }
  process.stdout.write(
    "Verified 51 exact provider bootstrap structure/crypto invalid cases and raw/semantic anchors.\n",
  );
  process.exit(0);
}

await mkdir(dirname(fixturePath), { recursive: true });
await writeFile(fixturePath, serializedBytes);
process.stdout.write(
  `Generated ${PROVIDER_BOOTSTRAP_TRUST_INVALID_MANIFEST_RESOURCE_PATH_V1} with 51 exact cases.\n`,
);
