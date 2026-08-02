import { createHash, createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  verifyProviderContractGoldenManifestV1,
  verifyProviderContractNegativeManifestV1,
} from "../dist/golden-vectors.js";

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

const golden = await readJson(
  join(packageRoot, "fixtures", "v1", "golden", "manifest.json"),
);
const negative = await readJson(
  join(packageRoot, "fixtures", "v1", "invalid", "manifest.json"),
);

const verifiedGolden = await verifyProviderContractGoldenManifestV1(
  golden,
  cryptoHost,
);
const verifiedNegative = await verifyProviderContractNegativeManifestV1(
  negative,
  verifiedGolden,
  cryptoHost,
);

process.stdout.write(
  `Verified ${
    verifiedGolden.stableIdVectors.length +
    verifiedGolden.hmacVectors.length +
    verifiedGolden.canonicalJsonVectors.length
  } provider golden vectors and ${verifiedNegative.cases.length} negative cases.\n`,
);
