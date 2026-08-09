import { Buffer } from "node:buffer";
import {
  createPublicKey,
  verify as verifyEd25519WithNodeCrypto,
} from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const NODE_ED25519_SPKI_PREFIX_V1 = Buffer.from(
  "302a300506032b6570032100",
  "hex",
);
const nodeEd25519PublicKeysV1 = new Map();
const nodeEd25519PublicKeyAdmissionsV1 = new Map();

function verifyRawEd25519WithAttestedNodeHostV1(
  publicKey,
  message,
  signature,
  validatePrimeSubgroupPoint,
  publicKeyAdmissionCacheEnabled,
) {
  if (
    !(publicKey instanceof Uint8Array) ||
    publicKey.byteLength !== 32 ||
    !(message instanceof Uint8Array) ||
    !(signature instanceof Uint8Array) ||
    signature.byteLength !== 64
  ) {
    return false;
  }
  const cacheKey = Buffer.from(publicKey).toString("hex");
  let publicKeyAdmitted;
  if (
    publicKeyAdmissionCacheEnabled &&
    nodeEd25519PublicKeyAdmissionsV1.has(cacheKey)
  ) {
    publicKeyAdmitted = nodeEd25519PublicKeyAdmissionsV1.get(cacheKey);
  } else {
    publicKeyAdmitted = validatePrimeSubgroupPoint(publicKey);
    if (publicKeyAdmissionCacheEnabled) {
      nodeEd25519PublicKeyAdmissionsV1.set(cacheKey, publicKeyAdmitted);
    }
  }
  try {
    let key = nodeEd25519PublicKeysV1.get(cacheKey);
    if (key === undefined) {
      const subjectPublicKeyInfo = Buffer.concat([
        NODE_ED25519_SPKI_PREFIX_V1,
        Buffer.from(publicKey),
      ]);
      key = createPublicKey({
        key: subjectPublicKeyInfo,
        format: "der",
        type: "spki",
      });
      nodeEd25519PublicKeysV1.set(cacheKey, key);
    }
    const nativeResult = verifyEd25519WithNodeCrypto(
      null,
      message,
      key,
      signature,
    );
    return publicKeyAdmitted && nativeResult;
  } catch {
    return false;
  }
}

function exactArgumentsV1(argv) {
  if (argv.length !== 6) {
    throw new TypeError("C09 packed Node worker requires exactly six arguments");
  }
  const [nonce, laneText, installedRoot, goldenExpected, invalidExpected, strictExpected] =
    argv;
  const laneIndex = Number(laneText);
  if (
    !/^[0-9a-f]{32}$/u.test(nonce) ||
    !Number.isSafeInteger(laneIndex) ||
    laneIndex < 0 ||
    laneIndex > 3 ||
    !isAbsolute(installedRoot) ||
    ![goldenExpected, invalidExpected, strictExpected].every(isAbsolute)
  ) {
    throw new TypeError("C09 packed Node worker arguments are invalid");
  }
  return {
    nonce,
    laneIndex,
    installedRoot,
    expectedPaths: Object.freeze({
      golden: goldenExpected,
      invalid: invalidExpected,
      strict: strictExpected,
    }),
  };
}

function isStrictDescendantV1(rootPath, candidatePath) {
  const relativePath = relative(rootPath, candidatePath);
  return (
    relativePath.length > 0 &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  );
}

export async function resolveC09ColdInstallPathsV1(input) {
  const installedRoot = await realpath(resolve(input.installedRoot));
  const expectedPaths = Object.fromEntries(
    await Promise.all(
      Object.entries(input.expectedPaths).map(async ([key, path]) => [
        key,
        await realpath(resolve(path)),
      ]),
    ),
  );
  for (const [label, path] of Object.entries(expectedPaths)) {
    if (!isStrictDescendantV1(installedRoot, path)) {
      throw new Error(`C09 packed Node ${label} path escaped cold install`);
    }
  }
  return Object.freeze({
    installedRoot,
    expectedPaths: Object.freeze(expectedPaths),
  });
}

async function resolvedResourceV1(specifier, expectedPath, installedRoot) {
  const resolvedPath = await realpath(
    fileURLToPath(new URL(import.meta.resolve(specifier))),
  );
  if (
    resolvedPath !== expectedPath ||
    !isStrictDescendantV1(installedRoot, resolvedPath)
  ) {
    throw new Error(`C09 packed Node resource escaped cold install: ${specifier}`);
  }
  const fileBytes = await readFile(resolvedPath);
  const bytes = new Uint8Array(
    fileBytes.buffer,
    fileBytes.byteOffset,
    fileBytes.byteLength,
  );
  if (
    bytes.buffer !== fileBytes.buffer ||
    bytes.byteOffset !== fileBytes.byteOffset ||
    bytes.byteLength !== fileBytes.byteLength
  ) {
    throw new Error(`C09 packed Node resource was copied: ${specifier}`);
  }
  return bytes;
}

async function mainV1() {
  const input = exactArgumentsV1(process.argv.slice(2));
  const paths = await resolveC09ColdInstallPathsV1(input);
  const [goldenBytes, invalidBytes, strictManifestBytes] = await Promise.all([
    resolvedResourceV1(
      "@understand-code/durable-object-provider-contracts/fixtures/v1/golden/provider-registry-evidence-binding-point-v1.json",
      paths.expectedPaths.golden,
      paths.installedRoot,
    ),
    resolvedResourceV1(
      "@understand-code/durable-object-provider-contracts/fixtures/v1/invalid/provider-registry-evidence-binding-point-v1.json",
      paths.expectedPaths.invalid,
      paths.installedRoot,
    ),
    resolvedResourceV1(
      "@understand-code/durable-object-provider-contracts/provider/ed25519-strict-host-conformance-v1.json",
      paths.expectedPaths.strict,
      paths.installedRoot,
    ),
  ]);
  const { executeC09DistributionReplayLaneV1 } = await import(
    "./provider-registry-evidence-binding-distribution-replay-core.mjs"
  );
  const result = await executeC09DistributionReplayLaneV1(
    {
      runtime: "node",
      nonce: input.nonce,
      laneIndex: input.laneIndex,
      goldenBytes,
      invalidBytes,
      strictManifestBytes,
    },
    verifyRawEd25519WithAttestedNodeHostV1,
  );
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

let isMain = false;
if (process.argv[1] !== undefined) {
  try {
    isMain =
      (await realpath(resolve(process.argv[1]))) ===
      (await realpath(fileURLToPath(import.meta.url)));
  } catch {
    isMain = false;
  }
}
if (isMain) await mainV1();
